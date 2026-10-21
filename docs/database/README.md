
# MedOrbits Database Documentation

**Project:** MedOrbits  
**Database:** MySQL, subject to deployment verification  
**Directory:** `docs/database/`  
**Purpose:** Provide a central entry point for database schema documentation, migration procedures, persistence conventions, and data-integrity requirements.

## 1. Overview

This documentation describes the intended persistence architecture for MedOrbits, including relational schema design, database migrations, data integrity, indexing, security, and operational recovery.

It establishes conventions for managing database changes consistently across development, testing, staging, and production environments.

**Source of truth:** The actual SQL definitions, migration files, migration execution history, and verified deployed database schema determine what is implemented. Documentation alone does not establish that a table, column, index, constraint, or relationship exists.

## 2. Documentation Structure

Recommended documentation layout:

```text
docs/
└── database/
    ├── README.md
    ├── schema.md
    └── migrations.md
```

The following resources may also exist elsewhere in the repository:

```text
database/
├── migrations/
├── schema/
├── seeds/
└── fixtures/
```

These are reference locations, not a verified inventory. Use the actual repository paths and the migration runner’s established conventions.

| Document | Responsibility |
|—|—|
| `README.md` | Database documentation entry point and navigation |
| `schema.md` | Data-model principles, entities, relationships, constraints, and indexing |
| `migrations.md` | Migration creation, review, testing, execution, tracking, and recovery |
| `schema.sql`, if present | SQL schema definition, subject to its actual purpose and maintenance policy |
| Migration directory | Version-controlled database changes in the runner’s defined order |

## 3. Database Standards

### 3.1 Schema management

- Store schema changes in version control.
- Use uniquely identified migrations with deterministic ordering.
- Maintain referential integrity through appropriate keys and constraints.
- Define nullability, defaults, uniqueness, and deletion behavior deliberately.
- Document important relationships and domain invariants.
- Keep schema documentation synchronized with verified implementation.
- Avoid undocumented manual schema changes.

### 3.2 Data types and precision

- Use appropriate MySQL data types for each domain.
- Represent monetary values using integer minor units or an appropriate exact `DECIMAL` type.
- Avoid floating-point types for financial amounts.
- Define timestamp, timezone, and date-only conventions.
- Choose identifier types consistently and document any exceptions.
- Define appropriate length limits for text and identifier fields.
- Consider character sets and collations, especially for names, search, and case-insensitive uniqueness.

### 3.3 Indexing and performance

- Index primary keys and frequently queried relationship columns where appropriate.
- Use unique constraints for invariants that must hold under concurrent requests.
- Design composite indexes around actual filtering and ordering patterns.
- Review query plans and measured performance before adding or removing indexes.
- Consider index size, write overhead, locking, and deployment impact.
- Avoid adding indexes solely because a column appears important without considering its query patterns.

### 3.4 Data integrity

- Use foreign keys where appropriate to enforce relationships.
- Define deletion and update behavior explicitly.
- Use transactions for related changes that must succeed or fail together.
- Enforce critical invariants in the database when practical, in addition to application validation.
- Apply concurrency controls where simultaneous operations could produce inconsistent results.
- Test migrations and constraints against the supported MySQL version and storage engine.

## 4. Security and Privacy

Database design must protect credentials, authentication data, personal information, application records, payment references, and private document metadata.

Requirements:

- Keep database credentials outside source control.
- Use parameterized queries or a suitable database abstraction.
- Apply least-privilege database accounts.
- Separate application runtime permissions from schema-migration permissions where practical.
- Store passwords using an appropriate password-hashing algorithm; never store plaintext passwords.
- Avoid storing sensitive information that the application does not need.
- Restrict access to production databases, backups, exports, and migration records.
- Use synthetic data for development fixtures and automated tests.
- Apply documented retention and deletion rules.
- Avoid exposing database errors, internal identifiers, or sensitive fields in public API responses.

Do not assume that a documented security control is implemented until the actual configuration and code have been verified.

## 5. Migration Management

All schema changes must follow the project’s documented migration process.

The migration workflow should cover:

1. Creating a uniquely identified migration.
2. Reviewing SQL and operational risks.
3. Testing against an empty database.
4. Testing against representative staging data.
5. Assessing application compatibility.
6. Applying migrations through an approved process.
7. Recording execution status.
8. Verifying the resulting schema and data integrity.
9. Preparing recovery procedures for high-risk changes.

Never assume a failed migration left the database unchanged. Database DDL operations may not be fully reversible or transactionally atomic.

See `migrations.md` for the detailed migration standard.

## 6. Source of Truth and Verification

Before relying on a documented table, column, index, constraint, or relationship:

1. Inspect the relevant SQL schema files, including `schema.sql` if present.
2. Review migration files in their defined execution order.
3. Confirm the migration runner and its recorded execution history.
4. Verify the deployed schema through an approved, read-only inspection process where possible.
5. Compare the actual schema with the expected application model.
6. Update documentation when the verified structure or migration conventions change.

Do not assume that all migration files have been applied, that a schema dump represents the deployed database, or that a migration-history record alone proves the physical schema is correct.

Production inspection must follow the project’s access-control and change-management procedures.

## 7. Backup and Recovery

Maintain backup and recovery procedures appropriate to the business impact and recovery objectives.

Where applicable, document:

- Backup method and schedule.
- Backup retention and access controls.
- Encryption and storage requirements.
- Recovery point objective (RPO).
- Recovery time objective (RTO).
- Restore procedures and responsible operators.
- Migration recovery and forward-repair procedures.
- Restore-test results and outstanding limitations.

A successful backup job does not by itself prove recoverability. Test restoration through an approved process.

## 8. Testing and Continuous Integration

Where supported by the project, automate:

- Migration naming and ordering checks.
- Migration execution against a disposable MySQL database.
- Schema and constraint verification.
- Repository and service integration tests.
- Data-integrity checks.
- Compatibility checks for application changes.
- Validation of database documentation and referenced paths.

Use the database version and relevant configuration supported by MedOrbits. Do not run destructive tests against production resources.

## 9. Maintenance Responsibilities

When database structure or conventions change:

- Update `schema.md` when data-model documentation changes.
- Update `migrations.md` when migration procedures or safeguards change.
- Update this README when documentation locations or responsibilities change.
- Update migrations and tests alongside the related application changes.
- Review API and service contracts affected by schema changes.
- Verify that examples and references match the actual repository.
- Never include database credentials, production exports, or private user data in documentation.

## 10. Maintenance Checklist

- [ ] Database engine and supported version are verified.
- [ ] Schema documentation reflects the verified database structure.
- [ ] Migration files use the project’s established naming and ordering.
- [ ] Migration history and deployed schema are consistent.
- [ ] Keys, constraints, and indexes support required integrity and query patterns.
- [ ] Financial and timestamp data types follow documented conventions.
- [ ] Database access follows least-privilege principles.
- [ ] Secrets and private production data are excluded from version control.
- [ ] Migrations are tested before production deployment.
- [ ] Backup and recovery procedures are documented and tested as appropriate.
- [ ] Related API, service, and test documentation is synchronized.
- [ ] All referenced paths exist or are explicitly identified as planned.

## 11. Related Documentation

- `schema.md` — Data-model design, relationships, constraints, and indexing.
- `migrations.md` — Migration workflow, production safeguards, and recovery.
- `schema.sql`, if present — SQL schema definition.
- The repository’s actual migration directory — Versioned SQL changes.
- `docs/architecture/` — System architecture and application data flows.
- `docs/api/` — API contract and request/response documentation.

Use canonical repository paths and avoid maintaining duplicate definitions of the same schema or migration procedure.

## 12. Definition of Done

A database documentation change is complete when:

1. The referenced resources have been verified.
2. The documented conventions match the actual database tooling.
3. Related schema and migration documentation is synchronized.
4. Relevant automated checks pass.
5. Security, privacy, and recovery implications have been reviewed.
6. Unverified assumptions are clearly identified.

**Accuracy principle:** Database documentation describes conventions and intended design. Actual SQL definitions, migration execution history, and the verified deployed schema determine what is implemented.
