
# MedOrbits API Routes

**Directory:** `/api/routes/`  
**Runtime:** Node.js 20+  
**Framework:** Express.js  
**Purpose:** HTTP routing, request validation, authentication, authorization, and service orchestration.

—

## 1. Overview

The routes directory contains Express routers that expose MedOrbits application functionality through versionable, maintainable API endpoints.

Route handlers should:

- Define HTTP methods and endpoint paths.
- Apply authentication and authorization where required.
- Validate request bodies, query parameters, and path parameters.
- Delegate business logic and database operations to service modules.
- Return consistent JSON responses.
- Forward errors to the centralized error-handling middleware.
- Avoid direct database queries and business logic inside route handlers.

Routes must not expose secrets, password hashes, session tokens, internal audit metadata, or other sensitive fields.

—

## 2. Directory Structure

```text
api/
├── routes/
│   ├── README.md
│   ├── admissions.js
│   ├── documents.js
│   ├── health.js
│   ├── jobs.js
│   ├── support.js
│   └── users.js
├── middlerware/
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
```

> This is a reference structure. Keep existing project files and add missing files only when needed. The directory name `middlerware` follows the current project path convention.

—

## 3. Route Responsibilities

| File | Responsibility |
|—|—|
| `health.js` | Liveness, readiness, and startup health checks |
| `users.js` | User profiles and administrator user management |
| `admissions.js` | Admission applications and application status |
| `documents.js` | Document metadata, uploads, downloads, and reviews |
| `jobs.js` | Job listings, job management, and moderation |
| `support.js` | Support tickets, replies, assignment, and resolution |

Each router should export an Express router using CommonJS:

```javascript
“use strict”;

const express = require(“express”);
const router = express.Router();

module.exports = router;
```

—

## 4. Mounting Routes

Register routers in the main application bootstrap, typically `server.js`.

```javascript
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
```

**Integration requirements:**

- Verify every imported file exists.
- Confirm each router exports an Express router.
- Confirm imported service methods and middleware exports exist.
- Register centralized error handling after route registration.
- Configure CORS, security headers, rate limits, and request-size limits centrally.
- Avoid mounting the same router more than once unintentionally.

—

## 5. Request Processing

A typical authenticated route should follow this order:

1. Receive the HTTP request.
2. Apply authentication when required.
3. Check the caller’s permissions.
4. Validate path, query, and body data.
5. Invoke the relevant service.
6. Return the appropriate HTTP status and JSON response.
7. Forward unexpected errors to centralized error handling.

Example:

```javascript
router.patch(
  “/me”,
  authenticate,
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await userService.updateUserProfile(
      req.user.id,
      req.body
    );

    res.status(200).json({
      success: true,
      data: { user },
    });
  })
);
```

Adapt the example to the actual middleware and service signatures in the project.

—

## 6. Authentication and Authorization

Use the project’s authorization middleware rather than implementing authentication independently in every route.

Example:

```javascript
router.get(
  “/“,
  authenticate,
  authorize(“users:read”),
  handler
);
```

Recommended permission conventions:

| Permission | Intended capability |
|—|—|
| `users:read` | Read user records |
| `users:update` | Update authorized user records |
| `users:delete` | Deactivate or delete user records |
| `admissions:read` | Read authorized admission records |
| `admissions:create` | Create admission applications |
| `documents:read` | Read authorized document metadata |
| `documents:upload` | Initiate authorized document uploads |
| `jobs:read` | Read published job listings |
| `jobs:create` | Create job listings |
| `support:create` | Create support tickets |
| `support:manage` | Manage support tickets |

These are suggested permission names, not proof that the permissions are configured. Define and enforce them in the actual authorization layer.

### Access control requirements

- Enforce ownership checks for user-specific resources.
- Apply least-privilege access to administrative operations.
- Do not trust user IDs, roles, or permissions supplied in request bodies.
- Prevent users from changing their own roles through profile endpoints.
- Protect administrative routes against privilege escalation.
- Record sensitive administrative actions in the audit service.

