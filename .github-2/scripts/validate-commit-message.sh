
#!/bin/sh
# ==============================================================================
# MedOrbits -- Commit Message Validator
#
# File: .github/scripts/validate-commit-message.sh
# Version: 2.2.0
#
# Purpose:
#   Validate the first non-empty, non-comment commit subject using the
#   Conventional Commits format.
#
# Accepted formats:
#   type: description
#   type(scope): description
#   type!: description
#   type(scope)!: description
#
# Supported types:
#   feat, fix, docs, style, refactor, perf, test, build,
#   ci, chore, revert
#
# Scope characters:
#   Letters, digits, dots, underscores, slashes and hyphens.
#
# Configuration:
#   MAX_SUBJECT_LENGTH  Maximum subject length; default 100
#   VERBOSE             1 for detailed reporting; default 0
#
# Requirements:
#   POSIX shell, awk, sed, grep, wc, tr
#
# Exit codes:
#   0  Validation successful
#   1  Invalid commit subject
#   2  Invalid arguments, configuration or input file
#
# Note:
#   Only the first non-empty, non-comment line is validated.
#   Commit bodies and footers are not validated.
# ==============================================================================

set -eu

PROGRAM_NAME=${0##*/}
DEFAULT_MAX_LENGTH=100
MAX_SUBJECT_LENGTH=${MAX_SUBJECT_LENGTH:-$DEFAULT_MAX_LENGTH}
VERBOSE=${VERBOSE:-0}

# ------------------------------------------------------------------------------
# Output helpers
# ------------------------------------------------------------------------------

info() {
    printf '%s\n' "$*"
}

error() {
    printf 'ERROR: %s\n' "$*" >&2
}

fail() {
    error "$1"
    exit "${2:-1}"
}

usage() {
    cat <<EOF
MedOrbits Commit Message Validator 2.2.0

Usage:
  $PROGRAM_NAME <commit-message-file>
  $PROGRAM_NAME --help
  $PROGRAM_NAME --version

Environment variables:
  MAX_SUBJECT_LENGTH  Maximum subject length (default: 100)
  VERBOSE             1 enables detailed reporting (default: 0)

Examples:
  $PROGRAM_NAME .git/COMMIT_EDITMSG
  MAX_SUBJECT_LENGTH=120 $PROGRAM_NAME .git/COMMIT_EDITMSG
  VERBOSE=1 $PROGRAM_NAME .git/COMMIT_EDITMSG
EOF
}

# ------------------------------------------------------------------------------
# 1. Parse arguments
# ------------------------------------------------------------------------------

if [ "$#" -ne 1 ]; then
    if [ "$#" -eq 0 ]; then
        usage >&2
        exit 2
    fi

    fail "Exactly one argument is required. Use --help for usage." 2
fi

case "$1" in
    --help|-h)
        usage
        exit 0
        ;;
    --version|-V)
        info "$PROGRAM_NAME 2.2.0"
        exit 0
        ;;
    "")
        fail "The commit message file path must not be empty." 2
        ;;
    -*)
        fail "Unknown option: $1. Use --help for usage." 2
        ;;
esac

commit_msg_file=$1

if [ ! -f "$commit_msg_file" ]; then
    fail "Commit message file does not exist or is not a regular file: $commit_msg_file" 2
fi

if [ ! -r "$commit_msg_file" ]; then
    fail "Commit message file is not readable: $commit_msg_file" 2
fi

# ------------------------------------------------------------------------------
# 2. Validate configuration
# ------------------------------------------------------------------------------

case "$MAX_SUBJECT_LENGTH" in
    ""|*[!0-9]*)
        fail "MAX_SUBJECT_LENGTH must contain only decimal digits." 2
        ;;
esac

# Normalize leading zeros without relying on shell octal arithmetic.
normalized_length=$(printf '%s\n' "$MAX_SUBJECT_LENGTH" | sed 's/^0*//')

if [ -z "$normalized_length" ]; then
    fail "MAX_SUBJECT_LENGTH must be greater than zero." 2
fi

# Prevent excessively large values and arithmetic overflow.
if [ "${#normalized_length}" -gt 6 ]; then
    fail "MAX_SUBJECT_LENGTH is unreasonably large (maximum: 999999)." 2
fi

MAX_SUBJECT_LENGTH=$normalized_length

if [ "$MAX_SUBJECT_LENGTH" -lt 1 ]; then
    fail "MAX_SUBJECT_LENGTH must be greater than zero." 2
fi

case "$VERBOSE" in
    0|1)
        ;;
    *)
        fail "VERBOSE must be either 0 or 1." 2
        ;;
esac

# ------------------------------------------------------------------------------
# 3. Extract the first non-empty, non-comment subject
#
# Ignore blank lines and Git comment lines beginning with optional whitespace
# followed by '#'. Remove trailing CR characters for CRLF compatibility.
# ------------------------------------------------------------------------------

