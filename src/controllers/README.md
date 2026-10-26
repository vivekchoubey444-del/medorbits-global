
# MedOrbits — Controllers Architecture

**Directory:** `src/controllers/`  
**Runtime:** Node.js >= 20  
**Module system:** CommonJS  
**Status:** Architecture and implementation standard

—

## 1. Purpose

Controllers form the HTTP boundary between MedOrbits routes and application logic. They translate incoming requests into validated, authorized service or repository operations and return consistent API responses.

Controllers must remain focused on HTTP concerns. Business rules, database queries, payment-provider integrations, transactional operations, and complex state transitions belong in the appropriate application services or data-access layer.

This document defines the expected architecture and security requirements. It does not assert that every listed controller, route, service, repository, validator, or integration already exists.

## 2. Architectural Principles

Every controller must follow these principles:

1. **Validate input:** Never pass unrestricted request data into application logic.
2. **Authenticate identity:** Use trusted authentication middleware and server-established identity.
3. **Authorize operations:** Verify permissions and resource ownership before sensitive actions.
4. **Delegate business logic:** Keep complex workflows out of controllers.
5. **Minimize data exposure:** Return explicit, sanitized response objects.
6. **Fail closed:** Never claim success when a required operation is unavailable or incomplete.
7. **Standardize responses:** Follow the established MedOrbits HTTP response contract.
8. **Handle errors centrally:** Forward unexpected failures to centralized error middleware.
9. **Preserve data integrity:** Delegate transactions, concurrency control, and state transitions to services and repositories.
10. **Test behavior:** Verify functional outcomes, authorization boundaries, and failure conditions.

## 3. Directory Structure

The following inventory is illustrative and must be reconciled with the actual repository.

```text
src/controllers/
├── README.md
├── auth.controller.js
├── user.controller.js
├── application.controller.js
├── request.controller.js
├── document.controller.js
├── course.controller.js
├── college.controller.js
├── university.controller.js
├── job.controller.js
├── employer.controller.js
├── candidate.controller.js
├── subscription.controller.js
├── payment.controller.js
├── notification.controller.js
├── session.controller.js
├── counselling.controller.js
├── recruitment.controller.js
├── service.controller.js
├── search.controller.js
├── upload.controller.js
├── faq.controller.js
├── password.controller.js
├── verification.controller.js
├── public-releases.controller.js
└── admin.controller.js
```

Do not create files merely to match this list. Add a controller only when a real application capability requires it.

## 4. Request Lifecycle

A typical request should follow this sequence:

```text
HTTP Request
    |
    v
Route Registration
    |
    v
Request Parsing and Size Limits
    |
    v
Authentication (when required)
    |
    v
Authorization and Ownership Checks
    |
    v
Controller Input Validation
    |
    v
Application Service
    |
    v
Repository / External Provider
    |
    v
Response Sanitization
    |
    v
Standardized HTTP Response
```

Errors should be passed to centralized error middleware. Route-specific requirements may change the ordering, particularly for payment webhooks, which require raw-body capture before ordinary JSON parsing.

## 5. Controller Responsibilities

Controllers may:

- Read validated route parameters, query parameters, and request bodies.
- Obtain the authenticated user from trusted middleware.
- Invoke dedicated validators.
- Enforce authorization checks or delegate them to an explicit authorization layer.
- Invoke application services or authorized repository methods.
- Sanitize returned records.
- Select appropriate HTTP status codes.
- Pass errors to centralized error middleware.

Controllers must not:

- Execute ad hoc database queries.
- Trust client-supplied ownership or role information.
- Accept arbitrary database fields from request bodies.
- Expose raw database records containing sensitive information.
- Contain payment-provider secrets or infrastructure configuration.
- Implement complex business workflows directly.
- Return fabricated records or successful responses for failed operations.

## 6. Request Controller

**File:** `src/controllers/request.controller.js`

### Purpose

The request controller defines the HTTP boundary for consultancy enquiries, admissions guidance, counselling requests, and related request-management workflows.

