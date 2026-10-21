
#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# MedOrbits -- MySQL Logical Backup
# Path: infrastructure/backup/mysql-backup.sh
#
# Required environment variables:
#   MYSQL_HOST
#   MYSQL_DATABASE
#   MYSQL_USER
#
# Authentication:
#   MYSQL_CNF (recommended protected MySQL option file)
#
# Optional environment variables:
#   MYSQL_PORT=3306
#   BACKUP_DIR=./backups
#   RETENTION_DAYS=14

: "${MYSQL_HOST:?Set MYSQL_HOST}"
: "${MYSQL_DATABASE:?Set MYSQL_DATABASE}"
: "${MYSQL_USER:?Set MYSQL_USER}"

MYSQL_PORT="${MYSQL_PORT:-3306}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

log() {
  printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

die() {
  log "ERROR: $*" >&2
  exit 1
}

for command_name in mysqldump gzip find mktemp date chmod mkdir mv rm tr; do
  command -v "$command_name" >/dev/null 2>&1 ||
    die "Required command not found: $command_name"
done

[[ "$MYSQL_PORT" =~ ^[0-9]+$ ]] ||
  die "MYSQL_PORT must be numeric."

(( MYSQL_PORT >= 1 && MYSQL_PORT <= 65535 )) ||
  die "MYSQL_PORT must be between 1 and 65535."

[[ -n "$MYSQL_DATABASE" ]] ||
  die "MYSQL_DATABASE cannot be empty."

[[ -n "$MYSQL_HOST" && -n "$MYSQL_USER" ]] ||
  die "MYSQL_HOST and MYSQL_USER cannot be empty."

[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] ||
  die "RETENTION_DAYS must be a non-negative integer."

# Restrict the database name used in the filename.
# The original database name is still passed separately to mysqldump.
safe_db="$(printf '%s' "$MYSQL_DATABASE" | tr -cs 'A-Za-z0-9_.-' '_')"
[[ -n "$safe_db" ]] || safe_db="database"

[[ -d "$BACKUP_DIR" || ! -e "$BACKUP_DIR" ]] ||
  die "BACKUP_DIR exists but is not a directory."

mkdir -p -- "$BACKUP_DIR"
chmod 700 -- "$BACKUP_DIR"

BACKUP_DIR="$(cd -- "$BACKUP_DIR" && pwd -P)"

# Use UTC timestamps and refuse to overwrite an existing archive.
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="${BACKUP_DIR}/${safe_db}_${timestamp}.sql.gz"

[[ ! -e "$destination" ]] ||
  die "Destination already exists; refusing to overwrite it."

# Create the temporary file inside BACKUP_DIR to keep publication
# on the same filesystem.
temporary="$(mktemp "${BACKUP_DIR}/.${safe_db}_${timestamp}.XXXXXX.partial")"
chmod 600 -- "$temporary"

cleanup() {
  if [[ -n "${temporary:-}" && -e "$temporary" ]]; then
    rm -f -- "$temporary"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Optional protected MySQL option file.
# It must be readable only by the backup account.
dump_options=()

if [[ -n "${MYSQL_CNF:-}" ]]; then
  [[ -f "$MYSQL_CNF" && -r "$MYSQL_CNF" ]] ||
    die "MYSQL_CNF must point to a readable regular file."

  # Refuse obviously permissive Unix permissions.
  # The option file should normally have mode 600.
  if command -v stat >/dev/null 2>&1; then
    permissions="$(stat -c '%a' -- "$MYSQL_CNF" 2>/dev/null || true)"
    if [[ "$permissions" =~ ^[0-7]+$ ]] &&
      (( (8#$permissions & 077) != 0 )); then
      die "MYSQL_CNF permissions are too broad; restrict access to its owner."
    fi
  fi

  # MySQL requires --defaults-extra-file to appear before other options.
  dump_options+=( "--defaults-extra-file=$MYSQL_CNF" )
fi

log "Starting logical backup."
log "Database host: ${MYSQL_HOST}:${MYSQL_PORT}"
log "Database: ${MYSQL_DATABASE}"
log "Destination: ${destination}"

# Configure credentials through MYSQL_CNF or an approved secret manager.
# Never put passwords directly in this script or in command-line arguments.
#
# MYSQL_CNF should contain a [client] section with the required credentials.
# MYSQL_PWD is intentionally not set by this script.
#
# --single-transaction provides a consistent snapshot for transactional
# tables such as InnoDB. It does not guarantee a consistent snapshot for
# non-transactional tables or protect against incompatible concurrent DDL.

if ! mysqldump \
  "${dump_options[@]}" \
  --host="$MYSQL_HOST" \
  --port="$MYSQL_PORT" \
  --user="$MYSQL_USER" \
  --single-transaction \
  --quick \
  --routines \
  --events \
  --triggers \
  --hex-blob \
  --default-character-set=utf8mb4 \
  "$MYSQL_DATABASE" |
  gzip -c > "$temporary"; then
  die "Database dump or compression failed."
fi

[[ -s "$temporary" ]] ||
  die "Backup archive is empty."

gzip -t -- "$temporary" ||
  die "Backup archive failed gzip integrity verification."

# Publish only after the dump and archive checks succeed.
[[ ! -e "$destination" ]] ||
  die "Destination already exists; refusing to overwrite it."

mv -- "$temporary" "$destination"
temporary=""
chmod 600 -- "$destination"

log "Backup archive created and gzip integrity verified."

# Retention applies only to matching archives directly inside BACKUP_DIR.
# A retention period of 0 intentionally disables automatic cleanup.
if (( RETENTION_DAYS > 0 )); then
  log "Removing backup files older than ${RETENTION_DAYS} days."

  find "$BACKUP_DIR" \
    -maxdepth 1 \
    -type f \
    -name '*.sql.gz' \
    -mtime "+${RETENTION_DAYS}" \
    -print \
    -delete
else
  log "Retention cleanup disabled because RETENTION_DAYS=0."
fi

log "Backup completed successfully: ${destination}"
