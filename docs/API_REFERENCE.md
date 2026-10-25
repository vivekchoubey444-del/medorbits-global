MedOrbits API Reference

Project: MedOrbits
Document: API Reference
Version: 1.0.0
Status: Development reference
Base path: /api

⸻

1. Overview

The MedOrbits API provides a structured interface for education resources, medical admissions, institutional information, user accounts, applications, document management, support services, notifications, and related workflows.

This document defines the recommended API conventions and endpoint contracts for frontend and backend integration. An endpoint listed here is a specification, not confirmation that it has already been implemented or deployed.

Core principles

* Use REST-style resource paths and standard HTTP methods.
* Return JSON for API responses unless an endpoint explicitly serves a file.
* Validate all client-supplied data on the server.
* Enforce authentication, authorization, and resource ownership.
* Never expose secrets, private documents, or internal stack traces.
* Verify official admission, examination, fee, and eligibility information against the responsible authority.
* Keep public informational resources separate from protected personal data.

2. Environments and base URLs

Configure the API base URL through environment-specific configuration rather than hard-coding it in frontend modules.

Environment	Base URL
Local development	http://localhost:3000/api
Staging	https://staging-api.medorbits.in/api
Production	https://api.medorbits.in/api

Deployment note: The staging and production hostnames above are proposed conventions. Configure DNS, TLS, hosting, and reverse-proxy rules before using them.

If the API is served from the same origin as the website, a relative base path such as /api may be preferable.

3. Request and response conventions

Request headers

For JSON requests, clients should send:

Accept: application/json
Content-Type: application/json

For protected routes, include the configured authentication mechanism. For bearer-token authentication:

Authorization: Bearer <access_token>

For multipart file uploads, use multipart/form-data and let the HTTP client generate the multipart boundary.

Standard success response

{
  “success”: true,
  “message”: “Request completed successfully.”,
  “data”: {
    “id”: “resource_123”
  },
  “meta”: {
    “requestId”: “req_example”
  }
}

data should contain the requested resource or result. meta may include request identifiers, pagination details, or other non-sensitive metadata.

Standard error response

{
  “success”: false,
  “error”: {
    “code”: “VALIDATION_ERROR”,
    “message”: “One or more fields are invalid.”,
    “details”: [
      {
        “field”: “email”,
        “message”: “Enter a valid email address.”
      }
    ]
  },
  “meta”: {
    “requestId”: “req_example”
  }
}

Never return database credentials, tokens, file-system paths, stack traces, or other internal implementation details to the client.

HTTP status codes

Status	Meaning
200 OK	Request completed successfully
201 Created	Resource created
202 Accepted	Request accepted for asynchronous processing
204 No Content	Successful request without a response body
400 Bad Request	Malformed request
401 Unauthorized	Authentication is missing or invalid
403 Forbidden	User lacks permission
404 Not Found	Resource does not exist or is not accessible
409 Conflict	Resource state conflicts with the request
413 Content Too Large	Request or upload exceeds configured limits
415 Unsupported Media Type	Unsupported request content type
422 Unprocessable Content	Request data fails semantic validation
429 Too Many Requests	Rate limit exceeded
500 Internal Server Error	Unexpected server failure
503 Service Unavailable	Service is temporarily unavailable

Use a consistent mapping between application errors and HTTP status codes.

4. API versioning

The initial API uses /api as its root. For a future breaking API revision, introduce an explicit versioned prefix, such as /api/v2, or another documented versioning strategy.

Do not silently change response schemas in a way that breaks existing clients. Document deprecations, migration periods, and replacement endpoints.

5. Authentication and authorization

Authentication endpoints may use the following proposed contracts.

Method	Endpoint	Access	Purpose
POST	/auth/register	Public	Create an account
POST	/auth/login	Public	Authenticate a user
POST	/auth/refresh	Refresh credential	Refresh an access token, if supported
POST	/auth/logout	Authenticated	End a session or revoke credentials
POST	/auth/forgot-password	Public	Request password-reset instructions
POST	/auth/reset-password	Reset credential	Complete a password reset
GET	/auth/me	Authenticated	Retrieve the current user profile

Example: login

Request:

POST /api/auth/login
Content-Type: application/json
{
  “email”: “student@example.com”,
  “password”: “example-password”
}

Example response:

{
  “success”: true,
  “message”: “Authentication successful.”,
  “data”: {
    “user”: {
      “id”: “usr_example”,
      “email”: “student@example.com”,
      “role”: “student”
    },
    “accessToken”: “<access_token>”,
    “expiresIn”: 900
  }
}

The response is illustrative. Adapt it to the actual session and token implementation. If refresh tokens are used, prefer secure, HttpOnly, Secure, appropriately SameSite cookies where compatible with the deployment architecture. Do not store long-lived secrets in browser local storage.

Account security requirements

* Hash passwords using a modern password-hashing algorithm.
* Apply rate limits to login, registration, and password-reset routes.
* Use generic password-reset responses to reduce account enumeration.
* Revoke sessions or tokens on logout and other required security events.
* Validate roles and permissions on the server for every protected action.
* Do not treat a client-supplied role or user ID as proof of authorization.

6. Education and reference data

Public reference-data endpoints can expose curated information without requiring a user account, provided the information is intended for public distribution.

Method	Endpoint	Purpose
GET	/courses	List courses
GET	/courses/:courseId	Retrieve a course
GET	/colleges	List institutions
GET	/colleges/:collegeId	Retrieve an institution
GET	/universities	List universities
GET	/universities/:universityId	Retrieve a university
GET	/scholarships	List scholarship resources
GET	/entrance-exams	List entrance examinations
GET	/career-options	List career pathways
GET	/jobs	List published job opportunities
GET	/faqs	List frequently asked questions
GET	/news	List published news and updates
GET	/services	List consultancy services

These routes are proposed contracts. If the site uses static JSON datasets instead of backend routes, document those datasets separately and do not imply that equivalent API endpoints exist.

Query parameters

List endpoints should support only the filters actually implemented. Common optional parameters include:

Parameter	Purpose
q	Search phrase
page	One-based page number
limit	Results per page, subject to a server-side maximum
sort	Allowlisted sort field
order	asc or desc
country	Country filter, where applicable
state	State or region filter, where applicable
course	Course filter, where applicable
status	Published status or another documented status filter

Example:

GET /api/colleges?q=medical&state=West%20Bengal&page=1&limit=20

The server must validate query parameters and enforce pagination limits. Never pass arbitrary client-provided sort expressions directly to a database query.

Example list response

{
  “success”: true,
  “data”: [
    {
      “id”: “college_example”,
      “name”: “Example Medical College”,
      “state”: “West Bengal”,
      “country”: “India”
    }
  ],
  “meta”: {
    “page”: 1,
    “limit”: 20,
    “total”: 1,
    “totalPages”: 1
  }
}

All sample institution names and identifiers are illustrative, not official listings.

7. Official documents and resources

These endpoints are intended for curated links, explanatory resources, and official-document metadata. Use the relevant authority as the source of truth.

Method	Endpoint	Access	Purpose
GET	/official-documents	Public	List published document resources
GET	/official-documents/:resourceId	Public	Retrieve resource metadata
GET	/official-documents/categories	Public	List resource categories
GET	/official-documents/:resourceId/download	Policy-dependent	Resolve or serve an authorized download

Example metadata:

{
  “id”: “resource_example”,
  “title”: “Official examination guidelines”,
  “category”: “Examination”,
  “issuingAuthority”: “Relevant official authority”,
  “officialUrl”: “https://example.gov.in/“,
  “publishedAt”: null,
  “lastVerifiedAt”: null,
  “verificationStatus”: “requires_review”
}

The example uses placeholder data. Replace it with a verified authority, valid official URL, and actual verification date before publishing.

Resource integrity requirements

* Store the official source URL separately from MedOrbits explanatory content.
* Record when a resource was last verified and who or what verified it.
* Avoid republishing copyrighted material without permission.
* Never label a resource as current or verified without evidence.
* Do not mirror sensitive, restricted, or access-controlled documents.
* Validate redirects and download destinations to prevent open-redirect and server-side request forgery risks.

8. Applications and counselling support

Application routes must use server-side authorization and enforce access to the specific application record.

