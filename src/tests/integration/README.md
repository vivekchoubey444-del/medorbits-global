
# MedOrbits — Integration Tests

**Directory:** `tests/integration/`  
**Runtime:** Node.js >= 20  
**Test runner:** Node.js built-in test runner (`node:test`)  
**Execution context:** Dedicated test environment with isolated data and sandboxed external services

## 1. Purpose

Integration tests verify that MedOrbits components work together correctly across application boundaries.

They complement unit, security, and end-to-end tests by validating observable behavior across connected components, including:

- HTTP routes, middleware, controllers, and services.
- Services and repository implementations.
- Database operations, constraints, and transactions.
- Authentication, authorization, and resource ownership.
- Application submission and retrieval workflows.
- Payment creation, refunds, and webhook processing.
- Notification creation, delivery, and persistence.
- Concurrent operations, idempotency, and failure recovery.

Integration tests must exercise actual component boundaries and verify the behavior promised by the application contract. They must not assume that a route, feature, or test file exists merely because it appears in this documentation.

## 2. Directory Structure

Reference inventory:

```text
tests/
└── integration/
    ├── README.md
    ├── application.integration.test.js
    ├── auth.integration.test.js
    ├── controllers.integration.test.js
    ├── database-constraints.integration.test.js
    ├── notification.integration.test.js
    ├── payments.integration.test.js
    ├── repositories.integration.test.js
    └── payments/
        ├── README.md
        ├── concurrent-refunds.integration.test.js
        ├── duplicate-events.integration.test.js
        └── webhook.integration.test.js
```

This is a reference inventory, not a guarantee that every listed file exists or is complete. Check the repository before running individual tests and keep this inventory synchronized with the actual files.

## 3. Runtime Requirements

- Node.js 20 or later.
- Project dependencies installed from the existing lockfile.
- MedOrbits configured for a dedicated test environment.
- An isolated test database for persistence-related tests.
- Valid test credentials for authenticated workflows.
- Seeded test users and fixtures where required.
- A running test API for HTTP-based integration tests.
- Provider sandboxes, deterministic mocks, or test transports for external services.

Use the project’s existing package scripts and configuration as the source of truth for setup and execution.

## 4. Test Categories

### 4.1 Application integration

**File:** `application.integration.test.js`

Where implemented, verify:

- Valid application submission.
- Rejection of invalid or incomplete payloads.
- Retrieval of persisted applications.
- Authentication and ownership enforcement.
- Handling of malformed and nonexistent identifiers.
- Appropriate validation and error responses.
- Persistence across independent requests.

Use the actual application schema, route definitions, and API contract. Do not assume optional fields are accepted unless the implementation documents them.

### 4.2 Authentication integration

**File:** `auth.integration.test.js`

Verify:

- Successful authentication with valid test credentials.
- Rejection of invalid credentials.
- Protection of authenticated endpoints.
- Missing, malformed, expired, or invalid token behavior where supported.
- Correct authenticated identity propagation.
- Session or token invalidation where implemented.
- Exclusion of credentials and secrets from API responses.

Never use production credentials or real customer accounts.

### 4.3 Controller integration

**File:** `controllers.integration.test.js`

Exercise controllers through the actual route and middleware stack.

Cover:

- Request parsing and validation.
- Service invocation and response mapping.
- Authentication and authorization.
- Documented success and error responses.
- Expected service and repository failures.
- Appropriate HTTP status codes.
- Consistent response serialization.

Keep isolated business-rule tests in the unit-test suite.

### 4.4 Database constraints

**File:** `database-constraints.integration.test.js`

Verify relevant database guarantees:

- Primary-key and unique constraints.
- Required fields and nullability.
- Foreign-key integrity where supported.
- Relationships between dependent records.
- Transaction rollback after failed operations.
- Referential integrity during updates and deletes.
- Concurrent writes where database-level guarantees are required.

Use an isolated test database with the same database engine and relevant migrations as the target deployment.

Application-level validation does not replace database constraints.

### 4.5 Notification integration

**File:** `notification.integration.test.js`

Where implemented, verify:

- Notification creation and persistence.
- Association with the intended user or resource.
- Authorization for notification retrieval.
- Read/unread state changes.
- Duplicate-notification handling where required.
- Graceful handling of delivery-provider failures.
- Protection of private notification content.

