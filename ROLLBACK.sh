#!/usr/bin/env bash

============================================================

MedOrbits -- Conservative Git Recovery and Rollback Helper

File: /ROLLBACK.sh

Version: 2.0.0

Purpose:

Inspect repository state, preview tracked-file restoration,

create a verified external backup, and safely restore tracked

files to the current HEAD without rewriting Git history.

Commands:

bash ROLLBACK.sh –status

bash ROLLBACK.sh –preview

bash ROLLBACK.sh –backup

bash ROLLBACK.sh –restore

bash ROLLBACK.sh –help

Safety policy:

- Status is the default and makes no repository changes.

- Preview does not modify repository files.

- Backup is created outside the repository by default.

- Backup includes working files, including untracked and

ignored files, but excludes Git metadata.

- Backup archives may contain secrets. Protect them.

- Restore requires an explicit typed confirmation.

- Restore refuses unresolved merge conflicts.

- Restore requires a successfully verified backup.

- Restore targets tracked files only; it does not reset HEAD,

switch branches, delete untracked files intentionally,

rewrite history, commit, or push.

- Existing untracked files can obstruct restoration. The

pre-restore archive provides a recovery copy, but users

should inspect the preview before continuing.

Requirements:

Bash 4+, Git, tar, gzip, and standard Unix utilities.

============================================================

set -Eeuo pipefail
IFS=$’\n\t’
umask 077

readonly SCRIPT_NAME="${0##*/}"
readonly SCRIPT_VERSION="2.0.0"

MODE="–status"
REPO_ROOT=""
BACKUP_DIR=""
BACKUP_ARCHIVE=""
TIMESTAMP="$(date ‘+%Y%m%d-%H%M%S’)"
BACKUP_CREATED=0
TEMP_PATHS=()

----------------------------------------

Logging and error handling

----------------------------------------

log() {
printf ‘[INFO] %s\n’ "$*"
}

warn() {
printf ‘[WARN] %s\n’ "$*" >&2
}

die() {
printf ‘[ERROR] %s\n’ "$*" >&2
exit 1
}

cleanup() {
local path

for path in "${TEMP_PATHS[@]:-}"; do
    if [[ -n "$path" && -e "$path" ]]; then
        rm -f -- "$path" 2>/dev/null || true
    fi
done

}

on_error() {
local exit_code=$?
local line_number="${1:-unknown}"

printf '[ERROR] %s failed near line %s (exit %s).\n' \
    "$SCRIPT_NAME" "$line_number" "$exit_code" >&2
if [[ "$MODE" == "--restore" ]]; then
    warn "Inspect Git status before attempting another recovery."
    warn "If restoration began, use the verified backup if needed."
fi
exit "$exit_code"

}

trap cleanup EXIT
trap ‘on_error "$LINENO"’ ERR

----------------------------------------

Usage

----------------------------------------

usage() {
cat <<‘USAGE’
MedOrbits -- Conservative Git Recovery and Rollback Helper

Usage:
bash ROLLBACK.sh [COMMAND]

Commands:
–status    Display branch, HEAD, changes, and conflict status
–preview   Preview tracked-file restoration and affected paths
–backup    Create and verify an external working-file backup
–restore   Back up, confirm, and restore tracked files to HEAD
–help      Display this help

Environment:
ROLLBACK_BACKUP_DIR
Optional backup destination. Must be outside the repository.

Examples:
bash ROLLBACK.sh –status
bash ROLLBACK.sh –preview
bash ROLLBACK.sh –backup
ROLLBACK_BACKUP_DIR="$HOME/MedOrbits-Recovery" 
bash ROLLBACK.sh –backup

Restore safety:

1. Review –status and –preview.
2. Back up important work externally.
3. Resolve or separately preserve merge conflicts.
4. Run –restore and read the confirmation prompt carefully.

The restore operation targets tracked files using the current HEAD.
It does not reset commits, change branches, commit, or push.

The archive can contain credentials, private documents, .env files,
ignored files, and other sensitive data. Store it securely.
USAGE
}

----------------------------------------

Dependency and repository checks

----------------------------------------

require_command() {
command -v "$1" >/dev/null 2>&1 ||
die "Required command not found: $1"
}

