
# MedOrbits JavaScript Utilities

**Directory:** `src/js/utils/`  
**Purpose:** Shared, reusable JavaScript utilities for frontend configuration, data formatting, and input validation.

This directory provides common functionality used throughout MedOrbits, including education and admissions pages, application workflows, job listings, document services, dashboards, and support interfaces.

> **Security principle:** These utilities support frontend consistency and usability. They do not replace backend validation, authentication, authorization, or security controls.

—

## 1. Directory Structure

```text
src/
└── js/
    └── utils/
        ├── README.md
        ├── contants.js
        ├── formatters.js
        └── validators.js
```

### Module responsibilities

| File | Responsibility |
|—|—|
| `contants.js` | Centralized application constants, routes, API paths, status values, UI settings, and feature flags |
| `formatters.js` | Formatting for text, dates, currency, numbers, file sizes, statuses, lists, and pagination |
| `validators.js` | Reusable validation for strings, email addresses, telephone numbers, passwords, numbers, dates, URLs, files, and payloads |
| `README.md` | Module documentation, integration guidance, and maintenance requirements |

**Naming note:** `contants.js` is the requested filename. The conventional spelling is `constants.js`; if the filename is changed, update every import that references it.

—

## 2. Requirements

- A modern browser supporting JavaScript ES modules.
- A web server that serves JavaScript files with the correct MIME type.
- Correct public asset paths for the deployed MedOrbits application.
- Frontend and backend validation rules aligned with canonical API schemas.

These modules use ES module imports and exports.

Example:

```html
<script type=“module” src=“/src/js/utils/formatters.js”></script>
```

In production, ensure the `/src/` directory is intentionally exposed as a public asset directory or use the configured build output path.

—

## 3. Constants Module

**File:** `contants.js`

Centralizes shared values so application modules do not repeatedly define the same configuration.

### Main exports

- `APP` — application metadata and default locale settings.
- `ENVIRONMENT` — environment name constants.
- `ROUTES` — frontend route paths.
- `API` — API prefix, endpoint paths, and timeout settings.
- `HTTP` — HTTP methods, status codes, headers, and content types.
- `VALIDATION` — default field lengths, pagination limits, upload size, and permitted MIME types.
- `APPLICATION_STATUS` — application workflow status values.
- `JOB_STATUS` — job workflow status values.
- `USER_ROLE` — frontend role identifiers.
- `UI` — responsive breakpoints and interface timing values.
- `ACCESSIBILITY` — common accessibility role and live-region values.
- `STORAGE_KEYS` — keys for permitted browser preferences.
- `THEME` — visual theme settings.
- `I18N` — supported languages and right-to-left language identifiers.
- `ERROR_CODES` — application error identifiers.
- `FEATURES` — presentation-oriented feature flags.

Helper functions:

- `buildApiPath()`
- `getSupportedLanguage()`
- `isRtlLanguage()`
- `normalizePageSize()`
- `formatCurrency()`

The actual exports in `contants.js` are authoritative. Update this documentation when exports change.

### Example

```javascript
import {
  APP,
  ROUTES,
  HTTP,
  buildApiPath,
} from “/src/js/utils/contants.js”;

console.log(APP.NAME);
console.log(ROUTES.EDUCATION);
console.log(HTTP.STATUS.OK);

const applicationsEndpoint = buildApiPath(“APPLICATIONS”);
console.log(applicationsEndpoint);
```

### Configuration guidelines

1. Keep shared frontend constants in one location.
2. Avoid duplicating route paths and status identifiers.
3. Verify API endpoint paths against the actual backend router.
4. Keep frontend status values aligned with backend schemas.
5. Do not store secrets, private API keys, passwords, or credentials in frontend constants.
6. Do not use frontend role identifiers or feature flags as authorization controls.
7. Treat all values shipped to the browser as publicly accessible.

—

## 4. Formatting Module

**File:** `formatters.js`

Provides consistent display formatting for data returned by APIs or entered by users.

### Available formatting areas

| Area | Functions |
|—|—|
| Text | `formatText()`, `normalizeWhitespace()`, `truncateText()`, `formatPersonName()`, `formatIdentifier()`, `formatLabel()` |
| Numbers | `formatNumber()`, `formatCurrency()`, `formatPercentage()`, `formatCompactNumber()` |
| Dates | `formatDate()`, `formatDateTime()`, `formatTime()`, `formatISODate()`, `formatRelativeTime()` |
| Duration and files | `formatDuration()`, `formatFileSize()` |
| Contact details | `formatEmail()`, `formatPhone()`, `maskValue()` |
| Status labels | `formatApplicationStatus()`, `formatJobStatus()`, `formatUserRole()`, `getStatusClass()` |
| Collections | `formatList()`, `formatPaginationRange()` |

### Example: Format currency and dates

