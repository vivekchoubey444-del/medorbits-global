
#!/usr/bin/env python3
"""
MedOrbits Duplicate ID Checker
==============================

Purpose:
    Detect duplicate identifiers across JSON datasets.

Features:
    - Recursive, deterministic JSON file discovery.
    - Configurable identifier field names.
    - Duplicate detection within individual files.
    - Optional cross-file duplicate detection.
    - RFC 6901-style JSON Pointer locations.
    - Strict JSON parsing with duplicate-key detection.
    - UTF-8 and UTF-8 BOM support.
    - Symlink avoidance during discovery.
    - File-size and JSON nesting-depth limits.
    - Read-only source validation.
    - Optional machine-readable JSON report.
    - Atomic report creation.
    - Python 3.12+ compatible.
    - Standard library only.

Usage:
    python python/scripts/check_duplicate_ids.py
    python python/scripts/check_duplicate_ids.py --root assets/data
    python python/scripts/check_duplicate_ids.py --fields id code slug
    python python/scripts/check_duplicate_ids.py --cross-file
    python python/scripts/check_duplicate_ids.py --strict
    python python/scripts/check_duplicate_ids.py --report reports/duplicate-ids.json
    python python/scripts/check_duplicate_ids.py --report reports/duplicate-ids.json --overwrite
    python python/scripts/check_duplicate_ids.py --max-file-bytes 10485760
    python python/scripts/check_duplicate_ids.py --max-depth 200

Exit codes:
    0: No duplicates found; no strict-mode file errors.
    1: Duplicate identifiers found.
    2: Invalid configuration or execution error, including strict-mode
       file errors.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile

from collections import defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterator


DEFAULT_FIELDS = ("id",)

DEFAULT_EXCLUDED_DIRS = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    ".next",
    ".cache",
    "coverage",
}

DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024
DEFAULT_MAX_DEPTH = 200
REPORT_SCHEMA_VERSION = "1.0"


@dataclass(frozen=True)
class IdentifierOccurrence:
    """A single occurrence of an identifier in a JSON document."""

    file: str
    location: str
    field: str
    value: str


@dataclass(frozen=True)
class DuplicateFinding:
    """A duplicate identifier detected by the checker."""

    scope: str
    field: str
    value: str
    occurrences: tuple[IdentifierOccurrence, ...]


@dataclass
class CheckReport:
    """Machine-readable results of a duplicate ID scan."""

    root: str
    fields: list[str]
    cross_file_enabled: bool
    files_discovered: int = 0
    files_scanned: int = 0
    files_with_errors: int = 0
    identifiers_found: int = 0
    duplicates_found: int = 0
    errors: list[dict[str, str]] = field(default_factory=list)
    duplicates: list[dict[str, Any]] = field(default_factory=list)
    schema_version: str = REPORT_SCHEMA_VERSION


class DuplicateJSONKeyError(ValueError):
    """Raised when a JSON object contains a duplicate key."""


class JSONDepthError(ValueError):
    """Raised when a JSON document exceeds the configured depth."""


class JSONFileTooLargeError(ValueError):
    """Raised when a JSON file exceeds the configured size limit."""


def json_pointer(parts: tuple[str, ...]) -> str:
    """
    Build an RFC 6901-style JSON Pointer.

    The root document is represented by the empty string.
    """

    if not parts:
        return ""

    escaped = [
        part.replace("~", "~0").replace("/", "~1")
        for part in parts
    ]

    return "/" + "/".join(escaped)


def normalize_identifier(value: Any) -> str | None:
    """
    Normalize supported identifier values.

    Strings and integers are accepted. Booleans, floats, null, lists,
    and objects are excluded to avoid ambiguous identifier semantics.

    String "001" and integer 1 remain distinct identifiers.
    """

    if isinstance(value, bool):
        return None

    if isinstance(value, (str, int)):
        normalized = str(value).strip()
        return normalized if normalized else None

    return None


def reject_duplicate_object_keys(
    pairs: list[tuple[str, Any]],
) -> dict[str, Any]:
    """Build a JSON object while rejecting repeated keys."""

    result: dict[str, Any] = {}

    for key, value in pairs:
        if key in result:
            raise DuplicateJSONKeyError(
                f"Duplicate JSON object key: {key!r}"
            )
        result[key] = value

    return result


def reject_nonstandard_constant(value: str) -> None:
    """Reject non-standard JSON constants such as NaN and Infinity."""

    raise ValueError(f"Non-standard JSON constant: {value}")


def measure_json_depth(document: Any, max_depth: int) -> None:
    """
    Check document nesting iteratively.

    The root value has depth zero. Each nested object or array increases
    the depth by one.
    """

    stack: list[tuple[Any, int]] = [(document, 0)]

    while stack:
        value, depth = stack.pop()

        if depth > max_depth:
            raise JSONDepthError(
                f"JSON nesting depth exceeds the limit of {max_depth}"
            )

        if isinstance(value, dict):
            for child in value.values():
                stack.append((child, depth + 1))

        elif isinstance(value, list):
            for child in value:
                stack.append((child, depth + 1))


def walk_json(
    value: Any,
    fields: tuple[str, ...],
    path: tuple[str, ...] = (),
) -> Iterator[tuple[str, str, str]]:
    """
    Yield (field, normalized_identifier, JSON pointer).

    Nested objects and arrays are traversed recursively.
    """

    if isinstance(value, dict):
        for key, item in value.items():
            current_path = path + (str(key),)

            if key in fields:
                identifier = normalize_identifier(item)

                if identifier is not None:
                    yield key, identifier, json_pointer(current_path)

            yield from walk_json(item, fields, current_path)

    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from walk_json(
                item,
                fields,
                path + (str(index),),
            )


def path_has_symlink_component(path: Path) -> bool:
    """
    Return True if any existing component of the path is a symlink.

    This check is intended to prevent accidental traversal through
    symlinked scan roots or file paths.
    """

    absolute = Path(os.path.abspath(path))
    current = Path(absolute.anchor)

    for component in absolute.parts[1:]:
        current = current / component

        try:
            if current.is_symlink():
                return True
        except OSError:
            return True

    return False


def validate_scan_root(root: Path) -> Path:
    """Validate and return the resolved scan directory."""

    expanded = root.expanduser()

    if path_has_symlink_component(expanded):
        raise ValueError(
            f"Scan path contains a symbolic link: {expanded}"
        )

    try:
        resolved = expanded.resolve(strict=True)
    except OSError as exc:
        raise ValueError(
            f"Unable to resolve scan path {expanded}: {exc}"
        ) from exc

    if not resolved.exists():
        raise ValueError(
            f"Scan directory does not exist: {resolved}"
        )

    if not resolved.is_dir():
        raise ValueError(
            f"Scan path is not a directory: {resolved}"
        )

    return resolved


def discover_json_files(
    root: Path,
    excluded_dirs: set[str],
    report_path: Path | None = None,
) -> list[Path]:
    """
    Discover JSON files deterministically.

    Symlinked directories and files are not followed. Traversal errors
    are surfaced rather than silently ignored.
    """

    results: list[Path] = []
    report_resolved = report_path.resolve() if report_path else None
    traversal_errors: list[str] = []

    def on_walk_error(exc: OSError) -> None:
        traversal_errors.append(str(exc))

    for directory, dirnames, filenames in os.walk(
        root,
        topdown=True,
        followlinks=False,
        onerror=on_walk_error,
    ):
        current_dir = Path(directory)

        filtered_dirs: list[str] = []

        for name in sorted(dirnames):
            candidate = current_dir / name

            if name in excluded_dirs:
                continue

            if candidate.is_symlink():
                continue

            filtered_dirs.append(name)

        dirnames[:] = filtered_dirs

        for filename in sorted(filenames):
            if not filename.lower().endswith(".json"):
                continue

            candidate = current_dir / filename

            if candidate.is_symlink():
                continue

            try:
                resolved_candidate = candidate.resolve(strict=True)
            except OSError as exc:
                traversal_errors.append(
                    f"{candidate}: unable to resolve file: {exc}"
                )
                continue

            if report_resolved is not None:
                if resolved_candidate == report_resolved:
                    continue

            results.append(candidate)

    if traversal_errors:
        details = "\n".join(
            f"  - {error}" for error in traversal_errors
        )
        raise OSError(
            "One or more errors occurred during JSON discovery:\n"
            f"{details}"
        )

    return sorted(results, key=lambda item: item.as_posix())


def load_json_document(
    path: Path,
    max_file_bytes: int,
    max_depth: int,
) -> Any:
    """Load and validate one JSON document."""

    try:
        with path.open("rb") as file:
            raw = file.read(max_file_bytes + 1)

    except OSError:
        raise

    if len(raw) > max_file_bytes:
        raise JSONFileTooLargeError(
            f"File exceeds maximum size of {max_file_bytes} bytes"
        )

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError(
            f"Invalid UTF-8 encoding: {exc}"
        ) from exc

    try:
        document = json.loads(
            text,
            object_pairs_hook=reject_duplicate_object_keys,
            parse_constant=reject_nonstandard_constant,
        )
    except (
        json.JSONDecodeError,
        DuplicateJSONKeyError,
        RecursionError,
        ValueError,
    ) as exc:
        raise ValueError(
            f"Invalid JSON: {exc}"
        ) from exc

    measure_json_depth(document, max_depth)

    return document


def scan_file(
    path: Path,
    root: Path,
    fields: tuple[str, ...],
    max_file_bytes: int,
    max_depth: int,
) -> tuple[list[IdentifierOccurrence], dict[str, str] | None]:
    """Parse a JSON file and collect its identifiers."""

    relative_name = path.relative_to(root).as_posix()

    try:
        document = load_json_document(
            path,
            max_file_bytes=max_file_bytes,
            max_depth=max_depth,
        )

        occurrences = [
            IdentifierOccurrence(
                file=relative_name,
                location=location,
                field=field_name,
                value=identifier,
            )
            for field_name, identifier, location in walk_json(
                document,
                fields,
            )
        ]

        return occurrences, None

    except (
        OSError,
        UnicodeError,
        ValueError,
        RecursionError,
    ) as exc:
        return [], {
            "file": relative_name,
            "error": f"{type(exc).__name__}: {exc}",
        }


def find_duplicates(
    occurrences: list[IdentifierOccurrence],
    cross_file: bool,
) -> list[DuplicateFinding]:
    """
    Group repeated identifiers by field, value, and selected scope.

    Within-file scope is the relative filename. Cross-file scope is "*".
    Cross-file findings are retained only when the identifier occurs
    in at least two distinct files.
    """

    grouped: dict[
        tuple[str, str, str],
        list[IdentifierOccurrence],
    ] = defaultdict(list)

    for occurrence in occurrences:
        scope = "*" if cross_file else occurrence.file

        grouped[
            (scope, occurrence.field, occurrence.value)
        ].append(occurrence)

    findings: list[DuplicateFinding] = []

    for (scope, field_name, value), items in sorted(
        grouped.items(),
        key=lambda item: item[0],
    ):
        if len(items) < 2:
            continue

        if cross_file:
            distinct_files = {item.file for item in items}

            if len(distinct_files) < 2:
                continue

        findings.append(
            DuplicateFinding(
                scope=scope,
                field=field_name,
                value=value,
                occurrences=tuple(
                    sorted(
                        items,
                        key=lambda item: (
                            item.file,
                            item.location,
                        ),
                    )
                ),
            )
        )

    return findings


def validate_fields(raw_fields: list[str]) -> tuple[str, ...]:
    """Validate, normalize, and deduplicate identifier field names."""

    fields: list[str] = []

    for raw_field in raw_fields:
        field_name = raw_field.strip()

        if not field_name:
            continue

        if "\x00" in field_name:
            raise ValueError(
                "Identifier field names cannot contain NUL characters."
            )

        if field_name not in fields:
            fields.append(field_name)

    if not fields:
        raise ValueError(
            "Provide at least one non-empty identifier field."
        )

    return tuple(fields)


def resolve_report_path(path: Path) -> Path:
    """Validate the report destination without following symlinks."""

    expanded = path.expanduser()
    absolute = Path(os.path.abspath(expanded))

    if path_has_symlink_component(absolute):
        raise ValueError(
            f"Report path contains a symbolic link: {absolute}"
        )

    parent = absolute.parent

    if not parent.exists():
        return absolute

    if not parent.is_dir():
        raise ValueError(
            f"Report parent is not a directory: {parent}"
        )

    return absolute


def write_report(
    report: CheckReport,
    output_path: Path,
    overwrite: bool,
) -> None:
    """
    Write a JSON report atomically.

    By default, an existing destination is never replaced. Temporary
    files are created in the destination directory to keep the final
    replacement on the same filesystem.
    """

    output = resolve_report_path(output_path)
    parent = output.parent

    parent.mkdir(parents=True, exist_ok=True)

    if output.is_symlink():
        raise OSError(
            f"Refusing to write through a symbolic link: {output}"
        )

    payload = (
        json.dumps(
            asdict(report),
            indent=2,
            ensure_ascii=False,
            sort_keys=True,
        )
        + "\n"
    )

    temporary_path: Path | None = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="\n",
            dir=parent,
            prefix=f".{output.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            temporary_file.write(payload)
            temporary_file.flush()
            os.fsync(temporary_file.fileno())

        if overwrite:
            if output.is_symlink():
                raise OSError(
                    f"Refusing to replace a symbolic link: {output}"
                )

            os.replace(temporary_path, output)
            temporary_path = None

        else:
            # Atomic create-if-absent. Unlike write_text(), this will
            # not overwrite a report created concurrently by another
            # process.
            try:
                os.link(temporary_path, output)
            except FileExistsError as exc:
                raise FileExistsError(
                    f"Report already exists: {output}. "
                    "Use --overwrite to replace it."
                ) from exc

            temporary_path.unlink()
            temporary_path = None

    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink(missing_ok=True)
            except OSError:
                pass


def build_parser() -> argparse.ArgumentParser:
    """Build the command-line interface."""

    parser = argparse.ArgumentParser(
        description=(
            "Detect duplicate identifiers in MedOrbits JSON datasets."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        "--root",
        type=Path,
        default=Path("assets/data"),
        help="Directory to scan.",
    )

    parser.add_argument(
        "--fields",
        nargs="+",
        default=list(DEFAULT_FIELDS),
        metavar="FIELD",
        help="Identifier field names to inspect.",
    )

    parser.add_argument(
        "--cross-file",
        action="store_true",
        help=(
            "Detect identifiers repeated across distinct files, "
            "in addition to duplicates within individual files."
        ),
    )

    parser.add_argument(
        "--strict",
        action="store_true",
        help=(
            "Return exit code 2 if any JSON file cannot be read "
            "or validated."
        ),
    )

    parser.add_argument(
        "--report",
        type=Path,
        help="Optional path for a machine-readable JSON report.",
    )

    parser.add_argument(
        "--overwrite",
        action="store_true",
        help=(
            "Allow replacing an existing report. Requires --report."
        ),
    )

    parser.add_argument(
        "--exclude-dir",
        action="append",
        default=[],
        metavar="NAME",
        help=(
            "Additional directory name to exclude. "
            "May be specified more than once."
        ),
    )

    parser.add_argument(
        "--max-file-bytes",
        type=int,
        default=DEFAULT_MAX_FILE_BYTES,
        metavar="BYTES",
        help="Maximum size of each JSON file in bytes.",
    )

    parser.add_argument(
        "--max-depth",
        type=int,
        default=DEFAULT_MAX_DEPTH,
        metavar="DEPTH",
        help="Maximum permitted JSON nesting depth.",
    )

    return parser


def print_findings(findings: list[DuplicateFinding]) -> None:
    """Print duplicate findings in a readable format."""

    for finding in findings:
        scope_label = (
            "across distinct files"
            if finding.scope == "*"
            else finding.scope
        )

        print(
            f"DUPLICATE [{finding.field}={finding.value!r}] "
            f"({scope_label})"
        )

        for occurrence in finding.occurrences:
            print(
                f"  - {occurrence.file}"
                f" :: {occurrence.location or '<root>'}"
            )

        print()


def print_summary(report: CheckReport) -> None:
    """Print scan totals."""

    print("MedOrbits Duplicate ID Checker")
    print("=" * 32)
    print(f"Root:                {report.root}")
    print(f"Identifier fields:   {', '.join(report.fields)}")
    print(f"Cross-file checking: {'yes' if report.cross_file_enabled else 'no'}")
    print(f"JSON files found:    {report.files_discovered}")
    print(f"JSON files scanned:  {report.files_scanned}")
    print(f"Identifiers found:   {report.identifiers_found}")
    print(f"Duplicate groups:    {report.duplicates_found}")
    print(f"File errors:         {report.files_with_errors}")
    print()


def main(argv: list[str] | None = None) -> int:
    """Run the duplicate ID checker."""

    parser = build_parser()
    args = parser.parse_args(argv)

    if args.overwrite and args.report is None:
        parser.error("--overwrite requires --report")

    if args.max_file_bytes < 1:
        parser.error("--max-file-bytes must be greater than zero")

    if args.max_depth < 0:
        parser.error("--max-depth cannot be negative")

    excluded_names = set(DEFAULT_EXCLUDED_DIRS)

    for name in args.exclude_dir:
        normalized = name.strip()

        if not normalized:
            parser.error("--exclude-dir cannot be empty")

        if normalized in {".", ".."} or "/" in normalized or "\\" in normalized:
            parser.error(
                "--exclude-dir must be a directory name, not a path"
            )

        excluded_names.add(normalized)

    try:
        fields = validate_fields(args.fields)
        root = validate_scan_root(args.root)

        report_path = (
            resolve_report_path(args.report)
            if args.report is not None
            else None
        )

        if report_path is not None and not args.overwrite:
            if report_path.exists():
                raise ValueError(
                    f"Report already exists: {report_path}. "
                    "Use --overwrite to replace it."
                )

        if report_path is not None:
            try:
                if report_path.is_relative_to(root):
                    # The output is excluded from scanning even if it
                    # is created after discovery begins.
                    pass
            except (OSError, ValueError):
                pass

        files = discover_json_files(
            root=root,
            excluded_dirs=excluded_names,
            report_path=report_path,
        )

    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    report = CheckReport(
        root=str(root),
        fields=list(fields),
        cross_file_enabled=args.cross_file,
        files_discovered=len(files),
    )

    all_occurrences: list[IdentifierOccurrence] = []

    for path in files:
        occurrences, error = scan_file(
            path=path,
            root=root,
            fields=fields,
            max_file_bytes=args.max_file_bytes,
            max_depth=args.max_depth,
        )

        if error is not None:
            report.files_with_errors += 1
            report.errors.append(error)
            continue

        report.files_scanned += 1
        report.identifiers_found += len(occurrences)
        all_occurrences.extend(occurrences)

    findings = find_duplicates(
        occurrences=all_occurrences,
        cross_file=False,
    )

    if args.cross_file:
        findings.extend(
            find_duplicates(
                occurrences=all_occurrences,
                cross_file=True,
            )
        )

    findings.sort(
        key=lambda finding: (
            finding.scope,
            finding.field,
            finding.value,
        )
    )

    report.duplicates_found = len(findings)
    report.duplicates = [
        {
            "scope": finding.scope,
            "field": finding.field,
            "value": finding.value,
            "occurrences": [
                asdict(occurrence)
                for occurrence in finding.occurrences
            ],
        }
        for finding in findings
    ]

    # Write the report before printing the final status. A report
    # failure must result in a clear execution error.
    if report_path is not None:
        try:
            write_report(
                report=report,
                output_path=report_path,
                overwrite=args.overwrite,
            )
        except (OSError, ValueError) as exc:
            print(
                f"ERROR: Could not write report: {exc}",
                file=sys.stderr,
            )
            return 2

    print_summary(report)
    print_findings(findings)

    for error in report.errors:
        print(
            f"FILE ERROR: {error['file']}: {error['error']}",
            file=sys.stderr,
        )

    if report_path is not None:
        print(f"Report saved: {report_path}")

    if findings:
        print(
            f"FAIL: Found {len(findings)} duplicate identifier group(s)."
        )
        return 1

    if args.strict and report.files_with_errors:
        print(
            "ERROR: Strict mode failed because one or more files "
            "could not be validated.",
            file=sys.stderr,
        )
        return 2

    if report.files_with_errors:
        print(
            "WARNING: No duplicates were found in readable files, "
            "but some files could not be validated."
        )
        return 0

    print("PASS: No duplicate identifiers found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
