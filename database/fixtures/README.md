MedOrbits — Database Fixtures

1. Purpose

This directory contains synthetic JSON fixtures for MedOrbits development, testing, and automated validation.

Important: Fixture records are fictional. They are not verified user records, official college listings, real payment transactions, or genuine admission decisions. Never present fixture data as verified production information.

2. Fixture files

File	Purpose
applications.fixture.json	Synthetic application records and document references
colleges.fixture.json	Synthetic college and institution records
courses.fixture.json	Synthetic course definitions and test statuses
documents.fixture.json	Document metadata and review-status scenarios
payments.fixture.json	Synthetic payment, failure, and refund scenarios
roles-permissions.fixture.json	Example roles and permissions for authorization tests
subscriptions.fixture.json	Synthetic subscription states and billing periods
users.fixture.json	Synthetic user accounts and account statuses

3. Naming conventions

* Use .fixture.json for fixture data files.
* Use stable test identifiers such as USR-TEST-0001, APP-TEST-0001, DOC-TEST-0001, and PAY-TEST-0001.
* Use metadata.source: “fixture” to identify fixture-generated records.
* Use metadata.synthetic: true and metadata.verified: false where supported by the relevant fixture structure.
* Use reserved .invalid email addresses for synthetic users and contacts.
* Never include production passwords, API keys, access tokens, real identity documents, or payment-provider secrets.

4. Cross-file references

Where applicable, fixture references should resolve to corresponding records:

* Application records may reference users, colleges, courses, and documents.
* Document records may reference users and applications.
* Payment records may reference users, applications, and subscriptions.
* Subscription records may reference users.
* User role names should match the roles defined in roles-permissions.fixture.json.

Fixture identifiers may differ from database primary keys. A test loader must map fixture identifiers to actual test database records rather than assuming that fixture IDs are database IDs.

5. Schemas and validation

JSON schemas are maintained separately in the root-level schemas/ directory.

The following schema files are currently intended for these fixtures:

* schemas/application-fixture.schema.json
* schemas/college-fixture.schema.json
* schemas/course-fixture.schema.json
* schemas/payment-fixture.schema.json

The validation script is located at scripts/validate-fixtures.js.

The separate document-manifest validator is located at scripts/validate-document-manifests.mjs.

A schema validation pass checks the properties defined by the schema. It does not prove that cross-file references exist, that an institution is accredited, that an admission decision is genuine, or that a payment was completed.

6. Safe testing rules

1. Use fixtures only in isolated development and test environments.
2. Do not automatically load fixture records into production databases.
3. Do not grant paid features based on fixture payment or subscription statuses.
4. Do not grant administrative privileges to real users based solely on fixture role definitions.
5. Use the application’s actual authentication and password-hashing implementation when creating test login accounts.
6. Keep document storage keys as placeholders unless test files are deliberately created in an isolated storage location.
7. Reset or clean up test records through controlled test-environment procedures.

7. Maintenance

When adding or changing a fixture:

1. Preserve valid JSON syntax.
2. Keep identifiers unique within each fixture collection.
3. Update dependent fixtures when referenced identifiers change.
4. Update the corresponding schema if the supported data structure changes.
5. Keep synthetic-data markers consistent.
6. Update automated tests to cover new statuses and edge cases.

Production warning: Never use these fixtures as the source of truth for users, admissions, document verification, subscriptions, payment status, or access permissions.