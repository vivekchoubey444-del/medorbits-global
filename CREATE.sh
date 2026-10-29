
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- Repository Bootstrap and Safe File Creator
# File: CREATE.sh
# Bash 4+ | Python 3.10+ recommended | Node.js 20+ recommended
#
# Usage:
#   bash CREATE.sh
#   bash CREATE.sh --force
#   bash CREATE.sh --commit
#   bash CREATE.sh --force --commit
#
# --force  Replace only files managed by this script.
# --commit Create a Git commit after successful validation.
#
# This script does not force-push, merge, deploy, or generate credentials.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

FORCE=false
COMMIT=false
CREATED=0
SKIPPED=0
FAILED=0

log()  { printf '[INFO] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*" >&2; }
die()  { printf '[ERROR] %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: bash CREATE.sh [--force] [--commit] [--help]

  --force   Replace files managed by this script.
  --commit  Commit changes after validation.
  --help    Display this help.

Existing files are preserved by default.
EOF
}

while (($#)); do
  case "$1" in
    --force) FORCE=true ;;
    --commit) COMMIT=true ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
  shift
done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

create_file() {
  local path="$1"
  local content="$2"

  mkdir -p "$(dirname "$path")"

  if [[ -e "$path" && "$FORCE" != true ]]; then
    log "Preserved existing file: $path"
    ((SKIPPED+=1))
    return 0
  fi

  local temporary
  temporary="$(mktemp "$(dirname "$path")/.create.XXXXXX")"

  if ! printf '%s\n' "$content" > "$temporary"; then
    rm -f "$temporary"
    ((FAILED+=1))
    warn "Could not prepare: $path"
    return 1
  fi

  if [[ -e "$path" && "$FORCE" == true ]]; then
    cp -p "$path" "$path.create-backup"
    warn "Backup created: $path.create-backup"
  fi

  mv "$temporary" "$path"
  ((CREATED+=1))
  log "Created or updated: $path"
}

create_dir() {
  mkdir -p "$1"
  log "Directory ready: $1"
}

log "MedOrbits repository bootstrap"
log "Root: $ROOT"

# ----------------------------------------------------------------------
# Standard repository directories
# ----------------------------------------------------------------------

directories=(
  ".github/workflows"
  ".github/ISSUE_TEMPLATE"
  "assets/css"
  "assets/js"
  "assets/images"
  "assets/data"
  "api/schemas"
  "docs/api"
  "docs"
  "scripts"
  "tests"
  "python"
  "local-agent/tools"
)

for directory in "${directories[@]}"; do
  create_dir "$directory"
done

# ----------------------------------------------------------------------
# .gitignore
# ----------------------------------------------------------------------

create_file ".gitignore" "$(cat <<'EOF'
# Secrets and local environment
.env
.env.*
!.env.example
!.env.example.*
!.npmrc.example
*.pem
*.key
*.p12
*.pfx
secrets/
credentials.json
service-account*.json

# Node
node_modules/
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*
.npm/
coverage/
dist/
build/

# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/
.pytest_cache/
.mypy_cache/
.ruff_cache/
htmlcov/

# Editors and operating systems
.DS_Store
Thumbs.db
.vscode/
.idea/
*.swp
*.swo

# Logs and temporary files
*.log
*.tmp
*.bak
*.create-backup

# Generated security-analysis output
.sarif/
results/
EOF
)" || true

# ----------------------------------------------------------------------
# npm configuration
# ----------------------------------------------------------------------

create_file ".npmrc" "$(cat <<'EOF'
# MedOrbits npm configuration
save-exact=true
save=false
strict-peer-deps=false
legacy-peer-deps=false
package-lock=true
registry=https://registry.npmjs.org/
strict-ssl=true
fetch-retries=2
fetch-retry-mintimeout=10000
fetch-retry-maxtimeout=60000
fetch-timeout=120000
audit=true
fund=false
ignore-scripts=false
update-notifier=false
progress=false

# Do not define omit with an empty value.
# Commit a valid package-lock.json and use npm ci in CI.
# Never store registry tokens or passwords in this file.
EOF
)" || true

# ----------------------------------------------------------------------
# Environment example: no real secrets
# ----------------------------------------------------------------------

