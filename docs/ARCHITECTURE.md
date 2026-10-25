MedOrbits — System Architecture

Project: MedOrbits
Document: System Architecture
Version: 1.0.0
Status: Architecture reference
Last updated: 25 October 2026

⸻

1. Purpose

This document defines the architectural principles, application layers, data flows, security boundaries, deployment model, and maintenance requirements for MedOrbits.

MedOrbits is an education and consultancy platform designed to bring together:

* Education and course discovery.
* Medical admissions and examination resources.
* College and university information.
* Official documents and regulatory resources.
* Scholarships, careers, jobs, and study-abroad information.
* Consultancy services and application guidance.
* User accounts, application management, and document workflows.
* Customer support, notifications, and payment-related services where enabled.

This document describes the intended architecture and known project conventions. The actual implementation must be verified against the repository’s current source code, route registrations, environment configuration, and deployed services.

2. Architectural principles

The system should follow these principles:

1. Separation of concerns: Keep presentation, business logic, persistence, and integrations separate.
2. Progressive enhancement: Public informational pages should remain useful when non-essential JavaScript features fail.
3. Data-driven content: Use structured JSON datasets for suitable public catalogues instead of duplicating content across pages.
4. Security by default: Authenticate protected operations, authorize every resource access, and validate all untrusted input.
5. Official-source integrity: Clearly distinguish MedOrbits guidance from information published by government bodies, examination authorities, universities, and regulators.
6. Responsive design: Support mobile, tablet, and desktop layouts.
7. Accessibility: Use semantic HTML, keyboard-accessible controls, meaningful labels, and sufficient contrast.
8. Operational simplicity: Prefer a modular application over unnecessary microservices until scale or operational needs justify further separation.
9. Observability: Use structured logs, request identifiers, health checks, and actionable error reporting.
10. Maintainability: Document contracts, validate configuration, and test critical business workflows.

3. High-level system architecture

<CodeBlock language=“mermaid” editable>
flowchart TB
    U[Website Visitors and Users]
    A[Administrators and Staff]
subgraph Frontend[“Frontend Layer”]
    P[HTML Pages]
    C[CSS Design System]
    J[JavaScript Modules]
    D[Static JSON Datasets]
end
subgraph Backend[“Backend Application”]
    R[Express API Routes]
    M[Middleware]
    S[Controllers and Services]
    V[Validation and Authorization]
end
subgraph Data[“Data and File Layer”]
    DB[(Configured Database)]
    FS[Private Document Storage]
    PUB[Public Static Assets]
end
subgraph External[“External Integrations”]
    IDP[Authentication or Email Provider]
    PAY[Payment Provider]
    OFF[Official External Sources]
    MON[Monitoring and Logging]
end
U —> P
A —> P
P —> C
P —> J
P —> D
J —> R
R —> M
M —> V
V —> S
S —> DB
S —> FS
P —> PUB
S -. optional .-> IDP
S -. optional .-> PAY
P -. verified links .-> OFF
M -. telemetry .-> MON
</CodeBlock>

The diagram is a logical model. It does not imply that every external integration, storage service, or database adapter is currently configured.

4. Application layers

4.1 Presentation layer

The presentation layer contains website pages, shared layout components, styling, and browser-side interactions.

Typical responsibilities:

* Render public content and navigation.
* Present course, college, university, scholarship, and job catalogues.
* Provide search, filtering, sorting, and pagination interfaces.
* Display application and support forms.
* Show authentication and account states.
* Provide responsive layouts and accessible interactions.
* Consume backend APIs for protected or dynamic resources.

Recommended conventions:

* Use semantic HTML and shared navigation/footer patterns.
* Keep page-specific styles separate from shared design tokens where practical.
* Keep JavaScript modules focused on a single page or reusable feature.
* Avoid embedding secrets or privileged credentials in browser code.
* Treat every client-side validation rule as a usability aid, not a security boundary.

4.2 Static content and data layer

Public pages may consume JSON files stored in the website’s assets directory.

Example dataset organisation:

assets/
├── data/
│   ├── countries.json
│   ├── courses.json
│   ├── colleges.json
│   ├── universities.json
│   ├── scholarships.json
│   ├── hostels.json
│   ├── fees.json
│   ├── admission-process.json
│   ├── entrance-exams.json
│   ├── documents.json
│   ├── career-options.json
│   ├── jobs.json
│   ├── faqs.json
│   ├── news.json
│   ├── notifications.json
│   ├── testimonials.json
│   └── services.json
├── css/
├── js/
├── images/
└── icons/

