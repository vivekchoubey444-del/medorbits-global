#!/usr/bin/env bash
# ============================================================
# MedOrbits Safe Restore Utility
# File: /RESTORE.sh
#
# Purpose:
#   Inspect repository state, create verified recovery backups,
#   and optionally create a new branch at a selected Git commit.
#
# Safety:
#   - Never runs git reset --hard
#   - Never runs git clean
#   - Never commits or pushes
#   - Never deletes repository files
#   - Never overwrites conflicted or uncommitted work
#   - Checks cleanliness before restore-commit backup/branch work
#   - Verifies backup artifacts where possible
#   - Preserves untracked, non-ignored files in an archive
#
# Usage:
#   bash RESTORE.sh
#   bash RESTORE.sh inspect
#   bash RESTORE.sh backup
#   bash RESTORE.sh restore-commit COMMIT_HASH
#   bash RESTORE.sh help
#
# Optional:
#   RESTORE_BACKUP_DIR=/absolute/path bash RESTORE.sh backup
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
SCRIPT_NAME="RESTORE.sh"
TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
ROOT=""
BACKUP_PATH=""
TEMP_DIR=""
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
cleanup() {
  if [[ -n "${TEMP_DIR:-}" && -d "$TEMP_DIR" ]]; then
    rm -rf -- "$TEMP_DIR"
  fi
}
trap cleanup EXIT
command -v git >/dev/null 2>&1 ||
  die "Git is required but was not found."
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" ||
  die "Run this script from inside a Git repository."
ROOT="$(cd "$ROOT" && pwd -P)"
cd "$ROOT"
# Keep backups outside the repository by default.
# An explicit RESTORE_BACKUP_DIR overrides the default.
if [[ -n "${RESTORE_BACKUP_DIR:-}" ]]; then
  BACKUP_PARENT="$RESTORE_BACKUP_DIR"
else
  BACKUP_PARENT="$(dirname "$ROOT")/.agent-backups"
fi
show_status() {
  log "Repository: $ROOT"
  log "Current branch:"
  git branch --show-current || true
  log "HEAD commit:"
  git log -1 --format='%h %s' 2>/dev/null ||
    warn "Unable to read the latest commit."
  log "Git status:"
  git status --short --branch ||
    warn "Unable to read Git status."
  if git diff --name-only --diff-filter=U | grep -q .; then
    warn "Unresolved merge conflicts exist."
  fi
  if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
    log "Working tree has changes."
  else
    log "Working tree is clean."
  fi
  log "Untracked, non-ignored files:"
  git ls-files --others --exclude-standard ||
    warn "Unable to enumerate untracked files."
}
verify_file() {
  local file="$1"
  [[ -f "$file" && -r "$file" ]] ||
    die "Required backup artifact is missing or unreadable: $file"
}
verify_backup() {
  local path="$1"
  log "Verifying backup artifacts..."
  verify_file "$path/unstaged.patch"
  verify_file "$path/staged.patch"
  verify_file "$path/status.txt"
  verify_file "$path/head.txt"
  verify_file "$path/branch.txt"
  verify_file "$path/recent-commits.txt"
  verify_file "$path/README.txt"
  if [[ -f "$path/repository.bundle" ]]; then
    git bundle verify "$path/repository.bundle" ||
      die "Git bundle verification failed."
  else
    warn "Git bundle is unavailable; commit-history backup is incomplete."
  fi
  if [[ -f "$path/untracked-files.tar.gz" ]]; then
    command -v tar >/dev/null 2>&1 ||
      die "tar is required to verify the untracked-files archive."
    tar -tzf "$path/untracked-files.tar.gz" >/dev/null ||
      die "Untracked-file archive verification failed."
  fi
  log "Required backup files verified."
}
create_backup() {
  local backup_name
  local untracked_list
  local backup_head
  command -v tar >/dev/null 2>&1 ||
    die "tar is required to create a recovery backup."
  mkdir -p "$BACKUP_PARENT"
  BACKUP_PARENT="$(cd "$BACKUP_PARENT" && pwd -P)"
  # Prevent the backup directory from being created inside the repository.
  case "$BACKUP_PARENT/" in
    "$ROOT/"*)
      die "Backup directory must be outside the repository: $BACKUP_PARENT"
      ;;
  esac
  backup_name="$(basename "$ROOT")-restore-${TIMESTAMP}"
  BACKUP_PATH="$BACKUP_PARENT/$backup_name"
  [[ ! -e "$BACKUP_PATH" ]] ||
    die "Backup destination already exists: $BACKUP_PATH"
  mkdir -m 700 "$BACKUP_PATH"
  log "Creating recovery backup: $BACKUP_PATH"
  # Capture tracked working-tree differences.
  git diff --binary > "$BACKUP_PATH/unstaged.patch" ||
    die "Could not write unstaged patch."
  git diff --cached --binary > "$BACKUP_PATH/staged.patch" ||
    die "Could not write staged patch."
  git status --porcelain=v1 -uall > "$BACKUP_PATH/status.txt" ||
    die "Could not record Git status."
  backup_head="$(git rev-parse HEAD)" ||
    die "Could not record HEAD."
  printf '%s\n' "$backup_head" > "$BACKUP_PATH/head.txt" ||
    die "Could not write HEAD reference."
  git branch --show-current > "$BACKUP_PATH/branch.txt" ||
    die "Could not record current branch."
  git log -20 --oneline --decorate > "$BACKUP_PATH/recent-commits.txt" ||
    die "Could not record recent commits."
  # Capture reachable Git history and refs.
  if git bundle create "$BACKUP_PATH/repository.bundle" --all; then
    git bundle verify "$BACKUP_PATH/repository.bundle" ||
      die "Git bundle was created but could not be verified."
  else
    warn "Git bundle creation failed. Other backup artifacts will be retained."
  fi
  # Archive untracked, non-ignored files. Use NUL-delimited paths to
  # support filenames containing spaces or newlines.
  TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/medorbits-restore.XXXXXX")"
  untracked_list="$TEMP_DIR/untracked-files.list"
  git ls-files --others --exclude-standard -z > "$untracked_list" ||
    die "Could not enumerate untracked files."
  if [[ -s "$untracked_list" ]]; then
    tar --null -T "$untracked_list" \
      -czf "$BACKUP_PATH/untracked-files.tar.gz" \
      -C "$ROOT" ||
      die "Could not archive all untracked files."
  else
    log "No untracked, non-ignored files found."
  fi
  cat > "$BACKUP_PATH/README.txt" <<EOF
