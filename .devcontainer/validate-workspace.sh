
#!/usr/bin/env bash

set -Eeuo pipefail

cd /workspace

echo "Checking repository configuration..."

python3 - <<'PY'
import json
from pathlib import Path

errors = []

for path in Path(".").rglob("*.json"):
    if any(part in {".git", "node_modules", ".venv", "venv"} for part in path.parts):
        continue

    try:
        json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"{path}: {exc}")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    raise SystemExit(1)

print("JSON validation passed.")
PY

echo "Workspace validation completed."
