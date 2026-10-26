
# MedOrbits — Well-Known Resources

**Directory:** `public/.well-known/`  
**Website:** https://medorbits.in/  
**Purpose:** Standardized resource discovery, application association, security disclosure, and protocol metadata.

—

## 1. Overview

The `.well-known/` directory contains resources published at standardized URLs so that compatible browsers, security researchers, identity providers, applications, and other clients can discover supported website capabilities.

MedOrbits may use this directory for security disclosure information, Apple application association, password-change discovery, OpenID Connect provider metadata, and browser traffic-advice resources.

**Implementation principle:** A filename alone does not activate a protocol or feature. Each published resource must contain valid, specification-compliant content and be served at the expected URL with the required HTTP behavior.

This directory describes intended resources. It does not imply that every resource is required, implemented, or production-ready.

## 2. Directory Structure

```text
public/
└── .well-known/
    ├── README.md
    ├── apple-app-site-association
    ├── change-password
    ├── openid-configuration
    ├── security.txt
    └── traffic-advice
```

Only resources required by an actual MedOrbits integration should be deployed. `README.md` is project documentation and is not itself a standardized protocol resource.

## 3. Resource Responsibilities

### 3.1 `security.txt`

**Public URL:** https://medorbits.in/.well-known/security.txt  
**Standard:** RFC 9116

Provides a standardized way for security researchers to discover MedOrbits’ vulnerability-reporting contact and disclosure policy.

Common fields include:

- `Contact` — a monitored security reporting address or reporting URL.
- `Policy` — the URL of the security disclosure policy.
- `Expires` — the expiration date and time of the published information.
- `Preferred-Languages` — languages accepted for security reports.
- `Canonical` — the canonical URL of the security.txt resource.

Requirements:

- Follow RFC 9116 field syntax and date formatting.
- Publish a real, monitored reporting contact.
- Ensure referenced policy URLs are valid and publicly accessible.
- Set an appropriate expiry date and renew the file before it expires.
- Avoid publishing unmonitored contact details or unsupported response-time commitments.

The file should be served as plain text over HTTPS at its canonical URL.

### 3.2 `apple-app-site-association`

**Public URL:** https://medorbits.in/.well-known/apple-app-site-association

Associates an eligible website with an Apple application for Universal Links and supported associated-domain capabilities.

When an Apple application integration is required:

- Provide valid JSON in Apple’s required format.
- Use the actual Apple Developer Team ID and application Bundle ID.
- Include only paths the application is designed to handle.
- Enable the Associated Domains capability in the application.
- Serve the resource publicly over HTTPS.
- Return the association document directly, without authentication or an HTML fallback.
- Verify the deployed response against Apple’s current requirements.

If MedOrbits has no associated Apple application, this resource is optional and should remain undeployed until needed.

### 3.3 `change-password`

**Public URL:** https://medorbits.in/.well-known/change-password

Provides a conventional discovery location for the website’s password-change interface.

If implemented, this resource should direct users to the actual MedOrbits password-change page using an appropriate redirect or a compatible fallback.

Security requirements:

- Require authentication before permitting a password change.
- Validate the user’s current authentication state.
- Apply appropriate session and CSRF protections.
- Require current-password verification or additional verification where appropriate.
- Never expose passwords, reset tokens, or session secrets.
- Prevent arbitrary user-controlled redirect destinations.

This resource only helps clients discover the password-change interface. It does not implement authentication, password changes, or password recovery.

### 3.4 `openid-configuration`

**Public URL:** https://medorbits.in/.well-known/openid-configuration

Publishes OpenID Provider metadata when MedOrbits operates an OpenID Connect identity provider.

Depending on the implemented specification and supported capabilities, the document may describe:

- The issuer identifier.
- Authorization and token endpoints.
- Supported response types and grant types.
- Supported scopes and signing algorithms.
- User-information and public-key discovery endpoints.
- Other required or supported protocol metadata.

Requirements:

- Use the actual issuer identifier.
- Advertise only implemented and supported capabilities.
- Ensure advertised endpoints are operational and secured.
- Publish valid signing-key metadata when required.
- Validate the document against the applicable OpenID Connect specification.

Do not publish placeholder metadata simply because MedOrbits has a login page. If MedOrbits only consumes an external identity provider, that provider’s discovery document generally belongs to the external provider.

### 3.5 `traffic-advice`

**Public URL:** https://medorbits.in/.well-known/traffic-advice

This resource may be used for browser traffic-advice information when MedOrbits deliberately implements the applicable mechanism.

