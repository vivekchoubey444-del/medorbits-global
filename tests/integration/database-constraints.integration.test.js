
'use strict';

/**
 * MedOrbits -- Database Constraints Integration Tests
 * File: tests/integration/database-constraints.integration.test.js
 *
 * Requirements:
 * - Node.js >= 20
 * - Running integration-test API
 * - Dedicated test database
 *
 * Coverage:
 * - Unique account email enforcement
 * - Required-field validation
 * - Invalid foreign-key/reference rejection
 * - Invalid record identifiers
 * - Error disclosure and persistence consistency
 *
 * IMPORTANT:
 * These tests exercise the API and persistence layer together.
 * They do not directly inspect database constraints.
 * Never run mutating tests against production.
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const BASE_URL = (
  process.env.DB_CONSTRAINT_TEST_BASE_URL ||
  process.env.TEST_BASE_URL ||
  'http://127.0.0.1:3000'
).replace(/\/+$/, '');

const REGISTER_PATH =
  process.env.DB_CONSTRAINT_REGISTER_PATH ||
  '/api/auth/register';

const LOGIN_PATH =
  process.env.DB_CONSTRAINT_LOGIN_PATH ||
  '/api/auth/login';

const APPLICATIONS_PATH =
  process.env.DB_CONSTRAINT_APPLICATIONS_PATH ||
  '/api/applications';

const APPLICATION_PATH =
  process.env.DB_CONSTRAINT_APPLICATION_PATH ||
  '/api/applications/:id';

const USER_TOKEN =
  process.env.DB_CONSTRAINT_TEST_USER_TOKEN || '';

const TEST_PASSWORD =
  process.env.DB_CONSTRAINT_TEST_PASSWORD ||
  'Database-Constraint-Test-92!';

const TIMEOUT_MS = Number(
  process.env.DB_CONSTRAINT_TIMEOUT_MS || 15000
);

const RUN_MUTATING_TESTS =
  process.env.RUN_DB_CONSTRAINT_MUTATING_TESTS === 'true';

const ALLOW_REMOTE_MUTATIONS =
  process.env.DB_CONSTRAINT_ALLOW_REMOTE_MUTATIONS === 'true';

const APPLICATION_REFERENCE_FIELD =
  process.env.DB_CONSTRAINT_REFERENCE_FIELD || '';

const INVALID_REFERENCE_VALUE =
  process.env.DB_CONSTRAINT_INVALID_REFERENCE_VALUE ||
  'invalid-reference-does-not-exist';

const SUCCESS_STATUSES = [200, 201, 202];

function validateConfiguration() {
  let base;

  try {
    base = new URL(BASE_URL);
  } catch {
    assert.fail(
      'DB_CONSTRAINT_TEST_BASE_URL must be a valid absolute URL.'
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(base.protocol),
    'Test base URL must use HTTP or HTTPS.'
  );

  assert.ok(
    Number.isFinite(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'DB_CONSTRAINT_TIMEOUT_MS must be positive.'
  );

  assert.ok(
    TEST_PASSWORD.length >= 12,
    'DB_CONSTRAINT_TEST_PASSWORD must be at least 12 characters.'
  );

  for (const [name, path] of Object.entries({
    REGISTER_PATH,
    LOGIN_PATH,
    APPLICATIONS_PATH,
    APPLICATION_PATH,
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
    APPLICATION_PATH.includes(':id'),
    'DB_CONSTRAINT_APPLICATION_PATH must contain the :id placeholder.'
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
      'Remote mutation tests require DB_CONSTRAINT_ALLOW_REMOTE_MUTATIONS=true.'
    );
  }
}

function uniqueEmail() {
  return `db-constraint-${crypto.randomUUID()}@example.com`;
}

function urlFor(path) {
  const url = new URL(path, `${BASE_URL}/`);

  assert.equal(
    url.origin,
    new URL(BASE_URL).origin,
    'Request must remain on the configured test origin.'
  );

  return url.toString();
}

function applicationUrl(id) {
  assert.ok(
    id !== undefined && id !== null && String(id).length > 0,
    'Application ID is required.'
  );

  return APPLICATION_PATH.replace(
    ':id',
    encodeURIComponent(String(id))
  );
}

async function request(
  path,
  {
    method = 'GET',
    token,
    body,
    headers = {},
  } = {}
) {
  const controller = new AbortController();

  const timer = setTimeout(
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
    const response = await fetch(urlFor(path), {
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
    clearTimeout(timer);
  }
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

function extractApplication(response) {
  const body = response.body;

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return null;
  }

  const application =
    body.application ??
    body.data?.application ??
    body.data ??
    body;

  return application &&
    typeof application === 'object' &&
    !Array.isArray(application)
    ? application
    : null;
}

function extractId(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  return (
    record.id ??
    record._id ??
    record.applicationId ??
    null
  );
}

function requireMutationOptIn() {
  assert.equal(
    RUN_MUTATING_TESTS,
    true,
    'Set RUN_DB_CONSTRAINT_MUTATING_TESTS=true only in an isolated test environment.'
  );

  assert.equal(
    process.env.NODE_ENV,
    'test',
    'Mutating tests require NODE_ENV=test.'
  );
}

function requireUserToken() {
  assert.ok(
    USER_TOKEN,
    'DB_CONSTRAINT_TEST_USER_TOKEN is required for authenticated application tests.'
  );
}

async function registerAccount(email, overrides = {}) {
  requireMutationOptIn();

  const response = await request(REGISTER_PATH, {
    method: 'POST',
    body: {
      name: 'Database Constraint Test',
      email,
      password: TEST_PASSWORD,
      ...overrides,
    },
  });

  assertNoServerError(response, 'Account registration');

  return response;
}

describe('MedOrbits database constraints integration tests', () => {
  before(() => {
    validateConfiguration();
  });

  describe('database/API connectivity', () => {
    it('handles an authentication request without an internal server error', async () => {
      const response = await request(LOGIN_PATH, {
        method: 'POST',
        body: {
          email: `nonexistent-${crypto.randomUUID()}@example.com`,
          password: 'Invalid-Database-Test-Password!',
        },
      });

      assertNoServerError(
        response,
        'Authentication/database connectivity'
      );

      assert.ok(
        [200, 400, 401, 404, 405, 415, 422, 429].includes(
          response.status
        ),
        `Unexpected response status: ${response.status}.`
      );
    });
  });

  describe('unique account constraints', () => {
    it(
      'does not create two accounts with the same normalized email',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const email = uniqueEmail();

        const first = await registerAccount(email);

        assert.ok(
          SUCCESS_STATUSES.includes(first.status),
          `Initial registration failed with HTTP ${first.status}.`
        );

        const second = await registerAccount(email.toUpperCase());

        assertRejected(
          second,
          'Duplicate account registration'
        );
      }
    );

    it(
      'rejects account registration with a missing email',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const response = await request(REGISTER_PATH, {
          method: 'POST',
          body: {
            name: 'Missing Email Test',
            password: TEST_PASSWORD,
          },
        });

        assertNoServerError(response, 'Missing email registration');
        assertRejected(response, 'Missing email registration');
      }
    );

    it(
      'rejects account registration with a missing password',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const response = await request(REGISTER_PATH, {
          method: 'POST',
          body: {
            name: 'Missing Password Test',
            email: uniqueEmail(),
          },
        });

        assertNoServerError(response, 'Missing password registration');
        assertRejected(response, 'Missing password registration');
      }
    );
  });

  describe('application persistence constraints', () => {
    it(
      'rejects an application that omits required fields',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();
        requireUserToken();

        const response = await request(APPLICATIONS_PATH, {
          method: 'POST',
          token: USER_TOKEN,
          body: {},
        });

        assertNoServerError(response, 'Empty application creation');
        assertRejected(response, 'Empty application creation');
      }
    );

    it(
      'rejects an invalid reference when the schema requires a valid related record',
      {
        skip:
          !RUN_MUTATING_TESTS ||
          !APPLICATION_REFERENCE_FIELD,
      },
      async () => {
        requireMutationOptIn();
        requireUserToken();

        const body = {
          course: 'MBBS',
          applicantName: 'Invalid Reference Test',
          email: uniqueEmail(),
          phone: '9000000000',
          message: 'Testing invalid database reference handling.',
          [APPLICATION_REFERENCE_FIELD]: INVALID_REFERENCE_VALUE,
        };

        const response = await request(APPLICATIONS_PATH, {
          method: 'POST',
          token: USER_TOKEN,
          body,
        });

        assertNoServerError(response, 'Invalid application reference');
        assertRejected(response, 'Invalid application reference');
      }
    );

    it(
      'does not resolve a malformed application identifier to a record',
      async () => {
        const response = await request(
          applicationUrl('%00invalid-id'),
          {
            token: USER_TOKEN || undefined,
          }
        );

        assertNoServerError(response, 'Malformed application identifier');

        assert.ok(
          [400, 401, 403, 404, 422].includes(response.status),
          `Malformed identifier should not resolve to an application; HTTP ${response.status}.`
        );
      }
    );
  });

  describe('constraint error handling', () => {
    it(
      'does not expose SQL details when a registration is rejected',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const response = await request(REGISTER_PATH, {
          method: 'POST',
          body: {
            name: 'Constraint Error Disclosure Test',
            email: 'invalid-email',
            password: TEST_PASSWORD,
          },
        });

        assertNoServerError(response, 'Rejected registration');
        assertRejected(response, 'Rejected registration');

        const responseText = String(response.rawBody || '');

        const internalDatabaseDetails =
          /\b(sqlstate|postgresql|mysql error|sqlite error|foreign key constraint|duplicate entry|constraint failed|syntax error at or near)\b/i;

        assert.equal(
          internalDatabaseDetails.test(responseText),
          false,
          'The API response appears to expose internal database error details.'
        );
      }
    );
  });
});
