
#!/usr/bin/env bash
# ==============================================================================
# MEDORBITS -- INDEPENDENT REPOSITORY VERIFICATION
# File: tools/VERIFY.sh
# Version: 1.0.0
#
# Purpose:
#   Independently verify repository structure, configuration, scripts,
#   dependencies, source syntax, and common repository integrity issues.
#
# Requirements:
#   Bash >= 4
#   Python >= 3.10 recommended
#   Node.js >= 20 recommended
#
# Optional:
#   PyYAML for YAML validation
#   ShellCheck for additional shell analysis
#
# Safety:
#   - Read-only verification.
#   - Does not install dependencies.
#   - Does not modify source files.
#   - Does not automatically repair files.
#   - Does not delete files or directories.
#   - Does not commit, push, or deploy.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"

STRICT=false
JSON_OUTPUT=false
CHECK_GIT=true
CHECK_REFERENCES=true

PASSED=0
FAILED=0
WARNINGS=0
SKIPPED=0

declare -a RESULTS=()

# ------------------------------------------------------------------------------
# OUTPUT
# ------------------------------------------------------------------------------

info() {
    printf '[INFO] %s\n' "$*"
}

pass() {
    printf '[PASS] %s\n' "$*"
}

fail() {
    printf '[FAIL] %s\n' "$*" >&2
}

warn() {
    printf '[WARN] %s\n' "$*" >&2
}

skip() {
    printf '[SKIP] %s\n' "$*"
}

record() {
    local status="$1"
    local message="$2"

    RESULTS+=("${status}|${message}")

    case "$status" in
        PASS) PASSED=$((PASSED + 1)) ;;
        FAIL) FAILED=$((FAILED + 1)) ;;
        WARN) WARNINGS=$((WARNINGS + 1)) ;;
        SKIP) SKIPPED=$((SKIPPED + 1)) ;;
    esac
}

report_pass() {
    pass "$1"
    record PASS "$1"
}

report_fail() {
    fail "$1"
    record FAIL "$1"
}

report_warn() {
    warn "$1"
    record WARN "$1"
}

report_skip() {
    skip "$1"
    record SKIP "$1"
}

has() {
    command -v "$1" >/dev/null 2>&1
}

# ------------------------------------------------------------------------------
# HELP
# ------------------------------------------------------------------------------

usage() {
    cat <<'HELP'
MedOrbits Independent Repository Verification v1.0.0

Usage:
  bash tools/VERIFY.sh [OPTIONS]

Options:
  --strict          Treat warnings as verification failures.
  --json            Print machine-readable JSON results.
  --no-git          Skip Git repository checks.
  --no-references   Skip HTML local-reference checks.
  --help, -h        Show help.

Examples:
  bash tools/VERIFY.sh
  bash tools/VERIFY.sh --strict
  bash tools/VERIFY.sh --json
  bash tools/VERIFY.sh --no-git
  bash tools/VERIFY.sh --strict --no-references

Safety:
  This script is read-only.
  It does not install packages or modify repository files.
HELP
}

# ------------------------------------------------------------------------------
# ARGUMENTS
# ------------------------------------------------------------------------------

parse_arguments() {
    while (($#)); do
        case "$1" in
            --strict)
                STRICT=true
                ;;
            --json)
                JSON_OUTPUT=true
                ;;
            --no-git)
                CHECK_GIT=false
                ;;
            --no-references)
                CHECK_REFERENCES=false
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                printf 'Unknown option: %s\n' "$1" >&2
                usage >&2
                exit 2
                ;;
        esac
        shift
    done
}

# ------------------------------------------------------------------------------
# SAFE PATH CHECKS
# ------------------------------------------------------------------------------

is_inside_root() {
    local path="$1"
    local resolved

    resolved="$(realpath -m -- "$path" 2>/dev/null)" || return 1

    [[ "$resolved" == "$ROOT_DIR" ||
       "$resolved" == "$ROOT_DIR/"* ]]
}

check_root() {
    [[ -d "$ROOT_DIR" ]] || {
        printf '[FAIL] Repository root does not exist.\n' >&2
        exit 2
    }

    [[ -d "$SCRIPT_DIR" ]] || {
        printf '[FAIL] Tools directory does not exist.\n' >&2
        exit 2
    }

    [[ -f "$SCRIPT_DIR/VERIFY.sh" ]] || {
        printf '[FAIL] VERIFY.sh cannot be accessed.\n' >&2
        exit 2
    }

    cd "$ROOT_DIR" || {
        printf '[FAIL] Cannot enter repository root.\n' >&2
        exit 2
    }
}

