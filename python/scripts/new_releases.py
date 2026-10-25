/python/scripts/new_releases.py

#!/usr/bin/env python3
"""
MedOrbits New Releases Manager
==============================
Discovers new records from configured datasets and optional public feeds,
then publishes a JSON release feed for the MedOrbits homepage and related
pages.
Release categories include:
    - Colleges and universities
    - Courses and academic programmes
    - Admissions and application guides
    - Entrance examinations
    - Jobs, careers and internships
    - Scholarships and fellowships
    - Certifications and training
    - Career resources and services
    - New website features and platform tools
    - News, announcements and other content
Features:
    - JSON, JSONL, CSV, TSV and RSS/Atom support
    - Recursive dataset discovery
    - Release deduplication using stable fingerprints
    - Persistent release history
    - Configurable release windows and limits
    - Homepage-ready JSON output
    - Dry-run mode
    - No overwrite by default
    - Standard-library only
Python: 3.10+
Typical usage:
    python /python/scripts/new_releases.py ./data
    python /python/scripts/new_releases.py ./data --dry-run
    python /python/scripts/new_releases.py ./data --output ./assets/data/new-releases.json
    python /python/scripts/new_releases.py ./data --days 30 --limit 50
    python /python/scripts/new_releases.py ./data --overwrite
Optional configuration:
    config/new_releases.json
Default outputs:
    assets/data/new-releases.json
    data/state/new-releases-history.json
This tool does not invent release dates or claim that a record is newly
published unless it can establish that from the supplied source or history.
Records without dates are treated as newly discovered, not necessarily
newly published.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
VERSION = "1.0.0"
SUPPORTED_EXTENSIONS = {
    ".json", ".jsonl", ".ndjson", ".csv", ".tsv"
}
DATE_FIELDS = (
    "release_date",
    "published_at",
    "publishedAt",
    "published",
    "created_at",
    "createdAt",
    "date_published",
    "date",
    "updated_at",
    "updatedAt",
    "releaseDate",
)
TITLE_FIELDS = (
    "title",
    "name",
    "course_name",
    "college_name",
    "university_name",
    "job_title",
    "headline",
    "label",
)
DESCRIPTION_FIELDS = (
    "description",
    "summary",
    "excerpt",
    "details",
    "short_description",
    "message",
)
URL_FIELDS = (
    "url",
    "link",
    "website",
    "official_url",
    "apply_url",
    "course_url",
    "source_url",
)
CATEGORY_RULES = {
    "colleges": (
        "college", "colleges", "medical-colleges", "institutions"
    ),
    "universities": (
        "university", "universities"
    ),
    "courses": (
        "course", "courses", "programmes", "programs",
        "degrees", "academic-programmes"
    ),
    "admissions": (
        "admission", "admissions", "admission-guides",
        "counselling", "counseling", "applications"
    ),
    "examinations": (
        "exam", "exams", "examinations", "entrance-exams",
        "entrance_exams"
    ),
    "jobs": (
        "job", "jobs", "job-listings", "vacancies", "openings"
    ),
    "careers": (
        "career", "careers", "career-options", "career-pathways",
        "career-resources"
    ),
    "internships": (
        "internship", "internships", "apprenticeships", "fellowships"
    ),
    "scholarships": (
        "scholarship", "scholarships", "grants", "financial-aid"
    ),
    "certifications": (
        "certification", "certifications", "certificates", "training"
    ),
    "news": (
        "news", "announcements", "notifications", "updates"
    ),
    "features": (
        "feature", "features", "releases", "changelog", "platform-updates"
    ),
    "resources": (
        "resource", "resources", "guides", "articles", "faqs"
    ),
}
def utc_now() -> datetime:
    return datetime.now(timezone.utc)
def iso_now() -> str:
    return utc_now().isoformat()
def clean_text(value: Any, limit: int = 700) -> str:
    if value is None:
        return ""
    value = re.sub(r"<[^>]*>", " ", str(value))
    return re.sub(r"\s+", " ", value).strip()[:limit]
def get_first(record: dict[str, Any], fields: tuple[str, ...]) -> Any:
    for field in fields:
        value = record.get(field)
        if value is not None and str(value).strip():
            return value
    return None
def parse_date(value: Any) -> datetime | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(value, tz=timezone.utc)
        text = str(value).strip()
        try:
            result = datetime.fromisoformat(
                text.replace("Z", "+00:00")
            )
        except ValueError:
            result = parsedate_to_datetime(text)
        if result.tzinfo is None:
            result = result.replace(tzinfo=timezone.utc)
        return result.astimezone(timezone.utc)
    except (ValueError, TypeError, OverflowError, OSError):
        return None
def canonical_url(value: Any) -> str:
    if not value:
        return ""
    if isinstance(value, dict):
        value = value.get("url") or value.get("href")
    if not isinstance(value, str):
        return ""
    value = value.strip()
    try:
        parsed = urllib.parse.urlsplit(value)
        if parsed.scheme.lower() not in {"https", "http"}:
            return ""
        if not parsed.hostname:
            return ""
        return urllib.parse.urlunsplit((
            parsed.scheme.lower(),
            parsed.netloc.lower(),
            parsed.path.rstrip("/") or "/",
            parsed.query,
            "",
        ))
    except ValueError:
        return ""
def normalize_category(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    for category, aliases in CATEGORY_RULES.items():
        for alias in aliases:
            if normalized == alias or normalized.startswith(alias + "-"):
                return category
    return normalized or "general"
def infer_category(path: Path, record: dict[str, Any]) -> str:
    explicit = get_first(
        record,
        ("release_category", "category", "content_type", "type", "dataset")
    )
    if explicit:
        return normalize_category(str(explicit))
    stem = re.sub(r"[^a-z0-9]+", "-", path.stem.lower()).strip("-")
    return normalize_category(stem)
def read_json(path: Path) -> list[Any]:
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("records", "items", "results", "entries", "data"):
            if isinstance(data.get(key), list):
                return data[key]
        return [data]
    raise ValueError("JSON root must be an object or array.")
def read_jsonl(path: Path) -> list[Any]:
    records = []
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
    return records
def read_table(path: Path, delimiter: str) -> list[Any]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream, delimiter=delimiter)
        if not reader.fieldnames:
            raise ValueError("Missing CSV/TSV header.")
        return [
            {str(key).strip(): value for key, value in row.items()
             if key is not None}
            for row in reader
        ]
def read_xml_feed(path: Path) -> list[Any]:
    root = ET.fromstring(path.read_bytes())
    records = []
    for element in root.iter():
        tag = element.tag.rsplit("}", 1)[-1].lower()
        if tag not in {"item", "entry"}:
            continue
        record: dict[str, Any] = {}
        for child in list(element):
            key = child.tag.rsplit("}", 1)[-1].lower()
            value = child.text or ""
            if key == "link":
                record["url"] = child.attrib.get("href") or value.strip()
            elif key in {
                "title", "description", "summary", "published",
                "updated", "pubdate", "id", "guid",
            }:
                record[key] = value.strip()
        records.append(record)
    return records
def read_local_records(path: Path) -> list[Any]:
    suffix = path.suffix.lower()
    if suffix == ".json":
        return read_json(path)
    if suffix in {".jsonl", ".ndjson"}:
        return read_jsonl(path)
    if suffix == ".csv":
        return read_table(path, ",")
    if suffix == ".tsv":
        return read_table(path, "\t")
    if suffix in {".xml", ".rss", ".atom"}:
        return read_xml_feed(path)
    raise ValueError(f"Unsupported file type: {suffix}")
def stable_fingerprint(
    category: str,
    record: dict[str, Any],
    title: str,
    url: str,
) -> str:
    identity = (
        record.get("id")
        or record.get("uuid")
        or record.get("slug")
        or url
        or title.lower()
    )
    raw = f"{category}|{identity}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:32]
def normalize_release(
    path: Path,
    record: Any,
) -> dict[str, Any] | None:
    if not isinstance(record, dict):
        return None
    title = clean_text(get_first(record, TITLE_FIELDS), 220)
    if not title:
        return None
    description = clean_text(get_first(record, DESCRIPTION_FIELDS), 700)
    url = canonical_url(get_first(record, URL_FIELDS))
    category = infer_category(path, record)
    date_value = get_first(record, DATE_FIELDS)
    published = parse_date(date_value)
    record_id = record.get("id") or record.get("uuid") or record.get("slug")
    fingerprint = stable_fingerprint(
        category,
        record,
        title,
        url,
    )
    return {
        "id": fingerprint,
        "sourceRecordId": str(record_id) if record_id is not None else None,
        "title": title,
        "description": description,
        "category": category,
        "url": url,
        "sourceFile": path.name,
        "publishedAt": published.isoformat() if published else None,
        "dateVerified": published is not None,
        "firstDiscoveredAt": iso_now(),
    }
def load_json_file(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Cannot read {path}: {exc}") from exc
def atomic_write_json(path: Path, data: Any, overwrite: bool) -> None:
    if path.exists() and not overwrite:
        raise FileExistsError(
            f"Output already exists: {path}. Use --overwrite."
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    try:
        temporary.write_text(
            json.dumps(data, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        if path.exists() and not overwrite:
            raise FileExistsError(f"Output appeared during write: {path}")
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()
def discover_files(input_path: Path) -> list[Path]:
    if input_path.is_file():
        if input_path.suffix.lower() in SUPPORTED_EXTENSIONS | {
            ".xml", ".rss", ".atom"
        }:
            return [input_path]
        raise ValueError(f"Unsupported input: {input_path}")
    if not input_path.is_dir():
        raise ValueError(f"Input path does not exist: {input_path}")
    excluded = {
        ".git", "node_modules", "__pycache__", ".venv",
        "venv", "dist", "build",
    }
    return sorted(
        path for path in input_path.rglob("*")
        if path.is_file()
        and path.suffix.lower() in SUPPORTED_EXTENSIONS | {
            ".xml", ".rss", ".atom"
        }
        and not any(part in excluded for part in path.relative_to(input_path).parts)
    )
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Discover and publish new MedOrbits releases."
    )
    parser.add_argument(
        "input",
        nargs="?",
        type=Path,
        default=Path("data"),
        help="File or directory containing source datasets.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("assets/data/new-releases.json"),
        help="Homepage-ready JSON output.",
    )
    parser.add_argument(
        "--history",
        type=Path,
        default=Path("data/state/new-releases-history.json"),
        help="Persistent release history.",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Include dated releases from the last N days.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Maximum number of releases in the public feed.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow replacing an existing output feed.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Discover and preview releases without writing.",
    )
    parser.add_argument(
        "--include-undated",
        action="store_true",
        help="Include undated records as newly discovered items.",
    )
    args = parser.parse_args()
    if args.days < 1:
        parser.error("--days must be at least 1.")
    if args.limit < 1:
        parser.error("--limit must be at least 1.")
    input_path = args.input.resolve()
    output_path = args.output.resolve()
    history_path = args.history.resolve()
    if output_path == history_path:
        print("ERROR: output and history paths must differ.", file=sys.stderr)
        return 2
    try:
        files = discover_files(input_path)
        if not files:
            print("ERROR: no supported source files found.", file=sys.stderr)
            return 2
        previous = load_json_file(history_path, {"seen": {}})
        seen_history = previous.get("seen", {})
        if not isinstance(seen_history, dict):
            raise ValueError("History file has an invalid 'seen' structure.")
        now = utc_now()
        cutoff = now - timedelta(days=args.days)
        all_records: list[dict[str, Any]] = []
        errors: list[dict[str, str]] = []
        records_read = 0
        for path in files:
            try:
                raw_records = read_local_records(path)
                records_read += len(raw_records)
                for raw in raw_records:
                    release = normalize_release(path, raw)
                    if release is None:
                        continue
                    published = parse_date(release["publishedAt"])
                    if published:
                        if published < cutoff or published > now:
                            continue
                    elif not args.include_undated:
                        continue
                    all_records.append(release)
            except (OSError, ValueError, json.JSONDecodeError) as exc:
                errors.append({
                    "file": str(path),
                    "error": str(exc),
                })
        # Deduplicate current records by fingerprint.
        unique: dict[str, dict[str, Any]] = {}
        for release in all_records:
            unique.setdefault(release["id"], release)
        all_records = list(unique.values())
        # Only items absent from history count as newly discovered.
        new_releases = [
            release for release in all_records
            if release["id"] not in seen_history
        ]
        new_releases.sort(
            key=lambda item: item.get("publishedAt") or "",
            reverse=True,
        )
        public_releases = new_releases[:args.limit]
        for release in all_records:
            seen_history.setdefault(
                release["id"],
                {
                    "title": release["title"],
                    "category": release["category"],
                    "firstDiscoveredAt": now.isoformat(),
                    "publishedAt": release["publishedAt"],
                    "sourceFile": release["sourceFile"],
                },
            )
        feed = {
            "schemaVersion": "1.0.0",
            "generatedAt": now.isoformat(),
            "tool": f"MedOrbits New Releases {VERSION}",
            "windowDays": args.days,
            "count": len(public_releases),
            "releases": public_releases,
            "categories": sorted({
                item["category"] for item in public_releases
            }),
            "sourceFilesProcessed": len(files) - len(errors),
            "sourceErrors": errors,
        }
        new_history = {
            "schemaVersion": "1.0.0",
            "updatedAt": now.isoformat(),
            "seen": seen_history,
        }
        print("\nMedOrbits New Releases")
        print("----------------------")
        print(f"Source files:       {len(files)}")
        print(f"Records read:       {records_read}")
        print(f"Valid records:      {len(all_records)}")
        print(f"Newly discovered:   {len(new_releases)}")
        print(f"Published in feed:  {len(public_releases)}")
        print(f"Source errors:      {len(errors)}")
        if public_releases:
            print("\nPreview:")
            for item in public_releases[:10]:
                print(f"- [{item['category']}] {item['title']}")
        if errors:
            for error in errors:
                print(
                    f"WARNING: {error['file']}: {error['error']}",
                    file=sys.stderr,
                )
        if args.dry_run:
            print("\nDRY RUN: no files were written.")
            print(json.dumps(feed, indent=2, ensure_ascii=False))
            return 1 if errors else 0
        # Preflight before writing either file.
        if not args.overwrite:
            conflicts = [
                str(path) for path in (output_path, history_path)
                if path.exists()
            ]
            if conflicts:
                print(
                    "ERROR: files already exist; use --overwrite:\n"
                    + "\n".join(conflicts),
                    file=sys.stderr,
                )
                return 2
        atomic_write_json(output_path, feed, overwrite=args.overwrite)
        atomic_write_json(
            history_path, new_history, overwrite=args.overwrite
        )
        print(f"\nRelease feed: {output_path}")
        print(f"History:      {history_path}")
        return 1 if errors else 0
    except (OSError, ValueError, FileExistsError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
if __name__ == "__main__":
    raise SystemExit(main())