create_file ".env.example" "$(cat <<'EOF'
# MedOrbits environment template
# Copy to .env locally and provide values securely.
# Never commit .env or real credentials.

NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=

# Authentication and sessions
SESSION_SECRET=

# Optional AI integration
AI_API_KEY=
AI_API_URL=
AI_MODEL=

# Optional deployment integrations
RENDER_DEPLOY_HOOK=
EOF
)" || true

# ----------------------------------------------------------------------
# Python dependency baseline
# ----------------------------------------------------------------------

create_file "requirements.txt" "$(cat <<'EOF'
# MedOrbits Python baseline
# Keep this file limited to dependencies actually used by the project.
PyYAML==6.0.3
EOF
)" || true

# ----------------------------------------------------------------------
# pytest configuration
# ----------------------------------------------------------------------

create_file "pytest.ini" "$(cat <<'EOF'
[pytest]
testpaths = tests python/tests
python_files = test_*.py *_test.py
addopts = -ra
EOF
)" || true

# ----------------------------------------------------------------------
# Python package entry point
# ----------------------------------------------------------------------

create_file "python/__init__.py" "$(cat <<'EOF'
"""MedOrbits Python utilities package."""
EOF
)" || true

create_file "python/main.py" "$(cat <<'EOF'
#!/usr/bin/env python3
"""MedOrbits Python utility entry point."""

from __future__ import annotations

import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser(
        description="MedOrbits repository utility entry point."
    )
    parser.add_argument(
        "--version",
        action="version",
        version="MedOrbits tools 1.0.0",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Print a machine-readable health result.",
    )
    args = parser.parse_args()

    if args.check:
        print(json.dumps({
            "application": "MedOrbits",
            "status": "ok",
            "python": sys.version.split()[0],
        }, indent=2))
        return 0

    parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
EOF
)" || true

# ----------------------------------------------------------------------
# Basic JSON schema examples
# ----------------------------------------------------------------------

create_file "api/schemas/career.schema.json" "$(cat <<'EOF'
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "MedOrbits Career Listing",
  "type": "object",
  "properties": {
    "id": {"type": "string", "minLength": 1},
    "title": {"type": "string", "minLength": 1},
    "organization": {"type": "string"},
    "location": {"type": "string"},
    "employmentType": {"type": "string"},
    "description": {"type": "string"},
    "applicationUrl": {"type": "string", "format": "uri"}
  },
  "required": ["id", "title"],
  "additionalProperties": true
}
EOF
)" || true

create_file "api/schemas/jobs.schema.json" "$(cat <<'EOF'
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "MedOrbits Job Listing",
  "type": "object",
  "properties": {
    "id": {"type": "string", "minLength": 1},
    "title": {"type": "string", "minLength": 1},
    "company": {"type": "string"},
    "location": {"type": "string"},
    "type": {"type": "string"},
    "description": {"type": "string"},
    "url": {"type": "string", "format": "uri"}
  },
  "required": ["id", "title"],
  "additionalProperties": true
}
EOF
)" || true

create_file "api/schemas/colleges.schema.json" "$(cat <<'EOF'
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "MedOrbits College",
  "type": "object",
  "properties": {
    "id": {"type": "string", "minLength": 1},
    "name": {"type": "string", "minLength": 1},
    "state": {"type": "string"},
    "city": {"type": "string"},
    "courses": {
      "type": "array",
      "items": {"type": "string"}
    },
    "officialWebsite": {"type": "string", "format": "uri"}
  },
  "required": ["id", "name"],
  "additionalProperties": true
}
EOF
)" || true

# ----------------------------------------------------------------------
# Repository validation script
# ----------------------------------------------------------------------

create_file "scripts/validate-repository.sh" "$(cat <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

failures=0

if command -v python3 >/dev/null 2>&1; then
  echo "Checking JSON and Python syntax..."

  python3 - <<'PY'
import ast
import json
import sys
from pathlib import Path

ignored = {
    ".git", "node_modules", ".venv", "venv",
    "__pycache__", "dist", "build", ".next",
}
failures = []

for path in Path(".").rglob("*"):
    if not path.is_file() or any(part in ignored for part in path.parts):
        continue

    try:
        if path.suffix.lower() == ".json":
            json.loads(path.read_text(encoding="utf-8"))
        elif path.suffix.lower() == ".py":
            ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    except Exception as exc:
        failures.append(f"{path}: {exc}")