# ------------------------------------------------------------------------------
# STRUCTURE VERIFICATION
# ------------------------------------------------------------------------------

check_structure() {
    info "Checking repository structure."

    local required=(
        "tools"
        ".github"
    )

    local optional=(
        "assets"
        "pages"
        "config"
        "data"
        "docs"
        "tests"
        "scripts"
        "infrastructure"
    )

    local path

    for path in "${required[@]}"; do
        if [[ -d "$ROOT_DIR/$path" ]]; then
            report_pass "Required directory exists: $path"
        else
            report_fail "Required directory missing: $path"
        fi
    done

    for path in "${optional[@]}"; do
        if [[ -d "$ROOT_DIR/$path" ]]; then
            report_pass "Optional directory exists: $path"
        else
            report_warn "Optional directory not found: $path"
        fi
    done

    local required_files=(
        "package.json"
        "README.md"
    )

    for path in "${required_files[@]}"; do
        if [[ -f "$ROOT_DIR/$path" && ! -L "$ROOT_DIR/$path" ]]; then
            report_pass "Required file exists: $path"
        else
            report_fail "Required regular file missing: $path"
        fi
    done

    local recommended_files=(
        "package-lock.json"
        ".gitignore"
        ".env.example"
        "LICENSE"
        "tools/INSTALL.sh"
        "tools/RUN.sh"
        "tools/TEST.sh"
    )

    for path in "${recommended_files[@]}"; do
        if [[ -f "$ROOT_DIR/$path" && ! -L "$ROOT_DIR/$path" ]]; then
            report_pass "Recommended file exists: $path"
        else
            report_warn "Recommended file missing: $path"
        fi
    done
}

# ------------------------------------------------------------------------------
# ENVIRONMENT
# ------------------------------------------------------------------------------

check_environment() {
    info "Checking available development tools."

    if has bash; then
        report_pass "Bash is available: ${BASH_VERSION}"
    else
        report_fail "Bash is unavailable."
    fi

    if has python3; then
        local python_version
        python_version="$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:3])))')"

        local python_major python_minor
        IFS=. read -r python_major python_minor _ <<< "$python_version"

        if (( python_major > 3 || (python_major == 3 && python_minor >= 10) )); then
            report_pass "Python version: ${python_version}"
        else
            report_warn "Python ${python_version}; Python 3.10+ is recommended."
        fi
    else
        report_fail "Python 3 is unavailable."
    fi

    if has node; then
        local node_version
        node_version="$(node --version | sed 's/^v//')"

        local node_major
        node_major="${node_version%%.*}"

        if [[ "$node_major" =~ ^[0-9]+$ ]] && (( node_major >= 20 )); then
            report_pass "Node.js version: ${node_version}"
        else
            report_warn "Node.js ${node_version}; Node.js 20+ is recommended."
        fi
    else
        report_warn "Node.js is unavailable."
    fi

    if has npm; then
        report_pass "npm is available: $(npm --version)"
    else
        report_warn "npm is unavailable."
    fi

    if has shellcheck; then
        report_pass "ShellCheck is available."
    else
        report_skip "ShellCheck is not installed."
    fi
}

# ------------------------------------------------------------------------------
# JSON AND CONFIGURATION
# ------------------------------------------------------------------------------

check_json_files() {
    info "Validating JSON files."

    has python3 || {
        report_skip "JSON validation requires Python 3."
        return 0
    }

    python3 - "$ROOT_DIR" <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])

excluded = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    "repository-reports",
}

files = [
    path for path in root.rglob("*.json")
    if not any(part in excluded for part in path.relative_to(root).parts)
]

errors = []

for path in files:
    try:
        with path.open("r", encoding="utf-8-sig") as stream:
            json.load(stream)
        print(f"[PASS] {path.relative_to(root)}")
    except (json.JSONDecodeError, UnicodeError, OSError) as exc:
        errors.append((path, exc))
        print(f"[FAIL] {path.relative_to(root)}: {exc}", file=sys.stderr)

print(f"JSON files checked: {len(files)}")
print(f"JSON errors: {len(errors)}")

sys.exit(1 if errors else 0)
PY

    local status=$?

    if (( status == 0 )); then
        report_pass "JSON validation completed."
    else
        report_fail "One or more JSON files are invalid."
    fi
}

