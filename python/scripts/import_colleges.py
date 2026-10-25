#!/usr/bin/env python3
"""
MedOrbits Universal Dataset Importer
====================================
File:
    python/scripts/import_colleges.py
Purpose:
    Import and validate MedOrbits datasets, including colleges,
    universities, courses, fees, entrance exams, scholarships,
    jobs, hostels, admissions, documents, FAQs, and other entities.
Python:
    3.12+
Dependencies:
    Python standard library only.
Supported input formats:
    JSON, CSV
Supported operations:
    - Import one dataset or a directory of datasets.
    - Select a dataset type explicitly or infer it from the filename.
    - Validate JSON objects and CSV records.
    - Normalize records into a consistent structure.
    - Detect duplicate identifiers.
    - Check required fields.
    - Preserve source attribution.
    - Preview changes without writing.
    - Write a combined JSON output.
    - Prevent accidental overwrites.
    - Generate an optional validation report.
Safety:
    Source files are never modified.
    Existing output files are preserved unless --overwrite is supplied.
    This tool does not fetch data from external websites or APIs.
Exit codes:
    0 = Import completed successfully.
    1 = Validation errors or duplicate identifiers found.
    2 = Configuration or execution error.
"""
from __future__ import annotations
import argparse
import csv
import json
import os
import re
import sys
import tempfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
SCHEMA_VERSION = "1.0.0"
SUPPORTED_EXTENSIONS = {".json", ".csv"}
EXCLUDED_DIRECTORIES = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "build",
    "dist",
    "reports",
    "exports",
}
# Dataset definitions are intentionally configurable and extensible.
# Required fields describe a minimal internal record contract, not
# a claim that all providers use the same external schema.
DATASET_SCHEMAS: dict[str, dict[str, Any]] = {
    "colleges": {
        "aliases": ["college", "medical-colleges", "institutions"],
        "required": ["name"],
        "id_fields": ["id", "college_id", "code"],
    },
    "universities": {
        "aliases": ["university", "university-list"],
        "required": ["name"],
        "id_fields": ["id", "university_id", "code"],
    },
    "courses": {
        "aliases": ["course", "programs", "programmes"],
        "required": ["name"],
        "id_fields": ["id", "course_id", "code"],
    },
    "fees": {
        "aliases": ["fee", "fee-structure", "fee-structures"],
        "required": [],
        "id_fields": ["id", "fee_id", "course_id"],
    },
    "entrance-exams": {
        "aliases": ["entrance-exam", "exams", "examination"],
        "required": ["name"],
        "id_fields": ["id", "exam_id", "code"],
    },
    "scholarships": {
        "aliases": ["scholarship", "financial-aid"],
        "required": ["name"],
        "id_fields": ["id", "scholarship_id", "code"],
    },
    "jobs": {
        "aliases": ["job", "vacancies", "careers", "opportunities"],
        "required": ["title"],
        "id_fields": ["id", "job_id", "vacancy_id"],
    },
    "hostels": {
        "aliases": ["hostel", "accommodation"],
        "required": ["name"],
        "id_fields": ["id", "hostel_id", "code"],
    },
    "admission-process": {
        "aliases": ["admissions", "admission", "admission-processes"],
        "required": [],
        "id_fields": ["id", "admission_id", "course_id"],
    },
    "documents": {
        "aliases": ["document", "required-documents"],
        "required": ["name"],
        "id_fields": ["id", "document_id", "code"],
    },
    "career-options": {
        "aliases": ["career-option", "career-paths"],
        "required": ["name"],
        "id_fields": ["id", "career_id", "code"],
    },
    "countries": {
        "aliases": ["country", "country-list"],
        "required": ["name"],
        "id_fields": ["id", "country_code", "code"],
    },
    "faqs": {
        "aliases": ["faq", "frequently-asked-questions"],
        "required": [],
        "id_fields": ["id", "faq_id", "question"],
    },
    "news": {
        "aliases": ["news-items", "announcements", "notices"],
        "required": ["title"],
        "id_fields": ["id", "news_id", "slug"],
    },
    "notifications": {
        "aliases": ["notification", "alerts"],
        "required": [],
        "id_fields": ["id", "notification_id"],
    },
    "services": {
        "aliases": ["service", "consultancy-services"],
        "required": ["name"],
        "id_fields": ["id", "service_id", "code"],
    },
    "testimonials": {
        "aliases": ["testimonial", "reviews"],
        "required": [],
        "id_fields": ["id", "testimonial_id"],
    },
    "countries": {
        "aliases": ["country", "country-list"],
        "required": ["name"],
        "id_fields": ["id", "country_code", "code"],
    },
    "universities": {
        "aliases": ["university", "university-list"],
        "required": ["name"],
        "id_fields": ["id", "university_id", "code"],
    },
    "entrance-exams": {
        "aliases": ["entrance-exam", "exams", "examination"],
        "required": ["name"],
        "id_fields": ["id", "exam_id", "code"],
    },
    "custom": {
        "aliases": [],
        "required": [],
        "id_fields": ["id"],
    },
}
class ImportErrorDetail(Exception):
    """Raised for import configuration or execution failures."""
