#!/usr/bin/env python3
“””
MedOrbits — Repository Structure and Integrity Validator
File: .github/scripts/validate-repository.py
Version: 2.0.0

Purpose:
    Validate repository structure and common project integrity issues.

Checks:
    - Repository root and expected directories.
    - Required and important project files.
    - JSON syntax, UTF-8 encoding and duplicate object keys.
    - Python syntax without executing application code.
    - GitHub Actions workflow structure.
    - Node.js package manifest structure.
    - Environment template formatting.
    - .gitignore hygiene.
    - Optional common secret-pattern scanning.
    - Optional machine-readable JSON report.

Safety:
    - Read-only for repository source files.
    - Uses Python standard library only.
    - Does not install dependencies.
    - Does not execute application code.
    - Does not follow directory symlinks.
    - Excludes generated and dependency directories.

Requirements:
    Python >= 3.10

Usage:
    python .github/scripts/validate-repository.py
    python .github/scripts/validate-repository.py —strict
    python .github/scripts/validate-repository.py —root .
    python .github/scripts/validate-repository.py —skip-python
    python .github/scripts/validate-repository.py —skip-json
    python .github/scripts/validate-repository.py —skip-workflows
    python .github/scripts/validate-repository.py —scan-secrets
    python .github/scripts/validate-repository.py —json-report reports/repository-validation.json

Exit codes:
    0 = Validation passed.
    1 = Validation errors or strict-mode warnings.
    2 = Invalid arguments, root or report-writing failure.
“””

from __future__ import annotations

import argparse
import ast
import json
import os
import re
import sys

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


TOOL_NAME = “MedOrbits Repository Validator”
TOOL_VERSION = “2.0.0”

SCRIPT_PATH = Path(__file__).resolve()
DEFAULT_ROOT = SCRIPT_PATH.parents[2]

MAX_TEXT_FILE_BYTES = 5 * 1024 * 1024
MAX_REPORT_BYTES = 10 * 1024 * 1024

EXCLUDED_DIRS = {
    “.git”,
    “.hg”,
    “.svn”,
    “.venv”,
    “venv”,
    “node_modules”,
    “__pycache__”,
    “.pytest_cache”,
    “.mypy_cache”,
    “.next”,
    “.nuxt”,
    “dist”,
    “build”,
    “coverage”,
    “vendor”,
    “.turbo”,
    “.cache”,
    “.idea”,
    “.vscode”,
}

EXPECTED_DIRECTORIES = [
    “.github”,
    “.github/workflows”,
    “.github/scripts”,
]

REQUIRED_FILES = [
    “README.md”,
    “.gitignore”,
]

IMPORTANT_FILES = [
    “package.json”,
    “requirements.txt”,
    “.env.example”,
    “index.html”,
    “manifest.webmanifest”,
    “service-worker.js”,
]

JSON_EXTENSIONS = {
    “.json”,
}

SPECIAL_JSON_FILENAMES = {
    “manifest.webmanifest”,
}

PYTHON_EXTENSIONS = {
    “.py”,
}

WORKFLOW_EXTENSIONS = {
    “.yml”,
    “.yaml”,
}

TEXT_EXTENSIONS = {
    “.py”,
    “.js”,
    “.mjs”,
    “.cjs”,
    “.ts”,
    “.tsx”,
    “.jsx”,
    “.json”,
    “.yml”,
    “.yaml”,
    “.toml”,
    “.ini”,
    “.cfg”,
    “.md”,
    “.html”,
    “.htm”,
    “.css”,
    “.sh”,
    “.ps1”,
    “.txt”,
    “.xml”,
    “.properties”,
}

SECRET_PATTERNS = [
    (
        “private key material”,
        re.compile(
            r”——BEGIN “
            r”(?:RSA |EC |OPENSSH |DSA )?”
            r”PRIVATE KEY——“
        ),
    ),
    (
        “AWS access key”,
        re.compile(r”\b(?:AKIA|ASIA)[A-Z0-9]{16}\b”),
    ),
    (
        “GitHub token”,
        re.compile(
            r”\b(?:gh[pousr]_[A-Za-z0-9]{20,}|”
            r”github_pat_[A-Za-z0-9_]{20,})\b”
        ),
    ),
    (
        “Slack token”,
        re.compile(r”\bxox[baprs]-[A-Za-z0-9-]{15,}\b”),
    ),
    (
        “possible hard-coded credential”,
        re.compile(
            r”””(?i)\b(?:password|passwd|secret|api[_-]?key|”””
            r”””access[_-]?token|client[_-]?secret)\b”””
            r”””\s*[:=]\s*[“’][^”’\s]{8,}[“’]”””
        ),
    ),
]


