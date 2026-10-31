#!/usr/bin/env python3
“””
MedOrbits — Repository Secret Scanner
File: .github/scripts/check-secrets.py
Version: 2.1.1

PURPOSE
    Detect potential credentials and sensitive key material in repository
    files, Git-tracked content, and optionally recent Git commit history.

DETECTION
    - Private key blocks.
    - AWS access key identifiers.
    - GitHub access tokens.
    - Slack tokens.
    - Google API keys.
    - Stripe secret and restricted keys.
    - SendGrid API keys.
    - Twilio API keys.
    - JWT-like tokens.
    - Credential-bearing database URLs.
    - Suspicious credential assignments.
    - Sensitive credential filenames.
    - Tracked environment and secret-store files.

SCAN MODES
    Default:
        Git-tracked and untracked readable repository files.

    —all-files:
        Include additional readable file types within the size limit.

    —include-history:
        Inspect recent Git commit diffs for common secret patterns.

SECURITY
    - Never prints matched secret values.
    - Does not read common local .env secret stores.
    - Does not modify repository files.
    - Does not automatically delete or rotate credentials.
    - Does not follow symbolic links.

USAGE
    python .github/scripts/check-secrets.py
    python .github/scripts/check-secrets.py —root .
    python .github/scripts/check-secrets.py —strict
    python .github/scripts/check-secrets.py —all-files
    python .github/scripts/check-secrets.py —exclude docs/examples
    python .github/scripts/check-secrets.py —include-history

EXIT CODES
    0: No findings at the selected severity threshold.
    1: Potential secrets detected.
    2: Invalid arguments or execution failure.

DEPENDENCIES
    Python standard library only.

LIMITATION
    This is a heuristic scanner. It does not replace GitHub Secret Scanning,
    push protection, Gitleaks, credential rotation, or security review.
“””

from __future__ import annotations

import argparse
import ipaddress
import re
import subprocess
import sys

from dataclasses import dataclass
from pathlib import Path
from typing import Pattern


# =============================================================================
# 01. APPLICATION CONFIGURATION
# =============================================================================

TOOL_NAME = “MedOrbits Repository Secret Scanner”
TOOL_VERSION = “2.1.1”

DEFAULT_MAX_BYTES = 1_000_000
DEFAULT_HISTORY_COMMITS = 100
DEFAULT_GIT_TIMEOUT = 30

PLACEHOLDER_FILES = {
    “.env.example”,
    “.env.sample”,
    “.env.template”,
}

LOCAL_SECRET_FILES = {
    “.env”,
    “.env.local”,
    “.env.production”,
    “.env.development”,
    “.env.staging”,
    “.env.test”,
    “.env.development.local”,
    “.env.production.local”,
}

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

TEXT_SUFFIXES = {
    “.txt”,
    “.md”,
    “.rst”,
    “.html”,
    “.htm”,
    “.css”,
    “.scss”,
    “.sass”,
    “.less”,
    “.js”,
    “.mjs”,
    “.cjs”,
    “.jsx”,
    “.ts”,
    “.tsx”,
    “.json”,
    “.jsonc”,
    “.json5”,
    “.yml”,
    “.yaml”,
    “.toml”,
    “.ini”,
    “.cfg”,
    “.conf”,
    “.properties”,
    “.xml”,
    “.svg”,
    “.py”,
    “.sh”,
    “.bash”,
    “.zsh”,
    “.ps1”,
    “.bat”,
    “.cmd”,
    “.sql”,
    “.env”,
    “.example”,
    “.sample”,
    “.template”,
    “.lock”,
    “.pem”,
    “.key”,
    “.pub”,
    “.crt”,
    “.cer”,
    “.p12”,
    “.pfx”,
    “.tf”,
    “.tfvars”,
    “.properties”,
    “.gradle”,
    “.properties”,
}

