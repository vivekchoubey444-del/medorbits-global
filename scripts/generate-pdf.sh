#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
if [[ -f "$SCRIPT_DIR/create-notice-checklist-pdf.js" ]]; then
  echo "[INFO] Running notice checklist PDF generator."
  exec node "$SCRIPT_DIR/create-notice-checklist-pdf.js" "$@"
fi
if [[ -f "$SCRIPT_DIR/brand-pdfs.js" ]]; then
  echo "[INFO] Running branded PDF generator."
  exec node "$SCRIPT_DIR/brand-pdfs.js" "$@"
fi
echo "[ERROR] No supported PDF generator was found in $SCRIPT_DIR." >&2
exit 2
