
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits Commit Message Validator -- Test Suite
#
# File: .github/scripts/test-validate-commit-message.sh
# Release target: 2.0.0
#
# Purpose:
#   Test validate-commit-message.sh against valid and invalid commit messages.
#
# Usage:
#   bash .github/scripts/test-validate-commit-message.sh
#   bash .github/scripts/test-validate-commit-message.sh --verbose
#   bash .github/scripts/test-validate-commit-message.sh --help
#
# Environment:
#   VALIDATOR_PATH  Optional path to the validator script.
#
# Contract:
#   The validator accepts a commit-message file as its first argument.
#   Exit code 0 means valid; a non-zero exit code means invalid.
#
# Safety:
#   - Does not create Git commits.
#   - Does not modify Git history or tracked repository files.
#   - Uses a private temporary directory and removes it on exit.
#   - Does not install dependencies.
#
# Supported types:
#   feat, fix, docs, style, refactor, perf, test, build,
#   ci, chore, revert, security
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_NAME="test-validate-commit-message.sh"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd -P)"

# Resolve the validator to an absolute path before changing directories.
VALIDATOR_INPUT="${VALIDATOR_PATH:-$SCRIPT_DIR/validate-commit-message.sh}"

if [[ "$VALIDATOR_INPUT" == /* ]]; then
    VALIDATOR_PATH="$VALIDATOR_INPUT"
else
    VALIDATOR_PATH="$PWD/$VALIDATOR_INPUT"
fi

VERBOSE=0
PASSED=0
FAILED=0
SKIPPED=0
TEMP_DIR=""

log() {
    printf '[TEST] %s\n' "$*"
}

pass() {
    PASSED=$((PASSED + 1))
    printf '[PASS] %s\n' "$*"
}

fail() {
    FAILED=$((FAILED + 1))
    printf '[FAIL] %s\n' "$*" >&2
}

skip() {
    SKIPPED=$((SKIPPED + 1))
    printf '[SKIP] %s\n' "$*"
}

die() {
    printf '[ERROR] %s\n' "$*" >&2
    exit 2
}

cleanup() {
    local status=$?

    if [[ -n "${TEMP_DIR:-}" && -d "$TEMP_DIR" ]]; then
        if ! rm -rf -- "$TEMP_DIR"; then
            printf '[WARN] Could not completely remove temporary directory: %s\n' \
                "$TEMP_DIR" >&2
            if ((status == 0)); then
                status=1
            fi
        fi
    fi

    exit "$status"
}

usage() {
    cat <<'USAGE'
MedOrbits Commit Message Validator -- Test Suite

Usage:
  bash .github/scripts/test-validate-commit-message.sh [options]

Options:
  --verbose, -v   Show validator output for each test
  --help, -h      Show this help

Environment:
  VALIDATOR_PATH  Optional path to validate-commit-message.sh

Validator contract:
  Argument 1: path to a commit-message file
  Exit code 0: valid commit message
  Non-zero:    invalid commit message

The test suite does not create commits or change Git history.
USAGE
}

parse_args() {
    while (($#)); do
        case "$1" in
            --verbose|-v)
                VERBOSE=1
                shift
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                die "Unknown option: $1"
                ;;
        esac
    done
}

assert_validator() {
    [[ -f "$VALIDATOR_PATH" ]] ||
        die "Validator not found: $VALIDATOR_PATH"

    [[ -r "$VALIDATOR_PATH" ]] ||
        die "Validator is not readable: $VALIDATOR_PATH"

    if ! bash -n "$VALIDATOR_PATH"; then
        die "Validator has Bash syntax errors."
    fi

    pass "Validator exists and passes Bash syntax validation"
}

run_case() {
    local label="$1"
    local expected="$2"
    local message="$3"
    local message_file="$TEMP_DIR/message.txt"
    local output_file="$TEMP_DIR/output.txt"
    local actual=0

    # Each case receives fresh input and output files.
    printf '%s\n' "$message" > "$message_file"
    : > "$output_file"

    if bash "$VALIDATOR_PATH" "$message_file" >"$output_file" 2>&1; then
        actual=0
    else
        actual=$?
    fi

    if ((VERBOSE)); then
        printf '\n--- %s ---\n' "$label"
        printf 'Message: %s\n' "$message"
        printf 'Expected result: %s | Actual exit code: %s\n' \
            "$expected" "$actual"
        cat "$output_file"
        printf '%s\n' '--------------------'
    fi

    if [[ "$expected" == "valid" && "$actual" -eq 0 ]]; then
        pass "$label"
    elif [[ "$expected" == "invalid" && "$actual" -ne 0 ]]; then
        pass "$label"
    else
        fail "$label (expected $expected, got exit code $actual)"

        if ((!VERBOSE)); then
            sed -n '1,12p' "$output_file" >&2 || true
        fi
    fi
}

run_valid_cases() {
    log "Testing valid commit messages..."

    run_case "Feature with scope" valid \
        "feat(auth): add session refresh support"

    run_case "Bug fix" valid \
        "fix(api): handle missing request body"

    run_case "Documentation update" valid \
        "docs(readme): explain local setup"

    run_case "Refactor" valid \
        "refactor(routes): simplify route registration"

    run_case "Performance improvement" valid \
        "perf(search): reduce repeated database queries"

    run_case "Test update" valid \
        "test(auth): cover expired access tokens"

    run_case "Build configuration" valid \
        "build(deps): update compatible build tooling"

    run_case "CI change" valid \
        "ci(github): validate pull request workflow"

    run_case "Maintenance change" valid \
        "chore(config): organize application settings"

    run_case "Security fix" valid \
        "security(api): reject malformed authorization headers"

    run_case "Revert without scope" valid \
        "revert: restore previous route behavior"

    run_case "Subject with issue number" valid \
        "fix(login): handle timeout for issue #123"
}

run_invalid_cases() {
    log "Testing invalid commit messages..."

    run_case "Empty message" invalid ""

    run_case "Missing type" invalid \
        "add login validation"

    run_case "Missing colon" invalid \
        "feat(auth) add login validation"

    run_case "Missing subject" invalid \
        "feat(auth):"

    run_case "Uppercase type" invalid \
        "FEAT(auth): add login validation"

    run_case "Whitespace before colon" invalid \
        "feat(auth) : add login validation"

    run_case "Leading whitespace" invalid \
        " feat(auth): add login validation"

    run_case "Unsupported type" invalid \
        "unknown(auth): add login validation"

    run_case "Malformed scope brackets" invalid \
        "feat(auth: add login validation"

    run_case "Newline-only message" invalid \
        $'\n\n'

    run_case "Comment-only message" invalid \
        "# Please enter a commit message"

    run_case "Merge message" invalid \
        "Merge branch 'feature/login' into main"

    run_case "Fixup message" invalid \
        "fixup! feat(auth): add login validation"

    run_case "Subject begins with period" invalid \
        "feat(auth): .add login validation"
}

print_summary() {
    printf '\n========================================\n'
    printf 'MedOrbits Commit Message Test Summary\n'
    printf 'Passed:  %s\n' "$PASSED"
    printf 'Failed:  %s\n' "$FAILED"
    printf 'Skipped: %s\n' "$SKIPPED"
    printf '========================================\n'
}

main() {
    parse_args "$@"

    cd "$REPO_ROOT"

    log "Script: $SCRIPT_NAME"
    log "Repository: $REPO_ROOT"
    log "Validator: $VALIDATOR_PATH"

    assert_validator

    TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/medorbits-commit-test.XXXXXX")"
    trap cleanup EXIT

    run_valid_cases
    run_invalid_cases
    print_summary

    if ((FAILED > 0)); then
        log "Some commit message validator tests failed."
        exit 1
    fi

    log "All commit message validator tests passed."
}

main "$@"
