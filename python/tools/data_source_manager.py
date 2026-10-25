
#!/usr/bin/env python3
"""
MedOrbits Central Data Source Manager
=====================================

File:
    python/tools/data_source_manager.py

Purpose:
    Discover, load, validate, catalog, and expose JSON datasets from
    assets/data/ and other configured project locations.

Features:
    - Recursively discovers JSON datasets.
    - Prioritizes configured data directories.
    - Loads datasets without modifying source files.
    - Supports dictionaries, lists, strings, numbers, booleans and null.
    - Tracks the source path and modification time of each dataset.
    - Detects invalid JSON and duplicate dataset names.
    - Supports explicit dataset aliases and required datasets.
    - Provides a unified read-only data access interface.
    - Supports refreshing the data catalog.
    - Generates JSON data catalog and validation reports.
    - Does not invent data, endpoints, credentials or schemas.
    - Uses only the Python standard library.

Compatibility:
    Python 3.10+

Run from repository root:
    python python/tools/data_source_manager.py

Inspect datasets:
    python python/tools/data_source_manager.py --list

Validate all discovered JSON:
    python python/tools/data_source_manager.py --validate

Export catalog:
    python python/tools/data_source_manager.py --catalog

Custom repository root:
    python python/tools/data_source_manager.py --root .

Environment:
    MEDORBITS_DATA_DIRS may contain additional data directories separated
    by the platform-specific path separator.

Important:
    This module reads local files. It does not automatically fetch external
    APIs, database records, or connected-app data sources.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import threading
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from types import MappingProxyType
from typing import Any, Iterable, Mapping


DEFAULT_DATA_DIRECTORIES = (
    "assets/data",
    "assets",
    "data",
    "datasets",
    "python/data",
    "config/data",
)

DEFAULT_IGNORED_DIRECTORIES = {
    ".git",
    ".venv",
    "venv",
    "env",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    "dist",
    "build",
    "coverage",
}

DATASET_NAME_PATTERN = re.compile(
    r"^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,199}$"
)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class DataSourceError(RuntimeError):
    """Base exception for data-source failures."""


class DatasetNotFoundError(DataSourceError, KeyError):
    """Raised when a requested dataset cannot be found."""


class DatasetLoadError(DataSourceError):
    """Raised when a dataset cannot be loaded."""


class DuplicateDatasetError(DataSourceError):
    """Raised when dataset resolution is ambiguous."""


class InvalidDatasetNameError(DataSourceError, ValueError):
    """Raised when a dataset identifier is invalid."""


# ---------------------------------------------------------------------------
# Dataset metadata
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class DatasetRecord:
    """Metadata describing a discovered JSON dataset."""

    name: str
    relative_path: str
    absolute_path: str
    size_bytes: int
    modified_at: str
    sha256: str
    top_level_type: str | None
    top_level_keys: tuple[str, ...] = ()
    valid_json: bool = True
    error: str | None = None


@dataclass(frozen=True, slots=True)
class DatasetIssue:
    """A dataset discovery, validation, or loading issue."""

    severity: str
    code: str
    path: str
    message: str


# ---------------------------------------------------------------------------
# Data source manager
# ---------------------------------------------------------------------------


class DataSourceManager:
    """
    Centralized JSON data access for MedOrbits.

    Dataset identifiers are derived from filenames. For example:

        assets/data/colleges.json -> colleges
        assets/data/jobs.json -> jobs
        assets/data/medical/colleges.json -> medical/colleges

    When the same dataset name occurs in multiple directories, lookup raises
    DuplicateDatasetError unless a specific source path is supplied.

    This prevents silently selecting the wrong dataset.
    """

    def __init__(
        self,
        root: str | Path,
        *,
        data_directories: Iterable[str | Path] | None = None,
        recursive: bool = True,
        ignore_directories: Iterable[str] | None = None,
        include_hidden: bool = False,
    ) -> None:
        self.root = Path(root).expanduser().resolve()

        if not self.root.is_dir():
            raise DataSourceError(
                f"Repository root does not exist: {self.root}"
            )

        if data_directories is None:
            configured = list(DEFAULT_DATA_DIRECTORIES)
            environment_dirs = os.environ.get("MEDORBITS_DATA_DIRS", "")

            if environment_dirs:
                configured.extend(
                    item
                    for item in environment_dirs.split(os.pathsep)
                    if item.strip()
                )

            self.data_directories = tuple(
                dict.fromkeys(configured)
            )
        else:
            self.data_directories = tuple(data_directories)

        self.recursive = recursive
        self.ignore_directories = set(
            ignore_directories or DEFAULT_IGNORED_DIRECTORIES
        )
        self.include_hidden = include_hidden

        self._lock = threading.RLock()
        self._records: dict[str, list[DatasetRecord]] = {}
        self._cache: dict[str, tuple[str, Any]] = {}
        self._aliases: dict[str, str] = {}
        self._issues: list[DatasetIssue] = []

        self.refresh()

    # ------------------------------------------------------------------
    # Path and name validation
    # ------------------------------------------------------------------

    def _safe_path(self, path: Path) -> Path:
        resolved = path.resolve()

        try:
            resolved.relative_to(self.root)
        except ValueError as exc:
            raise DataSourceError(
                f"Path is outside repository root: {path}"
            ) from exc

        return resolved

    @staticmethod
    def _validate_name(name: str) -> str:
        if not isinstance(name, str):
            raise InvalidDatasetNameError(
                "Dataset name must be a string."
            )

        normalized = name.strip().replace("\\", "/")

        if not normalized or normalized.startswith("/"):
            raise InvalidDatasetNameError(
                "Dataset name cannot be empty or absolute."
            )

        if any(part in {"", ".", ".."} for part in normalized.split("/")):
            raise InvalidDatasetNameError(
                f"Unsafe dataset name: {name!r}"
            )

        if not all(
            DATASET_NAME_PATTERN.fullmatch(part)
            for part in normalized.split("/")
        ):
            raise InvalidDatasetNameError(
                f"Invalid dataset name: {name!r}"
            )

        return normalized

    def _configured_roots(self) -> list[Path]:
        roots: list[Path] = []

        for directory in self.data_directories:
            candidate = Path(directory)

            if not candidate.is_absolute():
                candidate = self.root / candidate

            candidate = candidate.resolve(strict=False)

            try:
                candidate.relative_to(self.root)
            except ValueError:
                self._issues.append(
                    DatasetIssue(
                        severity="WARNING",
                        code="DATA_DIRECTORY_OUTSIDE_ROOT",
                        path=str(candidate),
                        message="Configured data directory is outside the repository.",
                    )
                )
                continue

            if candidate.is_dir() and candidate not in roots:
                roots.append(candidate)

        return roots

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    def refresh(self) -> None:
        """Rediscover JSON files and invalidate the in-memory data cache."""

        records: dict[str, list[DatasetRecord]] = defaultdict(list)
        issues: list[DatasetIssue] = []

        for directory in self._configured_roots():
            if self.recursive:
                candidates = directory.rglob("*.json")
            else:
                candidates = directory.glob("*.json")

            for path in sorted(candidates):
                if not path.is_file():
                    continue

                relative_parts = path.relative_to(self.root).parts

                if any(
                    part in self.ignore_directories
                    for part in relative_parts
                ):
                    continue

                if not self.include_hidden and any(
                    part.startswith(".")
                    for part in relative_parts
                ):
                    continue

                try:
                    safe_path = self._safe_path(path)
                    raw = safe_path.read_bytes()
                    stat = safe_path.stat()
                except (OSError, DataSourceError) as exc:
                    issues.append(
                        DatasetIssue(
                            severity="ERROR",
                            code="DATASET_READ_FAILED",
                            path=str(path),
                            message=str(exc),
                        )
                    )
                    continue

                relative_path = safe_path.relative_to(self.root).as_posix()
                name = safe_path.relative_to(directory).with_suffix("").as_posix()

                try:
                    payload = json.loads(raw.decode("utf-8-sig"))
                    top_level_type = type(payload).__name__

                    if isinstance(payload, dict):
                        keys = tuple(sorted(str(key) for key in payload))
                    else:
                        keys = ()

                    valid_json = True
                    error = None

                except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                    top_level_type = None
                    keys = ()
                    valid_json = False
                    error = str(exc)

                    issues.append(
                        DatasetIssue(
                            severity="ERROR",
                            code="INVALID_JSON",
                            path=relative_path,
                            message=error,
                        )
                    )

                record = DatasetRecord(
                    name=name,
                    relative_path=relative_path,
                    absolute_path=str(safe_path),
                    size_bytes=stat.st_size,
                    modified_at=datetime.fromtimestamp(
                        stat.st_mtime,
                        timezone.utc,
                    ).isoformat(),
                    sha256=hashlib.sha256(raw).hexdigest(),
                    top_level_type=top_level_type,
                    top_level_keys=keys,
                    valid_json=valid_json,
                    error=error,
                )

                records[name].append(record)

        with self._lock:
            self._records = {
                name: sorted(
                    entries,
                    key=lambda entry: entry.relative_path,
                )
                for name, entries in records.items()
            }
            self._cache.clear()
            self._issues = issues

    # ------------------------------------------------------------------
    # Aliases
    # ------------------------------------------------------------------

    def register_alias(self, alias: str, dataset_name: str) -> None:
        """
        Register an explicit alias for a dataset.

        Aliases do not override existing datasets or other aliases.
        """

        normalized_alias = self._validate_name(alias)
        normalized_dataset = self._validate_name(dataset_name)

        with self._lock:
            if normalized_alias in self._records:
                raise DuplicateDatasetError(
                    f"Alias conflicts with dataset name: {normalized_alias}"
                )

            if normalized_alias in self._aliases:
                raise DuplicateDatasetError(
                    f"Alias already exists: {normalized_alias}"
                )

            if normalized_dataset not in self._records:
                raise DatasetNotFoundError(
                    f"Target dataset does not exist: {normalized_dataset}"
                )

            self._aliases[normalized_alias] = normalized_dataset

    # ------------------------------------------------------------------
    # Listing and lookup
    # ------------------------------------------------------------------

    def names(self, *, include_invalid: bool = True) -> tuple[str, ...]:
        """List all dataset identifiers."""

        with self._lock:
            if include_invalid:
                return tuple(sorted(self._records))

            return tuple(
                sorted(
                    name
                    for name, entries in self._records.items()
                    if any(record.valid_json for record in entries)
                )
            )

    def records(self, name: str | None = None) -> tuple[DatasetRecord, ...]:
        """Return metadata for every dataset or one named dataset."""

        with self._lock:
            if name is None:
                return tuple(
                    record
                    for dataset_name in sorted(self._records)
                    for record in self._records[dataset_name]
                )

            normalized = self._resolve_alias(
                self._validate_name(name)
            )

            entries = self._records.get(normalized)

            if not entries:
                raise DatasetNotFoundError(
                    f"Dataset not found: {normalized}"
                )

            return tuple(entries)

    def _resolve_alias(self, name: str) -> str:
        seen: set[str] = set()
        current = name

        while current in self._aliases:
            if current in seen:
                raise DataSourceError(
                    f"Dataset alias cycle detected: {name}"
                )

            seen.add(current)
            current = self._aliases[current]

        return current

    def _select_record(
        self,
        name: str,
        *,
        source: str | Path | None = None,
    ) -> DatasetRecord:
        normalized = self._resolve_alias(
            self._validate_name(name)
        )

        with self._lock:
            entries = list(self._records.get(normalized, []))

        if source is not None:
            source_path = Path(source)

            if not source_path.is_absolute():
                source_path = self.root / source_path

            resolved_source = self._safe_path(source_path)

            for record in entries:
                if Path(record.absolute_path) == resolved_source:
                    if not record.valid_json:
                        raise DatasetLoadError(
                            f"Dataset contains invalid JSON: {record.relative_path}"
                        )
                    return record

            raise DatasetNotFoundError(
                f"No matching source for {normalized}: {source}"
            )

        valid_entries = [
            record for record in entries
            if record.valid_json
        ]

        if not valid_entries:
            if entries:
                raise DatasetLoadError(
                    f"No valid JSON source exists for dataset: {normalized}"
                )
            raise DatasetNotFoundError(
                f"Dataset not found: {normalized}"
            )

        if len(valid_entries) > 1:
            locations = ", ".join(
                record.relative_path for record in valid_entries
            )
            raise DuplicateDatasetError(
                f"Dataset {normalized!r} has multiple sources: {locations}. "
                "Specify source=... to choose one."
            )

        return valid_entries[0]

    # ------------------------------------------------------------------
    # Data loading
    # ------------------------------------------------------------------

    def load(
        self,
        name: str,
        *,
        source: str | Path | None = None,
        use_cache: bool = True,
    ) -> Any:
        """
        Load a JSON dataset.

        Returns ordinary Python dictionaries, lists, and scalar values.
        Returned objects are not recursively immutable; callers should treat
        shared cached values as read-only.

        Use use_cache=False to request a fresh read from disk.
        """

        record = self._select_record(name, source=source)

        cache_key = record.relative_path

        with self._lock:
            cached = self._cache.get(cache_key)

            if use_cache and cached and cached[0] == record.sha256:
                return cached[1]

        path = Path(record.absolute_path)

        try:
            raw = path.read_bytes()
        except OSError as exc:
            raise DatasetLoadError(
                f"Unable to read dataset {record.relative_path}: {exc}"
            ) from exc

        actual_hash = hashlib.sha256(raw).hexdigest()

        try:
            payload = json.loads(raw.decode("utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise DatasetLoadError(
                f"Unable to parse {record.relative_path}: {exc}"
            ) from exc

        with self._lock:
            if use_cache:
                self._cache[cache_key] = (actual_hash, payload)

        return payload

    def get(
        self,
        name: str,
        default: Any = None,
        *,
        source: str | Path | None = None,
    ) -> Any:
        """Load a dataset, returning default if it is absent or ambiguous."""

        try:
            return self.load(name, source=source)
        except (DatasetNotFoundError, DuplicateDatasetError):
            return default

    def require(
        self,
        names: Iterable[str],
    ) -> Mapping[str, Any]:
        """Load all required datasets or raise a clear error."""

        loaded: dict[str, Any] = {}
        failures: list[str] = []

        for name in names:
            try:
                loaded[name] = self.load(name)
            except DataSourceError as exc:
                failures.append(f"{name}: {exc}")

        if failures:
            raise DatasetLoadError(
                "Required datasets could not all be loaded:\n- "
                + "\n- ".join(failures)
            )

        return MappingProxyType(loaded)

    def load_all(
        self,
        *,
        include_invalid: bool = False,
    ) -> Mapping[str, Any]:
        """
        Load datasets with unique names.

        Duplicate names are reported in issues and omitted rather than
        silently selecting an arbitrary file.
        """

        loaded: dict[str, Any] = {}

        for name in self.names(include_invalid=include_invalid):
            entries = self._records.get(name, [])

            if len([item for item in entries if item.valid_json]) != 1:
                continue

            try:
                loaded[name] = self.load(name)
            except DataSourceError as exc:
                self._issues.append(
                    DatasetIssue(
                        severity="WARNING",
                        code="DATASET_LOAD_FAILED",
                        path=name,
                        message=str(exc),
                    )
                )

        return MappingProxyType(loaded)

    # ------------------------------------------------------------------
    # Validation and catalog
    # ------------------------------------------------------------------

    def validate(
        self,
        *,
        required_datasets: Iterable[str] = (),
        expected_types: Mapping[str, type] | None = None,
    ) -> tuple[DatasetIssue, ...]:
        """
        Validate JSON parsing and optional top-level data contracts.

        Example:
            manager.validate(
                required_datasets=("colleges", "courses"),
                expected_types={
                    "colleges": list,
                    "courses": dict,
                },
            )
        """

        issues = list(self._issues)
        expected_types = expected_types or {}

        for name in required_datasets:
            try:
                self._select_record(name)
            except DataSourceError as exc:
                issues.append(
                    DatasetIssue(
                        severity="ERROR",
                        code="REQUIRED_DATASET_MISSING",
                        path=name,
                        message=str(exc),
                    )
                )

        for name, expected_type in expected_types.items():
            try:
                payload = self.load(name)
            except DataSourceError as exc:
                issues.append(
                    DatasetIssue(
                        severity="ERROR",
                        code="EXPECTED_TYPE_UNAVAILABLE",
                        path=name,
                        message=str(exc),
                    )
                )
                continue

            if not isinstance(payload, expected_type):
                issues.append(
                    DatasetIssue(
                        severity="ERROR",
                        code="DATASET_TYPE_MISMATCH",
                        path=name,
                        message=(
                            f"Expected {expected_type.__name__}, "
                            f"received {type(payload).__name__}."
                        ),
                    )
                )

        return tuple(issues)

    def catalog(self) -> dict[str, Any]:
        """Return a JSON-serializable catalog of discovered datasets."""

        with self._lock:
            records = [
                asdict(record)
                for name in sorted(self._records)
                for record in self._records[name]
            ]

            aliases = dict(self._aliases)
            issues = [asdict(issue) for issue in self._issues]

        duplicate_names = {
            name: [record.relative_path for record in entries]
            for name, entries in self._records.items()
            if len([record for record in entries if record.valid_json]) > 1
        }

        return {
            "schema_version": "1.0.0",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "repository_root": str(self.root),
            "configured_data_directories": list(self.data_directories),
            "dataset_count": len(records),
            "unique_dataset_names": len(self._records),
            "duplicate_dataset_names": duplicate_names,
            "aliases": aliases,
            "datasets": records,
            "issues": issues,
        }

    def export_catalog(self, output: str | Path) -> Path:
        """Write the dataset catalog without modifying source datasets."""

        destination = Path(output)

        if not destination.is_absolute():
            destination = self.root / destination

        destination = self._safe_path(destination)
        destination.parent.mkdir(parents=True, exist_ok=True)

        destination.write_text(
            json.dumps(
                self.catalog(),
                indent=2,
                ensure_ascii=False,
            ) + "\n",
            encoding="utf-8",
        )

        return destination


# ---------------------------------------------------------------------------
# Convenience API
# ---------------------------------------------------------------------------


_default_manager: DataSourceManager | None = None
_default_lock = threading.Lock()


def get_manager(
    root: str | Path | None = None,
    *,
    refresh: bool = False,
) -> DataSourceManager:
    """
    Return the default manager, creating it lazily.

    Pass root to create a separate manager for another repository.
    """

    global _default_manager

    if root is not None:
        manager = DataSourceManager(root)
        if refresh:
            manager.refresh()
        return manager

    if _default_manager is None:
        with _default_lock:
            if _default_manager is None:
                _default_manager = DataSourceManager(PROJECT_ROOT)

    if refresh:
        _default_manager.refresh()

    return _default_manager


def load_dataset(name: str, default: Any = None) -> Any:
    """Convenience function for loading one dataset from the default manager."""

    return get_manager().get(name, default)


# ---------------------------------------------------------------------------
# Command-line interface
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Discover and load MedOrbits JSON datasets."
    )

    parser.add_argument(
        "--root",
        type=Path,
        default=PROJECT_ROOT,
        help="Repository root directory.",
    )

    parser.add_argument(
        "--list",
        action="store_true",
        help="List discovered dataset names and their sources.",
    )

    parser.add_argument(
        "--validate",
        action="store_true",
        help="Validate discovered JSON datasets.",
    )

    parser.add_argument(
        "--catalog",
        action="store_true",
        help="Export the data catalog.",
    )

    parser.add_argument(
        "--output",
        type=Path,
        default=Path("reports/data-catalog.json"),
        help="Catalog output path relative to the repository root.",
    )

    parser.add_argument(
        "--include-hidden",
        action="store_true",
        help="Include hidden files and directories.",
    )

    parser.add_argument(
        "--flat",
        action="store_true",
        help="Scan only the top level of configured data directories.",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        manager = DataSourceManager(
            args.root,
            recursive=not args.flat,
            include_hidden=args.include_hidden,
        )

        if args.list:
            for name in manager.names():
                print(f"\n{name}")

                for record in manager.records(name):
                    status = "valid" if record.valid_json else "INVALID"
                    print(
                        f"  [{status}] {record.relative_path} "
                        f"({record.size_bytes} bytes)"
                    )

        if args.validate:
            issues = manager.validate()

            if not issues:
                print("All discovered JSON datasets passed syntax validation.")
            else:
                for issue in issues:
                    print(
                        f"[{issue.severity}] {issue.code}: "
                        f"{issue.path}: {issue.message}"
                    )

        if args.catalog or not (args.list or args.validate):
            output = manager.export_catalog(args.output)
            print(f"Data catalog written to: {output}")

        if not (args.list or args.validate or args.catalog):
            print(f"Datasets discovered: {len(manager.names())}")

        if args.validate:
            issues = manager.validate()
            if any(issue.severity == "ERROR" for issue in issues):
                return 1

        return 0

    except (OSError, DataSourceError, ValueError) as exc:
        print(f"Data source manager failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
