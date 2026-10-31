
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits Repository Upgrade Utility
# File: tools/UPDATE.sh
# Version: 1.2.0
#
# Purpose:
#   Inspect repository tooling, validate source files, and optionally create
#   approved baseline documentation files when they do not already exist.
#
# Safety:
#   - Read-only inspection by default.
#   - --dry-run never writes project files or logs.
#   - --check-only never creates files or executes tests.
#   - Existing files are never overwritten or deleted.
#   - Symlinked paths are rejected for baseline creation.
#   - No automatic package installation or dependency upgrades.
#   - No deployments, migrations, cache deletion, or Git modifications.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_NAME="UPDATE.sh"
readonly SCRIPT_VERSION="1.2.0"

SCRIPT_DIR="$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &&
    pwd -P
)"

PROJECT_ROOT="${ENFORCE_ROOT:-$(cd -- "${SCRIPT_DIR}/.." && pwd -P)}"

PROJECT_ROOT="$(
    cd -- "$PROJECT_ROOT" 2>/dev/null &&
    pwd -P
)" || {
    printf '[ERROR] Project root does not exist.\n' >&2
    exit 2
}

DRY_RUN=0
CHECK_ONLY=0
CREATE_MISSING=0
RUN_TESTS=0
VERBOSE=0

LOG_FILE=""
ERRORS=0
WARNINGS=0
SKIPS=0

declare -a CREATED_FILES=()
declare -a CHECKS=()

# ------------------------------------------------------------------------------
# Logging
# ------------------------------------------------------------------------------

write_log() {
    local level="$1"
    shift

    local message="[$level] $*"

    if [[ "$level" == "ERROR" || "$level" == "WARN" ]]; then
        printf '%s\n' "$message" >&2
    else
        printf '%s\n' "$message"
    fi

    if [[ -n "$LOG_FILE" ]]; then
        printf '%s\n' "$message" >> "$LOG_FILE"
    fi
}

log() {
    write_log INFO "$@"
}

warn() {
    WARNINGS=$((WARNINGS + 1))
    write_log WARN "$@"
}

error() {
    ERRORS=$((ERRORS + 1))
    write_log ERROR "$@"
}

skip() {
    SKIPS=$((SKIPS + 1))
    write_log SKIP "$@"
}

die() {
    error "$@"
    exit 2
}

# ------------------------------------------------------------------------------
# Help
# ------------------------------------------------------------------------------

usage() {
    cat <<'USAGE'
MedOrbits Repository Upgrade Utility

Usage:
  bash tools/UPDATE.sh [options]

Options:
  --dry-run          Inspect without writing project files or logs.
  --check-only       Run checks only; do not create files or execute tests.
  --create-missing   Create approved baseline files when absent.
  --test             Run configured tests when safely detected.
  --log FILE         Write a log file.
  --verbose          Print additional diagnostics.
  --help, -h         Display help.
  --version          Display version.

Environment:
  ENFORCE_ROOT       Optional explicit repository root.

Safety:
  No automatic dependency installation, version upgrades, deployments,
  database migrations, cache deletion, or destructive Git operations.
USAGE
}

# ------------------------------------------------------------------------------
# Arguments
# ------------------------------------------------------------------------------

while (($#)); do
    case "$1" in
        --dry-run)
            DRY_RUN=1
            ;;

        --check-only)
            CHECK_ONLY=1
            ;;

        --create-missing)
            CREATE_MISSING=1
            ;;

        --test)
            RUN_TESTS=1
            ;;

        --log)
            shift
            (($#)) || die "--log requires a file path."
            LOG_FILE="$1"
            ;;

        --verbose)
            VERBOSE=1
            ;;

        --help|-h)
            usage
            exit 0
            ;;

        --version)
            printf '%s %s\n' "$SCRIPT_NAME" "$SCRIPT_VERSION"
            exit 0
            ;;

        *)
            die "Unknown option: $1. Use --help."
            ;;
    esac

    shift
done

if (( CHECK_ONLY )); then
    CREATE_MISSING=0
    RUN_TESTS=0
fi

# ------------------------------------------------------------------------------
# Log path validation
# ------------------------------------------------------------------------------

