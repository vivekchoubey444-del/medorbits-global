#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
CHECKER="$SCRIPT_DIR/check-security.mjs"
[[ -f "$CHECKER" ]] || { echo "[ERROR] Missing $CHECKER" >&2; exit 2; }
exec node "$CHECKER" "$@"
