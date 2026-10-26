
'use strict';

/**
 * MedOrbits -- Payment Webhook Integration Tests
 *
 * File: tests/integration/payments/webhook.integration.test.js
 * Runtime: Node.js >= 20
 *
 * Coverage:
 * - Non-mutating endpoint and redirect probe
 * - HMAC-SHA256 signature verification
 * - Missing, invalid, and tampered signatures
 * - Malformed JSON and unsupported content types
 * - Missing event identifiers and invalid amounts
 * - Duplicate and concurrent webhook delivery
 * - Payment-state and amount invariants
 *
 * Safety:
 * - Mutating tests are opt-in.
 * - Mutating tests require NODE_ENV=test and a dedicated test payment.
 * - Remote mutations require explicit sandbox authorization and HTTPS.
 * - Never run against production or real customer payments.
 *
 * Adapt endpoint paths, event schemas, authentication, response shapes,
 * and payment-state expectations to the actual MedOrbits API.
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

const ALLOWED_SIGNATURE_FORMATS = new Set([
  'hex',
  'sha256=',
  'base64',
]);

const ALLOWED_AUTH_MODES = new Set([
  'hmac-sha256',
  'bearer',
  'none',
]);

const ACKNOWLEDGED_STATUSES = new Set([
  200,
  201,
  202,
  204,
]);

const REJECTION_STATUSES = new Set([
  400,
  401,
  403,
  415,
  422,
]);

const STABLE_PAYMENT_FIELDS = [
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

function isValidHeaderName(value) {
  return (
    typeof value === 'string' &&
    /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(value)
  );
}

function isValidAbsolutePath(value) {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/[?#\r\n]/.test(value)
  );
}

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase();

  return [
    'localhost',
    '127.0.0.1',
    '::1',
    '[::1]',
  ].includes(normalized);
}

function validateConfiguration() {
  let url;

  try {
    url = new URL(BASE_URL);
  } catch {
    throw new Error(
      'PAYMENT_TEST_BASE_URL must be a valid absolute URL.'
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(url.protocol),
    'The test URL must use HTTP or HTTPS.'
  );

  assert.equal(
    url.username,
    '',
    'Do not embed credentials in PAYMENT_TEST_BASE_URL.'
  );

  assert.equal(
    url.password,
    '',
    'Do not embed credentials in PAYMENT_TEST_BASE_URL.'
  );

  assert.equal(
    url.search,
    '',
    'PAYMENT_TEST_BASE_URL must not contain a query string.'
  );

  assert.equal(
    url.hash,
    '',
    'PAYMENT_TEST_BASE_URL must not contain a fragment.'
  );

  assert.ok(
    isValidAbsolutePath(WEBHOOK_PATH),
    'PAYMENT_WEBHOOK_TEST_PATH must be a valid absolute path.'
  );

  assert.ok(
    isValidAbsolutePath(PAYMENT_PATH) &&
      PAYMENT_PATH.includes(':paymentId'),
    'PAYMENT_TEST_PATH must be an absolute path containing :paymentId.'
  );

  assert.ok(
    isValidHeaderName(SIGNATURE_HEADER),
    'PAYMENT_WEBHOOK_SIGNATURE_HEADER is not a valid HTTP header name.'
  );

  assert.ok(
    isValidHeaderName(EVENT_ID_HEADER),
    'PAYMENT_EVENT_ID_HEADER is not a valid HTTP header name.'
  );

  assert.notEqual(
    SIGNATURE_HEADER.toLowerCase(),
    EVENT_ID_HEADER.toLowerCase(),
    'Signature and event ID headers must be different.'
  );

  assert.ok(
    typeof EVENT_ID_FIELD === 'string' &&
      EVENT_ID_FIELD.trim().length > 0 &&
      !/[.\[\]\r\n]/.test(EVENT_ID_FIELD),
    'PAYMENT_EVENT_ID_FIELD must be a non-empty top-level field name.'
  );

  assert.ok(
    ALLOWED_SIGNATURE_FORMATS.has(SIGNATURE_FORMAT),
    'PAYMENT_WEBHOOK_SIGNATURE_FORMAT must be hex, sha256=, or base64.'
  );

  assert.ok(
    ALLOWED_AUTH_MODES.has(WEBHOOK_AUTH_MODE),
    'PAYMENT_WEBHOOK_AUTH_MODE must be hmac-sha256, bearer, or none.'
  );

  assert.ok(
    Number.isSafeInteger(AMOUNT_MINOR) && AMOUNT_MINOR > 0,
    'TEST_PAYMENT_AMOUNT_MINOR must be a positive safe integer.'
  );

  assert.ok(
    Number.isSafeInteger(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'PAYMENT_TEST_TIMEOUT_MS must be a positive safe integer.'
  );

  assert.ok(
    /^[A-Z]{3}$/.test(CURRENCY),
    'TEST_PAYMENT_CURRENCY must be a three-letter uppercase currency code.'
  );

  if (WEBHOOK_AUTH_MODE === 'hmac-sha256') {
    assert.ok(
      WEBHOOK_SECRET.length >= 16,
      'PAYMENT_WEBHOOK_TEST_SECRET must contain at least 16 characters.'
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
    PAYMENT_ID.trim().length > 0,
    'TEST_PAYMENT_ID must identify a dedicated disposable test payment.'
  );

  assert.ok(
    TEST_TOKEN.length > 0,
    'PAYMENT_TEST_TOKEN is required to inspect payment state.'
  );

  assert.notEqual(
    PAYMENT_ID.toLowerCase().startsWith('live_'),
    true,
    'A live payment identifier is not allowed.'
  );

  const isLoopback = isLoopbackHostname(url.hostname);

  if (!isLoopback) {
    assert.ok(
      ALLOW_REMOTE_SANDBOX &&
        TEST_ENVIRONMENT.toLowerCase() === 'sandbox',
      'Remote mutations require PAYMENT_TEST_ALLOW_REMOTE_SANDBOX=true and PAYMENT_TEST_ENVIRONMENT=sandbox.'
    );

    assert.equal(
      url.protocol,
      'https:',
      'Remote sandbox mutations must use HTTPS.'
    );
  }

  if (
    TEST_ENVIRONMENT.toLowerCase() === 'production' ||
    TEST_ENVIRONMENT.toLowerCase() === 'live'
  ) {
    assert.fail(
      'Payment integration tests must never run against production or live services.'
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
  assert.equal(
    typeof rawBody,
    'string',
    'The exact serialized request body is required for signing.'
  );

  const digest = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest(
      SIGNATURE_FORMAT === 'base64' ? 'base64' : 'hex'
    );

  return SIGNATURE_FORMAT === 'sha256='
    ? `sha256=${digest}`
    : digest;
}

async function request(url, options = {}) {
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

    if (rawBody.length > 0) {
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
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${TIMEOUT_MS} ms: ${url}`,
        { cause: error }
      );
    }

    throw error;
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

  assert.equal(
    typeof body,
    'string',
    'Webhook body must be a string.'
  );

  const headers = {
    Accept: 'application/json',
    'Content-Type': contentType,
    ...extraHeaders,
  };

  if (!omitEventIdHeader) {
    const eventId =
      headerEventId ??
      event?.[EVENT_ID_FIELD];

    if (
      eventId !== undefined &&
      eventId !== null &&
      String(eventId).length > 0
    ) {
      headers[EVENT_ID_HEADER] = String(eventId);
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

  return request(`${BASE_URL}${WEBHOOK_PATH}`, {
    method: 'POST',
    headers,
    body,
  });
}

async function getPayment() {
  assert.ok(
    PAYMENT_ID.length > 0,
    'TEST_PAYMENT_ID is required to inspect payment state.'
  );

  assert.ok(
    TEST_TOKEN.length > 0,
    'PAYMENT_TEST_TOKEN is required to inspect payment state.'
  );

  const path = PAYMENT_PATH.replace(
    ':paymentId',
    encodeURIComponent(PAYMENT_ID)
  );

  return request(`${BASE_URL}${path}`, {
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
    `${label}: received HTTP ${response.status}; response=${JSON.stringify(response.body)}`
  );
}

function assertRejected(response, label) {
  assert.ok(
    REJECTION_STATUSES.has(response.status),
    `${label}: expected HTTP ${[...REJECTION_STATUSES].join(', ')}, received HTTP ${response.status}.`
  );
}

function isAcknowledged(response) {
  return ACKNOWLEDGED_STATUSES.has(response.status);
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

  const payment =
    body.payment ??
    body.data?.payment ??
    body.data ??
    body;

  return (
    payment &&
    typeof payment === 'object' &&
    !Array.isArray(payment)
  )
    ? payment
    : null;
}

function extractStablePaymentFields(payment) {
  const result = {};

  for (const field of STABLE_PAYMENT_FIELDS) {
    if (payment[field] !== undefined) {
      result[field] = payment[field];
    }
  }

  return result;
}

function assertValidPaymentAmounts(payment) {
  const integerFields = [
    'amount',
    'amountMinor',
    'originalAmount',
    'originalAmountMinor',
    'refundedAmount',
    'refundedAmountMinor',
    'amountRefunded',
    'refundCount',
  ];

  for (const field of integerFields) {
    const value = payment[field];

    if (value === undefined || value === null) {
      continue;
    }

    assert.ok(
      Number.isSafeInteger(value) && value >= 0,
      `Payment field "${field}" must be a non-negative safe integer.`
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

  if (
    typeof payment.currency === 'string' &&
    payment.currency.length > 0
  ) {
    assert.match(
      payment.currency,
      /^[A-Z]{3}$/,
      'Payment currency must be a three-letter uppercase code.'
    );
  }
}

async function getPaymentSnapshot(label) {
  const response = await getPayment();

  assert.equal(
    response.status,
    200,
    `${label}: payment lookup returned HTTP ${response.status}; response=${JSON.stringify(response.body)}`
  );

  const payment = extractPayment(response);

  assert.ok(
    payment,
    `${label}: payment response did not contain a payment object.`
  );

  assertValidPaymentAmounts(payment);

  const snapshot = extractStablePaymentFields(payment);

  assert.ok(
    Object.keys(snapshot).length > 0,
    `${label}: no stable payment fields were available.`
  );

  return snapshot;
}

function assertNoRedirect(response, label) {
  assert.ok(
    !(response.status >= 300 && response.status < 400),
    `${label}: unexpected redirect with HTTP ${response.status} to ${response.headers.get('location') || '(no location header)'}.`
  );
}

function assertExpectedEventAcknowledgement(response, label) {
  assertNoServerError(response, label);

  assert.ok(
    isAcknowledged(response),
    `${label}: expected an acknowledgement, received HTTP ${response.status}; response=${JSON.stringify(response.body)}`
  );
}

describe('MedOrbits payment webhook integration', () => {
  before(() => {
    validateConfiguration();
  });

  describe('endpoint routing', () => {
    it('does not redirect a non-mutating GET probe', async () => {
      /*
       * Use GET instead of POST for the endpoint probe. Sending a POST
       * can process a webhook even when mutation tests are disabled.
       *
       * A 404 or 405 is acceptable for a POST-only webhook endpoint.
       */
      const response = await request(
        `${BASE_URL}${WEBHOOK_PATH}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        }
      );

      assertNoRedirect(response, 'Webhook GET probe');
      assertNoServerError(response, 'Webhook GET probe');

      assert.ok(
        [200, 204, 400, 401, 403, 404, 405, 415, 422].includes(
          response.status
        ),
        `Unexpected webhook GET probe status: HTTP ${response.status}.`
      );
    });
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

        assertRejected(
          response,
          'Payload modified after signing'
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

        assertRejected(response, 'Missing event identifier');
      }
    );

    it(
      'rejects a negative payment amount',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const event = createEvent({ amount: -1 });
        const response = await sendWebhook({ event });

        assertRejected(response, 'Negative payment amount');
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

        assertRejected(response, 'Unsupported content type');
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

        const first = await sendWebhook({ event });

        assertExpectedEventAcknowledgement(
          first,
          'First event delivery'
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

        assert.deepEqual(
          afterSecond,
          afterFirst,
          'Duplicate delivery changed stable payment fields.'
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
            isAcknowledged(response) || response.status === 409,
            `Unexpected concurrent response: HTTP ${response.status}.`
          );
        }

        assert.ok(
          responses.some(isAcknowledged),
          'No concurrent delivery was acknowledged.'
        );

        /*
         * A stable payment snapshot alone does not prove that only one
         * event was processed. For stronger proof, query the persisted
         * webhook-event table or an equivalent processing/audit record
         * and assert that this event ID was applied exactly once.
         */
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
          `Payment lookup failed with HTTP ${response.status}; response=${JSON.stringify(response.body)}`
        );

        const payment = extractPayment(response);

        assert.ok(
          payment,
          'Expected a payment object in the response.'
        );

        assertValidPaymentAmounts(payment);
      }
    );
  });
});
