#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
umask 077
# ============================================================
# MedOrbits Font Asset Downloader
# File: assets/fonts/download-fonts.sh
# Version: 2.0.0
#
# Design system:
#   Royal Burgundy and Champagne Gold
#
# Font families:
#   DM Sans             - Interface and body
#   Playfair Display    - Premium display headings
#   Cormorant Garamond  - Editorial and Roman-style text
#
# Features:
#   - Downloads 11 static WOFF2 font assets.
#   - Validates file signatures, sizes, and HTTPS source hosts.
#   - Uses temporary staging before publishing assets.
#   - Preserves existing files unless --force is specified.
#   - Creates a SHA-256 manifest.
#   - Supports dry-run, single-family downloads, and verification.
#   - Uses atomic file replacement for individual files.
#   - Rolls back published files if a publication step fails.
#   - Does not modify CSS, HTML, JavaScript, or Git history.
#
# Requirements:
#   Bash 4+, curl, Python 3
#
# Run from any directory:
#   bash assets/fonts/download-fonts.sh
#
# Usage:
#   ./assets/fonts/download-fonts.sh --dry-run
#   ./assets/fonts/download-fonts.sh --list
#   ./assets/fonts/download-fonts.sh --font "DM Sans"
#   ./assets/fonts/download-fonts.sh --verify
#   ./assets/fonts/download-fonts.sh --force
# ============================================================
readonly SCRIPT_VERSION="2.0.0"
readonly FONT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly USER_AGENT="Mozilla/5.0 (compatible; MedOrbits-Font-Downloader/2.0)"
readonly CONNECT_TIMEOUT=15
readonly MAX_TIME=90
readonly RETRIES=3
readonly MANIFEST_NAME="font-manifest.json"
DRY_RUN=0
FORCE=0
VERIFY_ONLY=0
LIST_ONLY=0
SELECTED_FONT=""
TMP_DIR=""
PUBLISH_DIR=""
BACKUP_DIR=""
PUBLISHED=()
BACKED_UP=()
COMMIT_COMPLETE=0
die() {
    printf '[ERROR] %s\n' "$*" >&2
    exit 1
}
log() {
    printf '[MedOrbits Fonts] %s\n' "$*"
}
warn() {
    printf '[WARN] %s\n' "$*" >&2
}
usage() {
    cat <<'USAGE'
MedOrbits Font Asset Downloader
Usage:
  download-fonts.sh [options]
Options:
  --dry-run          Preview actions without downloading or changing files
  --list             List configured font assets
  --font FAMILY      Download or validate one family only
  --force            Replace existing font assets after validation
  --verify           Verify existing fonts against the manifest
  --help             Show help
Font families:
  "DM Sans"
  "Playfair Display"
  "Cormorant Garamond"
Examples:
  bash assets/fonts/download-fonts.sh --dry-run
  bash assets/fonts/download-fonts.sh --list
  bash assets/fonts/download-fonts.sh --font "DM Sans"
  bash assets/fonts/download-fonts.sh --force
  bash assets/fonts/download-fonts.sh --verify
Default behavior:
  - Existing valid fonts are preserved.
  - Missing fonts are downloaded.
  - All required files are validated before publishing.
  - The manifest is generated from the final staged assets.
  - No project CSS or HTML files are modified.
--force replaces existing font files. Review and back up customized
font assets before using it. Font licensing remains your responsibility.
USAGE
}
cleanup() {
    local exit_code=$?
    if ((exit_code != 0 && COMMIT_COMPLETE == 0)); then
        rollback_publication
    fi
    if [[ -n "${TMP_DIR:-}" && -d "$TMP_DIR" ]]; then
        rm -rf -- "$TMP_DIR"
    fi
    return "$exit_code"
}
rollback_publication() {
    local path name
    # Remove only files created by this invocation.
    for path in "${PUBLISHED[@]:-}"; do
        [[ -n "$path" ]] || continue
        if [[ -f "$path" || -L "$path" ]]; then
            rm -f -- "$path" || warn "Could not remove partially published file: $path"
        fi
    done
    # Restore previously existing files that were moved into our private
    # temporary backup directory.
    for name in "${BACKED_UP[@]:-}"; do
        [[ -n "$name" ]] || continue
        if [[ -e "$BACKUP_DIR/$name" || -L "$BACKUP_DIR/$name" ]]; then
            if ! mv -- "$BACKUP_DIR/$name" "$FONT_DIR/$name"; then
                warn "ROLLBACK REQUIRED: original file remains at $BACKUP_DIR/$name"
            fi
        fi
    done
}
trap cleanup EXIT
for command in curl python3; do
    command -v "$command" >/dev/null 2>&1 ||
        die "Required command not found: $command"
