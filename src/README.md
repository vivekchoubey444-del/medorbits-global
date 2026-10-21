
# MedOrbits — Source Code Architecture

**Directory:** `src/`  
**Project:** MedOrbits  
**Runtime:** Node.js >= 20

## 1. Overview

The `src/` directory contains the backend application modules responsible for HTTP request handling, business logic, data access, external integrations, validation, authorization, and background processing.

MedOrbits follows a modular architecture that separates application responsibilities into independently maintainable components. This separation supports testability, controlled dependencies, consistent error handling, and future scalability.

**Implementation principle:** Directory names and documentation describe architectural responsibilities. They do not, by themselves, prove that a feature, endpoint, integration, or workflow is implemented or production-ready.

## 2. Directory Structure

```text
src/
├── README.md
├── app.js
├── config/
├── controllers/
├── integrations/
│   ├── ai/
│   ├── email/
│   ├── payment/
│   └── storage/
├── jobs/
├── middleware/
├── models/
├── policies/
├── repositories/
├── routes/
├── services/
├── templates/
│   ├── email/
│   └── documents/
├── utils/
├── validators/
└── workers/
```

Maintain this structure according to the actual repository. Add a directory or module to this document only when it exists or has been deliberately approved as part of the architecture.

## 3. Module Responsibilities

| Module | Responsibility |
|—|—|
| `app.js` | Configures the Express application, middleware, route mounting, health endpoints, and centralized error handling. |
| `config/` | Centralizes environment loading, application settings, logging, security, CORS, and infrastructure configuration. |
| `controllers/` | Coordinates HTTP requests and responses. |
| `integrations/` | Encapsulates external providers and provider-specific implementations. |
| `jobs/` | Discovers eligible work and enqueues background tasks. |
| `middleware/` | Implements authentication, authorization, rate limiting, and request controls. |
| `models/` | Represents domain entities and database records. |
| `policies/` | Defines resource-level authorization and access rules. |
| `repositories/` | Encapsulates persistence operations and database queries. |
| `routes/` | Defines API endpoints and connects middleware to controllers. |
| `services/` | Implements business rules and coordinates application workflows. |
| `templates/` | Contains reusable email and document templates. |
| `utils/` | Provides reusable helpers that do not belong to a specific business domain. |
| `validators/` | Validates request data and domain-specific input. |
| `workers/` | Consumes queued tasks and executes background operations. |

### Integration modules

The `integrations/` directory separates external-provider concerns:

- `integrations/ai/` — AI provider configuration, client interfaces, and provider adapters.
- `integrations/email/` — Email client interfaces and delivery providers.
- `integrations/payment/` — Payment gateway clients, checkout operations, and webhook verification.
- `integrations/storage/` — File storage adapters and storage-related configuration.

Keep provider-specific SDK usage inside the relevant integration. Services should depend on stable application-level interfaces instead of spreading provider-specific logic throughout the codebase.

## 4. Application Architecture

The typical HTTP request flow is:

```text
HTTP Request
    |
    v
Routes
    |
    v
Middleware
    |
    v
Validators
    |
    v
Controllers
    |
    v
Services
    |
    +————> Integrations
    |
    v
Repositories / Models
    |
    v
HTTP Response
```

This is a logical flow, not a requirement that every request traverse every layer. Health endpoints, for example, may not require database access.

### Architectural rules

**Routes**
- Define URL paths, HTTP methods, and middleware ordering.
- Delegate request processing to controllers.
- Avoid embedding business rules in route declarations.

**Middleware**
- Enforce request-level controls before protected operations.
- Apply authentication and authorization consistently.
- Do not treat authentication alone as permission to access a resource.

**Validators**
- Validate untrusted input at system boundaries.
- Reject malformed identifiers, unsupported values, and invalid payloads.
- Do not replace database constraints or service-level business validation.

**Controllers**
- Translate HTTP input into service calls.
- Return appropriate HTTP status codes and response formats.
- Avoid direct database queries and provider-specific operations.

**Services**
- Own business rules and workflow coordination.
- Enforce eligibility and domain invariants.
- Coordinate repositories and integrations.
- Use transactions or other consistency controls where required.

**Repositories**
- Encapsulate database access.
- Parameterize queries and avoid unsafe SQL construction.
- Support explicit transaction boundaries when required by the service.

**Models**
- Represent domain records and their persistence-related behavior.
- Keep model responsibilities consistent with the selected database and ORM or query layer.

## 5. MedOrbits Functional Domains

The source architecture accommodates the following platform domains.

