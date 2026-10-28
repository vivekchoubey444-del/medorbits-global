
#!/usr/bin/env bash
# ============================================================
# MEDORBITS -- ENTERPRISE SETUP, VALIDATION & BUILD
# File: /APPLY.sh
#
# Requirements:
#   Bash 4+, Node.js >= 20
#   npm, pnpm, Yarn, or Bun for dependency installation
#   Python 3.10+ recommended for repository validation
#
# Safety:
#   - No deployment or database migrations.
#   - No destructive Git operations.
#   - No automatic lockfile generation or dependency fixes.
#   - No secret values printed.
#   - Existing project files are not automatically rewritten.
#
# Usage:
#   bash APPLY.sh
#   bash APPLY.sh --check-only
#   bash APPLY.sh --validate-only
#   bash APPLY.sh --skip-install
#   bash APPLY.sh --skip-tests
#   bash APPLY.sh --audit
#   bash APPLY.sh --strict-env --strict-git
#   bash APPLY.sh --help
# ============================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly PROJECT_NAME="MedOrbits"
readonly SCRIPT_NAME="APPLY.sh"
readonly MIN_NODE_MAJOR=20

readonly RED=$'\033[0;31m'
readonly GREEN=$'\033[0;32m'
readonly YELLOW=$'\033[0;33m'
readonly BLUE=$'\033[0;34m'
readonly CYAN=$'\033[0;36m'
readonly RESET=$'\033[0m'

PROJECT_ROOT=""
PACKAGE_MANAGER=""
PACKAGE_MANAGER_VERSION=""
STEP=0
START_TIME=$SECONDS
WARNINGS=0
ERRORS=0

CHECK_ONLY=0
VALIDATE_ONLY=0
SKIP_INSTALL=0
SKIP_LINT=0
SKIP_TESTS=0
SKIP_BUILD=0
SKIP_VALIDATION=0
RUN_AUDIT=0
REQUIRE_LINT=0
REQUIRE_TESTS=0
STRICT_ENV=0
STRICT_GIT=0
STRICT_VALIDATION=0

INSTALL_PERFORMED=0
LINT_PERFORMED=0
TEST_PERFORMED=0
BUILD_PERFORMED=0
AUDIT_PERFORMED=0
VALIDATION_PERFORMED=0

declare -a WARNING_MESSAGES=()
declare -a ERROR_MESSAGES=()
declare -a COMPLETED_STEPS=()

log() {
  printf '%s[INFO]%s %s\n' "$BLUE" "$RESET" "$*"
}

success() {
  printf '%s[OK]%s %s\n' "$GREEN" "$RESET" "$*"
}

warn() {
  WARNINGS=$((WARNINGS + 1))
  WARNING_MESSAGES+=("$*")
  printf '%s[WARN]%s %s\n' "$YELLOW" "$RESET" "$*" >&2
}

error_message() {
  ERRORS=$((ERRORS + 1))
  ERROR_MESSAGES+=("$*")
  printf '%s[ERROR]%s %s\n' "$RED" "$RESET" "$*" >&2
}

die() {
  printf '%s[ERROR]%s %s\n' "$RED" "$RESET" "$*" >&2
  exit 1
}

step() {
  STEP=$((STEP + 1))
  printf '\n%s[%02d]%s %s\n' "$BLUE" "$STEP" "$RESET" "$*"
}

