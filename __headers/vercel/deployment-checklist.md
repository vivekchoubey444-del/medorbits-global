# MedOrbits — Vercel Header Deployment Checklist

## Before deployment

- [ ] Confirm Vercel is the active hosting provider for this deployment.
- [ ] Check whether the repository already has a root `vercel.json`.
- [ ] Merge header rules rather than replacing existing rewrites, redirects,
      clean URLs, framework settings or other configuration.
- [ ] Confirm the asset directory is actually `/assets/` in the deployed output.
- [ ] Review whether any pages need to be embedded by another origin.
- [ ] Test popup, OAuth, payment and external authentication flows.
- [ ] Review the Permissions-Policy against actual browser feature usage.
- [ ] Keep CSP out until the source inventory is complete.
- [ ] Keep HSTS out until all affected hostnames are HTTPS-ready.

## Validate

```bash
node __headers/vercel/validate-headers.js
```

Then validate the root Vercel configuration using the Vercel CLI
or a preview deployment.

## Preview response headers

```bash
curl -sSI https://YOUR-PREVIEW-DOMAIN/
curl -sSI https://YOUR-PREVIEW-DOMAIN/index.html
curl -sSI https://YOUR-PREVIEW-DOMAIN/assets/
```

Replace `YOUR-PREVIEW-DOMAIN` with the actual deployment hostname.

## Production checks

- [ ] Homepage returns the expected headers.
- [ ] HTML is not cached as a long-lived public asset.
- [ ] Versioned static assets return the intended cache policy.
- [ ] Account and application responses are not publicly cached.
- [ ] API responses have their own appropriate cache and security policy.
- [ ] Forms and iframe integrations still work.
- [ ] No unexpected CSP or browser console errors appear.
- [ ] Rollback configuration is available.

## Rollback

If a response header breaks a production workflow, revert the relevant
root `vercel.json` change and redeploy the last known-good revision.
Do not assume editing this documentation fragment changes production.
