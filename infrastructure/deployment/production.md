MedOrbits — Production Deployment Guide

Document: infrastructure/deployment/production.md
Application: MedOrbits
Domain: https://www.medorbits.in/
Runtime: Node.js 20+
Backend: Express.js with ECMAScript modules
Database: PostgreSQL
Status: Deployment procedure and operational checklist

Important: This document defines the intended production deployment process. It does not confirm that production infrastructure, secrets, database migrations, health checks, or deployment automation have been configured or verified.

1. Purpose

This guide establishes a consistent procedure for deploying MedOrbits safely to a production environment.

The deployment process should prioritize:

* Application availability.
* Data integrity.
* Secure configuration.
* Reliable database connectivity.
* Reproducible builds and dependency installation.
* Controlled releases and rollback.
* Monitoring and incident response.
* Protection of user information and uploaded documents.

Production changes must be deliberate, reviewable, and verifiable.

2. Production Architecture

The intended deployment architecture consists of:

1. Client layer — browser-based MedOrbits website.
2. Web or reverse-proxy layer — HTTPS termination and request forwarding, where configured.
3. Application layer — Node.js and Express.js server.
4. Database layer — PostgreSQL.
5. File-storage layer — approved storage for uploaded documents, where required.
6. Observability layer — application logs, health checks, metrics, and alerts where implemented.
7. External integrations — approved email, payment, AI, or other providers where configured.

Illustrative architecture:

Users
  |
  | HTTPS
  v
Domain / Reverse Proxy / Hosting Platform
  |
  v
MedOrbits Express Application
  |
  +—— PostgreSQL
  |
  +—— Approved Document Storage
  |
  +—— Configured External Services
  |
  +—— Logs and Monitoring

Actual hosting, storage, network boundaries, and external services must be verified against the deployed environment.

3. Deployment Prerequisites

Before deploying, confirm the following.

Application

* [ ]	The intended release is identified by a Git commit or immutable artifact.
* [ ]	The correct repository and deployment branch are selected.
* [ ]	Node.js 20 or later is supported by the application’s dependencies.
* [ ]	package.json contains the correct start and build scripts.
* [ ]	Required application entry points exist.
* [ ]	Required environment variables are documented.
* [ ]	No unresolved merge conflicts remain in the release.
* [ ]	No unintended files or local development artifacts are included.

Database

* [ ]	PostgreSQL is available.
* [ ]	The production database and application credentials are configured securely.
* [ ]	Network access is restricted to authorized clients.
* [ ]	Database schema and migrations have been reviewed.
* [ ]	A backup and recovery procedure exists.
* [ ]	Connection limits and timeouts are appropriate for the deployment.

Infrastructure

* [ ]	The deployment platform and runtime are confirmed.
* [ ]	HTTPS is configured for public traffic.
* [ ]	Domain and DNS configuration are verified.
* [ ]	Required storage is persistent where necessary.
* [ ]	Health checks are configured if supported.
* [ ]	Logging and monitoring are available or their absence is documented.
* [ ]	Rollback instructions have been reviewed.

Do not proceed with a production release if a critical prerequisite is unresolved.

4. Environment Configuration

Production configuration must be provided through the hosting platform’s secret manager or another approved secure mechanism.

Common configuration categories include:

Category	Examples
Runtime	NODE_ENV, PORT, HOST
Database	DATABASE_URL
Authentication	SESSION_SECRET, token-signing keys
CORS	Approved frontend origins
External services	Provider endpoints and API keys
File storage	Storage endpoint, bucket, and credentials
Logging	Log level and output destination
Health checks	Timeouts and dependency-check settings

The names above are examples; the actual names and requirements must match the application code.

Security rules

* Never commit a production .env file.
* Never put secrets in frontend JavaScript or public configuration.
* Never print secret values in deployment logs.
* Use separate credentials for development, testing, and production.
* Use least-privilege database accounts.
* Rotate exposed credentials immediately.
* Fail startup when essential production settings are invalid.
* Avoid insecure development defaults in production.
* Do not assume that a variable is enforced merely because it appears in documentation.

5. Build and Dependency Installation

Use the project’s lockfile to install reproducible dependencies.

For an npm project with a committed, valid package-lock.json:

npm ci

If the application requires a build step, execute the documented build script:

npm run build

Only run this command when the corresponding script exists and is required by the application.

Run the checks defined by the repository:

npm test
npm run check

Execute only scripts that have been inspected and approved. A project may not define every command.

Do not regenerate or replace the lockfile during production deployment. Update dependencies and lockfiles through a separate, reviewed development change.

6. Application Startup

Start the application using the configured production entry point.

For a project that defines the standard start script:

npm start

The production server should:

* Bind to the host and port expected by the hosting platform.
* Handle startup failures explicitly.
* Validate essential configuration.
* Establish database connections safely.
* Avoid exposing debugging endpoints publicly.
* Handle shutdown signals gracefully.
* Close database pools and other resources on shutdown.
* Avoid logging secrets or sensitive request data.

Do not assume that the application uses a particular process manager or hosting platform. Follow the actual deployment configuration.

