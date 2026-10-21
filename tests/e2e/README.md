MedOrbits — End-to-End Testing

Directory: tests/e2e/
Framework: Playwright Test
Runtime: Node.js 20+

1. Purpose

The E2E test suite validates MedOrbits user journeys through the browser, including authentication, application submission, document uploads, admin workflows, and payment checkout.

These tests exercise the application as a user would interact with it. They complement unit, integration, security, and accessibility tests; they do not replace them.

2. Test inventory

Test file	Primary coverage
admin-workflow.e2e.test.js	Admin authentication, dashboard access, user management, application review, authorization boundaries, logout
application-submission.e2e.test.js	Application form rendering, required fields, input validation, submission feedback, document selection
authentication.e2e.test.js	Login, invalid credentials, required-field validation, protected routes, session persistence, logout
document-upload.e2e.test.js	File selection, allowed file types, file-size validation, upload feedback, sensitive path exposure
payment-checkout.e2e.test.js	Checkout rendering, amount display, form validation, payment action, cancellation, repeated clicks, secret exposure

Important: This inventory describes the intended scope of the test files. A test passing does not prove that every listed behavior is comprehensively verified. Keep this document synchronized with the actual implementation.

3. Prerequisites

Before running the suite:

* Install Node.js 20 or later.
* Install project dependencies.
* Configure Playwright in the repository.
* Start MedOrbits in a dedicated test environment.
* Configure synthetic test accounts and test data.
* Use a separate test database and test document storage.
* Configure a payment-provider sandbox or deterministic payment mock.
* Ensure required backend APIs and dependent services are available.

Install Playwright only if it is not already declared in the project:

npm install —save-dev @playwright/test
npx playwright install

If the repository already declares Playwright, use the existing dependency and lockfile rather than installing a duplicate version.

4. Configuration

The tests use environment variables to select the application URL, routes, credentials, and testing behavior.

Variable	Default	Purpose
E2E_BASE_URL	http://127.0.0.1:3000	Base URL of the test application
E2E_LOGIN_PATH	/login	Login route
E2E_DASHBOARD_PATH	/dashboard	User dashboard route
E2E_PROTECTED_PATH	/dashboard	Route requiring authentication
E2E_ADMIN_DASHBOARD_PATH	/admin	Admin dashboard route
E2E_ADMIN_USERS_PATH	/admin/users	Admin user management route
E2E_ADMIN_APPLICATIONS_PATH	/admin/applications	Admin application review route
E2E_APPLICATION_PATH	/applications/new	Application submission route
E2E_DOCUMENT_UPLOAD_PATH	/documents/upload	Document upload route
E2E_CHECKOUT_PATH	/checkout	Payment checkout route
E2E_LOGOUT_PATH	Not set	Optional logout route
E2E_REGISTER_PATH	/register	Registration route
E2E_USER_EMAIL	Not set	Synthetic user account email
E2E_USER_PASSWORD	Not set	Synthetic user account password
E2E_ADMIN_EMAIL	Not set	Synthetic administrator email
E2E_ADMIN_PASSWORD	Not set	Synthetic administrator password
E2E_APPLICATION_REQUIRES_AUTH	false	Whether application submission requires login
E2E_DOCUMENT_REQUIRES_AUTH	false	Whether document upload requires login
E2E_CHECKOUT_REQUIRES_AUTH	false	Whether checkout requires login
E2E_ALLOWED_DOCUMENT_EXTENSIONS	.pdf,.jpg,.jpeg,.png	Expected allowed document extensions
E2E_MAX_UPLOAD_BYTES	5242880	Expected maximum upload size in bytes
E2E_PAYMENT_MODE	mock	Permitted non-live payment test mode

Route defaults are examples, not authoritative MedOrbits routes. Override them to match the actual application.

Recommended environment setup

Create a local, untracked .env.e2e file for local configuration. Never commit credentials.

