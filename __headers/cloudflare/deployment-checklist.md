
# MedOrbits Cloudflare Security Headers Deployment Checklist

**Project:** MedOrbits  
**Domain:** https://medorbits.in  
**Provider:** Cloudflare  
**Configuration:** Response Header Transform Rules  
**Version:** 1.0.0  
**Status:** Deployment checklist

—

## 1. Pre-deployment requirements

- [ ] Confirm `medorbits.in` is active on Cloudflare.
- [ ] Confirm `www.medorbits.in` is configured if used.
- [ ] Verify the production origin is reachable.
- [ ] Confirm HTTPS certificates are valid.
- [ ] Record existing response headers.
- [ ] Identify headers already configured at the origin.
- [ ] Review `/__headers/policy/policy.json`.
- [ ] Review `/__headers/cloudflare/security-headers.json`.
- [ ] Review `/__headers/cloudflare/transform-rule.json`.
- [ ] Save the current Cloudflare configuration for rollback.

## 2. Cloudflare dashboard configuration

Navigate to:

`Cloudflare Dashboard → medorbits.in → Rules → Transform Rules → Modify Response Header`

For each approved rule:

- [ ] Create a descriptive rule name.
- [ ] Configure the hostname expression.
- [ ] Select the appropriate response-header operation.
- [ ] Enter the approved header name.
- [ ] Enter the exact header value.
- [ ] Review the expression before saving.
- [ ] Deploy one rule at a time.
- [ ] Verify the response before proceeding.

## 3. Baseline security headers

| Header | Recommended value | Initial status |
|—|—|—|
| X-Content-Type-Options | `nosniff` | Enable |
| X-Frame-Options | `SAMEORIGIN` | Enable after frame review |
| Referrer-Policy | `strict-origin-when-cross-origin` | Enable |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` | Review and enable |

Do not create duplicate or conflicting header values when the origin already supplies them.

## 4. Strict-Transport-Security (HSTS)

- [ ] Verify HTTPS on all affected hostnames.
- [ ] Confirm HTTP redirects to HTTPS.
- [ ] Confirm certificate renewal is operational.
- [ ] Review every subdomain.
- [ ] Confirm no required subdomain depends on HTTP.

**Initial configuration:** Disabled.

Only enable after the checks above pass.

Do not enable `includeSubDomains` or `preload` without a separate domain-wide review.

## 5. Content Security Policy (CSP)

Start with:

`Content-Security-Policy-Report-Only`

Before enforcing CSP:

- [ ] Inventory JavaScript sources.
- [ ] Inventory CSS and font sources.
- [ ] Inventory image and media sources.
- [ ] Identify API endpoints.
- [ ] Identify payment integrations.
- [ ] Identify authentication and OAuth integrations.
- [ ] Identify analytics and embedded services.
- [ ] Review browser console violations.
- [ ] Adjust the policy to the actual application dependencies.
- [ ] Test login, registration, dashboards, forms, and uploads.

Do not enforce a generic CSP without testing the application.

## 6. CORS and API protection

CORS must be configured separately at the application or API origin.

- [ ] Allow only approved frontend origins.
- [ ] Validate credentialed requests.
- [ ] Validate preflight `OPTIONS` requests.
- [ ] Avoid wildcard origins for credentialed requests.
- [ ] Review API authentication and authorization.
- [ ] Test cross-origin integrations.

Cloudflare security response headers do not replace API access controls.

## 7. Cache safety

Review Cloudflare Cache Rules separately.

Never publicly cache personalized or sensitive responses, including:

- `/account/*`
- `/dashboard/*`
- `/admin/*`
- `/api/*`
- `/applications/*`
- `/documents/*`
- `/payments/*`

Use appropriate `private` or `no-store` cache directives at the application or origin layer.

## 8. Production verification

Run these commands:

```bash
curl -sSI https://medorbits.in/
curl -sSI https://www.medorbits.in/
curl -sSI https://medorbits.in/robots.txt
```

Verify:

- [ ] Expected headers are present.
- [ ] No duplicate or conflicting values exist.
- [ ] HTTPS redirects work correctly.
- [ ] No unexpected caching occurs.
- [ ] Website navigation works.
- [ ] Registration and login work.
- [ ] Dashboard access works.
- [ ] Forms and file uploads work.
- [ ] API requests work.
- [ ] Payment and authentication integrations work.
- [ ] Browser console contains no new security-related failures.

## 9. Rollback procedure

If a rule causes unexpected application behavior:

1. Disable the affected Cloudflare Transform Rule.
2. Restore the previously approved header configuration.
3. Purge affected cache only when necessary.
4. Retest the affected routes and integrations.
5. Record the issue and corrective action.
6. Reintroduce the rule only after validation.

Never remove unrelated DNS, SSL, WAF, or firewall configuration during header rollback.

## 10. Deployment record

| Field | Value |
|—|—|
| Project | MedOrbits |
| Environment | Production |
| Domain | medorbits.in |
| Provider | Cloudflare |
| Deployment method | Manual |
| CSP enforcement | Pending review |
| HSTS | Pending HTTPS review |
| Rollback plan | Required |
| Final approval | Pending |

## 11. Completion criteria

Deployment is complete only when:

- [ ] All approved baseline headers are verified.
- [ ] CSP has been tested and approved, if deployed.
- [ ] HSTS has been separately reviewed, if deployed.
- [ ] Application and API functionality passes testing.
- [ ] Cache behavior has been verified.
- [ ] Rollback instructions are documented.
- [ ] Production deployment is recorded.

—

**Important:** This checklist documents the deployment process. It does not automatically create or deploy Cloudflare rules.
