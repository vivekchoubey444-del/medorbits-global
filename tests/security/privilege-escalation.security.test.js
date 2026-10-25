
'use strict';

/**
 * MedOrbits -- Privilege Escalation Security Tests
 *
 * File: tests/security/privilege-escalation.security.test.js
 * Runtime: Node.js >= 20
 * Dependencies: Node.js built-in modules only
 *
 * Required configuration:
 *   PRIVILEGE_TEST_BASE_URL
 *   PRIVILEGE_TEST_USER_TOKEN
 *
 * Optional configuration:
 *   PRIVILEGE_TEST_ADMIN_TOKEN
 *   PRIVILEGE_TEST_USER_ID
 *   PRIVILEGE_TEST_PROFILE_PATH
 *   PRIVILEGE_TEST_ADMIN_PATH
 *   PRIVILEGE_TEST_TIMEOUT_MS
 *   PRIVILEGE_TEST_EXPECT_ROLE
 *
 * Mutation safeguards:
 *   PRIVILEGE_TEST_RUN_MUTATIONS=true
 *   PRIVILEGE_TEST_ENVIRONMENT=sandbox
 *   PRIVILEGE_TEST_ALLOW_REMOTE=true       Remote read-only access
 *   PRIVILEGE_TEST_ALLOW_REMOTE_MUTATIONS=true
 *   PRIVILEGE_TEST_ALLOW_CI_MUTATIONS=true  Required in CI
 *
 * Run read-only tests:
 *   PRIVILEGE_TEST_BASE_URL=http://127.0.0.1:3000 \
 *   PRIVILEGE_TEST_USER_TOKEN=your-test-user-token \
 *   node --test tests/security/privilege-escalation.security.test.js
 *
 * Run mutation tests against a dedicated local test environment:
 *   NODE_ENV=test \
 *   PRIVILEGE_TEST_ENVIRONMENT=sandbox \
 *   PRIVILEGE_TEST_RUN_MUTATIONS=true \
 *   PRIVILEGE_TEST_BASE_URL=http://127.0.0.1:3000 \
 *   PRIVILEGE_TEST_USER_TOKEN=your-test-user-token \
 *   node --test tests/security/privilege-escalation.security.test.js
 *
 * IMPORTANT:
 * - Never use production credentials or production accounts.
 * - Use a disposable low-privilege test account.
 * - Mutation tests are disabled by default.
 * - Configure endpoints to match the actual API contract.
 * - This suite does not create, delete, or reset test accounts.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = (
  process.env.PRIVILEGE_TEST_BASE_URL || ''
).trim().replace(/\/+$/, '');

const USER_TOKEN =
  process.env.PRIVILEGE_TEST_USER_TOKEN || '';

const ADMIN_TOKEN =
  process.env.PRIVILEGE_TEST_ADMIN_TOKEN || '';

const USER_ID =
  process.env.PRIVILEGE_TEST_USER_ID || '';

const PROFILE_PATH =
  process.env.PRIVILEGE_TEST_PROFILE_PATH ||
  (USER_ID
    ? `/api/users/${encodeURIComponent(USER_ID)}`
    : '');

const ADMIN_PATH =
  process.env.PRIVILEGE_TEST_ADMIN_PATH || '/api/admin';

const TIMEOUT_MS = Number(
  process.env.PRIVILEGE_TEST_TIMEOUT_MS || 15000
);

const EXPECTED_ROLE = (
  process.env.PRIVILEGE_TEST_EXPECT_ROLE || 'user'
).trim();

const RUN_MUTATIONS =
  process.env.PRIVILEGE_TEST_RUN_MUTATIONS === 'true';

const TEST_ENVIRONMENT = (
  process.env.PRIVILEGE_TEST_ENVIRONMENT || ''
).trim().toLowerCase();

const ALLOW_REMOTE =
  process.env.PRIVILEGE_TEST_ALLOW_REMOTE === 'true';

const ALLOW_REMOTE_MUTATIONS =
  process.env.PRIVILEGE_TEST_ALLOW_REMOTE_MUTATIONS === 'true';

const ALLOW_CI_MUTATIONS =
  process.env.PRIVILEGE_TEST_ALLOW_CI_MUTATIONS === 'true';

const IS_CI = Boolean(
  process.env.CI ||
  process.env.GITHUB_ACTIONS ||
  process.env.GITLAB_CI ||
  process.env.BUILDKITE ||
  process.env.JENKINS_URL
);

const CONFIGURED = Boolean(
  BASE_URL &&
  USER_TOKEN &&
  Number.isFinite(TIMEOUT_MS) &&
  TIMEOUT_MS >= 100 &&
  TIMEOUT_MS <= 120000 &&
  EXPECTED_ROLE
);

const MAX_RESPONSE_BYTES = 1024 * 1024;

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
]);

const PRIVILEGED_FIELDS = new Set([
  'role',
  'roles',
  'isadmin',
  'issuperadmin',
  'admin',
  'permissions',
  'permission',
  'privilege',
  'privileges',
  'accesslevel',
  'accounttype',
  'isstaff',
  'isverified',
  'verified',
  'isactive',
  'status',
].map(normalizeKey));

const SECURITY_STATE_FIELDS = new Set([
  'role',
  'roles',
  'isadmin',
  'issuperadmin',
  'admin',
  'permissions',
  'permission',
  'privilege',
  'privileges',
  'accesslevel',
  'accounttype',
  'isstaff',
].map(normalizeKey));

function normalizeKey(key) {
  return String(key)
    .replace(/[-_\s]/g, '')
    .toLowerCase();
}

function validPath(path) {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('\\') &&
    !/[\r\n\u0000]/.test(path) &&
    !path.includes('#')
  );
}

function validateBaseUrl() {
  let url;

  try {
    url = new URL(BASE_URL);
  } catch {
    throw new Error(
      'PRIVILEGE_TEST_BASE_URL must be a valid absolute URL.'
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(url.protocol),
    'Base URL must use HTTP or HTTPS.'
  );

  assert.equal(
    url.username + url.password,
    '',
    'Do not include credentials in the base URL.'
  );

  assert.equal(
    url.search,
    '',
    'The base URL must not contain a query string.'
  );

  assert.equal(
    url.hash,
    '',
    'The base URL must not contain a fragment.'
  );

  const isLocal = LOCAL_HOSTS.has(url.hostname);

  assert.ok(
    isLocal || ALLOW_REMOTE,
    'Remote targets require PRIVILEGE_TEST_ALLOW_REMOTE=true.'
  );

  if (!isLocal) {
    assert.equal(
      url.protocol,
      'https:',
      'Remote test targets must use HTTPS.'
    );
  }

  return { url, isLocal };
}

function mutationSkipReason() {
  if (!RUN_MUTATIONS) {
    return 'Mutation tests are disabled; set PRIVILEGE_TEST_RUN_MUTATIONS=true to enable them.';
  }

  if (process.env.NODE_ENV !== 'test') {
    return 'Mutation tests require NODE_ENV=test.';
  }

  if (TEST_ENVIRONMENT !== 'sandbox') {
    return 'Mutation tests require PRIVILEGE_TEST_ENVIRONMENT=sandbox.';
  }

  if (IS_CI && !ALLOW_CI_MUTATIONS) {
    return 'Mutation tests in CI require PRIVILEGE_TEST_ALLOW_CI_MUTATIONS=true.';
  }

  if (BASE_URL) {
    try {
      const { isLocal } = validateBaseUrl();

      if (
        !isLocal &&
        (!ALLOW_REMOTE || !ALLOW_REMOTE_MUTATIONS)
      ) {
        return 'Remote mutations require both PRIVILEGE_TEST_ALLOW_REMOTE=true and PRIVILEGE_TEST_ALLOW_REMOTE_MUTATIONS=true.';
      }
    } catch (error) {
      return `Mutation target configuration is invalid: ${error.message}`;
    }
  }

  return null;
}

function headers(token, extraHeaders = {}, hasBody = false) {
  return {
    Accept: 'application/json',
    ...(hasBody
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
    ...extraHeaders,
  };
}

function assertSafePath(path) {
  assert.ok(
    validPath(path),
    `Invalid API path: ${String(path)}`
  );
}

async function request(path, options = {}) {
  assert.ok(
    BASE_URL,
    'PRIVILEGE_TEST_BASE_URL is required.'
  );

  assertSafePath(path);

  const {
    token = USER_TOKEN,
    method = 'GET',
    body,
    extraHeaders = {},
  } = options;

  const url = new URL(path, `${BASE_URL}/`);

  const base = new URL(BASE_URL);

  assert.equal(
    url.origin,
    base.origin,
    'Request URL must remain on the configured origin.'
  );

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  try {
    return await fetch(url, {
      method,
      headers: headers(
        token,
        extraHeaders,
        body !== undefined
      ),
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
      redirect: 'manual',
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${TIMEOUT_MS} ms: ${method} ${path}`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function responseBody(response) {
  const contentLength = Number(
    response.headers.get('content-length') || 0
  );

  assert.ok(
    !Number.isFinite(contentLength) ||
      contentLength <= MAX_RESPONSE_BYTES,
    `Response exceeds the ${MAX_RESPONSE_BYTES}-byte limit.`
  );

  const raw = await response.text();

  assert.ok(
    Buffer.byteLength(raw, 'utf8') <= MAX_RESPONSE_BYTES,
    `Response exceeds the ${MAX_RESPONSE_BYTES}-byte limit.`
  );

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function assertNotServerError(response, description) {
  assert.ok(
    response.status < 500,
    `${description}: unexpected HTTP ${response.status}`
  );
}

function assertAuthorizationDenied(response, description) {
  assert.ok(
    [401, 403, 404].includes(response.status),
    `${description}: expected HTTP 401, 403, or 404; ` +
      `received HTTP ${response.status}`
  );
}

function assertAccessDeniedOrMethodRejected(
  response,
  description
) {
  assert.ok(
    [401, 403, 404, 405].includes(response.status),
    `${description}: expected HTTP 401, 403, 404, or 405; ` +
      `received HTTP ${response.status}`
  );
}

function findPrivilegedFields(
  value,
  path = '$',
  found = []
) {
  if (!value || typeof value !== 'object') {
    return found;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      findPrivilegedFields(
        item,
        `${path}[${index}]`,
        found
      );
    });

    return found;
  }

  for (const [key, child] of Object.entries(value)) {
    if (PRIVILEGED_FIELDS.has(normalizeKey(key))) {
      found.push(`${path}.${key}`);
    }

    findPrivilegedFields(
      child,
      `${path}.${key}`,
      found
    );
  }

  return found;
}

function findRoleValues(
  value,
  path = '$',
  found = []
) {
  if (!value || typeof value !== 'object') {
    return found;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      findRoleValues(
        item,
        `${path}[${index}]`,
        found
      );
    });

    return found;
  }

  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizeKey(key);

    if (normalized === 'role' || normalized === 'roles') {
      found.push({
        path: `${path}.${key}`,
        value: child,
      });
    }

    findRoleValues(
      child,
      `${path}.${key}`,
      found
    );
  }

  return found;
}

function assertExpectedLowPrivilegeRole(
  body,
  description
) {
  const roleValues = findRoleValues(body);
  const expected = EXPECTED_ROLE.toLowerCase();

  for (const item of roleValues) {
    if (typeof item.value === 'string') {
      assert.equal(
        item.value.toLowerCase(),
        expected,
        `${description}: unexpected role at ${item.path}`
      );
    } else if (Array.isArray(item.value)) {
      assert.ok(
        item.value.every(
          (role) =>
            typeof role === 'string' &&
            role.toLowerCase() === expected
        ),
        `${description}: unexpected role collection at ${item.path}`
      );
    }
  }
}

/**
 * Extract only authorization-related fields from a response.
 * Dynamic profile fields such as timestamps and last-login dates
 * do not cause false positives.
 */
