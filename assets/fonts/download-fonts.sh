#!/usr/bin/env bash
set -Eeuo pipefail
# ============================================================
# MedOrbits Font Asset Downloader
# Design system: Royal Burgundy and Champagne Gold
# Version: 1.2.0
#
# Families:
#   DM Sans           -- interface/body
#   Playfair Display  -- display headings
#   Cormorant Garamond -- classic Roman-style editorial text
#
# Requirements: Bash, curl, Python 3
# Run from repository root:
#   bash assets/fonts/download-fonts.sh
# ============================================================

readonly FONT_DIR="fonts"
readonly USER_AGENT="Mozilla/5.0"
readonly CONNECT_TIMEOUT=15
readonly MAX_TIME=90
readonly RETRIES=3
readonly ROMAN_TEXT_FAMILY="Cormorant Garamond"

TMP_DIR=""
cleanup() {
  if [[ -n "${TMP_DIR:-}" && -d "$TMP_DIR" ]]; then
    rm -rf -- "$TMP_DIR"
  fi
}
trap cleanup EXIT

die() { printf '[ERROR] %s\n' "$*" >&2; exit 1; }
log() { printf '[MedOrbits Fonts] %s\n' "$*"; }

for command in curl python3; do
  command -v "$command" >/dev/null 2>&1 || die "Required command not found: $command"
done

mkdir -p "$FONT_DIR"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/medorbits-fonts.XXXXXXXX")"
STAGED_DIR="${TMP_DIR}/staged"
mkdir -p "$STAGED_DIR"
MANIFEST_TMP="${TMP_DIR}/font-manifest.json"

download_font() {
  local family="$1"
  local weight="$2"
  local output="$3"
  local css_file="${TMP_DIR}/${output%.woff2}.css"
  local font_file="${STAGED_DIR}/${output}"
  local encoded_family="${family// /+}"
  local css_url="https://fonts.googleapis.com/css2?family=${encoded_family}:wght@${weight}&display=swap"
  local font_url

  log "Fetching ${family}, weight ${weight}"
  curl --fail --silent --show-error --location \
    --retry "$RETRIES" --retry-delay 2 --retry-all-errors \
    --connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME" \
    --user-agent "$USER_AGENT" "$css_url" --output "$css_file"

  [[ -s "$css_file" ]] || die "Empty Google Fonts CSS response: ${family} ${weight}"

  font_url="$(
    python3 - "$css_file" "$weight" <<'PY_PARSE'
import re
import sys
from pathlib import Path

css = Path(sys.argv[1]).read_text(encoding="utf-8")
requested_weight = sys.argv[2]
blocks = re.findall(r"/\*\s*(.*?)\s*\*/\s*@font-face\s*\{(.*?)\}", css, re.S)
matches = []
for subset, body in blocks:
    weight_match = re.search(r"font-weight\s*:\s*([^;]+)", body, re.I)
    if not weight_match or weight_match.group(1).strip() != requested_weight:
        continue
    src_match = re.search(
        r"url\(\s*['\"]?(https://fonts\.gstatic\.com/[^)'\"\s]+\.woff2)['\"]?\s*\)",
        body, re.I
    )
    if src_match:
        matches.append((subset.strip().lower(), src_match.group(1)))

latin = [url for subset, url in matches if subset == "latin"]
if not latin:
    sys.exit(
        f"No exact-weight Latin WOFF2 URL found for weight {requested_weight}. "
        "Inspect the returned Google Fonts CSS; the provider format may have changed."
    )
print(latin[0])
PY_PARSE
  )" || die "Could not extract font URL: ${family} ${weight}"

  log "Downloading ${output}"
  curl --fail --silent --show-error --location \
    --retry "$RETRIES" --retry-delay 2 --retry-all-errors \
    --connect-timeout "$CONNECT_TIMEOUT" --max-time "$MAX_TIME" \
    "$font_url" --output "$font_file"

  python3 - "$font_file" <<'PY_VALIDATE'
