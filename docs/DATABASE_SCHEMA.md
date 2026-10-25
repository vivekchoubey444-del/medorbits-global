MedOrbits — Database Schema

File: docs/DATABASE_SCHEMA.md
Version: 1.0.0
Status: Proposed schema reference
Database: Must match the database configured in the active deployment
Backend: Node.js and Express

⸻

1. Purpose

This document defines a proposed database schema for MedOrbits, covering user accounts, authentication, education catalogues, applications, document management, support tickets, notifications, payments, official resources, and administrative auditing.

It establishes recommended entities, relationships, constraints, indexes, and data-management rules for implementing and maintaining the platform.

Important: This is a proposed logical schema, not a representation of verified live database tables. Before implementing migrations, compare this specification with the existing models, SQL schema, database driver, and DATABASE_URL configuration. Do not replace an existing database or drop tables based solely on this document.

2. Database design principles

* Use stable primary keys and explicit foreign-key relationships.
* Enforce uniqueness and data integrity at the database level.
* Keep authentication credentials separate from public profile information.
* Store private document contents outside public static assets.
* Separate application records from application status history.
* Preserve provenance and verification metadata for official resources.
* Use UTC timestamps for stored event times.
* Store money as integer minor units or an appropriate exact decimal type, never floating-point values.
* Make payment processing and webhook handling idempotent.
* Apply least-privilege access and resource ownership checks.
* Use migrations to manage schema changes.
* Define retention, archival, and deletion rules for personal information.

3. Entity relationship diagram