check_dependencies() {
local command_name

for command_name in git tar gzip date mkdir chmod mktemp; do
    require_command "$command_name"
done

}

find_repo_root() {
require_command git

git rev-parse --show-toplevel 2>/dev/null ||
    die "Run this script from inside a Git repository."

}

ensure_repository_has_commit() {
git -C "$REPO_ROOT" rev-parse –verify HEAD >/dev/null 2>&1 ||
die "This repository has no valid HEAD commit. Nothing to restore."
}

ensure_worktree_available() {
if [[ ! -d "$REPO_ROOT/.git" && ! -f "$REPO_ROOT/.git" ]]; then
# Git worktrees can have a .git file, so validate through Git.
git -C "$REPO_ROOT" rev-parse –git-dir >/dev/null 2>&1 ||
die "Cannot identify this repository’s Git metadata."
fi

git -C "$REPO_ROOT" rev-parse --is-inside-work-tree 2>/dev/null |
    grep -qx true ||
    die "The selected directory is not a Git working tree."

}

----------------------------------------

Repository state

----------------------------------------

current_branch() {
local branch

branch="$(git -C "$REPO_ROOT" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
if [[ -n "$branch" ]]; then
    printf '%s\n' "$branch"
else
    printf '%s\n' '(detached HEAD)'
fi

}

current_head() {
git -C "$REPO_ROOT" rev-parse –short HEAD 2>/dev/null ||
printf ‘%s\n’ ‘(unavailable)’
}

has_unmerged_paths() {
local output

output="$(git -C "$REPO_ROOT" diff --name-only --diff-filter=U)" ||
    die "Unable to inspect merge-conflict state."
[[ -n "$output" ]]

}

show_status() {
log "Repository: $REPO_ROOT"
log "Script version: $SCRIPT_VERSION"
log "Branch: $(current_branch)"
log "HEAD: $(current_head)"

printf '\n--- Git status ---\n'
git -C "$REPO_ROOT" status --short --branch
printf '\n--- Unmerged paths ---\n'
if has_unmerged_paths; then
    git -C "$REPO_ROOT" diff --name-only --diff-filter=U
    warn "Unresolved conflicts detected. Restore mode refuses to proceed."
else
    printf 'No unmerged paths reported by Git.\n'
fi
printf '\n--- Unstaged tracked changes ---\n'
git -C "$REPO_ROOT" diff --stat
printf '\n--- Staged changes ---\n'
git -C "$REPO_ROOT" diff --cached --stat
printf '\n--- Untracked files ---\n'
git -C "$REPO_ROOT" ls-files --others --exclude-standard
printf '\n--- Ignored files ---\n'
git -C "$REPO_ROOT" ls-files --others --ignored --exclude-standard

}

----------------------------------------

Restore preview

----------------------------------------

preview_restore() {
printf ‘%s\n’ 
‘-- Preview: tracked working-tree changes --’ 
‘Review the following paths before using restore mode.’

printf '\n--- Unstaged tracked changes ---\n'
git -C "$REPO_ROOT" diff --name-status
printf '\n--- Staged changes ---\n'
git -C "$REPO_ROOT" diff --cached --name-status
printf '\n--- Deleted tracked paths ---\n'
git -C "$REPO_ROOT" ls-files --deleted
printf '\n--- Untracked files (not deliberately deleted) ---\n'
git -C "$REPO_ROOT" ls-files --others --exclude-standard
printf '\n--- Ignored files (not deliberately deleted) ---\n'
git -C "$REPO_ROOT" ls-files --others --ignored --exclude-standard
printf '\n--- Restore plan ---\n'
cat <<'PLAN'

1. Stop and inspect any unresolved merge conflicts.
2. Create an external archive backup of the working files.
3. Verify the archive can be listed successfully.
4. Require explicit typed confirmation.
5. Restore tracked working-tree and index files from current HEAD.
6. Report the final repository status.

Important:

* Staged changes will be discarded from the index.
* Unstaged tracked changes will be discarded.
* Deleted tracked files will be restored if present in HEAD.
* Untracked files are not intentionally removed, but may obstruct
    restoration of tracked paths. Inspect conflicts and backups first.
* Branches, commits, and remote history are not reset or rewritten.
    PLAN
    }

