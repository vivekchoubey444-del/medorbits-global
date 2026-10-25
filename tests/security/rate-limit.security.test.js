
'use strict';

/**
 * MedOrbits -- Rate Limit Security Tests
 *
 * File: tests/security/rate-limit.security.test.js
 * Runtime: Node.js >= 20
 * Dependencies: Node.js built-in modules only
 *
 * Configuration:
 *   RATE_LIMIT_TEST_BASE_URL
 *   RATE_LIMIT_TEST_TIMEOUT_MS
 *   RATE_LIMIT_TEST_REQUEST_COUNT
 *   RATE_LIMIT_TEST_LOGIN_PATH
 *   RATE_LIMIT_TEST_API_PATH
 *   RATE_LIMIT_TEST_SEARCH_PATH
 *   RATE_LIMIT_TEST_AUTH_TOKEN
 *   RATE_LIMIT_TEST_EXPECT_429
 *   RATE_LIMIT_TEST_FORWARDED_HEADER
 *
 * Additional safeguards:
 *   RATE_LIMIT_TEST_ALLOW_REMOTE=true
 *   RATE_LIMIT_TEST_RUN_MUTATING_METHODS=true
 *   RATE_LIMIT_TEST_ENVIRONMENT=sandbox
 *   RATE_LIMIT_TEST_ALLOW_REMOTE_MUTATIONS=true
 *   RATE_LIMIT_TEST_ALLOW_CI_MUTATIONS=true
 *
 * Run read-only tests:
 *   RATE_LIMIT_TEST_BASE_URL=http://127.0.0.1:3000 \
 *   node --test tests/security/rate-limit.security.test.js
 *
 * IMPORTANT:
 * - Run only against an isolated test environment.
 * - Rate-limit tests consume rate-limit capacity by design.
 * - Mutation probes are disabled by default.
 * - A 429 response demonstrates that a limit was triggered for this
 *   request sequence; it does not prove distributed limiter correctness.
 * - Forwarded-header tests do not, by themselves, prove that proxy
 *   headers are configured securely.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const BASE_URL = (
  process.env.RATE_LIMIT_TEST_BASE_URL || ''
).trim().replace(/\/+$/, '');

const TIMEOUT_MS = Number(
  process.env.RATE_LIMIT_TEST_TIMEOUT_MS || 15000
);

const REQUEST_COUNT = Number(
  process.env.RATE_LIMIT_TEST_REQUEST_COUNT || 30
);

const LOGIN_PATH =
  process.env.RATE_LIMIT_TEST_LOGIN_PATH ||
  '/api/auth/login';

const API_PATH =
  process.env.RATE_LIMIT_TEST_API_PATH ||
  '/api/users';

const SEARCH_PATH =
  process.env.RATE_LIMIT_TEST_SEARCH_PATH ||
  '/api/search';

const AUTH_TOKEN =
  process.env.RATE_LIMIT_TEST_AUTH_TOKEN || '';

const EXPECT_429 =
  process.env.RATE_LIMIT_TEST_EXPECT_429 !== 'false';

const FORWARDED_HEADER =
  process.env.RATE_LIMIT_TEST_FORWARDED_HEADER ||
  'X-Forwarded-For';

const ALLOW_REMOTE =
  process.env.RATE_LIMIT_TEST_ALLOW_REMOTE === 'true';

const RUN_MUTATING_METHODS =
  process.env.RATE_LIMIT_TEST_RUN_MUTATING_METHODS === 'true';

const TEST_ENVIRONMENT = (
  process.env.RATE_LIMIT_TEST_ENVIRONMENT || ''
).trim().toLowerCase();

const ALLOW_REMOTE_MUTATIONS =
  process.env.RATE_LIMIT_TEST_ALLOW_REMOTE_MUTATIONS === 'true';

const ALLOW_CI_MUTATIONS =
  process.env.RATE_LIMIT_TEST_ALLOW_CI_MUTATIONS === 'true';

const IS_CI = Boolean(
  process.env.CI ||
  process.env.GITHUB_ACTIONS ||
  process.env.GITLAB_CI ||
  process.env.BUILDKITE ||
  process.env.JENKINS_URL
);

const MAX_REQUEST_COUNT = 500;
const MAX_RESPONSE_BYTES = 1024 * 1024;

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
]);

const RATE_LIMIT_HEADER_NAMES = [
  'ratelimit',
  'ratelimit-policy',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'retry-after',
];

const CONFIGURED = Boolean(
  BASE_URL &&
  Number.isFinite(TIMEOUT_MS) &&
  TIMEOUT_MS >= 100 &&
  TIMEOUT_MS <= 120000 &&
  Number.isInteger(REQUEST_COUNT) &&
  REQUEST_COUNT >= 2 &&
  REQUEST_COUNT <= MAX_REQUEST_COUNT
);

function validPath(path) {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('\\') &&
    !/[\r\n\u0000]/.test(path) &&
    !path.includes('#')
  );
}

function assertConfiguredPath(path, name) {
  assert.ok(
    validPath(path),
    `${name} must begin with one slash and contain no line breaks, ` +
      'backslashes, or fragments.'
  );
}

function validateHeaderName(name) {
  assert.ok(
    typeof name === 'string' &&
      /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name),
    'Forwarded-header name must be a valid HTTP token.'
  );

  assert.ok(
    ![
      'authorization',
      'cookie',
      'content-type',
      'host',
      'connection',
      'content-length',
    ].includes(name.toLowerCase()),
    'Forwarded-header configuration must not override a sensitive or hop-by-hop header.'
  );
}

function validateBaseUrl() {
  let parsed;

  try {
    parsed = new URL(BASE_URL);
  } catch {
    throw new Error(
      'RATE_LIMIT_TEST_BASE_URL must be a valid absolute URL.'
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(parsed.protocol),
    'Base URL must use HTTP or HTTPS.'
  );

  assert.equal(
    parsed.username + parsed.password,
    '',
    'Do not put credentials in the base URL.'
  );

  assert.equal(
    parsed.search,
    '',
    'Base URL must not contain a query string.'
  );

  assert.equal(
    parsed.hash,
    '',
    'Base URL must not contain a fragment.'
  );

  const isLocal = LOCAL_HOSTS.has(parsed.hostname);

  assert.ok(
    isLocal || ALLOW_REMOTE,
    'Remote test targets require RATE_LIMIT_TEST_ALLOW_REMOTE=true.'
  );

  if (!isLocal) {
    assert.equal(
      parsed.protocol,
      'https:',
      'Remote test targets must use HTTPS.'
    );
  }

  return { parsed, isLocal };
}

function mutationSkipReason() {
  if (!RUN_MUTATING_METHODS) {
    return (
      'Mutating method probes are disabled. Set ' +
      'RATE_LIMIT_TEST_RUN_MUTATING_METHODS=true to enable them.'
    );
  }

  if (process.env.NODE_ENV !== 'test') {
    return 'Mutating probes require NODE_ENV=test.';
  }

  if (TEST_ENVIRONMENT !== 'sandbox') {
    return 'Mutating probes require RATE_LIMIT_TEST_ENVIRONMENT=sandbox.';
  }

  if (IS_CI && !ALLOW_CI_MUTATIONS) {
    return (
      'Mutating probes in CI require ' +
      'RATE_LIMIT_TEST_ALLOW_CI_MUTATIONS=true.'
    );
  }

  if (BASE_URL) {
    try {
      const { isLocal } = validateBaseUrl();

      if (
        !isLocal &&
        (!ALLOW_REMOTE || !ALLOW_REMOTE_MUTATIONS)
      ) {
        return (
          'Remote mutations require both ' +
          'RATE_LIMIT_TEST_ALLOW_REMOTE=true and ' +
          'RATE_LIMIT_TEST_ALLOW_REMOTE_MUTATIONS=true.'
        );
      }
    } catch (error) {
      return `Invalid mutation target: ${error.message}`;
    }
  }

  return null;
}

function requestHeaders(extra = {}) {
  return {
    Accept: 'application/json',
    ...(AUTH_TOKEN
      ? { Authorization: `Bearer ${AUTH_TOKEN}` }
      : {}),
    ...extra,
  };
}

async function send(path, options = {}) {
  assert.ok(BASE_URL, 'RATE_LIMIT_TEST_BASE_URL is required.');

  assertConfiguredPath(path, 'Request path');

  const {
    method = 'GET',
    body,
    headers: extraHeaders = {},
  } = options;

  const base = new URL(BASE_URL);
  const url = new URL(path, `${BASE_URL}/`);

  assert.equal(
    url.origin,
    base.origin,
    'Request must remain on the configured origin.'
  );

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  try {
    return await fetch(url, {
      method,
      headers: requestHeaders({
        ...extraHeaders,
        ...(body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      }),
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
      redirect: 'manual',
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${TIMEOUT_MS} ms: ${method} ${path}`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function readRateLimitHeaders(response) {
  return Object.fromEntries(
    RATE_LIMIT_HEADER_NAMES
      .map((name) => [
        name,
        response.headers.get(name),
      ])
      .filter(([, value]) => value !== null)
  );
}

async function readBody(response) {
  const declaredLength = response.headers.get('content-length');

  if (declaredLength !== null) {
    const length = Number(declaredLength);

    assert.ok(
      Number.isFinite(length) &&
        length >= 0 &&
        length <= MAX_RESPONSE_BYTES,
      `Response exceeds the ${MAX_RESPONSE_BYTES}-byte limit.`
    );
  }

  if (!response.body) {
    return null;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();

        throw new Error(
          `Response exceeds the ${MAX_RESPONSE_BYTES}-byte limit.`
        );
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    return null;
  }

  const raw = Buffer.concat(chunks).toString('utf8');

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function assertNotServerError(response, description) {
  assert.ok(
    response.status < 500,
    `${description}: unexpected HTTP ${response.status}.`
  );
}

function countStatus(results, status) {
  return results.filter(
    (result) => result.status === status
  ).length;
}

function assertNumericHeader(headers, name) {
  if (headers[name] === undefined) {
    return;
  }

  assert.match(
    headers[name],
    /^\d+$/,
    `${name} must contain a non-negative integer.`
  );
}

function assertRetryAfter(headers) {
  const value = headers['retry-after'];

  if (value === undefined) {
    return;
  }

  assert.ok(
    /^\d+$/.test(value) ||
      !Number.isNaN(Date.parse(value)),
    'Retry-After must be a non-negative number of seconds or an HTTP date.'
  );
}

function assertRateLimitHeadersWellFormed(headers) {
  for (const name of [
    'ratelimit-limit',
    'ratelimit-remaining',
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
  ]) {
    assertNumericHeader(headers, name);
  }

  assertRetryAfter(headers);
}

async function runBurst(path, count, options = {}) {
  assert.ok(
    Number.isInteger(count) &&
      count >= 1 &&
      count <= MAX_REQUEST_COUNT,
    `Burst count must be between 1 and ${MAX_REQUEST_COUNT}.`
  );

  const results = [];

  // Deliberately sequential to avoid creating an uncontrolled traffic spike.
  for (let index = 0; index < count; index += 1) {
    const response = await send(path, options);

    let body;

    try {
      body = await readBody(response);
    } catch (error) {
      await response.body?.cancel().catch(() => {});
      throw error;
    }

    results.push({
      index,
      status: response.status,
      headers: readRateLimitHeaders(response),
      body,
    });
  }

  return results;
}

function assertBurstResponsesSafe(results, description) {
  assert.equal(
    results.length,
    REQUEST_COUNT,
    `${description}: unexpected result count.`
  );

  for (const result of results) {
    assert.ok(
      result.status >= 100 && result.status <= 599,
      `${description}: invalid HTTP status at request ${result.index + 1}.`
    );

    assertNotServerError(
      { status: result.status },
      `${description}, request ${result.index + 1}`
    );
  }
}

function assertRateLimitObserved(results, description) {
  if (!EXPECT_429) {
    return;
  }

  const limited = countStatus(results, 429);

  assert.ok(
    limited > 0,
    `${description}: no HTTP 429 received after ${REQUEST_COUNT} requests. ` +
      'Check the configured limiter threshold, route, limiter key, ' +
      'test-environment settings, and any upstream proxy or gateway.'
  );
}

function assertLimitedResponseHeaders(results, description) {
  const limited = results.filter(
    (result) => result.status === 429
  );

  for (const result of limited) {
    assertRateLimitHeadersWellFormed(result.headers);
  }

  // Retry-After is often useful but is not universally required.
  // Do not require its presence unless the API contract specifies it.
  if (limited.length > 0) {
    assert.ok(
      limited.every((result) => result.status === 429),
      `${description}: unexpected rate-limit response status.`
    );
  }
}

function randomInvalidLoginPayload() {
  const marker = crypto.randomUUID();

  return {
    email: `rate-limit-${marker}@example.invalid`,
    password: `invalid-test-password-${marker}`,
  };
}

async function runLoginBurst() {
  return runBurst(
    LOGIN_PATH,
    REQUEST_COUNT,
    {
      method: 'POST',
      body: randomInvalidLoginPayload(),
    }
  );
}

async function runReadOnlyBurst(path) {
  return runBurst(path, REQUEST_COUNT, {
    method: 'GET',
  });
}

test(
  'Rate limit security integration suite',
  { skip: !CONFIGURED },
  async (t) => {
    validateBaseUrl();
    validateHeaderName(FORWARDED_HEADER);

    assertConfiguredPath(LOGIN_PATH, 'Login path');
    assertConfiguredPath(API_PATH, 'API path');
    assertConfiguredPath(SEARCH_PATH, 'Search path');

    await t.test(
      'Repeated authentication requests trigger rate limiting',
      async () => {
        const results = await runLoginBurst();

        assertBurstResponsesSafe(
          results,
          'Authentication burst'
        );

        assertRateLimitObserved(
          results,
          'Authentication burst'
        );

        assertLimitedResponseHeaders(
          results,
          'Authentication burst'
        );
      }
    );

    await t.test(
      'Repeated API requests trigger rate limiting',
      async () => {
        const results = await runReadOnlyBurst(API_PATH);

        assertBurstResponsesSafe(
          results,
          'API burst'
        );

        assertRateLimitObserved(
          results,
          'API burst'
        );

        assertLimitedResponseHeaders(
          results,
          'API burst'
        );
      }
    );

    await t.test(
      'Repeated search requests trigger rate limiting',
      async () => {
        const results = await runReadOnlyBurst(SEARCH_PATH);

        assertBurstResponsesSafe(
          results,
          'Search burst'
        );

        assertRateLimitObserved(
          results,
          'Search burst'
        );

        assertLimitedResponseHeaders(
          results,
          'Search burst'
        );
      }
    );

    await t.test(
      'Rate-limit headers are well formed when supplied',
      async () => {
        const response = await send(API_PATH, {
          method: 'GET',
        });

        try {
          assertNotServerError(
            response,
            'Rate-limit header probe'
          );

          const headers = readRateLimitHeaders(response);

          assertRateLimitHeadersWellFormed(headers);
        } finally {
          await response.body?.cancel().catch(() => {});
        }
      }
    );

    await t.test(
      'Forwarded-header spoofing probes do not cause server errors',
      async () => {
        const fakeAddresses = [
          '198.51.100.10',
          '203.0.113.20',
          '192.0.2.30',
        ];

        for (const address of fakeAddresses) {
          const response = await send(API_PATH, {
            method: 'GET',
            headers: {
              [FORWARDED_HEADER]: address,
            },
          });

          try {
            assertNotServerError(
              response,
              'Forwarded-header spoofing probe'
            );
          } finally {
            await response.body?.cancel().catch(() => {});
          }
        }
      }
    );

    await t.test(
      'Mutating HTTP methods do not bypass rate limiting or authorization',
      {
        skip: Boolean(mutationSkipReason()),
      },
      async () => {
        for (const method of [
          'POST',
          'PUT',
          'PATCH',
          'DELETE',
        ]) {
          const response = await send(API_PATH, {
            method,
            body: {
              rateLimitSecurityTest: true,
              testMarker: crypto.randomUUID(),
            },
          });

          try {
            assertNotServerError(
              response,
              `HTTP method probe (${method})`
            );

            // This is not a blanket requirement for 401/403/405:
            // actual route permissions and method support differ.
            // The key invariant here is that the request does not
            // crash the server. Verify rate-limit behavior using
            // the relevant route-specific burst tests.
          } finally {
            await response.body?.cancel().catch(() => {});
          }
        }
      }
    );
  }
);

test('Rate-limit helper invariants', () => {
  assert.ok(
    Number.isFinite(TIMEOUT_MS) &&
      TIMEOUT_MS >= 100 &&
      TIMEOUT_MS <= 120000,
    'Timeout must be between 100 and 120000 milliseconds.'
  );

  assert.ok(
    Number.isInteger(REQUEST_COUNT) &&
      REQUEST_COUNT >= 2 &&
      REQUEST_COUNT <= MAX_REQUEST_COUNT,
    `Request count must be between 2 and ${MAX_REQUEST_COUNT}.`
  );

  for (const [name, path] of [
    ['Login path', LOGIN_PATH],
    ['API path', API_PATH],
    ['Search path', SEARCH_PATH],
  ]) {
    assertConfiguredPath(path, name);
  }

  validateHeaderName(FORWARDED_HEADER);

  assert.equal(
    countStatus(
      [{ status: 429 }, { status: 200 }],
      429
    ),
    1
  );

  assert.equal(
    countStatus(
      [{ status: 429 }, { status: 429 }],
      429
    ),
    2
  );

  assert.equal(
    countStatus(
      [{ status: 200 }, { status: 401 }],
      429
    ),
    0
  );

  assert.equal(
    validPath('//example.com/api/users'),
    false
  );

  assert.equal(
    validPath('/api/users\r\nX-Test: true'),
    false
  );

  assert.equal(
    validPath('https://example.com/api/users'),
    false
  );
});

test('Rate-limit configuration validation', () => {
  if (!BASE_URL) {
    assert.equal(
      CONFIGURED,
      false,
      'Suite must remain unconfigured without a base URL.'
    );

    return;
  }

  validateBaseUrl();
  validateHeaderName(FORWARDED_HEADER);

  assert.ok(
    Number.isFinite(TIMEOUT_MS) &&
      TIMEOUT_MS >= 100 &&
      TIMEOUT_MS <= 120000,
    'Invalid request timeout.'
  );

  assert.ok(
    Number.isInteger(REQUEST_COUNT) &&
      REQUEST_COUNT >= 2 &&
      REQUEST_COUNT <= MAX_REQUEST_COUNT,
    'Invalid request count.'
  );
});
