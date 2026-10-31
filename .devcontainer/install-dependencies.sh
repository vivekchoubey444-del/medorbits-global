
#!/usr/bin/env bash

set -Eeuo pipefail

cd /workspace

if [[ -f package-lock.json ]]; then
    npm ci --no-audit --no-fund
elif [[ -f package.json ]]; then
    echo "Missing package-lock.json."
    echo "Create and review the lockfile before installation."
fi

if [[ -f requirements.txt ]]; then
    python3 -m venv .venv

    .venv/bin/python -m pip install \
        --disable-pip-version-check \
        -r requirements.txt
fi

echo "Dependency installation completed."
