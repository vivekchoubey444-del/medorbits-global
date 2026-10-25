
# MedOrbits Integration Guide

**Project:** MedOrbits — Education · Admissions · Careers · Recruitment  
**Website:** https://www.medorbits.in/  
**Document:** `docs/INTEGRATION.md`  
**Status:** Integration reference  
**Runtime:** Node.js 20+  
**Backend:** Express.js with ES modules  
**Database:** PostgreSQL  

—

## 1. Purpose

This document defines how MedOrbits frontend pages, backend API routes, services, database models, JSON resources, authentication, and automated tests should integrate.

The objectives are to:

- Maintain consistent API contracts across frontend and backend.
- Validate user input before processing or persisting it.
- Protect authentication credentials, personal information, and uploaded documents.
- Keep education, admissions, jobs, applications, and official resources maintainable.
- Ensure local development, automated testing, and production deployment use consistent configuration.
- Prevent frontend pages from depending on internal database implementation details.

**Important:** This guide describes the intended integration contract. Confirm each route, environment variable, script, and database table against the implementation before enabling it in production.

—

## 2. Integration Architecture

The recommended request flow is:

```text
Browser / Frontend
        |
        v
HTML Pages and Frontend JavaScript
        |
        v
API Client and Request Validation
        |
        v
HTTPS / Express API
        |
        v
Security Middleware
        |
        v
Authentication and Authorization
        |
        v
Route Handlers / Controllers
        |
        v
Validation Schemas
        |
        v
Application Services
        |
        v
Models / Database Repositories
        |
        v
PostgreSQL
```

Supporting integrations:

```text
Official JSON Resources ——> Resource Service
Job Listings -—————> Job Service
Applications -—————> Application Service
Document Uploads ————> Document Service
Notifications —————> Notification Service
Audit Events -—————> Audit Service
Background Jobs -————> Worker
Automated Tests -————> Test Database
```

### Integration principles

1. Frontend code must not connect directly to PostgreSQL.
2. Controllers should coordinate requests rather than contain complex business logic.
3. Services should enforce business rules and transactional requirements.
4. Database access should use parameterized queries or a correctly configured ORM.
5. Authentication and authorization must be enforced server-side.
6. Sensitive configuration must remain outside public frontend files.
7. API responses must use a consistent JSON structure.
8. Every externally supplied value must be treated as untrusted input.

—

## 3. Repository Integration Map

Use the actual repository structure as the source of truth. The following paths describe the intended responsibilities.

| Path | Responsibility |
|—|—|
| `server.js` | Express application bootstrap and startup |
| `api/routes/` | API endpoint definitions |
| `api/controllers/` | HTTP request and response handling |
| `api/services/` | Business logic and external integrations |
| `api/models/` | Database access and data models |
| `api/schemas/` | Request and response validation schemas |
| `api/middleware/` | Authentication, authorization, rate limiting, and errors |
| `api/openapi.yaml` | API contract documentation |
| `api/worker.js` | Background processing entry point |
| `assets/js/` | Frontend JavaScript and shared API client |
| `assets/data/` | Public, non-sensitive JSON resources |
| `tests/` | Unit, integration, and regression tests |
| `docs/` | Developer and deployment documentation |
| `.github/workflows/` | Continuous integration and deployment workflows |
| `.husky/` | Local Git hooks |

If the existing project uses a different directory name, such as `api/middlerware/`, do not silently create duplicate implementations. Establish one canonical directory, update imports and documentation, and migrate references consistently.

—

## 4. Environment Configuration

Store server-side configuration in environment variables. Use the hosting provider’s secret-management facility in production.

### Example `.env.example`

```dotenv
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
DATABASE_SSL=false

# Authentication
SESSION_SECRET=replace-with-a-long-random-secret
ADMIN_TOKEN=

# Frontend and CORS
APP_BASE_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000

# AI integration — optional
AI_API_KEY=
AI_API_URL=
AI_MODEL=

# File uploads
UPLOAD_MAX_BYTES=10485760

# Logging
LOG_LEVEL=info
```