### Education and admissions
- Course and institution information.
- College and university discovery.
- Admissions guidance and eligibility workflows.
- Study-abroad guidance.
- Application tracking and supporting documents.

### Careers and recruitment
- Job and internship listings.
- Candidate profiles and applications.
- Employer registration and services.
- Recruitment coordination and applicant management.
- Career guidance and employment support.

### Accounts and administration
- Authentication and account verification.
- User profiles and permissions.
- Administrative workflows.
- Application and document management.
- Support and operational records.

### Payments and subscriptions
- Payment initiation and provider responses.
- Webhook verification.
- Payment-state reconciliation.
- Subscription workflows and payment records.

### Notifications and background processing
- Notification dispatch.
- Reminder scheduling.
- Cleanup planning and execution.
- Retry and failure handling.

These are architectural domains, not a claim that all associated functionality is implemented. Verify each capability against its routes, services, repositories, configuration, database schema, and provider setup.

## 6. Background Jobs and Workers

MedOrbits separates work discovery from work execution.

### `jobs/`

Job modules identify eligible work, construct bounded payloads, and enqueue tasks through injected queue adapters.

Expected responsibilities include:

- Finding eligible notifications.
- Discovering due reminders.
- Building cleanup plans.
- Applying batch limits.
- Generating stable job identifiers.
- Reporting enqueueing outcomes.

Jobs should not start scheduling timers or execute automatically when imported.

### `workers/`

Workers consume queued payloads and perform the requested operations.

Expected responsibilities include:

- Validating incoming payloads.
- Rechecking eligibility when necessary.
- Executing domain operations.
- Updating processing states.
- Handling retryable and permanent failures.
- Reporting outcomes through structured logging and monitoring.

### Background-processing safeguards

- Use UTC consistently for scheduling and timestamp comparisons.
- Apply bounded batches and controlled concurrency.
- Make worker operations idempotent.
- Prevent overlapping schedulers from creating unsafe duplicate work.
- Configure retry limits and dead-letter handling in the queue infrastructure.
- Enforce destructive-operation authorization inside the worker and domain service.
- Implement graceful shutdown for active workers.

Job modules do not independently select a scheduler or queue vendor. Configure those components separately.

## 7. Configuration and Dependency Management

Configuration belongs in `config/`. Provider-specific settings belong in their relevant integration modules.

Recommended practices:

- Validate required environment variables during startup.
- Keep secrets out of source control.
- Document required and optional settings in `.env.example`, if maintained.
- Use a secret manager or deployment environment for production credentials.
- Avoid scattering direct `process.env` access throughout business logic.
- Inject dependencies into jobs, workers, and services where practical.
- Fail startup when mandatory configuration is invalid.
- Keep development, staging, test, and production settings separate.

Do not log credentials, session tokens, API keys, payment secrets, or private document contents.

## 8. API and Error-Handling Standards

API endpoints should return predictable response formats and suitable HTTP status codes.

| Status | Meaning |
|—|—|
| `400` | Malformed or invalid request |
| `401` | Authentication required or invalid |
| `403` | Authenticated caller lacks permission |
| `404` | Resource not found or intentionally undisclosed |
| `409` | Conflicting state or duplicate operation |
| `413` | Request payload exceeds the allowed limit |
| `415` | Unsupported media type |
| `422` | Semantically invalid input, where adopted by the API |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error |
| `503` | Required service temporarily unavailable |

Use these conventions consistently across routes. If the application adopts a different status-code policy, document it centrally.

The centralized error handler should:

- Log diagnostic details on the server.
- Return safe, non-sensitive messages to clients.
- Avoid exposing stack traces, database errors, or internal paths.
- Delegate to Express when response headers have already been sent.
- Map known validation and infrastructure errors deliberately.

Do not assume Express automatically handles every asynchronous error in the same way across versions. Confirm the installed Express version and ensure rejected promises reach the error handler.

## 9. Security Requirements

Security controls must be enforced on the server, not merely through frontend behavior.

### Authentication and authorization
- Authenticate protected requests.
- Check resource ownership and permissions on every sensitive operation.
- Apply least-privilege access to administrative functions.
- Prevent insecure direct-object-reference vulnerabilities.

### Input and request handling
- Validate path parameters, query parameters, and request bodies.
- Enforce request-size limits.
- Apply appropriate rate limits.
- Configure CORS for explicitly permitted origins.
- Configure proxy trust only for the actual hosting topology.

