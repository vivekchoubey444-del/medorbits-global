
#!/usr/bin/env python3
"""Validate MedOrbits JSON datasets in assets/data.

Checks:
- JSON syntax and UTF-8 encoding
- Duplicate record IDs and slugs
- Configured cross-file references
- Verification-field consistency
- Date formats and application date ordering
- Warnings for zero-valued financial amounts
- Expected dataset files

Exit codes:
0: Validation passed; warnings are non-blocking.
1: Validation failed.
"""

import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATA_DIR = ROOT_DIR / "assets" / "data"

SKIP_KEYS = {
    "fieldDefinitions",
    "fields",
    "allowedValues",
    "dataRules",
    "displayRules",
    "metadata",
    "workflow",
    "pagination",
    "relationships",
}

DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")

DATE_FIELDS = {
    "createdAt",
    "updatedAt",
    "publishedAt",
    "expiresAt",
    "startsAt",
    "endsAt",
    "moderatedAt",
    "lastCheckedAt",
}

AMOUNT_FIELDS = (
    "amount",
    "awardAmount",
    "stipendAmount",
    "totalAnnualFee",
    "totalCourseFee",
)

COLLECTIONS = {
    "courses.json": ("courses", "course"),
    "entrance-exams.json": ("exams", "exam"),
    "documents.json": ("documents", "document"),
    "faqs.json": ("faqs", "faq"),
    "universities.json": ("universities", "institution"),
    "scholarships.json": ("scholarships", "scholarship"),
    "recruitment.json": ("recruitments", "recruitment"),
    "jobs.json": ("jobs", "job"),
    "news.json": ("news", "news"),
    "admissions.json": ("admissions", "admission"),
}

REF_FIELDS = {
    "course": {
        "courseId",
        "courseIds",
        "relatedCourseId",
        "relatedCourseIds",
        "typicalCourseIds",
    },
    "exam": {
        "examId",
        "examIds",
        "relatedExamIds",
    },
    "document": {
        "requiredDocumentIds",
        "typicalDocumentIds",
        "commonDocumentIds",
    },
    "faq": {"relatedFaqIds"},
    "state": {"stateId", "stateIds"},
}

EXPECTED_FILES = [
    "admission-process.json",
    "admissions.json",
    "career-options.json",
    "categories.json",
    "colleges.json",
    "countries.json",
    "courses.json",
    "documents.json",
    "entrance-exams.json",
    "faqs.json",
    "fees.json",
    "hostels.json",
    "internships.json",
    "jobs.json",
    "locations.json",
    "news.json",
    "notifications.json",
    "recruitment.json",
    "scholarships.json",
    "sectors.json",
    "services.json",
    "testimonials.json",
    "universities.json",
]

errors = []
warnings = []
docs = {}
DATA_DIR = DEFAULT_DATA_DIR


def relative_path(path):
    """Return a repository-relative path where possible."""
    try:
        return path.resolve().relative_to(ROOT_DIR).as_posix()
    except ValueError:
        return path.as_posix()


def err(filename, message):
    errors.append(f"{filename}: {message}")


def warn(filename, message):
    warnings.append(f"{filename}: {message}")


def walk(node, skip=True):
    """Yield dictionaries recursively, optionally skipping schema metadata."""
    if isinstance(node, dict):
        yield node
        for key, value in node.items():
            if skip and key in SKIP_KEYS:
                continue
            yield from walk(value, skip)
    elif isinstance(node, list):
        for value in node:
            yield from walk(value, skip)


def load_json_files():
    """Load top-level JSON datasets and report decoding or parsing errors."""
    try:
        paths = sorted(DATA_DIR.glob("*.json"))
    except OSError as error:
        err(relative_path(DATA_DIR), f"cannot list directory: {error}")
        return

    for file_path in paths:
        filename = file_path.name

        if file_path.is_symlink() or not file_path.is_file():
            continue

        try:
            raw = file_path.read_bytes()

            if raw.startswith(b"\xef\xbb\xbf"):
                err(filename, "UTF-8 BOM detected; save as UTF-8 without BOM")
                continue

            text = raw.decode("utf-8", errors="strict")
            docs[filename] = json.loads(text)
            print(f"OK    {filename}")

        except (json.JSONDecodeError, UnicodeDecodeError, OSError) as error:
            err(filename, f"cannot parse: {error}")


