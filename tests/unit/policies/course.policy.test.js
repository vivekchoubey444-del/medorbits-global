
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const policy = require('../../../src/policies/course.policy');
const authorize = policy.authorize || policy.canAccess || policy;

test('exports an authorization function', () => {
  assert.equal(typeof authorize, 'function');
});

test('denies unauthenticated access to a protected course operation', () => {
  assert.notEqual(authorize({
    user: null,
    action: 'manage',
    resource: { id: 'course-1' },
  }), true);
});

test('allows an administrator to manage courses when permitted', () => {
  assert.equal(authorize({
    user: { id: 'admin-1', role: 'admin' },
    action: 'manage',
    resource: { id: 'course-1' },
  }), true);
});

test('denies students from publishing courses', () => {
  assert.notEqual(authorize({
    user: { id: 'student-1', role: 'student' },
    action: 'publish',
    resource: { id: 'course-1', status: 'draft' },
  }), true);
});

test('denies unauthorized modification of course ownership and publication status', () => {
  assert.notEqual(authorize({
    user: { id: 'student-1', role: 'student' },
    action: 'update',
    resource: { id: 'course-1' },
    input: { ownerId: 'student-1', status: 'published', verified: true },
  }), true);
});

test('denies unknown actions', () => {
  assert.notEqual(authorize({
    user: { id: 'admin-1', role: 'admin' },
    action: 'bypass-security',
    resource: { id: 'course-1' },
  }), true);
});
