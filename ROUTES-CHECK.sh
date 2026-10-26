#!/usr/bin/env bash

============================================================

MedOrbits -- Express Routes Integrity Checker

File: ROUTES-CHECK.sh

Checks:

- Git merge-conflict markers in route source files

- Route/controller/middleware imports and relative paths

- Common Express callback and router export mistakes

- Route mounting references in server.js and route loaders

- Duplicate route declarations (heuristic)

- JavaScript syntax when Node.js is available

Safety:

- Read-only; does not modify source files

- Does not install dependencies

- Does not commit, push, reset, or delete files

============================================================

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT" || exit 2

ERRORS=0
WARNINGS=0
CHECKS=0

say() {
printf ‘%s\n’ "$*"
}

pass() {
CHECKS=$((CHECKS + 1))
printf ‘[PASS] %s\n’ "$*"
}

warn() {
WARNINGS=$((WARNINGS + 1))
printf ‘[WARN] %s\n’ "$*"
}

fail() {
ERRORS=$((ERRORS + 1))
printf ‘[FAIL] %s\n’ "$*"
}

section() {
printf ‘\n=== %s ===\n’ "$*"
}

has_cmd() {
command -v "$1" >/dev/null 2>&1
}

----------------------------------------

1. Repository and runtime checks

----------------------------------------

section "Repository and runtime"

if [[ -d "$ROOT/.git" ]] || git -C "$ROOT" rev-parse –is-inside-work-tree >/dev/null 2>&1; then
pass "Git repository detected"
else
warn "Git repository metadata not detected"
fi

if has_cmd node; then
pass "Node.js available: $(node –version)"
else
warn "Node.js unavailable; JavaScript syntax checks will be skipped"
fi

if [[ -f "$ROOT/package.json" ]]; then
pass "package.json found"
else
warn "package.json not found at repository root"
fi

----------------------------------------

2. Discover likely route and controller files

----------------------------------------

section "Route and controller discovery"

declare -a ROUTE_FILES=()
declare -a JS_FILES=()

while IFS= read -r -d ‘’ file; do
case "$file" in
/node_modules/|/.git/|/.agent-backup/|/coverage/|/dist/|/build/)
continue
;;
esac

base="${file##*/}"
lower="${base,,}"

if [[ "$lower" == route.js || "$lower" == routes.js || "$lower" == route.cjs || "$lower" == routes.cjs || "$lower" == route.mjs || "$lower" == routes.mjs ]]; then
ROUTE_FILES+=("$file")
fi

case "$file" in
.js|.cjs|.mjs)
JS_FILES+=("$file")
;;
esac
done < <(
find "$ROOT" 
( -type d ( -name .git -o -name node_modules -o -name .agent-backup -o -name coverage -o -name dist -o -name build ) -prune ) 
-o ( -type f ( -name ’.js’ -o -name ‘.cjs’ -o -name ’.mjs’ ) -print0 ) 2>/dev/null
)

