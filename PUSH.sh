#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- Safe Git Push Utility
#
# File: PUSH.sh
# Release target: 3.0.0
#
# Purpose:
#   Inspect, validate, preview, and optionally push committed changes to a
#   configured Git remote without staging, committing, force-pushing, or
#   deploying automatically.
#
# Usage:
#   bash PUSH.sh --check
#   bash PUSH.sh --dry-run
#   bash PUSH.sh --push
#   bash PUSH.sh --help
#
# Environment:
#   PUSH_REMOTE=origin
#   PUSH_BRANCH=main
#   PUSH_ALLOW_NON_CURRENT_BRANCH=false
#   PUSH_ALLOW_NEW_BRANCH=false
#
# Safety:
#   - No git reset, git clean, or git checkout.
#   - Never stages or commits files automatically.
#   - Never force-pushes.
#   - Requires a clean working tree for push operations.
#   - Requires explicit confirmation before a real push.
#   - Checks remote ancestry and refuses detected divergence.
#   - Pushes an explicit HEAD-to-branch refspec.
#   - Never deploys or publishes releases automatically.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_DIR="$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P
)"
readonly REPO_ROOT="$(
    git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null
)" || {
    printf '[ERROR] Cannot locate the Git repository root.\n' >&2
    exit 1
}

readonly DEFAULT_REMOTE="origin"

REMOTE="${PUSH_REMOTE:-$DEFAULT_REMOTE}"
BRANCH="${PUSH_BRANCH:-}"
MODE=""
HEAD_BEFORE=""
REMOTE_URL=""
REMOTE_REF=""
REMOTE_OID_BEFORE=""

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
    cat <<'HELP'
MedOrbits Safe Git Push Utility -- 3.0.0

Usage:
  bash PUSH.sh --check
  bash PUSH.sh --dry-run
  bash PUSH.sh --push
  bash PUSH.sh --help

Options:
  --check
      Inspect repository state, destination, and working tree.
      Does not push or fetch.

  --dry-run
      Check local state and simulate the push operation.
      Fetches remote references to inspect the destination first.

  --push
      Validate, fetch, check ancestry, request confirmation, and push.

  --help
      Display this help.

Environment:
  PUSH_REMOTE
      Remote name. Defaults to origin.

  PUSH_BRANCH
      Destination branch. Defaults to the current branch.

  PUSH_ALLOW_NON_CURRENT_BRANCH=true
      Permit an explicit destination branch different from the current
      branch. The push still sends the current HEAD to that destination.

  PUSH_ALLOW_NEW_BRANCH=true
      Permit creating a new remote branch after explicit confirmation.

Safety:
  - No staging, commits, force-pushes, resets, cleanups, or deployments.
  - Push operations require a clean working tree.
  - Existing remote commits must be contained in the local HEAD.
  - The script never overwrites an existing remote branch intentionally
    when its history diverges.
  - Server-side branch protection and remote hooks remain authoritative.

Before pushing, review the destination and the commits being published.
HELP
}

require_command() {
    command -v "$1" >/dev/null 2>&1 ||
        die "Required command not found: $1"
}

require_git_repository() {
    require_command git

    git -C "$REPO_ROOT" rev-parse --is-inside-work-tree \
        >/dev/null 2>&1 ||
        die "Not inside a Git working tree: $REPO_ROOT"
}

resolve_branch() {
    local current_branch

    current_branch="$(
        git -C "$REPO_ROOT" symbolic-ref \
            --quiet --short HEAD 2>/dev/null || true
    )"

    if [[ -z "$BRANCH" ]]; then
        BRANCH="$current_branch"
    fi

    [[ -n "$BRANCH" ]] ||
        die "Detached HEAD detected. Set PUSH_BRANCH explicitly after reviewing the destination."

    git -C "$REPO_ROOT" check-ref-format \
        --branch "$BRANCH" >/dev/null 2>&1 ||
        die "Invalid destination branch: $BRANCH"

    if [[ -n "$current_branch" && "$BRANCH" != "$current_branch" &&
          "${PUSH_ALLOW_NON_CURRENT_BRANCH:-false}" != "true" ]]; then
        die "Destination '$BRANCH' differs from current branch '$current_branch'. Set PUSH_ALLOW_NON_CURRENT_BRANCH=true only after reviewing the destination."
    fi

    log "Current branch: ${current_branch:-DETACHED HEAD}"
    log "Destination branch: $BRANCH"
}

