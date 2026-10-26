MedOrbits API Tests

Location: tests/api/README.md
Test runner: Jest
HTTP testing: Supertest
Runtime: Node.js 20 or later
Module format: CommonJS

1. Purpose

The tests/api/ directory contains automated tests for the MedOrbits HTTP API.

The suite is intended to verify:

* API endpoint availability and response contracts.
* Authentication and authorization requirements.
* Request validation and error handling.
* Resource ownership and Insecure Direct Object Reference (IDOR) protection.
* Payment initiation, webhook signature verification, and payment-state integrity.
* University, college, course, job, document, and public-release catalog behavior.
* Sensitive-data protection and mass-assignment prevention.
* Malformed request handling and unsupported HTTP methods.
* Public dataset access, publication status, pagination, and path traversal protection.

Tests should verify actual application behavior, not merely that requests return without crashing.

Important: A test file’s existence does not prove that its corresponding endpoint is implemented or secure. Verify all tests against the actual routes, middleware, controllers, schemas, and documented API contracts.

2. Directory structure

The following is the intended inventory. Keep it synchronized with the actual repository.

tests/
└── api/
    ├── README.md
    ├── applications.api.test.js
    ├── auth.api.test.js
    ├── colleges.api.test.js
    ├── courses.api.test.js
    ├── documents.api.test.js
    ├── error-responses.api.test.js
    ├── health.api.test.js
    ├── jobs.api.test.js
    ├── payments.api.test.js
    ├── public-data.api.test.js
    ├── public-release.api.test.js
    ├── universities.api.test.js
    └── users.api.test.js

The filenames above describe the intended test suite; they must be checked against the actual files. For example, user.api.test.js and users.api.test.js are different filenames on case-sensitive filesystems.

3. Test file responsibilities

Test file	Responsibility
applications.api.test.js	Application listing, retrieval, submission, ownership, validation, and authorization
auth.api.test.js	Registration, login, authentication failures, and credential handling
colleges.api.test.js	College catalog, search, filtering, pagination, and details
courses.api.test.js	Course catalog, course details, query validation, and read-only access
documents.api.test.js	Document access, upload validation, downloads, ownership, and storage-path protection
error-responses.api.test.js	Error consistency, malformed requests, missing routes, and information leakage
health.api.test.js	Health, liveness, readiness, and infrastructure information exposure
jobs.api.test.js	Job listing, search, filtering, details, and privileged-field protection
payments.api.test.js	Payment authorization, initiation validation, webhook signatures, and payment-state integrity
public-data.api.test.js	Public dataset responses, unknown datasets, and path traversal protection
public-release.api.test.js	Published bulletins, notices, pagination totals, and public-release mutation protection
universities.api.test.js	University catalog, details, search, filters, pagination, and data integrity
users.api.test.js	User profiles, ownership, profile updates, registration security, and sensitive-data protection

4. Technology requirements

Recommended development dependencies:

* Node.js 20 or later.
* Jest.
* Supertest.
* The application’s Express instance.
* A dedicated test database for database-dependent tests.

Install the test dependencies:

npm install —save-dev jest supertest

The application should export its Express instance from:

src/app.js

Typical CommonJS test imports:

‘use strict’;
const request = require(‘supertest’);
const app = require(‘../../src/app’);

Tests should import the application without unintentionally starting a production server or binding a network port.

5. Running API tests

Run the complete API test suite:

npx jest tests/api —runInBand

Run a single test file:

npx jest tests/api/courses.api.test.js —runInBand

Run payment tests:

npx jest tests/api/payments.api.test.js —runInBand

Run document tests:

npx jest tests/api/documents.api.test.js —runInBand

Run university tests:

npx jest tests/api/universities.api.test.js —runInBand

Run user tests:

npx jest tests/api/users.api.test.js —runInBand

Run public dataset tests:

npx jest tests/api/public-data.api.test.js —runInBand

Run public-release tests:

npx jest tests/api/public-release.api.test.js —runInBand

Run tests in watch mode:

npx jest tests/api —watch

Generate coverage:

npx jest tests/api —coverage —runInBand

If package.json already defines equivalent scripts, prefer the repository’s established commands.

6. Jest configuration

Use one consistent Jest configuration. If the repository already has a root configuration, merge the relevant settings instead of replacing it.

Example jest.config.cjs:

‘use strict’;
module.exports = {
  testEnvironment: ‘node’,
  testMatch: [
    ‘<rootDir>/tests/api/**/*.api.test.js’,
  ],
  clearMocks: true,
  restoreMocks: true,
  verbose: true,
  testTimeout: 15000,
};

This configuration assumes the API test files use the .api.test.js suffix.

If the project also contains unit, integration, security, accessibility, or end-to-end tests, ensure the root configuration includes those suites as appropriate.

For an ESM project, verify Jest’s module configuration and the format of each test file before applying this CommonJS example.

7. Test environment and database safety

Tests that create, update, or delete records must run against a dedicated test environment.

Example environment variables:

NODE_ENV=test
TEST_DATABASE_URL=mysql://test_user:test_password@127.0.0.1:3306/medorbits_test

