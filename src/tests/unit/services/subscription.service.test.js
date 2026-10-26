
'use strict';

/**
 * MedOrbits -- Subscription Service Unit Tests
 * File: tests/unit/services/subscription.service.test.js
 *
 * Run:
 *   node --test tests/unit/services/subscription.service.test.js
 *
 * Coverage:
 * - Service module and public API validation
 * - Subscription creation input validation
 * - Subscription lookup input validation
 * - Cancellation input validation
 * - Renewal input validation
 * - User-subscription lookup validation
 * - Synchronous and asynchronous error handling
 * - Detection of missing service operations
 *
 * Important:
 * These tests validate the exported service contract. They do not connect
 * to a database, payment gateway, or production subscription provider.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const service = require('../../../src/services/subscription.service');

const EXPECTED_OPERATIONS = Object.freeze([
  'createSubscription',
  'getSubscriptionById',
  'getUserSubscription',
  'cancelSubscription',
  'renewSubscription',
]);

function getMethod(...names) {
  for (const name of names) {
    if (typeof service?.[name] === 'function') {
      return service[name];
    }
  }

  return null;
}

function assertMethodExists(names, description) {
  const method = getMethod(...names);

  assert.equal(
    typeof method,
    'function',
    `${description} must be implemented; expected one of: ${names.join(', ')}`,
  );

  return method;
}

async function assertRejectsInvalidInput(method, input, description) {
  await assert.rejects(
    Promise.resolve().then(() => method(input)),
    undefined,
    description,
  );
}

test('subscription service exports an object or function namespace', () => {
  assert.ok(
    service !== null &&
      (typeof service === 'object' || typeof service === 'function'),
    'Subscription service must export a module namespace',
  );
});

test('subscription service exposes the required subscription operations', () => {
  assert.ok(
    service && typeof service === 'object',
    'Expected subscription service to export an object',
  );

  for (const operation of EXPECTED_OPERATIONS) {
    assert.equal(
      typeof service[operation],
      'function',
      `Missing required subscription service operation: ${operation}`,
    );
  }
});

test('subscription creation rejects missing input', async () => {
  const create = assertMethodExists(
    ['createSubscription'],
    'Subscription creation',
  );

  await assertRejectsInvalidInput(
    create,
    {},
    'Creating a subscription with an empty payload must reject',
  );
});

test('subscription creation rejects null input', async () => {
  const create = assertMethodExists(
    ['createSubscription'],
    'Subscription creation',
  );

  await assertRejectsInvalidInput(
    create,
    null,
    'Creating a subscription with null input must reject',
  );
});

test('subscription creation rejects undefined input', async () => {
  const create = assertMethodExists(
    ['createSubscription'],
    'Subscription creation',
  );

  await assertRejectsInvalidInput(
    create,
    undefined,
    'Creating a subscription with undefined input must reject',
  );
});

test('subscription lookup rejects an empty identifier', async () => {
  const find = assertMethodExists(
    ['getSubscriptionById'],
    'Subscription lookup',
  );

  await assertRejectsInvalidInput(
    find,
    '',
    'An empty subscription ID must reject',
  );
});

test('subscription lookup rejects whitespace-only identifiers', async () => {
  const find = assertMethodExists(
    ['getSubscriptionById'],
    'Subscription lookup',
  );

  await assertRejectsInvalidInput(
    find,
    '   ',
    'A whitespace-only subscription ID must reject',
  );
});

test('subscription lookup rejects null identifiers', async () => {
  const find = assertMethodExists(
    ['getSubscriptionById'],
    'Subscription lookup',
  );

  await assertRejectsInvalidInput(
    find,
    null,
    'A null subscription ID must reject',
  );
});

test('subscription lookup rejects non-string identifiers', async () => {
  const find = assertMethodExists(
    ['getSubscriptionById'],
    'Subscription lookup',
  );

  for (const invalidId of [undefined, 0, {}, [], true]) {
    await assertRejectsInvalidInput(
      find,
      invalidId,
      `Invalid subscription ID ${String(invalidId)} must reject`,
    );
  }
});

test('user subscription lookup rejects an empty user identifier', async () => {
  const find = assertMethodExists(
    ['getUserSubscription'],
    'User subscription lookup',
  );

  await assertRejectsInvalidInput(
    find,
    '',
    'An empty user ID must reject',
  );
});

test('subscription cancellation rejects an empty identifier', async () => {
  const cancel = assertMethodExists(
    ['cancelSubscription'],
    'Subscription cancellation',
  );

  await assertRejectsInvalidInput(
    cancel,
    '',
    'An empty subscription ID must reject',
  );
});

test('subscription cancellation rejects a null identifier', async () => {
  const cancel = assertMethodExists(
    ['cancelSubscription'],
    'Subscription cancellation',
  );

  await assertRejectsInvalidInput(
    cancel,
    null,
    'A null subscription ID must reject',
  );
});

test('subscription renewal rejects an empty identifier', async () => {
  const renew = assertMethodExists(
    ['renewSubscription'],
    'Subscription renewal',
  );

  await assertRejectsInvalidInput(
    renew,
    '',
    'An empty subscription ID must reject',
  );
});

test('subscription renewal rejects a null identifier', async () => {
  const renew = assertMethodExists(
    ['renewSubscription'],
    'Subscription renewal',
  );

  await assertRejectsInvalidInput(
    renew,
    null,
    'A null subscription ID must reject',
  );
});

test('subscription operations do not return false success for invalid input', async () => {
  const cases = [
    {
      names: ['createSubscription'],
      input: {},
      description: 'subscription creation',
    },
    {
      names: ['getSubscriptionById'],
      input: '',
      description: 'subscription lookup',
    },
    {
      names: ['cancelSubscription'],
      input: '',
      description: 'subscription cancellation',
    },
    {
      names: ['renewSubscription'],
      input: '',
      description: 'subscription renewal',
    },
  ];

  for (const item of cases) {
    const method = assertMethodExists(
      item.names,
      item.description,
    );

    await assert.rejects(
      Promise.resolve().then(() => method(item.input)),
      `${item.description} must reject invalid input`,
    );
  }
});

test('subscription service methods are callable without changing their exported references', () => {
  for (const operation of EXPECTED_OPERATIONS) {
    const method = service[operation];

    assert.equal(typeof method, 'function');
    assert.equal(service[operation], method);
  }
});
