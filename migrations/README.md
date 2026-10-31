
# MedOrbits Database Migrations

Versioned SQL migrations for the MedOrbits platform.

| Setting | Standard |
|—|—|
| Project | MedOrbits |
| Directory | `/migrations/main/` |
| Database engine | MySQL 8.0.16+ |
| Storage engine | InnoDB |
| Character set | `utf8mb4` |
| Collation | `utf8mb4_0900_ai_ci` |
| Timestamp convention | UTC, `DATETIME(3)` |
| Primary identifier convention | Application-generated UUIDs where defined |

> **Important:** This README describes the intended migration inventory and operating standards. It does not confirm that every file exists, has been executed, or has passed testing.

## 1. Purpose

This directory contains versioned SQL migrations for creating and evolving the MedOrbits database schema.

The intended schema covers:

- User accounts, roles, and permissions
- Courses, universities, and colleges
- Applications and admission workflows
- Uploaded documents and review workflows
- Employer profiles and job listings
- Subscriptions, payments, refunds, and provider events
- Notifications, preferences, and delivery attempts
- Audit events
- Application review history
- Internal application notes
- Application assignments
- Application-specific admission checklists

Database migrations establish schema structures. Authentication, authorization, payment processing, file storage, notification delivery, business rules, and external integrations must also be implemented and tested in the backend.

## 2. Migration inventory

The following inventory documents the intended migration sequence. Verify each file against the repository before execution.

| Number | Filename | Purpose |
|—|—|—|
| 001 | `001_create_users.sql` | User accounts |
| 002 | `002_create_roles_permissions.sql` | Roles, permissions, and assignments |
| 003 | `003_create_courses.sql` | Course catalogue |
| 004 | `004_create_colleges_universities.sql` | Universities and colleges |
| 005 | `005_create_applications.sql` | Applications and admission status |
| 006 | `006_create_documents.sql` | Document records and review status |
| 007 | `007_create_employers_jobs.sql` | Employer profiles and job listings |
| 008 | `008_create_subscriptions_payments.sql` | Subscriptions, payments, refunds, and provider events |
| 009 | `009_create_notifications.sql` | Notifications, preferences, deliveries, attempts, and provider events |
| 010 | `010_create_audit_logs.sql` | Audit events |
| 011 | `011_create_application_review_history.sql` | Application status and review history |
| 012 | `012_create_application_notes.sql` | Application case notes |
| 013 | `013_create_application_assignments.sql` | Staff assignments for applications |
| 014 | `014_create_application_checklists.sql` | Application checklist items and completion tracking |

**Status:** Migrations `001`–`010` are the established inventory. Migrations `011`–`014` are proposed additions from the current design work; confirm their files, schema compatibility, and migration history before treating them as implemented.

## 3. Migration dependencies and execution order

Execute migrations in ascending numeric order, respecting actual foreign-key dependencies.

| Migration | Required dependencies |
|—|—|
| 001 — Users | None within this migration sequence |
| 002 — Roles and permissions | Users, where referenced |
| 003 — Courses | Existing schema dependencies, if any |
| 004 — Colleges and universities | Existing schema dependencies, if any |
| 005 — Applications | Users, courses, and colleges where referenced |
| 006 — Documents | Users and applications where referenced |
| 007 — Employers and jobs | Users and employer relationships where referenced |
| 008 — Subscriptions and payments | Users and related payment entities |
| 009 — Notifications | Users and notification-related entities |
| 010 — Audit logs | Users, where actor relationships are configured |
| 011 — Application review history | Applications and users |
| 012 — Application notes | Applications and users |
| 013 — Application assignments | Applications and users |
| 014 — Application checklists | Applications and users |

Inspect the actual SQL definitions before execution. Referenced tables and columns must exist, and foreign-key column types must match their referenced columns.

## 4. Migration standards

Every migration should:

- Use a unique, zero-padded numeric prefix.
- Use one canonical filename.
- Document its purpose, dependencies, and database requirements.
- Use InnoDB, `utf8mb4`, and the agreed collation.
- Define appropriate primary keys, foreign keys, indexes, and constraints.
- Use consistent timestamp and identifier conventions.
- Enforce applicable data invariants using supported database constraints.
- Include verification queries where useful.
- Avoid production credentials and real personal data.
- Be reviewed against application models, API contracts, and fixture schemas.

### Applied migration policy

Never edit or rename a migration that has already been applied to a shared database. Introduce a new migration for subsequent changes.

`CREATE TABLE IF NOT EXISTS` does not reconcile an existing table’s columns, indexes, defaults, or constraints. Inspect the actual schema before relying on an existing table.

## 5. Application workflow requirements

### 5.1 Application review history

The review-history table is intended to preserve application status transitions and review actions.

The backend should:

- Validate status transitions.
- Record meaningful transitions consistently.
- Write history in the same transaction as the corresponding status update where atomicity is required.
- Enforce reviewer authorization.
- Prevent unauthorized modification or deletion of historical records.

Verify the actual `applications.id` and `users.id` types before creating foreign keys.

### 5.2 Application notes

Application notes are intended to hold case-related information separately from status history.

The backend must:

- Enforce application-level authorization.
- Restrict staff-only and restricted notes.
- Prevent internal notes from being exposed through applicant-facing APIs.
- Sanitize note content and metadata.
- Apply appropriate retention and deletion policies.

A visibility column is not a substitute for access-control checks.

### 5.3 Application assignments

Application assignments are intended to track staff responsibilities for individual applications.

The backend must:

