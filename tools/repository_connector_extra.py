#!/usr/bin/env python3
"""
MedOrbits Repository Connector -- Extra Utilities
=================================================
Companion utilities for tools/repository_connector.py.
Features:
- Repository inventory and extension counts.
- Changed-file summaries.
- Safe inspection of a specific tracked file's metadata.
- Git diff statistics without exposing diff contents.
- JSON validation summary.
- Machine-readable output.
Safety:
- Never writes to repository files.
- Never executes arbitrary shell commands.
- Does not print file contents, environment variables, or secret values.
- Does not stage, commit, merge, reset, or push changes.
Examples:
    python tools/repository_connector_extra.py inventory
    python tools/repository_connector_extra.py changes
    python tools/repository_connector_extra.py inspect README.md
    python tools/repository_connector_extra.py diff-summary
    python tools/repository_connector_extra.py json-summary
    python tools/repository_connector_extra.py all
"""
from __future__ import annotations
import argparse
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Sequence
TOOL_NAME = "MedOrbits Repository Connector Extra"
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
MAX_JSON_BYTES = 10 * 1024 * 1024
class ConnectorExtraError(RuntimeError):
    """Raised when a safe repository operation cannot complete."""
def run_git(
    repo: Path,
    args: Sequence[str],
    *,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Run Git without a shell."""
    try:
        result = subprocess.run(
            ["git", "-C", str(repo), *args],
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
    except FileNotFoundError as exc:
        raise ConnectorExtraError(
            "Git is unavailable. Install Git and ensure it is on PATH."
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise ConnectorExtraError("Git command timed out.") from exc
    if check and result.returncode != 0:
        raise ConnectorExtraError(
            result.stderr.strip() or "Git command failed."
        )
    return result
def discover_repository(start: Path | None = None) -> Path:
    """Locate the Git repository root."""
    candidate = (start or Path.cwd()).expanduser().resolve()
    result = run_git(
        candidate,
        ["rev-parse", "--show-toplevel"],
        check=False,
    )
    if result.returncode != 0:
        raise ConnectorExtraError(
            f"No Git repository found at or above {candidate}"
        )
    return Path(result.stdout.strip()).resolve()
def git_paths(repo: Path, *args: str) -> list[str]:
    """Return paths from NUL-delimited Git output."""
    output = run_git(repo, list(args)).stdout
    return [item for item in output.split("\0") if item]
def tracked_paths(repo: Path) -> list[str]:
    return git_paths(repo, "ls-files", "-z")
def status_entries(repo: Path) -> list[str]:
    output = run_git(
        repo,
        ["status", "--porcelain=v1", "--untracked-files=all"],
    ).stdout
    return output.splitlines()
def inventory(repo: Path) -> dict[str, Any]:
    """Summarize tracked repository files without reading their contents."""
    files = tracked_paths(repo)
    extension_counts: Counter[str] = Counter()
    directory_counts: Counter[str] = Counter()
    excluded_count = 0
    symlink_count = 0
    missing_count = 0
    for filename in files:
        relative = Path(filename)
        if any(part in EXCLUDED_DIRS for part in relative.parts):
            excluded_count += 1
            continue
        source = repo / relative
        if source.is_symlink():
            symlink_count += 1
            continue
        if not source.is_file():
            missing_count += 1
            continue
        extension = relative.suffix.lower() or "[no extension]"
        extension_counts[extension] += 1
        parent = relative.parent.as_posix()
        directory_counts[parent if parent != "." else "/"] += 1
    return {
        "repository": str(repo),
        "tracked_file_count": len(files),
        "files_by_extension": dict(
            sorted(extension_counts.items(), key=lambda item: item[0])
        ),
        "files_by_directory": dict(
            sorted(directory_counts.items(), key=lambda item: item[0])
        ),
        "excluded_path_count": excluded_count,
        "tracked_symlink_count": symlink_count,
        "missing_tracked_file_count": missing_count,
    }
def changes(repo: Path) -> dict[str, Any]:
    """Summarize working-tree changes without exposing file contents."""
    entries = status_entries(repo)
    modified: list[str] = []
    added: list[str] = []
    deleted: list[str] = []
    untracked: list[str] = []
    renamed_or_copied: list[str] = []
    conflicted: list[str] = []
    other: list[str] = []
    for entry in entries:
        if len(entry) < 4:
            other.append(entry)
            continue
        code = entry[:2]
        filename = entry[3:]
        if code == "??":
            untracked.append(filename)
        elif "U" in code or code in {"AA", "DD"}:
            conflicted.append(filename)
        elif "R" in code or "C" in code:
            renamed_or_copied.append(filename)
        elif "D" in code:
            deleted.append(filename)
        elif "A" in code:
            added.append(filename)
        elif "M" in code:
            modified.append(filename)
        else:
            other.append(entry)
    return {
        "repository": str(repo),
        "total_status_entries": len(entries),
        "modified": modified,
        "added": added,
        "deleted": deleted,
        "untracked": untracked,
        "renamed_or_copied": renamed_or_copied,
        "conflicted": conflicted,
        "other": other,
    }
def inspect_file(repo: Path, supplied_path: str) -> dict[str, Any]:
    """Return metadata for a path tracked by Git, without reading its content."""
    candidate = Path(supplied_path)
    if candidate.is_absolute():
        raise ConnectorExtraError("Provide a repository-relative path.")
    if ".." in candidate.parts:
        raise ConnectorExtraError("Parent-directory traversal is not allowed.")
    relative = Path(candidate.as_posix())
    tracked = set(tracked_paths(repo))
    if relative.as_posix() not in tracked:
        raise ConnectorExtraError(
            "File is not tracked by Git. This command inspects tracked files only."
        )
    source = repo / relative
    # Resolve and verify containment, and reject symbolic links.
    try:
        resolved = source.resolve(strict=True)
        resolved.relative_to(repo)
    except (OSError, ValueError) as exc:
        raise ConnectorExtraError(
            "File does not exist or resolves outside the repository."
        ) from exc
    if source.is_symlink() or not resolved.is_file():
        raise ConnectorExtraError(
            "Only regular, non-symbolic-link files can be inspected."
        )
    stat = resolved.stat()
    return {
        "path": relative.as_posix(),
        "exists": True,
        "size_bytes": stat.st_size,
        "suffix": relative.suffix.lower(),
        "is_empty": stat.st_size == 0,
        "read_content": False,
    }
def diff_summary(repo: Path) -> dict[str, Any]:
    """Return diff statistics without returning the patch itself."""
    unstaged = run_git(
        repo,
        ["diff", "--stat", "--no-ext-diff", "--"],
    ).stdout.strip()
    staged = run_git(
        repo,
        ["diff", "--cached", "--stat", "--no-ext-diff", "--"],
    ).stdout.strip()
    unstaged_names = git_paths(
        repo,
        "diff",
        "--name-only",
        "-z",
        "--",
    )
    staged_names = git_paths(
        repo,
        "diff",
        "--cached",
        "--name-only",
        "-z",
        "--",
    )
    return {
        "unstaged_changed_files": unstaged_names,
        "staged_changed_files": staged_names,
        "unstaged_statistics": unstaged,
        "staged_statistics": staged,
        "patch_contents_included": False,
    }
def json_summary(repo: Path) -> dict[str, Any]:
    """Validate tracked JSON syntax and return a compact summary."""
    checked = 0
    errors: list[dict[str, Any]] = []
    for filename in tracked_paths(repo):
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
                        "error": "File exceeds the JSON validation size limit.",
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
        "files_validated": checked,
        "valid": not errors,
        "errors": errors,
    }
def collect_all(repo: Path) -> dict[str, Any]:
    return {
        "tool": TOOL_NAME,
        "repository": str(repo),
        "inventory": inventory(repo),
        "changes": changes(repo),
        "diff_summary": diff_summary(repo),
        "json_summary": json_summary(repo),
    }
def print_json(value: Any) -> None:
    print(json.dumps(value, indent=2, ensure_ascii=False))
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=TOOL_NAME,
    )
    parser.add_argument(
        "--repo",
        type=Path,
        help="Repository directory; defaults to the current directory.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("inventory", help="Summarize tracked files.")
    subparsers.add_parser("changes", help="Summarize working-tree changes.")
    subparsers.add_parser(
        "diff-summary",
        help="Show staged and unstaged diff statistics.",
    )
    subparsers.add_parser(
        "json-summary",
        help="Validate tracked JSON files.",
    )
    subparsers.add_parser("all", help="Run all supported summaries.")
    inspect_parser = subparsers.add_parser(
        "inspect",
        help="Inspect metadata for one tracked file.",
    )
    inspect_parser.add_argument("path", help="Repository-relative file path.")
    return parser
def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        repo = discover_repository(args.repo)
        if args.command == "inventory":
            result = inventory(repo)
        elif args.command == "changes":
            result = changes(repo)
        elif args.command == "diff-summary":
            result = diff_summary(repo)
        elif args.command == "json-summary":
            result = json_summary(repo)
        elif args.command == "inspect":
            result = inspect_file(repo, args.path)
        elif args.command == "all":
            result = collect_all(repo)
        else:
            parser.error("Unsupported command.")
            return 2
        print_json(result)
        if args.command == "json-summary" and not result["valid"]:
            return 1
        if args.command == "all":
            if not result["json_summary"]["valid"]:
                return 1
            if result["changes"]["conflicted"]:
                return 1
        if args.command == "changes" and result["conflicted"]:
            return 1
        return 0
    except (ConnectorExtraError, OSError, ValueError) as exc:
        print(f"{TOOL_NAME}: {exc}", file=sys.stderr)
        return 2
if __name__ == "__main__":
    raise SystemExit(main())