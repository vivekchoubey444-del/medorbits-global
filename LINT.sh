#!/usr/bin/env bash
# ============================================================
# MedOrbits Lint Utility
# File: /LINT.sh
#
# Purpose:
#   Run available JavaScript/TypeScript, CSS, HTML, JSON, and
#   Python lint checks using tools already installed locally.
#
# Commands:
#   all          Run all available lint checks
#   js           JavaScript and TypeScript
#   css          CSS / SCSS
#   html         HTML
#   json         JSON syntax validation
#   python       Python syntax and optional Ruff checks
#   check        Check available lint tools and configuration
#   help         Display usage
#
# Safety:
#   - Check mode is read-only.
#   - Does not install dependencies.
#   - Does not auto-fix files.
#   - Does not deploy or run database migrations.
#   - Does not print environment variable values or secrets.
#
# Requirements:
#   Bash 4+; relevant local tools for the selected checks.
#
# Usage:
#   ./LINT.sh
#   ./LINT.sh all
#   ./LINT.sh js
#   ./LINT.sh json
#   ./LINT.sh --root /path/to/project all
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
readonly SCRIPT_NAME="LINT.sh"
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
COMMAND="all"
STRICT=0
INCLUDE_IGNORED=0
ERRORS=0
WARNINGS=0
CHECKS=0
SKIPPED=0
log() {
    printf '[LINT] %s\n' "$*"
}
warn() {
    WARNINGS=$((WARNINGS + 1))
    printf '[WARN] %s\n' "$*" >&2
}
error() {
    ERRORS=$((ERRORS + 1))
    printf '[FAIL] %s\n' "$*" >&2
}
pass() {
    CHECKS=$((CHECKS + 1))
    printf '[PASS] %s\n' "$*"
}
skip() {
    SKIPPED=$((SKIPPED + 1))
    printf '[SKIP] %s\n' "$*"
}
die() {
    printf '[ERROR] %s\n' "$*" >&2
    exit 2
}
usage() {
    cat <<'USAGE'
MedOrbits Lint Utility
Usage:
  ./LINT.sh [options] [command]
Commands:
  all          Run all available checks (default)
  js           Lint JavaScript and TypeScript
  css          Lint CSS / SCSS if a local linter is configured
  html         Lint HTML if a local linter is configured
  json         Validate JSON syntax
  python       Compile Python files and optionally run Ruff
  check        Report installed tools and configuration
  help         Show help
Options:
  --root PATH          Project root
  --strict             Treat skipped checks and warnings as failures
  --include-ignored    Include Git-ignored files during JSON checks
  --help               Show help
Examples:
  ./LINT.sh
  ./LINT.sh js
  ./LINT.sh json --strict
  ./LINT.sh --root /path/to/MedOrbits all
Notes:
  - Tools are never installed automatically.
  - No automatic fixes are applied.
  - Package scripts are used only when explicitly configured.
  - Run package scripts only after reviewing package.json.
USAGE
}
parse_args() {
    local -a positional=()
    while (($#)); do
        case "$1" in
            --root)
                (($# >= 2)) || die "--root requires a directory."
                PROJECT_ROOT="$2"
                shift 2
                ;;
            --strict)
                STRICT=1
                shift
                ;;
            --include-ignored)
                INCLUDE_IGNORED=1
                shift
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            all|js|css|html|json|python|check|help)
                positional+=("$1")
                shift
                ;;
            *)
                die "Unknown option or command: $1"
                ;;
        esac
    done
    ((${#positional[@]} <= 1)) || die "Specify only one command."
    if ((${#positional[@]} == 1)); then
        COMMAND="${positional[0]}"
    fi
}
canonicalize_root() {
    [[ -d "$PROJECT_ROOT" ]] || die "Project root does not exist."
    PROJECT_ROOT="$(cd -- "$PROJECT_ROOT" && pwd -P)"
}
has_package_script() {
    local name="$1"
    [[ -f "$PROJECT_ROOT/package.json" ]] || return 1
    command -v node >/dev/null 2>&1 || return 1
    node - "$PROJECT_ROOT/package.json" "$name" <<'NODE'
const fs = require("node:fs");
try {
  const pkg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  process.exit(
    pkg.scripts && typeof pkg.scripts[process.argv[3]] === "string"
      ? 0 : 1
  );
} catch {
  process.exit(1);
}
NODE
}
has_local_binary() {
    local binary="$1"
    [[ -x "$PROJECT_ROOT/node_modules/.bin/$binary" ]]
}
run_package_script() {
    local script="$1"
    if ! has_package_script "$script"; then
        skip "No package.json script configured: $script"
        return 0
    fi
    if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
        warn "Cannot run '$script': node_modules is missing."
        return 0
    fi
    log "Running configured npm script: $script"
    if npm --prefix "$PROJECT_ROOT" run "$script"; then
        pass "npm script '$script' passed"
    else
        error "npm script '$script' failed"
    fi
}
check_tools() {
    log "Checking locally available lint tools..."
    local tool
    for tool in node npm python3; do
        if command -v "$tool" >/dev/null 2>&1; then
            pass "$tool is available"
        else
            skip "$tool is not installed"
        fi
    done
    local -a binaries=(
        eslint
        prettier
        stylelint
        htmlhint
        biome
        tsc
    )
    for tool in "${binaries[@]}"; do
        if has_local_binary "$tool"; then
            pass "Local tool available: $tool"
        else
            skip "Local tool not found: $tool"
        fi
    done
    if command -v ruff >/dev/null 2>&1; then
        pass "ruff is available"
    else
        skip "ruff is not installed"
    fi
    if [[ -f "$PROJECT_ROOT/eslint.config.js" ||
          -f "$PROJECT_ROOT/eslint.config.mjs" ||
          -f "$PROJECT_ROOT/eslint.config.cjs" ||
          -f "$PROJECT_ROOT/.eslintrc" ||
          -f "$PROJECT_ROOT/.eslintrc.json" ||
          -f "$PROJECT_ROOT/.eslintrc.js" ||
          -f "$PROJECT_ROOT/.eslintrc.cjs" ]]; then
        pass "ESLint configuration found"
    else
        warn "No standard ESLint configuration file detected."
    fi
}
run_eslint() {
    local target="$1"
    if has_local_binary eslint; then
        log "Running local ESLint on: $target"
        if [[ "$target" == "." ]]; then
            if "$PROJECT_ROOT/node_modules/.bin/eslint" .; then
                pass "ESLint passed"
            else
                error "ESLint reported issues"
            fi
        else
            if "$PROJECT_ROOT/node_modules/.bin/eslint" "$target"; then
                pass "ESLint passed for $target"
            else
                error "ESLint reported issues in $target"
            fi
        fi
        return 0
    fi
    if has_package_script lint; then
        run_package_script lint
        return 0
    fi
    skip "ESLint unavailable and no package.json lint script exists"
}
lint_js() {
    log "JavaScript / TypeScript checks..."
    if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
        warn "node_modules is missing; JavaScript lint tools may be unavailable."
    fi
    if has_local_binary eslint; then
        run_eslint "."
    elif has_package_script lint; then
        run_package_script lint
    elif has_local_binary biome; then
        log "Running Biome check..."
        if "$PROJECT_ROOT/node_modules/.bin/biome" check \
            "$PROJECT_ROOT" \
            --max-diagnostics=100; then
            pass "Biome check passed"
        else
            error "Biome reported issues"
        fi
    elif has_local_binary prettier; then
        log "Running Prettier check on JavaScript and TypeScript..."
        if "$PROJECT_ROOT/node_modules/.bin/prettier" \
            --check \
            '**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}' \
            --ignore-path "$PROJECT_ROOT/.gitignore"; then
            pass "Prettier check passed"
        else
            error "Prettier reported formatting issues"
        fi
    else
        skip "No supported JavaScript/TypeScript linter is installed."
    fi
    if has_local_binary tsc && [[ -f "$PROJECT_ROOT/tsconfig.json" ]]; then
        log "Running TypeScript compiler in no-emit mode..."
        if "$PROJECT_ROOT/node_modules/.bin/tsc" \
            --project "$PROJECT_ROOT/tsconfig.json" \
            --noEmit; then
            pass "TypeScript type check passed"
        else
            error "TypeScript type check failed"
        fi
    fi
}
lint_css() {
    log "CSS / SCSS checks..."
    if has_local_binary stylelint; then
        if "$PROJECT_ROOT/node_modules/.bin/stylelint" \
            '**/*.{css,scss,sass}' \
            --ignore-pattern '**/node_modules/**'; then
            pass "Stylelint passed"
        else
            error "Stylelint reported issues"
        fi
    elif has_local_binary prettier; then
        if "$PROJECT_ROOT/node_modules/.bin/prettier" \
            --check '**/*.{css,scss,sass}' \
            --ignore-path "$PROJECT_ROOT/.gitignore"; then
            pass "Prettier CSS check passed"
        else
            error "Prettier reported CSS formatting issues"
        fi
    else
        skip "No local Stylelint or Prettier installation found."
    fi
}
lint_html() {
    log "HTML checks..."
    if has_local_binary htmlhint; then
        if "$PROJECT_ROOT/node_modules/.bin/htmlhint" \
            '**/*.html'; then
            pass "HTMLHint passed"
        else
            error "HTMLHint reported issues"
        fi
    elif has_local_binary prettier; then
        if "$PROJECT_ROOT/node_modules/.bin/prettier" \
            --check '**/*.html' \
            --ignore-path "$PROJECT_ROOT/.gitignore"; then
            pass "Prettier HTML check passed"
        else
            error "Prettier reported HTML formatting issues"
        fi
    else
        skip "No local HTMLHint or Prettier installation found."
    fi
}
find_json_files() {
    if command -v git >/dev/null 2>&1 &&
       git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        if ((INCLUDE_IGNORED)); then
            git -C "$PROJECT_ROOT" ls-files \
                --cached --others --exclude-standard --ignored \
                -z -- '*.json' ':(glob)**/*.json'
        else
            git -C "$PROJECT_ROOT" ls-files \
                --cached --others --exclude-standard \
                -z -- '*.json' ':(glob)**/*.json'
        fi
    else
        find "$PROJECT_ROOT" \
            \( -type d \( \
                -name .git -o \
                -name node_modules -o \
                -name backups -o \
                -name .next -o \
                -name dist -o \
                -name build \
            \) -prune \) -o \
            \( -type f -name '*.json' -print0 \)
    fi
}
lint_json() {
    log "JSON syntax validation..."
    if ! command -v node >/dev/null 2>&1; then
        skip "Node.js is unavailable; JSON validation skipped."
        return 0
    fi
    local total=0
    local invalid=0
    local file
    while IFS= read -r -d '' file; do
        [[ -f "$PROJECT_ROOT/$file" ]] || continue
        total=$((total + 1))
        if node - "$PROJECT_ROOT/$file" >/dev/null 2>&1 <<'NODE'
const fs = require("node:fs");
try {
  JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
} catch {
  process.exit(1);
}
NODE
        then
            :
        else
            invalid=$((invalid + 1))
            error "Invalid JSON: $file"
        fi
    done < <(find_json_files)
    if ((total == 0)); then
        skip "No JSON files found."
    elif ((invalid == 0)); then
        pass "All $total JSON file(s) are valid"
    else
        log "JSON summary: $invalid invalid file(s) out of $total."
    fi
}
lint_python() {
    log "Python checks..."
    if ! command -v python3 >/dev/null 2>&1; then
        skip "Python 3 is unavailable."
        return 0
    fi
    local -a python_files=()
    local file
    while IFS= read -r -d '' file; do
        python_files+=("$file")
    done < <(
        find "$PROJECT_ROOT" \
            \( -type d \( \
                -name .git -o \
                -name node_modules -o \
                -name .venv -o \
                -name venv -o \
                -name __pycache__ -o \
                -name backups \
            \) -prune \) -o \
            \( -type f -name '*.py' -print0 \)
    )
    if ((${#python_files[@]} == 0)); then
        skip "No Python files found."
        return 0
    fi
    if python3 - "${python_files[@]}" <<'PY'
import ast
import pathlib
import sys
failed = False
for filename in sys.argv[1:]:
    path = pathlib.Path(filename)
    try:
        source = path.read_text(encoding="utf-8")
        ast.parse(source, filename=str(path))
    except (OSError, UnicodeError, SyntaxError) as exc:
        print(f"[FAIL] {path}: {exc}")
        failed = True
sys.exit(1 if failed else 0)
PY
    then
        pass "Python syntax valid for ${#python_files[@]} file(s)"
    else
        error "Python syntax validation failed"
    fi
    if command -v ruff >/dev/null 2>&1; then
        if ruff check "${python_files[@]}"; then
            pass "Ruff checks passed"
        else
            error "Ruff reported issues"
        fi
    else
        skip "Ruff is unavailable; Python style checks skipped."
    fi
}
print_summary() {
    printf '\n[LINT] Summary: %s error(s), %s warning(s), %s skipped check(s).\n' \
        "$ERRORS" "$WARNINGS" "$SKIPPED"
    if ((ERRORS > 0)); then
        return 1
    fi
    if ((STRICT && (WARNINGS > 0 || SKIPPED > 0))); then
        printf '[LINT] Strict mode: warnings or skipped checks cause failure.\n' >&2
        return 1
    fi
    return 0
}
main() {
    parse_args "$@"
    canonicalize_root
    if [[ "$COMMAND" == "help" ]]; then
        usage
        return 0
    fi
    log "Project root: $PROJECT_ROOT"
    log "Command: $COMMAND"
    log "Mode: read-only; automatic fixes are disabled."
    case "$COMMAND" in
        check)
            check_tools
            ;;
        js)
            lint_js
            ;;
        css)
            lint_css
            ;;
        html)
            lint_html
            ;;
        json)
            lint_json
            ;;
        python)
            lint_python
            ;;
        all)
            check_tools
            lint_js
            lint_css
            lint_html
            lint_json
            lint_python
            ;;
        *)
            die "Unknown command: $COMMAND"
            ;;
    esac
    print_summary
}
main "$@"