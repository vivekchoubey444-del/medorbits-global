
#!/usr/bin/env python3
“””
===============================================================================
MedOrbits Repository Completer
File: tools/repository_completer.py
Version: 2.0.0
Python: 3.10+

PURPOSE
    Audit repository completeness and apply a limited set of safe repairs.

FEATURES
    - Inventory of repository text files.
    - Detection of empty and suspiciously small files.
    - Detection of TODOs, placeholders and merge conflict markers.
    - Python, JSON, TOML and optional YAML validation.
    - JavaScript syntax validation when Node.js is available.
    - Shell syntax validation when Bash is available.
    - XML validation and HTML structural parsing.
    - Internal HTML reference checking.
    - Safe creation of root-level README.md, .gitignore and .editorconfig.
    - Backups before modifying existing support files.
    - Atomic file replacement.
    - JSON audit report.
    - Audit-only, apply and strict modes.

SAFETY
    - Does not invent application business logic.
    - Does not execute application scripts.
    - Does not install dependencies.
    - Does not modify package.json or lockfiles.
    - Does not follow symbolic links during repository scanning.
    - Does not overwrite existing non-empty support files.
    - Does not write reports outside the repository.
    - Does not compile Python files to bytecode.

USAGE
    python tools/repository_completer.py
    python tools/repository_completer.py —root .
    python tools/repository_completer.py —apply
    python tools/repository_completer.py —strict
    python tools/repository_completer.py —validate-python
    python tools/repository_completer.py —dry-run
===============================================================================
“””

from __future__ import annotations

import argparse
import ast
import csv
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit


VERSION = “2.0.0”

MAX_FILE_BYTES = 5 * 1024 * 1024

IGNORED_DIRS = {
    “.git”,
    “.hg”,
    “.svn”,
    “.venv”,
    “venv”,
    “env”,
    “node_modules”,
    “__pycache__”,
    “.pytest_cache”,
    “.mypy_cache”,
    “.ruff_cache”,
    “.tox”,
    “dist”,
    “build”,
    “coverage”,
    “.next”,
    “.nuxt”,
    “target”,
    “vendor”,
    “.idea”,
    “.vscode”,
    “site-packages”,
    “.repository-completer-backups”,
    “repository-reports”,
}

IGNORED_SUFFIXES = {
    “.pyc”,
    “.pyo”,
    “.so”,
    “.dll”,
    “.dylib”,
    “.exe”,
    “.class”,
    “.jar”,
    “.zip”,
    “.gz”,
    “.tar”,
    “.rar”,
    “.7z”,
    “.pdf”,
    “.png”,
    “.jpg”,
    “.jpeg”,
    “.gif”,
    “.webp”,
    “.ico”,
    “.woff”,
    “.woff2”,
    “.ttf”,
    “.otf”,
    “.mp3”,
    “.mp4”,
    “.mov”,
    “.sqlite”,
    “.db”,
}

TEXT_SUFFIXES = {
    “.py”, “.pyi”,
    “.js”, “.mjs”, “.cjs”, “.jsx”,
    “.ts”, “.tsx”,
    “.html”, “.htm”,
    “.css”, “.scss”, “.sass”, “.less”,
    “.json”, “.toml”, “.yaml”, “.yml”,
    “.xml”, “.svg”,
    “.md”, “.rst”, “.txt”,
    “.sh”, “.bash”, “.ps1”, “.bat”, “.cmd”,
    “.sql”, “.ini”, “.cfg”, “.conf”,
    “.sample”, “.properties”, “.graphql”, “.proto”,
}

SPECIAL_TEXT_FILES = {
    “license”,
    “licence”,
    “makefile”,
    “dockerfile”,
    “procfile”,
    “justfile”,
    “gemfile”,
    “rakefile”,
    “.gitignore”,
    “.gitattributes”,
    “.editorconfig”,
    “.dockerignore”,
    “.npmrc”,
    “.nvmrc”,
}

SAFE_DEFAULTS = {
    “.gitignore”: “””# Python
__pycache__/
*.py[cod]
.pytest_cache/
.mypy_cache/
.ruff_cache/
.coverage
htmlcov/

# Virtual environments
.venv/
venv/
env/

# Secrets and local configuration
.env
.env.*
!.env.example
!.env.sample

# Node.js
node_modules/

# Build outputs
build/
dist/
*.egg-info/

# Logs and temporary files
*.log
*.tmp
*.bak

# Operating system and editors
.DS_Store
Thumbs.db
.idea/
.vscode/
“””,
    “.editorconfig”: “””root = true

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
“””,
}