@dataclass(frozen=True)
class Finding:
    “””One repository validation finding.”””

    severity: str
    code: str
    path: str
    message: str
    line: int | None = None


class DuplicateJSONKeyError(ValueError):
    “””Raised when a JSON object contains duplicate keys.”””


class NonStandardJSONConstantError(ValueError):
    “””Raised when JSON contains NaN or Infinity.”””


def rel(path: Path, root: Path | None = None) -> str:
    “””Return a repository-relative path where possible.”””

    base = root or DEFAULT_ROOT

    try:
        return path.resolve(strict=False).relative_to(
            base.resolve(strict=False)
        ).as_posix()
    except (OSError, ValueError):
        return str(path)


def add_finding(
    findings: list[Finding],
    severity: str,
    code: str,
    path: Path | str,
    message: str,
    line: int | None = None,
    root: Path | None = None,
) -> None:
    “””Add a structured validation finding.”””

    if isinstance(path, Path):
        display_path = rel(path, root)
    else:
        display_path = str(path)

    findings.append(
        Finding(
            severity=severity,
            code=code,
            path=display_path,
            message=message,
            line=line,
        )
    )


def reject_duplicate_keys(
    pairs: list[tuple[str, Any]],
) -> dict[str, Any]:
    “””Reject duplicate keys during JSON parsing.”””

    result: dict[str, Any] = {}

    for key, value in pairs:
        if key in result:
            raise DuplicateJSONKeyError(
                f”Duplicate JSON object key: {key!r}”
            )

        result[key] = value

    return result


def reject_nonstandard_constant(value: str) -> None:
    “””Reject non-standard JSON numeric constants.”””

    raise NonStandardJSONConstantError(
        f”Non-standard JSON constant: {value}”
    )


def is_json_file(path: Path) -> bool:
    “””Return whether a file uses a supported JSON extension.”””

    return (
        path.suffix.lower() in JSON_EXTENSIONS
        or path.name in SPECIAL_JSON_FILENAMES
    )


def is_excluded(path: Path) -> bool:
    “””Check whether a relative path contains an excluded directory.”””

    return any(
        part in EXCLUDED_DIRS
        for part in path.parts
    )


def is_regular_file(path: Path) -> bool:
    “””Check for a regular, non-symlink file.”””

    try:
        return (
            not path.is_symlink()
            and path.is_file()
        )
    except OSError:
        return False


def walk_files(
    root: Path,
    findings: list[Finding],
) -> list[Path]:
    “””Walk repository files without following directory symlinks.”””

    discovered: list[Path] = []

    def on_walk_error(error: OSError) -> None:
        location = Path(error.filename or root)

        add_finding(
            findings,
            “ERROR”,
            “DIRECTORY_READ_ERROR”,
            location,
            f”Could not inspect directory: {error}”,
            root=root,
        )

    for current, directories, filenames in os.walk(
        root,
        topdown=True,
        followlinks=False,
        onerror=on_walk_error,
    ):
        current_path = Path(current)

        directories[:] = sorted(
            name
            for name in directories
            if name not in EXCLUDED_DIRS
            and not (current_path / name).is_symlink()
        )

        for filename in sorted(filenames):
            path = current_path / filename

            if path.is_symlink():
                continue

            try:
                if is_excluded(path.relative_to(root)):
                    continue

                if path.is_file():
                    discovered.append(path)

            except OSError as exc:
                add_finding(
                    findings,
                    “ERROR”,
                    “FILE_DISCOVERY_ERROR”,
                    path,
                    str(exc),
                    root=root,
                )

    return discovered


