#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
COMMAND="${1:-help}"
shift || true
log()  { printf '[INFO] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*" >&2; }
die()  { printf '[ERROR] %s\n' "$*" >&2; exit 1; }
has()  { command -v "$1" >/dev/null 2>&1; }
usage() {
  cat <<'HELP'
MedOrbits Safe Tools Runner
Usage: bash tools/RUN.sh COMMAND
Commands:
  help              Show help
  check             Check repository/tool availability
  test              Run repository test runner
  test-quick        Run quick checks
  test-python       Run Python syntax checks
  test-node         Run JavaScript syntax checks
  meta-example      Show Meta ad creator help
  meta-create       Forward arguments to Meta ad creator
  meta-validate     Forward arguments to Meta ad creator
  start             Run existing npm start script
  dev               Run existing npm dev script
No dependency installation, ad publishing, deployment, or file deletion is performed.
HELP
}
check_project() {
  log "Repository root: $ROOT_DIR"
  log "Tools directory: $SCRIPT_DIR"
  if has python3; then python3 --version; else warn "python3 not found"; fi
  if has node; then node --version; else warn "node not found"; fi
  if has npm; then npm --version; else warn "npm not found"; fi
  if [[ -f "$ROOT_DIR/package.json" ]]; then
    node - "$ROOT_DIR/package.json" <<'NODE'
const fs = require("node:fs");
try {
  const pkg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  console.log(`Package: ${pkg.name || "(unnamed)"}`);
  console.log(`Version: ${pkg.version || "(unspecified)"}`);
  for (const name of ["start", "dev", "test"]) {
    console.log(`${name} script: ${pkg.scripts && pkg.scripts[name] ? "available" : "missing"}`);
  }
} catch (err) { console.error(`Invalid package.json: ${err.message}`); process.exitCode = 1; }
NODE
  else warn "package.json not found at repository root"; fi
  [[ -d "$ROOT_DIR/node_modules" ]] && log "node_modules exists" || warn "node_modules missing (not installed by this tool)"
}
run_npm_script() {
  local name="$1"
  [[ -f "$ROOT_DIR/package.json" ]] || die "package.json not found"
  has npm || die "npm is not installed"
  node - "$ROOT_DIR/package.json" "$name" <<'NODE'
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const name = process.argv[3];
if (!pkg.scripts || !pkg.scripts[name]) { console.error(`npm script "${name}" is not defined in package.json`); process.exit(2); }
NODE
  (cd "$ROOT_DIR" && npm run "$name")
}
case "$COMMAND" in
  help|-h|--help) usage ;;
  check) check_project ;;
  test) exec bash "$SCRIPT_DIR/TEST.sh" "$@" ;;
  test-quick) exec bash "$SCRIPT_DIR/TEST.sh" --quick ;;
  test-python) exec bash "$SCRIPT_DIR/TEST.sh" --python-only ;;
  test-node) exec bash "$SCRIPT_DIR/TEST.sh" --node-only ;;
  meta-example) [[ -f "$SCRIPT_DIR/meta_ad_creator.py" ]] || die "meta_ad_creator.py not found"; python3 "$SCRIPT_DIR/meta_ad_creator.py" --help ;;
  meta-create) [[ -f "$SCRIPT_DIR/meta_ad_creator.py" ]] || die "meta_ad_creator.py not found"; exec python3 "$SCRIPT_DIR/meta_ad_creator.py" create "$@" ;;
  meta-validate) [[ -f "$SCRIPT_DIR/meta_ad_creator.py" ]] || die "meta_ad_creator.py not found"; exec python3 "$SCRIPT_DIR/meta_ad_creator.py" validate "$@" ;;
  start|dev) run_npm_script "$COMMAND" ;;
  *) usage >&2; die "Unknown command: $COMMAND" ;;
esac