Before publishing it:

- Identify the specific protocol and intended clients.
- Follow the applicable specification’s schema and permitted values.
- Validate the resource against that specification.
- Confirm the required HTTP response behavior.
- Test compatibility with the intended clients.

This resource is optional. If no actual integration requires it, omit it rather than publishing unverified example data.

### 3.6 `README.md`

**Project path:** `public/.well-known/README.md`

Documents the directory’s purpose, resource requirements, validation procedures, deployment expectations, and maintenance responsibilities.

This is internal project documentation, not a standardized `.well-known` protocol resource. If the hosting environment exposes the public directory directly, consider keeping the README in a private documentation directory instead.

## 4. Resource Readiness Checklist

Use this checklist to track implementation readiness.

- [ ] `security.txt` contains a real, monitored security contact.
- [ ] `security.txt` has a valid expiry date and current policy URL.
- [ ] `apple-app-site-association` is configured only when an Apple application association is required.
- [ ] `change-password` leads to a secure, functioning password-change interface.
- [ ] `openid-configuration` describes a real OpenID Connect Provider, if one is operated.
- [ ] `traffic-advice` follows the applicable specification, if used.
- [ ] Placeholder resources are replaced with valid content or omitted.
- [ ] Each deployed resource is accessible at its intended HTTPS URL.
- [ ] Required response formats and content types are preserved.
- [ ] Hosting, routing, and CDN rules do not block or rewrite required resources.
- [ ] Production verification results are documented.

## 5. Security and Deployment Requirements

Before deployment:

- Serve applicable resources over HTTPS.
- Never store API keys, credentials, access tokens, private keys, or confidential application data in this directory.
- Validate JSON resources and protocol-specific text files.
- Verify HTTP status codes, response bodies, and content types.
- Ensure reverse proxies, CDNs, and static-file routing preserve required paths and response formats.
- Avoid authentication requirements for resources that must be publicly discoverable.
- Restrict redirects to approved destinations.
- Review content whenever application identifiers, endpoints, security contacts, or supported capabilities change.

Some protocols require a resource to be served directly rather than redirected. Confirm the applicable requirements for each resource and ensure routing does not substitute the website homepage or an unrelated response.

**Security boundary:** Publishing discovery metadata does not replace server-side authentication, authorization, input validation, or protection of confidential resources.

## 6. Production Verification Procedure

For each resource MedOrbits actually uses:

1. Confirm that the relevant application or integration exists.
2. Verify the expected filename and public URL.
3. Validate the resource against its applicable specification.
4. Test the local or staging response.
5. Deploy the resource using the approved deployment process.
6. Verify the production URL, HTTP status, content type, and response body.
7. Confirm that the intended client or integration can consume it.
8. Record the verification result, date, and any maintenance requirements.

Do not mark a resource production-ready merely because its local file exists.

## 7. Related Resources

Keep other website resources in their appropriate locations:

| Resource | Typical location | Purpose |
|—|—|—|
| Robots directives | `public/robots.txt` | Crawl guidance for search engines |
| XML sitemap | `public/sitemap.xml` | Discovery of eligible public URLs |
| Web application manifest | `public/manifest.webmanifest` | Web application metadata, when used |
| Security policy | `SECURITY.md` | Repository security reporting guidance |
| Security documentation | `docs/security/` | Application security policies and procedures |

These resources serve different purposes. Do not move them into `.well-known/` without a protocol-specific reason.

## 8. Maintenance Procedure

When adding or updating a resource:

1. Identify the protocol or client that requires it.
2. Confirm the expected filename, format, and HTTP behavior.
3. Use actual configuration values rather than placeholders.
4. Validate the resource locally.
5. Verify the resource in staging.
6. Check the production URL after deployment.
7. Update this README when the directory changes.
8. Review expiry dates, reporting contacts, application identifiers, and endpoints periodically.
9. Remove obsolete resources when their associated integrations are retired.

## 9. Definition of Done

A resource is ready for production only when:

- [ ] Its purpose and owning integration are documented.
- [ ] Its content follows the applicable specification.
- [ ] All required values are accurate and verified.
- [ ] No secrets or confidential data are exposed.
- [ ] The intended URL returns the expected response.
- [ ] Required headers and redirect behavior are correct.
- [ ] The intended client or integration has been tested.
- [ ] Maintenance responsibilities are defined.

—

**MedOrbits — Study · Work · Grow**

*Standardized discovery resources for a secure, accessible, and interoperable web platform.*
