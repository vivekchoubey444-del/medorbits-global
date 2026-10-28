#!/usr/bin/env python3
"""
MedOrbits Data Converter
========================
Convert structured datasets between JSON, JSONL, CSV, TSV, and XML.
Supported input formats:
    .json
    .jsonl / .ndjson
    .csv
    .tsv
    .xml
Supported output formats:
    json
    jsonl
    csv
    tsv
    xml
Features:
- Converts between supported data formats.
- Supports JSON arrays, JSON objects, and JSONL records.
- Supports CSV and TSV with headers.
- Supports simple XML records.
- Handles UTF-8 and UTF-8 BOM.
- Preserves nested JSON objects when writing JSON.
- Flattens nested objects for CSV/TSV export.
- Validates output before replacing a file.
- Prevents accidental overwrites by default.
- Supports dry-run mode.
- Generates optional conversion reports.
- Never modifies source files.
Python: 3.12+
Dependencies: Python standard library only.
Exit codes:
    0 = Conversion successful.
    1 = Conversion or validation failure.
    2 = Invalid arguments or execution error.
"""
from __future__ import annotations
import argparse
import csv
import json
import sys
import tempfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
VERSION = "1.0.0"
SUPPORTED_INPUT_EXTENSIONS = {
    ".json",
    ".jsonl",
    ".ndjson",
    ".csv",
    ".tsv",
    ".xml",
}
SUPPORTED_OUTPUT_FORMATS = {
    "json",
    "jsonl",
    "csv",
    "tsv",
    "xml",
}
DEFAULT_EXCLUDED_DIRS = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    "__pycache__",
    "dist",
    "build",
}
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert MedOrbits datasets between supported formats."
    )
    parser.add_argument(
        "input",
        type=Path,
        help="Input file or directory.",
    )
    parser.add_argument(
        "--format",
        choices=sorted(SUPPORTED_OUTPUT_FORMATS),
        required=True,
        help="Output format.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output file or directory. Defaults to a sibling file or directory.",
    )
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Recursively convert files in an input directory.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow replacing existing output files.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate inputs and preview conversions without writing outputs.",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Indent JSON output for readability.",
    )
    parser.add_argument(
        "--encoding",
        default="utf-8-sig",
        help="Input text encoding. Default: utf-8-sig.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Optional JSON conversion report.",
    )
    parser.add_argument(
        "--exclude-dir",
        action="append",
        default=[],
        help="Directory name to exclude. May be specified more than once.",
    )
    parser.add_argument(
        "--max-size-mb",
        type=float,
        default=100,
        help="Maximum size per input file in MB. Default: 100.",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {VERSION}",
    )
    args = parser.parse_args()
    if args.max_size_mb <= 0:
        parser.error("--max-size-mb must be greater than zero.")
    return args
def load_text(path: Path, encoding: str, max_size_bytes: int) -> str:
    size = path.stat().st_size
    if size > max_size_bytes:
        raise ValueError(
            f"File exceeds size limit: {size / (1024 * 1024):.2f} MB."
        )
    return path.read_text(encoding=encoding)
def load_json_records(text: str) -> list[Any]:
    data = json.loads(text)
    if isinstance(data, list):
        return data
    return [data]
def load_jsonl_records(text: str) -> list[Any]:
    records: list[Any] = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if not stripped:
            continue
        try:
            records.append(json.loads(stripped))
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"Invalid JSONL at line {line_number}: {exc.msg}."
            ) from exc
    return records
def load_delimited_records(
    path: Path,
    text: str,
    delimiter: str,
) -> list[dict[str, Any]]:
    import io
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if not reader.fieldnames:
        raise ValueError("CSV/TSV file has no header row.")
    headers = [header.strip() if header else "" for header in reader.fieldnames]
    if any(not header for header in headers):
        raise ValueError("CSV/TSV contains an empty column name.")
    if len(headers) != len(set(headers)):
        raise ValueError("CSV/TSV contains duplicate column names.")
    records: list[dict[str, Any]] = []
    for line_number, row in enumerate(reader, start=2):
        if None in row:
            raise ValueError(
                f"Line {line_number} has more values than the header."
            )
        normalized = {
            key.strip(): value
            for key, value in row.items()
            if key is not None
        }
        records.append(normalized)
    return records
def xml_element_to_value(element: ET.Element) -> Any:
    children = list(element)
    attributes = dict(element.attrib)
    text = (element.text or "").strip()
    if not children and not attributes:
        return text
    result: dict[str, Any] = {}
    if attributes:
        result["@attributes"] = attributes
    if text:
        result["#text"] = text
    for child in children:
        value = xml_element_to_value(child)
        if child.tag in result:
            existing = result[child.tag]
            if isinstance(existing, list):
                existing.append(value)
            else:
                result[child.tag] = [existing, value]
        else:
            result[child.tag] = value
    return result
