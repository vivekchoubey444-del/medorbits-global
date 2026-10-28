#!/usr/bin/env python3
"""
MedOrbits PDF Generator
=======================
Generate PDF documents from JSON, CSV, TXT, and Markdown files.
Features:
- Converts supported input files into PDF.
- Supports JSON objects, arrays, and nested records.
- Creates readable tables for structured datasets.
- Supports text and Markdown-style headings.
- Adds page numbers, document metadata, and timestamps.
- Handles long text and multi-page tables.
- Supports custom document titles.
- Prevents accidental overwriting by default.
- Supports dry-run mode.
- Generates an optional JSON report.
- Preserves all source files.
Python: 3.12+
Dependency: reportlab
Exit codes:
    0 = PDF generated successfully.
    1 = Conversion failed.
    2 = Invalid arguments or configuration.
"""
from __future__ import annotations
import argparse
import csv
import json
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
try:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate,
        Paragraph,
        Spacer,
        Table,
        TableStyle,
        PageBreak,
        KeepTogether,
    )
except ImportError:
    print(
        "ERROR: ReportLab is required. Install it with:\n"
        "python -m pip install reportlab",
        file=sys.stderr,
    )
    raise SystemExit(2)
VERSION = "1.0.0"
SUPPORTED_EXTENSIONS = {
    ".json",
    ".csv",
    ".tsv",
    ".txt",
    ".md",
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
        description="Generate professional PDFs for MedOrbits."
    )
    parser.add_argument(
        "input",
        type=Path,
        help="Input file or directory.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output PDF path or output directory.",
    )
    parser.add_argument(
        "--title",
        default=None,
        help="Custom PDF title.",
    )
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Process supported files in subdirectories.",
    )
    parser.add_argument(
        "--landscape",
        action="store_true",
        help="Use landscape A4 orientation.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow replacing existing PDF files.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate inputs and preview output paths without writing PDFs.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Optional JSON report path.",
    )
    parser.add_argument(
        "--max-size-mb",
        type=float,
        default=50,
        help="Maximum input file size in MB. Default: 50.",
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
def read_input(path: Path, max_size_bytes: int) -> Any:
    size = path.stat().st_size
    if size > max_size_bytes:
        raise ValueError(
            f"Input exceeds the configured size limit: "
            f"{size / (1024 * 1024):.2f} MB."
        )
    text = path.read_text(encoding="utf-8-sig")
    suffix = path.suffix.lower()
    if suffix == ".json":
        return json.loads(text)
    if suffix in {".csv", ".tsv"}:
        delimiter = "," if suffix == ".csv" else "\t"
        import io
        reader = csv.DictReader(
            io.StringIO(text, newline=""),
            delimiter=delimiter,
        )
        if not reader.fieldnames:
            raise ValueError("CSV/TSV file has no header row.")
        if any(not name for name in reader.fieldnames):
            raise ValueError("CSV/TSV contains an empty column name.")
        if len(reader.fieldnames) != len(set(reader.fieldnames)):
            raise ValueError("CSV/TSV contains duplicate column names.")
        return {
            "columns": reader.fieldnames,
            "records": list(reader),
        }
    if suffix in {".txt", ".md"}:
        return text
    raise ValueError(f"Unsupported input format: {suffix}")
def xml_safe_text(value: Any) -> str:
    """Escape text for ReportLab Paragraph markup."""
    text = str(value)
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )
def format_value(value: Any) -> str:
    if value is None:
        return "--"
    if isinstance(value, (dict, list)):
        return json.dumps(
            value,
            ensure_ascii=False,
            separators=(",", ":"),
        )
    return str(value)
def flatten_record(
    value: Any,
    prefix: str = "",
) -> dict[str, Any]:
    result: dict[str, Any] = {}
    if isinstance(value, dict):
        for key, child in value.items():
            name = f"{prefix}.{key}" if prefix else str(key)
            if isinstance(child, dict):
                result.update(flatten_record(child, name))
            elif isinstance(child, list):
                result[name] = json.dumps(
                    child,
                    ensure_ascii=False,
                    separators=(",", ":"),
                )
            else:
                result[name] = child
    elif prefix:
        result[prefix] = value
    return result