SENSITIVE_FILENAMES = {
    “id_rsa”,
    “id_ed25519”,
    “id_ecdsa”,
    “id_dsa”,
    “server.key”,
    “private.key”,
    “credentials.json”,
    “service-account.json”,
    “serviceaccount.json”,
    “secrets.json”,
    “secrets.yaml”,
    “secrets.yml”,
}

# Files deliberately excluded from content scanning.
# Their presence in Git is still reported separately.
SKIPPED_SECRET_STORE_NAMES = LOCAL_SECRET_FILES


# =============================================================================
# 02. SECRET DETECTION PATTERNS
# =============================================================================

SECRET_PATTERNS: list[tuple[str, Pattern[str]]] = [

    (
        “Private key block”,
        re.compile(
            r”——BEGIN\s+”
            r”(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+|PGP\s+)?”
            r”PRIVATE KEY——“,
            re.IGNORECASE,
        ),
    ),

    (
        “AWS access key ID”,
        re.compile(
            r”\bAKIA[0-9A-Z]{16}\b”
        ),
    ),

    (
        “AWS temporary access key ID”,
        re.compile(
            r”\bASIA[0-9A-Z]{16}\b”
        ),
    ),

    (
        “GitHub personal access token”,
        re.compile(
            r”\bgh[pousr]_[A-Za-z0-9_]{20,}\b”
        ),
    ),

    (
        “GitHub fine-grained token”,
        re.compile(
            r”\bgithub_pat_[A-Za-z0-9_]{20,}\b”
        ),
    ),

    (
        “Slack token”,
        re.compile(
            r”\bxox[baprs]-[A-Za-z0-9-]{10,}\b”
        ),
    ),

    (
        “Google API key”,
        re.compile(
            r”\bAIza[0-9A-Za-z_-]{30,}\b”
        ),
    ),

    (
        “Stripe live secret key”,
        re.compile(
            r”\bsk_live_[A-Za-z0-9]{16,}\b”
        ),
    ),

    (
        “Stripe restricted key”,
        re.compile(
            r”\brk_live_[A-Za-z0-9]{16,}\b”
        ),
    ),

    (
        “SendGrid API key”,
        re.compile(
            r”\bSG\.[A-Za-z0-9_-]{16,}\.”
            r”[A-Za-z0-9_-]{16,}\b”
        ),
    ),

    (
        “Twilio API key”,
        re.compile(
            r”\bSK[0-9a-fA-F]{32}\b”
        ),
    ),

    (
        “JWT-like token”,
        re.compile(
            r”\beyJ[A-Za-z0-9_-]{8,}\.”
            r”[A-Za-z0-9_-]{8,}\.”
            r”[A-Za-z0-9_-]{8,}\b”
        ),
    ),

    (
        “Credential-bearing database URL”,
        re.compile(
            r”\b(?:postgres(?:ql)?|mysql|”
            r”mongodb(?:\+srv)?|redis|amqp)”
            r”://[^/\s:@]+:[^/\s@]+@“,
            re.IGNORECASE,
        ),
    ),

    (
        “Generic bearer credential”,
        re.compile(
            r”\bBearer\s+[A-Za-z0-9._~+/-]{24,}”
            r”={0,2}”,
            re.IGNORECASE,
        ),
    ),
]


# =============================================================================
# 03. CREDENTIAL ASSIGNMENT DETECTION
# =============================================================================

SECRET_KEY_RE = re.compile(
    r”””
    (?ix)
    (?:
        PASSWORD
        | PASSWD
        | SECRET
        | TOKEN
        | API_KEY
        | PRIVATE_KEY
        | ACCESS_KEY
        | CLIENT_SECRET
        | AUTH_KEY
        | CREDENTIALS
        | DATABASE_URL
        | CONNECTION_STRING
        | SIGNING_KEY
        | ENCRYPTION_KEY
    )
    “””,
    re.VERBOSE,
)

