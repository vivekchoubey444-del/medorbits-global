
#!/usr/bin/env python3
"""
MedOrbits Package JSON Generator
================================
File: tools/generate_package_json.py

Features:
- Generates package.json in the repository root.
- Preserves existing package metadata and dependencies when valid.
- Detects common project files to configure scripts.
- Creates a timestamped backup before replacing an existing file.
- Validates the generated JSON.
- Does not install packages or execute project scripts.

Usage:
    python tools/generate_package_json.py
    python tools/generate_package_json.py --root .
    python tools/generate_package_json.py --force
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_PACKAGE = {
    "name": "medorbits",
    "version": "1.0.0",
    "private": True,
    "description": "MedOrbits education, medical admissions, careers and consultancy platform.",
    "engines": {
        "node": ">=22.0.0"
    },
    "scripts": {},
    "dependencies": {},
    "devDependencies": {}
}


def read_json(path: Path) -> dict[str, Any]:
    """Read a JSON object, rejecting malformed or non-object JSON."""
    with path.open("r", encoding="utf-8-sig") as file:
        data = json.load(file)

    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a JSON object.")

    return data


def detect_scripts(root: Path) -> dict[str, str]:
    """Create scripts only when their required files or tools exist."""
    scripts: dict[str, str] = {}

    if (root / "server.js").is_file():
        scripts["start"] = "node server.js"
        scripts["check:server"] = "node --check server.js"

    if (root / "index.js").is_file() and "start" not in scripts:
        scripts["start"] = "node index.js"

    if (root / "app.js").is_file() and "start" not in scripts:
        scripts["start"] = "node app.js"

    if (root / "index.html").is_file():
        scripts["check:html"] = (
            'node -e "const fs=require(\'fs\');'
            'if(!fs.existsSync(\'index.html\'))process.exit(1);"'
        )

    if (root / "tests").is_dir() or (root / "test").is_dir():
        scripts["test"] = (
            'node -e "console.log(\'Add the project test runner here.\')"'
        )

    if (root / "eslint.config.js").is_file() or (
        root / "eslint.config.mjs"
    ).is_file():
        scripts["lint"] = "eslint ."

    if (root / "tsconfig.json").is_file():
        scripts["check:types"] = "tsc --noEmit"

    if (root / "vite.config.js").is_file() or (
        root / "vite.config.ts"
    ).is_file() or (root / "vite.config.mjs").is_file():
        scripts.setdefault("dev", "vite")
        scripts.setdefault("build", "vite build")
        scripts.setdefault("preview", "vite preview")

    return scripts


def valid_package_name(name: str) -> str:
    """Normalize a basic npm package name."""
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9._-]+", "-", name)
    name = name.strip("-.")

    if not name:
        return "medorbits"

    return name[:214]


def backup_file(path: Path) -> Path:
    """Create a timestamped backup without overwriting another backup."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = path.with_name(f"{path.name}.{timestamp}.bak")
    counter = 1

    while backup.exists():
        backup = path.with_name(
            f"{path.name}.{timestamp}.{counter}.bak"
        )
        counter += 1

    shutil.copy2(path, backup)
    return backup


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate or repair the root package.json."
    )
    parser.add_argument(
        "--root",
        default=".",
        help="Repository root directory (default: current directory)."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace malformed package.json after backing it up."
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()

    if not root.is_dir():
        print(f"ERROR: Repository directory does not exist: {root}")
        return 1

    package_path = root / "package.json"
    existing: dict[str, Any] = {}

    if package_path.exists():
        try:
            existing = read_json(package_path)
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as exc:
            if not args.force:
                print(f"ERROR: Existing package.json is invalid: {exc}")
                print("Review the file or rerun with --force to back it up and replace it.")
                return 1

            try:
                backup = backup_file(package_path)
                print(f"Backup created: {backup}")
            except OSError as backup_error:
                print(f"ERROR: Could not back up existing file: {backup_error}")
                return 1

            existing = {}

    # Preserve existing metadata, dependencies and custom configuration.
    package = {**DEFAULT_PACKAGE, **existing}

    package["name"] = valid_package_name(
        str(package.get("name") or root.name)
    )
    package["version"] = str(package.get("version") or "1.0.0")

    if not isinstance(package.get("engines"), dict):
        package["engines"] = {}

    package["engines"].setdefault("node", ">=22.0.0")

    for field in ("scripts", "dependencies", "devDependencies"):
        if not isinstance(package.get(field), dict):
            package[field] = {}

    detected_scripts = detect_scripts(root)

    # Add missing scripts, but do not overwrite existing custom commands.
    for name, command in detected_scripts.items():
        package["scripts"].setdefault(name, command)

    # A safe default for repositories with no detected start command.
    package["scripts"].setdefault(
        "check:package",
        'node -e "JSON.parse(require(\'fs\').readFileSync(\'package.json\',\'utf8\')); console.log(\'package.json is valid\')"'
    )

    try:
        # Validate the exact serialized content before writing.
        serialized = json.dumps(
            package,
            indent=2,
            ensure_ascii=False,
            sort_keys=False
        ) + "\n"
        json.loads(serialized)

        if package_path.exists() and package_path.stat().st_size > 0:
            # Back up before updating an existing valid file.
            backup = backup_file(package_path)
            print(f"Backup created: {backup}")

        temporary_path = root / "package.json.tmp"

        with temporary_path.open("w", encoding="utf-8", newline="\n") as file:
            file.write(serialized)
            file.flush()
            os.fsync(file.fileno())

        # Atomic replacement on the same filesystem.
        os.replace(temporary_path, package_path)

    except (OSError, TypeError, ValueError) as exc:
        print(f"ERROR: Could not generate package.json: {exc}")
        return 1

    print(f"SUCCESS: Generated {package_path}")
    print(f"Package: {package['name']}@{package['version']}")
    print(f"Scripts configured: {len(package['scripts'])}")
    print("No dependencies were installed and no project scripts were executed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
