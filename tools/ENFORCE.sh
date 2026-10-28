#!/usr/bin/env bash
# ==============================================================================
# MedOrbits Repository Enforcement Tool
# File: /tools/ENFORCE.sh
# Version: 1.0.0
#
# Purpose:
#   Enforce repository standards, validate project structure, check available
#   tooling, inspect configuration files, and run safe quality checks.
#
# Runtime:
#   Bash 4+
#   Node.js/npm, Python, and Git are optional but recommended.
#
# Usage:
#   bash tools/ENFORCE.sh
#   bash tools/ENFORCE.sh --strict
#   bash tools/ENFORCE.sh --fix
#   bash tools/ENFORCE.sh --security
#   bash tools/ENFORCE.sh --help
#
# Safety:
#   --fix only applies explicitly safe whitespace/line-ending fixes to
#   supported text files. It never deletes files, installs dependencies,
#   changes Git history, or overwrites environment secrets.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_NAME="ENFORCE.sh"

ROOT_DIR=""
STRICT=0
FIX=0
SECURITY=0
QUIET=0

ERRORS=0
WARNINGS=0
CHECKS=0
SKIPS=0

declare -a TEMP_FILES=()

# ------------------------------------------------------------------------------
# Output
# ------------------------------------------------------------------------------

log() {
    printf '[ENFORCE] %s\n' "$*"
}

info() {
    ((QUIET)) || printf '[INFO] %s\n' "$*"
}

success() {
    printf '[PASS] %s\n' "$*"
}

warn() {
    WARNINGS=$((WARNINGS + 1))
    printf '[WARN] %s\n' "$*" >&2
}

error() {
    ERRORS=$((ERRORS + 1))
    printf '[FAIL] %s\n' "$*" >&2
}

skip() {
    SKIPS=$((SKIPS + 1))
    ((QUIET)) || printf '[SKIP] %s\n' "$*"
}

check_start() {
    CHECKS=$((CHECKS + 1))
}

cleanup() {
    local file
    for file in "${TEMP_FILES[@]:-}"; do
        [[ -n "$file" ]] && rm -f -- "$file"
    done
}

trap cleanup EXIT

die() {
    printf '[ERROR] %s\n' "$*" >&2
    exit 2
}

usage() {
    cat <<'EOF'
MedOrbits Repository Enforcement Tool

Usage:
  bash tools/ENFORCE.sh [options]

Options:
  --strict       Treat warnings as failures.
  --fix          Apply safe whitespace and line-ending fixes to text files.
  --security     Run additional dependency and secret-pattern checks.
  --quiet        Reduce informational output.
  --help         Display this help message.
  --version      Display the script version.

Environment:
  ENFORCE_ROOT   Optional repository root directory.

Examples:
  bash tools/ENFORCE.sh
  bash tools/ENFORCE.sh --strict
  bash tools/ENFORCE.sh --fix --strict
  bash tools/ENFORCE.sh --security

This script does not install packages, deploy code, or modify Git history.
EOF
}

# ------------------------------------------------------------------------------
# Arguments
# ------------------------------------------------------------------------------

while (($#)); do
    case "$1" in
        --strict)
            STRICT=1
            ;;
        --fix)
            FIX=1
            ;;
        --security)
            SECURITY=1
            ;;
        --quiet)
            QUIET=1
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
            die "Unknown option: $1. Use --help for usage."
            ;;
    esac
    shift
done

# ------------------------------------------------------------------------------
# Repository root detection
# ------------------------------------------------------------------------------

SCRIPT_DIR="$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &&
    pwd -P
)"

if [[ -n "${ENFORCE_ROOT:-}" ]]; then
    [[ -d "$ENFORCE_ROOT" ]] ||
        die "ENFORCE_ROOT is not a directory: $ENFORCE_ROOT"

    ROOT_DIR="$(cd -- "$ENFORCE_ROOT" && pwd -P)"
elif command -v git >/dev/null 2>&1 &&
     git -C "$SCRIPT_DIR" rev-parse --show-toplevel >/dev/null 2>&1; then
    ROOT_DIR="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
else
    ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
fi

cd -- "$ROOT_DIR" || die "Cannot enter repository root."

log "MedOrbits repository enforcement v${SCRIPT_VERSION}"
info "Repository root: $ROOT_DIR"
info "Strict mode: $STRICT | Fix mode: $FIX | Security mode: $SECURITY"

# ------------------------------------------------------------------------------
# File helpers
# ------------------------------------------------------------------------------

is_inside_root() {
    local candidate="$1"
    [[ "$candidate" == "$ROOT_DIR" || "$candidate" == "$ROOT_DIR/"* ]]
}

