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
 * Run:
 *   node --test tests/security/rate-limit.security.test.js
 *
 * Run only against an isolated test environment.
 * This suite does not prove that rate limits are correctly distributed
 * across users, IP addresses, processes, or production infrastructure.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const BASE_URL = (
  process.env.RATE_LIMIT_TEST_BASE_URL || ''
).replace(/\/+$/, '');
const TIMEOUT_MS = Number(
  process.env.RATE_LIMIT_TEST_TIMEOUT_MS || 15000
);
const REQUEST_COUNT = Number(
  process.env.RATE_LIMIT_TEST_REQUEST_COUNT || 30
);
const LOGIN_PATH =
  process.env.RATE_LIMIT_TEST_LOGIN_PATH || '/api/auth/login';
const API_PATH =
  process.env.RATE_LIMIT_TEST_API_PATH || '/api/users';
const SEARCH_PATH =
  process.env.RATE_LIMIT_TEST_SEARCH_PATH || '/api/search';
const AUTH_TOKEN =
  process.env.RATE_LIMIT_TEST_AUTH_TOKEN || '';
const EXPECT_429 =
  process.env.RATE_LIMIT_TEST_EXPECT_429 !== 'false';
const FORWARDED_HEADER =
  process.env.RATE_LIMIT_TEST_FORWARDED_HEADER ||
  'X-Forwarded-For';
