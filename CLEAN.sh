#!/usr/bin/env bash
# ============================================================
# MedOrbits Safe Cleanup Utility
# File: /CLEAN.sh
#
# Purpose:
#   Inspect and optionally remove explicitly approved generated
#   artifacts, caches, and temporary files.
#
# Usage:
#   bash CLEAN.sh
#   bash CLEAN.sh --dry-run
#   bash CLEAN.sh --apply
#   bash CLEAN.sh --apply --include-logs
#   bash CLEAN.sh --apply --include-build
#   bash CLEAN.sh --help
#
# Safety:
#   - Dry-run is the default.
#   - Never runs git clean.
#   - Never runs git reset.
#   - Never deletes source files or Git history.
#   - Never removes .env files, databases, uploads, or user data.
#   - Never follows symbolic links for deletion.
#   - Refuses to run outside a recognizable project root.
#   - Refuses to delete Git-tracked files.
#   - Requires a clean-enough path boundary under the project root.
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
readonly SCRIPT_NAME="CLEAN.sh"
readonly VERSION="1.0.0"
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
APPLY=0
INCLUDE_LOGS=0
INCLUDE_BUILD=0
INCLUDE_PYTHON_CACHE=1
INCLUDE_NODE_CACHE=1
QUIET=0
SCANNED=0
CANDIDATES=0
REMOVED=0
SKIPPED=0
ERRORS=0
declare -a CANDIDATE_PATHS=()
declare -a CANDIDATE_REASONS=()
log() {
  if [[ "$QUIET" -eq 0 ]]; then
    printf '[%s] %s\n' "$SCRIPT_NAME" "$*"
  fi
}
warn() {
  printf '[%s] WARNING: %s\n' "$SCRIPT_NAME" "$*" >&2
}
error() {
  printf '[%s] ERROR: %s\n' "$SCRIPT_NAME" "$*" >&2
}
die() {
  error "$*"
  exit 1
}
usage() {
  cat <<'EOF'
MedOrbits Safe Cleanup Utility
Usage:
  bash CLEAN.sh [options]
Options:
  --dry-run             Inspect only (default).
  --apply               Delete eligible, explicitly approved artifacts.
  --include-logs        Also remove eligible untracked log files.
  --include-build       Also remove recognized generated build directories.
  --no-node-cache       Do not inspect Node.js cache directories.
  --no-python-cache     Do not inspect Python cache directories.
  --quiet               Reduce informational output.
  --help                Display this help.
Examples:
  bash CLEAN.sh
  bash CLEAN.sh --dry-run
  bash CLEAN.sh --apply
  bash CLEAN.sh --apply --include-logs
  bash CLEAN.sh --apply --include-build
Safety:
  - This script never runs git clean or git reset.
  - Git-tracked files are never eligible for deletion.
  - Source files, configuration, credentials, databases, uploads,
    and Git history are excluded.
  - Build directories are only considered with --include-build.
  - Review the dry-run output before using --apply.
EOF
}
while (($#)); do
  case "$1" in
    --dry-run)
      APPLY=0
      ;;
    --apply)
      APPLY=1
      ;;
    --include-logs)
      INCLUDE_LOGS=1
      ;;
    --include-build)
      INCLUDE_BUILD=1
      ;;
    --no-node-cache)
      INCLUDE_NODE_CACHE=0
      ;;
    --no-python-cache)
      INCLUDE_PYTHON_CACHE=0
      ;;
    --quiet)
      QUIET=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1 (use --help)"
      ;;
  esac
  shift
done
require_command() {
  command -v "$1" >/dev/null 2>&1 ||
    die "Required command not found: $1"
}
require_command find
require_command git
require_command realpath
[[ -d "$ROOT" ]] || die "Project root does not exist: $ROOT"
[[ -f "$ROOT/.git" || -d "$ROOT/.git" ]] ||
  die "No Git repository metadata found at $ROOT"
GIT_ROOT="$(git -C "$ROOT" rev-parse --show-toplevel 2>/dev/null)" ||
  die "Cannot determine Git repository root."
