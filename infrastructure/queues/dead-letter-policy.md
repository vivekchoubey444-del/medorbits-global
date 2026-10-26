
# MedOrbits — Dead-Letter Queue Policy

**Project:** MedOrbits  
**Directory:** `infrastructure/queues/`  
**Purpose:** Define how failed background jobs are isolated, investigated, safely replayed, monitored, and retained for operational accountability.  
**Status:** Operational policy — verify all requirements against the queue technology and background-processing mechanisms actually implemented.

## 1. Purpose and Scope

A dead-letter queue (DLQ) isolates jobs that cannot complete after exhausting the configured retry policy or being classified as non-retryable.

The DLQ process should prevent repeated failures from consuming resources indefinitely while preserving sufficient diagnostic information for controlled recovery.

MedOrbits must document the actual queue technology, retry mechanism, persistence model, and dead-letter handling implemented by the application.

**Implementation caveat:** This policy defines operational expectations. It does not establish that MedOrbits currently has a dedicated DLQ, persistent failure store, replay interface, or automated alerting.

## 2. Dead-Letter Conditions

A job may be moved to a DLQ or equivalent failure store when:

- Its configured retry limit has been exhausted.
- Its failure is classified as non-retryable.
- Its payload or required source data cannot be processed safely.
- Repeated failures require manual investigation.
- Processing must be suspended because of a security, integrity, or external-system concern.

The implementation must define which conditions trigger dead-lettering and how jobs transition from active processing to a failed state.

Document the behavior for jobs that fail during the transition, including whether the system can recover a job that was neither successfully processed nor reliably recorded as failed.

## 3. Required Job Metadata

Store only the information necessary to investigate failures and replay jobs safely.

Where supported by the queue implementation, retain the following metadata:

| Field | Purpose |
|—|—|
| Job identifier | Uniquely identifies the failed operation. |
| Job type | Identifies the operation or worker responsible for processing. |
| Creation time | Records when the original job was created. |
| Last attempt time | Records the most recent processing attempt. |
| Attempt count | Indicates how many processing attempts have occurred. |
| Failure category | Provides a sanitized classification of the failure. |
| Error summary | Supplies concise diagnostic information without secrets or sensitive payload data. |
| Correlation identifier | Connects job activity to related application logs and requests. |
| Idempotency identifier | Helps prevent duplicate execution where supported by the operation. |
| Source record reference | Identifies the originating record without unnecessarily duplicating its data. |
| Job status | Indicates whether the job is pending, processing, failed, replayed, or resolved, as applicable. |
| Replay history | Records replay attempts, operators, timestamps, and outcomes where supported. |

### Metadata requirements

- Prefer references to source records over duplicated sensitive payloads.
- Redact credentials, tokens, payment secrets, and unnecessary personal information.
- Sanitize exception messages before storing or displaying them.
- Preserve enough context to distinguish separate jobs and processing attempts.
- Ensure correlation and idempotency identifiers cannot be used to access unauthorized data.
- Restrict metadata access according to its sensitivity.

Do not assume that every queue provider supports all fields directly. Document any additional application-level storage required.

## 4. Failure Classification

Classify dead-lettered jobs before deciding how to recover them.

| Category | Examples | Recommended response |
|—|—|—|
| Transient | Temporary network failure, rate limit, or provider timeout | Verify service recovery and retry eligibility before replay. |
| Data-related | Missing, invalid, or inconsistent source data | Correct or reconcile the data before replay. |
| Configuration-related | Missing credentials or invalid service configuration | Correct the configuration and verify connectivity. |
| Code-related | Unhandled exception or application defect | Fix and test the defect before replay. |
| Security-related | Authorization failure or suspected malicious input | Investigate, contain the risk, and obtain appropriate approval before replay. |
| Business-rule failure | Invalid state transition or unmet processing requirement | Validate the business state and resolve the underlying condition. |
| External-side-effect uncertainty | Timeout after a payment, notification, or provider request may have succeeded | Reconcile the external operation before retrying. |

