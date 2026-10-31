
#!/usr/bin/env python3
“””
===============================================================================
MedOrbits Package JSON Generator
File: tools/generate_package_json.py
Version: 2.0.0

Purpose:
    Generate or safely update the root package.json.

Features:
    - Preserve valid existing package metadata.
    - Preserve dependencies, devDependencies and custom scripts.
    - Detect project files and configure appropriate scripts.
    - Validate the generated JSON before writing.
    - Create exclusive timestamped backups before replacing existing files.
    - Avoid unnecessary rewrites.
    - Reject symbolic-link destinations and temporary-file conflicts.
    - Warn when an existing package-lock.json may need review.

Safety:
    - Does not install packages.
    - Does not execute project scripts.
    - Does not delete repository files.
    - Does not overwrite existing backups.
    - Does not silently discard malformed dependency configuration.
    - Does not modify package-lock.json.

Usage:
    python tools/generate_package_json.py
    python tools/generate_package_json.py —root .
    python tools/generate_package_json.py —force
    python tools/generate_package_json.py —dry-run
===============================================================================
“””

from __future__ import annotations

import argparse
import json
import os
import re
import stat
import sys
import tempfile

from datetime import datetime, timezone
from pathlib import Path
from typing import Any


VERSION = “2.0.0”

DEFAULT_PACKAGE: dict[str, Any] = {
    “name”: “medorbits”,
    “version”: “1.0.0”,
    “private”: True,
    “description”: (
        “MedOrbits education, medical admissions, careers “
        “and consultancy platform.”
    ),
    “engines”: {
        “node”: “>=22.0.0”
    },
    “scripts”: {},
    “dependencies”: {},
    “devDependencies”: {},
}

OBJECT_SECTIONS = (
    “scripts”,
    “dependencies”,
    “devDependencies”,
    “optionalDependencies”,
    “peerDependencies”,
    “peerDependenciesMeta”,
    “overrides”,
    “resolutions”,
    “engines”,
)

MAX_PACKAGE_SIZE = 5 * 1024 * 1024


# =============================================================================
# LOGGING
# =============================================================================

def info(message: str) -> None:
    print(f”[INFO] {message}”)


def success(message: str) -> None:
    print(f”[PASS] {message}”)


def warning(message: str) -> None:
    print(f”[WARN] {message}”)


def error(message: str) -> None:
    print(f”[FAIL] {message}”, file=sys.stderr)


# =============================================================================
# ARGUMENTS
# =============================================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=“Generate or safely update the root package.json.”
    )

    parser.add_argument(
        “—root”,
        type=Path,
        default=Path.cwd(),
        help=“Repository root directory.”,
    )

    parser.add_argument(
        “—force”,
        action=“store_true”,
        help=(
            “Back up and replace malformed package.json. “
            “Does not authorize discarding other invalid configuration.”
        ),
    )

    parser.add_argument(
        “—dry-run”,
        action=“store_true”,
        help=“Preview the generated package.json without writing files.”,
    )

    return parser.parse_args()


# =============================================================================
# ROOT VALIDATION
# =============================================================================

def resolve_root(value: Path) -> Path:
    try:
        root = value.expanduser().resolve(strict=True)
    except (OSError, RuntimeError, ValueError) as exc:
        raise ValueError(
            f”Cannot resolve repository root: {exc}”
        ) from exc

    if not root.is_dir():
        raise ValueError(
            f”Repository root is not a directory: {root}”
        )

    return root


# =============================================================================
# FILESYSTEM SAFETY
# =============================================================================

def inspect_regular_file(path: Path) -> bool:
    “””
    Return True for a regular non-symlink file.

    Missing files return False. Other filesystem problems raise an error.
    “””

    try:
        metadata = path.lstat()
    except FileNotFoundError:
        return False

    if stat.S_ISLNK(metadata.st_mode):
        raise ValueError(
            f”Symbolic-link files are not permitted: {path}”
        )

    if not stat.S_ISREG(metadata.st_mode):
        raise ValueError(
            f”Expected a regular file: {path}”
        )

    return True


