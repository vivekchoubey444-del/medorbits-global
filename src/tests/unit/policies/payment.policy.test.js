
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const policy = require('../../../src/policies/payment.policy');
const authorize = policy.authorize || policy.canAccess || policy;

test('exports an authorization function', () => {
  assert.equal(typeof authorize, 'function');
});

test('denies unauthenticated access to payment records', () => {
  assert.notEqual(authorize({
    user: null,
    action: 'read',
    resource: { id: 'payment-1', userId: 'user-1' },
  }), true);
});

test('allows a payment owner to read their payment when permitted', () => {
  assert.equal(authorize({
    user: { id: 'user-1', role: 'student' },
    action: 'read',
    resource: { id: 'payment-1', userId: 'user-1' },
  }), true);
});

test('denies another user access to a private payment', () => {
  assert.notEqual(authorize({
    user: { id: 'user-2', role: 'student' },
    action: 'read',
    resource: { id: 'payment-1', userId: 'user-1' },
  }), true);
});

test('denies clients from setting payment status to successful', () => {
  assert.notEqual(authorize({
    user: { id: 'user-1', role: 'student' },
    action: 'update',
    resource: { id: 'payment-1', userId: 'user-1', status: 'pending' },
    input: { status: 'succeeded', paid: true },
  }), true);
});

test('denies unauthorized refunds', () => {
  assert.notEqual(authorize({
    user: { id: 'user-2', role: 'student' },
    action: 'refund',
    resource: { id: 'payment-1', userId: 'user-1', status: 'succeeded' },
  }), true);
});

test('denies modification of protected payment fields', () => {
  assert.notEqual(authorize({
    user: { id: 'user-1', role: 'student' },
    action: 'update',
    resource: { id: 'payment-1', userId: 'user-1' },
    input: {
      userId: 'user-2',
      amount: 1,
      currency: 'USD',
      providerTransactionId: 'forged-transaction',
    },
  }), true);
});

test('denies unknown actions', () => {
  assert.notEqual(authorize({
    user: { id: 'admin-1', role: 'admin' },
    action: 'bypass-security',
    resource: { id: 'payment-1', userId: 'user-1' },
  }), true);
});
