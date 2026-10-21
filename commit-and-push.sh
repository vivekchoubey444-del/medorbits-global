#!/usr/bin/env bash
set -euo pipefail
BRANCH="main"
echo "Checking repository status..."
git status
echo "Checking current branch..."
CURRENT_BRANCH="$(git branch --show-current)"
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "Error: Switch to main before continuing."
  exit 1
fi
echo "Fetching latest remote changes..."
git fetch origin
echo "Checking for workflow-file changes..."
if ! git diff --name-only origin/main...HEAD \
  | grep -q '^\.github/workflows/'; then
  echo "No changed workflow files detected."
else
  echo "Workflow changes detected."
  echo "GitHub requires the workflow permission to push them."
  echo "Reauthorize Working Copy or use another authorized method."
  exit 1
fi
echo "Pushing permitted commits..."
git push origin main
echo "Push completed."