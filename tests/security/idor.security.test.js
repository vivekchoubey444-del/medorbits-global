
'use strict';

/**
 * MedOrbits -- IDOR Security Tests
 *
 * File: tests/security/idor.security.test.js
 *
 * Requirements:
 * - Node.js >= 20
 * - A dedicated, isolated test environment
 * - Two distinct synthetic users and correctly seeded records
 * - User B must own APPLICATION_B_ID and DOCUMENT_B_ID
 * - User A must own APPLICATION_A_ID
 *
 * Run:
 *   node --test tests/security/idor.security.test.js
 *
 * Existing configuration:
 *   E2E_BASE_URL=http://127.0.0.1:3000
 *   E2E_LOGIN_PATH=/api/auth/login
 *   E2E_USERS_PATH=/api/users
 *   E2E_APPLICATIONS_PATH=/api/applications
 *   E2E_DOCUMENTS_PATH=/api/documents
 *   E2E_STUDENT_A_EMAIL=student001@example.test
 *   E2E_STUDENT_A_PASSWORD=TestOnly!Password123
 *   E2E_STUDENT_B_EMAIL=student002@example.test
 *   E2E_STUDENT_B_PASSWORD=TestOnly!Password123
 *   E2E_STUDENT_A_ID=usr_test_001
 *   E2E_STUDENT_B_ID=usr_test_002
 *   E2E_APPLICATION_A_ID=app_test_001
 *   E2E_APPLICATION_B_ID=app_test_002
 *   E2E_DOCUMENT_A_ID=doc_test_001
 *   E2E_DOCUMENT_B_ID=doc_test_002
 *   E2E_REQUEST_TIMEOUT_MS=10000
 *
 * Mutation safeguards:
 *   E2E_RUN_MUTATING_TESTS=true
 *   E2E_ALLOW_REMOTE_MUTATIONS=true
 *   E2E_TEST_ENVIRONMENT=sandbox
 *   E2E_ALLOW_CI_MUTATIONS=true
 *
 * Important:
 * - PATCH and DELETE tests are disabled unless explicitly enabled.
 * - Never run mutation tests against production.
 * - A 404 can be an intentional way to conceal record existence.
 * - A passing denial status does not prove that persisted state is unchanged.
 */

const { test, before } = require('node:test');
const assert = require('node:assert/strict');

const DEFAULT_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 120_000;

const DENIED_STATUSES = new Set([401, 403, 404]);

const BASE_URL_RAW =
  process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

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

const RUN_MUTATING_TESTS =
  process.env.E2E_RUN_MUTATING_TESTS === 'true';

let requestTimeoutMs = DEFAULT_TIMEOUT_MS;
let baseUrl = null;
let routes = null;

let serverAvailable = false;
let configurationError = null;
let setupError = null;

let sessionA = null;
let sessionB = null;

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
      `E2E_REQUEST_TIMEOUT_MS must be an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}.`
    );
  }

  return parsed;
}

function normalizeRoutePath(value, variableName) {
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

  assert.ok(
    !parsed.pathname.split('/').includes('..'),
    `${variableName} must not contain parent-directory path segments.`
  );

  return parsed.pathname;
}

