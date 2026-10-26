MedOrbits — Production Deployment Guide

Document: README-PRODUCTION.md
Project: MedOrbits
Document Type: Production Deployment and Operations Runbook
Status: Operational Guidance — Implementation Must Be Verified
Owner: MedOrbits Maintainers
Review Frequency: Before major releases and whenever production architecture changes

⸻

1. Purpose and Scope

This document defines the recommended process for preparing, deploying, validating, monitoring, and recovering a production deployment of MedOrbits.

MedOrbits is intended to support education guidance, admissions, study-abroad services, career development, recruitment, user accounts, applications, document management, and related consultancy services.

The objectives of this guide are to establish:

* A controlled and repeatable release process.
* Secure application, database, and storage configuration.
* Verified authentication and authorization controls.
* Reliable database migration and backup procedures.
* Observable application health and operational failures.
* Tested recovery and rollback procedures.
* Clear release ownership and production approval criteria.

Implementation disclaimer: This guide describes intended operational controls. It does not establish that a listed route, script, service, workflow, security control, or automation has been implemented or verified. Validate each requirement against the actual repository, hosting configuration, and deployed application.

2. Production Readiness Principles

Every production release must follow these principles:

1. Security before exposure: Protect accounts, private records, uploaded documents, credentials, and administrative functions before enabling public access.
2. Reproducible deployment: Deploy a reviewed release using a committed lockfile and a traceable build artifact.
3. Controlled database changes: Review migrations separately from application deployment and understand their recovery implications.
4. Fail safely: Failed authentication, authorization, payment verification, or required dependency checks must not produce false success.
5. Observe the system: Monitor application health, errors, storage, database capacity, and critical business workflows.
6. Recover deliberately: Maintain backups, tested restoration procedures, and a compatible rollback artifact.
7. Protect user privacy: Minimize data collection, redact sensitive logs, and restrict private data access.
8. Verify before declaring readiness: A directory, configuration file, successful build, or green health check alone does not prove production readiness.

3. Repository and Deployment Architecture

The following table describes the intended repository responsibilities. Confirm actual paths and implementation before relying on them operationally.

Component	Intended responsibility
index.html, pages/, education/, career/, account/, admin/, legal/	Public pages and user-facing interfaces
assets/css/, assets/js/, assets/data/, assets/images/, assets/icons/, assets/fonts/	Frontend styles, scripts, reviewed public datasets, and media
server.js, src/	Server startup, Express application, routes, middleware, controllers, services, and integrations
database/	Database schema, migrations, seed data, and fixtures
storage/	Runtime files, private documents, temporary files, and logs
infrastructure/	Deployment, backup, monitoring, recovery, and operational guidance
scripts/	Environment checks, migrations, data validation, and operational utilities
tests/	Unit, integration, API, database, security, end-to-end, and accessibility tests
docs/	Architecture, API, database, security, and operations documentation
.github/workflows/	CI, automated checks, dependency review, and approved deployment workflows
Dockerfile, docker-compose.yml	Container image construction and service orchestration
.env.example, .nvmrc, package.json, package-lock.json	Configuration template, runtime expectations, package metadata, and dependency lockfile

Application Entry-Point Policy

The repository structure identifies server.js, src/app.js, and index.html. Document their actual responsibilities before production deployment.

* server.js should be the designated production bootstrap if that is the chosen entry point.
* src/app.js may construct and export the Express application, if that matches the implementation.
* index.html may be served by Express or delivered by a separate static hosting layer.

Select and document one production startup command. Do not assume that all three files are independent server entry points.

4. Environment Strategy

Maintain separate environments for development, testing, staging, and production.

Development

Local implementation and debugging using synthetic data, local services, and development-only credentials.

Testing and CI

Automated verification with isolated test databases, controlled fixtures, mocked or sandboxed external services, and repeatable builds.

Staging

Production-like deployment for migrations, end-to-end workflows, release approval, and recovery rehearsal using non-production data.

