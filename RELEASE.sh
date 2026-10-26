#!/usr/bin/env bash
# ============================================================
# MedOrbits Safe Release Utility
# File: /RELEASE.sh
#
# Purpose:
#   Inspect, validate, and optionally create a local Git release
#   tag without automatically pushing or deploying.
#
# Safety:
#   - Default mode is preview
#   - Never runs git reset --hard
#   - Never runs git clean
#   - Never commits or pushes
#   - Never deploys automatically
#   - Refuses dirty working trees and unresolved conflicts
#   - Validates the release version and tag availability
#   - Creates a local annotated tag only after confirmation
#
# Usage:
#   bash RELEASE.sh
#   bash RELEASE.sh preview
#   bash RELEASE.sh validate
#   bash RELEASE.sh tag 2.0.0
#   bash RELEASE.sh help
#
# Optional:
#   RELEASE_ALLOW_NON_MAIN=true bash RELEASE.sh validate
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
SCRIPT_NAME="RELEASE.sh"
ROOT=""
MODE="${1:-preview}"
log()  { printf '[RELEASE] %s\n' "$*"; }
warn() { printf '[RELEASE][WARNING] %s\n' "$*" >&2; }
die()  { printf '[RELEASE][ERROR] %s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'HELP'
MedOrbits Safe Release Utility
Usage:
  bash RELEASE.sh
  bash RELEASE.sh preview
  bash RELEASE.sh validate
  bash RELEASE.sh tag VERSION
  bash RELEASE.sh help
Commands:
  preview
      Display the current release readiness information.
  validate
      Validate repository state and available project metadata.
  tag VERSION
      Validate the repository and create a local annotated tag.
      Example: bash RELEASE.sh tag 2.0.0
  help
      Show this help.
Safety:
  - No automatic commit, push, or deployment.
  - Tagging requires a clean working tree and confirmation.
  - Version must be valid semantic version syntax.
  - Existing tags are never overwritten.
  - Default release branch is main.
  - Set RELEASE_ALLOW_NON_MAIN=true to allow another branch.
HELP
}
require_command() {
  command -v "$1" >/dev/null 2>&1 ||
    die "Required command not found: $1"
}
find_root() {
  require_command git
  git rev-parse --show-toplevel 2>/dev/null ||
    die "Run this script inside a Git repository."
}
get_branch() {
  git -C "$ROOT" branch --show-current
}
check_conflicts() {
  local conflicts
  conflicts="$(git -C "$ROOT" diff --name-only --diff-filter=U)"
  if [[ -n "$conflicts" ]]; then
    warn "Unresolved merge conflicts detected:"
    printf '%s\n' "$conflicts"
    return 1
  fi
  return 0
}
check_clean_tree() {
  if [[ -n "$(git -C "$ROOT" status --porcelain)" ]]; then
    warn "Working tree is not clean:"
    git -C "$ROOT" status --short
    warn "Commit or safely preserve your changes before releasing."
    return 1
  fi
  return 0
}
check_branch() {
  local branch
  branch="$(get_branch)"
  if [[ -z "$branch" ]]; then
    die "Detached HEAD detected. Switch to an intended release branch."
  fi
  if [[ "$branch" != "main" &&
        "${RELEASE_ALLOW_NON_MAIN:-false}" != "true" ]]; then
    die "Current branch is '$branch', not 'main'. Use main or explicitly set RELEASE_ALLOW_NON_MAIN=true."
  fi
  log "Release branch: $branch"
}
validate_version() {
  local version="${1:-}"
  [[ -n "$version" ]] ||
    die "A release version is required."
  # Accept versions such as 2.0.0, 2.0.0-rc.1, and 2.0.0+build.4.
  # Require three numeric core components and valid prerelease/build
  # identifier characters.
  if [[ ! "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$ ]]; then
    die "Invalid version '$version'. Use semantic version format, for example 2.0.0."
  fi
  # SemVer numeric prerelease identifiers cannot have leading zeros.
  local prerelease=""
  if [[ "$version" == *-* ]]; then
    prerelease="${version#*-}"
    prerelease="${prerelease%%+*}"
    local identifier
    local IFS='.'
    read -r -a identifiers <<< "$prerelease"
    for identifier in "${identifiers[@]}"; do
      if [[ "$identifier" =~ ^[0-9]+$ &&
            "$identifier" =~ ^0[0-9]+$ ]]; then
        die "Invalid numeric prerelease identifier '$identifier': leading zeros are not allowed."
      fi
    done
  fi
  log "Version syntax: valid ($version)"
}
show_preview() {
  log "Repository: $ROOT"
  log "Branch: $(get_branch)"
  log "HEAD: $(git -C "$ROOT" log -1 --format='%h %s')"
  log "Commit: $(git -C "$ROOT" rev-parse HEAD)"
  printf '\n--- Git status ---\n'
  git -C "$ROOT" status --short --branch
  printf '\n--- Recent commits ---\n'
  git -C "$ROOT" log -5 --oneline --decorate
  printf '\n--- Project metadata ---\n'
  if [[ -f "$ROOT/package.json" ]]; then
    if command -v node >/dev/null 2>&1; then
      node -e '
        const fs = require("fs");
        try {
          const p = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
          console.log("package.json name:", p.name || "(not set)");
          console.log("package.json version:", p.version || "(not set)");
          console.log("scripts:", Object.keys(p.scripts || {}).join(", ") || "(none)");
        } catch (e) {
          console.error("package.json invalid:", e.message);
          process.exitCode = 1;
        }
      ' "$ROOT/package.json" ||
        warn "Could not read package.json metadata."
    else
      warn "Node.js is unavailable; package.json metadata was not parsed."
    fi
  else
    log "No package.json found."
  fi
  if [[ -f "$ROOT/requirements.txt" ]]; then
    log "requirements.txt found."
  fi
  if [[ -f "$ROOT/package-lock.json" ]]; then
    log "package-lock.json found."
  fi
  printf '\n--- Existing latest tags ---\n'
  git -C "$ROOT" tag --sort=-version:refname | head -10 || true
}
run_validation() {
  local failed=0
  log "Validating repository state..."
  check_branch || failed=1
  check_conflicts || failed=1
  check_clean_tree || failed=1
  if [[ -f "$ROOT/package.json" ]]; then
    if command -v node >/dev/null 2>&1; then
      node -e '
        const fs = require("fs");
        const p = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        if (!p || typeof p !== "object" || Array.isArray(p)) {
          throw new Error("package.json must contain a JSON object");
        }
        console.log("package.json syntax: valid");
      ' "$ROOT/package.json" || failed=1
    else
      warn "Node.js not found; package.json validation skipped."
    fi
  fi
  if [[ -f "$ROOT/package-lock.json" ]]; then
    if command -v node >/dev/null 2>&1; then
      node -e '
        const fs = require("fs");
        const lock = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        if (!lock || typeof lock !== "object" || Array.isArray(lock)) {
          throw new Error("package-lock.json must contain a JSON object");
        }
        console.log("package-lock.json syntax: valid");
      ' "$ROOT/package-lock.json" || failed=1
    fi
  elif [[ -f "$ROOT/package.json" ]]; then
    warn "package-lock.json is missing. Confirm the project package-manager strategy."
  fi
  if [[ -f "$ROOT/requirements.txt" ]]; then
    if command -v python3 >/dev/null 2>&1; then
      python3 - "$ROOT/requirements.txt" <<'PY' || failed=1
import pathlib
import sys
path = pathlib.Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
if not text.strip():
    raise SystemExit("requirements.txt is empty")
print("requirements.txt: readable and non-empty")
PY
    else
      warn "Python 3 not found; requirements.txt check skipped."
    fi
  fi
  if [[ "$failed" -ne 0 ]]; then
    die "One or more release validation checks failed."
  fi
  log "Basic validation passed."
  warn "This is not a substitute for the project's complete test suite, security audit, or deployment health checks."
}
create_tag() {
  local version="$1"
  local tag_name="v${version}"
  local confirmation
  validate_version "$version"
  run_validation
  if git -C "$ROOT" rev-parse -q --verify "refs/tags/$tag_name" >/dev/null; then
    die "Tag already exists: $tag_name. Existing tags will not be overwritten."
  fi
  printf '\n--- Release tag plan ---\n'
  printf 'Repository: %s\n' "$ROOT"
  printf 'Branch: %s\n' "$(get_branch)"
  printf 'Commit: %s\n' "$(git -C "$ROOT" rev-parse HEAD)"
  printf 'Tag: %s\n' "$tag_name"
  printf 'Action: create a local annotated Git tag only\n'
  printf 'No push or deployment will occur.\n\n'
  printf 'Type exactly CREATE-%s to continue: ' "$tag_name"
  IFS= read -r confirmation ||
    die "No confirmation received."
  [[ "$confirmation" == "CREATE-$tag_name" ]] ||
    die "Confirmation did not match. No tag created."
  # Recheck immediately before writing the tag.
  check_conflicts ||
    die "Conflicts detected. No tag created."
  check_clean_tree ||
    die "Working tree changed. No tag created."
  if git -C "$ROOT" rev-parse -q --verify "refs/tags/$tag_name" >/dev/null; then
    die "Tag appeared during validation: $tag_name"
  fi
  git -C "$ROOT" tag -a "$tag_name" -m "MedOrbits release $version"
  log "Created local annotated tag: $tag_name"
  log "Tagged commit: $(git -C "$ROOT" rev-parse "$tag_name^{commit}")"
  warn "The tag is local only. Review it before any manual push or deployment."
}
main() {
  ROOT="$(find_root)"
  ROOT="$(cd "$ROOT" && pwd -P)"
  case "$MODE" in
    preview)
      show_preview
      ;;
    validate)
      show_preview
      run_validation
      ;;
    tag)
      [[ $# -eq 2 ]] ||
        die "Usage: bash RELEASE.sh tag VERSION"
      create_tag "$2"
      ;;
    help|-h|--help)
      usage
      ;;
    *)
      usage
      die "Unknown command: $MODE"
      ;;
  esac
}
main "$@"