function securityState(
  value,
  path = '$',
  result = []
) {
  if (!value || typeof value !== 'object') {
    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      securityState(
        item,
        `${path}[${index}]`,
        result
      );
    });

    return result;
  }

  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizeKey(key);

    if (SECURITY_STATE_FIELDS.has(normalized)) {
      result.push({
        path: `${path}.${key}`,
        value: child,
      });
    }

    securityState(
      child,
      `${path}.${key}`,
      result
    );
  }

  return result.sort((a, b) =>
    a.path.localeCompare(b.path)
  );
}

function assertNoPrivilegeChange(
  before,
  after,
  description
) {
  assert.deepEqual(
    securityState(after),
    securityState(before),
    `${description}: authorization-related fields changed.`
  );
}

function unwrapRecord(body, key) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  let current = body;

  if (
    current.data &&
    typeof current.data === 'object'
  ) {
    current = current.data;
  }

  if (
    current[key] &&
    typeof current[key] === 'object'
  ) {
    current = current[key];
  }

  return current;
}

const escalationPayloads = [
  {
    name: 'admin role assignment',
    payload: { role: 'admin' },
  },
  {
    name: 'superadmin role assignment',
    payload: { role: 'superadmin' },
  },
  {
    name: 'administrator boolean assignment',
    payload: { isAdmin: true },
  },
  {
    name: 'superadministrator boolean assignment',
    payload: { isSuperAdmin: true },
  },
  {
    name: 'wildcard permission assignment',
    payload: { permissions: ['*'] },
  },
  {
    name: 'nested role assignment',
    payload: {
      profile: {
        role: 'admin',
        isAdmin: true,
      },
    },
  },
  {
    name: 'privilege collection assignment',
    payload: {
      roles: ['user', 'admin'],
      privileges: [
        'manage_users',
        'manage_payments',
      ],
    },
  },
  {
    name: 'account type assignment',
    payload: {
      accountType: 'administrator',
    },
  },
  {
    name: 'access level assignment',
    payload: {
      accessLevel: 'superadmin',
    },
  },
];

