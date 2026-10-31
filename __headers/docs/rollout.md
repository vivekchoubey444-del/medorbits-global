# Rollout and verification

## Before deployment

- Identify the active serving layer for the frontend and API.
- Confirm whether Render, Cloudflare, Netlify, Vercel, Nginx, or Apache is authoritative for each hostname.
- Back up existing rules.
- Inventory OAuth providers, payment redirects, embedded widgets, analytics, CDN assets, fonts, API hosts, and service workers.
- Test CSP in report-only mode.

## Verify response headers

```bash
curl -sSI https://YOUR-MEDORBIT-DOMAIN/
curl -sSI https://YOUR-MEDORBIT-API-HOST/health/live
```

Check the response headers for duplicate or conflicting values. Repeat for redirects, error responses, static assets, and API routes.

## Browser validation

Test login, registration, admission forms, file download/upload (if enabled), payment redirects (if enabled), college/course search, maps, chat, and PWA offline behavior.

## Rollback

Restore the saved provider/server configuration. Do not disable TLS or remove essential CORS controls as a shortcut.
