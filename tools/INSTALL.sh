
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- INSTALL.sh
# File: tools/INSTALL.sh
# Version: 1.1.0
#
# Purpose:
#   Inspect and prepare the MedOrbits development environment.
#   Dependency installation requires explicit --install consent.
#
# Usage:
#   bash tools/INSTALL.sh
#   bash tools/INSTALL.sh --check-only
#   bash tools/INSTALL.sh --install
#   bash tools/INSTALL.sh --python-only
#   bash tools/INSTALL.sh --node-only
#   bash tools/INSTALL.sh --install --python-only
#   bash tools/INSTALL.sh --install --node-only
#
# Safety:
#   - Default mode does not install dependencies.
#   - npm ci runs only with explicit --install.
#   - Python dependencies install only inside the project virtual environment.
#   - Existing .env files are never overwritten.
#   - Lockfiles are never generated or modified intentionally.
#   - No sudo, deployment, database migrations or destructive Git operations.
#   - --check-only creates no logs, locks, or other files.
#
# Important:
#   npm ci removes and recreates node_modules. Use --install only when this
#   behavior is acceptable.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly VERSION="1.1.0"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
readonly LOG_DIR="${ROOT_DIR}/logs"
readonly STATE_DIR="${ROOT_DIR}/.local-agent"
readonly LOG_FILE="${LOG_DIR}/install.log"
readonly LOCK_DIR="${STATE_DIR}/install.lock"
readonly VENV_DIR="${ROOT_DIR}/.venv"

INSTALL=0
CHECK_ONLY=0
PYTHON_ONLY=0
NODE_ONLY=0
SKIP_PYTHON=0
SKIP_NODE=0
VERBOSE=0

PYTHON_CMD=""
NODE_CMD=""
NPM_CMD=""
LOCK_ACQUIRED=0
FAILURES=0
WARNINGS=0

usage() {
    cat <<'HELP'
MedOrbits INSTALL.sh v1.1.0

Usage:
  bash tools/INSTALL.sh [options]

Options:
  --install       Install dependencies from existing manifests and lockfiles.
  --check-only    Perform read-only checks; create no files.
  --python-only   Inspect or install only Python dependencies.
  --node-only     Inspect or install only Node.js dependencies.
  --skip-python   Skip Python checks and dependency handling.
  --skip-node     Skip Node.js checks and dependency handling.
  --no-install    Compatibility option; do not install dependencies.
  --verbose       Display additional diagnostic information.
  --help, -h      Display this help.

Examples:
  bash tools/INSTALL.sh
  bash tools/INSTALL.sh --check-only
  bash tools/INSTALL.sh --install
  bash tools/INSTALL.sh --install --python-only
  bash tools/INSTALL.sh --install --node-only

Safety:
  npm ci removes and recreates node_modules.
  Dependency installation therefore requires explicit --install.
  Python dependencies are installed only inside .venv.
HELP
}

die() {
    printf '[INSTALL] ERROR: %s\n' "$*" >&2
    exit 1
}

info() {
    printf '[INFO] %s\n' "$*"
}

warn() {
    WARNINGS=$((WARNINGS + 1))
    printf '[WARN] %s\n' "$*" >&2
}

error() {
    FAILURES=$((FAILURES + 1))
    printf '[ERROR] %s\n' "$*" >&2
}

log() {
    local level="$1"
    shift

    local message
    message="[$(date -Is 2>/dev/null || date)] [$level] $*"

    printf '%s\n' "$message"

    if [[ -n "${LOG_FILE:-}" ]]; then
        printf '%s\n' "$message" >> "$LOG_FILE"
    fi
}

run_logged() {
    local label="$1"
    shift

    log INFO "START: ${label}"

    if [[ -n "${LOG_FILE:-}" ]]; then
        if "$@" >> "$LOG_FILE" 2>&1; then
            log INFO "PASS: ${label}"
            return 0
        else
            local status=$?
            log ERROR "FAIL: ${label} (exit ${status})"
            return "$status"
        fi
    fi

    if "$@"; then
        log INFO "PASS: ${label}"
        return 0
    else
        local status=$?
        log ERROR "FAIL: ${label} (exit ${status})"
        return "$status"
    fi
}