record_completed() {
  COMPLETED_STEPS+=("$*")
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

require_command() {
  command_exists "$1" || die "Required command not found: $1"
}

on_error() {
  local code=$?
  local line="${BASH_LINENO[0]:-unknown}"
  trap - ERR
  printf '\n%s[ERROR]%s Workflow failed (exit %s).\n' \
    "$RED" "$RESET" "$code" >&2
  printf '%s[ERROR]%s Location: %s:%s\n' \
    "$RED" "$RESET" "$SCRIPT_NAME" "$line" >&2
  printf '%s[ERROR]%s Command details withheld for safety.\n' \
    "$RED" "$RESET" >&2
  exit "$code"
}

on_signal() {
  local name="$1"
  trap - INT TERM
  printf '\n%s[WARN]%s Interrupted by %s. No rollback attempted.\n' \
    "$YELLOW" "$RESET" "$name" >&2
  exit 130
}

trap on_error ERR
trap 'on_signal INT' INT
trap 'on_signal TERM' TERM

show_help() {
  cat <<'HELP'
MedOrbits APPLY.sh

Usage:
  bash APPLY.sh [options]

Execution:
  --help               Show this help.
  --check-only         Preflight checks only; no install, lint, tests,
                       audit, or build.
  --validate-only      Run configuration and repository validation only.
  --skip-install       Skip dependency installation.
  --skip-lint          Skip the configured lint script.
  --skip-tests         Skip the configured test script.
  --skip-build         Skip the configured build script.
  --skip-validation    Skip repository content validation.
  --audit              Run npm audit (npm projects only).

Requirements:
  --require-lint       Fail if package.json has no lint script.
  --require-tests      Fail if package.json has no test script.
  --strict-env         Require .env.example and .gitignore.
  --strict-git         Require clean tracked changes and reject tracked
                       common environment-secret filenames.
  --strict-validation  Treat repository validation warnings as failures.

Examples:
  bash APPLY.sh --check-only
  bash APPLY.sh --validate-only
  bash APPLY.sh --skip-install --skip-build
  bash APPLY.sh --audit --require-lint --require-tests
  bash APPLY.sh --strict-env --strict-git --strict-validation

Safety:
  No deployment, database migrations, destructive Git commands,
  automatic dependency fixes, or automatic lockfile generation.
HELP
}

parse_arguments() {
  while (($#)); do
    case "$1" in
      --help|-h) show_help; exit 0 ;;
      --check-only) CHECK_ONLY=1 ;;
      --validate-only) VALIDATE_ONLY=1 ;;
      --skip-install) SKIP_INSTALL=1 ;;
      --skip-lint) SKIP_LINT=1 ;;
      --skip-tests) SKIP_TESTS=1 ;;
      --skip-build) SKIP_BUILD=1 ;;
      --skip-validation) SKIP_VALIDATION=1 ;;
      --audit) RUN_AUDIT=1 ;;
      --require-lint) REQUIRE_LINT=1 ;;
      --require-tests) REQUIRE_TESTS=1 ;;
      --strict-env) STRICT_ENV=1 ;;
      --strict-git) STRICT_GIT=1 ;;
      --strict-validation) STRICT_VALIDATION=1 ;;
      *) die "Unknown option: $1. Use --help." ;;
    esac
    shift
  done

  if (( CHECK_ONLY || VALIDATE_ONLY )); then
    if (( SKIP_INSTALL || SKIP_LINT || SKIP_TESTS || SKIP_BUILD || RUN_AUDIT )); then
      warn "Check/validation-only mode overrides install, lint, tests, build, and audit."
    fi
  fi
}

locate_project_root() {
  local script_dir
  script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)" ||
    die "Cannot resolve script directory."

  PROJECT_ROOT="$script_dir"
  [[ -f "$PROJECT_ROOT/package.json" ]] ||
    die "package.json not found beside APPLY.sh. Save it in the repository root."

  cd -- "$PROJECT_ROOT" || die "Cannot enter project root."
  success "Project root detected."
}

check_runtime() {
  step "Runtime requirements"

  require_command bash
  require_command node

  local node_version node_major bash_major
  node_version="$(node -p 'process.versions.node')"
  node_major="${node_version%%.*}"
  bash_major="${BASH_VERSINFO[0]}"

  [[ "$node_major" =~ ^[0-9]+$ ]] || die "Cannot parse Node.js version."
  (( node_major >= MIN_NODE_MAJOR )) || die "Node.js >= ${MIN_NODE_MAJOR} required."
  (( bash_major >= 4 )) || die "Bash 4 or newer is required."

  success "Node.js ${node_version}"
  success "Bash ${BASH_VERSION}"

  if command_exists python3; then
    success "Python $(python3 --version 2>&1)"
  else
    warn "python3 unavailable; repository content validation will be limited."
  fi

  record_completed "Runtime validation"
}

