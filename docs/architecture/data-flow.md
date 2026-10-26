
# MedOrbits Application Data Flow

**Directory:** `docs/architecture/`  
**Document:** `application-data-flow.md`  
**Status:** Architecture guidance — implementation verification required  
**Scope:** HTTP requests, document uploads, payments, background jobs, consistency, and observability

## 1. Purpose

This document defines the intended data-flow architecture for MedOrbits, an education consultancy, admissions guidance, career services, recruitment, and student services platform.

It establishes security and reliability requirements for handling requests, personal documents, payments, asynchronous tasks, and database operations.

**Documentation rule:** A flow described here is not proof that the corresponding functionality exists. Verify the actual routes, middleware, controllers, services, database, storage provider, payment integration, queue, and deployment configuration before treating any flow as implemented.

## 2. Architecture Overview

The logical application flow is:

```text
Client / Browser
       |
       v
HTTP Server and Middleware
       |
       v
Route Matching
       |
       v
Authentication and Authorization
       |
       v
Request Validation
       |
       v
Controller
       |
       v
Application Service
       |
       +——————+
       |                  |
       v                  v
Repository / Database   External Integrations
       |                  |
       +———+———+
                |
                v
        Response / Job Dispatch
                |
                v
       Logging and Audit Events
```

This is a conceptual model. The deployed implementation may use a different middleware order or service structure.

## 3. Typical HTTP Request

### 3.1 Intended lifecycle

1. **Receive:** The server receives an HTTP request.
2. **Identify:** Configured middleware assigns or propagates a request or correlation identifier.
3. **Protect:** Security headers, request-size limits, rate limits, and other applicable protections are applied.
4. **Parse:** The server parses the permitted content types and request formats.
5. **Authenticate:** Protected routes identify the current user or service identity.
6. **Validate:** Request parameters, headers, query values, and body fields are validated.
7. **Authorize:** The server checks permissions, roles, ownership, and the requested state transition.
8. **Execute:** The controller delegates business logic to an application service.
9. **Persist:** The service performs database operations and coordinates required side effects.
10. **Respond:** The server returns the documented HTTP status and response envelope.
11. **Observe:** Operational logs, metrics, and audit events are recorded through configured mechanisms.

The precise ordering of parsing, security middleware, authentication, validation, and error handling must match the deployed server.

### 3.2 Requirements

- Enforce authentication and authorization on the server.
- Validate input before executing business operations.
- Verify ownership of applications, documents, notifications, payments, and other user-specific records.
- Use transactions for related database changes that must be atomic.
- Avoid logging credentials, authentication tokens, payment secrets, or unnecessary personal data.
- Return consistent, sanitized error responses.
- Do not treat an external service response as proof that a database transaction committed.
- Prevent clients from setting protected fields such as roles, ownership identifiers, payment status, or calculated prices.

### 3.3 Failure behavior

Errors should be handled according to their actual cause:

| Condition | Expected behavior |
|—|—|
| Invalid input | Return a validation error without executing the operation |
| Missing authentication | Reject access to protected resources |
| Insufficient permission | Reject the operation without disclosing private records |
| Missing resource | Return the application’s documented not-found response |
| Dependency unavailable | Return a safe service error and preserve recoverable state |
| Unexpected failure | Return a sanitized server error and record diagnostic context securely |

The status codes and error envelope must match the actual API contract.

## 4. Document Upload Flow

MedOrbits may handle application forms, identity documents, educational certificates, resumes, and other sensitive files.

### 4.1 Intended lifecycle

```text
Authenticated Request
        |
        v
Purpose and Permission Check
        |
        v
File and Request Validation
        |
        v
Generate Random Storage Key
        |
        v
Private File Storage
        |
        v
Persist Document Metadata
        |
        v
Verify Consistency
        |
        v
Review / Verification Workflow
        |
        v
Authorized Preview or Download
```

This flow is conceptual. The implementation may use direct-to-storage uploads or another verified approach.

### 4.2 Upload requirements