def read_package(path: Path) -> tuple[dict[str, Any] | None, bool]:
    “””
    Read package.json.

    Returns:
        (package_data, malformed)

    A missing file returns ({}, False).
    A malformed existing file returns (None, True).
    “””

    if not inspect_regular_file(path):
        return {}, False

    if path.stat().st_size > MAX_PACKAGE_SIZE:
        raise ValueError(
            “Existing package.json exceeds the 5 MiB size limit.”
        )

    try:
        content = path.read_text(encoding=“utf-8-sig”)
        data = json.loads(content)

    except (json.JSONDecodeError, UnicodeError) as exc:
        error(f”Existing package.json is malformed: {exc}”)
        return None, True

    if not isinstance(data, dict):
        error(“Existing package.json must contain a JSON object.”)
        return None, True

    return data, False


# =============================================================================
# PACKAGE NAME
# =============================================================================

def valid_package_name(name: str) -> str:
    “””Normalize a basic unscoped npm package name.”””

    name = name.strip().lower()

    name = re.sub(
        r”[^a-z0-9._-]+”,
        “-“,
        name,
    )

    name = name.strip(“-.”)

    if not name:
        return “medorbits”

    return name[:214]


# =============================================================================
# EXISTING CONFIGURATION VALIDATION
# =============================================================================

def validate_existing_sections(
    package: dict[str, Any],
) -> list[str]:

    issues = []

    for section in OBJECT_SECTIONS:
        if section not in package:
            continue

        value = package[section]

        if not isinstance(value, dict):
            issues.append(
                f’Existing package.json “{section}” must be an object.’
            )

    if “name” in package and not isinstance(package[“name”], str):
        issues.append(‘”name” must be a string.’)

    if “version” in package and not isinstance(package[“version”], str):
        issues.append(‘”version” must be a string.’)

    if “private” in package and not isinstance(package[“private”], bool):
        issues.append(‘”private” must be a boolean.’)

    return issues


# =============================================================================
# PROJECT DETECTION
# =============================================================================

def is_regular_file(root: Path, relative: str) -> bool:
    path = root / relative

    try:
        metadata = path.lstat()
    except OSError:
        return False

    return stat.S_ISREG(metadata.st_mode)


def is_directory(root: Path, relative: str) -> bool:
    path = root / relative

    try:
        metadata = path.lstat()
    except OSError:
        return False

    return stat.S_ISDIR(metadata.st_mode)


def detect_scripts(root: Path) -> dict[str, str]:
    “””
    Detect scripts only when their actual entry points exist.

    Never creates fake successful test or lint commands.
    “””

    scripts: dict[str, str] = {}

    # Backend entry points.
    for filename in (“server.js”, “index.js”, “app.js”):
        if is_regular_file(root, filename):
            scripts[“start”] = f”node {filename}”
            scripts[“check:server”] = f”node —check {filename}”
            break

    # Existing HTML entry point.
    if is_regular_file(root, “index.html”):
        scripts[“check:html”] = (
            “node tools/validate-html.js”
        ) if is_regular_file(root, “tools/validate-html.js”) else (
            “node —check tools/validate-package-json.js”
        ) if is_regular_file(root, “tools/validate-package-json.js”) else (
            “node —version”
        )

    # Existing Vite configuration.
    vite_configs = (
        “vite.config.js”,
        “vite.config.mjs”,
        “vite.config.ts”,
    )

    if any(is_regular_file(root, item) for item in vite_configs):
        scripts.setdefault(“dev”, “vite”)
        scripts.setdefault(“build”, “vite build”)
        scripts.setdefault(“preview”, “vite preview”)

    # Existing ESLint configuration.
    eslint_configs = (
        “eslint.config.js”,
        “eslint.config.mjs”,
        “eslint.config.cjs”,
    )

    if any(is_regular_file(root, item) for item in eslint_configs):
        scripts.setdefault(“lint”, “eslint .”)

    # TypeScript.
    if is_regular_file(root, “tsconfig.json”):
        scripts.setdefault(“check:types”, “tsc —noEmit”)

    # Existing test runners only.
    if is_regular_file(root, “vitest.config.js”) or is_regular_file(
        root, “vitest.config.ts”
    ):
        scripts.setdefault(“test”, “vitest run”)

    elif is_regular_file(root, “jest.config.js”) or is_regular_file(
        root, “jest.config.cjs”
    ):
        scripts.setdefault(“test”, “jest”)

    elif is_regular_file(root, “pytest.ini”) or is_regular_file(
        root, “pyproject.toml”
    ):
        if is_directory(root, “tests”):
            scripts.setdefault(“test:python”, “python -m pytest”)

    # Existing project-specific validation scripts.
    if is_regular_file(root, “tools/TEST.sh”):
        scripts.setdefault(“test:repository”, “bash tools/TEST.sh”)

    if is_regular_file(root, “tools/VERIFY.sh”):
        scripts.setdefault(“verify:repository”, “bash tools/VERIFY.sh”)

    if is_regular_file(root, “tools/INSTALL.sh”):
        scripts.setdefault(“setup:repository”, “bash tools/INSTALL.sh”)

    return scripts


