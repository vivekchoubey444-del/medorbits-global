#!/usr/bin/env python3
"""
MedOrbits Application Export Utility
====================================
Purpose:
    Export application records from JSON datasets to CSV or JSON.
Features:
    - Recursive JSON input discovery.
    - Supports JSON arrays and common application-record containers.
    - CSV and JSON output formats.
    - Optional field selection.
    - UTF-8 output with proper CSV escaping.
    - Optional filtering by application status.
    - Read-only source handling.
    - Refuses to overwrite output unless explicitly authorized.
    - Standard library only; Python 3.12+.
Usage:
    python python/scripts/export_applications.py --input assets/data/applications.json
    python python/scripts/export_applications.py --input assets/data --format csv
    python python/scripts/export_applications.py --input assets/data --format json
    python python/scripts/export_applications.py --input assets/data --fields id status created_at
    python python/scripts/export_applications.py --input assets/data --status pending
    python python/scripts/export_applications.py --input assets/data --output exports/applications.csv
    python python/scripts/export_applications.py --input assets/data --output exports/applications.csv --overwrite
Security:
    Exported application records may contain personal information.
    Store exports securely and export only authorized fields.
"""
from __future__ import annotations
import argparse
import csv
import json
import sys
import tempfile
from pathlib import Path
from typing import Any, Iterator
DEFAULT_OUTPUT_DIR = "exports"
APPLICATION_KEYS = (
    "applications",
    "application_records",
    "records",
    "data",
    "results",
)
EXCLUDED_DIRS = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "build",
    "dist",
    "exports",
}
class ExportError(Exception):
    """Raised when an application export cannot be completed."""
def discover_json_files(source: Path) -> list[Path]:
    """Return JSON input files, excluding common generated directories."""
    if source.is_file():
        if source.suffix.lower() != ".json":
            raise ExportError("Input file must have a .json extension.")
        return [source]
    files: list[Path] = []
    for directory, dirnames, filenames in __import__("os").walk(source):
        dirnames[:] = sorted(
            name for name in dirnames
            if name not in EXCLUDED_DIRS
        )
        for filename in sorted(filenames):
            if filename.lower().endswith(".json"):
                files.append(Path(directory) / filename)
    return sorted(files)
def load_json(path: Path) -> Any:
    """Load a JSON file without modifying it."""
    try:
        with path.open("r", encoding="utf-8-sig") as handle:
            return json.load(handle)
    except json.JSONDecodeError as exc:
        raise ExportError(
            f"Invalid JSON in {path}: line {exc.lineno}, "
            f"column {exc.colno}: {exc.msg}"
        ) from exc
    except (OSError, UnicodeError) as exc:
        raise ExportError(f"Cannot read {path}: {exc}") from exc
def is_record(value: Any) -> bool:
    """Return True for dictionary-shaped records."""
    return isinstance(value, dict)
def extract_records(document: Any, source: Path) -> list[dict[str, Any]]:
    """
    Extract records from supported JSON structures.
    Supported examples:
        [{"id": "A1"}]
        {"applications": [{"id": "A1"}]}
        {"data": {"applications": [{"id": "A1"}]}}
        {"id": "A1", "status": "pending"}
    """
    if isinstance(document, list):
        records = document
    elif isinstance(document, dict):
        records = None
        for key in APPLICATION_KEYS:
            if key not in document:
                continue
            candidate = document[key]
            if isinstance(candidate, list):
                records = candidate
                break
            if isinstance(candidate, dict):
                for nested_key in APPLICATION_KEYS:
                    nested = candidate.get(nested_key)
                    if isinstance(nested, list):
                        records = nested
                        break
                if records is not None:
                    break
        if records is None:
            # Treat a dictionary as one record only when it resembles
            # an application record rather than arbitrary metadata.
            application_markers = {
                "id",
                "application_id",
                "applicant_id",
                "application_number",
            }
            if application_markers.intersection(document):
                records = [document]
            else:
                raise ExportError(
                    f"{source}: could not identify application records. "
                    "Expected a JSON array, a supported records container, "
                    "or an object containing an application identifier."
                )
    else:
        raise ExportError(
            f"{source}: top-level JSON must be an object or array."
        )
    invalid_count = sum(not is_record(item) for item in records)
    if invalid_count:
        raise ExportError(
            f"{source}: found {invalid_count} non-object record(s). "
            "Correct the source data before exporting."
        )
    return records
def iter_application_records(
    files: list[Path],
) -> Iterator[dict[str, Any]]:
    """Yield application records with source metadata."""
    for path in files:
        document = load_json(path)
        records = extract_records(document, path)
        for record in records:
            # Add source metadata without overwriting existing fields.
            enriched = dict(record)
            enriched.setdefault("_source_file", path.name)
            yield enriched
def filter_records(
    records: list[dict[str, Any]],
    status: str | None,
) -> list[dict[str, Any]]:
    """Filter records by status using a case-insensitive comparison."""
    if status is None:
        return records
    expected = status.strip().casefold()
    return [
        record
        for record in records
        if str(record.get("status", "")).strip().casefold() == expected
    ]
