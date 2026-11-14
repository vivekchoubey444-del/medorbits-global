
# MedOrbits — Nginx Infrastructure

**Directory:** `/__headers/nginx/`  
**Project:** MedOrbits  
**Website:** https://medorbits.in  
**Canonical hostname:** `medorbits.in`  
**Secondary hostname:** `www.medorbits.in`  
**Configuration type:** Nginx reverse proxy, TLS, security and caching  
**Status:** Configuration template — deployment verification required

—

## 1. Overview

This directory contains the Nginx configuration templates responsible for
the HTTP delivery and reverse-proxy security layer of MedOrbits.

The configuration is designed to support:

- Static HTML, CSS, JavaScript and media delivery.
- HTTPS enforcement and canonical hostname redirection.
- TLS security configuration.
- HTTP security headers.
- Static asset and public data caching.
- Node.js / Express API reverse proxying.
- API and authentication rate limiting.
- Sensitive file and directory restrictions.
- Private document access restrictions.
- Operational validation and deployment.

Nginx is the web server and reverse-proxy layer. Application authentication,
authorization, database security and business logic remain responsibilities
of the backend application.

—

## 2. Directory Structure

```text
__headers/
└── nginx/
    ├── README.md
    ├── medorbits.conf
    ├── ssl-params.conf
    ├── security-headers.conf
    ├── security-deny.conf
    ├── proxy-params.conf
    ├── cache-rules.conf
    ├── rate-limits.conf
    └── tests/
        └── README.md
```

The files in this directory are source templates. Nginx does not automatically
load configuration files from the Git repository.

—

## 3. Configuration Reference

| File | Responsibility |
|—|—|
| `medorbits.conf` | Main virtual hosts |
| `ssl-params.conf` | TLS protocols, ciphers and sessions |
| `security-headers.conf` | Browser security headers |
| `security-deny.conf` | Sensitive path restrictions |
| `proxy-params.conf` | Backend proxy parameters |
| `cache-rules.conf` | HTTP caching policies |
| `rate-limits.conf` | Request and connection limits |

### 3.1 medorbits.conf

Defines:

- HTTP to HTTPS redirection.
- `www` to canonical hostname redirection.
- Main HTTPS virtual host.
- Website document root.
- API reverse-proxy location.
- Security and cache configuration includes.
- Error-page handling.

Expected document root:

```text
/var/www/medorbits
```

Expected API upstream:

```text
http://127.0.0.1:3000
```

Both values must be checked against the actual server deployment.

### 3.2 ssl-params.conf

Provides:

- TLS 1.2 and TLS 1.3.
- Approved TLS 1.2 cipher suites.
- Session cache configuration.
- Session ticket restrictions.
- OCSP stapling configuration where supported.

SSL certificates must be valid and must cover the required hostnames.

### 3.3 security-headers.conf

Centralizes:

- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- Optional Content Security Policy.
- Optional HTTP Strict Transport Security.

CSP and HSTS must be enabled only after the relevant compatibility and
HTTPS requirements have been verified.

### 3.4 security-deny.conf

Restricts direct requests to:

- Hidden files.
- Git metadata.
- Environment and configuration files.
- Database dumps.
- Temporary and backup files.
- Internal project directories.
- Private static document directories.

These restrictions are additional controls, not a substitute for keeping
sensitive files outside the public document root.

### 3.5 proxy-params.conf

Standardizes:

- HTTP proxy version.
- Forwarded request headers.
- Client IP forwarding.
- Upstream connection handling.
- Request and response buffering.
- Connection and response timeouts.
- Upstream error behavior.

The Express `trust proxy` configuration must match the actual trusted
proxy topology.

### 3.6 cache-rules.conf

Defines caching for:

- Static assets.
- HTML documents.
- Public JSON data.
- API responses.
- Account and admin pages.
- Private documents.

Do not cache authenticated or confidential responses publicly.

### 3.7 rate-limits.conf

Defines shared request-limit zones for:

- General API traffic.
- Authentication requests.
- Sensitive endpoints.
- Concurrent client connections.

Rate-limit zones must be declared in the Nginx `http` context.

Location-specific `limit_req` and `limit_conn` directives belong inside
the relevant virtual-host locations.

—

## 4. Deployment Architecture

Recommended server layout:

```text
/etc/nginx/
├── nginx.conf
├── mime.types
├── medorbits/
│   ├── ssl-params.conf
│   ├── security-headers.conf
│   ├── security-deny.conf
│   ├── proxy-params.conf
│   ├── cache-rules.conf
│   └── rate-limits.conf
├── sites-available/
│   └── medorbits.conf
└── sites-enabled/
    └── medorbits.conf
```

The repository files should be reviewed and copied into the appropriate
server configuration directories through a controlled deployment process.

Do not expose `/etc/nginx/` or repository configuration files through the
public website.

—

## 5. Parent nginx.conf Integration

The rate-limit zones must be loaded inside the `http` context.

Example:

```nginx
http {
    include /etc/nginx/mime.types;

    default_type application/octet-stream;

    server_tokens off;

    include /etc/nginx/medorbits/rate-limits.conf;

    include /etc/nginx/sites-enabled/*.conf;
}
```

Do not include `rate-limits.conf` inside a `server` or `location` block.

The other configuration files contain directives that must be included
inside the appropriate server or location contexts.

—

## 6. Website and API Routing

### Website

```text
https://medorbits.in/
```

Static website files are served from:

```text
/var/www/medorbits
```

### API

```text
https://medorbits.in/api/
```

The API is reverse-proxied to:

```text
127.0.0.1:3000
```

The API upstream should listen on loopback or another appropriately
restricted private interface.

Do not expose the backend port directly to the public internet.

—

## 7. Caching Policy

| Resource | Policy |
|—|—|
| CSS, JS, images, fonts | Public, 7 days |
| HTML | No-cache, must-revalidate |
| Public JSON | Public, 5 minutes |
| API | No-store |
| Account pages | Private, no-store |
| Admin pages | Private, no-store |
| Private documents | Private, no-store |

For fingerprinted assets, consider:

```http
Cache-Control: public, max-age=31536000, immutable
```

Use this only when filenames change whenever the underlying asset changes.

**Important:** Cache-control headers do not make a publicly deployed static
document private. Confidential documents must be delivered through
authenticated application routes or private object storage.

—

## 8. Security Requirements

### 8.1 TLS

- Disable SSLv3, TLS 1.0 and TLS 1.1.
- Use TLS 1.2 and TLS 1.3.
- Keep Nginx and OpenSSL updated.
- Renew certificates before expiration.
- Test both canonical and secondary hostnames.

### 8.2 HTTP security headers

- Enable MIME sniffing protection.
- Restrict framing.
- Configure a restrictive referrer policy.
- Restrict unnecessary browser permissions.
- Test cross-origin policies against OAuth and payment integrations.

### 8.3 HSTS

Enable HSTS only after confirming HTTPS works on every hostname covered
by the policy.

Do not enable `includeSubDomains` or preload without verifying that all
affected subdomains are HTTPS-ready.

### 8.4 Content Security Policy

Begin with report-only mode.

Test:

- External fonts.
- Payment gateways.
- Authentication providers.
- Analytics.
- Embedded resources.
- Third-party scripts.

Enforce the policy only after legitimate violations have been resolved.

### 8.5 Sensitive files

Never deploy the following into the public document root:

- `.env` files.
- Private keys.
- Database credentials.
- SQL dumps.
- Backups.
- Internal repository metadata.
- Private admission documents.
- User-uploaded confidential files.

—

## 9. Cloudflare Compatibility

If Cloudflare proxies traffic to the Nginx origin:

1. Configure the Nginx real-IP module.
2. Trust only official Cloudflare IP ranges.
3. Use the appropriate trusted visitor-IP header.
4. Keep the origin server protected from direct unauthorized access.
5. Configure rate limits using the restored visitor IP.
6. Avoid trusting arbitrary client-supplied forwarding headers.

Do not use `$http_x_forwarded_for` directly as a trusted identity.

Cloudflare and Nginx must agree on the origin HTTPS configuration.

—

## 10. Validation

Always test the configuration before reloading Nginx.

### Syntax validation

```bash
sudo nginx -t
```

### Full effective configuration

```bash
sudo nginx -T
```

### Service status

```bash
sudo systemctl status nginx
```

### Reload after successful validation

```bash
sudo systemctl reload nginx
```

Never reload an invalid configuration.

—

## 11. HTTP Response Testing

### Main website

```bash
curl -sSI https://medorbits.in/
```

### Canonical redirect

```bash
curl -sSI https://www.medorbits.in/
```

