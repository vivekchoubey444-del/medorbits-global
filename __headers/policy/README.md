# MedOrbits HTTP Header Policy

Path: `__headers/policy/`

This directory defines provider-neutral HTTP security-header requirements.
It is documentation and policy data; it does not automatically configure
Cloudflare, Vercel or Nginx.

## Files
- `policy.json`: machine-readable baseline policy.
- `header-matrix.json`: provider configuration guidance.
- `exceptions.json`: approved exception register (initially empty).
- `policy.schema.json`: JSON Schema for policy validation.
- `review-checklist.md`: release and review checklist.

## Important
CSP must be tailored to the real application and tested before enforcement.
Enable HSTS only after confirming HTTPS for every affected hostname.
Do not publicly cache personalized, authenticated or sensitive responses.
Review iframe, OAuth, payment and popup flows before enabling isolation
or framing restrictions.

Validate JSON syntax from repository root:
```bash
node -e "for (const f of ['__headers/policy/policy.json','__headers/policy/header-matrix.json','__headers/policy/exceptions.json','__headers/policy/policy.schema.json']) JSON.parse(require('node:fs').readFileSync(f,'utf8')); console.log('Policy JSON valid')"
```
