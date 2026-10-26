#!/usr/bin/env python3
"""
MedOrbits Repository Connector
==============================
A local, read-only bridge between repository automation scripts and Git.
Features:
- Discover the repository root.
- Retrieve Git status, branch, and current commit.
- List tracked, untracked, and unresolved-conflict paths.
- Validate tracked JSON files.
- Check tracked text files for likely merge-conflict markers.
- Return results as JSON for other Python tools.
Security:
- No arbitrary shell execution.
- No subprocess shell=True.
- No commits, merges, resets, pushes, or deletions.
- Does not read or return file contents except while validating JSON
  or scanning for conflict markers.
- Does not print secret values.
- All repository paths are resolved and checked.
Usage:
    python tools/repository_connector.py status
    python tools/repository_connector.py files --kind untracked
    python tools/repository_connector.py conflicts
    python tools/repository_connector.py validate-json
    python tools/repository_connector.py check-markers
    python tools/repository_connector.py all
"""
from __future__ import annotations
import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Sequence
TOOL_NAME = "MedOrbits Repository Connector"
EXCLUDED_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    ".next",
    "dist",
    "build",
    "coverage",
}
CONFLICT_MARKERS = (
    "<<<<<<< ",
    "=======",
    ">>>>>>> ",
)
MAX_JSON_BYTES = 10 * 1024 * 1024
MAX_TEXT_BYTES = 2 * 1024 * 1024
class ConnectorError(RuntimeError):
    """Raised when a connector operation cannot be completed safely."""