validate_package_json() {
  step "Package manifest"

  node <<'NODE'
'use strict';
const fs = require('node:fs');

let pkg;
try {
  pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
} catch (error) {
  console.error(`package.json is invalid JSON: ${error.message}`);
  process.exit(1);
}

if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
  console.error('package.json must contain a JSON object.');
  process.exit(1);
}

if (pkg.scripts !== undefined &&
    (!pkg.scripts || typeof pkg.scripts !== 'object' ||
     Array.isArray(pkg.scripts))) {
  console.error('package.json scripts must be an object.');
  process.exit(1);
}

if (pkg.packageManager !== undefined &&
    typeof pkg.packageManager !== 'string') {
  console.error('packageManager must be a string when present.');
  process.exit(1);
}

for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  if (pkg[field] !== undefined &&
      (!pkg[field] || typeof pkg[field] !== 'object' ||
       Array.isArray(pkg[field]))) {
    console.error(`${field} must be an object.`);
    process.exit(1);
  }
}

console.log('package.json syntax and structure are valid.');
for (const name of ['lint', 'test', 'build', 'start']) {
  console.log(`${name} script: ${pkg.scripts?.[name] ? 'available' : 'not configured'}`);
}
NODE

  record_completed "Package manifest validation"
}

detect_package_manager() {
  step "Package manager and lockfile"

  local npm_lock=0 pnpm_lock=0 yarn_lock=0 bun_lock=0
  local declared="" lock_count=0

  [[ -f package-lock.json || -f npm-shrinkwrap.json ]] && npm_lock=1
  [[ -f pnpm-lock.yaml ]] && pnpm_lock=1
  [[ -f yarn.lock ]] && yarn_lock=1
  [[ -f bun.lock || -f bun.lockb ]] && bun_lock=1

  lock_count=$((npm_lock + pnpm_lock + yarn_lock + bun_lock))
  (( lock_count <= 1 )) ||
    die "Multiple package-manager lockfiles found. Resolve this manually."

  declared="$(node -e '
    const p = require("./package.json");
    if (typeof p.packageManager === "string") process.stdout.write(p.packageManager);
  ')"

  if [[ -n "$declared" ]]; then
    case "$declared" in
      npm@*) PACKAGE_MANAGER=npm ;;
      pnpm@*) PACKAGE_MANAGER=pnpm ;;
      yarn@*) PACKAGE_MANAGER=yarn ;;
      bun@*) PACKAGE_MANAGER=bun ;;
      *) die "Unsupported packageManager declaration." ;;
    esac
  else
    case "$lock_count" in
      0) PACKAGE_MANAGER=npm ;;
      1)
        if (( npm_lock )); then PACKAGE_MANAGER=npm
        elif (( pnpm_lock )); then PACKAGE_MANAGER=pnpm
        elif (( yarn_lock )); then PACKAGE_MANAGER=yarn
        else PACKAGE_MANAGER=bun
        fi
        ;;
      *) die "Cannot determine package manager." ;;
    esac
  fi

  if (( lock_count > 0 )); then
    case "$PACKAGE_MANAGER" in
      npm) (( npm_lock )) || die "npm declaration conflicts with lockfile." ;;
      pnpm) (( pnpm_lock )) || die "pnpm declaration conflicts with lockfile." ;;
      yarn) (( yarn_lock )) || die "Yarn declaration conflicts with lockfile." ;;
      bun) (( bun_lock )) || die "Bun declaration conflicts with lockfile." ;;
    esac
  else
    warn "No recognized lockfile found. Dependency installation will be blocked."
  fi

  if command_exists "$PACKAGE_MANAGER"; then
    PACKAGE_MANAGER_VERSION="$("$PACKAGE_MANAGER" --version)"
    success "Package manager: ${PACKAGE_MANAGER} ${PACKAGE_MANAGER_VERSION}"
  else
    if (( CHECK_ONLY || VALIDATE_ONLY || SKIP_INSTALL )); then
      PACKAGE_MANAGER_VERSION="unavailable"
      warn "${PACKAGE_MANAGER} is unavailable; package-manager execution is not possible."
    else
      die "Required package manager not found: ${PACKAGE_MANAGER}"
    fi
  fi

  record_completed "Package manager and lockfile validation"
}

