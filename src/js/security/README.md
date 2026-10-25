
# MedOrbits JavaScript Security Utilities

**Directory:** `src/js/security/`  
**Purpose:** Shared frontend input validation, safe error handling, and accessible form feedback.  
**Modules:** `input-validation.js`, `safe-errors.js`  
**Runtime:** Modern browsers with ES module support.

—

## 1. Overview

The MedOrbits JavaScript security utilities provide reusable helpers for validating form input, checking application and job payloads, displaying accessible validation errors, normalizing API failures, and attaching correlation IDs to requests.

These modules are designed for use across MedOrbits education, medical admissions, careers, recruitment, application, and document workflows.

### Security boundary

These utilities are a frontend support layer. They do not replace:

- Server-side request validation
- Authentication and authorization
- Database constraints and parameterized queries
- Rate limiting and abuse prevention
- File signature verification and malware scanning
- CSRF protection where applicable
- Backend error handling and audit logging

Never rely on browser-side validation to protect a backend endpoint.

—

## 2. Directory Structure

```text
src/
└── js/
    └── security/
        ├── README.md
        ├── input-validation.js
        └── safe-errors.js
```

| File | Responsibility |
|—|—|
| `input-validation.js` | Input validators, payload checks, file metadata checks, and accessible form validation |
| `safe-errors.js` | Safe error normalization, HTTP and network error handling, correlation IDs, and error display |
| `README.md` | Integration instructions, security boundaries, and testing guidance |

Keep this documentation synchronized with the actual source exports and backend API contract.

—

## 3. Requirements and Module Loading

Use a web server that serves JavaScript files with the correct MIME type. Load the modules through ES module imports.

Example:

```html
<script type=“module”>
  import {
    validateEmail,
    initializeFormValidation
  } from “/src/js/security/input-validation.js”;

  initializeFormValidation();

  console.log(validateEmail(“student@example.com”));
</script>
```

Use the correct public asset URL for your deployment. Confirm that the web server exposes only intended frontend assets and does not publish private server-side source files or configuration.

Do not use typographic quotation marks in JavaScript, HTML attributes, import paths, or JSON.

—

## 4. Input Validation

**Module:** `input-validation.js`

### 4.1 Public exports

The module currently exports these named functions:

| Export | Purpose |
|—|—|
| `normalizeWhitespace()` | Collapse repeated whitespace and trim a string |
| `normalizeEmail()` | Validate and normalize an email address |
| `validateEmail()` | Check email syntax and length |
| `validatePhone()` | Check phone syntax and digit count |
| `validateName()` | Check a human-readable name |
| `validateText()` | Check text length, required status, and supported characters |
| `validateIdentifier()` | Check identifier syntax and length |
| `validateNumber()` | Check finite numeric values and optional bounds |
| `validateDate()` | Validate a real `YYYY-MM-DD` calendar date |
| `validateUrl()` | Check URL syntax, protocol, and selected hostname restrictions |
| `validateMimeType()` | Check a declared MIME type against an allowlist |
| `validateFile()` | Check file metadata, size, and declared MIME type |
| `validateChoice()` | Check a value against allowed choices |
| `validatePassword()` | Apply configurable password length and complexity rules |
| `validateApplicationPayload()` | Check supported application fields and selected field constraints |
| `validateJobPayload()` | Check supported job fields and selected field constraints |
| `validateField()` | Validate an individual form control |
| `validateForm()` | Validate eligible controls in a form |
| `attachFormValidation()` | Attach validation event listeners to a form |
| `detachFormValidation()` | Remove listeners installed by the module |
| `initializeFormValidation()` | Attach validation to forms marked `data-validate-form` |

The default export contains these same utility functions.

### 4.2 Validation result

Most validators return a frozen object in this format:

```javascript
{
  valid: false,
  message: “Enter a valid email address.”,
  code: “invalid_email”
}
```

- `valid` indicates whether the input passed the relevant check.
- `message` contains user-facing feedback.
- `code` provides a stable, machine-readable validation category.

Successful results generally use empty `message` and `code` strings.

Configuration errors may throw exceptions rather than return validation results. Handle invalid configuration separately from invalid user input.

### 4.3 Validate an email address

```javascript
import {
  validateEmail,
  normalizeEmail
} from “/src/js/security/input-validation.js”;

const result = validateEmail(“student@example.com”);

if (!result.valid) {
  console.warn(result.message);
} else {
  const normalizedEmail = normalizeEmail(“student@example.com”);
  // Continue with the application workflow.
}
```

Email syntax validation does not establish mailbox ownership or existence. Verify addresses through the appropriate account or application workflow when necessary.

### 4.4 Validate application and job payloads

