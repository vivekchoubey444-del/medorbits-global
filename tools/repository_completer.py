
#!/usr/bin/env python3
"""
MedOrbits Repository Completer
==============================

Python 3.10+

Features
--------
- Scans a repository for empty and suspiciously small files.
- Detects common incomplete source-file patterns.
- Creates missing essential project documentation and configuration.
- Repairs selected safe, deterministic issues.
- Validates Python, JSON, TOML, YAML, JavaScript and HTML where supported.
- Checks common internal references.
- Backs up files before changing them.
- Generates a JSON audit report.
- Supports audit-only and apply modes.

Usage
-----
Audit:
    python tools/repository_completer.py

Apply safe repairs:
    python tools/repository_completer.py --apply

Specify repository:
    python tools/repository_completer.py --root .

Strict audit:
    python tools/repository_completer.py --strict

Important
---------
This tool cannot determine the correct business logic for every file.
It does not invent arbitrary implementations for empty application modules.
Uncertain files are reported for review rather than overwritten.
"""

from __future__ import annotations

import argparse
import ast
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import tokenize
import traceback
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse


VERSION = "1.0.0"

IGNORED_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".venv",
    "venv",
    "env",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".tox",
    "dist",
    "build",
    "coverage",
    ".next",
    ".nuxt",
    "target",
    "vendor",
    ".idea",
    ".vscode",
    "site-packages",
}

IGNORED_SUFFIXES = {
    ".pyc",
    ".pyo",
    ".so",
    ".dll",
    ".dylib",
    ".exe",
    ".class",
    ".jar",
    ".zip",
    ".gz",
    ".tar",
    ".rar",
    ".7z",
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".mp3",
    ".mp4",
    ".mov",
    ".sqlite",
    ".db",
}

TEXT_SUFFIXES = {
    ".py",
    ".pyi",
    ".js",
    ".mjs",
    ".cjs",
    ".jsx",
    ".ts",
    ".tsx",
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".json",
    ".jsonc",
    ".jsonl",
    ".toml",
    ".yaml",
    ".yml",
    ".xml",
    ".svg",
    ".md",
    ".rst",
    ".txt",
    ".sh",
    ".bash",
    ".ps1",
    ".bat",
    ".cmd",
    ".sql",
    ".ini",
    ".cfg",
    ".conf",
    ".env.example",
    ".sample",
    ".gitignore",
    ".gitattributes",
    ".editorconfig",
    ".dockerignore",
    ".properties",
    ".graphql",
    ".proto",
}

SAFE_PLACEHOLDERS: dict[str, str] = {
    ".gitignore": """# Python
__pycache__/
*.py[cod]
.pytest_cache/
.mypy_cache/
.ruff_cache/
.coverage
htmlcov/

# Environments
.venv/
venv/
env/

# Secrets and local configuration
.env
.env.*
!.env.example
!.env.sample

# Build outputs
build/
dist/
*.egg-info/

# Editor and operating system files
.DS_Store
Thumbs.db
.idea/
.vscode/

# Logs and temporary files
*.log
*.tmp
*.bak
""",
    ".editorconfig": """root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.py]
indent_style = space
indent_size = 4

[*.{js,jsx,ts,tsx,json,yml,yaml,css,scss,html}]
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
""",
}

DEFAULT_README = """# MedOrbits

MedOrbits provides education, medical admissions, career guidance,
recruitment, application, and document-related services.

## Repository maintenance

- Keep credentials and private data out of version control.
- Validate changes with the project's configured test suite.
- Document environment variables and deployment requirements.
- Preserve existing architecture and API contracts when modifying files.

## Python package

The Python package is located at `src/python/medorbits/`, where present.

For installation and module usage, see the package README.

## Validation

Run the project's configured tests and linters before deployment.
"""


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_ignored(path: Path, root: Path) -> bool:
    try:
        relative = path.relative_to(root)
    except ValueError:
        return True

    if any(part in IGNORED_DIRS for part in relative.parts):
        return True

    if path.suffix.lower() in IGNORED_SUFFIXES:
        return True

    if path.name == ".git":
        return True

    return False


def is_probably_text(path: Path) -> bool:
    name = path.name.lower()

    if name in {
        "license",
        "licence",
        "makefile",
        "dockerfile",
        "procfile",
        "justfile",
        "gemfile",
        "rakefile",
    }:
        return True

    if name.startswith(".") and not path.suffix:
        return True

    if path.suffix.lower() in TEXT_SUFFIXES:
        return True

    if name.endswith((".env.example", ".env.sample")):
        return True

    return False


