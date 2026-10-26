#!/usr/bin/env bash
# ============================================================
# MedOrbits Repository Verification
# File: /VERIFY.sh
#
# Usage:
#   bash VERIFY.sh
#   bash VERIFY.sh --strict
#
# Safety:
#   - Read-only checks
#   - No automatic conflict resolution
#   - No file deletion or rewriting
#   - No dependency installation
#   - No Git commit, reset, or push
# ============================================================
set -uo pipefail
IFS=$'\n\t'
STRICT=0
if [[ "${1:-}" == "--strict" ]]; then
  STRICT=1
elif [[ -n "${1:-}" && "${1:-}" != "--help" && "${1:-}" != "-h" ]]; then
  printf 'Unknown option: %s\n' "$1" >&2
  printf 'Usage: bash VERIFY.sh [--strict]\n' >&2
  exit 2
fi
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'HELP'
MedOrbits Repository Verification
Usage:
  bash VERIFY.sh
  bash VERIFY.sh --strict
Checks:
  - Git repository and working-tree status
  - Unresolved merge conflicts
  - Essential project files
  - JSON syntax
  - JavaScript syntax where supported
  - package.json/package-lock.json consistency
No files are changed by this script.
Strict mode treats warnings as failures.
HELP
  exit 0
fi
PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0
pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '[PASS] %s\n' "$*"
}
warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  printf '[WARN] %s\n' "$*" >&2
}
fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf '[FAIL] %s\n' "$*" >&2
}
section() {
  printf '\n--- %s ---\n' "$*"
}
command -v git >/dev/null 2>&1 || {
  printf '[FATAL] Git is not installed.\n' >&2
  exit 2
}
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  printf '[FATAL] Run this script inside the MedOrbits Git repository.\n' >&2
  exit 2
}
cd "$ROOT" || exit 2
section "Repository"
printf 'Root: %s\n' "$ROOT"
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  pass "Git repository has a valid HEAD commit."
else
  warn "No HEAD commit exists yet; this may be a new repository."
fi
BRANCH="$(git branch --show-current 2>/dev/null || true)"
printf 'Branch: %s\n' "${BRANCH:-detached HEAD or unavailable}"
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  warn "Working tree has modified, staged, or untracked files."
  git status --short --branch
else
  pass "Working tree is clean."
fi
section "Merge conflicts"
if git diff --name-only --diff-filter=U 2>/dev/null | grep -q .; then
  fail "Unresolved merge conflicts are present:"
  git diff --name-only --diff-filter=U
else
  pass "No unresolved conflicts are reported by the Git index."
fi
# Detect common conflict markers in tracked, non-binary files.
# This is a heuristic; legitimate text may contain these strings.
if command -v grep >/dev/null 2>&1; then
  if git grep -n -E '^(<<<<<<< |=======|>>>>>>> )' -- \
    ':!*.lock' ':!*.min.js' 2>/dev/null; then
    warn "Possible conflict markers found in tracked files; inspect manually."
  else
    pass "No common conflict-marker patterns found in searched tracked files."
  fi
fi
section "Essential files"
check_file() {
  local path="$1"
  local required="${2:-optional}"
  if [[ -f "$path" ]]; then
    pass "Found: $path"
  elif [[ "$required" == "required" ]]; then
    fail "Missing required file: $path"
  else
    warn "Optional file not found: $path"
  fi
}
check_file "package.json" "optional"
check_file "package-lock.json" "optional"
check_file "server.js" "optional"
check_file "README.md" "optional"
check_file ".github/workflows" "optional"
if [[ -f "package.json" ]]; then
  if command -v node >/dev/null 2>&1; then
    if node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))" \
      >/dev/null 2>&1; then
      pass "package.json is valid JSON."
    else
      fail "package.json contains invalid JSON."
    fi
  else
    warn "Node.js unavailable; package.json syntax was not checked."
  fi
fi
section "JSON files"
if command -v node >/dev/null 2>&1; then
  JSON_COUNT=0
  JSON_ERRORS=0
  while IFS= read -r -d '' file; do
    JSON_COUNT=$((JSON_COUNT + 1))
    if node -e \
      'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' \
      "$file" >/dev/null 2>&1; then
      :
    else
      printf '[FAIL] Invalid JSON: %s\n' "$file" >&2
      JSON_ERRORS=$((JSON_ERRORS + 1))
    fi
  done < <(
    find . \
      \( -type d \( \
        -name .git -o \
        -name node_modules -o \
        -name .agent-backup -o \
        -name coverage -o \
        -name dist -o \
        -name build -o \
        -name .next -o \
        -name .wrangler \
      \) -prune \) -o \
      \( -type f -name '*.json' -print0 \) 2>/dev/null
  )
  if [[ "$JSON_COUNT" -eq 0 ]]; then
    warn "No JSON files were found in searched directories."
  elif [[ "$JSON_ERRORS" -eq 0 ]]; then
    pass "All $JSON_COUNT checked JSON files are valid."
  else
    fail "$JSON_ERRORS of $JSON_COUNT JSON files are invalid."
  fi