1. Authenticate the user and authorize the upload purpose.
2. Enforce file-size, request-size, count, and rate limits.
3. Validate allowed formats and inspect file content rather than trusting browser-provided filenames, extensions, or MIME types.
4. Generate a non-guessable storage key independent of the original filename.
5. Store private documents outside publicly browsable asset directories.
6. Persist metadata including the document owner, purpose, storage reference, size, detected media type, status, and timestamps as appropriate.
7. Ensure the document record does not indicate successful completion until the file is available and required persistence has succeeded.
8. Apply review or verification workflows where required.
9. Authorize each preview, download, replacement, and deletion operation.
10. Apply retention, deletion, and audit requirements.

### 4.3 File validation and storage security

- Allow only business-required file types.
- Apply file-content inspection and malware scanning where appropriate.
- Consider archive bombs, decompression limits, malformed documents, and parser vulnerabilities.
- Prevent path traversal, storage-key manipulation, and unauthorized overwrites.
- Keep storage credentials and internal storage paths out of client responses.
- Use short-lived signed download URLs only when their access scope and expiration are appropriate.
- Prevent uploaded HTML, SVG, scripts, or other active content from executing in a trusted application origin.
- Avoid including file contents in logs, queue payloads, or error messages.

### 4.4 Partial failure and reconciliation

Storage and database operations generally do not share a single atomic transaction.

The implementation must define behavior for at least these cases:

| Failure | Required recovery behavior |
|—|—|
| Validation fails | Reject the upload before storing the file |
| Storage upload fails | Do not create a completed document record |
| File succeeds but metadata persistence fails | Delete the orphaned file or schedule durable cleanup |
| Metadata exists but file is missing | Mark or detect the inconsistency and prevent successful download |
| Malware scan fails | Keep the file quarantined or unavailable until the required checks succeed |
| Deletion partially succeeds | Record the state and retry or reconcile safely |

Cleanup jobs must be scoped to authorized storage locations and must not delete unrelated files.

## 5. Payment Flow

Payments must be driven by trusted server-side records and verified payment-provider events.

### 5.1 Intended lifecycle

```text
Client Requests Purchase
          |
          v
Validate Product, Plan, and Price
          |
          v
Create Internal Payment Attempt
          |
          v
Create Provider Order / Checkout
          |
          v
Customer Completes Checkout
          |
          v
Provider Sends Callback / Webhook
          |
          v
Verify Signature and Event
          |
          v
Validate Amount, Currency, and References
          |
          v
Apply Idempotent State Transition
          |
          v
Update Subscription / Entitlement
          |
          v
Expose Trusted Payment Status
          |
          v
Reconcile When Necessary
```

The payment provider, event format, signature mechanism, and payment states must be verified against the selected integration.

### 5.2 Payment creation

The server should:

1. Authenticate the customer and authorize the requested purchase.
2. Retrieve the product, subscription plan, or service from trusted server-side data.
3. Calculate the expected price, currency, taxes, discounts, and payable amount on the server.
4. Create a unique internal payment attempt.
5. Create the provider order or checkout session using server-side credentials.
6. Persist the provider reference and internal transaction association.
7. Return only the checkout details required by the client.

Never accept a browser-submitted amount or payment status as authoritative.

### 5.3 Webhook verification

The webhook handler should:

1. Receive the provider’s documented request format.
2. Verify the signature using the provider’s required algorithm and key configuration.
3. Use the exact raw request body if required by the provider.
4. Reject invalid signatures before applying business changes.
5. Validate the event structure and relevant identifiers.
6. Confirm the payment reference, expected amount, currency, and transaction association.
7. Check that the requested state transition is permitted.
8. Record the provider event identifier or another reliable idempotency key.
9. Apply the payment transition and dependent database changes transactionally where possible.
10. Acknowledge the event according to the provider’s retry protocol.

Signature verification must not be replaced with a shared secret comparison against an arbitrary client-supplied value.

### 5.4 Idempotency and state transitions

Duplicate events must not create duplicate payments, refunds, subscriptions, or entitlements.

