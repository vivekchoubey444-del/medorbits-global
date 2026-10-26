MedOrbits — Utilities

Directory: src/utils/
Runtime: Node.js >= 20
Module system: CommonJS
Status: Architecture and implementation reference

1. Purpose

The src/utils/ directory contains reusable technical helpers shared across the MedOrbits application.

Utilities should be focused, predictable, independently testable, and free from unnecessary business logic.

Responsibilities include:

* Application error construction.
* Asynchronous Express handler wrapping.
* Standardized HTTP responses.
* Pagination calculations and metadata.
* Cryptographic token generation and password hashing.
* Input validation and normalization.
* Recursive input sanitization and context-specific output escaping.

Implementation status: This document describes the intended architecture and the utility implementations discussed during development. It does not establish that every file exists, every export is compatible, or that tests have passed. Verify the current repository before treating any component as production-ready.

2. Architecture

HTTP Request
    |
    v
Express Middleware
    |
    +—> Request parsing and request ID
    +—> Authentication and authorization
    +—> Rate limiting
    |
    v
Routes and Endpoint Validators
    |
    v
Controllers
    |
    v
Services
    |
    v
Repositories
    |
    v
Database / External Providers

Errors flow through centralized Express error middleware.

Layer	Responsibility
Utilities	Shared technical helpers and primitives
Validators	Request schemas, types, field constraints and allowlists
Middleware	Authentication, authorization, rate limiting and request processing
Controllers	HTTP request and response coordination
Services	Business rules and application workflows
Repositories	Database access and persistence
Error middleware	Error classification, logging and safe HTTP error responses

Utilities must not replace authorization, business rules, endpoint validation, or repository responsibilities.

3. Directory structure

Recommended inventory:

src/
└── utils/
    ├── README.md
    ├── app-error.js
    ├── async-handler.js
    ├── http.js
    ├── api-response.js
    ├── crypto.js
    ├── pagination.js
    ├── sanitize.js
    └── validation.js

Do not create duplicate modules simply to match this list. Inspect the actual files, their exports, and their consumers first.

4. Utility contracts

4.1 app-error.js

Purpose: Represent application errors consistently.

Expected default export:

const AppError = require(‘../utils/app-error’);

Expected capabilities include:

* statusCode: HTTP status.
* code: machine-readable error code.
* isOperational: classification for expected application failures.
* Optional details.
* Optional underlying error cause.
* Factory methods for common HTTP errors.

Example:

throw AppError.notFound(‘Resource not found.’);

For a temporary service outage:

throw AppError.serviceUnavailable(
  ‘Service temporarily unavailable.’,
  {
    code: ‘SERVICE_UNAVAILABLE’,
  }
);

The error object is not an HTTP response. Centralized error middleware must determine which message and details are safe to return.

Compatibility requirements

* Keep statusCode and code consistent with the centralized error middleware.
* Treat unexpected 5xx failures as non-operational by default.
* Do not expose stack traces, database errors, secrets, tokens, or internal configuration.
* Preserve the underlying error for internal diagnostics without exposing it to clients.

4.2 async-handler.js

Purpose: Forward synchronous exceptions and rejected promises to Express error middleware.

Expected default export:

const asyncHandler = require(‘../utils/async-handler’);

Example:

const asyncHandler = require(‘../utils/async-handler’);
router.get(
  ‘/example’,
  asyncHandler(async (req, res) => {
    const result = await someOperation();
    return res.status(200).json({
      success: true,
      data: result,
    });
  })
);

The wrapper must:

* Reject non-function handler arguments.
* Forward synchronous exceptions to next(error).
* Forward rejected promises to next(error).
* Preserve the handler’s execution context.
* Avoid swallowing errors or generating success responses after failures.

The wrapper is especially useful for Express 4 compatibility. Express 5 also forwards rejected promises from returned route-handler promises automatically. Avoid accidentally forwarding the same failure more than once. See the Express error-handling guide.

