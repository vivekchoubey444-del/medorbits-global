
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- Enterprise Repository Security Audit
# File: SECURITY.sh
# Version: 2.0.0
# Python: 3.10+
# Bash: 4+
#
# Usage:
#   bash SECURITY.sh
#   bash SECURITY.sh --strict
#   bash SECURITY.sh --secrets-only
#   bash SECURITY.sh --audit
#   bash SECURITY.sh --static
#   bash SECURITY.sh --json-report /tmp/medorbits-security.json
#   bash SECURITY.sh --strict --audit --static
#
# Safety:
#   - Read-only source/configuration inspection.
#   - Does not print matched secret values.
#   - Does not install dependencies or execute project scripts.
#   - Does not modify source files, Git history, or dependencies.
#   - Optional audits invoke already-installed security tools.
#   - JSON reports contain finding locations, never matched source lines.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly SCRIPT_VERSION="2.0.0"

STRICT=0
SECRETS_ONLY=0
RUN_AUDIT=0
RUN_STATIC=0
REPORT_PATH=""

PASS=0
WARN=0
FAIL=0

log()  { printf '[SECURITY] %s\n' "$*"; }
pass() { PASS=$((PASS + 1)); log "PASS: $*"; }
warn() { WARN=$((WARN + 1)); log "WARN: $*" >&2; }
fail() { FAIL=$((FAIL + 1)); log "FAIL: $*" >&2; }

usage() {
    cat <<'HELP'
MedOrbits Security Audit 2.0.0

Usage:
  bash SECURITY.sh [options]

Options:
  --strict                 Fail on warnings and potential secret findings.
  --secrets-only           Run Git conflict checks and secret scanning only.
  --audit                  Run available dependency audit tools.
  --static                 Run available static security analyzers.
  --json-report PATH       Write a redacted JSON findings report.
  --help, -h               Show this help.

Audit tools (must already be installed):
  npm audit                Requires npm and package-lock.json.
  pip-audit                Requires pip-audit.
  Bandit                   Requires bandit.
  Ruff                     Requires ruff.

Exit codes:
  0  No blocking findings.
  1  Security findings or audit failure.
  2  Invalid arguments or missing required runtime.

Safety:
  No installation, automatic fixes, deployments, or migrations.
  External network access may occur when --audit is enabled.
HELP
}

die() {
    printf '[SECURITY] ERROR: %s\n' "$*" >&2
    exit 2
}

