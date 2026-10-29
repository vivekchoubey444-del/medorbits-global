
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- Commit Message Validator Test Suite
# File: .github/scripts/test-validate-commit-message.sh
# Version: 2.1.2
# Bash: 4+
#
# Contract:
#   Validator argument 1 is a commit-message file.
#   Exit 0 means valid; exit 1 means invalid; exit 2 means usage/configuration
#   error.
#
# Safety:
#   No commits, Git-history changes, dependency installs, or source edits.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_NAME="test-validate-commit-message.sh"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd -P)"

VERBOSE=0
STRICT=0
PASSED=0
FAILED=0
SKIPPED=0
TEMP_DIR=""
VALIDATOR_PATH="${VALIDATOR_PATH:-$SCRIPT_DIR/validate-commit-message.sh}"
TEST_TIMEOUT="${TEST_TIMEOUT:-10}"

log()  { printf '[TEST] %s\n' "$*"; }
pass() { PASSED=$((PASSED + 1)); printf '[PASS] %s\n' "$*"; }
fail() { FAILED=$((FAILED + 1)); printf '[FAIL] %s\n' "$*" >&2; }
skip() { SKIPPED=$((SKIPPED + 1)); printf '[SKIP] %s\n' "$*"; }

die() {
    printf '[ERROR] %s\n' "$*" >&2
    exit 2
}

usage() {
    cat <<'HELP'
MedOrbits Commit Message Validator -- Test Suite

Options:
  --verbose, -v   Display validator output for each case.
  --strict        Treat skipped checks as failures.
  --help, -h      Show this help.

Environment:
  VALIDATOR_PATH  Validator script path (default: sibling validator).
  TEST_TIMEOUT   Positive timeout in seconds (default: 10).

Examples:
  bash .github/scripts/test-validate-commit-message.sh
  bash .github/scripts/test-validate-commit-message.sh --verbose
  VALIDATOR_PATH=.github/scripts/validate-commit-message.sh \
    bash .github/scripts/test-validate-commit-message.sh
HELP
}

cleanup() {
    local status=$?
    trap - EXIT

    if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
        if ! rm -rf -- "$TEMP_DIR"; then
            printf '[WARN] Temporary directory cleanup failed.\n' >&2
            if (( status == 0 )); then
                status=1
            fi
        fi
    fi

    exit "$status"
}

parse_args() {
    while (($#)); do
        case "$1" in
            --verbose|-v)
                VERBOSE=1
                ;;
            --strict)
                STRICT=1
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                die "Unknown option: $1"
                ;;
        esac
        shift
    done
}

