
# MedOrbits JavaScript Assets

**Directory:** `assets/js/`  
**Project:** MedOrbits  
**Brand identity:** Royal Burgundy and Champagne Gold  
**Purpose:** Shared frontend utilities, account workflows, education services, API integration, and reusable UI functionality.

## 1. Overview

The `assets/js/` directory contains reusable JavaScript modules powering the MedOrbits website and connected user experiences.

The JavaScript layer supports:

- Application initialization and shared utilities.
- API configuration, requests, and error handling.
- Authentication, verification, roles, and permissions.
- User profiles, dashboards, and applications.
- Courses, colleges, search, filtering, and comparison.
- Document uploads and document management.
- Payments, subscriptions, notifications, and support.
- Forms, validation, pagination, and formatting.
- Accessibility, navigation, animations, and user feedback.
- Visits, career services, and other platform features.

**Core principle:** The frontend manages user interaction and presentation. The backend remains responsible for authentication, authorization, data integrity, and trusted business operations.

## 2. Directory Structure

The following inventory reflects the supplied directory screenshots and is not guaranteed to be exhaustive.

```text
assets/js/
├── README.md
└── main/
    ├── accessibility.js
    ├── animations.js
    ├── api.js
    ├── app.js
    ├── applications.js
    ├── auth.js
    ├── colleges.js
    ├── compare.js
    ├── config.js
    ├── constants.js
    ├── core.js
    ├── courses.js
    ├── dashboard.js
    ├── documents.js
    ├── error-handler.js
    ├── filters.js
    ├── formatters.js
    ├── forms.js
    ├── main.js
    ├── messages.js
    ├── modal.js
    ├── navigation.js
    ├── notifications.js
    ├── pagination.js
    ├── payments.js
    ├── permissions.js
    ├── profile.js
    ├── README.md
    ├── role.js
    ├── search.js
    ├── storage.js
    ├── subscription.js
    ├── support.js
    ├── toast.js
    ├── uploader.js
    ├── user.model.js
    ├── utils.js
    ├── validation.js
    ├── verification.js
    └── visits.js
```

Verify actual repository paths before changing imports, script references, or module locations.

## 3. Module Responsibilities

### 3.1 Application infrastructure

| File | Responsibility |
|—|—|
| `app.js` | Initialize shared application behaviour. |
| `main.js` | Coordinate application startup. |
| `core.js` | Provide shared core functionality. |
| `config.js` | Expose approved frontend configuration. |
| `constants.js` | Centralize stable constants and identifiers. |
| `utils.js` | Provide reusable general-purpose utilities. |
| `error-handler.js` | Normalize errors and coordinate safe error reporting. |

Keep initialization predictable. Prevent duplicate event listeners and repeated module startup.

Never place private API keys, database credentials, signing secrets, or server-only configuration in frontend files.

### 3.2 API and data access

| File | Responsibility |
|—|—|
| `api.js` | Centralize HTTP requests and response handling. |
| `storage.js` | Manage approved client-side preferences and storage. |
| `user.model.js` | Normalize user data structures. |
| `formatters.js` | Format dates, currency, numbers, and display labels. |

Use the shared API client when it already supports the required operation. Avoid introducing duplicate API clients.

The API layer should handle applicable concerns such as:

- Configured API base URLs.
- Request headers and response parsing.
- Session credentials and CSRF protection.
- Network errors and HTTP failures.
- Unauthorized and forbidden responses.
- Request cancellation where supported.
- Duplicate-request prevention where appropriate.
- Safe error messages.

Do not persist plaintext passwords, private keys, payment secrets, or sensitive authentication tokens in browser storage.

### 3.3 Authentication, verification, and permissions

| File | Responsibility |
|—|—|
| `auth.js` | Coordinate authentication and session-aware workflows. |
| `verification.js` | Support configured account-verification workflows. |
| `permissions.js` | Control permission-aware presentation and interactions. |
| `role.js` | Interpret roles for frontend behaviour. |

These modules may support registration, login, logout, password recovery, verification, role-aware navigation, and account-security workflows.

**Security boundary:** Client-side role and permission checks are not authorization controls. The backend must authorize every protected operation and resource independently.

### 3.4 Education, search, and discovery

| File | Responsibility |
|—|—|
| `courses.js` | Course listings and details. |
| `colleges.js` | College discovery and related interfaces. |
| `search.js` | Search interactions and result presentation. |
| `filters.js` | Supported dataset filtering. |
| `compare.js` | Course, college, and entity comparisons. |
| `pagination.js` | Pagination controls and page-state handling. |

Requirements:

- Handle loading, empty, and error states.
- Validate search and filter parameters.
- Keep filtering and pagination state consistent.
- Avoid rendering untrusted content as executable HTML.
- Use backend filtering and pagination where supported.
- Never use client-side filtering as an access-control mechanism.

### 3.5 Account and user workflows

