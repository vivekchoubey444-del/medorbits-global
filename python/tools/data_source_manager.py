
#!/usr/bin/env python3
"""
MedOrbits Central Data Source Manager
=====================================

File:
    python/tools/data_source_manager.py

Purpose:
    Discover, load, validate, catalog, and expose JSON datasets.

Compatibility:
    Python 3.10+

Security:
    - Standard library only.
    - Read-only access to source datasets.
    - Rejects paths outside the repository root.
    - Prevents catalog exports from overwriting discovered datasets.
    - Does not access networks, credentials, or external services.
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

DEFAULT_IGNORED_DIRECTORIES = frozenset({
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
})

DATASET_NAME_PATTERN = re.compile(
    r"^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,199}$"
)

APP_NAME = "MedOrbits Data Source Manager"
APP_VERSION = "1.1.0"

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent


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
    """A discovery, validation, or loading issue."""

    severity: str
    code: str
    path: str
    message: str


class DataSourceManager:
    """Centralized, read-only JSON data access for MedOrbits."""

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
            raise DataSourceError("Repository root is not a directory.")

        if data_directories is None:
            configured = list(DEFAULT_DATA_DIRECTORIES)
            configured.extend(
                item.strip()
                for item in os.environ.get(
                    "MEDORBITS_DATA_DIRS", ""
                ).split(os.pathsep)
                if item.strip()
            )
            self.data_directories = tuple(dict.fromkeys(configured))
        else:
            self.data_directories = tuple(data_directories)

        self.recursive = recursive
        self.ignore_directories = set(
            DEFAULT_IGNORED_DIRECTORIES
            if ignore_directories is None
            else ignore_directories
        )
        self.include_hidden = include_hidden

        self._lock = threading.RLock()
        self._records: dict[str, list[DatasetRecord]] = {}
        self._cache: dict[str, tuple[str, Any]] = {}
        self._aliases: dict[str, str] = {}
        self._issues: list[DatasetIssue] = []

        self.refresh()

    def _safe_path(self, path: Path) -> Path:
        """Resolve a path and ensure it remains inside the repository."""
        resolved = path.resolve()

        try:
            resolved.relative_to(self.root)
        except ValueError as exc:
            raise DataSourceError(
                "Requested path is outside the repository root."
            ) from exc

        return resolved

    @staticmethod
    def _validate_name(name: str) -> str:
        if not isinstance(name, str):
            raise InvalidDatasetNameError(
                "Dataset name must be a string."
            )

        normalized = name.strip().replace("\\", "/")

        if (
            not normalized
            or normalized.startswith("/")
            or any(
                part in {"", ".", ".."}
                for part in normalized.split("/")
            )
            or not all(
                DATASET_NAME_PATTERN.fullmatch(part)
                for part in normalized.split("/")
            )
        ):
            raise InvalidDatasetNameError(
                f"Invalid dataset name: {name!r}"
            )

        return normalized

    def _configured_roots(
        self,
        issues: list[DatasetIssue],
    ) -> list[Path]:
        roots: list[Path] = []

        for directory in self.data_directories:
            candidate = Path(directory).expanduser()

            if not candidate.is_absolute():
                candidate = self.root / candidate

            candidate = candidate.resolve()

            try:
                candidate.relative_to(self.root)
            except ValueError:
                issues.append(DatasetIssue(
                    "WARNING",
                    "DATA_DIRECTORY_OUTSIDE_ROOT",
                    candidate.name,
                    "Configured directory is outside the repository.",
                ))
                continue

            if candidate.is_dir() and candidate not in roots:
                roots.append(candidate)

        return roots

    def refresh(self) -> None:
        """Rediscover datasets and atomically replace the current catalog."""
        records: dict[str, list[DatasetRecord]] = defaultdict(list)
        issues: list[DatasetIssue] = []
        roots = self._configured_roots(issues)

        for directory in roots:
            candidates = (
                directory.rglob("*.json")
                if self.recursive
                else directory.glob("*.json")
            )

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
                except (OSError, DataSourceError):
                    issues.append(DatasetIssue(
                        "ERROR",
                        "DATASET_READ_FAILED",
                        path.name,
                        "Dataset could not be read safely.",
                    ))
                    continue

                relative_path = safe_path.relative_to(
                    self.root
                ).as_posix()
                name = safe_path.relative_to(
                    directory
                ).with_suffix("").as_posix()

                try:
                    payload = json.loads(raw.decode("utf-8-sig"))
                    top_type = type(payload).__name__
                    keys = (
                        tuple(sorted(str(key) for key in payload))
                        if isinstance(payload, dict)
                        else ()
                    )
                    valid = True
                    error = None

                except (UnicodeDecodeError, json.JSONDecodeError):
                    top_type = None
                    keys = ()
                    valid = False
                    error = "Invalid JSON or UTF-8 encoding."
                    issues.append(DatasetIssue(
                        "ERROR",
                        "INVALID_JSON",
                        relative_path,
                        error,
                    ))

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
                    top_level_type=top_type,
                    top_level_keys=keys,
                    valid_json=valid,
                    error=error,
                )
                records[name].append(record)

        finalized = {
            name: sorted(
                entries,
                key=lambda entry: entry.relative_path,
            )
            for name, entries in records.items()
        }

        with self._lock:
            self._records = finalized
            self._issues = issues
            self._cache.clear()

    def register_alias(self, alias: str, dataset_name: str) -> None:
        """Register an explicit alias without overriding an existing name."""
        alias = self._validate_name(alias)
        dataset_name = self._validate_name(dataset_name)

        with self._lock:
            if alias in self._records or alias in self._aliases:
                raise DuplicateDatasetError(
                    f"Alias already conflicts with an existing name: {alias}"
                )

            if dataset_name not in self._records:
                raise DatasetNotFoundError(
                    f"Alias target does not exist: {dataset_name}"
                )

            self._aliases[alias] = dataset_name

    def _resolve_alias(self, name: str) -> str:
        seen: set[str] = set()

        while name in self._aliases:
            if name in seen:
                raise DataSourceError("Alias cycle detected.")
            seen.add(name)
            name = self._aliases[name]

        return name

    def names(self, *, include_invalid: bool = True) -> tuple[str, ...]:
        """Return sorted dataset identifiers."""
        with self._lock:
            if include_invalid:
                return tuple(sorted(self._records))

            return tuple(sorted(
                name
                for name, entries in self._records.items()
                if any(record.valid_json for record in entries)
            ))

    def records(
        self,
        name: str | None = None,
    ) -> tuple[DatasetRecord, ...]:
        """Return dataset metadata."""
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

    def _select_record(
        self,
        name: str,
        source: str | Path | None = None,
    ) -> DatasetRecord:
        normalized = self._validate_name(name)

        with self._lock:
            normalized = self._resolve_alias(normalized)
            entries = list(self._records.get(normalized, []))

        if source is not None:
            source_path = Path(source).expanduser()
            if not source_path.is_absolute():
                source_path = self.root / source_path

            resolved_source = self._safe_path(source_path)
            matches = [
                record for record in entries
                if Path(record.absolute_path) == resolved_source
            ]

            if not matches:
                raise DatasetNotFoundError(
                    f"No matching dataset source for {normalized}."
                )

            record = matches[0]
            if not record.valid_json:
                raise DatasetLoadError(
                    f"Invalid JSON: {record.relative_path}"
                )
            return record

        valid = [record for record in entries if record.valid_json]

        if not valid:
            if entries:
                raise DatasetLoadError(
                    f"No valid JSON source exists for {normalized}."
                )
            raise DatasetNotFoundError(
                f"Dataset not found: {normalized}"
            )

        if len(valid) != 1:
            locations = ", ".join(
                record.relative_path for record in valid
            )
            raise DuplicateDatasetError(
                f"Ambiguous dataset {normalized!r}: {locations}. "
                "Specify source= to select one."
            )

        return valid[0]

    def load(
        self,
        name: str,
        *,
        source: str | Path | None = None,
        use_cache: bool = True,
    ) -> Any:
        """Load a JSON dataset. Callers should treat returned values as read-only."""
        record = self._select_record(name, source)
        cache_key = record.relative_path

        with self._lock:
            cached = self._cache.get(cache_key)
            if use_cache and cached and cached[0] == record.sha256:
                return cached[1]

        try:
            raw = Path(record.absolute_path).read_bytes()
            payload = json.loads(raw.decode("utf-8-sig"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise DatasetLoadError(
                f"Unable to load {record.relative_path}."
            ) from exc

        digest = hashlib.sha256(raw).hexdigest()

        with self._lock:
            if use_cache:
                self._cache[cache_key] = (digest, payload)

        return payload

    def get(
        self,
        name: str,
        default: Any = None,
        *,
        source: str | Path | None = None,
    ) -> Any:
        """Return a dataset or default when it is missing or ambiguous."""
        try:
            return self.load(name, source=source)
        except (DatasetNotFoundError, DuplicateDatasetError):
            return default

    def require(self, names: Iterable[str]) -> Mapping[str, Any]:
        """Load all required datasets or report failures."""
        loaded: dict[str, Any] = {}
        failures: list[str] = []

        for name in names:
            try:
                loaded[name] = self.load(name)
            except DataSourceError as exc:
                failures.append(f"{name}: {exc}")

        if failures:
            raise DatasetLoadError(
                "Required datasets could not be loaded:\n- "
                + "\n- ".join(failures)
            )

        return MappingProxyType(loaded)

    def load_all(
        self,
        *,
        include_invalid: bool = False,
    ) -> Mapping[str, Any]:
        """Load only unambiguous datasets."""
        with self._lock:
            names = tuple(sorted(self._records))

        loaded: dict[str, Any] = {}

        for name in names:
            entries = self.records(name)
            valid = [entry for entry in entries if entry.valid_json]

            if len(valid) != 1:
                continue

            if not include_invalid and not valid[0].valid_json:
                continue

            try:
                loaded[name] = self.load(name)
            except DataSourceError:
                continue

        return MappingProxyType(loaded)

    def validate(
        self,
        *,
        required_datasets: Iterable[str] = (),
        expected_types: Mapping[str, type] | None = None,
    ) -> tuple[DatasetIssue, ...]:
        """Validate JSON syntax, duplicate names, required names, and types."""
        with self._lock:
            issues = list(self._issues)
            snapshot = {
                name: tuple(entries)
                for name, entries in self._records.items()
            }

        for name, entries in snapshot.items():
            valid = [entry for entry in entries if entry.valid_json]
            if len(valid) > 1:
                issues.append(DatasetIssue(
                    "ERROR",
                    "DUPLICATE_DATASET_NAME",
                    name,
                    "Multiple valid JSON files resolve to the same dataset name.",
                ))

        for name in required_datasets:
            try:
                self._select_record(name)
            except DataSourceError as exc:
                issues.append(DatasetIssue(
                    "ERROR",
                    "REQUIRED_DATASET_UNAVAILABLE",
                    name,
                    str(exc),
                ))

        for name, expected_type in (expected_types or {}).items():
            try:
                payload = self.load(name)
            except DataSourceError as exc:
                issues.append(DatasetIssue(
                    "ERROR",
                    "EXPECTED_TYPE_UNAVAILABLE",
                    name,
                    str(exc),
                ))
                continue

            if not isinstance(payload, expected_type):
                issues.append(DatasetIssue(
                    "ERROR",
                    "DATASET_TYPE_MISMATCH",
                    name,
                    f"Expected {expected_type.__name__}; "
                    f"received {type(payload).__name__}.",
                ))

        return tuple(issues)

    def catalog(self) -> dict[str, Any]:
        """Return a JSON-serializable snapshot of the catalog."""
        with self._lock:
            records = [
                asdict(record)
                for name in sorted(self._records)
                for record in self._records[name]
            ]
            aliases = dict(self._aliases)
            issues = [asdict(issue) for issue in self._issues]
            snapshot = dict(self._records)

        duplicates = {
            name: [
                record.relative_path
                for record in entries if record.valid_json
            ]
            for name, entries in snapshot.items()
            if sum(record.valid_json for record in entries) > 1
        }

        return {
            "schema_version": "1.0.0",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "repository_root": str(self.root),
            "configured_data_directories": list(self.data_directories),
            "dataset_count": len(records),
            "unique_dataset_names": len(snapshot),
            "duplicate_dataset_names": duplicates,
            "aliases": aliases,
            "datasets": records,
            "issues": issues,
        }

    def export_catalog(self, output: str | Path) -> Path:
        """Write a catalog without overwriting discovered source datasets."""
        destination = Path(output).expanduser()

        if not destination.is_absolute():
            destination = self.root / destination

        destination = self._safe_path(destination)

        if destination.suffix.lower() != ".json":
            raise DataSourceError("Catalog output must have a .json extension.")

        with self._lock:
            source_paths = {
                Path(record.absolute_path).resolve()
                for entries in self._records.values()
                for record in entries
            }

        if destination in source_paths:
            raise DataSourceError(
                "Catalog output cannot overwrite a discovered source dataset."
            )

        destination.parent.mkdir(parents=True, exist_ok=True)
        content = json.dumps(
            self.catalog(),
            indent=2,
            ensure_ascii=False,
        ) + "\n"

        destination.write_text(content, encoding="utf-8")
        return destination


_default_manager: DataSourceManager | None = None
_default_lock = threading.Lock()


def get_manager(
    root: str | Path | None = None,
    *,
    refresh: bool = False,
) -> DataSourceManager:
    """Return the default manager or a manager for an explicit root."""
    global _default_manager

    if root is not None:
        manager = DataSourceManager(root)
        if refresh:
            manager.refresh()
        return manager

    with _default_lock:
        if _default_manager is None:
            _default_manager = DataSourceManager(PROJECT_ROOT)
        manager = _default_manager

    if refresh:
        manager.refresh()

    return manager


def load_dataset(name: str, default: Any = None) -> Any:
    """Load a dataset from the default manager."""
    return get_manager().get(name, default)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=APP_NAME + " -- central JSON data source manager."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=PROJECT_ROOT,
        help="Repository root directory.",
    )
    parser.add_argument("--list", action="store_true", help="List datasets.")
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
        help="Catalog output path.",
    )
    parser.add_argument(
        "--include-hidden",
        action="store_true",
        help="Include hidden paths.",
    )
    parser.add_argument(
        "--flat",
        action="store_true",
        help="Scan only the top level of each data directory.",
    )
    return parser.parse_args()


def main(argv: list[str] | None = None) -> int:
    args = parse_args() if argv is None else argparse.ArgumentParser().parse_args(argv)

    try:
        manager = DataSourceManager(
            args.root,
            recursive=not args.flat,
            include_hidden=args.include_hidden,
        )

        if args.list:
            for name in manager.names():
                print(name)
                for record in manager.records(name):
                    status = "valid" if record.valid_json else "INVALID"
                    print(f"  [{status}] {record.relative_path}")

        if args.validate:
            issues = manager.validate()

            if not issues:
                print("All discovered JSON datasets passed validation.")
            else:
                for issue in issues:
                    print(
                        f"[{issue.severity}] {issue.code}: "
                        f"{issue.path}: {issue.message}"
                    )

                if any(issue.severity == "ERROR" for issue in issues):
                    return 1

        if args.catalog or not (args.list or args.validate):
            output = manager.export_catalog(args.output)
            print(f"Data catalog written to: {output}")

        return 0

    except (OSError, DataSourceError, ValueError) as exc:
        print(f"Data source manager failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
