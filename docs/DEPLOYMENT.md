MedOrbits — Deployment Guide

File: docs/DEPLOYMENT.md
Version: 1.0.0
Status: Deployment reference
Application: MedOrbits
Runtime: Node.js and Express, where applicable

⸻

1. Purpose

This document describes how to configure, build, deploy, verify, and maintain MedOrbits across development, staging, and production environments.

It covers:

* Static website deployment.
* Node.js and Express API deployment.
* Environment variables and secret management.
* Database connectivity and migrations.
* DNS, HTTPS, CORS, and security configuration.
* Static JSON datasets and asset paths.
* File storage and external integrations.
* Health checks, logs, backups, and rollback procedures.

The instructions are designed to support managed hosting platforms such as Render, along with other compatible deployment environments.

Important: These are deployment procedures and recommendations. Actual commands, service names, database settings, and hosting paths must match the repository and hosting configuration.

2. Deployment architecture

MedOrbits may be deployed as a combined application or as separate static website and API services.

<CodeBlock language=“mermaid” editable>
flowchart TB
    User[Website Visitor]
    DNS[DNS and HTTPS]
    Web[Static Website or Express Frontend]
    API[Node.js and Express API]
    DB[(Configured Database)]
    Storage[Private File Storage]
    External[External Providers]
    Logs[Logs and Monitoring]
User —> DNS
DNS —> Web
User —> API
API —> DB
API —> Storage
API -. optional integrations .-> External
Web -. optional API requests .-> API
API -. telemetry .-> Logs
</CodeBlock>

Choose one deployment model and document the actual production topology.

Model A — Combined application

The Express server serves both the frontend assets and API.

Advantages:

* One deployment artifact.
* Potentially simpler same-origin API requests.
* Fewer cross-origin configuration requirements.

Requirements:

* Correct static asset paths.
* Explicit API route registration.
* Proper handling of unknown routes and missing assets.
* A deployment health endpoint.

Model B — Separate frontend and API

Static hosting serves the HTML, CSS, JavaScript, images, and public JSON datasets. A separate Node.js service handles API requests.

Advantages:

* Independent frontend and backend releases.
* Static asset caching through a CDN.
* Separate scaling and runtime configurations.

Requirements:

* Explicit API base URL configuration.
* Correct CORS configuration.
* HTTPS on both origins.
* Appropriate cache policies for static datasets and private API responses.

Do not deploy the same API path or frontend route to multiple services without a defined routing strategy.

3. Deployment prerequisites

Before deploying, confirm that you have:

* Access to the MedOrbits repository.
* A valid package.json and lockfile, if using Node.js.
* A supported Node.js runtime.
* The correct build and start commands.
* Production environment variables.
* Database credentials, if a database is required.
* DNS access for the intended domain.
* HTTPS enabled for public services.
* Any required payment, email, AI, or storage-provider credentials.
* A backup and recovery plan for persistent data.

The project has previously used Render and a Node.js runtime requirement of >=20.0.0. Confirm the current package.json and the hosting platform’s supported runtime before selecting a deployment version.

4. Repository readiness

Check the repository before deploying.

A typical structure may include:

medorbits/
├── index.html
├── pages/
├── official-documents/
├── support/
├── assets/
│   ├── css/
│   ├── js/
│   ├── data/
│   ├── images/
│   └── icons/
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── validators/
├── tests/
├── docs/
├── server.js
├── package.json
├── package-lock.json
├── .env.example
└── README.md

This is a reference layout. Preserve the actual repository structure and use the real application entry point.

Pre-deployment checks

* [ ]	Confirm the production branch.
* [ ]	Confirm that required files are committed.
* [ ]	Confirm that secrets are not tracked by Git.
* [ ]	Confirm that package.json scripts are correct.
* [ ]	Confirm that the lockfile matches the dependency manifest.
* [ ]	Confirm that all referenced assets and JSON datasets exist.
* [ ]	Confirm that the server listens on the configured port.
* [ ]	Confirm that critical tests pass.
* [ ]	Confirm that database migrations are ready, if applicable.
* [ ]	Confirm that production configuration differs safely from development configuration.

