
# MedOrbits — Production Release Checklist

**Project:** MedOrbits  
**Scope:** Production deployments, release validation, service recovery, and post-release verification  
**Applies to:** Application code, database migrations, configuration changes, background workers, and infrastructure updates

## 1. Purpose

This checklist standardizes MedOrbits production releases, reduces deployment risk, and verifies critical application workflows before and after deployment.

Every release must follow the approved deployment process, have an identified owner, and include appropriate validation and recovery procedures.

Do not mark a check complete unless it has been verified. Any skipped or waived requirement must have documented justification and approval from an authorized owner.

## 2. Before Deployment

### 2.1 Code and Build Readiness

- [ ] Release commit reviewed and approved.
- [ ] CI pipeline completes successfully.
- [ ] Automated tests, linting, and applicable security checks pass.
- [ ] Production build completes successfully.
- [ ] Required dependency and configuration changes are reviewed.
- [ ] Release notes, known issues, and expected service impact are documented.
- [ ] The release identifier or commit SHA is recorded.
- [ ] The deployment artifact corresponds to the approved commit.

### 2.2 Configuration and Security

- [ ] Required environment variables and secrets are present and valid.
- [ ] Production credentials are configured through the approved secret-management mechanism.
- [ ] No secrets, private keys, or sensitive configuration values are included in the release artifact or logs.
- [ ] External provider credentials, callback URLs, and webhook endpoints are verified where applicable.
- [ ] Authentication, authorization, and access-control behavior are reviewed for affected functionality.
- [ ] Required database and external-service permissions are available and appropriately restricted.

### 2.3 Database and Data Protection

- [ ] Database backup is current and suitable for the planned change.
- [ ] The recovery procedure and responsible operator are identified.
- [ ] Database migrations are reviewed for backward compatibility, locking risk, execution time, and rollback implications.
- [ ] Migration behavior has been tested in a suitable non-production environment.
- [ ] Required storage capacity and database resource headroom are available.
- [ ] Data transformations and backfills have validation and failure-handling procedures.
- [ ] The team understands whether rollback requires a forward-fix migration or a separate recovery operation.
- [ ] No production restore is planned as a routine substitute for migration rollback.

### 2.4 Operations Readiness

- [ ] Monitoring, logging, health checks, and alert notifications are operational.
- [ ] Release owner and rollback decision-maker are identified.
- [ ] Deployment, incident-response, and recovery instructions are accessible.
- [ ] The previous known-good release reference is available.
- [ ] Background workers, scheduled jobs, and queue dependencies are understood.
- [ ] The deployment window and stakeholder notifications are agreed where required.
- [ ] Success criteria, stop conditions, and escalation routes are documented.

## 3. Deployment Procedure

1. **Confirm approval.** Verify the approved commit, release identifier, deployment window, and responsible owner.
2. **Deploy the approved release.** Use the documented production hosting workflow.
3. **Inspect build and startup.** Review build output, application startup, configuration loading, and migration execution.
4. **Verify release identity.** Confirm that the deployed application is running the expected commit or release identifier.
5. **Check service health.** Verify the configured health endpoint and relevant dependency checks.
6. **Run smoke tests.** Validate critical user journeys and required service integrations.
7. **Verify background processing.** Confirm that workers, scheduled jobs, and queues are operating correctly where implemented.
8. **Inspect operational signals.** Review error rates, response latency, database health, resource utilization, and queue backlog where applicable.
9. **Compare against acceptance criteria.** Evaluate observed behavior against established service objectives and release-specific expectations.
10. **Make the release decision.** Continue, pause, mitigate, or roll back according to the approved release criteria.

Pause or halt the rollout if errors, availability issues, data-integrity risks, or user impact exceed agreed limits.

Do not proceed to the next release stage while a critical failure remains unexplained.

## 4. Critical Workflow Smoke Tests

Run tests appropriate to the functionality affected by the release.

| Workflow | Verification |
|—|—|
| Application availability | Confirm the service responds and required routes load. |
| Authentication | Verify login, logout, session handling, and applicable access controls. |
| Registration | Verify registration and email OTP flows where implemented. |
| Course discovery | Confirm search, filtering, and course-detail pages behave as expected. |
| Application submission | Verify required-field validation, submission handling, and resulting application state. |
| Document access | Confirm authorized users can access permitted documents and unauthorized users cannot. |
| Payments | Where implemented, verify payment state handling using an approved test or reconciliation procedure. Avoid unintended live charges. |
| Webhooks | Where implemented, verify signature validation, duplicate-event handling, and processing outcomes. |
| Background jobs | Confirm critical jobs execute and failures are observable. |
| Database | Verify connectivity, migration outcomes, and relevant data-integrity checks. |
| External integrations | Confirm required providers respond and failure handling behaves correctly. |
| Security controls | Verify critical authorization boundaries and sensitive-data protections affected by the release. |

