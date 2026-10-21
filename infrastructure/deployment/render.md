
# MedOrbits — Render Deployment Guide

**Project:** MedOrbits  
**Platform:** Render  
**Scope:** Service configuration, deployment, environment management, database connectivity, verification, and troubleshooting  
**Status:** Operational guide — verify all settings against the current repository and Render dashboard before production deployment.

## 1. Purpose

This document describes the process for configuring, deploying, and verifying MedOrbits on Render.

The objective is to provide a repeatable deployment workflow that protects production secrets, maintains database integrity, verifies critical application functionality, and supports controlled recovery when a deployment fails.

Render settings, application scripts, environment variables, and health-check endpoints must match the actual implementation. This guide does not establish that any service or integration has already been configured.

## 2. Service Setup

Configure the Render service to match the repository structure, `package.json`, and supported Node.js runtime.

### 2.1 Initial Configuration Checklist

- [ ] Select the correct GitHub repository and deployment branch.
- [ ] Confirm the repository root directory and application entry point.
- [ ] Configure the Node.js version according to `.nvmrc`, `package.json`, and the runtime supported by Render.
- [ ] Configure the build command using scripts that actually exist in `package.json`.
- [ ] Configure the start command to launch the intended server entry point.
- [ ] Configure required environment variables through Render’s environment settings.
- [ ] Configure the health-check path using an endpoint verified to exist in the application.
- [ ] Confirm the service type and deployment settings are appropriate for the application.
- [ ] Review build, deployment, networking, and resource settings before the first production release.
- [ ] Confirm that the service has access only to the resources and credentials it requires.

### 2.2 Runtime and Commands

Inspect the repository before entering commands into Render.

Review:

- `.nvmrc`
- `package.json`
- The package lockfile
- The server entry point
- Build scripts and generated assets
- Database initialization and migration procedures
- The application’s port-binding behavior
- The actual health-check implementation

The configured Node.js runtime must satisfy the application’s `engines` requirement and be supported by Render.

**Important:** Do not copy a build command, start command, script name, or health-check path into the Render dashboard without confirming that it exists and is appropriate for the current codebase.

For a Node.js web service, the application must bind to the port expected by the hosting environment. Verify that the server uses the appropriate environment-provided port rather than relying exclusively on a hardcoded local development port.

## 3. Environment Variables and Secrets

Configure production secrets through Render’s environment settings or an approved secret-management mechanism. Do not commit them to the repository.

Depending on the integrations enabled, the application may require:

| Configuration category | Examples of purpose |
|—|—|
| Runtime | Application environment and port settings expected by the server. |
| Database | Host, port, database name, username, password, TLS settings, and connection options. |
| Authentication | Session secrets, signing keys, and authentication-provider configuration. |
| Email | SMTP or email-provider credentials and sender configuration. |
| Payments | Provider credentials, webhook secrets, and callback configuration. |
| AI integrations | Provider credentials, endpoint configuration, and model settings. |
| External APIs | API keys, service URLs, and integration-specific configuration. |
| Background processing | Queue connection settings, worker configuration, and scheduled-job options, where implemented. |
| Storage | Approved file-storage credentials and configuration, where applicable. |

These categories are illustrative. Confirm the exact variable names and required values against the current application code and integration configuration.

### 3.1 Secret-Handling Requirements

- Never commit production secrets to Git.
- Do not print credentials or sensitive environment values in deployment logs.
- Rotate exposed credentials promptly.
- Restrict access to production environment settings.
- Keep development, staging, and production credentials separate.
- Use least-privilege credentials for databases, storage, and external services.
- Avoid exposing secrets to build steps that do not require them.
- Review logs and deployment output for accidental secret disclosure.
- Document secret rotation and recovery procedures without recording secret values.

If a required variable is missing, resolve the configuration issue rather than adding an insecure hardcoded fallback.

## 4. Database Connectivity

Before deploying, verify that the production application can connect to its configured database.

### 4.1 Database Readiness Checklist

