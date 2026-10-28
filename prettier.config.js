#!/usr/bin/env bash
# ============================================================
# MedOrbits Safe Release Utility
# File: RELEASE.sh
# Release target: 3.0.0
#
# Purpose:
#   Preview, validate, and optionally create a local annotated
#   Git release tag without automatically committing, pushing,
#   publishing, or deploying.
#
# Safety:
#   - Preview is the default mode.
#   - Never runs git reset --hard or git clean.
#   - Never commits, pushes, or deploys.
#   - Refuses dirty working trees and unresolved conflicts.
#   - Validates semantic versions and existing tags.
#   - Checks package metadata and lockfile consistency.
#   - Runs configured project validation only when requested.
#   - Requires explicit confirmation before creating a tag.
#   - Rechecks repository state immediately before tagging.
#   - Never overwrites an existing tag.
#
# Usage:
#   bash RELEASE.sh
#   bash RELEASE.sh preview
#   bash RELEASE.sh validate
#   bash RELEASE.sh validate --tests
#   bash RELEASE.sh tag 3.0.0
#   bash RELEASE.sh help
#
# Optional:
#   RELEASE_ALLOW_NON_MAIN=true bash RELEASE.sh validate
#   RELEASE_ALLOW_NON_MAIN=true bash RELEASE.sh tag 3.0.0
#   RELEASE_RUN_TESTS=true bash RELEASE.sh validate
#
# Requirements:
#   Git; Node.js/npm for Node projects; Python is optional.
# ============================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_NAME="RELEASE.sh"
readonly DEFAULT_BRANCH="main"

ROOT=""
MODE="preview"
RUN_TESTS="${RELEASE_RUN_TESTS:-false}"

log()  { printf '[RELEASE] %s\n' "$*"; }
warn() { printf '[RELEASE][WARNING] %s\n' "$*" >&2; }
die()  { printf '[RELEASE][ERROR] %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'HELP'
MedOrbits Safe Release Utility -- 3.0.0

Usage:
  bash RELEASE.sh
  bash RELEASE.sh preview
  bash RELEASE.sh validate [--tests]
  bash RELEASE.sh tag VERSION
  bash RELEASE.sh help

Commands:
  preview
      Display repository status, recent commits, tags, and metadata.

  validate
      Validate Git state, package metadata, and available project
      configuration. Does not modify repository files.

  validate --tests
      Perform validation and run configured project checks.

  tag VERSION
      Validate the repository and create a local annotated Git tag.
      Example: bash RELEASE.sh tag 3.0.0

  help
      Display this help.

Environment:
  RELEASE_ALLOW_NON_MAIN=true
      Allow validation and tagging from a branch other than main.

  RELEASE_RUN_TESTS=true
      Run configured project validation commands.

Safety:
  - No automatic commit, push, publication, or deployment.
  - No destructive Git cleanup or reset operations.
  - Tagging requires a clean working tree and confirmation.
  - Existing tags are never overwritten.
  - The default release branch is main.
  - A local tag is not a published release.
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

get_head() {
  git -C "$ROOT" rev-parse HEAD
}

check_branch() {
  local branch
  branch="$(get_branch)"

  [[ -n "$branch" ]] ||
    die "Detached HEAD detected. Switch to a release branch."

  if [[ "$branch" != "$DEFAULT_BRANCH" &&
        "${RELEASE_ALLOW_NON_MAIN:-false}" != "true" ]]; then
    die "Current branch is '$branch', not '$DEFAULT_BRANCH'. Set RELEASE_ALLOW_NON_MAIN=true to override."
  fi

  log "Release branch: $branch"
}

check_conflicts() {
  local conflicts
  conflicts="$(git -C "$ROOT" diff --name-only --diff-filter=U)"

  if [[ -n "$conflicts" ]]; then
    warn "Unresolved merge conflicts detected:"
    printf '%s\n' "$conflicts" >&2
    return 1
  fi

  # Also detect unmerged index entries directly.
  if ! git -C "$ROOT" ls-files --unmerged | grep -q .; then
    return 0
  fi

  warn "Unmerged Git index entries detected."
  return 1
}

check_clean_tree() {
  local status
  status="$(git -C "$ROOT" status --porcelain --untracked-files=normal)"

  if [[ -n "$status" ]]; then
    warn "Working tree is not clean:"
    git -C "$ROOT" status --short
    warn "Commit, stash, or safely preserve changes before releasing."
    return 1
  fi

  return 0
}

check_repository_state() {
  check_branch
  check_conflicts ||
    die "Resolve conflicts before continuing."
  check_clean_tree ||
    die "Working tree must be clean."
}

validate_version() {
  local version="${1:-}"
  local prerelease=""
  local identifier
  local -a identifiers=()

  [[ -n "$version" ]] ||
    die "A release version is required."

  # Semantic Versioning 2.0.0 core and identifier syntax.
  if [[ ! "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-([0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*))?(\+([0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*))?$ ]]; then
    die "Invalid version '$version'. Example: 3.0.0 or 3.0.0-rc.1."
  fi

  # Extract prerelease identifiers without treating build metadata
  # as part of the prerelease section.
  if [[ "$version" == *-* ]]; then
    prerelease="${version#*-}"
    prerelease="${prerelease%%+*}"

    IFS='.' read -r -a identifiers <<< "$prerelease"

    for identifier in "${identifiers[@]}"; do
      if [[ "$identifier" =~ ^[0-9]+$ &&
            "$identifier" =~ ^0[0-9]+$ ]]; then
        die "Invalid numeric prerelease identifier '$identifier': leading zeros are prohibited."
      fi
    done
  fi

  log "Semantic version syntax: valid ($version)"
}

check_json_file() {
  local file="$1"

  [[ -f "$ROOT/$file" ]] || return 0

  if ! command -v node >/dev/null 2>&1; then
    warn "Node.js unavailable; cannot parse $file."
    return 1
  fi

  node --input-type=commonjs - "$ROOT/$file" <<'NODE'
const fs = require("node:fs");

const file = process.argv[2];

try {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));

  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new Error("Expected a JSON object at the root.");
  }

  console.log(`${file}: valid JSON object`);
} catch (error) {
  console.error(`${file}: ${error.message}`);
  process.exitCode = 1;
}
NODE
}

