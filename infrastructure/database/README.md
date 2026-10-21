
# MedOrbits — Database Operations

**Directory:** `infrastructure/database/`  
**Scope:** MySQL capacity planning, maintenance, schema changes, and operational safeguards

## 1. Purpose

This directory contains planning and maintenance guidance for the MedOrbits MySQL database. It documents capacity planning, routine maintenance, schema-change procedures, data integrity, security, and operational safeguards.

The guidance supports reliable database operations, informed capacity decisions, controlled changes, and recoverability throughout the database lifecycle.

This directory contains operational documentation. The presence of a procedure does not establish that monitoring, automation, backups, or other controls have been implemented or verified.

## 2. Documentation Index

| Document | Purpose |
|—|—|
| `capacity-planning.md` | Resource baselines, workload trends, growth estimates, capacity thresholds, performance analysis, and scaling considerations. |
| `maintenance.md` | Routine database maintenance, schema changes, data integrity, security, and operational safeguards. |

## 3. Operational Principles

- **Controlled schema changes:** Apply database schema changes through reviewed, version-controlled migrations.
- **Measurement before scaling:** Use query execution plans, workload metrics, and observed resource utilization to identify bottlenecks before increasing capacity.
- **Verified recovery:** Maintain appropriate backups and periodically verify that they can be restored successfully.
- **Least privilege:** Grant database accounts only the permissions required for their responsibilities.
- **Secure connections:** Use encrypted database connections where supported and correctly configured.
- **Data protection:** Do not use real personal data in development or test fixtures unless explicitly authorized and appropriately protected.
- **Change accountability:** Document significant database changes, validation results, recovery actions, and outstanding remediation.
- **Resource management:** Monitor storage, connections, query performance, and infrastructure limits against defined operational thresholds.
- **Application compatibility:** Coordinate schema changes with application deployments, background workers, and dependent services.
- **Implementation accuracy:** Distinguish documented recommendations from controls that have actually been configured and tested.

## 4. Maintenance Expectations

Review database capacity and maintenance requirements regularly and after significant application, schema, workload, or infrastructure changes.

Before high-risk operations:

1. Confirm the required approval and responsible operator.
2. Assess potential availability, performance, and data-integrity impacts.
3. Verify backup availability and the suitability of the recovery plan.
4. Define validation criteria, monitoring requirements, and abort conditions.
5. Confirm that the change has been tested in an appropriate non-production environment.

After maintenance:

1. Verify database integrity and relevant application functionality.
2. Review database and application errors, latency, and resource utilization.
3. Confirm that dependent jobs and services are operating as expected.
4. Document the outcome, recovery actions, and any outstanding issues.

Refer to the relevant maintenance and recovery procedures for detailed steps.

## 5. Related Documentation

The following paths are relative to the repository root.

| Document | Path | Purpose |
|—|—|—|
| Database Capacity Planning | `infrastructure/database/capacity-planning.md` | Resource utilization, workload growth, performance, and scaling. |
| Database Maintenance | `infrastructure/database/maintenance.md` | Routine maintenance, schema changes, data integrity, and security. |
| Database Backup and Recovery | `infrastructure/backup/README.md` | Backup configuration, restoration procedures, and recovery safeguards, if this index exists. |
| MySQL Restore Drill | `infrastructure/backup/restore-drill.md` | Procedure for testing restoration and validating recovered data. |
| MySQL Backup Script | `infrastructure/backup/mysql-backup.sh` | Creates compressed logical MySQL backups. |
| MySQL Restore Script | `infrastructure/backup/restore-mysql.sh` | Imports a compressed SQL backup into an explicitly specified, existing target database. |

**Path verification:** Confirm that each referenced file exists before relying on the links. If the backup directory does not contain a `README.md`, replace that entry with the actual backup and recovery documentation path.

## 6. Maintenance and Ownership

Update this index whenever operational documents are added, renamed, or removed.

Review the guidance when any of the following changes:

- MySQL server or client versions.
- Database schema or migration tooling.
- Hosting limits or database architecture.
- Backup, restoration, or retention procedures.
- Monitoring, alerting, or recovery objectives.
- Security controls or operational responsibilities.

Keep document links, environment assumptions, and procedures consistent with the current implementation.

—

**MedOrbits — Reliable Data, Secure Operations**
