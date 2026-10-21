
# MedOrbits — Scheduled Jobs

**Directory:** `src/jobs/`  
**Runtime:** Node.js >= 20

## 1. Purpose

The `src/jobs/` directory contains producer modules that discover eligible work, construct bounded execution payloads, and enqueue tasks for processing by corresponding workers.

MedOrbits follows a producer–consumer architecture:

- **Jobs** discover eligible work, apply scheduling criteria, build payloads, and enqueue tasks.
- **Workers** consume queued tasks, validate payloads, execute domain operations, and report outcomes.
- **Domain services and repositories** own business rules, eligibility criteria, persistence, and state transitions.
- **Queue adapters** provide durable enqueueing and queue-specific delivery semantics.
- **Schedulers** invoke jobs at configured intervals or times.
- **Observability components** provide structured logs, metrics, alerts, and operational diagnostics.

Jobs must not execute merely because their modules are imported. Scheduling and invocation belong in application bootstrap or scheduler configuration.

## 2. Directory Structure

```text
src/jobs/
├── README.md
├── notifications.job.js
├── reminders.job.js
└── cleanup.job.js
```

| File | Responsibility |
|—|—|
| `notifications.job.js` | Discovers eligible notifications and enqueues notification work. |
| `reminders.job.js` | Discovers eligible reminders and enqueues reminder work. |
| `cleanup.job.js` | Builds cleanup plans and enqueues cleanup execution work. |

Corresponding worker implementations belong in `src/workers/`.

## 3. Standard Job Contract

Each job exports a named function following this pattern:

```javascript
async function runExampleJob(
  dependencies = {},
  options = {},
) {
  // Validate dependencies and options.
  // Discover eligible work through domain services.
  // Build bounded, serializable payloads.
  // Enqueue work using the injected queue adapter.
}
```

Each module must export its job function. It must not start timers, register schedulers, connect to queues, or execute work at import time.

### Required queue adapter

```javascript
await dependencies.queue.add(
  queueName,
  payload,
  options,
);
```

The injected queue adapter must support the interface expected by the job. Its implementation is responsible for the durability, uniqueness, and delivery guarantees provided by the selected queue backend.

### Dependencies

Depending on the job, inject the relevant:

- Domain services or repositories.
- Cleanup-plan builder.
- Notification or reminder eligibility service.
- Structured logger.
- Clock or date source where deterministic testing is useful.

Avoid importing global database connections or creating queue clients inside individual job modules.

## 4. Notifications Job

**Module:** `src/jobs/notifications.job.js`

Responsibilities:

1. Query notifications eligible for dispatch.
2. Apply eligibility rules and bounded batch limits.
3. Exclude records already processed or scheduled for processing where supported by the data model.
4. Generate stable identifiers for logical work items.
5. Enqueue notification payloads.
6. Record scheduling outcomes through structured logs.

The notification worker is responsible for delivery, final state updates, and handling provider failures.

Enqueueing a notification does not mean it has been delivered. The delivery state must be tracked independently.

## 5. Reminders Job

**Module:** `src/jobs/reminders.job.js`

Responsibilities:

1. Find reminders due for processing.
2. Evaluate reminder eligibility using authoritative domain data.
3. Apply bounded batch limits.
4. Enqueue reminder work with stable identifiers.
5. Avoid repeatedly scheduling the same logical reminder.
6. Log enqueueing outcomes and recoverable failures.

Calculate reminder eligibility using UTC timestamps and a documented policy for due times, expiry, and recurrence.

The worker must revalidate eligibility where necessary because the underlying record may change between discovery and execution.

## 6. Cleanup Job

**Module:** `src/jobs/cleanup.job.js`

Responsibilities:

1. Request a cleanup plan from the cleanup service.
2. Apply retention and batch limits.
3. Default to dry-run behavior.
4. Require explicit authorization for destructive execution.
5. Enqueue the plan or a durable reference to it.
6. Log the job ID and execution mode.

Cleanup execution must respect approved retention policies, record ownership, legal holds, and applicable audit requirements.

A job-level destructive-operation flag is not sufficient authorization by itself. The worker must independently validate the payload and enforce the execution policy.

The cleanup service must define which records qualify for removal and ensure that the resulting plan is bounded and safe to execute.

## 7. UTC and Scheduling Policy

Use UTC for persisted timestamps, schedule comparisons, job identifiers, and operational logs unless a business rule explicitly requires a named local timezone.

Recommended conventions:

- Persist timestamps in a consistent UTC representation.
- Define whether each schedule uses a fixed UTC time or a timezone-aware local time.
- Use an injected clock for deterministic tests where appropriate.
- Define daylight-saving behavior for local-time schedules.
- Make recurrence and expiration rules explicit.
- Avoid relying on the server’s local timezone.

These job modules do not select or initialize a scheduler. Configure the scheduler separately.

## 8. Bounded Batches and Payload Design

Every discovery job should use an explicit batch limit and avoid loading an unbounded number of records into memory.

Recommended practices:

- Validate batch sizes against configured maximums.
- Use cursor-based or paginated database queries for large datasets.
- Keep queue payloads serializable and reasonably small.
- Pass record identifiers or durable plan references instead of entire database objects.
- Avoid placing credentials, private documents, or unnecessary personal data in payloads.
- Revalidate records in the worker before consequential operations.
- Use checkpoints or continuation jobs when a workload exceeds one batch.

A batch limit should be enforced by the domain query or processing loop, not merely stored as metadata.

## 9. Idempotency and Duplicate Prevention

Queues can deliver duplicate work, schedulers can overlap, and processes can fail after enqueueing but before recording completion.

Use idempotency at both the scheduling and execution layers.

Recommended controls:

