
# MedOrbits Validation Standards

**Project:** MedOrbits — Education · Admissions · Careers · Recruitment  
**File:** `docs/VALIDATION.md`  
**Runtime:** Node.js 20+  
**Backend:** Express.js with ES modules  
**Database:** PostgreSQL  
**Scope:** Input validation, schema validation, data integrity, security, and automated enforcement

—

## 1. Purpose

This document defines the validation standards that apply throughout the MedOrbits platform.

Validation must ensure that incoming data is structurally correct, semantically meaningful, safe to process, and consistent with the application’s business rules.

The objectives are to:

- Reject malformed and unexpected input.
- Prevent invalid data from reaching business logic or persistent storage.
- Protect API endpoints from abusive or oversized requests.
- Validate JSON resources and configuration files.
- Protect applications, candidate records, and uploaded documents.
- Maintain consistent validation errors across the platform.
- Enforce validation through automated tests and continuous integration.

**Core rule:** Client-side validation improves usability. Server-side validation is authoritative and must never be bypassed because the browser has already validated a request.

—

## 2. Validation Layers

MedOrbits should apply validation at the appropriate layers.

| Layer | Responsibility |
|—|—|
| HTML forms | Required fields, input types, and immediate feedback |
| Frontend JavaScript | User-friendly validation and conditional fields |
| API middleware | Request structure, size limits, and schema validation |
| Controllers | HTTP-specific requirements and parameter validation |
| Services | Business rules and workflow constraints |
| Database | Constraints, uniqueness, relationships, and data integrity |
| File-processing layer | Upload type, size, signature, and storage validation |
| Automated tests | Verify valid, invalid, boundary, and adversarial inputs |
| CI pipeline | Prevent invalid schemas and failing tests from being merged |

Do not rely on a single layer to enforce every rule.

—

## 3. General Validation Rules

Every externally supplied value must be treated as untrusted.

### Required practices

1. Validate request bodies, route parameters, query parameters, headers, and uploaded files where relevant.
2. Define explicit required and optional fields.
3. Validate types before performing operations on values.
4. Enforce reasonable minimum and maximum lengths.
5. Reject invalid enumerations and unsupported values.
6. Normalize data only when the normalization rule is well-defined.
7. Use parameterized database queries.
8. Enforce ownership and authorization separately from input validation.
9. Validate external API responses before using them.
10. Avoid returning stack traces or sensitive internal details to clients.

### Validation versus sanitization

Validation determines whether data satisfies an expected contract.

Normalization converts valid input into a consistent representation, such as trimming surrounding whitespace.

Output encoding protects data when it is rendered in a particular context.

These operations are not interchangeable. Do not silently transform invalid input into a different value and then treat it as valid.

—

## 4. String Validation

For text fields:

- Require a string where the schema specifies a string.
- Reject unexpected objects, arrays, and unsupported types.
- Enforce field-specific length limits.
- Trim surrounding whitespace where appropriate.
- Reject blank values for fields that must contain meaningful text.
- Avoid unnecessarily restrictive rules for names and international text.
- Escape or safely render user-provided content at output boundaries.

Example:

```javascript
function validateRequiredString(value, options = {}) {
  const {
    field = “value”,
    minLength = 1,
    maxLength = 500,
    trim = true,
  } = options;

  if (typeof value !== “string”) {
    return {
      valid: false,
      error: `${field} must be a string.`,
    };
  }

  const normalized = trim ? value.trim() : value;

  if (normalized.length < minLength) {
    return {
      valid: false,
      error: `${field} is too short.`,
    };
  }

  if (normalized.length > maxLength) {
    return {
      valid: false,
      error: `${field} is too long.`,
    };
  }

  return {
    valid: true,
    value: normalized,
  };
}
```

This helper is suitable for simple string checks. Use dedicated schemas for complete API payloads and business rules.

—

## 5. Numeric, Boolean, and Enumeration Validation

### Numeric fields

- Require finite numbers.
- Reject `NaN` and positive or negative infinity.
- Enforce permitted ranges.
- Check integer requirements explicitly.
- Avoid accepting arbitrary numeric strings unless conversion is part of the documented contract.

