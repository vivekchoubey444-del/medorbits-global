
# MedOrbits — Services Layer

**Directory:** `/src/js/services/`

The services layer centralizes communication between MedOrbits frontend features and the backend API. It provides reusable API operations, input validation, consistent error handling, and domain-specific business workflows.

The services layer must not replace backend authorization, validation, or security controls.

—

## 1. Directory Structure

```text
src/
└── js/
    └── services/
        ├── README.md
        ├── api.services.js
        ├── auth.services.js
        ├── application.services.js
        └── document.services.js
```

Additional service modules may be added as the application grows.

Recommended future modules:

```text
services/
├── job.services.js
├── user.services.js
├── notification.services.js
├── support.services.js
├── search.services.js
├── payment.services.js
└── audit.services.js
```

Create a module only when its API contract and backend routes are defined.

—

## 2. Service Responsibilities

### `api.services.js`

**Purpose:** Shared HTTP client and transport layer.

Responsibilities:

- Construct API request URLs.
- Send HTTP requests using `fetch`.
- Serialize JSON request bodies.
- Support multipart file uploads.
- Apply request timeouts and cancellation.
- Parse API responses.
- Normalize HTTP and network errors.
- Attach correlation IDs where supported.
- Apply consistent request credentials and headers.

Exports used by other services:

```javascript
import {
  apiClient,
  ApiServiceError,
} from “./api.services.js”;
```

Domain-specific modules should use this client rather than implementing duplicate JSON request logic.

**Important:** Binary downloads require a response path that preserves the original `Blob` or stream instead of parsing the response as JSON.

### `auth.services.js`

**Purpose:** Authentication and account-session operations.

Supported operations:

- `login()`
- `register()`
- `logout()`
- `getSession()`
- `getCurrentUser()`
- `checkAuthentication()`
- `requestPasswordReset()`
- `resetPassword()`
- `changePassword()`
- `verifyEmail()`
- `resendVerificationEmail()`
- `configureCsrfTokenProvider()`

Example:

```javascript
import { authService } from “./auth.services.js”;

const session = await authService.getSession();
```

Security requirements:

- Do not store passwords in browser storage.
- Do not persist authentication tokens in `localStorage`.
- Prefer appropriately configured secure, HttpOnly cookies for session authentication.
- Protect state-changing requests against CSRF when cookie-based authentication requires it.
- Enforce login, registration, and account permissions on the server.
- Apply rate limits to login and password-reset endpoints.
- Never return password hashes or private authentication data to the client.

### `application.services.js`

**Purpose:** Student and applicant application workflows.

Supported operations:

- `listApplications()`
- `getApplication()`
- `createApplication()`
- `updateApplication()`
- `withdrawApplication()`
- `getApplicationStatus()`
- `requestApplicationStatusChange()`
- `uploadApplicationDocument()`
- `listApplicationDocuments()`
- `deleteApplicationDocument()`

Example:

```javascript
import {
  applicationService,
} from “./application.services.js”;

const applications = await applicationService.listApplications({
  page: 1,
  pageSize: 20,
});
```

Responsibilities include application retrieval, controlled updates, status retrieval, and supporting-document operations.

The backend must enforce application ownership, permitted state transitions, review permissions, and audit requirements.

### `document.services.js`

**Purpose:** Document metadata, uploads, downloads, and application-document associations.

Supported operations:

- `listDocuments()`
- `getDocument()`
- `getDocumentHistory()`
- `uploadDocument()`
- `uploadDocumentForm()`
- `listApplicationDocuments()`
- `uploadApplicationDocument()`
- `downloadDocument()`
- `saveDownloadedBlob()`
- `deleteDocument()`
- `updateDocumentMetadata()`

Example:

```javascript
import {
  documentService,
} from “./document.services.js”;

const documents = await documentService.listDocuments({
  page: 1,
  pageSize: 20,
});
```

Document handling requirements:

- Validate file size and permitted file types on both client and server.
- Inspect file signatures on the server.
- Scan uploaded files for malware where required.
- Store files using controlled storage paths or object-storage keys.
- Never expose internal filesystem paths.
- Authorize every download, update, and deletion.
- Record required document-access and modification events.
- Apply retention and privacy policies to identity, education, and admission documents.

—

## 3. Import Conventions

Use explicit ES module imports with file extensions.

```javascript
import { apiClient } from “./api.services.js”;

import {
  API,
  APPLICATION_STATUS,
} from “../utils/contants.js”;

import {
  validateIdentifier,
} from “../utils/validators.js”;
```

The existing project uses the filename `contants.js`. Preserve that spelling until the file and all imports are deliberately renamed together.

Use relative imports within the same module directory and the correct relative path for utilities.

