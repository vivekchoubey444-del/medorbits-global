
#!/usr/bin/env bash
# ==============================================================================
# MEDORBITS -- SAFE APPLY UTILITY
#
# File: tools/APPLY.sh
# Purpose:
#   Safely execute an explicitly configured, repository-local apply hook.
#
# Requirements:
#   - Bash 4+
#   - Git
#   - sha256sum or shasum
#
# Usage:
#   bash tools/APPLY.sh --check
#   bash tools/APPLY.sh --dry-run
#   bash tools/APPLY.sh --apply
#   bash tools/APPLY.sh --help
#
# Optional:
#   MEDORBITS_APPLY_HOOK=tools/apply-changes.sh
#   MEDORBITS_APPLY_LOG=tools/logs/apply.log
#   MEDORBITS_ALLOW_DIRTY=0
#
# Safety:
#   - No automatic deletion, reset, clean, checkout, commit, push, or deployment.
#   - No automatic dependency installation.
#   - Apply requires a clean Git working tree by default.
#   - Apply requires explicit interactive confirmation.
#   - Hook must be a regular executable file inside this repository.
#   - Hook integrity is checked immediately before execution.
#   - Dry-run is checked for unexpected working-tree modifications.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_NAME="APPLY.sh"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"

readonly DEFAULT_LOG_RELATIVE="tools/logs/apply.log"

MODE=""
HOOK=""
HOOK_HASH=""
LOG_FILE=""
ALLOW_DIRTY="${MEDORBITS_ALLOW_DIRTY:-0}"

START_TIME=0
HOOK_EXIT_CODE=0

log() {
    printf '[MedOrbits] %s\n' "$*"
}

info() {
    printf '[INFO] %s\n' "$*"
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
MedOrbits Safe Apply Utility

Usage:
  bash tools/APPLY.sh --check
  bash tools/APPLY.sh --dry-run
  bash tools/APPLY.sh --apply
  bash tools/APPLY.sh --help

Options:
  --check       Validate repository and required tools.
  --dry-run     Preview the configured hook without applying changes.
  --apply       Execute the approved hook after interactive confirmation.
  --help        Display this help.

Environment:
  MEDORBIT​S_APPLY_HOOK
      Repository-relative or absolute path to the reviewed apply hook.

  MEDORBIT​S_APPLY_LOG
      Optional path for execution logs.

  MEDORBIT​S_ALLOW_DIRTY
      Default: 0. Set to 1 to permit a dirty Git tree.
      This weakens the default safety policy and is not recommended.

Examples:
  MEDORBIT​S_APPLY_HOOK=tools/apply-changes.sh \
    bash tools/APPLY.sh --dry-run

  MEDORBIT​S_APPLY_HOOK=tools/apply-changes.sh \
    bash tools/APPLY.sh --apply

Safety:
  - No automatic Git reset, clean, checkout, commit, push, or deployment.
  - No automatic dependency installation.
  - No execution of hooks outside the repository.
  - No automatic deletion or replacement of user files.
  - Hook changes are checked against a SHA-256 digest.
  - Dry-run checks for unexpected repository modifications.

Review the hook before executing it.
USAGE
}

timestamp() {
    date -u '+%Y-%m-%dT%H:%M:%SZ'
}

require_command() {
    command -v "$1" >/dev/null 2>&1 ||
        die "Required command not found: $1"
}

sha256_file() {
    local file="$1"

    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$file" | awk '{print $1}'
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$file" | awk '{print $1}'
    else
        die "Neither sha256sum nor shasum is available."
    fi
}

canonical_existing_file() {
    local candidate="$1"
    local directory
    local filename

    [[ -f "$candidate" && ! -L "$candidate" ]] ||
        die "Expected a regular, non-symlink file: $candidate"

    directory="$(dirname -- "$candidate")"
    filename="$(basename -- "$candidate")"

    (
        cd -- "$directory"
        printf '%s/%s\n' "$(pwd -P)" "$filename"
    )
}

