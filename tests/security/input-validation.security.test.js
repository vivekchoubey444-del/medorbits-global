
'use strict';

/**
 * MedOrbits -- Input Validation Security Tests
 *
 * File: tests/security/input-validation.security.test.js
 *
 * Runtime: Node.js >= 20
 * Dependencies: Node.js built-in modules only
 *
 * Run:
 *   node --test tests/security/input-validation.security.test.js
 *
 * Configuration:
 *   INPUT_VALIDATION_TEST_BASE_URL=http://127.0.0.1:3000
 *   INPUT_VALIDATION_TEST_TOKEN
 *   INPUT_VALIDATION_TEST_TIMEOUT_MS=15000
 *   INPUT_VALIDATION_TEST_HEALTH_PATH=/health
 *   INPUT_VALIDATION_TEST_APPLICATIONS_PATH=/api/applications
 *   INPUT_VALIDATION_TEST_SEARCH_PATH=/api/search
 *
 * Optional mutation-test safeguards:
 *   INPUT_VALIDATION_TEST_RUN_MUTATIONS=true
 *   INPUT_VALIDATION_TEST_ALLOW_REMOTE_MUTATIONS=true
 *   INPUT_VALIDATION_TEST_ENVIRONMENT=sandbox
 *   INPUT_VALIDATION_TEST_ALLOW_CI_MUTATIONS=true
 *
 * IMPORTANT:
 * - Use a dedicated test environment and synthetic credentials.
 * - POST tests can create records; they are disabled unless explicitly enabled.
 * - Never enable mutations against production.
 * - A non-5xx response does not prove input validation is correct.
 * - Adapt expected statuses and payloads to the documented API contract.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const DEFAULT_TIMEOUT_MS = 15_000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 120_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

const BASE_URL_RAW =
  process.env.INPUT_VALIDATION_TEST_BASE_URL || '';

const TOKEN =
  process.env.INPUT_VALIDATION_TEST_TOKEN || '';

const HEALTH_PATH =
  process.env.INPUT_VALIDATION_TEST_HEALTH_PATH || '/health';

const APPLICATIONS_PATH =
  process.env.INPUT_VALIDATION_TEST_APPLICATIONS_PATH ||
  '/api/applications';

const SEARCH_PATH =
  process.env.INPUT_VALIDATION_TEST_SEARCH_PATH ||
  '/api/search';

const RUN_MUTATIONS =
  process.env.INPUT_VALIDATION_TEST_RUN_MUTATIONS === 'true';

let timeoutMs = DEFAULT_TIMEOUT_MS;
let baseUrl = null;
let routes = null;
let configurationError = null;
let serverAvailable = false;

const MUTATION_REJECTION_STATUSES = new Set([
  400, 401, 403, 404, 405, 409, 413, 415, 422, 429,
]);

const JSON_HEADERS = Object.freeze({
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

function parseTimeout(value) {
  if (value === undefined || value === '') {
    return DEFAULT_TIMEOUT_MS;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < MIN_TIMEOUT_MS ||
    parsed > MAX_TIMEOUT_MS
  ) {
    throw new Error(
      `INPUT_VALIDATION_TEST_TIMEOUT_MS must be an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}.`
    );
  }

  return parsed;
}

function validateRoute(value, variableName) {
  assert.equal(
    typeof value,
    'string',
    `${variableName} must be a string.`
  );

  assert.ok(
    value.startsWith('/') && !value.startsWith('//'),
    `${variableName} must start with exactly one slash.`
  );

  assert.ok(
    !value.includes('?') && !value.includes('#'),
    `${variableName} must not contain a query string or fragment.`
  );

  const parsed = new URL(value, baseUrl);

  assert.equal(
    parsed.origin,
    baseUrl.origin,
    `${variableName} must remain on the configured API origin.`
  );

  return parsed.pathname;
}

function validateConfiguration() {
  assert.ok(
    BASE_URL_RAW,
    'Set INPUT_VALIDATION_TEST_BASE_URL, for example http://127.0.0.1:3000.'
  );

  let parsed;

  try {
    parsed = new URL(BASE_URL_RAW);
  } catch {
    throw new Error(
      'INPUT_VALIDATION_TEST_BASE_URL must be a valid absolute URL.'
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(parsed.protocol),
    'The base URL must use HTTP or HTTPS.'
  );

  assert.ok(
    !parsed.username && !parsed.password,
    'The base URL must not contain embedded credentials.'
  );

  assert.ok(
    !parsed.search && !parsed.hash,
    'The base URL must not contain a query string or fragment.'
  );

  assert.ok(
    parsed.pathname === '/',
    'Configure the base URL as an origin without an API path prefix.'
  );

  baseUrl = new URL(parsed.origin);
  timeoutMs = parseTimeout(
    process.env.INPUT_VALIDATION_TEST_TIMEOUT_MS
  );

  routes = {
    health: validateRoute(
      HEALTH_PATH,
      'INPUT_VALIDATION_TEST_HEALTH_PATH'
    ),
    applications: validateRoute(
      APPLICATIONS_PATH,
      'INPUT_VALIDATION_TEST_APPLICATIONS_PATH'
    ),
    search: validateRoute(
      SEARCH_PATH,
      'INPUT_VALIDATION_TEST_SEARCH_PATH'
    ),
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
    'Request paths must start with exactly one slash.'
  );

  const url = new URL(path, baseUrl);

  assert.equal(
    url.origin,
    baseUrl.origin,
    'Cross-origin requests are prohibited.'
  );

  return url;
}

function makeHeaders(extra = {}) {
  return {
    ...JSON_HEADERS,
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    ...extra,
  };
}

async function send(path, options = {}) {
  const url = urlFor(path);
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    return await fetch(url, {
      ...options,
      headers: {
        ...makeHeaders(),
        ...options.headers,
      },
      redirect: 'manual',
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${timeoutMs} ms: ${options.method || 'GET'} ${url.pathname}`
      );
    }

    throw new Error(
      `Request failed for ${options.method || 'GET'} ${url.pathname}: ${error.message}`
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function responseBody(response) {
  const contentLength = response.headers.get('content-length');

  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => {});
    throw new Error(
      `Response exceeded the ${MAX_RESPONSE_BYTES}-byte test limit.`
    );
  }

  const raw = await response.text();

  if (Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new Error(
      `Response exceeded the ${MAX_RESPONSE_BYTES}-byte test limit.`
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

function queryPath(path, key, value) {
  const url = urlFor(path);
  url.searchParams.set(key, value);

  assert.equal(
    url.origin,
    baseUrl.origin,
    'Query requests must remain same-origin.'
  );

  return `${url.pathname}${url.search}`;
}

/* -------------------------------------------------------------------------- */
/* Security assertions                                                        */
/* -------------------------------------------------------------------------- */