check_package_manifest() {
    info "Checking package.json and package-lock.json."

    if [[ ! -f "$ROOT_DIR/package.json" ]]; then
        report_fail "package.json is missing."
        return 0
    fi

    if ! has node; then
        report_skip "Package manifest checks require Node.js."
        return 0
    fi

    if node --input-type=module - "$ROOT_DIR" <<'NODE'
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
const manifestPath = path.join(root, "package.json");
const lockPath = path.join(root, "package-lock.json");

try {
    const pkg = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
        throw new Error("package.json must contain a JSON object.");
    }

    if (pkg.name && typeof pkg.name !== "string") {
        throw new Error("package.name must be a string.");
    }

    if (pkg.scripts && (
        typeof pkg.scripts !== "object" ||
        Array.isArray(pkg.scripts)
    )) {
        throw new Error("package.scripts must be an object.");
    }

    if (fs.existsSync(lockPath)) {
        const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));

        if (lock.lockfileVersion === undefined) {
            throw new Error("package-lock.json has no lockfileVersion.");
        }

        if (
            lock.name &&
            pkg.name &&
            lock.name !== pkg.name
        ) {
            throw new Error(
                `Package name mismatch: package.json=${pkg.name}, package-lock.json=${lock.name}`
            );
        }
    }

    console.log("Package name:", pkg.name || "unnamed");
    console.log("Package version:", pkg.version || "unspecified");
    console.log("Scripts:", Object.keys(pkg.scripts || {}).length);
    console.log("Package lock:", fs.existsSync(lockPath) ? "present" : "missing");
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
NODE
    then
        report_pass "Package manifests are structurally valid."
    else
        report_fail "Package manifest validation failed."
    fi
}

check_yaml_files() {
    info "Checking YAML files."

    if ! has python3; then
        report_skip "YAML validation requires Python 3."
        return 0
    fi

    if ! python3 -c 'import yaml' >/dev/null 2>&1; then
        report_skip "PyYAML is not installed; YAML syntax was not checked."
        return 0
    fi

    if python3 - "$ROOT_DIR" <<'PY'
import pathlib
import sys
import yaml

root = pathlib.Path(sys.argv[1])
excluded = {
    ".git", "node_modules", ".venv", "venv",
    "__pycache__", "repository-reports",
}

files = [
    path for pattern in ("*.yml", "*.yaml")
    for path in root.rglob(pattern)
    if not any(part in excluded for part in path.relative_to(root).parts)
]

errors = []

for path in files:
    try:
        with path.open("r", encoding="utf-8-sig") as stream:
            list(yaml.safe_load_all(stream))
        print(f"[PASS] {path.relative_to(root)}")
    except Exception as exc:
        errors.append((path, exc))
        print(f"[FAIL] {path.relative_to(root)}: {exc}", file=sys.stderr)

print(f"YAML files checked: {len(files)}")
print(f"YAML errors: {len(errors)}")

sys.exit(1 if errors else 0)
PY
    then
        report_pass "YAML validation completed."
    else
        report_fail "One or more YAML files are invalid."
    fi
}

check_toml_files() {
    info "Checking TOML files."

    if ! has python3; then
        report_skip "TOML validation requires Python 3."
        return 0
    fi

    if python3 - "$ROOT_DIR" <<'PY'
import pathlib
import sys

try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib
    except ImportError:
        print("Neither tomllib nor tomli is available.")
        sys.exit(2)

root = pathlib.Path(sys.argv[1])
excluded = {
    ".git", "node_modules", ".venv", "venv",
    "__pycache__", "repository-reports",
}

files = [
    path for path in root.rglob("*.toml")
    if not any(part in excluded for part in path.relative_to(root).parts)
]

errors = []

for path in files:
    try:
        with path.open("rb") as stream:
            tomllib.load(stream)
        print(f"[PASS] {path.relative_to(root)}")
    except Exception as exc:
        errors.append((path, exc))
        print(f"[FAIL] {path.relative_to(root)}: {exc}", file=sys.stderr)

print(f"TOML files checked: {len(files)}")
print(f"TOML errors: {len(errors)}")

sys.exit(1 if errors else 0)
PY
    then
        report_pass "TOML validation completed."
    else
        local status=$?
        if (( status == 2 )); then
            report_skip "Install tomli for Python 3.10 TOML validation."
        else
            report_fail "One or more TOML files are invalid."
        fi
    fi
}

