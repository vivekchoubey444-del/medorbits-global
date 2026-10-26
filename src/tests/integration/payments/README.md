MedOrbits — Payment Integration Tests

File: tests/integration/payments/README.md
Runtime: Node.js 20 or later
Scope: Payment processing, concurrent refunds, webhook verification, and event idempotency

1. Purpose

This directory contains integration tests for MedOrbits payment workflows. The tests are designed to identify regressions involving:

* Duplicate or concurrent payment-event processing.
* Invalid refund amounts and concurrent refund requests.
* Webhook signature verification and payload validation.
* Event identifier reuse and idempotency.
* Payment-state consistency and financial data integrity.
* Authentication, authorization, and error handling.

Important: These tests are templates that must be aligned with the actual MedOrbits API, database schema, payment provider, and webhook implementation. A passing test suite does not independently establish that a payment system is secure or financially correct.

Never run mutating tests against production services, live payment credentials, or real customer payments.

2. Directory Structure

tests/
└── integration/
    └── payments/
        ├── README.md
        ├── concurrent-refunds.integration.test.js
        ├── duplicate-events.integration.test.js
        └── webhook.integration.test.js

Test responsibilities

Test file	Primary coverage
concurrent-refunds.integration.test.js	Concurrent refund requests, refundable-balance limits, idempotency, and payment-state consistency
duplicate-events.integration.test.js	Duplicate and concurrent webhook delivery, event identifier reuse, conflicting payloads, and idempotency
webhook.integration.test.js	Webhook routing, signature verification, malformed payloads, event validation, and payment-state integrity

The files intentionally overlap. The duplicate-event suite focuses on deduplication and event identity, while the webhook suite covers broader request validation and processing behavior.

3. Prerequisites

Before running the suite, confirm that you have:

* Node.js 20 or later.
* Project dependencies installed.
* A running MedOrbits integration-test API instance.
* A dedicated test database or isolated test environment.
* A disposable payment fixture or supported sandbox payment.
* Test credentials authorized to inspect the fixture payment.
* A test webhook secret or provider-specific signature configuration.
* Valid endpoint paths, event schemas, and documented response codes.
* A repeatable fixture setup and reset procedure.

Verify that the API instance is connected to the intended test database. Setting NODE_ENV=test alone does not guarantee that the application is isolated from production resources.

4. Configuration

The supplied tests use environment variables to configure their target API, fixtures, authentication, and execution safeguards.

Variable	Purpose
NODE_ENV	Must be test for mutating tests in the supplied templates
PAYMENT_TEST_BASE_URL	Base URL of the test API
TEST_BASE_URL	Fallback base URL in applicable test files
PAYMENT_TEST_TOKEN	Test credential for payment inspection and applicable authenticated requests
TEST_PAYMENT_ID	Identifier of the dedicated disposable payment
PAYMENT_TEST_PATH	Payment lookup endpoint template containing :paymentId
PAYMENT_WEBHOOK_TEST_PATH	Webhook endpoint path
PAYMENT_WEBHOOK_TEST_SECRET	HMAC secret for applicable webhook tests
PAYMENT_WEBHOOK_SIGNATURE_HEADER	Name of the webhook signature header
PAYMENT_WEBHOOK_SIGNATURE_FORMAT	Signature encoding supported by the configured test
PAYMENT_WEBHOOK_AUTH_MODE	Authentication mode, such as hmac-sha256, bearer, or none, where supported
PAYMENT_EVENT_ID_HEADER	Optional event identifier header
PAYMENT_EVENT_ID_FIELD	Event identifier field in the request payload
PAYMENT_TEST_EVENT_TYPE	Event type used by test fixtures
TEST_PAYMENT_AMOUNT_MINOR	Fixture amount in the smallest currency unit
TEST_PAYMENT_CURRENCY	Fixture currency, such as INR
RUN_MUTATING_PAYMENT_TESTS	Set to true to enable supported state-mutating tests
PAYMENT_TEST_TIMEOUT_MS	HTTP request timeout in milliseconds
PAYMENT_TEST_ALLOW_REMOTE_SANDBOX	Explicit opt-in for supported remote sandbox mutation tests
PAYMENT_TEST_ENVIRONMENT	Must be sandbox for supported remote sandbox mutation tests

Use the exact variable names referenced by each test file. Not every variable is required by every test.

Authentication and signature compatibility

The supplied templates may implement different authentication modes and signature formats. Configure each test to match the actual MedOrbits implementation and payment provider.