```javascript
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatFileSize,
} from “/src/js/utils/formatters.js”;

const fee = formatCurrency(125000, {
  locale: “en-IN”,
  currency: “INR”,
});

const applicationDate = formatDate(“2026-10-25T10:30:00Z”);

const submittedAt = formatDateTime(“2026-10-25T10:30:00Z”);

const documentSize = formatFileSize(1048576);

console.log(fee);
console.log(applicationDate);
console.log(submittedAt);
console.log(documentSize);
```

### Formatting rules

- Currency formatting does not perform currency conversion.
- Numeric timestamps are interpreted as milliseconds unless a function explicitly documents otherwise.
- Date formatting defaults to the configured time zone when supported by the function.
- File sizes use binary units: 1 KiB = 1024 bytes.
- Invalid or missing values generally return a configured fallback.
- Formatting functions do not establish whether a value is authentic or correct.
- Text formatting is not HTML sanitization.

### Rendering formatted text safely

Use `textContent` for untrusted text:

```javascript
import { formatText } from “/src/js/utils/formatters.js”;

const message = formatText(apiResponse.message, {
  fallback: “No message available”,
});

const container = document.querySelector(“[data-message]”);

if (container) {
  container.textContent = message;
}
```

Avoid inserting untrusted content through `innerHTML`.

—

## 5. Validation Module

**File:** `validators.js`

Provides reusable validation helpers for frontend forms and data workflows.

### Validation categories

- Required and optional strings
- Names and plain text
- Identifiers
- Email addresses
- Telephone numbers
- Passwords and password confirmation
- Numeric values and ranges
- Percentages and positive integers
- Dates and date ordering
- URLs
- Enumerated values and allowlists
- Application, job, and user-role statuses
- File metadata
- Pagination
- Application payloads
- Job payloads
- Cross-field comparisons
- Field collections

### Validation result format

Successful results generally follow this pattern:

```json
{
  “valid”: true,
  “value”: “student@example.com”,
  “message”: “”,
  “errors”: []
}
```

Failed results generally follow this pattern:

```json
{
  “valid”: false,
  “message”: “Enter a valid email address.”,
  “errors”: [
    {
      “code”: “INVALID_EMAIL”,
      “message”: “Enter a valid email address.”
    }
  ]
}
```

These are illustrative examples. Consult the actual function implementation for the exact return shape.

### Example: Validate an email address

```javascript
import {
  validateEmail,
} from “/src/js/utils/validators.js”;

const result = validateEmail(“student@example.com”);

if (result.valid) {
  console.log(“Email format is valid.”);
} else {
  console.log(result.message);
}
```

### Example: Validate an application payload

```javascript
import {
  validateApplicationPayload,
} from “/src/js/utils/validators.js”;

const payload = {
  name: “Aarav Sharma”,
  email: “student@example.com”,
  phone: “+919876543210”,
};

const result = validateApplicationPayload(payload);

if (!result.valid) {
  console.table(result.errors);
} else {
  // Continue with the API request.
  // The backend must independently validate the payload.
}
```

### Example: Validate multiple fields

```javascript
import {
  validateEmail,
  validateName,
  validateFields,
} from “/src/js/utils/validators.js”;

const result = validateFields([
  {
    name: “name”,
    value: “Aarav Sharma”,
    validator: validateName,
    options: {
      required: true,
    },
  },
  {
    name: “email”,
    value: “student@example.com”,
    validator: validateEmail,
    options: {
      required: true,
    },
  },
]);

if (!result.valid) {
  console.table(result.errors);
} else {
  console.log(“Validated values:”, result.value);
}
```

### Validation guidelines

1. Validate input before sending a request.
2. Use explicit allowlists for controlled fields.
3. Apply cross-field checks where business rules require them.
4. Keep validation messages understandable and accessible.
5. Match constraints to canonical backend schemas.
6. Do not assume that a syntactically valid value is authentic or authorized.
7. Never use client-side validation as the only enforcement layer.

—

## 6. Integration With the Security Modules

The utilities directory complements the existing security modules:

```text
src/
└── js/
    ├── security/
    │   ├── README.md
    │   ├── input-validation.js
    │   └── safe-errors.js
    └── utils/
        ├── README.md
        ├── contants.js
        ├── formatters.js
        └── validators.js
```

### Responsibility boundaries

| Module | Primary responsibility |
|—|—|
| `utils/contants.js` | Shared configuration and identifiers |
| `utils/formatters.js` | Display-oriented formatting |
| `utils/validators.js` | Reusable validation logic |
| `security/input-validation.js` | DOM forms, field-level feedback, and frontend form integration |
| `security/safe-errors.js` | Safe error normalization, presentation, and diagnostic handling |
| Backend middleware and schemas | Authoritative request validation, access control, and business rules |

Avoid implementing competing validation rules in multiple files. If the security form layer and shared validators both implement the same rule, keep their behavior consistent and test them together.