This is a suggested organisation based on the project’s data conventions. Keep existing repository paths authoritative and do not create duplicate datasets when equivalent files already exist.

Each dataset should define a consistent schema, stable identifiers, field types, and a versioning policy.

Example:

{
  “metadata”: {
    “schemaVersion”: “1.0.0”,
    “dataset”: “courses”,
    “defaultCountryCode”: “IN”
  },
  “items”: [
    {
      “id”: “course-example”,
      “title”: “Example Course”,
      “category”: “healthcare”,
      “published”: true
    }
  ]
}

The record is illustrative, not a real course listing.

Static JSON is suitable for public reference information. Do not publish private user data, authentication credentials, internal application notes, private document URLs, or administrator-only records in static assets.

4.3 Application API layer

The backend API provides server-side functionality for operations that require persistence, authentication, authorization, integrations, or controlled access to data.

Recommended backend responsibilities include:

* Account registration and authentication.
* User profiles and permissions.
* Applications and counselling workflows.
* Private document metadata and uploads.
* Support tickets and communication records.
* Payment orders and refund requests, if enabled.
* Administrative operations.
* Notifications and audit records.

The API conventions are documented in docs/API_REFERENCE.md.

The actual endpoint inventory must be derived from the registered backend routes rather than inferred from frontend page names.

4.4 Business logic layer

Business rules should live in services or equivalent domain modules rather than being duplicated across route handlers.

Examples include:

* Application status transitions.
* Eligibility and submission validation.
* Document access decisions.
* Payment state reconciliation.
* Refund eligibility and approval.
* Notification creation.
* Official-resource verification workflows.

Controllers should primarily coordinate request handling, validation, service calls, and response formatting. Business services should avoid depending directly on browser-specific concerns.

4.5 Persistence layer

The persistence layer stores data that must remain available across sessions or deployments.

Possible data includes:

* Users and account status.
* Applications and application history.
* Document metadata.
* Support tickets and messages.
* Payment records and refund requests.
* Notifications.
* Audit events.

Use the database already configured for the deployment. Do not assume that the repository uses PostgreSQL or MySQL until the active database driver, environment variables, schema, and migration configuration have been confirmed.

Use migrations or a documented schema-management process for production changes. Keep database credentials outside source control.

4.6 File storage layer

Private files should be stored separately from public website assets.

Suitable storage options include private object storage or a protected server-side storage service. The choice should reflect deployment architecture, retention needs, upload volume, and backup requirements.

Store file metadata in the database where needed, including:

* Internal document identifier.
* Owning user or application.
* Document category.
* Storage key or internal reference.
* MIME type and file size.
* Upload timestamp.
* Verification or review status.
* Retention and deletion state.

Do not expose physical storage paths or make sensitive uploaded files publicly accessible by default.

5. Suggested repository organisation

The following is a logical reference structure, not a command to restructure the existing repository.

medorbits/
├── index.html
├── pages/
│   ├── education.html
│   ├── courses.html
│   ├── colleges.html
│   └── universities.html
├── official-documents/
│   ├── index.html
│   ├── nmc-guidelines.html
│   ├── official-documents.js
│   ├── official-document-resources.json
│   └── INTEGRATION.md
├── support/
│   ├── index.html
│   └── refund-request.html
├── assets/
│   ├── css/
│   ├── js/
│   ├── data/
│   ├── images/
│   └── icons/
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── validators/
├── tests/
├── docs/
│   ├── API_REFERENCE.md
│   └── ARCHITECTURE.md
├── server.js
├── package.json
├── .env.example
└── README.md

Some directories may not exist yet or may have different names. Preserve the established project structure unless a deliberate migration is planned.

Directory responsibilities

Directory	Responsibility
pages/	Public education and information pages
official-documents/	Official-resource pages and their integration assets
support/	Help centre and support-related pages
assets/css/	Shared and page-specific styles
assets/js/	Browser-side modules
assets/data/	Public structured datasets
config/	Server configuration and environment validation
routes/	API route definitions
controllers/	HTTP request and response coordination
middleware/	Authentication, authorization, rate limiting, and error handling
models/	Data models or persistence adapters
services/	Business logic and external integrations
validators/	Request and domain validation
tests/	Automated test suites
docs/	Technical and operational documentation

