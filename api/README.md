MedOrbits API — Developer Documentation

Project: MedOrbits
Directory: /api
Runtime: Node.js 20+
Architecture: REST API, service-oriented backend, PostgreSQL, background jobs
API specification: api/openapi.yaml
Status: Architecture and operational reference

⸻

1. Overview

The MedOrbits API provides backend functionality for education, medical admissions, student applications, notifications, document processing, authentication, and administrative operations.

The API follows a layered architecture that separates routing, middleware, validation, business logic, database access, and asynchronous processing.

Core objectives

* Consistent REST responses and HTTP status codes.
* Centralized validation and error handling.
* Secure authentication and resource-level authorization.
* PostgreSQL-backed persistence.
* Auditable administrative and application workflows.
* Reliable asynchronous job processing.
* OpenAPI-based API documentation.
* Configurable development, staging, and production environments.
* Automated testing and deployment verification.

Implementation rule: This README describes the intended architecture. The actual application entry point, route definitions, services, migrations, and package.json remain the source of truth for implemented behavior.

2. Directory structure

The following is a recommended structure. Preserve existing project files and adapt paths to the actual repository.

api/
├── README.md
├── openapi.yaml
├── worker.js
├── config/
│   ├── database.js
│   ├── environment.js
│   └── security.js
├── controllers/
│   ├── auth.controller.js
│   ├── application.controller.js
│   ├── notification.controller.js
│   ├── document.controller.js
│   └── admin.controller.js
├── middleware/
│   ├── auth.js
│   ├── error-handler.js
│   ├── rate-limit.js
│   ├── request-id.js
│   └── validation.js
├── routes/
│   ├── auth.routes.js
│   ├── application.routes.js
│   ├── notification.routes.js
│   ├── document.routes.js
│   └── admin.routes.js
├── services/
│   ├── application-service.js
│   ├── audit-service.js
│   ├── notification-service.js
│   └── README.md
├── validators/
│   ├── auth.validator.js
│   ├── application.validator.js
│   └── document.validator.js
├── jobs/
│   └── README.md
├── tests/
│   ├── unit/
│   ├── integration/
│   └── security/
└── migrations/
    └── README.md

Not every listed file is guaranteed to exist. Check the repository before importing modules, registering routes, or creating additional files. Keep directory names and import paths consistent with the actual codebase.

3. Technology stack

Component	Responsibility
Node.js 20+	JavaScript runtime
Express	HTTP routing and middleware
PostgreSQL	Relational persistence
pg	PostgreSQL connection pooling
OpenAPI 3.1	API contract and documentation
Background worker	Asynchronous job execution
Automated tests	Regression, integration, and security verification

Use the root package.json and lockfile as the authoritative sources for dependency versions and scripts.

4. API base URL

Configure the base URL for each deployment environment.

Environment	Example
Local development	http://localhost:3000/api
Staging	https://staging.example.com/api
Production	https://api.example.com/api

These hostnames are examples only. Replace them with the actual configured domains before publishing documentation.

Route registration

Routes should be mounted consistently in the Express application. For example:

app.use(‘/api/auth’, authRoutes);
app.use(‘/api/applications’, applicationRoutes);
app.use(‘/api/notifications’, notificationRoutes);

Register only modules that exist and export valid Express routers. Verify whether the application mounts routes at /api centrally or uses complete prefixes in individual registrations; do not accidentally duplicate the prefix.

5. OpenAPI documentation

The API specification is maintained at api/openapi.yaml.

It should document:

* Available endpoints and HTTP methods.
* Path and query parameters.
* Request-body and response schemas.
* Authentication requirements.
* Success and error responses.
* Pagination and filtering behavior.
* Upload constraints where applicable.
* Relevant security schemes and server URLs.

Before publishing

1. Compare every documented endpoint against the actual Express routes.
2. Verify HTTP methods, route prefixes, and parameter names.
3. Match request and response schemas to controller behavior.
4. Confirm authentication and authorization requirements.
5. Replace example server URLs with environment-appropriate values.
6. Validate the OpenAPI document using a compatible validator.
7. Run integration tests against the documented contract.

The OpenAPI specification describes an API contract. It does not automatically register routes or implement controller logic.

6. Environment configuration

Store secrets in deployment environment variables or a secret manager. Never commit real credentials to source control.

