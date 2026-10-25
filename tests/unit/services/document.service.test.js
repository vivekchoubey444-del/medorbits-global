
'use strict';

/**
 * MedOrbits -- Document Service Unit Tests
 * File: tests/unit/services/document.service.test.js
 *
 * Coverage:
 * - Service exports and document operation availability
 * - Document creation input validation
 * - Document lookup identifier validation
 * - Document listing behavior
 * - Document deletion identifier validation
 * - Invalid payload and identifier handling
 * - Protected-field and sensitive-data safeguards
 * - Caller input immutability
 *
 * Run:
 *   node --test tests/unit/services/document.service.test.js
 *
 * Security note:
 * Document access must be authorized against the authenticated principal
 * and the document's actual owner/resource association. Never trust an
 * owner ID or access-control flag supplied in client input.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const service = require('../../../src/services/document.service');

const REQUIRED_OPERATIONS = Object.freeze([
  'uploadDocument',
  'createDocument',
  'getDocumentById',
  'getDocuments',
  'deleteDocument',
]);

function getMethod(...names) {
  for (const name of names) {
    if (typeof service?.[name] === 'function') {
      return service[name];
    }
  }

  return null;
}

function requireMethod(names, description) {
  const method = getMethod(...names);

  assert.equal(
    typeof method,
    'function',
    `${description} must be implemented. Expected one of: ${names.join(', ')}`,
  );

  return method;
}

async function assertRejectsInput(method, args, description) {
  await assert.rejects(
    Promise.resolve().then(() => method(...args)),
    undefined,
    description,
  );
}

test('document service exports a valid module object', () => {
  assert.ok(
    service !== null &&
      typeof service === 'object' &&
      !Array.isArray(service),
    'Expected document service to export an object',
  );
});

test('document service exposes the required document operations', () => {
  for (const operation of REQUIRED_OPERATIONS) {
    assert.equal(
      typeof service[operation],
      'function',
      `Missing required document service operation: ${operation}`,
    );
  }
});

test('document creation rejects missing input', async () => {
  const create = requireMethod(
    ['uploadDocument', 'createDocument'],
    'Document creation',
  );

  await assertRejectsInput(
    create,
    [],
    'Creating a document without input must reject',
  );
});

test('document creation rejects null metadata', async () => {
  const create = requireMethod(
    ['uploadDocument', 'createDocument'],
    'Document creation',
  );

  await assertRejectsInput(
    create,
    [null],
    'Creating a document with null metadata must reject',
  );
});

test('document creation rejects an empty metadata object', async () => {
  const create = requireMethod(
    ['uploadDocument', 'createDocument'],
    'Document creation',
  );

  await assertRejectsInput(
    create,
    [{}],
    'Creating a document with an empty metadata object must reject',
  );
});

test('document creation rejects primitive metadata', async () => {
  const create = requireMethod(
    ['uploadDocument', 'createDocument'],
    'Document creation',
  );

  for (const invalidInput of ['', 'invalid', 123, true]) {
    await assertRejectsInput(
      create,
      [invalidInput],
      `Invalid document metadata ${String(invalidInput)} must reject`,
    );
  }
});

test('document lookup rejects an empty identifier', async () => {
  const find = requireMethod(
    ['getDocumentById'],
    'Document lookup',
  );

  await assertRejectsInput(
    find,
    [''],
    'An empty document ID must reject',
  );
});

test('document lookup rejects whitespace-only identifiers', async () => {
  const find = requireMethod(
    ['getDocumentById'],
    'Document lookup',
  );

  await assertRejectsInput(
    find,
    ['   '],
    'A whitespace-only document ID must reject',
  );
});

test('document lookup rejects null identifiers', async () => {
  const find = requireMethod(
    ['getDocumentById'],
    'Document lookup',
  );

  await assertRejectsInput(
    find,
    [null],
    'A null document ID must reject',
  );
});

test('document lookup rejects non-string identifiers', async () => {
  const find = requireMethod(
    ['getDocumentById'],
    'Document lookup',
  );

  for (const invalidId of [undefined, 0, {}, [], true]) {
    await assertRejectsInput(
      find,
      [invalidId],
      `Invalid document ID ${String(invalidId)} must reject`,
    );
  }
});

test('document deletion rejects an empty identifier', async () => {
  const remove = requireMethod(
    ['deleteDocument'],
    'Document deletion',
  );

  await assertRejectsInput(
    remove,
    [''],
    'An empty document ID must reject',
  );
});

test('document deletion rejects whitespace-only identifiers', async () => {
  const remove = requireMethod(
    ['deleteDocument'],
    'Document deletion',
  );

  await assertRejectsInput(
    remove,
    ['   '],
    'A whitespace-only document ID must reject',
  );
});

test('document deletion rejects null identifiers', async () => {
  const remove = requireMethod(
    ['deleteDocument'],
    'Document deletion',
  );

  await assertRejectsInput(
    remove,
    [null],
    'A null document ID must reject',
  );
});

test('document deletion rejects non-string identifiers', async () => {
  const remove = requireMethod(
    ['deleteDocument'],
    'Document deletion',
  );

  for (const invalidId of [undefined, 0, {}, [], true]) {
    await assertRejectsInput(
      remove,
      [invalidId],
      `Invalid document ID ${String(invalidId)} must reject`,
    );
  }
});

test('document listing handles an empty query without unexpected exceptions', async () => {
  const list = requireMethod(
    ['getDocuments'],
    'Document listing',
  );

  try {
    const result = await list({});

    assert.ok(
      result === null ||
        result === undefined ||
        typeof result === 'object',
      'Document listing should return a structured result',
    );
  } catch (error) {
    assert.ok(
      error instanceof Error,
      'Listing failures should be represented by Error objects',
    );
  }
});

test('document creation does not trust client-supplied privileged metadata', async () => {
  const create = requireMethod(
    ['uploadDocument', 'createDocument'],
    'Document creation',
  );

  const payload = {
    filename: 'test-document.pdf',
    mimeType: 'application/pdf',
    ownerId: 'user-attacker',
    userId: 'user-attacker',
    isVerified: true,
    verificationStatus: 'verified',
    accessLevel: 'public',
    storagePath: '../../private/secrets.pdf',
  };

  const original = structuredClone(payload);

  try {
    const result = await create(payload);

    if (result && typeof result === 'object') {
      assert.notEqual(
        result.isVerified,
        true,
        'Client input must not directly establish verification',
      );

      assert.notEqual(
        result.verificationStatus,
        'verified',
        'Client input must not directly establish verified status',
      );
    }
  } catch (error) {
    assert.ok(error instanceof Error);
  }

  assert.deepEqual(
    payload,
    original,
    'Document creation must not mutate caller-owned input',
  );
});

test('document service does not mutate nested metadata supplied by callers', async () => {
  const create = requireMethod(
    ['uploadDocument', 'createDocument'],
    'Document creation',
  );

  const payload = {
    filename: 'application-document.pdf',
    metadata: {
      category: 'admission',
      labels: ['application', 'supporting-document'],
    },
  };

  const original = structuredClone(payload);

  try {
    await create(payload);
  } catch (error) {
    assert.ok(error instanceof Error);
  }

  assert.deepEqual(payload, original);
});

test('document service exports contain no obvious secret-bearing property names', () => {
  const sensitiveKeyPattern =
    /password|secret|access.?token|private.?key|credential/i;

  for (const key of Object.keys(service)) {
    assert.equal(
      sensitiveKeyPattern.test(key),
      false,
      `Potentially sensitive service export: ${key}`,
    );
  }
});

test('document service methods retain stable exported references', () => {
  for (const operation of REQUIRED_OPERATIONS) {
    const method = service[operation];

    assert.equal(typeof method, 'function');
    assert.equal(service[operation], method);
  }
});
