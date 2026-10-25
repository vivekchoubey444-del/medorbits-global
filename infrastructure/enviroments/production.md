
# MedOrbits — Production Environment

**Project:** MedOrbits — Education · Medical Admissions · Official Resources · Careers  
**Directory:** `infrastructure/enviroments/`  
**Environment:** Production  
**Runtime:** Node.js 20+  
**Backend:** Express.js with ES modules  
**Database:** PostgreSQL  
**Deployment:** Approved hosting provider and controlled release workflow

—

## 1. Purpose

This document defines the operational standards for deploying, securing, monitoring, and maintaining the MedOrbits production environment.

Production serves the live MedOrbits platform and must prioritize:

- Availability and reliability.
- Application and database security.
- Protection of personal and confidential information.
- Controlled releases and database migrations.
- Accurate education, admissions, official-resource, and careers content.
- Monitoring, incident response, and service recovery.
- Data integrity, backups, and tested restoration procedures.
- Auditable operational changes.

**Implementation status:** This document defines recommended production standards. Verify the actual hosting provider, application configuration, database setup, monitoring tools, and deployment workflows before treating any procedure as implemented.

—

## 2. Production Principles

Production changes must be controlled, reviewed, and recoverable.

1. Deploy reviewed revisions through the approved release process.
2. Require mandatory CI checks to pass before deployment.
3. Protect production credentials and administrative access.
4. Keep production separate from development and staging.
5. Validate configuration before starting the application.
6. Apply database migrations through a controlled process.
7. Monitor application health and critical dependencies.
8. Maintain appropriate backups and test restoration.
9. Record operationally significant changes.
10. Investigate incidents and document corrective actions.

Production must not be treated as a testing environment.

—

## 3. Environment Architecture

The following diagram illustrates a recommended architecture. It does not imply that these components have already been provisioned.

```text
Users
  |
  v
HTTPS / Approved Hosting or Edge Layer
  |
  v
MedOrbits Frontend
  |
  v
Express.js Application
  |
  +-———————+-———————+
  |                      |                      |
  v                      v                      v
PostgreSQL          External Services      File Storage
  |                      |                      |
  v                      v                      v
Backups              Approved APIs          Protected Files

              Monitoring and Alerting
                        |
                        v
                Operations Team
```

Configure only the components that the deployed application actually uses.

### Core components

- **Frontend:** Public-facing MedOrbits pages and user interfaces.
- **Backend:** Express.js API and application services.
- **Database:** PostgreSQL with restricted access.
- **Configuration:** Production environment variables and secrets.
- **File storage:** Protected storage for application documents, if implemented.
- **External integrations:** Approved production services.
- **Monitoring:** Application, infrastructure, and dependency health monitoring.
- **Backups:** Database and other required persistent-data recovery mechanisms.

—

## 4. Environment Isolation

Production must use dedicated credentials, configuration, and persistent resources.

| Resource | Production requirement |
|—|—|
| Database | Dedicated production database and restricted credentials |
| Authentication secrets | Unique, securely stored production values |
| API keys | Production-specific credentials with minimum permissions |
| Frontend origins | Explicitly approved production origins |
| File storage | Production storage with access controls |
| External services | Approved production accounts and configuration |
| Logs | Restricted access and appropriate retention |
| Backups | Protected from unauthorized access and deletion |
| Deployment | Approved release process with traceable revisions |

Never use staging credentials in production or expose production credentials to staging workflows.

Do not use production data to make automated tests pass. Use synthetic or appropriately sanitized data in non-production environments.

—

## 5. Production Configuration

Store secrets in the hosting provider’s secret manager or another approved secret-management system.

Potential configuration categories include:

| Category | Examples | Requirement |
|—|—|—|
| Runtime | `NODE_ENV`, `PORT` | Match the application’s supported configuration |
| Database | `DATABASE_URL` | Restricted production credentials |
| Authentication | `SESSION_SECRET` | Strong, unique secret |
| Frontend access | `ALLOWED_ORIGINS` | Explicit production origins |
| Application URL | `APP_BASE_URL` | Canonical production URL |
| Logging | `LOG_LEVEL` | Appropriate operational detail without sensitive data |
| AI integration | `AI_API_KEY`, `AI_API_URL`, `AI_MODEL` | Only when the integration is implemented and approved |
| Email | Provider-specific settings | Verified sender and production credentials |
| File storage | Provider-specific settings | Restricted access and protected document storage |

