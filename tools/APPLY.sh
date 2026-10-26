
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- Safe Apply Utility
#
# File: tools/APPLY.sh
# Purpose:
#   Apply explicitly requested repository changes without silently overwriting
#   existing files, deleting user data, or running untrusted scripts.
#
# Requirements:
#   - Bash 4+
#   - Git
#
# Usage:
#   bash tools/APPLY.sh --check
#   bash tools/APPLY.sh --dry-run
#   bash tools/APPLY.sh --apply
#   bash tools/APPLY.sh --help
#
# Safety:
#   - --check and --dry-run never modify repository files.
#   - --apply requires a clean Git working tree by default.
#   - No automatic git reset, clean, checkout, or destructive cleanup.
#   - No automatic commit, push, deployment, or dependency installation.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_NAME="APPLY.sh"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"

MODE=""

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
  --check     Check repository and required tools; no changes.
  --dry-run   Preview the safety checks for an apply operation.
  --apply     Run explicitly configured, non-destructive apply steps.
  --help      Show this help message.

Safety policy:
  - Refuses to run outside a Git repository.
  - Refuses --apply when tracked or untracked changes exist.
  - Does not delete files or overwrite existing files itself.
  - Does not install dependencies, commit, push, or deploy.
  - Requires a configured apply hook before doing project-specific work.

Configuration:
  Set MEDORBITS_APPLY_HOOK to an existing executable script inside this
  repository to run a project-specific apply hook.

Example:
  MEDORBITS_APPLY_HOOK=tools/apply-changes.sh bash tools/APPLY.sh --dry-run

The hook must support --dry-run and --apply. Review it before execution.
USAGE
}

require_command() {
    command -v "$1" >/dev/null 2>&1 ||
        die "Required command not found: $1"
}

canonical_existing_file() {
    local candidate="$1"

    [[ -f "$candidate" && ! -L "$candidate" ]] ||
        die "Expected a regular, non-symlink file: $candidate"

    (
        cd -- "$(dirname -- "$candidate")"
        printf '%s/%s\n' "$(pwd -P)" "$(basename -- "$candidate")"
    )
}

assert_inside_repo() {
    local candidate="$1"
    local prefix="${REPO_ROOT}/"

    [[ "$candidate" == "$prefix"* ]] ||
        die "Path must be inside the repository: $candidate"
}

check_repository() {
    require_command git

    git -C "$REPO_ROOT" rev-parse --show-toplevel >/dev/null 2>&1 ||
        die "Repository root is not a Git working tree: $REPO_ROOT"

    local git_root
    git_root="$(git -C "$REPO_ROOT" rev-parse --show-toplevel)"
    git_root="$(cd -- "$git_root" && pwd -P)"

    [[ "$git_root" == "$REPO_ROOT" ]] ||
        die "Unexpected Git root. Expected: $REPO_ROOT; found: $git_root"

    info "Repository: $REPO_ROOT"
    info "Git working tree detected."
}

check_working_tree() {
    local status

    status="$(git -C "$REPO_ROOT" status --porcelain --untracked-files=all)"

    if [[ -n "$status" ]]; then
        warn "Git working tree contains changes:"
        printf '%s\n' "$status" >&2
        die "Commit, stash, or back up these changes before --apply."
    fi

    info "Git working tree is clean."
}

resolve_hook() {
    local hook="${MEDORBITS_APPLY_HOOK:-}"

    [[ -n "$hook" ]] ||
        die "No apply hook configured. Set MEDORBITS_APPLY_HOOK to a reviewed script."

    # Resolve relative paths from the repository root.
    if [[ "$hook" != /* ]]; then
        hook="${REPO_ROOT}/${hook}"
    fi

    hook="$(canonical_existing_file "$hook")"
    assert_inside_repo "$hook"

    [[ -x "$hook" ]] ||
        die "Apply hook must be executable: $hook"

    printf '%s\n' "$hook"
}

run_hook() {
    local hook="$1"
    local hook_mode="$2"

    log "Running reviewed apply hook in ${hook_mode} mode."
    log "Hook: ${hook}"

    (
        cd -- "$REPO_ROOT"
        "$hook" "$hook_mode"
    )
}

main() {
    [[ "$#" -eq 1 ]] || {
        usage
        die "Provide exactly one option."
    }

    MODE="$1"

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

    case "$MODE" in
        --check)
            require_command bash
            info "Safety checks passed. No files were modified."
            ;;

        --dry-run)
            check_working_tree
            hook="$(resolve_hook)"
            run_hook "$hook" "--dry-run"
            info "Dry-run completed. Review hook output before applying."
            ;;

        --apply)
            check_working_tree
            hook="$(resolve_hook)"

            printf '\n'
            warn "This will execute the configured repository-local apply hook."
            warn "Ensure the hook and its effects have been reviewed."
            printf 'Type APPLY to continue: '

            IFS= read -r confirmation || die "Confirmation was not received."
            [[ "$confirmation" == "APPLY" ]] ||
                die "Confirmation did not match. No apply hook was executed."

            run_hook "$hook" "--apply"
            info "Apply hook completed."
            ;;
    esac
}

main "$@"
