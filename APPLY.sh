#!/usr/bin/env bash
# Usage:
#   bash APPLY.sh /path/to/fixed
#   bash APPLY.sh .
#
# Run from anywhere inside your MedOrbits Git working copy.
set -Eeuo pipefail
die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}
[[ $# -le 1 ]] || die "Usage: bash APPLY.sh [source-directory]"
SOURCE_INPUT="${1:-.}"
[[ -d "$SOURCE_INPUT" ]] || die "Source directory does not exist: $SOURCE_INPUT"
SRC="$(cd "$SOURCE_INPUT" && pwd -P)" ||
  die "Cannot resolve source directory."
REPO="$(git rev-parse --show-toplevel 2>/dev/null)" ||
  die "Run this script from inside a Git working copy."
REPO="$(cd "$REPO" && pwd -P)"
# Avoid accidentally copying the repository into itself.
if [[ "$SRC" == "$REPO" ]]; then
  printf 'Source and repository are the same directory.\n'
  printf 'No file copy is necessary.\n'
  exit 0
fi
printf 'Source:      %s\n' "$SRC"
printf 'Repository:  %s\n' "$REPO"
printf '\n'
# Copy regular files while preserving relative paths and handling spaces.
while IFS= read -r -d '' file; do
  relative="${file#"$SRC"/}"
  case "$relative" in
    .git|.git/*)
      continue
      ;;
    *.js.md|APPLY.sh.md|APPLY.sh)
      continue
      ;;
  esac
  destination="$REPO/$relative"
  mkdir -p "$(dirname "$destination")"
  cp -p -- "$file" "$destination"
  printf 'Updated: %s\n' "$relative"
done < <(find "$SRC" \
  -type d -name .git -prune -o \
  -type f -print0)
# Remove known stale files only if they are tracked by Git.
cd "$REPO"
for stale_file in eslnt-report.json npm-shrinkwrap.json; do
  if git ls-files --error-unmatch "$stale_file" >/dev/null 2>&1; then
    git rm -f -- "$stale_file"
  elif [[ -f "$stale_file" ]]; then
    rm -- "$stale_file"
    printf 'Removed untracked stale file: %s\n' "$stale_file"
  fi
done
printf '\nFile application completed.\n'
printf 'Review the changes before committing:\n'
git status --short
git diff --check