Variable	Requirement	Purpose
NODE_ENV	Recommended	Runtime environment
PORT	Deployment-dependent	HTTP server port
DATABASE_URL	Required for PostgreSQL access	Database connection string
SESSION_SECRET	If session-based authentication is used	Signs session identifiers
JWT_SECRET	If symmetric JWT signing is used	Signs and verifies tokens
JWT_PUBLIC_KEY	If asymmetric verification is used	Verifies signed tokens
ADMIN_TOKEN	Only for a deliberately designed token-based integration	Restricted administrative access
AI_API_KEY	If AI integration is enabled	External AI authentication
AI_API_URL	If AI integration is enabled	AI provider endpoint
AI_MODEL	If AI integration is enabled	Configured model identifier
DATABASE_SSL	If supported by the implementation	Enables worker database TLS configuration
WORKER_CONCURRENCY	Optional	Maximum concurrent worker jobs
WORKER_POLL_INTERVAL_MS	Optional	Worker polling interval
WORKER_MAX_ATTEMPTS	Optional	Maximum job attempts
WORKER_RETRY_BASE_MS	Optional	Initial retry backoff
WORKER_STALE_JOB_MS	Optional	Processing lease timeout
WORKER_SHUTDOWN_TIMEOUT_MS	Optional	Worker shutdown wait limit

These names are configuration references, not proof that every variable is currently read by the application. Confirm the actual environment parser and worker implementation before relying on them.

Use one consistent authentication strategy. Do not assume that a configured secret is active merely because it exists in the environment.

Local environment example

Create a local .env file only if the application loads environment files.

NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
WORKER_CONCURRENCY=3
WORKER_POLL_INTERVAL_MS=2000
WORKER_MAX_ATTEMPTS=5
WORKER_RETRY_BASE_MS=1000
WORKER_STALE_JOB_MS=300000
WORKER_SHUTDOWN_TIMEOUT_MS=30000

Replace the database placeholders with local development credentials. Do not use production credentials in development or test environments.

7. Database integration

Connection management

Use a shared PostgreSQL connection pool instead of creating a new pool for every request.

Recommended practices:

* Parameterize SQL queries to prevent SQL injection.
* Set connection limits appropriate for the deployment.
* Release checked-out clients in finally blocks.
* Use transactions for related multi-record changes.
* Apply schema changes through version-controlled migrations.
* Enable TLS when required by the database provider.
* Monitor query latency, connection exhaustion, and database errors.
* Use separate databases or isolated schemas for automated integration tests.

Example PostgreSQL pool

Adapt this example only if the application does not already have a shared pool.

‘use strict’;
const { Pool } = require(‘pg’);
if (!process.env.DATABASE_URL) {
  throw new Error(‘DATABASE_URL is required’);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});
pool.on(‘error’, (error) => {
  console.error(‘Unexpected idle PostgreSQL client error’, {
    message: error.message,
    code: error.code,
  });
});
module.exports = pool;

The example uses CommonJS. If the application uses ES modules, adapt the exports and imports to match its configured module system. Validate numeric environment variables rather than silently accepting invalid pool settings.

Database objects

Depending on the actual migrations and services, the application may use tables such as:

* applications
* application_status_history
* audit_logs
* notifications
* worker_jobs

Verify the required columns, indexes, constraints, foreign keys, and data types against the real schema.

Do not assume that a service automatically creates all the tables it needs. For example, worker schema initialization may create worker_jobs without creating the application, notification, or audit tables.

Transactions and migrations

Use transactions for operations that must succeed or fail together. Where a transaction uses a checked-out client, execute all statements through that client and release it in a finally block.

Migrations should be version-controlled, reviewed, and applied through a repeatable deployment process. Avoid ad hoc production schema changes.

8. Middleware responsibilities

Middleware should execute in a deliberate, documented order. A typical sequence is:

1. Request ID generation and structured request logging.
2. Security headers and CORS policy.
3. Request-body parsing with size limits.
4. Rate limiting.
5. Authentication.
6. Role-based authorization.
7. Request validation.
8. Route handlers.
9. Centralized error handling.

The exact order must reflect the application’s security model. For example, public authentication routes may use different rate limits from authenticated application routes.

Validation requirements

Validation middleware should:

* Validate path parameters, query strings, and request bodies.
* Reject malformed identifiers and invalid data types.
* Enforce field lengths and permitted values.
* Reject unexpected fields where strict schemas are required.
* Normalize input only where appropriate.
* Return consistent validation errors.
* Avoid logging credentials, tokens, uploaded documents, or unnecessary personal data.

Validation does not replace authorization. A syntactically valid user ID supplied by a client must not grant access to another user’s records.

9. Service-layer responsibilities

Keep business logic in services rather than duplicating it across controllers.

Application service

Responsibilities may include:

* Creating and retrieving applications.
* Updating editable drafts.
* Enforcing resource ownership.
* Validating permitted status transitions.
* Recording status history.
* Coordinating database transactions.

Audit service

Responsibilities may include:

* Recording security-relevant actions.
* Recording application status changes.
* Capturing the actor, action, resource, timestamp, and outcome.
* Restricting audit-log access to authorized personnel.
* Redacting sensitive metadata.

Never store passwords, session cookies, bearer tokens, full payment credentials, or unnecessary document contents in audit logs.

Notification service

