MedOrbits Database Migrations

Database schema migrations for the MedOrbits platform.

Database: MySQL 8.0.16+
Storage engine: InnoDB
Character set: utf8mb4
Collation: utf8mb4_0900_ai_ci

1. Purpose

This directory contains versioned SQL migrations for creating and maintaining the MedOrbits database schema.

The migrations define the core database structures for:

* User accounts and account status
* Roles, permissions, and role assignments
* Courses
* Colleges and universities
* Applications and admission workflows
* Uploaded documents and document reviews
* Employers and job listings

Migrations establish the database structure. Business logic, authentication, authorization, payment processing, file storage, and external integrations must also be implemented and tested in the backend.

2. Migration inventory

Migration	File	Purpose
001	001_create_users.sql	User accounts
002	002_create_roles_permissions.sql	Roles, permissions, and assignments
003	003_create_courses.sql	Course catalogue
004	004_create_colleges_universities.sql	Colleges and universities
005	005_create_applications.sql	Applications and admission status
006	006_create_documents.sql	Document records and review status
007	007_create_employers_jobs.sql	Employer profiles and job listings
008	008_create_subscriptions_payments.sql	Subscriptions, payments, refunds, and provider events
009	009_create_notifications.sql	Notifications, preferences, delivery attempts, and provider events
010	010_create_audit_logs.sql	Audit events

Important: Confirm that every listed file exists in the repository before applying the complete migration sequence. The inventory documents the intended migration set; it does not establish that every migration has been implemented or successfully executed.

Use exactly one filename for each migration number. Do not rename or edit a migration that has already been applied to a shared database. Introduce a new migration for subsequent schema changes.

3. Migration dependencies

The intended execution order is numeric order:

1. Create users.
2. Create roles and permissions.
3. Create courses.
4. Create universities and colleges.
5. Create applications.
6. Create documents.
7. Create employers and jobs.
8. Create subscriptions and payment-related tables.
9. Create notification-related tables.
10. Create audit logs.

Foreign-key dependencies must be respected. In particular, the users table must exist before migrations that reference it.

Migration 002 depends on the users table. Courses, colleges, applications, documents, employers, and jobs also depend on tables created earlier in the sequence.

Although notification and audit-log tables may have fewer dependencies than their sequence position suggests, keep the established numeric order consistent across environments.

4. Migration standards

Every migration should:

* Use a unique, zero-padded numeric prefix.
* Include a descriptive filename.
* Identify its database requirements and dependencies.
* Use InnoDB and the agreed character set and collation.
* Define primary keys, foreign keys, indexes, and applicable constraints.
* Use explicit and consistent timestamp conventions.
* Include checks for important data invariants where supported.
* Avoid inserting real user data or production credentials.
* Include a verification query when appropriate.
* Be reviewed for compatibility with the application’s models and fixture files.

Use CREATE TABLE IF NOT EXISTS only with an understanding of its limitations: it does not verify that an existing table has the expected columns, indexes, or constraints.

5. Migration execution and tracking

A production-ready migration runner should:

1. Discover migration files using their numeric prefixes.
2. Sort them in ascending order.
3. Maintain a migration-history table, such as schema_migrations.
4. Record successful migrations and their checksums.
5. Prevent concurrent migration runs from applying the same migration simultaneously.
6. Stop on failure and report the migration that failed.
7. Avoid silently treating a partially applied migration as successful.
8. Support a documented recovery process.

These are requirements for the migration runner, not confirmation that the current repository already implements them.

Before executing a migration, verify the database connection, selected database, backup status, and migration history.

Do not run the same migration repeatedly against an existing database merely because it contains CREATE TABLE IF NOT EXISTS. Existing table definitions may differ from the migration source.

6. Schema and backend integration

Database columns and constraints must agree with the application’s data models, API contracts, and validation schemas.

Pay particular attention to the following mappings.

Users and permissions

* User fixture IDs may be strings, while database primary keys may be numeric.
* Seed or import logic must map fixture IDs to database IDs.
* Passwords must be stored as secure password hashes, never plaintext.
* Email verification fields must remain consistent.
* Fixture permission names must be mapped to the permission names used by the database and authorization middleware.

Courses and colleges

* Course slugs and college slugs should resolve to the correct database records.
* Fixture-only fields that have no database column require explicit mapping or a subsequent schema change.
* College-to-course relationships must be represented by a suitable relationship table or another documented data model if the application needs them.
* Do not silently discard fields during fixture imports.

Applications and documents

* Application ownership must be checked against the authenticated user.
* Document ownership and application ownership must be checked by trusted backend services.
* Fixture statuses must be mapped explicitly when they differ from database enum-like checks.
* Review operations must validate reviewer permissions and preserve review history as required.
* File metadata must not be treated as proof that a real file exists or is safe.

Employers and jobs

A job must not be published unless its employer is verified, active, and not soft-deleted.

The backend must enforce this rule in the publishing workflow, ideally within a transaction that reads and locks the relevant records where necessary. The current employers and jobs table constraints do not, by themselves, enforce this cross-table eligibility rule.

