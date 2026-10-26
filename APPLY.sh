#!/usr/bin/env bash
# ============================================================
# MEDORBITS -- ENTERPRISE SETUP, VALIDATION & BUILD
# File: /APPLY.sh
#
# Requirements:
#   - Bash 4+
#   - Node.js >= 20
#   - Supported package manager: npm, pnpm, Yarn, or Bun
#
# Capabilities:
#   - Project-root detection
#   - Runtime and package-manager validation
#   - Lockfile-aware dependency installation
#   - Environment and secret-file checks
#   - Optional lint, tests, build, and npm audit
#   - Preflight-only mode
#   - Failure-safe reporting and execution summary
#
# Safety:
#   - No production deployment.
#   - No database migrations.
#   - No destructive Git operations.
#   - No automatic lockfile generation.
#   - No automatic dependency installation without a lockfile.
#   - No printing environment variable values.
#
# Usage:
#   bash APPLY.sh
#   bash APPLY.sh --check-only
#   bash APPLY.sh --skip-install
#   bash APPLY.sh --skip-tests
#   bash APPLY.sh --skip-build
#   bash APPLY.sh --audit
#   bash APPLY.sh --help
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
readonly PROJECT_NAME="MedOrbits"
readonly MIN_NODE_MAJOR=20
readonly SCRIPT_NAME="APPLY.sh"
readonly RED=$'\033[0;31m'
readonly GREEN=$'\033[0;32m'
readonly YELLOW=$'\033[0;33m'
readonly BLUE=$'\033[0;34m'
readonly CYAN=$'\033[0;36m'
readonly RESET=$'\033[0m'
STEP=0
START_TIME=$SECONDS
PROJECT_ROOT=""
PACKAGE_MANAGER=""
PACKAGE_MANAGER_VERSION=""
CHECK_ONLY=0
SKIP_INSTALL=0
SKIP_LINT=0
SKIP_TESTS=0
SKIP_BUILD=0
RUN_AUDIT=0
REQUIRE_LINT=0
REQUIRE_TESTS=0
STRICT_ENV=0
STRICT_GIT=0
INSTALL_PERFORMED=0
LINT_PERFORMED=0
TEST_PERFORMED=0
BUILD_PERFORMED=0
AUDIT_PERFORMED=0
WARNINGS=0
declare -a WARNING_MESSAGES=()
declare -a COMPLETED_STEPS=()
# ------------------------------------------------------------
# Logging
# ------------------------------------------------------------
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
  command_exists "$1" ||
    die "Required command not found: $1"
}
# Do not print BASH_COMMAND: it may contain credentials or tokens.
on_error() {
  local exit_code=$?
  local line_number="${BASH_LINENO[0]:-unknown}"
  trap - ERR
  printf '\n%s[ERROR]%s Operation failed (exit code %s).\n' \
    "$RED" "$RESET" "$exit_code" >&2
  printf '%s[ERROR]%s Location: %s:%s\n' \
    "$RED" "$RESET" "$SCRIPT_NAME" "$line_number" >&2
  printf '%s[ERROR]%s Review the preceding output. Command details are withheld.\n' \
    "$RED" "$RESET" >&2
  exit "$exit_code"
}
on_signal() {
  local signal_name="$1"
  trap - INT TERM
  printf '\n%s[WARN]%s Interrupted by %s. No rollback was attempted.\n' \
    "$YELLOW" "$RESET" "$signal_name" >&2
  exit 130
}
trap on_error ERR
trap 'on_signal INT' INT
trap 'on_signal TERM' TERM
# ------------------------------------------------------------
# Help and arguments
# ------------------------------------------------------------
show_help() {
  cat <<'HELP'
MedOrbits APPLY.sh
Usage:
  bash APPLY.sh [options]
Options:
  --help            Display this help.
  --check-only      Validate configuration without installing,
                    linting, testing, auditing, or building.
  --skip-install    Do not install dependencies.
  --skip-lint       Skip the lint script.
  --skip-tests      Skip the test script.
  --skip-build      Skip the production build.
  --audit           Run npm audit (npm projects only).
  --require-lint    Fail if package.json has no lint script.
  --require-tests   Fail if package.json has no test script.
  --strict-env      Require .env.example and .gitignore.
  --strict-git      Fail if tracked environment secret files
                    or unstaged/staged changes are detected.
Examples:
  bash APPLY.sh --check-only
  bash APPLY.sh
  bash APPLY.sh --skip-tests
  bash APPLY.sh --skip-build
  bash APPLY.sh --audit --require-lint --require-tests
Safety:
  - No deployment or remote infrastructure changes.
  - No database migrations.
  - No git reset, clean, checkout, or stash.
  - No automatic dependency installation without a lockfile.
  - No automatic audit fixes.
  - Build tools can create or update generated project files.
HELP
}
parse_arguments() {
  while (($# > 0)); do
    case "$1" in
      --help|-h)
        show_help
        exit 0
        ;;
      --check-only)
        CHECK_ONLY=1
        ;;
      --skip-install)
        SKIP_INSTALL=1
        ;;
      --skip-lint)
        SKIP_LINT=1
        ;;
      --skip-tests)
        SKIP_TESTS=1
        ;;
      --skip-build)
        SKIP_BUILD=1
        ;;
      --audit)
        RUN_AUDIT=1
        ;;
      --require-lint)
        REQUIRE_LINT=1
        ;;
      --require-tests)
        REQUIRE_TESTS=1
        ;;
      --strict-env)
        STRICT_ENV=1
        ;;
      --strict-git)
        STRICT_GIT=1
        ;;
      *)
        die "Unknown option: $1. Use --help."
        ;;
    esac
    shift
  done
  if (( CHECK_ONLY )); then
    if (( SKIP_INSTALL || SKIP_LINT || SKIP_TESTS || SKIP_BUILD || RUN_AUDIT )); then
      warn "--check-only overrides install, lint, test, build, and audit actions."
    fi
  fi
}
# ------------------------------------------------------------
# Project root
# ------------------------------------------------------------
locate_project_root() {
  local script_dir
  script_dir="$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &&
      pwd -P
  )" || die "Cannot resolve script directory."
  PROJECT_ROOT="$script_dir"
  [[ -f "$PROJECT_ROOT/package.json" ]] ||
    die "package.json not found beside APPLY.sh. Save this script in the project root."
  cd -- "$PROJECT_ROOT" ||
    die "Cannot enter project directory."
  success "Project root detected."
}
# ------------------------------------------------------------
# Runtime validation
# ------------------------------------------------------------
check_runtime() {
  step "Validating runtime requirements"
  require_command bash
  require_command node
  local node_version node_major bash_major
  node_version="$(node -p 'process.versions.node')"
  node_major="${node_version%%.*}"
  bash_major="${BASH_VERSINFO[0]}"
  [[ "$node_major" =~ ^[0-9]+$ ]] ||
    die "Cannot parse Node.js version."
  (( node_major >= MIN_NODE_MAJOR )) ||
    die "Node.js >= ${MIN_NODE_MAJOR} required."
  (( bash_major >= 4 )) ||
    die "Bash 4 or newer is required."
  success "Node.js ${node_version}"
  success "Bash ${BASH_VERSION}"
  record_completed "Runtime validation"
}
# ------------------------------------------------------------
# Package manifest
# ------------------------------------------------------------
validate_package_json() {
  step "Validating package.json"
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
console.log('package.json syntax and basic structure are valid.');
console.log(`Build script: ${pkg.scripts?.build ? 'available' : 'not configured'}`);
console.log(`Lint script: ${pkg.scripts?.lint ? 'available' : 'not configured'}`);
console.log(`Test script: ${pkg.scripts?.test ? 'available' : 'not configured'}`);
NODE
  record_completed "Package manifest validation"
}
# ------------------------------------------------------------
# Package manager / lockfile
# ------------------------------------------------------------
detect_package_manager() {
  step "Detecting package manager and lockfile"
  local npm_lock=0 pnpm_lock=0 yarn_lock=0 bun_lock=0
  local declared=""
  [[ -f package-lock.json || -f npm-shrinkwrap.json ]] && npm_lock=1
  [[ -f pnpm-lock.yaml ]] && pnpm_lock=1
  [[ -f yarn.lock ]] && yarn_lock=1
  [[ -f bun.lock || -f bun.lockb ]] && bun_lock=1
  local lock_count=$((npm_lock + pnpm_lock + yarn_lock + bun_lock))
  (( lock_count <= 1 )) ||
    die "Multiple package-manager lockfiles found. Resolve the intended package manager manually."
  declared="$(node -e '
    const p = require("./package.json");
    if (typeof p.packageManager === "string") process.stdout.write(p.packageManager);
  ')"
  if [[ -n "$declared" ]]; then
    case "$declared" in
      npm@*)  PACKAGE_MANAGER=npm ;;
      pnpm@*) PACKAGE_MANAGER=pnpm ;;
      yarn@*) PACKAGE_MANAGER=yarn ;;
      bun@*)  PACKAGE_MANAGER=bun ;;
      *)
        die "Unsupported packageManager declaration in package.json."
        ;;
    esac
  else
    case "$lock_count" in
      0) PACKAGE_MANAGER=npm ;;
      1)
        if (( npm_lock )); then
          PACKAGE_MANAGER=npm
        elif (( pnpm_lock )); then
          PACKAGE_MANAGER=pnpm
        elif (( yarn_lock )); then
          PACKAGE_MANAGER=yarn
        else
          PACKAGE_MANAGER=bun
        fi
        ;;
      *)
        die "Unable to identify package manager."
        ;;
    esac
  fi
  # A declared package manager must match the existing lockfile.
  if (( lock_count > 0 )); then
    case "$PACKAGE_MANAGER" in
      npm)  (( npm_lock )) || die "Declared npm package manager does not match lockfile." ;;
      pnpm) (( pnpm_lock )) || die "Declared pnpm package manager does not match lockfile." ;;
      yarn) (( yarn_lock )) || die "Declared Yarn package manager does not match lockfile." ;;
      bun)  (( bun_lock )) || die "Declared Bun package manager does not match lockfile." ;;
    esac
  fi
  require_command "$PACKAGE_MANAGER"
  PACKAGE_MANAGER_VERSION="$("$PACKAGE_MANAGER" --version)"
  success "Package manager: ${PACKAGE_MANAGER} ${PACKAGE_MANAGER_VERSION}"
  if (( lock_count == 0 )); then
    warn "No recognized lockfile exists. Installation will be blocked unless skipped."
  fi
  record_completed "Package manager and lockfile validation"
}
# ------------------------------------------------------------
# Git and environment safety
# ------------------------------------------------------------
check_environment_and_git() {
  step "Checking environment files and Git state"
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
    log ".env exists. Its contents will not be displayed."
  fi
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    warn "Not inside a Git repository; tracked-file checks skipped."
    if (( STRICT_GIT )); then
      die "--strict-git requires a Git repository."
    fi
    return 0
  fi
  local sensitive_found=0
  local tracked_file
  while IFS= read -r -d '' tracked_file; do
    case "$tracked_file" in
      .env|.env.local|.env.production|.env.development.local|\
      .env.test.local|.env.production.local|\
      */.env.local|*/.env.production|*/.env.development.local|\
      */.env.test.local|*/.env.production.local)
        warn "Potentially sensitive environment file is tracked: ${tracked_file}"
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
    if (( STRICT_GIT )); then
      die "Unstaged changes detected under --strict-git."
    fi
  fi
  if ! git diff --cached --quiet --; then
    warn "Staged changes exist."
    if (( STRICT_GIT )); then
      die "Staged changes detected under --strict-git."
    fi
  fi
  record_completed "Environment and Git checks"
}
# ------------------------------------------------------------
# Framework-neutral structure checks
# ------------------------------------------------------------
check_project_structure() {
  step "Checking project structure"
  if [[ -f server.js ]]; then
    success "server.js found."
  fi
  if [[ -d api ]]; then
    success "api/ directory found."
  fi
  if [[ -d src ]]; then
    success "src/ directory found."
  fi
  if [[ -d app ]]; then
    success "app/ directory found."
  fi
  if [[ -d src/app ]]; then
    success "src/app/ directory found."
  fi
  if [[ ! -f server.js && ! -d src && ! -d app && ! -d api ]]; then
    warn "No common application entry directory detected. Verify the project structure."
  fi
  record_completed "Project structure checks"
}
# ------------------------------------------------------------
# Package script helpers
# ------------------------------------------------------------
has_package_script() {
  local script_name="$1"
  node - "$script_name" <<'NODE'
'use strict';
const fs = require('node:fs');
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const script = pkg.scripts?.[process.argv[2]];
  process.exit(typeof script === 'string' && script.trim() ? 0 : 1);
} catch {
  process.exit(2);
}
NODE
}
run_project_script() {
  local script_name="$1"
  has_package_script "$script_name" ||
    die "Required npm-compatible script '$script_name' is missing."
  case "$PACKAGE_MANAGER" in
    npm)  npm run "$script_name" ;;
    pnpm) pnpm run "$script_name" ;;
    yarn) yarn run "$script_name" ;;
    bun)  bun run "$script_name" ;;
    *) die "Unsupported package manager." ;;
  esac
}
# ------------------------------------------------------------
# Installation
# ------------------------------------------------------------
install_dependencies() {
  step "Installing dependencies"
  if (( CHECK_ONLY || SKIP_INSTALL )); then
    log "Dependency installation skipped."
    return 0
  fi
  case "$PACKAGE_MANAGER" in
    npm)
      if [[ -f package-lock.json || -f npm-shrinkwrap.json ]]; then
        npm ci
      else
        die "No npm lockfile found. Create and review a lockfile manually, or use --skip-install."
      fi
      ;;
    pnpm)
      [[ -f pnpm-lock.yaml ]] ||
        die "pnpm lockfile missing; refusing installation."
      pnpm install --frozen-lockfile
      ;;
    yarn)
      [[ -f yarn.lock ]] ||
        die "Yarn lockfile missing; refusing installation."
      if yarn --version | grep -q '^1\.'; then
        yarn install --frozen-lockfile
      else
        yarn install --immutable
      fi
      ;;
    bun)
      [[ -f bun.lock || -f bun.lockb ]] ||
        die "Bun lockfile missing; refusing installation."
      bun install --frozen-lockfile
      ;;
    *)
      die "Unsupported package manager."
      ;;
  esac
  INSTALL_PERFORMED=1
  success "Dependencies installed."
  record_completed "Dependency installation"
}
# ------------------------------------------------------------
# Lint
# ------------------------------------------------------------
run_lint() {
  step "Linting"
  if (( CHECK_ONLY || SKIP_LINT )); then
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
# ------------------------------------------------------------
# Tests
# ------------------------------------------------------------
run_tests() {
  step "Automated tests"
  if (( CHECK_ONLY || SKIP_TESTS )); then
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
  record_completed "Tests"
}
# ------------------------------------------------------------
# Security audit
# ------------------------------------------------------------
run_audit() {
  step "Dependency audit"
  if (( CHECK_ONLY || ! RUN_AUDIT )); then
    log "Audit not requested."
    return 0
  fi
  [[ "$PACKAGE_MANAGER" == npm ]] ||
    die "--audit supports npm projects only."
  [[ -f package-lock.json || -f npm-shrinkwrap.json ]] ||
    die "npm audit requires a lockfile."
  npm audit --audit-level=high
  AUDIT_PERFORMED=1
  success "Dependency audit passed."
  record_completed "Dependency audit"
}
# ------------------------------------------------------------
# Build
# ------------------------------------------------------------
run_build() {
  step "Production build"
  if (( CHECK_ONLY || SKIP_BUILD )); then
    log "Build skipped."
    return 0
  fi
  if ! has_package_script build; then
    die "No build script configured. Use --skip-build only if this project does not require one."
  fi
  run_project_script build
  BUILD_PERFORMED=1
  success "Build passed."
  record_completed "Build"
}
# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------
print_summary() {
  local elapsed=$((SECONDS - START_TIME))
  printf '\n%s====================================================%s\n' "$CYAN" "$RESET"
  printf '%s%s -- Execution Summary%s\n' "$CYAN" "$PROJECT_NAME" "$RESET"
  printf '%s====================================================%s\n' "$CYAN" "$RESET"
  printf 'Root:       %s\n' "$PROJECT_ROOT"
  printf 'Node.js:    %s\n' "$(node -p 'process.versions.node')"
  printf 'Manager:    %s %s\n' "$PACKAGE_MANAGER" "$PACKAGE_MANAGER_VERSION"
  printf 'Elapsed:    %ss\n' "$elapsed"
  printf 'Mode:       %s\n' "$([[ $CHECK_ONLY -eq 1 ]] && printf 'check-only' || printf 'normal')"
  printf '\nCompleted steps:\n'
  if ((${#COMPLETED_STEPS[@]} == 0)); then
    printf '  None\n'
  else
    local item
    for item in "${COMPLETED_STEPS[@]}"; do
      printf '  - %s\n' "$item"
    done
  fi
  printf '\nExecution results:\n'
  printf '  Install: %s\n' "$([[ $INSTALL_PERFORMED -eq 1 ]] && printf 'passed' || printf 'not run')"
  printf '  Lint:    %s\n' "$([[ $LINT_PERFORMED -eq 1 ]] && printf 'passed' || printf 'not run')"
  printf '  Tests:   %s\n' "$([[ $TEST_PERFORMED -eq 1 ]] && printf 'passed' || printf 'not run')"
  printf '  Build:   %s\n' "$([[ $BUILD_PERFORMED -eq 1 ]] && printf 'passed' || printf 'not run')"
  printf '  Audit:   %s\n' "$([[ $AUDIT_PERFORMED -eq 1 ]] && printf 'passed' || printf 'not run')"
  printf '  Warnings: %s\n' "$WARNINGS"
  if (( WARNINGS > 0 )); then
    printf '\nWarnings:\n'
    local warning
    for warning in "${WARNING_MESSAGES[@]}"; do
      printf '  - %s\n' "$warning"
    done
  fi
  printf '\n'
  success "Workflow completed."
  log "No deployment or database migration was performed."
}
# ------------------------------------------------------------
# Main
# ------------------------------------------------------------
main() {
  printf '\n%s%s -- Setup, Validation & Build%s\n' "$CYAN" "$PROJECT_NAME" "$RESET"
  parse_arguments "$@"
  locate_project_root
  check_runtime
  validate_package_json
  detect_package_manager
  check_environment_and_git
  check_project_structure
  if (( CHECK_ONLY )); then
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