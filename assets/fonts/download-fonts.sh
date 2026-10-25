#!/usr/bin/env bash

MedOrbits -- Open-Source Font Downloader

File: assets/fonts/download-fonts.sh

Run from repository root:

bash assets/fonts/download-fonts.sh

Optional:

bash assets/fonts/download-fonts.sh –force

bash assets/fonts/download-fonts.sh –dry-run

Downloads font files from the official Google Fonts GitHub repository.

Existing files are preserved unless –force is supplied.

set -Eeuo pipefail

FORCE=0
DRY_RUN=0

for arg in "$@"; do
case "$arg" in
–force) FORCE=1 ;;
–dry-run) DRY_RUN=1 ;;
-h|–help)
echo "Usage: bash assets/fonts/download-fonts.sh [–force] [–dry-run]"
exit 0
;;
*)
echo "Unknown argument: $arg" >&2
exit 2
;;
esac
done

if ! command -v curl >/dev/null 2>&1; then
echo "ERROR: curl is required to download fonts." >&2
exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
echo "ERROR: python3 is required to generate the font manifest." >&2
exit 1
fi

Resolve the repository root relative to this script:

assets/fonts/download-fonts.sh -> repository root

SCRIPT_DIR="$(cd – "$(dirname – "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd – "$SCRIPT_DIR/../.." && pwd)"
FONT_DIR="$REPO_ROOT/assets/fonts"

mkdir -p "$FONT_DIR"

Official Google Fonts repository. Pinning a commit is recommended for

reproducible production builds; this uses the repository’s current main branch.

BASE_URL="https://raw.githubusercontent.com/google/fonts/main"

download_font() {
local family="$1"
local filename="$2"
local remote_path="$3"
local target="$FONT_DIR/$filename"
local url="$BASE_URL/$remote_path"

if [[ -f "$target" && "$FORCE" -ne 1 ]]; then
echo "PRESERVED $filename"
return 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
echo "WOULD DOWNLOAD $url -> $target"
return 0
fi

local tmp
tmp="$(mktemp "$FONT_DIR/.font-download.XXXXXX")"

echo "Downloading $family: $filename"
if curl –fail –location –silent –show-error 
–retry 3 –retry-delay 1 
"$url" -o "$tmp"; then
if [[ ! -s "$tmp" ]]; then
echo "ERROR: Downloaded file is empty: $filename" >&2
rm -f "$tmp"
return 1
fi

# Basic signature checks for WOFF2 and TTF files.
case "$filename" in
  *.woff2)
    if ! python3 - "$tmp" <<'PY'

import sys
with open(sys.argv[1], "rb") as f:
signature = f.read(4)
raise SystemExit(0 if signature == b"wOF2" else 1)
PY
then
echo "ERROR: Invalid WOFF2 signature: $filename" >&2
rm -f "$tmp"
return 1
fi
;;
*.ttf)
if ! python3 - "$tmp" <<‘PY’
import sys
with open(sys.argv[1], "rb") as f:
signature = f.read(4)
raise SystemExit(0 if signature in (b"\x00\x01\x00\x00", b"true", b"typ1") else 1)
PY
then
echo "ERROR: Invalid TTF signature: $filename" >&2
rm -f "$tmp"
return 1
fi
;;
esac

mv -f -- "$tmp" "$target"
echo "SAVED $target"

else
rm -f "$tmp"
echo "ERROR: Download failed: $url" >&2
return 1
fi
}

Web fonts for the MedOrbits website.

Variable fonts reduce the number of files while supporting multiple weights.

download_font "Inter" "inter-latin.woff2" 
"ofl/inter/Inter%5Bopsz%2Cwght%5D.woff2"

download_font "DM Sans" "dm-sans-latin.woff2" 
"ofl/dmsans/DMSans%5Bopsz%2Cwght%5D.ttf"

download_font "Playfair Display" "playfair-display-latin.woff2" 
"ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf"

if [[ "$DRY_RUN" -eq 1 ]]; then
echo
echo "Dry run complete. No font files or manifest were changed."
exit 0
fi

Write a manifest documenting source and licensing.

Google Fonts families are generally distributed under the SIL Open Font License;

verify each family directory’s OFL.txt before redistributing.

python3 - "$FONT_DIR/font-manifest.json" <<‘PY’
import json
import sys
from pathlib import Path

manifest_path = Path(sys.argv[1])
font_dir = manifest_path.parent

entries = [
{
"family": "Inter",
"file": "inter-latin.woff2",
"source": "https://github.com/google/fonts/tree/main/ofl/inter",
"license": "See the OFL.txt in the official family directory",
"usage": "Body text and UI"
},
{
"family": "DM Sans",
"file": "dm-sans-latin.woff2",
"source": "https://github.com/google/fonts/tree/main/ofl/dmsans",
"license": "See the OFL.txt in the official family directory",
"usage": "Headings and UI"
},
{
"family": "Playfair Display",
"file": "playfair-display-latin.woff2",
"source": "https://github.com/google/fonts/tree/main/ofl/playfairdisplay",
"license": "See the OFL.txt in the official family directory",
"usage": "Editorial and premium headings"
}
]

for entry in entries:
entry["downloaded"] = (font_dir / entry["file"]).is_file()

manifest_path.write_text(
json.dumps(
{
"project": "MedOrbits",
"directory": "/assets/fonts/",
"fonts": entries
},
indent=2,
ensure_ascii=False
) + "\n",
encoding="utf-8"
)
print(f"Created {manifest_path}")
PY

echo
echo "Font download process completed."
echo "Review font-manifest.json and retain the applicable font licence files before production."