def read_text(path: Path) -> str:
    with tokenize.open(path) if path.suffix.lower() in {".py", ".pyi"} else path.open(
        "r", encoding="utf-8-sig"
    ) as stream:
        return stream.read()


def classify_file(path: Path, root: Path) -> str:
    relative = path.relative_to(root).as_posix()
    name = path.name.lower()

    if relative.startswith(".github/workflows/"):
        return "workflow"

    if name == "package.json":
        return "node-manifest"

    if name == "pyproject.toml":
        return "python-manifest"

    if name in {"readme.md", "readme.rst", "readme.txt"}:
        return "readme"

    if name in {"license", "license.md", "license.txt"}:
        return "license"

    if path.suffix.lower() == ".py":
        return "python"

    if path.suffix.lower() == ".json":
        return "json"

    if path.suffix.lower() in {".yaml", ".yml"}:
        return "yaml"

    if path.suffix.lower() == ".toml":
        return "toml"

    if path.suffix.lower() in {".js", ".mjs", ".cjs", ".jsx"}:
        return "javascript"

    if path.suffix.lower() in {".ts", ".tsx"}:
        return "typescript"

    if path.suffix.lower() in {".html", ".htm"}:
        return "html"

    if path.suffix.lower() == ".css":
        return "css"

    if path.suffix.lower() == ".sh":
        return "shell"

    if path.suffix.lower() == ".sql":
        return "sql"

    return "text"


def detect_suspicious_content(path: Path, content: str) -> list[str]:
    findings: list[str] = []
    stripped = content.strip()
    suffix = path.suffix.lower()

    if not stripped:
        findings.append("empty_file")
        return findings

    if stripped in {
        "TODO",
        "FIXME",
        "PLACEHOLDER",
        "IMPLEMENT ME",
        "IMPLEMENT_ME",
        "pass",
        "...",
        "// TODO",
        "/* TODO */",
        "# TODO",
    }:
        findings.append("placeholder_only")

    if re.search(r"(?m)^\s*(?:<<<<<<<|=======|>>>>>>>)", content):
        findings.append("merge_conflict_marker")

    if re.search(
        r"(?im)^\s*(?:TODO|FIXME|IMPLEMENT\s+ME|IMPLEMENT_ME)\b",
        content,
    ):
        findings.append("todo_marker")

    if suffix == ".py":
        try:
            tree = ast.parse(content, filename=str(path))
            if not tree.body:
                findings.append("python_module_without_statements")
            elif all(
                isinstance(node, (ast.Expr, ast.Pass))
                or (
                    isinstance(node, ast.Expr)
                    and isinstance(node.value, ast.Constant)
                    and isinstance(node.value.value, str)
                )
                for node in tree.body
            ):
                findings.append("python_module_without_implementation")
        except SyntaxError as exc:
            findings.append(
                f"python_syntax_error:{exc.lineno or '?'}:{exc.msg}"
            )

    if suffix == ".json":
        try:
            json.loads(content)
        except json.JSONDecodeError as exc:
            findings.append(
                f"json_syntax_error:{exc.lineno}:{exc.colno}:{exc.msg}"
            )

    if suffix in {".html", ".htm"}:
        if re.search(r"<script\b[^>]*>\s*</script\s*>", content, re.I):
            findings.append("empty_script_element")
        if re.search(r"<style\b[^>]*>\s*</style\s*>", content, re.I):
            findings.append("empty_style_element")

    if suffix in {".js", ".mjs", ".cjs", ".ts", ".tsx"}:
        if re.search(r"(?m)^\s*(?:export\s+)?(?:function|class)\s+\w+\s*\([^)]*\)\s*\{\s*\}", content):
            findings.append("empty_function_or_class_body")

    return findings


def validate_content(path: Path, content: str) -> list[str]:
    errors: list[str] = []
    suffix = path.suffix.lower()

    if suffix == ".py":
        try:
            ast.parse(content, filename=str(path))
        except SyntaxError as exc:
            errors.append(
                f"Python syntax error at line {exc.lineno}: {exc.msg}"
            )

    elif suffix == ".json":
        try:
            json.loads(content)
        except json.JSONDecodeError as exc:
            errors.append(
                f"JSON error at line {exc.lineno}, column {exc.colno}: {exc.msg}"
            )

    elif suffix == ".toml":
        try:
            import tomllib

            tomllib.loads(content)
        except ImportError:
            errors.append("TOML validation requires Python 3.11+ tomllib")
        except Exception as exc:
            errors.append(f"TOML parsing error: {exc}")

    elif suffix in {".yaml", ".yml"}:
        try:
            import yaml  # type: ignore[import-not-found]
        except ImportError:
            pass
        else:
            try:
                yaml.safe_load(content)
            except Exception as exc:
                errors.append(f"YAML parsing error: {exc}")

    return errors