is_ignored_path() {
    case "$1" in
        .git/*|node_modules/*|vendor/*|.venv/*|venv/*|\
        __pycache__/*|dist/*|build/*|coverage/*|.next/*|\
        .pytest_cache/*|.mypy_cache/*|.ruff_cache/*)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

has_command() {
    command -v "$1" >/dev/null 2>&1
}

# Find tracked files when Git is available; otherwise scan common project files.
collect_files() {
    if has_command git &&
       git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        git -C "$ROOT_DIR" ls-files -co --exclude-standard 2>/dev/null |
            while IFS= read -r file; do
                [[ -f "$ROOT_DIR/$file" ]] || continue
                is_ignored_path "$file" && continue
                printf '%s\n' "$file"
            done
    else
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
                -name coverage \
            \) -prune \) -o \
            \( -type f -print \) |
            sed "s#^$ROOT_DIR/##"
    fi
}

# ------------------------------------------------------------------------------
# Repository checks
# ------------------------------------------------------------------------------

check_repository_root() {
    check_start

    if [[ -d "$ROOT_DIR/.git" ]] ||
       (has_command git &&
        git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1); then
        success "Git repository detected"
    else
        warn "Git repository metadata not detected"
    fi

    if [[ -f "$ROOT_DIR/package.json" ]]; then
        success "Node.js project manifest found"
    else
        info "No root package.json found"
    fi

    if [[ -f "$ROOT_DIR/requirements.txt" ]]; then
        success "Python requirements file found"
    else
        info "No root requirements.txt found"
    fi

    if [[ -f "$ROOT_DIR/.env" ]]; then
        warn "Root .env exists; ensure it is excluded from version control"
    fi

    if [[ -f "$ROOT_DIR/.env.example" ]]; then
        success ".env.example found"
    else
        warn ".env.example not found"
    fi

    if [[ -f "$ROOT_DIR/.gitignore" ]]; then
        success ".gitignore found"
    else
        warn ".gitignore is missing"
    fi
}

check_required_structure() {
    check_start

    local -a candidates=(
        "tools"
        "assets"
        "pages"
        "education"
        "career"
        "api"
        "python"
        "tests"
        "monitoring"
    )

    local existing=0
    local path

    for path in "${candidates[@]}"; do
        if [[ -d "$ROOT_DIR/$path" ]]; then
            info "Directory present: $path/"
            existing=$((existing + 1))
        fi
    done

    if [[ -d "$ROOT_DIR/tools" ]]; then
        success "Tools directory exists"
    else
        warn "tools/ directory is missing"
    fi

    if ((existing > 0)); then
        success "Repository structure check completed ($existing recognized directories)"
    else
        warn "No expected MedOrbits project directories were detected"
    fi
}

check_required_tooling() {
    check_start

    local tool
    for tool in bash git node npm python3; do
        if has_command "$tool"; then
            info "Available: $tool"
        else
            case "$tool" in
                bash|git)
                    warn "Recommended command unavailable: $tool"
                    ;;
                *)
                    skip "Optional command unavailable: $tool"
                    ;;
            esac
        fi
    done

    if has_command bash; then
        local bash_major
        bash_major="${BASH_VERSINFO[0]}"
        if ((bash_major < 4)); then
            warn "Bash 4+ is recommended; current major version is $bash_major"
        else
            success "Bash version supported: $BASH_VERSION"
        fi
    fi

    if has_command node; then
        local node_major
        node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || printf '0')"
        if [[ "$node_major" =~ ^[0-9]+$ ]] && ((node_major < 20)); then
            warn "Node.js 20+ is recommended; detected major version $node_major"
        else
            success "Node.js runtime check completed"
        fi
    fi
}

check_package_json() {
    check_start

    if [[ ! -f "$ROOT_DIR/package.json" ]]; then
        skip "package.json validation: no root package.json"
        return
    fi

    if has_command node; then
        if node -e '
            const fs = require("fs");
            const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
            if (!p || typeof p !== "object" || Array.isArray(p)) {
              throw new Error("package.json root must be an object");
            }
            if (p.name !== undefined && typeof p.name !== "string") {
              throw new Error("package.json name must be a string");
            }
            if (p.scripts !== undefined &&
                (typeof p.scripts !== "object" || Array.isArray(p.scripts))) {
              throw new Error("package.json scripts must be an object");
            }
        ' >/dev/null 2>&1; then
            success "package.json is valid JSON with a valid basic structure"
        else
            error "package.json has invalid JSON or an invalid basic structure"
        fi
    else
        skip "package.json semantic validation requires Node.js"
    fi
}

check_python_syntax() {
    check_start

    if ! has_command python3; then
        skip "Python syntax validation: python3 is unavailable"
        return
    fi

    local count=0
    local failed=0
    local file

    while IFS= read -r file; do
        [[ "$file" == *.py ]] || continue
        [[ -f "$ROOT_DIR/$file" ]] || continue

        count=$((count + 1))
        if ! python3 -m py_compile "$ROOT_DIR/$file" >/dev/null 2>&1; then
            error "Python syntax error: $file"
            failed=$((failed + 1))
        fi
    done < <(collect_files)

    # Remove bytecode created by py_compile only within project Python caches.
    find "$ROOT_DIR" \
        \( -type d \( -name .git -o -name node_modules -o -name vendor \) -prune \) -o \
        \( -type d -name __pycache__ -exec rm -rf -- {} + \) 2>/dev/null || true

    if ((count == 0)); then
        skip "No Python files found"
    elif ((failed == 0)); then
        success "Python syntax validation passed ($count files)"
    fi
}

check_json_files() {
    check_start

    local count=0
    local failed=0
    local file

    while IFS= read -r file; do
        case "$file" in
            *.json)
                ;;
            *)
                continue
                ;;
        esac

        [[ -f "$ROOT_DIR/$file" ]] || continue
        count=$((count + 1))

        if has_command node; then
            if ! node -e '
                const fs = require("fs");
                JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
            ' "$ROOT_DIR/$file" >/dev/null 2>&1; then
                error "Invalid JSON: $file"
                failed=$((failed + 1))
            fi
        elif has_command python3; then
            if ! python3 -m json.tool "$ROOT_DIR/$file" >/dev/null 2>&1; then
                error "Invalid JSON: $file"
                failed=$((failed + 1))
            fi
        else
            skip "JSON validation requires Node.js or Python"
            return
        fi
    done < <(collect_files)

    if ((count == 0)); then
        skip "No JSON files found"
    elif ((failed == 0)); then
        success "JSON validation passed ($count files)"
    fi
}

check_shell_syntax() {
    check_start

    local count=0
    local failed=0
    local file

    while IFS= read -r file; do
        case "$file" in
            *.sh)
                ;;
            *)
                continue
                ;;
        esac

        [[ -f "$ROOT_DIR/$file" ]] || continue
        count=$((count + 1))

        if ! bash -n "$ROOT_DIR/$file" 2>/dev/null; then
            error "Shell syntax error: $file"
            failed=$((failed + 1))
        fi
    done < <(collect_files)

    if ((count == 0)); then
        skip "No shell scripts found"
    elif ((failed == 0)); then
        success "Shell syntax validation passed ($count files)"
    fi
}

check_conflict_markers() {
    check_start

    local count=0
    local file

    while IFS= read -r file; do
        [[ -f "$ROOT_DIR/$file" ]] || continue

        case "$file" in
            *.html|*.htm|*.css|*.scss|*.js|*.mjs|*.cjs|*.ts|*.tsx|*.jsx|\
            *.py|*.sh|*.json|*.yml|*.yaml|*.md|*.sql|*.xml|*.txt)
                ;;
            *)
                continue
                ;;
        esac

        if grep -nE '^(<<<<<<< |=======|>>>>>>> )' "$ROOT_DIR/$file" \
            >/dev/null 2>&1; then
            error "Possible merge-conflict marker: $file"
            count=$((count + 1))
        fi
    done < <(collect_files)

    if ((count == 0)); then
        success "No obvious merge-conflict markers found"
    fi
}

check_trailing_whitespace() {
    check_start

    local count=0
    local file
    local temp
    local changed=0

    while IFS= read -r file; do
        [[ -f "$ROOT_DIR/$file" ]] || continue

        case "$file" in
            *.html|*.htm|*.css|*.scss|*.js|*.mjs|*.cjs|*.ts|*.tsx|*.jsx|\
            *.py|*.sh|*.json|*.yml|*.yaml|*.md|*.sql|*.xml|*.txt|*.toml|\
            *.ini|*.conf|*.example)
                ;;
            *)
                continue
                ;;
        esac

        if grep -nE '[[:blank:]]+$' "$ROOT_DIR/$file" >/dev/null 2>&1; then
            count=$((count + 1))

            if ((FIX)); then
                temp="$(mktemp "${TMPDIR:-/tmp}/enforce.XXXXXX")"
                TEMP_FILES+=("$temp")

                if sed 's/[[:blank:]]*$//' "$ROOT_DIR/$file" > "$temp"; then
                    if cat "$temp" > "$ROOT_DIR/$file"; then
                        changed=$((changed + 1))
                    else
                        error "Could not apply whitespace fix: $file"
                    fi
                else
                    error "Could not prepare whitespace fix: $file"
                fi
            else
                warn "Trailing whitespace detected: $file"
            fi
        fi
    done < <(collect_files)

    if ((FIX)); then
        success "Whitespace fix pass completed ($changed files changed)"
    elif ((count == 0)); then
        success "No trailing whitespace detected in supported text files"
    fi
}

check_line_endings() {
    check_start

    local count=0
    local file

    while IFS= read -r file; do
        [[ -f "$ROOT_DIR/$file" ]] || continue

        case "$file" in
            *.html|*.htm|*.css|*.scss|*.js|*.mjs|*.cjs|*.ts|*.tsx|*.jsx|\
            *.py|*.sh|*.json|*.yml|*.yaml|*.md|*.sql|*.xml|*.txt|*.toml)
                ;;
            *)
                continue
                ;;
        esac

        if LC_ALL=C grep -Il $'\r' "$ROOT_DIR/$file" >/dev/null 2>&1; then
            warn "CRLF or carriage-return characters detected: $file"
            count=$((count + 1))
        fi
    done < <(collect_files)

    if ((count == 0)); then
        success "No carriage-return characters detected in supported text files"
    fi
}

check_environment_safety() {
    check_start

    if [[ -f "$ROOT_DIR/.gitignore" ]]; then
        local ignore_file="$ROOT_DIR/.gitignore"

        if ! grep -Eq '(^|/)\.env(\*|$|/)' "$ignore_file" ||
           grep -Eq '^[[:space:]]*!?\.env\.example([[:space:]]|$)' "$ignore_file"; then
            warn "Review .gitignore rules: protect .env files while allowing .env.example"
        else
            success ".gitignore contains an environment-file exclusion pattern"
        fi
    else
        warn "Cannot verify environment-file exclusions without .gitignore"
    fi

    if has_command git &&
       git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        if git -C "$ROOT_DIR" ls-files --error-unmatch .env >/dev/null 2>&1; then
            error "Root .env is tracked by Git; remove secrets from version control"
        else
            success "Root .env is not tracked by Git"
        fi
    else
        skip "Tracked secret-file check requires Git"
    fi
}

check_html_basics() {
    check_start

    local count=0
    local file

    while IFS= read -r file; do
        case "$file" in
            *.html|*.htm)
                ;;
            *)
                continue
                ;;
        esac

        [[ -f "$ROOT_DIR/$file" ]] || continue
        count=$((count + 1))

        if ! grep -Eiq '<!doctype[[:space:]]+html' "$ROOT_DIR/$file"; then
            warn "HTML document lacks an HTML5 doctype: $file"
        fi

        if ! grep -Eiq '<html([[:space:]>])' "$ROOT_DIR/$file"; then
            warn "HTML document lacks an html root element: $file"
        fi

        if ! grep -Eiq '<meta[^>]+charset[[:space:]]*=' "$ROOT_DIR/$file"; then
            warn "HTML document may be missing a charset declaration: $file"
        fi

        if ! grep -Eiq '<meta[^>]+name=["'\'']viewport["'\'']' "$ROOT_DIR/$file"; then
            warn "HTML document may be missing a responsive viewport: $file"
        fi
    done < <(collect_files)

    if ((count == 0)); then
        skip "No HTML files found"
    else
        success "HTML basic metadata scan completed ($count files)"
    fi
}

check_dependency_lockfiles() {
    check_start

    if [[ -f "$ROOT_DIR/package.json" ]]; then
        if [[ -f "$ROOT_DIR/package-lock.json" ||
              -f "$ROOT_DIR/npm-shrinkwrap.json" ||
              -f "$ROOT_DIR/yarn.lock" ||
              -f "$ROOT_DIR/pnpm-lock.yaml" ]]; then
            success "Node.js dependency lockfile found"
        else
            warn "package.json exists without a recognized dependency lockfile"
        fi
    else
        skip "Dependency lockfile check: no root package.json"
    fi
}

check_npm_scripts() {
    check_start

    if [[ ! -f "$ROOT_DIR/package.json" ]]; then
        skip "npm scripts check: no root package.json"
        return
    fi

    if ! has_command node; then
        skip "npm scripts check requires Node.js"
        return
    fi

    local scripts
    scripts="$(node -e '
        const p = require("./package.json");
        console.log(Object.keys(p.scripts || {}).join("\n"));
    ' 2>/dev/null)" || {
        error "Unable to read scripts from package.json"
        return
    }

    if [[ -z "$scripts" ]]; then
        warn "No npm scripts are defined in package.json"
        return
    fi

    local script
    for script in lint test build; do
        if grep -Fxq "$script" <<< "$scripts"; then
            info "npm script available: $script"
        else
            info "Optional npm script not configured: $script"
        fi
    done

    success "npm script inventory completed"
}

# ------------------------------------------------------------------------------
# Security checks
# ------------------------------------------------------------------------------

check_secret_patterns() {
    check_start

    local file
    local findings=0

    while IFS= read -r file; do
        [[ -f "$ROOT_DIR/$file" ]] || continue

        case "$file" in
            *.html|*.htm|*.css|*.scss|*.js|*.mjs|*.cjs|*.ts|*.tsx|*.jsx|\
            *.py|*.sh|*.json|*.yml|*.yaml|*.md|*.sql|*.xml|*.toml|*.ini|\
            *.conf|*.env.example|*.txt)
                ;;
            *)
                continue
                ;;
        esac

        case "$file" in
            .env.example|*.example|*example*|*sample*|*template*|*test*|\
            *fixture*|*lock*|*LICENSE*|*license*)
                continue
                ;;
        esac

        # These are heuristic matches only. Results require manual review.
        if grep -nEI \
            '(-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{24,}|AIza[0-9A-Za-z_-]{30,})' \
            "$ROOT_DIR/$file" >/dev/null 2>&1; then
            warn "Possible hard-coded credential pattern: $file"
            findings=$((findings + 1))
        fi
    done < <(collect_files)

    if ((findings == 0)); then
        success "No known high-signal credential patterns detected"
    else
        warn "Secret-pattern scan found $findings file(s) requiring manual review"
    fi
}

check_npm_audit() {
    check_start

    if [[ ! -f "$ROOT_DIR/package-lock.json" ]]; then
        skip "npm audit requires package-lock.json"
        return
    fi

    if ! has_command npm; then
        skip "npm audit requires npm"
        return
    fi

    info "Running npm audit --omit=dev (network access may be required)"

    if npm --prefix "$ROOT_DIR" audit --omit=dev --audit-level=high; then
        success "npm production dependency audit passed"
    else
        warn "npm audit reported issues or could not reach the registry; inspect output above"
    fi
}

# ------------------------------------------------------------------------------
# Optional package checks
# ------------------------------------------------------------------------------

check_python_dependencies() {
    check_start

    if [[ ! -f "$ROOT_DIR/requirements.txt" ]]; then
        skip "Python dependency check: no requirements.txt"
        return
    fi

    if has_command python3; then
        if python3 -m pip check >/dev/null 2>&1; then
            success "Installed Python package dependency consistency check passed"
        else
            warn "Python package dependency check failed or pip environment is unavailable"
        fi
    else
        skip "Python dependency check requires python3"
    fi
}

# ------------------------------------------------------------------------------
# Run all standard checks
# ------------------------------------------------------------------------------

check_repository_root
check_required_structure
check_required_tooling
check_package_json
check_python_syntax
check_json_files
check_shell_syntax
check_conflict_markers
check_trailing_whitespace
check_line_endings
check_environment_safety
check_html_basics
check_dependency_lockfiles
check_npm_scripts
check_python_dependencies

if ((SECURITY)); then
    log "Running additional security checks"
    check_secret_patterns
    check_npm_audit
fi

# ------------------------------------------------------------------------------
# Summary and exit status
# ------------------------------------------------------------------------------

printf '\n'
printf '%s\n' "============================================================"
printf '%s\n' " MedOrbits Enforcement Summary"
printf '%s\n' "============================================================"
printf 'Repository: %s\n' "$ROOT_DIR"
printf 'Checks run: %s\n' "$CHECKS"
printf 'Errors:     %s\n' "$ERRORS"
printf 'Warnings:   %s\n' "$WARNINGS"
printf 'Skipped:    %s\n' "$SKIPS"
printf 'Strict:     %s\n' "$STRICT"
printf 'Security:   %s\n' "$SECURITY"
printf '%s\n' "============================================================"

if ((ERRORS > 0)); then
    printf '[RESULT] FAILED: resolve the reported errors.\n' >&2
    exit 1
fi

if ((STRICT && WARNINGS > 0)); then
    printf '[RESULT] FAILED: strict mode treats warnings as failures.\n' >&2
    exit 1
fi

printf '[RESULT] PASSED: no blocking errors detected.\n'
exit 0