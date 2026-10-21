
# MedOrbits — MySQL Restore Drill

**Directory:** `infrastructure/backup/`  
**Document:** `infrastructure/backup/restore-drill.md`

**Related scripts:**
- `mysql-backup.sh`
- `restore-mysql.sh`

**Purpose:** Demonstrate that a MySQL backup can be restored into an isolated environment, that the recovered data is usable, and that recovery objectives can be measured.

> **Operational requirement:** A successful backup command or archive-integrity check does not prove recoverability. A restore drill must validate the restored database and, where applicable, confirm that relevant application functions work as expected.

—

## 1. Objective

Verify that MedOrbits can recover a MySQL database from a selected backup and restore service within agreed recovery objectives.

Each drill should establish whether:

- The selected backup is accessible and sufficiently complete.
- The archive passes the available integrity checks.
- The SQL dump can be imported into an isolated target.
- Required database objects and representative records are present.
- Relevant application workflows operate correctly against the recovered database.
- Recovery Point Objective (RPO) and Recovery Time Objective (RTO) targets are met.
- Failures and discrepancies are documented and assigned for remediation.

A drill is considered successful only when the required validation steps pass, not merely when the restore process exits successfully.

## 2. Frequency and Ownership

Run a restore drill:

- At least quarterly.
- After major database schema changes.
- After changing backup scripts, storage systems, or database configurations.
- After significant changes to the recovery process.
- After introducing a new backup format or recovery mechanism.
- More frequently when contractual, business, or regulatory requirements demand it.

Assign an owner responsible for scheduling drills, coordinating the recovery environment, recording results, and tracking remediation.

Define a reviewer or approver for recovery tests involving sensitive data or critical business services.

## 3. Prerequisites

Before beginning, confirm the following:

- [ ] The backup to test has been identified and its timestamp recorded.
- [ ] The backup’s source and provenance are understood.
- [ ] A compatible MySQL version and configuration are available.
- [ ] A disposable, isolated database or test instance is prepared.
- [ ] The target is explicitly confirmed not to be production.
- [ ] The restore account has only the privileges required for the drill.
- [ ] Sufficient disk space and recovery resources are available.
- [ ] Backup files and restored data are protected from unauthorized access.
- [ ] Credentials are supplied through a protected option file or approved secret-management mechanism.
- [ ] The restore script’s behavior, target selection, and overwrite protections have been reviewed.
- [ ] External integrations are configured so the drill cannot trigger real transactions or notifications.

Use synthetic or appropriately protected test data wherever practical. If the backup contains personal or confidential information, apply the required access controls, retention rules, and data-handling safeguards.

### Safety gate

Do not proceed if the target environment cannot be positively identified, production isolation cannot be demonstrated, or the restore procedure could overwrite valuable data.

Do not rely solely on a database name as proof that a target is safe.

## 4. Restore Drill Procedure

### Step 1 — Select and verify the backup

Choose a recent backup representative of the recovery requirements.

- [ ] Record the backup filename or identifier.
- [ ] Record the backup timestamp in UTC.
- [ ] Verify file ownership and access permissions.
- [ ] Verify the checksum against a trusted recorded checksum, if available.
- [ ] Test the compressed archive using the available integrity-verification procedure.
- [ ] Confirm that the selected backup is suitable for the intended recovery test.

For a gzip-compressed SQL dump, an integrity check may be performed with:

```bash
gzip -t — /path/to/backup.sql.gz
```

Replace the example path with the actual backup path.

A successful compression check confirms that the gzip stream can be read and validated. It does not prove that the SQL is complete, that all database objects can be imported, or that the recovered database will function correctly.

If a trusted checksum is unavailable, record that limitation rather than claiming checksum verification succeeded.

### Step 2 — Prepare the recovery environment

Create or provision a disposable, isolated MySQL database or test instance.

- [ ] Confirm the MySQL version and relevant configuration.
- [ ] Confirm that the environment cannot accidentally modify production.
- [ ] Explicitly identify the destination server and database.
- [ ] Verify that the restore account has the necessary privileges without unnecessary administrative access.
- [ ] Configure credentials securely.
- [ ] Prevent test data from being exposed through public web directories or unrestricted services.
- [ ] Disable or safely redirect outbound integrations that could send real emails, process payments, or notify external systems.
- [ ] Confirm that adequate disk space is available for the database and temporary files.

Use an isolated instance where practical. If using a separate database on a shared MySQL server, verify that privileges and database selection cannot affect other databases.

