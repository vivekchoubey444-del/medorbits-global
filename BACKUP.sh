#!/usr/bin/env bash
# ============================================================
# MedOrbits Safe Backup Utility
# File: /BACKUP.sh
#
# Purpose:
#   Create a timestamped backup of the project without changing
#   the working tree, deleting files, or modifying Git history.
#
# Features:
#   - Timestamped project archives
#   - Optional Git metadata and patch backups
#   - Includes untracked and ignored files by default
#   - Excludes sensitive files and bulky generated directories
#   - Optional SHA-256 checksum
#   - Optional backup verification
#   - Refuses to overwrite existing backup files
#   - Does not run git reset, git clean, or git checkout
#
# Requirements:
#   Bash 4+, tar, and optionally git, gzip, sha256sum, shasum
#
# Usage:
#   ./BACKUP.sh
#   ./BACKUP.sh create
#   ./BACKUP.sh create --include-deps
#   ./BACKUP.sh create --include-env
#   ./BACKUP.sh create --include-git
#   ./BACKUP.sh create --output /path/to/backups
#   ./BACKUP.sh verify /path/to/archive.tar.gz
#   ./BACKUP.sh list
#   ./BACKUP.sh help
#
# Security:
#   Environment files, private keys, certificates, and common
#   credential files are excluded by default.
#   Use --include-env only if you understand the security risks.
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
readonly SCRIPT_NAME="BACKUP.sh"
readonly SCRIPT_VERSION="1.0.0"
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
OUTPUT_DIR="${PROJECT_ROOT}/backups"
INCLUDE_DEPS=0
INCLUDE_ENV=0
INCLUDE_GIT=0
CREATE_CHECKSUM=1
VERIFY_AFTER_CREATE=1
QUIET=0
TEMP_DIR=""
ARCHIVE_PATH=""
CHECKSUM_PATH=""
log() {
    printf '[BACKUP] %s\n' "$*"
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
cleanup() {
    if [[ -n "${TEMP_DIR:-}" && -d "$TEMP_DIR" ]]; then
        rm -rf -- "$TEMP_DIR"
    fi
}
on_error() {
    local exit_code=$?
    error "Backup failed near line ${BASH_LINENO[0]:-unknown} (exit ${exit_code})."
    error "Temporary work will be cleaned up; source files are not intentionally modified."
    exit "$exit_code"
}
trap cleanup EXIT
trap on_error ERR
usage() {
    cat <<'USAGE'
MedOrbits Safe Backup Utility
Commands:
  create                  Create a new project backup (default)
  verify ARCHIVE          Verify an archive can be read
  list                    List existing backups
  help                    Show this help message
Options for create:
  --root PATH             Project root (default: directory containing this script)
  --output PATH           Backup destination (default: ROOT/backups)
  --include-deps          Include common dependency directories
  --include-env           Include environment/secret files (use with caution)
  --include-git           Include .git metadata and Git patches
  --no-checksum           Do not create a SHA-256 checksum file
  --no-verify             Skip archive verification
  --quiet                 Reduce informational output
  --help                  Show help
Examples:
  ./BACKUP.sh
  ./BACKUP.sh create --output "$HOME/MedOrbits-backups"
  ./BACKUP.sh create --include-git
  ./BACKUP.sh create --include-env --output /secure/offline/backups
  ./BACKUP.sh verify ./backups/medorbits-backup-YYYYMMDD-HHMMSS.tar.gz
  ./BACKUP.sh list
Safety notes:
  - Existing backup files are never overwritten.
  - Source files are not deleted or reset.
  - The backup destination is excluded from the archive if it is
    inside the project root.
  - Environment files, keys, certificates, and credentials are
    excluded unless --include-env is explicitly supplied.
  - Backups may contain proprietary code and personal data. Store
    them securely and test recovery procedures separately.
USAGE
}
require_command() {
    command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}
is_inside_path() {
    local child="$1"
    local parent="$2"
    [[ "$child" == "$parent" || "$child" == "$parent/"* ]]
}
parse_create_options() {
    while (($#)); do
        case "$1" in
            --root)
                (($# >= 2)) || die "--root requires a path."
                PROJECT_ROOT="$2"
                shift 2
                ;;
            --output)
                (($# >= 2)) || die "--output requires a path."
                OUTPUT_DIR="$2"
                shift 2
                ;;
            --include-deps)
                INCLUDE_DEPS=1
                shift
                ;;
            --include-env)
                INCLUDE_ENV=1
                shift
                ;;
            --include-git)
                INCLUDE_GIT=1
                shift
                ;;
            --no-checksum)
                CREATE_CHECKSUM=0
                shift
                ;;
            --no-verify)
                VERIFY_AFTER_CREATE=0
                shift
                ;;
            --quiet)
                QUIET=1
                shift
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                die "Unknown option: $1. Run '$SCRIPT_NAME help'."
                ;;
        esac
    done
}
canonicalize_paths() {
    [[ -d "$PROJECT_ROOT" ]] || die "Project root does not exist: $PROJECT_ROOT"
    PROJECT_ROOT="$(cd -- "$PROJECT_ROOT" && pwd -P)"
    mkdir -p -- "$OUTPUT_DIR"
    OUTPUT_DIR="$(cd -- "$OUTPUT_DIR" && pwd -P)"
    [[ -w "$OUTPUT_DIR" ]] || die "Backup destination is not writable."
    [[ "$OUTPUT_DIR" != "/" ]] || die "Refusing to use filesystem root as backup destination."
    if [[ "$OUTPUT_DIR" == "$PROJECT_ROOT" ]]; then
        die "Backup destination cannot be the project root itself."
    fi
}
check_disk_space() {
    local available_kb
    local project_size_kb
    available_kb="$(df -Pk "$OUTPUT_DIR" | awk 'NR == 2 {print $4}')"
    project_size_kb="$(du -sk --exclude=backups --exclude=node_modules --exclude=.git "$PROJECT_ROOT" 2>/dev/null | awk '{print $1}' || printf '0')"
    [[ "$available_kb" =~ ^[0-9]+$ ]] || {
        warn "Could not determine free disk space."
        return 0
    }
    [[ "$project_size_kb" =~ ^[0-9]+$ ]] || project_size_kb=0
    if ((available_kb < project_size_kb)); then
        warn "Available space may be insufficient for an uncompressed copy of the project."
        warn "Available: ${available_kb} KB; estimated project size: ${project_size_kb} KB."
    fi
}
make_excludes() {
    local exclude_file="$1"
    cat > "$exclude_file" <<'EXCLUDES'
.git
backups
node_modules
vendor
.venv
venv
__pycache__
.pytest_cache
.mypy_cache
.ruff_cache
.coverage
htmlcov
.next
.nuxt
.output
dist
build
coverage
playwright-report
test-results
.DS_Store
Thumbs.db
*.log
*.tmp
*.swp
*.swo
*.bak
*.orig
*.rej
*.pid
*.sock
*.cache
.env
.env.*
!.env.example
!.env.sample
!.env.template
*.pem
*.key
*.p12
*.pfx
*.jks
*.keystore
id_rsa
id_dsa
id_ecdsa
id_ed25519
credentials.json
service-account.json
service-account-key.json
secrets.json
EXCLUDES
    if ((INCLUDE_DEPS)); then
        sed -i.bak \
            -e '/^node_modules$/d' \
            -e '/^vendor$/d' \
            -e '/^\.venv$/d' \
            -e '/^venv$/d' \
            "$exclude_file" 2>/dev/null || {
                # Portable fallback for systems without sed -i.bak.
                grep -Ev '^(node_modules|vendor|\.venv|venv)$' "$exclude_file" > "${exclude_file}.new"
                mv -- "${exclude_file}.new" "$exclude_file"
            }
        rm -f -- "${exclude_file}.bak"
    fi
    if ((INCLUDE_ENV)); then
        sed -i.bak \
            -e '/^\.env$/d' \
            -e '/^\.env\.\*$/d' \
            -e '/^\*\.pem$/d' \
            -e '/^\*\.key$/d' \
            -e '/^\*\.p12$/d' \
            -e '/^\*\.pfx$/d' \
            -e '/^\*\.jks$/d' \
            -e '/^\*\.keystore$/d' \
            -e '/^id_rsa$/d' \
            -e '/^id_dsa$/d' \
            -e '/^id_ecdsa$/d' \
            -e '/^id_ed25519$/d' \
            -e '/^credentials\.json$/d' \
            -e '/^service-account\.json$/d' \
            -e '/^service-account-key\.json$/d' \
            -e '/^secrets\.json$/d' \
            "$exclude_file" 2>/dev/null || {
                warn "Could not adjust all environment exclusions portably."
            }
        rm -f -- "${exclude_file}.bak"
    fi
    if ((INCLUDE_GIT)); then
        sed -i.bak '/^\.git$/d' "$exclude_file" 2>/dev/null || {
            grep -vxF '.git' "$exclude_file" > "${exclude_file}.new"
            mv -- "${exclude_file}.new" "$exclude_file"
        }
        rm -f -- "${exclude_file}.bak"
    fi
    if is_inside_path "$OUTPUT_DIR" "$PROJECT_ROOT"; then
        local relative_output
        relative_output="${OUTPUT_DIR#"$PROJECT_ROOT"/}"
        printf '%s\n' "$relative_output" >> "$exclude_file"
    fi
}
write_git_metadata() {
    local metadata_dir="$1"
    if ! command -v git >/dev/null 2>&1; then
        warn "Git is unavailable; skipping Git metadata."
        return 0
    fi
    if ! git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        warn "Project is not a Git working tree; skipping Git metadata."
        return 0
    fi
    mkdir -p -- "$metadata_dir"
    git -C "$PROJECT_ROOT" status --short --branch \
        > "$metadata_dir/status.txt" 2>/dev/null || true
    git -C "$PROJECT_ROOT" log -n 100 \
        --date=iso-strict \
        --pretty=format:'%h %ad %an %s' \
        > "$metadata_dir/recent-commits.txt" 2>/dev/null || true
    git -C "$PROJECT_ROOT" diff --no-ext-diff --binary \
        > "$metadata_dir/working-tree.patch" 2>/dev/null || true
    git -C "$PROJECT_ROOT" diff --cached --no-ext-diff --binary \
        > "$metadata_dir/staged.patch" 2>/dev/null || true
    # Include untracked filenames only, not their contents in these metadata files.
    git -C "$PROJECT_ROOT" ls-files --others --exclude-standard \
        > "$metadata_dir/untracked-files.txt" 2>/dev/null || true
    # Avoid printing remote URLs, which may contain embedded credentials.
    git -C "$PROJECT_ROOT" rev-parse --show-toplevel \
        > "$metadata_dir/repository-root.txt" 2>/dev/null || true
    log "Git status and patch metadata prepared."
}
create_backup() {
    require_command tar
    require_command gzip
    require_command awk
    require_command df
    require_command du
    canonicalize_paths
    check_disk_space
    local timestamp
    local project_name
    local archive_name
    local excludes_file
    local staging_dir
    local archive_temp
    timestamp="$(date '+%Y%m%d-%H%M%S')"
    project_name="$(basename -- "$PROJECT_ROOT" | tr -cs '[:alnum:]._- ' '-' | tr ' ' '-')"
    archive_name="${project_name}-backup-${timestamp}.tar.gz"
    ARCHIVE_PATH="${OUTPUT_DIR}/${archive_name}"
    CHECKSUM_PATH="${ARCHIVE_PATH}.sha256"
    [[ ! -e "$ARCHIVE_PATH" ]] || die "Backup already exists; refusing to overwrite it."
    [[ ! -e "$CHECKSUM_PATH" ]] || die "Checksum file already exists; refusing to overwrite it."
    TEMP_DIR="$(mktemp -d "${OUTPUT_DIR}/.backup-work.XXXXXX")"
    staging_dir="${TEMP_DIR}/staging"
    excludes_file="${TEMP_DIR}/exclude-patterns.txt"
    archive_temp="${TEMP_DIR}/${archive_name}"
    mkdir -p -- "$staging_dir"
    make_excludes "$excludes_file"
    if ((!QUIET)); then
        log "Project: $PROJECT_ROOT"
        log "Destination: $OUTPUT_DIR"
        log "Preparing a timestamped archive..."
    fi
    # Copy Git metadata only when explicitly requested. The project archive
    # remains a snapshot of current files, including untracked files.
    if ((INCLUDE_GIT)); then
        write_git_metadata "$staging_dir/git-metadata"
    fi
    local tar_args=()
    while IFS= read -r pattern || [[ -n "$pattern" ]]; do
        [[ -n "$pattern" ]] || continue
        tar_args+=(--exclude="$pattern")
    done < "$excludes_file"
    # GNU tar is common on Linux. BSD tar (macOS) may not support
    # --exclude-from with the same behavior, so pass excludes individually.
    tar -czf "$archive_temp" \
        -C "$PROJECT_ROOT" \
        "${tar_args[@]}" \
        .
    if ((INCLUDE_GIT)); then
        tar -rzf "$archive_temp" -C "$staging_dir" git-metadata 2>/dev/null || {
            # Compressed archives cannot be appended portably. Rebuild with
            # the metadata directory as an additional archive input.
            local rebuilt_archive="${TEMP_DIR}/rebuilt-${archive_name}"
            tar -czf "$rebuilt_archive" \
                -C "$PROJECT_ROOT" \
                "${tar_args[@]}" \
                . \
                -C "$staging_dir" \
                git-metadata
            mv -- "$rebuilt_archive" "$archive_temp"
        }
    fi
    [[ -s "$archive_temp" ]] || die "Archive creation failed or produced an empty file."
    if ((VERIFY_AFTER_CREATE)); then
        tar -tzf "$archive_temp" >/dev/null \
            || die "Archive verification failed."
        log "Archive contents verified."
    fi
    # Move the completed archive into place without replacing an existing file.
    [[ ! -e "$ARCHIVE_PATH" ]] || die "Destination archive appeared during backup; refusing to overwrite it."
    mv -- "$archive_temp" "$ARCHIVE_PATH"
    if ((CREATE_CHECKSUM)); then
        if command -v sha256sum >/dev/null 2>&1; then
            (
                cd -- "$OUTPUT_DIR"
                sha256sum -- "$archive_name" > "${archive_name}.sha256"
            )
        elif command -v shasum >/dev/null 2>&1; then
            (
                cd -- "$OUTPUT_DIR"
                shasum -a 256 "$archive_name" > "${archive_name}.sha256"
            )
        else
            warn "Neither sha256sum nor shasum is available; checksum skipped."
            CHECKSUM_PATH=""
        fi
    fi
    log "Backup created successfully."
    log "Archive: $ARCHIVE_PATH"
    [[ -n "$CHECKSUM_PATH" && -f "$CHECKSUM_PATH" ]] && log "Checksum: $CHECKSUM_PATH"
    log "Source files were not intentionally modified."
}
verify_backup() {
    local archive="${1:-}"
    [[ -n "$archive" ]] || die "Usage: $SCRIPT_NAME verify ARCHIVE"
    [[ -f "$archive" ]] || die "Archive not found: $archive"
    require_command tar
    tar -tzf "$archive" >/dev/null || die "Archive is unreadable or corrupt."
    log "Archive structure is readable: $archive"
    if [[ -f "${archive}.sha256" ]]; then
        if command -v sha256sum >/dev/null 2>&1; then
            sha256sum -c "${archive}.sha256"
        elif command -v shasum >/dev/null 2>&1; then
            local expected actual
            expected="$(awk 'NR == 1 {print $1}' "${archive}.sha256")"
            actual="$(shasum -a 256 "$archive" | awk '{print $1}')"
            [[ "$expected" == "$actual" ]] || die "Checksum mismatch."
            log "SHA-256 checksum verified."
        else
            warn "Checksum file exists, but no supported SHA-256 tool is available."
        fi
    else
        warn "No checksum file found for this archive."
    fi
}
list_backups() {
    canonicalize_paths
    log "Backup destination: $OUTPUT_DIR"
    local found=0
    local file
    while IFS= read -r -d '' file; do
        found=1
        printf '%s\t%s bytes\n' \
            "$(basename -- "$file")" \
            "$(wc -c < "$file" | tr -d ' ')'
    done < <(find "$OUTPUT_DIR" -maxdepth 1 -type f -name '*-backup-*.tar.gz' -print0 | sort -z)
    ((found)) || log "No backup archives found."
}
main() {
    local command="${1:-create}"
    if (($#)); then
        shift
    fi
    case "$command" in
        create)
            parse_create_options "$@"
            create_backup
            ;;
        verify)
            verify_backup "${1:-}"
            ;;
        list)
            list_backups
            ;;
        help|-h|--help)
            usage
            ;;
        --version)
            printf '%s %s\n' "$SCRIPT_NAME" "$SCRIPT_VERSION"
            ;;
        *)
            die "Unknown command: $command. Run '$SCRIPT_NAME help'."
            ;;
    esac
}
main "$@"