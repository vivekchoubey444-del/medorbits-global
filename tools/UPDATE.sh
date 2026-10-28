#!/usr/bin/env bash
# ==============================================================================
# MedOrbits Repository Upgrade Utility
# File: tools/UPDATE.sh
# Version: 1.1.0
#
# Purpose:
#   Inspect repository tooling, validate source files, and optionally create
#   explicitly requested baseline documentation files that do not already exist.
#
# Safety:
#   - Non-destructive by default.
#   - Never overwrites an existing file.
#   - Never installs packages or changes dependency versions.
#   - Never deletes caches, modifies Git history, deploys, or runs migrations.
#   - --dry-run never writes project files or logs.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_NAME="UPGRADE.sh"
readonly SCRIPT_VERSION="1.1.0"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_ROOT="${ENFORCE_ROOT:-$(cd -- "${SCRIPT_DIR}/.." && pwd -P)}"
PROJECT_ROOT="$(cd -- "$PROJECT_ROOT" 2>/dev/null && pwd -P)" ||
    { printf '[ERROR] Project root does not exist.\n' >&2; exit 2; }

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

log() {
    printf '[INFO] %s\n' "$*"
    if [[ -n "$LOG_FILE" ]]; then
        printf '[INFO] %s\n' "$*" >> "$LOG_FILE"
    fi
}

warn() {
    WARNINGS=$((WARNINGS + 1))
    printf '[WARN] %s\n' "$*" >&2
    if [[ -n "$LOG_FILE" ]]; then printf '[WARN] %s\n' "$*" >> "$LOG_FILE"; fi
}

error() {
    ERRORS=$((ERRORS + 1))
    printf '[ERROR] %s\n' "$*" >&2
    if [[ -n "$LOG_FILE" ]]; then printf '[ERROR] %s\n' "$*" >> "$LOG_FILE"; fi
}

skip() {
    SKIPS=$((SKIPS + 1))
    printf '[SKIP] %s\n' "$*"
    if [[ -n "$LOG_FILE" ]]; then printf '[SKIP] %s\n' "$*" >> "$LOG_FILE"; fi
}

die() {
    error "$*"
    exit 2
}

usage() {
    cat <<'USAGE'
MedOrbits Repository Upgrade Utility

Usage:
  bash tools/UPGRADE.sh [options]

Options:
  --dry-run          Inspect without writing project files or logs.
  --check-only       Run environment and repository checks only.
  --create-missing   Create approved baseline files only when absent.
  --test             Run configured tests when their runner is safely detected.
  --log FILE         Write a log file (disabled in --dry-run and --check-only).
  --verbose          Print additional diagnostic information.
  --help, -h         Display help.
  --version          Display version.

Environment:
  ENFORCE_ROOT       Optional explicit repository root.

Safety:
  No automatic dependency installation, version upgrades, deployments,
  database migrations, cache deletion, or destructive Git operations.
USAGE
}

while (($#)); do
    case "$1" in
        --dry-run) DRY_RUN=1 ;;
        --check-only) CHECK_ONLY=1 ;;
        --create-missing) CREATE_MISSING=1 ;;
        --test) RUN_TESTS=1 ;;
        --log)
            shift
            (($#)) || die "--log requires a file path."
            LOG_FILE="$1"
            ;;
        --verbose) VERBOSE=1 ;;
        --help|-h) usage; exit 0 ;;
        --version) printf '%s %s\n' "$SCRIPT_NAME" "$SCRIPT_VERSION"; exit 0 ;;
        *) die "Unknown option: $1. Use --help." ;;
    esac
    shift
done

if (( DRY_RUN || CHECK_ONLY )); then
    if [[ -n "$LOG_FILE" ]]; then
        printf '[WARN] Logging disabled in dry-run/check-only mode.\n' >&2
    fi
    LOG_FILE=""