check_environment_and_git() {
  step "Environment and Git safety"

  if [[ -f .env.example ]]; then
    success ".env.example found."
  elif (( STRICT_ENV )); then
    die ".env.example is required by --strict-env."
  else
    warn ".env.example is missing."
  fi

  if [[ -f .gitignore ]]; then
    success ".gitignore found."
  elif (( STRICT_ENV )); then
    die ".gitignore is required by --strict-env."
  else
    warn ".gitignore is missing."
  fi

  if [[ -f .env ]]; then
    log ".env exists. Contents will not be displayed."
  fi

  if ! command_exists git || ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    warn "Git repository unavailable; tracked-file checks skipped."
    (( STRICT_GIT )) && die "--strict-git requires a Git repository."
    return 0
  fi

  local tracked_file sensitive_found=0
  while IFS= read -r -d '' tracked_file; do
    case "$tracked_file" in
      .env|.env.local|.env.production|.env.development.local|\
      .env.test.local|.env.production.local|\
      */.env.local|*/.env.production|*/.env.development.local|\
      */.env.test.local|*/.env.production.local)
        warn "Potentially sensitive environment filename is tracked: ${tracked_file}"
        sensitive_found=1
        ;;
    esac
  done < <(git ls-files -z)

  if (( sensitive_found )); then
    die "Tracked environment files require manual review. Rotate any exposed credentials."
  fi

  success "No common sensitive environment filenames found in Git index."

  if ! git diff --quiet --; then
    warn "Unstaged tracked changes exist."
    (( STRICT_GIT )) && die "Unstaged changes detected under --strict-git."
  fi

  if ! git diff --cached --quiet --; then
    warn "Staged changes exist."
    (( STRICT_GIT )) && die "Staged changes detected under --strict-git."
  fi

  record_completed "Environment and Git checks"
}

check_project_structure() {
  step "Project structure"

  local found=0 directory
  for directory in \
    assets pages education api src app server routes controllers \
    models services tests scripts tools python
  do
    if [[ -d "$directory" ]]; then
      success "${directory}/ found."
      found=1
    fi
  done

  [[ -f server.js ]] && { success "server.js found."; found=1; }
  [[ -f index.html ]] && { success "index.html found."; found=1; }

  if (( ! found )); then
    warn "No common application directories detected."
  fi

  if [[ -d education ]]; then
    for file in \
      education/index.html \
      education/universities.html \
      education/courses.html \
      education/assets/css/education.css \
      education/assets/js/education.js
    do
      [[ -f "$file" ]] || warn "Expected education resource missing: ${file}"
    done
  else
    warn "education/ directory not found; education-specific checks skipped."
  fi

  record_completed "Project structure checks"
}

