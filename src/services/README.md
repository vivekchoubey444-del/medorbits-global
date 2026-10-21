
# MedOrbits Services Layer

**Directory:** `src/services/`

**Runtime:** Node.js >= 20  
**Module system:** CommonJS  
**Architecture:** Dependency-injected business services

## 1. Purpose

The services layer implements business rules and coordinates workflows between HTTP controllers, repositories, and external integrations.

Services must remain independent of Express request and response objects, concrete database drivers, and provider SDK initialization.

This architecture improves testability, maintainability, provider independence, and separation of concerns.

**Important:** The existence of a service module does not establish that its repository adapters, security controls, integrations, or production workflows are complete.

## 2. Directory Structure

```text
src/services/
├── README.md
├── auth.service.js
├── session.service.js
├── verification.service.js
├── password.service.js
├── user.service.js
├── course.service.js
├── college.service.js
├── university.service.js
├── admission.service.js
├── application.service.js
├── counselling.service.js
├── document.service.js
├── storage.service.js
├── job.service.js
├── internship.service.js
├── candidate.service.js
├── employer.service.js
├── recruitment.service.js
├── search.service.js
├── notification.service.js
├── email.service.js
├── payment.service.js
├── subscription.service.js
├── analytics.service.js
├── audit.service.js
└── service-utils.js
```

Keep this directory synchronized with the actual repository. Do not list modules as implemented until their files and exports have been verified.

## 3. Service Responsibilities

| Service | Responsibility |
|—|—|
| `auth.service.js` | Registration, login, token refresh, logout orchestration |
| `session.service.js` | Session creation, validation, revocation |
| `verification.service.js` | Email verification tokens and resend workflows |
| `password.service.js` | Password reset/change and session invalidation |
| `user.service.js` | User profiles and authorized account management |
| `course.service.js` | Course catalog operations |
| `college.service.js` | College catalog and publication workflows |
| `university.service.js` | University catalog and publication workflows |
| `admission.service.js` | Admission lifecycle coordination |
| `application.service.js` | Application submission and status transitions |
| `counselling.service.js` | Counselling records and workflow coordination |
| `document.service.js` | Document metadata, review, and access controls |
| `storage.service.js` | Private file storage through injected adapters |
| `job.service.js` | Job listings and lifecycle management |
| `internship.service.js` | Internship listings and lifecycle management |
| `candidate.service.js` | Candidate profiles and employment workflows |
| `employer.service.js` | Employer profiles and verification workflows |
| `recruitment.service.js` | Recruitment workflow coordination |
| `search.service.js` | Bounded multi-source search |
| `notification.service.js` | Notification orchestration and delivery-state tracking |
| `email.service.js` | Email validation, template orchestration, and delivery |
| `payment.service.js` | Payment operations, webhook handling, and state transitions |
| `subscription.service.js` | Subscription lifecycle and recurring-payment coordination |
| `analytics.service.js` | Approved analytics aggregation and reporting |
| `audit.service.js` | Security and business audit records |
| `service-utils.js` | Shared validation, errors, pagination, and audit helpers |

Actual exports, method signatures, and repository requirements are authoritative. This table documents intended responsibilities, not verified implementation status.

## 4. Dependency Injection

Services should export factory functions that accept their dependencies explicitly.

Example:

```javascript
‘use strict’;

const { createJobService } = require(‘../services/job.service’);

const jobService = createJobService({
  jobRepository,
  auditService,
});

const jobs = await jobService.list({
  page: 1,
  limit: 20,
});
```

The example assumes that the actual job service and repository support the shown methods and signatures. Verify their contracts before integrating.

### Dependency injection rules

- Pass repositories, provider wrappers, and other justified dependencies through factory arguments.
- Validate required dependencies during service construction.
- Avoid importing concrete database drivers into business services.
- Avoid creating provider clients inside request handlers.
- Avoid unnecessary service-to-service dependencies and circular imports.
- Keep dependencies straightforward to mock.
- Do not pass Express `req` or `res` objects into business services.

### Dependency lifecycle

Construct service instances in the application composition layer and inject them into controllers, jobs, and workers as needed.

Services should not recreate the dependency graph for each HTTP request.

## 5. Repository Contracts

Standard repository operations may include:

```javascript
list({
  page,
  limit,
  offset,
  filters,
  sortBy,
  sortOrder,
});

findById(id);
create(data);
updateById(id, data);
deleteById(id);
```

Specialized repositories may instead expose methods such as `findMany`, `findByEmail`, `updateIfStatusMatches`, `consumeValidTokenAndActivateUser`, or `processWebhookEvent`.

These methods must have documented input, output, error, and atomicity contracts.

### Repository requirements

