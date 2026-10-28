
#!/usr/bin/env python3
"""Safe repository inspection and optional, explicitly enabled file writes."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
from typing import Any

VERSION = "1.0.0"

EXCLUDED_DIRS = {
    ".git", ".hg", ".svn", "node_modules", "vendor", "__pycache__",
    ".venv", "venv", "dist", "build", "coverage", ".next",
}

SENSITIVE_NAMES = {
    ".env", ".env.local", ".env.production", "id_rsa", "id_ed25519",
    "credentials.json", "secrets.json",
}


class RepositoryError(RuntimeError):
    """Raised when a repository operation is unsafe or invalid."""


def resolve_root(value: str | Path) -> Path:
    root = Path(value).expanduser().resolve(strict=True)
    if not root.is_dir():
        raise RepositoryError(f"Repository root is not a directory: {root}")
    return root


def resolve_inside_root(root: Path, relative: str | Path) -> Path:
    """Resolve a relative path and reject traversal and symlink escapes."""
    raw = Path(relative)

    if raw.is_absolute():
        raise RepositoryError("Absolute paths are not accepted.")

    if any(part == ".." for part in raw.parts):
        raise RepositoryError("Parent-directory traversal is not accepted.")

    candidate = root / raw
    resolved = candidate.resolve(strict=False)

    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise RepositoryError("Path escapes the repository root.") from exc

    # Reject symlinks in any existing component of the requested path.
    current = root
    for part in raw.parts:
        current = current / part
        if current.is_symlink():
            raise RepositoryError("Symbolic-link paths are not accepted.")

    return resolved


def is_sensitive(path: Path) -> bool:
    name = path.name.lower()
    return (
        name in SENSITIVE_NAMES
        or name.startswith(".env.")
        or name.endswith((".pem", ".key", ".p12", ".pfx"))
    )


def iter_files(root: Path):
    """Yield repository files without descending into excluded directories."""
    for current, dirs, files in os.walk(root, followlinks=False):
        base = Path(current)
        dirs[:] = sorted(
            name for name in dirs
            if name not in EXCLUDED_DIRS
            and not (base / name).is_symlink()
        )

        for name in sorted(files):
            path = base / name
            if path.is_symlink() or not path.is_file():
                continue
            yield path


def build_catalog(root: Path, max_files: int = 10000) -> dict[str, Any]:
    entries = []
    for path in iter_files(root):
        if len(entries) >= max_files:
            break

        try:
            stat = path.stat()
            relative = path.relative_to(root).as_posix()
        except OSError:
            continue

        entries.append({
            "path": relative,
            "size_bytes": stat.st_size,
            "extension": path.suffix.lower(),
            "sensitive_name": is_sensitive(path),
        })

    return {
        "version": VERSION,
        "root": str(root),
        "file_count": len(entries),
        "files": entries,
    }


def write_report(root: Path, relative: str, data: dict[str, Any]) -> Path:
    """Write JSON only when called explicitly; refuse sensitive destinations."""
    target = resolve_inside_root(root, relative)

    if is_sensitive(target):
        raise RepositoryError("Refusing to write to a sensitive destination.")

    if target.exists() and not target.is_file():
        raise RepositoryError("Report destination is not a regular file.")

    target.parent.mkdir(parents=True, exist_ok=True)

    # Re-check after directory creation.
    target = resolve_inside_root(root, relative)
    temporary = target.with_name(target.name + ".tmp")

    try:
        with temporary.open("x", encoding="utf-8") as stream:
            json.dump(data, stream, indent=2, ensure_ascii=False)
            stream.write("\n")
        os.replace(temporary, target)
    finally:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass

    return target


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--catalog", action="store_true",
                        help="Print a JSON file catalog.")
    parser.add_argument("--output",
                        help="Write a catalog JSON file inside the repository.")
    parser.add_argument("--max-files", type=int, default=10000)
    args = parser.parse_args()

    if not 1 <= args.max_files <= 100000:
        parser.error("--max-files must be between 1 and 100000")

    try:
        root = resolve_root(args.root)
        catalog = build_catalog(root, args.max_files)

        if args.output:
            destination = write_report(root, args.output, catalog)
            print(f"Catalog written: {destination.relative_to(root)}")
        elif args.catalog:
            print(json.dumps(catalog, indent=2, ensure_ascii=False))
        else:
            print(f"Repository: {root}")
            print(f"Files inspected: {catalog['file_count']}")
            print("No files were modified.")

        return 0
    except (RepositoryError, OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
