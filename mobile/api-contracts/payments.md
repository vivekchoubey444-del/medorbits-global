# Payments API Contract

**Base path:** `/api/v1`  
**Status:** Proposed; payment provider and accounting workflow must be confirmed before implementation.

## Principles

- The server calculates authoritative payable amounts.
- Never trust an amount supplied by the mobile client.
- Never store raw card numbers, CVVs, or payment credentials in MedOrbits logs or database records.
- Use the selected payment provider's supported secure checkout or SDK.
- Verify payment completion server-side.
- Do not mark an application paid based only on a mobile callback or redirect.
- Use idempotency for payment-intent creation and other non-repeatable actions.

## 1. Get fees

`GET /api/v1/admissions/{admissionId}/fees`

Example:

```json
{
  "success": true,
  "data": {
    "currency": "INR",
    "items": [
      {
        "code": "application_fee",
        "label": "Application fee",
        "amount": null,
        "required": false,
        "sourceUrl": null,
        "lastVerifiedAt": null
      }
    ]
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

An unknown amount must be null or omitted, not zero.

## 2. Create payment intent

`POST /api/v1/payments/intents`

Authentication: Required.

Example request:

```json
{
  "applicationId": "application_example_001",
  "feeCode": "application_fee"
}
```

The server verifies ownership, eligibility to pay, current fee rules, currency, and application state. The client does not choose the authoritative amount.

Example response:

```json
{
  "success": true,
  "data": {
    "paymentId": "payment_example_001",
    "status": "pending",
    "amount": null,
    "currency": "INR",
    "checkout": {
      "type": "provider_defined",
      "sessionToken": null
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

The `checkout` shape must be replaced with the actual payment provider's integration contract. Never expose secret provider credentials to the client.

## 3. Get payment status

`GET /api/v1/payments/{paymentId}`

Authentication: Required; verify the caller can access the associated payment.

Proposed statuses:

- `created`
- `pending`
- `succeeded`
- `failed`
- `cancelled`
- `refund_pending`
- `partially_refunded`
- `refunded`

Return provider references only when safe and necessary.

## 4. Request cancellation

`POST /api/v1/payments/{paymentId}/cancel`

Implement only if supported by the selected provider and current payment state. Cancellation may not be possible after payment settlement.

## 5. Refunds

If refunds are supported, expose a dedicated authorized workflow, such as:

`POST /api/v1/payments/{paymentId}/refund-requests`

A refund request is not a promise that a refund is approved or completed. Refund authorization, eligibility, amounts, and status must be verified server-side.

## 6. Provider notifications

Provider callbacks/webhooks must be authenticated and verified using the provider's official mechanism. Process events idempotently and tolerate retries and out-of-order delivery.

Never treat a client-supplied `status: "succeeded"` as proof of payment.

## 7. Audit and reconciliation

Record payment-intent creation, verified provider events, settlement, cancellation, and refunds. Store the minimum provider identifiers needed for reconciliation. Do not log payment credentials or sensitive checkout tokens.
