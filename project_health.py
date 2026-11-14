
#!/usr/bin/env python3
“””
===============================================================================
MedOrbits — Repository Health, Repair and Orchestration System
File: /project_health.py

Features:
    1. Repository-wide file discovery.
    2. Python syntax validation.
    3. JSON validation.
    4. HTML local-link validation.
    5. Missing page and asset detection.
    6. Orphan HTML page detection.
    7. Safe automatic repairs.
    8. Automatic backups before modifications.
    9. JavaScript and Node.js validation when available.
   10. Python test discovery and execution.
   11. Approved Python script execution.
   12. Repository health reports.
   13. Non-destructive default operation.

Runtime: Python >= 3.10
Dependencies: Python standard library only.

Usage:
    python project_health.py
    python project_health.py —repair
    python project_health.py —tests
    python project_health.py —all
    python project_health.py —run-approved
    python project_health.py —strict

IMPORTANT:
    Never blindly execute every Python file in a repository.
===============================================================================
“””

from __future__ import annotations

import argparse
import ast
import datetime as dt
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
import traceback

from collections import defaultdict
from dataclasses import asdict, dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit


# =============================================================================
# 1. CONFIGURATION
# =============================================================================

ROOT = Path(__file__).resolve().parent

REPORT_DIR = ROOT / “repository-reports”
BACKUP_DIR = ROOT / “.repository-backups”

REPORT_JSON = REPORT_DIR / “health-report.json”
REPORT_MD = REPORT_DIR / “health-report.md”

APPROVED_CONFIG = ROOT / “repair-config.json”

IGNORE_DIRS = {
    “.git”,
    “.hg”,
    “.svn”,
    “.venv”,
    “venv”,
    “env”,
    “__pycache__”,
    “node_modules”,
    “.next”,
    “.nuxt”,
    “.cache”,
    “.pytest_cache”,
    “.mypy_cache”,
    “.ruff_cache”,
    “dist”,
    “build”,
    “coverage”,
    “.repository-backups”,
    “repository-reports”,
}

IGNORE_FILES = {
    “package-lock.json”,
    “yarn.lock”,
    “pnpm-lock.yaml”,
}

TEXT_EXTENSIONS = {
    “.html”,
    “.htm”,
    “.css”,
    “.js”,
    “.mjs”,
    “.cjs”,
    “.json”,
    “.py”,
    “.md”,
    “.xml”,
    “.svg”,
    “.txt”,
    “.yml”,
    “.yaml”,
    “.toml”,
}

ASSET_EXTENSIONS = {
    “.css”, “.js”, “.mjs”, “.cjs”,
    “.png”, “.jpg”, “.jpeg”, “.gif”,
    “.webp”, “.svg”, “.ico”,
    “.woff”, “.woff2”, “.ttf”, “.otf”,
    “.pdf”, “.mp4”, “.webm”,
}

MAX_FILE_SIZE = 10 * 1024 * 1024

ISSUES: list[dict[str, Any]] = []
FIXES: list[dict[str, Any]] = []
WARNINGS: list[dict[str, Any]] = []
CHECKS: dict[str, Any] = {}

STRICT = False
AUTO_REPAIR = False


# =============================================================================
# 2. DATA STRUCTURES
# =============================================================================

@dataclass
class Issue:
    severity: str
    category: str
    file: str
    message: str
    line: int | None = None