def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
def normalize_name(value: str) -> str:
    """Normalize a dataset name or filename for matching."""
    value = Path(value).stem.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")
def build_dataset_aliases() -> dict[str, str]:
    aliases: dict[str, str] = {}
    for dataset, schema in DATASET_SCHEMAS.items():
        aliases[normalize_name(dataset)] = dataset
        for alias in schema.get("aliases", []):
            aliases[normalize_name(alias)] = dataset
    return aliases
DATASET_ALIASES = build_dataset_aliases()
def infer_dataset_type(path: Path) -> str:
    """Infer the dataset type from a filename."""
    filename = normalize_name(path.name)
    # Prefer the longest matching alias to reduce ambiguous matches.
    for alias in sorted(DATASET_ALIASES, key=len, reverse=True):
        if filename == alias or filename.startswith(alias + "-"):
            return DATASET_ALIASES[alias]
    return "custom"
def resolve_dataset_type(value: str | None, path: Path) -> str:
    if value is None:
        return infer_dataset_type(path)
    normalized = normalize_name(value)
    if normalized not in DATASET_ALIASES:
        supported = ", ".join(sorted(DATASET_SCHEMAS))
        raise ImportErrorDetail(
            f"Unknown dataset type {value!r}. Supported types: {supported}"
        )
    return DATASET_ALIASES[normalized]
def discover_input_files(source: Path) -> list[Path]:
    if source.is_file():
        if source.suffix.lower() not in SUPPORTED_EXTENSIONS:
            raise ImportErrorDetail(
                f"Unsupported input format: {source.suffix}"
            )
        return [source]
    files: list[Path] = []
    for directory, dirnames, filenames in os.walk(source):
        dirnames[:] = sorted(
            name for name in dirnames
            if name not in EXCLUDED_DIRECTORIES
        )
        for filename in sorted(filenames):
            path = Path(directory) / filename
            if path.suffix.lower() in SUPPORTED_EXTENSIONS:
                files.append(path)
    return sorted(files)
def load_json(path: Path) -> Any:
    try:
        with path.open("r", encoding="utf-8-sig") as handle:
            return json.load(handle)
    except json.JSONDecodeError as exc:
        raise ImportErrorDetail(
            f"{path}: invalid JSON at line {exc.lineno}, "
            f"column {exc.colno}: {exc.msg}"
        ) from exc
    except (OSError, UnicodeError) as exc:
        raise ImportErrorDetail(f"Cannot read {path}: {exc}") from exc
def load_csv(path: Path) -> list[dict[str, Any]]:
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames:
                raise ImportErrorDetail(f"{path}: CSV header is missing.")
            if any(not name or not name.strip() for name in reader.fieldnames):
                raise ImportErrorDetail(f"{path}: CSV contains an empty column name.")
            return [dict(row) for row in reader]
    except (OSError, UnicodeError, csv.Error) as exc:
        raise ImportErrorDetail(f"Cannot read CSV {path}: {exc}") from exc
def extract_records(document: Any, source: Path) -> list[dict[str, Any]]:
    """Accept a JSON array, a single object, or common record containers."""
    if isinstance(document, list):
        records = document
    elif isinstance(document, dict):
        records = None
        for key in ("records", "data", "items", "results"):
            value = document.get(key)
            if isinstance(value, list):
                records = value
                break
        if records is None:
            records = [document]
    else:
        raise ImportErrorDetail(
            f"{source}: expected a JSON object or array."
        )
    invalid = [
        index for index, record in enumerate(records)
        if not isinstance(record, dict)
    ]
    if invalid:
        raise ImportErrorDetail(
            f"{source}: records at indexes {invalid[:10]} are not objects."
        )
    return records
