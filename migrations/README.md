
# MedOrbits Database Migrations

**Directory:** `/migrations/`  
**Purpose:** Manage version-controlled, repeatable database schema and data changes.  
**Status:** Project documentation and migration conventions.

## 1. Overview

The `migrations` directory contains scripts that evolve the MedOrbits database schema and, where necessary, transform existing data.

Migrations provide a controlled history of database changes across development, testing, staging, and production environments.

Typical migration operations include:

- Creating and modifying tables.
- Adding, changing, or removing columns.
- Creating indexes and constraints.
- Establishing foreign-key relationships.
- Introducing lookup tables and reference data.
- Transforming existing records.
- Adding database structures required by new application features.
- Removing obsolete structures through reviewed migrations.

**Important:** A migration changes a database only when executed by a configured migration runner. Creating a migration file does not automatically apply it.

## 2. Recommended Directory Structure

Adapt this structure to the migration framework already used by the project.

```text
migrations/
├── README.md
├── 001_initial_schema.sql
├── 002_create_users_table.sql
├── 003_create_applications_table.sql
├── 004_create_application_files_table.sql
├── 005_create_access_requests_table.sql
├── 006_create_audit_logs_table.sql
└── ...
```

The filenames above are illustrative. Do not create duplicate migrations if equivalent changes already exist in the repository or database.

If the project uses Alembic, Knex, Prisma, Sequelize, Flyway, or another migration framework, follow that framework’s required directory structure and naming conventions.

## 3. Migration Naming Convention

For SQL-based migrations, use a monotonically increasing version or timestamp followed by a descriptive name.

Examples:

```text
001_initial_schema.sql
002_create_users_table.sql
003_add_application_status.sql
004_add_application_search_index.sql
20261025143000_create_notification_preferences.sql
```

Naming requirements:

- Use unique migration identifiers.
- Keep names descriptive and concise.
- Never reuse an identifier for a different change.
- Preserve the established naming convention.
- Keep applied migrations immutable.
- Create a new migration to correct a previously applied change.

If migrations are tracked by a framework-generated revision identifier, use that framework’s identifier rather than inventing a competing version sequence.

## 4. Migration Design Principles

Every migration should be:

### Version-controlled

Commit migration scripts alongside the application changes that require them.

### Ordered

Migrations must execute in a deterministic order. Record successful execution in the migration tracking mechanism.

### Reviewable

Include a clear description of the intended change and its operational impact.

### Safe to operate

Account for existing data, constraints, table size, locking, and deployment timing.

### Environment-aware

Use the correct database connection for each environment. Never allow a production migration to run against an unintended database.

### Observable

Record migration start, completion, failure, duration, and the migration identifier without exposing credentials or personal information.

## 5. Migration Workflow

Use the following workflow for each database change.

1. Inspect the current database schema and existing migration history.
2. Confirm the required schema change and its compatibility with the application.
3. Create a new migration using the project’s established framework.
4. Review the SQL or migration operations.
5. Test against a disposable database or isolated development environment.
6. Verify existing data remains valid.
7. Test rollback or a documented recovery procedure where applicable.
8. Run automated migration and application tests.
9. Apply the migration to staging.
10. Back up production data where appropriate and verify recovery procedures.
11. Apply the approved production migration.
12. Verify application health, database constraints, and expected records.

Do not edit a migration that has already been applied to a shared or production database. Create a corrective migration instead.

## 6. SQL Migration Template

For projects using PostgreSQL, a migration may resemble the following example.

```sql
— Migration: add_application_reference
— Purpose: Add an optional external reference to applications.
— Review the existing schema before adapting this example.

BEGIN;

ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS external_reference VARCHAR(100);

COMMIT;
```

This example assumes the `applications` table exists and that the chosen SQL is appropriate for the project’s PostgreSQL version and migration conventions.

Do not copy this example blindly into another database engine. SQL syntax, locking behavior, transactional DDL, and supported features vary between database systems.

For migration frameworks that manage transactions automatically, follow their transaction conventions rather than adding manual transaction statements unnecessarily.

## 7. Database Engine and Connection Configuration

The project has referenced both PostgreSQL and MySQL in development discussions. Confirm which engine the deployed application actually uses before writing or applying migrations.

Use the database driver and migration framework configured by the project.

Recommended environment variables may include:

```dotenv
DATABASE_URL=
MIGRATIONS_ENABLED=false
MIGRATIONS_ENV=development
```

These names are examples. The application must explicitly support them.

### Security requirements

- Never commit production credentials.
- Keep secrets in the deployment platform’s secret store or an approved secrets manager.
- Use least-privilege database accounts.
- Restrict production migration permissions to authorized deployment processes.
- Validate the target database and environment before executing changes.
- Do not print connection strings or credentials in logs.
- Do not use production credentials in local development or automated tests.

## 8. Migration Tracking

Use one authoritative migration-tracking mechanism.

Depending on the chosen framework, successful migrations may be recorded in a dedicated table containing fields such as:

- Migration identifier.
- Migration name.
- Application timestamp.
- Execution duration.
- Execution status, if supported.
- Framework-specific revision information.

Do not create a custom tracking table if the existing framework already provides reliable migration tracking.

A migration runner should detect previously applied migrations and avoid applying them again.

**Do not rely solely on a file’s existence to determine whether its database change has been applied.**

## 9. Rollback and Recovery

Rollback is not always equivalent to restoring the original database state.

Before applying a migration, identify the appropriate recovery strategy.

