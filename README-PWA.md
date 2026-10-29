# MedOrbits PWA — missing files only

This ZIP contains only the PWA files to add to the existing MedOrbits repository. It does not include or replace your existing website pages, stylesheets, scripts, or content.

## Add files
Copy the ZIP's contents into the repository root, preserving paths:
- `manifest.json`
- `service-worker.js`
- `pwa-register.js`
- `offline.html`
- `assets/pwa/icon-192.png`
- `assets/pwa/icon-512.png`
- `assets/pwa/icon-maskable-512.png`
- `install_pwa.py`

The repository already has HTML pages referencing `/manifest.json` in some areas, but the root manifest file itself was not present in the checked Git tree. No root service worker or PWA registration script was found.

## Connect existing HTML pages
From the repository root, run:
```bash
python install_pwa.py
```
This adds manifest/mobile metadata and a deferred PWA registration script to HTML/HTM files that need it. It does not intentionally change layout or page content. Review the result before deploying:
```bash
git diff --stat
git diff -- '*.html' '*.htm'
```

## Deploy
Upload the added files and the HTML files changed by `install_pwa.py` to the same root hosting location as your current website, keeping `/manifest.json`, `/service-worker.js`, `/pwa-register.js`, `/offline.html` and `/assets/pwa/` at those exact root paths. HTTPS is required for normal PWA installation.

## Verify
1. Open the website in Chrome.
2. DevTools → Application → Manifest: confirm the app name and icons load.
3. Application → Service Workers: confirm `/service-worker.js` is activated with scope `/`.
4. Open selected public pages online once, then test offline mode.
5. Install from Chrome's Install app option. On iPhone, open in Safari → Share → Add to Home Screen.

## Caching and safety
Only same-origin GET pages and assets are eligible. Account, admin, authentication, payment, upload and API paths are excluded from page caching. Dynamic forms and live data need a connection. Offline admission and fee information may be stale; reconnect and verify against official sources before acting.

## Existing manifest references
The installer preserves existing `<link rel="manifest" href="/manifest.json">` tags. If the site is deployed under a subdirectory instead of the domain root, the absolute `/...` paths in the manifest and registration need to be adjusted to that deployment base.
