
# Backup and Recovery

**Project:** MedOrbits  
**Purpose:** Define backup, retention, restoration, disaster recovery, and recovery-validation requirements for production systems.

## 1. Overview

MedOrbits must maintain a documented and testable recovery process for critical application data and supporting infrastructure.

Backup procedures must protect data integrity, confidentiality, and availability. Recovery procedures must be tested before they are relied upon during a production incident.

The actual database engine and configuration, hosting-platform capabilities, persistent-storage configuration, and deployed backup tooling determine which procedures are available.

This document defines the required operational process. It does not establish that automated backups, point-in-time recovery, cross-region replication, or a particular recovery tool is already configured.

## 2. Recovery Objectives

Define, approve, and periodically review recovery objectives for each critical system and data store.

| Objective | Definition |
|—|—|
| Recovery Point Objective (RPO) | Maximum acceptable data loss, measured as the time between the recovery point and the incident. |
| Recovery Time Objective (RTO) | Target maximum time to restore the required service to an acceptable operational state. |

Document approved objectives for the database, uploaded documents, application services, and other critical resources where applicable.

Consider the consequences of losing:

- User accounts and authorization records.
- Education and admissions data.
- Applications and application-status changes.
- Private documents and uploaded files.
- Payment references and subscription records.
- Audit records and security-relevant events.
- Configuration and metadata required to restore the application.

Do not publish numerical RPO or RTO commitments until they have been approved and the required recovery capabilities have been verified.

A recovery objective is a target, not evidence that the current infrastructure can meet it. Record actual recovery-drill results and any gaps.

## 3. Backup Requirements

### 3.1 Automation and Monitoring

- Automate backups using an approved database or hosting-platform mechanism.
- Define backup frequency according to the approved RPO.
- Monitor backup completion, failure, duration, and freshness.
- Alert the responsible team when a backup fails or becomes overdue.
- Retain sufficient execution history to investigate backup failures.
- Periodically test restoration rather than relying solely on successful backup-job status.
- Verify that the backup process covers all required resources.
- Document how backups are accessed when the primary application or hosting environment is unavailable.

A successful backup command does not, by itself, prove that the resulting backup can be restored.

### 3.2 Backup Contents and Dependencies

Identify all resources required to restore the application to a consistent state.

Depending on the actual database and application architecture, this may include:

- Database schema and table data.
- Indexes, constraints, and foreign-key relationships.
- Stored procedures and functions, if used.
- Database events and triggers, if used.
- Required database-level configuration and permissions.
- Migration history and relevant version information.
- Uploaded documents and other persistent application-managed files.
- Persistent queue or job state, if required for recovery.
- Configuration references needed to reconnect the restored application to its dependencies.
- Relevant audit and reconciliation records.

Identify resources managed separately by the hosting platform or other services.

Do not assume a database backup includes application files, external-service records, deployment configuration, secrets, or third-party transaction histories.

Maintain an inventory that identifies each critical resource, its backup method, owner, retention policy, and recovery procedure.

### 3.3 Consistency Across Data Stores

When the application stores related information in multiple systems, recovery must account for consistency between those systems.

For example, an application record may reference an uploaded document stored separately from the database. Restoring only one resource may leave missing files or orphaned records.

Document how to:

- Identify related backup timestamps or recovery points.
- Restore database and file-storage resources in a compatible state.
- Detect missing files and orphaned database references.
- Reconcile external transactions and callbacks.
- Handle queue messages and scheduled jobs after recovery.

Where the backup mechanisms cannot produce a coordinated recovery point, document the limitations and required reconciliation steps.

### 3.4 Storage and Access Controls

- Store backups separately from the primary database or failure domain.
- Use storage with appropriate durability and access controls.
- Encrypt backups in transit and at rest using approved mechanisms.
- Restrict backup access to authorized personnel and recovery processes.
- Protect encryption keys and backup credentials separately from backup data.
- Avoid exposing backup files through public web directories.
- Record access to sensitive backup resources where supported.
- Verify that authorized recovery personnel can access required backups during an incident.
- Protect backups from unauthorized modification and deletion where supported.
- Ensure backup retention is not dependent solely on the availability of the primary application.

A backup stored only alongside the primary system may be lost in the same incident.

### 3.5 Retention and Deletion

Define retention periods according to operational requirements, applicable legal obligations, contractual requirements, and data-protection policies.

The retention policy must specify:

- Backup frequency and retention duration.
- Handling of daily, weekly, monthly, or other backup generations, where applicable.
- Deletion of expired backup copies.
- Treatment of backups subject to legal holds or approved exceptions.
- Secure disposal of expired backup data and associated credentials.
- How deletion obligations are handled when personal data remains in retained backups.
- Procedures for preventing expired backups from being used for routine restoration.

Document the limitations of deleting an individual record from an immutable or full-database backup.

Where restoring an older backup may reintroduce previously deleted or corrected records, use the approved reconciliation and deletion procedures before returning the system to normal operation.

## 4. Pre-Recovery Assessment

Before restoring a production system:

1. Declare the recovery event and identify the incident owner.
2. Determine the scope and severity of the failure.
3. Identify the affected database, files, services, and application versions.
4. Establish the latest known-good recovery point.
5. Confirm backup integrity and availability.
6. Review the approved RPO, RTO, and recovery plan.
7. Identify the required database version, configuration, permissions, and dependencies.
8. Determine whether the primary system must be isolated to prevent further corruption or conflicting writes.
9. Confirm who is authorized to approve restoration and traffic switching.
10. Assess the potential loss of writes and external operations after the selected recovery point.
11. Record the recovery decision and intended approach.

Preserve relevant logs and diagnostic evidence where required. Avoid overwriting a potentially recoverable system before its state has been assessed.

If a security incident may have compromised the original system, verify that the selected backup and recovery environment are not affected by the same compromise.

## 5. Recovery Procedure

### Step 1 — Declare and Coordinate

Declare the recovery event using the applicable incident-management process.

Assign a recovery owner, communicate the expected impact, and establish the approval path for restoration and traffic switching.

Record the incident identifier, initial assessment, affected resources, and recovery objectives.

### Step 2 — Select and Verify the Backup

Identify a known-good backup suitable for the incident.

Verify:

- Backup timestamp and recovery point.
- Backup completion status.
- File integrity using the available checksum or verification mechanism.
- Decryption and access requirements.
- Compatibility with the intended database environment.
- Availability of required schema objects and supporting files.
- Whether the backup may contain corrupted, compromised, or otherwise unsuitable data.

A checksum confirms integrity relative to the recorded checksum; it does not independently prove that a database can be restored successfully.

### Step 3 — Provision the Recovery Environment

Provision an isolated or otherwise approved recovery environment.

Confirm:

- Compatible database version and relevant configuration.
- Required storage capacity and permissions.
- Restricted network access.
- Availability of migration history and recovery tooling.
- Separation from production traffic and external side effects.
- Access to the required secrets through the approved recovery process.
- Sufficient capacity for restoration, validation, and expected application workload.

Do not restore a backup into the live production database until the recovery plan explicitly authorizes that operation.

### Step 4 — Restore the Database

Use the documented database recovery script or another approved restoration process.

Follow the procedure for the selected backup format and database version.

The procedure must specify how to handle schema objects, database users and privileges, stored routines, triggers, events, and other required resources.

Do not invent or substitute a recovery command without verifying the actual backup format, script, and target environment.

If point-in-time recovery or transaction-log replay is configured, follow the approved procedure and confirm the target recovery timestamp before execution.

### Step 5 — Restore Supporting Resources

Restore the required files and other persistent resources using their documented procedures.

Verify that:

- Required files are present and readable.
- File permissions and ownership are appropriate.
- Private files remain protected.
- Database references to stored files are valid.
- Required configuration and metadata are available.
- Queue or scheduled-job state is handled safely.
- No test or recovery configuration can accidentally trigger production side effects.

If a resource cannot be restored, document the gap and assess its impact before proceeding.

### Step 6 — Validate Restored Data

Before allowing normal application traffic, validate:

- Schema and expected database objects.
- Table and record counts against appropriate reference points.
- Primary-key and foreign-key relationships.
- Unique constraints and other integrity rules.
- Critical records and representative queries.
- Migration history and schema compatibility.
- Consistency across related tables.
- Availability of required uploaded documents and persistent resources.
- Application-specific invariants and business rules.

Record discrepancies and determine whether they are expected consequences of the recovery point or signs of an incomplete restoration.

Do not rely exclusively on row counts. Data-integrity checks must also evaluate the relationships and business rules relevant to the recovered application.

### Step 7 — Validate Application Workflows

Deploy or configure a compatible application version in the recovery environment.

Run controlled checks for critical workflows relevant to the incident, including:

- Application startup and database connectivity.
- Authentication and authorization.
- Education and admissions data retrieval.
- Application creation and status retrieval, where appropriate.
- Authorized document access.
- Payment and subscription status verification, where enabled.
- Administrative access and essential reporting.
- Relevant search and API operations.

Avoid sending live emails, triggering real payments, or performing irreversible third-party operations during validation unless specifically authorized.

### Step 8 — Reconcile Post-Backup Changes

Identify data created or modified after the selected recovery point.

Where possible, reconcile missing records using approved transaction logs, application records, provider records, or other authoritative sources.

Pay particular attention to:

- Application submissions and status changes.
- Document uploads and metadata.
- Payment references and subscription changes.
- Webhook events and external callbacks.
- Notifications and scheduled operations.
- Audit and security-relevant events.

Do not blindly replay transactions or callbacks. Use appropriate reconciliation and idempotency controls to prevent duplicate processing.

Record unrecoverable data loss, unresolved discrepancies, and any impact on users.

### Step 9 — Approve Traffic Switching

Switch production traffic only after the authorized decision-maker confirms that the recovery environment is sufficiently validated.

Before switching:

- Confirm the intended application and database endpoints.
- Verify permissions and secrets.
- Check required integrations and storage access.
- Confirm monitoring and alerting.
- Establish how to stop or reverse the cutover if validation fails.
- Confirm that only the intended environment can process production writes.
- Communicate the decision and expected service impact.