The implementation should enforce uniqueness for relevant provider event identifiers and internal idempotency keys. Where concurrency is possible, use database constraints, locking, conditional updates, or equivalent mechanisms.

A payment state machine should be defined against the actual provider and business rules. For example, a successful payment should not be overwritten by a stale pending event. Refunds and reversals should be represented explicitly rather than treated as ordinary payment failures.

### 5.5 Payment recovery

If the provider confirms payment but the database update fails:

- Preserve enough information to identify the incomplete event.
- Retry processing safely.
- Reconcile internal records against provider records where supported.
- Avoid granting entitlements based solely on a browser redirect.
- Do not issue a second financial operation merely because the first response was lost.

Payment, subscription, and entitlement updates must have documented consistency rules.

## 6. Background Jobs

Background jobs may handle notifications, reminders, document scanning, cleanup, reconciliation, and other work that does not need to finish during the originating HTTP request.

### 6.1 Intended lifecycle

```text
Request or Scheduled Trigger
             |
             v
Create Durable Job Intent
             |
             v
Enqueue Job
             |
             v
Worker Receives Job
             |
             v
Validate Payload and Current State
             |
             v
Execute Application Service
             |
             v
Persist Outcome
             |
        +-—+-—+
        |         |
     Success    Failure
        |         |
        v         v
    Complete   Retry / Fail
                  |
                  v
           Exhausted-Job Handling
```

The queue technology, scheduler, worker entry point, and retry mechanism must be confirmed against the actual deployment.

### 6.2 Job requirements

- Include a stable job identifier and idempotency key where needed.
- Store only the minimum data required to execute the task.
- Revalidate business rules and resource permissions at execution time.
- Make duplicate execution safe where repeated side effects are possible.
- Apply bounded retries with backoff and jitter where appropriate.
- Distinguish transient failures from permanent validation or authorization failures.
- Prevent conflicting concurrent operations when necessary.
- Record execution status, attempts, timestamps, and safe failure details.
- Provide a documented process for exhausted jobs.
- Monitor queue depth, job age, failure rate, retry count, and execution duration where tooling supports it.

### 6.3 Job payload security

Do not include passwords, session tokens, payment secrets, or unnecessary private document contents in job payloads.

Prefer internal resource identifiers and retrieve sensitive data through authorized application services at execution time. Protect queue access and persisted job data with appropriate access controls and retention policies.

### 6.4 Job recovery

A recovery process should define how operators can inspect, retry, cancel, or replay a failed job without creating duplicate external effects. Manual replay must respect idempotency controls and authorization requirements.

## 7. Data Consistency and Transaction Boundaries

Database transactions can atomically protect related database changes, but they cannot generally roll back an email, storage upload, or external payment operation.

### 7.1 Required design principles

- Use transactions for database changes that must succeed or fail together.
- Keep internal identifiers separate from provider-generated identifiers.
- Use idempotency controls for payment events and retryable jobs.
- Define compensation or reconciliation behavior for partial success.
- Avoid publishing asynchronous work before required database changes are durable.
- Ensure audit events accurately represent committed outcomes.
- Do not claim that an external side effect succeeded until the result is confirmed to the extent required by the integration.

### 7.2 Transactional outbox

Where reliable dispatch of asynchronous work is required, consider a transactional outbox:

1. Update business records and insert an outbox event in the same database transaction.
2. Commit the transaction.
3. A dispatcher publishes pending events to the queue.
4. Mark events as dispatched after successful publication.
5. Retry safely when publication fails.
6. Make consumers idempotent because delivery may occur more than once.

The outbox is an architectural option, not an assertion that MedOrbits currently implements one.

## 8. Error Handling and Observability

Every flow should provide enough operational visibility for diagnosis without exposing sensitive information.

### 8.1 Request correlation

Where supported, attach a request or correlation identifier to:

- HTTP logs
- Application-service logs
- Relevant audit events
- Job metadata
- External integration diagnostics

Do not accept arbitrary client-supplied identifiers as trusted identity or authorization evidence. Validate or replace them according to the logging design.

### 8.2 Audit events

