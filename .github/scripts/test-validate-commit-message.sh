
#!/bin/sh
# ==============================================================================
# MedOrbits -- Commit Message Validator Test Suite
#
# File: .github/scripts/test-validate-commit-message.sh
#
# Purpose:
#   Test the commit-message validator without changing repository files.
#
# Requirements:
#   POSIX shell and standard Unix utilities.
#
# Exit codes:
#   0  All tests passed
#   1  One or more tests failed
#   2  Test setup failure
# ==============================================================================

set -eu

PROGRAM_NAME=${0##*/}
SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
VALIDATOR="$SCRIPT_DIR/validate-commit-message.sh"

PASS_COUNT=0
FAIL_COUNT=0
TEST_COUNT=0

# ------------------------------------------------------------------------------
# Setup
# ------------------------------------------------------------------------------

if [ ! -f "$VALIDATOR" ]; then
    printf 'ERROR: Validator not found: %s\n' "$VALIDATOR" >&2
    exit 2
fi

if [ ! -r "$VALIDATOR" ]; then
    printf 'ERROR: Validator is not readable: %s\n' "$VALIDATOR" >&2
    exit 2
fi

if ! command -v mktemp >/dev/null 2>&1; then
    printf 'ERROR: mktemp is required by this test suite.\n' >&2
    exit 2
fi

TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/medorbits-validator.XXXXXX") || {
    printf 'ERROR: Could not create temporary directory.\n' >&2
    exit 2
}

trap 'rm -rf "$TMP_DIR"' 0
trap 'exit 2' HUP INT TERM

COMMIT_FILE="$TMP_DIR/COMMIT_EDITMSG"
OUTPUT_FILE="$TMP_DIR/output.txt"

# ------------------------------------------------------------------------------
# Test runner
#
# Usage:
#   run_test "description" expected_exit command [arguments...]
# ------------------------------------------------------------------------------

run_test() {
    test_name=$1
    expected_exit=$2
    shift 2

    TEST_COUNT=$((TEST_COUNT + 1))

    actual_exit=0

    "$@" >"$OUTPUT_FILE" 2>&1 || actual_exit=$?

    if [ "$actual_exit" -eq "$expected_exit" ]; then
        PASS_COUNT=$((PASS_COUNT + 1))
        printf 'PASS [%02d] %s\n' "$TEST_COUNT" "$test_name"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        printf 'FAIL [%02d] %s\n' "$TEST_COUNT" "$test_name"
        printf '       Expected exit: %s\n' "$expected_exit"
        printf '       Actual exit:   %s\n' "$actual_exit"
        printf '%s\n' '       Output:'
        sed 's/^/         /' "$OUTPUT_FILE"
    fi
}

write_message() {
    printf '%s\n' "$1" >"$COMMIT_FILE"
}

run_message_test() {
    test_name=$1
    expected_exit=$2
    message=$3

    write_message "$message"
    run_test "$test_name" "$expected_exit" \
        "$VALIDATOR" "$COMMIT_FILE"
}

# ------------------------------------------------------------------------------
# 1. Help, version and argument handling
# ------------------------------------------------------------------------------

run_test "Help option succeeds" 0 \
    "$VALIDATOR" --help

run_test "Version option succeeds" 0 \
    "$VALIDATOR" --version

run_test "Missing argument returns exit 2" 2 \
    "$VALIDATOR"

run_test "Unknown option returns exit 2" 2 \
    "$VALIDATOR" --unknown

run_test "Extra argument returns exit 2" 2 \
    "$VALIDATOR" "$COMMIT_FILE" extra

run_test "Missing file returns exit 2" 2 \
    "$VALIDATOR" "$TMP_DIR/nonexistent"

# ------------------------------------------------------------------------------
# 2. Valid Conventional Commit messages
# ------------------------------------------------------------------------------

run_message_test "feat with scope" 0 \
    "feat(auth): add email verification"