def to_records(data: Any) -> tuple[list[str], list[dict[str, Any]]]:
    if isinstance(data, dict) and isinstance(data.get("records"), list):
        columns = data.get("columns")
        records = [
            flatten_record(record)
            for record in data["records"]
        ]
        if not columns:
            columns = []
            for record in records:
                for key in record:
                    if key not in columns:
                        columns.append(key)
        return [str(column) for column in columns], records
    if isinstance(data, list):
        records = [flatten_record(record) for record in data]
    elif isinstance(data, dict):
        records = [flatten_record(data)]
    else:
        records = [{"Value": data}]
    columns: list[str] = []
    for record in records:
        for key in record:
            if key not in columns:
                columns.append(key)
    return columns, records
def build_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="MedOrbitsTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=21,
            leading=27,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#243B53"),
            spaceAfter=10 * mm,
        )
    )
    styles.add(
        ParagraphStyle(
            name="MedOrbitsSubtitle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#526477"),
            spaceAfter=5 * mm,
        )
    )
    styles.add(
        ParagraphStyle(
            name="MedOrbitsHeading",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=17,
            textColor=colors.HexColor("#243B53"),
            spaceBefore=5 * mm,
            spaceAfter=3 * mm,
        )
    )
    styles.add(
        ParagraphStyle(
            name="MedOrbitsBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            alignment=TA_LEFT,
            spaceAfter=3 * mm,
            wordWrap="LTR",
        )
    )
    styles.add(
        ParagraphStyle(
            name="MedOrbitsTable",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=7,
            leading=9,
            wordWrap="CJK",
        )
    )
    styles.add(
        ParagraphStyle(
            name="MedOrbitsTableHeader",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7,
            leading=9,
            textColor=colors.white,
            wordWrap="CJK",
        )
    )
    return styles
def add_page_number(canvas, document) -> None:
    canvas.saveState()
    width, _ = document.pagesize
    canvas.setStrokeColor(colors.HexColor("#D8DEE8"))
    canvas.setLineWidth(0.5)
    canvas.line(
        document.leftMargin,
        15 * mm,
        width - document.rightMargin,
        15 * mm,
    )
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#526477"))
    canvas.drawString(
        document.leftMargin,
        9 * mm,
        "MedOrbits | Generated document",
    )
    canvas.drawRightString(
        width - document.rightMargin,
        9 * mm,
        f"Page {document.page}",
    )
    canvas.restoreState()
def make_table(
    columns: list[str],
    records: list[dict[str, Any]],
    page_width: float,
    styles,
) -> Table:
    if not columns:
        columns = ["Information"]
    header = [
        Paragraph(xml_safe_text(column), styles["MedOrbitsTableHeader"])
        for column in columns
    ]
    data = [header]
    for record in records:
        row = []
        for column in columns:
            value = format_value(record.get(column, ""))
            row.append(
                Paragraph(
                    xml_safe_text(value),
                    styles["MedOrbitsTable"],
                )
            )
        data.append(row)
    available_width = page_width
    column_width = available_width / len(columns)
    widths = [column_width] * len(columns)
    table = Table(
        data,
        colWidths=widths,
        repeatRows=1,
        hAlign="LEFT",
        splitByRow=1,
    )
    table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor("#243B53"),
                ),
                (
                    "TEXTCOLOR",
                    (0, 0),
                    (-1, 0),
                    colors.white,
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.35,
                    colors.HexColor("#D8DEE8"),
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    5,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    5,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    5,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    5,
                ),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [
                        colors.white,
                        colors.HexColor("#F3F6FA"),
                    ],
                ),
            ]
        )
    )
    return table
def build_text_content(
    text: str,
    styles,
) -> list[Any]:
    story: list[Any] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            story.append(Spacer(1, 2 * mm))
            continue
        if stripped.startswith("#"):
            heading = stripped.lstrip("#").strip()
            if heading:
                story.append(
                    Paragraph(
                        xml_safe_text(heading),
                        styles["MedOrbitsHeading"],
                    )
                )
        elif stripped.startswith(("- ", "* ")):
            item = stripped[2:].strip()
            story.append(
                Paragraph(
                    "&#8226; " + xml_safe_text(item),
                    styles["MedOrbitsBody"],
                )
            )
        else:
            story.append(
                Paragraph(
                    xml_safe_text(stripped),
                    styles["MedOrbitsBody"],
                )
            )
    return story
