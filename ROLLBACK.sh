#!/usr/bin/env bash
# /ROLLBACK.sh
# Conservative Git rollback helper for MedOrbits.
#
# Usage:
#   bash ROLLBACK.sh --status
#   bash ROLLBACK.sh --preview
#   bash ROLLBACK.sh --backup
#   bash ROLLBACK.sh --restore
#   bash ROLLBACK.sh --help
#
# Safety:
# - Status is the default; no changes are made.
# - Preview shows the planned tracked-file rollback.
# - Backup archives tracked, untracked, and ignored working files
#   where Git can enumerate them, excluding .git metadata.
# - Restore requires explicit confirmation.
# - Restore affects tracked working-tree files only.
# - Untracked files are not deliberately deleted.
# - This script does not reset branches, rewrite history, or push.
set -Eeuo pipefail
IFS=$'\n\t'
SCRIPT_NAME="${0##*/}"
MODE="--status"
REPO_ROOT=""
BACKUP_DIR=""
TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
log()  { printf '[INFO] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*" >&2; }
die()  { printf '[ERROR] %s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'USAGE'
Conservative Git rollback helper
Commands:
  --status    Show branch, status, and conflict information (default)
  --preview   Preview tracked changes that --restore would discard
  --backup    Create an archive backup without modifying repository files
  --restore   Restore tracked working-tree files to the current HEAD
  --help      Show this help
Examples:
  bash ROLLBACK.sh --status
  bash ROLLBACK.sh --preview
  bash ROLLBACK.sh --backup
  bash ROLLBACK.sh --restore
Important:
  --restore discards staged and unstaged changes to tracked files.
  It does not remove untracked files, but check for overwritten paths.
  Create an external backup and review --preview before restoring.
USAGE
}
require_command() {
  command -v "$1" >/dev/null 2>&1 ||
    die "Required command not found: $1"
}
find_repo_root() {
  require_command git
  git rev-parse --show-toplevel 2>/dev/null ||
    die "Run this script from inside a Git repository."
}
show_status() {
  log "Repository: $REPO_ROOT"
  log "Branch: $(git -C "$REPO_ROOT" branch --show-current 2>/dev/null || true)"
  log "HEAD: $(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo 'No commit')"
  printf '\n--- Git status ---\n'
  git -C "$REPO_ROOT" status --short --branch
  printf '\n--- Unmerged paths ---\n'
  if git -C "$REPO_ROOT" diff --name-only --diff-filter=U | grep -q .; then
    git -C "$REPO_ROOT" diff --name-only --diff-filter=U
    warn "Merge conflicts exist. Do not restore until you have reviewed them."
  else
    printf 'No unmerged paths reported by Git.\n'
  fi
  printf '\n--- Change summary ---\n'
  git -C "$REPO_ROOT" diff --stat
  git -C "$REPO_ROOT" diff --cached --stat
}
preview_restore() {
  printf '%s\n' \
    '--- Preview: tracked working-tree changes ---' \
    'The following tracked changes would be discarded by restore mode.'
  git -C "$REPO_ROOT" diff --name-status
  git -C "$REPO_ROOT" diff --cached --name-status
  printf '\n--- Untracked files (preserved by this script) ---\n'
  git -C "$REPO_ROOT" ls-files --others --exclude-standard
  printf '\n--- Ignored files (not deliberately deleted) ---\n'
  git -C "$REPO_ROOT" ls-files --others --ignored --exclude-standard
  printf '\n--- Restore plan ---\n'
  printf '%s\n' \
    '1. Create an archive backup.' \
    '2. Restore tracked files from the current HEAD.' \
    '3. Leave untracked files untouched.' \
    '4. Leave branch, commits, and remote history unchanged.'
}
create_backup() {
  require_command tar
  require_command git
  local parent
  parent="$(dirname "$REPO_ROOT")"
  BACKUP_DIR="${ROLLBACK_BACKUP_DIR:-"$parent/rollback-backups"}"
  mkdir -p "$BACKUP_DIR"
  BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"
  local archive="$BACKUP_DIR/$(basename "$REPO_ROOT")-$TIMESTAMP.tar.gz"
  [[ ! -e "$archive" ]] || die "Backup already exists: $archive"
  log "Creating backup archive outside the repository..."
  log "Backup destination: $archive"
  # Include working files, including untracked and ignored files, but
  # exclude .git metadata. This is a file backup, not a Git-history backup.
  tar -czf "$archive" \
    --exclude='./.git' \
    -C "$REPO_ROOT" .
  [[ -s "$archive" ]] || die "Backup archive is empty or missing."
  tar -tzf "$archive" >/dev/null ||
    die "Backup archive verification failed."
  log "Backup created and archive listing verified."
  log "Archive: $archive"
}
restore_tracked_files() {
  require_command git
  if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
    warn "Working tree has changes. Restore can discard staged and unstaged changes to tracked files."
  else
    log "Working tree is clean; there may be nothing to restore."
  fi
  printf '\nCurrent status:\n'
  git -C "$REPO_ROOT" status --short
  printf '\nThis operation restores tracked files to the current HEAD.\n'
  printf 'It does not reset commits or intentionally delete untracked files.\n'
  printf 'Type exactly RESTORE-TRACKED-FILES to continue: '
  local confirmation
  IFS= read -r confirmation || die "No confirmation received."
  [[ "$confirmation" == "RESTORE-TRACKED-FILES" ]] ||
    die "Confirmation did not match. No restore performed."
  # Always back up immediately before attempting the destructive operation.
  create_backup
  log "Restoring tracked working-tree files from HEAD..."
  git -C "$REPO_ROOT" restore --source=HEAD --worktree --staged -- .
  log "Restore command completed."
  printf '\nFinal status:\n'
  git -C "$REPO_ROOT" status --short --branch
  log "Untracked files were not targeted by git restore."
}
main() {
  if [[ $# -gt 1 ]]; then
    usage
    die "Supply only one command."
  fi
  if [[ $# -eq 1 ]]; then
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
  REPO_ROOT="$(cd "$REPO_ROOT" && pwd)"
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