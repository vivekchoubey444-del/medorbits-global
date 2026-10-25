
'use strict';

/**
 * MedOrbits -- Mass Assignment Security Tests
 *
 * File: tests/security/mass-assignment.security.test.js
 * Runtime: Node.js >= 20
 * Dependencies: Node.js built-in modules only
 *
 * Run:
 *   node --test tests/security/mass-assignment.security.test.js
 *
 * Configuration:
 *   MASS_ASSIGNMENT_TEST_BASE_URL=http://127.0.0.1:3000
 *   MASS_ASSIGNMENT_TEST_TOKEN
 *   MASS_ASSIGNMENT_TEST_USER_ID
 *   MASS_ASSIGNMENT_TEST_APPLICATION_ID
 *   MASS_ASSIGNMENT_TEST_PROFILE_PATH
 *   MASS_ASSIGNMENT_TEST_APPLICATION_PATH
 *   MASS_ASSIGNMENT_TEST_TIMEOUT_MS=15000
 *
 * Optional:
 *   MASS_ASSIGNMENT_TEST_RUN_MUTATIONS=true
 *   MASS_ASSIGNMENT_TEST_ALLOW_REMOTE_MUTATIONS=true
 *   MASS_ASSIGNMENT_TEST_ENVIRONMENT=sandbox
 *   MASS_ASSIGNMENT_TEST_ALLOW_CI_MUTATIONS=true
 *
 * IMPORTANT:
 * - Use a dedicated, isolated test environment.
 * - Use a low-privilege synthetic account and disposable records.
 * - PATCH tests are disabled unless explicitly enabled.
 * - Never run mutation tests against production.
 * - Adapt field names and response envelopes to the actual API schema.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const DEFAULT_TIMEOUT_MS = 15_000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 120_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

const BASE_URL_RAW =
  process.env.MASS_ASSIGNMENT_TEST_BASE_URL || '';

const TOKEN =
  process.env.MASS_ASSIGNMENT_TEST_TOKEN || '';

const USER_ID =
  process.env.MASS_ASSIGNMENT_TEST_USER_ID || '';

const APPLICATION_ID =
  process.env.MASS_ASSIGNMENT_TEST_APPLICATION_ID || '';

const PROFILE_PATH_CONFIG =
  process.env.MASS_ASSIGNMENT_TEST_PROFILE_PATH || '';

const APPLICATION_PATH_CONFIG =
  process.env.MASS_ASSIGNMENT_TEST_APPLICATION_PATH || '';

const RUN_MUTATIONS =
  process.env.MASS_ASSIGNMENT_TEST_RUN_MUTATIONS === 'true';

let baseUrl = null;
let timeoutMs = DEFAULT_TIMEOUT_MS;
let profilePath = '';
let applicationPath = '';
let configurationError = null;
let serverAvailable = false;

/* -------------------------------------------------------------------------- */
/* Protected fields and attack payloads                                       */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

function parseTimeout(value) {
  if (value === undefined || value === '') {
    return DEFAULT_TIMEOUT_MS;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < MIN_TIMEOUT_MS ||
    parsed > MAX_TIMEOUT_MS
  ) {
    throw new Error(
      `MASS_ASSIGNMENT_TEST_TIMEOUT_MS must be an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}.`
    );
  }

  return parsed;
}

function validatePath(path, label) {
  assert.ok(
    typeof path === 'string' &&
      path.startsWith('/') &&
      !path.startsWith('//'),
    `${label} must begin with exactly one slash.`
  );

  assert.ok(
    !path.includes('?') && !path.includes('#'),
    `${label} must not contain a query string or fragment.`
  );

  const parsed = new URL(path, baseUrl);

  assert.equal(
    parsed.origin,
    baseUrl.origin,
    `${label} must remain on the configured API origin.`
  );

  assert.ok(
    !parsed.pathname.split('/').includes('..'),
    `${label} must not contain parent-directory path segments.`
  );

  return parsed.pathname;
}

