#!/usr/bin/env bash
# ============================================================
# MedOrbits Test Runner
# File: /TEST.sh
#
# Usage:
#   bash TEST.sh
#   bash TEST.sh --strict
#   bash TEST.sh --help
#
# Runs available project tests and validation checks.
# Does not install dependencies or modify source files.
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
MedOrbits Test Runner
Usage:
  bash TEST.sh
  bash TEST.sh --strict
Checks:
  - Git repository status
  - package.json validity
  - package-lock.json metadata
  - JSON syntax
  - JavaScript syntax
  - Available npm test, check, lint, and build scripts
No dependency installation, commits, pushes, or automatic repairs.
HELP
    exit 0
    ;;
  *)
    printf '[ERROR] Unknown argument: %s\n' "$1" >&2
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
if ! command -v git >/dev/null 2>&1; then
  printf '[ERROR] Git is required.\n' >&2
  exit 2
fi
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  printf '[ERROR] Run this script inside the MedOrbits Git repository.\n' >&2
  exit 2
}
cd "$ROOT" || exit 2
section "Environment"
printf 'Repository: %s\n' "$ROOT"
if command -v node >/dev/null 2>&1; then
  printf 'Node.js: '
  node --version
else
  warn "Node.js is not installed."
fi
if command -v npm >/dev/null 2>&1; then
  printf 'npm: '
  npm --version
else
  warn "npm is not installed."
fi
section "Git integrity"
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  pass "HEAD commit is available."
else
  warn "No HEAD commit found."
fi
if git diff --name-only --diff-filter=U 2>/dev/null | grep -q .; then
  fail "Unresolved merge conflicts exist."
  git diff --name-only --diff-filter=U
else
  pass "No unresolved conflicts in the Git index."
fi
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  warn "Working tree contains changes; they will not be modified."
  git status --short
else
  pass "Working tree is clean."
fi
section "Project manifest"
if [[ ! -f package.json ]]; then
  warn "Root package.json is missing; npm tests cannot be discovered."
else
  if ! command -v node >/dev/null 2>&1; then
    warn "Cannot validate package.json without Node.js."
  elif node -e \
    'JSON.parse(require("fs").readFileSync("package.json", "utf8"))' \
    >/dev/null 2>&1; then
    pass "package.json is valid JSON."
  else
    fail "package.json contains invalid JSON."
  fi
fi
if [[ -f package.json && -f package-lock.json ]]; then
  if command -v node >/dev/null 2>&1; then
    if node -e '
      const fs = require("fs");
      const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
      const l = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
      if (!l.packages || !l.packages[""]) process.exit(1);
      const r = l.packages[""];
      if (p.name && r.name && p.name !== r.name) process.exit(2);
      if (p.version && r.version && p.version !== r.version) process.exit(3);
    ' >/dev/null 2>&1; then
      pass "package-lock.json root metadata matches package.json."
    else
      fail "package-lock.json metadata is missing or inconsistent."
    fi
  else
    skip "Lockfile metadata check requires Node.js."
  fi
elif [[ -f package.json ]]; then
  warn "package-lock.json is missing."
else
  skip "Lockfile check skipped because package.json is missing."
fi
section "JSON validation"
if ! command -v node >/dev/null 2>&1; then
  skip "JSON validation requires Node.js."
else
  JSON_TOTAL=0
  JSON_FAILED=0
  while IFS= read -r -d '' file; do
    JSON_TOTAL=$((JSON_TOTAL + 1))
    if ! node -e \
      'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' \
      "$file" >/dev/null 2>&1; then
      printf '[FAIL] Invalid JSON: %s\n' "$file" >&2
      JSON_FAILED=$((JSON_FAILED + 1))
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
  if [[ "$JSON_TOTAL" -eq 0 ]]; then
    warn "No JSON files found."
  elif [[ "$JSON_FAILED" -eq 0 ]]; then
    pass "All $JSON_TOTAL JSON files are valid."
  else
    fail "$JSON_FAILED of $JSON_TOTAL JSON files failed validation."
  fi
fi
section "JavaScript syntax"
if ! command -v node >/dev/null 2>&1; then
  skip "JavaScript syntax checks require Node.js."
else
  JS_TOTAL=0
  JS_FAILED=0
  while IFS= read -r -d '' file; do
    JS_TOTAL=$((JS_TOTAL + 1))
    if ! node --check "$file" >/dev/null 2>&1; then
      printf '[FAIL] Syntax error: %s\n' "$file" >&2
      node --check "$file" 2>&1 || true
      JS_FAILED=$((JS_FAILED + 1))
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
  if [[ "$JS_TOTAL" -eq 0 ]]; then
    warn "No .js files found. TypeScript and JSX are not checked."
  elif [[ "$JS_FAILED" -eq 0 ]]; then
    pass "All $JS_TOTAL JavaScript files pass node --check."
  else
    fail "$JS_FAILED of $JS_TOTAL JavaScript files failed syntax checks."
  fi
fi
section "Available npm scripts"
if [[ ! -f package.json ]] || ! command -v node >/dev/null 2>&1; then
  skip "Cannot discover npm scripts."
else
  SCRIPTS="$(node -e '
    const p = JSON.parse(require("fs").readFileSync("package.json", "utf8"));
    process.stdout.write(JSON.stringify(p.scripts || {}));
  ' 2>/dev/null)" || SCRIPTS="{}"
  if [[ ! -d node_modules ]]; then
    warn "node_modules is missing. npm scripts may not run."
  fi
  run_script() {
    local name="$1"
    if node -e '
      const p = JSON.parse(require("fs").readFileSync("package.json", "utf8"));
      process.exit(p.scripts && p.scripts[process.argv[1]] ? 0 : 1);
    ' "$name" >/dev/null 2>&1; then
      printf '\n[RUN] npm run %s\n' "$name"
      if npm run "$name" --if-present; then
        pass "npm run $name"
      else
        fail "npm run $name"
      fi
    else
      skip "No '$name' script defined."
    fi
  }
  # Run tests first; later checks continue even if a test fails.
  run_script test
  run_script check
  run_script lint
  run_script build
fi
section "Summary"
printf 'Passed:   %s\n' "$PASS"
printf 'Warnings: %s\n' "$WARN"
printf 'Failed:   %s\n' "$FAIL"
printf 'Skipped:  %s\n' "$SKIP"
if [[ "$FAIL" -gt 0 ]]; then
  printf '\nTEST RESULT: FAILED\n'
  exit 1
fi
if [[ "$STRICT" -eq 1 && "$WARN" -gt 0 ]]; then
  printf '\nTEST RESULT: FAILED (strict mode: warnings remain)\n'
  exit 1
fi
printf '\nTEST RESULT: COMPLETED -- review warnings and skipped checks.\n'
exit 0