Production

Restricted credentials, HTTPS, private storage, least-privilege database access, monitored services, backups, and controlled releases.

Do not share production secrets, databases, or private user records with development, test, or staging environments unless a specifically approved process provides appropriate sanitization and access controls.

5. Pre-Deployment Readiness Gate

Complete this checklist before the first production release.

Application and Runtime

* [ ]	Confirm the production entry point and startup command.
* [ ]	Confirm the supported Node.js version in the runtime configuration, package metadata, Docker image, and hosting environment.
* [ ]	Install dependencies from the committed lockfile.
* [ ]	Confirm required runtime dependencies are production dependencies.
* [ ]	Validate required environment variables at startup.
* [ ]	Confirm health and readiness endpoints exist and return appropriate results.
* [ ]	Verify graceful shutdown and request-draining behavior.
* [ ]	Confirm the production build excludes secrets, test data, and unnecessary development artifacts.

Infrastructure

* [ ]	Configure the production domain and HTTPS.
* [ ]	Configure a trusted reverse proxy or hosting ingress where required.
* [ ]	Restrict database and Redis access to approved services.
* [ ]	Confirm storage persistence, permissions, capacity, and retention.
* [ ]	Configure log rotation and application monitoring.
* [ ]	Confirm restart behavior and resource limits.
* [ ]	Establish database and file-storage backup procedures.

Security and Privacy

* [ ]	Test authentication, session handling, and password recovery.
* [ ]	Verify server-side authorization on private endpoints and individual resources.
* [ ]	Test administrative access restrictions.
* [ ]	Verify file upload validation and private document access.
* [ ]	Verify payment webhooks if payment functionality is enabled.
* [ ]	Check CORS, CSRF protections where applicable, security headers, and rate limits.
* [ ]	Verify logs redact credentials and sensitive personal information.
* [ ]	Review the dependency inventory and resolve or explicitly assess security findings.
* [ ]	Verify the private security-reporting procedure and relevant legal documentation.

Operations

* [ ]	Test migrations on a staging database copy.
* [ ]	Confirm a recent successful backup and test restoration.
* [ ]	Identify a known-good rollback artifact.
* [ ]	Run the critical smoke tests.
* [ ]	Confirm monitoring alerts reach a responsible operator.
* [ ]	Document the release identifier and deployment approval.

Do not proceed when a critical security control, data recovery requirement, or essential user workflow has not been verified.

6. Environment Variables and Secrets

Use .env.example as a documentation template, not as a production secrets file.

Configure production secrets through the hosting provider’s secret manager or another approved secrets-management mechanism.

Review the actual configuration code in server.js, src/config/, and any environment-checking scripts before relying on particular variable names.

Area	Required control
Runtime	Explicit production mode and the correct application port
Public URL	Correct canonical origin and allowed browser origins
Database	Least-privilege credentials, restricted network access, and TLS where supported
Sessions	High-entropy secrets, secure cookie attributes, appropriate expiry, and shared storage for multiple application instances where necessary
Authentication	Password hashing, token expiry, verification/reset flows, and abuse protection
Email	Secret-managed provider credentials and verified sender configuration
File storage	Private storage configuration and restricted access
Payments	Provider-specific credentials, webhook verification, and environment separation
Queues	Secure connections, retry limits, and failure-handling configuration where applicable
Monitoring	Error-reporting and alert configuration with sensitive-data redaction

Secret-Management Requirements

1. Use different credentials for each environment.
2. Apply least privilege to service accounts and database users.
3. Rotate credentials that are exposed or suspected to be compromised.
4. Never put server-only secrets in browser-delivered JavaScript or public JSON.
5. Never log full authorization headers, session cookies, password-reset tokens, private documents, or payment secrets.
6. Ensure production startup fails safely when required secrets are missing or invalid.
7. Keep .env and environment-specific secret files out of version control and build artifacts.

