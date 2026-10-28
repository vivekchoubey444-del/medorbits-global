
#!/usr/bin/env bash
# ============================================================
# MedOrbits -- Express Routes Integrity Checker
# File: ROUTES-CHECK.sh
#
# Checks:
#   - Git merge-conflict markers
#   - Relative JavaScript imports and require() paths
#   - Common Express callback and router export mistakes
#   - Route mounting references in conventional entry points
#   - Duplicate route declaration heuristics
#   - JavaScript syntax using Node.js when available
#
# Safety:
#   - Read-only; does not modify source files
#   - Does not install dependencies
#   - Does not commit, push, reset, or delete files
# ============================================================

set -uo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)" || exit 2
cd "$ROOT" || exit 2

ERRORS=0
WARNINGS=0
CHECKS=0

say() {
    printf '%s\n' "$*"
}

pass() {
    CHECKS=$((CHECKS + 1))
    printf '[PASS] %s\n' "$*"
}

warn() {
    WARNINGS=$((WARNINGS + 1))
    printf '[WARN] %s\n' "$*"
}

fail() {
    ERRORS=$((ERRORS + 1))
    printf '[FAIL] %s\n' "$*"
}

section() {
    printf '\n=== %s ===\n' "$*"
}

has_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# Find JavaScript files while excluding dependency and generated
# directories. All discovered paths are absolute.
declare -a JS_FILES=()
declare -a ROUTE_FILES=()
declare -a MOUNT_FILES=()

while IFS= read -r -d '' file; do
    JS_FILES+=("$file")

    base="${file##*/}"
    lower="${base,,}"

    case "$lower" in
        route.js|routes.js|route.cjs|routes.cjs|route.mjs|routes.mjs)
            ROUTE_FILES+=("$file")
            ;;
    esac
done < <(
    find "$ROOT" \
        \( \
            -type d \( \
                -name .git \
                -o -name node_modules \
                -o -name .agent-backup \
                -o -name coverage \
                -o -name .coverage \
                -o -name dist \
                -o -name build \
                -o -name .venv \
                -o -name venv \
                -o -name .next \
            \) -prune \
        \) -o \
        \( \
            -type f \( \
                -name '*.js' \
                -o -name '*.cjs' \
                -o -name '*.mjs' \
            \) -print0 \
        \) 2>/dev/null
)

# Convert an absolute path into a repository-relative path.
relative_path() {
    printf '%s\n' "${1#"$ROOT"/}"
}

# ============================================================
# 1. REPOSITORY AND RUNTIME
# ============================================================

section "Repository and runtime"

if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    pass "Git repository detected"
else
    warn "Git repository metadata not detected"
fi

if has_cmd node; then
    pass "Node.js available: $(node --version)"
else
    warn "Node.js unavailable; syntax checks will be skipped"
fi

if [[ -f "$ROOT/package.json" ]]; then
    pass "package.json found"
else
    warn "package.json not found at repository root"
fi

# ============================================================
# 2. ROUTE AND CONTROLLER DISCOVERY
# ============================================================

section "Route and controller discovery"

