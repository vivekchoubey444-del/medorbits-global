MedOrbits API Middleware

File: /api/middlerware/README.md
Project: MedOrbits
Runtime: Node.js 20+
Framework: Express.js
Status: Middleware documentation and integration guide

⸻

1. Overview

The middlerware/ directory contains reusable Express.js middleware responsible for protecting API routes, validating incoming requests, enforcing request limits, and managing errors.

Middleware must be integrated consistently across authentication, applications, documents, payments, user accounts, and administrative endpoints.

Directory structure

api/
└── middlerware/
    ├── authorization.js
    ├── error-handler.js
    ├── rate-limit.js
    ├── validation.js
    └── README.md

Naming compatibility: The directory is intentionally named middlerware to match the requested project structure. Although middleware is the conventional spelling, do not rename this directory without updating every import and deployment reference.

⸻

2. Middleware responsibilities

authorization.js

Purpose: Restrict access to protected resources.

Responsibilities:

* Verify authentication credentials using the project’s established authentication mechanism.
* Reject missing, invalid, expired, or revoked credentials.
* Attach verified user identity and permitted claims to the request.
* Enforce role-based access control for administrative and restricted operations.
* Prevent unauthorized access to another user’s applications or documents.
* Return appropriate 401 Unauthorized or 403 Forbidden responses.

Security requirements:

* Never trust user IDs, roles, or permissions supplied in request bodies.
* Verify credentials cryptographically using the configured authentication mechanism.
* Do not expose tokens, session secrets, or credential contents in logs.
* Apply ownership checks at the resource or service layer where necessary.

error-handler.js

Purpose: Provide consistent API error responses.

Responsibilities:

* Normalize application and validation errors.
* Map known errors to appropriate HTTP status codes.
* Generate a request or correlation ID where supported.
* Log diagnostic information securely on the server.
* Prevent stack traces and internal implementation details from reaching production clients.
* Delegate errors to Express when response headers have already been sent.

The error handler must use Express’s four-argument signature:

(err, req, res, next)

It should be mounted after route registration and any custom not-found handler.

rate-limit.js

Purpose: Reduce abuse and excessive API traffic.

Apply appropriate limits to:

* Authentication and account recovery.
* Application submission and modification.
* Document uploads and downloads.
* Contact forms and support tickets.
* Expensive search or AI-assisted endpoints.
* Administrative and sensitive operations.

Requirements:

* Configure limits according to endpoint sensitivity and expected traffic.
* Return 429 Too Many Requests when a request exceeds its permitted limit.
* Configure a shared store for distributed deployments where required.
* Consider trusted proxy configuration when determining client IP addresses.
* Avoid relying solely on in-memory counters across multiple server instances.

Do not impose one restrictive global limit without considering normal application traffic.

validation.js

Purpose: Validate incoming request data before business logic executes.

Validation should cover:

* Request body fields.
* URL parameters.
* Query parameters.
* Supported content types.
* Field lengths, data types, formats, and allowed values.
* Application identifiers and document metadata.
* Pagination and filtering parameters.
* File size and file type requirements where uploads are supported.

Validation requirements:

* Reject malformed or unexpected input.
* Use explicit allowlists for accepted fields.
* Validate data at the server, regardless of frontend validation.
* Avoid silently accepting invalid values.
* Never treat validation as a substitute for authorization.
* Use the project’s existing schema definitions where possible.

⸻

3. Recommended request lifecycle

Use the following order as a baseline. Adjust it to match existing application initialization, authentication requirements, and route-specific policies.

Incoming Request
       |
       v
Security Headers and CORS
       |
       v
Request ID and Logging
       |
       v
Body Parsing and Size Limits
       |
       v
General Rate Limiting
       |
       v
Route Matching
       |
       v
Authentication / Authorization
       |
       v
Request Validation
       |
       v
Controller and Service
       |
       v
Database / External Services
       |
       v
Consistent API Response

Errors should be passed to the centralized error handler.

Route-specific middleware must be applied where needed. For example, login routes may need a dedicated authentication rate limit, while public health checks may require a different policy.

⸻