def load_xml_records(text: str) -> list[Any]:
    try:
        root = ET.fromstring(text)
    except ET.ParseError as exc:
        raise ValueError(f"Invalid XML: {exc}.") from exc
    children = list(root)
    if not children:
        return [{root.tag: xml_element_to_value(root)}]
    return [
        {child.tag: xml_element_to_value(child)}
        for child in children
    ]
def detect_input_format(path: Path) -> str:
    extension = path.suffix.lower()
    mapping = {
        ".json": "json",
        ".jsonl": "jsonl",
        ".ndjson": "jsonl",
        ".csv": "csv",
        ".tsv": "tsv",
        ".xml": "xml",
    }
    try:
        return mapping[extension]
    except KeyError as exc:
        raise ValueError(
            f"Unsupported input extension: {extension or '(none)'}."
        ) from exc
def load_records(
    path: Path,
    encoding: str,
    max_size_bytes: int,
) -> list[Any]:
    input_format = detect_input_format(path)
    text = load_text(path, encoding, max_size_bytes)
    if input_format == "json":
        return load_json_records(text)
    if input_format == "jsonl":
        return load_jsonl_records(text)
    if input_format == "csv":
        return load_delimited_records(path, text, ",")
    if input_format == "tsv":
        return load_delimited_records(path, text, "\t")
    if input_format == "xml":
        return load_xml_records(text)
    raise ValueError(f"Unsupported input format: {input_format}")
def flatten_record(
    value: Any,
    prefix: str = "",
    separator: str = ".",
) -> dict[str, Any]:
    result: dict[str, Any] = {}
    if isinstance(value, dict):
        for key, child in value.items():
            key_string = str(key)
            new_key = (
                f"{prefix}{separator}{key_string}"
                if prefix
                else key_string
            )
            if isinstance(child, dict):
                result.update(
                    flatten_record(child, new_key, separator)
                )
            elif isinstance(child, list):
                result[new_key] = json.dumps(
                    child,
                    ensure_ascii=False,
                    separators=(",", ":"),
                )
            else:
                result[new_key] = child
    elif prefix:
        result[prefix] = value
    return result
