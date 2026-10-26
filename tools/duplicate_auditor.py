#!/usr/bin/env python3
"""
MedOrbits Duplicate Auditor
===========================
Read-only duplicate detection for a Git repository.
Features:
- Detect byte-identical files using SHA-256.
- Identify repeated filenames in different directories.
- Optionally detect likely duplicate source files using normalized text.
- Exclude common generated and dependency directories.
- Export findings to JSON.
- Never delete, rename, or modify audited files.
Examples:
    python tools/duplicate_auditor.py
    python tools/duplicate_auditor.py --repo .
    python tools/duplicate_auditor.py --include-untracked
    python tools/duplicate_auditor.py --normalized-source
    python tools/duplicate_auditor.py --output reports/duplicate-audit.json
Exit codes:
    0: Audit completed; no duplicates detected.
    1: Audit completed; duplicate candidates detected.
    2: Audit could not complete.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
TOOL_NAME = "MedOrbits Duplicate Auditor"
DEFAULT_EXCLUDED_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    ".next",
    "dist",
    "build",
    "coverage",
    ".cache",
}
SOURCE_EXTENSIONS = {
    ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
    ".html", ".css", ".scss", ".json", ".yml", ".yaml",
    ".sh", ".sql", ".md",
}
CHUNK_SIZE = 1024 * 1024
MAX_NORMALIZED_SOURCE_BYTES = 2 * 1024 * 1024
class AuditError(RuntimeError):
    """Raised when the audit cannot safely proceed."""
def discover_repository(start: Path | None = None) -> Path:
    """Find the Git root without changing repository state."""
    import subprocess
    candidate = (start or Path.cwd()).expanduser().resolve()
    try:
        result = subprocess.run(
            ["git", "-C", str(candidate), "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
    except FileNotFoundError as exc:
        raise AuditError("Git is not installed or unavailable on PATH.") from exc
    if result.returncode != 0:
        raise AuditError(
            f"No Git repository found at or above {candidate}. "
            "Use --repo to specify a repository."
        )
    return Path(result.stdout.strip()).resolve()
def git_file_paths(repo: Path, include_untracked: bool) -> list[str]:
    """Get tracked paths, optionally including non-ignored untracked paths."""
    import subprocess
    args = ["git", "-C", str(repo), "ls-files", "-z"]
    if include_untracked:
        args = [
            "git", "-C", str(repo),
            "ls-files", "-z", "--cached", "--others", "--exclude-standard",
        ]
    result = subprocess.run(
        args,
        capture_output=True,
        check=False,
        timeout=60,
    )
    if result.returncode != 0:
        message = result.stderr.decode("utf-8", errors="replace").strip()
        raise AuditError(message or "Could not list repository files.")
    paths = result.stdout.split(b"\0")
    decoded = [
        item.decode("utf-8", errors="surrogateescape")
        for item in paths
        if item
    ]
    # Deduplicate while preserving order.
    return list(dict.fromkeys(decoded))
def is_excluded(relative: Path, excluded_dirs: set[str]) -> bool:
    return any(part in excluded_dirs for part in relative.parts)
def iter_audit_files(
    repo: Path,
    paths: Iterable[str],
    excluded_dirs: set[str],
) -> Iterable[tuple[str, Path]]:
    """Yield safe regular files contained in the repository."""
    for filename in paths:
        relative = Path(filename)
        if relative.is_absolute() or ".." in relative.parts:
            continue
        if is_excluded(relative, excluded_dirs):
            continue
        candidate = repo / relative
        # Never follow symlinks or inspect files outside the repository.
        if candidate.is_symlink() or not candidate.is_file():
            continue
        try:
            resolved = candidate.resolve(strict=True)
            resolved.relative_to(repo)
        except (OSError, ValueError):
            continue
        yield relative.as_posix(), resolved
def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(CHUNK_SIZE)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()
def normalize_source(path: Path) -> str | None:
    """
    Return whitespace-normalized UTF-8 text for approximate duplicate checks.
    This is a heuristic, not an AST comparison. It does not remove comments
    or guarantee semantic equivalence.
    """
    try:
        if path.stat().st_size > MAX_NORMALIZED_SOURCE_BYTES:
            return None
        content = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return None
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    return "\n".join(lines)
def group_by_key(
    records: list[dict[str, Any]],
    key_name: str,
) -> list[dict[str, Any]]:
    groups: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        groups[record[key_name]].append(record)
    return [
        {
            "count": len(items),
            "files": [item["path"] for item in items],
            key_name: key,
        }
        for key, items in sorted(
            groups.items(),
            key=lambda item: str(item[0]),
        )
        if len(items) > 1
    ]
def audit(
    repo: Path,
    *,
    include_untracked: bool,
    normalized_source: bool,
    extra_excluded_dirs: set[str],
) -> dict[str, Any]:
    excluded_dirs = DEFAULT_EXCLUDED_DIRS | extra_excluded_dirs
    paths = git_file_paths(repo, include_untracked)
    file_records: list[dict[str, Any]] = []
    hash_groups: dict[str, list[str]] = defaultdict(list)
    name_groups: dict[str, list[str]] = defaultdict(list)
    normalized_groups: dict[str, list[str]] = defaultdict(list)
    unreadable_files: list[dict[str, str]] = []
    scanned_bytes = 0
    for relative_name, absolute_path in iter_audit_files(
        repo,
        paths,
        excluded_dirs,
    ):
        try:
            size = absolute_path.stat().st_size
            digest = sha256_file(absolute_path)
        except OSError as exc:
            unreadable_files.append(
                {"path": relative_name, "error": str(exc)}
            )
            continue
        record = {
            "path": relative_name,
            "size_bytes": size,
            "sha256": digest,
        }
        file_records.append(record)
        hash_groups[digest].append(relative_name)
        name_groups[Path(relative_name).name.lower()].append(relative_name)
        scanned_bytes += size
        if normalized_source and Path(relative_name).suffix.lower() in SOURCE_EXTENSIONS:
            normalized = normalize_source(absolute_path)
            if normalized:
                normalized_digest = hashlib.sha256(
                    normalized.encode("utf-8")
                ).hexdigest()
                normalized_groups[normalized_digest].append(relative_name)
    identical_groups = [
        {
            "sha256": digest,
            "count": len(files),
            "files": sorted(files),
            "size_bytes": next(
                record["size_bytes"]
                for record in file_records
                if record["path"] == files[0]
            ),
        }
        for digest, files in sorted(hash_groups.items())
        if len(files) > 1
    ]
    repeated_name_groups = [
        {
            "filename": name,
            "count": len(files),
            "files": sorted(files),
        }
        for name, files in sorted(name_groups.items())
        if len(files) > 1
    ]
    normalized_groups_output = [
        {
            "normalized_sha256": digest,
            "count": len(files),
            "files": sorted(files),
            "warning": (
                "Whitespace-normalized match only; review manually before "
                "concluding that files are interchangeable."
            ),
        }
        for digest, files in sorted(normalized_groups.items())
        if len(files) > 1
    ]
    return {
        "tool": TOOL_NAME,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repository": str(repo),
        "mode": {
            "include_untracked": include_untracked,
            "normalized_source": normalized_source,
            "excluded_directories": sorted(excluded_dirs),
        },
        "summary": {
            "files_scanned": len(file_records),
            "total_bytes_scanned": scanned_bytes,
            "identical_content_groups": len(identical_groups),
            "repeated_filename_groups": len(repeated_name_groups),
            "normalized_source_groups": len(normalized_groups_output),
            "unreadable_files": len(unreadable_files),
        },
        "identical_content": identical_groups,
        "repeated_filenames": repeated_name_groups,
        "normalized_source_candidates": normalized_groups_output,
        "unreadable_files": unreadable_files,
        "modifies_repository": False,
        "automatic_deletion_enabled": False,
    }
def print_summary(report: dict[str, Any]) -> None:
    summary = report["summary"]
    print(TOOL_NAME)
    print(f"Repository: {report['repository']}")
    print(f"Files scanned: {summary['files_scanned']}")
    print(f"Bytes scanned: {summary['total_bytes_scanned']}")
    print(f"Identical-content groups: {summary['identical_content_groups']}")
    print(f"Repeated-filename groups: {summary['repeated_filename_groups']}")
    print(f"Normalized-source groups: {summary['normalized_source_groups']}")
    print(f"Unreadable files: {summary['unreadable_files']}")
    if report["identical_content"]:
        print("\nByte-identical files:")
        for group in report["identical_content"]:
            print(f"  SHA-256: {group['sha256']}")
            for filename in group["files"]:
                print(f"    - {filename}")
    if report["repeated_filenames"]:
        print("\nRepeated filenames (not necessarily duplicates):")
        for group in report["repeated_filenames"]:
            print(f"  {group['filename']}")
            for filename in group["files"]:
                print(f"    - {filename}")
    if report["normalized_source_candidates"]:
        print("\nPossible normalized-source duplicates:")
        for group in report["normalized_source_candidates"]:
            for filename in group["files"]:
                print(f"  - {filename}")
            print(f"    {group['warning']}")
    print("\nNo files were deleted, moved, or modified.")
def save_report(report: dict[str, Any], output: Path) -> Path:
    """Write a new report file without overwriting an existing report."""
    output = output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    return output
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=TOOL_NAME,
    )
    parser.add_argument(
        "--repo",
        type=Path,
        help="Repository directory; defaults to the current directory.",
    )
    parser.add_argument(
        "--include-untracked",
        action="store_true",
        help="Also inspect non-ignored, untracked files.",
    )
    parser.add_argument(
        "--normalized-source",
        action="store_true",
        help="Find source files matching after whitespace normalization.",
    )
    parser.add_argument(
        "--exclude-dir",
        action="append",
        default=[],
        help="Additional directory name to exclude; can be repeated.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Write a JSON report to a new file; existing files are not overwritten.",
    )
    return parser
def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        repo = (
            args.repo.expanduser().resolve()
            if args.repo
            else Path.cwd().resolve()
        )
        # discover_repository verifies that the supplied path is a repository
        # and returns its canonical root.
        repo = discover_repository(repo)
        extra_excluded = {
            value.strip()
            for value in args.exclude_dir
            if value.strip() and "/" not in value and "\\" not in value
        }
        report = audit(
            repo,
            include_untracked=args.include_untracked,
            normalized_source=args.normalized_source,
            extra_excluded_dirs=extra_excluded,
        )
        print_summary(report)
        if args.output:
            output = save_report(report, args.output)
            print(f"\nJSON report saved: {output}")
        duplicate_found = (
            report["summary"]["identical_content_groups"] > 0
            or report["summary"]["normalized_source_groups"] > 0
        )
        return 1 if duplicate_found else 0
    except (AuditError, OSError, ValueError) as exc:
        print(f"{TOOL_NAME}: {exc}", file=sys.stderr)
        return 2
if __name__ == "__main__":
    raise SystemExit(main())