function validateConfiguration() {
  assert.ok(
    BASE_URL_RAW,
    'Set MASS_ASSIGNMENT_TEST_BASE_URL before running these tests.'
  );

  assert.ok(
    TOKEN.trim(),
    'Set MASS_ASSIGNMENT_TEST_TOKEN to a synthetic low-privilege account token.'
  );

  let parsed;

  try {
    parsed = new URL(BASE_URL_RAW);
  } catch {
    throw new Error(
      'MASS_ASSIGNMENT_TEST_BASE_URL must be a valid absolute URL.'
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(parsed.protocol),
    'The base URL must use HTTP or HTTPS.'
  );

  assert.ok(
    !parsed.username && !parsed.password,
    'The base URL must not contain embedded credentials.'
  );

  assert.ok(
    !parsed.search && !parsed.hash,
    'The base URL must not contain a query string or fragment.'
  );

  assert.equal(
    parsed.pathname,
    '/',
    'Configure the base URL as an origin without an API path prefix.'
  );

  baseUrl = new URL(parsed.origin);

  timeoutMs = parseTimeout(
    process.env.MASS_ASSIGNMENT_TEST_TIMEOUT_MS
  );

  profilePath = PROFILE_PATH_CONFIG
    ? validatePath(
        PROFILE_PATH_CONFIG,
        'MASS_ASSIGNMENT_TEST_PROFILE_PATH'
      )
    : USER_ID
      ? validatePath(
          `/api/users/${encodeURIComponent(USER_ID)}`,
          'Derived profile path'
        )
      : '';

  applicationPath = APPLICATION_PATH_CONFIG
    ? validatePath(
        APPLICATION_PATH_CONFIG,
        'MASS_ASSIGNMENT_TEST_APPLICATION_PATH'
      )
    : APPLICATION_ID
      ? validatePath(
          `/api/applications/${encodeURIComponent(APPLICATION_ID)}`,
          'Derived application path'
        )
      : '';

  assert.ok(
    profilePath || applicationPath,
    'Configure at least one profile or application record path.'
  );
}

/* -------------------------------------------------------------------------- */
/* HTTP helpers                                                               */
/* -------------------------------------------------------------------------- */

function urlFor(path) {
  assert.ok(
    typeof path === 'string' &&
      path.startsWith('/') &&
      !path.startsWith('//'),
    'Request paths must begin with exactly one slash.'
  );

  const url = new URL(path, baseUrl);

  assert.equal(
    url.origin,
    baseUrl.origin,
    'Cross-origin requests are not allowed.'
  );

  return url;
}

async function request(path, options = {}) {
  const url = urlFor(path);
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    return await fetch(url, {
      ...options,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${TOKEN}`,
        ...(options.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${timeoutMs} ms: ${options.method || 'GET'} ${url.pathname}`
      );
    }

    throw new Error(
      `Request failed for ${options.method || 'GET'} ${url.pathname}: ${error.message}`
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function responseBody(response) {
  const contentLength = response.headers.get('content-length');

  if (
    contentLength &&
    Number(contentLength) > MAX_RESPONSE_BYTES
  ) {
    await response.body?.cancel().catch(() => {});

    throw new Error(
      `Response exceeded the ${MAX_RESPONSE_BYTES}-byte safety limit.`
    );
  }

  const text = await response.text();

  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new Error(
      `Response exceeded the ${MAX_RESPONSE_BYTES}-byte safety limit.`
    );
  }

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/* -------------------------------------------------------------------------- */
/* Security assertions                                                        */
/* -------------------------------------------------------------------------- */

function assertNoServerError(response, description) {
  assert.ok(
    response.status < 500,
    `${description}: unexpected HTTP ${response.status}.`
  );
}

function assertClientError(response, description) {
  assert.ok(
    response.status >= 400 && response.status < 500,
    `${description}: expected HTTP 4xx; received HTTP ${response.status}.`
  );
}

function collectProtectedFields(value, path = '$', found = []) {
  if (value === null || typeof value !== 'object') {
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
    `${description}: response contains protected fields: ${
      found.map((item) => item.path).join(', ')
    }`
  );
}

/**
 * Extract a record from common response envelopes.
 *
 * Adapt this helper if the API uses a different documented envelope.
 * Avoid recursively selecting arbitrary nested objects: that can silently
 * select a metadata object instead of the requested record.
 */
function unwrapRecord(body) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return body;
  }

  let record = body;

  if (
    record.data &&
    typeof record.data === 'object' &&
    !Array.isArray(record.data)
  ) {
    record = record.data;
  }

  if (
    record.user &&
    typeof record.user === 'object' &&
    !Array.isArray(record.user)
  ) {
    record = record.user;
  } else if (
    record.application &&
    typeof record.application === 'object' &&
    !Array.isArray(record.application)
  ) {
    record = record.application;
  }

  return record;
}

function readProtectedSnapshot(body) {
  const record = unwrapRecord(body);

  assert.ok(
    record &&
      typeof record === 'object' &&
      !Array.isArray(record),
    'Expected a JSON object representing the requested record.'
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
    `${description}: protected fields changed after the attack.`
  );
}

async function getRecord(path, description) {
  const response = await request(path, {
    method: 'GET',
  });

  assert.equal(
    response.status,
    200,
    `${description}: expected HTTP 200; received HTTP ${response.status}.`
  );

  const body = await responseBody(response);

  assert.ok(
    body &&
      typeof body === 'object' &&
      !Array.isArray(body),
    `${description}: expected a JSON record object.`
  );

  return body;
}

/* -------------------------------------------------------------------------- */
/* Mutation safeguards                                                        */
/* -------------------------------------------------------------------------- */

function mutationSkipReason() {
  if (!RUN_MUTATIONS) {
    return (
      'Mutation tests are disabled. Set ' +
      'MASS_ASSIGNMENT_TEST_RUN_MUTATIONS=true to enable them.'
    );
  }

  if (process.env.NODE_ENV !== 'test') {
    return 'Mutation tests require NODE_ENV=test.';
  }

  if (
    process.env.CI &&
    process.env.MASS_ASSIGNMENT_TEST_ALLOW_CI_MUTATIONS !== 'true'
  ) {
    return (
      'CI mutation tests require ' +
      'MASS_ASSIGNMENT_TEST_ALLOW_CI_MUTATIONS=true.'
    );
  }

  if (
    baseUrl &&
    !['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)
  ) {
    if (
      process.env.MASS_ASSIGNMENT_TEST_ALLOW_REMOTE_MUTATIONS !== 'true'
    ) {
      return (
        'Remote mutations require ' +
        'MASS_ASSIGNMENT_TEST_ALLOW_REMOTE_MUTATIONS=true.'
      );
    }

    if (
      process.env.MASS_ASSIGNMENT_TEST_ENVIRONMENT !== 'sandbox'
    ) {
      return (
        'Remote mutations require ' +
        'MASS_ASSIGNMENT_TEST_ENVIRONMENT=sandbox.'
      );
    }

    if (baseUrl.protocol !== 'https:') {
      return 'Remote mutation tests require HTTPS.';
    }
  }

  return '';
}

/* -------------------------------------------------------------------------- */
/* Attack and verification                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A secure API may reject protected fields or ignore them.
 * Either behavior is acceptable only when the protected persisted state
 * remains unchanged.
 *
 * This check relies on the API's GET response exposing the protected fields.
 * If the API intentionally omits those fields, use a trusted test-only
 * database assertion instead of interpreting an empty snapshot as proof.
 */
async function attackAndVerify({
  path,
  payload,
  description,
}) {
  const before = await getRecord(
    path,
    `${description} baseline`
  );

  const beforeSnapshot = readProtectedSnapshot(before);

  assert.ok(
    Object.keys(beforeSnapshot).length > 0,
    `${description}: baseline response exposed no protected fields. ` +
      'Configure a trusted test-only state verifier or adapt the record schema.'
  );

  const response = await request(path, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

  const attackBody = await responseBody(response);

  assertNoServerError(response, description);

  if (response.status >= 400) {
    assertClientError(response, description);
  } else {
    assert.ok(
      response.status >= 200 && response.status < 300,
      `${description}: unexpected HTTP ${response.status}.`
    );
  }

  // Detect accidental disclosure in the mutation response. Some APIs
  // intentionally return protected fields; adapt this assertion if that
  // is part of the documented response contract.
  if (attackBody && typeof attackBody === 'object') {
    assertNoSensitiveFields(
      attackBody,
      `${description} response`
    );
  }

  const after = await getRecord(
    path,
    `${description} verification`
  );

  assertProtectedSnapshotUnchanged(
    before,
    after,
    description
  );

  return {
    status: response.status,
    beforeSnapshot,
    afterSnapshot: readProtectedSnapshot(after),
  };
}

/* -------------------------------------------------------------------------- */
/* Setup                                                                      */
/* -------------------------------------------------------------------------- */

test.before(async () => {
  try {
    validateConfiguration();
  } catch (error) {
    configurationError = error;
    return;
  }

  try {
    const response = await request('/');

    serverAvailable = response.status < 500;

    await response.body?.cancel().catch(() => {});
  } catch {
    serverAvailable = false;
  }
});

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

function defineConfiguredTest(name, options, callback) {
  test(name, async (t) => {
    if (configurationError) {
      throw configurationError;
    }

    if (!serverAvailable) {
      t.skip(
        `Test API is unavailable at ${BASE_URL_RAW}.`
      );
      return;
    }

    if (options?.mutating) {
      const reason = mutationSkipReason();

      if (reason) {
        t.skip(reason);
        return;
      }
    }

    await callback(t);
  });
}

defineConfiguredTest(
  'mass-assignment suite has valid paths and attack fixtures',
  {},
  async () => {
    if (profilePath) {
      validatePath(profilePath, 'Profile path');
    }

    if (applicationPath) {
      validatePath(applicationPath, 'Application path');
    }

    assert.ok(
      profilePath || applicationPath,
      'At least one profile or application path is required.'
    );

    assert.ok(
      Object.keys(PRIVILEGE_PAYLOAD).length > 0,
      'Privilege attack payload must not be empty.'
    );

    assert.ok(
      Object.keys(OWNERSHIP_PAYLOAD).length > 0,
      'Ownership attack payload must not be empty.'
    );
  }
);

defineConfiguredTest(
  'profile updates cannot grant administrator privileges',
  { mutating: true },
  async () => {
    if (!profilePath) {
      return;
    }

    await attackAndVerify({
      path: profilePath,
      payload: PRIVILEGE_PAYLOAD,
      description: 'Profile privilege escalation',
    });
  }
);

defineConfiguredTest(
  'profile updates cannot reassign ownership',
  { mutating: true },
  async () => {
    if (!profilePath) {
      return;
    }

    await attackAndVerify({
      path: profilePath,
      payload: OWNERSHIP_PAYLOAD,
      description: 'Profile ownership reassignment',
    });
  }
);

defineConfiguredTest(
  'application updates cannot manipulate workflow status',
  { mutating: true },
  async () => {
    if (!applicationPath) {
      return;
    }

    await attackAndVerify({
      path: applicationPath,
      payload: WORKFLOW_PAYLOAD,
      description: 'Application workflow manipulation',
    });
  }
);

defineConfiguredTest(
  'application updates cannot reassign ownership',
  { mutating: true },
  async () => {
    if (!applicationPath) {
      return;
    }

    await attackAndVerify({
      path: applicationPath,
      payload: OWNERSHIP_PAYLOAD,
      description: 'Application ownership reassignment',
    });
  }
);

defineConfiguredTest(
  'profile updates cannot overwrite server-managed audit fields',
  { mutating: true },
  async () => {
    if (!profilePath) {
      return;
    }

    await attackAndVerify({
      path: profilePath,
      payload: AUDIT_PAYLOAD,
      description: 'Audit-field tampering',
    });
  }
);

defineConfiguredTest(
  'nested privilege escalation cannot alter protected profile state',
  { mutating: true },
  async () => {
    if (!profilePath) {
      return;
    }

    const before = await getRecord(
      profilePath,
      'Nested privilege baseline'
    );

    const beforeSnapshot = readProtectedSnapshot(before);

    assert.ok(
      Object.keys(beforeSnapshot).length > 0,
      'Nested privilege test requires visible protected fields or a trusted state verifier.'
    );

    const response = await request(profilePath, {
      method: 'PATCH',
      body: JSON.stringify({
        profile: {
          displayName: 'Mass assignment security test',
          role: 'admin',
          isAdmin: true,
        },
        settings: {
          permissions: ['*'],
        },
      }),
    });

    const attackBody = await responseBody(response);

    assertNoServerError(
      response,
      'Nested privilege escalation'
    );

    if (response.status >= 400) {
      assertClientError(
        response,
        'Nested privilege escalation'
      );
    } else {
      assert.ok(
        response.status >= 200 && response.status < 300,
        `Unexpected nested payload response: HTTP ${response.status}.`
      );
    }

    if (attackBody && typeof attackBody === 'object') {
      assertNoSensitiveFields(
        attackBody,
        'Nested privilege escalation response'
      );
    }

    const after = await getRecord(
      profilePath,
      'Nested privilege verification'
    );

    assertProtectedSnapshotUnchanged(
      before,
      after,
      'Nested privilege escalation'
    );
  }
);

defineConfiguredTest(
  'combined mass-assignment payload cannot alter protected profile state',
  { mutating: true },
  async () => {
    if (!profilePath) {
      return;
    }

    await attackAndVerify({
      path: profilePath,
      payload: FULL_ATTACK_PAYLOAD,
      description: 'Combined profile mass-assignment attack',
    });
  }
);

defineConfiguredTest(
  'combined mass-assignment payload cannot alter protected application state',
  { mutating: true },
  async () => {
    if (!applicationPath) {
      return;
    }

    await attackAndVerify({
      path: applicationPath,
      payload: FULL_ATTACK_PAYLOAD,
      description: 'Combined application mass-assignment attack',
    });
  }
);

/* -------------------------------------------------------------------------- */
/* Fixture integrity                                                          */
/* -------------------------------------------------------------------------- */

test('mass-assignment attack payloads cover protected field categories', () => {
  assert.ok(PROTECTED_FIELDS.length > 0);

  for (const payload of [
    PRIVILEGE_PAYLOAD,
    OWNERSHIP_PAYLOAD,
    WORKFLOW_PAYLOAD,
    AUDIT_PAYLOAD,
  ]) {
    assert.ok(
      Object.keys(payload).length > 0,
      'Each attack payload must contain at least one field.'
    );
  }

  assert.ok(
    collectProtectedFields(FULL_ATTACK_PAYLOAD).length > 0,
    'The combined payload must contain protected fields.'
  );
});
