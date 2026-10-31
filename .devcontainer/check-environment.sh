
#!/usr/bin/env bash

set -Eeuo pipefail

echo "Development Environment Validation"

for command_name in node npm python3 git; do
    if command -v "$command_name" >/dev/null 2>&1; then
        echo "PASS: $command_name"
    else
        echo "FAIL: $command_name"
        exit 1
    fi
done

test -f /workspace/package.json && \
    echo "PASS: package.json" || \
    echo "INFO: package.json not present"

test -f /workspace/.env.example && \
    echo "PASS: .env.example" || \
    echo "INFO: Environment template not present"

echo "Validation completed."
