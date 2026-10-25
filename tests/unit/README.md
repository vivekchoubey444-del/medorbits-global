
# MedOrbits — Unit Tests

## 1. Purpose

This directory contains unit tests for implemented MedOrbits policies, services, middleware, utilities, and validators.

Tests must be deterministic, isolated, fast, and independent of production services and production data. Use controlled inputs, fixtures, and mocks.

Test only modules that exist and are implemented. Do not create placeholder tests that imply unimplemented functionality is covered.

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

This tree describes the intended organization, not a guarantee that every listed file exists.

- Add tests only for implemented modules.
- Add `recruitment.policy.test.js` when the corresponding policy is implemented.
- Keep filenames, import paths, and documentation synchronized with the repository.
- Avoid duplicate coverage unless the separate test suites have clearly defined responsibilities.

## 3. Test Categories

### 3.1 Policy Tests

Verify:

- Owner and non-owner access.
- Administrator and permission-based access.
- Counsellor, employer, and recruiter restrictions.
- Unauthenticated access denial.
- Protected-field modification attempts.
- Invalid status transitions.
- Access restrictions for private records and candidate data.
- Explicit deny-by-default behavior where required.
- Missing, malformed, or contradictory authorization context.
- Cross-user and cross-organization access restrictions.

Policy tests establish the behavior of the policy module itself. They do not prove that controllers, routes, or middleware correctly invoke that policy.

### 3.2 Service Tests

Verify:

- Input validation and business rules.
- Repository success, empty results, and failure behavior.
- Invalid state transitions.
- Audit-event creation and audit-provider failure handling.
- Secret redaction and response sanitization.
- Payment and subscription lifecycle behavior.
- Duplicate requests and idempotency where applicable.
- Transaction rollback and partial-failure handling where supported.
- Repository results containing missing or malformed data.
- Provider timeouts, rejected promises, and retry behavior where implemented.

### 3.3 Middleware Tests

Verify:

- Authentication requirements.
- Authorization enforcement.
- Request validation.
- Rate limiting.
- Standardized error handling.
- Correct handling of rejected asynchronous middleware.
- Correct propagation of errors to centralized handlers.
- Request-context and correlation-ID behavior.
- Security-sensitive headers and input boundaries where implemented.

### 3.4 Utility and Validator Tests

Verify:

- ID and pagination normalization.
- Object and string validation.
- Missing, invalid, and oversized input.
- Consistent error codes and response behavior.
- Boundary values and malformed input.
- Unexpected data types and Unicode input.
- Non-mutation of caller-owned input where required.

## 4. Test Framework

Use Node.js’s built-in test runner (`node:test`) and assertions (`node:assert/strict`) unless the repository already standardizes on another test framework.

### Example using Node.js

```javascript
‘use strict’;

const test = require(‘node:test’);
const assert = require(‘node:assert/strict’);

test(‘returns the expected result’, () => {
  assert.equal(2 + 2, 4);
});
```

Do not mix test-runner APIs within a single test file.

If the repository uses Jest, retain Jest APIs consistently and run tests with Jest. Before adding new tests, inspect `package.json`, existing test files, and the project’s module configuration to establish the actual runner and module format.

Use the same framework for a suite unless a deliberate migration is underway.

## 5. Running Tests

Run commands from the project root.

### Node.js built-in test runner

```bash
# Run all tests discovered by Node’s test runner.
node —test

# Run a specific policy test.
node —test tests/unit/policies/application.policy.test.js

# Run a specific service test.
node —test tests/unit/services/payment.service.test.js

# Run the middleware test file.
node —test tests/unit/middleware.test.js
```

Node.js test discovery depends on supported filenames, configuration, and runtime version. Explicit paths are more portable than shell-dependent recursive globs.

### Jest

```bash
# Run the unit test directory.
npx jest tests/unit —runInBand

# Run one policy test.
npx jest tests/unit/policies/application.policy.test.js —runInBand

# Run one service test.
npx jest tests/unit/services/payment.service.test.js —runInBand
```