ASSIGNMENT_RE = re.compile(
    r”””
    (?imx)
    (?P<key>
        [A-Za-z_][A-Za-z0-9_]*
    )
    \s*
    (?:
        =
        |
        :
    )
    \s*
    (?P<value>
        “(?:\\.|[^”])*”
        |
        ‘(?:\\.|[^’])*’
        |
        `(?:\\.|[^`])*`
        |
        [^\s,;]+
    )
    “””,
    re.VERBOSE,
)


# =============================================================================
# 04. PLACEHOLDER RECOGNITION
# =============================================================================

PLACEHOLDER_RE = re.compile(
    r”””
    (?ix)^
    (?:
        |
        null
        | none
        | false
        | true
        | undefined
        | changeme
        | change[_ -]?me
        | replace[_ -]?me
        | example
        | placeholder
        | todo
        | not[_ -]?set
        | your[_ -].*
        | <[^>]*>
        | \{\{.*\}\}
        | \$\{[^}]+\}
        | \$[A-Z_][A-Z0-9_]*
        | \*+
        | x+
        | 0+
    )
    $
    “””,
    re.VERBOSE,
)

SAFE_EXAMPLE_VALUES = {
    “example_password”,
    “example_token”,
    “example_secret”,
    “example_api_key”,
    “your_api_key_here”,
    “your_secret_here”,
    “your_password_here”,
    “replace_with_real_value”,
    “replace_with_your_value”,
    “replace_me”,
    “change_me”,
    “changeme”,
    “placeholder”,
    “not_set”,
    “your_token_here”,
    “your_client_secret_here”,
}


# =============================================================================
# 05. SENSITIVE FILE IDENTIFICATION
# =============================================================================

SENSITIVE_NAME_RE = re.compile(
    r”””
    (?ix)
    (?:^|[._-])
    (?:
        id_rsa
        | id_ed25519
        | id_ecdsa
        | id_dsa
        | private[_-]?key
        | service[_-]?account
        | credentials
        | secrets?
    )
    (?:[._-]|$)
    “””,
    re.VERBOSE,
)


# =============================================================================
# 06. DATA STRUCTURES
# =============================================================================

@dataclass(frozen=True)
class Finding:
    severity: str
    path: str
    line: int
    rule: str
    message: str


# =============================================================================
# 07. COMMAND-LINE ARGUMENTS
# =============================================================================

def parse_args() -> argparse.Namespace:

    parser = argparse.ArgumentParser(
        prog=“check-secrets.py”,
        description=(
            “Scan MedOrbits repository files for potential exposed secrets.”
        ),
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
        help=“Fail when warnings or errors are detected.”,
    )

    parser.add_argument(
        “—all-files”,
        action=“store_true”,
        help=(
            “Inspect all readable files within the configured “
            “file-size limit.”
        ),
    )

    parser.add_argument(
        “—max-bytes”,
        type=int,
        default=DEFAULT_MAX_BYTES,
        help=“Maximum file size to scan in bytes.”,
    )

    parser.add_argument(
        “—exclude”,
        action=“append”,
        default=[],
        help=“Exclude a repository-relative path; may be repeated.”,
    )

    parser.add_argument(
        “—include-history”,
        action=“store_true”,
        help=“Inspect recent Git commit diffs for common secret patterns.”,
    )

    parser.add_argument(
        “—history-commits”,
        type=int,
        default=DEFAULT_HISTORY_COMMITS,
        help=“Maximum number of recent commits to inspect.”,
    )

    parser.add_argument(
        “—no-git-check”,
        action=“store_true”,
        help=“Skip checks for tracked secret-store filenames.”,
    )

    return parser.parse_args()


# =============================================================================
# 08. PATH UTILITIES
# =============================================================================

def normalize_relative(
    path: Path,
    root: Path,
) -> str:

    try:
        return path.relative_to(root).as_posix()

    except ValueError:
        return path.as_posix()


def is_ignored(
    path: Path,
    root: Path,
    excludes: set[str],
) -> bool:

    try:
        relative = path.relative_to(root)

    except ValueError:
        return True

    if any(
        part in IGNORED_DIRS
        for part in relative.parts
    ):
        return True

    name = path.name.lower()

    if name in SKIPPED_SECRET_STORE_NAMES:
        return True

    normalized = relative.as_posix()

    for excluded in excludes:

        if (
            normalized == excluded
            or normalized.startswith(
                excluded.rstrip(“/“) + “/“
            )
        ):
            return True

    return False


# =============================================================================
# 09. GIT TRACKING
# =============================================================================

def list_git_files(
    root: Path,
) -> set[str] | None:

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
            timeout=15,
        )

    except (
        OSError,
        subprocess.SubprocessError,
    ):
        return None

    if result.returncode != 0:
        return None

    return {
        item.decode(
            “utf-8”,
            errors=“replace”,
        )
        for item in result.stdout.split(b”\0”)
        if item
    }


def check_tracked_secret_files(
    root: Path,
    tracked: set[str] | None,
) -> list[Finding]:

    findings: list[Finding] = []

    if tracked is None:

        return [
            Finding(
                “WARNING”,
                “.git”,
                0,
                “Git tracking unavailable”,
                “Could not verify tracked secret-store filenames.”,
            )
        ]

    for filename in sorted(tracked):

        path = Path(filename)
        name = path.name.lower()

        is_env_secret = (
            name.startswith(“.env”)
            and name not in PLACEHOLDER_FILES
        )

        is_sensitive_file = (
            name in SENSITIVE_FILENAMES
            or bool(SENSITIVE_NAME_RE.search(name))
        )

        if is_env_secret or is_sensitive_file:

            findings.append(
                Finding(
                    “ERROR”,
                    filename,
                    0,
                    “Tracked secret-bearing file”,
                    (
                        “A potentially sensitive file is tracked by Git. “
                        “Verify its contents and remove exposed credentials “
                        “from repository history when necessary.”
                    ),
                )
            )

    return findings


# =============================================================================
# 10. REPOSITORY FILE DISCOVERY
# =============================================================================

def collect_files(
    root: Path,
    excludes: set[str],
    all_files: bool,
    max_bytes: int,
    tracked: set[str] | None,
) -> list[Path]:

    paths: set[Path] = set()

    # Git-tracked files.
    if tracked is not None:

        for filename in tracked:

            path = root / filename

            try:

                if path.is_file() and not path.is_symlink():
                    paths.add(path)

            except OSError:
                continue

    # Working-tree files, including untracked and ignored files.
    # Ignored directories and configured exclusions remain excluded.
    for path in root.rglob(“*”):

        try:

            if path.is_symlink() or not path.is_file():
                continue

            paths.add(path)

        except OSError:
            continue

    result: list[Path] = []

    for path in sorted(paths):

        if is_ignored(
            path,
            root,
            excludes,
        ):
            continue

        try:

            if path.stat().st_size > max_bytes:
                continue

        except OSError:
            continue

        if not all_files:

            if (
                path.suffix.lower() not in TEXT_SUFFIXES
                and path.name not in SENSITIVE_FILENAMES
            ):
                continue

        result.append(path)

    return result


# =============================================================================
# 11. PLACEHOLDER VALIDATION
# =============================================================================

def normalize_value(
    value: str,
) -> str:

    normalized = value.strip()

    # Remove surrounding quotes and common inline delimiters.
    if len(normalized) >= 2:

        if (
            normalized[0] == normalized[-1]
            and normalized[0] in {“’”, ‘”’, “`”}
        ):
            normalized = normalized[1:-1]

    return normalized.strip()


