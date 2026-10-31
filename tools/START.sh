
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- START.sh
# File: tools/START.sh
# Version: 1.1.0
#
# Purpose:
#   Inspect, validate, optionally install dependencies, run configured checks,
#   and optionally start the MedOrbits application.
#
# Requirements:
#   Bash 4+
#   Python 3.10+
#   Node.js 20+
#   npm
#   Git (optional)
#
# Usage:
#   bash tools/START.sh
#   bash tools/START.sh --check-only
#   bash tools/START.sh --install
#   bash tools/START.sh --no-server
#   bash tools/START.sh --install --no-server
#
# Safety:
#   - Dependency installation requires explicit --install.
#   - No automatic lockfile regeneration.
#   - No database migrations.
#   - No Git history modification.
#   - No cache deletion.
#   - No secret printing.
#   - No server startup after failed checks.
# ==============================================================================

set -uo pipefail
IFS=$'\n\t'
umask 077

readonly VERSION="1.1.0"
readonly SCRIPT_NAME="START.sh"

SCRIPT_DIR="$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &&
    pwd -P
)"

ROOT_DIR="$(
    cd -- "${SCRIPT_DIR}/.." &&
    pwd -P
)" || {
    printf '[ERROR] Cannot determine repository root.\n' >&2
    exit 2
}

readonly LOG_DIR="${ROOT_DIR}/logs"
readonly STATE_DIR="${ROOT_DIR}/.local-agent"
readonly LOG_FILE="${LOG_DIR}/start.log"
readonly LOCK_DIR="${STATE_DIR}/start.lock"

CHECK_ONLY=0
INSTALL=0
NO_SERVER=0
VERBOSE=0

INSTALL_ATTEMPTS=2

FAILED=0
WARNINGS=0
SKIPS=0
PASSED=0

LOCK_ACQUIRED=0
LOGGING_ENABLED=0

declare -a CREATED_FILES=()
declare -a CHECKS=()

# ------------------------------------------------------------------------------
# Help
# ------------------------------------------------------------------------------

usage() {
    cat <<'HELP'
MedOrbits START.sh

Usage:
  bash tools/START.sh [options]

Options:
  --check-only       Run checks without installing or starting services.
  --install          Explicitly install dependencies from existing lockfiles.
  --no-install       Disable dependency installation.
  --no-server        Do not start the application.
  --verbose          Print additional diagnostics.
  --help, -h         Display help.
  --version          Display version.

Installation behavior:
  npm ci is used only with an existing package-lock.json.
  Python requirements are installed only inside an active virtual environment.
  No lockfiles are generated or modified intentionally.

Safety:
  No automatic deployments, database migrations, cache deletion,
  destructive Git operations, or secret printing.
HELP
}

# ------------------------------------------------------------------------------
# Argument parsing
# ------------------------------------------------------------------------------

while (($#)); do
    case "$1" in
        --check-only)
            CHECK_ONLY=1
            ;;

        --install)
            INSTALL=1
            ;;

        --no-install)
            INSTALL=0
            ;;

        --no-server)
            NO_SERVER=1
            ;;

        --verbose)
            VERBOSE=1
            ;;

        --help|-h)
            usage
            exit 0
            ;;

        --version)
            printf '%s %s\n' "$SCRIPT_NAME" "$VERSION"
            exit 0
            ;;

        *)
            printf '[ERROR] Unknown option: %s\n' "$1" >&2
            printf 'Use --help for usage.\n' >&2
            exit 2
            ;;
    esac

    shift
done

# Check-only always disables installation and server startup.
if (( CHECK_ONLY )); then
    INSTALL=0
    NO_SERVER=1
fi

# ------------------------------------------------------------------------------
# Logging
# ------------------------------------------------------------------------------

log() {
    local level="$1"
    shift

    local timestamp
    local line

    timestamp="$(date -Is 2>/dev/null || date)"
    line="[$timestamp] [$level] $*"

    printf '%s\n' "$line"

    if (( LOGGING_ENABLED )); then
        printf '%s\n' "$line" >> "$LOG_FILE" 2>/dev/null || true
    fi
}