assert_inside_repo() {
    local candidate="$1"

    case "$candidate" in
        "$REPO_ROOT"/*)
            ;;
        *)
            die "Path must be inside the repository: $candidate"
            ;;
    esac
}

resolve_log_path() {
    local configured="${MEDORBIT​S_APPLY_LOG:-$DEFAULT_LOG_RELATIVE}"

    if [[ "$configured" != /* ]]; then
        configured="${REPO_ROOT}/${configured}"
    fi

    local parent
    parent="$(dirname -- "$configured")"

    [[ -d "$parent" ]] ||
        die "Log directory does not exist: $parent"

    parent="$(cd -- "$parent" && pwd -P)"
    LOG_FILE="${parent}/$(basename -- "$configured")"

    assert_inside_repo "$LOG_FILE"

    [[ ! -L "$LOG_FILE" ]] ||
        die "Refusing to write through a symbolic-link log file."
}

write_log() {
    local level="$1"
    shift

    local message="$*"

    printf '[%s] [%s] %s\n' \
        "$(timestamp)" "$level" "$message" >&2

    if [[ -n "$LOG_FILE" ]]; then
        printf '[%s] [%s] %s\n' \
            "$(timestamp)" "$level" "$message" >> "$LOG_FILE"
    fi
}

check_repository() {
    require_command git
    require_command bash
    require_command date
    require_command awk

    if ! git -C "$REPO_ROOT" rev-parse --show-toplevel \
        >/dev/null 2>&1; then
        die "Not inside a Git working tree: $REPO_ROOT"
    fi

    local git_root
    git_root="$(git -C "$REPO_ROOT" rev-parse --show-toplevel)"
    git_root="$(cd -- "$git_root" && pwd -P)"

    [[ "$git_root" == "$REPO_ROOT" ]] ||
        die "Unexpected Git root: $git_root"

    info "Repository: $REPO_ROOT"
    info "Git working tree detected."
}

check_git_operations() {
    local git_dir
    git_dir="$(git -C "$REPO_ROOT" rev-parse --absolute-git-dir)"

    local operation_markers=(
        MERGE_HEAD
        CHERRY_PICK_HEAD
        REVERT_HEAD
        REBASE_HEAD
        rebase-merge
        rebase-apply
        BISECT_LOG
    )

    local marker

    for marker in "${operation_markers[@]}"; do
        if [[ -e "${git_dir}/${marker}" ]]; then
            die "An active Git operation was detected: ${marker}"
        fi
    done

    if [[ -n "$(git -C "$REPO_ROOT" diff --name-only --diff-filter=U)" ]]; then
        die "Unresolved Git merge conflicts detected."
    fi

    info "No active Git operation or unresolved merge conflict detected."
}

check_working_tree() {
    local status

    status="$(git -C "$REPO_ROOT" status \
        --porcelain=v1 \
        --untracked-files=all)"

    if [[ -n "$status" ]]; then
        warn "Git working tree contains changes:"
        printf '%s\n' "$status" >&2

        [[ "$ALLOW_DIRTY" == "1" ]] ||
            die "Working tree is not clean. Commit, stash, or back up changes first."

        warn "MEDORBIT​S_ALLOW_DIRTY=1: dirty-tree protection explicitly relaxed."
    else
        info "Git working tree is clean."
    fi
}

check_ignored_sensitive_files() {
    local ignored

    ignored="$(
        git -C "$REPO_ROOT" ls-files \
            --others \
            --ignored \
            --exclude-standard
    )"

    if [[ -n "$ignored" ]]; then
        warn "Ignored files exist in the repository:"
        printf '%s\n' "$ignored" >&2
        warn "Ensure the apply hook does not modify or expose ignored files."
    else
        info "No ignored untracked files detected."
    fi
}

resolve_hook() {
    local hook="${MEDORBIT​S_APPLY_HOOK:-}"

    [[ -n "$hook" ]] ||
        die "No apply hook configured. Set MEDORBIT​S_APPLY_HOOK."

    if [[ "$hook" != /* ]]; then
        hook="${REPO_ROOT}/${hook}"
    fi

    HOOK="$(canonical_existing_file "$hook")"

    assert_inside_repo "$HOOK"

    [[ -x "$HOOK" ]] ||
        die "Apply hook must be executable: $HOOK"

    [[ "$HOOK" != "$SCRIPT_DIR/APPLY.sh" ]] ||
        die "APPLY.sh cannot be configured as its own hook."

    HOOK_HASH="$(sha256_file "$HOOK")"

    info "Apply hook: $HOOK"
    info "Hook SHA-256: $HOOK_HASH"
}

verify_hook_integrity() {
    local current_hash

    [[ -f "$HOOK" && ! -L "$HOOK" && -x "$HOOK" ]] ||
        die "Apply hook is missing, replaced, or no longer executable."

    current_hash="$(sha256_file "$HOOK")"

    [[ "$current_hash" == "$HOOK_HASH" ]] ||
        die "Apply hook changed after review. Re-review before execution."

    info "Apply hook integrity verified."
}

working_tree_snapshot() {
    git -C "$REPO_ROOT" status \
        --porcelain=v1 \
        --untracked-files=all
}

run_hook() {
    local hook_mode="$1"
    local before=""
    local after=""

    verify_hook_integrity

    if [[ "$hook_mode" == "--dry-run" ]]; then
        before="$(working_tree_snapshot)"
    fi

    write_log "INFO" "Starting hook: ${HOOK} ${hook_mode}"

    set +e
    (
        cd -- "$REPO_ROOT"
        "$HOOK" "$hook_mode"
    )
    HOOK_EXIT_CODE=$?
    set -e

    write_log "INFO" "Hook exit code: $HOOK_EXIT_CODE"

    if [[ "$hook_mode" == "--dry-run" ]]; then
        after="$(working_tree_snapshot)"

        if [[ "$before" != "$after" ]]; then
            warn "Dry-run changed Git working-tree status."
            warn "Inspect all changed and untracked files immediately."
            write_log "ERROR" "Dry-run modified repository state."
            return 1
        fi

        info "Dry-run working-tree status unchanged."
    fi

    return "$HOOK_EXIT_CODE"
}

confirm_apply() {
    local confirmation

    printf '\n'
    warn "You are about to execute the configured repository apply hook."
    warn "Review the hook and its proposed changes before continuing."
    printf 'Type APPLY to continue: '

    IFS= read -r confirmation ||
        die "Confirmation was not received."

    [[ "$confirmation" == "APPLY" ]] ||
        die "Confirmation did not match. No hook was executed."
}

main() {
    [[ "$#" -eq 1 ]] || {
        usage
        die "Provide exactly one option."
    }

    MODE="$1"
    START_TIME=$SECONDS

    case "$MODE" in
        --help|-h)
            usage
            exit 0
            ;;
        --check|--dry-run|--apply)
            ;;
        *)
            usage
            die "Unknown option: $MODE"
            ;;
    esac

    check_repository
    check_git_operations

    case "$MODE" in
        --check)
            info "Checking available checksum tools."

            if command -v sha256sum >/dev/null 2>&1 ||
                command -v shasum >/dev/null 2>&1; then
                info "SHA-256 utility available."
            else
                warn "SHA-256 utility unavailable; hook execution will not be possible."
            fi

            info "Repository checks completed. No files modified."
            ;;

        --dry-run)
            check_working_tree
            check_ignored_sensitive_files
            resolve_log_path
            resolve_hook

            run_hook "--dry-run" ||
                die "Dry-run hook failed or modified repository state."

            info "Dry-run completed. No Git working-tree changes detected."
            ;;

        --apply)
            check_working_tree
            check_ignored_sensitive_files
            resolve_log_path
            resolve_hook

            confirm_apply

            verify_hook_integrity

            if ! run_hook "--apply"; then
                local duration=$((SECONDS - START_TIME))

                write_log "ERROR" \
                    "Apply failed after ${duration}s. Exit code: ${HOOK_EXIT_CODE}"

                die "Apply hook failed. Inspect its logs and repository status."
            fi

            local duration=$((SECONDS - START_TIME))

            write_log "SUCCESS" "Apply completed in ${duration}s."
            info "Apply hook completed successfully."
            ;;
    esac
}

main "$@"