This file is an example template, not a production credential file.

### Configuration rules

- Commit `.env.example`, never real credentials.
- Add `.env`, private keys, credential files, and local uploads to `.gitignore`.
- Do not use placeholder secrets in production.
- Fail startup when a required production secret is missing or invalid.
- Use separate databases and credentials for development, testing, and production.
- Keep AI credentials exclusively on the server.
- Configure TLS for production database connections when supported and required.
- Parse and validate environment variables at startup.
- Never print secrets, session tokens, full authorization headers, or sensitive document contents in logs.

If `DATABASE_SSL` is supported by the application, verify its exact parsing behavior and production certificate configuration before relying on it.

—

## 5. API Base URL and Frontend Client

Frontend pages should use one shared API client instead of duplicating request logic across individual pages.

For a same-origin deployment, prefer a relative API base path:

```javascript
const API_BASE_URL = “/api”;
```

For separate frontend and backend deployments, configure the public API base URL using the project’s supported frontend configuration mechanism. Do not expose server-only secrets through frontend build variables.

### Example shared API client

File: `assets/js/api-client.js`

```javascript
“use strict”;

const API_BASE_URL = “/api”;

async function apiRequest(path, options = {}) {
  if (typeof path !== “string” || !path.startsWith(“/“)) {
    throw new TypeError(“API path must start with ‘/‘.”);
  }

  if (path.startsWith(“//“) || path.includes(“\\”)) {
    throw new TypeError(“Invalid API path.”);
  }

  const headers = new Headers(options.headers || {});
  const requestOptions = {
    ...options,
    headers,
    credentials: “same-origin”,
  };

  const hasBody =
    requestOptions.body !== undefined &&
    requestOptions.body !== null;

  if (
    hasBody &&
    !(requestOptions.body instanceof FormData) &&
    typeof requestOptions.body !== “string”
  ) {
    headers.set(“Content-Type”, “application/json”);
    requestOptions.body = JSON.stringify(requestOptions.body);
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    requestOptions
  );

  const contentType = response.headers.get(“content-type”) || “”;
  let payload = null;

  if (contentType.includes(“application/json”)) {
    payload = await response.json();
  } else if (response.status !== 204) {
    payload = await response.text();
  }

  if (!response.ok) {
    const error = new Error(
      payload &&
      typeof payload === “object” &&
      typeof payload.message === “string”
        ? payload.message
        : `Request failed with status ${response.status}.`
    );

    error.status = response.status;
    error.code =
      payload &&
      typeof payload === “object” &&
      typeof payload.code === “string”
        ? payload.code
        : “REQUEST_FAILED”;

    throw error;
  }

  return payload;
}

window.MedOrbitsAPI = Object.freeze({
  request: apiRequest,

  get(path, options = {}) {
    return apiRequest(path, {
      ...options,
      method: “GET”,
    });
  },

  post(path, body, options = {}) {
    return apiRequest(path, {
      ...options,
      method: “POST”,
      body,
    });
  },

  patch(path, body, options = {}) {
    return apiRequest(path, {
      ...options,
      method: “PATCH”,
      body,
    });
  },

  delete(path, options = {}) {
    return apiRequest(path, {
      ...options,
      method: “DELETE”,
    });
  },
});
```

### Client integration requirements

- Load the shared client before page-specific scripts.
- Use `textContent` instead of inserting untrusted API values through `innerHTML`.
- Display safe, user-friendly errors.
- Do not assume a successful HTTP status means every optional field exists.
- Handle expired sessions and authorization failures explicitly.
- Add request cancellation or timeout handling where appropriate.
- Do not retry non-idempotent requests automatically unless the server supports idempotency.
- Review the client against the actual authentication strategy before production use.

The example assumes cookie-based, same-origin requests. If MedOrbits uses bearer tokens, cross-origin requests, or a different API contract, adapt the client accordingly. Do not store long-lived authentication tokens in browser local storage by default.

—

## 6. Standard API Response Contract

