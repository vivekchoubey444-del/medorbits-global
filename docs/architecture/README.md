
# MedOrbits Architecture Overview

**Project:** MedOrbits  
**Directory:** `docs/architecture/`  
**Recommended file:** `README.md`  
**Purpose:** Document the application’s logical architecture, component responsibilities, system boundaries, security controls, and integration points.  
**Status:** Architecture reference — verify against the deployed implementation.

## 1. Overview

MedOrbits is an education and career consultancy platform intended to support educational guidance, admissions, student services, career development, recruitment, employer workflows, and related administrative operations.

Its architecture separates user-facing interfaces, HTTP request handling, business logic, persistence, external integrations, and operational responsibilities.

This separation is intended to improve maintainability, security, testability, and future extensibility.

**Implementation rule:** This document describes intended architecture. It does not establish that a directory, module, provider, or capability exists or is operational. The repository, runtime configuration, database schema, and deployed application are the sources of truth.

## 2. Architectural Layers

### 2.1 Presentation Layer

The presentation layer contains the pages and static resources through which users interact with MedOrbits.

Relevant repository areas may include:

| Path | Intended responsibility |
|—|—|
| `pages/` | General website pages and public information |
| `account/` | Account access, authentication, and user workflows |
| `education/` | Education, admissions, and study-abroad content |
| `career/` | Career services, jobs, internships, and employer features |
| `admin/` | Administrative interfaces |
| `legal/` | Legal notices, privacy, consent, and policies |
| `assets/` | Stylesheets, browser-side JavaScript, images, icons, and public data |
| `public/` | Publicly served resources, subject to server configuration |

**Responsibilities and boundaries:**

- Present information and collect user input.
- Communicate with backend operations through documented interfaces.
- Provide accessible navigation, forms, and error feedback.
- Keep server secrets and privileged credentials out of browser-accessible resources.
- Avoid treating frontend visibility as authorization.
- Prevent private documents and sensitive records from being exposed through static hosting.

The actual serving behavior of these directories must be confirmed from the application entry point and deployment configuration.

### 2.2 Application Layer

The application layer receives requests, validates input, applies business rules, coordinates operations, and returns responses.

The `src/` directory is the intended location for backend modules, subject to the repository’s actual structure.

Possible responsibilities include:

- Routes and controllers.
- Authentication and authorization middleware.
- Request validation.
- Business services.
- Database access.
- External integrations.
- Error handling and response formatting.
- Background jobs and workers, where implemented.

Controllers should coordinate HTTP requests and delegate domain operations to appropriate services. Business rules should not exist exclusively in browser-side code.

Do not assume every conventional module exists. Document components based on files and behavior confirmed in the repository.

### 2.3 Data Layer

The data layer manages persistent application data and file-related operations.

Potential repository areas include:

- `database/` — Database schema, migrations, seed data, and test fixtures.
- `storage/` — Runtime file-storage conventions and application-managed files, subject to access controls.

Verify the actual database engine, schema, connection configuration, migration mechanism, transaction behavior, backup strategy, and file-storage provider.

**Requirements:**

- Use parameterized database operations.
- Maintain schema and migration consistency.
- Use transactions for related database changes that must be atomic.
- Keep production data separate from test fixtures.
- Store private files outside publicly browsable directories.
- Enforce authorization before accessing private records or files.
- Document retention, deletion, backup, and recovery procedures.

The presence of a directory does not prove that a particular database or storage implementation is active.

### 2.4 Integration Layer

The integration layer encapsulates communication with external providers and services.

Potential integrations include:

- Email and verification-message delivery.
- Payment processing.
- AI-assisted functionality.
- File-storage services.
- External APIs and notification providers.

For each confirmed integration, document:

1. Provider and business purpose.
2. Configuration variables, without exposing secret values.
3. Authentication and request-signing requirements.
4. Request and response formats.
5. Timeouts, retries, and failure behavior.
6. Webhook processing and event validation, where applicable.
7. Idempotency and reconciliation requirements.
8. Logging, monitoring, and recovery procedures.

Keep provider-specific behavior behind clearly defined interfaces where practical. Do not describe an integration as active until its code, configuration, and operational behavior have been verified.

