
# MedOrbits — Worker Scaling Policy

**Project:** MedOrbits  
**Directory:** `infrastructure/queues/`  
**Purpose:** Define operational guidelines for scaling background workers while maintaining processing reliability, service responsiveness, data integrity, and infrastructure stability.  
**Status:** Operational policy — verify all scaling capabilities and configuration against the actual MedOrbits implementation and hosting environment.

## 1. Purpose and Scope

Background workers process asynchronous tasks such as notifications, reminders, scheduled jobs, document processing, and other supported application workflows.

Worker capacity should be adjusted according to workload, queue behavior, processing latency, resource utilization, dependency health, and business priorities.

The actual queue technology, worker deployment model, concurrency configuration, and scaling capabilities must be verified against the current MedOrbits codebase and hosting environment.

This policy defines operational expectations. It does not establish that automatic scaling, multiple worker pools, priority queues, or specific monitoring capabilities are already implemented.

## 2. Scaling Signals

Evaluate worker capacity using available operational metrics.

| Signal | What to monitor | Operational significance |
|—|—|—|
| Queue depth | Number of jobs waiting for processing | Indicates accumulated work and potential capacity shortfalls. |
| Queue age | Age of the oldest pending job | Identifies delays that may threaten business deadlines. |
| Processing latency | Time required to complete jobs | Helps identify slow processing and degraded dependencies. |
| Throughput | Jobs completed per unit of time | Indicates actual processing capacity. |
| Arrival rate | Jobs entering the queue per unit of time | Helps determine whether incoming work exceeds processing capacity. |
| Failure rate | Failed jobs, retries, and retry exhaustion | Helps distinguish capacity problems from application or dependency failures. |
| Worker utilization | CPU, memory, and other relevant resource consumption | Identifies worker-level resource constraints. |
| Worker health | Active workers, unexpected restarts, and processing availability | Reveals unavailable or unstable processing capacity. |
| Dependency capacity | Database connections, storage throughput, and external provider limits | Establishes the safe upper bound for worker concurrency. |
| Business deadlines | Required completion times for critical jobs | Helps prioritize capacity where delays have the greatest impact. |

Do not scale workers based on queue depth alone. Consider arrival rate, processing rate, job complexity, dependency health, and the age of outstanding work.

## 3. Scaling Strategy

### 3.1 Scale Out

Consider increasing worker capacity when:

- Queue depth or oldest-job age remains elevated.
- Incoming jobs consistently exceed processing capacity.
- Processing latency threatens agreed service objectives.
- Worker utilization remains high and additional capacity is available.
- Critical workloads are at risk of missing their deadlines.
- A sustained workload increase exceeds the capacity of the existing worker configuration.

Before scaling out:

1. Confirm that the backlog is caused by insufficient processing capacity rather than repeated failures or a slow dependency.
2. Verify that the database, connection pools, storage systems, and external providers can support additional concurrency.
3. Check whether jobs can safely execute in parallel.
4. Confirm that additional workers will not cause duplicate processing or race conditions.
5. Estimate the expected impact on throughput, resource consumption, and operating cost.

Increasing worker count will not necessarily improve throughput when the bottleneck is a database, external provider, or serialized operation.

### 3.2 Scale In

Consider reducing worker capacity when:

- Queue depth and queue age remain low.
- Processing capacity consistently exceeds workload demand.
- Resource utilization is unnecessarily high.
- Reduced capacity can still meet expected workload and recovery requirements.

Scale in gradually to avoid interrupting active jobs or causing unnecessary processing delays.

Before removing capacity, confirm that active work can finish safely, workers handle shutdown signals correctly, and the remaining capacity can absorb normal workload fluctuations.

### 3.3 Fixed Capacity

If the hosting environment does not support automatic scaling, define a reviewed worker-capacity setting and adjust it through the documented deployment process.

Document:

- The configured worker count or instance size.
- Maximum concurrency per worker.
- Expected processing capacity.
- Relevant resource limits.
- Conditions requiring manual scaling.
- The authorized owner for capacity changes.

Do not assume automatic scaling is available unless it has been configured and verified.

## 4. Concurrency and Resource Limits

Worker concurrency must be bounded and appropriate for each job type.

