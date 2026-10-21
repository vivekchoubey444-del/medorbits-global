
# MedOrbits — Payment Integration

**Directory:** `src/integrations/payment/`

**Purpose:** Provide a consistent, secure, server-side payment interface for Razorpay and Stripe across MedOrbits admissions guidance, consultancy services, career services, and other approved paid offerings.

## 1. Overview

The payment integration isolates payment-provider operations behind a common interface. Application services can create checkout sessions, retrieve payment status, and verify webhook signatures without coupling business logic directly to provider SDKs.

Supported providers:

- **Razorpay** — through the `razorpay` Node.js SDK.
- **Stripe** — through the `stripe` Node.js SDK.

Select the provider using `PAYMENT_PROVIDER`.

This integration is not, by itself, a complete payment-processing system. Local order management, payment persistence, refunds, subscriptions, taxes, reconciliation, and business-specific fulfillment must be implemented in their appropriate application modules.

## 2. Directory structure

```text
src/integrations/payment/
├── README.md
├── index.js
├── payment.client.js
├── payment.config.js
├── payment.provider.js
├── razorpay.provider.js
├── stripe.provider.js
└── webhook-verifier.js
```

| File | Responsibility |
|—|—|
| `index.js` | Exports the payment client, provider adapters, and configuration loader. |
| `payment.client.js` | Validates and exposes the common provider interface. |
| `payment.config.js` | Loads and validates provider configuration. |
| `payment.provider.js` | Defines the abstract provider contract. |
| `razorpay.provider.js` | Creates Razorpay orders and retrieves payment information. |
| `stripe.provider.js` | Creates Stripe Checkout Sessions and retrieves session information. |
| `webhook-verifier.js` | Verifies Razorpay and Stripe webhook signatures. |

Keep provider-specific code inside this directory. Controllers and application services should use the payment client rather than importing provider SDKs directly.

## 3. Requirements

- Node.js 20 or later.
- npm.
- A supported and configured Razorpay or Stripe merchant account.
- HTTPS for production payment pages and webhook endpoints.
- Persistent database storage for local orders, payment attempts, webhook events, and audit records.
- Secure environment-variable management.
- Database transactions and unique constraints for payment processing.

Install the SDK for the selected provider.

**Razorpay**

```bash
npm install razorpay
```

**Stripe**

```bash
npm install stripe
```

Do not initialize both SDKs unless the application explicitly requires both.

## 4. Provider selection and configuration

Set `PAYMENT_PROVIDER` to exactly one supported value.

```dotenv
PAYMENT_PROVIDER=razorpay
```

Or:

```dotenv
PAYMENT_PROVIDER=stripe
```

### Razorpay

```dotenv
PAYMENT_PROVIDER=razorpay
PAYMENT_CURRENCY=INR
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

### Stripe

```dotenv
PAYMENT_PROVIDER=stripe
PAYMENT_CURRENCY=INR
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

These names must match `payment.config.js` and the corresponding provider adapter.

Use test credentials in development and staging. Production must use the correct live credentials and webhook signing secret configured for the production endpoint.

