
# MedOrbits — Test Suite Documentation

**Directory:** `tests/`  
**Purpose:** Automated quality assurance for the MedOrbits education consultancy, admissions, document management, payments, and career services platform.

## 1. Overview

The MedOrbits test suite verifies application behavior, API contracts, database integrity, authorization, payment processing, accessibility, and critical user workflows.

| Directory | Purpose |
|—|—|
| `unit/` | Isolated functions, validators, utilities, and business rules |
| `integration/` | Interactions between controllers, services, repositories, and infrastructure |
| `integration/payments/` | Payment webhooks, duplicate events, and concurrent refunds |
| `api/` | HTTP endpoints, response contracts, validation, and access control |
| `database/` | Connections, migrations, constraints, indexes, repositories, and transactions |
| `security/` | Authentication, authorization, IDOR, privilege escalation, and information leakage |
| `accessibility/` | WCAG-oriented checks, forms, navigation, contrast, keyboard access, and screen-reader semantics |
| `e2e/` | Complete user journeys across the application |
| `fixtures/` | Reusable test data and payloads |

**Important:** The presence of a test file does not prove that its tests pass or that the associated application feature is implemented. Verify the inventory, configuration, and execution results before claiming coverage.

## 2. Intended directory structure

```text
tests/
├── README.md
├── accessibility/
│   ├── README.md
│   ├── color-contrast.test.js
│   ├── forms.accessibility.test.js
│   ├── homepage.accessibility.test.js
│   ├── keyboard-navigation.test.js
│   ├── navigation.accessibility.test.js
│   └── screen-reader.test.js
├── api/
│   ├── README.md
│   ├── applications.api.test.js
│   ├── auth.api.test.js
│   ├── colleges.api.test.js
│   ├── courses.api.test.js
│   ├── documents.api.test.js
│   ├── error-responses.api.test.js
│   ├── health.api.test.js
│   ├── jobs.api.test.js
│   ├── payments.api.test.js
│   ├── universities.api.test.js
│   └── user.api.test.js
├── database/
│   ├── README.md
│   ├── connection.test.js
│   ├── constraints.test.js
│   ├── indexes.test.js
│   ├── migrations.test.js
│   ├── repositories.test.js
│   ├── setup.js
│   └── transactions.test.js
├── e2e/
│   ├── README.md
│   ├── admin-workflow.e2e.test.js
│   ├── application-submission.e2e.test.js
│   ├── authentication.e2e.test.js
│   ├── document-upload.e2e.test.js
│   └── payment-checkout.e2e.test.js
├── fixtures/
│   ├── README.md
│   ├── applications.js
│   ├── candidates.js
│   ├── courses.js
│   ├── documents.js
│   ├── employers.js
│   ├── payments.js
│   ├── subscriptions.js
│   └── users.js
├── integration/
│   ├── README.md
│   ├── application.integration.test.js
│   ├── auth.integration.test.js
│   ├── controllers.integration.test.js
│   ├── database-constraints.integration.test.js
│   ├── notification.integration.test.js
│   ├── payments.integration.test.js
│   ├── repositories.integration.test.js
│   └── payments/
│       ├── README.md
│       ├── concurrent-refunds.integration.test.js
│       ├── duplicate-events.integration.test.js
│       └── webhook.integration.test.js
├── security/
│   ├── README.md
│   ├── authentication.security.test.js
│   ├── authorization.security.test.js
│   ├── idor.security.test.js
│   ├── input-validation.security.test.js
│   ├── mass-assignment.security.test.js
│   ├── payment-webhook.security.test.js
│   ├── privilege-escalation.security.test.js
│   ├── rate-limit.security.test.js
│   ├── sensitive-data.security.test.js
│   └── unauthorized-downloads.security.test.js
└── unit/
    └── validators.test.js
```

This is the intended inventory, not a verified filesystem listing. Only include files for implemented modules and configured test infrastructure.

