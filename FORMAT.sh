#!/usr/bin/env bash
# ============================================================
# MEDORBITS -- SAFE FORMAT UTILITY
# File: /FORMAT.sh
#
# Purpose:
#   Check or format supported project files using local tools.
#
# Commands:
#   ./FORMAT.sh help
#   ./FORMAT.sh check
#   ./FORMAT.sh format
#   ./FORMAT.sh check-js
#   ./FORMAT.sh format-js
#   ./FORMAT.sh check-staged
#   ./FORMAT.sh status
#
# Safety:
#   - No automatic dependency installation.
#   - No Git reset, clean, checkout, or stash.
#   - No file deletion.
#   - Check mode does not intentionally modify source files.
#   - Format mode may modify files; review Git diff afterward.
#   - Does not format ignored or generated directories by default.
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
SCRIPT_NAME="FORMAT.sh"
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
MODE="${1:-help}"
shift || true
log() {
  printf '[FORMAT] %s\n' "$*"
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
MedOrbits Safe Format Utility
Usage:
  ./FORMAT.sh COMMAND
Commands:
  help          Show this help.
  check         Check formatting without intentional source edits.
  format        Format supported files using local Prettier.
  check-js      Check JavaScript files with ESLint, if configured.
  format-js     Format JavaScript files with Prettier.
  check-staged  Check staged files without staging or committing changes.
  status        Show formatter availability and Git status.
Requirements:
  - Node.js/npm for npm-based projects.
  - A locally installed Prettier for formatting.
  - ESLint for check-js, if configured.
Examples:
  ./FORMAT.sh check
  ./FORMAT.sh format
  ./FORMAT.sh check-js
  ./FORMAT.sh check-staged
  git diff --check
  git diff --stat
Notes:
  - This script does not install packages.
  - Format mode may change files. Inspect git diff afterward.
  - check-staged checks the current contents of staged paths; it
    does not create or modify the Git index.
EOF
}
check_root() {
  if [[ ! -d "$ROOT_DIR" ]]; then
    error "Repository root does not exist."
    return 1
  fi
}
check_package_json() {
  [[ -f "$ROOT_DIR/package.json" ]] || {
    warn "package.json not found."
    return 1
  }
  if ! have node; then
    warn "Node.js is unavailable."
    return 1
  fi
  node -e '
    const fs = require("node:fs");
    try {
      const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
      if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
        throw new Error("package.json must contain an object");
      }
    } catch (error) {
      console.error("[FORMAT] Invalid package.json:", error.message);
      process.exit(1);
    }
  '
}
find_prettier() {
  if [[ -x "$ROOT_DIR/node_modules/.bin/prettier" ]]; then
    printf '%s\n' "$ROOT_DIR/node_modules/.bin/prettier"
    return 0
  fi
  if have prettier; then
    command -v prettier
    return 0
  fi
  return 1
}
find_eslint() {
  if [[ -x "$ROOT_DIR/node_modules/.bin/eslint" ]]; then
    printf '%s\n' "$ROOT_DIR/node_modules/.bin/eslint"
    return 0
  fi
  if have eslint; then
    command -v eslint
    return 0
  fi
  return 1
}
show_status() {
  log "Repository: $ROOT_DIR"
  if have node; then
    log "Node.js: $(node --version)"
  else
    warn "Node.js is not installed."
  fi
  if have npm; then
    log "npm: $(npm --version)"
  else
    warn "npm is not installed."
  fi
  local prettier_bin
  if prettier_bin="$(find_prettier)"; then
    log "Prettier: $("$prettier_bin" --version)"
  else
    warn "Prettier is not installed locally or globally."
  fi
  local eslint_bin
  if eslint_bin="$(find_eslint)"; then
    log "ESLint: $("$eslint_bin" --version)"
  else
    warn "ESLint is not installed locally or globally."
  fi
  if have git && git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    log "Git status:"
    git -C "$ROOT_DIR" status --short --branch
  else
    warn "Git repository not detected."
  fi
}
run_prettier() {
  local action="$1"
  shift
  local prettier_bin
  if ! prettier_bin="$(find_prettier)"; then
    error "Prettier is unavailable. Install it through your normal project workflow."
    return 1
  fi
  local -a paths=(
    "*.js"
    "*.cjs"
    "*.mjs"
    "*.json"
    "*.jsonc"
    "*.css"
    "*.scss"
    "*.html"
    "*.md"
    "*.mdx"
    "*.yaml"
    "*.yml"
    "*.sh"
    "*.xml"
  )
  local -a options=(
    "--ignore-path"
    ".prettierignore"
  )
  if [[ "$action" == "check" ]]; then
    log "Checking formatting..."
    "$prettier_bin" --check "${options[@]}" "${paths[@]}" "$@"
  else
    log "Formatting supported files..."
    "$prettier_bin" --write "${options[@]}" "${paths[@]}" "$@"
  fi
}
run_eslint_check() {
  local eslint_bin
  if ! eslint_bin="$(find_eslint)"; then
    error "ESLint is unavailable."
    return 1
  fi
  log "Running ESLint checks..."
  if [[ -f "$ROOT_DIR/eslint.config.js" ]]; then
    "$eslint_bin" --config eslint.config.js .
  elif [[ -f "$ROOT_DIR/eslint.config.cjs" ]]; then
    "$eslint_bin" --config eslint.config.cjs .
  elif [[ -f "$ROOT_DIR/eslint-config.js" ]]; then
    "$eslint_bin" --config eslint-config.js .
  else
    warn "No recognized ESLint configuration filename found."
    return 1
  fi
}
run_staged_check() {
  if ! have git || ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    error "Git repository required for check-staged."
    return 1
  fi
  local prettier_bin
  if ! prettier_bin="$(find_prettier)"; then
    error "Prettier is unavailable."
    return 1
  fi
  local -a files=()
  local file
  while IFS= read -r -d '' file; do
    case "$file" in
      *.js|*.cjs|*.mjs|*.json|*.jsonc|*.css|*.scss|*.html|*.md|*.mdx|*.yaml|*.yml|*.sh|*.xml)
        [[ -f "$ROOT_DIR/$file" ]] && files+=("$file")
        ;;
    esac
  done < <(git -C "$ROOT_DIR" diff --cached --name-only --diff-filter=ACMR -z)
  if [[ "${#files[@]}" -eq 0 ]]; then
    log "No supported staged files found."
    return 0
  fi
  log "Checking ${#files[@]} staged file(s)..."
  "$prettier_bin" --check --ignore-path .prettierignore "${files[@]}"
}
main() {
  check_root
  case "$MODE" in
    help|-h|--help)
      usage
      ;;
    status)
      show_status
      ;;
    check)
      check_package_json
      run_prettier check
      ;;
    format)
      check_package_json
      run_prettier format
      ;;
    check-js)
      run_eslint_check
      ;;
    format-js)
      run_prettier format \
        --parser babel \
        --no-error-on-unmatched-pattern \
        "*.js" "*.cjs" "*.mjs"
      ;;
    check-staged)
      run_staged_check
      ;;
    *)
      error "Unknown command: $MODE"
      usage
      return 2
      ;;
  esac
}
main "$@"