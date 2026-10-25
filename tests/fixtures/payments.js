
'use strict';

/**
 * MedOrbits -- Payment Test Fixtures
 *
 * File: tests/fixtures/payments.js
 *
 * Purpose:
 *   Synthetic payment, refund, webhook, idempotency, concurrency,
 *   authorization, and security test data.
 *
 * Security:
 *   - No live payment credentials or payment operations.
 *   - Provider identifiers and signatures are synthetic.
 *   - Client payloads exclude server-managed fields by default.
 *   - Never trust client-supplied amounts, ownership, status, provider
 *     references, or webhook verification results.
 *   - Webhook verification and idempotency must be enforced by the
 *     application and persistent storage.
 *   - Fixtures do not simulate a real payment provider.
 */

const PAYMENT_STATUSES = Object.freeze({
  CREATED: 'created',
  PENDING: 'pending',
  PROCESSING: 'processing',
  AUTHORIZED: 'authorized',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  PARTIALLY_REFUNDED: 'partially_refunded',
  REFUNDED: 'refunded',
});

const REFUND_STATUSES = Object.freeze({
  REQUESTED: 'requested',
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

const PAYMENT_METHODS = Object.freeze({
  CARD: 'card',
  UPI: 'upi',
  NET_BANKING: 'net_banking',
  WALLET: 'wallet',
  BANK_TRANSFER: 'bank_transfer',
  OTHER: 'other',
});

const PAYMENT_PURPOSES = Object.freeze({
  CONSULTATION: 'consultation',
  APPLICATION_FEE: 'application_fee',
  COUNSELLING_FEE: 'counselling_fee',
  SUBSCRIPTION: 'subscription',
  DOCUMENT_SERVICE: 'document_service',
  OTHER: 'other',
});

const WEBHOOK_EVENT_TYPES = Object.freeze({
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_PENDING: 'payment.pending',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_CANCELLED: 'payment.cancelled',
  REFUND_CREATED: 'refund.created',
  REFUND_SUCCEEDED: 'refund.succeeded',
  REFUND_FAILED: 'refund.failed',
});

const WEBHOOK_PROCESSING_STATUSES = Object.freeze({
  RECEIVED: 'received',
  PROCESSING: 'processing',
  PROCESSED: 'processed',
  FAILED: 'failed',
  IGNORED: 'ignored',
});

const PAYMENT_STATUS_VALUES = Object.freeze(
  Object.values(PAYMENT_STATUSES)
);

const REFUND_STATUS_VALUES = Object.freeze(
  Object.values(REFUND_STATUSES)
);

const PAYMENT_METHOD_VALUES = Object.freeze(
  Object.values(PAYMENT_METHODS)
);

const PAYMENT_PURPOSE_VALUES = Object.freeze(
  Object.values(PAYMENT_PURPOSES)
);

const WEBHOOK_EVENT_TYPE_VALUES = Object.freeze(
  Object.values(WEBHOOK_EVENT_TYPES)
);

const WEBHOOK_PROCESSING_STATUS_VALUES = Object.freeze(
  Object.values(WEBHOOK_PROCESSING_STATUSES)
);

const PAYMENT_SERVER_MANAGED_FIELDS = Object.freeze([
  'id',
  'paymentNumber',
  'userId',
  'amountMinor',
  'status',
  'provider',
  'providerPaymentId',
  'providerOrderId',
  'paidAt',
  'authorizedAt',
  'failedAt',
  'cancelledAt',
  'createdAt',
  'updatedAt',
]);

const REFUND_SERVER_MANAGED_FIELDS = Object.freeze([
  'id',
  'refundNumber',
  'paymentId',
  'userId',
  'status',
  'provider',
  'providerRefundId',
  'processedAt',
  'createdAt',
  'updatedAt',
]);

const MAX_CLONE_DEPTH = 50;
const MAX_FIXTURE_COUNT = 1000;

const FORBIDDEN_OBJECT_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

const DEFAULT_PAYMENT = Object.freeze({
  id: 'payment_test_0001',
  paymentNumber: 'MO-PAY-TEST-0001',
  userId: 'user_test_0001',
  applicationId: 'app_test_0001',
  subscriptionId: null,
  purpose: PAYMENT_PURPOSES.CONSULTATION,
  amountMinor: 10000,
  currency: 'INR',
  status: PAYMENT_STATUSES.PENDING,
  paymentMethod: PAYMENT_METHODS.UPI,
  provider: 'test_provider',
  providerPaymentId: 'provider_payment_test_0001',
  providerOrderId: 'provider_order_test_0001',
  idempotencyKey: 'idem_test_payment_0001',
  description: 'Synthetic payment fixture.',
  metadata: Object.freeze({
    testFixture: true,
  }),
  failureCode: null,
  failureMessage: null,
  authorizedAt: null,
  paidAt: null,
  failedAt: null,
  cancelledAt: null,
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
});

const DEFAULT_REFUND = Object.freeze({
  id: 'refund_test_0001',
  refundNumber: 'MO-REF-TEST-0001',
  paymentId: DEFAULT_PAYMENT.id,
  userId: DEFAULT_PAYMENT.userId,
  amountMinor: 10000,
  currency: 'INR',
  status: REFUND_STATUSES.REQUESTED,
  provider: 'test_provider',
  providerRefundId: 'provider_refund_test_0001',
  idempotencyKey: 'idem_test_refund_0001',
  reason: 'Synthetic refund fixture.',
  failureCode: null,
  failureMessage: null,
  requestedAt: '2026-10-02T09:00:00.000Z',
  processedAt: null,
  createdAt: '2026-10-02T09:00:00.000Z',
  updatedAt: '2026-10-02T09:00:00.000Z',
});

const DEFAULT_WEBHOOK_EVENT = Object.freeze({
  id: 'webhook_test_0001',
  eventId: 'provider_event_test_0001',
  provider: 'test_provider',
  eventType: WEBHOOK_EVENT_TYPES.PAYMENT_SUCCEEDED,
  paymentId: DEFAULT_PAYMENT.id,
  providerPaymentId: DEFAULT_PAYMENT.providerPaymentId,
  payload: Object.freeze({
    id: 'provider_event_test_0001',
    type: WEBHOOK_EVENT_TYPES.PAYMENT_SUCCEEDED,
    data: Object.freeze({
      paymentId: DEFAULT_PAYMENT.providerPaymentId,
      amountMinor: DEFAULT_PAYMENT.amountMinor,
      currency: DEFAULT_PAYMENT.currency,
      status: PAYMENT_STATUSES.SUCCEEDED,
    }),
  }),
  signature: 'synthetic-invalid-signature-for-tests-only',
  signatureVerified: false,
  processingStatus: WEBHOOK_PROCESSING_STATUSES.RECEIVED,
  attempts: 0,
  processedAt: null,
  lastError: null,
  receivedAt: '2026-10-02T10:00:00.000Z',
  createdAt: '2026-10-02T10:00:00.000Z',
});

/**
 * Validate a plain object.
 *
 * @param {*} value
 * @param {string} [label='Value']
 * @returns {void}
 */
function assertPlainObject(value, label = 'Value') {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new TypeError(`${label} must be a plain object`);
  }

  const prototype = Object.getPrototypeOf(value);

  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object`);
  }
}

/**
 * Validate a non-empty string.
 *
 * @param {*} value
 * @param {string} label
 * @returns {void}
 */
function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

/**
 * Validate an optional nullable string.
 *
 * @param {*} value
 * @param {string} label
 * @returns {void}
 */
function assertOptionalString(value, label) {
  if (value !== null && value !== undefined) {
    assertNonEmptyString(value, label);
  }
}

/**
 * Validate a boolean.
 *
 * @param {*} value
 * @param {string} label
 * @returns {void}
 */
function assertBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be a boolean`);
  }
}

