
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- Repository Test Runner
#
# File: TEST.sh
# Version: 1.0.0
#
# Usage:
#   bash TEST.sh
#   bash TEST.sh --check
#   bash TEST.sh --dry-run
#   bash TEST.sh --python
#   bash TEST.sh --json
#   bash TEST.sh --javascript
#   bash TEST.sh --all
#
# Optional:
#   TEST_REPORT_DIR=storage/test-reports bash TEST.sh --all
#
# Safety:
#   - Does not install dependencies.
#   - Does not commit, push, deploy, or delete source files.
#   - Does not execute arbitrary discovered shell scripts.
#   - Missing tools are reported instead of silently ignored.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_DIR="$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P
)"
readonly REPO_ROOT="$(
    cd -- "$SCRIPT_DIR" && pwd -P
)"

MODE="default"
REPORT_DIR="${TEST_REPORT_DIR:-storage/test-reports}"
RUN_PYTHON=0
RUN_JSON=0
RUN_JS=0
RUN_NPM=0
RUN_EXISTING=0
DRY_RUN=0

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
RESULTS=()

log() {
    printf '[MedOrbits Test] %s\n' "$*"
}

warn() {
    printf '[WARN] %s\n' "$*" >&2
}

die() {
    printf '[ERROR] %s\n' "$*" >&2
    exit 2
}

usage() {
    cat <<'USAGE'
MedOrbits Repository Test Runner

Usage:
  bash TEST.sh [options]

Options:
  --check        Check repository and installed tools.
  --dry-run      Preview the selected checks.
  --python       Compile-check Python files.
  --json         Validate JSON files.
  --javascript   Syntax-check JavaScript files with Node.js.
  --npm          Run npm test if a test script exists.
  --existing     Run existing local validation scripts explicitly.
  --all          Enable all available checks.
  --help         Display this help.

With no options, runs available basic checks.

Environment:
  TEST_REPORT_DIR   Repository-relative report directory.

The runner does not install missing dependencies. Review failures before
changing source files.
USAGE
}

record() {
    local status="$1"
    local check="$2"
    local detail="$3"

    RESULTS+=("$status|$check|$detail")

    case "$status" in
        PASS)
            ((PASS_COUNT += 1))
            log "PASS: $check -- $detail"
            ;;
        FAIL)
            ((FAIL_COUNT += 1))
            warn "FAIL: $check -- $detail"
            ;;
        SKIP)
            ((SKIP_COUNT += 1))
            log "SKIP: $check -- $detail"
            ;;
    esac
}

require_command() {
    command -v "$1" >/dev/null 2>&1
}

safe_repo_path() {
    python3 - "$REPO_ROOT" "$1" <<'PY'
import os
import sys

root = os.path.realpath(sys.argv[1])
value = sys.argv[2]
path = value if os.path.isabs(value) else os.path.join(root, value)
path = os.path.abspath(path)

try:
    if os.path.commonpath((root, path)) != root:
        raise ValueError("path is outside repository")
except ValueError as exc:
    raise SystemExit(str(exc))

current = root

for part in os.path.relpath(path, root).split(os.sep):
    if part == ".":
        continue

    current = os.path.join(current, part)

    if os.path.islink(current):
        raise SystemExit("symbolic links are not allowed: " + current)

print(path)
PY
}

check_repo() {
    if ! require_command git; then
        record FAIL "git" "Git is not installed."
        return
    fi

    if git -C "$REPO_ROOT" rev-parse --is-inside-work-tree \
        >/dev/null 2>&1; then
        record PASS "repository" "Git working tree detected."
    else
        record FAIL "repository" "Not inside a Git repository."
    fi
}

check_tools() {
    local tool

    for tool in python3 node npm; do
        if require_command "$tool"; then
            record PASS "tool:$tool" "$(command -v "$tool")"
        else
            record SKIP "tool:$tool" "Not installed; dependent checks may be skipped."
        fi
    done
}

python_checks() {
    if ! require_command python3; then
        record SKIP "python-compile" "Python 3 is unavailable."
        return
    fi

    local output
    local status=0

    output="$(
        python3 - "$REPO_ROOT" <<'PY'
import ast
import os
import sys

root = os.path.realpath(sys.argv[1])
excluded = {
    ".git", ".venv", "venv", "node_modules", "__pycache__",
    "dist", "build", "coverage", "vendor",
}
files = []
errors = []

for directory, dirs, names in os.walk(root, followlinks=False):
    dirs[:] = [
        name for name in dirs
        if name not in excluded
        and not os.path.islink(os.path.join(directory, name))
    ]

    for name in names:
        path = os.path.join(directory, name)

        if not name.endswith(".py") or os.path.islink(path):
            continue

        try:
            with open(path, "rb") as stream:
                source = stream.read()

            ast.parse(source, filename=os.path.relpath(path, root))
            files.append(path)

        except (OSError, SyntaxError, UnicodeError) as exc:
            errors.append(f"{os.path.relpath(path, root)}: {exc}")

print(f"Python files checked: {len(files)}")

for error in errors:
    print(f"ERROR: {error}")

sys.exit(1 if errors else 0)
PY
    )" || status=$?

    if ((status == 0)); then
        record PASS "python-compile" "$output"
    else
        record FAIL "python-compile" "$output"
    fi
}

