#!/usr/bin/env bash
# ============================================================
# MedOrbits Font Downloader
# File: assets/fonts/download-font.sh
#
# Purpose:
#   Download selected open-source web fonts for local hosting.
#
# Features:
#   - Downloads fonts from explicitly configured HTTPS URLs.
#   - Supports Google Fonts static WOFF2 files.
#   - Uses temporary files and atomic file replacement.
#   - Verifies downloaded files are non-empty.
#   - Supports dry-run mode and font listing.
#   - Never deletes existing font files.
#   - Does not modify HTML, CSS, or JavaScript files.
#
# Usage:
#   bash assets/fonts/download-font.sh
#   bash assets/fonts/download-font.sh --dry-run
#   bash assets/fonts/download-font.sh --list
#   bash assets/fonts/download-font.sh --font inter
#   bash assets/fonts/download-font.sh --force
#
# Requirements:
#   Bash 4+, curl, and optionally sha256sum or shasum.
#
# Security:
#   Use trusted HTTPS font sources.
#   Review font licenses before redistribution.
# ============================================================
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
readonly SCRIPT_NAME="download-font.sh"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
DRY_RUN=0
FORCE=0
LIST_ONLY=0
SELECTED_FONT=""
TEMP_DIR=""
log() {
    printf '[FONTS] %s\n' "$*"
}
warn() {
    printf '[WARN] %s\n' "$*" >&2
}
die() {
    printf '[ERROR] %s\n' "$*" >&2
    exit 1
}
cleanup() {
    if [[ -n "${TEMP_DIR:-}" && -d "$TEMP_DIR" ]]; then
        rm -rf -- "$TEMP_DIR"
    fi
}
trap cleanup EXIT
usage() {
    cat <<'USAGE'
MedOrbits Font Downloader
Usage:
  download-font.sh [options]
Options:
  --dry-run       Show intended actions without downloading files
  --list          List available font families
  --font NAME     Download one font family
  --force         Replace existing files after successful download
  --help          Show this help
Available font families:
  inter
  roboto
  poppins
  playfair-display
  source-sans-3
Examples:
  bash assets/fonts/download-font.sh --list
  bash assets/fonts/download-font.sh --dry-run
  bash assets/fonts/download-font.sh --font inter
  bash assets/fonts/download-font.sh --font poppins --force
Notes:
  - Downloads use fixed URLs in this script.
  - Existing files are skipped unless --force is supplied.
  - No files are deleted.
  - The script does not automatically edit CSS @font-face rules.
USAGE
}
parse_args() {
    while (($#)); do
        case "$1" in
            --dry-run)
                DRY_RUN=1
                shift
                ;;
            --force)
                FORCE=1
                shift
                ;;
            --list)
                LIST_ONLY=1
                shift
                ;;
            --font)
                (($# >= 2)) || die "--font requires a font family name."
                SELECTED_FONT="$2"
                shift 2
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                die "Unknown option: $1. Run '$SCRIPT_NAME --help'."
                ;;
        esac
    done
}
require_command() {
    command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}
# Format:
# family|filename|source URL
#
# URLs must be HTTPS and must be reviewed before use.
# These are Google Fonts CSS2 endpoints; their content may vary
# by browser user-agent, so the downloader validates the response
# and rejects CSS/HTML when a WOFF2 file is expected.
FONT_MANIFEST=(
    "inter|inter-latin-400-normal.woff2|https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTcviYwY.woff2"
    "roboto|roboto-latin-400-normal.woff2|https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2"
    "poppins|poppins-latin-400-normal.woff2|https://fonts.gstatic.com/s/poppins/v20/pxiEyp8kv8JHgFVrJJfecg.woff2"
    "playfair-display|playfair-display-latin-400-normal.woff2|https://fonts.gstatic.com/s/playfairdisplay/v30/nuFiD-vYSZviVYVL6mWUBcRR.woff2"
    "source-sans-3|source-sans-3-latin-400-normal.woff2|https://fonts.gstatic.com/s/sourcesans3/v15/nwpBtKy2OAdR1K-IwhWudF-R3w8aZg.woff2"
)
list_fonts() {
    printf '%-20s %-42s\n' "FONT FAMILY" "OUTPUT FILE"
    printf '%-20s %-42s\n' "-----------" "-----------"
    local entry family filename url
    for entry in "${FONT_MANIFEST[@]}"; do
        IFS='|' read -r family filename url <<< "$entry"
        printf '%-20s %-42s\n' "$family" "$filename"
    done
}
validate_manifest_url() {
    local url="$1"
    [[ "$url" == https://fonts.gstatic.com/* ]] ||
        die "Rejected unapproved font URL: $url"
}
download_font() {
    local family="$1"
    local filename="$2"
    local url="$3"
    validate_manifest_url "$url"
    local destination="${SCRIPT_DIR}/${filename}"
    local temp_file="${TEMP_DIR}/${filename}.part"
    if [[ -e "$destination" && "$FORCE" -eq 0 ]]; then
        log "Already exists; skipping: $filename"
        return 0
    fi
    if ((DRY_RUN)); then
        log "Would download: $family -> $destination"
        return 0
    fi
    log "Downloading $family..."
    if ! curl \
        --fail \
        --silent \
        --show-error \
        --location \
        --proto '=https' \
        --tlsv1.2 \
        --connect-timeout 15 \
        --max-time 90 \
        --retry 2 \
        --retry-delay 1 \
        --user-agent "MedOrbits-Font-Downloader/1.0" \
        --output "$temp_file" \
        "$url"; then
        die "Download failed for $family."
    fi
    [[ -s "$temp_file" ]] || die "Downloaded file is empty: $family"
    # WOFF2 files begin with the ASCII signature "wOF2".
    local signature
    signature="$(od -An -N4 -tc "$temp_file" | tr -d ' \n')"
    [[ "$signature" == "wOF2" ]] ||
        die "Downloaded content is not a WOFF2 font: $family. Check the source URL."
    if [[ -e "$destination" && "$FORCE" -eq 0 ]]; then
        die "Destination appeared during download; refusing to overwrite: $filename"
    fi
    # The temporary file is in the same directory filesystem as the destination
    # to allow an atomic move after validation.
    local staged_file="${SCRIPT_DIR}/.${filename}.tmp.$$"
    cp -- "$temp_file" "$staged_file"
    chmod 0644 "$staged_file"
    if [[ -e "$destination" && "$FORCE" -eq 0 ]]; then
        rm -f -- "$staged_file"
        die "Destination exists; refusing to overwrite: $filename"
    fi
    mv -f -- "$staged_file" "$destination"
    log "Saved: $destination"
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum -- "$destination"
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$destination"
    fi
}
main() {
    parse_args "$@"
    if ((LIST_ONLY)); then
        list_fonts
        return 0
    fi
    require_command curl
    require_command od
    require_command tr
    require_command cp
    require_command mv
    [[ -d "$SCRIPT_DIR" ]] || die "Font directory does not exist."
    TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/medorbits-fonts.XXXXXX")"
    local matched=0
    local entry family filename url
    for entry in "${FONT_MANIFEST[@]}"; do
        IFS='|' read -r family filename url <<< "$entry"
        if [[ -n "$SELECTED_FONT" && "$family" != "$SELECTED_FONT" ]]; then
            continue
        fi
        matched=1
        download_font "$family" "$filename" "$url"
    done
    ((matched)) || die "Unknown font family: $SELECTED_FONT. Run '$SCRIPT_NAME --list'."
    if ((DRY_RUN)); then
        log "Dry run completed; no font files were changed."
    else
        log "Font download process completed."
    fi
}
main "$@"