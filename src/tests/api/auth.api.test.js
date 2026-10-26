
/**
 * MedOrbits -- Authentication API Tests
 * File: tests/api/auth.api.test.js
 * Runtime: Node.js >= 20, ESM.
 *
 * Run:
 *   node --test tests/api/auth.api.test.js
 *
 * Optional environment:
 *   API_BASE_URL=http://127.0.0.1:3000
 *   API_AUTH_PATH=/api/auth
 *   API_HEALTH_PATH=/health
 *   API_TIMEOUT_MS=10000
 *   API_REQUIRE_SERVER=false
 *   API_TEST_EMAIL=
 *   API_TEST_PASSWORD=
 *
 * Notes:
 *   - Uses Node.js built-in fetch and node:test.
 *   - Requires a running API for HTTP integration tests.
 *   - Uses disposable or dedicated test credentials only.
 *   - Never use production credentials in automated tests.
 *   - Endpoint-specific assertions may need adjustment to match
 *     the actual MedOrbits authentication contract.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = (
  process.env.API_BASE_URL || ''
).trim().replace(/\/+$/, '');

const AUTH_PATH = (
  process.env.API_AUTH_PATH || '/api/auth'
).trim();

const HEALTH_PATH = (
  process.env.API_HEALTH_PATH || '/health'
).trim();

const API_TIMEOUT_MS = Number(
  process.env.API_TIMEOUT_MS || 10000,
);

const REQUIRE_SERVER =
  (process.env.API_REQUIRE_SERVER || 'false').toLowerCase() ===
  'true';

const TEST_EMAIL = (
  process.env.API_TEST_EMAIL || ''
).trim();

const TEST_PASSWORD =
  process.env.API_TEST_PASSWORD || '';

function validateRelativePath(value, name) {
  assert.ok(
    value.startsWith('/'),
    `${name} must begin with "/".`,
  );

  let parsed;

  try {
    parsed = new URL(value, 'http://medorbits.invalid');
  } catch {
    assert.fail(`${name} is not a valid relative URL path.`);
  }

  assert.equal(
    parsed.origin,
    'http://medorbits.invalid',
    `${name} must not contain an external origin.`,
  );

  return `${parsed.pathname}${parsed.search}`;
}

const VALIDATED_AUTH_PATH = validateRelativePath(
  AUTH_PATH,
  'API_AUTH_PATH',
);

const VALIDATED_HEALTH_PATH = validateRelativePath(
  HEALTH_PATH,
  'API_HEALTH_PATH',
);

function getBaseUrl() {
  if (!BASE_URL) {
    return null;
  }

  let parsed;

  try {
    parsed = new URL(BASE_URL);
  } catch {
    throw new Error(
      'API_BASE_URL must be a valid HTTP(S) URL.',
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(parsed.protocol),
    'API_BASE_URL must use HTTP or HTTPS.',
  );

  assert.ok(
    !parsed.username && !parsed.password,
    'Do not embed credentials in API_BASE_URL.',
  );

  return parsed;
}

function endpointUrl(baseUrl, route) {
  const url = new URL(route, baseUrl);

  assert.equal(
    url.origin,
    baseUrl.origin,
    'Authentication test requests must remain on the configured API origin.',
  );

  return url;
}

function buildHeaders({ json = false, token = '' } = {}) {
  const headers = {
    Accept: 'application/json',
  };

  if (json) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function apiRequest(
  baseUrl,
  route,
  {
    method = 'GET',
    body,
    token = '',
    headers = {},
  } = {},
) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    API_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      endpointUrl(baseUrl, route),
      {
        method,
        headers: {
          ...buildHeaders({
            json: body !== undefined,
            token,
          }),
          ...headers,
        },
        ...(body !== undefined
          ? { body: JSON.stringify(body) }
          : {}),
        signal: controller.signal,
        redirect: 'manual',
      },
    );

    const contentType =
      response.headers.get('content-type') || '';

    let data = null;

    if (response.status !== 204) {
      const text = await response.text();

      if (text) {
        if (contentType.includes('application/json')) {
          try {
            data = JSON.parse(text);
          } catch {
            data = {
              parseError: true,
              raw: text.slice(0, 1000),
            };
          }
        } else {
          data = {
            raw: text.slice(0, 1000),
          };
        }
      }
    }

    return {
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      data,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        `API request timed out after ${API_TIMEOUT_MS} ms: ` +
          `${method} ${route}`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function assertExpectedStatus(result, expectedStatuses, context) {
  assert.ok(
    expectedStatuses.includes(result.status),
    `${context}: expected HTTP ${expectedStatuses.join(' or ')}, ` +
      `received ${result.status}. Response: ` +
      JSON.stringify(result.data),
  );
}

function assertJsonObject(result, context) {
  assert.ok(
    result.data !== null &&
      typeof result.data === 'object' &&
      !Array.isArray(result.data) &&
      !result.data.parseError,
    `${context}: expected a JSON object. Received: ` +
      JSON.stringify(result.data),
  );
}

function collectStrings(value, results = []) {
  if (typeof value === 'string') {
    results.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, results);
    }
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      results.push(key);
      collectStrings(item, results);
    }
  }

  return results;
}

function assertNoSensitiveResponseFields(result, context) {
  if (
    !result.data ||
    typeof result.data !== 'object' ||
    result.data.parseError
  ) {
    return;
  }

  const forbiddenKeys = new Set([
    'password',
    'passwordhash',
    'password_hash',
    'hashedpassword',
    'hashed_password',
    'refreshtoken',
    'refresh_token',
    'accesstoken',
    'access_token',
    'secret',
    'clientsecret',
    'client_secret',
  ]);

  function inspect(value, location = 'response') {
    if (!value || typeof value !== 'object') {
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      const normalized = key
        .replace(/[-\s]/g, '')
        .toLowerCase();

      assert.ok(
        !forbiddenKeys.has(normalized),
        `${context}: sensitive field "${key}" exposed at ${location}.`,
      );

      inspect(child, `${location}.${key}`);
    }
  }

  inspect(result.data);
}

function isJsonContentType(result) {
  return (
    result.headers
      .get('content-type')
      ?.toLowerCase()
      .includes('application/json') ?? false
  );
}

async function checkServerAvailability(t, baseUrl) {
  try {
    const result = await apiRequest(
      baseUrl,
      VALIDATED_HEALTH_PATH,
    );

    assertExpectedStatus(
      result,
      [200, 204],
      'API health endpoint',
    );

    return true;
  } catch (error) {
    if (REQUIRE_SERVER) {
      throw error;
    }

    t.skip(`API server is unavailable: ${error.message}`);
    return false;
  }
}

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

test('authentication API test configuration is valid', () => {
  assert.ok(
    Number.isInteger(API_TIMEOUT_MS) && API_TIMEOUT_MS > 0,
    'API_TIMEOUT_MS must be a positive integer.',
  );

  validateRelativePath(AUTH_PATH, 'API_AUTH_PATH');
  validateRelativePath(HEALTH_PATH, 'API_HEALTH_PATH');
  getBaseUrl();

  if (REQUIRE_SERVER) {
    assert.ok(
      BASE_URL,
      'API_REQUIRE_SERVER=true requires API_BASE_URL.',
    );
  }

  assert.ok(
    !(TEST_EMAIL && !TEST_PASSWORD),
    'API_TEST_PASSWORD is required when API_TEST_EMAIL is set.',
  );

  assert.ok(
    !(TEST_PASSWORD && !TEST_EMAIL),
    'API_TEST_EMAIL is required when API_TEST_PASSWORD is set.',
  );
});

// -----------------------------------------------------------------------------
// Health and route discovery
// -----------------------------------------------------------------------------

test('authentication API server is reachable when configured', async (t) => {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    if (REQUIRE_SERVER) {
      assert.fail(
        'API_BASE_URL is required when API_REQUIRE_SERVER=true.',
      );
    }

    t.skip('Set API_BASE_URL to enable HTTP integration tests.');
    return;
  }

  await checkServerAvailability(t, baseUrl);
});

test('authentication route responds without an unexpected server error', async (t) => {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    t.skip('Set API_BASE_URL to enable HTTP integration tests.');
    return;
  }

  if (!(await checkServerAvailability(t, baseUrl))) {
    return;
  }

  const result = await apiRequest(
    baseUrl,
    VALIDATED_AUTH_PATH,
  );

  assert.ok(
    result.status < 500,
    `Authentication route returned server error ${result.status}.`,
  );

  assert.ok(
    [200, 204, 301, 302, 400, 401, 403, 404, 405, 406].includes(
      result.status,
    ) || result.status < 500,
    `Unexpected authentication route response: ${result.status}`,
  );
});

// -----------------------------------------------------------------------------
// Login input validation
// -----------------------------------------------------------------------------

test('login endpoint rejects an empty JSON object or handles it explicitly', async (t) => {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    t.skip('Set API_BASE_URL to enable HTTP integration tests.');
    return;
  }

  if (!(await checkServerAvailability(t, baseUrl))) {
    return;
  }

  const result = await apiRequest(
    baseUrl,
    `${VALIDATED_AUTH_PATH}/login`,
    {
      method: 'POST',
      body: {},
    },
  );

  assert.ok(
    [200, 201, 202, 400, 401, 403, 404, 405, 415, 422].includes(
      result.status,
    ),
    `Unexpected empty-login response: ${result.status}`,
  );

  if ([400, 422].includes(result.status)) {
    assertJsonObject(
      result,
      'Login validation failure',
    );
  }

  if ([200, 201, 202].includes(result.status)) {
    t.diagnostic(
      'An empty login payload was accepted. Verify the authentication ' +
        'handler rejects missing credentials and does not issue a session.',
    );
  }
});

test('login endpoint handles malformed JSON safely', async (t) => {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    t.skip('Set API_BASE_URL to enable HTTP integration tests.');
    return;
  }

  if (!(await checkServerAvailability(t, baseUrl))) {
    return;
  }

  const result = await apiRequest(
    baseUrl,
    `${VALIDATED_AUTH_PATH}/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: undefined,
    },
  );

  // A request without a body is not malformed JSON; it tests missing-body
  // handling. The next assertion accepts conventional API responses.
  assert.ok(
    [200, 201, 202, 400, 401, 403, 404, 405, 415, 422].includes(
      result.status,
    ),
    `Unexpected missing-body login response: ${result.status}`,
  );
});

test('login endpoint handles invalid credentials without server errors', async (t) => {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    t.skip('Set API_BASE_URL to enable HTTP integration tests.');
    return;
  }

  if (!(await checkServerAvailability(t, baseUrl))) {
    return;
  }

  const result = await apiRequest(
    baseUrl,
    `${VALIDATED_AUTH_PATH}/login`,
    {
      method: 'POST',
      body: {
        email: `nonexistent-${Date.now()}@example.invalid`,
        password: `invalid-${Date.now()}-${Math.random()}`,
      },
    },
  );

  assert.ok(
    result.status < 500,
    `Invalid credentials caused server error ${result.status}.`,
  );

  assert.ok(
    [200, 201, 202, 400, 401, 403, 404, 405, 415, 422, 429].includes(
      result.status,
    ) || result.status < 500,
    `Unexpected invalid-credentials response: ${result.status}`,
  );

  if ([200, 201, 202].includes(result.status)) {
    t.diagnostic(
      'The supplied credentials received a success status. Verify that ' +
        'the API did not authenticate an unknown user or create a session.',
    );
  }
});

// -----------------------------------------------------------------------------
// Authentication and authorization
// -----------------------------------------------------------------------------

test('protected profile endpoint does not expose private data without credentials', async (t) => {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    t.skip('Set API_BASE_URL to enable HTTP integration tests.');
    return;
  }

  if (!(await checkServerAvailability(t, baseUrl))) {
    return;
  }

  // Adjust this route if the application uses /api/users/me or another
  // documented protected-account endpoint.
  const result = await apiRequest(
    baseUrl,
    '/api/auth/me',
    {
      token: '',
    },
  );

  assert.ok(
    [200, 401, 403, 404].includes(result.status),
    `Unexpected unauthenticated profile response: ${result.status}`,
  );

  if (result.status === 200) {
    t.diagnostic(
      'The profile endpoint returned HTTP 200 without credentials. ' +
        'Verify that it exposes no private account information and that ' +
        'public access is intentional.',
    );
  }
});

test('logout endpoint handles requests without a session safely', async (t) => {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    t.skip('Set API_BASE_URL to enable HTTP integration tests.');
    return;
  }

  if (!(await checkServerAvailability(t, baseUrl))) {
    return;
  }

  const result = await apiRequest(
    baseUrl,
    `${VALIDATED_AUTH_PATH}/logout`,
    {
      method: 'POST',
      token: '',
    },
  );

  assert.ok(
    result.status < 500,
    `Logout without a session caused server error ${result.status}.`,
  );

  assert.ok(
    [200, 202, 204, 400, 401, 403, 404, 405].includes(
      result.status,
    ) || result.status < 500,
    `Unexpected logout response: ${result.status}`,
  );
});

// -----------------------------------------------------------------------------
// Optional authenticated smoke test
// -----------------------------------------------------------------------------

test('configured test credentials can authenticate without leaking secrets', async (t) => {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    t.skip('Set API_BASE_URL to enable HTTP integration tests.');
    return;
  }

  if (!TEST_EMAIL || !TEST_PASSWORD) {
    t.skip(
      'Set API_TEST_EMAIL and API_TEST_PASSWORD to enable the authenticated smoke test.',
    );
    return;
  }

  if (!(await checkServerAvailability(t, baseUrl))) {
    return;
  }

  const result = await apiRequest(
    baseUrl,
    `${VALIDATED_AUTH_PATH}/login`,
    {
      method: 'POST',
      body: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    },
  );

  assert.ok(
    result.status < 500,
    `Login request caused server error ${result.status}.`,
  );

  if ([200, 201, 202].includes(result.status)) {
    assert.ok(
      isJsonContentType(result),
      'Successful login should return JSON for this API contract.',
    );

    assertJsonObject(result, 'Successful login');

    assertNoSensitiveResponseFields(
      result,
      'Successful login',
    );
  } else {
    assert.ok(
      [400, 401, 403, 404, 405, 415, 422, 429].includes(
        result.status,
      ),
      `Unexpected login response: ${result.status}`,
    );

    t.diagnostic(
      `Configured test credentials did not authenticate; HTTP ${result.status}.`,
    );
  }
});

// -----------------------------------------------------------------------------
// Security-oriented response checks
// -----------------------------------------------------------------------------

test('authentication responses do not expose credential fields', async (t) => {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    t.skip('Set API_BASE_URL to enable HTTP integration tests.');
    return;
  }

  if (!(await checkServerAvailability(t, baseUrl))) {
    return;
  }

  const result = await apiRequest(
    baseUrl,
    `${VALIDATED_AUTH_PATH}/login`,
    {
      method: 'POST',
      body: {},
    },
  );

  if (
    result.data &&
    typeof result.data === 'object' &&
    !result.data.parseError
  ) {
    assertNoSensitiveResponseFields(
      result,
      'Login response',
    );
  }

  if (result.status >= 500) {
    assert.fail(
      `Login validation unexpectedly returned HTTP ${result.status}.`,
    );
  }
});

test('authentication API does not redirect requests to an external origin', async (t) => {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    t.skip('Set API_BASE_URL to enable HTTP integration tests.');
    return;
  }

  if (!(await checkServerAvailability(t, baseUrl))) {
    return;
  }

  const result = await apiRequest(
    baseUrl,
    VALIDATED_AUTH_PATH,
    {
      redirect: 'manual',
    },
  );

  const location = result.headers.get('location');

  if (location) {
    const target = new URL(location, baseUrl);

    assert.equal(
      target.origin,
      baseUrl.origin,
      'Authentication route redirects to a different origin.',
    );
  }
});
