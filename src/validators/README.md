
# MedOrbits — Validators

**Directory:** `src/validators/`

## 1. Purpose

The validators layer validates incoming request data before it reaches controllers, services, repositories, or database operations.

Validators are responsible for checking:

- Request body structure and permitted fields.
- Query parameters and route parameters.
- Required and optional values.
- String lengths, numeric ranges, and supported formats.
- Enumerated values and domain-specific constraints.
- Pagination parameters.
- Dates, identifiers, email addresses, and other structured inputs.
- Nested objects and arrays where applicable.

The objective is to reject malformed, unexpected, or invalid input consistently while keeping validation rules separate from business logic.

## 2. Architectural Position

Validators belong between HTTP request handling and application logic.

```text
HTTP Request
    |
    v
Express Middleware
    |
    v
Route-Level Validation
    |
    v
Controller
    |
    v
Service
    |
    v
Repository
    |
    v
Database
```

The sequence may vary when validation is performed directly inside a controller, but validation must always happen before the corresponding operation uses the input.

### Responsibilities by layer

| Layer | Responsibility |
|—|—|
| Routes | Register endpoints and middleware. |
| Middleware | Handle authentication, authorization, rate limits, and cross-cutting concerns. |
| Validators | Validate request structure, fields, types, and constraints. |
| Controllers | Coordinate validated input and HTTP responses. |
| Services | Enforce business rules and workflow transitions. |
| Repositories | Perform persistence and data retrieval. |
| Database | Enforce schema constraints, uniqueness, and referential integrity. |

Validation does not replace authorization, business-rule enforcement, or database constraints.

## 3. Directory Structure

The following is the recommended organization. It is an architectural reference, not confirmation that every listed file currently exists.

```text
src/
└── validators/
    ├── README.md
    ├── common.validator.js
    ├── request.validator.js
    ├── auth.validator.js
    ├── user.validator.js
    ├── email.validator.js
    ├── password.validator.js
    ├── otp.validator.js
    ├── phone.validator.js
    ├── application.validator.js
    ├── document.validator.js
    ├── university.validator.js
    ├── course.validator.js
    ├── admission.validator.js
    ├── payment.validator.js
    ├── subscription.validator.js
    ├── job.validator.js
    ├── enquiry.validator.js
    ├── contact.validator.js
    ├── search.validator.js
    └── pagination.validator.js
```

Create domain-specific validator files only when the corresponding feature and schema are defined.

Do not create placeholder validators that imply an unsupported endpoint or domain capability exists.

## 4. Core Principles

### 4.1 Validate at the boundary

Validate untrusted HTTP input before using it in application operations.

Treat all request data as untrusted, including:

- `req.body`
- `req.params`
- `req.query`
- Uploaded file metadata
- Webhook payloads
- External API responses
- Client-supplied identifiers and status values

Authenticated requests also require input validation.

### 4.2 Use allowlists

Define the fields accepted by each endpoint.

Reject unknown fields when strict request contracts are required. Do not automatically pass the complete request body into database create or update operations.

For example, public user updates must not allow clients to set privileged fields such as:

- `role`
- `permissions`
- `isAdmin`
- `emailVerified`
- `accountStatus`
- `passwordHash`

The exact allowlist must match the endpoint’s intended behavior and data model.

### 4.3 Keep validation deterministic

Given the same input and validation rules, a validator should produce the same result.

Validators must not:

- Write to the database.
- Send email or SMS messages.
- Create accounts.
- Initiate payments.
- Change application statuses.
- Perform authorization decisions.
- Trigger external side effects.

### 4.4 Do not silently change meaningful input

Normalization may include trimming surrounding whitespace or normalizing an email address when explicitly required.

Avoid silently truncating submitted values to make them valid. Reject values exceeding the field’s maximum length unless truncation is an explicit, documented product requirement.

### 4.5 Fail closed

If required validation functionality is missing or cannot safely validate the input, do not allow the operation to proceed as though validation succeeded.

Configuration errors should be handled as application errors, not disguised as successful validation.

## 5. Naming Conventions

Use descriptive filenames ending in `.validator.js`.

Examples:

- `auth.validator.js`
- `application.validator.js`
- `document.validator.js`
- `payment.validator.js`
- `subscription.validator.js`