json_checks() {
    if ! require_command python3; then
        record SKIP "json-validation" "Python 3 is unavailable."
        return
    fi

    local output
    local status=0

    output="$(
        python3 - "$REPO_ROOT" <<'PY'
import json
import os
import sys

root = os.path.realpath(sys.argv[1])
excluded = {
    ".git", ".venv", "venv", "node_modules", "__pycache__",
    "dist", "build", "coverage", "vendor",
}
checked = 0
errors = []

def reject_constant(value):
    raise ValueError(f"non-standard JSON constant: {value}")

for directory, dirs, names in os.walk(root, followlinks=False):
    dirs[:] = [
        name for name in dirs
        if name not in excluded
        and not os.path.islink(os.path.join(directory, name))
    ]

    for name in names:
        path = os.path.join(directory, name)

        if not name.endswith(".json") or os.path.islink(path):
            continue

        checked += 1

        try:
            with open(path, "r", encoding="utf-8-sig") as stream:
                json.load(stream, parse_constant=reject_constant)
        except (OSError, UnicodeError, ValueError) as exc:
            errors.append(f"{os.path.relpath(path, root)}: {exc}")

print(f"JSON files checked: {checked}")

for error in errors:
    print(f"ERROR: {error}")

sys.exit(1 if errors else 0)
PY
    )" || status=$?

    if ((status == 0)); then
        record PASS "json-validation" "$output"
    else
        record FAIL "json-validation" "$output"
    fi
}

javascript_checks() {
    if ! require_command node; then
        record SKIP "javascript-syntax" "Node.js is unavailable."
        return
    fi

    local output
    local status=0

    output="$(
        node --input-type=commonjs - "$REPO_ROOT" <<'JS'
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(process.argv[2]);
const excluded = new Set([
  ".git", ".venv", "venv", "node_modules", "__pycache__",
  "dist", "build", "coverage", "vendor",
]);
const extensions = new Set([".js", ".cjs"]);
let checked = 0;
const errors = [];

function walk(dir) {
  let entries;

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    errors.push(`${path.relative(root, dir)}: ${error.message}`);
    return;
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && excluded.has(entry.name)) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(full);
      continue;
    }

    if (!entry.isFile() || !extensions.has(path.extname(entry.name))) {
      continue;
    }

    checked++;

    try {
      const source = fs.readFileSync(full, "utf8");
      // Parses CommonJS-compatible JavaScript without executing it.
      new vm.Script(source, { filename: path.relative(root, full) });
    } catch (error) {
      errors.push(`${path.relative(root, full)}: ${error.message}`);
    }
  }
}

walk(root);
console.log(`JavaScript files checked: ${checked}`);

for (const error of errors) console.log(`ERROR: ${error}`);

process.exitCode = errors.length ? 1 : 0;
JS
    )" || status=$?

    if ((status == 0)); then
        record PASS "javascript-syntax" "$output"
    else
        record FAIL "javascript-syntax" "$output"
    fi
}

npm_checks() {
    if ! require_command npm; then
        record SKIP "npm-test" "npm is unavailable."
        return
    fi

    if [[ ! -f "$REPO_ROOT/package.json" ]]; then
        record SKIP "npm-test" "package.json is missing."
        return
    fi

    local has_test
    has_test="$(
        node -e '
          const p = require(process.argv[1]);
          process.stdout.write(p.scripts && p.scripts.test ? "yes" : "no");
        ' "$REPO_ROOT/package.json"
    )" || {
        record FAIL "npm-test" "Could not read package.json."
        return
    }

    if [[ "$has_test" != "yes" ]]; then
        record SKIP "npm-test" "No npm test script is configured."
        return
    fi

    local status=0

    (
        cd "$REPO_ROOT"
        npm test -- --runInBand
    ) || status=$?

    if ((status == 0)); then
        record PASS "npm-test" "Test command completed."
    else
        record FAIL "npm-test" "npm test exited with status $status."
    fi
}