6. Backend request lifecycle

A typical API request should follow a predictable path:

<CodeBlock language=“mermaid” editable>
flowchart TD
    A[Incoming HTTP Request]
    B[Request ID and Basic Logging]
    C[Security Headers and CORS]
    D[Body and Request Size Limits]
    E[Rate Limiting]
    F[Route Matching]
    G[Authentication]
    H[Authorization]
    I[Input Validation]
    J[Controller]
    K[Business Service]
    L[Database or External Provider]
    M[Response Formatter]
    N[Central Error Handler]
A —> B —> C —> D —> E —> F
F —> G —> H —> I —> J —> K —> L —> M
F -. errors .-> N
G -. errors .-> N
H -. errors .-> N
I -. errors .-> N
J -. errors .-> N
K -. errors .-> N
L -. errors .-> N
</CodeBlock>

The precise middleware order depends on the Express implementation. Configure middleware so that security, request-size limits, rate limiting, authentication, authorization, validation, and error handling operate consistently.

Do not log passwords, access tokens, session cookies, uploaded document contents, or full payment credentials.

7. Data flow

7.1 Public information

1. The browser requests a page or static dataset.
2. The server or hosting platform serves the HTML, CSS, JavaScript, images, and public JSON.
3. Browser-side code renders the available information.
4. Links to official sources direct users to the relevant authority.
5. Content freshness and verification dates are displayed where appropriate.

7.2 Protected application workflow

1. The user authenticates.
2. The browser submits an application request.
3. The API authenticates the request and validates the payload.
4. Authorization checks confirm the user’s permitted scope.
5. Business logic validates the requested state transition.
6. The persistence layer records the change.
7. An audit event or notification is generated where required.
8. The API returns a safe response to the client.

7.3 Document upload workflow

1. The user selects a file and its document category.
2. The API validates authentication and upload permissions.
3. File size, type, signature, and other applicable restrictions are checked.
4. The file is scanned where suitable scanning is available.
5. The file is stored in private storage.
6. Metadata and ownership are recorded.
7. The API returns document metadata.
8. Later access is granted only after an authorization check.

7.4 Payment workflow

If payments are enabled:

1. The client requests an order from the backend.
2. The backend validates the service, amount, and currency.
3. The selected payment provider creates or processes the order.
4. The provider sends a signed webhook or another documented verification result.
5. The backend verifies the event and processes it idempotently.
6. The payment record is reconciled with the order.
7. The application or service is updated according to business rules.
8. The user sees the resulting verified status.

A browser redirect alone must never be treated as authoritative proof of payment.

8. Data ownership and consistency

Use a clear source of truth for each type of information.

Data type	Recommended source of truth
Public course and college catalogues	Approved dataset or maintained database
Official rules and notices	Issuing authority’s official publication
User profiles	Backend persistence layer
Applications	Backend persistence layer
Document metadata	Backend persistence layer
Private document contents	Protected file storage
Payment status	Verified payment records and provider events
Support tickets	Backend persistence layer
Frontend presentation preferences	Browser-side state, where appropriate

Avoid maintaining conflicting copies of the same data without a defined synchronization process.

For data imported from external sources, preserve provenance and record when it was retrieved or reviewed. Do not represent an old dataset as current without checking its freshness.

9. Authentication and access control

Use a documented authentication strategy that matches the website’s hosting and API architecture.

Authentication

Possible approaches include secure server-side sessions or short-lived access tokens. Choose one deliberately and document refresh, expiry, logout, and revocation behavior.

Authorization

Use role-based access control where appropriate, supplemented by resource-level checks.

Possible roles include:

* visitor
* student
* applicant
* support_agent
* content_editor
* administrator

These are illustrative role names. The implemented roles and permissions must come from the application’s actual authorization model.

Every protected request must check both the user’s permission and access to the specific resource. A user who can access their own application must not automatically be able to access another user’s application.

10. Security architecture

Application security

* Enforce HTTPS in production.
* Use an explicit CORS origin allowlist.
* Apply secure HTTP headers.
* Validate and normalize untrusted input.
* Use parameterized database queries.
* Restrict request sizes and upload types.
* Prevent unauthorized resource access and insecure direct object references.
* Apply rate limits to sensitive endpoints.
* Use CSRF protections when required by cookie-based authentication.
* Keep dependencies and runtimes updated.
* Avoid exposing internal errors to clients.

