
# MedOrbits Database Migrations

**Directory:** `/migrations/`  
**Purpose:** Manage version-controlled database schema changes and controlled data transformations.  
**Database:** MySQL 8.0.16+ is the established target; verify the actual database engine before execution.  
**Status:** Documentation and operational standards; implementation must be verified.

## 1. Overview

The `migrations` directory contains scripts that evolve the MedOrbits database schema and, where necessary, transform existing data.

Migrations provide a controlled history of database changes across development, testing, staging, and production environments.

Typical operations include:

- Creating and modifying tables.
- Adding, changing, and removing columns.
- Creating indexes and constraints.
- Establishing foreign-key relationships.
- Introducing lookup tables and reference data.
- Transforming existing records.
- Adding structures required by application features.
- Removing obsolete structures through reviewed migrations.

**Creating a migration file does not apply it to a database.** A configured migration runner or explicitly approved execution process must apply the change.

## 2. Existing Project Conventions

MedOrbits has an established numbered migration sequence under `/migrations/main/`.

| Setting | Established convention |
|—|—|
| Database engine | MySQL 8.0.16+ |
| Storage engine | InnoDB |
| Character set | `utf8mb4` |
| Collation | `utf8mb4_0900_ai_ci` |
| Timestamp convention | UTC, `DATETIME(3)` |
| Migration naming | Zero-padded numeric prefixes |
| Migration inventory | `/migrations/main/README.md` |

Previous development discussions have also referenced PostgreSQL. Verify the actual database driver, deployment configuration, and live database before authoring or executing migrations.

Do not execute PostgreSQL-specific SQL against the established MySQL migration sequence.

### Directory responsibilities

- `/migrations/README.md` — overall migration policy, workflow, safety, testing, and deployment guidance.
- `/migrations/main/` — the numbered MedOrbits SQL migration sequence.
- Migration-history storage — the authoritative record of migrations actually applied, managed by the existing framework or runner.

Do not introduce a competing migration framework or duplicate migration-history mechanism without an explicit architectural decision.

## 3. Directory Structure

The following illustrates the intended organization. Verify actual files before relying on this structure.

```text
migrations/
├── README.md
└── main/
    ├── README.md
    ├── 001_create_users.sql
    ├── 002_create_roles_permissions.sql
    ├── 003_create_courses.sql
    ├── 004_create_colleges_universities.sql
    ├── 005_create_applications.sql
    ├── 006_create_documents.sql
    ├── 007_create_employers_jobs.sql
    ├── 008_create_subscriptions_payments.sql
    ├── 009_create_notifications.sql
    ├── 010_create_audit_logs.sql
    ├── 011_create_application_review_history.sql
    ├── 012_create_application_notes.sql
    ├── 013_create_application_assignments.sql
    └── 014_create_application_checklists.sql
```

The filenames represent the intended sequence discussed in project documentation, not a verified repository listing. Confirm that each file exists and that its name matches the migration history.

If the project uses a framework-generated revision format, follow that framework instead of creating a competing sequence.

## 4. Migration Naming Convention

For the established numbered SQL migrations, use a unique, zero-padded numeric prefix and descriptive filename.

Examples of possible future migrations:

```text
015_add_application_external_reference.sql
016_add_job_search_index.sql
017_create_application_review_attachments.sql
```

These examples are illustrative. Inspect the repository and migration history before selecting the next number.

Requirements:

- Use unique migration identifiers.
- Preserve the established naming convention.
- Never reuse an identifier for a different change.
- Keep applied migrations immutable.
- Create a new migration to correct an already-applied change.
- Keep the migration inventory synchronized with actual files.
- Avoid duplicate migrations for structures already managed elsewhere.

## 5. Migration Design Principles

Every migration should be:

### Version-controlled

Commit migration scripts alongside the application changes that require them.

### Ordered

Execute migrations deterministically, respecting foreign-key dependencies and framework requirements.

### Reviewable

Document the purpose, affected objects, expected data changes, and operational impact.

### Safe to operate

Consider existing data, constraints, table size, locking, concurrent writes, and deployment timing.

### Environment-aware

Validate the target database and environment before execution.

### Observable

Record migration identifiers, start and completion times, duration, and failure details without exposing credentials or unnecessary personal information.

### Recoverable

Document how to recover from partial execution, failed constraints, and incompatible application releases.

## 6. Migration Workflow

Use this workflow for every database change:

1. Inspect the existing schema and migration history.
2. Confirm the database engine, version, and target environment.
3. Identify the required schema or data change.
4. Review application models, API contracts, fixtures, and validation schemas.
5. Create a migration using the established framework.
6. Review the migration source and operational impact.
7. Test against a disposable database or isolated development environment.
8. Verify existing records and relationships remain valid.
9. Test rollback or document an appropriate recovery procedure.
10. Run migration, integration, and application tests.
11. Apply the migration to staging.
12. Verify the resulting schema and application behavior.
13. Back up production data where appropriate and verify restoration procedures.
14. Apply the approved production migration through the designated deployment process.
15. Verify migration history, database integrity, and application health.