7. Database Deployment

Database changes require special care because application rollback does not automatically reverse schema changes or restore lost data.

Before a migration

1. Identify the migration and affected tables.
2. Review the SQL or migration code.
3. Confirm compatibility with the currently deployed application.
4. Verify the latest backup and recovery procedure.
5. Estimate locking and execution impact.
6. Test the migration against a representative non-production database.
7. Define the recovery plan.

During deployment

* Use the project’s established migration mechanism.
* Do not assume that manually executing SQL is safe.
* Avoid destructive schema changes in the same release as dependent application changes when a staged migration is possible.
* Use a restricted database account.
* Apply migrations in a controlled sequence.
* Record the migration version and result without recording credentials.

After migration

* Confirm migration success.
* Verify expected tables, indexes, and constraints.
* Check database connectivity from the application.
* Run relevant smoke tests.
* Review application logs for database errors.

Do not run unverified migrations directly against production.

8. Release Procedure

Use the following release sequence.

Phase A — Prepare

1. Confirm the intended commit and release notes.
2. Review the diff for unintended changes.
3. Check for unresolved merge conflicts.
4. Run relevant automated tests.
5. Validate configuration and dependency changes.
6. Review security-sensitive changes.
7. Confirm backup and rollback readiness.

Phase B — Deploy

1. Deploy the approved commit or artifact.
2. Supply the production environment configuration.
3. Apply reviewed database migrations when required.
4. Start or restart the application using the hosting platform’s supported process.
5. Wait for the service to become ready.
6. Inspect startup and dependency errors.

Phase C — Verify

1. Request the configured health endpoint.
2. Test critical public pages.
3. Verify important API routes.
4. Check authentication and authorization.
5. Verify database-backed operations.
6. Check relevant forms and application workflows.
7. Review sanitized application logs.
8. Confirm that monitoring and alerts are operating, where configured.

Phase D — Complete

* Record the deployed commit or artifact identifier.
* Record the deployment timestamp.
* Record the migration version, if applicable.
* Document skipped checks.
* Monitor for elevated error rates.
* Keep the rollback procedure available.

A successful deployment command does not, by itself, prove that the application is healthy.

9. Health Checks and Smoke Tests

Where supported, separate application liveness from readiness.

Liveness

Confirms that the application process is responsive.

Readiness

Confirms that the application can accept normal requests and that essential dependencies are available.

Smoke-test checklist

* [ ]	The production domain resolves correctly.
* [ ]	HTTPS works without certificate errors.
* [ ]	The homepage loads.
* [ ]	Static assets load correctly.
* [ ]	Expected API endpoints respond.
* [ ]	Invalid requests return appropriate error codes.
* [ ]	Protected routes enforce authentication.
* [ ]	User permissions are enforced.
* [ ]	Database-backed features work.
* [ ]	Upload workflows are checked if implemented.
* [ ]	No sensitive information is exposed in errors.
* [ ]	Logs contain no unexpected startup failures.

Use only health-check endpoints that actually exist. Do not expose database details, credentials, internal stack traces, or private infrastructure information in public health responses.

10. Security Requirements

Production deployments must follow these principles.

Application security

* Validate and normalize user input.
* Use parameterized database queries.
* Enforce authentication and authorization on the server.
* Apply appropriate request-size and rate limits.
* Configure secure HTTP headers.
* Use restrictive CORS policies.
* Protect session cookies with suitable security attributes when cookie sessions are used.
* Keep production error responses free of stack traces.
* Avoid unrestricted file paths and arbitrary file access.
* Validate uploaded files and restrict their storage and access.

Infrastructure security

* Expose only necessary network services.
* Use HTTPS for public traffic.
* Restrict database access to authorized networks.
* Store secrets in an approved secret-management system.
* Apply operating-system and runtime security updates.
* Limit administrative access.
* Review dependencies for known vulnerabilities.
* Keep backups protected from unauthorized access.

Privacy

* Do not log passwords, tokens, private documents, or full authentication headers.
* Minimize collection of personal information.
* Restrict access to uploaded documents.
* Define retention and deletion policies.
* Ensure operational reports do not disclose private user data.

11. Uploaded Documents and Persistent Storage

If MedOrbits supports document uploads:

* Do not rely on temporary deployment filesystems for persistent storage.
* Use an approved persistent storage service or managed volume.
* Restrict file types, file sizes, and access permissions.
* Generate safe storage names instead of trusting uploaded filenames.
* Keep uploaded documents outside public web roots.
* Verify user authorization before serving documents.
* Scan uploads when appropriate for the application’s threat model.
* Back up document storage according to an established retention policy.
* Test document recovery separately from database recovery.

Do not assume that uploaded documents are backed up merely because the database is backed up.

12. Logging and Monitoring

Monitor the deployed service using the capabilities actually configured.

Useful signals include:

* Application availability.
* HTTP error rates.
* Response latency.
* Database connection failures.
* Unexpected restarts.
* Resource utilization.
* Failed background jobs.
* External provider failures.
* Authentication and security events.

