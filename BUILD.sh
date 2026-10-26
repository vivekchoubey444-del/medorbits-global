#!/usr/bin/env bash
# ============================================================
# MedOrbits Build Utility
# File: /BUILD.sh
#
# Purpose:
#   Safely validate and build the MedOrbits project using its
#   existing package manager and project scripts.
#
# Commands:
#   check       Validate prerequisites and project configuration
#   build       Run the configured build script
#   test        Run the configured test script
#   lint        Run the configured lint script
#   all         Run checks, lint, tests, and build
#   clean       Preview generated build directories
#   help        Show usage
#
# Safety:
#   - Never runs git reset, git clean, or destructive Git commands.
#   - Never deletes files.
#   - Never installs dependencies automatically.
#   - Never runs deployment commands or database migrations.
#   - Requires an existing lockfile for reproducible-build checks.
#   - Does not print environment variable values or secrets.
#
# Requirements:
#   Bash 4+, Node.js >=20, npm (for Node.js projects)
#
# Usage:
#   ./BUILD.sh
#   ./BUILD.sh check
#   ./BUILD.sh build
#   ./BUILD.sh test
#   ./BUILD.sh lint
#   ./BUILD.sh all
#   ./BUILD.sh clean
#   ./BUILD.sh --root /path/to/project build
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
readonly SCRIPT_NAME="BUILD.sh"
readonly MIN_NODE_MAJOR=20
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
COMMAND="build"
STRICT=0
ALLOW_DIRTY=1
SKIP_DEPENDENCY_CHECK=0
ERRORS=0
WARNINGS=0
log() {
    printf '[BUILD] %s\n' "$*"
}
warn() {
    WARNINGS=$((WARNINGS + 1))
    printf '[WARN] %s\n' "$*" >&2
}
error() {
    ERRORS=$((ERRORS + 1))
    printf '[ERROR] %s\n' "$*" >&2
}
die() {
    error "$*"
    exit 1
}
usage() {
    cat <<'USAGE'
MedOrbits Build Utility
Usage:
  ./BUILD.sh [options] [command]
Commands:
  check       Check runtime, package files, lockfile, and dependencies
  build       Run the package.json build script (default)
  test        Run the package.json test script
  lint        Run the package.json lint script
  all         Run checks, lint, tests, and build in sequence
  clean       Preview common generated build directories; deletes nothing
  help        Show this help
Options:
  --root PATH                 Project root directory
  --strict                    Treat warnings as failures
  --require-lockfile          Require a recognized package-manager lockfile
  --skip-dependency-check     Do not verify node_modules
  --help                      Show this help
Examples:
  ./BUILD.sh check
  ./BUILD.sh build
  ./BUILD.sh all --strict
  ./BUILD.sh --root /path/to/MedOrbits check
Notes:
  - Dependencies are never installed automatically.
  - The configured npm scripts in package.json are authoritative.
  - The build may write or replace generated output files.
  - The clean command only lists likely generated directories.
  - Review package scripts before running them if the repository
    contains unfamiliar or untrusted code.
USAGE
}
require_command() {
    command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}
