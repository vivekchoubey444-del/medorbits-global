
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const policy = require('../../../src/policies/subscription.policy');
const authorize = policy.authorize || policy.canAccess || policy;

test('exports an authorization function', () => {
  assert.equal(typeof authorize, 'function');
});

test('denies unauthenticated subscription access', () => {
  assert.notEqual(authorize({
    user: null,
    action: 'read',
    resource: { id: 'subscription-1', userId: 'user-1' },
  }), true);
});

test('allows a subscription owner to read their subscription when permitted', () => {
  assert.equal(authorize({
    user: { id: 'user-1', role: 'student' },
    action: 'read',
    resource: { id: 'subscription-1', userId: 'user-1' },
  }), true);
});

test('denies another user access to a private subscription', () => {
  assert.notEqual(authorize({
    user: { id: 'user-2', role: 'student' },
    action: 'read',
    resource: { id: 'subscription-1', userId: 'user-1' },
  }), true);
});

test('denies clients from assigning themselves a premium subscription', () => {
  assert.notEqual(authorize({
    user: { id: 'user-1', role: 'student' },
    action: 'update',
    resource: { id: 'subscription-1', userId: 'user-1', status: 'inactive' },
    input: { status: 'active', plan: 'premium', paymentStatus: 'paid' },
  }), true);
});

test('denies unauthorized subscription cancellation on another account', () => {
  assert.notEqual(authorize({
    user: { id: 'user-2', role: 'student' },
    action: 'cancel',
    resource: { id: 'subscription-1', userId: 'user-1', status: 'active' },
  }), true);
});

test('denies modification of protected subscription fields', () => {
  assert.notEqual(authorize({
    user: { id: 'user-1', role: 'student' },
    action: 'update',
    resource: { id: 'subscription-1', userId: 'user-1' },
    input: {
      userId: 'user-2',
      paymentStatus: 'paid',
      providerSubscriptionId: 'forged-id',
    },
  }), true);
});

test('denies unknown actions', () => {
  assert.notEqual(authorize({
    user: { id: 'admin-1', role: 'admin' },
    action: 'bypass-security',
    resource: { id: 'subscription-1', userId: 'user-1' },
  }), true);
});