A failure must not be classified as safe to retry solely because it appears temporary. Determine whether the original operation may already have completed partially or fully.

## 5. Retry and Dead-Letter Policy

Configure retry behavior according to job criticality, expected failure modes, provider limits, and the consequences of duplicate processing.

Document the following for each job type:

- Maximum processing attempts.
- Retryable and non-retryable error categories.
- Retry delay and backoff strategy.
- Whether randomized backoff is used to reduce synchronized retry spikes.
- Conditions that move a job to the DLQ or equivalent failure store.
- Job timeout and execution limits.
- Idempotency and duplicate-processing safeguards.
- Ownership and escalation requirements.
- Retention and replay eligibility.

Where appropriate, use exponential backoff with a maximum delay and respect external provider rate limits.

Avoid infinite retry loops. Permanent validation failures should not consume repeated attempts without a reasonable prospect of recovery.

The actual retry limits and timing must be documented from the implemented configuration rather than invented by this policy.

## 6. Monitoring and Alerting

Monitor dead-letter activity and its impact on application workflows.

Where supported, configure alerts for:

- DLQ volume exceeding an agreed threshold.
- The oldest unresolved job exceeding its acceptable age.
- Repeated job failures or retry exhaustion.
- Sudden increases in a particular failure category.
- Failed replay attempts or repeated re-dead-lettering.
- Queue-processing delays or growing backlogs.
- High-impact jobs remaining unresolved.
- Background workers becoming unavailable or unhealthy.

Track operational metrics such as:

- Jobs entering the DLQ over time.
- Total unresolved jobs.
- Age of the oldest unresolved job.
- Failure rate by job type and category.
- Replay success rate.
- Time to investigate and resolve failures.
- Duplicate-processing incidents, where measurable.

Set thresholds using observed workload, business impact, and service objectives rather than arbitrary values.

Each actionable alert should identify the affected queue or job type, severity, relevant runbook, and responsible owner where those capabilities are available.

## 7. Investigation and Replay Procedure

### Step 1 — Inspect the Failure

Review job metadata, sanitized error details, correlation identifiers, relevant logs, and processing history.

Confirm the job identifier and originating operation before making changes.

### Step 2 — Classify the Cause

Determine whether the failure is transient, data-related, configuration-related, code-related, security-related, or caused by an uncertain external side effect.

Identify whether the issue affects one job, a group of jobs, or the entire processing system.

### Step 3 — Assess Processing State and Side Effects

Establish whether the original operation may have completed partially or fully.

Check the current source record, job status, idempotency records, and external provider state where relevant.

Do not assume that a missing success response means the operation failed.

### Step 4 — Correct the Underlying Cause

Resolve the issue before replaying the job.

Examples include restoring provider connectivity, correcting invalid source data, fixing an application defect, updating configuration, or reconciling an external transaction.

### Step 5 — Approve the Replay

Obtain the required operational approval for sensitive, financial, destructive, or high-impact jobs.

Verify that the operator is authorized and that the job remains eligible for replay.

### Step 6 — Replay in Controlled Batches

- Start with a limited number of jobs.
- Apply appropriate rate limits and concurrency controls.
- Confirm that the worker and downstream services have sufficient capacity.
- Monitor processing outcomes before increasing the batch size.
- Stop replay if errors, duplicate operations, or resource pressure increase.

Do not replay the entire DLQ indiscriminately.

### Step 7 — Prevent Duplicate Processing

Use the application’s supported idempotency safeguards and verify the job’s current state before re-execution.

Where possible, ensure that replaying a job does not create a second payment, duplicate notification, repeated document operation, or conflicting state transition.

### Step 8 — Validate Outcomes

Confirm that processing succeeded and that expected business records and external operations are consistent.

Check for unintended side effects and jobs that have returned to the DLQ.

### Step 9 — Record the Result

Record the replay decision, operator, timestamp, job identifier, reason, attempt count, and outcome.

Include references to relevant incident or change records where appropriate.

