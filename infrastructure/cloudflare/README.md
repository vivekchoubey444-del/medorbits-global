
# MedOrbits — Cloudflare Infrastructure

**Project:** MedOrbits — Education · Medical Admissions · Official Resources · Careers  
**Directory:** `infrastructure/cloudflare/`  
**Platform:** Cloudflare  
**Configuration:** Wrangler TOML  
**Backend:** Express.js with ES modules  
**Runtime:** Node.js 20+  
**Database:** PostgreSQL

—

## 1. Purpose

This directory documents the Cloudflare infrastructure and deployment configuration used by MedOrbits.

It provides guidance for:

- Cloudflare Wrangler configuration and deployment.
- DNS, custom domains, and HTTPS.
- Static asset delivery and caching.
- Cloudflare Workers and Pages architecture decisions.
- Environment-specific configuration.
- Security controls, secrets, and access permissions.
- Deployment verification, troubleshooting, and recovery.

The objective is to make Cloudflare integration secure, maintainable, and consistent with the actual MedOrbits application architecture.

**Implementation status:** This directory defines intended configuration and operational standards. Verify the actual Cloudflare account, DNS records, hosting architecture, build output, and deployed services before treating any procedure as implemented.

—

## 2. Directory Contents

| File | Purpose |
|—|—|
| `README.md` | Index for Cloudflare infrastructure documentation |
| `wrangler.toml` | Wrangler configuration for the intended Cloudflare deployment |

Additional files may be introduced when the project adopts further Cloudflare features, such as environment-specific deployment workflows, routing, caching policies, or Worker source code.

A Wrangler configuration file alone does not create a working deployment.

—

## 3. Architecture and Deployment Boundaries

MedOrbits uses an Express.js backend and PostgreSQL. Cloudflare can provide DNS, HTTPS, caching, security controls, static asset delivery, and compatible Worker-based functionality.

Choose the deployment architecture based on the application’s actual requirements.

### Possible architecture

```text
Visitors
   |
   v
Cloudflare DNS / HTTPS / Security
   |
   +—————————+
   |                           |
   v                           v
Static Frontend            Express.js API
   |                           |
   v                           v
Public Build Assets        PostgreSQL
                               |
                               v
                       Protected Application Data
```

This is a conceptual architecture, not confirmation that these components have been deployed.

### Important distinctions

- **Cloudflare DNS:** Resolves domain names to configured services.
- **Cloudflare Workers:** Runs compatible server-side JavaScript or TypeScript at Cloudflare’s edge.
- **Cloudflare Pages:** Hosts supported frontend builds and can integrate with Pages Functions.
- **Static assets:** Public files such as HTML, CSS, JavaScript, images, and fonts.
- **Express.js backend:** Requires a compatible Node.js hosting environment or a deliberate migration to a compatible runtime.
- **PostgreSQL:** Must be accessed through an appropriate, supported database connection architecture.

Do not assume that an existing Express.js server can be deployed unchanged as a Worker or static Pages site.

—

## 4. Wrangler Configuration

The primary configuration file is:

[`wrangler.toml`](wrangler.toml)

Review it before deployment.

### Configuration responsibilities

The file may define:

- Worker or application name.
- Wrangler compatibility date.
- Static asset directory.
- Non-secret environment variables.
- Environment-specific settings.
- Observability options.
- Routes and custom-domain configuration.

The exact properties depend on the Cloudflare product and Wrangler configuration format in use.

### Configuration rules

1. Confirm the intended deployment target before adding Worker-specific settings.
2. Verify that the asset directory exists and contains only public files.
3. Keep production and staging settings distinct.
4. Do not store API keys, database passwords, or other secrets in TOML.
5. Confirm that configured routes correspond to verified Cloudflare DNS and domain settings.
6. Avoid enabling production traffic until deployment verification is complete.
7. Keep configuration consistent with the actual application build process.

If the project changes from a Worker-based deployment to Cloudflare Pages or another architecture, update the configuration and this documentation together.

—

## 5. Static Asset Management

Only publish files intended to be publicly accessible.

Potential public assets include:

- Compiled HTML pages.
- CSS stylesheets.
- Browser-side JavaScript.
- Public images and fonts.
- Public, non-sensitive metadata.

Never expose the repository root or directories containing private information as public assets.

Do not publish:

- `.env` files.
- Database dumps or backups.
- Private documents and uploaded application files.
- API keys, private certificates, or credentials.
- Server-side source files that are not intended for public access.
- Logs or internal configuration.
- Test fixtures containing sensitive data.

### Build directory verification

Before deployment:

1. Run the actual frontend build command.
2. Confirm the output directory.
3. Inspect the generated files.
4. Check for unexpected secrets or private data.
5. Verify that frontend API requests target the intended environment.
6. Deploy only the verified public build output.

The asset path in `wrangler.toml` must match the actual MedOrbits build process. Do not assume that `dist/` exists without checking the repository.