done
# Fixed family/weight/filename manifest.
# URLs are discovered from the official Google Fonts CSS endpoint.
# The downloader accepts font binaries only from fonts.gstatic.com.
FONT_SPECS=(
    "DM Sans|400|dm-sans-regular.woff2"
    "DM Sans|500|dm-sans-medium.woff2"
    "DM Sans|600|dm-sans-semibold.woff2"
    "DM Sans|700|dm-sans-bold.woff2"
    "Playfair Display|500|playfair-display-medium.woff2"
    "Playfair Display|600|playfair-display-semibold.woff2"
    "Playfair Display|700|playfair-display-bold.woff2"
    "Cormorant Garamond|400|cormorant-garamond-regular.woff2"
    "Cormorant Garamond|500|cormorant-garamond-medium.woff2"
    "Cormorant Garamond|600|cormorant-garamond-semibold.woff2"
    "Cormorant Garamond|700|cormorant-garamond-bold.woff2"
)
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
            --verify)
                VERIFY_ONLY=1
                shift
                ;;
            --list)
                LIST_ONLY=1
                shift
                ;;
            --font)
                (($# >= 2)) || die "--font requires a family name."
                SELECTED_FONT="$2"
                shift 2
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            *)
                die "Unknown option: $1. Run with --help."
                ;;
        esac
    done
    if ((VERIFY_ONLY && (DRY_RUN || FORCE || LIST_ONLY))); then
        die "--verify cannot be combined with --dry-run, --force, or --list."
    fi
    if ((LIST_ONLY && (DRY_RUN || FORCE || VERIFY_ONLY))); then
        die "--list cannot be combined with download options."
    fi
    if [[ -n "$SELECTED_FONT" ]]; then
        case "$SELECTED_FONT" in
            "DM Sans"|"Playfair Display"|"Cormorant Garamond")
                ;;
            *)
                die "Unknown font family: $SELECTED_FONT. Use --list."
                ;;
        esac
    fi
}
list_fonts() {
    printf '%-22s %-8s %s\n' "FONT FAMILY" "WEIGHT" "FILE"
    printf '%-22s %-8s %s\n' "-----------" "------" "----"
    local spec family weight filename
    for spec in "${FONT_SPECS[@]}"; do
        IFS='|' read -r family weight filename <<< "$spec"
        if [[ -z "$SELECTED_FONT" || "$SELECTED_FONT" == "$family" ]]; then
            printf '%-22s %-8s %s\n' "$family" "$weight" "$filename"
        fi
    done
}
font_matches_selection() {
    local family="$1"
    [[ -z "$SELECTED_FONT" || "$SELECTED_FONT" == "$family" ]]
}
validate_woff2() {
    python3 - "$1" <<'PY'
import sys
from pathlib import Path
path = Path(sys.argv[1])
if not path.is_file():
    raise SystemExit(f"Missing font file: {path}")
size = path.stat().st_size
if size < 1000:
    raise SystemExit(f"Font file is suspiciously small ({size} bytes): {path}")
with path.open("rb") as handle:
    signature = handle.read(4)
if signature != b"wOF2":
    raise SystemExit(f"Invalid WOFF2 signature: {path}")
print(f"Validated: {path.name} ({size:,} bytes)")
PY
}
download_font() {
    local family="$1"
    local weight="$2"
    local filename="$3"
    local css_file="$TMP_DIR/${filename%.woff2}.css"
    local font_file="$PUBLISH_DIR/$filename"
    local existing_file="$FONT_DIR/$filename"
    local encoded_family
    local css_url
    local font_url
    if [[ -e "$existing_file" || -L "$existing_file" ]]; then
        [[ -f "$existing_file" && ! -L "$existing_file" ]] ||
            die "Existing destination is not a regular file: $existing_file"
        if ((FORCE == 0)); then
            validate_woff2 "$existing_file" ||
                die "Existing font is invalid. Back it up and rerun with --force to replace it."
            cp -- "$existing_file" "$font_file"
            log "Preserving existing font: $filename"
            return 0
        fi
    fi
    if ((DRY_RUN)); then
        log "Would download: $family weight $weight -> $filename"
        return 0
    fi
    encoded_family="$(
        python3 - "$family" <<'PY'
import sys
from urllib.parse import quote
print(quote(sys.argv[1], safe=""))
PY
    )"
    css_url="https://fonts.googleapis.com/css2?family=${encoded_family}:wght@${weight}&display=swap"
    log "Fetching Google Fonts CSS: $family ($weight)"
    curl \
        --fail \
        --silent \
        --show-error \
        --location \
        --proto '=https' \
        --proto-redir '=https' \
        --tlsv1.2 \
        --connect-timeout "$CONNECT_TIMEOUT" \
        --max-time "$MAX_TIME" \
        --retry "$RETRIES" \
        --retry-delay 2 \
        --retry-all-errors \
        --user-agent "$USER_AGENT" \
        --output "$css_file" \
        "$css_url"
    [[ -s "$css_file" ]] || die "Empty CSS response: $family ($weight)"
    font_url="$(
        python3 - "$css_file" "$weight" <<'PY'