/**
 * Validate a non-negative safe integer.
 * Monetary amounts are expressed in minor currency units.
 *
 * @param {*} value
 * @param {string} label
 * @returns {void}
 */
function assertNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      `${label} must be a non-negative safe integer in minor currency units`
    );
  }
}

/**
 * Validate a positive safe integer.
 *
 * @param {*} value
 * @param {string} label
 * @returns {void}
 */
function assertPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
}

/**
 * Validate the format of a three-letter uppercase currency code.
 * This does not confirm provider support.
 *
 * @param {*} value
 * @param {string} [label='Currency']
 * @returns {void}
 */
function assertCurrency(value, label = 'Currency') {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) {
    throw new TypeError(
      `${label} must be a three-letter uppercase code`
    );
  }
}

/**
 * Validate an allowed enum value.
 *
 * @param {*} value
 * @param {string[]} allowedValues
 * @param {string} label
 * @returns {void}
 */
function assertAllowedValue(value, allowedValues, label) {
  if (!allowedValues.includes(value)) {
    throw new RangeError(`Unsupported ${label}: ${String(value)}`);
  }
}

/**
 * Validate an optional ISO UTC timestamp.
 *
 * @param {*} value
 * @param {string} label
 * @returns {void}
 */
function assertOptionalUtcTimestamp(value, label) {
  if (value === null || value === undefined) {
    return;
  }

  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new TypeError(`${label} must be a valid UTC ISO timestamp`);
  }
}

