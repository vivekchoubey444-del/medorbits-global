
# MedOrbits — Staging Environment

**Project:** MedOrbits — Education · Medical Admissions · Official Resources · Careers  
**Directory:** `infrastructure/enviroments/`  
**Environment:** Staging / Pre-production  
**Runtime:** Node.js 20+  
**Backend:** Express.js with ES modules  
**Database:** PostgreSQL  
**Deployment:** Configured hosting provider and approved deployment workflow

—

## 1. Purpose

The staging environment provides a controlled environment for validating MedOrbits changes before production deployment.

It should closely reflect the production application architecture while remaining isolated from production credentials, databases, personal data, and other sensitive resources.

Staging is intended for:

- Testing release candidates before production deployment.
- Validating API routes, controllers, services, and middleware.
- Verifying PostgreSQL schema changes and migrations.
- Testing authentication, authorization, sessions, and application workflows.
- Validating official resources, education data, careers, and recruitment features.
- Checking frontend-to-backend integration.
- Verifying file uploads, notifications, and optional external integrations.
- Testing deployment procedures, health checks, and recovery operations.
- Identifying regressions before release.

**Implementation status:** This document defines recommended staging standards. Verify the actual hosting provider, application configuration, workflow files, database, and deployment settings before treating any procedure as implemented.

—

## 2. Environment Separation

MedOrbits should maintain clear boundaries between development, staging, and production.

| Area | Development | Staging | Production |
|—|—|—|—|
| Purpose | Local implementation | Pre-release verification | Live service |
| Database | Local development database | Dedicated staging database | Production database |
| Credentials | Local development secrets | Staging-only secrets | Restricted production secrets |
| Data | Synthetic or local test data | Synthetic or approved sanitized data | Authorized operational data |
| Deployment | Developer-controlled | Controlled release candidate | Approved release |
| External services | Mock or sandbox services | Sandbox or approved test services | Production services |
| Access | Developers | Authorized testers and maintainers | Authorized operators |
| Debugging | Development diagnostics | Restricted diagnostics | Restricted operational logging |

Never point staging at the production database merely to make tests pass.

Do not copy production personal data into staging unless a documented, approved process establishes a lawful need, appropriate safeguards, and effective sanitization.

—

## 3. Recommended Architecture

The staging environment should contain the components required to test the intended application workflows.

```text
Developer / Reviewer
        |
        v
GitHub Pull Request
        |
        v
CI Quality Gates
        |
        v
Approved Staging Deployment
        |
        +-————————+
        |                         |
        v                         v
MedOrbits Frontend           Express.js API
                                  |
                                  v
                         Staging PostgreSQL
                                  |
                  +—————+—————+
                  |               |               |
                  v               v               v
             Test Storage    Sandbox Services   Test Email
```

This diagram is conceptual. Configure only the components that the project actually uses.

### Core components

- **Application:** MedOrbits frontend and Express.js backend.
- **Runtime:** A supported Node.js version meeting the project’s `package.json` requirements.
- **Database:** An isolated PostgreSQL staging instance or database.
- **Configuration:** Environment-specific variables and secrets.
- **CI/CD:** Automated validation and a controlled deployment process.
- **Observability:** Application logs, deployment logs, and health checks.
- **Integrations:** Sandbox or test credentials for supported external services.

Do not assume that creating this document provisions infrastructure.

—

## 4. Staging URL and Access

Configure a dedicated staging hostname with the actual hosting provider.

Example placeholder:

```text
https://staging.example.com
```

Replace this example with the real staging hostname before publishing operational instructions.

### Access requirements

- Enable HTTPS.
- Restrict administrative pages and sensitive test functionality.
- Use test accounts with minimum required privileges.
- Prevent staging credentials from being reused in production.
- Restrict database access to approved application and maintenance clients.
- Apply rate limits and security controls appropriate to the environment.
- Avoid exposing stack traces, environment variables, or internal diagnostics publicly.

If staging is intended only for authorized testers, enforce access restrictions at the hosting, identity, or application layer. A non-obvious URL alone is not access control.

### Search engine visibility

Prevent staging pages from being indexed where appropriate. Use authentication or access restrictions for confidential staging content; `robots.txt` and `noindex` directives are not security controls.

—

## 5. Environment Configuration

Use a dedicated staging configuration. Store sensitive values in the hosting provider’s secret manager or approved GitHub Environment secrets.

Potential configuration categories include:

| Category | Configuration examples | Handling |
|—|—|—|
| Runtime | `NODE_ENV`, `PORT` | Set according to application requirements |
| Database | `DATABASE_URL` | Staging-only credential |
| Authentication | `SESSION_SECRET` | Unique staging secret |
| Frontend access | `ALLOWED_ORIGINS` | Explicit staging origins |
| Application URL | `APP_BASE_URL` | Actual staging URL |
| Logging | `LOG_LEVEL` | Restricted, non-secret diagnostics |
| AI integration | `AI_API_KEY`, `AI_API_URL`, `AI_MODEL` | Optional; staging-specific credentials |
| Email | Provider-specific settings | Sandbox or test recipient configuration |
| File storage | Provider-specific settings | Dedicated staging bucket or container |

These names are examples, not a declaration that every variable is implemented in the application. Confirm the actual configuration contract in the source code and deployment settings.

### Configuration rules

1. Validate required environment variables during startup.
2. Fail safely when mandatory configuration is missing.
3. Never commit `.env` files containing secrets.
4. Keep `.env.example` limited to documented variable names and placeholder values.
5. Never include credentials in frontend bundles.
6. Avoid logging database connection strings, access tokens, or session secrets.
7. Use separate staging and production credentials.
8. Rotate staging secrets if they are exposed.
9. Restrict access to environment settings.
10. Document optional integrations and their expected behavior when disabled.

—

## 6. PostgreSQL Staging Database

Use a dedicated PostgreSQL staging database with access restricted to the application and authorized maintainers.

### Database requirements

- Use a staging-specific database name and credentials.
- Keep staging schema changes under version control.
- Apply migrations through a controlled and repeatable process.
- Maintain appropriate connection limits.
- Configure backups or snapshots when staging data needs recovery.
- Use synthetic or sanitized test data.
- Keep database credentials out of source code and logs.
- Avoid granting application accounts unnecessary database privileges.

### Migration procedure

Before applying a migration:

1. Identify the migration and the schema changes it introduces.
2. Review whether the migration is backward-compatible.
3. Confirm that the staging database is the intended target.
4. Back up staging data if needed for recovery.
5. Apply the migration using the project’s established migration mechanism.
6. Verify the resulting schema and application behavior.
7. Run relevant automated tests.
8. Record failures and corrective actions.

Do not invent a migration command. Use the command defined by the project’s actual migration tooling.

### Production protection

Staging scripts must not automatically migrate, truncate, seed, or delete production data.

Before executing any destructive database operation, verify the connection target and require appropriate safeguards.

—

## 7. Deployment Workflow

A staging deployment should be repeatable, traceable, and recoverable.

### Recommended release flow

1. Create a feature branch.
2. Submit a pull request.
3. Run required CI checks.
4. Review the code and configuration changes.
5. Merge or select an approved revision according to repository policy.
6. Deploy that revision to staging.
7. Apply approved database migrations.
8. Run smoke tests and integration tests.
9. Verify frontend and API behavior.
10. Record the deployed revision and test results.
11. Approve or reject promotion to production.

The exact trigger may be a branch update, release candidate, manual dispatch, or an approved environment deployment. Configure the actual workflow deliberately.

### Deployment requirements

- Use a known commit SHA or reviewed release revision.
- Keep staging and production credentials separate.
- Require mandatory quality gates before deployment.
- Limit deployment permissions.
- Avoid exposing secrets to untrusted pull-request workflows.
- Record deployment failures.
- Prevent concurrent deployments from interfering with database migrations or shared state.
- Verify the deployment before promoting the revision to production.

Do not deploy arbitrary pull-request code into a staging environment containing sensitive credentials or data.

—

## 8. CI/CD and GitHub Actions

If GitHub Actions manages staging deployment, use a dedicated GitHub Environment such as `staging`.

Recommended controls:

- Store staging credentials in staging-specific secrets.
- Declare minimum workflow permissions.
- Separate test jobs from deployment jobs.
- Use the committed dependency lockfile.
- Require relevant tests to pass before deployment.
- Use environment protection rules when appropriate.
- Limit deployment concurrency where overlapping releases could be unsafe.
- Record the deployed revision.
- Avoid printing secrets or complete environment configurations in logs.

A workflow should not silently pass a required check because the corresponding test script is missing.

Example environment declaration:

```yaml
environment:
  name: staging
  url: ${{ vars.STAGING_URL }}
```

This snippet is illustrative. Define `STAGING_URL` as an appropriate environment variable and ensure the actual workflow has a valid deployment job before using this configuration.

