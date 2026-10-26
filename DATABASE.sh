#!/usr/bin/env bash

============================================================

MedOrbits Database Safety Utility

File: /DATABASE.sh

Purpose:

Inspect database configuration, connectivity and migration

readiness without automatically changing database contents.

Usage:

bash DATABASE.sh help

bash DATABASE.sh check

bash DATABASE.sh status

bash DATABASE.sh config

bash DATABASE.sh migrations

bash DATABASE.sh backup-check

bash DATABASE.sh connect

Supported clients:

PostgreSQL: psql

MySQL:      mysql

Safety:

- Never drops databases, tables or records.

- Never runs automatic migrations.

- Never prints database passwords or connection URLs.

- Never installs database drivers or CLI utilities.

- Never runs Git reset or clean.

- Connectivity checks are read-only.

Configuration:

DATABASE_CLIENT=postgres

DATABASE_URL=…

Or for MySQL:

DATABASE_CLIENT=mysql

DB_HOST=…

DB_PORT=3306

DB_NAME=…

DB_USER=…

DB_PASSWORD=…

Select the configuration matching the actual backend driver.

============================================================

set -Eeuo pipefail
IFS=$’\n\t’
umask 077

readonly SCRIPT_NAME="MedOrbits Database Safety Utility"
readonly SCRIPT_DIR="$(
cd – "$(dirname – "${BASH_SOURCE[0]}")" && pwd -P
)"
readonly ROOT_DIR="$SCRIPT_DIR"

COMMAND="${1:-help}"

log() {
printf ‘[INFO] %s\n’ "$*"
}

warn() {
printf ‘[WARN] %s\n’ "$*" >&2
}

error() {
printf ‘[ERROR] %s\n’ "$*" >&2
}

die() {
error "$*"
exit 1
}

section() {
printf ‘\n%s\n’ ‘============================================================’
printf ‘%s\n’ "$*"
printf ‘%s\n\n’ ‘============================================================’
}

has_command() {
command -v "$1" >/dev/null 2>&1
}

show_help() {
cat <<‘HELP’
MedOrbits Database Safety Utility

Usage:
bash DATABASE.sh 

Commands:
help           Show this help message.
check          Check database configuration and available tools.
config         Display sanitized database configuration status.
status         Run configuration checks and report readiness.
migrations     Inspect common migration directories.
backup-check   Check whether documented backup locations exist.
connect        Run a read-only database connectivity check.

Environment:
DATABASE_CLIENT=postgres|postgresql|mysql
DATABASE_URL=…                  PostgreSQL connection URL
DB_HOST=…                       MySQL host
DB_PORT=3306                      MySQL port
DB_NAME=…                       MySQL database name
DB_USER=…                       MySQL user
DB_PASSWORD=…                   MySQL password
DATABASE_SSL=true|false           PostgreSQL SSL setting

The script loads a root .env file if present. It does not overwrite
existing shell environment variables and does not print secret values.

No database migrations, destructive SQL, or package installations
are performed.
HELP
}

load_env_file() {
local env_file="$ROOT_DIR/.env"

if [[ ! -f "$env_file" ]]; then
log "Root .env not found; using the current shell environment."
return 0
fi

if [[ ! -r "$env_file" ]]; then
warn "Root .env exists but is not readable."
return 0
fi

Parse only simple KEY=value entries. Do not execute .env as shell code.

local line key value

while IFS= read -r line || [[ -n "$line" ]]; do
line="${line%$’\r’}"

[[ "$line" =~ ^[[:space:]]*# ]] && continue
[[ "$line" =~ ^[[:space:]]*$ ]] && continue
if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
  key="${BASH_REMATCH[1]}"
  value="${BASH_REMATCH[2]}"
  # Do not replace environment values already supplied by the shell.
  if [[ -v "$key" ]]; then
    continue
  fi
  # Remove surrounding whitespace.
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  # Remove matching surrounding quotes. This is intentionally not
  # a complete dotenv parser; complex values should be exported
  # through the shell or loaded by the application's dotenv library.
  if [[ ${#value} -ge 2 ]]; then
    if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
      value="${value:1:${#value}-2}"
    fi
  fi
  export "$key=$value"
fi

done < "$env_file"

log "Read simple environment entries from root .env where not already set."
}

detect_client() {
if [[ -n "${DATABASE_CLIENT:-}" ]]; then
case "${DATABASE_CLIENT,,}" in
postgres|postgresql|pg)
printf ‘postgres’
;;
mysql|mariadb)
printf ‘mysql’
;;
*)
die "Unsupported DATABASE_CLIENT. Use postgres or mysql."
;;
esac
return
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
case "${DATABASE_URL%%:*}" in
postgres|postgresql)
printf ‘postgres’
return
;;
mysql|mariadb)
printf ‘mysql’
return
;;
esac
fi

if [[ -n "${DB_HOST:-}" || -n "${DB_NAME:-}" || -n "${DB_USER:-}" ]]; then
printf ‘mysql’
return
fi

printf ‘unknown’
}