/**
 * Safely clone JSON-like fixture values.
 *
 * Rejects cycles, accessors, dangerous keys, sparse arrays, unsupported
 * values, non-finite numbers, and excessive nesting.
 *
 * @param {*} value
 * @param {WeakSet<object>} [ancestors]
 * @param {number} [depth=0]
 * @returns {*}
 */
function clone(value, ancestors = new WeakSet(), depth = 0) {
  if (depth > MAX_CLONE_DEPTH) {
    throw new TypeError('Fixture values exceed the maximum clone depth');
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Fixture numbers must be finite');
    }

    return value;
  }

  if (
    typeof value === 'undefined' ||
    typeof value === 'function' ||
    typeof value === 'symbol' ||
    typeof value === 'bigint'
  ) {
    throw new TypeError(
      'Fixture values cannot contain undefined, functions, symbols, or bigints'
    );
  }

  if (typeof value !== 'object') {
    throw new TypeError('Unsupported fixture value');
  }

  if (ancestors.has(value)) {
    throw new TypeError('Fixture values cannot contain circular references');
  }

  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const result = [];

      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new TypeError('Fixture arrays cannot contain empty slots');
        }

        const descriptor = Object.getOwnPropertyDescriptor(
          value,
          String(index)
        );

        if (
          !descriptor ||
          !Object.prototype.hasOwnProperty.call(descriptor, 'value')
        ) {
          throw new TypeError('Fixture arrays cannot contain accessors');
        }

        result.push(clone(descriptor.value, ancestors, depth + 1));
      }

      const extraKeys = Reflect.ownKeys(value).filter((key) => {
        if (key === 'length') {
          return false;
        }

        return !(
          typeof key === 'string' &&
          /^(0|[1-9]\d*)$/.test(key) &&
          Number(key) < value.length
        );
      });

      if (extraKeys.length > 0) {
        throw new TypeError(
          'Fixture arrays cannot contain custom properties'
        );
      }

      return result;
    }

    assertPlainObject(value, 'Fixture values');

    const result = Object.create(null);

    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') {
        throw new TypeError('Fixture object keys must be strings');
      }

      if (FORBIDDEN_OBJECT_KEYS.has(key)) {
        throw new TypeError(`Unsafe fixture object key: ${key}`);
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key);

      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        throw new TypeError(
          `Fixture properties cannot be accessors: ${key}`
        );
      }

      result[key] = clone(descriptor.value, ancestors, depth + 1);
    }

    return result;
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Merge a plain-object override with defaults.
 *
 * @param {object} defaults
 * @param {*} overrides
 * @param {string} label
 * @returns {object}
 */
function mergeObject(defaults, overrides, label) {
  if (overrides === undefined) {
    return clone(defaults);
  }

  assertPlainObject(overrides, label);

  return {
    ...clone(defaults),
    ...clone(overrides),
  };
}

/**
 * Validate common payment fields.
 *
 * @param {object} payment
 * @returns {void}
 */
function validatePayment(payment) {
  assertNonEmptyString(payment.id, 'Payment ID');
  assertNonEmptyString(payment.paymentNumber, 'Payment number');
  assertNonEmptyString(payment.userId, 'Payment user ID');
  assertNonEmptyString(payment.purpose, 'Payment purpose');

  assertAllowedValue(
    payment.purpose,
    PAYMENT_PURPOSE_VALUES,
    'payment purpose'
  );

  assertAllowedValue(
    payment.status,
    PAYMENT_STATUS_VALUES,
    'payment status'
  );

  assertAllowedValue(
    payment.paymentMethod,
    PAYMENT_METHOD_VALUES,
    'payment method'
  );

  assertNonNegativeInteger(payment.amountMinor, 'Payment amountMinor');
  assertCurrency(payment.currency, 'Payment currency');

  for (const field of [
    'applicationId',
    'subscriptionId',
    'provider',
    'providerPaymentId',
    'providerOrderId',
    'idempotencyKey',
    'description',
    'failureCode',
    'failureMessage',
  ]) {
    assertOptionalString(payment[field], `Payment ${field}`);
  }

  for (const field of [
    'authorizedAt',
    'paidAt',
    'failedAt',
    'cancelledAt',
    'createdAt',
    'updatedAt',
  ]) {
    assertOptionalUtcTimestamp(payment[field], `Payment ${field}`);
  }

  assertPlainObject(payment.metadata, 'Payment metadata');
}