def normalize_records(records: list[Any]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for index, record in enumerate(records, start=1):
        if isinstance(record, dict):
            normalized.append(record)
        else:
            normalized.append({"value": record})
    return normalized
def collect_csv_columns(
    records: list[dict[str, Any]],
) -> list[str]:
    columns: list[str] = []
    seen: set[str] = set()
    for record in records:
        for key in record:
            if key not in seen:
                seen.add(key)
                columns.append(key)
    return columns
def records_to_csv(
    records: list[Any],
    delimiter: str,
) -> str:
    import io
    normalized = [
        flatten_record(record)
        for record in normalize_records(records)
    ]
    fieldnames = collect_csv_columns(normalized)
    if not fieldnames:
        raise ValueError(
            "Cannot export an empty dataset to CSV/TSV without column names."
        )
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(
        buffer,
        fieldnames=fieldnames,
        delimiter=delimiter,
        extrasaction="ignore",
        lineterminator="\n",
    )
    writer.writeheader()
    for record in normalized:
        row = {}
        for key, value in record.items():
            if value is None:
                row[key] = ""
            elif isinstance(value, (dict, list)):
                row[key] = json.dumps(
                    value,
                    ensure_ascii=False,
                    separators=(",", ":"),
                )
            else:
                row[key] = str(value)
        writer.writerow(row)
    return buffer.getvalue()
def records_to_xml(records: list[Any]) -> str:
    root = ET.Element("records")
    for record in records:
        item = ET.SubElement(root, "record")
        normalized = record if isinstance(record, dict) else {"value": record}
        for key, value in normalized.items():
            # XML element names must be valid. Store unsafe keys in a generic
            # element with the original key preserved as an attribute.
            key_string = str(key)
            if (
                key_string
                and key_string[0].isalpha()
                and all(
                    char.isalnum() or char in "_.-"
                    for char in key_string
                )
            ):
                child = ET.SubElement(item, key_string)
            else:
                child = ET.SubElement(item, "field")
                child.set("name", key_string)
            if isinstance(value, (dict, list)):
                child.text = json.dumps(
                    value,
                    ensure_ascii=False,
                    separators=(",", ":"),
                )
            elif value is None:
                child.set("null", "true")
            else:
                child.text = str(value)
    ET.indent(root, space="  ")
    return ET.tostring(
        root,
        encoding="unicode",
        xml_declaration=False,
    ) + "\n"
def serialize_records(
    records: list[Any],
    output_format: str,
    pretty: bool,
) -> str:
    if output_format == "json":
        return json.dumps(
            records,
            indent=2 if pretty else None,
            ensure_ascii=False,
            allow_nan=False,
        ) + "\n"
    if output_format == "jsonl":
        return "".join(
            json.dumps(
                record,
                ensure_ascii=False,
                allow_nan=False,
                separators=(",", ":"),
            ) + "\n"
            for record in records
        )
    if output_format == "csv":
        return records_to_csv(records, ",")
    if output_format == "tsv":
        return records_to_csv(records, "\t")
    if output_format == "xml":
        return records_to_xml(records)
    raise ValueError(f"Unsupported output format: {output_format}")
def validate_serialized_output(
    text: str,
    output_format: str,
) -> None:
    if output_format == "json":
        json.loads(text)
    elif output_format == "jsonl":
        for line_number, line in enumerate(text.splitlines(), start=1):
            if line.strip():
                try:
                    json.loads(line)
                except json.JSONDecodeError as exc:
                    raise ValueError(
                        f"Generated JSONL is invalid at line {line_number}: "
                        f"{exc.msg}."
                    ) from exc
    elif output_format == "xml":
        ET.fromstring(text)
    elif output_format in {"csv", "tsv"}:
        import io
        delimiter = "," if output_format == "csv" else "\t"
        rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
        if rows:
            width = len(rows[0])
            for index, row in enumerate(rows[1:], start=2):
                if len(row) != width:
                    raise ValueError(
                        f"Generated delimited output has an invalid row "
                        f"width at row {index}."
                    )
def atomic_write(
    output_path: Path,
    content: str,
    overwrite: bool,
) -> None:
    output_path = output_path.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists() and not overwrite:
        raise FileExistsError(
            f"Output already exists: {output_path}. "
            "Use --overwrite or select another path."
        )
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            dir=output_path.parent,
            prefix=f".{output_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary.write(content)
            temporary.flush()
            temporary_path = Path(temporary.name)
        if output_path.exists() and not overwrite:
            raise FileExistsError(
                f"Output already exists: {output_path}."
            )
        temporary_path.replace(output_path)
    finally:
        if temporary_path and temporary_path.exists():
            temporary_path.unlink()
def discover_inputs(
    input_path: Path,
    recursive: bool,
    excluded_dirs: set[str],
    output_path: Path | None,
) -> list[Path]:
    input_path = input_path.expanduser().resolve()
    if input_path.is_file():
        if output_path is not None and input_path == output_path.resolve():
            raise ValueError("Input and output paths cannot be the same.")
        return [input_path]
    if not input_path.is_dir():
        raise FileNotFoundError(
            f"Input path does not exist: {input_path}"
        )
    iterator = (
        input_path.rglob("*")
        if recursive
        else input_path.iterdir()
    )
    files = []
    for path in iterator:
        if not path.is_file():
            continue
        if path.suffix.lower() not in SUPPORTED_INPUT_EXTENSIONS:
            continue
        relative_parts = path.relative_to(input_path).parts
        if any(part in excluded_dirs for part in relative_parts):
            continue
        if output_path is not None:
            try:
                if path.resolve() == output_path.resolve():
                    continue
            except OSError:
                pass
        files.append(path.resolve())
    return sorted(set(files))
def output_path_for(
    input_file: Path,
    input_root: Path,
    output_format: str,
    output_argument: Path | None,
    input_is_directory: bool,
) -> Path:
    suffixes = {
        "json": ".json",
        "jsonl": ".jsonl",
        "csv": ".csv",
        "tsv": ".tsv",
        "xml": ".xml",
    }
    new_name = input_file.stem + suffixes[output_format]
    if output_argument is None:
        return input_file.with_name(new_name)
    output_argument = output_argument.expanduser().resolve()
    if input_is_directory or (
        output_argument.exists() and output_argument.is_dir()
    ):
        relative = input_file.relative_to(input_root)
        return output_argument / relative.with_name(new_name)
    return output_argument
def main() -> int:
    args = parse_args()
    input_path = args.input.expanduser().resolve()
    output_argument = (
        args.output.expanduser().resolve()
        if args.output
        else None
    )
    if (
        input_path.is_file()
        and output_argument is not None
        and input_path == output_argument
    ):
        print(
            "ERROR: Input and output paths cannot be the same.",
            file=sys.stderr,
        )
        return 2
    excluded_dirs = DEFAULT_EXCLUDED_DIRS | set(args.exclude_dir)
    max_size_bytes = int(args.max_size_mb * 1024 * 1024)
    try:
        input_files = discover_inputs(
            input_path,
            args.recursive,
            excluded_dirs,
            output_argument,
        )
    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    if not input_files:
        print("No supported input files found.")
        return 0
    input_is_directory = input_path.is_dir()
    input_root = input_path if input_is_directory else input_path.parent
    results: list[dict[str, Any]] = []
    successful = 0
    failed = 0
    print("MedOrbits Data Converter")
    print("=" * 24)
    print(f"Input files: {len(input_files)}")
    print(f"Output format: {args.format}")
    print(f"Dry run: {'yes' if args.dry_run else 'no'}")
    print()
    for input_file in input_files:
        output_file = output_path_for(
            input_file,
            input_root,
            args.format,
            output_argument,
            input_is_directory,
        )
        try:
            if output_file.resolve() == input_file.resolve():
                raise ValueError(
                    "Input and output paths resolve to the same file."
                )
            records = load_records(
                input_file,
                args.encoding,
                max_size_bytes,
            )
            content = serialize_records(
                records,
                args.format,
                args.pretty,
            )
            validate_serialized_output(content, args.format)
            result = {
                "input": str(input_file),
                "output": str(output_file),
                "records": len(records),
                "status": "validated",
                "error": None,
            }
            if args.dry_run:
                print(
                    f"[DRY RUN] {input_file} -> {output_file} "
                    f"({len(records)} records)"
                )
            else:
                atomic_write(
                    output_file,
                    content,
                    overwrite=args.overwrite,
                )
                result["status"] = "converted"
                print(
                    f"[OK] {input_file} -> {output_file} "
                    f"({len(records)} records)"
                )
            successful += 1
            results.append(result)
        except (
            OSError,
            ValueError,
            UnicodeError,
            csv.Error,
            ET.ParseError,
            TypeError,
        ) as exc:
            failed += 1
            results.append(
                {
                    "input": str(input_file),
                    "output": str(output_file),
                    "records": 0,
                    "status": "failed",
                    "error": str(exc),
                }
            )
            print(f"[ERROR] {input_file}: {exc}")
    report = {
        "metadata": {
            "tool": "MedOrbits Data Converter",
            "version": VERSION,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "outputFormat": args.format,
            "dryRun": args.dry_run,
        },
        "summary": {
            "filesDiscovered": len(input_files),
            "successful": successful,
            "failed": failed,
        },
        "results": results,
    }
    if args.report:
        report_path = args.report.expanduser().resolve()
        try:
            if report_path in {file.resolve() for file in input_files}:
                raise ValueError(
                    "Report path cannot overwrite an input file."
                )
            if not args.dry_run:
                atomic_write(
                    report_path,
                    json.dumps(
                        report,
                        indent=2,
                        ensure_ascii=False,
                    ) + "\n",
                    overwrite=False,
                )
            print(f"\nReport: {report_path}")
        except (OSError, ValueError) as exc:
            failed += 1
            print(f"[ERROR] Could not write report: {exc}")
    print("\nSummary")
    print("-------")
    print(f"Successful: {successful}")
    print(f"Failed:     {failed}")
    return 1 if failed else 0
if __name__ == "__main__":
    raise SystemExit(main())

#
# Usage
#
# # Convert one JSON dataset to CSV
# python python/scripts/convert_data.py data/colleges.json \
#   --format csv \
#   --output data/exports/colleges.csv
# # Convert CSV to formatted JSON
# python python/scripts/convert_data.py data/courses.csv \
#   --format json \
#   --output data/exports/courses.json \
#   --pretty
# # Convert JSON to JSONL
# python python/scripts/convert_data.py data/jobs.json \
#   --format jsonl \
#   --output data/exports/jobs.jsonl
# # Convert a complete directory recursively
# python python/scripts/convert_data.py data/ \
#   --format json \
#   --output data/converted/ \
#   --recursive \
#   --pretty
# # Preview conversions without writing files
# python python/scripts/convert_data.py data/ \
#   --format csv \
#   --output data/converted/ \
#   --recursive \
#   --dry-run
# # Generate a conversion report
# python python/scripts/convert_data.py data/colleges.json \
#   --format csv \
#   --output data/exports/colleges.csv \
#   --report reports/conversion-report.json
#
# Important: CSV and TSV cannot represent nested objects natively, so nested dictionaries are flattened into dot-separated column names, while lists are serialized as JSON strings. XML conversion uses a generic records structure; it does not preserve every original XML schema or namespace. Source files are never intentionally modified.