These are examples, not confirmation that every variable is supported by the application. Check the actual application configuration and startup validation before deployment.

### Configuration requirements

- Validate mandatory variables at startup.
- Fail safely when required configuration is missing.
- Never commit production `.env` files.
- Keep `.env.example` limited to placeholder values.
- Never embed server credentials in frontend assets.
- Avoid printing environment variables or credentials in logs.
- Restrict access to production secrets.
- Rotate exposed or compromised credentials immediately.
- Document configuration changes that affect availability or security.
- Keep development, staging, and production configuration separate.

Do not change production configuration directly without following the approved change process.

—

## 6. Production Database Operations

Use PostgreSQL with access limited to authorized application and maintenance processes.

### Database security

- Restrict network access to approved clients.
- Use encrypted connections where supported and required.
- Use strong, unique credentials.
- Grant only the permissions required by each database role.
- Avoid using database superuser credentials for routine application operations.
- Protect backups and migration credentials.
- Monitor connection capacity and database health.
- Never expose the database directly to the public internet without appropriate safeguards.

### Migration policy

Before applying a production migration:

1. Review the migration and its expected effects.
2. Confirm that the target database is production.
3. Verify that required backups or recovery points are available.
4. Test the migration against staging or an equivalent test environment.
5. Assess lock duration, table size, downtime risk, and data-loss risk.
6. Confirm application compatibility with the migration.
7. Obtain required approval.
8. Apply the migration through the established migration mechanism.
9. Verify the resulting schema and critical application workflows.
10. Record the migration result and deployed revision.

Do not invent a migration command. Use the command defined by the project’s actual migration tooling.

### Migration safety

Prefer backward-compatible changes when application and database updates may be deployed separately.

Avoid destructive changes until dependent application versions and data requirements have been evaluated.

An application rollback does not automatically reverse a database migration. Database recovery must follow a separately reviewed procedure.

—

## 7. Production Deployment

Production deployment must be controlled, traceable, and recoverable.

### Release process

1. Finalize the intended release revision.
2. Review the changes and release notes.
3. Run mandatory CI checks.
4. Verify security-sensitive changes and dependency updates.
5. Confirm production configuration and required credentials.
6. Confirm database migration and recovery plans.
7. Obtain required release approval.
8. Deploy the approved revision.
9. Apply approved migrations in the planned order.
10. Run health checks and smoke tests.
11. Verify critical user workflows.
12. Record the release revision, deployment result, and any known issues.

Adapt the exact sequence to the hosting provider and migration architecture. Some applications require migrations before application deployment; others require a staged, backward-compatible rollout.

### Deployment controls

- Deploy an identifiable commit SHA or approved release tag.
- Require mandatory quality gates.
- Restrict production deployment permissions.
- Use protected deployment environments where supported.
- Prevent concurrent deployments from conflicting with migrations.
- Avoid deploying unreviewed pull-request code.
- Record failures and recovery actions.
- Keep deployment logs free of secrets.
- Verify the running application after each release.

Do not assume that a successful hosting-provider deployment means the application is healthy.

—

## 8. GitHub Actions and Release Permissions

If GitHub Actions performs production deployment, use a dedicated GitHub Environment such as `production`.

Recommended controls include:

- Store production credentials in production-specific environment secrets.
- Require reviewers or approvals where appropriate and supported.
- Restrict deployment to approved branches, tags, or release events.
- Declare the minimum workflow token permissions.
- Separate build and test jobs from privileged deployment jobs.
- Avoid exposing production secrets to pull-request workflows.
- Use reviewed third-party actions.
- Pin actions to reviewed commit SHAs when required by the project’s supply-chain policy.
- Record the deployed revision.
- Review workflow permission changes before merging.

A workflow environment declaration does not itself deploy an application or provision infrastructure.

Verify the actual repository rules, environment protection settings, workflow triggers, and hosting-provider integration.

Related documentation:

- `../github/README.md`
- `../github/ci.md`
- `../github/deployment.md`

—

## 9. Application Security

Production security must be enforced in the application and infrastructure layers.

### Authentication and authorization

