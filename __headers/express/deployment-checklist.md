# MedOrbits Express Security Headers — Deployment Checklist

## Integration
- [ ] Middleware is registered before application routes.
- [ ] Existing Helmet or proxy header configuration has been reviewed.
- [ ] Duplicate and conflicting headers have been removed.
- [ ] Error responses and API responses also receive intended headers.

## CSP and framing
- [ ] Scripts, styles, fonts, images, APIs and frame origins inventoried.
- [ ] CSP tested in report-only mode before enforcement.
- [ ] Enquiry forms, OAuth, payments and embedded widgets tested.
- [ ] X-Frame-Options behavior matches actual embedding requirements.

## HTTPS and proxy
- [ ] HTTPS is enforced at the trusted edge or application.
- [ ] HSTS enabled only after all covered hostnames support HTTPS.
- [ ] Express `trust proxy` is configured only for known trusted proxies.
- [ ] Client-supplied forwarded headers are not blindly trusted.

## Caching
- [ ] Authenticated and personalized responses are not publicly cached.
- [ ] API caching rules are explicit.
- [ ] Static assets are cached only according to their versioning strategy.

## Validation
Run from this directory:

```bash
npm install
npm run validate
npm test
```

Inspect a real deployed response:

```bash
curl -sSI https://medorbits.in/
```

## Production note

This middleware configures headers on Express responses only. It does
not configure Cloudflare, Vercel, Netlify or Nginx. Verify the final
headers after all proxy layers have processed the response.
