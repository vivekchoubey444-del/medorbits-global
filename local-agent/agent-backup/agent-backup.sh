#!/usr/bin/env bash
# ==============================================================================
# MedOrbits Local Agent -- Backup Manager
# File: /local-agent/agent-backup/agent-backup.sh
# Version: 1.0.0
#
# Purpose:
#   Create verified, timestamped backups of the local-agent directory or the
#   complete repository. Supports rotation, integrity checks, and restoration.
#
# Usage:
#   bash local-agent/agent-backup/agent-backup.sh backup
#   bash local-agent/agent-backup/agent-backup.sh backup --full
#   bash local-agent/agent-backup/agent-backup.sh list
#   bash local-agent/agent-backup/agent-backup.sh verify
#   bash local-agent/agent-backup/agent-backup.sh restore ARCHIVE.tar.gz
#   bash local-agent/agent-backup/agent-backup.sh --help
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P
)"
readonly AGENT_DIR="$(
    cd -- "$SCRIPT_DIR/.." && pwd -P
)"

# Repository root can be explicitly configured when auto-detection is wrong.
detect_repo_root() {
    local dir="$AGENT_DIR"

    if [[ -n "${MEDORBITS_REPO_ROOT:-}" ]]; then
        [[ -d "$MEDORBITS_REPO_ROOT" ]] || {
            printf 'ERROR: Repository root does not exist: %s\n' \
                "$MEDORBITS_REPO_ROOT" >&2
            return 1
        }
        cd -- "$MEDORBITS_REPO_ROOT" && pwd -P
        return
    fi

    while [[ "$dir" != "/" ]]; do
        if [[ -d "$dir/.git" || -f "$dir/.git" ]] ||
           [[ -f "$dir/package.json" && -d "$dir/.github" ]]; then
            printf '%s\n' "$dir"
            return
        fi
        dir="$(dirname -- "$dir")"
    done

    # Fall back to the parent of /local-agent.
    printf '%s\n' "$(dirname -- "$AGENT_DIR")"
}

readonly REPO_ROOT="$(detect_repo_root)"
readonly BACKUP_ROOT="${MEDORBITS_BACKUP_DIR:-$AGENT_DIR/backups}"
readonly RETENTION_DAYS="${MEDORBITS_BACKUP_RETENTION_DAYS:-30}"
readonly LOCK_FILE="$SCRIPT_DIR/.agent-backup.lock"

