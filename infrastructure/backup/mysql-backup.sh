
#!/usr/bin/env bash
# ============================================================
# MedOrbits MySQL Restore Utility
# File: infrastructure/backup/restore-mysql.sh
#
# Purpose:
#   Validate and optionally restore a MySQL/MariaDB SQL backup.
#
# Commands:
#   --check FILE       Validate backup readability and SQL markers
#   --execute FILE     Restore after explicit confirmation
#   --help             Display usage
#
# Safety:
#   - Defaults to non-destructive validation.
#   - Never drops or recreates a database.
#   - Never runs DROP DATABASE or CREATE DATABASE.
#   - Requires explicit --execute for database imports.
#   - Requires confirmation of the target database.
#   - Rejects compressed/encrypted files unless decompressed first.
#   - Does not print database passwords.
#   - Does not change application source files.
#
# Requirements:
#   Bash 4+, mysql client, optionally gzip and sha256sum.
#
# Configuration via environment:
#   MYSQL_HOST       Default: 127.0.0.1
#   MYSQL_PORT       Default: 3306
#   MYSQL_USER       Required for restore
#   MYSQL_DATABASE   Required for restore
#   MYSQL_PWD        Optional; avoid shell history or command-line secrets
#
# Usage:
#   ./infrastructure/backup/restore-mysql.sh --check backup.sql
#   ./infrastructure/backup/restore-mysql.sh --execute backup.sql
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
readonly SCRIPT_NAME="restore-mysql.sh"
MODE="check"
BACKUP_FILE=""
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-}"
MYSQL_DATABASE="${MYSQL_DATABASE:-}"
CONFIRM_DATABASE=""
ALLOW_DEFINER=0
log() {
    printf '[MYSQL-RESTORE] %s\n' "$*"
}
warn() {
    printf '[WARN] %s\n' "$*" >&2
}
die() {
    printf '[ERROR] %s\n' "$*" >&2
    exit 1
}
usage() {
    cat <<'USAGE'
MedOrbits MySQL Restore Utility
Usage:
  restore-mysql.sh --check BACKUP.sql
  restore-mysql.sh --execute BACKUP.sql
  restore-mysql.sh --help
Environment variables:
  MYSQL_HOST       MySQL server hostname (default: 127.0.0.1)
  MYSQL_PORT       MySQL server port (default: 3306)
  MYSQL_USER       Database username
  MYSQL_DATABASE   Existing target database
  MYSQL_PWD        Optional client password (use secure secret management)
Modes:
  --check FILE       Validate file readability and inspect SQL safety.
                     Does not connect to the database or import data.
  --execute FILE     Import into the specified existing database.
                     Requires interactive confirmation.
Safety:
  - No database creation, deletion, or replacement.
  - SQL is imported into an existing database only.
  - The script refuses obvious DROP DATABASE and CREATE DATABASE
    statements in the backup.
  - SQL routines, triggers, views, and DEFINER clauses may require
    extra privileges or manual review.
  - A restore can overwrite tables and data inside the target database.
  - Always back up the target database before importing.
USAGE
}
parse_args() {
    (($# > 0)) || {
        usage
        exit 0
    }
    while (($#)); do
        case "$1" in
            --check)
                MODE="check"
                shift
                (($# > 0)) || die "--check requires a backup file."
                BACKUP_FILE="$1"
                shift
                ;;
            --execute)
                MODE="execute"
                shift
                (($# > 0)) || die "--execute requires a backup file."
                BACKUP_FILE="$1"
                shift
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                die "Unknown argument: $1"
                ;;
        esac
    done
}
require_command() {
    command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}
validate_file() {
    [[ -n "$BACKUP_FILE" ]] || die "No backup file supplied."
    [[ -f "$BACKUP_FILE" ]] || die "Backup file does not exist."
    [[ -r "$BACKUP_FILE" ]] || die "Backup file is not readable."
    [[ -s "$BACKUP_FILE" ]] || die "Backup file is empty."
    case "$BACKUP_FILE" in
        *.gz|*.gzip|*.zip|*.7z|*.enc|*.gpg)
            die "Compressed or encrypted backups are not accepted directly. Decompress/decrypt and validate the SQL file first."
            ;;
    esac
    BACKUP_FILE="$(cd -- "$(dirname -- "$BACKUP_FILE")" && pwd -P)/$(basename -- "$BACKUP_FILE")"
    log "Backup file: $BACKUP_FILE"
    log "File size: $(wc -c < "$BACKUP_FILE" | tr -d ' ') bytes"
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum -- "$BACKUP_FILE"
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$BACKUP_FILE"
    fi
}
inspect_sql() {
    log "Inspecting SQL backup..."
    # Reject database-level destructive statements. This is a safety
    # heuristic, not a full SQL parser; manually inspect the backup too.
    if grep -Ein \
        '^[[:space:]]*(DROP[[:space:]]+DATABASE|CREATE[[:space:]]+DATABASE|DROP[[:space:]]+SCHEMA|CREATE[[:space:]]+SCHEMA)\b' \
        "$BACKUP_FILE" >/dev/null 2>&1; then
        die "Backup contains database-level CREATE/DROP statements. Review and sanitize it manually before proceeding."
    fi
    if grep -Ein \
        '^[[:space:]]*USE[[:space:]]+' \
        "$BACKUP_FILE" >/dev/null 2>&1; then
        warn "Backup contains USE statements. These may switch the target database during import."
        if [[ "$MODE" == "execute" ]]; then
            die "Refusing to import a backup containing USE statements."
        fi
    fi
    if grep -Ein \
        '^[[:space:]]*SOURCE[[:space:]]+' \
        "$BACKUP_FILE" >/dev/null 2>&1; then
        die "Backup contains SOURCE directives, which can load additional files."
    fi
    if grep -Ein \
        'DEFINER[[:space:]]*=' \
        "$BACKUP_FILE" >/dev/null 2>&1; then
        warn "Backup includes DEFINER clauses. Review privilege and ownership requirements."
    fi
    if grep -Ein \
        'LOAD_FILE[[:space:]]*\(|INTO[[:space:]]+OUTFILE|INTO[[:space:]]+DUMPFILE' \
        "$BACKUP_FILE" >/dev/null 2>&1; then
        warn "Backup contains file-access SQL constructs. Inspect the SQL before importing."
        if [[ "$MODE" == "execute" ]]; then
            die "Refusing automatic import of a backup with file-access SQL constructs."
        fi
    fi
    if ! grep -Eq \
        '(^|[[:space:]])(CREATE[[:space:]]+TABLE|INSERT[[:space:]]+INTO|CREATE[[:space:]]+VIEW|ALTER[[:space:]]+TABLE|LOCK[[:space:]]+TABLES)' \
        "$BACKUP_FILE"; then
        warn "Common table/data statements were not detected. Confirm this is a valid SQL dump."
    fi
    log "Basic SQL inspection completed."
    log "Note: static inspection cannot prove that a SQL dump is safe or restorable."
}
validate_mysql_settings() {
    [[ -n "$MYSQL_USER" ]] || die "MYSQL_USER is required for execution."
    [[ -n "$MYSQL_DATABASE" ]] || die "MYSQL_DATABASE is required for execution."
    [[ "$MYSQL_PORT" =~ ^[0-9]{1,5}$ ]] ||
        die "MYSQL_PORT must be a numeric TCP port."
    ((MYSQL_PORT >= 1 && MYSQL_PORT <= 65535)) ||
        die "MYSQL_PORT is outside the valid TCP port range."
    [[ "$MYSQL_DATABASE" =~ ^[A-Za-z0-9_$-]+$ ]] ||
        die "MYSQL_DATABASE contains unsupported characters."
    [[ "$MYSQL_USER" != -* ]] ||
        die "MYSQL_USER must not begin with a dash."
    [[ "$MYSQL_HOST" != -* ]] ||
        die "MYSQL_HOST must not begin with a dash."
}
mysql_client() {
    # MYSQL_PWD is inherited by the client when configured, so the
    # password is not embedded in the command-line arguments.
    mysql \
        --protocol=TCP \
        --host="$MYSQL_HOST" \
        --port="$MYSQL_PORT" \
        --user="$MYSQL_USER" \
        --default-character-set=utf8mb4 \
        --batch \
        --skip-column-names \
        "$@"
}
check_connection_and_database() {
    log "Checking MySQL connectivity..."
    if ! mysql_client --execute='SELECT 1' >/dev/null; then
        die "Could not connect to MySQL. Verify credentials, host, port, and server status."
    fi
    local database_exists
    database_exists="$(
        mysql_client --execute="
            SELECT COUNT(*)
            FROM information_schema.SCHEMATA
            WHERE SCHEMA_NAME = '${MYSQL_DATABASE}';
        "
    )"
    [[ "$database_exists" == "1" ]] ||
        die "Target database does not exist. This utility will not create it."
    log "MySQL connection verified."
    log "Target database exists: $MYSQL_DATABASE"
}
confirm_restore() {
    [[ -t 0 ]] ||
        die "Interactive confirmation is required. Run from a terminal."
    printf '\n'
    warn "IMPORTING SQL CAN OVERWRITE TABLES AND DATA IN THE TARGET DATABASE."
    printf 'Server:   %s:%s\n' "$MYSQL_HOST" "$MYSQL_PORT"
    printf 'Database: %s\n' "$MYSQL_DATABASE"
    printf 'Backup:   %s\n' "$BACKUP_FILE"
    printf '\nType the exact database name to authorize import: '
    local answer
    IFS= read -r answer
    [[ "$answer" == "$MYSQL_DATABASE" ]] ||
        die "Database confirmation did not match. Restore cancelled."
}
execute_restore() {
    require_command mysql
    validate_mysql_settings
    check_connection_and_database
    confirm_restore
    log "Starting import into the existing database..."
    warn "Keep this terminal open until the import completes."
    # Explicit database selection; no DROP/CREATE database command is issued.
    # MySQL errors stop the pipeline, and output is not redirected to /dev/null.
    if mysql_client "$MYSQL_DATABASE" < "$BACKUP_FILE"; then
        log "SQL import completed successfully."
        log "Perform application-level verification before resuming service."
    else
        die "Import failed. The database may be partially restored; inspect logs and recover from a verified pre-restore backup."
    fi
}
main() {
    parse_args "$@"
    require_command grep
    require_command wc
    validate_file
    inspect_sql
    if [[ "$MODE" == "check" ]]; then
        log "Validation mode only. No database connection or import was attempted."
        exit 0
    fi
    execute_restore
}
main "$@"