# ------------------------------------------------------------------------------
# PYTHON SYNTAX
# ------------------------------------------------------------------------------

check_python_files() {
    info "Checking Python syntax."

    if ! has python3; then
        report_skip "Python syntax validation requires Python 3."
        return 0
    fi

    if python3 - "$ROOT_DIR" <<'PY'
import ast
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
excluded = {
    ".git", "node_modules", ".venv", "venv",
    "__pycache__", ".pytest_cache", ".mypy_cache",
    ".ruff_cache", "repository-reports",
}

files = [
    path for path in root.rglob("*.py")
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
        print(f"[FAIL] {path.relative_to(root)}: {exc}", file=sys.stderr)

print(f"Python files checked: {len(files)}")
print(f"Python syntax errors: {len(errors)}")

sys.exit(1 if errors else 0)
PY
    then
        report_pass "Python syntax validation completed."
    else
        report_fail "One or more Python files have syntax errors."
    fi
}

# ------------------------------------------------------------------------------
# JAVASCRIPT SYNTAX
# ------------------------------------------------------------------------------

check_javascript_files() {
    info "Checking JavaScript syntax."

    if ! has node; then
        report_skip "JavaScript validation requires Node.js."
        return 0
    fi

    local found=0
    local errors=0
    local file

    while IFS= read -r -d '' file; do
        found=1

        if ! node --check "$file" >/dev/null 2>&1; then
            errors=$((errors + 1))
            printf '[FAIL] JavaScript syntax: %s\n' "${file#"$ROOT_DIR"/}" >&2
        else
            printf '[PASS] %s\n' "${file#"$ROOT_DIR"/}"
        fi
    done < <(
        find "$ROOT_DIR" \
            -type d \( \
                -name .git -o \
                -name node_modules -o \
                -name .venv -o \
                -name venv -o \
                -name __pycache__ -o \
                -name repository-reports \
            \) -prune -o \
            -type f \( \
                -name '*.js' -o \
                -name '*.cjs' -o \
                -name '*.mjs' \
            \) -print0
    )

    if (( found == 0 )); then
        report_skip "No JavaScript files found."
    elif (( errors == 0 )); then
        report_pass "JavaScript syntax validation completed."
    else
        report_fail "JavaScript syntax errors: ${errors}"
    fi
}

# ------------------------------------------------------------------------------
# SHELL SYNTAX
# ------------------------------------------------------------------------------

check_shell_files() {
    info "Checking shell script syntax."

    if ! has bash; then
        report_skip "Bash is unavailable."
        return 0
    fi

    local found=0
    local errors=0
    local file

    while IFS= read -r -d '' file; do
        found=1

        if ! bash -n "$file"; then
            errors=$((errors + 1))
            printf '[FAIL] Shell syntax: %s\n' "${file#"$ROOT_DIR"/}" >&2
        else
            printf '[PASS] %s\n' "${file#"$ROOT_DIR"/}"
        fi
    done < <(
        find "$ROOT_DIR" \
            -type d \( \
                -name .git -o \
                -name node_modules -o \
                -name .venv -o \
                -name venv -o \
                -name repository-reports \
            \) -prune -o \
            -type f \( \
                -name '*.sh' -o \
                -name '*.bash' \
            \) -print0
    )

    if (( found == 0 )); then
        report_skip "No shell scripts found."
    elif (( errors == 0 )); then
        report_pass "Shell syntax validation completed."
    else
        report_fail "Shell syntax errors: ${errors}"
    fi

    if has shellcheck; then
        local shellcheck_errors=0

        while IFS= read -r -d '' file; do
            if ! shellcheck -x "$file"; then
                shellcheck_errors=$((shellcheck_errors + 1))
            fi
        done < <(
            find "$ROOT_DIR" \
                -type d \( \
                    -name .git -o \
                    -name node_modules -o \
                    -name .venv -o \
                    -name venv -o \
                    -name repository-reports \
                \) -prune -o \
                -type f \( -name '*.sh' -o -name '*.bash' \) -print0
        )

        if (( shellcheck_errors == 0 )); then
            report_pass "ShellCheck completed without reported issues."
        else
            report_warn "ShellCheck reported issues in ${shellcheck_errors} files."
        fi
    fi
}

# ------------------------------------------------------------------------------
# HTML LOCAL REFERENCES
# ------------------------------------------------------------------------------

check_html_references() {
    if [[ "$CHECK_REFERENCES" != true ]]; then
        report_skip "HTML reference checks disabled."
        return 0
    fi

    info "Checking local HTML references."

    if ! has python3; then
        report_skip "HTML reference checks require Python 3."
        return 0
    fi

    if python3 - "$ROOT_DIR" <<'PY'
import html.parser
import pathlib
import sys
import urllib.parse

root = pathlib.Path(sys.argv[1])

excluded = {
    ".git", "node_modules", ".venv", "venv",
    "__pycache__", "repository-reports",
}

class ReferenceParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.references = []
        self.base_href = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)

        if tag == "base" and attrs.get("href"):
            self.base_href = attrs["href"]

        for attribute in ("href", "src", "poster"):
            value = attrs.get(attribute)

            if value:
                self.references.append(value)

        srcset = attrs.get("srcset")

        if srcset:
            for item in srcset.split(","):
                candidate = item.strip().split()

                if candidate:
                    self.references.append(candidate[0])

errors = []

html_files = [
    path for path in root.rglob("*.html")
    if not any(part in excluded for part in path.relative_to(root).parts)
]

for html_file in html_files:
    parser = ReferenceParser()

    try:
        parser.feed(html_file.read_text(encoding="utf-8-sig"))
        parser.close()
    except (OSError, UnicodeError) as exc:
        errors.append((html_file, str(exc)))
        continue

    for reference in parser.references:
        reference = reference.strip()

        if not reference:
            continue

        parsed = urllib.parse.urlsplit(reference)

        if parsed.scheme or parsed.netloc:
            continue

        if reference.startswith(("#", "data:", "mailto:", "tel:", "javascript:")):
            continue

        decoded_path = urllib.parse.unquote(parsed.path)

        if not decoded_path:
            continue

        if parser.base_href:
            base = urllib.parse.urlsplit(parser.base_href)

            if base.scheme or base.netloc:
                continue

            base_path = urllib.parse.unquote(base.path)

            if base_path:
                target = (html_file.parent / base_path / decoded_path).resolve()
            else:
                target = (html_file.parent / decoded_path).resolve()
        else:
            target = (html_file.parent / decoded_path).resolve()

        try:
            target.relative_to(root)
        except ValueError:
            errors.append((html_file, f"Reference escapes repository: {reference}"))
            continue

        if not target.exists():
            errors.append((html_file, f"Missing local reference: {reference}"))

print(f"HTML files checked: {len(html_files)}")

for path, message in errors:
    print(
        f"[FAIL] {path.relative_to(root)}: {message}",
        file=sys.stderr
    )

print(f"Reference errors: {len(errors)}")

sys.exit(1 if errors else 0)
PY
    then
        report_pass "HTML local-reference checks completed."
    else
        report_fail "HTML local-reference checks found problems."
    fi
}