DEFAULT_README = “””# MedOrbits

MedOrbits is an education, medical admissions, career guidance,
recruitment and consultancy platform.

## Repository maintenance

- Keep credentials and private data out of version control.
- Preserve existing application architecture and API contracts.
- Document configuration and environment variables.
- Validate changes before deployment.
- Review generated reports before applying changes.

## Validation

Run the repository’s configured validation and test commands
before deploying changes.
“””


# =============================================================================
# REPORT MODEL
# =============================================================================

class AuditReport:

    def __init__(self, root: Path, mode: str) -> None:
        self.data: dict[str, Any] = {
            “tool”: “MedOrbits Repository Completer”,
            “version”: VERSION,
            “root”: str(root),
            “started_at”: self.now(),
            “mode”: mode,
            “summary”: {},
            “files”: [],
            “created_files”: [],
            “modified_files”: [],
            “backups”: [],
            “link_issues”: [],
            “validation_skips”: [],
            “errors”: [],
            “warnings”: [],
        }

    @staticmethod
    def now() -> str:
        return dt.datetime.now(dt.timezone.utc).isoformat()

    def finish(self) -> None:
        self.data[“finished_at”] = self.now()


# =============================================================================
# FILESYSTEM SAFETY
# =============================================================================

def reject_symlink(path: Path) -> None:
    try:
        metadata = path.lstat()
    except FileNotFoundError:
        return

    if stat.S_ISLNK(metadata.st_mode):
        raise ValueError(f”Symbolic link is not permitted: {path}”)


def verify_regular_file(path: Path) -> bool:
    try:
        metadata = path.lstat()
    except FileNotFoundError:
        return False

    if stat.S_ISLNK(metadata.st_mode):
        raise ValueError(f”Symbolic-link file rejected: {path}”)

    if not stat.S_ISREG(metadata.st_mode):
        raise ValueError(f”Not a regular file: {path}”)

    return True


def verify_directory_path(root: Path, directory: Path) -> None:
    try:
        relative = directory.relative_to(root)
    except ValueError as exc:
        raise ValueError(
            f”Directory is outside repository: {directory}”
        ) from exc

    current = root

    for part in relative.parts:
        current = current / part

        try:
            metadata = current.lstat()
        except FileNotFoundError:
            continue

        if stat.S_ISLNK(metadata.st_mode):
            raise ValueError(
                f”Symbolic-link directory component rejected: {current}”
            )

        if not stat.S_ISDIR(metadata.st_mode):
            raise ValueError(
                f”Directory component is not a directory: {current}”
            )


def resolve_root(value: str) -> Path:
    root = Path(value).expanduser().resolve(strict=True)

    if not root.is_dir():
        raise ValueError(f”Repository root is not a directory: {root}”)

    return root