4. Integration examples

These examples illustrate the expected integration pattern. Confirm actual exports and function signatures in each implementation before copying imports.

4.1 Application-level configuration

const express = require(‘express’);
const app = express();
app.disable(‘x-powered-by’);
app.use(express.json({
  limit: ‘1mb’,
}));
app.use(express.urlencoded({
  extended: false,
  limit: ‘1mb’,
}));
// Register security, logging, and rate-limiting
// middleware according to the existing server setup.
// Register API routers here.
// Register the not-found handler and error handler last.

Do not add duplicate parsers, security headers, or rate limiters if server.js already configures them.

4.2 Protecting a route

Example only; replace the illustrative exports with the actual exports from authorization.js and validation.js.

router.post(
  ‘/applications’,
  authenticate,
  validateApplication,
  applicationController.create
);

For administrative operations, enforce the required role and resource permissions independently of request validation.

4.3 Centralized error handling

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: ‘NOT_FOUND’,
      message: ‘The requested resource was not found.’,
    },
  });
});
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  const status =
    Number.isInteger(err.statusCode) &&
    err.statusCode >= 400 &&
    err.statusCode <= 599
      ? err.statusCode
      : 500;
  if (status >= 500) {
    // Use the project’s structured logger here.
    // Do not log secrets or sensitive request bodies.
  }
  res.status(status).json({
    success: false,
    error: {
      code: status >= 500
        ? ‘INTERNAL_SERVER_ERROR’
        : ‘REQUEST_ERROR’,
      message: status >= 500
        ? ‘An unexpected server error occurred.’
        : err.message || ‘The request could not be processed.’,
    },
  });
});

Important: This is a reference implementation, not a verified replacement for the existing error handler. Ensure the production implementation maps known error classes, sanitizes client-visible messages, and does not expose arbitrary internal error messages.

⸻

5. API response conventions

Use a consistent response structure across endpoints.

Successful response

{
  “success”: true,
  “data”: {},
  “requestId”: “request-correlation-id”
}

Client error

{
  “success”: false,
  “error”: {
    “code”: “VALIDATION_ERROR”,
    “message”: “One or more fields are invalid.”
  },
  “requestId”: “request-correlation-id”
}

The requestId field is optional if correlation IDs are not implemented. Do not fabricate an ID or expose internal database identifiers unnecessarily.

Recommended HTTP status codes

Status	Meaning
400	Malformed request or invalid input
401	Missing or invalid authentication
403	Insufficient permissions
404	Resource not found
409	Conflicting operation
413	Request or upload too large
415	Unsupported media type
422	Semantically invalid data, if adopted consistently
429	Rate limit exceeded
500	Unexpected internal error
503	Service temporarily unavailable

Choose one consistent policy for validation errors (400 or 422) across the API.

⸻

6. Environment configuration

Middleware must read sensitive configuration from environment variables or the project’s configuration module.

Potential settings include:

NODE_ENV=production
SESSION_SECRET=
JWT_SECRET=
RATE_LIMIT_WINDOW_MS=
RATE_LIMIT_MAX=

These names are illustrative. Use only the variables required by the actual implementation.

Rules:

* Never commit real secrets to version control.
* Never use placeholder or development secrets in production.
* Fail startup when mandatory security configuration is missing.
* Keep environment-specific rate limits configurable.
* Rotate compromised credentials promptly.
* Avoid logging environment variables.

Do not introduce JWT_SECRET if the existing authentication system uses another credential mechanism.

⸻

7. File uploads and document security

Because MedOrbits handles educational applications and official documents, upload-related endpoints require additional controls.

* Authenticate users before accepting private document uploads.
* Check ownership and permissions before retrieving or deleting documents.
* Enforce file-size limits and allowed extensions.
* Inspect actual file content instead of trusting the supplied MIME type.
* Generate server-side storage names instead of trusting filenames.
* Store private documents outside publicly accessible static directories.
* Prevent executable files and path traversal.
* Use malware scanning where available and appropriate.
* Avoid returning storage paths or private URLs to unauthorized users.
* Apply appropriate retention, access logging, and deletion policies.

