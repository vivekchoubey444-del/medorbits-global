
# MedOrbits Database Migrations

**Project:** MedOrbits  
**Recommended location:** `docs/database-migrations.md`  
**Scope:** Migration creation, review, testing, deployment, tracking, rollback, and recovery  
**Status:** Engineering standard — verify the actual database engine, migration runner, and deployment process before treating these controls as implemented.

## 1. Purpose

This document defines the standards for managing database schema and data changes safely throughout the MedOrbits application lifecycle.

Migrations must preserve data integrity, support application compatibility, provide traceable execution history, and define recovery procedures appropriate to the risks of each change.

The intended database is MySQL, subject to verification against the actual connection configuration, database driver, server version, and deployed schema.

**Core rule:** A migration file is not proof that a migration has been executed successfully. The migration runner’s recorded state and the actual database schema must agree.

## 2. Migration Requirements

Every migration must meet the following requirements:

- **Version control:** Store migration files in the repository and review them alongside related application changes.
- **Deterministic ordering:** Apply migrations in a predictable sequence.
- **Unique identifiers:** Assign each migration a unique identifier supported by the adopted migration runner.
- **SQL review:** Inspect schema changes, indexes, constraints, data transformations, and destructive operations.
- **Testing:** Test the migration sequence against an empty database and a representative, appropriately protected staging environment.
- **Compatibility:** Preserve compatibility with overlapping application versions where rolling deployments or rollback windows require it.
- **Status tracking:** Record applied migrations, execution outcomes, timestamps, and checksums where supported.
- **Failure visibility:** Stop dependent deployment steps when a migration fails and report the failing migration identifier.
- **Concurrency control:** Prevent multiple deployment processes from applying the same migration concurrently.
- **Auditability:** Preserve migration history, review decisions, and execution records according to operational requirements.
- **Least privilege:** Use dedicated migration credentials with only the permissions required for approved schema and data changes.
- **Reproducibility:** Avoid undocumented manual database changes that cause environments to diverge.

The migration mechanism must be identified and verified before these requirements are considered implemented.

## 3. Directory Structure and Naming

A possible layout is:

```text
database/
├── migrations/
│   ├── 20261015090000_create_users_table.sql
│   ├── 20261015100000_add_email_verification.sql
│   └── 20261015110000_add_application_status_index.sql
├── schema/
├── seeds/
└── fixtures/
```

This is a reference structure, not a claim that these files exist. Follow the migration runner and directory conventions already adopted by MedOrbits.

### 3.1 Naming convention

If supported by the chosen runner, use:

`YYYYMMDDHHMMSS_short_description.sql`

Each migration should:

1. Have a unique, ordered identifier.
2. Perform one logically coherent change.
3. Include comments for non-obvious or high-risk operations.
4. Document assumptions and verification steps.
5. Avoid relying on undocumented manual database changes.
6. Be committed and reviewed before deployment.

### 3.2 Applied migrations

Never edit an already-applied production migration to rewrite its historical meaning.

Create a new migration to correct or extend an earlier change, unless a formally controlled procedure explicitly authorizes another approach.

If a migration is incorrect, determine whether a forward repair or a tested reversal is safer before making changes.

## 4. Safe Schema Evolution

Prefer an expand-and-contract approach when a change spans releases or must support multiple running application versions.

### Phase 1 — Expand

Add compatible schema elements without immediately removing the existing structure.

Examples:

- Add a nullable column.
- Create a new table.
- Add a compatible index.
- Introduce a new field while preserving the old field.

Evaluate locking, disk usage, index-building behavior, and database-version support before execution.

### Phase 2 — Deploy Compatible Code

Deploy application code that safely supports both the old and new schema during the transition.

Confirm compatibility with application instances, background workers, scheduled tasks, and other consumers that may still use the old structure.

### Phase 3 — Backfill Data

Transform existing data in controlled batches where appropriate.

- Define batch size and execution limits.
- Make the operation safe to retry.
- Track progress and failures.
- Monitor database load and replication lag where relevant.
- Validate the transformed data.
- Avoid unnecessarily long transactions on large tables.

For large tables, assess whether online schema changes or a dedicated backfill process is required.

