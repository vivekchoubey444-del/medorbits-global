'use strict';
/**
 * MedOrbits -- Privilege Escalation Security Tests
 *
 * File: tests/security/privilege-escalation.security.test.js
 * Runtime: Node.js >= 20
 * Dependencies: Node.js built-in modules only
 *
 * Configuration:
 *   PRIVILEGE_TEST_BASE_URL
 *   PRIVILEGE_TEST_USER_TOKEN
 *   PRIVILEGE_TEST_ADMIN_TOKEN       Optional
 *   PRIVILEGE_TEST_USER_ID           Optional
 *   PRIVILEGE_TEST_PROFILE_PATH      Optional
 *   PRIVILEGE_TEST_ADMIN_PATH        Optional
 *   PRIVILEGE_TEST_TIMEOUT_MS        Optional
 *   PRIVILEGE_TEST_EXPECT_ROLE       Optional; defaults to user
 *
 * Run:
 *   node --test tests/security/privilege-escalation.security.test.js
 *
 * IMPORTANT:
 * - Use a dedicated test environment and test accounts.
 * - USER_TOKEN must belong to a low-privilege user.
 * - Never use production administrator credentials.
 * - Configure paths to match the actual MedOrbits API.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const BASE_URL = (
  process.env.PRIVILEGE_TEST_BASE_URL || ''
).replace(/\/+$/, '');
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
const EXPECTED_ROLE =
  process.env.PRIVILEGE_TEST_EXPECT_ROLE || 'user';
const configured = Boolean(
  BASE_URL &&
  USER_TOKEN &&
  Number.isFinite(TIMEOUT_MS) &&
  TIMEOUT_MS > 0
);
function validPath(path) {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !/[\r\n]/.test(path)
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
    'Do not put credentials in the base URL.'
  );
  const localHosts = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    '[::1]',
  ]);
  assert.ok(
    localHosts.has(url.hostname) ||
      process.env.PRIVILEGE_TEST_ALLOW_REMOTE === 'true',
    'Remote targets require PRIVILEGE_TEST_ALLOW_REMOTE=true.'
  );
}
function headers(token, extra = {}, hasBody = false) {
  return {
    Accept: 'application/json',
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}
async function request(path, {
  token = USER_TOKEN,
  method = 'GET',
  body,
  extraHeaders = {},
} = {}) {
  assert.ok(validPath(path), `Invalid API path: ${path}`);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );
  try {
    return await fetch(`${BASE_URL}${path}`, {
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
  } finally {
    clearTimeout(timeout);
  }
}
async function responseBody(response) {
  const raw = await response.text();
  if (!raw) return null;
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
function normalizeKey(key) {
  return String(key)
    .replace(/[-_\s]/g, '')
    .toLowerCase();
}
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
function findPrivilegedFields(value, path = '$', found = []) {
  if (!value || typeof value !== 'object') {
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      findPrivilegedFields(item, `${path}[${index}]`, found);
    });
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    if (PRIVILEGED_FIELDS.has(normalizeKey(key))) {
      found.push(`${path}.${key}`);
    }
    findPrivilegedFields(child, `${path}.${key}`, found);
  }
  return found;
}
function findRoleValues(value, path = '$', found = []) {
  if (!value || typeof value !== 'object') {
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      findRoleValues(item, `${path}[${index}]`, found);
    });
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    if (['role', 'roles'].includes(normalizeKey(key))) {
      found.push({ path: `${path}.${key}`, value: child });
    }
    findRoleValues(child, `${path}.${key}`, found);
  }
  return found;
}
function assertExpectedLowPrivilegeRole(body, description) {
  const roleValues = findRoleValues(body);
  for (const item of roleValues) {
    if (typeof item.value === 'string') {
      assert.equal(
        item.value.toLowerCase(),
        EXPECTED_ROLE.toLowerCase(),
        `${description}: unexpected role at ${item.path}`
      );
    } else if (Array.isArray(item.value)) {
      assert.ok(
        item.value.every(
          (role) =>
            typeof role === 'string' &&
            role.toLowerCase() === EXPECTED_ROLE.toLowerCase()
        ),
        `${description}: unexpected role collection at ${item.path}`
      );
    }
  }
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
      privileges: ['manage_users', 'manage_payments'],
    },
  },
  {
    name: 'account type assignment',
    payload: { accountType: 'administrator' },
  },
  {
    name: 'access level assignment',
    payload: { accessLevel: 'superadmin' },
  },
];
test(
  'Privilege escalation security integration suite',
  { skip: !configured },
  async (t) => {
    validateBaseUrl();
    assert.ok(validPath(ADMIN_PATH), 'Invalid admin path');
    if (PROFILE_PATH) {
      assert.ok(validPath(PROFILE_PATH), 'Invalid profile path');
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
      'Low-privilege user cannot mutate the admin endpoint',
      async () => {
        for (const method of ['POST', 'PATCH', 'DELETE']) {
          const response = await request(ADMIN_PATH, {
            token: USER_TOKEN,
            method,
            body: {
              role: 'admin',
              isAdmin: true,
            },
          });
          assertAuthorizationDenied(
            response,
            `Unauthorized ${method} on admin endpoint`
          );
        }
      }
    );
    await t.test(
      'Privilege assignment payloads are covered by the test suite',
      () => {
        assert.ok(escalationPayloads.length >= 5);
        for (const item of escalationPayloads) {
          assert.ok(
            findPrivilegedFields(item.payload).length > 0,
            `Payload "${item.name}" must include protected fields`
          );
        }
      }
    );
    await t.test(
      'Profile updates cannot grant elevated privileges',
      { skip: !PROFILE_PATH },
      async (t) => {
        for (const { name, payload } of escalationPayloads) {
          await t.test(name, async () => {
            const beforeResponse = await request(PROFILE_PATH);
            assert.ok(
              beforeResponse.ok,
              `Could not read baseline profile: HTTP ${beforeResponse.status}`
            );
            const before = await responseBody(beforeResponse);
            const updateResponse = await request(PROFILE_PATH, {
              method: 'PATCH',
              body: payload,
            });
            assertNotServerError(
              updateResponse,
              `Profile update (${name})`
            );
            // The update may be rejected, or the server may safely ignore
            // protected fields. In either case, privileges must not change.
            if (updateResponse.ok) {
              const updateBody = await responseBody(updateResponse);
              const updateRoles = findRoleValues(updateBody);
              for (const item of updateRoles) {
                if (typeof item.value === 'string') {
                  assert.notEqual(
                    item.value.toLowerCase(),
                    'admin',
                    `Update response granted admin through ${item.path}`
                  );
                  assert.notEqual(
                    item.value.toLowerCase(),
                    'superadmin',
                    `Update response granted superadmin through ${item.path}`
                  );
                }
              }
            }
            const afterResponse = await request(PROFILE_PATH);
            assert.ok(
              afterResponse.ok,
              `Could not read profile after attempt: HTTP ${afterResponse.status}`
            );
            const after = await responseBody(afterResponse);
            assert.deepEqual(
              after,
              before,
              `Profile changed after attempted ${name}. ` +
                'If legitimate profile fields change dynamically, compare ' +
                'only the stable security-relevant fields instead.'
            );
          });
        }
      }
    );
    await t.test(
      'User-management route rejects unauthorized role assignment',
      { skip: !USER_ID },
      async () => {
        const targetPath =
          `/api/users/${encodeURIComponent(USER_ID)}`;
        const response = await request(targetPath, {
          method: 'PATCH',
          body: {
            role: 'admin',
            isAdmin: true,
            permissions: ['*'],
          },
        });
        assertNotServerError(
          response,
          'Unauthorized user-management role assignment'
        );
        // A 2xx response may mean protected fields were safely ignored.
        // The profile invariant test above must still confirm no escalation.
        if (response.status >= 200 && response.status < 300) {
          const verify = await request(targetPath);
          assert.ok(
            verify.ok,
            `Could not verify target user: HTTP ${verify.status}`
          );
          const user = await responseBody(verify);
          assertExpectedLowPrivilegeRole(
            user,
            'Target user after attempted escalation'
          );
        }
      }
    );
    await t.test(
      'Client-supplied role headers do not grant administrative access',
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
      'HTTP method variations do not bypass admin authorization',
      async () => {
        for (const method of [
          'GET',
          'POST',
          'PUT',
          'PATCH',
          'DELETE',
        ]) {
          const response = await request(ADMIN_PATH, {
            method,
            body: {
              action: 'grant_admin',
              role: 'admin',
            },
          });
          assertAuthorizationDenied(
            response,
            `Admin authorization using ${method}`
          );
        }
      }
    );
    await t.test(
      'Low-privilege user remains authenticated after attack attempts',
      { skip: !PROFILE_PATH },
      async () => {
        const response = await request(PROFILE_PATH);
        assert.ok(
          response.ok,
          `Profile became inaccessible: HTTP ${response.status}`
        );
        const body = await responseBody(response);
        assert.notEqual(
          body,
          null,
          'Expected a non-empty profile response'
        );
        assertExpectedLowPrivilegeRole(
          body,
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
          response.status >= 200 && response.status < 300,
          `Configured admin token should be authorized; HTTP ${response.status}`
        );
      }
    );
  }
);
test('Privilege escalation helper invariants', () => {
  assert.ok(
    Number.isFinite(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'Timeout must be positive'
  );
  assert.ok(
    validPath(ADMIN_PATH),
    'Admin path must begin with one slash'
  );
  for (const item of escalationPayloads) {
    assert.ok(
      findPrivilegedFields(item.payload).length > 0,
      `Missing protected field in "${item.name}"`
    );
  }
  assert.ok(
    findPrivilegedFields({
      profile: { is_admin: true },
    }).length > 0,
    'Nested alternate privilege fields must be detected'
  );
});