Responsibilities may include:

* Creating notifications.
* Listing notifications belonging to the authenticated user.
* Counting unread notifications.
* Marking individual notifications read or unread.
* Supporting authorized bulk operations.

Derive user identity from the authenticated request context, not from an untrusted request body.

10. Background worker

Entry point: api/worker.js

The worker is intended for asynchronous operations that should not block HTTP responses.

Potential job types include:

* email.send
* notification.create
* application.process
* document.process
* webhook.deliver

Enable only job types with implemented and tested handlers. An unknown job type or missing handler must not be reported as successful.

Expected worker behavior

* Claim jobs using PostgreSQL row locking.
* Support multiple worker processes with FOR UPDATE SKIP LOCKED.
* Retry transient failures with exponential backoff and jitter.
* Recover jobs whose processing leases have expired.
* Handle shutdown signals and active-job cancellation where supported.
* Emit structured lifecycle logs without exposing sensitive payloads.
* Prevent stale workers from completing jobs after losing their leases.

Running the worker

If a worker script is not already defined in the root package.json, add the following entry to the existing scripts object:

{
  “scripts”: {
    “worker”: “node api/worker.js”
  }
}

Merge this entry into the existing file; do not replace the complete package.json with this fragment.

Run the worker from the repository root:

npm run worker

Deploy it as a separate background process when the hosting platform supports separate web and worker services.

Reliability and retry safety

Background handlers must be idempotent. A process can perform an external action and crash before marking the job complete, causing the action to run again after a retry.

Use provider idempotency keys, unique operation records, transactional outbox patterns, or equivalent safeguards where appropriate.

Distinguish transient failures from permanent failures. Do not retry invalid payloads, unsupported job types, or authorization failures indefinitely.

Monitor pending-job counts, job age, retry counts, processing duration, and exhausted jobs.

11. Authentication and authorization

Implement authentication centrally and apply authorization to every restricted operation.

Security requirements:

* Hash passwords with a modern password-hashing algorithm and appropriate parameters.
* Use short-lived access tokens or secure sessions.
* Verify token signatures and relevant claims, including issuer, audience, and expiration.
* Enforce resource ownership in database queries or service logic.
* Apply explicit authorization checks to administrative routes.
* Rotate and revoke credentials where supported.
* Never return secrets in API responses.
* Use Secure, HttpOnly, and appropriate SameSite cookie attributes for cookie-based sessions.
* Apply CSRF protection where required by the authentication design.
* Rate-limit login, password recovery, and other abuse-prone operations.

Never trust client-supplied role names, user IDs, ownership fields, or application statuses without server-side verification.

12. File and document handling

For admissions documents and other sensitive uploads:

* Enforce request and file-size limits.
* Allow only required file types.
* Validate file content rather than trusting extensions or client-provided MIME types.
* Generate storage names on the server.
* Keep private files outside publicly served directories.
* Use authenticated downloads or short-lived signed URLs.
* Scan files where an appropriate malware-scanning service is available.
* Record access to sensitive documents where required.
* Avoid logging document contents or unnecessary personal identifiers.
* Define retention and deletion policies.
* Prevent path traversal and unauthorized file replacement.

Document endpoints are not production-ready until storage, validation, access control, download behavior, and malware-handling procedures have been verified.

13. Error response conventions

Use a consistent JSON error format. For example:

{
  “error”: {
    “code”: “VALIDATION_ERROR”,
    “message”: “The request contains invalid fields.”,
    “requestId”: “example-request-id”
  }
}

The field names and structure must match the actual centralized error handler and OpenAPI schemas.

Recommended status codes

Status	Meaning
200	Successful request
201	Resource created
202	Accepted for asynchronous processing
204	Successful request with no response body
400	Invalid request
401	Authentication required or invalid
403	Permission denied
404	Resource not found
409	Conflict or invalid state transition
413	Request or upload too large
415	Unsupported media type
422	Semantically invalid input, if adopted by the contract
429	Rate limit exceeded
500	Unexpected server error
503	Service temporarily unavailable

Do not expose stack traces, SQL statements, connection strings, internal filesystem paths, or provider credentials in production responses.

14. Health checks and observability

Provide health endpoints that match the actual server implementation.

Recommended separation:

* Liveness: Confirms that the process is running.
* Readiness: Confirms that required dependencies are available.
* Worker health: Reports whether the worker is running and able to claim jobs, where this can be monitored reliably.

Health endpoints must not reveal credentials, secrets, internal topology, or sensitive operational details.

Structured logging

Useful fields include:

* timestamp
* level
* service
* event
* requestId
* durationMs
* statusCode

For worker events, consider a job identifier, job type, attempt number, and processing duration. Avoid logging full request bodies, authorization headers, raw job payloads, or document contents.

Configure alerts for elevated error rates, database connectivity failures, stalled workers, repeated job failures, and resource exhaustion.