4.3 http.js

Purpose: Provide shared HTTP-related helpers.

The discussed implementation exports:

const {
  asyncHandler,
  sendSuccess,
  httpError,
  getPagination,
} = require(‘../utils/http’);

Example:

const {
  sendSuccess,
  httpError,
} = require(‘../utils/http’);
if (!resource) {
  throw httpError(
    404,
    ‘NOT_FOUND’,
    ‘Resource not found.’
  );
}
return sendSuccess(res, resource);

Expected responsibilities:

* asyncHandler: delegate to the shared async wrapper.
* sendSuccess: produce a standardized success response.
* httpError: create an application error.
* getPagination: parse bounded pagination query values.

Important contract difference: http.getPagination() and pagination.getPagination() are separate implementations. They must be tested for consistent defaults, maximum limits, page bounds, and offset behavior.

Do not assume the two helpers are interchangeable without checking their signatures and output.

4.4 api-response.js

Purpose: Standardize API response formatting.

The previously discussed interface includes:

success
created
noContent
paginated
error

These exports must be confirmed against the actual src/utils/api-response.js implementation before use.

Expected success response:

{
  “success”: true,
  “message”: “Records retrieved successfully.”,
  “data”: []
}

Expected error response:

{
  “success”: false,
  “error”: {
    “code”: “NOT_FOUND”,
    “message”: “Resource not found.”
  }
}

A request identifier may be included when available. Pagination metadata should follow the agreed meta.pagination contract.

Do not mix response-helper signatures. The http.js and api-response.js utilities may use different argument orders and response structures. Verify each function’s implementation before adapting callers.

Ensure that:

* Reserved response fields cannot be overwritten by arbitrary metadata.
* Error responses do not expose internal exceptions.
* 204 No Content responses do not include a JSON body.
* Response metadata follows one documented API contract.
* Error middleware does not send a second response after the response has ended.

4.5 crypto.js

Purpose: Provide cryptographic primitives using Node.js built-in modules.

The discussed interface exports:

const {
  randomToken,
  sha256,
  hmacSha256,
  safeEqual,
  hashPassword,
  verifyPassword,
} = require(‘../utils/crypto’);

Security requirements:

* Generate tokens using cryptographically secure randomness.
* Store hashes rather than plaintext passwords.
* Store password-reset token digests instead of raw reset tokens.
* Use independent, purpose-specific HMAC secrets.
* Keep secrets in validated environment configuration or a secret manager.
* Apply rate limiting to login, password reset and verification endpoints.
* Never derive unrestricted scrypt resource parameters from untrusted hash contents.

Password-hash migration warning

The discussed implementation changed the serialized password-hash format from:

scrypt$16384$8$1$salt$derivedKey

to a versioned format:

scrypt$1$16384$8$1$salt$derivedKey

Existing hashes in the older format will not verify using a verifier that accepts only the new format.

Before deployment, choose one of these approaches:

1. Retain a strictly validated legacy verifier alongside the new format.
2. Rehash successfully verified legacy passwords into the new format.
3. Require a password reset if backward-compatible verification is not available.

Do not deploy a format change that unexpectedly locks out existing users.

Test compatibility with the current user database before migration.

4.6 pagination.js

Purpose: Calculate bounded pagination parameters and metadata.

The discussed interface exports:

const {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  getPagination,
  getPaginationMeta,
} = require(‘../utils/pagination’);

Example:

const {
  getPagination,
  getPaginationMeta,
} = require(‘../utils/pagination’);
const pagination = getPagination(req.query);
const rows = await repository.findMany({
  limit: pagination.limit,
  offset: pagination.offset,
});
const totalItems = await repository.count();
const meta = getPaginationMeta(
  totalItems,
  pagination
);

Pagination parameters:

* page
* limit
* offset

Pagination metadata:

* page
* limit
* totalItems
* totalPages
* hasPreviousPage
* hasNextPage
* previousPage
* nextPage

