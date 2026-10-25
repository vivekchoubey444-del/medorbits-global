#!/usr/bin/env python3
"""
MedOrbits JSON Validator
========================
Purpose:
    Validate JSON files and MedOrbits dataset structures.
Features:
    - Recursive JSON discovery.
    - Strict JSON parsing with duplicate-key detection.
    - UTF-8 and BOM handling.
    - Optional required-field validation.
    - Optional dataset-specific required fields.
    - Optional duplicate-ID detection within each file.
    - Optional JSON validation report.
    - Read-only source validation.
    - Standard library only.
    - Python 3.12+.
Usage:
    python python/scripts/validate_json.py
    python python/scripts/validate_json.py --root assets/data
    python python/scripts/validate_json.py --root assets/data --strict
    python python/scripts/validate_json.py --root assets/data --check-ids
    python python/scripts/validate_json.py --root assets/data --report reports/json-validation.json
Exit codes:
    0 = Validation passed.
    1 = Validation findings were detected.
    2 = Invalid configuration or execution failure.
"""
from __future__ import annotations
import argparse
import json
import os
import sys
import tempfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
DEFAULT_EXCLUDED_DIRS = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "build",
    "dist",
}
DEFAULT_REQUIRED_FIELDS: dict[str, tuple[str, ...]] = {
    "colleges.json": ("name",),
    "universities.json": ("name",),
    "courses.json": ("name",),
    "jobs.json": ("title",),
    "entrance-exams.json": ("name",),
    "scholarships.json": ("name",),
    "documents.json": ("name",),
    "services.json": ("name",),
    "countries.json": ("name",),
}
DEFAULT_ID_FIELDS = ("id", "college_id", "university_id", "course_id", "job_id")
class DuplicateJSONKeyError(ValueError):
    """Raised when a JSON object contains a repeated key."""
class ValidationConfigurationError(Exception):
    """Raised for invalid validator configuration."""
def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
def reject_duplicate_keys(
    pairs: list[tuple[str, Any]],
) -> dict[str, Any]:
    """Reject duplicate keys instead of silently keeping the last value."""
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise DuplicateJSONKeyError(
                f"Duplicate object key: {key!r}"
            )
        result[key] = value
    return result
def discover_json_files(
    root: Path,
    excluded_dirs: set[str],
    report_path: Path | None = None,
) -> list[Path]:
    """Find JSON files without entering excluded directories."""
    if root.is_file():
        if root.suffix.lower() != ".json":
            raise ValidationConfigurationError(
                f"Input file must have a .json extension: {root}"
            )
        return [root]
    files: list[Path] = []
    for directory, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(
            name for name in dirnames
            if name not in excluded_dirs
        )
        for filename in sorted(filenames):
            if not filename.lower().endswith(".json"):
                continue
            path = Path(directory) / filename
            if report_path and path.resolve() == report_path.resolve():
                continue
            files.append(path)
    return sorted(files)
def load_json(path: Path) -> Any:
    """Parse JSON with duplicate-key detection."""
    try:
        with path.open("r", encoding="utf-8-sig") as handle:
            return json.load(
                handle,
                object_pairs_hook=reject_duplicate_keys,
                parse_constant=lambda value: (
                    _raise_invalid_constant(value)
                ),
            )
    except DuplicateJSONKeyError as exc:
        raise ValueError(str(exc)) from exc
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Invalid JSON at line {exc.lineno}, "
            f"column {exc.colno}: {exc.msg}"
        ) from exc
    except (OSError, UnicodeError) as exc:
        raise ValueError(f"Cannot read file: {exc}") from exc
def _raise_invalid_constant(value: str) -> None:
    """Reject non-standard JSON constants such as NaN and Infinity."""
    raise ValueError(f"Invalid JSON constant: {value}")
def normalize_required_fields(
    value: str | None,
) -> tuple[str, ...]:
    if not value:
        return ()
    fields = tuple(
        dict.fromkeys(
            field.strip()
            for field in value.split(",")
            if field.strip()
        )
    )
    if not fields:
        raise ValidationConfigurationError(
            "--required must contain at least one field name."
        )
    return fields
def validate_required_fields(
    document: Any,
    required_fields: tuple[str, ...],
) -> list[str]:
    """Check required fields on object records."""
    if not required_fields:
        return []
    if isinstance(document, list):
        records = document
    elif isinstance(document, dict):
        records = None
        for key in ("records", "data", "items", "results"):
            if isinstance(document.get(key), list):
                records = document[key]
                break
        if records is None:
            records = [document]
    else:
        return [
            "Required-field validation expects a JSON object or array."
        ]
    findings: list[str] = []
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            findings.append(
                f"Record {index}: expected an object, "
                f"got {type(record).__name__}."
            )
            continue
        for field in required_fields:
            value = record.get(field)
            if value is None or (
                isinstance(value, str) and not value.strip()
            ):
                findings.append(
                    f"Record {index}: missing or empty required field "
                    f"{field!r}."
                )
    return findings
def walk_records(document: Any) -> list[dict[str, Any]]:
    """Extract top-level records from common JSON dataset structures."""
    if isinstance(document, list):
        return [item for item in document if isinstance(item, dict)]
    if not isinstance(document, dict):
        return []
    for key in ("records", "data", "items", "results"):
        value = document.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return [document]
