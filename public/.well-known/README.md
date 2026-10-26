MedOrbits — Well-Known Resources

Website: https://medorbits.in/
Directory: public/.well-known/
Document type: Technical implementation and deployment specification
Scope: Resource discovery, application association, security disclosure, identity-provider metadata, and browser integration
Status: Implementation reference; production readiness must be verified per resource
Review date: 26 October 2026

⸻

1. Purpose and Scope

The .well-known/ directory provides standardized URLs through which compatible clients, browsers, identity providers, mobile applications, and security researchers can discover supported website capabilities.

For MedOrbits, these resources may support security vulnerability reporting, Apple Universal Links, password-change discovery, OpenID Connect provider metadata, and browser traffic-advice mechanisms.

This document defines the directory structure, resource responsibilities, implementation requirements, security controls, validation procedures, and maintenance expectations for these integrations.

Core principle: A resource is not operational merely because its file exists. Each resource must comply with its applicable specification, contain accurate configuration, and return the expected response from its production URL.

Only resources required by an actual MedOrbits integration should be deployed. Planned, optional, and unimplemented resources must not be represented as production-ready.

2. Directory Structure

The proposed project structure is:

public/
└── .well-known/
    ├── README.md
    ├── apple-app-site-association
    ├── change-password
    ├── openid-configuration
    ├── security.txt
    └── traffic-advice

The directory may contain additional resources when a documented integration requires them.

README.md is project documentation rather than a standardized protocol resource. If the hosting platform exposes the public/ directory directly, consider keeping the README under docs/ instead.

3. Resource Specifications

3.1 Security Disclosure — security.txt

Public URL: https://medorbits.in/.well-known/security.txt
Standard: RFC 9116

The security.txt resource enables security researchers to locate MedOrbits’ vulnerability-reporting contact and disclosure policy.

Supported fields may include:

* Contact — a monitored security reporting address or reporting URL.
* Policy — the public vulnerability-disclosure policy.
* Expires — the date and time after which the published information expires.
* Preferred-Languages — languages accepted for reports.
* Canonical — the canonical URL of the security.txt resource.

Implementation requirements

1. Follow RFC 9116 syntax and formatting requirements.
2. Publish a genuine, monitored reporting contact.
3. Ensure the referenced security policy is publicly accessible.
4. Set a valid expiry timestamp and renew the resource before expiration.
5. Keep contact details and response-time commitments accurate.
6. Serve the file over HTTPS as plain text.
7. Avoid publishing credentials, confidential information, or unmonitored contact details.

Reference: https://www.rfc-editor.org/rfc/rfc9116

3.2 Apple Application Association — apple-app-site-association

Public URL: https://medorbits.in/.well-known/apple-app-site-association

This resource associates an eligible website with an Apple application for Universal Links and supported associated-domain features.

Deploy it only when MedOrbits has an actual application integration that requires website association.

Implementation requirements

* Use valid JSON in Apple’s supported association format.
* Replace placeholders with the actual Apple Developer Team ID and application Bundle ID.
* Include only website paths that the application is designed to handle.
* Configure the Associated Domains capability in the application.
* Serve the file over HTTPS without authentication.
* Return the association document directly, without an HTML fallback or an unnecessary redirect.
* Verify the file against Apple’s current requirements and test links on supported devices.

The association file does not create an iOS application or enable Universal Links independently.

Reference: https://developer.apple.com/documentation/xcode/supporting-associated-domains

3.3 Password-Change Discovery — change-password

Public URL: https://medorbits.in/.well-known/change-password

This resource provides a conventional discovery location for MedOrbits’ password-change interface.

The resource should direct compatible clients to the actual password-change page, for example:

https://medorbits.in/account/change-password.html

The deployed resource must use a response method compatible with the relevant convention and client behavior. Where a redirect is used, verify its status code, destination, and handling by the intended clients.

Security requirements

* Require authentication before permitting a password change.
* Validate the user’s authenticated session.
* Apply appropriate CSRF protections.
* Verify the current password or require additional verification where appropriate.
* Rate-limit sensitive authentication operations.
* Never expose passwords, reset tokens, session secrets, or authentication credentials.
* Prevent user-controlled open redirects.
* Provide secure recovery procedures for users who cannot authenticate.

This resource only helps clients discover the interface. It does not implement password changes, authentication, or account recovery.

3.4 OpenID Connect Discovery — openid-configuration