Use `camelCase` for functions and `UPPER_SNAKE_CASE` for constants.

Prefer explicit function names:

```js
validateCreateUser
validateUpdateUser
validateLogin
validatePasswordReset
validateCreateApplication
validateApplicationQuery
validateRouteParams
```

Avoid ambiguous names such as `check`, `process`, or `handle` when the validation purpose can be stated precisely.

## 6. Common Validation Rules

### 6.1 Object validation

Validate that an expected JSON body is an object rather than `null`, an array, or a primitive.

Reject unexpected fields when the endpoint uses a strict schema.

An empty object should only be accepted when the operation explicitly permits it.

### 6.2 String validation

Check:

- Type.
- Required versus optional status.
- Minimum and maximum length.
- Empty or whitespace-only values.
- Permitted format where required.
- Normalization rules.

Do not use one universal string limit for every field. A person’s name, short status value, message body, and internal note have different requirements.

### 6.3 Email validation

Email validation should:

- Require a string.
- Enforce the application’s maximum email length.
- Reject malformed addresses.
- Normalize case only according to the application’s email identity policy.
- Avoid claiming that a mailbox exists without verification.

Syntax validation and email ownership verification are separate operations.

### 6.4 Identifier validation

Validate identifiers according to their actual representation.

For positive integer IDs:

- Accept only supported numeric representations.
- Reject zero and negative values.
- Reject decimals and unsafe integers.
- Reject malformed strings.

If the application uses UUIDs or other identifiers, use the corresponding format validator instead of assuming every identifier is numeric.

Validation does not establish that a resource exists or that the caller may access it.

### 6.5 Numeric validation

Check:

- Numeric type.
- Integer versus decimal requirements.
- Minimum and maximum values.
- Safe integer limits.
- Units and precision where relevant.

Never trust a client-supplied payment amount, discount, fee, account balance, or calculated total. Compute authoritative financial values on the server.

### 6.6 Boolean validation

Accept actual booleans unless an endpoint explicitly supports a documented string representation.

Do not rely on JavaScript truthiness for security-sensitive flags.

### 6.7 Enum validation

Validate status, role, category, and type fields against explicit allowlists.

For example, a client must not be allowed to set an application to `approved` simply because `approved` is a valid application status. The service must also verify that the transition is permitted and the actor is authorized.

### 6.8 Date and time validation

Use explicit formats and validate actual calendar values.

Distinguish between:

- Date-only values.
- Timestamps.
- Timezone-aware timestamps.
- Application-specific date ranges.

Reject impossible dates and ambiguous formats when strict date handling is required.

### 6.9 Arrays and nested objects

Validate:

- Expected object or array structure.
- Maximum number of entries.
- Required nested properties.
- Element types.
- Allowed nested fields.
- Maximum nesting depth where appropriate.

Do not trust nested client data merely because the top-level object passed validation.

## 7. Shared Utilities

MedOrbits has discussed reusable utilities under `src/utils/`:

```text
src/utils/
├── app-error.js
├── async-handler.js
├── crypto.js
├── http.js
├── pagination.js
├── sanitize.js
└── validation.js
```

This is a reference to the utility files discussed in the project; verify their actual paths and exports before importing them.

### `src/utils/validation.js`

The shared validation utility discussed in this project exports:

```js
objectBody
requiredString
optionalString
email
positiveId
```

Example:

```js
const {
  objectBody,
  requiredString,
  email,
  positiveId,
} = require(‘../utils/validation’);

const body = objectBody(req.body);

const normalizedEmail = email(body.email);
const name = requiredString(body.name, ‘name’, 120);
const userId = positiveId(req.params.id, ‘id’);
```

Use these helpers for basic validation only. Domain-specific validators must still enforce endpoint allowlists and domain constraints.

### `src/utils/http.js`

The HTTP utility discussed in this project exports:

```js
asyncHandler
sendSuccess
httpError
getPagination
```

The `httpError(status, code, message)` helper creates an application error for centralized error handling.

Example:

```js
const { httpError } = require(‘../utils/http’);

throw httpError(
  400,
  ‘VALIDATION_ERROR’,
  ‘Enter a valid email address.’
);
```

Verify that the installed implementation matches this contract before relying on it.

