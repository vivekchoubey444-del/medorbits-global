
# MedOrbits — Database Fixtures

**Directory:** `/database/fixtures/`  
**Purpose:** Synthetic data for local development, automated testing, schema validation, and controlled test-database seeding.  
**Format:** JSON  
**Encoding:** UTF-8  
**Environment:** Development and testing only  
**Production eligibility:** Not eligible

—

## 1. Purpose

This directory contains synthetic JSON fixtures for MedOrbits development, testing, and automated validation.

Fixture records are fictional. They are not verified user records, official college listings, real payment transactions, genuine admission decisions, or authoritative access-control policies.

Fixtures help developers test:

- User registration and account-status handling.
- Application creation and admissions workflows.
- College and course catalogue records.
- Document uploads and review states.
- Payment success, failure, and refund scenarios.
- Subscription states and billing periods.
- Role-based authorization and permission enforcement.
- Data relationships, schema validation, and error handling.

**Production warning:** Never treat fixture data as the source of truth for users, admissions, document verification, subscriptions, payment status, or access permissions.

## 2. Fixture Files

| File | Purpose |
|—|—|
| `applications.fixture.json` | Synthetic application records, application statuses, and related references |
| `colleges.fixture.json` | Synthetic college and institution records |
| `courses.fixture.json` | Synthetic course definitions, eligibility examples, and test statuses |
| `documents.fixture.json` | Document metadata and review-status scenarios |
| `payments.fixture.json` | Synthetic payment, failure, and refund scenarios |
| `roles-permissions.fixture.json` | Example roles and permissions for authorization tests |
| `subscriptions.fixture.json` | Synthetic subscription states, trial periods, and billing periods |
| `users.fixture.json` | Synthetic user accounts, verification flags, and account statuses |

The list above describes the expected fixture collection. Confirm that each file exists in the repository before treating the list as an exhaustive directory inventory.

### Related project files

```text
database/
└── fixtures/
    ├── README.md
    ├── applications.fixture.json
    ├── colleges.fixture.json
    ├── courses.fixture.json
    ├── documents.fixture.json
    ├── payments.fixture.json
    ├── roles-permissions.fixture.json
    ├── subscriptions.fixture.json
    └── users.fixture.json

schemas/
├── application-fixture.schema.json
├── college-fixture.schema.json
├── course-fixture.schema.json
├── document-fixture.schema.json
├── payment-fixture.schema.json
├── roles-permissions-fixture.schema.json
├── subscription-fixture.schema.json
└── user-fixture.schema.json

scripts/
├── validate-fixtures.js
└── validate-document-manifests.mjs
```

This is the intended structure, not confirmation that every listed schema or script already exists. Keep this documentation synchronized with the actual repository.

## 3. Naming and Data Conventions

Use the following conventions for new and existing fixtures.

### 3.1 File names

- Use the `.fixture.json` suffix.
- Use descriptive, lowercase resource names.
- Keep file names consistent with the corresponding schema and test loader.

### 3.2 Identifiers

Use stable, clearly synthetic identifiers, such as:

- `USR-TEST-0001` — user
- `APP-TEST-0001` — application
- `DOC-TEST-0001` — document
- `PAY-TEST-0001` — payment
- `SUB-TEST-0001` — subscription
- `ROLE-TEST-0001` — role

Keep identifiers unique within their respective collections. If a fixture identifier is intended to be globally unique, enforce that requirement explicitly.

Do not assume fixture IDs are database primary keys.

### 3.3 Synthetic-data metadata

Where supported by the relevant schema, use:

```json
{
  “source”: “fixture”,
  “synthetic”: true,
  “verified”: false
}
```

For fixture collections, use top-level metadata where appropriate:

```json
{
  “source”: “fixture”,
  “environment”: “test”,
  “synthetic”: true,
  “productionEligible”: false
}
```

These flags are documentation and validation markers, not security controls. The fixture loader must enforce environment restrictions independently.

### 3.4 Personal information

- Use reserved `.invalid` email domains for synthetic email addresses.
- Do not use real people’s personal details.
- Do not include production passwords, API keys, access tokens, session cookies, private keys, or payment-provider secrets.
- Do not include real identity documents, academic records, or other sensitive uploads.
- Use clearly synthetic names and values for test cases.

### 3.5 Dates and timestamps

- Use ISO 8601 timestamps with an explicit timezone.
- Prefer UTC timestamps ending in `Z`.
- Keep related timestamps logically consistent.
- Use deterministic dates when tests depend on a known state.
- Use an injected clock or controlled test time when testing expiry, deadlines, and subscription renewals.

A fixture’s timestamp does not establish the current real-world status of a record.

### 3.6 Monetary values

If payment and subscription amounts are represented in minor currency units, document that convention consistently.

For INR, for example:

- `150000` paise represents ₹1,500.00.
- `49900` paise represents ₹499.00.

Do not mix rupees and paise within the same field. Ensure fixtures, schemas, services, and database columns use the same unit.

## 4. Cross-File References and Referential Integrity

Where applicable, fixture references should resolve to corresponding records.

| Fixture | Expected relationships |
|—|—|
| Users | Role names should match roles defined in `roles-permissions.fixture.json` |
| Applications | May reference users, colleges, courses, and documents |
| Documents | May reference users, applications, and authorized reviewers |
| Payments | May reference users, applications, and subscriptions |
| Subscriptions | May reference users and subscription plans |
| Roles and permissions | Every assigned permission should exist in the central permission registry |

### Reference validation requirements

The fixture validation process should check:

1. Referenced records exist where the relationship is required.
2. User ownership is consistent across applications, documents, payments, and subscriptions.
3. Reviewer identifiers reference valid test users with appropriate reviewer permissions.
4. Role assignments reference defined roles.
5. Role permissions reference registered permission keys.
6. Identifiers are unique within each collection.
7. Required relationships are not accidentally represented by `null`.
8. Optional relationships are `null` only when the schema and business rules allow them.

Fixture IDs may differ from database primary keys. A test loader must map fixture identifiers to actual test database records rather than assuming that fixture IDs are database IDs.

### Negative-test fixtures

Some tests deliberately require invalid relationships, unauthorized actions, or inconsistent states.

Keep these cases clearly identified as negative-test scenarios. Do not silently correct the data if doing so would remove the condition that a test is intended to reject.

Separate valid seed data from intentionally invalid test inputs when that makes test behavior easier to understand.

## 5. Schemas and Validation

Canonical JSON Schemas are maintained separately in the root-level `/schemas/` directory.

Expected fixture schema files include:

- `schemas/application-fixture.schema.json`
- `schemas/college-fixture.schema.json`
- `schemas/course-fixture.schema.json`
- `schemas/document-fixture.schema.json`
- `schemas/payment-fixture.schema.json`
- `schemas/roles-permissions-fixture.schema.json`
- `schemas/subscription-fixture.schema.json`
- `schemas/user-fixture.schema.json`

Each schema should use JSON Schema Draft 2020-12 unless the project explicitly documents a compatibility requirement.

### Validation scripts

The documented validation entry points are:

- `scripts/validate-fixtures.js` — general fixture validation.
- `scripts/validate-document-manifests.mjs` — document-manifest validation.

Verify that these files exist and that their behavior matches this documentation.

### What schema validation proves

A successful schema-validation pass confirms only that a record satisfies the constraints implemented in the selected schema and validator configuration.

It does not prove that:

- Cross-file references exist.
- A college or course is real or accredited.
- An admission decision is genuine.
- A document is authentic.
- A payment or refund was completed.
- A subscription is active with a real payment provider.
- A role assignment is authorized.
- A user is permitted to access a particular record.

Implement referential integrity, authorization, and domain-specific rules in application code, database constraints, and dedicated tests.

## 6. Running Fixture Validation

Run the repository’s configured validation command if one is defined in `package.json`.

For example, if the project defines a script named `validate:fixtures`, run:

```bash
npm run validate:fixtures
```

If no such script exists, inspect `package.json` before adding one. Do not assume a command is configured merely because this README documents it.

A general fixture-validation process should:

1. Parse each applicable JSON file.
2. Load the corresponding trusted local schema.
3. Compile schemas using a Draft 2020-12-compatible validator.
4. Validate each fixture collection.
5. Check unique identifiers.
6. Validate cross-file references.
7. Check role-permission consistency.
8. Apply domain-specific checks for payment, refund, document, and subscription states.
9. Report errors with the file name and affected record.
10. Exit with a non-zero status if a required validation fails.

Keep the validation deterministic so the same fixture data produces the same results under the same test configuration.

## 7. Safe Fixture Seeding

Fixtures must only be loaded into isolated development or test environments.

### Before seeding

- Confirm the application is using a dedicated test database.
- Confirm the environment is not production.
- Validate fixture JSON and schemas.
- Validate references and uniqueness constraints.
- Confirm the test database can be safely reset.
- Ensure any external integrations use approved sandbox or mock services.

### During seeding

- Use the application’s database models or controlled seed scripts.
- Apply database transactions where appropriate.
- Use deterministic mappings between fixture IDs and database IDs.
- Avoid overwriting unrelated records.
- Keep seed operations repeatable or explicitly document when they are not idempotent.
- Prevent fixture loaders from making real payment, email, SMS, or document-storage operations.

### After seeding

- Verify expected record counts.
- Run integrity and authorization tests.
- Confirm the intended synthetic states were created.
- Clean up through controlled test-environment procedures.