run_message_test "fix with scope" 0 \
    "fix(api): handle missing application ID"

run_message_test "docs without scope" 0 \
    "docs: update installation guide"

run_message_test "style with scope" 0 \
    "style(ui): improve spacing"

run_message_test "refactor with scope" 0 \
    "refactor(api): simplify request handling"

run_message_test "perf with scope" 0 \
    "perf(search): reduce query latency"

run_message_test "test with scope" 0 \
    "test(auth): cover invalid tokens"

run_message_test "build with scope" 0 \
    "build(deps): update dependencies"

run_message_test "ci with scope" 0 \
    "ci(github): validate pull requests"

run_message_test "chore with scope" 0 \
    "chore(repo): organize scripts"

run_message_test "revert with scope" 0 \
    "revert(api): restore previous behavior"

run_message_test "Breaking change with scope" 0 \
    "feat(api)!: remove deprecated endpoint"

run_message_test "Breaking change without scope" 0 \
    "feat!: change public API"

run_message_test "Scope supports dots" 0 \
    "fix(api.v2): handle invalid input"

run_message_test "Scope supports underscores" 0 \
    "fix(user_auth): refresh expired tokens"

run_message_test "Scope supports slashes" 0 \
    "fix(api/auth): validate credentials"

run_message_test "Scope supports hyphens" 0 \
    "fix(pre-commit): handle missing files"

run_message_test "Digits in scope" 0 \
    "feat(api2): add endpoint"

run_message_test "Description allows punctuation" 0 \
    "docs: update README.md, examples, and links"

run_message_test "Description allows internal spaces" 0 \
    "feat(auth): add secure login flow"

# ------------------------------------------------------------------------------
# 3. Invalid Conventional Commit messages
# ------------------------------------------------------------------------------

run_message_test "Reject uppercase type" 1 \
    "Feature(auth): add verification"

run_message_test "Reject unsupported type" 1 \
    "release: publish version"

run_message_test "Reject empty scope" 1 \
    "feat(): add verification"

run_message_test "Reject missing closing parenthesis" 1 \
    "feat(auth: add verification"

run_message_test "Reject missing opening parenthesis" 1 \
    "featauth): add verification"

run_message_test "Reject missing colon" 1 \
    "feat(auth) add verification"

run_message_test "Reject missing description" 1 \
    "feat(auth): "

run_message_test "Reject multiple spaces after colon" 1 \
    "feat(auth):  add verification"

run_message_test "Reject space before colon" 1 \
    "feat(auth) : add verification"

run_message_test "Reject uppercase breaking type" 1 \
    "Feat!: change API"

run_message_test "Reject punctuation-only description" 1 \
    "docs: !!!"

run_message_test "Reject scope with spaces" 1 \
    "feat(user auth): add verification"

run_message_test "Reject scope with unsupported character" 1 \
    "feat(auth@api): add verification"

run_message_test "Reject leading subject whitespace" 1 \
    " feat(auth): add verification"

run_message_test "Reject trailing subject whitespace" 1 \
    "feat(auth): add verification "

# ------------------------------------------------------------------------------
# 4. Empty messages and Git comment lines
# ------------------------------------------------------------------------------

: >"$COMMIT_FILE"

run_test "Reject empty file" 1 \
    "$VALIDATOR" "$COMMIT_FILE"

printf '\n   # Git comment\n\t\n' >"$COMMIT_FILE"

run_test "Reject comments and blank lines only" 1 \
    "$VALIDATOR" "$COMMIT_FILE"

printf '# Please enter a commit message\n\nfeat(auth): add verification\n\nBody text\n' \
    >"$COMMIT_FILE"

run_test "Ignore leading comments and blank lines" 0 \
    "$VALIDATOR" "$COMMIT_FILE"

printf 'feat(auth): add verification\n\n# Body comment\n' \
    >"$COMMIT_FILE"

run_test "Validate subject and ignore body" 0 \
    "$VALIDATOR" "$COMMIT_FILE"