5. Environment configuration

Use environment variables for deployment-specific settings. Do not hard-code production credentials, API keys, or database passwords into source files.

A sample .env.example may contain:

NODE_ENV=development
PORT=3000
DATABASE_URL=
SESSION_SECRET=
ADMIN_TOKEN=
AI_API_KEY=
AI_API_URL=
AI_MODEL=

These names reflect possible project configuration conventions. Keep only the variables required by the actual application.

Production requirements

* Set NODE_ENV=production for a Node.js production service.
* Use the port supplied by the hosting platform where required.
* Configure the actual database connection string.
* Generate strong secrets using a cryptographically secure random generator.
* Keep AI and payment-provider keys server-side.
* Configure CORS origins explicitly.
* Never commit a populated production .env file.
* Do not print environment variables in deployment logs.

A deployment should fail clearly if a mandatory setting is missing. Optional integrations should be disabled safely when their configuration is absent.

6. Local deployment verification

Install dependencies from the repository root using the project’s package manager.

For an npm-based project:

npm ci

Run the test suite if the repository defines one:

npm test

Start the application using its documented start script:

npm start

If the project defines a separate development script, use it only for local development.

Test the configured health endpoint, if implemented:

curl -i http://localhost:3000/health

Do not assume /health exists until it has been confirmed in the Express route configuration.

If the project is static-only, use its existing static preview or development server instead of attempting to start a nonexistent Express backend.

7. Render deployment

Use this section if Render is the chosen host.

Step 1 — Connect the repository

1. Open the Render dashboard.
2. Create a new Web Service for the backend, or use the appropriate static-site service if the project is frontend-only.
3. Connect the MedOrbits Git repository.
4. Select the intended production branch.
5. Configure the service’s root directory if the application is inside a subdirectory.

Step 2 — Configure build and start commands

For a standard npm-based Node.js service, a typical configuration is:

Build command

npm ci

Start command

npm start

Use these commands only if the package scripts support them. If the project requires a build step, database migration command, or different entry point, configure the actual required commands.

Avoid using npm audit fix —force as a routine deployment step. It can introduce breaking dependency upgrades. Review dependency vulnerabilities, update packages deliberately, and test the resulting changes.

Step 3 — Configure environment variables

In the service’s environment settings, add all required production variables.

Examples may include:

* NODE_ENV
* DATABASE_URL
* SESSION_SECRET
* ADMIN_TOKEN
* AI provider settings, if enabled.
* Payment provider settings, if enabled.
* Allowed frontend origins, if required by the application.

Do not copy secrets into a public repository or frontend build configuration.

Step 4 — Configure the health check

Use a lightweight endpoint that returns a successful status when the service is ready to accept requests.

A basic health endpoint should not reveal database credentials, environment variables, internal file paths, or detailed infrastructure diagnostics.

If readiness depends on a database, distinguish process health from dependency readiness where practical.

Step 5 — Deploy

Trigger a deployment and review the build and runtime logs.

Check for:

* Dependency installation errors.
* Missing modules.
* Unsupported Node.js versions.
* Missing environment variables.
* Database connection failures.
* Failed route registration.
* Incorrect static file paths.
* Port binding failures.
* Health-check failures.

The hosting service’s successful build status does not prove that all application workflows are working correctly.

8. Node.js server requirements

For Express deployments, verify that the server listens on the configured port and an appropriate network interface.

Typical pattern:

const port = Number(process.env.PORT || 3000);
app.listen(port, “0.0.0.0”, () => {
  console.log(`MedOrbits server listening on port ${port}`);
});

Use this pattern only if compatible with the existing server bootstrap. Do not create a second listener if server.js already starts the application.

The server should:

* Validate mandatory environment variables.
* Register middleware and routes in the correct order.
* Handle startup failures cleanly.
* Return consistent API errors.
* Avoid exposing stack traces in production responses.
* Handle graceful shutdown and connection cleanup where supported.
* Keep long-running work out of synchronous request handlers where practical.

If the application uses a separate startup module, preserve its existing architecture.

9. Database deployment

Before connecting production traffic to a database:

1. Confirm the actual database engine and driver.
2. Create or select the correct production database.
3. Configure the connection string securely.
4. Apply reviewed, version-controlled migrations.
5. Verify schema compatibility with the deployed application.
6. Test database connectivity and critical queries.
7. Confirm backups and recovery procedures.
8. Confirm connection-pool settings and hosting limits.

Do not assume the application uses PostgreSQL or MySQL without checking its configuration and dependencies.

Migration safety

* Never reset or drop the production database during routine startup.
* Test migrations against a staging or disposable database.
* Back up data before risky schema changes.
* Prefer backward-compatible changes during rolling deployments.
* Separate schema migration from ordinary application startup where appropriate.
* Document rollback or forward-recovery procedures.

See docs/DATABASE_SCHEMA.md for the proposed schema and the requirements for reconciling it with the actual database.

10. Static assets and JSON datasets

MedOrbits pages depend on HTML, CSS, JavaScript, images, icons, and potentially public JSON datasets.

Before deployment, verify that:

* Referenced assets exist at the expected paths.
* JSON files parse correctly.
* Dataset schemas pass validation.
* Relative and absolute URLs resolve correctly.
* File and directory casing matches the deployment environment.
* The configured base path is correct.
* Required files are included in the deployment artifact.

Example URL convention:

/assets/css/
/assets/js/
/assets/data/
/assets/images/
/assets/icons/

This is illustrative. Use the existing project paths.

Cache policy

* Fingerprinted static assets can use long-lived immutable caching.
* HTML documents should have a cache policy suitable for the release process.
* Public JSON datasets should have a freshness policy appropriate to their update frequency.
* Private API responses and user-specific documents must not be publicly cached.
* Ensure that a deployment does not leave users with incompatible HTML and JavaScript versions.

Do not publish private application records or personal documents in static JSON.

11. Domain, DNS, and HTTPS

Before making the site publicly available:

1. Configure the domain in the hosting platform.
2. Add the exact DNS records required by the provider.
3. Wait for DNS propagation.
4. Verify domain ownership if required.
5. Enable and verify TLS certificates.
6. Redirect HTTP traffic to HTTPS where supported.
7. Configure canonical URLs and production origins.
8. Check redirects for loops and incorrect hostnames.

Do not invent DNS records. Use the exact records supplied by the selected host or DNS provider.

Production origin consistency

Ensure that:

* Canonical URLs point to the intended production domain.
* Open Graph and sitemap URLs use the correct origin.
* API requests target the intended API service.
* OAuth or authentication callback URLs match provider configuration.
* Payment webhook URLs match the deployed endpoint.
* CORS permits only the necessary frontend origins.

12. CORS and browser security

For a separate frontend and API, explicitly allow trusted origins.

Avoid wildcard origins when credentials are enabled.

Review:

* Allowed origins.
* Allowed methods.
* Allowed headers.
* Credential handling.
* Preflight request behavior.
* Cookie security and SameSite policy.
* CSRF protection where required.
* Security headers and content security policy.

Do not treat CORS as authentication. The API must enforce authorization regardless of the request’s origin.

13. File storage and uploads

If MedOrbits accepts academic records, identity documents, or other private files, verify that production storage is durable and protected.

Requirements:

* Use private persistent storage or private object storage.
* Do not assume the deployment filesystem persists across restarts or redeployments.
* Validate file type, size, and file signature.
* Use server-generated storage keys.
* Apply malware scanning where suitable scanning is available.
* Check ownership and authorization before serving downloads.
* Define retention and deletion policies.
* Back up file storage and related database metadata consistently.

