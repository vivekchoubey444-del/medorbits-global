
#!/usr/bin/env python3
"""
MedOrbits -- Real Data Importer, Exporter and Compilation Validator
=================================================================

File:
    tools/real_data_importer_and_exporter.py

Features:
    - Import JSON, CSV and JSON Lines (JSONL).
    - Export JSON, CSV and JSONL.
    - Convert data between supported formats.
    - Validate imported data before writing.
    - Preserve existing files by default.
    - Create timestamped backups before forced overwrites.
    - Atomic output writes.
    - Prevent paths from escaping the repository root.
    - Refuse symbolic links for source and destination files.
    - Compile-check Python source without executing it.
    - Generate machine-readable JSON reports.

Examples:
    python tools/real_data_importer_and_exporter.py --help

    python tools/real_data_importer_and_exporter.py import \
        assets/data/colleges.csv \
        assets/data/colleges.json

    python tools/real_data_importer_and_exporter.py import \
        assets/data/colleges.json \
        assets/data/colleges.jsonl

    python tools/real_data_importer_and_exporter.py export \
        assets/data/colleges.json \
        storage/exports/colleges.csv

    python tools/real_data_importer_and_exporter.py validate \
        assets/data/colleges.json

    python tools/real_data_importer_and_exporter.py compile

    python tools/real_data_importer_and_exporter.py compile \
        --path scripts \
        --path tools

Safety:
    - No automatic deletion.
    - No network access.
    - No execution of imported data.
    - No automatic database writes.
    - No silent overwriting of existing files.
    - Existing output requires --force and is backed up first.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import shutil
import sys
import tempfile
import time

from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCRIPT_PATH = Path(__file__).resolve()
REPO_ROOT = SCRIPT_PATH.parent.parent

SUPPORTED_EXTENSIONS = {".json", ".jsonl", ".csv"}
DEFAULT_EXPORT_DIR = REPO_ROOT / "storage" / "exports"
MAX_INPUT_BYTES = 100 * 1024 * 1024  # 100 MiB

EXIT_OK = 0
EXIT_ERROR = 1
EXIT_USAGE = 2


class DataToolError(Exception):
    """Expected, user-facing importer/exporter error."""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def log(message: str) -> None:
    print(f"[MedOrbits Data] {message}", file=sys.stderr)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def emit_json(value: Any) -> None:
    print(
        json.dumps(
            value,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )


def validate_repository() -> None:
    if not REPO_ROOT.is_dir():
        raise DataToolError(
            f"Repository root does not exist: {REPO_ROOT}"
        )


def resolve_repo_path(
    value: str,
    *,
    must_exist: bool,
    allow_repo_root: bool = False,
) -> Path:
    """
    Resolve a path inside the repository.

    Rejects traversal outside the repository and symbolic links in any
    existing path component.
    """
    raw = Path(value).expanduser()

    candidate = raw if raw.is_absolute() else REPO_ROOT / raw
    candidate = Path(os.path.abspath(candidate))

    try:
        candidate.relative_to(REPO_ROOT)
    except ValueError as exc:
        raise DataToolError(
            f"Path is outside the repository: {value}"
        ) from exc

    if candidate == REPO_ROOT and not allow_repo_root:
        raise DataToolError(
            "The repository root itself is not a valid file path."
        )

    current = REPO_ROOT

    try:
        relative = candidate.relative_to(REPO_ROOT)
    except ValueError as exc:
        raise DataToolError(
            f"Path is outside the repository: {value}"
        ) from exc

    for part in relative.parts:
        current = current / part

        if current.is_symlink():
            raise DataToolError(
                f"Symbolic links are not permitted: {current}"
            )

    if must_exist and not candidate.exists():
        raise DataToolError(f"File does not exist: {candidate}")

    if must_exist and not candidate.is_file():
        raise DataToolError(f"Expected a regular file: {candidate}")

    if must_exist:
        try:
            candidate.resolve(strict=True).relative_to(REPO_ROOT)
        except (ValueError, OSError) as exc:
            raise DataToolError(
                f"File resolves outside the repository: {candidate}"
            ) from exc

    return candidate


def read_input(path: Path) -> bytes:
    try:
        size = path.stat().st_size
    except OSError as exc:
        raise DataToolError(
            f"Cannot inspect input file: {exc}"
        ) from exc

    if size > MAX_INPUT_BYTES:
        raise DataToolError(
            f"Input exceeds the {MAX_INPUT_BYTES}-byte size limit."
        )

    try:
        data = path.read_bytes()
    except OSError as exc:
        raise DataToolError(
            f"Cannot read input file: {exc}"
        ) from exc

    if len(data) > MAX_INPUT_BYTES:
        raise DataToolError(
            "Input grew beyond the permitted size while being read."
        )

    return data


def decode_text(data: bytes, source: Path) -> str:
    try:
        # Accept a UTF-8 BOM commonly found in exported spreadsheets.
        return data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise DataToolError(
            f"{source} is not valid UTF-8 text."
        ) from exc


def parse_json(text: str, source: Path) -> Any:
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise DataToolError(
            f"Invalid JSON in {source}: "
            f"line {exc.lineno}, column {exc.colno}: {exc.msg}"
        ) from exc


def reject_nonstandard_json_constant(value: str) -> None:
    raise ValueError(f"Non-standard JSON constant: {value}")


def parse_json_strict(text: str, source: Path) -> Any:
    try:
        return json.loads(
            text,
            parse_constant=reject_nonstandard_json_constant,
        )
    except json.JSONDecodeError as exc:
        raise DataToolError(
            f"Invalid JSON in {source}: "
            f"line {exc.lineno}, column {exc.colno}: {exc.msg}"
        ) from exc
    except ValueError as exc:
        raise DataToolError(
            f"Invalid JSON in {source}: {exc}"
        ) from exc


def parse_jsonl(text: str, source: Path) -> list[Any]:
    records: list[Any] = []

    for line_number, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue

        try:
            value = json.loads(
                line,
                parse_constant=reject_nonstandard_json_constant,
            )
        except (json.JSONDecodeError, ValueError) as exc:
            raise DataToolError(
                f"Invalid JSONL in {source}, line {line_number}: {exc}"
            ) from exc

        records.append(value)

    return records


def parse_csv(text: str, source: Path) -> list[dict[str, str]]:
    stream = io.StringIO(text, newline="")

    try:
        reader = csv.DictReader(stream, strict=True)

        if not reader.fieldnames:
            raise DataToolError(
                f"CSV file has no header row: {source}"
            )

        headers = reader.fieldnames

        if any(header is None or not header.strip() for header in headers):
            raise DataToolError(
                f"CSV contains an empty column name: {source}"
            )

        if len(set(headers)) != len(headers):
            raise DataToolError(
                f"CSV contains duplicate column names: {source}"
            )

        rows: list[dict[str, str]] = []

        for line_number, row in enumerate(reader, start=2):
            if None in row:
                raise DataToolError(
                    f"CSV row {line_number} has more columns than the header."
                )

            if any(value is None for value in row.values()):
                raise DataToolError(
                    f"CSV row {line_number} has fewer columns than the header."
                )

            rows.append(dict(row))

        return rows

    except csv.Error as exc:
        raise DataToolError(
            f"Invalid CSV in {source}: {exc}"
        ) from exc


def load_data(path: Path) -> Any:
    extension = path.suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        raise DataToolError(
            f"Unsupported input extension: {extension or '(none)'}. "
            f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )

    text = decode_text(read_input(path), path)

    if extension == ".json":
        return parse_json_strict(text, path)

    if extension == ".jsonl":
        return parse_jsonl(text, path)

    if extension == ".csv":
        return parse_csv(text, path)

    raise DataToolError(f"Unsupported format: {extension}")


def validate_data(data: Any) -> dict[str, Any]:
    """
    Perform format-independent structural validation.

    This does not claim that records are factually accurate or conform
    to a project-specific schema.
    """
    errors: list[str] = []
    warnings: list[str] = []

    if isinstance(data, list):
        record_count = len(data)

        if not data:
            warnings.append("Dataset is empty.")

        non_object_indices = [
            index
            for index, item in enumerate(data)
            if not isinstance(item, Mapping)
        ]

        if non_object_indices:
            errors.append(
                "Record arrays contain non-object values at zero-based "
                f"indices: {non_object_indices[:20]}"
            )

        object_records = [
            item for item in data if isinstance(item, Mapping)
        ]

        if object_records:
            first_keys = set(object_records[0].keys())

            for index, record in enumerate(object_records[1:], start=1):
                if set(record.keys()) != first_keys:
                    warnings.append(
                        "Record fields differ from the first object "
                        f"at object-record index {index}."
                    )

    elif isinstance(data, Mapping):
        record_count = 1

        if not data:
            warnings.append("Top-level object is empty.")

    else:
        record_count = 0
        errors.append(
            "Top-level data must be a JSON object or an array of records."
        )

    return {
        "valid": not errors,
        "record_count": record_count,
        "errors": errors,
        "warnings": warnings,
    }


def normalize_for_records(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        if not all(isinstance(item, Mapping) for item in data):
            raise DataToolError(
                "CSV export requires an array of JSON objects."
            )

        return [dict(item) for item in data]

    if isinstance(data, Mapping):
        # Export a single object as one CSV row.
        return [dict(data)]

    raise DataToolError(
        "Export requires a JSON object or an array of JSON objects."
    )


def serialize_data(data: Any, extension: str) -> bytes:
    if extension == ".json":
        text = json.dumps(
            data,
            ensure_ascii=False,
            indent=2,
            allow_nan=False,
        ) + "\n"

        return text.encode("utf-8")

    records = normalize_for_records(data)

    if extension == ".jsonl":
        text = "".join(
            json.dumps(
                record,
                ensure_ascii=False,
                allow_nan=False,
                separators=(",", ":"),
            ) + "\n"
            for record in records
        )

        return text.encode("utf-8")

    if extension == ".csv":
        if not records:
            raise DataToolError(
                "Cannot infer CSV column names from an empty dataset."
            )

        headers: list[str] = []

        for record in records:
            for key in record:
                if not isinstance(key, str):
                    raise DataToolError(
                        "CSV column names must be strings."
                    )

                if key not in headers:
                    headers.append(key)

        stream = io.StringIO(newline="")
        writer = csv.DictWriter(
            stream,
            fieldnames=headers,
            extrasaction="raise",
            lineterminator="\n",
        )

        writer.writeheader()

        for record in records:
            output_row: dict[str, str] = {}

            for key, value in record.items():
                if value is None:
                    output_row[key] = ""
                elif isinstance(value, (dict, list)):
                    output_row[key] = json.dumps(
                        value,
                        ensure_ascii=False,
                        allow_nan=False,
                        separators=(",", ":"),
                    )
                elif isinstance(value, bool):
                    output_row[key] = "true" if value else "false"
                else:
                    output_row[key] = str(value)

            writer.writerow(output_row)

        return stream.getvalue().encode("utf-8")

    raise DataToolError(
        f"Unsupported output format: {extension}"
    )


def make_backup(path: Path) -> Path:
    """
    Copy an existing destination to a unique backup without overwriting
    any previous backup.
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    base = path.with_name(f"{path.name}.{timestamp}.bak")
    backup = base
    counter = 1

    while backup.exists():
        backup = path.with_name(
            f"{path.name}.{timestamp}.{counter}.bak"
        )
        counter += 1

    try:
        with path.open("rb") as source:
            with backup.open("xb") as target:
                shutil.copyfileobj(source, target)
                target.flush()
                os.fsync(target.fileno())
    except OSError as exc:
        try:
            if backup.exists():
                backup.unlink()
        except OSError:
            pass

        raise DataToolError(
            f"Failed to create destination backup: {exc}"
        ) from exc

    return backup


