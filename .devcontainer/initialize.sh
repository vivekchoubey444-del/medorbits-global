
#!/usr/bin/env bash

# ==============================================================================
# MedOrbits / GHAR -- Manual Initialization
# File: /.devcontainer/initialize.sh
# ==============================================================================

set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

echo "Initializing development environment..."

command -v node >/dev/null
command -v npm >/dev/null
command -v python3 >/dev/null

if [[ ! -f package.json ]]; then
    echo "No root package.json found."
else
    echo "Node.js project detected."
fi

if [[ -f package-lock.json ]]; then
    npm ci --no-audit --no-fund
fi

if [[ -f requirements.txt ]]; then
    python3 -m venv .venv
    .venv/bin/python -m pip install -r requirements.txt
fi

echo "Initialization completed."
