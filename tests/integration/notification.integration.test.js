
'use strict';

/**
 * MedOrbits -- Notification Integration Tests
 * File: tests/integration/notification.integration.test.js
 * Runtime: Node.js >= 20
 *
 * Coverage:
 * - Endpoint availability and response contracts
 * - Authentication and authorization
 * - Notification listing and pagination
 * - Notification identifiers and sensitive-data exposure
 * - Read-state updates and post-update verification
 * - Cross-user notification access and modification
 * - Input validation and HTTP method restrictions
 *
 * Requirements:
 * - Running MedOrbits integration-test API
 * - Dedicated test users and database
 * - Paths and payloads matching the actual API
 *
 * Safety:
 * - Mutating tests are disabled by default.
 * - Mutations require NODE_ENV=test.
 * - Remote mutations require explicit opt-in.
 * - Use disposable fixtures, never production notifications.
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = (
  process.env.NOTIFICATION_TEST_BASE_URL ||
  process.env.TEST_BASE_URL ||
  'http://127.0.0.1:3000'
).replace(/\/+$/, '');

const NOTIFICATIONS_PATH =
  process.env.NOTIFICATIONS_TEST_PATH ||
  '/api/notifications';

const NOTIFICATION_PATH =
  process.env.NOTIFICATION_TEST_PATH ||
  '/api/notifications/:id';

const READ_PATH =
  process.env.NOTIFICATION_READ_TEST_PATH ||
  '/api/notifications/:id/read';

const READ_ALL_PATH =
  process.env.NOTIFICATION_READ_ALL_TEST_PATH ||
  '/api/notifications/read-all';

const READ_METHOD = (
  process.env.NOTIFICATION_READ_TEST_METHOD || 'PATCH'
).toUpperCase();

const USER_A_TOKEN =
  process.env.NOTIFICATION_TEST_USER_A_TOKEN || '';

const USER_B_TOKEN =
  process.env.NOTIFICATION_TEST_USER_B_TOKEN || '';

const USER_A_FIXTURE_ID =
  process.env.NOTIFICATION_USER_A_FIXTURE_ID || '';

const TIMEOUT_MS = Number(
  process.env.NOTIFICATION_TEST_TIMEOUT_MS || 15000
);

const RUN_MUTATING_TESTS =
  process.env.RUN_NOTIFICATION_MUTATING_TESTS === 'true';

const ALLOW_REMOTE_MUTATIONS =
  process.env.NOTIFICATION_TEST_ALLOW_REMOTE_MUTATIONS === 'true';

const ALLOW_CI_MUTATIONS =
  process.env.NOTIFICATION_TEST_CI_MUTATIONS === 'true';

const SUCCESS_STATUSES = [200, 201, 202, 204];

const DENIED_STATUSES = [401, 403, 404];

const REJECTION_STATUSES = [
  400, 401, 403, 404, 405, 409, 413, 415, 422, 429,
];

const ALLOWED_READ_METHODS = new Set([
  'PATCH',
  'PUT',
  'POST',
]);

const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'refreshtoken',
  'refresh_token',
  'resettoken',
  'reset_token',
  'accesstoken',
  'access_token',
  'clientsecret',
  'client_secret',
  'webhooksecret',
  'webhook_secret',
  'privatekey',
  'private_key',
]);

function validateConfiguration() {
  let base;

  try {
    base = new URL(BASE_URL);
  } catch {
    assert.fail(
      'NOTIFICATION_TEST_BASE_URL must be a valid absolute URL.'
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(base.protocol),
    'Notification test URL must use HTTP or HTTPS.'
  );

  assert.equal(
    base.username,
    '',
    'Do not embed credentials in the test base URL.'
  );

  assert.equal(
    base.password,
    '',
    'Do not embed credentials in the test base URL.'
  );

  assert.equal(
    base.search,
    '',
    'The test base URL must not contain a query string.'
  );

  assert.equal(
    base.hash,
    '',
    'The test base URL must not contain a fragment.'
  );

  assert.ok(
    Number.isSafeInteger(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'NOTIFICATION_TEST_TIMEOUT_MS must be a positive safe integer.'
  );

  for (const [name, path] of Object.entries({
    NOTIFICATIONS_PATH,
    NOTIFICATION_PATH,
    READ_PATH,
    READ_ALL_PATH,
  })) {
    validatePath(name, path);
  }

  assert.ok(
    NOTIFICATION_PATH.includes(':id'),
    'NOTIFICATION_TEST_PATH must contain the :id placeholder.'
  );

  assert.ok(
    READ_PATH.includes(':id'),
    'NOTIFICATION_READ_TEST_PATH must contain the :id placeholder.'
  );

  assert.ok(
    ALLOWED_READ_METHODS.has(READ_METHOD),
    'NOTIFICATION_READ_TEST_METHOD must be PATCH, PUT, or POST.'
  );

  if (RUN_MUTATING_TESTS) {
    assert.equal(
      process.env.NODE_ENV,
      'test',
      'Mutating notification tests require NODE_ENV=test.'
    );

    const hostname = base.hostname.toLowerCase();

    const isLoopback = [
      'localhost',
      '127.0.0.1',
      '::1',
      '[::1]',
    ].includes(hostname);

    assert.ok(
      isLoopback || ALLOW_REMOTE_MUTATIONS,
      'Remote mutations are blocked. Use an isolated local test API or set NOTIFICATION_TEST_ALLOW_REMOTE_MUTATIONS=true for a dedicated remote sandbox.'
    );

    assert.ok(
      !process.env.CI ||
        process.env.CI.toLowerCase() !== 'true' ||
        ALLOW_CI_MUTATIONS,
      'CI mutations require NOTIFICATION_TEST_CI_MUTATIONS=true and an isolated CI test environment.'
    );

    assert.ok(
      USER_A_TOKEN,
      'Mutating tests require NOTIFICATION_TEST_USER_A_TOKEN.'
    );

    assert.ok(
      USER_B_TOKEN,
      'Mutating tests require NOTIFICATION_TEST_USER_B_TOKEN.'
    );

    assert.notEqual(
      USER_A_TOKEN,
      USER_B_TOKEN,
      'User A and User B must use distinct authentication tokens.'
    );
  }

  if (USER_A_FIXTURE_ID) {
    assert.ok(
      USER_A_FIXTURE_ID.length <= 512,
      'NOTIFICATION_USER_A_FIXTURE_ID is too long.'
    );
  }
}

function validatePath(name, path) {
  assert.equal(
    typeof path,
    'string',
    `${name} must be a string.`
  );

  assert.ok(
    path.startsWith('/') &&
      !path.startsWith('//') &&
      !/[\r\n\\]/.test(path),
    `${name} must be an origin-relative path beginning with exactly one slash.`
  );

  assert.ok(
    !/^[a-z][a-z\d+.-]*:/i.test(path),
    `${name} must not be an absolute URL.`
  );

  assert.ok(
    !path.includes('#'),
    `${name} must not contain a URL fragment.`
  );
}

function urlFor(path) {
  validatePath('Request path', path);

  const base = new URL(BASE_URL);
  const url = new URL(path, `${BASE_URL}/`);

  assert.equal(
    url.origin,
    base.origin,
    'Request path must not change the configured API origin.'
  );

  return url;
}

function notificationUrl(id) {
  return replaceId(NOTIFICATION_PATH, id);
}

function readUrl(id) {
  return replaceId(READ_PATH, id);
}

function replaceId(path, id) {
  assert.ok(
    id !== undefined &&
      id !== null &&
      String(id).length > 0,
    'Notification ID must not be empty.'
  );

  assert.ok(
    String(id).length <= 512,
    'Notification ID is too long.'
  );

  assert.ok(
    path.includes(':id'),
    'Notification route is missing its :id placeholder.'
  );

  return path.replace(':id', encodeURIComponent(String(id)));
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
  const url = urlFor(path);
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
    const response = await fetch(url, {
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
      url: url.toString(),
    };
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${TIMEOUT_MS} ms: ${method} ${url.pathname}`,
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
    `${label}: unexpected HTTP ${response.status}; response=${safeResponseSummary(response)}`
  );
}

function assertDenied(response, label) {
  assert.ok(
    DENIED_STATUSES.includes(response.status),
    `${label}: expected HTTP 401, 403, or 404; received HTTP ${response.status}.`
  );
}

function assertRejected(response, label) {
  assert.ok(
    REJECTION_STATUSES.includes(response.status),
    `${label}: expected a client-error response; received HTTP ${response.status}.`
  );
}

function assertSuccess(response, label) {
  assert.ok(
    SUCCESS_STATUSES.includes(response.status),
    `${label}: expected HTTP ${SUCCESS_STATUSES.join(', ')}; received HTTP ${response.status}.`
  );
}

function safeResponseSummary(response) {
  const body = response?.body;

  if (body === null || body === undefined) {
    return '(empty response body)';
  }

  if (typeof body === 'string') {
    return body.slice(0, 300);
  }

  // Avoid dumping response bodies that could contain tokens or PII.
  return JSON.stringify({
    keys: Object.keys(body).slice(0, 20),
    message:
      typeof body.message === 'string'
        ? body.message.slice(0, 200)
        : undefined,
    error:
      typeof body.error === 'string'
        ? body.error.slice(0, 200)
        : undefined,
  });
}

function extractNotifications(response) {
  const body = response?.body;

  if (Array.isArray(body)) {
    return body;
  }

  if (!isPlainObject(body)) {
    return null;
  }

  if (Array.isArray(body.notifications)) {
    return body.notifications;
  }

  if (Array.isArray(body.data?.notifications)) {
    return body.data.notifications;
  }

  if (Array.isArray(body.data)) {
    return body.data;
  }

  if (Array.isArray(body.results)) {
    return body.results;
  }

  return null;
}

function extractNotification(response) {
  const body = response?.body;

  if (!isPlainObject(body)) {
    return null;
  }

  if (isPlainObject(body.notification)) {
    return body.notification;
  }

  if (isPlainObject(body.data?.notification)) {
    return body.data.notification;
  }

  if (isPlainObject(body.data)) {
    return body.data;
  }

  return body;
}

function extractNotificationId(notification) {
  if (!isPlainObject(notification)) {
    return null;
  }

  return (
    notification.id ??
    notification._id ??
    notification.notificationId ??
    null
  );
}

function isPlainObject(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value)
  );
}

function isSuccess(response) {
  return SUCCESS_STATUSES.includes(response.status);
}

function requireMutationOptIn() {
  assert.equal(
    RUN_MUTATING_TESTS,
    true,
    'Set RUN_NOTIFICATION_MUTATING_TESTS=true only for a dedicated test environment.'
  );

  assert.equal(
    process.env.NODE_ENV,
    'test',
    'Mutating notification tests require NODE_ENV=test.'
  );
}

function requireUserA() {
  assert.ok(
    USER_A_TOKEN,
    'Set NOTIFICATION_TEST_USER_A_TOKEN.'
  );
}

function requireUserB() {
  assert.ok(
    USER_B_TOKEN,
    'Set NOTIFICATION_TEST_USER_B_TOKEN.'
  );
}

function requireFixtureId() {
  assert.ok(
    USER_A_FIXTURE_ID,
    'Set NOTIFICATION_USER_A_FIXTURE_ID to an existing private notification owned by User A.'
  );
}

function assertSafeNotification(notification) {
  assert.ok(
    isPlainObject(notification),
    'Every notification must be a JSON object.'
  );

  const id = extractNotificationId(notification);

  assert.ok(
    id !== null && id !== undefined && String(id).length > 0,
    'Every notification must have an identifier.'
  );

  const stack = [notification];
  const visited = new Set();

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current || typeof current !== 'object') {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      const normalizedKey = key.replace(/[-\s]/g, '').toLowerCase();

      assert.equal(
        SENSITIVE_FIELD_NAMES.has(normalizedKey),
        false,
        `Notification response must not expose sensitive field "${key}".`
      );

      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }
}

function assertCollectionSafe(notifications) {
  assert.ok(
    Array.isArray(notifications),
    'Expected a notification array.'
  );

  for (const notification of notifications) {
    assertSafeNotification(notification);
  }
}

function readState(notification) {
  if (!isPlainObject(notification)) {
    return null;
  }

  if (typeof notification.isRead === 'boolean') {
    return notification.isRead;
  }

  if (typeof notification.read === 'boolean') {
    return notification.read;
  }

  if (notification.readAt !== undefined) {
    return Boolean(notification.readAt);
  }

  if (notification.read_at !== undefined) {
    return Boolean(notification.read_at);
  }

  return null;
}

function assertMarkedRead(notification, label) {
  const state = readState(notification);

  assert.equal(
    state,
    true,
    `${label}: could not confirm the notification is marked as read. Check the response schema or configure a compatible verification endpoint.`
  );
}

async function getNotificationAsUserA(id) {
  return request(notificationUrl(id), {
    token: USER_A_TOKEN,
  });
}

async function getNotificationAsUserB(id) {
  return request(notificationUrl(id), {
    token: USER_B_TOKEN,
  });
}

function appendQuery(path, parameters) {
  const url = urlFor(path);

  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, String(value));
  }

  return `${url.pathname}${url.search}`;
}

describe('MedOrbits notification integration tests', () => {
  before(() => {
    validateConfiguration();
  });

  describe('endpoint availability', () => {
    it('responds to notification listing without an internal server error', async () => {
      const response = await request(NOTIFICATIONS_PATH, {
        token: USER_A_TOKEN || undefined,
      });

      assertNoServerError(response, 'Notification listing');

      assert.ok(
        [200, 401, 403, 404, 405].includes(response.status),
        `Unexpected notification listing status: HTTP ${response.status}.`
      );
    });
  });

  describe('authentication and authorization', () => {
    it('does not expose private notifications to an unauthenticated caller', async () => {
      const response = await request(NOTIFICATIONS_PATH);

      assertNoServerError(
        response,
        'Unauthenticated notification listing'
      );

      assert.ok(
        [401, 403, 404].includes(response.status),
        `Expected the private notification listing to deny unauthenticated access; received HTTP ${response.status}. If this endpoint is intentionally public, replace this assertion with a documented public-response contract.`
      );
    });

    it('rejects an invalid bearer token for notification listing', async () => {
      const response = await request(NOTIFICATIONS_PATH, {
        token: 'invalid.notification.integration.token',
      });

      assertNoServerError(
        response,
        'Invalid-token notification listing'
      );

      assertDenied(
        response,
        'Invalid-token notification listing'
      );
    });

    it('rejects an invalid bearer token for notification retrieval', async () => {
      const response = await request(
        notificationUrl('invalid-notification-id'),
        {
          token: 'invalid.notification.integration.token',
        }
      );

      assertNoServerError(
        response,
        'Invalid-token notification retrieval'
      );

      assertDenied(
        response,
        'Invalid-token notification retrieval'
      );
    });

    it(
      'prevents User B from reading User A private notification',
      { skip: !USER_A_TOKEN || !USER_B_TOKEN || !USER_A_FIXTURE_ID },
      async () => {
        requireUserA();
        requireUserB();
        requireFixtureId();

        assert.notEqual(
          USER_A_TOKEN,
          USER_B_TOKEN,
          'User A and User B must use distinct authentication tokens.'
        );

        const response = await getNotificationAsUserB(
          USER_A_FIXTURE_ID
        );

        assertNoServerError(
          response,
          'Cross-user notification retrieval'
        );

        assertDenied(
          response,
          'Cross-user notification retrieval'
        );
      }
    );
  });

  describe('notification listing and response structure', () => {
    it('returns a valid notification collection for User A', async (t) => {
      if (!USER_A_TOKEN) {
        t.skip('Set NOTIFICATION_TEST_USER_A_TOKEN.');
        return;
      }

      const response = await request(NOTIFICATIONS_PATH, {
        token: USER_A_TOKEN,
      });

      assertNoServerError(
        response,
        'Authenticated notification listing'
      );

      assert.equal(
        response.status,
        200,
        `Expected HTTP 200; received HTTP ${response.status}.`
      );

      assertCollectionSafe(extractNotifications(response));
    });

    it('handles valid pagination parameters', async (t) => {
      if (!USER_A_TOKEN) {
        t.skip('Set NOTIFICATION_TEST_USER_A_TOKEN.');
        return;
      }

      const path = appendQuery(NOTIFICATIONS_PATH, {
        limit: 10,
        page: 1,
      });

      const response = await request(path, {
        token: USER_A_TOKEN,
      });

      assertNoServerError(
        response,
        'Notification pagination'
      );

      assert.ok(
        [200, 400, 422].includes(response.status),
        `Unexpected pagination response: HTTP ${response.status}.`
      );

      if (response.status === 200) {
        const notifications = extractNotifications(response);

        assertCollectionSafe(notifications);

        assert.ok(
          notifications.length <= 10,
          'Endpoint returned more notifications than the requested limit.'
        );
      }
    });

    it('handles invalid pagination values without an internal error', async (t) => {
      if (!USER_A_TOKEN) {
        t.skip('Set NOTIFICATION_TEST_USER_A_TOKEN.');
        return;
      }

      const path = appendQuery(NOTIFICATIONS_PATH, {
        limit: -100,
        page: -1,
      });

      const response = await request(path, {
        token: USER_A_TOKEN,
      });

      assertNoServerError(
        response,
        'Invalid notification pagination'
      );

      assert.ok(
        [200, 400, 422].includes(response.status),
        `Unexpected invalid-pagination response: HTTP ${response.status}.`
      );

      if (response.status === 200) {
        assertCollectionSafe(extractNotifications(response));

        assert.ok(
          extractNotifications(response).length <= 100,
          'Invalid pagination returned an unexpectedly large result set.'
        );
      }
    });

    it('does not expose sensitive fields in a retrieved notification', async (t) => {
      if (!USER_A_TOKEN || !USER_A_FIXTURE_ID) {
        t.skip(
          'Set NOTIFICATION_TEST_USER_A_TOKEN and NOTIFICATION_USER_A_FIXTURE_ID.'
        );
        return;
      }

      const response = await getNotificationAsUserA(
        USER_A_FIXTURE_ID
      );

      assertNoServerError(
        response,
        'Notification detail retrieval'
      );

      assert.equal(
        response.status,
        200,
        `Expected HTTP 200; received HTTP ${response.status}.`
      );

      assertSafeNotification(extractNotification(response));
    });
  });

  describe('notification identifier validation', () => {
    it('does not resolve a malformed notification identifier to a record', async (t) => {
      if (!USER_A_TOKEN) {
        t.skip('Set NOTIFICATION_TEST_USER_A_TOKEN.');
        return;
      }

      const response = await request(
        notificationUrl('invalid/id'),
        { token: USER_A_TOKEN }
      );

      assertNoServerError(
        response,
        'Malformed notification identifier'
      );

      assert.ok(
        [400, 404, 422].includes(response.status),
        `Expected malformed identifier rejection; received HTTP ${response.status}.`
      );
    });
  });

  describe('read-state updates', () => {
    it(
      'marks an owned notification as read and verifies the persisted state',
      { skip: !RUN_MUTATING_TESTS || !USER_A_FIXTURE_ID },
      async () => {
        requireMutationOptIn();
        requireUserA();
        requireFixtureId();

        const updateResponse = await request(
          readUrl(USER_A_FIXTURE_ID),
          {
            method: READ_METHOD,
            token: USER_A_TOKEN,
            body: {},
          }
        );

        assertNoServerError(
          updateResponse,
          'Mark notification as read'
        );

        assertSuccess(
          updateResponse,
          'Mark notification as read'
        );

        // A 204 has no response body. Verify persisted state using GET.
        const detailResponse = await getNotificationAsUserA(
          USER_A_FIXTURE_ID
        );

        assertNoServerError(
          detailResponse,
          'Read-state persistence verification'
        );

        assert.equal(
          detailResponse.status,
          200,
          `Could not retrieve notification after read-state update; received HTTP ${detailResponse.status}.`
        );

        const notification = extractNotification(detailResponse);

        assertSafeNotification(notification);
        assertMarkedRead(
          notification,
          'Read-state persistence verification'
        );
      }
    );

    it(
      'prevents User B from marking User A notification as read',
      { skip: !RUN_MUTATING_TESTS || !USER_A_FIXTURE_ID },
      async () => {
        requireMutationOptIn();
        requireUserA();
        requireUserB();
        requireFixtureId();

        assert.notEqual(
          USER_A_TOKEN,
          USER_B_TOKEN,
          'User A and User B must use distinct authentication tokens.'
        );

        const beforeResponse = await getNotificationAsUserA(
          USER_A_FIXTURE_ID
        );

        assert.equal(
          beforeResponse.status,
          200,
          'User A must be able to retrieve the test notification before the authorization test.'
        );

        const beforeNotification = extractNotification(beforeResponse);
        assertSafeNotification(beforeNotification);

        const beforeState = readState(beforeNotification);

        const updateResponse = await request(
          readUrl(USER_A_FIXTURE_ID),
          {
            method: READ_METHOD,
            token: USER_B_TOKEN,
            body: {},
          }
        );

        assertNoServerError(
          updateResponse,
          'Cross-user read-state update'
        );

        assertDenied(
          updateResponse,
          'Cross-user read-state update'
        );

        const afterResponse = await getNotificationAsUserA(
          USER_A_FIXTURE_ID
        );

        assert.equal(
          afterResponse.status,
          200,
          'User A must still be able to retrieve the notification after the denied update.'
        );

        const afterNotification = extractNotification(afterResponse);
        assertSafeNotification(afterNotification);

        const afterState = readState(afterNotification);

        if (beforeState !== null) {
          assert.equal(
            afterState,
            beforeState,
            'A denied cross-user update must not change User A notification read state.'
          );
        }
      }
    );

    it(
      'marks all notifications as read for User A',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();
        requireUserA();

        const response = await request(READ_ALL_PATH, {
          method: READ_METHOD,
          token: USER_A_TOKEN,
          body: {},
        });

        assertNoServerError(
          response,
          'Mark all notifications as read'
        );

        assertSuccess(
          response,
          'Mark all notifications as read'
        );

        // Check the list after the update. If the API paginates by default,
        // this verifies only the returned page, not every stored notification.
        const listResponse = await request(
          appendQuery(NOTIFICATIONS_PATH, {
            limit: 100,
            page: 1,
          }),
          { token: USER_A_TOKEN }
        );

        assertNoServerError(
          listResponse,
          'Mark-all-as-read persistence verification'
        );

        assert.equal(
          listResponse.status,
          200,
          'Could not retrieve notifications after the mark-all-as-read request.'
        );

        const notifications = extractNotifications(listResponse);
        assertCollectionSafe(notifications);

        for (const notification of notifications) {
          const state = readState(notification);

          if (state !== null) {
            assert.equal(
              state,
              true,
              'A notification returned by the post-update listing is still unread.'
            );
          }
        }
      }
    );
  });

  describe('input validation and HTTP methods', () => {
    it('does not execute TRACE requests successfully', async () => {
      const response = await request(NOTIFICATIONS_PATH, {
        method: 'TRACE',
      });

      assert.ok(
        [400, 401, 403, 404, 405].includes(response.status),
        `Unexpected TRACE response: HTTP ${response.status}.`
      );
    });

    it('does not create notifications through an unauthenticated POST request', async () => {
      const response = await request(NOTIFICATIONS_PATH, {
        method: 'POST',
        body: {
          title: 'Unauthorized notification integration test',
          message: 'This request must not create a private notification.',
          isRead: false,
        },
      });

      assertNoServerError(
        response,
        'Unauthenticated notification creation'
      );

      assertDenied(
        response,
        'Unauthenticated notification creation'
      );
    });

    it('rejects malformed JSON when the API route accepts raw JSON requests', async () => {
      const url = urlFor(NOTIFICATIONS_PATH);
      const controller = new AbortController();

      const timer = setTimeout(
        () => controller.abort(),
        TIMEOUT_MS
      );

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(USER_A_TOKEN
              ? { Authorization: `Bearer ${USER_A_TOKEN}` }
              : {}),
          },
          body: '{"title":',
          signal: controller.signal,
          redirect: 'manual',
        });

        const rawBody = await response.text();

        assert.ok(
          [400, 401, 403, 404, 405, 415, 422].includes(response.status),
          `Malformed JSON should be rejected; received HTTP ${response.status}. Body length: ${rawBody.length}.`
        );
      } catch (error) {
        if (error && error.name === 'AbortError') {
          throw new Error(
            `Malformed JSON test timed out after ${TIMEOUT_MS} ms.`,
            { cause: error }
          );
        }

        throw error;
      } finally {
        clearTimeout(timer);
      }
    });
  });
});