if ((${#ROUTE_FILES[@]} > 0)); then
    pass "Found ${#ROUTE_FILES[@]} likely route file(s)"

    for file in "${ROUTE_FILES[@]}"; do
        printf '  - %s\n' "$(relative_path "$file")"
    done
else
    warn "No conventional route filenames detected"
fi

if ((${#JS_FILES[@]} > 0)); then
    pass "Found ${#JS_FILES[@]} JavaScript source file(s)"
else
    warn "No JavaScript source files found"
fi

# ============================================================
# 3. MERGE-CONFLICT MARKERS
# ============================================================

section "Merge-conflict marker scan"

CONFLICT_FOUND=0

for file in "${JS_FILES[@]}"; do
    if grep -nE '^(<<<<<<< |=======$|>>>>>>> )' "$file" >/dev/null 2>&1; then
        fail "Possible merge-conflict markers in $(relative_path "$file")"

        grep -nE '^(<<<<<<< |=======$|>>>>>>> )' "$file" |
            sed -E 's/^([0-9]+):.*/  line \1/' |
            head -n 10

        CONFLICT_FOUND=1
    fi
done

if ((CONFLICT_FOUND == 0)); then
    pass "No standard conflict markers found in JavaScript files"
fi

# ============================================================
# 4. RELATIVE IMPORT AND REQUIRE PATHS
# ============================================================

section "Relative dependency path checks"

PATH_CHECKS=0
PATH_ERRORS=0

# Resolve common Node.js relative module specifiers.
# This is a heuristic and does not fully implement Node.js
# ESM, package exports, aliases, or custom loaders.
resolve_relative_module() {
    local source_file="$1"
    local spec="$2"
    local source_dir target candidate

    source_dir="$(dirname "$source_file")"
    target="$source_dir/$spec"

    if [[ -e "$target" ]]; then
        return 0
    fi

    for candidate in \
        "${target}.js" \
        "${target}.cjs" \
        "${target}.mjs" \
        "${target}.json" \
        "${target}.node" \
        "${target}.ts" \
        "${target}.cts" \
        "${target}.mts" \
        "${target}.tsx" \
        "${target}.jsx" \
        "${target}/index.js" \
        "${target}/index.cjs" \
        "${target}/index.mjs" \
        "${target}/index.json" \
        "${target}/index.ts" \
        "${target}/index.tsx"; do
        if [[ -e "$candidate" ]]; then
            return 0
        fi
    done

    return 1
}

for file in "${JS_FILES[@]}"; do
    # Node-based extraction handles common static import/export and
    # require() patterns without relying on fragile shell quoting.
    # Dynamic imports are included only when their specifier is a
    # string literal.
    if ! has_cmd node; then
        continue
    fi

    while IFS= read -r spec; do
        [[ -n "$spec" ]] || continue

        # Only relative module specifiers are checked.
        case "$spec" in
            ./*|../*)
                ;;
            *)
                continue
                ;;
        esac

        PATH_CHECKS=$((PATH_CHECKS + 1))

        if ! resolve_relative_module "$file" "$spec"; then
            fail "Missing relative dependency: $(relative_path "$file") -> $spec"
            PATH_ERRORS=$((PATH_ERRORS + 1))
        fi
    done < <(
        node --input-type=module - "$file" <<'NODE'
import fs from "node:fs";

const file = process.argv[2];
let source;

try {
    source = fs.readFileSync(file, "utf8");
} catch {
    process.exit(0);
}

const patterns = [
    /\bimport\s+(?:[^"'`;]*?\s+from\s+)?["'](\.{1,2}\/[^"']+)["']/g,
    /\bexport\s+[^"'`;]*?\s+from\s+["'](\.{1,2}\/[^"']+)["']/g,
    /\bimport\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g,
];

const found = new Set();

for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
        found.add(match[1]);
    }
}

for (const specifier of found) {
    console.log(specifier);
}
NODE
    )
done

if ((PATH_ERRORS == 0)); then
    pass "No missing relative dependencies detected (${PATH_CHECKS} specifier(s) inspected)"
fi

if ! has_cmd node; then
    warn "Relative import extraction skipped because Node.js is unavailable"
fi

# ============================================================
# 5. EXPRESS CALLBACK AND EXPORT HEURISTICS
# ============================================================

section "Express callback and export heuristics"

CALLBACK_WARNINGS=0

for file in "${ROUTE_FILES[@]}"; do
    rel="$(relative_path "$file")"

    if grep -nE '\.(get|post|put|patch|delete|all|use)[[:space:]]*\([^;]*(undefined|null)[[:space:]]*[,)]' \
        "$file" >/dev/null 2>&1; then
        warn "Possible undefined/null callback in $rel"

        grep -nE '\.(get|post|put|patch|delete|all|use)[[:space:]]*\([^;]*(undefined|null)[[:space:]]*[,)]' \
            "$file" |
            head -n 5

        CALLBACK_WARNINGS=$((CALLBACK_WARNINGS + 1))
    fi

    if ! grep -Eq 'Router[[:space:]]*\(|express[[:space:]]*\.[[:space:]]*Router[[:space:]]*\(' "$file"; then
        warn "No obvious Router creation in $rel; verify manually if intentional"
        CALLBACK_WARNINGS=$((CALLBACK_WARNINGS + 1))
    fi

    if ! grep -Eq 'module[[:space:]]*\.[[:space:]]*exports|exports[.]|export[[:space:]]+default|export[[:space:]]*\{' "$file"; then
        warn "No obvious module export found in $rel; verify its export contract"
        CALLBACK_WARNINGS=$((CALLBACK_WARNINGS + 1))
    fi
done

if ((CALLBACK_WARNINGS == 0)); then
    pass "No obvious route callback/export issues detected"
fi

# ============================================================
# 6. ROUTE MOUNTING REFERENCES
# ============================================================

section "Route mounting references"

for candidate in \
    "$ROOT/server.js" \
    "$ROOT/app.js" \
    "$ROOT/index.js" \
    "$ROOT/src/server.js" \
    "$ROOT/src/app.js" \
    "$ROOT/src/index.js"; do
    [[ -f "$candidate" ]] && MOUNT_FILES+=("$candidate")
done

if ((${#MOUNT_FILES[@]} == 0)); then
    warn "No conventional Express entry point found; inspect route loaders manually"
else
    for file in "${MOUNT_FILES[@]}"; do
        rel="$(relative_path "$file")"
        printf '[INFO] Entry point: %s\n' "$rel"

        if grep -Eq '\.[[:space:]]*use[[:space:]]*\(' "$file"; then
            pass "Possible .use() mounting calls found in $rel"
        else
            warn "No obvious .use() calls found in $rel"
        fi
    done
fi

for route_file in "${ROUTE_FILES[@]}"; do
    rel="$(relative_path "$route_file")"
    base="${route_file##*/}"
    referenced=0

    for entry in "${MOUNT_FILES[@]}"; do
        if grep -Fq -- "$base" "$entry" || grep -Fq -- "$rel" "$entry"; then
            referenced=1
            break
        fi
    done

    if ((referenced == 0)); then
        warn "Route file not directly referenced by a conventional entry point: $rel"
        printf '       Dynamic route loaders may make this valid.\n'
    fi
done

# ============================================================
# 7. DUPLICATE ROUTE DECLARATION HEURISTIC
# ============================================================

section "Duplicate route declaration heuristic"

DUPLICATE_COUNT=0

for file in "${ROUTE_FILES[@]}"; do
    duplicates="$(
        grep -E '^[[:space:]]*(router|app)[[:space:]]*\.[[:space:]]*(get|post|put|patch|delete|all)[[:space:]]*\(' \
            "$file" 2>/dev/null |
            sed -E 's/^[[:space:]]*//; s/[[:space:]]+/ /g' |
            sort |
            uniq -d
    )"

    if [[ -n "$duplicates" ]]; then
        warn "Repeated identical route declaration text in $(relative_path "$file")"
        printf '%s\n' "$duplicates" | head -n 10
        DUPLICATE_COUNT=$((DUPLICATE_COUNT + 1))
    fi
done

if ((DUPLICATE_COUNT == 0)); then
    pass "No identical duplicate route declaration lines detected"
fi

# ============================================================
# 8. JAVASCRIPT SYNTAX VALIDATION
# ============================================================

section "JavaScript syntax validation"

SYNTAX_ERRORS=0

if has_cmd node; then
    for file in "${JS_FILES[@]}"; do
        if ! node --check "$file" >/dev/null 2>&1; then
            fail "JavaScript syntax check failed: $(relative_path "$file")"
            node --check "$file" 2>&1 | head -n 12
            SYNTAX_ERRORS=$((SYNTAX_ERRORS + 1))
        fi
    done

    if ((SYNTAX_ERRORS == 0)); then
        pass "Node.js syntax check passed for ${#JS_FILES[@]} JavaScript file(s)"
    fi
else
    warn "Skipped JavaScript syntax validation because Node.js is unavailable"
fi

# ============================================================
# 9. SUMMARY
# ============================================================

section "Summary"

printf 'Checks passed: %s\n' "$CHECKS"
printf 'Warnings:      %s\n' "$WARNINGS"
printf 'Errors:        %s\n' "$ERRORS"

if ((ERRORS > 0)); then
    say "RESULT: FAIL -- inspect errors before merging."
    exit 1
fi

if ((WARNINGS > 0)); then
    say "RESULT: PASS WITH WARNINGS -- review warnings manually."
    exit 0
fi

say "RESULT: PASS -- no issues detected by these heuristic checks."
exit 0
