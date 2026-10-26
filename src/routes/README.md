
# MedOrbits API Routes

**Directory:** `src/routes/`  
**Runtime:** Node.js >= 20  
**Framework:** Express.js  
**API base path:** `/api/v1`

## 1. Purpose

The routing layer defines the HTTP API surface for MedOrbits and connects incoming requests to middleware and controller handlers.

Routes cover education, admissions, careers, recruitment, accounts, payments, notifications, file uploads, and platform administration.

Routes should remain focused on HTTP concerns. Business rules belong in `src/services/`, database operations in `src/repositories/`, and provider-specific operations in `src/integrations/`.

**Implementation principle:** Registering a route does not prove that its controller, business workflow, database access, or security controls are implemented.

## 2. Route Mounting and API Versioning

The application mounts routes under `/api/v1`.

Examples:

| Route module | Mount path |
|—|—|
| `auth.routes.js` | `/api/v1/auth` |
| `user.routes.js` | `/api/v1/users` |
| `payment.routes.js` | `/api/v1/payments` |
| `application.routes.js` | `/api/v1/applications` |
| `search.routes.js` | `/api/v1/search` |
| `public-release.routes.js` | `/api/v1/public-releases` |

Verify the actual mounting configuration in `server.js`.

### Mounting strategies

**Individual mounting:** `server.js` mounts each route module separately.

**Combined mounting:** `src/routes/index.js` mounts all resource routers and is mounted once under `/api/v1`.

Never use both strategies for the same route modules. Duplicate registration can cause middleware to execute more than once or produce unexpected responses.

## 3. Controller Convention

Controllers reside in `src/controllers/` and export named handler functions.

Example:

```javascript
‘use strict’;

async function list(req, res, next) {
  try {
    // Call the relevant service.
    // Return the documented response.
  } catch (error) {
    next(error);
  }
}

module.exports = { list };
```

A typical CRUD controller may export:

```javascript
module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
```

Use the actual handler names expected by each route module.

### Missing handlers

The route utility’s `notImplemented` fallback returns a non-success response with HTTP `501`.

This is preferable to a false success response, but it does not implement the feature. Identify unfinished handlers before production release.

Missing controller files should be handled consistently with the application’s startup policy. Production deployments should fail fast when required modules are absent.

## 4. Request Processing Order

A protected request generally follows this sequence:

1. **Route matching:** Match the HTTP method and path.
2. **Request controls:** Apply security headers, CORS, request limits, and rate limiting as appropriate.
3. **Authentication:** Establish the caller’s identity.
4. **Authorization:** Check roles, permissions, and resource ownership.
5. **Validation:** Validate path parameters, query parameters, and request bodies.
6. **Controller:** Coordinate the HTTP request and response.
7. **Service:** Execute business rules and workflow operations.
8. **Repository or integration:** Access persistence or external providers.
9. **Response and error handling:** Return the documented response or forward errors to centralized handling.

Not every endpoint requires every middleware component. Public endpoints still need suitable validation and abuse protections.

## 5. Route Design

- Use explicit HTTP methods and resource-oriented paths.
- Keep route handlers small and delegate business logic to services.
- Use consistent naming and response contracts.
- Validate identifiers before passing them to services.
- Reject unexpected request-body properties where appropriate.
- Apply pagination and bounded result limits to collection endpoints.
- Use appropriate HTTP status codes.
- Avoid exposing internal database or implementation details unnecessarily.
- Document authentication requirements and permissions.
- Keep administrative operations protected.

| Method | Typical purpose |
|—|—|
| `GET` | Retrieve a resource or collection |
| `POST` | Create a resource or initiate an operation |
| `PUT` | Replace a resource where supported |
| `PATCH` | Partially update a resource |
| `DELETE` | Delete or deactivate a resource where permitted |

Actual semantics must match each endpoint’s implementation and documented contract.

## 6. Middleware and Authorization

Protected routes must apply authentication and authorization consistently.

Recommended controls include:

- Role-based access restrictions.
- Resource ownership checks.
- Administrative permission checks.
- Request validation.
- Endpoint-specific rate limiting.
- Audit logging for sensitive operations.
- CSRF protection when required by cookie-based authentication.

Hiding a route in the frontend does not protect it. A valid resource identifier is not proof of permission to access that resource.

For sensitive operations, enforce authorization close to the operation as well as at the route boundary where appropriate.

## 7. Response and Error Conventions