### Step 3 — Restore the backup

Use `restore-mysql.sh` when its implementation supports the selected backup format and the intended recovery target.

Before execution:

- [ ] Review the script’s target-selection logic.
- [ ] Confirm the selected backup path.
- [ ] Confirm the destination host and database.
- [ ] Review overwrite behavior and confirmation prompts.
- [ ] Verify that the target is isolated and disposable.
- [ ] Confirm that credentials are not exposed in shell history or process arguments.

Monitor the restore for:

- SQL import errors.
- Permission or configuration problems.
- Missing tables, views, routines, triggers, or events.
- Character-set or collation issues.
- Timeouts, resource constraints, or insufficient disk space.
- Unexpected schema or object conflicts.

If the restore fails, treat the target as potentially partially modified. Investigate the cause before retrying. Prefer recreating a clean disposable target when appropriate instead of assuming that rerunning the import will safely repair a partial restore.

**Safety rule:** Never run a restore drill against production or an active database containing valuable data.

### Step 4 — Validate the restored database

Compare the restored database with the expected schema and available reference information.

- [ ] Expected tables and views exist.
- [ ] Table counts are plausible and discrepancies are explained.
- [ ] Representative records can be queried.
- [ ] Primary keys, foreign keys, and important relationships are valid.
- [ ] Indexes and constraints are present.
- [ ] Triggers, stored routines, and scheduled database events are present where expected.
- [ ] Character encoding and collation are correct.
- [ ] Important timestamps, monetary values, and status fields are preserved.
- [ ] No unresolved import errors or unexplained data gaps remain.

Where supported by the schema and database engine, perform additional integrity checks for important relationships and application invariants.

Table counts may change if the source database was modified after the backup was taken. Compare results against the appropriate backup-time reference rather than assuming current production counts must match.

For backups created with `mysqldump —single-transaction`, remember that consistent snapshot behavior primarily applies to transactional tables such as InnoDB. Non-transactional tables and concurrent schema changes require separate consideration.

### Step 5 — Validate application behavior

Where the test environment supports it, run relevant application checks against the restored database.

Examples include:

- [ ] Reading representative education catalogues.
- [ ] Retrieving synthetic test-user and application records.
- [ ] Loading relevant course, college, and university information.
- [ ] Verifying expected relationships between applications and associated records.
- [ ] Checking relevant database-backed pages and API endpoints.
- [ ] Confirming that expected read and write operations work in the isolated environment.
- [ ] Confirming that authorization prevents cross-user access to protected records.

Use synthetic accounts and test records wherever practical.

Do not connect the drill environment to live payment processing, production email delivery, or other external services that could trigger real transactions or notifications.

Mark application validation as **Not applicable** only when the drill’s approved scope excludes application-level testing, and document the reason.

### Step 6 — Record recovery measurements

Record:

- Backup identifier and timestamp.
- Source and destination environments.
- MySQL version and relevant configuration.
- Restore start and completion times in UTC.
- Total restore duration.
- Database validation results.
- Application validation results.
- Errors, discrepancies, and corrective actions.
- Whether the agreed RPO and RTO targets were met.

Define the measurement boundaries consistently. For example, the operational recovery duration may include environment preparation, database import, validation, and the steps required to make the service usable.

Record the actual duration and the agreed measurement definition so that subsequent drills can be compared meaningfully.

### Step 7 — Clean up the test environment

After validation and approval:

- [ ] Remove temporary test resources and restored data securely, unless retention is explicitly approved.
- [ ] Confirm that no test database or service remains unintentionally exposed.
- [ ] Revoke temporary credentials or remove temporary access.
- [ ] Preserve the drill report and required audit evidence.
- [ ] Retain logs needed for remediation without exposing secrets or unnecessary personal information.
- [ ] Record any resources that must remain temporarily available for investigation.

Follow the approved data-retention and secure-deletion procedures. Do not claim that data has been securely erased unless the applicable storage system and deletion process support that conclusion.

### Step 8 — Track remediation

For each failure or discrepancy:

1. Describe the issue and its impact.
2. Assign a responsible owner.
3. Record the corrective action and target completion date.
4. Identify any interim mitigation required.
5. Retest the affected recovery step.
6. Document the final result and closure evidence.

A failed drill remains an open recovery risk until the issue is resolved or formally accepted by an authorized owner.

## 5. Recovery Objectives and Measurements

### Recovery Point Objective (RPO)

The maximum acceptable data loss measured in time.

