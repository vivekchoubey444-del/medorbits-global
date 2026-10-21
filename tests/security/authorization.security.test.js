'use strict';
/**
 * MedOrbits -- Authorization Security Tests
 *
 * File: tests/security/authorization.security.test.js
 *
 * Run:
 *   node --test tests/security/authorization.security.test.js
 *
 * Optional environment variables:
 *   E2E_BASE_URL=http://127.0.0.1:3000
 *   E2E_LOGIN_PATH=/api/auth/login
 *   E2E_ME_PATH=/api/auth/me
 *   E2E_STUDENT_EMAIL=student001@example.test
 *   E2E_STUDENT_PASSWORD=TestOnly!Password123
 *   E2E_ADMIN_EMAIL=admin001@example.test
 *   E2E_ADMIN_PASSWORD=AdminTestOnly!Password123
 *   E2E_APPLICATIONS_PATH=/api/applications
 *   E2E_USERS_PATH=/api/users
 *
 * Requirements:
 * - Use an isolated test environment.
 * - Create synthetic users and records before ownership tests.
 * - Never run destructive tests against production.
 * - Verify persisted state where possible.
 *
 * Important:
 * - Route paths and response expectations must match the actual API.
 * - A passing HTTP status assertion alone does not prove authorization.
 */
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const BASE_URL = (
  process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
).replace(/\/+$/, '');
const LOGIN_PATH =
  process.env.E2E_LOGIN_PATH || '/api/auth/login';
const ME_PATH =
  process.env.E2E_ME_PATH || '/api/auth/me';
const APPLICATIONS_PATH =
  process.env.E2E_APPLICATIONS_PATH || '/api/applications';
const USERS_PATH =
  process.env.E2E_USERS_PATH || '/api/users';
const STUDENT_EMAIL =
  process.env.E2E_STUDENT_EMAIL || 'student001@example.test';
const STUDENT_PASSWORD =
  process.env.E2E_STUDENT_PASSWORD || 'TestOnly!Password123';
const ADMIN_EMAIL =
  process.env.E2E_ADMIN_EMAIL || 'admin001@example.test';
const ADMIN_PASSWORD =
  process.env.E2E_ADMIN_PASSWORD || 'AdminTestOnly!Password123';
const REQUEST_TIMEOUT_MS = 10_000;
const SYNTHETIC_APPLICATION_ID =
  process.env.E2E_OWNED_APPLICATION_ID || 'app_security_owner_001';
const SYNTHETIC_FOREIGN_APPLICATION_ID =
  process.env.E2E_FOREIGN_APPLICATION_ID || 'app_security_foreign_001';
