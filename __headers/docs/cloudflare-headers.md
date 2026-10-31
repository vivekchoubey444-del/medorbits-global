# MedOrbits — Cloudflare Security Headers

## 1. Purpose

This document describes the HTTP security headers
used by the MedOrbits website through Cloudflare Pages.

## 2. Configuration File

Cloudflare Pages reads the following file:

    /_headers

The file must be located in the deployed static assets
directory. It is not a directory.

## 3. Supported Security Headers

| Header | Purpose |
|—|—|
| X-Content-Type-Options | Prevent MIME sniffing |
| X-Frame-Options | Control iframe embedding |
| Referrer-Policy | Restrict referrer information |
| Permissions-Policy | Restrict browser capabilities |
| Strict-Transport-Security | Enforce HTTPS |
| Cross-Origin-Opener-Policy | Isolate browsing contexts |
| Cross-Origin-Resource-Policy | Restrict cross-origin resource loading |

## 4. Deployment

1. Add the `_headers` file to the Cloudflare Pages
   output directory.
2. Commit and push the changes.
3. Allow Cloudflare Pages to deploy.
4. Inspect the deployed HTTP response headers.
5. Confirm that security headers are present.

## 5. Important Notes

- HSTS should only be enabled after HTTPS is configured.
- Do not deploy a Content Security Policy without
  reviewing scripts, styles, fonts and external services.
- Test iframe integrations before enforcing restrictive
  frame policies.
- Cloudflare Pages does not apply `_headers` rules to
  dynamically generated responses from all external
  services or Workers.