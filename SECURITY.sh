
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- Repository Security Audit
# File: SECURITY.sh
# Version: 1.0.0
#
# Usage:
#   bash SECURITY.sh
#   bash SECURITY.sh --strict
#   bash SECURITY.sh --secrets-only
#   bash SECURITY.sh --help
#
# Safety:
#   - Read-only source and configuration inspection.
#   - Does not print matched secret values.
#   - Does not execute project scripts or install dependencies.
#   - Never modifies Git history or repository files.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

STRICT=0
SECRETS_ONLY=0
PASS=0
WARN=0
FAIL=0

log()  { printf '[SECURITY] %s\n' "$*"; }
pass() { ((PASS += 1)); log "PASS: $*"; }
warn() { ((WARN += 1)); log "WARN: $*" >&2; }
fail() { ((FAIL += 1)); log "FAIL: $*" >&2; }

usage() {
    cat <<'HELP'
MedOrbits Repository Security Audit

Usage:
  bash SECURITY.sh [options]

Options:
  --strict        Treat missing security tools as failures.
  --secrets-only  Check tracked source/config files for likely secrets.
  --help          Display this help.

Checks:
  - Git working-tree conflict indicators
  - Likely hard-coded credentials and private keys
  - Risky file permissions
  - Dependency audit tool availability
  - Common dangerous code patterns
HELP
}

while (($#)); do
    case "$1" in
        --strict) STRICT=1 ;;
        --secrets-only) SECRETS_ONLY=1 ;;
        --help|-h) usage; exit 0 ;;
        *) printf 'Unknown option: %s\n' "$1" >&2; exit 2 ;;
    esac
    shift
done

command -v python3 >/dev/null 2>&1 || {
    printf 'Python 3 is required.\n' >&2
    exit 2
}

cd "$ROOT"
log "Repository: $ROOT"

# Use Python for safe, read-only scanning and redacted findings.
python3 - "$ROOT" "$STRICT" "$SECRETS_ONLY" <<'PY'
import os
import re
import stat
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
strict = sys.argv[2] == "1"
secrets_only = sys.argv[3] == "1"

