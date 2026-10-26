#!/usr/bin/env bash

============================================================

MedOrbits Test Runner

File: /tools/TEST.sh

Purpose:

Run safe, repeatable checks for MedOrbits tools and source.

Safety:

- Does not delete or overwrite user files.

- Does not modify Git history or working-tree contents.

- Does not install packages automatically.

- Does not require production credentials.

- Reports optional checks as skipped when dependencies are absent.

Usage:

bash tools/TEST.sh

bash tools/TEST.sh –quick

bash tools/TEST.sh –python-only

bash tools/TEST.sh –node-only

bash tools/TEST.sh –help

============================================================

set -uo pipefail
IFS=$’\n\t’

readonly SCRIPT_NAME="MedOrbits Test Runner"
readonly SCRIPT_DIR="$(
cd – "$(dirname – "${BASH_SOURCE[0]}")" && pwd -P
)"
readonly ROOT_DIR="$(
cd – "${SCRIPT_DIR}/.." && pwd -P
)"

MODE="all"
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
WARN_COUNT=0

declare -a FAILURES=()
declare -a SKIPS=()
declare -a WARNINGS=()

usage() {
cat <<‘USAGE’
MedOrbits Test Runner

Usage:
bash tools/TEST.sh [option]

Options:
–quick        Run essential checks only.
–python-only  Run Python checks only.
–node-only    Run Node.js checks only.
–help         Display this help message.

The script does not install dependencies or modify Git history.
USAGE
}

log() {
printf ‘[INFO] %s\n’ "$*"
}

pass() {
PASS_COUNT=$((PASS_COUNT + 1))
printf ‘[PASS] %s\n’ "$*"
}

fail() {
FAIL_COUNT=$((FAIL_COUNT + 1))
FAILURES+=("$")
printf ‘[FAIL] %s\n’ "$" >&2
}

skip() {
SKIP_COUNT=$((SKIP_COUNT + 1))
SKIPS+=("$")
printf ‘[SKIP] %s\n’ "$"
}

warn() {
WARN_COUNT=$((WARN_COUNT + 1))
WARNINGS+=("$")
printf ‘[WARN] %s\n’ "$" >&2
}

section() {
printf ‘\n’
printf ‘%s\n’ ‘----------------------------------------’
printf ‘%s\n’ "$*"
printf ‘%s\n’ ‘----------------------------------------’
}

run_check() {
local description="$1"
shift

log "$description"

if "$@"; then
pass "$description"
else
fail "$description"
fi
}

has_command() {
command -v "$1" >/dev/null 2>&1
}

file_exists() {
[[ -f "$1" ]]
}

directory_exists() {
[[ -d "$1" ]]
}

parse_args() {
while (($#)); do
case "$1" in
–quick)
MODE="quick"
;;
–python-only)
MODE="python"
;;
–node-only)
MODE="node"
;;
–help|-h)
usage
exit 0
;;
*)
printf ‘Unknown option: %s\n\n’ "$1" >&2
usage >&2
exit 2
;;
esac
shift
done
}

check_repository_root() {
[[ -f "${ROOT_DIR}/package.json" || 
-f "${ROOT_DIR}/server.js" || 
-d "${ROOT_DIR}/tools" ]]
}

check_python_syntax() {
local python_file="$1"

if has_command python3; then
python3 - "$python_file" <<‘PY’
import ast
import pathlib
import sys

path = pathlib.Path(sys.argv[1])

try:
source = path.read_text(encoding="utf-8")
ast.parse(source, filename=str(path))
except (OSError, UnicodeError, SyntaxError) as exc:
print(f"Python syntax check failed: {exc}", file=sys.stderr)
raise SystemExit(1)

print(f"Valid Python syntax: {path}")
PY
else
return 2
fi
}

check_json_syntax() {
local json_file="$1"

if has_command node; then
node - "$json_file" <<‘NODE’
const fs = require("node:fs");

const file = process.argv[2];

try {
JSON.parse(fs.readFileSync(file, "utf8"));
console.log(Valid JSON: ${file});
} catch (error) {
console.error(Invalid JSON in ${file}: ${error.message});
process.exitCode = 1;
}
NODE
elif has_command python3; then
python3 - "$json_file" <<‘PY’
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])

