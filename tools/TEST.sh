#!/usr/bin/env bash
set -uo pipefail
IFS=$'\n\t'
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
MODE="all"; PASS=0; FAIL=0; SKIP=0
declare -a FAILURES=()
usage() {
  cat <<'HELP'
MedOrbits Test Runner
Usage: bash tools/TEST.sh [--quick|--python-only|--node-only|--help]
--quick       Core syntax and JSON checks
--python-only Python syntax checks
--node-only   JavaScript syntax checks
--help        Show help
No dependencies are installed and repository source files are not modified.
HELP
}
while (($#)); do
  case "$1" in
    --quick) MODE="quick" ;;
    --python-only) MODE="python" ;;
    --node-only) MODE="node" ;;
    --help|-h) usage; exit 0 ;;
    *) printf '[ERROR] Unknown option: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done
pass() { PASS=$((PASS+1)); printf '[PASS] %s\n' "$*"; }
fail() { FAIL=$((FAIL+1)); FAILURES+=("$*"); printf '[FAIL] %s\n' "$*" >&2; }
skip() { SKIP=$((SKIP+1)); printf '[SKIP] %s\n' "$*"; }
if [[ "$MODE" == all || "$MODE" == quick || "$MODE" == python ]]; then
  if command -v python3 >/dev/null 2>&1; then
    while IFS= read -r -d '' file; do
      if python3 - "$file" <<'PY'
import ast, pathlib, sys
path = pathlib.Path(sys.argv[1])
ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))
PY
      then pass "Python syntax: ${file#"$ROOT_DIR"/}"; else fail "Python syntax: ${file#"$ROOT_DIR"/}"; fi
    done < <(find "$ROOT_DIR" -path "$ROOT_DIR/.git" -prune -o -path "$ROOT_DIR/node_modules" -prune -o -path "$ROOT_DIR/.venv" -prune -o -type f -name '*.py' -print0)
  else skip "Python checks (python3 unavailable)"; fi
fi
if [[ "$MODE" == all || "$MODE" == quick || "$MODE" == node ]]; then
  if command -v node >/dev/null 2>&1; then
    while IFS= read -r -d '' file; do
      if node --check "$file" >/dev/null 2>&1; then pass "JavaScript syntax: ${file#"$ROOT_DIR"/}"
      else fail "JavaScript syntax: ${file#"$ROOT_DIR"/}"; node --check "$file" 2>&1 | head -n 8
      fi
    done < <(find "$ROOT_DIR" -path "$ROOT_DIR/.git" -prune -o -path "$ROOT_DIR/node_modules" -prune -o -type f -name '*.js' -print0)
  else skip "Node checks (node unavailable)"; fi
fi
if [[ "$MODE" == all || "$MODE" == quick ]]; then
  while IFS= read -r -d '' file; do
    if bash -n "$file" 2>/dev/null; then pass "Shell syntax: ${file#"$ROOT_DIR"/}"
    else fail "Shell syntax: ${file#"$ROOT_DIR"/}"; bash -n "$file" 2>&1 | head -n 8; fi
  done < <(find "$ROOT_DIR" -path "$ROOT_DIR/.git" -prune -o -path "$ROOT_DIR/node_modules" -prune -o -type f -name '*.sh' -print0)
  while IFS= read -r -d '' file; do
    if python3 -m json.tool "$file" >/dev/null 2>&1; then pass "JSON syntax: ${file#"$ROOT_DIR"/}"; else fail "JSON syntax: ${file#"$ROOT_DIR"/}"; fi
  done < <(find "$ROOT_DIR" -path "$ROOT_DIR/.git" -prune -o -path "$ROOT_DIR/node_modules" -prune -o -type f -name '*.json' -print0)
fi
printf '\nSummary: %d passed, %d failed, %d skipped\n' "$PASS" "$FAIL" "$SKIP"
if ((FAIL)); then printf 'Failed checks:\n' >&2; printf ' - %s\n' "${FAILURES[@]}" >&2; exit 1; fi
exit 0