def relative_path(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


# =============================================================================
# FILE CLASSIFICATION
# =============================================================================

def is_ignored(path: Path, root: Path) -> bool:
    try:
        relative = path.relative_to(root)
    except ValueError:
        return True

    if any(part in IGNORED_DIRS for part in relative.parts):
        return True

    if path.suffix.lower() in IGNORED_SUFFIXES:
        return True

    return False


def is_text_file(path: Path) -> bool:
    name = path.name.lower()

    if name in SPECIAL_TEXT_FILES:
        return True

    if name.endswith((“.env.example”, “.env.sample”)):
        return True

    return path.suffix.lower() in TEXT_SUFFIXES


def classify_file(path: Path, root: Path) -> str:
    relative = relative_path(path, root)
    name = path.name.lower()
    suffix = path.suffix.lower()

    if relative.startswith(“.github/workflows/“):
        return “workflow”

    if name == “package.json”:
        return “node-manifest”

    if name == “pyproject.toml”:
        return “python-manifest”

    if name.startswith(“readme”):
        return “documentation”

    if name in {“license”, “licence”}:
        return “license”

    categories = {
        “.py”: “python”,
        “.pyi”: “python-stub”,
        “.json”: “json”,
        “.toml”: “toml”,
        “.yaml”: “yaml”,
        “.yml”: “yaml”,
        “.js”: “javascript”,
        “.mjs”: “javascript”,
        “.cjs”: “javascript”,
        “.jsx”: “javascript”,
        “.ts”: “typescript”,
        “.tsx”: “typescript”,
        “.html”: “html”,
        “.htm”: “html”,
        “.css”: “stylesheet”,
        “.scss”: “stylesheet”,
        “.sass”: “stylesheet”,
        “.less”: “stylesheet”,
        “.xml”: “xml”,
        “.svg”: “svg”,
        “.sh”: “shell”,
        “.bash”: “shell”,
        “.sql”: “sql”,
        “.md”: “markdown”,
        “.rst”: “documentation”,
    }

    return categories.get(suffix, “text”)


# =============================================================================
# FILE READING AND HASHING
# =============================================================================

def read_text(path: Path) -> str:
    if not verify_regular_file(path):
        raise ValueError(f”Not a regular file: {path}”)

    if path.stat().st_size > MAX_FILE_BYTES:
        raise ValueError(
            f”File exceeds {MAX_FILE_BYTES} byte scan limit.”
        )

    return path.read_text(
        encoding=“utf-8-sig”,
        errors=“strict”,
    )


def sha256_file(path: Path) -> str:
    if not verify_regular_file(path):
        raise ValueError(f”Not a regular file: {path}”)

    digest = hashlib.sha256()

    with path.open(“rb”) as stream:
        for chunk in iter(
            lambda: stream.read(1024 * 1024),
            b””,
        ):
            digest.update(chunk)

    return digest.hexdigest()


# =============================================================================
# DISCOVERY
# =============================================================================

def discover_files(
    root: Path,
    report_path: Path,
    report: AuditReport,
) -> list[Path]:

    discovered: list[Path] = []

    try:
        report_relative = report_path.relative_to(root)
    except ValueError:
        raise ValueError(“Report path must be inside repository.”)

    def on_error(exc: OSError) -> None:
        report.data[“warnings”].append({
            “category”: “filesystem”,
            “path”: str(exc.filename or “”),
            “message”: str(exc),
        })

    for current, directories, filenames in os.walk(
        root,
        topdown=True,
        followlinks=False,
        onerror=on_error,
    ):
        current_path = Path(current)

        filtered = []

        for directory in directories:
            if directory in IGNORED_DIRS:
                continue

            candidate = current_path / directory

            try:
                metadata = candidate.lstat()
            except OSError as exc:
                report.data[“warnings”].append({
                    “category”: “filesystem”,
                    “path”: str(candidate),
                    “message”: str(exc),
                })
                continue

            if stat.S_ISLNK(metadata.st_mode):
                report.data[“warnings”].append({
                    “category”: “symlink”,
                    “path”: relative_path(candidate, root),
                    “message”: “Symbolic-link directory skipped.”,
                })
                continue

            if stat.S_ISDIR(metadata.st_mode):
                filtered.append(directory)

        directories[:] = filtered

        for filename in filenames:
            path = current_path / filename

            if is_ignored(path, root):
                continue

            if path == report_path or path == report_relative:
                continue

            try:
                metadata = path.lstat()
            except OSError as exc:
                report.data[“warnings”].append({
                    “category”: “filesystem”,
                    “path”: str(path),
                    “message”: str(exc),
                })
                continue

            if stat.S_ISLNK(metadata.st_mode):
                report.data[“warnings”].append({
                    “category”: “symlink”,
                    “path”: relative_path(path, root),
                    “message”: “Symbolic-link file skipped.”,
                })
                continue

            if not stat.S_ISREG(metadata.st_mode):
                continue

            if is_text_file(path):
                discovered.append(path)

    return sorted(
        discovered,
        key=lambda item: item.as_posix().lower(),
    )


# =============================================================================
# SUSPICIOUS CONTENT
# =============================================================================

def detect_suspicious_content(
    path: Path,
    content: str,
    size: int,
) -> list[str]:

    findings: list[str] = []
    stripped = content.strip()
    suffix = path.suffix.lower()

    if not stripped:
        findings.append(“empty_file”)
        return findings

    if size <= 16 and suffix in {
        “.py”, “.js”, “.mjs”, “.cjs”, “.ts”, “.tsx”,
        “.html”, “.css”, “.json”, “.yaml”, “.yml”,
    }:
        findings.append(“suspiciously_small_file”)

    if stripped in {
        “TODO”,
        “FIXME”,
        “PLACEHOLDER”,
        “IMPLEMENT ME”,
        “IMPLEMENT_ME”,
        “pass”,
        “...”,
        “// TODO”,
        “/* TODO */“,
        “# TODO”,
    }:
        findings.append(“placeholder_only”)

    if re.search(
        r”(?m)^\s*(?:<<<<<<<|=======|>>>>>>>)”,
        content,
    ):
        findings.append(“merge_conflict_marker”)

    if re.search(
        r”(?im)^\s*(?:TODO|FIXME|IMPLEMENT\s+ME|IMPLEMENT_ME)\b”,
        content,
    ):
        findings.append(“todo_marker”)

    if suffix in {“.py”, “.pyi”}:
        try:
            tree = ast.parse(content, filename=str(path))
        except SyntaxError:
            pass
        else:
            body = list(tree.body)

            # Ignore a module docstring when checking for implementation.
            if (
                body
                and isinstance(body[0], ast.Expr)
                and isinstance(body[0].value, ast.Constant)
                and isinstance(body[0].value.value, str)
            ):
                body = body[1:]

            if not body or all(
                isinstance(node, ast.Pass)
                for node in body
            ):
                findings.append(
                    “python_module_without_implementation”
                )

    if suffix in {“.html”, “.htm”}:
        if re.search(
            r”<script\b[^>]*>\s*</script\s*>”,
            content,
            re.IGNORECASE,
        ):
            findings.append(“empty_script_element”)

        if re.search(
            r”<style\b[^>]*>\s*</style\s*>”,
            content,
            re.IGNORECASE,
        ):
            findings.append(“empty_style_element”)

    if suffix in {“.js”, “.mjs”, “.cjs”, “.ts”, “.tsx”}:
        if re.search(
            r”(?m)^\s*(?:export\s+)?function\s+\w+\s*”
            r”\([^)]*\)\s*\{\s*\}”,
            content,
        ):
            findings.append(“empty_function_body”)

    return findings


