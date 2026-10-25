#!/usr/bin/env python3
"""
MedOrbits Report Generator
==========================
Purpose:
    Generate consolidated reports from JSON datasets and existing
    JSON or text-based validation/test reports.
Features:
    - JSON, CSV, and Markdown output.
    - Recursive input discovery.
    - Supports JSON arrays and common report containers.
    - Optional report title and metadata.
    - Input validation and clear error reporting.
    - Atomic output writing.
    - Prevents accidental output overwrite.
    - Read-only input processing.
    - Python 3.12+ compatible.
    - Standard library only.
Usage:
    python python/scripts/generate_reports.py --input reports/
    python python/scripts/generate_reports.py --input reports/ --format json
    python python/scripts/generate_reports.py --input reports/ --format csv
    python python/scripts/generate_reports.py --input reports/ --format markdown
    python python/scripts/generate_reports.py --input reports/ --output reports/summary.md
    python python/scripts/generate_reports.py --input reports/ --title "MedOrbits QA Report"
    python python/scripts/generate_reports.py --input reports/ --overwrite
Exit codes:
    0: Report generated successfully.
    1: No usable report records found.
    2: Configuration, input, or output error.
"""
from __future__ import annotations
import argparse
import csv
import json
import os
import sys
import tempfile
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
SUPPORTED_INPUT_SUFFIXES = {".json", ".csv", ".txt", ".log"}
RECORD_CONTAINER_KEYS = (
    "records",
    "results",
    "findings",
    "issues",
    "errors",
    "warnings",
    "duplicates",
    "tests",
    "checks",
    "data",
    "items",
)
class ReportGenerationError(Exception):
    """Raised when report generation cannot be completed."""
def utc_timestamp() -> str:
    """Return an ISO 8601 UTC timestamp."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
def discover_inputs(
    source: Path,
    excluded_dirs: set[str],
    output_path: Path | None = None,
) -> list[Path]:
    """Discover supported report inputs."""
    if source.is_file():
        if source.suffix.lower() not in SUPPORTED_INPUT_SUFFIXES:
            raise ReportGenerationError(
                f"Unsupported input format: {source.suffix or '(no extension)'}"
            )
        return [source]
    paths: list[Path] = []
    for directory, dirnames, filenames in os.walk(source):
        dirnames[:] = sorted(
            name for name in dirnames
            if name not in excluded_dirs
        )
        for filename in sorted(filenames):
            path = Path(directory) / filename
            if path.suffix.lower() not in SUPPORTED_INPUT_SUFFIXES:
                continue
            if output_path is not None:
                if path.resolve() == output_path.resolve():
                    continue
            paths.append(path)
    return sorted(paths)
def load_json(path: Path) -> Any:
    """Read and parse JSON input."""
    try:
        with path.open("r", encoding="utf-8-sig") as handle:
            return json.load(handle)
    except json.JSONDecodeError as exc:
        raise ReportGenerationError(
            f"{path}: invalid JSON at line {exc.lineno}, "
            f"column {exc.colno}: {exc.msg}"
        ) from exc
    except (OSError, UnicodeError) as exc:
        raise ReportGenerationError(f"Cannot read {path}: {exc}") from exc
def load_csv(path: Path) -> list[dict[str, Any]]:
    """Read CSV rows as dictionaries."""
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames:
                return []
            return [dict(row) for row in reader]
    except (OSError, UnicodeError, csv.Error) as exc:
        raise ReportGenerationError(f"Cannot read CSV {path}: {exc}") from exc
def extract_records(document: Any) -> list[dict[str, Any]]:
    """Normalize supported JSON report structures into records."""
    if isinstance(document, list):
        if all(isinstance(item, dict) for item in document):
            return document
        raise ReportGenerationError(
            "JSON arrays must contain objects only."
        )
    if not isinstance(document, dict):
        raise ReportGenerationError(
            "JSON report must contain an object or an array of objects."
        )
    for key in RECORD_CONTAINER_KEYS:
        value = document.get(key)
        if isinstance(value, list):
            if all(isinstance(item, dict) for item in value):
                return value
            raise ReportGenerationError(
                f"JSON field {key!r} must contain objects only."
            )
    # Treat an object without a recognized record container as one record.
    return [document]
def load_input_records(
    path: Path,
    root: Path,
) -> list[dict[str, Any]]:
    """Load records and attach source metadata."""
    suffix = path.suffix.lower()
    if suffix == ".json":
        records = extract_records(load_json(path))
    elif suffix == ".csv":
        records = load_csv(path)
    elif suffix in {".txt", ".log"}:
        try:
            content = path.read_text(encoding="utf-8-sig")
        except (OSError, UnicodeError) as exc:
            raise ReportGenerationError(
                f"Cannot read text file {path}: {exc}"
            ) from exc
        records = [
            {"line_number": index, "message": line}
            for index, line in enumerate(content.splitlines(), start=1)
            if line.strip()
        ]
    else:
        raise ReportGenerationError(f"Unsupported input file: {path}")
    relative_source = path.relative_to(root).as_posix()
    normalized: list[dict[str, Any]] = []
    for index, record in enumerate(records, start=1):
        item = dict(record)
        item.setdefault("_source_file", relative_source)
        item.setdefault("_record_number", index)
        normalized.append(item)
    return normalized
def json_cell(value: Any) -> str:
    """Convert nested values to stable JSON strings for tabular output."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (dict, list)):
        return json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
    return str(value)
