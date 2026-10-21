
'use strict';

/**
 * MedOrbits -- Duplicate Payment Events Integration Tests
 *
 * File: tests/integration/payments/duplicate-events.integration.test.js
 * Runtime: Node.js >= 20
 *
 * Coverage:
 * - Duplicate webhook delivery
 * - Concurrent delivery of the same event
 * - Event idempotency
 * - Conflicting payloads using the same event ID
 * - Invalid or missing event identifiers
 * - Webhook signature validation
 * - Payment-state consistency
 *
 * IMPORTANT:
 * Configure the endpoint, authentication/signature mechanism, event schema,
 * and payment response fields to match the actual application.
 * Use only a dedicated integration-test environment or payment-provider
 * sandbox. Never run mutation tests against production.
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

const TEST_TOKEN = process.env.PAYMENT_TEST_TOKEN || '';
const PAYMENT_ID = process.env.TEST_PAYMENT_ID || '';

const EVENT_ID_HEADER =
  process.env.PAYMENT_EVENT_ID_HEADER || 'x-event-id';

const EVENT_ID_FIELD =
  process.env.PAYMENT_EVENT_ID_FIELD || 'id';

const EVENT_TYPE =
  process.env.PAYMENT_TEST_EVENT_TYPE || 'payment.succeeded';

const EVENT_AMOUNT_MINOR = Number(
  process.env.TEST_PAYMENT_AMOUNT_MINOR || 10000
);

const CURRENCY = process.env.TEST_PAYMENT_CURRENCY || 'INR';

const REQUEST_TIMEOUT_MS = Number(
  process.env.PAYMENT_TEST_TIMEOUT_MS || 15000
);

const ENABLE_MUTATING_TESTS =
  process.env.RUN_MUTATING_PAYMENT_TESTS === 'true';

const WEBHOOK_SECRET =
  process.env.PAYMENT_WEBHOOK_TEST_SECRET || '';

const SIGNATURE_HEADER =
  process.env.PAYMENT_WEBHOOK_SIGNATURE_HEADER ||
  'x-webhook-signature';

const SIGNATURE_FORMAT =
  process.env.PAYMENT_WEBHOOK_SIGNATURE_FORMAT || 'hex';

const WEBHOOK_AUTH_MODE =
  process.env.PAYMENT_WEBHOOK_AUTH_MODE || 'hmac-sha256';

const ALLOW_REMOTE_SANDBOX =
  process.env.PAYMENT_TEST_ALLOW_REMOTE_SANDBOX === 'true';

const PAYMENT_TEST_ENVIRONMENT =
  process.env.PAYMENT_TEST_ENVIRONMENT || '';

const MUTATION_ENABLED = ENABLE_MUTATING_TESTS;

function validateBaseConfiguration() {
  let parsedUrl;

  try {
    parsedUrl = new URL(BASE_URL);
  } catch {
    throw new Error('PAYMENT_TEST_BASE_URL must be a valid URL.');
  }

  assert.ok(
    ['http:', 'https:'].includes(parsedUrl.protocol),
    'Payment test URL must use HTTP or HTTPS.'
  );

  assert.equal(
    parsedUrl.username,
    '',
    'Do not include credentials in the payment test URL.'
  );

  assert.equal(
    parsedUrl.password,
    '',
    'Do not include credentials in the payment test URL.'
  );

  assert.ok(
    WEBHOOK_PATH.startsWith('/') && !WEBHOOK_PATH.startsWith('//'),
    'PAYMENT_WEBHOOK_TEST_PATH must be a local absolute path.'
  );

  assert.ok(
    !/[\r\n]/.test(WEBHOOK_PATH),
    'Webhook path must not contain newline characters.'
  );

  assert.ok(
    PAYMENT_PATH.startsWith('/') && !PAYMENT_PATH.startsWith('//'),
    'PAYMENT_TEST_PATH must be a local absolute path.'
  );

  assert.ok(
    PAYMENT_PATH.includes(':paymentId'),
    'PAYMENT_TEST_PATH must contain the :paymentId placeholder.'
  );

  assert.ok(
    !/[\r\n]/.test(PAYMENT_PATH),
    'Payment path must not contain newline characters.'
  );

  assert.ok(
    /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(EVENT_ID_HEADER),
    'PAYMENT_EVENT_ID_HEADER must be a valid HTTP header name.'
  );

  assert.ok(
    /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(SIGNATURE_HEADER),
    'PAYMENT_WEBHOOK_SIGNATURE_HEADER must be a valid HTTP header name.'
  );

  assert.ok(
    EVENT_ID_FIELD.trim().length > 0,
    'PAYMENT_EVENT_ID_FIELD must not be empty.'
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
    Number.isSafeInteger(EVENT_AMOUNT_MINOR) &&
      EVENT_AMOUNT_MINOR > 0,
    'TEST_PAYMENT_AMOUNT_MINOR must be a positive integer.'
  );

  assert.ok(
    Number.isSafeInteger(REQUEST_TIMEOUT_MS) &&
      REQUEST_TIMEOUT_MS > 0,
    'PAYMENT_TEST_TIMEOUT_MS must be a positive integer.'
  );

  if (!MUTATION_ENABLED) {
    return;
  }

  assert.equal(
    process.env.NODE_ENV,
    'test',
    'Mutating payment tests require NODE_ENV=test.'
  );

  const isLoopback =
    ['localhost', '127.0.0.1', '::1', '[::1]'].includes(
      parsedUrl.hostname.toLowerCase()
    );

  if (!isLoopback) {
    assert.ok(
      ALLOW_REMOTE_SANDBOX &&
        PAYMENT_TEST_ENVIRONMENT.toLowerCase() === 'sandbox',
      'Remote mutation tests require PAYMENT_TEST_ALLOW_REMOTE_SANDBOX=true and PAYMENT_TEST_ENVIRONMENT=sandbox.'
    );

    assert.equal(
      parsedUrl.protocol,
      'https:',
      'Remote payment sandbox tests must use HTTPS.'
    );
  }

  assert.ok(
    PAYMENT_ID,
    'TEST_PAYMENT_ID must identify a dedicated sandbox payment.'
  );

  assert.ok(
    TEST_TOKEN,
    'PAYMENT_TEST_TOKEN is required to inspect payment state.'
  );

  if (WEBHOOK_AUTH_MODE === 'hmac-sha256') {
    assert.ok(
      WEBHOOK_SECRET,
      'PAYMENT_WEBHOOK_TEST_SECRET is required for HMAC-signed webhook tests.'
    );
  }

  if (WEBHOOK_AUTH_MODE === 'bearer') {
    assert.ok(
      TEST_TOKEN,
      'PAYMENT_TEST_TOKEN is required for bearer-authenticated webhook tests.'
    );
  }
}

function newEventId(prefix = 'evt_test') {
  return `${prefix}_${crypto.randomUUID()}`;
}

function makeEvent({
  id,
  paymentId = PAYMENT_ID,
  amount = EVENT_AMOUNT_MINOR,
  type = EVENT_TYPE,
  currency = CURRENCY,
} = {}) {
  return {
    [EVENT_ID_FIELD]: id || newEventId(),
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

function signatureFor(rawBody) {
  const hmac = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest(SIGNATURE_FORMAT === 'base64' ? 'base64' : 'hex');

  return SIGNATURE_FORMAT === 'sha256='
    ? `sha256=${hmac}`
    : hmac;
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
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
    clearTimeout(timeout);
  }
}

async function postWebhook(event, options = {}) {
  const rawBody =
    typeof options.rawBody === 'string'
      ? options.rawBody
      : JSON.stringify(event);

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const headerEventId =
    options.headerEventId ??
    event?.[EVENT_ID_FIELD];

  if (headerEventId !== undefined && headerEventId !== null) {
    headers[EVENT_ID_HEADER] = String(headerEventId);
  }

  if (WEBHOOK_AUTH_MODE === 'bearer') {
    headers.Authorization = `Bearer ${TEST_TOKEN}`;
  } else if (WEBHOOK_AUTH_MODE === 'hmac-sha256') {
    headers[SIGNATURE_HEADER] = signatureFor(rawBody);
  }

  if (options.signature !== undefined) {
    headers[SIGNATURE_HEADER] = options.signature;
  }

  if (options.omitEventIdHeader) {
    delete headers[EVENT_ID_HEADER];
  }

  if (options.extraHeaders) {
    Object.assign(headers, options.extraHeaders);
  }

  return requestJson(`${BASE_URL}${WEBHOOK_PATH}`, {
    method: 'POST',
    headers,
    body: rawBody,
  });
}

async function getPayment() {
  assert.ok(PAYMENT_ID, 'TEST_PAYMENT_ID is required.');
  assert.ok(TEST_TOKEN, 'PAYMENT_TEST_TOKEN is required.');

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

function isSuccessfulWebhook(response) {
  return [200, 201, 202, 204].includes(response.status);
}

function assertNoServerError(response, label) {
  assert.ok(
    response.status < 500,
    `${label} returned HTTP ${response.status}: ${JSON.stringify(response.body)}`
  );
}

function extractPayment(response) {
  const body = response?.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  return (
    body.payment ||
    body.data?.payment ||
    body.data ||
    body
  );
}

function extractEventId(response) {
  const body = response?.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  return (
    body.eventId ||
    body.data?.eventId ||
    body.event?.id ||
    null
  );
}

/**
 * Select only stable, business-relevant fields for comparison.
 * Extend this list to match the actual payment model.
 * Volatile fields such as updatedAt are deliberately excluded.
 */
