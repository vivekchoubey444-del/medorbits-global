'use strict';
/**
 * MedOrbits -- Authentication Integration Tests
 * File: tests/integration/auth.integration.test.js
 *
 * Requirements:
 * - Node.js >= 20
 * - Running integration-test API
 * - Dedicated, isolated test database for mutating tests
 *
 * Safety:
 * - Account-creating tests are disabled by default.
 * - Production environments are rejected.
 * - Remote targets require explicit opt-in and HTTPS.
 * - Remote mutations require a second explicit opt-in.
 * - Never use production credentials or production databases.
 *
 * Configure actual endpoint paths and payload fields to match the API.
 */
const {
  describe,
  it,
  before,
} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------
const BASE_URL = (
  process.env.AUTH_TEST_BASE_URL ||
  process.env.TEST_BASE_URL ||
  'http://127.0.0.1:3000'
).replace(/\/+$/, '');
const REGISTER_PATH =
  process.env.AUTH_REGISTER_PATH ||
  '/api/auth/register';
const LOGIN_PATH =
  process.env.AUTH_LOGIN_PATH ||
  '/api/auth/login';
const ME_PATH =
  process.env.AUTH_ME_PATH ||
  '/api/auth/me';
const LOGOUT_PATH =
  process.env.AUTH_LOGOUT_PATH ||
  '/api/auth/logout';
const PROTECTED_PATH =
  process.env.AUTH_PROTECTED_TEST_PATH ||
  '/api/users/me';
const TEST_PASSWORD =
  process.env.AUTH_TEST_PASSWORD ||
  'Integration-Test-Password-92!';
const TIMEOUT_MS = Number(
  process.env.AUTH_TEST_TIMEOUT_MS || 15000
);
const RUN_MUTATING_TESTS =
  process.env.RUN_AUTH_MUTATING_TESTS === 'true';
const ALLOW_REMOTE_TESTS =
  process.env.AUTH_TEST_ALLOW_REMOTE === 'true';
const ALLOW_REMOTE_MUTATIONS =
  process.env.AUTH_TEST_ALLOW_REMOTE_MUTATIONS === 'true';
