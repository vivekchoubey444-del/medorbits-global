
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const policy = require('../../../src/policies/college.policy');
const authorize = policy.authorize || policy.canAccess || policy;

test('exports an authorization function', () => {
  assert.equal(typeof authorize, 'function');
});

test('denies unauthenticated access to a protected college operation', () => {
  assert.notEqual(authorize({
    user: null,
    action: 'manage',
    resource: { id: 'college-1' },
  }), true);
});

test('allows an administrator to manage colleges when permitted', () => {
  assert.equal(authorize({
    user: { id: 'admin-1', role: 'admin' },
    action: 'manage',
    resource: { id: 'college-1' },
  }), true);
});

test('denies students from managing college records', () => {
  assert.notEqual(authorize({
    user: { id: 'student-1', role: 'student' },
    action: 'manage',
    resource: { id: 'college-1' },
  }), true);
});

test('denies unauthorized modification of protected college fields', () => {
  assert.notEqual(authorize({
    user: { id: 'student-1', role: 'student' },
    action: 'update',
    resource: { id: 'college-1' },
    input: { verified: true, ownerId: 'student-1', role: 'admin' },
  }), true);
});

test('denies unknown actions', () => {
  assert.notEqual(authorize({
    user: { id: 'admin-1', role: 'admin' },
    action: 'bypass-security',
    resource: { id: 'college-1' },
  }), true);
});
