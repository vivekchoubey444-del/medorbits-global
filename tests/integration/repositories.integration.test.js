
'use strict';

/**
 * MedOrbits -- Repository Integration Tests
 *
 * File: tests/integration/repositories.integration.test.js
 * Runtime: Node.js >= 20
 * Runner: node:test
 *
 * Coverage:
 * - Configuration and same-origin request validation
 * - Collection availability and response consistency
 * - Authentication and authorization behavior
 * - Malformed and unknown identifiers
 * - Cross-user record isolation
 * - Create and read-after-write persistence
 * - Invalid payload rejection
 * - Protected-field mass assignment
 * - Cross-user deletion protection
 * - Recursive credential-field disclosure checks
 * - Database and stack-trace disclosure checks
 *
 * SAFETY:
 * - Mutation tests are disabled by default.
 * - Mutations require NODE_ENV=test and explicit opt-in.
 * - Remote mutations require additional explicit opt-in.
 * - CI mutations require a separate explicit opt-in.
 * - Use a dedicated, isolated test database and disposable fixtures.
 *
 * Adapt paths, DTOs, authorization expectations, and response envelopes
 * to the actual MedOrbits API contract.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const RAW_BASE_URL =
  process.env.REPOSITORY_TEST_BASE_URL ||
  process.env.TEST_BASE_URL ||
  'http://127.0.0.1:3000';

const COLLECTION_PATH =
  process.env.REPOSITORY_TEST_PATH ||
  '/api/applications';

const ITEM_PATH_TEMPLATE =
  process.env.REPOSITORY_TEST_ITEM_PATH ||
  `${COLLECTION_PATH.replace(/\/+$/, '')}/:id`;

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

const ALLOW_CI_MUTATIONS =
  process.env.REPOSITORY_TEST_CI_MUTATIONS === 'true';

const JSON_HEADERS = Object.freeze({
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

const AUTH_FAILURE_STATUSES = [401, 403, 404];
const NOT_FOUND_STATUSES = [400, 403, 404, 422];

const SENSITIVE_KEY_NAMES = new Set([
  'password',
  'passwordhash',
  'hashedpassword',
  'passwd',
  'passphrase',
  'secret',
  'clientsecret',
  'clientsecretkey',
  'secretaccesskey',
  'privatekey',
  'privatekeypem',
  'refreshtoken',
  'accesstoken',
  'idtoken',
  'resettoken',
  'passwordresettoken',
  'verificationtoken',
  'emailverificationtoken',
  'authorization',
  'authorizationheader',
  'webhooksecret',
  'webhooksigningsecret',
  'apikey',
  'databaseurl',
  'connectionstring',
]);

const DATABASE_DISCLOSURE_PATTERNS = [
  /\bSELECT\b[\s\S]{0,300}\bFROM\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\b[\s\S]{0,300}\bSET\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bSequelizeDatabaseError\b/i,
  /\bPrismaClientKnownRequestError\b/i,
  /\bPrismaClientInitializationError\b/i,
  /\bMongoServerError\b/i,
  /\bMongoServerSelectionError\b/i,
  /\bSQLSTATE\b/i,
  /\bECONNREFUSED\b/i,
  /\bETIMEDOUT\b/i,
  /\bDATABASE_URL\b/i,
  /\/node_modules\//i,
  /\bat\s+\S+\s+\([^)]*:\d+:\d+\)/i,
];

let parsedBaseUrl;

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isJsonObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function isLoopbackHostname(hostname) {
  const normalized = String(hostname).toLowerCase();

  return [
    'localhost',
    '127.0.0.1',
    '::1',
    '[::1]',
  ].includes(normalized);
}

function validatePath(path, name) {
  assert.equal(
    typeof path,
    'string',
    `${name} must be a string.`
  );

  assert.ok(
    path.startsWith('/') && !path.startsWith('//'),
    `${name} must start with exactly one slash.`
  );

  assert.ok(
    !/[\\\r\n\t\0]/.test(path),
    `${name} must not contain backslashes, control characters, or tabs.`
  );

  assert.ok(
    !/[#]/.test(path),
    `${name} must not contain a URL fragment.`
  );

  assert.ok(
    !/%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(path),
    `${name} must not contain URL-encoded control characters.`
  );

  const template = path.replace(/:id\b/g, 'test-record-id');

  let resolved;

  try {
    resolved = new URL(template, parsedBaseUrl);
  } catch {
    assert.fail(`${name} is not a valid URL path.`);
  }

  assert.equal(
    resolved.origin,
    parsedBaseUrl.origin,
    `${name} must resolve to the configured API origin.`
  );
}

function validateConfiguration() {
  try {
    parsedBaseUrl = new URL(RAW_BASE_URL);
  } catch {
    assert.fail(
      'REPOSITORY_TEST_BASE_URL must be a valid absolute URL.'
    );
  }

  assert.ok(
    ['http:', 'https:'].includes(parsedBaseUrl.protocol),
    'The repository test API must use HTTP or HTTPS.'
  );

  assert.equal(
    parsedBaseUrl.username,
    '',
    'Do not put URL credentials in the test base URL.'
  );

  assert.equal(
    parsedBaseUrl.password,
    '',
    'Do not put URL credentials in the test base URL.'
  );

  assert.equal(
    parsedBaseUrl.search,
    '',
    'The test base URL must not contain a query string.'
  );

  assert.equal(
    parsedBaseUrl.hash,
    '',
    'The test base URL must not contain a fragment.'
  );

  assert.ok(
    Number.isSafeInteger(TIMEOUT_MS) && TIMEOUT_MS > 0,
    'REPOSITORY_TEST_TIMEOUT_MS must be a positive safe integer.'
  );

  assert.ok(
    RESOURCE_NAME.trim().length > 0 &&
      RESOURCE_NAME.length <= 100,
    'REPOSITORY_TEST_RESOURCE must contain 1–100 characters.'
  );

  validatePath(COLLECTION_PATH, 'REPOSITORY_TEST_PATH');
  validatePath(ITEM_PATH_TEMPLATE, 'REPOSITORY_TEST_ITEM_PATH');

  assert.ok(
    !ITEM_PATH_TEMPLATE.includes(':id:'),
    'The item path template contains an invalid ID placeholder.'
  );

  if (RUN_MUTATING_TESTS) {
    assert.equal(
      process.env.NODE_ENV,
      'test',
      'Mutating repository tests require NODE_ENV=test.'
    );

    assert.ok(
      USER_A_TOKEN.trim().length > 0,
      'Mutating tests require REPOSITORY_TEST_USER_A_TOKEN.'
    );

    if (!isLoopbackHostname(parsedBaseUrl.hostname)) {
      assert.equal(
        ALLOW_REMOTE_MUTATIONS,
        true,
        'Remote mutations are blocked. Set REPOSITORY_TEST_ALLOW_REMOTE_MUTATIONS=true only for an isolated test environment.'
      );

      assert.equal(
        process.env.REPOSITORY_TEST_ENVIRONMENT,
        'sandbox',
        'Remote mutations additionally require REPOSITORY_TEST_ENVIRONMENT=sandbox.'
      );

      assert.equal(
        parsedBaseUrl.protocol,
        'https:',
        'Remote mutation tests must use HTTPS.'
      );
    }

    if (process.env.CI === 'true') {
      assert.equal(
        ALLOW_CI_MUTATIONS,
        true,
        'CI mutation tests require REPOSITORY_TEST_CI_MUTATIONS=true.'
      );
    }
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

  const path = ITEM_PATH_TEMPLATE.includes(':id')
    ? ITEM_PATH_TEMPLATE.replace(':id', encodedId)
    : `${ITEM_PATH_TEMPLATE.replace(/\/+$/, '')}/${encodedId}`;

  validatePath(path, 'Resolved item path');

  return path;
}

function authHeaders(token) {
  return {
    ...JSON_HEADERS,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function urlFor(path) {
  assert.equal(
    typeof path,
    'string',
    'Request path must be a string.'
  );

  assert.ok(
    path.startsWith('/') && !path.startsWith('//'),
    'Requests must use origin-relative paths.'
  );

  assert.ok(
    !/[\\\r\n\t\0]/.test(path),
    'Request paths must not contain backslashes or control characters.'
  );

  const url = new URL(path, parsedBaseUrl);

  assert.equal(
    url.origin,
    parsedBaseUrl.origin,
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
    if (error && error.name === 'AbortError') {
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

function responseSummary(response) {
  // Avoid printing response bodies in assertion messages because they
  // might contain personal data, tokens, or internal diagnostics.
  const contentType = response.headers?.get('content-type') || 'unknown';

  return (
    `HTTP ${response.status}; content-type=${contentType}; ` +
    `body=${response.rawBody ? 'present' : 'empty'}`
  );
}

function assertStatus(response, expectedStatuses, context) {
  assert.ok(
    expectedStatuses.includes(response.status),
    `${context}: expected HTTP ${expectedStatuses.join(' or ')}, ` +
      `received ${responseSummary(response)}.`
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

function assertNoCredentialFields(value, path = '$', seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    return;
  }

  assert.equal(
    seen.has(value),
    false,
    `Unexpected circular object encountered at ${path}.`
  );

  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      assertNoCredentialFields(entry, `${path}[${index}]`, seen);
    });

    seen.delete(value);
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key);

    assert.equal(
      SENSITIVE_KEY_NAMES.has(normalizedKey),
      false,
      `Repository response must not expose credential field "${path}.${key}".`
    );

    assertNoCredentialFields(
      nestedValue,
      `${path}.${key}`,
      seen
    );
  }

  seen.delete(value);
}

function assertSafeErrorResponse(response) {
  const serialized = JSON.stringify(response.body ?? '');

  assert.equal(
    typeof response.body === 'string' &&
      response.body.length > 0 &&
      response.body.trim().startsWith('<!DOCTYPE html'),
    false,
    'Error response unexpectedly returned an HTML document.'
  );

  assertNoCredentialFields(response.body);

  for (const pattern of DATABASE_DISCLOSURE_PATTERNS) {
    assert.equal(
      pattern.test(serialized),
      false,
      `Error response may expose internal details matching ${pattern}.`
    );
  }
}

function canRunAuthenticatedTests() {
  return USER_A_TOKEN.trim().length > 0;
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
  return RUN_MUTATING_TESTS && canRunAuthenticatedTests();
}

function acceptedCreateStatus(status) {
  return [200, 201, 202].includes(status);
}

function assertCollectionResponse(response, context) {
  assertStatus(response, [200], context);

  const records = extractRecords(response.body);

  assert.ok(
    records !== null,
    `${context}: expected an array or a recognized collection envelope.`
  );

  for (const record of records) {
    assertNoCredentialFields(record);
  }

  return records;
}

test('repository integration configuration is valid', () => {
  validateConfiguration();
});

test('authenticated collection retrieval returns a recognized collection', async (t) => {
  if (!canRunAuthenticatedTests()) {
    t.skip('Set REPOSITORY_TEST_USER_A_TOKEN.');
    return;
  }

  const response = await request(COLLECTION_PATH, {
    method: 'GET',
    headers: authHeaders(USER_A_TOKEN),
  });

  assertCollectionResponse(
    response,
    'Authenticated collection retrieval'
  );
});

test('unauthenticated collection access follows the configured endpoint policy', async () => {
  const response = await request(COLLECTION_PATH, {
    method: 'GET',
    headers: JSON_HEADERS,
  });

  assert.ok(
    [200, 401, 403, 404].includes(response.status),
    `Unexpected unauthenticated collection response: ${responseSummary(response)}.`
  );

  if (AUTH_FAILURE_STATUSES.includes(response.status)) {
    assertSafeErrorResponse(response);
    return;
  }

  assertCollectionResponse(
    response,
    'Public collection retrieval'
  );
});

test('invalid bearer token cannot authorize protected collection access', async () => {
  const response = await request(COLLECTION_PATH, {
    method: 'GET',
    headers: authHeaders('invalid.repository.test.token'),
  });

  assert.ok(
    [200, 401, 403, 404].includes(response.status),
    `Unexpected invalid-token response: ${responseSummary(response)}.`
  );

  if (AUTH_FAILURE_STATUSES.includes(response.status)) {
    assertSafeErrorResponse(response);
    return;
  }

  // Some APIs intentionally expose public collections. If so, the
  // response must still conform to the collection contract.
  assertCollectionResponse(
    response,
    'Collection retrieval with invalid bearer token'
  );
});

test('malformed record identifiers are rejected safely', async (t) => {
  if (!canRunAuthenticatedTests()) {
    t.skip('Set REPOSITORY_TEST_USER_A_TOKEN.');
    return;
  }

  const response = await request(
    buildItemPath('../../admin'),
    {
      method: 'GET',
      headers: authHeaders(USER_A_TOKEN),
    }
  );

  assert.ok(
    NOT_FOUND_STATUSES.includes(response.status),
    `Malformed identifier should be rejected; received ${responseSummary(response)}.`
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
    NOT_FOUND_STATUSES.includes(response.status),
    `Unknown ID should not return a successful record; received ${responseSummary(response)}.`
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

  if (response.status !== 200) {
    assertSafeErrorResponse(response);
    return;
  }

  const record = extractRecord(response.body);

  assert.ok(
    isJsonObject(record),
    'Successful item retrieval must return a record object.'
  );

  assertNoCredentialFields(record);
});

test("User B cannot read User A's private record", async (t) => {
  if (!canRunOwnershipTests()) {
    t.skip(
      'Configure distinct User A and User B tokens and a record owned by User A.'
    );
    return;
  }

  // Verify the fixture is accessible to its intended owner before
  // testing the second user's access.
  const ownerResponse = await request(
    buildItemPath(EXISTING_ITEM_ID),
    {
      method: 'GET',
      headers: authHeaders(USER_A_TOKEN),
    }
  );

  assertStatus(
    ownerResponse,
    [200],
    'Verify User A owns or can access the test fixture'
  );

  const ownerRecord = extractRecord(ownerResponse.body);

  assert.ok(
    isJsonObject(ownerRecord),
    'User A fixture retrieval must return a record object.'
  );

  const response = await request(
    buildItemPath(EXISTING_ITEM_ID),
    {
      method: 'GET',
      headers: authHeaders(USER_B_TOKEN),
    }
  );

  assert.ok(
    [403, 404].includes(response.status),
    `Cross-user access must be denied or concealed; received ${responseSummary(response)}.`
  );

  assertSafeErrorResponse(response);
});

test('create operation persists a record across independent requests', async (t) => {
  if (!canRunMutationTests()) {
    t.skip(
      'Requires NODE_ENV=test, RUN_MUTATING_REPOSITORY_TESTS=true, and REPOSITORY_TEST_USER_A_TOKEN.'
    );
    return;
  }

  const marker = makeTestMarker();

  // Adapt this DTO to the actual repository's required fields.
  // A failed create is treated as a failure, not a passing test.
  const payload = {
    title: marker,
    name: marker,
    description: 'Automated repository integration test record.',
    testMarker: marker,
  };

  const createResponse = await request(COLLECTION_PATH, {
    method: 'POST',
    headers: {
      ...authHeaders(USER_A_TOKEN),
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  });

  assert.ok(
    acceptedCreateStatus(createResponse.status),
    `Create operation must succeed; received ${responseSummary(createResponse)}. ` +
      'Check the actual route, authorization policy, and required DTO fields.'
  );

  assert.notEqual(
    createResponse.status,
    202,
    'The API returned 202 Accepted. Add an API-specific polling step to verify asynchronous persistence.'
  );

  const createdRecord = extractRecord(createResponse.body);
  const createdId = getRecordId(createdRecord);

  assert.ok(
    createdId !== undefined &&
      createdId !== null &&
      String(createdId).trim().length > 0,
    'Successful creation must return a record identifier.'
  );

  assertNoCredentialFields(createdRecord);

  const readResponse = await request(
    buildItemPath(createdId),
    {
      method: 'GET',
      headers: authHeaders(USER_A_TOKEN),
    }
  );

  assertStatus(
    readResponse,
    [200],
    'Read-after-create'
  );

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

test('creation rejects malformed payloads without exposing internals', async (t) => {
  if (!canRunMutationTests()) {
    t.skip(
      'Requires NODE_ENV=test, RUN_MUTATING_REPOSITORY_TESTS=true, and REPOSITORY_TEST_USER_A_TOKEN.'
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
      [400, 409, 413, 415, 422].includes(response.status),
      `Malformed payload should be rejected with a validation-related status; received ${responseSummary(response)}.`
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

  // Confirm the fixture can be read before attempting a mutation.
  const beforeResponse = await request(path, {
    method: 'GET',
    headers: authHeaders(USER_A_TOKEN),
  });

  assertStatus(
    beforeResponse,
    [200],
    'Verify fixture before mass-assignment test'
  );

  const beforeRecord = extractRecord(beforeResponse.body);

  assert.ok(
    isJsonObject(beforeRecord),
    'Pre-update fixture must be a record object.'
  );

  const beforeId = getRecordId(beforeRecord);

  assert.ok(
    beforeId !== null && beforeId !== undefined,
    'Pre-update fixture must include a record ID.'
  );

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
    `Unexpected protected-field update response: ${responseSummary(response)}.`
  );

  if (response.status !== 200) {
    assertSafeErrorResponse(response);
  }

  // Always re-read: the response status alone cannot establish that
  // protected fields were not persisted.
  const reread = await request(path, {
    method: 'GET',
    headers: authHeaders(USER_A_TOKEN),
  });

  assertStatus(
    reread,
    [200],
    'Re-read after protected-field update attempt'
  );

  const persisted = extractRecord(reread.body);

  assert.ok(
    isJsonObject(persisted),
    'Re-read must return a record object.'
  );

  assert.equal(
    String(getRecordId(persisted)),
    String(beforeId),
    'The original fixture ID must remain unchanged.'
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

  assert.notEqual(
    persisted.ownerId,
    'another-user',
    'Client input must not reassign record ownership.'
  );

  assert.notEqual(
    persisted.userId,
    'another-user',
    'Client input must not reassign the record user.'
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

  // Confirm the fixture is readable by its owner before testing deletion.
  const beforeResponse = await request(path, {
    method: 'GET',
    headers: authHeaders(USER_A_TOKEN),
  });

  assertStatus(
    beforeResponse,
    [200],
    'Verify owner fixture before deletion-isolation test'
  );

  const beforeRecord = extractRecord(beforeResponse.body);

  assert.ok(
    isJsonObject(beforeRecord),
    'Owner fixture must return a record object.'
  );

  const beforeId = getRecordId(beforeRecord);

  const response = await request(path, {
    method: 'DELETE',
    headers: authHeaders(USER_B_TOKEN),
  });

  assert.ok(
    [403, 404].includes(response.status),
    `Cross-user deletion must be denied or concealed; received ${responseSummary(response)}.`
  );

  assertSafeErrorResponse(response);

  // Verify that the denied operation did not remove the fixture.
  const ownerRead = await request(path, {
    method: 'GET',
    headers: authHeaders(USER_A_TOKEN),
  });

  assertStatus(
    ownerRead,
    [200],
    'Owner read after denied cross-user deletion'
  );

  const afterRecord = extractRecord(ownerRead.body);

  assert.ok(
    isJsonObject(afterRecord),
    'The record must still be available to its owner.'
  );

  assert.equal(
    String(getRecordId(afterRecord)),
    String(beforeId),
    'The original owner record must remain intact.'
  );

  assertNoCredentialFields(afterRecord);
});

test('repeated collection requests return consistent response formats', async (t) => {
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

  const firstRecords = assertCollectionResponse(
    first,
    'First collection request'
  );

  const secondRecords = assertCollectionResponse(
    second,
    'Second collection request'
  );

  assert.equal(
    Array.isArray(firstRecords),
    Array.isArray(secondRecords),
    'Repeated requests must return the same collection data type.'
  );
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
    NOT_FOUND_STATUSES.includes(response.status),
    `Expected a validation or not-found response; received ${responseSummary(response)}.`
  );

  assertSafeErrorResponse(response);
});