| File | Responsibility |
|—|—|
| `dashboard.js` | Dashboard data and summary interfaces. |
| `profile.js` | Profile display and editing. |
| `applications.js` | Application records and status tracking. |
| `documents.js` | Document-management interactions. |
| `visits.js` | Visit-related API workflows. |
| `subscription.js` | Subscription status and management interfaces. |
| `payments.js` | Payment interfaces and transaction-status presentation. |
| `support.js` | Support requests and ticket interfaces. |
| `notifications.js` | Account alerts and notifications. |
| `messages.js` | Messaging interfaces where implemented. |

Retrieve private account data only through authorized backend endpoints. Never assume a record belongs to the current user because the browser supplied its identifier.

### 3.6 Forms, documents, and validation

| File | Responsibility |
|—|—|
| `forms.js` | Reusable form-submission behaviour. |
| `validation.js` | Client-side validation and accessible error presentation. |
| `uploader.js` | File selection, uploads, and progress interfaces. |
| `documents.js` | Document listing, previews, uploads, and related actions. |

Requirements:

- Accessible field-level validation.
- Loading states and duplicate-submission prevention.
- Server-side validation error presentation.
- Upload progress and failure handling.
- File-selection guidance.
- Confirmation based on actual server responses.

The backend must independently validate submitted fields, file content, file type, size, ownership, and permissions.

### 3.7 User-interface components

| File | Responsibility |
|—|—|
| `navigation.js` | Navigation and menu interactions. |
| `accessibility.js` | Accessibility helpers and interaction enhancements. |
| `animations.js` | Reusable animation and transition behaviour. |
| `modal.js` | Modal behaviour, focus management, and dismissal. |
| `toast.js` | Temporary success, error, warning, and informational messages. |

Requirements:

- Maintain visible keyboard focus.
- Support keyboard interaction.
- Respect reduced-motion preferences.
- Provide accessible names for modal dialogs.
- Prevent toasts from obscuring essential controls.
- Use semantic HTML and accessible controls.

### 3.8 Messaging and feedback

`messages.js`, `notifications.js`, `toast.js`, and `error-handler.js` have separate responsibilities and should not duplicate each other.

Use persistent inline messages for important form errors and confirmations. Toasts should supplement, not replace, essential information.

## 4. Account Module Integration

The following is a dependency guide, not a requirement to load every module on every page.

| Workflow | Relevant modules |
|—|—|
| Login and registration | `auth.js`, `api.js`, `forms.js`, `validation.js`, `toast.js` |
| Password recovery and verification | `auth.js`, `verification.js`, `forms.js`, `validation.js` |
| Security and permissions | `auth.js`, `permissions.js`, `role.js`, `api.js` |
| Dashboard and profile | `dashboard.js`, `profile.js`, `auth.js`, `api.js` |
| Admission applications | `applications.js`, `courses.js`, `colleges.js`, `api.js` |
| Document management | `documents.js`, `uploader.js`, `validation.js`, `api.js` |
| Payments and subscriptions | `payments.js`, `subscription.js`, `api.js` |
| Notifications and messaging | `notifications.js`, `messages.js`, `api.js`, `toast.js` |
| Career and saved opportunities | Relevant feature module, `api.js`, `auth.js` |
| Support requests | `support.js`, `forms.js`, `validation.js`, `api.js` |
| Property visits | `visits.js`, `api.js`, `auth.js` |

Follow the actual imports, exports, and dependencies in the repository.

## 5. Script Loading and Module Conventions

Follow the module system already established by the project.

Classic-script example:

```html
<script src=“../assets/js/main/app.js” defer></script>
```

ES-module example:

```html
<script type=“module” src=“../assets/js/main/main.js”></script>
```

These paths are illustrative. Verify actual paths before using them.

Before adding a script reference:

1. Confirm the file exists.
2. Confirm whether it uses classic scripts or ES modules.
3. Check imports and exports.
4. Load dependencies in the required order.
5. Prevent duplicate loading and startup.
6. Initialize only the modules required by the page.

Do not mix incompatible module-loading conventions.

## 6. API Configuration and Backend Integration

Use the configured API infrastructure, preferably through `api.js` where supported.

Avoid hardcoding environment-specific URLs in feature modules.

Illustrative example:

```javascript
async function loadApplications(apiClient) {
  try {
    const response = await apiClient.get(“/applications”);
    return response.data;
  } catch (error) {
    throw error;
  }
}
```

The method and endpoint are examples only. Use the actual MedOrbits API contract.

API integrations must:

- Follow the backend’s request and response formats.
- Handle authentication and authorization failures.
- Display safe, user-friendly errors.
- Respect rate limits.
- Avoid blindly retrying state-changing requests.
- Use idempotency mechanisms for supported financial operations.
- Avoid exposing internal server details.
- Minimize sensitive data in URLs and logs.

## 7. Security Requirements

### Authentication and sessions

- Never store plaintext passwords in browser storage.
- Never embed private credentials or server secrets in frontend JavaScript.
- Follow the configured authentication and session strategy.
- Handle expired sessions and unauthorized responses consistently.
- Clear sensitive in-memory state after logout where appropriate.
- Never rely on hidden buttons or client-side roles to protect operations.

