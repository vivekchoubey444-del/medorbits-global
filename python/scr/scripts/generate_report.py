
#!/usr/bin/env python3
"""Generate structured reports for the MedOrbits repository.

Features:
    - Repository inventory and file statistics
    - JSON and Markdown report output
    - Optional ingestion of validation reports
    - Optional Git status and commit metadata
    - Secret-safe output and configurable exclusions
    - Atomic output writes
    - No source-file modification

Examples:
    python python/scr/scripts/generate_report.py
    python python/scr/scripts/generate_report.py --format json
    python python/scr/scripts/generate_report.py --format both
    python python/scr/scripts/generate_report.py --root . --output reports/
    python python/scr/scripts/generate_report.py \
        --validation-report validation-report.json
    python python/scr/scripts/generate_report.py --include-git

Exit codes:
    0: Report generation succeeded.
    1: Report generation completed with warnings.
    2: Invalid arguments or operational failure.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence


TOOL_NAME = "MedOrbits Repository Report Generator"
TOOL_VERSION = "1.0.0"

DEFAULT_EXCLUDED_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".tox",
    "coverage",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".cache",
}

DEFAULT_EXCLUDED_FILES = {
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    "id_rsa",
    "id_ed25519",
}

SECRET_NAME_PARTS = (
    "secret",
    "password",
    "passwd",
    "credential",
    "private_key",
    "access_token",
    "refresh_token",
    "api_key",
)

MAX_FILES = 100_000
MAX_VALIDATION_REPORT_BYTES = 10 * 1024 * 1024


def utc_now() -> str:
    """Return an ISO-8601 UTC timestamp."""
    return datetime.now(timezone.utc).isoformat()


def is_secret_name(name: str) -> bool:
    """Return whether a name suggests sensitive content."""
    lowered = name.lower().replace("-", "_")
    return any(part in lowered for part in SECRET_NAME_PARTS)


def safe_relative_path(path: Path, root: Path) -> str:
    """Return a repository-relative path where possible."""
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except (OSError, ValueError, RuntimeError):
        return path.name


def run_git(root: Path, *args: str) -> str | None:
    """Run a bounded Git metadata command without shell interpolation."""
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None

    if result.returncode != 0:
        return None

    return result.stdout.strip()


def collect_git_metadata(root: Path) -> dict[str, Any]:
    """Collect non-sensitive Git metadata."""
    branch = run_git(root, "branch", "--show-current")
    commit = run_git(root, "rev-parse", "--short", "HEAD")
    status = run_git(root, "status", "--short")

    if branch is None and commit is None and status is None:
        return {
            "available": False,
            "message": "Git metadata unavailable.",
        }

    return {
        "available": True,
        "branch": branch,
        "commit": commit,
        "working_tree_clean": status == "",
        "changed_path_count": (
            len(status.splitlines()) if status is not None else None
        ),
    }


def discover_files(
    root: Path,
    *,
    excluded_dirs: set[str] | None = None,
    excluded_files: set[str] | None = None,
    max_files: int = MAX_FILES,
) -> tuple[list[Path], list[str]]:
    """Walk a repository without following directory symlinks."""
    ignored_dirs = set(DEFAULT_EXCLUDED_DIRS)
    ignored_files = set(DEFAULT_EXCLUDED_FILES)

    if excluded_dirs:
        ignored_dirs.update(excluded_dirs)
    if excluded_files:
        ignored_files.update(excluded_files)

    files: list[Path] = []
    warnings: list[str] = []

    for current, dirnames, filenames in os.walk(root, followlinks=False):
        current_path = Path(current)

        dirnames[:] = sorted(
            dirname
            for dirname in dirnames
            if dirname not in ignored_dirs
            and not (current_path / dirname).is_symlink()
        )

        for filename in sorted(filenames):
            if filename in ignored_files:
                continue

            candidate = current_path / filename

            if candidate.is_symlink() or not candidate.is_file():
                continue

            files.append(candidate)

            if len(files) >= max_files:
                warnings.append(
                    f"File inventory capped at {max_files} files."
                )
                return files, warnings

    return files, warnings


def classify_file(path: Path) -> str:
    """Group files by extension for inventory statistics."""
    if path.name.lower().startswith(".env"):
        return "environment/configuration"

    suffix = path.suffix.lower()

    categories = {
        ".py": "python",
        ".js": "javascript",
        ".cjs": "javascript",
        ".mjs": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".html": "html",
        ".htm": "html",
        ".css": "stylesheets",
        ".scss": "stylesheets",
        ".json": "json",
        ".jsonc": "json",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".md": "markdown",
        ".mdx": "markdown",
        ".sh": "shell",
        ".bash": "shell",
        ".sql": "sql",
        ".toml": "toml",
        ".xml": "xml",
        ".svg": "images",
        ".png": "images",
        ".jpg": "images",
        ".jpeg": "images",
        ".webp": "images",
        ".gif": "images",
        ".pdf": "documents",
        ".txt": "text",
        ".lock": "lockfiles",
    }

    if not suffix:
        return "extensionless/other"

    return categories.get(suffix, "other")


def inventory_files(
    root: Path,
    files: list[Path],
) -> dict[str, Any]:
    """Build file-count and size statistics."""
    extensions: Counter[str] = Counter()
    categories: Counter[str] = Counter()
    total_bytes = 0
    unreadable_files = 0
    largest_files: list[dict[str, Any]] = []

    for path in files:
        suffix = path.suffix.lower() or "[no extension]"
        extensions[suffix] += 1
        categories[classify_file(path)] += 1

        try:
            size = path.stat().st_size
        except OSError:
            unreadable_files += 1
            continue

        total_bytes += size
        largest_files.append(
            {
                "path": safe_relative_path(path, root),
                "size_bytes": size,
            }
        )

    largest_files.sort(
        key=lambda item: item["size_bytes"],
        reverse=True,
    )

    return {
        "file_count": len(files),
        "total_size_bytes": total_bytes,
        "total_size_mib": round(total_bytes / (1024 * 1024), 3),
        "unreadable_file_count": unreadable_files,
        "by_extension": dict(sorted(extensions.items())),
        "by_category": dict(sorted(categories.items())),
        "largest_files": largest_files[:20],
    }


def load_validation_report(path: Path) -> dict[str, Any]:
    """Load a bounded JSON validation report without exposing file contents."""
    try:
        if not path.is_file():
            return {
                "available": False,
                "error": "Validation report is not a regular file.",
            }

        size = path.stat().st_size
        if size > MAX_VALIDATION_REPORT_BYTES:
            return {
                "available": False,
                "error": "Validation report exceeds the size limit.",
            }

        with path.open("r", encoding="utf-8-sig") as stream:
            data = json.load(stream)

    except (OSError, UnicodeError, json.JSONDecodeError, RecursionError):
        return {
            "available": False,
            "error": "Validation report could not be read as valid JSON.",
        }

    if not isinstance(data, dict):
        return {
            "available": False,
            "error": "Validation report must contain a JSON object.",
        }

    allowed_keys = (
        "tool",
        "version",
        "valid",
        "files_checked",
        "files_passed",
        "files_failed",
        "total_errors",
        "total_warnings",
    )

    sanitized = {
        key: data[key]
        for key in allowed_keys
        if key in data
        and isinstance(data[key], (str, int, float, bool, type(None)))
    }

    # Do not copy arbitrary report results, messages, or dataset contents.
    sanitized["available"] = True
    return sanitized


def build_report(
    root: Path,
    *,
    include_git: bool = False,
    validation_report: Path | None = None,
    excluded_dirs: set[str] | None = None,
) -> tuple[dict[str, Any], list[str]]:
    """Collect repository statistics and assemble the report."""
    warnings: list[str] = []
    files, discovery_warnings = discover_files(
        root,
        excluded_dirs=excluded_dirs,
    )
    warnings.extend(discovery_warnings)

    inventory = inventory_files(root, files)

    report: dict[str, Any] = {
        "tool": TOOL_NAME,
        "version": TOOL_VERSION,
        "generated_at": utc_now(),
        "repository": {
            "root_name": root.name,
            "root_path": ".",
        },
        "inventory": inventory,
        "warnings": warnings,
    }

    if include_git:
        report["git"] = collect_git_metadata(root)

    if validation_report is not None:
        report["validation"] = load_validation_report(validation_report)

        if not report["validation"].get("available", False):
            warnings.append("Validation report was not incorporated.")

    return report, warnings


def render_markdown(report: dict[str, Any]) -> str:
    """Render a concise Markdown summary."""
    repository = report["repository"]
    inventory = report["inventory"]

    lines = [
        "# MedOrbits Repository Report",
        "",
        f"- Generated: {report['generated_at']}",
        f"- Generator version: {report['version']}",
        f"- Repository: `{repository['root_name']}`",
        "",
        "## Inventory",
        "",
        f"- Files inventoried: {inventory['file_count']}",
        f"- Total size: {inventory['total_size_mib']} MiB",
        f"- Unreadable files: {inventory['unreadable_file_count']}",
        "",
        "## File categories",
        "",
        "| Category | Files |",
        "|---|---:|",
    ]

    for category, count in inventory["by_category"].items():
        safe_category = category.replace("|", "\\|")
        lines.append(f"| {safe_category} | {count} |")

    lines.extend(
        [
            "",
            "## File extensions",
            "",
            "| Extension | Files |",
            "|---|---:|",
        ]
    )

    for extension, count in inventory["by_extension"].items():
        safe_extension = extension.replace("|", "\\|")
        lines.append(f"| `{safe_extension}` | {count} |")

    lines.extend(
        [
            "",
            "## Largest files",
            "",
            "| File | Size (bytes) |",
            "|---|---:|",
        ]
    )

    for item in inventory["largest_files"]:
        safe_path = item["path"].replace("|", "\\|").replace("`", "'")
        lines.append(f"| `{safe_path}` | {item['size_bytes']} |")

    if "git" in report:
        git = report["git"]
        lines.extend(
            [
                "",
                "## Git metadata",
                "",
                f"- Available: {git['available']}",
            ]
        )

        if git["available"]:
            lines.extend(
                [
                    f"- Branch: `{git.get('branch') or 'unknown'}`",
                    f"- Commit: `{git.get('commit') or 'unknown'}`",
                    f"- Working tree clean: {git.get('working_tree_clean')}",
                    f"- Changed paths: {git.get('changed_path_count')}",
                ]
            )

    if "validation" in report:
        validation = report["validation"]
        lines.extend(
            [
                "",
                "## Validation summary",
                "",
                f"- Available: {validation.get('available', False)}",
            ]
        )

        for key in (
            "valid",
            "files_checked",
            "files_passed",
            "files_failed",
            "total_errors",
            "total_warnings",
        ):
            if key in validation:
                lines.append(f"- {key.replace('_', ' ').title()}: {validation[key]}")

    if report.get("warnings"):
        lines.extend(["", "## Warnings", ""])
        lines.extend(f"- {warning}" for warning in report["warnings"])

    lines.append("")
    return "\n".join(lines)


def atomic_write_text(destination: Path, content: str) -> None:
    """Atomically write one explicitly selected output file."""
    destination = destination.expanduser().resolve()

    if destination.exists() and destination.is_dir():
        raise IsADirectoryError("Output destination is a directory.")

    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="\n",
            prefix=".medorbits-report-",
            suffix=".tmp",
            dir=destination.parent,
            delete=False,
        ) as stream:
            temporary_path = Path(stream.name)
            stream.write(content)
            if not content.endswith("\n"):
                stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())

        os.replace(temporary_path, destination)
        temporary_path = None

    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink(missing_ok=True)
            except OSError:
                pass


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Generate MedOrbits repository inventory reports.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="Repository root to inspect.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("reports"),
        help="Directory for generated reports.",
    )
    parser.add_argument(
        "--format",
        choices=("json", "markdown", "both"),
        default="both",
        help="Report format.",
    )
    parser.add_argument(
        "--include-git",
        action="store_true",
        help="Include non-sensitive Git metadata.",
    )
    parser.add_argument(
        "--validation-report",
        type=Path,
        help="Optional JSON validation report to summarize.",
    )
    parser.add_argument(
        "--exclude-dir",
        action="append",
        default=[],
        metavar="NAME",
        help="Additional directory name to exclude. Can be repeated.",
    )
    parser.add_argument(
        "--stdout",
        action="store_true",
        help="Print the selected report to stdout instead of writing files.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress the final status message.",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {TOOL_VERSION}",
    )

    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    """Run the report generator."""
    args = parse_args(argv)

    try:
        root = args.root.expanduser().resolve(strict=True)
    except (OSError, RuntimeError):
        print("ERROR: Repository root does not exist.", file=sys.stderr)
        return 2

    if not root.is_dir():
        print("ERROR: Repository root must be a directory.", file=sys.stderr)
        return 2

    validation_path: Path | None = None
    if args.validation_report is not None:
        validation_path = args.validation_report.expanduser()
        if not validation_path.is_absolute():
            validation_path = (Path.cwd() / validation_path).resolve()

    report, warnings = build_report(
        root,
        include_git=args.include_git,
        validation_report=validation_path,
        excluded_dirs=set(args.exclude_dir),
    )

    markdown = render_markdown(report)
    json_text = json.dumps(
        report,
        ensure_ascii=False,
        indent=2,
    ) + "\n"

    try:
        if args.stdout:
            if args.format == "json":
                print(json_text, end="")
            elif args.format == "markdown":
                print(markdown, end="")
            else:
                print(markdown)
                print("\n--- JSON REPORT ---\n")
                print(json_text, end="")
        else:
            output_dir = args.output.expanduser()
            if not output_dir.is_absolute():
                output_dir = Path.cwd() / output_dir

            output_dir.mkdir(parents=True, exist_ok=True)

            if args.format in ("json", "both"):
                atomic_write_text(
                    output_dir / "repository-report.json",
                    json_text,
                )

            if args.format in ("markdown", "both"):
                atomic_write_text(
                    output_dir / "repository-report.md",
                    markdown,
                )

    except OSError as exc:
        print(
            f"ERROR: Report output failed ({type(exc).__name__}).",
            file=sys.stderr,
        )
        return 2

    if not args.quiet:
        print(
            f"Report generated: {report['inventory']['file_count']} files inventoried.",
            file=sys.stderr if args.stdout else sys.stdout,
        )

        for warning in warnings:
            print(f"WARNING: {warning}", file=sys.stderr)

        if not args.stdout:
            print(f"Output directory: {output_dir}")

    return 1 if warnings else 0


if __name__ == "__main__":
    raise SystemExit(main())
