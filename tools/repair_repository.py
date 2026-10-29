
#!/usr/bin/env python3
"""
MedOrbits Safe Repository Repair Utility
Path: /tools/repair_repository.py

Usage:
    python tools/repair_repository.py
    python tools/repair_repository.py --fix
    python tools/repair_repository.py --fix --create-missing

Safety:
    - Creates backups before changing existing files.
    - Never deletes files.
    - Does not overwrite existing configuration by default.
    - Does not install packages or push to GitHub.
"""

from __future__ import annotations

import argparse
import ast
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

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
}

REQUIRED_DIRECTORIES = (
    ".github/workflows",
    "tools",
)

OPTIONAL_FILES = {
    ".github/FUNDING.yml": (
        "# MedOrbits funding configuration.\n"
        "# No sponsorship platforms are configured.\n"
        "# Add a supported platform only if you choose to accept sponsorships.\n"
    ),
    ".github/SECURITY.md": (
        "# Security Policy\n\n"
        "## Reporting a Vulnerability\n\n"
        "Do not publish exploitable vulnerabilities, credentials, or private "
        "user data in public issues. Use GitHub private vulnerability reporting "
        "if enabled for this repository.\n"
    ),
}


def is_ignored(path: Path) -> bool:
    return any(part in IGNORED_DIRS for part in path.parts)


def backup_file(path: Path, root: Path) -> Path:
    """Create a timestamped backup outside the source file's directory."""
    backup_root = root / ".repair-backups"
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    relative = path.relative_to(root)
    destination = backup_root / stamp / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, destination)
    return destination


def check_json(path: Path) -> str | None:
    try:
        with path.open("r", encoding="utf-8") as file:
            json.load(file)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        return str(exc)
    return None


def check_python(path: Path) -> str | None:
    try:
        source = path.read_text(encoding="utf-8")
        ast.parse(source, filename=str(path))
    except (OSError, UnicodeError, SyntaxError) as exc:
        return str(exc)
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Apply only safe, explicitly supported repairs.",
    )
    parser.add_argument(
        "--create-missing",
        action="store_true",
        help="Create missing optional baseline files and directories.",
    )
    args = parser.parse_args()

    root = Path.cwd()
    if not (root / ".git").exists() and not (root / ".github").exists():
        print("ERROR: Run this script from the repository root.")
        return 2

    errors: list[str] = []
    warnings: list[str] = []
    repairs: list[str] = []
    checked_json = 0
    checked_python = 0

    # Check repository directories.
    for relative in REQUIRED_DIRECTORIES:
        target = root / relative
        if not target.is_dir():
            if args.fix and args.create_missing:
                target.mkdir(parents=True, exist_ok=True)
                repairs.append(f"Created directory: {relative}")
            else:
                warnings.append(f"Missing directory: {relative}")

    # Check JSON and Python files.
    for path in root.rglob("*"):
        if not path.is_file():
            continue

        relative = path.relative_to(root)
        if is_ignored(relative) or ".repair-backups" in relative.parts:
            continue

        if path.suffix.lower() == ".json":
            checked_json += 1
            issue = check_json(path)
            if issue:
                errors.append(f"Invalid JSON: {relative}: {issue}")

        elif path.suffix.lower() == ".py":
            checked_python += 1
            issue = check_python(path)
            if issue:
                errors.append(f"Invalid Python: {relative}: {issue}")

    # Create optional files only when explicitly requested.
    if args.fix and args.create_missing:
        for relative, content in OPTIONAL_FILES.items():
            target = root / relative
            if target.exists():
                continue
            try:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content, encoding="utf-8")
                repairs.append(f"Created optional file: {relative}")
            except OSError as exc:
                errors.append(f"Could not create {relative}: {exc}")

    print("\nMedOrbits Repository Repair Report")
    print("=" * 38)
    print(f"JSON files checked:   {checked_json}")
    print(f"Python files checked: {checked_python}")

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
        print(
            "\nNo automatic syntax repair was attempted. "
            "Review each reported file before editing it."
        )
        return 1

    print("\nRESULT: No JSON or Python syntax errors detected.")
    print("This utility does not validate application behavior or all workflows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