Example:

```javascript
function validateInteger(value, { min, max } = {}) {
  if (!Number.isInteger(value)) {
    return {
      valid: false,
      error: “Value must be an integer.”,
    };
  }

  if (min !== undefined && value < min) {
    return {
      valid: false,
      error: `Value must be at least ${min}.`,
    };
  }

  if (max !== undefined && value > max) {
    return {
      valid: false,
      error: `Value must not exceed ${max}.`,
    };
  }

  return {
    valid: true,
    value,
  };
}
```

### Boolean fields

Accept actual booleans unless the API contract explicitly defines another representation.

Do not interpret arbitrary strings such as `”false”`, `”no”`, or `”0”` as booleans without a documented conversion rule.

### Enumerations

Use explicit allowlists for values such as:

- Application status.
- Employment type.
- Course category.
- User role.
- Resource status.
- Notification type.

Never permit clients to assign privileged roles or internal workflow statuses merely by submitting an accepted string.

—

## 6. Email, Phone, and URL Validation

### Email addresses

- Trim surrounding whitespace.
- Enforce a reasonable length limit.
- Use a well-maintained email validation library or established validation rules.
- Avoid overly restrictive regular expressions that reject valid addresses.
- Verify ownership through an appropriate verification workflow when required.

A syntactically valid email address does not prove that the mailbox exists or belongs to the user.

### Phone numbers

- Store country codes consistently where required.
- Use a suitable phone-number library when international numbers are supported.
- Do not assume every valid phone number has the same length.
- Use OTP or another verification mechanism if proof of ownership is required.

### URLs

- Parse URLs with a standard URL parser.
- Allow only approved protocols, normally HTTPS for external links.
- Reject `javascript:` and other unsafe schemes.
- Apply hostname allowlists where the business requirement permits them.
- Avoid server-side fetching of arbitrary user-provided URLs.
- Defend against open redirects and server-side request forgery.

URL syntax validation alone does not establish that a destination is safe or trustworthy.

—

## 7. Request Body and Query Validation

Every API endpoint must define the request shape it accepts.

Example request:

```json
{
  “title”: “Junior Software Developer”,
  “employmentType”: “full-time”,
  “location”: “Noida”
}
```

Example validation rules:

- `title` must be a non-empty string within the configured length limit.
- `employmentType` must match an allowed enumeration.
- `location` must be a valid string within its length limit.
- Unknown fields should be rejected or explicitly stripped according to the endpoint’s documented policy.
- Required fields must not be inferred from missing values.

### Query parameters

Validate query parameters independently because query strings arrive as text.

For pagination:

- Require a positive integer for page numbers.
- Set a maximum page size.
- Reject malformed numeric strings.
- Use deterministic ordering.
- Prefer cursor-based pagination for large or frequently changing datasets where appropriate.

Do not concatenate query parameters directly into SQL statements.

—

## 8. JSON Schema Validation

JSON files under `assets/data/` and schemas under `api/schemas/` must be validated before publication or use.

Potential resources include:

- `courses.json`
- `colleges.json`
- `universities.json`
- `fees.json`
- `scholarships.json`
- `hostels.json`
- `admission-process.json`
- `entrance-exams.json`
- `documents.json`
- `career-options.json`
- `jobs.json`
- `faqs.json`
- `news.json`
- `notifications.json`
- `testimonials.json`
- `services.json`
- `official-document-resources.json`

The list is illustrative. Validate files that actually exist in the repository.

### Schema requirements

Use a consistent JSON Schema draft across the project. Document the chosen draft and validation library.

Where appropriate, schemas should specify:

- Required properties.
- Property types.
- Minimum and maximum string lengths.
- Numeric limits.
- Allowed enumeration values.
- Array item schemas and maximum item counts.
- URL formats and additional application-level checks.
- Whether additional properties are allowed.
- Stable identifier formats.
- Date and date-time formats.

Do not assume every validator automatically checks all `format` keywords. Configure and test format validation explicitly.

### Data quality checks

