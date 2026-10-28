
#!/usr/bin/env python3
"""Generate a JSON catalog of repository files without reading file contents."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from repository_manager import (
    RepositoryError,
    build_catalog,
    resolve_root,
    write_report,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--output", default="repository-catalog.json")
    parser.add_argument("--max-files", type=int, default=10000)
    args = parser.parse_args()

    if not 1 <= args.max_files <= 100000:
        parser.error("--max-files must be between 1 and 100000")

    try:
        root = resolve_root(args.root)
        catalog = build_catalog(root, args.max_files)
        output = write_report(root, args.output, catalog)
        print(f"Catalog created: {output.relative_to(root)}")
        print(f"Files catalogued: {catalog['file_count']}")
        return 0
    except (RepositoryError, OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
