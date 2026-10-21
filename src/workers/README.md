
# MedOrbits Workers

**Directory:** `src/workers/`

## Purpose

Process asynchronous queue jobs outside Express request handlers, execute domain operations through injected services, and manage successful, retryable, and permanently failed work.

## 1. Overview

MedOrbits workers separate background execution from the HTTP request lifecycle. They consume queued jobs, validate payloads, invoke domain services, and acknowledge or retry work according to the queue adapter contract.

Workers follow the existing application architecture:

- `src/services/` — Business rules and workflow orchestration.
- `src/repositories/` — Persistence and database queries.
- `src/integrations/` — External providers and infrastructure adapters.
- `src/jobs/` — Discovery of eligible work and enqueueing.
- `src/workers/` — Execution of queued work.

Workers must not start automatically when their modules are imported. The application bootstrap or dedicated worker process is responsible for dependency injection, queue connection setup, and explicit worker startup.

## 2. Directory Structure

```text
src/workers/
├── README.md
├── notifications.worker.js
├── reminders.worker.js
├── cleanup.worker.js
└── worker-runtime.js
```

| File | Responsibility |
|—|—|
| `notifications.worker.js` | Processes queued notification delivery requests. |
| `reminders.worker.js` | Processes reminder delivery and reminder-related state transitions. |
| `cleanup.worker.js` | Executes approved cleanup plans while enforcing retention and legal-hold rules. |
| `worker-runtime.js` | Coordinates queue polling, job execution, acknowledgement, retries, dead-letter handling, and shutdown. |

The queue implementation and scheduler are configured separately from these worker modules.

## 3. Worker Exports and Lifecycle

Each worker module follows the shared naming convention:

| Export | Responsibility |
|—|—|
| `process...Job` | Validates and processes one job. |
| `create...Worker` | Creates a job handler using injected dependencies. |
| `start...Worker` | Explicitly starts queue consumption. |

The shared runtime exports `startPollingWorker(options)` and validates the queue adapter, handler, polling interval, visibility timeout, and retry limit.

A worker module must not connect to a database, register timers, reserve jobs, or begin consuming work merely because it is imported.

### Recommended lifecycle

1. Validate dependencies and configuration.
2. Create the worker using injected adapters.
3. Start consumption explicitly.
4. Reserve a job from the durable queue.
5. Validate the job and its payload.
6. Execute the operation through the appropriate domain service.
7. Acknowledge success or apply the failure policy.
8. Record structured operational metrics and logs.
9. Continue processing until shutdown is requested.
10. Finish or safely release in-flight work before closing dependencies.

## 4. Queue Adapter Contract

Workers use the injected queue adapter.

```javascript
const job = await queue.reserve({
  queueName,
  visibilityTimeoutMs,
});

if (job === null) {
  // No job is currently available.
}

await queue.ack(job);
await queue.retry(job, error);

// Optional:
await queue.deadLetter(job, error);
```

### Contract requirements

- `reserve()` returns a job or `null`.
- `ack()` acknowledges successful processing.
- `retry()` applies the configured retry policy.
- `deadLetter()` handles exhausted jobs when supported by the adapter.
- Queue operations must expose failures rather than silently reporting success.
- Job payloads must be serializable and validated before execution.

The queue adapter must document the job envelope, delivery guarantees, visibility timeout, lease renewal, retry count, backoff behavior, and dead-letter semantics.

A worker must not assume that a queue provides exactly-once execution. Treat duplicate delivery as possible.

## 5. Notifications Worker

**Module:** `src/workers/notifications.worker.js`

### Responsibilities

1. Validate the notification job payload.
2. Extract the notification identifier.
3. Load the relevant notification and delivery context through domain services.
4. Recheck eligibility and delivery state.
5. Invoke the configured email or notification integration.
6. Record the delivery outcome through the appropriate service or repository.
7. Acknowledge successful work.
8. Retry transient failures and route exhausted jobs to dead-letter handling.

The worker must not log complete notification contents, recipient records, authentication tokens, or private application data.

### Idempotency

Use a stable notification or delivery identifier to detect duplicate execution. Record processing state durably and coordinate delivery-state changes with the relevant service.

External email delivery cannot generally be made exactly-once merely by using a unique queue job ID. Where supported, use provider idempotency keys, durable delivery records, and reconciliation for ambiguous provider responses.

## 6. Reminders Worker

**Module:** `src/workers/reminders.worker.js`

### Responsibilities

