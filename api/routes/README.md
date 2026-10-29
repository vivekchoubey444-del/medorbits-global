MedOrbits API Routes

File: /api/routes/README.md
Runtime: Node.js 20+
Framework: Express.js
Module system: CommonJS

1. Overview

The /api/routes/ directory contains Express routers that expose MedOrbits functionality through maintainable, versionable HTTP endpoints.

Routes are responsible for:

* Defining HTTP methods and endpoint paths.
* Applying authentication and authorization.
* Validating request bodies, query parameters, and path parameters.
* Delegating business operations to service modules.
* Returning consistent JSON responses and HTTP status codes.
* Forwarding unexpected errors to centralized error-handling middleware.
* Enforcing safe handling of sensitive API responses.

Routes must not contain direct database queries or duplicate business logic. Never expose passwords, password hashes, access tokens, session secrets, private storage keys, or internal audit metadata.

2. Directory structure

api/
├── routes/
│   ├── README.md
│   ├── admissions.js
│   ├── documents.js
│   ├── health.js
│   ├── jobs.js
│   ├── support.js
│   └── users.js
├── middleware/
│   ├── authorization.js
│   ├── error-handler.js
│   ├── rate-limit.js
│   └── validation.js
├── schemas/
│   ├── README.md
│   ├── application.schema.json
│   └── job.schema.json
├── services/
│   ├── application-service.js
│   ├── audit-service.js
│   └── notification-service.js
├── openapi.yaml
├── worker.js
└── README.md

This is a reference structure, not a guarantee that every file exists. Preserve existing repository files and use the established middleware directory name unless the project is deliberately migrated.

3. Router conventions

Every route module should use strict mode, create an Express router, and export that router using CommonJS.

“use strict”;
const express = require(“express”);
const router = express.Router();
// Register routes here.
module.exports = router;

Use the project’s existing middleware and service interfaces. Do not invent alternate authentication implementations or assume a service method exists without checking its implementation.

4. Route responsibilities

File	Responsibility
health.js	Liveness, readiness, and startup checks
users.js	User profiles and authorized administrator operations
admissions.js	Admission applications, status, submission, and review
documents.js	Document metadata, upload initiation, downloads, and review
jobs.js	Published listings, employer management, and moderation
support.js	Support tickets, replies, assignment, and resolution

Each router should remain focused on HTTP handling, validation, permission checks, and service orchestration.

5. Mounting routes

Register routers in the main application bootstrap, typically server.js.

“use strict”;
const express = require(“express”);
const app = express();
app.use(express.json({ limit: “1mb” }));
const healthRoutes = require(“./api/routes/health”);
const userRoutes = require(“./api/routes/users”);
const admissionRoutes = require(“./api/routes/admissions”);
const documentRoutes = require(“./api/routes/documents”);
const jobRoutes = require(“./api/routes/jobs”);
const supportRoutes = require(“./api/routes/support”);
app.use(“/api/health”, healthRoutes);
app.use(“/api/users”, userRoutes);
app.use(“/api/admissions”, admissionRoutes);
app.use(“/api/documents”, documentRoutes);
app.use(“/api/jobs”, jobRoutes);
app.use(“/api/support”, supportRoutes);
// Register centralized error handling after route registration.

Before deployment:

* Confirm every imported module exists.
* Confirm each router exports an Express router.
* Verify service and middleware exports.
* Configure CORS, security headers, rate limits, and body-size limits centrally.
* Register error handling after the routes.
* Avoid unintentionally mounting a router more than once.

6. Request-processing order

A typical authenticated endpoint follows this sequence:

1. Receive the request.
2. Authenticate the caller.
3. Authorize the requested operation.
4. Validate parameters, query values, and request body.
5. Invoke the service layer.
6. Return a documented response.
7. Forward unexpected errors to centralized error handling.

Example:

router.patch(
  “/me”,
  authenticate,
  authorize(“users:update”),
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await userService.updateUserProfile({
      user: req.user,
      payload: req.body
    });
    return res.status(200).json({
      success: true,
      data: { user }
    });
  })
);

Adapt the example to the actual middleware and service signatures. Do not copy it into production without confirming those contracts.

7. Authentication and authorization

Use the existing authorization middleware.

router.get(
  “/“,
  authenticate,
  authorize(“users:read”),
  handler
);

Suggested permission conventions:

Permission	Intended capability
users:read	Read authorized user records
users:update	Update permitted user information
users:delete	Perform authorized deactivation or deletion
admissions:read	Read authorized admission records
admissions:create	Create admission applications
documents:read	Read authorized document metadata
documents:create	Initiate document uploads
documents:download	Request authorized document downloads
documents:review	Review submitted documents
jobs:read	Read published job listings
jobs:create	Create job listings
support:create	Create support tickets
support:manage	Manage authorized support tickets

These names are conventions, not proof that permissions are configured. Verify the permission map in the actual authorization middleware.

Access-control requirements

* Enforce resource ownership and tenant boundaries in the service layer.
* Apply least-privilege permissions to administrative operations.
* Never trust roles, permissions, or user IDs supplied by request bodies.
* Prevent users from escalating their own privileges through profile updates.
* Protect sensitive administrative actions with authorization and audit logging.
* Ensure an inaccessible resource does not leak information through error messages.

8. Request validation

Validate all untrusted input before invoking services.

Use the existing validation middleware and supported JSON Schema dialect.

const createResourceSchema = {
  $schema: “https://json-schema.org/draft/2020-12/schema”,
  type: “object”,
  required: [“title”],
  properties: {
    title: {
      type: “string”,
      minLength: 1,
      maxLength: 200
    }
  },
  additionalProperties: false
};

Validate:

* Path identifiers and resource references.
* Pagination, sorting, and filtering parameters.
* Required request fields and allowed properties.
* String lengths, numeric bounds, enumerations, and formats.
* File metadata and upload constraints.

The schema alone does not validate a request. Confirm that the configured middleware actually executes it using a compatible validator.

For uploaded files, verify actual size, content type, file signature, storage ownership, and malware status as appropriate. A filename or browser-supplied MIME type is not sufficient proof of file safety.

9. Service-layer integration

Routes should delegate business operations to /api/services/.

Example:

const userService = require(“../services/user-service”);
router.get(
  “/:userId”,
  authenticate,
  authorize(“users:read”),
  validateParams(userIdSchema),
  asyncHandler(async (req, res) => {
    const user = await userService.getUserById({
      requester: req.user,
      userId: req.params.userId
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: “USER_NOT_FOUND”,
          message: “User not found.”
        }
      });
    }
    return res.status(200).json({
      success: true,
      data: { user }
    });
  })
);

The method signature is illustrative. Match the implementation to the actual service contract.

The service layer owns:

* Database access and transactions.
* Domain rules and state transitions.
* Ownership and tenant-scope checks.
* Audit events and notification dispatch.
* Idempotency for operations that require it.
* Safe serialization of returned records.
* Private file access and signed URL generation.

Do not assume a service exists simply because a route imports it.

10. Response conventions

Successful response

{
  “success”: true,
  “data”: {
    “id”: “resource_123”
  }
}

Error response

{
  “success”: false,
  “error”: {
    “code”: “VALIDATION_ERROR”,
    “message”: “The request contains invalid fields.”
  }
}

Paginated response

{
  “success”: true,
  “data”: {
    “items”: [],
    “pagination”: {
      “page”: 1,
      “limit”: 20,
      “total”: 0,
      “totalPages”: 0
    }
  }
}

Use a consistent response envelope across endpoints. Do not expose stack traces, SQL errors, environment variables, signing secrets, or internal exception details.

11. HTTP status codes

Status	Intended use
200 OK	Successful retrieval or update
201 Created	Resource created
202 Accepted	Work accepted for asynchronous processing
204 No Content	Successful operation without a response body
400 Bad Request	Malformed or invalid request
401 Unauthorized	Missing or invalid authentication
403 Forbidden	Authenticated caller lacks permission
404 Not Found	Resource does not exist or is not accessible
409 Conflict	Duplicate resource or conflicting state
413 Content Too Large	Request exceeds configured size limits
415 Unsupported Media Type	Unsupported request or file type
422 Unprocessable Content	Request is syntactically valid but fails domain rules
429 Too Many Requests	Rate limit exceeded
500 Internal Server Error	Unexpected server failure
503 Service Unavailable	Required dependency is unavailable

Apply status codes consistently with the documented API contract.

12. Centralized error handling

Use:

/api/middleware/error-handler.js

The centralized handler should:

* Normalize known application errors.
* Preserve valid HTTP status codes and safe error codes.
* Avoid leaking internal exception details in production.
* Log unexpected failures with correlation or request IDs.
* Return the standard JSON error envelope.
* Avoid attempting a second response after headers have been sent.
* Handle malformed JSON, request-size violations, and unexpected errors consistently.