**Operational rule:** Never repeatedly replay jobs without understanding the cause of failure and assessing duplicate-processing risk.

## 8. Security and Access Control

DLQ records, queue dashboards, and job payloads may contain personal or business-sensitive information.

- Restrict access according to least privilege.
- Require authorized access to inspect, modify, delete, or replay jobs.
- Never expose queue dashboards, administrative endpoints, or payloads publicly.
- Exclude passwords, access tokens, payment secrets, and unnecessary personal data from stored error details.
- Sanitize untrusted content before displaying or logging it.
- Protect DLQ storage, administrative credentials, and replay interfaces.
- Record administrative actions and replay operations where supported.
- Apply authentication, authorization, and audit controls to manual recovery tools.
- Review access periodically and revoke access when it is no longer required.

Security-related failures must be investigated before replay. Reprocessing untrusted or unauthorized input can repeat the original security problem.

## 9. Retention and Cleanup

Define a retention period based on operational requirements, applicable obligations, and the sensitivity of stored metadata.

### Retention requirements

- Document the retention period for failed jobs, replay history, and diagnostic metadata.
- Delete or archive records according to the approved retention policy.
- Preserve records needed for active investigations or required audits.
- Restrict access to archived records.
- Avoid retaining sensitive payloads longer than necessary.
- Verify that cleanup operations do not remove jobs still under investigation.
- Confirm that retention settings apply to both queue-provider storage and any application-managed failure records.
- Document who owns the cleanup process and how its operation is verified.

Do not assume that removing a DLQ record also removes related application logs, audit events, backups, or provider records.

## 10. Operational Review Checklist

- [ ] Queue technology and persistence mechanism are documented.
- [ ] Retry limits and dead-letter conditions are defined for applicable job types.
- [ ] Retryable and non-retryable failures are classified consistently.
- [ ] Required job metadata is retained safely.
- [ ] Sensitive information is excluded or appropriately redacted.
- [ ] DLQ volume and oldest-item age are monitored where supported.
- [ ] Failure trends and repeated retry exhaustion are reviewed.
- [ ] Replay procedures include rate limits and idempotency safeguards.
- [ ] Payment and other external side effects are reconciled before uncertain retries.
- [ ] Access to DLQ records, dashboards, and replay tools is restricted.
- [ ] Replay operations are auditable where supported.
- [ ] Retention and cleanup policies are documented.
- [ ] Recovery procedures are tested in a non-production environment.
- [ ] Relevant alerts and operational ownership are documented.

## 11. Implementation Notes

This policy defines operational expectations, not a specific queue implementation.

Before applying it, verify which queue technology, retry behavior, persistence mechanism, monitoring capabilities, and replay controls are actually implemented in MedOrbits.

If the application does not implement a dedicated DLQ, document the existing failed-job handling mechanism and identify the gaps that must be addressed before this policy can be considered operational.

Do not mark checklist items complete solely because this document describes them.

## 12. Related Documentation

Verify that these files exist before relying on them:

- `infrastructure/queues/README.md` — Queue operations overview.
- `infrastructure/queues/retry-policy.md` — Retry behavior and limits.
- `infrastructure/queues/worker-scaling.md` — Worker capacity and scaling.
- `infrastructure/queues/dead-letter-policy.md` — This policy.
- `infrastructure/monitoring/alerting.md` — Alerting and escalation procedures.
- `infrastructure/monitoring/health-checks.md` — Service and worker health checks.
- `infrastructure/deployment/rollback.md` — Production rollback and recovery.
- `infrastructure/backup/README.md` — Backup and restore operations, where applicable.

## 13. Maintenance Policy

Review this policy whenever queue infrastructure, background workers, retry configuration, persistence, replay tooling, data-retention requirements, or job-processing behavior changes.

Validate the procedure periodically in a non-production environment. Record test results, identified gaps, and corrective actions.

**MedOrbits — Safe Job Recovery, Controlled Reprocessing, Operational Accountability**