Method	Endpoint	Access	Purpose
POST	/applications	Authenticated	Create an application
GET	/applications	Authenticated	List the current user’s applications
GET	/applications/:applicationId	Owner or authorized staff	Retrieve an application
PATCH	/applications/:applicationId	Owner or authorized staff	Update permitted fields
POST	/applications/:applicationId/submit	Owner	Submit an application
POST	/applications/:applicationId/cancel	Owner or authorized staff	Request or perform cancellation

Application lifecycle

Use a documented state machine. A possible lifecycle is:

draft → submitted → under_review → action_required → approved / rejected

Cancellation and withdrawal rules should be defined separately. A transition must be validated against the current status, actor’s permissions, deadlines, and business rules.

Example creation request:

{
  “applicationType”: “admission_guidance”,
  “courseInterest”: “MBBS”,
  “preferredState”: “West Bengal”
}

Do not collect unnecessary personal information. Identity documents, academic records, contact information, and other sensitive fields should be submitted only when necessary and under an appropriate privacy policy.

9. Document management

Document endpoints must enforce ownership, authorization, file validation, and retention rules.

Method	Endpoint	Access	Purpose
POST	/documents	Authenticated	Upload a document
GET	/documents	Authenticated	List accessible document metadata
GET	/documents/:documentId	Owner or authorized staff	Retrieve document metadata
GET	/documents/:documentId/download	Owner or authorized staff	Download a document
DELETE	/documents/:documentId	Owner or authorized staff	Delete or request deletion

Upload requirements

The backend should:

1. Allow only explicitly supported file types.
2. Enforce configurable file-size and upload-count limits.
3. Check file signatures and content, not only the filename extension.
4. Generate server-controlled storage names.
5. Scan uploads for malware where suitable scanning is available.
6. Store private documents outside the public web root or in private object storage.
7. Use short-lived, authorized download links where appropriate.
8. Apply retention, deletion, audit, and access-review policies.
9. Avoid logging document contents or unnecessary personal metadata.

Example multipart request:

curl -X POST “https://your-configured-host/api/documents” \
  -H “Authorization: Bearer <access_token>” \
  -F “file=@document.pdf” \
  -F “documentType=academic_record”

Replace your-configured-host with the actual configured API origin.

A successful upload should return metadata rather than exposing the server’s physical storage path.

10. Support and help centre

Method	Endpoint	Access	Purpose
GET	/support/categories	Public	List support categories
POST	/support/tickets	Public or authenticated, per policy	Create a support ticket
GET	/support/tickets	Authenticated	List the current user’s tickets
GET	/support/tickets/:ticketId	Owner or authorized staff	Retrieve a ticket
POST	/support/tickets/:ticketId/messages	Owner or authorized staff	Add a message
PATCH	/support/tickets/:ticketId	Authorized staff or permitted owner	Update allowed ticket fields

Example ticket request:

{
  “category”: “technical_issue”,
  “subject”: “Unable to open a resource”,
  “message”: “The resource page displays an error.”
}

Generate ticket identifiers server-side. Validate attachments separately, prevent unauthorized ticket access, and avoid returning internal support notes to users.

11. Notifications

Method	Endpoint	Access	Purpose
GET	/notifications	Authenticated	List the current user’s notifications
GET	/notifications/unread-count	Authenticated	Retrieve unread count
PATCH	/notifications/:notificationId/read	Owner	Mark a notification as read
POST	/notifications/read-all	Authenticated	Mark all current user’s notifications as read

Notifications must be scoped to their recipient. Do not allow a client to choose another user’s recipient ID when marking or retrieving notifications.

12. Payments and refunds

Payment routes must be integrated with the selected payment provider and must never trust a frontend success screen as proof of payment.

Method	Endpoint	Access	Purpose
POST	/payments/orders	Authenticated	Create a payment order
GET	/payments/:paymentId	Owner or authorized staff	Retrieve payment status
POST	/payments/webhooks/:provider	Provider-authenticated	Process provider webhook events
POST	/refund-requests	Authenticated	Submit a refund request
GET	/refund-requests	Authenticated	List the current user’s refund requests
GET	/refund-requests/:requestId	Owner or authorized staff	Retrieve a refund request

Provider-specific paths, signature verification, and payload schemas must be documented once the actual provider has been selected.

