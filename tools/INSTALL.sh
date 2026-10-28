
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- INSTALL.sh
# File: /tools/INSTALL.sh
# Version: 1.0.0
#
# Purpose:
#   Safely prepare the MedOrbits development environment, install dependencies
#   from existing lockfiles, validate runtimes, and prepare local configuration.
#
# Usage:
#   bash tools/INSTALL.sh
#   bash tools/INSTALL.sh --check-only
#   bash tools/INSTALL.sh --python-only
#   bash tools/INSTALL.sh --node-only
#   bash tools/INSTALL.sh --skip-python
#   bash tools/INSTALL.sh --skip-node
#   bash tools/INSTALL.sh --help
#
# Safety:
#   - Does not delete project files or existing databases.
#   - Does not overwrite .env or other existing configuration.
#   - Does not regenerate lockfiles automatically.
#   - Does not install operating-system packages using sudo.
#   - Does not disable security checks to force installation success.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

VERSION="1.0.0"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
LOG_DIR="${ROOT_DIR}/logs"
STATE_DIR="${ROOT_DIR}/.local-agent"
LOG_FILE="${LOG_DIR}/install.log"
LOCK_DIR="${STATE_DIR}/install.lock"

CHECK_ONLY=0
PYTHON_ONLY=0
NODE_ONLY=0
SKIP_PYTHON=0
SKIP_NODE=0
PYTHON_CMD=""
VENV_DIR="${ROOT_DIR}/.venv"

for arg in "$@"; do
  case "$arg" in
    --check-only) CHECK_ONLY=1 ;;
    --python-only) PYTHON_ONLY=1 ;;
    --node-only) NODE_ONLY=1 ;;
    --skip-python) SKIP_PYTHON=1 ;;
    --skip-node) SKIP_NODE=1 ;;
    --help|-h)
      cat <<'HELP'
MedOrbits INSTALL.sh

Options:
  --check-only   Validate prerequisites without installing dependencies.
  --python-only  Only inspect/install Python dependencies.
  --node-only    Only inspect/install Node.js dependencies.
  --skip-python  Skip Python dependency handling.
  --skip-node    Skip Node.js dependency handling.
  --help         Display this help.

Examples:
  bash tools/INSTALL.sh
  bash tools/INSTALL.sh --check-only
  bash tools/INSTALL.sh --python-only

The script installs Node.js dependencies only when package-lock.json exists.
Python dependencies are installed only inside a virtual environment.
HELP
      exit 0
      ;;
    *)
      printf 'ERROR: Unknown option: %s\n' "$arg" >&2
      exit 2
      ;;
  esac
done

if (( PYTHON_ONLY == 1 && NODE_ONLY == 1 )); then
  printf 'ERROR: --python-only and --node-only cannot be combined.\n' >&2
  exit 2
fi

if (( PYTHON_ONLY == 1 )); then
  SKIP_NODE=1
fi

if (( NODE_ONLY == 1 )); then
  SKIP_PYTHON=1
fi

mkdir -p -- "$LOG_DIR" "$STATE_DIR"

if ! mkdir -- "$LOCK_DIR" 2>/dev/null; then
  printf 'ERROR: Installer lock exists: %s\n' "$LOCK_DIR" >&2
  printf 'Check whether another installer is running before removing a stale lock.\n' >&2
  exit 1
fi

cleanup() {
  rmdir -- "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

log() {
  local level="$1"
  shift
  local message="[$(date -Is 2>/dev/null || date)] [$level] $*"
  printf '%s\n' "$message"
  printf '%s\n' "$message" >> "$LOG_FILE"
}

die() {
  log ERROR "$*"
  exit 1
}

run_logged() {
  local label="$1"
  shift

  log INFO "START: ${label}"
  if "$@" >> "$LOG_FILE" 2>&1; then
    log INFO "PASS: ${label}"
  else
    local rc=$?
    log ERROR "FAIL: ${label} (exit ${rc})"
    return "$rc"
  fi
}

has_file() {
  [[ -f "${ROOT_DIR}/$1" ]]
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

cd -- "$ROOT_DIR" || die "Cannot access repository root."

log INFO "MedOrbits INSTALL.sh v${VERSION}"
log INFO "Repository: ${ROOT_DIR}"
log INFO "Check-only mode: ${CHECK_ONLY}"

# ------------------------------------------------------------------------------
# 1. Detect operating system and available runtimes.
# ------------------------------------------------------------------------------

if command_exists python3; then
  PYTHON_CMD="$(command -v python3)"
  log INFO "Python: $("$PYTHON_CMD" --version 2>&1)"
else
  log WARN "python3 is not installed."
fi

if command_exists node; then
  NODE_VERSION="$(node --version 2>/dev/null || true)"
  log INFO "Node.js: ${NODE_VERSION}"

  NODE_MAJOR="$(
    node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf '0'
  )"

  if [[ "$NODE_MAJOR" =~ ^[0-9]+$ ]] && (( NODE_MAJOR < 20 )); then
    die "Node.js 20 or newer is required. Detected ${NODE_VERSION}."
  fi
else
  log WARN "Node.js is not installed."
fi

if command_exists npm; then
  log INFO "npm: $(npm --version 2>/dev/null || printf unknown)"
fi

if command_exists git; then
  log INFO "Git: $(git --version 2>/dev/null || printf unknown)"
fi

# ------------------------------------------------------------------------------
# 2. Check package.json and lockfile consistency.
# ------------------------------------------------------------------------------

if (( SKIP_NODE == 0 )); then
  if has_file "package.json"; then
    command_exists node || die "package.json exists, but Node.js is unavailable."
    command_exists npm || die "package.json exists, but npm is unavailable."

    run_logged "Validate package.json" \
      node -e '
        const fs = require("node:fs");
        const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
        if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
          throw new Error("package.json must contain a JSON object");
        }
        if (!pkg.name) console.warn("Warning: package.json has no package name");
        console.log("package.json parsed successfully");
      ' || die "package.json validation failed."

    if has_file "package-lock.json"; then
      run_logged "Validate npm lockfile compatibility" \
        npm ls --package-lock-only --depth=0 || {
          log WARN "npm lockfile validation reported an issue."
          die "Resolve package manifest/lockfile inconsistencies before installation."
        }

      if (( CHECK_ONLY == 0 )); then
        run_logged "Install locked Node.js dependencies" \
          npm ci --no-audit || die "npm ci failed. See ${LOG_FILE}."
      else
        log INFO "Check-only: npm installation skipped."
      fi
    else
      log WARN "package-lock.json is missing."
      log INFO "No automatic npm install will be attempted without a lockfile."
      log INFO "Generate and review a lockfile separately, then rerun this script."
    fi
  else
    log INFO "No root package.json found."
  fi