info() {
    log INFO "$@"
}

warn() {
    WARNINGS=$((WARNINGS + 1))
    log WARN "$@"
}

error() {
    FAILED=$((FAILED + 1))
    log ERROR "$@"
}

skip() {
    SKIPS=$((SKIPS + 1))
    log SKIP "$@"
}

pass() {
    PASSED=$((PASSED + 1))
    log PASS "$@"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

has_file() {
    [[ -f "${ROOT_DIR}/$1" && ! -L "${ROOT_DIR}/$1" ]]
}

# ------------------------------------------------------------------------------
# Locking and cleanup
# ------------------------------------------------------------------------------

cleanup() {
    local status=$?

    if (( LOCK_ACQUIRED )); then
        rm -f -- "${LOCK_DIR}/pid" 2>/dev/null || true
        rmdir -- "$LOCK_DIR" 2>/dev/null || true
    fi

    return "$status"
}

handle_signal() {
    local signal="$1"

    log WARN "Received ${signal}; stopping."
    exit 130
}

trap cleanup EXIT
trap 'handle_signal INT' INT
trap 'handle_signal TERM' TERM

initialize_runtime() {
    if (( CHECK_ONLY )); then
        info "Check-only mode: persistent logs and lock files are disabled."
        return 0
    fi

    mkdir -p -- "$LOG_DIR" "$STATE_DIR" || {
        printf '[ERROR] Cannot create runtime directories.\n' >&2
        return 1
    }

    if [[ -L "$LOG_DIR" || -L "$STATE_DIR" || -L "$LOCK_DIR" ]]; then
        printf '[ERROR] Runtime paths cannot be symlinks.\n' >&2
        return 1
    fi

    if ! mkdir -- "$LOCK_DIR" 2>/dev/null; then
        printf '[ERROR] Another START.sh process may be running.\n' >&2
        printf 'Lock directory: %s\n' "$LOCK_DIR" >&2
        printf 'Inspect the process before removing a stale lock.\n' >&2
        return 1
    fi

    LOCK_ACQUIRED=1

    printf '%s\n' "$$" > "${LOCK_DIR}/pid" || {
        printf '[ERROR] Could not write lock PID.\n' >&2
        return 1
    }

    touch -- "$LOG_FILE" || {
        printf '[ERROR] Cannot create log file.\n' >&2
        return 1
    }

    chmod 600 -- "$LOG_FILE" 2>/dev/null || true

    LOGGING_ENABLED=1
}

# ------------------------------------------------------------------------------
# Safe command execution
# ------------------------------------------------------------------------------

run_step() {
    local label="$1"
    shift

    info "START: $label"

    if (( LOGGING_ENABLED )); then
        if "$@" >> "$LOG_FILE" 2>&1; then
            pass "$label"
            return 0
        else
            local status=$?
            error "$label failed (exit ${status})."
            return "$status"
        fi
    else
        if "$@"; then
            pass "$label"
            return 0
        else
            local status=$?
            error "$label failed (exit ${status})."
            return "$status"
        fi
    fi
}

# ------------------------------------------------------------------------------
# Runtime version checks
# ------------------------------------------------------------------------------

check_python_version() {
    command_exists python3 || {
        error "Python 3 is required but not installed."
        return 1
    }

    python3 - <<'PY'
import sys

minimum = (3, 10)
current = sys.version_info[:2]

print(
    f"Python: {sys.version.split()[0]}"
)

if current < minimum:
    print(
        f"ERROR: Python {minimum[0]}.{minimum[1]} or newer is required.",
        file=sys.stderr,
    )
    raise SystemExit(1)
PY
}

check_node_version() {
    command_exists node || {
        warn "Node.js is unavailable."
        return 0
    }

    node - <<'NODE'
const version = process.versions.node;
const major = Number(version.split(".")[0]);

console.log(`Node.js: ${version}`);

if (!Number.isInteger(major) || major < 20) {
    console.error("ERROR: Node.js 20 or newer is required.");
    process.exit(1);
}
NODE
}

inspect_runtime() {
    info "Inspecting runtime environment."

    if ! run_step "Python version requirement" check_python_version; then
        return 1
    fi

    if command_exists node; then
        if ! run_step "Node.js version requirement" check_node_version; then
            return 1
        fi
    else
        warn "Node.js is unavailable; JavaScript checks and server startup may be unavailable."
    fi

    if command_exists npm; then
        info "npm: $(npm --version 2>/dev/null || printf unknown)"
    else
        warn "npm is unavailable."
    fi

    if command_exists git; then
        info "Git: $(git --version 2>/dev/null || printf unknown)"
    fi

    if command_exists shellcheck; then
        info "ShellCheck is available."
    fi

    if command_exists jq; then
        info "jq is available."
    fi

    return 0
}

# ------------------------------------------------------------------------------
# Repository inspection
# ------------------------------------------------------------------------------

inspect_git() {
    command_exists git || {
        skip "Git inspection unavailable."
        return 0
    }

    if ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree \
        >/dev/null 2>&1; then
        warn "Repository root is not a Git working tree."
        return 0
    fi

    info "Git repository detected."

    local branch
    local status
    local conflicts

    branch="$(
        git -C "$ROOT_DIR" branch --show-current 2>/dev/null || true
    )"

    info "Branch: ${branch:-detached HEAD}"

    status="$(
        git -C "$ROOT_DIR" status --porcelain 2>/dev/null || true
    )"

    if [[ -n "$status" ]]; then
        warn "Git working tree contains changes."

        if (( VERBOSE )); then
            printf '%s\n' "$status"
        fi
    else
        pass "Git working tree is clean."
    fi

    conflicts="$(
        git -C "$ROOT_DIR" diff --name-only \
            --diff-filter=U 2>/dev/null || true
    )"

    if [[ -n "$conflicts" ]]; then
        error "Unresolved Git conflicts detected."
    fi
}

