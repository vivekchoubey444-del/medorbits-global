
# MedOrbits — Vercel Header Deployment Checklist

Version: 1.1.0
Project: MedOrbits
Platform: Vercel
Configuration: /vercel.json
Policy: /__headers/vercel/security-policy.json

—

## 1. Pre-deployment checks

- [ ] Confirm Vercel is the active hosting provider.
- [ ] Confirm the correct GitHub repository is connected.
- [ ] Check whether the repository already contains a root `vercel.json`.
- [ ] Preserve existing rewrites, redirects, routes, clean URLs and framework settings.
- [ ] Confirm the production output directory.
- [ ] Confirm `/assets/` exists in the deployed output.
- [ ] Check whether any pages need cross-origin iframe embedding.
- [ ] Test popup, OAuth, payment and external authentication flows.
- [ ] Review Permissions-Policy against actual browser feature usage.
- [ ] Keep CSP disabled until the source inventory and compatibility tests are complete.
- [ ] Keep HSTS disabled until all affected hostnames support HTTPS.
- [ ] Confirm that private student documents are not deployed as public static files.
- [ ] Confirm that API authorization is enforced server-side.
- [ ] Confirm that environment variables and secrets are not committed.

## 2. Configuration synchronization

Required files:

- [ ] `/vercel.json`
- [ ] `/__headers/vercel/vercel.config.json`
- [ ] `/__headers/vercel/headers.fragment.json`
- [ ] `/__headers/vercel/security-policy.json`
- [ ] `/__headers/vercel/validate-headers.js`

Checks:

- [ ] Header fragment matches reference configuration.
- [ ] Root configuration contains the approved header rules.
- [ ] Existing Vercel configuration has not been overwritten.
- [ ] No unintended duplicate header rules exist.
- [ ] No conflicting Cache-Control policies exist.
- [ ] Private routes have appropriate response caching.
- [ ] HSTS configuration has been reviewed.
- [ ] CSP configuration has been reviewed.

Important:

Nested configuration files are reference files.
Vercel automatically reads the root `/vercel.json`.
The nested files do not automatically modify production.

## 3. Local validation

Run:

```bash
node __headers/vercel/validate-headers.js
```

If the validator passes, continue with the Vercel CLI validation.

Optional JSON syntax checks:

```bash
node -e “JSON.parse(require(‘fs’).readFileSync(‘vercel.json’, ‘utf8’))”

node -e “JSON.parse(require(‘fs’).readFileSync(‘__headers/vercel/vercel.config.json’, ‘utf8’))”

node -e “JSON.parse(require(‘fs’).readFileSync(‘__headers/vercel/headers.fragment.json’, ‘utf8’))”

node -e “JSON.parse(require(‘fs’).readFileSync(‘__headers/vercel/security-policy.json’, ‘utf8’))”
```

## 4. Vercel deployment validation

- [ ] Verify Vercel CLI installation.
- [ ] Confirm the correct Vercel project.
- [ ] Inspect project build settings.
- [ ] Validate the root configuration with the Vercel CLI.
- [ ] Create a preview deployment.
- [ ] Inspect deployment logs.
- [ ] Confirm the deployment completed successfully.
- [ ] Verify the deployed commit matches the intended Git commit.

## 5. Preview response-header testing

Replace `YOUR-PREVIEW-DOMAIN` with the actual deployment hostname.

Homepage:

```bash
curl -sSI https://YOUR-PREVIEW-DOMAIN/
```

Index:

```bash
curl -sSI https://YOUR-PREVIEW-DOMAIN/index.html
```

Static assets:

```bash
curl -sSI https://YOUR-PREVIEW-DOMAIN/assets/
```

JSON data:

```bash
curl -sSI https://YOUR-PREVIEW-DOMAIN/assets/data/courses.json
```

API:

```bash
curl -sSI https://YOUR-PREVIEW-DOMAIN/api/health
```

For private endpoints, use an authorized test account and verify that unauthenticated requests are denied.

Check:

- [ ] `X-Content-Type-Options`
- [ ] `Referrer-Policy`
- [ ] `X-Frame-Options`
- [ ] `Permissions-Policy`
- [ ] `Cross-Origin-Opener-Policy`
- [ ] `Cache-Control`

## 6. Cache validation

HTML:

- [ ] HTML documents use revalidation.
- [ ] HTML responses do not receive unintended long-lived public caching.

Static assets:

- [ ] Static assets receive the intended cache policy.
- [ ] Content-hashed assets use immutable caching only when filenames are versioned.

JSON:

- [ ] Public JSON data has an appropriate short cache lifetime.
- [ ] Sensitive JSON data is never publicly cached.

API:

- [ ] Authentication responses use `no-store`.
- [ ] Personal information responses use `no-store`.
- [ ] Administrative responses use `no-store`.

Private documents:

- [ ] Private documents are stored outside public static directories.
- [ ] Authentication is enforced.
- [ ] Authorization is checked on every request.
- [ ] Private document responses use `private, no-store`.

## 7. Functional regression testing

- [ ] Homepage loads correctly.
- [ ] Education pages work.
- [ ] Medical admission pages work.
- [ ] Engineering admission pages work.
- [ ] Career pages work.
- [ ] Account pages work.
- [ ] Admin dashboard works.
- [ ] Search and filtering work.
- [ ] Forms submit correctly.
- [ ] OAuth and popup flows work.
- [ ] Payment integrations work.
- [ ] External document links work.
- [ ] Mobile navigation works.
- [ ] No unexpected browser console errors appear.

## 8. Security regression testing

- [ ] No secrets are exposed in frontend assets.
- [ ] Private documents cannot be accessed without authorization.
- [ ] Direct object reference attacks are tested.
- [ ] Administrative endpoints enforce role-based access.
- [ ] CORS does not permit unintended origins.
- [ ] Cookie security attributes are reviewed.
- [ ] No sensitive information is cached publicly.
- [ ] No directory listing is exposed.
- [ ] CSP is tested before enforcement.
- [ ] HSTS is enabled only after hostname verification.

## 9. Production approval

- [ ] Preview deployment approved.
- [ ] Security checks completed.
- [ ] Functional regression tests passed.
- [ ] Cache policies verified.
- [ ] Root configuration reviewed.
- [ ] Rollback commit identified.
- [ ] Production deployment authorized.

## 10. Production verification

- [ ] Homepage returns HTTP 200.
- [ ] HTML caching is correct.
- [ ] Static asset caching is correct.
- [ ] JSON caching is correct.
- [ ] API caching is correct.
- [ ] Private document access is protected.
- [ ] Security headers are present.
- [ ] No unexpected redirect loops occur.
- [ ] No broken links or missing assets appear.
- [ ] Production logs show no deployment errors.

## 11. Rollback procedure

If a header causes a production regression:

1. Identify the affected header and route.
2. Review the last known-good root `vercel.json`.
3. Revert the problematic configuration change.
4. Run local validation.
5. Deploy the last known-good revision.
6. Verify production response headers.
7. Retest the affected application workflows.
8. Document the incident and corrective action.

Do not assume editing this checklist or nested configuration files
changes production.

## 12. Deployment record

Record the following for every production release:

- Deployment ID:
- Git commit:
- Deployment date:
- Environment:
- Reviewer:
- Header validation:
- Functional testing:
- Security testing:
- Rollback commit:
- Approval status:

—

MedOrbits — Education · Admissions · Careers · Recruitment
Study. Work. Grow.
https://www.medorbits.in