fi

# ------------------------------------------------------------------------------
# 3. Prepare Python virtual environment and dependencies.
# ------------------------------------------------------------------------------

if (( SKIP_PYTHON == 0 )); then
  if [[ -n "$PYTHON_CMD" ]]; then
    if has_file "requirements.txt"; then
      if (( CHECK_ONLY == 1 )); then
        log INFO "Check-only: Python dependency installation skipped."
        if [[ -d "$VENV_DIR" ]]; then
          log INFO "Existing virtual environment found: ${VENV_DIR}"
        else
          log INFO "No virtual environment found: ${VENV_DIR}"
        fi
      else
        if [[ ! -d "$VENV_DIR" ]]; then
          log INFO "Creating project virtual environment: ${VENV_DIR}"
          run_logged "Create Python virtual environment" \
            "$PYTHON_CMD" -m venv "$VENV_DIR" ||
            die "Could not create .venv. Ensure the Python venv module is installed."
        fi

        VENV_PYTHON="${VENV_DIR}/bin/python"

        if [[ ! -x "$VENV_PYTHON" ]]; then
          die "Virtual environment Python executable not found: ${VENV_PYTHON}"
        fi

        run_logged "Verify virtual environment" \
          "$VENV_PYTHON" --version ||
          die "Virtual environment is not usable."

        run_logged "Install Python requirements" \
          "$VENV_PYTHON" -m pip install -r requirements.txt ||
          die "Python dependency installation failed. See ${LOG_FILE}."
      fi
    else
      log INFO "No root requirements.txt found."
    fi
  else
    log WARN "Python dependency setup skipped because python3 is unavailable."
  fi
fi

# ------------------------------------------------------------------------------
# 4. Check environment configuration without exposing secret values.
# ------------------------------------------------------------------------------

if has_file ".env.example"; then
  log INFO ".env.example exists."

  if has_file ".env"; then
    log INFO ".env exists; leaving the existing configuration untouched."
  elif (( CHECK_ONLY == 0 )); then
    log WARN ".env does not exist."
    log INFO "Create it manually from .env.example and supply valid local secrets."
    log INFO "The installer will not copy placeholder credentials into .env."
  fi
else
  log INFO "No root .env.example found."
fi

# ------------------------------------------------------------------------------
# 5. Validate common project structure.
# ------------------------------------------------------------------------------

for path in \
  "package.json" \
  "requirements.txt" \
  "server.js" \
  "database/schema.sql" \
  "tools/START.sh" \
  "tools/VERIFY.sh" \
  "tools/SCHEMA-CHECK.sh" \
  "tools/SECURITY.sh"
do
  if [[ -f "${ROOT_DIR}/${path}" ]]; then
    log INFO "FOUND: ${path}"
  else
    log INFO "OPTIONAL/MISSING: ${path}"
  fi
done

# ------------------------------------------------------------------------------
# 6. Report available PostgreSQL tools; never initialize or modify the database.
# ------------------------------------------------------------------------------

if command_exists psql; then
  log INFO "PostgreSQL client: $(psql --version 2>/dev/null || printf unknown)"
else
  log INFO "psql is not installed; database setup is not performed by this installer."
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  log INFO "DATABASE_URL is configured (value intentionally not displayed)."
else
  log INFO "DATABASE_URL is not configured in the current shell."
fi

# ------------------------------------------------------------------------------
# 7. Completion summary.
# ------------------------------------------------------------------------------

log INFO "Installation preparation completed."
log INFO "Log file: ${LOG_FILE}"

if (( CHECK_ONLY == 1 )); then
  log INFO "Check-only run completed; no dependencies were installed."
fi

log INFO "Next step: bash tools/START.sh"
exit 0