Do not assume that validation.js alone provides secure file-upload handling.

⸻

8. Testing checklist

Before deployment, test the following scenarios.

Authorization

* [ ]	Missing credentials are rejected.
* [ ]	Invalid and expired credentials are rejected.
* [ ]	Restricted roles cannot access administrative endpoints.
* [ ]	Users cannot access another user’s private application or documents.
* [ ]	Public endpoints remain accessible as intended.

Error handling

* [ ]	Validation errors return consistent responses.
* [ ]	Unknown routes return 404.
* [ ]	Unexpected errors return sanitized 500 responses.
* [ ]	Stack traces and secrets are not exposed in production.
* [ ]	Errors after response headers are sent are delegated correctly.

Rate limiting

* [ ]	Requests within the configured limit succeed.
* [ ]	Excess requests return 429.
* [ ]	Authentication endpoints have suitable limits.
* [ ]	Limits behave correctly across server instances when using a shared store.
* [ ]	Proxy and client-IP handling are configured correctly.

Validation

* [ ]	Missing required fields are rejected.
* [ ]	Invalid types and formats are rejected.
* [ ]	Oversized requests are rejected.
* [ ]	Unexpected fields are handled according to policy.
* [ ]	Malformed JSON produces a controlled client error.
* [ ]	Validation failures do not modify persistent data.

⸻

9. Troubleshooting

Middleware export is undefined

Symptom: Express reports that a route callback is undefined.

Check:

1. The export style in the middleware file.
2. The import or require() statement.
3. The exported property name.
4. Whether a middleware factory requires invocation.
5. Whether a circular dependency is preventing initialization.

Do not fix this by passing an arbitrary object to router.get() or router.post(). Express expects callable route handlers.

Errors are not reaching the error handler

Check that:

* The handler has four arguments.
* Errors are passed to next(err) when required.
* Asynchronous errors are forwarded according to the installed Express version.
* The error handler is registered after the relevant routes.
* No earlier middleware sends a response and then continues the chain.

Rate limiting behaves inconsistently

Check the configured store, proxy trust settings, deployment topology, and the order in which rate-limit middleware is mounted.

Validation blocks legitimate requests

Compare the incoming payload with the API schema and frontend form. Update the schema deliberately rather than bypassing validation.

⸻

10. Maintenance standards

When changing middleware:

1. Preserve existing module export conventions.
2. Keep middleware focused on a single responsibility.
3. Avoid embedding database business logic in generic middleware.
4. Use structured logging and sanitized error responses.
5. Add unit tests for new behavior and regression cases.
6. Update route integration and API documentation together.
7. Review dependencies for security advisories.
8. Verify behavior locally before deploying to Render.
9. Keep authentication, authorization, and resource ownership checks separate.
10. Document any new environment variables and operational requirements.

⸻

11. Related project files

File or directory	Responsibility
api/server.js	Application initialization and middleware registration
api/routes/	API route definitions
api/controllers/	Request handling
api/services/application-service.js	Application business logic
api/services/audit-service.js	Audit event handling
api/services/notification-service.js	Notifications
api/schemas/application.schema.json	Application data schema
api/openapi.yaml	API contract and endpoint documentation
api/worker.js	Background processing

Verify the paths against the actual repository structure before adding imports or references.

⸻

12. Deployment readiness

Before releasing middleware changes to production:

* [ ]	All middleware modules load successfully.
* [ ]	Every route callback is a function.
* [ ]	Authentication and authorization tests pass.
* [ ]	Error responses are sanitized.
* [ ]	Rate limiting is configured for the production topology.
* [ ]	Input and upload limits are enforced.
* [ ]	Required environment variables are configured in Render.
* [ ]	No secrets are committed to GitHub.
* [ ]	Automated tests pass.
* [ ]	Application startup and health checks succeed.

Official references

* Express.js — Using middleware
* Express.js — Error handling
* Express.js — Production security best practices

⸻

End of documentation

This README describes the intended middleware contract and integration practices. It does not certify that the existing middleware implementations already satisfy every requirement; verify their source code and tests before treating the API as production-ready.