Avoid:

- Duplicating API base URLs across service modules.
- Duplicating HTTP request implementations.
- Hardcoding endpoint paths that already exist in shared constants.
- Introducing undocumented endpoints.
- Mixing UI rendering and DOM manipulation into data services.

—

## 4. API Endpoint Conventions

The API client and shared constants should define the API prefix and endpoint paths.

Typical endpoint families include:

| Resource | Typical API path |
|—|—|
| Authentication | `/api/auth` |
| Users | `/api/users` |
| Applications | `/api/applications` |
| Documents | `/api/documents` |
| Jobs | `/api/jobs` |
| Notifications | `/api/notifications` |
| Support | `/api/support` |
| Search | `/api/search` |

These paths are conventions, not proof that every route is implemented.

Before using an endpoint, confirm that it exists in the Express router and matches `/api/openapi.yaml`.

### HTTP method conventions

| Method | Intended use |
|—|—|
| `GET` | Retrieve resources |
| `POST` | Create resources or invoke an action |
| `PUT` | Replace a resource when supported |
| `PATCH` | Update permitted fields |
| `DELETE` | Delete a resource when permitted |

Use the method documented by the actual backend contract.

Do not assume an endpoint exists solely because a frontend service method references it.

—

## 5. Standard Service Pattern

A domain service should:

1. Validate identifiers and request parameters.
2. Normalize input values.
3. Call the centralized API client.
4. Convert transport errors into safe domain errors.
5. Return the documented response data.
6. Leave authorization and authoritative validation to the backend.

Example:

```javascript
import {
  apiClient,
  ApiServiceError,
} from “./api.services.js”;

export class ExampleServiceError extends Error {
  constructor(message, code = “SERVICE_ERROR”) {
    super(message);
    this.name = “ExampleServiceError”;
    this.code = code;
  }
}

export async function getExample(id) {
  if (!id || typeof id !== “string”) {
    throw new ExampleServiceError(
      “A valid resource ID is required.”,
      “INVALID_ID”
    );
  }

  try {
    return await apiClient.get(
      `/api/examples/${encodeURIComponent(id)}`
    );
  } catch (error) {
    if (error instanceof ApiServiceError) {
      throw new ExampleServiceError(
        “The requested resource could not be loaded.”,
        error.code || “REQUEST_FAILED”
      );
    }

    throw new ExampleServiceError(
      “An unexpected error occurred.”,
      “SERVICE_ERROR”
    );
  }
}
```

Adapt this pattern to the actual API client’s method signatures and error contract before copying it into production code.

—

## 6. Error Handling

Services should return successful response data or throw a predictable error.

Expected error categories include:

| Category | Typical meaning |
|—|—|
| `VALIDATION_ERROR` | Input failed validation |
| `UNAUTHORIZED` | Authentication is required |
| `FORBIDDEN` | The user lacks permission |
| `NOT_FOUND` | The resource does not exist or is unavailable |
| `CONFLICT` | The operation conflicts with current resource state |
| `RATE_LIMITED` | Too many requests |
| `NETWORK_ERROR` | A network request failed |
| `REQUEST_TIMEOUT` | The request exceeded its time limit |
| `SERVICE_ERROR` | An unexpected service failure |

The exact codes must match the shared error conventions.

### Error-handling example

```javascript
try {
  const result = await applicationService.getApplication(
    applicationId
  );

  // Render the successful result in the UI.
} catch (error) {
  // Display a safe, user-friendly message.
  // Log only approved diagnostic information.
  console.error(“Application request failed”, {
    code: error.code,
    correlationId: error.correlationId,
  });
}
```

Do not display stack traces, database messages, filesystem paths, raw server exceptions, or secrets to end users.

Production logging should use the project’s approved logging and monitoring system rather than logging sensitive request data.

—

## 7. Request Cancellation and Timeouts

Where supported by the API client, pass an `AbortSignal` to requests.

```javascript
const controller = new AbortController();

try {
  const applications = await applicationService.listApplications({
    page: 1,
    pageSize: 20,
    signal: controller.signal,
  });
} catch (error) {
  if (error.code !== “REQUEST_ABORTED”) {
    throw error;
  }
}

// Cancel when the associated operation is no longer needed.
controller.abort();
```

Use cancellation for obsolete searches, route changes, and abandoned workflows.

Confirm the exact cancellation error code and method signatures in the installed API client.

Uploads and downloads should use suitable timeouts for their expected file sizes.

—

## 8. Validation Rules

Use the shared validation utilities wherever applicable.

```javascript
import {
  validateEmail,
  validateIdentifier,
  validateFile,
  validateApplicationPayload,
  validateJobPayload,
} from “../utils/validators.js”;
```