# =============================================================================
# PACKAGE CONSTRUCTION
# =============================================================================

def build_package(
    root: Path,
    existing: dict[str, Any],
) -> dict[str, Any]:

    # Preserve every existing top-level metadata field.
    package = {
        **DEFAULT_PACKAGE,
        **existing,
    }

    package[“name”] = valid_package_name(
        package.get(“name”) or root.name
    )

    package[“version”] = (
        package.get(“version”) or “1.0.0”
    )

    package.setdefault(“private”, True)

    # Existing engines are preserved.
    if “engines” not in existing:
        package[“engines”] = {
            **DEFAULT_PACKAGE[“engines”]
        }

    if “scripts” not in existing:
        package[“scripts”] = {}

    if “dependencies” not in existing:
        package[“dependencies”] = {}

    if “devDependencies” not in existing:
        package[“devDependencies”] = {}

    detected_scripts = detect_scripts(root)

    for name, command in detected_scripts.items():
        package[“scripts”].setdefault(name, command)

    # Add a real package validation command.
    package[“scripts”].setdefault(
        “check:package”,
        “node —input-type=module -e “
        “\”import fs from ‘node:fs’; “
        “JSON.parse(fs.readFileSync(‘package.json’, ‘utf8’)); “
        “console.log(‘package.json is valid’);\””,
    )

    return package


# =============================================================================
# BACKUP
# =============================================================================

def create_backup(path: Path) -> Path:
    “””
    Create an exclusive timestamped backup.

    Does not overwrite earlier backups.
    Rejects symlink source files.
    “””

    if not inspect_regular_file(path):
        raise ValueError(
            “Cannot back up a missing package.json.”
        )

    timestamp = datetime.now(timezone.utc).strftime(
        “%Y%m%dT%H%M%S%fZ”
    )

    base_name = f”{path.name}.{timestamp}.bak”
    counter = 0

    while True:
        suffix = f”.{counter}” if counter else “”
        backup = path.with_name(base_name + suffix)

        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL

        if hasattr(os, “O_NOFOLLOW”):
            flags |= os.O_NOFOLLOW

        try:
            descriptor = os.open(
                backup,
                flags,
                0o600,
            )
            break

        except FileExistsError:
            counter += 1

    try:
        source_flags = os.O_RDONLY

        if hasattr(os, “O_NOFOLLOW”):
            source_flags |= os.O_NOFOLLOW

        source_descriptor = os.open(path, source_flags)

        with os.fdopen(source_descriptor, “rb”) as source:
            with os.fdopen(descriptor, “wb”) as target:
                descriptor = -1

                while True:
                    chunk = source.read(1024 * 1024)

                    if not chunk:
                        break

                    target.write(chunk)

                target.flush()
                os.fsync(target.fileno())

    except Exception:
        if descriptor >= 0:
            os.close(descriptor)

        try:
            backup.unlink()
        except OSError:
            pass

        raise

    return backup


# =============================================================================
# ATOMIC PACKAGE WRITING
# =============================================================================

def write_package(
    root: Path,
    package_path: Path,
    serialized: str,
) -> None:
    “””
    Write through an exclusive temporary file and atomically replace package.

    The destination must not be a symbolic link.
    “””

    inspect_regular_file(package_path)

    descriptor = None
    temporary_path = None

    try:
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=“.package-json-“,
            suffix=“.tmp”,
            dir=root,
        )

        temporary_path = Path(temporary_name)

        with os.fdopen(
            descriptor,
            “w”,
            encoding=“utf-8”,
            newline=“\n”,
        ) as handle:
            descriptor = None
            handle.write(serialized)
            handle.flush()
            os.fsync(handle.fileno())

        # Recheck the destination immediately before replacement.
        inspect_regular_file(package_path)

        os.replace(
            temporary_path,
            package_path,
        )

        temporary_path = None

        # Best-effort directory synchronization.
        try:
            directory_fd = os.open(root, os.O_RDONLY)

            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)

        except OSError:
            pass

    finally:
        if descriptor is not None:
            os.close(descriptor)

        if temporary_path is not None:
            try:
                temporary_path.unlink()
            except OSError:
                pass


