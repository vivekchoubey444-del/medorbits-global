
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const applicationPolicy = require('../../../src/policies/application.policy');

const authorize =
  applicationPolicy.authorize ||
  applicationPolicy.canAccess ||
  applicationPolicy;

const hasPolicy = typeof authorize === 'function';

test('application policy module exports an authorization function', () => {
  assert.equal(hasPolicy, true, 'Export authorize, canAccess, or a policy function');
});

test('denies unauthenticated application access', () => {
  if (!hasPolicy) return;

  assert.notEqual(authorize({
    user: null,
    action: 'read',
    resource: { id: 'application-1', userId: 'user-1' },
  }), true);
});

test('allows an owner to read their application when permitted', () => {
  if (!hasPolicy) return;

  const result = authorize({
    user: { id: 'user-1', role: 'student' },
    action: 'read',
    resource: { id: 'application-1', userId: 'user-1' },
  });

  assert.equal(result, true);
});

test('denies a non-owner access to a private application', () => {
  if (!hasPolicy) return;

  const result = authorize({
    user: { id: 'user-2', role: 'student' },
    action: 'read',
    resource: { id: 'application-1', userId: 'user-1' },
  });

  assert.notEqual(result, true);
});

test('denies students from approving applications', () => {
  if (!hasPolicy) return;

  const result = authorize({
    user: { id: 'student-1', role: 'student' },
    action: 'approve',
    resource: { id: 'application-1', userId: 'student-1', status: 'submitted' },
  });

  assert.notEqual(result, true);
});

test('denies attempts to modify protected ownership fields', () => {
  if (!hasPolicy) return;

  const result = authorize({
    user: { id: 'user-1', role: 'student' },
    action: 'update',
    resource: { id: 'application-1', userId: 'user-1' },
    input: { userId: 'user-2', ownerId: 'user-2', role: 'admin' },
  });

  assert.notEqual(result, true);
});

test('denies unknown actions', () => {
  if (!hasPolicy) return;

  assert.notEqual(authorize({
    user: { id: 'admin-1', role: 'admin' },
    action: 'bypass-security',
    resource: { id: 'application-1', userId: 'user-1' },
  }), true);
});