Define the RPO with the relevant business owner. Verify that backup frequency, backup completeness, and recovery procedures can meet the target.

A backup timestamp alone does not prove the actual recoverable data point. Where applicable, account for backup duration, database consistency, binary logs, and other recovery dependencies.

### Recovery Time Objective (RTO)

The maximum acceptable time to restore the required service.

Define the RTO with the relevant business owner and measure recovery duration during drills, including the agreed preparation, restoration, validation, and service-restoration steps.

Targets must reflect business requirements rather than assumptions based solely on the speed of a database import.

### Target assessment

For each drill, record:

| Measure | Required record |
|—|—|
| RPO target | Approved maximum acceptable data loss |
| Recovery point | Latest data point demonstrably recoverable from the tested backup or recovery chain |
| RPO result | Met, not met, or unable to determine |
| RTO target | Approved maximum recovery duration |
| Measured duration | Actual duration using the agreed measurement boundaries |
| RTO result | Met, not met, or unable to determine |

Do not report a target as met when the necessary evidence is unavailable.

## 6. Backup and Recovery Safety

- Never run a restore drill against production.
- Never commit backup archives or database credentials to source control.
- Never store private backup archives in publicly served web directories.
- Protect backups with encryption, least-privilege access, appropriate retention, and off-site or separately isolated copies.
- Protect restored test data to the standard required by its sensitivity.
- Keep backup credentials separate from ordinary application credentials where practical.
- Verify that backups can be accessed during recovery without unnecessarily exposing secrets.
- Maintain a recovery procedure for corrupted, incomplete, inaccessible, or incompatible backups.
- Preserve appropriate audit evidence without retaining unnecessary sensitive data.
- Verify the availability of decryption keys and recovery credentials through approved procedures.
- Review whether backup retention and deletion settings meet operational and legal requirements.

A backup stored only on the same infrastructure as the production database may be vulnerable to the same failure, compromise, or accidental deletion.

## 7. Drill Record Template

Complete one record for every drill.

| Field | Record |
|—|—|
| Drill date | `YYYY-MM-DD` |
| Responsible owner | Name or team |
| Reviewer | Name or team |
| Backup identifier | Filename or backup ID |
| Backup timestamp | UTC timestamp |
| Backup integrity result | Pass, fail, or not verified |
| Test environment | Isolated instance or database |
| MySQL version | Tested version |
| Restore start | UTC timestamp |
| Restore completion | UTC timestamp |
| Total recovery duration | Measured duration |
| RPO target and result | Target; met, not met, or undetermined |
| RTO target and result | Target; met, not met, or undetermined |
| Database validation | Pass, fail, or notes |
| Application validation | Pass, fail, or not applicable |
| Issues found | Summary or issue references |
| Remediation owner | Name or team |
| Remediation target date | Date or not applicable |
| Final status | Pass, fail, or pending remediation |
| Evidence location | Approved internal reference |

Do not include passwords, access tokens, private connection strings, or unnecessary personal data in the drill record.

## 8. Completion Criteria

A restore drill passes only when:

1. The selected backup is verified to the extent supported by the available evidence.
2. The backup imports into the isolated target without unresolved errors.
3. Required database objects and representative records are validated.
4. Relevant application checks pass where applicable.
5. Recovery measurements are recorded and compared with the agreed targets.
6. Issues are documented and assigned for remediation.
7. Test resources are cleaned up or securely retained under an approved procedure.
8. The results have been reviewed and recorded by the responsible owner.

If a required validation fails, mark the drill as **Failed** or **Pending remediation**. Do not classify a partial restore or an archive-integrity check alone as a successful recovery.

## 9. Maintenance

Review this procedure whenever:

- Backup or restore scripts change.
- The MySQL version or database configuration changes.
- Database schema or migration procedures change.
- Backup storage, encryption, or retention arrangements change.
- Recovery objectives change.
- Application dependencies affect the restoration process.
- A drill identifies an unresolved recovery weakness.

Update the related scripts and documentation together, and rerun the relevant checks after material changes.

## 10. Related Resources

- `infrastructure/backup/mysql-backup.sh`
- `infrastructure/backup/restore-mysql.sh`
- `docs/operations/backup-and-recovery.md`
- `docs/operations/incident-response.md`
- `docs/deployment/production.md`
- `docs/database/migrations.md`

Verify these paths against the actual repository and update references if the project structure differs.

—

**MedOrbits operational principle:** A backup is dependable only when recovery has been demonstrated, the recovered data has been validated, and the recovery results have been documented.