def atomic_write(
    destination: Path,
    content: bytes,
    *,
    force: bool,
    dry_run: bool,
) -> dict[str, Any]:
    if destination == REPO_ROOT:
        raise DataToolError("Destination cannot be the repository root.")

    if destination.exists() and not destination.is_file():
        raise DataToolError(
            f"Destination exists but is not a regular file: {destination}"
        )

    if destination.is_symlink():
        raise DataToolError(
            f"Symbolic-link destinations are not allowed: {destination}"
        )

    if destination.exists() and not force:
        raise DataToolError(
            f"Destination already exists: {destination}. "
            "Use --force to back it up before replacement."
        )

    result: dict[str, Any] = {
        "destination": str(destination.relative_to(REPO_ROOT)),
        "bytes": len(content),
        "sha256": sha256_bytes(content),
        "dry_run": dry_run,
        "backup": None,
        "written": False,
    }

    if dry_run:
        return result

    parent = destination.parent

    if not parent.exists():
        parent.mkdir(parents=True, exist_ok=True)

    # Revalidate after creating parent directories.
    destination = resolve_repo_path(
        str(destination),
        must_exist=False,
    )

    if destination.exists() and not force:
        raise DataToolError(
            f"Destination appeared during operation: {destination}"
        )

    backup: Path | None = None

    if destination.exists():
        backup = make_backup(destination)
        result["backup"] = str(backup.relative_to(REPO_ROOT))

    fd = -1
    temp_path: Path | None = None

    try:
        fd, temp_name = tempfile.mkstemp(
            prefix=f".{destination.name}.",
            suffix=".tmp",
            dir=str(parent),
        )
        temp_path = Path(temp_name)

        with os.fdopen(fd, "wb") as output:
            fd = -1
            output.write(content)
            output.flush()
            os.fsync(output.fileno())

        # Ensure the generated file is readable and byte-for-byte correct.
        if temp_path.read_bytes() != content:
            raise DataToolError(
                "Temporary output verification failed."
            )

        # Avoid silently replacing a destination created concurrently.
        if destination.exists() and backup is None:
            raise DataToolError(
                "Destination appeared during operation; refusing to overwrite."
            )

        os.replace(temp_path, destination)
        temp_path = None

        result["written"] = True

        return result

    except DataToolError:
        raise
    except OSError as exc:
        raise DataToolError(
            f"Failed to write output: {exc}"
        ) from exc
    finally:
        if fd >= 0:
            os.close(fd)

        if temp_path is not None:
            try:
                temp_path.unlink(missing_ok=True)
            except OSError:
                log(f"Warning: could not remove temporary file {temp_path}")


