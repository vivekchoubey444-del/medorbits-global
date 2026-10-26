
# MedOrbits — Test Fixtures

**Directory:** `tests/fixtures/`

## 1. Purpose

Test fixtures provide deterministic, synthetic data for automated tests across the MedOrbits application. They support unit, integration, API, authentication, authorization, and security testing.

Fixtures supply test data only. They do not replace production validation, authentication, authorization, database setup, or security controls.

## 2. Fixture Rules

All fixture modules must follow these principles:

- Use fictional users, institutions, applications, courses, documents, employers, subscriptions, and payment references.
- Never include real passwords, access tokens, bank details, identity documents, private applicant data, or production credentials.
- Keep fixtures small, explicit, deterministic, and easy to override.
- Avoid dependencies on production identifiers, live databases, and external services.
- Document required relationships, setup requirements, and reset procedures.
- Use sandbox-only identifiers and credentials for payment tests.
- Keep fixture fields aligned with the actual production models and validation rules.
- Use deterministic timestamps and values when tests depend on ordering or time.
- Avoid shared mutable objects between tests.
- Never use fixture defaults as a substitute for production authorization or input validation.
- Use hostile or invalid fixtures only in tests specifically designed to verify rejection and security behavior.

## 3. Directory Structure

Use the existing MedOrbits fixture modules:

```text
tests/
└── fixtures/
    ├── README.md
    ├── users.js
    ├── applications.js
    ├── candidates.js
    ├── courses.js
    ├── documents.js
    ├── employers.js
    ├── payments.js
    └── subscriptions.js
```

Add another fixture module only when a test suite requires a distinct data domain.

Do not rename existing modules or change their exported factory names without updating their imports throughout the test suite.

Each module should export only the constants, default values, and factory functions that it intentionally supports. Tests must use actual exports rather than assuming similarly named factories exist across modules.

## 4. Relationships Between Fixtures

Related records must use consistent synthetic identifiers.

For example, an application should reference its intended test user and course, while a payment should reference its intended owner and, where applicable, its application.

The following is an illustrative integration example:

```javascript
‘use strict’;

const { createUser } = require(‘./users’);
const { createApplication } = require(‘./applications’);
const { createCourse } = require(‘./courses’);
const { createPayment } = require(‘./payments’);

const user = createUser({
  id: ‘usr_test_002’,
  email: ‘student002@example.test’,
});

const course = createCourse({
  id: ‘course_test_002’,
});

const application = createApplication({
  id: ‘app_test_002’,
  userId: user.id,
  courseId: course.id,
});

const payment = createPayment({
  id: ‘payment_test_002’,
  userId: user.id,
  applicationId: application.id,
});

module.exports = {
  user,
  course,
  application,
  payment,
};
```

**Important:** This is an integration example, not a guarantee that these exact field names or override combinations are accepted by the current MedOrbits fixture factories or production models. Verify each factory’s supported fields and required values before using the example.

Individual tests should import only the fixtures they need.

Creating a fixture does not automatically create its related database records. Integration tests must establish the required relationships through the project’s actual test database setup, repositories, services, or supported API workflows.

### Ownership requirements

Ownership and IDOR (Insecure Direct Object Reference) tests must use separate synthetic users.

Tests should verify that:

- An owner can access resources when permitted by the application’s access rules.
- Another user cannot access those resources without appropriate authorization.
- Changing a resource identifier does not bypass ownership checks.
- Privileged access is granted only through the application’s real authorization logic.
- Failed access attempts do not disclose protected data or modify unauthorized records.

## 5. Isolation and Reset

Integration tests must use a dedicated test database or isolated test schema.

Before running database integration tests:

1. Confirm that the configured database is intended for testing.
2. Verify that test cleanup cannot target a production database.
3. Establish the required schema and test data through the project’s supported setup process.
4. Ensure cleanup covers records created by the test and dependent records where required.

Between tests:

- Reset modified records and mock state.
- Restore mocked functions and environment variables.
- Reset in-memory rate-limit stores, queues, and other mutable test state when relevant.
- Remove test-created records in dependency-safe order.
- Avoid reliance on test execution order.
- Use isolated transactions or database schemas where supported.
- Keep provider integrations disabled or mocked unless a sandbox integration test explicitly requires them.

