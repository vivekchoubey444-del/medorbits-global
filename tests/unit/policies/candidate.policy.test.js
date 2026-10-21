
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const candidatePolicy = require('../../../src/policies/candidate.policy');

const authorize =
  candidatePolicy.authorize ||
  candidatePolicy.canAccess ||
  candidatePolicy;

const hasPolicy = typeof authorize === 'function';

test('candidate policy module exports an authorization function', () => {
  assert.equal(hasPolicy, true, 'Export authorize, canAccess, or a policy function');
});

test('denies unauthenticated access to candidate records', () => {
  if (!hasPolicy) return;

  assert.notEqual(authorize({
    user: null,
    action: 'read',
    resource: { id: 'candidate-1', userId: 'candidate-1' },
  }), true);
});

test('allows a candidate to access their own record when permitted', () => {
  if (!hasPolicy) return;

  const result = authorize({
    user: { id: 'candidate-1', role: 'candidate' },
    action: 'read',
    resource: { id: 'candidate-1', userId: 'candidate-1' },
  });

  assert.equal(result, true);
});

test('denies a different candidate access to private candidate data', () => {
  if (!hasPolicy) return;

  const result = authorize({
    user: { id: 'candidate-2', role: 'candidate' },
    action: 'read',
    resource: { id: 'candidate-1', userId: 'candidate-1' },
  });

  assert.notEqual(result, true);
});

test('denies unauthorized access to sensitive candidate fields', () => {
  if (!hasPolicy) return;

  const result = authorize({
    user: { id: 'employer-1', role: 'employer' },
    action: 'read-sensitive',
    resource: {
      id: 'candidate-1',
      userId: 'candidate-1',
      sensitive: true,
    },
  });

  assert.notEqual(result, true);
});

test('denies candidates from changing their own privileged role', () => {
  if (!hasPolicy) return;

  const result = authorize({
    user: { id: 'candidate-1', role: 'candidate' },
    action: 'update',
    resource: { id: 'candidate-1', userId: 'candidate-1' },
    input: { role: 'admin', permissions: ['*'] },
  });

  assert.notEqual(result, true);
});

test('denies unknown actions', () => {
  if (!hasPolicy) return;

  assert.notEqual(authorize({
    user: { id: 'admin-1', role: 'admin' },
    action: 'bypass-security',
    resource: { id: 'candidate-1', userId: 'candidate-1' },
  }), true);
});