- Enforce authorization on protected API operations.
- Verify that users can access only permitted records and actions.
- Protect administrative endpoints.
- Apply secure session or token handling according to the application’s authentication design.
- Use secure cookie settings where cookie-based authentication is implemented.
- Protect authentication and recovery flows against abuse.
- Review privileged access periodically.

### Input and request validation

- Validate incoming request bodies, parameters, and query strings.
- Reject invalid or unexpected input.
- Apply request-size limits.
- Use parameterized database queries or a safely configured query builder.
- Avoid constructing database queries from untrusted strings.
- Apply rate limiting where appropriate.
- Use consistent error handling without exposing internal implementation details.

### File and document security

If document uploads are implemented:

- Enforce file-size limits.
- Validate permitted file types using appropriate server-side checks.
- Generate safe storage names rather than trusting user-supplied paths.
- Prevent path traversal and unsafe file execution.
- Restrict access to private documents.
- Verify authorization before downloads.
- Store sensitive documents outside publicly served directories.
- Define retention and deletion procedures.
- Consider malware scanning where appropriate to the threat model.

### Browser and transport security

- Enforce HTTPS.
- Configure CORS with explicit allowed origins.
- Apply appropriate security headers.
- Configure cookies and proxy trust according to the actual deployment topology.
- Avoid exposing stack traces or internal configuration in production responses.
- Review cross-site scripting, cross-site request forgery, and related risks based on the application’s architecture.

Do not enable a security control without checking its compatibility with the actual application and deployment configuration.

—

## 10. Data Protection and Privacy

MedOrbits may process user accounts, admissions enquiries, applications, uploaded documents, and recruitment-related information. Handle such information according to applicable law, contractual obligations, and the platform’s published privacy commitments.

### Required practices

- Collect only information needed for the stated purpose.
- Restrict access according to job responsibilities.
- Encrypt data in transit and protect stored data appropriately.
- Avoid unnecessary personal information in application logs.
- Establish retention and deletion procedures.
- Protect exports and backups.
- Review access to uploaded documents and application records.
- Avoid sending personal information to external services without an approved purpose and appropriate safeguards.
- Maintain a process for handling suspected data exposure.

Do not assume that an application feature is compliant merely because it uses HTTPS or a secure database.

### Sensitive operational data

Never publish or commit:

- Passwords or authentication tokens.
- Database connection strings.
- Private keys.
- Production API keys.
- Unredacted application records.
- Identity documents.
- Session cookies or authorization headers.
- Backup archives containing sensitive information.

—

## 11. Backups and Disaster Recovery

Maintain a documented recovery strategy appropriate to the importance of the production data.

### Backup requirements

- Identify the databases, uploaded files, configuration, and other resources requiring recovery.
- Choose a backup frequency based on business requirements and acceptable data loss.
- Restrict backup access.
- Protect backup copies against accidental deletion and unauthorized modification.
- Encrypt backups where appropriate.
- Define retention periods.
- Monitor backup-job results.
- Document recovery dependencies and credentials.
- Test restoration periodically.

A successful backup job is not proof that the data can be restored. Restoration must be tested.

### Recovery objectives

Define and approve:

- **Recovery Time Objective (RTO):** The maximum acceptable recovery duration.
- **Recovery Point Objective (RPO):** The maximum acceptable amount of data loss measured in time.

Choose realistic targets based on the service’s requirements and the capabilities of the hosting provider and database platform.

### Recovery procedure

1. Identify the incident and affected resources.
2. Restrict further damage where necessary.
3. Select an appropriate recovery point.
4. Confirm the target environment and restoration plan.
5. Restore using the approved procedure.
6. Verify data integrity and schema compatibility.
7. Restore dependent application components.
8. Run health checks and critical workflow tests.
9. Resume service only after appropriate verification.
10. Document the incident, data-loss assessment, and corrective actions.

Do not restore a backup over a live database without evaluating data loss, application impact, and authorization.

—

## 12. Monitoring, Logging, and Alerting

Monitor the service for failures that affect users, data integrity, or security.

### Recommended monitoring categories