check_database_config() {
section "Database configuration"

local client
client="$(detect_client)"

log "Detected database client: $client"

case "$client" in
postgres)
if [[ -n "${DATABASE_URL:-}" ]]; then
log "DATABASE_URL: configured (value hidden)"
else
warn "DATABASE_URL is not configured."
fi

  if [[ -n "${DATABASE_SSL:-}" ]]; then
    log "DATABASE_SSL: configured (value hidden)"
  else
    log "DATABASE_SSL: not explicitly set"
  fi
  if has_command psql; then
    log "PostgreSQL CLI: available"
  else
    warn "psql is unavailable."
  fi
  ;;
mysql)
  [[ -n "${DB_HOST:-}" ]] \
    && log "DB_HOST: configured" \
    || warn "DB_HOST is not configured."
  [[ -n "${DB_NAME:-}" ]] \
    && log "DB_NAME: configured (value hidden)" \
    || warn "DB_NAME is not configured."
  [[ -n "${DB_USER:-}" ]] \
    && log "DB_USER: configured (value hidden)" \
    || warn "DB_USER is not configured."
  [[ -n "${DB_PASSWORD:-}" ]] \
    && log "DB_PASSWORD: configured (value hidden)" \
    || warn "DB_PASSWORD is not configured."
  log "DB_PORT: ${DB_PORT:-3306}"
  if has_command mysql; then
    log "MySQL CLI: available"
  else
    warn "mysql CLI is unavailable."
  fi
  ;;
unknown)
  warn "Database client could not be determined."
  warn "Set DATABASE_CLIENT explicitly to postgres or mysql."
  ;;

esac
}

check_backend_driver() {
section "Backend database driver"

local package_file="$ROOT_DIR/package.json"

if [[ ! -f "$package_file" ]]; then
warn "package.json not found; cannot inspect Node.js dependencies."
return 0
fi

if ! has_command node; then
warn "Node.js is unavailable; cannot inspect package dependencies."
return 0
fi

node - "$package_file" <<‘NODE’
const fs = require("node:fs");

const packageFile = process.argv[2];

try {
const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"));
const dependencies = {
…(pkg.dependencies || {}),
…(pkg.devDependencies || {})
};

const hasPg = Boolean(dependencies.pg);
const hasMysql = Boolean(dependencies.mysql);
const hasMysql2 = Boolean(dependencies.mysql2);
const hasPrisma = Boolean(dependencies["@prisma/client"]);
const hasSequelize = Boolean(dependencies.sequelize);
const hasKnex = Boolean(dependencies.knex);

console.log(pg dependency: ${hasPg ? "present" : "not declared"});
console.log(mysql dependency: ${hasMysql ? "present" : "not declared"});
console.log(mysql2 dependency: ${hasMysql2 ? "present" : "not declared"});
console.log(Prisma dependency: ${hasPrisma ? "present" : "not declared"});
console.log(Sequelize dependency: ${hasSequelize ? "present" : "not declared"});
console.log(Knex dependency: ${hasKnex ? "present" : "not declared"});

if (hasPg && (hasMysql || hasMysql2)) {
console.log(
"NOTICE: Both PostgreSQL and MySQL drivers are declared. " +
"Inspect actual database initialization code."
);
}
} catch (error) {
console.error(Cannot inspect package.json: ${error.message});
process.exitCode = 1;
}
NODE
}