### Error handling

Validators should throw errors compatible with the application’s centralized error middleware.

Expected client-input failures should produce appropriate 4xx responses. Unexpected programming errors should not be disguised as client validation failures.

Never expose stack traces, database internals, secrets, or tokens in public validation responses.

## 8. Recommended Validator Contract

Use a consistent public interface for domain-specific validators. Preserve existing exports when modifying a file that is already imported elsewhere.

A recommended pattern is to return validated, normalized data:

```js
‘use strict’;

const {
  objectBody,
  requiredString,
  email,
} = require(‘../utils/validation’);

const { httpError } = require(‘../utils/http’);

const ALLOWED_FIELDS = Object.freeze([
  ‘name’,
  ‘email’,
]);

function validateCreateContact(input) {
  const body = objectBody(input);

  const unknownFields = Object.keys(body).filter(
    (field) => !ALLOWED_FIELDS.includes(field)
  );

  if (unknownFields.length > 0) {
    throw httpError(
      400,
      ‘UNKNOWN_FIELDS’,
      ‘The request contains unsupported fields.’
    );
  }

  return {
    name: requiredString(body.name, ‘name’, 120),
    email: email(body.email),
  };
}

module.exports = Object.freeze({
  validateCreateContact,
});
```

This is an illustrative pattern, not a declaration that MedOrbits currently implements a contact endpoint.

For maintainability, imports should normally be declared at the top of the module rather than inside a function. Domain validators should also use the project’s agreed error code and response conventions.

### Alternative: validation result objects

A validator may return a result such as:

```js
{
  valid: false,
  errors: [
    {
      field: ‘email’,
      code: ‘INVALID_EMAIL’,
      message: ‘Enter a valid email address.’
    }
  ]
}
```

Use this style only if it is the established project contract. Do not mix result-object and thrown-error conventions arbitrarily across validators.

## 9. Domain-Specific Requirements

### Authentication and passwords

- Validate login identifiers and password input types.
- Apply the configured password policy during registration and password changes.
- Do not log submitted passwords.
- Never accept client-supplied password hashes.
- Validate reset tokens before invoking reset services.
- Apply rate limits to login, OTP, and password-reset endpoints.

### Users and roles

- Public validators must not authorize role elevation.
- Separate public profile fields from administrative fields.
- Enforce authorization in middleware and services.
- Validate role assignments against server-controlled policies.

### Applications and admissions

- Validate course, institution, intake, and application identifiers.
- Validate supported application states.
- Enforce permitted status transitions in services.
- Do not infer eligibility or admission approval from syntactically valid input.

### Documents and uploads

- Validate upload metadata, size, extension, and expected media type.
- Verify file content using appropriate server-side inspection.
- Do not trust a filename or client-provided MIME type.
- Validate ownership and access permissions separately.
- Keep file-storage and document-verification logic outside validators.

### Payments and subscriptions

- Validate amounts, currency codes, identifiers, and supported request fields.
- Calculate authoritative prices on the server.
- Never accept a client-supplied payment-success status as proof of payment.
- Verify provider webhook signatures in the appropriate integration layer.
- Enforce subscription transitions and payment reconciliation in services.

### Universities and courses

- Validate identifiers, names, slugs, country codes, and supported attributes against the actual schema.
- Validate uniqueness through the appropriate service or repository.
- Do not assume a university or course exists merely because its ID is valid.

### Jobs and recruitment

- Validate title, description, location, employment type, and application fields.
- Enforce status transitions and employer ownership in services.
- Validate search filters and pagination independently.

## 10. Pagination Validation

Pagination validators should enforce:

- Positive integer page numbers.
- Positive integer limits.
- A configured maximum page size.
- Safe offset calculation.
- Supported sorting fields and sort directions.

Never interpolate arbitrary client-supplied column names into SQL.

The pagination utility discussed in MedOrbits provides:

```js
const {
  getPagination,
  getPaginationMeta,
} = require(‘../utils/pagination’);
```

Use strict request validation when malformed pagination should return HTTP 400. Utility defaults should not accidentally conceal invalid input if the endpoint requires rejection.

## 11. Sanitization Is Not Validation

Sanitization and validation serve different purposes.