# ------------------------------------------------------------------------------
# GIT VERIFICATION
# ------------------------------------------------------------------------------

check_git() {
    if [[ "$CHECK_GIT" != true ]]; then
        report_skip "Git checks disabled."
        return 0
    fi

    info "Checking Git repository."

    if ! has git; then
        report_skip "Git is unavailable."
        return 0
    fi

    if ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        report_warn "Directory is not a Git repository."
        return 0
    fi

    report_pass "Git repository detected."

    local branch
    branch="$(git -C "$ROOT_DIR" branch --show-current 2>/dev/null || true)"

    if [[ -n "$branch" ]]; then
        report_pass "Current branch: ${branch}"
    else
        report_warn "Git is in detached HEAD state."
    fi

    if git -C "$ROOT_DIR" config --local --get user.name >/dev/null 2>&1; then
        report_pass "Local Git author name is configured."
    else
        report_warn "Local Git author name is not configured."
    fi

    if git -C "$ROOT_DIR" config --local --get user.email >/dev/null 2>&1; then
        report_pass "Local Git author email is configured."
    else
        report_warn "Local Git author email is not configured."
    fi

    if git -C "$ROOT_DIR" remote get-url origin >/dev/null 2>&1; then
        report_pass "Origin remote is configured (URL hidden)."
    else
        report_warn "No origin remote is configured."
    fi

    if git -C "$ROOT_DIR" diff --quiet &&
       git -C "$ROOT_DIR" diff --cached --quiet; then
        report_pass "Tracked Git working tree is clean."
    else
        report_warn "Tracked Git working tree contains changes."
    fi

    if [[ -n "$(git -C "$ROOT_DIR" ls-files --others --exclude-standard)" ]]; then
        report_warn "Untracked files are present."
    else
        report_pass "No untracked files detected."
    fi
}

