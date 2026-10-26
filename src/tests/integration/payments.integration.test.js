
'use strict';

/**
 * MedOrbits -- Payment Integration Tests
 *
 * File: tests/integration/payments.integration.test.js
 * Runtime: Node.js >= 20
 * Runner: node:test
 *
 * Coverage:
 * - Configuration and endpoint availability
 * - Authentication and authorization
 * - Payment creation and validation
 * - Payment amount and currency integrity
 * - Payment ownership isolation
 * - Refund validation using a dedicated disposable fixture
 * - Client-supplied payment status / privilege protection
 * - Recursive sensitive-field disclosure checks
 *
 * SAFETY:
 * - Mutation tests are disabled by default.
 * - Mutations require NODE_ENV=test.
 * - Remote mutations require explicit opt-in, HTTPS, and sandbox designation.
 * - CI mutations require a separate explicit opt-in.
 * - Refund tests require a separate disposable refund fixture and explicit opt-in.
 *
 * Adapt paths, payloads, status expectations, and response envelopes to
 * the actual MedOrbits API contract.
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const RAW_BASE_URL =
  process.env.PAYMENT_TEST_BASE_URL ||
  process.env.TEST_BASE_URL ||
  'http://127.0.0.1:3000';

const PAYMENTS_PATH =
  process.env.PAYMENTS_TEST_PATH ||
  '/api/payments';

const PAYMENT_PATH =
  process.env.PAYMENT_TEST_PATH ||
  '/api/payments/:id';

const REFUNDS_PATH =
  process.env.PAYMENT_REFUNDS_TEST_PATH ||
  '/api/payments/:id/refunds';

const USER_A_TOKEN =
  process.env.PAYMENT_TEST_USER_A_TOKEN ||
  process.env.PAYMENT_TEST_TOKEN ||
  '';

const USER_B_TOKEN =
  process.env.PAYMENT_TEST_USER_B_TOKEN || '';

const PAYMENT_ID =
  process.env.TEST_PAYMENT_ID || '';

/**
 * Refunds must use a separate disposable payment fixture.
 * Never silently reuse TEST_PAYMENT_ID for refund operations.
 */
const REFUND_PAYMENT_ID =
  process.env.PAYMENT_TEST_REFUND_PAYMENT_ID || '';

const AMOUNT_MINOR = Number(
  process.env.TEST_PAYMENT_AMOUNT_MINOR || 10000
);

const CURRENCY = (
  process.env.TEST_PAYMENT_CURRENCY || 'INR'
).toUpperCase();

const TIMEOUT_MS = Number(
  process.env.PAYMENT_TEST_TIMEOUT_MS || 15000
);

const RUN_MUTATING_TESTS =
  process.env.RUN_MUTATING_PAYMENT_TESTS === 'true';

const ALLOW_REMOTE_MUTATIONS =
  process.env.PAYMENT_TEST_ALLOW_REMOTE_MUTATIONS === 'true';

const ALLOW_CI_MUTATIONS =
  process.env.PAYMENT_TEST_CI_MUTATIONS === 'true';

const RUN_REFUND_TESTS =
  process.env.RUN_PAYMENT_REFUND_TESTS === 'true';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'hashedpassword',
  'clientsecret',
  'clientsecretkey',
  'secretaccesskey',
  'privatekey',
  'privatekeypem',
  'webhooksecret',
  'webhooksigningsecret',
  'apikey',
  'databaseurl',
  'connectionstring',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'resettoken',
  'authorization',
  'authorizationheader',
  'cardnumber',
  'fullcardnumber',
  'primaryaccountnumber',
  'cvv',
  'cvc',
  'securitycode',
]);

const VALIDATION_STATUSES = [
  400,
  409,
  413,
  415,
  422,
];

const AUTH_FAILURE_STATUSES = [
  401,
  403,
  404,
];

const NOT_FOUND_STATUSES = [
  400,
  403,
  404,
  422,
];

const INTERNAL_ERROR_PATTERNS = [
  /\bSELECT\b[\s\S]{0,300}\bFROM\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\b[\s\S]{0,300}\bSET\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bSequelizeDatabaseError\b/i,
  /\bPrismaClientKnownRequestError\b/i,
  /\bMongoServerError\b/i,
  /\bMongoServerSelectionError\b/i,
  /\bSQLSTATE\b/i,
  /\bECONNREFUSED\b/i,
  /\bETIMEDOUT\b/i,
  /\bDATABASE_URL\b/i,
  /\/node_modules\//i,
  /\bat\s+\S+\s+\([^)]*:\d+:\d+\)/i,
];

