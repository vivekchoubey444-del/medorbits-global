
'use strict';

/**
 * MedOrbits -- Authorization Security Tests
 *
 * File: tests/security/authorization.security.test.js
 *
 * Requirements:
 * - Node.js >= 20
 * - An isolated, reachable test API
 * - Synthetic student and administrator accounts
 * - Pre-created foreign-user and foreign-application fixtures
 *
 * Run read-only authorization tests:
 *   node --test tests/security/authorization.security.test.js
 *
 * Enable PATCH-based security tests only in a dedicated test environment:
 *   NODE_ENV=test E2E_RUN_MUTATING_TESTS=true \
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
 *   E2E_FOREIGN_USER_ID=usr_foreign_001
 *   E2E_OWNED_APPLICATION_ID=app_security_owner_001
 *   E2E_FOREIGN_APPLICATION_ID=app_security_foreign_001
 *   E2E_REQUEST_TIMEOUT_MS=10000
 *   E2E_RUN_MUTATING_TESTS=true
 *   E2E_ALLOW_REMOTE_MUTATIONS=true
 *   E2E_TEST_ENVIRONMENT=sandbox
 *   E2E_ALLOW_CI_MUTATIONS=true
 *
 * Important:
 * - Configure paths and fixture IDs to match your actual API.
 * - Existing fixture IDs must refer to records owned by the intended users.
 * - Never run mutation tests against production.
 * - HTTP status checks alone do not prove persisted state is unchanged.
 */

const { test, before } = require('node:test');
const assert = require('node:assert/strict');

const DEFAULT_TIMEOUT_MS = 10_000;
const ALLOWED_DENIAL_STATUSES = new Set([401, 403, 404]);
const ALLOWED_REJECTION_STATUSES = new Set([
  400, 401, 403, 404, 405, 409, 413, 415, 422, 429,
]);

const BASE_URL_RAW =
  process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

const LOGIN_PATH = process.env.E2E_LOGIN_PATH || '/api/auth/login';
const ME_PATH = process.env.E2E_ME_PATH || '/api/auth/me';
const APPLICATIONS_PATH =
  process.env.E2E_APPLICATIONS_PATH || '/api/applications';
const USERS_PATH = process.env.E2E_USERS_PATH || '/api/users';

const STUDENT_EMAIL =
  process.env.E2E_STUDENT_EMAIL || 'student001@example.test';
const STUDENT_PASSWORD =
  process.env.E2E_STUDENT_PASSWORD || 'TestOnly!Password123';

const ADMIN_EMAIL =
  process.env.E2E_ADMIN_EMAIL || 'admin001@example.test';
const ADMIN_PASSWORD =
  process.env.E2E_ADMIN_PASSWORD || 'AdminTestOnly!Password123';

const FOREIGN_USER_ID =
  process.env.E2E_FOREIGN_USER_ID || 'usr_foreign_001';

const OWNED_APPLICATION_ID =
  process.env.E2E_OWNED_APPLICATION_ID || 'app_security_owner_001';

const FOREIGN_APPLICATION_ID =
  process.env.E2E_FOREIGN_APPLICATION_ID || 'app_security_foreign_001';

const REQUEST_TIMEOUT_MS = parseTimeout(
  process.env.E2E_REQUEST_TIMEOUT_MS
);

const RUN_MUTATING_TESTS =
  process.env.E2E_RUN_MUTATING_TESTS === 'true';

let baseUrl;
let configurationError = null;
let serverAvailable = false;
let setupError = null;
let studentSession = null;
let adminSession = null;

function parseTimeout(value) {
  if (value === undefined || value === '') {
    return DEFAULT_TIMEOUT_MS;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 100 || parsed > 120_000) {
    throw new Error(
      'E2E_REQUEST_TIMEOUT_MS must be an integer between 100 and 120000.'
    );
  }

  return parsed;
}

