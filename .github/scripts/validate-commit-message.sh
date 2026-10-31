
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- Commit Message Validator
# File: .github/scripts/validate-commit-message.sh
# Release: 2.1.3
# Bash: 4+
#
# Format:
#   type(scope): subject
#   type: subject
#
# Exit codes:
#   0 = valid commit message
#   1 = invalid commit message
#   2 = usage or configuration error
#
# Safety:
#   Read-only validation. Does not modify files or Git history.
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

Format:
  type(scope): subject
  type: subject

Supported types:
  feat fix docs style refactor perf test build ci chore revert security

Rules:
  - Type must be lowercase and supported.
  - Scope is optional.
  - Scope allows letters, digits, dots, underscores, hyphens and slashes.
  - Exactly one space must follow the header colon.
  - Subject must begin with a letter or digit.
  - Subject must be non-empty.
  - Subject must not contain leading or trailing whitespace.
  - Subject maximum length is 100 characters.
  - Merge, fixup, squash and amend headers are rejected.
  - The first line is the header.
  - Subsequent lines may contain a commit body or footer.
  - Input must be a readable regular file.

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

# ----------------------------------------------------------------
# ARGUMENT VALIDATION
# ----------------------------------------------------------------

if (($# == 1)) &&
   [[ "$1" == "--help" || "$1" == "-h" ]]; then
    usage
    exit 0
fi

if (($# != 1)); then
    usage_error "Expected exactly one commit-message file path."
fi

readonly MESSAGE_FILE="$1"

[[ -f "$MESSAGE_FILE" ]] ||
    usage_error "Commit-message file does not exist or is not a regular file."

[[ -r "$MESSAGE_FILE" ]] ||
    usage_error "Commit-message file is not readable."

command -v awk >/dev/null 2>&1 ||
    usage_error "Required command 'awk' is unavailable."

command -v sed >/dev/null 2>&1 ||
    usage_error "Required command 'sed' is unavailable."

# ----------------------------------------------------------------
# READ COMMIT HEADER
# ----------------------------------------------------------------

RAW_HEADER=""

if IFS= read -r RAW_HEADER < "$MESSAGE_FILE"; then
    :
else
    # Accept a final line without a newline.
    :
fi

if [[ "$RAW_HEADER" == *$'\r'* ]]; then
    fail "Header contains a carriage return; normalize line endings."
fi

HEADER="$RAW_HEADER"

[[ -n "$HEADER" ]] ||
    fail "Commit header is empty."

if [[ "$HEADER" =~ ^[[:space:]] ]]; then
    fail "Header must not start with whitespace."
fi

if [[ "$HEADER" =~ [[:space:]]$ ]]; then
    fail "Header must not end with whitespace."
fi

# ----------------------------------------------------------------
# REJECT SPECIAL COMMIT HEADERS
# ----------------------------------------------------------------

case "$HEADER" in
    "Merge "*)
        fail "Merge commit messages are not accepted."
        ;;

    "fixup! "*|"squash! "*|"amend! "*)
        fail "Fixup, squash and amend messages are not accepted."
        ;;
esac

# ----------------------------------------------------------------
# CONFLICT MARKER VALIDATION
# ----------------------------------------------------------------

if [[ "$HEADER" == *"<<<<<<<"* ||
      "$HEADER" == *">>>>>>>"* ||
      "$HEADER" == *"======="* ]]; then

    fail "Header contains a possible conflict marker."
fi

# ----------------------------------------------------------------
# CONVENTIONAL COMMIT HEADER VALIDATION
# ----------------------------------------------------------------

HEADER_REGEX='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|security)(\([A-Za-z0-9._/-]+\))?: [^[:space:]].*$'

if [[ ! "$HEADER" =~ $HEADER_REGEX ]]; then
    fail "Expected 'type(scope): subject' or 'type: subject' with a supported lowercase type."
fi

# ----------------------------------------------------------------
# EXTRACT SUBJECT
# ----------------------------------------------------------------

SUBJECT="$(
    printf '%s\n' "$HEADER" |
        sed -E 's/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|security)(\([A-Za-z0-9._/-]+\))?: //'
)"

[[ -n "$SUBJECT" ]] ||
    fail "Subject must not be empty."

# ----------------------------------------------------------------
# SUBJECT VALIDATION
# ----------------------------------------------------------------

if [[ "$SUBJECT" =~ ^[[:space:]] ]]; then
    fail "Subject must not start with whitespace."
fi

if [[ "$SUBJECT" =~ [[:space:]]$ ]]; then
    fail "Subject must not end with whitespace."
fi

# Require the first character to be a letter or digit.
if [[ ! "$SUBJECT" =~ ^[[:alnum:]] ]]; then
    fail "Subject must begin with a letter or digit."
fi

if [[ ! "$SUBJECT" =~ [[:alnum:]] ]]; then
    fail "Subject must contain at least one letter or digit."
fi

# ----------------------------------------------------------------
# SUBJECT LENGTH
# ----------------------------------------------------------------

SUBJECT_LENGTH="$(
    LC_ALL=C awk -v text="$SUBJECT" \
        'BEGIN { print length(text) }'
)"

if [[ ! "$SUBJECT_LENGTH" =~ ^[0-9]+$ ]]; then
    usage_error "Could not determine subject length."
fi

if (( SUBJECT_LENGTH > MAX_SUBJECT_LENGTH )); then
    fail "Subject is ${SUBJECT_LENGTH} characters; maximum is ${MAX_SUBJECT_LENGTH}."
fi

# ----------------------------------------------------------------
# SUCCESS
# ----------------------------------------------------------------

printf '[COMMIT-MSG] VALID: %s\n' "$HEADER"

exit 0
