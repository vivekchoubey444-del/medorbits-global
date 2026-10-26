
# MedOrbits — Database Backup and Recovery

**Directory:** `infrastructure/backup/`  
**Scope:** MySQL logical backups, database restoration, and recovery verification  
**Status:** Operational documentation — validate against the deployed environment before production use

## 1. Purpose

This directory contains scripts and procedures for creating compressed MySQL logical backups, restoring backups into an explicitly specified target database, and periodically verifying recoverability.

A successful backup operation does not guarantee that the database can be restored successfully. Recovery must be tested, restored data must be validated, and recovery results must be documented.

## 2. Directory Contents

| File | Responsibility |
|—|—|
| `mysql-backup.sh` | Creates a compressed logical MySQL backup. |
| `restore-mysql.sh` | Imports a compressed SQL backup into a specified, existing target database. |
| `restore-drill.md` | Documents the procedure for testing restoration and recovery. |

Confirm that these files exist at the listed paths and that the documented behavior matches their current implementations.

## 3. Requirements

The backup and restore scripts require:

- Bash with support for the script features used.
- `mysqldump` for logical database exports.
- `mysql` for database imports.
- `gzip` for compression and archive-integrity checks.
- Access to the configured MySQL server.
- A backup destination with sufficient free space and appropriate access controls.
- A MySQL account with the privileges required for the requested operation.
- Compatible MySQL client utilities and a supported database server version.

The backup script also uses standard Linux utilities for file management, timestamps, permission checks, and retention cleanup.

Verify utility compatibility and behavior against the actual deployment environment before relying on these scripts in production.

## 4. Configuration

### 4.1 Environment variables

| Variable | Purpose | Default or requirement |
|—|—|—|
| `MYSQL_HOST` | MySQL server hostname or address. | Required |
| `MYSQL_PORT` | MySQL server port. | `3306` |
| `MYSQL_USER` | MySQL account used for the operation. | Required |
| `MYSQL_DATABASE` | Database to back up. | Required by the backup script |
| `BACKUP_DIR` | Destination directory for backup archives. | `./backups` in the supplied backup script |
| `RETENTION_DAYS` | Retention period for backup archives. | `14` in the supplied backup script |
| `MYSQL_CNF` | Path to a protected MySQL client option file. | Optional; supported by the supplied scripts when configured |

The restore script accepts two positional arguments:

1. Path to the compressed backup archive.
2. Explicit name of the existing target database.

Example:

```bash
./infrastructure/backup/restore-mysql.sh \
  /secure/backups/medorbits_20261021T010000Z.sql.gz \
  medorbits_restore_test
```

The example archive path and database name are illustrative. Replace them with verified values from the environment.

The target database must exist before restoration. The restore script must not be assumed to create the database automatically.

### 4.2 Credentials

Supply database credentials through a protected MySQL option file or an approved secret-management mechanism.

- Never hardcode passwords in scripts.
- Never commit credentials, private keys, or production secrets to source control.
- Restrict access to option files and secret configuration.
- Prefer managed secret injection or a protected option file over `MYSQL_PWD`.
- Avoid passing passwords as command-line arguments.
- Rotate credentials if they are exposed or committed accidentally.
- Use dedicated accounts with the minimum permissions required for each operation.

If using `MYSQL_CNF`, configure it through the deployment environment and verify that the scripts recognize it. Protect the option file with restrictive permissions, typically `600`, and confirm compatibility with the installed MySQL client.

The restore script’s authentication behavior must be tested in the actual execution environment. Do not assume a noninteractive restore will authenticate successfully without configured credentials.

## 5. Backup Procedure

1. Configure the required MySQL connection variables and credentials.
2. Select an approved backup destination.
3. Confirm that the destination has sufficient free space and restricted access.
4. Run the backup script:

   ```bash
   ./infrastructure/backup/mysql-backup.sh
   ```

5. Confirm that the script exits successfully and produces the expected archive.
6. Verify the archive’s compressed-file integrity.
7. Record relevant metadata, including the database, backup timestamp, archive size, and outcome.
8. Copy the archive to protected off-host storage when required by the recovery policy.
9. Confirm that the off-host copy is complete and accessible.

The supplied backup script uses `mysqldump` and `gzip`. A successful compression-integrity check confirms that the gzip archive can be read; it does not prove that the SQL dump is complete, valid, or restorable.

Do not report a backup as successfully recoverable until a restore test and data-validation procedure have passed.

## 6. Restore Procedure

1. Select the intended backup.
2. Verify the archive’s integrity, provenance, and expected database contents.
3. Prepare an isolated, compatible MySQL environment.
4. Create or verify a disposable target database.
5. Configure connection settings and credentials.
6. Run the restore script with the backup path and explicit target database name.
7. Read the warning and enter the exact target database name when prompted.
8. Inspect the import result and any errors.
9. Validate the restored schema, database objects, representative records, and important relationships.
10. Run application-level checks using a safe test configuration.
11. Record the results, recovery duration, and any issues.
12. Clean up the test environment securely.

Example:

```bash
./infrastructure/backup/restore-mysql.sh \
  /secure/backups/medorbits_20261021T010000Z.sql.gz \
  medorbits_restore_test
```

**Safety requirement:** Never run a routine restore drill against production. A failed import can leave the target database partially modified. The restore script’s confirmation prompt does not prove that the dump is safe, and it does not guarantee transactional rollback of the import.