Schema validation should be supplemented with business-level checks, including:

- Duplicate identifiers.
- Invalid references between datasets.
- Missing source information for time-sensitive facts.
- Invalid or stale URLs where link checking is part of the pipeline.
- Contradictory status and date fields.
- Accidental publication of private data.

A structurally valid JSON document may still contain incorrect information.

—

## 9. Application Form Validation

Application submissions may contain personal information, education details, course preferences, contact details, and supporting documents.

Validate each field according to the actual application contract.

### Application rules

- Require only fields necessary for the application workflow.
- Enforce field types and length limits.
- Validate email and phone formats.
- Validate dates and permitted date ranges.
- Check course and institution identifiers against approved records.
- Validate consent fields where consent is required.
- Prevent users from assigning themselves privileged review statuses.
- Check duplicate submissions using an explicit business rule.
- Enforce ownership for updates and document access.
- Avoid exposing another applicant’s information in validation errors.

### Application state transitions

If the application workflow uses statuses such as `draft`, `submitted`, `under_review`, `accepted`, or `rejected`, validate transitions on the server.

For example, a candidate must not be able to change an application from `submitted` to `accepted` simply by changing a request field.

Use transactions when a status change and associated database updates must succeed together.

—

## 10. Job and Recruitment Validation

Validate both employer-submitted jobs and administrative updates.

### Job fields

- Job title.
- Employer or organization identifier.
- Description.
- Location and remote-work status.
- Employment type.
- Eligibility criteria.
- Application method.
- Publication status.
- Closing date.
- External application URL, if applicable.

### Business rules

- Closing dates must follow the documented date and timezone policy.
- A job must not be published without required fields.
- Only authorized users may publish or edit a job.
- Employer ownership must be verified server-side.
- External links must use permitted protocols.
- Rich text must be sanitized using an appropriate HTML sanitizer if HTML is supported.
- Expired jobs should follow the defined archival policy.
- Government job claims and deadlines should be verified against official sources before publication.

Do not accept arbitrary SQL, HTML, scripts, or filesystem paths in job fields.

—

## 11. File Upload Validation

File uploads are a high-risk input boundary.

### Required controls

1. Enforce request and file-size limits.
2. Allowlist permitted file types.
3. Check file signatures where feasible.
4. Do not trust the filename extension or client-provided MIME type alone.
5. Generate storage names on the server.
6. Prevent path traversal and filename collisions.
7. Store private files outside the public web root.
8. Apply malware scanning where available and appropriate.
9. Restrict download access by identity, ownership, and permission.
10. Record relevant security events without logging document contents.
11. Apply retention and deletion rules.
12. Return safe error messages when processing fails.

### File validation examples

Possible allowed formats depend on the feature:

- PDF for official documents.
- JPEG or PNG for supported images.
- DOCX only where document editing or resume submission requires it.

Do not allow every file type merely because the upload middleware supports it.

### Failure handling

Reject:

- Oversized files.
- Unsupported formats.
- Empty files when empty content is not allowed.
- Files with mismatched or invalid signatures.
- Files that cannot be safely processed.
- Uploads from users who lack permission.

For private application documents, authorization must be checked on every download request.

—

## 12. Authentication and Authorization Validation

Authentication and authorization are distinct from ordinary field validation.

### Authentication checks

- Validate credentials before creating a session.
- Apply rate limits to login and account-recovery workflows.
- Use a modern password-hashing algorithm.
- Validate session expiration and revocation.
- Verify email or phone ownership when required.
- Use secure cookie settings when cookie-based sessions are implemented.

### Authorization checks

- Verify access to the requested resource on the server.
- Confirm record ownership before reads, updates, or deletion.
- Check administrative privileges for administrative actions.
- Reject unauthorized changes to roles, prices, application statuses, and moderation decisions.
- Apply authorization to background jobs and document-download endpoints as well as ordinary routes.

A valid payload from an unauthorized user must still be rejected.

—

## 13. PostgreSQL Data Integrity

Application validation should be reinforced with database constraints.

Use appropriate:

- `NOT NULL` constraints.
- `UNIQUE` constraints.
- Foreign keys.
- Check constraints.
- Indexes.
- Transaction boundaries.

Example:

```sql
CREATE TABLE IF NOT EXISTS validation_example (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    external_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL
        CHECK (status IN (‘draft’, ‘active’, ‘archived’)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

This is an illustrative table, not a proposed replacement for existing MedOrbits tables.

### Database rules

- Use parameterized queries.
- Never rely exclusively on frontend validation.
- Handle unique-constraint violations without exposing internal SQL.
- Use transactions for multi-step writes.
- Ensure concurrent requests cannot bypass critical business rules.
- Manage schema changes through reviewed migrations.
- Do not run destructive initialization automatically in production.

—

## 14. Centralized Validation Errors

Return a consistent error structure across API endpoints.

Recommended example:

```json
{
  “success”: false,
  “error”: {
    “code”: “VALIDATION_ERROR”,
    “message”: “The submitted information is invalid.”,
    “details”: [
      {
        “field”: “title”,
        “message”: “This field is required.”
      }
    ]
  },
  “requestId”: “request-id”
}
```

### Error response requirements

- Use stable machine-readable error codes.
- Return safe and actionable messages.
- Do not expose stack traces, SQL statements, secret values, or internal filesystem paths.
- Avoid returning submitted sensitive values in error details.
- Do not reveal whether a private account or record exists unless the workflow explicitly permits that disclosure.
- Keep the format consistent with `docs/INTEGRATION.md` and `api/openapi.yaml`.

Use the HTTP status code that best matches the failure.

—

## 15. Frontend Validation and Accessibility

Frontend validation should help users correct mistakes before submission.

### Form requirements

- Associate every input with a visible label.
- Indicate required fields clearly.
- Display errors next to the relevant field.
- Use accessible error summaries for long forms.
- Preserve safe user-entered values when validation fails.
- Avoid clearing the entire form after a recoverable error.
- Set appropriate input types and autocomplete attributes.
- Ensure validation messages are understandable to assistive technology.
- Do not use color as the only indication of an error.
- Avoid blocking submission for optional fields that are legitimately empty.

The server must repeat all security-relevant validation.

—

## 16. Rate Limiting and Resource Limits

Apply endpoint-specific limits to expensive or abuse-prone operations.

Examples include:

- Authentication and password recovery.
- Application submissions.
- Public contact forms.
- Search endpoints.
- File uploads.
- AI-assisted features.
- Administrative actions.

Use limits appropriate to the expected traffic and business workflow.

Also enforce:

- Maximum request-body sizes.
- Maximum file sizes.
- Maximum array lengths.
- Maximum pagination limits.
- Database query timeouts where appropriate.
- External-service timeouts.
- Concurrency limits for expensive operations.

Return `429 Too Many Requests` when rate limits are exceeded and provide `Retry-After` when supported by the rate-limiting implementation.

—

## 17. External Data and AI Response Validation

External APIs, imported datasets, and AI-generated responses are untrusted inputs.

Before use:

- Validate expected response structure.
- Check required fields and types.
- Reject unexpected data where strict contracts are necessary.
- Apply timeout and retry policies.
- Limit response sizes.
- Avoid executing returned code or commands.
- Safely render returned text.
- Verify links before publishing them.
- Do not allow model output to override authorization or business rules.
- Avoid treating generated admissions, career, or legal information as verified official guidance without appropriate review.

If an upstream service returns malformed data, fail safely and record a sanitized diagnostic event.

—

## 18. Date, Time, and Timezone Validation

Date fields must follow a documented format and timezone policy.

Recommended practices:

- Use ISO 8601 for API date-time values.
- Use date-only strings for date-only concepts where appropriate.
- Validate calendar dates rather than relying solely on regular expressions.
- Reject invalid or impossible dates.
- Define how timezone offsets are handled.
- Compare timestamps consistently.
- Do not assume the browser’s local timezone is the server’s timezone.
- Use an explicit business timezone for deadlines when required.

For admissions and recruitment deadlines, verify the authoritative published date and timezone before displaying a countdown or deadline status.

—

## 19. Automated Validation Tests

Automated tests must cover normal, boundary, and adversarial inputs.

### Unit tests

Test individual validators and business rules:

- Missing values.
- Empty strings.
- Whitespace-only strings.
- Wrong data types.
- Values below minimum limits.
- Values above maximum limits.
- Invalid enumerations.
- Invalid dates.
- Malformed URLs.
- Invalid state transitions.

### Integration tests

Test actual routes and middleware:

- Malformed request bodies.
- Invalid query parameters.
- Unauthenticated requests.
- Forbidden operations.
- Unauthorized resource access.
- Duplicate submissions.
- Database constraint violations.
- File upload rejection.
- Rate limiting.
- External service failures.
- Consistent error responses.

### Regression tests

Add tests for every validation or authorization defect that is fixed.

Use an isolated test database and test credentials. Do not run destructive test operations against production data.

—

## 20. Continuous Integration Enforcement

Validation should run automatically in CI before a change is merged or released.

Recommended checks:

1. JSON syntax validation.
2. JSON Schema validation.
3. API schema and OpenAPI validation.
4. Formatting checks.
5. Linting.
6. Unit tests.
7. Integration tests.
8. Security-related regression tests.
9. Dependency vulnerability review.
10. Build verification.

### Package scripts

Use the actual scripts defined in `package.json`. Example names might include:

- `format:check`
- `lint`
- `validate:json`
- `test`
- `test:integration`
- `build`

These names are recommendations, not confirmation that the scripts already exist.

Before adding a CI command, verify that the corresponding script and required dependencies are implemented.

### Git hooks

Local hooks may run fast validation checks before commits and broader checks before pushes.

Git hooks are a developer convenience, not a security boundary. Required CI checks and server-side validation remain authoritative.

—

## 21. Validation Checklist

### Request validation

- [ ] Request bodies are validated against endpoint-specific schemas.
- [ ] Route and query parameters are validated.
- [ ] Required and optional fields are documented.
- [ ] Unknown-field behavior is explicit.
- [ ] String, number, boolean, and enum checks are tested.
- [ ] Date and URL validation follows documented rules.

### Security

- [ ] Authorization is enforced server-side.
- [ ] Database queries use safe parameter binding.
- [ ] Sensitive data is excluded from error responses and logs.
- [ ] File uploads have type, signature, and size checks.
- [ ] Private document downloads require authorization.
- [ ] Rate limits and request-size limits are configured.
- [ ] External API responses are validated.

### Data quality

- [ ] Public JSON resources conform to schemas.
- [ ] Identifiers and references are consistent.
- [ ] Time-sensitive information has appropriate source and verification metadata.
- [ ] Database constraints protect critical invariants.
- [ ] Migrations are reviewed and tested.

### Quality assurance

- [ ] Unit tests cover boundary cases.
- [ ] Integration tests cover middleware and authorization.
- [ ] Regression tests cover previously fixed defects.
- [ ] CI runs the required validation commands.
- [ ] Deployment procedures include verification and rollback.

—

## 22. Definition of Done

A validation implementation is complete when:

1. The validation rules are documented.
2. Valid input is accepted.
3. Invalid input is rejected predictably.
4. Business rules are enforced by the server.
5. Sensitive information is not exposed in errors or logs.
6. Database constraints protect critical data invariants.
7. Automated tests cover expected and adversarial cases.
8. API documentation matches actual behavior.
9. CI executes the relevant checks.
10. The feature has been verified in the target environment.

—

## 23. Maintenance

Update this document whenever validation contracts, schemas, middleware, database constraints, upload policies, or CI checks change.

Keep the following artifacts aligned:

- `docs/INTEGRATION.md`
- `docs/VALIDATION.md`
- `api/schemas/`
- `api/middleware/`
- `api/openapi.yaml`
- `tests/`
- `package.json`
- `.github/workflows/`

**Final rule:** Validate early for usability, validate authoritatively on the server, enforce critical invariants in the database, and verify behavior through automated tests.