# =============================================================================
# VALIDATION
# =============================================================================

def validate_python(content: str, filename: str) -> list[str]:
    try:
        ast.parse(content, filename=filename)
        return []
    except SyntaxError as exc:
        return [
            f”Python syntax error at line {exc.lineno}: {exc.msg}”
        ]


def validate_json(content: str) -> list[str]:
    try:
        json.loads(content)
        return []
    except json.JSONDecodeError as exc:
        return [
            f”JSON error at line {exc.lineno}, “
            f”column {exc.colno}: {exc.msg}”
        ]


def validate_toml(content: str) -> list[str]:
    try:
        import tomllib
    except ImportError:
        try:
            import tomli
        except ImportError:
            return [
                “TOML validation skipped: install tomli for Python 3.10.”
            ]
        parser = tomli
    else:
        parser = tomllib

    try:
        parser.loads(content)
        return []
    except Exception as exc:
        return [f”TOML parsing error: {exc}”]


def validate_yaml(content: str) -> list[str]:
    try:
        import yaml
    except ImportError:
        return [
            “YAML validation skipped: PyYAML is not installed.”
        ]

    try:
        yaml.safe_load(content)
        return []
    except Exception as exc:
        return [f”YAML parsing error: {exc}”]


class HTMLStructureParser(HTMLParser):
    “””Checks HTML parser-level syntax; not a full HTML conformance validator.”””

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.errors: list[str] = []

    def unknown_decl(self, data: str) -> None:
        self.errors.append(
            f”Unrecognized declaration: {data[:100]}”
        )


def validate_html(content: str) -> list[str]:
    parser = HTMLStructureParser()

    try:
        parser.feed(content)
        parser.close()
    except Exception as exc:
        return [f”HTML parsing error: {exc}”]

    return parser.errors


def validate_xml(content: str) -> list[str]:
    try:
        ET.fromstring(content)
        return []
    except ET.ParseError as exc:
        return [f”XML parsing error: {exc}”]


def run_syntax_check(
    command: list[str],
    root: Path,
    relative: str,
) -> dict[str, Any]:

    executable = shutil.which(command[0])

    if executable is None:
        return {
            “file”: relative,
            “status”: “skipped”,
            “message”: f”{command[0]} is not installed.”,
        }

    try:
        result = subprocess.run(
            [executable, *command[1:]],
            cwd=root,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )

        return {
            “file”: relative,
            “status”: “passed” if result.returncode == 0 else “failed”,
            “returncode”: result.returncode,
            “stdout”: result.stdout[-2000:],
            “stderr”: result.stderr[-2000:],
        }

    except subprocess.TimeoutExpired:
        return {
            “file”: relative,
            “status”: “timeout”,
            “message”: “Syntax check exceeded 30 seconds.”,
        }

    except OSError as exc:
        return {
            “file”: relative,
            “status”: “error”,
            “message”: str(exc),
        }