The example uses MySQL only as an illustration. Use the database driver and connection configuration implemented by the application. Do not assume MySQL if the application uses PostgreSQL or another database.

Before running database-dependent tests, verify that:

* The test database exists.
* The configured connection targets the test database, not production.
* Required migrations have been applied.
* Required seed data has been loaded.
* Test records can be created and cleaned up safely.
* External gateway integrations use sandbox credentials or controlled mocks.

Never run destructive test setup against a production database.

Do not commit real passwords, access tokens, API keys, webhook secrets, or payment gateway credentials.

8. Authentication helpers

Some API tests require authenticated users with specific roles.

A shared authentication helper should issue valid test credentials through the application’s actual authentication mechanism.

Example interface:

async function authenticateAs(userId, role) {
  // Locate or create a dedicated test user.
  // Assign the intended role using trusted test setup.
  // Authenticate through the application’s real mechanism.
  // Return the issued token and user ID.
}

Expected return shape:

{
  token: ‘test-issued-access-token’,
  userId: ‘TEST-USER-001’,
}

This is an interface example, not a valid token or a complete implementation.

Tests must not bypass authentication by trusting a client-supplied role, user ID, or administrator flag.

Where several test files use the same authentication mechanism, prefer a shared test helper over duplicated implementations.

Load test-only helpers from trusted repository-controlled paths. Do not load arbitrary modules based on untrusted request data or production environment variables.

9. Seed data and fixtures

Tests should use deterministic records created specifically for testing.

Recommended fixture categories:

* Test users with different roles.
* Applications owned by specific test users.
* Pending and completed payment records.
* Documents with known owners and access permissions.
* Universities, colleges, courses, and jobs.
* Published and unpublished public-release records.
* Valid and invalid request payloads.

Use unique test identifiers where appropriate. Seed required records automatically rather than relying on manually created records that may disappear or change.

Relevant test environment variables may include:

TEST_OWNED_PAYMENT_ID=
TEST_PENDING_PAYMENT_ID=
TEST_OTHER_USER_ID=
TEST_FOREIGN_APPLICATION_ID=
UNIVERSITIES_TEST_MAX_LIMIT=100
JOBS_TEST_MAX_LIMIT=100

Populate these variables only with IDs from the dedicated test database.

For static public datasets, document whether tests use repository fixtures, generated data, or a database-backed catalog.

10. Standard API response contracts

Use the response envelope documented by the actual application.

Example success response:

{
  “success”: true,
  “data”: []
}

Example error response:

{
  “success”: false,
  “error”: {
    “code”: “VALIDATION_ERROR”,
    “message”: “Request could not be processed.”
  }
}

These are illustrative examples. Do not require this exact envelope unless it matches the application’s response middleware and controllers.

Where applicable, test:

* HTTP status code.
* JSON content type.
* Required response properties.
* Data types and shape.
* Validation error details.
* Absence of sensitive fields.
* Consistency between success and error responses.

Some endpoints may use different response structures. For example, public-data endpoints may expose data.universities, while public-release endpoints may expose data.notices, data.bulletins, and pagination totals.

Test each endpoint against its own documented contract.

11. HTTP status expectations

Use the status codes defined by each endpoint’s contract.

Status	Typical meaning
200 OK	Successful retrieval or update
201 Created	Resource successfully created
204 No Content	Successful operation with no response body
400 Bad Request	Malformed or invalid request
401 Unauthorized	Authentication is missing or invalid
403 Forbidden	Caller is authenticated but lacks permission
404 Not Found	Resource or endpoint does not exist, or existence is intentionally concealed
405 Method Not Allowed	HTTP method is unsupported
409 Conflict	Resource conflicts with existing state
415 Unsupported Media Type	Unsupported request content type
422 Unprocessable Content	Request content fails validation
429 Too Many Requests	Rate limit exceeded
500 Internal Server Error	Unexpected server failure
503 Service Unavailable	Required service is unavailable

Avoid accepting many unrelated status codes merely to make tests pass.

A 404 response and a 405 response are not interchangeable when the route is documented and implemented. Similarly, a 401 and a 403 represent different authentication and authorization conditions.

For protected endpoints, distinguish between missing credentials, invalid credentials, insufficient permissions, and resources intentionally concealed from unauthorized callers.

12. Security testing requirements

Authentication

Protected endpoints must reject missing or invalid credentials.

Test both successful authentication and rejection cases.

Authorization and IDOR

Users must not access or modify resources belonging to other users unless an explicit policy permits it.

Test resource ownership using at least two separately seeded users.

Mass assignment

Client input must not grant privileged properties such as:

* Administrator roles.
* Ownership of another user’s resources.
* Payment completion status.
* Verification or approval status.
* Unrestricted permissions.

Verify persisted state after attempted privilege escalation. A response that omits a privileged field does not prove that the field was not modified in storage.

Payment integrity

Payment state must be established through trusted server-side gateway verification, not client-supplied status fields.

Webhook requests must follow the configured provider’s signature-verification requirements.

