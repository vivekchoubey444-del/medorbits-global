MedOrbits API — Developer Documentation

Project: MedOrbits
Directory: /api
Runtime: Node.js 20+
Architecture: REST API, service-oriented backend, PostgreSQL, background jobs
API specification: api/openapi.yaml

⸻

1. Overview

The MedOrbits API provides backend functionality for education, medical admissions, student applications, notifications, document processing, authentication, and administrative operations.

The API is organized into separate layers to keep routing, validation, business logic, persistence, and background processing independently maintainable.

Core objectives

* Consistent REST API responses and HTTP status codes.
* Centralized request validation and error handling.
* Secure authentication and authorization.
* PostgreSQL-backed data persistence.
* Auditable administrative and application workflows.
* Asynchronous processing for time-consuming operations.
* OpenAPI documentation for integration and testing.
* Configurable deployment for development, staging, and production.

2. Directory structure

The following is a recommended structure. Retain existing project files and adjust paths to match the actual repository.

api/
├── README.md
├── openapi.yaml
├── worker.js
│
├── config/
│   ├── database.js
│   ├── environment.js
│   └── security.js
│
├── controllers/
│   ├── auth.controller.js
│   ├── application.controller.js
│   ├── notification.controller.js
│   ├── document.controller.js
│   └── admin.controller.js
│
├── middleware/
│   ├── auth.js
│   ├── error-handler.js
│   ├── rate-limit.js
│   ├── request-id.js
│   └── validation.js
│
├── routes/
│   ├── auth.routes.js
│   ├── application.routes.js
│   ├── notification.routes.js
│   ├── document.routes.js
│   └── admin.routes.js
│
├── services/
│   ├── application-service.js
│   ├── audit-service.js
│   ├── notification-service.js
│   └── README.md
│
├── validators/
│   ├── auth.validator.js
│   ├── application.validator.js
│   └── document.validator.js
│
├── jobs/
│   └── README.md
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── security/
│
└── migrations/
    └── README.md

Important: This is a reference layout, not a claim that every listed file already exists. Keep the filenames and module paths consistent with the actual codebase.

3. Technology stack

Component	Purpose
Node.js 20+	JavaScript runtime
Express	HTTP routing and middleware
PostgreSQL	Relational data storage
pg	PostgreSQL connection pooling
OpenAPI 3.1	API contract and documentation
Background worker	Asynchronous job execution
Automated tests	Regression and security verification

Use the versions declared in the root package.json and lockfile as the source of truth.

4. API base URL

Configure the base URL according to the deployment environment.

Environment	Example
Local development	http://localhost:3000/api
Staging	https://staging.example.com/api
Production	https://api.example.com/api

The production hostnames above are examples. Replace them with the actual configured domains.

The Express application should mount API routes consistently, for example:

app.use(‘/api/auth’, authRoutes);
app.use(‘/api/applications’, applicationRoutes);
app.use(‘/api/notifications’, notificationRoutes);

Only mount routes that exist and export valid Express routers.

5. API documentation

The OpenAPI specification is maintained at:

api/openapi.yaml

Use it as the API contract for documenting endpoints, request bodies, response schemas, authentication, and error formats.

Before publishing the specification:

1. Verify every documented endpoint against the Express route definitions.
2. Confirm HTTP methods and parameter names.
3. Match request and response schemas to the actual controllers.
4. Confirm authentication requirements for each endpoint.
5. Remove placeholder hostnames and examples from production documentation.
6. Test the specification with an OpenAPI validator.

The specification documents intended API behavior; it does not automatically create Express routes.

6. Environment configuration

Configure secrets through deployment environment variables or a secret manager. Never commit real credentials.

Core variables

Variable	Required	Purpose
NODE_ENV	Recommended	Runtime environment
PORT	Deployment-dependent	HTTP server port
DATABASE_URL	Yes for PostgreSQL	Database connection string
SESSION_SECRET	If sessions are used	Signs session identifiers
JWT_SECRET	If symmetric JWT signing is used	Signs and verifies JWTs
JWT_PUBLIC_KEY	If asymmetric JWT verification is used	Verifies signed tokens
ADMIN_TOKEN	Only for a specifically designed token-based admin integration	Restricted administrative authentication
AI_API_KEY	If AI integration is enabled	External AI service authentication
AI_API_URL	If AI integration is enabled	AI provider endpoint
AI_MODEL	If AI integration is enabled	Configured AI model
DATABASE_SSL	Optional	Enables the worker’s TLS configuration when set to true
WORKER_CONCURRENCY	Optional	Maximum configured worker concurrency
WORKER_POLL_INTERVAL_MS	Optional	Background-job polling interval
WORKER_MAX_ATTEMPTS	Optional	Maximum attempts for a job
WORKER_RETRY_BASE_MS	Optional	Initial retry backoff
WORKER_STALE_JOB_MS	Optional	Processing lease timeout
WORKER_SHUTDOWN_TIMEOUT_MS	Optional	Worker shutdown wait limit

Use one consistent authentication strategy. Do not assume JWT_SECRET, JWT_PUBLIC_KEY, or ADMIN_TOKEN is active merely because it exists in the environment.