Environment variables listed in .env.example are not proof that the application reads or validates them.

7. Pre-Deployment Verification

Run commands from the repository root. First inspect package.json and confirm the relevant scripts exist.

node —version
npm —version
npm ci
npm test
npm run lint

Only run npm test or npm run lint if those scripts are defined and configured.

Where implemented, also run the appropriate checks for:

* Environment configuration.
* Public JSON and content validation.
* Database migrations.
* API integration tests.
* Authorization and security regressions.
* Browser-based end-to-end tests.
* Accessibility and responsive behavior.
* Dependency vulnerabilities and accidental secret inclusion.

Review the Change Set

git status —short
git diff —check
git diff

Review staged changes before committing. Ensure that .env, database dumps, private documents, logs, and local storage have not been included.

Dependency Review

* Review npm audit findings and assess their actual impact.
* Update dependencies through reviewed changes rather than untested production modifications.
* Confirm package-lock.json is consistent with package.json.
* Avoid including development tools in the production image unless specifically required.
* Build the exact artifact intended for release and retain its identifier.

A successful dependency installation does not prove that the application is secure or that all tests pass.

8. Deployment Workflow

Use the following workflow for every release.

Phase A — Prepare the Release

1. Merge reviewed changes into the designated release branch.
2. Confirm required CI checks pass.
3. Review the diff for secrets and unrelated changes.
4. Update CHANGELOG.md and relevant documentation.
5. Verify the dependency lockfile and production build.
6. Identify required environment-variable changes.
7. Review database migrations and recovery implications.
8. Record the commit hash, build identifier, and intended release version.

Phase B — Deploy to Staging

1. Deploy the candidate release to staging.
2. Use separate credentials and non-production data.
3. Apply migrations through the approved migration process.
4. Verify health and readiness endpoints.
5. Test critical workflows supported by the implementation.
6. Inspect logs, resource usage, and external-service failures.
7. Confirm the rollback procedure remains viable.
8. Obtain release approval.

Phase C — Deploy to Production

1. Confirm the latest backup completed successfully.
2. Verify that the recovery procedure and rollback artifact are available.
3. Deploy the approved artifact.
4. Apply migrations once through a designated migration job or operator unless the migration system explicitly supports safe coordinated execution.
5. Wait for the application to become ready.
6. Run smoke tests against the production domain.
7. Monitor errors, latency, database connections, storage, queues, and critical workflows.
8. Record the release, migration status, verification results, and any follow-up work.

Hosting-Specific Instructions

If the repository contains instructions for Render, Docker Compose, or another hosting platform, use the instructions matching the actual deployment target.

A configuration file existing in the repository does not prove that the corresponding infrastructure is deployed or correctly configured.

9. Docker and Container Deployment

If MedOrbits is deployed through Docker, verify the actual Dockerfile and docker-compose.yml before using them in production.

* Use a maintained, supported Node.js runtime and a reviewed base image.
* Prefer reproducible image references for release deployments.
* Run the application as a non-root user.
* Keep environment files and secrets out of the image build context.
* Ensure production dependencies are installed correctly.
* Verify mounted storage permissions.
* Restrict published ports to those intentionally exposed.
* Keep MySQL and Redis inaccessible from the public internet.
* Apply reasonable CPU, memory, and process limits.
* Configure log rotation and graceful shutdown.
* Verify that the health check matches the actual Express route.
* Review the impact of read-only filesystem settings before enabling them.

For Compose deployments, validate the configuration before starting services:

docker compose config -q
docker compose build app
docker compose up -d
docker compose ps
docker compose logs —tail=200 app

These commands apply only if the corresponding services and Compose configuration exist.

Do not treat a running container as proof that the application is ready to serve traffic.

10. Database Operations and Migrations

First confirm which database engine the application actually uses. If MySQL is selected, keep connection settings, SQL syntax, migration tooling, backup procedures, and operational instructions consistent with MySQL.

