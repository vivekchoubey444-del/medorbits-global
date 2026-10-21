'use strict';
/**
 * MedOrbits -- Input Validation Security Tests
 *
 * File: tests/security/input-validation.security.test.js
 *
 * Runtime: Node.js >= 20
 * Dependencies: Node.js built-in modules only
 *
 * Configuration:
 *   INPUT_VALIDATION_TEST_BASE_URL
 *   INPUT_VALIDATION_TEST_TOKEN       Optional bearer token
 *   INPUT_VALIDATION_TEST_TIMEOUT_MS  Defaults to 15000
 *
 * Run:
 *   node --test tests/security/input-validation.security.test.js
 *
 * IMPORTANT:
 * - Run only against a dedicated test environment.
 * - Configure routes to match the actual API.
 * - Tests must not create or delete production records.
 * - A non-5xx response does not, by itself, prove input is safe.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const BASE_URL = (
  process.env.INPUT_VALIDATION_TEST_BASE_URL || ''
).replace(/\/+$/, '');
const TOKEN = process.env.INPUT_VALIDATION_TEST_TOKEN || '';
const TIMEOUT_MS = Number(
  process.env.INPUT_VALIDATION_TEST_TIMEOUT_MS || 15000
);
const configured = Boolean(
  BASE_URL &&
  Number.isFinite(TIMEOUT_MS) &&
  TIMEOUT_MS > 0
);
const JSON_HEADERS = Object.freeze({
  Accept: 'application/json',
  'Content-Type': 'application/json',
});
const ROUTES = Object.freeze({
  health: process.env.INPUT_VALIDATION_TEST_HEALTH_PATH || '/health',
  applications:
    process.env.INPUT_VALIDATION_TEST_APPLICATIONS_PATH ||
    '/api/applications',
  search:
    process.env.INPUT_VALIDATION_TEST_SEARCH_PATH ||
    '/api/search',
});
function makeHeaders(extra = {}) {
  return {
    ...JSON_HEADERS,
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    ...extra,
  };
}
async function send(path, options = {}) {
  if (!BASE_URL) {
    throw new Error(
      'Set INPUT_VALIDATION_TEST_BASE_URL before making HTTP requests.'
    );
  }
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new TypeError('Request path must be a relative absolute path.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );
  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...options,
      redirect: 'manual',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
async function responseBody(response) {
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
function assertClientError(response, description) {
  assert.ok(
    response.status >= 400 && response.status < 500,
    `${description}: expected a 4xx response, received HTTP ${response.status}`
  );
}
function assertSafeErrorBody(body) {
  if (body === null || body === undefined) {
    return;
  }
  const serialized =
    typeof body === 'string' ? body : JSON.stringify(body);
  assert.doesNotMatch(
    serialized,
    /at\s+\S+\s+\([^)]*:\d+:\d+\)/,
    'Error response appears to expose a server stack trace'
  );
  assert.doesNotMatch(
    serialized,
    /\b(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i,
    'Error response appears to expose SQL statements'
  );
  assert.doesNotMatch(
    serialized,
    /node_modules[\\/].+\.(?:js|cjs|mjs):\d+/i,
    'Error response appears to expose internal server paths'
  );
}
function assertNoServerError(response, description) {
  assert.ok(
    response.status < 500,
    `${description}: received HTTP ${response.status}`
  );
}
function queryPath(path, key, value) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}
test(
  'Input validation security integration suite',
  { skip: !configured },
  async (t) => {
    await t.test('Health endpoint returns a successful status', async () => {
      const response = await send(ROUTES.health, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      assert.ok(
        response.status >= 200 && response.status < 300,
        `Expected a successful health response; received HTTP ${response.status}`
      );
      assertSafeErrorBody(await responseBody(response));
    });
    await t.test('Malformed JSON is rejected safely', async () => {
      const response = await send(ROUTES.applications, {
        method: 'POST',
        headers: makeHeaders(),
        body: '{"application":',
      });
      assertClientError(response, 'Malformed JSON');
      assertSafeErrorBody(await responseBody(response));
    });
    await t.test('JSON primitive roots are handled safely', async () => {
      for (const body of [
        'null',
        'true',
        '42',
        '"unexpected-string"',
      ]) {
        const response = await send(ROUTES.applications, {
          method: 'POST',
          headers: makeHeaders(),
          body,
        });
        assertClientError(response, `JSON root ${body}`);
        assertSafeErrorBody(await responseBody(response));
      }
    });
    await t.test('Empty JSON request body is rejected', async () => {
      const response = await send(ROUTES.applications, {
        method: 'POST',
        headers: makeHeaders(),
        body: '',
      });
      assertClientError(response, 'Empty request body');
      assertSafeErrorBody(await responseBody(response));
    });
    await t.test('Oversized JSON input is rejected safely', async () => {
      const oversizedValue = 'A'.repeat(2 * 1024 * 1024);
      const response = await send(ROUTES.applications, {
        method: 'POST',
        headers: makeHeaders(),
        body: JSON.stringify({ title: oversizedValue }),
      });
      assert.ok(
        [400, 413, 422].includes(response.status),
        `Expected oversized input rejection; received HTTP ${response.status}`
      );
      assertSafeErrorBody(await responseBody(response));
    });
    await t.test('Unknown properties are rejected or safely ignored', async () => {
      const marker = `unknown_${Date.now()}`;
      const response = await send(ROUTES.applications, {
        method: 'POST',
        headers: makeHeaders(),
        body: JSON.stringify({
          title: 'Input validation security test',
          __unexpectedSecurityTestField: marker,
        }),
      });
      assertNoServerError(response, 'Unknown-property request');
      if (response.status >= 400) {
        assertClientError(response, 'Unknown-property request');
        assertSafeErrorBody(await responseBody(response));
      } else {
        // This endpoint may create a record. Do not infer that the
        // unknown field was ignored from the status code alone.
        // Add a read-back assertion using a known test record and
        // the application's real response schema.
        assert.ok(
          response.status < 300,
          `Unexpected response to unknown-property request: ${response.status}`
        );
      }
    });
    await t.test('SQL-injection-like search values do not cause server errors', async () => {
      const probes = [
        "' OR '1'='1",
        "'; DROP TABLE applications; --",
        '" OR 1=1 --',
      ];
      for (const probe of probes) {
        const response = await send(
          queryPath(ROUTES.search, 'q', probe),
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              ...(TOKEN
                ? { Authorization: `Bearer ${TOKEN}` }
                : {}),
            },
          }
        );
        assertNoServerError(response, 'SQL-injection probe');
        assertSafeErrorBody(await responseBody(response));
      }
    });
    await t.test('XSS-like search input is sent and handled safely', async () => {
      const payload = '<script>alert("medorbits-test")</script>';
      const response = await send(
        queryPath(ROUTES.search, 'q', payload),
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(TOKEN
              ? { Authorization: `Bearer ${TOKEN}` }
              : {}),
          },
        }
      );
      assertNoServerError(response, 'XSS search probe');
      const body = await responseBody(response);
      if (typeof body === 'string') {
        assert.ok(
          !body.includes(payload),
          'Search response returned the raw executable markup'
        );
      } else if (body && typeof body === 'object') {
        const serialized = JSON.stringify(body);
        // JSON can legitimately contain text that resembles HTML.
        // The frontend must still render untrusted values as text,
        // not inject them into the DOM as executable markup.
        assert.ok(
          serialized.length < 5_000_000,
          'Unexpectedly large search response'
        );
      }
    });
    await t.test('XSS-like JSON input does not cause a server error', async () => {
      const payload = '<script>alert("medorbits-test")</script>';
      const response = await send(ROUTES.applications, {
        method: 'POST',
        headers: makeHeaders(),
        body: JSON.stringify({ title: payload }),
      });
      assertNoServerError(response, 'XSS JSON input');
      assertSafeErrorBody(await responseBody(response));
    });
    await t.test('Unsupported content type is handled safely', async () => {
      const response = await send(ROUTES.applications, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(TOKEN
            ? { Authorization: `Bearer ${TOKEN}` }
            : {}),
          'Content-Type': 'text/plain',
        },
        body: '{"title":"unexpected-content-type"}',
      });
      assert.ok(
        [400, 403, 404, 405, 415, 422].includes(response.status) ||
          (response.status >= 200 && response.status < 300),
        `Unexpected unsupported-content-type response: HTTP ${response.status}`
      );
      assertSafeErrorBody(await responseBody(response));
    });
    await t.test('Malformed identifiers do not cause server errors', async () => {
      const invalidIds = [
        'undefined',
        'null',
        '-1',
        'not-an-id',
        '%00',
        '..',
      ];
      for (const id of invalidIds) {
        const response = await send(
          `${ROUTES.applications}/${encodeURIComponent(id)}`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              ...(TOKEN
                ? { Authorization: `Bearer ${TOKEN}` }
                : {}),
            },
          }
        );
        assertNoServerError(response, `Invalid identifier ${id}`);
        assertSafeErrorBody(await responseBody(response));
      }
    });
    await t.test('Unsupported HTTP method is rejected safely', async () => {
      const response = await send(ROUTES.search, {
        method: 'TRACE',
        headers: { Accept: 'application/json' },
      });
      assert.ok(
        [400, 404, 405, 501].includes(response.status),
        `Expected unsupported method rejection; received HTTP ${response.status}`
      );
      assertSafeErrorBody(await responseBody(response));
    });
    await t.test('Invalid required fields are rejected', async () => {
      const response = await send(ROUTES.applications, {
        method: 'POST',
        headers: makeHeaders(),
        body: JSON.stringify({
          title: '',
          email: 'invalid-email',
        }),
      });
      assertClientError(response, 'Invalid required fields');
      assertSafeErrorBody(await responseBody(response));
    });
  }
);
test('Input validation test configuration is sane', () => {
  assert.ok(
    Number.isFinite(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'INPUT_VALIDATION_TEST_TIMEOUT_MS must be positive'
  );
  assert.ok(
    Object.values(ROUTES).every(
      (route) => route.startsWith('/') && !route.startsWith('//')
    ),
    'API routes must be relative paths'
  );
});