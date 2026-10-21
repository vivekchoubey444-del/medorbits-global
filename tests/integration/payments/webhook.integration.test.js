
'use strict';

/**
 * MedOrbits -- Payment Webhook Integration Tests
 *
 * File: tests/integration/payments/webhook.integration.test.js
 * Runtime: Node.js >= 20
 *
 * Test coverage:
 * - Webhook endpoint availability and redirect handling
 * - Valid HMAC-SHA256 signature
 * - Missing, invalid, and tampered signatures
 * - Malformed JSON and unsupported content types
 * - Missing event identifiers
 * - Invalid payment amounts
 * - Duplicate webhook delivery
 * - Concurrent duplicate delivery
 * - Payment-state integrity
 *
 * IMPORTANT:
 * Configure the endpoint, authentication, event schema, and response
 * fields to match the actual MedOrbits implementation.
 *
 * Never run mutating tests against production.
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const BASE_URL = (
  process.env.PAYMENT_TEST_BASE_URL ||
  process.env.TEST_BASE_URL ||
  'http://127.0.0.1:3000'
).replace(/\/+$/, '');

const WEBHOOK_PATH =
  process.env.PAYMENT_WEBHOOK_TEST_PATH ||
  '/api/payments/webhook';

const PAYMENT_PATH =
  process.env.PAYMENT_TEST_PATH ||
  '/api/payments/:paymentId';

const PAYMENT_ID = process.env.TEST_PAYMENT_ID || '';
const TEST_TOKEN = process.env.PAYMENT_TEST_TOKEN || '';
const WEBHOOK_SECRET =
  process.env.PAYMENT_WEBHOOK_TEST_SECRET || '';

const SIGNATURE_HEADER =
  process.env.PAYMENT_WEBHOOK_SIGNATURE_HEADER ||
  'x-webhook-signature';

const SIGNATURE_FORMAT =
  process.env.PAYMENT_WEBHOOK_SIGNATURE_FORMAT || 'hex';

const WEBHOOK_AUTH_MODE =
  process.env.PAYMENT_WEBHOOK_AUTH_MODE || 'hmac-sha256';

const EVENT_ID_HEADER =
  process.env.PAYMENT_EVENT_ID_HEADER || 'x-event-id';

const EVENT_ID_FIELD =
  process.env.PAYMENT_EVENT_ID_FIELD || 'id';

const EVENT_TYPE =
  process.env.PAYMENT_TEST_EVENT_TYPE || 'payment.succeeded';

const AMOUNT_MINOR = Number(
  process.env.TEST_PAYMENT_AMOUNT_MINOR || 10000
);

const CURRENCY =
  process.env.TEST_PAYMENT_CURRENCY || 'INR';

const TIMEOUT_MS = Number(
  process.env.PAYMENT_TEST_TIMEOUT_MS || 15000
);

const RUN_MUTATING_TESTS =
  process.env.RUN_MUTATING_PAYMENT_TESTS === 'true';

const ALLOW_REMOTE_SANDBOX =
  process.env.PAYMENT_TEST_ALLOW_REMOTE_SANDBOX === 'true';

const TEST_ENVIRONMENT =
  process.env.PAYMENT_TEST_ENVIRONMENT || '';

function validateConfiguration() {
  let url;

  try {
    url = new URL(BASE_URL);
  } catch {
    throw new Error(
      'PAYMENT_TEST_BASE_URL must be a valid URL.'
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(url.protocol),
    'The payment test URL must use HTTP or HTTPS.'
  );

  assert.equal(
    url.username,
    '',
    'Do not include credentials in PAYMENT_TEST_BASE_URL.'
  );

  assert.equal(
    url.password,
    '',
    'Do not include credentials in PAYMENT_TEST_BASE_URL.'
  );

  assert.ok(
    WEBHOOK_PATH.startsWith('/') &&
      !WEBHOOK_PATH.startsWith('//') &&
      !/[\r\n]/.test(WEBHOOK_PATH),
    'PAYMENT_WEBHOOK_TEST_PATH must be a valid absolute path.'
  );

  assert.ok(
    PAYMENT_PATH.startsWith('/') &&
      !PAYMENT_PATH.startsWith('//') &&
      PAYMENT_PATH.includes(':paymentId') &&
      !/[\r\n]/.test(PAYMENT_PATH),
    'PAYMENT_TEST_PATH must be an absolute path containing :paymentId.'
  );

  assert.ok(
    /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(EVENT_ID_HEADER),
    'PAYMENT_EVENT_ID_HEADER is not a valid HTTP header name.'
  );

  assert.ok(
    /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(SIGNATURE_HEADER),
    'PAYMENT_WEBHOOK_SIGNATURE_HEADER is not a valid HTTP header name.'
  );

  assert.ok(
    EVENT_ID_FIELD.trim().length > 0,
    'PAYMENT_EVENT_ID_FIELD cannot be empty.'
  );

  assert.ok(
    ['hex', 'sha256=', 'base64'].includes(SIGNATURE_FORMAT),
    'PAYMENT_WEBHOOK_SIGNATURE_FORMAT must be hex, sha256=, or base64.'
  );

  assert.ok(
    ['hmac-sha256', 'bearer', 'none'].includes(WEBHOOK_AUTH_MODE),
    'PAYMENT_WEBHOOK_AUTH_MODE must be hmac-sha256, bearer, or none.'
  );

  assert.ok(
    Number.isSafeInteger(AMOUNT_MINOR) && AMOUNT_MINOR > 0,
    'TEST_PAYMENT_AMOUNT_MINOR must be a positive integer.'
  );

  assert.ok(
    Number.isSafeInteger(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'PAYMENT_TEST_TIMEOUT_MS must be a positive integer.'
  );

  if (WEBHOOK_AUTH_MODE === 'hmac-sha256') {
    assert.ok(
      WEBHOOK_SECRET.length > 0,
      'PAYMENT_WEBHOOK_TEST_SECRET is required for HMAC authentication.'
    );
  }

  if (WEBHOOK_AUTH_MODE === 'bearer') {
    assert.ok(
      TEST_TOKEN.length > 0,
      'PAYMENT_TEST_TOKEN is required for bearer authentication.'
    );
  }

  if (!RUN_MUTATING_TESTS) {
    return;
  }

  assert.equal(
    process.env.NODE_ENV,
    'test',
    'Mutating tests require NODE_ENV=test.'
  );

  assert.ok(
    PAYMENT_ID,
    'TEST_PAYMENT_ID must identify a dedicated test payment.'
  );

  assert.ok(
    TEST_TOKEN,
    'PAYMENT_TEST_TOKEN is required to inspect payment state.'
  );

  const isLoopback = [
    'localhost',
    '127.0.0.1',
    '::1',
    '[::1]',
  ].includes(url.hostname.toLowerCase());

  if (!isLoopback) {
    assert.ok(
      ALLOW_REMOTE_SANDBOX &&
        TEST_ENVIRONMENT.toLowerCase() === 'sandbox',
      'Remote mutation tests require PAYMENT_TEST_ALLOW_REMOTE_SANDBOX=true and PAYMENT_TEST_ENVIRONMENT=sandbox.'
    );

    assert.equal(
      url.protocol,
      'https:',
      'Remote sandbox tests must use HTTPS.'
    );
  }
}

function newEventId() {
  return `evt_test_${crypto.randomUUID()}`;
}

function createEvent({
  id = newEventId(),
  paymentId = PAYMENT_ID || 'pay_test_fixture',
  amount = AMOUNT_MINOR,
  type = EVENT_TYPE,
  currency = CURRENCY,
} = {}) {
  return {
    [EVENT_ID_FIELD]: id,
    type,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: paymentId,
        amount,
        currency,
        status: 'succeeded',
      },
    },
  };
}

function createSignature(rawBody) {
  const digest = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest(
      SIGNATURE_FORMAT === 'base64' ? 'base64' : 'hex'
    );

  return SIGNATURE_FORMAT === 'sha256='
    ? `sha256=${digest}`
    : digest;
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: 'manual',
    });

    const rawBody = await response.text();
    let body = null;

    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = rawBody;
      }
    }

    return {
      status: response.status,
      headers: response.headers,
      body,
      rawBody,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function sendWebhook({
  event,
  rawBody,
  signature,
  omitSignature = false,
  omitEventIdHeader = false,
  headerEventId,
  contentType = 'application/json',
  extraHeaders = {},
} = {}) {
  const body =
    rawBody !== undefined
      ? rawBody
      : JSON.stringify(event);

  const headers = {
    'Content-Type': contentType,
    Accept: 'application/json',
    ...extraHeaders,
  };

  if (!omitEventIdHeader) {
    const id =
      headerEventId ??
      event?.[EVENT_ID_FIELD];

    if (id !== undefined && id !== null && String(id).length) {
      headers[EVENT_ID_HEADER] = String(id);
    }
  }

  if (WEBHOOK_AUTH_MODE === 'hmac-sha256') {
    if (!omitSignature) {
      headers[SIGNATURE_HEADER] =
        signature ?? createSignature(body);
    }
  } else if (WEBHOOK_AUTH_MODE === 'bearer') {
    headers.Authorization = `Bearer ${TEST_TOKEN}`;
  }

  return requestJson(`${BASE_URL}${WEBHOOK_PATH}`, {
    method: 'POST',
    headers,
    body,
  });
}

async function getPayment() {
  assert.ok(
    PAYMENT_ID,
    'TEST_PAYMENT_ID is required to inspect payment state.'
  );

  assert.ok(
    TEST_TOKEN,
    'PAYMENT_TEST_TOKEN is required to inspect payment state.'
  );

  const path = PAYMENT_PATH.replace(
    ':paymentId',
    encodeURIComponent(PAYMENT_ID)
  );

  return requestJson(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${TEST_TOKEN}`,
      Accept: 'application/json',
    },
  });
}

function assertNoServerError(response, label) {
  assert.ok(
    response.status < 500,
    `${label}: HTTP ${response.status}; response=${JSON.stringify(response.body)}`
  );
}

function assertRejected(response, label) {
  assert.ok(
    [400, 401, 403, 404, 409, 415, 422].includes(
      response.status
    ),
    `${label}: expected a client-error status, received HTTP ${response.status}.`
  );
}

function isAcknowledged(response) {
  return [200, 201, 202, 204].includes(response.status);
}

function extractPayment(response) {
  const body = response?.body;

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return null;
  }

  return (
    body.payment ||
    body.data?.payment ||
    body.data ||
    body
  );
}

function extractStablePaymentFields(payment) {
  const fields = [
    'id',
    'paymentId',
    'status',
    'state',
    'amount',
    'amountMinor',
    'originalAmount',
    'originalAmountMinor',
    'currency',
    'refundedAmount',
    'refundedAmountMinor',
    'amountRefunded',
    'refundCount',
  ];

  const result = {};

  for (const field of fields) {
    if (payment[field] !== undefined) {
      result[field] = payment[field];
    }
  }

  return result;
}

function assertValidPaymentAmounts(payment) {
  for (const field of [
    'amount',
    'amountMinor',
    'originalAmount',
    'originalAmountMinor',
    'refundedAmount',
    'refundedAmountMinor',
    'amountRefunded',
    'refundCount',
  ]) {
    if (payment[field] === undefined || payment[field] === null) {
      continue;
    }

    assert.ok(
      Number.isSafeInteger(payment[field]) &&
        payment[field] >= 0,
      `Payment field "${field}" must be a non-negative integer.`
    );
  }

  const original =
    payment.originalAmountMinor ??
    payment.originalAmount ??
    payment.amountMinor ??
    payment.amount;

  const refunded =
    payment.refundedAmountMinor ??
    payment.refundedAmount ??
    payment.amountRefunded;

  if (
    Number.isSafeInteger(original) &&
    Number.isSafeInteger(refunded)
  ) {
    assert.ok(
      refunded <= original,
      'Refunded amount exceeds the original payment amount.'
    );
  }
}

async function getPaymentSnapshot(label) {
  const response = await getPayment();

  assert.equal(
    response.status,
    200,
    `${label}: payment lookup returned HTTP ${response.status}.`
  );

  const payment = extractPayment(response);

  assert.ok(
    payment && typeof payment === 'object',
    `${label}: payment response did not contain a payment object.`
  );

  assertValidPaymentAmounts(payment);

  return extractStablePaymentFields(payment);
}

describe('MedOrbits payment webhook integration', () => {
  before(() => {
    validateConfiguration();
  });

  describe('webhook endpoint', () => {
    it('does not redirect webhook requests', async () => {
      const response = await sendWebhook({
        event: createEvent(),
      });

      assert.ok(
        response.status < 500,
        `Webhook endpoint returned HTTP ${response.status}.`
      );

      assert.ok(
        response.status < 300 || response.status >= 400,
        `Webhook endpoint unexpectedly redirected with HTTP ${response.status}.`
      );
    });

    it(
      'accepts a correctly signed event',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const event = createEvent({
          id: newEventId(),
          paymentId: PAYMENT_ID,
        });

        const response = await sendWebhook({ event });

        assertNoServerError(response, 'Valid signed event');

        assert.ok(
          isAcknowledged(response),
          `Expected valid event acknowledgement, received HTTP ${response.status}.`
        );
      }
    );
  });

  describe('signature verification', () => {
    it(
      'rejects a missing signature',
      {
        skip:
          !RUN_MUTATING_TESTS ||
          WEBHOOK_AUTH_MODE !== 'hmac-sha256',
      },
      async () => {
        const response = await sendWebhook({
          event: createEvent(),
          omitSignature: true,
        });

        assertNoServerError(response, 'Missing signature');
        assertRejected(response, 'Missing signature');
      }
    );

    it(
      'rejects an invalid signature',
      {
        skip:
          !RUN_MUTATING_TESTS ||
          WEBHOOK_AUTH_MODE !== 'hmac-sha256',
      },
      async () => {
        const response = await sendWebhook({
          event: createEvent(),
          signature: 'invalid-signature',
        });

        assertNoServerError(response, 'Invalid signature');
        assertRejected(response, 'Invalid signature');
      }
    );

    it(
      'rejects a payload modified after signing',
      {
        skip:
          !RUN_MUTATING_TESTS ||
          WEBHOOK_AUTH_MODE !== 'hmac-sha256',
      },
      async () => {
        const event = createEvent();
        const originalBody = JSON.stringify(event);
        const signature = createSignature(originalBody);

        const modifiedEvent = {
          ...event,
          data: {
            object: {
              ...event.data.object,
              amount: AMOUNT_MINOR + 500,
            },
          },
        };

        const response = await sendWebhook({
          event: modifiedEvent,
          signature,
        });

        assertNoServerError(
          response,
          'Modified signed payload'
        );

        assertRejected(
          response,
          'Modified signed payload'
        );
      }
    );
  });

  describe('payload validation', () => {
    it(
      'rejects malformed JSON',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const rawBody = '{"id":';

        const response = await sendWebhook({
          rawBody,
          signature:
            WEBHOOK_AUTH_MODE === 'hmac-sha256'
              ? createSignature(rawBody)
              : undefined,
        });

        assertNoServerError(response, 'Malformed JSON');
        assertRejected(response, 'Malformed JSON');
      }
    );

    it(
      'rejects an event without an event identifier',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const event = createEvent();
        delete event[EVENT_ID_FIELD];

        const response = await sendWebhook({
          event,
          omitEventIdHeader: true,
        });

        assertNoServerError(
          response,
          'Missing event identifier'
        );

        assertRejected(
          response,
          'Missing event identifier'
        );
      }
    );

    it(
      'rejects a negative payment amount',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const event = createEvent({
          amount: -1,
        });

        const response = await sendWebhook({ event });

        assertNoServerError(
          response,
          'Negative payment amount'
        );

        assertRejected(
          response,
          'Negative payment amount'
        );
      }
    );

    it(
      'rejects an unsupported content type',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const response = await sendWebhook({
          event: createEvent(),
          contentType: 'text/plain',
        });

        assertNoServerError(
          response,
          'Unsupported content type'
        );

        assertRejected(
          response,
          'Unsupported content type'
        );
      }
    );
  });

  describe('duplicate delivery and idempotency', () => {
    it(
      'does not change stable payment fields on duplicate delivery',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const event = createEvent({
          id: newEventId(),
          paymentId: PAYMENT_ID,
        });

        const before = await getPaymentSnapshot(
          'Before webhook delivery'
        );

        const first = await sendWebhook({ event });

        assertNoServerError(first, 'First event delivery');

        assert.ok(
          isAcknowledged(first),
          `First event was not acknowledged: HTTP ${first.status}.`
        );

        const afterFirst = await getPaymentSnapshot(
          'After first delivery'
        );

        const second = await sendWebhook({ event });

        assertNoServerError(second, 'Duplicate event delivery');

        assert.ok(
          isAcknowledged(second) || second.status === 409,
          `Unexpected duplicate response: HTTP ${second.status}.`
        );

        const afterSecond = await getPaymentSnapshot(
          'After duplicate delivery'
        );

        /*
         * This comparison is appropriate only if processing this event
         * should not change the selected fields on the existing payment.
         * If the event legitimately transitions payment status, assert
         * the expected transition and compare afterFirst with afterSecond.
         */
        assert.deepEqual(
          afterSecond,
          afterFirst,
          'Duplicate delivery changed stable payment fields.'
        );

        assert.ok(
          Object.keys(before).length > 0,
          'Payment API exposed no stable fields for comparison.'
        );
      }
    );

    it(
      'handles concurrent delivery of the same event',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const event = createEvent({
          id: newEventId(),
          paymentId: PAYMENT_ID,
        });

        const responses = await Promise.all(
          Array.from(
            { length: 5 },
            () => sendWebhook({ event })
          )
        );

        for (const response of responses) {
          assertNoServerError(
            response,
            'Concurrent webhook delivery'
          );

          assert.ok(
            isAcknowledged(response) ||
              response.status === 409,
            `Unexpected concurrent response: HTTP ${response.status}.`
          );
        }

        assert.ok(
          responses.some(isAcknowledged),
          'No concurrent delivery was acknowledged.'
        );

        const payment = await getPaymentSnapshot(
          'After concurrent delivery'
        );

        assert.ok(
          Object.keys(payment).length > 0,
          'No stable payment fields were available after concurrent delivery.'
        );
      }
    );
  });

  describe('payment-state integrity', () => {
    it(
      'keeps payment amount fields valid after processing',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const response = await getPayment();

        assert.equal(
          response.status,
          200,
          `Payment lookup failed with HTTP ${response.status}.`
        );

        const payment = extractPayment(response);

        assert.ok(
          payment && typeof payment === 'object',
          'Expected a payment object in the response.'
        );

        assertValidPaymentAmounts(payment);
      }
    );
  });
});