Database Requirements

* Use a dedicated production database and least-privilege application account.
* Restrict database network access.
* Use encrypted connections where supported by the deployment architecture.
* Apply schema changes through reviewed, version-controlled migrations.
* Separate production migrations from development seed scripts and test fixtures.
* Monitor slow queries, connection-pool saturation, storage capacity, and failed migrations.
* Avoid manual schema changes that cannot be reconciled with migration history.
* Define retention, maintenance, indexing, and capacity policies.

Migration Release Procedure

Before a migration:

1. Review the SQL and expected data changes.
2. Test it against a representative staging database.
3. Assess locks, execution time, downtime, and compatibility.
4. Confirm the backup and recovery plan.
5. Identify whether the application can operate safely during the transition.
6. Record the migration identifier and execution result.

Prefer backward-compatible, expand-and-contract migrations for changes requiring multiple deployment stages.

A rollback is not always equivalent to running a reverse migration. Destructive schema or data changes may require restoration or a forward-fix migration.

Never run an unverified migration against production.

11. Private Documents and Storage

Treat application records, identity documents, educational certificates, and other user uploads as private unless there is a documented reason for public access.

Required controls include:

* Store private files outside the public web root or in private object storage.
* Authorize each upload, view, download, replacement, and deletion operation.
* Use generated storage identifiers instead of trusting user-supplied paths.
* Enforce upload size limits and file-type allowlists.
* Validate file content rather than relying only on extensions or browser MIME types.
* Prevent path traversal, executable uploads, and public directory listing.
* Use malware scanning or quarantine where required by the risk assessment.
* Avoid permanent public links to private documents.
* Apply suitable retention and deletion policies.
* Encrypt and restrict access to backups.
* Clean up temporary files according to a documented policy.

If the deployment uses storage/private/, storage/temporary/, or storage/logs/, ensure these locations are not exposed through static-file middleware.

A Docker volume or private directory alone does not enforce application-level authorization.

12. Authentication, Authorization, and Application Security

Accounts and APIs

* Enforce authentication on private endpoints.
* Verify authorization for each protected resource.
* Validate request bodies, route parameters, and query parameters on the server.
* Use parameterized database queries.
* Apply context-appropriate output encoding.
* Configure CSRF protection where applicable.
* Restrict CORS to approved origins.
* Configure security headers and a suitable Content Security Policy.
* Apply rate limits to sensitive and abuse-prone endpoints.
* Use secure, HttpOnly cookies with appropriate SameSite settings.
* Use Secure cookies in HTTPS production.
* Rotate session identifiers after authentication and privilege changes.
* Do not trust client-supplied roles, ownership, payment status, or subscription status.
* Avoid exposing stack traces or internal implementation details in client responses.

Administrative Access

* Protect both administrative pages and their backing API routes.
* Require strong authentication and use multi-factor authentication where available.
* Apply least privilege and review administrative access periodically.
* Record security-relevant administrative activity without unnecessarily logging personal information.
* Revoke access promptly when it is no longer required.

Payments and Subscriptions

If payment functionality is enabled:

* Use supported hosted or tokenized payment flows.
* Do not store raw card data.
* Verify webhook signatures using the provider’s documented method and the exact request bytes required.
* Make event processing idempotent and safe for retries.
* Validate transaction identity, amount, currency, and expected state.
* Reconcile local records with provider records.
* Keep test and live credentials separate.
* Test duplicate events, failed payments, renewals, refunds, cancellations, and interrupted processing where relevant.

A browser redirect or client-supplied payment status is not proof of successful payment.

13. Privacy and Legal Readiness

Before launch, review the published legal content against actual product behavior and applicable requirements.

Relevant documents may include:

* Privacy policy and terms of service.
* Cookie policy and consent preferences.
* Data deletion and grievance procedures.
* Refund and payment terms.
* Employer and job-service terms.
* Accessibility statements.
* Relevant disclosures for external services and data processors.

