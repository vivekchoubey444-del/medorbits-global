
# MedOrbits System Architecture Overview

**Project:** MedOrbits  
**Architecture:** Layered web application  
**Backend:** Node.js and Express-style application, where implemented  
**Database:** MySQL, subject to configuration verification  
**Document:** `docs/architecture/system-architecture.md`  
**Status:** Logical architecture reference; implementation and deployment verification required

## 1. Purpose

MedOrbits is designed as an education and career services platform supporting public information, authenticated accounts, educational applications, career services, recruitment, subscriptions, administrative workflows, and backend APIs.

The architecture separates presentation, HTTP request handling, business logic, persistence, external integrations, and operational responsibilities. These boundaries are intended to improve maintainability, security, testability, and future extensibility.

This document defines the intended architecture. It does not establish that every described module, integration, or operational capability is implemented or active.

**Source of truth:** The checked-out source code, mounted routes, validated configuration, database schema, and deployed runtime determine actual implementation status.

## 2. Logical Architecture

```mermaid
flowchart TD
    U[“Visitors and Users”]
    E[“Employers”]
    A[“Administrators”]

    subgraph Presentation[“1. Presentation Layer”]
        P[“Public Pages”]
        AC[“Account Pages”]
        ED[“Education and Career Pages”]
        AD[“Admin Interface”]
        AS[“Shared Public Assets”]
    end

    subgraph HTTP[“2. HTTP Application Layer”]
        MW[“Security and Request Middleware”]
        RT[“Routes and Controllers”]
    end

    subgraph Business[“3. Business Services Layer”]
        US[“Users and Authentication”]
        ES[“Education and Applications”]
        CS[“Career and Employer Services”]
        DS[“Documents and Notifications”]
        PS[“Payments and Subscriptions”]
    end

    subgraph Persistence[“4. Persistence Layer”]
        DB[(“MySQL Database”)]
        MIG[“SQL Migrations and Seeds”]
        ST[“Private File Storage”]
    end

    subgraph Integrations[“5. External Integrations”]
        EM[“Email Provider”]
        AI[“AI Provider”]
        PG[“Payment Provider”]
    end

    subgraph Operations[“6. Operations Layer”]
        WK[“Background Workers and Jobs”]
        MON[“Monitoring and Logs”]
        CI[“Deployment and CI”]
        BK[“Backups and Recovery”]
    end

    U —> P
    U —> AC
    U —> ED
    E —> ED
    A —> AD

    P —> MW
    AC —> MW
    ED —> MW
    AD —> MW

    MW —> RT
    RT —> Business

    Business —> DB
    MIG —> DB
    DS —> ST
    Business —> EM
    Business —> AI
    PS <—> PG

    Business —> WK
    WK —> DB

    HTTP —> MON
    Business —> MON
    WK —> MON

    CI —> HTTP
    BK —> DB
```

The diagram describes logical relationships, not verified runtime connections, deployment topology, or network boundaries. A diagram arrow does not establish that an integration is configured or operational.

## 3. Architectural Layers

### 3.1 Presentation Layer

**Responsibility:** Provide user interfaces and browser-side interaction.

Expected areas include:

- Public information and landing pages.
- Account registration, login, and dashboards.
- Education, admissions, and study-abroad pages.
- Job, internship, and employer pages.
- Administrative interfaces.
- Legal notices and policy pages.
- Shared CSS, browser JavaScript, images, icons, and public data.

Requirements:

- Keep sensitive business rules out of browser-only logic.
- Use documented API contracts for backend communication.
- Provide accessible forms and clear loading, empty, success, and error states.
- Do not embed server-side secrets or trust browser-submitted authorization decisions.
- Keep private documents and sensitive data out of publicly served directories.
- Enforce protected operations through backend authorization.

### 3.2 HTTP Application Layer

**Responsibility:** Receive requests, apply middleware, route operations, and produce HTTP responses.

Expected responsibilities include:

- Request parsing and size limits.
- Security headers and rate limiting.
- Request identification and safe logging.
- Authentication and authorization.
- Route definitions and controllers.
- Request validation and error handling.
- Consistent response formats.

Controllers should coordinate HTTP requests and delegate business operations to services. Avoid duplicating business rules across controllers.

Verify the actual middleware order, router prefixes, mounted routes, and error-handling behavior before documenting them as implemented.

### 3.3 Business Services Layer

**Responsibility:** Enforce application rules and coordinate domain operations.

