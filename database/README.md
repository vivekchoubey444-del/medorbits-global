
# MedOrbits — Database Architecture and Operations

**Directory:** `/database/`  
**Project:** MedOrbits — Education, Admissions, Careers, and Recruitment  
**Purpose:** Document database structure, migrations, seed data, queries, fixtures, and safe database operations.  
**Backend:** Node.js 20+ with Express.js  
**Database:** PostgreSQL (primary architecture; confirm against the deployed environment)  
**Encoding:** UTF-8  
**Data policy:** Validate inputs, enforce access controls, and protect personal information.

—

## 1. Overview

The `/database/` directory contains database-related resources used by MedOrbits backend services, automated tests, development tooling, and deployment workflows.

It provides a structured location for:

- Database migrations and schema definitions.
- Seed scripts for controlled initialization.
- SQL queries and reusable database operations.
- Synthetic fixtures for development and automated tests.
- Database test data and integrity checks.
- Documentation for database setup, maintenance, and recovery.

Database resources must remain consistent with the backend’s actual data models, API contracts, and authorization policies.

**Important:** Database constraints and application-level validation complement one another. Neither replaces authentication, authorization, secure query construction, transaction management, or operational safeguards.

## 2. Directory Structure

The following is the recommended structure. Keep only directories and files that exist in the repository, and update this documentation as the project evolves.

```text
database/
├── README.md
├── migrations/
│   └── README.md
├── seeds/
│   └── README.md
├── queries/
│   ├── README.md
│   ├── applications.sql
│   ├── jobs.sql
│   └── users.sql
├── fixtures/
│   ├── README.md
│   ├── applications.fixture.json
│   ├── colleges.fixture.json
│   ├── courses.fixture.json
│   ├── documents.fixture.json
│   ├── payments.fixture.json
│   ├── roles-permissions.fixture.json
│   ├── subscriptions.fixture.json
│   └── users.fixture.json
└── tests/
    └── README.md
```

The names above describe the intended organization, not a guarantee that every listed file currently exists.

### Directory responsibilities

| Directory | Responsibility |
|—|—|
| `migrations/` | Version-controlled database structure changes |
| `seeds/` | Controlled initialization of required reference or development data |
| `queries/` | Reusable, reviewed SQL statements |
| `fixtures/` | Synthetic test records and automated-test scenarios |
| `tests/` | Database integration tests and integrity checks |

Keep production database credentials, backups, generated dumps, and private user data outside the version-controlled source tree.

## 3. Database Engine and Configuration

The MedOrbits backend architecture identifies PostgreSQL as the primary database.

Before running database operations, verify the actual engine, version, schema, connection configuration, and migration history used by the target environment.

Do not assume that SQL written for PostgreSQL is interchangeable with MySQL. Differences may include:

- Data types and auto-generated identifiers.
- JSON operations and constraints.
- Upsert syntax.
- Transaction and locking behavior.
- Date and timestamp semantics.
- Index definitions.
- Migration syntax and error handling.

Existing SQL files must be reviewed against the configured database engine before execution.

### Environment configuration

Use environment variables or a trusted secrets manager for database credentials.

Common configuration variables may include:

```text
DATABASE_URL
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
DB_SSL
```

The exact variables depend on the database client and deployment configuration. Do not define conflicting connection sources without documenting precedence.

Security requirements:

- Never commit real database credentials.
- Never print connection strings containing passwords.
- Use separate databases or credentials for development, testing, staging, and production.
- Restrict database network access.
- Use TLS where required by the deployment environment.
- Apply least-privilege database roles.
- Use a dedicated test database for automated integration tests.

## 4. Database Schema and Migrations

Database migrations are the authoritative, version-controlled mechanism for changing database structure.

A migration may create or alter:

- Tables and columns.
- Primary and foreign keys.
- Unique constraints.
- Check constraints.
- Indexes.
- Database views.
- Required reference data.
- Carefully controlled database functions or triggers.

### Migration requirements

Every migration should:

1. Have a unique, ordered identifier.
2. Describe its intended change.
3. Be reviewed before deployment.
4. Preserve data unless data removal is explicitly required.
5. Include appropriate constraints and indexes.
6. Be tested against a representative database.
7. Document rollback or recovery considerations.
8. Avoid embedding secrets or environment-specific credentials.

