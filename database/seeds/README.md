
# MedOrbits Database Seeds

**Directory:** `database/seeds/`  
**Database:** MySQL 8.0.16+  
**Storage engine:** InnoDB  
**Purpose:** Controlled development and automated-test data initialization

## 1. Overview

The seed scripts populate development and test databases with baseline roles, permissions, illustrative education courses, fictional institutions, and synthetic demonstration records.

Seed data is not authoritative admission information. Fictional institutions and illustrative catalogue records must never be represented as recognized, accredited, officially approved, or available for actual admission.

**Never run development seed scripts against production databases.**

## 2. Directory structure

```text
database/
└── seeds/
    ├── README.md
    ├── seed-roles.sql
    ├── seed-courses.sql
    ├── seed-colleges.sql
    ├── seed-demo-data.sql
    └── seed-development.sql
```

The scripts serve different purposes:

| Script | Purpose |
|—|—|
| `seed-roles.sql` | Creates baseline role definitions, permissions, and role-permission mappings. |
| `seed-courses.sql` | Creates illustrative education-course catalogue entries. |
| `seed-colleges.sql` | Creates fictional universities and colleges. |
| `seed-demo-data.sql` | Creates a synthetic demonstration application for an existing demo user. |
| `seed-development.sql` | Coordinates the development seed scripts. |

Check the actual repository before running a script; filenames alone do not guarantee that the corresponding migration or prerequisite data exists.

## 3. Prerequisites

Before running seeds:

- MySQL 8.0.16 or newer.
- Required schema migrations have been applied successfully.
- Seed-related tables use InnoDB.
- Appropriate unique constraints exist.
- The database is explicitly identified as a development or test database.
- The database account has only the privileges needed for the intended operation.
- A backup or disposable database snapshot is available when existing development data matters.

Expected schema dependencies include:

| Table | Typical dependency |
|—|—|
| `roles` | Role definitions |
| `permissions` | Permission definitions |
| `role_permissions` | Role-to-permission mappings |
| `user_roles` | Existing user-role assignments |
| `courses` | Course catalogue |
| `universities` | University catalogue |
| `colleges` | College catalogue |
| `users` | Synthetic applicant account |
| `applications` | Demo application |

**Important:** Column names and data types must match the actual migration files. In particular, confirm whether applications reference users through `applicant_id` or `user_id` before running `seed-demo-data.sql`.

## 4. Development database naming

The guarded seed scripts expect the database name to contain a delimited identifier such as:

```text
medorbits_dev
medorbits_development
medorbits_test
medorbits_testing
```

Examples that do not satisfy this naming convention include:

```text
medorbits
medorbits_production
medorbitsdev
```

The name check is a safety measure, not a security boundary. Use separate database credentials for production and development.

## 5. Enable development seeding

Connect to the intended development database using the MySQL command-line client:

```bash
mysql -u YOUR_DB_USER -p medorbits_dev
```

At the MySQL prompt, enable the session-level opt-in:

```sql
SET @medorbits_allow_development_seed = 1;
```

The opt-in is session-specific. A new database connection must set it again.

Run individual scripts as needed:

```sql
SOURCE database/seeds/seed-roles.sql;
SOURCE database/seeds/seed-courses.sql;
SOURCE database/seeds/seed-colleges.sql;
```

The `SOURCE` command is a MySQL client directive. It is not a SQL statement and cannot be submitted directly as a normal query through a Node.js database driver.

## 6. Recommended execution order

Apply schema migrations first, then execute seed scripts in dependency order.

1. Apply the user, role, permission, course, university, college, and application migrations required by the project.
2. Run `seed-roles.sql`.
3. Run `seed-courses.sql`.
4. Run `seed-colleges.sql`.
5. Create or provision the synthetic applicant using a separate development fixture workflow.
6. Run `seed-demo-data.sql` after verifying its expected schema and prerequisites.
7. Verify the resulting records and relationships.

Do not assume that the seed scripts create prerequisite users or that they activate fictional colleges. The college seed may intentionally create inactive records, which should not be made eligible for real application workflows.

## 7. Development orchestrator

`seed-development.sql` is intended to coordinate the baseline role and catalogue seeds.

Before using it, inspect its `SOURCE` statements and confirm that every referenced file exists. The orchestrator must use the same MySQL client session in which the development opt-in was set.

Example:

```sql
SET @medorbits_allow_development_seed = 1;
SOURCE database/seeds/seed-development.sql;
```

The orchestrator is not an atomic transaction across all scripts. If a later script fails, earlier scripts may already have committed their changes.

Run the scripts individually when diagnosing failures.

## 8. Seed script responsibilities

### `seed-roles.sql`

Creates the baseline roles:

- `user`
- `admin`
- `counsellor`
- `employer`

It also creates baseline permissions and maps permissions to roles.

Security requirements:

- Never assign the `admin` role automatically to a user.
- Protect role-management operations with server-side authorization.
- Validate authorization on every protected request.
- Keep privileged actions, including refunds and permission changes, auditable.
- Review role mappings before using them in a deployed environment.

The seed may add missing role-permission mappings but should not silently overwrite conflicting role or permission definitions.

### `seed-courses.sql`

Creates illustrative entries for courses such as:

- MBBS
- BDS
- BAMS
- Bachelor of Pharmacy
- BSc Nursing
- BTech Computer Science
- Medical Laboratory Technology
- Physiotherapy
- Radiology and Imaging Technology
- MBA
- MSc Data Science
- BBA

