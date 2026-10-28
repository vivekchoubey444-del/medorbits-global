
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- Git Bot Identity Fix
# File: /tools/FIX-GIT-BOT.sh
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
LOG_DIR="${ROOT_DIR}/logs"
LOG_FILE="${LOG_DIR}/fix-git-bot.log"

BOT_NAME="MedOrbits Bot"
BOT_EMAIL="${GIT_BOT_EMAIL:-}"

mkdir -p "$LOG_DIR"
cd "$ROOT_DIR"

log() {
  printf '[%s] %s\n' "$(date -Is 2>/dev/null || date)" "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

command -v git >/dev/null 2>&1 || fail "Git is not installed."
git rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
  fail "This directory is not a Git repository."

exec > >(tee -a "$LOG_FILE") 2>&1

log "MedOrbits Git Bot Identity Repair"
log "Repository: $ROOT_DIR"

# Show current identity without exposing credentials.
CURRENT_NAME="$(git config --local user.name || true)"
CURRENT_EMAIL="$(git config --local user.email || true)"

log "Current local Git name: ${CURRENT_NAME:-not configured}"
log "Current local Git email: ${CURRENT_EMAIL:-not configured}"

# Show repository state.
BRANCH="$(git branch --show-current || true)"
log "Current branch: ${BRANCH:-detached HEAD}"

if git remote get-url origin >/dev/null 2>&1; then
  REMOTE_URL="$(git remote get-url origin)"
  log "Origin remote: $REMOTE_URL"
else
  log "WARNING: No origin remote configured."
fi

# Configure bot name locally.
git config --local user.name "$BOT_NAME"
log "Configured local Git author name: $BOT_NAME"

# Set email only when explicitly supplied.
if [[ -n "$BOT_EMAIL" ]]; then
  git config --local user.email "$BOT_EMAIL"
  log "Configured local Git author email from GIT_BOT_EMAIL."
else
  log "Email unchanged. Set GIT_BOT_EMAIL to the bot's verified GitHub email."
fi

# Check recent author/committer metadata.
log "Latest commit identity:"
git log -1 --format='Author: %an <%ae>%nCommitter: %cn <%ce>' 2>/dev/null ||
  log "No commits are available yet."

# Diagnose repository changes without modifying them.
if ! git diff --quiet || ! git diff --cached --quiet ||
   [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  log "WARNING: Working tree contains changes. They have not been modified."
else
  log "Working tree is clean."
fi

log "Git configuration after repair:"
git config --local --get user.name || true
git config --local --get user.email || true

log "IMPORTANT: Existing commits were not rewritten."
log "IMPORTANT: No commit, push, credential change, or remote change was performed."
log "If the app still shows 'vd', inspect its account/avatar cache."
log "Log file: $LOG_FILE"
