
# MedOrbits — Environment Management

**Project:** MedOrbits — Education · Medical Admissions · Official Resources · Careers  
**Directory:** `infrastructure/enviroments/`  
**Runtime:** Node.js 20+  
**Backend:** Express.js with ES modules  
**Database:** PostgreSQL  
**Environments:** Development · Staging · Production

—

## 1. Purpose

This directory documents the environment-specific configuration, deployment standards, security controls, and operational procedures for MedOrbits.

It provides a consistent reference for managing the application throughout its lifecycle, from local development and pre-release testing to production operation.

The objectives are to:

- Separate development, staging, and production resources.
- Document environment-specific configuration.
- Protect credentials and sensitive application data.
- Standardize deployment and release verification.
- Maintain database integrity across environments.
- Support troubleshooting, monitoring, and recovery.
- Reduce configuration errors and accidental production changes.
- Keep operational documentation aligned with the actual application.

**Implementation status:** This directory describes recommended standards. Verify the actual environment variables, hosting provider, database configuration, deployment workflows, and repository settings before treating a procedure as implemented or enforced.

—

## 2. Directory Contents

| File | Purpose |
|—|—|
| `README.md` | Index for environment-management documentation |
| `development.md` | Local development setup, configuration, and testing |
| `staging.md` | Pre-production validation, deployment checks, and release readiness |
| `production.md` | Production security, deployment, monitoring, backups, and recovery |

This is the intended documentation set. Add further environment guides only when the project requires them.

—

## 3. Environment Overview

MedOrbits should keep environment resources and credentials appropriately isolated.

| Environment | Primary purpose | Data policy | Deployment policy |
|—|—|—|—|
| Development | Implement and debug features | Prefer synthetic or local test data | Developer-controlled |
| Staging | Validate release candidates | Synthetic or approved sanitized data | Controlled pre-release deployment |
| Production | Serve live users | Authorized operational data | Approved, traceable releases |

### Development

Used for local implementation, debugging, unit testing, and integration work.

Read [`development.md`](development.md).

### Staging

Used to validate application changes, API behavior, database migrations, integrations, and release readiness before production deployment.

Read [`staging.md`](staging.md).

### Production

Used to serve the live application. Requires restricted access, protected credentials, controlled releases, operational monitoring, and appropriate recovery procedures.

Read [`production.md`](production.md).

—

## 4. Environment Configuration Standards

Environment configuration must be explicit, validated, and consistent with the application’s actual implementation.

Potential configuration categories include:

- Node.js runtime and application port.
- PostgreSQL connection settings.
- Authentication and session secrets.
- Frontend origin allowlists and CORS.
- Application base URL.
- Logging and monitoring.
- Optional AI integrations.
- Email and notification providers.
- File storage and document processing.
- External API credentials.

These categories do not imply that every integration is implemented. Confirm supported configuration variables in the application source code and deployment settings.

### Configuration requirements

1. Document required and optional variables.
2. Validate mandatory configuration at startup.
3. Use environment-specific credentials.
4. Keep secret values outside source control.
5. Maintain an `.env.example` with placeholder values only, where appropriate.
6. Never embed server-side credentials in frontend code.
7. Avoid logging secrets, complete connection strings, or sensitive personal information.
8. Rotate credentials after exposure or suspected compromise.
9. Review configuration changes before production deployment.
10. Keep documentation aligned with the actual configuration contract.

Do not assume that a variable is supported merely because it appears in an example or documentation file.

—

## 5. Environment Isolation and Access Control

Development, staging, and production must not share sensitive credentials by default.

### Database isolation

- Use a separate database or appropriately isolated database resources for each environment.
- Restrict database network access.
- Use dedicated credentials with minimum required privileges.
- Keep production data out of development and staging unless a documented, approved, and appropriately safeguarded process permits specific use.
- Verify the database target before running migrations, seeds, resets, or destructive operations.

### Secret isolation

- Store production credentials in an approved secret-management system.
- Use staging-specific secrets for staging deployments.
- Keep local development secrets out of version control.
- Restrict access to deployment secrets.
- Avoid exposing production credentials to untrusted pull-request workflows.