| Validation | Sanitization |
|—|—|
| Determines whether input meets a schema. | Normalizes or transforms input. |
| Rejects unsupported values. | May remove or normalize selected content. |
| Enforces domain constraints. | Does not establish business validity. |
| Does not establish authorization. | Does not establish authorization. |

The `src/utils/sanitize.js` utility discussed in this project provides:

```js
sanitizeString
sanitizeObject
sanitizeSearchTerm
escapeHtml
```

Do not use HTML escaping as a substitute for SQL parameterization, URL validation, schema validation, or framework output encoding.

Avoid silently truncating input where the original value must be preserved.

## 12. Error Codes and HTTP Statuses

Use the application’s established error response contract and consistent error codes.

| Condition | Typical status |
|—|—:|
| Malformed request body | 400 |
| Invalid field or unsupported input | 400 or 422, according to project convention |
| Missing authentication | 401 |
| Insufficient permissions | 403 |
| Resource not found | 404 |
| Duplicate or conflicting state | 409 |
| Request too large | 413 |
| Unsupported media type | 415 |
| Rate limit exceeded | 429 |
| Unimplemented operation | 501 |
| Temporarily unavailable service | 503 |

Choose one documented convention for ordinary validation failures and apply it consistently.

Do not use HTTP 500 for normal invalid input. Do not return HTTP 200 when validation fails.

## 13. Security Requirements

Every validator must follow these requirements:

1. Treat client input as untrusted.
2. Use explicit field allowlists.
3. Reject malformed or unsupported data.
4. Enforce appropriate length and collection limits.
5. Prevent unsafe coercion and prototype-related object handling.
6. Avoid leaking internal implementation details in errors.
7. Never log passwords, access tokens, reset tokens, or sensitive document contents.
8. Keep authorization and ownership checks in their designated layers.
9. Use parameterized database operations.
10. Validate external webhook and integration data before processing it.
11. Avoid regular expressions vulnerable to catastrophic backtracking.
12. Add regression tests for security-sensitive validation rules.

## 14. Testing Requirements

Each domain validator should have tests for:

- Valid input.
- Missing required fields.
- Incorrect data types.
- Empty strings and whitespace-only strings.
- Boundary lengths.
- Values above configured limits.
- Unknown fields.
- Invalid identifiers.
- Invalid enum values.
- Malformed dates.
- Nested object and array violations.
- Unexpected `null` values.
- Prototype-related keys where applicable.
- Consistent error codes and HTTP status behavior.

Use unit tests for validation rules and integration tests to verify how validation errors are handled by Express middleware.

Do not consider a validator production-ready solely because valid input passes.

## 15. Implementation Checklist

Before adding or modifying a validator:

- [ ] Confirm the actual endpoint and data schema.
- [ ] Define accepted fields and required fields.
- [ ] Define type, length, range, and format constraints.
- [ ] Decide whether unknown fields are rejected.
- [ ] Normalize values only when explicitly intended.
- [ ] Use the established error contract.
- [ ] Keep business logic and authorization outside the validator.
- [ ] Preserve existing exports or update all dependent imports.
- [ ] Add unit tests for valid and invalid cases.
- [ ] Add integration tests for HTTP error responses.
- [ ] Review privacy and sensitive-data handling.
- [ ] Confirm that validation cannot be bypassed by another entry point.

## 16. Definition of Done

A validator is ready for integration when:

- Its input schema is documented and matches the actual feature.
- It returns only accepted, validated data or raises a consistent validation error.
- It rejects unsupported fields where required.
- Its behavior is deterministic and covered by tests.
- It does not perform side effects or make authorization decisions.
- It is imported using the correct path and export contract.
- Its errors are handled by centralized middleware.
- Its limits are compatible with application and database constraints.

## 17. Maintenance Policy

This README describes the intended architecture. It does not confirm that every listed validator or feature is implemented.

When adding a validator:

1. Verify the actual feature requirements and schema.
2. Reuse shared helpers where their contracts match.
3. Preserve existing public exports unless a coordinated migration is planned.
4. Update affected routes, controllers, tests, and documentation.
5. Never enable a workflow solely because a validator file has been created.

**Core rule:** Validators establish that input conforms to an expected structure. Services enforce business rules, authorization layers enforce access, and repositories manage persistence.
