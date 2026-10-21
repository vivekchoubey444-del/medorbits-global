'use strict';
/**
 * MedOrbits -- IDOR Security Tests
 *
 * File: tests/security/idor.security.test.js
 *
 * Run:
 *   node --test tests/security/idor.security.test.js
 *
 * Configure:
 *   E2E_BASE_URL=http://127.0.0.1:3000
 *   E2E_LOGIN_PATH=/api/auth/login
 *   E2E_USERS_PATH=/api/users
 *   E2E_APPLICATIONS_PATH=/api/applications
 *   E2E_DOCUMENTS_PATH=/api/documents
 *   E2E_STUDENT_A_EMAIL=student001@example.test
 *   E2E_STUDENT_A_PASSWORD=TestOnly!Password123
 *   E2E_STUDENT_B_EMAIL=student002@example.test
 *   E2E_STUDENT_B_PASSWORD=TestOnly!Password123
 *
 * Requirements:
 * - Use a dedicated test environment.
 * - Seed two distinct users and their own records.
 * - Confirm that record IDs belong to the intended users.
 * - Never run destructive tests against production.
 *
 * Adapt routes, authentication, and payloads to the real API.
 */
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const BASE_URL = (
  process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
).replace(/\/+$/, '');
const LOGIN_PATH =
  process.env.E2E_LOGIN_PATH || '/api/auth/login';
const USERS_PATH =
  process.env.E2E_USERS_PATH || '/api/users';
const APPLICATIONS_PATH =
  process.env.E2E_APPLICATIONS_PATH || '/api/applications';
const DOCUMENTS_PATH =
  process.env.E2E_DOCUMENTS_PATH || '/api/documents';
const USER_A_EMAIL =
  process.env.E2E_STUDENT_A_EMAIL || 'student001@example.test';
const USER_A_PASSWORD =
  process.env.E2E_STUDENT_A_PASSWORD || 'TestOnly!Password123';
const USER_B_EMAIL =
  process.env.E2E_STUDENT_B_EMAIL || 'student002@example.test';
const USER_B_PASSWORD =
  process.env.E2E_STUDENT_B_PASSWORD || 'TestOnly!Password123';
const USER_A_ID =
  process.env.E2E_STUDENT_A_ID || 'usr_test_001';
const USER_B_ID =
  process.env.E2E_STUDENT_B_ID || 'usr_test_002';
const APPLICATION_A_ID =
  process.env.E2E_APPLICATION_A_ID || 'app_test_001';
const APPLICATION_B_ID =
  process.env.E2E_APPLICATION_B_ID || 'app_test_002';
const DOCUMENT_A_ID =
  process.env.E2E_DOCUMENT_A_ID || 'doc_test_001';
const DOCUMENT_B_ID =
  process.env.E2E_DOCUMENT_B_ID || 'doc_test_002';
