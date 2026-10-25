"
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

The CLI uses the standard library and the local medorbits package.
It does not start the web server or automatically connect to external services.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

# Ensure `src/python` is importable when this script is executed directly.
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


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def _write_json(value: Any, *, stream: Any = sys.stdout) -> None:
    """Write JSON output without leaking Python-specific objects."""
    print(
        json.dumps(
            value,
            ensure_ascii=False,
            indent=2,
            default=str,
        ),
        file=stream,
    )


def _error(message: str, *, code: str = "cli_error") -> int:
    """Write a consistent, safe error response to stderr."""
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
    """Write a validation error without echoing submitted values."""
    _write_json(
        {
            "success": False,
            "error": exc.to_dict(),
        },
        stream=sys.stderr,
    )
    return EXIT_VALIDATION


def _read_json_file(path: Path, *, max_bytes: int = 5_000_000) -> Any:
    """Read a bounded UTF-8 JSON file."""
    try:
        if not path.is_file():
            raise ValueError("Input path is not a regular file.")

        size = path.stat().st_size
        if size > max_bytes:
            raise ValueError(
                f"Input file exceeds the {max_bytes}-byte limit."
            )

        with path.open("r", encoding="utf-8-sig") as file:
            return json.load(file)

    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Invalid JSON at line {exc.lineno}, column {exc.colno}."
        ) from exc
    except UnicodeDecodeError as exc:
        raise ValueError("Input file must be valid UTF-8.") from exc


