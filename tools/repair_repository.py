
#!/usr/bin/env python3
"""
MedOrbits Safe Repository Repair Utility
========================================

File: tools/repair_repository.py

Purpose:
    Inspect repository JSON and Python syntax, check required directories,
    and optionally create missing baseline directories and placeholder files.

Usage:
    python tools/repair_repository.py
    python tools/repair_repository.py --fix
    python tools/repair_repository.py --fix --create-missing
    python tools/repair_repository.py --root /path/to/MedOrbits
    python tools/repair_repository.py --strict

Safety:
    - Never deletes files.
    - Never overwrites existing files.
    - Does not automatically rewrite malformed source files.
    - Creates only explicitly permitted missing files and directories.
    - Does not install packages, execute repository code, or push to GitHub.
    - Does not claim that security reporting or sponsorship is configured.

Exit codes:
    0 = No detected validation errors
    1 = Validation or repair errors found
    2 = Invalid arguments or repository configuration error
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


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

REQUIRED_DIRECTORIES = (
    ".github/workflows",
    "tools",
)

# These are starter templates, not complete production configurations.
# Review and customize them before relying on them.
OPTIONAL_FILES = {
    ".github/FUNDING.yml": (
        "# MedOrbits funding configuration\n"
        "# No sponsorship platforms are configured.\n"
        "# Add supported platforms only after verifying the destination URLs.\n"
    ),
    ".github/SECURITY.md": (
        "# MedOrbits Security Policy\n"
        "\n"
        "> Configuration required: this starter policy is not a complete "
        "security-reporting procedure.\n"
        "\n"
        "## Reporting a Vulnerability\n"
        "\n"
        "Do not publish exploitable vulnerability details, credentials, "
        "access tokens, or private user data in public issues.\n"
        "\n"
        "Before publishing this policy, configure and verify an appropriate "
        "private vulnerability-reporting channel. If no verified private "
        "channel is available, do not request sensitive technical details "
        "through public issues.\n"
        "\n"
        "## Scope and Handling\n"
        "\n"
        "Document the supported versions, reporting procedure, response "
        "expectations, coordinated disclosure process, and remediation policy "
        "before treating this document as the project's complete security policy.\n"
    ),
}


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        "--root",
        type=Path,
        default=DEFAULT_ROOT,
        help="Repository root directory.",
    )

    parser.add_argument(
        "--fix",
        action="store_true",
        help="Allow explicitly supported repairs.",
    )

    parser.add_argument(
        "--create-missing",
        action="store_true",
        help="Create missing baseline directories and optional placeholder files.",
    )

    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat missing required directories as errors.",
    )

    parser.add_argument(
        "--backup",
        action="store_true",
        help=(
            "Create a timestamped backup of existing files before supported "
            "modifications. No existing-file modifications are currently performed."
        ),
    )

    return parser.parse_args()


def is_repository_root(root: Path) -> bool:
    """Check for basic repository-root indicators."""
    return (
        (root / ".git").exists()
        or (root / ".git").is_symlink()
        or (root / ".github").is_dir()
    )


def is_ignored(relative: Path) -> bool:
    """Check whether a repository-relative path should be skipped."""
    return any(part in IGNORED_DIRS for part in relative.parts) or (
        ".repair-backups" in relative.parts
    )


def backup_file(path: Path, root: Path) -> Path:
    """
    Create a timestamped backup without overwriting an earlier backup.

    This helper is reserved for future supported repairs that modify existing
    files. The current utility deliberately does not rewrite existing files.
    """
    relative = path.relative_to(root)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup_root = root / ".repair-backups" / stamp
    destination = backup_root / relative

    if destination.exists():
        raise FileExistsError(f"Backup destination already exists: {destination}")

    destination.parent.mkdir(parents=True, exist_ok=True)

    # Exclusive creation prevents accidental overwriting.
    with path.open("rb") as source:
        with destination.open("xb") as target:
            while True:
                chunk = source.read(1024 * 1024)
                if not chunk:
                    break
                target.write(chunk)

    return destination


def check_json(path: Path) -> str | None:
    """Return a JSON syntax or file-access error, if any."""
    try:
        with path.open("r", encoding="utf-8-sig") as file:
            json.load(file)
    except json.JSONDecodeError as exc:
        return f"line {exc.lineno}, column {exc.colno}: {exc.msg}"
    except (OSError, UnicodeError, ValueError) as exc:
        return str(exc)

    return None


def check_python(path: Path, root: Path) -> str | None:
    """Parse Python source without executing it."""
    try:
        source = path.read_text(encoding="utf-8")
        ast.parse(source, filename=path.relative_to(root).as_posix())
    except SyntaxError as exc:
        location = (
            f"line {exc.lineno}"
            if exc.lineno is not None
            else "unknown line"
        )

        if exc.offset is not None:
            location += f", column {exc.offset}"

        return f"{location}: {exc.msg or 'invalid Python syntax'}"
    except (OSError, UnicodeError, ValueError) as exc:
        return str(exc)

    return None


def discover_source_files(root: Path):
    """Yield JSON and Python files while skipping ignored and symlinked paths."""
    for current, directories, filenames in os.walk(
        root,
        topdown=True,
        followlinks=False,
    ):
        current_path = Path(current)

        directories[:] = sorted(
            name
            for name in directories
            if name not in IGNORED_DIRS
            and name != ".repair-backups"
            and not (current_path / name).is_symlink()
        )

        for filename in sorted(filenames):
            path = current_path / filename

            if path.is_symlink():
                continue

            if path.suffix.lower() not in {".json", ".py"}:
                continue

            yield path


def create_directory(
    root: Path,
    relative: str,
    repairs: list[str],
    warnings: list[str],
    errors: list[str],
) -> None:
    """Create a missing directory without replacing existing filesystem entries."""
    target = root / relative

    if target.is_dir():
        return

    if target.exists() or target.is_symlink():
        errors.append(
            f"Cannot create directory because a non-directory entry exists: "
            f"{relative}"
        )
        return

    try:
        target.mkdir(parents=True, exist_ok=False)
        repairs.append(f"Created directory: {relative}")
    except FileExistsError:
        if target.is_dir():
            return
        errors.append(f"Directory creation conflict: {relative}")
    except OSError as exc:
        errors.append(f"Could not create directory {relative}: {exc}")


def create_optional_file(
    root: Path,
    relative: str,
    content: str,
    repairs: list[str],
    warnings: list[str],
    errors: list[str],
) -> None:
    """Create a missing placeholder file without overwriting existing content."""
    target = root / relative

    if target.is_file():
        warnings.append(f"Existing file preserved: {relative}")
        return

    if target.exists() or target.is_symlink():
        errors.append(
            f"Cannot create file because a filesystem entry already exists: "
            f"{relative}"
        )
        return

    try:
        target.parent.mkdir(parents=True, exist_ok=True)

        # Exclusive mode protects against overwriting an existing file.
        with target.open("x", encoding="utf-8", newline="\n") as file:
            file.write(content)

        repairs.append(f"Created placeholder file: {relative}")

    except FileExistsError:
        warnings.append(f"File appeared during creation and was preserved: {relative}")
    except OSError as exc:
        errors.append(f"Could not create {relative}: {exc}")


def main() -> int:
    args = parse_args()

    if args.create_missing and not args.fix:
        print(
            "ERROR: --create-missing requires --fix.",
            file=sys.stderr,
        )
        return 2

    try:
        root = args.root.expanduser().resolve()
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"ERROR: Could not resolve repository path: {exc}", file=sys.stderr)
        return 2

    if not root.is_dir():
        print(f"ERROR: Repository directory does not exist: {root}", file=sys.stderr)
        return 2

    if not is_repository_root(root):
        print(
            "ERROR: Repository root not detected. Expected a .git entry "
            f"or .github directory under: {root}",
            file=sys.stderr,
        )
        return 2

    errors: list[str] = []
    warnings: list[str] = []
    repairs: list[str] = []

    checked_json = 0
    checked_python = 0
    scanned_files = 0

    # Check required directories before scanning.
    for relative in REQUIRED_DIRECTORIES:
        target = root / relative

        if target.is_dir():
            continue

        if args.fix and args.create_missing:
            create_directory(
                root,
                relative,
                repairs,
                warnings,
                errors,
            )
        else:
            message = f"Missing required directory: {relative}"
            (errors if args.strict else warnings).append(message)

    # Create optional placeholders only when explicitly requested.
    if args.fix and args.create_missing:
        for relative, content in OPTIONAL_FILES.items():
            create_optional_file(
                root,
                relative,
                content,
                repairs,
                warnings,
                errors,
            )

    # Scan JSON and Python source files.
    try:
        for path in discover_source_files(root):
            scanned_files += 1
            relative = path.relative_to(root)
            display_path = relative.as_posix()

            if path.suffix.lower() == ".json":
                checked_json += 1
                issue = check_json(path)

                if issue:
                    errors.append(f"Invalid JSON: {display_path}: {issue}")

            elif path.suffix.lower() == ".py":
                checked_python += 1
                issue = check_python(path, root)

                if issue:
                    errors.append(f"Invalid Python: {display_path}: {issue}")

    except OSError as exc:
        print(f"ERROR: Repository scan failed: {exc}", file=sys.stderr)
        return 2

    print("\nMedOrbits Repository Repair Report")
    print("=" * 38)
    print(f"Repository root:      {root}")
    print(f"Source files scanned: {scanned_files}")
    print(f"JSON files checked:   {checked_json}")
    print(f"Python files checked: {checked_python}")

    if args.backup:
        print(
            "Backup mode:          requested; no existing-file modifications "
            "are currently supported."
        )

    for item in repairs:
        print(f"REPAIRED: {item}")

    for item in warnings:
        print(f"WARNING: {item}")

    for item in errors:
        print(f"ERROR: {item}")

    print(f"\nRepairs: {len(repairs)}")
    print(f"Warnings: {len(warnings)}")
    print(f"Errors: {len(errors)}")

    if errors:
        print("\nRESULT: FAILED -- review the reported issues.")
        print(
            "No automatic JSON or Python syntax rewriting was attempted."
        )
        return 1

    print("\nRESULT: PASSED")
    print(
        "JSON and Python syntax checks completed without detected errors."
    )
    print(
        "Existing files were not overwritten, and no files were deleted."
    )
    print(
        "Review newly created security and funding placeholders before use."
    )
    print(
        "This utility does not validate application behavior, YAML semantics, "
        "dependency security, or deployment readiness."
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
