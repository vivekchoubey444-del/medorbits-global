
#!/usr/bin/env python3
"""
MedOrbits JSON Validator
========================

Purpose:
    Validate JSON files and MedOrbits dataset structures.

Features:
    - Recursive JSON discovery with deterministic ordering.
    - Strict JSON parsing with duplicate-key detection.
    - UTF-8 and UTF-8 BOM support.
    - Rejection of NaN, Infinity, and -Infinity.
    - Optional required-field validation.
    - Filename-based MedOrbits dataset rules.
    - Duplicate identifier detection within individual files.
    - JSON object/array validation.
    - Configurable file-size and nesting-depth limits.
    - Symbolic-link avoidance during source discovery.
    - Optional machine-readable JSON reports.
    - Atomic report writes and safe overwrite handling.
    - Read-only source validation.
    - Standard library only.
    - Python 3.12+.

Usage:
    python python/scripts/validate_json.py
    python python/scripts/validate_json.py --root assets/data
    python python/scripts/validate_json.py --root assets/data --strict
    python python/scripts/validate_json.py --root assets/data --check-ids
    python python/scripts/validate_json.py --required name,state
    python python/scripts/validate_json.py --no-default-required
    python python/scripts/validate_json.py --max-file-bytes 10485760
    python python/scripts/validate_json.py --max-depth 100
    python python/scripts/validate_json.py --report reports/json-validation.json
    python python/scripts/validate_json.py --report reports/json-validation.json --overwrite

Exit codes:
    0 = Validation passed.
    1 = Validation findings were detected.
    2 = Invalid configuration or execution failure.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile

from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


TOOL_NAME = "MedOrbits JSON Validator"
TOOL_VERSION = "2.0.0"

DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024
DEFAULT_MAX_DEPTH = 100

DEFAULT_EXCLUDED_DIRS = frozenset(
    {
        ".git",
        ".hg",
        ".svn",
        ".venv",
        "venv",
        "__pycache__",
        "node_modules",
        "build",
        "dist",
        ".pytest_cache",
        ".mypy_cache",
        ".ruff_cache",
    }
)

DEFAULT_REQUIRED_FIELDS: dict[str, tuple[str, ...]] = {
    "colleges.json": ("name",),
    "universities.json": ("name",),
    "courses.json": ("name",),
    "jobs.json": ("title",),
    "entrance-exams.json": ("name",),
    "scholarships.json": ("name",),
    "documents.json": ("name",),
    "services.json": ("name",),
    "countries.json": ("name",),
}

DEFAULT_ID_FIELDS = (
    "id",
    "college_id",
    "university_id",
    "course_id",
    "job_id",
)

RECORD_CONTAINER_KEYS = (
    "records",
    "data",
    "items",
    "results",
)


class DuplicateJSONKeyError(ValueError):
    """Raised when a JSON object contains a repeated key."""


class ValidationConfigurationError(Exception):
    """Raised when validator configuration or paths are invalid."""


def utc_now() -> str:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def reject_duplicate_keys(
    pairs: list[tuple[str, Any]],
) -> dict[str, Any]:
    """Reject duplicate keys instead of silently overwriting values."""
    result: dict[str, Any] = {}

    for key, value in pairs:
        if key in result:
            raise DuplicateJSONKeyError(
                f"Duplicate JSON object key: {key!r}"
            )

        result[key] = value

    return result


def reject_invalid_constant(value: str) -> None:
    """Reject non-standard JSON constants."""
    raise ValueError(
        f"Non-standard JSON constant is not permitted: {value}"
    )


def resolve_input_path(path: Path) -> Path:
    """Resolve and validate the source path without accepting a symlink."""
    expanded = path.expanduser()

    if expanded.is_symlink():
        raise ValidationConfigurationError(
            f"Symbolic-link input is not permitted: {expanded}"
        )

    try:
        resolved = expanded.resolve(strict=True)
    except OSError as exc:
        raise ValidationConfigurationError(
            f"Cannot resolve input path: {expanded}"
        ) from exc

    if not resolved.is_file() and not resolved.is_dir():
        raise ValidationConfigurationError(
            f"Input must be a regular file or directory: {resolved}"
        )

    if resolved.is_file() and resolved.suffix.lower() != ".json":
        raise ValidationConfigurationError(
            f"Input file must have a .json extension: {resolved}"
        )

    return resolved


def resolve_report_path(path: Path | None) -> Path | None:
    """Resolve a report destination and reject an existing symlink."""
    if path is None:
        return None

    expanded = path.expanduser()

    if expanded.is_symlink():
        raise ValidationConfigurationError(
            f"Symbolic-link report destinations are not permitted: "
            f"{expanded}"
        )

    try:
        output = expanded.resolve(strict=False)
    except OSError as exc:
        raise ValidationConfigurationError(
            f"Cannot resolve report path: {expanded}"
        ) from exc

    if output.exists() and not output.is_file():
        raise ValidationConfigurationError(
            f"Report destination must be a regular file: {output}"
        )

    return output


def discover_json_files(
    root: Path,
    excluded_dirs: set[str] | frozenset[str],
    report_path: Path | None = None,
) -> list[Path]:
    """
    Discover JSON files deterministically.

    Directory symlinks and file symlinks are skipped. The report file,
    if located inside the scanned directory, is excluded.
    """
    root = resolve_input_path(root)

    if report_path is not None:
        report_path = report_path.resolve(strict=False)

    if root.is_file():
        if report_path is not None and root == report_path:
            raise ValidationConfigurationError(
                "The report destination cannot overwrite the input file."
            )

        return [root]

    files: list[Path] = []

    for directory, dirnames, filenames in os.walk(
        root,
        topdown=True,
        followlinks=False,
    ):
        current_dir = Path(directory)

        # Do not traverse excluded directories or directory symlinks.
        retained_dirs: list[str] = []

        for name in sorted(dirnames):
            candidate = current_dir / name

            if name in excluded_dirs:
                continue

            if candidate.is_symlink():
                continue

            retained_dirs.append(name)

        dirnames[:] = retained_dirs

        for filename in sorted(filenames):
            if not filename.lower().endswith(".json"):
                continue

            path = current_dir / filename

            if path.is_symlink():
                continue

            try:
                resolved = path.resolve(strict=True)
            except OSError:
                # Keep unreadable regular files discoverable so the
                # validator can report a read failure.
                resolved = path.absolute()

            if report_path is not None and resolved == report_path:
                continue

            try:
                resolved.relative_to(root)
            except ValueError:
                continue

            files.append(resolved)

    return sorted(files, key=lambda item: item.as_posix())


def measure_json_depth(document: Any) -> int:
    """
    Return the maximum nested JSON container depth.

    Scalars have depth 0. The outermost object or array has depth 1.
    """
    maximum = 0
    stack: list[tuple[Any, int]] = [(document, 0)]

    while stack:
        value, parent_depth = stack.pop()

        if isinstance(value, dict):
            depth = parent_depth + 1
            maximum = max(maximum, depth)

            for child in value.values():
                if isinstance(child, (dict, list)):
                    stack.append((child, depth))

        elif isinstance(value, list):
            depth = parent_depth + 1
            maximum = max(maximum, depth)

            for child in value:
                if isinstance(child, (dict, list)):
                    stack.append((child, depth))

    return maximum


def load_json(
    path: Path,
    *,
    max_file_bytes: int = DEFAULT_MAX_FILE_BYTES,
    max_depth: int = DEFAULT_MAX_DEPTH,
    require_object_or_array: bool = True,
) -> Any:
    """Read and strictly parse one JSON file."""
    try:
        if path.is_symlink():
            raise ValueError("Symbolic-link source files are not permitted.")

        if not path.is_file():
            raise ValueError("Source is not a regular file.")

        size = path.stat().st_size

        if size > max_file_bytes:
            raise ValueError(
                f"File exceeds the size limit of {max_file_bytes} bytes "
                f"(actual size: {size} bytes)."
            )

        with path.open("r", encoding="utf-8-sig", newline=None) as handle:
            document = json.load(
                handle,
                object_pairs_hook=reject_duplicate_keys,
                parse_constant=reject_invalid_constant,
            )

    except DuplicateJSONKeyError as exc:
        raise ValueError(str(exc)) from exc

    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Invalid JSON at line {exc.lineno}, "
            f"column {exc.colno}: {exc.msg}"
        ) from exc

    except UnicodeDecodeError as exc:
        raise ValueError(
            f"File is not valid UTF-8: byte position {exc.start}."
        ) from exc

    except RecursionError as exc:
        raise ValueError(
            "JSON nesting exceeds the parser's safe recursion capacity."
        ) from exc

    except OSError as exc:
        raise ValueError(
            f"Cannot read file ({type(exc).__name__})."
        ) from exc

    if require_object_or_array and not isinstance(document, (dict, list)):
        raise ValueError(
            "Top-level JSON value must be an object or an array."
        )

    try:
        depth = measure_json_depth(document)
    except RecursionError as exc:
        raise ValueError(
            "JSON nesting exceeds the supported processing capacity."
        ) from exc

    if depth > max_depth:
        raise ValueError(
            f"JSON nesting depth {depth} exceeds the configured "
            f"maximum of {max_depth}."
        )

    return document


def normalize_required_fields(
    value: str | None,
) -> tuple[str, ...]:
    """Parse a comma-separated list of required field names."""
    if value is None:
        return ()

    fields = tuple(
        dict.fromkeys(
            field.strip()
            for field in value.split(",")
            if field.strip()
        )
    )

    if not fields:
        raise ValidationConfigurationError(
            "--required must contain at least one non-empty field name."
        )

    invalid_fields = [
        field
        for field in fields
        if any(ord(character) < 32 for character in field)
    ]

    if invalid_fields:
        raise ValidationConfigurationError(
            "--required contains an invalid field name."
        )

    return fields


def validate_required_fields(
    document: Any,
    required_fields: tuple[str, ...],
) -> list[str]:
    """Validate required fields on the document's top-level records."""
    if not required_fields:
        return []

    if isinstance(document, list):
        records = document

    elif isinstance(document, dict):
        records = None

        for key in RECORD_CONTAINER_KEYS:
            if isinstance(document.get(key), list):
                records = document[key]
                break

        if records is None:
            records = [document]

    else:
        return [
            "Required-field validation expects an object or array."
        ]

    findings: list[str] = []

    for index, record in enumerate(records):
        if not isinstance(record, dict):
            findings.append(
                f"Record {index}: expected an object, "
                f"got {type(record).__name__}."
            )
            continue

        for field in required_fields:
            value = record.get(field)

            if value is None:
                findings.append(
                    f"Record {index}: missing required field {field!r}."
                )

            elif isinstance(value, str) and not value.strip():
                findings.append(
                    f"Record {index}: required field {field!r} is empty."
                )

    return findings


