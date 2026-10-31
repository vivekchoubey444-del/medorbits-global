
#!/usr/bin/env python3
“””
MedOrbits Repository Health Checker
===================================

File: tools/validate_repository.py
Version: 2.0.0

Purpose:
    Validate repository structure, JSON syntax, Python syntax, and
    recommended GitHub configuration files.

Requirements:
    Python 3.10+
    Python standard library only

Usage:
    python tools/validate_repository.py
    python tools/validate_repository.py —strict
    python tools/validate_repository.py —root /path/to/MedOrbits
    python tools/validate_repository.py —quiet
    python tools/validate_repository.py —version

Exit codes:
    0 = Validation passed
    1 = Validation errors found
    2 = Invalid arguments or repository configuration error

Safety:
    - Read-only.
    - Does not execute application code.
    - Does not install dependencies.
    - Does not modify repository files.
    - Does not follow symbolic links.
“””

from __future__ import annotations

import argparse
import ast
import json
import os
import sys
import tokenize
from pathlib import Path
from typing import Any


VERSION = “2.0.0”

SCRIPT_PATH = Path(__file__).resolve()
DEFAULT_ROOT = SCRIPT_PATH.parent.parent

MAX_SOURCE_FILE_SIZE = 10 * 1024 * 1024

IGNORED_DIRS = {
    “.git”,
    “node_modules”,
    “.venv”,
    “venv”,
    “__pycache__”,
    “dist”,
    “build”,
    “.next”,
    “coverage”,
    “.pytest_cache”,
    “.mypy_cache”,
    “.ruff_cache”,
    “.tox”,
    “.turbo”,
    “.cache”,
    “vendor”,
}

REQUIRED_FILES = (
    “.github/FUNDING.yml”,
    “.github/SECURITY.md”,
    “.github/dependabot.yml”,
    “.github/workflows/repository-validation.yml”,
)

REQUIRED_DIRECTORIES = (
    “.github”,
    “tools”,
)

SOURCE_SUFFIXES = {
    “.json”,
    “.py”,
}


class ValidationError(Exception):
    “””Raised when repository validation cannot continue.”””


class DuplicateJsonKeyError(ValueError):
    “””Raised when a JSON object contains duplicate keys.”””


def parse_args() -> argparse.Namespace:
    “””Parse command-line arguments.”””

    parser = argparse.ArgumentParser(
        description=(
            “Validate MedOrbits repository structure, “
            “JSON syntax and Python syntax.”
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        “—root”,
        type=Path,
        default=DEFAULT_ROOT,
        help=“Repository root directory.”,
    )

    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=“Treat missing recommended files and directories as errors.”,
    )

    parser.add_argument(
        “—quiet”,
        action=“store_true”,
        help=“Print only the final summary and validation errors.”,
    )

    parser.add_argument(
        “—version”,
        action=“version”,
        version=f”MedOrbits Repository Health Checker {VERSION}”,
    )

    return parser.parse_args()


def is_inside_root(root: Path, target: Path) -> bool:
    “””Check whether a path is contained within the repository.”””

    try:
        target.relative_to(root)
        return True
    except ValueError:
        return False


def is_repository_root(root: Path) -> bool:
    “””Check for repository-root indicators without following symlinks.”””

    git_path = root / “.git”
    github_path = root / “.github”

    try:
        git_stat = git_path.lstat()
        github_stat = github_path.lstat()
    except FileNotFoundError:
        git_stat = None
        github_stat = None

    git_valid = (
        git_stat is not None
        and not git_path.is_symlink()
        and (git_path.is_dir() or git_path.is_file())
    )

    github_valid = (
        github_stat is not None
        and not github_path.is_symlink()
        and github_path.is_dir()
    )

    return git_valid or github_valid


def discover_files(root: Path):
    “””
    Yield repository JSON and Python files.

    Symlinked files and directories are excluded.
    Directory traversal errors are raised instead of silently ignored.
    “””

    def handle_walk_error(error: OSError) -> None:
        raise ValidationError(
            f”Cannot scan directory: {error}”
        )

    for current, directories, filenames in os.walk(
        root,
        topdown=True,
        followlinks=False,
        onerror=handle_walk_error,
    ):
        current_path = Path(current)

        directories[:] = sorted(
            directory
            for directory in directories
            if directory not in IGNORED_DIRS
            and not (current_path / directory).is_symlink()
        )

        for filename in sorted(filenames):
            file_path = current_path / filename

            if file_path.is_symlink():
                continue

            if file_path.suffix.lower() in SOURCE_SUFFIXES:
                yield file_path


