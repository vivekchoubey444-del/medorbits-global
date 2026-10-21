  
# MedOrbits — Integration Tests

**Directory:** `tests/integration/`  
**Runtime:** Node.js >= 20  
**Test runner:** Node.js built-in test runner (`node:test`)

## 1. Purpose

Integration tests verify that MedOrbits components work together correctly across application boundaries.

They cover interactions among:

- HTTP routes, middleware, controllers, and services.
- Services and repository implementations.
- Repository operations and the test database.
- Authentication and authorization middleware.
- Application submission and retrieval workflows.
- Payment processing, refunds, and webhook handling.
- Notification delivery and persistence.
- Database constraints, transactions, and concurrent operations.

Integration tests complement unit tests and security tests. They do not replace either category.

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

This is a reference inventory, not a guarantee that every listed file exists or is fully implemented. Keep the documentation synchronized with the repository.

## 3. Runtime Requirements

- Node.js 20 or later.
- MedOrbits configured for a dedicated test environment.
- A test database for tests involving persistence.
- Valid test credentials for authenticated workflows.
- Provider sandbox credentials or deterministic mocks where applicable.
- Network access to the test application for HTTP-based tests.

Use the project’s existing test configuration if it specifies a different runner or setup procedure.

## 4. Test Categories

### 4.1 Application integration

**File:** `application.integration.test.js`

Verify:

- Valid application submissions.
- Invalid and incomplete payload rejection.
- Retrieval of persisted applications.
- Authentication and ownership enforcement.
- Handling of nonexistent application identifiers.
- Validation and error responses.
- Persistence across independent requests.

Use the actual application request schema and documented API contract.

### 4.2 Authentication integration

**File:** `auth.integration.test.js`

Verify:

- Successful authentication with valid test credentials.
- Rejection of invalid credentials.
- Authentication requirements for protected endpoints.
- Missing, malformed, expired, or invalid tokens where supported.
- Correct identity propagation to downstream handlers.
- Session or token invalidation where implemented.
- Exclusion of passwords, hashes, tokens, and secrets from responses.

Never use production credentials or real customer accounts.

### 4.3 Controller integration

**File:** `controllers.integration.test.js`

Exercise controllers through the actual routing and middleware stack.

Cover:

- Request parsing and validation.
- Service invocation and response mapping.
- Authentication and authorization.
- Standard success and error responses.
- Expected service and repository failures.
- Appropriate HTTP status codes.

Keep isolated business-rule tests in the unit-test suite.

### 4.4 Database constraints

**File:** `database-constraints.integration.test.js`

Verify:

- Primary-key uniqueness.
- Required unique constraints.
- Foreign-key integrity where supported.
- Required fields and nullability.
- Relationships between dependent records.
- Transaction rollback after failed operations.
- Referential integrity during updates and deletes.

Run against an isolated test database using the same database engine and relevant migrations as the target deployment.

Application-level validation does not replace database constraints.

### 4.5 Notification integration

**File:** `notification.integration.test.js`

Verify:

- Notification creation and persistence where implemented.
- Association with the intended user or resource.
- Authorization for notification retrieval.
- Read/unread state changes where supported.
- Duplicate-notification handling where required.
- Graceful handling of delivery-provider failures.
- Protection of private notification content.

Use a test transport or mocked delivery provider. Do not send real notifications to users.

### 4.6 Payment integration

**File:** `payments.integration.test.js`

Use a provider sandbox or deterministic test doubles to verify:

- Payment creation and retrieval.
- Input validation and currency handling.
- Authorization and resource ownership.
- Valid and invalid payment state transitions.
- Refund validation and authorization.
- Safe handling of provider errors.
- Idempotency and persistence guarantees.
- Exclusion of secrets and sensitive payment data from responses.

Never use real payment credentials or initiate real charges in automated tests.

### 4.7 Repository integration

**File:** `repositories.integration.test.js`

Repository integration tests should exercise the actual persistence layer. HTTP tests should be documented as API-level integration tests instead.

Where direct repository tests are implemented, cover:

- Create, read, update, and delete.
- Persistence across independent database sessions or requests.
- Filtering, pagination, and sorting where supported.
- Transaction behavior and rollback.
- Uniqueness and relationship constraints.
- Handling of nonexistent records.
- Isolation between users or tenants.
- Safe parameterized database operations.

Direct repository tests should import the actual repository modules once their paths and interfaces are confirmed.

### 4.8 Payment-specific integration tests

Directory: `payments/`

- `webhook.integration.test.js` — signature validation, event processing, and rejection of forged webhook requests.
- `duplicate-events.integration.test.js` — idempotent processing of repeated provider events.
- `concurrent-refunds.integration.test.js` — concurrent refund requests, state consistency, and prevention of over-refunding.
- `README.md` — payment-specific setup and execution instructions.