import re
import sys
from pathlib import Path
from urllib.parse import urlparse
css_path = Path(sys.argv[1])
requested_weight = sys.argv[2]
css = css_path.read_text(encoding="utf-8")
# Parse each @font-face block rather than relying on comment formatting.
blocks = re.findall(r"@font-face\s*\{([^}]*)\}", css, re.I | re.S)
matches = []
for block in blocks:
    weight_match = re.search(r"font-weight\s*:\s*([^;]+)", block, re.I)
    if not weight_match:
        continue
    declared_weight = weight_match.group(1).strip()
    # The request asks for one static weight; reject variable ranges here.
    if declared_weight != requested_weight:
        continue
    src_match = re.search(
        r"url\(\s*['\"]?(https://[^)'\"\s]+)['\"]?\s*\)\s*format\(\s*['\"]?woff2['\"]?\s*\)",
        block,
        re.I,
    )
    if not src_match:
        # Some provider responses omit format(); still accept a WOFF2 URL.
        src_match = re.search(
            r"url\(\s*['\"]?(https://[^)'\"\s]+\.woff2(?:\?[^)'\"\s]*)?)['\"]?\s*\)",
            block,
            re.I,
        )
    if not src_match:
        continue
    url = src_match.group(1)
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "fonts.gstatic.com":
        continue
    if ".woff2" not in parsed.path.lower():
        continue
    # Restrict to Latin subset when the CSS includes subset comments.
    preceding = css[:css.find(block)]
    comments = re.findall(r"/\*\s*([^*]+?)\s*\*/", preceding, re.S)
    subset = comments[-1].strip().lower() if comments else ""
    matches.append((subset, url))
latin = [url for subset, url in matches if subset == "latin"]
if latin:
    print(latin[-1])
elif matches:
    print(matches[-1][1])