def relative(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def add_issue(
    severity: str,
    category: str,
    path: Path,
    message: str,
    line: int | None = None,
) -> None:
    ISSUES.append(
        asdict(
            Issue(
                severity=severity,
                category=category,
                file=relative(path),
                message=message,
                line=line,
            )
        )
    )


def add_fix(path: Path, message: str) -> None:
    FIXES.append({
        “file”: relative(path),
        “message”: message,
        “timestamp”: dt.datetime.now(
            dt.timezone.utc
        ).isoformat(),
    })


# =============================================================================
# 3. SAFE FILE DISCOVERY
# =============================================================================

def discover_files() -> list[Path]:
    files: list[Path] = []

    for current, directories, filenames in os.walk(ROOT):

        directories[:] = [
            name for name in directories
            if name not in IGNORE_DIRS
            and not name.startswith(“.repository-“)
        ]

        for filename in filenames:

            if filename in IGNORE_FILES:
                continue

            path = Path(current) / filename

            try:
                if path.is_symlink():
                    continue

                if path.stat().st_size > MAX_FILE_SIZE:
                    continue

                files.append(path)

            except OSError as exc:
                add_issue(
                    “warning”,
                    “filesystem”,
                    path,
                    str(exc),
                )

    return sorted(files)


# =============================================================================
# 4. BACKUP SYSTEM
# =============================================================================

def backup_file(path: Path) -> Path:
    if not path.is_file():
        raise FileNotFoundError(path)

    relative_path = path.relative_to(ROOT)

    destination = BACKUP_DIR / relative_path

    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    if destination.exists():
        timestamp = dt.datetime.now().strftime(
            “%Y%m%d-%H%M%S-%f”
        )

        destination = destination.with_name(
            destination.name + “.” + timestamp
        )

    shutil.copy2(path, destination)

    return destination


def safe_write(path: Path, content: str) -> None:
    if not AUTO_REPAIR:
        raise RuntimeError(“Automatic repair is disabled.”)

    if not path.is_file():
        raise FileNotFoundError(path)

    backup_file(path)

    temporary = path.with_name(
        path.name + “.repair-tmp”
    )

    try:
        temporary.write_text(
            content,
            encoding=“utf-8”,
            newline=“”,
        )

        os.replace(temporary, path)

    finally:
        if temporary.exists():
            temporary.unlink()

    add_fix(path, “File backed up and safely updated.”)


# =============================================================================
# 5. PYTHON VALIDATION
# =============================================================================

def check_python(path: Path) -> None:
    if path.suffix != “.py”:
        return

    try:
        source = path.read_text(encoding=“utf-8”)

        ast.parse(
            source,
            filename=relative(path),
        )

    except UnicodeDecodeError:
        add_issue(
            “error”,
            “python”,
            path,
            “Python file is not valid UTF-8.”,
        )

    except SyntaxError as exc:
        add_issue(
            “error”,
            “python”,
            path,
            exc.msg,
            exc.lineno,
        )

    except OSError as exc:
        add_issue(
            “error”,
            “python”,
            path,
            str(exc),
        )


# =============================================================================
# 6. JSON VALIDATION
# =============================================================================

def check_json(path: Path) -> None:
    if path.suffix.lower() != “.json”:
        return

    try:
        with path.open(
            “r”,
            encoding=“utf-8”,
        ) as file:
            json.load(file)

    except json.JSONDecodeError as exc:
        add_issue(
            “error”,
            “json”,
            path,
            f”{exc.msg}; column {exc.colno}”,
            exc.lineno,
        )

    except (OSError, UnicodeDecodeError) as exc:
        add_issue(
            “error”,
            “json”,
            path,
            str(exc),
        )


# =============================================================================
# 7. HTML LINK EXTRACTION
# =============================================================================

class LinkParser(HTMLParser):

    def __init__(self) -> None:
        super().__init__()

        self.links: list[tuple[str, int]] = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)

        names = []

        if tag in {“a”, “area”, “link”}:
            names.append(“href”)

        if tag in {
            “script”,
            “img”,
            “source”,
            “video”,
            “audio”,
            “iframe”,
        }:
            names.append(“src”)

        if tag in {“img”, “source”}:
            names.append(“srcset”)

        for name in names:
            value = attributes.get(name)

            if value:
                self.links.append(
                    (value.strip(), self.getpos()[0])
                )


# =============================================================================
# 8. HTML ROUTE INDEX
# =============================================================================