check_remote() {
    [[ -n "$REMOTE" ]] ||
        die "PUSH_REMOTE must not be empty."

    git -C "$REPO_ROOT" remote get-url "$REMOTE" >/dev/null 2>&1 ||
        die "Remote '$REMOTE' is not configured."

    REMOTE_URL="$(git -C "$REPO_ROOT" remote get-url "$REMOTE")"

    log "Remote: $REMOTE"
    log "Remote URL: $REMOTE_URL"

    REMOTE_REF="refs/remotes/${REMOTE}/${BRANCH}"
}

check_commit() {
    git -C "$REPO_ROOT" rev-parse --verify HEAD >/dev/null 2>&1 ||
        die "No commit exists yet. Create and review a commit first."

    HEAD_BEFORE="$(git -C "$REPO_ROOT" rev-parse HEAD)"

    log "HEAD: $(git -C "$REPO_ROOT" rev-parse --short HEAD)"
    log "Commit: $HEAD_BEFORE"
}

check_conflicts() {
    local conflicts

    conflicts="$(git -C "$REPO_ROOT" ls-files --unmerged)"

    if [[ -n "$conflicts" ]]; then
        warn "Unresolved index conflicts detected:"
        printf '%s\n' "$conflicts" >&2
        return 1
    fi

    return 0
}

check_working_tree() {
    local status

    check_conflicts ||
        die "Resolve conflicts before pushing."

    status="$(
        git -C "$REPO_ROOT" status \
            --porcelain=v1 --untracked-files=all
    )"

    if [[ -n "$status" ]]; then
        warn "Uncommitted or untracked files were detected:"
        git -C "$REPO_ROOT" status --short
        die "Push cancelled. Review and safely preserve changes first."
    fi

    log "Working tree is clean."
}

check_upstream() {
    local upstream

    upstream="$(
        git -C "$REPO_ROOT" rev-parse \
            --abbrev-ref --symbolic-full-name '@{upstream}' \
            2>/dev/null || true
    )"

    if [[ -n "$upstream" ]]; then
        log "Configured upstream: $upstream"
    else
        log "No upstream configured for the current branch."
        log "The destination will be specified explicitly."
    fi
}

show_preview() {
    printf '\n--- Push plan ---\n'
    printf 'Repository: %s\n' "$REPO_ROOT"
    printf 'Remote:     %s\n' "$REMOTE"
    printf 'Branch:     %s\n' "$BRANCH"
    printf 'Commit:     %s\n' "$HEAD_BEFORE"
    printf 'Refspec:    HEAD:refs/heads/%s\n' "$BRANCH"

    printf '\n--- Commits being considered ---\n'

    if git -C "$REPO_ROOT" show-ref --verify --quiet "$REMOTE_REF"; then
        git -C "$REPO_ROOT" log \
            --oneline --decorate \
            "$REMOTE_REF..HEAD" || true
    else
        git -C "$REPO_ROOT" log \
            --oneline --decorate -10 HEAD
        log "Remote-tracking branch not found; remote existence will be checked during preflight."
    fi
}

fetch_remote() {
    log "Fetching remote references for preflight..."

    # Fetch updates local remote-tracking references but does not push.
    # It may change .git metadata and requires network access.
    git -C "$REPO_ROOT" fetch --no-tags "$REMOTE" ||
        die "Fetch failed. Check remote access, network connectivity, and credentials."

    log "Remote fetch completed."
}