def generate_pdf(
    input_path: Path,
    output_path: Path,
    title: str,
    data: Any,
    landscape_mode: bool,
) -> None:
    page_size = landscape(A4) if landscape_mode else A4
    document = SimpleDocTemplate(
        str(output_path),
        pagesize=page_size,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=18 * mm,
        bottomMargin=21 * mm,
        title=title,
        author="MedOrbits",
        subject=f"Generated from {input_path.name}",
    )
    styles = build_styles()
    story: list[Any] = []
    story.append(
        Paragraph(
            xml_safe_text(title),
            styles["MedOrbitsTitle"],
        )
    )
    story.append(
        Paragraph(
            "Source: "
            + xml_safe_text(input_path.name)
            + " | Generated: "
            + datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
            styles["MedOrbitsSubtitle"],
        )
    )
    story.append(Spacer(1, 3 * mm))
    if isinstance(data, str):
        story.extend(build_text_content(data, styles))
    else:
        columns, records = to_records(data)
        story.append(
            Paragraph("Dataset overview", styles["MedOrbitsHeading"])
        )
        story.append(
            Paragraph(
                f"Records: {len(records)} | Columns: {len(columns)}",
                styles["MedOrbitsBody"],
            )
        )
        story.append(Spacer(1, 2 * mm))
        available_width = (
            page_size[0] - document.leftMargin - document.rightMargin
        )
        story.append(
            make_table(
                columns,
                records,
                available_width,
                styles,
            )
        )
    document.build(
        story,
        onFirstPage=add_page_number,
        onLaterPages=add_page_number,
    )
def discover_inputs(
    input_path: Path,
    recursive: bool,
) -> list[Path]:
    input_path = input_path.expanduser().resolve()
    if input_path.is_file():
        if input_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            raise ValueError(
                f"Unsupported input file extension: {input_path.suffix}"
            )
        return [input_path]
    if not input_path.is_dir():
        raise FileNotFoundError(f"Input path does not exist: {input_path}")
    iterator = (
        input_path.rglob("*")
        if recursive
        else input_path.iterdir()
    )
    files = []
    for path in iterator:
        if not path.is_file():
            continue
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        if any(part in DEFAULT_EXCLUDED_DIRS for part in path.parts):
            continue
        files.append(path.resolve())
    return sorted(set(files))
def output_path_for(
    input_file: Path,
    input_root: Path,
    output_argument: Path | None,
    input_is_directory: bool,
) -> Path:
    if output_argument is None:
        return input_file.with_suffix(".pdf")
    output_argument = output_argument.expanduser().resolve()
    if input_is_directory or (
        output_argument.exists() and output_argument.is_dir()
    ):
        relative = input_file.relative_to(input_root)
        return output_argument / relative.with_suffix(".pdf")
    return output_argument