# ------------------------------------------------------------------------------
# 5. CRLF compatibility
# ------------------------------------------------------------------------------

printf 'feat(auth): add email verification\r\n\r\nBody text\r\n' \
    >"$COMMIT_FILE"

run_test "Accept CRLF commit message" 0 \
    "$VALIDATOR" "$COMMIT_FILE"

# ------------------------------------------------------------------------------
# 6. Control characters
# ------------------------------------------------------------------------------

printf 'feat(auth): add\tverification\n' >"$COMMIT_FILE"

run_test "Reject tab in subject" 1 \
    "$VALIDATOR" "$COMMIT_FILE"

# ------------------------------------------------------------------------------
# 7. Subject length limits
# ------------------------------------------------------------------------------

write_message "feat: abc"

run_test "Accept subject at configured limit" 0 \
    env MAX_SUBJECT_LENGTH=9 "$VALIDATOR" "$COMMIT_FILE"

run_test "Reject subject above configured limit" 1 \
    env MAX_SUBJECT_LENGTH=8 "$VALIDATOR" "$COMMIT_FILE"

run_test "Accept leading zeros in length configuration" 0 \
    env MAX_SUBJECT_LENGTH=0009 "$VALIDATOR" "$COMMIT_FILE"

run_test "Reject zero maximum length" 2 \
    env MAX_SUBJECT_LENGTH=0 "$VALIDATOR" "$COMMIT_FILE"

run_test "Reject nonnumeric maximum length" 2 \
    env MAX_SUBJECT_LENGTH=abc "$VALIDATOR" "$COMMIT_FILE"

run_test "Reject negative maximum length" 2 \
    env MAX_SUBJECT_LENGTH=-1 "$VALIDATOR" "$COMMIT_FILE"

run_test "Reject excessive maximum length" 2 \
    env MAX_SUBJECT_LENGTH=9999999 "$VALIDATOR" "$COMMIT_FILE"

run_test "Reject invalid VERBOSE value" 2 \
    env VERBOSE=yes "$VALIDATOR" "$COMMIT_FILE"

# ------------------------------------------------------------------------------
# 8. Verbose reporting
# ------------------------------------------------------------------------------

write_message "feat(auth): add email verification"

run_test "Verbose mode succeeds" 0 \
    env VERBOSE=1 "$VALIDATOR" "$COMMIT_FILE"

if grep 'Commit type: feat' "$OUTPUT_FILE" >/dev/null 2>&1; then
    PASS_COUNT=$((PASS_COUNT + 1))
    TEST_COUNT=$((TEST_COUNT + 1))
    printf 'PASS [%02d] Verbose output includes commit type\n' "$TEST_COUNT"
else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    TEST_COUNT=$((TEST_COUNT + 1))
    printf 'FAIL [%02d] Verbose output includes commit type\n' "$TEST_COUNT"
fi

if grep 'Description: add email verification' "$OUTPUT_FILE" >/dev/null 2>&1; then
    PASS_COUNT=$((PASS_COUNT + 1))
    TEST_COUNT=$((TEST_COUNT + 1))
    printf 'PASS [%02d] Verbose output includes description\n' "$TEST_COUNT"
else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    TEST_COUNT=$((TEST_COUNT + 1))
    printf 'FAIL [%02d] Verbose output includes description\n' "$TEST_COUNT"
fi

# ------------------------------------------------------------------------------
# 9. Final report
# ------------------------------------------------------------------------------

printf '\n'
printf '%s\n' '========================================'
printf '%s\n' 'MedOrbits Validator Test Results'
printf '%s\n' '========================================'
printf 'Total:  %s\n' "$TEST_COUNT"
printf 'Passed: %s\n' "$PASS_COUNT"
printf 'Failed: %s\n' "$FAIL_COUNT"
printf '%s\n' '========================================'

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi

printf '%s\n' 'All tests passed.'
exit 0