# ------------------------------------------------------------
# Repository validator
#
# Checks:
#   - JSON syntax, including package.json and data files
#   - JavaScript syntax with node --check
#   - Python syntax using ast.parse (does not create .pyc files)
#   - Basic HTML parse errors and broken local file references
#   - CSS brace balance
#
# Excludes dependency/build directories.
# ------------------------------------------------------------
validate_repository() {
  step "Repository content validation"

  if (( SKIP_VALIDATION )); then
    log "Repository validation skipped."
    return 0
  fi

  if ! command_exists python3; then
    if (( STRICT_VALIDATION )); then
      die "python3 is required for strict repository validation."
    fi
    warn "Repository validation skipped because python3 is unavailable."
    return 0
  fi

  python3 <<'PY'
import ast
import json
import os
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path.cwd().resolve()
EXCLUDED = {
    ".git", "node_modules", ".next", ".nuxt", ".output",
    "dist", "build", "coverage", ".venv", "venv",
    "__pycache__", ".cache", "vendor"
}

errors = []
warnings = []
counts = {
    "html": 0, "css": 0, "js": 0,
    "json": 0, "python": 0
}

def report_error(path, message):
    errors.append(f"{path}: {message}")

def report_warning(path, message):
    warnings.append(f"{path}: {message}")

def files_by_suffix(suffixes):
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [
            d for d in dirs
            if d not in EXCLUDED and not d.startswith(".pytest_cache")
        ]
        for name in files:
            path = Path(base) / name
            if path.suffix.lower() in suffixes:
                yield path

class HTMLAudit(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.ids = set()
        self.references = []
        self.parser_errors = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        element_id = attrs.get("id")
        if element_id:
            if element_id in self.ids:
                report_warning(self.path, f"duplicate HTML id: {element_id}")
            self.ids.add(element_id)

        for attr in ("href", "src", "poster", "action"):
            value = attrs.get(attr)
            if value:
                self.references.append((tag, attr, value))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def error(self, message):
        self.parser_errors.append(message)

def safe_local_target(source, value):
    parsed = urlsplit(value.strip())

    if parsed.scheme or parsed.netloc:
        return None
    if value.strip().startswith(("#", "data:", "mailto:", "tel:", "javascript:")):
        return None
    if not parsed.path and parsed.fragment:
        return None

    raw_path = unquote(parsed.path)
    if not raw_path:
        return source

    candidate = (source.parent / raw_path).resolve()
    try:
        candidate.relative_to(ROOT)
    except ValueError:
        return "OUTSIDE_ROOT"

    return candidate

# JSON
for path in files_by_suffix({".json"}):
    counts["json"] += 1
    try:
        with path.open("r", encoding="utf-8-sig") as f:
            json.load(f)
    except Exception as exc:
        report_error(path.relative_to(ROOT), f"invalid JSON ({exc})")

# JavaScript syntax
for path in files_by_suffix({".js", ".mjs", ".cjs"}):
    counts["js"] += 1
    if not shutil_which := __import__("shutil").which("node"):
        report_warning(path.relative_to(ROOT), "Node.js unavailable; syntax check skipped")
        break
    result = subprocess.run(
        [shutil_which, "--check", str(path)],
        capture_output=True, text=True
    )
    if result.returncode:
        detail = (result.stderr or result.stdout).strip().splitlines()
        report_error(path.relative_to(ROOT), detail[-1] if detail else "JavaScript syntax check failed")

# Python syntax without bytecode output
for path in files_by_suffix({".py"}):
    counts["python"] += 1
    try:
        source = path.read_text(encoding="utf-8-sig")
        ast.parse(source, filename=str(path))
    except Exception as exc:
        report_error(path.relative_to(ROOT), f"Python syntax error ({exc})")

# CSS delimiter balance
for path in files_by_suffix({".css"}):
    counts["css"] += 1
    try:
        text = path.read_text(encoding="utf-8-sig")
        # Remove comments and strings to avoid counting braces inside them.
        text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
        text = re.sub(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', '""', text)
        balance = 0
        for char in text:
            if char == "{":
                balance += 1
            elif char == "}":
                balance -= 1
                if balance < 0:
                    break
        if balance != 0:
            report_error(path.relative_to(ROOT), "unbalanced CSS braces")
    except Exception as exc:
        report_error(path.relative_to(ROOT), f"cannot read CSS ({exc})")

# HTML parsing and local references
html_records = []
for path in files_by_suffix({".html", ".htm"}):
    counts["html"] += 1
    try:
        parser = HTMLAudit(path)
        parser.feed(path.read_text(encoding="utf-8-sig"))
        parser.close()
        html_records.append((path, parser))
        for message in parser.parser_errors:
            report_error(path.relative_to(ROOT), f"HTML parser error ({message})")
    except Exception as exc:
        report_error(path.relative_to(ROOT), f"cannot parse HTML ({exc})")

for path, parser in html_records:
    for tag, attr, value in parser.references:
        target = safe_local_target(path, value)
        if target is None:
            continue
        if target == "OUTSIDE_ROOT":
            report_error(path.relative_to(ROOT), f"local reference escapes repository: {value}")
            continue

        if not target.exists():
            # Missing HTML fragment-only targets are handled below.
            report_error(path.relative_to(ROOT), f"broken local {attr} reference: {value}")
            continue

        if target.is_file() and target.suffix.lower() in {".html", ".htm"}:
            fragment = urlsplit(value).fragment
            if fragment:
                target_record = next(
                    (record for record in html_records if record[0] == target),
                    None
                )
                if target_record and unquote(fragment) not in target_record[1].ids:
                    report_warning(
                        path.relative_to(ROOT),
                        f"fragment '#{fragment}' not found in {target.relative_to(ROOT)}"
                    )

print("Repository validation counts:")
for key, value in counts.items():
    print(f"  {key.upper():6} {value}")

for item in warnings:
    print(f"[WARN] {item}")

for item in errors:
    print(f"[ERROR] {item}")

print(f"\nValidation result: {len(errors)} error(s), {len(warnings)} warning(s).")

if errors:
    sys.exit(1)
PY

  local result=$?
  if (( result == 0 )); then
    VALIDATION_PERFORMED=1
    success "Repository content validation passed."
    record_completed "Repository content validation"
  else
    error_message "Repository validation reported errors."
    if (( STRICT_VALIDATION )); then
      die "Strict repository validation failed."
    fi
    die "Repository validation failed. Fix the reported issues before continuing."
  fi
}

has_package_script() {
  local script_name="$1"
  node - "$script_name" <<'NODE'
'use strict';
const fs = require('node:fs');
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const value = pkg.scripts?.[process.argv[2]];
  process.exit(typeof value === 'string' && value.trim() ? 0 : 1);
} catch {
  process.exit(2);
}
NODE
}

run_project_script() {
  local script_name="$1"
  has_package_script "$script_name" ||
    die "Required package script '${script_name}' is missing."

  case "$PACKAGE_MANAGER" in
    npm) npm run "$script_name" ;;
    pnpm) pnpm run "$script_name" ;;
    yarn) yarn run "$script_name" ;;
    bun) bun run "$script_name" ;;
    *) die "Unsupported package manager." ;;
  esac
}