- Derive stable job IDs from the logical operation and intended schedule window.
- Use database uniqueness constraints for notification and reminder dispatch records.
- Use durable event or execution records to track processing state.
- Make worker side effects safe to repeat.
- Handle retries without duplicating messages, reminders, or destructive operations.
- Reconcile partially completed work after failures.
- Distinguish a duplicate enqueue from a completed business operation.

A deterministic queue job ID helps only if the selected queue backend enforces its uniqueness semantics. It does not replace database constraints or idempotent worker logic.

**Important:** The current notification and reminder job implementations derive IDs from the record ID alone. If a reminder or notification can legitimately be dispatched more than once, include an appropriate occurrence or schedule-window identifier in the job ID. Confirm the intended uniqueness policy before changing the format.

## 10. Distributed Scheduling and Locking

When multiple application instances can invoke the same job, use distributed coordination if overlapping discovery would create duplicate or unsafe work.

Possible approaches include:

- A distributed scheduler with leader election.
- A database-backed lease with an expiration time.
- A queue-backed scheduler with documented uniqueness guarantees.
- Database row locking for eligible records.
- Unique constraints and atomic claims for individual work items.

A lock should have a clear owner, expiration, renewal policy, and recovery behavior. Ensure an expired lock cannot authorize a stale process to continue destructive work.

Do not assume an in-memory boolean or process-local mutex coordinates multiple Render instances or separate processes.

## 11. Retries and Failure Handling

Use bounded retries with backoff and jitter for transient failures. Avoid retrying validation errors or permanent business-rule failures indefinitely.

Define retry behavior for:

- Queue connection failures.
- Temporary database errors.
- Provider rate limits and timeouts.
- Invalid or expired work items.
- Permanent recipient or delivery failures.
- Cleanup execution errors.
- Worker crashes and interrupted batches.

Retry limits, backoff settings, and retention policies depend on the selected queue backend and must be configured in the queue or worker layer where applicable.

### Dead-letter handling

Jobs should provide enough context to trace work that ultimately fails. The queue or worker infrastructure should support a documented strategy for exhausted retries, such as a dead-letter queue or durable failure table.

Define:

- Which failures are eligible for retry.
- The maximum retry count.
- How failed work is retained and inspected.
- Who can replay failed work.
- How replay preserves idempotency.
- How sensitive data is redacted.
- When failure records can be removed.

Do not automatically replay destructive cleanup work without rechecking authorization and the current cleanup plan.

## 12. Logging and Monitoring

Use structured logs for important scheduling events.

Recommended event fields include:

- Job type.
- Logical job ID.
- Queue name.
- Schedule window.
- Dry-run or execution mode.
- Batch size.
- Number of records discovered and enqueued.
- Duration.
- Retry or failure category.
- Correlation ID.

Avoid logging full payloads, authentication tokens, private documents, or unnecessary personal data.

Monitor:

- Job invocation success and failure rates.
- Discovery duration and eligible-record counts.
- Queue enqueue failures.
- Queue depth and oldest queued item age.
- Worker processing latency.
- Retry and dead-letter counts.
- Duplicate suppression rates.
- Cleanup-plan size and destructive execution outcomes.
- Time since the last successful scheduled run.

Configure alerts for repeated failures, growing backlogs, missed schedules, and abnormal cleanup volumes.

## 13. Graceful Shutdown

Jobs should await all enqueue operations they initiate and propagate failures to the caller.

During application shutdown:

1. Stop initiating new scheduled runs.
2. Prevent new work from being claimed where applicable.
3. Allow in-flight discovery and enqueue operations to finish within a bounded deadline.
4. Release distributed locks or leases safely.
5. Let workers finish or safely abandon work according to their queue’s shutdown contract.
6. Close database and queue connections.
7. Emit a final operational log.

Do not mark work completed before its durable state transition has succeeded.

## 14. Testing Requirements

Test each job independently using injected queue, domain-service, clock, and logger dependencies.

Minimum checks:

- [ ] Importing a job does not schedule or execute it.
- [ ] Missing dependencies are rejected.
- [ ] Invalid options and batch sizes are rejected.
- [ ] UTC boundaries and due-time calculations are correct.
- [ ] No eligible work results in a safe, documented outcome.
- [ ] Enqueue failures are propagated and logged appropriately.
- [ ] Duplicate invocation does not create duplicate business operations.
- [ ] Distributed overlap is handled safely.
- [ ] Destructive cleanup defaults to dry-run mode.
- [ ] Workers independently validate queued payloads.
- [ ] Retries and dead-letter handling are exercised.
- [ ] Shutdown does not silently lose in-flight work.

Use integration tests with the actual queue and database adapters before enabling production scheduling.

## 15. Configuration and Vendor Neutrality

These modules define the job orchestration contract, not the infrastructure vendor.

The architecture does not inherently select:

- A scheduler or cron implementation.
- A queue backend.
- A distributed locking service.
- A dead-letter implementation.
- A monitoring or alerting vendor.

Select these components separately and document their delivery guarantees, uniqueness semantics, retry behavior, lock expiry, and operational recovery procedures.

## 16. Implementation Boundaries

- **Job layer:** Discovers eligible work, constructs bounded payloads, and requests durable enqueueing.
- **Worker layer:** Validates payloads, executes work, handles retries, and reports outcomes.
- **Domain services:** Own eligibility criteria, retention policies, authorization, and business state transitions.
- **Infrastructure adapters:** Provide queue persistence, scheduling, distributed coordination, and observability integrations.

### Implementation status

This README documents the intended architecture. Verify each behavior against the actual job modules, workers, database schema, queue adapter, and scheduler configuration before treating it as implemented or production-ready.

—

**MedOrbits — Study · Work · Grow**
