
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const policy = require('../../../src/policies/user.policy');
const authorize = policy.authorize || policy.canAccess || policy;

test('exports an authorization function', () => {
  assert.equal(typeof authorize, 'function');
});

test('denies unauthenticated access to protected user operations', () => {
  assert.notEqual(authorize({
    user: null,
    action: 'update',
    resource: { id: 'user-1' },
  }), true);
});

test('allows users to read their own profile when permitted', () => {
  assert.equal(authorize({
    user: { id: 'user-1', role: 'student' },
    action: 'read',
    resource: { id: 'user-1' },
  }), true);
});

test('denies users from reading another user’s private profile', () => {
  assert.notEqual(authorize({
    user: { id: 'user-2', role: 'student' },
    action: 'read',
    resource: { id: 'user-1' },
  }), true);
});

test('denies ordinary users from assigning themselves administrator privileges', () => {
  assert.notEqual(authorize({
    user: { id: 'user-1', role: 'student' },
    action: 'update',
    resource: { id: 'user-1' },
    input: { role: 'admin', isAdmin: true, permissions: ['*'] },
  }), true);
});

test('denies unauthorized changes to another user account', () => {
  assert.notEqual(authorize({
    user: { id: 'user-2', role: 'student' },
    action: 'update',
    resource: { id: 'user-1' },
    input: { name: 'Changed Name' },
  }), true);
});

test('denies unknown actions', () => {
  assert.notEqual(authorize({
    user: { id: 'admin-1', role: 'admin' },
    action: 'bypass-security',
    resource: { id: 'user-1' },
  }), true);
});