Avoid allowing the original and restored environments to accept conflicting production writes simultaneously unless the architecture explicitly supports this mode.

### Step 10 — Monitor and Close the Recovery

After traffic switching, monitor application errors, latency, database health, critical workflows, and relevant external integrations.

Confirm that the restored system remains consistent under normal operation.

Document:

- The final recovery point.
- Restoration start and completion times.
- Actual recovery duration.
- Estimated data loss.
- Data discrepancies and reconciliation actions.
- User and service impact.
- Outstanding corrective actions.

Close the recovery event only after required validation and approval are complete.

## 6. Recovery and Deployment Compatibility

Database recovery must be coordinated with application deployment.

- Confirm that the application version is compatible with the restored schema.
- Review migrations applied after the selected backup.
- Determine whether application rollback is safe against the restored schema.
- Assess whether external transactions or notifications require reconciliation.
- Avoid automatically rerunning migrations without checking migration history and the actual schema.
- Use a forward fix or controlled data-repair procedure when reversal could cause additional data loss.
- Confirm that the recovered application uses the intended production configuration before traffic switching.

Application rollback, database restoration, and external-system reconciliation are separate operations.

Restoring a database backup may discard legitimate changes made after that backup. A successful application rollback does not establish that database or external-system state is correct.

## 7. Recovery Drills

Run periodic restoration drills in a non-production environment.

Each drill should verify that:

1. A backup can be located and accessed by authorized personnel.
2. Required decryption keys and recovery credentials are available.
3. The documented restoration procedure can be completed.
4. Schema and data-integrity checks pass.
5. Required supporting resources can be restored.
6. Critical application workflows function after restoration.
7. The observed recovery time is recorded against the approved RTO.
8. The potential amount of data loss is assessed against the approved RPO.
9. Recovery access controls and monitoring work as expected.
10. Missing resources, access problems, and procedural gaps are documented.

Never conduct a destructive recovery drill against production.

Record the drill date, backup selected, database version, observed duration, validation results, failures, and corrective actions.

Where a full recovery drill is not feasible, document the limited scope of the exercise and do not treat it as equivalent to a complete restoration test.

A backup is not considered reliable merely because it exists; its restoration must be tested.

## 8. Incident and Recovery Records

For each production recovery, record the following information.

| Field | Required information |
|—|—|
| Incident identifier | Incident or recovery reference |
| Recovery owner | Responsible person or team |
| Incident declaration | Timestamp and timezone |
| Affected resources | Database, files, services, or other affected systems |
| Selected recovery point | Backup identifier and timestamp |
| Restoration start and end | Observed timestamps |
| Recovery outcome | Successful, partial, or unsuccessful |
| Data validation | Checks completed and discrepancies |
| RPO assessment | Estimated data loss relative to the approved objective |
| RTO assessment | Actual recovery time relative to the approved objective |
| Traffic-switch approval | Authorized decision and timestamp |
| User impact | Known service interruption or data impact |
| Follow-up actions | Corrective actions, owners, and deadlines |

Do not include passwords, secret values, encryption keys, or unnecessary personal information in incident records.

Store records in the approved location with access controls appropriate to their sensitivity.

## 9. Responsibilities

Assign clear ownership for:

- Backup scheduling and monitoring.
- Backup storage and access controls.
- Encryption-key and credential management.
- Recovery approval and execution.
- Database and application validation.
- External-system reconciliation.
- Incident communication.
- Recovery-drill scheduling and remediation.
- Retention-policy review and enforcement.

Use the actual MedOrbits team structure and hosting capabilities when assigning responsibilities. Where a responsibility is shared with the hosting provider, document the division of duties and escalation path.

## 10. Related Documentation

Verify all paths against the current repository.

- `docs/database/README.md` — Database documentation.
- `docs/database/schema.md` — Database schema overview.
- `docs/database/migrations.md` — Migration procedures and safeguards.
- `docs/deployment/production.md` — Production deployment, if present.
- `docs/deployment/staging.md` — Staging validation, if present.
- `docs/architecture/system-architecture.md` — System architecture, if present.
- `docs/architecture/application-data-flow.md` — Data-processing flows, if present.
- Hosting-platform backup and recovery documentation.
- Incident-response and security procedures.

## 11. Definition of Done

A production recovery is complete when:

- [ ] The restored environment has passed required integrity checks.
- [ ] Critical application workflows have been verified.
- [ ] Required supporting resources have been restored or their loss documented.
- [ ] Data discrepancies have been reconciled or explicitly documented.
- [ ] Traffic switching has been authorized.
- [ ] Monitoring confirms acceptable operation.
- [ ] RPO and RTO outcomes have been assessed against approved objectives.
- [ ] User impact and unresolved risks have been documented.
- [ ] The recovery record and follow-up actions have been completed.

**Accuracy rule:** Document only backup schedules, recovery scripts, retention policies, and hosting-platform capabilities that have been verified. This procedure defines the required recovery process; it does not establish that automated backups, point-in-time recovery, replication, or tested restoration tooling already exist.