def walk_records(document: Any) -> list[dict[str, Any]]:
    """Extract records from supported top-level dataset structures."""
    if isinstance(document, list):
        return [
            item for item in document
            if isinstance(item, dict)
        ]

    if not isinstance(document, dict):
        return []

    for key in RECORD_CONTAINER_KEYS:
        value = document.get(key)

        if isinstance(value, list):
            return [
                item for item in value
                if isinstance(item, dict)
            ]

    return [document]


def validate_duplicate_ids(
    document: Any,
    id_fields: tuple[str, ...] = DEFAULT_ID_FIELDS,
) -> list[str]:
    """
    Detect duplicate values for each identifier field.

    Boolean values are deliberately excluded because bool is a subclass
    of int in Python. Different identifier fields are checked separately.
    """
    records = walk_records(document)

    seen: dict[tuple[str, str], list[int]] = defaultdict(list)

    for index, record in enumerate(records):
        for field in id_fields:
            value = record.get(field)

            if isinstance(value, bool):
                continue

            if not isinstance(value, (str, int)):
                continue

            normalized = str(value).strip()

            if normalized:
                seen[(field, normalized)].append(index)

    findings: list[str] = []

    for (field, value), indexes in sorted(seen.items()):
        if len(indexes) > 1:
            findings.append(
                f"Duplicate {field}={value!r} in records "
                f"{', '.join(map(str, indexes))}."
            )

    return findings