- [ ] Confirm the database host, port, database name, username, and connection settings.
- [ ] Verify network access between Render and the database provider.
- [ ] Confirm TLS requirements and certificate validation where applicable.
- [ ] Use a dedicated database account with least-privilege permissions.
- [ ] Confirm migrations are reviewed and compatible with the application release.
- [ ] Check connection limits, connection pooling, and expected workload.
- [ ] Confirm a current backup and documented recovery procedure are available.
- [ ] Verify that database credentials are stored securely.
- [ ] Confirm the application uses the intended production database, not staging or development.
- [ ] Verify database availability and expected query behavior using an approved test.

Do not assume that a database is reachable merely because the application builds successfully.

### 4.2 Migration Safety

Before applying production migrations:

1. Review the migration and its compatibility with the deployed application.
2. Test it against an appropriate non-production database.
3. Evaluate locking, execution time, temporary storage, and data-transformation risks.
4. Confirm the recovery strategy for partial completion or failure.
5. Verify backup availability when the change warrants it.
6. Monitor the migration and validate the resulting schema and data.

Do not assume that all MySQL schema operations are transactional or that restoring a backup will preserve writes made after that backup.

## 5. Deployment Procedure

Follow the repository’s approved release procedure when deploying production changes.

1. **Review the release.** Approve the commit and confirm that the intended branch and release identifier are correct.
2. **Validate CI.** Confirm that required automated tests, linting, build checks, and security checks have passed.
3. **Review configuration.** Verify required environment variables, database settings, and external integrations.
4. **Assess migration risk.** Confirm that database changes and startup behavior have been reviewed and tested.
5. **Confirm recovery readiness.** Ensure the release owner, rollback decision-maker, and recovery instructions are available.
6. **Deploy the approved commit.** Push or merge the approved commit into the configured deployment branch, or use the approved Render deployment workflow.
7. **Monitor the deployment.** Review Render’s deployment status and build logs.
8. **Inspect startup.** Check for configuration errors, database failures, missing dependencies, and runtime exceptions.
9. **Verify health.** Confirm that the configured health check succeeds.
10. **Run smoke tests.** Validate critical application workflows and required integrations.
11. **Record the result.** Capture the release identifier, deployment time, verification outcome, and responsible owner.

Avoid making unrelated production changes while diagnosing a failed deployment.

## 6. Deployment Verification

Complete the applicable checks after every production deployment.

### 6.1 Application and Runtime

- [ ] Review build and startup logs for errors.
- [ ] Confirm the service reaches a healthy state.
- [ ] Verify that the expected release is running.
- [ ] Confirm that the application listens on the expected port.
- [ ] Verify the configured health-check endpoint.
- [ ] Test authentication and session handling.
- [ ] Test a representative read-only workflow.
- [ ] Verify that public routes and static assets behave as expected.

### 6.2 Database and Integrations

- [ ] Verify database connectivity and expected query behavior.
- [ ] Confirm migration execution and relevant data-integrity checks.
- [ ] Test critical integrations enabled in the deployment.
- [ ] Verify payment and webhook behavior where applicable, using safe test or reconciliation procedures.
- [ ] Verify background workers and scheduled jobs, if configured.
- [ ] Inspect queue processing and retry behavior, if applicable.

### 6.3 Operational Health

- [ ] Check application error rates, response latency, and resource usage.
- [ ] Review database connection usage and storage headroom.
- [ ] Confirm monitoring and alert notifications are operational.
- [ ] Review logs for unexpected exceptions and sensitive-data exposure.
- [ ] Keep the release identifier and rollback instructions available.
- [ ] Record the deployment outcome and any follow-up actions.

If critical workflows fail or service health degrades, pause further rollout and follow `production.md` and `rollback.md`, after verifying that these documents exist and reflect the current deployment workflow.

## 7. Troubleshooting

### 7.1 Build Failure

1. Review the build logs and identify the first actionable error.
2. Confirm the configured Node.js version is supported and satisfies the project requirements.
3. Verify that the build command matches an existing package script.
4. Check dependency installation and lockfile consistency.
5. Confirm that required build-time configuration is available.
6. Reproduce the failure locally or in CI where practical.

