
# MedOrbits — Service Unit Tests

## 1. Purpose

This directory contains unit tests for application services in `src/services/`.

Tests verify business rules, input validation, repository interactions, state transitions, error handling, audit events, and sensitive-data protection.

Service unit tests must run independently using mocked repositories and external dependencies. They must not access production databases, real payment accounts, or external services.

Write tests against implemented service contracts. Do not invent modules, exports, method signatures, or expected behavior.

## 2. Directory Structure

```text
tests/unit/services/
├── application.service.test.js
├── audit.service.test.js
├── auth.service.test.js
├── document.service.test.js
├── payment.service.test.js
├── subscription.service.test.js
└── README.md
```

Add tests for other implemented services as the MedOrbits service inventory grows. Do not create tests for modules that do not exist.

## 3. Test Requirements

### Input Validation

- Reject missing or malformed identifiers.
- Reject invalid status values and unsupported operations.
- Validate required fields, lengths, formats, and numeric ranges.
- Reject invalid payment amounts and currencies.
- Prevent client input from overriding trusted identity or protected fields.

### Business Rules

- Verify successful operations and expected return values.
- Reject invalid state transitions.
- Enforce resource ownership and service-level authorization where applicable.
- Verify account status and eligibility restrictions.
- Prevent duplicate operations where idempotency is required.

### Repository Behavior

- Verify the correct repository methods and arguments are used.
- Handle missing records consistently with the service contract.
- Propagate or translate repository failures according to documented behavior.
- Ensure failed operations do not return fabricated success responses.
- Test database transactions and constraints through integration tests when a real database is required.

### Audit and Notifications

- Verify important actions produce the expected audit events.
- Verify audit metadata excludes secrets and unnecessary personal data.
- Test email, storage, payment, and notification provider failures where applicable.
- Confirm retry or recovery behavior follows the documented policy.

### Authentication and Sessions

- Test registration, login, logout, and session revocation where implemented.
- Verify password hashing and password verification.
- Reject invalid, expired, or consumed reset and verification tokens.
- Ensure secrets and password hashes are not included in service responses.
- Test refresh-token rotation and replay prevention if implemented.

### Documents and Payments

- Validate document ownership, status, and permitted operations.
- Reject unsupported file types and invalid file metadata.
- Test payment creation, provider errors, and payment state transitions.
- Verify duplicate payment events are handled idempotently.
- Test refund authorization and concurrent financial operations through suitable integration tests.

## 4. Standard Test Format

Use Node.js’s built-in test runner and strict assertions unless the project already uses another established test framework.

```javascript
“use strict”;

const test = require(“node:test”);
const assert = require(“node:assert/strict”);

test(“rejects an invalid payment amount”, () => {
  const amount = 0;

  assert.equal(
    Number.isSafeInteger(amount) && amount > 0,
    false
  );
});
```

This is a minimal assertion example, not a complete service test. Actual tests must import and exercise the corresponding MedOrbits service function, using mocked dependencies where appropriate.

### Test quality rules

- Assert observable behavior, not implementation details without a reason.
- Test both successful and failure paths.
- Do not catch and silently ignore unexpected errors.
- Do not use broad assertions that allow unrelated failures to pass.
- Do not treat a skipped test as evidence that a requirement is satisfied.
- Skip tests only when an optional operation genuinely is not implemented; required service operations should be checked against the service contract.
- Use deterministic inputs and avoid dependence on current time, random values, network access, or shared mutable state unless controlled.
- Do not claim coverage for behavior that the test does not exercise.

## 5. Mocking Strategy

- Mock repositories to control returned records and failures.
- Mock payment, email, storage, and notification providers.
- Use deterministic fixtures for users, applications, documents, subscriptions, and payments.
- Verify important calls, arguments, and call counts.
- Restore mocks and clean up state after each test.
- Avoid mocking the business rule that the test is intended to verify.
- Keep production credentials and real provider endpoints out of unit tests.
- Prefer dependency injection or existing project mocking utilities over brittle module-loader manipulation.
- Do not connect to a production database under any circumstances.

## 6. Running Tests

Run commands from the project root.

```bash
# Run all service unit tests
node —test tests/unit/services/*.test.js

# Run an individual service test
node —test tests/unit/services/auth.service.test.js

# Run top-level unit test files
node —test tests/unit/*.test.js

# Run top-level and service unit test files
node —test tests/unit/*.test.js tests/unit/services/*.test.js
```

Shell glob expansion varies by environment. On shells that do not expand these patterns as expected, use the project’s configured test script or pass explicit file paths.

If `package.json` defines an appropriate test command, prefer:

```bash
npm test
```

Use the test runner and flags configured by the repository. Do not mix Jest-specific APIs with `node:test` unless the project explicitly supports both.

## 7. Naming Conventions

Use the following pattern:

`<service-name>.service.test.js`

Examples:

- `auth.service.test.js`
- `application.service.test.js`
- `audit.service.test.js`
- `document.service.test.js`
- `payment.service.test.js`
- `subscription.service.test.js`

Test names should describe the behavior being verified, for example:

- `rejects invalid input`
- `returns not found when the record does not exist`
- `handles repository failures`
- `records the expected audit event`
- `does not expose password hashes`
- `prevents duplicate payment processing`

## 8. Completion Checklist

- [ ] Each implemented service has relevant unit tests.
- [ ] Successful and failure paths are covered.
- [ ] Validation and business rules are tested.
- [ ] Repository and provider failures are covered.
- [ ] Sensitive data is excluded from responses and logs.
- [ ] Audit behavior matches the documented reliability policy.
- [ ] Tests run deterministically and independently.
- [ ] Mocks and mutable state are cleaned up.
- [ ] Tests run in the configured test environment.
- [ ] No production credentials or external payment accounts are used.
- [ ] Test results reflect actual execution, not assumptions.

## 9. Related Test Suites

- `tests/unit/policies/` — authorization decisions.
- `tests/integration/` — controllers, repositories, database constraints, and external integrations.
- `tests/integration/payments/` — webhook processing, duplicate events, and concurrent refunds.
- `tests/security/` — privilege escalation, insecure direct object references (IDOR), mass assignment, and sensitive-data exposure.
- `tests/api/` — HTTP endpoint contracts.
- `tests/e2e/` — complete user workflows.

Create or reference these directories only as they are implemented in the repository.

## 10. Security Boundary

Service unit tests do not replace authorization tests, database constraints, or real integration tests.

Verify critical financial operations, concurrent state transitions, webhook signature verification, and actual endpoint access controls in the appropriate integration and security suites.

A passing unit test demonstrates only the behavior it exercises under its configured test conditions. It does not independently establish that the entire application is secure.
```