has_file() {
    [[ -f "${ROOT_DIR}/$1" && ! -L "${ROOT_DIR}/$1" ]]
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

check_safe_directory() {
    local path="$1"

    [[ ! -L "$path" ]] || die "Refusing symbolic-link directory: $path"

    if [[ -e "$path" && ! -d "$path" ]]; then
        die "Expected a directory but found another file type: $path"
    fi
}

check_safe_file() {
    local path="$1"

    [[ ! -L "$path" ]] || die "Refusing symbolic-link file: $path"

    if [[ -e "$path" && ! -f "$path" ]]; then
        die "Expected a regular file: $path"
    fi
}

cleanup() {
    if (( LOCK_ACQUIRED == 1 )); then
        if [[ -d "$LOCK_DIR" && ! -L "$LOCK_DIR" ]]; then
            rm -f -- "${LOCK_DIR}/pid"
            rmdir -- "$LOCK_DIR" 2>/dev/null || true
        fi
    fi
}

on_signal() {
    local signal="$1"
    local status="$2"

    trap - INT TERM HUP
    printf '\n[INSTALL] Interrupted by %s.\n' "$signal" >&2
    exit "$status"
}

initialize_runtime() {
    check_safe_directory "$LOG_DIR"
    check_safe_directory "$STATE_DIR"
    check_safe_directory "$LOCK_DIR"

    mkdir -p -- "$LOG_DIR" "$STATE_DIR"

    [[ ! -L "$LOG_DIR" && ! -L "$STATE_DIR" ]] ||
        die "Runtime directory became a symbolic link."

    if ! mkdir -- "$LOCK_DIR" 2>/dev/null; then
        printf '[INSTALL] ERROR: Installer lock already exists: %s\n' \
            "$LOCK_DIR" >&2

        if [[ -f "${LOCK_DIR}/pid" && ! -L "${LOCK_DIR}/pid" ]]; then
            printf '[INSTALL] Lock PID: ' >&2
            cat -- "${LOCK_DIR}/pid" >&2
        fi

        printf '[INSTALL] Check whether another installer is running. Do not remove a live lock.\n' >&2
        exit 1
    fi

    LOCK_ACQUIRED=1

    printf '%s\n' "$$" > "${LOCK_DIR}/pid"
    chmod 600 "${LOCK_DIR}/pid"

    : >> "$LOG_FILE"
    chmod 600 "$LOG_FILE"
}

parse_args() {
    while (($#)); do
        case "$1" in
            --install)
                INSTALL=1
                ;;
            --check-only|--no-install)
                CHECK_ONLY=1
                ;;
            --python-only)
                PYTHON_ONLY=1
                ;;
            --node-only)
                NODE_ONLY=1
                ;;
            --skip-python)
                SKIP_PYTHON=1
                ;;
            --skip-node)
                SKIP_NODE=1
                ;;
            --verbose)
                VERBOSE=1
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                printf 'ERROR: Unknown option: %s\n' "$1" >&2
                usage >&2
                exit 2
                ;;
        esac

        shift
    done

    if (( PYTHON_ONLY && NODE_ONLY )); then
        die "--python-only and --node-only cannot be combined."
    fi

    if (( INSTALL && CHECK_ONLY )); then
        die "--install and --check-only cannot be combined."
    fi

    if (( PYTHON_ONLY )); then
        SKIP_NODE=1
    fi

    if (( NODE_ONLY )); then
        SKIP_PYTHON=1
    fi

    if (( SKIP_PYTHON && SKIP_NODE )); then
        die "Both Python and Node.js are skipped; nothing to inspect."
    fi
}

