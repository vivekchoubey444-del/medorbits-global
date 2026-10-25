
# MedOrbits — Unit Testing Guide

**Directory:** `/tests/unit/`

## 1. Purpose

Unit tests verify individual functions, classes, and modules independently from the complete application.

The goal is to identify regressions early, verify expected behavior, test edge cases, and ensure that reusable MedOrbits utilities and services behave consistently.

Unit tests should be fast, deterministic, isolated, and safe to run locally or in continuous integration (CI).

—

## 2. Recommended Directory Structure

```text
tests/
└── unit/
    ├── README.md
    │
    ├── utils/
    │   ├── constants.test.js
    │   ├── formatters.test.js
    │   └── validators.test.js
    │
    ├── services/
    │   ├── api.services.test.js
    │   ├── auth.services.test.js
    │   ├── application.services.test.js
    │   └── document.services.test.js
    │
    ├── security/
    │   ├── input-validation.test.js
    │   └── safe-errors.test.js
    │
    ├── components/
    │   ├── navigation.test.js
    │   ├── modal.test.js
    │   └── toast.test.js
    │
    └── helpers/
        ├── fixtures.js
        └── test-utils.js
```

This is a recommended layout. Keep test filenames and paths aligned with the actual source modules and configured test runner.

—

## 3. Test Framework

Use the framework already configured in the repository. Do not introduce a second runner without a specific technical reason.

Common choices include:

- **Vitest:** ES modules, modern JavaScript projects, and Vite-based applications.
- **Jest:** General-purpose JavaScript testing.
- **Node.js test runner:** Lightweight tests for supported Node.js environments.

The examples below use Jest-compatible syntax. Adapt imports, mocks, and configuration to the actual framework.

Check `package.json` before assuming that a test command or dependency is installed.

```bash
# Install dependencies from the existing lockfile.
npm ci

# Run the configured test suite.
npm test

# Run tests in watch mode, if configured.
npm run test:watch

# Generate coverage, if configured.
npm run test:coverage
```

These commands require corresponding scripts in `package.json`.

—

## 4. Test Naming and Organization

Use descriptive filenames ending in `.test.js` or `.spec.js`, consistent with the repository convention.

Recommended naming pattern:

```text
source-module.js
source-module.test.js
```

Each test should describe a single observable behavior.

Prefer:

```javascript
test(“rejects an invalid email address”, () => {
  // Assertions.
});
```

Avoid vague descriptions such as:

```javascript
test(“works”, () => {
  // Assertions.
});
```

Organize tests by source module or domain rather than creating one large test file for the entire application.

—

## 5. Unit Testing Utilities

Test reusable functions in `/src/js/utils/`.

### Constants

Verify:

- Required constant groups exist.
- Application routes and API endpoint values have the expected format.
- Status enums contain supported values.
- Pagination limits are valid.
- Supported languages are consistent.
- Configuration objects cannot be mutated where immutability is intended.

### Formatters

Verify:

- Empty and null inputs.
- Valid and invalid dates.
- Currency and number formatting.
- Text normalization and truncation.
- File-size formatting.
- Status-label formatting.
- Locale-dependent output.

### Validators

Verify:

- Valid inputs are accepted.
- Invalid inputs are rejected.
- Required-field behavior.
- Minimum and maximum lengths.
- Numeric boundaries.
- Invalid enum values.
- Date ordering.
- Application and job payload validation.
- File size and allowed MIME type checks.
- Consistent result objects and useful error messages.

### Example: email validation

```javascript
import { describe, expect, test } from “@jest/globals”;
import {
  validateEmail,
} from “../../../src/js/utils/validators.js”;

describe(“validateEmail”, () => {
  test(“accepts a valid email address”, () => {
    const result = validateEmail(“student@example.com”);

    expect(result.valid).toBe(true);
  });

  test(“rejects an invalid email address”, () => {
    const result = validateEmail(“invalid-email”);

    expect(result.valid).toBe(false);
    expect(result.message).toBeTruthy();
  });

  test(“rejects an empty value when required”, () => {
    const result = validateEmail(“”, { required: true });

    expect(result.valid).toBe(false);
  });
});
```

**Integration note:** This example assumes `validateEmail()` accepts the demonstrated options and returns a `{ valid, message }` result. Adjust it to the actual function signature before use.

—

## 6. Unit Testing API Services

Test `/src/js/services/api.services.js` independently from real backend infrastructure.

Recommended cases:

- Relative URL construction.
- Query parameter encoding.
- JSON request serialization.
- Successful JSON responses.
- Empty responses and `204 No Content`.
- Malformed response bodies.
- HTTP error mapping.
- Network errors.
- Timeout and cancellation.
- Correlation ID handling.
- Multipart file uploads.
- Credential and header behavior.
- Safe error messages.

Mock `fetch` or use the mocking facilities of the configured test runner.

Restore mocks after each test to prevent test-order dependencies.

Do not use a real production API or database in unit tests.

—

## 7. Unit Testing Domain Services

### Authentication service

Test:

- Valid and invalid input handling.
- Correct endpoint and HTTP method usage.
- Expected request payloads.
- Session retrieval.
- Logout behavior.
- Password-reset request handling.
- Safe propagation of API errors.
- Authentication status handling.

Never use real passwords or production authentication credentials in fixtures.

### Application service

Test:

- Identifier validation.
- List parameters and pagination.
- Application creation payload validation.
- Permitted updates.
- Status retrieval and status-change requests.
- Withdrawal behavior.
- Document association operations.
- Error handling for missing or inaccessible applications.

Verify that protected fields cannot be changed through operations that are intended only for ordinary application updates.

