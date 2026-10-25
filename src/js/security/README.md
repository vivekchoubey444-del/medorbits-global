
# MedOrbits JavaScript Security Utilities

**Directory:** `src/js/security/`  
**Purpose:** Shared client-side input validation, safe error handling, and accessible form feedback.

This directory contains reusable JavaScript security utilities for MedOrbits frontend applications. The modules help validate user input, display safe error messages, and handle API failures consistently.

> **Security boundary:** These utilities improve frontend reliability and user experience. They do not replace server-side validation, authorization, rate limiting, database constraints, or centralized backend error handling.

—

## 1. Directory Structure

```text
src/
└── js/
    └── security/
        ├── README.md
        ├── input-validation.js
        └── safe-errors.js
```

### Modules

| File | Responsibility |
|—|—|
| `input-validation.js` | Input validation, payload checks, accessible form errors, and form-validation helpers |
| `safe-errors.js` | Safe error normalization, HTTP error handling, correlation IDs, and error display |
| `README.md` | Security module documentation and integration guidance |

—

## 2. Requirements

- Modern browsers supporting JavaScript ES modules.
- A web server that serves JavaScript files with an appropriate MIME type.
- HTML forms with meaningful labels and accessible error containers.
- A backend that independently validates and authorizes every protected operation.

The modules use ES module imports and exports. Load them through `<script type=“module”>` or import them from another module.

Example:

```html
<script type=“module” src=“/src/js/security/input-validation.js”></script>
```

Use the correct public asset URL for your deployment. Do not expose private server files through the web server.

—

## 3. Input Validation

**File:** `input-validation.js`

The module provides reusable validation functions for common form fields and application payloads.

### Available validation areas

- Email addresses
- Telephone numbers
- Names and plain text
- Identifiers
- Numeric values
- Dates
- URLs
- MIME types and file metadata
- Password requirements
- Enumerated choices
- Application payloads
- Job payloads
- Form fields and form-level validation

The module also supports attaching validation behavior to forms and presenting field-level feedback.

### Importing validation helpers

Import only the functions your application needs. For example:

```javascript
import {
  validateEmail,
  validatePhone,
  validatePassword,
  validateApplicationPayload,
  validateJobPayload,
  validateForm
} from “/src/js/security/input-validation.js”;
```

**Important:** Confirm the exact exported names in `input-validation.js` before using this example. Importing a nonexistent named export causes the browser module to fail.

### Example: Validate an email address

```javascript
import {
  validateEmail
} from “/src/js/security/input-validation.js”;

const result = validateEmail(“student@example.com”);

if (!result.valid) {
  console.warn(“Enter a valid email address.”);
}
```

Adapt the result handling to the actual return shape of the exported validator.

### Example: Validate a form

Mark a form for validation using the module’s supported data attribute:

```html
<form id=“application-form” data-validate-form>
  <label for=“applicant-email”>Email address</label>

  <input
    id=“applicant-email”
    name=“email”
    type=“email”
    autocomplete=“email”
    required
  />

  <button type=“submit”>Continue</button>
</form>
```

Initialize the form using the exported form-initialization helper from `input-validation.js`. Check the implementation for the exact function name and whether automatic initialization is already included.

### Validation principles

1. Validate user input before submitting it.
2. Provide understandable, field-specific feedback.
3. Keep validation messages accessible to assistive technology.
4. Use `textContent` or equivalent safe text APIs for displaying messages.
5. Never treat client-side validation as authoritative.
6. Validate again on the server using the canonical application schema.
7. Apply strict allowlists to sensitive fields such as roles, statuses, course types, and workflow actions.

—

## 4. Safe Error Handling

**File:** `safe-errors.js`

This module standardizes frontend error handling and helps prevent internal exception details from leaking into the interface.

### Main functionality

| Function or class | Purpose |
|—|—|
| `SafeAppError` | Represents an application error with a controlled public message |
| `normalizeError()` | Converts supported error inputs into a normalized safe representation |
| `createHttpError()` | Creates an application error associated with an HTTP status |
| `toUserError()` | Produces a user-facing error representation |
| `fromResponse()` | Handles an HTTP response that represents a failure |
| `fromNetworkError()` | Handles network-level failures |
| `displayError()` | Displays an error using a safe DOM-based approach |
| `clearError()` | Clears an existing error display |
| `getCorrelationId()` | Retrieves a correlation identifier when available |
| `withCorrelationId()` | Adds a correlation identifier to supported request options |
| `reportSafeError()` | Sends sanitized diagnostic information to an optional reporting callback |
| `handleApiError()` | Provides a common API error-handling entry point |
| `handleCaughtError()` | Provides a common entry point for caught exceptions |

Refer to the source module for exact signatures, supported arguments, return shapes, and default values.

### Importing the module