check_package_metadata() {
  local package_file="$ROOT/package.json"
  local lock_file="$ROOT/package-lock.json"

  [[ -f "$package_file" ]] || {
    warn "package.json not found; package checks skipped."
    return 0
  }

  command -v node >/dev/null 2>&1 ||
    die "Node.js is required to validate package.json."

  node --input-type=commonjs - "$package_file" "$lock_file" <<'NODE'
const fs = require("node:fs");

const packagePath = process.argv[2];
const lockPath = process.argv[3];

function fail(message) {
  console.error(`[RELEASE][ERROR] ${message}`);
  process.exit(1);
}

let pkg;

try {
  pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
} catch (error) {
  fail(`Invalid package.json: ${error.message}`);
}

if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
  fail("package.json must contain a JSON object.");
}

if (typeof pkg.name !== "string" || !pkg.name.trim()) {
  fail("package.json requires a non-empty name.");
}

if (typeof pkg.version !== "string" || !pkg.version.trim()) {
  fail("package.json requires a non-empty version.");
}

if (!pkg.scripts || typeof pkg.scripts !== "object") {
  fail("package.json requires a scripts object.");
}

console.log(`Package name: ${pkg.name}`);
console.log(`Package version: ${pkg.version}`);

if (pkg.engines?.node) {
  console.log(`Required Node.js: ${pkg.engines.node}`);
}

const requiredScripts = [
  "start",
  "check:syntax",
  "validate"
];

for (const name of requiredScripts) {
  if (typeof pkg.scripts[name] !== "string") {
    console.error(`Missing recommended npm script: ${name}`);
    process.exitCode = 1;
  }
}

if (fs.existsSync(lockPath)) {
  let lock;

  try {
    lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch (error) {
    fail(`Invalid package-lock.json: ${error.message}`);
  }

  if (lock.name && lock.name !== pkg.name) {
    fail(
      `Lockfile name '${lock.name}' differs from package name '${pkg.name}'.`
    );
  }

  if (lock.version && lock.version !== pkg.version) {
    fail(
      `Lockfile version '${lock.version}' differs from package version '${pkg.version}'.`
    );
  }

  if (
    lock.lockfileVersion >= 2 &&
    lock.packages?.[""] &&
    (
      lock.packages[""].name !== pkg.name ||
      lock.packages[""].version !== pkg.version
    )
  ) {
    fail("Root package metadata in package-lock.json does not match package.json.");
  }

  console.log(`Lockfile version: ${lock.lockfileVersion ?? "unspecified"}`);
  console.log("package-lock.json metadata: consistent");
} else {
  console.warn("package-lock.json not found.");
}
NODE
}

check_requirements() {
  local file="$ROOT/requirements.txt"

  [[ -f "$file" ]] || return 0

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$file" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])

try:
    content = path.read_text(encoding="utf-8")
except (OSError, UnicodeError) as exc:
    print(f"requirements.txt: {exc}", file=sys.stderr)
    raise SystemExit(1)

if not content.strip():
    print("requirements.txt is empty", file=sys.stderr)
    raise SystemExit(1)

print("requirements.txt: readable and non-empty")
PY
  elif command -v python >/dev/null 2>&1; then
    python - "$file" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
content = path.read_text(encoding="utf-8")

if not content.strip():
    raise SystemExit("requirements.txt is empty")

print("requirements.txt: readable and non-empty")
PY
  else
    warn "Python unavailable; requirements.txt validation skipped."
  fi
}