/**
 * Create a synthetic payment record.
 *
 * INR 100.00 is represented as amountMinor: 10000.
 * This validates field formats, not payment transitions or business rules.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createPayment(overrides = {}) {
  assertPlainObject(overrides, 'Payment overrides');

  const input = clone(overrides);

  const payment = {
    ...clone(DEFAULT_PAYMENT),
    ...input,
  };

  payment.metadata = mergeObject(
    DEFAULT_PAYMENT.metadata,
    input.metadata,
    'Payment metadata'
  );

  validatePayment(payment);

  return payment;
}

/**
 * Create a client-submittable payment initiation payload.
 *
 * Server-managed amount, ownership, status, and provider fields are omitted
 * by default. Overrides can intentionally introduce hostile fields for
 * negative security tests.
 *
 * The application must calculate the amount from trusted pricing data.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createPaymentPayload(overrides = {}) {
  assertPlainObject(overrides, 'Payment payload overrides');

  return {
    purpose: DEFAULT_PAYMENT.purpose,
    applicationId: DEFAULT_PAYMENT.applicationId,
    subscriptionId: DEFAULT_PAYMENT.subscriptionId,
    currency: DEFAULT_PAYMENT.currency,
    paymentMethod: DEFAULT_PAYMENT.paymentMethod,
    idempotencyKey: DEFAULT_PAYMENT.idempotencyKey,
    description: DEFAULT_PAYMENT.description,
    ...clone(overrides),
  };
}

/**
 * Create multiple payments with unique generated identities.
 *
 * @param {number} [count=3]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createPaymentSet(count = 3, overrides = {}) {
  if (
    !Number.isInteger(count) ||
    count < 0 ||
    count > MAX_FIXTURE_COUNT
  ) {
    throw new RangeError(
      `Payment count must be an integer from 0 to ${MAX_FIXTURE_COUNT}`
    );
  }

  assertPlainObject(overrides, 'Payment set overrides');

  const commonOverrides = clone(overrides);

  for (const field of [
    'id',
    'paymentNumber',
    'userId',
    'applicationId',
    'providerPaymentId',
    'providerOrderId',
    'idempotencyKey',
  ]) {
    delete commonOverrides[field];
  }

  return Array.from({ length: count }, (_, index) => {
    const sequence = String(index + 1).padStart(4, '0');

    return createPayment({
      ...clone(commonOverrides),
      id: `payment_test_${sequence}`,
      paymentNumber: `MO-PAY-TEST-${sequence}`,
      userId: `user_test_${sequence}`,
      applicationId: `app_test_${sequence}`,
      providerPaymentId: `provider_payment_test_${sequence}`,
      providerOrderId: `provider_order_test_${sequence}`,
      idempotencyKey: `idem_test_payment_${sequence}`,
    });
  });
}

/**
 * Create a payment owned by another synthetic user.
 *
 * @param {string} [userId='user_test_foreign']
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createForeignPayment(
  userId = 'user_test_foreign',
  overrides = {}
) {
  assertNonEmptyString(userId, 'Foreign payment user ID');
  assertPlainObject(overrides, 'Foreign payment overrides');

  const input = clone(overrides);

  return createPayment({
    ...input,
    id: input.id || 'payment_test_foreign_0001',
    paymentNumber: input.paymentNumber ||
      'MO-PAY-TEST-FOREIGN-0001',
    applicationId: input.applicationId || 'app_test_foreign_0001',
    providerPaymentId: input.providerPaymentId ||
      'provider_payment_test_foreign_0001',
    providerOrderId: input.providerOrderId ||
      'provider_order_test_foreign_0001',
    idempotencyKey: input.idempotencyKey ||
      'idem_test_payment_foreign_0001',
    userId,
  });
}

/**
 * Create a payment with a selected status.
 *
 * This checks that the status is recognized, not that a transition
 * to that status is permitted.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createPaymentWithStatus(status, overrides = {}) {
  assertAllowedValue(status, PAYMENT_STATUS_VALUES, 'payment status');
  assertPlainObject(overrides, 'Payment status overrides');

  return createPayment({
    ...clone(overrides),
    status,
  });
}

/**
 * Create a deliberately hostile payload for mass-assignment tests.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createMassAssignmentPayload(overrides = {}) {
  assertPlainObject(overrides, 'Mass-assignment overrides');

  return {
    ...createPaymentPayload(),
    id: 'payment_test_attacker_controlled',
    paymentNumber: 'MO-PAY-ATTACKER-CONTROLLED',
    userId: 'user_test_attacker',
    amountMinor: 1,
    status: PAYMENT_STATUSES.SUCCEEDED,
    provider: 'attacker_provider',
    providerPaymentId: 'attacker_provider_payment',
    providerOrderId: 'attacker_provider_order',
    paidAt: '2026-10-01T09:00:00.000Z',
    isAdmin: true,
    role: 'admin',
    ...clone(overrides),
  };
}

/**
 * Validate common refund fields.
 *
 * @param {object} refund
 * @returns {void}
 */