1. Validate the reminder job payload.
2. Load the reminder through the appropriate domain service.
3. Recheck due time, eligibility, cancellation status, and recurrence rules.
4. Prevent duplicate delivery for the same scheduled occurrence.
5. Perform the required notification or reminder action.
6. Persist the resulting state.
7. Acknowledge success or handle failure according to the retry policy.

### Recurring reminders

For recurring reminders, identify each occurrence separately. A reminder identifier alone may not be a sufficient idempotency key.

Use a stable occurrence identifier or a combination of the reminder ID and its scheduled occurrence.

Use UTC timestamps consistently for comparisons and persistence. Apply an explicit timezone policy when the reminder is defined in a user’s local timezone.

## 7. Cleanup Worker

**Module:** `src/workers/cleanup.worker.js`

### Responsibilities

1. Validate the cleanup job payload.
2. Load or validate the cleanup plan.
3. Recheck retention requirements and execution authorization.
4. Exclude records protected by legal holds or other retention restrictions.
5. Execute bounded cleanup operations through the cleanup service.
6. Record an auditable outcome.
7. Acknowledge success or handle failures safely.

### Mandatory safeguards

- Dry-run behavior should be the default where supported.
- Destructive execution must require explicit authorization.
- The worker must enforce destructive-operation policy independently of the job producer.
- Retention periods must come from approved configuration or domain policy.
- Legal holds must take precedence over ordinary cleanup eligibility.
- Recheck eligibility immediately before destructive actions.
- Use bounded batches and safe transaction boundaries.
- Make repeated execution safe.
- Preserve the audit records required by policy.
- Do not log document contents, personal records, or sensitive identifiers unnecessarily.

A queued payload is not, by itself, proof of authorization. A producer-supplied flag must not override worker-side policy.

## 8. Validation and Payload Contracts

Every worker must validate its input before performing a business operation.

Validate at minimum:

- Job envelope and identifier.
- Expected queue name or task type.
- Payload structure and required fields.
- Identifier format and length.
- Timestamp format, where applicable.
- Supported operation and execution mode.
- Any required correlation or idempotency identifier.

Reject malformed payloads without executing business operations. Classify permanent validation failures separately from transient infrastructure failures.

Use explicit payload schemas or validators where available. Do not trust queue contents merely because they came from an internal producer.

## 9. Retry and Failure Policy

Classify errors before retrying.

| Failure category | Recommended handling |
|—|—|
| Temporary database or queue failure | Retry with bounded backoff. |
| Provider timeout or temporary unavailability | Retry where the operation is safe to repeat. |
| Rate limiting | Respect provider retry guidance and apply backoff. |
| Invalid payload | Reject or dead-letter without repeated retries. |
| Missing or ineligible record | Apply the documented domain policy; do not retry indefinitely. |
| Authorization failure | Stop execution and record the security-relevant outcome safely. |
| Permanent provider rejection | Follow the domain-specific failure policy. |
| Exhausted retries | Dead-letter or persist a durable failure record. |

### Retry requirements

- Configure a maximum number of attempts.
- Use exponential backoff with jitter where appropriate.
- Bound retry delays and total processing time.
- Avoid retry storms during provider outages.
- Distinguish failures before a side effect from failures after a possibly completed side effect.
- Make replay safe through idempotency and state validation.

The queue adapter or worker coordinator should own retry counting consistently. Do not independently increment attempts in multiple layers without a documented contract.

**Implementation check:** `worker-runtime.js` currently uses `job.attempts` to decide when to dead-letter. Confirm whether the queue adapter supplies the current failed attempt count or the next attempt count, and ensure `retry()` updates it consistently. The runtime does not itself implement exponential backoff or jitter; those policies must be implemented by the adapter or added to the runtime.

## 10. Visibility Timeout and Concurrency

A reserved job must not become available to another worker while the original worker is still processing it, unless the queue’s documented behavior explicitly permits this.

Configure the visibility timeout based on expected processing duration.

For longer-running operations:

- Extend the visibility lease where supported.
- Apply an upper bound to processing time.
- Prevent concurrent execution of the same logical operation.
- Make state transitions atomic where possible.
- Handle expired leases and worker crashes safely.

Set worker concurrency according to database capacity, provider limits, queue throughput, and the cost of each operation.

**Current runtime behavior:** `worker-runtime.js` processes one job at a time per worker instance. It does not implement visibility-lease renewal or a hard processing timeout.

## 11. Idempotency and Consistency

Workers must tolerate duplicate delivery and ambiguous failures.

Recommended safeguards:

- Use stable identifiers for logical operations.
- Persist processing or completion state.
- Apply database uniqueness constraints where appropriate.
- Make state transitions conditional and atomic.
- Avoid marking work completed before required state changes succeed.
- Use provider idempotency mechanisms when available.
- Reconcile outcomes when a provider succeeds but the worker cannot confirm completion.

