
'use strict';

/**
 * MedOrbits -- Application Integration Tests
 * File: tests/integration/application.integration.test.js
 *
 * Requirements:
 * - Node.js >= 20
 * - Running integration-test API
 * - Dedicated test database
 * - Two distinct test-user credentials
 *
 * IMPORTANT:
 * - Match endpoint paths and payload fields to the actual API.
 * - Mutating tests are opt-in.
 * - Never run destructive tests against production.
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const BASE_URL = (
  process.env.APPLICATION_TEST_BASE_URL ||
  process.env.TEST_BASE_URL ||
  'http://127.0.0.1:3000'
).replace(/\/+$/, '');

const APPLICATIONS_PATH =
  process.env.APPLICATIONS_TEST_PATH || '/api/applications';

const APPLICATION_PATH =
  process.env.APPLICATION_TEST_PATH || '/api/applications/:id';

const USER_A_TOKEN =
  process.env.APPLICATION_TEST_USER_A_TOKEN || '';

const USER_B_TOKEN =
  process.env.APPLICATION_TEST_USER_B_TOKEN || '';

const TIMEOUT_MS = Number(
  process.env.APPLICATION_TEST_TIMEOUT_MS || 15000
);

const RUN_MUTATING_TESTS =
  process.env.RUN_APPLICATION_MUTATING_TESTS === 'true';

const ALLOW_REMOTE_MUTATIONS =
  process.env.APPLICATION_TEST_ALLOW_REMOTE_MUTATIONS === 'true';

const VALID_APPLICATION = Object.freeze({
  course: process.env.TEST_APPLICATION_COURSE || 'MBBS',
  applicantName: 'Integration Test Applicant',
  email: `application-test-${crypto.randomUUID()}@example.com`,
  phone: '9000000000',
  country: 'IN',
  message: 'Automated integration test application.',
});

function validatePath(path, name) {
  assert.equal(typeof path, 'string', `${name} must be a string.`);
  assert.ok(path.startsWith('/'), `${name} must start with /.`);
  assert.ok(!path.startsWith('//'), `${name} must be origin-relative.`);
  assert.ok(!/[\r\n]/.test(path), `${name} must not contain line breaks.`);
}

function validateConfiguration() {
  let base;

  try {
    base = new URL(BASE_URL);
  } catch {
    assert.fail('APPLICATION_TEST_BASE_URL must be a valid absolute URL.');
  }

  assert.ok(
    ['http:', 'https:'].includes(base.protocol),
    'The base URL must use HTTP or HTTPS.'
  );

  validatePath(APPLICATIONS_PATH, 'APPLICATIONS_TEST_PATH');
  validatePath(APPLICATION_PATH, 'APPLICATION_TEST_PATH');

  assert.ok(
    APPLICATION_PATH.includes(':id'),
    'APPLICATION_TEST_PATH must include the :id placeholder.'
  );

  assert.ok(
    Number.isFinite(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'APPLICATION_TEST_TIMEOUT_MS must be positive.'
  );

  if (RUN_MUTATING_TESTS) {
    assert.equal(
      process.env.NODE_ENV,
      'test',
      'Mutating tests require NODE_ENV=test.'
    );

    assert.ok(
      !['production', 'prod'].includes(
        String(process.env.NODE_ENV).toLowerCase()
      ),
      'Mutating tests must never run in production.'
    );

    assert.ok(
      ['localhost', '127.0.0.1', '::1'].includes(base.hostname) ||
        ALLOW_REMOTE_MUTATIONS,
      'Remote mutations require APPLICATION_TEST_ALLOW_REMOTE_MUTATIONS=true.'
    );
  }
}

function buildUrl(path) {
  validatePath(path, 'Request path');

  const url = new URL(path, `${BASE_URL}/`);

  assert.equal(
    url.origin,
    new URL(BASE_URL).origin,
    'Request URL must remain on the configured test origin.'
  );

  return url.toString();
}

function applicationUrl(id) {
  assert.ok(
    id !== undefined && id !== null && String(id).length > 0,
    'Application ID is required.'
  );

  return buildUrl(
    APPLICATION_PATH.replace(':id', encodeURIComponent(String(id)))
  );
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
    `${label}: expected a client-error status, received HTTP ${response.status}.`
  );
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

  const candidate =
    body.application ??
    body.data?.application ??
    body.data ??
    body;

  return candidate &&
    typeof candidate === 'object' &&
    !Array.isArray(candidate)
    ? candidate
    : null;
}

function extractApplicationId(response) {
  const application = extractApplication(response);

  if (!application) {
    return null;
  }

  return (
    application.id ??
    application.applicationId ??
    application._id ??
    null
  );
}

function isSuccess(response) {
  return [200, 201, 202].includes(response.status);
}

function requireTestUsers() {
  assert.ok(
    USER_A_TOKEN,
    'APPLICATION_TEST_USER_A_TOKEN is required.'
  );

  assert.ok(
    USER_B_TOKEN,
    'APPLICATION_TEST_USER_B_TOKEN is required.'
  );

  assert.notEqual(
    USER_A_TOKEN,
    USER_B_TOKEN,
    'User A and User B must have distinct credentials.'
  );
}

function requireMutatingTests() {
  assert.equal(
    RUN_MUTATING_TESTS,
    true,
    'Set RUN_APPLICATION_MUTATING_TESTS=true for isolated test runs.'
  );

  assert.equal(
    process.env.NODE_ENV,
    'test',
    'Mutating tests require NODE_ENV=test.'
  );
}

async function createTestApplication(token, prefix = 'integration') {
  requireMutatingTests();

  const response = await apiRequest(APPLICATIONS_PATH, {
    method: 'POST',
    token,
    body: {
      ...VALID_APPLICATION,
      email: `${prefix}-${crypto.randomUUID()}@example.com`,
    },
  });

  assertNoServerError(response, 'Test application creation');

  assert.ok(
    isSuccess(response),
    `Test application creation failed with HTTP ${response.status}.`
  );

  const id = extractApplicationId(response);

  assert.ok(
    id,
    'Successful creation response must expose an application ID.'
  );

  return { id, response };
}

describe('MedOrbits application integration tests', () => {
  before(() => {
    validateConfiguration();
  });

  describe('configuration and connectivity', () => {
    it('requires distinct credentials for both test users', () => {
      requireTestUsers();
    });

    it('responds without an internal server error to a collection request', async () => {
      const response = await apiRequest(APPLICATIONS_PATH, {
        token: USER_A_TOKEN || undefined,
      });

      assertNoServerError(response, 'Application collection request');

      assert.ok(
        [200, 401, 403, 404, 405].includes(response.status),
        `Unexpected collection response: HTTP ${response.status}.`
      );
    });
  });

  describe('authentication and authorization', () => {
    it('rejects application creation without authentication', async () => {
      const response = await apiRequest(APPLICATIONS_PATH, {
        method: 'POST',
        body: VALID_APPLICATION,
      });

      assertNoServerError(
        response,
        'Unauthenticated application creation'
      );

      assertRejected(
        response,
        'Unauthenticated application creation'
      );
    });

    it('handles unauthenticated collection access according to the API policy', async () => {
      const response = await apiRequest(APPLICATIONS_PATH);

      assertNoServerError(
        response,
        'Unauthenticated collection request'
      );

      assert.ok(
        [200, 401, 403, 404, 405].includes(response.status),
        `Unexpected response: HTTP ${response.status}.`
      );

      if (response.status === 200) {
        assert.ok(
          response.body && typeof response.body === 'object',
          'Public collection endpoint must return a documented structured response.'
        );
      }
    });
  });

  describe('application validation', () => {
    it(
      'rejects an application with missing required fields',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        requireMutatingTests();

        const response = await apiRequest(APPLICATIONS_PATH, {
          method: 'POST',
          token: USER_A_TOKEN,
          body: {},
        });

        assertNoServerError(response, 'Missing-field application');
        assertRejected(response, 'Missing-field application');
      }
    );

    it(
      'rejects malformed email addresses',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        requireMutatingTests();

        const response = await apiRequest(APPLICATIONS_PATH, {
          method: 'POST',
          token: USER_A_TOKEN,
          body: {
            ...VALID_APPLICATION,
            email: 'not-an-email',
          },
        });

        assertNoServerError(response, 'Invalid email application');
        assertRejected(response, 'Invalid email application');
      }
    );

    it(
      'prevents client-supplied privileged fields from granting privileges',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        requireMutatingTests();

        const response = await apiRequest(APPLICATIONS_PATH, {
          method: 'POST',
          token: USER_A_TOKEN,
          body: {
            ...VALID_APPLICATION,
            email: `mass-assignment-${crypto.randomUUID()}@example.com`,
            role: 'admin',
            status: 'approved',
            ownerId: 'another-user',
            isVerified: true,
          },
        });

        assertNoServerError(response, 'Privileged-field application');

        if (!isSuccess(response)) {
          assertRejected(response, 'Privileged-field application');
          return;
        }

        const application = extractApplication(response);

        assert.ok(
          application,
          'Creation response must contain an application object.'
        );

        assert.notEqual(
          application.role,
          'admin',
          'Client input must not assign an administrative role.'
        );

        assert.notEqual(
          application.status,
          'approved',
          'Client input must not bypass application review.'
        );

        assert.notEqual(
          application.isVerified,
          true,
          'Client input must not self-verify an application.'
        );

        assert.notEqual(
          String(application.ownerId ?? ''),
          'another-user',
          'Client input must not reassign application ownership.'
        );
      }
    );
  });

  describe('application creation and retrieval', () => {
    it(
      'creates an application with a valid payload',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const { response } = await createTestApplication(
          USER_A_TOKEN,
          'create'
        );

        const application = extractApplication(response);

        assert.ok(
          application,
          'Creation response must contain an application object.'
        );

        assert.notEqual(
          application.status,
          'approved',
          'New applications must not be approved solely through client-supplied fields.'
        );
      }
    );

    it(
      'allows an authorized owner to retrieve their application',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const { id } = await createTestApplication(
          USER_A_TOKEN,
          'owner'
        );

        const response = await apiRequest(applicationUrl(id), {
          token: USER_A_TOKEN,
        });

        assertNoServerError(response, 'Owner application retrieval');

        assert.equal(
          response.status,
          200,
          `Owner should retrieve their application; got HTTP ${response.status}.`
        );

        assert.equal(
          String(extractApplicationId(response)),
          String(id),
          'Retrieved application ID does not match the requested resource.'
        );
      }
    );
  });

  describe('cross-user access control', () => {
    it(
      'prevents another user from reading a private application',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const { id } = await createTestApplication(
          USER_A_TOKEN,
          'private'
        );

        const response = await apiRequest(applicationUrl(id), {
          token: USER_B_TOKEN,
        });

        assertNoServerError(
          response,
          'Cross-user application retrieval'
        );

        assert.ok(
          [403, 404].includes(response.status),
          `User B must not read User A's private application; got HTTP ${response.status}.`
        );
      }
    );

    it(
      'prevents another user from modifying a private application',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const { id } = await createTestApplication(
          USER_A_TOKEN,
          'protected'
        );

        const response = await apiRequest(applicationUrl(id), {
          method: 'PATCH',
          token: USER_B_TOKEN,
          body: {
            status: 'approved',
            message: 'Unauthorized status modification attempt',
          },
        });

        assertNoServerError(
          response,
          'Cross-user application modification'
        );

        assert.ok(
          [403, 404, 405, 409, 422].includes(response.status),
          `Cross-user modification should be denied; got HTTP ${response.status}.`
        );
      }
    );
  });

  describe('status transition protection', () => {
    it(
      'does not allow an ordinary applicant to approve their own application',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const { id } = await createTestApplication(
          USER_A_TOKEN,
          'status'
        );

        const response = await apiRequest(applicationUrl(id), {
          method: 'PATCH',
          token: USER_A_TOKEN,
          body: {
            status: 'approved',
          },
        });

        assertNoServerError(
          response,
          'Applicant status modification'
        );

        if (isSuccess(response)) {
          const application = extractApplication(response);

          assert.ok(
            application,
            'Status update response must contain an application object.'
          );

          assert.notEqual(
            application.status,
            'approved',
            'An applicant must not approve their own application.'
          );
        } else {
          assertRejected(
            response,
            'Applicant status modification'
          );
        }
      }
    );
  });
});