Never run destructive cleanup against a database whose test-only status has not been verified.

## 6. Security Testing

Fixtures may deliberately contain hostile or invalid input for negative security tests, including:

- Attempts to assign privileged roles.
- Attempts to modify server-managed account fields.
- Attempts to access records owned by another user.
- Attempts to bypass document ownership or access controls.
- Duplicate payment webhook events.
- Invalid payment states and repeated transaction requests.
- Unverified, suspended, locked, inactive, or deleted accounts.
- Invalid identifiers and malformed request payloads.
- Attempts to supply server-managed permissions or administrative flags.

Tests must exercise the actual application boundary, such as an API endpoint, service, controller, or authorization middleware, and assert the observed behavior.

Where applicable, verify:

- The returned status code and response structure.
- That protected data is not disclosed.
- That unauthorized state changes are rejected.
- That persisted data remains unchanged after a rejected operation.
- That audit events are generated where required.
- That repeated requests do not cause duplicate side effects.

Constructing a malicious fixture alone does not demonstrate that a vulnerability exists or has been prevented.

## 7. Payment Fixtures

Payment tests must use synthetic transaction references and sandbox-only provider configuration.

Requirements:

- Never include real bank details, payment credentials, or production transaction references.
- Never make real charges in automated tests.
- Use deterministic provider responses or a supported sandbox environment.
- Test duplicate requests and webhook deliveries for idempotency.
- Verify payment ownership and permitted state transitions.
- Test successful, failed, pending, cancelled, and refunded states where supported by the application.
- Verify that repeated refund or payment requests cannot create unintended duplicate operations.
- Test webhook signature verification using synthetic keys or provider-supported sandbox configuration.
- Confirm that invalid webhook events are rejected.
- Never treat a fixture’s payment status as proof that a payment was actually processed.

Payment fixtures represent expected test scenarios. Actual payment behavior must be verified through the payment service, API, webhook handler, and persistence layer as appropriate.

## 8. Usage

Import fixture functions directly into each test.

Example:

```javascript
‘use strict’;

const {
  createUser,
  createAdminUser,
  createUserWithStatus,
  createMassAssignmentPayload,
} = require(‘../fixtures/users’);

const student = createUser();
const admin = createAdminUser();
const suspendedUser = createUserWithStatus(‘suspended’);
const hostilePayload = createMassAssignmentPayload();
```

Use the actual export names provided by each module. Do not assume that a factory named `makeUser` exists when the module exports `createUser`.

For CommonJS modules, use the project’s existing `require()` conventions unless the test configuration explicitly supports another module format.

### Override guidelines

- Override only the fields needed for the test.
- Use unique IDs and emails when multiple records are created together.
- Ensure foreign-key references match the intended related fixtures.
- Do not mutate shared defaults or reuse mutable nested objects between independent tests.
- Use explicit invalid values only when the test is intended to exercise validation or security rejection.
- Check the factory’s validation rules before using it to create intentionally inconsistent records.

If a fixture factory validates a field combination that a negative test needs to make invalid, use a dedicated invalid-payload helper or construct the request payload separately rather than weakening normal fixture validation.

## 9. Validation and Completion Criteria

A fixture module is ready for use when:

- Its data is deterministic and synthetic.
- It contains no real sensitive information or production credentials.
- Its fields match the intended model and validation rules.
- Required relationships are documented and established by test setup.
- Overrides do not accidentally create shared mutable state or duplicate identities.
- Invalid and privileged input is used only in intentional negative tests.
- Database cleanup and mock reset behavior are defined for relevant integration tests.
- Exports are stable and used consistently throughout the test suite.
- Associated tests verify application behavior independently of the fixture.
- Relevant tests pass in the project’s configured test environment.

Before declaring a fixture complete, verify its exports and run the relevant tests using the repository’s existing test scripts.

## 10. Final Principle

Fixtures provide test data; they do not establish trust.

Production behavior must be verified through separate unit, integration, API, authentication, authorization, and security tests.

The application itself must enforce validation, access controls, ownership rules, payment integrity, and data isolation. No fixture, default value, synthetic principal, or test-only account should be treated as proof of authorization or successful processing.
```
