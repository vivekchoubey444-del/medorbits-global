# MedOrbits — Netlify Header Deployment Checklist

## Before deployment

- [ ] Confirm Netlify is the active hosting provider.
- [ ] Identify the site's base directory and publish directory.
- [ ] Check whether a root `netlify.toml` already exists.
- [ ] Merge header rules; do not overwrite existing build settings,
      redirects, functions or plugins.
- [ ] Confirm `/assets/` is the correct published asset path.
- [ ] Review iframe, OAuth, payment, popup and external integrations.
- [ ] Keep CSP disabled until the source inventory is complete.
- [ ] Keep HSTS disabled until HTTPS coverage is confirmed.

## Validate locally

```bash
node __headers/netlify/validate-netlify.js
```

This is a structural check, not a complete TOML parser or a live
deployment test.

## Deploy to a preview

Use a Netlify Deploy Preview or branch deploy first.

Inspect response headers:

```bash
curl -sSI https://YOUR-NETLIFY-PREVIEW/
curl -sSI https://YOUR-NETLIFY-PREVIEW/index.html
```

Replace `YOUR-NETLIFY-PREVIEW` with the real preview hostname.

## Production verification

- [ ] Homepage returns expected headers.
- [ ] HTML is revalidated rather than long-term cached.
- [ ] Static asset cache policy is correct.
- [ ] Authenticated and personalized responses are not publicly cached.
- [ ] API responses have separately reviewed cache and security behavior.
- [ ] Forms and iframe integrations work.
- [ ] Browser console has no unexpected policy errors.
- [ ] Rollback commit or deploy is available.

## Rollback

Revert the root `netlify.toml` or published `_headers` change and
redeploy the last known-good revision. Editing this reference directory
alone does not change the live Netlify deployment.