const configured = Boolean(
  BASE_URL &&
  Number.isFinite(TIMEOUT_MS) &&
  TIMEOUT_MS > 0 &&
  Number.isInteger(REQUEST_COUNT) &&
  REQUEST_COUNT >= 2
);
function validPath(path) {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !/[\r\n]/.test(path)
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
    'Do not place credentials in the base URL.'
  );
  const explicitlyAllowedHosts = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    '[::1]',
  ]);
  assert.ok(
    explicitlyAllowedHosts.has(parsed.hostname) ||
      process.env.RATE_LIMIT_TEST_ALLOW_REMOTE === 'true',
    'Remote test targets require RATE_LIMIT_TEST_ALLOW_REMOTE=true.'
  );
  return parsed;
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
async function send(path, {
  method = 'GET',
  body,
  headers = {},
} = {}) {
  assert.ok(validPath(path), `Invalid request path: ${path}`);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers: requestHeaders({
        ...headers,
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
  } finally {
    clearTimeout(timeout);
  }
}
function readRateLimitHeaders(response) {
  const names = [
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
  return Object.fromEntries(
    names
      .map((name) => [name, response.headers.get(name)])
      .filter(([, value]) => value !== null)
  );
}
async function readBody(response) {
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
function assertNotServerError(response, description) {
  assert.ok(
    response.status < 500,
    `${description}: unexpected HTTP ${response.status}`
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
    `Expected ${name} to contain a non-negative integer`
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
    'Retry-After must be a non-negative number of seconds or an HTTP date'
  );
}
async function runBurst(path, count, options = {}) {
  const results = [];
  for (let index = 0; index < count; index += 1) {
    const response = await send(path, options);
    results.push({
      status: response.status,
      headers: readRateLimitHeaders(response),
      body: await readBody(response),
    });
  }
  return results;
}
function assertConfiguredPath(path, name) {
  assert.ok(
    validPath(path),
    `${name} must begin with a single slash and contain no line breaks`
  );
}
test(
  'Rate limit security integration suite',
  { skip: !configured },
  async (t) => {
    validateBaseUrl();
    await t.test('Configured paths and limits are valid', () => {
      assertConfiguredPath(LOGIN_PATH, 'Login path');
      assertConfiguredPath(API_PATH, 'API path');
      assertConfiguredPath(SEARCH_PATH, 'Search path');
      assert.ok(
        Number.isInteger(REQUEST_COUNT) && REQUEST_COUNT >= 2,
        'Request count must be an integer >= 2'
      );
    });
    await t.test(
      'Repeated authentication requests trigger rate limiting',
      async () => {
        const marker = crypto.randomUUID();
        const results = await runBurst(
          LOGIN_PATH,
          REQUEST_COUNT,
          {
            method: 'POST',
            body: {
              email: `rate-limit-${marker}@example.invalid`,
              password: 'invalid-test-password',
            },
          }
        );
        assert.equal(results.length, REQUEST_COUNT);
        for (const result of results) {
          assert.ok(
            result.status < 500,
            `Login request returned HTTP ${result.status}`
          );
        }
        if (EXPECT_429) {
          assert.ok(
            countStatus(results, 429) > 0,
            `No HTTP 429 received after ${REQUEST_COUNT} login requests. ` +
              'Check the configured threshold, limiter key, route, and test environment.'
          );
        }
      }
    );
    await t.test(
      'Repeated API requests trigger rate limiting',
      async () => {
        const results = await runBurst(API_PATH, REQUEST_COUNT);
        assert.equal(results.length, REQUEST_COUNT);
        for (const result of results) {
          assert.ok(
            result.status < 500,
            `API request returned HTTP ${result.status}`
          );
        }
        if (EXPECT_429) {
          assert.ok(
            countStatus(results, 429) > 0,
            `No HTTP 429 received after ${REQUEST_COUNT} API requests`
          );
        }
      }
    );
    await t.test(
      'Repeated search requests trigger rate limiting',
      async () => {
        const results = await runBurst(SEARCH_PATH, REQUEST_COUNT);
        assert.equal(results.length, REQUEST_COUNT);
        for (const result of results) {
          assert.ok(
            result.status < 500,
            `Search request returned HTTP ${result.status}`
          );
        }
        if (EXPECT_429) {
          assert.ok(
            countStatus(results, 429) > 0,
            `No HTTP 429 received after ${REQUEST_COUNT} search requests`
          );
        }
      }
    );
    await t.test(
      'Rate-limit headers are valid when supplied',
      async () => {
        const response = await send(API_PATH);
        const headers = readRateLimitHeaders(response);
        assertNotServerError(response, 'Rate-limit header probe');
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
    );
    await t.test(
      'Different HTTP methods do not cause server errors',
      async () => {
        const methods = [
          'GET',
          'POST',
          'PUT',
          'PATCH',
          'DELETE',
        ];
        const statuses = [];
        for (const method of methods) {
          const response = await send(API_PATH, {
            method,
            body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
              ? { rateLimitSecurityTest: true }
              : undefined,
          });
          statuses.push(response.status);
          assertNotServerError(
            response,
            `HTTP method probe (${method})`
          );
        }
        assert.equal(statuses.length, methods.length);
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
            headers: {
              [FORWARDED_HEADER]: address,
            },
          });
          assertNotServerError(
            response,
            'Forwarded-header spoofing probe'
          );
        }
      }
    );
    await t.test(
      'Rate-limited responses have a valid Retry-After header when supplied',
      async () => {
        const results = await runBurst(
          LOGIN_PATH,
          REQUEST_COUNT,
          {
            method: 'POST',
            body: {
              email: 'rate-limit-response@example.invalid',
              password: 'invalid-test-password',
            },
          }
        );
        const limited = results.filter(
          (result) => result.status === 429
        );
        for (const result of limited) {
          assertRetryAfter(result.headers);
        }
      }
    );
  }
);
test('Rate-limit helper invariants', () => {
  assert.ok(
    Number.isFinite(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'Timeout must be positive'
  );
  assert.ok(
    Number.isInteger(REQUEST_COUNT) && REQUEST_COUNT >= 2,
    'Request count must be an integer >= 2'
  );
  for (const path of [LOGIN_PATH, API_PATH, SEARCH_PATH]) {
    assertConfiguredPath(path, 'Configured path');
  }
  assert.equal(
    countStatus([{ status: 429 }, { status: 200 }], 429),
    1
  );
});