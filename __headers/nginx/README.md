
# MedOrbits Nginx Configuration

Version: 1.0.0
Project: MedOrbits
Purpose: Web server security and configuration

## Purpose

This directory contains reusable Nginx configuration
for MedOrbits production infrastructure.

## Configuration files

| File | Purpose |
|—|—|
| nginx.conf | Main Nginx configuration |
| medorbits.conf | Main website virtual host |
| security-headers.conf | HTTP security headers |
| ssl-params.conf | TLS configuration |
| gzip.conf | Compression settings |
| proxy-params.conf | Reverse proxy defaults |
| cache-rules.conf | Static asset caching |
| rate-limits.conf | Request rate limiting |
| locations.conf | Website route configuration |

## Deployment

1. Install Nginx.
2. Review all configuration paths.
3. Configure the correct domain and document root.
4. Configure valid TLS certificate paths.
5. Review Cloudflare proxy and origin settings.
6. Validate configuration:

   nginx -t

7. Reload Nginx:

   sudo systemctl reload nginx

## Important

These files are templates. They are not automatically
loaded by Nginx from this documentation directory.

Copy reviewed configurations into the appropriate
Nginx configuration directory.

Do not enable HSTS preload or includeSubDomains
without confirming HTTPS support across all subdomains.

Do not expose internal application ports publicly.
