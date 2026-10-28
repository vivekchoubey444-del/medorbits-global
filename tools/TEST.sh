#!/usr/bin/env bash
# ==============================================================================
# MedOrbits Test Runner
# File: tools/TEST.sh
# Version: 1.1.0
#
# Purpose:
#   Run non-destructive syntax and JSON validation checks for repository files.
#
# Safety:
#   - Does not install dependencies.
#   - Does not execute application code.
#   - Does not modify repository source files.
#   - Excludes common generated/dependency directories.
# ==============================================================================

set -uo pipefail
IFS=$'\n\t'

readonly SCRIPT_NAME="TEST.sh"
readonly SCRIPT_VERSION="1.1.0"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="${ENFORCE_ROOT:-$(cd -- "${SCRIPT_DIR}/.." && pwd -P)}"
ROOT_DIR="$(cd -- "$ROOT_DIR" 2>/dev/null && pwd -P)" || {
    printf '[ERROR] Repository root does not exist.\n' >&2
    exit 2
}

MODE="all"
PASS=0
FAIL=0
SKIP=0
declare -a FAILURES=()

usage() {
    cat <<'HELP'
MedOrbits Test Runner

Usage:
  bash tools/TEST.sh [options]

Options:
  --quick         Core Python, JavaScript, Bash and JSON syntax checks.
  --python-only   Python syntax checks only.
  --node-only     JavaScript syntax checks only.
  --shell-only    Bash syntax checks only.
  --json-only     JSON syntax checks only.
  --all           Run all available core checks (default).
  --help, -h      Show help.
  --version       Show version.

Environment:
  ENFORCE_ROOT    Optional repository root directory.

No dependencies are installed. Source files are not modified, and application
code is not executed. Checks unavailable because a runtime is missing are
reported as skipped, not passed.
HELP
}

while (($#)); do
    case "$1" in
        --quick) MODE="quick" ;;
        --python-only) MODE="python" ;;
        --node-only) MODE="node" ;;
        --shell-only) MODE="shell" ;;
        --json-only) MODE="json" ;;
        --all) MODE="all" ;;
        --help|-h) usage; exit 0 ;;
        --version) printf '%s %s\n' "$SCRIPT_NAME" "$SCRIPT_VERSION"; exit 0 ;;
        *) printf '[ERROR] Unknown option: %s\n' "$1" >&2; usage >&2; exit 2 ;;
    esac
    shift
done

pass() {
    PASS=$((PASS + 1))
    printf '[PASS] %s\n' "$*"
}

fail() {
    FAIL=$((FAIL + 1))
    FAILURES+=("$*")
    printf '[FAIL] %s\n' "$*" >&2
}

skip() {
    SKIP=$((SKIP + 1))
    printf '[SKIP] %s\n' "$*"
}

relpath() {
    printf '%s\n' "${1#"$ROOT_DIR"/}"
}

# Uses NUL-delimited paths so spaces and unusual characters are handled safely.
find_files() {
    local pattern="$1"
    find "$ROOT_DIR" \
        \( -type d \( \
            -name .git -o \
            -name node_modules -o \
            -name vendor -o \
            -name .venv -o \
            -name venv -o \
            -name __pycache__ -o \
            -name dist -o \
            -name build -o \
            -name coverage -o \
            -name .next -o \
            -name .pytest_cache -o \
            -name .mypy_cache -o \
            -name .ruff_cache \
        \) -prune \) -o \
        \( -type f -name "$pattern" -print0 \) 2>/dev/null
}

run_python_checks() {
    if ! command -v python3 >/dev/null 2>&1; then
        skip "Python syntax checks (python3 unavailable)"
        return
    fi

    local file found=0
    while IFS= read -r -d '' file; do
        found=1
        if python3 - "$file" <<'PY'
import ast
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
try:
    source = path.read_text(encoding="utf-8-sig")
    ast.parse(source, filename=str(path))
except (OSError, UnicodeError, SyntaxError) as exc:
    print(f"{path}: {exc}", file=sys.stderr)
    raise SystemExit(1)
PY
        then
            pass "Python syntax: $(relpath "$file")"
        else
            fail "Python syntax: $(relpath "$file")"
        fi
    done < <(find_files '*.py')

    (( found )) || skip "No Python files found"
}