### 2.5 Operations and Quality

The operational architecture supports deployment, maintenance, diagnostics, reliability, and testing.

Relevant repository areas may include:

| Path | Intended responsibility |
|—|—|
| `scripts/` | Development, maintenance, build, migration, or deployment utilities |
| `tests/` | Automated tests and supporting fixtures |
| `infrastructure/` | Deployment and infrastructure configuration |
| `docs/` | Technical and operational documentation |

Verify each directory’s actual purpose from its contents and configuration.

Where implemented, operational responsibilities include:

- Dependency and configuration validation.
- Automated tests and API specification linting.
- Deployment and release workflows.
- Background-job execution.
- Logging and monitoring.
- Database backup and recovery.
- Secret management and incident response.

Do not infer that a queue, monitoring platform, deployment workflow, or backup system is operational merely because documentation describes it.

## 3. Architectural Boundaries

Use these logical boundaries when developing or reviewing the application.

```text
Presentation
    |
    v
HTTP Request Handling
    |
    v
Authentication, Authorization, and Validation
    |
    v
Business Logic
    |
    +———————+
    |                    |
    v                    v
Persistence         External Integrations
    |
    v
Database / Private Storage

Cross-cutting responsibilities:
Security, logging, auditing, testing, and operations
```

The boundaries describe responsibilities rather than requiring separate deployable services.

| Boundary | Responsibility | Must not |
|—|—|—|
| Presentation | Display information and collect input | Hold privileged secrets or enforce permissions only in the browser |
| Request handling | Route requests and apply middleware | Bypass required validation or authorization |
| Business logic | Enforce domain rules and state transitions | Trust client-submitted protected fields |
| Persistence | Manage durable records and storage operations | Expose private data without authorization |
| Integrations | Encapsulate provider communication | Treat unverified callbacks as trusted outcomes |
| Operations | Support deployment, diagnostics, and recovery | Expose credentials or sensitive operational data |

## 4. Typical Request Lifecycle

A typical server-backed request follows this logical sequence:

1. A client submits a request.
2. The application entry point receives the request.
3. Configured middleware applies request parsing, security controls, rate limiting, and request identification.
4. Authentication establishes the user or service identity when required.
5. Validation checks parameters, headers, query values, and payloads.
6. Authorization verifies permissions and resource ownership.
7. A route and controller dispatch the operation.
8. Business logic executes and accesses required data or integrations.
9. Required database changes are committed using appropriate transaction boundaries.
10. The application returns the documented HTTP status and response format.
11. Relevant operational logs and audit events are recorded without exposing sensitive information.

Static-page requests, provider webhooks, and asynchronous jobs may follow different paths.

The actual middleware order, mounted routes, error handling, and response format must be verified against the deployed application.

## 5. Security Principles

### 5.1 Identity and access control

- Authenticate protected operations on the server.
- Enforce permissions and ownership checks for private resources.
- Restrict administrative operations to authorized roles.
- Protect session lifecycle and expiration.
- Apply CSRF protection where appropriate for cookie-based authentication.
- Avoid disclosing the existence or contents of private records to unauthorized users.

### 5.2 Input and data protection

- Validate and normalize untrusted input.
- Prevent unauthorized mass assignment.
- Use parameterized database queries.
- Sanitize response fields and error messages.
- Keep credentials outside committed source code and browser-accessible assets.
- Protect private files with access controls and safe storage identifiers.
- Apply appropriate retention and deletion policies.

### 5.3 Payments and integrations

- Verify provider signatures using the actual provider protocol.
- Validate transaction references, amounts, currencies, and permitted state transitions.
- Handle duplicate events idempotently.
- Do not treat a browser redirect as proof of payment.
- Keep provider credentials server-side.
- Define safe retry and reconciliation behavior for partial failures.

### 5.4 Logging and operations

- Avoid logging passwords, full authentication tokens, payment secrets, or unnecessary personal information.
- Use request or correlation identifiers where supported.
- Restrict access to logs and audit records.
- Apply HTTPS in deployed environments.
- Configure rate limits and security headers based on the application’s threat model.
- Document the controls actually implemented separately from planned improvements.