def command_validate(args: argparse.Namespace) -> int:
    source = resolve_repo_path(args.source, must_exist=True)
    data = load_data(source)
    report = validate_data(data)

    report.update(
        {
            "source": str(source.relative_to(REPO_ROOT)),
            "format": source.suffix.lower().lstrip("."),
            "sha256": sha256_bytes(read_input(source)),
            "checked_at": utc_now(),
        }
    )

    emit_json(report)

    return EXIT_OK if report["valid"] else EXIT_ERROR


def command_import(args: argparse.Namespace) -> int:
    source = resolve_repo_path(args.source, must_exist=True)
    destination = resolve_repo_path(
        args.destination,
        must_exist=False,
    )

    if source == destination:
        raise DataToolError(
            "Source and destination must be different files."
        )

    source_data = read_input(source)
    data = load_data(source)

    validation = validate_data(data)

    if not validation["valid"]:
        emit_json(
            {
                "status": "rejected",
                "source": str(source.relative_to(REPO_ROOT)),
                "validation": validation,
            }
        )
        return EXIT_ERROR

    output = serialize_data(data, destination.suffix.lower())

    # Revalidate the serialized JSON/JSONL/CSV before writing.
    # CSV fields are strings by design; JSON numeric/boolean types are
    # preserved only in JSON and JSONL.
    with tempfile.NamedTemporaryFile(
        mode="wb",
        suffix=destination.suffix.lower(),
        delete=False,
    ) as check_file:
        check_path = Path(check_file.name)
        check_file.write(output)

    try:
        if destination.suffix.lower() in {".json", ".jsonl", ".csv"}:
            check_data = load_data(check_path)
            check_validation = validate_data(check_data)

            if not check_validation["valid"]:
                raise DataToolError(
                    "Serialized output did not pass structural validation."
                )
    finally:
        check_path.unlink(missing_ok=True)

    result = atomic_write(
        destination,
        output,
        force=args.force,
        dry_run=args.dry_run,
    )

    emit_json(
        {
            "status": "preview" if args.dry_run else "imported",
            "source": str(source.relative_to(REPO_ROOT)),
            "source_sha256": sha256_bytes(source_data),
            "validation": validation,
            "output": result,
            "completed_at": utc_now(),
        }
    )

    return EXIT_OK