Never automatically load fixture records into a production database.

## 8. Payment and Subscription Safety

Payment and subscription fixtures are simulations for application behavior.

- Never grant paid features solely because a fixture says `succeeded`, `active`, or `paid`.
- Never use fixture data as evidence of a real transaction or refund.
- Verify real payment status through trusted provider responses and appropriately verified webhooks.
- Validate webhook signatures and implement replay/idempotency protections.
- Keep provider-specific order, checkout-session, payment-intent, and payment identifiers semantically distinct.
- Keep monetary units consistent between fixtures, services, and database storage.
- Test refund bounds, including that the cumulative refund amount cannot exceed the original payment amount.
- Test subscription expiry, cancellation, renewal, and failed-payment behavior independently.

Use mocks or provider sandbox environments for payment integration tests. Synthetic fixture IDs must never be submitted as real provider transactions.

## 9. Document Fixture Safety

Document fixtures normally describe metadata, not real files.

- Keep storage keys as placeholders unless test files are deliberately created in isolated storage.
- Never expose fixture storage keys as public download URLs.
- Do not allow a fixture loader to read arbitrary filesystem paths.
- Do not treat `mimeType` or a `.pdf` extension as proof that file content is safe.
- Test file-size limits, MIME validation, content inspection, authorization, and access controls independently.
- Test reviewer permissions and applicant ownership.
- Test approved, rejected, pending, and expired states according to the application’s documented business rules.

Use dedicated synthetic test files when integration tests require actual file content.

## 10. Role and Permission Safety

The `roles-permissions.fixture.json` file is a test definition, not the production authorization policy.

- Enforce authorization on the server.
- Check resource ownership and counsellor assignments.
- Apply least privilege.
- Prevent unauthorized role escalation.
- Protect system-role definitions from unauthorized changes.
- Audit sensitive administrative actions.
- Test both allowed and denied operations.
- Do not grant privileges to real accounts based solely on fixture role definitions.

A permission key alone does not establish authorization to every record in the corresponding resource category.

## 11. Test Coverage Recommendations

Use fixtures to cover positive, negative, and boundary scenarios.

| Area | Suggested cases |
|—|—|
| Users | Active, pending, suspended, disabled, verified, and unverified |
| Applications | Draft, submitted, under review, approved, rejected, and withdrawn where supported |
| Colleges and courses | Active, inactive, unpublished, missing references, and invalid values |
| Documents | Pending review, approved, rejected, expired, invalid metadata, and unauthorized access |
| Payments | Pending, succeeded, failed, fully refunded, and partially refunded |
| Subscriptions | Trial, active, pending, past due, cancelled, and expired where supported |
| Authorization | Allowed access, denied access, ownership mismatch, missing permission, and role escalation |
| Referential integrity | Missing user, application, subscription, course, college, or reviewer references |
| Validation | Missing required properties, invalid types, unexpected properties, and boundary values |

Only include statuses supported by the actual schema and application. A fixture must not introduce a new production status without the corresponding contract and implementation changes.

## 12. Maintenance

When adding or changing a fixture:

1. Preserve valid JSON syntax.
2. Keep identifiers unique within each collection.
3. Update dependent fixtures when referenced identifiers change.
4. Update the corresponding schema if the supported structure changes.
5. Keep synthetic-data markers consistent.
6. Update automated tests to cover new statuses and edge cases.
7. Verify cross-file references and ownership consistency.
8. Confirm monetary units and timestamp conventions.
9. Check that no real personal information or credentials have been introduced.
10. Verify that test seeding remains disabled in production.
11. Update this README when files, schemas, or validation commands change.
12. Review compatibility with existing database constraints and application services.

Schema changes should be treated as contract changes. Review their effect on fixture loaders, APIs, workers, and tests before merging.

## 13. Production Restrictions

The following rules are mandatory:

- Never seed synthetic fixtures into production.
- Never use fixtures to confirm real payment or refund status.
- Never use fixture subscriptions to grant paid entitlements.
- Never treat fixture document metadata as document verification.
- Never treat fixture college or course records as authoritative catalogue data.
- Never treat fixture applications as genuine admission decisions.
- Never apply fixture role definitions directly to real users.
- Never store production secrets in fixture files.
- Never expose private test documents or test records through public APIs.
- Never rely on fixture metadata as the sole mechanism preventing unsafe operations.

Enforce environment checks in the loader and deployment configuration, and test those checks explicitly.

—

**Maintainer:** MedOrbits Engineering  
**Location:** `/database/fixtures/README.md`  
**Schema standard:** JSON Schema Draft 2020-12  
**Data classification:** Synthetic test data  
**Production eligibility:** Prohibited  
**Required controls:** Schema validation, referential-integrity checks, isolated test databases, authorization tests, and CI enforcement