inspect_structure() {
    info "Inspecting repository structure."

    local path

    local -a expected=(
        "package.json"
        "README.md"
        "tools"
        "assets"
        "pages"
        "tests"
    )

    for path in "${expected[@]}"; do
        if [[ -e "${ROOT_DIR}/${path}" ]]; then
            pass "Found: $path"
        else
            warn "Recommended path missing: $path"
        fi
    done

    if (( VERBOSE )); then
        find "$ROOT_DIR" \
            -maxdepth 2 \
            -type f \
            ! -path '*/.git/*' \
            ! -path '*/node_modules/*' \
            ! -path '*/.venv/*' \
            -print 2>/dev/null |
            sort |
            sed -n '1,200p'
    fi
}

# ------------------------------------------------------------------------------
# Package manifest validation
# ------------------------------------------------------------------------------

validate_package_json() {
    [[ -f "${ROOT_DIR}/package.json" ]] || {
        skip "No root package.json."
        return 0
    }

    command_exists node || {
        skip "package.json validation requires Node.js."
        return 0
    }

    node - "${ROOT_DIR}/package.json" <<'NODE'
const fs = require("node:fs");

const filename = process.argv[2];

try {
    const packageJson = JSON.parse(
        fs.readFileSync(filename, "utf8")
    );

    if (
        !packageJson ||
        typeof packageJson !== "object" ||
        Array.isArray(packageJson)
    ) {
        throw new Error("package.json must contain a JSON object.");
    }

    if (typeof packageJson.name !== "string") {
        console.error("WARNING: package.json has no valid name.");
    }

    console.log("package.json syntax is valid.");
} catch (error) {
    console.error(`Invalid package.json: ${error.message}`);
    process.exit(1);
}
NODE
}

# ------------------------------------------------------------------------------
# Python syntax validation
# ------------------------------------------------------------------------------

