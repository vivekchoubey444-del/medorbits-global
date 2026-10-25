
#!/usr/bin/env bash

# ============================================================
# MedOrbits -- Enterprise Setup, Validation & Build
# File: APPLY.sh
#
# Requirements:
#   - Bash 4+
#   - Node.js >= 20
#   - One supported package manager:
#       npm, pnpm, Yarn, or Bun
#
# Capabilities:
#   - Project-root detection
#   - Runtime and package-manager validation
#   - Lockfile-aware dependency installation
#   - Environment and secret-exposure checks
#   - Lint, test, build and optional audit
#   - Optional preflight-only execution
#   - Safe error reporting and execution summaries
#
# This script does not deploy to production, delete files,
# change database schemas, or modify remote infrastructure.
# ============================================================

set -Eeuo pipefail
IFS=$'\n\t'

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

PACKAGE_MANAGER=""
PACKAGE_MANAGER_VERSION=""
INSTALL_PERFORMED=0
LINT_PERFORMED=0
TEST_PERFORMED=0
BUILD_PERFORMED=0
AUDIT_PERFORMED=0
CHECK_ONLY=0
SKIP_INSTALL=0
SKIP_LINT=0
SKIP_TESTS=0
SKIP_BUILD=0
RUN_AUDIT=0
REQUIRE_LINT=0
REQUIRE_TESTS=0
STRICT_ENV=0

WARNINGS=0
declare -a WARNING_MESSAGES=()
declare -a COMPLETED_STEPS=()
declare -a FAILED_STEPS=()

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

record_failed() {
  FAILED_STEPS+=("$*")
}

on_error() {
  local exit_code=$?
  local line_number="${BASH_LINENO[0]:-unknown}"
  local command="${BASH_COMMAND:-unknown}"

  printf '\n%s[ERROR]%s Command failed with exit code %s.\n' \
    "$RED" "$RESET" "$exit_code" >&2

  printf '%s[ERROR]%s Location: %s:%s\n' \
    "$RED" "$RESET" "$SCRIPT_NAME" "$line_number" >&2

  # Avoid printing the entire environment or secret values.
  printf '%s[ERROR]%s Command: %s\n' \
    "$RED" "$RESET" "$command" >&2

  exit "$exit_code"
}

on_signal() {
  local signal_name="$1"

  printf '\n%s[WARN]%s Interrupted by %s.\n' \
    "$YELLOW" "$RESET" "$signal_name" >&2

  exit 130
}

trap on_error ERR
trap 'on_signal INT' INT
trap 'on_signal TERM' TERM

# ------------------------------------------------------------
# Help and command-line options
# ------------------------------------------------------------

show_help() {
  cat <<'EOF'
MedOrbits APPLY.sh

Usage:
  ./APPLY.sh [options]

Options:
  --help            Show this help message
  --check-only      Validate project and environment without installing,
                    testing, linting, auditing, or building
  --skip-install    Skip dependency installation
  --skip-lint       Skip lint checks
  --skip-tests      Skip automated tests
  --skip-build      Skip the production build
  --audit           Run npm security audit (npm projects only)
  --require-lint    Fail if no lint script exists
  --require-tests   Fail if no test script exists
  --strict-env      Treat missing .env.example or .gitignore as errors

Examples:
  chmod +x APPLY.sh
  ./APPLY.sh
  ./APPLY.sh --check-only
  ./APPLY.sh --skip-tests
  ./APPLY.sh --audit --require-lint --require-tests

Notes:
  - A production build is required by default.
  - Lint and tests are optional unless explicitly required.
  - The script never performs a production deployment.
  - Do not run npm audit fix automatically in production.
EOF
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
      *)
        die "Unknown option: $1. Use --help to see available options."
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
# General utilities
# ------------------------------------------------------------

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

require_command() {
  command_exists "$1" || die "Required command not found: $1"
}

has_package_script() {
  local script_name="$1"

  node - "$script_name" <<'NODE'
const fs = require("node:fs");

try {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const name = process.argv[2];
  const value = pkg.scripts?.[name];

  process.exit(typeof value === "string" && value.trim() ? 0 : 1);
} catch {
  process.exit(2);
}
NODE
}

get_package_script() {
  local script_name="$1"

  node - "$script_name" <<'NODE'
const fs = require("node:fs");

try {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const value = pkg.scripts?.[process.argv[2]];
  if (typeof value === "string") process.stdout.write(value);
} catch {
  process.exit(1);
}
NODE
}

# ------------------------------------------------------------
# Project root and runtime
# ------------------------------------------------------------