—

## 7. Request Validation

Validate all untrusted input before invoking service methods.

Use the existing validation middleware and JSON Schemas where supported.

Validate:

- Path parameters, including resource identifiers.
- Query parameters, including pagination and filtering.
- Request bodies, including required fields and allowed properties.
- String lengths, numeric ranges, enumerations, and formats.
- File metadata and upload constraints.

Example:

```javascript
const createResourceSchema = {
  $schema: “https://json-schema.org/draft/2020-12/schema”,
  type: “object”,
  required: [“title”],
  properties: {
    title: {
      type: “string”,
      minLength: 1,
      maxLength: 200,
    },
  },
  additionalProperties: false,
};
```

The schema alone does not validate a request. Ensure the configured validation middleware actually executes the schema using a compatible JSON Schema validator.

For uploaded files, perform server-side size, content-type, file-signature, and malware checks. Never rely solely on a filename or browser-supplied MIME type.

—

## 8. Service Layer Integration

Route handlers should delegate business operations to `/api/services/`.

Example:

```javascript
const userService = require(“../services/user-service”);

router.get(
  “/:userId”,
  authenticate,
  authorize(“users:read”),
  asyncHandler(async (req, res) => {
    const user = await userService.getUserById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: “USER_NOT_FOUND”,
          message: “User not found.”,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: { user },
    });
  })
);
```

The service layer should own:

- Database access and transactions.
- Business rules and state transitions.
- Resource ownership and domain-level checks.
- Audit events.
- Notification dispatch.
- Idempotency where required.
- Safe serialization of returned records.

Service names and method signatures must match the actual implementations. Do not assume a referenced service exists simply because a route imports it.

—

## 9. Response Format

Use a consistent response structure across endpoints.

### Successful response

```json
{
  “success”: true,
  “data”: {
    “id”: “resource_123”
  }
}
```

### Error response

```json
{
  “success”: false,
  “error”: {
    “code”: “VALIDATION_ERROR”,
    “message”: “The request contains invalid fields.”
  }
}
```

### Paginated response

```json
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
```

Avoid returning stack traces, SQL errors, environment variables, access tokens, or other internal implementation details to clients.

—

## 10. HTTP Status Codes

| Status | Usage |
|—|—|
| `200 OK` | Successful retrieval or update |
| `201 Created` | Resource created |
| `202 Accepted` | Request accepted for asynchronous processing |
| `204 No Content` | Successful operation with no response body |
| `400 Bad Request` | Malformed or invalid request |
| `401 Unauthorized` | Missing or invalid authentication |
| `403 Forbidden` | Authenticated caller lacks permission |
| `404 Not Found` | Resource does not exist or is not accessible |
| `409 Conflict` | Duplicate resource or conflicting state |
| `413 Content Too Large` | Request or upload exceeds configured limits |
| `415 Unsupported Media Type` | Unsupported request or file type |
| `422 Unprocessable Content` | Validly parsed request that fails domain validation |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected server error |
| `503 Service Unavailable` | Required dependency is unavailable |

Use status codes consistently with the API’s documented contract.

—

## 11. Error Handling

Use the centralized error-handling middleware defined in:

```text
/api/middlerware/error-handler.js
```

Route handlers should forward errors using `next(error)` or a compatible asynchronous wrapper.

The centralized handler should:

- Normalize known application errors.
- Avoid leaking internal exception details in production.
- Log unexpected failures with correlation IDs.
- Preserve appropriate HTTP status codes.
- Return a consistent JSON error envelope.
- Avoid writing a second response after headers have been sent.

Ensure asynchronous errors are handled correctly for the Express version in use.

—

## 12. Security Requirements

Every route must follow these principles:

- Apply authentication to private endpoints.
- Apply authorization independently of authentication.
- Validate every untrusted input.
- Use parameterized database queries in services.
- Rate-limit authentication, upload, and abuse-prone endpoints.
- Limit request and file sizes.
- Use safe error messages and structured logging.
- Enforce ownership checks on records and uploaded files.
- Use short-lived, scoped signed URLs for private document downloads.
- Keep credentials and signing secrets in environment variables.
- Avoid logging passwords, tokens, document contents, or unnecessary personal data.
- Use HTTPS in deployed environments.
- Audit sensitive administrative operations.
- Apply explicit CORS allowlists where appropriate.

For account deletion and document removal, define retention, recovery, and audit policies before enabling permanent deletion.

—

## 13. Pagination and Filtering

Collection endpoints should support bounded pagination.

Recommended defaults:

```text
page=1
limit=20
maximum limit=100
```

Example:

```http
GET /api/users?page=1&limit=20&status=active
```

Requirements:

- Reject invalid pagination values.
- Enforce a maximum page size.
- Allowlist sort fields and sort directions.
- Parameterize search filters.
- Avoid returning unlimited collections.
- Document pagination semantics in `/api/openapi.yaml`.

—

## 14. Route Ordering

Declare fixed paths before parameterized paths when a route could otherwise match the parameter.

Correct:

```javascript
router.get(“/me”, authenticate, getCurrentUser);
router.get(“/slug/:slug”, getBySlug);
router.get(“/:userId”, authenticate, getUserById);
```

Avoid ambiguous wildcard routes and invalid Express path patterns. Verify route syntax against the installed Express version.

—

## 15. OpenAPI Documentation

Document public and private endpoints in:

```text
/api/openapi.yaml
```

Each endpoint should specify:

- HTTP method and path.
- Purpose and access requirements.
- Authentication and permission requirements.
- Path, query, and request-body schemas.
- Successful response schemas.
- Expected error responses.
- Pagination behavior where applicable.
- Upload constraints where applicable.

Keep the OpenAPI specification synchronized with actual router behavior.

—

## 16. Testing

Test routes using the project’s configured test runner and an isolated test database or mocked services.

Minimum coverage:

- Successful requests.
- Invalid body, query, and path parameters.
- Missing, expired, or invalid authentication.
- Insufficient permissions.
- Access to another user’s private records.
- Missing resources.
- Duplicate or conflicting operations.
- Service failures and unexpected exceptions.
- Pagination limits.
- Sensitive-field redaction.
- Rate-limit behavior.
- Upload validation and download authorization.

Never run destructive integration tests against production data.

—

## 17. Pre-Deployment Checklist

- [ ] All imported routers and services exist.
- [ ] Every router exports an Express router.
- [ ] Middleware imports use the correct existing file paths.
- [ ] Service method names and signatures match.
- [ ] Authentication and permission mappings are configured.
- [ ] Request validation is active.
- [ ] Ownership and tenant boundaries are enforced.
- [ ] Error handling is registered after the routes.
- [ ] Sensitive fields are removed from API responses.
- [ ] OpenAPI documentation matches the implementation.
- [ ] Tests cover success, failure, and authorization scenarios.
- [ ] Environment variables and secrets are configured securely.
- [ ] Health endpoints do not disclose internal infrastructure details.
- [ ] Logs and audit records exclude unnecessary sensitive data.

—

## 18. Maintenance Policy

Keep route handlers focused on HTTP concerns. Place business rules in services, reusable validation in schemas, authentication and permission checks in middleware, and endpoint documentation in OpenAPI.

When adding or changing an endpoint:

1. Update the route.
2. Implement or update its service method.
3. Update the relevant schema and permission checks.
4. Update `/api/openapi.yaml`.
5. Add or update tests.
6. Verify the router mounts successfully.
7. Run the project’s test suite before deployment.

**This README documents the intended route architecture.** It does not imply that all listed services, permission mappings, endpoints, or tests already exist in the repository.