Example:

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
E2E_USER_EMAIL=student@example.test
E2E_USER_PASSWORD=replace-with-a-test-only-password
E2E_ADMIN_EMAIL=admin@example.test
E2E_ADMIN_PASSWORD=replace-with-a-test-only-password
E2E_PAYMENT_MODE=mock
E2E_ALLOWED_DOCUMENT_EXTENSIONS=.pdf,.jpg,.jpeg,.png
E2E_MAX_UPLOAD_BYTES=5242880

These are example values, not working credentials. Use only synthetic accounts created in the dedicated test environment.

Playwright does not automatically load .env.e2e. Load it explicitly through an approved environment-variable loader or configure the variables through your CI secret manager.

If using dotenv, install it only if it is not already available:

npm install —save-dev dotenv

A configuration file can load the environment file before reading environment variables:

require(‘dotenv’).config({ path: ‘.env.e2e’ });

Place that statement at the top of the existing Playwright configuration, before configuration values are evaluated. Ensure .env.e2e is excluded from version control.

5. Running tests

Run all E2E tests:

npx playwright test tests/e2e/

Run an individual test file:

npx playwright test tests/e2e/authentication.e2e.test.js
npx playwright test tests/e2e/admin-workflow.e2e.test.js
npx playwright test tests/e2e/application-submission.e2e.test.js
npx playwright test tests/e2e/document-upload.e2e.test.js
npx playwright test tests/e2e/payment-checkout.e2e.test.js

Run with a visible browser:

npx playwright test tests/e2e/ —headed

Run in debug mode:

npx playwright test tests/e2e/authentication.e2e.test.js —debug

Run a named test:

npx playwright test tests/e2e/ -g “invalid credentials”

Open the HTML report:

npx playwright show-report

Start the application in another terminal before executing the tests unless playwright.config.js already defines a working webServer configuration.

6. Authentication and authorization

Authentication tests should validate:

* Valid credentials establish a session.
* Invalid credentials do not establish a session.
* Required credential fields are validated.
* Protected pages reject unauthenticated requests.
* Authenticated sessions behave correctly after navigation and refresh.
* Logout invalidates the session.
* Administrative routes reject ordinary users.

Do not rely only on hidden navigation links or frontend route guards. Verify authorization on the server for protected pages, APIs, and individual records.

For administrative tests, use dedicated accounts with the minimum permissions needed for each scenario.

7. Application submission

Application submission tests should validate:

* The application page renders successfully.
* Required fields cannot be omitted.
* Invalid input is rejected.
* Valid test submissions produce appropriate confirmation.
* Errors do not disclose internal implementation details.
* Repeated submission attempts do not create unintended duplicate records.

A successful browser interaction does not prove that the database contains a correct record. Verify persistence, ownership, status transitions, and duplicate protection in integration tests.

Use synthetic applicant information only.

8. Document uploads

Document upload tests should cover:

* File input availability.
* Permitted file types and extensions.
* File-size boundaries.
* Empty-file submission.
* Upload success and failure feedback.
* Authorization for uploading and accessing documents.
* Prevention of unauthorized downloads.
* Safe error messages and storage-path handling.

The HTML accept attribute is a user-interface hint, not a security boundary.

The backend must validate file size, content signatures, MIME type, authorization, and storage permissions. Apply malware scanning where appropriate. Store uploaded files outside publicly executable directories and serve them through authorized download endpoints.

Use synthetic test files. Do not use real passports, identity documents, educational certificates, medical records, or other personal records.

9. Payment checkout

Payment checkout tests must use a deterministic mock or provider sandbox.

Validate:

* The checkout page displays the expected amount and currency.
* The server derives payable amounts from trusted records.
* Invalid checkout inputs are rejected.
* Cancellation and failure states are handled correctly.
* Repeated clicks do not cause duplicate charges.
* A payment is considered successful only after server-side verification.
* Payment webhooks are authenticated and processed idempotently.
* Refunds and payment status changes are authorized and auditable.

Never use live payment credentials or real charges in automated tests.

