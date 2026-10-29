
# Payment API

**Project:** MedOrbits  
**Endpoint prefix:** `/api/payment`  
**Framework:** Next.js App Router  
**Runtime:** Node.js  
**Purpose:** Secure payment initiation, verification, and transaction status handling.

## 1. Overview

The Payment API provides the server-side foundation for processing payments for MedOrbits services, including admission guidance, consultancy services, and other paid offerings.

Payment processing must be integrated with a supported payment gateway, such as Razorpay or Stripe. The implementation must use the provider’s official SDK and server-side verification mechanisms.

**Important:** This README describes the expected API contract and security requirements. It does not mean a payment gateway has already been configured or that payments can be accepted without an implemented route and valid provider credentials.

## 2. Recommended directory structure

```text
app/
└── api/
    └── payment/
        ├── route.js
        ├── verify/
        │   └── route.js
        ├── webhook/
        │   └── route.js
        ├── route.test.js
        └── README.md
```

Use `route.js` for Next.js App Router endpoints, not `routes.js`.

The optional `verify` and `webhook` routes should be added only when implemented and configured for the chosen payment provider.

## 3. Recommended endpoint contract

| Method | Endpoint | Purpose |
|—|—|—|
| `POST` | `/api/payment` | Create a payment order or checkout session |
| `POST` | `/api/payment/verify` | Verify a completed payment |
| `POST` | `/api/payment/webhook` | Receive provider-signed payment events |
| `GET` | `/api/payment/status?id=...` | Retrieve an authorized transaction’s status, if implemented |

Do not expose internal transaction records or allow users to retrieve other customers’ payment details.

## 4. Create a payment order

Example request:

```http
POST /api/payment
Content-Type: application/json
```

```json
{
  “productId”: “admission-guidance”,
  “description”: “Admission guidance service”,
  “currency”: “INR”
}
```

The server must determine the price from trusted server-side product configuration or the database. Never trust a price, discount, currency conversion, or payment status supplied by the browser.

A successful response may contain the provider’s order or checkout-session identifier and the information required to open the provider’s checkout interface.

Example response shape:

```json
{
  “success”: true,
  “orderId”: “provider-order-id”,
  “amount”: 250000,
  “currency”: “INR”
}
```

In this example, `amount` is expressed in paise: ₹2,500.00. Actual response fields depend on the chosen provider and implementation.

Do not return secret API keys or private credentials.

## 5. Payment verification

After checkout, the frontend must submit the payment references and provider-generated signature or verification data to the server.

The server must:

1. Validate the request and required payment identifiers.
2. Retrieve or verify the payment using the provider’s trusted API or official SDK.
3. Validate the signature using the provider’s documented algorithm.
4. Confirm the amount, currency, order ID, and expected customer or transaction.
5. Verify that the transaction belongs to the correct user or order.
6. Update the database using an idempotent transaction.
7. Mark an order as paid only after authoritative verification.

A successful browser redirect or a frontend message is not proof of payment.

## 6. Webhook processing

Where supported, configure the provider’s webhook to notify the application of payment events.

The webhook handler must:

- Verify the signature against the **raw request body** using the provider’s documented method.
- Store or track provider event IDs to prevent duplicate processing.
- Process events idempotently.
- Validate the transaction, amount, currency, and order association.
- Return an appropriate HTTP response for successfully processed or safely acknowledged events.
- Avoid logging secrets, full payment credentials, or unnecessary personal data.

Configure the webhook URL in the payment provider’s dashboard and use the correct webhook signing secret. Webhook secrets and API keys are different credentials.

## 7. Environment variables

Example configuration for a Razorpay integration:

```dotenv
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

Example configuration for a Stripe integration:

```dotenv
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Choose the configuration for the provider actually implemented. Do not configure both providers unless the application intentionally supports both.

Keep all secret values in local environment files or the deployment platform’s secret manager. Never commit real credentials to GitHub or expose secret keys in client-side code.