Use a consistent response format across endpoints.

### Successful response

```json
{
  “success”: true,
  “data”: {
    “id”: “example-id”
  },
  “requestId”: “request-id”
}
```

### Error response

```json
{
  “success”: false,
  “error”: {
    “code”: “VALIDATION_ERROR”,
    “message”: “The submitted information is invalid.”,
    “details”: []
  },
  “requestId”: “request-id”
}
```

These examples describe the recommended contract. Existing endpoints should be migrated deliberately rather than changed without updating their clients and tests.

### HTTP status guidance

| Status | Meaning |
|—|—|
| `200 OK` | Request completed successfully |
| `201 Created` | Resource created |
| `202 Accepted` | Work accepted for asynchronous processing |
| `204 No Content` | Successful response without a body |
| `400 Bad Request` | Malformed request |
| `401 Unauthorized` | Authentication required or invalid |
| `403 Forbidden` | Authenticated user lacks permission |
| `404 Not Found` | Resource not found |
| `409 Conflict` | Duplicate or conflicting operation |
| `413 Content Too Large` | Upload exceeds the allowed size |
| `415 Unsupported Media Type` | Unsupported request content type |
| `422 Unprocessable Content` | Well-formed request fails semantic validation |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected server failure |
| `503 Service Unavailable` | Required service temporarily unavailable |

Never expose stack traces, SQL statements, secrets, or internal filesystem paths in production error responses.

—

## 7. Authentication and Authorization

Authentication determines who the user is. Authorization determines what that user is permitted to do.

### Required integration checks

- Registration validates email, password, and required profile fields.
- Login uses the configured authentication mechanism.
- Passwords are hashed using a modern password-hashing algorithm.
- Session cookies, if used, have appropriate `HttpOnly`, `Secure`, and `SameSite` settings.
- State-changing cookie-authenticated requests have appropriate CSRF protection.
- Logout invalidates the session or refresh token according to the chosen design.
- Password reset tokens are short-lived, single-use, and securely generated.
- Administrative endpoints require explicit server-side role checks.
- Users may access only their own private applications and documents unless another permission is explicitly granted.
- Authorization is checked for every protected resource, not just in the frontend.
- Authentication attempts and sensitive administrative actions are rate-limited and audited.

### Example role model

The application may use roles such as:

- `guest`
- `student`
- `candidate`
- `employer`
- `counsellor`
- `admin`

These names are illustrative. Align the role list with the actual database schema and access-control implementation.

Do not trust a role, user ID, ownership flag, or permission supplied by the browser without server-side verification.

—

## 8. PostgreSQL Integration

The database layer must be configured before routes that depend on persistent storage begin accepting traffic.

### Database requirements

1. Use parameterized queries or an ORM with safe query binding.
2. Use database migrations or a controlled schema-management process.
3. Add appropriate indexes for frequently queried fields.
4. Apply unique constraints for identifiers that must be unique.
5. Use transactions for multi-step operations that must succeed or fail together.
6. Enforce ownership and tenant boundaries in server-side queries.
7. Define connection-pool limits appropriate to the hosting environment.
8. Handle connection failures and graceful shutdown.
9. Use a separate test database for integration tests.
10. Avoid destructive schema changes without a reviewed migration and rollback plan.

### Transaction example

The following is illustrative for a PostgreSQL client that supports `connect()`, `query()`, and `release()`:

```javascript
async function runTransaction(pool, callback) {
  const client = await pool.connect();

  try {
    await client.query(“BEGIN”);

    const result = await callback(client);

    await client.query(“COMMIT”);
    return result;
  } catch (error) {
    try {
      await client.query(“ROLLBACK”);
    } catch {
      // Preserve the original transaction error.
    }

    throw error;
  } finally {
    client.release();
  }
}
```

The caller must supply a trusted, configured connection pool. Do not pass untrusted SQL fragments into the transaction callback.

### Schema changes

