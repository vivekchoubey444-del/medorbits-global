
#!/usr/bin/env python3
“””
===============================================================================
MedOrbits Safe Repository Repair Utility
File: tools/repair_repository.py
Version: 2.0.0

Purpose:
    Inspect repository JSON and Python syntax, check required directories,
    and optionally create missing baseline directories and placeholder files.

Usage:
    python tools/repair_repository.py
    python tools/repair_repository.py —fix
    python tools/repair_repository.py —fix —create-missing
    python tools/repair_repository.py —root /path/to/MedOrbits
    python tools/repair_repository.py —strict
    python tools/repair_repository.py —fix —create-missing —strict

Safety:
    - Never deletes files.
    - Never overwrites existing files.
    - Does not rewrite malformed source files.
    - Creates only explicitly permitted missing files and directories.
    - Rejects symbolic-link destinations and parent directories.
    - Does not install packages or execute repository code.
    - Does not commit, push, or deploy.
    - Does not claim that security reporting or sponsorship is configured.

Exit codes:
    0 = No detected validation errors
    1 = Validation or repair errors found
    2 = Invalid arguments or repository configuration error
===============================================================================
“””

from __future__ import annotations

import argparse
import ast
import json
import os
import stat
import sys

from pathlib import Path
from typing import Any


VERSION = “2.0.0”

SCRIPT_PATH = Path(__file__).resolve()
DEFAULT_ROOT = SCRIPT_PATH.parent.parent

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
    “.repair-backups”,
}

REQUIRED_DIRECTORIES = (
    “.github/workflows”,
    “tools”,
)

OPTIONAL_FILES = {
    “.github/FUNDING.yml”: (
        “# MedOrbits funding configuration\n”
        “# No sponsorship platforms are configured.\n”
        “# Add supported platforms only after verifying destination URLs.\n”
    ),
    “.github/SECURITY.md”: (
        “# MedOrbits Security Policy\n”
        “\n”
        “> Configuration required: this starter policy is not a complete “
        “security-reporting procedure.\n”
        “\n”
        “## Reporting a Vulnerability\n”
        “\n”
        “Do not publish exploitable vulnerability details, credentials, “
        “access tokens, or private user data in public issues.\n”
        “\n”
        “Before publishing this policy, configure and verify an appropriate “
        “private vulnerability-reporting channel. If no verified private “
        “channel is available, do not request sensitive technical details “
        “through public issues.\n”
        “\n”
        “## Scope and Handling\n”
        “\n”
        “Document supported versions, reporting procedures, response “
        “expectations, coordinated disclosure, and remediation policies “
        “before treating this document as the complete security policy.\n”
    ),
}

MAX_SOURCE_FILE_SIZE = 10 * 1024 * 1024


# =============================================================================
# ARGUMENTS
# =============================================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        “—root”,
        type=Path,
        default=DEFAULT_ROOT,
        help=“Repository root directory.”,
    )

    parser.add_argument(
        “—fix”,
        action=“store_true”,
        help=“Allow explicitly supported repairs.”,
    )

    parser.add_argument(
        “—create-missing”,
        action=“store_true”,
        help=(
            “Create missing baseline directories and optional “
            “placeholder files. Requires —fix.”
        ),
    )

    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=(
            “Treat missing required directories and validation warnings “
            “as errors.”
        ),
    )

    parser.add_argument(
        “—backup”,
        action=“store_true”,
        help=(
            “Reserved for future repairs that modify existing files. “
            “No existing-file modifications are currently supported.”
        ),
    )

    return parser.parse_args()


# =============================================================================
# LOGGING AND RESULTS
# =============================================================================

class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.repairs: list[str] = []
        self.passed: list[str] = []
        self.skipped: list[str] = []

    def pass_check(self, message: str) -> None:
        self.passed.append(message)

    def warning(self, message: str) -> None:
        self.warnings.append(message)

    def error(self, message: str) -> None:
        self.errors.append(message)

    def repaired(self, message: str) -> None:
        self.repairs.append(message)

    def skipped_check(self, message: str) -> None:
        self.skipped.append(message)


# =============================================================================
# REPOSITORY VALIDATION
# =============================================================================