let serverAvailable = false;
let studentCookie = '';
let adminCookie = '';
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
        ...(options.body
          ? { 'Content-Type': 'application/json' }
          : {}),
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
function getCookieHeader(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(';', 1)[0])
      .filter(Boolean)
      .join('; ');
  }
  const cookie = response.headers.get('set-cookie');
  return cookie ? cookie.split(';', 1)[0] : '';
}
async function login(email, password) {
  const response = await request(LOGIN_PATH, {
    method: 'POST',
    body: jsonBody({ email, password }),
  });
  if (!response.ok) {
    throw new Error(
      `Test account login failed with HTTP ${response.status}. ` +
      'Configure valid synthetic accounts in the isolated test environment.'
    );
  }
  const cookie = getCookieHeader(response);
  const body = await response.json().catch(() => null);
  const token =
    body?.accessToken ||
    body?.token ||
    body?.data?.accessToken ||
    body?.data?.token;
  return {
    cookie,
    token: typeof token === 'string' ? token : '',
    body,
  };
}
function authHeaders(session) {
  const headers = {};
  if (session?.cookie) {
    headers.Cookie = session.cookie;
  }
  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }
  return headers;
}
function assertDenied(response, context) {
  assert.ok(
    [401, 403, 404].includes(response.status),
    `${context}: expected HTTP 401, 403, or 404; ` +
      `received HTTP ${response.status}`
  );
}
function assertNoServerError(response, context) {
  assert.ok(
    response.status < 500,
    `${context}: received HTTP ${response.status}`
  );
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
  if (!serverAvailable) {
    return;
  }
  try {
    const student = await login(STUDENT_EMAIL, STUDENT_PASSWORD);
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    studentCookie = student.cookie || '';
    adminCookie = admin.cookie || '';
    // Bearer tokens are kept separately from cookie values.
    studentSession = student;
    adminSession = admin;
  } catch (error) {
    setupError = error;
  }
});
let studentSession = null;
let adminSession = null;
let setupError = null;
function requireSessions() {
  if (!serverAvailable) {
    throw new Error(
      `Test server unavailable at ${BASE_URL}.`
    );
  }
  if (setupError) {
    throw setupError;
  }
  assert.ok(studentSession, 'Student test session is required');
  assert.ok(adminSession, 'Admin test session is required');
}
test('authorization suite requires a reachable test server', () => {
  assert.ok(
    serverAvailable,
    `Start the isolated test server at ${BASE_URL} before running this suite.`
  );
});
test('unauthenticated user cannot access a protected user endpoint', {
  skip: !serverAvailable,
}, async () => {
  const response = await request(ME_PATH);
  assertDenied(response, 'Unauthenticated current-user request');
});
test('authenticated student can access their own current-user endpoint', {
  skip: !serverAvailable,
}, async () => {
  requireSessions();
  const response = await request(ME_PATH, {
    headers: authHeaders(studentSession),
  });
  assert.equal(
    response.status,
    200,
    'Expected the authenticated student to access their own profile'
  );
});
test('student cannot use mass assignment to promote their role', {
  skip: !serverAvailable,
}, async () => {
  requireSessions();
  const response = await request(ME_PATH, {
    method: 'PATCH',
    headers: authHeaders(studentSession),
    body: jsonBody({
      role: 'super_admin',
      isAdmin: true,
      permissions: ['*'],
    }),
  });
  assert.ok(
    [400, 401, 403, 404, 405, 422].includes(response.status),
    `Expected privileged update to be rejected; received HTTP ${response.status}`
  );
  // This endpoint and payload must be adapted if profile updates use
  // another route. Verify persisted role through a trusted test helper
  // or database assertion in the integration test suite.
});
test('student cannot access another users private record', {
  skip: !serverAvailable,
}, async () => {
  requireSessions();
  const foreignUserId =
    process.env.E2E_FOREIGN_USER_ID || 'usr_foreign_001';
  const response = await request(
    `${USERS_PATH}/${encodeURIComponent(foreignUserId)}`,
    {
      headers: authHeaders(studentSession),
    }
  );
  assertDenied(response, 'Foreign user record access');
});
test('student cannot access an application owned by another user', {
  skip: !serverAvailable,
}, async () => {
  requireSessions();
  const response = await request(
    `${APPLICATIONS_PATH}/${encodeURIComponent(
      SYNTHETIC_FOREIGN_APPLICATION_ID
    )}`,
    {
      headers: authHeaders(studentSession),
    }
  );
  assertDenied(response, 'Foreign application access');
});
test('student cannot modify an application owned by another user', {
  skip: !serverAvailable,
}, async () => {
  requireSessions();
  const response = await request(
    `${APPLICATIONS_PATH}/${encodeURIComponent(
      SYNTHETIC_FOREIGN_APPLICATION_ID
    )}`,
    {
      method: 'PATCH',
      headers: authHeaders(studentSession),
      body: jsonBody({
        status: 'approved',
        ownerId: 'usr_test_001',
      }),
    }
  );
  assert.ok(
    [400, 401, 403, 404, 405, 422].includes(response.status),
    `Expected foreign application update to be rejected; received HTTP ${response.status}`
  );
});
test('student cannot approve an application through a direct request', {
  skip: !serverAvailable,
}, async () => {
  requireSessions();
  const response = await request(
    `${APPLICATIONS_PATH}/${encodeURIComponent(
      SYNTHETIC_APPLICATION_ID
    )}`,
    {
      method: 'PATCH',
      headers: authHeaders(studentSession),
      body: jsonBody({
        status: 'approved',
        approved: true,
      }),
    }
  );
  assert.ok(
    [400, 401, 403, 404, 405, 422].includes(response.status),
    `Expected unauthorized approval to be rejected; received HTTP ${response.status}`
  );
});
test('student cannot retrieve an administrative user listing', {
  skip: !serverAvailable,
}, async () => {
  requireSessions();
  const response = await request(USERS_PATH, {
    headers: authHeaders(studentSession),
  });
  assert.ok(
    [401, 403, 404].includes(response.status),
    `Expected admin-only listing to be denied; received HTTP ${response.status}`
  );
});
test('admin account can reach the configured current-user endpoint', {
  skip: !serverAvailable,
}, async () => {
  requireSessions();
  const response = await request(ME_PATH, {
    headers: authHeaders(adminSession),
  });
  assert.equal(
    response.status,
    200,
    'Expected the configured administrator account to authenticate'
  );
});
test('foreign record identifiers do not cause server errors', {
  skip: !serverAvailable,
}, async () => {
  requireSessions();
  const paths = [
    `${USERS_PATH}/nonexistent_security_user`,
    `${APPLICATIONS_PATH}/nonexistent_security_application`,
  ];
  for (const path of paths) {
    const response = await request(path, {
      headers: authHeaders(studentSession),
    });
    assertNoServerError(response, `Request to ${path}`);
  }
});