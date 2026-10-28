#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- Silent Command Wrapper
#
# File: tools/silent-wrapler.sh (legacy filename; see silent-wrapper.sh)
# Version: 2.0.0
#
# Usage:
#   bash tools/silent-wrapper.sh -- command [arguments...]
#   bash tools/silent-wrapper.sh --log-file storage/logs/build.log -- npm run build
#   bash tools/silent-wrapper.sh --quiet-success -- npm test
#
# Options:
#   --                  End wrapper options and start the command.
#   --quiet-success     Suppress command output on success.
#   --log-file PATH     Append command output to a repository-local log.
#   --help, -h          Display help.
#
# Safety:
#   - Executes argument arrays directly; never uses eval.
#   - Preserves the command's exit code unless wrapper setup/logging fails.
#   - Prints captured output on command failure.
#   - Does not delete or truncate existing logs.
#   - Rejects log paths outside the repository and symlink components.
#   - Cleans up temporary output files on normal exit and common signals.
#   - Does not print command arguments, which may contain secrets.
#
# Notes:
#   - A command's output is captured before it is displayed or logged.
#   - Capturing output means command output is not streamed live.
#   - Requires Bash 4+ and Python 3 when --log-file is used.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_DIR="$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P
)"
readonly REPO_ROOT="$(
    cd -- "${SCRIPT_DIR}/.." && pwd -P
)"

QUIET_SUCCESS=0
LOG_FILE=""
COMMAND=()
TEMP_OUTPUT=""

usage() {
    cat <<'USAGE'
MedOrbits Silent Command Wrapper v2.0.0

Usage:
  bash tools/silent-wrapper.sh [options] -- command [arguments...]

Options:
  --quiet-success     Suppress command output when the command succeeds.
  --log-file PATH     Append output to a repository-local log file.
  --help, -h          Show this help.

Examples:
  bash tools/silent-wrapper.sh --quiet-success -- npm test

  bash tools/silent-wrapper.sh \
    --log-file storage/logs/build.log -- npm run build

  bash tools/silent-wrapper.sh --log-file reports/check.log -- \
    python3 tools/medorbits_repo_toolkit.py --root . validate

Exit status:
  Command exit status is preserved when wrapper operations succeed.
  Wrapper setup, validation, or logging failures return a nonzero status.
USAGE
}

die() {
    printf '[silent-wrapper] ERROR: %s\n' "$*" >&2
    exit 2
}

cleanup() {
    if [[ -n "${TEMP_OUTPUT:-}" && -f "${TEMP_OUTPUT:-}" ]]; then
        rm -f -- "$TEMP_OUTPUT" 2>/dev/null || true
    fi
}

on_signal() {
    local signal="$1"
    local status="$2"
    trap - INT TERM HUP
    printf '[silent-wrapper] Interrupted by %s.\n' "$signal" >&2
    exit "$status"
}

trap cleanup EXIT
trap 'on_signal INT 130' INT
trap 'on_signal TERM 143' TERM
trap 'on_signal HUP 129' HUP

