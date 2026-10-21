
# MedOrbits — Retry Policy

**Project:** MedOrbits  
**Directory:** `infrastructure/queues/`  
**Purpose:** Define consistent retry behavior for failed background jobs, including retry eligibility, backoff, failure handling, duplicate prevention, and safe recovery.  
**Status:** Operational policy — verify all settings against the actual MedOrbits implementation before treating them as configured features.

## 1. Purpose and Scope

Retries allow temporary failures to recover without unnecessary manual intervention. However, uncontrolled retries can increase system load, delay processing, duplicate side effects, and conceal persistent failures.

This policy defines operational requirements for retryable background jobs, including application submissions, document processing, notifications, scheduled tasks, and external integrations where applicable.

The actual queue technology, retry configuration, persistence mechanism, and worker implementation must be verified against the current MedOrbits codebase.

This document describes intended behavior; it does not establish that a particular queue system, retry mechanism, or background worker is already implemented.

## 2. Retry Eligibility

Classify failures before retrying a job.

| Failure category | Recommended behavior |
|—|—|
| Temporary network failure | Retry within configured limits when the operation is safe to repeat. |
| External provider timeout | Determine whether the original request may have succeeded before retrying. |
| Rate-limit response | Respect provider retry instructions, rate limits, and applicable `Retry-After` guidance. |
| Temporary database connectivity failure | Retry within configured limits after assessing connectivity and transaction state. |
| Invalid input or missing required data | Do not repeatedly retry without correcting the underlying data. |
| Authentication or configuration failure | Pause or fail the job until the underlying issue is corrected. |
| Permanent business-rule failure | Mark the job as failed when another attempt cannot change the outcome. |
| Suspected security issue | Contain and investigate the issue before considering replay. |
| Resource exhaustion | Reduce processing pressure and retry only after capacity or dependency health has recovered. |
| Unknown failure | Apply a bounded policy and investigate rather than retrying indefinitely. |

A job should be retried only when another attempt has a reasonable chance of succeeding and repeating the operation is safe.

### 2.1 Retry Decision Rules

Before scheduling another attempt, determine:

1. Whether the failure is transient or permanent.
2. Whether the operation may already have succeeded.
3. Whether the job remains valid and its source data is still current.
4. Whether the dependency can safely accept another request.
5. Whether the remaining retry budget and job deadline permit another attempt.

Do not automatically retry authorization failures, invalid business states, or suspected security violations without first addressing their cause.

## 3. Retry Limits and Backoff

Configure a finite retry limit for each job type according to business impact, execution cost, dependency behavior, and expected recovery time.

### 3.1 Required Controls

- Use exponential backoff where appropriate to reduce pressure on failing dependencies.
- Add randomized jitter where supported to avoid synchronized retry bursts.
- Respect external provider rate limits and retry instructions.
- Apply an upper bound to retry delays.
- Set execution timeouts so individual attempts cannot run indefinitely.
- Avoid immediate, unlimited retry loops.
- Ensure retry settings are consistent with job deadlines and service objectives.
- Prevent concurrent retries from creating duplicate processing.
- Consider a circuit breaker or temporary processing pause when a dependency experiences sustained failures, where supported.
- Ensure retries do not overwhelm a dependency when service is restored.

### 3.2 Backoff Strategy

An exponential backoff strategy increases the delay between successive attempts. A capped implementation can use the following general model:

\[
d_n = \min(d_{\max}, d_0 \times 2^{n-1})
\]

Where:

- \(d_n\) is the delay before retry attempt \(n\).
- \(d_0\) is the initial retry delay.
- \(d_{\max}\) is the maximum permitted delay.
- \(n\) is the retry attempt number, starting at 1.

Randomized jitter may be applied to reduce the likelihood that many jobs retry simultaneously. The exact algorithm must match the queue implementation and external provider requirements.

This formula is a design example, not a declaration of the backoff algorithm currently used by MedOrbits.

### 3.3 Configuration Record

Document the actual settings for each important job type.

| Job type | Maximum attempts | Initial delay | Maximum delay | Attempt timeout | Exhaustion handling |
|—|—|—|—|—|—|
| Notifications | Verify implementation | Verify implementation | Verify implementation | Verify implementation | Document actual behavior |
| Document processing | Verify implementation | Verify implementation | Verify implementation | Verify implementation | Document actual behavior |
| Application processing | Verify implementation | Verify implementation | Verify implementation | Verify implementation | Document actual behavior |
| External API operations | Verify implementation | Verify implementation | Verify implementation | Verify implementation | Document actual behavior |

These are example categories for the configuration inventory. Confirm which job types exist before completing the table.

## 4. Idempotency and Duplicate Prevention

Retries can repeat an operation whose original outcome is uncertain.

- Use idempotency keys or equivalent safeguards for operations that support them.
- Check the current state of an operation before repeating potentially successful work.
- Prevent duplicate application submissions, payment actions, notifications, and other sensitive side effects where applicable.
- Use transactional or deduplication controls when appropriate.
- Ensure retry behavior remains safe if a worker crashes after completing an operation but before acknowledging the job.
- Define how duplicate job deliveries are handled.
- Ensure concurrent workers cannot independently perform the same non-repeatable operation without suitable coordination.
- Preserve idempotency records for an appropriate period so delayed retries cannot unintentionally repeat completed work.

**Important:** A timeout does not prove that an operation failed. Confirm its outcome before retrying operations that may already have succeeded.

Where external providers support idempotency keys, use the same key for retries of the same logical operation, following the provider’s documented rules. Do not generate a new key for each attempt when doing so would defeat duplicate prevention.

## 5. Retry Exhaustion and Dead-Letter Handling