def collect_columns(records: list[dict[str, Any]]) -> list[str]:
    """Collect columns in first-seen order."""
    columns: list[str] = []
    for record in records:
        for key in record:
            if key not in columns:
                columns.append(key)
    return columns
def escape_markdown(value: str) -> str:
    """Escape Markdown table delimiters and line breaks."""
    return (
        value.replace("\\", "\\\\")
        .replace("|", "\\|")
        .replace("\r\n", "<br>")
        .replace("\n", "<br>")
        .replace("\r", "<br>")
    )
def build_markdown(
    records: list[dict[str, Any]],
    columns: list[str],
    title: str,
    inputs: list[str],
    generated_at: str,
) -> str:
    """Build a Markdown report."""
    lines = [
        f"# {title}",
        "",
        f"- Generated (UTC): {generated_at}",
        f"- Input files: {len(inputs)}",
        f"- Records: {len(records)}",
        "",
        "## Source Files",
        "",
    ]
    lines.extend(f"- `{path}`" for path in inputs)
    lines.extend(["", "## Results", ""])
    if not records or not columns:
        lines.extend(["No records available.", ""])
        return "\n".join(lines)
    lines.append("| " + " | ".join(
        escape_markdown(column) for column in columns
    ) + " |")
    lines.append("| " + " | ".join("---" for _ in columns) + " |")
    for record in records:
        values = [
            escape_markdown(json_cell(record.get(column)))
            for column in columns
        ]
        lines.append("| " + " | ".join(values) + " |")
    lines.append("")
    return "\n".join(lines)
def build_json(
    records: list[dict[str, Any]],
    title: str,
    inputs: list[str],
    generated_at: str,
) -> str:
    """Build a structured JSON report."""
    payload = {
        "metadata": {
            "reportTitle": title,
            "generatedAtUtc": generated_at,
            "inputFileCount": len(inputs),
            "recordCount": len(records),
            "schemaVersion": "1.0.0",
        },
        "sources": inputs,
        "records": records,
    }
    return json.dumps(
        payload,
        ensure_ascii=False,
        indent=2,
    ) + "\n"
def write_csv(
    records: list[dict[str, Any]],
    columns: list[str],
    output: Path,
) -> None:
    """Write report records to CSV."""
    with output.open("w", encoding="utf-8-sig", newline="") as handle:
        if not columns:
            handle.write("")
            return
        writer = csv.DictWriter(
            handle,
            fieldnames=columns,
            extrasaction="ignore",
            lineterminator="\n",
        )
        writer.writeheader()
        for record in records:
            writer.writerow({
                column: json_cell(record.get(column))
                for column in columns
            })
