
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const policy = require('../../../src/policies/internship.policy');
const authorize = policy.authorize || policy.canAccess || policy;

test('exports an authorization function', () => {
  assert.equal(typeof authorize, 'function');
});

test('denies unauthenticated internship operations', () => {
  assert.notEqual(authorize({
    user: null,
    action: 'create',
    resource: null,
  }), true);
});

test('allows an employer to manage their own internship when permitted', () => {
  assert.equal(authorize({
    user: { id: 'employer-1', role: 'employer' },
    action: 'update',
    resource: { id: 'internship-1', employerId: 'employer-1' },
  }), true);
});

test('denies an employer from modifying another employer’s internship', () => {
  assert.notEqual(authorize({
    user: { id: 'employer-2', role: 'employer' },
    action: 'update',
    resource: { id: 'internship-1', employerId: 'employer-1' },
  }), true);
});

test('denies students from publishing internships', () => {
  assert.notEqual(authorize({
    user: { id: 'student-1', role: 'student' },
    action: 'publish',
    resource: { id: 'internship-1', employerId: 'employer-1', status: 'draft' },
  }), true);
});

test('denies modification of protected internship fields', () => {
  assert.notEqual(authorize({
    user: { id: 'employer-1', role: 'employer' },
    action: 'update',
    resource: { id: 'internship-1', employerId: 'employer-1' },
    input: { employerId: 'employer-2', status: 'published', verified: true },
  }), true);
});

test('denies unknown actions', () => {
  assert.notEqual(authorize({
    user: { id: 'admin-1', role: 'admin' },
    action: 'bypass-security',
    resource: { id: 'internship-1', employerId: 'employer-1' },
  }), true);
});
