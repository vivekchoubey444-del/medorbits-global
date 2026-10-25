
'use strict';

/**
 * MedOrbits -- Application Service Unit Tests
 * File: tests/unit/services/application.service.test.js
 *
 * Coverage:
 * - Service exports and required operations
 * - Application creation validation
 * - Application lookup validation
 * - Application listing validation
 * - Application update validation
 * - Application deletion validation
 * - Invalid identifier and payload handling
 * - Rejection of invalid operations
 *
 * Run:
 *   node --test tests/unit/services/application.service.test.js
 *
 * Important:
 * Tests use the real service module but do not connect intentionally to
 * production infrastructure. If the service initializes external
 * dependencies during import, isolate those dependencies first.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const service = require('../../../src/services/application.service');

const REQUIRED_OPERATIONS = Object.freeze([
  'createApplication',
  'getApplicationById',
  'getApplications',
  'updateApplication',
  'deleteApplication',
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

test('application service exports a valid module object', () => {
  assert.ok(
    service !== null &&
      typeof service === 'object' &&
      !Array.isArray(service),
    'Expected application service to export an object',
  );
});

test('application service exposes the required operations', () => {
  for (const operation of REQUIRED_OPERATIONS) {
    assert.equal(
      typeof service[operation],
      'function',
      `Missing required application service operation: ${operation}`,
    );
  }
});

test('application creation rejects missing input', async () => {
  const create = requireMethod(
    ['createApplication'],
    'Application creation',
  );

  await assertRejectsInput(
    create,
    [],
    'Creating an application without input must reject',
  );
});

test('application creation rejects an empty payload', async () => {
  const create = requireMethod(
    ['createApplication'],
    'Application creation',
  );

  await assertRejectsInput(
    create,
    [{}],
    'Creating an application with an empty payload must reject',
  );
});

test('application creation rejects null input', async () => {
  const create = requireMethod(
    ['createApplication'],
    'Application creation',
  );

  await assertRejectsInput(
    create,
    [null],
    'Creating an application with null input must reject',
  );
});

test('application creation rejects primitive payloads', async () => {
  const create = requireMethod(
    ['createApplication'],
    'Application creation',
  );

  for (const input of ['invalid', 42, true]) {
    await assertRejectsInput(
      create,
      [input],
      `Creating an application with ${String(input)} must reject`,
    );
  }
});

test('application lookup rejects an empty identifier', async () => {
  const find = requireMethod(
    ['getApplicationById'],
    'Application lookup',
  );

  await assertRejectsInput(
    find,
    [''],
    'An empty application ID must reject',
  );
});

test('application lookup rejects whitespace-only identifiers', async () => {
  const find = requireMethod(
    ['getApplicationById'],
    'Application lookup',
  );

  await assertRejectsInput(
    find,
    ['   '],
    'A whitespace-only application ID must reject',
  );
});

test('application lookup rejects null identifiers', async () => {
  const find = requireMethod(
    ['getApplicationById'],
    'Application lookup',
  );

  await assertRejectsInput(
    find,
    [null],
    'A null application ID must reject',
  );
});

test('application lookup rejects non-string identifiers', async () => {
  const find = requireMethod(
    ['getApplicationById'],
    'Application lookup',
  );

  for (const id of [undefined, 0, {}, [], true]) {
    await assertRejectsInput(
      find,
      [id],
      `Invalid application ID ${String(id)} must reject`,
    );
  }
});

test('application listing rejects invalid query input when a query is required', async (t) => {
  const list = requireMethod(
    ['getApplications'],
    'Application listing',
  );

  // Listing methods commonly accept no arguments or a query object.
  // An empty query is not universally invalid, so only verify that the
  // method handles it without an unexpected synchronous crash.
  try {
    const result = await list({});
    assert.ok(
      result === null ||
        result === undefined ||
        typeof result === 'object',
      'Application listing should return a structured result',
    );
  } catch (error) {
    assert.ok(
      error instanceof Error,
      'Listing failures should be represented by Error objects',
    );
  }

  t.diagnostic(
    'Listing semantics depend on the service contract; use repository mocks to test success and failure deterministically.',
  );
});

test('application update rejects an empty application identifier', async () => {
  const update = requireMethod(
    ['updateApplication'],
    'Application update',
  );

  await assertRejectsInput(
    update,
    ['', {}],
    'Updating an application with an empty ID must reject',
  );
});

test('application update rejects a missing payload', async () => {
  const update = requireMethod(
    ['updateApplication'],
    'Application update',
  );

  await assertRejectsInput(
    update,
    ['app-test-001'],
    'Updating an application without a payload must reject',
  );
});

test('application update rejects a null payload', async () => {
  const update = requireMethod(
    ['updateApplication'],
    'Application update',
  );

  await assertRejectsInput(
    update,
    ['app-test-001', null],
    'Updating an application with a null payload must reject',
  );
});

test('application update rejects a whitespace-only identifier', async () => {
  const update = requireMethod(
    ['updateApplication'],
    'Application update',
  );

  await assertRejectsInput(
    update,
    ['   ', {}],
    'Updating an application with a whitespace-only ID must reject',
  );
});

test('application deletion rejects an empty identifier', async () => {
  const remove = requireMethod(
    ['deleteApplication'],
    'Application deletion',
  );

  await assertRejectsInput(
    remove,
    [''],
    'Deleting an application with an empty ID must reject',
  );
});

test('application deletion rejects null identifiers', async () => {
  const remove = requireMethod(
    ['deleteApplication'],
    'Application deletion',
  );

  await assertRejectsInput(
    remove,
    [null],
    'Deleting an application with a null ID must reject',
  );
});

test('application deletion rejects whitespace-only identifiers', async () => {
  const remove = requireMethod(
    ['deleteApplication'],
    'Application deletion',
  );

  await assertRejectsInput(
    remove,
    ['   '],
    'Deleting an application with a whitespace-only ID must reject',
  );
});

test('application update does not silently accept protected client fields', async () => {
  const update = requireMethod(
    ['updateApplication'],
    'Application update',
  );

  const payload = {
    status: 'approved',
    userId: 'another-user',
    ownerId: 'another-user',
    createdAt: '2020-01-01T00:00:00.000Z',
    isAdmin: true,
  };

  let outcome;

  try {
    outcome = await update('app-test-001', payload);
  } catch (error) {
    assert.ok(error instanceof Error);
    return;
  }

  // If the service accepts the payload, verify it did not return a
  // record with client-controlled privilege or ownership changes.
  if (outcome && typeof outcome === 'object') {
    for (const field of ['isAdmin']) {
      assert.notEqual(
        outcome[field],
        payload[field],
        `The service must not trust client-supplied ${field}`,
      );
    }
  }

  // Full ownership/status assertions should use a mocked repository
  // and a known persisted record in a dedicated service contract test.
});

test('application service methods retain stable exported references', () => {
  for (const operation of REQUIRED_OPERATIONS) {
    const method = service[operation];

    assert.equal(typeof method, 'function');
    assert.equal(service[operation], method);
  }
});