Do not modify an already-applied migration in a way that changes its historical effect. Add a new migration to correct or extend an existing schema.

### Data integrity

Use database constraints for rules that must hold regardless of which application process writes the data.

Examples include:

- Primary-key uniqueness.
- Required values and non-null constraints.
- Foreign-key relationships.
- Unique email or other identifiers where required.
- Valid monetary ranges.
- Consistent ownership references.
- Allowed status values where appropriate.

Use transactions for related writes that must succeed or fail together.

## 5. Query Management

Reusable SQL belongs in `/database/queries/` where that organization fits the application’s database layer.

Expected query files include:

- `applications.sql` — application retrieval, creation, review, and status operations.
- `jobs.sql` — job listings, employer operations, and job application queries.
- `users.sql` — user lookup, profile management, and administrative operations.

Confirm that these files exist and match the current schema before using them.

### Query safety

- Use parameterized queries for all untrusted values.
- Never concatenate user input into SQL statements.
- Use transactions for multi-step operations requiring atomicity.
- Apply ownership and authorization filters in the relevant query or service.
- Use pagination for potentially large result sets.
- Select only the columns needed by the caller.
- Avoid exposing sensitive fields in public API responses.
- Review query plans for expensive operations.
- Add indexes based on measured workload and execution plans.

Parameterized queries protect values, but table names, column names, and sort directions often require separate allowlists when dynamically selected.

### Schema alignment

Queries must match the deployed database schema, including:

- Table and column names.
- Nullability.
- Status enums or check constraints.
- Soft-deletion behavior.
- Foreign-key relationships.
- Timestamp conventions.
- Transaction and concurrency requirements.

Do not deploy example queries until their schema assumptions have been verified.

## 6. Seed Data

Seed scripts initialize required reference data or controlled development records.

Appropriate uses may include:

- Required lookup values.
- Non-sensitive system configuration.
- Synthetic development examples.
- Test-only accounts in an isolated environment.

Seed scripts should be deterministic where practical and should document whether they are safe to rerun.

### Seed-data safeguards

- Separate production-safe reference data from development-only data.
- Never seed synthetic users or fake transactions into production.
- Avoid embedding privileged credentials in seed files.
- Use controlled, explicit environment checks.
- Validate the target database before writing.
- Use transactions where appropriate.
- Avoid overwriting existing user data unexpectedly.

Production reference-data seeding must use reviewed, authoritative values. Synthetic fixture records must not be treated as production catalogue data.

## 7. Fixtures and Automated Testing

The `/database/fixtures/` directory contains synthetic records for development and automated testing.

See `/database/fixtures/README.md` for the fixture inventory, conventions, validation requirements, and production restrictions.

Expected fixture files include:

| File | Purpose |
|—|—|
| `applications.fixture.json` | Application workflow scenarios |
| `colleges.fixture.json` | Synthetic college and institution records |
| `courses.fixture.json` | Course catalogue test records |
| `documents.fixture.json` | Document metadata and review states |
| `payments.fixture.json` | Payment, failure, and refund scenarios |
| `roles-permissions.fixture.json` | Authorization and permission test definitions |
| `subscriptions.fixture.json` | Subscription lifecycle scenarios |
| `users.fixture.json` | Synthetic users and account states |

Treat this list as the intended inventory and verify it against the actual directory.

### Fixture requirements

- Use clearly synthetic identifiers such as `USR-TEST-0001`.
- Use `.invalid` email addresses for synthetic accounts.
- Include fixture metadata where supported by the relevant schema.
- Keep identifiers unique within each collection.
- Maintain valid references between related records.
- Use consistent monetary units and timestamps.
- Separate intentionally invalid test cases from valid seed data.
- Keep real personal information and secrets out of fixtures.

Fixture IDs may differ from database primary keys. Fixture loaders should maintain an explicit mapping between fixture identifiers and persisted records.

### Cross-file integrity

Automated checks should verify, where applicable:

- Applications reference existing users, colleges, and courses.
- Documents reference valid users and applications.
- Payments reference valid users and applicable application or subscription records.
- Subscription ownership matches payment ownership.
- Reviewer IDs refer to authorized test users.
- Assigned role permissions exist in the permission registry.