## 3. Test responsibilities

### 3.1 Unit tests

**File:** `unit/validators.test.js`

Verify:

- Required fields, types, and formats.
- String and numeric boundaries.
- Email and identifier validation.
- Missing, malformed, unsupported, and oversized values.
- Consistent validation errors.
- Deterministic behavior without unnecessary network or database dependencies.

### 3.2 API tests

| File | Responsibilities |
|—|—|
| `applications.api.test.js` | Submission, retrieval, ownership, validation, and access control |
| `auth.api.test.js` | Registration, login, credentials, and authentication errors |
| `colleges.api.test.js` | Catalog, search, filtering, pagination, and details |
| `courses.api.test.js` | Catalog, course details, query validation, and access |
| `documents.api.test.js` | Uploads, downloads, ownership, and storage-path protection |
| `error-responses.api.test.js` | Error contracts, malformed requests, missing routes, and information leakage |
| `health.api.test.js` | Health, liveness, readiness, and infrastructure information exposure |
| `jobs.api.test.js` | Job listing, search, filtering, details, and protected fields |
| `payments.api.test.js` | Payment authorization, initiation, webhook verification, and state integrity |
| `universities.api.test.js` | Catalog, details, search, filtering, and pagination |
| `user.api.test.js` | Profiles, updates, ownership, and sensitive-data protection |

Tests must follow actual route definitions, authentication middleware, request schemas, and response contracts.

### 3.3 Integration tests

| File | Responsibilities |
|—|—|
| `application.integration.test.js` | Application workflow across connected components |
| `auth.integration.test.js` | Authentication, services, and persistence |
| `controllers.integration.test.js` | Controllers, services, repositories, and middleware |
| `database-constraints.integration.test.js` | Real database constraints |
| `notification.integration.test.js` | Notification dispatch and failure handling |
| `payments.integration.test.js` | Payment lifecycle integration |
| `repositories.integration.test.js` | Repository operations against the configured persistence layer |

### 3.4 Database tests

| File | Responsibilities |
|—|—|
| `connection.test.js` | Connection establishment, failure handling, and cleanup |
| `constraints.test.js` | Foreign keys, uniqueness, nullability, and schema constraints |
| `indexes.test.js` | Required indexes and relevant query behavior |
| `migrations.test.js` | Migration ordering, execution, and schema state |
| `repositories.test.js` | Repository operations |
| `transactions.test.js` | Commit, rollback, and isolation behavior |
| `setup.js` | Test database initialization and shared helpers |

Use the database driver, schema, and migration system actually configured by the application.

### 3.5 Security tests

| File | Responsibilities |
|—|—|
| `authentication.security.test.js` | Missing, invalid, expired, and malformed credentials |
| `authorization.security.test.js` | Role and resource-level authorization |
| `idor.security.test.js` | Access to another user’s resources |
| `input-validation.security.test.js` | Malformed input and injection attempts |
| `mass-assignment.security.test.js` | Unauthorized protected-field modification |
| `payment-webhook.security.test.js` | Webhook authenticity and payment-state integrity |
| `privilege-escalation.security.test.js` | Unauthorized roles and permissions |
| `rate-limit.security.test.js` | Configured request limits |
| `sensitive-data.security.test.js` | Sensitive information leakage |
| `unauthorized-downloads.security.test.js` | Download authorization and path traversal protection |

Where applicable, verify both the authorization decision and that denied operations do not modify persistent state.

### 3.6 Accessibility tests

| File | Responsibilities |
|—|—|
| `color-contrast.test.js` | Text and interface contrast |
| `forms.accessibility.test.js` | Labels, instructions, validation errors, and feedback |
| `homepage.accessibility.test.js` | Homepage structure and primary interactions |
| `keyboard-navigation.test.js` | Keyboard access, focus order, visibility, and traps |
| `navigation.accessibility.test.js` | Navigation landmarks, menus, links, and current-page state |
| `screen-reader.test.js` | Semantic HTML, accessible names, ARIA relationships, and announcements |

