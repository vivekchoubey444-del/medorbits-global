
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const policy = require('../../../src/policies/university.policy');
const authorize = policy.authorize || policy.canAccess || policy;

test('exports an authorization function', () => {
  assert.equal(typeof authorize, 'function');
});

test('denies unauthenticated access to a protected university operation', () => {
  assert.notEqual(authorize({
    user: null,
    action: 'manage',
    resource: { id: 'university-1' },
  }), true);
});

test('allows an administrator to manage university records when permitted', () => {
  assert.equal(authorize({
    user: { id: 'admin-1', role: 'admin' },
    action: 'manage',
    resource: { id: 'university-1' },
  }), true);
});

test('denies students from managing university records', () => {
  assert.notEqual(authorize({
    user: { id: 'student-1', role: 'student' },
    action: 'manage',
    resource: { id: 'university-1' },
  }), true);
});

test('denies unauthorized changes to university verification status', () => {
  assert.notEqual(authorize({
    user: { id: 'student-1', role: 'student' },
    action: 'update',
    resource: { id: 'university-1' },
    input: { verified: true, status: 'approved' },
  }), true);
});

test('denies unknown actions', () => {
  assert.notEqual(authorize({
    user: { id: 'admin-1', role: 'admin' },
    action: 'bypass-security',
    resource: { id: 'university-1' },
  }), true);
});