def validate_location_ids(ids):
    """Collect state and country IDs from locations.json."""
    document = docs.get("locations.json")

    if document is None:
        return

    if not isinstance(document, dict):
        err("locations.json", "top-level JSON value must be an object")
        return

    for collection_key, kind in (
        ("states", "state"),
        ("countries", "country"),
    ):
        records = document.get(collection_key, [])

        if not isinstance(records, list):
            err("locations.json", f"'{collection_key}' must be an array")
            continue

        seen = set()

        for index, record in enumerate(records):
            if not isinstance(record, dict):
                err(
                    "locations.json",
                    f"non-object record in '{collection_key}' at index {index}",
                )
                continue

            record_id = record.get("id")

            if not isinstance(record_id, str) or not record_id.strip():
                err(
                    "locations.json",
                    f"record in '{collection_key}' has no valid string id",
                )
                continue

            if record_id in seen:
                err(
                    "locations.json",
                    f"duplicate id {record_id!r} in '{collection_key}'",
                )
            else:
                seen.add(record_id)
                ids[kind].add(record_id)


def validate_collections():
    """Validate configured collection arrays, IDs, and slugs."""
    ids = {
        "course": set(),
        "exam": set(),
        "document": set(),
        "faq": set(),
        "institution": set(),
        "scholarship": set(),
        "recruitment": set(),
        "job": set(),
        "news": set(),
        "admission": set(),
        "state": set(),
        "country": set(),
    }

    for filename, (collection_key, kind) in COLLECTIONS.items():
        document = docs.get(filename)

        if document is None:
            continue

        if not isinstance(document, dict):
            err(filename, "top-level JSON value must be an object")
            continue

        records = document.get(collection_key)

        if not isinstance(records, list):
            err(filename, f"top-level '{collection_key}' array missing")
            continue

        seen_ids = set()
        seen_slugs = set()

        for index, record in enumerate(records):
            if not isinstance(record, dict):
                err(
                    filename,
                    f"non-object record in '{collection_key}' at index {index}",
                )
                continue

            record_id = record.get("id")

            if not isinstance(record_id, str) or not record_id.strip():
                err(
                    filename,
                    f"record at index {index} has no non-empty string id",
                )
            elif record_id in seen_ids:
                err(filename, f"duplicate id {record_id!r}")
            else:
                seen_ids.add(record_id)
                ids[kind].add(record_id)

            slug = record.get("slug")

            if slug is not None and slug != "":
                if not isinstance(slug, str):
                    err(filename, f"non-string slug on record {record_id!r}")
                elif slug in seen_slugs:
                    err(filename, f"duplicate slug {slug!r}")
                else:
                    seen_slugs.add(slug)

    validate_location_ids(ids)
    return ids


def validate_references(ids):
    """Validate configured cross-file references."""
    for filename, document in docs.items():
        for record in walk(document):
            for kind, fields in REF_FIELDS.items():
                for field in fields.intersection(record):
                    value = record[field]
                    values = value if isinstance(value, list) else [value]

                    for reference in values:
                        if reference is None or reference == "":
                            continue

                        if not isinstance(reference, str):
                            err(
                                filename,
                                f"{field} must contain string IDs",
                            )
                            continue

                        if reference not in ids[kind]:
                            err(
                                filename,
                                f"{field} references unknown "
                                f"{kind} {reference!r}",
                            )