if ((${#ROUTE_FILES[@]} > 0)); then
pass "Found ${#ROUTE_FILES[@]} likely route file(s)"
for file in "${ROUTE_FILES[@]}"; do
printf ’  - %s\n’ "${file#"$ROOT"/}"
done
else
warn "No route files detected by filename; check whether routes use another naming convention"
fi

if ((${#JS_FILES[@]} > 0)); then
pass "Found ${#JS_FILES[@]} JavaScript source file(s)"
else
warn "No JavaScript source files found"
fi

----------------------------------------

3. Conflict-marker checks

----------------------------------------

section "Merge-conflict marker scan"

CONFLICT_FOUND=0

for file in "${JS_FILES[@]}"; do
if grep -nE ‘^(<<<<<<< |=======|>>>>>>> )’ "$file" >/dev/null 2>&1; then
fail "Possible conflict markers in ${file#"$ROOT"/}"
grep -nE ‘^(<<<<<<< |=======|>>>>>>> )’ "$file" |
sed -E ‘s/^([0-9]+):.*/  line \1/’ |
head -n 10
CONFLICT_FOUND=1
fi
done

if ((CONFLICT_FOUND == 0)); then
pass "No standard conflict markers found in JavaScript files"
fi

----------------------------------------

4. Relative import / require path checks

----------------------------------------

section "Relative dependency path checks"

PATH_CHECKS=0
PATH_ERRORS=0

for file in "${JS_FILES[@]}"; do
while IFS= read -r spec; do
[[ -n "$spec" ]] || continue
PATH_CHECKS=$((PATH_CHECKS + 1))

source_dir="$(dirname "$file")"
target="$source_dir/$spec"
if [[ -e "$target" ]]; then
  continue
fi
found=0
for extension in .js .cjs .mjs .json .node; do
  if [[ -e "${target}${extension}" ]]; then
    found=1
    break
  fi
done
if [[ -d "$target" ]]; then
  found=1
fi
if ((found == 0)); then
  fail "Missing relative dependency: ${file#"$ROOT"/} -> $spec"
  PATH_ERRORS=$((PATH_ERRORS + 1))
fi

done < <(
grep -Eo ‘(from[[:space:]]["’'’][.][^"’'’]+["’'’]|require[[:space:]]([[:space:]]["’'’][.][^"’'’]+["’'’]|import[[:space:]]([[:space:]]["’'’][.][^"’'’]+["’'’]’ "$file" 2>/dev/null |
sed -E ’s/^from[[:space:]]"’'’["’'’]$/\1/; s/^require[[:space:]]([[:space:]]"’'’["’'’]$/\1/; s/^import[[:space:]]([[:space:]]"’'’["’'’]$/\1/’
)
done

if ((PATH_ERRORS == 0)); then
pass "No missing relative dependency paths detected (${PATH_CHECKS} import(s) inspected)"
fi

----------------------------------------

5. Express callback and export heuristics

----------------------------------------

section "Express route callback and export heuristics"

CALLBACK_WARNINGS=0

for file in "${ROUTE_FILES[@]}"; do

Detect common incorrect patterns such as router.get(path, undefined).

if grep -nE ‘.(get|post|put|patch|delete|all|use)[[:space:]]([^;](undefined|null)[[:space:]])’ "$file" >/dev/null 2>&1; then
warn "Possible undefined/null Express callback in ${file#"$ROOT"/}"
grep -nE ’.(get|post|put|patch|delete|all|use)[[:space:]]([^;](undefined|null)[[:space:]])’ "$file" |
head -n 5
CALLBACK_WARNINGS=$((CALLBACK_WARNINGS + 1))
fi

Flag route files with no obvious router creation or export.

if ! grep -Eq ‘express.Router[[:space:]](|Router[[:space:]](’ "$file"; then
warn "No obvious Express Router creation found in ${file#"$ROOT"/}; verify manually if this is intentional"
CALLBACK_WARNINGS=$((CALLBACK_WARNINGS + 1))
fi

if ! grep -Eq ‘module.exports|exports.|export default|export[[:space:]]*{’ "$file"; then
warn "No obvious module export found in ${file#"$ROOT"/}; verify its export contract"
CALLBACK_WARNINGS=$((CALLBACK_WARNINGS + 1))
fi
done

if ((CALLBACK_WARNINGS == 0)); then
pass "No obvious route callback/export issues detected"
fi

----------------------------------------

6. Route mounting references

----------------------------------------

section "Route mounting references"

MOUNT_FILES=()
for candidate in 
"$ROOT/server.js" 
"$ROOT/app.js" 
"$ROOT/index.js" 
"$ROOT/src/server.js" 
"$ROOT/src/app.js"; do
[[ -f "$candidate" ]] && MOUNT_FILES+=("$candidate")
done

if ((${#MOUNT_FILES[@]} == 0)); then
warn "No conventional Express entry point found; route mounting must be verified manually"
else
for file in "${MOUNT_FILES[@]}"; do
printf ‘[INFO] Entry point: %s\n’ "${file#"$ROOT"/}"

if grep -Eq '\.use[[:space:]]*\(' "$file"; then
  pass "Express .use() calls detected in ${file#"$ROOT"/}"
else
  warn "No obvious .use() calls found in ${file#"$ROOT"/}"
fi

done
fi

Report route files not obviously referenced by an entry point.

This is a heuristic: dynamic loaders may mount files indirectly.

for route_file in "${ROUTE_FILES[@]}"; do
rel="${route_file#"$ROOT"/}"
base="${route_file##*/}"
referenced=0

for entry in "${MOUNT_FILES[@]}"; do
if grep -Fq "$base" "$entry" || grep -Fq "$rel" "$entry"; then
referenced=1
break
fi
done

if ((referenced == 0)); then
warn "Route file not directly referenced by a conventional entry point: $rel (dynamic loading may be valid)"
fi
done

----------------------------------------

7. Duplicate route declaration heuristic

----------------------------------------

section "Duplicate route declaration heuristic"

DUPLICATE_COUNT=0

for file in "${ROUTE_FILES[@]}"; do
duplicates="$(
grep -E ‘^[[:space:]](router|app).(get|post|put|patch|delete|all)[[:space:]](’ "$file" 2>/dev/null |
sed -E ‘s/^[[:space:]]*//; s/[[:space:]]+/ /g’ |
sort |
uniq -d
)"

if [[ -n "$duplicates" ]]; then
warn "Repeated identical route declaration text in ${file#"$ROOT"/}"
printf ‘%s\n’ "$duplicates" | head -n 10
DUPLICATE_COUNT=$((DUPLICATE_COUNT + 1))
fi
done

if ((DUPLICATE_COUNT == 0)); then
pass "No identical duplicate route declaration lines detected"
fi

----------------------------------------

8. JavaScript syntax validation

----------------------------------------

section "JavaScript syntax validation"

SYNTAX_ERRORS=0

if has_cmd node; then
for file in "${JS_FILES[@]}"; do
if ! node –check "$file" >/dev/null 2>&1; then
fail "JavaScript syntax check failed: ${file#"$ROOT"/}"
node –check "$file" 2>&1 | head -n 12
SYNTAX_ERRORS=$((SYNTAX_ERRORS + 1))
fi
done

if ((SYNTAX_ERRORS == 0)); then
pass "Node.js syntax check passed for ${#JS_FILES[@]} JavaScript file(s)"
fi
else
warn "Skipped Node.js syntax validation because Node.js is unavailable"
fi

----------------------------------------

9. Summary

----------------------------------------

section "Summary"

printf ‘Checks passed: %s\n’ "$CHECKS"
printf ‘Warnings:      %s\n’ "$WARNINGS"
printf ‘Errors:        %s\n’ "$ERRORS"

if ((ERRORS > 0)); then
say "RESULT: FAIL -- inspect the errors above before merging."
exit 1
fi

if ((WARNINGS > 0)); then
say "RESULT: PASS WITH WARNINGS -- review warnings manually."
exit 0
fi

say "RESULT: PASS -- no issues detected by these heuristic checks."
exit 0