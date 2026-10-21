'use strict';
/**
 * MedOrbits -- Payment Test Fixtures
 *
 * File: tests/fixtures/payments.js
 *
 * Purpose:
 *   Synthetic payment, refund, webhook, idempotency, concurrency,
 *   and security test data.
 *
 * Security:
 *   - No live payment credentials or operations.
 *   - Provider identifiers and signatures are synthetic.
 *   - Client payloads exclude server-managed fields by default.
 *   - Never trust client-supplied amounts, ownership, status, provider
 *     references, or webhook verification results.
 *   - Webhook signatures and idempotency must be enforced by application code.
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
  processingStatus: 'received',
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
 * @param {string} label
 */
function assertPlainObject(value, label) {
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
 * Recursively clone arrays and plain objects.
 *
 * @param {*} value
 * @returns {*}
 */
function clone(value) {
  if (Array.isArray(value)) {
    return value.map(clone);
  }
  if (value !== null && typeof value === 'object') {
    assertPlainObject(value, 'Fixture values');
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clone(item)])
    );
  }
  return value;
}
/**
 * Validate a non-empty string.
 *
 * @param {*} value
 * @param {string} label
 */
function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}
/**
 * Validate a non-negative safe integer in minor currency units.
 *
 * @param {*} value
 * @param {string} label
 */
function assertNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(
      `${label} must be a non-negative safe integer in minor currency units`
    );
  }
}
/**
 * Validate a currency code.
 *
 * This validates the expected format, not whether a currency is supported
 * by a particular payment provider.
 *
 * @param {*} value
 * @param {string} label
 */
function assertCurrency(value, label = 'Currency') {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) {
    throw new TypeError(`${label} must be a three-letter uppercase code`);
  }
}
/**
 * Create a synthetic payment record.
 *
 * INR 100.00 is represented by amountMinor: 10000.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createPayment(overrides = {}) {
  assertPlainObject(overrides, 'Payment overrides');
  const payment = {
    ...clone(DEFAULT_PAYMENT),
    ...clone(overrides),
  };
  if (overrides.metadata !== undefined) {
    assertPlainObject(overrides.metadata, 'Payment metadata');
    payment.metadata = clone(overrides.metadata);
  }
  assertNonNegativeInteger(payment.amountMinor, 'Payment amountMinor');
  assertCurrency(payment.currency, 'Payment currency');
  return payment;
}
/**
 * Create a client-submittable payment initiation payload.
 *
 * The default payload excludes server-managed payment state. Overrides
 * remain available for negative tests, so the server must enforce its own
 * request-field allowlist.
 *
 * The server must calculate the payable amount from trusted pricing data.
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
 * Create multiple payments with unique generated identifiers.
 *
 * @param {number} [count=3]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createPaymentSet(count = 3, overrides = {}) {
  if (!Number.isInteger(count) || count < 0 || count > 1000) {
    throw new RangeError(
      'Payment count must be an integer from 0 to 1000'
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
      ...commonOverrides,
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
 * Create a payment belonging to another synthetic user.
 *
 * Useful for IDOR and cross-user payment access tests.
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
  return createPayment({
    ...clone(overrides),
    id: 'payment_test_foreign_0001',
    paymentNumber: 'MO-PAY-TEST-FOREIGN-0001',
    userId,
    applicationId: 'app_test_foreign_0001',
    providerPaymentId: 'provider_payment_test_foreign_0001',
    providerOrderId: 'provider_order_test_foreign_0001',
    idempotencyKey: 'idem_test_payment_foreign_0001',
  });
}
/**
 * Create a payment with a selected status.
 *
 * This helper does not validate permitted workflow transitions.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createPaymentWithStatus(status, overrides = {}) {
  if (!PAYMENT_STATUS_VALUES.includes(status)) {
    throw new RangeError(`Unsupported payment status: ${status}`);
  }
  assertPlainObject(overrides, 'Payment status overrides');
  return createPayment({
    ...clone(overrides),
    status,
  });
}
/**
 * Create a deliberately hostile payment payload for mass-assignment tests.
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
    providerPaymentId: 'attacker_provider_payment',
    providerOrderId: 'attacker_provider_order',
    paidAt: '2026-10-01T09:00:00.000Z',
    isAdmin: true,
    role: 'admin',
    ...clone(overrides),
  };
}
/**
 * Create a synthetic refund record.
 *
 * The application must independently validate the refundable balance.
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
  assertNonNegativeInteger(refund.amountMinor, 'Refund amountMinor');
  assertCurrency(refund.currency, 'Refund currency');
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
  if (!REFUND_STATUS_VALUES.includes(status)) {
    throw new RangeError(`Unsupported refund status: ${status}`);
  }
  assertPlainObject(overrides, 'Refund status overrides');
  return createRefund({
    ...clone(overrides),
    status,
  });
}
/**
 * Create multiple refunds with unique generated identifiers.
 *
 * @param {number} [count=2]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createRefundSet(count = 2, overrides = {}) {
  if (!Number.isInteger(count) || count < 0 || count > 1000) {
    throw new RangeError(
      'Refund count must be an integer from 0 to 1000'
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
      ...commonOverrides,
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
 * signatureVerified defaults to false. This field is fixture metadata,
 * never proof of cryptographic verification in production.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createWebhookEvent(overrides = {}) {
  assertPlainObject(overrides, 'Webhook event overrides');
  const event = {
    ...clone(DEFAULT_WEBHOOK_EVENT),
    ...clone(overrides),
  };
  if (overrides.payload !== undefined) {
    assertPlainObject(overrides.payload, 'Webhook payload');
    event.payload = clone(overrides.payload);
  }
  return event;
}
/**
 * Create a synthetic successful-payment webhook event.
 *
 * This does not generate a valid provider signature.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createSuccessfulPaymentWebhook(overrides = {}) {
  assertPlainObject(overrides, 'Successful webhook overrides');
  const paymentOverrides = overrides.payment === undefined
    ? {}
    : overrides.payment;
  const eventOverrides = overrides.event === undefined
    ? {}
    : overrides.event;
  assertPlainObject(paymentOverrides, 'Successful webhook payment overrides');
  assertPlainObject(eventOverrides, 'Successful webhook event overrides');
  const payment = createPayment({
    ...clone(paymentOverrides),
    status: PAYMENT_STATUSES.SUCCEEDED,
  });
  const eventId = overrides.eventId ||
    'provider_event_success_test_0001';
  return createWebhookEvent({
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
    ...clone(eventOverrides),
  });
}
/**
 * Create two deliveries of the same provider event.
 *
 * Both deliveries intentionally share the provider event ID and payload.
 * Their local delivery record IDs differ.
 *
 * @param {object} [overrides={}]
 * @returns {{first: object, duplicate: object}}
 */
