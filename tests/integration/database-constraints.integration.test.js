
'use strict';

/**
 * MedOrbits -- Database Constraints Integration Tests
 * File: tests/integration/database-constraints.integration.test.js
 *
 * Requirements:
 * - Node.js >= 20
 * - Running integration-test API
 * - Dedicated, disposable test database
 *
 * Coverage:
 * - API/database connectivity
 * - Duplicate and case-normalized email enforcement
 * - Required-field validation
 * - Invalid foreign-key/reference rejection
 * - Malformed application identifiers
 * - Database error disclosure
 * - Account persistence after duplicate registration attempts
 *
 * IMPORTANT:
 * These tests exercise the API and persistence layer together.
 * They do not independently inspect database indexes or constraints.
 *
 * Never run mutation-enabled tests against production or shared data.
 * Use dedicated fixtures and database cleanup outside this test file.
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

const VALIDATION_STATUSES = [400, 409, 422];

const REJECTION_STATUSES = [
  400, 401, 403, 404, 405, 409, 413, 415, 422, 429,
];

const MALFORMED_ID_STATUSES = [
  400, 401, 403, 404, 422,
];

const DATABASE_ERROR_PATTERNS = [
  /\bsqlstate\b/i,
  /\bpostgres(?:ql)?\b/i,
  /\bmysql(?: error)?\b/i,
  /\bsqlite(?: error)?\b/i,
  /\bsequelize(?:validation)?error\b/i,
  /\bprisma(?:client)?knownrequesterror\b/i,
  /\bforeign key constraint\b/i,
  /\bduplicate entry\b/i,
  /\bconstraint failed\b/i,
  /\bsyntax error at or near\b/i,
  /\bviolates unique constraint\b/i,
  /\bviolates foreign key constraint\b/i,
  /\bcolumn .+ does not exist\b/i,
  /\btable .+ does not exist\b/i,
  /\bquery failed\b/i,
  /\bdatabase connection\b/i,
  /\bconnection refused\b/i,
  /\bECONNREFUSED\b/i,
  /\bER_DUP_ENTRY\b/i,
  /\bSQLITE_CONSTRAINT\b/i,
];

function validateOriginRelativePath(name, path) {
  assert.equal(
    typeof path,
    'string',
    `${name} must be a string.`
  );

  assert.ok(
    path.startsWith('/') &&
      !path.startsWith('//') &&
      !/[\r\n\\]/.test(path) &&
      !/^[a-z][a-z\d+.-]*:/i.test(path),
    `${name} must be an origin-relative path beginning with /.`
  );

  assert.ok(
    !path.includes('#'),
    `${name} must not contain a URL fragment.`
  );
}

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
    'The test base URL must use HTTP or HTTPS.'
  );

  assert.ok(
    base.username === '' && base.password === '',
    'Do not embed credentials in the test base URL.'
  );

  assert.ok(
    base.search === '' && base.hash === '',
    'The test base URL must not contain a query string or fragment.'
  );

  assert.ok(
    Number.isSafeInteger(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'DB_CONSTRAINT_TIMEOUT_MS must be a positive safe integer.'
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
    validateOriginRelativePath(name, path);
  }

  assert.ok(
    APPLICATION_PATH.includes(':id'),
    'DB_CONSTRAINT_APPLICATION_PATH must contain the :id placeholder.'
  );

  if (APPLICATION_REFERENCE_FIELD) {
    assert.ok(
      /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(
        APPLICATION_REFERENCE_FIELD
      ),
      'DB_CONSTRAINT_REFERENCE_FIELD must be a valid field path.'
    );

    assert.ok(
      !['__proto__', 'prototype', 'constructor'].some((part) =>
        APPLICATION_REFERENCE_FIELD.split('.').includes(part)
      ),
      'DB_CONSTRAINT_REFERENCE_FIELD contains a prohibited field name.'
    );
  }

  if (RUN_MUTATING_TESTS) {
    assert.equal(
      process.env.NODE_ENV,
      'test',
      'Mutation-enabled tests require NODE_ENV=test.'
    );

    assert.ok(
      [
        'localhost',
        '127.0.0.1',
        '::1',
        '[::1]',
      ].includes(base.hostname) || ALLOW_REMOTE_MUTATIONS,
      'Remote mutation tests require DB_CONSTRAINT_ALLOW_REMOTE_MUTATIONS=true.'
    );

    assert.ok(
      !process.env.CI ||
        process.env.CI.toLowerCase() !== 'true' ||
        process.env.DB_CONSTRAINT_CI_MUTATIONS === 'true',
      'CI mutations require DB_CONSTRAINT_CI_MUTATIONS=true and an isolated CI test database.'
    );
  }
}

function uniqueEmail() {
  return `db-constraint-${crypto.randomUUID()}@example.com`;
}

function urlFor(path) {
  assert.equal(
    typeof path,
    'string',
    'Request path must be a string.'
  );

  assert.ok(
    path.startsWith('/') &&
      !path.startsWith('//') &&
      !/[\r\n\\]/.test(path),
    'Request path must be origin-relative.'
  );

  const base = new URL(BASE_URL);
  const url = new URL(path, `${BASE_URL}/`);

  assert.equal(
    url.origin,
    base.origin,
    'Request must remain on the configured test origin.'
  );

  return url.toString();
}

function applicationUrl(id) {
  assert.ok(
    id !== undefined &&
      id !== null &&
      String(id).length > 0,
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
        `Request timed out after ${TIMEOUT_MS} ms: ${method} ${path}`,
        { cause: error }
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function assertNoServerError(response, label) {
  assert.ok(
    response.status >= 200 && response.status < 500,
    `${label}: expected a non-server-error HTTP response, received HTTP ${response.status}.`
  );
}

function assertRejected(response, label) {
  assert.ok(
    REJECTION_STATUSES.includes(response.status),
    `${label}: expected a client-error response, received HTTP ${response.status}.`
  );
}

function assertConstraintRejected(response, label) {
  assert.ok(
    VALIDATION_STATUSES.includes(response.status),
    `${label}: expected HTTP 400, 409, or 422; received HTTP ${response.status}.`
  );
}

function assertSuccessful(response, label) {
  assert.ok(
    SUCCESS_STATUSES.includes(response.status),
    `${label}: expected HTTP ${SUCCESS_STATUSES.join(', ')}; received HTTP ${response.status}.`
  );
}

function assertJsonObject(response, label) {
  assert.ok(
    response.body !== null &&
      typeof response.body === 'object' &&
      !Array.isArray(response.body),
    `${label}: expected a JSON object response.`
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
    'Set RUN_DB_CONSTRAINT_MUTATING_TESTS=true only for an isolated test environment.'
  );

  assert.equal(
    process.env.NODE_ENV,
    'test',
    'Mutation-enabled tests require NODE_ENV=test.'
  );
}

function requireUserToken() {
  assert.ok(
    USER_TOKEN,
    'DB_CONSTRAINT_TEST_USER_TOKEN is required for authenticated application tests.'
  );
}

function assertNoDatabaseDetails(response, label) {
  const responseText = String(response.rawBody || '');

  for (const pattern of DATABASE_ERROR_PATTERNS) {
    assert.equal(
      pattern.test(responseText),
      false,
      `${label}: response appears to expose internal database details matching ${pattern}.`
    );
  }
}

function setNestedField(target, fieldPath, value) {
  const parts = fieldPath.split('.');
  let current = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];

    if (
      !current[part] ||
      typeof current[part] !== 'object' ||
      Array.isArray(current[part])
    ) {
      current[part] = {};
    }

    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
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

async function loginAccount(email) {
  return request(LOGIN_PATH, {
    method: 'POST',
    body: {
      email,
      password: TEST_PASSWORD,
    },
  });
}

describe('MedOrbits database constraints integration tests', () => {
  before(() => {
    validateConfiguration();
  });

  describe('database/API connectivity', () => {
    it('responds to an authentication request without an internal server error', async () => {
      const response = await request(LOGIN_PATH, {
        method: 'POST',
        body: {
          email: uniqueEmail(),
          password: 'Invalid-Database-Test-Password!',
        },
      });

      assertNoServerError(
        response,
        'Authentication/database connectivity'
      );

      assert.ok(
        [
          200, 400, 401, 404, 405, 415, 422, 429,
        ].includes(response.status),
        `Unexpected authentication response status: ${response.status}.`
      );
    });
  });

  describe('unique account constraints', () => {
    it(
      'rejects duplicate normalized email registration and preserves the original account',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const email = uniqueEmail();

        const first = await registerAccount(email);

        assertSuccessful(first, 'Initial account registration');

        const second = await registerAccount(email.toUpperCase());

        assertConstraintRejected(
          second,
          'Duplicate normalized email registration'
        );

        assertNoDatabaseDetails(
          second,
          'Duplicate registration error'
        );

        const login = await loginAccount(email);

        assert.ok(
          [200, 201, 401, 403, 422, 429].includes(login.status),
          `Unexpected login status after duplicate registration: ${login.status}.`
        );

        assert.ok(
          [200, 201].includes(login.status),
          'The original account should remain usable after a duplicate registration attempt.'
        );
      }
    );

    it(
      'rejects registration when the email is missing',
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

        assertConstraintRejected(
          response,
          'Missing email registration'
        );

        assertNoDatabaseDetails(
          response,
          'Missing email validation error'
        );
      }
    );

    it(
      'rejects registration when the password is missing',
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

        assertNoServerError(
          response,
          'Missing password registration'
        );

        assertConstraintRejected(
          response,
          'Missing password registration'
        );

        assertNoDatabaseDetails(
          response,
          'Missing password validation error'
        );
      }
    );

    it(
      'rejects malformed email input without exposing database details',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const response = await request(REGISTER_PATH, {
          method: 'POST',
          body: {
            name: 'Invalid Email Test',
            email: 'not-an-email',
            password: TEST_PASSWORD,
          },
        });

        assertNoServerError(
          response,
          'Malformed email registration'
        );

        assertConstraintRejected(
          response,
          'Malformed email registration'
        );

        assertNoDatabaseDetails(
          response,
          'Malformed email validation error'
        );
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

        assertNoServerError(
          response,
          'Empty application creation'
        );

        assertConstraintRejected(
          response,
          'Empty application creation'
        );

        assertNoDatabaseDetails(
          response,
          'Empty application validation error'
        );
      }
    );

    it(
      'rejects an invalid reference when the configured field requires a related record',
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
        };

        setNestedField(
          body,
          APPLICATION_REFERENCE_FIELD,
          INVALID_REFERENCE_VALUE
        );

        const response = await request(APPLICATIONS_PATH, {
          method: 'POST',
          token: USER_TOKEN,
          body,
        });

        assertNoServerError(
          response,
          'Invalid application reference'
        );

        assertRejected(
          response,
          'Invalid application reference'
        );

        assert.notEqual(
          response.status,
          201,
          'An application with an invalid required reference must not be created.'
        );

        assertNoDatabaseDetails(
          response,
          'Invalid reference error'
        );
      }
    );

    it('does not resolve a malformed application identifier to a record', async () => {
      const malformedIdentifier = '\u0000invalid-id';

      const response = await request(
        applicationUrl(malformedIdentifier),
        {
          token: USER_TOKEN || undefined,
        }
      );

      assertNoServerError(
        response,
        'Malformed application identifier'
      );

      assert.ok(
        MALFORMED_ID_STATUSES.includes(response.status),
        `Malformed identifier should not resolve to an application; received HTTP ${response.status}.`
      );

      assertNoDatabaseDetails(
        response,
        'Malformed identifier error'
      );
    });
  });

  describe('constraint error handling', () => {
    it(
      'does not expose SQL details when registration validation fails',
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

        assertNoServerError(
          response,
          'Rejected registration'
        );

        assertConstraintRejected(
          response,
          'Rejected registration'
        );

        assertNoDatabaseDetails(
          response,
          'Rejected registration error'
        );
      }
    );

    it(
      'does not return a successful response for a registration with an empty JSON object',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const response = await request(REGISTER_PATH, {
          method: 'POST',
          body: {},
        });

        assertNoServerError(
          response,
          'Empty registration payload'
        );

        assertConstraintRejected(
          response,
          'Empty registration payload'
        );

        assertNoDatabaseDetails(
          response,
          'Empty registration error'
        );
      }
    );
  });
});