Public URL: https://medorbits.in/.well-known/openid-configuration

This resource publishes OpenID Provider metadata if MedOrbits operates an OpenID Connect identity provider.

Depending on the implemented protocol profile, the document may describe:

* The issuer identifier.
* Authorization and token endpoints.
* User-information and public-key endpoints.
* Supported response types and grant types.
* Supported scopes, claims, and signing algorithms.
* Token endpoint authentication methods.
* Other required protocol capabilities.

Implementation requirements

1. Use the exact issuer identifier configured in the identity provider.
2. Advertise only endpoints and features that are actually implemented.
3. Ensure the issuer and endpoint URLs satisfy the applicable OpenID Connect requirements.
4. Publish valid public signing-key metadata when required.
5. Keep the discovery document synchronized with server configuration.
6. Validate issuer, audience, signature, expiry, nonce, and other required token properties in the relevant flows.
7. Test the complete authorization flow rather than validating the discovery document alone.

Do not publish placeholder endpoints or claim support for unsupported authentication methods. A login page alone does not make MedOrbits an OpenID Connect Provider. If MedOrbits uses an external identity provider, discovery metadata normally belongs to that provider.

Reference: https://openid.net/specs/openid-connect-discovery-1_0.html

3.5 Browser Traffic Advice — traffic-advice

Proposed public URL: https://medorbits.in/.well-known/traffic-advice

This resource may be used when MedOrbits deliberately implements a browser traffic-advice mechanism supported by the intended clients.

Before deployment:

* Identify the precise specification and client behavior being targeted.
* Confirm the required file format and permitted field values.
* Verify the required HTTP response status and content type.
* Validate the resource against the relevant specification.
* Test the behavior with the intended browsers or clients.
* Document the operational purpose and ownership of the configuration.

Do not assume that a JSON object describing a prefetch proxy is a valid traffic-advice resource. The exact schema and behavior depend on the applicable specification and implementation.

If no supported integration requires this resource, omit it until there is a verified use case.

3.6 Directory Documentation — README.md

Proposed project path: public/.well-known/README.md

Documents the directory’s intended resources, implementation status, validation process, deployment requirements, and maintenance responsibilities.

Recommended contents:

* Resource inventory and ownership.
* Specification references.
* Required environment-specific configuration.
* Local and production validation commands.
* Deployment and rollback procedures.
* Expiry and review requirements.
* Known limitations and outstanding integration work.

This README is not itself a standardized .well-known resource. Consider placing it at docs/security/well-known-resources.md if public exposure of implementation documentation is unnecessary.

4. Resource Readiness Matrix

Resource	Required when	Critical validation
security.txt	MedOrbits publishes a vulnerability disclosure contact	RFC 9116 syntax, contact, expiry
apple-app-site-association	An Apple application requires associated domains	Team ID, Bundle ID, JSON, paths
change-password	Password-change discovery is supported	Correct destination and secure workflow
openid-configuration	MedOrbits operates an OpenID Connect Provider	Issuer, endpoints, keys, protocol support
traffic-advice	A verified browser integration requires it	Applicable schema and client behavior
README.md	Documentation is maintained alongside the resources	Accurate implementation and maintenance details

The readiness matrix is a planning aid. It does not indicate that any resource has been deployed or verified.

5. HTTP and Hosting Requirements

For each deployed resource:

* Use HTTPS.
* Confirm the exact public URL.
* Return the expected HTTP status code.
* Set the appropriate content type.
* Avoid unintended authentication requirements.
* Preserve the response body through the static server, reverse proxy, CDN, and hosting platform.
* Avoid redirects where the applicable specification or client requires a direct response.
* Ensure fallback routing does not return the website homepage for missing resource files.
* Confirm that caching rules do not retain outdated security contacts, expired metadata, or obsolete application identifiers.

Recommended content types include:

Resource	Typical content type
security.txt	text/plain; charset=utf-8
apple-app-site-association	application/json
openid-configuration	application/json
traffic-advice	Determined by the applicable specification
change-password	Determined by the implemented redirect or response method

Verify content types against the requirements of the relevant specification and hosting environment.

6. Security Requirements

All resources and their associated services must follow these controls.

6.1 Information Protection

* Never publish API keys, private signing keys, passwords, access tokens, session cookies, or confidential application data.
* Use public keys only where a protocol explicitly requires them.
* Avoid exposing internal hostnames, administrative routes, infrastructure details, or sensitive implementation notes unnecessarily.