—

## 6. Domains, DNS, and HTTPS

Configure Cloudflare DNS and custom domains according to the actual hosting architecture.

### Recommended controls

- Verify domain ownership.
- Confirm the intended DNS records.
- Enable HTTPS for public application endpoints.
- Use appropriate TLS settings.
- Redirect HTTP traffic to HTTPS where supported and appropriate.
- Verify certificates and hostname coverage.
- Restrict access to sensitive administrative services.
- Document DNS changes that affect production availability.

Do not add production routes to Wrangler until the domain, zone, and target service have been verified.

### DNS changes

Before changing production DNS:

1. Identify the current records and their purpose.
2. Confirm the intended destination.
3. Review proxy and TLS implications.
4. Plan for propagation and caching behavior.
5. Apply the change through authorized access.
6. Verify the domain resolves correctly.
7. Test HTTPS and application functionality.
8. Record the change and recovery plan.

Do not delete existing records without understanding which services depend on them.

—

## 7. Environment Separation

Use separate configuration and credentials for staging and production.

| Area | Staging | Production |
|—|—|—|
| Purpose | Pre-release testing | Live service |
| Domain | Dedicated staging hostname, if configured | Verified production domain |
| Credentials | Staging-only | Restricted production secrets |
| Data | Synthetic or approved sanitized data | Authorized operational data |
| Deployment | Controlled test deployment | Approved release |
| Verification | Integration and smoke tests | Health and critical workflow checks |

The exact environment names and settings must match the actual Wrangler configuration and deployment workflow.

### Environment variables

Only non-secret values should be stored in ordinary Wrangler variable configuration.

Examples may include:

- Application name.
- Environment identifier.
- Public application URL.
- Public API base URL.

Confirm the application’s actual configuration contract before adding variables.

### Secrets

Use the appropriate Cloudflare secret configuration or approved hosting-provider secret manager for sensitive values.

Never place the following in committed configuration files:

- `DATABASE_URL` containing credentials.
- `SESSION_SECRET`.
- API keys.
- Private tokens.
- Private keys.
- Authentication credentials.

The Express.js backend may require its own secret configuration outside Cloudflare. Configure secrets in the environment that actually runs the backend.

—

## 8. Security and Access Control

Apply least-privilege access to Cloudflare and its associated deployment systems.

### Account security

- Enable strong authentication and multifactor authentication where available.
- Limit account and zone administration to authorized maintainers.
- Use scoped API tokens instead of broad account credentials where appropriate.
- Rotate exposed credentials immediately.
- Review permissions periodically.
- Remove access when it is no longer required.

### Application security

- Use HTTPS.
- Protect administrative routes with application-level authorization.
- Keep server-side credentials out of frontend assets.
- Configure caching carefully for authenticated or personalized responses.
- Avoid publicly caching private documents or user-specific information.
- Validate user input in the backend.
- Review request-size limits and rate-limiting requirements.
- Avoid exposing internal errors and stack traces.

Cloudflare protections do not replace application-level authentication, authorization, validation, or database security.

### Caching

Cache public, versioned assets where appropriate.

Avoid caching sensitive or user-specific responses unless a deliberate, reviewed cache policy guarantees correct isolation.

Verify cache behavior after changing routes, headers, or asset configuration.

—

## 9. Deployment Workflow

Use a controlled and repeatable deployment process.

### Recommended workflow

1. Review the source and configuration changes.
2. Run the required CI checks.
3. Build the frontend using the configured build command.
4. Verify the asset output and environment settings.
5. Confirm the target Cloudflare account and deployment environment.
6. Deploy to staging where configured.
7. Run smoke tests and verify API connectivity.
8. Approve the production release.
9. Deploy the approved revision.
10. Verify the production hostname, HTTPS, assets, and application workflows.
11. Record the deployed revision and any known issues.

### Wrangler commands

The following are examples. Confirm the installed Wrangler version, configured project type, and available package scripts before running them.

Check the CLI version:

```bash
npx wrangler —version
```

Validate the configuration where supported by the installed Wrangler version:

```bash
npx wrangler deploy —dry-run
```

Deploy a Worker when the project is configured for that deployment target:

```bash
npx wrangler deploy
```

Deploy to a named environment only when that environment exists in the configuration and the project supports the intended command:

```bash
npx wrangler deploy —env staging
```

These commands are not interchangeable with Cloudflare Pages deployment commands. Use the workflow appropriate to the actual target.

Never assume that a successful dry run confirms DNS, secrets, database connectivity, or application health.

—

## 10. Verification Checklist

### Configuration

- [ ] The intended Cloudflare product and deployment target are confirmed.
- [ ] Wrangler configuration matches the installed CLI and project architecture.
- [ ] The build output directory exists.
- [ ] Only public assets are included.
- [ ] Environment-specific settings are correct.
- [ ] No secrets are committed.

### Domain and transport security