def normalize_value(value: Any) -> Any:
    """Normalize simple CSV scalar values while preserving nested JSON."""
    if not isinstance(value, str):
        return value
    stripped = value.strip()
    if not stripped:
        return ""
    if stripped.lower() in {"true", "false"}:
        return stripped.lower() == "true"
    # Parse JSON arrays/objects only when the whole value is valid JSON.
    if stripped.startswith(("{", "[")):
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            return value
    return value
def normalize_record(
    record: dict[str, Any],
    dataset_type: str,
    source_file: str,
    record_number: int,
) -> dict[str, Any]:
    normalized = {
        str(key).strip(): normalize_value(value)
        for key, value in record.items()
    }
    normalized.setdefault("_dataset", dataset_type)
    normalized.setdefault("_source_file", source_file)
    normalized.setdefault("_source_record", record_number)
    return normalized
def identifier_for(
    record: dict[str, Any],
    id_fields: Iterable[str],
) -> str | None:
    for field in id_fields:
        value = record.get(field)
        if isinstance(value, bool) or value is None:
            continue
        if isinstance(value, (str, int)):
            value = str(value).strip()
            if value:
                return value
    return None
def validate_record(
    record: dict[str, Any],
    dataset_type: str,
    record_number: int,
) -> list[str]:
    schema = DATASET_SCHEMAS[dataset_type]
    errors: list[str] = []
    for field in schema["required"]:
        value = record.get(field)
        if value is None or (
            isinstance(value, str) and not value.strip()
        ):
            errors.append(
                f"record {record_number}: missing required field {field!r}"
            )
    if not any(
        identifier_for(record, [field]) is not None
        for field in schema["id_fields"]
    ):
        errors.append(
            f"record {record_number}: no usable identifier found "
            f"in {schema['id_fields']}"
        )
    return errors
def load_dataset(
    path: Path,
    root: Path,
    forced_type: str | None,
) -> tuple[str, list[dict[str, Any]], list[str]]:
    dataset_type = resolve_dataset_type(forced_type, path)
    if path.suffix.lower() == ".json":
        raw_records = extract_records(load_json(path), path)
    else:
        raw_records = load_csv(path)
    source_file = path.relative_to(root).as_posix()
    records: list[dict[str, Any]] = []
    errors: list[str] = []
    schema_type = dataset_type
    for number, raw in enumerate(raw_records, start=1):
        record = normalize_record(
            raw,
            dataset_type,
            source_file,
            number,
        )
        errors.extend(
            validate_record(record, schema_type, number)
        )
        records.append(record)
    return dataset_type, records, errors
