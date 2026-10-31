
#!/usr/bin/env bash
# ============================================================
# MEDORBITS -- FORCE EXECUTION & REPOSITORY CONTROL RUNNER
# File: /tools/RUN.sh
#
# Supports:
#   - Online and offline execution
#   - Force/continue-on-error execution
#   - Repository validation
#   - Python and Node.js checks
#   - Safe automatic formatting and lint repairs
#   - Dependency installation and security auditing
#   - Meta Ad Creator integration
#
# SAFETY:
#   - Does not delete repository files.
#   - Does not reset Git history.
#   - Does not overwrite arbitrary files.
#   - Does not publish advertisements.
#   - Does not deploy automatically.
# ============================================================

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"

COMMAND="help"
FORCE=false
NETWORK="auto"
AUTO_REPAIR=false
INSTALL_DEPS=false
AUDIT=false

PASSED=0
FAILED=0
SKIPPED=0

declare -a RESULTS=()

log() {
  printf '\033[1;34m[INFO]\033[0m %s\n' "$*"
}

success() {
  printf '\033[1;32m[PASS]\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33m[WARN]\033[0m %s\n' "$*" >&2
}

error() {
  printf '\033[1;31m[FAIL]\033[0m %s\n' "$*" >&2
}

die() {
  error "$*"
  exit 1
}

has() {
  command -v "$1" >/dev/null 2>&1
}

usage() {
  cat <<'HELP'
MedOrbits Force Execution Runner

Usage:
  bash tools/RUN.sh [OPTIONS] COMMAND

Execution options:
  --force             Continue after individual failures
  --offline           Disable network-dependent operations
  --online            Allow network-dependent operations
  --repair            Enable safe automatic code repairs
  --install           Install project dependencies
  --audit             Run dependency security audits
  --help              Show this help

Commands:
  help                Show help
  check               Inspect repository and tools
  all                 Run complete available validation
  test                Run repository test runner
  test-quick          Run quick checks
  test-python         Run Python tests
  test-node           Run JavaScript syntax checks
  repair              Apply available safe code repairs
  install             Install project dependencies
  audit               Run dependency security checks
  start               Run npm start
  dev                 Run npm dev
  meta-example        Show Meta ad creator help
  meta-create         Forward arguments to Meta ad creator
  meta-validate       Validate Meta ad creator input

Examples:
  bash tools/RUN.sh check
  bash tools/RUN.sh --force all
  bash tools/RUN.sh --offline --force all
  bash tools/RUN.sh --online --audit all
  bash tools/RUN.sh --repair repair
  bash tools/RUN.sh --online install

Offline mode:
  Uses installed dependencies and local caches.
  Does not intentionally invoke network-dependent commands.

Force mode:
  Continues after failed checks and reports all results.
  It does not disable security controls or hide failures.
HELP
}

record_result() {
  local status="$1"
  local description="$2"

  RESULTS+=("$status: $description")

  case "$status" in
    PASS) PASSED=$((PASSED + 1)) ;;
    FAIL) FAILED=$((FAILED + 1)) ;;
    SKIP) SKIPPED=$((SKIPPED + 1)) ;;
  esac
}

run_step() {
  local description="$1"
  shift

  log "$description"

  if "$@"; then
    success "$description"
    record_result PASS "$description"
    return 0
  else
    local code=$?

    error "$description (exit code: $code)"
    record_result FAIL "$description"

    if [[ "$FORCE" == true ]]; then
      warn "Force mode: continuing."
      return 0
    fi

    return "$code"
  fi
}

skip_step() {
  local description="$1"

  warn "Skipped: $description"
  record_result SKIP "$description"
}

require_root() {
  [[ -d "$ROOT_DIR" ]] || die "Repository root not found."
}