check_remote_ancestry() {
    local remote_oid
    local local_oid

    local_oid="$(git -C "$REPO_ROOT" rev-parse HEAD)"
    remote_oid=""

    if git -C "$REPO_ROOT" show-ref --verify --quiet "$REMOTE_REF"; then
        remote_oid="$(git -C "$REPO_ROOT" rev-parse "$REMOTE_REF")"
    fi

    if [[ -z "$remote_oid" ]]; then
        if [[ "${PUSH_ALLOW_NEW_BRANCH:-false}" != "true" ]]; then
            die "Remote-tracking branch '$REMOTE_REF' does not exist. If this is an intentional new branch, review it and set PUSH_ALLOW_NEW_BRANCH=true."
        fi

        log "New remote branch explicitly permitted."
        REMOTE_OID_BEFORE=""
        return 0
    fi

    REMOTE_OID_BEFORE="$remote_oid"

    if [[ "$remote_oid" == "$local_oid" ]]; then
        log "Remote branch already points to HEAD. Nothing new to push."
        return 2
    fi

    if git -C "$REPO_ROOT" merge-base --is-ancestor \
        "$remote_oid" "$local_oid"; then
        log "Fast-forward preflight passed."
        return 0
    fi

    if git -C "$REPO_ROOT" merge-base --is-ancestor \
        "$local_oid" "$remote_oid"; then
        die "Remote branch is ahead of local HEAD. Integrate remote commits before pushing."
    fi

    die "Local and remote histories have diverged. Reconcile them safely before pushing."
}

check_state_unchanged() {
    local current_head

    current_head="$(git -C "$REPO_ROOT" rev-parse HEAD)"

    [[ "$current_head" == "$HEAD_BEFORE" ]] ||
        die "Local HEAD changed during preflight. Restart the push check."

    check_working_tree
}

push_dry_run() {
    check_working_tree
    show_preview
    fetch_remote

    local ancestry_result=0
    check_remote_ancestry || ancestry_result=$?

    if [[ "$ancestry_result" -eq 2 ]]; then
        log "No push necessary: remote already matches local HEAD."
        return 0
    elif [[ "$ancestry_result" -ne 0 ]]; then
        die "Remote ancestry validation failed."
    fi

    check_state_unchanged

    log "Running Git's push dry-run..."

    git -C "$REPO_ROOT" push \
        --dry-run \
        --porcelain \
        "$REMOTE" \
        "HEAD:refs/heads/$BRANCH" ||
        die "Git push dry-run failed."

    log "Dry-run completed. No remote branch update was requested."
}

push_for_real() {
    local ancestry_result=0
    local confirmation

    check_working_tree
    show_preview
    fetch_remote

    check_remote_ancestry || ancestry_result=$?

    if [[ "$ancestry_result" -eq 2 ]]; then
        log "No push necessary: remote already matches local HEAD."
        return 0
    elif [[ "$ancestry_result" -ne 0 ]]; then
        die "Remote ancestry validation failed."
    fi

    check_state_unchanged

    printf '\n'
    warn "You are about to push committed code to a remote repository."
    warn "Verify the destination, commit contents, and branch protection."
    printf 'Type exactly PUSH-%s to continue: ' "$BRANCH"

    IFS= read -r confirmation ||
        die "Confirmation was not received."

    [[ "$confirmation" == "PUSH-$BRANCH" ]] ||
        die "Confirmation failed. No push was performed."

    # Recheck local state after confirmation.
    check_state_unchanged

    # Refresh and recheck the remote immediately before pushing.
    # This reduces, but cannot eliminate, races with other writers.
    fetch_remote

    local ancestry_result_after_fetch=0
    check_remote_ancestry || ancestry_result_after_fetch=$?

    if [[ "$ancestry_result_after_fetch" -eq 2 ]]; then
        log "Remote now matches local HEAD. No push necessary."
        return 0
    elif [[ "$ancestry_result_after_fetch" -ne 0 ]]; then
        die "Remote changed or ancestry validation failed. No push performed."
    fi

    check_state_unchanged

    git -C "$REPO_ROOT" push \
        --porcelain \
        "$REMOTE" \
        "HEAD:refs/heads/$BRANCH" ||
        die "Push failed. Review the remote state before retrying."

    log "Git push completed successfully."
    log "Pushed commit: $HEAD_BEFORE"
    warn "No deployment or release publication was performed."
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
            return 0
            ;;
        --check|--dry-run|--push)
            ;;
        *)
            usage
            die "Unknown option: $MODE"
            ;;
    esac

    require_git_repository
    resolve_branch
    check_remote
    check_commit
    check_upstream

    case "$MODE" in
        --check)
            check_conflicts ||
                die "Resolve conflicts before proceeding."

            git -C "$REPO_ROOT" status --short --branch

            log "Check completed. No push or fetch performed."
            ;;

        --dry-run)
            push_dry_run
            ;;

        --push)
            push_for_real
            ;;
    esac
}

main "$@"