
#!/usr/bin/env python3
"""
MedOrbits Repository Health Checker
Path: /tools/validate_repository.py

Usage:
    python tools/validate_repository.py
    python tools/validate_repository.py --strict
"""

from __future__ import annotations

import argparse
import ast
import json
import sys
from pathlib import Path

IGNORED_DIRS = {
    ".git", "node_modules", ".venv", "venv",
    "__pycache__", "dist", "build", ".next", "coverage",
}

REQUIRED_FILES = (
    ".github/FUNDING.yml",
    ".github/SECURITY.md",
    ".github/dependabot.yml",
    ".github/workflows/repository-validation.yml",
)

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat missing recommended files as errors.",
    )
    args = parser.parse_args()

    root = Path.cwd()
    if not (root / ".git").exists() and not (root / ".github").exists():
        print("ERROR: Run from the repository root.")
        return 2

    errors: list[str] = []
    warnings: list[str] = []
    checked_json = 0
    checked_python = 0

    for relative in REQUIRED_FILES:
        if not (root / relative).is_file():
            message = f"Missing recommended file: {relative}"
            (errors if args.strict else warnings).append(message)

    for directory in (root / ".github", root / "tools"):
        if not directory.is_dir():
            warnings.append(f"Directory not found: {directory.relative_to(root)}")

    for path in root.rglob("*"):
        if not path.is_file():
            continue

        try:
            relative = path.relative_to(root)
        except ValueError:
            continue

        if any(part in IGNORED_DIRS for part in relative.parts):
            continue

        if path.suffix.lower() == ".json":
            checked_json += 1
            try:
                with path.open("r", encoding="utf-8") as file:
                    json.load(file)
            except (OSError, UnicodeError, json.JSONDecodeError) as exc:
                errors.append(f"Invalid JSON: {relative}: {exc}")

        elif path.suffix.lower() == ".py":
            checked_python += 1
            try:
                source = path.read_text(encoding="utf-8")
                ast.parse(source, filename=str(relative))
            except (OSError, UnicodeError, SyntaxError) as exc:
                errors.append(f"Invalid Python: {relative}: {exc}")

    print("\nMedOrbits Repository Validation")
    print("=" * 34)
    print(f"JSON files checked:   {checked_json}")
    print(f"Python files checked: {checked_python}")
    print(f"Errors:               {len(errors)}")
    print(f"Warnings:             {len(warnings)}")

    for warning in warnings:
        print(f"WARNING: {warning}")

    for error in errors:
        print(f"ERROR: {error}")

    if errors:
        print("\nRESULT: FAILED -- correct the reported errors.")
        return 1

    print("\nRESULT: PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