def detect_duplicates(
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    seen: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        dataset = str(record.get("_dataset", "custom"))
        schema = DATASET_SCHEMAS.get(dataset, DATASET_SCHEMAS["custom"])
        identifier = identifier_for(record, schema["id_fields"])
        if identifier is not None:
            seen[(dataset, identifier)].append(record)
    duplicates: list[dict[str, Any]] = []
    for (dataset, identifier), occurrences in sorted(seen.items()):
        if len(occurrences) > 1:
            duplicates.append({
                "dataset": dataset,
                "identifier": identifier,
                "occurrences": [
                    {
                        "source_file": item.get("_source_file"),
                        "source_record": item.get("_source_record"),
                    }
                    for item in occurrences
                ],
            })
    return duplicates
def write_json_atomic(
    output: Path,
    payload: Any,
    overwrite: bool,
) -> None:
    output = output.expanduser().resolve()
    if output.exists() and output.is_dir():
        raise ImportErrorDetail(f"Output path is a directory: {output}")
    if output.exists() and not overwrite:
        raise ImportErrorDetail(
            f"Output already exists: {output}. Use --overwrite to replace it."
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
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        if output.exists() and not overwrite:
            raise ImportErrorDetail(
                f"Output appeared during import: {output}"
            )
        temporary.replace(output)
        temporary = None
    except OSError as exc:
        raise ImportErrorDetail(f"Could not write {output}: {exc}") from exc
    finally:
        if temporary is not None:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Import and validate MedOrbits datasets."
    )
    parser.add_argument(
        "--input",
        type=Path,
        required=True,
        help="Input JSON/CSV file or directory.",
    )
    parser.add_argument(
        "--type",
        dest="dataset_type",
        help="Dataset type; inferred from filenames if omitted.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Combined JSON output file.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Optional JSON validation report.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow replacement of existing output files.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Reject the import if validation errors or duplicates exist.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and report without writing imported data.",
    )
    parser.add_argument(
        "--list-types",
        action="store_true",
        help="List supported dataset types and exit.",
    )
    return parser
def main() -> int:
    args = build_parser().parse_args()
    if args.list_types:
        print("Supported MedOrbits dataset types:")
        for dataset in sorted(DATASET_SCHEMAS):
            print(f"  - {dataset}")
        return 0
    source = args.input.expanduser().resolve()
    if not source.exists():
        print(f"ERROR: Input does not exist: {source}", file=sys.stderr)
        return 2
    if not source.is_file() and not source.is_dir():
        print(f"ERROR: Input must be a file or directory: {source}", file=sys.stderr)
        return 2
    try:
        files = discover_input_files(source)
        if not files:
            raise ImportErrorDetail(
                f"No supported JSON or CSV files found in {source}."
            )
        root = source if source.is_dir() else source.parent
        all_records: list[dict[str, Any]] = []
        errors: list[str] = []
        datasets: dict[str, int] = defaultdict(int)
        imported_files: list[str] = []
        for path in files:
            try:
                dataset_type, records, file_errors = load_dataset(
                    path,
                    root,
                    args.dataset_type,
                )
            except ImportErrorDetail as exc:
                errors.append(str(exc))
                continue
            all_records.extend(records)
            datasets[dataset_type] += len(records)
            imported_files.append(path.relative_to(root).as_posix())
            errors.extend(
                f"{path.relative_to(root).as_posix()}: {error}"
                for error in file_errors
            )
        duplicates = detect_duplicates(all_records)
        report = {
            "metadata": {
                "tool": "MedOrbits Universal Dataset Importer",
                "schemaVersion": SCHEMA_VERSION,
                "generatedAtUtc": utc_now(),
                "source": str(source),
                "filesDiscovered": len(files),
                "filesImported": len(imported_files),
                "recordsImported": len(all_records),
                "datasetCounts": dict(sorted(datasets.items())),
                "validationErrorCount": len(errors),
                "duplicateGroupCount": len(duplicates),
                "dryRun": args.dry_run,
            },
            "sourceFiles": imported_files,
            "validationErrors": errors,
            "duplicates": duplicates,
            "records": all_records,
        }
        print("MedOrbits Universal Dataset Importer")
        print("=" * 36)
        print(f"Files discovered: {len(files)}")
        print(f"Files imported:   {len(imported_files)}")
        print(f"Records processed:{len(all_records):>5}")
        print(f"Dataset types:    {len(datasets)}")
        print(f"Validation errors:{len(errors):>5}")
        print(f"Duplicate groups: {len(duplicates)}")
        print()
        for dataset, count in sorted(datasets.items()):
            print(f"  {dataset}: {count} records")
        for error in errors[:50]:
            print(f"ERROR: {error}", file=sys.stderr)
        if len(errors) > 50:
            print(
                f"... and {len(errors) - 50} additional validation errors.",
                file=sys.stderr,
            )
        for duplicate in duplicates:
            print(
                f"DUPLICATE: {duplicate['dataset']} "
                f"identifier={duplicate['identifier']!r}",
                file=sys.stderr,
            )
        if args.report:
            write_json_atomic(
                args.report,
                {key: value for key, value in report.items()
                 if key != "records"},
                args.overwrite,
            )
            print(f"Validation report: {args.report.resolve()}")
        if args.dry_run:
            print("DRY RUN: no imported dataset was written.")
        elif args.output:
            if args.strict and (errors or duplicates):
                print(
                    "STRICT MODE: output not written because validation "
                    "errors or duplicate identifiers were found.",
                    file=sys.stderr,
                )
                return 1
            output = args.output.expanduser().resolve()
            if output in {path.resolve() for path in files}:
                raise ImportErrorDetail(
                    "Output path matches an input file; choose another path."
                )
            payload = {
                "metadata": {
                    "schemaVersion": SCHEMA_VERSION,
                    "generatedAtUtc": utc_now(),
                    "datasetCounts": dict(sorted(datasets.items())),
                    "recordCount": len(all_records),
                },
                "records": all_records,
            }
            write_json_atomic(output, payload, args.overwrite)
            print(f"Imported dataset: {output}")
        else:
            print("No dataset output requested; validation only.")
        if errors or duplicates:
            return 1
        print("Status: SUCCESS")
        return 0
    except (ImportErrorDetail, OSError) as exc:
        print(f"FATAL: {exc}", file=sys.stderr)
        return 2
if __name__ == "__main__":
    raise SystemExit(main())