function validatePath(path, variableName) {
  assert.equal(
    typeof path,
    'string',
    `${variableName} must be a string.`
  );

  assert.ok(
    path.startsWith('/') && !path.startsWith('//'),
    `${variableName} must be an absolute path beginning with one slash.`
  );

  assert.ok(
    !path.includes('?') && !path.includes('#'),
    `${variableName} must not contain a query string or fragment.`
  );

  const parsed = new URL(path, baseUrl);

  assert.equal(
    parsed.origin,
    baseUrl.origin,
    `${variableName} must remain on the configured API origin.`
  );

  return parsed.pathname;
}

function validateConfiguration() {
  let parsed;

  try {
    parsed = new URL(BASE_URL_RAW);
  } catch {
    throw new Error('E2E_BASE_URL must be a valid absolute URL.');
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
    parsed.pathname === '/' || parsed.pathname === '',
    'E2E_BASE_URL must be an origin, such as http://127.0.0.1:3000.'
  );

  baseUrl = new URL(parsed.origin);

  const paths = {
    LOGIN_PATH: validatePath(LOGIN_PATH, 'E2E_LOGIN_PATH'),
    ME_PATH: validatePath(ME_PATH, 'E2E_ME_PATH'),
    APPLICATIONS_PATH: validatePath(
      APPLICATIONS_PATH,
      'E2E_APPLICATIONS_PATH'
    ),
    USERS_PATH: validatePath(USERS_PATH, 'E2E_USERS_PATH'),
  };

  return paths;
}

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
    'Cross-origin requests are not allowed in this test suite.'
  );

  return url;
}

async function request(path, options = {}) {
  const url = urlFor(path);
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
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
    if (error?.name === 'AbortError' || controller.signal.aborted) {
      throw new Error(
        `Request timed out after ${REQUEST_TIMEOUT_MS} ms: ${options.method || 'GET'} ${url.pathname}`
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

async function readResponseBody(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { nonJsonResponse: true, text };
  }
}

function getCookieHeader(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(';', 1)[0].trim())
      .filter(Boolean)
      .join('; ');
  }

  const cookie = response.headers.get('set-cookie');

  if (!cookie) {
    return '';
  }

  // Fallback for runtimes without Headers.getSetCookie().
  // A combined Set-Cookie header may be ambiguous when cookie values
  // contain commas; Node versions exposing getSetCookie() are preferred.
  return cookie.split(';', 1)[0].trim();
}

function extractAccessToken(body) {
  const candidates = [
    body?.accessToken,
    body?.token,
    body?.data?.accessToken,
    body?.data?.token,
    body?.data?.user?.accessToken,
    body?.user?.accessToken,
  ];

  return candidates.find(
    (value) => typeof value === 'string' && value.trim() !== ''
  ) || '';
}

async function login(email, password) {
  const response = await request(LOGIN_PATH, {
    method: 'POST',
    body: jsonBody({ email, password }),
  });

  const body = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(
      `Test account login failed with HTTP ${response.status}. ` +
      'Check the configured synthetic accounts and login route.'
    );
  }

  const cookie = getCookieHeader(response);
  const token = extractAccessToken(body);

  assert.ok(
    cookie || token,
    'Login succeeded but returned neither a session cookie nor a recognized access token. Adapt login() to the API authentication contract.'
  );

  return { cookie, token };
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
    ALLOWED_DENIAL_STATUSES.has(response.status),
    `${context}: expected HTTP 401, 403, or 404; received HTTP ${response.status}.`
  );
}

function assertRejected(response, context) {
  assert.ok(
    ALLOWED_REJECTION_STATUSES.has(response.status),
    `${context}: expected the request to be rejected; received HTTP ${response.status}.`
  );
}

function assertNoServerError(response, context) {
  assert.ok(
    response.status < 500,
    `${context}: received HTTP ${response.status}.`
  );
}

function requireSessions() {
  if (!serverAvailable) {
    throw new Error(`Test server is unavailable at ${baseUrl.origin}.`);
  }

  if (setupError) {
    throw setupError;
  }

  assert.ok(studentSession, 'Student test session is required.');
  assert.ok(adminSession, 'Administrator test session is required.');
}