function createDuplicateWebhookEvents(overrides = {}) {
  assertPlainObject(overrides, 'Duplicate webhook overrides');
  const eventId = overrides.eventId ||
    'provider_event_duplicate_test_0001';
  const eventOverrides = overrides.event === undefined
    ? {}
    : overrides.event;
  assertPlainObject(eventOverrides, 'Duplicate webhook event overrides');
  const first = createWebhookEvent({
    ...clone(eventOverrides),
    id: 'webhook_test_delivery_0001',
    eventId,
  });
  const duplicate = createWebhookEvent({
    ...clone(first),
    id: 'webhook_test_delivery_0002',
    eventId: first.eventId,
    payload: clone(first.payload),
  });
  return {
    first,
    duplicate,
  };
}
/**
 * Create a deliberately invalid webhook event.
 *
 * Useful for signature, unknown-payment, and payload-mismatch tests.
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
 * Create a synthetic payment concurrency scenario.
 *
 * Two refund requests each seek INR 60 against a successful INR 100
 * payment. The combined requested amount is INR 120, so the application
 * must prevent successful refunds from exceeding INR 100.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createConcurrentPaymentScenario(overrides = {}) {
  assertPlainObject(overrides, 'Concurrency scenario overrides');
  const paymentOverrides = overrides.payment === undefined
    ? {}
    : overrides.payment;
  const firstRefundOverrides = overrides.firstRefund === undefined
    ? {}
    : overrides.firstRefund;
  const secondRefundOverrides = overrides.secondRefund === undefined
    ? {}
    : overrides.secondRefund;
  assertPlainObject(paymentOverrides, 'Concurrency payment overrides');
  assertPlainObject(firstRefundOverrides, 'First refund overrides');
  assertPlainObject(secondRefundOverrides, 'Second refund overrides');
  const payment = createPayment({
    ...clone(paymentOverrides),
    status: PAYMENT_STATUSES.SUCCEEDED,
  });
  const requestedRefunds = [
    createRefund({
      ...clone(firstRefundOverrides),
      id: 'refund_test_concurrent_0001',
      paymentId: payment.id,
      userId: payment.userId,
      currency: payment.currency,
      amountMinor: firstRefundOverrides.amountMinor === undefined
        ? 6000
        : firstRefundOverrides.amountMinor,
    }),
    createRefund({
      ...clone(secondRefundOverrides),
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
    (total, refund) => total + refund.amountMinor,
    0
  );
  return {
    payment,
    requestedRefunds,
    totalRequestedRefundMinor,
    paymentAmountMinor: payment.amountMinor,
    // Assert in the integration test that successful refunds never exceed
    // the payment amount, even when refund requests execute concurrently.
  };
}
/**
 * Create a payment initiation idempotency scenario.
 *
 * The two requests have the same idempotency key and payload by default.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createIdempotencyScenario(overrides = {}) {
  assertPlainObject(overrides, 'Idempotency scenario overrides');
  const payloadOverrides = overrides.payload === undefined
    ? {}
    : overrides.payload;
  assertPlainObject(payloadOverrides, 'Idempotency payload overrides');
  const idempotencyKey = overrides.idempotencyKey ||
    'idem_test_repeated_request_0001';
  const payload = createPaymentPayload({
    ...clone(payloadOverrides),
    idempotencyKey,
  });
  return {
    idempotencyKey,
    firstRequest: clone(payload),
    repeatedRequest: clone(payload),
    expectedSingleLogicalPayment: true,
  };
}
module.exports = {
  PAYMENT_STATUSES,
  REFUND_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_PURPOSES,
  WEBHOOK_EVENT_TYPES,
  PAYMENT_STATUS_VALUES,
  REFUND_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
  PAYMENT_PURPOSE_VALUES,
  WEBHOOK_EVENT_TYPE_VALUES,
  DEFAULT_PAYMENT,
  DEFAULT_REFUND,
  DEFAULT_WEBHOOK_EVENT,
  createPayment,
  createPaymentPayload,
  createPaymentSet,
  createForeignPayment,
  createPaymentWithStatus,
  createMassAssignmentPayload,
  createRefund,
  createRefundWithStatus,
  createRefundSet,
  createWebhookEvent,
  createSuccessfulPaymentWebhook,
  createDuplicateWebhookEvents,
  createInvalidWebhookEvent,
  createConcurrentPaymentScenario,
  createIdempotencyScenario,
};