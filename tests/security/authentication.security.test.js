'use strict';
/**
 * MedOrbits -- Authentication Security Tests
 *
 * File: tests/security/authentication.security.test.js
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
 *
 * Requirements:
 * - Use an isolated test environment and synthetic accounts.
 * - Never point destructive tests at production.
 * - Adapt routes and response expectations to the actual application.
 */
const {
  test,
  before,
} = require('node:test');
const assert = require('node:assert/strict');
const BASE_URL = (
  process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
).replace(/\/+$/, '');
const LOGIN_PATH =
  process.env.E2E_LOGIN_PATH || '/api/auth/login';
const REGISTER_PATH =
  process.env.E2E_REGISTER_PATH || '/api/auth/register';
const ME_PATH =
  process.env.E2E_ME_PATH || '/api/auth/me';
const LOGOUT_PATH =
  process.env.E2E_LOGOUT_PATH || '/api/auth/logout';
const STUDENT_EMAIL =
  process.env.E2E_STUDENT_EMAIL || 'student001@example.test';
const STUDENT_PASSWORD =
  process.env.E2E_STUDENT_PASSWORD || 'TestOnly!Password123';
const REQUEST_TIMEOUT_MS = 10_000;
let serverAvailable = false;
async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );
  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}
function jsonBody(value) {
  return JSON.stringify(value);
}
async function readJson(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}
function assertAuthenticationRejected(response) {
  assert.ok(
    [400, 401, 403, 404, 409, 422, 429].includes(response.status),
    `Expected authentication rejection; received HTTP ${response.status}`
  );
}
function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }
  const cookie = response.headers.get('set-cookie');
  return cookie ? [cookie] : [];
}
function assertNoSensitiveFields(body) {
  if (!body || typeof body !== 'object') {
    return;
  }
  const forbiddenKeys = new Set([
    'password',
    'passwordHash',
    'password_hash',
    'accessToken',
    'refreshToken',
    'refresh_token',
    'secret',
    'mfaSecret',
    'recoveryCodes',
  ]);
  function inspect(value, path = 'response') {
    if (!value || typeof value !== 'object') {
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      assert.ok(
        !forbiddenKeys.has(key),
        `Sensitive field "${path}.${key}" must not be exposed`
      );
      inspect(child, `${path}.${key}`);
    }
  }
  inspect(body);
}
before(async () => {
  try {
    const response = await fetch(`${BASE_URL}/`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    serverAvailable = response.status < 500;
  } catch {
    serverAvailable = false;
  }
});
test('authentication security suite requires a reachable test server', {
  skip: false,
}, () => {
  assert.ok(
    serverAvailable,
    `Test server is unavailable at ${BASE_URL}. Start the isolated test server before running this suite.`
  );
});
test('login rejects missing credentials', {
  skip: !serverAvailable,
}, async () => {
  const response = await request(LOGIN_PATH, {
    method: 'POST',
    body: jsonBody({}),
  });
  assertAuthenticationRejected(response);
});
test('login rejects an invalid password', {
  skip: !serverAvailable,
}, async () => {
  const response = await request(LOGIN_PATH, {
    method: 'POST',
    body: jsonBody({
      email: STUDENT_EMAIL,
      password: 'DefinitelyWrong!Password999',
    }),
  });
  assertAuthenticationRejected(response);
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
  assertAuthenticationRejected(response);
});
test('unauthenticated requests cannot access the current-user endpoint', {
  skip: !serverAvailable,
}, async () => {
  const response = await request(ME_PATH);
  assert.ok(
    [401, 403].includes(response.status),
    `Expected 401 or 403; received HTTP ${response.status}`
  );
});
test('login response does not expose sensitive account fields', {
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
      `Synthetic test login failed with HTTP ${response.status}. Configure a valid isolated test account before running this test.`
    );
  }
  const body = await readJson(response);
  assert.ok(
    body,
    'Expected the login endpoint to return JSON; adapt this test if the API uses another response format.'
  );
  assertNoSensitiveFields(body);
});
test('registration cannot assign an administrator role through client input', {
  skip: !serverAvailable,
}, async () => {
  const uniqueEmail =
    `security-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const response = await request(REGISTER_PATH, {
    method: 'POST',
    body: jsonBody({
      firstName: 'Security',
      lastName: 'Test',
      email: uniqueEmail,
      password: 'RegistrationTest!Password123',
      confirmPassword: 'RegistrationTest!Password123',
      role: 'super_admin',
      isAdmin: true,
      permissions: ['*'],
    }),
  });
  if (response.ok) {
    const body = await readJson(response);
    assert.ok(
      body && typeof body === 'object',
      'Expected registration to return a JSON account representation.'
    );
    assertNoSensitiveFields(body);
    const serialized = JSON.stringify(body).toLowerCase();
    assert.ok(
      !serialized.includes('"role":"super_admin"'),
      'Registration must not grant the requested super-admin role.'
    );
    assert.ok(
      !serialized.includes('"isadmin":true'),
      'Registration must not grant administrator privileges.'
    );
  } else {
    assertAuthenticationRejected(response);
  }
});
test('logout endpoint does not return a server error', {
  skip: !serverAvailable,
}, async () => {
  const response = await request(LOGOUT_PATH, {
    method: 'POST',
  });
  assert.ok(
    response.status < 500,
    `Logout endpoint returned HTTP ${response.status}`
  );
});
test('session cookies use secure attributes in HTTPS deployments', {
  skip: !serverAvailable || !BASE_URL.startsWith('https://'),
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
      `Synthetic test login failed with HTTP ${response.status}.`
    );
  }
  const cookies = getSetCookieHeaders(response);
  for (const cookie of cookies) {
    const normalized = cookie.toLowerCase();
    assert.ok(
      normalized.includes('secure'),
      'Session cookie must include the Secure attribute over HTTPS.'
    );
    assert.ok(
      normalized.includes('httponly'),
      'Session cookie must include the HttpOnly attribute.'
    );
    assert.ok(
      /(?:^|;\s*)samesite=(strict|lax|none)(?:;|$)/i.test(cookie),
      'Session cookie must explicitly define SameSite.'
    );
  }
});