Test upload, retrieval, access denial, and deletion workflows in a non-production environment before enabling them for users.

14. External integrations

Integrations may include email, AI services, payment providers, analytics, or other external APIs.

For each integration:

* Store credentials in the hosting environment.
* Configure connection and request timeouts.
* Handle provider failures without exposing sensitive details.
* Apply rate limits and cost controls.
* Validate inbound webhooks.
* Use idempotency for retry-sensitive operations.
* Monitor failures and provider response codes.
* Define a safe fallback when the integration is unavailable.

Do not enable an integration in production until its credentials, callback URLs, permissions, and error handling have been tested.

15. Security hardening

Before production release:

* [ ]	Enforce HTTPS.
* [ ]	Confirm production secrets are not committed.
* [ ]	Review authentication and authorization middleware.
* [ ]	Check for insecure direct object references.
* [ ]	Validate all request payloads and query parameters.
* [ ]	Apply rate limits to sensitive endpoints.
* [ ]	Configure explicit CORS origins.
* [ ]	Restrict document uploads and downloads.
* [ ]	Review administrative endpoints.
* [ ]	Review database permissions.
* [ ]	Verify error handling and log redaction.
* [ ]	Review dependency vulnerabilities.
* [ ]	Confirm backup and restoration procedures.
* [ ]	Test payment webhook verification, if applicable.

A successful deployment is not a substitute for security testing.

16. Monitoring and logging

Monitor application health and failures after release.

Recommended signals:

* Application availability.
* Request volume and latency.
* HTTP error rates.
* Database connection failures.
* External integration failures.
* Upload failures.
* Payment reconciliation errors, if enabled.
* Memory and CPU usage.
* Deployment and startup failures.

Logs should include useful timestamps and request identifiers while avoiding:

* Passwords.
* Access tokens and session cookies.
* Database connection strings.
* Payment credentials.
* Uploaded document contents.
* Unnecessary personal information.

Configure log retention and access restrictions according to operational needs.

17. Post-deployment smoke tests

Run these checks after each production deployment.

Website

* [ ]	Homepage loads successfully.
* [ ]	Navigation and footer links work.
* [ ]	CSS, JavaScript, images, and icons load.
* [ ]	Mobile and desktop layouts render correctly.
* [ ]	Search, filtering, and forms behave as expected.
* [ ]	No critical browser-console errors occur.

Data and official resources

* [ ]	JSON datasets load and parse.
* [ ]	Important pages display correct source links.
* [ ]	Verification dates and status labels are accurate.
* [ ]	Expired or unsupported claims are not presented as current.
* [ ]	Official-document destinations resolve correctly.

API and backend

* [ ]	Health endpoint returns the expected response.
* [ ]	API routes register successfully.
* [ ]	Authentication and authorization work.
* [ ]	Database reads and writes work.
* [ ]	Validation and error responses are consistent.
* [ ]	Private records cannot be accessed by unauthorized users.

Business workflows

* [ ]	Application creation and submission work.
* [ ]	Document upload and authorized retrieval work, if enabled.
* [ ]	Support ticket creation works, if enabled.
* [ ]	Payment verification and webhook processing work, if enabled.
* [ ]	Administrative operations enforce the correct permissions.

Operations

* [ ]	Logs are available.
* [ ]	Alerts are configured where required.
* [ ]	Backups are current.
* [ ]	The previous release can be restored or safely redeployed.

18. Rollback and incident response

If a deployment introduces a production issue:

1. Identify the affected release and the scope of the problem.
2. Assess user impact and whether sensitive data or transactions are affected.
3. Stop or limit harmful workflows if necessary.
4. Roll back to a known-good release when safe.
5. Verify compatibility between the application and database schema.
6. Restore data only when necessary and according to the recovery plan.
7. Re-run critical smoke tests.
8. Record the incident, cause, and corrective action.

A code rollback does not automatically reverse database migrations, payment events, or external side effects. Prefer forward-compatible migrations and explicit recovery procedures.

