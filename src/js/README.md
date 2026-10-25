
# MedOrbits — Frontend JavaScript Architecture

**Directory:** `/src/js/`

MedOrbits uses a modular JavaScript architecture to support authentication, education and admission workflows, application management, document handling, API communication, validation, accessibility, and user-interface interactions.

The codebase should remain modular, maintainable, accessible, and consistent with the backend API contracts.

—

## 1. Directory Structure

```text
src/
└── js/
    ├── README.md
    │
    ├── config/
    │   ├── app.config.js
    │   ├── api.config.js
    │   └── environment.config.js
    │
    ├── utils/
    │   ├── contants.js
    │   ├── formatters.js
    │   ├── validators.js
    │   └── README.md
    │
    ├── services/
    │   ├── api.services.js
    │   ├── auth.services.js
    │   ├── application.services.js
    │   ├── document.services.js
    │   └── README.md
    │
    ├── security/
    │   ├── input-validation.js
    │   └── safe-errors.js
    │
    ├── components/
    │   ├── header.js
    │   ├── footer.js
    │   ├── navigation.js
    │   ├── modal.js
    │   ├── toast.js
    │   ├── dropdown.js
    │   └── pagination.js
    │
    ├── modules/
    │   ├── authentication/
    │   ├── education/
    │   ├── admissions/
    │   ├── applications/
    │   ├── documents/
    │   ├── careers/
    │   ├── jobs/
    │   ├── notifications/
    │   └── support/
    │
    ├── pages/
    │   ├── home.page.js
    │   ├── education.page.js
    │   ├── admissions.page.js
    │   ├── applications.page.js
    │   ├── official-documents.page.js
    │   └── support.page.js
    │
    ├── state/
    │   ├── app-state.js
    │   ├── session-state.js
    │   └── ui-state.js
    │
    ├── accessibility/
    │   ├── focus-management.js
    │   └── announcements.js
    │
    ├── analytics/
    │   └── analytics.js
    │
    ├── main.js
    └── bootstrap.js
```

**Note:** This is a recommended architecture, not a claim that every listed file already exists. Preserve the actual repository structure and create additional modules only when needed.

—

## 2. Architectural Principles

The frontend follows these principles:

1. **Separation of concerns:** UI components, page initialization, domain workflows, API operations, and utilities remain distinct.
2. **Single responsibility:** Each module should have a clear purpose.
3. **Explicit dependencies:** Prefer ES module imports over implicit global variables.
4. **Reusable services:** Centralize HTTP transport and share domain operations.
5. **Defensive validation:** Validate user input before submission and independently validate it on the backend.
6. **Progressive enhancement:** Essential content should remain understandable when nonessential JavaScript fails.
7. **Accessibility:** Support keyboard navigation, visible focus, accessible names, and screen-reader announcements.
8. **Responsive behavior:** Support mobile, tablet, and desktop layouts.
9. **Consistent design:** Reuse shared UI patterns and the MedOrbits midnight-sapphire design system.
10. **Security by design:** Never trust client-side authorization, hidden fields, or browser-supplied ownership information.

—

## 3. Core Modules

### `main.js`

Application entry point.

Responsibilities:

- Import application bootstrap logic.
- Start shared frontend initialization.
- Avoid page-specific behavior that belongs in individual page modules.

Example:

```javascript
import { bootstrapApp } from “./bootstrap.js”;

bootstrapApp().catch((error) => {
  console.error(“MedOrbits initialization failed.”, {
    message: error?.message || “Unknown initialization error”,
  });
});
```

Use this example only if `bootstrap.js` exports the specified function.

### `bootstrap.js`

Initializes shared frontend functionality.

Potential responsibilities:

- Initialize common navigation and footer interactions.
- Configure form validation.
- Set up shared accessibility helpers.
- Initialize page-specific functionality based on the current page.
- Register global error handling where appropriate.

Avoid registering duplicate event listeners when initialization runs more than once.

### `utils/`

Provides reusable, framework-independent helpers.

| File | Responsibility |
|—|—|
| `contants.js` | Application constants, routes, API endpoints, enums, and configuration values |
| `formatters.js` | Date, number, currency, text, status, and file-size formatting |
| `validators.js` | Reusable validation functions |

Import shared utilities rather than redefining the same rules across multiple modules.

Example:

```javascript
import {
  formatCurrency,
  formatDate,
  formatFileSize,
} from “./utils/formatters.js”;
```

Use the existing filename `contants.js` until the filename and all dependent imports are deliberately migrated together.

### `services/`

Provides centralized API communication and domain operations.