GIT_ROOT="$(cd -- "$GIT_ROOT" && pwd -P)"
[[ "$GIT_ROOT" == "$ROOT" ]] ||
  die "Run this script from the actual repository root: $GIT_ROOT"
log "MedOrbits Safe Cleanup v$VERSION"
log "Repository: $ROOT"
log "Mode: $([[ "$APPLY" -eq 1 ]] && printf 'APPLY' || printf 'DRY RUN')"
# Explicitly protected directories. Cleanup never traverses these.
is_protected_path() {
  local relative="$1"
  local first="${relative%%/*}"
  case "$first" in
    .git|.github|.husky|node_modules|vendor|\
    uploads|storage|database|databases|backups|backup|\
    secrets|certificates|private|user-data|user_data|\
    documents|documents-private|logs-private)
      return 0
      ;;
  esac
  case "/$relative/" in
    */.git/*|*/node_modules/*|*/vendor/*|\
    */uploads/*|*/storage/*|*/backups/*|\
    */secrets/*|*/private/*)
      return 0
      ;;
  esac
  return 1
}
# Returns success if Git tracks the path.
is_tracked() {
  local relative="$1"
  git -C "$ROOT" ls-files --error-unmatch -- "$relative" \
    >/dev/null 2>&1
}
# Check all paths stay inside the project and are not symlinks.
safe_candidate() {
  local candidate="$1"
  local relative="$2"
  [[ -e "$candidate" || -L "$candidate" ]] || return 1
  [[ ! -L "$candidate" ]] || return 1
  local resolved
  resolved="$(realpath -m -- "$candidate")" || return 1
  case "$resolved" in
    "$ROOT"/*) ;;
    *) return 1 ;;
  esac
  [[ "$relative" != "." ]] || return 1
  [[ "$relative" != .. && "$relative" != ../* ]] || return 1
  is_protected_path "$relative" && return 1
  is_tracked "$relative" && return 1
  return 0
}
add_candidate() {
  local candidate="$1"
  local reason="$2"
  SCANNED=$((SCANNED + 1))
  local relative="${candidate#"$ROOT"/}"
  if ! safe_candidate "$candidate" "$relative"; then
    SKIPPED=$((SKIPPED + 1))
    return 0
  fi
  # Avoid duplicate candidate entries.
  local existing
  for existing in "${CANDIDATE_PATHS[@]:-}"; do
    [[ "$existing" == "$candidate" ]] && return 0
  done
  CANDIDATE_PATHS+=("$candidate")
  CANDIDATE_REASONS+=("$reason")
  CANDIDATES=$((CANDIDATES + 1))
  if [[ "$APPLY" -eq 0 ]]; then
    log "WOULD REMOVE: $relative ($reason)"
  else
    log "ELIGIBLE: $relative ($reason)"
  fi
}
# Scan only within the repository, pruning protected or expensive trees.
scan_find() {
  local pattern="$1"
  local reason="$2"
  while IFS= read -r -d '' candidate; do
    add_candidate "$candidate" "$reason"
  done < <(
    find "$ROOT" \
      \( \
        -type d \( \
          -name .git -o \
          -name node_modules -o \
          -name vendor -o \
          -name uploads -o \
          -name storage -o \
          -name backups -o \
          -name secrets -o \
          -name private \
        \) -prune \
      \) -o \
      \( -type f -name "$pattern" -print0 \) \
      2>/dev/null
  )
}
# 1. Python bytecode files.
if [[ "$INCLUDE_PYTHON_CACHE" -eq 1 ]]; then
  scan_find '*.pyc' "Python bytecode cache"
  scan_find '*.pyo' "Python optimized bytecode cache"
  while IFS= read -r -d '' candidate; do
    add_candidate "$candidate" "Python __pycache__ directory"
  done < <(
    find "$ROOT" \
      \( \
        -type d \( \
          -name .git -o \
          -name node_modules -o \
          -name vendor -o \
          -name uploads -o \
          -name storage -o \
          -name backups -o \
          -name secrets -o \
          -name private \
        \) -prune \
      \) -o \
      \( -type d -name __pycache__ -print0 \) \
      2>/dev/null
  )
fi
# 2. Common temporary editor and OS files.
scan_find '*.tmp' "Temporary file"
scan_find '*.temp' "Temporary file"
scan_find '*~' "Editor backup"
scan_find '.DS_Store' "macOS metadata"
scan_find 'Thumbs.db' "Windows thumbnail cache"
scan_find 'desktop.ini' "Windows folder metadata"
# 3. Logs are excluded unless explicitly requested.
if [[ "$INCLUDE_LOGS" -eq 1 ]]; then
  scan_find '*.log' "Log file (explicitly enabled)"
fi
# 4. Build directories are opt-in because some deployments may rely on them.
if [[ "$INCLUDE_BUILD" -eq 1 ]]; then
  for build_name in dist build coverage .next .nuxt out; do
    candidate="$ROOT/$build_name"
    [[ -d "$candidate" && ! -L "$candidate" ]] || continue
    relative="$build_name"
    # Never remove a tracked build directory or any directory containing
    # tracked files. This protects source-controlled deployment artifacts.
    if is_tracked "$relative"; then
      warn "Skipping tracked build directory: $relative"
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
    tracked_inside="$(
      git -C "$ROOT" ls-files -- "$relative/" 2>/dev/null || true
    )"
    if [[ -n "$tracked_inside" ]]; then
      warn "Skipping build directory containing tracked files: $relative"
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
    add_candidate "$candidate" "Generated build directory (opt-in)"
  done
fi
printf '\n'
log "Scan summary:"
log "  Paths examined: $SCANNED"
log "  Eligible candidates: $CANDIDATES"
log "  Skipped paths: $SKIPPED"
if [[ "$CANDIDATES" -eq 0 ]]; then
  log "No eligible cleanup candidates found."
  exit 0
fi
if [[ "$APPLY" -eq 0 ]]; then
  log "Dry run complete. No files were deleted."
  log "Review the list above, then rerun with --apply if appropriate."
  exit 0
fi
printf '\n'
warn "Apply mode will remove only the listed eligible candidates."
warn "Confirm you have a backup before continuing."
if [[ ! -t 0 ]]; then
  die "Interactive terminal required for --apply. Review with --dry-run first."
fi
printf 'Type CLEAN to continue: '
IFS= read -r confirmation
[[ "$confirmation" == "CLEAN" ]] ||
  die "Confirmation did not match. No files were deleted."
for index in "${!CANDIDATE_PATHS[@]}"; do
  candidate="${CANDIDATE_PATHS[$index]}"
  reason="${CANDIDATE_REASONS[$index]}"
  relative="${candidate#"$ROOT"/}"
  # Recheck immediately before removal.
  if ! safe_candidate "$candidate" "$relative"; then
    warn "Skipping changed or unsafe path: $relative"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi
  if [[ -d "$candidate" ]]; then
    # Only remove empty directories; do not recursively delete build output.
    if rmdir -- "$candidate" 2>/dev/null; then
      REMOVED=$((REMOVED + 1))
      log "REMOVED empty directory: $relative"
    else
      warn "Directory is not empty; preserving it: $relative"
      SKIPPED=$((SKIPPED + 1))
    fi
  elif [[ -f "$candidate" ]]; then
    if rm -- "$candidate"; then
      REMOVED=$((REMOVED + 1))
      log "REMOVED: $relative ($reason)"
    else
      error "Failed to remove: $relative"
      ERRORS=$((ERRORS + 1))
    fi
  else
    warn "Skipping unsupported file type: $relative"
    SKIPPED=$((SKIPPED + 1))
  fi
done
printf '\n'
log "Cleanup complete."
log "  Removed: $REMOVED"
log "  Skipped: $SKIPPED"
log "  Errors: $ERRORS"
[[ "$ERRORS" -eq 0 ]] || exit 1
exit 0