### Expected exports

| Handler | Intended operation |
|—|—|
| `createRequest` | Submit a new request |
| `listRequests` | List requests accessible to the caller |
| `getRequestById` | Retrieve one authorized request |
| `updateRequest` | Update explicitly permitted fields |
| `deleteRequest` | Delete or withdraw a request when permitted |

These handlers are intended capabilities, not proof that the underlying workflows are implemented.

### Current disabled state

The initial implementation is deliberately fail-closed. Its handlers validate input and return a non-success response while request processing remains unconfigured.

Before enabling request management, verify:

- `src/utils/async-handler.js`
- `src/utils/api-response.js`
- `src/validators/request.validator.js`
- The request application service
- The request repository and persistence schema
- The request route module
- Authentication and authorization middleware
- Controller and route tests

The response helper must match the actual implementation. If the established contract supports `apiResponse.sendError(res, status, code, message)`, use that signature consistently.

### Public and protected operations

Public enquiry submission may be enabled only under an explicit public-access policy with validation, abuse prevention, and appropriate rate limiting.

Listing, retrieval, updating, and deletion must require the applicable authentication and authorization checks. A request ID alone never establishes permission to access a record.

### Activation requirements

Before enabling any request operation:

1. Validate request bodies using dedicated validators.
2. Enforce explicit field allowlists.
3. Derive the requester identity from trusted authentication middleware where applicable.
4. Verify ownership or administrative permissions.
5. Enforce permitted state transitions in the application service.
6. Persist changes before reporting success.
7. Handle duplicate submissions and concurrent updates where required.
8. Return sanitized records.
9. Add automated tests for success, validation failure, authorization failure, and service failure.

Until these requirements are met, the operation must remain disabled.

## 7. Authentication and Authorization

Authentication identifies the caller. Authorization determines which operations and resources that caller may access.

Authentication must be enforced by the applicable route middleware or an equivalent trusted mechanism. Controllers must not treat request-body fields, query parameters, or arbitrary headers as proof of identity.

### Ownership rules

| Resource | Minimum authorization expectation |
|—|—|
| Users | Restrict account access and updates to permitted identities and fields |
| Applications | Restrict applicant access to their own applications unless an authorized role grants broader access |
| Requests | Enforce requester ownership or documented staff permissions |
| Documents | Verify access rights before exposing metadata, downloads, or uploads |
| Candidates | Protect personal and application information |
| Employers | Verify organization membership and permitted employer actions |
| Jobs and recruitment | Verify employer ownership and publishing permissions |
| Subscriptions | Restrict billing and entitlement information to authorized identities |
| Payments | Restrict transaction information to the payer and explicitly authorized staff |
| Sessions | Restrict access to authorized participants and permitted session managers |
| Notifications | Scope retrieval and state changes to the authenticated recipient |

Where practical, use user-scoped repository operations such as `findForUser(id, userId)` instead of retrieving an unrestricted record and checking ownership afterward.

Administrative access must be explicit, audited where appropriate, and enforced by server-side authorization logic.

## 8. Input Validation and Data Integrity

Use dedicated validators for request bodies, route parameters, and query parameters.

Validation must address:

- Required fields and data types.
- String lengths and supported formats.
- Positive identifiers and valid pagination.
- Supported enum values.
- URL and contact-information formats where applicable.
- Allowed create and update fields.
- Date ranges and numeric bounds.
- Related-resource existence and permissions.
- Permitted state transitions.
- Unknown-field rejection where appropriate.

Create and update operations should use separate validation rules when their requirements differ. Partial updates must reject empty or entirely disallowed payloads.

Never rely on controller validation alone for complex business rules. The application service and database layer must also enforce integrity constraints, authorization-sensitive transitions, uniqueness, and transaction requirements.

## 9. Response Sanitization

Use explicit serializers or field allowlists for all sensitive resources.

Never expose:

