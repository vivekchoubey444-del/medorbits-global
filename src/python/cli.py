# src/python/cli.py
#!/usr/bin/env python3
"""MedOrbits command-line interface.

Usage:
    python src/python/cli.py --help
    python src/python/cli.py version
    python src/python/cli.py config-check
    python src/python/cli.py validate-email user@example.com
    python src/python/cli.py validate-application application.json
    python src/python/cli.py validate-job job.json
    python src/python/cli.py import-data records.json --format json
    python src/python/cli.py export-data records.json --format csv --output records.csv
    python src/python/cli.py health

Uses the Python standard library and the local medorbits package.
No web server is started. Commands should not connect to external services
unless their explicitly imported local implementation does so.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

_PACKAGE_ROOT = Path(__file__).resolve().parent
if str(_PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(_PACKAGE_ROOT))

from medorbits import __version__  # noqa: E402
from medorbits.logging_config import configure_logging, get_logger  # noqa: E402
from medorbits.validators import (  # noqa: E402
    ValidationError,
    validate_application_payload,
    validate_email,
    validate_job_payload,
)

LOGGER = get_logger("medorbits.cli")

EXIT_OK = 0
EXIT_ERROR = 1
EXIT_USAGE = 2
EXIT_VALIDATION = 3

DEFAULT_MAX_BYTES = 5_000_000
MAX_CONFIGURABLE_BYTES = 100_000_000
SUPPORTED_FORMATS = ("csv", "json", "jsonl")


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def _write_json(value: Any, *, stream: Any = None) -> None:
    """Write strict JSON without emitting non-standard numeric values."""
    if stream is None:
        stream = sys.stdout

    print(
        json.dumps(
            value,
            ensure_ascii=False,
            indent=2,
            allow_nan=False,
            default=str,
        ),
        file=stream,
    )


def _error(message: str, *, code: str = "cli_error") -> int:
    """Write a consistent JSON error to stderr."""
    _write_json(
        {
            "success": False,
            "error": {
                "code": code,
                "message": message,
            },
        },
        stream=sys.stderr,
    )
    return EXIT_ERROR


def _validation_error(exc: ValidationError) -> int:
    """Write validation errors without echoing submitted values."""
    try:
        details = exc.to_dict()
        if not isinstance(details, Mapping):
            raise TypeError("Invalid validation error structure.")
        details = dict(details)
    except Exception:
        details = {
            "code": "validation_error",
            "message": "Input validation failed.",
        }

    _write_json(
        {"success": False, "error": details},
        stream=sys.stderr,
    )
    return EXIT_VALIDATION


def _safe_error_message(exc: Exception, fallback: str) -> str:
    """Return controlled error messages without arbitrary exception text."""
    if isinstance(exc, FileNotFoundError):
        return "Input file was not found."
    if isinstance(exc, PermissionError):
        return "Insufficient permissions to access the requested file."
    if isinstance(exc, IsADirectoryError):
        return "The specified path is a directory, not a file."
    if isinstance(exc, UnicodeDecodeError):
        return "Input file must contain valid UTF-8 text."
    if isinstance(exc, json.JSONDecodeError):
        return f"Invalid JSON at line {exc.lineno}, column {exc.colno}."
    if isinstance(exc, ValueError):
        return "Input data or configuration is invalid."
    if isinstance(exc, TypeError):
        return "Input has an unsupported data type."
    if isinstance(exc, OSError):
        return "A file-system operation failed."
    return fallback


# ---------------------------------------------------------------------------
# File handling
# ---------------------------------------------------------------------------

def _validate_max_bytes(max_bytes: int) -> int:
    """Validate a file-size limit."""
    if isinstance(max_bytes, bool) or not isinstance(max_bytes, int):
        raise ValueError("Maximum file size must be an integer.")

    if not 1 <= max_bytes <= MAX_CONFIGURABLE_BYTES:
        raise ValueError(
            f"Maximum file size must be between 1 and "
            f"{MAX_CONFIGURABLE_BYTES} bytes."
        )

    return max_bytes


def _read_bytes_file(
    path: Path,
    *,
    max_bytes: int = DEFAULT_MAX_BYTES,
) -> bytes:
    """Read a bounded file and reject oversized input."""
    max_bytes = _validate_max_bytes(max_bytes)
    path = Path(path)

    with path.open("rb") as file:
        data = file.read(max_bytes + 1)

    if len(data) > max_bytes:
        raise ValueError(f"Input file exceeds the {max_bytes}-byte limit.")

    return data


def _reject_json_constant(value: str) -> None:
    """Reject non-standard JSON values such as NaN and Infinity."""
    raise ValueError(f"Invalid JSON constant: {value}.")


def _read_json_file(
    path: Path,
    *,
    max_bytes: int = DEFAULT_MAX_BYTES,
) -> Any:
    """Parse a bounded UTF-8 JSON document."""
    raw = _read_bytes_file(path, max_bytes=max_bytes)

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("Input file must be valid UTF-8.") from exc

    try:
        return json.loads(text, parse_constant=_reject_json_constant)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Invalid JSON at line {exc.lineno}, column {exc.colno}."
        ) from exc


def _write_text_file(path: Path, content: str) -> None:
    """Atomically write text without following an existing symlink.

    The destination directory must already exist. A temporary file is
    created in that directory so os.replace remains on the same filesystem.
    """
    path = Path(path)

    if not isinstance(content, str):
        raise TypeError("Output content must be text.")

    parent = path.parent
    if not parent.is_dir():
        raise ValueError("Output directory does not exist.")

    # Reject symlinks and directories before writing. Atomic replacement
    # prevents partial output, although filesystem permissions remain vital.
    if path.is_symlink():
        raise ValueError("Symbolic-link output paths are not supported.")
    if path.exists() and path.is_dir():
        raise ValueError("Output path points to a directory.")

    temporary_path: Path | None = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            dir=parent,
            prefix=".medorbits-",
            suffix=".tmp",
            delete=False,
        ) as file:
            temporary_path = Path(file.name)
            file.write(content)
            file.flush()
            os.fsync(file.fileno())

        # Recheck the destination before replacement. For hostile,
        # concurrently writable directories, use OS-specific no-follow
        # operations and restrictive directory permissions as well.
        if path.is_symlink():
            raise ValueError("Symbolic-link output paths are not supported.")
        if path.exists() and path.is_dir():
            raise ValueError("Output path points to a directory.")

        os.replace(temporary_path, path)
        temporary_path = None

    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink(missing_ok=True)
            except OSError:
                LOGGER.warning("Unable to clean temporary output file")


def _validate_input_file(path: Path) -> None:
    """Require an existing regular input file."""
    if not Path(path).is_file():
        raise ValueError("Input path is not a regular file.")


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def command_version(_: argparse.Namespace) -> int:
    """Display package and Python runtime versions."""
    _write_json(
        {
            "success": True,
            "name": "medorbits",
            "version": __version__,
            "python_version": sys.version.split()[0],
        }
    )
    return EXIT_OK


def command_config_check(_: argparse.Namespace) -> int:
    """Validate configuration without displaying secrets."""
    try:
        from medorbits.config import get_settings

        settings = get_settings()
        safe_fields = (
            "environment",
            "debug",
            "host",
            "port",
            "api_prefix",
            "log_level",
            "db_engine",
            "queue_enabled",
            "email_enabled",
            "payments_enabled",
            "storage_driver",
            "ai_enabled",
        )

        safe_settings: dict[str, str | int | float | bool] = {}
        for key in safe_fields:
            value = getattr(settings, key, None)
            if isinstance(value, (str, int, float, bool)) and not isinstance(
                value, complex
            ):
                safe_settings[key] = value

        _write_json(
            {
                "success": True,
                "message": "Configuration loaded successfully.",
                "settings": safe_settings,
            }
        )
        return EXIT_OK

    except Exception as exc:
        LOGGER.error(
            "Configuration validation failed",
            extra={"exception_type": type(exc).__name__},
        )
        return _error(
            "Configuration validation failed. Review required environment "
            "variables and configuration rules.",
            code="configuration_error",
        )


def command_validate_email(args: argparse.Namespace) -> int:
    """Validate email syntax."""
    try:
        result = validate_email(args.email)
        _write_json(
            {
                "success": True,
                "valid": True,
                "normalized_email": result.normalized,
            }
        )
        return EXIT_OK
    except ValidationError as exc:
        return _validation_error(exc)


def command_validate_application(args: argparse.Namespace) -> int:
    """Validate an application JSON payload."""
    try:
        payload = _read_json_file(args.input, max_bytes=args.max_bytes)
        result = validate_application_payload(
            payload,
            reject_unknown_fields=not args.allow_unknown_fields,
        )
        _write_json(
            {"success": True, "valid": True, "application": result}
        )
        return EXIT_OK
    except ValidationError as exc:
        return _validation_error(exc)
    except (OSError, ValueError, TypeError) as exc:
        return _error(
            _safe_error_message(exc, "Unable to read application input."),
            code="input_file_error",
        )


def command_validate_job(args: argparse.Namespace) -> int:
    """Validate a job JSON payload."""
    try:
        payload = _read_json_file(args.input, max_bytes=args.max_bytes)
        result = validate_job_payload(
            payload,
            reject_unknown_fields=not args.allow_unknown_fields,
        )
        _write_json({"success": True, "valid": True, "job": result})
        return EXIT_OK
    except ValidationError as exc:
        return _validation_error(exc)
    except (OSError, ValueError, TypeError) as exc:
        return _error(
            _safe_error_message(exc, "Unable to read job input."),
            code="input_file_error",
        )


def command_import_data(args: argparse.Namespace) -> int:
    """Import CSV, JSON, or JSONL using the local import service."""
    try:
        from medorbits.data_import import ImportOptions, import_records

        raw = _read_bytes_file(args.input, max_bytes=args.max_bytes)
        records = import_records(raw, options=ImportOptions(format=args.format))

        if not isinstance(records, Sequence) or isinstance(
            records, (str, bytes, bytearray)
        ):
            raise ValueError("Importer returned an unsupported records structure.")

        _write_json(
            {
                "success": True,
                "format": args.format,
                "record_count": len(records),
                "records": records if args.print_records else None,
            }
        )
        return EXIT_OK

    except ValidationError as exc:
        return _validation_error(exc)
    except (ImportError, OSError, ValueError, TypeError) as exc:
        return _error(
            _safe_error_message(exc, "Unable to import input file."),
            code="import_error",
        )


def _load_export_records(value: Any) -> list[Mapping[str, Any]]:
    """Require a JSON array of object records."""
    if not isinstance(value, list):
        raise ValueError("Export input must be a JSON array.")

    if not all(isinstance(item, Mapping) for item in value):
        raise ValueError("Every export record must be a JSON object.")

    return value


def command_export_data(args: argparse.Namespace) -> int:
    """Export a JSON array to CSV, JSON, or JSONL."""
    try:
        from medorbits.data_export import ExportOptions, export_records

        payload = _read_json_file(args.input, max_bytes=args.max_bytes)
        records = _load_export_records(payload)
        exported = export_records(
            records,
            options=ExportOptions(format=args.format),
        )

        if isinstance(exported, bytes):
            content = exported.decode("utf-8")
        elif isinstance(exported, str):
            content = exported
        else:
            raise TypeError("Exporter must return text or UTF-8 bytes.")

        if args.output:
            _write_text_file(args.output, content)
            _write_json(
                {
                    "success": True,
                    "format": args.format,
                    "record_count": len(records),
                    "output": str(args.output),
                }
            )
        else:
            sys.stdout.write(content)
            if content and not content.endswith("\n"):
                sys.stdout.write("\n")

        return EXIT_OK

    except (
        ImportError,
        OSError,
        ValueError,
        TypeError,
        UnicodeDecodeError,
    ) as exc:
        return _error(
            _safe_error_message(exc, "Unable to export records."),
            code="export_error",
        )


def command_health(_: argparse.Namespace) -> int:
    """Run a local liveness check without probing external services."""
    try:
        from medorbits.healthcheck import liveness_report

        report = liveness_report()

        if isinstance(report, Mapping):
            result = dict(report)
        elif callable(getattr(report, "to_dict", None)):
            result = report.to_dict()
            if not isinstance(result, Mapping):
                raise TypeError("Health report to_dict() must return a mapping.")
            result = dict(result)
        else:
            raise TypeError("Health report must be a mapping.")

        _write_json(
            {
                "success": True,
                "service": "medorbits-python",
                "health": result,
            }
        )
        return EXIT_OK

    except Exception as exc:
        LOGGER.error(
            "Local health check failed",
            extra={"exception_type": type(exc).__name__},
        )
        return _error("Local health check failed.", code="health_check_error")


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def _positive_int(value: str) -> int:
    """Parse a positive integer used for file-size limits."""
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise argparse.ArgumentTypeError("Value must be an integer.") from exc

    if not 1 <= parsed <= MAX_CONFIGURABLE_BYTES:
        raise argparse.ArgumentTypeError(
            f"Value must be between 1 and {MAX_CONFIGURABLE_BYTES}."
        )
    return parsed


def build_parser() -> argparse.ArgumentParser:
    """Build the CLI argument parser."""
    parser = argparse.ArgumentParser(
        prog="medorbits",
        description="MedOrbits Python package command-line utilities.",
        epilog=(
            "Examples: medorbits version; medorbits config-check; "
            "medorbits validate-email user@example.com"
        ),
    )

    parser.add_argument(
        "--log-level",
        default=os.getenv("LOG_LEVEL", "WARNING").upper(),
        choices=("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"),
        help="Logging level (default: WARNING).",
    )
    parser.add_argument(
        "--log-format",
        default=os.getenv("LOG_FORMAT", "text").lower(),
        choices=("text", "json"),
        help="Logging format (default: text).",
    )

    subparsers = parser.add_subparsers(
        dest="command",
        required=True,
        title="commands",
    )

    version_parser = subparsers.add_parser(
        "version", help="Display package version information."
    )
    version_parser.set_defaults(handler=command_version)

    config_parser = subparsers.add_parser(
        "config-check", help="Load and validate environment configuration."
    )
    config_parser.set_defaults(handler=command_config_check)

    email_parser = subparsers.add_parser(
        "validate-email", help="Validate email address syntax."
    )
    email_parser.add_argument("email", help="Email address to validate.")
    email_parser.set_defaults(handler=command_validate_email)

    for command_name, help_text, handler in (
        (
            "validate-application",
            "Validate an application JSON file.",
            command_validate_application,
        ),
        ("validate-job", "Validate a job JSON file.", command_validate_job),
    ):
        item_parser = subparsers.add_parser(command_name, help=help_text)
        item_parser.add_argument("input", type=Path, help="Input JSON file.")
        item_parser.add_argument(
            "--allow-unknown-fields",
            action="store_true",
            help="Allow fields outside the current schema allowlist.",
        )
        item_parser.add_argument(
            "--max-bytes",
            type=_positive_int,
            default=DEFAULT_MAX_BYTES,
            help="Maximum input size in bytes.",
        )
        item_parser.set_defaults(handler=handler)

    import_parser = subparsers.add_parser(
        "import-data", help="Import CSV, JSON, or JSONL records."
    )
    import_parser.add_argument("input", type=Path, help="Input data file.")
    import_parser.add_argument(
        "--format", choices=SUPPORTED_FORMATS, required=True, help="Input format."
    )
    import_parser.add_argument(
        "--max-bytes",
        type=_positive_int,
        default=DEFAULT_MAX_BYTES,
        help="Maximum input size in bytes.",
    )
    import_parser.add_argument(
        "--print-records",
        action="store_true",
        help="Include imported records in JSON output.",
    )
    import_parser.set_defaults(handler=command_import_data)

    export_parser = subparsers.add_parser(
        "export-data", help="Export a JSON array to CSV, JSON, or JSONL."
    )
    export_parser.add_argument("input", type=Path, help="JSON array of records.")
    export_parser.add_argument(
        "--format", choices=SUPPORTED_FORMATS, required=True, help="Output format."
    )
    export_parser.add_argument(
        "--output", type=Path, help="Output file; stdout is used if omitted."
    )
    export_parser.add_argument(
        "--max-bytes",
        type=_positive_int,
        default=DEFAULT_MAX_BYTES,
        help="Maximum input size in bytes.",
    )
    export_parser.set_defaults(handler=command_export_data)

    health_parser = subparsers.add_parser(
        "health", help="Run a local liveness check."
    )
    health_parser.set_defaults(handler=command_health)

    return parser


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main(argv: Sequence[str] | None = None) -> int:
    """Execute a CLI command and return its process exit code."""
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        configure_logging(
            level=args.log_level,
            json_logs=args.log_format == "json",
        )
        return int(args.handler(args))

    except KeyboardInterrupt:
        print("Operation interrupted.", file=sys.stderr)
        return 130

    except Exception as exc:
        LOGGER.error(
            "CLI command failed",
            extra={
                "command": args.command,
                "exception_type": type(exc).__name__,
            },
        )
        return _error(
            "Command failed. Review configuration and input files.",
            code="unexpected_error",
        )


if __name__ == "__main__":
    raise SystemExit(main())