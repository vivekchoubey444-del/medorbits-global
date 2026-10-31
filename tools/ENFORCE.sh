
#!/usr/bin/env bash
# ==============================================================================
# MEDORBITS -- REPOSITORY ENFORCEMENT TOOL
# File: tools/ENFORCE.sh
# Version: 2.0.0
#
# Purpose:
#   Repository inventory, syntax validation, structural checks, security
#   heuristics, and controlled whitespace repair.
#
# Usage:
#   bash tools/ENFORCE.sh
#   bash tools/ENFORCE.sh --strict
#   bash tools/ENFORCE.sh --fix
#   bash tools/ENFORCE.sh --security
#   bash tools/ENFORCE.sh --all
#   bash tools/ENFORCE.sh --help
#
# Safety:
#   - Does not install dependencies.
#   - Does not deploy or modify Git history.
#   - Does not delete application files.
#   - Does not follow symbolic links during file scanning.
#   - --fix only targets regular, non-symlink text files.
#   - --fix creates backups before replacement.
#   - Does not automatically modify environment secrets.
#   - Security findings are heuristic and require review.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_VERSION="2.0.0"
readonly SCRIPT_NAME="ENFORCE.sh"

ROOT_DIR=""
BACKUP_DIR=""

STRICT=0
FIX=0
SECURITY=0
QUIET=0
ALL_CHECKS=0

ERRORS=0
WARNINGS=0
CHECKS=0
SKIPS=0
FILES_SCANNED=0
FIXED_FILES=0
FIX_FAILURES=0

START_TIME=$SECONDS

die() {
    printf '[ERROR] %s\n' "$*" >&2
    exit 2
}

log() {
    printf '[ENFORCE] %s\n' "$*"
}

info() {
    if (( QUIET == 0 )); then
        printf '[INFO] %s\n' "$*"
    fi
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
    info "[SKIP] $*"
}

check_start() {
    CHECKS=$((CHECKS + 1))
}

has_command() {
    command -v "$1" >/dev/null 2>&1
}

usage() {
    cat <<'EOF'
MedOrbits Repository Enforcement Tool

Usage:
  bash tools/ENFORCE.sh [options]

Options:
  --strict       Treat warnings as failures.
  --fix          Back up and remove trailing whitespace.
  --security     Run additional secret-pattern and npm audit checks.
  --all          Enable strict and security checks.
  --quiet        Reduce informational output.
  --help, -h     Display help.
  --version      Display version.

Environment:
  ENFORCE_ROOT   Optional repository root directory.

Examples:
  bash tools/ENFORCE.sh
  bash tools/ENFORCE.sh --strict
  bash tools/ENFORCE.sh --fix
  bash tools/ENFORCE.sh --security
  bash tools/ENFORCE.sh --all

Repair safety:
  - Only regular, non-symlink files are eligible.
  - A backup is created before replacement.
  - Hard-linked files are not automatically modified.
  - File permissions are preserved where supported.
  - Repair failures are reported rather than suppressed.

Security:
  - Secret detection is heuristic.
  - Secret values are never intentionally printed.
  - npm audit may require network access.
  - No production credentials are automatically changed.
EOF
}

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
        --all)
            STRICT=1
            SECURITY=1
            ALL_CHECKS=1
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
            usage
            die "Unknown option: $1"
            ;;
    esac
    shift
done

SCRIPT_DIR="$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &&
    pwd -P
)"

if [[ -n "${ENFORCE_ROOT:-}" ]]; then
    [[ -d "$ENFORCE_ROOT" ]] ||
        die "ENFORCE_ROOT is not a directory."

    ROOT_DIR="$(cd -- "$ENFORCE_ROOT" && pwd -P)"

elif has_command git &&
    git -C "$SCRIPT_DIR" rev-parse --show-toplevel >/dev/null 2>&1; then

    ROOT_DIR="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
    ROOT_DIR="$(cd -- "$ROOT_DIR" && pwd -P)"

else
    ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
fi

cd -- "$ROOT_DIR" ||
    die "Cannot enter repository root."

