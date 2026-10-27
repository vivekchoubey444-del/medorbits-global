
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits Commit Message Validator
# File: .github/scripts/validate-commit-message.sh
# Release target: 2.0.0
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
#   bash .github/scripts/validate-commit-message.sh --help
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
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_NAME="validate-commit-message.sh"
readonly MAX_SUBJECT_LENGTH=100

usage() {
    cat <<'USAGE'
MedOrbits Commit Message Validator

Usage:
  bash .github/scripts/validate-commit-message.sh MESSAGE_FILE
  bash .github/scripts/validate-commit-message.sh --help

Expected format:
  type(scope): subject
  type: subject

Valid types:
  feat fix docs style refactor perf test build ci chore revert security

Rules:
  - Type must be lowercase and supported.
  - Scope is optional and must use parentheses.
  - Scope may contain letters, digits, dots, underscores, hyphens, or slashes.
  - A colon followed by exactly one space separates header and subject.
  - Subject must be non-empty.
  - Subject must not start or end with whitespace.
  - Subject must not exceed 100 characters.
  - Subject must contain at least one letter or digit.
  - Merge, fixup, squash, and amend messages are rejected.
  - Obvious conflict markers in the header are rejected.
  - The message file must be a readable regular file.

The first line is treated as the commit header.
Additional lines are allowed for a body and footer.

Exit codes:
  0  Valid commit message
  1  Invalid commit message
  2  Usage or configuration error
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

command -v awk >/dev/null 2>&1 ||
    usage_error "Required command 'awk' is unavailable."

# Read the first line without silently accepting CRLF line endings.
HEADER="$(awk 'NR == 1 { sub(/\r$/, ""); print; exit }' "$MESSAGE_FILE")"

# Explicitly reject CRLF in the original first line.
if IFS= read -r RAW_HEADER < "$MESSAGE_FILE"; then
    :
else
    RAW_HEADER=""
fi

if [[ "$RAW_HEADER" == *$'\r' ]]; then
    fail "Header contains a carriage return; normalize line endings."
fi

[[ -n "$HEADER" ]] ||
    fail "Commit header is empty."

# Reject leading or trailing whitespace.
if [[ "$HEADER" =~ ^[[:space:]] || "$HEADER" =~ [[:space:]]$ ]]; then
    fail "Header must not start or end with whitespace."
fi

# Reject common automatically generated commit-message forms.
case "$HEADER" in
    "Merge "*)
        fail "Merge commit messages are not accepted by this policy."
        ;;
    "fixup! "*|"squash! "*|"amend! "*)
        fail "Fixup, squash, and amend messages are not accepted."
        ;;
esac

# Reject obvious conflict-marker remnants.
if [[ "$HEADER" == *"<<<<<<<"* ||
      "$HEADER" == *">>>>>>>"* ||
      "$HEADER" == *"======="* ]]; then
    fail "Header contains a possible conflict marker."
fi

# Conventional commit header:
# type(scope): subject
# type: subject
#
# Scope characters: letters, digits, dots, underscores, hyphens, slashes.
HEADER_REGEX='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|security)(\([A-Za-z0-9._/-]+\))?: [^[:space:]].*$'

if [[ ! "$HEADER" =~ $HEADER_REGEX ]]; then
    fail "Expected 'type(scope): subject' or 'type: subject' using a supported lowercase type."
fi

# Remove the type and optional scope, preserving colons in the subject.
SUBJECT="${HEADER#*: }"

[[ -n "$SUBJECT" ]] ||
    fail "Subject must not be empty."

if [[ "$SUBJECT" =~ [[:space:]]$ ]]; then
    fail "Subject must not end with whitespace."
fi

# Count characters using the current locale.
SUBJECT_LENGTH="$(
    LC_ALL="${LC_CTYPE:-${LANG:-C}}" \
        awk -v text="$SUBJECT" 'BEGIN { print length(text) }'
)"

if [[ ! "$SUBJECT_LENGTH" =~ ^[0-9]+$ ]]; then
    usage_error "Could not determine subject length."
fi

if ((SUBJECT_LENGTH > MAX_SUBJECT_LENGTH)); then
    fail "Subject is ${SUBJECT_LENGTH} characters; maximum is ${MAX_SUBJECT_LENGTH}."
fi

# Require at least one letter or digit in the subject.
if [[ ! "$SUBJECT" =~ [[:alnum:]] ]]; then
    fail "Subject must contain at least one letter or digit."
fi

printf '[COMMIT-MSG] VALID: %s\n' "$HEADER"
exit 0
