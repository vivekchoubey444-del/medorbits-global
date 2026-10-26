#!/usr/bin/env bash
# ============================================================
# MEDORBITS -- SAFE API CHECKER
# File: /API-CHECK.sh
#
# Purpose:
#   Inspect API configuration and optionally test live endpoints.
#
# Usage:
#   bash API-CHECK.sh
#   bash API-CHECK.sh check
#   bash API-CHECK.sh routes
#   bash API-CHECK.sh schemas
#   bash API-CHECK.sh health
#   bash API-CHECK.sh live
#   bash API-CHECK.sh all
#   bash API-CHECK.sh help
#
# Optional environment:
#   API_BASE_URL=http://127.0.0.1:3000
#   API_HEALTH_PATH=/health
#   API_PREFIX=/api/v1
#   API_TIMEOUT=8
#
# Safety:
#   - Read-only checks.
#   - No automatic dependency installation.
#   - No database migrations or writes.
#   - No automatic deployment.
#   - No destructive Git operations.
#   - Never prints environment-variable values or secrets.
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
readonly SCRIPT_DIR="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &&
    pwd -P
)"
readonly ROOT_DIR="$SCRIPT_DIR"
COMMAND="${1:-all}"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:3000}"
API_HEALTH_PATH="${API_HEALTH_PATH:-/health}"
API_PREFIX="${API_PREFIX:-/api/v1}"
API_TIMEOUT="${API_TIMEOUT:-8}"
ERRORS=0
WARNINGS=0
CHECKS=0
log() {
  printf '[API-CHECK] %s\n' "$*"
}
success() {
  printf '[OK] %s\n' "$*"
}
warn() {
  printf '[WARN] %s\n' "$*" >&2
  WARNINGS=$((WARNINGS + 1))
}
error() {
  printf '[ERROR] %s\n' "$*" >&2
  ERRORS=$((ERRORS + 1))
}
section() {
  printf '\n%s\n' '============================================================'
  printf '%s\n' "$*"
  printf '%s\n\n' '============================================================'
}
has_command() {
  command -v "$1" >/dev/null 2>&1
}
usage() {
  cat <<'HELP'
MedOrbits Safe API Checker
Usage:
  bash API-CHECK.sh [command]
Commands:
  check    Check project/API configuration.
  routes   Inspect API route files and route registrations.
  schemas  Parse JSON schema files.
  health   Check API health endpoint.
  live     Check health and API base endpoint over HTTP.
  all      Run all checks (default).
  help     Show this help.
Environment variables:
  API_BASE_URL       Base URL, default http://127.0.0.1:3000
  API_HEALTH_PATH    Health path, default /health
  API_PREFIX         API prefix, default /api/v1
  API_TIMEOUT        HTTP timeout in seconds, default 8
Examples:
  bash API-CHECK.sh check
  bash API-CHECK.sh schemas
  bash API-CHECK.sh health
  API_BASE_URL=http://127.0.0.1:3000 bash API-CHECK.sh live
Safety:
  HTTP checks use GET requests only.
  This script does not create, update, or delete API resources.
  Route inspection is heuristic, not a substitute for integration tests.
HELP
}
validate_settings() {
  if ! has_command node; then
    error "Node.js is required for project and JSON checks."
    return 1
  fi
  if ! [[ "$API_TIMEOUT" =~ ^[1-9][0-9]*$ ]]; then
    error "API_TIMEOUT must be a positive integer."
    return 1
  fi
  if ! [[ "$API_BASE_URL" =~ ^https?://[^[:space:]]+$ ]]; then
    error "API_BASE_URL must be an HTTP or HTTPS URL."
    return 1
  fi
  if [[ "$API_HEALTH_PATH" != /* ]]; then
    error "API_HEALTH_PATH must begin with /."
    return 1
  fi
  if [[ "$API_PREFIX" != /* ]]; then
    error "API_PREFIX must begin with /."
    return 1
  fi
  success "Configuration values have valid basic formats."
}
check_project() {
  section "Project configuration"
  local package_file="$ROOT_DIR/package.json"
  if [[ ! -f "$package_file" ]]; then
    warn "package.json not found at repository root."
  elif node - "$package_file" <<'NODE'
'use strict';
const fs = require('node:fs');
try {
  const pkg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
    throw new Error('Expected a JSON object');
  }
  console.log(`Package: ${pkg.name || '(unnamed)'}`);
  console.log(`Version: ${pkg.version || '(not specified)'}`);
  const scripts = pkg.scripts || {};
  console.log(`Start script: ${scripts.start ? 'available' : 'not defined'}`);
  console.log(`Test script: ${scripts.test ? 'available' : 'not defined'}`);
} catch (err) {
  console.error(`Invalid package.json: ${err.message}`);
  process.exit(1);
}
NODE
  then
    success "package.json is valid."
  else
    error "package.json validation failed."
  fi
  if [[ -f "$ROOT_DIR/server.js" ]]; then
    success "server.js found."
  else
    warn "server.js not found at repository root."
  fi
  if [[ -d "$ROOT_DIR/api" ]]; then
    success "api/ directory found."
  else
    warn "api/ directory not found."
  fi
  if [[ -f "$ROOT_DIR/.env" ]]; then
    warn ".env exists. Values were not read or displayed."
  else
    log "No root .env file detected."
  fi
  if [[ -f "$ROOT_DIR/.env.example" ]]; then
    success ".env.example found."
  fi
}
check_routes() {
  section "API route inspection"
  local route_count=0
  while IFS= read -r -d '' file; do
    route_count=$((route_count + 1))
    if [[ "$file" == *.js || "$file" == *.cjs || "$file" == *.mjs ]]; then
      log "Route/controller candidate: ${file#"$ROOT_DIR"/}"
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
        -iname '*route*.js' -o \
        -iname '*routes*.js' -o \
        -iname '*controller*.js' -o \
        -iname '*routes*.cjs' -o \
        -iname '*route*.mjs' \
      \) -print0 \)
  )
  if (( route_count == 0 )); then
    warn "No route/controller candidate files found."
  else
    success "Found $route_count route/controller candidate file(s)."
  fi
  if [[ -f "$ROOT_DIR/server.js" ]]; then
    if grep -nE 'app\.use|router\.use|app\.route' "$ROOT_DIR/server.js" |
      sed -E 's/(process\.env\.[A-Za-z_][A-Za-z0-9_]*|[A-Za-z_][A-Za-z0-9_]*_API_KEY)[[:space:]]*=[^,;]*/\1=[REDACTED]/g'
    then
      :
    else
      warn "No common route-registration patterns found in server.js."
    fi
  fi
  log "Route inspection is heuristic; it does not prove routes are reachable."
}
check_schemas() {
  section "JSON schema validation"
  local schema_count=0
  local invalid_count=0
  while IFS= read -r -d '' file; do
    schema_count=$((schema_count + 1))
    if node - "$file" <<'NODE'
'use strict';
const fs = require('node:fs');
try {
  const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected a JSON object');
  }
  if (
    value.$schema !== undefined &&
    typeof value.$schema !== 'string'
  ) {
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
      error "Invalid JSON schema/configuration: ${file#"$ROOT_DIR"/}"
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
  if (( schema_count == 0 )); then
    warn "No recognized schema/OpenAPI JSON files found."
    return
  fi
  log "Schema files checked: $schema_count"
  log "Invalid schema JSON files: $invalid_count"
  if (( invalid_count > 0 )); then
    error "One or more schema files are invalid."
  fi
}
http_get() {
  local url="$1"
  local label="$2"
  if ! has_command curl; then
    error "curl is required for HTTP checks."
    return 1
  fi
  local status
  if status="$(
    curl \
      --silent \
      --show-error \
      --output /dev/null \
      --write-out '%{http_code}' \
      --connect-timeout "$API_TIMEOUT" \
      --max-time "$API_TIMEOUT" \
      --proto '=http,https' \
      "$url"
  )"; then
    :
  else
    error "$label request failed. Is the server running and reachable?"
    return 1
  fi
  case "$status" in
    2??)
      success "$label returned HTTP $status."
      ;;
    *)
      error "$label returned HTTP $status."
      return 1
      ;;
  esac
}
check_health() {
  section "Health endpoint"
  validate_settings || return 1
  local base="${API_BASE_URL%/}"
  http_get "${base}${API_HEALTH_PATH}" "Health endpoint"
}
check_live() {
  section "Live API checks"
  validate_settings || return 1
  local base="${API_BASE_URL%/}"
  http_get "${base}${API_HEALTH_PATH}" "Health endpoint" || true
  http_get "${base}${API_PREFIX}" "API base endpoint" || true
}
run_all() {
  check_project
  check_routes
  check_schemas
  # Live checks are optional. A local server may not be running.
  if has_command curl; then
    log "Attempting optional local health check."
    check_health || warn "Live health check failed or the server is not running."
  else
    warn "curl unavailable; live health check skipped."
  fi
}
print_summary() {
  section "API check summary"
  log "Errors: $ERRORS"
  log "Warnings: $WARNINGS"
  if (( ERRORS > 0 )); then
    error "API checks completed with errors."
    return 1
  fi
  success "No errors were reported by the selected checks."
}
main() {
  case "$COMMAND" in
    help|-h|--help)
      usage
      return 0
      ;;
    check)
      check_project
      ;;
    routes)
      check_routes
      ;;
    schemas)
      check_schemas
      ;;
    health)
      check_health
      ;;
    live)
      check_live
      ;;
    all)
      run_all
      ;;
    *)
      usage
      error "Unknown command: $COMMAND"
      return 2
      ;;
  esac
  print_summary
}
main