validate_python() {
    if ! command_exists python3; then
        warn "Python 3 is unavailable."
        return 0
    fi

    PYTHON_CMD="$(command -v python3)"

    local version
    version="$(
        "$PYTHON_CMD" -c \
            'import sys; print(".".join(map(str, sys.version_info[:3])))'
    )" || die "Unable to determine Python version."

    local major minor
    IFS=. read -r major minor _ <<< "$version"

    if (( major < 3 || (major == 3 && minor < 10) )); then
        die "Python 3.10 or newer is required. Detected ${version}."
    fi

    info "Python: ${version}"
}

validate_node() {
    if ! command_exists node; then
        warn "Node.js is unavailable."
        return 0
    fi

    NODE_CMD="$(command -v node)"

    local version major
    version="$("$NODE_CMD" --version 2>/dev/null)" ||
        die "Unable to determine Node.js version."

    major="${version#v}"
    major="${major%%.*}"

    [[ "$major" =~ ^[0-9]+$ ]] ||
        die "Invalid Node.js version response: ${version}"

    if (( major < 20 )); then
        die "Node.js 20 or newer is required. Detected ${version}."
    fi

    info "Node.js: ${version}"

    if command_exists npm; then
        NPM_CMD="$(command -v npm)"
        info "npm: $("$NPM_CMD" --version 2>/dev/null || printf unknown)"
    else
        warn "npm is unavailable."
    fi
}

validate_package_manifest() {
    check_safe_file "${ROOT_DIR}/package.json"
    check_safe_file "${ROOT_DIR}/package-lock.json"

    if ! has_file "package.json"; then
        info "No root package.json found."
        return 0
    fi

    [[ -n "$NODE_CMD" ]] ||
        die "package.json exists but Node.js is unavailable."

    [[ -n "$NPM_CMD" ]] ||
        die "package.json exists but npm is unavailable."

    run_logged "Validate package.json" \
        "$NODE_CMD" --input-type=module -e '
            import fs from "node:fs";

            const pkg = JSON.parse(
                fs.readFileSync("package.json", "utf8")
            );

            if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
                throw new Error("package.json root must be an object");
            }

            for (const key of [
                "scripts",
                "dependencies",
                "devDependencies",
                "engines"
            ]) {
                if (
                    pkg[key] !== undefined &&
                    (!pkg[key] || typeof pkg[key] !== "object" || Array.isArray(pkg[key]))
                ) {
                    throw new Error(`${key} must be an object`);
                }
            }

            console.log("package.json validation passed.");
        ' || die "package.json validation failed."

    if has_file "package-lock.json"; then
        run_logged "Validate package-lock.json syntax" \
            "$NODE_CMD" --input-type=module -e '
                import fs from "node:fs";

                const lock = JSON.parse(
                    fs.readFileSync("package-lock.json", "utf8")
                );

                if (!lock || typeof lock !== "object" || Array.isArray(lock)) {
                    throw new Error("package-lock.json root must be an object");
                }

                if (![1, 2, 3].includes(lock.lockfileVersion)) {
                    throw new Error("Unsupported or missing lockfileVersion");
                }

                console.log("package-lock.json syntax passed.");
            ' || die "package-lock.json validation failed."

        if (( INSTALL )); then
            log INFO "npm ci will recreate node_modules."

            run_logged "Install locked Node.js dependencies" \
                "$NPM_CMD" ci --no-audit ||
                die "npm ci failed. Review ${LOG_FILE}."
        else
            info "Node.js dependencies not installed. Use --install to install."
        fi
    else
        warn "package-lock.json is missing."
        info "No automatic lockfile generation will be attempted."
    fi
}