Target WCAG 2.2 Level AA. Automated tests must be supplemented by manual keyboard and assistive-technology testing.

### 3.7 End-to-end tests

| File | Responsibilities |
|—|—|
| `admin-workflow.e2e.test.js` | Administrative workflows and protected operations |
| `application-submission.e2e.test.js` | Form completion, submission, and confirmation |
| `authentication.e2e.test.js` | Authentication journeys |
| `document-upload.e2e.test.js` | File selection, upload, validation, and completion |
| `payment-checkout.e2e.test.js` | Checkout, payment initiation, and result handling |

Use the E2E runner configured by the repository. Do not assume it is Jest.

## 4. Fixture conventions

Fixtures must use synthetic, deterministic data.

| File | Responsibilities |
|—|—|
| `applications.js` | Application records and payloads |
| `candidates.js` | Candidate profiles |
| `courses.js` | Course records |
| `documents.js` | Document metadata and upload scenarios |
| `employers.js` | Employer and organization records |
| `payments.js` | Payment records and lifecycle scenarios |
| `subscriptions.js` | Subscription lifecycle scenarios |
| `users.js` | User profiles and role scenarios |
| `README.md` | Fixture structure and maintenance |

Requirements:

- Do not use real customer data or production credentials.
- Use stable identifiers and explicit ownership relationships.
- Keep fixture definitions separate from database insertion and cleanup.
- Match the application’s actual model and validation schemas.
- Clean up records created by mutation tests.
- Ensure fixture exports match their consumers.

The intended current fixture filenames are `applications.js`, `courses.js`, `payments.js`, and `users.js`, rather than their former `*.fixture.js` names. Update imports only after confirming the actual files and exports.

Example CommonJS imports:

```javascript
‘use strict’;

const applications = require(‘../fixtures/applications’);
const courses = require(‘../fixtures/courses’);
const payments = require(‘../fixtures/payments’);
const users = require(‘../fixtures/users’);
```

Adjust relative paths according to the importing file’s location.

## 5. Removed E2E filenames

The intended current E2E inventory uses:

- `authentication.e2e.test.js`
- `payment-checkout.e2e.test.js`

The former `login.e2e.test.js`, `payment.e2e.test.js`, and `registration.e2e.test.js` filenames should not be assumed to exist.

Before deleting old files, verify that their unique scenarios have been migrated. Registration coverage should remain explicitly tested within the authentication journey or a separate registration test.

## 6. Payment integration tests

**Directory:** `tests/integration/payments/`

| File | Responsibilities |
|—|—|
| `concurrent-refunds.integration.test.js` | Prevent duplicate or conflicting effects from concurrent refunds |
| `duplicate-events.integration.test.js` | Verify idempotent handling of repeated gateway events |
| `webhook.integration.test.js` | Verify signed event processing and payment-state transitions |
| `README.md` | Test setup, provider simulation, and execution |

Verify:

- Valid signatures are accepted.
- Invalid signatures are rejected.
- Duplicate events do not duplicate financial effects.
- State transitions are atomic or otherwise concurrency-safe.
- Amounts and currencies are validated.
- Refunds cannot exceed refundable amounts.
- Failures do not leave inconsistent payment state.

Use provider mocks or test-mode credentials. Never initiate live charges or refunds in automated tests.

## 7. Technology and dependencies

Preserve the project’s existing configuration.

Potential tools include:

- Node.js 20 or later.
- Jest for configured unit, API, and integration tests.
- Supertest for Express HTTP tests.
- The configured SQL database driver.
- Browser automation for E2E testing.
- axe-core or jest-axe for accessibility testing.

Inspect `package.json`, the lockfile, and existing test configuration before installing dependencies or changing runners.