| Domain | Responsibility |
|—|—|
| Users and authentication | Account lifecycle, verification, sign-in, and session management |
| Education | Courses, colleges, universities, and admissions |
| Applications | Application creation, validation, review, and status transitions |
| Careers | Jobs, internships, employer workflows, and career support |
| Documents | Upload metadata, review, access control, and retention |
| Notifications | Notification preferences, delivery, and status tracking |
| Payments | Payment initiation, provider verification, and transaction state |
| Subscriptions | Plan assignment, billing lifecycle, and entitlement management |
| Administration | Authorized management operations and privileged changes |

These are logical domains, not a requirement to create one service or microservice per row. They may be implemented as modules within a single Node.js application.

Requirements:

- Enforce business rules in trusted backend code.
- Validate state transitions before persistence.
- Keep provider-specific behavior behind integration boundaries.
- Check ownership and authorization for every protected resource.
- Make important business rules independently testable.
- Return explicit, controlled errors for invalid operations.

### 3.4 Persistence Layer

**Responsibility:** Store and retrieve durable application data.

The intended relational database is MySQL. Confirm the configured driver, server version, connection settings, schema, and migration process before relying on this assumption.

Expected responsibilities include:

- Database schema and versioned migrations.
- Data access and query execution.
- Transaction management.
- Referential integrity and indexes.
- Seed data and isolated test fixtures.
- Data retention and recovery support.

Requirements:

- Use parameterized queries or an appropriate database abstraction.
- Use transactions for related changes that must be atomic.
- Enforce database constraints where appropriate.
- Keep schema changes synchronized with migrations.
- Avoid logging credentials or unnecessary sensitive values.
- Test migration and recovery procedures against the actual database engine.

Private files should use a suitable private-storage mechanism rather than treating the relational database as a file-storage service by default.

### 3.5 Integration Layer

**Responsibility:** Connect MedOrbits to external systems.

Potential integrations include:

- Email and verification-message providers.
- AI services.
- Payment-provider checkout and webhooks.
- Private file-storage services.
- Other business-required external APIs.

Requirements:

- Keep credentials in environment configuration or an appropriate secrets manager.
- Validate external responses and provider events.
- Configure timeouts and bounded retries.
- Use idempotency for operations that may be repeated.
- Handle provider outages and partial failures.
- Never treat browser redirects as proof of payment.
- Avoid leaking provider-specific secrets or internal error details.

An integration is considered active only after its implementation, configuration, and operational behavior have been verified.

### 3.6 Operations Layer

**Responsibility:** Support deployment, reliability, maintenance, and observability.

Expected capabilities include:

- Automated testing and validation.
- Deployment workflows.
- Background workers and scheduled jobs.
- Logging and monitoring.
- Database backups and recovery.
- Configuration and secret management.
- Incident response and operational troubleshooting.

Verify the actual hosting platform, queue system, scheduler, monitoring tools, backup process, and CI workflow. Do not infer operational readiness from the presence of a configuration file alone.

## 4. Core Request Lifecycle

A typical HTTP request follows this logical sequence:

1. The client requests a public page or API resource.
2. The server applies configured request-processing middleware.
3. Authentication identifies the current user when required.
4. Validation checks request parameters, headers, query values, and payloads.
5. Authorization verifies permissions and resource ownership.
6. A controller invokes the appropriate business service.
7. The service applies business rules and coordinates persistence or integrations.
8. Required database changes are committed using appropriate transaction boundaries.
9. The server returns the documented response and HTTP status.
10. Safe operational logs and relevant audit events are recorded.

The exact sequence must match the implemented server. Middleware ordering should be reviewed carefully, especially for webhook raw-body capture, request parsing, rate limiting, authentication, and centralized error handling.

## 5. Security Architecture

Security controls apply across all layers.

### Identity and access

- Authenticate protected operations on the server.
- Enforce authorization for private resources and sensitive actions.
- Apply least-privilege permissions.
- Validate session state, expiration, and renewal behavior.
- Configure secure session-cookie attributes where cookie authentication is used.
- Apply CSRF protection where relevant to cookie-authenticated state-changing requests.
- Protect administrative operations with explicit role or permission checks.

### Input and data protection

- Validate and normalize untrusted input.
- Use parameterized database operations.
- Prevent mass assignment of protected fields.
- Sanitize response data to avoid exposing private records.
- Validate file content and enforce private-download authorization.
- Keep secrets out of client-side code and version control.
- Restrict access to administrative data, logs, and audit records.

### Payments and asynchronous work