check_environment() {
  log "Repository: $ROOT_DIR"
  log "Tools: $SCRIPT_DIR"

  if has node; then
    node --version
  else
    warn "Node.js is unavailable."
  fi

  if has npm; then
    npm --version
  else
    warn "npm is unavailable."
  fi

  if has python3; then
    python3 --version
  elif has python; then
    python --version
  else
    warn "Python is unavailable."
  fi

  if [[ -f "$ROOT_DIR/package.json" ]]; then
    node - "$ROOT_DIR/package.json" <<'NODE'
const fs = require("node:fs");

try {
  const pkg = JSON.parse(
    fs.readFileSync(process.argv[2], "utf8")
  );

  console.log("Package:", pkg.name || "unnamed");
  console.log("Version:", pkg.version || "unknown");
  console.log("Required Node:", pkg.engines?.node || "unspecified");
  console.log("Package manager:", pkg.packageManager || "unspecified");

  for (const name of ["start", "dev", "test", "check", "check:strict"]) {
    console.log(
      `${name}: ${pkg.scripts?.[name] ? "available" : "missing"}`
    );
  }
} catch (error) {
  console.error("package.json error:", error.message);
  process.exitCode = 1;
}
NODE
  else
    warn "package.json not found."
  fi

  [[ -d "$ROOT_DIR/node_modules" ]] \
    && log "node_modules exists" \
    || warn "node_modules is not installed."

  [[ -f "$ROOT_DIR/package-lock.json" ]] \
    && log "package-lock.json exists" \
    || warn "package-lock.json is missing."

  [[ -f "$ROOT_DIR/requirements-dev.txt" ]] \
    && log "Python development requirements found." \
    || warn "requirements-dev.txt not found."

  [[ -f "$ROOT_DIR/pyproject.toml" ]] \
    && log "pyproject.toml exists." \
    || true

  [[ -f "$SCRIPT_DIR/TEST.sh" ]] \
    && log "TEST.sh exists." \
    || warn "TEST.sh not found."
}

npm_script_exists() {
  local name="$1"

  [[ -f "$ROOT_DIR/package.json" ]] || return 1

  node - "$ROOT_DIR/package.json" "$name" <<'NODE'
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
process.exit(pkg.scripts?.[process.argv[3]] ? 0 : 1);
NODE
}

run_npm_script() {
  local name="$1"

  has npm || {
    error "npm is not installed."
    return 127
  }

  [[ -f "$ROOT_DIR/package.json" ]] || {
    error "package.json not found."
    return 1
  }

  npm_script_exists "$name" || {
    warn "npm script '$name' is not defined."
    return 127
  }

  (
    cd "$ROOT_DIR"
    npm run "$name"
  )
}

python_command() {
  if has python3; then
    python3 "$@"
  elif has python; then
    python "$@"
  else
    return 127
  fi
}

run_test_runner() {
  [[ -f "$SCRIPT_DIR/TEST.sh" ]] || {
    error "tools/TEST.sh not found."
    return 127
  }

  bash "$SCRIPT_DIR/TEST.sh" "$@"
}

run_node_checks() {
  has node || return 127

  local found=0
  local failed=0

  while IFS= read -r -d '' file; do
    found=1
    log "Checking JavaScript: ${file#"$ROOT_DIR"/}"

    if ! node --check "$file"; then
      failed=1
      error "Syntax error: ${file#"$ROOT_DIR"/}"
      [[ "$FORCE" == true ]] || return 1
    fi
  done < <(
    find "$ROOT_DIR" \
      -type d \( \
        -name node_modules -o \
        -name .git -o \
        -name .venv -o \
        -name venv \
      \) -prune -o \
      -type f \( \
        -name '*.js' -o \
        -name '*.cjs' -o \
        -name '*.mjs' \
      \) -print0
  )

  [[ "$found" == 1 ]] || warn "No JavaScript files found."

  return "$failed"
}

run_python_syntax() {
  python_command - <<'PY'
import ast
import pathlib
import sys

root = pathlib.Path.cwd()
excluded = {
    ".git", "node_modules", ".venv", "venv",
    "__pycache__", ".pytest_cache", ".mypy_cache"
}

files = [
    path for path in root.rglob("*.py")
    if not any(part in excluded for part in path.parts)
]

errors = []

for path in files:
    try:
        ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))
        print(f"[PASS] {path.relative_to(root)}")
    except (SyntaxError, UnicodeError, OSError) as exc:
        errors.append((path, exc))
        print(f"[FAIL] {path.relative_to(root)}: {exc}", file=sys.stderr)

print(f"Python files checked: {len(files)}")
print(f"Python syntax errors: {len(errors)}")

sys.exit(1 if errors else 0)
PY
}

run_repair() {
  log "Starting safe automatic repair operations."

  run_npm_script lint:python:fix || {
    [[ "$FORCE" == true ]] || return 1
    warn "Python lint repair unavailable or unsuccessful."
  }

  run_npm_script format:python || {
    [[ "$FORCE" == true ]] || return 1
    warn "Python formatter unavailable or unsuccessful."
  }

  log "Repair operations completed."
  log "Review the Git diff before committing."
}

run_install() {
  has npm || return 127

  [[ -f "$ROOT_DIR/package-lock.json" ]] || {
    error "package-lock.json is required for reproducible npm ci."
    return 1
  }

  if [[ "$NETWORK" == offline ]]; then
    log "Installing from local npm cache only."

    (
      cd "$ROOT_DIR"
      npm ci --offline --no-audit --no-fund
    )
  else
    log "Installing npm dependencies."

    (
      cd "$ROOT_DIR"
      npm ci --no-audit --no-fund
    )
  fi
}

