
'use strict';

/**
 * MedOrbits -- Authentication Integration Tests
 * File: tests/integration/auth.integration.test.js
 *
 * Requirements:
 * - Node.js >= 20
 * - Running integration-test API
 * - Dedicated test database
 *
 * IMPORTANT:
 * - Match paths and payload fields to the actual API.
 * - Registration tests create accounts.
 * - Never run mutating tests against production.
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const BASE_URL = (
  process.env.AUTH_TEST_BASE_URL ||
  process.env.TEST_BASE_URL ||
  'http://127.0.0.1:3000'
).replace(/\/+$/, '');

const REGISTER_PATH =
  process.env.AUTH_REGISTER_PATH || '/api/auth/register';

const LOGIN_PATH =
  process.env.AUTH_LOGIN_PATH || '/api/auth/login';

const ME_PATH =
  process.env.AUTH_ME_PATH || '/api/auth/me';

const LOGOUT_PATH =
  process.env.AUTH_LOGOUT_PATH || '/api/auth/logout';

const PROTECTED_PATH =
  process.env.AUTH_PROTECTED_TEST_PATH || '/api/users/me';

const TEST_PASSWORD =
  process.env.AUTH_TEST_PASSWORD || 'Integration-Test-Password-92!';

const TIMEOUT_MS = Number(
  process.env.AUTH_TEST_TIMEOUT_MS || 15000
);

const RUN_MUTATING_TESTS =
  process.env.RUN_AUTH_MUTATING_TESTS === 'true';

const ALLOW_REMOTE_MUTATIONS =
  process.env.AUTH_TEST_ALLOW_REMOTE_MUTATIONS === 'true';

const SUCCESS_STATUSES = [200, 201, 202];

function validateConfiguration() {
  let base;

  try {
    base = new URL(BASE_URL);
  } catch {
    assert.fail('AUTH_TEST_BASE_URL must be a valid absolute URL.');
  }

  assert.ok(
    ['http:', 'https:'].includes(base.protocol),
    'The test URL must use HTTP or HTTPS.'
  );

  for (const [name, path] of Object.entries({
    AUTH_REGISTER_PATH: REGISTER_PATH,
    AUTH_LOGIN_PATH: LOGIN_PATH,
    AUTH_ME_PATH: ME_PATH,
    AUTH_LOGOUT_PATH: LOGOUT_PATH,
    AUTH_PROTECTED_TEST_PATH: PROTECTED_PATH,
  })) {
    assert.ok(
      typeof path === 'string' &&
        path.startsWith('/') &&
        !path.startsWith('//') &&
        !/[\r\n]/.test(path),
      `${name} must be a valid origin-relative path.`
    );
  }

  assert.ok(
    Number.isFinite(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'AUTH_TEST_TIMEOUT_MS must be a positive number.'
  );

  assert.ok(
    typeof TEST_PASSWORD === 'string' &&
      TEST_PASSWORD.length >= 12,
    'AUTH_TEST_PASSWORD must contain at least 12 characters.'
  );

  if (RUN_MUTATING_TESTS) {
    assert.equal(
      process.env.NODE_ENV,
      'test',
      'Mutating tests require NODE_ENV=test.'
    );

    assert.ok(
      ['localhost', '127.0.0.1', '::1'].includes(base.hostname) ||
        ALLOW_REMOTE_MUTATIONS,
      'Remote mutations require AUTH_TEST_ALLOW_REMOTE_MUTATIONS=true.'
    );
  }
}

function buildUrl(path) {
  const url = new URL(path, `${BASE_URL}/`);

  assert.equal(
    url.origin,
    new URL(BASE_URL).origin,
    'Request URL must remain on the configured test origin.'
  );

  return url.toString();
}

async function apiRequest(
  path,
  {
    method = 'GET',
    token,
    body,
    headers = {},
  } = {}
) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(buildUrl(path), {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      redirect: 'manual',
    });

    const rawBody = await response.text();

    let parsedBody = null;

    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = rawBody;
      }
    }

    return {
      status: response.status,
      headers: response.headers,
      body: parsedBody,
      rawBody,
    };
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${TIMEOUT_MS} ms: ${method} ${path}`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function uniqueEmail() {
  return `auth-test-${crypto.randomUUID()}@example.com`;
}

function registrationPayload(overrides = {}) {
  return {
    name: 'MedOrbits Integration Test',
    email: uniqueEmail(),
    password: TEST_PASSWORD,
    ...overrides,
  };
}

function extractUser(response) {
  const body = response.body;

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return null;
  }

  const user = body.user ?? body.data?.user ?? body.data ?? body;

  return user &&
    typeof user === 'object' &&
    !Array.isArray(user)
    ? user
    : null;
}

function extractToken(response) {
  const body = response.body;

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return null;
  }

  const token =
    body.accessToken ??
    body.access_token ??
    body.token ??
    body.data?.accessToken ??
    body.data?.access_token ??
    body.data?.token ??
    null;

  return typeof token === 'string' && token.length > 0
    ? token
    : null;
}

function assertNoServerError(response, label) {
  assert.ok(
    response.status < 500,
    `${label}: unexpected HTTP ${response.status}.`
  );
}

function assertRejected(response, label) {
  assert.ok(
    [400, 401, 403, 404, 405, 409, 413, 415, 422, 429].includes(
      response.status
    ),
    `${label}: expected a client-error response, received HTTP ${response.status}.`
  );
}

function assertNoPasswordDisclosure(response, label) {
  const user = extractUser(response);

  if (!user) {
    return;
  }

  for (const field of [
    'password',
    'passwordHash',
    'password_hash',
  ]) {
    assert.equal(
      Object.hasOwn(user, field),
      false,
      `${label} must not expose ${field}.`
    );
  }
}

function requireMutatingTests() {
  assert.equal(
    RUN_MUTATING_TESTS,
    true,
    'Set RUN_AUTH_MUTATING_TESTS=true only for an isolated test environment.'
  );

  assert.equal(
    process.env.NODE_ENV,
    'test',
    'Mutating tests require NODE_ENV=test.'
  );
}

async function registerTestUser() {
  requireMutatingTests();

  const credentials = registrationPayload();

  const response = await apiRequest(REGISTER_PATH, {
    method: 'POST',
    body: credentials,
  });

  assertNoServerError(response, 'Test user registration');

  assert.ok(
    SUCCESS_STATUSES.includes(response.status),
    `Test registration failed with HTTP ${response.status}.`
  );

  assertNoPasswordDisclosure(response, 'Registration response');

  return { credentials, response };
}

async function loginTestUser(credentials) {
  const response = await apiRequest(LOGIN_PATH, {
    method: 'POST',
    body: {
      email: credentials.email,
      password: credentials.password,
    },
  });

  assertNoServerError(response, 'Test user login');

  assert.ok(
    [200, 201].includes(response.status),
    `Test login failed with HTTP ${response.status}.`
  );

  assertNoPasswordDisclosure(response, 'Login response');

  const token = extractToken(response);

  assert.ok(
    token,
    'Login response did not contain a recognized access token.'
  );

  return { response, token };
}

describe('MedOrbits authentication integration tests', () => {
  before(() => {
    validateConfiguration();
  });

  describe('endpoint availability', () => {
    it('responds to an authentication request without an internal server error', async () => {
      const response = await apiRequest(LOGIN_PATH, {
        method: 'POST',
        body: {
          email: `unknown-${crypto.randomUUID()}@example.com`,
          password: 'Invalid-Test-Password-92!',
        },
      });

      assertNoServerError(response, 'Login endpoint');

      assert.ok(
        [200, 400, 401, 404, 405, 415, 422, 429].includes(
          response.status
        ),
        `Unexpected login endpoint response: HTTP ${response.status}.`
      );
    });
  });

  describe('registration', () => {
    it(
      'registers a new user with valid input without exposing a password',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const { credentials, response } = await registerTestUser();

        const user = extractUser(response);

        if (user) {
          assert.equal(
            String(user.email || '').toLowerCase(),
            credentials.email.toLowerCase(),
            'Registered email does not match the submitted email.'
          );

          assert.notEqual(
            user.role,
            'admin',
            'Public registration must not create an administrator.'
          );

          assert.notEqual(
            user.isAdmin,
            true,
            'Public registration must not grant administrator privileges.'
          );
        }
      }
    );

    it(
      'rejects registration with a malformed email address',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        requireMutatingTests();

        const response = await apiRequest(REGISTER_PATH, {
          method: 'POST',
          body: registrationPayload({
            email: 'invalid-email-address',
          }),
        });

        assertNoServerError(response, 'Malformed registration email');
        assertRejected(response, 'Malformed registration email');
      }
    );

    it(
      'rejects registration with a missing password',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        requireMutatingTests();

        const payload = registrationPayload();
        delete payload.password;

        const response = await apiRequest(REGISTER_PATH, {
          method: 'POST',
          body: payload,
        });

        assertNoServerError(response, 'Missing registration password');
        assertRejected(response, 'Missing registration password');
      }
    );

    it(
      'does not grant administrator privileges through registration fields',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        requireMutatingTests();

        const response = await apiRequest(REGISTER_PATH, {
          method: 'POST',
          body: registrationPayload({
            role: 'admin',
            isAdmin: true,
            permissions: ['*'],
            verified: true,
          }),
        });

        assertNoServerError(
          response,
          'Privilege injection during registration'
        );

        if (!SUCCESS_STATUSES.includes(response.status)) {
          assertRejected(
            response,
            'Privilege injection during registration'
          );
          return;
        }

        const user = extractUser(response);

        assert.ok(
          user,
          'Successful registration must return a documented user object.'
        );

        assert.notEqual(user.role, 'admin');
        assert.notEqual(user.isAdmin, true);
        assert.notDeepEqual(user.permissions, ['*']);
        assert.notEqual(user.verified, true);

        assertNoPasswordDisclosure(
          response,
          'Privilege injection registration response'
        );
      }
    );
  });

  describe('login', () => {
    it('rejects invalid credentials without issuing an access token', async () => {
      const response = await apiRequest(LOGIN_PATH, {
        method: 'POST',
        body: {
          email: `unknown-${crypto.randomUUID()}@example.com`,
          password: 'Invalid-Password-92!',
        },
      });

      assertNoServerError(response, 'Invalid login credentials');
      assertRejected(response, 'Invalid login credentials');

      assert.equal(
        extractToken(response),
        null,
        'Invalid credentials must not produce an access token.'
      );

      assertNoPasswordDisclosure(response, 'Invalid login response');
    });

    it(
      'allows a newly registered user to log in',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const { credentials } = await registerTestUser();
        const { token } = await loginTestUser(credentials);

        assert.ok(
          typeof token === 'string' && token.length > 0,
          'Successful login must return a non-empty token.'
        );
      }
    );

    it('does not expose password fields in the login response', async () => {
      const response = await apiRequest(LOGIN_PATH, {
        method: 'POST',
        body: {
          email: `unknown-${crypto.randomUUID()}@example.com`,
          password: 'Invalid-Password-92!',
        },
      });

      assertNoServerError(response, 'Login response disclosure');
      assertNoPasswordDisclosure(response, 'Login response');
    });
  });

  describe('token and protected-route behaviour', () => {
    it('rejects an invalid bearer token on a protected endpoint', async () => {
      const response = await apiRequest(PROTECTED_PATH, {
        token: 'invalid.token.value',
      });

      assertNoServerError(response, 'Invalid bearer token');

      assert.ok(
        [401, 403, 404].includes(response.status),
        `Invalid token was not denied: HTTP ${response.status}.`
      );
    });

    it('does not treat an empty bearer token as authenticated', async () => {
      const response = await apiRequest(PROTECTED_PATH, {
        headers: {
          Authorization: 'Bearer ',
        },
      });

      assertNoServerError(response, 'Empty bearer token');

      assert.ok(
        [401, 403, 404].includes(response.status),
        `Empty bearer token was not denied: HTTP ${response.status}.`
      );
    });

    it(
      'allows an authenticated user to access their profile',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const { credentials } = await registerTestUser();
        const { token } = await loginTestUser(credentials);

        const response = await apiRequest(ME_PATH, { token });

        assertNoServerError(
          response,
          'Authenticated profile request'
        );

        assert.equal(
          response.status,
          200,
          `Authenticated profile request failed: HTTP ${response.status}.`
        );

        assertNoPasswordDisclosure(
          response,
          'Authenticated profile response'
        );
      }
    );
  });

  describe('logout', () => {
    it(
      'accepts logout for an authenticated session',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const { credentials } = await registerTestUser();
        const { token } = await loginTestUser(credentials);

        const response = await apiRequest(LOGOUT_PATH, {
          method: 'POST',
          token,
        });

        assertNoServerError(response, 'Authenticated logout');

        assert.ok(
          [200, 202, 204].includes(response.status),
          `Logout failed: HTTP ${response.status}.`
        );
      }
    );
  });
});
