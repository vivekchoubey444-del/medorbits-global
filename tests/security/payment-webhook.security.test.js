
'use strict';

/**
 * MedOrbits -- Payment Webhook Security Tests
 *
 * File: tests/security/payment-webhook.security.test.js
 * Runtime: Node.js >= 20
 * Dependencies: Node.js built-in modules only
 *
 * Run:
 *   node --test tests/security/payment-webhook.security.test.js
 *
 * Configuration:
 *   PAYMENT_WEBHOOK_TEST_BASE_URL=http://127.0.0.1:3000
 *   PAYMENT_WEBHOOK_TEST_PATH=/api/payments/webhook
 *   PAYMENT_WEBHOOK_TEST_SECRET
 *   PAYMENT_WEBHOOK_TEST_TIMEOUT_MS=15000
 *   PAYMENT_WEBHOOK_TEST_SIGNATURE_HEADER=x-webhook-signature
 *   PAYMENT_WEBHOOK_TEST_TIMESTAMP_HEADER=x-webhook-timestamp
 *   PAYMENT_WEBHOOK_TEST_EVENT_ID_HEADER=x-webhook-event-id
 *   PAYMENT_WEBHOOK_TEST_TIMESTAMP_TOLERANCE_SECONDS=300
 *   PAYMENT_WEBHOOK_TEST_REPLAY_PROTECTION=true
 *
 * Mutation-test safeguards:
 *   PAYMENT_WEBHOOK_TEST_RUN_MUTATIONS=true
 *   PAYMENT_WEBHOOK_TEST_ALLOW_REMOTE_MUTATIONS=true
 *   PAYMENT_WEBHOOK_TEST_ENVIRONMENT=sandbox
 *   PAYMENT_WEBHOOK_TEST_ALLOW_CI_MUTATIONS=true
 *
 * IMPORTANT:
 * - Use an isolated test environment and a dedicated webhook secret.
 * - Signed webhook deliveries can change payment or subscription state.
 * - Valid deliveries and replay tests are disabled unless explicitly enabled.
 * - Never send synthetic payment events to production.
 * - The default signature is HMAC-SHA256(timestamp + "." + rawBody).
 * - Adapt event schemas, signature parsing, headers, and responses to the
 *   actual payment provider and API contract.
 * - HTTP responses alone cannot prove payment-state integrity or idempotency.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const DEFAULT_TIMEOUT_MS = 15_000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 120_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

const BASE_URL_RAW =
  process.env.PAYMENT_WEBHOOK_TEST_BASE_URL || '';

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

const REPLAY_PROTECTION_REQUIRED =
  process.env.PAYMENT_WEBHOOK_TEST_REPLAY_PROTECTION !== 'false';

const RUN_MUTATION_TESTS =
  process.env.PAYMENT_WEBHOOK_TEST_RUN_MUTATIONS === 'true';

let timeoutMs = DEFAULT_TIMEOUT_MS;
let timestampToleranceSeconds = 300;
let baseUrl = null;
let webhookPath = '';
let configurationError = null;
let serverAvailable = false;

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

function parseBoundedInteger(value, fallback, name, min, max) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < min ||
    parsed > max
  ) {
    throw new Error(
      `${name} must be an integer between ${min} and ${max}.`
    );
  }

  return parsed;
}

function validateHeaderName(name, variableName) {
  // HTTP field-name token characters, excluding whitespace and separators.
  assert.match(
    name,
    /^[!#$%&'*+\-.^_`|~0-9a-z]+$/,
    `${variableName} must be a valid HTTP header name.`
  );

  return name;
}

function validateConfiguration() {
  assert.ok(
    BASE_URL_RAW,
    'Set PAYMENT_WEBHOOK_TEST_BASE_URL to the isolated test API origin.'
  );

  assert.ok(
    WEBHOOK_SECRET.length >= 16,
    'PAYMENT_WEBHOOK_TEST_SECRET must contain at least 16 characters for this test suite.'
  );

  let parsed;

  try {
    parsed = new URL(BASE_URL_RAW);
  } catch {
    throw new Error(
      'PAYMENT_WEBHOOK_TEST_BASE_URL must be a valid absolute URL.'
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(parsed.protocol),
    'Webhook test base URL must use HTTP or HTTPS.'
  );

  assert.ok(
    !parsed.username && !parsed.password,
    'Webhook test base URL must not contain embedded credentials.'
  );

  assert.ok(
    !parsed.search && !parsed.hash,
    'Webhook test base URL must not contain a query string or fragment.'
  );

  assert.equal(
    parsed.pathname,
    '/',
    'Configure PAYMENT_WEBHOOK_TEST_BASE_URL as an origin without a path prefix.'
  );

  baseUrl = new URL(parsed.origin);

  timeoutMs = parseBoundedInteger(
    process.env.PAYMENT_WEBHOOK_TEST_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    'PAYMENT_WEBHOOK_TEST_TIMEOUT_MS',
    MIN_TIMEOUT_MS,
    MAX_TIMEOUT_MS
  );

  timestampToleranceSeconds = parseBoundedInteger(
    process.env.PAYMENT_WEBHOOK_TEST_TIMESTAMP_TOLERANCE_SECONDS,
    300,
    'PAYMENT_WEBHOOK_TEST_TIMESTAMP_TOLERANCE_SECONDS',
    1,
    86_400
  );

  validateHeaderName(
    SIGNATURE_HEADER,
    'PAYMENT_WEBHOOK_TEST_SIGNATURE_HEADER'
  );

  validateHeaderName(
    TIMESTAMP_HEADER,
    'PAYMENT_WEBHOOK_TEST_TIMESTAMP_HEADER'
  );

  validateHeaderName(
    EVENT_ID_HEADER,
    'PAYMENT_WEBHOOK_TEST_EVENT_ID_HEADER'
  );

  assert.equal(
    new Set([
      SIGNATURE_HEADER,
      TIMESTAMP_HEADER,
      EVENT_ID_HEADER,
    ]).size,
    3,
    'Signature, timestamp, and event ID header names must be distinct.'
  );

  assert.ok(
    WEBHOOK_PATH.startsWith('/') &&
      !WEBHOOK_PATH.startsWith('//'),
    'PAYMENT_WEBHOOK_TEST_PATH must start with exactly one slash.'
  );

  assert.ok(
    !WEBHOOK_PATH.includes('?') &&
      !WEBHOOK_PATH.includes('#'),
    'PAYMENT_WEBHOOK_TEST_PATH must not contain a query string or fragment.'
  );

  const parsedPath = new URL(WEBHOOK_PATH, baseUrl);

  assert.equal(
    parsedPath.origin,
    baseUrl.origin,
    'Webhook path must remain on the configured API origin.'
  );

  assert.ok(
    !parsedPath.pathname.split('/').includes('..'),
    'Webhook path must not contain parent-directory path segments.'
  );

  webhookPath = parsedPath.pathname;
}

/* -------------------------------------------------------------------------- */
/* Signing helpers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Generic signing convention:
 *
 *   HMAC_SHA256(secret, `${timestamp}.${rawBody}`)
 *
 * This is not universal. Replace it with the provider's exact signing
 * algorithm, including any required prefixes, encoding, or multiple
 * signatures. The rawBody must be the exact string sent over HTTP.
 */
