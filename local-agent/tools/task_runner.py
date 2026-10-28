
#!/usr/bin/env python3
"""Run a small allowlisted set of repository checks; never runs task text as a shell command."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
import sys
from typing import Sequence

from repository_manager import RepositoryError, resolve_root

VERSION = "1.0.0"

ALLOWED_TASKS = {
    "validate": ["local-agent/tools/validate_repository.py"],
    "catalog": ["local-agent/tools/file_catalog.py"],
    "security": ["local-agent/tools/security_audit.py"],
    "syntax": ["local-agent/tools/syntax_check.py"],
}


def run_task(root: Path, task: str) -> dict[str, object]:
    if task not in ALLOWED_TASKS:
        raise RepositoryError(f"Task is not allowlisted: {task}")

    script = root / ALLOWED_TASKS[task][0]
    if not script.is_file():
        raise RepositoryError(f"Required script not found: {script.relative_to(root)}")

    result = subprocess.run(
        [sys.executable, str(script), str(root)],
        cwd=str(root),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=120,
        check=False,
        shell=False,
    )

    return {
        "task": task,
        "returncode": result.returncode,
        "stdout": result.stdout[-12000:],
        "stderr": result.stderr[-6000:],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--tasks", nargs="+",
                        choices=sorted(ALLOWED_TASKS),
                        default=["validate", "syntax", "security"])
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    try:
        root = resolve_root(args.root)
        results = []
        for task in args.tasks:
            try:
                results.append(run_task(root, task))
            except (RepositoryError, OSError, subprocess.TimeoutExpired) as exc:
                results.append({
                    "task": task,
                    "returncode": 2,
                    "stdout": "",
                    "stderr": str(exc),
                })

        if args.json:
            print(json.dumps(results, indent=2))
        else:
            for result in results:
                print(f"\n=== {result['task']} (exit {result['returncode']}) ===")
                print(result["stdout"])
                if result["stderr"]:
                    print(result["stderr"], file=sys.stderr)

        return 1 if any(result["returncode"] != 0 for result in results) else 0

    except (RepositoryError, OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
