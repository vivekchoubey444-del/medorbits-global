MedOrbits Database

Directory: database/
Database engine: MySQL 8.0.16+
Storage engine: InnoDB
Character set: utf8mb4
Collation: utf8mb4_0900_ai_ci

1. Overview

The database/ directory contains the consolidated schema, versioned SQL migrations, seed scripts, and test fixtures used by the MedOrbits platform.

The database supports:

* Education consultancy and course discovery
* College and university catalogues
* Admission applications and document management
* Employer profiles, recruitment, and job listings
* User accounts and role-based access control
* Subscriptions, payments, and refunds
* Notifications and delivery processing
* Audit logging and administrative workflows

The database layer is responsible for relational integrity, schema versioning, consistent data access, controlled reference data, test fixtures, and appropriate protection of sensitive records.

Important: This repository targets MySQL. Do not execute its SQL against PostgreSQL without explicitly converting and testing the schema and migration logic.

2. Directory structure

Expected repository layout:

database/
├── README.md
├── schema.sql
├── schema.txt
├── fixtures/
│   ├── README.md
│   ├── applications.fixture.json
│   ├── colleges.fixture.json
│   ├── courses.fixture.json
│   ├── payments.fixture.json
│   ├── users.fixture.json
│   ├── subscriptions.fixture.json
│   ├── documents.fixture.json
│   └── roles-permissions.fixture.json
├── migrations/
│   ├── README.md
│   ├── 001_create_users.sql
│   ├── 002_create_roles_permissions.sql
│   ├── 003_create_courses.sql
│   ├── 004_create_colleges_universities.sql
│   ├── 005_create_applications.sql
│   ├── 006_create_documents.sql
│   ├── 007_create_employers_jobs.sql
│   ├── 008_create_subscriptions_payments.sql
│   ├── 009_create_notifications.sql
│   └── 010_create_audit_logs.sql
└── seeds/
    ├── README.md
    ├── seed-colleges.sql
    ├── seed-courses.sql
    ├── seed-demo-data.sql
    └── seed-roles.sql

This is the intended layout, not confirmation that every listed file currently exists. Verify the actual repository before running scripts.

Filename consistency

Migration filenames are part of the versioned schema history. The migration runner, documentation, deployment scripts, and repository must use the same names.

The agreed filenames are:

* 007_create_employers_jobs.sql
* 008_create_subscriptions_payments.sql

Use the actual filenames present in the repository. Do not create duplicate migration numbers or rename migrations that have already been applied in a shared environment.

3. Database architecture

MedOrbits uses a relational MySQL database with foreign keys, unique constraints, indexes, and supported database-level validation.

Setting	Configuration
Engine	MySQL
Minimum version	8.0.16+
Storage engine	InnoDB
Character set	utf8mb4
Collation	utf8mb4_0900_ai_ci
Internal primary keys	BIGINT UNSIGNED AUTO_INCREMENT, where appropriate
Public identifiers	UUIDs
Timestamps	DATETIME(3) where millisecond precision is required
Structured metadata	JSON where appropriate
Migration history	schema_migrations, if implemented by the migration system

Core principles

1. Use foreign keys for relational integrity.
2. Use unique constraints for identifiers and natural keys.
3. Add indexes based on actual query patterns.
4. Keep database constraints aligned with application validation.
5. Separate schema definitions from seed data.
6. Use versioned migrations for incremental changes.
7. Keep test fixtures synthetic and restricted to development or testing.
8. Protect personal, financial, and document-related information.
9. Prefer backward-compatible schema changes when application and database deployments are separate.

4. Schema ownership and source of truth

MedOrbits maintains two schema representations.

schema.sql — consolidated schema

database/schema.sql describes the intended complete schema for a fresh installation.

It should define the required tables, columns, relationships, indexes, and constraints.

Use it only through the documented fresh-install procedure.

migrations/ — incremental schema history

database/migrations/ contains the ordered SQL files describing incremental schema changes.

For migration-managed environments, the applied migrations and their recorded history define the database’s evolution.

Consistency requirement

The consolidated schema and complete migration sequence must produce structurally equivalent databases.

Compare:

* Column names, types, nullability, and defaults
* Primary keys and unique constraints
* Foreign keys and deletion behavior
* Indexes and check constraints
* Character sets and collations
* Timestamp behavior
* Relevant status values and data invariants

Do not apply schema.sql and migrations 001–010 to the same database unless a deliberate baseline and migration-history procedure has been implemented.