parse_arguments() {
    local positional=()
    while (($#)); do
        case "$1" in
            --root)
                (($# >= 2)) || die "--root requires a path."
                PROJECT_ROOT="$2"
                shift 2
                ;;
            --strict)
                STRICT=1
                shift
                ;;
            --require-lockfile)
                REQUIRE_LOCKFILE=1
                shift
                ;;
            --skip-dependency-check)
                SKIP_DEPENDENCY_CHECK=1
                shift
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            check|build|test|lint|all|clean|help)
                positional+=("$1")
                shift
                ;;
            *)
                die "Unknown option or command: $1"
                ;;
        esac
    done
    if ((${#positional[@]} > 1)); then
        die "Specify only one command."
    elif ((${#positional[@]} == 1)); then
        COMMAND="${positional[0]}"
    fi
}
REQUIRE_LOCKFILE=0
PACKAGE_MANAGER=""
PACKAGE_SCRIPT_RUNNER=()
canonicalize_project_root() {
    [[ -d "$PROJECT_ROOT" ]] || die "Project directory does not exist."
    PROJECT_ROOT="$(cd -- "$PROJECT_ROOT" && pwd -P)"
    [[ -f "$PROJECT_ROOT/package.json" ]] || die "package.json not found in project root: $PROJECT_ROOT"
}
check_node_runtime() {
    require_command node
    require_command npm
    local node_version
    local node_major
    node_version="$(node --version)"
    node_major="${node_version#v}"
    node_major="${node_major%%.*}"
    [[ "$node_major" =~ ^[0-9]+$ ]] || die "Could not parse Node.js version: $node_version"
    if ((node_major < MIN_NODE_MAJOR)); then
        die "Node.js $MIN_NODE_MAJOR or newer is required; found $node_version."
    fi
    log "Node.js runtime: $node_version"
    log "npm version: $(npm --version)"
}
check_package_json() {
    node --input-type=commonjs - "$PROJECT_ROOT/package.json" <<'NODE'
const fs = require("node:fs");
const path = process.argv[2];
try {
  const raw = fs.readFileSync(path, "utf8");
  const pkg = JSON.parse(raw);
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
    throw new Error("package.json must contain a JSON object.");
  }
  if (typeof pkg.name !== "string" || !pkg.name.trim()) {
    console.error("[ERROR] package.json is missing a valid name.");
    process.exit(1);
  }
  if (pkg.scripts !== undefined &&
      (!pkg.scripts || typeof pkg.scripts !== "object" ||
       Array.isArray(pkg.scripts))) {
    console.error("[ERROR] package.json scripts must be an object.");
    process.exit(1);
  }
  console.log(`[BUILD] Package metadata valid: ${pkg.name}`);
} catch (error) {
  console.error(`[ERROR] Invalid package.json: ${error.message}`);
  process.exit(1);
}
NODE
}
detect_package_manager() {
    local declared=""
    declared="$(node -e '
      try {
        const p = require(process.argv[1]);
        process.stdout.write(typeof p.packageManager === "string" ? p.packageManager : "");
      } catch {}
    ' "$PROJECT_ROOT/package.json")"
    if [[ -n "$declared" ]]; then
        case "$declared" in
            npm@*) PACKAGE_MANAGER="npm" ;;
            pnpm@*) PACKAGE_MANAGER="pnpm" ;;
            yarn@*) PACKAGE_MANAGER="yarn" ;;
            bun@*) PACKAGE_MANAGER="bun" ;;
            *)
                die "Unsupported packageManager declaration in package.json."
                ;;
        esac
    fi
    local npm_lock=0 pnpm_lock=0 yarn_lock=0 bun_lock=0
    [[ -f "$PROJECT_ROOT/package-lock.json" || -f "$PROJECT_ROOT/npm-shrinkwrap.json" ]] && npm_lock=1
    [[ -f "$PROJECT_ROOT/pnpm-lock.yaml" ]] && pnpm_lock=1
    [[ -f "$PROJECT_ROOT/yarn.lock" ]] && yarn_lock=1
    [[ -f "$PROJECT_ROOT/bun.lock" || -f "$PROJECT_ROOT/bun.lockb" ]] && bun_lock=1
    local lock_count=$((npm_lock + pnpm_lock + yarn_lock + bun_lock))
    if ((lock_count > 1)); then
        error "Multiple package-manager lockfiles found. Keep the intended manager explicit."
    fi
    if [[ -z "$PACKAGE_MANAGER" ]]; then
        if ((npm_lock)); then
            PACKAGE_MANAGER="npm"
        elif ((pnpm_lock)); then
            PACKAGE_MANAGER="pnpm"
        elif ((yarn_lock)); then
            PACKAGE_MANAGER="yarn"
        elif ((bun_lock)); then
            PACKAGE_MANAGER="bun"
        else
            PACKAGE_MANAGER="npm"
            if ((REQUIRE_LOCKFILE)); then
                error "No recognized package-manager lockfile found."
            else
                warn "No lockfile found; reproducible dependency resolution cannot be guaranteed."
            fi
        fi
    fi
    case "$PACKAGE_MANAGER" in
        npm)
            [[ "$npm_lock" -eq 1 ]] || {
                if ((REQUIRE_LOCKFILE)); then
                    error "npm is selected but no npm lockfile exists."
                else
                    warn "npm selected without a lockfile."
                fi
            }
            ;;
        pnpm)
            [[ "$pnpm_lock" -eq 1 ]] || error "pnpm selected but pnpm-lock.yaml is missing."
            ;;
        yarn)
            [[ "$yarn_lock" -eq 1 ]] || error "Yarn selected but yarn.lock is missing."
            ;;
        bun)
            [[ "$bun_lock" -eq 1 ]] || error "Bun selected but bun.lock is missing."
            ;;
    esac
    log "Detected package manager: $PACKAGE_MANAGER"
}
check_package_manager_available() {
    case "$PACKAGE_MANAGER" in
        npm) require_command npm ;;
        pnpm) require_command pnpm ;;
        yarn) require_command yarn ;;
        bun) require_command bun ;;
        *) die "Unsupported package manager." ;;
    esac
}
check_dependencies() {
    ((SKIP_DEPENDENCY_CHECK)) && {
        log "Dependency directory check skipped."
        return 0
    }
    case "$PACKAGE_MANAGER" in
        npm)
            if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
                error "node_modules is missing. Install dependencies with the project's documented lockfile workflow."
            else
                log "node_modules directory found."
            fi
            ;;
        pnpm)
            if [[ ! -d "$PROJECT_ROOT/node_modules" ]]; then
                error "node_modules is missing. Install dependencies using the project's pnpm lockfile."
            else
                log "node_modules directory found."
            fi
            ;;
        yarn)
            if [[ ! -d "$PROJECT_ROOT/node_modules" && ! -d "$PROJECT_ROOT/.yarn" ]]; then
                error "Yarn dependencies do not appear to be installed."
            else
                log "Yarn dependency location found."
            fi
            ;;
        bun)
            if [[ ! -d "$PROJECT_ROOT/node_modules" && ! -d "$PROJECT_ROOT/.bun" ]]; then
                warn "No common Bun dependency directory found; verify the project's setup."
            else
                log "Bun dependency location found."
            fi
            ;;
    esac
}
has_script() {
    local script_name="$1"
    node - "$PROJECT_ROOT/package.json" "$script_name" <<'NODE'
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const name = process.argv[3];
process.exit(pkg.scripts && typeof pkg.scripts[name] === "string" ? 0 : 1);
NODE
}
run_package_script() {
    local script_name="$1"
    local required="${2:-0}"
    if ! has_script "$script_name"; then
        if ((required)); then
            error "Required package.json script is missing: $script_name"
        else
            warn "No '$script_name' script configured; skipping."
        fi
        return 0
    fi
    check_package_manager_available
    log "Running package script: $script_name"
    case "$PACKAGE_MANAGER" in
        npm)
            npm --prefix "$PROJECT_ROOT" run "$script_name"
            ;;
        pnpm)
            pnpm --dir "$PROJECT_ROOT" run "$script_name"
            ;;
        yarn)
            yarn --cwd "$PROJECT_ROOT" run "$script_name"
            ;;
        bun)
            (
                cd "$PROJECT_ROOT"
                bun run "$script_name"
            )
            ;;
    esac
    log "Completed package script: $script_name"
}
run_checks() {
    canonicalize_project_root
    check_node_runtime
    check_package_json
    detect_package_manager
    check_dependencies
    if ((ERRORS > 0)); then
        return 1
    fi
    log "Project checks passed."
}
show_generated_directories() {
    canonicalize_project_root
    log "This command is read-only. No directories will be deleted."
    local relative
    for relative in \
        dist build coverage .next .nuxt .output \
        playwright-report test-results
    do
        if [[ -d "$PROJECT_ROOT/$relative" ]]; then
            printf '  Found: %s\n' "$PROJECT_ROOT/$relative"
        fi
    done
    log "Review these directories manually before any cleanup."
}
print_summary() {
    printf '\n[BUILD] Summary: %s error(s), %s warning(s).\n' "$ERRORS" "$WARNINGS"
    if ((ERRORS > 0)); then
        return 1
    fi
    if ((STRICT && WARNINGS > 0)); then
        error "Strict mode failed because warnings were reported."
        return 1
    fi
    return 0
}
main() {
    parse_arguments "$@"
    case "$COMMAND" in
        help)
            usage
            return 0
            ;;
        clean)
            show_generated_directories
            return 0
            ;;
        check)
            run_checks || true
            print_summary
            ;;
        build|test|lint)
            run_checks || true
            if ((ERRORS == 0)); then
                run_package_script "$COMMAND" 1 || error "'$COMMAND' script failed."
            fi
            print_summary
            ;;
        all)
            run_checks || true
            if ((ERRORS == 0)); then
                run_package_script lint 0 || error "'lint' script failed."
            fi
            if ((ERRORS == 0)); then
                run_package_script test 0 || error "'test' script failed."
            fi
            if ((ERRORS == 0)); then
                run_package_script build 1 || error "'build' script failed."
            fi
            print_summary
            ;;
        *)
            die "Unknown command: $COMMAND"
            ;;
    esac
}
main "$@"