def normalize_cell(value: Any) -> str:
    """Serialize a record value for a CSV cell."""
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(
            value,
            ensure_ascii=False,
            separators=(",", ":"),
        )
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)
def collect_fields(
    records: list[dict[str, Any]],
    requested_fields: list[str] | None,
) -> list[str]:
    """Return requested fields or the ordered union of record keys."""
    if requested_fields:
        fields = list(dict.fromkeys(
            field.strip() for field in requested_fields if field.strip()
        ))
        if not fields:
            raise ExportError("At least one valid field must be specified.")
        return fields
    ordered_fields: list[str] = []
    for record in records:
        for key in record:
            if key not in ordered_fields:
                ordered_fields.append(key)
    return ordered_fields
def write_json(
    records: list[dict[str, Any]],
    fields: list[str],
    output: Path,
) -> None:
    """Write selected fields to a JSON array."""
    exported = [
        {field: record.get(field) for field in fields}
        for record in records
    ]
    with output.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(
            exported,
            handle,
            ensure_ascii=False,
            indent=2,
        )
        handle.write("\n")
def write_csv(
    records: list[dict[str, Any]],
    fields: list[str],
    output: Path,
) -> None:
    """Write selected fields to a CSV file."""
    with output.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=fields,
            extrasaction="ignore",
            lineterminator="\n",
        )
        writer.writeheader()
        for record in records:
            writer.writerow({
                field: normalize_cell(record.get(field))
                for field in fields
            })
def atomic_export(
    records: list[dict[str, Any]],
    fields: list[str],
    output: Path,
    output_format: str,
    overwrite: bool,
) -> None:
    """Write to a temporary file and atomically replace the destination."""
    output = output.expanduser().resolve()
    if output.exists() and not overwrite:
        raise ExportError(
            f"Output already exists: {output}. "
            "Use --overwrite to replace it."
        )
    if output.exists() and output.is_dir():
        raise ExportError(f"Output path is a directory: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            prefix=f".{output.name}.",
            suffix=".tmp",
            dir=output.parent,
            delete=False,
        ) as handle:
            temporary_path = Path(handle.name)
        if output_format == "json":
            write_json(records, fields, temporary_path)
        else:
            write_csv(records, fields, temporary_path)
        if output.exists() and not overwrite:
            raise ExportError(
                f"Output appeared during export: {output}. "
                "No replacement was performed."
            )
        temporary_path.replace(output)
        temporary_path = None
    except (OSError, UnicodeError, csv.Error, TypeError, ValueError) as exc:
        raise ExportError(f"Export failed: {exc}") from exc
    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink(missing_ok=True)
            except OSError:
                pass
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Export MedOrbits application records to CSV or JSON."
    )
    parser.add_argument(
        "--input",
        type=Path,
        required=True,
        help="JSON file or directory containing JSON datasets.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output file path. Defaults to exports/applications.<format>.",
    )
    parser.add_argument(
        "--format",
        choices=("csv", "json"),
        default="csv",
        help="Export format (default: csv).",
    )
    parser.add_argument(
        "--fields",
        nargs="+",
        help="Optional list of fields to export.",
    )
    parser.add_argument(
        "--status",
        help="Optional exact status filter, case-insensitive.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow replacement of an existing output file.",
    )
    parser.add_argument(
        "--allow-empty",
        action="store_true",
        help="Allow exporting zero matching records.",
    )
    return parser
def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    source = args.input.expanduser().resolve()
    if not source.exists():
        print(f"ERROR: Input does not exist: {source}", file=sys.stderr)
        return 2
    if not source.is_file() and not source.is_dir():
        print(f"ERROR: Input is not a file or directory: {source}", file=sys.stderr)
        return 2
    try:
        files = discover_json_files(source)
        if not files:
            raise ExportError(f"No JSON input files found in {source}.")
        records = list(iter_application_records(files))
        records = filter_records(records, args.status)
        if not records and not args.allow_empty:
            raise ExportError(
                "No application records matched the input and filters. "
                "Use --allow-empty to permit an empty export."
            )
        fields = collect_fields(records, args.fields)
        output = args.output or (
            Path(DEFAULT_OUTPUT_DIR) / f"applications.{args.format}"
        )
        output = output.expanduser().resolve()
        # Prevent accidental overwrite of any input file.
        input_paths = {path.resolve() for path in files}
        if output in input_paths:
            raise ExportError(
                "Output path matches an input file. "
                "Choose a different output destination."
            )
        atomic_export(
            records=records,
            fields=fields,
            output=output,
            output_format=args.format,
            overwrite=args.overwrite,
        )
        print("MedOrbits Application Export")
        print("=" * 29)
        print(f"Input files: {len(files)}")
        print(f"Exported records: {len(records)}")
        print(f"Fields: {', '.join(fields)}")
        print(f"Format: {args.format.upper()}")
        print(f"Output: {output}")
        print("Status: SUCCESS")
        return 0
    except (ExportError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
if __name__ == "__main__":
    raise SystemExit(main())