existing_checks() {
    local scripts=(
        "scripts/validate-json.cjs"
        "scripts/validate-html.mjs"
        "scripts/validate-document-manifests.mjs"
    )

    local script
    local status

    for script in "${scripts[@]}"; do
        if [[ ! -f "$REPO_ROOT/$script" ]]; then
            record SKIP "existing:$script" "Script not found."
            continue
        fi

        if [[ -L "$REPO_ROOT/$script" ]]; then
            record SKIP "existing:$script" "Refusing to execute a symlink."
            continue
        fi

        if ! require_command node; then
            record SKIP "existing:$script" "Node.js unavailable."
            continue
        fi

        status=0

        (
            cd "$REPO_ROOT"
            node "$script"
        ) || status=$?

        if ((status == 0)); then
            record PASS "existing:$script" "Completed successfully."
        else
            record FAIL "existing:$script" "Exited with status $status."
        fi
    done
}

write_report() {
    local report_path
    report_path="$(safe_repo_path "$REPORT_DIR")" ||
        die "Unsafe report directory."

    if ((DRY_RUN)); then
        log "DRY RUN: report would be written to ${report_path#"$REPO_ROOT"/}/test-report.json"
        return
    fi

    mkdir -p -- "$report_path"

    [[ ! -L "$report_path" ]] ||
        die "Report directory must not be a symlink."

    local output="$report_path/test-report.json"

    [[ ! -e "$output" ]] ||
        die "Report already exists; refusing to overwrite: $output"

    python3 - "$output" "$PASS_COUNT" "$FAIL_COUNT" "$SKIP_COUNT" \
        "${RESULTS[@]}" <<'PY'
import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

destination = Path(sys.argv[1])
passed, failed, skipped = map(int, sys.argv[2:5])
results = []

for item in sys.argv[5:]:
    parts = item.split("|", 2)
    if len(parts) == 3:
        results.append({
            "status": parts[0],
            "check": parts[1],
            "detail": parts[2],
        })

payload = {
    "project": "MedOrbits",
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "summary": {
        "passed": passed,
        "failed": failed,
        "skipped": skipped,
    },
    "results": results,
}

fd, temporary = tempfile.mkstemp(
    prefix=".test-report-",
    suffix=".tmp",
    dir=str(destination.parent),
)

try:
    with os.fdopen(fd, "w", encoding="utf-8") as stream:
        json.dump(payload, stream, indent=2, ensure_ascii=False)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())

    # Exclusive creation protects existing reports.
    with open(destination, "x", encoding="utf-8") as final:
        with open(temporary, encoding="utf-8") as source:
            final.write(source.read())

finally:
    try:
        os.unlink(temporary)
    except FileNotFoundError:
        pass

print(f"Report created: {destination}")
PY
}

main() {
    while (($#)); do
        case "$1" in
            --help|-h)
                usage
                exit 0
                ;;
            --check)
                MODE="check"
                shift
                ;;
            --dry-run)
                DRY_RUN=1
                shift
                ;;
            --python)
                RUN_PYTHON=1
                shift
                ;;
            --json)
                RUN_JSON=1
                shift
                ;;
            --javascript)
                RUN_JS=1
                shift
                ;;
            --npm)
                RUN_NPM=1
                shift
                ;;
            --existing)
                RUN_EXISTING=1
                shift
                ;;
            --all)
                RUN_PYTHON=1
                RUN_JSON=1
                RUN_JS=1
                RUN_NPM=1
                RUN_EXISTING=1
                shift
                ;;
            *)
                die "Unknown argument: $1"
                ;;
        esac
    done

    log "Repository: $REPO_ROOT"
    check_repo
    check_tools

    if [[ "$MODE" == "check" ]]; then
        log "Environment checks complete."
        return 0
    fi

    if ((DRY_RUN)); then
        log "Dry-run enabled: validation commands will not execute."
        log "No tests were executed and no report was written."
        exit 0
    fi

    # With no explicit selection, run the basic static checks.
    if ((RUN_PYTHON == 0 && RUN_JSON == 0 && RUN_JS == 0 &&
         RUN_NPM == 0 && RUN_EXISTING == 0)); then
        RUN_PYTHON=1
        RUN_JSON=1
        RUN_JS=1
    fi

    ((RUN_PYTHON)) && python_checks
    ((RUN_JSON)) && json_checks
    ((RUN_JS)) && javascript_checks
    ((RUN_NPM)) && npm_checks
    ((RUN_EXISTING)) && existing_checks

    printf '\n'
    log "Results: PASS=$PASS_COUNT FAIL=$FAIL_COUNT SKIP=$SKIP_COUNT"

    write_report

    ((FAIL_COUNT == 0))
}

main "$@"
