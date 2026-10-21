'use strict';
/**
 * MedOrbits -- Mass Assignment Security Tests
 *
 * File: tests/security/mass-assignment.security.test.js
 * Runtime: Node.js >= 20
 * Dependencies: Node.js built-in modules only
 *
 * Configuration:
 *   MASS_ASSIGNMENT_TEST_BASE_URL
 *   MASS_ASSIGNMENT_TEST_TOKEN
 *   MASS_ASSIGNMENT_TEST_USER_ID
 *   MASS_ASSIGNMENT_TEST_APPLICATION_ID
 *   MASS_ASSIGNMENT_TEST_PROFILE_PATH
 *   MASS_ASSIGNMENT_TEST_APPLICATION_PATH
 *   MASS_ASSIGNMENT_TEST_TIMEOUT_MS
 *
 * Run:
 *   node --test tests/security/mass-assignment.security.test.js
 *
 * IMPORTANT:
 * - Use a dedicated test environment and a low-privilege test account.
 * - Use records that are safe to modify during security testing.
 * - Never run these tests against production.
 * - Adapt field names to the actual application schema.
 * - Verify persisted state through trusted test helpers where possible.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const BASE_URL = (
  process.env.MASS_ASSIGNMENT_TEST_BASE_URL || ''
).replace(/\/+$/, '');
const TOKEN =
  process.env.MASS_ASSIGNMENT_TEST_TOKEN || '';
const USER_ID =
  process.env.MASS_ASSIGNMENT_TEST_USER_ID || '';
const APPLICATION_ID =
  process.env.MASS_ASSIGNMENT_TEST_APPLICATION_ID || '';
const PROFILE_PATH =
  process.env.MASS_ASSIGNMENT_TEST_PROFILE_PATH ||
  (USER_ID
    ? `/api/users/${encodeURIComponent(USER_ID)}`
    : '');
const APPLICATION_PATH =
  process.env.MASS_ASSIGNMENT_TEST_APPLICATION_PATH ||
  (APPLICATION_ID
    ? `/api/applications/${encodeURIComponent(APPLICATION_ID)}`
    : '');
const TIMEOUT_MS = Number(
  process.env.MASS_ASSIGNMENT_TEST_TIMEOUT_MS || 15000
);
const configured = Boolean(
  BASE_URL &&
  TOKEN &&
  Number.isFinite(TIMEOUT_MS) &&
  TIMEOUT_MS > 0
);
const JSON_HEADERS = Object.freeze({
  Accept: 'application/json',
  'Content-Type': 'application/json',
});
const PROTECTED_FIELDS = Object.freeze([
  'role',
  'roles',
  'isAdmin',
  'isSuperAdmin',
  'admin',
  'permissions',
  'permission',
  'userId',
  'ownerId',
  'createdBy',
  'updatedBy',
  'applicantId',
  'status',
  'approvalStatus',
  'approved',
  'isApproved',
  'verified',
  'isVerified',
  'emailVerified',
  'isActive',
  'accountStatus',
  'subscriptionStatus',
  'subscriptionPlan',
  'subscriptionExpiresAt',
  'creditScore',
  'riskLevel',
  'passwordHash',
  'refreshToken',
  'createdAt',
  'updatedAt',
  'deletedAt',
]);
const PRIVILEGE_PAYLOAD = Object.freeze({
  role: 'admin',
  roles: ['admin', 'superadmin'],
  isAdmin: true,
  isSuperAdmin: true,
  admin: true,
  permissions: ['*'],
  permission: '*',
});
const OWNERSHIP_PAYLOAD = Object.freeze({
  userId: 'attacker-controlled-user',
  ownerId: 'attacker-controlled-owner',
  createdBy: 'attacker-controlled-creator',
  updatedBy: 'attacker-controlled-updater',
  applicantId: 'attacker-controlled-applicant',
});
const WORKFLOW_PAYLOAD = Object.freeze({
  status: 'approved',
  approvalStatus: 'approved',
  approved: true,
  isApproved: true,
  verified: true,
  isVerified: true,
  emailVerified: true,
  isActive: true,
  accountStatus: 'active',
  subscriptionStatus: 'active',
  subscriptionPlan: 'enterprise',
  creditScore: 999,
  riskLevel: 'low',
});
const AUDIT_PAYLOAD = Object.freeze({
  createdAt: '2000-01-01T00:00:00.000Z',
  updatedAt: '2000-01-01T00:00:00.000Z',
  deletedAt: null,
  passwordHash: 'attacker-controlled-hash',
  refreshToken: 'attacker-controlled-token',
});
const FULL_ATTACK_PAYLOAD = Object.freeze({
  displayName: 'Mass assignment security test',
  ...PRIVILEGE_PAYLOAD,
  ...OWNERSHIP_PAYLOAD,
  ...WORKFLOW_PAYLOAD,
  ...AUDIT_PAYLOAD,
});
function normalizeKey(key) {
  return String(key)
    .replace(/[-_\s]/g, '')
    .toLowerCase();
}
const PROTECTED_KEY_SET = new Set(
  PROTECTED_FIELDS.map(normalizeKey)
);
function assertPath(path, label) {
  assert.ok(
    typeof path === 'string' &&
      path.startsWith('/') &&
      !path.startsWith('//'),
    `${label} must be a relative API path beginning with /`
  );
}
async function request(path, options = {}) {
  assertPath(path, 'Request path');
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );
  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...options,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${TOKEN}`,
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}
async function responseBody(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
function assertNoServerError(response, description) {
  assert.ok(
    response.status < 500,
    `${description}: unexpected HTTP ${response.status}`
  );
}
function assertClientError(response, description) {
  assert.ok(
    response.status >= 400 && response.status < 500,
    `${description}: expected 4xx; received HTTP ${response.status}`
  );
}
function collectProtectedFields(value, path = '$', found = []) {
  if (!value || typeof value !== 'object') {
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectProtectedFields(item, `${path}[${index}]`, found);
    });
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    if (PROTECTED_KEY_SET.has(normalizeKey(key))) {
      found.push({
        path: `${path}.${key}`,
        key,
      });
    }
    collectProtectedFields(child, `${path}.${key}`, found);
  }
  return found;
}
function assertNoSensitiveFields(value, description) {
  const found = collectProtectedFields(value);
  assert.deepEqual(
    found,
    [],
    `${description}: response contains protected fields: ` +
      found.map((item) => item.path).join(', ')
  );
}
/**
 * API responses may wrap the record in { data: ... }.
 * Adjust this helper if the actual API uses another envelope.
 */