def is_placeholder(
    value: str,
) -> bool:

    normalized = normalize_value(value)

    if not normalized:
        return True

    if normalized.lower() in SAFE_EXAMPLE_VALUES:
        return True

    if PLACEHOLDER_RE.fullmatch(normalized):
        return True

    return False


# =============================================================================
# 12. DIAGNOSTIC UTILITIES
# =============================================================================

def line_number_at(
    text: str,
    offset: int,
) -> int:

    return text.count(
        “\n”,
        0,
        offset,
    ) + 1


def add_finding(
    findings: list[Finding],
    root: Path,
    path: Path,
    line: int,
    severity: str,
    rule: str,
    message: str,
) -> None:

    findings.append(
        Finding(
            severity=severity,
            path=normalize_relative(path, root),
            line=line,
            rule=rule,
            message=message,
        )
    )


# =============================================================================
# 13. CONTENT SCANNER
# =============================================================================

def scan_text(
    path: Path,
    root: Path,
    text: str,
) -> list[Finding]:

    findings: list[Finding] = []

    is_example = (
        path.name.lower() in PLACEHOLDER_FILES
    )

    # -————————————————————————
    # High-confidence secret patterns.
    # -————————————————————————

    for rule, pattern in SECRET_PATTERNS:

        for match in pattern.finditer(text):

            # Documentation templates may intentionally describe token
            # formats, but private-key blocks remain prohibited.
            if (
                is_example
                and rule != “Private key block”
            ):
                continue

            add_finding(
                findings,
                root,
                path,
                line_number_at(text, match.start()),
                “ERROR”,
                rule,
                (
                    f”Potential {rule.lower()} detected. “
                    “Matched content has been redacted.”
                ),
            )

    # -————————————————————————
    # Credential-like assignments.
    # -————————————————————————

    for match in ASSIGNMENT_RE.finditer(text):

        key = match.group(“key”)
        value = normalize_value(
            match.group(“value”)
        )

        if not SECRET_KEY_RE.search(key):
            continue

        if is_placeholder(value):
            continue

        # Avoid obvious non-secret configuration values.
        if value.lower() in {
            “true”,
            “false”,
            “null”,
            “none”,
            “undefined”,
        }:
            continue

        # Avoid reporting extremely short values as confirmed credentials.
        if len(value) < 8:
            continue

        severity = “WARNING”

        # Example files are expected to contain configuration assignments.
        # Long non-placeholder values still deserve review.
        if is_example and len(value) < 12:
            continue

        add_finding(
            findings,
            root,
            path,
            line_number_at(text, match.start()),
            severity,
            “Credential-like assignment”,
            (
                f”Variable ‘{key}’ contains a non-placeholder value. “
                “Review whether it is a real credential. Value redacted.”
            ),
        )

    # -————————————————————————
    # Private-key marker fallback.
    # -————————————————————————

    private_key_marker = re.search(
        r”——BEGIN\s+”
        r”(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+|PGP\s+)?”
        r”PRIVATE KEY——“,
        text,
        re.IGNORECASE,
    )

    if (
        private_key_marker
        and not any(
            finding.rule == “Private key block”
            for finding in findings
        )
    ):

        add_finding(
            findings,
            root,
            path,
            line_number_at(
                text,
                private_key_marker.start(),
            ),
            “ERROR”,
            “Private key material”,
            “Potential private-key content detected. Content redacted.”,
        )

    # -————————————————————————
    # Sensitive filenames.
    # -————————————————————————

    if (
        SENSITIVE_NAME_RE.search(path.name)
        or path.name.lower() in SENSITIVE_FILENAMES
    ):

        add_finding(
            findings,
            root,
            path,
            0,
            “WARNING”,
            “Sensitive filename”,
            (
                “Filename suggests credentials or cryptographic key material. “
                “Verify that this file belongs in the repository.”
            ),
        )

    return findings


