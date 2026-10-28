#!/usr/bin/env bash
# ==============================================================================
# MedOrbits Repository Enforcement Tool
# File: tools/ENFORCE.sh
# Version: 1.1.0
#
# Purpose:
#   Safe repository inventory and quality checks for mixed HTML/CSS/JS/Python/
#   JSON/Bash projects. Reports findings; it does not suppress failures.
#
# Usage:
#   bash tools/ENFORCE.sh [--strict] [--fix] [--security] [--quiet]
#
# Safety:
#   --fix removes trailing whitespace only from supported text files.
#   It uses same-directory temporary files and atomic replacement, preserving
#   file mode where supported. It does not delete caches, install packages,
#   alter Git history, deploy code, or modify environment secrets.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_VERSION="1.1.0"
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
FILES_SCANNED=0

die() {
    printf '[ERROR] %s\n' "$*" >&2
    exit 2
}

log()     { printf '[ENFORCE] %s\n' "$*"; }
info()    { (( QUIET )) || printf '[INFO] %s\n' "$*"; }
success() { printf '[PASS] %s\n' "$*"; }
warn()    { WARNINGS=$((WARNINGS + 1)); printf '[WARN] %s\n' "$*" >&2; }
error()   { ERRORS=$((ERRORS + 1)); printf '[FAIL] %s\n' "$*" >&2; }
skip()    { SKIPS=$((SKIPS + 1)); (( QUIET )) || printf '[SKIP] %s\n' "$*"; }
check_start() { CHECKS=$((CHECKS + 1)); }

usage() {
    cat <<'EOF'
MedOrbits Repository Enforcement Tool

Usage:
  bash tools/ENFORCE.sh [options]

Options:
  --strict       Treat warnings as failures.
  --fix          Remove trailing whitespace from supported text files.
  --security     Run additional secret-pattern and npm production audit checks.
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

The script does not install packages, deploy code, delete caches, or modify Git history.
EOF
}

while (($#)); do
    case "$1" in
        --strict)   STRICT=1 ;;
        --fix)      FIX=1 ;;
        --security) SECURITY=1 ;;
        --quiet)    QUIET=1 ;;
        --help|-h)  usage; exit 0 ;;
        --version)  printf '%s %s\n' "$SCRIPT_NAME" "$SCRIPT_VERSION"; exit 0 ;;
        *)          die "Unknown option: $1. Use --help for usage." ;;
    esac
    shift
done

SCRIPT_DIR="$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &&
    pwd -P
)"

if [[ -n "${ENFORCE_ROOT:-}" ]]; then
    [[ -d "$ENFORCE_ROOT" ]] || die "ENFORCE_ROOT is not a directory: $ENFORCE_ROOT"
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

has_command() { command -v "$1" >/dev/null 2>&1; }

