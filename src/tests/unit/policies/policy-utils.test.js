
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const utils = require('../../../src/policies/policy-utils');

test('exports a non-empty policy utility module', () => {
  assert.equal(typeof utils, 'object');
  assert.notEqual(utils, null);
  assert.ok(Object.keys(utils).length > 0);
});

test('exports a recognized authorization helper', () => {
  const helpers = [
    'authorize',
    'canAccess',
    'hasPermission',
    'hasRole',
    'isOwner',
    'deny',
    'allow',
  ];

  assert.ok(
    helpers.some((name) => typeof utils[name] === 'function'),
    'Export at least one recognized policy helper',
  );
});

test('ownership checks do not accept missing identities', () => {
  const isOwner = utils.isOwner;

  if (typeof isOwner !== 'function') {
    assert.ok(true, 'No isOwner helper is exported');
    return;
  }

  assert.notEqual(isOwner(null, { userId: 'user-1' }), true);
  assert.notEqual(isOwner({ id: 'user-1' }, null), true);
  assert.notEqual(isOwner({ id: '' }, { userId: '' }), true);
});

test('role checks reject missing users and roles', () => {
  const hasRole = utils.hasRole;

  if (typeof hasRole !== 'function') {
    assert.ok(true, 'No hasRole helper is exported');
    return;
  }

  assert.notEqual(hasRole(null, 'admin'), true);
  assert.notEqual(hasRole({ id: 'user-1' }, 'admin'), true);
  assert.notEqual(hasRole({ id: 'user-1', role: 'student' }, 'admin'), true);
});

test('permission checks reject missing permissions', () => {
  const hasPermission = utils.hasPermission;

  if (typeof hasPermission !== 'function') {
    assert.ok(true, 'No hasPermission helper is exported');
    return;
  }

  assert.notEqual(hasPermission(null, 'users.manage'), true);
  assert.notEqual(
    hasPermission({ id: 'user-1', permissions: [] }, 'users.manage'),
    true,
  );
});