def check_file_size(path: Path) -> str | None:
    “””Reject files exceeding the configured size limit.”””

    try:
        stat = path.lstat()
    except OSError as exc:
        return f”Cannot inspect file: {exc}”

    if path.is_symlink():
        return “Symbolic links are not permitted.”

    if not path.is_file():
        return “Path is not a regular file.”

    if stat.st_size > MAX_SOURCE_FILE_SIZE:
        return (
            f”File exceeds the “
            f”{MAX_SOURCE_FILE_SIZE // 1024 // 1024} MB size limit.”
        )

    return None


def reject_duplicate_json_keys(
    pairs: list[tuple[str, Any]],
) -> dict[str, Any]:
    “””Reject duplicate keys instead of silently accepting the last value.”””

    result: dict[str, Any] = {}

    for key, value in pairs:
        if key in result:
            raise DuplicateJsonKeyError(
                f”Duplicate JSON object key: {key!r}”
            )

        result[key] = value

    return result


def reject_nonstandard_json_constant(value: str) -> None:
    “””Reject NaN and Infinity, which are not valid standard JSON values.”””

    raise ValueError(
        f”Non-standard JSON numeric constant is not permitted: {value}”
    )


def validate_json(path: Path) -> str | None:
    “””Validate JSON syntax, duplicate keys and standard numeric values.”””

    size_error = check_file_size(path)

    if size_error:
        return size_error

    try:
        with path.open(“r”, encoding=“utf-8”) as file:
            json.load(
                file,
                object_pairs_hook=reject_duplicate_json_keys,
                parse_constant=reject_nonstandard_json_constant,
            )

    except json.JSONDecodeError as exc:
        return (
            f”line {exc.lineno}, column {exc.colno}: “
            f”{exc.msg}”
        )

    except (
        OSError,
        UnicodeError,
        ValueError,
        DuplicateJsonKeyError,
    ) as exc:
        return str(exc)

    return None


def validate_python(path: Path, relative: Path) -> str | None:
    “””Parse Python source without executing it.”””

    size_error = check_file_size(path)

    if size_error:
        return size_error

    try:
        # tokenize.open() respects Python encoding declarations.
        with tokenize.open(path) as file:
            source = file.read()

        ast.parse(
            source,
            filename=relative.as_posix(),
        )

    except SyntaxError as exc:
        location = (
            f”line {exc.lineno}”
            if exc.lineno is not None
            else “unknown line”
        )

        if exc.offset is not None:
            location += f”, column {exc.offset}”

        message = exc.msg or “Invalid Python syntax”

        return f”{location}: {message}”

    except (
        OSError,
        UnicodeError,
        ValueError,
        LookupError,
    ) as exc:
        return str(exc)

    return None


def check_required_paths(
    root: Path,
    strict: bool,
    errors: list[str],
    warnings: list[str],
) -> None:
    “””Check recommended files and directories.”””

    for relative in REQUIRED_FILES:
        target = root / relative

        try:
            stat = target.lstat()
        except FileNotFoundError:
            stat = None
        except OSError as exc:
            errors.append(
                f”Cannot inspect required file {relative}: {exc}”
            )
            continue

        valid = (
            stat is not None
            and not target.is_symlink()
            and target.is_file()
        )

        if not valid:
            message = f”Missing or invalid recommended file: {relative}”

            if strict:
                errors.append(message)
            else:
                warnings.append(message)

    for relative in REQUIRED_DIRECTORIES:
        target = root / relative

        try:
            stat = target.lstat()
        except FileNotFoundError:
            stat = None
        except OSError as exc:
            errors.append(
                f”Cannot inspect required directory {relative}: {exc}”
            )
            continue

        valid = (
            stat is not None
            and not target.is_symlink()
            and target.is_dir()
        )

        if not valid:
            message = f”Directory missing or invalid: {relative}”

            if strict:
                errors.append(message)
            else:
                warnings.append(message)


def validate_repository(
    root: Path,
    strict: bool,
    quiet: bool,
) -> int:
    “””Validate repository files and return the process exit code.”””

    if not root.exists() or not root.is_dir():
        print(
            f”ERROR: Repository root does not exist or is not a directory: {root}”,
            file=sys.stderr,
        )
        return 2

    try:
        root = root.resolve(strict=True)
    except (OSError, RuntimeError, ValueError) as exc:
        print(
            f”ERROR: Cannot resolve repository root: {exc}”,
            file=sys.stderr,
        )
        return 2

    if not is_repository_root(root):
        print(
            “ERROR: Repository root not detected. “
            “Expected a .git entry or .github directory.\n”
            f”Path: {root}”,
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
                print(f”[CHECK] {relative.as_posix()}”)

            if suffix == “.json”:
                checked_json += 1
                problem = validate_json(path)

                if problem:
                    errors.append(
                        f”Invalid JSON: {relative.as_posix()}: {problem}”
                    )

            elif suffix == “.py”:
                checked_python += 1
                problem = validate_python(path, relative)

                if problem:
                    errors.append(
                        f”Invalid Python: {relative.as_posix()}: {problem}”
                    )

    except (OSError, ValidationError) as exc:
        print(
            f”ERROR: Repository scan could not complete: {exc}”,
            file=sys.stderr,
        )
        return 2

    print(“\n============================================================“)
    print(“MedOrbits Repository Validation”)
    print(“============================================================“)
    print(f”Version:              {VERSION}”)
    print(f”Repository root:      {root}”)
    print(f”Source files scanned: {discovered_files}”)
    print(f”JSON files checked:   {checked_json}”)
    print(f”Python files checked: {checked_python}”)
    print(f”Errors:               {len(errors)}”)
    print(f”Warnings:             {len(warnings)}”)
    print(f”Strict mode:          {‘enabled’ if strict else ‘disabled’}”)
    print(“============================================================“)

    for warning in warnings:
        print(f”[WARNING] {warning}”)

    for error in errors:
        print(f”[ERROR] {error}”)

    if errors:
        print(“\n[RESULT] FAILED — correct the reported errors.”)
        return 1

    print(“\n[RESULT] PASSED”)

    if warnings:
        print(
            “[NOTE] Warnings remain. Review them before “
            “considering the repository release-ready.”
        )

    print(
        “[NOTE] Static checks do not replace application tests, “
        “dependency audits, workflow validation, or deployment checks.”
    )

    return 0


def main() -> int:
    “””Application entry point.”””

    args = parse_args()

    try:
        root = args.root.expanduser().resolve(strict=True)
    except (OSError, RuntimeError, ValueError) as exc:
        print(
            f”ERROR: Could not resolve repository path: {exc}”,
            file=sys.stderr,
        )
        return 2

    return validate_repository(
        root=root,
        strict=args.strict,
        quiet=args.quiet,
    )


if __name__ == “__main__”:
    raise SystemExit(main())