Secret management

Store sensitive configuration in the hosting environment or a secret manager.

Examples include:

DATABASE_URL
SESSION_SECRET
ADMIN_TOKEN
AI_API_KEY
AI_API_URL
AI_MODEL

These names are examples drawn from the project’s configuration conventions and must be verified against the actual application. Do not commit real values to source control, include them in frontend bundles, or print them in logs.

An administrator token, if used, must be strongly generated, access-controlled, rotated when necessary, and never exposed to the browser.

AI integration

If AI features are enabled:

* Call the AI provider from the backend.
* Keep provider credentials server-side.
* Validate and constrain input and output.
* Apply usage limits and cost controls.
* Avoid sending private application records or identity documents unless necessary and authorized.
* Treat model output as untrusted input.
* Do not use generated content as the sole authority for admission eligibility, legal compliance, payment status, or regulatory decisions.

11. Frontend design architecture

The frontend should use a shared visual system and reusable interaction patterns.

Recommended shared components include:

* Navigation and footer.
* Search and filter controls.
* Cards and content grids.
* Status messages and error states.
* Forms and validation messages.
* Modal dialogs and disclosure controls.
* Pagination.
* Loading and empty states.

Maintain the established MedOrbits visual direction: premium dark or tinted surfaces, a consistent color palette, strong text contrast, responsive layouts, and clear interaction states. Avoid pure-white content sections where the established design system calls for tinted or dark surfaces.

Design consistency must not compromise accessibility. Respect reduced-motion preferences, visible keyboard focus, readable typography, and responsive reflow.

12. Internationalization

If multiple languages are supported, use a shared translation layer rather than duplicating entire pages for every language.

A translation system may include language identifiers such as:

en, hi, bn, as, ne, mr, gu, pa, ur, or, fr, de, es, zh, and ar.

The actual supported language list must be based on available translations.

Architecture requirements:

* Use stable translation keys.
* Provide a documented fallback language.
* Avoid hard-coding interface text throughout JavaScript.
* Preserve right-to-left layout support for applicable languages.
* Format dates and numbers according to locale where appropriate.
* Do not machine-translate official legal or regulatory wording and label it as authoritative without review.

13. Search architecture

Search may operate on static datasets, server-side indexed records, or a combination of both.

For small public JSON catalogues, client-side filtering may be sufficient. For large datasets or protected records, use server-side search with authorization, pagination, and input validation.

Search design should address:

* Normalization and case-insensitive matching.
* Supported fields and filters.
* Pagination and result limits.
* Empty and no-result states.
* Search latency and indexing where applicable.
* Safe handling of user-supplied query text.
* Prevention of private record leakage.

Do not expose internal database fields merely because they are searchable.

14. Deployment architecture

The production architecture may use static hosting for public pages and a separate application host for the API.

<CodeBlock language=“mermaid” editable>
flowchart TB
    Browser[User Browser]
    DNS[DNS and HTTPS]
    Static[Static Website Hosting]
    API[Node.js and Express Application]
    DB[(Configured Database)]
    Storage[Private File Storage]
    Provider[External Providers]
Browser —> DNS
DNS —> Static
Browser —> API
API —> DB
API —> Storage
API -. optional integrations .-> Provider
</CodeBlock>

This is a proposed deployment model. The actual topology may differ if the website and API share an origin or are hosted together.

Deployment requirements

* Use environment-specific configuration.
* Configure HTTPS and DNS for all production origins.
* Restrict CORS to required origins.
* Run database migrations in a controlled deployment step.
* Configure health and readiness checks.
* Keep secrets out of build artifacts.
* Set appropriate upload and request-size limits.
* Configure backups and test recovery.
* Monitor server errors, latency, and dependency failures.
* Verify production routes and static asset paths after deployment.

If the application is deployed through Render or another managed host, follow that platform’s documented build, start, health-check, persistent-storage, and environment-variable requirements.

15. Configuration management

Maintain a documented .env.example containing placeholder values only.

Example:

NODE_ENV=development
PORT=3000
DATABASE_URL=
SESSION_SECRET=
ADMIN_TOKEN=
AI_API_KEY=
AI_API_URL=
AI_MODEL=

