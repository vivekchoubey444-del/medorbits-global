
#!/usr/bin/env bash

# ==============================================================================
# MedOrbits / GHAR -- Post Start Checks
# File: /.devcontainer/post-start.sh
# ==============================================================================

set -u

cd /workspace || exit 1

echo "=========================================="
echo "DEVELOPMENT ENVIRONMENT STATUS"
echo "=========================================="

echo "Node.js:"
node --version 2>/dev/null || echo "Unavailable"

echo "npm:"
npm --version 2>/dev/null || echo "Unavailable"

echo "Python:"
python3 --version 2>/dev/null || echo "Unavailable"

echo "Git:"
git --version 2>/dev/null || echo "Unavailable"

echo "PostgreSQL:"
if command -v pg_isready >/dev/null 2>&1; then
    pg_isready -h postgres -p 5432 \
        -U medorbits || echo "Database not ready."
fi

echo "=========================================="
echo "Environment check completed."