- Password hashes or authentication secrets.
- Session-token hashes or password-reset token hashes.
- Private storage keys, filesystem paths, or signed download credentials.
- Payment credentials, webhook secrets, or unnecessary provider metadata.
- Internal exception messages, SQL errors, or stack traces.
- Private applicant, counselling, or enquiry information to unauthorized callers.
- Internal audit metadata that the caller is not permitted to access.

Sanitization must apply to individual records and every item in collection responses. Verify nested objects and arrays as well; filtering only top-level fields is insufficient if nested data can contain secrets.

Do not return a raw repository object merely because the current schema appears safe.

## 10. Standardized API Responses

Use the existing MedOrbits response helpers and established response contract.

Illustrative success response:

```json
{
  “success”: true,
  “data”: {
    “id”: “resource-id”
  }
}
```

Illustrative error response:

```json
{
  “success”: false,
  “error”: {
    “code”: “RESOURCE_NOT_FOUND”,
    “message”: “The requested resource was not found.”
  }
}
```

These examples are illustrative. The actual implementation must follow the response utility already used by the application.

### HTTP status guidance

| Status | Typical use |
|—|—|
| `200 OK` | Successful retrieval or update |
| `201 Created` | Resource successfully persisted |
| `202 Accepted` | Operation accepted for asynchronous processing |
| `204 No Content` | Successful operation with no response body |
| `400 Bad Request` | Invalid parameters or payload |
| `401 Unauthorized` | Authentication missing or invalid |
| `403 Forbidden` | Authenticated caller lacks permission |
| `404 Not Found` | Resource absent or intentionally concealed |
| `409 Conflict` | Duplicate or conflicting state |
| `413 Content Too Large` | Request exceeds configured size limits |
| `415 Unsupported Media Type` | Unsupported request content type |
| `422 Unprocessable Content` | Valid syntax but unacceptable business input |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected server failure |
| `503 Service Unavailable` | Temporarily unavailable dependency or service |
| `501 Not Implemented` | Requested functionality is genuinely not implemented |

Choose status codes based on the actual condition. Do not use `501` as a generic substitute for authorization failures, validation errors, or temporary outages.

## 11. Unconfigured Operations

The following capabilities must be treated as unconfigured until their actual implementation is verified:

- Account and identity verification
- Password-reset workflows
- Administrative overview
- Request submission and request management
- Counselling
- Recruitment
- Service catalogue
- Search
- Notifications
- Uploads
- FAQ retrieval and answering

This list is a verification checklist, not a claim that every capability is absent.

Payment creation and webhook processing require verified provider integration, secure state handling, and idempotency before activation.

For unconfigured functionality:

1. Do not fabricate success or resource identifiers.
2. Do not return mock records as persisted data.
3. Do not silently ignore requested changes.
4. Return a consistent non-success response.
5. Log safe diagnostic information without credentials or personal data.
6. Keep the endpoint disabled until its dependencies and tests are ready.

Use `501` for genuinely unsupported functionality. Use `503` when an implemented capability is temporarily unavailable.

## 12. Payments and Webhooks

Payment endpoints require stricter safeguards than ordinary CRUD endpoints.

- Calculate payable amounts from trusted server-side prices and purchase records.
- Do not accept client-supplied payment status as authoritative.
- Verify provider signatures against the exact raw request body.
- Validate provider account identity, event type, and transaction association.
- Process provider events idempotently.
- Prevent duplicate charges, duplicate fulfilment, and repeated state transitions.
- Protect concurrent updates with appropriate transactions or locking.
- Keep secrets in environment-based or managed secret storage.
- Do not mark an order paid merely because the browser reports success.
- Grant subscription entitlements only after trusted payment confirmation.
- Preserve auditable financial records.

Configure raw-body capture before JSON parsing on webhook routes. Do not apply ordinary session authentication in place of provider signature verification.

Payment creation and webhook processing must remain disabled until these controls are implemented and tested.

## 13. Route Integration

Controllers are not mounted automatically. Route modules must explicitly import and register controller methods.

