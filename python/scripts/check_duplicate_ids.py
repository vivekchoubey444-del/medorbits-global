#!/usr/bin/env python3
"""
MedOrbits Duplicate ID Checker
==============================
Purpose:
    Detect duplicate identifiers across JSON datasets.
Features:
    - Recursive JSON file discovery.
    - Configurable identifier field names.
    - Duplicate detection within individual files.
    - Optional duplicate detection across files.
    - JSON Pointer-style locations for findings.
    - Read-only validation; source files are never modified.
    - Optional machine-readable JSON report.
    - Python 3.12+ compatible.
    - Standard library only.
Usage:
    python python/scripts/check_duplicate_ids.py
    python python/scripts/check_duplicate_ids.py --root assets/data
    python python/scripts/check_duplicate_ids.py --fields id code slug
    python python/scripts/check_duplicate_ids.py --cross-file
    python python/scripts/check_duplicate_ids.py --report reports/duplicate-ids.json
    python python/scripts/check_duplicate_ids.py --strict
Exit codes:
    0: No duplicates found.
    1: Duplicate identifiers found.
    2: Invalid configuration or execution error.
"""
from __future__ import annotations
import argparse
import json
import sys
from collections import defaultdict
from dataclasses import asdict, dataclass
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
}
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
    files_scanned: int = 0
    files_with_errors: int = 0
    identifiers_found: int = 0
    duplicates_found: int = 0
    errors: list[dict[str, str]] | None = None
    duplicates: list[dict[str, Any]] | None = None
    def __post_init__(self) -> None:
        if self.errors is None:
            self.errors = []
        if self.duplicates is None:
            self.duplicates = []
def json_pointer(parts: tuple[str, ...]) -> str:
    """Build an RFC 6901-style JSON Pointer."""
    if not parts:
        return ""
    escaped = [
        part.replace("~", "~0").replace("/", "~1")
        for part in parts
    ]
    return "/" + "/".join(escaped)
def normalize_identifier(value: Any) -> str | None:
    """
    Normalize supported identifiers.
    Strings and integers are accepted. Booleans, floats, null,
    lists, and objects are excluded to avoid ambiguous identity rules.
    """
    if isinstance(value, bool):
        return None
    if isinstance(value, (str, int)):
        normalized = str(value).strip()
        return normalized if normalized else None
    return None