def validate_file(
    path: Path,
    root: Path,
    content: str,
    validate_python_flag: bool,
) -> tuple[list[str], list[dict[str, Any]]]:

    suffix = path.suffix.lower()
    relative = relative_path(path, root)

    errors: list[str] = []
    tool_checks: list[dict[str, Any]] = []

    if suffix in {“.py”, “.pyi”}:
        errors.extend(validate_python(content, relative))

    elif suffix == “.json”:
        errors.extend(validate_json(content))

    elif suffix == “.toml”:
        errors.extend(validate_toml(content))

    elif suffix in {“.yaml”, “.yml”}:
        errors.extend(validate_yaml(content))

    elif suffix in {“.html”, “.htm”}:
        errors.extend(validate_html(content))

    elif suffix in {“.xml”, “.svg”}:
        errors.extend(validate_xml(content))

    elif suffix in {“.js”, “.mjs”, “.cjs”}:
        tool_checks.append(
            run_syntax_check(
                [“node”, “—check”, str(path)],
                root,
                relative,
            )
        )

    elif suffix in {“.sh”, “.bash”}:
        tool_checks.append(
            run_syntax_check(
                [“bash”, “-n”, str(path)],
                root,
                relative,
            )
        )

    elif suffix in {“.ps1”}:
        tool_checks.append({
            “file”: relative,
            “status”: “skipped”,
            “message”: “PowerShell syntax validation is not configured.”,
        })

    if validate_python_flag and suffix in {“.py”, “.pyi”}:
        # AST parsing above validates syntax without generating .pyc files.
        tool_checks.append({
            “file”: relative,
            “status”: “passed” if not errors else “failed”,
            “message”: “Python AST validation.”,
        })

    return errors, tool_checks


# =============================================================================
# HTML INTERNAL REFERENCES
# =============================================================================

class HTMLLinkParser(HTMLParser):

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, int]] = []

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:

        line = self.getpos()[0]

        for attribute, value in attrs:
            if attribute.lower() in {“href”, “src”, “action”, “poster”}:
                if value:
                    self.links.append((value.strip(), line))


def check_internal_html_links(
    root: Path,
    html_path: Path,
) -> list[dict[str, Any]]:

    issues: list[dict[str, Any]] = []

    try:
        content = read_text(html_path)
    except (OSError, UnicodeError, ValueError):
        return issues

    parser = HTMLLinkParser()

    try:
        parser.feed(content)
        parser.close()
    except Exception:
        return issues

    for target, line in parser.links:
        if not target:
            continue

        if target.startswith((
            “#”,
            “?”,
            “//“,
            “http://“,
            “https://“,
            “mailto:”,
            “tel:”,
            “data:”,
            “blob:”,
            “javascript:”,
        )):
            continue

        try:
            parsed = urlsplit(target)
        except ValueError:
            issues.append({
                “file”: relative_path(html_path, root),
                “target”: target,
                “line”: line,
                “problem”: “invalid_url”,
            })
            continue

        if parsed.scheme or parsed.netloc:
            continue

        local_target = unquote(parsed.path)

        if not local_target:
            continue

        if “\\” in local_target or “\x00” in local_target:
            issues.append({
                “file”: relative_path(html_path, root),
                “target”: target,
                “line”: line,
                “problem”: “unsafe_reference”,
            })
            continue

        if local_target.startswith(“/“):
            candidate = root / local_target.lstrip(“/“)
        else:
            candidate = html_path.parent / local_target

        try:
            resolved = candidate.resolve(strict=False)
            resolved.relative_to(root)
        except (OSError, ValueError, RuntimeError):
            issues.append({
                “file”: relative_path(html_path, root),
                “target”: target,
                “line”: line,
                “problem”: “reference_outside_repository”,
            })
            continue

        if not resolved.exists():
            issues.append({
                “file”: relative_path(html_path, root),
                “target”: target,
                “line”: line,
                “problem”: “missing_internal_reference”,
            })
            continue

        # Do not silently accept a symlinked target.
        try:
            relative = resolved.relative_to(root)

            current = root
            symlink_found = False

            for part in relative.parts:
                current = current / part

                try:
                    if stat.S_ISLNK(current.lstat().st_mode):
                        symlink_found = True
                        break
                except FileNotFoundError:
                    break

            if symlink_found:
                issues.append({
                    “file”: relative_path(html_path, root),
                    “target”: target,
                    “line”: line,
                    “problem”: “symlink_reference”,
                })

        except OSError:
            pass

    return issues