validate_python_files() {
    python3 - "$ROOT_DIR" <<'PY'
import ast
import os
import pathlib
import sys
import tokenize

root = pathlib.Path(sys.argv[1]).resolve()

excluded = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".tox",
    "dist",
    "build",
    "coverage",
}

files = []
errors = []

for base, dirs, names in os.walk(root, followlinks=False):
    dirs[:] = [
        name for name in dirs
        if name not in excluded
        and not (pathlib.Path(base) / name).is_symlink()
    ]

    for name in names:
        if not name.endswith(".py"):
            continue

        path = pathlib.Path(base) / name

        if path.is_symlink():
            continue

        files.append(path)

for path in sorted(files):
    try:
        with tokenize.open(path) as handle:
            source = handle.read()

        ast.parse(source, filename=str(path))

    except (OSError, UnicodeError, SyntaxError, LookupError) as exc:
        errors.append((path, exc))

if errors:
    for path, exc in errors:
        print(f"PYTHON ERROR: {path}: {exc}", file=sys.stderr)

    raise SystemExit(1)

print(f"Python syntax validation passed: {len(files)} file(s).")
PY
}

# ------------------------------------------------------------------------------
# Shell syntax validation
# ------------------------------------------------------------------------------

validate_shell_files() {
    command_exists bash || {
        skip "Shell validation requires Bash."
        return 0
    }

    local file
    local found=0
    local failed=0

    while IFS= read -r -d '' file; do
        found=1

        if bash -n "$file"; then
            (( VERBOSE )) && info "Shell syntax OK: ${file#"$ROOT_DIR"/}"
        else
            error "Shell syntax failure: ${file#"$ROOT_DIR"/}"
            failed=1
        fi

    done < <(
        find "$ROOT_DIR" \
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

    if (( found == 0 )); then
        skip "No shell files found."
    elif (( failed == 0 )); then
        pass "Shell syntax validation."
    fi

    return "$failed"
}

# ------------------------------------------------------------------------------
# JSON validation
# ------------------------------------------------------------------------------

validate_json_files() {
    local file
    local found=0
    local failed=0

    while IFS= read -r -d '' file; do
        found=1

        if command_exists jq; then
            if jq empty "$file" >/dev/null 2>&1; then
                (( VERBOSE )) && info "JSON OK: ${file#"$ROOT_DIR"/}"
            else
                error "Invalid JSON: ${file#"$ROOT_DIR"/}"
                failed=1
            fi

        else
            if python3 - "$file" <<'PY'
import json
import sys

def reject_constant(value):
    raise ValueError(f"Non-standard JSON constant: {value}")

def unique_object(pairs):
    result = {}

    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate key: {key!r}")
        result[key] = value

    return result

try:
    with open(sys.argv[1], encoding="utf-8") as handle:
        json.load(
            handle,
            object_pairs_hook=unique_object,
            parse_constant=reject_constant,
        )
except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
    print(f"JSON ERROR: {exc}", file=sys.stderr)
    raise SystemExit(1)
PY
            then
                (( VERBOSE )) && info "JSON OK: ${file#"$ROOT_DIR"/}"
            else
                error "Invalid JSON: ${file#"$ROOT_DIR"/}"
                failed=1
            fi
        fi

    done < <(
        find "$ROOT_DIR" \
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

    if (( found == 0 )); then
        skip "No JSON files found."
    elif (( failed == 0 )); then
        pass "JSON validation."
    fi

    return "$failed"
}

# ------------------------------------------------------------------------------
# Explicit dependency installation
# ------------------------------------------------------------------------------

install_dependencies() {
    (( INSTALL )) || {
        skip "Dependency installation disabled; use --install to enable."
        return 0
    }

    (( CHECK_ONLY == 0 )) || {
        skip "Installation disabled in check-only mode."
        return 0
    }

    if has_file "package-lock.json"; then
        command_exists npm || {
            error "npm is required for npm dependency installation."
            return 1
        }

        local attempt=1
        local installed=0

        while (( attempt <= INSTALL_ATTEMPTS )); do
            info "npm ci attempt ${attempt}/${INSTALL_ATTEMPTS}"

            if (
                cd "$ROOT_DIR" &&
                npm ci --no-audit
            ); then
                installed=1
                pass "npm dependencies installed from package-lock.json."
                break
            fi

            warn "npm ci failed on attempt ${attempt}."
            attempt=$((attempt + 1))
        done

        if (( installed == 0 )); then
            error "npm ci failed after retries."
            return 1
        fi

    elif has_file "package.json"; then
        warn "package.json exists without package-lock.json; npm installation skipped."
    fi

    if has_file "requirements.txt"; then
        if [[ -z "${VIRTUAL_ENV:-}" ]]; then
            warn "Python dependencies were not installed: activate a virtual environment first."
        else
            info "Installing Python requirements into the active virtual environment."

            if python3 -m pip install -r requirements.txt; then
                pass "Python requirements installed."
            else
                error "Python requirements installation failed."
                return 1
            fi
        fi
    fi

    return 0
}

# ------------------------------------------------------------------------------
# Configured project checks
# ------------------------------------------------------------------------------

run_project_checks() {
    if (( CHECK_ONLY )); then
        skip "Application test scripts disabled in check-only mode."
        return 0
    fi

    if ! has_file "package.json"; then
        skip "No package.json; npm checks unavailable."
        return 0
    fi

    if ! command_exists node || ! command_exists npm; then
        skip "Node.js/npm unavailable; npm checks skipped."
        return 0
    fi

    if [[ ! -d "${ROOT_DIR}/node_modules" ]]; then
        skip "node_modules is absent; npm checks skipped."
        return 0
    fi

    local script

    for script in lint test; do
        if node - "$ROOT_DIR/package.json" "$script" <<'NODE'
const fs = require("node:fs");

const file = process.argv[2];
const name = process.argv[3];

try {
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));

    process.exit(
        pkg.scripts &&
        typeof pkg.scripts[name] === "string"
            ? 0
            : 1
    );
} catch {
    process.exit(1);
}
NODE
        then
            if ! run_step "npm run ${script}" npm run "$script"; then
                continue
            fi
        else
            skip "No npm ${script} script configured."
        fi
    done

    if [[ -d "${ROOT_DIR}/python/tests" ]]; then
        if command_exists pytest; then
            run_step "Python test suite" \
                python3 -m pytest -q python/tests || true
        else
            skip "pytest unavailable; Python tests not run."
        fi
    fi
}