Audit sensitive actions where required, including document access, permission changes, administrative operations, payment-state changes, and relevant data exports.

Audit records should include only necessary context, such as the actor identifier, action, resource identifier, outcome, timestamp, and correlation identifier. Protect audit records against unauthorized alteration and access.

### 8.3 Operational metrics

Where monitoring is available, track:

- HTTP error rates and latency
- Authentication and authorization failures
- Upload failures and orphaned-file cleanup
- Document scanning failures
- Payment verification failures and duplicate events
- Payment reconciliation discrepancies
- Queue depth, job age, retries, and exhausted jobs
- Database and external-service availability

Do not document a particular monitoring or tracing product as installed until it has been verified.

## 9. Security Boundaries

| Boundary | Required control |
|—|—|
| Browser to API | HTTPS in production, request validation, rate limits |
| API to protected resources | Authentication, authorization, ownership checks |
| API to database | Parameterized queries, least-privilege credentials |
| API to file storage | Private access, scoped permissions, safe object keys |
| API to payment provider | Server-side credentials and authenticated provider communication |
| Provider to webhook | Provider-specific signature verification and replay protection |
| API to queue | Authenticated access, minimal payloads, idempotent processing |
| Worker to business records | Revalidation and scoped permissions |
| Application to logs | Redaction, restricted access, controlled retention |

## 10. Verification Checklist

### HTTP requests

- [ ] Middleware order matches the deployed server.
- [ ] Protected routes enforce authentication and authorization.
- [ ] Validation occurs before business operations.
- [ ] Resource ownership is enforced server-side.
- [ ] Errors match the documented response contract.
- [ ] Logs do not expose secrets or unnecessary personal data.

### Document uploads

- [ ] Private files are stored outside publicly browsable directories.
- [ ] File content, format, size, and count are validated.
- [ ] Storage keys cannot be manipulated to access other files.
- [ ] Metadata and ownership are persisted correctly.
- [ ] Downloads enforce authorization.
- [ ] Partial failures are cleaned up or reconciled.
- [ ] Retention and deletion rules are enforced.

### Payments

- [ ] Provider signatures are verified using the actual provider protocol.
- [ ] Amount, currency, and transaction references are checked.
- [ ] Duplicate events are handled idempotently.
- [ ] State transitions are validated.
- [ ] Browser redirects cannot independently confirm payment.
- [ ] Failed persistence and provider discrepancies are recoverable.
- [ ] Refunds and reversals follow documented business rules.

### Background jobs

- [ ] Job payloads are validated and contain minimal data.
- [ ] Duplicate execution is safe where required.
- [ ] Retries are bounded and use an appropriate backoff policy.
- [ ] Permanent failures do not retry indefinitely.
- [ ] Exhausted jobs have a documented recovery procedure.
- [ ] Queue health and job outcomes are observable.

### Consistency and observability

- [ ] Database transaction boundaries are explicit.
- [ ] External side effects have retry or reconciliation rules.
- [ ] Audit events reflect actual outcomes.
- [ ] Sensitive values are redacted from logs.
- [ ] Relevant failure-path tests exist and pass.

## 11. Maintenance Workflow

When an implementation changes:

1. Update the relevant architecture documentation.
2. Verify the actual middleware, controller, service, storage, payment, or worker behavior.
3. Update API contracts when externally visible behavior changes.
4. Add or update unit, integration, security, and failure-path tests.
5. Verify authorization and transaction boundaries.
6. Test retries, duplicate events, and partial failures where relevant.
7. Document recovery and reconciliation procedures.
8. Keep deployment configuration and operational procedures aligned.

## 12. Definition of Done

A data-flow change is ready for release when:

- Its implementation matches the documented lifecycle.
- Authentication, authorization, and ownership checks are verified.
- Data consistency and partial-failure behavior are defined.
- Relevant security and failure-path tests pass.
- Operational recovery procedures are documented where needed.
- The API documentation and deployment configuration are synchronized.

**Maintenance principle:** MedOrbits data flows must be secure, traceable, resilient to partial failures, and consistent with the actual deployed implementation.
