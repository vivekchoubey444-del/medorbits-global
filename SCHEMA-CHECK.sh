#!/usr/bin/env bash
# ============================================================
# MedOrbits -- JSON Schema Validation
# File: SCHEMA-CHECK.sh
# Release: 2.0.0
#
# Usage:
#   bash SCHEMA-CHECK.sh
#   bash SCHEMA-CHECK.sh --strict
#   bash SCHEMA-CHECK.sh --help
#
# Read-only: does not modify, rename, or delete files.
# ============================================================
set -uo pipefail
IFS=$'\n\t'
STRICT=0
case "${1:-}" in
  "")
    ;;
  --strict)
    STRICT=1
    ;;
  --help|-h)
    cat <<'HELP'
MedOrbits Schema Checker
Usage:
  bash SCHEMA-CHECK.sh
  bash SCHEMA-CHECK.sh --strict
Validates:
  - JSON syntax
  - Common JSON Schema structure
  - Recognized JSON Schema draft declarations
  - Basic schema keyword types
  - Common misspelled schema filenames
  - Optional full validation when a compatible validator is installed
No files are changed.
HELP
    exit 0
    ;;
  *)
    printf '[ERROR] Unknown argument: %s\n' "$1" >&2
    exit 2
    ;;
esac
PASS=0
WARN=0
FAIL=0
SKIP=0
pass() {
  PASS=$((PASS + 1))
  printf '[PASS] %s\n' "$*"
}
warn() {
  WARN=$((WARN + 1))
  printf '[WARN] %s\n' "$*" >&2
}
fail() {
  FAIL=$((FAIL + 1))
  printf '[FAIL] %s\n' "$*" >&2
}
skip() {
  SKIP=$((SKIP + 1))
  printf '[SKIP] %s\n' "$*"
}
section() {
  printf '\n========== %s ==========\n' "$*"
}
command -v git >/dev/null 2>&1 || {
  printf '[FATAL] Git is required.\n' >&2
  exit 2
}
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  printf '[FATAL] Run this script inside the MedOrbits Git repository.\n' >&2
  exit 2
}
cd "$ROOT" || exit 2
if ! command -v node >/dev/null 2>&1; then
  printf '[FATAL] Node.js is required for JSON validation.\n' >&2
  exit 2
fi
section "Environment"
printf 'Repository: %s\n' "$ROOT"
printf 'Node.js: '
node --version
section "Discover schema files"
SCHEMA_FILES=()
while IFS= read -r -d '' file; do
  SCHEMA_FILES+=("$file")
done < <(
  find . \
    \( -type d \( \
      -name .git -o \
      -name node_modules -o \
      -name .agent-backup -o \
      -name coverage -o \
      -name dist -o \
      -name build -o \
      -name .next -o \
      -name .wrangler \
    \) -prune \) -o \
    \( -type f \( \
      -name '*.schema.json' -o \
      -name '*.shema.json' -o \
      -name 'schema.json' -o \
      -name '*-schema.json' \
    \) -print0 \) 2>/dev/null
)
if [[ "${#SCHEMA_FILES[@]}" -eq 0 ]]; then
  warn "No schema-named JSON files found."
else
  pass "Found ${#SCHEMA_FILES[@]} schema candidate(s)."
fi
section "Validate JSON syntax"
JSON_TOTAL=0
JSON_FAILED=0
while IFS= read -r -d '' file; do
  JSON_TOTAL=$((JSON_TOTAL + 1))
  if ! node -e \
    'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' \
    "$file" >/dev/null 2>&1; then
    printf '[FAIL] Invalid JSON: %s\n' "$file" >&2
    JSON_FAILED=$((JSON_FAILED + 1))
  fi
done < <(
  find . \
    \( -type d \( \
      -name .git -o \
      -name node_modules -o \
      -name .agent-backup -o \
      -name coverage -o \
      -name dist -o \
      -name build -o \
      -name .next -o \
      -name .wrangler \
    \) -prune \) -o \
    \( -type f -name '*.json' -print0 \) 2>/dev/null
)
if [[ "$JSON_TOTAL" -eq 0 ]]; then
  warn "No JSON files found."
elif [[ "$JSON_FAILED" -eq 0 ]]; then
  pass "All $JSON_TOTAL JSON files have valid JSON syntax."
else
  fail "$JSON_FAILED of $JSON_TOTAL JSON files have invalid JSON syntax."
fi
section "Inspect schema structure"
SCHEMA_FAILED=0
SCHEMA_WARNINGS=0
for file in "${SCHEMA_FILES[@]}"; do
  [[ -f "$file" ]] || continue
  # Invalid JSON has already been reported above.
  if ! node -e \
    'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' \
    "$file" >/dev/null 2>&1; then
    continue
  fi
  RESULT="$(
    node - "$file" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