def parse_args() -> argparse.Namespace:
    “””Parse command-line arguments.”””

    parser = argparse.ArgumentParser(
        description=“Validate the MedOrbits repository.”
    )

    parser.add_argument(
        “—root”,
        default=str(DEFAULT_ROOT),
        help=“Repository root directory.”,
    )

    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=“Treat warnings as failures.”,
    )

    parser.add_argument(
        “—skip-json”,
        action=“store_true”,
        help=“Skip JSON syntax checks.”,
    )

    parser.add_argument(
        “—skip-python”,
        action=“store_true”,
        help=“Skip Python syntax checks.”,
    )

    parser.add_argument(
        “—skip-workflows”,
        action=“store_true”,
        help=“Skip GitHub Actions workflow checks.”,
    )

    parser.add_argument(
        “—scan-secrets”,
        action=“store_true”,
        help=“Scan readable source files for common secret patterns.”,
    )

    parser.add_argument(
        “—json-report”,
        metavar=“PATH”,
        help=“Write a machine-readable JSON report.”,
    )

    parser.add_argument(
        “—quiet”,
        action=“store_true”,
        help=“Print only errors and the final summary.”,
    )

    return parser.parse_args()


# ============================================================
# REPOSITORY STRUCTURE
# ============================================================

def check_repository_root(
    root: Path,
    findings: list[Finding],
    strict: bool,
) -> bool:
    “””Validate root directory and expected repository structure.”””

    if not root.exists():
        add_finding(
            findings,
            “ERROR”,
            “ROOT_MISSING”,
            str(root),
            “Repository root does not exist.”,
        )
        return False

    if root.is_symlink() or not root.is_dir():
        add_finding(
            findings,
            “ERROR”,
            “ROOT_NOT_DIRECTORY”,
            str(root),
            “Repository root must be a regular directory, not a symlink.”,
        )
        return False

    for directory in EXPECTED_DIRECTORIES:
        path = root / directory

        if path.is_symlink():
            add_finding(
                findings,
                “ERROR”,
                “DIRECTORY_SYMLINK”,
                directory,
                “Expected repository directory must not be a symlink.”,
                root=root,
            )
            continue

        if not path.is_dir():
            add_finding(
                findings,
                “ERROR” if strict else “WARNING”,
                “DIRECTORY_MISSING”,
                directory,
                “Expected repository directory is missing.”,
                root=root,
            )

    for filename in REQUIRED_FILES:
        path = root / filename

        if not is_regular_file(path):
            add_finding(
                findings,
                “ERROR” if strict else “WARNING”,
                “REQUIRED_FILE_MISSING”,
                filename,
                “Required repository file is missing.”,
                root=root,
            )

    for filename in IMPORTANT_FILES:
        path = root / filename

        if not path.exists():
            add_finding(
                findings,
                “WARNING”,
                “OPTIONAL_FILE_MISSING”,
                filename,
                “Common project file was not found. Confirm whether it is required.”,
                root=root,
            )

        elif path.is_symlink():
            add_finding(
                findings,
                “WARNING”,
                “OPTIONAL_FILE_SYMLINK”,
                filename,
                “Important project file is a symbolic link.”,
                root=root,
            )

    return True


# ============================================================
# JSON VALIDATION
# ============================================================

def check_json_files(
    files: list[Path],
    root: Path,
    findings: list[Finding],
) -> None:
    “””Validate standard JSON files and web manifests.”””

    for path in files:
        if not is_json_file(path):
            continue

        display_path = path.relative_to(root)

        try:
            raw = path.read_bytes()

            if not raw:
                add_finding(
                    findings,
                    “ERROR”,
                    “JSON_EMPTY”,
                    display_path,
                    “JSON file is empty.”,
                    root=root,
                )
                continue

            if raw.startswith(b”\xef\xbb\xbf”):
                add_finding(
                    findings,
                    “ERROR”,
                    “JSON_BOM”,
                    display_path,
                    “UTF-8 BOM detected. Remove it for consistent JSON handling.”,
                    root=root,
                )
                continue

            try:
                content = raw.decode(“utf-8”)

            except UnicodeDecodeError as exc:
                add_finding(
                    findings,
                    “ERROR”,
                    “JSON_ENCODING”,
                    display_path,
                    f”File is not valid UTF-8: byte offset {exc.start}.”,
                    root=root,
                )
                continue

            try:
                json.loads(
                    content,
                    object_pairs_hook=reject_duplicate_keys,
                    parse_constant=reject_nonstandard_constant,
                )

            except json.JSONDecodeError as exc:
                add_finding(
                    findings,
                    “ERROR”,
                    “JSON_INVALID”,
                    display_path,
                    (
                        f”{exc.msg} “
                        f”(line {exc.lineno}, column {exc.colno})”
                    ),
                    line=exc.lineno,
                    root=root,
                )

            except DuplicateJSONKeyError as exc:
                add_finding(
                    findings,
                    “ERROR”,
                    “JSON_DUPLICATE_KEY”,
                    display_path,
                    str(exc),
                    root=root,
                )

            except NonStandardJSONConstantError as exc:
                add_finding(
                    findings,
                    “ERROR”,
                    “JSON_NONSTANDARD_CONSTANT”,
                    display_path,
                    str(exc),
                    root=root,
                )

        except PermissionError:
            add_finding(
                findings,
                “ERROR”,
                “JSON_PERMISSION_ERROR”,
                display_path,
                “Permission denied while reading JSON file.”,
                root=root,
            )

        except OSError as exc:
            add_finding(
                findings,
                “ERROR”,
                “JSON_READ_ERROR”,
                display_path,
                str(exc),
                root=root,
            )