- Keep schema changes version-controlled.
- Apply migrations as a deliberate deployment step.
- Make migrations safe for the deployed application version.
- Avoid running destructive database initialization automatically in production.
- Test both successful migrations and recovery from failed migrations.

—

## 9. Input Validation and Middleware

Validate all request bodies, query parameters, route parameters, uploaded files, and external API responses.

Recommended middleware order:

1. Request ID and safe request logging.
2. Security headers.
3. Request-size limits.
4. CORS configuration, where applicable.
5. Cookie parsing or other required request parsing.
6. Rate limiting.
7. Authentication where required.
8. Authorization.
9. Route-specific schema validation.
10. Controller execution.
11. Centralized error handling.

The exact order depends on the Express version and middleware requirements. Ensure preflight requests and health endpoints are handled correctly.

### Validation principles

- Reject unexpected or malformed values.
- Enforce field length and type limits.
- Normalize values where appropriate.
- Use allowlists for enums and permitted formats.
- Validate URLs and external destinations before server-side requests.
- Prevent SQL injection, command injection, path traversal, and unsafe HTML rendering.
- Avoid logging complete form submissions containing personal information.
- Return actionable validation errors without revealing internal implementation details.

Validation schemas in `api/schemas/` should agree with the actual request payloads accepted by controllers and services.

—

## 10. Education and Admissions Integration

MedOrbits education and admissions pages may consume approved public datasets for:

- Courses and qualifications.
- Colleges and universities.
- Admission processes.
- Entrance examinations.
- Fee structures.
- Scholarships.
- Hostels and accommodation.
- Documents and eligibility requirements.
- Career options and recruitment support.
- Frequently asked questions.

### Public JSON integration

Example resource:

`assets/data/courses.json`

```json
{
  “version”: 1,
  “updatedAt”: “2026-01-01”,
  “courses”: [
    {
      “id”: “example-course”,
      “name”: “Example Course”,
      “category”: “education”,
      “active”: true
    }
  ]
}
```

This is a schema illustration, not verified current admissions information.

### Data integrity requirements

- Keep identifiers stable across updates.
- Validate JSON files in CI.
- Use explicit data versions where useful.
- Document field definitions and required properties.
- Distinguish official, verified information from editorial guidance.
- Include source URLs and verification dates for time-sensitive admissions information.
- Do not publish personal applicant records or internal administrative data in public JSON files.
- Provide an appropriate fallback when a resource cannot be loaded.
- Do not imply that an admission, seat, scholarship, or eligibility outcome is guaranteed.

Admissions requirements, fees, dates, and cutoffs must be checked against current official sources before publication.

—

## 11. Official Resources Integration

Official resources may include examination authorities, universities, government portals, counselling authorities, application portals, and published notices.

Recommended resource fields:

```json
{
  “id”: “example-resource”,
  “title”: “Example Official Resource”,
  “category”: “admissions”,
  “url”: “https://example.gov.in/“,
  “sourceName”: “Example Authority”,
  “verifiedAt”: “2026-01-01”,
  “status”: “active”
}
```

The example domain and resource are placeholders.

### Resource publishing rules

- Prefer the authority’s official domain.
- Verify links before publishing them.
- Record the last verification date.
- Clearly label third-party resources.
- Avoid embedding credentials or private access tokens in resource records.
- Validate URLs and permitted protocols.
- Prevent open redirects and unsafe server-side URL fetching.
- Provide a process to disable broken or superseded resources.
- Preserve historical records only when there is a valid business or legal reason.

If an administrator manages resources through a dashboard, validate permissions and audit create, update, and delete operations on the server.

—

## 12. Careers, Jobs, and Recruitment

The career module may integrate:

- Fresher jobs.
- Experienced roles.
- Government job notifications.
- Private-sector jobs.
- Internships.
- Recruitment services.
- Resume and career assistance.
- Employer job submissions.
- Candidate applications.

### Job record requirements

A job record should have a stable identifier, title, organization, location or remote status, employment type, description, eligibility criteria, application method, publication status, and relevant dates.

### Job publication controls

