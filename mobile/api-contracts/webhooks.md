# Server-to-Server Webhook Contract

**Status:** Proposed. Implement only for integrations that require inbound event callbacks.

## 1. Purpose

Webhooks may be used for payment-provider events or other trusted server-to-server notifications. They are not a replacement for authenticated mobile APIs.

## 2. Endpoint design

Use a dedicated route per provider or integration, for example:

`POST /api/v1/webhooks/{provider}`

The actual route and authentication mechanism must match the provider's official documentation. Do not invent a signature scheme.

## 3. Verification

- Verify the provider's signature using the official algorithm and raw request body where required.
- Validate timestamp or replay protections where supported.
- Keep signing secrets in server-side secret management.
- Never expose webhook secrets to mobile clients.
- Reject invalid signatures before applying business changes.
- Do not rely on IP allowlisting alone unless required as an additional control.

## 4. Idempotency and event ordering

Persist a provider event ID or another stable deduplication key. Repeated delivery of the same event must not repeat a financial or application state transition.

Events may be retried or arrive out of order. Validate the current provider state where necessary before applying an irreversible transition.

## 5. Response behavior

Return a successful response only after the event has been safely accepted or durably queued according to the integration design. Use provider-specific retry guidance.

Do not return internal exception details.

## 6. Audit

Record event ID, provider, received time, verification outcome, processing outcome, and safe correlation identifiers. Do not log secrets or unnecessary personal data.

## 7. Testing

Test valid signatures, invalid signatures, stale timestamps where relevant, duplicate events, out-of-order events, transient failures, and replay attempts.