Do not replace the test runner or database adapter without an explicit architecture change.

## 8. Test environment and database safety

Tests must use isolated infrastructure.

Illustrative environment configuration:

```dotenv
NODE_ENV=test
TEST_DATABASE_URL=mysql://test_user:test_password@127.0.0.1:3306/medorbits_test
```

This example is not a claim that the repository uses this exact database or variable name. Configure the actual driver and environment variables required by MedOrbits.

Before database tests run:

1. Verify that the target is a dedicated test database.
2. Apply required migrations.
3. Load required fixtures.
4. Verify test-only credentials.
5. Mock or disable live payment operations.
6. Ensure setup and cleanup are safe and repeatable.

Never run destructive test setup against production data.

## 9. Authentication helpers

Authentication tests should use valid credentials issued through the application’s real test authentication mechanism.

A helper may return:

```javascript
{
  token: ‘test-issued-access-token’,
  userId: ‘TEST-USER-001’,
}
```

This illustrates the expected interface; the token is not valid.

Create test users through trusted setup and assign roles server-side. Do not simulate administrator access by trusting client-supplied role fields. An unimplemented helper must be completed before its associated tests are considered runnable.

## 10. API response contracts

Test the response envelope implemented by MedOrbits. The following are illustrative examples, not mandatory contracts.

Success:

```json
{
  “success”: true,
  “data”: []
}
```

Error:

```json
{
  “success”: false,
  “message”: “Request could not be processed.”
}
```

Use the actual route and middleware behavior to determine expected status codes.

| Status | Typical meaning |
|—|—|
| `200` | Successful operation |
| `201` | Resource created |
| `204` | Successful operation without a response body |
| `400` | Invalid request |
| `401` | Missing or invalid authentication |
| `403` | Insufficient permission |
| `404` | Resource or route not found; may conceal restricted resources |
| `405` | Unsupported HTTP method |
| `409` | Conflict |
| `415` | Unsupported media type |
| `422` | Validation failure |
| `429` | Rate limit exceeded |
| `500` | Unexpected server failure |
| `503` | Service unavailable |

Prefer exact status assertions when the contract is known. Do not accept unrelated status codes merely to make tests pass.

## 11. Security requirements

### Authentication and authorization

- Protected routes reject missing and invalid credentials.
- Roles and permissions are assigned by trusted server-side logic.
- Users cannot access other users’ private resources without authorization.
- Administrative operations require the appropriate permission.

### Input handling

- Request bodies and query parameters are validated.
- Injection attempts cannot alter query structure.
- Unexpected fields cannot bypass validation.
- File paths and identifiers cannot escape permitted storage.

### Sensitive information

Responses must not expose unnecessary:

- Password hashes.
- Access or refresh tokens.
- Private keys.
- Database connection strings.
- Environment variables.
- Stack traces.
- Internal filesystem paths.
- Payment gateway secrets.

### Payment integrity

- Payment state is determined by trusted server-side verification.
- Invalid webhooks cannot mark payments successful.
- Repeated events do not duplicate financial effects.
- Refunds are protected against concurrency errors.

## 12. Accessibility requirements

Target WCAG 2.2 Level AA.

Verify:

- Semantic HTML and accessible names.
- Sufficient text and interface contrast.
- Keyboard accessibility and visible focus.
- Logical focus order.
- Accessible labels and validation messages.
- Heading hierarchy and navigation landmarks.
- Meaningful image alternatives.
- Screen-reader-compatible status announcements.
- Responsive layouts and zoom behavior.

Automated checks do not establish full WCAG conformance. Manually test important journeys using a keyboard and appropriate assistive technologies.

## 13. Running tests

Use the repository’s existing npm scripts when available.

### Jest