function paymentSnapshot(payment) {
  assert.ok(
    payment && typeof payment === 'object',
    'Payment response did not contain a payment object.'
  );

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
    'refundableAmount',
    'refundableAmountMinor',
  ];

  const snapshot = {};

  for (const field of fields) {
    if (payment[field] !== undefined) {
      snapshot[field] = payment[field];
    }
  }

  return snapshot;
}

function assertPaymentAmountsValid(payment) {
  for (const field of [
    'amount',
    'amountMinor',
    'originalAmount',
    'originalAmountMinor',
    'refundedAmount',
    'refundedAmountMinor',
    'amountRefunded',
    'refundableAmount',
    'refundableAmountMinor',
  ]) {
    if (payment[field] === undefined || payment[field] === null) {
      continue;
    }

    assert.ok(
      Number.isSafeInteger(payment[field]) && payment[field] >= 0,
      `Payment field "${field}" must be a non-negative integer in minor currency units.`
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

async function requirePaymentSnapshot(label) {
  const response = await getPayment();

  assert.equal(
    response.status,
    200,
    `${label}: payment lookup returned HTTP ${response.status}: ${JSON.stringify(response.body)}`
  );

  const payment = extractPayment(response);

  assert.ok(
    payment && typeof payment === 'object',
    `${label}: payment endpoint did not return a recognizable payment object.`
  );

  assertPaymentAmountsValid(payment);

  return paymentSnapshot(payment);
}

describe('Duplicate payment event integration tests', () => {
  before(() => {
    validateBaseConfiguration();
  });

  describe('configuration and baseline', () => {
    it('keeps mutating tests disabled unless explicitly opted in', () => {
      if (ENABLE_MUTATING_TESTS) {
        assert.equal(
          process.env.NODE_ENV,
          'test',
          'Mutating tests must run with NODE_ENV=test.'
        );
      } else {
        assert.equal(
          ENABLE_MUTATING_TESTS,
          false,
          'Mutation tests should remain disabled by default.'
        );
      }
    });

    it(
      'retrieves the configured test payment',
      {
        skip:
          !PAYMENT_ID ||
          !TEST_TOKEN,
      },
      async () => {
        const response = await getPayment();

        assert.equal(
          response.status,
          200,
          `Payment lookup failed with HTTP ${response.status}. Verify PAYMENT_TEST_PATH, TEST_PAYMENT_ID, and PAYMENT_TEST_TOKEN.`
        );

        assert.ok(
          extractPayment(response),
          'Payment endpoint did not return a recognizable payment object.'
        );
      }
    );
  });

  describe('duplicate event delivery', () => {
    it(
      'does not apply the same payment event twice',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        const eventId = newEventId('evt_duplicate');
        const event = makeEvent({ id: eventId });

        const first = await postWebhook(event);

        assertNoServerError(first, 'First webhook delivery');

        assert.ok(
          isSuccessfulWebhook(first),
          `First webhook delivery was not accepted: HTTP ${first.status}`
        );

        const afterFirst = await requirePaymentSnapshot(
          'Payment after first delivery'
        );

        const second = await postWebhook(event);

        assertNoServerError(second, 'Duplicate webhook delivery');

        assert.ok(
          isSuccessfulWebhook(second) || second.status === 409,
          `Duplicate event was neither acknowledged nor explicitly rejected: HTTP ${second.status}`
        );

        const afterSecond = await requirePaymentSnapshot(
          'Payment after duplicate delivery'
        );

        assert.deepEqual(
          afterSecond,
          afterFirst,
          'Payment business state changed after the same event was delivered twice.'
        );

        const firstEventId = extractEventId(first);
        const secondEventId = extractEventId(second);

        if (firstEventId && secondEventId) {
          assert.equal(
            secondEventId,
            firstEventId,
            'Duplicate deliveries returned different event identities.'
          );
        }
      }
    );

    it(
      'handles simultaneous deliveries of the same event idempotently',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        const event = makeEvent({
          id: newEventId('evt_concurrent'),
        });

        const responses = await Promise.all(
          Array.from(
            { length: 8 },
            () => postWebhook(event)
          )
        );

        for (const response of responses) {
          assertNoServerError(
            response,
            'Concurrent webhook delivery'
          );

          assert.ok(
            isSuccessfulWebhook(response) ||
              response.status === 409,
            `Unexpected concurrent-delivery response: HTTP ${response.status}`
          );
        }

        assert.ok(
          responses.some(isSuccessfulWebhook),
          'At least one concurrent delivery should be acknowledged.'
        );

        const acceptedEventIds = responses
          .map(extractEventId)
          .filter(Boolean);

        if (acceptedEventIds.length > 1) {
          assert.equal(
            new Set(acceptedEventIds).size,
            1,
            'Concurrent deliveries produced inconsistent event identities.'
          );
        }

        const payment = await requirePaymentSnapshot(
          'Payment after concurrent delivery'
        );

        assert.ok(
          Object.keys(payment).length > 0,
          'Payment endpoint did not expose any comparable business fields.'
        );
      }
    );
  });

  describe('event identity and payload integrity', () => {
    it(
      'rejects a missing event identifier',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        const event = makeEvent();
        delete event[EVENT_ID_FIELD];

        const response = await postWebhook(event, {
          omitEventIdHeader: true,
        });

        assertNoServerError(response, 'Missing event identifier');

        assert.ok(
          [400, 401, 403, 422].includes(response.status),
          `Expected missing event ID to be rejected, got HTTP ${response.status}`
        );
      }
    );

    it(
      'does not process a conflicting payload as a new event under an existing event ID',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        const eventId = newEventId('evt_conflict');

        const original = makeEvent({
          id: eventId,
          amount: EVENT_AMOUNT_MINOR,
        });

        const conflicting = makeEvent({
          id: eventId,
          amount: EVENT_AMOUNT_MINOR + 1,
        });

        const first = await postWebhook(original);

        assertNoServerError(first, 'Original event delivery');

        assert.ok(
          isSuccessfulWebhook(first),
          `Original event was not accepted: HTTP ${first.status}`
        );

        const afterOriginal = await requirePaymentSnapshot(
          'Payment after original event'
        );

        const second = await postWebhook(conflicting);

        assertNoServerError(second, 'Conflicting duplicate event');

        assert.ok(
          [400, 409, 422].includes(second.status),
          `Expected conflicting payload with reused event ID to be rejected, got HTTP ${second.status}. If the API intentionally acknowledges duplicates with 2xx, verify the persisted event payload hash and processing record independently.`
        );

        const afterConflict = await requirePaymentSnapshot(
          'Payment after conflicting event'
        );

        assert.deepEqual(
          afterConflict,
          afterOriginal,
          'Payment business state changed after a conflicting payload reused an existing event ID.'
        );
      }
    );
  });

  describe('webhook authenticity', () => {
    it(
      'rejects an invalid webhook signature',
      {
        skip:
          !ENABLE_MUTATING_TESTS ||
          WEBHOOK_AUTH_MODE !== 'hmac-sha256',
      },
      async () => {
        const event = makeEvent({
          id: newEventId('evt_bad_signature'),
        });

        const response = await postWebhook(event, {
          signature: 'invalid-signature',
        });

        assertNoServerError(
          response,
          'Invalid webhook signature'
        );

        assert.ok(
          [400, 401, 403, 422].includes(response.status),
          `Expected invalid signature rejection, got HTTP ${response.status}`
        );
      }
    );
  });

  describe('payment state consistency', () => {
    it(
      'keeps payment amounts valid after event delivery',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        const response = await getPayment();

        assert.equal(
          response.status,
          200,
          `Payment lookup failed: HTTP ${response.status}`
        );

        const payment = extractPayment(response);

        assert.ok(
          payment && typeof payment === 'object',
          'Payment response is not a recognizable object.'
        );

        assertPaymentAmountsValid(payment);
      }
    );
  });
});