else
  warn "Node.js unavailable; JSON validation was skipped."
fi
section "JavaScript syntax"
if command -v node >/dev/null 2>&1; then
  JS_COUNT=0
  JS_ERRORS=0
  while IFS= read -r -d '' file; do
    JS_COUNT=$((JS_COUNT + 1))
    if node --check "$file" >/dev/null 2>&1; then
      :
    else
      printf '[FAIL] JavaScript syntax error: %s\n' "$file" >&2
      node --check "$file" 2>&1 || true
      JS_ERRORS=$((JS_ERRORS + 1))
    fi
  done < <(
    find . \
      \( -type d \( \
        -name .git -o \
        -name node_modules -o \
        -name .agent-backup -o \
        -name coverage -o \
        -name dist -o \
        -name build -o \
        -name .next -o \
        -name .wrangler \
      \) -prune \) -o \
      \( -type f -name '*.js' -print0 \) 2>/dev/null
  )
  if [[ "$JS_COUNT" -eq 0 ]]; then
    warn "No .js files were found. TypeScript and JSX are not checked here."
  elif [[ "$JS_ERRORS" -eq 0 ]]; then
    pass "All $JS_COUNT checked JavaScript files pass node --check."
  else
    fail "$JS_ERRORS of $JS_COUNT JavaScript files have syntax errors."
  fi
else
  warn "Node.js unavailable; JavaScript syntax validation was skipped."
fi
section "Lockfile consistency"
if [[ -f "package.json" && -f "package-lock.json" ]]; then
  if command -v npm >/dev/null 2>&1; then
    # npm ls is not used because it checks installed dependencies.
    # npm install is intentionally not run because it may change files.
    if node -e '
      const fs = require("fs");
      const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
      const l = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
      if (!l.packages || !l.packages[""]) process.exit(1);
      const root = l.packages[""];
      if (p.name && root.name && p.name !== root.name) process.exit(2);
      if (p.version && root.version && p.version !== root.version) process.exit(3);
    ' >/dev/null 2>&1; then
      pass "Lockfile root metadata is present and compatible."
    else
      fail "Lockfile root metadata is missing or differs from package.json."
    fi
  else
    warn "npm unavailable; lockfile metadata check was limited to Node.js."
  fi
elif [[ -f "package.json" ]]; then
  warn "package.json exists, but package-lock.json is missing."
elif [[ -f "package-lock.json" ]]; then
  warn "package-lock.json exists, but package.json is missing."
else
  warn "No root package manifest or lockfile found; this may not be a Node.js project."
fi
section "GitHub Actions workflows"
if [[ -d ".github/workflows" ]]; then
  WORKFLOW_COUNT=0
  while IFS= read -r -d '' file; do
    WORKFLOW_COUNT=$((WORKFLOW_COUNT + 1))
    printf '  %s\n' "$file"
  done < <(
    find .github/workflows -maxdepth 1 -type f \
      \( -name '*.yml' -o -name '*.yaml' \) -print0 2>/dev/null
  )
  if [[ "$WORKFLOW_COUNT" -gt 0 ]]; then
    pass "Found $WORKFLOW_COUNT workflow file(s)."
  else
    warn "Workflow directory exists but contains no YAML workflow files."
  fi
else
  warn "No .github/workflows directory found."
fi
section "Summary"
printf 'Passed:   %s\n' "$PASS_COUNT"
printf 'Warnings: %s\n' "$WARN_COUNT"
printf 'Failed:   %s\n' "$FAIL_COUNT"
if [[ "$FAIL_COUNT" -gt 0 ]]; then
  printf '\nVerification failed. Review each failure before changing files.\n'
  exit 1
fi
if [[ "$STRICT" -eq 1 && "$WARN_COUNT" -gt 0 ]]; then
  printf '\nStrict verification failed because warnings remain.\n'
  exit 1
fi
printf '\nVerification completed. Review warnings and workflow YAML manually.\n'
exit 0