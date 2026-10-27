
#!/usr/bin/env python3
"""MedOrbits Python tooling CLI.

Commands:
    validate   Validate JSON datasets.
    report     Generate repository inventory reports.
    config     Display a safe configuration summary.
    check      Check expected repository structure.

Examples:
    python python/main.py --help
    python python/main.py validate data/colleges.json
    python python/main.py validate data/jobs.json --required id title
    python python/main.py validate data/ --recursive --strict
    python python/main.py report --root .
    python python/main.py report --format json --stdout
    python python/main.py config
    python python/main.py check

Security:
    - Does not print environment variable values or credentials.
    - Does not modify source datasets.
    - Writes reports only when explicitly requested.
    - Does not enable network access automatically.
    - Does not resolve Git conflicts or stage repository changes.

Compatible with Python 3.10+.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import logging
import sys
from pathlib import Path
from types import ModuleType
from typing import Sequence


APP_NAME = "MedOrbits"
APP_VERSION = "1.1.0"

PYTHON_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PYTHON_DIR.parent
SCR_DIR = PYTHON_DIR / "scr"
SCRIPTS_DIR = SCR_DIR / "scripts"
TOOLS_PACKAGE_DIR = SCR_DIR / "medorbits_tools"

EXIT_SUCCESS = 0
EXIT_FAILURE = 1
EXIT_OPERATIONAL_ERROR = 2
EXIT_INTERRUPTED = 130


def _build_parser() -> argparse.ArgumentParser:
    """Create the command-line parser."""
    parser = argparse.ArgumentParser(
        prog="medorbits",
        description="MedOrbits Python repository utilities.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        "--version",
        action="version",
        version=f"{APP_NAME} {APP_VERSION}",
    )

    commands = parser.add_subparsers(
        dest="command",
        required=True,
        title="commands",
    )

    validate_parser = commands.add_parser(
        "validate",
        help="Validate JSON datasets.",
        description="Validate JSON syntax, required fields, IDs, and schemas.",
    )
    validate_parser.add_argument(
        "input",
        type=Path,
        help="JSON file or directory containing JSON files.",
    )
    validate_parser.add_argument(
        "--recursive",
        action="store_true",
        help="Recursively discover JSON files.",
    )
    validate_parser.add_argument(
        "--required",
        nargs="*",
        default=[],
        metavar="FIELD",
        help="Required fields to check.",
    )
    validate_parser.add_argument(
        "--id-field",
        metavar="FIELD",
        help="Field used to detect duplicate identifiers.",
    )
    validate_parser.add_argument(
        "--schema",
        type=Path,
        help="JSON Schema file.",
    )
    validate_parser.add_argument(
        "--report",
        type=Path,
        help="Optional path for a JSON validation report.",
    )
    validate_parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat an empty input selection as a failure.",
    )
    validate_parser.add_argument(
        "--quiet",
        action="store_true",
        help="Reduce console output.",
    )

    report_parser = commands.add_parser(
        "report",
        help="Generate repository inventory reports.",
    )
    report_parser.add_argument(
        "--root",
        type=Path,
        default=PROJECT_ROOT,
        help="Repository root to inspect.",
    )
    report_parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_ROOT / "reports",
        help="Directory for generated reports.",
    )
    report_parser.add_argument(
        "--format",
        choices=("json", "markdown", "both"),
        default="both",
        help="Output format.",
    )
    report_parser.add_argument(
        "--include-git",
        action="store_true",
        help="Include Git branch and working-tree metadata.",
    )
    report_parser.add_argument(
        "--validation-report",
        type=Path,
        help="Optional validation report to summarize.",
    )
    report_parser.add_argument(
        "--stdout",
        action="store_true",
        help="Print report content instead of writing report files.",
    )
    report_parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress status messages.",
    )

    commands.add_parser(
        "config",
        help="Display validated, non-secret configuration.",
    )

    commands.add_parser(
        "check",
        help="Check expected Python tooling paths.",
    )

    return parser


def _load_module_from_path(
    module_name: str,
    script_path: Path,
) -> ModuleType:
    """Load a Python script by path without running its CLI entry point."""
    if not script_path.is_file():
        raise FileNotFoundError(
            f"Required script is missing: "
            f"{script_path.relative_to(PROJECT_ROOT).as_posix()}"
        )

    spec = importlib.util.spec_from_file_location(
        module_name,
        script_path,
    )

    if spec is None or spec.loader is None:
        raise ImportError("Could not initialize the required module.")

    module = importlib.util.module_from_spec(spec)

    # Register before execution for compatibility with decorators and
    # dataclasses that inspect sys.modules during module initialization.
    sys.modules[module_name] = module

    try:
        spec.loader.exec_module(module)
    except Exception:
        sys.modules.pop(module_name, None)
        raise

    return module


def _run_validation(args: argparse.Namespace) -> int:
    """Run the repository validation utility."""
    script = SCRIPTS_DIR / "validation_data.py"

    try:
        module = _load_module_from_path(
            "_medorbits_validation_data",
            script,
        )
    except (OSError, ImportError, SyntaxError) as exc:
        logging.getLogger("medorbits").error(
            "Unable to load validation utility (%s).",
            type(exc).__name__,
        )
        return EXIT_OPERATIONAL_ERROR

    entrypoint = getattr(module, "main", None)

    if not callable(entrypoint):
        logging.getLogger("medorbits").error(
            "Validation utility does not expose main(argv)."
        )
        return EXIT_OPERATIONAL_ERROR

    cli_args = [str(args.input)]

    if args.recursive:
        cli_args.append("--recursive")
    if args.required:
        cli_args.extend(["--required", *args.required])
    if args.id_field:
        cli_args.extend(["--id-field", args.id_field])
    if args.schema:
        cli_args.extend(["--schema", str(args.schema)])
    if args.report:
        cli_args.extend(["--report", str(args.report)])
    if args.strict:
        cli_args.append("--strict")
    if args.quiet:
        cli_args.append("--quiet")

    try:
        return int(entrypoint(cli_args))
    except (OSError, ValueError, TypeError) as exc:
        logging.getLogger("medorbits").error(
            "Validation command failed (%s).",
            type(exc).__name__,
        )
        return EXIT_OPERATIONAL_ERROR


def _run_report(args: argparse.Namespace) -> int:
    """Run the repository report utility."""
    script = SCRIPTS_DIR / "generate_report.py"

    try:
        module = _load_module_from_path(
            "_medorbits_generate_report",
            script,
        )
    except (OSError, ImportError, SyntaxError) as exc:
        logging.getLogger("medorbits").error(
            "Unable to load report utility (%s).",
            type(exc).__name__,
        )
        return EXIT_OPERATIONAL_ERROR

    entrypoint = getattr(module, "main", None)

    if not callable(entrypoint):
        logging.getLogger("medorbits").error(
            "Report utility does not expose main(argv)."
        )
        return EXIT_OPERATIONAL_ERROR

    cli_args = [
        "--root",
        str(args.root),
        "--output",
        str(args.output),
        "--format",
        args.format,
    ]

    if args.include_git:
        cli_args.append("--include-git")
    if args.validation_report:
        cli_args.extend(
            ["--validation-report", str(args.validation_report)]
        )
    if args.stdout:
        cli_args.append("--stdout")
    if args.quiet:
        cli_args.append("--quiet")

    try:
        return int(entrypoint(cli_args))
    except (OSError, ValueError, TypeError) as exc:
        logging.getLogger("medorbits").error(
            "Report command failed (%s).",
            type(exc).__name__,
        )
        return EXIT_OPERATIONAL_ERROR


def _run_config() -> int:
    """Print a safe configuration summary."""
    try:
        # The package lives under python/scr.
        package_init = TOOLS_PACKAGE_DIR / "__init__.py"

        if not package_init.is_file():
            print(
                "ERROR: MedOrbits tools package is missing.",
                file=sys.stderr,
            )
            return EXIT_OPERATIONAL_ERROR

        if str(SCR_DIR) not in sys.path:
            sys.path.insert(0, str(SCR_DIR))

        from medorbits_tools.config import get_config

        config = get_config()
        print(
            json.dumps(
                config.safe_summary(),
                ensure_ascii=False,
                indent=2,
            )
        )
        return EXIT_SUCCESS

    except (ImportError, ValueError, OSError) as exc:
        logging.getLogger("medorbits").error(
            "Configuration command failed (%s).",
            type(exc).__name__,
        )
        return EXIT_OPERATIONAL_ERROR


def _run_check() -> int:
    """Check expected tooling paths without modifying files."""
    expected_paths = (
        PYTHON_DIR,
        SCR_DIR,
        SCRIPTS_DIR,
        TOOLS_PACKAGE_DIR,
        TOOLS_PACKAGE_DIR / "__init__.py",
        TOOLS_PACKAGE_DIR / "config.py",
        TOOLS_PACKAGE_DIR / "logging_config.py",
        SCRIPTS_DIR / "validation_data.py",
        SCRIPTS_DIR / "generate_report.py",
        SCR_DIR / "tests",
    )

    failures = 0

    for path in expected_paths:
        exists = path.exists()
        status = "OK" if exists else "MISSING"

        try:
            relative = path.relative_to(PROJECT_ROOT).as_posix()
        except ValueError:
            relative = path.name

        print(f"[{status}] {relative}")

        if not exists:
            failures += 1

    print(
        f"Structure check: {len(expected_paths) - failures}/"
        f"{len(expected_paths)} paths present."
    )

    return EXIT_SUCCESS if failures == 0 else EXIT_FAILURE


def main(argv: Sequence[str] | None = None) -> int:
    """Run a MedOrbits command."""
    parser = _build_parser()
    args = parser.parse_args(argv)

    try:
        # Configure logging only when a command is actually executed.
        if str(SCR_DIR) not in sys.path:
            sys.path.insert(0, str(SCR_DIR))

        try:
            from medorbits_tools.logging_config import (
                configure_from_environment,
            )

            configure_from_environment()
        except ImportError:
            logging.basicConfig(
                level=logging.INFO,
                format="%(levelname)s %(name)s %(message)s",
            )

        if args.command == "validate":
            return _run_validation(args)

        if args.command == "report":
            return _run_report(args)

        if args.command == "config":
            return _run_config()

        if args.command == "check":
            return _run_check()

        parser.error("Unsupported command.")
        return EXIT_OPERATIONAL_ERROR

    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        return EXIT_INTERRUPTED

    except BrokenPipeError:
        return EXIT_SUCCESS

    except Exception as exc:
        logging.getLogger("medorbits").error(
            "Command failed (%s).",
            type(exc).__name__,
        )
        return EXIT_OPERATIONAL_ERROR


if __name__ == "__main__":
    raise SystemExit(main())