Durations and admission fields are sample metadata. They must be checked against current official rules before being used in public admission guidance.

A non-null `entrance_exam` identifies a sample value; a null value means unspecified in the seed, not necessarily that no entrance examination applies.

### `seed-colleges.sql`

Creates fictional universities and colleges for testing catalogue and application workflows.

These records are not evidence of institutional recognition, accreditation, affiliation, regulatory approval, admission capacity, or eligibility.

Keep fictional institutions inactive by default unless a dedicated test explicitly requires an active fixture.

### `seed-demo-data.sql`

Creates a synthetic demonstration application for an existing synthetic user.

Expected prerequisite:

```text
demo-applicant@example.invalid
```

The `.invalid` domain is reserved for invalid/example use and should not be used for real communication.

Before execution, verify:

- The synthetic user exists and is not deleted.
- The required course exists.
- The fictional college exists.
- The application schema uses the expected foreign-key column names.
- The configured application status is allowed by the migration.
- The application number and public UUID do not conflict with unrelated records.

The demo application must not be treated as a real admission application or used to trigger real notifications, payments, or external submissions.

## 9. Idempotency and conflict handling

Seed scripts should be safe to rerun when their prerequisites remain unchanged.

Recommended practices:

- Define unique constraints for stable slugs and public identifiers.
- Use deterministic identifiers for known fixtures.
- Avoid updating existing rows merely to make a seed run succeed.
- Verify existing records against the expected fixture definition.
- Roll back when required records or relationships do not match.
- Avoid deleting user-created development data as part of routine seeding.

`ON DUPLICATE KEY UPDATE id = id` prevents ordinary updates to duplicate rows, but MySQL can trigger duplicate-key handling because of any unique constraint. It does not prove that the existing row is the intended fixture. Explicit validation is still required.

## 10. Transaction and failure handling

Seed scripts should use transactions for related writes and must use transactional storage engines.

An exception handler that calls `ROLLBACK` and `RESIGNAL` allows database errors to propagate to the client.

Remember:

- DDL statements may cause implicit commits.
- Stored procedure creation and removal are not part of the data transaction.
- Separate seed scripts may commit independently.
- A failure in a later script does not automatically reverse an earlier successful script.
- Concurrent seed executions can race unless uniqueness constraints and suitable locking protect the relevant records.

If a script fails, read the MySQL error, verify the current database, and inspect the affected rows before retrying.

## 11. Verification queries

### Verify baseline roles

```sql
SELECT id, name, display_name, is_system
FROM roles
WHERE name IN (‘user’, ‘admin’, ‘counsellor’, ‘employer’)
ORDER BY name;
```

### Verify role-permission mappings

```sql
SELECT
    r.name AS role_name,
    p.name AS permission_name
FROM role_permissions AS rp
JOIN roles AS r
    ON r.id = rp.role_id
JOIN permissions AS p
    ON p.id = rp.permission_id
ORDER BY r.name, p.name;
```

### Verify courses

```sql
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
```

### Verify college relationships

```sql
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
```

### Verify demo application

Adapt `applicant_id` if the actual schema uses another foreign-key column.

```sql
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
```

## 12. Troubleshooting

| Error | Likely cause | Recommended action |
|—|—|—|
| No database selected | No schema was selected | Connect to the intended development database. |
| Development seed blocked | Session opt-in missing | Set the opt-in variable in the same MySQL session. |
| Database name rejected | Name does not match the guard | Use a clearly named development/test database. |
| Table doesn’t exist | Migration not applied | Apply and verify the prerequisite migration. |
| Unknown column | Seed and schema disagree | Compare the script with the actual migration. |
| Duplicate entry | A unique value conflicts | Inspect the existing row; do not delete it blindly. |
| Foreign-key violation | Referenced fixture is missing | Seed or provision the prerequisite record first. |
| Course or college conflict | Existing fixture differs from the expected definition | Inspect the row and resolve it deliberately. |
| Transaction rollback | Validation or SQL statement failed | Fix the underlying issue before retrying. |

## 13. Security and data privacy

- Never place real applicant data, passwords, API keys, payment information, or identity documents in seed files.
- Do not use real email addresses or telephone numbers for synthetic users.
- Do not grant administrative roles to users as a convenience during seeding.
- Do not expose internal IDs, personal details, or privileged audit information in public catalogue endpoints.
- Ensure demo data cannot initiate real email, SMS, payment, admission, or recruitment workflows.
- Use separate development credentials and restrict their database privileges.
- Keep seed scripts reviewed and version-controlled.

## 14. Production policy

**Development seeds are not production migrations.**

Do not automatically execute these files during production startup, deployment, or application boot.

Production reference data should be managed through reviewed migrations or controlled administrative workflows. If a production bootstrap is required, design a separate process with explicit approvals, backups, audit logging, and narrowly scoped permissions.

## 15. Maintenance checklist

Before adding or changing a seed:

- [ ] Confirm the target migration and column definitions.
- [ ] Add stable identifiers and appropriate unique constraints.
- [ ] Keep synthetic records clearly labelled.
- [ ] Validate conflicting existing records.
- [ ] Preserve user-created data.
- [ ] Test the seed on a disposable development database.
- [ ] Verify relationships and foreign keys.
- [ ] Confirm rerunning the seed is safe.
- [ ] Review permissions for least privilege.
- [ ] Ensure production deployment never runs development seeds.

—

**Maintainer note:** Keep this README aligned with the actual migration files and seed scripts. If the schema changes, update the prerequisites, execution order, and verification queries together.