function mutationSkipReason() {
  if (!RUN_MUTATING_TESTS) {
    return 'Skipped: set E2E_RUN_MUTATING_TESTS=true to enable PATCH security tests.';
  }

  if (process.env.NODE_ENV !== 'test') {
    return 'Skipped: mutation tests require NODE_ENV=test.';
  }

  if (process.env.CI && process.env.E2E_ALLOW_CI_MUTATIONS !== 'true') {
    return 'Skipped: CI mutation tests require E2E_ALLOW_CI_MUTATIONS=true.';
  }

  if (baseUrl && !['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)) {
    if (process.env.E2E_ALLOW_REMOTE_MUTATIONS !== 'true') {
      return 'Skipped: remote mutation tests require E2E_ALLOW_REMOTE_MUTATIONS=true.';
    }

    if (process.env.E2E_TEST_ENVIRONMENT !== 'sandbox') {
      return 'Skipped: remote mutation tests require E2E_TEST_ENVIRONMENT=sandbox.';
    }

    if (baseUrl.protocol !== 'https:') {
      return 'Skipped: remote mutation tests require HTTPS.';
    }
  }

  return '';
}

/**
 * Runtime skip checks are deliberately inside the callback.
 * Using { skip: !serverAvailable } in test() options would evaluate the
 * flag before the before() hook had a chance to set it.
 */
function defineTest(name, options, callback) {
  test(name, async (t) => {
    if (configurationError) {
      throw configurationError;
    }

    if (!serverAvailable) {
      if (name === 'authorization suite requires a reachable test server') {
        assert.fail(
          `Start the isolated test server at ${BASE_URL_RAW} before running this suite.`
        );
      }

      t.skip(`Test server is unavailable at ${BASE_URL_RAW}.`);
      return;
    }

    if (options?.requiresSessions) {
      try {
        requireSessions();
      } catch (error) {
        throw error;
      }
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

before(async () => {
  let paths;

  try {
    paths = validateConfiguration();
  } catch (error) {
    configurationError = error;
    return;
  }

  // Store normalized route paths for consistent URL construction.
  Object.assign(ROUTES, paths);

  try {
    const response = await request('/');

    serverAvailable = response.status < 500;
    await response.body?.cancel().catch(() => {});
  } catch {
    serverAvailable = false;
  }

  if (!serverAvailable) {
    return;
  }

  try {
    studentSession = await login(STUDENT_EMAIL, STUDENT_PASSWORD);
    adminSession = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  } catch (error) {
    setupError = error;
  }
});

const ROUTES = {
  LOGIN_PATH: LOGIN_PATH,
  ME_PATH: ME_PATH,
  APPLICATIONS_PATH: APPLICATIONS_PATH,
  USERS_PATH: USERS_PATH,
};

defineTest(
  'authorization suite requires a reachable test server',
  {},
  async () => {
    assert.ok(serverAvailable);
  }
);

defineTest(
  'unauthenticated user cannot access the protected current-user endpoint',
  {},
  async () => {
    const response = await request(ROUTES.ME_PATH);
    assertDenied(response, 'Unauthenticated current-user request');
  }
);

defineTest(
  'authenticated student can access their own current-user endpoint',
  { requiresSessions: true },
  async () => {
    const response = await request(ROUTES.ME_PATH, {
      headers: authHeaders(studentSession),
    });

    assert.equal(
      response.status,
      200,
      'Expected the authenticated student to access their own profile.'
    );

    const body = await readResponseBody(response);

    assert.ok(
      body && typeof body === 'object' && !body.nonJsonResponse,
      'Expected the current-user endpoint to return JSON.'
    );
  }
);

defineTest(
  'student cannot promote their account through mass assignment',
  { requiresSessions: true, mutating: true },
  async () => {
    const response = await request(ROUTES.ME_PATH, {
      method: 'PATCH',
      headers: authHeaders(studentSession),
      body: jsonBody({
        role: 'super_admin',
        isAdmin: true,
        permissions: ['*'],
      }),
    });

    assertRejected(response, 'Privileged profile update');

    // Check the authenticated view of the account after the attempted update.
    // Adapt the role extraction to your documented response schema if needed.
    const profileResponse = await request(ROUTES.ME_PATH, {
      headers: authHeaders(studentSession),
    });

    assert.equal(
      profileResponse.status,
      200,
      'Student should still be able to retrieve their profile after the rejected update.'
    );

    const profile = await readResponseBody(profileResponse);
    const user =
      profile?.user ||
      profile?.data?.user ||
      profile?.data ||
      profile;

    const role = user?.role;
    const isAdmin = user?.isAdmin;

    if (typeof role === 'string') {
      assert.notEqual(
        role.toLowerCase(),
        'super_admin',
        'Student role must not be promoted to super_admin.'
      );

      assert.notEqual(
        role.toLowerCase(),
        'admin',
        'Student role must not be promoted to admin.'
      );
    }

    if (typeof isAdmin === 'boolean') {
      assert.equal(isAdmin, false, 'Student must not become an administrator.');
    }
  }
);

defineTest(
  'student cannot retrieve another users private record',
  { requiresSessions: true },
  async () => {
    const response = await request(
      `${ROUTES.USERS_PATH}/${encodeURIComponent(FOREIGN_USER_ID)}`,
      { headers: authHeaders(studentSession) }
    );

    assertDenied(response, 'Foreign user record access');
  }
);

defineTest(
  'student cannot retrieve an application owned by another user',
  { requiresSessions: true },
  async () => {
    const response = await request(
      `${ROUTES.APPLICATIONS_PATH}/${encodeURIComponent(FOREIGN_APPLICATION_ID)}`,
      { headers: authHeaders(studentSession) }
    );

    assertDenied(response, 'Foreign application access');
  }
);

defineTest(
  'student cannot modify an application owned by another user',
  { requiresSessions: true, mutating: true },
  async () => {
    const response = await request(
      `${ROUTES.APPLICATIONS_PATH}/${encodeURIComponent(FOREIGN_APPLICATION_ID)}`,
      {
        method: 'PATCH',
        headers: authHeaders(studentSession),
        body: jsonBody({
          status: 'approved',
          ownerId: FOREIGN_USER_ID,
        }),
      }
    );

    assertRejected(response, 'Foreign application update');
  }
);

defineTest(
  'student cannot approve an application through a direct request',
  { requiresSessions: true, mutating: true },
  async () => {
    const response = await request(
      `${ROUTES.APPLICATIONS_PATH}/${encodeURIComponent(OWNED_APPLICATION_ID)}`,
      {
        method: 'PATCH',
        headers: authHeaders(studentSession),
        body: jsonBody({
          status: 'approved',
          approved: true,
        }),
      }
    );

    assertRejected(response, 'Unauthorized application approval');
  }
);

defineTest(
  'student cannot retrieve an administrative user listing',
  { requiresSessions: true },
  async () => {
    const response = await request(ROUTES.USERS_PATH, {
      headers: authHeaders(studentSession),
    });

    assertDenied(response, 'Administrative user listing');
  }
);

defineTest(
  'configured administrator can access the current-user endpoint',
  { requiresSessions: true },
  async () => {
    const response = await request(ROUTES.ME_PATH, {
      headers: authHeaders(adminSession),
    });

    assert.equal(
      response.status,
      200,
      'Expected the configured administrator account to authenticate.'
    );
  }
);

defineTest(
  'unknown record identifiers do not cause server errors',
  { requiresSessions: true },
  async () => {
    const paths = [
      `${ROUTES.USERS_PATH}/nonexistent_security_user`,
      `${ROUTES.APPLICATIONS_PATH}/nonexistent_security_application`,
    ];

    for (const path of paths) {
      const response = await request(path, {
        headers: authHeaders(studentSession),
      });

      assertNoServerError(response, `Request to ${path}`);
    }
  }
);