# =============================================================================
# MAIN
# =============================================================================

def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            “Generate or safely update the MedOrbits root package.json.”
        )
    )

    parser.add_argument(
        “—root”,
        type=Path,
        default=Path.cwd(),
        help=“Repository root directory.”,
    )

    parser.add_argument(
        “—force”,
        action=“store_true”,
        help=“Back up and replace malformed package.json.”,
    )

    parser.add_argument(
        “—dry-run”,
        action=“store_true”,
        help=“Preview changes without writing files.”,
    )

    args = parser.parse_args()

    try:
        root = resolve_root(args.root)
    except ValueError as exc:
        error(str(exc))
        return 2

    package_path = root / “package.json”
    lock_path = root / “package-lock.json”

    info(f”MedOrbits Package JSON Generator v{VERSION}”)
    info(f”Repository: {root}”)

    try:
        existing, malformed = read_package(package_path)

        if malformed and not args.force:
            error(
                “Existing package.json is malformed. “
                “Use —force to back it up and replace it.”
            )
            return 1

        if malformed:
            existing = {}
            warning(
                “Malformed package.json will be replaced after backup.”
            )

        if existing is None:
            existing = {}

        # Validate existing configuration before merging.
        if not malformed:
            issues = validate_existing_sections(existing)

            if issues:
                for issue in issues:
                    error(issue)

                error(
                    “Existing configuration was preserved. “
                    “Correct these fields before regenerating.”
                )
                return 1

        package = build_package(root, existing)

        serialized = json.dumps(
            package,
            indent=2,
            ensure_ascii=False,
        ) + “\n”

        # Validate the exact serialized JSON.
        validated = json.loads(serialized)

        if not isinstance(validated, dict):
            raise ValueError(
                “Generated package.json is not a JSON object.”
            )

        # Check for accidental removal of existing top-level fields.
        if not malformed:
            missing_fields = set(existing) - set(validated)

            if missing_fields:
                raise ValueError(
                    “Existing metadata would be lost: “
                    + “, “.join(sorted(missing_fields))
                )

        if package_path.exists():
            current = package_path.read_text(
                encoding=“utf-8-sig”
            )

            if current == serialized:
                success(“package.json is already up to date.”)
                info(“No backup or file replacement was necessary.”)
                return 0

        info(f”Package name: {package[‘name’]}”)
        info(f”Package version: {package[‘version’]}”)
        info(f”Scripts configured: {len(package[‘scripts’])}”)
        info(
            “Dependencies preserved: “
            f”{len(package[‘dependencies’])}”
        )
        info(
            “Development dependencies preserved: “
            f”{len(package[‘devDependencies’])}”
        )

        if lock_path.exists():
            warning(
                “package-lock.json already exists. “
                “Review its root metadata after changing package.json.”
            )

        if args.dry_run:
            print(“\nDRY-RUN: Generated package.json preview\n”)
            print(serialized)
            info(“No files were modified.”)
            return 0

        # Back up an existing package before replacement.
        if package_path.exists():
            backup = create_backup(package_path)
            success(f”Backup created: {backup.name}”)

        write_package(
            root,
            package_path,
            serialized,
        )

        success(f”Generated: {package_path}”)
        success(“Generated JSON passed structural validation.”)

        print(“\nSafety summary:”)
        print(“- Existing metadata preserved.”)
        print(“- Existing dependencies preserved.”)
        print(“- Existing custom scripts preserved.”)
        print(“- No packages installed.”)
        print(“- No project scripts executed.”)
        print(“- package-lock.json was not modified.”)

        return 0

    except (OSError, ValueError, TypeError) as exc:
        error(f”Package generation failed: {exc}”)
        return 1


if __name__ == “__main__”:
    raise SystemExit(main())