- Validate employer-submitted job information.
- Prevent unauthorized publication or modification.
- Sanitize rich text and links.
- Define job expiration and archival behavior.
- Display source and verification details where appropriate.
- Avoid publishing misleading vacancies or unverified government-job claims.
- Restrict administrative job-management endpoints.
- Audit material changes to published listings.

A public listing must not expose private employer credentials, candidate data, or internal moderation notes.

—

## 13. Application Forms and Document Uploads

Application forms may collect contact information, education history, course preferences, employment details, and supporting documents.

Treat applications and their attachments as sensitive data.

### Application lifecycle

A recommended lifecycle is:

```text
Draft
  |
  v
Submitted
  |
  v
Under Review
  |
  +——> Additional Information Required
  |
  +——> Accepted / Rejected / Closed
```

Use only statuses supported by the actual business process and database schema.

### Upload security requirements

- Allowlist permitted file extensions and MIME types.
- Validate file signatures where feasible; do not trust MIME headers alone.
- Enforce file-size and request-size limits.
- Generate server-side storage names.
- Prevent path traversal and filename-based overwrites.
- Store private documents outside the public web root.
- Apply malware scanning where available and appropriate.
- Restrict downloads using server-side authorization.
- Use short-lived signed URLs only when the storage architecture supports them.
- Apply retention and deletion policies.
- Audit document access and administrative actions.
- Never expose private documents through a predictable public URL.

For large uploads, consider direct-to-object-storage uploads with short-lived authorization and server-side verification.

### Data protection

Collect only information needed for the stated purpose. Define access controls, retention periods, deletion procedures, and incident-response processes for applicant information.

—

## 14. Notifications and Background Workers

Use background processing when a task is slow, retryable, or not required to complete the original HTTP request.

Potential tasks include:

- Application confirmation emails.
- Employer notifications.
- Scheduled job expiration.
- Document-processing workflows.
- Administrative alerts.
- Retryable integrations with external services.

### Worker requirements

- Make jobs idempotent where possible.
- Use bounded retries and exponential backoff.
- Avoid logging personal data or credentials.
- Record failure status and operational metadata.
- Prevent duplicate notifications when jobs are retried.
- Provide a way to inspect and safely reprocess failed jobs.
- Shut down gracefully.
- Keep worker processes separate from request handling when the architecture requires it.

Do not claim that a notification was delivered merely because it was queued.

—

## 15. AI Service Integration

If MedOrbits integrates AI-assisted guidance, resume support, admissions assistance, or career recommendations:

- Keep API credentials on the server.
- Validate and limit user input.
- Apply rate limits and usage controls.
- Avoid sending unnecessary personal or sensitive information to third-party services.
- Explain when generated information may be incomplete or inaccurate.
- Do not present AI output as an official admission decision or guaranteed job outcome.
- Validate model responses before using them in structured workflows.
- Treat external content and model-generated content as untrusted input.
- Use appropriate timeouts, failure handling, and fallback behavior.
- Log operational metadata without recording secrets or unnecessary personal content.

If an AI service is unavailable, return a controlled error or safe fallback rather than exposing upstream response bodies or credentials.

—

## 16. CORS, Cookies, and Transport Security

### CORS

- Use an explicit allowlist of trusted frontend origins.
- Do not reflect arbitrary origins.
- Do not combine credentialed requests with a wildcard origin.
- Restrict allowed methods and headers to what the application needs.
- Test browser preflight requests.

### Cookies and sessions

For cookie-based authentication:

- Set `HttpOnly` for session cookies.
- Set `Secure` in HTTPS production deployments.
- Choose `SameSite` based on the real deployment and authentication flow.
- Configure trusted proxy behavior carefully when hosted behind a reverse proxy.
- Apply CSRF protection to state-changing requests where required.
- Expire and rotate sessions appropriately.

### HTTPS

Use HTTPS for production pages, API traffic, and document downloads. Avoid mixed-content resources. Redirect HTTP to HTTPS at the appropriate infrastructure layer.

—