else:
    raise SystemExit(
        f"No matching WOFF2 URL found for weight {requested_weight}. "
        "The Google Fonts response may have changed."
    )
PY
    )" || die "Could not extract a trusted WOFF2 URL for $family ($weight)."
    log "Downloading: $filename"
    curl \
        --fail \
        --silent \
        --show-error \
        --location \
        --proto '=https' \
        --proto-redir '=https' \
        --tlsv1.2 \
        --connect-timeout "$CONNECT_TIMEOUT" \
        --max-time "$MAX_TIME" \
        --retry "$RETRIES" \
        --retry-delay 2 \
        --retry-all-errors \
        --user-agent "$USER_AGENT" \
        --output "$font_file" \
        "$font_url"
    validate_woff2 "$font_file"
    chmod 0644 "$font_file"
}
generate_manifest() {
    local staged_dir="$1"
    local output_file="$2"
    python3 - "$staged_dir" "$output_file" "$FONT_DIR" <<'PY'
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
staged_dir = Path(sys.argv[1])
manifest_path = Path(sys.argv[2])
font_dir = Path(sys.argv[3])
assets = [
    ("dm-sans-regular.woff2", "DM Sans", 400, "sans-serif", "interface-body"),
    ("dm-sans-medium.woff2", "DM Sans", 500, "sans-serif", "interface-body"),
    ("dm-sans-semibold.woff2", "DM Sans", 600, "sans-serif", "interface-body"),
    ("dm-sans-bold.woff2", "DM Sans", 700, "sans-serif", "interface-body"),
    ("playfair-display-medium.woff2", "Playfair Display", 500, "serif", "display-heading"),
    ("playfair-display-semibold.woff2", "Playfair Display", 600, "serif", "display-heading"),
    ("playfair-display-bold.woff2", "Playfair Display", 700, "serif", "display-heading"),
    ("cormorant-garamond-regular.woff2", "Cormorant Garamond", 400, "serif", "roman-text"),
    ("cormorant-garamond-medium.woff2", "Cormorant Garamond", 500, "serif", "roman-text"),
    ("cormorant-garamond-semibold.woff2", "Cormorant Garamond", 600, "serif", "roman-text"),
    ("cormorant-garamond-bold.woff2", "Cormorant Garamond", 700, "serif", "roman-text"),
]
records = []
for filename, family, weight, generic_family, purpose in assets:
    path = staged_dir / filename
    if not path.is_file():
        raise SystemExit(f"Missing staged font asset: {path}")
    data = path.read_bytes()
    if len(data) < 1000 or data[:4] != b"wOF2":
        raise SystemExit(f"Invalid WOFF2 asset: {path}")
    records.append({
        "file": filename,
        "path": f"{font_dir.name}/{filename}",
        "family": family,
        "weight": weight,
        "style": "normal",
        "format": "woff2",
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "genericFamily": generic_family,
        "purpose": purpose,
        "source": "Google Fonts",
    })
manifest = {
    "schemaVersion": "2.0.0",
    "package": "MedOrbits Fonts",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "designSystem": "Royal Burgundy and Champagne Gold",
    "fontFamilies": {
        "ui": {
            "family": "DM Sans",
            "fallback": "Arial, sans-serif",
        },
        "display": {
            "family": "Playfair Display",
            "fallback": "Georgia, serif",
        },
        "romanText": {
            "family": "Cormorant Garamond",
            "fallback": "Georgia, serif",
        },
    },
    "assets": records,
}
manifest_path.write_text(
    json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
)
print(f"Manifest prepared for {len(records)} font assets.")
PY
}
verify_manifest() {
    local manifest_path="$FONT_DIR/$MANIFEST_NAME"
    [[ -f "$manifest_path" ]] || die "Manifest not found: $manifest_path"
    python3 - "$FONT_DIR" "$manifest_path" "$SELECTED_FONT" <<'PY'
import hashlib
import json
import sys
from pathlib import Path
font_dir = Path(sys.argv[1])
manifest_path = Path(sys.argv[2])
selected_family = sys.argv[3]
try:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
except Exception as exc:
    raise SystemExit(f"Invalid manifest JSON: {exc}")
assets = manifest.get("assets")
if not isinstance(assets, list):
    raise SystemExit("Manifest does not contain an assets array.")
checked = 0
for item in assets:
    if not isinstance(item, dict):
        raise SystemExit("Malformed asset record.")
    if selected_family and item.get("family") != selected_family:
        continue
    filename = item.get("file")
    expected_hash = item.get("sha256")
    if not isinstance(filename, str) or Path(filename).name != filename:
        raise SystemExit("Unsafe filename in manifest.")
    path = font_dir / filename
    if not path.is_file() or path.is_symlink():
        raise SystemExit(f"Missing or unsafe font asset: {filename}")
    data = path.read_bytes()
    if data[:4] != b"wOF2" or len(data) < 1000:
        raise SystemExit(f"Invalid WOFF2 file: {filename}")
    actual_hash = hashlib.sha256(data).hexdigest()
    if actual_hash != expected_hash:
        raise SystemExit(f"SHA-256 mismatch: {filename}")
    if item.get("bytes") != len(data):
        raise SystemExit(f"File size mismatch: {filename}")
    print(f"[PASS] {filename}")
    checked += 1
if checked == 0:
    raise SystemExit("No matching font assets were verified.")
print(f"Verified {checked} font asset(s).")
PY
}
publish_assets() {
    local name destination staged
    PUBLISH_DIR="$TMP_DIR/staged"
    BACKUP_DIR="$TMP_DIR/originals"
    mkdir -p -- "$BACKUP_DIR"
    local files=()
    local spec family weight filename
    for spec in "${FONT_SPECS[@]}"; do
        IFS='|' read -r family weight filename <<< "$spec"
        font_matches_selection "$family" || continue
        staged="$PUBLISH_DIR/$filename"
        destination="$FONT_DIR/$filename"
        [[ -f "$staged" ]] || die "Missing staged asset: $filename"
        if [[ -e "$destination" || -L "$destination" ]]; then
            [[ -f "$destination" && ! -L "$destination" ]] ||
                die "Refusing to replace non-regular destination: $destination"
            if ((FORCE == 0)); then
                continue
            fi
        fi
        files+=("$filename")
    done
    # If only one family was requested, preserve existing assets from other
    # families by staging them into the manifest-generation directory.
    for spec in "${FONT_SPECS[@]}"; do
        IFS='|' read -r family weight filename <<< "$spec"
        if ! font_matches_selection "$family"; then
            [[ -f "$FONT_DIR/$filename" ]] ||
                die "Cannot generate a complete manifest: missing $filename. Run the full downloader first."
            validate_woff2 "$FONT_DIR/$filename"
            cp -- "$FONT_DIR/$filename" "$PUBLISH_DIR/$filename"
        fi
    done
    # Generate a manifest from the exact staged content before publishing.
    generate_manifest "$PUBLISH_DIR" "$TMP_DIR/$MANIFEST_NAME"
    if ((DRY_RUN)); then
        log "Dry run: validated staging plan; no project files changed."
        return 0
    fi
    # Back up files that will be replaced. Any publication error triggers
    # rollback through the EXIT trap.
    for name in "${files[@]}"; do
        destination="$FONT_DIR/$name"
        if [[ -e "$destination" ]]; then
            mv -- "$destination" "$BACKUP_DIR/$name"
            BACKED_UP+=("$name")
        fi
    done
    for name in "${files[@]}"; do
        destination="$FONT_DIR/$name"
        staged="$PUBLISH_DIR/$name"
        # Refuse unexpected destination changes instead of blindly replacing.
        [[ ! -e "$destination" && ! -L "$destination" ]] ||
            die "Destination appeared during publication: $destination"
        cp -- "$staged" "$TMP_DIR/$name.publish"
        chmod 0644 "$TMP_DIR/$name.publish"
        mv -- "$TMP_DIR/$name.publish" "$destination"
        PUBLISHED+=("$destination")
    done
    # Publish the manifest last. Keep the old manifest for rollback.
    destination="$FONT_DIR/$MANIFEST_NAME"
    if [[ -e "$destination" || -L "$destination" ]]; then
        [[ -f "$destination" && ! -L "$destination" ]] ||
            die "Refusing to replace non-regular manifest."
        mv -- "$destination" "$BACKUP_DIR/$MANIFEST_NAME"
        BACKED_UP+=("$MANIFEST_NAME")
    fi
    cp -- "$TMP_DIR/$MANIFEST_NAME" "$TMP_DIR/$MANIFEST_NAME.publish"
    chmod 0644 "$TMP_DIR/$MANIFEST_NAME.publish"
    mv -- "$TMP_DIR/$MANIFEST_NAME.publish" "$destination"
    PUBLISHED+=("$destination")
    # Verify published files against the new manifest before committing.
    verify_manifest
    COMMIT_COMPLETE=1
    log "Publication completed successfully."
}
main() {
    parse_args "$@"
    if ((LIST_ONLY)); then
        list_fonts
        return 0
    fi
    if ((VERIFY_ONLY)); then
        verify_manifest
        return 0
    fi
    [[ -d "$FONT_DIR" && -w "$FONT_DIR" ]] ||
        die "Font directory is not writable: $FONT_DIR"
    TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/medorbits-fonts.XXXXXXXX")"
    PUBLISH_DIR="$TMP_DIR/staged"
    mkdir -p -- "$PUBLISH_DIR"
    local spec family weight filename
    local matched=0
    for spec in "${FONT_SPECS[@]}"; do
        IFS='|' read -r family weight filename <<< "$spec"
        font_matches_selection "$family" || continue
        matched=1
        download_font "$family" "$weight" "$filename"
    done
    ((matched)) || die "No font assets matched the selected family."
    # In dry-run mode, existing files are only validated/copied into staging.
    # If an asset is missing, a real download is intentionally not attempted.
    if ((DRY_RUN)); then
        for spec in "${FONT_SPECS[@]}"; do
            IFS='|' read -r family weight filename <<< "$spec"
            if ! font_matches_selection "$family"; then
                [[ -f "$FONT_DIR/$filename" ]] || {
                    warn "Manifest preview incomplete: missing $filename"
                    continue
                }
                cp -- "$FONT_DIR/$filename" "$PUBLISH_DIR/$filename"
            elif [[ ! -f "$PUBLISH_DIR/$filename" && -f "$FONT_DIR/$filename" ]]; then
                cp -- "$FONT_DIR/$filename" "$PUBLISH_DIR/$filename"
            fi
        done
        local missing=0
        for spec in "${FONT_SPECS[@]}"; do
            IFS='|' read -r family weight filename <<< "$spec"
            font_matches_selection "$family" || continue
            [[ -f "$PUBLISH_DIR/$filename" ]] || missing=1
        done
        if ((missing)); then
            log "Dry run complete. Missing files would be downloaded; no files changed."
            return 0
        fi
    fi
    publish_assets
    if ((DRY_RUN)); then
        log "Dry run complete."
        return 0
    fi
    printf '\n'
    log "Font assets and manifest verified."
    log "Directory: $FONT_DIR"
    log "Manifest: $FONT_DIR/$MANIFEST_NAME"
    if command -v du >/dev/null 2>&1; then
        printf '\nFont asset sizes:\n'
        du -h -- "$FONT_DIR"/*.woff2 2>/dev/null || true
    fi
    log "Version: $SCRIPT_VERSION"
}
main "$@"