Payment security requirements

* Verify webhook signatures using the provider’s documented mechanism.
* Validate payment amount, currency, order reference, and expected state server-side.
* Make webhook processing idempotent.
* Never store raw card numbers or security codes.
* Do not accept a client-submitted paid: true field as payment confirmation.
* Use idempotency keys for order creation and other retry-sensitive operations.
* Keep payment status transitions auditable.
* Define refund eligibility and approval rules separately from payment creation.

13. Administration

Administrative endpoints require explicit role-based authorization and, where appropriate, additional safeguards.

Method	Endpoint	Access	Purpose
GET	/admin/dashboard	Administrator	Retrieve authorized dashboard metrics
GET	/admin/users	Administrator	List users
PATCH	/admin/users/:userId/status	Administrator	Change permitted account status
GET	/admin/applications	Authorized staff	List applications within assigned scope
PATCH	/admin/applications/:applicationId/status	Authorized staff	Update application status
GET	/admin/audit-logs	Authorized administrator	Retrieve permitted audit events
POST	/admin/official-documents	Authorized editor	Create a resource entry
PATCH	/admin/official-documents/:resourceId	Authorized editor	Update a resource entry

These are proposed administrative contracts, not confirmation of existing routes. Limit administrative responses to the minimum information needed for the task. Record security-sensitive actions in tamper-resistant audit logs where practical.

14. Health and operational endpoints

Method	Endpoint	Access	Purpose
GET	/health	Usually public	Basic process health
GET	/ready	Internal or deployment probe	Readiness, including required dependencies
GET	/version	Policy-dependent	Application version and build metadata

Example:

{
  “success”: true,
  “data”: {
    “status”: “ok”
  }
}

Do not expose secrets, database connection strings, detailed infrastructure information, or sensitive dependency diagnostics in public health responses.

15. Pagination, filtering, and sorting

For collection endpoints, use a consistent pagination convention.

Example:

GET /api/news?page=2&limit=10&sort=publishedAt&order=desc

Recommended behavior:

* page defaults to 1.
* limit has a documented default and a server-enforced maximum.
* sort accepts only allowlisted fields.
* order accepts only asc or desc.
* Invalid parameters return a consistent client error or use documented defaults.
* Pagination metadata reflects the actual result set and authorization scope.

For large or frequently changing collections, cursor pagination may be more suitable than offset pagination. Document the chosen approach per endpoint.

16. Validation and data contracts

All request bodies, path parameters, query parameters, and uploaded files must be validated server-side.

Validation should cover:

* Required fields and data types.
* String length and permitted characters.
* Email and phone formats where collected.
* Valid enumeration values.
* Identifier formats.
* File type and size.
* Ownership and permitted state transitions.
* Date ranges and business-specific constraints.

Reject unknown or disallowed fields where appropriate. Avoid mass assignment by explicitly mapping permitted input fields to application models.

17. Security requirements

Minimum baseline

* Enforce HTTPS in deployed environments.
* Configure CORS with an explicit allowlist of trusted origins.
* Apply rate limits to authentication, search, uploads, support, and payment routes.
* Protect cookie-authenticated state-changing requests against CSRF.
* Use secure session and token handling.
* Apply least-privilege access controls.
* Use parameterized database queries or a properly configured ORM.
* Sanitize or safely encode user-generated content when rendering it.
* Keep dependencies updated and review security advisories.
* Store secrets in deployment environment variables or a secret manager.
* Avoid placing tokens, passwords, or personal data in logs and URLs.
* Apply request-size limits and appropriate security headers.
* Use a stable request ID for tracing errors without exposing sensitive data.

Privacy and data protection

* Collect only data necessary for the requested service.
* Publish a privacy notice describing data use and retention.
* Restrict access to student records and uploaded documents.
* Define retention and deletion policies.
* Provide an appropriate process for data-access and deletion requests.
* Document any third-party processors and integrations.
* Obtain required consent where applicable.

18. Rate limiting and idempotency

Rate limits should be configured by endpoint sensitivity and deployment capacity. Authentication, password reset, uploads, search, and payment operations generally need stricter controls than static public reference data.

For operations that may be retried, accept an Idempotency-Key header where supported:

Idempotency-Key: <unique-request-key>