Negative tests may deliberately use missing or mismatched references. Mark these cases clearly so they are not accidentally used as valid seed data.

## 8. JSON Schema Validation

Canonical JSON Schemas are maintained under `/schemas/`.

Fixture schemas may include:

- `application-fixture.schema.json`
- `college-fixture.schema.json`
- `course-fixture.schema.json`
- `document-fixture.schema.json`
- `payment-fixture.schema.json`
- `roles-permissions-fixture.schema.json`
- `subscription-fixture.schema.json`
- `user-fixture.schema.json`

Only treat a schema as available after confirming the corresponding file exists.

Use a validator that supports JSON Schema Draft 2020-12. Configure format validation where the application depends on it.

Schema validation can verify structural requirements, but it does not establish:

- Referential integrity across multiple files.
- The authenticity of a college or document.
- The legitimacy of an admission decision.
- Completion of a real payment.
- Authorization to access a record.

Implement cross-file and domain validation in dedicated scripts, services, database constraints, and tests.

If `/api/schemas/` also contains schema definitions, maintain a documented canonical source of truth and automated synchronization or consistency checks.

## 9. Database Transactions and Concurrency

Use transactions when multiple operations must be atomic.

Examples include:

- Creating an application and its related records.
- Updating an application status and recording the corresponding audit event.
- Recording a payment state transition and its internal ledger entry.
- Applying subscription changes and entitlement records.
- Updating role assignments and associated audit events.

The exact transaction boundary depends on the domain and database architecture.

### Concurrency safeguards

- Use appropriate unique constraints to prevent duplicate records.
- Use idempotency controls for operations that may be retried.
- Protect state transitions against concurrent updates.
- Use row locking or optimistic concurrency controls where necessary.
- Avoid holding transactions open during slow external API calls.
- Treat payment-provider webhooks as retryable, potentially duplicated events.
- Reconcile provider state with internal records through controlled processes.

Never grant access to paid features solely because a client supplied a successful payment status.

## 10. Security and Privacy

Database access must follow least-privilege principles.

### Access control

- Use separate database roles for application access, migrations, reporting, and operations where appropriate.
- Restrict write permissions to the tables and operations required by each role.
- Keep migration credentials separate from routine application credentials.
- Protect administrative and audit data.
- Enforce authorization at the application layer as well as appropriate database boundaries.
- Validate record ownership and assignment relationships.

### Sensitive information

- Collect and retain only information required for the stated purpose.
- Avoid storing plaintext passwords.
- Use the application’s approved password-hashing implementation.
- Never store raw payment-card details or security codes.
- Do not log credentials, tokens, or complete records containing unnecessary personal information.
- Apply appropriate retention, archival, and deletion policies.
- Restrict access to database backups and exports.

### Logging and auditing

Audit events may be appropriate for sensitive actions, including:

- Role assignments.
- Account suspensions.
- Application status changes.
- Document review decisions.
- Payment reconciliation.
- Subscription entitlement changes.
- Administrative access to protected records.

Avoid logging secrets or unnecessary personal information. Protect audit logs against unauthorized modification and access.

## 11. Payment and Subscription Integrity

Payment and subscription records require additional safeguards.

- Store amounts using a documented, consistent currency-unit convention.
- Validate currency and monetary boundaries.
- Keep provider order identifiers distinct from payment identifiers.
- Verify webhook signatures and relevant provider event data.
- Make repeated webhook processing safe through idempotency controls.
- Prevent cumulative refunds from exceeding the original payment amount.
- Reconcile payment and refund states with the provider.
- Record authorized state transitions.
- Do not expose provider secrets to clients.
- Do not use fixture statuses to grant real entitlements.

Database status fields describe internal state; they do not independently prove a provider transaction occurred.

## 12. Backups and Recovery

Database backup and recovery procedures should be documented and tested separately from application deployment.

Recommended controls:

- Schedule backups according to business recovery requirements.
- Encrypt backups where appropriate.
- Restrict backup access.
- Store copies separately from the primary database.
- Define retention periods.
- Test restoration procedures periodically.
- Document recovery objectives and escalation responsibilities.
- Protect exports from accidental exposure.