- Use parameterized database queries.
- Enforce appropriate database constraints and unique indexes.
- Define pagination and sorting behavior explicitly.
- Allowlist sortable fields.
- Apply transactions to workflows requiring atomic state changes.
- Return consistent representations for missing records and update conflicts.
- Document transaction boundaries and concurrency behavior.
- Keep persistence concerns out of controllers.

Do not assume every repository implements the same interface unless the shared repository contract guarantees it.

## 6. Business Logic and Error Handling

Services own domain rules and coordinate repository and integration calls.

They should:

- Validate business invariants and state transitions.
- Enforce ownership and authorization policies where applicable.
- Coordinate repository and provider operations.
- Use transactions, conditional updates, or other consistency controls where necessary.
- Return documented results or throw predictable application errors.
- Avoid returning database internals, credentials, or raw provider errors.
- Distinguish validation failures, authorization failures, conflicts, and infrastructure errors.
- Avoid silently swallowing failures that affect business correctness.

Controllers translate service outcomes into the API’s established HTTP response format.

Audit failures should follow an explicit policy appropriate to the event. For critical security or financial events, durable audit recording may need to participate in a transaction or use an outbox.

## 7. Authentication and Account Security

### Password handling

- Use a maintained password-hashing implementation such as Argon2id or bcrypt.
- Inject a `passwordHasher` interface with `hash()` and `verify()` methods.
- Never store plaintext passwords or reversible password representations.
- Apply documented password and recovery policies.
- Use consistent public responses for account-recovery requests.
- Preserve the intended password input exactly; do not silently normalize passwords unless the policy explicitly requires it.

### Token and session management

- Use short-lived access tokens where appropriate.
- Use rotating, revocable refresh tokens.
- Store only refresh-token hashes when tokens are persisted.
- Detect refresh-token reuse where supported by the chosen design.
- Revoke relevant sessions after password changes and security-sensitive events.
- Validate token expiry, issuer, audience, and signing configuration as applicable.
- Protect cookies using appropriate `HttpOnly`, `Secure`, and `SameSite` settings.

### Abuse prevention

Apply login throttling, credential-stuffing defenses, account-recovery rate limits, email verification, and multifactor authentication according to the application’s risk profile.

Route-level authentication and authorization remain mandatory. The existence of a service method does not authorize arbitrary callers to invoke it.

## 8. Education, Admissions, and Applications

Education and admissions services coordinate catalog data, eligibility rules, applications, and supporting records.

Required controls include:

- Validate identifiers and allowed state transitions.
- Distinguish user-submitted information from institution-verified information.
- Enforce ownership and role-based access.
- Prevent duplicate submissions where business rules require uniqueness.
- Use transactions for related database changes.
- Preserve appropriate audit history.
- Validate important eligibility rules against authoritative data.

Do not present an application summary, counselling document, or generated report as official institutional confirmation unless the relevant verification and issuance workflow supports that claim.

## 9. Documents and Storage

Document services coordinate metadata, access checks, storage operations, and lifecycle policies.

Required safeguards include:

- Private storage and unpredictable object keys.
- File-size limits and content validation.
- Server-side MIME detection and file-signature checks.
- Malware scanning where appropriate.
- Authorization before document retrieval or modification.
- Short-lived signed URLs where supported.
- Retention, deletion, and cleanup policies.
- Audit records for sensitive document operations.

Never trust a client-supplied filename or MIME type as proof of file content.

Keep storage SDKs and provider-specific operations inside the established integration or adapter boundary, such as `src/integrations/storage/`, if that directory exists in the repository.

Deletion workflows should be retryable. If database state changes but object deletion fails, record the failure and provide a durable cleanup mechanism.

## 10. Careers and Recruitment

Career services coordinate jobs, internships, candidates, employers, and recruitment workflows.

Apply:

- Explicit update-field allowlists.
- Resource ownership and role-based authorization.
- Approved state transitions.
- Bounded pagination and search results.
- Privacy controls for candidate profiles and resumes.
- Employer verification and listing-publication rules.
- Audit records for privileged or consequential changes.

Search results and recruitment records must not expose confidential candidate information to unauthorized users.

## 11. Notifications and Email

Notification and email services coordinate message preparation, delivery, and delivery-state tracking.

Required safeguards include:

- Validate recipients and template variables.
- Render trusted templates with context-appropriate escaping.
- Restrict action URLs to approved origins.
- Avoid sensitive information in subjects and previews.
- Keep queued, sending, sent, delivered, and failed states distinct where the provider supports those distinctions.
- Use idempotency and durable delivery records.
- Retry transient failures with bounded backoff.
- Avoid logging full messages, verification tokens, reset tokens, or sensitive payloads.

Use the established jobs and workers architecture for asynchronous delivery where available.

A provider accepting a message does not prove that it reached the recipient’s inbox.

## 12. Payments and Subscriptions

