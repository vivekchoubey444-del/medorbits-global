
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- Safe Git Push Utility
#
# File: PUSH.sh
# Version: 1.0.0
#
# Usage:
#   bash PUSH.sh --check
#   bash PUSH.sh --dry-run
#   bash PUSH.sh --push
#   bash PUSH.sh --help
#
# Optional environment:
#   PUSH_REMOTE=origin
#   PUSH_BRANCH=main
#
# Safety:
#   - Never runs git reset, git clean, or git checkout.
#   - Never force-pushes.
#   - Never stages or commits files automatically.
#   - Refuses to push with uncommitted changes by default.
#   - Requires explicit confirmation before a real push.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_DIR="$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P
)"
readonly REPO_ROOT="$(
    cd -- "$SCRIPT_DIR" && pwd -P
)"

REMOTE="${PUSH_REMOTE:-origin}"
BRANCH="${PUSH_BRANCH:-}"
MODE=""

log() {
    printf '[MedOrbits Push] %s\n' "$*"
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
MedOrbits Safe Git Push Utility

Usage:
  bash PUSH.sh --check
  bash PUSH.sh --dry-run
  bash PUSH.sh --push
  bash PUSH.sh --help

Options:
  --check     Inspect repository, branch, remote and working tree.
  --dry-run   Preview the push operation without pushing.
  --push      Push after checks and explicit confirmation.
  --help      Display this help.

Environment:
  PUSH_REMOTE   Remote name (default: origin).
  PUSH_BRANCH   Destination branch (default: current branch).

Before pushing:
  1. Review all changes.
  2. Commit intended changes yourself.
  3. Back up important or untracked files.
  4. Verify the destination branch.

This script never stages, commits, force-pushes, or deletes files.
USAGE
}

require_git() {
    command -v git >/dev/null 2>&1 ||
        die "Git is not installed or is not available in PATH."

    git -C "$REPO_ROOT" rev-parse --is-inside-work-tree \
        >/dev/null 2>&1 ||
        die "Not inside a Git working tree: $REPO_ROOT"
}

resolve_branch() {
    if [[ -z "$BRANCH" ]]; then
        BRANCH="$(git -C "$REPO_ROOT" symbolic-ref \
            --quiet --short HEAD 2>/dev/null || true)"
    fi

    [[ -n "$BRANCH" ]] ||
        die "Detached HEAD detected. Set PUSH_BRANCH explicitly after reviewing the target."

    # Reject option-like and malformed branch names.
    git -C "$REPO_ROOT" check-ref-format \
        --branch "$BRANCH" >/dev/null 2>&1 ||
        die "Invalid branch name: $BRANCH"
}

check_remote() {
    git -C "$REPO_ROOT" remote get-url "$REMOTE" \
        >/dev/null 2>&1 ||
        die "Remote '$REMOTE' is not configured."

    local remote_url
    remote_url="$(git -C "$REPO_ROOT" remote get-url "$REMOTE")"

    log "Remote: $REMOTE"
    log "Remote URL: $remote_url"
    log "Destination branch: $BRANCH"
}

check_working_tree() {
    local status
    status="$(git -C "$REPO_ROOT" status --porcelain=v1 --untracked-files=all)"

    if [[ -n "$status" ]]; then
        warn "Uncommitted or untracked files were detected:"
        printf '%s\n' "$status" >&2
        die "Push cancelled. Review and back up these files before proceeding."
    fi

    log "Working tree is clean."
}

check_commit() {
    git -C "$REPO_ROOT" rev-parse --verify HEAD \
        >/dev/null 2>&1 ||
        die "No commit exists yet. Create and review a commit first."

    log "Current commit: $(git -C "$REPO_ROOT" rev-parse --short HEAD)"
}

check_upstream() {
    local upstream
    upstream="$(git -C "$REPO_ROOT" rev-parse \
        --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"

    if [[ -n "$upstream" ]]; then
        log "Configured upstream: $upstream"
    else
        log "No upstream configured for the current branch."
        log "The push will explicitly target: $REMOTE $BRANCH"
    fi
}

check_fast_forward() {
    log "Fetching remote references for a non-destructive preflight check..."

    git -C "$REPO_ROOT" fetch --no-tags "$REMOTE" ||
        die "Fetch failed. Check network access and remote permissions."

    local remote_ref="refs/remotes/${REMOTE}/${BRANCH}"

    if git -C "$REPO_ROOT" show-ref --verify --quiet "$remote_ref"; then
        if git -C "$REPO_ROOT" merge-base --is-ancestor \
            "$remote_ref" HEAD; then
            log "Remote branch is an ancestor of HEAD or matches HEAD."
        else
            die "Remote branch has commits not contained in HEAD, or histories diverge. Reconcile safely before pushing."
        fi
    else
        log "Remote-tracking branch not found. This may be a new remote branch."
    fi

    # Fetch is read-only with respect to the working tree, but it updates
    # local remote-tracking references.
}

show_push_preview() {
    log "Push preview:"
    printf '  Repository: %s\n' "$REPO_ROOT"
    printf '  Remote:     %s\n' "$REMOTE"
    printf '  Branch:     %s\n' "$BRANCH"
    printf '  Refspec:    HEAD:refs/heads/%s\n' "$BRANCH"

    git -C "$REPO_ROOT" log \
        --oneline --decorate -5 HEAD
}

main() {
    [[ "$#" -eq 1 ]] || {
        usage
        die "Provide exactly one mode."
    }

    MODE="$1"

    case "$MODE" in
        --help|-h)
            usage
            exit 0
            ;;
        --check|--dry-run|--push)
            ;;
        *)
            usage
            die "Unknown option: $MODE"
            ;;
    esac

    require_git
    resolve_branch
    check_remote
    check_commit
    check_upstream

    case "$MODE" in
        --check)
            git -C "$REPO_ROOT" status --short
            log "Check completed. No push performed."
            ;;

        --dry-run)
            check_working_tree
            show_push_preview

            log "Running Git's non-mutating push simulation..."
            git -C "$REPO_ROOT" push \
                --dry-run \
                --porcelain \
                "$REMOTE" \
                "HEAD:refs/heads/$BRANCH"

            log "Dry-run completed. No remote update was requested."
            ;;

        --push)
            check_working_tree
            check_fast_forward
            show_push_preview

            printf '\n'
            warn "You are about to push committed code to a remote repository."
            warn "Confirm that the branch and commit contents are correct."
            printf 'Type PUSH to continue: '

            local confirmation
            IFS= read -r confirmation ||
                die "Confirmation was not received."

            [[ "$confirmation" == "PUSH" ]] ||
                die "Confirmation failed. No push was performed."

            # Recheck the local working tree immediately before pushing.
            check_working_tree

            git -C "$REPO_ROOT" push \
                --porcelain \
                "$REMOTE" \
                "HEAD:refs/heads/$BRANCH"

            log "Push command completed successfully."
            ;;
    esac
}

main "$@"
