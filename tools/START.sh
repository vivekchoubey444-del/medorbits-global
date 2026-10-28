
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- START.sh
# File: /tools/START.sh
# Purpose: Start the project, recover from recoverable failures, and execute
#          available repository checks without silently skipping failures.
# Requirements: Bash, Python 3.10+, Node.js 20+, npm, Git (optional)
# Usage:
#   bash tools/START.sh
#   bash tools/START.sh --check-only
#   bash tools/START.sh --no-install
#   bash tools/START.sh --no-server
# ==============================================================================

set -uo pipefail
IFS=$'\n\t'
umask 077

VERSION="1.0.0"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
LOG_DIR="${ROOT_DIR}/logs"
STATE_DIR="${ROOT_DIR}/.local-agent"
LOG_FILE="${LOG_DIR}/start.log"
LOCK_DIR="${STATE_DIR}/start.lock"

CHECK_ONLY=0
NO_INSTALL=0
NO_SERVER=0
INSTALL_ATTEMPTS=2
FAILED=0
WARNINGS=0
START_SERVER=0

for arg in "$@"; do
  case "$arg" in
    --check-only) CHECK_ONLY=1 ;;
    --no-install) NO_INSTALL=1 ;;
    --no-server) NO_SERVER=1 ;;
    --help|-h)
      cat <<'HELP'
MedOrbits START.sh

Options:
  --check-only   Run available checks without installing or starting services.
  --no-install   Skip dependency installation.
  --no-server    Run setup and checks without starting the server.
  --help         Show this help.

Safety:
  This script does not delete project files, disable security controls,
  overwrite secrets, or force successful results after failed checks.
HELP
      exit 0
      ;;
    *)
      printf 'ERROR: Unknown option: %s\n' "$arg" >&2
      exit 2
      ;;
  esac
done

mkdir -p -- "$LOG_DIR" "$STATE_DIR" || {
  printf 'ERROR: Cannot create log/state directories.\n' >&2
  exit 1
}

if ! mkdir -- "$LOCK_DIR" 2>/dev/null; then
  printf 'ERROR: Another START.sh process may be running.\n' >&2
  printf 'Lock directory: %s\n' "$LOCK_DIR" >&2
  printf 'Inspect the process before removing a stale lock.\n' >&2
  exit 1
fi

