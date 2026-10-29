
#!/usr/bin/env python3
"""
MedOrbits Repository Health Checker
===================================

File: tools/validate_repository.py

Purpose:
    Validate repository structure, JSON syntax, Python syntax, and the
    presence of recommended GitHub configuration files.

Requirements:
    Python 3.10+
    Python standard library only

Usage:
    python tools/validate_repository.py
    python tools/validate_repository.py --strict
    python tools/validate_repository.py --root /path/to/MedOrbits
    python tools/validate_repository.py --quiet

Exit codes:
    0 = Validation passed
    1 = Validation errors found
    2 = Invalid arguments or repository configuration error

Notes:
    This is a static repository health check. It does not run application
    tests, validate workflow semantics, install dependencies, or guarantee
    that the application can be deployed successfully.
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import sys
from pathlib import Path
from typing import Any


SCRIPT_PATH = Path(__file__).resolve()
DEFAULT_ROOT = SCRIPT_PATH.parent.parent

IGNORED_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    "dist",
    "build",
    ".next",
    "coverage",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".tox",
}

REQUIRED_FILES = (
    ".github/FUNDING.yml",
    ".github/SECURITY.md",
    ".github/dependabot.yml",
    ".github/workflows/repository-validation.yml",
)

SOURCE_SUFFIXES = {
    ".json",
    ".py",
}


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Validate MedOrbits repository structure and source syntax.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        "--root",
        type=Path,
        default=DEFAULT_ROOT,
        help="Repository root directory.",
    )

    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat missing recommended files and directories as errors.",
    )

    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Print only the final summary and validation errors.",
    )

    return parser.parse_args()


def is_repository_root(root: Path) -> bool:
    """Check for basic repository-root indicators."""
    git_path = root / ".git"
    github_path = root / ".github"

    return (
        git_path.exists()
        or git_path.is_symlink()
        or github_path.is_dir()
    )


def discover_files(root: Path):
    """
    Yield repository files without traversing ignored directories.

    Symlinks are excluded to avoid checking files outside the repository
    or following unexpected filesystem links.
    """
    for current, directories, filenames in os.walk(
        root,
        topdown=True,
        followlinks=False,
    ):
        current_path = Path(current)

        directories[:] = sorted(
            directory
            for directory in directories
            if directory not in IGNORED_DIRS
            and not (current_path / directory).is_symlink()
        )

        for filename in sorted(filenames):
            path = current_path / filename

            if path.is_symlink():
                continue

            if path.suffix.lower() in SOURCE_SUFFIXES:
                yield path


def validate_json(path: Path) -> str | None:
    """
    Validate JSON syntax.

    Returns None on success or an error description on failure.
    """
    try:
        with path.open("r", encoding="utf-8") as file:
            json.load(file)
    except json.JSONDecodeError as exc:
        return (
            f"line {exc.lineno}, column {exc.colno}: "
            f"{exc.msg}"
        )
    except (OSError, UnicodeError, ValueError) as exc:
        return str(exc)

    return None


def validate_python(path: Path, relative: Path) -> str | None:
    """
    Parse Python source without executing it.

    Returns None on success or an error description on failure.
    """
    try:
        source = path.read_text(encoding="utf-8")
        ast.parse(source, filename=relative.as_posix())
    except SyntaxError as exc:
        location = (
            f"line {exc.lineno}"
            if exc.lineno is not None
            else "unknown line"
        )
        if exc.offset is not None:
            location += f", column {exc.offset}"

        message = exc.msg or "invalid Python syntax"
        return f"{location}: {message}"
    except (OSError, UnicodeError, ValueError) as exc:
        return str(exc)

    return None


def check_required_paths(
    root: Path,
    strict: bool,
    errors: list[str],
    warnings: list[str],
) -> None:
    """Check recommended files and repository directories."""
    for relative in REQUIRED_FILES:
        target = root / relative

        if not target.is_file():
            message = f"Missing recommended file: {relative}"

            if strict:
                errors.append(message)
            else:
                warnings.append(message)

    for relative in (".github", "tools"):
        target = root / relative

        if not target.is_dir():
            message = f"Directory not found: {relative}"

            if strict:
                errors.append(message)
            else:
                warnings.append(message)


def validate_repository(
    root: Path,
    strict: bool,
    quiet: bool,
) -> int:
    """Validate the repository and return the process exit code."""
    if not root.exists() or not root.is_dir():
        print(
            f"ERROR: Repository root does not exist or is not a directory: {root}",
            file=sys.stderr,
        )
        return 2

    root = root.resolve()

    if not is_repository_root(root):
        print(
            "ERROR: Repository root not detected. "
            "Expected a .git entry or .github directory.\n"
            f"Path: {root}",
            file=sys.stderr,
        )
        return 2

    errors: list[str] = []
    warnings: list[str] = []

    checked_json = 0
    checked_python = 0
    discovered_files = 0

    check_required_paths(
        root=root,
        strict=strict,
        errors=errors,
        warnings=warnings,
    )

    try:
        for path in discover_files(root):
            discovered_files += 1
            relative = path.relative_to(root)
            suffix = path.suffix.lower()

            if not quiet:
                print(f"Checking {relative.as_posix()}")

            if suffix == ".json":
                checked_json += 1
                problem = validate_json(path)

                if problem:
                    errors.append(
                        f"Invalid JSON: {relative.as_posix()}: {problem}"
                    )

            elif suffix == ".py":
                checked_python += 1
                problem = validate_python(path, relative)

                if problem:
                    errors.append(
                        f"Invalid Python: {relative.as_posix()}: {problem}"
                    )

    except OSError as exc:
        print(
            f"ERROR: Could not scan repository: {exc}",
            file=sys.stderr,
        )
        return 2

    print("\nMedOrbits Repository Validation")
    print("=" * 34)
    print(f"Repository root:      {root}")
    print(f"Source files scanned: {discovered_files}")
    print(f"JSON files checked:   {checked_json}")
    print(f"Python files checked: {checked_python}")
    print(f"Errors:               {len(errors)}")
    print(f"Warnings:             {len(warnings)}")

    if strict:
        print("Strict mode:          enabled")

    if warnings and not quiet:
        for warning in warnings:
            print(f"WARNING: {warning}")

    for error in errors:
        print(f"ERROR: {error}")

    if errors:
        print("\nRESULT: FAILED -- correct the reported errors.")
        return 1

    print("\nRESULT: PASSED")

    if warnings:
        print(
            "NOTE: Warnings remain. Review them before treating "
            "the repository as release-ready."
        )

    print(
        "NOTE: Static syntax checks do not replace tests, dependency "
        "audits, GitHub Actions validation, or deployment checks."
    )

    return 0


def main() -> int:
    """Application entry point."""
    args = parse_args()

    try:
        root = args.root.expanduser().resolve()
    except (OSError, RuntimeError, ValueError) as exc:
        print(
            f"ERROR: Could not resolve repository path: {exc}",
            file=sys.stderr,
        )
        return 2

    return validate_repository(
        root=root,
        strict=args.strict,
        quiet=args.quiet,
    )


if __name__ == "__main__":
    raise SystemExit(main())