If `package.json` defines a suitable test script, prefer:

```bash
npm test
```

Do not assume that a passing command executed every intended test file. Confirm the runner’s reported test counts and inspect any skipped or excluded tests.

## 6. Mocking and Fixtures

- Mock repositories, payment providers, email providers, and external APIs.
- Use deterministic fixtures for users, applications, documents, payments, and subscriptions.
- Never connect unit tests to production databases or production payment accounts.
- Use fixed dates or fake clocks for time-dependent behavior.
- Restore mocks and clean up temporary state after each test.
- Ensure each test can run independently.
- Avoid real network requests, uncontrolled randomness, and arbitrary sleeps.
- Prefer dependency injection or established mocking facilities over modifying global state.
- Reset environment variables and module-level state when tests change them.
- Use synthetic credentials and test-only identifiers.
- Avoid logging sensitive fixture data.
- Do not use real personal data in test fixtures.

Fixtures should reflect the actual module contracts. Avoid silently weakening assertions just to accommodate implementation defects.

## 7. Security Requirements

- Test both allowed and denied authorization cases.
- Never trust roles, permissions, ownership IDs, or payment status supplied by clients.
- Verify that secrets and sensitive personal information are not returned.
- Test mass-assignment protections for privileged fields.
- Verify that repository and provider failures cannot produce false success responses.
- Verify that payment operations are safe against duplicate processing where applicable.
- Test access to records belonging to other users.
- Test tenant and organization boundaries where applicable.
- Verify that malformed identities, missing permissions, and invalid resource identifiers fail safely.
- Confirm that audit failures follow the documented security and reliability policy.
- Test that error messages do not leak stack traces, credentials, tokens, or internal configuration in public responses.
- Do not treat a policy unit test as proof that an HTTP endpoint enforces the policy.

## 8. Naming Conventions

Use descriptive filenames:

- Policy: `<name>.policy.test.js`
- Service: `<name>.service.test.js`
- Middleware: `<name>.middleware.test.js`
- Utilities: `<name>.test.js`
- Validators: `validators.test.js`

Use descriptive test names beginning with terms such as:

- `allows` — permitted behavior.
- `denies` — access-control denial.
- `rejects` — invalid input or operation.
- `returns` — expected output.
- `throws` — expected exception.
- `preserves` — invariants and data integrity.
- `does not expose` — sensitive-data protection.

Test names should describe observable behavior, not merely repeat the function name.

## 9. Completion Criteria

A unit test is complete when it:

1. Tests a real, implemented module.
2. Covers expected behavior and relevant failure cases.
3. Includes authorization-denial cases where applicable.
4. Uses isolated dependencies and deterministic fixtures.
5. Runs independently and reliably.
6. Passes in the repository’s configured test environment.
7. Does not rely on production data or credentials.
8. Uses the correct test runner and module format.
9. Cleans up resources, mocks, timers, and temporary state.
10. Avoids relying on implementation details that are not part of the module contract.

A written test is not evidence that a feature works until the test has been executed successfully.

## 10. Related Test Suites

Keep other testing responsibilities in their appropriate directories:

- `tests/integration/` — database, controllers, repositories, and external integrations.
- `tests/security/` — privilege escalation, IDOR, mass assignment, and sensitive-data exposure.
- `tests/api/` — HTTP endpoint contracts.
- `tests/e2e/` — complete user workflows.
- `tests/accessibility/` — keyboard, screen-reader, and accessibility checks.

Avoid duplicating entire integration or end-to-end scenarios in unit tests. Test each layer at the appropriate level.

## 11. Maintenance

When adding or removing tests:

1. Verify the target module exists.
2. Confirm the correct export names and import paths.
3. Follow the repository’s configured test runner.
4. Update this README when the intended directory structure changes.
5. Run the relevant test file.
6. Run the broader unit suite.
7. Review skipped tests, warnings, and failures.
8. Report execution results accurately.

The directory tree in this README is a documented target structure. Keep it synchronized with the actual repository rather than treating it as proof that every listed file exists or passes.
```