### Phase 4 — Verify

Verify data integrity, application behavior, query performance, and operational metrics.

Confirm that no active application version or dependent job still relies on the old structure.

### Phase 5 — Contract

Remove obsolete columns, tables, indexes, or compatibility logic in a later, separately reviewed change.

Before removal, confirm that the old structure is no longer used and that the recovery plan accounts for irreversible changes.

## 5. Pre-Migration Review

Before approving a migration, review:

- [ ] Migration identifier and ordering.
- [ ] SQL statements and expected resulting schema.
- [ ] Data transformations and expected data volume.
- [ ] Table sizes, indexes, constraints, and foreign keys.
- [ ] Locking behavior and estimated execution time.
- [ ] Disk capacity and database resource requirements.
- [ ] Compatibility with active application and worker versions.
- [ ] Transactional behavior and implicit-commit limitations.
- [ ] Failure conditions and potential partial states.
- [ ] Backup requirements and recovery objectives.
- [ ] Rollback or forward-repair strategy.
- [ ] Required approvals for high-risk operations.
- [ ] Post-migration verification queries or tests.

Database-specific behavior must be reviewed against the actual MySQL version and storage engine. Do not assume that all DDL statements are transactionally reversible.

## 6. Testing Requirements

### 6.1 Empty database

Test the complete migration sequence against a newly created database using the supported database engine and version.

Verify that:

- All migrations run in the intended order.
- The resulting schema matches the expected structure.
- Indexes, constraints, and foreign keys exist as intended.
- Required seed data follows the project’s seed policy.
- The application starts and performs essential database operations.
- The migration runner records the correct final state.

### 6.2 Representative staging database

Test against a staging environment representative of production schema, data volume, and application compatibility requirements.

Verify that:

- Existing data remains valid.
- Backfills produce expected results.
- Execution time and locking remain acceptable.
- Application versions remain compatible during deployment.
- Failure handling and recovery procedures work.
- Important queries and business workflows continue to function.

Protect staging data using appropriate access controls and privacy safeguards. Do not copy production data without an approved data-handling process.

### 6.3 Automated checks

Where supported, integrate migration checks into CI/CD.

Recommended checks include:

- Migration naming and ordering.
- Duplicate identifiers.
- SQL linting or schema validation, where appropriate.
- Execution against a disposable database.
- Migration-state consistency.
- Application compatibility tests.
- Data-integrity checks.
- Relevant integration tests.

A successful test run establishes evidence for the scenarios tested; it does not guarantee identical performance or locking behavior in production.

## 7. Migration Tracking and Execution

The migration runner should maintain a reliable record of migration execution.

Where supported, track:

| Field | Purpose |
|—|—|
| Migration identifier | Uniquely identifies the migration |
| Checksum | Detects changes to an existing migration |
| Execution status | Records success or failure |
| Start timestamp | Records when execution began |
| Completion timestamp | Records when execution finished |
| Execution context | Identifies the release or approved deployment |
| Error details | Supports diagnosis without exposing secrets |

### 7.1 Execution requirements

- Acquire an appropriate migration lock before executing pending migrations.
- Check the recorded migration state before applying changes.
- Execute migrations in deterministic order.
- Stop dependent deployment steps on failure.
- Report the failing migration identifier and safe diagnostic information.
- Record completion only after the migration’s required operations have succeeded.
- Detect unexpected changes to previously applied migration files.
- Ensure concurrent deployment processes cannot apply the same migration simultaneously.

The locking mechanism must be appropriate to the actual database and migration runner. A process-local mutex is insufficient when multiple deployment processes can run on different machines.

### 7.2 Failure handling

A failed migration may leave the database partially changed, especially when the database engine implicitly commits DDL operations.

The runner must not assume that failure means the schema is unchanged. Before retrying, inspect the actual database state and follow the migration’s recovery procedure.

Never silently continue to later migrations when a failed migration leaves dependent schema changes incomplete.

## 8. Production Deployment Safeguards

Before executing a high-risk production migration:

1. Obtain the required review and approval.
2. Confirm the target environment and database identity.
3. Verify backup availability and the applicable recovery procedure.
4. Confirm that the backup can be restored or that the documented recovery method has been tested.
5. Assess locking, runtime, disk space, and expected workload.
6. Verify compatibility with active application and worker versions.
7. Define monitoring, stop conditions, and an acceptable execution window.
8. Identify the responsible operator.
9. Prepare rollback or forward-repair instructions.
10. Record the execution outcome and post-migration verification results.

Prefer an approved deployment pipeline with controlled credentials and recorded execution.

Never run production migrations from an unreviewed local environment or against an ambiguously identified database.

## 9. Rollback and Recovery

A migration is not automatically reversible merely because a corresponding `down` script can be written.

Rollback may be unsafe when a migration:

- Deletes or overwrites data.
- Changes data formats or meanings.
- Removes fields used by active application versions.
- Performs irreversible transformations.
- Triggers external side effects.
- Uses database operations that cannot be atomically reversed.

For each high-risk migration, document:

- Failure conditions.
- Whether a tested down migration exists.
- Whether a forward repair is safer.
- Data recovery requirements.
- Backup restoration implications.
- Application-version compatibility.
- Post-recovery verification steps.

**Application rollback and database recovery are separate procedures.** Reverting application code does not automatically restore a previous database schema or recover deleted data.

Prefer a forward-fix migration when reversal would cause data loss or further inconsistency.

## 10. Destructive Changes

Destructive operations include dropping tables or columns, truncating data, removing constraints, and performing irreversible transformations.

Such operations require:

- Explicit impact assessment.
- Confirmation that affected data is no longer required.
- Review and approval by the appropriate owner.
- A verified backup or approved alternative recovery strategy.
- A documented execution and recovery plan.
- Post-migration integrity checks.
- Confirmation that active application versions no longer depend on the removed structure.

Do not include a destructive operation merely to make a migration pass without understanding its effect on existing data and running application versions.

## 11. Data Migrations and Seed Data

Keep schema migrations, production data transformations, development seeds, and test fixtures logically distinct.

Requirements:

- Make data transformations deterministic and safe to retry where possible.
- Validate row counts and important invariants before and after transformations.
- Avoid embedding private user data in seed files.
- Keep development seed data separate from production initialization.
- Avoid destructive seed operations against shared or production databases.
- Document whether a migration is safe to run on a partially populated database.
- Define how long-running backfills are monitored, resumed, and verified.

For large data transformations, consider a resumable application-level job rather than a single long-running migration transaction.

## 12. Operational Responsibilities

Adapt these responsibilities to the actual MedOrbits team and deployment process.

| Role | Responsibility |
|—|—|
| Developer | Creates the migration, assesses impact, and provides tests |
| Reviewer | Reviews correctness, compatibility, performance, and recovery |
| Release operator | Executes or authorizes the approved deployment |
| Database/platform owner | Reviews high-risk changes and recovery readiness where applicable |

Migration credentials should be restricted to approved operators or deployment services. Application runtime credentials should not receive broad schema-modification privileges unless the deployment architecture explicitly requires and justifies them.

## 13. Related Documentation

Maintain links to verified project resources where available:

- Database schema and entity documentation.
- Migration directory and runner instructions.
- Database configuration guide.
- Backup and restoration procedures.
- Deployment and release procedures.
- Incident response and recovery documentation.
- Relevant integration and migration tests.

Use canonical documentation paths from the repository. Do not link to planned files as if they already exist.

## 14. Definition of Done

A migration is ready for production only when:

- [ ] The migration is committed and uniquely identified.
- [ ] SQL and operational risks have been reviewed.
- [ ] Empty-database migration tests pass.
- [ ] Representative staging tests pass.
- [ ] Application-version compatibility has been assessed.
- [ ] Migration tracking and concurrency controls have been verified.
- [ ] Failure behavior and partial-state recovery are documented.
- [ ] Required approvals have been obtained.
- [ ] Backup and recovery arrangements are appropriate to the risk.
- [ ] Deployment and post-migration verification steps are documented.
- [ ] Relevant automated checks pass.

**Final rule:** Treat database migrations as controlled production changes. Preserve data integrity, make failures observable, and maintain a recovery strategy appropriate to the consequences of each change.