| File | Responsibility |
|—|—|
| `api.services.js` | HTTP requests, response parsing, timeout handling, and transport errors |
| `auth.services.js` | Login, registration, session, logout, and account recovery |
| `application.services.js` | Application retrieval, creation, updates, and status operations |
| `document.services.js` | Document metadata, uploads, downloads, and application-document associations |

See [`services/README.md`](./services/README.md) for detailed conventions.

### `security/`

Contains frontend security and validation helpers.

| File | Responsibility |
|—|—|
| `input-validation.js` | Form validation and input-validation helpers |
| `safe-errors.js` | Safe error normalization and user-facing error messages |

These modules improve frontend safety and usability. They do not replace backend request validation, authorization, CSRF protection, file inspection, or centralized error handling.

—

## 4. Module Responsibilities

### Components

Components provide reusable interface behavior, such as:

- Navigation menus.
- Modal dialogs.
- Toast notifications.
- Dropdown menus.
- Pagination controls.
- Shared header and footer interactions.

Components should have clear initialization and cleanup behavior. Prefer DOM APIs and `textContent` for displaying untrusted text. Avoid inserting untrusted data through `innerHTML`.

### Domain modules

Domain modules coordinate feature-specific interactions.

Examples:

- Authentication forms call `auth.services.js`.
- Admission forms call `application.services.js`.
- Document pages call `document.services.js`.
- Job-search interfaces use the relevant job or search service.
- Support pages use a dedicated support service once its backend contract exists.

Domain modules should not duplicate transport-layer logic.

### Page modules

Page modules initialize behavior specific to a page.

For example, an official-documents page may initialize filters, pagination, document downloads, and accessible loading states.

Avoid placing all site functionality inside a single large JavaScript file.

### State modules

State modules may centralize shared frontend state when necessary.

Recommended state categories include:

- Authentication/session state.
- UI state, such as active navigation and modal visibility.
- Temporary search and filtering state.

Do not store passwords, private document contents, or long-lived authentication tokens in ordinary browser storage.

—

## 5. Import and Export Conventions

Use ES modules with explicit file extensions.

```javascript
import { apiClient } from “./services/api.services.js”;

import {
  validateEmail,
  validateApplicationPayload,
} from “./utils/validators.js”;

import {
  formatDate,
  formatCurrency,
} from “./utils/formatters.js”;
```

Prefer named exports for reusable functions and classes. Use default exports when a module intentionally exposes one primary service or object.

Avoid:

- Unnecessary global variables.
- Circular dependencies.
- Duplicate implementations of shared utilities.
- Hardcoded API base URLs in page modules.
- Importing modules solely for side effects without documenting the reason.

—

## 6. API Integration

Use the centralized API client and domain services.

Example:

```javascript
import {
  applicationService,
} from “./services/application.services.js”;

export async function loadApplications() {
  try {
    const result = await applicationService.listApplications({
      page: 1,
      pageSize: 20,
    });

    return result;
  } catch (error) {
    // Translate the failure into an accessible UI message.
    // Do not expose stack traces or internal server details.
    throw error;
  }
}
```

Confirm method signatures and response formats against the implemented services.

The frontend API contract must agree with:

- Express route definitions.
- Request and response schemas.
- Authentication middleware.
- Authorization rules.
- `/api/openapi.yaml`, where applicable.

Do not assume a route exists because a frontend module references it.

—

## 7. Form Validation

Use shared validators for consistent field behavior.

Recommended validation coverage:

- Required fields.
- Email and phone formats.
- Password requirements.
- String length limits.
- Numeric ranges.
- Date validity and ordering.
- Supported status values.
- File size and allowed file types.
- Application and job payloads.

Example:

```javascript
import {
  validateEmail,
} from “./utils/validators.js”;

const result = validateEmail(emailInput.value);

if (!result.valid) {
  // Display result.message next to the relevant field.
  // Associate the message with the field for assistive technology.
}
```

Validation messages should be specific, actionable, and accessible.

The backend must repeat validation for every submitted request.

—

## 8. Accessibility Requirements

All interactive modules should support:

- Keyboard navigation.
- Visible focus indicators.
- Semantic HTML.
- Accessible labels and descriptions.
- Appropriate `aria-expanded` and `aria-controls` attributes.
- Screen-reader announcements for meaningful status changes.
- Focus management in modal dialogs.
- Reduced-motion preferences.
- Sufficient color contrast.

Use live regions for asynchronous feedback when appropriate.

Do not rely on color alone to communicate errors, status, or selection.

—

## 9. Performance Requirements

- Load page-specific modules only where needed.
- Use `defer` or module scripts appropriately.
- Debounce expensive search input handlers.
- Cancel obsolete requests when practical.
- Avoid unnecessary DOM queries and repeated event registration.
- Paginate large result sets.
- Avoid downloading document files until requested.
- Avoid blocking the main thread with expensive computations.
- Respect `prefers-reduced-motion`.
- Keep console diagnostics free of sensitive information.