A queue acknowledgement is not a substitute for recording the business outcome. Likewise, a database transaction cannot automatically make an external email or payment operation atomic.

Worker-generated idempotency keys should be stable across retries of the same logical operation. For recurring reminders, distinguish individual scheduled occurrences. For cleanup, use a stable cleanup-plan or execution identifier where possible.

## 12. Logging, Metrics, and Alerting

Use structured logs and operational metrics.

Recommended log fields:

- Worker name.
- Queue name.
- Job ID.
- Correlation ID, when available.
- Processing duration.
- Attempt number, if supplied by the adapter.
- Outcome category.
- Retry or dead-letter reason.
- Cleanup execution mode, where applicable.

Avoid logging:

- Passwords and access tokens.
- API keys or webhook secrets.
- Full document contents.
- Payment credentials or sensitive payment data.
- Complete personal records.
- Unnecessary notification bodies or recipient details.

### Monitor

- Queue depth and oldest queued job age.
- Job processing latency.
- Success and failure rates.
- Retry and dead-letter volume.
- Visibility lease expiration.
- Worker crashes and restarts.
- Provider error and rate-limit rates.
- Idempotency conflicts.
- Cleanup volume and policy rejections.
- Time since the last successful processing run.

Configure alerts for sustained backlog growth, repeated failures, abnormal cleanup volumes, and exhausted retries.

## 13. Graceful Shutdown

Worker startup must support controlled shutdown.

Recommended sequence:

1. Stop accepting new work.
2. Stop or cancel further reservations.
3. Allow in-flight operations to finish within a configured deadline.
4. Extend or release visibility leases according to the adapter contract.
5. Acknowledge only confirmed successful processing.
6. Leave unfinished work recoverable by the queue.
7. Close provider, queue, and database resources.
8. Record the shutdown outcome.

Do not acknowledge a job merely to clear the queue during shutdown. Do not close shared dependencies while active handlers still depend on them.

**Current runtime behavior:** `stop()` stops future polling and waits for the active tick to finish. It does not enforce a shutdown deadline or renew visibility leases. The queue adapter must ensure that unfinished work remains recoverable if a process exits unexpectedly.

## 14. Testing Requirements

Test each worker independently using injected queue, service, repository, integration, clock, and logger dependencies as appropriate.

- [ ] Importing the module does not start a worker.
- [ ] Missing dependencies are rejected.
- [ ] Malformed payloads are rejected safely.
- [ ] Successful processing is acknowledged.
- [ ] Transient errors trigger the configured retry path.
- [ ] Permanent failures are not retried indefinitely.
- [ ] Exhausted jobs are dead-lettered when supported.
- [ ] Duplicate jobs do not duplicate business operations.
- [ ] Expired visibility leases are handled safely.
- [ ] Provider timeouts and ambiguous outcomes are tested.
- [ ] Cleanup respects retention rules and legal holds.
- [ ] Destructive cleanup is independently authorized.
- [ ] Logs exclude secrets and sensitive payload data.
- [ ] Shutdown preserves recoverability of unfinished jobs.

Run integration tests against the selected queue and database adapters before enabling production processing.

## 15. Dependency Injection and Startup

Create and start workers from a dedicated bootstrap module or worker-process entry point.

Inject the required:

- Queue adapter.
- Domain services.
- Repositories or persistence services where required.
- External integration clients.
- Logger and metrics adapters.
- Configuration and shutdown coordination.

Do not start background consumers as a side effect of importing `src/app.js` or a worker module. If the HTTP application and workers run in separate processes, configure their deployment and scaling independently.

## 16. Implementation Boundaries

The architecture assigns responsibility as follows:

- `src/jobs/` discovers eligible work and enqueues tasks.
- `src/workers/` validates and processes queued work.
- `src/services/` owns business rules and workflow coordination.
- `src/repositories/` owns persistence operations.
- `src/integrations/` encapsulates external providers.
- The queue adapter owns reservation, acknowledgement, retry, and any supported dead-letter operations.
- The application bootstrap owns dependency construction, startup, and shutdown coordination.

These boundaries should be reflected in actual module interfaces and tested behavior.

## Implementation Status

This README defines the intended worker architecture. Verify the exported functions, queue adapter behavior, retry policy, dead-letter support, metrics, and shutdown handling against the actual implementations before treating them as production-ready.

—

**MedOrbits — Study · Work · Grow**

Reliable background processing for admissions, careers, recruitment, notifications, reminders, and platform operations.