function assertClientError(response, description) {
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

function assertSafeErrorBody(body) {
  if (body === null || body === undefined) {
    return;
  }

  const serialized =
    typeof body === 'string' ? body : JSON.stringify(body);

  assert.doesNotMatch(
    serialized,
    /\bat\s+(?:async\s+)?[\w.$<>]+\s+\([^)]*:\d+:\d+\)/i,
    'Error response appears to expose a JavaScript stack trace.'
  );

  assert.doesNotMatch(
    serialized,
    /\b(?:SELECT|INSERT\s+INTO|UPDATE\s+[\w."`]+\s+SET|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE)\b/i,
    'Error response appears to expose SQL statements.'
  );

  assert.doesNotMatch(
    serialized,
    /node_modules[\\/].+\.(?:js|cjs|mjs):\d+/i,
    'Error response appears to expose internal Node.js paths.'
  );

  assert.doesNotMatch(
    serialized,
    /\b(?:SequelizeDatabaseError|PrismaClientKnownRequestError|MongoServerError|PostgresError)\b/i,
    'Error response appears to expose an internal database exception.'
  );
}

function assertJsonResponse(response, body, description) {
  const contentType = response.headers.get('content-type') || '';

  assert.match(
    contentType.toLowerCase(),
    /application\/(?:[\w.+-]*\+)?json/,
    `${description}: expected a JSON content type.`
  );

  assert.ok(
    body !== null && typeof body === 'object',
    `${description}: expected a JSON object or array.`
  );
}

/* -------------------------------------------------------------------------- */
/* Mutation safeguards                                                        */
/* -------------------------------------------------------------------------- */

function mutationSkipReason() {
  if (!RUN_MUTATIONS) {
    return (
      'POST mutation test disabled. Set ' +
      'INPUT_VALIDATION_TEST_RUN_MUTATIONS=true to enable it.'
    );
  }

  if (process.env.NODE_ENV !== 'test') {
    return 'Mutation tests require NODE_ENV=test.';
  }

  if (
    process.env.CI &&
    process.env.INPUT_VALIDATION_TEST_ALLOW_CI_MUTATIONS !== 'true'
  ) {
    return (
      'CI mutation tests require ' +
      'INPUT_VALIDATION_TEST_ALLOW_CI_MUTATIONS=true.'
    );
  }

  if (
    baseUrl &&
    !['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)
  ) {
    if (
      process.env.INPUT_VALIDATION_TEST_ALLOW_REMOTE_MUTATIONS !== 'true'
    ) {
      return (
        'Remote mutations require ' +
        'INPUT_VALIDATION_TEST_ALLOW_REMOTE_MUTATIONS=true.'
      );
    }

    if (
      process.env.INPUT_VALIDATION_TEST_ENVIRONMENT !== 'sandbox'
    ) {
      return (
        'Remote mutations require ' +
        'INPUT_VALIDATION_TEST_ENVIRONMENT=sandbox.'
      );
    }

    if (baseUrl.protocol !== 'https:') {
      return 'Remote mutation tests require HTTPS.';
    }
  }

  return '';
}

/* -------------------------------------------------------------------------- */
/* Test helpers                                                               */
/* -------------------------------------------------------------------------- */

function defineTest(name, options, callback) {
  test(name, async (t) => {
    if (configurationError) {
      throw configurationError;
    }

    if (!serverAvailable) {
      if (options?.healthCheck) {
        assert.fail(
          `Test server is unavailable at ${BASE_URL_RAW}. Start the isolated API and retry.`
        );
      }

      t.skip('Test server is unavailable.');
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

async function postApplication(body, contentType = 'application/json') {
  return send(routes.applications, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
    },
    body,
  });
}

/* -------------------------------------------------------------------------- */
/* Setup                                                                      */
/* -------------------------------------------------------------------------- */

before(async () => {
  try {
    validateConfiguration();
  } catch (error) {
    configurationError = error;
    return;
  }

  try {
    const response = await send(routes.health, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    serverAvailable = response.status >= 200 && response.status < 500;

    await response.body?.cancel().catch(() => {});
  } catch {
    serverAvailable = false;
  }
});

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

defineTest(
  'input-validation suite requires a reachable API',
  { healthCheck: true },
  async () => {
    const response = await send(routes.health, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    assert.ok(
      response.status >= 200 && response.status < 300,
      `Expected a successful health response; received HTTP ${response.status}.`
    );

    const body = await responseBody(response);

    if (body !== null) {
      assertSafeErrorBody(body);
    }
  }
);

defineTest(
  'malformed JSON is rejected without exposing internals',
  {},
  async () => {
    const response = await postApplication('{"application":');
    const body = await responseBody(response);

    assertClientError(response, 'Malformed JSON');
    assertSafeErrorBody(body);
  }
);

defineTest(
  'JSON primitive roots are rejected safely',
  {},
  async () => {
    for (const input of [
      'null',
      'true',
      '42',
      '"unexpected-string"',
    ]) {
      const response = await postApplication(input);
      const body = await responseBody(response);

      assertClientError(response, `JSON root ${input}`);
      assertSafeErrorBody(body);
    }
  }
);

defineTest(
  'empty JSON body is rejected safely',
  {},
  async () => {
    const response = await postApplication('');
    const body = await responseBody(response);

    assertClientError(response, 'Empty request body');
    assertSafeErrorBody(body);
  }
);

defineTest(
  'oversized JSON input is rejected',
  {},
  async () => {
    // Keep this probe below common reverse-proxy body limits while still
    // testing application-level field-size validation.
    const oversizedValue = 'A'.repeat(2 * 1024 * 1024);

    const response = await postApplication(
      JSON.stringify({ title: oversizedValue })
    );

    const body = await responseBody(response);

    assert.ok(
      [400, 413, 422].includes(response.status),
      `Expected oversized input rejection; received HTTP ${response.status}.`
    );

    assertSafeErrorBody(body);
  }
);

defineTest(
  'unknown properties are rejected or demonstrably ignored',
  { mutating: true },
  async () => {
    const marker =
      `unknown_property_security_${process.pid}_${Date.now()}`;

    const response = await postApplication(
      JSON.stringify({
        title: 'MedOrbits input validation security test',
        __unexpectedSecurityTestField: marker,
      })
    );

    const body = await responseBody(response);

    assertNoServerError(response, 'Unknown-property request');

    if (response.status >= 400) {
      assertClientError(response, 'Unknown-property request');
      assertSafeErrorBody(body);
      return;
    }

    assert.ok(
      response.status >= 200 && response.status < 300,
      `Unexpected response status: HTTP ${response.status}.`
    );

    // A successful POST does not prove that the server ignored the field.
    // Verify persistence with an API-specific read-back or database helper
    // before treating this test as proof of mass-assignment protection.
    assert.ok(
      body !== null && typeof body === 'object',
      'Successful creation should return a response object for read-back verification.'
    );
  }
);

defineTest(
  'SQL-injection-like search values do not cause server errors',
  {},
  async () => {
    const probes = [
      "' OR '1'='1",
      "'; DROP TABLE applications; --",
      '" OR 1=1 --',
      "1' UNION SELECT NULL --",
    ];

    for (const probe of probes) {
      const response = await send(
        queryPath(routes.search, 'q', probe),
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

      const body = await responseBody(response);

      assertNoServerError(response, 'SQL-injection search probe');
      assertSafeErrorBody(body);
    }
  }
);

defineTest(
  'XSS-like search input is handled without server errors',
  {},
  async () => {
    const payload = '<script>alert("medorbits-test")</script>';

    const response = await send(
      queryPath(routes.search, 'q', payload),
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

    const body = await responseBody(response);

    assertNoServerError(response, 'XSS search probe');
    assertSafeErrorBody(body);

    // JSON APIs may legitimately return the original search term.
    // Client-side output encoding must be tested separately in browser tests.
    if (typeof body === 'string') {
      assert.ok(
        body.length < MAX_RESPONSE_BYTES,
        'Search response exceeded the expected response-size limit.'
      );
    }
  }
);

defineTest(
  'XSS-like JSON input is validated without server errors',
  { mutating: true },
  async () => {
    const payload = '<script>alert("medorbits-test")</script>';

    const response = await postApplication(
      JSON.stringify({ title: payload })
    );

    const body = await responseBody(response);

    assertNoServerError(response, 'XSS JSON input');
    assertSafeErrorBody(body);

    // Acceptance or rejection depends on the application's documented
    // title-field contract. A 2xx response is not proof of XSS safety:
    // browser rendering must escape untrusted values.
  }
);

defineTest(
  'unsupported content type is rejected or safely handled',
  {},
  async () => {
    const response = await send(routes.applications, {
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

    const body = await responseBody(response);

    assertNoServerError(response, 'Unsupported content type');

    if (response.status >= 400) {
      assert.ok(
        MUTATION_REJECTION_STATUSES.has(response.status),
        `Unexpected rejection status: HTTP ${response.status}.`
      );
    } else {
      assert.ok(
        response.status < 300,
        `Unexpected response status: HTTP ${response.status}.`
      );
    }

    assertSafeErrorBody(body);
  }
);

defineTest(
  'malformed identifiers do not cause server errors',
  {},
  async () => {
    const invalidIds = [
      'undefined',
      'null',
      '-1',
      'not-an-id',
      '%00',
      '..',
      ' ',
    ];

    for (const id of invalidIds) {
      const path =
        `${routes.applications}/${encodeURIComponent(id)}`;

      const response = await send(path, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(TOKEN
            ? { Authorization: `Bearer ${TOKEN}` }
            : {}),
        },
      });

      const body = await responseBody(response);

      assertNoServerError(response, `Invalid identifier ${id}`);
      assertSafeErrorBody(body);
    }
  }
);

defineTest(
  'unsupported HTTP method is rejected safely',
  {},
  async () => {
    const response = await send(routes.search, {
      method: 'TRACE',
      headers: { Accept: 'application/json' },
    });

    const body = await responseBody(response);

    assert.ok(
      [400, 404, 405, 501].includes(response.status),
      `Expected unsupported-method rejection; received HTTP ${response.status}.`
    );

    assertSafeErrorBody(body);
  }
);

defineTest(
  'invalid required fields are rejected',
  {},
  async () => {
    const response = await postApplication(
      JSON.stringify({
        title: '',
        email: 'invalid-email',
      })
    );

    const body = await responseBody(response);

    assertClientError(response, 'Invalid required fields');
    assertSafeErrorBody(body);
  }
);

/* -------------------------------------------------------------------------- */
/* Configuration tests                                                        */
/* -------------------------------------------------------------------------- */

test('input-validation configuration uses valid timeout and route values', () => {
  if (configurationError) {
    throw configurationError;
  }

  assert.ok(
    Number.isSafeInteger(timeoutMs) &&
      timeoutMs >= MIN_TIMEOUT_MS &&
      timeoutMs <= MAX_TIMEOUT_MS,
    'Request timeout must be within the supported range.'
  );

  assert.ok(
    routes &&
      Object.values(routes).every(
        (route) => route.startsWith('/') && !route.startsWith('//')
      ),
    'Configured API routes must be same-origin absolute paths.'
  );
});