## 6. Data Consistency and Failure Handling

Database transactions can protect related database changes, but they cannot generally roll back external payments, emails, or storage operations.

The architecture should define:

- Transaction boundaries for related database updates.
- Idempotency controls for retryable operations.
- Recovery behavior for partially completed uploads.
- Payment-event deduplication and reconciliation.
- Retry policies for transient integration failures.
- Cleanup and recovery procedures for failed background jobs.
- Audit behavior for sensitive state transitions.

Where reliable asynchronous dispatch is required, consider a transactional outbox or another durable dispatch mechanism. Treat this as a design option unless the implementation has been verified.

## 7. API Contract and Documentation

The intended API specification is:

`docs/api/openapi.yaml`

The API contract should remain consistent with:

- Mounted backend routes and supported HTTP methods.
- Request validation and response schemas.
- Authentication and authorization requirements.
- Status codes and error formats.
- Pagination and filtering behavior.
- Integration and webhook behavior.

Validate the OpenAPI specification using the project’s configured validator. Structural validation alone does not establish that the backend implements the documented behavior.

Update API documentation and contract tests when externally observable behavior changes.

## 8. Testing Strategy

The architecture should support the following testing levels:

| Test level | Objective |
|—|—|
| Unit | Verify isolated business rules and module behavior |
| Integration | Verify service, repository, database, and integration boundaries |
| API | Verify authentication, authorization, validation, and response contracts |
| Database | Verify migrations, constraints, transactions, and data integrity |
| Security | Verify ownership enforcement, privilege boundaries, sessions, and sensitive-data protection |
| End-to-end | Verify critical user journeys across frontend and backend |
| Accessibility | Verify keyboard operation, labels, focus behavior, and responsive usability |

Use synthetic test data and isolated resources. Never run destructive test procedures against production systems.

For sensitive workflows, test failure scenarios as well as successful execution, including unauthorized access, duplicate payment events, incomplete uploads, and failed background jobs.

## 9. Architecture Verification Workflow

Before publishing an architectural change:

1. Inspect the application entry point and startup configuration.
2. Verify the actual routes, controllers, middleware, services, and repositories.
3. Confirm the database engine, schema, migrations, and connection configuration.
4. Inspect file-upload, private-storage, and download behavior.
5. Identify active external providers and webhook configuration.
6. Verify worker entry points and scheduling mechanisms, if present.
7. Inspect deployment configuration, health checks, and CI workflows.
8. Run relevant automated tests and specification validation.
9. Update related architecture and API documentation.
10. Review the resulting changes before merging.

If a component cannot be verified, identify it as planned or unverified rather than presenting it as operational.

## 10. Related Documentation

- `folder-structure.md` — Repository directory responsibilities.
- `data-flow.md` — Request, document-upload, payment, and background-job flows.
- `../api/README.md` — API documentation standards, where present.
- `../api/openapi.yaml` — API contract, where present.

Use the repository’s actual filenames as the canonical references. Avoid maintaining duplicate documents that describe the same architecture independently.

## 11. Maintenance Checklist

- [ ] Architectural boundaries reflect the current implementation.
- [ ] Documented paths and modules have been verified.
- [ ] Database and storage technologies match actual configuration.
- [ ] Active integrations and webhook behavior are confirmed.
- [ ] Authentication and authorization boundaries are verified.
- [ ] Private documents and sensitive data are protected.
- [ ] Transactions, retries, and recovery behavior are documented.
- [ ] API contracts match mounted routes and actual responses.
- [ ] Relevant automated and security tests pass.
- [ ] Deployment and operational documentation is current.
- [ ] Proposed functionality is clearly distinguished from implemented functionality.

## 12. Definition of Done

An architectural change is complete when:

1. Its implementation and dependencies have been verified.
2. Security and data-access implications have been reviewed.
3. Related API contracts and documentation have been updated.
4. Relevant tests and validation pass.
5. Failure handling and recovery expectations are documented.
6. Unimplemented capabilities and unresolved assumptions are clearly identified.

**Accuracy principle:** The deployed implementation and its configuration are authoritative. This document describes intended design until each relevant component has been verified.
