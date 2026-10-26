
# MedOrbits Database Schema Overview

**Project:** MedOrbits  
**Recommended location:** `docs/database/schema.md`  
**Database:** MySQL, subject to deployment verification  
**Purpose:** Document intended data domains, relational design standards, security requirements, data integrity, and schema verification.

**Status:** Architecture reference. Verify all entities, constraints, indexes, and relationships against the actual database implementation.

## 1. Overview

MedOrbits is designed to support education consultancy, admissions guidance, career services, recruitment, user accounts, applications, payments, subscriptions, and related platform operations.

This document describes the intended data model and establishes standards for relational schema design, consistency, security, and maintenance.

The domains below are conceptual. They do not establish that every table, column, constraint, or relationship has been implemented.

**Sources of truth:**

1. Actual SQL schema definitions, including `database/schema.sql`, if present.
2. Version-controlled database migrations and their execution history.
3. The configured database engine and version.
4. The verified deployed database schema.

Application models and documentation are useful references but do not independently prove that a database object exists.

## 2. Intended Data Domains

The following domains describe expected business responsibilities, not a confirmed inventory of database tables.

### 2.1 Identity and Access Management

Potential entities:

- Users and account profiles.
- Roles and permissions.
- Sessions and authentication-related records.
- Account verification and recovery records.
- Authentication event references, where required.

Design requirements:

- Enforce authorization on the server.
- Protect password hashes, session identifiers, and recovery tokens.
- Apply appropriate uniqueness constraints to account identifiers.
- Define session expiration and account-recovery rules.
- Restrict access to privileged operations.
- Avoid retaining authentication secrets in logs.

### 2.2 Education and Admissions

Potential entities:

- Courses and course categories.
- Colleges and universities.
- Admission requirements and eligibility criteria.
- Student enquiries and applications.
- Institution-to-course relationships.

Design requirements:

- Use stable identifiers.
- Define institution and course relationships explicitly.
- Validate admission-related information before persistence.
- Track data provenance and effective dates where information changes over time.
- Avoid treating imported or unverified education data as authoritative without an appropriate validation process.

### 2.3 Applications and Documents

Potential entities:

- Application records and lifecycle statuses.
- Application-to-user relationships.
- Private document metadata.
- Document ownership and access permissions.
- Document verification and processing status.
- Application status history, where required.

Design requirements:

- Protect personal and educational records.
- Keep private document metadata separate from public website assets.
- Store private files using an appropriately secured storage mechanism.
- Enforce authorization for every document retrieval or modification.
- Define retention, deletion, and audit requirements.
- Preserve status history where required for operational or compliance purposes.

### 2.4 Careers and Recruitment

Potential entities:

- Job listings and employers.
- Candidate profiles.
- Job applications.
- Internships and internship applications.
- Recruitment and career-service records.

Design requirements:

- Define resource ownership and access permissions.
- Prevent unauthorized access to candidate information.
- Validate employer identity and permissions before publishing listings.
- Define permitted application-state transitions.
- Consider status history and retention requirements.

### 2.5 Payments and Subscriptions

Potential entities:

- Payment attempts and internal transaction references.
- Subscription records and lifecycle statuses.
- Payment-provider references.
- Refund and reconciliation records, where supported.
- Subscription entitlements and billing history, where required.

Design requirements:

- Store monetary values using integer minor units or an appropriate exact decimal type.
- Record currency explicitly.
- Keep internal transaction identifiers separate from provider references.
- Enforce uniqueness for provider event identifiers or transaction references where appropriate.
- Derive payment status from trusted server-side verification.
- Make payment processing idempotent.
- Protect financial and subscription records through authorization controls.

Do not store full payment-card data unless a specifically reviewed architecture and applicable compliance requirements permit it. Prefer provider-hosted checkout or tokenized payment methods where appropriate.

### 2.6 Notifications and Audit Records

Potential entities:

- Notification records and delivery status.
- User notification preferences.
- Audit events for security-sensitive operations.
- Operational event references.

Design requirements:

- Collect only the information required for the notification or audit purpose.
- Define retention periods.
- Restrict access to audit records.
- Avoid logging passwords, session tokens, recovery tokens, or payment secrets.
- Distinguish an attempted operation from a successfully committed operation.
- Record sufficient information to investigate relevant security events without collecting unnecessary personal data.

## 3. Relational Design Standards