6.2 Identity and Authentication

* Protect password changes and other account operations with server-side authorization.
* Validate redirect URIs and token properties according to the relevant identity protocol.
* Apply appropriate rate limits to authentication and account recovery.
* Rotate signing keys through a controlled process and maintain valid key-discovery metadata.

6.3 Configuration Integrity

* Use validated configuration values rather than placeholders.
* Keep production endpoints consistent with the actual backend implementation.
* Review every newly advertised capability before publication.
* Remove stale resources when the corresponding integration is retired.

6.4 Responsible Disclosure

* Publish only contact details that MedOrbits monitors.
* Define an authorized vulnerability-reporting process.
* Avoid unsupported promises of legal protection or fixed remediation timelines.
* Handle submitted vulnerability reports and evidence with appropriate confidentiality.

Publishing discovery metadata does not replace server-side authentication, authorization, input validation, or application security controls.

7. Validation and Production Verification

Run the following checks for every resource that is actually deployed.

Step 1 — Local validation

* Verify the file path and filename.
* Validate JSON syntax where applicable.
* Check text files for specification-compliant formatting.
* Confirm that all required values are accurate.
* Search for placeholders and accidental secrets.

Step 2 — Staging validation

* Confirm the resource is served from the intended URL.
* Verify response status, content type, and body.
* Test redirect behavior and routing.
* Validate protocol-specific requirements.
* Test with the intended client or integration.

Step 3 — Production verification

Example commands:

curl -sS -D - \
  https://medorbits.in/.well-known/security.txt
curl -sS -D - \
  https://medorbits.in/.well-known/apple-app-site-association
curl -sS -D - \
  https://medorbits.in/.well-known/openid-configuration
curl -sS -D - \
  https://medorbits.in/.well-known/traffic-advice

These commands inspect HTTP responses; they do not by themselves validate protocol compliance. The traffic-advice URL should be checked only if the resource is intentionally deployed.

For change-password, inspect the response and confirm that the destination is the intended MedOrbits password-change page.

Step 4 — Record the result

For each resource, record:

* Resource name and public URL.
* Specification or integration supported.
* Validation date.
* HTTP response status and content type.
* Client or protocol test results.
* Outstanding defects.
* Responsible maintainer and next review date.

Do not mark a resource production-ready merely because it exists in the repository.

8. Related Website Resources

Keep related resources in their appropriate locations.

Resource	Typical path	Purpose
Robots directives	public/robots.txt	Search-engine crawling guidance
XML sitemap	public/sitemap.xml	Discovery of eligible public pages
Web application manifest	public/manifest.webmanifest	Web application metadata
Repository security policy	SECURITY.md	Repository vulnerability reporting
Security documentation	docs/security/	Internal security and deployment procedures

These resources serve different purposes. Do not move them into .well-known/ without a protocol-specific reason.

9. Maintenance and Change Management

Whenever a resource is added or modified:

1. Identify the integration that requires it.
2. Confirm the correct filename, schema, and HTTP behavior.
3. Replace placeholders with verified configuration values.
4. Validate the resource locally.
5. Test it in staging.
6. Deploy through the approved release process.
7. Verify the production URL after deployment.
8. Update this document and the resource inventory.
9. Review expiry dates, contact details, endpoints, identifiers, and supported capabilities periodically.
10. Remove obsolete resources when their integrations are retired.

Changes to identity-provider metadata, application association, and security reporting details should be reviewed before release because incorrect values can break integrations or weaken security.

10. Definition of Done

A resource is production-ready only when all applicable conditions are satisfied:

* [ ]	Its purpose and owning integration are documented.
* [ ]	Its content conforms to the applicable specification.
* [ ]	All required configuration values are verified.
* [ ]	No secrets or confidential information are exposed.
* [ ]	The expected public URL is accessible over HTTPS.
* [ ]	HTTP status, content type, response body, and redirect behavior are correct.
* [ ]	The intended client or integration has been tested.
* [ ]	Production verification has been recorded.
* [ ]	Maintenance and review responsibilities are assigned.
* [ ]	Any expiration or renewal requirements are tracked.

⸻

MedOrbits — Study · Work · Grow

Building a secure, accessible, and interoperable digital platform for education, admissions, careers, and professional opportunities.