configure_logging() {
    if (( DRY_RUN || CHECK_ONLY )); then
        if [[ -n "$LOG_FILE" ]]; then
            printf '[WARN] Logging disabled in dry-run/check-only mode.\n' >&2
        fi

        LOG_FILE=""
        return 0
    fi

    [[ -n "$LOG_FILE" ]] || return 0

    local log_parent
    local log_name

    if [[ "$LOG_FILE" != /* ]]; then
        safe_relative_path "$LOG_FILE" ||
            die "Unsafe relative log path: $LOG_FILE"

        LOG_FILE="${PROJECT_ROOT}/${LOG_FILE}"
    fi

    log_parent="$(dirname -- "$LOG_FILE")"
    log_name="$(basename -- "$LOG_FILE")"

    [[ -n "$log_name" && "$log_name" != "." && "$log_name" != ".." ]] ||
        die "Invalid log filename."

    [[ -d "$log_parent" ]] ||
        die "Log directory must already exist: $log_parent"

    [[ ! -L "$LOG_FILE" ]] ||
        die "Refusing symlinked log file: $LOG_FILE"

    [[ ! -e "$LOG_FILE" || -f "$LOG_FILE" ]] ||
        die "Log path is not a regular file: $LOG_FILE"

    if [[ ! -e "$LOG_FILE" ]]; then
        (
            set -o noclobber
            : > "$LOG_FILE"
        ) 2>/dev/null ||
            die "Cannot create log file safely: $LOG_FILE"
    fi

    chmod 600 -- "$LOG_FILE" 2>/dev/null || true
}

# ------------------------------------------------------------------------------
# Utilities
# ------------------------------------------------------------------------------

has_command() {
    command -v "$1" >/dev/null 2>&1
}

relative_path() {
    local path="$1"
    printf '%s\n' "${path#"$PROJECT_ROOT"/}"
}

safe_relative_path() {
    local path="$1"
    local component

    [[ -n "$path" ]] || return 1
    [[ "$path" != /* ]] || return 1
    [[ "$path" != *$'\n'* ]] || return 1
    [[ "$path" != *$'\r'* ]] || return 1

    IFS='/' read -r -a components <<< "$path"

    for component in "${components[@]}"; do
        [[ -n "$component" ]] || return 1
        [[ "$component" != "." ]] || return 1
        [[ "$component" != ".." ]] || return 1
    done

    return 0
}

safe_existing_components() {
    local relative="$1"
    local current="$PROJECT_ROOT"
    local component
    local -a components

    safe_relative_path "$relative" || return 1

    IFS='/' read -r -a components <<< "$relative"

    for component in "${components[@]}"; do
        current="${current}/${component}"

        if [[ -L "$current" ]]; then
            return 1
        fi
    done

    return 0
}

check_command() {
    local cmd="$1"
    local required="${2:-0}"

    if has_command "$cmd"; then
        log "Available: $cmd ($(command -v "$cmd"))"
        CHECKS+=("PASS: command $cmd")

    elif [[ "$required" == "1" ]]; then
        error "Required command is missing: $cmd"
        CHECKS+=("FAIL: command $cmd")

    else
        skip "Optional command is missing: $cmd"
        CHECKS+=("SKIP: command $cmd")
    fi
}

# ------------------------------------------------------------------------------
# Baseline creation
# ------------------------------------------------------------------------------

ensure_file() {
    local relative="$1"
    local content="$2"

    local target
    local parent

    safe_relative_path "$relative" || {
        error "Refusing unsafe relative path: $relative"
        return 1
    }

    safe_existing_components "$relative" || {
        error "Refusing path containing a symlink: $relative"
        return 1
    }

    target="${PROJECT_ROOT}/${relative}"
    parent="$(dirname -- "$target")"

    if [[ -e "$target" || -L "$target" ]]; then
        log "Preserved existing path: $relative"
        return 0
    fi

    if (( CREATE_MISSING == 0 )); then
        log "Baseline absent; not creating without --create-missing: $relative"
        return 0
    fi

    if (( DRY_RUN )); then
        log "DRY RUN: would create $relative"
        return 0
    fi

    if ! mkdir -p -- "$parent"; then
        error "Could not create parent directory: $relative"
        return 1
    fi

    safe_existing_components "$relative" || {
        error "Path became unsafe during creation: $relative"
        return 1
    }

    # Exclusive creation: never truncate an existing file.
    if (
        set -o noclobber
        printf '%s\n' "$content" > "$target"
    ) 2>/dev/null; then

        chmod 644 -- "$target" 2>/dev/null || true

        CREATED_FILES+=("$relative")
        log "Created baseline file: $relative"

    else
        if [[ -e "$target" || -L "$target" ]]; then
            log "Preserved path created concurrently: $relative"
            return 0
        fi

        error "Could not create baseline file safely: $relative"
        return 1
    fi
}

create_baselines() {
    (( CHECK_ONLY == 0 )) || return 0

    ensure_file "tools/README.md" \
"# MedOrbits Tools

Repository utility scripts and development support tools.

## Safety

- Review scripts before execution.
- Prefer dry-run and check-only modes when available.
- Never commit secrets, tokens, private keys, or local credentials.
- Preserve uncommitted changes before repository-wide operations.
- Run tools from the repository root unless documented otherwise.
"

    ensure_file "tools/.gitignore" \
"# Local tool output and private configuration
*.log
*.tmp
*.bak
.env
.env.*
!.env.example
__pycache__/
*.py[cod]
"
}

# ------------------------------------------------------------------------------
# Git inspection
# ------------------------------------------------------------------------------

inspect_git() {
    if ! has_command git; then
        skip "Git checks unavailable"
        return 0
    fi

    if ! git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree \
        >/dev/null 2>&1; then
        warn "Project root is not a Git working tree."
        return 0
    fi

    log "Git repository detected."

    local branch
    local status
    local conflicts

    branch="$(
        git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || true
    )"

    log "Current branch: ${branch:-detached HEAD}"

    status="$(
        git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null || true
    )"

    if [[ -n "$status" ]]; then
        warn "Git working tree has changes; preserve and review them."

        if (( VERBOSE )); then
            printf '%s\n' "$status"
        fi
    else
        log "Git working tree is clean."
    fi

    conflicts="$(
        git -C "$PROJECT_ROOT" diff --name-only \
            --diff-filter=U 2>/dev/null || true
    )"

    if [[ -n "$conflicts" ]]; then
        error "Unresolved Git conflicts detected."
    fi
}

# ------------------------------------------------------------------------------
# Runtime inspection
# ------------------------------------------------------------------------------

inspect_runtime() {
    log "Checking runtime tools..."

    check_command bash 1
    check_command git 0
    check_command python3 0
    check_command node 0
    check_command npm 0
    check_command shellcheck 0
    check_command jq 0

    if has_command python3; then
        python3 --version
    fi

    if has_command node; then
        node --version
    fi

    if has_command npm; then
        npm --version
    fi
}

# ------------------------------------------------------------------------------
# Structure inspection
# ------------------------------------------------------------------------------

inspect_structure() {
    log "Inspecting repository structure..."

    local path

    local -a expected=(
        "tools"
        "assets"
        "pages"
        "api"
        "python"
        "tests"
        "README.md"
    )

    for path in "${expected[@]}"; do
        if [[ -e "${PROJECT_ROOT}/${path}" ]]; then
            log "Found: $path"
        else
            warn "Expected/recommended path not found: $path"
        fi
    done

    if (( VERBOSE )); then
        find "$PROJECT_ROOT" \
            -maxdepth 2 \
            -type f \
            ! -path '*/.git/*' \
            ! -path '*/node_modules/*' \
            ! -path '*/.venv/*' \
            -print 2>/dev/null |
            sort |
            sed -n '1,250p'
    fi
}

# ------------------------------------------------------------------------------
# Shell validation
# ------------------------------------------------------------------------------

validate_shell_files() {
    has_command bash || {
        skip "Shell validation requires Bash"
        return 0
    }

    log "Checking shell script syntax..."

    local file
    local found=0

    while IFS= read -r -d '' file; do
        found=1

        if bash -n "$file"; then
            log "Shell syntax OK: $(relative_path "$file")"
        else
            error "Shell syntax failure: $(relative_path "$file")"
        fi

    done < <(
        find "$PROJECT_ROOT" \
            \( -type d \( \
                -name .git -o \
                -name node_modules -o \
                -name .venv -o \
                -name venv -o \
                -name dist -o \
                -name build \
            \) -prune \) -o \
            \( -type f \( \
                -name '*.sh' -o \
                -name '*.bash' \
            \) -print0 \) \
            2>/dev/null
    )

    (( found )) || skip "No shell scripts found"
}

# ------------------------------------------------------------------------------
# Python validation
# ------------------------------------------------------------------------------

validate_python_files() {
    has_command python3 || {
        skip "Python validation requires Python 3"
        return 0
    }

    log "Checking Python syntax..."

    local file
    local found=0

    while IFS= read -r -d '' file; do
        found=1

        if python3 - "$file" <<'PY'
import ast
import pathlib
import sys
import tokenize

path = pathlib.Path(sys.argv[1])

try:
    with tokenize.open(path) as handle:
        source = handle.read()

    ast.parse(source, filename=str(path))

except (OSError, UnicodeError, SyntaxError, LookupError) as exc:
    print(f"FAIL: {path}: {exc}", file=sys.stderr)
    raise SystemExit(1)

print(f"OK: {path}")
PY
        then
            :
        else
            error "Python syntax failure: $(relative_path "$file")"
        fi

    done < <(
        find "$PROJECT_ROOT" \
            \( -type d \( \
                -name .git -o \
                -name node_modules -o \
                -name .venv -o \
                -name venv -o \
                -name dist -o \
                -name build \
            \) -prune \) -o \
            \( -type f -name '*.py' -print0 \) \
            2>/dev/null
    )

    (( found )) || skip "No Python files found"
}

# ------------------------------------------------------------------------------
# Strict JSON validation
# ------------------------------------------------------------------------------

validate_json_files() {
    log "Checking JSON files..."

    local file
    local found=0

    while IFS= read -r -d '' file; do
        found=1

        if has_command jq; then
            if jq empty "$file" >/dev/null 2>&1; then
                log "JSON OK: $(relative_path "$file")"
            else
                error "Invalid JSON: $(relative_path "$file")"
            fi

        elif has_command python3; then
            if python3 - "$file" <<'PY'
import json
import pathlib
import sys

def reject_constant(value):
    raise ValueError(f"Non-standard JSON constant: {value}")

def unique_object(pairs):
    result = {}

    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key!r}")
        result[key] = value

    return result

path = pathlib.Path(sys.argv[1])

try:
    with path.open("r", encoding="utf-8") as handle:
        json.load(
            handle,
            object_pairs_hook=unique_object,
            parse_constant=reject_constant,
        )

except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
    print(f"FAIL: {path}: {exc}", file=sys.stderr)
    raise SystemExit(1)

print(f"OK: {path}")
PY
            then
                log "JSON OK: $(relative_path "$file")"
            else
                error "Invalid JSON: $(relative_path "$file")"
            fi

        else
            warn "Cannot validate JSON without jq or Python: $(relative_path "$file")"
        fi

    done < <(
        find "$PROJECT_ROOT" \
            \( -type d \( \
                -name .git -o \
                -name node_modules -o \
                -name .venv -o \
                -name venv -o \
                -name dist -o \
                -name build \
            \) -prune \) -o \
            \( -type f -name '*.json' -print0 \) \
            2>/dev/null
    )

    (( found )) || skip "No JSON files found"
}

# ------------------------------------------------------------------------------
# Node project validation
# ------------------------------------------------------------------------------

validate_node_project() {
    local package_file="${PROJECT_ROOT}/package.json"

    [[ -f "$package_file" ]] || {
        skip "No root package.json; Node project checks not applicable"
        return 0
    }

    if has_command node; then
        if node - "$package_file" <<'NODE'
const fs = require("node:fs");

try {
    JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
NODE
        then
            log "package.json is valid JSON."
        else
            error "Invalid package.json."
        fi

    elif has_command python3; then
        if python3 - "$package_file" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    json.load(handle)
PY
        then
            log "package.json is valid JSON."
        else
            error "Invalid package.json."
        fi

    else
        skip "package.json validation requires Node.js or Python"
    fi

    if [[ -f "${PROJECT_ROOT}/package-lock.json" ||
          -f "${PROJECT_ROOT}/npm-shrinkwrap.json" ||
          -f "${PROJECT_ROOT}/yarn.lock" ||
          -f "${PROJECT_ROOT}/pnpm-lock.yaml" ]]; then
        log "A recognized Node dependency lockfile exists."
    else
        warn "No recognized Node dependency lockfile found."
    fi

    if [[ ! -d "${PROJECT_ROOT}/node_modules" ]]; then
        skip "node_modules absent; dependencies will not be installed automatically"
    fi
}

# ------------------------------------------------------------------------------
# Explicit test execution
# ------------------------------------------------------------------------------

run_available_tests() {
    (( RUN_TESTS )) || return 0

    if (( CHECK_ONLY )); then
        skip "Tests disabled by --check-only"
        return 0
    fi

    log "Checking configured test commands..."

    if [[ -f "${PROJECT_ROOT}/package.json" ]]; then
        if ! has_command npm || ! has_command node; then
            skip "npm tests require Node.js and npm"

        elif [[ ! -d "${PROJECT_ROOT}/node_modules" ]]; then
            skip "npm tests skipped because node_modules is absent"

        elif node - "${PROJECT_ROOT}/package.json" <<'NODE'
const fs = require("node:fs");

try {
    const packageJson = JSON.parse(
        fs.readFileSync(process.argv[2], "utf8")
    );

    process.exit(
        packageJson.scripts &&
        typeof packageJson.scripts.test === "string"
            ? 0
            : 1
    );
} catch {
    process.exit(1);
}
NODE
        then
            if (
                cd "$PROJECT_ROOT" &&
                npm test
            ); then
                log "npm test completed successfully."
            else
                error "npm test failed."
            fi

        else
            skip "No npm test script is configured."
        fi
    fi

    if [[ -d "${PROJECT_ROOT}/python/tests" ]]; then
        if has_command pytest; then
            if (
                cd "$PROJECT_ROOT" &&
                pytest -q python/tests
            ); then
                log "Python tests completed successfully."
            else
                error "Python tests failed."
            fi
        else
            skip "Python tests exist but pytest is unavailable."
        fi
    fi
}

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------

print_summary() {
    printf '\n%s\n' '============================================================'
    printf '%s\n' 'MedOrbits Upgrade Report'
    printf '%s\n' '============================================================'

    printf 'Version:         %s\n' "$SCRIPT_VERSION"
    printf 'Project root:    %s\n' "$PROJECT_ROOT"
    printf 'Dry run:         %s\n' "$DRY_RUN"
    printf 'Check only:      %s\n' "$CHECK_ONLY"
    printf 'Create missing:  %s\n' "$CREATE_MISSING"
    printf 'Tests requested: %s\n' "$RUN_TESTS"
    printf 'Created files:   %s\n' "${#CREATED_FILES[@]}"
    printf 'Warnings:        %s\n' "$WARNINGS"
    printf 'Errors:          %s\n' "$ERRORS"
    printf 'Skipped checks:  %s\n' "$SKIPS"

    if ((${#CREATED_FILES[@]})); then
        printf '\nCreated files:\n'
        printf '  - %s\n' "${CREATED_FILES[@]}"
    fi

    [[ -z "$LOG_FILE" ]] ||
        printf '\nLog file: %s\n' "$LOG_FILE"

    printf '%s\n' '============================================================'

    if (( ERRORS > 0 )); then
        printf '%s\n' 'Result: FAILED -- review errors before proceeding.'
    elif (( WARNINGS > 0 )); then
        printf '%s\n' 'Result: COMPLETED WITH WARNINGS.'
    else
        printf '%s\n' 'Result: COMPLETED.'
    fi
}

# ------------------------------------------------------------------------------
# Main
# ------------------------------------------------------------------------------

main() {
    configure_logging

    log "Starting ${SCRIPT_NAME} v${SCRIPT_VERSION}"
    log "Project root: ${PROJECT_ROOT}"

    inspect_runtime
    inspect_git
    inspect_structure

    create_baselines

    validate_shell_files
    validate_python_files
    validate_json_files
    validate_node_project

    run_available_tests

    print_summary

    if (( ERRORS > 0 )); then
        return 1
    fi

    return 0
}

main "$@"