def atomic_write(
    output: Path,
    content: str,
    overwrite: bool,
) -> None:
    """Write text atomically without replacing files accidentally."""
    output = output.expanduser().resolve()
    if output.exists() and output.is_dir():
        raise ReportGenerationError(
            f"Output path is a directory: {output}"
        )
    if output.exists() and not overwrite:
        raise ReportGenerationError(
            f"Output already exists: {output}. "
            "Use --overwrite to replace it."
        )
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
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        if output.exists() and not overwrite:
            raise ReportGenerationError(
                f"Output appeared during generation: {output}"
            )
        temporary_path.replace(output)
        temporary_path = None
    except OSError as exc:
        raise ReportGenerationError(
            f"Cannot write report {output}: {exc}"
        ) from exc
    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink(missing_ok=True)
            except OSError:
                pass
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate consolidated MedOrbits reports."
    )
    parser.add_argument(
        "--input",
        type=Path,
        required=True,
        help="Input JSON/CSV/TXT/LOG file or directory.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output path. Defaults to reports/summary.<format>.",
    )
    parser.add_argument(
        "--format",
        choices=("json", "csv", "markdown"),
        default="markdown",
        help="Output format (default: markdown).",
    )
    parser.add_argument(
        "--title",
        default="MedOrbits Consolidated Report",
        help="Report title.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow replacing an existing output file.",
    )
    parser.add_argument(
        "--exclude-dir",
        action="append",
        default=[],
        help="Additional directory name to exclude; repeat as needed.",
    )
    parser.add_argument(
        "--allow-empty",
        action="store_true",
        help="Generate a report even when no records are found.",
    )
    return parser
def main() -> int:
    args = build_parser().parse_args()
    source = args.input.expanduser().resolve()
    if not source.exists():
        print(f"ERROR: Input does not exist: {source}", file=sys.stderr)
        return 2
    if not source.is_file() and not source.is_dir():
        print(f"ERROR: Input is not a file or directory: {source}", file=sys.stderr)
        return 2
    output = (
        args.output.expanduser().resolve()
        if args.output
        else Path("reports") / f"summary.{args.format}"
    )
    output = output.expanduser().resolve()
    try:
        inputs = discover_inputs(
            source,
            DEFAULT_EXCLUDED_DIRS | set(args.exclude_dir),
            output_path=output,
        )
        if not inputs:
            raise ReportGenerationError(
                f"No supported input files found in {source}."
            )
        all_records: list[dict[str, Any]] = []
        input_names: list[str] = []
        input_errors: list[str] = []
        for path in inputs:
            try:
                records = load_input_records(path, source if source.is_dir() else source.parent)
            except ReportGenerationError as exc:
                input_errors.append(str(exc))
                continue
            all_records.extend(records)
            input_names.append(
                path.relative_to(source).as_posix()
                if source.is_dir()
                else path.name
            )
        if input_errors:
            for error in input_errors:
                print(f"WARNING: {error}", file=sys.stderr)
        if not all_records and not args.allow_empty:
            if input_errors:
                raise ReportGenerationError(
                    "No usable records were loaded. Review the input errors."
                )
            print("No usable records found.", file=sys.stderr)
            return 1
        columns = collect_columns(all_records)
        generated_at = utc_timestamp()
        if args.format == "json":
            content = build_json(
                all_records,
                args.title,
                input_names,
                generated_at,
            )
        elif args.format == "csv":
            # CSV reports carry data rows; metadata is available in
            # the console summary rather than mixed into the CSV schema.
            import io
            buffer = io.StringIO(newline="")
            if columns:
                writer = csv.DictWriter(
                    buffer,
                    fieldnames=columns,
                    extrasaction="ignore",
                    lineterminator="\n",
                )
                writer.writeheader()
                for record in all_records:
                    writer.writerow({
                        column: json_cell(record.get(column))
                        for column in columns
                    })
            content = buffer.getvalue()
        else:
            content = build_markdown(
                all_records,
                columns,
                args.title,
                input_names,
                generated_at,
            )
        atomic_write(output, content, args.overwrite)
        print("MedOrbits Report Generator")
        print("=" * 27)
        print(f"Input files processed: {len(input_names)}")
        print(f"Records included:      {len(all_records)}")
        print(f"Report format:         {args.format}")
        print(f"Output file:           {output}")
        print(f"Generated at (UTC):    {generated_at}")
        if input_errors:
            print(f"Input warnings:        {len(input_errors)}")
        print("Status: SUCCESS")
        return 0
    except (ReportGenerationError, OSError, UnicodeError, csv.Error) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
if __name__ == "__main__":
    raise SystemExit(main())
