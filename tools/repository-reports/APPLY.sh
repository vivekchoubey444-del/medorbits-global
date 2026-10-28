
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- Repository Reports Apply Runner
#
# File: tools/repository-reports/APPLY.sh
# Version: 1.0.0
#
# Purpose:
#   Validate repository reporting tools and optionally execute approved
#   report-generation scripts.
#
# Usage:
#   bash tools/repository-reports/APPLY.sh --check
#   bash tools/repository-reports/APPLY.sh --dry-run
#   bash tools/repository-reports/APPLY.sh --apply
#
# Optional environment variables:
#   REPORTS_DIR=storage/repository-reports
#   REPORT_SCRIPT=tools/repository-reports/generate-reports.py
#
# Safety:
#   - No automatic deletion or cleanup.
#   - No automatic Git commits, pushes, or deployments.
#   - No automatic dependency installation.
#   - Does not overwrite existing reports.
#   - --apply requires explicit confirmation.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_DIR="$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P
)"
readonly REPO_ROOT="$(
    cd -- "${SCRIPT_DIR}/../.." && pwd -P
)"

MODE=""
REPORTS_DIR="${REPORTS_DIR:-storage/repository-reports}"
REPORT_SCRIPT="${REPORT_SCRIPT:-}"

log() {
    printf '[MedOrbits Reports] %s\n' "$*"
}

warn() {
    printf '[WARN] %s\n' "$*" >&2
}

die() {
    printf '[ERROR] %s\n' "$*" >&2
    exit 1
}

usage() {
    cat <<'USAGE'
MedOrbits Repository Reports Apply Runner

Usage:
  bash tools/repository-reports/APPLY.sh --check
  bash tools/repository-reports/APPLY.sh --dry-run
  bash tools/repository-reports/APPLY.sh --apply
  bash tools/repository-reports/APPLY.sh --help

Modes:
  --check     Check repository, tools, and reporting configuration.
  --dry-run   Preview report generation without running the generator.
  --apply     Run the configured report generator after confirmation.
  --help      Display this help.

Environment:
  REPORTS_DIR    Repository-relative directory for generated reports.
  REPORT_SCRIPT  Optional repository-relative executable generator script.

Default report directory:
  storage/repository-reports

This runner does not create a generator automatically. Configure REPORT_SCRIPT
only after reviewing an existing generator or creating a trusted one.
USAGE
}

require_command() {
    command -v "$1" >/dev/null 2>&1 ||
        die "Required command not found: $1"
}

resolve_repo_path() {
    local input="$1"
    local allow_missing="${2:-false}"
    local path

    if [[ "$input" == /* ]]; then
        path="$input"
    else
        path="${REPO_ROOT}/${input}"
    fi

    path="$(python3 - "$REPO_ROOT" "$path" "$allow_missing" <<'PY'
import os
import sys

root = os.path.realpath(sys.argv[1])
candidate = os.path.abspath(sys.argv[2])
allow_missing = sys.argv[3] == "true"

try:
    if os.path.commonpath([root, candidate]) != root:
        raise ValueError("path escapes repository")
except ValueError:
    raise SystemExit("Path is outside repository")

current = root
relative = os.path.relpath(candidate, root)

if relative != ".":
    for component in relative.split(os.sep):
        current = os.path.join(current, component)
        if os.path.islink(current):
            raise SystemExit("Symbolic links are not allowed: " + current)

if not allow_missing and not os.path.exists(candidate):
    raise SystemExit("Path does not exist: " + candidate)

if os.path.exists(candidate) and not (
    os.path.isfile(candidate) or os.path.isdir(candidate)
):
    raise SystemExit("Path is not a regular file or directory: " + candidate)

print(candidate)
PY
    )" || die "Could not safely resolve path: $input"

    printf '%s\n' "$path"
}

check_repository() {
    require_command git
    require_command python3

    git -C "$REPO_ROOT" rev-parse --show-toplevel >/dev/null 2>&1 ||
        die "Not inside a Git repository: $REPO_ROOT"

    local git_root
    git_root="$(git -C "$REPO_ROOT" rev-parse --show-toplevel)"
    git_root="$(cd -- "$git_root" && pwd -P)"

    [[ "$git_root" == "$REPO_ROOT" ]] ||
        die "Unexpected repository root: $git_root"

    log "Repository root verified."
}

check_report_directory() {
    local report_path
    report_path="$(resolve_repo_path "$REPORTS_DIR" true)"

    if [[ -e "$report_path" && ! -d "$report_path" ]]; then
        die "Reports path exists but is not a directory: $report_path"
    fi

    log "Reports directory: ${report_path#"$REPO_ROOT"/}"

    if [[ -d "$report_path" ]]; then
        log "Existing reports will be preserved."
    else
        log "Reports directory does not exist yet; check and dry-run will not create it."
    fi
}

check_generator() {
    if [[ -z "$REPORT_SCRIPT" ]]; then
        log "No report generator configured."
        log "Set REPORT_SCRIPT to a reviewed repository-local generator to enable --apply."
        return 0
    fi

    local generator
    generator="$(resolve_repo_path "$REPORT_SCRIPT" false)"

    [[ -f "$generator" ]] ||
        die "Configured report generator is not a file: $generator"

    [[ -x "$generator" ]] ||
        die "Configured report generator must be executable: $generator"

    log "Configured generator: ${generator#"$REPO_ROOT"/}"
}

check_working_tree() {
    local status
    status="$(git -C "$REPO_ROOT" status --porcelain --untracked-files=all)"

    if [[ -n "$status" ]]; then
        warn "The working tree contains changes:"
        printf '%s\n' "$status" >&2
        die "Commit, stash, or back up changes before applying reports."
    fi

    log "Git working tree is clean."
}

main() {
    [[ "$#" -eq 1 ]] || {
        usage
        die "Supply exactly one mode."
    }

    MODE="$1"

    case "$MODE" in
        --help|-h)
            usage
            exit 0
            ;;
        --check|--dry-run|--apply)
            ;;
        *)
            usage
            die "Unknown mode: $MODE"
            ;;
    esac

    check_repository
    check_report_directory
    check_generator

    case "$MODE" in
        --check)
            log "Checks completed. No files were modified."
            ;;

        --dry-run)
            log "Dry-run complete. No generator was executed."
            log "Review your generator and its output behavior before applying."
            ;;

        --apply)
            [[ -n "$REPORT_SCRIPT" ]] ||
                die "Cannot apply: REPORT_SCRIPT is not configured."

            check_working_tree

            local generator
            local report_path

            generator="$(resolve_repo_path "$REPORT_SCRIPT" false)"
            report_path="$(resolve_repo_path "$REPORTS_DIR" true)"

            printf '\n'
            warn "This will execute the configured report generator."
            warn "Generator: ${generator#"$REPO_ROOT"/}"
            warn "Output directory: ${report_path#"$REPO_ROOT"/}"
            printf 'Type APPLY to continue: '

            local confirmation
            IFS= read -r confirmation ||
                die "Confirmation was not received."

            [[ "$confirmation" == "APPLY" ]] ||
                die "Confirmation failed. Nothing was executed."

            (
                cd -- "$REPO_ROOT"
                "$generator" --output-dir "$report_path"
            )

            log "Report generator completed."
            ;;
    esac
}

main "$@"
