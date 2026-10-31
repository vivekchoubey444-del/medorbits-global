# Header Policy

## Baseline headers

- `X-Content-Type-Options: nosniff` prevents MIME sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin` limits referrer leakage.
- `X-Frame-Options: DENY` provides legacy clickjacking protection. If MedOrbits must be embedded by a trusted partner, replace this with a deliberate CSP `frame-ancestors` policy.
- `Permissions-Policy` disables browser features not required by the current application. Adjust only when a verified feature needs access.
- `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy` can affect OAuth popups, cross-origin assets, and integrations; test before enforcing globally.

## Content Security Policy

CSP must reflect actual production dependencies. Inventory script, style, image, font, connect, frame, worker, and form-action origins. Prefer nonces or hashes over `unsafe-inline`; never add `unsafe-eval` without a documented requirement. Use Report-Only first.

## HSTS

Only send HSTS over HTTPS. Do not add `includeSubDomains` until all subdomains are HTTPS-ready. Do not request browser preload until the organization accepts the operational consequences and meets preload requirements.