```bash
# Run all Jest-discovered tests
npx jest —runInBand

# Run individual categories
npx jest tests/unit —runInBand
npx jest tests/integration —runInBand
npx jest tests/api —runInBand
npx jest tests/database —runInBand
npx jest tests/security —runInBand
npx jest tests/accessibility —runInBand

# Run payment integration tests
npx jest tests/integration/payments —runInBand

# Run E2E tests only if configured for Jest
npx jest tests/e2e —runInBand

# Generate coverage
npx jest —coverage —runInBand
```

These commands assume the root Jest configuration discovers the relevant files and that the required test environment is available.

If the project uses Node’s built-in test runner for a test file, run it using the configured Node test command rather than invoking it through Jest.

Prefer `npm test` when the existing script correctly runs the intended suite.

## 14. Jest configuration

Example reference configuration for Node-based tests:

```javascript
‘use strict’;

module.exports = {
  testEnvironment: ‘node’,
  clearMocks: true,
  restoreMocks: true,
  verbose: true,
  testTimeout: 15000,
};
```

Merge necessary settings into the existing configuration. Do not overwrite project-specific test discovery, setup files, coverage thresholds, or environment configuration without reviewing them.

## 15. Test isolation and cleanup

Every test must be deterministic and independently repeatable.

- Create records through test setup.
- Use stable fixtures.
- Avoid execution-order dependencies.
- Roll back or clean up database mutations.
- Mock external services when live connectivity is unnecessary.
- Prevent tests from reaching production services.
- Close database connections and browser resources.
- Configure reasonable asynchronous timeouts.
- Run shared-state tests serially until isolation is reliable.

Do not silently skip essential authorization, persistence, or security assertions.

## 16. CI integration

Recommended CI sequence:

1. Install dependencies using the lockfile.
2. Validate required environment variables.
3. Run unit tests.
4. Start isolated database services.
5. Apply migrations and load fixtures.
6. Run integration and database tests.
7. Run API and security tests.
8. Run accessibility tests.
9. Run E2E tests using the configured runner.
10. Publish test and coverage reports.
11. Fail the pipeline when required checks fail.

CI must use test-only credentials and must not print secrets in logs.

## 17. Troubleshooting

**Module not found:** Check dependency installation, filename casing, relative imports, and the module system.

**Database connection failure:** Verify the test database, connection URL, migrations, and required environment variables.

**Authentication failure:** Verify that the helper issues a valid test token and that the test user’s role and ownership match the scenario.

**Unexpected HTTP status:** Compare the assertion with the actual route, middleware, controller, and documented contract.

**E2E failure:** Verify the configured runner, application startup, browser installation, base URL, selectors, and asynchronous behavior.

**Inconsistent results:** Investigate shared mutable fixtures, parallel execution, missing cleanup, and external dependencies.

**Deleted files:** Check imports, test discovery, npm scripts, and CI configuration. Confirm scenario migration before treating a deletion as complete.

## 18. Definition of done

Before release, verify:

- [ ] The directory inventory matches the actual repository.
- [ ] Required test dependencies and runners are configured.
- [ ] Unit tests pass.
- [ ] Integration and database tests pass against isolated infrastructure.
- [ ] API response contracts are verified.
- [ ] Authentication and authorization tests pass.
- [ ] Payment webhook and idempotency tests pass.
- [ ] Security tests cover the intended threat model.
- [ ] Accessibility checks and manual reviews are completed.
- [ ] Critical E2E workflows pass.
- [ ] Fixtures are deterministic and cleanup is reliable.
- [ ] Removed files are not referenced by active configuration.
- [ ] CI uses test-only credentials and services.
- [ ] Required checks pass before deployment.

## 19. Maintenance policy

Update this document whenever:

- Test files are added, renamed, or removed.
- Fixture names or exports change.
- The test runner or dependencies change.
- API contracts or authentication mechanisms change.
- Database setup or migrations change.
- E2E workflows or accessibility tooling change.
- CI execution commands change.

The actual implementation, route contracts, schema, test configuration, and execution results remain the authoritative sources of truth.