let baseUrl;

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function isLoopbackHostname(hostname) {
  return [
    'localhost',
    '127.0.0.1',
    '::1',
    '[::1]',
  ].includes(String(hostname).toLowerCase());
}

function validatePath(path, label, requireId = false) {
  assert.equal(
    typeof path,
    'string',
    `${label} must be a string.`
  );

  assert.ok(
    path.startsWith('/') && !path.startsWith('//'),
    `${label} must start with exactly one slash.`
  );

  assert.ok(
    !/[\\\r\n\t\0]/.test(path),
    `${label} must not contain backslashes or control characters.`
  );

  assert.ok(
    !path.includes('#'),
    `${label} must not contain a URL fragment.`
  );

  assert.ok(
    !/%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(path),
    `${label} must not contain URL-encoded control characters.`
  );

  if (requireId) {
    assert.ok(
      path.includes(':id'),
      `${label} must contain the :id placeholder.`
    );
  }

  const samplePath = path.replace(/:id\b/g, 'payment-test-id');

  let resolved;

  try {
    resolved = new URL(samplePath, baseUrl);
  } catch {
    assert.fail(`${label} is not a valid URL path.`);
  }

  assert.equal(
    resolved.origin,
    baseUrl.origin,
    `${label} must resolve to the configured API origin.`
  );
}