# =============================================================================
# 14. BINARY FILE DETECTION
# =============================================================================

def is_binary(
    content: bytes,
) -> bool:

    if b”\x00” in content:
        return True

    if not content:
        return False

    sample = content[:8192]

    try:
        sample.decode(“utf-8”)

    except UnicodeDecodeError:
        return True

    return False


# =============================================================================
# 15. FILE SCANNING
# =============================================================================

def scan_file(
    path: Path,
    root: Path,
) -> list[Finding]:

    try:

        content = path.read_bytes()

    except OSError:

        return [
            Finding(
                “WARNING”,
                normalize_relative(path, root),
                0,
                “Read failure”,
                “File could not be read; scanning skipped.”,
            )
        ]

    if is_binary(content):
        return []

    text = content.decode(
        “utf-8-sig”,
        errors=“replace”,
    )

    return scan_text(
        path,
        root,
        text,
    )


# =============================================================================
# 16. GIT HISTORY SCANNING
# =============================================================================

def scan_git_history(
    root: Path,
    max_commits: int,
) -> list[Finding]:

    findings: list[Finding] = []

    try:

        result = subprocess.run(
            [
                “git”,
                “-C”,
                str(root),
                “log”,
                “—all”,
                “—format=%H”,
                “-n”,
                str(max_commits),
            ],
            check=False,
            capture_output=True,
            text=True,
            encoding=“utf-8”,
            errors=“replace”,
            timeout=DEFAULT_GIT_TIMEOUT,
        )

    except (
        OSError,
        subprocess.SubprocessError,
    ):

        return [
            Finding(
                “WARNING”,
                “.git”,
                0,
                “History scan unavailable”,
                “Could not inspect Git commit history.”,
            )
        ]

    if result.returncode != 0:

        return [
            Finding(
                “WARNING”,
                “.git”,
                0,
                “History scan unavailable”,
                “Git history could not be accessed.”,
            )
        ]

    commits = [
        item.strip()
        for item in result.stdout.splitlines()
        if item.strip()
    ]

    for commit in commits:

        try:

            diff = subprocess.run(
                [
                    “git”,
                    “-C”,
                    str(root),
                    “show”,
                    “—format=“,
                    “—no-ext-diff”,
                    “—no-renames”,
                    “—unified=0”,
                    commit,
                    “—“,
                ],
                check=False,
                capture_output=True,
                timeout=DEFAULT_GIT_TIMEOUT,
            )

        except (
            OSError,
            subprocess.SubprocessError,
        ):
            continue

        if diff.returncode != 0:
            continue

        content = diff.stdout.decode(
            “utf-8”,
            errors=“replace”,
        )

        # Inspect added lines only. Removed lines are not new exposures.
        added_lines = []

        for line in content.splitlines():

            if line.startswith(“+++”) or line.startswith(“—“):
                continue

            if line.startswith(“+”):
                added_lines.append(line[1:])

        added_content = “\n”.join(added_lines)

        for rule, pattern in SECRET_PATTERNS:

            match = pattern.search(added_content)

            if match:

                findings.append(
                    Finding(
                        “WARNING”,
                        “.git”,
                        0,
                        f”Historical {rule}”,
                        (
                            f”Potential {rule.lower()} found in commit “
                            f”{commit[:12]}. Matched value redacted.”
                        ),
                    )
                )

                break

    return findings


