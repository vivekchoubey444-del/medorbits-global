MedOrbits Database Seeds

Directory: database/seeds/
Target database: MySQL 8.0.16+
Storage engine: InnoDB
Purpose: Controlled development and automated-test data initialization

1. Overview

The seed scripts populate development and test databases with baseline roles, permissions, illustrative education courses, fictional institutions, and synthetic demonstration records.

Seed data is not authoritative admission information. Fictional institutions and illustrative catalogue records must never be represented as recognized, accredited, officially approved, or available for actual admission.

Never run development seed scripts against production databases.

2. Directory structure

database/
└── seeds/
    ├── README.md
    ├── seed-roles.sql
    ├── seed-courses.sql
    ├── seed-colleges.sql
    ├── seed-demo-data.sql
    └── seed-development.sql

Script	Purpose
seed-roles.sql	Creates baseline role definitions, permissions, and role-permission mappings.
seed-courses.sql	Creates illustrative education-course catalogue entries.
seed-colleges.sql	Creates fictional universities and colleges.
seed-demo-data.sql	Creates a synthetic demonstration application for an existing demo user.
seed-development.sql	Coordinates selected development seed scripts.

Verify that each file exists and inspect its actual implementation before execution. A filename alone does not establish that its prerequisites are satisfied.

3. Prerequisites

Before running seeds, confirm that:

* MySQL 8.0.16 or newer is in use.
* All required schema migrations have completed successfully.
* Relevant tables use InnoDB.
* Required unique constraints and foreign keys exist.
* The selected database is explicitly designated for development or testing.
* The database account has only the privileges needed for the operation.
* A backup or disposable database snapshot is available if existing development data matters.

Expected dependencies include:

Table	Purpose
roles	Role definitions
permissions	Permission definitions
role_permissions	Role-to-permission mappings
user_roles	User-role assignments
courses	Course catalogue
universities	University catalogue
colleges	College catalogue
users	Synthetic applicant account
applications	Demonstration application

These dependencies are conditional on the actual migrations. In particular, verify whether applications reference users through applicant_id or user_id.

Database compatibility: MedOrbits has also had a PostgreSQL-oriented backend schema. These files are MySQL-specific. Do not mix MySQL seed scripts with PostgreSQL migrations.

4. Development database naming

The seed safety checks expect a delimited identifier such as:

medorbits_dev
medorbits_development
medorbits_test
medorbits_testing

These names do not satisfy the naming convention:

medorbits
medorbits_production
medorbitsdev

Database-name validation is a guardrail, not a security boundary. Use separate database credentials for development and production.

5. Enable development seeding

Connect to the intended development database using the MySQL command-line client:

mysql -u YOUR_DB_USER -p medorbits_dev

At the MySQL prompt, enable the session-specific opt-in:

SET @medorbits_allow_development_seed = 1;

The variable is specific to the current connection. Set it again when opening a new connection.

Run an individual seed when needed:

SOURCE database/seeds/seed-roles.sql;
SOURCE database/seeds/seed-courses.sql;
SOURCE database/seeds/seed-colleges.sql;

SOURCE is a MySQL command-line client directive, not a SQL statement that can be submitted through a regular Node.js database-driver query.

6. Recommended execution order

Apply and verify schema migrations before seeding.

1. Apply the migrations required for users, roles, permissions, courses, universities, colleges, and applications.
2. Run seed-roles.sql.
3. Run seed-courses.sql.
4. Run seed-colleges.sql.
5. Provision the synthetic applicant using a separate development fixture workflow.
6. Run seed-demo-data.sql only after confirming its schema assumptions and prerequisites.
7. Verify the resulting records and relationships.

Do not assume the seed scripts create prerequisite users or activate fictional colleges. Fictional institutions should remain inactive by default unless a dedicated test requires otherwise.

7. Development orchestrator

seed-development.sql coordinates the baseline role and institution seeds. Confirm that all referenced files exist and that their schemas and database engine match.

Run the orchestrator in the same MySQL client session where the opt-in variable was set.

SET @medorbits_allow_development_seed = 1;
SOURCE database/seeds/seed-development.sql;

Use the MySQL client with source-error handling enabled:

mysql —abort-source-on-error -u YOUR_DB_USER -p medorbits_dev

Then set the opt-in and execute SOURCE at the interactive prompt.

The orchestrator is not atomic across separate seed scripts. A successful earlier seed may remain committed if a later script fails. For troubleshooting, run scripts individually and inspect the affected rows before retrying.

8. Seed script responsibilities

seed-roles.sql

Defines baseline roles:

* user
* admin
* counsellor
* employer

It also defines baseline permissions and maps permissions to roles.

Security requirements:

* Never assign the admin role automatically to a user.
* Enforce authorization on the server for every protected request.
* Protect role-management operations.
* Audit privileged operations, including permission changes and refunds.
* Review role-permission mappings before deploying changes.

The seed should add missing definitions and mappings without silently overwriting conflicting existing definitions.

seed-courses.sql

Provides illustrative entries such as:

* MBBS
* BDS
* BAMS
* Bachelor of Pharmacy
* BSc Nursing
* BTech Computer Science
* Medical Laboratory Technology
* Physiotherapy
* Radiology and Imaging Technology
* MBA
* MSc Data Science
* BBA

Durations, entrance examinations, and eligibility descriptions are sample metadata. Verify current requirements with the relevant official authorities before publishing admission guidance.

A non-null entrance_exam represents a sample value. A null value means the seed does not specify an examination; it does not mean an examination is unnecessary.

seed-colleges.sql

Creates fictional universities and colleges for catalogue and application-workflow testing.

These records are not evidence of institutional recognition, accreditation, affiliation, regulatory approval, admission capacity, or eligibility.