# =============================================================================
# BACKUPS AND ATOMIC WRITES
# =============================================================================

def backup_file(path: Path, root: Path) -> Path:
    if not verify_regular_file(path):
        raise ValueError(f”Cannot back up non-regular file: {path}”)

    backup_root = root / “.repository-completer-backups”

    verify_directory_path(root, backup_root)
    backup_root.mkdir(parents=True, exist_ok=True)

    relative = path.relative_to(root)
    destination_dir = backup_root / relative.parent

    verify_directory_path(root, destination_dir)
    destination_dir.mkdir(parents=True, exist_ok=True)

    verify_directory_path(root, destination_dir)

    base = destination_dir / f”{path.name}.{dt.datetime.now().strftime(‘%Y%m%d-%H%M%S-%f’)}.bak”

    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL

    if hasattr(os, “O_NOFOLLOW”):
        flags |= os.O_NOFOLLOW

    descriptor = os.open(base, flags, 0o600)

    try:
        source_flags = os.O_RDONLY

        if hasattr(os, “O_NOFOLLOW”):
            source_flags |= os.O_NOFOLLOW

        source_descriptor = os.open(path, source_flags)

        with os.fdopen(source_descriptor, “rb”) as source:
            with os.fdopen(descriptor, “wb”) as target:
                descriptor = -1

                shutil.copyfileobj(source, target)
                target.flush()
                os.fsync(target.fileno())

    except Exception:
        if descriptor >= 0:
            os.close(descriptor)

        try:
            base.unlink()
        except OSError:
            pass

        raise

    return base


def atomic_write(
    path: Path,
    content: str,
    root: Path,
) -> None:

    try:
        path.relative_to(root)
    except ValueError as exc:
        raise ValueError(
            f”Refusing to write outside repository: {path}”
        ) from exc

    verify_directory_path(root, path.parent)

    if path.parent.exists():
        path_parent = path.parent.resolve(strict=True)
        path_parent.relative_to(root)

    verify_regular_file(path) if path.exists() else reject_symlink(path)

    path.parent.mkdir(parents=True, exist_ok=True)
    verify_directory_path(root, path.parent)

    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f”.{path.name}.”,
        suffix=“.tmp”,
        dir=str(path.parent),
    )

    temporary = Path(temporary_name)

    try:
        with os.fdopen(
            descriptor,
            “w”,
            encoding=“utf-8”,
            newline=“\n”,
        ) as stream:
            stream.write(content)

            if content and not content.endswith(“\n”):
                stream.write(“\n”)

            stream.flush()
            os.fsync(stream.fileno())

        # Refuse a symlink that appeared before replacement.
        reject_symlink(path)

        os.replace(temporary, path)

    finally:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass


# =============================================================================
# DEFAULT FILES
# =============================================================================

def create_default_files(root: Path) -> dict[str, str]:
    defaults = dict(SAFE_DEFAULTS)

    readme = root / “README.md”

    if not readme.exists():
        defaults[“README.md”] = DEFAULT_README

    return defaults


