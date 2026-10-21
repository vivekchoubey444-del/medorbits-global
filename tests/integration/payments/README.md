MedOrbits Payment Integration Tests

1. Purpose

This directory contains integration tests for payment processing, refund concurrency, webhook authentication, and duplicate-event handling.

The tests are designed to detect payment-related regressions, including duplicate financial operations, invalid refund amounts, webhook signature failures, and inconsistent payment states.

Important: These tests are templates that must match the actual MedOrbits API, database schema, payment provider, and webhook verification implementation. A passing test suite does not, by itself, prove payment security.

2. Directory Structure

tests/
└── integration/
    └── payments/
        ├── README.md
        ├── concurrent-refunds.integration.test.js
        ├── duplicate-events.integration.test.js
        └── webhook.integration.test.js

Test responsibilities

Test file	Coverage
concurrent-refunds.integration.test.js	Concurrent refund requests, refundable-balance limits, idempotency, and payment-state consistency
duplicate-events.integration.test.js	Duplicate webhook delivery, concurrent event delivery, event identifier reuse, and conflicting payloads
webhook.integration.test.js	Webhook endpoint behavior, signature verification, payload validation, duplicate delivery, and payment-state integrity

The files overlap intentionally. duplicate-events.integration.test.js focuses on event deduplication, while webhook.integration.test.js covers broader webhook validation and processing behavior.

3. Prerequisites

* Node.js 20 or later.
* Project dependencies installed.
* A running MedOrbits API integration-test instance.
* A dedicated test database.
* A sandbox payment or deterministic payment fixture.
* Test credentials authorized to inspect the fixture payment.
* A sandbox webhook secret or provider-specific test-signature configuration.
* Correct endpoint paths, payload schemas, and expected response codes.

Never run mutating payment tests against production payments, live payment credentials, or production customer data.

4. Configuration

The test files support configuration through environment variables. Names and requirements vary by test file.

Variable	Purpose
NODE_ENV	Must be test when running mutation tests in the supplied templates
PAYMENT_TEST_BASE_URL	Base URL of the test API
TEST_BASE_URL	Fallback base URL in applicable files
PAYMENT_TEST_TOKEN	Test credential for payment inspection and applicable authenticated requests
TEST_PAYMENT_ID	Identifier of the dedicated sandbox payment
PAYMENT_TEST_PATH	Payment lookup endpoint template
PAYMENT_WEBHOOK_TEST_PATH	Webhook endpoint path
PAYMENT_WEBHOOK_TEST_SECRET	Test HMAC secret where applicable
PAYMENT_WEBHOOK_SIGNATURE_HEADER	Signature header name
PAYMENT_WEBHOOK_SIGNATURE_FORMAT	Signature encoding supported by the configured template
PAYMENT_WEBHOOK_AUTH_MODE	Webhook authentication mode, such as hmac-sha256, bearer, or none, where supported
PAYMENT_EVENT_ID_HEADER	Optional event identifier header name
PAYMENT_EVENT_ID_FIELD	Event identifier field in the payload
PAYMENT_TEST_EVENT_TYPE	Event type used by the test fixture
TEST_PAYMENT_AMOUNT_MINOR	Fixture amount in the smallest currency unit
TEST_PAYMENT_CURRENCY	Fixture currency, such as INR
RUN_MUTATING_PAYMENT_TESTS	Set to true to opt in to supported mutating tests
PAYMENT_TEST_TIMEOUT_MS	Request timeout in milliseconds
PAYMENT_TEST_ALLOW_REMOTE_SANDBOX	Explicit opt-in for supported remote sandbox mutation tests
PAYMENT_TEST_ENVIRONMENT	Set to sandbox for supported remote sandbox mutation tests

Use the exact variable names referenced by each test file. Do not assume every variable is required by every test.

The supplied templates may support different authentication modes or signature formats. Configure each test according to its implementation and the actual provider’s requirements.

5. Running the Tests

Run all payment integration tests from the repository root:

node —test tests/integration/payments/*.integration.test.js

Run individual test files:

node —test tests/integration/payments/concurrent-refunds.integration.test.js
node —test tests/integration/payments/duplicate-events.integration.test.js
node —test tests/integration/payments/webhook.integration.test.js

Some tests require RUN_MUTATING_PAYMENT_TESTS=true. Tests that mutate payment state should run only after the test environment, fixtures, credentials, and provider sandbox have been verified.

Run the baseline suite

NODE_ENV=test node —test tests/integration/payments/*.integration.test.js

This runs the suite with mutation tests disabled by default, unless a particular test file has different behavior.

Run supported mutating tests

Only use disposable fixtures and a dedicated test environment:

NODE_ENV=test \
RUN_MUTATING_PAYMENT_TESTS=true \
PAYMENT_TEST_BASE_URL=http://127.0.0.1:3000 \
PAYMENT_TEST_TOKEN=YOUR_TEST_TOKEN \
PAYMENT_WEBHOOK_TEST_SECRET=YOUR_TEST_WEBHOOK_SECRET \
TEST_PAYMENT_ID=YOUR_DISPOSABLE_TEST_PAYMENT_ID \
TEST_PAYMENT_AMOUNT_MINOR=10000 \
TEST_PAYMENT_CURRENCY=INR \
node —test tests/integration/payments/*.integration.test.js

Replace the placeholders with actual test values. Confirm that all configured routes and authentication mechanisms match the running application before execution.

For a remote sandbox, use HTTPS and set the remote-sandbox opt-in variables only when the test implementation supports them.

Never use production credentials or commit populated environment files containing secrets. Prefer ignored local environment files or your CI secret manager.

6. Security and Correctness Requirements

Webhook authentication

* Verify webhook signatures according to the provider’s official specification.
* Verify signatures against the exact raw request body when required by the provider.
* Reject invalid signatures and malformed payloads.
* Validate event types, payment identifiers, currency, and amount.
* Do not trust client-supplied payment status as proof of a successful transaction.
* Handle timestamp validation and replay protection where required by the provider.
* Avoid exposing signature secrets, tokens, or sensitive request details in logs.

Duplicate event processing

* Store processed event identifiers persistently.
* Enforce deduplication atomically so concurrent requests cannot process the same event twice.
* Handle retries without repeating financial side effects.
* Detect conflicting payloads that reuse an existing event identifier.
* Return the documented acknowledgement or conflict response for duplicate deliveries.
* Verify persisted event records and business effects rather than relying only on HTTP status codes.

Concurrent refunds

* Check refundable balances within an atomic transaction or equivalent concurrency-safe mechanism.
* Enforce the maximum refundable amount.
* Use provider idempotency keys where supported.
* Reconcile provider and local payment states.
* Prevent negative balances and duplicate refund records.
* Verify persisted refund records and the final refundable balance after concurrent requests.

Data integrity

* Store money in integer minor units or an equivalent exact-decimal representation.
* Validate currency and amount consistency.
* Keep payment and refund records consistent after failures and retries.
* Avoid logging webhook secrets, access tokens, or unnecessary personal information.

7. Test Isolation and Repeatability

Payment integration tests can change financial state. Use a dedicated fixture and restore or recreate it as needed.

Recommended fixture strategy:

1. Create or select a dedicated sandbox payment.
2. Record its original amount, currency, and state.
3. Run tests with unique event identifiers and idempotency keys.
4. Verify payment, event, and refund records after processing.
5. Recreate or reset the fixture before rerunning state-mutating tests.
6. Clean up temporary records where safe and supported.
7. Avoid parallel execution against the same mutable payment fixture.

Do not assume that a payment can be refunded repeatedly or that webhook events can be replayed against the same fixture without side effects.

A test that compares payment fields before and after an event must account for legitimate state transitions. For example, a valid payment-success event may change a payment from pending to succeeded. Duplicate delivery should not repeat the business operation, but the first delivery may legitimately change the state.

8. Interpreting Failures

When a test fails, check:

* API availability and route registration.
* Endpoint paths and request payload structure.
* Authentication and authorization configuration.
* Provider-specific webhook signature format.
* Raw-body middleware configuration and middleware ordering.
* Test payment state and remaining refundable balance.
* Event deduplication and database transaction handling.
* Whether the expected response codes match the API contract.
* Whether the test fixture is still in the expected state.
* Whether the payment API exposes the fields the test expects.

Do not weaken an assertion solely to obtain a passing result. Establish the intended behavior first, then correct the implementation or test.

A successful HTTP status does not prove that duplicate processing was prevented. Verify persisted payment records and actual financial side effects.

9. Limitations

These integration tests do not replace:

* Payment-provider sandbox certification or reconciliation tests.
* Database transaction and concurrency reviews.
* Dependency and vulnerability scanning.
* Production configuration and secret-management reviews.
* Independent security testing.
* Tests for all provider-specific event types and failure modes.

The supplied templates assume particular endpoint patterns and, in places, HMAC-SHA256 webhook signatures. Adapt them when the implementation uses another provider, timestamped signatures, a different event schema, or different payment-state fields.

Tests that inspect payment state through an HTTP API do not independently prove that the database contains exactly one event-processing record. Add repository or database-level assertions where necessary.

10. CI Recommendations

For continuous integration:

* Use isolated database fixtures and sandbox credentials.
* Keep secrets in CI secret storage.
* Run non-mutating validation tests on ordinary pull requests where practical.
* Run mutating payment tests against disposable fixtures.
* Preserve test logs without exposing secrets or personal information.
* Fail the pipeline when critical payment invariants are violated.
* Avoid parallel execution against the same mutable payment fixture.
* Ensure the test process exits unsuccessfully when an assertion fails.
* Separate sandbox integration tests from production deployment workflows.

11. Maintenance Checklist

When changing payment or webhook code:

* [ ]	Update endpoint and payload assumptions in affected tests.
* [ ]	Test valid and invalid webhook signatures.
* [ ]	Test malformed JSON and invalid payloads.
* [ ]	Test repeated and concurrent event delivery.
* [ ]	Test conflicting event identifiers.
* [ ]	Test concurrent refunds and over-refund prevention.
* [ ]	Verify persisted event and refund records.
* [ ]	Verify payment-state consistency after retries and failures.
* [ ]	Run the complete payment integration suite.
* [ ]	Update this README when files or configuration variables change.

12. Reporting Payment Vulnerabilities

Report confirmed issues privately to the project maintainers. Include the affected endpoint, test environment, reproducible steps, expected behavior, actual behavior, and financial or security impact.

Do not include live credentials, real customer payment details, webhook secrets, or unnecessary personal information in reports.