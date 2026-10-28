#!/usr/bin/env bash
# ============================================================
# MedOrbits Database Safety Utility
# File: DATABASE.sh
#
# Read-only database configuration and connectivity checks.
# Does not run migrations, write records, install packages, or
# display secret values. Reads configuration from the environment.
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
COMMAND="${1:-help}"

log()  { printf '[INFO] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*" >&2; }
fail() { printf '[FAIL] %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'HELP'
MedOrbits Database Safety Utility

Usage: bash DATABASE.sh [COMMAND]

Commands:
  help          Show this help message
  check         Check configuration and database client availability
  config        Show sanitized configuration status
  status        Run non-connecting configuration checks
  migrations    List likely migration directories (read-only)
  backup-check  Check whether common database backup tools exist
  connect       Attempt a read-only SELECT 1 connection test

Configuration is read from the current shell environment. This script
never prints database passwords or complete connection URLs and never
runs migrations or destructive SQL.
HELP
}

has_command() { command -v "$1" >/dev/null 2>&1; }

selected_client() {
  printf '%s' "${DATABASE_CLIENT:-postgres}" | tr '[:upper:]' '[:lower:]'
}

config_status() {
  local client url_present host_present name_present user_present
  client="$(selected_client)"
  [[ -n "${DATABASE_URL:-}" ]] && url_present=yes || url_present=no
  [[ -n "${DB_HOST:-}" ]] && host_present=yes || host_present=no
  [[ -n "${DB_NAME:-}" ]] && name_present=yes || name_present=no
  [[ -n "${DB_USER:-}" ]] && user_present=yes || user_present=no

  printf 'Repository: %s\n' "$SCRIPT_DIR"
  printf 'Client: %s\n' "$client"
  printf 'DATABASE_URL present: %s\n' "$url_present"
  printf 'DB_HOST present: %s\n' "$host_present"
  printf 'DB_NAME present: %s\n' "$name_present"
  printf 'DB_USER present: %s\n' "$user_present"
  printf 'DB_PASSWORD present: %s\n' "$([[ -n "${DB_PASSWORD:-}" ]] && printf yes || printf no)"
}

check_config() {
  local client
  client="$(selected_client)"
  case "$client" in
    postgres|postgresql|pg)
      if has_command psql; then log "PostgreSQL client available: $(psql --version | head -n 1)";
      else warn "psql is not installed; connection testing is unavailable."; fi
      ;;
    mysql|mariadb)
      if has_command mysql; then log "MySQL client available: $(mysql --version | head -n 1)";
      else warn "mysql client is not installed; connection testing is unavailable."; fi
      ;;
    *) fail "Unsupported DATABASE_CLIENT value: $client" ;;
  esac

  if [[ -z "${DATABASE_URL:-}" && ( -z "${DB_HOST:-}" || -z "${DB_NAME:-}" || -z "${DB_USER:-}" ) ]]; then
    warn "Set DATABASE_URL or DB_HOST, DB_NAME and DB_USER in the environment."
  else
    log "Required connection fields appear to be configured."
  fi
}

inspect_migrations() {
  local found=0 directory
  for directory in \
    "$SCRIPT_DIR/migrations" \
    "$SCRIPT_DIR/db/migrations" \
    "$SCRIPT_DIR/database/migrations" \
    "$SCRIPT_DIR/prisma/migrations"; do
    if [[ -d "$directory" ]]; then
      found=1
      log "Migration directory found: ${directory#"$SCRIPT_DIR"/}"
      find "$directory" -maxdepth 3 -type f -print 2>/dev/null | head -n 50
    fi
  done
  (( found )) || log "No conventional migration directory found."
}

backup_check() {
  local found=0 tool
  for tool in pg_dump mysqldump; do
    if has_command "$tool"; then log "Available: $tool"; found=1; fi
  done
  (( found )) || warn "Neither pg_dump nor mysqldump is available."
}

connect_read_only() {
  local client
  client="$(selected_client)"
  case "$client" in
    postgres|postgresql|pg)
      has_command psql || fail "psql is required for this connection test."
      if [[ -n "${DATABASE_URL:-}" ]]; then
        psql -X -w "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT 1;' >/dev/null
      else
        [[ -n "${DB_HOST:-}" && -n "${DB_NAME:-}" && -n "${DB_USER:-}" ]] || fail "Set DATABASE_URL or DB_HOST, DB_NAME and DB_USER."
        PGPASSWORD="${DB_PASSWORD:-}" psql -X -w -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c 'SELECT 1;' >/dev/null
      fi
      ;;
    mysql|mariadb)
      has_command mysql || fail "mysql client is required for this connection test."
      if [[ -n "${DATABASE_URL:-}" ]]; then
        warn "MySQL URL parsing is intentionally not implemented; use DB_HOST/DB_NAME/DB_USER instead."
        fail "Set DB_HOST, DB_NAME and DB_USER for MySQL connection testing."
      fi
      [[ -n "${DB_HOST:-}" && -n "${DB_NAME:-}" && -n "${DB_USER:-}" ]] || fail "Set DB_HOST, DB_NAME and DB_USER."
      MYSQL_PWD="${DB_PASSWORD:-}" mysql --connect-timeout=5 -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" "$DB_NAME" -Nse 'SELECT 1;' >/dev/null
      ;;
  esac
  log "Read-only SELECT 1 connection test succeeded."
}

case "$COMMAND" in
  help|-h|--help) usage ;;
  check) config_status; check_config ;;
  config) config_status ;;
  status) config_status; check_config ;;
  migrations) inspect_migrations ;;
  backup-check) backup_check ;;
  connect) connect_read_only ;;
  *) fail "Unknown command: $COMMAND. Run 'bash DATABASE.sh help'." ;;
esac