Document access

Document downloads must verify authorization for the requested resource. User-controlled filenames and paths must not allow traversal outside the permitted storage location.

Sensitive-data protection

Responses must not expose:

* Password hashes.
* Authentication secrets.
* Private keys.
* Database connection strings.
* Internal stack traces.
* Unnecessary filesystem paths.
* Raw gateway secrets or credentials.

Security tests should also examine unexpected fields in nested response objects where appropriate.

Input validation

Test malformed JSON, invalid identifiers, unsupported content types, invalid pagination, unexpected fields, oversized payloads, and injection-like input.

A response that avoids a 500 status does not, by itself, prove that input was handled correctly. Validate the expected status and resulting application behavior.

13. Health endpoint testing

Health tests should reflect the routes actually implemented by the application.

Typical endpoints include:

GET /health
GET /health/live
GET /health/ready

A liveness check generally verifies that the process can respond. A readiness check may additionally verify required dependencies and return 503 if the service cannot safely handle traffic.

Do not expose connection strings, environment variables, credentials, or detailed infrastructure errors through health responses.

14. Payment webhook testing

Webhook tests must use the payment provider’s actual signing algorithm and raw request bytes when required by that provider.

The suite should verify:

* Missing signatures are rejected.
* Invalid signatures are rejected.
* Valid test signatures are accepted.
* Invalid events cannot change payment state.
* Repeated events do not create duplicate payment effects.
* Event processing is idempotent.
* Payment amounts and currencies are checked against trusted server-side records.

Do not treat a hard-coded invalid signature as sufficient coverage of successful webhook verification.

For integration tests, use provider sandbox credentials or a controlled mock. Verify that webhook parsing middleware preserves the raw body when the provider requires signature verification over the original request bytes.

Never use live payment credentials in automated tests.

15. Test isolation and cleanup

Each test should be independently repeatable.

Recommended practices:

1. Create test records with unique identifiers.
2. Avoid dependencies on test execution order.
3. Reset or roll back database state when appropriate.
4. Clean up records created by mutation tests.
5. Mock external services when live connectivity is unnecessary.
6. Prevent tests from contacting production payment gateways.
7. Use explicit timeouts for network-dependent operations.
8. Ensure parallel execution cannot corrupt shared fixtures.

When tests share database records, run them serially until isolation is reliable.

16. Test quality standards

API tests should:

* Assert expected outcomes rather than merely asserting that a request did not crash.
* Use exact status codes for established contracts.
* Verify both positive and negative authorization cases.
* Check state before and after security-sensitive operations.
* Avoid swallowing exceptions.
* Avoid unconditional success assertions.
* Avoid using production data.
* Keep test credentials outside version control.
* Include cleanup for records created by tests.
* Clearly identify required setup and seed data.

A placeholder helper that throws an error is an implementation requirement, not a passing test. Complete such helpers before treating the suite as executable.

Tests should not assume that a resource is private, a route is public, or a mutation method is forbidden unless that behavior is part of the actual API contract.

17. Troubleshooting

Cannot find module supertest

Install the development dependency:

npm install —save-dev supertest

Cannot find module ../../src/app

Verify the actual application entry point and adjust the test import accordingly.

Unexpected 404 responses

Check route registration, API prefixes, router mounting, and whether the endpoint is implemented.

Unexpected 401 or 403 responses

Verify the test token, user role, ownership fixture, and authentication middleware.

Database connection failures

Verify NODE_ENV=test, test database credentials, database availability, migrations, and fixture setup.

Payment tests fail before making requests

Implement the authentication and payment-status helpers and seed the required test records.

Tests pass with overly broad status assertions

Replace broad status alternatives with the endpoint’s documented contract and add assertions about response contents and persisted state.

Public-data tests fail on encoded paths

Check Express path decoding, router matching, static-file configuration, and application error middleware. Verify that traversal attempts cannot return files outside the permitted public dataset directory.

Tests disagree about response envelopes

Compare assertions with the actual router, controller, validation schema, and response middleware. Keep each endpoint’s documented contract consistent across tests and implementation.

18. Completion checklist

Before considering the API suite ready:

* [ ]	All listed files exist in the repository.
* [ ]	Every required route matches the actual router.
* [ ]	Authentication helpers use real test-issued credentials.
* [ ]	Test database configuration is isolated from production.
* [ ]	Required fixture records are seeded automatically.
* [ ]	Payment webhook verification uses the provider’s signing rules.
* [ ]	Mutation tests clean up their data.
* [ ]	Security assertions verify actual authorization behavior.
* [ ]	Error responses do not leak sensitive implementation details.
* [ ]	Public dataset paths cannot expose arbitrary files.
* [ ]	Published release endpoints return only records permitted by their publication policy.
* [ ]	Tests pass individually and as a complete suite.
* [ ]	CI runs the tests using test-only credentials and infrastructure.

Maintenance rule

Update this README whenever API test files, route contracts, authentication helpers, fixtures, or test execution commands change.

The actual router, controller, validation schema, middleware, and documented response contract remain the source of truth.