A successful backup job does not prove that recovery will work. Perform restoration tests in a controlled environment.

Never use a production backup as an ordinary fixture file or commit database dumps containing real personal information to source control.

## 13. Testing and Continuous Integration

Database-related CI checks should include:

1. Validate JSON fixture syntax.
2. Compile the applicable JSON Schemas.
3. Validate fixtures against their schemas.
4. Check identifier uniqueness.
5. Check cross-file references and ownership consistency.
6. Run migration tests against a clean database.
7. Run query and repository integration tests.
8. Test transaction rollback behavior.
9. Test authorization and denied-access cases.
10. Test payment idempotency and refund boundaries.
11. Confirm test cleanup does not affect non-test databases.
12. Detect accidental inclusion of secrets or production data.

Run integration tests against an isolated database instance with controlled credentials.

Do not run destructive test cleanup against a shared development database or production database.

## 14. Operational Commands

Commands depend on the project’s actual package scripts and database tooling. Verify `package.json`, migration configuration, and environment variables before using them.

Examples of common workflows are:

```bash
# Install project dependencies
npm ci

# Inspect available project scripts
npm run

# Run the configured test suite, if defined
npm test
```

If the project defines a fixture validation command, run that exact command. Do not assume `npm run validate:fixtures` exists until it is configured.

Before any migration or seed operation:

1. Confirm the target environment.
2. Confirm the database connection.
3. Review the migration or seed script.
4. Verify backup and rollback requirements for the operation.
5. Execute with the minimum required privileges.
6. Confirm the resulting database state.

## 15. Contribution Guidelines

When changing database resources:

1. Follow existing naming conventions.
2. Update migrations rather than editing historical migrations already applied in shared environments.
3. Keep queries aligned with the actual schema.
4. Use parameterized SQL.
5. Add appropriate constraints and indexes.
6. Update fixture data and schemas together when their contracts change.
7. Preserve synthetic-data markers in test fixtures.
8. Add positive, negative, and boundary tests.
9. Document migration and compatibility risks.
10. Review security and privacy implications.
11. Update this README when the directory structure or operational process changes.
12. Confirm that all documented files and commands exist.

## 16. Troubleshooting

### Migration failure

- Inspect the migration error and database logs.
- Confirm the target database and migration state.
- Check dependencies between migrations.
- Verify schema compatibility and required privileges.
- Avoid manually marking a failed migration as successful without confirming its effects.

### Foreign-key or reference failure

- Confirm the referenced record exists.
- Check fixture identifier mappings.
- Verify that records are inserted in the correct order.
- Review whether the relationship is mandatory or optional.
- Keep intentionally invalid cases in dedicated negative tests.

### Fixture validation failure

- Parse the JSON to locate syntax errors.
- Confirm the referenced schema path.
- Check required fields, enums, types, and additional properties.
- Verify schema draft compatibility.
- Check cross-file relationships separately from schema validation.

### Duplicate records

- Check unique constraints and fixture identifiers.
- Review seed-script idempotency.
- Use database transactions and appropriate upsert logic where intended.
- Do not suppress uniqueness violations without understanding their cause.

### Unexpected payment or subscription state

- Inspect the internal state-transition history.
- Confirm webhook verification and idempotency handling.
- Reconcile against trusted provider data.
- Never resolve a production discrepancy by copying a synthetic fixture state.

## 17. Maintenance

Review this directory whenever:

- A database model or migration changes.
- An API contract changes.
- A new resource or relationship is introduced.
- A query is added or modified.
- A fixture structure changes.
- Payment or subscription workflows change.
- Authorization or privacy requirements change.
- Backup or recovery procedures change.
- The deployed database engine or configuration changes.

Keep this README aligned with the actual directory structure, deployed schema, migration tooling, and CI pipeline.

—

**Maintainer:** MedOrbits Engineering  
**Directory:** `/database/`  
**Primary database:** PostgreSQL, subject to deployment verification  
**Required controls:** Version-controlled migrations, parameterized queries, isolated fixtures, referential-integrity checks, automated tests, and least-privilege access  
**Production restriction:** Synthetic fixtures must never be treated as authoritative production data