def required_fields_for_file(
    path: Path,
    custom_fields: tuple[str, ...],
    use_defaults: bool,
) -> tuple[str, ...]:
    """Resolve required fields from explicit settings or filename rules."""
    if custom_fields:
        return custom_fields

    if use_defaults:
        return DEFAULT_REQUIRED_FIELDS.get(path.name.lower(), ())

    return ()


def write_report(
    output: Path,
    report: dict[str, Any],
    *,
    overwrite: bool = False,
) -> None:
    """
    Write a JSON report atomically.

    Existing destinations are preserved unless overwrite is explicitly
    enabled. Without overwrite, the final file is created using an
    atomic hard-link operation so an existing file is not replaced by
    a check-then-write race.
    """
    output = resolve_report_path(output)

    if output is None:
        raise ValidationConfigurationError(
            "A report destination is required."
        )

    if output.exists() and not overwrite:
        raise ValidationConfigurationError(
            f"Report already exists: {output}. Use --overwrite to replace it."
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

            json.dump(
                report,
                handle,
                indent=2,
                ensure_ascii=False,
                allow_nan=False,
            )

            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())

        if overwrite:
            # Recheck the path to avoid replacing a symlink introduced
            # after initial validation.
            if output.is_symlink():
                raise ValidationConfigurationError(
                    "Report destination became a symbolic link."
                )

            os.replace(temporary, output)
            temporary = None

        else:
            # Creating a hard link fails if the destination already exists.
            # This prevents silently replacing an existing report.
            os.link(temporary, output)
            temporary.unlink()
            temporary = None

    except ValidationConfigurationError:
        raise

    except FileExistsError as exc:
        raise ValidationConfigurationError(
            f"Report already exists: {output}. Use --overwrite to replace it."
        ) from exc

    except OSError as exc:
        raise ValidationConfigurationError(
            f"Could not write report ({type(exc).__name__}): {exc}"
        ) from exc

    finally:
        if temporary is not None:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass


def build_parser() -> argparse.ArgumentParser:
    """Create the command-line interface."""
    parser = argparse.ArgumentParser(
        description="Validate MedOrbits JSON files and datasets.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        "--root",
        type=Path,
        default=Path("assets/data"),
        help="JSON file or directory to validate.",
    )

    parser.add_argument(
        "--required",
        help="Comma-separated required fields, for example: name,state.",
    )

    parser.add_argument(
        "--no-default-required",
        action="store_true",
        help="Disable filename-based required-field checks.",
    )

    parser.add_argument(
        "--check-ids",
        action="store_true",
        help="Check duplicate identifiers within each file.",
    )

    parser.add_argument(
        "--strict",
        action="store_true",
        help=(
            "Enable duplicate-ID checks and filename-based required fields. "
            "Explicit --no-default-required disables filename-based rules."
        ),
    )

    parser.add_argument(
        "--report",
        type=Path,
        help="Optional JSON report destination.",
    )

    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow replacing an existing report.",
    )

    parser.add_argument(
        "--exclude-dir",
        action="append",
        default=[],
        help="Additional directory name to exclude; repeat as needed.",
    )

    parser.add_argument(
        "--max-file-bytes",
        type=int,
        default=DEFAULT_MAX_FILE_BYTES,
        help="Maximum permitted JSON file size in bytes.",
    )

    parser.add_argument(
        "--max-depth",
        type=int,
        default=DEFAULT_MAX_DEPTH,
        help="Maximum nested JSON container depth.",
    )

    parser.add_argument(
        "--allow-json-scalars",
        action="store_true",
        help="Allow top-level JSON strings, numbers, booleans, or null.",
    )

    return parser


def validate_arguments(args: argparse.Namespace) -> None:
    """Validate options before accessing source files."""
    if args.max_file_bytes < 1:
        raise ValidationConfigurationError(
            "--max-file-bytes must be greater than zero."
        )

    if args.max_depth < 1:
        raise ValidationConfigurationError(
            "--max-depth must be greater than zero."
        )

    for name in args.exclude_dir:
        if (
            not name
            or name in {".", ".."}
            or "/" in name
            or "\\" in name
        ):
            raise ValidationConfigurationError(
                f"Invalid directory name supplied to --exclude-dir: {name!r}"
            )

    normalize_required_fields(args.required)