```javascript
import {
  SafeAppError,
  normalizeError,
  createHttpError,
  toUserError,
  fromResponse,
  fromNetworkError,
  displayError,
  clearError,
  getCorrelationId,
  withCorrelationId,
  reportSafeError,
  handleApiError,
  handleCaughtError
} from “/src/js/security/safe-errors.js”;
```

Verify that every named export exists in the current implementation before deploying this import.

### Example: Handle a failed API response

```javascript
import {
  fromResponse,
  displayError
} from “/src/js/security/safe-errors.js”;

async function loadApplications() {
  const errorContainer = document.querySelector(
    “[data-error-container]”
  );

  try {
    const response = await fetch(“/api/applications”, {
      method: “GET”,
      credentials: “same-origin”,
      headers: {
        Accept: “application/json”
      }
    });

    if (!response.ok) {
      const safeError = fromResponse(response);

      if (errorContainer) {
        displayError(errorContainer, safeError);
      }

      return null;
    }

    return await response.json();
  } catch (error) {
    const safeError = fromNetworkError(error);

    if (errorContainer) {
      displayError(errorContainer, safeError);
    }

    return null;
  }
}
```

Adjust this example to the actual exported function signatures and return values. Do not assume a helper accepts a DOM element or that its return value has a particular shape without checking the implementation.

### Safe error-handling rules

- Do not display raw exception messages or stack traces to users.
- Do not expose SQL errors, file paths, internal URLs, environment variables, tokens, or credentials.
- Do not assume every `TypeError` or `SyntaxError` represents invalid user input.
- Treat unknown application exceptions as internal errors unless their type is explicitly and safely mapped.
- Display only controlled public messages.
- Log sanitized diagnostic details through an approved reporting mechanism.
- Do not log passwords, authentication cookies, access tokens, uploaded document contents, or unnecessary personal information.
- Avoid returning success-shaped fallback data after an API failure.
- Preserve actionable HTTP status and error-code information for application logic.

—

## 5. API Integration

Frontend error helpers should work with the existing MedOrbits API error contract.

A recommended JSON error response is:

```json
{
  “success”: false,
  “error”: {
    “code”: “VALIDATION_ERROR”,
    “message”: “Please check the submitted information.”,
    “requestId”: “req-example-123”
  }
}
```

This is an illustrative contract. The actual response format must match the backend’s centralized error middleware and OpenAPI specification.

### Recommended HTTP status mapping

| Status | Meaning | Frontend behavior |
|—|—|—|
| `400` | Invalid request | Show safe request feedback |
| `401` | Authentication required | Prompt the user to sign in |
| `403` | Permission denied | Show an access-denied message |
| `404` | Resource not found | Show a safe not-found message |
| `409` | Conflict or duplicate operation | Explain the conflict and offer an appropriate next step |
| `413` | Request or upload too large | Explain the configured size limit |
| `422` | Validation failure | Display relevant field feedback |
| `429` | Rate limit exceeded | Ask the user to wait before retrying |
| `500` | Internal server error | Show a generic error and reference ID when available |
| `502`, `503`, `504` | Upstream or service availability failure | Show a temporary service-unavailable message |

This table is guidance, not an assertion that the current backend implements every status mapping.

### Backend responsibilities

The Node.js or Python backend must independently enforce:

- Authentication and authorization
- Request schema validation
- Role and permission checks
- File content and size verification
- Database integrity constraints
- Rate limiting and abuse protection
- Safe error serialization
- Request correlation and audit logging
- Business rules and workflow transitions

Frontend validation can be bypassed by direct HTTP requests and modified browser code.

—

## 6. Security Requirements

### 6.1 Prevent DOM-based injection

Use safe DOM APIs when rendering messages:

```javascript
element.textContent = message;
```

Avoid injecting user-controlled values or server-provided error text through:

```javascript
element.innerHTML = message;
```

If rich HTML is genuinely required, use an established HTML sanitizer with an explicit allowlist. Plain-text errors should not require HTML rendering.

### 6.2 URL validation and SSRF

Browser-side URL validation does not prevent server-side request forgery (SSRF).

For server-side URL fetching:

- Allowlist permitted protocols and destinations.
- Reject loopback, private, link-local, and reserved IP ranges where appropriate.
- Resolve DNS and validate the resulting addresses.
- Revalidate redirects and prevent redirect-based bypasses.
- Apply connection and response timeouts.
- Restrict outbound network access where practical.

### 6.3 File validation

A browser-provided MIME type is untrusted metadata. For uploads, the backend must:

- Enforce an explicit file-size limit.
- Allowlist permitted file formats.
- Inspect file signatures or magic bytes where applicable.
- Reject unexpected content and malformed files.
- Generate safe server-side filenames.
- Store files outside executable web roots or in appropriately isolated object storage.
- Apply malware scanning when required by the threat model.
- Enforce access control when downloading or previewing private documents.

### 6.4 Password validation

