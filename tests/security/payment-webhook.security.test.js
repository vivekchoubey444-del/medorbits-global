'use strict';
/**
 * MedOrbits -- Payment Webhook Security Tests
 *
 * File: tests/security/payment-webhook.security.test.js
 * Runtime: Node.js >= 20
 * Dependencies: Node.js built-in modules only
 *
 * Configuration:
 *   PAYMENT_WEBHOOK_TEST_BASE_URL
 *   PAYMENT_WEBHOOK_TEST_PATH
 *   PAYMENT_WEBHOOK_TEST_SECRET
 *   PAYMENT_WEBHOOK_TEST_TIMEOUT_MS
 *   PAYMENT_WEBHOOK_TEST_SIGNATURE_HEADER
 *   PAYMENT_WEBHOOK_TEST_TIMESTAMP_HEADER
 *   PAYMENT_WEBHOOK_TEST_EVENT_ID_HEADER
 *   PAYMENT_WEBHOOK_TEST_TIMESTAMP_TOLERANCE_SECONDS
 *   PAYMENT_WEBHOOK_TEST_REPLAY_PROTECTION
 *
 * Run:
 *   node --test tests/security/payment-webhook.security.test.js
 *
 * IMPORTANT:
 * - Use an isolated test environment and test webhook secret.
 * - Never send synthetic payment events to production.
 * - The default signing format is a generic HMAC-SHA256 convention.
 * - Adapt signature generation to the provider's actual protocol.
 * - HTTP responses alone cannot prove payment state integrity or idempotency.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const BASE_URL = (
  process.env.PAYMENT_WEBHOOK_TEST_BASE_URL || ''
).replace(/\/+$/, '');
const WEBHOOK_PATH =
  process.env.PAYMENT_WEBHOOK_TEST_PATH ||
  '/api/payments/webhook';
const WEBHOOK_SECRET =
  process.env.PAYMENT_WEBHOOK_TEST_SECRET || '';
const SIGNATURE_HEADER = (
  process.env.PAYMENT_WEBHOOK_TEST_SIGNATURE_HEADER ||
  'x-webhook-signature'
).toLowerCase();
const TIMESTAMP_HEADER = (
  process.env.PAYMENT_WEBHOOK_TEST_TIMESTAMP_HEADER ||
  'x-webhook-timestamp'
).toLowerCase();
const EVENT_ID_HEADER = (
  process.env.PAYMENT_WEBHOOK_TEST_EVENT_ID_HEADER ||
  'x-webhook-event-id'
).toLowerCase();
const TIMEOUT_MS = Number(
  process.env.PAYMENT_WEBHOOK_TEST_TIMEOUT_MS || 15000
);
const TIMESTAMP_TOLERANCE_SECONDS = Number(
  process.env.PAYMENT_WEBHOOK_TEST_TIMESTAMP_TOLERANCE_SECONDS || 300
);
const REPLAY_PROTECTION_REQUIRED =
  process.env.PAYMENT_WEBHOOK_TEST_REPLAY_PROTECTION !== 'false';
const configured = Boolean(
  BASE_URL &&
  WEBHOOK_SECRET &&
  WEBHOOK_PATH.startsWith('/') &&
  !WEBHOOK_PATH.startsWith('//') &&
  Number.isFinite(TIMEOUT_MS) &&
  TIMEOUT_MS > 0 &&
  Number.isFinite(TIMESTAMP_TOLERANCE_SECONDS) &&
  TIMESTAMP_TOLERANCE_SECONDS > 0
);
function hmacSha256(secret, value) {
  return crypto
    .createHmac('sha256', secret)
    .update(value)
    .digest('hex');
}
/**
 * Generic signing convention:
 * HMAC_SHA256(secret, `${timestamp}.${rawBody}`)
 *
 * This is not a universal payment-provider format. Replace it with the
 * provider's documented signature generation for integration testing.
 */
