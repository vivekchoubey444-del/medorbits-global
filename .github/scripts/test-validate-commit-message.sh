
#!/usr/bin/env bash
# ==============================================================================
# MEDORBITS -- COMMIT MESSAGE VALIDATOR TEST SUITE
# File: .github/scripts/test-validate-commit-message.sh
# Version: 2.1.3
#
# Purpose:
#   Test the commit-message validation script.
#
# Requirements:
#   - Bash 4+
#   - validate-commit-message.sh
#
# Exit codes:
#   0 = All tests passed
#   1 = One or more tests failed
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'

readonly SCRIPT_DIR="$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &&
    pwd
)"

readonly VALIDATOR="${SCRIPT_DIR}/validate-commit-message.sh"

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/medorbits-commit-tests.XXXXXX")"

cleanup() {
    rm -rf -- "$TEMP_DIR"
}

trap cleanup EXIT

# ------------------------------------------------------------------------------
# VALIDATOR AVAILABILITY
# ------------------------------------------------------------------------------

if [[ ! -f "$VALIDATOR" ]]; then
    echo "[ERROR] Validator not found: $VALIDATOR" >&2
    exit 1
fi

if [[ ! -r "$VALIDATOR" ]]; then
    echo "[ERROR] Validator is not readable." >&2
    exit 1
fi

# ------------------------------------------------------------------------------
# TEST COUNTERS
# ------------------------------------------------------------------------------

TOTAL=0
PASSED=0
FAILED=0

# ------------------------------------------------------------------------------
# TEST RUNNER
# ------------------------------------------------------------------------------

run_case() {
    local name="$1"
    local expected="$2"
    local message="$3"

    local message_file="${TEMP_DIR}/message-${TOTAL}.txt"

    TOTAL=$((TOTAL + 1))

    printf '%s' "$message" > "$message_file"

    if bash "$VALIDATOR" "$message_file" \
        >"${TEMP_DIR}/stdout.log" \
        2>"${TEMP_DIR}/stderr.log"; then
        actual="valid"
    else
        actual="invalid"
    fi

    if [[ "$actual" == "$expected" ]]; then
        PASSED=$((PASSED + 1))
        printf '[PASS] %s\n' "$name"
    else
        FAILED=$((FAILED + 1))
        printf '[FAIL] %s\n' "$name"
        printf '       Expected: %s\n' "$expected"
        printf '       Actual:   %s\n' "$actual"

        if [[ -s "${TEMP_DIR}/stderr.log" ]]; then
            sed 's/^/       /' "${TEMP_DIR}/stderr.log"
        fi
    fi
}

# ==============================================================================
# VALID COMMIT MESSAGES
# ==============================================================================

echo
echo "============================================================"
echo "VALID COMMIT MESSAGE TESTS"
echo "============================================================"

run_case \
    "Basic feature" \
    valid \
    "feat: add login page"

run_case \
    "Feature with scope" \
    valid \
    "feat(auth): add login validation"

run_case \
    "Fix with scope" \
    valid \
    "fix(api): handle missing response"

run_case \
    "Documentation update" \
    valid \
    "docs: update installation guide"

run_case \
    "Style update" \
    valid \
    "style(ui): improve button spacing"

run_case \
    "Refactoring" \
    valid \
    "refactor(core): simplify configuration"

run_case \
    "Performance improvement" \
    valid \
    "perf(database): optimize query execution"

run_case \
    "Test update" \
    valid \
    "test(auth): add authentication tests"

run_case \
    "Build update" \
    valid \
    "build: update build configuration"

run_case \
    "CI update" \
    valid \
    "ci: improve workflow validation"

run_case \
    "Chore update" \
    valid \
    "chore: clean unused files"

run_case \
    "Revert update" \
    valid \
    "revert: restore previous configuration"

run_case \
    "Security update" \
    valid \
    "security(auth): strengthen token validation"

run_case \
    "Scope with slash" \
    valid \
    "fix(api/auth): handle expired sessions"

run_case \
    "Scope with underscore" \
    valid \
    "fix(user_profile): correct field mapping"

run_case \
    "Scope with dot" \
    valid \
    "feat(api.v2): add endpoint"

run_case \
    "Scope with hyphen" \
    valid \
    "feat(user-panel): add dashboard"

run_case \
    "Uppercase subject" \
    valid \
    "feat: Add dashboard"

run_case \
    "Numeric subject" \
    valid \
    "fix: resolve error 404"

run_case \
    "Commit message with body" \
    valid \
    $'feat(auth): add login\n\nAdd fallback validation.'

run_case \
    "Commit message with footer" \
    valid \
    $'fix(api): handle timeout\n\nFixes #123'

run_case \
    "Subject at maximum length" \
    valid \
    "feat: $(printf '%0100d' 0)"

# ==============================================================================
# INVALID COMMIT MESSAGES
# ==============================================================================

echo
echo "============================================================"
echo "INVALID COMMIT MESSAGE TESTS"
echo "============================================================"

run_case \
    "Empty message" \
    invalid \
    ""

run_case \
    "Missing type" \
    invalid \
    "add login page"

run_case \
    "Missing colon" \
    invalid \
    "feat add login page"

run_case \
    "Missing space after colon" \
    invalid \
    "feat:add login page"

run_case \
    "Uppercase type" \
    invalid \
    "Feat: add login page"

run_case \
    "Unsupported type" \
    invalid \
    "update: add login page"

run_case \
    "Empty scope" \
    invalid \
    "feat(): add login page"

run_case \
    "Empty subject" \
    invalid \
    "feat: "

run_case \
    "Subject begins with period" \
    invalid \
    "feat: .add login validation"

run_case \
    "Subject begins with hyphen" \
    invalid \
    "feat: -add login validation"

run_case \
    "Subject begins with underscore" \
    invalid \
    "feat: _add login validation"

run_case \
    "Subject begins with punctuation" \
    invalid \
    "feat: !add login validation"

run_case \
    "Leading whitespace" \
    invalid \
    " feat: add login page"

run_case \
    "Trailing header whitespace" \
    invalid \
    "feat: add login page "

run_case \
    "Subject longer than 100 characters" \
    invalid \
    "feat: $(printf '%0101d' 0)"

run_case \
    "Invalid scope with spaces" \
    invalid \
    "feat(user profile): add login"

run_case \
    "Merge commit" \
    invalid \
    "Merge branch 'feature/login'"

run_case \
    "Fixup commit" \
    invalid \
    "fixup! feat: add login"

run_case \
    "Squash commit" \
    invalid \
    "squash! feat: add login"

run_case \
    "Amend commit" \
    invalid \
    "amend! feat: add login"

run_case \
    "Multiple header lines" \
    invalid \
    $'feat(auth): add login\nfix(api): add fallback'

run_case \
    "Conflict marker" \
    invalid \
    "feat: add <<<<<<< conflict"

# ==============================================================================
# TEST RESULTS
# ==============================================================================

echo
echo "============================================================"
echo "MEDORBITS COMMIT VALIDATION TEST REPORT"
echo "============================================================"

printf 'Total tests : %d\n' "$TOTAL"
printf 'Passed      : %d\n' "$PASSED"
printf 'Failed      : %d\n' "$FAILED"

echo "============================================================"

if (( FAILED > 0 )); then
    echo "[FAILED] Commit-message validation tests did not all pass."
    exit 1
fi

echo "[SUCCESS] All commit-message validation tests passed."

exit 0
