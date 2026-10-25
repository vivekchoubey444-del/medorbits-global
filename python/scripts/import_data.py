/python/scripts/import_data.py

#!/usr/bin/env python3
"""
MedOrbits Universal Data Importer
=================================
Imports general-purpose project datasets into normalized JSON files.
Supported input formats:
    .json, .jsonl, .ndjson, .csv, .tsv, .xml
Suitable for:
    - Colleges, universities and institutions
    - Courses, degrees and academic programmes
    - Admissions, counselling and applications
    - Entrance examinations and eligibility
    - Careers, jobs, employers and recruitment
    - Scholarships, fellowships and financial aid
    - Skills, qualifications and certifications
    - Notifications, announcements and new releases
    - News, articles, FAQs and help resources
    - Services, testimonials and contact information
    - Countries, languages and locations
    - Fees, hostels, documents and career resources
    - Other structured JSON datasets
Features:
    - Recursive directory discovery
    - JSON, JSONL, CSV, TSV and XML parsing
    - Dataset classification from filenames
    - Explicit dataset name override
    - Stable ID generation when IDs are missing
    - Duplicate-ID detection
    - Optional strict validation
    - Dry-run mode
    - Import report and manifest
    - Atomic individual file writes
    - No overwrite by default
    - Standard-library only
Python: 3.10+
Examples:
    python import_data.py ./data
    python import_data.py ./data/colleges.json
    python import_data.py ./data/jobs.csv --dataset jobs
    python import_data.py ./data --output ./data/imported --dry-run
    python import_data.py ./data --output ./data/imported --overwrite
This script imports data supplied by the user. It does not independently
verify the truth of admissions, fees, employment, or other source data.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
VERSION = "1.0.0"
SUPPORTED_EXTENSIONS = {
    ".json", ".jsonl", ".ndjson", ".csv", ".tsv", ".xml"
}
WRAPPER_KEYS = (
    "records",
    "items",
    "results",
    "entries",
    "data",
)
ID_FIELDS = (
    "id",
    "uuid",
    "record_id",
    "code",
    "slug",
)
TITLE_FIELDS = (
    "title",
    "name",
    "label",
    "question",
    "course_name",
    "college_name",
    "university_name",
    "job_title",
    "career",
)
KNOWN_DATASETS = {
    "colleges": (
        "college", "colleges", "medical-colleges",
        "institutions", "institutes",
    ),
    "universities": (
        "university", "universities",
    ),
    "courses": (
        "course", "courses", "degrees",
        "programmes", "programs",
    ),
    "admissions": (
        "admission", "admissions", "applications",
        "counselling", "counseling",
    ),
    "entrance-exams": (
        "entrance-exams", "entrance_exams",
        "exams", "examinations",
    ),
    "jobs": (
        "jobs", "job-listings", "vacancies",
        "job-categories", "job_roles",
    ),
    "careers": (
        "career", "careers", "career-options",
        "career-pathways", "career-resources",
    ),
    "scholarships": (
        "scholarship", "scholarships",
        "grants", "financial-aid",
    ),
    "hostels": (
        "hostel", "hostels", "accommodation",
    ),
    "fees": (
        "fee", "fees", "fee-structure",
        "fee-structures", "tuition-fees",
    ),
    "documents": (
        "document", "documents", "checklists",
    ),
    "notifications": (
        "notification", "notifications",
        "announcements", "alerts",
    ),
    "news": (
        "news", "articles", "updates",
    ),
    "releases": (
        "new-releases", "new_releases",
        "releases", "changelog",
    ),
    "faqs": (
        "faq", "faqs", "frequently-asked-questions",
    ),
    "services": (
        "service", "services",
    ),
    "testimonials": (
        "testimonial", "testimonials", "reviews",
    ),
    "countries": (
        "country", "countries",
    ),
    "languages": (
        "language", "languages", "i18n",
    ),
    "scholarship-providers": (
        "scholarship-providers", "scholarship_providers",
    ),
    "hostel-providers": (
        "hostel-providers", "hostel_providers",
    ),
    "universities-directory": (
        "university-directory", "universities-directory",
    ),
    "jobs-data": (
        "jobs-data", "job-data", "employment-data",
    ),
}
def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()
def normalize_name(value: str) -> str:
    """Create a portable dataset name."""
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "dataset"
def classify_dataset(path: Path, explicit: str | None = None) -> str:
    if explicit:
        return normalize_name(explicit)
    stem = normalize_name(path.stem)
    matches: list[tuple[int, str]] = []
    for dataset, aliases in KNOWN_DATASETS.items():
        for alias in aliases:
            normalized_alias = normalize_name(alias)
            if (
                stem == normalized_alias
                or stem.startswith(normalized_alias + "-")
                or stem.endswith("-" + normalized_alias)
                or f"-{normalized_alias}-" in f"-{stem}-"
            ):
                matches.append((len(normalized_alias), dataset))
    if matches:
        matches.sort(reverse=True)
        return matches[0][1]
    return stem
def read_json(path: Path) -> list[Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid JSON: {exc}") from exc
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        for key in WRAPPER_KEYS:
            if isinstance(value.get(key), list):
                return value[key]
        return [value]
    raise ValueError("JSON root must be an object or array.")
def read_jsonl(path: Path) -> list[Any]:
    records = []
    try:
        with path.open("r", encoding="utf-8-sig") as stream:
            for line_number, line in enumerate(stream, 1):
                if not line.strip():
                    continue
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError as exc:
                    raise ValueError(
                        f"Invalid JSONL at line {line_number}: {exc.msg}"
                    ) from exc
    except OSError as exc:
        raise ValueError(str(exc)) from exc
    return records
def read_delimited(path: Path, delimiter: str) -> list[Any]:
    try:
        with path.open(
            "r", encoding="utf-8-sig", newline=""
        ) as stream:
            reader = csv.DictReader(stream, delimiter=delimiter)
            if not reader.fieldnames:
                raise ValueError("CSV/TSV file has no header.")
            headers = [
                header.strip() if header else ""
                for header in reader.fieldnames
            ]
            if any(not header for header in headers):
                raise ValueError("CSV/TSV contains an empty column name.")
            if len(set(headers)) != len(headers):
                raise ValueError("CSV/TSV contains duplicate column names.")
            records = []
            for row in reader:
                record = {
                    headers[index]: value
                    for index, value in enumerate(row.values())
                    if index < len(headers)
                }
                if any(value is not None for value in record.values()):
                    records.append(record)
            return records
    except (OSError, csv.Error) as exc:
        raise ValueError(f"Cannot read delimited file: {exc}") from exc
def xml_element_to_value(element: ET.Element) -> Any:
    """
    Convert XML into dictionaries/lists while preserving repeated elements.
    Attributes are represented with an '@' prefix and text as '#text'.
    """
    result: dict[str, Any] = {}
    for key, value in element.attrib.items():
        result[f"@{key}"] = value
    for child in list(element):
        key = child.tag.rsplit("}", 1)[-1]
        value = xml_element_to_value(child)
        if key in result:
            if not isinstance(result[key], list):
                result[key] = [result[key]]
            result[key].append(value)
        else:
            result[key] = value
    text_value = (element.text or "").strip()
    if not result:
        return text_value
    if text_value:
        result["#text"] = text_value
    return result
def read_xml(path: Path) -> list[Any]:
    try:
        root = ET.fromstring(path.read_bytes())
    except (OSError, ET.ParseError) as exc:
        raise ValueError(f"Invalid XML: {exc}") from exc
    children = list(root)
    if not children:
        return [xml_element_to_value(root)]
    # Common dataset wrappers: <records><record>...</record></records>
    records = []
    for child in children:
        records.append(xml_element_to_value(child))
    return records
def read_records(path: Path) -> list[Any]:
    suffix = path.suffix.lower()
    if suffix == ".json":
        return read_json(path)
    if suffix in {".jsonl", ".ndjson"}:
        return read_jsonl(path)
    if suffix == ".csv":
        return read_delimited(path, ",")
    if suffix == ".tsv":
        return read_delimited(path, "\t")
    if suffix == ".xml":
        return read_xml(path)
    raise ValueError(f"Unsupported extension: {suffix}")
def find_existing_id(record: dict[str, Any]) -> Any:
    for field in ID_FIELDS:
        value = record.get(field)
        if value is not None and str(value).strip():
            return value
    return None
def stable_id(dataset: str, record: dict[str, Any]) -> str:
    existing = find_existing_id(record)
    if existing is not None:
        return str(existing).strip()
    for field in TITLE_FIELDS:
        value = record.get(field)
        if isinstance(value, (str, int, float)) and str(value).strip():
            slug = normalize_name(str(value))[:65]
            if slug:
                return f"{dataset}-{slug}"
    encoded = json.dumps(
        record,
        sort_keys=True,
        ensure_ascii=False,
        default=str,
    ).encode("utf-8")
    digest = hashlib.sha256(encoded).hexdigest()[:20]
    return f"{dataset}-{digest}"
def validate_record(
    record: Any,
    dataset: str,
    source: str,
    row_number: int,
    strict: bool,
) -> tuple[dict[str, Any] | None, list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not isinstance(record, dict):
        return None, [
            f"{source}, record {row_number}: expected an object."
        ], warnings
    normalized = dict(record)
    for key in normalized:
        if not isinstance(key, str) or not key.strip():
            errors.append(
                f"{source}, record {row_number}: invalid field name."
            )
    if errors:
        return None, errors, warnings
    record_id = find_existing_id(normalized)
    if record_id is None:
        normalized["id"] = stable_id(dataset, normalized)
        warnings.append(
            f"{source}, record {row_number}: generated missing ID "
            f"{normalized['id']!r}."
        )
    else:
        normalized["id"] = str(record_id).strip()
    if not normalized["id"]:
        errors.append(
            f"{source}, record {row_number}: record ID cannot be empty."
        )
    if not any(
        normalized.get(field) not in (None, "")
        for field in TITLE_FIELDS
    ):
        message = (
            f"{source}, record {row_number}: no recognizable title/name "
            "field was found."
        )
        if strict:
            errors.append(message)
        else:
            warnings.append(message)
    if errors:
        return None, errors, warnings
    return normalized, errors, warnings
def discover_files(input_path: Path) -> list[Path]:
    if input_path.is_file():
        if input_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            raise ValueError(
                f"Unsupported input file: {input_path}"
            )
        return [input_path]
    if not input_path.is_dir():
        raise ValueError(f"Input path does not exist: {input_path}")
    excluded = {
        ".git",
        "node_modules",
        "__pycache__",
        ".venv",
        "venv",
        "dist",
        "build",
    }
    return sorted(
        path
        for path in input_path.rglob("*")
        if path.is_file()
        and path.suffix.lower() in SUPPORTED_EXTENSIONS
        and not any(
            part in excluded
            for part in path.relative_to(input_path).parts
        )
    )
def atomic_write_json(
    path: Path,
    value: Any,
    overwrite: bool,
) -> None:
    if path.exists() and not overwrite:
        raise FileExistsError(
            f"Output already exists: {path}. Use --overwrite."
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    try:
        temporary.write_text(
            json.dumps(
                value,
                ensure_ascii=False,
                indent=2,
                default=str,
            ) + "\n",
            encoding="utf-8",
        )
        if path.exists() and not overwrite:
            raise FileExistsError(
                f"Output appeared during write: {path}"
            )
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import and validate MedOrbits project datasets."
    )
    parser.add_argument(
        "input",
        type=Path,
        help="Input file or directory.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/imported"),
        help="Output directory; default: data/imported.",
    )
    parser.add_argument(
        "--dataset",
        help="Force a dataset name when importing a single file.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow replacing existing output files.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate inputs without writing output.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Reject records without a recognized title/name field.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Optional report output path.",
    )
    args = parser.parse_args()
    try:
        input_path = args.input.resolve()
        output_dir = args.output.resolve()
        if args.dataset and not input_path.is_file():
            parser.error("--dataset can only be used with a single file.")
        files = discover_files(input_path)
        if not files:
            print("ERROR: no supported input files found.", file=sys.stderr)
            return 2
        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
        seen_ids: dict[str, set[str]] = defaultdict(set)
        report: dict[str, Any] = {
            "schemaVersion": "1.0.0",
            "tool": "MedOrbits Universal Data Importer",
            "toolVersion": VERSION,
            "generatedAt": utc_now(),
            "input": str(input_path),
            "output": str(output_dir),
            "dryRun": args.dry_run,
            "summary": {
                "filesFound": len(files),
                "filesProcessed": 0,
                "recordsRead": 0,
                "recordsImported": 0,
                "recordsRejected": 0,
                "duplicateIds": 0,
            },
            "datasets": {},
            "files": [],
            "errors": [],
            "warnings": [],
        }
        for file_path in files:
            dataset = classify_dataset(
                file_path,
                args.dataset if input_path.is_file() else None,
            )
            file_report = {
                "source": str(file_path),
                "dataset": dataset,
                "recordsRead": 0,
                "recordsImported": 0,
                "recordsRejected": 0,
                "errors": [],
                "warnings": [],
            }
            try:
                records = read_records(file_path)
            except (OSError, ValueError, json.JSONDecodeError) as exc:
                message = f"{file_path}: {exc}"
                file_report["errors"].append(message)
                report["errors"].append(message)
                report["files"].append(file_report)
                continue
            file_report["recordsRead"] = len(records)
            report["summary"]["recordsRead"] += len(records)
            report["summary"]["filesProcessed"] += 1
            for row_number, raw_record in enumerate(records, 1):
                normalized, errors, warnings = validate_record(
                    raw_record,
                    dataset,
                    str(file_path),
                    row_number,
                    args.strict,
                )
                file_report["errors"].extend(errors)
                file_report["warnings"].extend(warnings)
                report["errors"].extend(errors)
                report["warnings"].extend(warnings)
                if normalized is None:
                    file_report["recordsRejected"] += 1
                    report["summary"]["recordsRejected"] += 1
                    continue
                record_id = normalized["id"]
                if record_id in seen_ids[dataset]:
                    message = (
                        f"{file_path}, record {row_number}: duplicate ID "
                        f"{record_id!r} in dataset {dataset!r}."
                    )
                    file_report["errors"].append(message)
                    report["errors"].append(message)
                    file_report["recordsRejected"] += 1
                    report["summary"]["recordsRejected"] += 1
                    report["summary"]["duplicateIds"] += 1
                    continue
                seen_ids[dataset].add(record_id)
                grouped[dataset].append(normalized)
                file_report["recordsImported"] += 1
                report["summary"]["recordsImported"] += 1
            report["files"].append(file_report)
        for dataset, records in sorted(grouped.items()):
            report["datasets"][dataset] = {
                "recordCount": len(records),
                "outputFile": str(output_dir / f"{dataset}.json"),
            }
        report_path = (
            args.report.resolve()
            if args.report
            else output_dir / "import-report.json"
        )
        output_files = [
            output_dir / f"{dataset}.json"
            for dataset in grouped
        ]
        if report_path in output_files:
            raise ValueError(
                "Report path cannot match a dataset output file."
            )
        if not args.dry_run and not args.overwrite:
            conflicts = [
                str(path)
                for path in [*output_files, report_path]
                if path.exists()
            ]
            if conflicts:
                raise FileExistsError(
                    "Output already exists; use --overwrite:\n"
                    + "\n".join(conflicts)
                )
        if not args.dry_run:
            for dataset, records in sorted(grouped.items()):
                output_file = output_dir / f"{dataset}.json"
                document = {
                    "metadata": {
                        "schemaVersion": "1.0.0",
                        "dataset": dataset,
                        "generatedAt": utc_now(),
                        "recordCount": len(records),
                        "sourceTool": "import_data.py",
                    },
                    "records": records,
                }
                atomic_write_json(
                    output_file,
                    document,
                    overwrite=args.overwrite,
                )
            atomic_write_json(
                report_path,
                report,
                overwrite=args.overwrite,
            )
        print("\nMedOrbits Universal Data Import")
        print("--------------------------------")
        print(f"Files found:      {report['summary']['filesFound']}")
        print(f"Files processed:  {report['summary']['filesProcessed']}")
        print(f"Records read:     {report['summary']['recordsRead']}")
        print(f"Records imported: {report['summary']['recordsImported']}")
        print(f"Records rejected: {report['summary']['recordsRejected']}")
        print(f"Duplicate IDs:    {report['summary']['duplicateIds']}")
        print(f"Datasets:         {len(grouped)}")
        print(f"Errors:           {len(report['errors'])}")
        print(f"Warnings:         {len(report['warnings'])}")
        if args.dry_run:
            print("\nDRY RUN: no files were written.")
        else:
            print(f"\nOutput directory: {output_dir}")
            print(f"Import report:    {report_path}")
        return 1 if report["errors"] else 0
    except (OSError, ValueError, FileExistsError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
if __name__ == "__main__":
    raise SystemExit(main())