function createSignature(
  rawBody,
  timestamp,
  secret = WEBHOOK_SECRET
) {
  return hmacSha256(secret, `${timestamp}.${rawBody}`);
}
function buildHeaders({
  rawBody,
  timestamp = Math.floor(Date.now() / 1000),
  secret = WEBHOOK_SECRET,
  signature,
  eventId,
  extraHeaders = {},
} = {}) {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json',
    ...extraHeaders,
  };
  if (timestamp !== undefined && timestamp !== null) {
    headers[TIMESTAMP_HEADER] = String(timestamp);
  }
  if (signature !== undefined) {
    headers[SIGNATURE_HEADER] = signature;
  } else if (rawBody !== undefined && secret) {
    headers[SIGNATURE_HEADER] = createSignature(
      rawBody,
      timestamp,
      secret
    );
  }
  if (eventId !== undefined) {
    headers[EVENT_ID_HEADER] = eventId;
  }
  return headers;
}
async function sendWebhook({
  rawBody,
  headers = {},
  method = 'POST',
  path = WEBHOOK_PATH,
} = {}) {
  assert.ok(
    path.startsWith('/') && !path.startsWith('//'),
    'Webhook path must be a relative API path'
  );
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: ['GET', 'HEAD'].includes(method) ? undefined : rawBody,
      redirect: 'manual',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
async function responseBody(response) {
  const raw = await response.text();
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
function assertRejected(response, description) {
  assert.ok(
    response.status >= 400 && response.status < 500,
    `${description}: expected HTTP 4xx, received ${response.status}`
  );
}
function makeEvent({
  id = `evt_test_${crypto.randomUUID()}`,
  type = 'payment.succeeded',
  amount = 1000,
  currency = 'INR',
  paymentId = `pay_test_${crypto.randomUUID()}`,
} = {}) {
  return {
    id,
    type,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: paymentId,
        amount,
        currency,
        status: 'succeeded',
        metadata: {
          environment: 'security-test',
        },
      },
    },
  };
}
function serializeEvent(event) {
  return JSON.stringify(event);
}
function signedEvent(event, options = {}) {
  const rawBody = serializeEvent(event);
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  return {
    rawBody,
    timestamp,
    headers: buildHeaders({
      rawBody,
      timestamp,
      eventId: event.id,
      ...options,
    }),
  };
}
test(
  'Payment webhook security integration suite',
  { skip: !configured },
  async (t) => {
    await t.test('Valid signed webhook is accepted', async () => {
      const event = makeEvent();
      const requestData = signedEvent(event);
      const response = await sendWebhook(requestData);
      assert.ok(
        response.status >= 200 && response.status < 300,
        `Valid signed webhook should be accepted; received HTTP ${response.status}`
      );
    });
    await t.test('Webhook without a signature is rejected', async () => {
      const event = makeEvent();
      const rawBody = serializeEvent(event);
      const timestamp = Math.floor(Date.now() / 1000);
      const response = await sendWebhook({
        rawBody,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          [TIMESTAMP_HEADER]: String(timestamp),
          [EVENT_ID_HEADER]: event.id,
        },
      });
      assertRejected(response, 'Unsigned webhook');
    });
    await t.test('Invalid signature is rejected', async () => {
      const event = makeEvent();
      const rawBody = serializeEvent(event);
      const timestamp = Math.floor(Date.now() / 1000);
      const response = await sendWebhook({
        rawBody,
        headers: buildHeaders({
          rawBody,
          timestamp,
          eventId: event.id,
          signature: '0'.repeat(64),
        }),
      });
      assertRejected(response, 'Invalid signature');
    });
    await t.test('Signature generated with the wrong secret is rejected', async () => {
      const event = makeEvent();
      const rawBody = serializeEvent(event);
      const timestamp = Math.floor(Date.now() / 1000);
      const wrongSecret = crypto.randomBytes(32).toString('hex');
      const response = await sendWebhook({
        rawBody,
        headers: buildHeaders({
          rawBody,
          timestamp,
          secret: wrongSecret,
          eventId: event.id,
        }),
      });
      assertRejected(response, 'Wrong-secret signature');
    });
    await t.test('Modified payload with original signature is rejected', async () => {
      const event = makeEvent({ amount: 1000 });
      const timestamp = Math.floor(Date.now() / 1000);
      const originalBody = serializeEvent(event);
      const originalSignature = createSignature(
        originalBody,
        timestamp
      );
      event.data.object.amount = 999999;
      const modifiedBody = serializeEvent(event);
      const response = await sendWebhook({
        rawBody: modifiedBody,
        headers: buildHeaders({
          rawBody: modifiedBody,
          timestamp,
          eventId: event.id,
          signature: originalSignature,
        }),
      });
      assertRejected(response, 'Tampered webhook payload');
    });
    await t.test('Expired webhook timestamp is rejected', async () => {
      const event = makeEvent();
      const rawBody = serializeEvent(event);
      const timestamp =
        Math.floor(Date.now() / 1000) -
        TIMESTAMP_TOLERANCE_SECONDS -
        60;
      const response = await sendWebhook({
        rawBody,
        headers: buildHeaders({
          rawBody,
          timestamp,
          eventId: event.id,
        }),
      });
      assertRejected(response, 'Expired webhook timestamp');
    });
    await t.test('Future timestamp outside tolerance is rejected', async () => {
      const event = makeEvent();
      const rawBody = serializeEvent(event);
      const timestamp =
        Math.floor(Date.now() / 1000) +
        TIMESTAMP_TOLERANCE_SECONDS +
        60;
      const response = await sendWebhook({
        rawBody,
        headers: buildHeaders({
          rawBody,
          timestamp,
          eventId: event.id,
        }),
      });
      assertRejected(response, 'Future webhook timestamp');
    });
    await t.test('Malformed JSON is rejected', async () => {
      const rawBody = '{"id":';
      const timestamp = Math.floor(Date.now() / 1000);
      const response = await sendWebhook({
        rawBody,
        headers: buildHeaders({
          rawBody,
          timestamp,
          eventId: `evt_malformed_${crypto.randomUUID()}`,
        }),
      });
      assertRejected(response, 'Malformed JSON');
    });
    await t.test('Invalid payment amounts do not cause server errors', async () => {
      const invalidAmounts = [-1, '1000', null];
      for (const amount of invalidAmounts) {
        const event = makeEvent({ amount });
        const requestData = signedEvent(event);
        const response = await sendWebhook(requestData);
        assert.ok(
          response.status < 500,
          `Invalid amount ${String(amount)} caused HTTP ${response.status}`
        );
        // This check detects server crashes, not payment-state integrity.
        // Verify persisted payment state separately using a trusted
        // test-database helper or provider-adapter integration test.
        await responseBody(response);
      }
    });
    await t.test('Unknown event type does not cause a server error', async () => {
      const event = makeEvent({
        type: 'payment.security_test.unknown',
      });
      const response = await sendWebhook(signedEvent(event));
      assert.ok(
        response.status < 500,
        `Unknown event caused HTTP ${response.status}`
      );
    });
    await t.test('Unsupported HTTP methods are rejected', async () => {
      const response = await sendWebhook({
        method: 'GET',
        headers: { accept: 'application/json' },
      });
      assert.ok(
        [400, 404, 405, 501].includes(response.status),
        `Unexpected GET response: HTTP ${response.status}`
      );
    });
    await t.test(
      'Duplicate webhook delivery does not cause a server error',
      { skip: !REPLAY_PROTECTION_REQUIRED },
      async () => {
        const event = makeEvent();
        const requestData = signedEvent(event);
        const first = await sendWebhook(requestData);
        assert.ok(
          first.status >= 200 && first.status < 300,
          `First delivery should be accepted; HTTP ${first.status}`
        );
        const second = await sendWebhook(requestData);
        assert.ok(
          second.status < 500,
          `Duplicate delivery caused HTTP ${second.status}`
        );
        // A 2xx or 4xx duplicate response alone cannot prove that
        // financial effects were applied exactly once. Assert the
        // final payment and subscription state in integration tests.
      }
    );
  }
);
test('Webhook signing helper produces deterministic HMAC-SHA256 digests', () => {
  const rawBody = JSON.stringify(makeEvent());
  const timestamp = 1700000000;
  const first = createSignature(rawBody, timestamp, 'test-secret');
  const second = createSignature(rawBody, timestamp, 'test-secret');
  const different = createSignature(
    rawBody,
    timestamp,
    'different-secret'
  );
  assert.equal(first, second);
  assert.notEqual(first, different);
  assert.match(first, /^[a-f0-9]{64}$/);
});