def atomic_generate_pdf(
    input_path: Path,
    output_path: Path,
    title: str,
    data: Any,
    landscape_mode: bool,
    overwrite: bool,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists() and not overwrite:
        raise FileExistsError(
            f"Output already exists: {output_path}. "
            "Use --overwrite or choose another path."
        )
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            suffix=".pdf",
            prefix=".medorbits-",
            dir=output_path.parent,
            delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
        generate_pdf(
            input_path,
            temporary_path,
            title,
            data,
            landscape_mode,
        )
        if output_path.exists() and not overwrite:
            raise FileExistsError(
                f"Output appeared during generation: {output_path}"
            )
        temporary_path.replace(output_path)
        temporary_path = None
    finally:
        if temporary_path:
            temporary_path.unlink(missing_ok=True)
def main() -> int:
    args = parse_args()
    input_path = args.input.expanduser().resolve()
    output_argument = (
        args.output.expanduser().resolve()
        if args.output
        else None
    )
    if input_path.is_file() and output_argument == input_path:
        print("ERROR: Input and output paths cannot be identical.", file=sys.stderr)
        return 2
    if args.report:
        report_path = args.report.expanduser().resolve()
    else:
        report_path = None
    try:
        files = discover_inputs(input_path, args.recursive)
    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    if not files:
        print("No supported input files found.")
        return 0
    input_is_directory = input_path.is_dir()
    input_root = input_path if input_is_directory else input_path.parent
    max_size_bytes = int(args.max_size_mb * 1024 * 1024)
    results = []
    succeeded = 0
    failed = 0
    print("MedOrbits PDF Generator")
    print(f"Input files: {len(files)}")
    print(f"Dry run: {'yes' if args.dry_run else 'no'}")
    print()
    for source in files:
        destination = output_path_for(
            source,
            input_root,
            output_argument,
            input_is_directory,
        )
        try:
            if destination.resolve() == source.resolve():
                raise ValueError("PDF output cannot overwrite its source.")
            if report_path and destination.resolve() == report_path:
                raise ValueError("PDF output cannot overwrite the report.")
            data = read_input(source, max_size_bytes)
            title = args.title or source.stem.replace("_", " ").replace("-", " ").title()
            if args.dry_run:
                print(f"[PLAN] {source} -> {destination}")
                status = "planned"
            else:
                atomic_generate_pdf(
                    source,
                    destination,
                    title,
                    data,
                    args.landscape,
                    args.overwrite,
                )
                print(f"[OK] {source} -> {destination}")
                status = "generated"
            succeeded += 1
            results.append(
                {
                    "input": str(source),
                    "output": str(destination),
                    "status": status,
                    "error": None,
                }
            )
        except (
            OSError,
            ValueError,
            UnicodeError,
            json.JSONDecodeError,
            csv.Error,
            TypeError,
        ) as exc:
            failed += 1
            print(f"[ERROR] {source}: {exc}")
            results.append(
                {
                    "input": str(source),
                    "output": str(destination),
                    "status": "failed",
                    "error": str(exc),
                }
            )
    report = {
        "metadata": {
            "tool": "MedOrbits PDF Generator",
            "version": VERSION,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "dryRun": args.dry_run,
        },
        "summary": {
            "filesDiscovered": len(files),
            "succeeded": succeeded,
            "failed": failed,
        },
        "results": results,
    }
    if report_path:
        try:
            if report_path in {path.resolve() for path in files}:
                raise ValueError("Report cannot overwrite an input file.")
            if not args.dry_run:
                if report_path.exists():
                    raise FileExistsError(
                        f"Report already exists: {report_path}"
                    )
                report_path.parent.mkdir(parents=True, exist_ok=True)
                report_path.write_text(
                    json.dumps(report, indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8",
                )
            print(f"\nReport: {report_path}")
        except (OSError, ValueError) as exc:
            failed += 1
            print(f"[ERROR] Report could not be written: {exc}")
    print("\nSummary")
    print(f"Generated/planned: {succeeded}")
    print(f"Failed:            {failed}")
    return 1 if failed else 0
if __name__ == "__main__":
    raise SystemExit(main())

# Installation and usage
#
# Install the dependency:
#
# python -m pip install reportlab
#
# Generate a PDF from one JSON dataset:
#
# python python/scripts/generate_pdf.py data/colleges.json \
#   --output reports/colleges.pdf \
#   --title "MedOrbits College Directory"
#
# Convert a CSV file:
#
# python python/scripts/generate_pdf.py data/jobs.csv \
#   --output reports/jobs.pdf \
#   --landscape
#
# Convert an entire directory:
#
# python python/scripts/generate_pdf.py data/ \
#   --output reports/ \
#   --recursive
#
# Preview without generating PDFs:
#
# python python/scripts/generate_pdf.py data/ \
#   --output reports/ \
#   --recursive \
#   --dry-run
#
# Generate a conversion report:
#
# python python/scripts/generate_pdf.py data/colleges.json \
#   --output reports/colleges.pdf \
#   --report reports/pdf-generation-report.json
#
# #
# # Implementation note: The PDF layout uses ReportLab's standard Helvetica fonts. Complex nested JSON values are rendered as serialized text within table cells; very wide datasets are best exported using --landscape or split into smaller reports.