run_project_checks() {
  local package_file="$ROOT/package.json"

  [[ -f "$package_file" ]] || {
    warn "No package.json; npm checks skipped."
    return 0
  }

  require_command npm

  log "Running configured project validation..."

  (
    cd "$ROOT"
    npm run validate
  ) || die "npm run validate failed."

  if [[ "$RUN_TESTS" == "true" ]]; then
    log "Running configured project tests..."

    (
      cd "$ROOT"
      npm test
    ) || die "npm test failed."
  fi
}

show_preview() {
  log "Repository: $ROOT"

  local branch
  branch="$(get_branch)"
  log "Branch: ${branch:-DETACHED HEAD}"

  if git -C "$ROOT" rev-parse --verify HEAD >/dev/null 2>&1; then
    log "HEAD: $(git -C "$ROOT" log -1 --format='%h %s')"
    log "Commit: $(get_head)"
  else
    warn "Repository has no commits yet."
  fi

  printf '\n--- Git status ---\n'
  git -C "$ROOT" status --short --branch

  printf '\n--- Recent commits ---\n'
  git -C "$ROOT" log -5 --oneline --decorate 2>/dev/null ||
    warn "No commit history is available."

  printf '\n--- Project metadata ---\n'

  if [[ -f "$ROOT/package.json" ]]; then
    if command -v node >/dev/null 2>&1; then
      node --input-type=commonjs - "$ROOT/package.json" <<'NODE'
const fs = require("node:fs");

try {
  const pkg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

  console.log("Name:", pkg.name ?? "(not set)");
  console.log("Version:", pkg.version ?? "(not set)");
  console.log("License:", pkg.license ?? "(not set)");
  console.log("Module type:", pkg.type ?? "(default)");
  console.log("Node requirement:", pkg.engines?.node ?? "(not specified)");
  console.log("Package manager:", pkg.packageManager ?? "(not specified)");
  console.log(
    "Scripts:",
    Object.keys(pkg.scripts ?? {}).join(", ") || "(none)"
  );
} catch (error) {
  console.error("package.json invalid:", error.message);
  process.exitCode = 1;
}
NODE
    else
      warn "Node.js unavailable; package metadata was not parsed."
    fi
  else
    log "No package.json found."
  fi

  [[ ! -f "$ROOT/package-lock.json" ]] ||
    log "package-lock.json found."

  [[ ! -f "$ROOT/requirements.txt" ]] ||
    log "requirements.txt found."

  printf '\n--- Recent version tags ---\n'
  git -C "$ROOT" tag --sort=-version:refname | head -10 || true
}

run_validation() {
  log "Validating repository state..."

  check_repository_state

  check_package_metadata ||
    die "Package metadata validation failed."

  check_json_file "repository.manifest.json" ||
    die "repository.manifest.json validation failed."

  check_requirements ||
    die "Python requirements validation failed."

  log "Basic release validation passed."

  if [[ "$RUN_TESTS" == "true" ]]; then
    run_project_checks
  else
    warn "Project tests were not requested."
    warn "Basic validation is not a substitute for tests, dependency audits, or deployment health checks."
  fi
}

create_tag() {
  local version="$1"
  local tag_name="v${version}"
  local confirmation
  local head_before

  validate_version "$version"
  run_validation

  if git -C "$ROOT" rev-parse -q --verify "refs/tags/$tag_name" >/dev/null 2>&1; then
    die "Tag already exists: $tag_name. Existing tags will not be overwritten."
  fi

  head_before="$(get_head)"

  printf '\n--- Release tag plan ---\n'
  printf 'Repository: %s\n' "$ROOT"
  printf 'Branch: %s\n' "$(get_branch)"
  printf 'Commit: %s\n' "$head_before"
  printf 'Tag: %s\n' "$tag_name"
  printf 'Action: create local annotated tag only\n'
  printf 'Push: no\n'
  printf 'Deploy: no\n\n'

  printf 'Type exactly CREATE-%s to continue: ' "$tag_name"

  IFS= read -r confirmation ||
    die "No confirmation received."

  [[ "$confirmation" == "CREATE-$tag_name" ]] ||
    die "Confirmation did not match. No tag created."

  # Recheck immediately before writing the tag.
  check_repository_state

  [[ "$(get_head)" == "$head_before" ]] ||
    die "HEAD changed during confirmation. No tag created."

  if git -C "$ROOT" rev-parse -q --verify "refs/tags/$tag_name" >/dev/null 2>&1; then
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

  MODE="${1:-preview}"

  case "$MODE" in
    preview)
      [[ $# -le 1 ]] || die "Usage: bash RELEASE.sh [preview]"
      show_preview
      ;;

    validate)
      if [[ $# -gt 2 ]]; then
        die "Usage: bash RELEASE.sh validate [--tests]"
      fi

      if [[ $# -eq 2 ]]; then
        [[ "$2" == "--tests" ]] ||
          die "Unknown validate option: $2"
        RUN_TESTS="true"
      fi

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