function hmacSha256(secret, value) {
  return crypto
    .createHmac('sha256', secret)
    .update(value, 'utf8')
    .digest('hex');
}

function createSignature(
  rawBody,
  timestamp,
  secret = WEBHOOK_SECRET
) {
  assert.equal(
    typeof rawBody,
    'string',
    'Signature input must be the exact raw request-body string.'
  );

  assert.ok(
    typeof secret === 'string' && secret.length > 0,
    'A non-empty webhook secret is required.'
  );

  const timestampText = String(timestamp);

  assert.match(
    timestampText,
    /^\d+$/,
    'Signing timestamp must be an integer Unix timestamp.'
  );

  return hmacSha256(
    secret,
    `${timestampText}.${rawBody}`
  );
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
    headers[EVENT_ID_HEADER] = String(eventId);
  }

  return headers;
}

/* -------------------------------------------------------------------------- */
/* Event fixtures                                                             */
/* -------------------------------------------------------------------------- */

function makeEvent({
  id = `evt_security_${crypto.randomUUID()}`,
  type = 'payment.succeeded',
  amount = 1000,
  currency = 'INR',
  paymentId = `pay_security_${crypto.randomUUID()}`,
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

  const timestamp =
    options.timestamp ?? Math.floor(Date.now() / 1000);

  const secret = options.secret ?? WEBHOOK_SECRET;

  const headers = buildHeaders({
    rawBody,
    timestamp,
    secret,
    eventId: event.id,
    ...options,
  });

  return {
    rawBody,
    timestamp,
    headers,
  };
}

/* -------------------------------------------------------------------------- */
/* HTTP helpers                                                               */
/* -------------------------------------------------------------------------- */

function urlFor(path) {
  assert.ok(
    typeof path === 'string' &&
      path.startsWith('/') &&
      !path.startsWith('//'),
    'Webhook request path must start with exactly one slash.'
  );

  const url = new URL(path, baseUrl);

  assert.equal(
    url.origin,
    baseUrl.origin,
    'Cross-origin webhook requests are not permitted.'
  );

  return url;
}

async function sendWebhook({
  rawBody,
  headers = {},
  method = 'POST',
  path = webhookPath,
} = {}) {
  const url = urlFor(path);

  assert.match(
    method,
    /^[A-Z]+$/,
    'HTTP method must be an uppercase method token.'
  );

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    return await fetch(url, {
      method,
      headers,
      body: ['GET', 'HEAD'].includes(method)
        ? undefined
        : rawBody,
      redirect: 'manual',
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'AbortError') {
      throw new Error(
        `Webhook request timed out after ${timeoutMs} ms: ${method} ${url.pathname}`
      );
    }

    throw new Error(
      `Webhook request failed for ${method} ${url.pathname}: ${error.message}`
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function responseBody(response) {
  const contentLength = response.headers.get('content-length');

  if (
    contentLength &&
    Number(contentLength) > MAX_RESPONSE_BYTES
  ) {
    await response.body?.cancel().catch(() => {});

    throw new Error(
      `Webhook response exceeded ${MAX_RESPONSE_BYTES} bytes.`
    );
  }

  const raw = await response.text();

  if (Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new Error(
      `Webhook response exceeded ${MAX_RESPONSE_BYTES} bytes.`
    );
  }

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/* -------------------------------------------------------------------------- */
/* Assertions                                                                 */
/* -------------------------------------------------------------------------- */

function assertRejected(response, description) {
  assert.ok(
    response.status >= 400 && response.status < 500,
    `${description}: expected HTTP 4xx, received HTTP ${response.status}.`
  );
}

function assertNoServerError(response, description) {
  assert.ok(
    response.status < 500,
    `${description}: received HTTP ${response.status}.`
  );
}

function assertNoSensitiveErrorDisclosure(body, description) {
  if (body === null || body === undefined) {
    return;
  }

  const serialized =
    typeof body === 'string'
      ? body
      : JSON.stringify(body);

  assert.doesNotMatch(
    serialized,
    /\bat\s+(?:async\s+)?[\w.$<>]+\s+\([^)]*:\d+:\d+\)/i,
    `${description}: response may expose a stack trace.`
  );

  assert.doesNotMatch(
    serialized,
    /node_modules[\\/].+\.(?:js|cjs|mjs):\d+/i,
    `${description}: response may expose internal source paths.`
  );

  assert.doesNotMatch(
    serialized,
    /\b(?:SELECT|INSERT\s+INTO|UPDATE\s+[\w."`]+\s+SET|DELETE\s+FROM|DROP\s+TABLE)\b/i,
    `${description}: response may expose SQL statements.`
  );
}

async function assertRejectedSafely(response, description) {
  assertRejected(response, description);

  const body = await responseBody(response);

  assertNoSensitiveErrorDisclosure(body, description);
}

/* -------------------------------------------------------------------------- */
/* Mutation safeguards                                                        */
/* -------------------------------------------------------------------------- */

function mutationSkipReason() {
  if (!RUN_MUTATION_TESTS) {
    return (
      'Signed webhook delivery tests are disabled. Set ' +
      'PAYMENT_WEBHOOK_TEST_RUN_MUTATIONS=true to enable them.'
    );
  }

  if (process.env.NODE_ENV !== 'test') {
    return 'Signed webhook delivery tests require NODE_ENV=test.';
  }

  if (
    process.env.CI &&
    process.env.PAYMENT_WEBHOOK_TEST_ALLOW_CI_MUTATIONS !== 'true'
  ) {
    return (
      'CI webhook mutation tests require ' +
      'PAYMENT_WEBHOOK_TEST_ALLOW_CI_MUTATIONS=true.'
    );
  }

  if (
    baseUrl &&
    !['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)
  ) {
    if (
      process.env.PAYMENT_WEBHOOK_TEST_ALLOW_REMOTE_MUTATIONS !== 'true'
    ) {
      return (
        'Remote webhook mutation tests require ' +
        'PAYMENT_WEBHOOK_TEST_ALLOW_REMOTE_MUTATIONS=true.'
      );
    }

    if (
      process.env.PAYMENT_WEBHOOK_TEST_ENVIRONMENT !== 'sandbox'
    ) {
      return (
        'Remote webhook mutation tests require ' +
        'PAYMENT_WEBHOOK_TEST_ENVIRONMENT=sandbox.'
      );
    }

    if (baseUrl.protocol !== 'https:') {
      return 'Remote webhook mutation tests require HTTPS.';
    }
  }

  return '';
}

function defineConfiguredTest(name, options, callback) {
  test(name, async (t) => {
    if (configurationError) {
      throw configurationError;
    }

    if (!serverAvailable) {
      if (options?.healthCheck) {
        assert.fail(
          `Webhook API is unavailable at ${BASE_URL_RAW}.`
        );
      }

      t.skip('Webhook API is unavailable.');
      return;
    }

    if (options?.mutating) {
      const reason = mutationSkipReason();

      if (reason) {
        t.skip(reason);
        return;
      }
    }

    await callback(t);
  });
}

/* -------------------------------------------------------------------------- */
/* Setup                                                                      */
/* -------------------------------------------------------------------------- */

test.before(async () => {
  try {
    validateConfiguration();
  } catch (error) {
    configurationError = error;
    return;
  }

  try {
    const response = await sendWebhook({
      method: 'GET',
      path: '/',
      headers: { accept: 'application/json' },
    });

    serverAvailable = response.status < 500;

    await response.body?.cancel().catch(() => {});
  } catch {
    serverAvailable = false;
  }
});

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

defineConfiguredTest(
  'webhook security suite requires a reachable test API',
  { healthCheck: true },
  async () => {
    const response = await sendWebhook({
      method: 'GET',
      path: '/',
      headers: { accept: 'application/json' },
    });

    assert.ok(
      response.status >= 200 && response.status < 500,
      `Expected a reachable API; received HTTP ${response.status}.`
    );
  }
);

defineConfiguredTest(
  'valid signed webhook is accepted',
  { mutating: true },
  async () => {
    const event = makeEvent();
    const requestData = signedEvent(event);

    const response = await sendWebhook(requestData);

    assert.ok(
      response.status >= 200 && response.status < 300,
      `Valid signed webhook should be accepted; received HTTP ${response.status}.`
    );

    await responseBody(response);
  }
);

defineConfiguredTest(
  'webhook without a signature is rejected',
  {},
  async () => {
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

    await assertRejectedSafely(response, 'Unsigned webhook');
  }
);

defineConfiguredTest(
  'webhook with an invalid signature is rejected',
  {},
  async () => {
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

    await assertRejectedSafely(response, 'Invalid signature');
  }
);

defineConfiguredTest(
  'signature generated with the wrong secret is rejected',
  {},
  async () => {
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

    await assertRejectedSafely(response, 'Wrong-secret signature');
  }
);

defineConfiguredTest(
  'modified payload with original signature is rejected',
  {},
  async () => {
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

    await assertRejectedSafely(response, 'Tampered webhook payload');
  }
);

defineConfiguredTest(
  'webhook with an expired timestamp is rejected',
  {},
  async () => {
    const event = makeEvent();
    const rawBody = serializeEvent(event);

    const timestamp =
      Math.floor(Date.now() / 1000) -
      timestampToleranceSeconds -
      60;

    const response = await sendWebhook({
      rawBody,
      headers: buildHeaders({
        rawBody,
        timestamp,
        eventId: event.id,
      }),
    });

    await assertRejectedSafely(response, 'Expired webhook timestamp');
  }
);

defineConfiguredTest(
  'webhook with a future timestamp outside tolerance is rejected',
  {},
  async () => {
    const event = makeEvent();
    const rawBody = serializeEvent(event);

    const timestamp =
      Math.floor(Date.now() / 1000) +
      timestampToleranceSeconds +
      60;

    const response = await sendWebhook({
      rawBody,
      headers: buildHeaders({
        rawBody,
        timestamp,
        eventId: event.id,
      }),
    });

    await assertRejectedSafely(response, 'Future webhook timestamp');
  }
);

defineConfiguredTest(
  'webhook without a timestamp is rejected',
  {},
  async () => {
    const event = makeEvent();
    const rawBody = serializeEvent(event);

    const response = await sendWebhook({
      rawBody,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        [EVENT_ID_HEADER]: event.id,
        [SIGNATURE_HEADER]: createSignature(
          rawBody,
          Math.floor(Date.now() / 1000)
        ),
      },
    });

    await assertRejectedSafely(response, 'Missing timestamp');
  }
);

defineConfiguredTest(
  'webhook with a malformed timestamp is rejected',
  {},
  async () => {
    const event = makeEvent();
    const rawBody = serializeEvent(event);

    const response = await sendWebhook({
      rawBody,
      headers: {
        ...buildHeaders({
          rawBody,
          eventId: event.id,
        }),
        [TIMESTAMP_HEADER]: 'not-a-timestamp',
      },
    });

    await assertRejectedSafely(response, 'Malformed timestamp');
  }
);

defineConfiguredTest(
  'malformed JSON is rejected safely',
  {},
  async () => {
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

    await assertRejectedSafely(response, 'Malformed JSON');
  }
);

defineConfiguredTest(
  'invalid payment amounts do not cause server errors',
  { mutating: true },
  async () => {
    const invalidAmounts = [-1, '1000', null];

    for (const amount of invalidAmounts) {
      const event = makeEvent({ amount });
      const requestData = signedEvent(event);

      const response = await sendWebhook(requestData);
      const body = await responseBody(response);

      assertNoServerError(
        response,
        `Invalid payment amount ${String(amount)}`
      );

      if (response.status >= 200 && response.status < 300) {
        // A successful HTTP status does not establish that the provider
        // adapter rejected the value or that no financial state changed.
        // Verify persisted payment state using an isolated test database.
        assert.ok(
          body === null || typeof body === 'object' || typeof body === 'string',
          'Unexpected response body type.'
        );
      } else if (response.status >= 400) {
        assertClientErrorStatus(
          response,
          `Invalid payment amount ${String(amount)}`
        );

        assertNoSensitiveErrorDisclosure(
          body,
          `Invalid payment amount ${String(amount)}`
        );
      }
    }
  }
);

function assertClientErrorStatus(response, description) {
  assert.ok(
    response.status >= 400 && response.status < 500,
    `${description}: expected HTTP 4xx, received HTTP ${response.status}.`
  );
}

defineConfiguredTest(
  'unknown event type does not cause a server error',
  { mutating: true },
  async () => {
    const event = makeEvent({
      type: 'payment.security_test.unknown',
    });

    const response = await sendWebhook(signedEvent(event));
    const body = await responseBody(response);

    assertNoServerError(response, 'Unknown event type');

    if (response.status >= 400) {
      assertNoSensitiveErrorDisclosure(body, 'Unknown event type');
    }
  }
);

defineConfiguredTest(
  'unsupported HTTP methods are rejected',
  {},
  async () => {
    const response = await sendWebhook({
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    assert.ok(
      [400, 404, 405, 501].includes(response.status),
      `Unexpected GET response: HTTP ${response.status}.`
    );
  }
);

defineConfiguredTest(
  'duplicate webhook delivery is handled without a server error',
  {
    mutating: true,
    skipIfReplayProtectionDisabled: true,
  },
  async (t) => {
    if (!REPLAY_PROTECTION_REQUIRED) {
      t.skip(
        'Replay test disabled by PAYMENT_WEBHOOK_TEST_REPLAY_PROTECTION=false.'
      );
      return;
    }

    const event = makeEvent();
    const requestData = signedEvent(event);

    const first = await sendWebhook(requestData);

    assert.ok(
      first.status >= 200 && first.status < 300,
      `First delivery should be accepted; received HTTP ${first.status}.`
    );

    await responseBody(first);

    // Reuse the exact same body, signature, timestamp, and event ID.
    const second = await sendWebhook(requestData);
    const secondBody = await responseBody(second);

    assertNoServerError(second, 'Duplicate webhook delivery');

    if (second.status >= 400) {
      assertNoSensitiveErrorDisclosure(
        secondBody,
        'Duplicate webhook delivery'
      );
    }

    // The API may return 2xx for an already-processed event or reject it.
    // Verify the payment, ledger, and subscription state independently
    // to prove the event's financial effects were applied exactly once.
  }
);

/* -------------------------------------------------------------------------- */
/* Signing helper tests                                                       */
/* -------------------------------------------------------------------------- */

test('webhook signing helper produces deterministic HMAC-SHA256 digests', () => {
  const rawBody = JSON.stringify(
    makeEvent({ id: 'evt_deterministic_test' })
  );

  const timestamp = 1_700_000_000;

  const first = createSignature(
    rawBody,
    timestamp,
    'test-secret'
  );

  const second = createSignature(
    rawBody,
    timestamp,
    'test-secret'
  );

  const differentSecret = createSignature(
    rawBody,
    timestamp,
    'different-secret'
  );

  const differentTimestamp = createSignature(
    rawBody,
    timestamp + 1,
    'test-secret'
  );

  assert.equal(first, second);
  assert.notEqual(first, differentSecret);
  assert.notEqual(first, differentTimestamp);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('webhook signature changes when the raw payload changes', () => {
  const timestamp = 1_700_000_000;

  const original = createSignature(
    '{"amount":1000}',
    timestamp,
    'test-secret'
  );

  const modified = createSignature(
    '{"amount":1001}',
    timestamp,
    'test-secret'
  );

  assert.notEqual(original, modified);
});