log() {
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

die() {
    log "ERROR: $*"
    exit 1
}

cleanup() {
    rm -f -- "$LOCK_FILE"
}
trap cleanup EXIT

usage() {
    cat <<'EOF'
MedOrbits Local Agent Backup Manager

Commands:
  backup                  Back up /local-agent
  backup --full            Back up the complete repository
  list                     List available backup archives
  verify                   Verify backup checksums and archive integrity
  restore ARCHIVE.tar.gz   Safely extract an archive into a new directory
  help                     Show this help

Environment:
  MEDORBITS_REPO_ROOT               Override repository root
  MEDORBITS_BACKUP_DIR              Override backup storage directory
  MEDORBITS_BACKUP_RETENTION_DAYS   Retention period (default: 30)

Examples:
  bash local-agent/agent-backup/agent-backup.sh backup
  bash local-agent/agent-backup/agent-backup.sh backup --full
  bash local-agent/agent-backup/agent-backup.sh list
  bash local-agent/agent-backup/agent-backup.sh verify
EOF
}

require_commands() {
    local command_name
    for command_name in tar gzip sha256sum find sort date mktemp; do
        command -v "$command_name" >/dev/null 2>&1 ||
            die "Required command is missing: $command_name"
    done
}

validate_configuration() {
    [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] ||
        die "Retention days must be a non-negative integer."

    [[ -d "$REPO_ROOT" ]] ||
        die "Repository root does not exist: $REPO_ROOT"

    mkdir -p -- "$BACKUP_ROOT" ||
        die "Cannot create backup directory: $BACKUP_ROOT"

    BACKUP_ROOT="$(cd -- "$BACKUP_ROOT" && pwd -P)" ||
        die "Cannot resolve backup directory."
}

acquire_lock() {
    if ! (set -o noclobber; printf '%s\n' "$$" > "$LOCK_FILE") 2>/dev/null; then
        die "Another backup process may be running. Check $LOCK_FILE"
    fi
}

make_backup() {
    local full="${1:-false}"
    local source_dir
    local timestamp
    local archive
    local checksum_file
    local temporary_archive
    local relative_source

    if [[ "$full" == "true" ]]; then
        source_dir="$REPO_ROOT"
        relative_source="repository"
    else
        source_dir="$AGENT_DIR"
        relative_source="local-agent"
    fi

    [[ -d "$source_dir" ]] || die "Source directory not found: $source_dir"

    timestamp="$(date '+%Y%m%d-%H%M%S')"
    archive="$BACKUP_ROOT/medorbits-${relative_source}-${timestamp}.tar.gz"
    checksum_file="${archive}.sha256"

    temporary_archive="$(mktemp "$BACKUP_ROOT/.backup-XXXXXXXXXX")" ||
        die "Unable to create temporary archive."

    log "Starting backup."
    log "Source: $source_dir"
    log "Destination: $archive"

    # Exclude generated backups, temporary files, secrets and common caches.
    # This avoids recursive archives and accidental secret disclosure.
    if ! tar -czf "$temporary_archive" \
        -C "$(dirname -- "$source_dir")" \
        --exclude='./.git' \
        --exclude='./node_modules' \
        --exclude='./.venv' \
        --exclude='./venv' \
        --exclude='./__pycache__' \
        --exclude='./.pytest_cache' \
        --exclude='./.mypy_cache' \
        --exclude='./.next' \
        --exclude='./dist' \
        --exclude='./coverage' \
        --exclude='./backups' \
        --exclude='./.env' \
        --exclude='./.env.*' \
        --exclude='*/.env' \
        --exclude='*/.env.*' \
        --exclude='*.pem' \
        --exclude='*.key' \
        --exclude='*.p12' \
        --exclude='*.pfx' \
        "$(basename -- "$source_dir")"; then
        rm -f -- "$temporary_archive"
        die "Backup archive creation failed."
    fi

    gzip -t "$temporary_archive" ||
        {
            rm -f -- "$temporary_archive"
            die "Backup compression verification failed."
        }

    # Publish the archive only after successful creation and verification.
    mv -- "$temporary_archive" "$archive"

    (
        cd -- "$BACKUP_ROOT"
        sha256sum "$(basename -- "$archive")" > "$checksum_file"
    ) || die "Could not write checksum file."

    log "Backup completed successfully."
    log "Archive: $archive"
    log "Checksum: $checksum_file"
    log "Size: $(du -h "$archive" | awk '{print $1}')"

    rotate_backups
}

list_backups() {
    log "Available backup archives:"
    find "$BACKUP_ROOT" -maxdepth 1 -type f \
        -name 'medorbits-*.tar.gz' -print |
        sort |
        while IFS= read -r archive; do
            [[ -n "$archive" ]] || continue
            printf '%s | ' "$(du -h "$archive" | awk '{print $1}')"
            printf '%s\n' "$archive"
        done
}

verify_backups() {
    local archive
    local checksum
    local failures=0
    local found=0

    while IFS= read -r -d '' archive; do
        found=1
        checksum="${archive}.sha256"

        if [[ ! -f "$checksum" ]]; then
            log "FAIL: Missing checksum: $archive"
            failures=$((failures + 1))
            continue
        fi

        if ! (cd -- "$BACKUP_ROOT" &&
              sha256sum --check --status "$(basename -- "$checksum")"); then
            log "FAIL: Checksum mismatch: $archive"
            failures=$((failures + 1))
            continue
        fi

        if ! tar -tzf "$archive" >/dev/null 2>&1; then
            log "FAIL: Archive integrity check failed: $archive"
            failures=$((failures + 1))
            continue
        fi

        log "PASS: $archive"
    done < <(
        find "$BACKUP_ROOT" -maxdepth 1 -type f \
            -name 'medorbits-*.tar.gz' -print0
    )

    if [[ "$found" -eq 0 ]]; then
        log "No backup archives found."
        return 0
    fi

    [[ "$failures" -eq 0 ]] ||
        die "$failures backup verification check(s) failed."

    log "All backup archives passed verification."
}

rotate_backups() {
    [[ "$RETENTION_DAYS" -gt 0 ]] || {
        log "Automatic backup rotation disabled (retention = 0)."
        return 0
    }

    log "Removing backup archives older than $RETENTION_DAYS days."

    find "$BACKUP_ROOT" -maxdepth 1 -type f \
        -name 'medorbits-*.tar.gz' \
        -mtime "+$RETENTION_DAYS" -print0 |
        while IFS= read -r -d '' archive; do
            log "Expiring: $archive"
            rm -f -- "$archive" "${archive}.sha256"
        done
}

restore_backup() {
    local archive="${1:-}"
    local destination
    local resolved_archive
    local member

    [[ -n "$archive" ]] || die "Specify a backup archive to restore."
    [[ -f "$archive" ]] || die "Archive not found: $archive"

    resolved_archive="$(cd -- "$(dirname -- "$archive")" &&
        printf '%s/%s\n' "$(pwd -P)" "$(basename -- "$archive")")"

    gzip -t "$resolved_archive" ||
        die "Archive compression verification failed."

    # Refuse archives with absolute paths or parent-directory traversal.
    while IFS= read -r member; do
        case "$member" in
            /*|..|../*|*/../*|*/..)
                die "Unsafe archive path detected: $member"
                ;;
        esac
    done < <(tar -tzf "$resolved_archive")

    destination="$BACKUP_ROOT/restored-$(date '+%Y%m%d-%H%M%S')"
    mkdir -m 700 -- "$destination" ||
        die "Cannot create restore destination."

    log "Restoring into a separate directory: $destination"

    if ! tar -xzf "$resolved_archive" \
        --no-same-owner \
        --no-same-permissions \
        -C "$destination"; then
        die "Restore failed. Inspect the partial restore at $destination"
    fi

    log "Restore completed. Original repository files were not overwritten."
    log "Review the restored files before copying anything into production."
}

main() {
    local command="${1:-help}"
    shift || true

    require_commands

    # Resolve backup configuration before creating any files.
    validate_configuration

    case "$command" in
        backup)
            local full="false"
            if [[ "${1:-}" == "--full" ]]; then
                full="true"
            elif [[ $# -gt 0 ]]; then
                die "Unknown backup option: $1"
            fi
            acquire_lock
            make_backup "$full"
            ;;
        list)
            list_backups
            ;;
        verify)
            verify_backups
            ;;
        restore)
            [[ $# -eq 1 ]] ||
                die "Usage: $0 restore ARCHIVE.tar.gz"
            acquire_lock
            restore_backup "$1"
            ;;
        help|--help|-h)
            usage
            ;;
        --version|-V)
            printf 'MedOrbits Agent Backup %s\n' "$SCRIPT_VERSION"
            ;;
        *)
            usage
            die "Unknown command: $command"
            ;;
    esac
}

main "$@"