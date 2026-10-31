
# MedOrbits HTTP Security Headers

Centralized, deployment-specific HTTP security header templates and validation tools for MedOrbits.

**Project:** MedOrbits  
**Domain:** https://medorbits.in  
**Directory:** `/__headers/`  
**Version:** 1.0.0  
**Status:** Configuration templates — deployment review required

—

## 1. Purpose

The `__headers/` directory provides a centralized location for managing, documenting, validating, and deploying HTTP security headers across MedOrbits infrastructure.

It supports multiple deployment environments:

- Cloudflare
- Netlify
- Vercel
- Nginx
- Apache
- Express.js

The objective is to maintain a consistent security-header policy while allowing each hosting provider and application layer to implement it using its own supported configuration format.

## 2. Important deployment behavior

A folder named `__headers/` is not automatically interpreted by browsers, Node.js, Render, Cloudflare, Netlify, Vercel, Apache, or Nginx.

Each provider requires its own configuration file in the appropriate location.

Examples:

| Provider | Expected configuration |
|—|—|
| Netlify | `_headers` in the published directory |
| Vercel | Root `vercel.json` |
| Nginx | Included server or location configuration |
| Apache | `.htaccess` or server configuration |
| Express | Middleware registered in the application |
| Cloudflare | Dashboard Transform Rules or supported API configuration |

**Important:** Do not deploy every provider template simultaneously. Identify the authoritative response layer for each hostname and avoid duplicate or conflicting headers.

## 3. Directory structure

```text
/__headers/
│
├── README.md
│
├── policy/
│   ├── README.md
│   ├── policy.json
│   ├── policy.schema.json
│   ├── header-matrix.json
│   ├── exceptions.json
│   └── review-checklist.md
│
├── netlify/
│   ├── README.md
│   ├── _headers.fragment
│   ├── netlify.toml
│   ├── security-policy.json
│   ├── validate-netlify.js
│   └── deployment-checklist.md
│
├── vercel/
│   ├── README.md
│   ├── headers.fragment.json
│   ├── vercel.config.json
│   ├── security-policy.json
│   ├── validate-headers.js
│   └── deployment-checklist.md
│
├── nginx/
│   ├── README.md
│   ├── security-headers.conf
│   ├── security-policy.json
│   └── deployment-checklist.md
│
├── apache/
│   ├── README.md
│   ├── security-headers.conf
│   ├── .htaccess.fragment
│   ├── security-policy.json
│   └── deployment-checklist.md
│
├── express/
│   ├── README.md
│   ├── package.json
│   ├── middleware/
│   │   └── security-headers.js
│   ├── config/
│   │   └── security-headers.json
│   ├── examples/
│   │   └── app-integration.js
│   ├── scripts/
│   │   └── validate-config.js
│   ├── tests/
│   │   └── security-headers.test.js
│   └── deployment-checklist.md
│
├── cloudflare/
│   ├── README.md
│   ├── package.json
│   ├── security-headers.json
│   ├── transform-rule.json
│   ├── deployment-checklist.md
│   ├── validate-config.js
│   └── test-headers.js
│
├── scripts/
│   ├── README.md
│   ├── validate-policy.js
│   ├── validate-provider-configs.js
│   └── check-duplicates.js
│
└── docs/
    ├── README.md
    ├── deployment-guide.md
    ├── verification-guide.md
    ├── rollback-guide.md
    └── troubleshooting.md
```

This is the target architecture. Create only files that are actually required by the repository and its deployment environment.

## 4. Central security policy

The `policy/` directory defines the provider-neutral security requirements.

Primary reference:

`/__headers/policy/policy.json`

Supporting files:

- `policy.schema.json` — policy structure validation.
- `header-matrix.json` — provider-specific implementation mapping.
- `exceptions.json` — documented exceptions.
- `review-checklist.md` — security review requirements.

Provider configurations should follow this central policy unless an approved exception is documented.

## 5. Supported HTTP security headers

| Header | Purpose |
|—|—|
| Content-Security-Policy | Controls permitted content sources |
| Content-Security-Policy-Report-Only | Monitors CSP violations |
| Strict-Transport-Security | Enforces HTTPS for future visits |
| X-Content-Type-Options | Prevents MIME-type sniffing |
| X-Frame-Options | Restricts framing |
| Referrer-Policy | Controls referrer information |
| Permissions-Policy | Restricts browser capabilities |
| Cross-Origin-Opener-Policy | Controls browsing-context isolation |
| Cross-Origin-Resource-Policy | Controls cross-origin resource access |

Not every header needs to be enabled for every application route. Evaluate compatibility and actual application requirements before deployment.

## 6. Rollout sequence

Follow this order for production deployment.

### Phase 1 — Infrastructure identification

1. Identify the authoritative edge or server returning responses for each hostname.
2. Identify whether Cloudflare, a hosting provider, Nginx, Apache, or Express owns the response headers.
3. Back up the existing configuration.
4. Identify existing response-header middleware and rules.
5. Review the central security policy.

### Phase 2 — Baseline headers

1. Add the approved non-CSP security headers.
2. Check for duplicate or conflicting origin and edge values.
3. Verify the production response.
4. Test the main website and API routes.

### Phase 3 — CSP monitoring

Start with `Content-Security-Policy-Report-Only` if the frontend has not been fully audited.

Inventory:

- Inline scripts and styles.
- External JavaScript sources.
- Stylesheets and fonts.
- Images and media.
- API and WebSocket origins.
- Analytics and advertising integrations.
- Payment gateways.
- Authentication and OAuth providers.
- Embedded content and frames.
- PWA and service-worker resources.

Resolve violations before enabling CSP enforcement.

### Phase 4 — HSTS

Enable HSTS only after verifying that every affected hostname and subdomain supports HTTPS.

Do not enable `includeSubDomains` or `preload` without a separate domain-wide review.

### Phase 5 — Production verification

Test:

- Website navigation.
- Registration and login.
- User dashboards.
- Forms and file uploads.
- API requests.
- Payment redirects.
- Authentication and OAuth.
- Images, fonts, and media.
- PWA installation and service-worker behavior.
- Embedded content and external integrations.

### Phase 6 — Documentation and maintenance

1. Record deployed header values.
2. Document exceptions.
3. Save the rollback procedure.
4. Record the deployment date.
5. Review changes whenever the application or hosting infrastructure changes.

## 7. Provider-specific implementation

### Cloudflare

Directory:

`/__headers/cloudflare/`

Use Cloudflare Response Header Transform Rules or another supported Cloudflare configuration mechanism.

Repository files are reference configurations; they do not automatically create dashboard rules.

### Netlify

Directory:

`/__headers/netlify/`

Use `_headers` in the published directory or supported `netlify.toml` configuration.

Do not assume a nested template is automatically loaded.

### Vercel

Directory:

`/__headers/vercel/`

Merge the approved header configuration into the root `vercel.json`.

Vercel does not automatically read `vercel.config.json` from this directory.

### Nginx

Directory:

`/__headers/nginx/`

Install the reviewed configuration snippet into the appropriate active Nginx server or location configuration.

Validate before reloading:

```bash
sudo nginx -t
```

### Apache

Directory:

`/__headers/apache/`

Use the reviewed `.htaccess` fragment or server-level configuration.

Confirm that the required Apache modules and `AllowOverride` settings are enabled.

Validate the active configuration before restarting or reloading Apache.

### Express

Directory:

`/__headers/express/`

Integrate the middleware into the MedOrbits API application.

Example:

```javascript
const securityHeaders = require(
  “./middleware/security-headers”
);

app.use(securityHeaders);
```

Register middleware in the intended order and avoid conflicting headers already set by the reverse proxy or hosting edge.

## 8. API integration

The Express security middleware can be used by the MedOrbits API.

Requirements:

- Do not expose internal server information unnecessarily.
- Avoid duplicate or conflicting security headers.
- Keep CORS configuration separate.
- Restrict credentialed cross-origin requests to approved origins.
- Validate authentication and authorization independently.
- Use appropriate cache controls for private API responses.
- Never expose secrets through response headers.

## 9. CORS policy

CORS is an application/API access-control mechanism, not a replacement for browser security response headers.

Never add:

```http
Access-Control-Allow-Origin: *
```

as a substitute for an application-specific origin allow-list when credentials are involved.

Use verified production origins and explicitly review preflight requests.

## 10. Caching requirements

Security headers do not automatically protect sensitive responses from public caching.

Avoid public caching of:

- Account pages.
- User dashboards.
- Administrative interfaces.
- Application records.
- Uploaded documents.
- Payment information.
- Personalized API responses.

Use appropriate `Cache-Control` directives at the authoritative application or hosting layer.

## 11. Local validation

Use the validation tools in `scripts/` and provider-specific directories.

Example:

```bash
node __headers/scripts/validate-policy.js
node __headers/cloudflare/validate-config.js
node __headers/express/scripts/validate-config.js
```

Provider-specific tests should only be run when their corresponding configuration files exist.

Live response testing example:

```bash
curl -sSI https://medorbits.in/
curl -sSI https://www.medorbits.in/
```

Local validation does not prove that production headers have been deployed successfully.

## 12. Security and secret management

Never commit:

- Cloudflare API tokens.
- Hosting-provider credentials.
- Private API keys.
- Database passwords.
- Session secrets.
- Authentication tokens.
- Private certificates or private keys.

Use environment variables or the hosting provider’s secure secret-management facility.

## 13. Rollback policy

Every production header deployment must have a rollback plan.

If an issue occurs:

1. Disable the affected rule or middleware.
2. Restore the previously approved configuration.
3. Verify affected routes.
4. Test authentication, API, and external integrations.
5. Document the incident.
6. Reintroduce the change only after validation.

Do not remove unrelated DNS, SSL, firewall, WAF, or routing configuration during a header rollback.

## 14. Completion criteria

The security-header rollout is considered complete only when:

- [ ] The authoritative response layer is identified for each hostname.
- [ ] Central policy is reviewed.
- [ ] Provider configuration is installed in the correct location.
- [ ] Duplicate and conflicting headers are resolved.
- [ ] Baseline headers are verified in production.
- [ ] CSP has been tested before enforcement.
- [ ] HSTS has been separately reviewed.
- [ ] CORS and caching are independently verified.
- [ ] Website and API functionality passes testing.
- [ ] Rollback procedures are documented.
- [ ] Deployment records are updated.

—

**Maintainer:** MedOrbits  
**Website:** https://medorbits.in  
**Directory:** `/__headers/`  
**Policy ownership:** MedOrbits Infrastructure  
**Deployment status:** Review required before production use