# ------------------------------------------------------------------------------
# Optional repository checks
# ------------------------------------------------------------------------------

run_optional_checks() {
    local script
    local -a scripts=(
        "tools/VERIFY.sh"
        "tools/SCHEMA-CHECK.sh"
        "tools/SECURITY.sh"
    )

    for script in "${scripts[@]}"; do
        if ! has_file "$script"; then
            (( VERBOSE )) && info "Optional check not present: $script"
            continue
        fi

        if [[ -x "${ROOT_DIR}/${script}" ]]; then
            run_step "$script" "${ROOT_DIR}/${script}" || true
        else
            run_step "$script via Bash" \
                bash "${ROOT_DIR}/${script}" || true
        fi
    done
}

# ------------------------------------------------------------------------------
# Database connectivity
# ------------------------------------------------------------------------------

check_database() {
    if [[ -z "${DATABASE_URL:-}" ]]; then
        skip "DATABASE_URL is not configured."
        return 0
    fi

    if ! command_exists psql; then
        warn "DATABASE_URL is configured but psql is unavailable."
        return 0
    fi

    info "Checking PostgreSQL connectivity."

    # Never print DATABASE_URL or credentials.
    if psql "$DATABASE_URL" \
        -X \
        -v ON_ERROR_STOP=1 \
        -q \
        -c 'SELECT 1;' \
        >/dev/null 2>&1; then

        pass "PostgreSQL connectivity."
    else
        warn "PostgreSQL connectivity check failed; verify credentials, network, and database availability."
    fi
}

