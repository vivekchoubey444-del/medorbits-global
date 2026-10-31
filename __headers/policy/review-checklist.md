# MedOrbits HTTP Header Policy — Review Checklist

## Ownership
- [ ] Policy owner assigned.
- [ ] Review date recorded.
- [ ] Active hosting provider confirmed.
- [ ] Root deployment configuration identified.

## Header review
- [ ] `X-Content-Type-Options: nosniff`.
- [ ] Referrer policy configured.
- [ ] Framing policy compatible with iframe integrations.
- [ ] CSP sources inventoried and tested.
- [ ] HSTS enabled only after HTTPS coverage is confirmed.
- [ ] Permissions policy matches actual features.
- [ ] Cross-origin isolation tested with OAuth, payments and popups.

## Caching
- [ ] HTML is revalidated.
- [ ] Only fingerprinted assets use immutable caching.
- [ ] Authenticated and personalized responses are not publicly cached.
- [ ] API cache behavior is reviewed separately.

## Deployment
- [ ] Preview deployment completed.
- [ ] Actual response headers inspected.
- [ ] Homepage, important routes and APIs checked.
- [ ] Forms and iframe integrations tested.
- [ ] Browser console reviewed.
- [ ] Rollback plan available.

## Approval
| Field | Value |
|---|---|
| Reviewer | |
| Approval date | |
| Deployment | |
| Next review date | |