is_ignored_path() {
    case "/$1/" in
        */.git/*|*/node_modules/*|*/vendor/*|*/.venv/*|*/venv/*|\
        */__pycache__/*|*/dist/*|*/build/*|*/coverage/*|*/.next/*|\
        */.pytest_cache/*|*/.mypy_cache/*|*/.ruff_cache/*)
            return 0 ;;
        *) return 1 ;;
    esac
}

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
            \( -type d \( -name .git -o -name node_modules -o -name vendor \
                -o -name .venv -o -name venv -o -name __pycache__ \
                -o -name dist -o -name build -o -name coverage \
                -o -name .next -o -name .pytest_cache -o -name .mypy_cache \
                -o -name .ruff_cache \) -prune \) -o \
            \( -type f -print \) |
            sed "s#^$ROOT_DIR/##"
    fi
}

is_text_candidate() {
    case "$1" in
        *.html|*.htm|*.css|*.scss|*.js|*.mjs|*.cjs|*.ts|*.tsx|*.jsx|\
        *.py|*.sh|*.json|*.yml|*.yaml|*.md|*.sql|*.xml|*.txt|*.toml|\
        *.ini|*.conf|*.example)
            return 0 ;;
        *) return 1 ;;
    esac
}

check_repository_root() {
    check_start
    if has_command git && git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        success "Git repository detected"
    else
        warn "Git repository metadata not detected"
    fi

    [[ -f "$ROOT_DIR/package.json" ]] && success "Root package.json found" || info "No root package.json"
    [[ -f "$ROOT_DIR/requirements.txt" ]] && success "Root requirements.txt found" || info "No root requirements.txt"
    [[ -f "$ROOT_DIR/.env.example" ]] && success ".env.example found" || warn ".env.example is missing"
    [[ -f "$ROOT_DIR/.gitignore" ]] && success ".gitignore found" || warn ".gitignore is missing"

    if [[ -f "$ROOT_DIR/.env" ]]; then
        warn "Root .env exists; confirm it is ignored and contains no committed secrets"
    fi
}

check_required_structure() {
    check_start
    local -a candidates=(tools assets pages education career api python tests monitoring)
    local existing=0 path

    for path in "${candidates[@]}"; do
        if [[ -d "$ROOT_DIR/$path" ]]; then
            info "Directory present: $path/"
            existing=$((existing + 1))
        fi
    done

    [[ -d "$ROOT_DIR/tools" ]] && success "tools/ directory exists" || warn "tools/ directory is missing"
    if (( existing > 0 )); then
        success "Structure scan completed ($existing recognized directories)"
    else
        warn "No recognized MedOrbits project directories detected"
    fi
}

check_tooling() {
    check_start
    local tool
    for tool in bash git node npm python3; do
        if has_command "$tool"; then
            info "Available: $tool"
        else
            case "$tool" in
                bash|git) warn "Recommended command unavailable: $tool" ;;
                *) skip "Optional command unavailable: $tool" ;;
            esac
        fi
    done

    if has_command bash; then
        if (( BASH_VERSINFO[0] < 4 )); then
            warn "Bash 4+ recommended; detected $BASH_VERSION"
        else
            success "Bash version supported: $BASH_VERSION"
        fi
    fi

    if has_command node; then
        local node_major
        node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || printf '0')"
        if [[ "$node_major" =~ ^[0-9]+$ ]] && (( node_major < 20 )); then
            warn "Node.js 20+ recommended; detected major version $node_major"
        else
            success "Node.js runtime check completed"
        fi
    fi
}

check_package_json() {
    check_start
    [[ -f "$ROOT_DIR/package.json" ]] || { skip "No root package.json"; return 0; }
    if ! has_command node; then
        skip "package.json structure check requires Node.js"
        return 0
    fi

    if node -e '
        const fs = require("fs");
        const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
        if (!p || typeof p !== "object" || Array.isArray(p)) throw Error("root must be an object");
        if (p.name !== undefined && typeof p.name !== "string") throw Error("name must be a string");
        if (p.scripts !== undefined && (!p.scripts || typeof p.scripts !== "object" || Array.isArray(p.scripts))) throw Error("scripts must be an object");
    ' >/dev/null 2>&1; then
        success "package.json parses and has valid basic structure"
    else
        error "package.json is invalid JSON or has invalid basic structure"
    fi
}

check_python_syntax() {
    check_start
    has_command python3 || { skip "Python syntax check requires python3"; return 0; }

    local count=0 failed=0 file
    while IFS= read -r file; do
        [[ "$file" == *.py && -f "$ROOT_DIR/$file" ]] || continue
        count=$((count + 1))
        # compile() checks syntax without writing .pyc files or deleting caches.
        if ! python3 -c '
import pathlib, sys
path = pathlib.Path(sys.argv[1])
source = path.read_bytes()
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
    local count=0 failed=0 file
    while IFS= read -r file; do
        [[ "$file" == *.json && -f "$ROOT_DIR/$file" ]] || continue
        count=$((count + 1))
        if has_command node; then
            node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' \
                "$ROOT_DIR/$file" >/dev/null 2>&1 || {
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
    local count=0 failed=0 file
    while IFS= read -r file; do
        [[ "$file" == *.sh && -f "$ROOT_DIR/$file" ]] || continue
        count=$((count + 1))
        bash -n "$ROOT_DIR/$file" 2>/dev/null || {
            error "Shell syntax error: $file"
            failed=$((failed + 1))
        }
    done < <(collect_files)

    if (( count == 0 )); then
        skip "No shell scripts found"
    elif (( failed == 0 )); then
        success "Shell syntax validation passed ($count files)"
    fi
}

check_conflict_markers() {
    check_start
    local found=0 file
    while IFS= read -r file; do
        [[ -f "$ROOT_DIR/$file" ]] || continue
        is_text_candidate "$file" || continue
        if grep -nE '^(<<<<<<< |=======|>>>>>>> )' "$ROOT_DIR/$file" >/dev/null 2>&1; then
            error "Possible merge-conflict marker: $file"
            found=$((found + 1))
        fi
    done < <(collect_files)
    (( found > 0 )) || success "No obvious merge-conflict markers found"
}

check_trailing_whitespace() {
    check_start
    local count=0 changed=0 file temp dir base mode
    while IFS= read -r file; do
        [[ -f "$ROOT_DIR/$file" ]] || continue
        is_text_candidate "$file" || continue
        grep -nE '[[:blank:]]+$' "$ROOT_DIR/$file" >/dev/null 2>&1 || continue
        count=$((count + 1))

        if (( ! FIX )); then
            warn "Trailing whitespace detected: $file"
            continue
        fi

        dir="$(dirname -- "$ROOT_DIR/$file")"
        base="$(basename -- "$ROOT_DIR/$file")"
        temp="$(mktemp "$dir/.${base}.enforce.XXXXXX")" || {
            error "Could not create temporary file for: $file"
            continue
        }

        if ! sed 's/[[:blank:]]*$//' "$ROOT_DIR/$file" > "$temp"; then
            rm -f -- "$temp"
            error "Could not prepare whitespace fix: $file"
            continue
        fi

        if has_command stat; then
            if mode="$(stat -c '%a' "$ROOT_DIR/$file" 2>/dev/null)"; then
                chmod "$mode" "$temp" 2>/dev/null || true
            elif mode="$(stat -f '%Lp' "$ROOT_DIR/$file" 2>/dev/null)"; then
                chmod "$mode" "$temp" 2>/dev/null || true
            fi
        fi

        if mv -f -- "$temp" "$ROOT_DIR/$file"; then
            changed=$((changed + 1))
        else
            rm -f -- "$temp"
            error "Could not replace file after whitespace fix: $file"
        fi
    done < <(collect_files)

    if (( FIX )); then
        success "Whitespace fix pass completed ($changed files changed)"
    elif (( count == 0 )); then
        success "No trailing whitespace detected"
    fi
}

check_line_endings() {
    check_start
    local found=0 file
    while IFS= read -r file; do
        [[ -f "$ROOT_DIR/$file" ]] || continue
        is_text_candidate "$file" || continue
        if LC_ALL=C grep -Il $'\r' "$ROOT_DIR/$file" >/dev/null 2>&1; then
            warn "Carriage-return characters detected; review line endings: $file"
            found=$((found + 1))
        fi
    done < <(collect_files)
    (( found > 0 )) || success "No carriage-return characters detected in supported text files"
}

check_environment_safety() {
    check_start
    local gi="$ROOT_DIR/.gitignore"

    if [[ -f "$gi" ]]; then
        # This is a heuristic review; Git ignore rules have additional semantics.
        if grep -Eq '^[[:space:]]*\.env([/[:space:]]|$)' "$gi" &&
           grep -Eq '^[[:space:]]*\.env\.\*([/[:space:]]|$)' "$gi"; then
            success ".gitignore appears to exclude .env and .env.* files"
        else
            warn "Review .gitignore: add .env and .env.* exclusions and explicitly allow .env.example"
        fi
        if ! grep -Eq '^[[:space:]]*!\.env\.example([/[:space:]]|$)' "$gi"; then
            info "If using a broad .env.* ignore rule, add !.env.example after it"
        fi
    else
        warn "Cannot verify environment-file exclusions without .gitignore"
    fi

    if has_command git && git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        if git -C "$ROOT_DIR" ls-files --error-unmatch .env >/dev/null 2>&1; then
            error "Root .env is tracked by Git; remove secrets from version control and rotate exposed credentials"
        else
            success "Root .env is not tracked by Git"
        fi
    else
        skip "Tracked .env check requires Git"
    fi
}

check_html_basics() {
    check_start
    local count=0 file
    while IFS= read -r file; do
        case "$file" in *.html|*.htm) ;; *) continue ;; esac
        [[ -f "$ROOT_DIR/$file" ]] || continue
        count=$((count + 1))

        grep -Eiq '<!doctype[[:space:]]+html' "$ROOT_DIR/$file" ||
            warn "HTML document lacks an HTML5 doctype: $file"
        grep -Eiq '<html([[:space:]>])' "$ROOT_DIR/$file" ||
            warn "HTML document lacks an html root element: $file"
        grep -Eiq '<meta[^>]+charset[[:space:]]*=' "$ROOT_DIR/$file" ||
            warn "HTML document may be missing a charset declaration: $file"
        grep -Eiq "<meta[^>]+name=[\"']viewport[\"']" "$ROOT_DIR/$file" ||
            warn "HTML document may be missing a responsive viewport: $file"
    done < <(collect_files)

    if (( count == 0 )); then
        skip "No HTML files found"
    else
        success "HTML basic metadata scan completed ($count files; review warnings above)"
    fi
}

check_dependency_lockfiles() {
    check_start
    [[ -f "$ROOT_DIR/package.json" ]] || { skip "No root package.json"; return 0; }
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
    [[ -f "$ROOT_DIR/package.json" ]] || { skip "No root package.json"; return 0; }
    has_command node || { skip "npm scripts check requires Node.js"; return 0; }

    local scripts script
    scripts="$(node -e 'const p=require("./package.json"); console.log(Object.keys(p.scripts||{}).join("\n"))' 2>/dev/null)" ||
        { error "Unable to read npm scripts from package.json"; return 0; }

    [[ -n "$scripts" ]] || { warn "No npm scripts are defined"; return 0; }
    for script in lint test build; do
        grep -Fxq "$script" <<< "$scripts" && info "npm script available: $script" ||
            info "Optional npm script not configured: $script"
    done
    success "npm script inventory completed"
}

check_secret_patterns() {
    check_start
    local file findings=0
    while IFS= read -r file; do
        [[ -f "$ROOT_DIR/$file" ]] || continue
        is_text_candidate "$file" || continue
        case "$file" in
            *.example|*example*|*sample*|*template*|*test*|*fixture*|*lock*|*LICENSE*|*license*)
                continue ;;
        esac

        if grep -nEI \
          '(-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{24,}|AIza[0-9A-Za-z_-]{30,})' \
          "$ROOT_DIR/$file" >/dev/null 2>&1; then
            warn "Possible hard-coded credential pattern: $file (manual review required)"
            findings=$((findings + 1))
        fi
    done < <(collect_files)

    if (( findings == 0 )); then
        success "No known high-signal credential patterns detected"
    else
        warn "Secret-pattern scan flagged $findings file(s); results are heuristic"
    fi
}

check_npm_audit() {
    check_start
    [[ -f "$ROOT_DIR/package-lock.json" ]] || { skip "npm audit requires package-lock.json"; return 0; }
    has_command npm || { skip "npm audit requires npm"; return 0; }

    info "Running npm audit --omit=dev --audit-level=high (network access may be required)"
    if npm --prefix "$ROOT_DIR" audit --omit=dev --audit-level=high; then
        success "npm production dependency audit passed"
    else
        warn "npm audit reported vulnerabilities or could not reach the registry; inspect its output"
    fi
}

check_python_dependencies() {
    check_start
    [[ -f "$ROOT_DIR/requirements.txt" ]] || { skip "No root requirements.txt"; return 0; }
    has_command python3 || { skip "Python dependency check requires python3"; return 0; }

    if python3 -m pip check; then
        success "Installed Python package dependency consistency check passed"
    else
        warn "Python package dependency check failed or pip environment is unavailable"
    fi
}

check_file_inventory() {
    check_start
    local count=0 file
    while IFS= read -r file; do
        [[ -n "$file" ]] || continue
        count=$((count + 1))
    done < <(collect_files)
    FILES_SCANNED=$count
    success "Repository inventory collected ($FILES_SCANNED files)"
}

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

printf '\n'
printf '%s\n' "============================================================"
printf '%s\n' " MedOrbits Enforcement Summary"
printf '%s\n' "============================================================"
printf 'Repository: %s\n' "$ROOT_DIR"
printf 'Files scanned: %s\n' "$FILES_SCANNED"
printf 'Checks run: %s\n' "$CHECKS"
printf 'Errors: %s\n' "$ERRORS"
printf 'Warnings: %s\n' "$WARNINGS"
printf 'Skipped: %s\n' "$SKIPS"
printf 'Strict mode: %s\n' "$STRICT"
printf 'Security mode: %s\n' "$SECURITY"
printf '%s\n' "============================================================"

if (( ERRORS > 0 )); then
    printf '[RESULT] FAILED: resolve reported errors.\n' >&2
    exit 1
fi
if (( STRICT && WARNINGS > 0 )); then
    printf '[RESULT] FAILED: strict mode treats warnings as failures.\n' >&2
    exit 1
fi

printf '[RESULT] PASSED: no blocking errors detected by the enabled checks.\n'