Only retain variables actually used by the application. Validate required configuration at startup and fail clearly if a required secret or connection setting is missing.

Never use production secrets in local development or test fixtures.

16. Observability and reliability

The backend should provide enough telemetry to identify operational problems without exposing private data.

Recommended capabilities:

* Structured application logs.
* Correlation or request IDs.
* Error-rate and latency monitoring.
* Health and readiness endpoints.
* Database connection and query-failure monitoring.
* External-provider failure tracking.
* Upload and payment workflow monitoring where applicable.
* Audit logs for sensitive administrative actions.
* Alerts for sustained errors and service unavailability.

Logs should have defined retention, access restrictions, and redaction rules.

Retries should be limited to operations where they are safe. Use timeouts and idempotency for external calls and asynchronous workflows.

17. Testing strategy

Unit tests

Test individual validators, business rules, status transitions, formatters, and utility functions.

Integration tests

Test API routes against the configured test database or suitable isolated test infrastructure. Cover authentication, authorization, validation, persistence, and error handling.

End-to-end tests

Test critical user journeys, including:

* Browsing public education resources.
* Searching and filtering catalogues.
* Registering and authenticating.
* Creating and submitting an application.
* Uploading and retrieving an authorized document.
* Creating and updating a support ticket.
* Completing payment verification, if payments are enabled.
* Using administrative workflows with the correct permissions.

Security tests

Include tests for unauthorized resource access, role escalation, malformed input, request limits, upload restrictions, authentication abuse, and webhook replay or duplication.

Release gate

Do not release a critical workflow until its required tests pass and the production configuration has been checked.

18. Performance and scalability

Begin with the simplest architecture that meets the application’s needs. A modular monolith is generally easier to maintain than a distributed system for an early-stage platform.

Potential improvements as usage grows include:

* Static asset caching and compression.
* Image optimization and lazy loading.
* Database indexing and query optimization.
* Server-side pagination and search indexing.
* Background jobs for expensive tasks.
* Queue-based notification delivery.
* Object storage for documents.
* Carefully configured caching for public data.
* Horizontal scaling of stateless API instances.

Caching must not expose private or user-specific content across sessions. Cache invalidation and dataset freshness must be explicitly defined.

19. Architecture decision records

Record major decisions in a consistent format.

Suggested directory:

docs/
└── architecture/
    ├── ADR-001-frontend-and-api-boundaries.md
    ├── ADR-002-database-selection.md
    ├── ADR-003-authentication-strategy.md
    ├── ADR-004-private-document-storage.md
    └── ADR-005-official-resource-verification.md

Do not create these records merely to imply that decisions have already been made. Add them as decisions are evaluated and approved.

Each record should contain:

* Context and problem.
* Considered options.
* Decision.
* Consequences and trade-offs.
* Date and status.

20. Related documentation

Document	Purpose
README.md	Project overview, setup, and development instructions
docs/API_REFERENCE.md	API contracts and endpoint conventions
official-documents/INTEGRATION.md	Official-document page integration
.env.example	Configuration variable names and placeholders
package.json	Runtime scripts and dependencies
OpenAPI specification, if maintained	Machine-readable API contracts

Verify the actual file paths before adding links to project documentation.

21. Architecture review checklist

* [ ]	Confirm the frontend and backend entry points.
* [ ]	Confirm actual Express routes and middleware ordering.
* [ ]	Confirm the database engine, schema, and migration process.
* [ ]	Identify which public datasets are static and which are API-backed.
* [ ]	Verify authentication and role-based access control.
* [ ]	Verify application ownership and resource-level authorization.
* [ ]	Verify private document storage and download permissions.
* [ ]	Confirm payment provider integration, if applicable.
* [ ]	Validate environment configuration and secret handling.
* [ ]	Confirm production DNS, HTTPS, CORS, and deployment topology.
* [ ]	Add automated tests for critical workflows.
* [ ]	Confirm logging, monitoring, backups, and recovery procedures.
* [ ]	Reconcile this document with the implemented repository.
* [ ]	Review architectural decisions when requirements materially change.

⸻

22. Maintenance policy

Update this document when application boundaries, data ownership, authentication, deployment topology, persistence technology, or major integrations change.

Architecture documentation must describe the system that exists, distinguish it from the system being planned, and remain consistent with implementation and operational configuration.

End of document.