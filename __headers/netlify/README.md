# MedOrbits — Netlify Security Headers

**Directory:** `__headers/netlify/`  
**Version:** 1.0.0

## Purpose

Reusable Netlify response-header configuration and deployment guidance
for MedOrbits.

## Files

| File | Purpose |
|---|---|
| `netlify.toml` | Reference Netlify configuration using `[[headers]]` |
| `_headers.fragment` | Alternative static-hosting headers syntax |
| `security-policy.json` | Machine-readable header policy |
| `validate-netlify.js` | Local structural checks |
| `deployment-checklist.md` | Preview, verification and release checklist |

## Important: configuration placement

Netlify reads `netlify.toml` from the site's base directory, not from
`__headers/netlify/`.

For a production deployment, merge the reviewed `[[headers]]` blocks
from this directory's `netlify.toml` into the actual root `netlify.toml`.
Do not replace existing build settings, redirects, functions, plugins or
other configuration.

For static deployments, Netlify also supports a file named `_headers`
inside the published deploy directory. The `_headers.fragment` here is
a reference fragment; rename/copy it to `_headers` only after reviewing
the final published output and avoiding duplicate/conflicting rules.

Use one authoritative configuration approach where practical. If both
`netlify.toml` and `_headers` are used, review their combined effects.

## Validate

From the repository root:

```bash
node __headers/netlify/validate-netlify.js
```

This performs local structural checks only. It does not deploy, contact
Netlify, or prove that headers are present on the live site.

## Security notes

- CSP is intentionally omitted until the real application sources and
  third-party integrations have been inventoried.
- HSTS is intentionally omitted until HTTPS is confirmed for all
  affected hostnames. Do not add `includeSubDomains` or `preload`
  without a separate domain review.
- `X-Frame-Options: SAMEORIGIN` can affect iframe integrations.
- Review OAuth, payment, popup and cross-origin workflows before using
  cross-origin isolation headers.
- Do not publicly cache account, application, payment or authenticated
  responses.
- These headers do not replace authentication, authorization, input
  validation, secure cookies or API rate limiting.