def build_route_index(files: list[Path]) -> dict[str, Path]:

    index: dict[str, Path] = {}

    for path in files:

        if path.suffix.lower() not in {
            “.html”,
            “.htm”,
        }:
            continue

        relative_path = path.relative_to(ROOT).as_posix()

        index[relative_path] = path

        if path.name.lower() == “index.html”:

            directory = path.parent.relative_to(
                ROOT
            ).as_posix()

            if directory != “.”:
                index[directory + “/“] = path

    return index


def resolve_local_link(
    source: Path,
    raw_url: str,
) -> Path | None:

    raw_url = html.unescape(raw_url).strip()

    if not raw_url:
        return None

    parsed = urlsplit(raw_url)

    if parsed.scheme or parsed.netloc:
        return None

    if raw_url.startswith((
        “#”,
        “mailto:”,
        “tel:”,
        “javascript:”,
        “data:”,
        “blob:”,
    )):
        return None

    if raw_url.startswith(“//“):
        return None

    decoded = unquote(parsed.path)

    if not decoded:
        return None

    if “\x00” in decoded:
        return None

    if decoded.startswith(“/“):
        candidate = ROOT / decoded.lstrip(“/“)
    else:
        candidate = source.parent / decoded

    try:
        resolved = candidate.resolve()

        resolved.relative_to(ROOT.resolve())

    except (ValueError, OSError):
        return None

    return resolved


def check_html_links(
    files: list[Path],
) -> tuple[set[Path], dict[Path, set[Path]]]:

    referenced: set[Path] = set()

    graph: dict[Path, set[Path]] = defaultdict(set)

    for path in files:

        if path.suffix.lower() not in {
            “.html”,
            “.htm”,
        }:
            continue

        try:
            source = path.read_text(
                encoding=“utf-8”
            )

            parser = LinkParser()
            parser.feed(source)

        except Exception as exc:
            add_issue(
                “error”,
                “html”,
                path,
                f”Unable to parse HTML: {exc}”,
            )
            continue

        for raw_url, line in parser.links:

            # srcset contains multiple candidates.
            # Parse conservatively rather than interpreting the
            # entire srcset string as one path.
            candidates = (
                re.split(r”,\s*”, raw_url)
                if “,” in raw_url
                else [raw_url]
            )

            for item in candidates:

                local_url = item.strip().split()[0] if item.strip() else “”

                target = resolve_local_link(
                    path,
                    local_url,
                )

                if target is None:
                    continue

                if not target.exists():

                    # HTML extension fallback.
                    if not target.suffix:
                        alternatives = [
                            target.with_suffix(“.html”),
                            target / “index.html”,
                        ]

                        existing = [
                            candidate
                            for candidate in alternatives
                            if candidate.is_file()
                        ]

                        if len(existing) == 1:
                            target = existing[0]
                        else:
                            add_issue(
                                “error”,
                                “broken-link”,
                                path,
                                f”Missing local resource: {raw_url}”,
                                line,
                            )
                            continue

                    else:
                        add_issue(
                            “error”,
                            “broken-link”,
                            path,
                            f”Missing local resource: {raw_url}”,
                            line,
                        )
                        continue

                if target.is_file():
                    referenced.add(target)

                    if target.suffix.lower() in {
                        “.html”,
                        “.htm”,
                    }:
                        graph[path].add(target)

    return referenced, graph


# =============================================================================
# 9. ORPHAN PAGE DETECTION
# =============================================================================

def check_orphan_pages(
    files: list[Path],
    graph: dict[Path, set[Path]],
) -> None:

    html_files = {
        path
        for path in files
        if path.suffix.lower() in {
            “.html”,
            “.htm”,
        }
    }

    entry = ROOT / “index.html”

    if not entry.exists():
        add_issue(
            “error”,
            “entry-point”,
            ROOT,
            “Root index.html is missing.”,
        )
        return

    reachable: set[Path] = set()

    stack = [entry]

    while stack:

        current = stack.pop()

        if current in reachable:
            continue

        reachable.add(current)

        stack.extend(
            graph.get(current, set()) - reachable
        )

    for page in sorted(html_files - reachable):

        if page == entry:
            continue

        add_issue(
            “warning”,
            “orphan-page”,
            page,
            “Page is not reachable through detected local HTML links.”,
        )


# =============================================================================
# 10. PROJECT CONFIGURATION VALIDATION
# =============================================================================

def check_project_configs(files: list[Path]) -> None:

    names = {
        path.name
        for path in files
    }

    required = [
        “index.html”,
    ]

    for name in required:

        if name not in names:
            add_issue(
                “error”,
                “project-structure”,
                ROOT,
                f”Required file missing: {name}”,
            )

    package = ROOT / “package.json”

    if package.exists():
        try:
            data = json.loads(
                package.read_text(encoding=“utf-8”)
            )

            if not isinstance(data, dict):
                raise ValueError(
                    “package.json must contain an object.”
                )

        except Exception as exc:
            add_issue(
                “error”,
                “package”,
                package,
                str(exc),
            )


# =============================================================================
# 11. JAVASCRIPT VALIDATION
# =============================================================================

def check_javascript(files: list[Path]) -> None:

    node = shutil.which(“node”)

    if not node:
        WARNINGS.append({
            “category”: “javascript”,
            “message”: “Node.js unavailable; JavaScript syntax checks skipped.”,
        })
        return

    extensions = {“.js”, “.mjs”, “.cjs”}

    for path in files:

        if path.suffix.lower() not in extensions:
            continue

        result = subprocess.run(
            [node, “—check”, str(path)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode != 0:
            add_issue(
                “error”,
                “javascript”,
                path,
                (result.stderr or result.stdout).strip(),
            )


# =============================================================================
# 12. TEST DISCOVERY
# =============================================================================

def discover_tests(files: list[Path]) -> list[Path]:

    return [
        path
        for path in files
        if (
            path.suffix == “.py”
            and (
                path.name.startswith(“test_”)
                or path.name.endswith(“_test.py”)
            )
        )
    ]


def run_python_tests() -> None:

    python = sys.executable

    command = [
        python,
        “-m”,
        “unittest”,
        “discover”,
        “-v”,
    ]

    result = subprocess.run(
        command,
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=600,
    )

    CHECKS[“python_tests”] = {
        “returncode”: result.returncode,
        “stdout”: result.stdout[-15000:],
        “stderr”: result.stderr[-15000:],
    }

    if result.returncode != 0:
        add_issue(
            “error”,
            “python-tests”,
            ROOT,
            “Python unittest discovery failed.”,
        )


# =============================================================================
# 13. APPROVED SCRIPT EXECUTION
# =============================================================================

def load_approved_scripts() -> list[str]:

    if not APPROVED_CONFIG.exists():
        return []

    try:
        data = json.loads(
            APPROVED_CONFIG.read_text(
                encoding=“utf-8”
            )
        )

    except Exception as exc:
        add_issue(
            “error”,
            “execution-policy”,
            APPROVED_CONFIG,
            str(exc),
        )
        return []

    scripts = data.get(“approved_python_scripts”, [])

    if not isinstance(scripts, list):
        add_issue(
            “error”,
            “execution-policy”,
            APPROVED_CONFIG,
            “approved_python_scripts must be an array.”,
        )
        return []

    return scripts


def run_approved_scripts() -> None:

    approved = load_approved_scripts()

    results = []

    for item in approved:

        relative_path = Path(item)

        if relative_path.is_absolute() or “..” in relative_path.parts:
            add_issue(
                “error”,
                “execution-policy”,
                APPROVED_CONFIG,
                f”Unsafe script path: {item}”,
            )
            continue

        script = (ROOT / relative_path).resolve()

        try:
            script.relative_to(ROOT.resolve())

        except ValueError:
            add_issue(
                “error”,
                “execution-policy”,
                APPROVED_CONFIG,
                f”Script escapes repository: {item}”,
            )
            continue

        if (
            not script.is_file()
            or script.suffix != “.py”
        ):
            add_issue(
                “error”,
                “execution-policy”,
                APPROVED_CONFIG,
                f”Approved script not found: {item}”,
            )
            continue

        result = subprocess.run(
            [sys.executable, str(script)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=300,
        )

        results.append({
            “script”: item,
            “returncode”: result.returncode,
            “stdout”: result.stdout[-5000:],
            “stderr”: result.stderr[-5000:],
        })

        if result.returncode != 0:
            add_issue(
                “error”,
                “approved-script”,
                script,
                f”Approved script failed: {result.returncode}”,
            )

    CHECKS[“approved_scripts”] = results


# =============================================================================
# 14. SAFE AUTOMATIC REPAIRS
# =============================================================================

def repair_json_formatting(files: list[Path]) -> None:
    “””
    Safe repair:
        Reformat valid JSON files consistently.

    Does not attempt to guess missing commas, brackets or values.
    Invalid JSON is reported, not rewritten.
    “””

    for path in files:

        if path.suffix.lower() != “.json”:
            continue

        try:
            original = path.read_text(
                encoding=“utf-8”
            )

            parsed = json.loads(original)

            formatted = json.dumps(
                parsed,
                ensure_ascii=False,
                indent=2,
            ) + “\n”

            if formatted != original:
                safe_write(
                    path,
                    formatted,
                )

        except Exception:
            # Invalid JSON must be corrected with human review.
            continue


def run_repairs(files: list[Path]) -> None:

    if not AUTO_REPAIR:
        return

    repair_json_formatting(files)


# =============================================================================
# 15. REPORT GENERATION
# =============================================================================

def generate_report() -> None:

    REPORT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    errors = sum(
        1 for issue in ISSUES
        if issue[“severity”] == “error”
    )

    warnings = sum(
        1 for issue in ISSUES
        if issue[“severity”] == “warning”
    )

    report = {
        “project”: “MedOrbits”,
        “root”: str(ROOT),
        “generated_at”: dt.datetime.now(
            dt.timezone.utc
        ).isoformat(),
        “automatic_repair”: AUTO_REPAIR,
        “summary”: {
            “errors”: errors,
            “warnings”: warnings,
            “fixes”: len(FIXES),
        },
        “checks”: CHECKS,
        “issues”: ISSUES,
        “fixes”: FIXES,
        “warnings”: WARNINGS,
    }

    REPORT_JSON.write_text(
        json.dumps(
            report,
            ensure_ascii=False,
            indent=2,
        ),
        encoding=“utf-8”,
    )

    lines = [
        “# MedOrbits Repository Health Report”,
        “”,
        f”Generated: {report[‘generated_at’]}”,
        “”,
        “## Summary”,
        “”,
        f”- Errors: {errors}”,
        f”- Warnings: {warnings}”,
        f”- Repairs: {len(FIXES)}”,
        “”,
        “## Issues”,
        “”,
    ]

    if not ISSUES:
        lines.append(“No detected issues.”)

    for issue in ISSUES:

        location = issue[“file”]

        if issue.get(“line”):
            location += f”:{issue[‘line’]}”

        lines.append(
            f”- **{issue[‘severity’].upper()}** “
            f”`{location}` — {issue[‘message’]}”
        )

    lines.extend([
        “”,
        “## Automatic repairs”,
        “”,
    ])

    for fix in FIXES:
        lines.append(
            f”- `{fix[‘file’]}` — {fix[‘message’]}”
        )

    REPORT_MD.write_text(
        “\n”.join(lines) + “\n”,
        encoding=“utf-8”,
    )


# =============================================================================
# 16. MAIN AUDIT
# =============================================================================

def audit(files: list[Path]) -> None:

    print(“\n[1/7] Python syntax validation...”)

    for path in files:
        check_python(path)

    print(“[2/7] JSON validation...”)

    for path in files:
        check_json(path)

    print(“[3/7] HTML page and resource validation...”)

    _, graph = check_html_links(files)

    print(“[4/7] Orphan page detection...”)

    check_orphan_pages(files, graph)

    print(“[5/7] Project configuration validation...”)

    check_project_configs(files)

    print(“[6/7] JavaScript syntax validation...”)

    check_javascript(files)

    print(“[7/7] Audit completed.”)


# =============================================================================
# 17. COMMAND-LINE INTERFACE
# =============================================================================

def main() -> int:

    global AUTO_REPAIR, STRICT

    parser = argparse.ArgumentParser(
        description=“MedOrbits repository repair and validation system.”
    )

    parser.add_argument(
        “—repair”,
        action=“store_true”,
        help=“Back up and format valid JSON files.”,
    )

    parser.add_argument(
        “—tests”,
        action=“store_true”,
        help=“Run Python unittest discovery.”,
    )

    parser.add_argument(
        “—run-approved”,
        action=“store_true”,
        help=“Run scripts explicitly approved in repair-config.json.”,
    )

    parser.add_argument(
        “—all”,
        action=“store_true”,
        help=“Run repair, audit, Python tests and approved scripts.”,
    )

    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=“Treat warnings as failure.”,
    )

    args = parser.parse_args()

    AUTO_REPAIR = args.repair or args.all
    STRICT = args.strict

    print(“=“ * 72)
    print(“MEDORBITS — REPOSITORY HEALTH SYSTEM”)
    print(“=“ * 72)

    print(f”Repository: {ROOT}”)

    files = discover_files()

    CHECKS[“discovered_files”] = len(files)

    CHECKS[“python_files”] = sum(
        path.suffix == “.py”
        for path in files
    )

    CHECKS[“html_files”] = sum(
        path.suffix.lower() in {“.html”, “.htm”}
        for path in files
    )

    CHECKS[“json_files”] = sum(
        path.suffix.lower() == “.json”
        for path in files
    )

    print(f”Discovered files: {len(files)}”)

    if AUTO_REPAIR:
        print(“\nRunning safe repairs...”)
        run_repairs(files)

        # Re-discover and validate after repairs.
        files = discover_files()

    audit(files)

    if args.tests or args.all:
        print(“\nRunning Python tests...”)
        run_python_tests()

    if args.run_approved or args.all:
        print(“\nRunning approved Python scripts...”)
        run_approved_scripts()

    generate_report()

    errors = sum(
        1 for issue in ISSUES
        if issue[“severity”] == “error”
    )

    warnings = sum(
        1 for issue in ISSUES
        if issue[“severity”] == “warning”
    )

    print(“\n” + “=“ * 72)
    print(“REPOSITORY HEALTH SUMMARY”)
    print(“=“ * 72)

    print(f”Files discovered : {len(files)}”)
    print(f”Errors           : {errors}”)
    print(f”Warnings         : {warnings}”)
    print(f”Repairs          : {len(FIXES)}”)

    print(f”\nJSON report: {REPORT_JSON}”)
    print(f”Markdown report: {REPORT_MD}”)

    if BACKUP_DIR.exists():
        print(f”Backups: {BACKUP_DIR}”)

    print(“=“ * 72)

    if errors > 0:
        return 1

    if STRICT and warnings > 0:
        return 1

    return 0


if __name__ == “__main__”:
    try:
        sys.exit(main())

    except KeyboardInterrupt:
        print(“\nOperation cancelled.”)
        sys.exit(130)

    except Exception:
        traceback.print_exc()
        sys.exit(1)