if failures:
    for item in failures:
        print(f"FAIL: {item}", file=sys.stderr)
    sys.exit(1)

print("JSON and Python syntax: PASS")
PY
else
  echo "WARNING: Python unavailable; JSON/Python checks skipped."
fi

if command -v node >/dev/null 2>&1; then
  echo "Checking JavaScript syntax..."

  while IFS= read -r -d '' file; do
    node --check "$file" || failures=1
  done < <(
    find . -type f \
      \( -name '*.js' -o -name '*.cjs' -o -name '*.mjs' \) \
      -not -path './.git/*' \
      -not -path './node_modules/*' \
      -not -path './*/node_modules/*' \
      -print0
  )
else
  echo "WARNING: Node.js unavailable; JavaScript checks skipped."
fi

if [[ "$failures" -ne 0 ]]; then
  echo "Repository validation failed." >&2
  exit 1
fi

echo "Repository validation completed."
EOF
)" || true

chmod +x scripts/validate-repository.sh

# ----------------------------------------------------------------------
# GitHub Actions validation workflow
# ----------------------------------------------------------------------

create_file ".github/workflows/repository-bootstrap-validation.yml" "$(cat <<'EOF'
name: Repository Bootstrap Validation

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: bootstrap-validation-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    name: Validate repository
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Install YAML validator
        run: python -m pip install --disable-pip-version-check "PyYAML==6.0.3"

      - name: Validate repository
        run: bash scripts/validate-repository.sh

      - name: Validate YAML files
        run: |
          python - <<'PY'
          from pathlib import Path
          import sys
          import yaml

          ignored = {".git", "node_modules", ".venv", "venv"}
          errors = []

          for path in Path(".").rglob("*"):
              if (
                  not path.is_file()
                  or path.suffix.lower() not in {".yaml", ".yml"}
                  or any(part in ignored for part in path.parts)
              ):
                  continue
              try:
                  list(yaml.safe_load_all(path.read_text(encoding="utf-8")))
                  print(f"PASS {path}")
              except Exception as exc:
                  errors.append(f"{path}: {exc}")

          if errors:
              print("\n".join(errors), file=sys.stderr)
              sys.exit(1)
          PY

      - name: Validate root npm lockfile if applicable
        run: |
          if [ -f package.json ]; then
            node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"
            if [ ! -s package-lock.json ]; then
              echo "::error::package.json exists but package-lock.json is missing or empty."
              exit 1
            fi
            npm ci --ignore-scripts --no-audit --no-fund
          else
            echo "No root package.json; npm install validation skipped."
          fi
EOF
)" || true

# ----------------------------------------------------------------------
# Validate generated baseline files
# ----------------------------------------------------------------------

log "Running generated repository checks..."

if command -v python3 >/dev/null 2>&1; then
  python3 -m py_compile python/main.py python/__init__.py
  python3 -m json.tool api/schemas/career.schema.json >/dev/null
  python3 -m json.tool api/schemas/jobs.schema.json >/dev/null
  python3 -m json.tool api/schemas/colleges.schema.json >/dev/null
fi

if command -v bash >/dev/null 2>&1; then
  bash -n scripts/validate-repository.sh
fi

if command -v node >/dev/null 2>&1; then
  if [[ -f package.json ]]; then
    node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"
  fi
fi

log "Files created or updated: $CREATED"
log "Existing files preserved: $SKIPPED"
log "File operation errors: $FAILED"

if ((FAILED > 0)); then
  die "Some files could not be created."
fi

# ----------------------------------------------------------------------
# Optional commit
# ----------------------------------------------------------------------

if [[ "$COMMIT" == true ]]; then
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
    die "--commit requires a Git repository."

  git add -- \
    .gitignore .npmrc .env.example requirements.txt pytest.ini \
    python api/schemas scripts/validate-repository.sh \
    .github/workflows/repository-bootstrap-validation.yml

  if git diff --cached --quiet; then
    log "No staged changes to commit."
  else
    git diff --cached --check
    git commit -m "chore: bootstrap repository validation files"
    log "Commit created. No push performed."
  fi
fi

log "CREATE.sh completed."
log "Review git status before committing or pushing."
