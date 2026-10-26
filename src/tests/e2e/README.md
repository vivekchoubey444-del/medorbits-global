MedOrbits — End-to-End Testing

Directory: tests/e2e/
Framework: Playwright Test
Runtime: Node.js 20+

1. Purpose

The MedOrbits end-to-end (E2E) test suite validates user journeys through the browser, including authentication, application submission, document uploads, administrative workflows, and payment checkout.

E2E tests complement unit, integration, security, and accessibility tests. They do not replace those test layers.

Important: The test inventory describes intended coverage. A passing test does not prove that every behavior listed in this document has been comprehensively verified. Keep this README synchronized with the actual test implementation.

2. Test inventory

Test file	Primary coverage
admin-workflow.e2e.test.js	Administrator authentication, dashboard access, user management, application review, authorization boundaries, logout
application-submission.e2e.test.js	Application form rendering, required fields, input validation, submission feedback, document selection
authentication.e2e.test.js	Login, invalid credentials, required-field validation, protected routes, session persistence, logout
document-upload.e2e.test.js	File selection, allowed extensions, size validation, upload feedback, sensitive path exposure
payment-checkout.e2e.test.js	Checkout rendering, amount and currency display, form validation, payment action, cancellation, secret exposure

3. Prerequisites

Before running the suite:

* Install Node.js 20 or later.
* Install project dependencies from the repository’s lockfile.
* Configure Playwright in the repository.
* Start MedOrbits in a dedicated test environment.
* Create synthetic test accounts and test data.
* Use an isolated test database and test document storage.
* Configure the required backend APIs and dependent services.
* Use a deterministic payment mock or provider sandbox for payment integration tests.

If Playwright is not already declared in the project:

npm install —save-dev @playwright/test
npx playwright install

If Playwright is already declared, use the existing dependency and lockfile rather than installing a duplicate version.

For CI environments, install the browser dependencies required by the configured Playwright project.

4. Configuration

The tests use environment variables to configure the application URL, routes, credentials, and test behavior.

Core variables

Variable	Default	Purpose
E2E_BASE_URL	http://127.0.0.1:3000	Base URL of the test application
E2E_LOGIN_PATH	/login	Login route
E2E_DASHBOARD_PATH	/dashboard	User dashboard route
E2E_PROTECTED_PATH	/dashboard	Route requiring authentication
E2E_ADMIN_DASHBOARD_PATH	/admin	Administrator dashboard
E2E_ADMIN_USERS_PATH	/admin/users	User management
E2E_ADMIN_APPLICATIONS_PATH	/admin/applications	Application review
E2E_APPLICATION_PATH	/applications/new	Application submission
E2E_DOCUMENT_UPLOAD_PATH	/documents/upload	Document upload
E2E_CHECKOUT_PATH	/checkout	Payment checkout
E2E_LOGOUT_PATH	Not set	Optional logout route
E2E_REGISTER_PATH	/register	Registration route

Route defaults are examples, not authoritative MedOrbits routes. Override them to match the actual application.

Test accounts and feature settings

Variable	Default	Purpose
E2E_USER_EMAIL	Not set	Synthetic user account email
E2E_USER_PASSWORD	Not set	Synthetic user account password
E2E_ADMIN_EMAIL	Not set	Synthetic administrator email
E2E_ADMIN_PASSWORD	Not set	Synthetic administrator password
E2E_APPLICATION_REQUIRES_AUTH	false	Whether application submission requires login
E2E_DOCUMENT_REQUIRES_AUTH	false	Whether document upload requires login
E2E_CHECKOUT_REQUIRES_AUTH	false	Whether checkout requires login
E2E_ALLOWED_DOCUMENT_EXTENSIONS	.pdf,.jpg,.jpeg,.png	Expected permitted document extensions
E2E_MAX_UPLOAD_BYTES	5242880	Expected maximum upload size in bytes
E2E_PAYMENT_MODE	mock	Permitted non-live payment test mode
E2E_ALLOW_REMOTE_TEST_TARGET	Not set	Explicit opt-in for a remote test target

Some test files may use additional variables or implement only a subset of these settings. Check the relevant test file before assuming a variable is supported.

Recommended local environment

Create a local, untracked .env.e2e file:

E2E_BASE_URL=http://127.0.0.1:3000
E2E_LOGIN_PATH=/login
E2E_DASHBOARD_PATH=/dashboard
E2E_PROTECTED_PATH=/dashboard
E2E_ADMIN_DASHBOARD_PATH=/admin
E2E_ADMIN_USERS_PATH=/admin/users
E2E_ADMIN_APPLICATIONS_PATH=/admin/applications
E2E_APPLICATION_PATH=/applications/new
E2E_DOCUMENT_UPLOAD_PATH=/documents/upload
E2E_CHECKOUT_PATH=/checkout
E2E_REGISTER_PATH=/register
E2E_USER_EMAIL=student@example.test
E2E_USER_PASSWORD=replace-with-a-test-only-password
E2E_ADMIN_EMAIL=admin@example.test
E2E_ADMIN_PASSWORD=replace-with-a-test-only-password
E2E_PAYMENT_MODE=mock
E2E_ALLOWED_DOCUMENT_EXTENSIONS=.pdf,.jpg,.jpeg,.png
E2E_MAX_UPLOAD_BYTES=5242880

These are example values, not working credentials. Create synthetic accounts in the dedicated test environment.

Add .env.e2e to .gitignore:

.env.e2e
.env.e2e.*
!.env.e2e.example

Do not commit real credentials, session tokens, or payment secrets. An example environment file should contain placeholders only.

Loading environment variables

Playwright does not automatically load .env.e2e.

If dotenv is already installed, load the file at the beginning of playwright.config.js, before configuration values are evaluated:

‘use strict’;
require(‘dotenv’).config({
  path: ‘.env.e2e’,
});
const { defineConfig, devices } = require(‘@playwright/test’);
// Keep the repository’s existing configuration below.

Otherwise, install it only if needed:

npm install —save-dev dotenv

Alternatively, configure the environment variables through your shell or CI secret manager.

5. Running tests

Run the complete E2E suite:

npx playwright test tests/e2e/

Run individual test files:

npx playwright test tests/e2e/authentication.e2e.test.js
npx playwright test tests/e2e/admin-workflow.e2e.test.js
npx playwright test tests/e2e/application-submission.e2e.test.js
npx playwright test tests/e2e/document-upload.e2e.test.js
npx playwright test tests/e2e/payment-checkout.e2e.test.js

Run with a visible browser:

npx playwright test tests/e2e/ —headed

Run in debug mode:

npx playwright test tests/e2e/authentication.e2e.test.js —debug

Run tests matching a title:

npx playwright test tests/e2e/ -g “invalid credentials”

Open the HTML report:

npx playwright show-report

Start the application in a separate terminal unless playwright.config.js already defines a working webServer configuration.

6. Authentication and authorization

Authentication tests should validate:

* Valid credentials establish an authenticated session.
* Invalid credentials do not establish a session.
* Required credential fields are validated.
* Protected pages and APIs reject unauthenticated requests.
* Sessions behave correctly after navigation and page refresh.
* Logout invalidates the session.
* Administrative routes reject ordinary users.
* Users cannot access another user’s protected records.

Do not rely exclusively on hidden navigation links or frontend route guards. Verify authorization on the server for protected pages, APIs, and individual records.

Use dedicated administrator and ordinary-user accounts with the minimum permissions needed for each scenario.

7. Application submission

Application tests should validate:

* The application page renders successfully.
* Required fields cannot be omitted.
* Invalid input is rejected.
* Valid synthetic submissions produce appropriate confirmation.
* Errors do not disclose internal implementation details.
* Repeated submissions do not create unintended duplicate records.

A successful browser interaction does not prove that a correct record was persisted. Use integration tests to verify database persistence, record ownership, status transitions, and duplicate-submission protection.

Use synthetic applicant information only.

8. Document uploads

Document upload tests should cover:

* File input availability.
* Permitted file extensions and actual file types.
* File-size limits and boundary conditions.
* Empty-file submission.
* Upload success and failure feedback.
* Authorization for uploading and accessing documents.
* Prevention of unauthorized downloads.
* Safe error messages and storage-path handling.

The HTML accept attribute is a user-interface hint, not a security boundary.

The backend must independently validate file size, file signatures, MIME type, authorization, and storage permissions. Apply malware scanning where appropriate. Store uploaded files outside publicly executable directories and serve them through authorized download endpoints.

Use synthetic test files. Never use real passports, identity documents, educational certificates, medical records, or other personal records.

9. Payment checkout

Payment tests must use a deterministic mock or provider sandbox.

Validate:

* The checkout page displays the expected amount and currency.
* The server derives payable amounts from trusted records.
* Invalid checkout inputs are rejected.
* Cancellation and failure states are handled correctly.
* Repeated requests do not create duplicate charges.
* A payment is considered successful only after server-side verification.
* Webhooks are authenticated and processed idempotently.
* Refunds and payment status changes are authorized and auditable.

Never use live payment credentials or create real charges in automated tests.

A success URL, frontend message, or client-supplied transaction status is not proof of completed payment. Backend integration tests should verify provider references, transaction amount, currency, provider authentication, ownership, and final server-side status.

