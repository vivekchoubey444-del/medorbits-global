
'use strict';

/**
 * MedOrbits -- Notification Integration Tests
 *
 * File: tests/integration/notification.integration.test.js
 * Runtime: Node.js >= 20
 *
 * Coverage:
 * - Notification endpoint availability
 * - Authentication and authorization
 * - Notification listing and response structure
 * - Pagination handling
 * - Read-state updates
 * - Cross-user notification access
 * - Input and HTTP method validation
 *
 * Required:
 * - Running MedOrbits integration-test API
 * - Dedicated test database and test users
 * - Notification paths matching the actual application routes
 *
 * Mutating tests are disabled by default.
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

const ALLOWED_READ_METHODS = new Set([
  'PATCH',
  'PUT',
  'POST',
]);

function validateConfiguration() {
  let base;

  try {
    base = new URL(BASE_URL);
  } catch {
    assert.fail('NOTIFICATION_TEST_BASE_URL must be a valid URL.');
  }

  assert.ok(
    ['http:', 'https:'].includes(base.protocol),
    'Notification test base URL must use HTTP or HTTPS.'
  );

  assert.ok(
    Number.isFinite(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'NOTIFICATION_TEST_TIMEOUT_MS must be a positive number.'
  );

  for (const [name, path] of Object.entries({
    NOTIFICATIONS_PATH,
    NOTIFICATION_PATH,
    READ_PATH,
    READ_ALL_PATH,
  })) {
    assert.equal(
      typeof path,
      'string',
      `${name} must be a string.`
    );

    assert.ok(
      path.startsWith('/') && !path.startsWith('//'),
      `${name} must be an absolute application path beginning with one slash.`
    );

    assert.ok(
      !/[\r\n]/.test(path),
      `${name} must not contain newline characters.`
    );
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

    const isLoopback =
      ['localhost', '127.0.0.1', '::1'].includes(
        base.hostname.toLowerCase()
      );

    assert.ok(
      isLoopback ||
        process.env.NOTIFICATION_TEST_ALLOW_REMOTE_MUTATIONS === 'true',
      'Remote mutation tests are blocked. Use a dedicated test API or explicitly set NOTIFICATION_TEST_ALLOW_REMOTE_MUTATIONS=true.'
    );

    assert.ok(
      USER_A_TOKEN && USER_B_TOKEN,
      'Mutating tests require dedicated User A and User B test tokens.'
    );

    assert.notEqual(
      USER_A_TOKEN,
      USER_B_TOKEN,
      'User A and User B must use distinct authentication tokens.'
    );
  }
}

function urlFor(path) {
  const url = new URL(path, `${BASE_URL}/`);
  const base = new URL(BASE_URL);

  assert.equal(
    url.origin,
    base.origin,
    'Request path must not change the configured API origin.'
  );

  return url;
}

function notificationUrl(id) {
  assert.ok(
    id !== undefined && id !== null && String(id).length > 0,
    'Notification ID must not be empty.'
  );

  return NOTIFICATION_PATH.replace(
    ':id',
    encodeURIComponent(String(id))
  );
}

function readUrl(id) {
  assert.ok(
    id !== undefined && id !== null && String(id).length > 0,
    'Notification ID must not be empty.'
  );

  return READ_PATH.replace(
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
    };
  } finally {
    clearTimeout(timer);
  }
}

function assertNoServerError(response, label) {
  assert.ok(
    response.status < 500,
    `${label}: unexpected HTTP ${response.status}; response=${JSON.stringify(response.body)}`
  );
}

function assertDenied(response, label) {
  assert.ok(
    [401, 403, 404].includes(response.status),
    `${label}: expected HTTP 401, 403, or 404; received HTTP ${response.status}.`
  );
}

function assertRejected(response, label) {
  assert.ok(
    [
      400, 401, 403, 404, 405,
      409, 413, 415, 422, 429,
    ].includes(response.status),
    `${label}: expected a client-error response; received HTTP ${response.status}.`
  );
}

function extractNotifications(response) {
  const body = response.body;

  if (Array.isArray(body)) {
    return body;
  }

  if (!body || typeof body !== 'object') {
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
  const body = response.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  if (
    body.notification &&
    typeof body.notification === 'object'
  ) {
    return body.notification;
  }

  if (
    body.data?.notification &&
    typeof body.data.notification === 'object'
  ) {
    return body.data.notification;
  }

  if (
    body.data &&
    typeof body.data === 'object' &&
    !Array.isArray(body.data)
  ) {
    return body.data;
  }

  return body;
}

function extractNotificationId(notification) {
  if (!notification || typeof notification !== 'object') {
    return null;
  }

  return (
    notification.id ??
    notification._id ??
    notification.notificationId ??
    null
  );
}

function isSuccess(response) {
  return [200, 201, 202, 204].includes(response.status);
}

function requireMutationOptIn() {
  assert.equal(
    RUN_MUTATING_TESTS,
    true,
    'Set RUN_NOTIFICATION_MUTATING_TESTS=true only for a dedicated test environment.'
  );
}

function assertSafeNotification(notification) {
  assert.ok(
    notification && typeof notification === 'object',
    'Every notification must be an object.'
  );

  assert.ok(
    extractNotificationId(notification),
    'Every notification must have an identifier.'
  );

  for (const sensitiveField of [
    'password',
    'passwordHash',
    'password_hash',
    'refreshToken',
    'refresh_token',
    'resetToken',
    'reset_token',
  ]) {
    assert.equal(
      Object.hasOwn(notification, sensitiveField),
      false,
      `Notification response must not expose ${sensitiveField}.`
    );
  }
}

describe('MedOrbits notification integration tests', () => {
  before(() => {
    validateConfiguration();
  });

  describe('endpoint availability', () => {
    it('handles notification listing without an internal server error', async () => {
      const response = await request(NOTIFICATIONS_PATH, {
        token: USER_A_TOKEN || undefined,
      });

      assertNoServerError(response, 'Notification listing');

      assert.ok(
        [
          200, 401, 403, 404, 405,
        ].includes(response.status),
        `Unexpected notification listing status: HTTP ${response.status}.`
      );
    });
  });

  describe('authentication and authorization', () => {
    it('handles unauthenticated notification listing according to endpoint policy', async () => {
      const response = await request(NOTIFICATIONS_PATH);

      assertNoServerError(
        response,
        'Unauthenticated notification listing'
      );

      assert.ok(
        [200, 401, 403, 404].includes(response.status),
        `Unexpected unauthenticated response: HTTP ${response.status}.`
      );

      // A 200 is allowed only for a deliberately public listing endpoint.
      if (response.status === 200) {
        assert.ok(
          Array.isArray(extractNotifications(response)),
          'A public listing endpoint must return a documented notification collection.'
        );
      }
    });

    it('does not authorize notification retrieval with an invalid token', async () => {
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
  });

  describe('notification listing', () => {
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

      const notifications = extractNotifications(response);

      assert.ok(
        Array.isArray(notifications),
        'Expected an array or a documented paginated notification collection.'
      );

      for (const notification of notifications) {
        assertSafeNotification(notification);
      }
    });

    it('handles valid pagination parameters safely', async (t) => {
      if (!USER_A_TOKEN) {
        t.skip('Set NOTIFICATION_TEST_USER_A_TOKEN.');
        return;
      }

      const separator = NOTIFICATIONS_PATH.includes('?') ? '&' : '?';

      const response = await request(
        `${NOTIFICATIONS_PATH}${separator}limit=10&page=1`,
        { token: USER_A_TOKEN }
      );

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

        assert.ok(
          Array.isArray(notifications),
          'Paginated response must include a notification array.'
        );

        assert.ok(
          notifications.length <= 10,
          'Endpoint returned more than the requested page size.'
        );

        for (const notification of notifications) {
          assertSafeNotification(notification);
        }
      }
    });

    it('handles invalid pagination values safely', async (t) => {
      if (!USER_A_TOKEN) {
        t.skip('Set NOTIFICATION_TEST_USER_A_TOKEN.');
        return;
      }

      const separator = NOTIFICATIONS_PATH.includes('?') ? '&' : '?';

      const response = await request(
        `${NOTIFICATIONS_PATH}${separator}limit=-100&page=-1`,
        { token: USER_A_TOKEN }
      );

      assertNoServerError(
        response,
        'Invalid notification pagination'
      );

      assert.ok(
        [200, 400, 422].includes(response.status),
        `Unexpected invalid-pagination response: HTTP ${response.status}.`
      );

      if (response.status === 200) {
        const notifications = extractNotifications(response);

        assert.ok(
          Array.isArray(notifications),
          'Notification response must contain a collection.'
        );

        assert.ok(
          notifications.length <= 100,
          'Invalid pagination returned an unexpectedly large result set.'
        );
      }
    });
  });

  describe('notification retrieval and ownership', () => {
    it(
      'prevents User B from reading User A private notification',
      { skip: !RUN_MUTATING_TESTS },
      async (t) => {
        requireMutationOptIn();

        if (!USER_A_FIXTURE_ID) {
          t.skip(
            'Set NOTIFICATION_USER_A_FIXTURE_ID to a real private notification owned by User A.'
          );
          return;
        }

        const response = await request(
          notificationUrl(USER_A_FIXTURE_ID),
          { token: USER_B_TOKEN }
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

    it('rejects a malformed notification identifier', async (t) => {
      if (!USER_A_TOKEN) {
        t.skip('Set NOTIFICATION_TEST_USER_A_TOKEN.');
        return;
      }

      // The slash is encoded by notificationUrl(), so it stays within
      // the identifier segment for normal Express routing.
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
        `Expected malformed ID rejection; received HTTP ${response.status}.`
      );
    });
  });

  describe('read-state updates', () => {
    it(
      'marks an owned notification as read',
      { skip: !RUN_MUTATING_TESTS },
      async (t) => {
        requireMutationOptIn();

        if (!USER_A_FIXTURE_ID) {
          t.skip(
            'Set NOTIFICATION_USER_A_FIXTURE_ID to an existing notification owned by User A.'
          );
          return;
        }

        const response = await request(
          readUrl(USER_A_FIXTURE_ID),
          {
            method: READ_METHOD,
            token: USER_A_TOKEN,
            body: {},
          }
        );

        assertNoServerError(
          response,
          'Mark notification as read'
        );

        assert.ok(
          isSuccess(response),
          `Expected a successful read-state update; received HTTP ${response.status}.`
        );

        if (response.status === 204) {
          return;
        }

        const notification = extractNotification(response);

        if (
          notification &&
          typeof notification === 'object'
        ) {
          if (notification.isRead !== undefined) {
            assert.equal(
              notification.isRead,
              true,
              'Successful update should set isRead to true.'
            );
          }

          if (notification.read !== undefined) {
            assert.equal(
              notification.read,
              true,
              'Successful update should set read to true.'
            );
          }

          if (notification.readAt !== undefined) {
            assert.ok(
              notification.readAt,
              'Successful update should set readAt.'
            );
          }
        }
      }
    );

    it(
      'prevents User B from marking User A notification as read',
      { skip: !RUN_MUTATING_TESTS },
      async (t) => {
        requireMutationOptIn();

        if (!USER_A_FIXTURE_ID) {
          t.skip(
            'Set NOTIFICATION_USER_A_FIXTURE_ID to a private notification owned by User A.'
          );
          return;
        }

        const response = await request(
          readUrl(USER_A_FIXTURE_ID),
          {
            method: READ_METHOD,
            token: USER_B_TOKEN,
            body: {},
          }
        );

        assertNoServerError(
          response,
          'Cross-user read-state update'
        );

        assertDenied(
          response,
          'Cross-user read-state update'
        );
      }
    );

    it(
      'handles mark-all-as-read for User A',
      { skip: !RUN_MUTATING_TESTS },
      async () => {
        requireMutationOptIn();

        const response = await request(READ_ALL_PATH, {
          method: READ_METHOD,
          token: USER_A_TOKEN,
          body: {},
        });

        assertNoServerError(
          response,
          'Mark all notifications as read'
        );

        assert.ok(
          isSuccess(response),
          `Expected a successful mark-all-as-read response; received HTTP ${response.status}.`
        );
      }
    );
  });

  describe('input validation and method handling', () => {
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

      assertRejected(
        response,
        'Unauthenticated notification creation'
      );
    });
  });
});