import sys
from pathlib import Path

path = Path(sys.argv[1])
if not path.is_file():
    sys.exit(f"Missing downloaded font: {path}")
data = path.read_bytes()
if len(data) < 1000:
    sys.exit(f"Font file is suspiciously small: {path}")
if data[:4] != b"wOF2":
    sys.exit(f"Invalid WOFF2 signature: {path}")
print(f"Validated WOFF2 signature ({len(data):,} bytes)")
PY_VALIDATE
}

# 1. DM Sans -- core interface weights
download_font "DM Sans" 400 "dm-sans-regular.woff2"
download_font "DM Sans" 500 "dm-sans-medium.woff2"
download_font "DM Sans" 600 "dm-sans-semibold.woff2"
download_font "DM Sans" 700 "dm-sans-bold.woff2"

# 2. Playfair Display -- premium headings
download_font "Playfair Display" 500 "playfair-display-medium.woff2"
download_font "Playfair Display" 600 "playfair-display-semibold.woff2"
download_font "Playfair Display" 700 "playfair-display-bold.woff2"

# 3. Cormorant Garamond -- Roman-style editorial text
download_font "$ROMAN_TEXT_FAMILY" 400 "cormorant-garamond-regular.woff2"
download_font "$ROMAN_TEXT_FAMILY" 500 "cormorant-garamond-medium.woff2"
download_font "$ROMAN_TEXT_FAMILY" 600 "cormorant-garamond-semibold.woff2"
download_font "$ROMAN_TEXT_FAMILY" 700 "cormorant-garamond-bold.woff2"

log "Generating font manifest"
python3 - "$STAGED_DIR" "$MANIFEST_TMP" <<'PY_MANIFEST'
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

font_dir = Path(sys.argv[1])
manifest_path = Path(sys.argv[2])

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
    path = font_dir / filename
    if not path.is_file():
        raise SystemExit(f"Missing font asset: {path}")
    data = path.read_bytes()
    if len(data) < 1000 or data[:4] != b"wOF2":
        raise SystemExit(f"Font validation failed: {path}")
    records.append({
        "file": filename,
        "path": f"fonts/{filename}",
        "family": family,
        "weight": weight,
        "format": "woff2",
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "genericFamily": generic_family,
        "purpose": purpose
    })

manifest = {
    "schemaVersion": "1.1.0",
    "package": "MedOrbits Fonts",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "designSystem": "Royal Burgundy and Champagne Gold",
    "fontFamilies": {
        "ui": {"family": "DM Sans", "fallback": "Arial, sans-serif"},
        "display": {"family": "Playfair Display", "fallback": "Georgia, serif"},
        "romanText": {"family": "Cormorant Garamond", "fallback": "Georgia, serif"}
    },
    "assets": records
}
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Manifest prepared for {len(records)} validated font assets.")
PY_MANIFEST

# Publish only after all assets validate and the manifest has been generated.
for file in \
  dm-sans-regular.woff2 dm-sans-medium.woff2 dm-sans-semibold.woff2 dm-sans-bold.woff2 \
  playfair-display-medium.woff2 playfair-display-semibold.woff2 playfair-display-bold.woff2 \
  cormorant-garamond-regular.woff2 cormorant-garamond-medium.woff2 \
  cormorant-garamond-semibold.woff2 cormorant-garamond-bold.woff2; do
  mv -f -- "${STAGED_DIR}/${file}" "${FONT_DIR}/${file}"
done
mv -f -- "$MANIFEST_TMP" "${FONT_DIR}/font-manifest.json"

printf '\n'
log "All 11 WOFF2 files downloaded and validated."
log "Manifest generated: ${FONT_DIR}/font-manifest.json"
if command -v du >/dev/null 2>&1; then
  printf '\nFont asset sizes:\n'
  du -h "$FONT_DIR"/*.woff2
fi
printf '\n'
log "Download process completed."