If the two representations disagree, resolve the discrepancy rather than treating them as interchangeable.

5. Migration inventory

The intended migration responsibilities are:

Migration	Responsibility
001_create_users.sql	User accounts, credentials, and account status
002_create_roles_permissions.sql	Roles, permissions, and assignments
003_create_courses.sql	Education course catalogue
004_create_colleges_universities.sql	College and university records
005_create_applications.sql	Admission and consultancy applications
006_create_documents.sql	Document metadata and review status
007_create_employers_jobs.sql	Employer profiles and job listings
008_create_subscriptions_payments.sql	Subscriptions and payment records
009_create_notifications.sql	Notifications and delivery infrastructure
010_create_audit_logs.sql	Application and security audit events

The actual SQL files determine which tables and capabilities exist. This inventory does not prove that every listed migration has been implemented or successfully applied.

Refer to migrations/README.md for migration dependencies and execution standards.

6. Migration management

Run migrations in numerical order through the reviewed migration runner, if one is implemented.

A production-ready runner should:

1. Discover migration files deterministically.
2. Validate filenames and numeric prefixes.
3. Apply unapplied migrations in order.
4. Maintain accurate migration history.
5. Prevent concurrent processes from applying the same migration simultaneously.
6. Stop and report failures.
7. Detect changes to previously applied files, preferably using checksums.
8. Verify the database engine and version.
9. Handle partially completed migrations safely.
10. Provide a documented recovery procedure.

The intended history table is schema_migrations. Its actual structure and behavior must match the migration runner.

Important MySQL behavior

* MySQL DDL statements can implicitly commit.
* A failed migration may leave some tables or constraints created.
* CREATE TABLE IF NOT EXISTS does not update an existing table to match a revised definition.
* A migration should not be assumed safe to rerun or automatically reversible.

Once a migration has been applied in a shared environment, keep its filename stable. Use a new migration for subsequent schema changes.

7. Database configuration

The intended application configuration files are:

* src/config/database.js
* src/config/env.js

Confirm that these files exist and inspect their accepted configuration before using the example below.

Example .env configuration:

DB_CLIENT=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=medorbits
DB_USER=medorbits_app
DB_PASSWORD=replace_with_a_secure_secret
DB_CONNECTION_LIMIT=10
DB_CONNECT_TIMEOUT=10000
DB_WAIT_FOR_CONNECTIONS=true
DB_TIMEZONE=Z

These names and values are illustrative. They are not confirmation of the current implementation.

Credentials and permissions

* Never commit .env files or production credentials.
* Use deployment environment variables or a secrets manager for production secrets.
* Use a dedicated database account with least-privilege permissions.
* Separate runtime credentials from migration credentials where practical.
* Restrict database network access.
* Use TLS where required by the deployment environment.
* Avoid exposing SQL errors or connection details in public API responses.

The application runtime should not receive schema-altering privileges unless explicitly required.

8. Fresh database installation

Use this procedure for a new development or test database.

1. Install a compatible MySQL server.
2. Create the intended development or test database.
3. Configure and verify the database connection.
4. Review database/schema.sql.
5. Apply the consolidated schema once.
6. Load the appropriate reference data.
7. Create the initial administrator through a secure setup procedure.
8. Verify the tables, constraints, and indexes.
9. Run integration tests against the resulting database.

Example database creation:

CREATE DATABASE medorbits
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

This is illustrative. Confirm that the database does not already contain valuable data before executing setup operations.

Do not apply migrations 001–010 after applying the consolidated schema unless the project has an explicit baseline mechanism that records the appropriate migration history.

The schema file may itself include CREATE DATABASE and USE statements. Review those statements and the selected database before execution.

9. Existing database installation

For an existing database:

1. Back up the database.
2. Inspect the current schema and migration history.
3. Confirm the database’s expected baseline.
4. Identify unapplied migrations.
5. Apply unapplied migrations in numerical order.
6. Verify each migration’s result.
7. Run integration tests.
8. Monitor application health after deployment.

Do not use the fresh-install schema as a substitute for incremental migrations on an existing production database.

Migration execution

Inspect the available package scripts from the repository root:

npm run

If a reviewed migration script exists, use the documented command. For example:

npm run migrate

The second command is illustrative and must not be assumed to exist.

For manual development execution, use the MySQL client and apply individual files in the documented dependency order. Prefer a reviewed migration runner for shared and production environments.

10. Seed data

