
#!/usr/bin/env python3
"""Validate MedOrbits JSON datasets and structured application data.

Features:
    - Validate JSON syntax and UTF-8 encoding.
    - Optionally validate data against a JSON Schema.
    - Check required fields and duplicate identifiers.
    - Support JSON files and directories of JSON datasets.
    - Emit machine-readable JSON reports.
    - Avoid printing secret values or modifying source files.

Examples:
    python python/scr/scripts/validation_data.py data/colleges.json
    python python/scr/scripts/validation_data.py data/jobs.json \
        --required id title
    python python/scr/scripts/validation_data.py data/jobs.json \
        --schema api/schemas/job.schema.json
    python python/scr/scripts/validation_data.py data/ \
        --recursive --report validation-report.json
    python python/scr/scripts/validation_data.py data/jobs.json \
        --id-field id --strict

Optional dependency:
    python -m pip install jsonschema

Exit codes:
    0: Validation passed.
    1: One or more validation errors were found.
    2: Invalid arguments or operational error.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence


TOOL_NAME = "MedOrbits Data Validator"
TOOL_VERSION = "1.0.0"

DEFAULT_EXCLUDED_DIRS = frozenset(
    {
        ".git",
        ".hg",
        ".svn",
        ".venv",
        "venv",
        "__pycache__",
        "node_modules",
        "dist",
        "build",
        "coverage",
        ".pytest_cache",
        ".mypy_cache",
        ".ruff_cache",
    }
)

SECRET_NAME_FRAGMENTS = (
    "password",
    "passwd",
    "secret",
    "token",
    "credential",
    "private_key",
    "apikey",
    "api_key",
)

MAX_ERROR_VALUE_LENGTH = 160


@dataclass(frozen=True)
class ValidationIssue:
    """A safe, structured validation finding."""

    code: str
    message: str
    path: str = "$"
    severity: str = "error"


@dataclass
class FileValidationResult:
    """Validation outcome for a single JSON file."""

    file: str
    valid: bool = True
    bytes_read: int = 0
    record_count: int | None = None
    issues: list[ValidationIssue] = field(default_factory=list)

    def add_issue(
        self,
        code: str,
        message: str,
        *,
        path: str = "$",
        severity: str = "error",
    ) -> None:
        """Record a validation issue and update the validity flag."""
        self.issues.append(
            ValidationIssue(
                code=code,
                message=message,
                path=path,
                severity=severity,
            )
        )

        if severity == "error":
            self.valid = False


@dataclass
class ValidationReport:
    """Summary of a validation run."""

    tool: str
    version: str
    generated_at: str
    valid: bool
    files_checked: int
    files_passed: int
    files_failed: int
    total_errors: int
    total_warnings: int
    results: list[FileValidationResult]

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable report."""
        return asdict(self)


def _safe_path(path: Path, root: Path | None = None) -> str:
    """Format a path without exposing unrelated absolute filesystem paths."""
    try:
        resolved = path.resolve()

        if root is not None:
            return resolved.relative_to(root.resolve()).as_posix()

        return path.name or "."

    except (OSError, ValueError, RuntimeError):
        return path.name or "<path>"


def _is_secret_name(name: str) -> bool:
    """Identify field names that should not be printed in diagnostics."""
    normalized = name.lower().replace("-", "_")

    return any(fragment in normalized for fragment in SECRET_NAME_FRAGMENTS)


def _safe_field_name(name: str) -> str:
    """Avoid exposing sensitive property names in diagnostics."""
    if _is_secret_name(name):
        return "[redacted-field]"

    return name[:MAX_ERROR_VALUE_LENGTH]


def _reject_duplicate_json_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    """Reject duplicate object keys rather than silently keeping the last value."""
    result: dict[str, Any] = {}

    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON object key detected.")

        result[key] = value

    return result


def load_json_file(path: Path) -> tuple[Any | None, str | None, int]:
    """Read and parse JSON, returning a safe error without file contents."""
    try:
        raw = path.read_bytes()
    except OSError:
        return None, "Unable to read file; check its existence and permissions.", 0

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return None, "File is not valid UTF-8 text.", len(raw)

    try:
        value = json.loads(
            text,
            object_pairs_hook=_reject_duplicate_json_keys,
            parse_constant=_reject_nonstandard_constant,
        )
    except (json.JSONDecodeError, ValueError, RecursionError):
        return (
            None,
            "Invalid JSON syntax, duplicate object key, or non-standard numeric value.",
            len(raw),
        )

    return value, None, len(raw)


def _reject_nonstandard_constant(value: str) -> None:
    """Reject non-standard JSON values such as NaN and Infinity."""
    raise ValueError(f"Non-standard numeric constant: {value}")


