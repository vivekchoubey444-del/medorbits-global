MedOrbits — Test Fixtures

Directory: tests/fixtures/

1. Purpose

Fixtures provide deterministic synthetic data for automated tests across the MedOrbits application. They support unit, integration, API, authentication, authorization, and security testing.

Fixtures supply test data only. They do not replace production validation, authentication, authorization, database setup, or security controls.

2. Fixture Rules

* Use fictional users, institutions, applications, courses, and payment references.
* Never include real passwords, access tokens, bank details, identity documents, or private applicant data.
* Keep fixtures small, explicit, deterministic, and easy to override.
* Avoid dependencies on production identifiers, live databases, and external services.
* Document required relationships, setup requirements, and reset procedures.
* Use sandbox-only identifiers and credentials for payment tests.
* Keep fixture fields aligned with the actual production models and validation rules.
* Use deterministic timestamps and values when tests depend on ordering or time.
* Never use fixture defaults as a substitute for production authorization or input validation.

3. Directory Structure

Use the existing MedOrbits fixture modules:

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

Add another fixture module only when a test suite requires a distinct data domain.

Do not rename existing modules without updating their imports throughout the test suite.

4. Relationships

Related records must use consistent synthetic identifiers.

For example, an application must reference its intended test user, and a payment must reference its intended owner.

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

Important: Treat this as an integration example, not a guarantee that these exact field names are accepted by the current MedOrbits models. Verify each fixture factory’s supported fields before using the example. Individual tests should import only the fixtures they need.

Creating a fixture does not automatically create its related database records. Integration tests must establish the necessary relationships through the project’s actual test database setup.

Ownership tests must use separate users to verify that one user cannot access another user’s records without authorization.

5. Isolation and Reset

* Use a dedicated test database or isolated test schema for integration tests.
* Never point test cleanup scripts at production databases.
* Reset modified records and mock state between tests.
* Clean up records created during a test, including dependent records where required.
* Reset in-memory rate-limit stores, queues, and mocks between relevant tests.
* Use provider sandbox environments for payment integration tests.
* Keep test data independent so test execution order does not affect results.

Before running integration tests, confirm that the configured database is a test database and that the cleanup process cannot target production.

6. Security Testing

Fixtures may deliberately contain hostile input for negative security tests, including:

* Attempts to assign privileged roles.
* Attempts to modify server-managed account status.
* Attempts to access records owned by another user.
* Attempts to bypass document ownership checks.
* Duplicate payment webhook events.
* Invalid payment states and repeated transaction requests.
* Unverified, suspended, locked, or deleted accounts.

Tests must verify the actual application response and persisted state. Constructing a malicious fixture alone does not demonstrate that a vulnerability exists or has been prevented.

7. Payment Fixtures

Payment tests must use synthetic transaction references and sandbox-only provider configuration.

* Never include real bank details, payment credentials, or production transaction references.
* Do not make real charges in automated tests.
* Test duplicate requests and webhook deliveries for idempotency.
* Verify payment ownership and permitted state transitions.
* Use deterministic provider responses or a supported sandbox environment.
* Never treat a fixture’s payment status as proof that a payment was actually processed.

8. Usage

Import the fixture module directly into each test:

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

Use the actual export names provided by each module. Do not assume that a factory named makeUser exists when the module exports createUser.

9. Validation and Completion Criteria

A fixture is ready for use when:

* Its data is deterministic and synthetic.
* It contains no real sensitive information.
* Its fields match the intended model and validation rules.
* Required relationships are documented and established by the test setup.
* Overrides do not accidentally create shared mutable state or duplicate identities.
* Invalid and privileged input is used only in intentional negative tests.
* Database cleanup and mock reset behavior are defined for relevant integration tests.
* The associated tests verify application behavior independently of the fixture.

10. Final Principle

Fixtures provide test data; they do not establish trust.

Production behavior must be verified through separate unit, integration, API, authentication, authorization, and security tests. The application must enforce its own validation, access controls, ownership rules, payment integrity, and data isolation.