Verify data collection, purposes, retention, deletion, access controls, consent, and third-party sharing.

Ensure that claims about admission, accreditation, fees, scholarships, employment, salaries, loans, or outcomes are accurate and supported by appropriate evidence.

Do not promise guaranteed admissions, jobs, or financial outcomes without a valid and documented basis. Seek qualified legal advice when required.

14. Monitoring, Logging, and Alerts

Monitoring must cover both technical health and critical business workflows.

Area	Monitor
Availability	Health-check failures, uptime, restart loops
Application	HTTP 5xx rate, latency, error trends
Authentication	Repeated failures, suspicious account activity
Database	Availability, connection saturation, slow queries, disk capacity
Storage	Capacity, failed uploads, access-denied events
Email	Delivery failures and provider errors
Payments	Webhook failures, reconciliation mismatches, duplicate processing
Queues	Backlog, retries, failed jobs, dead-letter volume
Backups	Job failures, backup age, storage availability

Configure alert thresholds based on the actual workload and service objectives. Assign an owner and escalation path for each critical alert.

Logs should be structured, access-controlled, appropriately retained, and protected from unauthorized modification. Redact secrets, session data, payment credentials, and unnecessary personal information.

A monitoring dashboard without actionable alerts and responsible ownership is insufficient.

15. Backups and Disaster Recovery

Define recovery requirements before launch.

Document:

* Recovery Point Objective (RPO): The maximum acceptable amount of data loss, expressed as a time interval.
* Recovery Time Objective (RTO): The target time to restore service after an incident.

Back up the database and any required private file storage. Keep recovery copies protected from the primary environment and encrypt them where appropriate.

Recovery Requirements

1. Monitor scheduled backup jobs.
2. Alert on backup failures or excessive backup age.
3. Restrict access to backup files and recovery credentials.
4. Keep copies separate from the primary failure domain where feasible.
5. Test restoration in an isolated environment.
6. Verify restored data, application compatibility, and access controls.
7. Document restoration order, required secrets, DNS changes, and validation steps.
8. Record restore-test dates, results, and corrective actions.

A successful backup job does not prove recoverability. A tested restore is required.

Do not select RPO or RTO targets without considering business impact, storage capacity, recovery tooling, and operational resources.

16. Rollback and Incident Response

Before deployment, identify a known-good application artifact and determine whether it remains compatible with the current database schema.

For a failed release:

1. Assess impact and stop further rollout.
2. Follow the approved platform-specific rollback procedure.
3. Restore the previous application artifact if compatible with the database state.
4. Do not blindly reverse destructive migrations.
5. Evaluate data-loss implications before restoring a backup.
6. Verify health checks and critical workflows.
7. Preserve relevant logs and release metadata.
8. Document the incident, user impact, root cause, corrective actions, and follow-up owner.

Suspected Security Incidents

* Contain the affected access or service.
* Rotate exposed credentials and revoke compromised sessions where appropriate.
* Preserve relevant evidence.
* Assess affected systems and information.
* Follow SECURITY.md and applicable incident-response procedures.
* Determine notification obligations with qualified guidance where necessary.

17. Frontend, Accessibility, and SEO

Before release, verify:

* [ ]	The canonical domain and allowed origins are correct.
* [ ]	HTTPS and certificate renewal are working.
* [ ]	robots.txt, sitemap.xml, web manifests, and security contact files are accurate where present.
* [ ]	Staging and preview environments are not unintentionally indexed.
* [ ]	Page titles, descriptions, headings, and canonical links are appropriate.
* [ ]	CSS, JavaScript, JSON, images, and fonts load from the intended paths.
* [ ]	Mobile navigation, forms, and interactive controls work.
* [ ]	Keyboard navigation and visible focus are preserved.
* [ ]	Forms have meaningful labels and accessible validation messages.
* [ ]	Text and controls meet applicable contrast expectations.
* [ ]	Reduced-motion preferences are respected where relevant.
* [ ]	Error and offline pages work where supported by the architecture.
* [ ]	Public JSON does not expose secrets or private user data.

