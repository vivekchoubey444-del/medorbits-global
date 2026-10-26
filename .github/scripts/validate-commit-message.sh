#!/usr/bin/env bash
# ============================================================
# MedOrbits Commit Message Validator
# File: .github/scripts/validate-commit-message.sh
#
# Purpose:
#   Validate commit messages against a consistent convention.
#
# Format:
#   type(scope): subject
#   type: subject
#
# Examples:
#   feat(auth): add session refresh support
#   fix(api): handle missing request body
#   docs: update installation guide
#   security(api): validate authorization headers
#
# Supported types:
#   feat, fix, docs, style, refactor, perf, test, build,
#   ci, chore, revert, security
#
# Usage:
#   bash .github/scripts/validate-commit-message.sh MESSAGE_FILE
#   git log -1 --format=%s | ...
#
# Exit codes:
#   0 = valid
#   1 = invalid commit message
#   2 = usage or configuration error
#
# Safety:
#   - Read-only validation.
#   - Does not create commits or modify Git history.
#   - Does not print environment variables or secret values.
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
readonly SCRIPT_NAME="validate-commit-message.sh"
readonly MAX_SUBJECT_LENGTH=100
usage() {
    cat <<'USAGE'
Commit Message Validator
Usage:
  bash .github/scripts/validate-commit-message.sh MESSAGE_FILE
  bash .github/scripts/validate-commit-message.sh --help
Expected format:
  type(scope): subject
  type: subject
Valid types:
  feat fix docs style refactor perf test build ci chore revert security
Rules:
  - Type must be lowercase.
  - Scope is optional and must use parentheses.
  - A colon and one space must separate the header from the subject.
  - Subject must be non-empty and must not start or end with whitespace.
  - Subject must not exceed 100 characters.
  - Merge, fixup, and squash messages are rejected.
  - The message file must be readable.
The first line is treated as the commit header. Additional lines
are allowed for a body and footer.
USAGE
}
fail() {
    printf '[COMMIT-MSG] INVALID: %s\n' "$*" >&2
    exit 1
}
usage_error() {
    printf '[COMMIT-MSG] ERROR: %s\n' "$*" >&2
    exit 2
}
if (($# == 1)) && [[ "$1" == "--help" || "$1" == "-h" ]]; then
    usage
    exit 0
fi
if (($# != 1)); then
    usage_error "Expected exactly one commit-message file path."
fi
MESSAGE_FILE="$1"
[[ -f "$MESSAGE_FILE" ]] ||
    usage_error "Commit-message file does not exist or is not a regular file."
[[ -r "$MESSAGE_FILE" ]] ||
    usage_error "Commit-message file is not readable."
if ! command -v awk >/dev/null 2>&1; then
    usage_error "Required command 'awk' is unavailable."
fi
# Read only the first line as the commit header.
HEADER="$(awk 'NR == 1 { print; exit }' "$MESSAGE_FILE")"
[[ -n "$HEADER" ]] ||
    fail "Commit header is empty."
# Reject leading or trailing whitespace in the header.
if [[ "$HEADER" =~ ^[[:space:]] || "$HEADER" =~ [[:space:]]$ ]]; then
    fail "Header must not start or end with whitespace."
fi
# Reject common automatically generated commit-message forms.
case "$HEADER" in
    "Merge "*|"Merge "*)
        fail "Merge commit messages are not accepted by this policy."
        ;;
    "fixup! "*|"squash! "*|"amend! "*)
        fail "Fixup, squash, and amend messages are not accepted."
        ;;
esac
# Reject common conflict-marker remnants.
if [[ "$HEADER" == *"<<<<<<<"* ||
      "$HEADER" == *">>>>>>>"* ||
      "$HEADER" == *"======="* ]]; then
    fail "Header contains a possible conflict marker."
fi
# Parse the conventional commit header:
# type(scope): subject
# type: subject
#
# The scope may contain letters, digits, dots, underscores, or hyphens.
# Subject must begin with a non-whitespace character.
HEADER_REGEX='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|security)(\([A-Za-z0-9._/-]+\))?: [^[:space:]].*$'
if [[ ! "$HEADER" =~ $HEADER_REGEX ]]; then
    fail "Expected 'type(scope): subject' or 'type: subject' using a supported lowercase type."
fi
# Extract the subject after the first colon-space delimiter.
SUBJECT="${HEADER#*: }"
[[ -n "$SUBJECT" ]] ||
    fail "Subject must not be empty."
if [[ "$SUBJECT" =~ [[:space:]]$ ]]; then
    fail "Subject must not end with whitespace."
fi
# Use character count rather than byte count when supported by the locale.
SUBJECT_LENGTH="$(LC_ALL="${LC_CTYPE:-${LANG:-C}}" awk -v text="$SUBJECT" 'BEGIN { print length(text) }')"
if [[ ! "$SUBJECT_LENGTH" =~ ^[0-9]+$ ]]; then
    usage_error "Could not determine subject length."
fi
if ((SUBJECT_LENGTH > MAX_SUBJECT_LENGTH)); then
    fail "Subject is ${SUBJECT_LENGTH} characters; maximum is ${MAX_SUBJECT_LENGTH}."
fi
# Reject subjects that consist solely of punctuation.
if [[ ! "$SUBJECT" =~ [[:alnum:]] ]]; then
    fail "Subject must contain at least one letter or digit."
fi
# Check for accidental blank header lines in the first position.
if [[ "$HEADER" == *$'\r' ]]; then
    fail "Header contains a carriage return; normalize line endings."
fi
printf '[COMMIT-MSG] VALID: %s\n' "$HEADER"
exit 0