### API and DOM security

- Use HTTPS in production.
- Apply the backend’s CSRF protection strategy where applicable.
- Treat API responses, user input, filenames, and external content as untrusted.
- Prefer `textContent` for plain-text display.
- Avoid inserting untrusted values through `innerHTML`.
- Validate redirect destinations.
- Do not expose stack traces, internal errors, or secrets to users.

### Payments and subscriptions

- Treat the backend as the authority for payment and subscription status.
- Never mark a payment successful solely because a checkout interface reports success.
- Require trusted server-side payment-provider confirmation.
- Never embed payment-provider secret keys in frontend files.
- Avoid storing card details or unnecessary payment-sensitive data.

### Documents and personal information

- Validate uploaded content on the server.
- Enforce authorization for document access and downloads.
- Do not expose private document URLs or personal information publicly.
- Avoid unnecessary logging of educational records and contact details.

### Sensitive operations

Account deletion, password changes, security-setting changes, and subscription cancellation must use backend authorization and appropriate confirmation or re-authentication.

## 8. Design and Accessibility

**Brand direction:** Royal Burgundy and Champagne Gold, complemented by premium dark palettes.

Requirements:

- Avoid pure-white page sections.
- Maintain readable foreground and background contrast.
- Keep button, modal, form, alert, and navigation behaviour consistent.
- Provide visible keyboard focus.
- Use accessible labels and semantic HTML.
- Announce important dynamic status updates to assistive technologies.
- Respect reduced-motion preferences.
- Support mobile, tablet, and desktop layouts.
- Provide understandable validation and error messages.
- Never communicate important information through colour or animation alone.

## 9. Loading, Error, and Empty States

| State | Expected behaviour |
|—|—|
| Loading | Display progress and prevent duplicate actions. |
| Success | Confirm only what the server actually reports. |
| Validation failure | Identify fields that require correction. |
| Unauthorized | Guide the user through session recovery or sign-in. |
| Forbidden | Explain that access is unavailable without exposing protected information. |
| Network failure | Display a safe message and offer retry where appropriate. |
| Empty results | Explain that no records are currently available. |
| Pending payment | Make clear that the transaction is not confirmed. |
| Upload failure | Explain the failure and allow a safe retry where appropriate. |

Never report a payment, upload, deletion, or other state-changing operation as successful before receiving the required server confirmation.

## 10. Performance and Maintainability

- Keep modules focused on defined responsibilities.
- Reuse shared utilities.
- Avoid unnecessary globals and duplicate event listeners.
- Avoid unnecessary network requests.
- Use pagination for large datasets where supported.
- Keep third-party dependencies minimal and maintained.
- Document public functions and non-obvious behaviour.
- Remove obsolete code only after checking its consumers.
- Keep module names and import paths consistent.
- Follow the repository’s established formatting, linting, and testing conventions.

## 11. Testing and Validation

Before releasing JavaScript changes, verify:

- [ ] Referenced files exist.
- [ ] Imports and exports resolve correctly.
- [ ] Duplicate initialization is prevented.
- [ ] API requests use the configured API client where appropriate.
- [ ] Unauthorized and forbidden states are handled correctly.
- [ ] Form validation and server errors are accessible.
- [ ] Uploads handle invalid and oversized files.
- [ ] Payments distinguish pending, failed, and confirmed states.
- [ ] Sensitive operations require appropriate confirmation and server authorization.
- [ ] Keyboard navigation and focus management work correctly.
- [ ] Reduced-motion preferences are respected.
- [ ] Responsive layouts remain usable on small screens.
- [ ] No secrets or sensitive data are exposed in frontend code or logs.
- [ ] Existing functionality remains intact.

Run checks defined in the actual `package.json` and test configuration. Do not assume a particular command exists without verifying it.

## 12. Adding a New Module

1. Define the module’s purpose and public interface.
2. Check whether an existing module already provides the functionality.
3. Reuse shared API, error-handling, validation, and notification utilities.
4. Follow the established module convention.
5. Update relevant imports or script references.
6. Document the module in this README.
7. Add tests where supported.
8. Verify security, accessibility, performance, and error handling.
9. Confirm that secrets and sensitive data are not exposed.
10. Update documentation when dependencies or API contracts change.

## 13. Maintenance

Keep this README aligned with the actual repository.

When modules are renamed, moved, added, or removed, review:

- HTML script references.
- JavaScript imports and exports.
- Feature-module dependencies.
- API integration.
- Account-page workflows.
- Automated tests and build configuration.
- Related documentation.

Do not document planned functionality as implemented until its code and required backend support exist.

—

**Module objective:** Provide a cohesive, secure, accessible, and maintainable JavaScript foundation for MedOrbits, supporting education discovery, account management, admissions, counselling, documents, payments, subscriptions, notifications, and career services.

**Core principle:** The frontend manages user interaction and presentation; the backend remains responsible for authentication, authorization, data integrity, and trusted business operations.
