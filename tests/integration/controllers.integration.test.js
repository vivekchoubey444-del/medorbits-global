
'use strict';

/**
 * MedOrbits -- Controller Integration Tests
 * File: tests/integration/controllers.integration.test.js
 *
 * Requirements:
 * - Node.js >= 20
 * - Running integration-test API
 * - Dedicated test database and test credentials
 *
 * These tests exercise controllers through HTTP routes.
 * They do not import controllers directly.
 * Never run mutating tests against production.
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = (
  process.env.CONTROLLER_TEST_BASE_URL ||
  process.env.TEST_BASE_URL ||
  'http://127.0.0.1:3000'
).replace(/\/+$/, '');

const TIMEOUT_MS = Number(
  process.env.CONTROLLER_TEST_TIMEOUT_MS || 15000
);

const USER_TOKEN = process.env.CONTROLLER_TEST_USER_TOKEN || '';
const ADMIN_TOKEN = process.env.CONTROLLER_TEST_ADMIN_TOKEN || '';

const RUN_MUTATING_TESTS =
  process.env.RUN_CONTROLLER_MUTATING_TESTS === 'true';

const ALLOW_REMOTE_MUTATIONS =
  process.env.CONTROLLER_TEST_ALLOW_REMOTE_MUTATIONS === 'true';

const ENDPOINTS = {
  health: process.env.HEALTH_TEST_PATH || '/health',
  authLogin: process.env.CONTROLLER_AUTH_LOGIN_PATH || '/api/auth/login',
  authMe: process.env.CONTROLLER_AUTH_ME_PATH || '/api/auth/me',
  usersMe: process.env.CONTROLLER_USERS_ME_PATH || '/api/users/me',
  applications:
    process.env.CONTROLLER_APPLICATIONS_PATH || '/api/applications',
  courses: process.env.CONTROLLER_COURSES_PATH || '/api/courses',
  search: process.env.CONTROLLER_SEARCH_PATH || '/api/search',
  documents: process.env.CONTROLLER_DOCUMENTS_PATH || '/api/documents',
  adminHealth: process.env.CONTROLLER_ADMIN_HEALTH_PATH || '',
};

const SUCCESS_STATUSES = [200, 201, 202, 204];

function validateConfiguration() {
  let base;

  try {
    base = new URL(BASE_URL);
  } catch {
    assert.fail('CONTROLLER_TEST_BASE_URL must be a valid absolute URL.');
  }

  assert.ok(
    ['http:', 'https:'].includes(base.protocol),
    'Test base URL must use HTTP or HTTPS.'
  );

  assert.ok(
    Number.isFinite(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'CONTROLLER_TEST_TIMEOUT_MS must be positive.'
  );

  for (const [name, path] of Object.entries(ENDPOINTS)) {
    if (!path) continue;

    assert.ok(
      typeof path === 'string' &&
        path.startsWith('/') &&
        !path.startsWith('//') &&
        !/[\r\n]/.test(path),
      `${name} must be a valid origin-relative path.`
    );
  }

  if (RUN_MUTATING_TESTS) {
    assert.equal(
      process.env.NODE_ENV,
      'test',
      'Mutating tests require NODE_ENV=test.'
    );

    assert.ok(
      ['localhost', '127.0.0.1', '::1'].includes(base.hostname) ||
        ALLOW_REMOTE_MUTATIONS,
      'Remote mutation tests require CONTROLLER_TEST_ALLOW_REMOTE_MUTATIONS=true.'
    );
  }
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

function assertJsonWhenPresent(response, label) {
  if (!response.rawBody) return;

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    assert.ok(
      response.body !== null &&
        typeof response.body === 'object',
      `${label}: declared JSON response could not be parsed as an object.`
    );
  }
}

function assertNoSensitiveFields(value, label, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) {
    return;
  }

  seen.add(value);

  const sensitiveKeys = new Set([
    'password',
    'passwordhash',
    'password_hash',
    'refreshtoken',
    'accesstoken',
    'clientsecret',
    'webhooksecret',
    'privatekey',
  ]);

  for (const [key, child] of Object.entries(value)) {
    assert.ok(
      !sensitiveKeys.has(key.toLowerCase()),
      `${label}: response exposed sensitive field "${key}".`
    );

    assertNoSensitiveFields(child, label, seen);
  }
}

function assertDenied(response, label) {
  assert.ok(
    [401, 403, 404].includes(response.status),
    `${label}: expected access denial, received HTTP ${response.status}.`
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

function isConfigured(path) {
  return typeof path === 'string' && path.length > 0;
}

describe('MedOrbits controller integration tests', () => {
  before(() => {
    validateConfiguration();
  });

  describe('application availability and routing', () => {
    it('responds to the configured health endpoint without a server error', async (t) => {
      if (!isConfigured(ENDPOINTS.health)) {
        t.skip('No health endpoint configured.');
        return;
      }

      const response = await request(ENDPOINTS.health);

      assertNoServerError(response, 'Health endpoint');

      assert.ok(
        response.status >= 200 && response.status < 500,
        `Unexpected health endpoint status: ${response.status}.`
      );
    });

    it('returns a not-found response for an unknown API route', async () => {
      const response = await request(
        `/api/__controller_test_missing_${Date.now()}__`
      );

      assert.equal(
        response.status,
        404,
        `Unknown API route should return 404; received HTTP ${response.status}.`
      );
    });
  });

  describe('authentication controller', () => {
    it('rejects invalid login credentials without issuing a token', async (t) => {
      if (!isConfigured(ENDPOINTS.authLogin)) {
        t.skip('Authentication login endpoint is not configured.');
        return;
      }

      const response = await request(ENDPOINTS.authLogin, {
        method: 'POST',
        body: {
          email: `missing-${Date.now()}@example.com`,
          password: 'Invalid-Controller-Test-Password!',
        },
      });

      assertNoServerError(response, 'Invalid login');
      assertRejected(response, 'Invalid login');

      if (response.body && typeof response.body === 'object') {
        const token =
          response.body.accessToken ??
          response.body.access_token ??
          response.body.token ??
          response.body.data?.accessToken ??
          response.body.data?.access_token ??
          response.body.data?.token ??
          null;

        assert.equal(
          token,
          null,
          'Invalid login must not return an access token.'
        );
      }
    });

    it('rejects an invalid token on the current-user endpoint', async (t) => {
      if (!isConfigured(ENDPOINTS.authMe)) {
        t.skip('Current-user endpoint is not configured.');
        return;
      }

      const response = await request(ENDPOINTS.authMe, {
        token: 'invalid.controller.integration.token',
      });

      assertNoServerError(response, 'Invalid authentication token');
      assertDenied(response, 'Invalid authentication token');
    });
  });

  describe('user controller', () => {
    it('rejects invalid credentials for a protected user endpoint', async (t) => {
      if (!isConfigured(ENDPOINTS.usersMe)) {
        t.skip('User profile endpoint is not configured.');
        return;
      }

      const response = await request(ENDPOINTS.usersMe, {
        token: 'invalid.controller.integration.token',
      });

      assertNoServerError(response, 'Protected user endpoint');
      assertDenied(response, 'Protected user endpoint');
    });

    it('does not expose sensitive fields in an authenticated user response', async (t) => {
      if (!USER_TOKEN) {
        t.skip('Set CONTROLLER_TEST_USER_TOKEN.');
        return;
      }

      if (!isConfigured(ENDPOINTS.usersMe)) {
        t.skip('User profile endpoint is not configured.');
        return;
      }

      const response = await request(ENDPOINTS.usersMe, {
        token: USER_TOKEN,
      });

      assertNoServerError(response, 'Authenticated user response');

      if (response.status === 200) {
        assertJsonWhenPresent(response, 'Authenticated user response');

        assertNoSensitiveFields(
          response.body,
          'Authenticated user response'
        );
      } else {
        assertDenied(response, 'Authenticated user response');
      }
    });
  });

  describe('application controller', () => {
    it('rejects application creation without authentication', async (t) => {
      if (!isConfigured(ENDPOINTS.applications)) {
        t.skip('Applications endpoint is not configured.');
        return;
      }

      const response = await request(ENDPOINTS.applications, {
        method: 'POST',
        body: {},
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

    it('rejects an invalid application payload when mutation tests are enabled', async (t) => {
      if (!RUN_MUTATING_TESTS) {
        t.skip('Mutating tests are disabled.');
        return;
      }

      if (!USER_TOKEN) {
        t.skip('Set CONTROLLER_TEST_USER_TOKEN.');
        return;
      }

      if (!isConfigured(ENDPOINTS.applications)) {
        t.skip('Applications endpoint is not configured.');
        return;
      }

      const response = await request(ENDPOINTS.applications, {
        method: 'POST',
        token: USER_TOKEN,
        body: {},
      });

      assertNoServerError(response, 'Invalid application payload');
      assertRejected(response, 'Invalid application payload');
    });
  });

  describe('course controller', () => {
    it('handles course listing requests without exposing server errors', async (t) => {
      if (!isConfigured(ENDPOINTS.courses)) {
        t.skip('Courses endpoint is not configured.');
        return;
      }

      const response = await request(ENDPOINTS.courses, {
        token: USER_TOKEN || undefined,
      });

      assertNoServerError(response, 'Course listing');

      assert.ok(
        [200, 401, 403, 404, 405].includes(response.status),
        `Unexpected course listing status: ${response.status}.`
      );

      if (response.status === 200) {
        assertJsonWhenPresent(response, 'Course listing');
        assertNoSensitiveFields(response.body, 'Course listing');
      }
    });
  });

  describe('search controller', () => {
    it('handles a normal search query without an internal server error', async (t) => {
      if (!isConfigured(ENDPOINTS.search)) {
        t.skip('Search endpoint is not configured.');
        return;
      }

      const separator = ENDPOINTS.search.includes('?') ? '&' : '?';

      const response = await request(
        `${ENDPOINTS.search}${separator}q=MBBS`
      );

      assertNoServerError(response, 'Normal search request');

      assert.ok(
        [200, 400, 401, 403, 404, 422].includes(response.status),
        `Unexpected search response: HTTP ${response.status}.`
      );

      if (response.status === 200) {
        assertJsonWhenPresent(response, 'Search response');
      }
    });

    it('handles an unusually long search query safely', async (t) => {
      if (!isConfigured(ENDPOINTS.search)) {
        t.skip('Search endpoint is not configured.');
        return;
      }

      const longQuery = 'A'.repeat(10000);
      const separator = ENDPOINTS.search.includes('?') ? '&' : '?';

      const response = await request(
        `${ENDPOINTS.search}${separator}q=${encodeURIComponent(longQuery)}`
      );

      assertNoServerError(response, 'Oversized search query');

      assert.ok(
        [200, 400, 413, 422, 429].includes(response.status),
        `Unexpected oversized-search response: HTTP ${response.status}.`
      );
    });
  });

  describe('document controller', () => {
    it('does not return private document data to an unauthenticated client', async (t) => {
      if (!isConfigured(ENDPOINTS.documents)) {
        t.skip('Documents endpoint is not configured.');
        return;
      }

      const response = await request(ENDPOINTS.documents);

      assertNoServerError(
        response,
        'Unauthenticated document listing'
      );

      if (response.status !== 200) {
        assertDenied(
          response,
          'Unauthenticated document listing'
        );
        return;
      }

      // A 200 response is allowed only if the API explicitly documents
      // this endpoint as public. Confirm that policy for your application.
      assertJsonWhenPresent(response, 'Public document listing');

      assert.ok(
        response.body && typeof response.body === 'object',
        'Public document endpoint must return a documented response.'
      );

      assertNoSensitiveFields(
        response.body,
        'Public document listing'
      );
    });
  });

  describe('administrator controller', () => {
    it('does not grant administrator access to an ordinary user token', async (t) => {
      if (!USER_TOKEN) {
        t.skip('Set CONTROLLER_TEST_USER_TOKEN.');
        return;
      }

      if (!isConfigured(ENDPOINTS.adminHealth)) {
        t.skip('Set CONTROLLER_ADMIN_HEALTH_PATH to a protected admin endpoint.');
        return;
      }

      const response = await request(ENDPOINTS.adminHealth, {
        token: USER_TOKEN,
      });

      assertNoServerError(
        response,
        'Administrator endpoint with user token'
      );

      assertDenied(
        response,
        'Administrator endpoint with user token'
      );
    });

    it('allows the configured administrator where access is intended', async (t) => {
      if (!ADMIN_TOKEN) {
        t.skip('Set CONTROLLER_TEST_ADMIN_TOKEN.');
        return;
      }

      if (!isConfigured(ENDPOINTS.adminHealth)) {
        t.skip('Set CONTROLLER_ADMIN_HEALTH_PATH to a protected admin endpoint.');
        return;
      }

      assert.notEqual(
        ADMIN_TOKEN,
        USER_TOKEN,
        'Administrator and ordinary-user credentials must be distinct.'
      );

      const response = await request(ENDPOINTS.adminHealth, {
        token: ADMIN_TOKEN,
      });

      assertNoServerError(
        response,
        'Administrator endpoint with admin token'
      );

      assert.ok(
        SUCCESS_STATUSES.includes(response.status),
        `Configured administrator was not accepted: HTTP ${response.status}.`
      );
    });
  });
});