- Validate that assignees have the required staff role.
- Authorize assignment and reassignment operations.
- Define whether multiple active assignments are allowed.
- Preserve assignment history when reassignment occurs.
- Use transactions for changes that must remain consistent with audit events.
- Protect applicant information from unauthorized staff access.

### 5.4 Application checklists

Application checklists are intended to track required documents, eligibility checks, academic verification, payment checks, and counselling tasks.

The backend must:

- Enforce checklist creation, assignment, editing, and completion permissions.
- Validate allowed lifecycle transitions.
- Verify document ownership and review status before completing document-related items.
- Distinguish required, optional, and conditional checklist items.
- Exclude soft-deleted items from normal active-list queries.
- Record important checklist changes in audit or history records where required.

For migration `014`, verify the generated active-checklist-key design and its uniqueness behavior against the intended application workflow before deployment.

## 6. Migration execution and tracking

A production-ready migration runner should:

1. Discover migration files using their numeric prefixes.
2. Sort them in ascending order.
3. Reject duplicate migration identifiers.
4. Maintain one authoritative migration-history mechanism.
5. Record migration identifiers, filenames, checksums, and execution timestamps where supported.
6. Prevent concurrent migration runs from applying the same change simultaneously.
7. Stop on failure and identify the failing migration.
8. Detect changes to previously applied migration files.
9. Avoid silently marking partial execution as successful.
10. Provide documented recovery and reconciliation procedures.

These are requirements, not confirmation that the repository implements them.

Before execution, verify:

- The MySQL server version.
- The selected database and connection environment.
- Migration history and checksums.
- Database permissions.
- Backup completion and restoration procedures.
- The current schema and expected changes.

## 7. Fixture and backend integration

Relevant repository paths may include:

- `/database/fixtures/`
- `/schemas/`
- `/scripts/validate-fixtures.js`
- `/scripts/validate-document-manifests.mjs`

Verify these paths and files exist before relying on them.

Validate fixture syntax, identifiers, foreign references, status compatibility, ownership relationships, and mappings to database columns before importing data.

Additional requirements:

- Store secure password hashes, never plaintext passwords.
- Map fixture identifiers to actual database identifiers.
- Do not silently discard fixture-only fields.
- Validate application and document ownership.
- Verify payment-provider webhooks and make processing idempotent.
- Enforce employer eligibility before publishing jobs.
- Protect notification payloads and audit metadata from unnecessary sensitive data.
- Treat fixtures as synthetic test data, not evidence of real admissions, payments, or uploaded documents.

## 8. MySQL compatibility

The migrations target MySQL 8.0.16 or later because enforced `CHECK` constraints are required.

The collation `utf8mb4_0900_ai_ci` is MySQL-specific. Other database engines may require changes.

Review JSON defaults, regular expressions, foreign-key behavior, timestamp precision, generated columns, unique indexes, and DDL locking when modifying migrations.

MySQL DDL may implicitly commit. Do not assume that wrapping DDL in a transaction guarantees full rollback.

## 9. Verification and testing checklist

- [ ] Migration filename and number are unique.
- [ ] The file exists in the repository.
- [ ] Dependencies exist and are applied in the correct order.
- [ ] SQL executes on the supported MySQL version.
- [ ] Existing table definitions match expectations.
- [ ] Foreign keys reference compatible columns.
- [ ] Check constraints reject invalid values.
- [ ] Unique indexes behave as intended.
- [ ] Fixture references resolve correctly.
- [ ] Application and document ownership checks are enforced.
- [ ] Staff operations require appropriate authorization.
- [ ] Migration history and checksums are consistent.
- [ ] Partial-execution recovery is documented.
- [ ] Testing has been completed against a disposable database.
- [ ] Backup restoration has been verified before production deployment.

Do not mark a migration as tested until it has actually been executed and its results verified.

## 10. Failure recovery

If a migration fails:

1. Capture the exact database error.
2. Identify which statements were applied.
3. Inspect the affected tables, indexes, constraints, and migration history.
4. Compare the live schema with the intended schema.
5. Follow the documented recovery procedure.
6. Correct the migration or introduce a subsequent migration as appropriate.
7. Reproduce and verify recovery against a disposable database before redeployment.

Avoid dropping or recreating production tables as a routine recovery method. Preserve required data and reconcile the schema through a reviewed recovery plan.

## 11. Production deployment

Before production deployment:

- Back up the database and verify restoration.
- Review the migration diff and operational impact.
- Test against a representative staging database.
- Assess locking, index-build costs, and downtime risks.
- Confirm migration-runner behavior and privileges.
- Apply migrations through the approved deployment process.
- Verify the resulting schema and migration history.
- Monitor database errors and application health.
- Retain execution logs and recovery documentation.

Use a controlled migration job or a framework-supported coordination mechanism. Do not allow every application instance to apply production migrations independently.

## 12. Maintenance procedure

When adding a migration:

1. Select the next unused numeric prefix.
2. Choose a descriptive canonical filename.
3. Document purpose and dependencies.
4. Define columns, indexes, foreign keys, and constraints.
5. Update this inventory.
6. Update relevant models, API contracts, schemas, and fixtures.
7. Test against the supported MySQL version.
8. Verify the resulting schema and application workflows.
9. Document deployment and recovery considerations.
10. Record implementation status accurately.

## 13. Implementation status

This README describes the intended migration set and operational standards. It does not certify that all files exist, all migrations have executed, or the live database matches the repository.

Before relying on a migration, verify the repository file, migration history, live schema, and actual test results.

—

**Project:** MedOrbits  
**Directory:** `/migrations/main/`  
**Database:** MySQL 8.0.16+  
**Purpose:** Migration inventory, operational standards, and recovery guidance  
**Status:** Documentation; implementation and execution must be verified separately
