
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const policy = require('../../../src/policies/counselling.policy');
const authorize = policy.authorize || policy.canAccess || policy;

test('exports an authorization function', () => {
  assert.equal(typeof authorize, 'function');
});

test('denies unauthenticated counselling access', () => {
  assert.notEqual(authorize({
    user: null,
    action: 'read',
    resource: { id: 'session-1', studentId: 'student-1' },
  }), true);
});

test('allows a student to access their own counselling record when permitted', () => {
  assert.equal(authorize({
    user: { id: 'student-1', role: 'student' },
    action: 'read',
    resource: { id: 'session-1', studentId: 'student-1' },
  }), true);
});

test('denies access to another student’s counselling record', () => {
  assert.notEqual(authorize({
    user: { id: 'student-2', role: 'student' },
    action: 'read',
    resource: { id: 'session-1', studentId: 'student-1' },
  }), true);
});

test('denies students from assigning themselves as counsellors', () => {
  assert.notEqual(authorize({
    user: { id: 'student-1', role: 'student' },
    action: 'update',
    resource: { id: 'session-1', studentId: 'student-1' },
    input: { counsellorId: 'student-1', role: 'counsellor' },
  }), true);
});

test('denies unknown actions', () => {
  assert.notEqual(authorize({
    user: { id: 'admin-1', role: 'admin' },
    action: 'bypass-security',
    resource: { id: 'session-1', studentId: 'student-1' },
  }), true);
});
