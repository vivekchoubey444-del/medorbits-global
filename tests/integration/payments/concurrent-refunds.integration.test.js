
'use strict';

/**
 * MedOrbits -- Concurrent Refund Integration Tests
 *
 * File: tests/integration/payments/concurrent-refunds.integration.test.js
 * Runtime: Node.js >= 20
 *
 * Safety:
 * - Mutating tests are disabled unless explicitly enabled.
 * - Use a dedicated test database and payment-provider sandbox.
 * - Use a disposable payment with a known refundable balance.
 * - Never execute these tests against production.
 *
 * Required environment variables for mutation tests:
 *   NODE_ENV=test
 *   RUN_MUTATING_PAYMENT_TESTS=true
 *   TEST_PAYMENT_ID=<disposable-payment-id>
 *   PAYMENT_TEST_TOKEN=<test-only-token>
 *
 * Remote sandbox mutations additionally require:
 *   PAYMENT_TEST_ALLOW_REMOTE_SANDBOX=true
 *   PAYMENT_TEST_ENVIRONMENT=sandbox
 *
 * Important:
 * - The endpoint paths and response field mappings must match the
 *   actual MedOrbits payment API.
 * - Each mutating test should use a fresh payment or reset the fixture.
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const BASE_URL = (
  process.env.PAYMENT_TEST_BASE_URL ||
  process.env.TEST_BASE_URL ||
  'http://127.0.0.1:3000'
).replace(/\/+$/, '');

const REFUND_PATH =
  process.env.REFUND_TEST_PATH ||
  '/api/payments/:paymentId/refunds';

const PAYMENT_PATH =
  process.env.PAYMENT_TEST_PATH ||
  '/api/payments/:paymentId';

const TEST_TOKEN = process.env.PAYMENT_TEST_TOKEN || '';
const PAYMENT_ID = process.env.TEST_PAYMENT_ID || '';

const ORIGINAL_AMOUNT_MINOR = Number(
  process.env.TEST_PAYMENT_AMOUNT_MINOR || 10000
);

const REFUNDABLE_AMOUNT_MINOR = Number(
  process.env.TEST_REFUNDABLE_AMOUNT_MINOR ||
  ORIGINAL_AMOUNT_MINOR
);

const CURRENCY = (
  process.env.TEST_PAYMENT_CURRENCY || 'INR'
).toUpperCase();

const REQUEST_TIMEOUT_MS = Number(
  process.env.PAYMENT_TEST_TIMEOUT_MS || 15000
);

const ENABLE_MUTATING_TESTS =
  process.env.RUN_MUTATING_PAYMENT_TESTS === 'true';

const IDEMPOTENCY_HEADER =
  process.env.REFUND_IDEMPOTENCY_HEADER || 'Idempotency-Key';

const ALLOW_REMOTE_SANDBOX =
  process.env.PAYMENT_TEST_ALLOW_REMOTE_SANDBOX === 'true';

const PAYMENT_TEST_ENVIRONMENT =
  process.env.PAYMENT_TEST_ENVIRONMENT || '';

const SUCCESS_STATUSES = new Set([200, 201, 202]);

const REJECTION_STATUSES = new Set([
  400, 401, 403, 404, 409, 413, 415, 422, 429,
]);

const LOOPBACK_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
]);

function validateConfiguration() {
  let base;

  try {
    base = new URL(BASE_URL);
  } catch {
    assert.fail('PAYMENT_TEST_BASE_URL must be a valid URL.');
  }

  assert.ok(
    ['http:', 'https:'].includes(base.protocol),
    'Payment test URL must use HTTP or HTTPS.'
  );

  assert.ok(
    !base.username && !base.password,
    'Do not embed credentials in the payment test URL.'
  );

  assert.ok(
    Number.isSafeInteger(ORIGINAL_AMOUNT_MINOR) &&
      ORIGINAL_AMOUNT_MINOR > 0,
    'TEST_PAYMENT_AMOUNT_MINOR must be a positive integer in minor units.'
  );

  assert.ok(
    Number.isSafeInteger(REFUNDABLE_AMOUNT_MINOR) &&
      REFUNDABLE_AMOUNT_MINOR >= 0 &&
      REFUNDABLE_AMOUNT_MINOR <= ORIGINAL_AMOUNT_MINOR,
    'TEST_REFUNDABLE_AMOUNT_MINOR must be between zero and the original amount.'
  );

  assert.ok(
    Number.isSafeInteger(REQUEST_TIMEOUT_MS) &&
      REQUEST_TIMEOUT_MS > 0,
    'PAYMENT_TEST_TIMEOUT_MS must be a positive integer.'
  );

  assert.match(
    CURRENCY,
    /^[A-Z]{3}$/,
    'TEST_PAYMENT_CURRENCY must be a three-letter uppercase currency code.'
  );

  assert.match(
    IDEMPOTENCY_HEADER,
    /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/,
    'REFUND_IDEMPOTENCY_HEADER must be a valid HTTP header name.'
  );

  for (const [name, path] of Object.entries({
    REFUND_PATH,
    PAYMENT_PATH,
  })) {
    assert.ok(
      path.startsWith('/') && !path.startsWith('//'),
      `${name} must begin with exactly one slash.`
    );

    assert.ok(
      !/[\r\n]/.test(path),
      `${name} must not contain newline characters.`
    );

    assert.ok(
      path.includes(':paymentId'),
      `${name} must contain :paymentId.`
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
    PAYMENT_ID.trim() && TEST_TOKEN.trim(),
    'Mutating tests require TEST_PAYMENT_ID and PAYMENT_TEST_TOKEN.'
  );

  const isLoopback = LOOPBACK_HOSTS.has(
    base.hostname.toLowerCase()
  );

  if (!isLoopback) {
    assert.ok(
      base.protocol === 'https:',
      'Remote payment sandbox tests must use HTTPS.'
    );

    assert.ok(
      ALLOW_REMOTE_SANDBOX &&
        PAYMENT_TEST_ENVIRONMENT === 'sandbox',
      'Remote mutations require PAYMENT_TEST_ALLOW_REMOTE_SANDBOX=true and PAYMENT_TEST_ENVIRONMENT=sandbox.'
    );
  }
}

function urlFor(path) {
  const base = new URL(BASE_URL);
  const url = new URL(path, `${BASE_URL}/`);

  assert.equal(
    url.origin,
    base.origin,
    'Request must remain on the configured API origin.'
  );

  return url;
}

function paymentUrl(paymentId = PAYMENT_ID) {
  assert.ok(
    typeof paymentId === 'string' && paymentId.trim().length > 0,
    'A non-empty payment ID is required.'
  );

  return PAYMENT_PATH.replace(
    ':paymentId',
    encodeURIComponent(paymentId)
  );
}

function refundUrl(paymentId = PAYMENT_ID) {
  assert.ok(
    typeof paymentId === 'string' && paymentId.trim().length > 0,
    'A non-empty payment ID is required.'
  );

  return REFUND_PATH.replace(
    ':paymentId',
    encodeURIComponent(paymentId)
  );
}

function authHeaders(extra = {}) {
  return {
    Accept: 'application/json',
    ...(TEST_TOKEN
      ? { Authorization: `Bearer ${TEST_TOKEN}` }
      : {}),
    ...extra,
  };
}

async function request(path, options = {}) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(urlFor(path), {
      ...options,
      headers: authHeaders(options.headers || {}),
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
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${REQUEST_TIMEOUT_MS}ms: ` +
        `${options.method || 'GET'} ${path}`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function getPayment(paymentId = PAYMENT_ID) {
  return request(paymentUrl(paymentId), {
    method: 'GET',
  });
}

async function createRefund({
  amountMinor,
  idempotencyKey,
  paymentId = PAYMENT_ID,
}) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (idempotencyKey) {
    headers[IDEMPOTENCY_HEADER] = idempotencyKey;
  }

  return request(refundUrl(paymentId), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      amount: amountMinor,
      currency: CURRENCY,
      reason: 'MedOrbits automated refund integration test',
    }),
  });
}

function isAcceptedRefundStatus(status) {
  return SUCCESS_STATUSES.has(status);
}

function isRejectedRefundStatus(status) {
  return REJECTION_STATUSES.has(status);
}

function assertNoServerError(response, label) {
  assert.ok(
    response.status < 500,
    `${label}: HTTP ${response.status}; ` +
      `response=${JSON.stringify(response.body)}`
  );
}

function assertRefundRejected(response, label) {
  assertNoServerError(response, label);

  assert.ok(
    isRejectedRefundStatus(response.status),
    `${label}: expected a validation, authorization, or conflict response; ` +
      `received HTTP ${response.status}.`
  );
}

function newIdempotencyKey(prefix) {
  return `medorbits-${prefix}-${crypto.randomUUID()}`;
}

function isObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function extractPayment(response) {
  const body = response.body;

  if (!isObject(body)) {
    return null;
  }

  if (isObject(body.payment)) {
    return body.payment;
  }

  if (isObject(body.data?.payment)) {
    return body.data.payment;
  }

  if (isObject(body.data)) {
    return body.data;
  }

  return body;
}

function extractRefund(response) {
  const body = response.body;

  if (!isObject(body)) {
    return null;
  }

  if (isObject(body.refund)) {
    return body.refund;
  }

  if (isObject(body.data?.refund)) {
    return body.data.refund;
  }

  if (isObject(body.data)) {
    return body.data;
  }

  return body;
}

function extractRefundId(response) {
  const refund = extractRefund(response);

  if (!refund) {
    return null;
  }

  return refund.refundId ?? refund.id ?? refund._id ?? null;
}

function extractRefundAmount(response) {
  const refund = extractRefund(response);

  if (!refund) {
    return null;
  }

  const amount = refund.amountMinor ?? refund.amount;

  return Number.isSafeInteger(amount) ? amount : null;
}

/**
 * Extract persisted balances from the API response.
 *
 * Adapt the field mappings to the actual payment model. If the API
 * does not expose these fields, use a test-only repository/database
 * assertion instead of inferring persisted state from the HTTP response.
 */
