
#!/usr/bin/env python3
“””
===============================================================================
MEDORBITS — REPOSITORY SECRET SCANNER
File: .github/scripts/check-secrets.py
Version: 2.1.3

Purpose:
    Detect accidentally committed credentials and sensitive secrets.

Features:
    - API key detection
    - Private key detection
    - Cloud credential detection
    - Database connection string detection
    - Token detection
    - Environment file detection
    - Git-tracked file scanning
    - Configurable exclusions
    - Safe reporting without printing secret values

Usage:
    python .github/scripts/check-secrets.py
    python .github/scripts/check-secrets.py —all-files
    python .github/scripts/check-secrets.py —strict
    python .github/scripts/check-secrets.py —help

Exit codes:
    0 = No secrets detected
    1 = Potential secrets detected
    2 = Execution or configuration error
===============================================================================
“””

from __future__ import annotations

import argparse
import fnmatch
import os
import re
import subprocess
import sys

from pathlib import Path
from typing import NamedTuple


# =============================================================================
# CONFIGURATION
# =============================================================================

VERSION = “2.1.3”

ROOT = Path(__file__).resolve().parents[2]

MAX_FILE_SIZE = 2 * 1024 * 1024

EXCLUDED_DIRECTORIES = {
    “.git”,
    “node_modules”,
    “.venv”,
    “venv”,
    “__pycache__”,
    “.next”,
    “.nuxt”,
    “dist”,
    “build”,
    “coverage”,
    “.cache”,
    “.turbo”,
}

EXCLUDED_FILES = {
    “package-lock.json”,
    “pnpm-lock.yaml”,
    “yarn.lock”,
}

EXCLUDED_SUFFIXES = {
    “.png”,
    “.jpg”,
    “.jpeg”,
    “.gif”,
    “.webp”,
    “.ico”,
    “.pdf”,
    “.zip”,
    “.gz”,
    “.woff”,
    “.woff2”,
    “.ttf”,
    “.eot”,
    “.mp4”,
    “.mp3”,
}

SAFE_ENV_FILES = {
    “.env.example”,
    “.env.sample”,
    “.env.template”,
    “.env.defaults”,
}

PLACEHOLDER_VALUES = {
    “”,
    “your_api_key”,
    “your_api_key_here”,
    “your_secret”,
    “your_secret_here”,
    “change_me”,
    “changeme”,
    “replace_me”,
    “replace_this”,
    “example”,
    “placeholder”,
    “xxxxxxxx”,
    “redacted”,
    “none”,
    “null”,
    “undefined”,
}


# =============================================================================
# DETECTION PATTERNS
# =============================================================================

PATTERNS: dict[str, re.Pattern[str]] = {

    “Private key”: re.compile(
        r”——BEGIN “
        r”(?:RSA |DSA |EC |OPENSSH |PGP )?”
        r”PRIVATE KEY——“
    ),

    “AWS access key”: re.compile(
        r”\bAKIA[0-9A-Z]{16}\b”
    ),

    “Google API key”: re.compile(
        r”\bAIza[0-9A-Za-z_-]{35}\b”
    ),

    “GitHub token”: re.compile(
        r”\bgh[pousr]_[A-Za-z0-9_]{20,}\b”
    ),

    “GitHub fine-grained token”: re.compile(
        r”\bgithub_pat_[A-Za-z0-9_]{20,}\b”
    ),

    “Slack token”: re.compile(
        r”\bxox[baprs]-[A-Za-z0-9-]{10,}\b”
    ),

    “Stripe secret key”: re.compile(
        r”\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b”
    ),

    “JWT token”: re.compile(
        r”\beyJ[A-Za-z0-9_-]{10,}\.”
        r”[A-Za-z0-9_-]{10,}\.”
        r”[A-Za-z0-9_-]{10,}\b”
    ),

    “Database connection string”: re.compile(
        r”(?i)\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?)”
        r”://[^/\s:@]+:[^/\s@]+@“
    ),

    “Generic API key assignment”: re.compile(
        r”””(?i)\b(?:api[_-]?key|secret[_-]?key|client[_-]?secret)”””
        r”””\s*[:=]\s*[“’]([^”’\r\n]{16,})[“’]”””
    ),

    “Generic access token assignment”: re.compile(
        r”””(?i)\b(?:access[_-]?token|auth[_-]?token|”””
        r”””refresh[_-]?token)\s*[:=]\s*[“’]”””
        r”””([^”’\r\n]{16,})[“’]”””
    ),

    “Password assignment”: re.compile(
        r”””(?i)\b(?:password|passwd|db_password)”””
        r”””\s*[:=]\s*[“’]([^”’\r\n]{12,})[“’]”””
    ),
}


# =============================================================================
# RESULT MODEL
# =============================================================================

class Finding(NamedTuple):
    file: str
    line: int
    category: str


# =============================================================================
# UTILITIES
# =============================================================================

def is_placeholder(value: str) -> bool:
    “””Determine whether a detected value is an obvious placeholder.”””

    normalized = value.strip().lower()

    if normalized in PLACEHOLDER_VALUES:
        return True

    if normalized.startswith(
        (“your_”, “replace_”, “example_”, “placeholder_”)
    ):
        return True

    if re.fullmatch(r”[xX*._-]+”, normalized):
        return True

    return False


