
#!/usr/bin/env python3
"""
MedOrbits Central Repository Manager
Version: 1.0.0
Python: 3.10+

Central controller for:
- repository_connector.py
- duplicate_auditor.py
- repository_guard.py
- free_promotion.py
- Python utilities discovered throughout the repository

Safety:
- Default operation is audit-only.
- Does not edit, delete, merge, reset, or commit source files.
- Does not automatically execute unknown Python scripts.
- Runs known tools only through explicit, predefined commands.
- Captures tool output and generates a consolidated report.
- Never bypasses tests or security checks.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import subprocess
import sys
import time

from pathlib import Path


VERSION = "1.0.0"

EXCLUDED_DIRS = {
    ".git", ".svn", ".hg", ".idea", ".vscode",
    "node_modules", "vendor", "__pycache__", ".pytest_cache",
    ".mypy_cache", ".ruff_cache", ".next", ".nuxt",
    "dist", "build", "coverage", ".venv", "venv",
    "duplicate-quarantine", "repository-reports",
}

# Only these scripts are recognized as managed tools.
# Unknown Python files are inventoried, never automatically executed.
MANAGED_TOOLS = {
    "connector": {
        "path": "tools/repository_connector.py",
        "args": ["--root", ".", "--dry-run"],
        "description": "Read-only dependency and reference scan",
    },
    "duplicates": {
        "path": "tools/duplicate_auditor.py",
        "args": ["--root", "."],
        "description": "Read-only duplicate-file audit",
    },
    "guard": {
        "path": "tools/repository_guard.py",
        "args": ["--root", ".", "--all-files"],
        "description": "Repository security and bypass-pattern audit",
    },
    "promotion": {
        "path": "tools/free_promotion.py",
        "args": ["--root", "."],
        "description": "Local SEO audit and promotion-draft generation",
    },
}

MAX_SOURCE_BYTES = 5_000_000


def relative(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def excluded(path: Path, root: Path) -> bool:
    try:
        parts = path.relative_to(root).parts
    except ValueError:
        return True

    return any(part in EXCLUDED_DIRS for part in parts)


def discover_python_files(root: Path) -> list[Path]:
    found = []

    for current, dirs, filenames in os.walk(root, followlinks=False):
        dirs[:] = [
            name for name in dirs
            if name not in EXCLUDED_DIRS
            and not name.startswith(".")
        ]

        for filename in filenames:
            if not filename.endswith(".py"):
                continue

            path = Path(current) / filename

            if path.is_symlink() or excluded(path, root):
                continue

            found.append(path)

    return sorted(found, key=lambda p: relative(p, root).lower())


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)

    return digest.hexdigest()


def check_python_file(path: Path, root: Path) -> dict:
    item = {
        "path": relative(path, root),
        "syntax": "unknown",
        "sha256": "",
        "bytes": None,
        "error": None,
    }

    try:
        size = path.stat().st_size

        if size > MAX_SOURCE_BYTES:
            item["syntax"] = "skipped-too-large"
            item["bytes"] = size
            return item

        source_bytes = path.read_bytes()
        source = source_bytes.decode("utf-8-sig")

        item["bytes"] = size
        item["sha256"] = hashlib.sha256(source_bytes).hexdigest()

        # Compile in memory: does not create .pyc files.
        compile(source, str(path), "exec")
        ast.parse(source, filename=str(path))

        item["syntax"] = "valid"

    except SyntaxError as exc:
        item["syntax"] = "invalid"
        item["error"] = {
            "message": exc.msg,
            "line": exc.lineno,
            "column": exc.offset,
        }

    except (OSError, UnicodeDecodeError) as exc:
        item["syntax"] = "unreadable"
        item["error"] = str(exc)

    return item


def run_git(root: Path, *args: str) -> dict:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )

        return {
            "available": True,
            "returncode": result.returncode,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }

    except (OSError, subprocess.TimeoutExpired) as exc:
        return {
            "available": False,
            "returncode": None,
            "stdout": "",
            "stderr": str(exc),
        }


def git_status(root: Path) -> dict:
    result = run_git(root, "status", "--short", "--branch")

    if not result["available"] or result["returncode"] != 0:
        return {
            "available": False,
            "clean": None,
            "output": result["stderr"],
        }

    lines = result["stdout"].splitlines()

    # Branch header is not a changed file.
    changes = [
        line for line in lines
        if line and not line.startswith("## ")
    ]

    return {
        "available": True,
        "clean": len(changes) == 0,
        "changed_entries": len(changes),
        "output": result["stdout"],
    }


def conflict_markers(path: Path) -> list[dict]:
    try:
        text = path.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeDecodeError):
        return []

    markers = []

    for line_number, line in enumerate(text.splitlines(), 1):
        stripped = line.lstrip()

        if (
            stripped.startswith("<<<<<<< ")
            or stripped == "======="
            or stripped.startswith(">>>>>>> ")
        ):
            markers.append({
                "line": line_number,
                "marker": stripped[:100],
            })

    return markers


def inventory_tools(root: Path) -> dict:
    inventory = []
    missing = []

    for name, config in MANAGED_TOOLS.items():
        path = root / config["path"]

        inventory.append({
            "name": name,
            "path": config["path"],
            "exists": path.is_file(),
            "description": config["description"],
        })

        if not path.is_file():
            missing.append(config["path"])

    return {
        "managed": inventory,
        "missing_managed_tools": missing,
    }


def execute_tool(
    root: Path,
    name: str,
    timeout_seconds: int,
) -> dict:
    config = MANAGED_TOOLS[name]
    script = root / config["path"]

    result = {
        "name": name,
        "path": config["path"],
        "started": False,
        "returncode": None,
        "stdout": "",
        "stderr": "",
        "error": None,
    }

    if not script.is_file():
        result["error"] = "Managed script does not exist."
        return result

    # Check syntax before execution.
    syntax = check_python_file(script, root)

    if syntax["syntax"] != "valid":
        result["error"] = (
            "Script syntax is not valid; execution was refused."
        )
        result["syntax"] = syntax
        return result

    # Known scripts receive only predefined, safe arguments.
    # No arbitrary command strings or shell execution.
    command = [
        sys.executable,
        str(script),
        *config["args"],
    ]

    try:
        completed = subprocess.run(
            command,
            cwd=root,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
            shell=False,
        )

        result.update({
            "started": True,
            "returncode": completed.returncode,
            "stdout": completed.stdout[-20000:],
            "stderr": completed.stderr[-10000:],
        })

    except subprocess.TimeoutExpired:
        result["error"] = (
            f"Timed out after {timeout_seconds} seconds."
        )

    except OSError as exc:
        result["error"] = str(exc)

    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Manage MedOrbits repository utilities safely."
    )

    parser.add_argument(
        "--root",
        default=".",
        help="Repository root directory.",
    )

    parser.add_argument(
        "--run",
        choices=["connector", "duplicates", "guard", "promotion", "all"],
        help="Run a recognized tool with predefined safe arguments.",
    )

    parser.add_argument(
        "--timeout",
        type=int,
        default=120,
        help="Maximum seconds for each managed tool.",
    )

    parser.add_argument(
        "--include-hidden",
        action="store_true",
        help="Include hidden directories in the Python inventory.",
    )

    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()

    if not root.is_dir():
        print(f"ERROR: Repository root not found: {root}", file=sys.stderr)
        return 2

    if args.timeout < 1 or args.timeout > 1800:
        print("ERROR: Timeout must be between 1 and 1800 seconds.")
        return 2

    print("MedOrbits Central Repository Manager", VERSION)
    print(f"Repository: {root}")
    print("Source modifications by manager: NONE")
    print("Git mutations: NONE")
    print("Unknown scripts: NEVER AUTO-EXECUTED")

    files = discover_python_files(root)
    python_checks = [
        check_python_file(path, root)
        for path in files
    ]

    conflict_files = []

    # Check only source files already discovered. Avoid .git and
    # dependency folders; this is a diagnostic check, not a resolver.
    for path in files:
        markers = conflict_markers(path)

        if markers:
            conflict_files.append({
                "path": relative(path, root),
                "markers": markers,
            })

    registry = inventory_tools(root)
    status = git_status(root)

    results = []

    if args.run:
        selected = (
            list(MANAGED_TOOLS)
            if args.run == "all"
            else [args.run]
        )

        for name in selected:
            print(f"\nChecking managed tool: {name}")

            # Refuse execution when Git reports changes or conflicts.
            # A dirty repository may contain valuable uncommitted work.
            if status.get("available") and status.get("clean") is False:
                results.append({
                    "name": name,
                    "started": False,
                    "returncode": None,
                    "error": (
                        "Execution blocked because Git reports uncommitted "
                        "or untracked changes. Review and protect them first."
                    ),
                })
                continue

            if conflict_files:
                results.append({
                    "name": name,
                    "started": False,
                    "returncode": None,
                    "error": (
                        "Execution blocked because potential Python conflict "
                        "markers were detected."
                    ),
                })
                continue

            result = execute_tool(root, name, args.timeout)
            results.append(result)

            print(
                f"  Started: {result.get('started', False)}"
                f" | Exit code: {result.get('returncode')}"
            )

            if result.get("error"):
                print(f"  Note: {result['error']}")

    report_dir = root / "tools" / "repository-reports"
    report_path = report_dir / "repository-manager.json"

    report = {
        "tool": "MedOrbits Central Repository Manager",
        "version": VERSION,
        "created_at_epoch": int(time.time()),
        "repository_root": str(root),
        "read_only_inventory": True,
        "python_files_scanned": len(files),
        "python_syntax_summary": {
            "valid": sum(
                1 for item in python_checks
                if item["syntax"] == "valid"
            ),
            "invalid": sum(
                1 for item in python_checks
                if item["syntax"] == "invalid"
            ),
            "unreadable": sum(
                1 for item in python_checks
                if item["syntax"] == "unreadable"
            ),
            "skipped": sum(
                1 for item in python_checks
                if item["syntax"] == "skipped-too-large"
            ),
        },
        "python_files": python_checks,
        "conflict_marker_files": conflict_files,
        "git_status": status,
        "tool_registry": registry,
        "execution_results": results,
        "limitations": [
            "A clean Git status does not guarantee that a backup exists.",
            "Syntax validation does not prove runtime correctness.",
            "Unknown scripts are inventoried but never executed.",
            "Managed tools may write their own reports.",
            "The manager does not run application tests automatically.",
            "The manager does not repair Git conflicts.",
        ],
    }

    try:
        report_dir.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    except OSError as exc:
        print(f"ERROR: Could not write manager report: {exc}", file=sys.stderr)
        return 2

    print("\nMANAGER SUMMARY")
    print(f"Python files: {len(files)}")
    print(f"Valid Python files: {report['python_syntax_summary']['valid']}")
    print(f"Invalid Python files: {report['python_syntax_summary']['invalid']}")
    print(f"Conflict-marker files: {len(conflict_files)}")
    print(f"Git status available: {status['available']}")
    print(f"Managed tools missing: {len(registry['missing_managed_tools'])}")
    print(f"Report: {report_path.relative_to(root).as_posix()}")

    if conflict_files:
        print(
            "\nWARNING: Python conflict markers found. "
            "Resolve them manually after making a backup."
        )

    if report["python_syntax_summary"]["invalid"]:
        print(
            "\nWARNING: Invalid Python syntax detected. "
            "Review the report before running tools."
        )

    print("\nManager finished. Review the JSON report.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