Use provider test events and isolated records. Concurrency tests must verify persisted outcomes, not just HTTP response codes.

## 5. Environment Configuration

Configure the application URL, credentials, database, and external services using the project’s established environment-variable conventions.

Example shell configuration:

```bash
export NODE_ENV=test
export TEST_BASE_URL=“http://127.0.0.1:3000”

# Optional test credentials
export REPOSITORY_TEST_USER_A_TOKEN=“test-user-a-token”
export REPOSITORY_TEST_USER_B_TOKEN=“test-user-b-token”

# Enable only against an isolated test environment
export RUN_MUTATING_REPOSITORY_TESTS=true
```

These variables are examples. Set only variables consumed by the test files being run.

If the application requires a database URL, use the environment-variable name expected by its existing configuration. Never point destructive tests at production or a shared database containing real user data.

Do not commit `.env` files, credentials, API secrets, access tokens, or production connection strings.

## 6. Prepare the Test Environment

Before running integration tests:

1. Install dependencies using the package manager and lockfile used by the project.
2. Configure the test environment.
3. Create or select a dedicated test database.
4. Apply the application’s test migrations or schema initialization.
5. Seed the minimum required test users, roles, and records.
6. Start the application with test configuration when tests use HTTP.
7. Confirm test users have the expected permissions.
8. Configure external services to use sandboxes, mocks, or test transports.
9. Verify cleanup procedures cannot reach production resources.

Use deterministic fixtures and unique identifiers to prevent test collisions.

## 7. Running the Tests

Run the complete integration suite from the repository root:

```bash
node —test tests/integration/*.test.js
```

The command above discovers top-level integration test files. It does not reliably discover tests inside nested directories on every shell.

To include the payment-specific directory, run:

```bash
node —test tests/integration/*.test.js tests/integration/payments/*.test.js
```

Alternatively, run all matching files with a shell that supports recursive glob expansion:

```bash
node —test tests/integration/**/*.test.js
```

If recursive glob expansion is unsupported or does not match the expected files, use the explicit command above.

### Run individual test files

```bash
node —test tests/integration/application.integration.test.js
node —test tests/integration/auth.integration.test.js
node —test tests/integration/controllers.integration.test.js
node —test tests/integration/database-constraints.integration.test.js
node —test tests/integration/notification.integration.test.js
node —test tests/integration/payments.integration.test.js
node —test tests/integration/repositories.integration.test.js
```

### Run payment-specific tests

```bash
node —test tests/integration/payments/webhook.integration.test.js
node —test tests/integration/payments/duplicate-events.integration.test.js
node —test tests/integration/payments/concurrent-refunds.integration.test.js
```

Run commands only for files that exist in the current checkout. Confirm the scripts and runner configuration in `package.json` before adding or replacing project-wide scripts.

## 8. Test Design Requirements

### 8.1 Isolation

Each test must have a defined data boundary.

- Use unique identifiers for records created during a test.
- Avoid depending on execution order.
- Avoid modifying records shared by unrelated tests.
- Restore changed state or delete test-created records where safe.
- Use transactions or disposable database instances where appropriate.
- Make cleanup safe after partial test failure.

### 8.2 Persistence verification

When testing a write, verify the persisted result independently.

A successful HTTP response does not prove that a record was committed. Re-read the record through the appropriate repository, database session, or API endpoint.

For direct database tests, verify the final state using the actual persistence layer.

### 8.3 Authorization and ownership

Test authorized and unauthorized scenarios.

- Users must not access another user’s private records.
- Administrative operations must require appropriate privileges.
- Client-supplied ownership fields must not override authenticated identity.
- Unauthenticated requests must not bypass protected middleware.
- A 404 response may be appropriate when concealing record existence.

Use fixtures with known ownership. Cross-user tests are meaningful only when record ownership is established independently.

### 8.4 Error handling

Assert documented error behavior without depending on implementation-specific stack traces.

Verify responses do not disclose:

- SQL queries or database connection strings.
- Stack traces and filesystem paths.
- Password hashes, access tokens, refresh tokens, or secrets.
- Internal provider credentials.
- Sensitive personal or payment information.

### 8.5 Concurrency and idempotency

For operations that may execute concurrently:

- Send concurrent requests against the same isolated fixture.
- Verify the final persisted state.
- Confirm duplicate requests do not create unintended records.
- Verify refunds, balances, inventory, and payment state preserve business invariants.
- Check that transaction isolation and database constraints enforce the intended guarantees.

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

Use transaction-based test isolation where appropriate. For tests involving multiple connections, background jobs, or committed transactions, use disposable records or a dedicated test database instead.

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

**Maintenance rule:** Keep test paths, environment variables, request payloads, and response assertions aligned with the actual MedOrbits implementation. Example routes and optional test files do not prove that the corresponding functionality exists.
