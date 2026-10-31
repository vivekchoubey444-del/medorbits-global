
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits Local Agent -- Safe Git Commit Helper
# File: /local-agent/COMMIT.sh
# Version: 1.0.0
#
# Purpose:
#   Validate repository files and create a Git commit only after explicit
#   confirmation. Does not push, deploy, reset, clean, or rewrite history.
#
# Usage:
#   bash local-agent/COMMIT.sh
#   bash local-agent/COMMIT.sh --message "fix: improve repository validation"
#   bash local-agent/COMMIT.sh --dry-run
#   bash local-agent/COMMIT.sh --allow-existing-staged
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

VERSION="1.0.0"
DRY_RUN=false
ALLOW_EXISTING_STAGED=false
COMMIT_MESSAGE=""

log()  { printf '[INFO] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*" >&2; }
die()  { printf '[ERROR] %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
MedOrbits Local Agent -- Safe Git Commit Helper

Options:
  --message TEXT          Commit message (otherwise prompted)
  --dry-run               Validate and preview; do not commit
  --allow-existing-staged Permit committing changes already staged
  --help                  Show this help

Safety:
  - Requires an existing Git repository.
  - Refuses detached HEAD and merge/rebase/cherry-pick states.
  - Does not push or deploy.
  - Does not stage ignored files or secret-looking files.
  - By default, refuses pre-staged changes to avoid committing unrelated work.
USAGE
}

while (($#)); do
  case "$1" in
    --message)
      (($# >= 2)) || die "--message requires a value."
      COMMIT_MESSAGE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --allow-existing-staged)
      ALLOW_EXISTING_STAGED=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

command -v git >/dev/null 2>&1 || die "Git is not installed."
command -v python3 >/dev/null 2>&1 || warn "Python 3 is unavailable; Python validation will be skipped."

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)" \
  || die "This script must be inside a Git working tree."

cd -- "$REPO_ROOT"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || die "Not inside a Git working tree."

BRANCH="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
[[ -n "$BRANCH" ]] || die "Detached HEAD detected; checkout a branch first."

for marker in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD; do
  marker_path="$(git rev-parse --git-path "$marker")"
  [[ ! -e "$marker_path" ]] || die "Git operation in progress: $marker"
done

for marker in rebase-merge rebase-apply; do
  marker_path="$(git rev-parse --git-path "$marker")"
  [[ ! -e "$marker_path" ]] || die "Git operation in progress: $marker"
done

# Refuse an unmerged index.
if ! git diff --quiet --diff-filter=U; then
  die "Unmerged paths exist. Resolve them before committing."
fi

# Avoid accidental commits of unrelated staged changes.
if [[ "$ALLOW_EXISTING_STAGED" != true ]] &&
   ! git diff --cached --quiet; then
  die "Index already contains staged changes. Commit them deliberately or pass --allow-existing-staged."
fi

if [[ -z "$COMMIT_MESSAGE" ]]; then
  if [[ ! -t 0 ]]; then
    die "Provide --message when running non-interactively."
  fi
  printf 'Commit message: '
  IFS= read -r COMMIT_MESSAGE
fi

[[ -n "${COMMIT_MESSAGE//[[:space:]]/}" ]] \
  || die "Commit message cannot be empty."

[[ "$COMMIT_MESSAGE" != -* ]] \
  || die "Commit message must not start with a hyphen."

# Keep the subject readable and bounded.
if ((${#COMMIT_MESSAGE} > 200)); then
  die "Commit message must be 200 characters or fewer."
fi

log "MedOrbits Local Agent commit helper v${VERSION}"
log "Repository: $REPO_ROOT"
log "Branch: $BRANCH"

# Validate the Python agent when present.
if [[ -f "$REPO_ROOT/local-agent/agent.py" ]] && command -v python3 >/dev/null 2>&1; then
  log "Checking local-agent/agent.py syntax..."
  python3 -m py_compile "$REPO_ROOT/local-agent/agent.py" \
    || die "Python syntax check failed."

  # py_compile generates __pycache__; remove only the exact generated cache
  # file when it is not tracked, and leave any pre-existing files untouched.
  CACHE_DIR="$REPO_ROOT/local-agent/__pycache__"
  if [[ -d "$CACHE_DIR" ]]; then
    find "$CACHE_DIR" -maxdepth 1 -type f \
      -name 'agent.*.pyc' -mmin -2 -print -delete 2>/dev/null || true
    rmdir "$CACHE_DIR" 2>/dev/null || true
  fi
fi

# Validate JSON files without executing repository code.
if command -v python3 >/dev/null 2>&1; then
  log "Checking JSON files..."
  python3 - "$REPO_ROOT" <<'PY'
import json
import os
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
excluded = {
    ".git", "node_modules", "vendor", ".venv", "venv",
    "__pycache__", "dist", "build", ".next", ".local-agent",
}
limit = 10000
checked = 0
errors = []

for current, dirs, names in os.walk(root, followlinks=False):
    base = Path(current)
    dirs[:] = [
        name for name in dirs
        if name not in excluded and not (base / name).is_symlink()
    ]

    for name in names:
        path = base / name
        if path.is_symlink() or not path.is_file() or path.suffix.lower() != ".json":
            continue
        checked += 1
        if checked > limit:
            print(f"ERROR: JSON scan exceeded {limit} files.", file=sys.stderr)
            sys.exit(2)
        try:
            if path.stat().st_size > 5_000_000:
                continue
            json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f"{path.relative_to(root)}: {exc}")

for error in errors:
    print(f"ERROR: {error}", file=sys.stderr)

print(f"JSON files checked: {min(checked, limit)}")
sys.exit(1 if errors else 0)
PY
  [[ $? -eq 0 ]] || die "JSON validation failed."
fi

# Stage only tracked modifications/deletions and untracked, non-ignored files.
# Explicit exclusions are an additional safeguard; .gitignore remains active.
log "Staging eligible changes..."
git add -u

while IFS= read -r -d '' file; do
  case "${file,,}" in
    .env|*/.env|.env.*|*/.env.*|*credentials.json|*secrets.json|*.pem|*.key|*.p12|*.pfx)
      warn "Skipping secret-looking path: $file"
      continue
      ;;
  esac

  # Git's normal ignore rules apply; ignored files are never force-added.
  git check-ignore -q -- "$file" && continue
  git add -- "$file"
done < <(git ls-files --others --exclude-standard -z)

# Never create an empty commit.
if git diff --cached --quiet; then
  log "No staged changes to commit."
  exit 0
fi

log "Staged change summary:"
git diff --cached --stat
git diff --cached --check || die "Whitespace/conflict-marker checks failed."

# Detect obvious private-key material in staged text. This is heuristic only.
if git diff --cached --no-ext-diff --unified=0 -- . \
  | grep -Eiq 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}'; then
  die "Possible secret material detected in staged diff. Review and unstage sensitive files."
fi

if [[ "$DRY_RUN" == true ]]; then
  log "Dry run complete; no commit created."
  log "Review the staged diff with: git diff --cached"
  exit 0
fi

if [[ -t 0 ]]; then
  printf '\nCreate commit on branch "%s" with message:\n  %s\n' "$BRANCH" "$COMMIT_MESSAGE"
  printf 'Type YES to confirm: '
  IFS= read -r confirmation
  [[ "$confirmation" == "YES" ]] || die "Commit cancelled."
else
  die "Non-interactive commit requires --dry-run. Run interactively to confirm."
fi

git commit -m "$COMMIT_MESSAGE"

log "Commit created:"
git log -1 --format='%h %s'
log "No push or deployment was performed."
