MedOrbits API Middleware

Directory: api/middleware/
Runtime: Node.js
Framework: Express.js
Module system: CommonJS
Purpose: Centralized API security, request validation, authorization, rate limiting, and error handling.

⸻

1. Directory structure

api/
└── middleware/
    ├── README.md
    ├── authentication.js
    ├── authorization.js
    ├── validation.js
    ├── rate-limit.js
    └── error-handler.js

Use the spelling middleware consistently throughout the repository.

2. Middleware responsibilities

File	Responsibility
authentication.js	Verifies access tokens and establishes the authenticated user context.
authorization.js	Enforces role-based access control (RBAC), permission checks, and resource ownership.
validation.js	Validates request fields, allowed properties, data formats, and field constraints.
rate-limit.js	Limits request frequency to reduce abuse, brute-force attempts, and excessive resource consumption.
error-handler.js	Normalizes errors, logs safe diagnostic information, and returns consistent JSON responses.

Authentication

Authentication determines whether a request is associated with a valid identity.

* Verify tokens using the configured authentication mechanism.
* Reject missing, invalid, or expired credentials.
* Populate req.user only from trusted, verified identity information.
* Do not trust identity, roles, or permissions supplied in request bodies or query parameters.

Authorization

Authorization determines whether the authenticated user may perform a particular action.

* Use authorizeRoles() for role restrictions.
* Use authorizePermissions() to require all specified permissions.
* Use authorizeAnyPermission() to require at least one specified permission.
* Use requireOwnership() when access depends on resource ownership.
* Use requireAuthenticated() when a route requires authentication without a specific role restriction.

For sensitive operations, obtain current roles and permissions from a trusted database or authorization service.

Request validation

Validate untrusted request data before passing it to business logic.

* Use validate() for schema-based field validation.
* Use allowOnlyFields() to reject unexpected fields.
* Use requireObject() to enforce object-shaped request sections.
* Use trimFields() and lowercaseFields() for appropriate normalization.
* Use limitFieldLengths() to enforce maximum string lengths.
* Use the supplied identifier validators where applicable.

Input validation does not replace parameterized database queries, authorization, or context-specific output encoding.

Rate limiting

The rate limiter exports three middleware instances:

Export	Default policy
apiLimiter	300 requests per IP per 15 minutes
authLimiter	10 requests per IP per 15 minutes
sensitiveLimiter	20 requests per IP per minute

Defaults can be overridden with environment variables. These values should be tuned to actual traffic and endpoint sensitivity.

The default in-memory store is not shared across multiple application instances. Configure a compatible shared store, such as Redis, for multi-instance deployments.

Central error handling

The error handler exports:

* AppError — application-level errors.
* asyncHandler — forwards rejected asynchronous handlers to Express.
* notFoundHandler — handles requests that do not match a route.
* errorHandler — generates the final JSON error response.

The error handler must be mounted after routes. In production, unexpected errors must not expose stack traces, SQL details, internal paths, secrets, or database messages.

⸻

3. Recommended Express middleware order

Register middleware in a deliberate order. Express executes middleware in the order in which it is mounted. Error-handling middleware uses four arguments and belongs at the end of the normal request pipeline. See the official Express middleware guide and error-handling guide.

Example integration in the application bootstrap file:

‘use strict’;
const express = require(‘express’);
const {
  apiLimiter,
} = require(‘./api/middleware/rate-limit’);
const {
  notFoundHandler,
  errorHandler,
} = require(‘./api/middleware/error-handler’);
const app = express();
// 1. Configure trust proxy only for your actual deployment topology.
// Example: app.set(‘trust proxy’, 1);
// Do not enable this blindly.
// 2. Parse request bodies with explicit size limits.
app.use(express.json({ limit: ‘1mb’ }));
app.use(express.urlencoded({
  extended: false,
  limit: ‘100kb’,
}));
// 3. Apply API-wide rate limiting.
app.use(‘/api’, apiLimiter);
// 4. Mount your API routers.
// Replace this example with your existing router imports.
// app.use(‘/api/auth’, authRoutes);
// app.use(‘/api/users’, userRoutes);
// app.use(‘/api/applications’, applicationRoutes);
// 5. Handle unmatched routes.
app.use(notFoundHandler);
// 6. Handle errors last.
app.use(errorHandler);
module.exports = app;

Integration warning: adapt this example to the existing application bootstrap. Do not replace working router registrations, database initialization, session setup, security middleware, or deployment-specific configuration merely to match this example.

⸻

4. Authentication and authorization on routes

Authentication must precede authorization.

const {
  authenticate,
} = require(‘../middleware/authentication’);
const {
  authorizeRoles,
  authorizePermissions,
  requireOwnership,
} = require(‘../middleware/authorization’);
// Administrator-only endpoint.
router.get(
  ‘/admin’,
  authenticate,
  authorizeRoles(‘admin’),
  adminController.dashboard
);
// Permission-protected endpoint.
router.get(
  ‘/applications’,
  authenticate,
  authorizePermissions(‘applications:read’),
  applicationController.list
);
// Ownership must be resolved from the actual stored resource.
router.get(
  ‘/applications/:id’,
  authenticate,
  requireOwnership(async (req) => {
    const application = await applicationService.findById(
      req.params.id
    );
    return application ? application.userId : null;
  }),
  applicationController.getById
);