function validateConfiguration() {
  try {
    baseUrl = new URL(RAW_BASE_URL);
  } catch {
    assert.fail(
      'PAYMENT_TEST_BASE_URL must be a valid absolute URL.'
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(baseUrl.protocol),
    'Payment test URL must use HTTP or HTTPS.'
  );

  assert.equal(
    baseUrl.username,
    '',
    'Do not include credentials in PAYMENT_TEST_BASE_URL.'
  );

  assert.equal(
    baseUrl.password,
    '',
    'Do not include credentials in PAYMENT_TEST_BASE_URL.'
  );

  assert.equal(
    baseUrl.search,
    '',
    'PAYMENT_TEST_BASE_URL must not contain a query string.'
  );

  assert.equal(
    baseUrl.hash,
    '',
    'PAYMENT_TEST_BASE_URL must not contain a URL fragment.'
  );

  assert.ok(
    Number.isSafeInteger(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'PAYMENT_TEST_TIMEOUT_MS must be a positive safe integer.'
  );

  assert.ok(
    Number.isSafeInteger(AMOUNT_MINOR) && AMOUNT_MINOR > 0,
    'TEST_PAYMENT_AMOUNT_MINOR must be a positive integer in minor currency units.'
  );

  assert.match(
    CURRENCY,
    /^[A-Z]{3}$/,
    'TEST_PAYMENT_CURRENCY must be a three-letter currency code.'
  );

  validatePath(PAYMENTS_PATH, 'PAYMENTS_TEST_PATH');
  validatePath(PAYMENT_PATH, 'PAYMENT_TEST_PATH', true);
  validatePath(REFUNDS_PATH, 'PAYMENT_REFUNDS_TEST_PATH', true);

  if (RUN_REFUND_TESTS) {
    assert.equal(
      RUN_MUTATING_TESTS,
      true,
      'Refund tests also require RUN_MUTATING_PAYMENT_TESTS=true.'
    );

    assert.ok(
      REFUND_PAYMENT_ID.trim().length > 0,
      'Refund tests require PAYMENT_TEST_REFUND_PAYMENT_ID pointing to a disposable sandbox payment.'
    );
  }

  if (RUN_MUTATING_TESTS) {
    assert.equal(
      process.env.NODE_ENV,
      'test',
      'Mutating payment tests require NODE_ENV=test.'
    );

    assert.ok(
      USER_A_TOKEN.trim().length > 0,
      'Mutating payment tests require PAYMENT_TEST_USER_A_TOKEN or PAYMENT_TEST_TOKEN.'
    );

    if (!isLoopbackHostname(baseUrl.hostname)) {
      assert.equal(
        ALLOW_REMOTE_MUTATIONS,
        true,
        'Remote payment mutations are blocked. Explicitly enable sandbox mutations to continue.'
      );

      assert.equal(
        process.env.PAYMENT_TEST_ENVIRONMENT,
        'sandbox',
        'Remote mutations require PAYMENT_TEST_ENVIRONMENT=sandbox.'
      );

      assert.equal(
        baseUrl.protocol,
        'https:',
        'Remote mutation tests must use HTTPS.'
      );
    }

    if (process.env.CI === 'true') {
      assert.equal(
        ALLOW_CI_MUTATIONS,
        true,
        'CI payment mutations require PAYMENT_TEST_CI_MUTATIONS=true.'
      );
    }
  }
}

function urlFor(path) {
  assert.equal(
    typeof path,
    'string',
    'Request path must be a string.'
  );

  assert.ok(
    path.startsWith('/') && !path.startsWith('//'),
    'Request must use an origin-relative path.'
  );

  assert.ok(
    !/[\\\r\n\t\0]/.test(path),
    'Request path contains prohibited characters.'
  );

  const url = new URL(path, baseUrl);

  assert.equal(
    url.origin,
    baseUrl.origin,
    'Request must not change the configured API origin.'
  );

  return url;
}

function paymentUrl(id) {
  assert.ok(
    id !== undefined &&
      id !== null &&
      String(id).trim().length > 0,
    'Payment ID must not be empty.'
  );

  const path = PAYMENT_PATH.replace(
    ':id',
    encodeURIComponent(String(id))
  );

  validatePath(path, 'Resolved payment path');

  return path;
}

function refundsUrl(id) {
  assert.ok(
    id !== undefined &&
      id !== null &&
      String(id).trim().length > 0,
    'Payment ID must not be empty.'
  );

  const path = REFUNDS_PATH.replace(
    ':id',
    encodeURIComponent(String(id))
  );

  validatePath(path, 'Resolved refund path');

  return path;
}

async function request(
  path,
  {
    method = 'GET',
    token,
    body,
    headers = {},
  } = {}
) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(urlFor(path), {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      redirect: 'manual',
    });

    const rawBody = await response.text();
    let parsedBody = null;

    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = rawBody;
      }
    }

    return {
      status: response.status,
      headers: response.headers,
      body: parsedBody,
      rawBody,
    };
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${TIMEOUT_MS}ms: ${method} ${path}`
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function responseSummary(response) {
  const contentType =
    response.headers?.get('content-type') || 'unknown';

  return (
    `HTTP ${response.status}; ` +
    `content-type=${contentType}; ` +
    `body=${response.rawBody ? 'present' : 'empty'}`
  );
}

function assertStatus(response, expectedStatuses, label) {
  assert.ok(
    expectedStatuses.includes(response.status),
    `${label}: expected HTTP ${expectedStatuses.join(' or ')}, ` +
      `received ${responseSummary(response)}.`
  );
}

function assertNoServerError(response, label) {
  assert.ok(
    response.status >= 200 && response.status < 500,
    `${label}: unexpected server error; ${responseSummary(response)}.`
  );
}

function assertDenied(response, label) {
  assert.ok(
    AUTH_FAILURE_STATUSES.includes(response.status),
    `${label}: expected HTTP 401, 403, or 404; ` +
      `received ${responseSummary(response)}.`
  );
}

function assertRejected(response, label) {
  assert.ok(
    VALIDATION_STATUSES.includes(response.status),
    `${label}: expected HTTP ${VALIDATION_STATUSES.join(', ')}; ` +
      `received ${responseSummary(response)}.`
  );
}

function isSuccess(response) {
  return [200, 201, 202, 204].includes(response.status);
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

function extractPaymentId(response) {
  const payment = extractPayment(response);

  if (!isObject(payment)) {
    return null;
  }

  return (
    payment.id ??
    payment._id ??
    payment.paymentId ??
    null
  );
}

function assertNoSensitiveFields(value, path = '$', seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    return;
  }

  assert.equal(
    seen.has(value),
    false,
    `Circular object encountered at ${path}.`
  );

  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertNoSensitiveFields(item, `${path}[${index}]`, seen);
    });

    seen.delete(value);
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    assert.equal(
      SENSITIVE_KEYS.has(normalizeKey(key)),
      false,
      `Response must not expose sensitive field "${path}.${key}".`
    );

    assertNoSensitiveFields(
      nestedValue,
      `${path}.${key}`,
      seen
    );
  }

  seen.delete(value);
}

function assertSafeErrorResponse(response) {
  const serialized = JSON.stringify(response.body ?? '');

  assertNoSensitiveFields(response.body);

  for (const pattern of INTERNAL_ERROR_PATTERNS) {
    assert.equal(
      pattern.test(serialized),
      false,
      `Error response may disclose internal details matching ${pattern}.`
    );
  }
}

function requireMutationOptIn() {
  assert.equal(
    RUN_MUTATING_TESTS,
    true,
    'Set RUN_MUTATING_PAYMENT_TESTS=true only for an isolated payment test environment.'
  );

  assert.equal(
    process.env.NODE_ENV,
    'test',
    'Mutating payment tests require NODE_ENV=test.'
  );
}

function requireRefundOptIn() {
  requireMutationOptIn();

  assert.equal(
    RUN_REFUND_TESTS,
    true,
    'Set RUN_PAYMENT_REFUND_TESTS=true to enable refund validation tests.'
  );

  assert.ok(
    REFUND_PAYMENT_ID,
    'A disposable payment ID is required for refund tests.'
  );
}

function newIdempotencyKey() {
  return `medorbits-payment-test-${crypto.randomUUID()}`;
}

function paymentCreationPayload(overrides = {}) {
  return {
    amount: AMOUNT_MINOR,
    currency: CURRENCY,
    description: 'MedOrbits payment integration test',
    ...overrides,
  };
}

function assertPaymentObject(response, label) {
  const payment = extractPayment(response);

  assert.ok(
    isObject(payment),
    `${label}: expected a payment object in the response.`
  );

  assertNoSensitiveFields(payment);

  return payment;
}

function assertPaymentAmount(payment, expectedAmount, label) {
  if (payment.amount === undefined) {
    return;
  }

  assert.ok(
    typeof payment.amount === 'number' &&
      Number.isFinite(payment.amount),
    `${label}: amount must be a finite number.`
  );

  assert.equal(
    payment.amount,
    expectedAmount,
    `${label}: amount does not match the expected value.`
  );
}

function assertPaymentCurrency(payment, expectedCurrency, label) {
  if (payment.currency === undefined) {
    return;
  }

  assert.equal(
    String(payment.currency).toUpperCase(),
    expectedCurrency,
    `${label}: currency does not match the expected currency.`
  );
}

describe('MedOrbits payment integration tests', () => {
  before(() => {
    validateConfiguration();
  });

  describe('endpoint availability', () => {
    it('responds to payment collection requests without a server error', async () => {
      const response = await request(PAYMENTS_PATH, {
        token: USER_A_TOKEN || undefined,
      });

      assertNoServerError(response, 'Payment collection');

      assertStatus(
        response,
        [200, 204, 401, 403, 404, 405],
        'Payment collection'
      );

      if ([401, 403, 404].includes(response.status)) {
        assertSafeErrorResponse(response);
      }
    });
  });

  describe('authentication and authorization', () => {
    it('does not allow unauthenticated payment creation', async () => {
      const response = await request(PAYMENTS_PATH, {
        method: 'POST',
        body: paymentCreationPayload(),
      });

      assertNoServerError(
        response,
        'Unauthenticated payment creation'
      );

      assertDenied(
        response,
        'Unauthenticated payment creation'
      );

      assertSafeErrorResponse(response);
    });

    it('does not allow an invalid bearer token to retrieve a protected payment', async () => {
      const id = PAYMENT_ID || 'invalid-test-payment-id';

      const response = await request(paymentUrl(id), {
        token: 'invalid.payment.integration.token',
      });

      assertNoServerError(
        response,
        'Invalid-token payment retrieval'
      );

      assertDenied(
        response,
        'Invalid-token payment retrieval'
      );

      assertSafeErrorResponse(response);
    });

    it("prevents User B from retrieving User A's private payment", {
      skip: !PAYMENT_ID || !USER_A_TOKEN || !USER_B_TOKEN,
    }, async () => {
      assert.notEqual(
        USER_A_TOKEN,
        USER_B_TOKEN,
        'User A and User B must use distinct tokens.'
      );

      // Establish that the configured fixture is accessible to User A.
      const ownerResponse = await request(paymentUrl(PAYMENT_ID), {
        token: USER_A_TOKEN,
      });

      assertStatus(
        ownerResponse,
        [200],
        'Verify User A payment fixture'
      );

      const ownerPayment = assertPaymentObject(
        ownerResponse,
        'Verify User A payment fixture'
      );

      assert.equal(
        String(
          ownerPayment.id ??
          ownerPayment._id ??
          ownerPayment.paymentId
        ),
        String(PAYMENT_ID),
        'The owner fixture response must match the configured payment ID.'
      );

      const response = await request(paymentUrl(PAYMENT_ID), {
        token: USER_B_TOKEN,
      });

      assertDenied(
        response,
        'Cross-user payment retrieval'
      );

      assertSafeErrorResponse(response);
    });
  });

  describe('payment creation and validation', () => {
    it('creates a valid payment in the configured test environment', {
      skip: !RUN_MUTATING_TESTS,
    }, async () => {
      requireMutationOptIn();

      const response = await request(PAYMENTS_PATH, {
        method: 'POST',
        token: USER_A_TOKEN,
        headers: {
          'Idempotency-Key': newIdempotencyKey(),
        },
        body: paymentCreationPayload(),
      });

      assertNoServerError(response, 'Valid payment creation');

      assertStatus(
        response,
        [200, 201],
        'Valid payment creation'
      );

      const payment = assertPaymentObject(
        response,
        'Valid payment creation'
      );

      assert.ok(
        extractPaymentId(response),
        'Successful payment creation must return a payment ID.'
      );

      assertPaymentAmount(
        payment,
        AMOUNT_MINOR,
        'Created payment'
      );

      assertPaymentCurrency(
        payment,
        CURRENCY,
        'Created payment'
      );

      // If the API creates pending payments, its status should not be
      // inferred to mean the gateway has settled the transaction.
      assert.notEqual(
        payment.status,
        'completed',
        'Payment creation must not claim completion solely from client input.'
      );
    });

    it('rejects zero-value payment requests', {
      skip: !RUN_MUTATING_TESTS,
    }, async () => {
      requireMutationOptIn();

      const response = await request(PAYMENTS_PATH, {
        method: 'POST',
        token: USER_A_TOKEN,
        headers: {
          'Idempotency-Key': newIdempotencyKey(),
        },
        body: paymentCreationPayload({ amount: 0 }),
      });

      assertNoServerError(response, 'Zero-value payment');
      assertRejected(response, 'Zero-value payment');
      assertSafeErrorResponse(response);
    });

    it('rejects negative payment amounts', {
      skip: !RUN_MUTATING_TESTS,
    }, async () => {
      requireMutationOptIn();

      const response = await request(PAYMENTS_PATH, {
        method: 'POST',
        token: USER_A_TOKEN,
        headers: {
          'Idempotency-Key': newIdempotencyKey(),
        },
        body: paymentCreationPayload({ amount: -1 }),
      });

      assertNoServerError(response, 'Negative payment amount');
      assertRejected(response, 'Negative payment amount');
      assertSafeErrorResponse(response);
    });

    it('rejects non-numeric payment amounts', {
      skip: !RUN_MUTATING_TESTS,
    }, async () => {
      requireMutationOptIn();

      const response = await request(PAYMENTS_PATH, {
        method: 'POST',
        token: USER_A_TOKEN,
        headers: {
          'Idempotency-Key': newIdempotencyKey(),
        },
        body: paymentCreationPayload({
          amount: 'not-a-number',
        }),
      });

      assertNoServerError(response, 'Malformed payment amount');
      assertRejected(response, 'Malformed payment amount');
      assertSafeErrorResponse(response);
    });

    it('rejects malformed currency codes', {
      skip: !RUN_MUTATING_TESTS,
    }, async () => {
      requireMutationOptIn();

      const response = await request(PAYMENTS_PATH, {
        method: 'POST',
        token: USER_A_TOKEN,
        headers: {
          'Idempotency-Key': newIdempotencyKey(),
        },
        body: paymentCreationPayload({
          currency: 'XX',
        }),
      });

      assertNoServerError(response, 'Malformed currency code');
      assertRejected(response, 'Malformed currency code');
      assertSafeErrorResponse(response);
    });

    it('does not trust client-supplied payment completion fields', {
      skip: !RUN_MUTATING_TESTS,
    }, async () => {
      requireMutationOptIn();

      const response = await request(PAYMENTS_PATH, {
        method: 'POST',
        token: USER_A_TOKEN,
        headers: {
          'Idempotency-Key': newIdempotencyKey(),
        },
        body: paymentCreationPayload({
          status: 'completed',
          paid: true,
          verified: true,
        }),
      });

      assertNoServerError(
        response,
        'Client-supplied payment completion fields'
      );

      if (!isSuccess(response)) {
        assertRejected(
          response,
          'Client-supplied payment completion fields'
        );

        assertSafeErrorResponse(response);
        return;
      }

      assert.ok(
        [200, 201].includes(response.status),
        `Unexpected successful creation status: ${response.status}.`
      );

      const payment = assertPaymentObject(
        response,
        'Client-supplied payment completion fields'
      );

      assert.notEqual(
        payment.status,
        'completed',
        'Client input must not independently complete a payment.'
      );

      assert.notEqual(
        payment.paid,
        true,
        'Client input must not independently mark a payment as paid.'
      );

      assert.notEqual(
        payment.verified,
        true,
        'Client input must not independently verify a payment.'
      );

      const createdId = extractPaymentId(response);

      if (createdId) {
        const persistedResponse = await request(
          paymentUrl(createdId),
          { token: USER_A_TOKEN }
        );

        assertStatus(
          persistedResponse,
          [200],
          'Read after protected-field payment creation'
        );

        const persisted = assertPaymentObject(
          persistedResponse,
          'Persisted protected-field payment'
        );

        assert.notEqual(persisted.status, 'completed');
        assert.notEqual(persisted.paid, true);
        assert.notEqual(persisted.verified, true);
      }
    });
  });

  describe('payment retrieval and integrity', () => {
    it('retrieves the configured payment and validates available fields', {
      skip: !PAYMENT_ID || !USER_A_TOKEN,
    }, async () => {
      const response = await request(paymentUrl(PAYMENT_ID), {
        token: USER_A_TOKEN,
      });

      assertNoServerError(response, 'Payment retrieval');

      assertStatus(
        response,
        [200],
        'Payment retrieval'
      );

      const payment = assertPaymentObject(
        response,
        'Payment retrieval'
      );

      assert.equal(
        String(
          payment.id ??
          payment._id ??
          payment.paymentId
        ),
        String(PAYMENT_ID),
        'Returned payment ID does not match the requested ID.'
      );

      if (payment.amount !== undefined) {
        assert.ok(
          typeof payment.amount === 'number' &&
            Number.isFinite(payment.amount) &&
            payment.amount >= 0,
          'Payment amount must be a finite non-negative number.'
        );
      }

      if (payment.currency !== undefined) {
        assert.match(
          String(payment.currency),
          /^[A-Z]{3}$/i,
          'Payment currency must be a three-letter code.'
        );
      }
    });
  });

  describe('refund validation', () => {
    it('rejects a zero-value refund against the dedicated test fixture', {
      skip: !RUN_REFUND_TESTS,
    }, async () => {
      requireRefundOptIn();

      const response = await request(
        refundsUrl(REFUND_PAYMENT_ID),
        {
          method: 'POST',
          token: USER_A_TOKEN,
          headers: {
            'Idempotency-Key': newIdempotencyKey(),
          },
          body: {
            amount: 0,
            currency: CURRENCY,
            reason: 'Automated zero-value refund validation test',
          },
        }
      );

      assertNoServerError(response, 'Zero-value refund');
      assertRejected(response, 'Zero-value refund');
      assertSafeErrorResponse(response);
    });

    it('rejects a negative refund amount against the dedicated test fixture', {
      skip: !RUN_REFUND_TESTS,
    }, async () => {
      requireRefundOptIn();

      const response = await request(
        refundsUrl(REFUND_PAYMENT_ID),
        {
          method: 'POST',
          token: USER_A_TOKEN,
          headers: {
            'Idempotency-Key': newIdempotencyKey(),
          },
          body: {
            amount: -1,
            currency: CURRENCY,
            reason: 'Automated negative refund validation test',
          },
        }
      );

      assertNoServerError(response, 'Negative refund');
      assertRejected(response, 'Negative refund');
      assertSafeErrorResponse(response);
    });
  });
});