Use a test transport or mocked delivery provider. Do not send real notifications to users.

### 4.6 Payment integration

**File:** `payments.integration.test.js`

Use a payment-provider sandbox or deterministic test doubles.

Cover:

- Payment creation and retrieval.
- Amount and currency validation.
- Authentication and resource ownership.
- Protection against client-supplied payment-state escalation.
- Refund validation and authorization.
- Safe handling of provider errors.
- Idempotency and persistence guarantees where implemented.
- Exclusion of payment secrets and sensitive data from responses.

Never use real payment credentials or initiate real charges in automated tests.

Payment amounts must follow the units defined by the API contract. If amounts are represented in minor units, tests should use integer minor-unit values consistently.

A successful HTTP response alone does not establish that a payment has been settled by the provider.

### 4.7 Repository integration

**File:** `repositories.integration.test.js`

Distinguish between HTTP-level integration tests and direct repository tests.

Where direct repository tests are implemented, cover:

- Create, read, update, and delete operations.
- Persistence across independent database sessions or requests.
- Filtering, pagination, and sorting where supported.
- Transaction behavior and rollback.
- Uniqueness and relationship constraints.
- Handling of nonexistent records.
- Isolation between users or tenants.
- Safe parameterized database operations.

Direct repository tests should import the actual repository modules once their paths and interfaces are confirmed. Tests that exercise `/api/...` routes are API-level integration tests, even if their filenames contain `repositories`.

### 4.8 Payment-specific integration tests

**Directory:** `payments/`

- `webhook.integration.test.js` — provider signature validation, event processing, and rejection of forged webhook requests.
- `duplicate-events.integration.test.js` — idempotent processing of repeated provider events.
- `concurrent-refunds.integration.test.js` — concurrent refund requests, persisted state consistency, and prevention of over-refunding.
- `README.md` — payment-specific setup and execution instructions.

Use provider test events and isolated records. Concurrency tests must verify persisted outcomes, not just HTTP response codes.

## 5. Environment Configuration

Use the environment-variable names expected by the relevant test file and application configuration. Do not assume every test consumes the same variables.

Example shell configuration:

```bash
export NODE_ENV=test
export TEST_BASE_URL=http://127.0.0.1:3000

# Example credentials for repository tests
export REPOSITORY_TEST_USER_A_TOKEN=‘test-user-a-token’
export REPOSITORY_TEST_USER_B_TOKEN=‘test-user-b-token’

# Explicit opt-in for repository mutations
export RUN_MUTATING_REPOSITORY_TESTS=true
```

The variables above are examples, not universal requirements.

### 5.1 Payment-specific configuration

The payment integration tests support the following variables:

| Variable | Purpose |
|—|—|
| `PAYMENT_TEST_BASE_URL` | Payment test API base URL |
| `TEST_BASE_URL` | Fallback API base URL |
| `PAYMENTS_TEST_PATH` | Payment collection endpoint |
| `PAYMENT_TEST_PATH` | Payment detail endpoint; supports `:id` |
| `PAYMENT_REFUNDS_TEST_PATH` | Refund endpoint; supports `:id` |
| `PAYMENT_TEST_USER_A_TOKEN` | Primary test-user token |
| `PAYMENT_TEST_TOKEN` | Fallback primary test-user token |
| `PAYMENT_TEST_USER_B_TOKEN` | Second test-user token |
| `TEST_PAYMENT_ID` | Existing payment fixture for read and ownership tests |
| `PAYMENT_TEST_REFUND_PAYMENT_ID` | Separate disposable payment fixture for refund validation |
| `TEST_PAYMENT_AMOUNT_MINOR` | Positive integer payment amount in minor currency units |
| `TEST_PAYMENT_CURRENCY` | Three-letter currency code |
| `PAYMENT_TEST_TIMEOUT_MS` | Request timeout in milliseconds |
| `RUN_MUTATING_PAYMENT_TESTS` | Enables payment mutation tests |
| `RUN_PAYMENT_REFUND_TESTS` | Enables refund validation tests |
| `PAYMENT_TEST_ALLOW_REMOTE_MUTATIONS` | Explicit remote-mutation opt-in |
| `PAYMENT_TEST_ENVIRONMENT` | Must be `sandbox` for remote mutation tests |
| `PAYMENT_TEST_CI_MUTATIONS` | Additional opt-in for mutation tests in CI |