The controller and service names above are illustrative. Replace them with existing project modules.

Ownership alone is insufficient when a particular operation also requires a permission, organizational scope, or administrative approval.

⸻

5. Validation on routes

Example of a registration route using the validation middleware:

const {
  rules,
  validate,
  trimFields,
  lowercaseFields,
  allowOnlyFields,
} = require(‘../middleware/validation’);
router.post(
  ‘/register’,
  trimFields([‘name’, ‘email’]),
  lowercaseFields([‘email’]),
  allowOnlyFields(
    [‘name’, ‘email’, ‘password’],
    ‘body’
  ),
  validate({
    name: {
      required: true,
      rules: [
        rules.string,
        (value) => rules.minLength(value, 2),
      ],
    },
    email: {
      required: true,
      rules: [
        rules.string,
        rules.email,
      ],
    },
    password: {
      required: true,
      rules: [
        rules.string,
        (value) =>
          value.length >= 12 ||
          ‘Password must contain at least 12 characters.’,
      ],
    },
  }),
  registrationController.register
);

This example illustrates middleware composition. Confirm that the password policy matches the application’s actual security requirements and that password hashing and account-creation safeguards are implemented by the service layer.

⸻

6. Rate-limiting configuration

Set these environment variables as appropriate for the deployment:

API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=10
SENSITIVE_RATE_LIMIT_WINDOW_MS=60000
SENSITIVE_RATE_LIMIT_MAX=20

Do not commit real credentials, tokens, or secrets to the repository.

For authentication endpoints, consider account-based throttling in addition to IP-based throttling. Avoid configurations that let clients spoof their IP through untrusted forwarding headers.

⸻

7. Error response format

Expected errors should follow a consistent response structure:

{
  “success”: false,
  “error”: {
    “code”: “VALIDATION_ERROR”,
    “message”: “One or more request fields are invalid.”,
    “requestId”: “example-request-id”
  }
}

The actual response fields depend on the middleware that produces the error. Do not assume every middleware returns identical fields unless that behavior is implemented and tested.

Use HTTP status codes consistently:

Status	Meaning
400	Invalid request data
401	Missing or invalid authentication
403	Authenticated but not authorized
404	Resource or route not found
409	Resource conflict
413	Request payload too large
429	Rate limit exceeded
500	Unexpected server error

⸻

8. Dependency requirements

The rate limiter requires express-rate-limit.

npm install express-rate-limit

Other imports and dependencies should be consistent with the existing package.json and lockfile. Do not install duplicate packages or regenerate the lockfile unnecessarily.

⸻

9. Verification checklist

After adding or updating middleware files:

* [ ]	Confirm all imports resolve to existing paths.
* [ ]	Confirm authentication.js exports the authenticate middleware used by routes.
* [ ]	Confirm authorization.js exports the functions referenced by route files.
* [ ]	Confirm validation schemas match the actual request payloads.
* [ ]	Confirm rate-limit configuration loads in development and production.
* [ ]	Confirm malformed JSON and oversized payloads receive safe responses.
* [ ]	Confirm unknown routes reach notFoundHandler.
* [ ]	Confirm errorHandler is registered last.
* [ ]	Confirm unauthorized users cannot access protected resources.
* [ ]	Confirm users cannot access another user’s resources by changing an ID.
* [ ]	Confirm production responses do not expose stack traces or secrets.
* [ ]	Confirm rate limiting works correctly behind the configured proxy.
* [ ]	Test middleware behavior using automated tests before deployment.

Run syntax checks from the repository root:

node —check api/middleware/authentication.js
node —check api/middleware/authorization.js
node —check api/middleware/validation.js
node —check api/middleware/rate-limit.js
node —check api/middleware/error-handler.js

These commands check JavaScript syntax; they do not verify runtime imports, configuration, database access, or security behavior. Run the project’s test suite and a deployment smoke test as well.

⸻

10. Security and maintenance rules

1. Keep authentication, authorization, validation, rate limiting, and error handling as separate responsibilities.
2. Never trust client-provided role or permission values.
3. Use parameterized database operations and enforce authorization at the service or data-access boundary where appropriate.
4. Avoid logging passwords, access tokens, cookies, private documents, or sensitive personal information.
5. Use HTTPS in production.
6. Configure proxy trust and rate-limit storage according to the real deployment architecture.
7. Keep dependencies updated and review security advisories.
8. Preserve existing route contracts and exports when improving middleware.
9. Do not overwrite unrelated files or delete untracked files during middleware maintenance.
10. Back up or commit known-good changes before resolving Git conflicts.

References

* Express: Using middleware
* Express: Error handling
* Express: Security best practices

⸻

Maintenance principle: Middleware should fail safely, return predictable responses, and enforce security controls without exposing internal implementation details. Changes should be tested against the actual MedOrbits application before deployment.