def backup_file(path: Path, root: Path) -> Path:
    relative = path.relative_to(root)
    backup_root = root / ".repository-completer-backups"
    destination = backup_root / relative
    destination.parent.mkdir(parents=True, exist_ok=True)

    if destination.exists():
        stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        destination = destination.with_name(
            f"{destination.name}.{stamp}.bak"
        )

    shutil.copy2(path, destination)
    return destination


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=str(path.parent),
    )
    temporary = Path(temporary_name)

    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(content)
            if content and not content.endswith("\n"):
                stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())

        os.replace(temporary, path)
    except Exception:
        try:
            temporary.unlink(missing_ok=True)
        finally:
            raise


def create_default_files(root: Path) -> dict[str, str]:
    candidates = {
        ".gitignore": SAFE_PLACEHOLDERS[".gitignore"],
        ".editorconfig": SAFE_PLACEHOLDERS[".editorconfig"],
    }

    readme = root / "README.md"
    if not readme.exists():
        candidates["README.md"] = DEFAULT_README

    return candidates


def check_internal_html_links(root: Path, html_path: Path) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []

    try:
        content = read_text(html_path)
    except (OSError, UnicodeError):
        return issues

    for match in re.finditer(
        r"""(?:href|src)\s*=\s*["']([^"'#]+)["']""",
        content,
        re.IGNORECASE,
    ):
        target = match.group(1).strip()

        if not target or target.startswith(
            ("http://", "https://", "mailto:", "tel:", "data:", "javascript:")
        ):
            continue

        parsed = urlparse(target)
        if parsed.scheme or parsed.netloc:
            continue

        local_target = unquote(parsed.path)
        if not local_target:
            continue

        candidate = (html_path.parent / local_target).resolve()

        try:
            candidate.relative_to(root.resolve())
        except ValueError:
            issues.append({
                "file": html_path.relative_to(root).as_posix(),
                "target": target,
                "problem": "reference_resolves_outside_repository",
            })
            continue

        if not candidate.exists():
            issues.append({
                "file": html_path.relative_to(root).as_posix(),
                "target": target,
                "problem": "missing_internal_reference",
            })

    return issues