The payment test file also accepts `TEST_BASE_URL` as a fallback. Use the precise variable names in the current test implementation rather than introducing aliases without updating the code.

### 5.2 Environment safety requirements

- Use a dedicated test database.
- Keep credentials outside source control.
- Never point destructive tests at production.
- Do not commit `.env` files, API secrets, tokens, or database connection strings.
- Use sandbox credentials and endpoints for external providers.
- Enable remote mutations only when the target is an isolated, explicitly designated sandbox.
- Use disposable fixtures for updates, deletions, and refund tests.

Mutation flags are safety controls, not substitutes for verifying the target environment.

## 6. Prepare the Test Environment

Before running the suite:

1. Install dependencies with the package manager and lockfile used by the project.
2. Configure the test environment.
3. Create or select a dedicated test database.
4. Apply the application’s test migrations or schema initialization.
5. Seed the minimum required test users, roles, and records.
6. Start the application with test configuration for HTTP-based tests.
7. Verify that test credentials have the expected permissions.
8. Configure external services to use sandboxes, mocks, or test transports.
9. Confirm that cleanup procedures cannot reach production resources.

Use deterministic fixtures and unique identifiers to prevent collisions between tests or concurrent runs.

## 7. Running the Tests

Run commands from the repository root.

### 7.1 Complete integration suite

On POSIX-compatible shells, this command runs matching top-level and nested test files:

```bash
node —test tests/integration/*.test.js tests/integration/payments/*.test.js
```

This is an explicit file-pattern command. It does not guarantee that every test file in the repository is covered, particularly if future files are added in other nested directories.

For a more comprehensive discovery run, use the project’s existing test script if it is configured to discover all integration tests.

### 7.2 Run individual test files

```bash
node —test tests/integration/application.integration.test.js
node —test tests/integration/auth.integration.test.js
node —test tests/integration/controllers.integration.test.js
node —test tests/integration/database-constraints.integration.test.js
node —test tests/integration/notification.integration.test.js
node —test tests/integration/payments.integration.test.js
node —test tests/integration/repositories.integration.test.js
```

Run only commands for files present in the current checkout.

### 7.3 Run payment-specific tests

```bash
node —test tests/integration/payments/webhook.integration.test.js
node —test tests/integration/payments/duplicate-events.integration.test.js
node —test tests/integration/payments/concurrent-refunds.integration.test.js
```

### 7.4 Run through package scripts

Inspect `package.json` before adding or changing project-wide scripts:

```bash
npm run
```

If the repository already defines a dedicated integration-test script, prefer that script so its setup, environment, and teardown steps are preserved.

### 7.5 Mutation tests

Mutation tests are disabled by default. Enable them only against an isolated test environment.

Example for payment tests:

```bash
NODE_ENV=test \
RUN_MUTATING_PAYMENT_TESTS=true \
PAYMENT_TEST_BASE_URL=http://127.0.0.1:3000 \
PAYMENT_TEST_USER_A_TOKEN=‘test-user-a-token’ \
node —test tests/integration/payments.integration.test.js
```

The command above does not enable refund tests. Refund tests additionally require `RUN_PAYMENT_REFUND_TESTS=true` and a disposable fixture configured with `PAYMENT_TEST_REFUND_PAYMENT_ID`.

## 8. Test Design Requirements

### 8.1 Isolation

Each test must have a defined data boundary.

- Use unique identifiers for records created during a test.
- Avoid depending on execution order.
- Avoid modifying records shared by unrelated tests.
- Restore changed state or delete test-created records where safe.
- Use transactions or disposable database instances where appropriate.
- Make cleanup safe after partial test failure.
- Avoid using the same fixture for unrelated destructive operations.

### 8.2 Persistence verification

When testing a write, verify the persisted result independently.

A successful HTTP response does not prove that a record was committed. Re-read the record through the appropriate repository, database session, or API endpoint.

For asynchronous operations, poll the documented status endpoint or query the appropriate persistence layer within a bounded timeout.

### 8.3 Authentication and ownership

Test authorized and unauthorized scenarios.

- Users must not access another user’s private records.
- Administrative operations must require appropriate privileges.
- Client-supplied ownership fields must not override authenticated identity.
- Unauthenticated requests must not bypass protected middleware.
- A 404 response may be appropriate when concealing record existence.