def run_git(
    repo: Path,
    args: Sequence[str],
) -> subprocess.CompletedProcess[str]:
    """Execute a fixed Git operation without invoking a shell."""
    try:
        result = subprocess.run(
            ["git", "-C", str(repo), *args],
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
    except FileNotFoundError as exc:
        raise ConnectorError(
            "Git was not found. Install Git and ensure it is on PATH."
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise ConnectorError("Git command timed out.") from exc
    if result.returncode != 0:
        detail = result.stderr.strip() or "Git command failed."
        raise ConnectorError(detail)
    return result
def discover_repository(start: Path | None = None) -> Path:
    """Resolve the Git root from a supplied directory or current directory."""
    candidate = (start or Path.cwd()).expanduser().resolve()
    result = subprocess.run(
        ["git", "-C", str(candidate), "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    if result.returncode != 0:
        raise ConnectorError(
            f"No Git repository found at or above: {candidate}"
        )
    return Path(result.stdout.strip()).resolve()
def get_paths(repo: Path, *args: str) -> list[str]:
    """Read NUL-separated Git path output."""
    output = run_git(repo, list(args)).stdout
    return [path for path in output.split("\0") if path]
def tracked_files(repo: Path) -> list[str]:
    return get_paths(repo, "ls-files", "-z")
def get_git_status(repo: Path) -> dict[str, Any]:
    branch_result = subprocess.run(
        [
            "git",
            "-C",
            str(repo),
            "symbolic-ref",
            "--short",
            "-q",
            "HEAD",
        ],
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    commit_result = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "--short", "HEAD"],
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    status = run_git(
        repo,
        ["status", "--porcelain=v1", "--untracked-files=all"],
    )
    conflicts = get_paths(
        repo,
        "diff",
        "--name-only",
        "--diff-filter=U",
        "-z",
    )
    return {
        "repository": str(repo),
        "branch": (
            branch_result.stdout.strip()
            if branch_result.returncode == 0
            else None
        ),
        "head": (
            commit_result.stdout.strip()
            if commit_result.returncode == 0
            else None
        ),
        "working_tree_clean": not status.stdout.splitlines(),
        "status_entries": status.stdout.splitlines(),
        "unresolved_conflicts": conflicts,
    }
def list_files(repo: Path, kind: str) -> list[str]:
    if kind == "tracked":
        return tracked_files(repo)
    if kind == "untracked":
        return get_paths(
            repo,
            "ls-files",
            "--others",
            "--exclude-standard",
            "-z",
        )
    if kind == "ignored":
        return get_paths(
            repo,
            "ls-files",
            "--others",
            "--ignored",
            "--exclude-standard",
            "-z",
        )
    raise ConnectorError(f"Unsupported file-list kind: {kind}")
def validate_json_files(repo: Path) -> dict[str, Any]:
    checked = 0
    errors: list[dict[str, Any]] = []
    for filename in tracked_files(repo):
        relative = Path(filename)
        if relative.suffix.lower() != ".json":
            continue
        if any(part in EXCLUDED_DIRS for part in relative.parts):
            continue
        source = repo / relative
        if source.is_symlink() or not source.is_file():
            continue
        try:
            if source.stat().st_size > MAX_JSON_BYTES:
                errors.append(
                    {
                        "file": filename,
                        "error": "File exceeds JSON validation size limit.",
                    }
                )
                continue
            with source.open("r", encoding="utf-8") as handle:
                json.load(handle)
            checked += 1
        except json.JSONDecodeError as exc:
            errors.append(
                {
                    "file": filename,
                    "line": exc.lineno,
                    "column": exc.colno,
                    "error": exc.msg,
                }
            )
        except (OSError, UnicodeError) as exc:
            errors.append(
                {
                    "file": filename,
                    "error": str(exc),
                }
            )
    return {
        "checked": checked,
        "valid": not errors,
        "errors": errors,
    }
def check_conflict_markers(repo: Path) -> dict[str, Any]:
    findings: list[dict[str, Any]] = []
    checked = 0
    for filename in tracked_files(repo):
        relative = Path(filename)
        if any(part in EXCLUDED_DIRS for part in relative.parts):
            continue
        source = repo / relative
        if source.is_symlink() or not source.is_file():
            continue
        try:
            if source.stat().st_size > MAX_TEXT_BYTES:
                continue
            with source.open("r", encoding="utf-8", errors="strict") as handle:
                for number, line in enumerate(handle, start=1):
                    candidate = line.lstrip()
                    if any(
                        candidate.startswith(marker)
                        for marker in CONFLICT_MARKERS
                    ):
                        findings.append(
                            {
                                "file": filename,
                                "line": number,
                                "message": "Possible merge-conflict marker.",
                            }
                        )
            checked += 1
        except (OSError, UnicodeError):
            # Skip binary, unreadable, or non-UTF-8 files.
            continue
    return {
        "checked": checked,
        "clean": not findings,
        "findings": findings,
    }
def collect_all(repo: Path) -> dict[str, Any]:
    """Collect the supported checks into one JSON-serializable result."""
    return {
        "tool": TOOL_NAME,
        "repository": str(repo),
        "git": get_git_status(repo),
        "files": {
            "tracked_count": len(list_files(repo, "tracked")),
            "untracked_count": len(list_files(repo, "untracked")),
        },
        "json_validation": validate_json_files(repo),
        "conflict_marker_check": check_conflict_markers(repo),
    }
def output_json(data: Any) -> None:
    print(json.dumps(data, indent=2, ensure_ascii=False))
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=TOOL_NAME,
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=None,
        help="Repository directory; defaults to the current directory.",
    )
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("status", help="Get Git status.")
    commands.add_parser("conflicts", help="List unresolved Git conflicts.")
    commands.add_parser("validate-json", help="Validate tracked JSON files.")
    commands.add_parser("check-markers", help="Find likely conflict markers.")
    commands.add_parser("all", help="Run all supported checks.")
    files_command = commands.add_parser("files", help="List repository files.")
    files_command.add_argument(
        "--kind",
        choices=("tracked", "untracked", "ignored"),
        default="untracked",
    )
    return parser
def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        repo = discover_repository(args.repo)
        if args.command == "status":
            result = get_git_status(repo)
            output_json(result)
            return 1 if result["unresolved_conflicts"] else 0
        if args.command == "conflicts":
            conflicts = get_paths(
                repo,
                "diff",
                "--name-only",
                "--diff-filter=U",
                "-z",
            )
            output_json({"unresolved_conflicts": conflicts})
            return 1 if conflicts else 0
        if args.command == "files":
            output_json(
                {
                    "kind": args.kind,
                    "files": list_files(repo, args.kind),
                }
            )
            return 0
        if args.command == "validate-json":
            result = validate_json_files(repo)
            output_json(result)
            return 0 if result["valid"] else 1
        if args.command == "check-markers":
            result = check_conflict_markers(repo)
            output_json(result)
            return 0 if result["clean"] else 1
        if args.command == "all":
            result = collect_all(repo)
            output_json(result)
            has_conflicts = bool(result["git"]["unresolved_conflicts"])
            json_valid = result["json_validation"]["valid"]
            markers_clean = result["conflict_marker_check"]["clean"]
            return 1 if has_conflicts or not json_valid or not markers_clean else 0
        parser.error("Unsupported command.")
        return 2
    except (ConnectorError, OSError, ValueError) as exc:
        print(f"{TOOL_NAME}: {exc}", file=sys.stderr)
        return 2
if __name__ == "__main__":
    raise SystemExit(main())