----------------------------------------

Backup path validation

----------------------------------------

path_is_inside_repository() {
local candidate="$1"
local relative

relative="$(python3 - "$REPO_ROOT" "$candidate" <<'PY'

import os
import sys

root = os.path.realpath(sys.argv[1])
candidate = os.path.realpath(sys.argv[2])

try:
common = os.path.commonpath([root, candidate])
except ValueError:
sys.exit(1)

if common == root:
print("yes")
else:
print("no")
PY
)" || return 1

[[ "$relative" == "yes" ]]

}

prepare_backup_directory() {
local requested_dir
local parent_dir

parent_dir="$(dirname "$REPO_ROOT")"
requested_dir="${ROLLBACK_BACKUP_DIR:-"$parent_dir/rollback-backups"}"
# Resolve relative paths against the caller's current directory.
if [[ "$requested_dir" != /* ]]; then
    requested_dir="$PWD/$requested_dir"
fi
mkdir -p -- "$requested_dir"
BACKUP_DIR="$(cd "$requested_dir" && pwd -P)"
if path_is_inside_repository "$BACKUP_DIR"; then
    die "Backup destination must be outside the repository: $BACKUP_DIR"
fi
chmod 700 "$BACKUP_DIR" ||
    die "Cannot restrict permissions on backup directory: $BACKUP_DIR"

}

----------------------------------------

Archive creation and verification

----------------------------------------

create_backup() {
local archive_name
local partial_archive
local manifest_file
local status_file
local head_file
local branch_file

check_dependencies
prepare_backup_directory
archive_name="$(basename "$REPO_ROOT")-$TIMESTAMP.tar.gz"
BACKUP_ARCHIVE="$BACKUP_DIR/$archive_name"
[[ ! -e "$BACKUP_ARCHIVE" ]] ||
    die "Backup already exists: $BACKUP_ARCHIVE"
partial_archive="$(mktemp "$BACKUP_DIR/.rollback-backup.XXXXXX")"
TEMP_PATHS+=("$partial_archive")
manifest_file="$(mktemp "$BACKUP_DIR/.rollback-manifest.XXXXXX")"
TEMP_PATHS+=("$manifest_file")
status_file="$(mktemp "$BACKUP_DIR/.rollback-status.XXXXXX")"
TEMP_PATHS+=("$status_file")
head_file="$(mktemp "$BACKUP_DIR/.rollback-head.XXXXXX")"
TEMP_PATHS+=("$head_file")
branch_file="$(mktemp "$BACKUP_DIR/.rollback-branch.XXXXXX")"
TEMP_PATHS+=("$branch_file")
log "Repository: $REPO_ROOT"
log "Backup directory: $BACKUP_DIR"
log "Preparing working-file archive..."
# Capture repository state separately for recovery diagnostics.
git -C "$REPO_ROOT" status --porcelain=v2 --branch > "$status_file"
git -C "$REPO_ROOT" rev-parse HEAD > "$head_file"
current_branch > "$branch_file"
{
    printf 'MedOrbits rollback backup\n'
    printf 'Created: %s\n' "$(date -Is)"
    printf 'Repository: %s\n' "$REPO_ROOT"
    printf 'Branch: %s\n' "$(cat "$branch_file")"
    printf 'HEAD: %s\n' "$(cat "$head_file")"
    printf '\nGit status:\n'
    cat "$status_file"
    printf '\nArchive contents:\n'
    printf 'Working files excluding Git metadata.\n'
} > "$manifest_file"
# The archive can contain secrets. The backup directory is private.
# Exclude repository Git metadata and the archive destination.
tar -czf "$partial_archive" \
    --exclude='./.git' \
    --exclude='./.git/*' \
    --exclude='*/.git' \
    --exclude='*/.git/*' \
    -C "$REPO_ROOT" .
[[ -s "$partial_archive" ]] ||
    die "Backup archive is empty or missing."
gzip -t "$partial_archive" ||
    die "Backup archive failed gzip integrity verification."
tar -tzf "$partial_archive" >/dev/null ||
    die "Backup archive listing verification failed."
chmod 600 "$partial_archive" ||
    die "Cannot restrict permissions on backup archive."
mv -- "$partial_archive" "$BACKUP_ARCHIVE"
BACKUP_CREATED=1
# Keep a small recovery manifest beside the archive.
local final_manifest="${BACKUP_ARCHIVE%.tar.gz}.manifest.txt"
local final_status="${BACKUP_ARCHIVE%.tar.gz}.git-status.txt"
local final_head="${BACKUP_ARCHIVE%.tar.gz}.head.txt"
local final_branch="${BACKUP_ARCHIVE%.tar.gz}.branch.txt"
cp -- "$manifest_file" "$final_manifest"
cp -- "$status_file" "$final_status"
cp -- "$head_file" "$final_head"
cp -- "$branch_file" "$final_branch"
chmod 600 \
    "$final_manifest" \
    "$final_status" \
    "$final_head" \
    "$final_branch"
log "Backup created and verified."
log "Archive: $BACKUP_ARCHIVE"
log "Manifest: $final_manifest"
log "Git status snapshot: $final_status"
log "HEAD snapshot: $final_head"
warn "The backup may contain secrets, private documents, and ignored files."
warn "Keep it private and do not commit it to the repository."

}

----------------------------------------

Restore safety checks

----------------------------------------

check_restore_prerequisites() {
ensure_repository_has_commit
ensure_worktree_available

if has_unmerged_paths; then
    die "Unresolved merge conflicts detected. Preserve or resolve them before restoring."
fi
if [[ -n "$(git -C "$REPO_ROOT" rev-parse --verify HEAD 2>/dev/null || true)" ]]; then
    log "Current HEAD: $(git -C "$REPO_ROOT" rev-parse HEAD)"
fi

}

confirm_restore() {
local confirmation

printf '\n'
warn "This operation discards staged and unstaged changes to tracked files."
warn "It may replace untracked paths that obstruct restoration."
warn "A verified archive backup will be created immediately beforehand."
printf '\n'
git -C "$REPO_ROOT" status --short --branch
printf '\nType exactly RESTORE-TRACKED-FILES to continue: '
IFS= read -r confirmation ||
    die "No confirmation received."
[[ "$confirmation" == "RESTORE-TRACKED-FILES" ]] ||
    die "Confirmation did not match. No restore performed."

}

restore_tracked_files() {
check_restore_prerequisites

printf '%s\n' '--- Restore preview ---'
preview_restore
confirm_restore
# Create the backup only after explicit confirmation, but before
# any operation that can discard tracked changes.
create_backup
[[ "$BACKUP_CREATED" -eq 1 && -s "$BACKUP_ARCHIVE" ]] ||
    die "No verified backup exists. Restore cancelled."
log "Restoring tracked files from current HEAD..."
git -C "$REPO_ROOT" restore \
    --source=HEAD \
    --worktree \
    --staged \
    -- .
log "Git restore command completed."
printf '\n--- Final status ---\n'
git -C "$REPO_ROOT" status --short --branch
printf '\n--- Recovery backup ---\n'
printf '%s\n' "$BACKUP_ARCHIVE"
log "No branch reset, commit rewrite, commit, or push was performed."
warn "Review final status. If anything unexpected occurred, stop and inspect the backup."

}

----------------------------------------

Entry point

----------------------------------------

main() {
if [[ "$#" -gt 1 ]]; then
usage
die "Supply no more than one command."
fi

if [[ "$#" -eq 1 ]]; then
    MODE="$1"
fi
case "$MODE" in
    --help|-h)
        usage
        exit 0
        ;;
    --status|--preview|--backup|--restore)
        ;;
    *)
        usage
        die "Unknown command: $MODE"
        ;;
esac
REPO_ROOT="$(find_repo_root)"
REPO_ROOT="$(cd "$REPO_ROOT" && pwd -P)"
case "$MODE" in
    --status)
        show_status
        ;;
    --preview)
        show_status
        printf '\n'
        preview_restore
        ;;
    --backup)
        create_backup
        ;;
    --restore)
        restore_tracked_files
        ;;
esac

}

main "$@"