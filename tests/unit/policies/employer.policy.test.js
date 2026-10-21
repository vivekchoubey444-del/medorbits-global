
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const policy = require('../../../src/policies/employer.policy');
const authorize = policy.authorize || policy.canAccess || policy;

test('exports an authorization function', () => {
  assert.equal(typeof authorize, 'function');
});

test('denies unauthenticated employer operations', () => {
  assert.notEqual(authorize({
    user: null,
    action: 'manage',
    resource: { id: 'employer-1', ownerId: 'user-1' },
  }), true);
});

test('allows an employer to access their own organization when permitted', () => {
  assert.equal(authorize({
    user: { id: 'user-1', role: 'employer' },
    action: 'read',
    resource: { id: 'employer-1', ownerId: 'user-1' },
  }), true);
});

test('denies access to another employer’s private organization', () => {
  assert.notEqual(authorize({
    user: { id: 'user-2', role: 'employer' },
    action: 'update',
    resource: { id: 'employer-1', ownerId: 'user-1' },
  }), true);
});

test('denies employers from assigning themselves administrator privileges', () => {
  assert.notEqual(authorize({
    user: { id: 'user-1', role: 'employer' },
    action: 'update',
    resource: { id: 'employer-1', ownerId: 'user-1' },
    input: { role: 'admin', verified: true, permissions: ['*'] },
  }), true);
});

test('denies employers from accessing unauthorized candidate data', () => {
  assert.notEqual(authorize({
    user: { id: 'employer-1', role: 'employer' },
    action: 'read-candidate-sensitive-data',
    resource: { id: 'candidate-1', ownerId: 'candidate-1' },
  }), true);
});

test('denies unknown actions', () => {
  assert.notEqual(authorize({
    user: { id: 'admin-1', role: 'admin' },
    action: 'bypass-security',
    resource: { id: 'employer-1', ownerId: 'user-1' },
  }), true);
});