cleanup() {
  rmdir -- "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

log() {
  local level="$1"
  shift
  local line
  line="[$(date -Is 2>/dev/null || date)] [$level] $*"
  printf '%s\n' "$line"
  printf '%s\n' "$line" >> "$LOG_FILE" 2>/dev/null || true
}

run_step() {
  local label="$1"
  shift

  log INFO "START: $label"
  if "$@" >> "$LOG_FILE" 2>&1; then
    log INFO "PASS: $label"
    return 0
  else
    local rc=$?
    log ERROR "FAIL: $label (exit=$rc)"
    FAILED=$((FAILED + 1))
    return "$rc"
  fi
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

has_file() {
  [[ -f "$ROOT_DIR/$1" ]]
}

cd -- "$ROOT_DIR" || {
  log ERROR "Cannot enter repository root."
  exit 1
}

log INFO "MedOrbits START.sh v${VERSION}"
log INFO "Repository: $ROOT_DIR"
log INFO "Check-only=$CHECK_ONLY No-install=$NO_INSTALL No-server=$NO_SERVER"

# ---------------------------------------------------------------------------
# 1. Inspect the runtime environment.
# ---------------------------------------------------------------------------

for tool in bash python3; do
  if command_exists "$tool"; then
    log INFO "$tool: $(command -v "$tool")"
  else
    log ERROR "Required executable missing: $tool"
    FAILED=$((FAILED + 1))
  fi
done

if command_exists python3; then
  python3 --version >> "$LOG_FILE" 2>&1 || true
fi

if command_exists node; then
  log INFO "Node.js: $(node --version 2>/dev/null || printf unknown)"
else
  log WARN "Node.js is not installed; JavaScript checks/server startup may be unavailable."
  WARNINGS=$((WARNINGS + 1))
fi

if command_exists npm; then
  log INFO "npm: $(npm --version 2>/dev/null || printf unknown)"
else
  log WARN "npm is not installed; Node.js dependencies cannot be managed."
  WARNINGS=$((WARNINGS + 1))
fi

if command_exists git; then
  log INFO "Git: $(git --version 2>/dev/null || printf unknown)"
fi

if (( FAILED > 0 )); then
  log ERROR "Missing required tools; stopping before project changes."
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. Validate project structure and available package manifests.
# ---------------------------------------------------------------------------

if ! has_file "package.json" && ! has_file "requirements.txt"; then
  log WARN "No root package.json or requirements.txt found."
  WARNINGS=$((WARNINGS + 1))
fi

if has_file "package.json" && command_exists node; then
  if ! run_step "Validate package.json syntax" \
    node -e 'const fs=require("node:fs"); const p=JSON.parse(fs.readFileSync("package.json","utf8")); if (!p || typeof p !== "object" || Array.isArray(p)) process.exit(1); console.log("package.json is valid JSON");'
  then
    log ERROR "Fix package.json before continuing."
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# 3. Validate Python source files without importing application modules.
# ---------------------------------------------------------------------------

if ! run_step "Compile Python source files" python3 - "$ROOT_DIR" <<'PY'
import os
import pathlib
import py_compile
import sys
import tempfile

root = pathlib.Path(sys.argv[1]).resolve()
excluded = {
    ".git", ".venv", "venv", "node_modules", "__pycache__",
    ".pytest_cache", ".mypy_cache", ".ruff_cache", "dist", "build",
}
files = []
for base, dirs, names in os.walk(root):
    dirs[:] = [d for d in dirs if d not in excluded]
    for name in names:
        if name.endswith(".py"):
            files.append(pathlib.Path(base) / name)

errors = []
with tempfile.TemporaryDirectory(prefix="medorbits-pycheck-") as tmp:
    temp_root = pathlib.Path(tmp)
    for index, path in enumerate(files):
        try:
            source = path.read_bytes()
            compile(source, str(path), "exec")
        except (SyntaxError, UnicodeDecodeError, OSError, ValueError) as exc:
            errors.append((path, exc))

if errors:
    for path, exc in errors:
        print(f"PYTHON ERROR: {path}: {exc}", file=sys.stderr)
    sys.exit(1)

print(f"Python syntax check passed: {len(files)} file(s).")
PY
then
  log WARN "Python syntax errors found; other independent checks will continue."
fi

# ---------------------------------------------------------------------------
# 4. Install dependencies only when explicitly allowed and lockfiles exist.
# ---------------------------------------------------------------------------

if (( CHECK_ONLY == 0 && NO_INSTALL == 0 )); then
  if has_file "package-lock.json" && command_exists npm; then
    attempt=1
    installed=0

    while (( attempt <= INSTALL_ATTEMPTS )); do
      log INFO "npm ci attempt ${attempt}/${INSTALL_ATTEMPTS}"
      if npm ci --no-audit >> "$LOG_FILE" 2>&1; then
        installed=1
        log INFO "npm dependencies installed from package-lock.json."
        break
      fi

      log WARN "npm ci failed on attempt $attempt."
      attempt=$((attempt + 1))
    done

    if (( installed == 0 )); then
      log ERROR "npm ci failed after retries. Not deleting or regenerating the lockfile."
      FAILED=$((FAILED + 1))
    fi
  elif has_file "package.json" && command_exists npm; then
    log WARN "package.json exists but package-lock.json is missing; refusing an implicit npm install."
    WARNINGS=$((WARNINGS + 1))
  fi

  if has_file "requirements.txt" && command_exists python3; then
    if [[ -n "${VIRTUAL_ENV:-}" ]]; then
      log INFO "Installing Python dependencies into the active virtual environment."
      if ! python3 -m pip install -r requirements.txt >> "$LOG_FILE" 2>&1; then
        log ERROR "Python dependency installation failed."
        FAILED=$((FAILED + 1))
      fi
    else
      log WARN "Python dependencies were not installed because no virtual environment is active."
      log INFO "Use: python3 -m venv .venv && . .venv/bin/activate && python -m pip install -r requirements.txt"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
fi

# ---------------------------------------------------------------------------
# 5. Run available project checks. Missing optional scripts are reported.
# ---------------------------------------------------------------------------

if (( CHECK_ONLY == 1 )); then
  log INFO "Check-only mode: dependency installation and server startup are disabled."
fi

if has_file "package.json" && command_exists npm; then
  if (( CHECK_ONLY == 1 )); then
    log INFO "Skipping npm scripts in check-only mode to avoid side effects."
  elif [[ -d "node_modules" ]]; then
    if node -e '
      const p = require("./package.json");
      process.exit(p.scripts && p.scripts.lint ? 0 : 1);
    ' >/dev/null 2>&1; then
      run_step "npm run lint" npm run lint || true
    else
      log WARN "No npm lint script defined."
      WARNINGS=$((WARNINGS + 1))
    fi

    if node -e '
      const p = require("./package.json");
      process.exit(p.scripts && p.scripts.test ? 0 : 1);
    ' >/dev/null 2>&1; then
      run_step "npm test" npm test || true
    else
      log WARN "No npm test script defined."
      WARNINGS=$((WARNINGS + 1))
    fi
  else
    log WARN "node_modules is absent; npm scripts were not run."
    WARNINGS=$((WARNINGS + 1))
  fi
fi

if has_file "requirements.txt" && command_exists python3; then
  if command_exists pytest && (( CHECK_ONLY == 0 )); then
    if [[ -d "tests" ]]; then
      run_step "Python test suite" python3 -m pytest -q || true
    else
      log INFO "No tests/ directory; skipping pytest."
    fi
  fi
fi

# ---------------------------------------------------------------------------
# 6. Optional repository-provided checks.
# ---------------------------------------------------------------------------

for check_script in \
  "tools/VERIFY.sh" \
  "tools/SCHEMA-CHECK.sh" \
  "tools/SECURITY.sh"
do
  if has_file "$check_script"; then
    if [[ -x "$ROOT_DIR/$check_script" ]]; then
      run_step "$check_script" "$ROOT_DIR/$check_script" || true
    else
      run_step "$check_script (via bash)" bash "$ROOT_DIR/$check_script" || true
    fi
  else
    log INFO "Optional check not present: $check_script"
  fi
done

# ---------------------------------------------------------------------------
# 7. Optional database connectivity check.
# ---------------------------------------------------------------------------

if [[ -n "${DATABASE_URL:-}" ]]; then
  if command_exists psql; then
    log INFO "DATABASE_URL is configured; checking PostgreSQL connectivity."
    if ! psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c 'SELECT 1;' \
      >> "$LOG_FILE" 2>&1; then
      log WARN "PostgreSQL connectivity check failed; verify credentials, network, and database availability."
      WARNINGS=$((WARNINGS + 1))
    fi
  else
    log WARN "DATABASE_URL is configured but psql is unavailable; database connectivity was not checked."
    WARNINGS=$((WARNINGS + 1))
  fi
else
  log INFO "DATABASE_URL is not set; database connectivity check skipped."
fi

# ---------------------------------------------------------------------------
# 8. Start the application only when requested and configured.
# ---------------------------------------------------------------------------

if (( CHECK_ONLY == 0 && NO_SERVER == 0 )); then
  if has_file "package.json" && command_exists npm && [[ -d "node_modules" ]]; then
    if node -e '
      const p = require("./package.json");
      process.exit(p.scripts && p.scripts.start ? 0 : 1);
    ' >/dev/null 2>&1; then
      if (( FAILED == 0 )); then
        log INFO "Starting application using npm start."
        log INFO "Press Ctrl+C to stop the server."
        cd -- "$ROOT_DIR" || exit 1
        exec npm start
      else
        log ERROR "Server not started because one or more checks failed."
      fi
    else
      log WARN "No npm start script defined; server startup skipped."
      WARNINGS=$((WARNINGS + 1))
    fi
  else
    log WARN "Application prerequisites are missing; server startup skipped."
    WARNINGS=$((WARNINGS + 1))
  fi
else
  log INFO "Server startup disabled."
fi

# ---------------------------------------------------------------------------
# 9. Summary
# ---------------------------------------------------------------------------

log INFO "Run completed. Failures=${FAILED}; Warnings=${WARNINGS}"
log INFO "Full log: $LOG_FILE"

if (( FAILED > 0 )); then
  log ERROR "One or more operations failed. Review the log and fix the underlying issues."
  exit 1
fi

log INFO "Completed without recorded failures."
exit 0