elif [[ -n "$LOG_FILE" ]]; then
    case "$LOG_FILE" in
        /*) ;;
        *) LOG_FILE="${PROJECT_ROOT}/${LOG_FILE}" ;;
    esac
    # Prevent a log path from escaping the project root only when it was given
    # as a relative path; absolute log paths are explicitly user-selected.
    mkdir -p -- "$(dirname -- "$LOG_FILE")" ||
        die "Cannot create log directory for: $LOG_FILE"
    touch -- "$LOG_FILE" || die "Cannot create log file: $LOG_FILE"
    chmod 600 -- "$LOG_FILE" 2>/dev/null || true
fi

has_command() { command -v "$1" >/dev/null 2>&1; }

relative_path() {
    local path="$1"
    printf '%s\n' "${path#"$PROJECT_ROOT"/}"
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

safe_relative_path() {
    local path="$1"
    [[ -n "$path" && "$path" != /* ]] || return 1
    case "/$path/" in
        *"/../"*|*"/./"*) return 1 ;;
    esac
    return 0
}

ensure_file() {
    local relative="$1"
    local content="$2"
    local target parent

    safe_relative_path "$relative" || {
        error "Refusing unsafe relative path: $relative"
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

    mkdir -p -- "$parent" || {
        error "Could not create parent directory for: $relative"
        return 1
    }

    # noclobber and a second existence check reduce accidental overwrite risk.
    if [[ -e "$target" || -L "$target" ]]; then
        log "Preserved path created concurrently: $relative"
        return 0
    fi

    if (set -o noclobber; printf '%s\n' "$content" > "$target") 2>/dev/null; then
        chmod 644 -- "$target" 2>/dev/null || true
        CREATED_FILES+=("$relative")
        log "Created baseline file: $relative"
    else
        error "Could not create baseline file safely: $relative"
        return 1
    fi
}

inspect_git() {
    if ! has_command git; then
        skip "Git checks unavailable"
        return 0
    fi
    if ! git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        warn "Project root is not a Git working tree."
        return 0
    fi

    log "Git repository detected."
    local branch status
    branch="$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || true)"
    log "Current branch: ${branch:-detached HEAD}"

    status="$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null || true)"
    if [[ -n "$status" ]]; then
        warn "Git working tree has changes; preserve and review them."
        if (( VERBOSE )); then printf '%s\n' "$status"; fi
    else
        log "Git working tree is clean."
    fi

    if git -C "$PROJECT_ROOT" diff --name-only --diff-filter=U 2>/dev/null | grep -q .; then
        error "Unresolved Git conflicts detected."
    fi
}

inspect_runtime() {
    log "Checking runtime tools..."
    check_command bash 1
    check_command git 0
    check_command python3 0
    check_command node 0
    check_command npm 0
    check_command shellcheck 0
    check_command jq 0

    has_command python3 && python3 --version || true
    has_command node && node --version || true
    has_command npm && npm --version || true
}

inspect_structure() {
    log "Inspecting repository structure..."
    local path
    local -a expected=("tools" "assets" "pages" "api" "python" "tests" "README.md")
    for path in "${expected[@]}"; do
        if [[ -e "${PROJECT_ROOT}/${path}" ]]; then
            log "Found: $path"
        else
            warn "Expected/recommended path not found: $path"
        fi
    done

    if (( VERBOSE )); then
        find "$PROJECT_ROOT" -maxdepth 2 -type f \
            ! -path '*/.git/*' \
            ! -path '*/node_modules/*' \
            ! -path '*/.venv/*' \
            -print 2>/dev/null | sort | head -n 250
    fi
}

validate_shell_files() {
    has_command bash || { skip "Shell validation requires Bash"; return 0; }
    log "Checking shell script syntax..."
    local file found=0
    while IFS= read -r -d '' file; do
        found=1
        if bash -n "$file"; then
            log "Shell syntax OK: $(relative_path "$file")"
        else
            error "Shell syntax failure: $(relative_path "$file")"
        fi
    done < <(
        find "$PROJECT_ROOT" \
            \( -type d \( -name .git -o -name node_modules -o -name .venv -o -name venv \) -prune \) -o \
            \( -type f -name '*.sh' -print0 \) 2>/dev/null
    )
    (( found )) || skip "No shell scripts found"
}

validate_python_files() {
    has_command python3 || { skip "Python validation requires Python 3"; return 0; }
    log "Checking Python syntax..."
    local file found=0
    while IFS= read -r -d '' file; do
        found=1
        if python3 - "$file" <<'PY'
import ast
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
try:
    source = path.read_text(encoding="utf-8")
    ast.parse(source, filename=str(path))
except (OSError, UnicodeError, SyntaxError) as exc:
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
            \( -type d \( -name .git -o -name node_modules -o -name .venv -o -name venv \) -prune \) -o \
            \( -type f -name '*.py' -print0 \) 2>/dev/null
    )
    (( found )) || skip "No Python files found"
}

validate_json_files() {
    log "Checking JSON files..."
    local file found=0
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
import sys
try:
    with open(sys.argv[1], encoding="utf-8") as handle:
        json.load(handle)
except (OSError, UnicodeError, json.JSONDecodeError) as exc:
    print(f"FAIL: {sys.argv[1]}: {exc}", file=sys.stderr)
    raise SystemExit(1)
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
            \( -type d \( -name .git -o -name node_modules -o -name .venv -o -name venv \) -prune \) -o \
            \( -type f -name '*.json' -print0 \) 2>/dev/null
    )
    (( found )) || skip "No JSON files found"
}

validate_node_project() {
    [[ -f "${PROJECT_ROOT}/package.json" ]] || {
        skip "No root package.json; Node project checks not applicable"
        return 0
    }

    if has_command node; then
        if node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' \
            "${PROJECT_ROOT}/package.json" >/dev/null 2>&1; then
            log "package.json is valid JSON."
        else
            error "Invalid package.json."
        fi
    elif has_command python3; then
        if python3 - "${PROJECT_ROOT}/package.json" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as f:
    json.load(f)
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

    [[ -d "${PROJECT_ROOT}/node_modules" ]] ||
        skip "node_modules absent; dependencies will not be installed automatically"
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

run_available_tests() {
    (( RUN_TESTS )) || return 0
    log "Checking configured test commands..."

    if [[ -f "${PROJECT_ROOT}/package.json" ]]; then
        if ! has_command npm || ! has_command node; then
            skip "npm tests require Node.js and npm"
        elif [[ ! -d "${PROJECT_ROOT}/node_modules" ]]; then
            skip "npm tests skipped because node_modules is absent; no installation performed"
        elif node - "${PROJECT_ROOT}/package.json" <<'NODE'
const fs = require("fs");
const p = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
process.exit(p.scripts && typeof p.scripts.test === "string" ? 0 : 1);
NODE
        then
            # Do not assume Jest/Vitest flags; use the package's declared test script.
            if (cd "$PROJECT_ROOT" && npm test); then
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
            if (cd "$PROJECT_ROOT" && pytest -q python/tests); then
                log "Python tests completed successfully."
            else
                error "Python tests failed."
            fi
        else
            skip "Python tests exist but pytest is unavailable."
        fi
    fi
}

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
    [[ -z "$LOG_FILE" ]] || printf '\nLog file: %s\n' "$LOG_FILE"
    printf '%s\n' '============================================================'

    if (( ERRORS > 0 )); then
        printf '%s\n' 'Result: FAILED -- review errors before proceeding.'
    elif (( WARNINGS > 0 )); then
        printf '%s\n' 'Result: COMPLETED WITH WARNINGS.'
    else
        printf '%s\n' 'Result: COMPLETED.'
    fi
}

main() {
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
    (( ERRORS == 0 ))
}

main "$@"