async function readProfile(path = PROFILE_PATH) {
  const response = await request(path);

  assert.ok(
    response.ok,
    `Could not read profile: HTTP ${response.status}`
  );

  const body = await responseBody(response);

  assert.notEqual(
    body,
    null,
    'Expected a non-empty profile response.'
  );

  return body;
}

async function assertProfileRemainsLowPrivilege(
  path = PROFILE_PATH,
  description = 'Profile'
) {
  const body = await readProfile(path);

  assertExpectedLowPrivilegeRole(
    unwrapRecord(body, 'user'),
    description
  );

  return body;
}

test(
  'Privilege escalation security integration suite',
  { skip: !CONFIGURED },
  async (t) => {
    validateBaseUrl();

    assertSafePath(ADMIN_PATH);

    if (PROFILE_PATH) {
      assertSafePath(PROFILE_PATH);
    }

    await t.test(
      'Unauthenticated users cannot access the admin endpoint',
      async () => {
        const response = await request(ADMIN_PATH, {
          token: '',
        });

        assertAuthorizationDenied(
          response,
          'Unauthenticated administrative access'
        );
      }
    );

    await t.test(
      'Low-privilege user cannot access the admin endpoint',
      async () => {
        const response = await request(ADMIN_PATH, {
          token: USER_TOKEN,
        });

        assertAuthorizationDenied(
          response,
          'Low-privilege administrative access'
        );
      }
    );

    await t.test(
      'Client-supplied privilege headers do not grant admin access',
      async () => {
        const response = await request(ADMIN_PATH, {
          extraHeaders: {
            'X-User-Role': 'admin',
            'X-Admin': 'true',
            'X-Authenticated-Role': 'superadmin',
          },
        });

        assertAuthorizationDenied(
          response,
          'Client-supplied privilege headers'
        );
      }
    );

    await t.test(
      'Privilege payload catalogue covers common escalation vectors',
      () => {
        assert.ok(
          escalationPayloads.length >= 5,
          'Expected a useful range of escalation payloads.'
        );

        for (const item of escalationPayloads) {
          assert.ok(
            findPrivilegedFields(item.payload).length > 0,
            `Payload "${item.name}" must include protected fields.`
          );
        }
      }
    );

    await t.test(
      'Low-privilege user can still access their profile',
      { skip: !PROFILE_PATH },
      async () => {
        await assertProfileRemainsLowPrivilege(
          PROFILE_PATH,
          'Profile'
        );
      }
    );

    await t.test(
      'Profile updates cannot grant elevated privileges',
      {
        skip: !PROFILE_PATH || Boolean(mutationSkipReason()),
      },
      async (t) => {
        for (const { name, payload } of escalationPayloads) {
          await t.test(name, async () => {
            const before = await readProfile(PROFILE_PATH);

            const updateResponse = await request(
              PROFILE_PATH,
              {
                method: 'PATCH',
                body: payload,
              }
            );

            assertNotServerError(
              updateResponse,
              `Profile update (${name})`
            );

            // The API may reject the payload or ignore protected fields.
            // A 2xx response alone does not prove a vulnerability.
            // Verify persisted authorization state independently.
            const after = await readProfile(PROFILE_PATH);

            assertNoPrivilegeChange(
              before,
              after,
              `Profile update (${name})`
            );

            assertExpectedLowPrivilegeRole(
              unwrapRecord(after, 'user'),
              `Profile after ${name}`
            );
          });
        }
      }
    );

    await t.test(
      'User-management route cannot elevate the test user',
      {
        skip: !USER_ID || Boolean(mutationSkipReason()),
      },
      async () => {
        const targetPath =
          `/api/users/${encodeURIComponent(USER_ID)}`;

        assertSafePath(targetPath);

        const before = await readProfile(targetPath);

        const response = await request(targetPath, {
          method: 'PATCH',
          body: {
            role: 'admin',
            isAdmin: true,
            isSuperAdmin: true,
            permissions: ['*'],
            accessLevel: 'superadmin',
          },
        });

        assertNotServerError(
          response,
          'User-management privilege assignment'
        );

        const after = await readProfile(targetPath);

        assertNoPrivilegeChange(
          before,
          after,
          'User-management privilege assignment'
        );

        assertExpectedLowPrivilegeRole(
          unwrapRecord(after, 'user'),
          'User after privilege assignment'
        );
      }
    );

    await t.test(
      'Unauthorized admin mutations are denied',
      {
        skip: Boolean(mutationSkipReason()),
      },
      async () => {
        for (const method of [
          'POST',
          'PATCH',
          'PUT',
          'DELETE',
        ]) {
          const response = await request(ADMIN_PATH, {
            token: USER_TOKEN,
            method,
            body: {
              role: 'admin',
              isAdmin: true,
              action: 'grant_admin',
            },
          });

          assertAccessDeniedOrMethodRejected(
            response,
            `Unauthorized ${method} on admin endpoint`
          );
        }
      }
    );

    await t.test(
      'HTTP method variations do not bypass admin authorization',
      async () => {
        // GET is read-only and always tested.
        const getResponse = await request(ADMIN_PATH, {
          method: 'GET',
          token: USER_TOKEN,
        });

        assertAuthorizationDenied(
          getResponse,
          'Admin GET authorization'
        );
      }
    );

    await t.test(
      'Mutating HTTP methods cannot bypass admin authorization',
      {
        skip: Boolean(mutationSkipReason()),
      },
      async () => {
        for (const method of [
          'POST',
          'PUT',
          'PATCH',
          'DELETE',
        ]) {
          const response = await request(ADMIN_PATH, {
            method,
            token: USER_TOKEN,
            body: {
              action: 'grant_admin',
              role: 'admin',
            },
          });

          assertAccessDeniedOrMethodRejected(
            response,
            `Admin authorization using ${method}`
          );
        }
      }
    );

    await t.test(
      'Low-privilege user remains low-privilege after probes',
      { skip: !PROFILE_PATH },
      async () => {
        await assertProfileRemainsLowPrivilege(
          PROFILE_PATH,
          'Profile after privilege escalation probes'
        );
      }
    );

    await t.test(
      'Optional administrator token can access the admin endpoint',
      { skip: !ADMIN_TOKEN },
      async () => {
        const response = await request(ADMIN_PATH, {
          token: ADMIN_TOKEN,
        });

        assert.ok(
          response.status >= 200 &&
            response.status < 300,
          'Configured administrator token should be authorized; ' +
            `received HTTP ${response.status}.`
        );
      }
    );
  }
);

