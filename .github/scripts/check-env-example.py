#!/usr/bin/env python3
“””
MedOrbits — Environment Example Validator
File: .github/scripts/check-env-example.py
Version: 2.1.1

Purpose:
    Validate .env.example against environment-variable references found in
    application code and supported configuration files.

Checks:
    - .env.example exists and is readable.
    - Environment variable assignments use valid syntax.
    - Duplicate environment variable declarations are detected.
    - Environment-variable references are discovered in supported files.
    - Undeclared variables are reported.
    - Suspicious hard-coded secrets are flagged without displaying values.
    - Common secret-bearing files are checked for Git tracking.
    - File values are never printed in diagnostics.

Usage:
    python .github/scripts/check-env-example.py
    python .github/scripts/check-env-example.py —root .
    python .github/scripts/check-env-example.py —strict
    python .github/scripts/check-env-example.py —no-git-check

Exit codes:
    0: Validation passed.
    1: Validation errors found.
    2: Invalid arguments or execution failure.

Dependencies:
    Python standard library only.
“””

from __future__ import annotations

import argparse
import re
import subprocess
import sys

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


# =============================================================================
# CONFIGURATION
# =============================================================================

ENV_FILENAME = “.env.example”

MAX_SOURCE_FILE_SIZE = 2 * 1024 * 1024

IGNORED_DIRS = {
    “.git”,
    “.hg”,
    “.svn”,
    “.next”,
    “.nuxt”,
    “.turbo”,
    “.vercel”,
    “.cache”,
    “.pytest_cache”,
    “.mypy_cache”,
    “.ruff_cache”,
    “__pycache__”,
    “node_modules”,
    “vendor”,
    “dist”,
    “build”,
    “coverage”,
    “.venv”,
    “venv”,
}

SOURCE_SUFFIXES = {
    “.js”,
    “.mjs”,
    “.cjs”,
    “.ts”,
    “.tsx”,
    “.jsx”,
    “.py”,
    “.json”,
    “.yml”,
    “.yaml”,
    “.sh”,
    “.toml”,
    “.conf”,
}

ENV_KEY_RE = re.compile(
    r”^[A-Za-z_][A-Za-z0-9_]*$”
)

ENV_ASSIGNMENT_RE = re.compile(
    r”^\s*(?:export\s+)?”
    r”([A-Za-z_][A-Za-z0-9_]*)”
    r”\s*=\s*(.*?)\s*$”
)

SECRET_KEY_RE = re.compile(
    r”(?:^|_)”
    r”(?:PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|”
    r”CLIENT_SECRET|ACCESS_KEY|AUTH_KEY)”
    r”(?:_|$)”,
    re.IGNORECASE,
)

PLACEHOLDER_RE = re.compile(
    r”^(?:”
    r”$|”
    r”change[_ -]?me|”
    r”replace[_ -]?me|”
    r”your[_ -].*|”
    r”<.*>|”
    r”\$\{[^}]+\}|”
    r”\{\{.*\}\}|”
    r”example(?:[_ -].*)?|”
    r”placeholder|”
    r”not[_ -]?set|”
    r”todo|”
    r”none|”
    r”null”
    r”)$”,
    re.IGNORECASE,
)


# =============================================================================
# ENVIRONMENT VARIABLE REFERENCE PATTERNS
# =============================================================================

REFERENCE_PATTERNS = [
    # Node.js
    re.compile(
        r”\bprocess\.env\.([A-Za-z_][A-Za-z0-9_]*)”
    ),

    re.compile(
        r”\bprocess\.env\[\s*[‘\”]([A-Za-z_][A-Za-z0-9_]*)[‘\”]\s*\]”
    ),

    # Vite and modern frontend tooling
    re.compile(
        r”\bimport\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)”
    ),

    # Python
    re.compile(
        r”\bos\.environ\.get\(\s*[‘\”]([A-Za-z_][A-Za-z0-9_]*)[‘\”]”
    ),

    re.compile(
        r”\bos\.environ\[\s*[‘\”]([A-Za-z_][A-Za-z0-9_]*)[‘\”]\s*\]”
    ),

    re.compile(
        r”\bos\.getenv\(\s*[‘\”]([A-Za-z_][A-Za-z0-9_]*)[‘\”]”
    ),

    # Generic configuration access
    re.compile(
        r”\benv\.get\(\s*[‘\”]([A-Za-z_][A-Za-z0-9_]*)[‘\”]”
    ),

    re.compile(
        r”\bgetenv\(\s*[‘\”]([A-Za-z_][A-Za-z0-9_]*)[‘\”]”
    ),

    re.compile(
        r”\bprocess\.env\[[‘\”]([A-Za-z_][A-Za-z0-9_]*)[‘\”]\]”
    ),
]


# =============================================================================
# PLATFORM-PROVIDED VARIABLES
# =============================================================================

COMMON_EXTERNAL_VARIABLES = {
    “CI”,
    “HOME”,
    “HOSTNAME”,
    “NODE_ENV”,
    “NODE_OPTIONS”,
    “PATH”,
    “PORT”,
    “PWD”,
    “SHELL”,
    “TEMP”,
    “TMP”,
    “TMPDIR”,
    “USER”,

    # Vercel
    “VERCEL”,
    “VERCEL_ENV”,
    “VERCEL_URL”,

    # Render
    “RENDER”,
    “RENDER_EXTERNAL_HOSTNAME”,
    “RENDER_INSTANCE_ID”,
    “RENDER_SERVICE_ID”,
    “RENDER_SERVICE_NAME”,

    # GitHub Actions
    “GITHUB_ACTIONS”,
    “GITHUB_REF”,
    “GITHUB_SHA”,
    “GITHUB_REPOSITORY”,
    “GITHUB_WORKSPACE”,
    “GITHUB_TOKEN”,
}


# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass(frozen=True)
class Finding:
    severity: str
    location: str
    message: str


# =============================================================================
# ARGUMENT PARSING
# =============================================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            “Validate MedOrbits environment example configuration.”
        )
    )

    parser.add_argument(
        “—root”,
        type=Path,
        default=Path.cwd(),
        help=“Repository root directory.”,
    )

    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=“Treat undeclared environment references as errors.”,
    )

    parser.add_argument(
        “—no-git-check”,
        action=“store_true”,
        help=“Skip Git secret-file tracking checks.”,
    )

    return parser.parse_args()