The existing UI-only checkout tests should not submit payments unless a dedicated mock or sandbox integration has been configured and the resulting server-side transaction is verified.

10. Test data and cleanup

Use isolated synthetic records for each scenario.

Recommended practices:

* Use reserved .test email addresses.
* Keep test accounts separate from real accounts.
* Generate unique identifiers for records created by tests.
* Avoid shared mutable fixtures across parallel tests.
* Clean up records created by each test where appropriate.
* Preserve failure artifacts only when permitted by the data-handling policy.
* Ensure cleanup cannot delete production data.
* Make tests repeatable and safe to rerun.

Tests that depend on pre-created accounts must document how those accounts are provisioned. Do not assume a fixture factory automatically creates database records or establishes authenticated sessions.

Tests that share accounts, mutate the same records, or depend on shared state may require isolated fixtures or controlled execution instead of full parallelization.

11. Playwright configuration

A typical playwright.config.js can define the E2E directory, timeouts, base URL, reporter, browser projects, and optional application startup.

Example:

‘use strict’;
require(‘dotenv’).config({
  path: ‘.env.e2e’,
});
const { defineConfig, devices } = require(‘@playwright/test’);
module.exports = defineConfig({
  testDir: ‘./tests/e2e’,
  testMatch: ‘**/*.e2e.test.js’,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [
    [‘list’],
    [‘html’, { open: ‘never’ }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || ‘http://127.0.0.1:3000’,
    trace: ‘retain-on-failure’,
    screenshot: ‘only-on-failure’,
    video: ‘retain-on-failure’,
  },
  projects: [
    {
      name: ‘chromium’,
      use: {
        ...devices[‘Desktop Chrome’],
      },
    },
  ],
});

This example assumes dotenv is installed. Remove the require(‘dotenv’) line if the repository configures environment variables externally.

If the repository already has a Playwright configuration, extend it rather than replacing existing settings blindly.

Review fullyParallel before enabling it. Tests that share mutable accounts or records may need isolated fixtures or serial execution.

The example does not start the application automatically. Add a webServer configuration only after confirming the correct MedOrbits startup command and readiness URL.

12. CI recommendations

A CI workflow should:

1. Install dependencies using the committed lockfile.
2. Install the required Playwright browser and system dependencies.
3. Start MedOrbits in an isolated test environment.
4. Initialize the test database and synthetic accounts.
5. Configure credentials through the CI secret manager.
6. Run the E2E suite.
7. Store reports and failure traces under the approved retention policy.
8. Clean up temporary records and test services.

Never print credentials, session cookies, authorization headers, payment tokens, or sensitive upload contents in CI logs.

Run critical security and payment tests whenever relevant code changes. Broader browser and regression suites can run on pull requests or scheduled builds.

13. Failure diagnosis

Symptom	Investigation
Connection refused	Confirm the application is running and E2E_BASE_URL is correct.
Element not found	Update selectors to match the actual page markup.
Login test skipped	Configure test credentials and inspect the test’s skip conditions.
Login succeeds but a protected page fails	Check session cookies, redirects, and authorization middleware.
Upload rejected	Check backend file policies, request limits, and storage configuration.
Payment test fails	Verify mock/sandbox configuration and payment status handling.
Intermittent failures	Inspect shared state, asynchronous UI updates, parallel execution, and backend dependencies.
Screenshot or trace missing	Review Playwright configuration and artifact permissions.

Prefer condition-based waits and observable application states over arbitrary delays.

14. Security and privacy requirements

* Never run destructive E2E tests against production.
* Never commit credentials, private keys, session tokens, or payment secrets.
* Never log full payment payloads or sensitive document contents.
* Do not treat frontend validation as a substitute for backend validation.
* Do not disable authorization checks to make tests pass.
* Do not use real personal data in automated fixtures.
* Enforce server-side permissions for administrative and document endpoints.
* Ensure errors do not leak stack traces, secrets, or internal storage paths.
* Protect screenshots and traces because they can contain sensitive information.
* Restrict remote E2E targets to explicitly approved test environments.

15. Definition of done

An E2E test is ready for CI when:

* It targets the actual MedOrbits route and interface.
* Its test data is isolated and synthetic.
* It asserts a meaningful observable result.
* It handles asynchronous behavior without arbitrary sleeps.
* It cleans up created records where required.
* It is safe to repeat and run in parallel, or explicitly configured otherwise.
* It does not depend on live payment processing.
* Its behavior has been verified against the current application.

Status: This document defines the intended E2E testing standard. Route defaults, selectors, environment variables, and test behavior must be reconciled with the actual MedOrbits implementation. The presence of a test file does not establish that the test passes or that the underlying feature is secure.