# =============================================================================
# 17. FINDING DEDUPLICATION
# =============================================================================

def deduplicate_findings(
    findings: list[Finding],
) -> list[Finding]:

    unique: dict[
        tuple[str, str, int, str, str],
        Finding,
    ] = {}

    for finding in findings:

        key = (
            finding.severity,
            finding.path,
            finding.line,
            finding.rule,
            finding.message,
        )

        unique[key] = finding

    return sorted(
        unique.values(),
        key=lambda item: (
            item.severity != “ERROR”,
            item.path,
            item.line,
            item.rule,
        ),
    )


# =============================================================================
# 18. REPORTING
# =============================================================================

def print_report(
    findings: list[Finding],
    scanned_files: int,
    skipped_binary: int,
    strict: bool,
    history_enabled: bool,
) -> int:

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

    for finding in findings:

        location = finding.path

        if finding.line:
            location += f”:{finding.line}”

        print(
            f”{finding.severity}: “
            f”{location}: “
            f”[{finding.rule}] “
            f”{finding.message}”
        )

    print()

    print(“=“ * 72)
    print(“MedOrbits Repository Security Scan”)
    print(“=“ * 72)

    print(
        f”Files inspected:        {scanned_files}”
    )

    print(
        f”Binary files skipped:   {skipped_binary}”
    )

    print(
        f”Potential secrets:      {len(errors)}”
    )

    print(
        f”Warnings:               {len(warnings)}”
    )

    print(
        f”Git history scan:       “
        f”{‘Enabled’ if history_enabled else ‘Disabled’}”
    )

    print(“=“ * 72)

    if errors:

        print(
            “RESULT: FAILED — potential exposed secrets detected.”
        )

        return 1

    if strict and warnings:

        print(
            “RESULT: FAILED — strict mode does not permit warnings.”
        )

        return 1

    print(
        “RESULT: PASSED — no findings at the selected severity threshold.”
    )

    print(
        “NOTE: Heuristic scanning cannot guarantee that the repository “
        “contains no secrets.”
    )

    return 0


