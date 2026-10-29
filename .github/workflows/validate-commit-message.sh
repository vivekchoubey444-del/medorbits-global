
#!/usr/bin/env bash
set -Eeuo pipefail

# Usage:
#   scripts/validate-commit-message.sh "feat(auth): add login validation"
#   scripts/validate-commit-message.sh --file .git/COMMIT_EDITMSG

message=""

if [[ "${1:-}" == "--file" ]]; then
  if [[ $# -ne 2 || ! -f "$2" ]]; then
    echo "Usage: $0 --file PATH" >&2
    exit 2
  fi
  message="$(cat -- "$2")"
elif [[ $# -eq 1 ]]; then
  message="$1"
else
  echo "Usage: $0 MESSAGE | --file PATH" >&2
  exit 2
fi

# Normalize CRLF to LF.
message="${message//$'\r'/}"

# Reject an empty message.
if [[ -z "${message//[$' \t\n']/}" ]]; then
  echo "ERROR: Commit message is empty." >&2
  exit 1
fi

# Leading whitespace is invalid.
if [[ "$message" =~ ^[[:space:]] ]]; then
  echo "ERROR: Commit message has leading whitespace." >&2
  exit 1
fi

# Ignore comment lines commonly added by Git editors.
filtered=""
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" == \#* ]] && continue
  if [[ -n "$filtered" ]]; then
    filtered+=$'\n'
  fi
  filtered+="$line"
done <<< "$message"

message="$filtered"

if [[ -z "${message//[$' \t\n']/}" ]]; then
  echo "ERROR: Commit message contains only comments or whitespace." >&2
  exit 1
fi

# First non-comment line is the subject.
subject="${message%%$'\n'*}"

if [[ -z "$subject" ]]; then
  echo "ERROR: Commit subject is empty." >&2
  exit 1
fi

if [[ "$subject" == .* ]]; then
  echo "ERROR: Commit subject must not begin with a period." >&2
  exit 1
fi

if [[ "$subject" =~ ^[[:space:]] || "$subject" =~ [[:space:]]$ ]]; then
  echo "ERROR: Commit subject has leading or trailing whitespace." >&2
  exit 1
fi

if [[ "$subject" == *$'\t'* ]]; then
  echo "ERROR: Commit subject must not contain tabs." >&2
  exit 1
fi

# Conventional Commit format:
# type(scope): subject
# type: subject
if [[ ! "$subject" =~ ^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-zA-Z0-9._/-]+\))?:[[:space:]]+[^[:space:]].*$ ]]; then
  echo "ERROR: Invalid Conventional Commit subject." >&2
  echo "Example: feat(auth): add login validation" >&2
  exit 1
fi

# Validate header/body separation. If a body exists, it must start
# after a blank line; multiple adjacent header lines are not allowed.
if [[ "$message" == *$'\n'* ]]; then
  rest="${message#*$'\n'}"

  if [[ -n "$rest" && "$rest" != $'\n'* ]]; then
    echo "ERROR: Add a blank line between subject and body." >&2
    exit 1
  fi
fi

echo "VALID: $subject"
