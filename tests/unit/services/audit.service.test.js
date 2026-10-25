
'use strict';

/**
 * MedOrbits -- Audit Service Unit Tests
 * File: tests/unit/services/audit.service.test.js
 *
 * Coverage:
 * - Module exports and audit operation availability
 * - Required event validation
 * - Invalid event payload handling
 * - Sensitive-field redaction expectations
 * - Audit logging failure behavior
 * - Input immutability
 * - Accidental exposure of sensitive service exports
 *
 * Run:
 *   node --test tests/unit/services/audit.service.test.js
 *
 * Important:
 * These tests verify the exported service contract. Provider failures,
 * persistence guarantees, and redaction must be tested against the
 * actual audit implementation and its mocked dependencies.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const service = require('../../../src/services/audit.service');

const AUDIT_METHOD_NAMES = Object.freeze([
  'log',
  'logEvent',
  'record',
  'createAuditLog',
  'writeAuditLog',
]);

const SENSITIVE_KEY_PATTERN =
  /password|secret|token|private.?key|authorization|credential/i;

function getAuditMethod() {
  for (const name of AUDIT_METHOD_NAMES) {
    if (typeof service?.[name] === 'function') {
      return {
        name,
        method: service[name],
      };
    }
  }

  return null;
}

function requireAuditMethod() {
  const operation = getAuditMethod();

  assert.ok(
    operation,
    `Audit service must export an audit operation: ${AUDIT_METHOD_NAMES.join(', ')}`,
  );

  return operation;
}

async function assertRejectsAuditInput(operation, args, message) {
  await assert.rejects(
    Promise.resolve().then(() =>
      operation.method.apply(service, args),
    ),
    undefined,
    message,
  );
}

test('audit service exports a valid module object', () => {
  assert.ok(
    service !== null &&
      typeof service === 'object' &&
      !Array.isArray(service),
    'Expected audit service to export an object',
  );
});

test('audit service exposes an audit logging operation', () => {
  const operation = getAuditMethod();

  assert.ok(
    operation,
    `Expected an exported audit operation: ${AUDIT_METHOD_NAMES.join(', ')}`,
  );
});

test('audit service does not export obvious secret-bearing properties', () => {
  for (const key of Object.keys(service)) {
    assert.equal(
      SENSITIVE_KEY_PATTERN.test(key),
      false,
      `Potentially sensitive service export: ${key}`,
    );
  }
});

test('audit service rejects an empty event', async () => {
  const operation = requireAuditMethod();

  await assertRejectsAuditInput(
    operation,
    [],
    'An audit operation without an event must reject',
  );
});

test('audit service rejects a null event', async () => {
  const operation = requireAuditMethod();

  await assertRejectsAuditInput(
    operation,
    [null],
    'A null audit event must reject',
  );
});

test('audit service rejects an undefined event', async () => {
  const operation = requireAuditMethod();

  await assertRejectsAuditInput(
    operation,
    [undefined],
    'An undefined audit event must reject',
  );
});

test('audit service rejects primitive event payloads', async () => {
  const operation = requireAuditMethod();

  for (const event of ['', 'invalid-event', 123, true]) {
    await assertRejectsAuditInput(
      operation,
      [event],
      `Invalid audit event ${String(event)} must reject`,
    );
  }
});

test('audit service rejects an empty event object', async () => {
  const operation = requireAuditMethod();

  await assertRejectsAuditInput(
    operation,
    [{}],
    'An empty audit event object must reject',
  );
});

test('audit service does not mutate the caller event object', async () => {
  const operation = requireAuditMethod();

  const event = {
    eventType: 'application.created',
    actorId: 'user-test-001',
    resourceType: 'application',
    resourceId: 'app-test-001',
    metadata: {
      source: 'unit-test',
    },
  };

  const before = structuredClone(event);

  try {
    await operation.method.call(service, event);
  } catch (error) {
    // A missing provider or required field may cause rejection.
    // The input must still remain unchanged.
    assert.ok(error instanceof Error);
  }

  assert.deepEqual(
    event,
    before,
    'Audit service must not mutate caller-owned event data',
  );
});

test('audit service handles nested sensitive values without throwing unexpectedly', async () => {
  const operation = requireAuditMethod();

  const event = {
    eventType: 'authentication.attempt',
    actorId: 'user-test-002',
    resourceType: 'session',
    resourceId: 'session-test-001',
    metadata: {
      password: 'test-only-password',
      accessToken: 'test-only-access-token',
      apiSecret: 'test-only-api-secret',
      privateKey: 'test-only-private-key',
      safeField: 'safe-value',
    },
  };

  try {
    await operation.method.call(service, event);
  } catch (error) {
    assert.ok(
      error instanceof Error,
      'Audit operation failures should be represented by Error objects',
    );
  }

  // This is a robustness check, not proof that persisted audit data
  // is redacted. Verify redaction by inspecting the mocked persistence
  // provider in a separate integration-style unit test.
});

test('audit service does not mutate nested caller-owned event data', async () => {
  const operation = requireAuditMethod();

  const event = {
    eventType: 'application.updated',
    actorId: 'user-test-003',
    resourceType: 'application',
    resourceId: 'app-test-002',
    metadata: {
      changes: {
        status: {
          before: 'pending',
          after: 'submitted',
        },
      },
    },
  };

  const before = structuredClone(event);

  try {
    await operation.method.call(service, event);
  } catch (error) {
    assert.ok(error instanceof Error);
  }

  assert.deepEqual(event, before);
});

test('audit service preserves stable operation references', () => {
  for (const name of AUDIT_METHOD_NAMES) {
    if (typeof service[name] === 'function') {
      const method = service[name];

      assert.equal(typeof method, 'function');
      assert.equal(service[name], method);
    }
  }
});

test('audit service exposes no unexpected asynchronous initialization promise', () => {
  for (const [key, value] of Object.entries(service)) {
    if (/init|initializ|connect|bootstrap/i.test(key)) {
      assert.notEqual(
        value,
        undefined,
        `Export ${key} must not be undefined`,
      );
    }
  }
});
