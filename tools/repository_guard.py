#!/usr/bin/env python3
"""
MedOrbits Repository Guard
==========================
Read-only repository safety checks.
Checks:
- Git working-tree state and unresolved index conflicts.
- Merge-conflict markers in tracked text files.
- Syntax validity of tracked JSON files.
- Common secret-like filenames already tracked by Git.
- Optional repository status report in JSON format.
Exit codes:
    0: Checks passed.
    1: One or more safety findings were detected.
    2: The guard could not complete.
Examples:
    python tools/repository_guard.py
    python tools/repository_guard.py --repo .
    python tools/repository_guard.py --skip-json
    python tools/repository_guard.py --report /tmp/medorbits-guard.json
This tool does not:
- Resolve conflicts.
- Delete or edit files.
- Stage or commit changes.
- Reset branches or change Git history.
- Print secret contents.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Sequence
APP_NAME = "MedOrbits Repository Guard"
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
SECRET_NAMES = {
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".npmrc",
    ".pypirc",
    "id_rsa",
    "id_ed25519",
    "credentials.json",
    "service-account.json",
}
SECRET_SUFFIXES = {
    ".pem",
    ".key",
    ".p12",
    ".pfx",
}
MAX_JSON_BYTES = 10 * 1024 * 1024
MAX_TEXT_BYTES = 2 * 1024 * 1024
class GuardError(RuntimeError):
    """Raised when a safety check cannot run."""
def git(
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
        )
    except FileNotFoundError as exc:
        raise GuardError("Git is not installed or unavailable on PATH.") from exc
    if check and result.returncode != 0:
        detail = result.stderr.strip() or "Git command failed."
        raise GuardError(detail)
    return result
def find_repo(path: Path | None) -> Path:
    """Resolve the repository root."""
    start = (path or Path.cwd()).expanduser().resolve()
    result = git(start, ["rev-parse", "--show-toplevel"], check=False)
    if result.returncode != 0:
        raise GuardError(
            f"{start} is not inside a Git repository. "
            "Pass --repo with a valid repository path."
        )
    return Path(result.stdout.strip()).resolve()
def nul_paths(repo: Path, *args: str) -> list[str]:
    """Read NUL-separated Git paths safely, including paths with spaces."""
    output = git(repo, list(args)).stdout
    return [item for item in output.split("\0") if item]
def tracked_files(repo: Path) -> list[str]:
    return nul_paths(repo, "ls-files", "-z")
def unresolved_conflicts(repo: Path) -> list[str]:
    return nul_paths(
        repo,
        "diff",
        "--name-only",
        "--diff-filter=U",
        "-z",
    )
def is_excluded(path: Path) -> bool:
    return any(part in EXCLUDED_DIRS for part in path.parts)
def is_secret_like(path: Path) -> bool:
    """Detect common sensitive filename patterns, not secret file contents."""
    name = path.name.lower()
    if name in SECRET_NAMES:
        return True
    if name.startswith(".env."):
        return True
    if path.suffix.lower() in SECRET_SUFFIXES:
        return True
    return False
def inspect_git_state(repo: Path) -> dict[str, Any]:
    branch_result = git(
        repo,
        ["symbolic-ref", "--short", "-q", "HEAD"],
        check=False,
    )
    head_result = git(repo, ["rev-parse", "--short", "HEAD"], check=False)
    status_result = git(
        repo,
        ["status", "--porcelain=v1", "--untracked-files=all"],
    )
    branch = (
        branch_result.stdout.strip()
        if branch_result.returncode == 0
        else "(detached HEAD or unborn branch)"
    )
    head = head_result.stdout.strip() if head_result.returncode == 0 else None
    entries = status_result.stdout.splitlines()
    conflicts = unresolved_conflicts(repo)
    return {
        "repository": str(repo),
        "branch": branch,
        "head": head,
        "working_tree_clean": len(entries) == 0,
        "changed_entry_count": len(entries),
        "unresolved_conflicts": conflicts,
        "status_entries": entries,
    }
def check_conflict_markers(repo: Path) -> list[str]:
    """Find likely merge markers in reasonably sized tracked UTF-8 text files."""
    findings: list[str] = []
    for filename in tracked_files(repo):
        relative = Path(filename)
        if is_excluded(relative):
            continue
        source = repo / relative
        # Do not follow symbolic links or inspect non-regular files.
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
                            f"{filename}:{number}: possible conflict marker"
                        )
        except (OSError, UnicodeError):
            # Binary or unreadable files are skipped; they are not modified.
            continue
    return findings
def check_json(repo: Path) -> tuple[int, list[str]]:
    """Validate syntax for tracked .json files, excluding oversized files."""
    count = 0
    findings: list[str] = []
    for filename in tracked_files(repo):
        relative = Path(filename)
        if relative.suffix.lower() != ".json" or is_excluded(relative):
            continue
        source = repo / relative
        if source.is_symlink() or not source.is_file():
            continue
        try:
            if source.stat().st_size > MAX_JSON_BYTES:
                findings.append(
                    f"{filename}: exceeds the {MAX_JSON_BYTES}-byte JSON check limit"
                )
                continue
            with source.open("r", encoding="utf-8") as handle:
                json.load(handle)
            count += 1
        except json.JSONDecodeError as exc:
            findings.append(
                f"{filename}:{exc.lineno}:{exc.colno}: invalid JSON: {exc.msg}"
            )
        except (OSError, UnicodeError) as exc:
            findings.append(f"{filename}: could not read JSON: {exc}")
    return count, findings
def check_tracked_secrets(repo: Path) -> list[str]:
    """
    Identify tracked files with common secret-like names.
    Filename checks cannot prove whether a file contains a secret. Review
    findings carefully and use a dedicated secret scanner for content scanning.
    """
    findings: list[str] = []
    for filename in tracked_files(repo):
        relative = Path(filename)
        if is_secret_like(relative):
            findings.append(
                f"{filename}: tracked filename resembles a secret/config credential"
            )
    return findings
def build_report(
    repo: Path,
    *,
    skip_json: bool,
) -> dict[str, Any]:
    state = inspect_git_state(repo)
    marker_findings = check_conflict_markers(repo)
    secret_findings = check_tracked_secrets(repo)
    if skip_json:
        json_count = 0
        json_findings: list[str] = []
    else:
        json_count, json_findings = check_json(repo)
    findings: list[dict[str, str]] = []
    for path in state["unresolved_conflicts"]:
        findings.append(
            {
                "severity": "error",
                "check": "git-conflict",
                "message": f"Unresolved Git index conflict: {path}",
            }
        )
    for message in marker_findings:
        findings.append(
            {
                "severity": "warning",
                "check": "conflict-marker",
                "message": message,
            }
        )
    for message in secret_findings:
        findings.append(
            {
                "severity": "warning",
                "check": "tracked-secret-name",
                "message": message,
            }
        )
    for message in json_findings:
        findings.append(
            {
                "severity": "error",
                "check": "json",
                "message": message,
            }
        )
    return {
        "tool": APP_NAME,
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        **state,
        "checks": {
            "conflict_marker_findings": len(marker_findings),
            "tracked_secret_like_names": len(secret_findings),
            "json_files_validated": json_count,
            "json_check_skipped": skip_json,
        },
        "findings": findings,
        "passed": not any(
            item["severity"] == "error" for item in findings
        ),
    }
def print_report(report: dict[str, Any]) -> None:
    print(f"{APP_NAME}")
    print(f"Repository: {report['repository']}")
    print(f"Branch: {report['branch']}")
    print(f"HEAD: {report['head'] or '(no commit yet)'}")
    print(f"Working tree clean: {report['working_tree_clean']}")
    print(f"Changed entries: {report['changed_entry_count']}")
    print(f"Unresolved Git conflicts: {len(report['unresolved_conflicts'])}")
    print(f"JSON files validated: {report['checks']['json_files_validated']}")
    print(
        "Possible conflict markers: "
        f"{report['checks']['conflict_marker_findings']}"
    )
    print(
        "Tracked secret-like filenames: "
        f"{report['checks']['tracked_secret_like_names']}"
    )
    if report["findings"]:
        print("\nFindings:")
        for finding in report["findings"]:
            print(
                f"- [{finding['severity'].upper()}] "
                f"{finding['check']}: {finding['message']}"
            )
    else:
        print("\nNo findings detected by the enabled checks.")
    print(
        "\nNote: conflict-marker detection is heuristic. "
        "Review documentation and test fixtures before changing anything."
    )
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=APP_NAME,
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python tools/repository_guard.py\n"
            "  python tools/repository_guard.py --repo .\n"
            "  python tools/repository_guard.py --skip-json\n"
            "  python tools/repository_guard.py --report /tmp/guard-report.json"
        ),
    )
    parser.add_argument(
        "--repo",
        type=Path,
        help="Repository path; defaults to the current directory.",
    )
    parser.add_argument(
        "--skip-json",
        action="store_true",
        help="Skip JSON syntax checks.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Write a new JSON report outside the repository.",
    )
    return parser.parse_args()
def main() -> int:
    args = parse_args()
    try:
        repo = find_repo(args.repo)
        report = build_report(repo, skip_json=args.skip_json)
        print_report(report)
        if args.report:
            output = args.report.expanduser().resolve()
            if output == repo or repo in output.parents:
                raise GuardError(
                    "Report must be written outside the repository."
                )
            output.parent.mkdir(parents=True, exist_ok=True)
            # Exclusive creation prevents accidental overwrite of an existing
            # report. Remove or rename it manually if you need a fresh report.
            with output.open("x", encoding="utf-8") as handle:
                json.dump(report, handle, indent=2, ensure_ascii=False)
                handle.write("\n")
            print(f"\nJSON report saved: {output}")
        return 0 if report["passed"] else 1
    except (GuardError, OSError, ValueError) as exc:
        print(f"Repository Guard error: {exc}", file=sys.stderr)
        return 2
if __name__ == "__main__":
    raise SystemExit(main())