def run_optional_tool(
    command: list[str],
    root: Path,
    timeout: int = 30,
) -> dict[str, Any]:
    executable = shutil.which(command[0])

    if executable is None:
        return {
            "command": command,
            "status": "skipped",
            "reason": f"{command[0]} is not installed",
        }

    try:
        result = subprocess.run(
            command,
            cwd=root,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        return {
            "command": command,
            "status": "passed" if result.returncode == 0 else "failed",
            "returncode": result.returncode,
            "stdout": result.stdout[-5000:],
            "stderr": result.stderr[-5000:],
        }
    except subprocess.TimeoutExpired:
        return {
            "command": command,
            "status": "timeout",
            "reason": f"Command exceeded {timeout} seconds",
        }
    except OSError as exc:
        return {
            "command": command,
            "status": "error",
            "reason": str(exc),
        }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit and safely complete a MedOrbits repository."
    )
    parser.add_argument(
        "--root",
        default=".",
        help="Repository root directory (default: current directory).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply safe deterministic repairs and create missing defaults.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return a nonzero exit code if issues remain.",
    )
    parser.add_argument(
        "--report",
        default="repository-completer-report.json",
        help="Report output path relative to the repository root.",
    )
    parser.add_argument(
        "--validate-python",
        action="store_true",
        help="Run Python compile checks for discovered Python files.",
    )
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()

    if not root.is_dir():
        print(f"ERROR: Repository root is not a directory: {root}", file=sys.stderr)
        return 2

    report: dict[str, Any] = {
        "tool": "MedOrbits Repository Completer",
        "version": VERSION,
        "root": str(root),
        "started_at": utc_now(),
        "mode": "apply" if args.apply else "audit",
        "summary": {},
        "files": [],
        "created_files": [],
        "backups": [],
        "link_issues": [],
        "tool_checks": [],
        "errors": [],
        "warnings": [],
    }

    scanned = 0
    empty_count = 0
    suspicious_count = 0
    syntax_error_count = 0
    modified_count = 0

    # Only create predictable repository-level support files.
    for relative, content in create_default_files(root).items():
        destination = root / relative

        if destination.exists():
            continue

        if args.apply:
            try:
                atomic_write(destination, content)
                report["created_files"].append(relative)
                modified_count += 1
                print(f"CREATED  {relative}")
            except OSError as exc:
                report["errors"].append({
                    "file": relative,
                    "error": str(exc),
                })
        else:
            report["warnings"].append(
                f"Missing recommended file: {relative} (use --apply to create)"
            )

    for directory, dirnames, filenames in os.walk(root):
        current = Path(directory)

        dirnames[:] = sorted(
            name for name in dirnames
            if name not in IGNORED_DIRS
            and not name.startswith(".repository-completer-backups")
        )

        for filename in sorted(filenames):
            path = current / filename

            if is_ignored(path, root):
                continue

            if path.name == Path(args.report).name:
                continue

            if not is_probably_text(path):
                continue

            scanned += 1
            relative = path.relative_to(root).as_posix()
            entry: dict[str, Any] = {
                "path": relative,
                "kind": classify_file(path, root),
                "size_bytes": None,
                "sha256": None,
                "findings": [],
                "validation_errors": [],
                "action": "none",
            }

            try:
                stat = path.stat()
                entry["size_bytes"] = stat.st_size
                entry["sha256"] = sha256_file(path)
                content = read_text(path)
            except (OSError, UnicodeError, SyntaxError) as exc:
                entry["findings"].append("read_error")
                entry["validation_errors"].append(str(exc))
                report["files"].append(entry)
                report["errors"].append({
                    "file": relative,
                    "error": str(exc),
                })
                continue

            findings = detect_suspicious_content(path, content)
            entry["findings"] = findings

            if "empty_file" in findings:
                empty_count += 1
            if findings:
                suspicious_count += 1

            validation_errors = validate_content(path, content)
            entry["validation_errors"] = validation_errors

            if validation_errors:
                syntax_error_count += 1

            # Safe repair: known repository support files only.
            # Never replace an existing implementation with guessed code.
            if args.apply and not content.strip() and path.name in SAFE_PLACEHOLDERS:
                try:
                    backup = backup_file(path, root)
                    report["backups"].append(str(backup.relative_to(root)))
                    atomic_write(path, SAFE_PLACEHOLDERS[path.name])
                    entry["action"] = "filled_known_support_file"
                    modified_count += 1
                    print(f"REPAIRED {relative}")
                except OSError as exc:
                    report["errors"].append({
                        "file": relative,
                        "error": str(exc),
                    })

            elif "empty_file" in findings:
                entry["action"] = (
                    "review_required"
                    if not args.apply
                    else "preserved_empty_file_requires_design"
                )

            elif validation_errors:
                entry["action"] = "syntax_or_format_fix_required"

            elif findings:
                entry["action"] = "review_required"

            report["files"].append(entry)

            if path.suffix.lower() in {".html", ".htm"}:
                report["link_issues"].extend(
                    check_internal_html_links(root, path)
                )

    if args.validate_python:
        python_files = [
            item["path"] for item in report["files"]
            if item["path"].endswith(".py")
        ]

        for relative in python_files:
            result = run_optional_tool(
                [sys.executable, "-m", "py_compile", str(root / relative)],
                root,
                timeout=30,
            )
            result["file"] = relative
            report["tool_checks"].append(result)

    report["finished_at"] = utc_now()
    report["summary"] = {
        "scanned_text_files": scanned,
        "empty_files_detected": empty_count,
        "files_with_findings": suspicious_count,
        "files_with_validation_errors": syntax_error_count,
        "modified_or_created_files": modified_count,
        "missing_internal_links": len(report["link_issues"]),
        "errors": len(report["errors"]),
        "warnings": len(report["warnings"]),
    }

    report_path = Path(args.report)
    if not report_path.is_absolute():
        report_path = root / report_path

    try:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    except OSError as exc:
        print(f"ERROR: Could not write report: {exc}", file=sys.stderr)
        return 2

    print("\n=== MedOrbits Repository Audit ===")
    print(f"Root:             {root}")
    print(f"Text files:       {scanned}")
    print(f"Empty files:      {empty_count}")
    print(f"Files with flags: {suspicious_count}")
    print(f"Validation errors:{syntax_error_count}")
    print(f"Internal links:   {len(report['link_issues'])}")
    print(f"Changed files:    {modified_count}")
    print(f"Report:           {report_path}")

    remaining_issues = (
        empty_count
        + syntax_error_count
        + len(report["link_issues"])
        + len(report["errors"])
    )

    if args.strict and remaining_issues:
        return 1

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        raise SystemExit(130)
    except Exception:
        print("FATAL: Unexpected repository-completer error.", file=sys.stderr)
        traceback.print_exc()
        raise SystemExit(2)
