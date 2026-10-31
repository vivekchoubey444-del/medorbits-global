
#!/usr/bin/env bash
# ==============================================================================
# MEDORBITS -- FORCE EXECUTION & REPOSITORY CONTROL RUNNER
# File: tools/RUN.sh
# Version: 2.0.0
#
# Supports:
#   - Online and offline execution
#   - Force/continue-on-error execution
#   - Repository and environment inspection
#   - Python and Node.js validation
#   - Explicit safe repair operations
#   - Explicit dependency installation
#   - Optional security auditing
#   - Meta Ad Creator integration
#
# SAFETY:
#   - Does not delete repository source files.
#   - Does not reset Git history.
#   - Does not commit or push.
#   - Does not deploy.
#   - Does not publish advertisements.
#   - Dependency installation requires explicit --install.
#   - Repair commands are delegated to configured npm scripts.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly VERSION="2.0.0"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"

COMMAND="help"
FORCE=false
NETWORK="auto"
AUTO_REPAIR=false
INSTALL_DEPS=false
AUDIT=false

PASSED=0
FAILED=0
SKIPPED=0
HALT=false

declare -a RESULTS=()

# ------------------------------------------------------------------------------
# OUTPUT
# ------------------------------------------------------------------------------

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
    exit 2
}

has() {
    command -v "$1" >/dev/null 2>&1
}

# ------------------------------------------------------------------------------
# HELP
# ------------------------------------------------------------------------------

usage() {
    cat <<'HELP'
MedOrbits Repository Control Runner v2.0.0

Usage:
  bash tools/RUN.sh [OPTIONS] COMMAND [ARGUMENTS]

OPTIONS:
  --force             Continue after individual failures.
  --offline           Disable network-dependent operations.
  --online            Permit network-dependent operations.
  --repair            Enable configured repair steps during "all".
  --install           Install dependencies during "all".
  --audit             Run dependency security audit.
  --help, -h          Show help.

COMMANDS:
  help                Show help.
  check               Inspect repository and tools.
  all                 Run complete available validation.
  test                Run tools/TEST.sh.
  test-quick          Run quick tests.
  test-python         Run Python tests.
  test-node           Run JavaScript syntax checks.
  repair              Run configured repair scripts.
  install             Install npm dependencies.
  audit               Run dependency security checks.
  start               Run npm start.
  dev                 Run npm dev.
  meta-example        Show Meta Ad Creator help.
  meta-create         Forward arguments to Meta Ad Creator.
  meta-validate       Validate Meta Ad Creator input.

EXAMPLES:
  bash tools/RUN.sh check
  bash tools/RUN.sh --force all
  bash tools/RUN.sh --offline --force all
  bash tools/RUN.sh --online --audit all
  bash tools/RUN.sh --repair repair
  bash tools/RUN.sh --online install
  bash tools/RUN.sh meta-example

SAFETY:
  --install is required before npm dependencies are installed.
  Offline installation uses the local npm cache.
  --force continues after failures but never hides them.
  --repair runs only explicitly configured npm scripts.
  No automatic deployment, commit, or push is performed.

OPTIONS MUST APPEAR BEFORE THE COMMAND.
HELP
}

# ------------------------------------------------------------------------------
# RESULTS
# ------------------------------------------------------------------------------

record_result() {
    local status="$1"
    local description="$2"

    RESULTS+=("${status}: ${description}")

    case "$status" in
        PASS)
            PASSED=$((PASSED + 1))
            ;;
        FAIL)
            FAILED=$((FAILED + 1))
            ;;
        SKIP)
            SKIPPED=$((SKIPPED + 1))
            ;;
    esac
}

run_step() {
    local description="$1"
    shift

    if [[ "$HALT" == true ]]; then
        skip_step "$description (execution halted)"
        return 0
    fi

    log "$description"

    local code=0

    if "$@"; then
        success "$description"
        record_result PASS "$description"
    else
        code=$?

        error "$description (exit code: $code)"
        record_result FAIL "$description"

        if [[ "$FORCE" == true ]]; then
            warn "Force mode: continuing after failure."
        else
            HALT=true
            warn "Execution halted. Use --force to continue after failures."
        fi
    fi

    return 0
}

skip_step() {
    local description="$1"

    warn "Skipped: $description"
    record_result SKIP "$description"
}