prepare_python_environment() {
    check_safe_file "${ROOT_DIR}/requirements.txt"
    check_safe_directory "$VENV_DIR"

    if ! has_file "requirements.txt"; then
        info "No root requirements.txt found."
        return 0
    fi

    [[ -n "$PYTHON_CMD" ]] ||
        die "requirements.txt exists but Python 3 is unavailable."

    if (( ! INSTALL )); then
        info "Python dependencies not installed. Use --install to install."

        if [[ -d "$VENV_DIR" ]]; then
            info "Existing virtual environment found."
        else
            info "No project virtual environment found."
        fi

        return 0
    fi

    if [[ ! -d "$VENV_DIR" ]]; then
        run_logged "Create Python virtual environment" \
            "$PYTHON_CMD" -m venv "$VENV_DIR" ||
            die "Could not create .venv. Check Python venv support."
    fi

    local venv_python

    if [[ -x "${VENV_DIR}/bin/python" ]]; then
        venv_python="${VENV_DIR}/bin/python"
    elif [[ -x "${VENV_DIR}/Scripts/python.exe" ]]; then
        venv_python="${VENV_DIR}/Scripts/python.exe"
    else
        die "Virtual environment Python executable is missing."
    fi

    run_logged "Verify virtual environment" \
        "$venv_python" --version ||
        die "Virtual environment is not usable."

    run_logged "Install Python requirements" \
        "$venv_python" -m pip install -r requirements.txt ||
        die "Python dependency installation failed. Review ${LOG_FILE}."
}

check_environment() {
    check_safe_file "${ROOT_DIR}/.env"
    check_safe_file "${ROOT_DIR}/.env.example"

    if has_file ".env.example"; then
        info ".env.example exists."
    else
        info "No root .env.example found."
    fi

    if has_file ".env"; then
        info ".env exists; existing configuration preserved."
    elif has_file ".env.example"; then
        warn ".env is missing. Create it manually and supply valid secrets."
    fi

    if [[ -n "${DATABASE_URL:-}" ]]; then
        info "DATABASE_URL is configured; value intentionally hidden."
    else
        info "DATABASE_URL is not configured in the current shell."
    fi
}

check_project_structure() {
    local paths=(
        "package.json"
        "package-lock.json"
        "requirements.txt"
        "server.js"
        "database/schema.sql"
        "tools/START.sh"
        "tools/VERIFY.sh"
        "tools/SCHEMA-CHECK.sh"
        "tools/SECURITY.sh"
    )

    for path in "${paths[@]}"; do
        if [[ -f "${ROOT_DIR}/${path}" && ! -L "${ROOT_DIR}/${path}" ]]; then
            info "FOUND: ${path}"
        else
            info "OPTIONAL/MISSING: ${path}"
        fi
    done
}

main() {
    parse_args "$@"

    cd -- "$ROOT_DIR" || die "Cannot access repository root."

    if (( CHECK_ONLY )); then
        info "MedOrbits INSTALL.sh v${VERSION}"
        info "Repository: ${ROOT_DIR}"
        info "Read-only check mode enabled."
    else
        initialize_runtime
        trap cleanup EXIT
        trap 'on_signal INT 130' INT
        trap 'on_signal TERM 143' TERM
        trap 'on_signal HUP 129' HUP

        log INFO "MedOrbits INSTALL.sh v${VERSION}"
        log INFO "Repository: ${ROOT_DIR}"
        log INFO "Dependency installation enabled: ${INSTALL}"
    fi

    if (( SKIP_PYTHON == 0 )); then
        validate_python
    fi

    if (( SKIP_NODE == 0 )); then
        validate_node
    fi

    if (( SKIP_NODE == 0 )); then
        validate_package_manifest
    fi

    if (( SKIP_PYTHON == 0 )); then
        prepare_python_environment
    fi

    check_environment
    check_project_structure

    if command_exists git; then
        info "Git: $(git --version 2>/dev/null || printf unknown)"
    else
        warn "Git is unavailable."
    fi

    if command_exists psql; then
        info "PostgreSQL client: $(psql --version 2>/dev/null || printf unknown)"
    else
        info "psql unavailable; no database operations will be performed."
    fi

    if (( CHECK_ONLY )); then
        info "Check-only completed. No files or dependencies were changed."
    elif (( INSTALL )); then
        log INFO "Dependency installation completed."
    else
        log INFO "Environment inspection completed. No dependencies installed."
    fi

    info "Warnings: ${WARNINGS}"
    info "Failures: ${FAILURES}"

    if [[ -n "${LOG_FILE:-}" ]]; then
        log INFO "Log file: ${LOG_FILE}"
    fi

    (( FAILURES == 0 ))
}

main "$@"