## 17. Health Checks, Logging, and Observability

Provide health checks appropriate to the deployment architecture.

Recommended distinctions:

- **Liveness:** confirms the process is running.
- **Readiness:** confirms the service can accept requests.
- **Dependency health:** reports the availability of dependencies such as PostgreSQL when appropriate.

Do not expose environment variables, stack traces, database credentials, or internal infrastructure details in public health responses.

### Logging requirements

Logs should include useful operational context such as:

- Timestamp.
- Log level.
- Request or correlation ID.
- Route or operation name.
- Response status.
- Duration.
- Sanitized error code.

Avoid recording:

- Passwords.
- Authentication tokens.
- Session identifiers.
- Full payment information.
- Private document contents.
- Unnecessary personal data.

Configure log retention and access controls based on operational and legal requirements.

—

## 18. API Documentation

Maintain `api/openapi.yaml` as the authoritative API specification if the project uses OpenAPI.

For each endpoint, document:

- HTTP method and path.
- Purpose and access requirements.
- Request parameters and body schema.
- Success response schema.
- Error responses.
- Authentication requirements.
- Pagination and filtering behavior.
- Rate limits where relevant.
- Idempotency behavior for operations that support it.

Update the specification alongside controller, service, and schema changes. Add automated contract checks where practical to detect divergence between documentation and implementation.

—

## 19. Automated Testing

Use isolated test configuration and a dedicated test database.

Recommended coverage:

| Test category | Purpose |
|—|—|
| Unit tests | Verify individual services and validation functions |
| Integration tests | Verify routes, middleware, and database interactions |
| Authentication tests | Verify login, session handling, and access control |
| Authorization tests | Verify ownership and role boundaries |
| Schema tests | Verify JSON resources and request contracts |
| Upload tests | Verify type, size, storage, and download restrictions |
| Security tests | Verify common abuse and input-validation cases |
| End-to-end tests | Verify important user workflows |
| Regression tests | Prevent previously fixed issues from returning |

### Required scenarios

- Valid and invalid requests.
- Missing required fields.
- Malformed JSON.
- Unauthorized and forbidden requests.
- Duplicate submissions.
- Database failures.
- Oversized uploads.
- Unsupported file types.
- Expired sessions.
- Invalid resource identifiers.
- Rate-limit behavior.
- External-service timeouts.
- Transaction rollback.
- Worker retry behavior.

Tests must not use production credentials or modify production data.

—

## 20. Local Development

A typical setup sequence is:

1. Install Node.js 20 or a supported newer version.
2. Install project dependencies with the repository’s documented package manager.
3. Copy `.env.example` to `.env`.
4. Configure a local PostgreSQL database.
5. Apply the project’s documented database migrations.
6. Run the supported development command.
7. Execute the relevant test suites.
8. Verify health endpoints and key user workflows.

Example commands:

```bash
npm ci
npm run
```

Use `npm run` to inspect the scripts actually defined in `package.json`. Run the repository’s documented development, migration, lint, formatting, and test commands only when those scripts exist.

Do not assume that `npm run migrate`, `npm run dev`, or any other command is available until it has been verified in `package.json`.

—

## 21. Continuous Integration and Deployment

The CI pipeline should validate the repository before a change is merged or deployed.

Recommended stages:

1. Install dependencies reproducibly.
2. Check formatting.
3. Run linting.
4. Validate JSON and configuration files.
5. Run unit tests.
6. Run integration tests against an isolated database.
7. Validate API documentation.
8. Run security and dependency checks.
9. Build or package the application.
10. Deploy only after required checks pass.

### Deployment safeguards

- Use protected branches and required CI checks.
- Store secrets in the hosting platform’s secret store.
- Run migrations as a controlled release step.
- Verify health checks after deployment.
- Keep a rollback plan.
- Monitor errors and database health.
- Avoid printing secret environment variables in build logs.
- Pin or constrain dependency versions appropriately.
- Review dependency vulnerabilities before upgrading packages.