show_report() {
    printf '\n'
    printf '%s\n' "============================================================"
    printf '%s\n' "MEDORBITS EXECUTION REPORT"
    printf '%s\n' "============================================================"

    printf 'Version:  %s\n' "$VERSION"
    printf 'Passed:   %s\n' "$PASSED"
    printf 'Failed:   %s\n' "$FAILED"
    printf 'Skipped:  %s\n' "$SKIPPED"

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

# ------------------------------------------------------------------------------
# ENVIRONMENT
# ------------------------------------------------------------------------------

require_root() {
    [[ -d "$ROOT_DIR" ]] || die "Repository root not found."
    [[ -d "$SCRIPT_DIR" ]] || die "Tools directory not found."
}

check_environment() {
    log "Repository: $ROOT_DIR"
    log "Tools: $SCRIPT_DIR"

    if has node; then
        log "Node.js: $(node --version)"
    else
        warn "Node.js is unavailable."
    fi

    if has npm; then
        log "npm: $(npm --version)"
    else
        warn "npm is unavailable."
    fi

    if has python3; then
        log "Python: $(python3 --version)"
    elif has python; then
        log "Python: $(python --version)"
    else
        warn "Python is unavailable."
    fi

    if [[ -f "$ROOT_DIR/package.json" ]]; then
        node --input-type=module - "$ROOT_DIR/package.json" <<'NODE'
import fs from "node:fs";

try {
    const pkg = JSON.parse(
        fs.readFileSync(process.argv[2], "utf8")
    );

    console.log("Package:", pkg.name || "unnamed");
    console.log("Version:", pkg.version || "unknown");
    console.log("Required Node:", pkg.engines?.node || "unspecified");
    console.log("Package manager:", pkg.packageManager || "unspecified");

    for (const name of [
        "start",
        "dev",
        "test",
        "check",
        "check:strict"
    ]) {
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
        && log "node_modules exists." \
        || warn "node_modules is not installed."

    [[ -f "$ROOT_DIR/package-lock.json" ]] \
        && log "package-lock.json exists." \
        || warn "package-lock.json is missing."

    [[ -f "$ROOT_DIR/requirements-dev.txt" ]] \
        && log "Python development requirements found." \
        || warn "requirements-dev.txt not found."

    [[ -f "$ROOT_DIR/pyproject.toml" ]] \
        && log "pyproject.toml exists." \
        || log "pyproject.toml not found."

    [[ -f "$SCRIPT_DIR/TEST.sh" ]] \
        && log "TEST.sh exists." \
        || warn "TEST.sh not found."
}

# ------------------------------------------------------------------------------
# NPM
# ------------------------------------------------------------------------------

npm_script_exists() {
    local name="$1"

    [[ -f "$ROOT_DIR/package.json" ]] || return 1
    has node || return 127

    node --input-type=module - "$ROOT_DIR/package.json" "$name" <<'NODE'
import fs from "node:fs";

try {
    const pkg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
    process.exit(pkg.scripts?.[process.argv[3]] ? 0 : 1);
} catch {
    process.exit(2);
}
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
        warn "npm script '${name}' is missing or package.json is invalid."
        return 127
    }

    (
        cd "$ROOT_DIR"
        npm run "$name"
    )
}

# ------------------------------------------------------------------------------
# PYTHON
# ------------------------------------------------------------------------------

python_command() {
    if has python3; then
        python3 "$@"
    elif has python; then
        python "$@"
    else
        error "Python is not installed."
        return 127
    fi
}

run_python_syntax() {
    python_command - <<'PY'
import ast
import pathlib
import sys

root = pathlib.Path.cwd()

excluded = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
}

files = [
    path
    for path in root.rglob("*.py")
    if not any(part in excluded for part in path.relative_to(root).parts)
]

errors = []

for path in files:
    try:
        source = path.read_text(encoding="utf-8-sig")
        ast.parse(source, filename=str(path))
        print(f"[PASS] {path.relative_to(root)}")
    except (SyntaxError, UnicodeError, OSError) as exc:
        errors.append((path, exc))
        print(
            f"[FAIL] {path.relative_to(root)}: {exc}",
            file=sys.stderr
        )

print(f"Python files checked: {len(files)}")
print(f"Python syntax errors: {len(errors)}")

sys.exit(1 if errors else 0)
PY
}

# ------------------------------------------------------------------------------
# JAVASCRIPT
# ------------------------------------------------------------------------------

run_node_checks() {
    has node || {
        error "Node.js is not installed."
        return 127
    }

    local found=0
    local failed=0
    local file

    while IFS= read -r -d '' file; do
        found=1

        log "Checking JavaScript: ${file#"$ROOT_DIR"/}"

        if ! node --check "$file"; then
            failed=1
            error "Syntax error: ${file#"$ROOT_DIR"/}"

            if [[ "$FORCE" != true ]]; then
                return 1
            fi
        fi
    done < <(
        find "$ROOT_DIR" \
            -type d \( \
                -name node_modules -o \
                -name .git -o \
                -name .venv -o \
                -name venv -o \
                -name __pycache__ \
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

# ------------------------------------------------------------------------------
# TEST RUNNER
# ------------------------------------------------------------------------------

run_test_runner() {
    [[ -f "$SCRIPT_DIR/TEST.sh" ]] || {
        error "tools/TEST.sh not found."
        return 127
    }

    bash "$SCRIPT_DIR/TEST.sh" "$@"
}

# ------------------------------------------------------------------------------
# REPAIR
# ------------------------------------------------------------------------------

run_repair() {
    log "Starting configured repair operations."

    run_step "Python lint repair" run_npm_script lint:python:fix
    run_step "Python formatting" run_npm_script format:python

    log "Repair operations finished."
    log "Review all changes with git diff before committing."
}

# ------------------------------------------------------------------------------
# INSTALLATION
# ------------------------------------------------------------------------------

run_install() {
    has npm || {
        error "npm is not installed."
        return 127
    }

    [[ -f "$ROOT_DIR/package-lock.json" ]] || {
        error "package-lock.json is required for npm ci."
        return 1
    }

    if [[ "$NETWORK" == offline ]]; then
        log "Installing dependencies from local npm cache."

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

# ------------------------------------------------------------------------------
# SECURITY AUDIT
# ------------------------------------------------------------------------------

run_audit() {
    if [[ "$NETWORK" == offline ]]; then
        warn "Online security audit cannot run in offline mode."
        return 2
    fi

    run_npm_script check:security
}

# ------------------------------------------------------------------------------
# COMPLETE VALIDATION
# ------------------------------------------------------------------------------

run_all() {
    log "Starting complete MedOrbits validation."

    run_step "Repository inspection" check_environment
    run_step "JavaScript syntax validation" run_node_checks
    run_step "Python syntax validation" run_python_syntax

    run_step "JSON validation" run_npm_script check:json
    run_step "Strict JSON validation" run_npm_script check:json:strict
    run_step "Repository test suite" run_test_runner
    run_step "Python tests" run_npm_script check:python
    run_step "Python lint" run_npm_script lint:python
    run_step "Python formatting check" run_npm_script format:python:check
    run_step "Python type checking" run_npm_script typecheck:python
    run_step "Node dependency check" run_npm_script check:dependencies
    run_step "Python dependency check" run_npm_script check:dependencies:python

    if [[ "$AUDIT" == true ]]; then
        run_step "Dependency security audit" run_audit
    else
        skip_step "Dependency security audit (use --audit to enable)"
    fi

    log "Validation sequence completed."
}

# ------------------------------------------------------------------------------
# ARGUMENT PARSING
# ------------------------------------------------------------------------------

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

# ------------------------------------------------------------------------------
# MAIN
# ------------------------------------------------------------------------------

main() {
    require_root

    cd "$ROOT_DIR" || die "Cannot enter repository root."

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
                run_repair
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
            run_step "JavaScript syntax validation" run_node_checks
            ;;

        repair)
            run_repair
            ;;

        install)
            if [[ "$INSTALL_DEPS" != true ]]; then
                die "Dependency installation requires --install."
            fi
            run_step "Dependency installation" run_install
            ;;

        audit)
            run_step "Dependency security audit" run_audit
            ;;

        start|dev)
            run_step "npm ${COMMAND}" run_npm_script "$COMMAND"
            ;;

        meta-example)
            if [[ ! -f "$SCRIPT_DIR/meta_ad_creator.py" ]]; then
                die "tools/meta_ad_creator.py not found."
            fi

            run_step "Meta Ad Creator help" \
                python_command "$SCRIPT_DIR/meta_ad_creator.py" --help
            ;;

        meta-create)
            if [[ ! -f "$SCRIPT_DIR/meta_ad_creator.py" ]]; then
                die "tools/meta_ad_creator.py not found."
            fi

            run_step "Meta Ad Creator" \
                python_command "$SCRIPT_DIR/meta_ad_creator.py" create "$@"
            ;;

        meta-validate)
            if [[ ! -f "$SCRIPT_DIR/meta_ad_creator.py" ]]; then
                die "tools/meta_ad_creator.py not found."
            fi

            run_step "Meta Ad Creator validation" \
                python_command "$SCRIPT_DIR/meta_ad_creator.py" validate "$@"
            ;;

        *)
            usage >&2
            die "Unknown command: $COMMAND"
            ;;
    esac

    show_report
}

main "$@"