parse_args() {
    while (($#)); do
        case "$1" in
            --help|-h)
                usage
                exit 0
                ;;
            --quiet-success)
                QUIET_SUCCESS=1
                shift
                ;;
            --log-file)
                (($# >= 2)) || die "--log-file requires a path."
                [[ -n "$2" ]] || die "--log-file path cannot be empty."
                LOG_FILE="$2"
                shift 2
                ;;
            --)
                shift
                COMMAND=("$@")
                break
                ;;
            *)
                die "Unknown option: $1. Use --help for usage."
                ;;
        esac
    done

    ((${#COMMAND[@]} > 0)) ||
        die "No command provided. Use -- command [arguments...]."

    [[ -n "${COMMAND[0]}" ]] || die "Command executable cannot be empty."
}

resolve_log_path() {
    local input="$1"

    python3 - "$REPO_ROOT" "$input" <<'PY'
import os
import sys

root = os.path.realpath(sys.argv[1])
raw = os.path.expanduser(sys.argv[2])

if not raw:
    raise SystemExit("log path cannot be empty")

candidate = raw if os.path.isabs(raw) else os.path.join(root, raw)
candidate = os.path.abspath(candidate)

try:
    if os.path.commonpath((root, candidate)) != root:
        raise SystemExit("log path is outside the repository")
except ValueError:
    raise SystemExit("log path is outside the repository")

relative = os.path.relpath(candidate, root)
if relative == ".":
    raise SystemExit("log path must name a file")

# Reject symlinks in every existing path component. Do not resolve candidate
# first: resolving it would hide the symlink components we need to detect.
current = root
for component in relative.split(os.sep):
    if component in ("", ".", ".."):
        raise SystemExit("invalid path component")
    current = os.path.join(current, component)
    if os.path.islink(current):
        raise SystemExit("symbolic links are not allowed in the log path")

if os.path.lexists(candidate) and not os.path.isfile(candidate):
    raise SystemExit("log path is not a regular file")

print(candidate)
PY
}

make_temp_output() {
    local template="${TMPDIR:-/tmp}/medorbits-wrapper.XXXXXXXX"
    TEMP_OUTPUT="$(mktemp "$template")" ||
        die "Cannot create temporary output file."
    chmod 600 -- "$TEMP_OUTPUT" ||
        die "Cannot secure temporary output file."
}

validate_log_destination() {
    local log_path="$1"
    local log_dir
    log_dir="$(dirname -- "$log_path")"

    # Create parent directories, then validate again because filesystem state
    # may have changed since the initial path-resolution step.
    mkdir -p -- "$log_dir" ||
        die "Cannot create log directory: $log_dir"

    [[ ! -L "$log_path" ]] ||
        die "Refusing to write through a symbolic link: $log_path"

    [[ ! -e "$log_path" || -f "$log_path" ]] ||
        die "Log destination is not a regular file: $log_path"

    # If the file already exists, preserve its permissions. For a new file,
    # umask 077 makes it private by default.
    if [[ ! -e "$log_path" ]]; then
        (set -o noclobber; : > "$log_path") 2>/dev/null ||
            [[ -f "$log_path" && ! -L "$log_path" ]] ||
            die "Cannot create log file: $log_path"
    fi

    [[ -f "$log_path" && ! -L "$log_path" ]] ||
        die "Log destination changed or is not a regular file: $log_path"

    # Verify the final directory remains within the repository.
    python3 - "$REPO_ROOT" "$log_path" <<'PY'
import os
import sys

root = os.path.realpath(sys.argv[1])
path = os.path.abspath(sys.argv[2])
parent = os.path.realpath(os.path.dirname(path))
try:
    if os.path.commonpath((root, parent)) != root:
        raise SystemExit("log directory resolves outside repository")
except ValueError:
    raise SystemExit("log directory resolves outside repository")
PY
}

append_log() {
    local source_file="$1"
    local log_path="$2"

    # Re-check just before append. This narrows, but cannot eliminate, races
    # against another process with write access to the same repository.
    [[ ! -L "$log_path" ]] ||
        die "Log destination became a symbolic link: $log_path"
    [[ -f "$log_path" ]] ||
        die "Log destination is no longer a regular file: $log_path"

    if ! cat -- "$source_file" >> "$log_path"; then
        printf '[silent-wrapper] ERROR: Could not append output to log: %s\n' \
            "$log_path" >&2
        return 1
    fi
}

run_captured() {
    local log_path="${1:-}"
    shift || true

    make_temp_output

    local status=0
    "$@" >"$TEMP_OUTPUT" 2>&1 || status=$?

    if [[ -n "$log_path" ]]; then
        if ! append_log "$TEMP_OUTPUT" "$log_path"; then
            printf '[silent-wrapper] Command exit code: %s\n' "$status" >&2
            cat -- "$TEMP_OUTPUT" >&2 || true
            return 3
        fi
    fi

    if ((status == 0)); then
        if ((QUIET_SUCCESS == 0)); then
            cat -- "$TEMP_OUTPUT"
        fi
    else
        printf '[silent-wrapper] Command failed with exit code %s\n' \
            "$status" >&2
        cat -- "$TEMP_OUTPUT" >&2 || true
    fi

    return "$status"
}

main() {
    parse_args "$@"

    if [[ -n "$LOG_FILE" ]]; then
        command -v python3 >/dev/null 2>&1 ||
            die "Python 3 is required for safe log-path validation."

        local resolved_log
        if ! resolved_log="$(resolve_log_path "$LOG_FILE")"; then
            die "Invalid log path."
        fi

        validate_log_destination "$resolved_log"
        run_captured "$resolved_log" "${COMMAND[@]}"
        return $?
    fi

    if ((QUIET_SUCCESS)); then
        run_captured "" "${COMMAND[@]}"
        return $?
    fi

    # Normal pass-through mode: no capture, no temporary file, and terminal
    # output remains live. The shell returns the executed command's status.
    "${COMMAND[@]}"
}

main "$@"
