MedOrbits Database Seeds

Overview

The database/seeds/ directory contains SQL seed scripts for initializing baseline roles and permissions, illustrative education catalogue records, fictional institutions, and controlled demonstration data.

All seed scripts must remain compatible with the MedOrbits database schema, applied migrations, and supported MySQL version.

* Database: MySQL 8.0.16+
* Storage engine: InnoDB
* Character set: utf8mb4

Safety: Run these scripts only against an authorized development or test database. Institution and applicant records are fictional and must never be presented as verified real-world records.

Directory structure

database/seeds/
├── README.md
├── seed-roles.sql
├── seed-courses.sql
├── seed-colleges.sql
└── seed-demo-data.sql

Seed files

File	Purpose	Prerequisites
seed-roles.sql	Inserts baseline roles, permissions, and role-permission assignments.	Migrations 001 and 002
seed-courses.sql	Inserts illustrative education course catalogue records.	Migration 003
seed-colleges.sql	Inserts fictional universities and colleges.	Migration 004
seed-demo-data.sql	Inserts a synthetic demonstration application.	Migrations 001, 003, 004, and 005; course and college seeds; pre-existing synthetic user

The demonstration application requires the user demo-applicant@example.invalid to exist before the seed runs.

The migration filenames must match the files actually maintained in the repository. Verify the migration sequence and schema before executing seeds.

Prerequisites

Before running the seed scripts, confirm that:

* MySQL 8.0.16 or later is available.
* The intended development or test database exists.
* Required migrations have been applied successfully.
* Required tables, columns, unique indexes, and foreign-key constraints exist.
* Transactional tables use InnoDB.
* The schema uses the expected character set and collation.
* The synthetic user required by seed-demo-data.sql exists.
* The database account has only the permissions required for the operation.
* A backup or disposable database is available if existing data could be affected.

Execution order

Run the scripts in this order:

1. seed-roles.sql
2. seed-courses.sql
3. seed-colleges.sql
4. seed-demo-data.sql

The role seed requires the roles and permissions tables. The course and institution seeds require their respective migrations. The demonstration application depends on the course, college, and synthetic user records.

Important: seed-demo-data.sql does not create a user account. It expects the synthetic user demo-applicant@example.invalid to exist already.

Database configuration

Configure the database connection using the environment variables expected by the MedOrbits application.

Example .env configuration:

DB_CLIENT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=medorbits_dev
DB_USER=medorbits_app
DB_PASSWORD=replace_with_a_secure_password

These values are examples only. Use the actual variable names defined by the repository’s database configuration, such as src/config/database.js or src/config/env.js, if those files exist.

Never commit real credentials to source control. Keep secret-bearing .env files out of Git and use safe placeholders in .env.example.

Executing the seeds

Run the scripts from the repository root using your approved local database workflow.

Before execution, confirm that the selected database is the intended development or test database. Do not put database passwords directly into command-line arguments or commit them to scripts.

Execute the four seed files in the order listed above. If a statement fails, stop and investigate before proceeding to the next file.

Execution behavior: A sequence of separate seed files is not one atomic transaction. Earlier scripts may have committed successfully even if a later script fails.

The course, college, role, and demo seeds use duplicate-key handling. The college, course, role, and demo scripts discussed for this repository also use stored procedures for verification and rollback. Confirm that the actual files contain these implementations and that your SQL client supports DELIMITER and stored procedures before relying on them.

Data safety

* Never run demonstration seeds against production without explicit review and authorization.
* Use fictional demonstration records only.
* Do not put real student information, credentials, or sensitive personal data in seed files.
* Never store plaintext passwords, API keys, access tokens, or payment credentials in seed files.
* Do not create fake payment records that could be mistaken for completed transactions.
* Preserve existing user-generated data when rerunning seeds.
* Restrict administrative role assignment to authorized administrators.
* Verify foreign-key relationships and database constraints.
* Use a dedicated database account with least-privilege permissions.
* Review seed changes before merging them into the main branch.

Idempotency

Seed scripts should be safe to execute repeatedly wherever practical.

MySQL’s INSERT ... ON DUPLICATE KEY UPDATE can prevent duplicate insertions when an applicable unique constraint exists.

For example:

ON DUPLICATE KEY UPDATE
    id = id;

This no-op update leaves the conflicting row unchanged.

However:

* The behavior depends on the unique indexes defined in the actual schema.
* A conflict may be triggered by a unique index other than the intended natural key.
* A no-op update does not repair incorrect existing data.
* An INSERT ... SELECT may insert zero rows if its prerequisites are missing.
* A successful SQL statement does not prove that every expected record exists.
* A seed may fail verification if a pre-existing record has different relationships or identifiers.

Use stable identifiers such as course slugs, institution slugs, and application numbers where appropriate. Confirm that the corresponding columns have unique constraints.

Do not silently overwrite existing permissions, institutional relationships, or user-generated data. Use an explicit migration or reviewed maintenance operation when existing records need to change.

Validation

After running the seed scripts, verify the expected records and relationships.

1. Verify roles

SELECT
    name,
    display_name,
    is_system
FROM roles
ORDER BY name;

