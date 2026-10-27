#!/usr/bin/env bash
# ==============================================================================
# MedOrbits Repository Upgrade Utility
# File: /tools/UPGRADE.sh
# Purpose: Safely inspect, validate, and upgrade repository tooling and files.
# Compatibility: Bash 4+, Git, Python 3; Node.js/npm checks are optional.
# Safety: Non-destructive by default. Never overwrites project files automatically.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_NAME="UPGRADE.sh"
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

DRY_RUN=0
CHECK_ONLY=0
CREATE_MISSING=0
RUN_TESTS=0
VERBOSE=0
LOG_FILE=""
ERRORS=0
WARNINGS=0

declare -a CREATED_FILES=()
declare -a CHECKS=()

# ------------------------------------------------------------------------------
# Output and logging
# ------------------------------------------------------------------------------

log() {
    printf '[INFO] %s\n' "$*"
    if [[ -n "${LOG_FILE}" ]]; then
        printf '[INFO] %s\n' "$*" >> "$LOG_FILE"
    fi
}

warn() {
    WARNINGS=$((WARNINGS + 1))
    printf '[WARN] %s\n' "$*" >&2
    if [[ -n "${LOG_FILE}" ]]; then
        printf '[WARN] %s\n' "$*" >> "$LOG_FILE"
    fi
}

error() {
    ERRORS=$((ERRORS + 1))
    printf '[ERROR] %s\n' "$*" >&2
    if [[ -n "${LOG_FILE}" ]]; then
        printf '[ERROR] %s\n' "$*" >> "$LOG_FILE"
    fi
}

die() {
    error "$*"
    exit 1
}

usage() {
    cat <<'USAGE'
MedOrbits Repository Upgrade Utility

Usage:
  bash tools/UPGRADE.sh [options]

Options:
  --dry-run          Inspect proposed changes without writing files.
  --check-only       Run environment and repository checks only.
  --create-missing   Create safe baseline files only when absent.
  --test             Run available non-destructive validation commands.
  --log FILE         Write a report to FILE.
  --verbose          Print additional diagnostic information.
  -h, --help         Show this help message.

Safety:
  - Does not install packages automatically.
  - Does not overwrite existing files.
  - Does not run git reset, git clean, or force-push.
  - Does not modify dependency versions automatically.
  - Review repository status before accepting generated files.
USAGE
}

# ------------------------------------------------------------------------------
# Argument parsing
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
        -h|--help)
            usage
            exit 0
            ;;
        *)
            die "Unknown option: $1. Use --help."
            ;;
    esac
    shift
done