Use a consistent response format across route modules.

| Status | Meaning |
|—|—|
| `200` | Successful request |
| `201` | Resource created |
| `204` | Successful operation without a response body |
| `400` | Malformed or invalid request |
| `401` | Authentication required or invalid |
| `403` | Caller lacks permission |
| `404` | Resource not found or intentionally undisclosed |
| `409` | Conflicting state or duplicate operation |
| `413` | Request payload too large |
| `415` | Unsupported media type |
| `422` | Semantically invalid input, if adopted |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error |
| `501` | Feature not implemented |
| `503` | Required service temporarily unavailable |

Forward errors to the centralized error handler. Never return stack traces, SQL errors, provider secrets, or internal exception details to clients.

## 8. Payments and Webhooks

Payment routes require additional safeguards:

- Verify provider signatures using the exact raw request body required by the provider.
- Configure raw-body capture before JSON parsing where necessary.
- Validate event types and identifiers.
- Record webhook event IDs to prevent duplicate processing.
- Make payment-state transitions safe to repeat.
- Reconcile payment state against authoritative provider and database records.
- Never treat a browser redirect as proof of successful payment.
- Apply appropriate rate limits and operational monitoring.

The payment controller must pass the correct raw body, signature header, and required headers to the payment service.

Verify this integration against the actual middleware and controller code.

## 9. File Uploads and Private Documents

Routes handling uploads or document downloads must:

- Enforce request and file-size limits.
- Validate file content, not just filename extensions.
- Validate MIME types and file signatures.
- Apply malware scanning where appropriate.
- Authenticate the caller and verify document ownership.
- Store private files outside publicly served directories.
- Use controlled storage identifiers and authorized download mechanisms.
- Avoid logging document contents or sensitive metadata.
- Apply retention and deletion policies.

Never expose private documents through an unrestricted public static directory.

## 10. Route Composition

Where supported, `src/routes/index.js` combines resource routers into a single Express router.

Choose and document one strategy:

### Individual mounting
- Each route module is mounted separately in `server.js`.
- Resource prefixes remain explicit at the application composition layer.

### Combined mounting
- `index.js` combines the resource routers.
- The application mounts the combined router once under `/api/v1`.

Verify that every route is registered exactly once.

## 11. Testing Requirements

- [ ] Every intended route maps to the correct controller handler.
- [ ] Missing handlers return a safe non-success response.
- [ ] Routes are mounted exactly once.
- [ ] Authentication is enforced where required.
- [ ] Authorization and resource ownership are enforced.
- [ ] Invalid request bodies and parameters are rejected.
- [ ] Rate limits apply to sensitive endpoints.
- [ ] Error responses do not expose internal details.
- [ ] Payment webhooks verify signatures using the required raw body.
- [ ] Duplicate webhook events are handled safely.
- [ ] Uploads and document downloads enforce access controls.
- [ ] Pagination and search results are bounded.
- [ ] Public and protected endpoints have documented contracts.
- [ ] Missing required controller modules are detected during startup.
- [ ] Integration tests use the actual Express application and suitable test dependencies.

## 12. Production Readiness

Before public launch, implement and verify:

1. Database-backed controllers and required schema or migrations.
2. Authentication and role-based authorization.
3. Resource-level access controls.
4. Request validation and response-field minimization.
5. Rate limits for login, password reset, uploads, payments, and public search.
6. CSRF protection where required by the authentication architecture.
7. Secure file storage, content validation, and malware scanning where appropriate.
8. Payment webhook signature verification and idempotency.
9. Automated tests, monitoring, and error reporting.
10. Backup, recovery, and operational procedures.
11. Consistent API versioning and deprecation practices.
12. Verification that unfinished routes are not unintentionally exposed.
13. Verification that all configured route modules exist and export valid Express routers.
14. Verification that controller methods, services, repositories, and integrations are wired correctly.

## 13. Implementation Status

This document describes the intended routing architecture. Verify route registration, controller exports, middleware, service wiring, database behavior, and integration tests before treating any endpoint as production-ready.

—

**MedOrbits — Study · Work · Grow**

Structured API routing for education, admissions, careers, recruitment, payments, and platform operations.
```

**Critical integration check:** Your `src/routes/index.js` and `server.js` must use the same mounting strategy. Also, the current route utilities’ development fallback can conceal missing controller methods, so add tests that enumerate route-to-controller mappings and explicitly identify every `501` fallback before release.