def validate_verification(filename, record):
    """Check verification metadata consistency."""
    record_id = record.get("id", "")

    if "verifiedAt" in record or "verifiedBy" in record:
        if bool(record.get("verifiedAt")) != bool(record.get("verifiedBy")):
            err(
                filename,
                f"verifiedAt/verifiedBy must be set together on {record_id}",
            )

    if (
        record.get("verificationStatus") == "verified"
        and not record.get("verifiedAt")
    ):
        err(
            filename,
            f"{record_id} is marked verified without verifiedAt",
        )


def validate_dates(filename, record):
    """Validate date-like fields and application date ordering."""
    record_id = record.get("id", "")

    for key, value in record.items():
        if (
            not key.endswith(("Start", "End", "Date", "At"))
            or key in DATE_FIELDS
            or not isinstance(value, str)
            or not value
        ):
            continue

        if DATE_PATTERN.fullmatch(value):
            try:
                date.fromisoformat(value)
            except ValueError:
                err(
                    filename,
                    f"{key} on {record_id} is not a valid calendar date: "
                    f"{value!r}",
                )
        elif "T" not in value:
            warn(
                filename,
                f"{key} on {record_id} is not YYYY-MM-DD: {value!r}",
            )

    start = record.get("applicationStart")
    end = record.get("applicationEnd")

    if isinstance(start, str) and isinstance(end, str):
        if DATE_PATTERN.fullmatch(start) and DATE_PATTERN.fullmatch(end):
            try:
                start_date = date.fromisoformat(start)
                end_date = date.fromisoformat(end)

                if end_date < start_date:
                    err(
                        filename,
                        f"applicationEnd before applicationStart on {record_id}",
                    )
            except ValueError:
                # Invalid calendar dates are reported by the field checks.
                pass


def validate_amounts(filename, record):
    """Warn about zero-valued amounts that may represent unknown values."""
    record_id = record.get("id", "")

    for field in AMOUNT_FIELDS:
        amount = record.get(field)

        if (
            isinstance(amount, (int, float))
            and not isinstance(amount, bool)
            and amount == 0
        ):
            warn(
                filename,
                f"{field}=0 on {record_id} "
                "(confirm that zero means free, not unknown)",
            )


def validate_records():
    """Run verification, date, and amount checks across loaded datasets."""
    for filename, document in docs.items():
        for record in walk(document):
            validate_verification(filename, record)
            validate_dates(filename, record)
            validate_amounts(filename, record)


def validate_expected_files():
    """Warn when documented dataset files are not present."""
    try:
        present = {
            item.name
            for item in DATA_DIR.glob("*.json")
            if item.is_file() and not item.is_symlink()
        }
    except OSError as error:
        err(relative_path(DATA_DIR), f"cannot list expected files: {error}")
        return

    for filename in EXPECTED_FILES:
        if filename not in present:
            warn(filename, "expected dataset file not found")


def print_summary():
    """Print warnings, errors, and the final validation result."""
    print()

    for message in warnings:
        print(f"WARN  {message}")

    for message in errors:
        print(f"ERROR {message}")

    print(
        f"\n{len(docs)} files loaded, "
        f"{len(errors)} errors, "
        f"{len(warnings)} warnings"
    )

    if errors:
        print("MedOrbits dataset validation FAILED.")
    else:
        print("MedOrbits dataset validation PASSED.")


def main():
    """Run all dataset validation checks."""
    global DATA_DIR

    if len(sys.argv) > 2:
        print(
            "Usage: python scripts/validate-data.py [data-directory]",
            file=sys.stderr,
        )
        return 1

    if len(sys.argv) > 1:
        supplied_path = Path(sys.argv[1]).expanduser()
        DATA_DIR = (
            supplied_path if supplied_path.is_absolute()
            else Path.cwd() / supplied_path
        ).resolve()

    if not DATA_DIR.is_dir():
        print(
            f"ERROR: Data directory not found: {DATA_DIR}",
            file=sys.stderr,
        )
        return 1

    print(f"MedOrbits dataset validation: {DATA_DIR}")

    load_json_files()
    ids = validate_collections()
    validate_references(ids)
    validate_records()
    validate_expected_files()
    print_summary()

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