if [[ -n "$LOG_FILE" ]]; then
    case "$LOG_FILE" in
        /*) ;;
        *) LOG_FILE="${PROJECT_ROOT}/${LOG_FILE}" ;;
    esac

    if ((DRY_RUN == 0 && CHECK_ONLY == 0)); then
        mkdir -p -- "$(dirname -- "$LOG_FILE")" 2>/dev/null || true
        touch -- "$LOG_FILE" 2>/dev/null ||
            die "Cannot create log file: $LOG_FILE"
        chmod 600 -- "$LOG_FILE" 2>/dev/null || true
    else
        LOG_FILE=""
        warn "Logging disabled in dry-run/check-only mode."
    fi
fi

# ------------------------------------------------------------------------------
# General helpers
# ------------------------------------------------------------------------------

has_command() {
    command -v "$1" >/dev/null 2>&1
}

check_command() {
    local cmd="$1"
    local required="${2:-0}"

    if has_command "$cmd"; then
        log "Available: $cmd ($(command -v "$cmd"))"
        CHECKS+=("PASS: command $cmd")
        return 0
    fi

    if [[ "$required" == "1" ]]; then
        error "Required command is missing: $cmd"
        CHECKS+=("FAIL: command $cmd")
    else
        warn "Optional command is missing: $cmd"
        CHECKS+=("WARN: command $cmd")
    fi

    return 1
}

safe_relative_path() {
    local path="$1"

    [[ -n "$path" ]] || return 1
    [[ "$path" != /* ]] || return 1

    case "/${path}/" in
        *"/../"*|*"/./"*) return 1 ;;
    esac

    return 0
}

ensure_file() {
    local relative_path="$1"
    local content="$2"
    local target

    safe_relative_path "$relative_path" ||
        die "Unsafe relative path: $relative_path"

    target="${PROJECT_ROOT}/${relative_path}"

    if [[ -e "$target" || -L "$target" ]]; then
        log "Preserved existing file: $relative_path"
        return 0
    fi

    if ((CREATE_MISSING == 0)); then
        log "Missing baseline file (not created): $relative_path"
        return 0
    fi

    if ((DRY_RUN == 1)); then
        log "DRY RUN: would create $relative_path"
        return 0
    fi

    mkdir -p -- "$(dirname -- "$target")"
    [[ ! -e "$target" && ! -L "$target" ]] ||
        die "File appeared during upgrade; refusing to overwrite: $relative_path"

    printf '%s\n' "$content" > "$target"
    chmod 644 -- "$target" 2>/dev/null || true
    CREATED_FILES+=("$relative_path")
    log "Created missing baseline file: $relative_path"
}

# ------------------------------------------------------------------------------
# Repository inspection
# ------------------------------------------------------------------------------

inspect_git() {
    if ! has_command git; then
        warn "Git is unavailable; skipping Git checks."
        return 0
    fi

    if ! git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree \
        >/dev/null 2>&1; then
        warn "Project root is not a Git working tree."
        return 0
    fi

    log "Git repository detected."

    local branch
    branch="$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || true)"
    log "Current branch: ${branch:-detached HEAD}"

    if [[ -n "$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null)" ]]; then
        warn "Git working tree contains changes. Preserve and review them before editing."
        if ((VERBOSE == 1)); then
            git -C "$PROJECT_ROOT" status --short
        fi
    else
        log "Git working tree is clean."
    fi

    if git -C "$PROJECT_ROOT" diff --name-only --diff-filter=U 2>/dev/null |
        grep -q .; then
        error "Unresolved Git conflicts detected. Resolve them before upgrading."
    fi
}

inspect_runtime() {
    log "Checking runtime tools..."

    check_command bash 1 || true
    check_command git 0 || true
    check_command python3 1 || true
    check_command node 0 || true
    check_command npm 0 || true
    check_command shellcheck 0 || true
    check_command jq 0 || true

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

inspect_structure() {
    log "Inspecting repository structure..."

    local relative
    local -a expected_paths=(
        "tools"
        "assets"
        "pages"
        "api"
        "python"
        "tests"
        "README.md"
    )

    for relative in "${expected_paths[@]}"; do
        if [[ -e "${PROJECT_ROOT}/${relative}" ]]; then
            log "Found: $relative"
        else
            warn "Optional/expected path not found: $relative"
        fi
    done

    if ((VERBOSE == 1)); then
        find "$PROJECT_ROOT" -maxdepth 2 \
            -type f \
            ! -path '*/.git/*' \
            ! -path '*/node_modules/*' \
            ! -path '*/.venv/*' \
            -print 2>/dev/null | sort | head -n 250
    fi
}

# ------------------------------------------------------------------------------
# Non-destructive file validation
# ------------------------------------------------------------------------------

validate_shell_files() {
    has_command bash || return 0

    log "Checking shell script syntax..."

    local file
    local found=0

    while IFS= read -r -d '' file; do
        found=1

        # Avoid executing files: bash -n parses syntax only.
        if bash -n "$file"; then
            log "Shell syntax OK: ${file#"$PROJECT_ROOT"/}"
        else
            error "Shell syntax failure: ${file#"$PROJECT_ROOT"/}"
        fi
    done < <(
        find "$PROJECT_ROOT" \
            -path '*/.git' -prune -o \
            -path '*/node_modules' -prune -o \
            -path '*/.venv' -prune -o \
            -type f -name '*.sh' -print0 2>/dev/null
    )

    ((found == 1)) || log "No shell scripts found."
}

validate_python_files() {
    has_command python3 || return 0

    log "Checking Python syntax..."

    local file
    local found=0

    while IFS= read -r -d '' file; do
        found=1

        if python3 - "$file" <<'PY'
import ast
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
try:
    ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
except (OSError, UnicodeError, SyntaxError) as exc:
    print(f"FAIL: {path}: {exc}", file=sys.stderr)
    raise SystemExit(1)
print(f"OK: {path}")
PY
        then
            :
        else
            error "Python syntax failure: ${file#"$PROJECT_ROOT"/}"
        fi
    done < <(
        find "$PROJECT_ROOT" \
            -path '*/.git' -prune -o \
            -path '*/node_modules' -prune -o \
            -path '*/.venv' -prune -o \
            -type f -name '*.py' -print0 2>/dev/null
    )

    ((found == 1)) || log "No Python files found."
}

validate_json_files() {
    log "Checking JSON files..."

    local file
    local found=0

    while IFS= read -r -d '' file; do
        found=1

        if has_command jq; then
            if jq empty "$file" >/dev/null 2>&1; then
                log "JSON OK: ${file#"$PROJECT_ROOT"/}"
            else
                error "Invalid JSON: ${file#"$PROJECT_ROOT"/}"
            fi
        elif has_command python3; then
            if python3 - "$file" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
try:
    with path.open(encoding="utf-8") as handle:
        json.load(handle)
except (OSError, UnicodeError, json.JSONDecodeError) as exc:
    print(f"FAIL: {path}: {exc}", file=sys.stderr)
    raise SystemExit(1)
PY
            then
                log "JSON OK: ${file#"$PROJECT_ROOT"/}"
            else
                error "Invalid JSON: ${file#"$PROJECT_ROOT"/}"
            fi
        else
            warn "Cannot validate JSON without jq or Python: $file"
        fi
    done < <(
        find "$PROJECT_ROOT" \
            -path '*/.git' -prune -o \
            -path '*/node_modules' -prune -o \
            -path '*/.venv' -prune -o \
            -type f -name '*.json' -print0 2>/dev/null
    )

    ((found == 1)) || log "No JSON files found."
}