def validate_duplicate_ids(
    document: Any,
    id_fields: tuple[str, ...],
) -> list[str]:
    """Find repeated identifiers within a single JSON file."""
    records = walk_records(document)
    seen: dict[tuple[str, str], list[int]] = defaultdict(list)
    for index, record in enumerate(records):
        for field in id_fields:
            value = record.get(field)
            if isinstance(value, bool) or not isinstance(value, (str, int)):
                continue
            normalized = str(value).strip()
            if normalized:
                seen[(field, normalized)].append(index)
                break
    findings: list[str] = []
    for (field, value), indexes in sorted(seen.items()):
        if len(indexes) > 1:
            findings.append(
                f"Duplicate {field}={value!r} in records "
                f"{', '.join(map(str, indexes))}."
            )
    return findings
def required_fields_for_file(
    path: Path,
    custom_fields: tuple[str, ...],
    use_defaults: bool,
) -> tuple[str, ...]:
    """Resolve required fields from CLI settings or filename defaults."""
    if custom_fields:
        return custom_fields
    if use_defaults:
        return DEFAULT_REQUIRED_FIELDS.get(path.name.lower(), ())
    return ()
def write_report(
    output: Path,
    report: dict[str, Any],
    overwrite: bool,
) -> None:
    """Write a report atomically without replacing files by default."""
    output = output.expanduser().resolve()
    if output.exists() and output.is_dir():
        raise ValidationConfigurationError(
            f"Report path is a directory: {output}"
        )
    if output.exists() and not overwrite:
        raise ValidationConfigurationError(
            f"Report already exists: {output}. "
            "Use --overwrite to replace it."
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="\n",
            prefix=f".{output.name}.",
            suffix=".tmp",
            dir=output.parent,
            delete=False,
        ) as handle:
            temporary = Path(handle.name)
            json.dump(report, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        if output.exists() and not overwrite:
            raise ValidationConfigurationError(
                f"Report appeared during validation: {output}"
            )
        temporary.replace(output)
        temporary = None
    except OSError as exc:
        raise ValidationConfigurationError(
            f"Could not write report: {exc}"
        ) from exc
    finally:
        if temporary is not None:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate MedOrbits JSON files and datasets."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path("assets/data"),
        help="JSON file or directory to validate (default: assets/data).",
    )
    parser.add_argument(
        "--required",
        help="Comma-separated required fields, e.g. name,state.",
    )
    parser.add_argument(
        "--no-default-required",
        action="store_true",
        help="Disable filename-based required-field checks.",
    )
    parser.add_argument(
        "--check-ids",
        action="store_true",
        help="Check for duplicate identifiers within each file.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Enable filename-based required-field and duplicate-ID checks.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Optional JSON report output path.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow replacing an existing report.",
    )
    parser.add_argument(
        "--exclude-dir",
        action="append",
        default=[],
        help="Additional directory name to exclude; repeat as needed.",
    )
    return parser
def main() -> int:
    args = build_parser().parse_args()
    root = args.root.expanduser().resolve()
    report_path = (
        args.report.expanduser().resolve()
        if args.report
        else None
    )
    if not root.exists():
        print(f"ERROR: Path does not exist: {root}", file=sys.stderr)
        return 2
    if not root.is_file() and not root.is_dir():
        print(f"ERROR: Invalid input path: {root}", file=sys.stderr)
        return 2
    try:
        custom_fields = normalize_required_fields(args.required)
        files = discover_json_files(
            root,
            DEFAULT_EXCLUDED_DIRS | set(args.exclude_dir),
            report_path,
        )
        if not files:
            print(f"ERROR: No JSON files found under {root}.", file=sys.stderr)
            return 2
        report: dict[str, Any] = {
            "metadata": {
                "tool": "MedOrbits JSON Validator",
                "generatedAtUtc": utc_now(),
                "root": str(root),
                "filesDiscovered": len(files),
                "filesValid": 0,
                "filesInvalid": 0,
                "findingCount": 0,
            },
            "results": [],
        }
        for path in files:
            try:
                document = load_json(path)
                findings: list[str] = []
                required = required_fields_for_file(
                    path,
                    custom_fields,
                    use_defaults=(
                        args.strict or not args.no_default_required
                    ),
                )
                findings.extend(
                    validate_required_fields(document, required)
                )
                if args.check_ids or args.strict:
                    findings.extend(
                        validate_duplicate_ids(
                            document,
                            DEFAULT_ID_FIELDS,
                        )
                    )
                result = {
                    "file": (
                        path.relative_to(root).as_posix()
                        if root.is_dir()
                        else path.name
                    ),
                    "valid": not findings,
                    "findings": findings,
                }
            except ValueError as exc:
                result = {
                    "file": (
                        path.relative_to(root).as_posix()
                        if root.is_dir()
                        else path.name
                    ),
                    "valid": False,
                    "findings": [str(exc)],
                }
            report["results"].append(result)
            if result["valid"]:
                report["metadata"]["filesValid"] += 1
            else:
                report["metadata"]["filesInvalid"] += 1
                report["metadata"]["findingCount"] += len(result["findings"])
        print("MedOrbits JSON Validator")
        print("=" * 24)
        print(f"Files discovered: {report['metadata']['filesDiscovered']}")
        print(f"Valid files:      {report['metadata']['filesValid']}")
        print(f"Invalid files:    {report['metadata']['filesInvalid']}")
        print(f"Findings:         {report['metadata']['findingCount']}")
        print()
        for result in report["results"]:
            status = "PASS" if result["valid"] else "FAIL"
            print(f"[{status}] {result['file']}")
            for finding in result["findings"]:
                print(f"  - {finding}")
        if report_path:
            write_report(report_path, report, args.overwrite)
            print(f"\nReport saved: {report_path}")
        if report["metadata"]["findingCount"] > 0:
            print("\nStatus: VALIDATION FAILED")
            return 1
        print("\nStatus: VALIDATION PASSED")
        return 0
    except (ValidationConfigurationError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
if __name__ == "__main__":
    raise SystemExit(main())