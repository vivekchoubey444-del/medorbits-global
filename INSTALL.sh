#!/usr/bin/env bash
# ============================================================
# MedOrbits Safe Cleanup Utility
# File: /CLEAN.sh
#
# Purpose:
#   Identify and optionally remove selected generated artifacts
#   without deleting source files or modifying Git history.
#
# Commands:
#   preview       List cleanup candidates (default)
#   clean         Same as preview; no files are deleted
#   status        Show Git status and candidate directories
#   help          Display usage
#
# Options:
#   --root PATH       Project root
#   --execute         Actually remove approved generated directories
#   --include-cache   Also allow selected cache directories
#   --yes             Skip confirmation (requires --execute)
#
# Safety:
#   - Preview-only by default.
#   - Never runs git clean, git reset, checkout, or stash.
#   - Never deletes source, configuration, or Git metadata.
#   - Refuses to clean the project root or filesystem root.
#   - Does not follow symlinks when checking cleanup targets.
#   - Only considers explicitly listed generated directories.
#
# Requirements:
#   Bash 4+, find, and optionally Git.
#
# Examples:
#   ./CLEAN.sh
#   ./CLEAN.sh status
#   ./CLEAN.sh --execute
#   ./CLEAN.sh --execute --include-cache
#   ./CLEAN.sh --root /path/to/MedOrbits
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
readonly SCRIPT_NAME="CLEAN.sh"
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
COMMAND="preview"
EXECUTE=0
INCLUDE_CACHE=0
ASSUME_YES=0
REMOVED=0
SKIPPED=0
ERRORS=0
log() {
    printf '[CLEAN] %s\n' "$*"
}
warn() {
    printf '[WARN] %s\n' "$*" >&2
}
error() {
    ERRORS=$((ERRORS + 1))
    printf '[ERROR] %s\n' "$*" >&2
}
die() {
    error "$*"
    exit 1
}
usage() {
    cat <<'USAGE'
MedOrbits Safe Cleanup Utility
Usage:
  ./CLEAN.sh [options] [command]
Commands:
  preview       Preview generated directories (default)
  clean         Preview only; does not delete files
  status        Show Git status and cleanup candidates
  help          Show this help
Options:
  --root PATH       Project root directory
  --execute         Enable deletion of approved generated directories
  --include-cache   Include selected cache directories
  --yes             Skip confirmation; only valid with --execute
  --help            Show this help
Approved build-output targets:
  dist
  build
  coverage
  .next
  .nuxt
  .output
  playwright-report
  test-results
Optional cache targets (requires --include-cache):
  .pytest_cache
  .mypy_cache
  .ruff_cache
  htmlcov
Examples:
  ./CLEAN.sh
  ./CLEAN.sh status
  ./CLEAN.sh --execute
  ./CLEAN.sh --execute --include-cache
  ./CLEAN.sh --execute --yes
Important:
  - Without --execute, nothing is deleted.
  - node_modules, .git, uploads, storage, backups, source code,
    environment files, and user data are never cleanup targets.
  - Review your Git status and make a backup before executing cleanup.
USAGE
}
parse_args() {
    local -a positional=()
    while (($#)); do
        case "$1" in
            --root)
                (($# >= 2)) || die "--root requires a path."
                PROJECT_ROOT="$2"
                shift 2
                ;;
            --execute)
                EXECUTE=1
                shift
                ;;
            --include-cache)
                INCLUDE_CACHE=1
                shift
                ;;
            --yes)
                ASSUME_YES=1
                shift
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            preview|clean|status|help)
                positional+=("$1")
                shift
                ;;
            *)
                die "Unknown option or command: $1"
                ;;
        esac
    done
    ((${#positional[@]} <= 1)) || die "Specify only one command."
    if ((${#positional[@]} == 1)); then
        COMMAND="${positional[0]}"
    fi
    if ((ASSUME_YES && !EXECUTE)); then
        die "--yes requires --execute."
    fi
}
canonicalize_root() {
    [[ -d "$PROJECT_ROOT" ]] || die "Project root does not exist."
    PROJECT_ROOT="$(cd -- "$PROJECT_ROOT" && pwd -P)"
    [[ "$PROJECT_ROOT" != "/" ]] || die "Refusing to operate on filesystem root."
    [[ -f "$PROJECT_ROOT/package.json" ]] || warn "package.json not found; confirm this is the intended project."
}
check_git_status() {
    if ! command -v git >/dev/null 2>&1; then
        warn "Git is unavailable; cannot inspect repository status."
        return 0
    fi
    if ! git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        warn "Project root is not inside a Git working tree."
        return 0
    fi
    local status
    status="$(git -C "$PROJECT_ROOT" status --short 2>/dev/null || true)"
    if [[ -z "$status" ]]; then
        log "Git working tree reports no changes."
    else
        warn "Git reports changes. Review these before cleanup:"
        printf '%s\n' "$status" | sed -n '1,40p'
        if [[ "$(printf '%s\n' "$status" | wc -l | tr -d ' ')" -gt 40 ]]; then
            log "Git status output truncated to 40 lines."
        fi
    fi
    local unmerged
    unmerged="$(git -C "$PROJECT_ROOT" diff --name-only --diff-filter=U 2>/dev/null || true)"
    if [[ -n "$unmerged" ]]; then
        warn "Unmerged Git paths exist. Resolve or back up the repository before cleanup."
        printf '%s\n' "$unmerged"
    fi
}
candidate_exists() {
    local name="$1"
    local path="${PROJECT_ROOT}/${name}"
    # Require a direct child of the project root.
    [[ "$(dirname -- "$path")" == "$PROJECT_ROOT" ]] || return 1
    # Never treat symlinks as removable cleanup targets.
    [[ ! -L "$path" && -d "$path" ]]
}
get_candidates() {
    local -a targets=(
        "dist"
        "build"
        "coverage"
        ".next"
        ".nuxt"
        ".output"
        "playwright-report"
        "test-results"
    )
    if ((INCLUDE_CACHE)); then
        targets+=(
            ".pytest_cache"
            ".mypy_cache"
            ".ruff_cache"
            "htmlcov"
        )
    fi
    printf '%s\n' "${targets[@]}"
}
preview_candidates() {
    log "Project root: $PROJECT_ROOT"
    log "Mode: $([[ "$EXECUTE" -eq 1 ]] && printf 'EXECUTE' || printf 'PREVIEW ONLY')"
    local name
    local path
    local found=0
    while IFS= read -r name; do
        path="${PROJECT_ROOT}/${name}"
        if candidate_exists "$name"; then
            found=1
            local size
            size="$(du -sh -- "$path" 2>/dev/null | awk '{print $1}' || printf 'unknown')"
            printf '[CANDIDATE] %s (%s)\n' "$name" "$size"
        elif [[ -L "$path" ]]; then
            printf '[SKIP] %s is a symlink.\n' "$name"
            SKIPPED=$((SKIPPED + 1))
        fi
    done < <(get_candidates)
    if ((found == 0)); then
        log "No approved cleanup directories found."
    fi
    cat <<'NOTICE'
Protected paths include:
  .git, node_modules, backups, uploads, storage, .env*,
  api, src, assets, education, routes, controllers, tests,
  package files, lockfiles, and all unlisted directories.
NOTICE
    if ((EXECUTE == 0)); then
        log "Preview complete. No files were deleted."
        log "To remove the listed targets, review them and run: $SCRIPT_NAME --execute"
    fi
}
confirm_execution() {
    ((EXECUTE)) || return 0
    ((ASSUME_YES)) && return 0
    [[ -t 0 ]] || die "Interactive confirmation unavailable. Run with --execute --yes only after reviewing the targets."
    printf '\nThis will permanently remove the listed generated directories.\n'
    printf 'Confirm you have reviewed the Git status and backed up important work.\n'
    printf 'Type CLEAN to continue: '
    local answer
    IFS= read -r answer
    [[ "$answer" == "CLEAN" ]] || die "Cleanup cancelled."
}
execute_cleanup() {
    confirm_execution
    local name
    local path
    while IFS= read -r name; do
        path="${PROJECT_ROOT}/${name}"
        if ! candidate_exists "$name"; then
            continue
        fi
        # Revalidate target immediately before removal.
        [[ "$(dirname -- "$path")" == "$PROJECT_ROOT" ]] || {
            error "Rejected target outside project root: $name"
            continue
        }
        [[ ! -L "$path" && -d "$path" ]] || {
            warn "Target changed or is a symlink; skipping: $name"
            SKIPPED=$((SKIPPED + 1))
            continue
        }
        case "$name" in
            dist|build|coverage|.next|.nuxt|.output|playwright-report|test-results)
                ;;
            .pytest_cache|.mypy_cache|.ruff_cache|htmlcov)
                ((INCLUDE_CACHE)) || {
                    warn "Cache target not enabled; skipping: $name"
                    SKIPPED=$((SKIPPED + 1))
                    continue
                }
                ;;
            *)
                error "Rejected unapproved cleanup target: $name"
                continue
                ;;
        esac
        log "Removing generated directory: $name"
        if rm -r -- "$path"; then
            REMOVED=$((REMOVED + 1))
        else
            error "Failed to remove: $name"
        fi
    done < <(get_candidates)
    printf '\n[CLEAN] Removed: %s; skipped: %s; errors: %s\n' \
        "$REMOVED" "$SKIPPED" "$ERRORS"
    ((ERRORS == 0))
}
main() {
    parse_args "$@"
    canonicalize_root
    case "$COMMAND" in
        help)
            usage
            return 0
            ;;
        status)
            check_git_status
            preview_candidates
            ;;
        preview|clean)
            check_git_status
            preview_candidates
            if ((EXECUTE)); then
                execute_cleanup
            fi
            ;;
        *)
            die "Unknown command: $COMMAND"
            ;;
    esac
}
main "$@"