commit_msg=$(
    awk '
        {
            sub(/\r$/, "")
        }

        /^[[:space:]]*#/ {
            next
        }

        /^[[:space:]]*$/ {
            next
        }

        {
            print
            exit
        }
    ' "$commit_msg_file"
) || fail "Could not read the commit message file." 2

if [ -z "$commit_msg" ]; then
    fail "Commit message is empty or contains only blank/comment lines." 1
fi

# ------------------------------------------------------------------------------
# 4. Reject leading/trailing whitespace
# ------------------------------------------------------------------------------

trimmed_msg=$(
    printf '%s\n' "$commit_msg" |
        sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
) || fail "Could not normalize the commit subject." 2

if [ "$commit_msg" != "$trimmed_msg" ]; then
    fail "The commit subject must not start or end with whitespace." 1
fi

# ------------------------------------------------------------------------------
# 5. Reject control characters
#
# Use the C locale for a consistent ASCII control-character check.
# The extracted subject is one line; embedded tabs and other control
# characters are rejected.
# ------------------------------------------------------------------------------

if printf '%s' "$commit_msg" |
    LC_ALL=C grep '[[:cntrl:]]' >/dev/null 2>&1; then
    fail "Commit subject contains an unsupported control character." 1
fi

# ------------------------------------------------------------------------------
# 6. Validate Conventional Commits structure
#
# Accepted:
#   feat(auth): add email verification
#   fix(api): handle missing application ID
#   docs: update installation guide
#   chore(deps): update dependencies
#   feat(api)!: remove deprecated endpoint
#   feat!: change public API
#
# Exactly one ordinary space must follow the colon.
# The description must begin with a non-whitespace character.
# ------------------------------------------------------------------------------

commit_pattern='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([[:alnum:]._/-]+\))?!?: [^[:space:]].*$'

if ! printf '%s\n' "$commit_msg" |
    grep -E "$commit_pattern" >/dev/null 2>&1; then

    cat >&2 <<'EOF'
ERROR: Invalid commit subject format.

Required formats:
  type: description
  type(scope): description
  type!: description
  type(scope)!: description

Allowed types:
  feat, fix, docs, style, refactor, perf,
  test, build, ci, chore, revert

Scope characters:
  Letters, digits, dots, underscores, slashes and hyphens.

Valid examples:
  feat(auth): add email verification
  fix(api): handle missing application ID
  docs: update installation guide
  chore(deps): update dependencies
  feat(api)!: remove deprecated endpoint
  feat!: change public API

Check that:
  - The type is supported and lowercase.
  - Scope parentheses are balanced and non-empty.
  - The breaking-change marker appears before the colon.
  - Exactly one ordinary space follows the colon.
  - The description does not begin with whitespace.
  - The description contains at least one letter or digit.
EOF
    exit 1
fi

# ------------------------------------------------------------------------------
# 7. Extract type and description after structural validation
# ------------------------------------------------------------------------------

commit_type=$(
    printf '%s\n' "$commit_msg" |
        sed 's/^\([a-z][a-z]*\).*/\1/'
) || fail "Could not extract the commit type." 2

description=$(
    printf '%s\n' "$commit_msg" |
        sed 's/^[^:]*: //'
) || fail "Could not extract the commit description." 2

if [ -z "$description" ]; then
    fail "Commit description must not be empty." 1
fi

if ! printf '%s\n' "$description" |
    LC_ALL=C grep '[[:alnum:]]' >/dev/null 2>&1; then
    fail "Commit description must contain at least one ASCII letter or digit." 1
fi

# ------------------------------------------------------------------------------
# 8. Enforce subject length
#
# wc -m counts characters according to the active locale. If the locale does
# not support multibyte characters, non-ASCII text may be counted as bytes.
# ------------------------------------------------------------------------------

subject_length=$(
    printf '%s' "$commit_msg" |
        wc -m |
        tr -d '[:space:]'
) || fail "Could not determine the commit subject length." 2

case "$subject_length" in
    ""|*[!0-9]*)
        fail "Could not determine a valid commit subject length." 2
        ;;
esac

if [ "$subject_length" -gt "$MAX_SUBJECT_LENGTH" ]; then
    error "Commit subject exceeds the maximum permitted length."
    error "Current length: $subject_length characters"
    error "Maximum length: $MAX_SUBJECT_LENGTH characters"
    exit 1
fi

# ------------------------------------------------------------------------------
# 9. Optional verbose reporting
# ------------------------------------------------------------------------------

if [ "$VERBOSE" -eq 1 ]; then
    info "Commit subject: $commit_msg"
    info "Commit type: $commit_type"
    info "Description: $description"
    info "Subject length: $subject_length characters"
fi

# ------------------------------------------------------------------------------
# 10. Report success
# ------------------------------------------------------------------------------

info "Commit message format validated."
info "Subject length: $subject_length/$MAX_SUBJECT_LENGTH characters"

exit 0