function extractPaymentBalances(response) {
  const payment = extractPayment(response);

  if (!payment) {
    return null;
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

  const refundable =
    payment.refundableAmountMinor ??
    payment.refundableAmount ??
    payment.amountRemaining;

  return {
    payment,
    original: Number.isSafeInteger(original) ? original : null,
    refunded: Number.isSafeInteger(refunded) ? refunded : null,
    refundable: Number.isSafeInteger(refundable) ? refundable : null,
  };
}

function assertPaymentBalanceInvariants(balances, label) {
  assert.ok(
    balances,
    `${label}: payment response must contain a payment object.`
  );

  const { original, refunded, refundable } = balances;

  assert.ok(
    original !== null && original >= 0,
    `${label}: original amount must be exposed as an integer in minor units.`
  );

  assert.ok(
    refunded !== null && refunded >= 0,
    `${label}: cumulative refunded amount must be exposed as an integer in minor units.`
  );

  assert.ok(
    refunded <= original,
    `${label}: cumulative refunds exceed the original payment amount.`
  );

  if (refundable !== null) {
    assert.ok(
      refundable >= 0,
      `${label}: refundable balance must not be negative.`
    );

    assert.equal(
      original - refunded,
      refundable,
      `${label}: original minus refunded must equal refundable balance.`
    );
  }

  return balances;
}

async function getVerifiedBalances(label) {
  const response = await getPayment();

  assertNoServerError(response, label);

  assert.equal(
    response.status,
    200,
    `${label}: expected HTTP 200; received ${response.status}.`
  );

  return assertPaymentBalanceInvariants(
    extractPaymentBalances(response),
    label
  );
}

function requireMutationOptIn() {
  assert.equal(
    ENABLE_MUTATING_TESTS,
    true,
    'Set RUN_MUTATING_PAYMENT_TESTS=true only in an isolated payment test environment.'
  );

  assert.equal(
    process.env.NODE_ENV,
    'test',
    'Mutating payment tests require NODE_ENV=test.'
  );
}

function assertRefundDelta(before, after, maximum, label) {
  const delta = after.refunded - before.refunded;

  assert.ok(
    delta >= 0,
    `${label}: cumulative refunded amount unexpectedly decreased.`
  );

  assert.ok(
    delta <= maximum,
    `${label}: refunded ${delta} minor units; maximum allowed is ${maximum}.`
  );

  assert.ok(
    after.refunded <= after.original,
    `${label}: cumulative refunds exceed the original payment.`
  );

  return delta;
}

describe('MedOrbits concurrent refund integration tests', () => {
  before(() => {
    validateConfiguration();
  });

  describe('environment and payment fixture', () => {
    it('skips mutation tests unless explicitly enabled', (t) => {
      if (!ENABLE_MUTATING_TESTS) {
        t.skip(
          'Refund mutations are disabled. Enable them only for an isolated test payment.'
        );
        return;
      }

      requireMutationOptIn();
    });

    it('retrieves the configured payment and validates its initial balance', async (t) => {
      if (!PAYMENT_ID || !TEST_TOKEN) {
        t.skip('Set TEST_PAYMENT_ID and PAYMENT_TEST_TOKEN.');
        return;
      }

      const balances = await getVerifiedBalances(
        'Initial payment fixture verification'
      );

      assert.equal(
        balances.original,
        ORIGINAL_AMOUNT_MINOR,
        'Configured original amount differs from the persisted payment.'
      );

      assert.equal(
        balances.original - balances.refunded,
        REFUNDABLE_AMOUNT_MINOR,
        'Configured refundable balance differs from the persisted payment.'
      );
    });
  });

  describe('concurrent idempotency', () => {
    it(
      'does not create duplicate refunds for concurrent requests sharing one idempotency key',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const beforeBalances = await getVerifiedBalances(
          'Before concurrent idempotency test'
        );

        const available =
          beforeBalances.original - beforeBalances.refunded;

        const amount = Math.min(100, available);

        assert.ok(
          amount > 0,
          'The disposable payment must have a positive refundable balance.'
        );

        const idempotencyKey = newIdempotencyKey(
          'concurrent-duplicate'
        );

        const responses = await Promise.all(
          Array.from({ length: 5 }, () =>
            createRefund({
              amountMinor: amount,
              idempotencyKey,
            })
          )
        );

        for (const response of responses) {
          assertNoServerError(
            response,
            'Concurrent idempotent refund'
          );
        }

        const accepted = responses.filter((response) =>
          isAcceptedRefundStatus(response.status)
        );

        assert.ok(
          accepted.length > 0,
          `At least one request should be accepted or queued. ` +
            `Statuses: ${responses.map((r) => r.status).join(', ')}`
        );

        const refundIds = accepted
          .map(extractRefundId)
          .filter(Boolean);

        if (refundIds.length > 1) {
          assert.equal(
            new Set(refundIds).size,
            1,
            'The same idempotency key returned different refund IDs.'
          );
        }

        for (const response of accepted) {
          const returnedAmount = extractRefundAmount(response);

          if (returnedAmount !== null) {
            assert.equal(
              returnedAmount,
              amount,
              'Accepted refund amount differs from the request.'
            );
          }
        }

        const afterBalances = await getVerifiedBalances(
          'After concurrent idempotency test'
        );

        assertRefundDelta(
          beforeBalances,
          afterBalances,
          amount,
          'Concurrent idempotent refund'
        );
      }
    );

    it(
      'prevents concurrent unique refunds from exceeding the available balance',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const beforeBalances = await getVerifiedBalances(
          'Before concurrent over-refund test'
        );

        const available =
          beforeBalances.original - beforeBalances.refunded;

        assert.ok(
          available >= 2,
          'Use a disposable payment with at least two refundable minor units.'
        );

        const amount = Math.floor(available / 2) + 1;

        const responses = await Promise.all(
          Array.from({ length: 3 }, (_, index) =>
            createRefund({
              amountMinor: amount,
              idempotencyKey: newIdempotencyKey(
                `concurrent-over-refund-${index}`
              ),
            })
          )
        );

        for (const response of responses) {
          assertNoServerError(
            response,
            'Concurrent unique refund'
          );

          assert.ok(
            isAcceptedRefundStatus(response.status) ||
              isRejectedRefundStatus(response.status),
            `Unexpected HTTP status ${response.status}.`
          );
        }

        const afterBalances = await getVerifiedBalances(
          'After concurrent over-refund test'
        );

        assertRefundDelta(
          beforeBalances,
          afterBalances,
          available,
          'Concurrent unique refund'
        );
      }
    );
  });

  describe('refund input validation', () => {
    it(
      'rejects zero-value refunds',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const response = await createRefund({
          amountMinor: 0,
          idempotencyKey: newIdempotencyKey('zero-refund'),
        });

        assertRefundRejected(response, 'Zero-value refund');
      }
    );

    it(
      'rejects negative refund amounts',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const response = await createRefund({
          amountMinor: -1,
          idempotencyKey: newIdempotencyKey('negative-refund'),
        });

        assertRefundRejected(response, 'Negative refund');
      }
    );

    it(
      'rejects refunds exceeding the original payment amount',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const response = await createRefund({
          amountMinor: ORIGINAL_AMOUNT_MINOR + 1,
          idempotencyKey: newIdempotencyKey('excess-refund'),
        });

        assertRefundRejected(
          response,
          'Refund exceeding original payment'
        );
      }
    );

    it(
      'rejects malformed refund amounts',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const response = await request(refundUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [IDEMPOTENCY_HEADER]: newIdempotencyKey(
              'malformed-refund'
            ),
          },
          body: JSON.stringify({
            amount: 'not-a-number',
            currency: CURRENCY,
            reason: 'Malformed refund integration test',
          }),
        });

        assertRefundRejected(
          response,
          'Malformed refund amount'
        );
      }
    );
  });

  describe('idempotent retries', () => {
    it(
      'returns a consistent result for repeated requests using the same key',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const beforeBalances = await getVerifiedBalances(
          'Before idempotent retry test'
        );

        const available =
          beforeBalances.original - beforeBalances.refunded;

        const amount = Math.min(100, available);

        assert.ok(
          amount > 0,
          'The disposable payment must have a positive refundable balance.'
        );

        const idempotencyKey = newIdempotencyKey('refund-retry');

        const [first, second] = await Promise.all([
          createRefund({
            amountMinor: amount,
            idempotencyKey,
          }),
          createRefund({
            amountMinor: amount,
            idempotencyKey,
          }),
        ]);

        assertNoServerError(first, 'Initial refund request');
        assertNoServerError(second, 'Repeated refund request');

        assert.ok(
          isAcceptedRefundStatus(first.status),
          `Initial refund was not accepted: HTTP ${first.status}.`
        );

        assert.ok(
          isAcceptedRefundStatus(second.status) ||
            second.status === 409,
          `Unexpected retry status: HTTP ${second.status}.`
        );

        const firstId = extractRefundId(first);
        const secondId = extractRefundId(second);

        if (
          isAcceptedRefundStatus(second.status) &&
          firstId &&
          secondId
        ) {
          assert.equal(
            secondId,
            firstId,
            'Idempotent retry returned a different refund ID.'
          );
        }

        const afterBalances = await getVerifiedBalances(
          'After idempotent retry test'
        );

        assertRefundDelta(
          beforeBalances,
          afterBalances,
          amount,
          'Idempotent retry'
        );
      }
    );
  });

  describe('payment-state invariants', () => {
    it(
      'preserves payment balance invariants after refund operations',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const balances = await getVerifiedBalances(
          'Payment-state invariant verification'
        );

        assert.ok(
          balances.refunded <= balances.original,
          'Cumulative refunds must not exceed the original payment amount.'
        );

        if (balances.refundable !== null) {
          assert.equal(
            balances.original - balances.refunded,
            balances.refundable,
            'Refundable balance is inconsistent with original and refunded amounts.'
          );
        }
      }
    );
  });
});