locate_project_root() {
  local script_path="${BASH_SOURCE[0]}"
  local script_dir

  script_dir="$(cd -- "$(dirname -- "$script_path")" && pwd -P)" ||
    die "Unable to resolve the script directory."

  cd -- "$script_dir" ||
    die "Unable to enter the project directory."

  [[ -f "package.json" ]] ||
    die "package.json was not found beside APPLY.sh. Place this script in the project root."

  success "Project root: $PWD"
}

check_runtime() {
  step "Validating system requirements"

  require_command bash
  require_command node
  require_command git

  local node_version
  local node_major
  local npm_version

  node_version="$(node -p 'process.versions.node')" ||
    die "Unable to read Node.js version."

  node_major="${node_version%%.*}"

  [[ "$node_major" =~ ^[0-9]+$ ]] ||
    die "Unable to parse Node.js version: $node_version"

  (( node_major >= MIN_NODE_MAJOR )) ||
    die "Node.js >= ${MIN_NODE_MAJOR} required; found ${node_version}."

  success "Node.js ${node_version}"

  if command_exists npm; then
    npm_version="$(npm --version)"
    log "npm ${npm_version}"
  fi

  local bash_major="${BASH_VERSINFO[0]}"

  (( bash_major >= 4 )) ||
    die "Bash 4 or newer is required."

  success "Bash ${BASH_VERSION}"

  record_completed "Runtime validation"
}

validate_package_json() {
  step "Validating package.json"

  node <<'NODE'
const fs = require("node:fs");

let pkg;

try {
  pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
} catch (error) {
  console.error("package.json is not valid JSON.");
  process.exit(1);
}

if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
  console.error("package.json must contain a JSON object.");
  process.exit(1);
}

if (typeof pkg.name !== "string" || !pkg.name.trim()) {
  console.error("Warning: package.json has no valid package name.");
}

if (!pkg.scripts || typeof pkg.scripts !== "object") {
  console.error("Warning: package.json has no scripts object.");
}

if (!pkg.scripts?.build) {
  console.error("Warning: no build script is configured.");
}

console.log("package.json is valid.");
NODE

  success "package.json validated"
  record_completed "Package manifest validation"
}

check_project_structure() {
  step "Checking project structure"

  if [[ -d "app" || -d "src/app" ]]; then
    success "Next.js App Router directory found"
  else
    warn "Neither app/ nor src/app/ exists. Verify the repository structure."
  fi

  if [[ -d "app/api" ]]; then
    success "app/api directory found"
  elif [[ -d "src/app/api" ]]; then
    success "src/app/api directory found"
  else
    warn "No app/api directory found."
  fi

  if [[ -f "next.config.js" || \
        -f "next.config.mjs" || \
        -f "next.config.ts" || \
        -f "next.config.mts" ]]; then
    success "Next.js configuration file found"
  else
    warn "No standard Next.js configuration file found."
  fi

  record_completed "Project structure validation"
}

# ------------------------------------------------------------
# Package manager and lockfile detection
# ------------------------------------------------------------

detect_package_manager() {
  step "Detecting package manager"

  local npm_lock=0
  local pnpm_lock=0
  local yarn_lock=0
  local bun_lock=0
  local declared_manager=""

  [[ -f "package-lock.json" || -f "npm-shrinkwrap.json" ]] && npm_lock=1
  [[ -f "pnpm-lock.yaml" ]] && pnpm_lock=1
  [[ -f "yarn.lock" ]] && yarn_lock=1
  [[ -f "bun.lock" || -f "bun.lockb" ]] && bun_lock=1

  local lock_count=$((npm_lock + pnpm_lock + yarn_lock + bun_lock))

  (( lock_count <= 1 )) ||
    die "Multiple package-manager lockfiles found. Keep only the intended lockfile."

  declared_manager="$(node -e '
    try {
      const p = require("./package.json");
      const value = p.packageManager;
      if (typeof value === "string") process.stdout.write(value);
    } catch {}
  ')"

  if [[ -n "$declared_manager" ]]; then
    case "$declared_manager" in
      npm@*)  declared_manager="npm" ;;
      pnpm@*) declared_manager="pnpm" ;;
      yarn@*) declared_manager="yarn" ;;
      bun@*)  declared_manager="bun" ;;
      *)
        die "Unsupported packageManager declaration: $declared_manager"
        ;;
    esac
  fi

  if [[ -n "$declared_manager" ]]; then
    PACKAGE_MANAGER="$declared_manager"
  elif (( npm_lock )); then
    PACKAGE_MANAGER="npm"
  elif (( pnpm_lock )); then
    PACKAGE_MANAGER="pnpm"
  elif (( yarn_lock )); then
    PACKAGE_MANAGER="yarn"
  elif (( bun_lock )); then
    PACKAGE_MANAGER="bun"
  else
    PACKAGE_MANAGER="npm"
    warn "No lockfile found. npm will be used; reproducibility is reduced."
  fi

  if (( lock_count > 0 )); then
    case "$PACKAGE_MANAGER" in
      npm)
        (( npm_lock )) || die "npm is declared but its lockfile is missing."
        ;;
      pnpm)
        (( pnpm_lock )) || die "pnpm is declared but its lockfile is missing."
        ;;
      yarn)
        (( yarn_lock )) || die "Yarn is declared but its lockfile is missing."
        ;;
      bun)
        (( bun_lock )) || die "Bun is declared but its lockfile is missing."
        ;;
    esac
  fi

  require_command "$PACKAGE_MANAGER"

  PACKAGE_MANAGER_VERSION="$("$PACKAGE_MANAGER" --version)"

  success "Package manager: ${PACKAGE_MANAGER} ${PACKAGE_MANAGER_VERSION}"

  record_completed "Package manager detection"
}