Keep fictional institutions inactive unless a dedicated test explicitly requires active fixtures.

seed-demo-data.sql

Creates a synthetic draft application for an existing synthetic user.

Expected user fixture:

demo-applicant@example.invalid

The .invalid domain is reserved for example use and must not be used for real communication.

Before execution, verify that:

* The synthetic user exists and is not deleted.
* The required course exists.
* The fictional college exists.
* Application foreign-key column names match the migration.
* The configured status is valid for the application schema.
* The application number and public identifier do not conflict with unrelated records.
* The draft cannot trigger real email, SMS, payment, admission, or external-submission workflows.

The demonstration application is not a real admission application.

9. Idempotency and conflict handling

Seed scripts should be safe to rerun when their prerequisites remain unchanged.

Recommended practices:

* Use unique constraints for stable slugs and public identifiers.
* Use deterministic identifiers for known fixtures.
* Never update existing records merely to force a seed to succeed.
* Validate existing rows against expected fixture definitions.
* Roll back on validation failures.
* Preserve user-created development data.
* Avoid deleting conflicting rows automatically.

ON DUPLICATE KEY UPDATE id = id is a no-op update, not proof that the existing row is correct. MySQL can activate duplicate-key handling through any applicable unique constraint. Validate the resulting record explicitly.

10. Transaction and failure handling

Use transactions for related writes and ensure that all affected tables use a transactional storage engine.

An exception handler that calls ROLLBACK and RESIGNAL can roll back transactional writes and propagate SQL errors to the client.

Important limitations:

* Some DDL statements cause implicit commits.
* Creating and dropping stored procedures is not part of the data transaction.
* Separate seed scripts may commit independently.
* A later script failure does not automatically undo an earlier successful seed.
* Concurrent executions can race unless unique constraints and suitable locking protect the relevant records.
* Client-side SOURCE commands require appropriate client error handling; a failed sourced script must not be assumed to stop all subsequent commands.

After a failure, inspect the error, confirm the selected database, and examine affected rows before retrying.

11. Verification queries

Verify baseline roles

SELECT id, name, display_name, is_system
FROM roles
WHERE name IN (‘user’, ‘admin’, ‘counsellor’, ‘employer’)
ORDER BY name;

Verify role-permission mappings

SELECT
    r.name AS role_name,
    p.name AS permission_name
FROM role_permissions AS rp
JOIN roles AS r
    ON r.id = rp.role_id
JOIN permissions AS p
    ON p.id = rp.permission_id
ORDER BY r.name, p.name;

Verify courses

SELECT
    id,
    public_id,
    name,
    slug,
    category,
    qualification_level,
    is_active
FROM courses
ORDER BY name;

Verify college relationships

SELECT
    c.name AS college_name,
    c.slug AS college_slug,
    u.name AS university_name,
    u.slug AS university_slug,
    c.is_active
FROM colleges AS c
JOIN universities AS u
    ON u.id = c.university_id
ORDER BY c.slug;

Verify the demonstration application

Confirm the actual foreign-key and column names before using this query.

SELECT
    a.id,
    a.public_id,
    a.application_number,
    a.status,
    a.applicant_email,
    c.slug AS course_slug,
    cl.slug AS college_slug
FROM applications AS a
JOIN courses AS c
    ON c.id = a.course_id
JOIN colleges AS cl
    ON cl.id = a.college_id
WHERE a.application_number = ‘DEMO-APPLICATION-0001’;

These queries display records but do not, by themselves, assert that all expected rows exist or that every value matches its intended fixture.

12. Troubleshooting

Error	Likely cause	Recommended action
No database selected	No schema selected	Connect to the intended development database.
Development seed blocked	Session opt-in missing	Set the opt-in in the same MySQL session.
Database name rejected	Name does not match the guard	Use a clearly named development/test database.
Table does not exist	Migration missing	Apply and verify the prerequisite migration.
Unknown column	Seed and schema disagree	Compare the seed with the actual migration.
Duplicate entry	A unique value conflicts	Inspect the existing row; do not delete it blindly.
Foreign-key violation	Referenced fixture is missing	Provision the prerequisite record first.
Course or college conflict	Existing fixture differs	Inspect and resolve the conflict deliberately.
Transaction rollback	Validation or SQL statement failed	Correct the underlying issue before retrying.

13. Security and data privacy

* Never place real applicant data, passwords, API keys, payment information, or identity documents in seed files.
* Use synthetic identities and reserved example email domains.
* Never grant administrative roles automatically for convenience.
* Do not expose private IDs, applicant details, or privileged audit information through public catalogue endpoints.
* Ensure synthetic data cannot initiate real external workflows.
* Use separate development credentials with least-privilege permissions.
* Keep seed scripts reviewed and version-controlled.

14. Production policy

Development seeds are not production migrations.

Do not execute these scripts automatically during production startup, deployment, or application boot.

Manage production reference data through reviewed migrations or controlled administrative workflows. Any production bootstrap process must be separate and have explicit approvals, backups, audit logging, and narrowly scoped privileges.

15. Maintenance checklist

Before adding or changing a seed:

* [ ]	Confirm the target migration and column definitions.
* [ ]	Add stable identifiers and appropriate unique constraints.
* [ ]	Clearly label synthetic records.
* [ ]	Validate conflicting existing records.
* [ ]	Preserve user-created data.
* [ ]	Test against a disposable development database.
* [ ]	Verify relationships and foreign keys.
* [ ]	Confirm rerunning the seed is safe.
* [ ]	Review permissions for least privilege.
* [ ]	Ensure production deployment never runs development seeds.

⸻

Maintainer note: Keep this README aligned with the actual migrations and seed scripts. When the schema changes, update the prerequisites, execution order, and verification queries together.