Use fixtures with independently established ownership. Cross-user tests are meaningful only when the fixture owner and test identities are known.

### 8.4 Error handling

Assert documented error behavior without depending on implementation-specific stack traces.

Verify responses do not disclose:

- SQL queries or database connection strings.
- Stack traces and filesystem paths.
- Password hashes, access tokens, refresh tokens, or secrets.
- Internal provider credentials.
- Sensitive personal or payment information.

Do not rely exclusively on pattern matching. Use explicit response schemas and structured error contracts where available.

### 8.5 Concurrency and idempotency

For operations that may execute concurrently:

- Send concurrent requests against the same isolated fixture.
- Verify the final persisted state.
- Confirm duplicate requests do not create unintended records.
- Verify refunds, balances, inventory, and payment state preserve business invariants.
- Check that transaction isolation and database constraints enforce the intended guarantees.

Tests must distinguish an HTTP request being accepted from a transaction being committed successfully.

### 8.6 External services

External systems should be sandboxed or mocked, including:

- Payment providers.
- Email and SMS gateways.
- Cloud storage.
- Identity providers.
- External education and recruitment APIs.

Tests must not depend on production services or deliver real communications.

## 9. Database and Cleanup Policy

Integration tests must use a dedicated database or isolated schema.

- Never truncate tables in a shared or production database.
- Never run destructive migrations against production.
- Use explicit test fixtures and deterministic teardown.
- Preserve audit records when testing audit requirements.
- Verify rollback behavior for failed transactions.
- Ensure concurrent test runs cannot delete one another’s data.

Use transaction-based test isolation where appropriate. Tests involving multiple connections, background jobs, or committed transactions may require disposable records or a dedicated database.

## 10. Failure Diagnosis

| Symptom | Possible cause | Recommended action |
|—|—|—|
| Connection refused | Application is not running or URL is incorrect | Start the test server and verify the base URL |
| 401 Unauthorized | Missing, invalid, or expired test token | Generate valid test credentials |
| 403 Forbidden | Fixture ownership or permissions are incorrect | Verify the test user’s role and record owner |
| 404 Not Found | Incorrect route, identifier, or fixture | Check route registration and seeded data |
| 400 or 422 | Payload does not match the API contract | Use the documented request schema |
| Duplicate-key error | Test data is reused or not isolated | Generate unique identifiers and clean up safely |
| Database connection failure | Test database is unavailable or misconfigured | Check the database configuration |
| Payment or refund test skipped | Required credentials, fixture, or opt-in flag is missing | Configure the documented test variables |
| Flaky concurrency test | Shared fixtures, timing assumptions, or missing transactional guarantees | Isolate fixtures and assert final persisted state |

## 11. Acceptance Criteria

An integration test is complete when it:

- Exercises a real component boundary.
- Uses an isolated and reproducible test environment.
- Verifies observable behavior rather than implementation details alone.
- Covers relevant success, validation, authorization, and failure paths.
- Confirms persisted state when testing writes.
- Cleans up test data safely.
- Does not use production credentials or real customer data.
- Passes consistently when run independently and with the suite.
- Documents required fixtures and environment variables.
- Makes no claims about behavior the test does not actually verify.

## 12. Relationship to Other Test Suites

| Test suite | Primary responsibility |
|—|—|
| `tests/unit/` | Isolated functions, validators, services, and business rules |
| `tests/integration/` | Interactions across routes, services, repositories, and persistence |
| `tests/security/` | Authentication, authorization, access control, and abuse resistance |
| End-to-end suite, if present | Complete user journeys across the application |

Avoid duplicating every unit or security test here. Focus on whether connected components enforce the intended behavior.

## 13. Maintenance

When an API route, repository contract, database schema, or authorization policy changes:

1. Update the corresponding integration tests.
2. Update test fixtures and environment-variable documentation.
3. Confirm migrations and database constraints match the intended behavior.
4. Run the affected test file.
5. Run the complete integration suite.
6. Review cleanup and verify that no production resources are referenced.
7. Update this README when the suite structure or execution process changes.

**Maintenance rule:** Keep test paths, environment variables, request payloads, response assertions, and setup instructions aligned with the actual MedOrbits implementation. Example routes and optional test files do not prove that the corresponding functionality exists.
