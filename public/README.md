
# MedOrbits — Public Assets

**Directory:** `public/`  
**Website:** https://medorbits.in/  
**Purpose:** Manage public static resources for search-engine discovery, browser compatibility, application association, protocol discovery, and security transparency.

—

## 1. Overview

The `public/` directory contains static resources intended to be served directly by the MedOrbits website. These resources may support search engines, browsers, application integrations, website verification, and standardized security disclosures.

Treat every file in this directory as potentially accessible without authentication.

**Never store** API keys, private application records, personal documents, session tokens, database credentials, private keys, or other confidential information in public assets.

The presence of a file does not prove that it is valid, publicly accessible at its expected URL, or actively used. Verify its contents, references, hosting configuration, and deployed response before relying on it.

## 2. Directory Structure

```text
public/
├── README.md
├── .well-known/
│   ├── README.md
│   ├── apple-app-site-association
│   ├── change-password
│   ├── openid-configuration
│   ├── security.txt
│   └── traffic-advice
├── ads.txt
├── browserconfig.xml
├── humans.txt
├── robots.txt
└── sitemap.xml
```

This tree documents the intended structure, not proof that every file exists, is required, or is ready for production.

The `.well-known/` resources are optional unless an applicable protocol, policy, or integration requires them. Populate required resources with valid, specification-compliant content. Remove unused placeholders rather than publishing empty or misleading files.

## 3. Core Public Files

### 3.1 `robots.txt`

**Expected URL:** https://medorbits.in/robots.txt

Provides crawl directives for compliant search-engine crawlers.

Maintenance requirements:

- Reference the correct production sitemap URL.
- Review crawl rules whenever public pages or URL structures change.
- Avoid unintentionally blocking important education, admissions, and career pages.
- Do not use crawler directives as access controls.
- Avoid unnecessary disclosure of sensitive route names.
- Confirm that the deployed rules match the intended crawl policy.

**Security note:** `robots.txt` is publicly readable. Disallowing a path does not prevent access to that path.

### 3.2 `sitemap.xml`

**Expected URL:** https://medorbits.in/sitemap.xml

Lists canonical URLs that search engines can discover and consider for indexing.

Maintenance requirements:

- Include only eligible, canonical public pages.
- Use the correct production HTTPS domain.
- Exclude private account pages, administrative interfaces, and URLs containing sensitive data.
- Remove obsolete, duplicate, redirected, and inaccessible URLs where appropriate.
- Keep the sitemap synchronized with the deployed website.
- Validate XML structure and URL formatting before deployment.
- Include `lastmod` only when accurate modification dates can be maintained.

A sitemap helps search engines discover URLs; it does not guarantee indexing, ranking, or display in search results.

### 3.3 `ads.txt`

**Expected URL:** https://medorbits.in/ads.txt

Declares authorized digital advertising sellers when MedOrbits participates in advertising arrangements that use the ads.txt standard.

Maintenance requirements:

- Include only verified records supplied by the relevant advertising partners.
- Confirm advertising-system domains, publisher account IDs, relationship types, and certification authority IDs.
- Remove obsolete records when advertising relationships end.
- Review the file whenever advertising arrangements change.
- Omit the file if no applicable advertising integration exists.

Never invent seller records or publisher IDs. Do not publish example values as production authorization records.

### 3.4 `browserconfig.xml`

**Expected URL:** https://medorbits.in/browserconfig.xml

Provides legacy Microsoft browser and Windows tile configuration.

Retain this file only if the website references it or requires its supported functionality.

Maintenance requirements:

- Confirm that referenced image assets exist.
- Match declared paths to deployed asset locations.
- Verify image dimensions and XML syntax.
- Remove obsolete references when the feature is no longer used.

This file is optional for websites that do not need the associated legacy functionality.

### 3.5 `humans.txt`

**Expected URL:** https://medorbits.in/humans.txt

Provides optional project credits and general information about the people or organizations responsible for the website.

Maintenance requirements:

- Keep content appropriate for public access.
- Obtain authorization before publishing personal details.
- Exclude credentials, private staff information, internal infrastructure details, and confidential contact information.
- Keep organizational and technology information accurate.

This file is optional and is not a security control or a search-engine ranking requirement.

### 3.6 `README.md`

**Project path:** `public/README.md`

Documents the purpose, contents, maintenance requirements, and deployment expectations of the public directory.

This file is primarily for maintainers. If the public directory is served directly, consider storing project documentation outside it to avoid exposing internal maintenance notes unnecessarily.

A public README does not replace MedOrbits’ privacy policy, terms of service, or security disclosure process.

## 4. The `.well-known/` Directory

**Project path:** `public/.well-known/`

This directory contains standardized resources for security reporting, protocol discovery, and optional application associations.

| Resource | Intended purpose |
|—|—|
| `security.txt` | Publishes security reporting contact and policy information. |
| `apple-app-site-association` | Associates a compatible website with an Apple application. |
| `change-password` | Supports password-change page discovery when implemented. |
| `openid-configuration` | Publishes OpenID Connect Provider metadata when MedOrbits operates such a provider. |
| `traffic-advice` | Provides browser traffic-advice information when the applicable mechanism is implemented. |

Refer to `public/.well-known/README.md` for resource-specific requirements, validation procedures, and deployment guidance.

Do not publish metadata that claims support for an integration MedOrbits does not actually operate.

### Resource-specific considerations

- **`security.txt`:** Follow RFC 9116. Use a real, monitored reporting contact and maintain valid policy and expiry information.
- **`apple-app-site-association`:** Use the actual application identifiers and Apple’s required format. Publish only when an applicable Apple application integration exists.
- **`change-password`:** Direct users to the real password-change interface. Enforce authentication and authorization in the application itself.
- **`openid-configuration`:** Publish only when the advertised identity-provider endpoints and capabilities are implemented and verified.
- **`traffic-advice`:** Confirm the relevant protocol, supported clients, schema, and response requirements before publishing.

For resources that require a direct response, ensure that hosting rules do not replace them with the homepage or redirect them to an unrelated destination.

## 5. Optional Web Application Resources

Depending on the implemented website features, consider adding:

| Resource | Purpose |
|—|—|
| `manifest.webmanifest` | Web application name, icons, theme colors, and installation metadata. |
| `favicon.ico` | Browser tab and bookmark icon. |
| `apple-touch-icon.png` | Icon for supported Apple home-screen shortcuts. |
| `site.webmanifest` | Alternative manifest filename, only when deliberately selected. |

Avoid duplicate manifests without a clear reason. Ensure HTML references match the actual filenames, MIME types, and deployed paths.

Add only resources required by the website’s actual design and integrations.

## 6. Static File Serving

The hosting platform or Express application must serve static resources from the intended public root.

### Expected resource URLs

| Resource | Expected URL |
|—|—|
| Robots directives | `/robots.txt` |
| XML sitemap | `/sitemap.xml` |
| Advertising authorization | `/ads.txt`, when applicable |
| Browser configuration | `/browserconfig.xml`, when used |
| Security disclosure | `/.well-known/security.txt` |
| Apple application association | `/.well-known/apple-app-site-association`, when applicable |
| Password-change discovery | `/.well-known/change-password`, when implemented |
| OpenID Connect metadata | `/.well-known/openid-configuration`, when applicable |
| Traffic advice | `/.well-known/traffic-advice`, when implemented |

Confirm that:

- Required resources return the expected HTTP status.
- Content types are appropriate for each resource.
- Dot-directory paths are not inadvertently blocked by the host, CDN, or reverse proxy.
- HTML fallback routing does not replace JSON, XML, or plain-text resources with the homepage.
- Cache rules do not serve stale protocol or SEO files indefinitely.
- File paths map to the correct deployment root.
- No unintended directory listings or source files are exposed.