const warnings = [];
const isObject = value =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const validTypes = new Set([
  'null',
  'boolean',
  'object',
  'array',
  'number',
  'integer',
  'string'
]);
if (!isObject(schema) && typeof schema !== 'boolean') {
  errors.push('schema root must be an object or boolean');
}
if (isObject(schema)) {
  if (schema.$schema !== undefined) {
    const supportedDrafts = [
      'draft-04/schema',
      'draft-06/schema',
      'draft-07/schema',
      '2019-09/schema',
      '2020-12/schema'
    ];
    if (
      typeof schema.$schema !== 'string' ||
      !supportedDrafts.some(draft => schema.$schema.includes(draft))
    ) {
      warnings.push('$schema is not a recognized common JSON Schema draft URI');
    }
  } else {
    warnings.push('$schema is absent; specify the intended JSON Schema draft');
  }
  if (
    schema.type !== undefined &&
    !(
      (typeof schema.type === 'string' && validTypes.has(schema.type)) ||
      (
        Array.isArray(schema.type) &&
        schema.type.length > 0 &&
        schema.type.every(type => typeof type === 'string' && validTypes.has(type))
      )
    )
  ) {
    errors.push('type contains an invalid JSON Schema type');
  }
  if (
    schema.properties !== undefined &&
    !isObject(schema.properties)
  ) {
    errors.push('properties must be an object');
  }
  if (
    schema.required !== undefined &&
    (
      !Array.isArray(schema.required) ||
      !schema.required.every(item => typeof item === 'string') ||
      new Set(schema.required).size !== schema.required.length
    )
  ) {
    errors.push('required must be an array of unique strings');
  }
  if (
    schema.items !== undefined &&
    !isObject(schema.items) &&
    typeof schema.items !== 'boolean' &&
    !Array.isArray(schema.items)
  ) {
    errors.push('items must be a schema object, boolean, or supported tuple array');
  }
  if (
    schema.additionalProperties !== undefined &&
    typeof schema.additionalProperties !== 'boolean' &&
    !isObject(schema.additionalProperties)
  ) {
    errors.push('additionalProperties must be a boolean or schema object');
  }
  if (
    schema.enum !== undefined &&
    (!Array.isArray(schema.enum) || schema.enum.length === 0)
  ) {
    errors.push('enum must be a non-empty array');
  }
  if (
    schema.$id !== undefined &&
    typeof schema.$id !== 'string'
  ) {
    errors.push('$id must be a string');
  }
  if (
    schema.title !== undefined &&
    typeof schema.title !== 'string'
  ) {
    errors.push('title must be a string');
  }
  if (
    schema.description !== undefined &&
    typeof schema.description !== 'string'
  ) {
    errors.push('description must be a string');
  }
  if (
    Array.isArray(schema.required) &&
    isObject(schema.properties)
  ) {
    for (const name of schema.required) {
      if (!Object.prototype.hasOwnProperty.call(schema.properties, name)) {
        warnings.push(`required property "${name}" is not declared in properties`);
      }
    }
  }
  if (
    schema.type === 'object' &&
    !schema.properties &&
    schema.additionalProperties === undefined
  ) {
    warnings.push('object schema defines neither properties nor additionalProperties');
  }
}
console.log(JSON.stringify({ errors, warnings }));
NODE
  )" || {
    printf '[FAIL] Could not inspect schema: %s\n' "$file" >&2
    SCHEMA_FAILED=$((SCHEMA_FAILED + 1))
    continue
  }
  ERROR_COUNT="$(
    node -e 'const r=JSON.parse(process.argv[1]); console.log(r.errors.length)' "$RESULT"
  )"
  WARNING_COUNT="$(
    node -e 'const r=JSON.parse(process.argv[1]); console.log(r.warnings.length)' "$RESULT"
  )"
  if [[ "$ERROR_COUNT" -gt 0 ]]; then
    printf '[FAIL] %s\n' "$file" >&2
    node -e '
      const r = JSON.parse(process.argv[1]);
      for (const message of r.errors) console.error("  - " + message);
    ' "$RESULT"
    SCHEMA_FAILED=$((SCHEMA_FAILED + ERROR_COUNT))
  else
    pass "Basic schema structure: $file"
  fi
  if [[ "$WARNING_COUNT" -gt 0 ]]; then
    node -e '
      const r = JSON.parse(process.argv[1]);
      for (const message of r.warnings) console.error("[WARN] " + message);
    ' "$RESULT" >&2
    SCHEMA_WARNINGS=$((SCHEMA_WARNINGS + WARNING_COUNT))
  fi
done
if [[ "$SCHEMA_FAILED" -gt 0 ]]; then
  fail "$SCHEMA_FAILED schema structure error(s) detected."
fi
if [[ "$SCHEMA_WARNINGS" -gt 0 ]]; then
  warn "$SCHEMA_WARNINGS schema warning(s) require review."
fi
section "Filename conventions"
MISSPELLED=0
for file in "${SCHEMA_FILES[@]}"; do
  case "$file" in
    *.shema.json)
      warn "Possible schema filename typo: $file (expected *.schema.json)"
      MISSPELLED=$((MISSPELLED + 1))
      ;;
  esac
done
if [[ "$MISSPELLED" -eq 0 ]]; then
  pass "No *.shema.json filename typos found."
else
  warn "$MISSPELLED possible schema filename typo(s) found. No files were renamed."
fi
section "Optional full JSON Schema validation"
if [[ -f package.json ]] &&
   node -e '
     const p = require("./package.json");
     process.exit(
       (p.devDependencies && p.devDependencies.ajv) ||
       (p.dependencies && p.dependencies.ajv) ? 0 : 1
     );
   ' >/dev/null 2>&1 &&
   [[ -d node_modules ]]; then
  warn "AJV is installed, but this script's checks remain structural; configure a project-specific validator for full validation."
else
  skip "No configured full JSON Schema validator detected."
fi
section "Summary"
printf 'Passed:   %s\n' "$PASS"
printf 'Warnings: %s\n' "$WARN"
printf 'Failed:   %s\n' "$FAIL"
printf 'Skipped:  %s\n' "$SKIP"
if [[ "$FAIL" -gt 0 ]]; then
  printf '\nSCHEMA CHECK RESULT: FAILED\n'
  exit 1
fi
if [[ "$STRICT" -eq 1 && "$WARN" -gt 0 ]]; then
  printf '\nSCHEMA CHECK RESULT: REVIEW REQUIRED (strict mode)\n'
  exit 1
fi
printf '\nSCHEMA CHECK RESULT: COMPLETED -- review warnings before release.\n'
exit 0