Do not edit a migration already applied to a shared or production database. Introduce a corrective migration instead.

## 7. Database Engine and SQL Compatibility

MySQL and PostgreSQL differ in SQL syntax, constraint behavior, transaction semantics, indexing, and DDL locking.

The established MedOrbits migration sequence targets MySQL 8.0.16 or later, using InnoDB, `utf8mb4`, and `utf8mb4_0900_ai_ci`.

Before writing a migration:

- Confirm the database driver and server version.
- Inspect the target schema and existing migrations.
- Use syntax supported by the selected engine.
- Verify JSON column and default-expression support.
- Review check constraints, regular expressions, and foreign-key behavior.
- Evaluate timestamp precision and default expressions.
- Assess DDL transaction behavior and locking.
- Test against the same database engine and a compatible version.

### Example: Adding an optional column

The following is an illustrative MySQL migration, not a confirmed required change.

```sql
— Migration: 015_add_application_external_reference.sql
— Purpose: Add an optional external application reference.
— Engine: MySQL 8.0.16+
— Dependency: applications table must already exist.
— Verify the existing schema before adapting this example.

ALTER TABLE applications
    ADD COLUMN external_reference VARCHAR(100) NULL
    COMMENT ‘Optional external application reference’;
```

Before using this example, confirm that migration `015` is available, the column does not already exist, and the application needs the field.

Do not blindly rerun this statement after partial execution. MySQL DDL may commit implicitly, so inspect the actual schema before recovery.

## 8. Connection Configuration and Security

Use the database driver and migration framework already configured by the project.

Illustrative environment-variable names:

```dotenv
DATABASE_URL=
MIGRATIONS_ENABLED=false
MIGRATIONS_ENV=development
```

These variables are examples. They are not supported application settings unless the application or migration runner explicitly implements them.

### Security requirements

- Never commit production credentials.
- Store secrets in the deployment platform’s secret store or an approved secrets manager.
- Use least-privilege database accounts.
- Restrict production migration permissions to authorized deployment processes.
- Validate the target host, database name, and environment before executing changes.
- Never print connection strings, passwords, or payment credentials in logs.
- Do not use production credentials in local development or automated tests.
- Separate application runtime privileges from migration privileges where practical.

Documentation examples do not enable or disable migration execution. The actual runner configuration determines its behavior.

## 9. Migration Tracking

Use one authoritative migration-tracking mechanism.

Depending on the framework, successful migrations may be recorded with:

- Migration identifier.
- Migration filename or revision.
- Checksum, where supported.
- Application timestamp.
- Execution duration.
- Framework-specific revision metadata.

Do not create a custom tracking table if the existing framework already provides reliable tracking.

A migration runner should:

1. Discover supported migration files.
2. Validate ordering and unique identifiers.
3. Compare available files with applied migration history.
4. Detect checksum changes to previously applied migrations.
5. Prevent concurrent runners from applying the same migration simultaneously.
6. Record successful execution accurately.
7. Stop and report actionable errors when execution fails.
8. Support investigation and recovery of partially applied changes.

**A migration file’s existence does not establish that its database change has been applied.**

Likewise, migration-history records do not prove that the live schema has not drifted.

## 10. Rollback and Recovery

Rollback is not always equivalent to restoring the original database state.

Before applying a migration, identify its recovery strategy.

### Reversible changes

Where practical, provide a documented downgrade or compensating operation.

Examples include removing a newly added index or reversing a column rename when the original data remains available.

### Destructive changes

Dropping columns, deleting records, or changing data types can cause irreversible data loss.

For destructive migrations:

1. Assess affected records and dependencies.
2. Verify a suitable backup exists.
3. Test restoration or recovery.
4. Confirm retention and approval requirements.
5. Schedule the change with an explicit recovery plan.
6. Verify the final database state.

A rollback script cannot necessarily recover deleted or transformed data. Restore from a verified backup or use a purpose-built recovery procedure where necessary.

### Partial execution

If a migration fails:

- Capture the exact database error.
- Identify which statements were applied.
- Inspect the actual schema and migration history.
- Determine whether the database engine committed any DDL implicitly.
- Reconcile the database with the intended migration state.
- Correct the migration or create a subsequent migration as appropriate.
- Retest recovery against a disposable database.

Do not automatically mark a failed migration as successful or rerun it blindly.

## 11. Zero-Downtime Deployment

When application releases must remain compatible with previously deployed code, prefer an expand-and-contract strategy.

### Expand

Add new columns, tables, or indexes without immediately removing old structures.

### Migrate

Deploy compatible application code and backfill or transform existing records in controlled batches.

### Verify

Confirm data integrity, application behavior, worker compatibility, and query performance.

### Contract

Remove obsolete structures only after all application instances, scheduled jobs, and background workers no longer depend on them.

For large tables, assess:

- Table locks and metadata locks.
- Index-creation behavior.
- Backfill batch sizes.
- Replication lag.
- Connection-pool exhaustion.
- Storage requirements and transaction-log growth.
- Compatibility between application versions.