def is_excluded(path: Path) -> bool:
    “””Check whether a file should be excluded from scanning.”””

    if any(part in EXCLUDED_DIRECTORIES for part in path.parts):
        return True

    if path.name in EXCLUDED_FILES:
        return True

    if path.suffix.lower() in EXCLUDED_SUFFIXES:
        return True

    if path.name in SAFE_ENV_FILES:
        return True

    return False


def get_tracked_files() -> list[Path]:
    “””Return files tracked by Git.”””

    try:
        result = subprocess.run(
            [
                “git”,
                “-C”,
                str(ROOT),
                “ls-files”,
                “-z”,
            ],
            check=True,
            capture_output=True,
            text=False,
        )

    except FileNotFoundError as exc:
        raise RuntimeError(“Git executable was not found.”) from exc

    except subprocess.CalledProcessError as exc:
        raise RuntimeError(
            “Unable to retrieve Git-tracked files.”
        ) from exc

    files = []

    for item in result.stdout.split(b”\0”):
        if not item:
            continue

        relative = Path(os.fsdecode(item))
        absolute = ROOT / relative

        if absolute.is_file() and not is_excluded(relative):
            files.append(absolute)

    return files


def get_all_files() -> list[Path]:
    “””Return eligible files from the working tree.”””

    files = []

    for path in ROOT.rglob(“*”):

        if not path.is_file():
            continue

        try:
            relative = path.relative_to(ROOT)
        except ValueError:
            continue

        if is_excluded(relative):
            continue

        files.append(path)

    return files


# =============================================================================
# SECRET DETECTION
# =============================================================================

def scan_line(
    relative_path: str,
    line_number: int,
    line: str,
) -> list[Finding]:
    “””Scan a line without exposing the detected secret.”””

    findings = []

    for category, pattern in PATTERNS.items():

        for match in pattern.finditer(line):

            detected_value = (
                match.group(1)
                if match.lastindex
                else match.group(0)
            )

            if is_placeholder(detected_value):
                continue

            findings.append(
                Finding(
                    file=relative_path,
                    line=line_number,
                    category=category,
                )
            )

    return findings


def scan_file(path: Path) -> list[Finding]:
    “””Scan a single text file.”””

    findings = []

    try:

        if path.stat().st_size > MAX_FILE_SIZE:
            print(
                f”[SKIP] Large file: {path.relative_to(ROOT)}”,
                file=sys.stderr,
            )
            return findings

        with path.open(
            “r”,
            encoding=“utf-8”,
            errors=“replace”,
        ) as file:

            for line_number, line in enumerate(file, start=1):

                relative_path = str(path.relative_to(ROOT))

                findings.extend(
                    scan_line(
                        relative_path,
                        line_number,
                        line,
                    )
                )

    except OSError as exc:

        print(
            f”[WARNING] Cannot read {path}: {exc}”,
            file=sys.stderr,
        )

    return findings


def scan_repository(all_files: bool = False) -> list[Finding]:
    “””Scan the repository for potential secrets.”””

    files = get_all_files() if all_files else get_tracked_files()

    print(f”[INFO] Scanning {len(files)} file(s).”)

    findings = []

    for path in files:
        findings.extend(scan_file(path))

    return findings


# =============================================================================
# REPORTING
# =============================================================================

def print_report(findings: list[Finding]) -> None:
    “””Print safe findings without revealing secret contents.”””

    print()
    print(“=“ * 72)
    print(“MEDORBITS REPOSITORY SECRET SCAN”)
    print(“=“ * 72)

    if not findings:

        print(“[PASS] No matching secrets detected.”)

    else:

        for finding in findings:

            print(
                f”[SECRET] {finding.file}:”
                f”{finding.line} — {finding.category}”
            )

        print()
        print(
            f”[FAIL] {len(findings)} potential secret finding(s).”
        )

        print(
            “[ACTION] Rotate exposed credentials and remove them “
            “from repository history where appropriate.”
        )

    print(“=“ * 72)


# =============================================================================
# ARGUMENTS
# =============================================================================

def parse_args() -> argparse.Namespace:
    “””Parse command-line arguments.”””

    parser = argparse.ArgumentParser(
        description=“MedOrbits repository secret scanner.”
    )

    parser.add_argument(
        “—all-files”,
        action=“store_true”,
        help=“Scan all eligible working-tree files, including untracked files.”,
    )

    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=“Reserved for stricter future scanning policies.”,
    )

    parser.add_argument(
        “—version”,
        action=“version”,
        version=f”MedOrbits Secret Scanner {VERSION}”,
    )

    return parser.parse_args()


# =============================================================================
# MAIN
# =============================================================================

def main() -> int:
    “””Execute the scanner.”””

    args = parse_args()

    print(f”[INFO] MedOrbits Secret Scanner {VERSION}”)
    print(f”[INFO] Repository: {ROOT}”)

    if args.strict:
        print(“[INFO] Strict mode enabled.”)

    try:

        findings = scan_repository(
            all_files=args.all_files
        )

        print_report(findings)

        return 1 if findings else 0

    except RuntimeError as exc:

        print(
            f”[ERROR] {exc}”,
            file=sys.stderr,
        )

        return 2

    except KeyboardInterrupt:

        print(
            “\n[ERROR] Scan interrupted.”,
            file=sys.stderr,
        )

        return 2


if __name__ == “__main__”:
    raise SystemExit(main())

# =============================================================================
# END OF MEDORBITS SECRET SCANNER
# =============================================================================
