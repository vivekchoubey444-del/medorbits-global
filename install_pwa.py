#!/usr/bin/env python3
"""Add missing PWA tags to MedOrbits HTML pages, preserving all existing page content/layout."""
from pathlib import Path
import re
ROOT = Path(__file__).resolve().parent
EXCLUDE_PARTS = {".git", "node_modules", "dist", "build", "coverage", ".next"}
def excluded(path):
    return any(part in EXCLUDE_PARTS for part in path.parts)
def main():
    changed, skipped = [], []
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".html", ".htm"} or excluded(path.relative_to(ROOT)):
            continue
        try:
            source = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            skipped.append(str(path.relative_to(ROOT))); continue
        original = source
        if not re.search(r'<link\b[^>]*rel=["\']manifest["\']', source, re.I):
            head_tags = (
                '\n  <link rel="manifest" href="/manifest.json">'
                '\n  <meta name="mobile-web-app-capable" content="yes">'
                '\n  <meta name="apple-mobile-web-app-capable" content="yes">'
                '\n  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
                '\n  <link rel="apple-touch-icon" href="/assets/pwa/icon-192.png">\n'
            )
            if re.search(r'</head\s*>', source, re.I):
                source = re.sub(r'</head\s*>', head_tags + '</head>', source, count=1, flags=re.I)
            else:
                skipped.append(str(path.relative_to(ROOT)) + " (no </head>)")
                continue
        else:
            # Existing manifest references are preserved. Ensure the iOS icon is available.
            if not re.search(r'<link\b[^>]*rel=["\']apple-touch-icon["\']', source, re.I):
                source = re.sub(r'</head\s*>', '\n  <link rel="apple-touch-icon" href="/assets/pwa/icon-192.png">\n</head>', source, count=1, flags=re.I)
        if not re.search(r'<script\b[^>]*src=["\'][^"\']*pwa-register\.js', source, re.I):
            script = '\n<script src="/pwa-register.js" defer></script>\n'
            if re.search(r'</body\s*>', source, re.I):
                source = re.sub(r'</body\s*>', script + '</body>', source, count=1, flags=re.I)
            else:
                source += script
        if source != original:
            path.write_text(source, encoding="utf-8")
            changed.append(str(path.relative_to(ROOT)))
    print(f"PWA tags added to {len(changed)} HTML files.")
    if skipped:
        print("Skipped:", *skipped, sep="\n - ")
    print("Review the changes with git diff before deploying.")
if __name__ == "__main__":
    main()