### Reversible migrations

Where practical, document or implement a corresponding downgrade operation.

Examples include removing a newly added index or restoring a renamed column when the original data remains available.

### Destructive migrations

Dropping columns, deleting records, and changing data types can cause irreversible data loss.

For destructive changes:

1. Assess the affected records and dependencies.
2. Create and verify an appropriate backup.
3. Test the recovery procedure.
4. Confirm the required retention and approval policies.
5. Schedule the change with an explicit recovery plan.
6. Verify the resulting database state.

A rollback script may not recover deleted or transformed data. Restore from a verified backup or use an explicitly designed recovery procedure when necessary.

## 10. Zero-Downtime and Production Deployments

For application changes that must remain compatible with currently deployed code, prefer an expand-and-contract migration strategy.

### Expand

Add the new schema elements without immediately removing the old ones.

### Migrate

Deploy compatible application code and backfill or transform existing records in controlled batches.

### Verify

Confirm data integrity, application behavior, and query performance.

### Contract

Remove obsolete schema elements only after all application versions and background workers no longer depend on them.

For large tables, evaluate:

- Table locks and long-running transactions.
- Index creation behavior.
- Backfill batch sizes.
- Replication lag.
- Connection-pool exhaustion.
- Database storage and transaction-log growth.

The precise procedure depends on the database engine and hosting environment.

## 11. Data Migration Rules

Data migrations should:

- Operate on explicitly identified records.
- Preserve identifiers and required relationships.
- Handle null values and legacy formats.
- Use transactions or checkpoints where appropriate.
- Be safe to resume when the operation is designed for resumability.
- Record counts of affected, skipped, and failed records.
- Avoid exposing private applicant or document information.
- Validate the result before marking the migration complete.

For large data transformations, prefer bounded batches and observable progress over a single unbounded operation.

## 12. Constraints and Indexes

Add database constraints that protect data integrity, including:

- Primary keys.
- Foreign keys.
- Unique constraints.
- Required-value constraints.
- Check constraints.
- Appropriate indexes for frequent queries.

Before introducing a constraint, inspect existing records for violations.

Do not assume that JSON Schema validation replaces database constraints. The database must still protect critical invariants against concurrent requests, background workers, administrative tools, and other writers.

## 13. Testing Requirements

Every migration should be tested against a representative database state.

Recommended checks:

- [ ] The migration runs successfully on the expected database engine.
- [ ] Existing records are preserved unless changes are intentional.
- [ ] Required indexes and constraints are present.
- [ ] Foreign-key relationships remain valid.
- [ ] Duplicate and null-value cases are handled correctly.
- [ ] The application can read and write the migrated schema.
- [ ] Background workers remain compatible.
- [ ] Rollback or recovery instructions have been reviewed.
- [ ] Repeated deployment attempts do not corrupt migration state.
- [ ] Tests use isolated databases and do not modify production data.

Where feasible, test both a clean database and a realistic database containing existing records.

## 14. CI/CD Integration

The deployment pipeline should:

1. Install the required database driver and migration dependencies.
2. Validate migration files and their ordering.
3. Run migration tests against an isolated database.
4. Run application and integration tests.
5. Deploy the compatible application version.
6. Apply approved migrations using the designated migration runner.
7. Verify migration status and application health.
8. Stop deployment and report actionable errors if a migration fails.

Do not run production migrations automatically from every application worker or every application startup. Multiple instances can race to apply the same migration unless the framework and deployment process explicitly coordinate execution.

Production migrations should use a controlled, single migration job or an equivalent framework-supported locking mechanism.

## 15. Troubleshooting

| Issue | Recommended action |
|—|—|
| Migration already applied | Check the framework’s migration history and database schema before proceeding. |
| Missing table or column | Verify migration ordering, target database, and existing schema. |
| Duplicate key or constraint failure | Identify conflicting records and correct the data before retrying. |
| Migration timeout | Inspect locks, query plans, transaction duration, and table size. |
| Database connection failure | Verify the selected environment, network access, and secret configuration. |
| Migration failed partway | Inspect transaction behavior and tracking state before retrying or recovering. |
| Application fails after migration | Check schema compatibility, queries, indexes, and deployed application versions. |
| Rollback fails | Follow the documented recovery plan; do not assume that rerunning the migration is safe. |

## 16. Change Review Checklist

Before merging a migration:

- [ ] The migration has a unique identifier.
- [ ] The target database engine is confirmed.
- [ ] The schema change is documented.
- [ ] Existing data and dependencies have been considered.
- [ ] Locking and performance implications have been assessed.
- [ ] Security and access-control implications have been reviewed.
- [ ] Tests cover the expected success and failure cases.
- [ ] Rollback or recovery is documented.
- [ ] Deployment ordering is compatible with application releases.
- [ ] No secrets or personal data are included in the migration.
- [ ] The migration is compatible with the project’s tracking framework.

## 17. Maintenance Policy

- Treat applied migrations as immutable.
- Keep migration scripts in version control.
- Use one migration framework and one authoritative history.
- Review destructive operations carefully.
- Verify backups and recovery procedures regularly.
- Remove obsolete schema only through reviewed migrations.
- Document engine-specific limitations.
- Keep this README aligned with the actual repository and deployment workflow.

—

**Project:** MedOrbits  
**Directory:** `/migrations/`  
**Scope:** Database schema evolution and controlled data transformation  
**Primary requirement:** Reproducible, reviewable, and recoverable database changes