Treat backup files as executable database input. Use trusted archives and an appropriately isolated recovery environment.

## 7. Production Requirements

Production backup and recovery operations should include the following controls:

- **Least privilege:** Use dedicated database accounts with only the permissions necessary for the relevant operation.
- **Access control:** Restrict access to backup directories, archives, option files, and credentials.
- **Encryption:** Protect backup archives in transit and at rest.
- **Off-host copies:** Keep recovery copies separate from the primary database environment.
- **Retention:** Define and enforce an approved retention period.
- **Monitoring:** Alert on failed, incomplete, or missing scheduled backups.
- **Recovery testing:** Periodically restore backups and validate the recovered data.
- **Capacity management:** Monitor disk space, backup growth, and storage limits.
- **Auditability:** Record backup outcomes, recovery attempts, and relevant operational actions without exposing secrets.
- **Resilience:** Where required by the threat model, protect recovery copies against unauthorized deletion or modification.
- **Ownership:** Assign responsibility for backup monitoring, restore drills, and remediation.

These are production requirements, not claims that the controls are already configured. Mark each control as implemented only after verifying its operation.

## 8. Consistency and Database Considerations

The supplied backup script uses `mysqldump —single-transaction`, which is intended to provide a consistent snapshot for transactional tables such as InnoDB, subject to the database’s operational conditions.

This option does not guarantee a consistent snapshot for nontransactional tables. Concurrent schema changes during a dump may also affect consistency or cause failures.

Before relying on this approach in production:

- Confirm the storage engines used by the database.
- Review the impact of concurrent writes and schema changes.
- Evaluate whether routines, events, triggers, views, and other required database objects are included.
- Confirm that the chosen MySQL client version supports the options used.
- Evaluate the database’s size, workload, and recovery objectives.
- Consider whether logical backups alone are sufficient for the required recovery point and recovery time.

The backup method must match the actual schema, database engine, workload, and recovery objectives.

## 9. Recovery Validation

Use `restore-drill.md` as the procedure for testing recovery.

A recovery drill should verify:

- The backup archive can be read and imported.
- Expected tables, views, indexes, and other required database objects are present.
- Representative records and important relationships are valid.
- Character encoding, timestamps, and relevant constraints are preserved.
- Stored routines, triggers, and events are present when required.
- Application-level reads and safe test workflows behave as expected.
- No unexpected connection to production services or external payment systems occurs during testing.
- The recovery duration and any data gaps are recorded.
- Any failures are assigned remediation actions and tracked to completion.

Define the following objectives with the relevant business and technical owners:

- **Recovery Point Objective (RPO):** The maximum acceptable amount of data loss, expressed as a time interval.
- **Recovery Time Objective (RTO):** The target maximum time required to restore the service to an agreed operational state.

A successful import alone is not sufficient evidence that the application has been recovered.

## 10. Maintenance Checklist

- [ ] Backup and restore scripts are maintained in source control.
- [ ] Database credentials are supplied securely.
- [ ] Backup destination permissions are restricted.
- [ ] Available storage and retention behavior are monitored.
- [ ] Backup archives are encrypted and copied off-host where required.
- [ ] Scheduled backup execution is configured and verified, where applicable.
- [ ] Backup failures and missing backups generate appropriate alerts.
- [ ] Restore drills are performed at the required frequency.
- [ ] Restored data and application behavior are validated.
- [ ] Recovery results and remediation actions are documented.
- [ ] Recovery objectives are reviewed with the responsible stakeholders.
- [ ] Scripts are reviewed after database, dependency, or infrastructure changes.
- [ ] Backup and restore procedures are reviewed after relevant security incidents.

## 11. Troubleshooting and Failure Handling

### Backup failure

1. Review the script’s exit status and error output.
2. Check database connectivity and account permissions.
3. Confirm that sufficient disk space is available.
4. Inspect the configured backup destination and file permissions.
5. Verify that the MySQL client utilities are installed and compatible.
6. Resolve the underlying cause before relying on a new backup.

### Restore failure

1. Stop treating the target as a successfully restored database.
2. Review the error output and determine whether the import partially modified the database.
3. Preserve relevant logs without exposing credentials or sensitive records.
4. Re-create a clean disposable target when appropriate and authorized.
5. Retry only after validating the backup and correcting the underlying problem.
6. Complete schema, data, and application checks before marking the recovery drill successful.

Do not automatically retry a failed restore against the same target without assessing the database’s current state.

## 12. Maintenance Policy

Update this documentation whenever any of the following changes:

- Backup or restore scripts.
- MySQL server or client versions.
- Database schema or storage engines.
- Credential-handling procedures.
- Backup destinations or storage providers.
- Encryption, access-control, or retention policies.
- Scheduling, monitoring, or alerting.
- Recovery procedures, RPO, or RTO.

Document only verified capabilities. Do not describe backups as encrypted, off-site, monitored, automatically scheduled, or recoverable unless the corresponding controls have actually been configured and tested.

## 13. Related Files

- `infrastructure/backup/mysql-backup.sh`
- `infrastructure/backup/restore-mysql.sh`
- `infrastructure/backup/restore-drill.md`
- `docs/operations/backup-and-recovery.md`
- `docs/operations/incident-response.md`
- `docs/database/migrations.md`

Confirm that these paths exist in the repository before treating them as active documentation references.

—

**MedOrbits — Reliable Data, Verified Recovery**