- Set maximum concurrency based on measured processing behavior.
- Account for database connection limits and connection-pool capacity.
- Respect external provider rate limits.
- Consider memory consumption for document processing and other resource-intensive tasks.
- Prevent one high-volume job type from exhausting capacity needed by critical workflows.
- Use separate worker pools or priority queues where supported and justified.
- Avoid unbounded job execution and uncontrolled parallelism.
- Set suitable execution timeouts for individual jobs.
- Ensure that concurrent workers cannot perform conflicting updates without appropriate coordination.
- Reserve sufficient capacity for essential application operations.

### 4.1 Capacity Planning

Estimate the capacity required to process expected workload and recover from backlog accumulation.

For a stable workload, a basic queue-stability condition is:

\[
\lambda < \mu
\]

Where:

- \(\lambda\) is the average job arrival rate.
- \(\mu\) is the aggregate job processing rate.

If the arrival rate persistently exceeds the processing rate, the backlog will grow. If both rates are approximately equal, there may be insufficient spare capacity to recover from spikes or outages.

For planning purposes, estimate aggregate throughput using measured per-worker throughput and the number of workers. Do not assume throughput increases linearly with worker count; shared dependencies, locks, and contention can reduce the benefit of additional workers.

Document actual concurrency limits, resource allocations, and capacity assumptions in the relevant deployment configuration.

## 5. Queue Priorities and Workload Isolation

Where the queue implementation supports prioritization or separate queues:

- Prioritize time-sensitive work according to business requirements.
- Prevent non-critical bulk jobs from starving critical tasks.
- Isolate resource-intensive workloads when necessary.
- Monitor queue depth and processing latency separately for important job categories.
- Ensure prioritization does not cause indefinite delays for lower-priority jobs.
- Establish appropriate capacity boundaries for workloads with different resource requirements.

Possible workload categories include:

- Time-sensitive notifications and reminders.
- Application and admission-related processing.
- Document processing.
- Bulk or maintenance jobs.
- External API operations.

These are examples, not confirmation that MedOrbits currently uses separate queues or worker pools. Document actual queue names, routing rules, and priority behavior only after verifying the implementation.

## 6. Reliability During Scaling

Scaling must not compromise job delivery or processing correctness.

- Ensure workers handle shutdown signals gracefully.
- Allow active jobs to finish within configured limits or return them safely for retry.
- Ensure interrupted jobs are not silently lost.
- Use idempotency safeguards for operations that may be retried.
- Configure bounded retries and appropriate backoff.
- Route exhausted jobs to the documented failure-handling mechanism, where implemented.
- Verify that deployment or scaling events do not trigger duplicate external side effects.
- Ensure job acknowledgement and persistence behavior are understood.
- Avoid terminating workers while they are performing non-repeatable operations without a recovery strategy.
- Confirm that workers can reconnect safely after temporary dependency failures.

For retry behavior and failed-job recovery, follow:

- `retry-policy.md`
- `dead-letter-policy.md`

Do not assume that a graceful shutdown or a successful worker restart guarantees that every in-flight job was completed correctly.

## 7. Monitoring and Alerting

Monitor worker scaling behavior using available metrics.

- [ ] Queue depth and oldest-job age.
- [ ] Job arrival rate, throughput, and processing latency.
- [ ] Worker count and active concurrency.
- [ ] CPU, memory, and relevant resource utilization.
- [ ] Retry rates and terminal job failures.
- [ ] Worker restarts and unexpected shutdowns.
- [ ] Database connection utilization and query latency.
- [ ] External provider throttling or rate-limit errors.
- [ ] Scheduled-job delays and missed deadlines.
- [ ] Dead-letter volume, where supported.
- [ ] Cost and resource consumption where measurable.

Configure alerts using established operating baselines and service objectives. Avoid unnecessary scaling actions triggered by short-lived workload spikes.

Each actionable alert should identify the affected workload, severity, responsible owner, and relevant runbook where supported.

Do not mark monitoring or alerting as operational until the metrics are available and alert delivery has been verified.

## 8. Scaling Procedure

### Step 1 — Review Workload

Review queue metrics, job arrival rate, processing throughput, oldest-job age, and failure patterns.

Identify which job types are affected and whether the issue threatens a business deadline.

### Step 2 — Identify the Bottleneck

Determine whether the backlog is caused by:

- Insufficient worker capacity.
- Slow or failing database operations.
- External provider throttling or outages.
- Repeated job failures or retry storms.
- Resource-intensive jobs.
- Lock contention or serialized processing.
- An unusually high rate of incoming work.

### Step 3 — Assess Downstream Capacity

Check database health, connection limits, external provider capacity, worker memory requirements, and other shared resources.

Do not increase concurrency beyond what dependencies can safely support.

### Step 4 — Select a Scaling Action

Choose an appropriate action based on the identified bottleneck. Options may include:

- Increasing or decreasing worker count.
- Adjusting concurrency within reviewed limits.
- Isolating resource-intensive workloads.
- Temporarily limiting non-critical job intake.
- Fixing slow operations or repeated failures.
- Pausing unsafe processing while a dependency recovers.

Apply only controls supported by the actual implementation.

### Step 5 — Apply the Change

Use the documented hosting or deployment workflow.

Record significant changes to worker count, concurrency, resource allocation, or job routing.

### Step 6 — Observe the Results

Monitor throughput, queue age, error rates, resource utilization, and downstream dependency health.

Confirm that the backlog is declining without causing database saturation, external provider throttling, or other degradation.

### Step 7 — Reassess

If the backlog continues growing after scaling, investigate the underlying bottleneck rather than continually increasing worker count.

### Step 8 — Record the Outcome

Document the reason for scaling, changes applied, observed results, and any follow-up work.

## 9. Operational Safety

- Avoid scaling beyond database or provider capacity.
- Do not delete queued jobs to reduce backlog without an approved recovery decision.
- Avoid bulk replay during an active dependency outage.
- Preserve job identifiers and correlation information during investigation.
- Restrict access to worker controls and operational dashboards.
- Exclude secrets and unnecessary personal data from logs.
- Record significant capacity changes and related incidents.
- Verify that scaling changes do not bypass authorization or application-level validation.
- Review costs and resource limits when capacity is increased.
- Maintain a recovery plan for worker crashes, interrupted jobs, and dependency outages.

If scaling coincides with increasing errors or downstream degradation, stop further capacity increases and reassess the cause.

## 10. Operational Review Checklist

- [ ] Worker deployment model and scaling capabilities are documented.
- [ ] Queue depth, arrival rate, throughput, and oldest-job age are observable where supported.
- [ ] Concurrency and resource limits are defined.
- [ ] Database and external dependency limits are considered.
- [ ] Graceful shutdown behavior is tested.
- [ ] In-flight job recovery behavior is understood.
- [ ] Retry and dead-letter handling are documented.
- [ ] Critical workloads have appropriate processing priorities where supported.
- [ ] Scaling changes are monitored and recorded.
- [ ] Worker recovery is tested in staging.
- [ ] Capacity assumptions are reviewed as workload grows.
- [ ] Scaling permissions and operational ownership are defined.
- [ ] Resource and cost implications are reviewed before significant increases.

## 11. Related Documentation

Verify that these files exist and reflect the current implementation before relying on them.

- `infrastructure/queues/README.md` — Queue operations overview.
- `infrastructure/queues/retry-policy.md` — Retry eligibility, backoff, and retry exhaustion.
- `infrastructure/queues/dead-letter-policy.md` — Failed-job investigation, replay, and retention.
- `infrastructure/monitoring/alerting.md` — Alerting and escalation policy.
- `infrastructure/monitoring/health-checks.md` — Health-check design and verification.
- `infrastructure/deployment/staging.md` — Staging validation.
- `infrastructure/deployment/production.md` — Production release checklist.
- `infrastructure/deployment/rollback.md` — Rollback and recovery procedures.

## 12. Maintenance Policy

Review this policy whenever queue infrastructure, worker deployment, job volume, processing requirements, or hosting capabilities change.

Reassess capacity assumptions after significant workload changes, repeated backlogs, dependency incidents, or major changes to job complexity.

Periodically test worker shutdown, recovery, retry behavior, and scaling procedures in a non-production environment. Record test outcomes and corrective actions.

**Implementation note:** This document defines operational guidance, not proof that autoscaling, multiple worker pools, queue prioritization, or specific metrics are implemented. Verify actual capabilities and configuration before relying on them in production.

**MedOrbits — Reliable Processing, Controlled Scaling, Stable Operations**