For HMAC-signed webhooks, confirm:

1. The expected algorithm is correct.
2. The signature header and encoding match the provider.
3. The server verifies the signature against the exact raw request body when required.
4. Signature comparison uses an appropriate timing-safe method.
5. Timestamp validation and replay protection are implemented when required by the provider.

A locally generated HMAC proves only that the test generated a signature using its configured secret. It does not establish that the server follows the provider’s complete verification protocol.

5. Running the Tests

Run commands from the repository root.

Run all payment integration tests

node —test tests/integration/payments/*.integration.test.js

Run individual test files

node —test tests/integration/payments/concurrent-refunds.integration.test.js
node —test tests/integration/payments/duplicate-events.integration.test.js
node —test tests/integration/payments/webhook.integration.test.js

Run the baseline suite

NODE_ENV=test \
node —test tests/integration/payments/*.integration.test.js

In the supplied templates, mutation tests are disabled unless RUN_MUTATING_PAYMENT_TESTS=true. Baseline tests may still make HTTP requests, so the configured API must be a safe test instance.

Run supported mutating tests

Only run this command after confirming that the application, database, credentials, and payment provider are configured for testing.

NODE_ENV=test \
RUN_MUTATING_PAYMENT_TESTS=true \
PAYMENT_TEST_ENVIRONMENT=sandbox \
PAYMENT_TEST_BASE_URL=http://127.0.0.1:3000 \
PAYMENT_TEST_TOKEN=YOUR_TEST_TOKEN \
PAYMENT_WEBHOOK_TEST_SECRET=YOUR_TEST_WEBHOOK_SECRET \
TEST_PAYMENT_ID=YOUR_DISPOSABLE_TEST_PAYMENT_ID \
TEST_PAYMENT_AMOUNT_MINOR=10000 \
TEST_PAYMENT_CURRENCY=INR \
node —test tests/integration/payments/*.integration.test.js

Replace all placeholders with valid test values. Do not commit secrets to source control.

The local HTTP URL above is intended only for a local test server. For remote sandbox testing, use HTTPS and enable remote mutation only when the relevant test file supports that configuration.

Caution: Enabling mutation permits tests to change payment state. A unique event ID does not make an operation harmless, and reusing a payment fixture across tests can cause order-dependent failures. Prefer isolated fixtures for each mutating scenario.

6. Security and Correctness Requirements

6.1 Webhook authentication

The implementation should:

* Verify signatures according to the provider’s official specification.
* Verify the exact raw request body when required by the provider.
* Reject missing or invalid signatures.
* Validate event types, payment identifiers, currency, and amounts.
* Avoid trusting client-supplied payment status as proof of a successful transaction.
* Apply timestamp validation and replay protection where required.
* Avoid exposing tokens, signature secrets, or sensitive request data in logs.
* Return documented responses for malformed, unauthorized, and unsupported requests.

Where possible, validate a payment’s state against trusted provider information and the local transaction record before applying financial side effects.

6.2 Duplicate event processing

The implementation should:

* Persist processed event identifiers.
* Enforce deduplication atomically under concurrent requests.
* Avoid repeating financial side effects when a provider retries delivery.
* Detect conflicting payloads that reuse an existing event identifier.
* Return documented acknowledgements or conflict responses.
* Verify persisted event records and business effects, not just HTTP status codes.

A robust implementation should define how to handle an event ID that already exists with a different payload. It should not silently treat conflicting content as an ordinary duplicate.

6.3 Concurrent refunds

The implementation should:

* Check the refundable balance within an atomic transaction or equivalent concurrency-safe operation.
* Enforce the maximum refundable amount.
* Use provider idempotency keys where supported.
* Reconcile local and provider payment states.
* Prevent duplicate refund records and negative refundable balances.
* Verify persisted refund records after concurrent requests.
* Handle provider timeouts and retries without assuming that a timed-out request was not processed.

Concurrency tests should validate the final financial outcome, including the number and total value of successful refunds.

6.4 Financial data integrity

The implementation should:

* Store money using integer minor units or an equivalent exact-decimal representation.
* Validate amount and currency consistency.
* Preserve payment/refund consistency after failures and retries.
* Use appropriate database constraints and transaction boundaries.
* Avoid logging secrets, access tokens, payment credentials, or unnecessary personal information.

Do not assume that every provider uses the same amount units or event schema. Confirm the provider’s conventions before interpreting amount fields.

7. Test Isolation and Repeatability

Payment integration tests can change financial state. Use dedicated fixtures and a documented reset strategy.

Recommended workflow:

1. Create or select a dedicated sandbox payment.
2. Record its initial state, amount, currency, and refundable balance.
3. Generate unique event identifiers and idempotency keys for independent scenarios.
4. Run the test against the isolated API and database.
5. Verify payment, event, and refund records after processing.
6. Recreate or reset the fixture before rerunning state-mutating tests.
7. Clean up temporary records only where cleanup is safe and supported.
8. Avoid running concurrent tests against the same mutable payment unless concurrency is the behavior under test.

Do not assume that a payment can be refunded repeatedly or that an event can be replayed without side effects.

Account for legitimate state transitions

A first delivery may legitimately change a payment from pending to succeeded. The correct duplicate-delivery assertion is generally that subsequent deliveries do not repeat the business operation—not that the payment remains identical to its original pre-delivery state.

For stronger idempotency evidence, assert that:

* The event-processing record exists exactly once.
* The event is marked processed according to the implementation’s state model.
* The payment has the expected final state.
* No duplicate refund, ledger entry, or other financial side effect was created.

Payment snapshots alone cannot prove that an event was processed exactly once.

8. Interpreting Failures

When a test fails, investigate:

* API availability and route registration.
* Endpoint paths and request payload structure.
* Authentication and authorization settings.
* Provider-specific webhook signature requirements.
* Raw-body middleware configuration and middleware ordering.
* Test payment state and remaining refundable balance.
* Event deduplication and database transaction behavior.
* Expected HTTP status codes and the documented API contract.
* Fixture state and cleanup between test runs.
* Whether the API exposes the fields expected by the tests.
* Whether a timeout occurred after the server had already processed a request.

Do not weaken an assertion merely to obtain a passing result. Establish the intended behavior, then fix the test or implementation accordingly.

A successful HTTP response does not prove that duplicate processing was prevented. Verify the persisted records and actual financial side effects.

9. Limitations

These tests do not replace:

* Payment-provider sandbox certification and reconciliation.
* Database transaction and concurrency reviews.
* Dependency and vulnerability scanning.
* Production configuration and secret-management reviews.
* Independent security testing.
* Coverage of every provider-specific event and failure mode.

The supplied templates assume particular endpoint patterns and, in places, HMAC-SHA256 signatures. Adapt them for providers that use timestamped signatures, alternative authentication, different event schemas, or different payment-state fields.

Tests that inspect payment state through an HTTP API do not independently prove that the database contains exactly one event-processing record. Add repository-level or database-level assertions where necessary.

10. CI Recommendations

For continuous integration:

* Use isolated databases and disposable payment fixtures.
* Store secrets in CI secret storage.
* Run safe validation tests on pull requests where practical.
* Run mutating integration tests only in a dedicated test or sandbox workflow.
* Prevent production credentials from entering the test environment.
* Preserve useful test logs without exposing secrets or personal information.
* Fail the pipeline when critical financial invariants are violated.
* Avoid parallel execution against the same mutable fixture unless intentionally testing concurrency.
* Ensure failed assertions produce a non-zero test-process exit status.
* Separate sandbox integration tests from production deployment workflows.
* Recreate or reset fixtures between independent test runs.

11. Maintenance Checklist

When changing payment or webhook code:

* [ ]	Update endpoint and payload assumptions in affected tests.
* [ ]	Test valid and invalid webhook signatures.
* [ ]	Test malformed JSON and invalid payloads.
* [ ]	Test missing event identifiers.
* [ ]	Test repeated and concurrent event delivery.
* [ ]	Test conflicting payloads that reuse an event ID.
* [ ]	Test concurrent refunds and over-refund prevention.
* [ ]	Verify persisted event and refund records.
* [ ]	Verify payment-state consistency after retries and failures.
* [ ]	Verify timeout and retry behavior.
* [ ]	Run the complete payment integration suite.
* [ ]	Update this README when files or configuration variables change.

12. Reporting Payment Vulnerabilities

Report confirmed vulnerabilities privately to the project maintainers.

Include:

* The affected endpoint and component.
* The test environment used.
* Reproducible steps.
* Expected and actual behavior.
* Financial or security impact.
* Relevant sanitized logs or test results.

Do not include live credentials, real customer payment details, webhook secrets, or unnecessary personal information in reports.

⸻

Operational rule: Payment integration tests must use isolated test resources, explicit mutation controls, and verifiable financial invariants. A passing test suite is useful evidence, but it is not a substitute for reviewing the implementation, database behavior, and payment-provider integration.