install_dependencies() {
  step "Dependency installation"

  if (( CHECK_ONLY || VALIDATE_ONLY || SKIP_INSTALL )); then
    log "Dependency installation skipped."
    return 0
  fi

  case "$PACKAGE_MANAGER" in
    npm)
      if [[ -f package-lock.json || -f npm-shrinkwrap.json ]]; then
        npm ci
      else
        die "No npm lockfile. Create and review one manually, or use --skip-install."
      fi
      ;;
    pnpm)
      [[ -f pnpm-lock.yaml ]] || die "pnpm lockfile missing."
      pnpm install --frozen-lockfile
      ;;
    yarn)
      [[ -f yarn.lock ]] || die "Yarn lockfile missing."
      if yarn --version | grep -q '^1\.'; then
        yarn install --frozen-lockfile
      else
        yarn install --immutable
      fi
      ;;
    bun)
      [[ -f bun.lock || -f bun.lockb ]] || die "Bun lockfile missing."
      bun install --frozen-lockfile
      ;;
    *) die "Unsupported package manager." ;;
  esac

  INSTALL_PERFORMED=1
  success "Dependencies installed."
  record_completed "Dependency installation"
}

run_lint() {
  step "Lint"

  if (( CHECK_ONLY || VALIDATE_ONLY || SKIP_LINT )); then
    log "Lint skipped."
    return 0
  fi

  if ! has_package_script lint; then
    if (( REQUIRE_LINT )); then
      die "No lint script is configured."
    fi
    warn "No lint script configured; lint skipped."
    return 0
  fi

  run_project_script lint
  LINT_PERFORMED=1
  success "Lint passed."
  record_completed "Lint"
}

run_tests() {
  step "Automated tests"

  if (( CHECK_ONLY || VALIDATE_ONLY || SKIP_TESTS )); then
    log "Tests skipped."
    return 0
  fi

  if ! has_package_script test; then
    if (( REQUIRE_TESTS )); then
      die "No test script is configured."
    fi
    warn "No test script configured; tests skipped."
    return 0
  fi

  CI=1 run_project_script test
  TEST_PERFORMED=1
  success "Tests passed."
  record_completed "Automated tests"
}