function validateRefund(refund) {
  assertNonEmptyString(refund.id, 'Refund ID');
  assertNonEmptyString(refund.refundNumber, 'Refund number');
  assertNonEmptyString(refund.paymentId, 'Refund payment ID');
  assertNonEmptyString(refund.userId, 'Refund user ID');

  assertAllowedValue(refund.status, REFUND_STATUS_VALUES, 'refund status');

  assertNonNegativeInteger(refund.amountMinor, 'Refund amountMinor');
  assertCurrency(refund.currency, 'Refund currency');

  for (const field of [
    'provider',
    'providerRefundId',
    'idempotencyKey',
    'reason',
    'failureCode',
    'failureMessage',
  ]) {
    assertOptionalString(refund[field], `Refund ${field}`);
  }

  for (const field of [
    'requestedAt',
    'processedAt',
    'createdAt',
    'updatedAt',
  ]) {
    assertOptionalUtcTimestamp(refund[field], `Refund ${field}`);
  }
}

/**
 * Create a synthetic refund record.
 *
 * The application must independently validate refundable balance,
 * ownership, payment state, and provider response.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createRefund(overrides = {}) {
  assertPlainObject(overrides, 'Refund overrides');

  const refund = {
    ...clone(DEFAULT_REFUND),
    ...clone(overrides),
  };

  validateRefund(refund);

  return refund;
}

/**
 * Create a refund with a selected status.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createRefundWithStatus(status, overrides = {}) {
  assertAllowedValue(status, REFUND_STATUS_VALUES, 'refund status');
  assertPlainObject(overrides, 'Refund status overrides');

  return createRefund({
    ...clone(overrides),
    status,
  });
}

/**
 * Create multiple refunds with unique identities.
 *
 * Payment and user references are shared unless overridden, allowing
 * multiple refunds to be associated with one payment.
 *
 * @param {number} [count=2]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createRefundSet(count = 2, overrides = {}) {
  if (
    !Number.isInteger(count) ||
    count < 0 ||
    count > MAX_FIXTURE_COUNT
  ) {
    throw new RangeError(
      `Refund count must be an integer from 0 to ${MAX_FIXTURE_COUNT}`
    );
  }

  assertPlainObject(overrides, 'Refund set overrides');

  const commonOverrides = clone(overrides);

  for (const field of [
    'id',
    'refundNumber',
    'providerRefundId',
    'idempotencyKey',
  ]) {
    delete commonOverrides[field];
  }

  return Array.from({ length: count }, (_, index) => {
    const sequence = String(index + 1).padStart(4, '0');

    return createRefund({
      ...clone(commonOverrides),
      id: `refund_test_${sequence}`,
      refundNumber: `MO-REF-TEST-${sequence}`,
      providerRefundId: `provider_refund_test_${sequence}`,
      idempotencyKey: `idem_test_refund_${sequence}`,
    });
  });
}

/**
 * Create a synthetic webhook event.
 *
 * signatureVerified is test metadata only. It is not a substitute for
 * cryptographic verification of the raw request body.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createWebhookEvent(overrides = {}) {
  assertPlainObject(overrides, 'Webhook event overrides');

  const input = clone(overrides);

  const event = {
    ...clone(DEFAULT_WEBHOOK_EVENT),
    ...input,
  };

  event.payload = input.payload === undefined
    ? clone(DEFAULT_WEBHOOK_EVENT.payload)
    : clone(input.payload);

  assertPlainObject(event.payload, 'Webhook payload');
  assertNonEmptyString(event.id, 'Webhook local ID');
  assertNonEmptyString(event.eventId, 'Webhook provider event ID');
  assertNonEmptyString(event.provider, 'Webhook provider');

  assertAllowedValue(
    event.eventType,
    WEBHOOK_EVENT_TYPE_VALUES,
    'webhook event type'
  );

  assertAllowedValue(
    event.processingStatus,
    WEBHOOK_PROCESSING_STATUS_VALUES,
    'webhook processing status'
  );

  assertOptionalString(event.paymentId, 'Webhook paymentId');
  assertOptionalString(event.providerPaymentId, 'Webhook providerPaymentId');
  assertOptionalString(event.signature, 'Webhook signature');
  assertOptionalString(event.lastError, 'Webhook lastError');

  assertBoolean(event.signatureVerified, 'Webhook signatureVerified');
  assertNonNegativeInteger(event.attempts, 'Webhook attempts');

  for (const field of ['processedAt', 'receivedAt', 'createdAt']) {
    assertOptionalUtcTimestamp(event[field], `Webhook ${field}`);
  }

  return event;
}

/**
 * Create a synthetic successful-payment webhook event.
 *
 * The event intentionally uses an invalid synthetic signature.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createSuccessfulPaymentWebhook(overrides = {}) {
  assertPlainObject(overrides, 'Successful webhook overrides');

  const input = clone(overrides);

  const paymentOverrides = input.payment === undefined
    ? {}
    : input.payment;

  const eventOverrides = input.event === undefined
    ? {}
    : input.event;

  assertPlainObject(paymentOverrides, 'Successful webhook payment overrides');
  assertPlainObject(eventOverrides, 'Successful webhook event overrides');

  const payment = createPayment({
    ...paymentOverrides,
    status: PAYMENT_STATUSES.SUCCEEDED,
  });

  const eventId = input.eventId || 'provider_event_success_test_0001';

  const event = createWebhookEvent({
    id: 'webhook_test_success_0001',
    eventId,
    eventType: WEBHOOK_EVENT_TYPES.PAYMENT_SUCCEEDED,
    paymentId: payment.id,
    providerPaymentId: payment.providerPaymentId,
    payload: {
      id: eventId,
      type: WEBHOOK_EVENT_TYPES.PAYMENT_SUCCEEDED,
      data: {
        paymentId: payment.providerPaymentId,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        status: PAYMENT_STATUSES.SUCCEEDED,
      },
    },
    signature: 'synthetic-invalid-signature-for-tests-only',
    signatureVerified: false,
    ...eventOverrides,
  });

  return {
    ...event,
    payment,
  };
}

/**
 * Create two deliveries of the same provider event.
 *
 * Provider event IDs and payloads are shared, while local delivery IDs
 * differ. Use this for webhook deduplication tests.
 *
 * @param {object} [overrides={}]
 * @returns {{first: object, duplicate: object}}
 */