A success URL, frontend message, or client-supplied transaction status is not proof of a completed payment. Verify provider references, transaction amount, currency, signature or equivalent provider authentication, and final server-side status in backend integration tests.

10. Test data and cleanup

Use isolated synthetic records for each test scenario.

Recommended practices:

* Use reserved .test email addresses.
* Keep test user accounts separate from real accounts.
* Give each scenario unique record identifiers where practical.
* Avoid shared mutable fixtures across parallel tests.
* Reset or clean up test records after execution.
* Preserve failed-test artifacts only when permitted by the data-handling policy.
* Ensure cleanup cannot delete production data.
* Make tests repeatable and safe to rerun.

When a test depends on a pre-created account, configure that account in the test environment. Do not assume that a fixture factory creates database records or establishes authenticated sessions.

11. Playwright configuration

A typical playwright.config.js can define the E2E directory, test timeout, base URL, reporter, browser projects, and optional server startup.

Example:

‘use strict’;
require(‘dotenv’).config({ path: ‘.env.e2e’ });
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

This example assumes dotenv is installed. If it is not needed, remove the require(‘dotenv’) line and configure environment variables externally.

If the repository already has a Playwright configuration, extend it instead of replacing existing settings blindly.

Review fullyParallel before enabling it. Tests that mutate the same application records, share accounts, or depend on shared state may need isolated fixtures or serial execution.

The example does not start the application automatically. Add a webServer configuration only after confirming the correct MedOrbits startup command and readiness URL.

12. CI recommendations

A CI workflow should:

1. Install the locked dependency tree.
2. Install the required Playwright browser and system dependencies.
3. Start the application in a test environment.
4. Initialize an isolated test database and synthetic accounts.
5. Configure secrets through the CI secret manager.
6. Run the E2E suite.
7. Upload test reports and failure traces under the repository’s retention policy.
8. Clean up temporary data and test services.

Never print credentials, session cookies, authorization headers, payment tokens, or sensitive upload contents in CI logs.

Run critical security and payment tests on every relevant change. Broader browser and regression suites can run on pull requests or scheduled builds.

13. Failure diagnosis

Symptom	Investigation
Connection refused	Confirm the application is running and E2E_BASE_URL is correct
Element not found	Update selectors to match the actual page markup
Login test skipped	Configure the required test credentials and inspect the test’s skip conditions
Login succeeds but protected page fails	Check session cookies, redirects, and authorization middleware
Upload rejected	Check server-side file policies, request limits, and storage configuration
Payment test fails	Verify sandbox/mock configuration and payment status handling
Intermittent failures	Inspect shared state, asynchronous UI updates, parallel execution, and backend dependencies
Screenshot or trace missing	Review Playwright configuration and artifact permissions

Prefer condition-based waits and observable application states over arbitrary delays.

14. Security and privacy requirements

* Never run destructive E2E tests against production.
* Never commit credentials, private keys, session tokens, or payment secrets.
* Never log full payment payloads or sensitive document contents.
* Do not treat frontend validation as a substitute for backend validation.
* Do not disable authorization checks to make tests pass.
* Do not use real personal data in automated fixtures.
* Ensure administrative and document endpoints enforce server-side permissions.
* Verify that errors do not leak stack traces, secrets, or internal storage paths.
* Keep test artifacts protected because screenshots and traces can contain user data.

15. Definition of done

An E2E test is ready for CI when:

* It targets the actual MedOrbits route and UI.
* Its test data is isolated and synthetic.
* It asserts a meaningful observable result.
* It handles asynchronous behavior without arbitrary sleeps.
* It cleans up created records where required.
* It is safe to repeat and run in parallel, or explicitly configured otherwise.
* It does not depend on live payment processing.
* Its behavior has been verified against the current application.

Status: This document defines the intended E2E testing standard. Route defaults, selectors, and test behavior must be reconciled with the actual MedOrbits implementation. The presence of a test file does not establish that the test passes or that the underlying feature is secure.