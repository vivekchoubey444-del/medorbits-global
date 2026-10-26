#!/usr/bin/env bash
# ============================================================
# MedOrbits Security Audit
# File: SECURITY.sh
# Release: 2.0.0
#
# Usage:
#   bash SECURITY.sh
#   bash SECURITY.sh --strict
#   bash SECURITY.sh --help
#
# Read-only security checks. Review findings manually.
# ============================================================
set -uo pipefail
IFS=$'\n\t'
STRICT=0
case "${1:-}" in
  "")
    ;;
  --strict)
    STRICT=1
    ;;
  --help|-h)
    cat <<'HELP'
MedOrbits Security Audit
Usage:
  bash SECURITY.sh
  bash SECURITY.sh --strict
Checks:
  - Git repository status and merge conflicts
  - Tracked secret-like patterns (names only; values are not printed)
  - Sensitive files tracked by Git
  - Common unsafe configuration patterns
  - Dependency audit availability
  - Security policy presence
This script does not modify files, install packages, commit, or push.
Results are heuristic and do not replace professional security testing.
HELP
    exit 0
    ;;
  *)
    printf '[ERROR] Unknown option: %s\n' "$1" >&2
    exit 2
    ;;
esac
PASS=0
WARN=0
FAIL=0
SKIP=0
pass() {
  PASS=$((PASS + 1))
  printf '[PASS] %s\n' "$*"
}
warn() {
  WARN=$((WARN + 1))
  printf '[WARN] %s\n' "$*" >&2
}
fail() {
  FAIL=$((FAIL + 1))
  printf '[FAIL] %s\n' "$*" >&2
}
skip() {
  SKIP=$((SKIP + 1))
  printf '[SKIP] %s\n' "$*"
}
section() {
  printf '\n========== %s ==========\n' "$*"
}
command -v git >/dev/null 2>&1 || {
  printf '[FATAL] Git is required.\n' >&2
  exit 2
}
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  printf '[FATAL] Run this script inside the MedOrbits Git repository.\n' >&2
  exit 2
}
cd "$ROOT" || exit 2
section "Repository status"
printf 'Repository: %s\n' "$ROOT"
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  pass "Git HEAD exists."
else
  warn "Repository has no commit yet."
fi
if git diff --name-only --diff-filter=U 2>/dev/null | grep -q .; then
  fail "Unresolved merge conflicts exist."
  git diff --name-only --diff-filter=U
else
  pass "No unresolved conflicts in the Git index."
fi
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  warn "Working tree has changes. No changes will be made by this audit."
else
  pass "Working tree is clean."
fi
section "Security policy"
if [[ -f SECURITY.md ]]; then
  pass "SECURITY.md exists."
else
  warn "SECURITY.md is missing; document private vulnerability reporting."
fi
if [[ -f .gitignore ]]; then
  pass ".gitignore exists."
else
  warn ".gitignore is missing."
fi
if [[ -f .env.example ]]; then
  pass ".env.example exists; manually verify it contains placeholders only."
else
  warn ".env.example not found. Add a sanitized template if the project uses environment variables."
fi
section "Sensitive tracked files"
SENSITIVE_COUNT=0
while IFS= read -r -d '' file; do
  case "$file" in
    .env|.env.*|*/.env|*/.env.*)
      case "$file" in
        .env.example|.env.sample|.env.template|*/.env.example|*/.env.sample|*/.env.template)
          continue
          ;;
      esac
      printf '[WARN] Tracked environment file: %s\n' "$file" >&2
      SENSITIVE_COUNT=$((SENSITIVE_COUNT + 1))
      ;;
    *.pem|*.key|*.p12|*.pfx|id_rsa|id_ed25519|credentials.json|service-account.json)
      printf '[WARN] Potentially sensitive tracked file: %s\n' "$file" >&2
      SENSITIVE_COUNT=$((SENSITIVE_COUNT + 1))
      ;;
  esac
done < <(git ls-files -z)
if [[ "$SENSITIVE_COUNT" -eq 0 ]]; then
  pass "No sensitive filenames detected among tracked files."
else
  warn "$SENSITIVE_COUNT potentially sensitive tracked path(s) require review."