- Verify payment-provider signatures using the actual provider protocol.
- Validate amounts, currencies, transaction references, and permitted state transitions.
- Apply idempotency to payment events and retryable jobs.
- Protect workers and queues with appropriate access controls.
- Record security-relevant outcomes without logging sensitive credentials.
- Define recovery procedures for partial failures.

## 6. Data Flow and Consistency

### Database operations

Use transactions where related database changes must be atomic. A database transaction cannot generally roll back an external email, payment, or file-storage operation.

### Document handling

Store private documents outside publicly browsable directories. Check authorization on each retrieval and mutation, and reconcile file metadata with actual storage state.

### Payment processing

Derive payment status from trusted server-side records after the required provider verification. Duplicate events and retries must not apply the same financial change more than once.

### Background processing

Workers should validate jobs, recheck relevant business conditions, and make repeatable operations idempotent where necessary. Use bounded retries and a documented process for exhausted jobs.

### Durable asynchronous dispatch

Where reliable delivery is necessary, consider a transactional outbox or equivalent durable dispatch mechanism. Update business state and create the dispatch record in the same database transaction, then publish the event asynchronously.

This is an architectural option, not a claim that MedOrbits currently implements an outbox.

## 7. API Contract and Documentation

The intended API specification is:

`docs/api/openapi.yaml`

Keep it aligned with:

- Actually mounted backend routes.
- Request validation and response schemas.
- Authentication and authorization requirements.
- HTTP status codes and error envelopes.
- Pagination and filtering behavior.
- Payment-provider and webhook behavior.

Validate the specification using the project’s selected validator in CI. Structural validation does not prove that an endpoint exists or behaves as documented. Backend review and integration tests remain necessary.

## 8. Testing Strategy

The architecture should support testing at multiple levels:

| Test type | Purpose |
|—|—|
| Unit | Verify isolated business rules and module behavior |
| Integration | Verify service, repository, database, and integration boundaries |
| API | Verify authentication, authorization, validation, and response contracts |
| Database | Verify migrations, constraints, transactions, and integrity |
| Security | Verify ownership enforcement, privilege boundaries, session behavior, and sensitive-data protection |
| End-to-end | Verify important user journeys across frontend and backend |
| Accessibility | Verify keyboard operation, labels, focus management, and responsive usability |

Use synthetic test data and isolated resources. Never run destructive test procedures against production systems.

Payment, document-upload, and background-job tests should include failure paths, retries, duplicate events, and partial-success scenarios where relevant.

## 9. Design Principles

1. **Separation of concerns:** Keep presentation, HTTP handling, business logic, persistence, and integrations distinct.
2. **Server-side authority:** Enforce permissions and business rules in trusted backend components.
3. **Least privilege:** Grant users and services only the permissions they require.
4. **Data integrity:** Use transactions, constraints, and idempotency where appropriate.
5. **Privacy by design:** Minimize sensitive-data exposure and define retention policies.
6. **Operational resilience:** Handle timeouts, retries, outages, and partial failures deliberately.
7. **Documentation accuracy:** Distinguish proposed components from verified implementation.
8. **Testability:** Keep important business rules and integration boundaries testable.
9. **Maintainability:** Prefer clear module responsibilities and consistent interfaces.
10. **Secure defaults:** Fail closed when required authorization, configuration, or verification is unavailable.

## 10. Implementation Verification Checklist

- [ ] Confirm the actual Node.js version and HTTP framework configuration.
- [ ] Verify mounted routes, router prefixes, and middleware ordering.
- [ ] Confirm MySQL configuration, schema, and migration workflow.
- [ ] Identify implemented domain services and data-access patterns.
- [ ] Verify private file-storage and download controls.
- [ ] Confirm active email, AI, and payment integrations.
- [ ] Verify payment signature validation and idempotency behavior.
- [ ] Confirm background-worker and scheduled-job execution.
- [ ] Verify logging, monitoring, backup, and recovery procedures.
- [ ] Validate OpenAPI documentation against mounted routes.
- [ ] Run relevant automated, integration, and security tests.
- [ ] Update this document when the architecture changes.

## 11. Definition of Done

An architectural change is ready for release when:

1. The implementation matches the documented design.
2. Authentication, authorization, and resource ownership are verified.
3. Data consistency and partial-failure behavior are defined.
4. Relevant automated and security tests pass.
5. Operational recovery procedures are documented where needed.
6. API documentation and deployment configuration are synchronized.
7. Unimplemented or unverified capabilities are explicitly identified.

**Maintenance principle:** Keep MedOrbits modular, secure, testable, and operationally reliable. Architecture documentation must reflect the actual implementation and must not imply that planned components are already production-ready.