# ------------------------------------------------------------------------------
# SECRET AND ENVIRONMENT FILE CHECKS
# ------------------------------------------------------------------------------

check_environment_files() {
    info "Checking environment-file safety."

    local env_file

    for env_file in ".env" ".env.production" ".env.local"; do
        if [[ -L "$ROOT_DIR/$env_file" ]]; then
            report_fail "Environment file is a symbolic link: $env_file"
        elif [[ -f "$ROOT_DIR/$env_file" ]]; then
            report_warn "Environment file exists: $env_file (contents not inspected)."
        fi
    done

    if [[ -f "$ROOT_DIR/.env.example" ]]; then
        report_pass ".env.example exists."
    else
        report_warn ".env.example is missing."
    fi

    if [[ -f "$ROOT_DIR/.gitignore" ]]; then
        if grep -Eq '(^|/)\.env([./*]|$)' "$ROOT_DIR/.gitignore"; then
            report_pass ".gitignore contains an environment-file ignore rule."
        else
            report_warn ".gitignore may not exclude environment files."
        fi
    else
        report_warn ".gitignore is missing."
    fi
}

# ------------------------------------------------------------------------------
# FINAL REPORT
# ------------------------------------------------------------------------------

json_escape() {
    python3 -c '
import json, sys
print(json.dumps(sys.stdin.read()))
'
}

show_report() {
    local effective_failures="$FAILED"

    if [[ "$STRICT" == true ]]; then
        effective_failures=$((effective_failures + WARNINGS))
    fi

    if [[ "$JSON_OUTPUT" == true ]]; then
        if ! has python3; then
            printf '[FAIL] --json requires Python 3.\n' >&2
            return 2
        fi

        python3 - "$PASSED" "$FAILED" "$WARNINGS" "$SKIPPED" "$STRICT" "${RESULTS[@]}" <<'PY'
import json
import sys

passed, failed, warnings, skipped = map(int, sys.argv[1:5])
strict = sys.argv[5] == "true"
results = []

for item in sys.argv[6:]:
    status, separator, message = item.partition("|")
    results.append({"status": status, "message": message})

effective_failures = failed + (warnings if strict else 0)

print(json.dumps({
    "project": "MedOrbits",
    "verification_version": "1.0.0",
    "read_only": True,
    "strict": strict,
    "summary": {
        "passed": passed,
        "failed": failed,
        "warnings": warnings,
        "skipped": skipped,
        "effective_failures": effective_failures
    },
    "results": results,
    "success": effective_failures == 0
}, indent=2))
PY
    else
        printf '\n'
        printf '%s\n' "============================================================"
        printf '%s\n' "MEDORBITS REPOSITORY VERIFICATION REPORT"
        printf '%s\n' "============================================================"

        printf 'Version:  %s\n' "$VERSION"
        printf 'Passed:   %s\n' "$PASSED"
        printf 'Failed:   %s\n' "$FAILED"
        printf 'Warnings: %s\n' "$WARNINGS"
        printf 'Skipped:  %s\n' "$SKIPPED"
        printf 'Strict:   %s\n' "$STRICT"

        printf '\nDetailed results:\n'

        local item
        for item in "${RESULTS[@]}"; do
            printf '  %s\n' "$item"
        done

        printf '%s\n' "============================================================"
    fi

    if (( effective_failures > 0 )); then
        printf '[FAIL] Repository verification did not pass.\n' >&2
        return 1
    fi

    printf '[PASS] Repository verification completed successfully.\n'
    return 0
}

# ------------------------------------------------------------------------------
# MAIN
# ------------------------------------------------------------------------------

main() {
    parse_arguments "$@"
    check_root

    info "MedOrbits Repository Verification v${VERSION}"
    info "Repository: ${ROOT_DIR}"
    info "Mode: read-only"

    check_environment
    check_structure
    check_package_manifest
    check_json_files
    check_yaml_files
    check_toml_files
    check_python_files
    check_javascript_files
    check_shell_files
    check_html_references
    check_environment_files
    check_git

    show_report
}

main "$@"
