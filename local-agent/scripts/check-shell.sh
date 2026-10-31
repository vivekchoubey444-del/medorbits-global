#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
count=0
failures=0
while IFS= read -r -d '' file; do
  case "$file" in */.git/*|*/node_modules/*|*/.local-agent/*) continue ;; esac
  count=$((count + 1))
  if ! bash -n "$file" 2>"/tmp/medorbits-shell-check.err"; then
    printf 'Shell syntax error: %s\n' "${file#"$ROOT"/}"
    cat /tmp/medorbits-shell-check.err
    failures=$((failures + 1))
  fi
done < <(find "$ROOT" -type f -name '*.sh' -print0)
printf 'Shell files checked: %s\n' "$count"
(( failures == 0 ))