Logs should be structured where practical and should exclude credentials, private documents, and sensitive request payloads.

Configure retention, access control, and alert thresholds according to operational needs.

Do not treat the presence of a monitoring/ directory or README as proof that monitoring is active.

13. Backup and Recovery

A production recovery strategy should account for:

* PostgreSQL data.
* Uploaded documents and other persistent files.
* Required configuration and secret recovery procedures.
* Application artifacts and deployment identifiers.
* Database migration history.
* Relevant operational records.

Backup requirements

* Automate backups only through a reviewed mechanism.
* Protect backups using access controls and encryption where appropriate.
* Keep independent copies according to the recovery policy.
* Define retention periods.
* Test restoration in a controlled environment.
* Document recovery time and recovery point objectives when required.

A Git repository backup is not a database backup. A database backup is not a document-storage backup.

Never assume that a backup is usable until its integrity and restoration process have been verified.

14. Rollback Procedure

Rollback should be based on the deployment platform and database migration strategy.

1. Identify the failing release and its deployment identifier.
2. Confirm the previous known-good application artifact.
3. Assess whether the database schema remains compatible with that artifact.
4. Review recent migrations and persistent data changes.
5. Roll back the application using the hosting platform’s supported mechanism.
6. Restore database state only when necessary and under an approved recovery plan.
7. Verify application health and critical workflows.
8. Record the incident, impact, and recovery actions.

Do not use git reset —hard, git clean, or broad filesystem restoration as routine production rollback mechanisms.

Do not reverse database migrations blindly. Some schema or data changes are not safely reversible.

15. Incident Response

When a production incident occurs:

1. Confirm the affected service and time window.
2. Determine the user impact.
3. Review sanitized logs and monitoring signals.
4. Check recent deployments and configuration changes.
5. Verify database and external dependency health.
6. Preserve relevant evidence.
7. Choose the smallest safe mitigation.
8. Roll back or disable the affected feature when appropriate.
9. Verify recovery.
10. Document the root cause and follow-up actions.

Do not make unreviewed destructive changes under pressure. Preserve evidence and user data.

16. CI/CD Requirements

A future automated deployment pipeline should:

* Run on approved branches and release triggers.
* Install dependencies reproducibly.
* Run linting, tests, and applicable build checks.
* Validate deployment configuration.
* Keep credentials in protected CI secrets.
* Require appropriate review and approvals.
* Deploy immutable artifacts where supported.
* Perform post-deployment health checks.
* Record deployment results.
* Provide a controlled rollback procedure.

Production deployment must not be triggered by untrusted pull requests or arbitrary user-controlled scripts.

Do not document a CI/CD workflow as operational until it has been implemented and tested.

17. Environment Separation

Keep development, testing, staging, and production separate.

Environment	Purpose
Development	Local implementation and debugging.
Testing	Automated tests and controlled verification.
Staging	Production-like pre-release validation.
Production	Live user traffic and real data.

Each environment should use its own credentials and appropriate access restrictions.

Never copy production secrets into local development configuration. Do not use real user documents in test environments unless there is a documented, approved, privacy-preserving reason.

18. Deployment Record

Maintain a record for every production release.

Suggested fields:

Field	Value
Release identifier	Record the actual deployed commit or artifact.
Deployment timestamp	UTC timestamp.
Deployment operator	Authorized operator or automation identity.
Application version	Actual release version.
Database migration	Actual migration version, if applicable.
Health verification	Pass, fail, or not run.
Smoke tests	Pass, fail, or not run.
Rollback readiness	Verified or unverified.
Known issues	Actual outstanding issues.

Never fabricate a release identifier or mark a check as successful without evidence.

19. Production Readiness Checklist

Before deployment

* [ ]	Release reviewed.
* [ ]	Dependencies installed from the lockfile.
* [ ]	Required tests passed.
* [ ]	Production configuration validated.
* [ ]	Secrets secured.
* [ ]	Database migration reviewed.
* [ ]	Backup and recovery plan confirmed.
* [ ]	Rollback procedure understood.
* [ ]	HTTPS and domain configuration checked.

After deployment

* [ ]	Application starts successfully.
* [ ]	Health and readiness checks verified.
* [ ]	Critical API endpoints tested.
* [ ]	Authentication and authorization checked.
* [ ]	Database-backed workflows verified.
* [ ]	Logs reviewed for unexpected errors.
* [ ]	Monitoring verified where configured.
* [ ]	Deployment record completed.

20. Known Limitations

This guide is an operational reference, not evidence of a completed production deployment.

The following must be verified against the real environment:

* Hosting provider and deployment configuration.
* Node.js runtime version.
* Application start command.
* Environment variable names and requirements.
* PostgreSQL connectivity and migration mechanism.
* Persistent document storage.
* Health-check endpoints.
* Logging and monitoring integration.
* Backup and recovery implementation.
* CI/CD and rollback automation.

Update this document when deployment architecture or procedures change.

Core principle: Deploy reviewed artifacts, protect production data, verify the live application, and maintain a tested recovery path.