const REQUEST_TIMEOUT_MS = 10_000;
let available = false;
let setupError = null;
let sessionA = null;
let sessionB = null;
async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );
  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...options,
      redirect: 'manual',
      signal: controller.signal,
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
async function login(email, password) {
  const response = await request(LOGIN_PATH, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(
      `Unable to log in synthetic test user ${email}: HTTP ${response.status}`
    );
  }
  const body = await response.json().catch(() => null);
  const cookieHeaders =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean);
  const cookie = cookieHeaders
    .map((value) => value.split(';', 1)[0])
    .filter(Boolean)
    .join('; ');
  const token =
    body?.accessToken ||
    body?.token ||
    body?.data?.accessToken ||
    body?.data?.token;
  if (!cookie && typeof token !== 'string') {
    throw new Error(
      'Login succeeded, but no supported session cookie or bearer token was returned.'
    );
  }
  return {
    cookie,
    token: typeof token === 'string' ? token : '',
  };
}
function authHeaders(session) {
  const headers = {};
  if (session.cookie) {
    headers.Cookie = session.cookie;
  }
  if (session.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }
  return headers;
}
function objectPath(basePath, id, suffix = '') {
  return `${basePath}/${encodeURIComponent(id)}${suffix}`;
}
function assertDenied(response, description) {
  assert.ok(
    [401, 403, 404].includes(response.status),
    `${description}: expected 401, 403, or 404; received ${response.status}`
  );
}
async function readJson(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  return response.json().catch(() => null);
}
before(async () => {
  try {
    const health = await fetch(`${BASE_URL}/`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    available = health.status < 500;
    if (!available) {
      return;
    }
    sessionA = await login(USER_A_EMAIL, USER_A_PASSWORD);
    sessionB = await login(USER_B_EMAIL, USER_B_PASSWORD);
  } catch (error) {
    setupError = error;
  }
});
function requireSetup() {
  assert.ok(
    available,
    `Test server is not reachable at ${BASE_URL}.`
  );
  if (setupError) {
    throw setupError;
  }
  assert.ok(sessionA, 'First test-user session is required');
  assert.ok(sessionB, 'Second test-user session is required');
  assert.notEqual(
    USER_A_ID,
    USER_B_ID,
    'IDOR tests require two distinct users'
  );
}
test('IDOR suite requires two authenticated synthetic users', () => {
  requireSetup();
});
test('user A cannot read user B private profile', {
  skip: false,
}, async (t) => {
  if (!available || setupError) {
    t.skip('Test server or synthetic test accounts are not configured');
    return;
  }
  requireSetup();
  const response = await request(
    objectPath(USERS_PATH, USER_B_ID),
    { headers: authHeaders(sessionA) }
  );
  assertDenied(response, 'Cross-user profile read');
});
test('user A cannot read user B application', async (t) => {
  if (!available || setupError) {
    t.skip('Test server or synthetic test accounts are not configured');
    return;
  }
  requireSetup();
  const response = await request(
    objectPath(APPLICATIONS_PATH, APPLICATION_B_ID),
    { headers: authHeaders(sessionA) }
  );
  assertDenied(response, 'Cross-user application read');
});
test('user A cannot modify user B application', async (t) => {
  if (!available || setupError) {
    t.skip('Test server or synthetic test accounts are not configured');
    return;
  }
  requireSetup();
  const response = await request(
    objectPath(APPLICATIONS_PATH, APPLICATION_B_ID),
    {
      method: 'PATCH',
      headers: authHeaders(sessionA),
      body: JSON.stringify({
        status: 'approved',
        userId: USER_A_ID,
        ownerId: USER_A_ID,
      }),
    }
  );
  assertDenied(response, 'Cross-user application modification');
});
test('user A cannot delete user B application', async (t) => {
  if (!available || setupError) {
    t.skip('Test server or synthetic test accounts are not configured');
    return;
  }
  requireSetup();
  const response = await request(
    objectPath(APPLICATIONS_PATH, APPLICATION_B_ID),
    {
      method: 'DELETE',
      headers: authHeaders(sessionA),
    }
  );
  assertDenied(response, 'Cross-user application deletion');
});
test('user A cannot download user B document', async (t) => {
  if (!available || setupError) {
    t.skip('Test server or synthetic test accounts are not configured');
    return;
  }
  requireSetup();
  const response = await request(
    objectPath(DOCUMENTS_PATH, DOCUMENT_B_ID, '/download'),
    { headers: authHeaders(sessionA) }
  );
  assertDenied(response, 'Cross-user document download');
});
test('user A cannot modify user B document metadata', async (t) => {
  if (!available || setupError) {
    t.skip('Test server or synthetic test accounts are not configured');
    return;
  }
  requireSetup();
  const response = await request(
    objectPath(DOCUMENTS_PATH, DOCUMENT_B_ID),
    {
      method: 'PATCH',
      headers: authHeaders(sessionA),
      body: JSON.stringify({
        title: 'Unauthorized change',
        userId: USER_A_ID,
        ownerId: USER_A_ID,
      }),
    }
  );
  assertDenied(response, 'Cross-user document modification');
});
test('user B can access their own application', async (t) => {
  if (!available || setupError) {
    t.skip('Test server or synthetic test accounts are not configured');
    return;
  }
  requireSetup();
  const response = await request(
    objectPath(APPLICATIONS_PATH, APPLICATION_B_ID),
    { headers: authHeaders(sessionB) }
  );
  assert.equal(
    response.status,
    200,
    'Control check failed: user B should be able to access their own application'
  );
});
test('user B can access their own document metadata', async (t) => {
  if (!available || setupError) {
    t.skip('Test server or synthetic test accounts are not configured');
    return;
  }
  requireSetup();
  const response = await request(
    objectPath(DOCUMENTS_PATH, DOCUMENT_B_ID),
    { headers: authHeaders(sessionB) }
  );
  assert.equal(
    response.status,
    200,
    'Control check failed: user B should be able to access their own document'
  );
});
test('application responses do not expose another users private identifiers', async (t) => {
  if (!available || setupError) {
    t.skip('Test server or synthetic test accounts are not configured');
    return;
  }
  requireSetup();
  const response = await request(
    objectPath(APPLICATIONS_PATH, APPLICATION_A_ID),
    { headers: authHeaders(sessionA) }
  );
  assert.equal(
    response.status,
    200,
    'The configured owner must be able to access their own application'
  );
  const body = await readJson(response);
  assert.ok(body, 'Expected a JSON application response');
  const serialized = JSON.stringify(body);
  assert.ok(
    !serialized.includes(USER_B_ID),
    'Application response unexpectedly contains the foreign user ID'
  );
});