Do not assume that this declaration deploys the application or provisions the environment.

Related documentation:

- `../github/README.md`
- `../github/ci.md`
- `../github/deployment.md`

—

## 9. Application and API Verification

Verify that the deployed application works with staging configuration.

### Backend checks

- [ ] The application starts successfully.
- [ ] Required environment variables are validated.
- [ ] PostgreSQL connectivity works.
- [ ] Database migrations are in the expected state.
- [ ] API routes load without startup errors.
- [ ] Authentication and authorization behave as intended.
- [ ] Validation middleware rejects invalid input.
- [ ] Error handling does not expose internal details.
- [ ] Rate limiting is enabled where required.
- [ ] File upload restrictions are enforced where applicable.
- [ ] Logs do not disclose secrets or sensitive user data.

### Frontend checks

- [ ] The staging frontend loads successfully.
- [ ] The API base URL points to staging.
- [ ] CORS permits only approved origins.
- [ ] Navigation and responsive layouts work.
- [ ] Forms display validation errors correctly.
- [ ] Authentication flows work with test accounts.
- [ ] Loading, empty, and error states are handled.
- [ ] No production-only credentials are embedded in client-side assets.

### MedOrbits feature checks

Test only the features actually implemented in the deployed release.

- [ ] Education and course information loads correctly.
- [ ] Medical admission content displays the expected data.
- [ ] Official resource links and documents are accurate.
- [ ] Career and job listings render correctly.
- [ ] Application submissions follow the expected validation rules.
- [ ] Recruitment and employer features behave as intended.
- [ ] Document uploads and downloads enforce authorization.
- [ ] Optional AI and notification integrations use test configuration.

Do not represent unimplemented features as verified.

—

## 10. Health Checks and Observability

Use the application’s actual health endpoints and monitoring configuration.

If the backend exposes a health endpoint, verify its real path and response contract before adding it to deployment checks.

### Health-check expectations

A suitable health-check strategy should distinguish between:

- **Liveness:** Whether the process is running and can continue operating.
- **Readiness:** Whether the application is ready to serve requests.
- **Dependency health:** Whether critical dependencies, such as PostgreSQL, are available.

Do not expose detailed internal dependency information to unauthenticated users unless that disclosure is intentional and safe.

### Logging

Record operationally useful information such as:

- Deployment revision.
- Application startup and shutdown events.
- Request failures and unexpected exceptions.
- Migration outcomes.
- External integration failures.
- Health-check failures.

Avoid logging passwords, authorization headers, session cookies, API keys, database connection strings, or unnecessary personal information.

—

## 11. Test Data and External Integrations

### Test data

Use synthetic data wherever possible.

- Create dedicated test users and roles.
- Use fictional names and contact details.
- Avoid importing production records.
- Remove unnecessary uploaded files and test artifacts.
- Reset data only through controlled, environment-specific procedures.
- Ensure automated tests cannot accidentally target production resources.

### External services

Use sandbox or test modes for email, payment, AI, file storage, and other external services where available.

Before enabling an integration:

1. Confirm the provider supports a safe test mode.
2. Configure staging-specific credentials.
3. Restrict recipients and test transactions.
4. Verify error handling and timeouts.
5. Prevent staging events from triggering unintended production actions.
6. Document any service that cannot be safely tested in staging.

Never use real payment transactions, send bulk communications, or trigger irreversible external actions without explicit authorization and appropriate safeguards.

—

## 12. Security Checklist

Before allowing broader staging access, verify the following.

### Access and secrets

- [ ] Staging access is appropriate for the intended audience.
- [ ] HTTPS is enabled.
- [ ] Staging credentials are unique.
- [ ] Database access is restricted.
- [ ] Administrative features require authorization.
- [ ] No secrets are committed or exposed in logs.
- [ ] Test accounts have appropriate permissions.

### Application security

- [ ] Authentication and authorization checks are tested.
- [ ] Input validation is enabled.
- [ ] Upload size and file-type restrictions are enforced where applicable.
- [ ] Rate limits are configured where appropriate.
- [ ] Error responses avoid internal stack traces.
- [ ] CORS and cookie settings match the staging deployment.
- [ ] Dependencies and third-party integrations are reviewed.

### Data protection

- [ ] Test data is synthetic or appropriately sanitized.
- [ ] Staging is isolated from production data.
- [ ] Logs do not contain unnecessary personal information.
- [ ] Data retention and cleanup procedures are documented.
- [ ] Backups and recovery are considered where staging data matters.