Client-side password checks provide feedback only. Passwords must be verified on the server and stored using an appropriate password-hashing algorithm.

Never log passwords or include them in analytics, error reports, URLs, or correlation metadata.

### 6.5 Correlation IDs

Correlation IDs help connect frontend failures to backend logs. They are diagnostic identifiers, not authentication credentials.

- Validate their format and length.
- Do not use them as authorization tokens.
- Do not encode secrets or personal information in them.
- Generate trusted server-side request IDs when appropriate.
- Avoid relying on client-provided identifiers as proof of request origin.

### 6.6 Error reporting

Reporting callbacks should receive only the information needed for diagnostics. Sanitize data before transmission, restrict access to logs, and define appropriate retention policies.

Do not report full request bodies or uploaded documents by default.

—

## 7. Accessibility Requirements

Error messages should be perceivable without relying on color alone.

Recommended markup:

```html
<div
  data-error-container
  role=“alert”
  aria-live=“assertive”
  aria-atomic=“true”
></div>
```

For field-level errors, use a stable error element and connect it to the input using `aria-describedby`. Set `aria-invalid=“true”` when the field is invalid and clear it when validation succeeds.

Avoid moving focus unexpectedly during ordinary field validation. On failed form submission, focus the first invalid field when appropriate.

Confirm whether the existing `input-validation.js` helpers automatically set these attributes before duplicating the behavior in individual pages.

—

## 8. Integration With MedOrbits Pages

Use the security utilities for pages and forms such as:

- Student registration and login
- Application submissions
- Course and admission enquiries
- Job listings and recruitment applications
- Support tickets and refund requests
- Profile and account settings
- Official-document requests
- File upload forms
- Payment status and confirmation pages

For each workflow:

1. Import the required helpers.
2. Validate input before sending the request.
3. Disable duplicate submissions while a request is pending.
4. Handle unsuccessful HTTP responses separately from successful responses.
5. Show a safe, accessible message.
6. Preserve a request reference when available.
7. Re-enable controls after the operation finishes.
8. Rely on the backend for authoritative validation and authorization.

Do not store sensitive form contents in browser storage merely to preserve a failed submission.

—

## 9. Testing Checklist

Before deployment, verify the following.

### Input validation

- [ ] Valid and invalid email addresses are handled correctly.
- [ ] Phone validation matches the supported country and number formats.
- [ ] Required fields reject missing or empty values.
- [ ] Whitespace-only input is handled consistently.
- [ ] Numeric boundaries and malformed numbers are tested.
- [ ] Dates and enum values are checked against supported constraints.
- [ ] File-size and file-type restrictions are enforced on both client and server.
- [ ] Application and job payloads match the canonical backend schemas.
- [ ] Invalid input cannot bypass server-side validation.

### Error handling

- [ ] HTTP failures produce safe, understandable messages.
- [ ] Network failures are distinguished from server responses.
- [ ] Unknown exceptions do not expose internal details.
- [ ] A runtime `TypeError` is not automatically misclassified as a user validation error.
- [ ] Correlation IDs are preserved only in supported formats.
- [ ] Error reporting does not include secrets or unnecessary personal information.
- [ ] Error containers are updated safely using text APIs.
- [ ] Failed requests do not appear successful to the user.

### Accessibility and compatibility

- [ ] Form errors are associated with the relevant fields.
- [ ] Error announcements work with assistive technology.
- [ ] Keyboard-only navigation works.
- [ ] ES module imports resolve correctly in the deployed environment.
- [ ] Browser console errors are absent.
- [ ] Tests cover supported browsers and mobile layouts.

—

## 10. Maintenance Guidelines

When modifying these utilities:

1. Preserve existing public exports unless a migration is planned.
2. Update this README whenever exported APIs or behavior change.
3. Add unit tests for new validation rules and error mappings.
4. Keep frontend and backend validation rules aligned with canonical schemas.
5. Use explicit allowlists for public error codes and user-facing messages.
6. Avoid introducing dependencies solely for trivial validation.
7. Review error-reporting and redaction behavior whenever new fields are added.
8. Do not treat regular expressions or client-side sanitization as complete security controls.
9. Document browser support and any new runtime requirements.
10. Review security-sensitive changes before release.

—

## 11. Definition of Done

The security utilities are ready for integration when:

- [ ] All documented exports match the actual source code.
- [ ] Example imports and function signatures have been verified.
- [ ] Validation helpers have automated tests.
- [ ] Error handling covers HTTP, network, and unexpected failures.
- [ ] No raw stack traces or sensitive exception details reach the interface.
- [ ] Backend validation and authorization remain authoritative.
- [ ] Accessibility requirements are met.
- [ ] Documentation matches the deployed implementation.

**Final note:** This directory is a frontend security-support layer. Production security depends on coordinated controls across the browser, API, authentication system, database, file storage, logging infrastructure, and deployment environment.