resolve_validator() {
    local candidate="$VALIDATOR_PATH"

    if [[ "$candidate" != /* ]]; then
        candidate="$REPO_ROOT/$candidate"
    fi

    if [[ ! -f "$candidate" || ! -r "$candidate" ]]; then
        die "Validator not found or unreadable: $candidate"
    fi

    VALIDATOR_PATH="$(
        cd -- "$(dirname -- "$candidate")" &&
        pwd -P
    )/$(basename -- "$candidate")"

    if ! bash -n "$VALIDATOR_PATH"; then
        die "Validator contains Bash syntax errors."
    fi

    pass "Validator exists and passes Bash syntax validation"
}

validate_test_environment() {
    [[ "$TEST_TIMEOUT" =~ ^[1-9][0-9]*$ ]] ||
        die "TEST_TIMEOUT must be a positive integer."

    if ! command -v awk >/dev/null 2>&1; then
        die "Required command 'awk' is unavailable."
    fi

    if ! command -v sed >/dev/null 2>&1; then
        die "Required command 'sed' is unavailable."
    fi

    if ! command -v timeout >/dev/null 2>&1; then
        if (( STRICT )); then
            die "The timeout command is required in strict mode."
        fi
        skip "Timeout protection unavailable; validator calls are unbounded"
    fi

    TEMP_DIR="$(
        mktemp -d "${TMPDIR:-/tmp}/medorbits-commit-test.XXXXXXXX"
    )" || die "Unable to create private temporary directory."

    chmod 700 "$TEMP_DIR"
    trap cleanup EXIT
}

run_validator() {
    local input_file="$1"
    local output_file="$2"

    if command -v timeout >/dev/null 2>&1; then
        timeout --signal=TERM --kill-after=2 "$TEST_TIMEOUT" \
            bash "$VALIDATOR_PATH" "$input_file" >"$output_file" 2>&1
    else
        bash "$VALIDATOR_PATH" "$input_file" >"$output_file" 2>&1
    fi
}

run_case() {
    local label="$1"
    local expected="$2"
    local message="$3"
    local case_id
    local input_file
    local output_file
    local actual=0

    case_id="case-$((PASSED + FAILED + SKIPPED + 1))"
    input_file="$TEMP_DIR/$case_id.message"
    output_file="$TEMP_DIR/$case_id.output"

    printf '%s\n' "$message" > "$input_file"
    : > "$output_file"

    if run_validator "$input_file" "$output_file"; then
        actual=0
    else
        actual=$?
    fi

    if (( VERBOSE )); then
        printf '\n--- %s ---\n' "$label"
        printf 'Expected: %s\n' "$expected"
        printf 'Actual exit code: %s\n' "$actual"
        sed -n '1,20p' "$output_file" || true
        printf '%s\n' '--------------------'
    fi

    if (( actual == 124 || actual == 137 )); then
        fail "$label (validator timed out or was forcibly terminated)"
        return
    fi

    if [[ "$expected" == "valid" && "$actual" -eq 0 ]]; then
        pass "$label"
    elif [[ "$expected" == "invalid" && "$actual" -eq 1 ]]; then
        pass "$label"
    else
        fail "$label (expected $expected; got exit code $actual)"
        if (( ! VERBOSE )); then
            sed -n '1,8p' "$output_file" >&2 || true
        fi
    fi
}

run_valid_cases() {
    log "Valid message cases"

    run_case "Feature with scope" valid "feat(auth): add session refresh support"
    run_case "Fix with scope" valid "fix(api): handle missing request body"
    run_case "Documentation" valid "docs(readme): explain local setup"
    run_case "Style" valid "style(css): normalize heading spacing"
    run_case "Refactor" valid "refactor(routes): simplify route registration"
    run_case "Performance" valid "perf(search): reduce repeated database queries"
    run_case "Test" valid "test(auth): cover expired access tokens"
    run_case "Build" valid "build(deps): update build tooling"
    run_case "CI" valid "ci(github): validate pull request workflow"
    run_case "Chore" valid "chore(config): organize application settings"
    run_case "Revert without scope" valid "revert: restore previous route behavior"
    run_case "Security" valid "security(api): reject malformed authorization headers"
    run_case "Issue reference in subject" valid "fix(login): handle timeout for issue #123"
    run_case "Hyphenated scope" valid "feat(study-abroad): add course comparison"
    run_case "Subject containing punctuation" valid "docs(api): document /health endpoint"
    run_case "Uppercase subject text" valid "fix(auth): Handle expired sessions"
    run_case "Colon in subject" valid "fix(api): handle errors: safely"
    run_case "Subject exactly 100 characters" valid \
        "feat: $(printf '%099d' 0 | tr '0' 'a')"
}

run_invalid_cases() {
    log "Invalid message cases"

    run_case "Empty message" invalid ""
    run_case "Missing type" invalid "add login validation"
    run_case "Missing colon" invalid "feat(auth) add login validation"
    run_case "Missing subject" invalid "feat(auth):"
    run_case "Uppercase type" invalid "FEAT(auth): add login validation"
    run_case "Whitespace before colon" invalid "feat(auth) : add login validation"
    run_case "Leading whitespace" invalid " feat(auth): add login validation"
    run_case "Trailing whitespace" invalid "feat(auth): add login validation "
    run_case "Unsupported type" invalid "unknown(auth): add login validation"
    run_case "Malformed scope" invalid "feat(auth: add login validation"
    run_case "Empty scope" invalid "feat(): add login validation"
    run_case "Whitespace in scope" invalid "feat(user auth): add login validation"
    run_case "Newline-only message" invalid $'\n\n'
    run_case "Comment-only message" invalid "# Please enter a commit message"
    run_case "Merge message" invalid "Merge branch 'feature/login' into main"
    run_case "Fixup message" invalid "fixup! feat(auth): add login validation"
    run_case "Squash message" invalid "squash! feat(auth): add login validation"
    run_case "Amend message" invalid "amend! feat(auth): add login validation"
    run_case "Subject begins with period" invalid "feat(auth): .add login validation"
    run_case "Subject begins with whitespace" invalid "feat(auth):  add login validation"
    run_case "Missing space after colon" invalid "feat(auth):add login validation"
    run_case "Bare type and colon" invalid "feat: "
    run_case "Multiple header lines" invalid $'feat(auth): add login\nfix(api): add fallback'
    run_case "Header containing conflict marker" invalid "feat(api): resolve <<<<<<< marker"
}

print_summary() {
    printf '\n========================================\n'
    printf 'MedOrbits Commit Message Test Summary\n'
    printf '========================================\n'
    printf 'Passed:  %s\n' "$PASSED"
    printf 'Failed:  %s\n' "$FAILED"
    printf 'Skipped: %s\n' "$SKIPPED"
    printf '========================================\n'
}

main() {
    parse_args "$@"

    cd "$REPO_ROOT" || die "Cannot enter repository root."

    log "Script: $SCRIPT_NAME"
    log "Repository: $REPO_ROOT"

    resolve_validator
    validate_test_environment

    log "Validator: $VALIDATOR_PATH"
    log "Timeout: ${TEST_TIMEOUT}s"

    run_valid_cases
    run_invalid_cases
    print_summary

    if (( FAILED > 0 )); then
        log "Commit message validator tests failed."
        exit 1
    fi

    if (( STRICT && SKIPPED > 0 )); then
        log "Strict mode rejects skipped checks."
        exit 1
    fi

    log "All commit message validator tests passed."
}

main "$@"
