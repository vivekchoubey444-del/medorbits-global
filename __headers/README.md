# MedOrbits `__headers/`

Centralized, deployment-specific HTTP security header templates for MedOrbits.

## Important deployment behavior

A folder named `__headers/` is not automatically interpreted by browsers, Node.js, Render, Cloudflare, Netlify, Vercel, Apache, or Nginx. Select the configuration that matches the actual hosting layer and copy/install it at the required location. Do not deploy every provider template simultaneously.

## Contents

- `policy/` — documented header policy and machine-readable baseline
- `netlify/` — Netlify `_headers` template
- `vercel/` — Vercel `headers` configuration fragment
- `nginx/` — Nginx include snippet
- `apache/` — Apache `.htaccess` snippet
- `express/` — Express middleware for the MedOrbits API
- `cloudflare/` — Cloudflare deployment notes and header rule plan
- `scripts/` — local policy checks
- `docs/` — rollout and verification guides

## Rollout sequence

1. Identify the authoritative edge/server that returns responses for each hostname.
2. Back up its current configuration.
3. Start with `Content-Security-Policy-Report-Only` if the frontend has not been audited for inline scripts, styles, fonts, images, frames, analytics, and API origins.
4. Add the non-CSP security headers first.
5. Test login, forms, API calls, images, fonts, payment redirects, embedded content, and PWA/service-worker behavior.
6. Convert CSP to enforcement only after resolving all violations.
7. Enable HSTS only after every affected hostname and subdomain is HTTPS-capable. `includeSubDomains` and `preload` are deliberate long-term commitments; do not enable them casually.

## Placeholders

Replace example origins and paths with verified MedOrbits production values. Never add wildcard `Access-Control-Allow-Origin` as a substitute for an application CORS allow-list.

## API integration

The Express middleware in `express/security-headers.js` can be used by the API app. Avoid duplicate/conflicting header middleware when the hosting edge already owns the same policy.
