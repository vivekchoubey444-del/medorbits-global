#!/usr/bin/env bash
# ============================================================
# MedOrbits Safe Deployment Utility
# File: /DEPLOY.sh
#
# Purpose:
#   Perform deployment preflight checks and optionally execute
#   an explicitly supplied deployment command.
#
# Commands:
#   ./DEPLOY.sh help
#   ./DEPLOY.sh check
#   ./DEPLOY.sh status
#   ./DEPLOY.sh test
#   ./DEPLOY.sh build
#   ./DEPLOY.sh prepare
#   ./DEPLOY.sh deploy -- COMMAND [ARGUMENTS...]
#
# Safety:
#   - Never runs git reset --hard.
#   - Never runs git clean.
#   - Never deletes or overwrites user files.
#   - Never pushes commits automatically.
#   - Never deploys unless explicitly requested.
#   - Never prints environment variable values or secrets.
#   - Does not install dependencies automatically.
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
SCRIPT_NAME="DEPLOY.sh"
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
EXIT_ERROR=1
EXIT_USAGE=2
log() {
  printf '[DEPLOY] %s\n' "$*"
}
warn() {
  printf '[WARN] %s\n' "$*" >&2
}
error() {
  printf '[ERROR] %s\n' "$*" >&2
}
success() {
  printf '[OK] %s\n' "$*"
}
have() {
  command -v "$1" >/dev/null 2>&1
}
usage() {
  cat <<'EOF'
MedOrbits Safe Deployment Utility
Usage:
  ./DEPLOY.sh help
  ./DEPLOY.sh check
  ./DEPLOY.sh status
  ./DEPLOY.sh test
  ./DEPLOY.sh build
  ./DEPLOY.sh prepare
  ./DEPLOY.sh deploy -- COMMAND [ARGUMENTS...]
Commands:
  help       Show this help message.
  check      Check tools, project files, and deployment configuration.
  status     Inspect Git state without changing it.
  test       Run the configured test workflow.
  build      Run the configured build script, if available.
  prepare    Run checks, inspect Git state, and run tests/build.
  deploy     Run prepare checks, then execute an explicitly supplied
             deployment command after interactive confirmation.
Examples:
  ./DEPLOY.sh check
  ./DEPLOY.sh status
  ./DEPLOY.sh test
  ./DEPLOY.sh build
  ./DEPLOY.sh prepare
  ./DEPLOY.sh deploy -- npx --no-install vercel deploy
Notes:
  - No deployment provider is assumed.
  - The deploy command is never inferred from environment variables.
  - The deployment command may make remote changes.
  - Review the command before confirming it.
  - No dependencies are installed automatically.
EOF
}
require_file() {
  local path="$1"
  local description="$2"
  if [[ -f "$path" ]]; then
    success "$description: $path"
    return 0
  fi
  warn "$description not found: $path"
  return 1
}
git_root() {
  have git || return 1
  git rev-parse --show-toplevel 2>/dev/null
}
check_git() {
  log "Checking Git repository..."
  if ! have git; then
    warn "Git is not installed or not available in PATH."
    return 1
  fi
  if ! git_root >/dev/null; then
    warn "This directory is not inside a Git repository."
    return 1
  fi
  success "Git repository detected."
  local branch
  branch="$(git branch --show-current 2>/dev/null || true)"
  if [[ -n "$branch" ]]; then
    log "Current branch: $branch"
  else
    warn "Git is in detached HEAD state or the branch name is unavailable."
  fi
  if ! git diff --quiet --; then
    warn "Tracked working-tree changes detected."
  else
    success "No tracked unstaged changes detected."
  fi
  if ! git diff --cached --quiet --; then
    warn "Staged changes detected."
  else
    success "No staged changes detected."
  fi
  if [[ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]]; then
    warn "Untracked, non-ignored files exist. Review them before deployment."
  else
    success "No untracked, non-ignored files detected."
  fi
  if [[ -n "$(git ls-files --others --ignored --exclude-standard 2>/dev/null)" ]]; then
    log "Ignored files exist; they are not listed to avoid exposing local paths."
  fi
  if ! git diff --check; then
    warn "Git diff --check found whitespace errors."
    return 1
  fi
  success "Git whitespace check passed."
}
check_tools() {
  log "Checking required tools..."
  local failures=0
  if have bash; then
    success "Bash available."
  else
    error "Bash is required."
    failures=1
  fi
  if have git; then
    success "Git available."
  else
    warn "Git unavailable."
  fi
  if have node; then
    success "Node.js available: $(node --version)"
  else
    warn "Node.js unavailable."
  fi
  if have npm; then
    success "npm available: $(npm --version)"
  else
    warn "npm unavailable."
  fi
  if have python3; then
    success "Python available: $(python3 --version 2>&1)"
  else
    warn "Python 3 unavailable."
  fi
  if have curl; then
    success "curl available."
  else
    log "curl unavailable; remote health checks are not provided by this script."
  fi
  return "$failures"
}
check_project_files() {
  log "Checking project files..."
  local failures=0
  if [[ -f package.json ]]; then
    success "package.json found."
    if ! node -e '
      const fs = require("node:fs");
      try {
        const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
        if (!p || typeof p !== "object" || Array.isArray(p)) process.exit(1);
      } catch {
        process.exit(1);
      }
    '; then
      error "package.json is invalid JSON."
      failures=1
    else
      success "package.json is valid JSON."
    fi
  else
    warn "package.json not found; Node.js checks may not apply."
  fi
  if [[ -f package-lock.json ]]; then
    success "package-lock.json found."
  elif [[ -f npm-shrinkwrap.json ]]; then
    success "npm-shrinkwrap.json found."
  elif [[ -f pnpm-lock.yaml ]]; then
    success "pnpm-lock.yaml found."
  elif [[ -f yarn.lock ]]; then
    success "yarn.lock found."
  else
    warn "No recognized package-manager lockfile found."
  fi
  if [[ -f .env ]]; then
    warn ".env exists. Its contents will not be displayed."
  else
    log ".env not found in repository root."
  fi
  if [[ -f .env.example ]]; then
    success ".env.example found."
  fi
  if [[ -f render.yaml ]]; then
    success "Render configuration file found."
  fi
  if [[ -f Dockerfile ]]; then
    success "Dockerfile found."
  fi
  if [[ -f Procfile ]]; then
    success "Procfile found."
  fi
  if [[ -d .github/workflows ]]; then
    success "GitHub Actions workflow directory found."
  fi
  return "$failures"
}
check_environment_names() {
  log "Checking required environment-variable declarations..."
  if [[ ! -f package.json ]] || ! have node; then
    log "Skipped environment declaration check."
    return 0
  fi
  node <<'NODE'
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const scripts = pkg.scripts || {};
const relevant = Object.keys(scripts).filter((name) =>
  /start|deploy|build|test/i.test(name)
);
console.log("[DEPLOY] Available scripts:", relevant.length
  ? relevant.join(", ")
  : "(none detected)");
const envFiles = [".env.example", ".env.production.example"];
for (const file of envFiles) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  const keys = content.split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/))
    .filter(Boolean)
    .map((match) => match[1]);
  console.log(`[DEPLOY] ${file}: ${keys.length} variable names declared`);
}
NODE
}
show_status() {
  log "Repository status..."
  if ! have git || ! git_root >/dev/null 2>&1; then
    warn "Git repository unavailable; status inspection skipped."
    return 1
  fi
  git status --short --branch
  log "Latest commit:"
  git log -1 --format='%h %s' 2>/dev/null || warn "No commit information available."
  log "Remote names (URLs are intentionally hidden):"
  git remote 2>/dev/null || true
  log "No repository files have been changed."
}
run_tests() {
  log "Running configured tests..."
  if [[ -x "$ROOT_DIR/tools/TEST.sh" ]]; then
    "$ROOT_DIR/tools/TEST.sh"
    return $?
  elif [[ -f "$ROOT_DIR/tools/TEST.sh" ]]; then
    bash "$ROOT_DIR/tools/TEST.sh"
    return $?
  fi
  if [[ -f "$ROOT_DIR/package.json" ]] && have npm; then
    local has_test
    has_test="$(node -e '
      const p = require("./package.json");
      process.stdout.write(p.scripts && p.scripts.test ? "yes" : "no");
    ')"
    if [[ "$has_test" == "yes" ]]; then
      npm test
      return $?
    fi
  fi
  warn "No recognized test runner found."
  return 1
}
run_build() {
  log "Running configured build..."
  if [[ ! -f "$ROOT_DIR/package.json" ]] || ! have npm; then
    warn "package.json or npm is unavailable; build skipped."
    return 1
  fi
  local has_build
  has_build="$(node -e '
    const p = require("./package.json");
    process.stdout.write(p.scripts && p.scripts.build ? "yes" : "no");
  ')"
  if [[ "$has_build" != "yes" ]]; then
    warn "No npm build script is configured."
    return 1
  fi
  npm run build
}
run_prepare() {
  local failures=0
  log "Starting deployment preparation..."
  check_tools || failures=1
  check_project_files || failures=1
  check_environment_names || failures=1
  check_git || failures=1
  if [[ "$failures" -ne 0 ]]; then
    error "Preflight checks reported issues. Review them before proceeding."
    return 1
  fi
  success "Preflight checks passed."
  return 0
}
run_deploy() {
  if [[ "${1:-}" != "--" ]]; then
    error "Deployment requires an explicit command separator: deploy -- COMMAND [ARGS...]"
    usage
    return "$EXIT_USAGE"
  fi
  shift
  if [[ "$#" -eq 0 ]]; then
    error "No deployment command supplied."
    return "$EXIT_USAGE"
  fi
  log "Running deployment preflight..."
  if ! run_prepare; then
    error "Deployment blocked because preflight checks failed."
    return 1
  fi
  printf '\n'
  warn "The following command may change a remote service or production environment:"
  printf '  '
  printf '%q ' "$@"
  printf '\n\n'
  warn "Review the command, provider, target environment, and repository state."
  printf 'Type DEPLOY to execute this command: '
  local confirmation=""
  IFS= read -r confirmation || true
  if [[ "$confirmation" != "DEPLOY" ]]; then
    log "Deployment cancelled. No deployment command was executed."
    return 1
  fi
  log "Executing explicitly supplied deployment command..."
  "$@"
  local result=$?
  if [[ "$result" -eq 0 ]]; then
    success "Deployment command completed successfully."
  else
    error "Deployment command failed with exit code $result."
  fi
  return "$result"
}
main() {
  local command="${1:-help}"
  case "$command" in
    help|-h|--help)
      usage
      ;;
    check)
      check_tools
      check_project_files
      check_environment_names
      ;;
    status)
      show_status
      ;;
    test)
      run_tests
      ;;
    build)
      run_build
      ;;
    prepare)
      run_prepare
      run_tests
      run_build
      ;;
    deploy)
      shift || true
      run_deploy "$@"
      ;;
    *)
      error "Unknown command: $command"
      usage
      return "$EXIT_USAGE"
      ;;
  esac
}
main "$@"