Example local configuration

Create a local .env file only if the application loads environment variables from it:

NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
WORKER_CONCURRENCY=3
WORKER_POLL_INTERVAL_MS=2000
WORKER_MAX_ATTEMPTS=5
WORKER_RETRY_BASE_MS=1000
WORKER_STALE_JOB_MS=300000
WORKER_SHUTDOWN_TIMEOUT_MS=30000

Replace the database placeholders with local credentials. Do not use production credentials in development.

7. Database integration

Connection management

Use a shared PostgreSQL connection pool rather than creating a new pool for each request.

Recommended practices:

* Parameterize all SQL queries.
* Keep connection limits appropriate for the deployment.
* Release checked-out clients in finally blocks.
* Use transactions for operations that modify multiple related records.
* Apply schema changes through version-controlled migrations.
* Enable TLS when required by the database provider.
* Monitor connection exhaustion and query latency.

Example:

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

Keep this module at the path expected by the application. If a shared pool already exists, reuse it instead of creating a duplicate.

Database objects

The current service design may use the following tables, subject to the actual migrations:

* applications
* application_status_history
* audit_logs
* notifications
* worker_jobs

Before deployment, verify the columns, indexes, constraints, foreign keys, and data types required by every service.

Do not assume that a service’s SQL automatically creates every table it needs. For example, the background worker’s schema initialization creates worker_jobs, but it does not create the application’s other tables.

8. Middleware responsibilities

Middleware should run in a predictable order.

1. Request ID and structured request logging.
2. Security headers and CORS policy.
3. Request body parsing with appropriate size limits.
4. Rate limiting.
5. Authentication.
6. Role-based authorization.
7. Request validation.
8. Route handler.
9. Centralized error handling.

Validation middleware

middleware/validation.js should validate incoming parameters, query strings, and request bodies before business logic executes.

Validation requirements:

* Reject malformed identifiers.
* Enforce field types, lengths, and permitted values.
* Reject unexpected fields where strict schemas are required.
* Normalize input only where normalization is appropriate.
* Avoid logging passwords, tokens, uploaded documents, or sensitive personal data.
* Return a consistent validation-error response.

Validation does not replace authorization. A valid user ID supplied by a client must not grant access to another user’s records.

9. Service layer

Business logic belongs in services rather than being duplicated across controllers.

Application service

Responsibilities may include:

* Creating and retrieving applications.
* Updating editable drafts.
* Enforcing ownership.
* Validating allowed status transitions.
* Recording status history.
* Coordinating database transactions.

Audit service

Responsibilities may include:

* Recording security-relevant actions.
* Recording application status changes.
* Capturing actor, action, resource, timestamp, and outcome.
* Restricting audit-log access to authorized personnel.
* Redacting sensitive metadata.

Audit logs should not store passwords, session cookies, bearer tokens, full payment credentials, or unnecessary document contents.

Notification service

Responsibilities may include:

* Creating notifications.
* Listing notifications for the authenticated user.
* Counting unread notifications.
* Marking individual notifications read or unread.
* Supporting bulk operations with appropriate ownership checks.

Always derive the user’s identity from the authenticated request context, not from an untrusted request body.

10. Background worker

Worker entry point:

api/worker.js

The worker is intended for asynchronous operations that should not block HTTP responses.

Potential job types include:

* email.send
* notification.create
* application.process
* document.process
* webhook.deliver

Only enable job types with real, tested handlers. A registered type without an implementation must not be treated as successful.

Worker behavior

* Claims jobs using PostgreSQL row locking.
* Supports multiple worker processes using FOR UPDATE SKIP LOCKED.
* Retries failed jobs with exponential backoff and jitter.
* Recovers jobs whose processing lease has expired.
* Handles shutdown signals.
* Emits structured job lifecycle logs.

Run the worker

Add a script to the root package.json if one does not already exist:

{
  “scripts”: {
    “worker”: “node api/worker.js”
  }
}

Then run:

npm run worker

Run the worker as a separate background process in deployment.

Reliability note: Background handlers must be idempotent. A process can perform an external action and crash before marking the job complete. A retry could otherwise repeat the action. Use provider idempotency keys, unique operation records, or equivalent safeguards.

11. Authentication and authorization

Implement authentication centrally and apply role-based access controls to restricted operations.

Security requirements:

* Hash passwords using a modern password-hashing algorithm.
* Use short-lived access tokens or secure sessions.
* Verify token signature, issuer, audience, and expiration as applicable.
* Enforce resource ownership in database operations.
* Apply authorization checks to administrative routes.
* Rotate and revoke credentials where supported.
* Never expose secrets in API responses or logs.
* Use secure, HTTP-only cookies when cookie-based sessions are used.
* Configure CSRF protection where applicable to the authentication design.

Do not trust client-supplied role names, user IDs, ownership fields, or application statuses without server-side authorization.

12. File and document handling

For admissions and official documents:

* Enforce file size limits.
* Allow only necessary file types.
* Validate content rather than trusting extensions or MIME headers alone.
* Generate storage names server-side.
* Keep private documents outside publicly served directories.
* Use authenticated downloads or short-lived signed URLs.
* Scan uploads where an appropriate scanning service is available.
* Record access to sensitive documents.
* Avoid logging document content or personal identifiers.
* Apply retention and deletion policies.

Document upload routes should not be considered production-ready until storage, access control, validation, and malware-handling behavior have been verified.

13. Error response conventions

Use a consistent JSON error format. The following is an example contract:

{
  “error”: {
    “code”: “VALIDATION_ERROR”,
    “message”: “The request contains invalid fields.”,
    “requestId”: “example-request-id”
  }
}

Recommended HTTP status codes:

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
422	Semantically invalid input, if used by the API contract
429	Rate limit exceeded
500	Unexpected server error
503	Service temporarily unavailable

Do not expose stack traces, SQL statements, connection strings, internal filesystem paths, or provider credentials in production responses.

14. Health checks and observability

Provide health endpoints consistent with the actual server implementation.

Recommended separation:

* Liveness: confirms that the process is running.
* Readiness: confirms that required dependencies are available.
* Worker health: reports whether the background worker is active and able to claim jobs.

A health endpoint should not reveal database credentials, secrets, internal topology, or sensitive operational details.

Use structured logs with fields such as:

* timestamp
* level
* requestId
* service
* event
* durationMs
* statusCode

Avoid logging full request bodies by default.

15. Testing strategy

Organize tests by scope.

Unit tests

Test services and utility functions in isolation:

* Input validation.
* Application status transitions.
* Retry delay calculation.
* Notification ownership checks.
* Audit metadata sanitization.
* Error normalization.

Integration tests

Use a dedicated test database to verify:

* Database transactions and rollbacks.
* Application creation and updates.
* Notification read-state changes.
* Audit event persistence.
* Worker claiming and retry behavior.
* Route authentication and authorization.

Security tests

Include checks for:

* Broken object-level authorization.
* Privilege escalation.
* SQL injection.
* Rate-limit enforcement.
* Token validation failures.
* Sensitive-data leakage.
* Malformed file uploads.
* Cross-origin policy errors.

Run tests before merging changes or deploying.

16. Local development

From the repository root:

npm install

Set up the required environment variables and database schema, then start the API using the project’s configured start script.

For example, if the root package.json defines these scripts:

npm run dev
npm run worker

Do not assume a dev script exists until it has been verified in package.json.

17. Deployment checklist

Before releasing to staging or production:

* [ ]	Confirm the Node.js runtime matches the supported version.
* [ ]	Install dependencies from the lockfile.
* [ ]	Configure environment variables and secrets.
* [ ]	Apply database migrations.
* [ ]	Verify database connectivity and TLS settings.
* [ ]	Validate the OpenAPI specification.
* [ ]	Test authentication and authorization.
* [ ]	Test rate limiting and input validation.
* [ ]	Confirm private files are not publicly accessible.
* [ ]	Configure the API health and readiness checks.
* [ ]	Configure the worker as a separate process.
* [ ]	Verify worker handlers and retry safety.
* [ ]	Configure logging, alerts, and error monitoring.
* [ ]	Test graceful shutdown and restart recovery.
* [ ]	Review dependency vulnerabilities.
* [ ]	Back up the database and verify recovery procedures.

18. API change policy

For every endpoint change:

1. Update the route and controller.
2. Update validation and authorization.
3. Update the service layer and database migrations if needed.
4. Update api/openapi.yaml.
5. Add or update automated tests.
6. Verify success and error response schemas.
7. Document breaking changes.

Avoid silently changing response fields, status codes, or authentication requirements for existing clients.

19. Troubleshooting

Database connection failure

Check DATABASE_URL, database availability, network access, TLS requirements, and connection limits.

Worker starts but processes no jobs

Check that pending jobs exist, their available_at timestamps have passed, their statuses are valid, and the worker is connected to the intended database.

Jobs repeatedly fail

Inspect sanitized error logs, handler registration, payload validation, external service credentials, and retry limits. Do not increase retry limits without identifying the underlying failure.

API route returns 404

Confirm the route is registered, the HTTP method is correct, and the application’s mount prefix matches the request URL.

Middleware callback error

Check that imported middleware functions exist and are exported correctly. Express route registration requires valid middleware or handler functions.

OpenAPI endpoint mismatch

Compare api/openapi.yaml with the actual Express router definitions and controller behavior. The documentation alone does not register endpoints.

20. Maintenance principles

* Keep controllers thin and services focused.
* Use explicit database transactions for multi-record changes.
* Prefer migrations over ad hoc production schema changes.
* Validate at system boundaries.
* Enforce authorization at the resource level.
* Keep API contracts and automated tests synchronized.
* Use idempotent background processing.
* Store secrets outside source control.
* Minimize sensitive data collection and retention.
* Document operational changes alongside code changes.

⸻

Source of truth: The actual Express entry point, route files, service implementations, database migrations, and root package.json determine the behavior of the deployed API. This README describes the intended architecture and must be reconciled with those files before being treated as an exact inventory of implemented features.