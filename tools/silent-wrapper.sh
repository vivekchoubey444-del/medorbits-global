
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits Compatibility Entry Point
# File: tools/silent-wrapper.sh
# Version: 1.1.0
#
# Purpose:
#   Preserve the canonical wrapper name while delegating execution to the
#   legacy tools/silent-wrapler.sh implementation.
#
# Safety:
#   - Does not modify repository files.
#   - Does not execute downloaded code.
#   - Rejects missing or symlinked legacy implementations.
#   - Preserves all command-line arguments.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'

readonly VERSION="1.1.0"
readonly SCRIPT_NAME="silent-wrapper.sh"

SCRIPT_DIR="$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &&
    pwd -P
)" || {
    printf '[%s] ERROR: Cannot determine script directory.\n' \
        "$SCRIPT_NAME" >&2
    exit 2
}

readonly LEGACY="${SCRIPT_DIR}/silent-wrapler.sh"

if [[ ! -f "$LEGACY" || -L "$LEGACY" ]]; then
    printf '[%s] ERROR: Legacy implementation is missing or unsafe.\n' \
        "$SCRIPT_NAME" >&2
    printf 'Expected: %s\n' "$LEGACY" >&2
    exit 2
fi

if [[ ! -r "$LEGACY" ]]; then
    printf '[%s] ERROR: Legacy implementation is not readable.\n' \
        "$SCRIPT_NAME" >&2
    exit 2
fi

exec bash -- "$LEGACY" "$@"
