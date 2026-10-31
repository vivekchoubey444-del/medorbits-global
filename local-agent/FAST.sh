#!/usr/bin/env bash
# MedOrbits Local Agent fast verification launcher.
# Runs independent checks concurrently; does not install packages or alter source files.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
PYTHON_BIN="${PYTHON:-python3}"
JOBS="${JOBS:-4}"
mkdir -p .local-agent/reports
STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT=".local-agent/reports/fast-check-${STAMP}.log"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

run_check() {
  local name="$1"; shift
  if "$@" >"$TMP/$name.out" 2>"$TMP/$name.err"; then
    printf 'PASS %s\n' "$name" >"$TMP/$name.status"
  else
    printf 'FAIL %s (exit %s)\n' "$name" "$?" >"$TMP/$name.status"
  fi
}

# Independent checks run in background for speed.
run_check python-compile "$PYTHON_BIN" -m compileall -q -x '(^|/)(node_modules|\.git|\.venv|venv|\.local-agent)/' . & p1=$!
run_check javascript-syntax node scripts/check-javascript.js & p2=$!
run_check json-validation node scripts/validate-json.js & p3=$!
run_check shell-syntax bash scripts/check-shell.sh & p4=$!
wait "$p1" || true; wait "$p2" || true; wait "$p3" || true; wait "$p4" || true

{
  echo "MedOrbits Local Agent fast check"
  echo "Timestamp: $STAMP"
  echo "Root: $ROOT"
  echo
  for name in python-compile javascript-syntax json-validation shell-syntax; do
    cat "$TMP/$name.status"
    cat "$TMP/$name.out"
    cat "$TMP/$name.err"
    echo
  done
} | tee "$REPORT"

if grep -q '^FAIL ' "$TMP"/*.status; then
  echo "One or more checks failed. Review $REPORT" >&2
  exit 1
fi
echo "All fast checks passed. Report: $REPORT"