- [ ] Domain ownership and DNS records are verified.
- [ ] The correct production hostname is configured.
- [ ] HTTPS works.
- [ ] Certificates are valid for the intended hostnames.
- [ ] Redirect and cache behavior are verified.

### Application behavior

- [ ] The frontend loads successfully.
- [ ] Browser-side JavaScript and CSS load correctly.
- [ ] API requests target the intended backend.
- [ ] Authentication and protected routes behave correctly.
- [ ] Critical forms and workflows work.
- [ ] Private data is not publicly cached.
- [ ] Backend health and database connectivity are verified independently.

### Operations

- [ ] Deployment logs are available to authorized maintainers.
- [ ] The deployed revision is identifiable.
- [ ] Recovery or rollback procedures are documented.
- [ ] Monitoring and alerting are configured where required.
- [ ] Staging and production credentials remain isolated.

Only mark a control complete after verifying the actual deployed behavior.

—

## 11. Troubleshooting

### Wrangler configuration fails to parse

Check:

- TOML syntax.
- Property names supported by the installed Wrangler version.
- Compatibility between the configuration and the chosen Cloudflare product.
- Environment-specific configuration structure.
- CLI version and project configuration.

### Asset directory is missing

Check the actual frontend build command and its output directory.

Update the asset configuration only after verifying the correct public build path. Do not point the configuration at the repository root as a workaround.

### Deployment succeeds but the website is unavailable

Check:

- The deployed service and revision.
- DNS records and domain configuration.
- HTTPS certificate status.
- Asset path and build output.
- Cloudflare deployment logs.
- Browser network requests.
- Frontend API base URL and backend availability.

### API requests fail

Check:

- The backend’s actual hosting location.
- API base URL configuration.
- CORS allowlists.
- HTTPS and mixed-content restrictions.
- Authentication and cookie settings.
- Backend health and database connectivity.

A static asset deployment does not automatically deploy the Express.js API.

### Environment variables or secrets are missing

Check:

- The correct deployment environment.
- Secret names and configuration scope.
- The service that actually consumes the variable.
- Whether the value is configured as a secret or a non-secret variable.
- The deployed revision and environment settings.

Never print secret values into logs.

### Incorrect caching behavior

Check:

- Cache rules.
- Response headers.
- Asset versioning.
- Personalized or authenticated response handling.
- Whether a private route is being treated as a public asset.

Do not solve a private-data caching issue by relying solely on cache purges. Correct the underlying cache policy.

—

## 12. Rollback and Recovery

If a Cloudflare deployment causes an outage:

1. Identify the affected service, domain, and deployment revision.
2. Determine whether the problem originates in assets, Worker code, DNS, caching, or the backend.
3. Stop further rollout if necessary.
4. Restore a known-good deployment or configuration using the supported recovery method.
5. Verify DNS, HTTPS, and application functionality.
6. Test critical API workflows.
7. Check whether cached responses or client-side assets require additional handling.
8. Record the incident, resolution, and preventive actions.

DNS changes, application deployments, and database changes have different recovery implications. A Cloudflare rollback does not automatically reverse backend or database changes.

For production incidents, follow the approved production incident-response process.

—

## 13. Related Documentation

Review these files when available:

### Cloudflare

- [Wrangler Configuration](wrangler.toml)

### Environment management

- [Environment Management Index](../enviroments/README.md)
- [Development Environment](../enviroments/development.md)
- [Staging Environment](../enviroments/staging.md)
- [Production Environment](../enviroments/production.md)

### GitHub infrastructure

- [GitHub Infrastructure Index](../github/README.md)
- [CI Guide](../github/ci.md)
- [Deployment Guide](../github/deployment.md)

### Application documentation

- `../../docs/ARCHITECTURE.md`
- `../../docs/INTEGRATION.md`
- `../../docs/SECURITY.md`
- `../../docs/DEPLOYMENT.md`

Verify that each referenced file exists and that the path and capitalization match the repository.

—

## 14. Maintenance

Review this directory whenever:

- The Cloudflare deployment target changes.
- Wrangler configuration properties are updated.
- The frontend build directory changes.
- Domains, DNS records, or TLS settings change.
- Cache rules or public asset policies change.
- Environment variables or secrets change.
- The backend hosting architecture changes.
- Deployment workflows are modified.
- Cloudflare security or runtime requirements change.

Keep the documentation aligned with the actual Cloudflare configuration and deployment procedures.

—

## 15. Final Standard

MedOrbits Cloudflare infrastructure should provide secure domain delivery, correctly scoped public assets, deliberate caching, protected configuration, and verified deployments.

**Infrastructure principle:** Correct deployment boundaries, secure configuration, controlled routing, verified delivery, and recoverable changes.

**Document owner:** MedOrbits maintainers  
**Review cadence:** After significant infrastructure changes and periodically  
**Implementation status:** Recommended standards; verify actual deployment  
**Document status:** Cloudflare infrastructure documentation index