try:
json.loads(path.read_text(encoding="utf-8"))
except (OSError, UnicodeError, json.JSONDecodeError) as exc:
print(f"Invalid JSON in {path}: {exc}", file=sys.stderr)
raise SystemExit(1)

print(f"Valid JSON: {path}")
PY
else
return 2
fi
}

run_python_checks() {
section "Python checks"

local ad_creator="${ROOT_DIR}/tools/meta_ad_creator.py"

if ! has_command python3; then
skip "Python checks: python3 is unavailable"
return
fi

pass "Python 3 is available"

if ! file_exists "$ad_creator"; then
skip "Meta Ads creator checks: tools/meta_ad_creator.py not found"
return
fi

local syntax_status=0
check_python_syntax "$ad_creator" || syntax_status=$?

if ((syntax_status == 0)); then
pass "Meta Ads creator syntax"
elif ((syntax_status == 2)); then
skip "Meta Ads creator syntax: Python unavailable"
else
fail "Meta Ads creator syntax"
return
fi

run_check 
"Meta Ads creator help command" 
python3 "$ad_creator" –help

local example_output
if example_output="$(
python3 "$ad_creator" example 2>/dev/null
)"; then
pass "Meta Ads creator example command"

if printf '%s' "$example_output" |
  python3 -c '

import json
import sys

data = json.load(sys.stdin)

assert isinstance(data, dict)
assert data.get("status") == "draft"
assert data.get("publishing_enabled") is False
assert data.get("compliance_review_required") is True
assert isinstance(data.get("creative"), dict)
assert isinstance(data.get("audience"), dict)
assert isinstance(data.get("tracking"), dict)

print("Example campaign structure and safety flags are valid.")
’; then
pass "Meta Ads example structure and safety flags"
else
fail "Meta Ads example structure and safety flags"
fi
else
fail "Meta Ads creator example command"
fi

if [[ "$MODE" != "quick" ]]; then
if python3 - "$ad_creator" <<‘PY’
import importlib.util
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
spec = importlib.util.spec_from_file_location(
"medorbits_meta_ad_creator_test",
path,
)

if spec is None or spec.loader is None:
raise SystemExit("Unable to load Meta Ads creator module.")

module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)

Verify preservation of duplicate non-UTM query parameters.

url = module.add_utm_parameters(
"https://medorbits.in/?tag=one&tag=two#section",
"test-campaign",
)

from urllib.parse import parse_qsl, urlsplit

parts = urlsplit(url)
pairs = parse_qsl(parts.query, keep_blank_values=True)

assert pairs.count(("tag", "one")) == 1
assert pairs.count(("tag", "two")) == 1
assert ("utm_source", "meta") in pairs
assert ("utm_medium", "paid_social") in pairs
assert ("utm_campaign", "test-campaign") in pairs
assert parts.fragment == "section"

Verify safety restrictions.

for unsafe in (
"javascript:alert(1)",
"file:///etc/passwd",
"http://localhost/",
"http://127.0.0.1/",
"http://192.168.1.1/",
"https://user:password@example.com/",
):
try:
module.validate_http_url(unsafe)
except (ValueError, TypeError):
continue
raise AssertionError(f"Unsafe URL was accepted: {unsafe}")

print("Meta Ads URL and safety checks passed.")
PY
then
pass "Meta Ads URL and safety unit checks"
else
fail "Meta Ads URL and safety unit checks"
fi
fi
}

run_node_checks() {
section "Node.js checks"

if ! has_command node; then
skip "Node.js checks: node is unavailable"
return
fi

local node_version
node_version="$(node –version)"
log "Detected Node.js ${node_version}"
pass "Node.js is available"

if ! has_command npm; then
skip "npm checks: npm is unavailable"
return
fi

local package_json="${ROOT_DIR}/package.json"

if ! file_exists "$package_json"; then
skip "Node.js project checks: package.json not found"
return
fi

run_check 
"package.json syntax" 
check_json_syntax "$package_json"

if [[ "$MODE" == "quick" ]]; then
return
fi

local node_modules="${ROOT_DIR}/node_modules"

if ! directory_exists "$node_modules"; then
skip "Dependency checks: node_modules not found; no installation performed"
fi

local server_file="${ROOT_DIR}/server.js"

if file_exists "$server_file"; then
run_check 
"Server JavaScript syntax" 
node –check "$server_file"
else
skip "Server syntax check: server.js not found"
fi

local package_scripts
package_scripts="$(
node -e ’
const p = require(process.argv[1]);
process.stdout.write(JSON.stringify(p.scripts || {}));
’ "$package_json" 2>/dev/null
)" || package_scripts="{}"

