
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const authPolicy = require('../../../src/policies/auth.policy');

const authorize =
  authPolicy.authorize ||
  authPolicy.canAccess ||
  authPolicy;

const hasPolicy = typeof authorize === 'function';

test('auth policy module exports an authorization function', () => {
  assert.equal(hasPolicy, true, 'Export authorize, canAccess, or a policy function');
});

test('denies requests without an authenticated user', () => {
  if (!hasPolicy) return;

  assert.notEqual(authorize({
    user: null,
    action: 'access-protected-resource',
  }), true);
});

test('does not trust a client-supplied administrator role', () => {
  if (!hasPolicy) return;

  const result = authorize({
    user: { id: 'user-1', role: 'student' },
    action: 'admin',
    input: { role: 'admin', isAdmin: true },
  });

  assert.notEqual(result, true);
});

test('denies unknown authorization actions', () => {
  if (!hasPolicy) return;

  assert.notEqual(authorize({
    user: { id: 'admin-1', role: 'admin' },
    action: 'bypass-security',
  }), true);
});

test('denies malformed user identities', () => {
  if (!hasPolicy) return;

  for (const user of [
    {},
    { id: '' },
    { id: null },
    { role: 'admin' },
  ]) {
    assert.notEqual(authorize({
      user,
      action: 'admin',
    }), true);
  }
});

test('does not allow an ordinary user to escalate privileges', () => {
  if (!hasPolicy) return;

  assert.notEqual(authorize({
    user: { id: 'user-1', role: 'student' },
    action: 'manage-users',
    input: { role: 'admin', permissions: ['*'] },
  }), true);
});