The server must scope keys appropriately, store the outcome for a defined period, and reject conflicting reuse. Document the retention period and behavior before clients depend on it.

19. Error codes

Use stable machine-readable error codes so frontend clients can handle errors without parsing message text.

Code	Meaning
VALIDATION_ERROR	Input failed validation
AUTHENTICATION_REQUIRED	Valid authentication is required
INVALID_CREDENTIALS	Authentication failed
PERMISSION_DENIED	Action is not permitted
RESOURCE_NOT_FOUND	Resource is unavailable
RESOURCE_CONFLICT	Requested state conflicts with current state
RATE_LIMIT_EXCEEDED	Request limit reached
UPLOAD_REJECTED	File failed upload policy
PAYMENT_VERIFICATION_FAILED	Payment could not be verified
DEPENDENCY_UNAVAILABLE	Required service is temporarily unavailable
INTERNAL_ERROR	Unexpected server failure

These codes are recommended conventions. Keep them synchronized with the actual backend error middleware.

20. Frontend integration example

A small client wrapper can centralize base URL handling and error parsing.

const API_BASE_URL = “/api”;
export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !(options.body instanceof FormData)) {
    headers.set(“Content-Type”, “application/json”);
  }
  headers.set(“Accept”, “application/json”);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: “same-origin”
  });
  if (response.status === 204) {
    return null;
  }
  const contentType = response.headers.get(“content-type”) || “”;
  const result = contentType.includes(“application/json”)
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const error = new Error(
      result?.error?.message ||
      result?.message ||
      `Request failed with status ${response.status}`
    );
    error.status = response.status;
    error.code = result?.error?.code || “REQUEST_FAILED”;
    error.details = result?.error?.details || [];
    throw error;
  }
  return result;
}

Example usage:

import { apiRequest } from “./api-client.js”;
export async function getCourses() {
  const result = await apiRequest(“/courses”);
  return result.data;
}

Important: This wrapper does not automatically implement bearer-token refresh, CSRF protection, retries, or file-download handling. Add only the mechanisms required by the selected authentication and deployment architecture. Do not blindly retry payment or other non-idempotent requests.

21. Testing requirements

Before exposing an endpoint to production, test:

* Expected success response and schema.
* Missing, malformed, and invalid input.
* Authentication and authorization failures.
* Attempts to access another user’s records.
* Pagination and filter boundaries.
* Rate-limit behavior.
* Database failures and dependency timeouts.
* File upload validation and unauthorized downloads.
* Payment webhook signature verification and duplicate events.
* Logging, audit events, and error responses.
* CORS and security headers in the deployed environment.

Use synthetic test records. Do not place production credentials, actual student records, or real identity documents in test fixtures.

22. API documentation maintenance

Update this file whenever an endpoint is added, removed, renamed, or changes its request or response schema.

For each implemented endpoint, record:

1. HTTP method and path.
2. Purpose and access requirements.
3. Request parameters and body schema.
4. Success response schema.
5. Error responses.
6. Validation rules and authorization policy.
7. Rate limits, idempotency behavior, and relevant side effects.
8. Example requests and responses.
9. Implementation status and test coverage.

Where practical, maintain an OpenAPI specification as the machine-readable source of truth and generate interactive documentation from it.

23. Implementation status checklist

* [ ]	Confirm the actual API base URL and deployment environments.
* [ ]	Inventory routes registered by the Express application.
* [ ]	Compare implemented endpoints with the proposed contracts in this document.
* [ ]	Document the actual authentication and session strategy.
* [ ]	Document request and response schemas from implementation.
* [ ]	Confirm database models and validation rules.
* [ ]	Confirm upload storage, authorization, and retention behavior.
* [ ]	Confirm payment provider and webhook verification, if payments are enabled.
* [ ]	Add automated API and authorization tests.
* [ ]	Add an OpenAPI specification and keep it synchronized.
* [ ]	Remove or clearly label every endpoint that is planned but not implemented.

⸻

Disclaimer

This reference describes recommended API conventions for MedOrbits. It does not establish that any listed endpoint, payment integration, administrative feature, or deployment hostname currently exists. Verify implementation details against the source code and deployed configuration before integrating a client or publishing API guarantees.