### Access control

Grant access according to operational responsibilities.

- Developers should use development resources for routine work.
- Testers should use authorized staging resources.
- Production access should be limited to authorized maintainers and operators.
- Administrative permissions and deployment bypass privileges should be reviewed periodically.

A separate URL is not a substitute for authentication and access controls.

—

## 6. Deployment and Release Management

Use a controlled release process appropriate to each environment.

### Recommended release lifecycle

1. Develop changes in a feature branch.
2. Run local validation and tests.
3. Submit a pull request.
4. Run mandatory continuous integration checks.
5. Review the code and security-sensitive changes.
6. Deploy an approved revision to staging.
7. Verify application behavior and database compatibility.
8. Approve promotion to production.
9. Deploy through the established production workflow.
10. Verify application health and critical user workflows.
11. Record the deployed revision and any known issues.

Adapt this process to the actual hosting provider and deployment architecture.

### Release safeguards

- Deploy identifiable commits or approved release tags.
- Require mandatory quality gates.
- Restrict production deployment permissions.
- Keep environment-specific credentials separate.
- Review database migration risks.
- Verify deployment results.
- Maintain documented recovery procedures.
- Avoid assuming that an application rollback automatically reverses database changes.

See the [GitHub infrastructure guide](../github/README.md), [CI guide](../github/ci.md), and [deployment guide](../github/deployment.md).

—

## 7. Database Management

PostgreSQL schema changes and data operations must be handled carefully across all environments.

### Standards

- Keep schema changes and migrations under version control.
- Use the migration tooling actually configured in the project.
- Test migrations against staging before production.
- Apply least-privilege database access.
- Use backups or recovery points when required by the operation.
- Avoid destructive database operations without explicit safeguards.
- Record significant production schema changes.
- Verify schema and application compatibility after migrations.

Never invent or assume a migration command. Check the project’s package scripts and database tooling.

### Production safeguards

Before a production migration:

- Confirm the target database.
- Review the migration’s effects.
- Assess locking and downtime risks.
- Confirm the required recovery strategy.
- Obtain appropriate approval.
- Verify the result after execution.

—

## 8. Security and Data Protection

Environment configuration must support the application’s security and privacy requirements.

### Security requirements

- Enforce HTTPS in deployed environments.
- Validate request data on the server.
- Protect authentication and authorization flows.
- Restrict administrative operations.
- Apply appropriate rate limits and request-size limits.
- Use explicit CORS configuration.
- Protect uploaded documents and private files.
- Keep dependencies and deployment workflows reviewed.
- Avoid exposing stack traces or internal configuration in production responses.

### Data protection

- Collect only information required for the intended purpose.
- Restrict access to personal and confidential records.
- Avoid unnecessary personal data in logs.
- Establish appropriate retention and deletion procedures.
- Protect backups and exported records.
- Use synthetic data for automated testing whenever possible.
- Follow applicable legal and contractual obligations.

Security and privacy controls must be implemented and verified in the actual application and infrastructure. Documentation alone does not enforce them.

—

## 9. Monitoring, Backups, and Recovery

Operational requirements differ by environment.

| Capability | Development | Staging | Production |
|—|—|—|—|
| Application logs | Debugging-focused | Restricted diagnostic logs | Operational logs with sensitive-data controls |
| Health checks | Local verification | Release verification | Availability monitoring |
| Backups | As needed | As needed for test recovery | Defined and monitored recovery strategy |
| Alerts | Optional | Deployment and test failures | Operationally appropriate alerts |
| Access restrictions | Developer access | Authorized testers | Restricted operational access |
| Recovery | Rebuild or reset local state | Redeploy or restore test resources | Approved incident and recovery procedures |

### Production recovery

Production operations should define:

- Recovery Time Objective (RTO).
- Recovery Point Objective (RPO).
- Backup frequency and retention.
- Restoration ownership and permissions.
- Database and file-storage recovery procedures.
- Incident escalation and communication.