# ============================================================
# PYTHON VALIDATION
# ============================================================

def check_python_files(
    files: list[Path],
    root: Path,
    findings: list[Finding],
) -> None:
    “””Compile Python syntax using AST parsing, without execution.”””

    for path in files:
        if path.suffix.lower() not in PYTHON_EXTENSIONS:
            continue

        display_path = path.relative_to(root)

        try:
            raw = path.read_bytes()

            if len(raw) > MAX_TEXT_FILE_BYTES:
                add_finding(
                    findings,
                    “WARNING”,
                    “PYTHON_FILE_TOO_LARGE”,
                    display_path,
                    “Python file exceeds the configured inspection size limit.”,
                    root=root,
                )
                continue

            source = raw.decode(“utf-8”)

            ast.parse(
                source,
                filename=str(display_path),
            )

        except UnicodeDecodeError as exc:
            add_finding(
                findings,
                “ERROR”,
                “PYTHON_ENCODING”,
                display_path,
                f”File is not valid UTF-8: byte offset {exc.start}.”,
                root=root,
            )

        except SyntaxError as exc:
            add_finding(
                findings,
                “ERROR”,
                “PYTHON_SYNTAX”,
                display_path,
                exc.msg,
                line=exc.lineno,
                root=root,
            )

        except PermissionError:
            add_finding(
                findings,
                “ERROR”,
                “PYTHON_PERMISSION_ERROR”,
                display_path,
                “Permission denied while reading Python file.”,
                root=root,
            )

        except OSError as exc:
            add_finding(
                findings,
                “ERROR”,
                “PYTHON_READ_ERROR”,
                display_path,
                str(exc),
                root=root,
            )


# ============================================================
# GITHUB ACTIONS WORKFLOW VALIDATION
# ============================================================

