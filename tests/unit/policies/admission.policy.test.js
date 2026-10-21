
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const admissionPolicy = require('../../../src/policies/admission.policy');

const authorize = admissionPolicy.authorize || admissionPolicy.canAccess || admissionPolicy;
const hasPolicy = typeof authorize === 'function';

test('admission policy module exports an authorization function', () => {
  assert.equal(hasPolicy, true, 'Export authorize, canAccess, or a policy function');
});

test('denies unauthenticated access', () => {
  if (!hasPolicy) return;

  const result = authorize({
    user: null,
    action: 'read',
    resource: { id: 'admission-1', userId: 'user-1' },
  });

  assert.notEqual(result, true);
});

test('denies access to another user’s admission record', () => {
  if (!hasPolicy) return;

  const result = authorize({
    user: { id: 'user-2', role: 'student' },
    action: 'read',
    resource: { id: 'admission-1', userId: 'user-1' },
  });

  assert.notEqual(result, true);
});

test('does not trust ownership IDs supplied by the request', () => {
  if (!hasPolicy) return;

  const result = authorize({
    user: { id: 'user-2', role: 'student' },
    action: 'read',
    resource: { id: 'admission-1', userId: 'user-1' },
    input: { userId: 'user-2', ownerId: 'user-2' },
  });

  assert.notEqual(result, true);
});

test('denies unauthorized admission status changes', () => {
  if (!hasPolicy) return;

  const result = authorize({
    user: { id: 'student-1', role: 'student' },
    action: 'update',
    resource: { id: 'admission-1', userId: 'student-1', status: 'submitted' },
    input: { status: 'approved' },
  });

  assert.notEqual(result, true);
});

test('denies an unknown action', () => {
  if (!hasPolicy) return;

  const result = authorize({
    user: { id: 'admin-1', role: 'admin' },
    action: 'bypass-security',
    resource: { id: 'admission-1', userId: 'student-1' },
  });

  assert.notEqual(result, true);
});