2. Verify permissions

SELECT
    name,
    resource,
    action,
    is_system
FROM permissions
ORDER BY resource, action;

3. Verify role-permission assignments

SELECT
    r.name AS role_name,
    p.name AS permission_name
FROM role_permissions AS rp
INNER JOIN roles AS r
    ON r.id = rp.role_id
INNER JOIN permissions AS p
    ON p.id = rp.permission_id
ORDER BY r.name, p.name;

4. Verify course catalogue records

SELECT
    slug,
    code,
    category,
    duration_months,
    is_active
FROM courses
WHERE slug IN (
    ‘mbbs’,
    ‘bds’,
    ‘bams’,
    ‘b-pharm’,
    ‘bsc-nursing’,
    ‘btech-computer-science’
)
ORDER BY slug;

5. Verify fictional universities

SELECT
    slug,
    name,
    is_active
FROM universities
WHERE slug IN (
    ‘medorbits-demo-university’,
    ‘medorbits-sample-health-sciences-university’
)
ORDER BY slug;

6. Verify fictional colleges and relationships

SELECT
    c.slug AS college_slug,
    c.name AS college_name,
    u.slug AS university_slug,
    u.name AS university_name,
    c.is_active
FROM colleges AS c
LEFT JOIN universities AS u
    ON u.id = c.university_id
WHERE c.slug IN (
    ‘medorbits-demo-medical-college’,
    ‘medorbits-sample-dental-college’
)
ORDER BY c.slug;

7. Verify the synthetic demonstration application

SELECT
    application_number,
    applicant_name,
    applicant_email,
    status,
    submitted_at
FROM applications
WHERE application_number = ‘DEMO-APPLICATION-0001’;

8. Verify foreign-key relationships

Confirm that:

* The seeded colleges reference their intended universities.
* The demonstration application references the expected user.
* The application references the expected course and college.
* Role-permission assignments reference existing roles and permissions.
* No seed has unintentionally assigned the administrator role to a user.

Run the project’s automated test suite and any available database integration tests after validation.

Validation note: These queries inspect database state; they do not automatically assert that the expected number of rows exists. Automated validation should fail explicitly when required records or relationships are missing.

Important schema compatibility notes

Keep the seed files aligned with the migrations and backend models.

Roles and permissions

The role seed uses permission names such as applications.read_assigned, documents.read_assigned, and jobs.manage_own. Confirm that these names exist in the final seed and are enforced consistently by the backend authorization middleware.

Counsellor permissions must be restricted to assigned applications and documents by trusted backend logic. Permission names alone do not enforce record-level access.

The seed grants permissions to the administrator role; it does not assign that role to any user. Administrative role assignment must remain a separately authorized operation.

Courses

The course seed targets the columns defined in 003_create_courses.sql. If the JSON course fixtures contain additional fields such as durationYears, institutionType, or counsellingRequired, map those fields explicitly in the import process or introduce a reviewed schema migration.

Colleges and universities

The college seed assumes unique slugs and the columns defined in 004_create_colleges_universities.sql. Verify that the university references are correct before using these records in application demonstrations.

Additional fixture fields such as ownership, admission details, course relationships, or contact information require explicit mapping if the SQL schema does not contain corresponding fields.

Demonstration applications

The demo seed requires the columns and status values supported by 005_create_applications.sql. It must not overwrite an existing application with the same application number, and it must verify the user’s, course’s, and college’s relationships before committing.

Troubleshooting

Duplicate-key errors

Check the unique indexes and identify which constraint triggered the conflict. Inspect the existing row before rerunning the seed.

Foreign-key errors

Confirm that prerequisite migrations and seeds completed successfully. Verify that referenced users, courses, universities, and colleges exist and that their identifiers match the expected records.

Missing columns or tables

Check the applied migrations and compare the seed SQL with the current schema. Do not resolve schema mismatches by arbitrarily removing required columns from a seed.

No rows inserted

Check whether the required synthetic user, course slug, or institution slug exists. An INSERT ... SELECT statement can complete without inserting a row if its selection criteria match nothing.

Transaction errors

Confirm that the affected tables use InnoDB. MySQL DDL statements may implicitly commit transactions; do not assume schema changes can be rolled back by a seed transaction.

Unexpected changes after repeated execution

Inspect the unique indexes and duplicate-key clauses. A no-op update prevents modification of the conflicting row, but it does not guarantee that the intended natural key caused the conflict.

Maintenance

Whenever database migrations or seed scripts change:

* Update the affected seed scripts and this README.
* Verify column names, data types, nullability, and allowed status values.
* Review unique indexes and foreign-key relationships.
* Confirm compatibility with the supported MySQL version.
* Test the full seed sequence against a clean development database.
* Test repeated execution for duplicate creation and unintended updates.
* Verify that fictional data remains distinguishable from production data.
* Update execution order and prerequisites when dependencies change.
* Review security-sensitive permission changes before merging.

Disclaimer

These seed scripts provide development and testing data only. They do not establish official admission information, verify real institutions, guarantee course eligibility, or constitute an official admission application. Course requirements and regulatory information must be verified independently through the relevant official authorities before publication.