inspect_migrations() {
section "Migration file inspection"

local found=0
local directory

for directory in 
"$ROOT_DIR/migrations" 
"$ROOT_DIR/db/migrations" 
"$ROOT_DIR/database/migrations" 
"$ROOT_DIR/prisma/migrations"
do
if [[ -d "$directory" ]]; then
found=1
log "Found migration directory: ${directory#"$ROOT_DIR"/}"

  find "$directory" -maxdepth 3 -type f \
    \( -name '*.sql' -o -name '*.js' -o -name '*.cjs' \
       -o -name '*.mjs' -o -name '*.ts' \) \
    -print
fi

done

if ((found == 0)); then
warn "No common migration directory found."
warn "This does not prove that the project has no migrations."
fi

log "Migration inspection is read-only; no migration was executed."
}

inspect_backup_locations() {
section "Backup location inspection"

local found=0
local directory

for directory in 
"$ROOT_DIR/backups" 
"$ROOT_DIR/backup" 
"$ROOT_DIR/.backups"
do
if [[ -d "$directory" ]]; then
found=1
log "Backup directory exists: ${directory#"$ROOT_DIR"/}"
fi
done

if ((found == 0)); then
warn "No conventional repository backup directory found."
fi

warn "Directory presence does not verify backup integrity or recoverability."
log "No backup was created, modified or deleted."
}

check_postgres_connection() {
require_command psql

[[ -n "${DATABASE_URL:-}" ]] ||
die "DATABASE_URL is required for PostgreSQL connectivity checks."

log "Running a read-only PostgreSQL connectivity query."

Avoid echoing credentials. psql receives the URL through the environment.

PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-5}" 
psql "$DATABASE_URL" 
-X 
-w 
-v ON_ERROR_STOP=1 
-t 
-A 
-c ‘SELECT current_database(), current_user, current_setting(’'‘server_version’'’);’
}

check_mysql_connection() {
require_command mysql

[[ -n "${DB_HOST:-}" ]] || die "DB_HOST is required."
[[ -n "${DB_NAME:-}" ]] || die "DB_NAME is required."
[[ -n "${DB_USER:-}" ]] || die "DB_USER is required."

local port="${DB_PORT:-3306}"

[[ "$port" =~ ^[0-9]+$ ]] ||
die "DB_PORT must be a numeric port."

((port >= 1 && port <= 65535)) ||
die "DB_PORT must be between 1 and 65535."

log "Running a read-only MySQL connectivity query."

MYSQL_PWD avoids placing the password directly in command-line arguments.

The environment variable is scoped to this process only.

MYSQL_PWD="${DB_PASSWORD:-}" 
mysql 
–connect-timeout=5 
–protocol=tcp 
–host="$DB_HOST" 
–port="$port" 
–user="$DB_USER" 
–database="$DB_NAME" 
–batch 
–skip-column-names 
–execute=‘SELECT DATABASE(), CURRENT_USER(), VERSION();’
}

check_connection() {
section "Read-only database connectivity"

local client
client="$(detect_client)"

case "$client" in
postgres)
check_postgres_connection
;;
mysql)
check_mysql_connection
;;
*)
die "Database client is unknown. Configure DATABASE_CLIENT first."
;;
esac

log "Connectivity query completed."
}

main() {
section "$SCRIPT_NAME"
log "Repository: $ROOT_DIR"

load_env_file

case "$COMMAND" in
help|-h|–help)
show_help
;;
config)
check_database_config
;;
check)
check_database_config
check_backend_driver
;;
status)
check_database_config
check_backend_driver
inspect_migrations
;;
migrations)
inspect_migrations
;;
backup-check)
inspect_backup_locations
;;
connect)
check_connection
;;
*)
show_help >&2
die "Unknown command: $COMMAND"
;;
esac
}

main "$@"