Use caching only where the resource’s privacy, freshness, and authorization requirements permit it.

—

## 10. Security Requirements

The frontend must never be treated as the security boundary.

- Never embed server secrets or private API keys in frontend files.
- Never trust user roles or resource ownership supplied by the browser.
- Never use `localStorage` as the primary store for session credentials.
- Use secure session cookies and appropriate CSRF defenses where required.
- Validate and authorize protected operations on the backend.
- Avoid rendering untrusted content as HTML.
- Validate uploaded file contents on the server.
- Restrict access to sensitive documents.
- Use HTTPS in production.
- Avoid logging credentials, tokens, personal documents, or sensitive form fields.
- Apply rate limits and abuse controls on the backend.

For security-sensitive workflows, server-side enforcement is mandatory even if the frontend disables or hides the relevant control.

—

## 11. Error Handling

Use the shared API error and safe-error utilities.

Recommended UI behavior:

| Situation | UI response |
|—|—|
| Validation failure | Show field-specific guidance |
| Authentication expired | Request sign-in when appropriate |
| Permission denied | Show a safe access-denied message |
| Resource not found | Explain that the resource is unavailable |
| Network failure | Offer a retry where appropriate |
| Timeout | Explain that the request took too long |
| Unexpected failure | Show a generic error and provide a support route |

Do not expose raw backend exceptions, stack traces, SQL errors, server paths, or secrets.

Log only the diagnostic information permitted by the project’s privacy and monitoring policies.

—

## 12. Testing Strategy

### Unit tests

Test individual functions and modules:

- Formatting and validation utilities.
- API URL construction.
- Error normalization.
- Form validation behavior.
- State transitions.
- Component initialization and cleanup.

### Integration tests

Test interactions between:

- Page modules and services.
- Services and the API client.
- Authentication and protected routes.
- Application workflows and document associations.
- Loading, empty, error, and success states.

### Accessibility tests

Verify:

- Keyboard-only operation.
- Form label associations.
- Error announcements.
- Modal focus management.
- Reduced-motion behavior.
- Contrast and visible focus.

### Security tests

Verify that backend permissions remain effective when requests bypass frontend checks. Test unauthorized document access, invalid payloads, oversized uploads, and prohibited state transitions.

—

## 13. Environment and Deployment

Keep environment-specific configuration separate from business logic.

Recommended practices:

- Use the existing project configuration conventions.
- Do not expose server-only environment variables to browser bundles.
- Use same-origin relative API paths when the deployment architecture supports them.
- Configure production CORS and credentials on the server.
- Ensure the deployed server serves the correct JavaScript MIME type.
- Confirm that ES module paths and filename casing work on the production filesystem.
- Verify cache headers and asset versioning during deployments.

If `API.BASE_URL` is empty, confirm that the frontend and backend are deployed under compatible origins or configure the API base URL through the project’s approved build configuration.

—

## 14. Adding a New Module

Before adding a module:

1. Identify its responsibility and owning feature.
2. Check whether an existing utility or service already provides the behavior.
3. Define its public exports.
4. Reuse shared constants and validators.
5. Keep network communication inside services.
6. Implement accessible loading, success, empty, and error states.
7. Add tests for expected behavior and failure cases.
8. Verify backend route and schema compatibility.
9. Update the relevant README.
10. Remove obsolete implementations when migrating functionality.

—

## 15. Pre-Release Checklist

- [ ] Imports resolve correctly.
- [ ] No unintended circular dependencies exist.
- [ ] Page modules initialize only on relevant pages.
- [ ] Event listeners are not duplicated.
- [ ] API endpoints match the backend implementation.
- [ ] Validation and error handling are consistent.
- [ ] Authentication and authorization are enforced server-side.
- [ ] Document upload and download permissions are verified.
- [ ] Keyboard and screen-reader interactions work.
- [ ] Mobile layouts and reduced-motion behavior are checked.
- [ ] No secrets or sensitive data appear in frontend bundles or logs.
- [ ] Unit and integration tests pass.
- [ ] Production asset paths and caching are verified.

—

## 16. Maintenance Policy

Keep this directory focused on browser-side application behavior. Use:

- `utils/` for reusable pure helpers.
- `services/` for backend communication and domain operations.
- `security/` for frontend validation and safe error handling.
- `components/` for reusable interface elements.
- `modules/` for feature-specific workflows.
- `pages/` for page initialization.
- `state/` for shared frontend state when necessary.

**Source of truth:** The actual repository files, backend routes, schemas, and API specification. This README documents the intended architecture; it does not imply that every recommended module has already been implemented.