Public job searches should exclude drafts, archived jobs, soft-deleted records, and jobs whose application deadlines have passed, according to the application’s defined listing policy.

Subscriptions and payments

* Store monetary amounts in the documented minor-unit representation or another explicitly defined currency-safe representation.
* Map fixture statuses to database statuses deliberately.
* Validate payment provider webhook signatures.
* Make webhook processing idempotent.
* Enforce refund limits transactionally.
* Never trust a client-supplied payment status as proof of a completed payment.

Notifications

* Keep delivery attempts separate from logical notifications.
* Deduplicate provider events.
* Use atomic job claiming and leases for concurrent delivery workers.
* Apply bounded retries and record terminal failures.
* Avoid including credentials, authentication tokens, or sensitive personal data in notification payloads and logs.

Audit logs

* Record security-relevant actions with appropriate actor, resource, outcome, and correlation information.
* Sanitize log metadata.
* Restrict access to audit records.
* Use database permissions and application controls to prevent unauthorized updates and deletions.

An audit table is not automatically immutable merely because it is named audit_logs.

7. Fixture validation

Synthetic fixtures and JSON schemas are maintained separately from the SQL migrations.

Relevant repository paths include:

* /database/fixtures/
* /schemas/
* /scripts/validate-fixtures.js
* /scripts/validate-document-manifests.mjs

Before importing fixtures, validate their structure and verify that all referenced users, applications, subscriptions, payments, documents, colleges, and courses resolve correctly.

Fixture validation should include:

* JSON syntax and schema validation.
* Unique fixture identifiers.
* Valid foreign-reference relationships.
* Status compatibility with database constraints.
* Consistent user and application ownership.
* Consistent subscription and payment references.
* Explicit mapping for fields that differ between JSON and SQL.

Fixtures are synthetic test data. They must not be interpreted as verified admissions, real payments, actual uploaded documents, or real institutional records.

8. MySQL compatibility

The migrations target MySQL 8.0.16 or later because this version supports enforced CHECK constraints.

Use a compatible MySQL server and verify the actual server version before applying the schema.

The selected collation, utf8mb4_0900_ai_ci, is MySQL-specific. Environments using MariaDB or another database engine may require adjustments.

Review SQL functions, JSON defaults, regular expressions, foreign-key behavior, and check constraints when changing the database platform or supported version.

9. Testing checklist

Before accepting a migration, verify the following:

* [ ]	The filename and migration number are unique.
* [ ]	All declared dependencies exist.
* [ ]	The SQL parses on the supported MySQL version.
* [ ]	Tables and indexes are created as intended.
* [ ]	Foreign keys reference compatible columns.
* [ ]	Check constraints reject invalid values.
* [ ]	Duplicate identifiers are rejected.
* [ ]	Fixture fields map correctly to database columns.
* [ ]	Fixture references resolve to valid records.
* [ ]	Backend authorization protects sensitive operations.
* [ ]	The migration runner records success and handles failures.
* [ ]	A recovery plan exists for partial execution.
* [ ]	Changes have been tested against a disposable development database.
* [ ]	Production backups and deployment approval are in place.

Do not mark a migration as tested until it has actually been executed and its results have been checked.

10. Failure recovery

If a migration fails:

1. Identify the failing statement and database error.
2. Determine which statements were committed or applied.
3. Inspect the affected tables, indexes, constraints, and migration history.
4. Restore the expected schema using a documented recovery procedure.
5. Correct the migration or create a new migration as appropriate.
6. Repeat testing against a disposable database before deployment.

MySQL DDL may cause implicit commits. Do not assume that wrapping a migration in a transaction makes every schema change automatically reversible.

Avoid dropping or recreating production tables as a routine recovery method.

11. Production deployment

Before production deployment:

* Back up the database and verify that restoration is possible.
* Review the migration diff and expected operational impact.
* Test against a representative staging database.
* Confirm database privileges are limited to required operations.
* Apply migrations through the approved deployment process.
* Monitor database errors and application health after deployment.
* Keep migration history and recovery documentation.
* Do not commit credentials, real personal data, or production payment information.

For large tables or high-traffic deployments, evaluate locking and downtime risks before adding indexes or changing columns.

12. Current implementation status

This README defines the intended migration inventory and operational standards. It does not certify that all migrations, constraints, runner features, integrations, or tests have been implemented successfully.

Confirm the actual repository files and database state before relying on any item as completed functionality.

13. Maintenance

When adding a migration:

1. Select the next unused numeric prefix.
2. Use one consistent filename.
3. Declare dependencies.
4. Define constraints and indexes.
5. Update the migration inventory in this README.
6. Update schemas, fixtures, models, and backend services where necessary.
7. Test on the supported MySQL version.
8. Document deployment and recovery considerations.

Keep this README aligned with the migration files actually maintained in the repository.

⸻

Project: MedOrbits
Directory: /database/migrations/
Database: MySQL 8.0.16+
Status: Documentation and migration inventory; implementation must be verified separately.