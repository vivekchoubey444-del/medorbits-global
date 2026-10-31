
# MedOrbits Cloudflare Security Headers

**Project:** MedOrbits  
**Domain:** https://medorbits.in  
**Provider:** Cloudflare  
**Directory:** `/__headers/cloudflare/`  
**Version:** 1.0.0

—

## 1. Purpose

This directory contains Cloudflare-specific security response-header configuration references, validation scripts, deployment instructions, and live testing utilities for MedOrbits.

The objective is to establish consistent browser security headers while preserving compatibility with the website, APIs, authentication, payment integrations, and external services.

Cloudflare configuration is managed separately from repository files. These files document and validate the intended configuration; they do not automatically deploy Cloudflare rules.

## 2. Directory structure

```text
/__headers/cloudflare/
│
├── README.md
├── package.json
├── security-headers.json
├── transform-rule.json
├── deployment-checklist.md
├── validate-config.js
└── test-headers.js
```

## 3. File responsibilities

| File | Responsibility |
|—|—|
| `README.md` | Documentation and deployment guidance |
| `package.json` | Local validation and testing commands |
| `security-headers.json` | Cloudflare security-header policy reference |
| `transform-rule.json` | Response Header Transform Rule definitions |
| `deployment-checklist.md` | Production deployment checklist |
| `validate-config.js` | Local JSON and configuration validation |
| `test-headers.js` | Live HTTP response-header testing |

## 4. Cloudflare configuration

Open:

`Cloudflare Dashboard → Select medorbits.in → Rules → Transform Rules → Modify Response Header`

Create and review the response-header rules using `transform-rule.json` as a reference.

Recommended baseline headers:

| Header | Value |
|—|—|
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `SAMEORIGIN` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` |

Do not enable HSTS or enforce CSP until the application and domain configuration have been reviewed.

## 5. Configuration requirements

### Content Security Policy

- Start with report-only monitoring.
- Identify all external script and style dependencies.
- Review fonts, images, APIs, analytics, and payment services.
- Test authentication and embedded integrations.
- Enforce only after reviewing violations.

### HTTP Strict Transport Security

- Verify HTTPS on all affected hostnames.
- Verify certificate renewal.
- Review every subdomain.
- Do not enable `includeSubDomains` or `preload` without separate approval.

### CORS

CORS belongs to the application or API origin configuration.

Do not use Cloudflare browser security-header rules as a replacement for API CORS controls.

### Cache protection

Review Cloudflare Cache Rules independently.

Never publicly cache personalized or sensitive application responses, including account, dashboard, administrative, document, and payment routes.

## 6. Installation and validation

Requirements:

- Node.js >= 20
- npm
- Network connectivity for live testing

Run from the repository root:

```bash
cd __headers/cloudflare
npm run validate
```

Test the production website:

```bash
npm run test:production
```

Run both local validation and the default live test:

```bash
npm run check
```

Test a specific URL:

```bash
node test-headers.js https://medorbits.in/
```

## 7. Deployment procedure

1. Review the central policy at `../policy/policy.json`.
2. Review `security-headers.json`.
3. Review `transform-rule.json`.
4. Run local validation.
5. Record the existing Cloudflare configuration.
6. Create the approved Transform Rules manually.
7. Deploy baseline headers individually.
8. Verify production responses.
9. Test all important website and API workflows.
10. Document the deployment and rollback procedure.

## 8. Verification

Check the production response:

```bash
curl -sSI https://medorbits.in/
```

Check the www hostname:

```bash
curl -sSI https://www.medorbits.in/
```

Verify:

- Expected headers are present.
- Duplicate or conflicting values are absent.
- HTTPS redirects work.
- Login and registration work.
- Dashboards and forms work.
- APIs and uploads work.
- Payment and authentication integrations work.
- Browser console reports no new security-related failures.

## 9. Rollback

If a rule causes unexpected behavior:

1. Disable the affected Cloudflare Transform Rule.
2. Restore the previously approved header configuration.
3. Retest the affected routes.
4. Check origin and edge response headers.
5. Document the incident and corrective action.

Do not remove unrelated DNS, SSL, WAF, or firewall configuration during header rollback.

## 10. Security requirements

- Never store Cloudflare API tokens in this directory.
- Never commit API credentials or account secrets.
- Use environment variables for deployment credentials.
- Review configuration changes before production deployment.
- Keep security policies version-controlled.
- Avoid broad wildcard rules without testing.
- Do not claim successful deployment based only on local validation.

## 11. Related directories

```text
/__headers/
├── cloudflare/
├── express/
├── netlify/
├── nginx/
├── policy/
├── scripts/
└── vercel/
```

The central policy directory defines shared security requirements. Provider directories contain implementation-specific references.

—

**Maintainer:** MedOrbits  
**Website:** https://medorbits.in  
**Configuration status:** Ready for manual review and deployment.