def _json_type(value: Any) -> str:
    """Return a JSON-oriented type name."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, str):
        return "string"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"

    return "unsupported"


def _json_pointer(parts: Iterable[str | int]) -> str:
    """Format a JSON Pointer path."""
    escaped = [
        str(part).replace("~", "~0").replace("/", "~1")
        for part in parts
    ]

    return "/" + "/".join(escaped) if escaped else "$"


def _validate_required_fields(
    data: Any,
    required_fields: Sequence[str],
    result: FileValidationResult,
) -> None:
    """Validate required fields on an object or every object in an array."""
    if not required_fields:
        return

    records = data if isinstance(data, list) else [data]

    for index, record in enumerate(records):
        if not isinstance(record, dict):
            result.add_issue(
                "record_not_object",
                "Record must be a JSON object to check required fields.",
                path=f"/{index}" if isinstance(data, list) else "$",
            )
            continue

        for name in required_fields:
            if name not in record or record[name] is None:
                safe_name = _safe_field_name(name)

                result.add_issue(
                    "required_field_missing",
                    f"Required field is missing or null: {safe_name}.",
                    path=(
                        _json_pointer([index, safe_name])
                        if isinstance(data, list)
                        else _json_pointer([safe_name])
                    ),
                )


def _validate_duplicate_ids(
    data: Any,
    id_field: str,
    result: FileValidationResult,
) -> None:
    """Detect duplicate identifiers in a JSON object collection."""
    records = data if isinstance(data, list) else [data]
    seen: dict[str, int] = {}

    for index, record in enumerate(records):
        if not isinstance(record, dict):
            continue

        if id_field not in record or record[id_field] is None:
            continue

        identifier = record[id_field]

        if isinstance(identifier, (dict, list)):
            result.add_issue(
                "invalid_identifier_type",
                "Identifier must be a string or number.",
                path=f"/{index}/{_safe_field_name(id_field)}",
            )
            continue

        # Prefix the type so numeric 1 and string "1" remain distinct.
        key = f"{type(identifier).__name__}:{identifier!s}"

        if key in seen:
            result.add_issue(
                "duplicate_identifier",
                "Duplicate identifier detected.",
                path=f"/{index}/{_safe_field_name(id_field)}",
            )
        else:
            seen[key] = index


def _validate_schema(
    data: Any,
    schema_path: Path,
    result: FileValidationResult,
) -> None:
    """Validate data against a JSON Schema when jsonschema is installed."""
    schema, error, _ = load_json_file(schema_path)

    if error is not None:
        result.add_issue(
            "schema_unreadable",
            f"Schema could not be loaded: {error}",
        )
        return

    try:
        import jsonschema  # type: ignore[import-not-found]
    except ImportError:
        result.add_issue(
            "jsonschema_not_installed",
            "Install the optional dependency: python -m pip install jsonschema.",
        )
        return

    try:
        validator_class = jsonschema.validators.validator_for(schema)
        validator_class.check_schema(schema)
        validator = validator_class(schema)

        errors = sorted(
            validator.iter_errors(data),
            key=lambda item: (
                tuple(str(part) for part in item.absolute_path),
                item.message,
            ),
        )

        for error_item in errors[:100]:
            path = _json_pointer(error_item.absolute_path)
            result.add_issue(
                "schema_validation_error",
                f"Data does not match the schema ({error_item.validator}).",
                path=path,
            )

        if len(errors) > 100:
            result.add_issue(
                "schema_error_limit",
                "Additional schema errors omitted after the first 100.",
            )

    except Exception as exc:
        # Do not include raw exception text: schema errors can contain
        # user-supplied values or filesystem details.
        result.add_issue(
            "schema_validation_failed",
            f"Schema validation could not complete ({type(exc).__name__}).",
        )


def validate_file(
    path: Path,
    *,
    required_fields: Sequence[str] = (),
    id_field: str | None = None,
    schema_path: Path | None = None,
    root: Path | None = None,
) -> FileValidationResult:
    """Validate one JSON file without changing it."""
    result = FileValidationResult(file=_safe_path(path, root))

    if not path.is_file():
        result.add_issue(
            "not_a_file",
            "Input path is not a regular file.",
        )
        return result

    data, error, bytes_read = load_json_file(path)
    result.bytes_read = bytes_read

    if error is not None:
        result.add_issue("invalid_json", error)
        return result

    if isinstance(data, list):
        result.record_count = len(data)
    elif isinstance(data, dict):
        result.record_count = 1
    else:
        result.record_count = 1
        result.add_issue(
            "unexpected_top_level_type",
            f"Expected an object or array, received {_json_type(data)}.",
        )

    if required_fields:
        _validate_required_fields(data, required_fields, result)

    if id_field:
        _validate_duplicate_ids(data, id_field, result)

    if schema_path is not None:
        _validate_schema(data, schema_path, result)

    return result


def discover_json_files(
    path: Path,
    *,
    recursive: bool = False,
    excluded_dirs: frozenset[str] = DEFAULT_EXCLUDED_DIRS,
) -> list[Path]:
    """Discover JSON files without following directory symlinks."""
    if path.is_file():
        return [path] if path.suffix.lower() == ".json" else []

    if not path.is_dir():
        return []

    found: list[Path] = []

    if recursive:
        for current, directory_names, filenames in os.walk(
            path,
            followlinks=False,
        ):
            directory_names[:] = sorted(
                name
                for name in directory_names
                if name not in excluded_dirs
                and not (Path(current) / name).is_symlink()
            )

            for filename in sorted(filenames):
                candidate = Path(current) / filename

                if (
                    candidate.suffix.lower() == ".json"
                    and not candidate.is_symlink()
                    and candidate.is_file()
                ):
                    found.append(candidate)
    else:
        try:
            for candidate in sorted(path.iterdir()):
                if (
                    candidate.suffix.lower() == ".json"
                    and not candidate.is_symlink()
                    and candidate.is_file()
                ):
                    found.append(candidate)
        except OSError:
            return []

    return found


def build_report(
    results: list[FileValidationResult],
) -> ValidationReport:
    """Build a summary report from file validation results."""
    files_passed = sum(item.valid for item in results)
    files_failed = len(results) - files_passed

    total_errors = sum(
        issue.severity == "error"
        for item in results
        for issue in item.issues
    )
    total_warnings = sum(
        issue.severity == "warning"
        for item in results
        for issue in item.issues
    )

    return ValidationReport(
        tool=TOOL_NAME,
        version=TOOL_VERSION,
        generated_at=datetime.now(timezone.utc).isoformat(),
        valid=files_failed == 0,
        files_checked=len(results),
        files_passed=files_passed,
        files_failed=files_failed,
        total_errors=total_errors,
        total_warnings=total_warnings,
        results=results,
    )


def write_report(report: ValidationReport, output_path: Path) -> None:
    """Write a report atomically without replacing source datasets."""
    destination = output_path.resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)

    if destination.exists() and destination.is_dir():
        raise IsADirectoryError("Report destination is a directory.")

    temporary_path: Path | None = None

    try:
        import tempfile

        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="\n",
            prefix=".validation-report-",
            suffix=".tmp",
            dir=destination.parent,
            delete=False,
        ) as stream:
            temporary_path = Path(stream.name)
            json.dump(
                report.to_dict(),
                stream,
                ensure_ascii=False,
                indent=2,
            )
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())

        os.replace(temporary_path, destination)
        temporary_path = None

    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink(missing_ok=True)
            except OSError:
                pass


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate MedOrbits JSON datasets.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        "input",
        type=Path,
        help="JSON file or directory containing JSON datasets.",
    )
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Recursively discover JSON files in the input directory.",
    )
    parser.add_argument(
        "--required",
        nargs="*",
        default=[],
        metavar="FIELD",
        help="Required field names to check on each object.",
    )
    parser.add_argument(
        "--id-field",
        metavar="FIELD",
        help="Field name used to detect duplicate identifiers.",
    )
    parser.add_argument(
        "--schema",
        type=Path,
        help="JSON Schema file to apply to every selected input file.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Optional path for a machine-readable JSON report.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat an empty input selection as a validation failure.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Print only the final summary.",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {TOOL_VERSION}",
    )

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Run the command-line validator."""
    parser = _build_parser()
    args = parser.parse_args(argv)

    input_path = args.input.expanduser()

    if not input_path.exists():
        print(
            "ERROR: Input path does not exist.",
            file=sys.stderr,
        )
        return 2

    if args.schema is not None and not args.schema.is_file():
        print(
            "ERROR: Schema file does not exist or is not a regular file.",
            file=sys.stderr,
        )
        return 2

    files = discover_json_files(
        input_path,
        recursive=args.recursive,
    )

    if not files:
        message = "No JSON files found."
        if args.strict:
            print(f"ERROR: {message}", file=sys.stderr)
            return 1

        print(f"WARNING: {message}", file=sys.stderr)
        return 0

    results: list[FileValidationResult] = []

    root = input_path if input_path.is_dir() else input_path.parent

    for file_path in files:
        result = validate_file(
            file_path,
            required_fields=args.required,
            id_field=args.id_field,
            schema_path=args.schema,
            root=root,
        )
        results.append(result)

        if not args.quiet:
            status = "PASS" if result.valid else "FAIL"
            print(f"[{status}] {result.file}")

            for issue in result.issues:
                print(
                    f"  {issue.severity.upper()}: "
                    f"{issue.code} at {issue.path}: {issue.message}"
                )

    report = build_report(results)

    if args.report is not None:
        try:
            write_report(report, args.report)
        except OSError as exc:
            print(
                f"ERROR: Could not write validation report "
                f"({type(exc).__name__}).",
                file=sys.stderr,
            )
            return 2

    print(
        f"Summary: {report.files_checked} files checked, "
        f"{report.files_passed} passed, "
        f"{report.files_failed} failed, "
        f"{report.total_errors} errors."
    )

    return 0 if report.valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