Route handlers should forward errors through next(error) or a compatible asynchronous wrapper. Confirm the behavior against the installed Express version.

13. Security requirements

Every route and its service integration must follow these principles:

* Authenticate private endpoints.
* Authorize each protected operation independently.
* Validate all untrusted input.
* Use parameterized database queries in services.
* Apply rate limits to authentication, upload, and abuse-prone endpoints.
* Enforce request and upload size limits.
* Use structured logging with sensitive-field redaction.
* Enforce ownership checks for records and files.
* Generate short-lived, scoped signed URLs for private documents.
* Keep credentials and signing secrets in environment variables.
* Avoid logging passwords, tokens, document contents, or unnecessary personal data.
* Require HTTPS in deployed environments.
* Configure explicit CORS allowlists where appropriate.
* Audit sensitive administrative actions.
* Define retention and recovery policies before enabling permanent deletion.

Sensitive responses should use appropriate cache-control headers, particularly for private documents, personal information, and signed download URLs.

14. Pagination and filtering

Collection endpoints should use bounded pagination.

page=1
limit=20
maximum limit=100

Example:

GET /api/users?page=1&limit=20&status=active

Requirements:

* Reject invalid pagination values.
* Enforce the maximum page size.
* Allowlist sortable fields and sort directions.
* Parameterize search and filtering operations.
* Avoid unlimited collection responses.
* Define whether totals count all matching records or only accessible records.
* Document pagination semantics in /api/openapi.yaml.

Remember that URL query parameters are normally strings and should be validated accordingly.

15. Route ordering

Declare fixed paths before parameterized paths whenever they could conflict.

router.get(“/me”, authenticate, getCurrentUser);
router.get(“/slug/:slug”, getBySlug);
router.get(“/:userId”, authenticate, getUserById);

Avoid ambiguous wildcard routes and unsupported path patterns. Check route syntax against the installed Express version.

16. OpenAPI documentation

Maintain:

/api/openapi.yaml

Document every supported endpoint with:

* HTTP method and path.
* Purpose and access requirements.
* Authentication scheme and required permissions.
* Path, query, and body schemas.
* Success response schemas.
* Expected error responses.
* Pagination behavior.
* Upload constraints and file-access rules.
* Idempotency behavior where applicable.

Keep the specification synchronized with actual router behavior. Do not document an endpoint as operational until it is implemented and tested.

17. Testing requirements

Use the repository’s configured test runner and isolated test data or mocked services.

Minimum coverage:

* Successful requests.
* Invalid body, query, and path parameters.
* Missing, invalid, and expired authentication.
* Insufficient permissions.
* Attempts to access another user’s private resources.
* Missing resources and conflicting state transitions.
* Service failures and unexpected exceptions.
* Pagination and filtering limits.
* Sensitive-field redaction.
* Rate-limit behavior.
* Upload validation and download authorization.
* Correct HTTP status codes and response envelopes.

Never run destructive integration tests against production data.

18. Pre-deployment checklist

* [ ]	All imported routers, middleware, and services exist.
* [ ]	Each router exports an Express router.
* [ ]	Middleware imports use the correct repository paths.
* [ ]	Service methods and signatures match.
* [ ]	Permission names are configured and enforced.
* [ ]	Request validation executes successfully.
* [ ]	Ownership and tenant boundaries are enforced.
* [ ]	Centralized error handling is registered after routes.
* [ ]	Sensitive fields are removed from responses and logs.
* [ ]	OpenAPI documentation matches the implementation.
* [ ]	Tests cover success, validation, and authorization failures.
* [ ]	Environment variables and secrets are configured securely.
* [ ]	Health endpoints do not expose infrastructure secrets.
* [ ]	Upload and download controls are verified.
* [ ]	Production data is protected from destructive tests.

19. Maintenance workflow

When adding or changing an endpoint:

1. Update the router.
2. Implement or update its service method.
3. Update schemas and permission checks.
4. Update /api/openapi.yaml.
5. Add or update tests.
6. Verify the router mounts successfully.
7. Run the project’s validation and test commands.
8. Review the Git diff and confirm no unrelated files changed.
9. Deploy only after required checks pass.

20. Repository integration note

This README defines the intended MedOrbits API route architecture. It does not guarantee that listed services, permission mappings, endpoints, schemas, or tests already exist. Verify each dependency against the actual repository before deployment.