| Category | Examples |
|—|—|
| Availability | HTTP health checks, uptime, failed requests |
| Application | Startup errors, unhandled exceptions, API failures |
| Database | Connection failures, capacity, query performance |
| Performance | Latency, request volume, resource utilization |
| Deployment | Release failures, migration failures, unhealthy revisions |
| Security | Repeated authentication failures, suspicious access patterns |
| Integrations | Email, AI, storage, and other external-service failures |
| Backups | Failed jobs, missing recovery points, restoration-test failures |

Configure monitoring tools and thresholds according to the actual deployment. Avoid claiming that alerts are active until they have been configured and tested.

### Logging requirements

Logs should be useful for diagnosis while minimizing sensitive data.

- Record deployment revisions and important lifecycle events.
- Capture errors with appropriate contextual identifiers.
- Use request IDs or correlation IDs where available.
- Restrict log access.
- Define retention and deletion policies.
- Redact sensitive values.
- Avoid logging passwords, tokens, session cookies, full connection strings, and unnecessary personal information.

### Health checks

Distinguish between:

- **Liveness:** Whether the application process is operating.
- **Readiness:** Whether the application can safely serve requests.
- **Dependency health:** Whether critical dependencies are available.

Use the actual health endpoints exposed by the application. Do not assume that a particular route exists without verifying the implementation.

—

## 13. Incident Response

Use a documented incident-response process for service disruptions, security incidents, data corruption, and failed releases.

### Initial response

1. Identify the affected service and the approximate start time.
2. Assess impact on users, data, security, and availability.
3. Assign an incident owner when appropriate.
4. Preserve relevant logs and deployment information.
5. Stop unsafe automated actions if necessary.
6. Apply a safe mitigation or recovery procedure.
7. Communicate status through approved channels.
8. Verify that the service has recovered.
9. Record the incident timeline and follow-up actions.

### Security incidents

For suspected credential exposure or unauthorized access:

- Revoke or rotate affected credentials.
- Restrict access where necessary.
- Preserve relevant evidence.
- Identify potentially affected systems and data.
- Follow the organization’s incident-response and notification obligations.
- Avoid public disclosure of sensitive technical details before an appropriate response.

### Post-incident review

Document:

- What happened.
- The user and system impact.
- Root cause, where established.
- Actions taken to recover.
- Preventive measures.
- Owners and target dates for corrective actions.

Distinguish confirmed findings from hypotheses.

—

## 14. Production Readiness Checklist

Complete this checklist before an initial production launch or a significant infrastructure change.

### Application and deployment

- [ ] The intended release revision is approved.
- [ ] Required CI checks have passed.
- [ ] The production runtime meets project requirements.
- [ ] Required environment variables are configured.
- [ ] The application starts successfully.
- [ ] Critical API and frontend workflows are verified.
- [ ] Health checks reflect actual application readiness.
- [ ] Rollback and recovery steps are documented.

### Database and data

- [ ] Production database access is restricted.
- [ ] Migration procedures are reviewed.
- [ ] Database backups are configured as required.
- [ ] Restoration has been tested.
- [ ] Data retention and deletion procedures are documented.
- [ ] Sensitive data is not exposed in logs.

### Security and privacy

- [ ] HTTPS is enabled.
- [ ] Authentication and authorization are verified.
- [ ] CORS and security headers are reviewed.
- [ ] Production secrets are securely stored.
- [ ] Administrative access is restricted.
- [ ] File access controls are verified where applicable.
- [ ] Dependency and supply-chain checks are reviewed.
- [ ] Privacy and incident-response procedures are documented.

### Operations

- [ ] Monitoring and alerts are configured and tested.
- [ ] Logs are accessible to authorized operators.
- [ ] Deployment ownership is clear.
- [ ] Incident contacts and escalation procedures are available.
- [ ] Capacity and service limits have been reviewed.
- [ ] External integrations use approved production configuration.

A checked item should represent verified behavior, not merely a planned configuration.

—

## 15. Rollback and Release Recovery

When a production release fails:

1. Stop further rollout or promotion.
2. Assess the impact on availability, data integrity, and security.
3. Identify the deployed revision and the failure point.
4. Review sanitized application, database, and hosting logs.
5. Decide whether to roll back, apply a corrective release, or use another approved mitigation.
6. Evaluate database schema compatibility before reverting application code.
7. Restore data only through the approved recovery procedure.
8. Verify health checks and critical workflows.
9. Confirm that monitoring shows recovery.
10. Record the decision, outcome, and follow-up actions.