# =============================================================================
# FILE UTILITIES
# =============================================================================

def is_ignored(path: Path) -> bool:
    return any(
        part in IGNORED_DIRS
        for part in path.parts
    )


def relative_path(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def read_text_safely(path: Path) -> str | None:
    try:
        if path.stat().st_size > MAX_SOURCE_FILE_SIZE:
            return None

        return path.read_text(
            encoding=“utf-8-sig”
        )

    except (OSError, UnicodeError):
        return None


# =============================================================================
# ENVIRONMENT FILE VALIDATION
# =============================================================================

def parse_env_file(
    path: Path,
    root: Path,
    findings: list[Finding],
) -> set[str]:

    declared: set[str] = set()
    seen: set[str] = set()

    display_path = relative_path(path, root)

    content = read_text_safely(path)

    if content is None:
        findings.append(
            Finding(
                “ERROR”,
                display_path,
                “File could not be read as UTF-8 or exceeds the size limit.”,
            )
        )

        return declared

    for line_number, raw_line in enumerate(
        content.splitlines(),
        start=1,
    ):

        stripped = raw_line.strip()

        if not stripped or stripped.startswith(“#”):
            continue

        match = ENV_ASSIGNMENT_RE.match(raw_line)

        if not match:
            findings.append(
                Finding(
                    “ERROR”,
                    f”{display_path}:{line_number}”,
                    “Malformed environment assignment.”,
                )
            )

            continue

        key, value = match.groups()

        if not ENV_KEY_RE.fullmatch(key):
            findings.append(
                Finding(
                    “ERROR”,
                    f”{display_path}:{line_number}”,
                    “Invalid environment variable name.”,
                )
            )

            continue

        if key in seen:
            findings.append(
                Finding(
                    “ERROR”,
                    f”{display_path}:{line_number}”,
                    f”Duplicate environment variable declaration: {key}.”,
                )
            )

        seen.add(key)
        declared.add(key)

        # Normalize the value without printing it.
        normalized_value = value.strip()

        # Remove comments only when separated by whitespace.
        normalized_value = re.sub(
            r”\s+#.*$”,
            “”,
            normalized_value,
        ).strip()

        if normalized_value.startswith(“#”):
            normalized_value = “”

        # Check for suspicious hard-coded secrets.
        if SECRET_KEY_RE.search(key):

            candidate = normalized_value.strip().strip(“’\””)

            if (
                candidate
                and not PLACEHOLDER_RE.fullmatch(candidate)
            ):
                findings.append(
                    Finding(
                        “ERROR”,
                        f”{display_path}:{line_number}”,
                        (
                            f”Possible hard-coded secret in variable {key}. “
                            “Use a clearly documented placeholder.”
                        ),
                    )
                )

    return declared


# =============================================================================
# SOURCE FILE DISCOVERY
# =============================================================================

def discover_source_files(
    root: Path,
    env_path: Path,
) -> Iterable[Path]:

    for path in root.rglob(“*”):

        try:
            if not path.is_file():
                continue

            relative = path.relative_to(root)

            if is_ignored(relative):
                continue

            if path.resolve() == env_path.resolve():
                continue

            if path.name.startswith(“.env”):
                continue

            if path.suffix.lower() not in SOURCE_SUFFIXES:
                continue

            if path.stat().st_size > MAX_SOURCE_FILE_SIZE:
                continue

            yield path

        except (OSError, ValueError):
            continue


# =============================================================================
# ENVIRONMENT REFERENCE DISCOVERY
# =============================================================================

def discover_references(
    root: Path,
    env_path: Path,
) -> dict[str, set[str]]:

    references: dict[str, set[str]] = {}

    for path in discover_source_files(root, env_path):

        content = read_text_safely(path)

        if content is None:
            continue

        display_path = relative_path(path, root)

        for pattern in REFERENCE_PATTERNS:

            for match in pattern.finditer(content):

                name = match.group(1)

                references.setdefault(
                    name,
                    set(),
                ).add(display_path)

    return references


# =============================================================================
# GIT SECRET FILE TRACKING CHECK
# =============================================================================

def check_git_tracking(
    root: Path,
    findings: list[Finding],
) -> None:

    protected_names = {
        “.env”,
        “.env.local”,
        “.env.production”,
        “.env.development”,
        “.env.staging”,
        “.env.test”,
        “id_rsa”,
        “id_ed25519”,
        “credentials.json”,
        “service-account.json”,
    }

    try:
        result = subprocess.run(
            [
                “git”,
                “-C”,
                str(root),
                “ls-files”,
                “-z”,
            ],
            check=False,
            capture_output=True,
            text=True,
            encoding=“utf-8”,
            errors=“replace”,
            timeout=10,
        )

    except (OSError, subprocess.SubprocessError):

        findings.append(
            Finding(
                “WARNING”,
                “.git”,
                “Git tracking check could not be completed.”,
            )
        )

        return

    if result.returncode != 0:

        findings.append(
            Finding(
                “WARNING”,
                “.git”,
                “Git working tree unavailable; tracking check skipped.”,
            )
        )

        return

    tracked_files = [
        item
        for item in result.stdout.split(“\0”)
        if item
    ]

    for filename in tracked_files:

        path = Path(filename)
        name = path.name

        is_env_file = (
            name.startswith(“.env”)
            and name != “.env.example”
        )

        is_known_secret_file = (
            name in protected_names
        )

        if is_env_file or is_known_secret_file:

            findings.append(
                Finding(
                    “ERROR”,
                    filename,
                    (
                        “Potentially sensitive configuration file is tracked “
                        “by Git. Review the file and remove exposed credentials “
                        “from repository history when necessary.”
                    ),
                )
            )


# =============================================================================
# MAIN VALIDATION
# =============================================================================

def main() -> int:

    args = parse_args()

    root = args.root.resolve()

    if not root.exists() or not root.is_dir():

        print(
            f”ERROR: Repository root is not a directory: {root}”
        )

        return 2

    findings: list[Finding] = []

    env_path = root / ENV_FILENAME

    # Validate .env.example.
    if not env_path.is_file():

        findings.append(
            Finding(
                “ERROR”,
                ENV_FILENAME,
                “Required environment example file is missing.”,
            )
        )

        declared: set[str] = set()

    else:

        declared = parse_env_file(
            env_path,
            root,
            findings,
        )

    # Discover source-code environment references.
    references = discover_references(
        root,
        env_path,
    )

    ignored_external = (
        COMMON_EXTERNAL_VARIABLES | declared
    )

    # Identify undeclared environment variables.
    for name, source_paths in sorted(references.items()):

        if name in ignored_external:
            continue

        severity = (
            “ERROR”
            if args.strict
            else “WARNING”
        )

        locations = “, “.join(
            sorted(source_paths)[:3]
        )

        findings.append(
            Finding(
                severity,
                locations,
                (
                    f”Environment variable {name} is referenced “
                    f”but not declared in {ENV_FILENAME}.”
                ),
            )
        )

    # Check tracked secret-bearing files.
    if not args.no_git_check:

        check_git_tracking(
            root,
            findings,
        )

    # Generate diagnostics.
    errors = [
        item
        for item in findings
        if item.severity == “ERROR”
    ]

    warnings = [
        item
        for item in findings
        if item.severity == “WARNING”
    ]

    for finding in sorted(
        findings,
        key=lambda item: (
            item.severity != “ERROR”,
            item.location,
            item.message,
        ),
    ):

        print(
            f”{finding.severity}: “
            f”{finding.location}: “
            f”{finding.message}”
        )

    print()

    print(
        “Environment validation summary: “
        f”{len(errors)} error(s), “
        f”{len(warnings)} warning(s).”
    )

    if errors:
        print(“Environment example validation failed.”)
        return 1

    if args.strict and warnings:
        print(“Strict validation failed.”)
        return 1

    print(“Environment example validation passed.”)

    return 0


# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == “__main__”:

    try:
        raise SystemExit(main())

    except KeyboardInterrupt:

        print(
            “\nERROR: Validation interrupted.”,
            file=sys.stderr,
        )

        raise SystemExit(2)

    except Exception:

        # Avoid displaying potentially sensitive file contents or
        # environment values in unexpected exception diagnostics.
        print(
            “ERROR: Unexpected validator execution failure.”,
            file=sys.stderr,
        )

        raise SystemExit(2)