### Document service

Test:

- Metadata normalization.
- File size and type validation.
- Multipart field construction.
- Document list parameters.
- Download error handling.
- Blob handling and save behavior.
- Metadata update restrictions.
- Safe handling of missing documents.

Mock browser APIs such as `URL.createObjectURL()` when required by the selected test environment.

Unit tests must not replace backend tests for file signature inspection, malware scanning, or document authorization.

—

## 8. Unit Testing Security Utilities

Test `/src/js/security/`.

### Input validation

Verify:

- Required-field checks.
- Email, phone, and identifier validation.
- Password requirements.
- Payload validation.
- File size and type checks.
- Safe field-level error rendering.
- Correct association between form fields and error messages.

### Safe error handling

Verify:

- Known error codes are mapped consistently.
- Public messages do not expose internal exception details.
- Correlation IDs are handled consistently.
- Unknown errors receive a safe fallback message.
- Sensitive values are not included in sanitized diagnostics.

Do not assume that a JavaScript `TypeError` or `SyntaxError` automatically represents invalid user input. Test that error classification follows the intended error contract.

Frontend security tests do not replace backend authorization, CSRF, rate-limiting, or server-side validation tests.

—

## 9. Mocking and Test Isolation

Use mocks for external dependencies when testing an individual unit.

Appropriate mock targets include:

- HTTP requests.
- Browser storage APIs.
- Timers.
- Navigation actions.
- Logging and telemetry.
- External services.

Guidelines:

1. Mock only dependencies needed to isolate the unit.
2. Keep assertions focused on observable behavior.
3. Reset mocks between tests.
4. Avoid excessive mocking of the unit’s own logic.
5. Do not mock the validation rule being tested.
6. Use integration tests when real component interactions are important.

Unit tests should not depend on network availability, real user accounts, production data, or test execution order.

—

## 10. Edge Cases and Negative Tests

Every important unit should include boundary and failure cases.

Examples:

- Empty string, whitespace, and null values.
- Missing optional fields.
- Invalid types.
- Minimum and maximum permitted values.
- Very long input.
- Unexpected API response shapes.
- Unsupported status values.
- Invalid dates.
- Zero-byte and oversized files.
- Cancelled requests.
- Duplicate or repeated invocation.

Avoid writing assertions that accept several unrelated outcomes merely to make a test pass. Assertions should reflect the intended contract.

—

## 11. Coverage Requirements

Coverage helps identify untested code but does not prove correctness.

Suggested initial targets:

| Area | Suggested coverage |
|—|—:|
| Pure utility functions | 90% or higher |
| Validation logic | 90% or higher |
| API client | 85% or higher |
| Domain services | 80% or higher |
| Security-sensitive branches | All identified critical cases |

Review statement, branch, function, and line coverage where supported.

Prioritize meaningful edge cases and security-sensitive behavior rather than maximizing aggregate coverage alone.

Coverage thresholds must be configured in the actual test runner before they can be enforced by CI.

—

## 12. Unit Test Quality Standards

A well-designed unit test should be:

- **Isolated:** Independent of unrelated modules and external systems.
- **Deterministic:** Produces the same result for the same controlled inputs.
- **Readable:** Explains the expected behavior in its name.
- **Focused:** Tests one behavior or closely related set of assertions.
- **Repeatable:** Passes independently and as part of the full suite.
- **Safe:** Uses synthetic data and does not mutate production resources.
- **Maintainable:** Changes only when the intended contract changes.

Do not suppress genuine failures by skipping tests, weakening assertions, or adding arbitrary delays.

—

## 13. Running Tests in CI

A recommended CI sequence is:

1. Install dependencies from the lockfile.
2. Run formatting and lint checks, if configured.
3. Execute unit tests.
4. Generate coverage reports, if configured.
5. Run integration and API tests in the appropriate environment.
6. Publish reports without exposing secrets or private test data.

Unit tests should remain fast enough to run frequently during development.

Use separate CI jobs for browser-based end-to-end tests or database-dependent integration tests when their dependencies differ.

—

## 14. Troubleshooting

### Module import errors

Verify:

- The source file exists.
- Relative import paths are correct.
- Filename casing matches exactly.
- The project’s ES module configuration is correct.
- The test runner supports the module syntax.

### Browser API errors

Configure an appropriate browser-like test environment or mock the specific browser API.

Do not introduce production-only polyfills solely to hide a test configuration problem.

### Flaky tests

Check for:

- Shared mutable state.
- Unrestored mocks.
- Uncontrolled timers.
- Unawaited asynchronous operations.
- Network dependencies.
- Test-order assumptions.

Fix the underlying cause instead of repeatedly retrying the test.

—

## 15. Pre-Merge Checklist

- [ ] Tests cover normal behavior and important edge cases.
- [ ] Tests use synthetic data.
- [ ] External dependencies are isolated appropriately.
- [ ] Mocks are reset correctly.
- [ ] Asynchronous operations are awaited.
- [ ] Assertions verify the documented contract.
- [ ] Security-sensitive branches are covered.
- [ ] No tests accidentally access production services.
- [ ] Test commands match the project’s `package.json`.
- [ ] The configured test suite passes.
- [ ] Coverage reports have been reviewed where available.

—

## 16. Maintenance Policy

Whenever a source module changes, review its unit tests for new inputs, outputs, error cases, and security implications.

For each confirmed defect, add a regression test where practical. Keep this README synchronized with the actual test framework, directory structure, and package scripts.

**Quality principle:** Unit tests establish confidence in isolated behaviors. Integration, security, accessibility, and end-to-end tests are still required to evaluate the complete MedOrbits application.