## 8. Suggested transaction data model

A payment record should contain, as appropriate:

- Internal transaction ID
- Internal order or invoice ID
- Customer or account reference
- Provider name
- Provider order/session ID
- Provider payment ID
- Amount in the smallest currency unit
- Currency code
- Payment status
- Idempotency or event reference
- Creation and update timestamps

Recommended statuses include:

```text
created
pending
authorized
paid
failed
cancelled
refunded
partially_refunded
```

Define allowed status transitions in the application. Do not permit arbitrary status changes from client requests.

Store only the payment information needed for reconciliation and support. Never store card numbers, CVVs, PINs, or online banking passwords.

## 9. Error handling

Use consistent JSON responses, without exposing provider secrets or internal stack traces.

| HTTP status | Meaning |
|—|—|
| `400` | Invalid request |
| `401` | Authentication required, where applicable |
| `403` | Request not authorized |
| `404` | Order or transaction not found |
| `409` | Conflicting or already-processed transaction |
| `415` | Unsupported content type |
| `429` | Rate limit exceeded |
| `500` | Unexpected internal error |
| `502` / `503` | Provider or payment service unavailable |

Use the status codes appropriate to the implemented route and provider integration.

## 10. Database and reliability requirements

- Use parameterized SQL queries.
- Store monetary amounts as integer minor units, such as paise, rather than floating-point values.
- Use database transactions for related order and payment updates.
- Enforce uniqueness for provider transaction IDs and webhook event IDs where appropriate.
- Make verification and webhook handling idempotent.
- Reconcile pending transactions against the payment provider.
- Keep an audit trail of important state changes without recording sensitive payment credentials.

Do not mark an order paid solely because the frontend sends `”status”: “paid”`.

## 11. Security requirements

Before production deployment:

- Use HTTPS for checkout, callbacks, and webhooks.
- Authenticate users where appropriate and authorize access to each order.
- Validate all request fields server-side.
- Add rate limiting and abuse protection.
- Verify payment signatures and webhook authenticity.
- Keep credentials in a secret manager.
- Use provider-supported test mode before switching to live mode.
- Avoid exposing internal transaction IDs as authorization.
- Apply appropriate privacy, refund, cancellation, and retention policies.
- Never store card verification codes or raw payment-card credentials.

Origin checks and CORS are not authentication. Webhooks must be authenticated using the provider’s signature mechanism rather than relying on an `Origin` header.

## 12. Testing checklist

- [ ] Valid order creation
- [ ] Unknown product or invalid order rejected
- [ ] Amount determined by server-side configuration
- [ ] Provider failure handled safely
- [ ] Invalid signature rejected
- [ ] Amount or currency mismatch rejected
- [ ] Duplicate verification requests handled idempotently
- [ ] Duplicate webhook events handled safely
- [ ] Unauthorized transaction access rejected
- [ ] Refund and cancellation states handled correctly
- [ ] Test-mode payments work end to end
- [ ] No credentials or sensitive payment data appear in logs

Use the payment provider’s test environment and test credentials. Never test live payment flows with real customer funds unless the production procedure explicitly requires it.

## 13. Deployment checklist

- [ ] A payment provider has been selected.
- [ ] The official SDK is installed.
- [ ] Server-side order creation is implemented.
- [ ] Payment verification is implemented.
- [ ] Webhook verification is implemented if webhooks are used.
- [ ] Database schema and migrations are applied.
- [ ] Environment secrets are configured securely.
- [ ] HTTPS and provider dashboard settings are correct.
- [ ] Idempotency and transaction reconciliation are tested.
- [ ] Refund, cancellation, and customer support procedures are documented.

## 14. Maintenance

Keep this README synchronized with the actual route handlers, payment-provider SDK, database schema, tests, and deployment configuration.

Document the selected provider, supported currencies, refund workflow, webhook event types, and operational procedures once these are implemented.