The correct strategy depends on the database engine, hosting platform, table size, and traffic pattern.

## 12. Data Migration Rules

Data migrations should:

- Operate on explicitly identified records.
- Preserve identifiers and required relationships.
- Handle null values and legacy formats.
- Use transactions or checkpoints where appropriate.
- Be designed for safe resumption when required.
- Record counts of affected, skipped, and failed records.
- Avoid exposing private applicant or document information.
- Validate results before completion is recorded.
- Avoid silently dropping unknown fixture fields.
- Define how partially transformed records will be detected and reconciled.

For large transformations, prefer bounded batches, measurable progress, and documented retry behavior over a single unbounded operation.

## 13. Constraints and Indexes

Add database constraints that protect data integrity, including:

- Primary keys.
- Foreign keys.
- Unique constraints.
- Required-value constraints.
- Check constraints.
- Appropriate query indexes.

Before adding a constraint, inspect existing data for violations and determine how conflicting records should be handled.

JSON Schema validation does not replace database constraints. The database must protect critical invariants against concurrent requests, background workers, administrative tools, and other database writers.

Base indexes on actual query patterns and evaluate their impact on writes, storage, and deployment locking.

## 14. Testing Requirements

Test each migration against a representative database state.

- [ ] The target database engine and version are confirmed.
- [ ] The migration has a unique identifier.
- [ ] Dependencies and execution order are correct.
- [ ] The migration executes successfully on an isolated database.
- [ ] Existing records are preserved unless changes are intentional.
- [ ] Required columns, indexes, and constraints are present.
- [ ] Foreign-key relationships remain valid.
- [ ] Duplicate and null-value cases behave correctly.
- [ ] The application can read and write the migrated schema.
- [ ] Background workers remain compatible.
- [ ] Fixture mappings and references remain valid.
- [ ] Failure and partial-execution behavior have been reviewed.
- [ ] Rollback or recovery instructions are documented.
- [ ] Repeated deployment attempts do not corrupt migration state.
- [ ] Production restoration procedures have been verified where required.

Where feasible, test both a clean database and a realistic database containing existing records.

Do not describe a migration as tested unless it has actually been executed and the results verified.

## 15. CI/CD Integration

The deployment pipeline should:

1. Install the required database driver and migration dependencies.
2. Validate migration files and their ordering.
3. Run migration tests against an isolated database.
4. Run application and integration tests.
5. Deploy a compatible application version.
6. Apply approved migrations through the designated migration runner.
7. Verify migration status and application health.
8. Stop deployment and report actionable errors if a migration fails.

Do not run production migrations automatically from every application worker or every application startup unless the framework explicitly coordinates execution safely.

Prefer a controlled, single migration job or an equivalent framework-supported locking mechanism for production deployments.

## 16. Troubleshooting

| Issue | Recommended action |
|—|—|
| Migration already applied | Check migration history and actual schema before proceeding. |
| Missing table or column | Verify migration order, target database, and schema state. |
| Duplicate key or constraint failure | Identify conflicting records and resolve them before retrying. |
| Migration timeout | Inspect locks, query plans, transaction duration, and table size. |
| Database connection failure | Verify environment configuration, network access, and secret availability. |
| Migration failed partway | Inspect transaction behavior, applied statements, and tracking state. |
| Application fails after migration | Check schema compatibility, queries, indexes, and deployed application versions. |
| Checksum mismatch | Investigate whether an applied migration was modified; do not silently overwrite history. |
| Rollback fails | Follow the documented recovery plan instead of assuming a rerun is safe. |
| Schema differs from migration history | Investigate schema drift and reconcile it through an approved procedure. |

## 17. Change Review Checklist

Before merging a migration:

- [ ] The migration identifier is unique.
- [ ] The database engine and version are confirmed.
- [ ] The intended schema change is documented.
- [ ] Existing data and dependencies have been considered.
- [ ] Locking and performance implications have been assessed.
- [ ] Security and access-control implications have been reviewed.
- [ ] Success and failure cases have been tested.
- [ ] Rollback or recovery is documented.
- [ ] Deployment ordering is compatible with application releases.
- [ ] No credentials or unnecessary personal data are included.
- [ ] The migration follows the project’s tracking framework.
- [ ] The relevant migration inventory has been updated.

## 18. Maintenance Policy

- Treat applied migrations as immutable.
- Keep migration scripts in version control.
- Use one migration framework and one authoritative history.
- Review destructive operations carefully.
- Verify backups and recovery procedures regularly.
- Remove obsolete schema only through reviewed migrations.
- Document engine-specific limitations.
- Keep migration inventories aligned with actual files.
- Verify the live database rather than inferring its state from source code.
- Keep this README consistent with the repository and deployment process.

—

**Project:** MedOrbits  
**Directory:** `/migrations/`  
**Scope:** Database schema evolution and controlled data transformation  
**Established SQL sequence:** `/migrations/main/`  
**Primary requirement:** Reproducible, reviewable, and recoverable database changes

**Implementation status:** Documentation only. Repository contents, migration-runner capabilities, execution history, and live database state must be verified separately.