### API health

```bash
curl -sSI https://medorbits.in/api/health
```

### Account and admin routes

```bash
curl -sSI https://medorbits.in/account/
curl -sSI https://medorbits.in/admin/
```

### Sensitive files

```bash
curl -sSI https://medorbits.in/.env
curl -sSI https://medorbits.in/.git/config
curl -sSI https://medorbits.in/__headers/nginx/medorbits.conf
```

### Private documents

```bash
curl -sSI https://medorbits.in/official-documents/private/sample.pdf
```

### Public JSON

```bash
curl -sSI https://medorbits.in/assets/data/courses.json
```

Verify actual response status codes and headers rather than assuming
that the configuration behaves as intended.

—

## 12. Rate-Limit Testing

Use a controlled test environment.

Verify:

- Normal API requests succeed.
- Excessive requests receive HTTP 429.
- Authentication endpoints have stricter limits.
- Legitimate visitors are not grouped under one proxy IP.
- Limits do not unintentionally block health checks or monitoring.
- Application-level rate limits remain active.

Nginx rate limiting does not replace application-level abuse prevention.

—

## 13. Deployment Checklist

### Before deployment

- [ ] Review all Nginx configuration files.
- [ ] Confirm actual document root.
- [ ] Confirm API upstream address and port.
- [ ] Confirm certificate paths.
- [ ] Confirm certificate hostname coverage.
- [ ] Confirm Cloudflare real-IP configuration if applicable.
- [ ] Check for duplicate or conflicting location blocks.
- [ ] Verify that private files are outside the public root.
- [ ] Verify Nginx version compatibility.

### Before reload

- [ ] Run `nginx -t`.
- [ ] Inspect `nginx -T`.
- [ ] Resolve all configuration errors.
- [ ] Review warnings.
- [ ] Preserve the previous working configuration.

### After deployment

- [ ] Verify HTTPS.
- [ ] Verify canonical hostname redirection.
- [ ] Verify security headers.
- [ ] Verify caching behavior.
- [ ] Verify API proxying.
- [ ] Verify rate limits.
- [ ] Verify private file restrictions.
- [ ] Verify application login and authorization.
- [ ] Review Nginx access and error logs.

—

## 14. Logging and Monitoring

Monitor:

```text
/var/log/nginx/access.log
/var/log/nginx/error.log
```

Monitor for:

- Repeated HTTP 401 and 403 responses.
- Excessive HTTP 429 responses.
- Unexpected HTTP 5xx responses.
- Repeated requests for hidden files.
- Suspicious API request patterns.
- Upstream connection failures.
- TLS and certificate errors.

Do not log passwords, authorization tokens, session cookies or sensitive
personal information.

—

## 15. Rollback Procedure

Before changing production configuration, preserve a known-good copy.

Example:

```bash
sudo cp -a /etc/nginx /etc/nginx.backup
```

If a deployment fails:

1. Restore the previous working configuration.
2. Run `sudo nginx -t`.
3. Reload Nginx only after successful validation.
4. Verify website and API availability.
5. Review the error log.
6. Record the deployment failure and corrective action.

—

## 16. Operational Responsibility

Nginx is responsible for:

- TLS termination.
- HTTP routing.
- Reverse proxying.
- Browser response headers.
- Static resource delivery.
- Request rate limiting.
- Direct file-access restrictions.

The MedOrbits backend is responsible for:

- User authentication.
- Role-based authorization.
- Admission and document access permissions.
- Database access control.
- Input validation.
- Session management.
- IDOR prevention.
- Audit logging.
- Business logic.

Neither Nginx configuration nor hidden frontend links should be treated
as substitutes for backend security controls.

—

## 17. Maintenance

Review this configuration:

- After Nginx or OpenSSL upgrades.
- After changing API routes.
- After changing the public website structure.
- After adding third-party integrations.
- After changing Cloudflare settings.
- After security incidents.
- At least every 90 days.

Maintain version-controlled configuration changes and document every
production deployment.

—

## 18. Important Notice

This directory contains configuration templates, not proof of a secure
production deployment.

All paths, TLS settings, proxy topology, cache policies, access rules and
rate limits must be verified against the actual MedOrbits server.

**MedOrbits — Education · Admissions · Careers · Recruitment**

Website: https://www.medorbits.in  
Tagline: Study. Work. Grow.