Requirements:

* Apply maximum page-size limits consistently.
* Check that offsets remain within the safe integer range.
* Use parameterized SQL queries.
* Count records using the same relevant filters as the paginated query.
* Define whether malformed query parameters fall back to defaults or return HTTP 400.
* Do not silently normalize invalid inputs when strict validation is required.

A very large but valid offset can still cause expensive database queries. Consider database-specific pagination strategies for large datasets.

4.7 sanitize.js

Purpose: Normalize selected inputs and provide context-specific output escaping.

The discussed interface exports:

const {
  DANGEROUS_KEYS,
  sanitizeString,
  sanitizeObject,
  sanitizeSearchTerm,
  escapeHtml,
} = require(‘../utils/sanitize’);

Responsibilities:

* Bound string lengths.
* Bound array lengths and object-property counts.
* Limit nesting depth.
* Detect circular references.
* Reject unsupported object types where appropriate.
* Filter dangerous object keys.
* Normalize search terms.
* Escape text for HTML text-node contexts.

Security requirements:

* Avoid invoking arbitrary object getters during recursive processing.
* Avoid unsafe object mutation and prototype-related hazards.
* Do not assume sanitized data is authorized or semantically valid.
* Do not treat HTML escaping as a universal sanitizer.
* Do not use input sanitization as a substitute for parameterized SQL.

escapeHtml() is intended for HTML text contexts. URLs, CSS, JavaScript, HTML attributes, and rich HTML require their own context-appropriate handling.

Behavior to verify: The discussed implementation may truncate strings and arrays. Truncation should only occur where the API contract explicitly allows it. For required identifiers, emails, financial amounts, and other structured values, validate the original value rather than silently truncating it.

4.8 validation.js

Purpose: Provide basic reusable field-validation helpers.

The discussed interface exports:

const {
  objectBody,
  requiredString,
  optionalString,
  email,
  positiveId,
} = require(‘../utils/validation’);

Example:

const {
  objectBody,
  requiredString,
  email,
} = require(‘../utils/validation’);
const body = objectBody(req.body);
const name = requiredString(
  body.name,
  ‘name’,
  120
);
const normalizedEmail = email(body.email);

Responsibilities:

* Validate object request bodies.
* Validate required and optional strings.
* Normalize email input and validate its format.
* Validate positive integer resource identifiers.

These helpers do not replace endpoint schemas or domain-specific validators.

Use src/validators/ for:

* Field allowlists.
* Nested request structures.
* Enum constraints.
* Cross-field validation.
* Domain-specific rules.
* File and upload constraints.
* Payment and application workflows.

Validation should reject invalid input rather than silently modifying it into a valid-looking value.

A positive integer validator is not appropriate for UUIDs or other string identifiers. Create separate validators for those identifier types.

5. Error-handling contract

Application errors should follow one consistent path:

1. Request validators reject invalid input.
2. Controllers and services throw appropriate application errors.
3. Async wrappers forward uncaught handler failures.
4. Centralized Express error middleware classifies the error.
5. Safe response helpers format the response.

Recommended status conventions:

Condition	HTTP status
Malformed or invalid request	400
Authentication required or invalid	401
Insufficient permissions	403
Resource not found	404
Duplicate or conflicting operation	409
Validly structured request with invalid entity data	422
Rate limit exceeded	429
Operation not implemented	501
Temporary service outage	503
Unexpected internal failure	500

Choose one validation-error convention and use it consistently across the API.

The centralized error handler must:

* Recognize the application’s AppError contract.
* Normalize untrusted error values safely.
* Avoid exposing stack traces or internal error messages.
* Log useful diagnostics without logging credentials or tokens.
* Include a request identifier when available.
* Respect res.headersSent and delegate appropriately when a response has already started.
* Avoid sending multiple responses for a single request.

6. Import and export conventions

MedOrbits uses CommonJS.

For default exports:

const AppError = require(‘../utils/app-error’);
const asyncHandler = require(‘../utils/async-handler’);

For named exports:

const {
  sendSuccess,
  httpError,
} = require(‘../utils/http’);

Do not destructure a class that is exported directly through module.exports = AppError.

When changing utility exports:

1. Search the repository for all consumers.
2. Check routes, controllers, services, middleware and tests.
3. Preserve public interfaces where practical.
4. Coordinate intentional breaking changes.
5. Run relevant automated tests.
6. Update this README to match the resulting implementation.

7. Security and reliability requirements

Every utility should follow these principles:

* Never hard-code secrets or credentials.
* Avoid logging sensitive user data.
* Validate configuration and resource limits.
* Keep authorization decisions in middleware and service-level policies.
* Never trust client-supplied ownership, role, payment status or price values.
* Use parameterized database queries.
* Use cryptographic randomness and password-specific hashing.
* Apply bounded recursion, input sizes and expensive operations.
* Avoid swallowing errors or producing misleading fallback values.
* Avoid unnecessary global mutable state.
* Document assumptions and compatibility constraints.

Utilities must never independently approve applications, grant permissions, mark payments successful, bypass subscription checks, or override service-level policies.

8. Testing requirements

Each utility should have unit tests for its documented behavior.

app-error.js

* Factory methods and default codes.
* Valid and invalid status codes.
* Operational classification.
* Optional details and causes.
* Centralized middleware compatibility.

async-handler.js

* Synchronous success.
* Asynchronous success.
* Synchronous exceptions.
* Rejected promises.
* Invalid handler arguments.
* Correct error forwarding.

http.js and api-response.js

* Response shape and status.
* Metadata handling.
* Invalid arguments.
* Request identifiers.
* Error formatting.
* Empty-body responses.
* Compatibility between utility contracts.

crypto.js

* Token size and encoding.
* SHA-256 and HMAC results.
* Equal and unequal comparisons.
* Password hash and verification round trips.
* Wrong-password rejection.
* Malformed-hash rejection.
* Legacy hash compatibility where required.

pagination.js

* Default values.
* Minimum and maximum limits.
* Invalid query handling.
* Safe offset calculations.
* Empty result sets.
* Correct previous/next metadata.
* Configurable options.

sanitize.js and validation.js

* Valid and invalid inputs.
* Length boundaries.
* Unsupported types.
* Dangerous object keys.
* Circular objects.
* Excessive nesting.
* Malformed emails and identifiers.
* Prototype-related edge cases.

Do not claim a utility is tested until the relevant tests have actually run.

9. Production-readiness checklist

* [ ]	Actual utility files and exports match the documented inventory.
* [ ]	CommonJS import paths resolve correctly.
* [ ]	http.js and api-response.js have documented, non-conflicting contracts.
* [ ]	Centralized error middleware recognizes AppError.
* [ ]	Error responses do not disclose internal information.
* [ ]	Password-hash migration compatibility is addressed.
* [ ]	Pagination limits are consistent across endpoints.
* [ ]	Input limits are appropriate for each field and endpoint.
* [ ]	Authentication and authorization are enforced separately.
* [ ]	Unit tests cover success, failure and boundary cases.
* [ ]	Integration tests verify controller and middleware behavior.
* [ ]	Tests have actually been executed.
* [ ]	Documentation matches the current source code.

10. Maintenance policy

Before modifying a utility:

1. Inspect the implementation and all consumers.
2. Identify whether the change breaks an existing public contract.
3. Update dependent imports, tests and documentation.
4. Avoid introducing duplicate helpers with conflicting behavior.
5. Verify error and response conventions.
6. Review security and resource limits.
7. Run the relevant tests before deployment.

Core rule: Utilities provide shared technical building blocks. Validators validate input, middleware enforces cross-cutting controls, controllers coordinate HTTP requests, services implement business rules, repositories handle persistence, and centralized error middleware determines safe error responses.