def make_file_result(
    root: Path,
    path: Path,
    findings: list[str],
) -> dict[str, Any]:
    """Build a consistent report record without exposing file contents."""
    if root.is_dir():
        try:
            display_path = path.relative_to(root).as_posix()
        except ValueError:
            display_path = path.name
    else:
        display_path = path.name

    return {
        "file": display_path,
        "valid": not findings,
        "findingCount": len(findings),
        "findings": findings,
    }


def validate_file(
    path: Path,
    *,
    root: Path,
    custom_fields: tuple[str, ...],
    use_defaults: bool,
    check_ids: bool,
    max_file_bytes: int,
    max_depth: int,
    require_object_or_array: bool,
) -> dict[str, Any]:
    """Validate one discovered JSON file."""
    try:
        document = load_json(
            path,
            max_file_bytes=max_file_bytes,
            max_depth=max_depth,
            require_object_or_array=require_object_or_array,
        )

        findings = validate_required_fields(
            document,
            required_fields_for_file(
                path,
                custom_fields,
                use_defaults,
            ),
        )

        if check_ids:
            findings.extend(
                validate_duplicate_ids(
                    document,
                    DEFAULT_ID_FIELDS,
                )
            )

    except ValueError as exc:
        findings = [str(exc)]

    return make_file_result(root, path, findings)


def build_report(
    root: Path,
    results: list[dict[str, Any]],
) -> dict[str, Any]:
    """Create a deterministic report structure apart from its timestamp."""
    valid_count = sum(
        1 for result in results
        if result["valid"]
    )

    invalid_count = len(results) - valid_count

    finding_count = sum(
        result["findingCount"]
        for result in results
    )

    return {
        "schemaVersion": "1.0.0",
        "metadata": {
            "tool": TOOL_NAME,
            "toolVersion": TOOL_VERSION,
            "generatedAtUtc": utc_now(),
            "root": str(root),
            "filesDiscovered": len(results),
            "filesValid": valid_count,
            "filesInvalid": invalid_count,
            "findingCount": finding_count,
        },
        "results": results,
    }


def print_summary(report: dict[str, Any]) -> None:
    """Print a human-readable validation summary."""
    metadata = report["metadata"]

    print(TOOL_NAME)
    print("=" * len(TOOL_NAME))
    print(f"Files discovered: {metadata['filesDiscovered']}")
    print(f"Valid files:      {metadata['filesValid']}")
    print(f"Invalid files:    {metadata['filesInvalid']}")
    print(f"Findings:         {metadata['findingCount']}")
    print()

    for result in report["results"]:
        status = "PASS" if result["valid"] else "FAIL"
        print(f"[{status}] {result['file']}")

        for finding in result["findings"]:
            print(f"  - {finding}")

    if metadata["findingCount"]:
        print("\nStatus: VALIDATION FAILED")
    else:
        print("\nStatus: VALIDATION PASSED")


def main(argv: list[str] | None = None) -> int:
    """Run the validator and return the documented exit code."""
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        validate_arguments(args)

        root = resolve_input_path(args.root)
        report_path = resolve_report_path(args.report)

        files = discover_json_files(
            root,
            DEFAULT_EXCLUDED_DIRS | set(args.exclude_dir),
            report_path,
        )

        if not files:
            print(
                f"ERROR: No JSON files found under {root}.",
                file=sys.stderr,
            )
            return 2

        custom_fields = normalize_required_fields(args.required)

        use_defaults = not args.no_default_required

        check_ids = args.check_ids or args.strict

        results = [
            validate_file(
                path,
                root=root,
                custom_fields=custom_fields,
                use_defaults=use_defaults,
                check_ids=check_ids,
                max_file_bytes=args.max_file_bytes,
                max_depth=args.max_depth,
                require_object_or_array=not args.allow_json_scalars,
            )
            for path in files
        ]

        report = build_report(root, results)

        print_summary(report)

        if report_path is not None:
            write_report(
                report_path,
                report,
                overwrite=args.overwrite,
            )
            print(f"\nReport saved: {report_path}")

        if report["metadata"]["findingCount"] > 0:
            return 1

        return 0

    except ValidationConfigurationError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    except KeyboardInterrupt:
        print("\nERROR: Validation interrupted.", file=sys.stderr)
        return 2

    except OSError as exc:
        print(
            f"ERROR: Filesystem operation failed ({type(exc).__name__}).",
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
