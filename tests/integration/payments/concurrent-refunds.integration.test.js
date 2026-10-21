
'use strict';

/**
 * MedOrbits -- Concurrent Refund Integration Tests
 *
 * File: tests/integration/payments/concurrent-refunds.integration.test.js
 * Runtime: Node.js >= 20
 *
 * IMPORTANT:
 * - Use only a dedicated provider sandbox and isolated test database.
 * - Use a disposable payment fixture with a known refundable balance.
 * - Configure response fields to match the actual payment API.
 * - Mutation tests are skipped unless explicitly enabled.
 * - Never execute these tests against production.
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

const TEST_TOKEN =
  process.env.PAYMENT_TEST_TOKEN || '';

const PAYMENT_ID =
  process.env.TEST_PAYMENT_ID || '';

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
const REJECTION_STATUSES = [
  400, 401, 403, 404, 409, 413, 415, 422, 429,
];

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
    Number.isFinite(REQUEST_TIMEOUT_MS) &&
      Number.isInteger(REQUEST_TIMEOUT_MS) &&
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
  }

  assert.ok(
    PAYMENT_PATH.includes(':paymentId'),
    'PAYMENT_TEST_PATH must contain :paymentId.'
  );

  assert.ok(
    REFUND_PATH.includes(':paymentId'),
    'REFUND_TEST_PATH must contain :paymentId.'
  );

  if (ENABLE_MUTATING_TESTS) {
    assert.equal(
      process.env.NODE_ENV,
      'test',
      'Mutating payment tests require NODE_ENV=test.'
    );

    assert.ok(
      PAYMENT_ID && TEST_TOKEN,
      'Mutating tests require TEST_PAYMENT_ID and PAYMENT_TEST_TOKEN.'
    );

    const isLoopback = [
      'localhost',
      '127.0.0.1',
      '::1',
    ].includes(base.hostname.toLowerCase());

    assert.ok(
      isLoopback ||
        (
          ALLOW_REMOTE_SANDBOX &&
          PAYMENT_TEST_ENVIRONMENT === 'sandbox'
        ),
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
    paymentId && String(paymentId).length > 0,
    'A payment ID is required.'
  );

  return PAYMENT_PATH.replace(
    ':paymentId',
    encodeURIComponent(String(paymentId))
  );
}

function refundUrl(paymentId = PAYMENT_ID) {
  assert.ok(
    paymentId && String(paymentId).length > 0,
    'A payment ID is required.'
  );

  return REFUND_PATH.replace(
    ':paymentId',
    encodeURIComponent(String(paymentId))
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
  return REJECTION_STATUSES.includes(status);
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

  return (
    refund.refundId ??
    refund.id ??
    refund._id ??
    null
  );
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
 * Returns the persisted original, refunded, and refundable amounts.
 *
 * Configure these field mappings to match the real API response.
 * If the API does not expose these values, verify them using the
 * repository or database in a dedicated integration-test fixture.
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
    `${label}: response must expose the original amount as an integer in minor units.`
  );

  assert.ok(
    refunded !== null && refunded >= 0,
    `${label}: response must expose the cumulative refunded amount as an integer in minor units.`
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
      `${label}: original amount minus cumulative refunds must equal the refundable balance.`
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
    'Set RUN_MUTATING_PAYMENT_TESTS=true only in an isolated payment sandbox.'
  );
}

describe('MedOrbits concurrent refund integration tests', () => {
  before(() => {
    validateConfiguration();
  });

  describe('fixture and environment safety', () => {
    it('requires explicit mutation opt-in for refund operations', (t) => {
      if (!ENABLE_MUTATING_TESTS) {
        t.skip(
          'Mutation tests are disabled. Set RUN_MUTATING_PAYMENT_TESTS=true only in an isolated test environment.'
        );
        return;
      }

      requireMutationOptIn();
    });

    it('can retrieve and verify the configured payment fixture', async (t) => {
      if (!PAYMENT_ID || !TEST_TOKEN) {
        t.skip(
          'Set TEST_PAYMENT_ID and PAYMENT_TEST_TOKEN.'
        );
        return;
      }

      const balances = await getVerifiedBalances(
        'Initial payment fixture verification'
      );

      assert.equal(
        balances.original,
        ORIGINAL_AMOUNT_MINOR,
        'Configured original amount does not match the persisted payment.'
      );

      assert.equal(
        balances.original - balances.refunded,
        REFUNDABLE_AMOUNT_MINOR,
        'Configured refundable balance does not match the persisted payment.'
      );
    });
  });

  describe('concurrent refund requests', () => {
    it(
      'does not create duplicate refunds for concurrent requests using the same idempotency key',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const beforeBalances = await getVerifiedBalances(
          'Before duplicate-refund test'
        );

        const amount = Math.min(
          100,
          beforeBalances.original - beforeBalances.refunded
        );

        assert.ok(
          amount > 0,
          'The disposable test payment must have a refundable balance.'
        );

        const key = newIdempotencyKey('concurrent-duplicate');
        const count = 5;

        const responses = await Promise.all(
          Array.from({ length: count }, () =>
            createRefund({
              amountMinor: amount,
              idempotencyKey: key,
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
          accepted.length >= 1,
          `At least one request should be accepted or queued. ` +
          `Statuses: ${responses.map((r) => r.status).join(', ')}`
        );

        const ids = accepted
          .map(extractRefundId)
          .filter(Boolean);

        if (ids.length > 1) {
          assert.equal(
            new Set(ids).size,
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
              'Accepted refund amount does not match the request.'
            );
          }
        }

        const afterBalances = await getVerifiedBalances(
          'After duplicate-refund test'
        );

        const refundedDelta =
          afterBalances.refunded - beforeBalances.refunded;

        assert.ok(
          refundedDelta >= 0,
          'Cumulative refunded amount unexpectedly decreased.'
        );

        assert.ok(
          refundedDelta <= amount,
          `Repeated requests using one idempotency key refunded ` +
          `${refundedDelta} minor units; expected at most ${amount}.`
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
          'Use a disposable test payment with at least two refundable minor units.'
        );

        // Each request individually asks for more than half the
        // available balance. All three must not be fully refunded.
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
        }

        for (const response of responses) {
          assert.ok(
            isAcceptedRefundStatus(response.status) ||
              isRejectedRefundStatus(response.status),
            `Unexpected refund response status: ${response.status}.`
          );
        }

        const afterBalances = await getVerifiedBalances(
          'After concurrent over-refund test'
        );

        const refundedDelta =
          afterBalances.refunded - beforeBalances.refunded;

        assert.ok(
          refundedDelta >= 0,
          'Cumulative refunded amount unexpectedly decreased.'
        );

        assert.ok(
          refundedDelta <= available,
          `Concurrent requests refunded ${refundedDelta} minor units, ` +
          `exceeding the available balance of ${available}.`
        );

        assert.ok(
          afterBalances.refunded <= afterBalances.original,
          'Concurrent refunds caused cumulative refunds to exceed the original payment.'
        );
      }
    );
  });

  describe('refund validation', () => {
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
      'rejects a refund exceeding the original payment amount',
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
            [IDEMPOTENCY_HEADER]:
              newIdempotencyKey('malformed-refund'),
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
          'The disposable test payment must have a refundable balance.'
        );

        const key = newIdempotencyKey('refund-retry');

        const [first, second] = await Promise.all([
          createRefund({
            amountMinor: amount,
            idempotencyKey: key,
          }),
          createRefund({
            amountMinor: amount,
            idempotencyKey: key,
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
          `Unexpected retry response: HTTP ${second.status}.`
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

        const refundedDelta =
          afterBalances.refunded - beforeBalances.refunded;

        assert.ok(
          refundedDelta >= 0 && refundedDelta <= amount,
          `Idempotent retry changed cumulative refunds by ` +
          `${refundedDelta} minor units; expected between zero and ${amount}.`
        );
      }
    );
  });

  describe('payment-state consistency', () => {
    it(
      'preserves the payment balance invariants after refund operations',
      { skip: !ENABLE_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const balances = await getVerifiedBalances(
          'Final payment-state verification'
        );

        assert.ok(
          balances.refunded <= balances.original,
          'Cumulative refunds must not exceed the original payment.'
        );

        if (balances.refundable !== null) {
          assert.equal(
            balances.original - balances.refunded,
            balances.refundable,
            'Persisted refundable balance is inconsistent with the original and refunded amounts.'
          );
        }
      }
    );
  });
});