Test restoration periodically. A successful backup job does not prove that recovery will work.

See [`production.md`](production.md) for additional guidance.

—

## 10. Environment Verification Checklist

Use this checklist when creating an environment or making a significant configuration change.

### Configuration

- [ ] The environment’s purpose is documented.
- [ ] Required environment variables are identified.
- [ ] Secrets are stored securely.
- [ ] Runtime requirements are satisfied.
- [ ] The correct application URL and frontend origins are configured.
- [ ] Database connectivity is verified.
- [ ] Optional integrations are configured or intentionally disabled.

### Security

- [ ] Environment resources are appropriately isolated.
- [ ] Access permissions follow least privilege.
- [ ] Production credentials are not available to untrusted workflows.
- [ ] HTTPS and relevant security controls are configured.
- [ ] Sensitive information is not exposed in logs.
- [ ] Database and file access controls are verified.

### Deployment and operations

- [ ] Deployment instructions match the actual hosting provider.
- [ ] Required CI checks are configured and tested.
- [ ] Database migration procedures are documented.
- [ ] Health checks use actual application endpoints.
- [ ] Relevant logs are available to authorized operators.
- [ ] Recovery procedures are documented.
- [ ] Documentation links and filenames have been checked.

A checklist item should be marked complete only after the relevant behavior has been verified.

—

## 11. Troubleshooting

### Application starts locally but fails after deployment

Check:

- Runtime and package requirements.
- Startup command and working directory.
- Required environment variables.
- Module configuration and import paths.
- Database connectivity.
- Hosting-provider logs.
- Frontend and API URL configuration.

### Database operations affect the wrong environment

Stop the operation if it is safe to do so. Confirm the connection target, assess whether data was modified, and follow the relevant recovery or incident procedure.

Do not run an unreviewed cleanup operation to correct an environment-selection error.

### Secrets are unavailable

Check:

- The exact secret name.
- Repository or environment scope.
- Deployment permissions.
- Environment protection rules.
- Hosting-provider configuration.

Never print secrets into logs to troubleshoot access.

### Staging works but production fails

Compare configuration categories, dependency versions, network restrictions, database schema state, and external integration settings. Do not copy staging credentials or loosen production security controls as a shortcut.

### Documentation links are broken

Confirm that the referenced file exists and that its path and capitalization match the repository. Create missing documents only when they are part of the agreed architecture.

—

## 12. Related Documentation

### Environment guides

- [Development Environment](development.md)
- [Staging Environment](staging.md)
- [Production Environment](production.md)

### GitHub infrastructure

- [GitHub Infrastructure Index](../github/README.md)
- [Continuous Integration](../github/ci.md)
- [Deployment Guide](../github/deployment.md)

### Project documentation

Review these files when available:

- `../../docs/ARCHITECTURE.md`
- `../../docs/INTEGRATION.md`
- `../../docs/VALIDATION.md`
- `../../docs/TESTING.md`
- `../../docs/SECURITY.md`
- `../../docs/PRIVACY.md`
- `../../docs/DEPLOYMENT.md`

Verify all filenames and relative paths before relying on these references operationally.

—

## 13. Maintenance

Review this directory whenever:

- Runtime or database requirements change.
- Environment variables are added, removed, or renamed.
- Hosting providers or deployment workflows change.
- Authentication, session management, or access controls change.
- Database migration or recovery procedures change.
- External services are introduced or replaced.
- Security requirements change.
- Operational incidents reveal gaps in the documentation.

Keep the documentation synchronized with the actual application, infrastructure, and repository configuration.

—

## 14. Final Standard

MedOrbits environment management must provide clear separation between development, staging, and production, with secure configuration, controlled deployment, validated database operations, and documented recovery procedures.

**Environment principle:** Separation, least privilege, repeatable releases, protected data, and verified operations.

**Document owner:** MedOrbits maintainers  
**Review cadence:** Periodically and after significant infrastructure changes  
**Implementation status:** Recommended standards; verify actual controls  
**Document status:** Environment-management documentation index
