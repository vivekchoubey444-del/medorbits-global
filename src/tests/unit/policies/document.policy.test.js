
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const policy = require('../../../src/policies/document.policy');
const authorize = policy.authorize || policy.canAccess || policy;

test('exports an authorization function', () => {
  assert.equal(typeof authorize, 'function');
});

test('denies unauthenticated document access', () => {
  assert.notEqual(authorize({
    user: null,
    action: 'download',
    resource: { id: 'document-1', ownerId: 'user-1' },
  }), true);
});

test('allows an owner to access their document when permitted', () => {
  assert.equal(authorize({
    user: { id: 'user-1', role: 'student' },
    action: 'read',
    resource: { id: 'document-1', ownerId: 'user-1' },
  }), true);
});

test('denies a non-owner access to a private document', () => {
  assert.notEqual(authorize({
    user: { id: 'user-2', role: 'student' },
    action: 'read',
    resource: { id: 'document-1', ownerId: 'user-1' },
  }), true);
});

test('denies unauthorized downloads', () => {
  assert.notEqual(authorize({
    user: { id: 'user-2', role: 'student' },
    action: 'download',
    resource: { id: 'document-1', ownerId: 'user-1', isPrivate: true },
  }), true);
});

test('denies attempts to modify protected document fields', () => {
  assert.notEqual(authorize({
    user: { id: 'user-1', role: 'student' },
    action: 'update',
    resource: { id: 'document-1', ownerId: 'user-1' },
    input: {
      ownerId: 'user-2',
      storagePath: '../../secrets.env',
      verified: true,
    },
  }), true);
});

test('denies unknown actions', () => {
  assert.notEqual(authorize({
    user: { id: 'admin-1', role: 'admin' },
    action: 'bypass-security',
    resource: { id: 'document-1', ownerId: 'user-1' },
  }), true);
});