15. Testing strategy

Unit tests

Test isolated services and utility functions, including:

* Input validation.
* Application status transitions.
* Retry-delay calculation.
* Notification ownership checks.
* Audit-metadata sanitization.
* Error normalization.

Integration tests

Use a dedicated test database to verify:

* Database transactions and rollbacks.
* Application creation and updates.
* Notification read-state changes.
* Audit-event persistence.
* Worker claiming and retry behavior.
* Route authentication and authorization.
* File upload and download access controls.

Security tests

Include checks for:

* Broken object-level authorization.
* Privilege escalation.
* SQL injection.
* Rate-limit enforcement.
* Token-validation failures.
* Sensitive-data leakage.
* Malformed file uploads.
* Cross-origin policy errors.
* Unauthorized access to administrative operations.

Run tests before merging changes or deploying. Integration tests must not run against production data.

16. Local development

From the repository root:

npm install

Configure the required environment variables and database schema. Start the API using the scripts defined in the root package.json.

For example, if these scripts exist:

npm run dev
npm run worker

Do not assume a dev, start, migrate, or worker script exists until it has been verified.

Recommended verification sequence

1. Install dependencies from the lockfile.
2. Confirm required environment variables are present.
3. Verify database connectivity.
4. Apply the project’s migrations.
5. Run unit tests.
6. Run integration tests against a dedicated test database.
7. Validate api/openapi.yaml.
8. Start the API and worker using their configured scripts.
9. Test health endpoints and representative authenticated requests.

17. Deployment checklist

Before releasing to staging or production:

* [ ]	Confirm the deployed Node.js version is supported.
* [ ]	Install dependencies reproducibly from the lockfile.
* [ ]	Configure environment variables and secrets.
* [ ]	Apply database migrations using the deployment process.
* [ ]	Verify database connectivity, connection limits, and TLS settings.
* [ ]	Validate the OpenAPI specification.
* [ ]	Test authentication and resource-level authorization.
* [ ]	Test rate limiting, validation, and error responses.
* [ ]	Confirm private documents are not publicly accessible.
* [ ]	Configure health and readiness checks.
* [ ]	Deploy the worker as a separate process if required.
* [ ]	Verify job handlers, retry behavior, and idempotency safeguards.
* [ ]	Test graceful shutdown and restart recovery.
* [ ]	Configure logs, alerts, and error monitoring.
* [ ]	Review dependency vulnerabilities and assess remediation.
* [ ]	Back up the database and verify recovery procedures.

18. API change policy

For every endpoint change:

1. Update the route and controller.
2. Update validation and authorization.
3. Update service logic and database migrations if required.
4. Update api/openapi.yaml.
5. Add or update automated tests.
6. Verify success and error response schemas.
7. Review backward compatibility.
8. Document breaking changes.

Avoid silently changing response fields, status codes, pagination behavior, or authentication requirements for existing clients.

19. Troubleshooting

Database connection failure

Check DATABASE_URL, database availability, network access, TLS requirements, credentials, and connection limits. Confirm the API and worker use the intended database.

Worker starts but processes no jobs

Check that pending jobs exist, their available_at timestamps have passed, their statuses are eligible for processing, and the worker is connected to the correct database. Confirm the configured job types have valid handlers.

Jobs repeatedly fail

Inspect sanitized error logs, handler registration, payload validation, external service credentials, and retry limits. Identify the underlying failure before increasing retry limits.

API route returns 404

Verify the route is registered, the HTTP method is correct, and the application mount prefix matches the requested URL. Check for duplicated /api prefixes.

Middleware callback error

Check that imported middleware functions exist and are exported correctly. Express route registration requires valid middleware or handler functions.

OpenAPI endpoint mismatch

Compare api/openapi.yaml with the actual Express router definitions, controllers, validation schemas, and response behavior. Documentation alone does not register endpoints.

Worker repeatedly reprocesses a job

Inspect lease expiration, worker shutdown behavior, heartbeat failures, and handler idempotency. Check whether the external operation succeeded before the worker recorded completion.

20. Maintenance principles

* Keep controllers thin and services focused.
* Use explicit transactions for related database changes.
* Prefer migrations over ad hoc production schema changes.
* Validate all untrusted input at system boundaries.
* Enforce authorization at the resource level.
* Keep API contracts and automated tests synchronized.
* Use idempotent background processing.
* Store secrets outside source control.
* Minimize sensitive-data collection and retention.
* Maintain operational documentation alongside code changes.
* Verify implementation claims against the actual repository.

⸻

Source of truth

The actual Express entry point, route files, middleware, service implementations, database migrations, worker handlers, and root package.json determine the behavior of the deployed API.

This README documents the intended architecture and operational practices. Reconcile it with the actual repository before treating it as an exact inventory of implemented functionality.