Automated accessibility tests should be supplemented with manual keyboard and interaction checks.

18. Production Smoke Tests

Run smoke tests against the deployed environment after every release.

* [ ]	Homepage loads over HTTPS.
* [ ]	Navigation and footer work across supported screen sizes.
* [ ]	Education, admissions, course, college, and university pages load where implemented.
* [ ]	Career, job, internship, and employer pages load where implemented.
* [ ]	Search and filters return expected results.
* [ ]	Registration, login, logout, verification, and password recovery work where implemented.
* [ ]	Account and administrative endpoints enforce authorization.
* [ ]	Forms validate input and display appropriate success or error states.
* [ ]	Private uploads and downloads enforce access checks.
* [ ]	Email workflows work where enabled.
* [ ]	Payment and subscription flows work where enabled.
* [ ]	Database reads, writes, and migration state are healthy.
* [ ]	Health endpoints and alerts behave as expected.
* [ ]	No unresolved critical application, browser, or accessibility errors remain.

Do not perform destructive tests against real users or live payment transactions without an approved procedure.

19. Change Management and Release Records

Each production release should have:

* A reviewed pull request or change record.
* Passing required automated checks.
* A commit hash and identifiable build artifact.
* A documented migration plan where applicable.
* Staging verification and approval.
* A rollback plan and known-good artifact.
* Post-deployment smoke-test results.
* Updated documentation and changelog entries where appropriate.

Emergency changes should be documented and reviewed after the immediate incident has been contained.

20. Operational Ownership

Assign a responsible owner for each critical operational function.

Function	Responsibility
Application releases	Release approval, deployment, and rollback
Database	Migrations, capacity, backups, and recovery
Security	Vulnerability handling, access review, and incident response
Storage	Private files, retention, capacity, and recovery
Payments	Reconciliation and provider incident handling, if enabled
Monitoring	Alert configuration, triage, and escalation
Privacy and support	User requests, data handling, and applicable communication

Document the actual people or teams responsible in the private operational runbook. Do not publish personal contact details unnecessarily.

21. Final Production Approval

Use this checklist before declaring MedOrbits production-ready.

Release Readiness Checklist

* [ ]	Production configuration and secrets have been verified.
* [ ]	Authentication, authorization, and private document access have been tested.
* [ ]	Critical automated tests and release checks have passed.
* [ ]	Database migrations have been reviewed and staged.
* [ ]	Backup restoration has been demonstrated.
* [ ]	Health checks, logs, alerts, and ownership are in place.
* [ ]	A compatible rollback artifact and procedure are available.
* [ ]	Critical user journeys have passed production smoke tests.
* [ ]	Privacy, licensing, and public-facing claims have been reviewed.
* [ ]	Release identifier and verification results have been recorded.

Marking these items is an operational record, not an automated verification. Retain supporting evidence for each critical requirement.

Do not declare MedOrbits production-ready until the deployed implementation has passed the required security, functional, recovery, monitoring, and operational checks. Any unresolved critical risk must have an explicit decision from the authorized release owner.

22. Document Maintenance

Review this guide whenever the following changes occur:

* Hosting platform or deployment architecture.
* Node.js runtime or dependency management.
* Database engine, schema, or migration system.
* Authentication, session, or authorization design.
* Private file storage or retention policies.
* Payment provider or subscription behavior.
* Backup, monitoring, or recovery procedures.
* Production release and rollback processes.

Keep this document consistent with the actual implementation. Remove obsolete instructions, identify unimplemented controls, and do not describe proposed infrastructure as deployed infrastructure.

⸻

End of Production Deployment Guide

MedOrbits
Education · Admissions · Careers · Recruitment
Study · Work · Grow