When a job reaches its configured retry limit:

1. Stop automatic retries unless an explicitly approved policy permits further attempts.
2. Record the final failure category and a sanitized error summary.
3. Preserve the job identifier, attempt count, timestamps, and correlation information where supported.
4. Move the job to a dead-letter queue or another documented failure-handling mechanism if implemented.
5. Notify the responsible owner when intervention is required.
6. Follow `dead-letter-policy.md` for investigation, recovery, replay, and retention.
7. Track unresolved high-impact jobs until they are recovered, cancelled, or otherwise resolved through an approved process.

Do not silently discard exhausted jobs when their completion is important to users or business operations.

Do not assume a dead-letter queue exists until its implementation has been verified. If no dedicated DLQ is implemented, document the actual failure-handling path and the recovery risks.

## 6. Monitoring and Alerting

Monitor retry behavior using the capabilities available in the queue and worker infrastructure.

Recommended signals include:

- Retry attempts by job type.
- Retry exhaustion and terminal failure counts.
- Repeated failures from a specific dependency.
- Processing delays caused by backoff.
- Queue depth and oldest-job age.
- Dead-letter volume, where supported.
- Replay success rates and repeated replay failures.
- Duplicate-processing or idempotency conflicts.
- Worker availability, execution timeouts, and resource utilization.
- Jobs approaching their business deadlines.

Alert when retry activity indicates meaningful service degradation, sustained dependency failures, or a growing backlog that threatens critical workflows.

Alert thresholds should reflect workload, service objectives, and business impact. Document the responsible owner, escalation path, and relevant operational runbook for actionable alerts.

Do not claim monitoring or notifications are active until their configuration and delivery have been verified.

## 7. Operational Recovery

When repeated failures occur:

### Step 1 — Identify the Impact

Determine the affected job types, number of failed jobs, oldest outstanding job, and impacted dependencies.

### Step 2 — Investigate the Cause

Review sanitized logs, correlation identifiers, attempt history, and recent configuration or code changes.

Classify the cause as transient, data-related, configuration-related, code-related, or security-related.

### Step 3 — Assess Processing State

Determine whether affected operations may already have succeeded or partially completed.

Reconcile uncertain external operations before retrying them.

### Step 4 — Correct the Underlying Problem

Fix the cause before initiating bulk retries. Confirm that the affected dependency or service is healthy enough to accept resumed traffic.

### Step 5 — Resume Processing Carefully

- Start with a small, controlled batch.
- Apply appropriate rate limits and concurrency controls.
- Verify idempotency and current job state.
- Monitor failures, latency, and resource usage.
- Increase the replay rate only when results remain stable.

### Step 6 — Validate Outcomes

Confirm successful processing, expected state transitions, and consistency with external providers where applicable.

Check for duplicate side effects and jobs that fail again.

### Step 7 — Record Recovery

Document the cause, corrective action, number of jobs affected, replay outcome, and any remaining risks.

Avoid bulk replay during an active outage or while the underlying cause remains unresolved.

## 8. Security and Data Handling

- Exclude passwords, authentication tokens, payment secrets, and unnecessary personal data from retry logs.
- Restrict access to failed-job records, queue dashboards, and replay controls.
- Sanitize error messages before storing or displaying them.
- Avoid copying complete sensitive payloads into retry metadata.
- Record administrative replay actions where supported.
- Apply the relevant retention policy to retry and failure records.
- Protect queue credentials and worker configuration using approved secret-management mechanisms.
- Ensure job replay cannot bypass the application’s current authorization or business rules.
- Review security-related failures before allowing another attempt.

Retrying a job must not become a way to bypass validation, authorization, or other security controls.

## 9. Operational Review Checklist

- [ ] Retry eligibility is defined for important job types.
- [ ] Retry limits and backoff behavior are finite and documented.
- [ ] Attempt timeouts and job deadlines are configured where appropriate.
- [ ] External provider rate limits are respected.
- [ ] Idempotency and duplicate-prevention safeguards are implemented where needed.
- [ ] Permanent failures do not enter endless retry loops.
- [ ] Retry exhaustion has a documented failure-handling path.
- [ ] Dead-letter handling is documented where implemented.
- [ ] Retry failures and queue backlogs are monitored where supported.
- [ ] Recovery and replay procedures are tested in staging.
- [ ] Sensitive information is excluded from logs and failure metadata.
- [ ] Job owners and escalation responsibilities are documented.
- [ ] Recovery actions and replay outcomes are auditable where supported.

## 10. Related Documentation

Verify that these files exist and reflect the current implementation before relying on them.

- `infrastructure/queues/README.md` — Queue operations overview.
- `infrastructure/queues/dead-letter-policy.md` — Dead-letter investigation, replay, and retention.
- `infrastructure/queues/worker-scaling.md` — Worker capacity and scaling.
- `infrastructure/monitoring/alerting.md` — Alerting policy and escalation.
- `infrastructure/monitoring/health-checks.md` — Health-check design and verification.
- `infrastructure/deployment/staging.md` — Staging validation.
- `infrastructure/deployment/rollback.md` — Rollback and recovery procedures.

## 11. Maintenance Policy

Review this policy whenever queue infrastructure, worker behavior, retry configuration, external integrations, data-retention requirements, or business-critical processing workflows change.

Periodically test failure handling and recovery in a non-production environment. Record test outcomes, identified gaps, and corrective actions.

**Implementation note:** Verify retry limits, backoff algorithms, queue persistence, idempotency safeguards, and dead-letter behavior against the actual MedOrbits implementation before treating them as configured features.

**MedOrbits — Resilient Processing, Safe Retries, Controlled Recovery**