function unwrapRecord(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return body;
  }
  if (body.data && typeof body.data === 'object') {
    return body.data;
  }
  return body;
}
function readProtectedSnapshot(body) {
  const record = unwrapRecord(body);
  assert.ok(
    record && typeof record === 'object' && !Array.isArray(record),
    'Expected a JSON object representing the requested record'
  );
  const snapshot = {};
  for (const [key, value] of Object.entries(record)) {
    if (PROTECTED_KEY_SET.has(normalizeKey(key))) {
      snapshot[normalizeKey(key)] = value;
    }
  }
  return snapshot;
}
function assertProtectedSnapshotUnchanged(before, after, description) {
  assert.deepEqual(
    readProtectedSnapshot(after),
    readProtectedSnapshot(before),
    `${description}: protected fields changed after the attack`
  );
}
async function getRecord(path, description) {
  const response = await request(path, {
    method: 'GET',
  });
  assert.equal(
    response.status,
    200,
    `${description}: expected HTTP 200, received ${response.status}`
  );
  return responseBody(response);
}
/**
 * A secure API may reject protected fields or silently strip them.
 * Both behaviors are acceptable only if protected persisted state
 * remains unchanged.
 */
async function attackAndVerify({
  path,
  payload,
  description,
}) {
  const before = await getRecord(path, `${description} baseline`);
  const response = await request(path, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  assertNoServerError(response, description);
  if (response.status >= 400) {
    assertClientError(response, description);
  } else {
    assert.ok(
      response.status >= 200 && response.status < 300,
      `${description}: unexpected HTTP ${response.status}`
    );
  }
  const after = await getRecord(path, `${description} verification`);
  assertProtectedSnapshotUnchanged(
    before,
    after,
    description
  );
  return {
    status: response.status,
    before,
    after,
  };
}
test(
  'Mass assignment security integration suite',
  { skip: !configured },
  async (t) => {
    await t.test('Configured API paths are valid', () => {
      if (PROFILE_PATH) {
        assertPath(PROFILE_PATH, 'Profile path');
      }
      if (APPLICATION_PATH) {
        assertPath(APPLICATION_PATH, 'Application path');
      }
      assert.ok(
        PROFILE_PATH || APPLICATION_PATH,
        'Configure at least one test record path'
      );
    });
    await t.test(
      'Profile updates cannot grant administrator privileges',
      { skip: !PROFILE_PATH },
      async () => {
        await attackAndVerify({
          path: PROFILE_PATH,
          payload: PRIVILEGE_PAYLOAD,
          description: 'Profile privilege escalation',
        });
      }
    );
    await t.test(
      'Profile updates cannot reassign ownership',
      { skip: !PROFILE_PATH },
      async () => {
        await attackAndVerify({
          path: PROFILE_PATH,
          payload: OWNERSHIP_PAYLOAD,
          description: 'Profile ownership reassignment',
        });
      }
    );
    await t.test(
      'Application updates cannot manipulate workflow status',
      { skip: !APPLICATION_PATH },
      async () => {
        await attackAndVerify({
          path: APPLICATION_PATH,
          payload: WORKFLOW_PAYLOAD,
          description: 'Application workflow manipulation',
        });
      }
    );
    await t.test(
      'Application updates cannot reassign ownership',
      { skip: !APPLICATION_PATH },
      async () => {
        await attackAndVerify({
          path: APPLICATION_PATH,
          payload: OWNERSHIP_PAYLOAD,
          description: 'Application ownership reassignment',
        });
      }
    );
    await t.test(
      'Profile updates cannot overwrite server-managed audit fields',
      { skip: !PROFILE_PATH },
      async () => {
        await attackAndVerify({
          path: PROFILE_PATH,
          payload: AUDIT_PAYLOAD,
          description: 'Audit-field tampering',
        });
      }
    );
    await t.test(
      'Nested privilege escalation is rejected or safely ignored',
      { skip: !PROFILE_PATH },
      async () => {
        const before = await getRecord(
          PROFILE_PATH,
          'Nested privilege baseline'
        );
        const response = await request(PROFILE_PATH, {
          method: 'PATCH',
          body: JSON.stringify({
            profile: {
              displayName: 'Security test',
              role: 'admin',
              isAdmin: true,
            },
            settings: {
              permissions: ['*'],
            },
          }),
        });
        assertNoServerError(response, 'Nested privilege escalation');
        if (response.status >= 400) {
          assertClientError(response, 'Nested privilege escalation');
        } else {
          assert.ok(
            response.status < 300,
            `Unexpected nested payload response: HTTP ${response.status}`
          );
        }
        const after = await getRecord(
          PROFILE_PATH,
          'Nested privilege verification'
        );
        assertProtectedSnapshotUnchanged(
          before,
          after,
          'Nested privilege escalation'
        );
      }
    );
    await t.test(
      'Combined mass-assignment payload cannot alter protected state',
      {
        skip: !PROFILE_PATH,
      },
      async () => {
        await attackAndVerify({
          path: PROFILE_PATH,
          payload: FULL_ATTACK_PAYLOAD,
          description: 'Combined mass-assignment attack',
        });
      }
    );
  }
);
test('Mass-assignment fixture definitions include protected fields', () => {
  assert.ok(PROTECTED_FIELDS.length > 0);
  for (const payload of [
    PRIVILEGE_PAYLOAD,
    OWNERSHIP_PAYLOAD,
    WORKFLOW_PAYLOAD,
    AUDIT_PAYLOAD,
  ]) {
    assert.ok(Object.keys(payload).length > 0);
  }
  assert.ok(
    collectProtectedFields(FULL_ATTACK_PAYLOAD).length > 0,
    'Combined attack payload should include protected fields'
  );
});