def check_github_workflows(
    root: Path,
    findings: list[Finding],
) -> None:
    “””
    Perform conservative structural checks on GitHub workflows.

    This is not a complete YAML parser or GitHub Actions validator.
    “””

    workflow_dir = root / “.github” / “workflows”

    if not workflow_dir.is_dir():
        return

    try:
        workflows = sorted(
            path
            for path in workflow_dir.iterdir()
            if is_regular_file(path)
            and path.suffix.lower() in WORKFLOW_EXTENSIONS
        )

    except OSError as exc:
        add_finding(
            findings,
            “ERROR”,
            “WORKFLOW_DIRECTORY_READ_ERROR”,
            “.github/workflows”,
            str(exc),
            root=root,
        )
        return

    if not workflows:
        add_finding(
            findings,
            “WARNING”,
            “NO_WORKFLOWS”,
            “.github/workflows”,
            “No GitHub Actions workflow files were found.”,
            root=root,
        )
        return

    for workflow in workflows:
        display_path = workflow.relative_to(root)

        try:
            raw = workflow.read_bytes()

            if not raw:
                add_finding(
                    findings,
                    “ERROR”,
                    “WORKFLOW_EMPTY”,
                    display_path,
                    “Workflow file is empty.”,
                    root=root,
                )
                continue

            if len(raw) > MAX_TEXT_FILE_BYTES:
                add_finding(
                    findings,
                    “WARNING”,
                    “WORKFLOW_TOO_LARGE”,
                    display_path,
                    “Workflow file exceeds the inspection size limit.”,
                    root=root,
                )
                continue

            text = raw.decode(“utf-8”)

        except UnicodeDecodeError as exc:
            add_finding(
                findings,
                “ERROR”,
                “WORKFLOW_ENCODING”,
                display_path,
                f”Workflow file is not valid UTF-8: byte offset {exc.start}.”,
                root=root,
            )
            continue

        except OSError as exc:
            add_finding(
                findings,
                “ERROR”,
                “WORKFLOW_READ_ERROR”,
                display_path,
                str(exc),
                root=root,
            )
            continue

        # Remove comments and quoted strings only for the limited
        # structural checks below. This does not parse YAML.
        meaningful_lines = [
            line
            for line in text.splitlines()
            if line.strip() and not line.lstrip().startswith(“#”)
        ]

        if not meaningful_lines:
            add_finding(
                findings,
                “ERROR”,
                “WORKFLOW_NO_CONTENT”,
                display_path,
                “Workflow has no meaningful content.”,
                root=root,
            )
            continue

        has_trigger = re.search(
            r”””(?m)^([‘”]?on[‘”]?)\s*:”””,
            text,
        )

        if not has_trigger:
            add_finding(
                findings,
                “WARNING”,
                “WORKFLOW_TRIGGER_NOT_FOUND”,
                display_path,
                “Could not find a conventional top-level on: trigger. Review manually.”,
                root=root,
            )

        has_jobs = re.search(
            r”(?m)^jobs\s*:”,
            text,
        )

        if not has_jobs:
            add_finding(
                findings,
                “ERROR”,
                “WORKFLOW_JOBS_MISSING”,
                display_path,
                “Workflow is missing a top-level jobs section.”,
                root=root,
            )


# ============================================================
# NODE PACKAGE VALIDATION
# ============================================================

def check_package_manifests(
    root: Path,
    findings: list[Finding],
) -> None:
    “””Check common package manifest fields.”””

    package_files = [
        root / “package.json”,
        root / “server” / “package.json”,
    ]

    for path in package_files:
        if not is_regular_file(path):
            continue

        relative = path.relative_to(root)

        try:
            data = json.loads(
                path.read_text(encoding=“utf-8”),
                object_pairs_hook=reject_duplicate_keys,
            )

        except (
            OSError,
            UnicodeDecodeError,
            json.JSONDecodeError,
            DuplicateJSONKeyError,
        ):
            # JSON errors are already reported by check_json_files().
            continue

        if not isinstance(data, dict):
            add_finding(
                findings,
                “ERROR”,
                “PACKAGE_FORMAT”,
                relative,
                “package.json must contain a JSON object.”,
                root=root,
            )
            continue

        if not isinstance(data.get(“scripts”, {}), dict):
            add_finding(
                findings,
                “ERROR”,
                “PACKAGE_SCRIPTS_FORMAT”,
                relative,
                “’scripts’ must be a JSON object.”,
                root=root,
            )

        for field in (“name”, “version”):
            value = data.get(field)

            if not isinstance(value, str) or not value.strip():
                add_finding(
                    findings,
                    “WARNING”,
                    f”PACKAGE_{field.upper()}_MISSING”,
                    relative,
                    f”Package manifest does not define a valid {field}.”,
                    root=root,
                )

        engines = data.get(“engines”)

        if engines is not None and not isinstance(engines, dict):
            add_finding(
                findings,
                “WARNING”,
                “PACKAGE_ENGINES_FORMAT”,
                relative,
                “’engines’ should be a JSON object.”,
                root=root,
            )


# ============================================================
# ENVIRONMENT TEMPLATE VALIDATION
# ============================================================

def check_env_example(
    root: Path,
    findings: list[Finding],
) -> None:
    “””Check .env.example syntax and duplicate variable names.”””

    example = root / “.env.example”

    if not is_regular_file(example):
        return

    try:
        raw = example.read_bytes()

        if len(raw) > MAX_TEXT_FILE_BYTES:
            add_finding(
                findings,
                “WARNING”,
                “ENV_EXAMPLE_TOO_LARGE”,
                “.env.example”,
                “Environment template exceeds the inspection size limit.”,
                root=root,
            )
            return

        lines = raw.decode(“utf-8”).splitlines()

    except UnicodeDecodeError as exc:
        add_finding(
            findings,
            “ERROR”,
            “ENV_EXAMPLE_ENCODING”,
            “.env.example”,
            f”Invalid UTF-8 at byte offset {exc.start}.”,
            root=root,
        )
        return

    except OSError as exc:
        add_finding(
            findings,
            “ERROR”,
            “ENV_EXAMPLE_READ_ERROR”,
            “.env.example”,
            str(exc),
            root=root,
        )
        return

    seen: dict[str, int] = {}

    for number, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()

        if not line or line.startswith(“#”):
            continue

        if line.startswith(“export “):
            line = line[len(“export “):].lstrip()

        if “=“ not in line:
            add_finding(
                findings,
                “WARNING”,
                “ENV_EXAMPLE_MISSING_EQUALS”,
                “.env.example”,
                “Environment entry does not contain ‘=‘.”,
                line=number,
                root=root,
            )
            continue

        key = line.split(“=“, 1)[0].strip()

        if not re.fullmatch(
            r”[A-Za-z_][A-Za-z0-9_]*”,
            key,
        ):
            add_finding(
                findings,
                “WARNING”,
                “ENV_EXAMPLE_INVALID_KEY”,
                “.env.example”,
                f”Invalid environment variable name: {key!r}.”,
                line=number,
                root=root,
            )
            continue

        if key in seen:
            add_finding(
                findings,
                “WARNING”,
                “ENV_EXAMPLE_DUPLICATE”,
                “.env.example”,
                (
                    f”Duplicate variable {key!r}; “
                    f”first declared on line {seen[key]}.”
                ),
                line=number,
                root=root,
            )
        else:
            seen[key] = number


# ============================================================
# REPOSITORY HYGIENE
# ============================================================

def check_common_repository_hygiene(
    root: Path,
    files: list[Path],
    findings: list[Finding],
) -> None:
    “””Check basic ignore rules and local environment file presence.”””

    gitignore = root / “.gitignore”

    if is_regular_file(gitignore):
        try:
            patterns = {
                line.strip()
                for line in gitignore.read_text(
                    encoding=“utf-8”
                ).splitlines()
                if line.strip()
                and not line.lstrip().startswith(“#”)
            }

        except (OSError, UnicodeDecodeError) as exc:
            add_finding(
                findings,
                “WARNING”,
                “GITIGNORE_READ_ERROR”,
                “.gitignore”,
                str(exc),
                root=root,
            )
            patterns = set()

        for required_pattern in (
            “.env”,
            “node_modules/“,
            “__pycache__/“,
        ):
            if required_pattern not in patterns:
                add_finding(
                    findings,
                    “WARNING”,
                    “GITIGNORE_PATTERN_MISSING”,
                    “.gitignore”,
                    f”Consider adding {required_pattern!r} to .gitignore.”,
                    root=root,
                )

    for path in files:
        if path.name == “.env” or (
            path.name.startswith(“.env.”)
            and path.name not in {
                “.env.example”,
                “.env.sample”,
                “.env.template”,
            }
        ):
            add_finding(
                findings,
                “WARNING”,
                “ENV_FILE_PRESENT”,
                path.relative_to(root),
                (
                    “Local environment file exists in the working tree. “
                    “Verify that it is not committed and contains no real secrets.”
                ),
                root=root,
            )


# ============================================================
# OPTIONAL SECRET SCANNING
# ============================================================

def scan_secrets(
    files: list[Path],
    root: Path,
    findings: list[Finding],
) -> None:
    “””
    Detect common secret patterns in readable text files.

    This is heuristic scanning, not a guarantee that all secrets
    will be detected. Secret values are never printed.
    “””

    excluded_names = {
        “.env”,
        “.env.local”,
        “.env.production”,
        “.env.development”,
    }

    for path in files:
        if path.name in excluded_names:
            continue

        if path.suffix.lower() not in TEXT_EXTENSIONS:
            continue

        display_path = path.relative_to(root)

        try:
            raw = path.read_bytes()

            if len(raw) > MAX_TEXT_FILE_BYTES:
                continue

            content = raw.decode(“utf-8”)

        except (OSError, UnicodeDecodeError):
            continue

        for number, line in enumerate(content.splitlines(), start=1):
            stripped = line.strip()

            if stripped.startswith((“#”, “//“, “*”)):
                continue

            for label, pattern in SECRET_PATTERNS:
                if pattern.search(line):
                    add_finding(
                        findings,
                        “WARNING”,
                        “POSSIBLE_SECRET”,
                        display_path,
                        (
                            f”Possible {label} detected. “
                            “Review securely and rotate any exposed credential.”
                        ),
                        line=number,
                        root=root,
                    )
                    break


# ============================================================
# REPORT GENERATION
# ============================================================

def write_report(
    destination: str,
    root: Path,
    findings: list[Finding],
    checked_files: int,
    scanned_files: int,
) -> bool:
    “””Write a machine-readable report outside source files.”””

    report_path = Path(
        destination
    ).expanduser().resolve(strict=False)

    if report_path.exists() and report_path.is_symlink():
        print(
            “ERROR: Report destination must not be a symbolic link.”,
            file=sys.stderr,
        )
        return False

    report = {
        “tool”: TOOL_NAME,
        “version”: TOOL_VERSION,
        “repository”: str(root),
        “checked_files”: checked_files,
        “scanned_files”: scanned_files,
        “summary”: {
            “errors”: sum(
                finding.severity == “ERROR”
                for finding in findings
            ),
            “warnings”: sum(
                finding.severity == “WARNING”
                for finding in findings
            ),
            “info”: sum(
                finding.severity == “INFO”
                for finding in findings
            ),
        },
        “findings”: [
            asdict(finding)
            for finding in findings
        ],
    }

    try:
        content = (
            json.dumps(
                report,
                indent=2,
                ensure_ascii=False,
            )
            + “\n”
        )

        if len(content.encode(“utf-8”)) > MAX_REPORT_BYTES:
            raise OSError(
                “Generated report exceeds the configured size limit.”
            )

        report_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        report_path.write_text(
            content,
            encoding=“utf-8”,
        )

    except (OSError, ValueError) as exc:
        print(
            f”ERROR: Could not write report: {exc}”,
            file=sys.stderr,
        )
        return False

    return True


# ============================================================
# MAIN
# ============================================================

def main() -> int:
    “””Run repository validation.”””

    args = parse_args()

    root = Path(
        args.root
    ).expanduser().resolve(strict=False)

    findings: list[Finding] = []

    if root.is_symlink() or not root.is_dir():
        print(
            f”ERROR: Invalid repository root: {root}”,
            file=sys.stderr,
        )
        return 2

    if not args.quiet:
        print(TOOL_NAME)
        print(f”Version: {TOOL_VERSION}”)
        print(f”Root: {root}”)
        print(“-“ * 72)

    if not check_repository_root(
        root,
        findings,
        args.strict,
    ):
        return 2

    files = walk_files(
        root,
        findings,
    )

    checked_files = len(files)

    if not args.skip_json:
        check_json_files(
            files,
            root,
            findings,
        )

    if not args.skip_python:
        check_python_files(
            files,
            root,
            findings,
        )

    if not args.skip_workflows:
        check_github_workflows(
            root,
            findings,
        )

    check_package_manifests(
        root,
        findings,
    )

    check_env_example(
        root,
        findings,
    )

    check_common_repository_hygiene(
        root,
        files,
        findings,
    )

    if args.scan_secrets:
        scan_secrets(
            files,
            root,
            findings,
        )

    for finding in findings:
        if args.quiet and finding.severity != “ERROR”:
            continue

        location = finding.path

        if finding.line is not None:
            location += f”:{finding.line}”

        print(
            f”{finding.severity}: “
            f”[{finding.code}] “
            f”{location}: “
            f”{finding.message}”
        )

    errors = sum(
        finding.severity == “ERROR”
        for finding in findings
    )

    warnings = sum(
        finding.severity == “WARNING”
        for finding in findings
    )

    if args.json_report:
        report_path = Path(
            args.json_report
        ).expanduser().resolve(strict=False)

        source_paths = {
            path.resolve(strict=False)
            for path in files
        }

        if report_path in source_paths:
            print(
                “ERROR: Report destination matches a repository source file. “
                “Choose a separate output path.”,
                file=sys.stderr,
            )
            return 2

        if not write_report(
            args.json_report,
            root,
            findings,
            checked_files,
            checked_files,
        ):
            return 2

    if not args.quiet:
        print(“-“ * 72)

    print(f”Files inspected: {checked_files}”)
    print(f”Errors: {errors} | Warnings: {warnings}”)

    if errors:
        print(
            “FAILED: Repository validation found errors.”
        )
        return 1

    if args.strict and warnings:
        print(
            “FAILED: Strict mode treats warnings as failures.”
        )
        return 1

    print(
        “PASSED: No blocking repository validation errors found.”
    )

    return 0


if __name__ == “__main__”:
    raise SystemExit(main())