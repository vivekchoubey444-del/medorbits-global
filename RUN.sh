#!/usr/bin/env bash
# ============================================================
# MEDORBITS SAFE APPLICATION RUNNER
# File: /RUN.sh
#
# Purpose:
#   Safely run MedOrbits commands from the repository root.
#
# Usage:
#   bash RUN.sh
#   bash RUN.sh start
#   bash RUN.sh dev
#   bash RUN.sh test
#   bash RUN.sh test-quick
#   bash RUN.sh test-python
#   bash RUN.sh test-node
#   bash RUN.sh check
#   bash RUN.sh help
#
# Safety:
#   - Never runs git reset --hard or git clean.
#   - Never deletes or overwrites user files intentionally.
#   - Never installs packages automatically.
#   - Never prints environment variable values or secrets.
#   - Does not publish or deploy the application.
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
readonly SCRIPT_NAME="MedOrbits Safe Runner"
readonly SCRIPT_DIR="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &&
    pwd -P
)"
readonly ROOT_DIR="$SCRIPT_DIR"
COMMAND="${1:-start}"
log() {
  printf '[INFO] %s\n' "$*"
}
warn() {
  printf '[WARN] %s\n' "$*" >&2
}
error() {
  printf '[ERROR] %s\n' "$*" >&2
}
die() {
  error "$*"
  exit 1
}
has_command() {
  command -v "$1" >/dev/null 2>&1
}
section() {
  printf '\n%s\n' '============================================================'
  printf '%s\n' "$*"
  printf '%s\n\n' '============================================================'
}
show_help() {
  cat <<'HELP'
MedOrbits Safe Runner
Usage:
  bash RUN.sh [command]
Commands:
  start        Start the application using npm start.
  dev          Start the application using npm run dev.
  test         Run tools/TEST.sh.
  test-quick   Run essential tests.
  test-python  Run Python checks.
  test-node    Run Node.js checks.
  check        Check basic project configuration.
  help         Show this help message.
Safety:
  - No automatic package installation.
  - No destructive Git operations.
  - No automatic deployment.
  - No automatic file deletion or overwriting.
  - No environment secret values are printed.
Requirements:
  - Node.js and npm for application commands.
  - Python 3 for Python checks.
  - Required dependencies must already be installed.
  - tools/TEST.sh is required for test commands.
Examples:
  bash RUN.sh check
  bash RUN.sh test-quick
  bash RUN.sh start
HELP
}
require_file() {
  local file="$1"
  local purpose="$2"
  [[ -f "$file" ]] ||
    die "$purpose file not found: $file"
}
require_command() {
  local executable="$1"
  has_command "$executable" ||
    die "Required command not found: $executable"
}
check_project() {
  section "Project configuration"
  require_file "$ROOT_DIR/package.json" "Node.js package configuration"
  require_command node
  require_command npm
  log "Node.js: $(node --version)"
  log "npm: $(npm --version)"
  node - "$ROOT_DIR/package.json" <<'NODE'
'use strict';
const fs = require('node:fs');
const file = process.argv[2];
try {
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
    throw new Error('package.json must contain a JSON object');
  }
  const scripts = pkg.scripts || {};
  console.log(`Package: ${pkg.name || '(unnamed)'}`);
  console.log(`Version: ${pkg.version || '(not specified)'}`);
  console.log(`Node engine: ${pkg.engines?.node || '(not specified)'}`);
  console.log(`Start script: ${scripts.start ? 'available' : 'not defined'}`);
  console.log(`Dev script: ${scripts.dev ? 'available' : 'not defined'}`);
  console.log(`Test script: ${scripts.test ? 'available' : 'not defined'}`);
} catch (error) {
  console.error(`Invalid package.json: ${error.message}`);
  process.exitCode = 1;
}
NODE
  if [[ -d "$ROOT_DIR/node_modules" ]]; then
    log "node_modules directory exists."
  else
    warn "node_modules is missing. No dependencies were installed."
  fi
  if [[ -f "$ROOT_DIR/.env" ]]; then
    warn ".env exists locally. Ensure it is excluded from version control."
  else
    log "No root .env file found."
  fi
  if [[ -f "$ROOT_DIR/.env.example" ]]; then
    log ".env.example found."
  fi
  if [[ -f "$ROOT_DIR/server.js" ]]; then
    log "server.js found."
  else
    warn "server.js not found; inspect the configured start script."
  fi
  if [[ -f "$ROOT_DIR/tools/TEST.sh" ]]; then
    log "tools/TEST.sh found."
  else
    warn "tools/TEST.sh not found."
  fi
  if has_command git &&
    git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    log "Git repository detected."
    if ! git -C "$ROOT_DIR" diff --check; then
      warn "Git whitespace checks reported issues."
    fi
  else
    warn "Git repository not detected."
  fi
  success_message="Project configuration inspection completed."
  log "$success_message"
}
get_npm_script() {
  local package_file="$1"
  local script_name="$2"
  node - "$package_file" "$script_name" <<'NODE'
'use strict';
const fs = require('node:fs');
const packageFile = process.argv[2];
const scriptName = process.argv[3];
try {
  const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  const value = pkg.scripts?.[scriptName];
  if (typeof value !== 'string' || value.trim() === '') {
    console.error(`Missing or empty npm script: ${scriptName}`);
    process.exit(1);
  }
  // Print only the script definition for presence checking.
  // Do not print the script itself, which might contain secrets.
  process.stdout.write('available');
} catch (error) {
  console.error(`Cannot read package.json: ${error.message}`);
  process.exit(1);
}
NODE
}
run_npm_script() {
  local script_name="$1"
  require_file "$ROOT_DIR/package.json" "Node.js package configuration"
  require_command node
  require_command npm
  get_npm_script "$ROOT_DIR/package.json" "$script_name" ||
    die "package.json does not define a usable '$script_name' script."
  if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
    die "node_modules is missing. Install reviewed dependencies manually first."
  fi
  section "Running npm script"
  log "Executing the configured npm script: $script_name"
  cd "$ROOT_DIR"
  npm run "$script_name"
}
run_tests() {
  local mode="${1:-all}"
  local test_script="$ROOT_DIR/tools/TEST.sh"
  require_file "$test_script" "MedOrbits test runner"
  require_command bash
  section "MedOrbits tests"
  log "Test mode: $mode"
  case "$mode" in
    all)
      bash "$test_script"
      ;;
    quick)
      bash "$test_script" --quick
      ;;
    python)
      bash "$test_script" --python-only
      ;;
    node)
      bash "$test_script" --node-only
      ;;
    *)
      die "Unsupported test mode: $mode"
      ;;
  esac
}
main() {
  section "$SCRIPT_NAME"
  log "Repository root: $ROOT_DIR"
  log "Command: $COMMAND"
  case "$COMMAND" in
    start)
      run_npm_script start
      ;;
    dev)
      run_npm_script dev
      ;;
    test)
      run_tests all
      ;;
    test-quick)
      run_tests quick
      ;;
    test-python)
      require_command python3
      run_tests python
      ;;
    test-node)
      require_command node
      run_tests node
      ;;
    check)
      check_project
      ;;
    help|-h|--help)
      show_help
      ;;
    *)
      show_help >&2
      die "Unknown command: $COMMAND"
      ;;
  esac
}
main "$@"