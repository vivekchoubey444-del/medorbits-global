
#!/usr/bin/env python3
"""Run lightweight, read-only security checks against repository filenames and configs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys

from repository_manager import (
    RepositoryError,
    iter_files,
    resolve_root,
)

VERSION = "1.0.0"

SECRET_PATTERNS = [
    ("possible-private-key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("possible-token-assignment", re.compile(
        r"(?i)\b(?:api[_-]?key|secret|access[_-]?token|password)\b"
        r"\s*[:=]\s*['\"][^'\"]{8,}['\"]"
    )),
]

TEXT_EXTENSIONS = {
    ".js", ".cjs", ".mjs", ".py", ".json", ".yml", ".yaml", ".toml",
    ".ini", ".cfg", ".md", ".txt", ".sh", ".html", ".css",
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--max-files", type=int, default=10000)
    parser.add_argument("--max-bytes", type=int, default=1_000_000)
    args = parser.parse_args()

    if not 1 <= args.max_files <= 100000:
        parser.error("--max-files must be between 1 and 100000")
    if not 1 <= args.max_bytes <= 5_000_000:
        parser.error("--max-bytes must be between 1 and 5000000")

    try:
        root = resolve_root(args.root)
        findings = []
        scanned = 0

        for path in iter_files(root):
            if scanned >= args.max_files:
                break
            if path.suffix.lower() not in TEXT_EXTENSIONS:
                continue

            scanned += 1
            try:
                if path.stat().st_size > args.max_bytes:
                    continue
                content = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue

            relative = path.relative_to(root).as_posix()
            for line_number, line in enumerate(content.splitlines(), 1):
                for rule, pattern in SECRET_PATTERNS:
                    if pattern.search(line):
                        findings.append({
                            "rule": rule,
                            "path": relative,
                            "line": line_number,
                            "message": "Potential secret-like value; inspect locally.",
                        })

        result = {
            "version": VERSION,
            "files_scanned": scanned,
            "finding_count": len(findings),
            "findings": findings,
            "note": "Heuristic scan only; findings require manual verification.",
        }

        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"Security audit {VERSION}")
            print(f"Files scanned: {scanned}")
            print(f"Potential findings: {len(findings)}")
            for item in findings:
                print(f"[{item['rule']}] {item['path']}:{item['line']}")

        return 1 if findings else 0

    except (RepositoryError, OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