Local Git hooks improve feedback speed but are not a security boundary. CI and server-side authorization remain authoritative.

—

## 22. Integration Checklist

### Application setup

- [ ] Confirm the actual repository paths and module format.
- [ ] Verify supported Node.js and package-manager versions.
- [ ] Validate required environment variables at startup.
- [ ] Configure separate development, test, and production databases.
- [ ] Confirm the API base URL and CORS configuration.

### Backend

- [ ] Confirm routes are mounted exactly once.
- [ ] Verify middleware ordering.
- [ ] Validate request bodies, query parameters, and route parameters.
- [ ] Standardize error handling.
- [ ] Enforce authentication and authorization server-side.
- [ ] Verify database transactions and migrations.
- [ ] Confirm health checks and graceful shutdown.

### Frontend

- [ ] Load the shared API client before page-specific scripts.
- [ ] Handle loading, empty, success, and error states.
- [ ] Render untrusted values safely.
- [ ] Avoid embedding secrets in frontend assets.
- [ ] Verify form validation and duplicate-submission behavior.
- [ ] Check mobile layout and accessibility.

### Data and documents

- [ ] Validate public JSON resources.
- [ ] Verify official resource URLs.
- [ ] Confirm document storage is private by default.
- [ ] Restrict file downloads by ownership and permission.
- [ ] Define retention and deletion behavior.
- [ ] Avoid exposing personal information in logs.

### Quality and release

- [ ] Run unit and integration tests.
- [ ] Test authorization boundaries.
- [ ] Validate API documentation.
- [ ] Check dependency security.
- [ ] Confirm CI required checks.
- [ ] Verify deployment health and rollback procedures.

—

## 23. Troubleshooting

### API returns `404 Not Found`

- Verify the frontend base URL.
- Confirm the route is mounted.
- Check the HTTP method and path.
- Confirm any API version prefix.
- Check reverse-proxy routing.

### API returns `401 Unauthorized`

- Verify the authentication mechanism.
- Check session expiry and cookie settings.
- Confirm the browser sends the expected credentials.
- Verify the authentication middleware is mounted correctly.

### API returns `403 Forbidden`

- Confirm the authenticated user’s role and resource ownership.
- Review route-level authorization.
- Do not resolve authorization failures by removing access checks.

### Database connection fails

- Verify `DATABASE_URL`.
- Confirm the database is reachable from the deployed service.
- Check credentials, TLS configuration, network rules, and connection limits.
- Review sanitized database error logs.

### Uploaded files cannot be downloaded

- Confirm the file record exists.
- Verify server-side ownership and access checks.
- Check private storage permissions and generated storage keys.
- Do not make private storage public to bypass authorization failures.

### Frontend receives a CORS error

- Verify the exact origin, including scheme and port.
- Confirm the server’s allowed-origin list.
- Check preflight handling and credential settings.
- Do not use wildcard origins as a blanket fix for credentialed requests.

—

## 24. Change Management

For every integration change:

1. Identify the affected frontend pages, routes, services, schemas, and tests.
2. Update the API contract and documentation.
3. Implement validation and authorization.
4. Add or update automated tests.
5. Review migration and compatibility implications.
6. Run relevant checks locally and in CI.
7. Deploy through the approved release process.
8. Verify the affected workflow after deployment.

Prefer backward-compatible changes where possible. If an API contract must change incompatibly, coordinate frontend and backend releases or introduce an explicit API version.

—

## 25. Final Integration Standard

A MedOrbits integration is ready for release when:

- Its API contract matches the implementation.
- Inputs are validated and permissions are enforced on the server.
- Personal data and uploaded documents are protected.
- Database changes are controlled and recoverable.
- Errors are handled consistently.
- Automated tests cover expected and failure scenarios.
- CI checks pass.
- Deployment and rollback procedures are documented.
- Operational logs provide useful diagnostics without exposing sensitive information.

**Source of truth:** the deployed implementation, validated configuration, API specification, database migrations, and automated tests. This document provides integration guidance and must be updated whenever those contracts change.
