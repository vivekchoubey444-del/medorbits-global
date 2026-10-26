#!/usr/bin/env bash
# ============================================================
# MedOrbits Safe Restore Utility
# File: /RESTORE.sh
#
# Purpose:
#   Safely inspect repository state and create a recovery backup.
#   Optional restore uses an explicitly selected Git commit.
#
# Safety:
#   - Never runs git reset --hard
#   - Never runs git clean
#   - Never deletes user files
#   - Never commits or pushes
#   - Does not overwrite conflicted or uncommitted work
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
SCRIPT_NAME="RESTORE.sh"
TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
BACKUP_ROOT=".agent-backup/restore-${TIMESTAMP}"
log() {
  printf '[RESTORE] %s\n' "$*"
}
warn() {
  printf '[RESTORE][WARNING] %s\n' "$*" >&2
}
die() {
  printf '[RESTORE][ERROR] %s\n' "$*" >&2
  exit 1
}
command -v git >/dev/null 2>&1 ||
  die "Git is required but was not found."
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" ||
  die "Run this script from inside a Git repository."
cd "$ROOT"
show_status() {
  log "Repository: $ROOT"
  log "Current branch:"
  git branch --show-current || true
  log "HEAD commit:"
  git log -1 --format='%h %s' 2>/dev/null || true
  log "Git status:"
  git status --short --branch || true
  if git diff --name-only --diff-filter=U | grep -q .; then
    warn "Unresolved merge conflicts exist."
  fi
}
create_backup() {
  local backup_path
  backup_path="${ROOT}/${BACKUP_ROOT}"
  mkdir -p "$backup_path"
  log "Creating recovery backup in: $BACKUP_ROOT"
  # Preserve tracked changes, including staged and unstaged edits.
  git diff --binary > "$backup_path/unstaged.patch"
  git diff --cached --binary > "$backup_path/staged.patch"
  # Record the current Git state for recovery reference.
  git status --porcelain=v1 -uall \
    > "$backup_path/status.txt"
  git rev-parse HEAD > "$backup_path/head.txt"
  git branch --show-current > "$backup_path/branch.txt" || true
  git log -20 --oneline --decorate \
    > "$backup_path/recent-commits.txt"
  # Save a bundle of reachable Git history.
  if ! git bundle create "$backup_path/repository.bundle" --all; then
    warn "Git bundle creation failed. Patch and status files remain."
  fi
  # Archive untracked, non-ignored files without changing them.
  # Exclude this backup directory to avoid archiving itself.
  local untracked_list
  untracked_list="$(mktemp)"
  git ls-files --others --exclude-standard -z \
    > "$untracked_list"
  if [[ -s "$untracked_list" ]]; then
    if command -v tar >/dev/null 2>&1; then
      tar --null -T "$untracked_list" \
        -czf "$backup_path/untracked-files.tar.gz" \
        -C "$ROOT" ||
        warn "Some untracked files could not be archived."
    else
      warn "tar is unavailable; untracked files were not archived."
    fi
  else
    log "No untracked, non-ignored files found."
  fi
  rm -f "$untracked_list"
  cat > "$backup_path/README.txt" <<EOF
MedOrbits recovery backup
Created: ${TIMESTAMP}
Repository: ${ROOT}
Contents:
- unstaged.patch: tracked unstaged changes
- staged.patch: staged changes
- status.txt: Git status including untracked paths
- head.txt: original HEAD commit
- branch.txt: original branch
- recent-commits.txt: recent commit history
- repository.bundle: reachable Git history, if bundle creation succeeded
- untracked-files.tar.gz: untracked non-ignored files, if any
This backup does not include ignored files, Git LFS object contents,
submodule working-tree contents, or uncommitted changes inside submodules.
Keep a separate copy outside the repository for stronger protection.
EOF
  log "Backup step completed: $BACKUP_ROOT"
  warn "This backup is inside the repository. Copy it elsewhere before risky Git operations."
}
restore_commit() {
  local target="${1:-}"
  [[ -n "$target" ]] ||
    die "Usage: ./RESTORE.sh restore-commit <commit-hash>"
  git cat-file -e "${target}^{commit}" 2>/dev/null ||
    die "The requested commit does not exist in this repository."
  if [[ -n "$(git status --porcelain)" ]]; then
    die "Working tree is not clean. Save your changes and resolve conflicts first. No files were changed."
  fi
  warn "This will create a new branch at the selected historical commit."
  warn "It will not move or reset your current branch."
  local safe_target
  safe_target="$(git rev-parse --short "$target")"
  local restore_branch="recovery/${safe_target}-${TIMESTAMP}"
  git switch -c "$restore_branch" "$target"
  log "Created recovery branch: $restore_branch"
  log "Your original branch remains available."
  log "Review the files before taking any further action."
}
case "${1:-inspect}" in
  inspect)
    show_status
    ;;
  backup)
    show_status
    create_backup
    ;;
  restore-commit)
    show_status
    create_backup
    restore_commit "${2:-}"
    ;;
  help|-h|--help)
    cat <<'HELP'
MedOrbits Safe Restore Utility
Usage:
  ./RESTORE.sh                 Inspect repository state
  ./RESTORE.sh inspect         Inspect repository state
  ./RESTORE.sh backup          Create a recovery backup
  ./RESTORE.sh restore-commit HASH
                               Back up, then create a new branch
                               at HASH if the working tree is clean
  ./RESTORE.sh help            Show this help
This script never pushes, commits, resets hard, or runs git clean.
Always keep a backup outside the repository before recovery work.
HELP
    ;;
  *)
    die "Unknown command: $1. Run ./RESTORE.sh help."
    ;;
esac