def apply_default_files(
    root: Path,
    report: AuditReport,
    dry_run: bool,
) -> int:

    changed = 0

    for relative, content in create_default_files(root).items():
        destination = root / relative

        try:
            reject_symlink(destination)

            if destination.exists():
                if not destination.is_file():
                    report.data[“errors”].append({
                        “file”: relative,
                        “error”: “Expected a regular file.”,
                    })
                    continue

                if destination.stat().st_size > 0:
                    continue

                if relative == “README.md”:
                    # Do not invent README content for an existing blank file.
                    report.data[“warnings”].append({
                        “file”: relative,
                        “message”: “Existing empty README preserved for review.”,
                    })
                    continue

                if dry_run:
                    report.data[“modified_files”].append({
                        “file”: relative,
                        “action”: “would_fill_empty_support_file”,
                    })
                    changed += 1
                    continue

                backup = backup_file(destination, root)

                report.data[“backups”].append(
                    relative_path(backup, root)
                )

                atomic_write(destination, content, root)

                report.data[“modified_files”].append({
                    “file”: relative,
                    “action”: “filled_empty_support_file”,
                })

                changed += 1
                print(f”REPAIRED {relative}”)
                continue

            if dry_run:
                report.data[“created_files”].append({
                    “file”: relative,
                    “action”: “would_create”,
                })
                changed += 1
                continue

            atomic_write(destination, content, root)

            report.data[“created_files”].append({
                “file”: relative,
                “action”: “created”,
            })

            changed += 1
            print(f”CREATED  {relative}”)

        except (OSError, ValueError) as exc:
            report.data[“errors”].append({
                “file”: relative,
                “error”: str(exc),
            })

    return changed


# =============================================================================
# REPORT WRITING
# =============================================================================

def write_report(
    root: Path,
    report_path: Path,
    report: AuditReport,
) -> None:

    try:
        report_path.relative_to(root)
    except ValueError as exc:
        raise ValueError(
            “Report path must remain inside the repository.”
        ) from exc

    verify_directory_path(root, report_path.parent)

    if report_path.exists():
        verify_regular_file(report_path)
    else:
        reject_symlink(report_path)

    content = json.dumps(
        report.data,
        indent=2,
        ensure_ascii=False,
    ) + “\n”

    atomic_write(report_path, content, root)


# =============================================================================
# AUDIT
# =============================================================================

def audit_repository(
    root: Path,
    report: AuditReport,
    report_path: Path,
    validate_python_flag: bool,
) -> None:

    files = discover_files(root, report_path, report)

    for path in files:
        relative = relative_path(path, root)

        entry: dict[str, Any] = {
            “path”: relative,
            “kind”: classify_file(path, root),
            “size_bytes”: None,
            “sha256”: None,
            “findings”: [],
            “validation_errors”: [],
            “action”: “none”,
        }

        try:
            metadata = path.lstat()

            if not stat.S_ISREG(metadata.st_mode):
                continue

            if metadata.st_size > MAX_FILE_BYTES:
                entry[“findings”].append(“file_too_large”)
                entry[“size_bytes”] = metadata.st_size
                report.data[“files”].append(entry)
                continue

            content = read_text(path)

            entry[“size_bytes”] = metadata.st_size
            entry[“sha256”] = sha256_file(path)

        except (OSError, UnicodeError, ValueError) as exc:
            entry[“findings”].append(“read_error”)
            entry[“validation_errors”].append(str(exc))

            report.data[“errors”].append({
                “file”: relative,
                “error”: str(exc),
            })

            report.data[“files”].append(entry)
            continue

        findings = detect_suspicious_content(
            path,
            content,
            metadata.st_size,
        )

        entry[“findings”] = findings

        validation_errors, tool_checks = validate_file(
            path,
            root,
            content,
            validate_python_flag,
        )

        entry[“validation_errors”] = validation_errors

        if tool_checks:
            report.data[“validation_skips”].extend(
                item for item in tool_checks
                if item[“status”] in {“skipped”, “timeout”, “error”}
            )

            for check in tool_checks:
                if check[“status”] == “failed”:
                    entry[“validation_errors”].append(
                        check.get(“stderr”, “External syntax check failed.”)
                    )

        if “empty_file” in findings:
            entry[“action”] = “review_required”

        elif validation_errors:
            entry[“action”] = “syntax_or_format_fix_required”

        elif findings:
            entry[“action”] = “review_required”

        report.data[“files”].append(entry)

        if path.suffix.lower() in {“.html”, “.htm”}:
            report.data[“link_issues”].extend(
                check_internal_html_links(root, path)
            )


# =============================================================================
# SUMMARY
# =============================================================================

def build_summary(
    report: AuditReport,
    modified_count: int,
) -> None:

    files = report.data[“files”]

    empty_files = sum(
        “empty_file” in item[“findings”]
        for item in files
    )

    suspicious_files = sum(
        bool(item[“findings”])
        for item in files
    )

    validation_errors = sum(
        len(item[“validation_errors”])
        for item in files
    )

    report.data[“summary”] = {
        “scanned_text_files”: len(files),
        “empty_files_detected”: empty_files,
        “files_with_findings”: suspicious_files,
        “validation_errors”: validation_errors,
        “missing_or_unsafe_internal_links”: len(
            report.data[“link_issues”]
        ),
        “created_files”: len(report.data[“created_files”]),
        “modified_files”: len(report.data[“modified_files”]),
        “backups_created”: len(report.data[“backups”]),
        “files_changed_or_planned”: modified_count,
        “errors”: len(report.data[“errors”]),
        “warnings”: len(report.data[“warnings”]),
    }