```javascript
import {
  validateApplicationPayload,
  validateJobPayload
} from “/src/js/security/input-validation.js”;

const application = {
  full_name: “Aarav Sharma”,
  email: “student@example.com”,
  course: “MBBS”,
  consent: true
};

const applicationResult = validateApplicationPayload(application);

if (!applicationResult.valid) {
  console.warn(applicationResult.code, applicationResult.message);
}

const job = {
  title: “Junior Software Engineer”,
  description: “Develop and maintain application features.”,
  employment_type: “full_time”,
  location: “Noida, Uttar Pradesh”
};

const jobResult = validateJobPayload(job);

if (!jobResult.valid) {
  console.warn(jobResult.code, jobResult.message);
}
```

These checks are intentionally limited. Confirm that field allowlists, required fields, enums, and business constraints match the canonical backend schemas.

The payload validators return validation results; they do not sanitize, authorize, or transform the original payload.

### 4.5 Accessible form integration

Mark forms for validation using `data-validate-form`:

```html
<form id=“application-form” data-validate-form>
  <div data-validation-summary hidden></div>

  <label for=“applicant-name”>Full name</label>
  <input
    id=“applicant-name”
    name=“full_name”
    type=“text”
    data-validation=“name”
    autocomplete=“name”
    required
    aria-describedby=“applicant-name-error”
  >
  <p
    id=“applicant-name-error”
    data-error-for=“full_name”
    hidden
  ></p>

  <label for=“applicant-email”>Email address</label>
  <input
    id=“applicant-email”
    name=“email”
    type=“email”
    data-validation=“email”
    autocomplete=“email”
    required
    aria-describedby=“applicant-email-error”
  >
  <p
    id=“applicant-email-error”
    data-error-for=“email”
    hidden
  ></p>

  <button type=“submit”>Continue</button>
</form>

<script type=“module”>
  import {
    initializeFormValidation
  } from “/src/js/security/input-validation.js”;

  initializeFormValidation();
</script>
```

Initialize after the relevant form elements exist in the DOM. Calling `initializeFormValidation()` more than once can attach new listeners after the previous listeners are detached and replaced.

The helper prevents normal form submission when validation fails. It does not send the request or replace the application’s submit handler.

### 4.6 Validation attributes

Supported `data-validation` values include:

- `email`
- `phone`
- `name`
- `url`
- `number`
- `date`
- `identifier`
- `password`

Other text controls use generic text validation.

File controls can use `data-allowed-types` and `data-max-bytes`:

```html
<input
  id=“support-document”
  name=“document”
  type=“file”
  data-allowed-types=“application/pdf”
  data-max-bytes=“10485760”
  required
>
```

The file check examines browser-provided metadata. It does not inspect file contents.

—

## 5. Safe Error Handling

**Module:** `safe-errors.js`

### 5.1 Public exports

| Export | Purpose |
|—|—|
| `SafeAppError` | Application error with a controlled public message |
| `normalizeError()` | Convert supported errors to a normalized representation |
| `createHttpError()` | Create a normalized application error associated with an HTTP status |
| `toUserError()` | Produce a user-facing error response |
| `fromResponse()` | Normalize a failed HTTP response |
| `fromNetworkError()` | Normalize network failures and aborts |
| `displayError()` | Display a safe message using DOM text APIs |
| `clearError()` | Clear and hide an error element |
| `getCorrelationId()` | Validate or generate a correlation ID |
| `withCorrelationId()` | Add an `X-Correlation-ID` header |
| `reportSafeError()` | Send a limited diagnostic record to an optional callback |
| `handleApiError()` | Produce a normalized API error response |
| `handleCaughtError()` | Convert a caught error into a user-facing error response |

The default export provides these functions and the `SafeAppError` class.

### 5.2 Handle a failed API response

```javascript
import {
  fromResponse,
  fromNetworkError,
  displayError
} from “/src/js/security/safe-errors.js”;

export async function loadApplications() {
  const errorContainer = document.querySelector(“[data-error-container]”);

  try {
    const response = await fetch(“/api/applications”, {
      method: “GET”,
      credentials: “same-origin”,
      headers: {
        Accept: “application/json”
      }
    });

    if (!response.ok) {
      const safeError = await fromResponse(response);

      if (errorContainer) {
        displayError(errorContainer, safeError);
      }

      return null;
    }

    if (errorContainer) {
      errorContainer.textContent = “”;
      errorContainer.hidden = true;
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

This example returns `null` on failure as an explicit application convention. Callers must distinguish that outcome from a successful response. If `null` is a valid success value in your API, use a discriminated result object instead.

`fromResponse()` is asynchronous and must be awaited. It returns a normalized error record, not a successful API response.

### 5.3 Display safe errors

```html
<div
  data-error-container
  role=“alert”
  aria-live=“assertive”
  aria-atomic=“true”
  hidden