validate_node_project() {
    if ! has_command node || ! has_command npm; then
        warn "Node.js/npm unavailable; skipping Node project checks."
        return 0
    fi

    local package_file="${PROJECT_ROOT}/package.json"

    [[ -f "$package_file" ]] || {
        log "No root package.json; skipping Node project checks."
        return 0
    }

    if node --check "$package_file" >/dev/null 2>&1; then
        log "package.json is valid JavaScript syntax."
    else
        # package.json is JSON, not JavaScript. Validate as JSON instead.
        if python3 - "$package_file" <<'PY'
import json
import sys
with open(sys.argv[1], encoding="utf-8") as f:
    json.load(f)
PY
        then
            log "package.json is valid JSON."
        else
            error "Invalid package.json."
        fi
    fi

    if [[ -f "${PROJECT_ROOT}/package-lock.json" ]]; then
        log "package-lock.json exists."
    else
        warn "package-lock.json is absent; no lockfile will be generated automatically."
    fi

    if [[ -d "${PROJECT_ROOT}/node_modules" ]]; then
        log "node_modules exists."
    else
        warn "node_modules is absent. Dependencies will not be installed automatically."
    fi
}

# ------------------------------------------------------------------------------
# Optional baseline files
# ------------------------------------------------------------------------------

create_baselines() {
    ((CHECK_ONLY == 0)) || return 0

    ensure_file "tools/README.md" \
"# MedOrbits Tools

Repository utility scripts and development support tools.

## Safety

- Review scripts before execution.
- Prefer dry-run and check-only modes when available.
- Do not commit secrets, tokens, private keys, or local credentials.
- Preserve uncommitted changes before repository-wide operations.
- Run tools from the repository root unless their documentation says otherwise.
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
# Optional test execution
# ------------------------------------------------------------------------------

run_available_tests() {
    ((RUN_TESTS == 1)) || return 0

    log "Running available non-destructive tests..."

    if [[ -f "${PROJECT_ROOT}/package.json" ]] &&
        has_command npm &&
        [[ -d "${PROJECT_ROOT}/node_modules" ]]; then

        if node -e '
const p = require(process.argv[1]);
process.exit(p.scripts && p.scripts.test ? 0 : 1);
' "${PROJECT_ROOT}/package.json"; then
            if (cd "$PROJECT_ROOT" && npm test -- --runInBand); then
                log "npm test completed successfully."
            else
                error "npm test failed."
            fi
        else
            warn "No npm test script detected."
        fi
    fi

    if [[ -d "${PROJECT_ROOT}/python" ]] && has_command python3; then
        if [[ -d "${PROJECT_ROOT}/python/tests" ]]; then
            if has_command pytest; then
                if (cd "$PROJECT_ROOT" && pytest -q python/tests); then
                    log "Python tests completed successfully."
                else
                    error "Python tests failed."
                fi
            else
                warn "Python tests exist, but pytest is not installed."
            fi
        fi
    fi

    if [[ -f "${PROJECT_ROOT}/.pre-commit-config.yaml" ]] &&
        has_command pre-commit; then
        log "Pre-commit configuration detected."
        warn "Run pre-commit manually after reviewing configured hooks."
    fi
}

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------

print_summary() {
    printf '\n'
    printf '%s\n' '============================================================'
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

    if ((${#CREATED_FILES[@]})); then
        printf '\nCreated files:\n'
        printf '  - %s\n' "${CREATED_FILES[@]}"
    fi

    if [[ -n "$LOG_FILE" ]]; then
        printf '\nLog file: %s\n' "$LOG_FILE"
    fi

    printf '%s\n' '============================================================'

    if ((ERRORS > 0)); then
        printf '%s\n' 'Result: FAILED -- review errors before proceeding.'
    elif ((WARNINGS > 0)); then
        printf '%s\n' 'Result: COMPLETED WITH WARNINGS.'
    else
        printf '%s\n' 'Result: COMPLETED.'
    fi
}

# ------------------------------------------------------------------------------
# Main
# ------------------------------------------------------------------------------

main() {
    log "Starting ${SCRIPT_NAME} v${SCRIPT_VERSION}"
    log "Project root: ${PROJECT_ROOT}"

    inspect_runtime
    inspect_git
    inspect_structure

    if ((CHECK_ONLY == 0)); then
        create_baselines
    fi

    validate_shell_files
    validate_python_files
    validate_json_files
    validate_node_project
    run_available_tests

    print_summary

    ((ERRORS == 0))
}

main "$@"