The seeds/ directory contains baseline reference data and controlled demonstration records.

File	Responsibility
seed-roles.sql	Initial roles, permissions, and role-permission mappings
seed-courses.sql	Illustrative course catalogue
seed-colleges.sql	Fictional universities and colleges
seed-demo-data.sql	Synthetic demonstration application

Run seeds only after their dependent tables exist.

Before execution:

* Confirm that required columns exist.
* Verify foreign-key and unique-constraint assumptions.
* Confirm required users and reference records exist.
* Review ON DUPLICATE KEY UPDATE behavior.
* Test repeat execution.
* Keep demonstration records distinguishable from real records.
* Do not load demo accounts or applicant information into production without explicit authorization and a reviewed procedure.

Reference data and demonstration data should be separated wherever practical.

Refer to seeds/README.md for seed conventions and execution guidance.

11. Test fixtures

The fixtures/ directory contains synthetic JSON records for automated tests and development workflows.

Expected fixtures include:

* users.fixture.json
* subscriptions.fixture.json
* documents.fixture.json
* roles-permissions.fixture.json
* applications.fixture.json
* colleges.fixture.json
* courses.fixture.json
* payments.fixture.json

Confirm the actual fixture files before relying on this inventory.

Fixtures must conform to the current schema, identifier formats, required fields, foreign-key relationships, and allowed status values.

JSON syntax validation alone does not validate database constraints or business rules. Fixtures are not automatically loaded unless a configured script or test explicitly loads them.

Refer to fixtures/README.md for fixture conventions, validation requirements, and loading guidance.

12. Schema and application integration

Database definitions must remain aligned with application models, repositories, services, validators, workers, and authorization middleware.

Users and roles

* Define one authoritative authorization mechanism.
* If legacy role fields and normalized role-assignment tables coexist, document and test their synchronization strategy.
* Backend authorization must use the authoritative role and permission source.
* Never trust a role or permission supplied by the client.
* Store password hashes, not plaintext passwords.

Courses and institutions

* Keep course, college, and university slugs consistent with seed scripts and application queries.
* Ensure foreign keys reference the intended internal IDs.
* Distinguish institutional existence from verification and publication.
* Confirm that seed scripts use columns defined by the actual migrations.
* Verify institution and course information with official sources before publishing it as factual admissions guidance.

Admission applications

* Enforce unique public identifiers and application numbers.
* Align status values with application services and validators.
* Populate reviewer and review timestamps consistently.
* Confirm that foreign-key behavior preserves required historical information.
* Enforce application ownership in trusted backend services.

Documents

* Store metadata and private storage identifiers in the database.
* Store actual files in protected private storage.
* Validate file content, permitted types, and size on the server.
* Enforce ownership and access control for every download or modification.
* Define verification, rejection, retention, and deletion workflows consistently.

Employers and jobs

* Validate employer verification and activation before allowing job publication.
* Align employment types, workplace types, job statuses, and salary fields across the application and database.
* Confirm that employment application tables exist if required by the recruitment workflow.
* Protect private employer and applicant information.

Payments and subscriptions

* Use one consistent monetary representation.
* If INR amounts are stored in paise, ₹1,500.00 equals 150000 paise.
* Convert between provider amounts and database values explicitly.
* Verify payment-provider webhooks on the server.
* Implement idempotency and duplicate-event protection.
* Record refunds and state transitions according to the actual payment model.
* Never store card numbers, CVVs, UPI PINs, or provider credentials.

Notifications

* Align database statuses with notification jobs and workers.
* Implement retry limits, backoff, scheduling, and safe concurrent job claiming.
* Deduplicate provider events where supported.
* Distinguish logical notifications from channel-specific deliveries if the schema uses separate delivery records.
* Do not assume exactly-once delivery from database status fields alone.

Audit logs

* Restrict access to audit records.
* Avoid storing credentials, session cookies, tokens, and unnecessary personal information.
* Define retention and archival policies.
* Consider protected external logging or tamper-evident storage for security-critical events.

13. Testing and validation

Before deploying database changes, verify the following:

* [ ]	SQL syntax is valid for the target MySQL version.
* [ ]	All migrations apply to a clean disposable database.
* [ ]	Primary keys, unique constraints, foreign keys, and indexes are correct.
* [ ]	Check constraints and timestamp defaults behave as expected.
* [ ]	Migration history accurately reflects completed migrations.
* [ ]	Fixtures and seed data are valid.
* [ ]	Application queries work against the resulting schema.
* [ ]	Registration, authentication, and authorization work.
* [ ]	Application submission and review workflows work.
* [ ]	Document ownership and verification are enforced.
* [ ]	Job publication requires an eligible employer.
* [ ]	Payment, refund, and webhook idempotency are tested.
* [ ]	Notification scheduling and retries are tested.
* [ ]	Audit logging and access restrictions are tested.
* [ ]	Migration failure recovery is documented.
* [ ]	Consolidated schema and migration results are structurally equivalent.
* [ ]	Backup restoration has been tested.

Run destructive and recovery tests only against disposable or explicitly designated test databases.

14. Failure handling and recovery

If a migration fails:

1. Stop the migration process.
2. Record the migration filename and error.
3. Inspect which database objects were created or modified.
4. Compare the actual database state with migration history.
5. Determine whether the migration partially applied.
6. Follow a reviewed recovery procedure.
7. Restore from a verified backup or apply a forward-recovery migration when appropriate.
8. Verify the schema before continuing.

Do not delete migration-history records merely to force a migration to run again.

Because MySQL DDL can implicitly commit, the presence of a migration-history record is not sufficient by itself to prove that the resulting schema is correct. Conversely, the absence of a record does not prove that no schema changes occurred.

15. Backup and recovery

Maintain a documented backup and recovery procedure.

Recommended practices:

* Back up the database before production schema changes.
* Store backups securely with restricted access.
* Protect backups containing personal or confidential information.
* Define retention periods and recovery objectives.
* Test restoration periodically.
* Verify application functionality after restoration.
* Document recovery steps for failed migrations and accidental data changes.

A backup should not be considered reliable until its restoration has been tested.

16. Production deployment checklist

Before applying database changes to production:

* [ ]	The configured database engine is MySQL.
* [ ]	The deployed version supports the schema features in use.
* [ ]	Credentials are securely configured.
* [ ]	The database has a verified backup.
* [ ]	Migration filenames match the repository and runner.
* [ ]	Migration history and the current schema have been inspected.
* [ ]	Migrations have been tested in a non-production environment.
* [ ]	The migration runner prevents concurrent execution.
* [ ]	The resulting schema matches application expectations.
* [ ]	Required reference data is present.
* [ ]	Demonstration fixtures have not been loaded into production.
* [ ]	Database permissions follow least-privilege principles.
* [ ]	Application integration tests pass.
* [ ]	Monitoring and recovery procedures are available.

Prefer backward-compatible schema changes when application and database deployments happen separately.

17. Maintenance and change management

Whenever the database schema changes:

1. Add a new migration instead of silently rewriting an applied migration.
2. Update schema.sql to reflect the complete resulting schema.
3. Update models, repositories, services, validators, and workers.
4. Update seed scripts and fixtures.
5. Review indexes, foreign keys, constraints, and deletion behavior.
6. Test a clean installation and a representative existing database.
7. Update this README and migrations/README.md where appropriate.
8. Document data transformations and recovery steps.
9. Verify migration checksums and history if implemented.

If a migration must be corrected after deployment, prefer a reviewed forward migration unless it is confirmed that the original migration has never been applied in any shared environment.

18. Repository verification

Before considering the database implementation production-ready, verify these items against the actual repository:

1. Confirm migration 007’s filename and use it consistently.
2. Confirm migration 008’s filename and use it consistently.
3. Verify that migration 009 contains the intended notification schema.
4. Verify that migration 010 matches the agreed audit-log design.
5. Compare schema.sql against the complete migration sequence.
6. Confirm whether schema_migrations is implemented and maintained by the actual runner.
7. Verify whether the runner supports checksums, concurrency protection, failure reporting, and recovery.
8. Compare seed scripts and fixtures with the actual schema.
9. Confirm that employment application tables exist if required.
10. Confirm that payment, refund, notification-delivery, and provider-event tables match application services and workers.
11. Verify environment variable names against .env.example, src/config/env.js, and src/config/database.js.
12. Confirm that production and test database credentials are separate.

Documentation describes intended behavior; it does not establish that a feature has been implemented or tested.

19. Final principle

Keep the MedOrbits database version-controlled, migration-managed, secure, recoverable, and aligned with the application.

The numbered migrations define the history of incremental changes. The consolidated schema must represent the same final schema for fresh installations. Seeds must remain controlled, fixtures must remain synthetic, and all production database changes must be reviewed, tested, and recoverable.