readonly ROOT_DIR

BACKUP_DIR="$ROOT_DIR/tools/repository-reports/backups/enforce"

log "MedOrbits Repository Enforcement v${SCRIPT_VERSION}"
info "Repository: $ROOT_DIR"
info "Strict: $STRICT | Fix: $FIX | Security: $SECURITY"

# ------------------------------------------------------------------------------
# File collection
# ------------------------------------------------------------------------------

is_ignored_path() {
    case "/$1/" in
        */.git/*|*/node_modules/*|*/vendor/*|*/.venv/*|*/venv/*|\
        */__pycache__/*|*/dist/*|*/build/*|*/coverage/*|*/.next/*|\
        */.pytest_cache/*|*/.mypy_cache/*|*/.ruff_cache/*)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

collect_files() {
    if has_command git &&
        git -C "$ROOT_DIR" rev-parse --is-inside-work-tree \
            >/dev/null 2>&1; then

        git -C "$ROOT_DIR" ls-files \
            -co \
            --exclude-standard \
            -z 2>/dev/null |
        while IFS= read -r -d '' file; do
            [[ -f "$ROOT_DIR/$file" ]] || continue
            [[ ! -L "$ROOT_DIR/$file" ]] || continue

            is_ignored_path "$file" && continue

            printf '%s\0' "$file"
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
                -name coverage -o \
                -name .next -o \
                -name .pytest_cache -o \
                -name .mypy_cache -o \
                -name .ruff_cache \
            \) -prune \) -o \
            \( -type f ! -type l -print0 \) |
        while IFS= read -r -d '' absolute; do
            local relative="${absolute#"$ROOT_DIR"/}"

            is_ignored_path "$relative" && continue

            printf '%s\0' "$relative"
        done
    fi
}

is_text_candidate() {
    case "$1" in
        *.html|*.htm|*.css|*.scss|*.js|*.mjs|*.cjs|*.ts|*.tsx|*.jsx|\
        *.py|*.sh|*.json|*.yml|*.yaml|*.md|*.sql|*.xml|*.txt|*.toml|\
        *.ini|*.conf|*.example|*.env.example)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

is_regular_safe_file() {
    local file="$1"

    [[ -f "$ROOT_DIR/$file" && ! -L "$ROOT_DIR/$file" ]]
}

# ------------------------------------------------------------------------------
# Repository checks
# ------------------------------------------------------------------------------

check_repository_root() {
    check_start

    if has_command git &&
        git -C "$ROOT_DIR" rev-parse --is-inside-work-tree \
            >/dev/null 2>&1; then
        success "Git repository detected"
    else
        warn "Git repository metadata not detected"
    fi

    [[ -f "$ROOT_DIR/package.json" ]] &&
        success "Root package.json found" ||
        info "Root package.json not found"

    [[ -f "$ROOT_DIR/requirements.txt" ]] &&
        info "Root requirements.txt found" ||
        info "Root requirements.txt not found"

    [[ -f "$ROOT_DIR/.env.example" ]] &&
        success ".env.example found" ||
        warn ".env.example is missing"

    [[ -f "$ROOT_DIR/.gitignore" ]] &&
        success ".gitignore found" ||
        warn ".gitignore is missing"

    if [[ -f "$ROOT_DIR/.env" ]]; then
        warn "Root .env exists. Check Git tracking and access permissions."
    fi
}

check_required_structure() {
    check_start

    local -a candidates=(
        tools
        assets
        pages
        education
        career
        api
        python
        tests
        monitoring
    )

    local existing=0 path

    for path in "${candidates[@]}"; do
        if [[ -d "$ROOT_DIR/$path" ]]; then
            info "Directory present: $path/"
            existing=$((existing + 1))
        fi
    done

    if [[ -d "$ROOT_DIR/tools" ]]; then
        success "tools/ directory exists"
    else
        warn "tools/ directory is missing"
    fi

    success "Recognized directory scan completed ($existing directories)"
}

check_tooling() {
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

    if (( BASH_VERSINFO[0] < 4 )); then
        warn "Bash 4+ recommended. Detected: $BASH_VERSION"
    else
        success "Bash version supported: $BASH_VERSION"
    fi

    if has_command node; then
        local node_major

        node_major="$(
            node -p 'process.versions.node.split(".")[0]' 2>/dev/null ||
                printf '0'
        )"

        if [[ "$node_major" =~ ^[0-9]+$ ]] &&
            (( node_major < 22 )); then
            warn "Node.js 22+ recommended. Detected major: $node_major"
        else
            success "Node.js runtime check completed"
        fi
    fi
}

check_file_inventory() {
    check_start

    local count=0
    local file

    while IFS= read -r -d '' file; do
        count=$((count + 1))
    done < <(collect_files)

    FILES_SCANNED=$count

    success "Repository inventory collected ($FILES_SCANNED files)"
}

check_package_json() {
    check_start

    [[ -f "$ROOT_DIR/package.json" ]] ||
        { skip "No root package.json"; return 0; }

    has_command node ||
        { skip "package.json validation requires Node.js"; return 0; }

    if node -e '
        const fs = require("fs");
        const p = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));

        if (!p || typeof p !== "object" || Array.isArray(p))
            throw Error("Root must be an object");

        if (p.name !== undefined && typeof p.name !== "string")
            throw Error("name must be a string");

        if (p.scripts !== undefined &&
            (!p.scripts || typeof p.scripts !== "object" ||
             Array.isArray(p.scripts)))
            throw Error("scripts must be an object");
    ' "$ROOT_DIR/package.json" >/dev/null 2>&1; then
        success "package.json is valid JSON with basic structure"
    else
        error "package.json is invalid or has invalid basic structure"
    fi
}

check_python_syntax() {
    check_start

    has_command python3 ||
        { skip "Python syntax check requires python3"; return 0; }

    local count=0
    local failed=0
    local file

    while IFS= read -r -d '' file; do
        [[ "$file" == *.py ]] || continue
        is_regular_safe_file "$file" || continue

        count=$((count + 1))

        if ! python3 -c '
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
source = path.read_bytes()

if b"\x00" in source:
    raise SyntaxError("NUL byte in Python source")

compile(source, str(path), "exec")
' "$ROOT_DIR/$file" >/dev/null 2>&1; then
            error "Python syntax error: $file"
            failed=$((failed + 1))
        fi
    done < <(collect_files)

    if (( count == 0 )); then
        skip "No Python files found"
    elif (( failed == 0 )); then
        success "Python syntax validation passed ($count files)"
    fi
}

check_json_files() {
    check_start

    local count=0
    local failed=0
    local file

    while IFS= read -r -d '' file; do
        [[ "$file" == *.json ]] || continue
        is_regular_safe_file "$file" || continue

        count=$((count + 1))

        if has_command node; then
            node -e '
                JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
            ' "$ROOT_DIR/$file" >/dev/null 2>&1 || {
                error "Invalid JSON: $file"
                failed=$((failed + 1))
            }
        elif has_command python3; then
            python3 -m json.tool "$ROOT_DIR/$file" >/dev/null 2>&1 || {
                error "Invalid JSON: $file"
                failed=$((failed + 1))
            }
        else
            skip "JSON validation requires Node.js or Python"
            return 0
        fi
    done < <(collect_files)

    if (( count == 0 )); then
        skip "No JSON files found"
    elif (( failed == 0 )); then
        success "JSON validation passed ($count files)"
    fi
}

check_shell_syntax() {
    check_start

    local count=0
    local failed=0
    local file

    while IFS= read -r -d '' file; do
        [[ "$file" == *.sh ]] || continue
        is_regular_safe_file "$file" || continue

        count=$((count + 1))

        if ! bash -n "$ROOT_DIR/$file" 2>/dev/null; then
            error "Shell syntax error: $file"
            failed=$((failed + 1))
        fi
    done < <(collect_files)

    if (( count == 0 )); then
        skip "No shell scripts found"
    elif (( failed == 0 )); then
        success "Shell syntax validation passed ($count files)"
    fi
}

check_conflict_markers() {
    check_start

    local found=0
    local file

    while IFS= read -r -d '' file; do
        is_text_candidate "$file" || continue
        is_regular_safe_file "$file" || continue

        if grep -nE \
            '^(<<<<<<< |=======|>>>>>>> )' \
            "$ROOT_DIR/$file" >/dev/null 2>&1; then
            error "Possible Git conflict marker: $file"
            found=$((found + 1))
        fi
    done < <(collect_files)

    if (( found == 0 )); then
        success "No obvious Git conflict markers detected"
    fi
}

# ------------------------------------------------------------------------------
# Safe whitespace repair
# ------------------------------------------------------------------------------

file_has_nul_byte() {
    local file="$1"

    LC_ALL=C grep -q $'\x00' "$file" 2>/dev/null
}

check_trailing_whitespace() {
    check_start

    local count=0
    local changed=0
    local failed=0
    local file
    local source
    local directory
    local filename
    local temporary
    local backup
    local mode
    local links

    if (( FIX )); then
        mkdir -p -- "$BACKUP_DIR" ||
            die "Cannot create backup directory: $BACKUP_DIR"
    fi

    while IFS= read -r -d '' file; do
        is_text_candidate "$file" || continue
        is_regular_safe_file "$file" || continue

        source="$ROOT_DIR/$file"

        # Skip binary or oversized files.
        if [[ "$(wc -c < "$source")" -gt 5242880 ]]; then
            skip "Whitespace check skipped oversized file: $file"
            continue
        fi

        if LC_ALL=C grep -q $'\x00' "$source" 2>/dev/null; then
            skip "Whitespace check skipped binary file: $file"
            continue
        fi

        grep -nE '[[:blank:]]+$' "$source" >/dev/null 2>&1 ||
            continue

        count=$((count + 1))

        if (( ! FIX )); then
            warn "Trailing whitespace detected: $file"
            continue
        fi

        directory="$(dirname -- "$source")"
        filename="$(basename -- "$source")"

        if has_command stat; then
            links="$(stat -c '%h' "$source" 2>/dev/null || stat -f '%l' "$source" 2>/dev/null || printf '1')"
            mode="$(stat -c '%a' "$source" 2>/dev/null || stat -f '%Lp' "$source" 2>/dev/null || printf '')"
        else
            links="1"
            mode=""
        fi

        if [[ "$links" =~ ^[0-9]+$ ]] && (( links > 1 )); then
            warn "Skipping hard-linked file: $file"
            SKIPS=$((SKIPS + 1))
            continue
        fi

        temporary="$(mktemp "$directory/.${filename}.enforce.XXXXXX")" || {
            error "Cannot create temporary file: $file"
            failed=$((failed + 1))
            continue
        }

        if ! sed 's/[[:blank:]]*$//' "$source" > "$temporary"; then
            rm -f -- "$temporary"
            error "Whitespace processing failed: $file"
            failed=$((failed + 1))
            continue
        fi

        if [[ -n "$mode" ]]; then
            chmod "$mode" "$temporary" 2>/dev/null || {
                rm -f -- "$temporary"
                error "Cannot preserve file permissions: $file"
                failed=$((failed + 1))
                continue
            }
        fi

        backup="$BACKUP_DIR/${filename}.$(date -u '+%Y%m%dT%H%M%SZ').$$.bak"

        if ! cp -p -- "$source" "$backup"; then
            rm -f -- "$temporary"
            error "Backup failed; original retained: $file"
            failed=$((failed + 1))
            continue
        fi

        if ! cmp -s "$source" "$backup"; then
            rm -f -- "$temporary"
            error "Backup verification failed: $file"
            failed=$((failed + 1))
            continue
        fi

        if mv -f -- "$temporary" "$source"; then
            changed=$((changed + 1))
            FIXED_FILES=$((FIXED_FILES + 1))
            info "Whitespace corrected: $file"
        else
            rm -f -- "$temporary"
            error "Atomic replacement failed: $file"
            failed=$((failed + 1))
        fi
    done < <(collect_files)

    FIX_FAILURES=$((FIX_FAILURES + failed))

    if (( FIX )); then
        success "Whitespace repair completed: $changed changed, $failed failed"
        warn "Backups are stored in: $BACKUP_DIR"
        warn "Atomic replacement preserves permissions where supported, but may not preserve ownership, ACLs, extended attributes, or hard-link relationships."
    elif (( count == 0 )); then
        success "No trailing whitespace detected"
    fi
}

check_line_endings() {
    check_start

    local found=0
    local file

    while IFS= read -r -d '' file; do
        is_text_candidate "$file" || continue
        is_regular_safe_file "$file" || continue

        if LC_ALL=C grep -q $'\r' "$ROOT_DIR/$file" 2>/dev/null; then
            warn "Carriage-return characters detected: $file"
            found=$((found + 1))
        fi
    done < <(collect_files)

    if (( found == 0 )); then
        success "No carriage-return characters detected"
    fi
}

# ------------------------------------------------------------------------------
# Environment and configuration checks
# ------------------------------------------------------------------------------

check_environment_safety() {
    check_start

    local gitignore="$ROOT_DIR/.gitignore"

    if [[ ! -f "$gitignore" ]]; then
        warn ".gitignore is missing"
        return 0
    fi

    if grep -Eq '^[[:space:]]*\.env/?([[:space:]]|$)' "$gitignore" &&
        grep -Eq '^[[:space:]]*\.env\.\*([[:space:]]|$)' "$gitignore"; then
        success ".gitignore contains likely environment-file exclusions"
    else
        warn "Review .gitignore for .env and .env.* exclusions"
    fi

    if has_command git &&
        git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then

        if git -C "$ROOT_DIR" ls-files --error-unmatch .env \
            >/dev/null 2>&1; then
            error "Root .env is tracked by Git. Review exposure and rotate any exposed credentials."
        else
            success "Root .env is not tracked by Git"
        fi
    else
        skip "Tracked .env check requires Git"
    fi
}

check_html_basics() {
    check_start

    local count=0
    local file

    while IFS= read -r -d '' file; do
        case "$file" in
            *.html|*.htm) ;;
            *) continue ;;
        esac

        is_regular_safe_file "$file" || continue
        count=$((count + 1))

        grep -Eiq '<!doctype[[:space:]]+html' "$ROOT_DIR/$file" ||
            warn "HTML5 doctype missing: $file"

        grep -Eiq '<html([[:space:]>])' "$ROOT_DIR/$file" ||
            warn "HTML root element missing: $file"

        grep -Eiq '<meta[^>]+charset[[:space:]]*=' "$ROOT_DIR/$file" ||
            warn "Charset declaration missing: $file"

        grep -Eiq "<meta[^>]+name=[\"']viewport[\"']" "$ROOT_DIR/$file" ||
            warn "Viewport declaration missing: $file"

    done < <(collect_files)

    if (( count == 0 )); then
        skip "No HTML files found"
    else
        success "HTML metadata scan completed ($count files)"
    fi
}

check_dependency_lockfiles() {
    check_start

    [[ -f "$ROOT_DIR/package.json" ]] ||
        { skip "No root package.json"; return 0; }

    if [[ -f "$ROOT_DIR/package-lock.json" ||
        -f "$ROOT_DIR/npm-shrinkwrap.json" ||
        -f "$ROOT_DIR/yarn.lock" ||
        -f "$ROOT_DIR/pnpm-lock.yaml" ]]; then
        success "Node.js dependency lockfile found"
    else
        warn "package.json exists without a recognized dependency lockfile"
    fi
}

check_npm_scripts() {
    check_start

    [[ -f "$ROOT_DIR/package.json" ]] ||
        { skip "No root package.json"; return 0; }

    has_command node ||
        { skip "npm script inventory requires Node.js"; return 0; }

    local scripts
    local script

    scripts="$(
        node -e '
            const p = require(process.argv[1]);
            console.log(Object.keys(p.scripts || {}).join("\n"));
        ' "$ROOT_DIR/package.json" 2>/dev/null
    )" || {
        error "Cannot read npm scripts"
        return 0
    }

    [[ -n "$scripts" ]] || {
        warn "No npm scripts are configured"
        return 0
    }

    for script in lint test build; do
        if grep -Fxq "$script" <<< "$scripts"; then
            info "Available npm script: $script"
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

    while IFS= read -r -d '' file; do
        is_text_candidate "$file" || continue
        is_regular_safe_file "$file" || continue

        case "$file" in
            *.example|*example*|*sample*|*template*|*test*|*fixture*|*lock*|*LICENSE*|*license*)
                continue
                ;;
        esac

        if grep -nEI \
            '(-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|AIza[0-9A-Za-z_-]{30,})' \
            "$ROOT_DIR/$file" >/dev/null 2>&1; then

            warn "Possible credential pattern detected: $file"
            findings=$((findings + 1))
        fi
    done < <(collect_files)

    if (( findings == 0 )); then
        success "No configured high-signal secret patterns detected"
        info "This heuristic scan does not establish that the repository is secret-free."
    else
        warn "Manual review required for $findings flagged files"
    fi
}

check_npm_audit() {
    check_start

    [[ -f "$ROOT_DIR/package-lock.json" ]] ||
        { skip "npm audit requires package-lock.json"; return 0; }

    has_command npm ||
        { skip "npm audit requires npm"; return 0; }

    info "Running production npm audit. Network access may be required."

    if npm --prefix "$ROOT_DIR" audit --omit=dev --audit-level=high; then
        success "npm production dependency audit passed"
    else
        warn "npm audit reported vulnerabilities or could not reach the registry"
    fi
}

check_python_dependencies() {
    check_start

    if [[ ! -f "$ROOT_DIR/requirements.txt" &&
        ! -f "$ROOT_DIR/pyproject.toml" ]]; then
        skip "No root Python dependency manifest found"
        return 0
    fi

    has_command python3 ||
        { skip "Python dependency check requires python3"; return 0; }

    if python3 -m pip check; then
        success "Installed Python dependency consistency check passed"
    else
        warn "Python dependency consistency check failed or environment unavailable"
    fi
}

# ------------------------------------------------------------------------------
# Execute checks
# ------------------------------------------------------------------------------

check_repository_root
check_required_structure
check_tooling
check_file_inventory
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

if (( SECURITY )); then
    log "Running additional security checks"
    check_secret_patterns
    check_npm_audit
fi

# ------------------------------------------------------------------------------
# Final summary
# ------------------------------------------------------------------------------

DURATION=$((SECONDS - START_TIME))

printf '\n'
printf '%s\n' "============================================================"
printf '%s\n' " MEDORBITS ENFORCEMENT SUMMARY"
printf '%s\n' "============================================================"
printf 'Version: %s\n' "$SCRIPT_VERSION"
printf 'Repository: %s\n' "$ROOT_DIR"
printf 'Files scanned: %s\n' "$FILES_SCANNED"
printf 'Checks run: %s\n' "$CHECKS"
printf 'Errors: %s\n' "$ERRORS"
printf 'Warnings: %s\n' "$WARNINGS"
printf 'Skipped: %s\n' "$SKIPS"
printf 'Files repaired: %s\n' "$FIXED_FILES"
printf 'Repair failures: %s\n' "$FIX_FAILURES"
printf 'Strict mode: %s\n' "$STRICT"
printf 'Security mode: %s\n' "$SECURITY"
printf 'Duration: %ss\n' "$DURATION"
printf '%s\n' "============================================================"

if (( ERRORS > 0 )); then
    printf '[RESULT] FAILED: resolve reported errors.\n' >&2
    exit 1
fi

if (( FIX_FAILURES > 0 )); then
    printf '[RESULT] FAILED: one or more repair operations failed.\n' >&2
    exit 1
fi

if (( STRICT && WARNINGS > 0 )); then
    printf '[RESULT] FAILED: strict mode treats warnings as failures.\n' >&2
    exit 1
fi

printf '[RESULT] PASSED: no blocking errors detected by enabled checks.\n'
exit 0