### Example combined workflow

```javascript
import {
  validateApplicationPayload,
} from “/src/js/utils/validators.js”;

import {
  formatText,
} from “/src/js/utils/formatters.js”;

async function submitApplication(payload) {
  const validation = validateApplicationPayload(payload);

  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  const response = await fetch(“/api/applications”, {
    method: “POST”,
    credentials: “same-origin”,
    headers: {
      Accept: “application/json”,
      “Content-Type”: “application/json”,
    },
    body: JSON.stringify(validation.value),
  });

  if (!response.ok) {
    return {
      success: false,
      message: “The application could not be submitted.”,
    };
  }

  const result = await response.json();

  return {
    success: true,
    message: formatText(result.message, {
      fallback: “Application submitted successfully.”,
    }),
    data: result,
  };
}
```

This is an illustrative integration example. Add the application’s actual CSRF protections, authentication requirements, safe-error handling, and response contract where applicable. A successful HTTP response should not be assumed to have a particular JSON shape without checking it.

—

## 7. Security Requirements

### Client-side validation

Client-side checks improve usability but can be bypassed through developer tools, modified scripts, or direct HTTP requests.

The backend must validate:

- Required fields and data types
- Maximum lengths and numeric bounds
- Enumerated values
- Application and job workflow transitions
- User permissions and roles
- File content, type, and size
- Business-specific eligibility requirements

### URL validation

A valid URL is not necessarily a trusted URL.

For backend systems that fetch user-provided URLs, implement SSRF protections, destination allowlists, DNS/IP validation, redirect controls, and request timeouts.

### File uploads

Browser-provided filenames, extensions, and MIME types are untrusted. The server must inspect uploaded content and enforce storage and download access controls.

### Error messages

Never expose raw stack traces, credentials, internal file paths, SQL details, or environment variables to users.

Use the safe error-handling layer for consistent messages and sanitized diagnostics.

### Personal information

Do not store passwords, access tokens, authentication cookies, or private document contents in browser storage through utility functions.

Masking a value is a display convenience, not an authorization or data-protection boundary.

—

## 8. Testing Checklist

### Constants

- [ ] Exported names match actual imports.
- [ ] Route paths match the deployed application.
- [ ] API paths match backend routers.
- [ ] Status values match API schemas.
- [ ] No private secrets are included.

### Formatters

- [ ] Missing and invalid values use appropriate fallbacks.
- [ ] Currency and locale formatting work as expected.
- [ ] Time-zone behavior is tested.
- [ ] Date-only values do not shift unexpectedly.
- [ ] Numeric timestamps use the documented units.
- [ ] File sizes handle zero, negative, and large values.
- [ ] Untrusted text is rendered through safe DOM APIs.
- [ ] Status classes cannot be used to inject arbitrary CSS or HTML.

### Validators

- [ ] Required fields reject missing values.
- [ ] Boundary conditions are tested.
- [ ] Email and telephone formats cover supported use cases.
- [ ] Password confirmation handles mismatches.
- [ ] Date validation rejects invalid calendar dates.
- [ ] URL validation rejects unsupported protocols.
- [ ] File restrictions are enforced again on the backend.
- [ ] Application and job payloads match canonical schemas.
- [ ] Cross-field constraints are enforced.
- [ ] Invalid data cannot bypass server-side validation.

### Integration

- [ ] ES module paths resolve in development and production.
- [ ] No missing-export errors appear in the browser console.
- [ ] Form errors are accessible.
- [ ] API failures are handled without leaking internal details.
- [ ] Automated tests run in CI.

—

## 9. Maintenance Guidelines

When modifying this directory:

1. Preserve existing exports unless a migration is planned.
2. Update documentation when public APIs change.
3. Keep the constants, formatter, and validator interfaces consistent.
4. Align payload validation with `/api/schemas/application.schema.json` and `/api/schemas/job.schema.json`.
5. Add unit tests for new behavior and edge cases.
6. Review security implications before accepting new URL, file, or status rules.
7. Avoid duplicating the same business rule across unrelated modules.
8. Document any browser compatibility requirements.
9. Use explicit error codes for predictable validation failures.
10. Verify imports and examples against the actual implementation before release.

—

## 10. Definition of Done

The utilities directory is ready for integration when:

- [ ] All documented exports exist.
- [ ] Imports resolve using the correct case-sensitive paths.
- [ ] Date, currency, and locale behavior is verified.
- [ ] Validation results are handled consistently.
- [ ] Canonical backend schemas remain authoritative.
- [ ] Frontend error rendering is safe and accessible.
- [ ] Unit tests cover expected and malformed inputs.
- [ ] Documentation reflects the deployed code.

**Final note:** These utilities establish a common frontend foundation for MedOrbits. Production security depends on consistent enforcement across frontend modules, backend middleware, schemas, authentication, authorization, storage, and deployment configuration.
