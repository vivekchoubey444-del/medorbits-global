
#!/usr/bin/env python3
"""Validate repository structure and report common configuration problems."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from repository_manager import EXCLUDED_DIRS, RepositoryError, resolve_root

VERSION = "1.0.0"

EXPECTED_FILES = (
    "package.json",
    "README.md",
)

EXPECTED_DIRS = (
    "local-agent",
    "local-agent/src",
    "local-agent/tools",
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    try:
        root = resolve_root(args.root)
    except (RepositoryError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    issues: list[dict[str, str]] = []

    for item in EXPECTED_FILES:
        if not (root / item).is_file():
            issues.append({
                "severity": "warning",
                "path": item,
                "message": "Expected file was not found.",
            })

    for item in EXPECTED_DIRS:
        if not (root / item).is_dir():
            issues.append({
                "severity": "warning",
                "path": item,
                "message": "Expected directory was not found.",
            })

    package_path = root / "package.json"
    if package_path.is_file():
        try:
            package = json.loads(package_path.read_text(encoding="utf-8"))
            if not isinstance(package, dict):
                raise ValueError("package.json must contain a JSON object.")

            engines = package.get("engines", {})
            if isinstance(engines, dict):
                node_version = str(engines.get("node", ""))
                if node_version and "20" not in node_version and "22" not in node_version:
                    issues.append({
                        "severity": "warning",
                        "path": "package.json",
                        "message": "Review the Node.js engine range for compatibility.",
                    })
        except (OSError, json.JSONDecodeError, ValueError) as exc:
            issues.append({
                "severity": "error",
                "path": "package.json",
                "message": f"Invalid package configuration: {exc}",
            })

    result = {
        "version": VERSION,
        "root": str(root),
        "issue_count": len(issues),
        "issues": issues,
    }

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"Repository validation {VERSION}")
        print(f"Root: {root}")
        if not issues:
            print("No structural issues detected.")
        for issue in issues:
            print(
                f"[{issue['severity'].upper()}] "
                f"{issue['path']}: {issue['message']}"
            )

    return 1 if any(i["severity"] == "error" for i in issues) else 0


if __name__ == "__main__":
    raise SystemExit(main())
