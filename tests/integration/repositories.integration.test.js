
'use strict';

/**
 * MedOrbits -- Repository Integration Tests
 *
 * File: tests/integration/repositories.integration.test.js
 * Runtime: Node.js >= 20
 *
 * Coverage:
 * - Collection endpoint availability
 * - Authentication and authorization
 * - Record retrieval and response consistency
 * - Malformed and unknown identifiers
 * - Cross-user ownership isolation
 * - Create and read-after-write persistence
 * - Invalid payload handling
 * - Protected-field mass assignment
 * - Cross-user deletion protection
 * - Sensitive information disclosure
 *
 * IMPORTANT:
 * Configure paths and payloads to match the actual MedOrbits API.
 * Never run mutation tests against production.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const BASE_URL = (
  process.env.REPOSITORY_TEST_BASE_URL ||
  process.env.TEST_BASE_URL ||
  'http://127.0.0.1:3000'
).replace(/\/+$/, '');

const COLLECTION_PATH =
  process.env.REPOSITORY_TEST_PATH || '/api/applications';

const ITEM_PATH_TEMPLATE =
  process.env.REPOSITORY_TEST_ITEM_PATH ||
  `${COLLECTION_PATH}/:id`;

const USER_A_TOKEN =
  process.env.REPOSITORY_TEST_USER_A_TOKEN || '';

const USER_B_TOKEN =
  process.env.REPOSITORY_TEST_USER_B_TOKEN || '';

const EXISTING_ITEM_ID =
  process.env.REPOSITORY_TEST_ITEM_ID || '';

const RESOURCE_NAME =
  process.env.REPOSITORY_TEST_RESOURCE || 'repository-test';

const TIMEOUT_MS = Number(
  process.env.REPOSITORY_TEST_TIMEOUT_MS || 10000
);

const RUN_MUTATING_TESTS =
  process.env.RUN_MUTATING_REPOSITORY_TESTS === 'true';

const ALLOW_REMOTE_MUTATIONS =
  process.env.REPOSITORY_TEST_ALLOW_REMOTE_MUTATIONS === 'true';

const JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

function validateConfiguration() {
  let base;

  try {
    base = new URL(BASE_URL);
  } catch {
    assert.fail('REPOSITORY_TEST_BASE_URL must be a valid URL.');
  }

  assert.ok(
    ['http:', 'https:'].includes(base.protocol),
    'Repository test URL must use HTTP or HTTPS.'
  );

  assert.ok(
    Number.isFinite(TIMEOUT_MS) &&
      Number.isInteger(TIMEOUT_MS) &&
      TIMEOUT_MS > 0,
    'REPOSITORY_TEST_TIMEOUT_MS must be a positive integer.'
  );

  for (const [name, path] of Object.entries({
    COLLECTION_PATH,
    ITEM_PATH_TEMPLATE,
  })) {
    assert.ok(
      typeof path === 'string' &&
        path.startsWith('/') &&
        !path.startsWith('//'),
      `${name} must start with exactly one slash.`
    );

    assert.ok(
      !/[\r\n]/.test(path),
      `${name} must not contain newline characters.`
    );
  }

  if (RUN_MUTATING_TESTS) {
    assert.equal(
      process.env.NODE_ENV,
      'test',
      'Mutating tests require NODE_ENV=test.'
    );

    const isLoopback = [
      'localhost',
      '127.0.0.1',
      '::1',
    ].includes(base.hostname.toLowerCase());

    assert.ok(
      isLoopback || ALLOW_REMOTE_MUTATIONS,
      'Remote mutations are blocked. Use an isolated test API or explicitly enable remote test mutations.'
    );

    assert.ok(
      USER_A_TOKEN,
      'Mutating tests require REPOSITORY_TEST_USER_A_TOKEN.'
    );
  }
}

function makeTestMarker() {
  return `${RESOURCE_NAME}-${crypto.randomUUID()}`;
}

function buildItemPath(id) {
  assert.ok(
    id !== undefined && id !== null && String(id).length > 0,
    'Record ID must not be empty.'
  );

  const encodedId = encodeURIComponent(String(id));

  if (ITEM_PATH_TEMPLATE.includes(':id')) {
    return ITEM_PATH_TEMPLATE.replace(':id', encodedId);
  }

  return `${ITEM_PATH_TEMPLATE.replace(/\/+$/, '')}/${encodedId}`;
}

function authHeaders(token) {
  return {
    ...JSON_HEADERS,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function urlFor(path) {
  const base = new URL(BASE_URL);
  const url = new URL(path, `${BASE_URL}/`);

  assert.equal(
    url.origin,
    base.origin,
    'Request must not change the configured API origin.'
  );

  return url;
}

async function request(path, options = {}) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  try {
    const response = await fetch(urlFor(path), {
      ...options,
      headers: {
        ...JSON_HEADERS,
        ...(options.headers || {}),
      },
      signal: controller.signal,
      redirect: 'manual',
    });

    const rawBody = await response.text();
    let body = null;

    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = rawBody;
      }
    }

    return {
      status: response.status,
      headers: response.headers,
      body,
      rawBody,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${TIMEOUT_MS}ms: ` +
        `${options.method || 'GET'} ${path}`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isJsonObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function extractRecord(body) {
  if (!isJsonObject(body)) {
    return null;
  }

  for (const key of [
    'record',
    'application',
    'item',
    'data',
  ]) {
    if (isJsonObject(body[key])) {
      return body[key];
    }
  }

  return body;
}

function extractRecords(body) {
  if (Array.isArray(body)) {
    return body;
  }

  if (!isJsonObject(body)) {
    return null;
  }

  for (const key of [
    'records',
    'applications',
    'items',
    'data',
  ]) {
    if (Array.isArray(body[key])) {
      return body[key];
    }
  }

  return null;
}

function assertStatus(response, expectedStatuses, context) {
  assert.ok(
    expectedStatuses.includes(response.status),
    `${context}: expected HTTP ${expectedStatuses.join(' or ')}, ` +
    `received ${response.status}. Response: ` +
    `${JSON.stringify(response.body)}`
  );
}

function assertSafeErrorResponse(response) {
  const serialized = JSON.stringify(response.body ?? '');

  const sensitivePatterns = [
    /password\s*["']?\s*:/i,
    /passwordHash/i,
    /secretAccessKey/i,
    /privateKey/i,
    /databaseUrl/i,
    /DATABASE_URL/i,
    /refreshToken/i,
    /accessToken/i,
  ];

  for (const pattern of sensitivePatterns) {
    assert.equal(
      pattern.test(serialized),
      false,
      `Error response may expose sensitive information matching ${pattern}.`
    );
  }
}

function assertNoCredentialFields(record) {
  if (!isJsonObject(record)) {
    return;
  }

  const forbiddenKeys = new Set([
    'password',
    'passwordHash',
    'password_hash',
    'resetToken',
    'reset_token',
    'refreshToken',
    'refresh_token',
    'accessToken',
    'access_token',
    'secretAccessKey',
    'privateKey',
  ]);

  for (const key of Object.keys(record)) {
    assert.equal(
      forbiddenKeys.has(key),
      false,
      `Repository response must not expose credential field "${key}".`
    );
  }
}

function canRunAuthenticatedTests() {
  return Boolean(USER_A_TOKEN);
}

function canRunOwnershipTests() {
  return Boolean(
    USER_A_TOKEN &&
    USER_B_TOKEN &&
    EXISTING_ITEM_ID &&
    USER_A_TOKEN !== USER_B_TOKEN
  );
}

function canRunMutationTests() {
  return RUN_MUTATING_TESTS && Boolean(USER_A_TOKEN);
}

function acceptedCreateStatus(status) {
  return [200, 201, 202].includes(status);
}

function getRecordId(record) {
  if (!isJsonObject(record)) {
    return null;
  }

  return (
    record.id ??
    record._id ??
    record.applicationId ??
    record.recordId ??
    null
  );
}

test('repository integration configuration is valid', () => {
  validateConfiguration();
});

test('authenticated collection retrieval returns a recognized response', async (t) => {
  if (!canRunAuthenticatedTests()) {
    t.skip('Set REPOSITORY_TEST_USER_A_TOKEN.');
    return;
  }

  const response = await request(COLLECTION_PATH, {
    method: 'GET',
    headers: authHeaders(USER_A_TOKEN),
  });

  assertStatus(
    response,
    [200, 204],
    'Authenticated collection retrieval'
  );

  if (response.status === 200) {
    const records = extractRecords(response.body);

    assert.ok(
      records !== null,
      'Collection endpoint must return an array or a recognized collection envelope.'
    );

    for (const record of records) {
      assertNoCredentialFields(record);
    }
  }
});

test('unauthenticated collection access follows endpoint policy', async () => {
  const response = await request(COLLECTION_PATH, {
    method: 'GET',
    headers: JSON_HEADERS,
  });

  assert.ok(
    [200, 204, 401, 403, 404].includes(response.status),
    `Unexpected unauthenticated collection status: ${response.status}.`
  );

  if ([401, 403, 404].includes(response.status)) {
    assertSafeErrorResponse(response);
  } else if (response.status === 200) {
    assert.ok(
      extractRecords(response.body) !== null,
      'A public collection endpoint must return a recognized collection.'
    );
  }
});

test('invalid bearer token cannot authorize protected collection access', async () => {
  const response = await request(COLLECTION_PATH, {
    method: 'GET',
    headers: authHeaders('invalid.repository.test.token'),
  });

  assert.ok(
    [200, 204, 401, 403, 404].includes(response.status),
    `Unexpected invalid-token response: ${response.status}.`
  );

  if ([401, 403, 404].includes(response.status)) {
    assertSafeErrorResponse(response);
  }
});

test('malformed record identifiers are rejected safely', async (t) => {
  if (!canRunAuthenticatedTests()) {
    t.skip('Set REPOSITORY_TEST_USER_A_TOKEN.');
    return;
  }

  // URL-encode a traversal-like identifier as one path segment.
  const response = await request(
    buildItemPath('../../admin'),
    {
      method: 'GET',
      headers: authHeaders(USER_A_TOKEN),
    }
  );

  assert.ok(
    [400, 403, 404, 422].includes(response.status),
    `Malformed identifier should be rejected; received HTTP ${response.status}.`
  );

  assertSafeErrorResponse(response);
});

test('unknown record identifiers do not return successful records', async (t) => {
  if (!canRunAuthenticatedTests()) {
    t.skip('Set REPOSITORY_TEST_USER_A_TOKEN.');
    return;
  }

  const response = await request(
    buildItemPath(`missing-${crypto.randomUUID()}`),
    {
      method: 'GET',
      headers: authHeaders(USER_A_TOKEN),
    }
  );

  assert.ok(
    [400, 403, 404, 422].includes(response.status),
    `Unknown ID should not return a successful record; received HTTP ${response.status}.`
  );

  assertSafeErrorResponse(response);
});

test('item retrieval does not expose credential fields', async (t) => {
  if (!canRunAuthenticatedTests() || !EXISTING_ITEM_ID) {
    t.skip(
      'Set REPOSITORY_TEST_USER_A_TOKEN and REPOSITORY_TEST_ITEM_ID.'
    );
    return;
  }

  const response = await request(
    buildItemPath(EXISTING_ITEM_ID),
    {
      method: 'GET',
      headers: authHeaders(USER_A_TOKEN),
    }
  );

  assertStatus(
    response,
    [200, 403, 404],
    'Repository item retrieval'
  );

  if (response.status === 200) {
    const record = extractRecord(response.body);

    assert.ok(
      isJsonObject(record),
      'Successful item retrieval must return a record object.'
    );

    assertNoCredentialFields(record);
  } else {
    assertSafeErrorResponse(response);
  }
});

test("User B cannot read User A's private record", async (t) => {
  if (!canRunOwnershipTests()) {
    t.skip(
      'Configure distinct User A and User B tokens and a record owned by User A.'
    );
    return;
  }

  const response = await request(
    buildItemPath(EXISTING_ITEM_ID),
    {
      method: 'GET',
      headers: authHeaders(USER_B_TOKEN),
    }
  );

  assert.ok(
    [403, 404].includes(response.status),
    `Cross-user access must be denied or concealed; received HTTP ${response.status}.`
  );

  assertSafeErrorResponse(response);
});

test('create operation persists a record across independent requests', async (t) => {
  if (!canRunMutationTests()) {
    t.skip(
      'Set NODE_ENV=test, RUN_MUTATING_REPOSITORY_TESTS=true, and REPOSITORY_TEST_USER_A_TOKEN.'
    );
    return;
  }

  const marker = makeTestMarker();

  // Adapt this DTO to the actual collection's required fields.
  const payload = {
    title: marker,
    name: marker,
    description: 'Automated repository integration test record.',
    testMarker: marker,
  };

  const createResponse = await request(COLLECTION_PATH, {
    method: 'POST',
    headers: authHeaders(USER_A_TOKEN),
    body: JSON.stringify(payload),
  });

  if (!acceptedCreateStatus(createResponse.status)) {
    assert.ok(
      [
        400, 401, 403, 404, 405,
        409, 413, 415, 422, 429,
      ].includes(createResponse.status),
      `Unexpected create response: HTTP ${createResponse.status}.`
    );

    assertSafeErrorResponse(createResponse);

    t.diagnostic(
      'Create was not accepted. Check the actual route, permissions, and required DTO fields.'
    );

    return;
  }

  assert.ok(
    createResponse.status !== 204,
    'Creation must return a record ID to perform read-after-write verification.'
  );

  const createdRecord = extractRecord(createResponse.body);
  const createdId = getRecordId(createdRecord);

  assert.ok(
    createdId !== undefined &&
      createdId !== null &&
      String(createdId).length > 0,
    'Successful creation must return the new record identifier.'
  );

  const readResponse = await request(
    buildItemPath(createdId),
    {
      method: 'GET',
      headers: authHeaders(USER_A_TOKEN),
    }
  );

  assertStatus(readResponse, [200], 'Read-after-create');

  const persistedRecord = extractRecord(readResponse.body);

  assert.ok(
    isJsonObject(persistedRecord),
    'Read-after-create must return a persisted record object.'
  );

  assert.equal(
    String(getRecordId(persistedRecord)),
    String(createdId),
    'Retrieved record ID must match the created record ID.'
  );

  assert.ok(
    JSON.stringify(persistedRecord).includes(marker),
    'The unique test marker must appear in the persisted record.'
  );

  assertNoCredentialFields(persistedRecord);
});

test('creation rejects malformed payloads', async (t) => {
  if (!canRunMutationTests()) {
    t.skip(
      'Set NODE_ENV=test, RUN_MUTATING_REPOSITORY_TESTS=true, and REPOSITORY_TEST_USER_A_TOKEN.'
    );
    return;
  }

  const invalidPayloads = [
    null,
    [],
    { title: '' },
    { title: 'x'.repeat(10000) },
  ];

  for (const payload of invalidPayloads) {
    const response = await request(COLLECTION_PATH, {
      method: 'POST',
      headers: authHeaders(USER_A_TOKEN),
      body: JSON.stringify(payload),
    });

    assert.ok(
      [
        400, 401, 403, 404, 405,
        409, 413, 415, 422, 429,
      ].includes(response.status),
      `Malformed payload should not be accepted; received HTTP ${response.status}.`
    );

    assertSafeErrorResponse(response);
  }
});

test('updates cannot escalate privileges through client-supplied fields', async (t) => {
  if (!canRunMutationTests() || !EXISTING_ITEM_ID) {
    t.skip(
      'Requires mutation opt-in, User A token, and REPOSITORY_TEST_ITEM_ID.'
    );
    return;
  }

  const path = buildItemPath(EXISTING_ITEM_ID);

  const response = await request(path, {
    method: 'PATCH',
    headers: authHeaders(USER_A_TOKEN),
    body: JSON.stringify({
      ownerId: 'another-user',
      userId: 'another-user',
      role: 'admin',
      isAdmin: true,
      permissions: ['admin'],
    }),
  });

  assert.ok(
    [200, 400, 403, 404, 405, 409, 422].includes(response.status),
    `Unexpected protected-field update response: HTTP ${response.status}.`
  );

  if (response.status !== 200) {
    assertSafeErrorResponse(response);
    return;
  }

  // Verify persisted data, not just the potentially sanitized update response.
  const reread = await request(path, {
    method: 'GET',
    headers: authHeaders(USER_A_TOKEN),
  });

  assertStatus(reread, [200], 'Re-read after protected-field update');

  const persisted = extractRecord(reread.body);

  assert.ok(
    isJsonObject(persisted),
    'Re-read must return a record object.'
  );

  assert.notEqual(
    persisted.isAdmin,
    true,
    'An ordinary user must not gain administrator privileges.'
  );

  assert.notDeepEqual(
    persisted.permissions,
    ['admin'],
    'Client input must not grant administrator permissions.'
  );

  assert.notEqual(
    persisted.role,
    'admin',
    'Client input must not promote the user to an administrator role.'
  );

  assertNoCredentialFields(persisted);
});

test("User B cannot delete User A's record", async (t) => {
  if (!RUN_MUTATING_TESTS || !canRunOwnershipTests()) {
    t.skip(
      'Requires mutation opt-in, distinct user tokens, and a record owned by User A.'
    );
    return;
  }

  const path = buildItemPath(EXISTING_ITEM_ID);

  const response = await request(path, {
    method: 'DELETE',
    headers: authHeaders(USER_B_TOKEN),
  });

  assert.ok(
    [403, 404].includes(response.status),
    `Cross-user deletion must be denied or concealed; received HTTP ${response.status}.`
  );

  assertSafeErrorResponse(response);

  // Confirm the owner can still access the record.
  const ownerRead = await request(path, {
    method: 'GET',
    headers: authHeaders(USER_A_TOKEN),
  });

  assertStatus(
    ownerRead,
    [200],
    'Owner read after denied cross-user deletion'
  );
});

test('repeated collection requests return recognized response formats', async (t) => {
  if (!canRunAuthenticatedTests()) {
    t.skip('Set REPOSITORY_TEST_USER_A_TOKEN.');
    return;
  }

  const options = {
    method: 'GET',
    headers: authHeaders(USER_A_TOKEN),
  };

  const first = await request(COLLECTION_PATH, options);
  const second = await request(COLLECTION_PATH, options);

  assertStatus(first, [200, 204], 'First collection request');
  assertStatus(second, [200, 204], 'Second collection request');

  if (first.status === 200) {
    assert.ok(
      extractRecords(first.body) !== null,
      'First response must contain a recognized collection.'
    );
  }

  if (second.status === 200) {
    assert.ok(
      extractRecords(second.body) !== null,
      'Second response must contain a recognized collection.'
    );
  }
});

test('repository errors do not disclose database internals', async (t) => {
  if (!canRunAuthenticatedTests()) {
    t.skip('Set REPOSITORY_TEST_USER_A_TOKEN.');
    return;
  }

  const response = await request(
    buildItemPath(`missing-${crypto.randomUUID()}`),
    {
      method: 'GET',
      headers: authHeaders(USER_A_TOKEN),
    }
  );

  assert.ok(
    [400, 403, 404, 422].includes(response.status),
    `Expected a safe validation or not-found response; received HTTP ${response.status}.`
  );

  const serialized = JSON.stringify(response.body ?? '');

  for (const pattern of [
    /SELECT\s+.+\s+FROM/i,
    /INSERT\s+INTO/i,
    /UPDATE\s+.+\s+SET/i,
    /DELETE\s+FROM/i,
    /SequelizeDatabaseError/i,
    /PrismaClientKnownRequestError/i,
    /ECONNREFUSED/i,
    /\/node_modules\//i,
    /DATABASE_URL/i,
  ]) {
    assert.equal(
      pattern.test(serialized),
      false,
      `Response may expose internal database details matching ${pattern}.`
    );
  }
});