const SUCCESS_STATUSES = [200, 201, 202];
const CLIENT_ERROR_STATUSES = [
  400,
  401,
  403,
  404,
  405,
  409,
  413,
  415,
  422,
  429,
];
const AUTH_DENIAL_STATUSES = [401, 403];
let configuredOrigin;
// -----------------------------------------------------------------------------
// Configuration validation and safety guards
// -----------------------------------------------------------------------------
function isLoopbackHostname(hostname) {
  const normalized = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  return [
    'localhost',
    '127.0.0.1',
    '::1',
  ].includes(normalized);
}
function validatePath(name, path) {
  assert.ok(
    typeof path === 'string' &&
      path.startsWith('/') &&
      !path.startsWith('//') &&
      !/[\\\r\n]/.test(path),
    `${name} must be an origin-relative path.`
  );
  const parsed = new URL(path, BASE_URL);
  assert.equal(
    parsed.origin,
    configuredOrigin,
    `${name} must not change the configured request origin.`
  );
  assert.equal(
    parsed.username,
    '',
    `${name} must not contain URL credentials.`
  );
  assert.equal(
    parsed.password,
    '',
    `${name} must not contain URL credentials.`
  );
}
function validateConfiguration() {
  let base;
  try {
    base = new URL(BASE_URL);
  } catch {
    assert.fail(
      'AUTH_TEST_BASE_URL must be a valid absolute URL.'
    );
  }
  assert.ok(
    ['http:', 'https:'].includes(base.protocol),
    'The API URL must use HTTP or HTTPS.'
  );
  assert.equal(
    base.username,
    '',
    'Do not include credentials in AUTH_TEST_BASE_URL.'
  );
  assert.equal(
    base.password,
    '',
    'Do not include credentials in AUTH_TEST_BASE_URL.'
  );
  assert.equal(
    base.search,
    '',
    'AUTH_TEST_BASE_URL must not contain query parameters.'
  );
  assert.equal(
    base.hash,
    '',
    'AUTH_TEST_BASE_URL must not contain a URL fragment.'
  );
  assert.ok(
    process.env.NODE_ENV !== 'production',
    'Authentication integration tests must not run with NODE_ENV=production.'
  );
  assert.ok(
    Number.isFinite(TIMEOUT_MS) &&
      Number.isInteger(TIMEOUT_MS) &&
      TIMEOUT_MS > 0 &&
      TIMEOUT_MS <= 120000,
    'AUTH_TEST_TIMEOUT_MS must be an integer between 1 and 120000.'
  );
  assert.ok(
    typeof TEST_PASSWORD === 'string' &&
      TEST_PASSWORD.length >= 12,
    'AUTH_TEST_PASSWORD must contain at least 12 characters.'
  );
  configuredOrigin = base.origin;
  const isLoopback = isLoopbackHostname(base.hostname);
  if (!isLoopback) {
    assert.equal(
      ALLOW_REMOTE_TESTS,
      true,
      'Remote tests require AUTH_TEST_ALLOW_REMOTE=true.'
    );
    assert.equal(
      base.protocol,
      'https:',
      'Remote test targets must use HTTPS.'
    );
  }
  for (const [name, path] of Object.entries({
    AUTH_REGISTER_PATH: REGISTER_PATH,
    AUTH_LOGIN_PATH: LOGIN_PATH,
    AUTH_ME_PATH: ME_PATH,
    AUTH_LOGOUT_PATH: LOGOUT_PATH,
    AUTH_PROTECTED_TEST_PATH: PROTECTED_PATH,
  })) {
    validatePath(name, path);
  }
  if (RUN_MUTATING_TESTS) {
    assert.equal(
      process.env.NODE_ENV,
      'test',
      'Mutating tests require NODE_ENV=test.'
    );
    if (!isLoopback) {
      assert.equal(
        ALLOW_REMOTE_MUTATIONS,
        true,
        'Remote mutations require AUTH_TEST_ALLOW_REMOTE_MUTATIONS=true.'
      );
    }
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
function buildUrl(path) {
  const url = new URL(path, `${BASE_URL}/`);
  assert.equal(
    url.origin,
    configuredOrigin,
    'Request URL must remain on the configured test origin.'
  );
  assert.ok(
    !url.username && !url.password,
    'Request URLs must not contain credentials.'
  );
  return url.toString();
}
// -----------------------------------------------------------------------------
// HTTP helpers
// -----------------------------------------------------------------------------
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
  if (token !== undefined) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }
  try {
    const response = await fetch(buildUrl(path), {
      method,
      headers: requestHeaders,
      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
      signal: controller.signal,
      redirect: 'manual',
    });
    const rawBody = await response.text();
    let parsedBody = null;
    if (rawBody.length > 0) {
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
        `Request timed out after ${TIMEOUT_MS} ms: ` +
          `${method} ${path}`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
function uniqueEmail() {
  return (
    `auth-test-${crypto.randomUUID()}@example.com`
  );
}
function registrationPayload(overrides = {}) {
  return {
    name: 'MedOrbits Integration Test',
    email: uniqueEmail(),
    password: TEST_PASSWORD,
    ...overrides,
  };
}
// -----------------------------------------------------------------------------
// Response extraction and security assertions
// -----------------------------------------------------------------------------
function extractUser(response) {
  const body = response.body;
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return null;
  }
  const user =
    body.user ??
    body.data?.user ??
    body.data ??
    body;
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
  return typeof token === 'string' &&
    token.trim().length > 0
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
    CLIENT_ERROR_STATUSES.includes(response.status),
    `${label}: expected a client-error response, ` +
      `received HTTP ${response.status}.`
  );
}
function assertAuthenticationDenied(response, label) {
  assert.ok(
    AUTH_DENIAL_STATUSES.includes(response.status),
    `${label}: expected HTTP 401 or 403, ` +
      `received HTTP ${response.status}. ` +
      'Verify the protected route exists and uses authentication middleware.'
  );
}
/**
 * Recursively checks JSON response objects for common password fields.
 *
 * This covers nested response wrappers as well as user objects.
 * Non-JSON response bodies are not interpreted as structured user data.
 */
function assertNoPasswordDisclosure(response, label) {
  const body = response.body;
  if (
    !body ||
    typeof body !== 'object'
  ) {
    return;
  }
  const forbiddenKeys = new Set([
    'password',
    'passwordhash',
    'password_hash',
    'hashedpassword',
    'hashed_password',
    'currentpassword',
    'current_password',
  ]);
  const visited = new Set();
  function inspect(value, location) {
    if (
      !value ||
      typeof value !== 'object' ||
      visited.has(value)
    ) {
      return;
    }
    visited.add(value);
    for (const [key, nestedValue] of Object.entries(value)) {
      const normalizedKey = key
        .replace(/[-\s]/g, '')
        .toLowerCase();
      assert.equal(
        forbiddenKeys.has(normalizedKey),
        false,
        `${label} must not expose a password field at ` +
          `${location}.${key}.`
      );
      inspect(
        nestedValue,
        `${location}.${key}`
      );
    }
  }
  inspect(body, '$');
}
function assertNoAdministratorPrivileges(user, label) {
  assert.ok(
    user &&
      typeof user === 'object' &&
      !Array.isArray(user),
    `${label}: expected a user object.`
  );
  assert.notEqual(
    String(user.role ?? '').toLowerCase(),
    'admin',
    `${label}: public registration must not grant the admin role.`
  );
  assert.notEqual(
    user.isAdmin,
    true,
    `${label}: public registration must not grant administrator privileges.`
  );
  assert.notEqual(
    user.is_admin,
    true,
    `${label}: public registration must not grant administrator privileges.`
  );
  assert.notDeepEqual(
    user.permissions,
    ['*'],
    `${label}: public registration must not grant wildcard permissions.`
  );
  assert.notEqual(
    user.verified,
    true,
    `${label}: public registration must not grant verified status.`
  );
  assert.notEqual(
    user.isVerified,
    true,
    `${label}: public registration must not grant verified status.`
  );
  assert.notEqual(
    user.is_verified,
    true,
    `${label}: public registration must not grant verified status.`
  );
}
// -----------------------------------------------------------------------------
// Test-account helpers
// -----------------------------------------------------------------------------
async function registerTestUser() {
  requireMutatingTests();
  const credentials = registrationPayload();
  const response = await apiRequest(REGISTER_PATH, {
    method: 'POST',
    body: credentials,
  });
  assertNoServerError(
    response,
    'Test user registration'
  );
  assert.ok(
    SUCCESS_STATUSES.includes(response.status),
    `Test registration failed with HTTP ${response.status}.`
  );
  assertNoPasswordDisclosure(
    response,
    'Registration response'
  );
  const user = extractUser(response);
  if (user) {
    assert.equal(
      String(user.email ?? '').toLowerCase(),
      credentials.email.toLowerCase(),
      'Registered email does not match the submitted email.'
    );
    assertNoAdministratorPrivileges(
      user,
      'Registered user'
    );
  }
  return {
    credentials,
    response,
  };
}
async function loginTestUser(credentials) {
  const response = await apiRequest(LOGIN_PATH, {
    method: 'POST',
    body: {
      email: credentials.email,
      password: credentials.password,
    },
  });
  assertNoServerError(
    response,
    'Test user login'
  );
  assert.equal(
    response.status,
    200,
    `Test login failed with HTTP ${response.status}.`
  );
  assertNoPasswordDisclosure(
    response,
    'Login response'
  );
  const token = extractToken(response);
  assert.ok(
    token,
    'Login response did not contain a recognized access token. ' +
      'Update extractToken() if the API uses another response field.'
  );
  return {
    response,
    token,
  };
}
// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------
describe('MedOrbits authentication integration tests', () => {
  before(() => {
    validateConfiguration();
  });
  // ---------------------------------------------------------------------------
  // Endpoint availability and baseline behaviour
  // ---------------------------------------------------------------------------
  describe('endpoint availability', () => {
    it('handles an invalid login without returning a server error', async () => {
      const response = await apiRequest(LOGIN_PATH, {
        method: 'POST',
        body: {
          email: `unknown-${crypto.randomUUID()}@example.com`,
          password: 'Invalid-Test-Password-92!',
        },
      });
      assertNoServerError(
        response,
        'Login endpoint'
      );
      assert.ok(
        CLIENT_ERROR_STATUSES.includes(response.status),
        `Invalid login should be rejected; received HTTP ${response.status}.`
      );
      assert.equal(
        extractToken(response),
        null,
        'Invalid credentials must not produce an access token.'
      );
      assertNoPasswordDisclosure(
        response,
        'Invalid login response'
      );
    });
  });
  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------
  describe('registration', () => {
    it(
      'registers a new user with valid input without exposing a password',
      {
        skip: !RUN_MUTATING_TESTS,
      },
      async () => {
        const { credentials, response } =
          await registerTestUser();
        const user = extractUser(response);
        if (user) {
          assert.equal(
            String(user.email ?? '').toLowerCase(),
            credentials.email.toLowerCase(),
            'Registered email does not match the submitted email.'
          );
          assertNoAdministratorPrivileges(
            user,
            'Registration response'
          );
        }
      }
    );
    it(
      'rejects a malformed email address',
      {
        skip: !RUN_MUTATING_TESTS,
      },
      async () => {
        requireMutatingTests();
        const response = await apiRequest(REGISTER_PATH, {
          method: 'POST',
          body: registrationPayload({
            email: 'invalid-email-address',
          }),
        });
        assertNoServerError(
          response,
          'Malformed registration email'
        );
        assertRejected(
          response,
          'Malformed registration email'
        );
        assertNoPasswordDisclosure(
          response,
          'Malformed registration response'
        );
      }
    );
    it(
      'rejects registration with a missing password',
      {
        skip: !RUN_MUTATING_TESTS,
      },
      async () => {
        requireMutatingTests();
        const payload = registrationPayload();
        delete payload.password;
        const response = await apiRequest(REGISTER_PATH, {
          method: 'POST',
          body: payload,
        });
        assertNoServerError(
          response,
          'Missing registration password'
        );
        assertRejected(
          response,
          'Missing registration password'
        );
      }
    );
    it(
      'rejects a missing email address',
      {
        skip: !RUN_MUTATING_TESTS,
      },
      async () => {
        requireMutatingTests();
        const payload = registrationPayload();
        delete payload.email;
        const response = await apiRequest(REGISTER_PATH, {
          method: 'POST',
          body: payload,
        });
        assertNoServerError(
          response,
          'Missing registration email'
        );
        assertRejected(
          response,
          'Missing registration email'
        );
      }
    );
    it(
      'rejects a weak password when the API enforces password strength',
      {
        skip: !RUN_MUTATING_TESTS,
      },
      async () => {
        requireMutatingTests();
        const response = await apiRequest(REGISTER_PATH, {
          method: 'POST',
          body: registrationPayload({
            password: '123',
          }),
        });
        assertNoServerError(
          response,
          'Weak registration password'
        );
        assertRejected(
          response,
          'Weak registration password'
        );
      }
    );
    it(
      'rejects duplicate registration for the same email',
      {
        skip: !RUN_MUTATING_TESTS,
      },
      async () => {
        const { credentials } = await registerTestUser();
        const duplicateResponse = await apiRequest(
          REGISTER_PATH,
          {
            method: 'POST',
            body: {
              ...credentials,
              name: 'Duplicate Registration Attempt',
            },
          }
        );
        assertNoServerError(
          duplicateResponse,
          'Duplicate email registration'
        );
        assert.ok(
          [400, 409, 422].includes(
            duplicateResponse.status
          ),
          'Duplicate email registration should be rejected ' +
            `with HTTP 400, 409 or 422; received HTTP ${duplicateResponse.status}.`
        );
        assert.equal(
          extractToken(duplicateResponse),
          null,
          'Duplicate registration must not issue a new access token.'
        );
        assertNoPasswordDisclosure(
          duplicateResponse,
          'Duplicate registration response'
        );
      }
    );
    it(
      'does not grant administrator privileges through registration fields',
      {
        skip: !RUN_MUTATING_TESTS,
      },
      async () => {
        requireMutatingTests();
        const response = await apiRequest(REGISTER_PATH, {
          method: 'POST',
          body: registrationPayload({
            role: 'admin',
            isAdmin: true,
            is_admin: true,
            permissions: ['*'],
            verified: true,
            isVerified: true,
            is_verified: true,
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
          'Successful registration must return a user object ' +
            'for this privilege-escalation assertion.'
        );
        assertNoAdministratorPrivileges(
          user,
          'Privilege injection registration response'
        );
        assertNoPasswordDisclosure(
          response,
          'Privilege injection registration response'
        );
      }
    );
  });
  // ---------------------------------------------------------------------------
  // Login and credential handling
  // ---------------------------------------------------------------------------
  describe('login', () => {
    it('rejects invalid credentials without issuing an access token', async () => {
      const response = await apiRequest(LOGIN_PATH, {
        method: 'POST',
        body: {
          email: `unknown-${crypto.randomUUID()}@example.com`,
          password: 'Invalid-Password-92!',
        },
      });
      assertNoServerError(
        response,
        'Invalid login credentials'
      );
      assertRejected(
        response,
        'Invalid login credentials'
      );
      assert.equal(
        extractToken(response),
        null,
        'Invalid credentials must not produce an access token.'
      );
      assertNoPasswordDisclosure(
        response,
        'Invalid login response'
      );
    });
    it(
      'allows a newly registered user to log in',
      {
        skip: !RUN_MUTATING_TESTS,
      },
      async () => {
        const { credentials } =
          await registerTestUser();
        const { token } =
          await loginTestUser(credentials);
        assert.ok(
          typeof token === 'string' &&
            token.length > 0,
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
      assertNoServerError(
        response,
        'Login response disclosure'
      );
      assertNoPasswordDisclosure(
        response,
        'Login response'
      );
    });
    it(
      'rejects a missing password',
      {
        skip: !RUN_MUTATING_TESTS,
      },
      async () => {
        const response = await apiRequest(LOGIN_PATH, {
          method: 'POST',
          body: {
            email: uniqueEmail(),
          },
        });
        assertNoServerError(
          response,
          'Missing login password'
        );
        assertRejected(
          response,
          'Missing login password'
        );
        assert.equal(
          extractToken(response),
          null,
          'A missing password must not produce an access token.'
        );
      }
    );
  });
  // ---------------------------------------------------------------------------
  // Bearer tokens and protected routes
  // ---------------------------------------------------------------------------
  describe('token and protected-route behaviour', () => {
    it('rejects an invalid bearer token on a protected endpoint', async () => {
      const response = await apiRequest(PROTECTED_PATH, {
        token: 'invalid.token.value',
      });
      assertNoServerError(
        response,
        'Invalid bearer token'
      );
      assertAuthenticationDenied(
        response,
        'Invalid bearer token'
      );
      assertNoPasswordDisclosure(
        response,
        'Invalid bearer token response'
      );
    });
    it('does not treat an empty bearer token as authenticated', async () => {
      const response = await apiRequest(PROTECTED_PATH, {
        headers: {
          Authorization: 'Bearer ',
        },
      });
      assertNoServerError(
        response,
        'Empty bearer token'
      );
      assertAuthenticationDenied(
        response,
        'Empty bearer token'
      );
    });
    it('rejects a request without an authorization header', async () => {
      const response = await apiRequest(PROTECTED_PATH);
      assertNoServerError(
        response,
        'Missing authorization header'
      );
      assertAuthenticationDenied(
        response,
        'Missing authorization header'
      );
    });
    it(
      'allows an authenticated user to access their profile',
      {
        skip: !RUN_MUTATING_TESTS,
      },
      async () => {
        const { credentials } =
          await registerTestUser();
        const { token } =
          await loginTestUser(credentials);
        const response = await apiRequest(ME_PATH, {
          token,
        });
        assertNoServerError(
          response,
          'Authenticated profile request'
        );
        assert.equal(
          response.status,
          200,
          'Authenticated profile request must return HTTP 200; ' +
            `received HTTP ${response.status}.`
        );
        assertNoPasswordDisclosure(
          response,
          'Authenticated profile response'
        );
        const user = extractUser(response);
        if (user && user.email !== undefined) {
          assert.equal(
            String(user.email).toLowerCase(),
            credentials.email.toLowerCase(),
            'Profile response must belong to the authenticated user.'
          );
        }
      }
    );
  });
  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------
  describe('logout', () => {
    it(
      'accepts logout for an authenticated session',
      {
        skip: !RUN_MUTATING_TESTS,
      },
      async () => {
        const { credentials } =
          await registerTestUser();
        const { token } =
          await loginTestUser(credentials);
        const response = await apiRequest(LOGOUT_PATH, {
          method: 'POST',
          token,
        });
        assertNoServerError(
          response,
          'Authenticated logout'
        );
        assert.ok(
          [200, 202, 204].includes(response.status),
          'Logout should return HTTP 200, 202 or 204; ' +
            `received HTTP ${response.status}.`
        );
        assertNoPasswordDisclosure(
          response,
          'Logout response'
        );
      }
    );
  });
});