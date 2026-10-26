
'use strict';

/**
 * MedOrbits -- Authentication Security Tests
 *
 * File: tests/security/authentication.security.test.js
 * Runtime: Node.js >= 20
 * Runner: node:test
 *
 * Run:
 *   node --test tests/security/authentication.security.test.js
 *
 * Optional environment variables:
 *   E2E_BASE_URL=http://127.0.0.1:3000
 *   E2E_LOGIN_PATH=/api/auth/login
 *   E2E_REGISTER_PATH=/api/auth/register
 *   E2E_ME_PATH=/api/auth/me
 *   E2E_LOGOUT_PATH=/api/auth/logout
 *   E2E_STUDENT_EMAIL=student001@example.test
 *   E2E_STUDENT_PASSWORD=TestOnly!Password123
 *   E2E_INVALID_LOGIN_EMAIL=unknown-user@example.test
 *   E2E_REQUEST_TIMEOUT_MS=10000
 *   E2E_RUN_MUTATING_TESTS=true
 *   E2E_ALLOW_REMOTE_MUTATIONS=true
 *
 * SAFETY:
 * - Use synthetic accounts and an isolated test environment.
 * - Registration tests are opt-in because they create accounts.
 * - Mutations require NODE_ENV=test.
 * - Remote mutations require explicit opt-in and a sandbox designation.
 * - Never run destructive tests against production.
 *
 * Compatibility:
 * - Uses Node.js built-in test runner and global fetch.
 * - Preserves the existing E2E_* configuration names and route defaults.
 * - Adapt payloads and response expectations to the actual API contract.
 */

const {
  test,
  before,
} = require('node:test');

const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const RAW_BASE_URL =
  process.env.E2E_BASE_URL ||
  'http://127.0.0.1:3000';

const LOGIN_PATH =
  process.env.E2E_LOGIN_PATH ||
  '/api/auth/login';

const REGISTER_PATH =
  process.env.E2E_REGISTER_PATH ||
  '/api/auth/register';

const ME_PATH =
  process.env.E2E_ME_PATH ||
  '/api/auth/me';

const LOGOUT_PATH =
  process.env.E2E_LOGOUT_PATH ||
  '/api/auth/logout';

const STUDENT_EMAIL =
  process.env.E2E_STUDENT_EMAIL ||
  'student001@example.test';

const STUDENT_PASSWORD =
  process.env.E2E_STUDENT_PASSWORD ||
  'TestOnly!Password123';

const INVALID_LOGIN_EMAIL =
  process.env.E2E_INVALID_LOGIN_EMAIL ||
  'unknown-user@example.test';

const REQUEST_TIMEOUT_MS = Number(
  process.env.E2E_REQUEST_TIMEOUT_MS || 10000
);

const RUN_MUTATING_TESTS =
  process.env.E2E_RUN_MUTATING_TESTS === 'true';

const ALLOW_REMOTE_MUTATIONS =
  process.env.E2E_ALLOW_REMOTE_MUTATIONS === 'true';

const JSON_HEADERS = Object.freeze({
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

const AUTH_REJECTION_STATUSES = [
  400,
  401,
  403,
  404,
  409,
  422,
  429,
];

const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'passwordhash',
  'hashedpassword',
  'passwd',
  'passphrase',
  'secret',
  'clientsecret',
  'clientsecretkey',
  'secretaccesskey',
  'privatekey',
  'privatekeypem',
  'webhooksecret',
  'webhooksigningsecret',
  'databaseurl',
  'connectionstring',
  'mfaSecret',
  'totpsecret',
  'recoverycodes',
  'recoverycode',
  'resettoken',
  'passwordresettoken',
  'emailverificationtoken',
]);

const INTERNAL_DISCLOSURE_PATTERNS = [
  /\bSELECT\b[\s\S]{0,300}\bFROM\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\b[\s\S]{0,300}\bSET\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bSequelizeDatabaseError\b/i,
  /\bPrismaClientKnownRequestError\b/i,
  /\bMongoServerError\b/i,
  /\bSQLSTATE\b/i,
  /\bECONNREFUSED\b/i,
  /\bDATABASE_URL\b/i,
  /\/node_modules\//i,
  /\bat\s+\S+\s+\([^)]*:\d+:\d+\)/i,
];