### 3.1 Primary keys

Every persistent entity should have a clearly defined primary key.

Choose key types consistently and document exceptions. If externally exposed identifiers differ from internal database keys, document their purpose and uniqueness requirements.

Do not expose sequential internal identifiers unnecessarily where doing so creates privacy or enumeration risks.

### 3.2 Foreign keys and referential integrity

Use foreign keys where appropriate to enforce valid relationships.

Document:

- Referencing and referenced columns.
- Required or optional relationships.
- Expected deletion and update behavior.
- Whether cascading operations are permitted.
- Indexing requirements for relationship columns.

Avoid cascading deletion where it could unintentionally remove financial, audit, or legally required records.

### 3.3 Unique constraints

Use database-level unique constraints for values that must not be duplicated.

Potential examples include:

- Normalized account identifiers.
- Institution codes.
- Internal payment references.
- Provider event identifiers.
- Subscription or external-resource identifiers where applicable.

Account for case sensitivity, normalization, nullable values, collation, and the behavior of the configured MySQL version.

Application-level validation does not replace database constraints when uniqueness must hold under concurrent requests.

### 3.4 Indexing

Design indexes based on actual queries and measured workload.

Review:

- Frequent lookup and filtering conditions.
- Join columns and foreign-key access patterns.
- Sorting and pagination paths.
- Unique constraints.
- Query execution plans.
- Index size and write overhead.
- Index creation and maintenance costs.

Avoid adding indexes without considering their actual benefit and operational impact.

### 3.5 Transactions and concurrency

Use database transactions for related changes that must succeed or fail together, where supported.

For concurrent operations, evaluate:

- Unique constraints.
- Locking and isolation levels.
- Conditional updates.
- Optimistic concurrency controls.
- Idempotency requirements.
- Deadlock detection and retry behavior.

Payment callbacks, repeated requests, and retryable jobs must not apply the same financial or business change more than once.

## 4. Data Types and Consistency

### 4.1 Monetary values

Use integer minor units or an appropriate exact `DECIMAL` type for currency. Never use floating-point types for financial calculations.

Document:

- Currency representation.
- Decimal scale or minor-unit convention.
- Rounding rules.
- Treatment of taxes, discounts, refunds, and adjustments.

Do not assume all currencies use the same number of minor units.

### 4.2 Timestamps and time zones

Define consistent conventions for timestamps, date-only values, and scheduled local times.

For example, an application may store event timestamps in UTC and convert them to a user’s local time for display. Confirm the actual application and database conventions before adopting this as a universal rule.

Document relevant MySQL `DATE`, `DATETIME`, and `TIMESTAMP` behavior, including session time-zone settings and precision requirements.

### 4.3 Status fields

Use documented, constrained values for important lifecycle statuses, such as:

- Applications.
- Documents.
- Payments.
- Subscriptions.
- Jobs and internships.
- Notifications.

Ensure application validation and database constraints agree where both are used.

For multi-stage workflows, document valid state transitions and identify which service or operation is authorized to perform each transition.

### 4.4 Personal data

Collect only personal information needed for a defined business purpose.

Document:

- Data ownership and access rules.
- Retention and deletion requirements.
- Whether information is sensitive.
- Applicable legal or contractual obligations.
- Whether data is shared with external providers.
- Appropriate audit and recovery requirements.

Use synthetic data for development and automated tests wherever possible.

## 5. Security and Privacy

- Store password hashes produced by an appropriate password-hashing algorithm; never store plaintext passwords.
- Protect session identifiers, access tokens, recovery tokens, and authentication secrets.
- Keep database credentials outside committed source code.
- Use parameterized queries or an equivalent safe data-access mechanism.
- Apply least-privilege permissions to database users.
- Separate runtime database privileges from migration privileges where practical.
- Protect private document metadata and storage references.
- Restrict access to personal, financial, application, and audit records.
- Avoid storing full payment-card data unless explicitly justified and compliant.
- Apply appropriate data-retention and deletion rules.
- Avoid exposing sensitive database values in logs or error messages.
- Enforce administrative permissions server-side.
- Protect backups and exports against unauthorized access.

Document implemented controls separately from recommended improvements.

## 6. Schema Changes and Migrations

Manage schema changes through reviewed, version-controlled migrations.

Each migration should:

1. Have a unique identifier and deterministic execution order.
2. Perform a logically coherent change.
3. Include reviewed SQL and an appropriate verification strategy.
4. Be tested against an empty database and representative staging conditions.
5. Account for application compatibility.
6. Define recovery behavior for high-risk changes.
7. Be recorded by the migration runner after successful execution.

For changes spanning releases, prefer an expand-and-contract strategy where practical:

1. Add compatible schema elements.
2. Deploy code that supports the transition.
3. Backfill or transform data in controlled batches.
4. Verify the new behavior and data integrity.
5. Remove obsolete schema in a later reviewed release.

Assess locking, execution time, disk capacity, database-specific DDL behavior, backup requirements, and recovery options before high-risk production changes.

See `migrations.md` for the detailed migration and recovery policy.

## 7. Schema Verification

Before relying on a table, column, index, constraint, or relationship:

1. Inspect `database/schema.sql`, if present.
2. Review relevant migration files in their defined execution order.
3. Inspect seed files and fixtures to distinguish initial or test data from production schema.
4. Confirm the configured database engine and version.
5. Check migration execution history.
6. Inspect the deployed schema using an approved verification process.
7. Compare the expected schema with the actual database structure.
8. Investigate discrepancies before documenting the object as implemented.
9. Update this document when the verified schema changes.

Do not infer that a database object exists solely because it appears in application code, documentation, a seed file, or a proposed migration.

A migration-history record alone does not prove that the physical database schema is correct.

## 8. Testing and Data Quality

Use synthetic data and isolated test resources wherever possible.

Test important constraints and workflows, including:

- Duplicate identifiers and unique-constraint violations.
- Invalid foreign-key references.
- Missing or malformed required values.
- Monetary precision and rounding.
- Timestamp and time-zone handling.
- Unauthorized access to private records.
- Transaction rollback and partial-failure scenarios.
- Repeated payment callbacks and retryable operations.
- Application and subscription state transitions.
- Retention and deletion behavior.
- Migration execution against the supported MySQL version.

Use appropriately protected staging data only when synthetic data cannot adequately represent the scenario.

## 9. Documentation Maintenance

Update this document when verified changes affect:

- Entity definitions or relationships.
- Primary keys, foreign keys, or unique constraints.
- Indexes and query patterns.
- Monetary and timestamp conventions.
- Personal-data handling.
- Migration and recovery procedures.
- Retention and deletion requirements.
- Database engine or supported version.

Where it materially improves maintainability, maintain a schema diagram or data dictionary that identifies entities, important fields, relationships, constraints, and ownership boundaries.

Keep the diagram and data dictionary synchronized with the verified schema.

## 10. Related Documentation

- `database/schema.sql` — Schema definition, if present.
- The actual database migration directory — Versioned schema changes.
- `docs/database/README.md` — Database documentation entry point, if present.
- `docs/database/migrations.md` — Migration and recovery policy, if present.
- `docs/architecture/README.md` — Architecture overview, if present.
- `docs/architecture/data-flow.md` — Request and data-processing flows, if present.
- `docs/api/openapi.yaml` — API contract, if present.

Use the repository’s actual canonical paths. Do not link to planned files as though they already exist.

## 11. Maintenance Checklist

- [ ] Database engine and version are verified.
- [ ] Documented entities match the verified schema.
- [ ] Primary keys and foreign-key relationships are defined appropriately.
- [ ] Unique constraints protect required invariants.
- [ ] Indexes support measured query patterns.
- [ ] Financial values use appropriate exact representations.
- [ ] Timestamp and time-zone conventions are documented.
- [ ] Personal data and authentication information are protected.
- [ ] Migration history and deployed schema are consistent.
- [ ] Migration tests and data-integrity checks pass.
- [ ] Backup and recovery procedures are documented.
- [ ] Related API, service, and architecture documentation is synchronized.
- [ ] No credentials or private production data are present in documentation.

## 12. Definition of Done

A database schema documentation change is complete when:

1. Referenced SQL definitions and migration files have been verified.
2. Documented entities and relationships match the actual schema.
3. Data types, constraints, and indexing conventions are accurate.
4. Security, privacy, and retention implications have been reviewed.
5. Related migration and architecture documentation is synchronized.
6. Relevant automated checks pass.
7. Unverified assumptions are explicitly identified.

**Accuracy principle:** The verified database schema and applied migrations are authoritative. Intended domains and illustrative entities must never be treated as confirmation that corresponding database objects already exist.