—

## 13. Rollback and Recovery

If a staging deployment fails:

1. Stop further promotion of the release.
2. Identify the failing revision and deployment stage.
3. Inspect sanitized deployment and application logs.
4. Check environment configuration and database connectivity.
5. Determine whether the failure is caused by application code, configuration, dependencies, or a migration.
6. Restore the previous known-good application revision when appropriate.
7. Apply a database recovery procedure only when required and approved.
8. Re-run health checks and critical smoke tests.
9. Record the cause, resolution, and preventive actions.

### Database recovery warning

Rolling back application code may not be compatible with a changed database schema. Evaluate schema compatibility before reverting a release.

Do not restore a database snapshot or reverse a migration without understanding the effect on data written after the snapshot or migration.

For production incidents, follow the production incident and recovery procedure rather than treating staging rollback instructions as sufficient.

—

## 14. Staging Readiness Checklist

Before promoting a release to production:

- [ ] The deployed revision is identifiable and approved.
- [ ] Required CI checks passed.
- [ ] The application starts successfully.
- [ ] Database migrations completed as expected.
- [ ] Critical API endpoints passed smoke tests.
- [ ] Authentication and authorization were verified.
- [ ] Relevant frontend flows were tested.
- [ ] Official resources and education data were checked where changed.
- [ ] Career and application workflows were checked where changed.
- [ ] Security-sensitive changes received appropriate review.
- [ ] No unresolved release-blocking defects remain.
- [ ] Deployment logs and test results are recorded.
- [ ] Production configuration is reviewed separately.
- [ ] Rollback and recovery considerations are documented.

A staging deployment is not automatically production-ready simply because its health endpoint returns a successful response.

—

## 15. Troubleshooting

### Application fails to start

Check:

- Node.js version and package requirements.
- Dependency installation.
- Required environment variables.
- Startup command and working directory.
- Import paths and ES module configuration.
- Runtime logs.

### Database connection fails

Check:

- Staging `DATABASE_URL` or the configured connection settings.
- Database availability.
- Network access and firewall rules.
- Credentials and database permissions.
- SSL requirements.
- Connection limits.

Do not print the complete connection string while troubleshooting.

### CORS errors occur

Check:

- The actual frontend origin.
- The backend’s configured allowlist.
- Credential and cookie settings.
- HTTPS and proxy configuration.
- Whether the deployed application loaded the expected staging configuration.

Avoid resolving CORS errors by allowing every origin without evaluating the security implications.

### Deployment succeeds but tests fail

Check:

- The deployed revision.
- API and frontend base URLs.
- Database migration state.
- Test account configuration.
- External-service sandbox settings.
- Browser console and sanitized server logs.

### Staging accidentally uses production resources

Stop the affected process or integration where safe. Prevent further writes, assess potential data exposure or modification, rotate any exposed credentials, and follow the relevant incident response procedure.

Do not attempt an unreviewed database cleanup that could make the incident worse.

—

## 16. Related Documentation

Review these documents when available:

### Environment and operations

- `development.md`
- `production.md`
- `../github/README.md`
- `../github/ci.md`
- `../github/deployment.md`

### Application and quality

- `../../docs/INTEGRATION.md`
- `../../docs/VALIDATION.md`
- `../../docs/TESTING.md`
- `../../docs/SECURITY.md`
- `../../docs/DEPLOYMENT.md`

These paths assume the corresponding files exist. Verify filenames, capitalization, and relative paths before relying on the links in operational procedures.

—

## 17. Maintenance

Review this document whenever:

- The staging hostname or hosting provider changes.
- Runtime or database configuration changes.
- Deployment workflows are modified.
- New API routes or major features are introduced.
- Authentication, session, or access-control behavior changes.
- Database migration procedures change.
- External integrations are enabled or replaced.
- Security requirements change.
- A deployment incident reveals a gap in the documented process.

Keep this guide aligned with the actual application, infrastructure, and deployment procedures.

—

## 18. Final Standard

The MedOrbits staging environment must provide a safe, isolated, and repeatable way to validate release candidates before production deployment.

**Environment principle:** Isolated resources, staging-only credentials, repeatable testing, observable deployments, and recoverable releases.

**Document owner:** MedOrbits maintainers  
**Review cadence:** After significant infrastructure changes and periodically  
**Implementation status:** Recommended staging standards; verify actual configuration  
**Document status:** Staging environment guide
