#!/usr/bin/env bash

============================================================

MedOrbits Safe Tools Runner

File: /tools/RUN.sh

Purpose:

Run MedOrbits tests and maintenance checks from /tools.

Usage:

bash tools/RUN.sh help

bash tools/RUN.sh check

bash tools/RUN.sh test

bash tools/RUN.sh test-quick

bash tools/RUN.sh test-python

bash tools/RUN.sh test-node

bash tools/RUN.sh meta-example

bash tools/RUN.sh meta-create

bash tools/RUN.sh meta-validate reports/meta-campaign-draft.json

bash tools/RUN.sh start

bash tools/RUN.sh dev

Safety:

- No automatic dependency installation.

- No destructive Git operations.

- No deployment or ad publishing.

- Does not overwrite campaign drafts.

============================================================

set -Eeuo pipefail
IFS=$’\n\t’

readonly SCRIPT_DIR="$(
cd – "$(dirname – "${BASH_SOURCE[0]}")" && pwd -P
)"
readonly ROOT_DIR="$(
cd – "${SCRIPT_DIR}/.." && pwd -P
)"

COMMAND="${1:-help}"
shift || true

log() {
printf ‘[INFO] %s\n’ "$*"
}

warn() {
printf ‘[WARN] %s\n’ "$*" >&2
}

die() {
printf ‘[ERROR] %s\n’ "$*" >&2
exit 1
}

section() {
printf ‘\n%s\n’ ‘============================================================’
printf ‘%s\n’ "$*"
printf ‘%s\n\n’ ‘============================================================’
}

has_command() {
command -v "$1" >/dev/null 2>&1
}

require_command() {
has_command "$1" || die "Required command not found: $1"
}

require_file() {
[[ -f "$1" ]] || die "Required file not found: $1"
}

show_help() {
cat <<‘HELP’
MedOrbits Safe Tools Runner

Usage:
bash tools/RUN.sh  [arguments]

Commands:
help              Show this help message.
check             Check repository and tool availability.
test              Run tools/TEST.sh.
test-quick        Run essential checks.
test-python       Run Python checks.
test-node         Run Node.js checks.
meta-example      Print a sample Meta Ads campaign draft.
meta-create       Create a new Meta Ads draft.
meta-validate     Validate an existing campaign JSON file.
start             Run the existing npm start script.
dev               Run the existing npm dev script.

Examples:
bash tools/RUN.sh check
bash tools/RUN.sh test
bash tools/RUN.sh meta-example
bash tools/RUN.sh meta-create –output reports/campaign-001.json
bash tools/RUN.sh meta-validate reports/campaign-001.json

Safety:
This script does not install dependencies, delete files, reset Git,
publish advertisements, or deploy the application.
HELP
}

check_project() {
section "MedOrbits environment check"

log "Repository root: $ROOT_DIR"
log "Tools directory: $SCRIPT_DIR"

if [[ -f "$ROOT_DIR/package.json" ]]; then
log "Found package.json."

if has_command node; then
  node --version
  node - "$ROOT_DIR/package.json" <<'NODE'

const fs = require("node:fs");
const file = process.argv[2];

try {
const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
console.log(Package: ${pkg.name || "(unnamed)"});
console.log(Version: ${pkg.version || "(unspecified)"});
console.log(Start script: ${pkg.scripts?.start ? "available" : "missing"});
console.log(Dev script: ${pkg.scripts?.dev ? "available" : "missing"});
console.log(Test script: ${pkg.scripts?.test ? "available" : "missing"});
} catch (error) {
console.error(Invalid package.json: ${error.message});
process.exitCode = 1;
}
NODE
else
warn "Node.js is unavailable."
fi
else
warn "package.json not found."
fi

if has_command python3; then
log "Python: $(python3 –version 2>&1)"
else
warn "python3 is unavailable."
fi

if has_command npm; then
log "npm: $(npm –version)"
else
warn "npm is unavailable."
fi

if [[ -d "$ROOT_DIR/node_modules" ]]; then
log "node_modules exists."
else
warn "node_modules is missing; no dependencies were installed."
fi

if [[ -f "$ROOT_DIR/.env" ]]; then
warn ".env exists. Verify that Git ignores it."
else
log "No root .env file found."
fi

if [[ -f "$SCRIPT_DIR/TEST.sh" ]]; then
log "Found tools/TEST.sh."
else
warn "tools/TEST.sh not found."
fi

if [[ -f "$SCRIPT_DIR/meta_ad_creator.py" ]]; then
log "Found tools/meta_ad_creator.py."
else
warn "tools/meta_ad_creator.py not found."
fi
}

run_tests() {
local mode="$1"
local test_file="$SCRIPT_DIR/TEST.sh"

require_file "$test_file"
require_command bash

case "$mode" in
all)
bash "$test_file"
;;
quick)
bash "$test_file" –quick
;;
python)
bash "$test_file" –python-only
;;
node)
bash "$test_file" –node-only
;;
*)
die "Unknown test mode: $mode"
;;
esac
}

run_meta_creator() {
local operation="$1"
local creator="$SCRIPT_DIR/meta_ad_creator.py"

require_file "$creator"
require_command python3

case "$operation" in
example)
python3 "$creator" example
;;
create)
python3 "$creator" create "$@"
;;
validate)
if (($# != 1)); then
die "Usage: bash tools/RUN.sh meta-validate CAMPAIGN.json"
fi
python3 "$creator" validate "$1"
;;
*)
die "Unknown Meta Ads operation: $operation"
;;
esac
}

run_npm_script() {
local script_name="$1"

require_file "$ROOT_DIR/package.json"
require_command node
require_command npm

[[ -d "$ROOT_DIR/node_modules" ]] ||
die "node_modules is missing. Install reviewed dependencies manually."

node - "$ROOT_DIR/package.json" "$script_name" <<‘NODE’
const fs = require("node:fs");

const pkg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const scriptName = process.argv[3];

if (typeof pkg.scripts?.[scriptName] !== "string") {
console.error(package.json does not define "${scriptName}".);
process.exit(1);
}
NODE

section "Running npm $script_name"
cd "$ROOT_DIR"
npm run "$script_name"
}

main() {
section "MedOrbits Safe Tools Runner"
log "Command: $COMMAND"

case "$COMMAND" in
help|-h|–help)
show_help
;;
check)
check_project
;;
test)
run_tests all
;;
test-quick)
run_tests quick
;;
test-python)
run_tests python
;;
test-node)
run_tests node
;;
meta-example)
run_meta_creator example
;;
meta-create)
run_meta_creator create "$@"
;;
meta-validate)
run_meta_creator validate "$@"
;;
start)
run_npm_script start
;;
dev)
run_npm_script dev
;;
*)
show_help >&2
die "Unknown command: $COMMAND"
;;
esac
}

main "$@"