def _write_text_file(path: Path, content: str) -> None:
    """Write text to a destination without creating arbitrary parent paths."""
    parent = path.parent

    if not parent.exists() or not parent.is_dir():
        raise ValueError("Output directory does not exist.")

    if path.exists() and path.is_dir():
        raise ValueError("Output path points to a directory.")

    with path.open("w", encoding="utf-8", newline="") as file:
        file.write(content)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def command_version(_: argparse.Namespace) -> int:
    """Display package and Python runtime information."""
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
    """Load and validate MedOrbits settings."""
    try:
        from medorbits.config import get_settings

        settings = get_settings()

        # Do not print credentials, URLs containing credentials, or API keys.
        safe_settings = {
            "environment": getattr(settings, "environment", None),
            "debug": getattr(settings, "debug", None),
            "host": getattr(settings, "host", None),
            "port": getattr(settings, "port", None),
            "api_prefix": getattr(settings, "api_prefix", None),
            "log_level": getattr(settings, "log_level", None),
            "database_engine": getattr(settings, "db_engine", None),
            "queue_enabled": getattr(settings, "queue_enabled", None),
            "email_enabled": getattr(settings, "email_enabled", None),
            "payments_enabled": getattr(settings, "payments_enabled", None),
            "storage_driver": getattr(settings, "storage_driver", None),
            "ai_enabled": getattr(settings, "ai_enabled", None),
        }

        _write_json(
            {
                "success": True,
                "message": "Configuration loaded successfully.",
                "settings": {
                    key: value
                    for key, value in safe_settings.items()
                    if value is not None
                },
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
        payload = _read_json_file(args.input)
        result = validate_application_payload(
            payload,
            reject_unknown_fields=not args.allow_unknown_fields,
        )

        _write_json(
            {
                "success": True,
                "valid": True,
                "application": result,
            }
        )
        return EXIT_OK

    except ValidationError as exc:
        return _validation_error(exc)
    except (OSError, ValueError) as exc:
        return _error(str(exc), code="input_file_error")


def command_validate_job(args: argparse.Namespace) -> int:
    """Validate a job JSON payload."""
    try:
        payload = _read_json_file(args.input)
        result = validate_job_payload(
            payload,
            reject_unknown_fields=not args.allow_unknown_fields,
        )

        _write_json(
            {
                "success": True,
                "valid": True,
                "job": result,
            }
        )
        return EXIT_OK

    except ValidationError as exc:
        return _validation_error(exc)
    except (OSError, ValueError) as exc:
        return _error(str(exc), code="input_file_error")


def command_import_data(args: argparse.Namespace) -> int:
    """Import and validate a supported data file."""
    try:
        from medorbits.data_import import (
            ImportOptions,
            import_records,
        )

        raw = args.input.read_bytes()

        if len(raw) > args.max_bytes:
            return _error(
                f"Input file exceeds the {args.max_bytes}-byte limit.",
                code="input_too_large",
            )

        options = ImportOptions(format=args.format)
        records = import_records(raw, options=options)

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
    except (ImportError, OSError, ValueError) as exc:
        return _error(
            f"Unable to import input file: {exc}",
            code="import_error",
        )


def _load_export_records(value: Any) -> list[Mapping[str, Any]]:
    """Require a JSON array of object records for export."""
    if not isinstance(value, list):
        raise ValueError("Export input must be a JSON array.")

    if not all(isinstance(item, Mapping) for item in value):
        raise ValueError("Every export record must be a JSON object.")

    return value


def command_export_data(args: argparse.Namespace) -> int:
    """Export JSON records to CSV, JSON, or JSONL."""
    try:
        from medorbits.data_export import (
            ExportOptions,
            export_records,
        )

        payload = _read_json_file(args.input)
        records = _load_export_records(payload)

        options = ExportOptions(format=args.format)
        exported = export_records(records, options=options)

        if isinstance(exported, bytes):
            content = exported.decode("utf-8")
        else:
            content = str(exported)

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

    except (ImportError, OSError, ValueError, TypeError) as exc:
        return _error(
            f"Unable to export records: {exc}",
            code="export_error",
        )


def command_health(_: argparse.Namespace) -> int:
    """Run a local package health check without probing external services."""
    try:
        from medorbits.healthcheck import liveness_report

        report = liveness_report()

        if hasattr(report, "to_dict"):
            result = report.to_dict()
        elif hasattr(report, "__dict__"):
            result = dict(report.__dict__)
        elif isinstance(report, Mapping):
            result = dict(report)
        else:
            result = {"status": str(report)}

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
        return _error(
            "Local health check failed.",
            code="health_check_error",
        )


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    """Build the command-line parser."""
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
        default=os.getenv("LOG_LEVEL", "WARNING"),
        choices=("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"),
        help="Logging level (default: WARNING).",
    )
    parser.add_argument(
        "--log-format",
        default=os.getenv("LOG_FORMAT", "text"),
        choices=("text", "json"),
        help="Logging format (default: text).",
    )

    subparsers = parser.add_subparsers(
        dest="command",
        required=True,
        title="commands",
    )

    version_parser = subparsers.add_parser(
        "version",
        help="Display package version information.",
    )
    version_parser.set_defaults(handler=command_version)

    config_parser = subparsers.add_parser(
        "config-check",
        help="Load and validate environment configuration.",
    )
    config_parser.set_defaults(handler=command_config_check)

    email_parser = subparsers.add_parser(
        "validate-email",
        help="Validate email address syntax.",
    )
    email_parser.add_argument("email", help="Email address to validate.")
    email_parser.set_defaults(handler=command_validate_email)

    application_parser = subparsers.add_parser(
        "validate-application",
        help="Validate an application JSON file.",
    )
    application_parser.add_argument(
        "input",
        type=Path,
        help="Path to the application JSON file.",
    )
    application_parser.add_argument(
        "--allow-unknown-fields",
        action="store_true",
        help="Allow fields outside the current application allowlist.",
    )
    application_parser.set_defaults(handler=command_validate_application)

    job_parser = subparsers.add_parser(
        "validate-job",
        help="Validate a job JSON file.",
    )
    job_parser.add_argument(
        "input",
        type=Path,
        help="Path to the job JSON file.",
    )
    job_parser.add_argument(
        "--allow-unknown-fields",
        action="store_true",
        help="Allow fields outside the current job allowlist.",
    )
    job_parser.set_defaults(handler=command_validate_job)

    import_parser = subparsers.add_parser(
        "import-data",
        help="Import CSV, JSON, or JSONL records.",
    )
    import_parser.add_argument(
        "input",
        type=Path,
        help="Path to the input data file.",
    )
    import_parser.add_argument(
        "--format",
        choices=("csv", "json", "jsonl"),
        required=True,
        help="Input format.",
    )
    import_parser.add_argument(
        "--max-bytes",
        type=int,
        default=5_000_000,
        help="Maximum input size in bytes (default: 5000000).",
    )
    import_parser.add_argument(
        "--print-records",
        action="store_true",
        help="Include imported records in JSON output.",
    )
    import_parser.set_defaults(handler=command_import_data)

    export_parser = subparsers.add_parser(
        "export-data",
        help="Export a JSON array to CSV, JSON, or JSONL.",
    )
    export_parser.add_argument(
        "input",
        type=Path,
        help="Path to a JSON array of records.",
    )
    export_parser.add_argument(
        "--format",
        choices=("csv", "json", "jsonl"),
        required=True,
        help="Output format.",
    )
    export_parser.add_argument(
        "--output",
        type=Path,
        help="Output path; stdout is used when omitted.",
    )
    export_parser.set_defaults(handler=command_export_data)

    health_parser = subparsers.add_parser(
        "health",
        help="Run a local liveness check.",
    )
    health_parser.set_defaults(handler=command_health)

    return parser


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main(argv: Sequence[str] | None = None) -> int:
    """Execute the CLI and return a process exit code."""
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
        # Do not print arbitrary exception messages, which can contain
        # database URLs, credentials, or user-submitted values.
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