Record the result of each applicable test. Mark non-applicable tests as `N/A` with a brief explanation rather than silently skipping them.

## 5. After Deployment

- [ ] Confirm critical user workflows complete successfully.
- [ ] Confirm background workers and scheduled jobs are healthy.
- [ ] Verify payment and webhook processing where applicable.
- [ ] Review application logs for unexpected errors or warnings.
- [ ] Confirm database connectivity and migration results.
- [ ] Verify monitoring dashboards and alert notifications.
- [ ] Review application latency, error rates, and resource utilization.
- [ ] Confirm that queue backlogs and scheduled jobs are within expected operating ranges where applicable.
- [ ] Verify access controls and sensitive-data handling for affected features.
- [ ] Record the release identifier, deployment time, outcome, and responsible owner.
- [ ] Document incidents, deviations, and follow-up actions.
- [ ] Keep the previous known-good release reference available.
- [ ] Notify relevant stakeholders of the release outcome.

Continue monitoring for a defined observation period appropriate to the release risk. The observation period and acceptance criteria should be recorded in the release plan.

## 6. Rollback and Recovery

A code rollback may not reverse database changes, sent emails, payment actions, document processing, or other external side effects.

Before initiating a rollback:

1. Assess the impact and identify the immediate failure.
2. Decide whether to roll back, pause the rollout, or apply a targeted mitigation.
3. Confirm whether database migrations are compatible with the previous release.
4. Determine whether data restoration, reconciliation, or a forward-fix migration is required.
5. Coordinate recovery of external side effects with the responsible service or provider.
6. Confirm that the recovery action is authorized and will not create additional data loss.
7. Execute the approved rollback or mitigation procedure.
8. Verify critical workflows, database integrity, and service health after recovery.
9. Record the decision, actions taken, and final outcome.

**Important:** Restoring the previous application version does not necessarily restore the database to its previous state. Database recovery must follow the approved backup and recovery procedure.

Do not restore a database backup automatically merely because a deployment failed. Assess subsequent writes, external side effects, and potential data loss before choosing a recovery strategy.

Refer to `infrastructure/deployment/rollback.md` and the applicable database recovery documentation, after verifying that those files exist and match the current implementation.

## 7. Release Record

Complete this record for every production deployment.

| Field | Record |
|—|—|
| Release identifier / commit SHA | |
| Deployment date and time, including timezone | |
| Release owner | |
| Approval reference | |
| Deployment environment and service | |
| Database migration version | |
| Backup reference and verification status | |
| Deployment outcome | |
| Smoke-test outcome | |
| Monitoring observation period and outcome | |
| Rollback or mitigation required | |
| Incident reference, if applicable | |
| Follow-up actions and owners | |

Do not include passwords, tokens, private keys, or unnecessary personal data in the release record.

## 8. Release Completion Criteria

A release is complete when:

- [ ] All required checks have been completed or formally waived by an authorized owner.
- [ ] The deployed release identity matches the approved release.
- [ ] Critical workflows pass their applicable smoke tests.
- [ ] Database migrations and relevant integrity checks have been validated.
- [ ] Monitoring shows no unacceptable release-related degradation.
- [ ] Background processing and required integrations are healthy.
- [ ] Incidents have an assigned owner and documented next steps.
- [ ] The release record has been updated.
- [ ] Relevant stakeholders have been notified of the outcome.

A release must not be marked successful while a critical failure or unresolved data-integrity risk remains without an explicitly approved incident-management decision.

## 9. Maintenance

Keep this checklist aligned with the actual hosting workflow, CI pipeline, database migration process, monitoring configuration, and recovery procedures used by MedOrbits.

Review it after significant incidents, deployment architecture changes, security findings, and changes to critical application workflows.

Verify all referenced paths, commands, environment variables, and operational capabilities against the current repository and deployed environment.

—

**MedOrbits — Controlled Releases, Reliable Recovery**