let baseUrl;
let serverAvailable = false;
let serverProbeError = null;

function isObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function normalizeKey(key) {
  return String(key)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isLoopbackHostname(hostname) {
  return [
    'localhost',
    '127.0.0.1',
    '::1',
    '[::1]',
  ].includes(String(hostname).toLowerCase());
}

function validatePath(path, name) {
  assert.equal(
    typeof path,
    'string',
    `${name} must be a string.`
  );

  assert.ok(
    path.startsWith('/') && !path.startsWith('//'),
    `${name} must start with exactly one slash.`
  );

  assert.ok(
    !/[\\\r\n\t\0]/.test(path),
    `${name} must not contain backslashes or control characters.`
  );

  assert.ok(
    !path.includes('#'),
    `${name} must not contain a URL fragment.`
  );

  assert.ok(
    !/%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(path),
    `${name} must not contain URL-encoded control characters.`
  );

  let resolved;

  try {
    resolved = new URL(path, baseUrl);
  } catch {
    assert.fail(`${name} is not a valid URL path.`);
  }

  assert.equal(
    resolved.origin,
    baseUrl.origin,
    `${name} must resolve to the configured API origin.`
  );
}

function validateConfiguration() {
  try {
    baseUrl = new URL(RAW_BASE_URL);
  } catch {
    assert.fail(
      'E2E_BASE_URL must be a valid absolute URL.'
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(baseUrl.protocol),
    'E2E_BASE_URL must use HTTP or HTTPS.'
  );

  assert.equal(
    baseUrl.username,
    '',
    'E2E_BASE_URL must not contain URL credentials.'
  );

  assert.equal(
    baseUrl.password,
    '',
    'E2E_BASE_URL must not contain URL credentials.'
  );

  assert.equal(
    baseUrl.search,
    '',
    'E2E_BASE_URL must not contain a query string.'
  );

  assert.equal(
    baseUrl.hash,
    '',
    'E2E_BASE_URL must not contain a URL fragment.'
  );

  assert.ok(
    Number.isSafeInteger(REQUEST_TIMEOUT_MS) &&
      REQUEST_TIMEOUT_MS > 0,
    'E2E_REQUEST_TIMEOUT_MS must be a positive safe integer.'
  );

  for (const [name, path] of Object.entries({
    E2E_LOGIN_PATH: LOGIN_PATH,
    E2E_REGISTER_PATH: REGISTER_PATH,
    E2E_ME_PATH: ME_PATH,
    E2E_LOGOUT_PATH: LOGOUT_PATH,
  })) {
    validatePath(path, name);
  }

  if (RUN_MUTATING_TESTS) {
    assert.equal(
      process.env.NODE_ENV,
      'test',
      'Authentication mutation tests require NODE_ENV=test.'
    );

    if (!isLoopbackHostname(baseUrl.hostname)) {
      assert.equal(
        ALLOW_REMOTE_MUTATIONS,
        true,
        'Remote mutations are blocked. Explicitly enable remote sandbox mutations to continue.'
      );

      assert.equal(
        process.env.E2E_TEST_ENVIRONMENT,
        'sandbox',
        'Remote mutations require E2E_TEST_ENVIRONMENT=sandbox.'
      );

      assert.equal(
        baseUrl.protocol,
        'https:',
        'Remote mutation tests must use HTTPS.'
      );
    }

    if (process.env.CI === 'true') {
      assert.equal(
        process.env.E2E_ALLOW_CI_MUTATIONS,
        'true',
        'CI mutation tests require E2E_ALLOW_CI_MUTATIONS=true.'
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
    'Requests must use origin-relative paths.'
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

async function request(path, options = {}) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  const headers = {
    Accept: 'application/json',
    ...(options.body !== undefined
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(options.headers || {}),
  };

  try {
    return await fetch(urlFor(path), {
      ...options,
      headers,
      signal: controller.signal,
      redirect: 'manual',
    });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${REQUEST_TIMEOUT_MS}ms: ` +
          `${options.method || 'GET'} ${path}`
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function jsonBody(value) {
  return JSON.stringify(value);
}

async function readJson(response) {
  const contentType =
    response.headers.get('content-type') || '';

  if (
    !contentType.toLowerCase().includes('application/json') &&
    !contentType.toLowerCase().includes('+json')
  ) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function readResponseBody(response) {
  const contentType =
    response.headers.get('content-type') || '';

  if (
    contentType.toLowerCase().includes('application/json') ||
    contentType.toLowerCase().includes('+json')
  ) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

function assertAuthenticationRejected(response, label = 'Authentication request') {
  assert.ok(
    AUTH_REJECTION_STATUSES.includes(response.status),
    `${label}: expected a validation, authentication, or rate-limit rejection; ` +
      `received HTTP ${response.status}.`
  );
}

function assertNoServerError(response, label) {
  assert.ok(
    response.status >= 200 && response.status < 500,
    `${label}: unexpected HTTP ${response.status}.`
  );
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }

  const cookie = response.headers.get('set-cookie');

  return cookie ? [cookie] : [];
}

function assertNoSensitiveFields(
  body,
  {
    allowAccessTokens = false,
  } = {}
) {
  const seen = new WeakSet();

  function inspect(value, path = '$') {
    if (value === null || typeof value !== 'object') {
      return;
    }

    assert.equal(
      seen.has(value),
      false,
      `Circular response object encountered at ${path}.`
    );

    seen.add(value);

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        inspect(item, `${path}[${index}]`);
      });

      seen.delete(value);
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      const normalized = normalizeKey(key);

      const isAccessToken =
        normalized === 'accesstoken' ||
        normalized === 'token';

      if (!(allowAccessTokens && isAccessToken)) {
        assert.equal(
          SENSITIVE_FIELD_NAMES.has(normalized),
          false,
          `Sensitive field "${path}.${key}" must not be exposed.`
        );
      }

      // Refresh tokens remain prohibited in JSON responses.
      assert.notEqual(
        normalized,
        'refreshtoken',
        `Refresh token "${path}.${key}" must not be exposed in JSON.`
      );

      inspect(child, `${path}.${key}`);
    }

    seen.delete(value);
  }

  inspect(body);
}

function assertSafeErrorBody(body, label = 'Error response') {
  assertNoSensitiveFields(body);

  const serialized =
    typeof body === 'string'
      ? body
      : JSON.stringify(body ?? '');

  for (const pattern of INTERNAL_DISCLOSURE_PATTERNS) {
    assert.equal(
      pattern.test(serialized),
      false,
      `${label} may disclose internal details matching ${pattern}.`
    );
  }
}

function extractAccount(body) {
  if (!isObject(body)) {
    return null;
  }

  for (const key of [
    'user',
    'account',
    'student',
    'profile',
  ]) {
    if (isObject(body[key])) {
      return body[key];
    }
  }

  if (isObject(body.data)) {
    for (const key of [
      'user',
      'account',
      'student',
      'profile',
    ]) {
      if (isObject(body.data[key])) {
        return body.data[key];
      }
    }

    return body.data;
  }

  return body;
}

function assertNoAdministratorEscalation(body, label) {
  const account = extractAccount(body);

  if (!isObject(account)) {
    return;
  }

  assert.notEqual(
    account.role,
    'super_admin',
    `${label} must not grant the super_admin role.`
  );

  assert.notEqual(
    account.role,
    'admin',
    `${label} must not grant the admin role to a public registrant.`
  );

  assert.notEqual(
    account.isAdmin,
    true,
    `${label} must not grant administrator privileges.`
  );

  assert.notEqual(
    account.is_admin,
    true,
    `${label} must not grant administrator privileges.`
  );

  if (Array.isArray(account.permissions)) {
    assert.equal(
      account.permissions.includes('*'),
      false,
      `${label} must not grant wildcard permissions.`
    );

    assert.equal(
      account.permissions.includes('admin'),
      false,
      `${label} must not grant admin permissions.`
    );
  }
}

function requireMutationOptIn() {
  assert.equal(
    RUN_MUTATING_TESTS,
    true,
    'Set E2E_RUN_MUTATING_TESTS=true only for an isolated test environment.'
  );

  assert.equal(
    process.env.NODE_ENV,
    'test',
    'Authentication mutation tests require NODE_ENV=test.'
  );
}

function uniqueTestEmail() {
  return `security-${crypto.randomUUID()}@example.test`;
}

before(async () => {
  validateConfiguration();

  try {
    const response = await fetch(urlFor('/'), {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: 'manual',
      headers: {
        Accept: 'application/json',
      },
    });

    // A 404 or 401 still demonstrates that an HTTP server is reachable.
    serverAvailable = response.status < 500;

    if (!serverAvailable) {
      serverProbeError =
        `The root endpoint returned HTTP ${response.status}.`;
    }

    // Consume the response body where possible.
    try {
      await response.body?.cancel();
    } catch {
      // The reachability result does not depend on body consumption.
    }
  } catch (error) {
    serverAvailable = false;
    serverProbeError =
      error && error.message
        ? error.message
        : 'Unknown connection error.';
  }
});

test('authentication security suite requires a reachable test server', () => {
  assert.ok(
    serverAvailable,
    `Test server is unavailable at ${RAW_BASE_URL}. ` +
      `Start the isolated test server and verify E2E_BASE_URL. ` +
      `Details: ${serverProbeError || 'No additional details.'}`
  );
});

test('login rejects missing credentials', {
  skip: !serverAvailable,
}, async () => {
  const response = await request(LOGIN_PATH, {
    method: 'POST',
    body: jsonBody({}),
  });

  assertAuthenticationRejected(
    response,
    'Login with missing credentials'
  );

  const body = await readResponseBody(response);
  assertSafeErrorBody(body, 'Missing-credentials response');
});

test('login rejects an invalid password without exposing internals', {
  skip: !serverAvailable,
}, async () => {
  const response = await request(LOGIN_PATH, {
    method: 'POST',
    body: jsonBody({
      email: STUDENT_EMAIL,
      password: 'DefinitelyWrong!Password999',
    }),
  });

  assertAuthenticationRejected(
    response,
    'Login with invalid password'
  );

  const body = await readResponseBody(response);
  assertSafeErrorBody(body, 'Invalid-password response');
});

test('login rejects malformed email input', {
  skip: !serverAvailable,
}, async () => {
  const response = await request(LOGIN_PATH, {
    method: 'POST',
    body: jsonBody({
      email: 'not-an-email',
      password: STUDENT_PASSWORD,
    }),
  });

  assertAuthenticationRejected(
    response,
    'Login with malformed email'
  );

  const body = await readResponseBody(response);
  assertSafeErrorBody(body, 'Malformed-email response');
});

test('unauthenticated requests cannot access the current-user endpoint', {
  skip: !serverAvailable,
}, async () => {
  const response = await request(ME_PATH);

  assert.ok(
    [401, 403].includes(response.status),
    `Expected HTTP 401 or 403 from the current-user endpoint; ` +
      `received HTTP ${response.status}.`
  );

  const body = await readResponseBody(response);
  assertSafeErrorBody(body, 'Unauthenticated current-user response');
});

test('login response excludes sensitive account data', {
  skip: !serverAvailable,
}, async () => {
  const response = await request(LOGIN_PATH, {
    method: 'POST',
    body: jsonBody({
      email: STUDENT_EMAIL,
      password: STUDENT_PASSWORD,
    }),
  });

  if (!response.ok) {
    assert.fail(
      `Synthetic test login failed with HTTP ${response.status}. ` +
        'Configure E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD for a valid isolated test account.'
    );
  }

  const body = await readJson(response);

  assert.ok(
    body !== null && typeof body === 'object',
    'Expected a JSON login response. Adapt the test if the API intentionally uses another response format.'
  );

  // Access tokens may legitimately be returned by a bearer-token API.
  // Passwords, hashes, secrets, and refresh tokens must not be returned.
  assertNoSensitiveFields(body, {
    allowAccessTokens: true,
  });
});

test('registration cannot assign administrator privileges through client input', {
  skip: !serverAvailable || !RUN_MUTATING_TESTS,
}, async () => {
  requireMutationOptIn();

  const email = uniqueTestEmail();
  const password = `Registration!${crypto.randomUUID()}aA9`;

  const response = await request(REGISTER_PATH, {
    method: 'POST',
    body: jsonBody({
      firstName: 'Security',
      lastName: 'Test',
      email,
      password,
      confirmPassword: password,
      role: 'super_admin',
      isAdmin: true,
      is_admin: true,
      permissions: ['*', 'admin'],
    }),
  });

  if (!response.ok) {
    assertAuthenticationRejected(
      response,
      'Registration with protected fields'
    );

    const body = await readResponseBody(response);
    assertSafeErrorBody(body, 'Protected-field registration response');
    return;
  }

  const body = await readJson(response);

  assert.ok(
    body !== null && typeof body === 'object',
    'Successful registration must return JSON. Adapt this assertion if the API uses another response format.'
  );

  assertNoSensitiveFields(body, {
    allowAccessTokens: true,
  });

  assertNoAdministratorEscalation(
    body,
    'Registration response'
  );
});

test('logout endpoint handles an unauthenticated request without a server error', {
  skip: !serverAvailable,
}, async () => {
  const response = await request(LOGOUT_PATH, {
    method: 'POST',
  });

  assertNoServerError(
    response,
    'Unauthenticated logout'
  );

  assert.ok(
    [200, 202, 204, 400, 401, 403, 404, 405].includes(response.status),
    `Unexpected logout status: HTTP ${response.status}.`
  );

  if (response.status >= 400) {
    const body = await readResponseBody(response);
    assertSafeErrorBody(body, 'Logout error response');
  }
});

test('session cookies use secure attributes in HTTPS deployments', {
  skip: !serverAvailable || baseUrl.protocol !== 'https:',
}, async (t) => {
  const response = await request(LOGIN_PATH, {
    method: 'POST',
    body: jsonBody({
      email: STUDENT_EMAIL,
      password: STUDENT_PASSWORD,
    }),
  });

  if (!response.ok) {
    assert.fail(
      `Synthetic test login failed with HTTP ${response.status}. ` +
        'Configure a valid isolated test account before checking session cookies.'
    );
  }

  const cookies = getSetCookieHeaders(response);

  if (cookies.length === 0) {
    t.skip(
      'The login response did not set cookies. This may be a bearer-token API rather than a cookie-session API.'
    );
    return;
  }

  for (const cookie of cookies) {
    const normalized = cookie.toLowerCase();

    assert.ok(
      /(?:^|;\s*)secure(?:;|$)/i.test(cookie),
      'Session cookie must include the Secure attribute over HTTPS.'
    );

    assert.ok(
      /(?:^|;\s*)httponly(?:;|$)/i.test(cookie),
      'Session cookie must include the HttpOnly attribute.'
    );

    assert.ok(
      /(?:^|;\s*)samesite=(strict|lax|none)(?:;|$)/i.test(cookie),
      'Session cookie must explicitly define SameSite.'
    );

    if (/\bsamesite=none\b/i.test(normalized)) {
      assert.ok(
        /(?:^|;\s*)secure(?:;|$)/i.test(cookie),
        'SameSite=None cookies must also use Secure.'
      );
    }
  }
});

test('authentication error responses do not expose implementation details', {
  skip: !serverAvailable,
}, async () => {
  const response = await request(LOGIN_PATH, {
    method: 'POST',
    body: jsonBody({
      email: INVALID_LOGIN_EMAIL,
      password: 'Invalid!Password123456',
    }),
  });

  assertAuthenticationRejected(
    response,
    'Login using a nonexistent synthetic account'
  );

  const body = await readResponseBody(response);
  assertSafeErrorBody(body, 'Authentication error response');
});