></div>
```

```javascript
import {
  displayError,
  clearError,
  toUserError
} from “/src/js/security/safe-errors.js”;

const container = document.querySelector(“[data-error-container]”);

if (container) {
  displayError(
    container,
    toUserError(new Error(“Internal implementation details”))
  );
}

// When the error is resolved:
if (container) {
  clearError(container);
}
```

`displayError()` uses `textContent`; it does not interpret the message as HTML. The UI should display only controlled, user-safe messages.

### 5.4 Error classification

The current implementation supports stable codes such as:

- `BAD_REQUEST`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `REQUEST_TIMEOUT`
- `CONFLICT`
- `PAYLOAD_TOO_LARGE`
- `UNSUPPORTED_MEDIA_TYPE`
- `VALIDATION_ERROR`
- `RATE_LIMITED`
- `INTERNAL_ERROR`
- `UPSTREAM_ERROR`
- `SERVICE_UNAVAILABLE`
- `UPSTREAM_TIMEOUT`
- `NETWORK_ERROR`
- `ABORTED`
- `UNKNOWN_ERROR`

Do not assume that every error class identifies a user mistake. In particular, a runtime `TypeError` or `SyntaxError` can indicate a programming defect. Review the current `normalizeError()` behavior before using it for production error classification.

Never display raw exception messages or stack traces to end users.

—

## 6. Correlation IDs

Correlation IDs connect frontend requests with backend logs. They are diagnostic metadata, not authentication or authorization credentials.

### 6.1 Add a correlation header

```javascript
import {
  getCorrelationId,
  withCorrelationId
} from “/src/js/security/safe-errors.js”;

const correlationId = getCorrelationId();

const headers = withCorrelationId(
  {
    Accept: “application/json”
  },
  correlationId
);

const response = await fetch(“/api/applications”, {
  method: “GET”,
  credentials: “same-origin”,
  headers
});
```

`withCorrelationId()` supports a `Headers` instance or a plain object of header values. For plain objects, the helper adds the canonical `X-Correlation-ID` key; avoid passing conflicting header names with different casing.

The backend should validate incoming identifiers and establish a trusted request identifier for logging. Do not trust a client-supplied correlation ID as proof of request authenticity.

### 6.2 Logging and reporting

`reportSafeError()` sends only a limited diagnostic record to the supplied callback:

```javascript
import {
  reportSafeError
} from “/src/js/security/safe-errors.js”;

