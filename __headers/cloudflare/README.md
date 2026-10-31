# Cloudflare

Cloudflare response header modifications are configured at the zone/Rules layer, not by placing this directory in the repository.

Create a Response Header Transform Rule for the intended hostname/path scope and add the baseline headers listed in `../policy/security-headers.json`. Confirm whether the origin also sets these headers to avoid conflicting duplicate values.

Do not set HSTS, CSP enforcement, or broad cross-origin policies without testing all subdomains and application integrations. Keep origin CORS policy separate from browser security response headers.
