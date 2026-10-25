/python/scripts/import_documents.py

#!/usr/bin/env python3
"""
MedOrbits Document Importer
===========================
Import document metadata and optionally copy approved document files into
a managed destination directory.
Supported metadata formats:
    JSON, JSONL, NDJSON, CSV, TSV
Supported document extensions:
    PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, ODT, ODS, ODP,
    RTF, TXT, MD, CSV, JSON, XML, PNG, JPG, JPEG, WEBP
Features:
    - Metadata import from structured files
    - Recursive document discovery
    - Optional copying of physical document files
    - File extension and size validation
    - SHA-256 checksums
    - Duplicate ID and content detection
    - Stable generated IDs
    - Manifest and import report
    - Dry-run mode
    - No overwrite by default
    - Standard-library only
Python: 3.10+
Examples:
    python import_documents.py ./data/documents --dry-run
    python import_documents.py ./data/documents --copy-files
    python import_documents.py ./data/document-index.json --dataset documents
    python import_documents.py ./data/documents --output ./assets/documents --copy-files
Security:
    - This script does not execute imported files.
    - It does not follow symbolic links during directory discovery.
    - File extensions are checked, but are not proof of file safety.
    - Scan imported documents with appropriate security software before
      making them publicly available.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
import mimetypes
import os
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
VERSION = "1.0.0"
METADATA_EXTENSIONS = {
    ".json", ".jsonl", ".ndjson", ".csv", ".tsv"
}
DOCUMENT_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".ppt", ".pptx", ".odt", ".ods", ".odp",
    ".rtf", ".txt", ".md", ".csv", ".json", ".xml",
    ".png", ".jpg", ".jpeg", ".webp",
}
DEFAULT_MAX_BYTES = 50 * 1024 * 1024
WRAPPER_KEYS = ("documents", "records", "items", "data", "results")
TITLE_FIELDS = (
    "title", "name", "document_name", "filename",
    "file_name", "label",
)
PATH_FIELDS = (
    "file_path", "filepath", "path", "local_path",
    "source_file", "filename", "file_name",
)
URL_FIELDS = (
    "url", "download_url", "document_url", "source_url",
    "official_url",
)
CATEGORY_FIELDS = (
    "category", "document_type", "type", "section",
)
def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()
def clean_text(value: Any, limit: int = 500) -> str:
    if value is None:
        return ""
    value = re.sub(r"<[^>]*>", " ", str(value))
    return re.sub(r"\s+", " ", value).strip()[:limit]
def normalize_slug(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "document"
def first_value(record: dict[str, Any], fields: tuple[str, ...]) -> Any:
    for field in fields:
        value = record.get(field)
        if value is not None and str(value).strip():
            return value
    return None
def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
def stable_id(record: dict[str, Any], title: str) -> str:
    existing = record.get("id") or record.get("uuid") or record.get("code")
    if existing is not None and str(existing).strip():
        return str(existing).strip()
    stable_source = (
        str(record.get("url") or ""),
        str(record.get("file_path") or record.get("filename") or ""),
        title.strip().lower(),
    )
    digest = hashlib.sha256(
        "|".join(stable_source).encode("utf-8")
    ).hexdigest()[:20]
    return f"doc-{normalize_slug(title)[:45]}-{digest}"
def read_json(path: Path) -> list[Any]:
    value = json.loads(path.read_text(encoding="utf-8-sig"))
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
    with path.open("r", encoding="utf-8-sig") as stream:
        for line_number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError(
                    f"Invalid JSONL line {line_number}: {exc.msg}"
                ) from exc
    return records
def read_delimited(path: Path, delimiter: str) -> list[Any]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream, delimiter=delimiter)
        if not reader.fieldnames:
            raise ValueError("Missing CSV/TSV header.")
        headers = [header.strip() for header in reader.fieldnames if header]
        if len(headers) != len(reader.fieldnames):
            raise ValueError("Empty CSV/TSV column name.")
        if len(headers) != len(set(headers)):
            raise ValueError("Duplicate CSV/TSV column names.")
        return [
            dict(row)
            for row in reader
            if any(value not in (None, "") for value in row.values())
        ]
def read_metadata(path: Path) -> list[Any]:
    suffix = path.suffix.lower()
    if suffix == ".json":
        return read_json(path)
    if suffix in {".jsonl", ".ndjson"}:
        return read_jsonl(path)
    if suffix == ".csv":
        return read_delimited(path, ",")
    if suffix == ".tsv":
        return read_delimited(path, "\t")
    raise ValueError(f"Unsupported metadata format: {suffix}")
def discover_files(root: Path, recursive: bool = True) -> list[Path]:
    if root.is_file():
        return [root] if root.suffix.lower() in DOCUMENT_EXTENSIONS else []
    if not root.is_dir():
        raise ValueError(f"Input path does not exist: {root}")
    excluded = {
        ".git", "node_modules", "__pycache__", ".venv",
        "venv", "dist", "build",
    }
    iterator = root.rglob("*") if recursive else root.glob("*")
    return sorted(
        path for path in iterator
        if path.is_file()
        and not path.is_symlink()
        and path.suffix.lower() in DOCUMENT_EXTENSIONS
        and not any(
            part in excluded
            for part in path.relative_to(root).parts
        )
    )
def validate_document_record(
    raw: Any,
    source: str,
    row_number: int,
) -> tuple[dict[str, Any] | None, list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not isinstance(raw, dict):
        return None, [
            f"{source}, record {row_number}: expected an object."
        ], warnings
    record = dict(raw)
    title = clean_text(first_value(record, TITLE_FIELDS), 250)
    if not title:
        errors.append(
            f"{source}, record {row_number}: missing document title/name."
        )
        return None, errors, warnings
    record["title"] = title
    record["id"] = stable_id(record, title)
    category = clean_text(
        first_value(record, CATEGORY_FIELDS) or "general",
        100,
    )
    record["category"] = category
    url = first_value(record, URL_FIELDS)
    if url:
        url = str(url).strip()
        if not url.lower().startswith(("https://", "http://")):
            errors.append(
                f"{source}, record {row_number}: invalid document URL."
            )
        else:
            record["url"] = url
    record.setdefault("description", "")
    record["description"] = clean_text(record["description"], 2000)
    record.setdefault("source_metadata", source)
    record.setdefault("imported_at", utc_now())
    if not first_value(record, PATH_FIELDS) and not url:
        warnings.append(
            f"{source}, record {row_number}: no local file or download URL."
        )
    if errors:
        return None, errors, warnings
    return record, errors, warnings
def atomic_write_json(path: Path, value: Any, overwrite: bool) -> None:
    if path.exists() and not overwrite:
        raise FileExistsError(
            f"File exists: {path}. Use --overwrite to replace it."
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    try:
        temporary.write_text(
            json.dumps(value, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        if path.exists() and not overwrite:
            raise FileExistsError(f"File appeared during write: {path}")
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()
def copy_document(
    source: Path,
    source_root: Path,
    destination_root: Path,
    max_bytes: int,
    overwrite: bool,
) -> dict[str, Any]:
    if source.is_symlink() or not source.is_file():
        raise ValueError("Source must be a regular, non-symlink file.")
    suffix = source.suffix.lower()
    if suffix not in DOCUMENT_EXTENSIONS:
        raise ValueError(f"Unsupported document extension: {suffix}")
    size = source.stat().st_size
    if size > max_bytes:
        raise ValueError(
            f"Document exceeds size limit ({size} bytes; "
            f"limit {max_bytes})."
        )
    try:
        relative = source.relative_to(source_root)
    except ValueError:
        relative = Path(source.name)
    destination = destination_root / relative
    # Resolve and verify destination stays within the destination root.
    root_resolved = destination_root.resolve()
    destination_resolved = destination.resolve(strict=False)
    if not destination_resolved.is_relative_to(root_resolved):
        raise ValueError("Unsafe destination path.")
    if destination.exists() and not overwrite:
        raise FileExistsError(
            f"Destination exists: {destination}. Use --overwrite."
        )
    digest = sha256_file(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.is_symlink():
        raise ValueError("Destination cannot be a symbolic link.")
    temporary = destination.with_name(destination.name + ".importing")
    try:
        with source.open("rb") as src, temporary.open("wb") as dst:
            shutil.copyfileobj(src, dst, length=1024 * 1024)
        if sha256_file(temporary) != digest:
            raise IOError("Checksum mismatch after copy.")
        if destination.exists() and not overwrite:
            raise FileExistsError(
                f"Destination appeared during copy: {destination}"
            )
        temporary.replace(destination)
    finally:
        if temporary.exists():
            temporary.unlink()
    return {
        "source": str(source),
        "storedPath": str(destination),
        "filename": destination.name,
        "extension": suffix,
        "mimeType": mimetypes.guess_type(destination.name)[0],
        "sizeBytes": size,
        "sha256": digest,
    }
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import MedOrbits document metadata and files."
    )
    parser.add_argument(
        "input",
        type=Path,
        help="Metadata file or directory of documents.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/imported/documents"),
        help="Output directory for metadata and manifest.",
    )
    parser.add_argument(
        "--dataset",
        default="documents",
        help="Dataset name for metadata input.",
    )
    parser.add_argument(
        "--copy-files",
        action="store_true",
        help="Copy discovered physical documents into output/files.",
    )
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Recursively discover documents inside input directories.",
    )
    parser.add_argument(
        "--max-mb",
        type=int,
        default=50,
        help="Maximum size per file in MB; default 50.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow replacing existing output files.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and preview without writing files.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Reject records without local path or download URL.",
    )
    args = parser.parse_args()
    if args.max_mb < 1 or args.max_mb > 2048:
        parser.error("--max-mb must be between 1 and 2048.")
    input_path = args.input.resolve()
    output_dir = args.output.resolve()
    max_bytes = args.max_mb * 1024 * 1024
    try:
        records: list[Any] = []
        physical_files: list[Path] = []
        is_metadata_input = (
            input_path.is_file()
            and input_path.suffix.lower() in METADATA_EXTENSIONS
        )
        if is_metadata_input:
            records = read_metadata(input_path)
            source_root = input_path.parent
        else:
            source_root = input_path if input_path.is_dir() else input_path.parent
            physical_files = discover_files(
                input_path,
                recursive=args.recursive,
            )
            records = [
                {
                    "title": path.stem.replace("_", " ").replace("-", " "),
                    "file_path": str(path),
                    "filename": path.name,
                    "category": "general",
                }
                for path in physical_files
            ]
        report: dict[str, Any] = {
            "schemaVersion": "1.0.0",
            "tool": "MedOrbits Document Importer",
            "toolVersion": VERSION,
            "generatedAt": utc_now(),
            "input": str(input_path),
            "output": str(output_dir),
            "dryRun": args.dry_run,
            "summary": {
                "recordsRead": len(records),
                "recordsImported": 0,
                "recordsRejected": 0,
                "duplicateIds": 0,
                "filesCopied": 0,
                "duplicateContent": 0,
            },
            "documents": [],
            "errors": [],
            "warnings": [],
        }
        seen_ids: set[str] = set()
        seen_hashes: dict[str, str] = {}
        for row_number, raw in enumerate(records, 1):
            normalized, errors, warnings = validate_document_record(
                raw,
                str(input_path),
                row_number,
            )
            report["errors"].extend(errors)
            report["warnings"].extend(warnings)
            if normalized is None:
                report["summary"]["recordsRejected"] += 1
                continue
            document_id = normalized["id"]
            if document_id in seen_ids:
                report["errors"].append(
                    f"Duplicate document ID: {document_id}"
                )
                report["summary"]["recordsRejected"] += 1
                report["summary"]["duplicateIds"] += 1
                continue
            local_value = first_value(normalized, PATH_FIELDS)
            if local_value:
                local_path = Path(str(local_value))
                if not local_path.is_absolute():
                    local_path = source_root / local_path
                local_path = local_path.resolve()
                if not local_path.is_file():
                    message = (
                        f"Document {document_id}: local file not found: "
                        f"{local_path}"
                    )
                    if args.strict:
                        report["errors"].append(message)
                        report["summary"]["recordsRejected"] += 1
                        continue
                    report["warnings"].append(message)
                elif local_path.suffix.lower() not in DOCUMENT_EXTENSIONS:
                    report["errors"].append(
                        f"Unsupported document extension: {local_path}"
                    )
                    report["summary"]["recordsRejected"] += 1
                    continue
                elif local_path.stat().st_size > max_bytes:
                    report["errors"].append(
                        f"Document exceeds size limit: {local_path}"
                    )
                    report["summary"]["recordsRejected"] += 1
                    continue
                else:
                    digest = sha256_file(local_path)
                    normalized["sha256"] = digest
                    normalized["size_bytes"] = local_path.stat().st_size
                    if digest in seen_hashes:
                        normalized["duplicate_content_of"] = seen_hashes[digest]
                        report["summary"]["duplicateContent"] += 1
                        report["warnings"].append(
                            f"{local_path} duplicates content from "
                            f"{seen_hashes[digest]}."
                        )
                    else:
                        seen_hashes[digest] = document_id
                    if args.copy_files:
                        if not args.dry_run:
                            try:
                                copied = copy_document(
                                    local_path,
                                    source_root,
                                    output_dir / "files",
                                    max_bytes,
                                    args.overwrite,
                                )
                                normalized["file"] = copied
                                report["summary"]["filesCopied"] += 1
                            except (OSError, ValueError) as exc:
                                report["errors"].append(
                                    f"{local_path}: {exc}"
                                )
                                report["summary"]["recordsRejected"] += 1
                                continue
                        else:
                            normalized["planned_copy"] = str(
                                output_dir / "files" / local_path.name
                            )
            elif args.strict and not normalized.get("url"):
                report["errors"].append(
                    f"Document {document_id} has neither a local file "
                    "nor a URL."
                )
                report["summary"]["recordsRejected"] += 1
                continue
            seen_ids.add(document_id)
            report["documents"].append(normalized)
            report["summary"]["recordsImported"] += 1
        manifest = {
            "metadata": {
                "schemaVersion": "1.0.0",
                "dataset": args.dataset,
                "generatedAt": utc_now(),
                "recordCount": len(report["documents"]),
                "sourceTool": "import_documents.py",
            },
            "records": report["documents"],
        }
        manifest_path = output_dir / f"{args.dataset}.json"
        report_path = output_dir / "import-report.json"
        if manifest_path == report_path:
            raise ValueError("Dataset name conflicts with report filename.")
        if not args.dry_run:
            if not args.overwrite:
                conflicts = [
                    str(path)
                    for path in (manifest_path, report_path)
                    if path.exists()
                ]
                if conflicts:
                    raise FileExistsError(
                        "Output exists; use --overwrite:\n"
                        + "\n".join(conflicts)
                    )
            atomic_write_json(
                manifest_path,
                manifest,
                overwrite=args.overwrite,
            )
            atomic_write_json(
                report_path,
                report,
                overwrite=args.overwrite,
            )
        print("\nMedOrbits Document Import")
        print("-------------------------")
        print(f"Records read:       {report['summary']['recordsRead']}")
        print(f"Records imported:   {report['summary']['recordsImported']}")
        print(f"Records rejected:   {report['summary']['recordsRejected']}")
        print(f"Duplicate IDs:      {report['summary']['duplicateIds']}")
        print(f"Duplicate content:  {report['summary']['duplicateContent']}")
        print(f"Files copied:       {report['summary']['filesCopied']}")
        print(f"Errors:             {len(report['errors'])}")
        print(f"Warnings:           {len(report['warnings'])}")
        if args.dry_run:
            print("DRY RUN: no output files written.")
        else:
            print(f"Manifest: {manifest_path}")
            print(f"Report:   {report_path}")
        return 1 if report["errors"] else 0
    except (OSError, ValueError, FileExistsError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
if __name__ == "__main__":
    raise SystemExit(main())