### Important considerations

- Rolling back application code does not automatically reverse database changes.
- Some database migrations are not safely reversible.
- A rollback may be less safe than a forward fix if the database has already changed.
- Recovery operations must not overwrite newer valid data without an approved plan.
- Do not disable security controls merely to make a release appear healthy.

The release owner should choose a recovery path based on verified evidence and the actual deployment architecture.

—

## 16. Troubleshooting

### Application unavailable

Check:

- Hosting-provider service status.
- Application process and startup logs.
- Health-check results.
- DNS and HTTPS configuration.
- Recent deployment and configuration changes.
- Database connectivity.
- Resource and connection limits.

### Database errors

Check:

- Database availability.
- Connection configuration without printing secrets.
- Network rules and SSL requirements.
- Database permissions.
- Connection exhaustion.
- Migration state and schema compatibility.

Avoid running unreviewed destructive queries during an incident.

### Authentication failures

Check:

- Authentication service availability.
- Session and cookie configuration.
- Token expiry and validation behavior.
- Clock synchronization where relevant.
- Recent secret rotations.
- Reverse-proxy and HTTPS settings.

Do not expose credentials while diagnosing authentication problems.

### Slow responses

Check:

- Request latency and error rates.
- Database query performance.
- Connection-pool utilization.
- External-service response times.
- Resource consumption.
- Recent code or configuration changes.

Apply changes based on measured evidence rather than increasing limits indiscriminately.

### External integration failure

Check:

- Provider status.
- Credentials and permissions.
- Rate limits and quotas.
- Network connectivity and timeouts.
- Recent configuration changes.
- Retry behavior and idempotency.

Prevent repeated retries from causing duplicate submissions, notifications, or transactions.

—

## 17. Maintenance and Change Management

Production maintenance must be planned according to risk and service impact.

Before a significant change:

1. Define the intended change and expected outcome.
2. Identify affected services, users, and data.
3. Review security and privacy implications.
4. Test the change in staging.
5. Confirm backup and recovery requirements.
6. Obtain required approvals.
7. Schedule maintenance if necessary.
8. Deploy through the approved workflow.
9. Verify the outcome.
10. Record the change and any follow-up actions.

### Periodic review

Review:

- Application and runtime support status.
- Dependencies and security advisories.
- Repository and deployment permissions.
- Secret rotation requirements.
- Database capacity and performance.
- Backup integrity and restoration tests.
- Monitoring thresholds and alert delivery.
- Data retention and access controls.
- Incident-response readiness.
- Recovery objectives and operational documentation.

Keep maintenance schedules appropriate to the system’s risk and operational requirements.

—

## 18. Related Documentation

Review these documents when available.

### Environments

- [Development Environment](development.md)
- [Staging Environment](staging.md)

### GitHub infrastructure

- [GitHub Infrastructure Index](../github/README.md)
- [CI Guide](../github/ci.md)
- [Deployment Guide](../github/deployment.md)

### Application documentation

- `../../docs/ARCHITECTURE.md`
- `../../docs/INTEGRATION.md`
- `../../docs/VALIDATION.md`
- `../../docs/TESTING.md`
- `../../docs/SECURITY.md`
- `../../docs/PRIVACY.md`
- `../../docs/DEPLOYMENT.md`

Verify that these files exist and that their names and paths match the repository. Documentation links do not establish that the referenced procedures or controls are implemented.

—

## 19. Maintenance of This Document

Update this document when:

- The production hosting provider or architecture changes.
- Runtime, database, or deployment configuration changes.
- New critical integrations are introduced.
- Authentication or authorization mechanisms change.
- Database migration or backup procedures change.
- Recovery objectives are revised.
- Monitoring or incident-response processes change.
- Security requirements or applicable obligations change.
- An incident reveals a gap in the documented procedure.

Review this document periodically and after significant operational changes.

—

## 20. Final Standard

The MedOrbits production environment must operate with controlled releases, restricted access, protected data, observable service health, and tested recovery procedures.

**Production principle:** Secure configuration, verified releases, data integrity, operational visibility, and recoverable service.

**Document owner:** MedOrbits maintainers  
**Review cadence:** Periodically and after significant production changes  
**Implementation status:** Recommended production standards; verify actual controls  
**Document status:** Production environment operations guide