Never expose `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, or `STRIPE_WEBHOOK_SECRET` to a browser.

### Configuration validation

Validate configuration during application startup, before accepting payment requests.

Startup should fail when the selected provider is unsupported, required credentials are missing, the currency is invalid, or the selected provider’s webhook configuration is incomplete.

Do not silently switch providers or fall back to test credentials.

## 5. Common provider interface

Each provider must implement:

```javascript
createCheckout(request)
fetchPayment(paymentId)
verifyWebhook(rawBody, headers)
```

### `createCheckout(request)`

Creates a provider-side order or Checkout Session and returns the relevant checkout information.

It must not independently declare a local order paid.

### `fetchPayment(paymentId)`

Retrieves provider-side payment or Checkout Session information. The application service must interpret that information and reconcile it with the corresponding local order.

### `verifyWebhook(rawBody, headers)`

Verifies the provider signature using the original raw request bytes and the configured webhook signing secret.

A valid signature establishes authenticity of the signed payload; it does not automatically establish that the event is relevant to a local order or that the order should be fulfilled.

## 6. Amounts, currencies, and pricing

All checkout amounts must be calculated and validated server-side.

- Accept only positive, safe integers in the provider’s expected currency unit.
- INR amounts are expressed in paise.
- Stripe amounts must use the currency’s applicable smallest unit; not every currency uses two decimal places.
- Validate the selected currency against application configuration and merchant account capabilities.
- Calculate the payable amount from trusted database records and server-side pricing rules.
- Do not trust prices, discounts, taxes, subscription prices, or totals supplied by the browser.
- Recalculate applicable discounts, fees, and taxes on the server.
- Store the original currency, amount, pricing breakdown, and applicable pricing version with the local order.

For example, ₹1,250.00 is represented as `125000` paise for an INR payment.

Use integer arithmetic for monetary calculations wherever possible. Apply documented rounding rules when calculating percentage-based charges or taxes.

## 7. Recommended checkout lifecycle

The application service coordinates local order persistence and provider operations.

1. Authenticate the customer and authorize the requested service.
2. Validate the service, price, quantity, discount eligibility, and currency.
3. Calculate the final amount on the server.
4. Create a local order with a unique internal order ID and pending payment state.
5. Create a payment attempt linked to that order.
6. Call `createCheckout()` using the validated amount, currency, and a server-generated reference.
7. Persist the provider order or session ID against the local payment attempt.
8. Return only the checkout information required by the client.
9. Receive the provider webhook and verify its signature before processing the event.
10. Validate the event, correlate it with the local order and payment attempt, and reconcile the payment.
11. Apply the state transition transactionally and record the processed event.
12. Fulfill the service only after the required payment conditions are satisfied.

Do not hold a database transaction open while making a network request to a payment provider. Persist the pending state first, make the provider request, and then persist the result. Define recovery handling for failures between these steps.

## 8. Razorpay checkout

The Razorpay adapter creates provider orders using configured credentials.

Recommended sequence:

1. Create a pending local order.
2. Create a Razorpay order using the server-calculated amount, currency, and unique receipt.
3. Store the returned Razorpay order ID.
4. Return the public Razorpay key ID and required order information to the client.
5. Collect payment through the supported Razorpay checkout flow.
6. Verify the appropriate client payment signature where required by the checkout flow.
7. Independently verify the payment through trusted server-side provider data or a verified webhook.
8. Match the payment to the expected Razorpay order ID, amount, currency, and local order.
9. Mark the order paid only after all required conditions are satisfied.

The Razorpay key secret and webhook secret must remain server-side.

A client-side payment success callback is not sufficient proof of payment.

## 9. Stripe Checkout

The Stripe adapter creates Checkout Sessions using the configured secret key.

Recommended sequence:

1. Create a pending local order and payment attempt.
2. Create a Stripe Checkout Session using the server-calculated amount and currency.
3. Store the returned Checkout Session ID.
4. Return the Checkout URL to the authorized client.
5. Redirect the customer to the hosted checkout page.
6. Process the return redirect for user experience only.
7. Verify payment status through a trusted server-side lookup or verified webhook.
8. Correlate the Session with the local order and payment attempt.
9. Confirm the amount, currency, and required payment state before fulfillment.

### Redirect URL restrictions

Stripe success and cancellation URLs must use HTTPS in production.

HTTPS validation alone is not an allowlist. The application must also restrict redirect destinations to explicitly approved origins and paths belonging to MedOrbits or other intentionally approved destinations.

Do not accept arbitrary redirect URLs from clients.

Configure the success URL to include any required Checkout Session reference using Stripe’s documented URL conventions. Do not treat that reference as proof of payment.

## 10. Webhook security

The webhook verifier supports provider-specific signature verification:

- Razorpay uses HMAC-SHA256 verification.
- Stripe uses the Stripe SDK’s webhook event verification.

### Required processing order

1. Receive the request on a dedicated webhook route.
2. Enforce request-size limits and appropriate network-level protections.
3. Capture the exact raw request bytes.
4. Verify the signature using the correct provider and webhook secret.
5. Reject invalid signatures without performing business actions.
6. Parse or use the verified event.
7. Validate the event type and required fields.
8. Correlate the event with a known local payment attempt.
9. Validate the provider order or Session ID, amount, currency, and expected payment state.
10. Process the state transition and event record atomically.
11. Acknowledge the event only after it has been durably accepted or processed according to the application’s retry design.

Do not reconstruct the raw request body with `JSON.stringify(req.body)`. Re-serialization can change the bytes and invalidate signature verification.

Configure webhook routes so the raw body is available before JSON body parsing transforms the request.

### Signature verification is not authorization

A valid signature does not mean every event should be applied to every order.

The handler must also validate:

- The expected provider.
- The event type.
- The local order and payment attempt.
- The provider’s order or Checkout Session ID.
- The expected amount and currency.
- The payment’s current status.
- Whether the event has already been processed.

Never accept payment status or amount claims from an untrusted browser request.

## 11. Idempotency and duplicate events

Payment providers may deliver the same webhook more than once or deliver events out of order.

Implement durable idempotency in the application database.

Recommended controls:

- Store provider event IDs in a dedicated webhook event table.
- Enforce a unique constraint on the provider and event ID combination.
- Store provider payment IDs and checkout identifiers with appropriate uniqueness constraints.
- Use database transactions to record the event, update payment state, and schedule fulfillment.
- Make fulfillment operations independently idempotent.
- Reject or safely ignore duplicate events without repeating side effects.
- Handle out-of-order events using explicit state-transition rules.
- Reconcile ambiguous outcomes through provider lookups rather than assuming failure.

If fulfillment requires external actions, use a transactional outbox or equivalent reliable dispatch mechanism so a committed payment cannot silently lose its fulfillment event.

## 12. Suggested persistence model

The integration does not create these tables automatically. Implement the required persistence in the database and application service layer.

| Record | Purpose |
|—|—|
| `orders` | Local order ID, customer, service, amount, currency, and order state. |
| `payment_attempts` | Provider, local order ID, provider order/session ID, amount, currency, and payment state. |
| `payment_webhook_events` | Provider, event ID, event type, processing state, timestamps, and safe diagnostic metadata. |
| `payment_refunds` | Refund requests, provider refund IDs, amounts, states, and reconciliation details, if refunds are supported. |
| `outbox_events` | Durable fulfillment or notification work awaiting dispatch, if using an outbox. |
| `audit_logs` | Security-relevant administrative actions and payment state changes without unnecessary sensitive data. |

Use database constraints to prevent duplicate provider identifiers and webhook events. Choose transaction isolation and locking behavior appropriate to the database and workload.

Do not store card numbers, CVVs, or other prohibited payment credentials.

## 13. Payment state management

Define an explicit state machine for orders and payment attempts.

Illustrative states include:

- `pending`
- `processing`
- `paid`
- `failed`
- `cancelled`
- `expired`
- `refund_pending`
- `partially_refunded`
- `refunded`

These are application-level examples, not a direct mapping to every provider’s status values.

Define permitted transitions, terminal states, reconciliation rules, and refund behavior before production deployment.

Do not allow a later stale event to overwrite a confirmed state with an incompatible earlier state. Refunds should be recorded separately from the original successful payment so the financial history remains auditable.

## 14. Idempotency for outbound requests

Webhook deduplication and checkout idempotency solve different problems.

Where supported by the selected provider and SDK, use an appropriate idempotency mechanism for outbound payment-creation requests. Persist a stable key for the logical payment attempt before retrying an ambiguous request.

Do not generate a new idempotency key for every retry of the same logical operation.

Confirm the supported idempotency behavior for the installed provider SDK and API operation. The current provider adapters do not themselves implement persistent outbound idempotency storage.

## 15. Refunds, subscriptions, taxes, and reconciliation

The current integration does not implement:

- Refund creation, cancellation, or refund reconciliation.
- Recurring subscriptions, renewals, dunning, or subscription cancellation.
- Tax calculation, tax invoices, or jurisdiction-specific tax rules.
- Local order creation and persistence.
- Full webhook event routing and state-machine enforcement.
- Durable idempotency storage.
- Scheduled financial reconciliation.
- Accounting exports or settlement reconciliation.

Implement each capability in a dedicated service with database persistence, authorization checks, audit logging, and provider-specific handling. Do not imply that a capability exists merely because the provider offers an API for it.

## 16. Logging and observability

Record operational events such as:

- Checkout request accepted or rejected.
- Provider request succeeded or failed.
- Webhook signature verification failed.
- Webhook event received, deduplicated, or processed.
- Payment state transition completed.
- Reconciliation detected a mismatch.
- Refund or fulfillment processing failed.

Use correlation IDs and internal order/payment-attempt identifiers.

Never log:

- Provider secret keys or webhook signing secrets.
- Raw webhook signatures.
- Full payment payloads when they contain unnecessary personal information.
- Cardholder data or other prohibited payment credentials.
- Session tokens or authentication secrets.

Track payment success and failure rates, webhook processing latency, retry counts, unprocessed event age, reconciliation discrepancies, and provider API errors.

Alert on persistent webhook failures, growing unprocessed-event backlogs, configuration errors, and payment/order mismatches.

## 17. Error handling and retries

Classify errors before retrying:

- **Validation errors:** Reject without retrying.
- **Authentication or configuration errors:** Alert and resolve configuration; do not retry indefinitely.
- **Rate limits and transient provider errors:** Retry with bounded exponential backoff and jitter where appropriate.
- **Network timeouts with ambiguous outcomes:** Reconcile with the provider before creating another payment attempt.
- **Invalid webhook signatures:** Reject and log safely; do not retry business processing as if the event were valid.
- **Database failures:** Roll back incomplete transactions and allow safe redelivery or recovery.
- **Fulfillment failures:** Retain durable retryable work rather than losing the payment-to-fulfillment relationship.

Never mark an order failed merely because the browser closed or a network request timed out.

## 18. Testing checklist

### Configuration

- [ ] Unsupported provider selection is rejected.
- [ ] Missing credentials prevent startup or payment initialization.
- [ ] Test and live credentials are isolated.
- [ ] Secrets are not included in client responses or logs.

### Checkout

- [ ] Amounts are calculated on the server.
- [ ] Invalid, zero, negative, fractional, and unsafe integer amounts are rejected.
- [ ] Unsupported currencies are rejected.
- [ ] Stripe redirect URLs are checked against the application allowlist.
- [ ] Provider failures leave a recoverable local payment attempt.
- [ ] Repeated requests cannot create unintended duplicate orders.

### Webhooks

- [ ] Exact raw body bytes are preserved.
- [ ] Invalid and missing signatures are rejected.
- [ ] Wrong secrets are rejected.
- [ ] Malformed payloads are handled safely.
- [ ] Duplicate events do not repeat fulfillment.
- [ ] Unknown event types cannot change payment state.
- [ ] Amount, currency, order, and payment identifiers are checked.
- [ ] Out-of-order events do not cause invalid state transitions.
- [ ] Database failures permit safe recovery.

### Operations

- [ ] Provider test-mode flows pass end to end.
- [ ] Webhook endpoint is reachable over HTTPS.
- [ ] Monitoring and alerting are configured.
- [ ] Backup and restore procedures cover payment records.
- [ ] Reconciliation can identify missing or mismatched records.
- [ ] Production rollback procedures are documented.

## 19. Deployment checklist

Before enabling production payments:

1. Install only the selected provider SDK.
2. Configure production credentials through the deployment secret manager.
3. Configure the provider’s production webhook endpoint and signing secret.
4. Confirm the application’s raw-body webhook middleware.
5. Implement local orders, payment attempts, and webhook-event persistence.
6. Implement database uniqueness constraints and transactional state transitions.
7. Restrict checkout redirect URLs.
8. Run test-mode end-to-end and duplicate-webhook tests.
9. Verify logging, monitoring, and alerting.
10. Test reconciliation and recovery from ambiguous provider responses.
11. Confirm refund, cancellation, tax, and fulfillment policies with the relevant business owners.
12. Enable live payments only after the complete flow has been reviewed.

## 20. Ownership and maintenance

The payment integration owns the provider adapter interface and provider-specific API operations.

Application services own local orders, pricing, payment state transitions, authorization, fulfillment, and business rules.

Webhook controllers own request capture, signature-verification invocation, request validation, and reliable handoff to payment-processing services.

The database layer owns durable event deduplication, transaction boundaries, and uniqueness constraints.

Security and operations owners should review provider credentials, webhook configuration, logs, retention, reconciliation, and incident-response procedures periodically.

**Implementation status:** This README documents the intended integration contract. It does not establish that local orders, database-backed idempotency, refunds, subscriptions, tax calculation, reconciliation, or complete webhook routing have been implemented. Verify each capability against the actual code before representing it as production-ready.

—

**MedOrbits — Study · Work · Grow**
