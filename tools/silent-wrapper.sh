#!/usr/bin/env bash
# MedOrbits compatibility entry point.
# Canonical spelling for the legacy tools/silent-wrapler.sh implementation.
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
LEGACY="${SCRIPT_DIR}/silent-wrapler.sh"
[[ -f "$LEGACY" && ! -L "$LEGACY" ]] || {
  printf '[silent-wrapper] ERROR: legacy implementation not found: %s\n' "$LEGACY" >&2
  exit 2
}
exec bash "$LEGACY" "$@"
