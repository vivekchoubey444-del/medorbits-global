
#!/usr/bin/env bash

# ==============================================================================
# MedOrbits / GHAR -- Post Creation Setup
# File: /.devcontainer/post-create.sh
# ==============================================================================

set -Eeuo pipefail

ROOT="/workspace"

cd "$ROOT"

echo "=========================================="
echo "MEDORBITS / GHAR DEVELOPMENT INITIALIZER"
echo "=========================================="

# Node.js
if command -v node >/dev/null 2>&1; then
    echo "Node: $(node --version)"
    echo "NPM: $(npm --version)"
else
    echo "ERROR: Node.js unavailable."
    exit 1
fi

# npm dependencies
if [[ -f package-lock.json ]]; then
    echo "Installing npm dependencies..."
    npm ci --no-audit --no-fund
elif [[ -f package.json ]]; then
    echo "WARNING: package-lock.json missing."
    echo "Run npm install manually after reviewing dependencies."
fi

# Python environment
if [[ -f requirements.txt || -f pyproject.toml ]]; then
    echo "Preparing Python virtual environment..."

    python3 -m venv .venv

    if [[ -f requirements.txt ]]; then
        .venv/bin/python -m pip install \
            --disable-pip-version-check \
            -r requirements.txt
    fi
fi

# Git configuration
git config --global --add safe.directory /workspace

# Permissions
chmod +x .husky/* 2>/dev/null || true

echo ""
echo "Development container initialized."
echo "No database migrations or deployments executed."
