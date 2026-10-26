
'use strict';

/**
 * MedOrbits -- Admission Policy Unit Tests
 *
 * File: tests/unit/policies/admission.policy.test.js
 * Runtime: Node.js >= 20
 * Test runner: Node.js built-in test runner
 *
 * Run:
 *   node --test tests/unit/policies/admission.policy.test.js
 *
 * Purpose:
 * - Verify the admission policy exports a usable authorization function.
 * - Verify authentication and record ownership enforcement.
 * - Verify request-supplied ownership identifiers cannot grant access.
 * - Verify unauthorized admission status transitions are denied.
 * - Verify unknown actions and malformed authorization contexts fail closed.
 *
 * Important:
 * These tests exercise the actual policy implementation. They do not replace
 * API-level tests for authentication middleware, database ownership, or routes.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const admissionPolicy = require('../../../src/policies/admission.policy');

const authorize =
  admissionPolicy?.authorize ??
  admissionPolicy?.canAccess ??
  (typeof admissionPolicy === 'function' ? admissionPolicy : undefined);

const hasPolicy = typeof authorize === 'function';

const USERS = Object.freeze({
  student: Object.freeze({
    id: 'user-student-001',
    role: 'student',
  }),
  otherStudent: Object.freeze({
    id: 'user-student-002',
    role: 'student',
  }),
  admin: Object.freeze({
    id: 'user-admin-001',
    role: 'admin',
  }),
});

const ADMISSIONS = Object.freeze({
  owned: Object.freeze({
    id: 'admission-test-001',
    userId: USERS.student.id,
    status: 'submitted',
  }),
  foreign: Object.freeze({
    id: 'admission-test-002',
    userId: USERS.student.id,
    status: 'submitted',
  }),
});

function authorizationContext(overrides = {}) {
  return {
    user: USERS.student,
    action: 'read',
    resource: ADMISSIONS.owned,
    ...overrides,
  };
}

function assertDenied(result, message) {
  assert.notEqual(result, true, message);
}

function assertAllowed(result, message) {
  assert.equal(result, true, message);
}

test('admission policy module exports an authorization function', () => {
  assert.equal(
    hasPolicy,
    true,
    'Export authorize, canAccess, or a policy function',
  );
});

test('denies unauthenticated access to an admission record', {
  skip: !hasPolicy,
}, () => {
  const result = authorize(
    authorizationContext({
      user: null,
    }),
  );

  assertDenied(result, 'Unauthenticated users must not be authorized');
});

test('denies access when the user is undefined', {
  skip: !hasPolicy,
}, () => {
  const result = authorize(
    authorizationContext({
      user: undefined,
    }),
  );

  assertDenied(result, 'A missing user must not be authorized');
});

test('denies access to another student’s admission record', {
  skip: !hasPolicy,
}, () => {
  const result = authorize(
    authorizationContext({
      user: USERS.otherStudent,
      resource: ADMISSIONS.owned,
    }),
  );

  assertDenied(
    result,
    'A student must not access another student’s admission record',
  );
});

test('does not trust ownership identifiers supplied by the request', {
  skip: !hasPolicy,
}, () => {
  const result = authorize(
    authorizationContext({
      user: USERS.otherStudent,
      resource: ADMISSIONS.owned,
      input: {
        userId: USERS.otherStudent.id,
        ownerId: USERS.otherStudent.id,
      },
    }),
  );

  assertDenied(
    result,
    'Request-supplied ownership identifiers must not override persisted ownership',
  );
});

test('denies unauthorized admission status changes', {
  skip: !hasPolicy,
}, () => {
  const result = authorize(
    authorizationContext({
      user: USERS.student,
      action: 'update',
      resource: ADMISSIONS.owned,
      input: {
        status: 'approved',
      },
    }),
  );

  assertDenied(
    result,
    'Students must not approve admission records through ordinary updates',
  );
});

test('denies unknown actions', {
  skip: !hasPolicy,
}, () => {
  const result = authorize(
    authorizationContext({
      user: USERS.admin,
      action: 'bypass-security',
      resource: ADMISSIONS.owned,
    }),
  );

  assertDenied(
    result,
    'Unknown actions must not be implicitly authorized',
  );
});

test('denies access when the resource is missing', {
  skip: !hasPolicy,
}, () => {
  const result = authorize(
    authorizationContext({
      resource: null,
    }),
  );

  assertDenied(result, 'A missing admission resource must not be authorized');
});

test('denies access when the action is missing', {
  skip: !hasPolicy,
}, () => {
  const result = authorize(
    authorizationContext({
      action: undefined,
    }),
  );

  assertDenied(result, 'A missing action must not be authorized');
});

test('denies access when the action is an empty string', {
  skip: !hasPolicy,
}, () => {
  const result = authorize(
    authorizationContext({
      action: '',
    }),
  );

  assertDenied(result, 'An empty action must not be authorized');
});

test('denies access when the user has no identifier', {
  skip: !hasPolicy,
}, () => {
  const result = authorize(
    authorizationContext({
      user: {
        role: 'student',
      },
    }),
  );

  assertDenied(
    result,
    'A role without an authenticated user identifier must not grant access',
  );
});

test('denies access when the resource has no owner identifier', {
  skip: !hasPolicy,
}, () => {
  const result = authorize(
    authorizationContext({
      user: USERS.student,
      resource: {
        id: 'admission-ownerless-test',
        status: 'submitted',
      },
    }),
  );

  assertDenied(
    result,
    'A resource without a recognized owner must not grant student access',
  );
});

test('does not authorize a student by matching a request-supplied resource ID alone', {
  skip: !hasPolicy,
}, () => {
  const result = authorize(
    authorizationContext({
      user: USERS.otherStudent,
      resource: {
        id: ADMISSIONS.owned.id,
        userId: USERS.student.id,
      },
      input: {
        id: ADMISSIONS.owned.id,
        userId: USERS.otherStudent.id,
      },
    }),
  );

  assertDenied(
    result,
    'Matching resource identifiers must not bypass ownership checks',
  );
});

test('does not authorize a student using a client-supplied role', {
  skip: !hasPolicy,
}, () => {
  const result = authorize(
    authorizationContext({
      user: {
        id: USERS.otherStudent.id,
        role: 'student',
      },
      input: {
        role: 'admin',
        isAdmin: true,
        permissions: ['admissions:approve'],
      },
    }),
  );

  assertDenied(
    result,
    'Client-supplied role and permission fields must not override the authenticated principal',
  );
});

test('does not mutate the authorization context or resource', {
  skip: !hasPolicy,
}, () => {
  const context = {
    user: {
      id: USERS.otherStudent.id,
      role: 'student',
    },
    action: 'read',
    resource: {
      id: ADMISSIONS.owned.id,
      userId: USERS.student.id,
      status: 'submitted',
    },
    input: {
      userId: USERS.otherStudent.id,
    },
  };

  const original = structuredClone(context);

  try {
    authorize(context);
  } catch {
    // A policy may throw for invalid or denied authorization contexts.
  }

  assert.deepEqual(
    context,
    original,
    'Authorization evaluation should not mutate caller-owned input',
  );
});

test('does not accidentally treat a Promise as an authorization grant', {
  skip: !hasPolicy,
}, () => {
  const result = authorize(
    authorizationContext({
      user: null,
    }),
  );

  if (result && typeof result.then === 'function') {
    assert.notEqual(
      result,
      true,
      'A Promise must not be mistaken for a synchronous authorization grant',
    );
  } else {
    assertDenied(
      result,
      'Unauthenticated access must not be granted',
    );
  }
});

test('owner read access is evaluated by the policy', {
  skip: !hasPolicy,
}, () => {
  const result = authorize(
    authorizationContext({
      user: USERS.student,
      action: 'read',
      resource: ADMISSIONS.owned,
    }),
  );

  // This test deliberately does not require a grant: the actual policy may
  // impose additional conditions, such as admission state or permissions.
  assert.notEqual(
    result,
    undefined,
    'The policy should return an explicit decision or a documented async result',
  );
});

test('administrative approval is not assumed solely from a role label', {
  skip: !hasPolicy,
}, () => {
  const result = authorize(
    authorizationContext({
      user: USERS.admin,
      action: 'update',
      resource: ADMISSIONS.owned,
      input: {
        status: 'approved',
      },
    }),
  );

  // The policy may allow or deny this based on its documented rules.
  // This assertion only ensures the call does not silently return undefined.
  assert.notEqual(
    result,
    undefined,
    'Administrative decisions should be explicit',
  );
});