Validation responsibilities include:

- Required fields and string lengths.
- Email and phone formats.
- Identifier formats.
- Numeric ranges and pagination.
- Application and job payload structure.
- File size and permitted MIME types.
- Date formats and date ordering.
- Supported enum values.

Client-side validation improves usability but is not a security boundary.

The backend must independently validate every request, including requests submitted without the MedOrbits frontend.

—

## 9. File Upload and Download Conventions

### Uploads

Use `FormData` for multipart uploads when required by the API.

```javascript
const formData = new FormData();

formData.append(“file”, selectedFile, selectedFile.name);

const result = await documentService.uploadDocumentForm(
  formData
);
```

Do not manually set the multipart `Content-Type` header when using browser `FormData`. The browser must generate the multipart boundary.

Verify that the service and API client support the same upload method signature.

### Downloads

```javascript
const blob = await documentService.downloadDocument(
  documentId
);

documentService.saveDownloadedBlob(
  blob,
  “supporting-document.pdf”
);
```

Use safe filenames and revoke temporary object URLs after use.

For sensitive documents, prevent unauthorized caching and enforce server-side access controls. Never rely on an unguessable document ID alone for access control.

—

## 10. Security Requirements

All service modules must follow these rules:

- Never trust browser-supplied roles or ownership fields.
- Never treat frontend validation as authoritative.
- Never place secrets in frontend JavaScript.
- Never persist passwords or session tokens in `localStorage`.
- Use HTTPS in production.
- Apply appropriate cookie, CSRF, CORS, and session policies.
- Enforce authorization on every protected backend route.
- Validate request bodies and uploaded files on the server.
- Apply rate limiting to authentication and sensitive operations.
- Avoid logging passwords, tokens, identity documents, or private file content.
- Use correlation IDs for approved diagnostics.
- Apply least-privilege access to administrative actions.
- Audit sensitive application and document operations where required.

Frontend services must not be treated as a substitute for Express middleware or backend authorization.

—

## 11. Integration with the Backend

Before releasing a service, verify:

- [ ] The route is registered in the Express application.
- [ ] The route method and path match the frontend service.
- [ ] The request payload matches the backend schema.
- [ ] Response fields match the documented response contract.
- [ ] Authentication and permissions are enforced.
- [ ] Pagination parameters and response shapes agree.
- [ ] Upload field names and size limits match.
- [ ] Download responses preserve binary content.
- [ ] Error codes and status mappings are consistent.
- [ ] Database changes are authorized and audited where required.
- [ ] CORS and credentials work in the deployment environment.
- [ ] Integration tests cover successful and failed requests.

Use `/api/openapi.yaml` and the actual Express routes as the source of truth.

—

## 12. Testing Strategy

Test service modules independently from UI components.

Recommended test cases:

### API client

- Successful JSON responses.
- Empty responses and `204 No Content`.
- Invalid JSON responses.
- HTTP errors.
- Network failures.
- Request timeout and cancellation.
- Correlation ID propagation.
- Multipart requests and binary downloads.

### Authentication

- Successful login and logout.
- Invalid credentials.
- Expired sessions.
- Registration validation.
- Password-reset requests.
- Unauthorized and rate-limited requests.

### Applications

- Listing and retrieving applications.
- Invalid application IDs.
- Unauthorized access attempts.
- Invalid payloads.
- Forbidden status transitions.
- Duplicate submissions and conflicts.

### Documents

- Valid and invalid uploads.
- Oversized files.
- Unsupported MIME types.
- Unauthorized downloads.
- Missing documents.
- Metadata update validation.
- Deletion restrictions.
- Application-document ownership checks.

### Test security boundaries

Verify that backend authorization still works when requests are sent directly without using the frontend services.

—

## 13. Development Checklist

When adding a service module:

1. Confirm the route and schema.
2. Reuse `api.services.js`.
3. Reuse shared constants and validators.
4. Define domain-specific errors where helpful.
5. Validate input and normalize parameters.
6. Document exported functions and expected response data.
7. Add unit and integration tests.
8. Verify permissions on the backend.
9. Update this README when public service interfaces change.
10. Confirm that all imports resolve with the project’s configured module system.

—

## 14. Maintenance Policy

Keep service modules focused on API operations and domain-specific request handling.

Move shared transport behavior into `api.services.js`, shared formatting into the utilities directory, and shared validation into the validation utilities.

Keep frontend service contracts synchronized with the backend schemas and OpenAPI specification. When a route changes, update the backend, specification, service implementation, and tests together.

**Source of truth:** The implemented backend routes, request schemas, response schemas, and OpenAPI specification—not assumptions made by the frontend.