run_node_checks() {
    if ! command -v node >/dev/null 2>&1; then
        skip "JavaScript syntax checks (node unavailable)"
        return
    fi

    local file found=0 output
    while IFS= read -r -d '' file; do
        found=1
        # node --check parses the file; it does not run the application.
        if output="$(node --check "$file" 2>&1)"; then
            pass "JavaScript syntax: $(relpath "$file")"
        else
            fail "JavaScript syntax: $(relpath "$file")"
            if [[ -n "$output" ]]; then
                printf '%s\n' "$output" | sed -n '1,8p' >&2
            fi
        fi
    done < <(find_files '*.js')

    (( found )) || skip "No .js files found"
}

run_shell_checks() {
    if ! command -v bash >/dev/null 2>&1; then
        skip "Bash syntax checks (bash unavailable)"
        return
    fi

    local file found=0 output
    while IFS= read -r -d '' file; do
        found=1
        if output="$(bash -n "$file" 2>&1)"; then
            pass "Shell syntax: $(relpath "$file")"
        else
            fail "Shell syntax: $(relpath "$file")"
            if [[ -n "$output" ]]; then
                printf '%s\n' "$output" | sed -n '1,8p' >&2
            fi
        fi
    done < <(find_files '*.sh')

    (( found )) || skip "No shell scripts found"
}

run_json_checks() {
    local validator=""
    if command -v jq >/dev/null 2>&1; then
        validator="jq"
    elif command -v python3 >/dev/null 2>&1; then
        validator="python3"
    else
        skip "JSON syntax checks (install neither; requires jq or python3)"
        return
    fi

    local file found=0 output
    while IFS= read -r -d '' file; do
        found=1
        if [[ "$validator" == "jq" ]]; then
            if output="$(jq empty "$file" 2>&1)"; then
                pass "JSON syntax: $(relpath "$file")"
            else
                fail "JSON syntax: $(relpath "$file")"
                [[ -z "$output" ]] || printf '%s\n' "$output" | sed -n '1,8p' >&2
            fi
        else
            if output="$(python3 -m json.tool "$file" >/dev/null 2>&1)"; then
                pass "JSON syntax: $(relpath "$file")"
            else
                fail "JSON syntax: $(relpath "$file")"
                printf '%s\n' "$output" | sed -n '1,8p' >&2
            fi
        fi
    done < <(find_files '*.json')

    (( found )) || skip "No JSON files found"
}

case "$MODE" in
    all|quick)
        run_python_checks
        run_node_checks
        run_shell_checks
        run_json_checks
        ;;
    python)
        run_python_checks
        ;;
    node)
        run_node_checks
        ;;
    shell)
        run_shell_checks
        ;;
    json)
        run_json_checks
        ;;
esac

printf '\n'
printf '%s\n' '============================================================'
printf '%s\n' 'MedOrbits Test Summary'
printf '%s\n' '============================================================'
printf 'Repository: %s\n' "$ROOT_DIR"
printf 'Mode:       %s\n' "$MODE"
printf 'Passed:     %d\n' "$PASS"
printf 'Failed:     %d\n' "$FAIL"
printf 'Skipped:    %d\n' "$SKIP"
printf '%s\n' '============================================================'

if (( FAIL > 0 )); then
    printf 'Failed checks:\n' >&2
    printf ' - %s\n' "${FAILURES[@]}" >&2
    exit 1
fi

printf '[RESULT] No failures in the checks that ran.\n'
if (( SKIP > 0 )); then
    printf '[NOTE] Some checks were skipped; this is not a full pass of every check.\n'
fi
exit 0