function createDuplicateWebhookEvents(overrides = {}) {
  assertPlainObject(overrides, 'Duplicate webhook overrides');

  const input = clone(overrides);
  const eventId = input.eventId ||
    'provider_event_duplicate_test_0001';

  const eventOverrides = input.event === undefined
    ? {}
    : input.event;

  assertPlainObject(eventOverrides, 'Duplicate webhook event overrides');

  const first = createWebhookEvent({
    ...eventOverrides,
    id: 'webhook_test_delivery_0001',
    eventId,
  });

  const duplicate = createWebhookEvent({
    ...clone(first),
    id: 'webhook_test_delivery_0002',
    eventId: first.eventId,
    payload: clone(first.payload),
  });

  return { first, duplicate };
}

/**
 * Create a deliberately invalid webhook event.
 *
 * Useful for invalid-signature, unknown-payment, and payload-mismatch tests.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createInvalidWebhookEvent(overrides = {}) {
  assertPlainObject(overrides, 'Invalid webhook overrides');

  return createWebhookEvent({
    id: 'webhook_test_invalid_0001',
    eventId: 'provider_event_invalid_test_0001',
    eventType: WEBHOOK_EVENT_TYPES.PAYMENT_SUCCEEDED,
    signature: 'invalid-signature-test-only',
    signatureVerified: false,
    payload: {
      id: 'provider_event_invalid_test_0001',
      type: WEBHOOK_EVENT_TYPES.PAYMENT_SUCCEEDED,
      data: {
        paymentId: 'unknown_provider_payment',
        amountMinor: 1,
        currency: 'INR',
        status: PAYMENT_STATUSES.SUCCEEDED,
      },
    },
    ...clone(overrides),
  });
}

/**
 * Create a synthetic refund concurrency scenario.
 *
 * By default, two refund requests each seek INR 60 against an INR 100
 * successful payment, so the combined requested amount is INR 120.
 *
 * This describes test inputs; it does not execute concurrent operations.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createConcurrentPaymentScenario(overrides = {}) {
  assertPlainObject(overrides, 'Concurrency scenario overrides');

  const input = clone(overrides);

  const paymentOverrides = input.payment === undefined
    ? {}
    : input.payment;

  const firstRefundOverrides = input.firstRefund === undefined
    ? {}
    : input.firstRefund;

  const secondRefundOverrides = input.secondRefund === undefined
    ? {}
    : input.secondRefund;

  assertPlainObject(paymentOverrides, 'Concurrency payment overrides');
  assertPlainObject(firstRefundOverrides, 'First refund overrides');
  assertPlainObject(secondRefundOverrides, 'Second refund overrides');

  const payment = createPayment({
    ...paymentOverrides,
    status: PAYMENT_STATUSES.SUCCEEDED,
  });

  const requestedRefunds = [
    createRefund({
      ...firstRefundOverrides,
      id: 'refund_test_concurrent_0001',
      paymentId: payment.id,
      userId: payment.userId,
      currency: payment.currency,
      amountMinor: firstRefundOverrides.amountMinor === undefined
        ? 6000
        : firstRefundOverrides.amountMinor,
    }),
    createRefund({
      ...secondRefundOverrides,
      id: 'refund_test_concurrent_0002',
      paymentId: payment.id,
      userId: payment.userId,
      currency: payment.currency,
      amountMinor: secondRefundOverrides.amountMinor === undefined
        ? 6000
        : secondRefundOverrides.amountMinor,
    }),
  ];

  const totalRequestedRefundMinor = requestedRefunds.reduce(
    (total, refund) => {
      const nextTotal = total + refund.amountMinor;

      if (!Number.isSafeInteger(nextTotal)) {
        throw new RangeError('Combined refund amount exceeds safe integer range');
      }

      return nextTotal;
    },
    0
  );

  return {
    payment,
    requestedRefunds,
    totalRequestedRefundMinor,
    paymentAmountMinor: payment.amountMinor,
    expectedCombinedRefundWithinPaymentAmount:
      totalRequestedRefundMinor <= payment.amountMinor,
  };
}

/**
 * Create a payment initiation idempotency scenario.
 *
 * Both requests share the same key and payload by default.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createIdempotencyScenario(overrides = {}) {
  assertPlainObject(overrides, 'Idempotency scenario overrides');

  const input = clone(overrides);

  const payloadOverrides = input.payload === undefined
    ? {}
    : input.payload;

  assertPlainObject(payloadOverrides, 'Idempotency payload overrides');

  const idempotencyKey = input.idempotencyKey === undefined
    ? 'idem_test_repeated_request_0001'
    : input.idempotencyKey;

  assertNonEmptyString(idempotencyKey, 'Idempotency key');

  const payload = createPaymentPayload({
    ...payloadOverrides,
    idempotencyKey,
  });

  const repeatedRequest = input.repeatedRequest === undefined
    ? clone(payload)
    : createPaymentPayload(input.repeatedRequest);

  return {
    idempotencyKey,
    firstRequest: clone(payload),
    repeatedRequest,
    expectedSingleLogicalPayment: true,
  };
}

/**
 * Create a synthetic payment authorization scenario.
 *
 * expectedAllowed is a test expectation, not a permission decision.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createPaymentAccessScenario(overrides = {}) {
  assertPlainObject(overrides, 'Payment access scenario overrides');

  const input = clone(overrides);

  const requesterId = input.requesterId === undefined
    ? DEFAULT_PAYMENT.userId
    : input.requesterId;

  const expectedAllowed = input.expectedAllowed === undefined
    ? true
    : input.expectedAllowed;

  assertNonEmptyString(requesterId, 'Payment access requesterId');
  assertBoolean(expectedAllowed, 'Payment access expectedAllowed');

  const payment = input.payment === undefined
    ? createPayment()
    : createPayment(input.payment);

  return {
    requesterId,
    payment,
    expectedAllowed,
  };
}

/**
 * Create a cross-user payment access scenario expected to be denied.
 *
 * The requester and payment owner must differ.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createUnauthorizedPaymentAccessScenario(overrides = {}) {
  assertPlainObject(overrides, 'Unauthorized payment access overrides');

  const input = clone(overrides);

  const requesterId = input.requesterId === undefined
    ? 'user_test_requester'
    : input.requesterId;

  assertNonEmptyString(requesterId, 'Unauthorized payment requesterId');

  const paymentOverrides = input.payment === undefined
    ? {}
    : input.payment;

  assertPlainObject(paymentOverrides, 'Unauthorized payment overrides');

  const ownerId = paymentOverrides.userId === undefined
    ? 'user_test_foreign'
    : paymentOverrides.userId;

  assertNonEmptyString(ownerId, 'Unauthorized payment owner ID');

  if (ownerId === requesterId) {
    throw new TypeError(
      'Unauthorized payment scenario requires a different payment owner'
    );
  }

  return {
    requesterId,
    payment: createForeignPayment(ownerId, paymentOverrides),
    expectedAllowed: false,
  };
}

/**
 * Create a payment payload containing server-managed fields.
 *
 * Use this for allowlist and mass-assignment rejection tests.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createServerManagedFieldsPayload(overrides = {}) {
  assertPlainObject(overrides, 'Server-managed payload overrides');

  const payload = createPaymentPayload();

  for (const field of PAYMENT_SERVER_MANAGED_FIELDS) {
    payload[field] = `attacker_controlled_${field}`;
  }

  return {
    ...payload,
    ...clone(overrides),
  };
}

/**
 * Create a refund payload suitable for negative mass-assignment tests.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createRefundMassAssignmentPayload(overrides = {}) {
  assertPlainObject(overrides, 'Refund mass-assignment overrides');

  return {
    paymentId: DEFAULT_REFUND.paymentId,
    amountMinor: DEFAULT_REFUND.amountMinor,
    currency: DEFAULT_REFUND.currency,
    reason: DEFAULT_REFUND.reason,
    idempotencyKey: DEFAULT_REFUND.idempotencyKey,
    id: 'refund_test_attacker_controlled',
    refundNumber: 'MO-REF-ATTACKER-CONTROLLED',
    userId: 'user_test_attacker',
    status: REFUND_STATUSES.SUCCEEDED,
    provider: 'attacker_provider',
    providerRefundId: 'attacker_provider_refund',
    processedAt: '2026-10-02T09:00:00.000Z',
    role: 'admin',
    isAdmin: true,
    ...clone(overrides),
  };
}

/**
 * Create a synthetic failed payment.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createFailedPayment(overrides = {}) {
  return createPayment({
    id: 'payment_test_failed_0001',
    paymentNumber: 'MO-PAY-TEST-FAILED-0001',
    status: PAYMENT_STATUSES.FAILED,
    failureCode: 'TEST_PAYMENT_FAILURE',
    failureMessage: 'Synthetic payment failure.',
    failedAt: '2026-10-01T09:05:00.000Z',
    ...clone(overrides),
  });
}

/**
 * Create a synthetic successful payment.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createSuccessfulPayment(overrides = {}) {
  return createPayment({
    id: 'payment_test_succeeded_0001',
    paymentNumber: 'MO-PAY-TEST-SUCCEEDED-0001',
    status: PAYMENT_STATUSES.SUCCEEDED,
    authorizedAt: '2026-10-01T09:01:00.000Z',
    paidAt: '2026-10-01T09:02:00.000Z',
    ...clone(overrides),
  });
}

/**
 * Create a synthetic partial-refund payment.
 *
 * The fixture does not calculate actual refund totals. Supply corresponding
 * refund records in the test when testing accounting invariants.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createPartiallyRefundedPayment(overrides = {}) {
  return createPayment({
    id: 'payment_test_partially_refunded_0001',
    paymentNumber: 'MO-PAY-TEST-PARTIAL-0001',
    status: PAYMENT_STATUSES.PARTIALLY_REFUNDED,
    paidAt: '2026-10-01T09:02:00.000Z',
    ...clone(overrides),
  });
}

/**
 * Create a synthetic fully refunded payment.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createRefundedPayment(overrides = {}) {
  return createPayment({
    id: 'payment_test_refunded_0001',
    paymentNumber: 'MO-PAY-TEST-REFUNDED-0001',
    status: PAYMENT_STATUSES.REFUNDED,
    paidAt: '2026-10-01T09:02:00.000Z',
    ...clone(overrides),
  });
}

module.exports = {
  PAYMENT_STATUSES,
  REFUND_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_PURPOSES,
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_PROCESSING_STATUSES,

  PAYMENT_STATUS_VALUES,
  REFUND_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
  PAYMENT_PURPOSE_VALUES,
  WEBHOOK_EVENT_TYPE_VALUES,
  WEBHOOK_PROCESSING_STATUS_VALUES,

  PAYMENT_SERVER_MANAGED_FIELDS,
  REFUND_SERVER_MANAGED_FIELDS,

  DEFAULT_PAYMENT,
  DEFAULT_REFUND,
  DEFAULT_WEBHOOK_EVENT,

  createPayment,
  createPaymentPayload,
  createPaymentSet,
  createForeignPayment,
  createPaymentWithStatus,
  createMassAssignmentPayload,
  createServerManagedFieldsPayload,
  createFailedPayment,
  createSuccessfulPayment,
  createPartiallyRefundedPayment,
  createRefundedPayment,

  createRefund,
  createRefundWithStatus,
  createRefundSet,
  createRefundMassAssignmentPayload,

  createWebhookEvent,
  createSuccessfulPaymentWebhook,
  createDuplicateWebhookEvents,
  createInvalidWebhookEvent,

  createConcurrentPaymentScenario,
  createIdempotencyScenario,
  createPaymentAccessScenario,
  createUnauthorizedPaymentAccessScenario,
};