function validateConfiguration() {
  let parsed;

  try {
    parsed = new URL(BASE_URL_RAW);
  } catch {
    throw new Error(
      'E2E_BASE_URL must be a valid absolute URL, such as http://127.0.0.1:3000.'
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(parsed.protocol),
    'E2E_BASE_URL must use HTTP or HTTPS.'
  );

  assert.ok(
    !parsed.username && !parsed.password,
    'E2E_BASE_URL must not contain embedded credentials.'
  );

  assert.ok(
    !parsed.search && !parsed.hash,
    'E2E_BASE_URL must not contain a query string or fragment.'
  );

  assert.ok(
    parsed.pathname === '/' && !parsed.search && !parsed.hash,
    'E2E_BASE_URL must contain only the origin, for example http://127.0.0.1:3000.'
  );

  baseUrl = new URL(parsed.origin);
  requestTimeoutMs = parseTimeout(
    process.env.E2E_REQUEST_TIMEOUT_MS
  );

  routes = {
    login: normalizeRoutePath(LOGIN_PATH, 'E2E_LOGIN_PATH'),
    users: normalizeRoutePath(USERS_PATH, 'E2E_USERS_PATH'),
    applications: normalizeRoutePath(
      APPLICATIONS_PATH,
      'E2E_APPLICATIONS_PATH'
    ),
    documents: normalizeRoutePath(
      DOCUMENTS_PATH,
      'E2E_DOCUMENTS_PATH'
    ),
  };

  assert.ok(
    USER_A_EMAIL.trim() &&
      USER_B_EMAIL.trim() &&
      USER_A_EMAIL !== USER_B_EMAIL,
    'IDOR tests require two distinct synthetic user email addresses.'
  );

  assert.ok(
    USER_A_PASSWORD && USER_B_PASSWORD,
    'Both synthetic users must have configured passwords.'
  );

  assert.ok(
    USER_A_ID && USER_B_ID && USER_A_ID !== USER_B_ID,
    'IDOR tests require distinct user IDs.'
  );

  assert.ok(
    APPLICATION_A_ID &&
      APPLICATION_B_ID &&
      APPLICATION_A_ID !== APPLICATION_B_ID,
    'IDOR tests require distinct application IDs.'
  );

  assert.ok(
    DOCUMENT_A_ID &&
      DOCUMENT_B_ID &&
      DOCUMENT_A_ID !== DOCUMENT_B_ID,
    'IDOR tests require distinct document IDs.'
  );
}

/* -------------------------------------------------------------------------- */
/* HTTP helpers                                                               */
/* -------------------------------------------------------------------------- */

function urlFor(path) {
  assert.ok(
    typeof path === 'string' &&
      path.startsWith('/') &&
      !path.startsWith('//'),
    'Requests must use absolute same-origin paths.'
  );

  const url = new URL(path, baseUrl);

  assert.equal(
    url.origin,
    baseUrl.origin,
    'Cross-origin requests are not allowed by this test suite.'
  );

  return url;
}

async function request(path, options = {}) {
  const url = urlFor(path);
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    requestTimeoutMs
  );

  const headers = {
    Accept: 'application/json',
    ...(options.body !== undefined
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...options.headers,
  };

  try {
    return await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
      redirect: 'manual',
    });
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${requestTimeoutMs} ms: ${options.method || 'GET'} ${url.pathname}`
      );
    }

    throw new Error(
      `Request failed for ${options.method || 'GET'} ${url.pathname}: ${error.message}`
    );
  } finally {
    clearTimeout(timeout);
  }
}

function jsonBody(value) {
  return JSON.stringify(value);
}

async function readJson(response) {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.toLowerCase().includes('application/json')) {
    await response.body?.cancel().catch(() => {});
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getCookieHeader(response) {
  let cookieHeaders = [];

  if (typeof response.headers.getSetCookie === 'function') {
    cookieHeaders = response.headers.getSetCookie();
  } else {
    const singleHeader = response.headers.get('set-cookie');

    if (singleHeader) {
      cookieHeaders = [singleHeader];
    }
  }

  return cookieHeaders
    .map((cookie) => cookie.split(';', 1)[0].trim())
    .filter(Boolean)
    .join('; ');
}

function extractAccessToken(body) {
  const candidates = [
    body?.accessToken,
    body?.token,
    body?.data?.accessToken,
    body?.data?.token,
    body?.user?.accessToken,
    body?.data?.user?.accessToken,
  ];

  return candidates.find(
    (candidate) =>
      typeof candidate === 'string' && candidate.trim().length > 0
  ) || '';
}

async function login(email, password) {
  const response = await request(routes.login, {
    method: 'POST',
    body: jsonBody({ email, password }),
  });

  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(
      `Synthetic test-user login failed with HTTP ${response.status}. ` +
      'Verify the login route and test-account credentials.'
    );
  }

  const cookie = getCookieHeader(response);
  const token = extractAccessToken(body);

  assert.ok(
    cookie || token,
    'Login succeeded but returned neither a recognized session cookie nor a bearer token. Adapt login() to the actual authentication contract.'
  );

  return {
    cookie,
    token,
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

function objectPath(basePath, id, suffix = '') {
  assert.ok(
    typeof id === 'string' && id.length > 0,
    'Record IDs must be non-empty strings.'
  );

  assert.ok(
    typeof suffix === 'string' &&
      (suffix === '' || suffix.startsWith('/')),
    'Endpoint suffix must be empty or start with a slash.'
  );

  return `${basePath}/${encodeURIComponent(id)}${suffix}`;
}

/* -------------------------------------------------------------------------- */
/* Assertions and setup                                                       */
/* -------------------------------------------------------------------------- */

function assertDenied(response, description) {
  assert.ok(
    DENIED_STATUSES.has(response.status),
    `${description}: expected HTTP 401, 403, or 404; received HTTP ${response.status}.`
  );
}

function assertNoServerError(response, description) {
  assert.ok(
    response.status < 500,
    `${description}: received HTTP ${response.status}.`
  );
}

function requireSetup() {
  if (configurationError) {
    throw configurationError;
  }

  assert.ok(
    serverAvailable,
    `Test server is unavailable at ${BASE_URL_RAW}.`
  );

  if (setupError) {
    throw setupError;
  }

  assert.ok(sessionA, 'User A session is required.');
  assert.ok(sessionB, 'User B session is required.');
}

function mutationSkipReason() {
  if (!RUN_MUTATING_TESTS) {
    return 'Mutation test disabled. Set E2E_RUN_MUTATING_TESTS=true to enable it.';
  }

  if (process.env.NODE_ENV !== 'test') {
    return 'Mutation tests require NODE_ENV=test.';
  }

  if (process.env.CI && process.env.E2E_ALLOW_CI_MUTATIONS !== 'true') {
    return 'CI mutation tests require E2E_ALLOW_CI_MUTATIONS=true.';
  }

  if (
    baseUrl &&
    !['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)
  ) {
    if (process.env.E2E_ALLOW_REMOTE_MUTATIONS !== 'true') {
      return 'Remote mutation tests require E2E_ALLOW_REMOTE_MUTATIONS=true.';
    }

    if (process.env.E2E_TEST_ENVIRONMENT !== 'sandbox') {
      return 'Remote mutation tests require E2E_TEST_ENVIRONMENT=sandbox.';
    }

    if (baseUrl.protocol !== 'https:') {
      return 'Remote mutation tests require HTTPS.';
    }
  }

  return '';
}

/**
 * Use runtime skips after the before hook has completed.
 * Test options such as { skip: !serverAvailable } would evaluate too early.
 */
function defineTest(name, options, callback) {
  test(name, async (t) => {
    if (configurationError) {
      throw configurationError;
    }

    if (!serverAvailable) {
      if (options?.setupCheck) {
        assert.fail(
          `Test server is unavailable at ${BASE_URL_RAW}. Start the isolated test API and try again.`
        );
      }

      t.skip('Test server is unavailable.');
      return;
    }

    if (setupError) {
      if (options?.setupCheck) {
        throw setupError;
      }

      t.skip(
        'Synthetic account setup failed. Fix the suite setup before running these tests.'
      );
      return;
    }

    if (options?.requiresSessions) {
      requireSetup();
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
/* Suite setup                                                                */
/* -------------------------------------------------------------------------- */

before(async () => {
  try {
    validateConfiguration();
  } catch (error) {
    configurationError = error;
    return;
  }

  try {
    const health = await request('/');

    serverAvailable = health.status < 500;
    await health.body?.cancel().catch(() => {});
  } catch {
    serverAvailable = false;
  }

  if (!serverAvailable) {
    return;
  }

  try {
    sessionA = await login(USER_A_EMAIL, USER_A_PASSWORD);
    sessionB = await login(USER_B_EMAIL, USER_B_PASSWORD);
  } catch (error) {
    setupError = error;
  }
});

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

defineTest(
  'IDOR suite requires two authenticated synthetic users',
  { setupCheck: true, requiresSessions: true },
  async () => {
    assert.notEqual(
      USER_A_ID,
      USER_B_ID,
      'User IDs must be different.'
    );

    assert.notEqual(
      USER_A_EMAIL,
      USER_B_EMAIL,
      'User email addresses must be different.'
    );

    assert.ok(sessionA, 'User A must be authenticated.');
    assert.ok(sessionB, 'User B must be authenticated.');
  }
);

defineTest(
  'user A cannot read user B private profile',
  { requiresSessions: true },
  async () => {
    const response = await request(
      objectPath(routes.users, USER_B_ID),
      { headers: authHeaders(sessionA) }
    );

    assertDenied(response, 'Cross-user profile read');
  }
);

defineTest(
  'user A cannot read user B application',
  { requiresSessions: true },
  async () => {
    const response = await request(
      objectPath(routes.applications, APPLICATION_B_ID),
      { headers: authHeaders(sessionA) }
    );

    assertDenied(response, 'Cross-user application read');
  }
);

defineTest(
  'user A cannot modify user B application',
  { requiresSessions: true, mutating: true },
  async () => {
    const response = await request(
      objectPath(routes.applications, APPLICATION_B_ID),
      {
        method: 'PATCH',
        headers: authHeaders(sessionA),
        body: jsonBody({
          status: 'approved',
          userId: USER_A_ID,
          ownerId: USER_A_ID,
        }),
      }
    );

    assertDenied(response, 'Cross-user application modification');
  }
);

defineTest(
  'user A cannot delete user B application',
  { requiresSessions: true, mutating: true },
  async () => {
    const response = await request(
      objectPath(routes.applications, APPLICATION_B_ID),
      {
        method: 'DELETE',
        headers: authHeaders(sessionA),
      }
    );

    assertDenied(response, 'Cross-user application deletion');
  }
);

defineTest(
  'user A cannot download user B document',
  { requiresSessions: true },
  async () => {
    const response = await request(
      objectPath(routes.documents, DOCUMENT_B_ID, '/download'),
      { headers: authHeaders(sessionA) }
    );

    assertDenied(response, 'Cross-user document download');
  }
);

defineTest(
  'user A cannot modify user B document metadata',
  { requiresSessions: true, mutating: true },
  async () => {
    const response = await request(
      objectPath(routes.documents, DOCUMENT_B_ID),
      {
        method: 'PATCH',
        headers: authHeaders(sessionA),
        body: jsonBody({
          title: 'Unauthorized IDOR security-test change',
          userId: USER_A_ID,
          ownerId: USER_A_ID,
        }),
      }
    );

    assertDenied(response, 'Cross-user document modification');
  }
);

defineTest(
  'user B can access their own application',
  { requiresSessions: true },
  async () => {
    const response = await request(
      objectPath(routes.applications, APPLICATION_B_ID),
      { headers: authHeaders(sessionB) }
    );

    assert.equal(
      response.status,
      200,
      'Control check failed: User B should be able to access their own application. Verify the fixture ID and route.'
    );

    const body = await readJson(response);

    assert.ok(
      body && typeof body === 'object',
      'Expected the owner application endpoint to return JSON.'
    );
  }
);

defineTest(
  'user B can access their own document metadata',
  { requiresSessions: true },
  async () => {
    const response = await request(
      objectPath(routes.documents, DOCUMENT_B_ID),
      { headers: authHeaders(sessionB) }
    );

    assert.equal(
      response.status,
      200,
      'Control check failed: User B should be able to access their own document. Verify the fixture ID and route.'
    );

    const body = await readJson(response);

    assert.ok(
      body && typeof body === 'object',
      'Expected the owner document endpoint to return JSON.'
    );
  }
);

defineTest(
  'user A can access their own application',
  { requiresSessions: true },
  async () => {
    const response = await request(
      objectPath(routes.applications, APPLICATION_A_ID),
      { headers: authHeaders(sessionA) }
    );

    assert.equal(
      response.status,
      200,
      'Control check failed: User A should be able to access their own application. Verify the fixture ID and route.'
    );

    const body = await readJson(response);

    assert.ok(
      body && typeof body === 'object',
      'Expected the owner application endpoint to return JSON.'
    );
  }
);

defineTest(
  'user A application response does not expose user B private identifiers',
  { requiresSessions: true },
  async () => {
    const response = await request(
      objectPath(routes.applications, APPLICATION_A_ID),
      { headers: authHeaders(sessionA) }
    );

    assert.equal(
      response.status,
      200,
      'The configured owner must be able to access their own application.'
    );

    const body = await readJson(response);

    assert.ok(
      body && typeof body === 'object',
      'Expected a JSON application response.'
    );

    const serialized = JSON.stringify(body);

    assert.ok(
      !serialized.includes(USER_B_ID),
      'Application response unexpectedly contains User B ID.'
    );

    assert.ok(
      !serialized.includes(USER_B_EMAIL),
      'Application response unexpectedly contains User B email address.'
    );
  }
);

defineTest(
  'unknown user and application identifiers do not cause server errors',
  { requiresSessions: true },
  async () => {
    const paths = [
      objectPath(routes.users, 'nonexistent_idor_security_user'),
      objectPath(
        routes.applications,
        'nonexistent_idor_security_application'
      ),
    ];

    for (const path of paths) {
      const response = await request(path, {
        headers: authHeaders(sessionA),
      });

      assertNoServerError(response, `Unknown-record request ${path}`);
    }
  }
);
