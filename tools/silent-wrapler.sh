
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- Silent Command Wrapper
#
# File: tools/silent-wrapper.sh
# Version: 1.0.0
#
# Usage:
#   bash tools/silent-wrapper.sh -- command [arguments...]
#   bash tools/silent-wrapper.sh --log-file storage/logs/build.log -- npm run build
#   bash tools/silent-wrapper.sh --quiet-success -- npm test
#
# Options:
#   --                  End wrapper options and start the command.
#   --quiet-success     Suppress command output on success.
#   --log-file PATH     Save command output to a repository-local log.
#   --help              Display help.
#
# Behavior:
#   - Preserves the command's exit code.
#   - Prints captured output if the command fails.
#   - Does not use eval or execute a command string.
#   - Does not hide errors from the caller.
#   - Does not delete existing logs.
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

usage() {
    cat <<'USAGE'
MedOrbits Silent Command Wrapper

Usage:
  bash tools/silent-wrapper.sh [options] -- command [arguments...]

Options:
  --quiet-success     Hide command output if the command succeeds.
  --log-file PATH     Append output to a repository-local log file.
  --help              Show this help.

Examples:
  bash tools/silent-wrapper.sh --quiet-success -- npm test

  bash tools/silent-wrapper.sh \
    --log-file storage/logs/build.log -- npm run build

Exit status:
  Returns the command's exit code when it executes successfully.
  Returns a nonzero wrapper error code if setup or logging fails.
USAGE
}

die() {
    printf '[silent-wrapper] ERROR: %s\n' "$*" >&2
    exit 2
}

resolve_log_path() {
    local input="$1"

    python3 - "$REPO_ROOT" "$input" <<'PY'
import os
import sys

root = os.path.realpath(sys.argv[1])
raw = os.path.expanduser(sys.argv[2])

candidate = raw if os.path.isabs(raw) else os.path.join(root, raw)
candidate = os.path.abspath(candidate)

try:
    if os.path.commonpath((root, candidate)) != root:
        raise ValueError("log path is outside the repository")
except ValueError as exc:
    raise SystemExit(str(exc))

current = root
relative = os.path.relpath(candidate, root)

if relative == ".":
    raise SystemExit("log path must name a file")

for component in relative.split(os.sep):
    current = os.path.join(current, component)
    if os.path.islink(current):
        raise SystemExit("symbolic links are not allowed in log path")

if os.path.exists(candidate) and not os.path.isfile(candidate):
    raise SystemExit("log path is not a regular file")

print(candidate)
PY
}

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
}

run_with_log() {
    local log_path="$1"
    shift

    local log_dir
    log_dir="$(dirname -- "$log_path")"

    mkdir -p -- "$log_dir" ||
        die "Cannot create log directory: $log_dir"

    # Recheck the path after creating its parent directory.
    [[ ! -L "$log_path" ]] ||
        die "Refusing to write through a symbolic link: $log_path"

    [[ ! -e "$log_path" || -f "$log_path" ]] ||
        die "Log destination is not a regular file: $log_path"

    local temp_output
    temp_output="$(mktemp "${TMPDIR:-/tmp}/medorbits-wrapper.XXXXXXXX")" ||
        die "Cannot create temporary output file."

    local status=0

    # Capture stdout and stderr without losing the command's exit status.
    "$@" >"$temp_output" 2>&1 || status=$?

    if ! cat -- "$temp_output" >>"$log_path"; then
        cat -- "$temp_output" >&2 || true
        rm -f -- "$temp_output"
        die "Could not append command output to log."
    fi

    if ((status == 0)); then
        if ((QUIET_SUCCESS == 0)); then
            cat -- "$temp_output"
        fi
    else
        printf '[silent-wrapper] Command failed with exit code %s\n' \
            "$status" >&2
        cat -- "$temp_output" >&2
    fi

    rm -f -- "$temp_output"
    return "$status"
}

main() {
    parse_args "$@"

    if [[ -n "$LOG_FILE" ]]; then
        command -v python3 >/dev/null 2>&1 ||
            die "Python 3 is required for safe log-path validation."

        local resolved_log
        resolved_log="$(resolve_log_path "$LOG_FILE")" ||
            die "Invalid log path."

        run_with_log "$resolved_log" "${COMMAND[@]}"
        return $?
    fi

    if ((QUIET_SUCCESS)); then
        local temp_output
        temp_output="$(mktemp "${TMPDIR:-/tmp}/medorbits-wrapper.XXXXXXXX")" ||
            die "Cannot create temporary output file."

        local status=0
        "${COMMAND[@]}" >"$temp_output" 2>&1 || status=$?

        if ((status == 0)); then
            :
        else
            printf '[silent-wrapper] Command failed with exit code %s\n' \
                "$status" >&2
            cat -- "$temp_output" >&2
        fi

        rm -f -- "$temp_output"
        return "$status"
    fi

    "${COMMAND[@]}"
}

main "$@"