19. Backup and recovery

Maintain a documented recovery plan for production data.

Define:

* Backup frequency.
* Retention period.
* Encryption requirements.
* Authorized backup access.
* Recovery-point objective (RPO).
* Recovery-time objective (RTO).
* Restoration procedure.
* Restoration test schedule.
* Coverage of both database and file storage.

Do not assume that the hosting provider’s standard service automatically provides all required backups or recovery guarantees. Confirm the actual service configuration.

20. Release and deployment workflow

A recommended release workflow is:

<CodeBlock language=“mermaid” editable>
flowchart TD
    A[Commit Changes]
    B[Install Locked Dependencies]
    C[Run Lint and Tests]
    D[Validate Data and Configuration]
    E[Review Migration Changes]
    F[Deploy to Staging]
    G[Run Integration and Smoke Tests]
    H{Release Approved?}
    I[Deploy to Production]
    J[Run Production Smoke Tests]
    K[Monitor Release]
    L[Rollback or Remediate]
A —> B —> C —> D —> E —> F —> G —> H
H —>|No| L
H —>|Yes| I —> J —> K
J —>|Failure| L
</CodeBlock>

For small projects, some stages may be combined. Do not skip testing or migration review for changes that affect authentication, private data, payments, or critical application workflows.

21. Common deployment failures

Symptom	Checks
Build fails	Node.js version, package scripts, lockfile, missing dependencies
Server exits during startup	Environment variables, route imports, database initialization, module exports
Route.get() callback error	Verify route/controller imports and exported handler names
path-to-regexp error	Review route syntax against the installed Express and router versions
Service cannot bind to port	Confirm process.env.PORT and avoid duplicate listeners
Database connection fails	Verify driver, URL, credentials, network access, and TLS settings
Static assets return 404	Check root directory, file casing, mount paths, and deployment artifact
JSON parsing fails	Validate JSON syntax, encoding, and response content type
CORS errors	Verify the exact frontend origin and credential settings
Uploads disappear after deployment	Check whether the filesystem is ephemeral and move files to durable storage
Payment state is incorrect	Check webhook signature verification, idempotency, and reconciliation logs
Health check fails	Confirm endpoint path, response status, startup time, and dependency requirements

Use the actual error message and deployment logs to diagnose failures. Do not make unrelated dependency or database changes as a first response to a startup error.

22. Production readiness checklist

* [ ]	Correct repository and branch selected.
* [ ]	Runtime version supported.
* [ ]	Build and start commands verified.
* [ ]	Required environment variables configured.
* [ ]	Secrets stored securely.
* [ ]	Database connection and migrations verified.
* [ ]	Static assets and JSON datasets validated.
* [ ]	Domain and HTTPS configured.
* [ ]	CORS and browser security reviewed.
* [ ]	Private file storage verified.
* [ ]	Authentication and authorization tested.
* [ ]	Critical API and business workflows tested.
* [ ]	Health checks configured.
* [ ]	Monitoring and logs available.
* [ ]	Backups and restoration procedure tested.
* [ ]	Rollback or forward-recovery procedure documented.
* [ ]	Post-deployment smoke tests passed.
* [ ]	Data verification and official-source links checked.

23. Related documentation

* README.md — project setup and developer instructions.
* docs/ARCHITECTURE.md — system components and data flows.
* docs/API_REFERENCE.md — API contracts and endpoint conventions.
* docs/DATABASE_SCHEMA.md — proposed database entities and constraints.
* docs/DATA_VERIFICATION.md — content provenance and verification policy.
* .env.example — environment-variable names and placeholders.
* package.json — runtime scripts and dependency definitions.

Verify that each referenced file exists at the stated path in the repository.

⸻

Final deployment policy

Deploy only releases whose required configuration, security controls, data integrity, and critical workflows have been verified. Treat hosting status as one signal of availability, not proof that the full MedOrbits platform is correct or production-ready.

End of document.