Payment and subscription workflows require durable state management and strict provider verification.

### Payment processing

- Verify webhook signatures against the exact raw request body when required.
- Validate provider event types, identifiers, amounts, currencies, and references.
- Persist event identifiers to prevent duplicate processing.
- Apply database transactions and appropriate uniqueness constraints.
- Reconcile provider state with persisted payment records.
- Never treat a browser redirect as proof of payment.
- Keep provider secrets in environment or secret-manager configuration.
- Never log payment credentials or unnecessary sensitive payloads.

### Subscription workflows

- Define explicit subscription-state transitions.
- Handle renewals, failures, cancellations, and expiry.
- Make repeated webhook and worker execution safe.
- Use authoritative provider events and persisted records.
- Document retry and reconciliation behavior.
- Keep local and provider state consistent through transactions, idempotency, and reconciliation procedures.

Payment idempotency must be enforced across relevant database and provider boundaries. A unique queue job identifier alone is insufficient.

## 13. Analytics and Auditing

Analytics and audit services have different purposes.

### Analytics

- Produces approved aggregates and operational insights.
- Enforces access restrictions on sensitive reports.
- Minimizes collection of personal information.
- Applies retention and aggregation policies.

### Audit

- Records relevant security and business events.
- Captures actor, action, target, timestamp, and outcome where appropriate.
- Excludes passwords, tokens, payment credentials, and document contents.
- Restricts access to audit records.
- Applies appropriate retention and integrity controls.

Ordinary application logs are not a substitute for a durable audit trail.

## 14. Shared Service Utilities

`service-utils.js` may centralize:

- Dependency and input validation.
- Safe pagination and bounded limits.
- Standard application errors.
- Repository-method compatibility helpers.
- Common audit helpers.

Keep utilities small, predictable, and independently testable.

Avoid placing domain-specific business rules in the shared utility module. Security-sensitive operations should have explicit contracts and dedicated tests.

## 15. Composition and Application Bootstrap

Use a dedicated composition layer, such as `src/container.js`, if consistent with the actual repository architecture.

The composition layer should:

1. Load and validate configuration.
2. Initialize infrastructure adapters.
3. Construct repositories.
4. Construct integrations and provider wrappers.
5. Construct domain services.
6. Inject services into controllers, jobs, and workers.
7. Coordinate startup, readiness, and graceful shutdown.

Before wiring a service, confirm that its required dependencies and exported methods match the actual repository and controller interfaces.

## 16. Testing Requirements

- [ ] Required dependencies are validated.
- [ ] Business rules are tested independently of Express.
- [ ] Repository interactions follow documented contracts.
- [ ] Authorization is tested at route and policy layers.
- [ ] Database constraints and transactions are tested.
- [ ] Authentication, refresh-token rotation, and revocation are tested.
- [ ] Account-recovery responses do not expose account existence.
- [ ] Payment webhooks use raw-body fixtures and signature verification.
- [ ] Duplicate payment events are handled safely.
- [ ] File-access restrictions are tested.
- [ ] Notification retries and idempotency are tested.
- [ ] Audit records exclude secrets and unnecessary personal data.
- [ ] Concurrency-sensitive transitions are tested.
- [ ] Integration failures follow documented handling policies.
- [ ] Tests do not access production databases or live payment accounts.

Use mocks for unit tests and suitable test databases or provider sandboxes for integration tests.

## 17. Production Readiness Checklist

Before enabling real users or accepting payments, verify:

- [ ] Concrete repository adapters and database constraints.
- [ ] Database migrations and transaction behavior.
- [ ] Password hashing, session management, and token rotation.
- [ ] Login abuse prevention and account-recovery safeguards.
- [ ] Route-level authentication and resource authorization.
- [ ] Payment webhook verification and event idempotency.
- [ ] Private storage, file validation, and retention policies.
- [ ] Notification retries and delivery-state handling.
- [ ] Durable audit records, monitoring, and alerting.
- [ ] Dependency-aware readiness checks.
- [ ] Backup, recovery, and graceful-shutdown procedures.
- [ ] Applicable Indian data-protection, consumer-protection, and payment requirements.

This checklist describes required verification. It does not certify that the controls are already implemented.

## 18. Implementation Status

This README documents the intended architecture and integration contracts.

Before considering a workflow implemented or production-ready, verify:

1. The service file exists and exports the expected factory.
2. Required repository methods are implemented.
3. Controllers, routes, jobs, and workers are wired correctly.
4. Authorization and validation are enforced.
5. Database constraints and concurrency controls exist.
6. Provider configuration and failure handling are correct.
7. Unit and integration tests cover the documented behavior.

Update this document whenever the actual service contracts or directory structure change.

—

**MedOrbits — Study · Work · Grow**

Dependency-injected business services for education, admissions, careers, recruitment, and platform operations.