excluded_dirs = {
    ".git", "node_modules", ".venv", "venv", "__pycache__",
    "dist", "build", "coverage", ".next", ".cache",
}
excluded_extensions = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf",
    ".zip", ".gz", ".7z", ".mp4", ".mov", ".mp3", ".woff",
    ".woff2", ".ttf", ".otf", ".lock",
}
text_extensions = {
    ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
    ".json", ".jsonl", ".yaml", ".yml", ".toml", ".ini", ".cfg",
    ".env", ".sh", ".bash", ".html", ".htm", ".css", ".scss",
    ".md", ".txt", ".xml", ".sql", ".conf", ".properties",
    ".pem", ".key", ".crt", ".cer",
}
secret_patterns = [
    ("private key block", re.compile(
        r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"
    )),
    ("AWS access key pattern", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("GitHub token pattern", re.compile(
        r"\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,})\b"
    )),
    ("credential assignment", re.compile(
        r"""(?i)\b(?:password|passwd|client_secret|api_secret|access_token|auth_token)\b"""
        r"""\s*[:=]\s*["']?([^\s"'<>]{8,})"""
    )),
    ("API key assignment", re.compile(
        r"""(?i)\b(?:api_key|apikey|secret_key)\b\s*[:=]\s*["']?([^\s"'<>]{8,})"""
    )),
]
placeholder_pattern = re.compile(
    r"(?i)(?:example|sample|placeholder|your[_ -]|change[_ -]?me|"
    r"redacted|dummy|test[_ -]?key|process\.env|os\.environ)"
)

def inside(path):
    try:
        path.resolve().relative_to(root)
        return True
    except (ValueError, OSError, RuntimeError):
        return False

def git(*args):
    return subprocess.run(
        ["git", "-C", str(root), *args],
        text=True, capture_output=True, check=False,
    )

is_git = git("rev-parse", "--is-inside-work-tree").returncode == 0
issues = 0
warnings = 0
checked = 0

def issue(level, message):
    global issues, warnings
    print(f"{level}: {message}")
    if level == "FAIL":
        issues += 1
    else:
        warnings += 1

if is_git:
    conflicts = git("ls-files", "-u").stdout.strip()
    if conflicts:
        issue("FAIL", "Unresolved Git index conflicts detected")
    else:
        print("PASS: No unresolved Git index conflicts")

    status = git("status", "--porcelain", "--untracked-files=all")
    if status.returncode == 0:
        unmerged = [
            line for line in status.stdout.splitlines()
            if line[:2] in {"UU", "AA", "DD", "AU", "UA", "DU", "UD"}
        ]
        if unmerged:
            issue("FAIL", "Unmerged paths detected in Git status")
        else:
            print("PASS: No unmerged paths in Git status")
else:
    issue("WARN", "Not a Git repository; Git-specific checks skipped")

if not secrets_only:
    # Check world-writable regular files, excluding normal generated/vendor trees.
    for directory, dirs, names in os.walk(root, followlinks=False):
        base = Path(directory)
        dirs[:] = [
            d for d in dirs
            if d not in excluded_dirs and not (base / d).is_symlink()
        ]

        for name in names:
            path = base / name
            if path.is_symlink() or not path.is_file():
                continue

            try:
                mode = path.stat().st_mode
                if mode & stat.S_IWOTH:
                    issue("WARN", f"World-writable file: {path.relative_to(root)}")
            except OSError:
                issue("WARN", f"Cannot inspect file permissions: {path.relative_to(root)}")

# Scan Git-tracked files where possible. Otherwise scan supported text files.
if is_git:
    result = git("ls-files", "-z")
    tracked = [
        root / item for item in result.stdout.split("\0") if item
    ] if result.returncode == 0 else []
else:
    tracked = []
    for directory, dirs, names in os.walk(root, followlinks=False):
        base = Path(directory)
        dirs[:] = [
            d for d in dirs
            if d not in excluded_dirs and not (base / d).is_symlink()
        ]
        tracked.extend(base / name for name in names)

findings = 0

for path in tracked:
    try:
        if not inside(path) or path.is_symlink() or not path.is_file():
            continue
        if path.suffix.lower() in excluded_extensions:
            continue
        if path.name in {".env", ".env.local", ".env.production"}:
            issue("WARN", f"Environment file present: {path.relative_to(root)}; ensure it is not committed")
        if path.suffix.lower() not in text_extensions and path.name not in {
            "Dockerfile", "Makefile", ".npmrc", ".pypirc",
        }:
            continue

        if path.stat().st_size > 2 * 1024 * 1024:
            continue

        text = path.read_text(encoding="utf-8", errors="replace")
        checked += 1

        for line_number, line in enumerate(text.splitlines(), 1):
            for label, pattern in secret_patterns:
                match = pattern.search(line)
                if not match:
                    continue

                # Suppress common placeholders and obvious environment lookups.
                if placeholder_pattern.search(line):
                    continue

                # Do not print the line or secret; report only its location/type.
                issue(
                    "WARN",
                    f"Possible {label} in {path.relative_to(root)}:{line_number}",
                )
                findings += 1
                break

        if not secrets_only:
            risky_patterns = [
                (r"\beval\s*\(", "Use of eval()"),
                (r"\bexec\s*\(", "Use of exec()"),
                (r"child_process\s*\.\s*exec\s*\(", "Shell command execution"),
                (r"shell\s*=\s*True", "Python shell=True subprocess"),
                (r"verify\s*=\s*False", "TLS certificate verification disabled"),
                (r"rejectUnauthorized\s*:\s*false", "TLS verification disabled"),
                (r"Access-Control-Allow-Origin\s*:\s*\*", "Wildcard CORS header"),
            ]
            for pattern, label in risky_patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    issue(
                        "WARN",
                        f"Review {label} in {path.relative_to(root)}",
                    )

    except (OSError, UnicodeError) as exc:
        issue("WARN", f"Could not inspect {path.name}: {type(exc).__name__}")

print(f"Text files inspected: {checked}")
print(f"Potential secret-pattern matches: {findings}")

if not secrets_only:
    package = root / "package.json"
    if package.is_file():
        print("INFO: package.json detected; dependency audit not executed.")
        print("INFO: Run npm audit separately when network access is acceptable.")
    else:
        print("INFO: package.json not found; npm dependency audit not applicable.")

print(f"Security findings: {issues}; warnings: {warnings}")

if strict and warnings:
    issues += warnings

sys.exit(1 if issues else 0)
PY
scan_status=$?

if ((scan_status == 0)); then
    pass "Security scan completed without blocking findings"
else
    fail "Security scan reported findings or could not complete cleanly"
fi

if ((SECRETS_ONLY == 0)); then
    if command -v git >/dev/null 2>&1 &&
       git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        if git -C "$ROOT" diff --check; then
            pass "Git whitespace check"
        else
            fail "Git whitespace check"
        fi
    fi

    if command -v npm >/dev/null 2>&1 && [[ -f "$ROOT/package-lock.json" ]]; then
        log "Dependency audit available: run 'npm audit' separately."
    else
        warn "npm or package-lock.json unavailable; dependency audit not run"
        ((STRICT == 0)) || fail "Dependency audit prerequisites missing"
    fi
fi

printf '\n'
log "Summary: PASS=$PASS FAIL=$FAIL WARN=$WARN"

((FAIL == 0))