def command_export(args: argparse.Namespace) -> int:
    source = resolve_repo_path(args.source, must_exist=True)
    destination = resolve_repo_path(
        args.destination,
        must_exist=False,
    )

    if source == destination:
        raise DataToolError(
            "Source and destination must be different files."
        )

    data = load_data(source)
    validation = validate_data(data)

    if not validation["valid"]:
        raise DataToolError(
            "Source data failed validation: "
            + "; ".join(validation["errors"])
        )

    output = serialize_data(data, destination.suffix.lower())

    result = atomic_write(
        destination,
        output,
        force=args.force,
        dry_run=args.dry_run,
    )

    emit_json(
        {
            "status": "preview" if args.dry_run else "exported",
            "source": str(source.relative_to(REPO_ROOT)),
            "validation": validation,
            "output": result,
            "completed_at": utc_now(),
        }
    )

    return EXIT_OK


def iter_python_files(paths: list[str]) -> list[Path]:
    files: set[Path] = set()

    if not paths:
        paths = ["."]

    for item in paths:
        path = resolve_repo_path(
            item,
            must_exist=True,
            allow_repo_root=True,
        )

        if path.is_file():
            if path.suffix == ".py":
                files.add(path)
            else:
                raise DataToolError(
                    f"Compilation target is not a Python file: {path}"
                )
            continue

        for candidate in path.rglob("*.py"):
            # Never traverse symlinked files or directories.
            relative = candidate.relative_to(REPO_ROOT)
            current = REPO_ROOT
            skip = False

            for part in relative.parts:
                current = current / part
                if current.is_symlink():
                    skip = True
                    break

            if skip or not candidate.is_file():
                continue

            files.add(candidate)

    return sorted(files)