### Documents and uploads
- Store private documents outside publicly served directories.
- Restrict file types and file sizes.
- Verify access permissions before download or modification.
- Use safe filenames and controlled storage keys.
- Consider malware scanning and retention controls where appropriate.

### Payments
- Verify webhook signatures using the original raw request body where required.
- Enforce idempotent payment processing.
- Validate payment state against the provider and persisted records.
- Do not trust client-supplied payment status or amounts.
- Verify payment amounts, currencies, and order associations before fulfilling an order or activating a subscription.

### Logging and privacy
- Exclude passwords, authentication tokens, payment credentials, and private document contents from logs.
- Restrict access to operational logs.
- Apply appropriate retention and deletion policies to personal data.

## 10. Templates and Generated Documents

The `templates/` directory contains reusable presentation templates.

```text
templates/
├── email/
└── documents/
```

Use templates for consistent communication and document generation. Keep template rendering separate from business rules.

For user-supplied values:

- Escape content according to the output format.
- Avoid inserting untrusted strings into executable HTML or markup.
- Keep private application data out of public templates.
- Verify document permissions before generating or serving protected documents.
- Test generated output for missing values and malformed content.

## 11. Testing Strategy

Place tests according to the conventions established by the repository’s test configuration.

| Test category | What to verify |
|—|—|
| Unit tests | Service rules, validators, utilities, and error mapping. |
| API tests | Routes, middleware, status codes, and response contracts. |
| Repository tests | Database queries, constraints, and transaction behavior. |
| Authorization tests | Role permissions, ownership checks, and restricted operations. |
| Integration tests | External-provider adapters and failure handling. |
| Payment tests | Webhook signatures, duplicate events, and payment-state transitions. |
| Job tests | Batch limits, enqueue failures, idempotency, and malformed service responses. |
| Worker tests | Payload validation, retries, state transitions, and safe replay. |
| Security tests | Input validation, access control, request limits, and information disclosure. |

Use mocks for isolated unit tests and appropriate test databases or provider sandboxes for integration tests.

## 12. Development Workflow

1. Read the repository-level `README.md`.
2. Inspect `package.json` for the supported runtime and commands.
3. Configure environment variables using the documented template.
4. Confirm database, queue, and provider requirements.
5. Implement changes in the appropriate module.
6. Add or update tests.
7. Run available linting, test, and validation commands.
8. Update documentation when interfaces or configuration change.
9. Test the deployment in staging.
10. Deploy to production only after required configuration, security checks, and operational safeguards are verified.

Do not document a command as available unless it exists in `package.json` or the repository’s development tooling.

## 13. Production-Readiness Checklist

- [ ] Required environment variables are validated.
- [ ] Database connectivity and migrations are verified.
- [ ] Routes are mounted before the 404 handler.
- [ ] Authentication and resource-level authorization are enforced.
- [ ] Request validation and rate limiting are configured.
- [ ] Health and readiness checks reflect their intended purposes.
- [ ] Payment webhooks use signature verification and idempotent processing.
- [ ] Private documents have controlled storage and access.
- [ ] Background jobs use bounded batches and stable identifiers.
- [ ] Workers validate payloads and handle failures safely.
- [ ] Logging avoids secrets and unnecessary personal data.
- [ ] Tests and security checks run in the deployment workflow.
- [ ] Backup, recovery, monitoring, and shutdown procedures are documented.

A checked item should represent a verified implementation, not merely an intended design.

## 14. Maintenance Policy

Keep this document aligned with the actual repository.

When changing the source architecture:

1. Update the directory tree.
2. Document new module responsibilities.
3. Record changes to exported interfaces and dependency contracts.
4. Update configuration documentation.
5. Add or update relevant tests.
6. Remove references to deleted or unsupported functionality.

## 15. Related Documentation

Consult the relevant repository documentation for:

- Root `README.md` — project setup and overview.
- `package.json` — runtime requirements and available commands.
- `.env.example` — documented environment variables, if present.
- `src/config/` — configuration modules.
- `src/integrations/` — provider adapters and their configuration.
- `src/jobs/README.md` — scheduled-job contracts, if present.
- `src/workers/README.md` — worker execution contracts, if present.
- `tests/` — test organization, if present.
- `infrastructure/` — deployment, monitoring, backup, and recovery documentation, if present.

## Implementation Status

This README describes the intended source-code architecture. Confirm that each documented directory, interface, endpoint, and workflow exists and is wired into the application before treating it as implemented or production-ready.

—

**MedOrbits — Study · Work · Grow**

Modular backend architecture for education, admissions, careers, recruitment, and platform operations.
