
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- Safe Repository Commit Utility
# File: /COMMIT.sh
# Requirements: Git, Bash, Node.js (optional), Python (optional)
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'

readonly SCRIPT_NAME="COMMIT.sh"
readonly ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

PUSH=false
RUN_CHECKS=true
MESSAGE=""
BRANCH=""
DRY_RUN=false

usage() {
  cat <<'EOF'
Usage:
  bash COMMIT.sh [options]

Options:
  -m, --message TEXT   Commit message
  -p, --push            Push to the current branch after committing
  --no-checks           Skip optional syntax checks
  --dry-run             Show staged changes without committing
  -h, --help            Show this help

Examples:
  bash COMMIT.sh -m "fix: repair repository validation"
  bash COMMIT.sh -m "chore: update configuration" --push
EOF
}

log()  { printf '[INFO] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*" >&2; }
die()  { printf '[ERROR] %s\n' "$*" >&2; exit 1; }

while (($#)); do
  case "$1" in
    -m|--message)
      (($# >= 2)) || die "Missing commit message."
      MESSAGE="$2"
      shift 2
      ;;
    -p|--push)
      PUSH=true
      shift
      ;;
    --no-checks)
      RUN_CHECKS=false
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

command -v git >/dev/null 2>&1 || die "Git is not installed."
git rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
  die "Run this script inside a Git repository."

BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
[[ -n "$BRANCH" ]] ||
  die "Detached HEAD detected. Switch to a branch before committing."

case "$BRANCH" in
  main|master|production|release)
    warn "You are on protected-looking branch '$BRANCH'."
    warn "Prefer a repair branch and a pull request."
    ;;
esac

if [[ -z "$MESSAGE" ]]; then
  MESSAGE="chore: update repository"
fi

[[ "$MESSAGE" != *$'\n'* && "$MESSAGE" != *$'\r'* ]] ||
  die "Commit message must be a single line."

git diff --check ||
  die "Whitespace errors found. Fix them before committing."

# Never stage common secret files or private keys.
is_sensitive_path() {
  local path="${1,,}"
  case "$path" in
    .env|.env.*|*/.env|*/.env.*|\
    *id_rsa|*id_ed25519|*.pem|*.key|*.p12|*.pfx|\
    *credentials.json|*service-account*.json|\
    *secrets.json|*secret*.txt)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

log "Checking repository status..."
git status --short

if [[ "$RUN_CHECKS" == true ]]; then
  if command -v python3 >/dev/null 2>&1; then
    log "Checking Python syntax..."
    python3 - <<'PY'
import ast
import sys
from pathlib import Path

excluded = {
    ".git", "node_modules", ".venv", "venv",
    "__pycache__", "dist", "build", ".next",
}
failures = []
count = 0

for path in Path(".").rglob("*.py"):
    if any(part in excluded for part in path.parts):
        continue
    count += 1
    try:
        ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    except (SyntaxError, UnicodeError, OSError) as exc:
        failures.append(f"{path}: {exc}")

print(f"Python files checked: {count}")
for failure in failures:
    print(f"FAIL: {failure}", file=sys.stderr)

if failures:
    sys.exit(1)
print("Python syntax: PASS")
PY
  else
    warn "Python 3 not installed; Python syntax check skipped."
  fi

  if command -v node >/dev/null 2>&1; then
    log "Checking JavaScript syntax..."
    while IFS= read -r -d '' file; do
      node --check "$file" ||
        die "JavaScript syntax error in $file"
    done < <(
      find . -type f \
        \( -name '*.js' -o -name '*.cjs' -o -name '*.mjs' \) \
        -not -path './.git/*' \
        -not -path './node_modules/*' \
        -not -path './*/node_modules/*' \
        -not -path './.venv/*' \
        -print0
    )
    log "JavaScript syntax: PASS"
  else
    warn "Node.js not installed; JavaScript syntax check skipped."
  fi
fi

if [[ -z "$(git status --porcelain)" ]]; then
  log "No changes to commit."
  exit 0
fi

# Stage tracked changes and untracked files, then inspect for secrets.
git add -A

while IFS= read -r -d '' path; do
  if is_sensitive_path "$path"; then
    git reset -q -- "$path" || true
    die "Potential secret file excluded from staging: $path. Review manually."
  fi
done < <(git diff --cached --name-only -z)

# Block obvious private-key material in staged text files.
if git diff --cached --no-ext-diff --unified=0 |
  grep -E '^\+.*(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})' \
  >/dev/null; then
  git reset -q
  die "Potential credential or private key detected in staged changes."
fi

log "Staged change summary:"
git diff --cached --stat

if [[ "$DRY_RUN" == true ]]; then
  log "Dry run: no commit or push performed."
  git diff --cached --name-status
  exit 0
fi

if git diff --cached --quiet; then
  log "No staged changes remain."
  exit 0
fi

git commit -m "$MESSAGE"
log "Commit created successfully."

if [[ "$PUSH" == true ]]; then
  # Explicitly prohibit force-push behavior.
  git push origin "HEAD:refs/heads/$BRANCH"
  log "Pushed to origin/$BRANCH."
else
  log "Push skipped. Review the commit, then push when ready."
  log "To push: git push origin '$BRANCH'"
fi

log "Commit workflow completed."
