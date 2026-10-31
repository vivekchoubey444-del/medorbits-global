# MedOrbits — Header Security Scripts

## Purpose

Automated validation and inspection tools for
MedOrbits HTTP security headers.

## Scripts

| Script | Purpose |
|—|—|
| validate-headers.js | Validate the Cloudflare _headers file |
| check-live-headers.js | Inspect deployed HTTP response headers |
| check-csp.js | Review Content Security Policy |
| security-headers.config.json | Define expected security policies |

## Requirements

- Node.js >= 20
- HTTPS-enabled deployment for production checks
- Cloudflare Pages or compatible static hosting

## Usage

Validate configuration:

    node __headers/scripts/validate-headers.js

Check deployed headers:

    node __headers/scripts/check-live-headers.js https://medorbits.in

Check CSP:

    node __headers/scripts/check-csp.js

## Security

These scripts perform inspection only.

They do not modify Cloudflare settings, deploy code,
change DNS records or alter production headers.