# =============================================================================
# 19. MAIN VALIDATION
# =============================================================================

def main() -> int:

    args = parse_args()

    root = args.root.resolve()

    # -————————————————————————
    # Validate command-line configuration.
    # -————————————————————————

    if not root.exists() or not root.is_dir():

        print(
            f”ERROR: Repository root is not a directory: {root}”,
            file=sys.stderr,
        )

        return 2

    if args.max_bytes <= 0:

        print(
            “ERROR: —max-bytes must be greater than zero.”,
            file=sys.stderr,
        )

        return 2

    if args.history_commits <= 0:

        print(
            “ERROR: —history-commits must be greater than zero.”,
            file=sys.stderr,
        )

        return 2

    for item in args.exclude:

        if Path(item).is_absolute():

            print(
                “ERROR: —exclude must use repository-relative paths.”,
                file=sys.stderr,
            )

            return 2

    # -————————————————————————
    # Prepare repository exclusions.
    # -————————————————————————

    excludes = {
        item.strip().strip(“/“)
        for item in args.exclude
        if item.strip()
    }

    # -————————————————————————
    # Discover Git-tracked files.
    # -————————————————————————

    tracked = list_git_files(root)

    findings: list[Finding] = []

    if not args.no_git_check:

        findings.extend(
            check_tracked_secret_files(
                root,
                tracked,
            )
        )

    # -————————————————————————
    # Discover repository files.
    # -————————————————————————

    files = collect_files(
        root=root,
        excludes=excludes,
        all_files=args.all_files,
        max_bytes=args.max_bytes,
        tracked=tracked,
    )

    # -————————————————————————
    # Scan repository content.
    # -————————————————————————

    scanned_files = 0
    skipped_binary = 0

    for path in files:

        try:

            content = path.read_bytes()

        except OSError:

            findings.append(
                Finding(
                    “WARNING”,
                    normalize_relative(path, root),
                    0,
                    “Read failure”,
                    “File could not be read; scanning skipped.”,
                )
            )

            continue

        if is_binary(content):

            skipped_binary += 1
            continue

        text = content.decode(
            “utf-8-sig”,
            errors=“replace”,
        )

        scanned_files += 1

        findings.extend(
            scan_text(
                path,
                root,
                text,
            )
        )

    # -————————————————————————
    # Optional Git history scan.
    # -————————————————————————

    if args.include_history:

        findings.extend(
            scan_git_history(
                root,
                args.history_commits,
            )
        )

    # -————————————————————————
    # Final diagnostics.
    # -————————————————————————

    findings = deduplicate_findings(
        findings
    )

    return print_report(
        findings=findings,
        scanned_files=scanned_files,
        skipped_binary=skipped_binary,
        strict=args.strict,
        history_enabled=args.include_history,
    )


# =============================================================================
# 20. SCRIPT ENTRY POINT
# =============================================================================

if __name__ == “__main__”:

    try:

        raise SystemExit(
            main()
        )

    except KeyboardInterrupt:

        print(
            “\nERROR: Secret scanning interrupted.”,
            file=sys.stderr,
        )

        raise SystemExit(2)

    except Exception:

        # Do not expose raw file contents, credential values or
        # unexpected exception details in diagnostics.
        print(
            “ERROR: Unexpected secret scanner execution failure.”,
            file=sys.stderr,
        )

        raise SystemExit(2)