run_audit() {
  if [[ "$NETWORK" == offline ]]; then
    warn "Security audit skipped in offline mode."
    record_result SKIP "Online dependency security audit"
    return 0
  fi

  run_npm_script check:security
}

run_all() {
  log "Starting complete MedOrbits validation."

  run_step "Repository inspection" check_environment
  run_step "JavaScript syntax validation" run_node_checks
  run_step "Python syntax validation" run_python_syntax

  run_step "JSON validation" run_npm_script check:json
  run_step "Strict JSON validation" run_npm_script check:json:strict
  run_step "Repository test suite" run_test_runner
  run_step "Python tests" run_npm_script check:python
  run_step "Code lint" run_npm_script lint:python
  run_step "Python formatting check" run_npm_script format:python:check
  run_step "Python type checking" run_npm_script typecheck:python
  run_step "Node dependency check" run_npm_script check:dependencies
  run_step "Python dependency check" run_npm_script check:dependencies:python

  if [[ "$AUDIT" == true ]]; then
    run_step "Security audit" run_audit
  elif [[ "$NETWORK" == online ]]; then
    run_step "Security audit" run_audit
  else
    skip_step "Security audit (offline or not requested)"
  fi

  log "Complete validation sequence finished."
}

show_report() {
  printf '\n'
  printf '%s\n' "============================================================"
  printf '%s\n' "MEDORBITS EXECUTION REPORT"
  printf '%s\n' "============================================================"

  printf 'Passed:  %s\n' "$PASSED"
  printf 'Failed:  %s\n' "$FAILED"
  printf 'Skipped: %s\n' "$SKIPPED"

  printf '\nDetailed results:\n'

  local item
  for item in "${RESULTS[@]}"; do
    printf '  %s\n' "$item"
  done

  printf '%s\n' "============================================================"

  if (( FAILED > 0 )); then
    error "Execution completed with failures."
    return 1
  fi

  success "Execution completed without recorded failures."
  return 0
}

# ------------------------------------------------------------
# GLOBAL ARGUMENT PARSING
# ------------------------------------------------------------

while (($#)); do
  case "$1" in
    --force|-f)
      FORCE=true
      ;;
    --offline)
      NETWORK=offline
      ;;
    --online)
      NETWORK=online
      ;;
    --repair)
      AUTO_REPAIR=true
      ;;
    --install)
      INSTALL_DEPS=true
      ;;
    --audit)
      AUDIT=true
      ;;
    --help|-h)
      COMMAND=help
      shift
      break
      ;;
    --)
      shift
      break
      ;;
    -*)
      die "Unknown option: $1"
      ;;
    *)
      COMMAND="$1"
      shift
      break
      ;;
  esac

  shift
done

require_root

# ------------------------------------------------------------
# COMMAND EXECUTION
# ------------------------------------------------------------

case "$COMMAND" in
  help)
    usage
    ;;

  check)
    run_step "Repository inspection" check_environment
    ;;

  all)
    if [[ "$INSTALL_DEPS" == true ]]; then
      run_step "Dependency installation" run_install
    fi

    if [[ "$AUTO_REPAIR" == true ]]; then
      run_step "Automatic code repair" run_repair
    fi

    run_all
    ;;

  test)
    run_step "Repository test suite" run_test_runner "$@"
    ;;

  test-quick)
    run_step "Quick repository tests" run_test_runner --quick
    ;;

  test-python)
    run_step "Python tests" run_test_runner --python-only
    ;;

  test-node)
    run_step "JavaScript syntax checks" run_node_checks
    ;;

  repair)
    run_repair
    ;;

  install)
    run_install
    ;;

  audit)
    run_audit
    ;;

  start|dev)
    run_npm_script "$COMMAND"
    ;;

  meta-example)
    [[ -f "$SCRIPT_DIR/meta_ad_creator.py" ]] \
      || die "meta_ad_creator.py not found."

    python_command "$SCRIPT_DIR/meta_ad_creator.py" --help
    ;;

  meta-create)
    [[ -f "$SCRIPT_DIR/meta_ad_creator.py" ]] \
      || die "meta_ad_creator.py not found."

    exec python_command "$SCRIPT_DIR/meta_ad_creator.py" create "$@"
    ;;

  meta-validate)
    [[ -f "$SCRIPT_DIR/meta_ad_creator.py" ]] \
      || die "meta_ad_creator.py not found."

    exec python_command "$SCRIPT_DIR/meta_ad_creator.py" validate "$@"
    ;;

  *)
    usage >&2
    die "Unknown command: $COMMAND"
    ;;
esac

show_report