# =============================================================================
# CLI
# =============================================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=“Audit and safely complete a MedOrbits repository.”
    )

    parser.add_argument(
        “—root”,
        default=“.”,
        help=“Repository root directory.”,
    )

    parser.add_argument(
        “—apply”,
        action=“store_true”,
        help=“Apply supported deterministic repairs.”,
    )

    parser.add_argument(
        “—dry-run”,
        action=“store_true”,
        help=“Preview repairs without modifying source files.”,
    )

    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=“Return a nonzero exit code when audit issues remain.”,
    )

    parser.add_argument(
        “—report”,
        default=“repository-completer-report.json”,
        help=“Report path relative to repository root.”,
    )

    parser.add_argument(
        “—validate-python”,
        action=“store_true”,
        help=“Include explicit Python AST validation status.”,
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.apply and args.dry_run:
        print(
            “ERROR: Choose either —apply or —dry-run, not both.”,
            file=sys.stderr,
        )
        return 2

    try:
        root = resolve_root(args.root)

        report_path = Path(args.report)

        if not report_path.is_absolute():
            report_path = root / report_path
        else:
            report_path = report_path.resolve(strict=False)

        try:
            report_path.relative_to(root)
        except ValueError:
            raise ValueError(
                “Report output must be inside the repository.”
            )

        mode = (
            “apply”
            if args.apply
            else “dry-run”
            if args.dry_run
            else “audit”
        )

        report = AuditReport(root, mode)

        print(“MedOrbits Repository Completer”)
        print(“=“ * 48)
        print(f”Version: {VERSION}”)
        print(f”Root:    {root}”)
        print(f”Mode:    {mode}”)

        planned_changes = 0

        if args.apply or args.dry_run:
            planned_changes = apply_default_files(
                root,
                report,
                dry_run=args.dry_run,
            )

        audit_repository(
            root,
            report,
            report_path,
            args.validate_python,
        )

        report.finish()

        build_summary(
            report,
            planned_changes,
        )

        if not args.dry_run:
            write_report(
                root,
                report_path,
                report,
            )

        summary = report.data[“summary”]

        print(“\nRepository audit summary”)
        print(“-“ * 48)
        print(f”Text files scanned:    {summary[‘scanned_text_files’]}”)
        print(f”Empty files:           {summary[‘empty_files_detected’]}”)
        print(f”Files with findings:   {summary[‘files_with_findings’]}”)
        print(f”Validation errors:     {summary[‘validation_errors’]}”)
        print(f”Internal link issues:  {summary[‘missing_or_unsafe_internal_links’]}”)
        print(f”Files changed/planned: {planned_changes}”)
        print(f”Errors:                {summary[‘errors’]}”)
        print(f”Warnings:              {summary[‘warnings’]}”)

        if args.dry_run:
            print(“\nDRY-RUN: No files were modified.”)
            print(“No report was written.”)
        else:
            print(f”\nReport: {report_path}”)

        print(“\nAutomatic repair policy:”)
        print(“- Missing root support files may be created.”)
        print(“- Empty root .gitignore and .editorconfig may be backed up and filled.”)
        print(“- Existing application source files are never automatically rewritten.”)
        print(“- Uncertain issues are reported for manual review.”)

        strict_failure = (
            summary[“empty_files_detected”]
            or summary[“validation_errors”]
            or summary[“missing_or_unsafe_internal_links”]
            or summary[“errors”]
        )

        if args.strict and strict_failure:
            print(“\nSTRICT AUDIT FAILED.”)
            return 1

        print(“\nRepository completer finished.”)
        return 0

    except KeyboardInterrupt:
        print(“\nInterrupted.”, file=sys.stderr)
        return 130

    except (OSError, ValueError, RuntimeError) as exc:
        print(
            f”ERROR: {exc}”,
            file=sys.stderr,
        )
        return 2


if __name__ == “__main__”:
    raise SystemExit(main())
