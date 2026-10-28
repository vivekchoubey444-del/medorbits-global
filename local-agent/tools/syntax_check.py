
#!/usr/bin/env python3
"""Check Python syntax and JSON files without executing project code."""

from __future__ import annotations

import argparse
import ast
import json
from pathlib import Path
import sys

from repository_manager import RepositoryError, iter_files, resolve_root

VERSION = "1.0.0"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--max-files", type=int, default=10000)
    args = parser.parse_args()

    if not 1 <= args.max_files <= 100000:
        parser.error("--max-files must be between 1 and 100000")

    try:
        root = resolve_root(args.root)
        checked = 0
        errors = []

        for path in iter_files(root):
            if checked >= args.max_files:
                break

            suffix = path.suffix.lower()
            if suffix not in {".py", ".json"}:
                continue

            checked += 1
            relative = path.relative_to(root).as_posix()

            try:
                source = path.read_text(encoding="utf-8")
                if suffix == ".py":
                    ast.parse(source, filename=relative)
                else:
                    json.loads(source)
            except (OSError, UnicodeError, SyntaxError, json.JSONDecodeError) as exc:
                errors.append(f"{relative}: {exc}")

        print(f"Syntax check {VERSION}: {checked} file(s) inspected.")
        for error in errors:
            print(f"ERROR: {error}")

        if not errors:
            print("No Python syntax or JSON parsing errors detected.")

        return 1 if errors else 0

    except (RepositoryError, OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