# ------------------------------------------------------------
# Environment and secret checks
# ------------------------------------------------------------

check_environment_files() {
  step "Checking environment files and secret protection"

  if [[ -f ".env.example" ]]; then
    success ".env.example found"
  elif (( STRICT_ENV )); then
    die ".env.example is required when --strict-env is enabled."
  else
    warn ".env.example is missing."
  fi

  if [[ -f ".gitignore" ]]; then
    success ".gitignore found"

    if ! grep -Eq '(^|/)\.env(\*|/|$)' .gitignore &&
       ! grep -Eq '(^|/)\.env\.\*' .gitignore; then
      warn "Review .gitignore: local environment files should be excluded."
    fi
  elif (( STRICT_ENV )); then
    die ".gitignore is required when --strict-env is enabled."
  else
    warn ".gitignore is missing. Add one before committing project files."
  fi

  if [[ -f ".env.local" ]]; then
    log ".env.local exists; its values will not be displayed."
  else
    log ".env.local is absent."
  fi

  if [[ -n "${DATABASE_URL:-}" ]]; then
    log "DATABASE_URL is exported in the current shell."
  else
    log "DATABASE_URL is not exported in the current shell."
  fi

  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    local tracked_file
    local sensitive_tracked=0

    while IFS= read -r -d '' tracked_file; do
      case "$tracked_file" in
        .env|.env.local|.env.production|.env.development.local|\
        .env.test.local|.env.production.local|\
        */.env.local|*/.env.production|*/.env.development.local|\
        */.env.test.local|*/.env.production.local)
          warn "Potentially sensitive environment file is tracked by Git: ${tracked_file}"
          sensitive_tracked=1
          ;;
      esac
    done < <(git ls-files -z)

    if (( sensitive_tracked )); then
      die "Remove sensitive environment files from Git tracking and rotate any exposed credentials."
    fi

    success "No common sensitive environment filenames found in tracked files"
  else
    warn "Not inside a Git work tree; tracked-secret checks were skipped."
  fi

  record_completed "Environment and secret checks"
}

check_required_directories() {
  step "Checking resource directories"

  if [[ -d "public/downloads" ]]; then
    success "public/downloads exists"
  else
    warn "public/downloads does not exist. Create it if the Download API needs bundled PDFs."
  fi

  if [[ -d "public" ]]; then
    success "public directory found"
  else
    log "No public directory found."
  fi

  record_completed "Resource directory check"
}

# ------------------------------------------------------------
# Dependency installation
# ------------------------------------------------------------

install_dependencies() {
  step "Installing dependencies"

  if (( CHECK_ONLY || SKIP_INSTALL )); then
    warn "Dependency installation skipped."
    return 0
  fi

  case "$PACKAGE_MANAGER" in
    npm)
      if [[ -f "package-lock.json" || -f "npm-shrinkwrap.json" ]]; then
        npm ci
      else
        npm install
      fi
      ;;
    pnpm)
      pnpm install --frozen-lockfile
      ;;
    yarn)
      if yarn --version | grep -q '^1\.'; then
        yarn install --frozen-lockfile
      else
        yarn install --immutable
      fi
      ;;
    bun)
      bun install --frozen-lockfile
      ;;
    *)
      die "Unsupported package manager: $PACKAGE_MANAGER"
      ;;
  esac

  INSTALL_PERFORMED=1
  success "Dependencies installed"
  record_completed "Dependency installation"
}

# ------------------------------------------------------------
# Package scripts
# ------------------------------------------------------------