reportSafeError(error, (event) => {
  // Send only approved diagnostic fields to your reporting service.
  // Apply access controls, retention limits, and server-side validation.
  console.warn(“Application error code:”, event.code);
});
```

The module does not automatically transmit errors to an external provider. Avoid adding passwords, tokens, request bodies, document contents, or unnecessary personal information to reporting callbacks.

—

## 7. Recommended API Error Contract

A consistent backend error response can follow this pattern:

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

This is a recommended contract, not a claim that the current backend already returns this exact shape.

Align the Node.js or Python error middleware, OpenAPI schema, and frontend helpers before relying on fields such as `requestId`, `correlationId`, `status`, or `retryable`.

The current `safe-errors.js` reads `x-correlation-id` and `x-request-id` response headers. It does not directly adopt arbitrary server-provided error messages.

### Recommended status handling

| HTTP status | Meaning | Recommended UI behavior |
|—|—|—|
| `400` | Invalid request | Show safe request feedback |
| `401` | Authentication required | Prompt the user to sign in |
| `403` | Permission denied | Show an access-denied message |
| `404` | Resource not found | Show safe not-found feedback |
| `409` | Conflict | Explain the conflict and provide a relevant next step |
| `413` | Content too large | Explain the configured upload or request limit |
| `415` | Unsupported content type | Explain permitted formats |
| `422` | Validation failure | Show field-level feedback where available |
| `429` | Rate limit exceeded | Ask the user to wait before retrying |
| `500` | Internal server error | Show a generic message and reference ID when available |
| `502`–`504` | Upstream or service failure | Show temporary service-unavailable feedback |

The frontend must not assume that a response’s status code or body is trustworthy evidence of authorization.

—

## 8. Security Requirements

### 8.1 DOM safety

Use text APIs for plain-text messages:

```javascript
element.textContent = message;
```

Avoid:

```javascript
element.innerHTML = message;
```

If rich HTML is genuinely required, use a maintained HTML sanitizer with a restrictive allowlist.

### 8.2 Server-side validation

The backend must independently validate all incoming data. Use canonical schemas and explicit allowlists for roles, statuses, course types, workflow actions, and other security-sensitive fields.

### 8.3 File uploads

The backend must enforce file-size limits, inspect file contents, generate safe filenames, isolate uploaded files, and apply malware scanning where appropriate. Browser MIME types and file extensions are not proof of file safety.

### 8.4 URLs and SSRF

Browser URL validation does not prevent server-side request forgery. Server-side URL fetching requires destination allowlists or equivalent controls, private and reserved address restrictions, DNS validation, redirect checks, connection timeouts, and suitable outbound network restrictions.

### 8.5 Passwords and credentials

Never log or report passwords, session cookies, authentication tokens, or complete credential-bearing request objects. Enforce password policy on the server and store passwords using a suitable password-hashing algorithm.

### 8.6 Error reporting

Expose only controlled public messages. Keep detailed diagnostics in protected logging infrastructure, with appropriate access controls and retention policies.

—

## 9. Accessibility

- Associate each field error with the corresponding control through `aria-describedby`.
- Set `aria-invalid=“true”` when a field fails validation.
- Clear the invalid state and stale error text when validation succeeds.
- Use a validation summary for form-level feedback.
- Do not rely on color alone to communicate errors.
- Focus the first invalid field after failed submission when appropriate.
- Avoid moving focus during ordinary input events.
- Test keyboard navigation and screen-reader announcements.

The existing form helpers set field-level ARIA attributes when matching error elements are present. Ensure the markup’s error selectors match the control’s `name` or `id`.

—

## 10. Integration Checklist

Use these modules consistently across:

- Student registration and login
- Medical admission applications
- Course enquiries
- Job listings and recruitment applications
- Support and refund requests
- Account settings and profile updates
- Official-document requests
- File upload forms
- Payment status and confirmation pages

For each workflow:

1. Import the required helpers.
2. Validate form input before submission.
3. Prevent duplicate submissions while requests are pending.
4. Handle unsuccessful HTTP responses separately from successful responses.
5. Display safe, accessible error messages.
6. Preserve a validated request reference when available.
7. Restore controls after completion or failure.
8. Enforce validation, authentication, and authorization on the server.

Do not store sensitive form contents in browser storage merely to preserve a failed submission.

—

## 11. Testing Checklist

### Input validation

- [ ] Valid and invalid email formats
- [ ] Phone syntax and digit-count boundaries
- [ ] Required and whitespace-only values
- [ ] Numeric limits, malformed numbers, and integer constraints
- [ ] Valid and impossible calendar dates
- [ ] URL protocols and embedded credentials
- [ ] MIME-type allowlists and file-size limits
- [ ] Password policy boundaries
- [ ] Unknown application and job fields
- [ ] Application and job schema alignment
- [ ] Server-side rejection of invalid requests

### Safe errors

- [ ] HTTP and network failures are handled separately
- [ ] Unknown exceptions do not expose internal details
- [ ] Runtime errors are not automatically misclassified as user input errors
- [ ] Correlation IDs are bounded and validated
- [ ] Reporting callbacks receive only approved fields
- [ ] Error messages are rendered through text APIs
- [ ] Failed requests cannot appear successful
- [ ] Response parsing failures are handled safely

### Accessibility and compatibility

- [ ] Error elements are associated with their fields
- [ ] Screen-reader announcements are appropriate
- [ ] Keyboard-only navigation works
- [ ] ES module paths resolve in deployment
- [ ] Browser console errors are absent
- [ ] Mobile form layouts remain usable

Recommended test locations:

```text
tests/
└── js/
    └── security/
        ├── input-validation.test.js
        └── safe-errors.test.js
```

Use the test runner configured by the MedOrbits repository. Do not mark these checks complete until the corresponding automated tests have actually passed.

—

## 12. Maintenance

1. Preserve existing public exports unless a migration is planned.
2. Update documentation when signatures, result shapes, or defaults change.
3. Add tests for new validation rules and error mappings.
4. Keep frontend and backend schemas aligned.
5. Use explicit allowlists for public error codes and messages.
6. Avoid unnecessary dependencies.
7. Review redaction and reporting behavior when new fields are introduced.
8. Document supported browser versions.
9. Review security-sensitive changes before release.
10. Confirm the production build serves only intended public assets.

—

## 13. Definition of Done

- [ ] Documented exports match the source modules.
- [ ] Example imports and function signatures are verified.
- [ ] Automated unit tests cover validation and error handling.
- [ ] HTTP, network, and unexpected failures are handled distinctly.
- [ ] No raw stack traces or sensitive exception details reach the UI.
- [ ] Backend validation and authorization remain authoritative.
- [ ] Accessibility checks pass.
- [ ] Documentation matches the deployed implementation.

**Final principle:** MedOrbits frontend security utilities improve consistency and usability. Production security depends on coordinated controls across the browser, API, authentication system, database, file storage, logging infrastructure, and deployment environment.