def walk_json(
    value: Any,
    fields: tuple[str, ...],
    path: tuple[str, ...] = (),
) -> Iterator[tuple[str, str, str]]:
    """
    Yield (field, identifier, JSON pointer) for matching fields.
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
            yield from walk_json(item, fields, path + (str(index),))
def discover_json_files(
    root: Path,
    excluded_dirs: set[str],
    report_path: Path | None = None,
) -> list[Path]:
    """Find JSON files while excluding common generated directories."""
    results: list[Path] = []
    for directory, dirnames, filenames in __import__("os").walk(root):
        dirnames[:] = sorted(
            name for name in dirnames
            if name not in excluded_dirs
        )
        for filename in sorted(filenames):
            if not filename.lower().endswith(".json"):
                continue
            path = Path(directory) / filename
            if report_path is not None and path.resolve() == report_path.resolve():
                continue
            results.append(path)
    return sorted(results)
def scan_file(
    path: Path,
    root: Path,
    fields: tuple[str, ...],
) -> tuple[list[IdentifierOccurrence], dict[str, str] | None]:
    """Parse a JSON file and collect its identifiers."""
    try:
        with path.open("r", encoding="utf-8-sig") as file:
            document = json.load(file)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        return [], {
            "file": path.relative_to(root).as_posix(),
            "error": f"{type(exc).__name__}: {exc}",
        }
    occurrences: list[IdentifierOccurrence] = []
    for field, value, location in walk_json(document, fields):
        occurrences.append(
            IdentifierOccurrence(
                file=path.relative_to(root).as_posix(),
                location=location or "/",
                field=field,
                value=value,
            )
        )
    return occurrences, None
def find_duplicates(
    occurrences: list[IdentifierOccurrence],
    cross_file: bool,
) -> list[DuplicateFinding]:
    """Group repeated identifiers by field and selected scope."""
    grouped: dict[
        tuple[str, str, str],
        list[IdentifierOccurrence],
    ] = defaultdict(list)
    for occurrence in occurrences:
        scope = "*" if cross_file else occurrence.file
        grouped[(scope, occurrence.field, occurrence.value)].append(
            occurrence
        )
    findings: list[DuplicateFinding] = []
    for (scope, field, value), items in sorted(grouped.items()):
        if len(items) < 2:
            continue
        findings.append(
            DuplicateFinding(
                scope=scope,
                field=field,
                value=value,
                occurrences=tuple(items),
            )
        )
    return findings
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Detect duplicate identifiers in MedOrbits JSON datasets."
        )
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path("assets/data"),
        help="Directory to scan (default: assets/data).",
    )
    parser.add_argument(
        "--fields",
        nargs="+",
        default=list(DEFAULT_FIELDS),
        help="Identifier field names (default: id).",
    )
    parser.add_argument(
        "--cross-file",
        action="store_true",
        help="Also detect repeated identifiers across different files.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return an error exit code if any JSON file cannot be read.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Optional path for a JSON report.",
    )
    parser.add_argument(
        "--exclude-dir",
        action="append",
        default=[],
        help="Additional directory name to exclude; repeat as needed.",
    )
    return parser
def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    root = args.root.expanduser().resolve()
    if not root.exists():
        print(f"ERROR: Scan directory does not exist: {root}", file=sys.stderr)
        return 2
    if not root.is_dir():
        print(f"ERROR: Scan path is not a directory: {root}", file=sys.stderr)
        return 2
    fields = tuple(dict.fromkeys(
        field.strip() for field in args.fields if field.strip()
    ))
    if not fields:
        print("ERROR: Provide at least one non-empty identifier field.", file=sys.stderr)
        return 2
    report_path = (
        args.report.expanduser().resolve()
        if args.report is not None
        else None
    )
    excluded_dirs = DEFAULT_EXCLUDED_DIRS | set(args.exclude_dir)
    try:
        files = discover_json_files(root, excluded_dirs, report_path)
    except OSError as exc:
        print(f"ERROR: Unable to discover JSON files: {exc}", file=sys.stderr)
        return 2
    report = CheckReport(
        root=str(root),
        fields=list(fields),
    )
    all_occurrences: list[IdentifierOccurrence] = []
    for path in files:
        occurrences, error = scan_file(path, root, fields)
        if error is not None:
            report.files_with_errors += 1
            report.errors.append(error)
            continue
        report.files_scanned += 1
        report.identifiers_found += len(occurrences)
        all_occurrences.extend(occurrences)
    # Always check duplicates within each file.
    findings = find_duplicates(all_occurrences, cross_file=False)
    # Optionally check duplicates across different files.
    if args.cross_file:
        cross_file_findings = find_duplicates(
            all_occurrences,
            cross_file=True,
        )
        file_sets = {
            (item.field, item.value): {
                occurrence.file for occurrence in item.occurrences
            }
            for item in cross_file_findings
        }
        for finding in cross_file_findings:
            if len(file_sets[(finding.field, finding.value)]) > 1:
                findings.append(finding)
    report.duplicates_found = len(findings)
    report.duplicates = [
        {
            "scope": finding.scope,
            "field": finding.field,
            "value": finding.value,
            "occurrences": [
                asdict(item) for item in finding.occurrences
            ],
        }
        for finding in findings
    ]
    print("MedOrbits Duplicate ID Checker")
    print("=" * 32)
    print(f"Root:               {root}")
    print(f"Identifier fields:  {', '.join(fields)}")
    print(f"JSON files scanned: {report.files_scanned}")
    print(f"Identifiers found:  {report.identifiers_found}")
    print(f"Duplicate groups:   {report.duplicates_found}")
    print(f"File errors:        {report.files_with_errors}")
    print()
    for finding in findings:
        scope_label = (
            "across files" if finding.scope == "*" else finding.scope
        )
        print(
            f"DUPLICATE [{finding.field}={finding.value!r}] "
            f"({scope_label})"
        )
        for occurrence in finding.occurrences:
            print(
                f"  - {occurrence.file}"
                f" :: {occurrence.location}"
            )
        print()
    for error in report.errors:
        print(
            f"FILE ERROR: {error['file']}: {error['error']}",
            file=sys.stderr,
        )
    if report_path is not None:
        try:
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(
                json.dumps(asdict(report), indent=2, ensure_ascii=False)
                + "\n",
                encoding="utf-8",
            )
            print(f"Report saved: {report_path}")
        except OSError as exc:
            print(f"ERROR: Could not write report: {exc}", file=sys.stderr)
            return 2
    if report.duplicates_found:
        return 1
    if args.strict and report.files_with_errors:
        return 2
    print("PASS: No duplicate identifiers found.")
    return 0
if __name__ == "__main__":
    raise SystemExit(main())