run_audit() {
  step "Dependency audit"

  if (( CHECK_ONLY || VALIDATE_ONLY || ! RUN_AUDIT )); then
    log "Audit not requested."
    return 0
  fi

  [[ "$PACKAGE_MANAGER" == npm ]] || die "--audit supports npm only."
  [[ -f package-lock.json || -f npm-shrinkwrap.json ]] ||
    die "npm audit requires a lockfile."

  npm audit --audit-level=high
  AUDIT_PERFORMED=1
  success "Dependency audit passed."
  record_completed "Dependency audit"
}

run_build() {
  step "Production build"

  if (( CHECK_ONLY || VALIDATE_ONLY || SKIP_BUILD )); then
    log "Build skipped."
    return 0
  fi

  if ! has_package_script build; then
    die "No build script configured. Use --skip-build if no build is required."
  fi

  run_project_script build
  BUILD_PERFORMED=1
  success "Build passed."
  record_completed "Production build"
}

print_summary() {
  local elapsed=$((SECONDS - START_TIME))
  printf '\n%s====================================================%s\n' "$CYAN" "$RESET"
  printf '%s%s -- Execution Summary%s\n' "$CYAN" "$PROJECT_NAME" "$RESET"
  printf '%s====================================================%s\n' "$CYAN" "$RESET"

  printf 'Root:        %s\n' "$PROJECT_ROOT"
  printf 'Node.js:     %s\n' "$(node -p 'process.versions.node')"
  printf 'Manager:     %s %s\n' "$PACKAGE_MANAGER" "$PACKAGE_MANAGER_VERSION"
  printf 'Elapsed:     %ss\n' "$elapsed"

  if (( CHECK_ONLY )); then
    printf 'Mode:        check-only\n'
  elif (( VALIDATE_ONLY )); then
    printf 'Mode:        validate-only\n'
  else
    printf 'Mode:        normal\n'
  fi

  printf '\nExecution results:\n'
  printf '  Repository validation: %s\n' "$([[ $VALIDATION_PERFORMED -eq 1 ]] && printf 'passed' || printf 'not run')"
  printf '  Install:               %s\n' "$([[ $INSTALL_PERFORMED -eq 1 ]] && printf 'passed' || printf 'not run')"
  printf '  Lint:                  %s\n' "$([[ $LINT_PERFORMED -eq 1 ]] && printf 'passed' || printf 'not run')"
  printf '  Tests:                 %s\n' "$([[ $TEST_PERFORMED -eq 1 ]] && printf 'passed' || printf 'not run')"
  printf '  Build:                 %s\n' "$([[ $BUILD_PERFORMED -eq 1 ]] && printf 'passed' || printf 'not run')"
  printf '  Audit:                 %s\n' "$([[ $AUDIT_PERFORMED -eq 1 ]] && printf 'passed' || printf 'not run')"
  printf '  Warnings:              %s\n' "$WARNINGS"
  printf '  Errors:                %s\n' "$ERRORS"

  if ((${#COMPLETED_STEPS[@]})); then
    printf '\nCompleted steps:\n'
    local item
    for item in "${COMPLETED_STEPS[@]}"; do
      printf '  - %s\n' "$item"
    done
  fi

  if ((${#WARNING_MESSAGES[@]})); then
    printf '\nWarnings:\n'
    local warning
    for warning in "${WARNING_MESSAGES[@]}"; do
      printf '  - %s\n' "$warning"
    done
  fi

  if ((${#ERROR_MESSAGES[@]})); then
    printf '\nErrors:\n'
    local item
    for item in "${ERROR_MESSAGES[@]}"; do
      printf '  - %s\n' "$item"
    done
  fi

  printf '\n'
  success "Workflow completed."
  log "No deployment or database migration was performed."
}

main() {
  printf '\n%s%s -- Setup, Validation & Build%s\n' "$CYAN" "$PROJECT_NAME" "$RESET"

  parse_arguments "$@"
  locate_project_root
  check_runtime
  validate_package_json
  detect_package_manager
  check_environment_and_git
  check_project_structure
  validate_repository

  if (( CHECK_ONLY || VALIDATE_ONLY )); then
    print_summary
    return 0
  fi

  install_dependencies
  run_lint
  run_tests
  run_audit
  run_build
  print_summary
}

main "$@"