test('Privilege escalation helper invariants', () => {
  assert.ok(
    Number.isFinite(TIMEOUT_MS) &&
      TIMEOUT_MS >= 100 &&
      TIMEOUT_MS <= 120000,
    'Timeout must be between 100 and 120000 milliseconds.'
  );

  assert.ok(
    validPath(ADMIN_PATH),
    'Admin path must begin with one slash.'
  );

  if (PROFILE_PATH) {
    assert.ok(
      validPath(PROFILE_PATH),
      'Profile path must begin with one slash.'
    );
  }

  for (const item of escalationPayloads) {
    assert.ok(
      findPrivilegedFields(item.payload).length > 0,
      `Missing protected field in "${item.name}".`
    );
  }

  assert.ok(
    findPrivilegedFields({
      profile: {
        is_admin: true,
      },
    }).length > 0,
    'Nested alternate privilege fields must be detected.'
  );

  assert.ok(
    securityState({
      user: {
        role: 'user',
        is_admin: false,
        profile: {
          permissions: ['read'],
        },
      },
    }).length >= 3,
    'Authorization state extraction must detect nested protected fields.'
  );

  assert.equal(
    normalizeKey('is_super_admin'),
    'issuperadmin'
  );

  assert.equal(
    normalizeKey('access-level'),
    'accesslevel'
  );

  assert.equal(
    validPath('//example.com/api/admin'),
    false,
    'Protocol-relative paths must be rejected.'
  );

  assert.equal(
    validPath('/api/admin\r\nX-Admin: true'),
    false,
    'Header-injection paths must be rejected.'
  );

  assert.equal(
    validPath('https://example.com/api/admin'),
    false,
    'Absolute URLs must be rejected as request paths.'
  );
});

test('Privilege escalation configuration validation', () => {
  if (!BASE_URL) {
    assert.equal(
      CONFIGURED,
      false,
      'Suite must remain unconfigured when the base URL is absent.'
    );
    return;
  }

  // Validate configuration without sending a network request.
  validateBaseUrl();

  assert.ok(
    Number.isFinite(TIMEOUT_MS) &&
      TIMEOUT_MS >= 100 &&
      TIMEOUT_MS <= 120000,
    'Configured request timeout is out of range.'
  );

  assert.ok(
    EXPECTED_ROLE.length > 0,
    'Expected role must not be empty.'
  );
});