def command_compile(args: argparse.Namespace) -> int:
    files = iter_python_files(args.path)
    errors: list[dict[str, str]] = []
    passed = 0

    for path in files:
        try:
            source = read_input(path).decode("utf-8-sig")
            compile(
                source,
                str(path.relative_to(REPO_ROOT)),
                "exec",
                dont_inherit=True,
            )
            passed += 1

        except (SyntaxError, UnicodeDecodeError, DataToolError) as exc:
            errors.append(
                {
                    "file": str(path.relative_to(REPO_ROOT)),
                    "error": str(exc),
                }
            )

    report = {
        "status": "passed" if not errors else "failed",
        "checked_at": utc_now(),
        "files_checked": len(files),
        "files_passed": passed,
        "files_failed": len(errors),
        "errors": errors,
        "execution_performed": False,
        "bytecode_written": False,
    }

    emit_json(report)

    return EXIT_OK if not errors else EXIT_ERROR


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Safely import, export, validate, and compile-check "
            "MedOrbits repository data."
        )
    )

    parser.add_argument(
        "--version",
        action="version",
        version="MedOrbits Data Tools 1.0.0",
    )

    subparsers = parser.add_subparsers(
        dest="command",
        required=True,
    )

    def add_write_options(command_parser: argparse.ArgumentParser) -> None:
        command_parser.add_argument(
            "--force",
            action="store_true",
            help="Back up an existing destination before replacing it.",
        )
        command_parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate and preview without writing output.",
        )

    import_parser = subparsers.add_parser(
        "import",
        help="Import and convert a JSON, JSONL, or CSV file.",
    )
    import_parser.add_argument("source")
    import_parser.add_argument("destination")
    add_write_options(import_parser)
    import_parser.set_defaults(handler=command_import)

    export_parser = subparsers.add_parser(
        "export",
        help="Export a supported dataset to another format.",
    )
    export_parser.add_argument("source")
    export_parser.add_argument("destination")
    add_write_options(export_parser)
    export_parser.set_defaults(handler=command_export)

    validate_parser = subparsers.add_parser(
        "validate",
        help="Validate a supported data file.",
    )
    validate_parser.add_argument("source")
    validate_parser.set_defaults(handler=command_validate)

    compile_parser = subparsers.add_parser(
        "compile",
        help="Compile-check Python files without executing them.",
    )
    compile_parser.add_argument(
        "--path",
        action="append",
        default=[],
        help=(
            "Repository-relative Python file or directory. "
            "Can be specified multiple times; defaults to the repository."
        ),
    )
    compile_parser.set_defaults(handler=command_compile)

    return parser


def main() -> int:
    try:
        validate_repository()
        parser = build_parser()
        args = parser.parse_args()
        return int(args.handler(args))

    except DataToolError as exc:
        log(str(exc))
        return EXIT_ERROR

    except KeyboardInterrupt:
        log("Interrupted; no further work will be started.")
        return 130

    except OSError as exc:
        log(f"Operating system error: {exc}")
        return EXIT_ERROR


if __name__ == "__main__":
    raise SystemExit(main())