def is_repository_root(root: Path) -> bool:
    “””
    Verify basic repository indicators.

    Git worktrees may use a regular .git file instead of a directory.
    A .github directory is also accepted for repositories without Git metadata.
    “””

    git_entry = root / “.git”
    github_directory = root / “.github”

    git_exists = (
        git_entry.is_file() or git_entry.is_dir()
    ) and not git_entry.is_symlink()

    github_exists = (
        github_directory.is_dir()
        and not github_directory.is_symlink()
    )

    return git_exists or github_exists


def validate_root(value: Path) -> Path:
    try:
        root = value.expanduser().resolve(strict=True)
    except (OSError, RuntimeError, ValueError) as exc:
        raise ValueError(
            f”Could not resolve repository path: {exc}”
        ) from exc

    if not root.is_dir():
        raise ValueError(
            f”Repository path is not a directory: {root}”
        )

    if not is_repository_root(root):
        raise ValueError(
            “Repository root not detected. Expected a .git entry “
            “or a .github directory.”
        )

    return root


def relative_path(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


def is_ignored(relative: Path) -> bool:
    return any(
        part in IGNORED_DIRS
        for part in relative.parts
    )


# =============================================================================
# FILESYSTEM SAFETY
# =============================================================================

def validate_relative_path(relative: str) -> Path:
    “””
    Reject absolute paths, traversal, and empty path components.
    “””

    candidate = Path(relative)

    if candidate.is_absolute():
        raise ValueError(
            f”Absolute paths are not permitted: {relative}”
        )

    if not candidate.parts:
        raise ValueError(“Empty relative path is not permitted.”)

    if any(part in {“”, “.”, “..”} for part in candidate.parts):
        raise ValueError(
            f”Unsafe relative path: {relative}”
        )

    return candidate


def inspect_path_components(
    root: Path,
    relative: Path,
    *,
    include_leaf: bool = True,
) -> None:
    “””
    Reject symbolic-link components and filesystem type conflicts.

    This is a defensive check, not a guarantee against concurrent filesystem
    changes by another process.
    “””

    components = relative.parts

    if not include_leaf:
        components = components[:-1]

    current = root

    for component in components:
        current = current / component

        try:
            info = current.lstat()
        except FileNotFoundError:
            continue
        except OSError as exc:
            raise OSError(
                f”Cannot inspect path component {current}: {exc}”
            ) from exc

        if stat.S_ISLNK(info.st_mode):
            raise ValueError(
                f”Symbolic-link path component is not permitted: “
                f”{current.relative_to(root).as_posix()}”
            )

        if not stat.S_ISDIR(info.st_mode):
            raise ValueError(
                f”Expected a directory but found another filesystem entry: “
                f”{current.relative_to(root).as_posix()}”
            )


def safe_regular_file(root: Path, path: Path) -> bool:
    try:
        info = path.lstat()
    except OSError:
        return False

    if stat.S_ISLNK(info.st_mode):
        return False

    return stat.S_ISREG(info.st_mode)


# =============================================================================
# DIRECTORY CREATION
# =============================================================================

def create_directory(
    root: Path,
    relative: str,
    report: Report,
) -> None:
    “””Create missing directory components without replacing existing entries.”””

    try:
        candidate = validate_relative_path(relative)
        current = root

        for component in candidate.parts:
            current = current / component

            try:
                info = current.lstat()

                if stat.S_ISLNK(info.st_mode):
                    raise ValueError(
                        f”Refusing symbolic-link directory: {current}”
                    )

                if not stat.S_ISDIR(info.st_mode):
                    raise ValueError(
                        f”Directory path conflicts with an existing file: “
                        f”{current}”
                    )

            except FileNotFoundError:
                try:
                    current.mkdir()
                    report.repaired(
                        f”Created directory: “
                        f”{relative_path(root, current)}”
                    )
                except FileExistsError:
                    # Another process may have created the directory.
                    info = current.lstat()

                    if (
                        stat.S_ISLNK(info.st_mode)
                        or not stat.S_ISDIR(info.st_mode)
                    ):
                        raise ValueError(
                            f”Unsafe directory creation conflict: {current}”
                        )

    except (OSError, ValueError) as exc:
        report.error(
            f”Could not create directory {relative}: {exc}”
        )


# =============================================================================
# PLACEHOLDER FILE CREATION
# =============================================================================

def create_optional_file(
    root: Path,
    relative: str,
    content: str,
    report: Report,
) -> None:
    “””
    Create a new placeholder file exclusively.

    Existing files are preserved.
    Symbolic-link parent directories are rejected.
    “””

    try:
        candidate = validate_relative_path(relative)

        inspect_path_components(
            root,
            candidate,
            include_leaf=False,
        )

        target = root / candidate

        try:
            info = target.lstat()

            if stat.S_ISLNK(info.st_mode):
                raise ValueError(
                    “Destination is a symbolic link.”
                )

            if stat.S_ISREG(info.st_mode):
                report.warning(
                    f”Existing file preserved: {relative}”
                )
                return

            raise ValueError(
                “Destination exists but is not a regular file.”
            )

        except FileNotFoundError:
            pass

        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL

        if hasattr(os, “O_NOFOLLOW”):
            flags |= os.O_NOFOLLOW

        descriptor = os.open(
            target,
            flags,
            0o600,
        )

        with os.fdopen(
            descriptor,
            “w”,
            encoding=“utf-8”,
            newline=“\n”,
        ) as handle:
            handle.write(content)

        report.repaired(
            f”Created placeholder file: {relative}”
        )

    except FileExistsError:
        report.warning(
            f”File appeared during creation and was preserved: {relative}”
        )

    except (OSError, ValueError) as exc:
        report.error(
            f”Could not create placeholder {relative}: {exc}”
        )


# =============================================================================
# JSON VALIDATION
# =============================================================================

def check_json(path: Path) -> str | None:
    try:
        if path.stat().st_size > MAX_SOURCE_FILE_SIZE:
            return “File exceeds the 10 MiB validation limit.”

        with path.open(
            “r”,
            encoding=“utf-8-sig”,
        ) as handle:
            json.load(handle)

    except json.JSONDecodeError as exc:
        return (
            f”line {exc.lineno}, column {exc.colno}: {exc.msg}”
        )

    except (OSError, UnicodeError, ValueError, RecursionError) as exc:
        return str(exc)

    return None


# =============================================================================
# PYTHON VALIDATION
# =============================================================================

def check_python(path: Path, root: Path) -> str | None:
    try:
        if path.stat().st_size > MAX_SOURCE_FILE_SIZE:
            return “File exceeds the 10 MiB validation limit.”

        source = path.read_text(encoding=“utf-8-sig”)

        ast.parse(
            source,
            filename=relative_path(root, path),
        )

    except SyntaxError as exc:
        location = (
            f”line {exc.lineno}”
            if exc.lineno is not None
            else “unknown line”
        )

        if exc.offset is not None:
            location += f”, column {exc.offset}”

        return (
            f”{location}: {exc.msg or ‘invalid Python syntax’}”
        )

    except (OSError, UnicodeError, ValueError, RecursionError) as exc:
        return str(exc)

    return None


# =============================================================================
# SOURCE FILE DISCOVERY
# =============================================================================

def discover_source_files(root: Path):
    “””
    Yield JSON and Python files.

    Symlinked directories and files are not followed.
    “””

    for current, directories, filenames in os.walk(
        root,
        topdown=True,
        followlinks=False,
    ):
        current_path = Path(current)

        safe_directories = []

        for name in sorted(directories):
            directory = current_path / name
            relative = directory.relative_to(root)

            if is_ignored(relative):
                continue

            try:
                info = directory.lstat()
            except OSError:
                continue

            if stat.S_ISLNK(info.st_mode):
                continue

            if stat.S_ISDIR(info.st_mode):
                safe_directories.append(name)

        directories[:] = safe_directories

        for filename in sorted(filenames):
            path = current_path / filename
            relative = path.relative_to(root)

            if is_ignored(relative):
                continue

            if path.suffix.lower() not in {“.json”, “.py”}:
                continue

            try:
                info = path.lstat()
            except OSError:
                continue

            if not stat.S_ISREG(info.st_mode):
                continue

            yield path


# =============================================================================
# SOURCE SCANNING
# =============================================================================

def scan_sources(
    root: Path,
    report: Report,
) -> tuple[int, int, int]:
    scanned = 0
    checked_json = 0
    checked_python = 0

    try:
        for path in discover_source_files(root):
            scanned += 1
            relative = relative_path(root, path)

            if path.suffix.lower() == “.json”:
                checked_json += 1
                issue = check_json(path)

                if issue:
                    report.error(
                        f”Invalid JSON: {relative}: {issue}”
                    )
                else:
                    report.pass_check(
                        f”Valid JSON: {relative}”
                    )

            elif path.suffix.lower() == “.py”:
                checked_python += 1
                issue = check_python(path, root)

                if issue:
                    report.error(
                        f”Invalid Python: {relative}: {issue}”
                    )
                else:
                    report.pass_check(
                        f”Valid Python: {relative}”
                    )

    except OSError as exc:
        report.error(
            f”Repository scan failed: {exc}”
        )

    return scanned, checked_json, checked_python


# =============================================================================
# REQUIRED DIRECTORY CHECKS
# =============================================================================

def check_required_directories(
    root: Path,
    args: argparse.Namespace,
    report: Report,
) -> None:

    for relative in REQUIRED_DIRECTORIES:
        candidate = validate_relative_path(relative)
        target = root / candidate

        try:
            inspect_path_components(root, candidate)

            if target.is_dir():
                report.pass_check(
                    f”Required directory exists: {relative}”
                )
                continue

            if args.fix and args.create_missing:
                create_directory(root, relative, report)
                continue

            message = f”Missing required directory: {relative}”

            if args.strict:
                report.error(message)
            else:
                report.warning(message)

        except (OSError, ValueError) as exc:
            report.error(
                f”Unsafe required directory {relative}: {exc}”
            )


# =============================================================================
# FINAL REPORT
# =============================================================================

def print_report(
    root: Path,
    report: Report,
    scanned: int,
    checked_json: int,
    checked_python: int,
    args: argparse.Namespace,
) -> int:

    print()
    print(“MedOrbits Repository Repair Report”)
    print(“=“ * 44)

    print(f”Version:              {VERSION}”)
    print(f”Repository root:      {root}”)
    print(f”Source files scanned: {scanned}”)
    print(f”JSON files checked:   {checked_json}”)
    print(f”Python files checked: {checked_python}”)

    print(f”\nPassed:   {len(report.passed)}”)
    print(f”Repairs:  {len(report.repairs)}”)
    print(f”Warnings: {len(report.warnings)}”)
    print(f”Errors:   {len(report.errors)}”)

    if args.backup:
        print(
            “\nBackup option: requested, but no existing-file “
            “modifications are supported by this version.”
        )

    if report.repairs:
        print(“\nREPAIRS”)

        for item in report.repairs:
            print(f”  [CREATED] {item}”)

    if report.warnings:
        print(“\nWARNINGS”)

        for item in report.warnings:
            print(f”  [WARN] {item}”)

    if report.errors:
        print(“\nERRORS”)

        for item in report.errors:
            print(f”  [FAIL] {item}”)

    if report.skipped:
        print(“\nSKIPPED”)

        for item in report.skipped:
            print(f”  [SKIP] {item}”)

    effective_errors = (
        len(report.errors)
        + (len(report.warnings) if args.strict else 0)
    )

    print(“\n” + “=“ * 44)

    if effective_errors:
        print(“RESULT: FAILED”)
        print(“Review the reported issues before proceeding.”)
        return 1

    print(“RESULT: PASSED”)
    print(“No validation errors were detected.”)

    if report.repairs:
        print(
            “Missing baseline items were created without “
            “overwriting existing files.”
        )

    print(
        “This utility does not validate application behavior, “
        “dependency security, YAML semantics, or deployment readiness.”
    )

    return 0


# =============================================================================
# MAIN
# =============================================================================

def main() -> int:
    args = parse_args()

    if args.create_missing and not args.fix:
        print(
            “ERROR: —create-missing requires —fix.”,
            file=sys.stderr,
        )
        return 2

    try:
        root = validate_root(args.root)
    except ValueError as exc:
        print(f”ERROR: {exc}”, file=sys.stderr)
        return 2

    report = Report()

    print(“MedOrbits Safe Repository Repair Utility”)
    print(f”Version: {VERSION}”)
    print(f”Repository: {root}”)

    check_required_directories(
        root,
        args,
        report,
    )

    if args.fix and args.create_missing:
        for relative, content in OPTIONAL_FILES.items():
            create_optional_file(
                root,
                relative,
                content,
                report,
            )

    scanned, checked_json, checked_python = scan_sources(
        root,
        report,
    )

    return print_report(
        root,
        report,
        scanned,
        checked_json,
        checked_python,
        args,
    )


if __name__ == “__main__”:
    raise SystemExit(main())
