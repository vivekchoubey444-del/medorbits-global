
'use strict';

/**
 * MedOrbits -- Duplicate Payment Events Integration Tests
 *
 * File: tests/integration/payments/duplicate-events.integration.test.js
 * Runtime: Node.js >= 20
 *
 * Coverage:
 * - Test-environment configuration and payment lookup
 * - Duplicate webhook delivery
 * - Concurrent delivery of the same event
 * - Conflicting payloads reusing an event ID
 * - Missing event identifiers
 * - Invalid HMAC signatures
 * - Payment amount and state invariants
 *
 * Safety:
 * - Mutating tests are opt-in.
 * - Mutation requires NODE_ENV=test and a dedicated disposable payment.
 * - Remote mutations require explicit sandbox authorization and HTTPS.
 * - Never run against production or live payment-provider credentials.
 *
 * Adapt endpoint paths, event schema, authentication, response shapes,
 * and persisted-event assertions to the actual MedOrbits implementation.
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

const CURRENCY =
  process.env.TEST_PAYMENT_CURRENCY || 'INR';

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

const AUTH_MODES = new Set([
  'hmac-sha256',
  'bearer',
  'none',
]);

const SIGNATURE_FORMATS = new Set([
  'hex',
  'sha256=',
  'base64',
]);

const ACKNOWLEDGED_STATUSES = new Set([
  200,
  201,
  202,
  204,
]);

const INVALID_EVENT_STATUSES = new Set([
  400,
  401,
  403,
  422,
]);

const PAYMENT_SNAPSHOT_FIELDS = [
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

function isValidHeaderName(value) {
  return (
    typeof value === 'string' &&
    /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(value)
  );
}

function isValidPath(value) {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/[?#\r\n]/.test(value)
  );
}

function isLoopbackHostname(hostname) {
  return [
    'localhost',
    '127.0.0.1',
    '::1',
    '[::1]',
  ].includes(hostname.toLowerCase());
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
    'Payment test URL must use HTTP or HTTPS.'
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
    'PAYMENT_TEST_BASE_URL must not contain a URL fragment.'
  );

  assert.ok(
    isValidPath(WEBHOOK_PATH),
    'PAYMENT_WEBHOOK_TEST_PATH must be a valid absolute path.'
  );

  assert.ok(
    isValidPath(PAYMENT_PATH) &&
      PAYMENT_PATH.includes(':paymentId'),
    'PAYMENT_TEST_PATH must be an absolute path containing :paymentId.'
  );

  assert.ok(
    isValidHeaderName(EVENT_ID_HEADER),
    'PAYMENT_EVENT_ID_HEADER must be a valid HTTP header name.'
  );

  assert.ok(
    isValidHeaderName(SIGNATURE_HEADER),
    'PAYMENT_WEBHOOK_SIGNATURE_HEADER must be a valid HTTP header name.'
  );

  assert.notEqual(
    EVENT_ID_HEADER.toLowerCase(),
    SIGNATURE_HEADER.toLowerCase(),
    'Event ID and signature headers must be different.'
  );

  assert.ok(
    typeof EVENT_ID_FIELD === 'string' &&
      EVENT_ID_FIELD.trim().length > 0 &&
      !/[.[\]\r\n]/.test(EVENT_ID_FIELD),
    'PAYMENT_EVENT_ID_FIELD must be a non-empty top-level field name.'
  );

  assert.ok(
    SIGNATURE_FORMATS.has(SIGNATURE_FORMAT),
    'PAYMENT_WEBHOOK_SIGNATURE_FORMAT must be hex, sha256=, or base64.'
  );

  assert.ok(
    AUTH_MODES.has(WEBHOOK_AUTH_MODE),
    'PAYMENT_WEBHOOK_AUTH_MODE must be hmac-sha256, bearer, or none.'
  );

  assert.ok(
    Number.isSafeInteger(EVENT_AMOUNT_MINOR) &&
      EVENT_AMOUNT_MINOR > 0,
    'TEST_PAYMENT_AMOUNT_MINOR must be a positive safe integer.'
  );

  assert.ok(
    Number.isSafeInteger(REQUEST_TIMEOUT_MS) &&
      REQUEST_TIMEOUT_MS > 0,
    'PAYMENT_TEST_TIMEOUT_MS must be a positive safe integer.'
  );

  assert.ok(
    /^[A-Z]{3}$/.test(CURRENCY),
    'TEST_PAYMENT_CURRENCY must be a three-letter uppercase currency code.'
  );

  if (WEBHOOK_AUTH_MODE === 'hmac-sha256') {
    assert.ok(
      Buffer.byteLength(WEBHOOK_SECRET, 'utf8') >= 16,
      'PAYMENT_WEBHOOK_TEST_SECRET must contain at least 16 bytes.'
    );
  }

  if (WEBHOOK_AUTH_MODE === 'bearer') {
    assert.ok(
      TEST_TOKEN.length > 0,
      'PAYMENT_TEST_TOKEN is required for bearer authentication.'
    );
  }

  if (!ENABLE_MUTATING_TESTS) {
    return;
  }

  assert.equal(
    process.env.NODE_ENV,
    'test',
    'Mutating payment tests require NODE_ENV=test.'
  );

  assert.ok(
    PAYMENT_ID.trim().length > 0,
    'TEST_PAYMENT_ID must identify a dedicated disposable test payment.'
  );

  assert.ok(
    TEST_TOKEN.length > 0,
    'PAYMENT_TEST_TOKEN is required to inspect payment state.'
  );

  assert.ok(
    !/^(live|prod|production)[_-]/i.test(PAYMENT_ID),
    'A live or production-style payment ID is not permitted.'
  );

  const isLoopback = isLoopbackHostname(url.hostname);

  if (!isLoopback) {
    assert.ok(
      ALLOW_REMOTE_SANDBOX &&
        PAYMENT_TEST_ENVIRONMENT.toLowerCase() === 'sandbox',
      'Remote mutations require PAYMENT_TEST_ALLOW_REMOTE_SANDBOX=true and PAYMENT_TEST_ENVIRONMENT=sandbox.'
    );

    assert.equal(
      url.protocol,
      'https:',
      'Remote payment sandbox tests must use HTTPS.'
    );
  }

  assert.ok(
    !['production', 'prod', 'live'].includes(
      PAYMENT_TEST_ENVIRONMENT.toLowerCase()
    ),
    'Payment integration tests must never target production or live services.'
  );
}

function newEventId(prefix = 'evt_test') {
  return `${prefix}_${crypto.randomUUID()}`;
}

function createEvent({
  id = newEventId(),
  paymentId = PAYMENT_ID || 'pay_test_fixture',
  amount = EVENT_AMOUNT_MINOR,
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
    'Webhook signature generation requires the exact raw body.'
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
        `Request timed out after ${REQUEST_TIMEOUT_MS} ms: ${url}`,
        { cause: error }
      );
    }

    throw error;
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
    Accept: 'application/json',
    'Content-Type': options.contentType || 'application/json',
  };

  const eventId =
    options.headerEventId ??
    event?.[EVENT_ID_FIELD];

  if (
    !options.omitEventIdHeader &&
    eventId !== undefined &&
    eventId !== null &&
    String(eventId).length > 0
  ) {
    headers[EVENT_ID_HEADER] = String(eventId);
  }

  if (WEBHOOK_AUTH_MODE === 'bearer') {
    if (!options.omitSignature) {
      headers.Authorization = `Bearer ${TEST_TOKEN}`;
    }
  } else if (
    WEBHOOK_AUTH_MODE === 'hmac-sha256' &&
    !options.omitSignature
  ) {
    headers[SIGNATURE_HEADER] =
      options.signature ?? createSignature(rawBody);
  }

  if (options.extraHeaders) {
    Object.assign(headers, options.extraHeaders);
  }

  return request(`${BASE_URL}${WEBHOOK_PATH}`, {
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

  return request(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${TEST_TOKEN}`,
      Accept: 'application/json',
    },
  });
}

function isAcknowledged(response) {
  return ACKNOWLEDGED_STATUSES.has(response.status);
}

function assertNoServerError(response, label) {
  assert.ok(
    response.status < 500,
    `${label} returned HTTP ${response.status}: ${JSON.stringify(response.body)}`
  );
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

function extractEventId(response) {
  const body = response?.body;

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return null;
  }

  return (
    body.eventId ??
    body.data?.eventId ??
    body.event?.id ??
    null
  );
}

function paymentSnapshot(payment) {
  assert.ok(
    payment && typeof payment === 'object',
    'Payment response did not contain a payment object.'
  );

  const snapshot = {};

  for (const field of PAYMENT_SNAPSHOT_FIELDS) {
    if (payment[field] !== undefined) {
      snapshot[field] = payment[field];
    }
  }

  return snapshot;
}

function assertPaymentAmountsValid(payment) {
  const amountFields = [
    'amount',
    'amountMinor',
    'originalAmount',
    'originalAmountMinor',
    'refundedAmount',
    'refundedAmountMinor',
    'amountRefunded',
    'refundableAmount',
    'refundableAmountMinor',
  ];

  for (const field of amountFields) {
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

  if (payment.currency !== undefined) {
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
    `${label}: payment lookup returned HTTP ${response.status}: ${JSON.stringify(response.body)}`
  );

  const payment = extractPayment(response);

  assert.ok(
    payment,
    `${label}: payment endpoint did not return a recognizable payment object.`
  );

  assertPaymentAmountsValid(payment);

  const snapshot = paymentSnapshot(payment);

  assert.ok(
    Object.keys(snapshot).length > 0,
    `${label}: no stable payment fields were available for comparison.`
  );

  return snapshot;
}

function assertInvalidEventResponse(response, label) {
  assertNoServerError(response, label);

  assert.ok(
    INVALID_EVENT_STATUSES.has(response.status),
    `${label}: expected HTTP ${[...INVALID_EVENT_STATUSES].join(', ')}, received HTTP ${response.status}.`
  );
}

function assertAcceptedEvent(response, label) {
  assertNoServerError(response, label);

  assert.ok(
    isAcknowledged(response),
    `${label}: expected acknowledgement, received HTTP ${response.status}: ${JSON.stringify(response.body)}`
  );
}

describe('MedOrbits duplicate payment event integration tests', () => {
  before(() => {
    validateConfiguration();
  });

  describe('baseline configuration', () => {
    it('keeps mutation testing opt-in', () => {
      if (ENABLE_MUTATING_TESTS) {
        assert.equal(
          process.env.NODE_ENV,
          'test',
          'Mutating tests require NODE_ENV=test.'
        );
      } else {
        assert.equal(
          ENABLE_MUTATING_TESTS,
          false,
          'Mutating tests must remain disabled unless explicitly enabled.'
        );
      }
    });

    it(
      'can retrieve the configured test payment',
      {
        skip: !PAYMENT_ID || !TEST_TOKEN,
      },
      async () => {
        const response = await getPayment();

        assert.equal(
          response.status,
          200,
          `Payment lookup failed with HTTP ${response.status}. Check PAYMENT_TEST_PATH, TEST_PAYMENT_ID, and PAYMENT_TEST_TOKEN.`
        );

        const payment = extractPayment(response);

        assert.ok(
          payment,
          'Payment endpoint did not return a recognizable payment object.'
        );

        assertPaymentAmountsValid(payment);
      }
    );
  });

  describe('duplicate delivery and idempotency', () => {
    it(
      'does not apply the same event twice',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        const event = createEvent({
          id: newEventId('evt_duplicate'),
          paymentId: PAYMENT_ID,
        });

        const first = await postWebhook(event);

        assertAcceptedEvent(first, 'First event delivery');

        const afterFirst = await getPaymentSnapshot(
          'After first delivery'
        );

        const second = await postWebhook(event);

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
          'Duplicate delivery changed payment business state.'
        );

        const firstEventId = extractEventId(first);
        const secondEventId = extractEventId(second);

        if (firstEventId && secondEventId) {
          assert.equal(
            secondEventId,
            firstEventId,
            'Duplicate delivery responses returned inconsistent event identities.'
          );
        }
      }
    );

    it(
      'handles concurrent deliveries of the same event idempotently',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        const event = createEvent({
          id: newEventId('evt_concurrent'),
          paymentId: PAYMENT_ID,
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
            'Concurrent event delivery'
          );

          assert.ok(
            isAcknowledged(response) || response.status === 409,
            `Unexpected concurrent response: HTTP ${response.status}.`
          );
        }

        assert.ok(
          responses.some(isAcknowledged),
          'At least one concurrent delivery should be acknowledged.'
        );

        const eventIds = responses
          .map(extractEventId)
          .filter(Boolean);

        if (eventIds.length > 1) {
          assert.equal(
            new Set(eventIds).size,
            1,
            'Concurrent delivery responses returned inconsistent event identities.'
          );
        }

        const snapshot = await getPaymentSnapshot(
          'After concurrent delivery'
        );

        assert.ok(
          Object.keys(snapshot).length > 0,
          'No stable payment fields were available after concurrent delivery.'
        );

        /*
         * For definitive idempotency verification, query the persisted
         * webhook-event/processing record and assert this event ID was
         * applied exactly once. Payment snapshots alone cannot prove that.
         */
      }
    );
  });

  describe('event identity and payload integrity', () => {
    it(
      'rejects an event without an event identifier',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        const event = createEvent({
          id: newEventId('evt_missing_id'),
          paymentId: PAYMENT_ID,
        });

        delete event[EVENT_ID_FIELD];

        const response = await postWebhook(event, {
          omitEventIdHeader: true,
        });

        assertInvalidEventResponse(
          response,
          'Missing event identifier'
        );
      }
    );

    it(
      'rejects a conflicting payload that reuses an event identifier',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        const eventId = newEventId('evt_conflict');

        const original = createEvent({
          id: eventId,
          paymentId: PAYMENT_ID,
          amount: EVENT_AMOUNT_MINOR,
        });

        const conflicting = createEvent({
          id: eventId,
          paymentId: PAYMENT_ID,
          amount: EVENT_AMOUNT_MINOR + 1,
        });

        const first = await postWebhook(original);

        assertAcceptedEvent(first, 'Original event delivery');

        const afterOriginal = await getPaymentSnapshot(
          'After original event'
        );

        const second = await postWebhook(conflicting);

        assertNoServerError(
          second,
          'Conflicting duplicate event'
        );

        assert.ok(
          [400, 409, 422].includes(second.status),
          `Expected conflicting payload rejection, received HTTP ${second.status}. If the API acknowledges all duplicates, verify the stored payload hash and processing record separately.`
        );

        const afterConflict = await getPaymentSnapshot(
          'After conflicting event'
        );

        assert.deepEqual(
          afterConflict,
          afterOriginal,
          'Payment state changed after a conflicting payload reused an event ID.'
        );
      }
    );
  });

  describe('webhook authenticity', () => {
    it(
      'rejects an invalid HMAC signature',
      {
        skip:
          !ENABLE_MUTATING_TESTS ||
          WEBHOOK_AUTH_MODE !== 'hmac-sha256',
      },
      async () => {
        const event = createEvent({
          id: newEventId('evt_bad_signature'),
          paymentId: PAYMENT_ID,
        });

        const response = await postWebhook(event, {
          signature: 'invalid-signature',
        });

        assertInvalidEventResponse(
          response,
          'Invalid webhook signature'
        );
      }
    );

    it(
      'rejects a payload modified after signing',
      {
        skip:
          !ENABLE_MUTATING_TESTS ||
          WEBHOOK_AUTH_MODE !== 'hmac-sha256',
      },
      async () => {
        const event = createEvent({
          id: newEventId('evt_tampered'),
          paymentId: PAYMENT_ID,
        });

        const originalBody = JSON.stringify(event);
        const signature = createSignature(originalBody);

        const modifiedEvent = {
          ...event,
          data: {
            object: {
              ...event.data.object,
              amount: EVENT_AMOUNT_MINOR + 1,
            },
          },
        };

        const response = await postWebhook(modifiedEvent, {
          signature,
        });

        assertInvalidEventResponse(
          response,
          'Tampered webhook payload'
        );
      }
    );
  });

  describe('payment-state consistency', () => {
    it(
      'preserves valid payment amount invariants',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        const response = await getPayment();

        assert.equal(
          response.status,
          200,
          `Payment lookup failed with HTTP ${response.status}.`
        );

        const payment = extractPayment(response);

        assert.ok(
          payment,
          'Payment endpoint did not return a recognizable payment object.'
        );

        assertPaymentAmountsValid(payment);
      }
    );
  });
});