Illustrative example:

```javascript
‘use strict’;

const express = require(‘express’);
const router = express.Router();

const { requireAuth } = require(‘../middleware/auth.middleware’);
const requestController = require(‘../controllers/request.controller’);

router.post(‘/‘, requestController.createRequest);

router.get(
  ‘/‘,
  requireAuth,
  requestController.listRequests
);

router.get(
  ‘/:id’,
  requireAuth,
  requestController.getRequestById
);

router.patch(
  ‘/:id’,
  requireAuth,
  requestController.updateRequest
);

router.delete(
  ‘/:id’,
  requireAuth,
  requestController.deleteRequest
);

module.exports = router;
```

This is an example only. The actual middleware path, public-access policy, and controller exports must be verified before use.

Before registering a route, confirm:

- The controller exists and exports the referenced method.
- Authentication and role middleware are correct for that operation.
- Middleware ordering is correct.
- Input validation occurs before sensitive application operations.
- Ownership checks cannot be bypassed.
- Error handling follows the application contract.
- The route is covered by tests.

Do not mount a handler merely because it is exported.

## 14. Testing Requirements

### Functional tests

Test:

- Valid and invalid request payloads.
- Valid and invalid identifiers.
- Successful operations when services are configured.
- Missing resources.
- Unsupported operations.
- Service and repository failures.
- Response structure and HTTP status codes.
- Pagination boundaries.
- Empty update payloads.
- Persistence before successful responses.

### Security tests

Test:

- Missing or invalid authentication.
- Insufficient role permissions.
- Cross-user resource access.
- Unauthorized updates and deletions.
- Attempts to assign arbitrary owners or privileged statuses.
- Sensitive-field leakage.
- Malicious pagination and filter values.
- Repeated or concurrent state-changing requests.
- Payment webhook signature failures and duplicate events when implemented.

### Integration tests

Test:

- Route registration and exported method names.
- Middleware ordering.
- Centralized error handling.
- Real service/repository interface compatibility.
- Unconfigured operation behavior.
- Database constraints and transaction behavior where applicable.

Service unit tests should mock external dependencies. Integration tests should use isolated test resources and must not mutate production data.

A passing test suite is evidence of tested behavior, not proof of complete production security.

## 15. Production-Readiness Checklist

Before declaring a controller production-ready:

- [ ] The controller exists and exports the expected methods.
- [ ] Registered routes match those exports.
- [ ] Authentication is enforced where required.
- [ ] Role authorization and ownership checks are effective.
- [ ] Request parameters and bodies are validated.
- [ ] Create and update allowlists are explicit.
- [ ] Response data is sanitized, including nested fields.
- [ ] Service and repository contracts match actual implementations.
- [ ] Unexpected errors reach centralized error middleware.
- [ ] Unconfigured operations fail safely.
- [ ] Sensitive values are excluded from responses and logs.
- [ ] Successful responses follow completed operations.
- [ ] State transitions and concurrency are protected.
- [ ] Automated tests cover functional and security failures.
- [ ] API documentation matches implemented behavior.
- [ ] Deployment and configuration requirements are documented.

## 16. Maintenance Workflow

When changing a controller:

1. Inspect the existing controller, route, validator, service, repository, and response helpers.
2. Update the controller using actual project interfaces.
3. Add or update input validation and response sanitization.
4. Verify authentication, authorization, and ownership rules.
5. Add tests for success, failure, and security boundaries.
6. Confirm that all registered route methods exist.
7. Run the project’s configured linting, tests, and validation commands.
8. Update documentation to describe implemented behavior accurately.

Do not claim that tests passed, routes were mounted, or deployment succeeded unless those actions were actually verified.

## 17. Definition of Done

A controller is complete only when its HTTP contract, validators, service/repository dependencies, authorization requirements, response format, and automated tests agree with the actual application.

An exported function is not proof that a workflow is implemented. A standardized error response is not proof that a feature is production-ready.

**MedOrbits — Study · Work · Grow**
