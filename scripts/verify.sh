#!/usr/bin/env bash
set -uo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
FAIL=0
run() {
  local label="$1"; shift
  printf '\n== %s ==\n' "$label"
  if "$@"; then printf '[PASS] %s\n' "$label"; else printf '[FAIL] %s\n' "$label" >&2; FAIL=1; fi
}
command -v node >/dev/null 2>&1 || { echo "[ERROR] Node.js is required." >&2; exit 2; }
run "JSON validation" node "$SCRIPT_DIR/validate-json.js"
run "Data validation" node "$SCRIPT_DIR/validate-data.mjs"
run "HTML validation" node "$SCRIPT_DIR/validate-html.mjs"
run "Link validation" node "$SCRIPT_DIR/check-links.mjs"
run "Security configuration audit" node "$SCRIPT_DIR/check-security.mjs"
exit "$FAIL"
