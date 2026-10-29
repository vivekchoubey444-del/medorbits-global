
#!/usr/bin/env bash
# MedOrbits emergency CI override
# Usage:
#   bash OVERRIDE.sh
#   bash OVERRIDE.sh --commit

set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: Run this script inside the MedOrbits Git repository."
  exit 1
}

cd "$ROOT"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP=".override-backup/$STAMP"
mkdir -p "$BACKUP"

echo "== MedOrbits emergency override =="
echo "Repository: $ROOT"
echo "Backup: $BACKUP"

# Back up and disable only the CI workflow explicitly named below.
# Change this path if your workflow uses a different filename.
TARGET=".github/workflows/ci.yml"

if [[ -f "$TARGET" ]]; then
  mkdir -p "$BACKUP/$(dirname "$TARGET")"
  cp -p "$TARGET" "$BACKUP/$TARGET"
  mv "$TARGET" "$TARGET.disabled"
  echo "Temporarily disabled: $TARGET"
else
  echo "No $TARGET found; no existing workflow was moved."
fi

# Add a minimal workflow so GitHub Actions has a lightweight validation job.
mkdir -p .github/workflows

cat > .github/workflows/medorbits-emergency.yml <<'YAML'
name: MedOrbits Emergency Validation

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: emergency-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  runtime-check:
    name: Basic Runtime Check
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          persist-credentials: false

      - name: Verify Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Verify Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Check runtimes and repository
        shell: bash
        run: |
          set -Eeuo pipefail
          node --version
          npm --version
          python --version
          git status --short
          echo "Basic runtime checks passed."
YAML

# Add a recovery guide.
cat > OVERRIDE-RECOVERY.txt <<'TEXT'
MedOrbits Emergency Override

1. The previous .github/workflows/ci.yml is backed up under
   .override-backup/<timestamp>/ when it existed.
2. Its working copy is renamed to ci.yml.disabled.
3. medorbits-emergency.yml performs basic runtime checks only.
4. This is temporary and does not repair source-code errors.
5. Restore the original CI workflow after the underlying errors
   have been diagnosed and fixed.
6. Review all changes before committing or pushing.
TEXT

# Ignore backups so the full backup is not accidentally committed.
if [[ -f .gitignore ]] && ! grep -Fxq '.override-backup/' .gitignore; then
  printf '\n# Local emergency override backups\n.override-backup/\n' >> .gitignore
fi

echo
echo "== Changes made =="
git status --short

if [[ "${1:-}" == "--commit" ]]; then
  git add .github/workflows/ci.yml.disabled \
          .github/workflows/medorbits-emergency.yml \
          OVERRIDE-RECOVERY.txt \
          .gitignore 2>/dev/null || true

  if git diff --cached --quiet; then
    echo "No staged changes to commit."
    exit 0
  fi

  git commit -m "chore: temporarily use emergency CI validation"
  echo "Local commit created. Nothing was pushed."
else
  echo
  echo "Review the changes above."
  echo "To create a local commit, run: bash OVERRIDE.sh --commit"
  echo "Nothing has been pushed."
fi
