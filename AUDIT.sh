#!/usr/bin/env bash
# ============================================================
# MEDORBITS -- SAFE REPOSITORY & SECURITY AUDIT
# File: /AUDIT.sh
#
# Usage:
#   bash AUDIT.sh
#   bash AUDIT.sh all
#   bash AUDIT.sh dependencies
#   bash AUDIT.sh secrets
#   bash AUDIT.sh git
#   bash AUDIT.sh api
#   bash AUDIT.sh config
#   bash AUDIT.sh help
#
# Optional:
#   AUDIT_STRICT=1 bash AUDIT.sh
#
# Safety:
#   - Read-only inspection; no automatic fixes.
#   - No package installation or dependency upgrades.
#   - No Git reset, clean, checkout, or stash.
#   - No database migrations or deployments.
#   - Never prints environment variable values.
#   - Does not scan .env contents or print credentials.
#
# Requirements:
#   Bash 4+, Node.js for JSON/package checks.
#   npm audit is available only for npm lockfiles.
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
readonly SCRIPT_DIR="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &&
    pwd -P
)"
readonly ROOT_DIR="$SCRIPT_DIR"
COMMAND="${1:-all}"
STRICT="${AUDIT_STRICT:-0}"
ERRORS=0
WARNINGS=0
CHECKS=0
declare -a WARNING_MESSAGES=()
log() {
  printf '[AUDIT] %s\n' "$*"
}
success() {
  printf '[OK] %s\n' "$*"
}
warn() {
  WARNINGS=$((WARNINGS + 1))
  WARNING_MESSAGES+=("$*")
  printf '[WARN] %s\n' "$*" >&2
}
error() {
  ERRORS=$((ERRORS + 1))
  printf '[ERROR] %s\n' "$*" >&2
}
section() {
  printf '\n%s\n' '============================================================'
  printf '%s\n' "$*"
  printf '%s\n\n' '============================================================'
}
has() {
  command -v "$1" >/dev/null 2>&1
}
help() {
  cat <<'HELP'
MedOrbits Safe Audit
Commands:
  all           Run all local checks (default).
  dependencies  Inspect package manager and dependency security.
  secrets       Check common secret-file exposure risks.
  git           Inspect Git state and tracked sensitive filenames.
  api           Inspect API routes, controllers and JSON schemas.
  config        Validate key project configuration files.
  help          Show this help.
Examples:
  bash AUDIT.sh
  bash AUDIT.sh dependencies
  bash AUDIT.sh secrets
  AUDIT_STRICT=1 bash AUDIT.sh all
Strict mode:
  AUDIT_STRICT=1 turns selected warnings into errors.
Safety:
  No automatic fixes or dependency upgrades.
  No secrets or .env file contents are printed.
  This is a heuristic audit, not a penetration test.
HELP
}
require_node() {
  if ! has node; then
    error "Node.js is required for JSON and package checks."
    return 1
  fi
  return 0
}
# ------------------------------------------------------------
# Configuration checks
# ------------------------------------------------------------
audit_config() {
  section "Configuration audit"
  CHECKS=$((CHECKS + 1))
  if [[ -f "$ROOT_DIR/package.json" ]]; then
    if node - "$ROOT_DIR/package.json" <<'NODE'
'use strict';
const fs = require('node:fs');
try {
  const pkg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
    throw new Error('Expected a JSON object');
  }
  if (pkg.scripts !== undefined &&
      (!pkg.scripts || typeof pkg.scripts !== 'object' ||
       Array.isArray(pkg.scripts))) {
    throw new Error('scripts must be an object');
  }
  console.log(`Package name: ${pkg.name || '(not specified)'}`);
  console.log(`Node engine: ${pkg.engines?.node || '(not specified)'}`);
  console.log(`Build script: ${pkg.scripts?.build ? 'configured' : 'not configured'}`);
  console.log(`Lint script: ${pkg.scripts?.lint ? 'configured' : 'not configured'}`);
  console.log(`Test script: ${pkg.scripts?.test ? 'configured' : 'not configured'}`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
NODE
    then
      success "package.json is valid."
    else
      error "package.json validation failed."
    fi
  else
    error "package.json is missing."
  fi
  local config_file
  local found_config=0
  for config_file in \
    eslint.config.js \
    eslint.config.cjs \
    eslint.config.mjs \
    eslint-config.js \
    .prettierrc \
    .prettierrc.json \
    prettier.config.js \
    prettier.config.cjs \
    Dockerfile \
    docker-compose.yml \
    compose.yaml \
    render.yaml; do
    if [[ -f "$ROOT_DIR/$config_file" ]]; then
      log "Found: $config_file"
      found_config=1
    fi
  done
  if (( found_config == 0 )); then
    warn "No recognized optional configuration files found."
  fi
  for config_file in \
    .gitignore \
    .dockerignore \
    .env.example; do
    if [[ -f "$ROOT_DIR/$config_file" ]]; then
      success "$config_file exists."
    else
      warn "$config_file is missing."
    fi
  done
}
# ------------------------------------------------------------
# Dependency audit
# ------------------------------------------------------------
audit_dependencies() {
  section "Dependency and package-manager audit"
  CHECKS=$((CHECKS + 1))
  require_node || return
  if [[ ! -f "$ROOT_DIR/package.json" ]]; then
    error "Cannot audit dependencies without package.json."
    return
  fi
  local npm_lock=0
  local pnpm_lock=0
  local yarn_lock=0
  local bun_lock=0
  [[ -f "$ROOT_DIR/package-lock.json" || \
     -f "$ROOT_DIR/npm-shrinkwrap.json" ]] && npm_lock=1
  [[ -f "$ROOT_DIR/pnpm-lock.yaml" ]] && pnpm_lock=1
  [[ -f "$ROOT_DIR/yarn.lock" ]] && yarn_lock=1
  [[ -f "$ROOT_DIR/bun.lock" || \
     -f "$ROOT_DIR/bun.lockb" ]] && bun_lock=1
  local lock_count=$((npm_lock + pnpm_lock + yarn_lock + bun_lock))
  if (( lock_count == 0 )); then
    warn "No recognized package lockfile found."
  elif (( lock_count > 1 )); then
    error "Multiple package-manager lockfiles detected."
  else
    success "Exactly one package-manager lockfile detected."
  fi
  if [[ -d "$ROOT_DIR/node_modules" ]]; then
    success "node_modules exists."
  else
    warn "node_modules is missing; dependency tree cannot be inspected locally."
  fi
  if (( npm_lock )); then
    if ! has npm; then
      warn "npm is unavailable; npm audit skipped."
    else
      log "Running read-only npm audit..."
      if npm --prefix "$ROOT_DIR" audit --omit=dev --audit-level=high; then
        success "Production dependency audit passed."
      else
        error "npm production dependency audit reported issues or failed."
      fi
    fi
  else
    warn "npm audit skipped because an npm lockfile was not found."
  fi
  if [[ -f "$ROOT_DIR/package.json" ]]; then
    node - "$ROOT_DIR/package.json" <<'NODE'
'use strict';
const fs = require('node:fs');
try {
  const pkg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const deps = pkg.dependencies || {};
  const devDeps = pkg.devDependencies || {};
  const optionalDeps = pkg.optionalDependencies || {};
  console.log(`Production dependencies declared: ${Object.keys(deps).length}`);
  console.log(`Development dependencies declared: ${Object.keys(devDeps).length}`);
  console.log(`Optional dependencies declared: ${Object.keys(optionalDeps).length}`);
} catch {
  process.exit(1);
}
NODE
  fi
}
# ------------------------------------------------------------
# Secret exposure checks
# ------------------------------------------------------------
audit_secrets() {
  section "Secret exposure audit"
  CHECKS=$((CHECKS + 1))
  if ! has git || ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    warn "Git repository unavailable; tracked-file checks skipped."
    return
  fi
  local file
  local sensitive_found=0
  while IFS= read -r -d '' file; do
    case "$file" in
      .env|.env.local|.env.production|.env.development.local|\
      .env.test.local|.env.production.local|\
      */.env.local|*/.env.production|*/.env.development.local|\
      */.env.test.local|*/.env.production.local|\
      *.pem|*.key|id_rsa|id_ed25519|\
      *service-account*.json|*credentials*.json)
        warn "Potential sensitive file is tracked: $file"
        sensitive_found=1
        ;;
    esac
  done < <(git -C "$ROOT_DIR" ls-files -z)
  if (( sensitive_found )); then
    error "Potentially sensitive files are tracked by Git."
  else
    success "No common sensitive filenames detected in tracked files."
  fi
  # Inspect filenames only, never .env contents.
  if [[ -f "$ROOT_DIR/.env" ]]; then
    log "Root .env exists; contents intentionally not inspected."
  fi
  if [[ -f "$ROOT_DIR/.gitignore" ]]; then
    if grep -Eq '(^|/)\.env(\*|/|$)' "$ROOT_DIR/.gitignore" ||
       grep -Eq '(^|/)\.env\.\*' "$ROOT_DIR/.gitignore"; then
      success ".gitignore has a common environment-file ignore pattern."
    else
      warn "Review .gitignore to ensure real environment files are excluded."
    fi
  else
    warn ".gitignore is missing."
  fi
  log "This check does not scan Git history or prove that secrets are absent."
}
# ------------------------------------------------------------
# Git audit
# ------------------------------------------------------------
audit_git() {
  section "Git repository audit"
  CHECKS=$((CHECKS + 1))
  if ! has git; then
    warn "Git is unavailable."
    return
  fi
  if ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    warn "Repository root is not inside a Git work tree."
    return
  fi
  log "Current branch and working tree:"
  git -C "$ROOT_DIR" status --short --branch
  if git -C "$ROOT_DIR" diff --check; then
    success "Tracked-file whitespace check passed."
  else
    error "Tracked-file whitespace issues detected."
  fi
  if ! git -C "$ROOT_DIR" diff --quiet --; then
    warn "Unstaged tracked changes exist."
  fi
  if ! git -C "$ROOT_DIR" diff --cached --quiet --; then
    warn "Staged changes exist."
  fi
  log "Remote names:"
  git -C "$ROOT_DIR" remote 2>/dev/null || true
  log "Remote URLs are not displayed to avoid accidental credential exposure."
}
# ------------------------------------------------------------
# API and schema audit
# ------------------------------------------------------------
audit_api() {
  section "API and JSON schema audit"
  CHECKS=$((CHECKS + 1))
  require_node || return
  local schema_count=0
  local invalid_count=0
  local route_count=0
  while IFS= read -r -d '' file; do
    schema_count=$((schema_count + 1))
    if node - "$file" <<'NODE'
'use strict';
const fs = require('node:fs');
try {
  const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Expected a JSON object');
  }
  if (data.$schema !== undefined && typeof data.$schema !== 'string') {
    throw new Error('$schema must be a string');
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
NODE
    then
      success "Valid JSON: ${file#"$ROOT_DIR"/}"
    else
      error "Invalid JSON: ${file#"$ROOT_DIR"/}"
      invalid_count=$((invalid_count + 1))
    fi
  done < <(
    find "$ROOT_DIR" \
      \( -type d \( \
        -name .git -o \
        -name node_modules -o \
        -name coverage -o \
        -name dist -o \
        -name build -o \
        -name vendor \
      \) -prune \) -o \
      \( -type f \( \
        -iname '*.schema.json' -o \
        -iname '*.shema.json' -o \
        -iname 'openapi.json' -o \
        -iname 'swagger.json' \
      \) -print0 \)
  )
  log "Recognized schema files: $schema_count"
  if (( invalid_count > 0 )); then
    error "$invalid_count schema/configuration JSON file(s) are invalid."
  elif (( schema_count > 0 )); then
    success "All recognized schema/configuration JSON files parsed successfully."
  else
    warn "No recognized JSON schema or OpenAPI files found."
  fi
  while IFS= read -r -d '' file; do
    route_count=$((route_count + 1))
    log "Route/controller candidate: ${file#"$ROOT_DIR"/}"
  done < <(
    find "$ROOT_DIR" \
      \( -type d \( \
        -name .git -o \
        -name node_modules -o \
        -name coverage -o \
        -name dist -o \
        -name build -o \
        -name vendor \
      \) -prune \) -o \
      \( -type f \( \
        -iname '*route*.js' -o \
        -iname '*routes*.js' -o \
        -iname '*controller*.js' -o \
        -iname '*route*.cjs' -o \
        -iname '*route*.mjs' \
      \) -print0 \)
  )
  log "Route/controller candidate files: $route_count"
  log "Static inspection cannot confirm route reachability or authorization."
}
# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------
print_summary() {
  section "Audit summary"
  log "Checks run: $CHECKS"
  log "Errors: $ERRORS"
  log "Warnings: $WARNINGS"
  if ((${#WARNING_MESSAGES[@]} > 0)); then
    printf '\nWarnings recorded:\n'
    local message
    for message in "${WARNING_MESSAGES[@]}"; do
      printf '  - %s\n' "$message"
    done
  fi
  if (( ERRORS > 0 )); then
    error "Audit completed with errors."
    return 1
  fi
  if (( WARNINGS > 0 )); then
    if [[ "$STRICT" == "1" ]]; then
      error "Strict mode is enabled and warnings were reported."
      return 1
    fi
    warn "Audit completed with warnings. Review before release."
    return 0
  fi
  success "No issues were reported by the selected checks."
}
main() {
  case "$COMMAND" in
    help|-h|--help)
      help
      return 0
      ;;
    config)
      audit_config
      ;;
    dependencies)
      audit_dependencies
      ;;
    secrets)
      audit_secrets
      ;;
    git)
      audit_git
      ;;
    api)
      audit_api
      ;;
    all)
      audit_config
      audit_dependencies
      audit_secrets
      audit_git
      audit_api
      ;;
    *)
      help >&2
      error "Unknown command: $COMMAND"
      return 2
      ;;
  esac
  print_summary
}
main