Do not use an unreviewed dependency upgrade or force an incompatible runtime change as a shortcut.

### 7.2 Application Fails to Start

1. Confirm the start command points to the correct server entry point.
2. Check startup logs for missing modules, invalid configuration, or runtime errors.
3. Verify required environment variables are present without exposing their values.
4. Confirm the server listens on the port expected by the hosting environment.
5. Check database initialization and connection failures.
6. Inspect repeated restarts and determine whether the failure is caused by application startup, configuration, or a dependency.

### 7.3 Health Check Fails

1. Verify that the configured endpoint exists and returns the expected status.
2. Check whether the application has completed startup.
3. Inspect database connectivity and other dependencies required by the endpoint.
4. Confirm the health-check timeout and failure policy are appropriate.
5. Review logs for repeated crashes or initialization failures.
6. Confirm that the health-check route does not require authentication if the platform expects an unauthenticated probe.

Do not change the health-check path to an arbitrary route merely to make the deployment appear healthy.

### 7.4 Database Connection Fails

1. Verify connection settings and credentials.
2. Confirm network access, TLS requirements, and database availability.
3. Check database permissions and connection limits.
4. Review connection-pool configuration and exhaustion symptoms.
5. Inspect application logs without exposing credentials or connection secrets.
6. Confirm that the application is using the intended database environment.

### 7.5 Deployment Succeeds but Application Behavior Fails

1. Verify the deployed release identifier.
2. Run the critical workflow smoke tests.
3. Inspect application errors and database behavior.
4. Check configuration changes and external provider responses.
5. Determine whether the failure requires a targeted mitigation, a forward fix, or a rollback.
6. Record the incident and follow the approved recovery procedure.

## 8. Rollback and Recovery

A successful code rollback does not necessarily reverse database changes or external side effects.

Before rolling back:

- Assess user impact and identify the failure.
- Confirm whether the previous application version is compatible with the current database schema.
- Determine whether a migration has partially completed.
- Assess whether database restoration would discard legitimate writes.
- Consider payment operations, sent notifications, and other external side effects.
- Identify the authorized decision-maker and recovery owner.

After recovery:

- Verify service health and critical user workflows.
- Check database integrity and application error rates.
- Confirm that background jobs and integrations are behaving correctly.
- Record the recovery actions and any remaining risks.

Refer to the approved rollback and database recovery procedures. Do not automatically restore a production database backup solely because an application deployment failed.

## 9. Operational Notes

- Render features, service settings, and dashboard labels may change.
- Verify current configuration options against Render’s official documentation before production changes.
- Keep deployment instructions aligned with the repository’s actual scripts, server entry point, runtime requirements, and health-check implementation.
- Maintain a tested rollback procedure and a documented database recovery process.
- Reassess resource requirements as traffic, database usage, and background processing increase.
- Confirm whether workers, scheduled jobs, persistent storage, and other services require separate deployment configuration.
- Review application logs and resource usage after significant changes.

## 10. Related Documentation

The following paths are relative to the repository root. Verify that each file exists before relying on the reference.

- `infrastructure/deployment/production.md` — Production release checklist.
- `infrastructure/deployment/staging.md` — Staging validation procedure.
- `infrastructure/deployment/rollback.md` — Rollback and recovery procedure.
- `infrastructure/backup/README.md` — Backup and restore operations, if maintained at that location.
- `infrastructure/backup/restore-drill.md` — Database recovery verification.
- `infrastructure/database/README.md` — Database operations, if maintained at that location.
- `infrastructure/monitoring/health-checks.md` — Health-check design and verification.
- `infrastructure/monitoring/alerting.md` — Alerting and escalation policy.

## 11. Maintenance Policy

Review this guide whenever the deployment branch, Node.js runtime, package scripts, server entry point, environment configuration, database provider, or Render service settings change.

Document only verified commands, endpoints, and capabilities. Keep the deployment process aligned with the current MedOrbits repository and hosting environment.

—

**MedOrbits — Reliable Deployments, Verified Operations**