<CodeBlock language=“mermaid” editable>
erDiagram
    USERS ||—o{ APPLICATIONS : submits
    USERS ||—o{ DOCUMENTS : owns
    USERS ||—o{ SUPPORT_TICKETS : creates
    USERS ||—o{ NOTIFICATIONS : receives
    USERS ||—o{ PAYMENTS : initiates
    USERS ||—o{ REFUND_REQUESTS : requests
    USERS ||—o{ USER_SESSIONS : has
    USERS ||—o{ AUDIT_LOGS : performs
APPLICATIONS ||—o{ APPLICATION_STATUS_HISTORY : records
APPLICATIONS ||—o{ APPLICATION_DOCUMENTS : includes
DOCUMENTS ||—o{ APPLICATION_DOCUMENTS : linked_to
SUPPORT_TICKETS ||—o{ SUPPORT_MESSAGES : contains
PAYMENTS ||—o{ PAYMENT_EVENTS : records
PAYMENTS ||—o{ REFUND_REQUESTS : may_have
OFFICIAL_RESOURCES ||—o{ RESOURCE_VERIFICATIONS : verified_by
USERS {
    uuid id PK
    string email UK
    string password_hash
    string role
    string account_status
    timestamp created_at
}
APPLICATIONS {
    uuid id PK
    uuid user_id FK
    string application_type
    string status
    timestamp submitted_at
    timestamp created_at
}
DOCUMENTS {
    uuid id PK
    uuid owner_user_id FK
    string storage_key
    string document_type
    string verification_status
    timestamp created_at
}
PAYMENTS {
    uuid id PK
    uuid user_id FK
    string provider
    string provider_order_id
    bigint amount_minor
    string currency
    string status
}
SUPPORT_TICKETS {
    uuid id PK
    uuid user_id FK
    string subject
    string category
    string status
    timestamp created_at
}
OFFICIAL_RESOURCES {
    uuid id PK
    string title
    string official_url
    string verification_status
    timestamp last_verified_at
}
</CodeBlock>

The diagram shows principal relationships only. The detailed schema below adds constraints and supporting tables. It does not imply that these tables already exist.

4. Recommended database engine

Use the engine already configured and supported by the application.

PostgreSQL is a suitable option for a relational MedOrbits deployment because it supports foreign keys, transactions, indexes, JSON data types, and robust constraint enforcement. MySQL can also support the proposed relational model with appropriate type and migration adjustments.

Before choosing or changing an engine, verify:

* The active database driver and ORM or query library.
* Existing production tables and migrations.
* Hosting support and connection limits.
* Backup and restore procedures.
* Compatibility with the current application code.
* Whether the deployment already contains production data.

Do not assume PostgreSQL or MySQL without inspecting the implementation.

5. Naming and type conventions

Use consistent snake_case names for tables and columns.

Concept	Recommended type
Primary key	UUID or the project’s established identifier type
Foreign key	Same type as the referenced primary key
Short label or code	VARCHAR
Long description	TEXT
Boolean state	BOOLEAN
Event timestamp	TIMESTAMPTZ in PostgreSQL
Money	BIGINT minor units or exact DECIMAL
Structured metadata	JSONB in PostgreSQL or the equivalent supported type
Counter	Integer type with appropriate bounds

UUIDs are used in the examples below. If the existing application uses another primary-key convention, keep the current convention unless a planned migration justifies the change.

For cross-database compatibility, review timestamp, JSON, UUID, and index syntax before applying SQL.

6. Core identity tables

6.1 users

Stores account identity and authentication-related state.

Column	Type	Constraints	Purpose
id	UUID	Primary key	User identifier
email	VARCHAR(320)	Unique when present	Login or contact email
phone	VARCHAR(32)	Nullable	Contact number
password_hash	TEXT	Nullable if external authentication is used	Password hash
role	VARCHAR(40)	Required	Primary account role
account_status	VARCHAR(30)	Required	Account lifecycle state
email_verified_at	TIMESTAMPTZ	Nullable	Email verification time
phone_verified_at	TIMESTAMPTZ	Nullable	Phone verification time
last_login_at	TIMESTAMPTZ	Nullable	Last successful login
created_at	TIMESTAMPTZ	Required	Creation time
updated_at	TIMESTAMPTZ	Required	Last update time
deleted_at	TIMESTAMPTZ	Nullable	Soft-deletion timestamp, if used

Recommended role values include student, applicant, support_agent, content_editor, and administrator. These values must match the actual authorization implementation.

Recommended account states include pending, active, suspended, and closed.

Implementation notes:

* Normalize email addresses consistently before applying uniqueness rules.
* Do not store plaintext passwords.
* Decide whether email or phone is the mandatory unique identity.
* Use a partial unique index where supported if multiple inactive or deleted accounts require different identity-handling rules.
* Keep privileged role changes restricted to authorized server-side operations.

6.2 user_profiles

Stores optional profile details separately from account credentials.

Column	Type	Constraints
user_id	UUID	Primary key, foreign key to users.id
display_name	VARCHAR(160)	Nullable
date_of_birth	DATE	Nullable; collect only if needed
country_code	CHAR(2)	Nullable
preferred_language	VARCHAR(12)	Nullable
created_at	TIMESTAMPTZ	Required
updated_at	TIMESTAMPTZ	Required

Keep sensitive profile fields out of public API responses unless specifically required and authorized.

6.3 user_sessions

Use this table if the application manages persistent server-side sessions in the database.

Column	Type	Constraints
id	UUID	Primary key
user_id	UUID	Foreign key to users.id
session_token_hash	TEXT	Unique
expires_at	TIMESTAMPTZ	Required
revoked_at	TIMESTAMPTZ	Nullable
created_at	TIMESTAMPTZ	Required
last_seen_at	TIMESTAMPTZ	Nullable

Store a hash of a high-entropy session secret rather than the raw reusable token where compatible with the chosen session design.

If an established session store already exists, do not create a duplicate session system.

7. Education catalogue tables

Education data can live in static JSON files, relational tables, or a combination. Avoid maintaining competing sources of truth without a defined synchronization process.

7.1 courses

Column	Type	Constraints
id	UUID	Primary key
slug	VARCHAR(180)	Unique
name	VARCHAR(240)	Required
category	VARCHAR(100)	Nullable
description	TEXT	Nullable
country_code	CHAR(2)	Nullable
is_published	BOOLEAN	Required
created_at	TIMESTAMPTZ	Required
updated_at	TIMESTAMPTZ	Required

7.2 institutions

Represents colleges and universities in one shared catalogue. Use a separate institution-type field instead of duplicating common attributes.

Column	Type	Constraints
id	UUID	Primary key
slug	VARCHAR(220)	Unique
name	VARCHAR(300)	Required
institution_type	VARCHAR(40)	Required
country_code	CHAR(2)	Nullable
state_region	VARCHAR(160)	Nullable
city	VARCHAR(160)	Nullable
official_website	TEXT	Nullable
description	TEXT	Nullable
is_published	BOOLEAN	Required
created_at	TIMESTAMPTZ	Required
updated_at	TIMESTAMPTZ	Required

Possible institution_type values include college, university, and training_provider. Restrict values using database constraints or a reference table.

7.3 institution_courses

Links institutions to courses and programmes.

Column	Type	Constraints
id	UUID	Primary key
institution_id	UUID	Foreign key to institutions.id
course_id	UUID	Foreign key to courses.id
programme_name	VARCHAR(240)	Required
academic_year	VARCHAR(12)	Nullable
recognition_status	VARCHAR(40)	Nullable
source_url	TEXT	Nullable
last_verified_at	TIMESTAMPTZ	Nullable
created_at	TIMESTAMPTZ	Required

Add an appropriate uniqueness constraint for institution, course, programme, and applicable academic year. Recognition status must not be inferred merely from the existence of a record.

7.4 Other catalogues

Scholarships, jobs, entrance examinations, hostels, fees, career options, and services can be represented by additional domain-specific tables when database-backed workflows are needed.

If these records are maintained in static JSON, apply the verification and schema-validation requirements in docs/DATA_VERIFICATION.md.

Do not store all unrelated catalogue types in one unstructured table merely to reduce the number of tables.

8. Applications

8.1 applications

Stores applications submitted by users for guidance or other supported workflows.

Column	Type	Constraints
id	UUID	Primary key
user_id	UUID	Foreign key to users.id
application_reference	VARCHAR(60)	Unique
application_type	VARCHAR(60)	Required
status	VARCHAR(40)	Required
course_interest	VARCHAR(160)	Nullable
preferred_state	VARCHAR(160)	Nullable
academic_year	VARCHAR(12)	Nullable
submitted_at	TIMESTAMPTZ	Nullable
created_at	TIMESTAMPTZ	Required
updated_at	TIMESTAMPTZ	Required

Keep the application reference distinct from the internal primary key.

Do not put all uploaded document contents or extensive mutable workflow history into a single JSON column.

8.2 application_status_history

Stores state changes for traceability.

Column	Type	Constraints
id	UUID	Primary key
application_id	UUID	Foreign key to applications.id
previous_status	VARCHAR(40)	Nullable
new_status	VARCHAR(40)	Required
changed_by_user_id	UUID	Nullable foreign key to users.id
reason	TEXT	Nullable
created_at	TIMESTAMPTZ	Required

Write the application update and its corresponding history entry in the same database transaction.

8.3 application_documents

Links documents to applications.

Column	Type	Constraints
application_id	UUID	Foreign key to applications.id
document_id	UUID	Foreign key to documents.id
document_purpose	VARCHAR(100)	Nullable
created_at	TIMESTAMPTZ	Required

Use a composite primary key on (application_id, document_id) unless the relationship needs its own identifier.

The service must verify that the user is authorized to link a document to the application. Foreign keys alone do not establish user ownership.

9. Document management

9.1 documents

Stores metadata for private files, not the file contents themselves.

Column	Type	Constraints
id	UUID	Primary key
owner_user_id	UUID	Foreign key to users.id
document_type	VARCHAR(80)	Required
storage_key	TEXT	Unique, required
original_filename	VARCHAR(255)	Nullable
mime_type	VARCHAR(120)	Required
size_bytes	BIGINT	Required
checksum	VARCHAR(128)	Nullable
verification_status	VARCHAR(40)	Required
uploaded_at	TIMESTAMPTZ	Required
deleted_at	TIMESTAMPTZ	Nullable

Recommended controls:

* Generate storage keys on the server.
* Enforce a positive file size and configured maximum.
* Check content signatures and supported file types.
* Store sensitive files outside public web roots.
* Avoid exposing storage keys or physical paths in public APIs.
* Restrict downloads using ownership and authorization checks.
* Apply documented retention and deletion rules.

If multiple users or applications can share a file under controlled permissions, model that relationship explicitly rather than weakening ownership checks.

10. Support system

10.1 support_tickets

Column	Type	Constraints
id	UUID	Primary key
ticket_reference	VARCHAR(60)	Unique
user_id	UUID	Nullable foreign key to users.id
category	VARCHAR(80)	Required
subject	VARCHAR(240)	Required
status	VARCHAR(40)	Required
priority	VARCHAR(20)	Required
assigned_to_user_id	UUID	Nullable foreign key to users.id
created_at	TIMESTAMPTZ	Required
updated_at	TIMESTAMPTZ	Required
closed_at	TIMESTAMPTZ	Nullable

Allow anonymous ticket creation only if the product requirements explicitly support it. Apply abuse controls and define how the requester can securely access the ticket.

10.2 support_messages

Column	Type	Constraints
id	UUID	Primary key
ticket_id	UUID	Foreign key to support_tickets.id
author_user_id	UUID	Nullable foreign key to users.id
message_body	TEXT	Required
is_internal_note	BOOLEAN	Required
created_at	TIMESTAMPTZ	Required

Internal notes must never be returned to customers through ordinary ticket APIs. Enforce that restriction in server-side query and authorization logic.

11. Notifications

notifications

Column	Type	Constraints
id	UUID	Primary key
user_id	UUID	Foreign key to users.id
notification_type	VARCHAR(80)	Required
title	VARCHAR(240)	Required
body	TEXT	Nullable
resource_type	VARCHAR(80)	Nullable
resource_id	UUID	Nullable
read_at	TIMESTAMPTZ	Nullable
created_at	TIMESTAMPTZ	Required
expires_at	TIMESTAMPTZ	Nullable

Notifications must be scoped to their recipient. Avoid storing unnecessary sensitive personal data in notification text or sending confidential information through unprotected channels.

12. Payments and refunds

Use provider-specific identifiers and a clearly defined payment state machine.

12.1 payments

Column	Type	Constraints
id	UUID	Primary key
user_id	UUID	Foreign key to users.id
application_id	UUID	Nullable foreign key to applications.id
provider	VARCHAR(60)	Required
provider_order_id	VARCHAR(180)	Nullable
provider_payment_id	VARCHAR(180)	Nullable
amount_minor	BIGINT	Required
currency	CHAR(3)	Required
status	VARCHAR(40)	Required
idempotency_key	VARCHAR(180)	Nullable
created_at	TIMESTAMPTZ	Required
updated_at	TIMESTAMPTZ	Required
paid_at	TIMESTAMPTZ	Nullable

Use integer minor units with a documented currency exponent, or an exact decimal representation with explicit rounding rules. Never use floating-point values for monetary calculations.

Define uniqueness rules for provider order and payment identifiers according to the provider’s guarantees. Scope idempotency keys to the appropriate account or operation.

12.2 payment_events

Stores processed provider events or references to verified event records.

Column	Type	Constraints
id	UUID	Primary key
payment_id	UUID	Foreign key to payments.id
provider_event_id	VARCHAR(200)	Required
event_type	VARCHAR(120)	Required
processing_status	VARCHAR(40)	Required
received_at	TIMESTAMPTZ	Required
processed_at	TIMESTAMPTZ	Nullable

Add an appropriate unique constraint on provider and event identifier so duplicate webhook delivery does not produce duplicate effects.

Do not store raw card numbers, security codes, or other payment credentials. Restrict access to provider payloads and retain only the data needed for reconciliation and auditing.

12.3 refund_requests

Column	Type	Constraints
id	UUID	Primary key
payment_id	UUID	Foreign key to payments.id
user_id	UUID	Foreign key to users.id
amount_minor	BIGINT	Required
reason	TEXT	Nullable
status	VARCHAR(40)	Required
provider_refund_id	VARCHAR(180)	Nullable
created_at	TIMESTAMPTZ	Required
updated_at	TIMESTAMPTZ	Required

Validate refund amounts, payment state, requester permissions, and cumulative refund limits in a transaction-safe workflow.

13. Official documents and verification

13.1 official_resources

Stores metadata for official publications and related educational resources.

Column	Type	Constraints
id	UUID	Primary key
slug	VARCHAR(220)	Unique
title	VARCHAR(300)	Required
category	VARCHAR(100)	Required
issuing_authority	VARCHAR(240)	Nullable
official_url	TEXT	Required
source_published_at	TIMESTAMPTZ	Nullable
effective_from	DATE	Nullable
effective_to	DATE	Nullable
academic_year	VARCHAR(12)	Nullable
verification_status	VARCHAR(40)	Required
last_verified_at	TIMESTAMPTZ	Nullable
next_review_at	TIMESTAMPTZ	Nullable
is_published	BOOLEAN	Required
created_at	TIMESTAMPTZ	Required
updated_at	TIMESTAMPTZ	Required

The official URL should point to the responsible authority’s publication where available. A valid URL does not, by itself, establish that the linked information is current or authoritative.

13.2 resource_verifications

Preserves verification history.

Column	Type	Constraints
id	UUID	Primary key
resource_id	UUID	Foreign key to official_resources.id
verification_status	VARCHAR(40)	Required
source_url	TEXT	Required
evidence_reference	TEXT	Nullable
reviewed_by_user_id	UUID	Nullable foreign key to users.id
review_notes	TEXT	Nullable
verified_at	TIMESTAMPTZ	Required

Store the actual verification result, not a result inferred from a scheduled check. Do not expose private review notes in public resource responses.

See docs/DATA_VERIFICATION.md for the verification policy and status definitions.

14. Audit logs

audit_logs

Records sensitive actions and important administrative changes.

Column	Type	Constraints
id	UUID	Primary key
actor_user_id	UUID	Nullable foreign key to users.id
action	VARCHAR(120)	Required
resource_type	VARCHAR(100)	Nullable
resource_id	VARCHAR(180)	Nullable
request_id	VARCHAR(120)	Nullable
ip_address	INET or compatible type	Nullable
metadata	JSONB or compatible type	Nullable
created_at	TIMESTAMPTZ	Required

Audit events should cover important operations such as account privilege changes, application status transitions, document access decisions where appropriate, official-resource verification, and payment reconciliation.

Controls:

* Restrict read access.
* Redact tokens and sensitive personal data.
* Define retention and deletion rules.
* Prevent ordinary users from modifying audit entries.
* Avoid storing complete request bodies by default.
* Apply additional protection if the audit trail is used for security investigations.

15. Suggested SQL constraints

The following PostgreSQL examples illustrate useful integrity controls. Adapt the table and column names to the actual schema before running them.

— Examples only: execute only after confirming that the tables exist.
ALTER TABLE applications
  ADD CONSTRAINT applications_status_check
  CHECK (
    status IN (
      ‘draft’,
      ‘submitted’,
      ‘under_review’,
      ‘action_required’,
      ‘approved’,
      ‘rejected’,
      ‘cancelled’
    )
  );
ALTER TABLE documents
  ADD CONSTRAINT documents_size_positive
  CHECK (size_bytes > 0);
ALTER TABLE payments
  ADD CONSTRAINT payments_amount_nonnegative
  CHECK (amount_minor >= 0);
ALTER TABLE refund_requests
  ADD CONSTRAINT refund_requests_amount_positive
  CHECK (amount_minor > 0);

Use constraints that match the actual business rules. For example, a payment amount of zero may be valid for a free service, but the application must explicitly support that case.

Do not apply ALTER TABLE statements blindly to a live database. Prefer versioned migrations and a reviewed deployment plan.

16. Recommended indexes

Indexes should support measured query patterns and foreign-key access.

Potential indexes include:

CREATE INDEX idx_applications_user_created
  ON applications (user_id, created_at DESC);
CREATE INDEX idx_applications_status_created
  ON applications (status, created_at DESC);
CREATE INDEX idx_documents_owner_created
  ON documents (owner_user_id, uploaded_at DESC);
CREATE INDEX idx_support_tickets_user_status
  ON support_tickets (user_id, status);
CREATE INDEX idx_notifications_user_created
  ON notifications (user_id, created_at DESC);
CREATE INDEX idx_official_resources_status_review
  ON official_resources (verification_status, next_review_at);
CREATE INDEX idx_audit_logs_created
  ON audit_logs (created_at DESC);

These examples assume the listed tables and columns exist and that PostgreSQL is in use. Confirm actual names, query plans, selectivity, and workload before adding indexes. Excessive indexing increases storage use and write overhead.

Add unique indexes for identifiers that must be unique, such as user emails, application references, resource slugs, and provider event IDs, using the application’s actual normalization and lifecycle rules.

17. Relationships and deletion policy

Use foreign keys to protect relational integrity, and define deletion behavior deliberately.

Recommended approach:

* Use RESTRICT or NO ACTION where deleting a parent could destroy records needed for auditing or financial reconciliation.
* Use CASCADE only where dependent data is safe to delete with its parent.
* Consider soft deletion for accounts and records requiring retention or recovery.
* Anonymize personal data when appropriate and legally permitted.
* Preserve payment and audit records according to applicable retention requirements.
* Ensure deleted users cannot continue to access private files or application records.
* Handle file deletion and database changes consistently, including failed storage operations.

Database deletion rules must align with the privacy policy and actual legal or contractual obligations. Do not retain personal information indefinitely by default.

18. Transactions and concurrency

Use database transactions for operations that must succeed or fail as a unit.

Examples include:

* Updating an application status and writing its history.
* Creating a payment record and its related internal references.
* Recording a verified webhook event and updating payment state.
* Creating a support ticket and its initial message.
* Linking a document to an application after ownership validation.

For external providers, do not hold a database transaction open while waiting for a long network request. Use idempotent operations and a documented reconciliation process.

Protect against concurrent updates using optimistic locking, conditional updates, or other suitable transaction controls.

19. Migration strategy

All schema changes should be version-controlled.

Recommended process:

1. Inspect the current database schema and existing migrations.
2. Create a new migration with a unique, ordered identifier.
3. Review table changes, constraints, indexes, and data transformations.
4. Test the migration on a disposable or staging database.
5. Back up important production data before risky changes.
6. Apply the migration using the deployment’s controlled procedure.
7. Verify the resulting schema and application behavior.
8. Document rollback or forward-recovery procedures.

Prefer backward-compatible changes when deploying updates while older application instances may still be running.

Never put destructive production database resets in routine startup code.

20. Backup and recovery

Define a backup policy according to business impact and operational requirements.

It should specify:

* Backup frequency.
* Retention period.
* Encryption at rest and in transit.
* Access controls.
* Database and file-storage consistency.
* Recovery-point objective (RPO).
* Recovery-time objective (RTO).
* Restoration testing.
* Incident ownership.

Database backups alone are insufficient when uploaded documents are stored separately. Verify that required file storage and metadata can be restored consistently.

21. Static JSON versus database storage

Not every dataset requires a relational table.

Data	Suitable storage
Public, small, version-controlled catalogue	Static JSON
Public catalogue requiring frequent editorial updates	Database or managed content store
User accounts and sessions	Database or established identity/session provider
Applications and workflow history	Database
Private document contents	Protected file storage
Document metadata and ownership	Database
Payment reconciliation records	Database
Official resource verification history	Database or a version-controlled workflow with equivalent auditability
High-volume operational logs	Dedicated logging system or controlled database storage

If static JSON remains the source of truth for public catalogues, avoid creating a second database copy without a documented import, synchronization, and ownership strategy.

22. Environment and secrets

The application may use environment variables such as:

DATABASE_URL=
SESSION_SECRET=
ADMIN_TOKEN=

These are placeholders. Retain only the variables the application actually uses.

* Never commit real credentials.
* Do not log connection strings.
* Use separate credentials for development, testing, and production.
* Grant the runtime database account only the privileges it requires.
* Use a separate migration account if the deployment architecture supports it.
* Rotate exposed credentials promptly.
* Validate required configuration during startup.

23. Implementation checklist

* [ ]	Inspect the active database engine and connection configuration.
* [ ]	Inventory existing tables, migrations, models, and foreign keys.
* [ ]	Compare this proposal with the actual schema.
* [ ]	Confirm account roles and authorization rules.
* [ ]	Confirm application lifecycle and status transitions.
* [ ]	Confirm private file-storage architecture.
* [ ]	Confirm payment provider and webhook event model, if applicable.
* [ ]	Add uniqueness, integrity, and state-transition constraints.
* [ ]	Add indexes based on real query patterns.
* [ ]	Create versioned migrations.
* [ ]	Test migrations against a non-production database.
* [ ]	Test authorization and ownership constraints.
* [ ]	Establish backup, restoration, retention, and deletion policies.
* [ ]	Document the actual implemented schema separately from proposed tables.

⸻

24. Related documentation

* docs/ARCHITECTURE.md — system components and data flows.
* docs/API_REFERENCE.md — API endpoint conventions.
* docs/DATA_VERIFICATION.md — source verification and dataset freshness.
* README.md — setup, configuration, and development instructions.
* .env.example — environment-variable names and placeholders.

Final note

This document is a proposed relational schema for MedOrbits. It must be reconciled with the existing application and database before implementation. The production database schema, migration history, and running application remain the authoritative sources for what is actually deployed.

End of document.