run_project_script() {
  local script_name="$1"

  case "$PACKAGE_MANAGER" in
    npm)
      npm run "$script_name"
      ;;
    pnpm)
      pnpm run "$script_name"
      ;;
    yarn)
      yarn run "$script_name"
      ;;
    bun)
      bun run "$script_name"
      ;;
    *)
      die "Unsupported package manager: $PACKAGE_MANAGER"
      ;;
  esac
}

check_script_availability() {
  local script_name="$1"
  local required="$2"

  if has_package_script "$script_name"; then
    return 0
  fi

  if (( required )); then
    die "Required package.json script '$script_name' is missing."
  fi

  warn "No '$script_name' script is configured."
  return 1
}

run_lint() {
  step "Running lint checks"

  if (( CHECK_ONLY || SKIP_LINT )); then
    warn "Lint checks skipped."
    return 0
  fi

  if ! check_script_availability "lint" "$REQUIRE_LINT"; then
    return 0
  fi

  run_project_script "lint"

  LINT_PERFORMED=1
  success "Lint checks passed"
  record_completed "Lint"
}

run_tests() {
  step "Running automated tests"

  if (( CHECK_ONLY || SKIP_TESTS )); then
    warn "Automated tests skipped."
    return 0
  fi

  if ! check_script_availability "test" "$REQUIRE_TESTS"; then
    return 0
  fi

  # Prevent common test runners from entering interactive watch mode.
  CI=1 run_project_script "test"

  TEST_PERFORMED=1
  success "Automated tests passed"
  record_completed "Tests"
}

run_audit() {
  step "Running dependency security audit"

  if (( CHECK_ONLY || ! RUN_AUDIT )); then
    log "Dependency audit not requested."
    return 0
  fi

  if [[ "$PACKAGE_MANAGER" != "npm" ]]; then
    die "--audit currently supports npm projects only."
  fi

  if [[ ! -f "package-lock.json" && ! -f "npm-shrinkwrap.json" ]]; then
    die "npm audit requires package-lock.json or npm-shrinkwrap.json."
  fi

  npm audit --audit-level=high

  AUDIT_PERFORMED=1
  success "Dependency audit completed"
  record_completed "Dependency audit"
}

run_build() {
  step "Building the application"

  if (( CHECK_ONLY || SKIP_BUILD )); then
    warn "Production build skipped."
    return 0
  fi

  check_script_availability "build" 1 ||
    die "A build script is required unless --skip-build is specified."

  run_project_script "build"

  BUILD_PERFORMED=1
  success "Production build completed"
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

  printf 'Project root: %s\n' "$PWD"
  printf 'Node.js:      %s\n' "$(node -p 'process.versions.node')"
  printf 'Package mgr:  %s %s\n' "$PACKAGE_MANAGER" "$PACKAGE_MANAGER_VERSION"
  printf 'Elapsed:      %ss\n' "$elapsed"
  printf 'Mode:         %s\n' "$([[ $CHECK_ONLY -eq 1 ]] && printf 'check-only' || printf 'normal')"

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
  printf '  Dependencies installed: %s\n' "$([[ $INSTALL_PERFORMED -eq 1 ]] && printf 'yes' || printf 'no')"
  printf '  Lint passed:            %s\n' "$([[ $LINT_PERFORMED -eq 1 ]] && printf 'yes' || printf 'not run')"
  printf '  Tests passed:           %s\n' "$([[ $TEST_PERFORMED -eq 1 ]] && printf 'yes' || printf 'not run')"
  printf '  Build passed:           %s\n' "$([[ $BUILD_PERFORMED -eq 1 ]] && printf 'yes' || printf 'not run')"
  printf '  Audit passed:           %s\n' "$([[ $AUDIT_PERFORMED -eq 1 ]] && printf 'yes' || printf 'not run')"
  printf '  Warnings:               %s\n' "$WARNINGS"

  if (( WARNINGS > 0 )); then
    printf '\nWarnings:\n'

    local warning
    for warning in "${WARNING_MESSAGES[@]}"; do
      printf '  - %s\n' "$warning"
    done
  fi

  printf '\n'

  if (( CHECK_ONLY )); then
    success "Preflight checks completed. No installation, tests, audit, or build was run."
  else
    success "Requested workflow completed."
  fi

  cat <<'EOF'

Next steps:
  1. Review warnings and resolve any relevant issues.
  2. Confirm production environment variables in your hosting provider.
  3. Review the deployment platform's build and start commands.
  4. Deploy through your approved workflow.

Local development:
  npm run dev

Production server (after a successful build):
  npm run start

This script does not deploy to production or modify remote infrastructure.
EOF
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
  check_project_structure
  detect_package_manager
  check_environment_files
  check_required_directories

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
