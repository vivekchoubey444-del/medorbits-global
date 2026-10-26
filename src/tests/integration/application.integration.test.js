
'use strict';

/**
 * MedOrbits -- Application Integration Tests
 *
 * File: tests/integration/application.integration.test.js
 * Runtime: Node.js >= 20
 *
 * Coverage:
 * - API availability and configuration validation
 * - Authentication and application validation
 * - Application creation and owner retrieval
 * - Cross-user access control
 * - Mass-assignment protection
 * - Unauthorized status transitions
 *
 * Requirements:
 * - Running integration-test API
 * - Dedicated test database
 * - Two distinct test-user credentials
 *
 * Safety:
 * - Mutating tests are opt-in.
 * - Mutations require NODE_ENV=test.
 * - Remote mutations require explicit authorization.
 * - Never run against production or real customer data.
 *
 * IMPORTANT:
 * Adapt endpoint paths, request fields, authorization rules, and
 * response schemas to the actual MedOrbits implementation.
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
  process.env.APPLICATIONS_TEST_PATH ||
  '/api/applications';

const APPLICATION_PATH =
  process.env.APPLICATION_TEST_PATH ||
  '/api/applications/:id';

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

const TEST_ENVIRONMENT =
  process.env.APPLICATION_TEST_ENVIRONMENT || '';

const APPLICATION_COURSE =
  process.env.TEST_APPLICATION_COURSE || 'MBBS';

const APPLICATION_EVENTUAL_CONSISTENCY_MS = Number(
  process.env.APPLICATION_TEST_CONSISTENCY_TIMEOUT_MS || 5000
);

const ACCEPTED_STATUSES = new Set([200, 201, 202]);

const REJECTION_STATUSES = new Set([
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
]);

const VALID_APPLICATION = Object.freeze({
  course: APPLICATION_COURSE,
  applicantName: 'Integration Test Applicant',
  email: 'application-test@example.com',
  phone: '9000000000',
  country: 'IN',
  message: 'Automated integration test application.',
});

function isValidHeaderName(name) {
  return (
    typeof name === 'string' &&
    /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)
  );
}

function isValidPath(path, name) {
  assert.equal(typeof path, 'string', `${name} must be a string.`);

  assert.ok(
    path.startsWith('/') && !path.startsWith('//'),
    `${name} must be an origin-relative absolute path.`
  );

  assert.ok(
    !/[?#\r\n]/.test(path),
    `${name} must not contain query strings, fragments, or line breaks.`
  );
}

function isLoopbackHostname(hostname) {
  return [
    'localhost',
    '127.0.0.1',
    '::1',
    '[::1]',
  ].includes(hostname.toLowerCase());
}

function validateConfiguration() {
  let base;

  try {
    base = new URL(BASE_URL);
  } catch {
    throw new Error(
      'APPLICATION_TEST_BASE_URL must be a valid absolute URL.'
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(base.protocol),
    'The application test URL must use HTTP or HTTPS.'
  );

  assert.equal(
    base.username,
    '',
    'Do not embed credentials in APPLICATION_TEST_BASE_URL.'
  );

  assert.equal(
    base.password,
    '',
    'Do not embed credentials in APPLICATION_TEST_BASE_URL.'
  );

  assert.equal(
    base.search,
    '',
    'APPLICATION_TEST_BASE_URL must not contain a query string.'
  );

  assert.equal(
    base.hash,
    '',
    'APPLICATION_TEST_BASE_URL must not contain a URL fragment.'
  );

  isValidPath(
    APPLICATIONS_PATH,
    'APPLICATIONS_TEST_PATH'
  );

  isValidPath(
    APPLICATION_PATH,
    'APPLICATION_TEST_PATH'
  );

  assert.ok(
    APPLICATION_PATH.includes(':id'),
    'APPLICATION_TEST_PATH must contain the :id placeholder.'
  );

  assert.ok(
    Number.isSafeInteger(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'APPLICATION_TEST_TIMEOUT_MS must be a positive safe integer.'
  );

  assert.ok(
    Number.isSafeInteger(APPLICATION_EVENTUAL_CONSISTENCY_MS) &&
      APPLICATION_EVENTUAL_CONSISTENCY_MS >= 0,
    'APPLICATION_TEST_CONSISTENCY_TIMEOUT_MS must be a non-negative safe integer.'
  );

  if (!RUN_MUTATING_TESTS) {
    return;
  }

  assert.equal(
    process.env.NODE_ENV,
    'test',
    'Mutating application tests require NODE_ENV=test.'
  );

  assert.ok(
    !['production', 'prod', 'live'].includes(
      TEST_ENVIRONMENT.toLowerCase()
    ),
    'Mutating application tests must not run in production or live environments.'
  );

  const loopback = isLoopbackHostname(base.hostname);

  if (!loopback) {
    assert.ok(
      ALLOW_REMOTE_MUTATIONS &&
        TEST_ENVIRONMENT.toLowerCase() === 'sandbox',
      'Remote mutations require APPLICATION_TEST_ALLOW_REMOTE_MUTATIONS=true and APPLICATION_TEST_ENVIRONMENT=sandbox.'
    );

    assert.equal(
      base.protocol,
      'https:',
      'Remote application test environments must use HTTPS.'
    );
  }

  requireTestUsers();
}

function requireTestUsers() {
  assert.ok(
    USER_A_TOKEN.trim().length > 0,
    'APPLICATION_TEST_USER_A_TOKEN is required.'
  );

  assert.ok(
    USER_B_TOKEN.trim().length > 0,
    'APPLICATION_TEST_USER_B_TOKEN is required.'
  );

  assert.notEqual(
    USER_A_TOKEN,
    USER_B_TOKEN,
    'User A and User B must use distinct credentials.'
  );
}

function requireMutatingTests() {
  assert.equal(
    RUN_MUTATING_TESTS,
    true,
    'Set RUN_APPLICATION_MUTATING_TESTS=true for isolated mutation tests.'
  );

  assert.equal(
    process.env.NODE_ENV,
    'test',
    'Mutating tests require NODE_ENV=test.'
  );
}

function buildUrl(path) {
  isValidPath(path, 'Request path');

  const base = new URL(BASE_URL);
  const url = new URL(path, `${BASE_URL}/`);

  assert.equal(
    url.origin,
    base.origin,
    'Request URL must remain on the configured test origin.'
  );

  return url.toString();
}

function applicationUrl(id) {
  assert.ok(
    id !== undefined &&
      id !== null &&
      String(id).trim().length > 0,
    'Application ID is required.'
  );

  const encodedId = encodeURIComponent(String(id));

  return buildUrl(
    APPLICATION_PATH.replace(':id', encodedId)
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
      body: body === undefined
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
    if (error?.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${TIMEOUT_MS} ms: ${method} ${path}`,
        { cause: error }
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
    `${label}: unexpected HTTP ${response.status}; response=${JSON.stringify(response.body)}`
  );
}

function assertRejected(response, label) {
  assert.ok(
    REJECTION_STATUSES.has(response.status),
    `${label}: expected a documented rejection status, received HTTP ${response.status}.`
  );
}

function isSuccess(response) {
  return ACCEPTED_STATUSES.has(response.status);
}

function extractApplication(response) {
  const body = response?.body;

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

  return (
    candidate &&
    typeof candidate === 'object' &&
    !Array.isArray(candidate)
  )
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

function assertNoRedirect(response, label) {
  assert.ok(
    !(response.status >= 300 && response.status < 400),
    `${label}: unexpected redirect to ${response.headers.get('location') || '(no location header)'}.`
  );
}

function createUniqueApplicationPayload(prefix = 'integration') {
  return {
    ...VALID_APPLICATION,
    email: `${prefix}-${crypto.randomUUID()}@example.com`,
  };
}

async function createTestApplication(
  token,
  prefix = 'integration'
) {
  requireMutatingTests();

  assert.ok(
    token,
    'A test-user token is required to create an application.'
  );

  const response = await apiRequest(APPLICATIONS_PATH, {
    method: 'POST',
    token,
    body: createUniqueApplicationPayload(prefix),
  });

  assertNoServerError(
    response,
    'Test application creation'
  );

  assert.ok(
    isSuccess(response),
    `Application creation failed with HTTP ${response.status}: ${JSON.stringify(response.body)}`
  );

  const id = extractApplicationId(response);

  assert.ok(
    id !== null && id !== undefined && String(id).length > 0,
    'Successful application creation must expose an application ID.'
  );

  return {
    id,
    response,
    application: extractApplication(response),
  };
}

function assertApplicationIdentity(response, expectedId, label) {
  const actualId = extractApplicationId(response);

  assert.ok(
    actualId !== null && actualId !== undefined,
    `${label}: response did not contain an application ID.`
  );

  assert.equal(
    String(actualId),
    String(expectedId),
    `${label}: returned application ID does not match the requested resource.`
  );
}

describe('MedOrbits application integration tests', () => {
  before(() => {
    validateConfiguration();
  });

  describe('configuration and connectivity', () => {
    it('requires distinct credentials for the two test users', () => {
      requireTestUsers();
    });

    it('responds without an internal server error to a collection request', async () => {
      const response = await apiRequest(APPLICATIONS_PATH, {
        token: USER_A_TOKEN || undefined,
      });

      assertNoServerError(
        response,
        'Application collection request'
      );

      assertNoRedirect(
        response,
        'Application collection request'
      );

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
        body: createUniqueApplicationPayload('unauthenticated'),
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

    it('follows the configured policy for unauthenticated collection access', async () => {
      const response = await apiRequest(APPLICATIONS_PATH);

      assertNoServerError(
        response,
        'Unauthenticated collection request'
      );

      assert.ok(
        [200, 401, 403, 404, 405].includes(response.status),
        `Unexpected unauthenticated collection response: HTTP ${response.status}.`
      );

      if (response.status === 200) {
        assert.ok(
          response.body &&
            typeof response.body === 'object',
          'A public collection endpoint must return a structured response.'
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

        assertNoServerError(
          response,
          'Missing-field application'
        );

        assertRejected(
          response,
          'Missing-field application'
        );
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
            ...createUniqueApplicationPayload('invalid-email'),
            email: 'not-an-email',
          },
        });

        assertNoServerError(
          response,
          'Invalid email application'
        );

        assertRejected(
          response,
          'Invalid email application'
        );
      }
    );

    it(
      'does not allow client input to grant privileged fields',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        requireMutatingTests();

        const response = await apiRequest(APPLICATIONS_PATH, {
          method: 'POST',
          token: USER_A_TOKEN,
          body: {
            ...createUniqueApplicationPayload('mass-assignment'),
            role: 'admin',
            status: 'approved',
            ownerId: 'another-user',
            isVerified: true,
          },
        });

        assertNoServerError(
          response,
          'Privileged-field application'
        );

        if (!isSuccess(response)) {
          assertRejected(
            response,
            'Privileged-field application'
          );
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
          'Client input must not grant an administrative role.'
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
      'creates an application using a valid payload',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const result = await createTestApplication(
          USER_A_TOKEN,
          'create'
        );

        assert.ok(
          result.application,
          'Creation response must contain an application object.'
        );

        assert.notEqual(
          result.application.status,
          'approved',
          'A newly submitted application must not be approved through applicant input.'
        );
      }
    );

    it(
      'allows an owner to retrieve their own application',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        const { id } = await createTestApplication(
          USER_A_TOKEN,
          'owner'
        );

        const response = await apiRequest(applicationUrl(id), {
          token: USER_A_TOKEN,
        });

        assertNoServerError(
          response,
          'Owner application retrieval'
        );

        assert.equal(
          response.status,
          200,
          `Expected owner retrieval to succeed; received HTTP ${response.status}.`
        );

        assertApplicationIdentity(
          response,
          id,
          'Owner application retrieval'
        );
      }
    );
  });

  describe('cross-user access control', () => {
    it(
      'prevents a second user from reading a private application',
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
          `User B must not read User A's private application; received HTTP ${response.status}.`
        );
      }
    );

    it(
      'prevents a second user from modifying a private application',
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
          `Cross-user modification should be denied; received HTTP ${response.status}.`
        );

        /*
         * Optional stronger assertion:
         * Re-fetch the resource as User A and confirm its business fields
         * remain unchanged. This is recommended if PATCH requests may
         * partially succeed or if the API returns ambiguous responses.
         */
      }
    );
  });

  describe('status transition protection', () => {
    it(
      'does not allow an applicant to approve their own application',
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
            'Successful status response must contain an application object.'
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