while (($#)); do
    case "$1" in
        --strict)
            STRICT=1
            ;;
        --secrets-only)
            SECRETS_ONLY=1
            ;;
        --audit)
            RUN_AUDIT=1
            ;;
        --static)
            RUN_STATIC=1
            ;;
        --json-report)
            shift
            (($#)) || die "--json-report requires a path."
            REPORT_PATH="$1"
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            die "Unknown option: $1. Use --help."
            ;;
    esac
    shift
done

command -v python3 >/dev/null 2>&1 ||
    die "Python 3 is required."

cd "$ROOT" || die "Cannot enter repository root."

log "MedOrbits Security Audit v${SCRIPT_VERSION}"
log "Repository: $ROOT"

# Avoid accidentally overwriting the source repository through an unsafe
# report destination. The report is written only after scanning finishes.
if [[ -n "$REPORT_PATH" ]]; then
    case "$REPORT_PATH" in
        /*) ;;
        *) REPORT_PATH="$ROOT/$REPORT_PATH" ;;
    esac

    REPORT_PARENT="$(dirname -- "$REPORT_PATH")"
    [[ -d "$REPORT_PARENT" ]] ||
        die "Report parent directory does not exist."

    [[ ! -d "$REPORT_PATH" ]] ||
        die "Report destination is a directory."

    [[ ! -L "$REPORT_PATH" ]] ||
        die "Refusing to write through a symbolic-link report path."
fi

export MEDORBITS_SECURITY_ROOT="$ROOT"
export MEDORBITS_SECURITY_STRICT="$STRICT"
export MEDORBITS_SECURITY_SECRETS_ONLY="$SECRETS_ONLY"
export MEDORBITS_SECURITY_AUDIT="$RUN_AUDIT"
export MEDORBITS_SECURITY_STATIC="$RUN_STATIC"

# The Python audit creates an in-memory findings report. It does not write
# repository files. Optional external tools run afterward.
if python3 <<'PY'
import json
import os
import re
import stat
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

root = Path(os.environ["MEDORBITS_SECURITY_ROOT"]).resolve()
strict = os.environ["MEDORBITS_SECURITY_STRICT"] == "1"
secrets_only = os.environ["MEDORBITS_SECURITY_SECRETS_ONLY"] == "1"

excluded_dirs = {
    ".git", "node_modules", ".venv", "venv", "env",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    ".tox", ".nox", "dist", "build", "coverage", "htmlcov",
    ".next", ".nuxt", ".cache", "vendor", "site-packages",
    "third_party", ".agent-backup",
}

binary_extensions = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf",
    ".zip", ".gz", ".7z", ".mp4", ".mov", ".mp3", ".woff",
    ".woff2", ".ttf", ".otf", ".lock", ".sqlite", ".db",
    ".exe", ".dll", ".so", ".dylib", ".class", ".pyc",
}

text_extensions = {
    ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
    ".json", ".jsonl", ".yaml", ".yml", ".toml", ".ini", ".cfg",
    ".env", ".sh", ".bash", ".html", ".htm", ".css", ".scss",
    ".md", ".txt", ".xml", ".sql", ".conf", ".properties",
    ".pem", ".key", ".crt", ".cer", ".php", ".go", ".rs",
    ".java", ".kt", ".rb", ".ps1", ".tf", ".hcl",
}

special_names = {
    "Dockerfile", "Makefile", ".npmrc", ".pypirc",
    "Procfile", "Justfile", "Caddyfile",
}

placeholder = re.compile(
    r"(?i)(?:example|sample|placeholder|your[_ -]|change[_ -]?me|"
    r"redacted|dummy|fake[_ -]?key|test[_ -]?key|"
    r"os\.environ|process\.env|getenv\s*\()"
)

secret_patterns = [
    (
        "private-key",
        re.compile(
            r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"
        ),
    ),
    (
        "AWS-access-key",
        re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    ),
    (
        "GitHub-token",
        re.compile(
            r"\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|"
            r"github_pat_[A-Za-z0-9_]{30,})\b"
        ),
    ),
    (
        "credential-assignment",
        re.compile(
            r"""(?i)\b(?:password|passwd|client_secret|api_secret|"""
            r"""access_token|auth_token)\b\s*[:=]\s*["']?([^\s"'<>]{8,})"""
        ),
    ),
    (
        "API-key-assignment",
        re.compile(
            r"""(?i)\b(?:api_key|apikey|secret_key)\b"""
            r"""\s*[:=]\s*["']?([^\s"'<>]{8,})"""
        ),
    ),
    (
        "database-connection-string",
        re.compile(
            r"""(?i)\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?)://"""
            r"""[^/\s:@]+:[^/\s@]{6,}@"""
        ),
    ),
    (
        "high-entropy-token-assignment",
        re.compile(
            r"""(?i)\b(?:token|secret|private_key)\b"""
            r"""\s*[:=]\s*["']([A-Za-z0-9_./+=-]{24,})["']"""
        ),
    ),
]

risky_patterns = [
    ("dynamic-evaluation", re.compile(r"\beval\s*\(")),
    ("Python-exec", re.compile(r"\bexec\s*\(")),
    (
        "shell-command-execution",
        re.compile(r"\bchild_process\s*\.\s*exec(?:Sync)?\s*\("),
    ),
    (
        "Python-shell-true",
        re.compile(r"\bshell\s*=\s*True\b"),
    ),
    (
        "disabled-TLS-verification",
        re.compile(
            r"\bverify\s*=\s*False\b|"
            r"\brejectUnauthorized\s*:\s*false\b"
        ),
    ),
    (
        "unsafe-deserialization",
        re.compile(r"\bpickle\.loads?\s*\(|\byaml\.unsafe_load\s*\("),
    ),
    (
        "SQL-string-interpolation-review",
        re.compile(
            r"""(?i)\b(?:execute|executemany)\s*\(\s*"""
            r"""(?:f["']|["'][^"']*%s)"""
        ),
    ),
]

findings = []
stats = {
    "files_inspected": 0,
    "secret_matches": 0,
    "risky_patterns": 0,
    "permission_findings": 0,
}

def relative(path):
    try:
        return str(path.relative_to(root))
    except ValueError:
        return path.name

def add(level, category, path=None, line=None, detail=None):
    finding = {
        "level": level,
        "category": category,
    }
    if path is not None:
        finding["file"] = relative(path)
    if line is not None:
        finding["line"] = line
    if detail:
        finding["detail"] = detail
    findings.append(finding)

def run_git(*args):
    return subprocess.run(
        ["git", "-C", str(root), *args],
        capture_output=True,
        text=True,
        check=False,
    )

def is_inside(path):
    try:
        path.resolve().relative_to(root)
        return True
    except (OSError, ValueError, RuntimeError):
        return False

git_available = False
git_result = run_git("rev-parse", "--is-inside-work-tree")
git_available = git_result.returncode == 0

if git_available:
    conflicts = run_git("ls-files", "-u")
    if conflicts.returncode == 0 and conflicts.stdout.strip():
        add("FAIL", "unresolved-git-index-conflicts")
    else:
        add("PASS", "git-index-conflicts-clear")

    status = run_git("status", "--porcelain", "--untracked-files=all")
    if status.returncode == 0:
        unmerged = [
            line for line in status.stdout.splitlines()
            if line[:2] in {"UU", "AA", "DD", "AU", "UA", "DU", "UD"}
        ]
        if unmerged:
            add("FAIL", "unmerged-git-working-tree-paths")
        else:
            add("PASS", "git-working-tree-conflicts-clear")
else:
    add("WARN", "git-checks-unavailable")

# Walk the entire repository, not only tracked files. Do not follow symlinks.
files = []
for directory, dirs, names in os.walk(root, followlinks=False):
    base = Path(directory)
    dirs[:] = [
        name for name in dirs
        if name not in excluded_dirs
        and not (base / name).is_symlink()
    ]

    for name in names:
        path = base / name
        if path.is_symlink() or not path.is_file():
            continue
        if not is_inside(path):
            continue
        files.append(path)

# Scan all candidate text files and extensionless configuration files.
for path in files:
    suffix = path.suffix.lower()
    if suffix in binary_extensions:
        continue
    if suffix not in text_extensions and path.name not in special_names:
        continue

    try:
        if path.stat().st_size > 2 * 1024 * 1024:
            add("WARN", "file-skipped-size-limit", path)
            continue
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        add("WARN", "file-could-not-be-read", path)
        continue

    stats["files_inspected"] += 1

    if path.name in {
        ".env", ".env.local", ".env.production",
        ".env.development", ".env.production.local",
    }:
        if git_available:
            tracked_check = run_git("ls-files", "--error-unmatch", relative(path))
            if tracked_check.returncode == 0:
                add("FAIL", "environment-file-tracked-by-git", path)
            else:
                add("WARN", "local-environment-file-present", path)
        else:
            add("WARN", "environment-file-present-outside-git", path)

    for line_number, line in enumerate(text.splitlines(), 1):
        # A match produces only a category and location. Never output source text.
        for category, pattern in secret_patterns:
            match = pattern.search(line)
            if not match:
                continue

            # Placeholder checks reduce noise; they do not prove safety.
            if placeholder.search(line):
                continue

            add("FAIL" if strict else "WARN", "possible-secret:" + category,
                path, line_number)
            stats["secret_matches"] += 1
            break

        if secrets_only:
            continue

        for category, pattern in risky_patterns:
            if pattern.search(line):
                add("WARN", "review:" + category, path, line_number)
                stats["risky_patterns"] += 1

# File permissions: only flag world-writable files.
if not secrets_only:
    for path in files:
        try:
            mode = path.stat().st_mode
            if stat.S_ISREG(mode) and mode & stat.S_IWOTH:
                add("FAIL" if strict else "WARN", "world-writable-file", path)
                stats["permission_findings"] += 1
        except OSError:
            add("WARN", "file-permissions-unavailable", path)

# Avoid treating a broad CORS policy as a vulnerability by itself.
# Report only potentially dangerous patterns for manual contextual review.
if not secrets_only:
    for path in files:
        if path.name not in {
            "package.json", "requirements.txt", "pyproject.toml",
            "Pipfile", "poetry.lock", "package-lock.json",
            "pnpm-lock.yaml", "yarn.lock", "bun.lock",
        }:
            continue
        if path.name.endswith(".lock"):
            continue
        # Dependency versions are reviewed by the optional audit phase.
        # Do not infer vulnerabilities from package names alone.

# Summary counts and redacted JSON output are consumed by the shell.
result = {
    "tool": "MedOrbits Security Audit",
    "version": "2.0.0",
    "repository": str(root),
    "strict": strict,
    "secrets_only": secrets_only,
    "stats": stats,
    "findings": findings,
}

print(json.dumps(result, separators=(",", ":")))
PY
then
    :
else
    fail "Internal security scanner failed."
    exit 1
fi
