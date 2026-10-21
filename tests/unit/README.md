
# MedOrbits — Unit Tests

## 1. Purpose

This directory contains unit tests for implemented MedOrbits policies, services, middleware, utilities, and validators.

Tests must be deterministic, isolated, fast, and independent of production services and production data. Use controlled inputs, fixtures, and mocks.

## 2. Directory Structure

```text
tests/unit/
├── policies/
│   ├── admission.policy.test.js
│   ├── application.policy.test.js
│   ├── auth.policy.test.js
│   ├── candidate.policy.test.js
│   ├── college.policy.test.js
│   ├── counselling.policy.test.js
│   ├── course.policy.test.js
│   ├── document.policy.test.js
│   ├── employer.policy.test.js
│   ├── internship.policy.test.js
│   ├── job.policy.test.js
│   ├── payment.policy.test.js
│   ├── policy-utils.test.js
│   ├── subscription.policy.test.js
│   ├── university.policy.test.js
│   └── user.policy.test.js
├── services/
│   ├── application.service.test.js
│   ├── audit.service.test.js
│   ├── auth.service.test.js
│   ├── document.service.test.js
│   ├── payment.service.test.js
│   └── subscription.service.test.js
├── middleware.test.js
├── services.test.js
├── utils.test.js
├── validators.test.js
└── README.md
```

Only add tests for modules that exist and are implemented. Add `recruitment.policy.test.js` when the corresponding policy exists.

## 3. Test Categories

### Policy Tests

Verify:
- Owner and non-owner access.
- Administrator and permission-based access.
- Counsellor, employer, and recruiter restrictions.
- Unauthenticated access denial.
- Protected-field modification attempts.
- Invalid status transitions.
- Access restrictions for private records and candidate data.

### Service Tests

Verify:
- Input validation and business rules.
- Repository success, empty results, and failure behavior.
- Invalid state transitions.
- Audit-event creation and audit-provider failure handling.
- Secret redaction and response sanitization.
- Payment and subscription lifecycle behavior.
- Duplicate requests and idempotency where applicable.

### Middleware Tests

Verify:
- Authentication requirements.
- Authorization enforcement.
- Request validation.
- Rate limiting.
- Standardized error handling.
- Correct handling of rejected asynchronous middleware.

### Utility and Validator Tests

Verify:
- ID and pagination normalization.
- Object and string validation.
- Missing, invalid, and oversized input.
- Consistent error codes and response behavior.
- Boundary values and malformed input.

## 4. Test Framework

Use Node.js’s built-in test runner (`node:test`) and assertions (`node:assert/strict`) unless the project already standardizes on another test framework.

Example:

```javascript
‘use strict’;

const test = require(‘node:test’);
const assert = require(‘node:assert/strict’);

test(‘returns the expected result’, () => {
  assert.equal(2 + 2, 4);
});
```

Do not mix test-runner APIs in the same test file. If the project uses Jest, retain Jest APIs consistently and run the tests with Jest.

## 5. Running Tests

From the project root:

```bash
# Run all unit tests using Node’s test runner
node —test

# Run a specific policy test
node —test tests/unit/policies/application.policy.test.js

# Run a specific service test
node —test tests/unit/services/payment.service.test.js
```

Node’s test discovery can discover files matching supported test naming conventions. Explicit paths are more portable than shell-dependent recursive globs.

If `package.json` defines a suitable test script, prefer:

```bash
npm test
```

If the project uses Jest instead, run:

```bash
npx jest tests/unit —runInBand
```

Configure the test script to match the test runner actually used by the repository. Do not assume that a passing test command executed every intended test file.

## 6. Mocking and Fixtures

- Mock repositories, payment providers, email providers, and external APIs.
- Use deterministic fixtures for users, applications, documents, payments, and subscriptions.
- Never connect unit tests to production databases or production payment accounts.
- Use fake clocks or fixed dates for time-dependent behavior.
- Restore mocks and clean up temporary state after each test.
- Ensure each test can run independently.
- Avoid real network requests, random uncontrolled values, and arbitrary sleeps.

## 7. Security Requirements

- Test both allowed and denied authorization cases.
- Never trust roles, permissions, ownership IDs, or payment status supplied by clients.
- Verify that secrets and sensitive personal information are not returned.
- Test mass-assignment protections for privileged fields.
- Verify that repository and provider failures cannot produce false success responses.
- Verify that payment operations are safe against duplicate processing where applicable.
- Test access to records belonging to other users.
- Do not treat a policy unit test as proof that an HTTP endpoint enforces the policy.

## 8. Naming Conventions

- Policy: `<name>.policy.test.js`
- Service: `<name>.service.test.js`
- Middleware: `<name>.middleware.test.js`
- Utilities: `<name>.test.js`

Use descriptive test names beginning with `allows`, `denies`, `rejects`, `returns`, or `throws`.

## 9. Completion Criteria

A unit test is complete when it:

1. Tests a real, implemented module.
2. Covers expected behavior and relevant failure cases.
3. Includes authorization-denial cases where applicable.
4. Uses isolated dependencies and deterministic fixtures.
5. Runs independently and reliably.
6. Passes in the repository’s configured test environment.
7. Does not rely on production data or credentials.

## 10. Related Test Suites

Other test responsibilities belong in:

- `tests/integration/` — database, controllers, repositories, and external integrations.
- `tests/security/` — privilege escalation, IDOR, mass assignment, and sensitive-data exposure.
- `tests/api/` — HTTP endpoint contracts.
- `tests/e2e/` — complete user workflows.
- `tests/accessibility/` — keyboard, screen-reader, and accessibility checks.
```

**Important:** The README is documentation, not proof that the listed files exist or pass. Keep the directory tree synchronized with the actual repository and use one consistent test runner per test file.