# ------------------------------------------------------------------------------
# Server startup
# ------------------------------------------------------------------------------

start_server() {
    (( CHECK_ONLY == 0 )) || {
        info "Server startup disabled in check-only mode."
        return 0
    }

    (( NO_SERVER == 0 )) || {
        info "Server startup disabled by --no-server."
        return 0
    }

    if (( FAILED > 0 )); then
        error "Server startup blocked because validation failures exist."
        return 1
    fi

    if ! has_file "package.json"; then
        skip "No package.json; server startup unavailable."
        return 0
    fi

    if ! command_exists npm || ! command_exists node; then
        skip "Node.js/npm unavailable; server not started."
        return 0
    fi

    if [[ ! -d "${ROOT_DIR}/node_modules" ]]; then
        skip "node_modules is absent; server not started."
        return 0
    fi

    if ! node - "$ROOT_DIR/package.json" <<'NODE'
const fs = require("node:fs");

try {
    const pkg = JSON.parse(
        fs.readFileSync(process.argv[2], "utf8")
    );

    process.exit(
        pkg.scripts &&
        typeof pkg.scripts.start === "string"
            ? 0
            : 1
    );
} catch {
    process.exit(1);
}
NODE
    then
        skip "No npm start script configured."
        return 0
    fi

    info "Starting MedOrbits with npm start."
    info "Press Ctrl+C to stop the application."

    cd "$ROOT_DIR" || return 1

    # The application becomes the foreground process.
    exec npm start
}

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------

print_summary() {
    printf '\n%s\n' '============================================================'
    printf '%s\n' 'MedOrbits Startup Report'
    printf '%s\n' '============================================================'

    printf 'Version:       %s\n' "$VERSION"
    printf 'Repository:    %s\n' "$ROOT_DIR"
    printf 'Check-only:    %s\n' "$CHECK_ONLY"
    printf 'Install:       %s\n' "$INSTALL"
    printf 'No-server:     %s\n' "$NO_SERVER"
    printf 'Passed:        %s\n' "$PASSED"
    printf 'Warnings:      %s\n' "$WARNINGS"
    printf 'Failures:      %s\n' "$FAILED"
    printf 'Skipped:       %s\n' "$SKIPS"

    printf '%s\n' '============================================================'

    if (( FAILED > 0 )); then
        printf '%s\n' 'Result: FAILED.'
    elif (( WARNINGS > 0 )); then
        printf '%s\n' 'Result: COMPLETED WITH WARNINGS.'
    else
        printf '%s\n' 'Result: COMPLETED.'
    fi

    if (( LOGGING_ENABLED )); then
        printf 'Log: %s\n' "$LOG_FILE"
    fi
}

# ------------------------------------------------------------------------------
# Main
# ------------------------------------------------------------------------------

main() {
    initialize_runtime || return 1

    info "MedOrbits START.sh v${VERSION}"
    info "Repository: ${ROOT_DIR}"

    if ! inspect_runtime; then
        info "Required runtime validation failed."
        print_summary
        return 1
    fi

    inspect_git
    inspect_structure

    if has_file "package.json"; then
        if ! run_step "Validate package.json" validate_package_json; then
            info "Package manifest validation failed."
        fi
    fi

    run_step "Compile Python source files" \
        validate_python_files || true

    run_step "Validate shell syntax" \
        validate_shell_files || true

    run_step "Validate JSON files" \
        validate_json_files || true

    install_dependencies || true

    run_optional_checks
    run_project_checks
    check_database

    if (( FAILED == 0 )); then
        info "Validation phase completed without recorded failures."
    else
        info "Validation completed with failures; server startup will be blocked."
    fi

    print_summary

    if (( FAILED > 0 )); then
        return 1
    fi

    start_server
}

main "$@"
