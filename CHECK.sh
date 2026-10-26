#!/usr/bin/env bash
# ============================================================
# MedOrbits Project Check Utility
# File: /CHECK.sh
#
# Purpose:
#   Run safe, read-only checks against the MedOrbits repository.
#
# Commands:
#   all          Run all available checks
#   files        Check required files and project structure
#   json         Validate JSON files
#   node         Check Node.js and package.json
#   git          Inspect Git state without modifying it
#   security     Check common repository security safeguards
#   scripts      List available package.json scripts
#   help         Display help
#
# Safety:
#   - Never changes files.
#   - Never installs dependencies.
#   - Never deploys or runs database migrations.
#   - Never runs git reset, git clean, checkout, or stash.
#   - Does not print environment variable values or remote URLs.
#
# Requirements:
#   Bash 4+, find, grep, awk, and optionally Node.js/Git.
#
# Usage:
#   ./CHECK.sh
#   ./CHECK.sh all
#   ./CHECK.sh json
#   ./CHECK.sh security
#   ./CHECK.sh --root /path/to/project all
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
readonly SCRIPT_NAME="CHECK.sh"
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
COMMAND="all"
STRICT=0
CHECK_IGNORED=0
ERRORS=0
WARNINGS=0
CHECKS=0
PASSED=0
log() {
    printf '[CHECK] %s\n' "$*"
}
pass() {
    PASSED=$((PASSED + 1))
    CHECKS=$((CHECKS + 1))
    printf '[PASS] %s\n' "$*"
}
warn() {
    WARNINGS=$((WARNINGS + 1))
    CHECKS=$((CHECKS + 1))
    printf '[WARN] %s\n' "$*" >&2
}
fail() {
    ERRORS=$((ERRORS + 1))
    CHECKS=$((CHECKS + 1))
    printf '[FAIL] %s\n' "$*" >&2
}
die() {
    printf '[ERROR] %s\n' "$*" >&2
    exit 2
}
usage() {
    cat <<'USAGE'
MedOrbits Project Check Utility
Usage:
  ./CHECK.sh [options] [command]
Commands:
  all          Run all checks (default)
  files        Check required files and repository structure
  json         Validate package.json and JSON data/schema files
  node         Check Node.js runtime and package metadata
  git          Inspect Git status and conflict markers
  security     Check common security configuration files
  scripts      List package.json scripts
  help         Show help
Options:
  --root PATH          Project root directory
  --strict             Treat warnings as failures
  --check-ignored      Include ignored files in JSON file discovery
  --help               Show this help
Examples:
  ./CHECK.sh
  ./CHECK.sh all --strict
  ./CHECK.sh json
  ./CHECK.sh --root /path/to/MedOrbits git
Safety:
  This utility is intended to be read-only. It does not repair files,
  install dependencies, resolve conflicts, or remove generated files.
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
            --check-ignored)
                CHECK_IGNORED=1
                shift
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            all|files|json|node|git|security|scripts|help)
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
check_files() {
    log "Checking project structure..."
    local required_file
    local found_any=0
    for required_file in package.json; do
        if [[ -f "$PROJECT_ROOT/$required_file" ]]; then
            pass "Found $required_file"
        else
            fail "Missing $required_file"
        fi
    done
    local -a recommended_files=(
        ".gitignore"
        ".env.example"
        "README.md"
        "package-lock.json"
        "pnpm-lock.yaml"
        "yarn.lock"
        "bun.lock"
        "bun.lockb"
        "Dockerfile"
        "docker-compose.yml"
        "compose.yml"
        ".dockerignore"
    )
    for required_file in "${recommended_files[@]}"; do
        if [[ -f "$PROJECT_ROOT/$required_file" ]]; then
            pass "Found $required_file"
            found_any=1
        fi
    done
    if ((found_any == 0)); then
        warn "No recommended project support files were found."
    fi
    local -a candidate_dirs=(
        "api"
        "src"
        "routes"
        "controllers"
        "middleware"
        "middlewares"
        "tests"
        "test"
        "assets"
        "education"
    )
    local dir_found=0
    local dir
    for dir in "${candidate_dirs[@]}"; do
        if [[ -d "$PROJECT_ROOT/$dir" ]]; then
            dir_found=1
            break
        fi
    done
    if ((dir_found)); then
        pass "Found at least one common source/project directory"
    else
        warn "No common source directories found; this may be intentional."
    fi
    if [[ -f "$PROJECT_ROOT/.gitignore" ]]; then
        if grep -Eq '(^|/)\.env(\.\*|$)|node_modules' "$PROJECT_ROOT/.gitignore"; then
            pass ".gitignore includes environment-file or dependency exclusions"
        else
            warn ".gitignore may be missing environment-file or node_modules exclusions"
        fi
    else
        warn ".gitignore is missing"
    fi
}
check_node() {
    log "Checking Node.js project metadata..."
    if ! command -v node >/dev/null 2>&1; then
        warn "Node.js is not installed or not on PATH; skipping runtime checks."
        return 0
    fi
    local version major
    version="$(node --version)"
    major="${version#v}"
    major="${major%%.*}"
    if [[ "$major" =~ ^[0-9]+$ ]] && ((major >= 20)); then
        pass "Node.js runtime meets minimum version: $version"
    else
        fail "Node.js >=20 is required by this checker; found $version"
    fi
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        fail "Cannot validate package metadata: package.json is missing."
        return 0
    fi
    if node - "$PROJECT_ROOT/package.json" <<'NODE'
const fs = require("node:fs");
const path = process.argv[2];
try {
  const pkg = JSON.parse(fs.readFileSync(path, "utf8"));
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
    throw new Error("Expected a JSON object.");
  }
  if (typeof pkg.name !== "string" || !pkg.name.trim()) {
    throw new Error("Missing or invalid package name.");
  }
  if (pkg.scripts !== undefined &&
      (!pkg.scripts || typeof pkg.scripts !== "object" ||
       Array.isArray(pkg.scripts))) {
    throw new Error("scripts must be a JSON object.");
  }
  if (pkg.dependencies !== undefined &&
      (!pkg.dependencies || typeof pkg.dependencies !== "object" ||
       Array.isArray(pkg.dependencies))) {
    throw new Error("dependencies must be a JSON object.");
  }
  if (pkg.devDependencies !== undefined &&
      (!pkg.devDependencies || typeof pkg.devDependencies !== "object" ||
       Array.isArray(pkg.devDependencies))) {
    throw new Error("devDependencies must be a JSON object.");
  }
  console.log(`[PASS] Valid package.json: ${pkg.name}`);
} catch (error) {
  console.error(`[FAIL] Invalid package.json: ${error.message}`);
  process.exit(1);
}
NODE
    then
        pass "package.json metadata is valid"
    else
        fail "package.json validation failed"
    fi
    if command -v npm >/dev/null 2>&1; then
        log "npm version: $(npm --version)"
    else
        warn "npm is unavailable."
    fi
}
find_json_files() {
    if command -v git >/dev/null 2>&1 &&
       git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        if ((CHECK_IGNORED)); then
            git -C "$PROJECT_ROOT" ls-files --cached --others --exclude-standard --ignored \
                -z -- '*.json' ':(glob)**/*.json'
        else
            git -C "$PROJECT_ROOT" ls-files --cached --others --exclude-standard \
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
check_json() {
    log "Validating JSON files..."
    if ! command -v node >/dev/null 2>&1; then
        warn "Node.js unavailable; JSON syntax validation skipped."
        return 0
    fi
    local total=0
    local valid=0
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
            valid=$((valid + 1))
        else
            invalid=$((invalid + 1))
            fail "Invalid JSON: $file"
        fi
    done < <(find_json_files)
    if ((total == 0)); then
        warn "No JSON files found."
        return 0
    fi
    if ((invalid == 0)); then
        pass "Validated $valid JSON file(s)"
    else
        log "JSON results: $valid valid, $invalid invalid, $total total."
    fi
}
check_git() {
    log "Inspecting Git state..."
    if ! command -v git >/dev/null 2>&1; then
        warn "Git is not installed; Git checks skipped."
        return 0
    fi
    if ! git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        warn "Project root is not inside a Git working tree."
        return 0
    fi
    pass "Git working tree detected"
    local status_output
    status_output="$(git -C "$PROJECT_ROOT" status --short 2>/dev/null || true)"
    if [[ -z "$status_output" ]]; then
        pass "Git working tree has no reported changes"
    else
        warn "Git working tree has changes; review them before any repair operation."
        printf '%s\n' "$status_output" | sed -n '1,40p'
        if [[ "$(printf '%s\n' "$status_output" | wc -l | tr -d ' ')" -gt 40 ]]; then
            log "Status output truncated to the first 40 lines."
        fi
    fi
    local unmerged
    unmerged="$(git -C "$PROJECT_ROOT" diff --name-only --diff-filter=U 2>/dev/null || true)"
    if [[ -z "$unmerged" ]]; then
        pass "No unmerged Git index entries detected"
    else
        fail "Unmerged paths detected:"
        printf '%s\n' "$unmerged"
    fi
    if git -C "$PROJECT_ROOT" diff --check >/dev/null 2>&1 &&
       git -C "$PROJECT_ROOT" diff --cached --check >/dev/null 2>&1; then
        pass "No whitespace errors detected in Git diffs"
    else
        warn "Git diff whitespace checks reported issues."
    fi
    # Only report filenames with conflict markers. Do not alter files.
    local conflict_count=0
    local conflict_file
    local -a tracked_files=()
    while IFS= read -r -d '' conflict_file; do
        tracked_files+=("$conflict_file")
    done < <(git -C "$PROJECT_ROOT" ls-files -z --cached)
    for conflict_file in "${tracked_files[@]}"; do
        [[ -f "$PROJECT_ROOT/$conflict_file" ]] || continue
        if grep -IqE '^(<<<<<<< |=======|>>>>>>> )' "$PROJECT_ROOT/$conflict_file"; then
            conflict_count=$((conflict_count + 1))
            printf '[WARN] Conflict marker pattern found in: %s\n' "$conflict_file" >&2
        fi
    done
    if ((conflict_count == 0)); then
        pass "No common conflict-marker patterns found in tracked files"
    else
        warn "Potential conflict-marker patterns found in $conflict_count tracked file(s). Review manually."
    fi
}
check_security() {
    log "Checking basic repository security safeguards..."
    local path
    if [[ -f "$PROJECT_ROOT/.gitignore" ]]; then
        if grep -Eq '(^|/)\.env(\.\*|$)' "$PROJECT_ROOT/.gitignore"; then
            pass ".gitignore appears to exclude environment files"
        else
            warn ".gitignore may not exclude .env files"
        fi
        if grep -Eq '(^|/)node_modules(/|$)' "$PROJECT_ROOT/.gitignore"; then
            pass ".gitignore appears to exclude node_modules"
        else
            warn ".gitignore may not exclude node_modules"
        fi
    else
        fail ".gitignore is missing"
    fi
    if [[ -f "$PROJECT_ROOT/.env.example" ]]; then
        pass ".env.example exists"
        # Report only suspicious variable names, never values.
        if grep -Ein '(^|_)(PASSWORD|SECRET|TOKEN|PRIVATE_KEY|API_KEY)=' \
            "$PROJECT_ROOT/.env.example" >/dev/null 2>&1; then
            warn ".env.example contains sensitive-variable names; ensure values are placeholders."
        fi
    else
        warn ".env.example is missing; it may be intentional for this project."
    fi
    for path in \
        "$PROJECT_ROOT/.npmrc" \
        "$PROJECT_ROOT/.dockerignore" \
        "$PROJECT_ROOT/.github/workflows"
    do
        if [[ -e "$path" ]]; then
            pass "Found security/build support path: ${path#"$PROJECT_ROOT"/}"
        else
            warn "Missing optional support path: ${path#"$PROJECT_ROOT"/}"
        fi
    done
    if [[ -f "$PROJECT_ROOT/Dockerfile" ]]; then
        if grep -Eq '^[[:space:]]*USER[[:space:]]+[^[:space:]]+' "$PROJECT_ROOT/Dockerfile"; then
            pass "Dockerfile declares a USER"
        else
            warn "Dockerfile does not visibly declare a non-root USER."
        fi
    fi
    if [[ -f "$PROJECT_ROOT/package.json" ]] &&
       command -v node >/dev/null 2>&1; then
        local audit_script
        audit_script="$(node - "$PROJECT_ROOT/package.json" <<'NODE'
const fs = require("node:fs");
try {
  const pkg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  process.stdout.write(pkg.scripts && pkg.scripts.audit ? "yes" : "no");
} catch {
  process.stdout.write("no");
}
NODE
)"
        if [[ "$audit_script" == "yes" ]]; then
            pass "An audit script is configured in package.json"
        else
            warn "No package.json audit script found; this checker does not run network audits."
        fi
    fi
}
list_scripts() {
    if ! command -v node >/dev/null 2>&1; then
        warn "Node.js is unavailable; cannot read package.json scripts."
        return 0
    fi
    [[ -f "$PROJECT_ROOT/package.json" ]] || {
        fail "package.json is missing."
        return 0
    }
    node - "$PROJECT_ROOT/package.json" <<'NODE'
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const scripts = pkg.scripts || {};
const names = Object.keys(scripts).sort();
if (!names.length) {
  console.log("[CHECK] No package scripts are configured.");
} else {
  console.log("[CHECK] Configured package scripts:");
  for (const name of names) {
    // Do not print script bodies; they may contain credentials or private values.
    console.log(`  ${name}`);
  }
}
NODE
}
print_summary() {
    printf '\n[CHECK] Summary: %s check(s), %s passed, %s warning(s), %s failure(s).\n' \
        "$CHECKS" "$PASSED" "$WARNINGS" "$ERRORS"
    if ((ERRORS > 0)); then
        return 1
    fi
    if ((STRICT && WARNINGS > 0)); then
        printf '[CHECK] Strict mode: warnings cause a non-zero exit.\n' >&2
        return 1
    fi
    return 0
}
run_selected_check() {
    case "$COMMAND" in
        files) files_before=$ERRORS; check_files ;;
        node) check_node ;;
        json) check_json ;;
        git) check_git ;;
        security) check_security ;;
        scripts) list_scripts ;;
        all)
            check_files
            check_node
            check_json
            check_git
            check_security
            ;;
        *)
            die "Unknown command: $COMMAND"
            ;;
    esac
}
main() {
    parse_args "$@"
    canonicalize_root
    if [[ "$COMMAND" == "help" ]]; then
        usage
        return 0
    fi
    log "Project root: $PROJECT_ROOT"
    log "Selected command: $COMMAND"
    run_selected_check
    print_summary
}
main "$@"