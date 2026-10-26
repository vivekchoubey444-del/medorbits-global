#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# MedOrbits -- MySQL Restore Utility
#
# Path: infrastructure/backup/restore-mysql.sh
#
# Restores a compressed SQL dump into an explicitly specified, existing
# target database. This script does not create or drop databases and does
# not select a target database based on the backup filename.
#
# WARNING:
# SQL statements in the dump execute with the privileges of the MySQL
# account. A dump may contain destructive statements or change database
# objects. Prefer an isolated, disposable database for restore drills.

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

die() {
  log "ERROR: $*" >&2
  exit 1
}

usage() {
  cat >&2 <<'USAGE'
Usage:
  infrastructure/backup/restore-mysql.sh /path/to/backup.sql.gz TARGET_DATABASE

Required environment variables:
  MYSQL_HOST
  MYSQL_USER

Optional environment variables:
  MYSQL_PORT    MySQL port (default: 3306)
  MYSQL_CNF     Path to a protected MySQL client option file
USAGE
  exit 2
}

if [[ $# -ne 2 ]]; then
  usage
fi

backup_file="$1"
target_database="$2"

: "${MYSQL_HOST:?Set MYSQL_HOST}"
: "${MYSQL_USER:?Set MYSQL_USER}"

MYSQL_PORT="${MYSQL_PORT:-3306}"

# Validate the port.
[[ "$MYSQL_PORT" =~ ^[0-9]+$ ]] ||
  die "MYSQL_PORT must be numeric."

(( 10#$MYSQL_PORT >= 1 && 10#$MYSQL_PORT <= 65535 )) ||
  die "MYSQL_PORT must be between 1 and 65535."

# Conservative database identifier validation.
# Only ASCII letters, digits and underscores are accepted.
# MySQL database-name limits can vary by version and platform.
[[ "$target_database" =~ ^[A-Za-z0-9_]{1,64}$ ]] ||
  die "Invalid target database name. Use 1–64 ASCII letters, digits or underscores."

# Validate backup file.
[[ -f "$backup_file" && -r "$backup_file" ]] ||
  die "Backup file does not exist, is not a regular file, or is not readable."

# Required tools.
for cmd in mysql gzip date; do
  command -v "$cmd" >/dev/null 2>&1 ||
    die "Required command not found: $cmd"
done

# Validate optional client configuration before doing anything destructive.
mysql_defaults=()

if [[ -n "${MYSQL_CNF:-}" ]]; then
  [[ -f "$MYSQL_CNF" && -r "$MYSQL_CNF" ]] ||
    die "MYSQL_CNF must reference a readable regular file."

  # GNU stat syntax; this script targets typical Linux deployment environments.
  cnf_mode="$(stat -c '%a' "$MYSQL_CNF")" ||
    die "Could not inspect MYSQL_CNF permissions."

  # Reject group/world-readable or group/world-writable option files.
  # Expected permissions are typically 600.
  if (( (8#$cnf_mode & 077) != 0 )); then
    die "MYSQL_CNF permissions are too broad. Run: chmod 600 \"$MYSQL_CNF\""
  fi

  # MySQL requires --defaults-extra-file to appear before other options.
  mysql_defaults+=("--defaults-extra-file=$MYSQL_CNF")
fi

log "Preparing MySQL restore."
log "Host: ${MYSQL_HOST}:${MYSQL_PORT}"
log "Target database: ${target_database}"
log "Backup file: ${backup_file}"

echo
echo "WARNING: SQL statements in this backup will execute against the target database."
echo "The dump may contain destructive SQL or alter database objects."
echo "Use a disposable, isolated database for restore drills."
echo "This utility does not guarantee that the dump is safe or transactional."
echo

if [[ ! -t 0 ]]; then
  die "Interactive confirmation requires a terminal. Run this utility manually in an interactive session."
fi

read -r -p "Type the target database name to continue: " confirmation

[[ "$confirmation" == "$target_database" ]] ||
  die "Confirmation did not match; restore aborted."

log "Verifying compressed archive."

gzip -t -- "$backup_file" ||
  die "Backup archive failed gzip integrity verification."

log "Starting restore import."

# Credentials should be supplied by a protected MySQL option file or an
# approved secret-management mechanism. Never embed passwords in this
# script or pass them as command-line arguments.
#
# Example protected option file:
#   [client]
#   user=restore_user
#   password=REPLACE_WITH_SECRET
#
# Protect it with:
#   chmod 600 /path/to/mysql-client.cnf
#
# Configure MYSQL_CNF in the deployment environment when using this method.
# If MYSQL_CNF is unset, the MySQL client's configured credential mechanism
# must provide authentication without prompting or exposing secrets.

if ! set -o pipefail; then
  die "Could not enable pipeline failure detection."
fi

if ! gzip -dc -- "$backup_file" |
  mysql \
    "${mysql_defaults[@]}" \
    --host="$MYSQL_HOST" \
    --port="$MYSQL_PORT" \
    --user="$MYSQL_USER" \
    --default-character-set=utf8mb4 \
    --database="$target_database"; then
  die "Restore import failed. The target database may be partially modified; inspect it before retrying."
fi

log "Restore import completed."
log "Run schema, row-count, relationship, and application integrity checks."
log "Follow infrastructure/backup/restore-drill.md if available."