fi
section "Secret-pattern scan"
# Search tracked text files for common credential patterns.
# Only filenames and line numbers are displayed; matched values are suppressed.
# This is heuristic and may miss encoded, split, generated, or binary secrets.
if command -v grep >/dev/null 2>&1; then
  SECRET_PATTERN='(AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|password[[:space:]]*=[[:space:]]*["\x27][^"\x27]{8,}|secret[[:space:]]*=[[:space:]]*["\x27][^"\x27]{8,}|api[_-]?key[[:space:]]*=[[:space:]]*["\x27][^"\x27]{8,})'
  # git grep searches tracked repository content. The pattern is intentionally
  # broad; any match must be reviewed before treating it as a real secret.
  if git grep -I -n -E "$SECRET_PATTERN" -- \
    ':!package-lock.json' ':!*.min.js' >/dev/null 2>&1; then
    warn "Potential secret patterns were found in tracked files."
    printf 'Review matching paths and line numbers locally; matched values were not printed.\n'
    git grep -I -n -l -E "$SECRET_PATTERN" -- \
      ':!package-lock.json' ':!*.min.js' 2>/dev/null |
      while IFS= read -r file; do
        printf '  Review: %s\n' "$file"
      done
  else
    pass "No matches for the configured common secret patterns."
  fi
else
  skip "grep is unavailable; secret-pattern scan skipped."
fi
section "Git ignore rules"
if [[ -f .gitignore ]]; then
  for pattern in '.env' '.env.*' 'node_modules/' 'coverage/'; do
    if grep -Fq "$pattern" .gitignore; then
      pass ".gitignore includes $pattern"
    else
      warn ".gitignore does not explicitly include $pattern"
    fi
  done
else
  skip "No .gitignore to inspect."
fi
section "Configuration checks"
if [[ -f package.json ]] && command -v node >/dev/null 2>&1; then
  if node -e '
    const p = JSON.parse(require("fs").readFileSync("package.json", "utf8"));
    process.stdout.write(JSON.stringify({
      scripts: p.scripts || {},
      dependencies: p.dependencies || {},
      devDependencies: p.devDependencies || {}
    }));
  ' >/dev/null 2>&1; then
    pass "package.json parses successfully."
  else
    fail "package.json is invalid JSON."
  fi
else
  skip "package.json validation requires Node.js and package.json."
fi
if [[ -f server.js ]]; then
  # Look for common risky patterns without printing source lines.
  if grep -nE 'rejectUnauthorized[[:space:]]*:[[:space:]]*false|NODE_TLS_REJECT_UNAUTHORIZED[[:space:]]*=[[:space:]]*0' server.js >/dev/null 2>&1; then
    warn "Potential TLS certificate verification bypass found in server.js."
  else
    pass "No common TLS-bypass pattern found in server.js."
  fi
  if grep -nE 'cors\([[:space:]]*\)|origin[[:space:]]*:[[:space:]]*["\x27]\*["\x27]' server.js >/dev/null 2>&1; then
    warn "Potential permissive CORS configuration found in server.js; review intended access."
  else
    pass "No simple wildcard CORS pattern found in server.js."
  fi
else
  skip "Root server.js not found; server-specific checks skipped."
fi
section "Dependency audit"
if [[ -f package.json ]] && command -v npm >/dev/null 2>&1; then
  if [[ -f package-lock.json ]]; then
    printf 'Run manually when network access and the approved audit source are available:\n'
    printf '  npm audit --omit=dev\n'
    printf '  npm audit\n'
    warn "Dependency audit was not executed automatically."
  else
    warn "package-lock.json is missing; reproducible npm dependency auditing may be limited."
  fi
else
  skip "npm or package.json unavailable."
fi
section "GitHub Actions"
if [[ -d .github/workflows ]]; then
  if find .github/workflows -maxdepth 1 -type f \
    \( -name '*.yml' -o -name '*.yaml' \) -print -quit |
    grep -q .; then
    pass "GitHub Actions workflow files exist."
    warn "Review workflow permissions, third-party action pinning, secrets exposure, and pull_request_target usage manually."
  else
    warn "Workflow directory contains no YAML workflow files."
  fi
else
  warn ".github/workflows directory not found."
fi
section "Summary"
printf 'Passed:   %s\n' "$PASS"
printf 'Warnings: %s\n' "$WARN"
printf 'Failed:   %s\n' "$FAIL"
printf 'Skipped:  %s\n' "$SKIP"
if [[ "$FAIL" -gt 0 ]]; then
  printf '\nSECURITY RESULT: FAILED -- review findings before release.\n'
  exit 1
fi
if [[ "$STRICT" -eq 1 && "$WARN" -gt 0 ]]; then
  printf '\nSECURITY RESULT: REVIEW REQUIRED -- strict mode treats warnings as failures.\n'
  exit 1
fi
printf '\nSECURITY RESULT: COMPLETED -- this is not a security certification.\n'
exit 0