if [[ "$package_scripts" == "{}" ]]; then
skip "Package scripts: no scripts found or package.json could not be read"
return
fi

if [[ "$package_scripts" == ’"test"’ ]]; then
log "Running the project’s existing npm test script."

if (
  cd "$ROOT_DIR" &&
  npm test -- --runInBand
); then
  pass "npm test"
else
  warn "npm test failed; check whether the test runner supports --runInBand"
  # Do not count this as passed. Report as a failure for CI reliability.
  fail "npm test"
fi

else
skip "npm test: no test script declared in package.json"
fi
}

run_repository_checks() {
section "Repository checks"

run_check 
"MedOrbits repository structure" 
check_repository_root

local gitignore="${ROOT_DIR}/.gitignore"

if file_exists "$gitignore"; then
pass ".gitignore exists"

if grep -Eq '(^|/)\.env(\.\*)?$|^\.env$' "$gitignore"; then
  pass ".gitignore contains environment-file ignore rules"
else
  warn ".gitignore may not ignore .env files; review before committing"
fi
if grep -Eq '^!\.env$|^!\/\.env$' "$gitignore"; then
  fail ".gitignore explicitly re-includes .env; remove that exception"
fi

else
warn ".gitignore not found"
fi

local env_file="${ROOT_DIR}/.env"

if file_exists "$env_file"; then
warn ".env exists locally; verify it is ignored and never commit secrets"
else
pass "No root .env file present"
fi

local vscode_extensions="${ROOT_DIR}/.vscode/extensions.json"
local vscode_settings="${ROOT_DIR}/.vscode/settings.example.json"

if file_exists "$vscode_extensions"; then
run_check 
".vscode/extensions.json syntax" 
check_json_syntax "$vscode_extensions"
else
skip ".vscode/extensions.json not found"
fi

if file_exists "$vscode_settings"; then
run_check 
".vscode/settings.example.json syntax" 
check_json_syntax "$vscode_settings"
else
skip ".vscode/settings.example.json not found"
fi
}

print_summary() {
section "Test summary"

printf ‘Passed:  %d\n’ "$PASS_COUNT"
printf ‘Failed:  %d\n’ "$FAIL_COUNT"
printf ‘Skipped: %d\n’ "$SKIP_COUNT"
printf ‘Warnings: %d\n’ "$WARN_COUNT"

if ((${#FAILURES[@]})); then
printf ‘\nFailed checks:\n’ >&2
local item
for item in "${FAILURES[@]}"; do
printf ’  - %s\n’ "$item" >&2
done
fi

if ((${#SKIPS[@]})); then
printf ‘\nSkipped checks:\n’
local item
for item in "${SKIPS[@]}"; do
printf ’  - %s\n’ "$item"
done
fi

if ((${#WARNINGS[@]})); then
printf ‘\nWarnings:\n’ >&2
local item
for item in "${WARNINGS[@]}"; do
printf ’  - %s\n’ "$item" >&2
done
fi

printf ‘\n’

if ((FAIL_COUNT > 0)); then
printf ‘[RESULT] FAILED\n’ >&2
return 1
fi

printf ‘[RESULT] PASSED (review skips and warnings above)\n’
return 0
}

main() {
parse_args "$@"

section "$SCRIPT_NAME"
log "Repository: ${ROOT_DIR}"
log "Mode: ${MODE}"
log "No packages will be installed."
log "No files will be deleted or overwritten."

if [[ "$MODE" == "all" || "$MODE" == "quick" || "$MODE" == "python" ]]; then
run_python_checks
fi

if [[ "$MODE" == "all" || "$MODE" == "quick" || "$MODE" == "node" ]]; then
run_node_checks
fi

if [[ "$MODE" == "all" || "$MODE" == "quick" ]]; then
run_repository_checks
fi

print_summary
}

main "$@"