If Express serves these files, review the static middleware configuration in `server.mjs`, `src/app.js`, or the actual application entry point. Confirm middleware order and route precedence against the deployed application.

Do not expose source files, environment files, private uploads, configuration files, or unintended directory listings.

## 7. Security and Privacy Requirements

Treat every file in `public/` as publicly accessible.

- Never store secrets, private keys, tokens, or confidential user information.
- Do not publish internal credentials or sensitive infrastructure details.
- Keep security reporting information accurate and monitored.
- Validate protocol-specific JSON, XML, and text resources before deployment.
- Review content types and CDN caching behavior.
- Protect private account and administrative routes with server-side authentication and authorization.
- Do not assume that an obscure URL or hidden frontend link provides security.
- Review public files for unintended personal information before release.
- Keep public resource content consistent with the actual application capabilities.

Public assets must contain only information approved for public distribution.

**Security boundary:** Public metadata and crawler directives do not replace access controls, secure session handling, or authorization checks.

## 8. SEO and Content Maintenance

Before publishing changes:

1. Confirm that public pages use the intended canonical URLs.
2. Update `sitemap.xml` when eligible pages are added, removed, or relocated.
3. Review `robots.txt` for accidental crawl restrictions.
4. Check internal links and referenced asset paths.
5. Validate XML, JSON, and other structured resources.
6. Confirm that important URLs resolve correctly after deployment.
7. Review redirects and avoid listing inaccessible pages in the sitemap.
8. Ensure private or authenticated pages are not inadvertently published as indexable content.
9. Confirm that public pages intended for indexing are not accidentally marked `noindex`.
10. Verify that published metadata accurately reflects supported functionality.

Do not use `robots.txt` to protect private content. Apply server-side access controls and appropriate indexing directives where applicable.

## 9. Deployment Checklist

- [ ] Public files contain valid, reviewed content.
- [ ] Unused protocol placeholders have been removed or intentionally populated.
- [ ] The sitemap uses the correct production domain.
- [ ] `robots.txt` references the correct sitemap URL.
- [ ] Security reporting information is current and monitored.
- [ ] Advertising seller records are verified, if applicable.
- [ ] Protocol resources meet their relevant specifications.
- [ ] Static resources return the expected status codes and content types.
- [ ] HTTPS is enabled.
- [ ] No secrets or private records are publicly exposed.
- [ ] Hosting and CDN rules preserve required resource URLs.
- [ ] HTML fallback behavior does not interfere with static files.
- [ ] Referenced icons and other assets exist at their declared paths.
- [ ] Deployed URLs have been verified independently of local development.
- [ ] Public files have been reviewed for unnecessary personal or internal information.

## 10. Maintenance and Ownership

Keep this README synchronized with the actual directory and deployment configuration.

When adding, changing, or removing public resources:

1. Update the directory documentation.
2. Check HTML, manifest, and configuration references.
3. Validate the resource against its intended specification.
4. Review security, privacy, and SEO implications.
5. Verify the deployed URL and response headers.
6. Confirm that the resource is still required by an active integration.
7. Record relevant verification results and follow-up actions.

Review public resources when the website architecture, domain configuration, application integrations, security contacts, or advertising relationships change.

## 11. Definition of Done

A public resource is ready for production when:

- [ ] Its purpose and ownership are documented.
- [ ] Its content is valid and appropriate for public distribution.
- [ ] All required values are accurate and verified.
- [ ] No secrets or confidential information are exposed.
- [ ] Its URL returns the expected response.
- [ ] Required headers and redirect behavior are correct.
- [ ] Its intended client or integration has been tested, where applicable.
- [ ] Maintenance requirements are documented.
- [ ] The deployment has been verified in the actual production environment.

**Production principle:** Documentation does not prove implementation. Verify the actual file, application configuration, hosting behavior, and public response before relying on a resource.

—

**MedOrbits — Study · Work · Grow**

*Public website resources for discoverability, compatibility, security transparency, and reliable deployment.*
