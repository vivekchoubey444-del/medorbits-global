
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- Git Bot Identity Fix
# File: tools/FIX-GIT-BOT.sh
# Version: 1.1.0
#
# Purpose:
#   Configure the local Git author identity for the MedOrbits repository.
#
# Usage:
#   bash tools/FIX-GIT-BOT.sh
#   bash tools/FIX-GIT-BOT.sh --dry-run
#   GIT_BOT_EMAIL=verified-email@example.com bash tools/FIX-GIT-BOT.sh
#
# Options:
#   --dry-run       Preview changes without modifying Git configuration.
#   --help, -h      Display help.
#
# Safety:
#   - Changes repository-local Git identity only.
#   - Never prints remote URLs or credentials.
#   - Does not rewrite existing commits.
#   - Does not create commits or push changes.
#   - Does not modify branches or remotes.
#   - Preserves existing email unless explicitly supplied.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly VERSION="1.1.0"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"

readonly LOG_DIR="${ROOT_DIR}/logs"
readonly LOG_FILE="${LOG_DIR}/fix-git-bot.log"

readonly BOT_NAME="MedOrbits Bot"

BOT_EMAIL="${GIT_BOT_EMAIL:-}"
DRY_RUN=0

usage() {
    cat <<'HELP'
MedOrbits Git Bot Identity Fix v1.1.0

Usage:
  bash tools/FIX-GIT-BOT.sh [options]

Options:
  --dry-run       Preview changes without modifying Git configuration.
  --help, -h      Display this help.

Configure a verified GitHub email:

  GIT_BOT_EMAIL=your-verified-email@example.com \
    bash tools/FIX-GIT-BOT.sh

The script changes only the current repository's local Git identity.
It does not change existing commits or push anything.
HELP
}

fail() {
    printf '[GIT-BOT] ERROR: %s\n' "$*" >&2
    exit 1
}

log() {
    local message
    message="[$(date -Is 2>/dev/null || date)] $*"

    printf '%s\n' "$message"

    if [[ -n "${LOG_FILE:-}" ]]; then
        printf '%s\n' "$message" >> "$LOG_FILE" ||
            printf '[GIT-BOT] WARNING: Unable to write log.\n' >&2
    fi
}

parse_args() {
    while (($#)); do
        case "$1" in
            --dry-run)
                DRY_RUN=1
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                fail "Unknown option: $1"
                ;;
        esac
        shift
    done
}

validate_email() {
    local email="$1"

    [[ -n "$email" ]] ||
        fail "Git bot email cannot be empty."

    [[ "$email" != *$'\n'* && "$email" != *$'\r'* ]] ||
        fail "Email must not contain newline characters."

    [[ "$email" != *[[:space:]]* ]] ||
        fail "Email must not contain whitespace."

    [[ "$email" =~ ^[^@]+@[^@]+\.[^@]+$ ]] ||
        fail "GIT_BOT_EMAIL does not look like a valid email address."
}

initialize_logging() {
    [[ ! -L "$LOG_DIR" ]] ||
        fail "Refusing symbolic-link log directory."

    [[ ! -e "$LOG_DIR" || -d "$LOG_DIR" ]] ||
        fail "Log directory path is not a directory."

    mkdir -p -- "$LOG_DIR"

    [[ ! -L "$LOG_FILE" ]] ||
        fail "Refusing symbolic-link log file."

    [[ ! -e "$LOG_FILE" || -f "$LOG_FILE" ]] ||
        fail "Log destination is not a regular file."

    : >> "$LOG_FILE" ||
        fail "Cannot write to log file."

    chmod 600 "$LOG_FILE" ||
        fail "Cannot secure log file."
}

main() {
    parse_args "$@"

    command -v git >/dev/null 2>&1 ||
        fail "Git is not installed."

    cd -- "$ROOT_DIR" ||
        fail "Cannot access repository root."

    git rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
        fail "This directory is not a Git repository."

    if [[ -n "$BOT_EMAIL" ]]; then
        validate_email "$BOT_EMAIL"
    fi

    if (( DRY_RUN == 0 )); then
        initialize_logging
    fi

    log "MedOrbits Git Bot Identity Fix v${VERSION}"
    log "Repository: ${ROOT_DIR}"

    if (( DRY_RUN )); then
        log "Mode: DRY-RUN"
    else
        log "Mode: CONFIGURATION"
    fi

    local current_name current_email branch

    current_name="$(git config --local --get user.name || true)"
    current_email="$(git config --local --get user.email || true)"
    branch="$(git branch --show-current 2>/dev/null || true)"

    log "Current local Git name: ${current_name:-not configured}"
    log "Current local Git email: ${current_email:-not configured}"
    log "Current branch: ${branch:-detached HEAD}"

    if git remote get-url origin >/dev/null 2>&1; then
        log "Origin remote: configured (URL intentionally hidden)."
    else
        log "WARNING: No origin remote configured."
    fi

    if [[ "$current_name" != "$BOT_NAME" ]]; then
        if (( DRY_RUN )); then
            log "DRY-RUN: Would set local Git user.name to ${BOT_NAME}."
        else
            git config --local user.name "$BOT_NAME" ||
                fail "Could not configure local Git user.name."

            log "Configured local Git author name."
        fi
    else
        log "Git author name is already configured correctly."
    fi

    if [[ -n "$BOT_EMAIL" ]]; then
        if [[ "$current_email" != "$BOT_EMAIL" ]]; then
            if (( DRY_RUN )); then
                log "DRY-RUN: Would update local Git author email."
            else
                git config --local user.email "$BOT_EMAIL" ||
                    fail "Could not configure local Git user.email."

                log "Configured local Git author email."
            fi
        else
            log "Git author email is already configured."
        fi
    else
        log "Email unchanged. Supply GIT_BOT_EMAIL to configure it."
    fi

    log "Latest commit identity:"

    if git rev-parse --verify HEAD >/dev/null 2>&1; then
        git log -1 \
            --format='Author name: %an%nCommitter name: %cn' ||
            log "WARNING: Could not inspect latest commit."
    else
        log "No commits available yet."
    fi

    if ! git diff --quiet ||
       ! git diff --cached --quiet ||
       [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
        log "WARNING: Working tree contains changes. They were not modified."
    else
        log "Working tree is clean."
    fi

    if (( DRY_RUN == 0 )); then
        log "Final local Git name: $(git config --local user.name)"
        log "Final local Git email: configured (value hidden)."
        log "Log file: ${LOG_FILE}"
    fi

    log "Existing commits were not rewritten."
    log "No commit, push, remote change, or credential change was performed."

    if (( DRY_RUN )); then
        log "DRY-RUN completed. No Git configuration was changed."
    else
        log "Git bot identity configuration completed."
    fi

    return 0
}

main "$@"