MedOrbits recovery backup
Created: ${TIMESTAMP}
Repository: ${ROOT}
Original HEAD: ${backup_head}
Contents:
- unstaged.patch: tracked unstaged changes
- staged.patch: staged changes
- status.txt: Git status including untracked paths
- head.txt: original HEAD commit
- branch.txt: original branch
- recent-commits.txt: recent commit history
- repository.bundle: reachable Git history, if bundle creation succeeded
- untracked-files.tar.gz: untracked non-ignored files, if any
Limitations:
- Ignored files are not included.
- Git LFS object contents may not be included.
- Submodule working-tree changes are not included.
- Uncommitted changes inside submodules are not included.
- This backup does not automatically restore files or Git state.
Keep another copy in a separate safe location.
EOF
  verify_backup "$BACKUP_PATH"
  log "Backup completed: $BACKUP_PATH"
  warn "Copy this backup to independent storage before risky recovery operations."
}
restore_commit() {
  local target="${1:-}"
  local safe_target
  local restore_branch
  local backup_path
  [[ -n "$target" ]] ||
    die "Usage: bash RESTORE.sh restore-commit COMMIT_HASH"
  # Validate the commit before doing any backup or branch operation.
  git cat-file -e "${target}^{commit}" 2>/dev/null ||
    die "The requested commit does not exist in this repository."
  # Do not create a recovery branch over unresolved or uncommitted work.
  if [[ -n "$(git status --porcelain)" ]]; then
    die "Working tree is not clean. No backup or branch was created. Preserve your changes and resolve conflicts first."
  fi
  if git diff --name-only --diff-filter=U | grep -q .; then
    die "Unresolved merge conflicts detected. No branch was created."
  fi
  safe_target="$(git rev-parse --short "$target")"
  restore_branch="recovery/${safe_target}-${TIMESTAMP}"
  if git show-ref --verify --quiet "refs/heads/$restore_branch"; then
    die "Recovery branch already exists: $restore_branch"
  fi
  log "Target commit: $(git show -s --format='%h %s' "$target")"
  log "Planned recovery branch: $restore_branch"
  # Back up before creating the branch.
  create_backup
  backup_path="$BACKUP_PATH"
  # Recheck cleanliness in case anything changed during backup.
  if [[ -n "$(git status --porcelain)" ]]; then
    die "Working tree changed during backup. No recovery branch was created. Backup retained at: $backup_path"
  fi
  git switch -c "$restore_branch" "$target" ||
    die "Could not create recovery branch. Backup retained at: $backup_path"
  log "Created recovery branch: $restore_branch"
  log "Original branch and commits were not reset."
  log "Recovery backup: $backup_path"
  log "Review the recovered files and run tests before further actions."
}
show_help() {
  cat <<'HELP'
MedOrbits Safe Restore Utility
Usage:
  bash RESTORE.sh
  bash RESTORE.sh inspect
  bash RESTORE.sh backup
  bash RESTORE.sh restore-commit COMMIT_HASH
  bash RESTORE.sh help
Commands:
  inspect
      Inspect current repository status. Default command.
  backup
      Create and verify a recovery backup outside the repository.
  restore-commit COMMIT_HASH
      Require a clean working tree, back up repository state, and
      create a new recovery branch at the selected commit.
  help
      Display this help.
Optional environment variable:
  RESTORE_BACKUP_DIR=/absolute/path
      Choose an external backup directory.
Safety:
  - Never runs git reset --hard.
  - Never runs git clean.
  - Never commits or pushes.
  - Does not automatically restore patches.
  - Does not intentionally delete user files.
  - Ignored files and submodule working-tree contents are not backed up.
HELP
}
case "${1:-inspect}" in
  inspect)
    [[ $# -eq 1 || $# -eq 0 ]] ||
      die "Usage: bash RESTORE.sh inspect"
    show_status
    ;;
  backup)
    [[ $# -eq 1 ]] ||
      die "Usage: bash RESTORE.sh backup"
    show_status
    create_backup
    ;;
  restore-commit)
    [[ $# -eq 2 ]] ||
      die "Usage: bash RESTORE.sh restore-commit COMMIT_HASH"
    show_status
    restore_commit "$2"
    ;;
  help|-h|--help)
    show_help
    ;;
  *)
    die "Unknown command: $1. Run bash RESTORE.sh help."
    ;;
esac