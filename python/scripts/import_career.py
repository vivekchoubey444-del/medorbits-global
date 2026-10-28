#!/usr/bin/env python3
"""
MedOrbits Career Ecosystem Importer
===================================
Imports and validates career-related datasets, including:
- Careers, occupations, professions and job roles
- Job categories, job listings, vacancies and employment types
- Industries, sectors, employers and companies
- Skills, competencies and experience levels
- Education, qualifications, degrees and entrance requirements
- Courses, training programmes and certifications
- Career pathways, progression, job transitions and specializations
- Salaries, compensation, benefits and labour-market information
- Internships, apprenticeships, fellowships and graduate programmes
- Recruitment, placement, job assistance and career counselling
- Resumes, interviews, portfolios and job-search resources
- Remote work, freelancing, self-employment and entrepreneurship
- Government jobs, competitive examinations and public services
- Scholarships, professional development and continuing education
Supported input:
    JSON, JSONL, CSV and TSV
Features:
    - Recursive directory imports
    - Automatic dataset classification from filenames
    - Optional explicit dataset selection
    - Record validation and duplicate-ID detection
    - Source-preserving record normalization
    - Cross-dataset relationship checks
    - Dry-run mode
    - Import manifest and JSON report
    - No overwrite by default
    - Standard-library only
Python: 3.10+
Examples:
    python import_career.py ./data/career
    python import_career.py ./data --output ./data/imported
    python import_career.py ./data/jobs.json --dataset job_listings
    python import_career.py ./data --all-related --dry-run
    python import_career.py ./data --output ./data/imported --overwrite
This importer does not invent career facts, salaries, employers, or URLs.
It imports supplied data and reports missing or inconsistent information.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
VERSION = "1.0.0"
SUPPORTED_EXTENSIONS = {".json", ".jsonl", ".ndjson", ".csv", ".tsv"}
DATASETS: dict[str, dict[str, Any]] = {
    "careers": {
        "aliases": [
            "career", "careers", "occupation", "occupations",
            "profession", "professions", "career-options",
            "career_options", "career-profiles", "career_profiles",
        ],
        "required_any": ["title", "name", "career", "occupation"],
    },
    "job_categories": {
        "aliases": [
            "job-category", "job-categories", "job_categories",
            "jobcategory", "employment-categories",
            "employment_categories",
        ],
        "required_any": ["name", "title", "category"],
    },
    "job_roles": {
        "aliases": [
            "job-role", "job-roles", "job_roles",
            "job-titles", "job_titles", "positions",
            "designations", "roles",
        ],
        "required_any": ["title", "name", "role", "job_title"],
    },
    "job_listings": {
        "aliases": [
            "job", "jobs", "job-listing", "job-listings",
            "job_listings", "vacancies", "vacancy",
            "openings", "employment-opportunities",
        ],
        "required_any": ["title", "job_title", "position", "role"],
    },
    "industries": {
        "aliases": [
            "industry", "industries", "sectors", "sector",
            "industry-sectors", "industry_sectors",
        ],
        "required_any": ["name", "title", "industry", "sector"],
    },
    "employers": {
        "aliases": [
            "employer", "employers", "companies", "company",
            "organizations", "organisations", "recruiters",
            "employer-profiles", "employer_profiles",
        ],
        "required_any": ["name", "company", "employer"],
    },
    "skills": {
        "aliases": [
            "skill", "skills", "competencies", "competency",
            "soft-skills", "soft_skills", "technical-skills",
            "technical_skills", "skill-taxonomy",
        ],
        "required_any": ["name", "title", "skill"],
    },
    "qualifications": {
        "aliases": [
            "qualification", "qualifications", "degrees",
            "degree", "education", "educational-qualifications",
            "educational_qualifications", "eligibility",
        ],
        "required_any": ["name", "title", "qualification", "degree"],
    },
    "courses": {
        "aliases": [
            "course", "courses", "training", "trainings",
            "training-programs", "training_programs",
            "programs", "programmes", "learning-paths",
        ],
        "required_any": ["name", "title", "course"],
    },
    "certifications": {
        "aliases": [
            "certification", "certifications", "certificates",
            "professional-certifications", "professional_certifications",
            "credentials", "licences", "licenses",
        ],
        "required_any": ["name", "title", "certification"],
    },
    "career_pathways": {
        "aliases": [
            "career-pathway", "career-pathways", "career_pathways",
            "career-paths", "career_paths", "career-progression",
            "career_progression", "progression-paths",
        ],
        "required_any": ["name", "title", "pathway", "career"],
    },
    "salary_data": {
        "aliases": [
            "salary", "salaries", "salary-data", "salary_data",
            "compensation", "pay-scales", "pay_scales",
            "wages", "earnings", "salary-ranges",
        ],
        "required_any": [
            "salary", "min_salary", "max_salary",
            "median_salary", "amount", "currency",
        ],
    },
    "internships": {
        "aliases": [
            "internship", "internships", "internship-programs",
            "internship_programs", "placements", "student-placements",
        ],
        "required_any": ["title", "name", "role", "position"],
    },
    "apprenticeships": {
        "aliases": [
            "apprenticeship", "apprenticeships", "traineeships",
            "trainee-programs", "trainee_programs",
        ],
        "required_any": ["title", "name", "program", "programme"],
    },
    "fellowships": {
        "aliases": [
            "fellowship", "fellowships", "graduate-programs",
            "graduate_programs", "residency-programs",
        ],
        "required_any": ["title", "name", "program", "programme"],
    },
    "career_services": {
        "aliases": [
            "career-service", "career-services", "career_services",
            "career-counselling", "career_counselling",
            "career-guidance", "career_guidance",
            "job-assistance", "job_assistance",
            "placement-services", "placement_services",
            "recruitment-services", "recruitment_services",
        ],
        "required_any": ["name", "title", "service"],
    },
    "recruitment": {
        "aliases": [
            "recruitment", "recruitments", "recruitment-agencies",
            "recruitment_agencies", "staffing", "staffing-agencies",
            "staffing_agencies", "placement-agencies",
        ],
        "required_any": ["name", "title", "agency", "service"],
    },
    "career_resources": {
        "aliases": [
            "career-resources", "career_resources", "job-search",
            "job_search", "resume", "resumes", "cv", "cvs",
            "interview-preparation", "interview_preparation",
            "portfolios", "portfolio-guides", "portfolio_guides",
        ],
        "required_any": ["name", "title", "topic", "resource"],
    },
    "examinations": {
        "aliases": [
            "career-exams", "career_exams", "job-exams",
            "job_exams", "competitive-exams", "competitive_exams",
            "government-exams", "government_exams",
            "professional-exams", "professional_exams",
        ],
        "required_any": ["name", "title", "exam", "examination"],
    },
    "scholarships": {
        "aliases": [
            "career-scholarships", "career_scholarships",
            "professional-scholarships", "professional_scholarships",
            "training-scholarships",
        ],
        "required_any": ["name", "title", "scholarship"],
    },
    "work_arrangements": {
        "aliases": [
            "work-arrangements", "work_arrangements",
            "remote-jobs", "remote_jobs", "freelancing",
            "freelance", "self-employment", "self_employment",
            "entrepreneurship", "gig-work", "gig_work",
        ],
        "required_any": ["name", "title", "type", "arrangement"],
    },
    "experience_levels": {
        "aliases": [
            "experience-levels", "experience_levels",
            "seniority-levels", "seniority_levels",
            "experience", "seniority",
        ],
        "required_any": ["name", "title", "level"],
    },
    "career_faqs": {
        "aliases": [
            "career-faq", "career-faqs", "career_faqs",
            "employment-faqs", "employment_faqs",
            "job-faqs", "job_faqs",
        ],
        "required_any": ["question", "title", "name"],
    },
    "career_locations": {
        "aliases": [
            "career-locations", "career_locations",
            "job-locations", "job_locations",
            "employment-locations", "employment_locations",
            "job-markets", "job_markets",
        ],
        "required_any": ["name", "title", "location", "city", "country"],
    },
}
FIELD_ALIASES = {
    "id": ["id", "uuid", "record_id", "career_id", "job_id", "code"],
    "title": ["title", "name", "career", "occupation", "job_title"],
    "description": ["description", "summary", "overview", "details"],
    "url": ["url", "link", "website", "source_url"],
    "country": ["country", "country_name", "nation"],
    "currency": ["currency", "currency_code"],
    "industry": ["industry", "sector", "industry_name"],
    "category": ["category", "job_category", "career_category"],
    "skills": ["skills", "required_skills", "competencies"],
    "qualifications": [
        "qualifications", "education", "requirements",
        "educational_requirements",
    ],
    "salary": ["salary", "salary_range", "compensation", "pay"],
    "employer": ["employer", "company", "organization", "organisation"],
    "employment_type": [
        "employment_type", "job_type", "work_type", "contract_type",
    ],
    "experience_level": [
        "experience_level", "seniority", "career_level", "level",
    ],
    "location": ["location", "city", "region", "work_location"],
    "status": ["status", "publication_status", "record_status"],
}
URL_FIELDS = {
    "url", "website", "apply_url", "application_url", "source_url",
    "official_url", "course_url", "provider_url",
}
class ImportErrorReport(Exception):
    """Raised when an input file cannot be imported."""
def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()
def normalized_key(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[\s_]+", "-", value)
    value = re.sub(r"[^a-z0-9-]", "", value)
    return value.strip("-")
def stable_id(dataset: str, record: dict[str, Any]) -> str:
    """Generate a repeatable ID from dataset and record content."""
    preferred = (
        "title", "name", "career", "occupation", "job_title",
        "company", "employer", "question", "code",
    )
    for key in preferred:
        value = record.get(key)
        if isinstance(value, (str, int, float)) and str(value).strip():
            slug = normalized_key(str(value))[:70]
            if slug:
                return f"{dataset}-{slug}"
    encoded = json.dumps(
        record, sort_keys=True, ensure_ascii=False, default=str
    ).encode("utf-8")
    digest = hashlib.sha256(encoded).hexdigest()[:16]
    return f"{dataset}-{digest}"
def classify_dataset(path: Path) -> str | None:
    """Infer dataset type from the filename, excluding its extension."""
    stem = normalized_key(path.stem)
    matches: list[tuple[int, str]] = []
    for dataset, config in DATASETS.items():
        for alias in config["aliases"]:
            normalized_alias = normalized_key(alias)
            if stem == normalized_alias:
                matches.append((len(normalized_alias), dataset))
            elif (
                stem.startswith(normalized_alias + "-")
                or stem.endswith("-" + normalized_alias)
                or f"-{normalized_alias}-" in f"-{stem}-"
            ):
                matches.append((len(normalized_alias), dataset))
    if not matches:
        return None
    # Prefer the longest matching alias to avoid broad-name collisions.
    matches.sort(reverse=True)
    return matches[0][1]
def read_json(path: Path) -> list[Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ImportErrorReport(f"Cannot read JSON: {exc}") from exc
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("records", "items", "data", "results", "entries"):
            if isinstance(data.get(key), list):
                return data[key]
        return [data]
    raise ImportErrorReport("JSON root must be an object or array.")
def read_jsonl(path: Path) -> list[Any]:
    records: list[Any] = []
    try:
        with path.open("r", encoding="utf-8-sig") as stream:
            for line_number, line in enumerate(stream, 1):
                if not line.strip():
                    continue
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError as exc:
                    raise ImportErrorReport(
                        f"Invalid JSONL at line {line_number}: {exc.msg}"
                    ) from exc
    except OSError as exc:
        raise ImportErrorReport(str(exc)) from exc
    return records
def read_delimited(path: Path, delimiter: str) -> list[Any]:
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream, delimiter=delimiter)
            if not reader.fieldnames:
                raise ImportErrorReport("CSV/TSV has no header row.")
            return [
                {str(k).strip(): v for k, v in row.items() if k is not None}
                for row in reader
            ]
    except (OSError, csv.Error) as exc:
        raise ImportErrorReport(f"Cannot read delimited file: {exc}") from exc
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
    raise ImportErrorReport(f"Unsupported file type: {suffix}")
def is_empty(value: Any) -> bool:
    return value is None or (
        isinstance(value, str) and not value.strip()
    )
def find_alias_value(record: dict[str, Any], aliases: list[str]) -> Any:
    lookup = {str(key).strip().lower(): value for key, value in record.items()}
    for alias in aliases:
        value = lookup.get(alias.lower())
        if not is_empty(value):
            return value
    return None
def validate_url_fields(
    record: dict[str, Any],
    source: str,
    row_number: int,
) -> list[str]:
    issues: list[str] = []
    for key, value in record.items():
        if key.lower() not in URL_FIELDS or is_empty(value):
            continue
        if not isinstance(value, str):
            issues.append(f"{source} record {row_number}: {key} must be text.")
            continue
        parsed = urlparse(value.strip())
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            issues.append(
                f"{source} record {row_number}: {key} is not a valid "
                "absolute HTTP(S) URL."
            )
    return issues
def normalize_record(
    raw: Any,
    dataset: str,
    source: str,
    row_number: int,
) -> tuple[dict[str, Any] | None, list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not isinstance(raw, dict):
        return None, [
            f"{source} record {row_number}: expected an object, "
            f"received {type(raw).__name__}."
        ], warnings
    record = dict(raw)
    # Normalize common aliases without deleting original fields.
    for canonical, aliases in FIELD_ALIASES.items():
        if canonical not in record or is_empty(record.get(canonical)):
            value = find_alias_value(record, aliases)
            if value is not None:
                record[canonical] = value
    record_id = record.get("id")
    if is_empty(record_id):
        record["id"] = stable_id(dataset, record)
        warnings.append(
            f"{source} record {row_number}: generated ID {record['id']!r}."
        )
    else:
        record["id"] = str(record_id).strip()
    required_any = DATASETS[dataset]["required_any"]
    if not any(
        key in record and not is_empty(record[key])
        for key in required_any
    ):
        errors.append(
            f"{source} record {row_number}: dataset '{dataset}' requires "
            f"at least one populated field from {required_any}."
        )
    errors.extend(validate_url_fields(record, source, row_number))
    if "country" in record and isinstance(record["country"], str):
        record["country"] = record["country"].strip()
    if "currency" in record and isinstance(record["currency"], str):
        record["currency"] = record["currency"].strip().upper()
    record.setdefault("source_file", source)
    record.setdefault("imported_at", utc_now())
    return (record if not errors else None), errors, warnings
def collect_input_files(input_path: Path) -> list[Path]:
    if input_path.is_file():
        if input_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            raise ImportErrorReport(
                f"Unsupported input file: {input_path}"
            )
        return [input_path]
    if not input_path.is_dir():
        raise ImportErrorReport(f"Input path does not exist: {input_path}")
    files = [
        path for path in input_path.rglob("*")
        if path.is_file()
        and path.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    return sorted(files)
def write_json(path: Path, data: Any, overwrite: bool) -> None:
    if path.exists() and not overwrite:
        raise FileExistsError(
            f"Output exists: {path}. Use --overwrite to replace it."
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    try:
        temporary.write_text(
            json.dumps(data, ensure_ascii=False, indent=2, default=str) + "\n",
            encoding="utf-8",
        )
        if path.exists() and not overwrite:
            raise FileExistsError(f"Output appeared during import: {path}")
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import the MedOrbits career and employment ecosystem."
    )
    parser.add_argument(
        "input",
        type=Path,
        help="Input JSON/JSONL/CSV/TSV file or directory.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/imported/career"),
        help="Output directory (default: data/imported/career).",
    )
    parser.add_argument(
        "--dataset",
        choices=sorted(DATASETS),
        help="Explicit dataset type for a single input file.",
    )
    parser.add_argument(
        "--all-related",
        action="store_true",
        help="Import all recognized career-related datasets recursively.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow replacing existing output files.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and report without writing dataset files.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat unknown dataset filenames as errors.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Optional report path; defaults to output/import-report.json.",
    )
    args = parser.parse_args()
    try:
        input_path = args.input.resolve()
        output_dir = args.output.resolve()
        files = collect_input_files(input_path)
        if not files:
            print("ERROR: No supported input files found.", file=sys.stderr)
            return 2
        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
        report: dict[str, Any] = {
            "schema_version": "1.0.0",
            "tool": "MedOrbits Career Ecosystem Importer",
            "tool_version": VERSION,
            "generated_at": utc_now(),
            "input": str(input_path),
            "output": str(output_dir),
            "dry_run": args.dry_run,
            "files": [],
            "datasets": {},
            "errors": [],
            "warnings": [],
            "summary": {
                "files_found": len(files),
                "files_processed": 0,
                "records_read": 0,
                "records_imported": 0,
                "records_rejected": 0,
                "duplicate_ids": 0,
            },
        }
        seen_ids: dict[str, set[str]] = defaultdict(set)
        for file_path in files:
            dataset = args.dataset if args.dataset and input_path.is_file() \
                else classify_dataset(file_path)
            if dataset is None:
                message = (
                    f"Cannot classify dataset from filename: {file_path.name}. "
                    "Rename it to a recognized dataset name or use --dataset."
                )
                if args.strict or args.all_related:
                    report["errors"].append(message)
                else:
                    report["warnings"].append(message)
                continue
            if not args.all_related and input_path.is_dir() and not args.dataset:
                # Directory imports automatically include recognized related datasets.
                pass
            file_report = {
                "source": str(file_path),
                "dataset": dataset,
                "records_read": 0,
                "records_imported": 0,
                "records_rejected": 0,
                "errors": [],
                "warnings": [],
            }
            try:
                raw_records = read_records(file_path)
            except ImportErrorReport as exc:
                file_report["errors"].append(str(exc))
                report["errors"].append(str(exc))
                report["files"].append(file_report)
                continue
            file_report["records_read"] = len(raw_records)
            report["summary"]["records_read"] += len(raw_records)
            report["summary"]["files_processed"] += 1
            for row_number, raw in enumerate(raw_records, 1):
                record, errors, warnings = normalize_record(
                    raw, dataset, str(file_path), row_number
                )
                file_report["errors"].extend(errors)
                file_report["warnings"].extend(warnings)
                report["errors"].extend(errors)
                report["warnings"].extend(warnings)
                if record is None:
                    file_report["records_rejected"] += 1
                    report["summary"]["records_rejected"] += 1
                    continue
                record_id = record["id"]
                if record_id in seen_ids[dataset]:
                    message = (
                        f"{file_path} record {row_number}: duplicate ID "
                        f"{record_id!r} in dataset '{dataset}'."
                    )
                    file_report["errors"].append(message)
                    report["errors"].append(message)
                    file_report["records_rejected"] += 1
                    report["summary"]["records_rejected"] += 1
                    report["summary"]["duplicate_ids"] += 1
                    continue
                seen_ids[dataset].add(record_id)
                grouped[dataset].append(record)
                file_report["records_imported"] += 1
                report["summary"]["records_imported"] += 1
            report["files"].append(file_report)
        # Check basic references between imported datasets.
        available_ids = {
            dataset: {str(record.get("id")) for record in records}
            for dataset, records in grouped.items()
        }
        reference_fields = {
            "career_id": "careers",
            "job_id": "job_listings",
            "job_role_id": "job_roles",
            "employer_id": "employers",
            "industry_id": "industries",
            "course_id": "courses",
            "qualification_id": "qualifications",
            "certification_id": "certifications",
            "category_id": "job_categories",
            "skill_id": "skills",
        }
        for dataset, records in grouped.items():
            for record in records:
                for field, target_dataset in reference_fields.items():
                    value = record.get(field)
                    if is_empty(value):
                        continue
                    values = value if isinstance(value, list) else [value]
                    target_ids = available_ids.get(target_dataset, set())
                    # References to datasets not included in this import
                    # cannot be conclusively validated.
                    if not target_ids:
                        continue
                    for reference in values:
                        if str(reference) not in target_ids:
                            report["warnings"].append(
                                f"Dataset '{dataset}', ID {record['id']!r}: "
                                f"{field} references {reference!r}, which was "
                                f"not found in imported dataset '{target_dataset}'."
                            )
        for dataset, records in sorted(grouped.items()):
            report["datasets"][dataset] = {
                "records": len(records),
                "output": str(output_dir / f"{dataset}.json"),
            }
        if not args.dry_run:
            # Preflight all output files before writing any dataset.
            output_files = [
                output_dir / f"{dataset}.json"
                for dataset in grouped
            ]
            report_path = (
                args.report.resolve()
                if args.report
                else output_dir / "import-report.json"
            )
            if report_path in output_files:
                raise ImportErrorReport(
                    "Report path conflicts with a dataset output path."
                )
            if not args.overwrite:
                conflicts = [
                    str(path) for path in output_files + [report_path]
                    if path.exists()
                ]
                if conflicts:
                    raise ImportErrorReport(
                        "Output files already exist; use --overwrite:\n  "
                        + "\n  ".join(conflicts)
                    )
            for dataset, records in sorted(grouped.items()):
                write_json(
                    output_dir / f"{dataset}.json",
                    {
                        "metadata": {
                            "schemaVersion": "1.0.0",
                            "dataset": dataset,
                            "generatedAt": utc_now(),
                            "recordCount": len(records),
                            "sourceTool": "import_career.py",
                        },
                        "records": records,
                    },
                    overwrite=args.overwrite,
                )
            report_path.parent.mkdir(parents=True, exist_ok=True)
            write_json(report_path, report, overwrite=args.overwrite)
            print(f"Import report: {report_path}")
        else:
            print("DRY RUN: no files were written.")
        print("\nCareer ecosystem import summary")
        print("--------------------------------")
        print(f"Files found:       {report['summary']['files_found']}")
        print(f"Files processed:   {report['summary']['files_processed']}")
        print(f"Records read:      {report['summary']['records_read']}")
        print(f"Records imported:  {report['summary']['records_imported']}")
        print(f"Records rejected:  {report['summary']['records_rejected']}")
        print(f"Duplicate IDs:     {report['summary']['duplicate_ids']}")
        print(f"Datasets:          {len(grouped)}")
        print(f"Errors:            {len(report['errors'])}")
        print(f"Warnings:          {len(report['warnings'])}")
        if report["errors"]:
            return 1
        return 0
    except (ImportErrorReport, OSError, FileExistsError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
if __name__ == "__main__":
    raise SystemExit(main())

# Usage
#
# # Import one career dataset
# python /python/scripts/import_career.py ./data/careers.json
# # Import every recognized related dataset in a directory
# python /python/scripts/import_career.py ./data --all-related \
#   --output ./data/imported/career
# # Explicitly identify an input file
# python /python/scripts/import_career.py ./data/my-career-data.csv \
#   --dataset careers
# # Validate without writing files
# python /python/scripts/import_career.py ./data --all-related --dry-run
# # Replace previously generated output files
# python /python/scripts/import_career.py ./data --all-related \
#   --output ./data/imported/career --overwrite
#
# # Expected output structure
# #
# # data/imported/career/
# # ├── careers.json
# # ├── job_categories.json
# # ├── job_roles.json
# # ├── job_listings.json
# # ├── industries.json
# # ├── employers.json
# # ├── skills.json
# # ├── qualifications.json
# # ├── courses.json
# # ├── certifications.json
# # ├── career_pathways.json
# # ├── salary_data.json
# # ├── internships.json
# # ├── apprenticeships.json
# # ├── fellowships.json
# # ├── career_services.json
# # ├── recruitment.json
# # ├── career_resources.json
# # ├── examinations.json
# # ├── scholarships.json
# # ├── work_arrangements.json
# # ├── experience_levels.json
# # ├── career_faqs.json
# # ├── career_locations.json
# # └── import-report.json
# #
# # Only datasets with recognized input files are generated. The importer does not fabricate missing records, salaries, job openings, or employer information.
# #
# # Important: this is a general-purpose importer, not a guarantee that every MedOrbits JSON schema will match it exactly. Review the report and adapt field requirements to your existing schemas before using it in production.
