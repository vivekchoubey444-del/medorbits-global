'use strict';
/**
 * MedOrbits -- Subscription Test Fixtures
 *
 * File: tests/fixtures/subscriptions.js
 *
 * Synthetic test data for subscription, billing, authorization,
 * entitlement, idempotency, cancellation, and security tests.
 *
 * These fixtures do not initiate payments, renewals, or access grants.
 */
const SUBSCRIPTION_STATUSES = Object.freeze({
  INCOMPLETE: 'incomplete',
  INCOMPLETE_EXPIRED: 'incomplete_expired',
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
  UNPAID: 'unpaid',
  EXPIRED: 'expired',
});
const BILLING_INTERVALS = Object.freeze({
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
  ONE_TIME: 'one_time',
});
const SUBSCRIPTION_PLAN_STATUSES = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
});
const SUBSCRIPTION_STATUSES_VALUES = Object.freeze(
  Object.values(SUBSCRIPTION_STATUSES)
);
const BILLING_INTERVAL_VALUES = Object.freeze(
  Object.values(BILLING_INTERVALS)
);
const SUBSCRIPTION_PLAN_STATUS_VALUES = Object.freeze(
  Object.values(SUBSCRIPTION_PLAN_STATUSES)
);
const DEFAULT_SUBSCRIPTION_PLAN = Object.freeze({
  id: 'plan_test_0001',
  code: 'MO-PLAN-TEST-0001',
  slug: 'test-monthly-plan',
  name: 'Test Monthly Plan',
  description: 'Synthetic subscription plan for automated testing.',
  currency: 'INR',
  amountMinor: 49900,
  billingInterval: BILLING_INTERVALS.MONTHLY,
  intervalCount: 1,
  trialDays: 0,
  features: Object.freeze([
    'priority_support',
    'admission_guidance',
  ]),
  limits: Object.freeze({
    applications: 10,
    documentUploads: 20,
    consultations: 2,
  }),
  status: SUBSCRIPTION_PLAN_STATUSES.ACTIVE,
  isPublic: true,
  createdAt: '2026-10-01T08:30:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
});
const DEFAULT_SUBSCRIPTION = Object.freeze({
  id: 'subscription_test_0001',
  subscriptionNumber: 'MO-SUB-TEST-0001',
  userId: 'user_test_0001',
  planId: DEFAULT_SUBSCRIPTION_PLAN.id,
  status: SUBSCRIPTION_STATUSES.ACTIVE,
  currency: 'INR',
  amountMinor: 49900,
  billingInterval: BILLING_INTERVALS.MONTHLY,
  intervalCount: 1,
  provider: 'test_provider',
  providerCustomerId: 'provider_customer_test_0001',
  providerSubscriptionId: 'provider_subscription_test_0001',
  idempotencyKey: 'idem_test_subscription_0001',
  trialStart: null,
  trialEnd: null,
  currentPeriodStart: '2026-10-01T09:00:00.000Z',
  currentPeriodEnd: '2026-11-01T09:00:00.000Z',
  cancelAtPeriodEnd: false,
  cancelAt: null,
  cancelledAt: null,
  endedAt: null,
  latestPaymentId: 'payment_test_0001',
  metadata: Object.freeze({
    testFixture: true,
  }),
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
});
/**
 * Validate a plain object.
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
function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}
function assertNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(
      `${label} must be a non-negative safe integer`
    );
  }
}
function assertPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
}
function assertCurrency(value, label = 'Currency') {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) {
    throw new TypeError(`${label} must be a three-letter uppercase code`);
  }
}
function assertEnumValue(value, values, label) {
  if (!values.includes(value)) {
    throw new RangeError(`Unsupported ${label}: ${value}`);
  }
}
/**
 * Validate a nested object override.
 */
function mergeObject(base, overrides, label) {
  assertPlainObject(overrides, label);
  return {
    ...clone(base),
    ...clone(overrides),
  };
}
/**
 * Create a synthetic subscription plan.
 */
function createSubscriptionPlan(overrides = {}) {
  assertPlainObject(overrides, 'Subscription plan overrides');
  const plan = {
    ...clone(DEFAULT_SUBSCRIPTION_PLAN),
    ...clone(overrides),
  };
  if (overrides.limits !== undefined) {
    plan.limits = mergeObject(
      DEFAULT_SUBSCRIPTION_PLAN.limits,
      overrides.limits,
      'Plan limits overrides'
    );
  }
  if (overrides.features !== undefined) {
    if (!Array.isArray(overrides.features)) {
      throw new TypeError('Plan features must be an array');
    }
    plan.features = clone(overrides.features);
  }
  assertNonEmptyString(plan.id, 'Plan ID');
  assertNonEmptyString(plan.code, 'Plan code');
  assertNonEmptyString(plan.slug, 'Plan slug');
  assertNonEmptyString(plan.name, 'Plan name');
  assertCurrency(plan.currency, 'Plan currency');
  assertNonNegativeInteger(plan.amountMinor, 'Plan amountMinor');
  assertPositiveInteger(plan.intervalCount, 'Plan intervalCount');
  assertNonNegativeInteger(plan.trialDays, 'Plan trialDays');
  assertEnumValue(
    plan.billingInterval,
    BILLING_INTERVAL_VALUES,
    'billing interval'
  );
  assertEnumValue(
    plan.status,
    SUBSCRIPTION_PLAN_STATUS_VALUES,
    'subscription plan status'
  );
  for (const [name, value] of Object.entries(plan.limits)) {
    if (value !== null) {
      assertNonNegativeInteger(value, `Plan limit "${name}"`);
    }
  }
  return plan;
}
/**
 * Create a synthetic subscription record.
 */
function createSubscription(overrides = {}) {
  assertPlainObject(overrides, 'Subscription overrides');
  const subscription = {
    ...clone(DEFAULT_SUBSCRIPTION),
    ...clone(overrides),
  };
  if (overrides.metadata !== undefined) {
    assertPlainObject(overrides.metadata, 'Subscription metadata');
    subscription.metadata = clone(overrides.metadata);
  }
  assertNonEmptyString(subscription.id, 'Subscription ID');
  assertNonEmptyString(subscription.userId, 'Subscription user ID');
  assertNonEmptyString(subscription.planId, 'Subscription plan ID');
  assertNonNegativeInteger(
    subscription.amountMinor,
    'Subscription amountMinor'
  );
  assertCurrency(subscription.currency, 'Subscription currency');
  assertPositiveInteger(
    subscription.intervalCount,
    'Subscription intervalCount'
  );
  assertEnumValue(
    subscription.status,
    SUBSCRIPTION_STATUSES_VALUES,
    'subscription status'
  );
  assertEnumValue(
    subscription.billingInterval,
    BILLING_INTERVAL_VALUES,
    'billing interval'
  );
  return subscription;
}
/**
 * Create a client-submittable subscription request.
 *
 * The caller can supply extra fields for negative mass-assignment tests.
 * The production API must enforce its own allowlist.
 */
function createSubscriptionPayload(overrides = {}) {
  assertPlainObject(overrides, 'Subscription payload overrides');
  return {
    planId: DEFAULT_SUBSCRIPTION.planId,
    idempotencyKey: DEFAULT_SUBSCRIPTION.idempotencyKey,
    ...clone(overrides),
  };
}
/**
 * Create multiple subscriptions with unique generated identities.
 */
function createSubscriptionSet(count = 3, overrides = {}) {
  if (!Number.isInteger(count) || count < 0 || count > 1000) {
    throw new RangeError(
      'Subscription count must be an integer from 0 to 1000'
    );
  }
  assertPlainObject(overrides, 'Subscription set overrides');
  const commonOverrides = clone(overrides);
  for (const field of [
    'id',
    'subscriptionNumber',
    'userId',
    'providerCustomerId',
    'providerSubscriptionId',
    'idempotencyKey',
  ]) {
    delete commonOverrides[field];
  }
  return Array.from({ length: count }, (_, index) => {
    const sequence = String(index + 1).padStart(4, '0');
    return createSubscription({
      ...commonOverrides,
      id: `subscription_test_${sequence}`,
      subscriptionNumber: `MO-SUB-TEST-${sequence}`,
      userId: `user_test_${sequence}`,
      providerCustomerId: `provider_customer_test_${sequence}`,
      providerSubscriptionId: `provider_subscription_test_${sequence}`,
      idempotencyKey: `idem_test_subscription_${sequence}`,
    });
  });
}
/**
 * Create a subscription owned by another synthetic user.
 */
function createForeignSubscription(
  userId = 'user_test_foreign',
  overrides = {}
) {
  assertNonEmptyString(userId, 'Foreign subscription user ID');
  assertPlainObject(overrides, 'Foreign subscription overrides');
  return createSubscription({
    ...clone(overrides),
    id: 'subscription_test_foreign_0001',
    subscriptionNumber: 'MO-SUB-TEST-FOREIGN-0001',
    userId,
    providerCustomerId: 'provider_customer_test_foreign_0001',
    providerSubscriptionId: 'provider_subscription_test_foreign_0001',
    idempotencyKey: 'idem_test_subscription_foreign_0001',
  });
}
/**
 * Create a subscription with a selected status.
 */
function createSubscriptionWithStatus(status, overrides = {}) {
  assertEnumValue(
    status,
    SUBSCRIPTION_STATUSES_VALUES,
    'subscription status'
  );
  assertPlainObject(overrides, 'Subscription status overrides');
  return createSubscription({
    ...clone(overrides),
    status,
  });
}
/**
 * Create a synthetic expired subscription.
 */
function createExpiredSubscription(overrides = {}) {
  assertPlainObject(overrides, 'Expired subscription overrides');
  return createSubscription({
    id: 'subscription_test_expired_0001',
    subscriptionNumber: 'MO-SUB-TEST-EXPIRED-0001',
    status: SUBSCRIPTION_STATUSES.EXPIRED,
    currentPeriodStart: '2026-08-01T09:00:00.000Z',
    currentPeriodEnd: '2026-09-01T09:00:00.000Z',
    endedAt: '2026-09-01T09:00:00.000Z',
    ...clone(overrides),
  });
}
/**
 * Create a synthetic cancelled subscription.
 */
function createCancelledSubscription(overrides = {}) {
  assertPlainObject(overrides, 'Cancelled subscription overrides');
  return createSubscription({
    id: 'subscription_test_cancelled_0001',
    subscriptionNumber: 'MO-SUB-TEST-CANCELLED-0001',
    status: SUBSCRIPTION_STATUSES.CANCELLED,
    cancelAtPeriodEnd: false,
    cancelledAt: '2026-10-15T09:00:00.000Z',
    endedAt: '2026-10-15T09:00:00.000Z',
    ...clone(overrides),
  });
}
/**
 * Create a subscription scheduled to cancel at period end.
 */
function createCancellationScheduledSubscription(overrides = {}) {
  assertPlainObject(overrides, 'Scheduled cancellation overrides');
  return createSubscription({
    status: SUBSCRIPTION_STATUSES.ACTIVE,
    cancelAtPeriodEnd: true,
    cancelAt: '2026-11-01T09:00:00.000Z',
    cancelledAt: null,
    endedAt: null,
    ...clone(overrides),
  });
}
/**
 * Create a synthetic trial subscription.
 */
function createTrialSubscription(overrides = {}) {
  assertPlainObject(overrides, 'Trial subscription overrides');
  return createSubscription({
    id: 'subscription_test_trial_0001',
    subscriptionNumber: 'MO-SUB-TEST-TRIAL-0001',
    status: SUBSCRIPTION_STATUSES.TRIALING,
    trialStart: '2026-10-01T09:00:00.000Z',
    trialEnd: '2026-10-08T09:00:00.000Z',
    currentPeriodStart: '2026-10-01T09:00:00.000Z',
    currentPeriodEnd: '2026-11-01T09:00:00.000Z',
    ...clone(overrides),
  });
}
/**
 * Create a synthetic past-due subscription.
 */
function createPastDueSubscription(overrides = {}) {
  assertPlainObject(overrides, 'Past-due subscription overrides');
  return createSubscription({
    id: 'subscription_test_past_due_0001',
    subscriptionNumber: 'MO-SUB-TEST-PAST-DUE-0001',
    status: SUBSCRIPTION_STATUSES.PAST_DUE,
    ...clone(overrides),
  });
}
/**
 * Create a deliberately hostile payload for mass-assignment tests.
 */
function createMassAssignmentPayload(overrides = {}) {
  assertPlainObject(overrides, 'Mass-assignment overrides');
  return {
    ...createSubscriptionPayload(),
    id: 'subscription_test_attacker_controlled',
    subscriptionNumber: 'MO-SUB-ATTACKER-CONTROLLED',
    userId: 'user_test_attacker',
    amountMinor: 1,
    status: SUBSCRIPTION_STATUSES.ACTIVE,
    providerCustomerId: 'attacker_provider_customer',
    providerSubscriptionId: 'attacker_provider_subscription',
    cancelAtPeriodEnd: false,
    currentPeriodEnd: '2099-01-01T00:00:00.000Z',
    latestPaymentId: 'payment_test_attacker_controlled',
    isAdmin: true,
    role: 'admin',
    ...clone(overrides),
  };
}
/**
 * Create a synthetic subscription renewal scenario.
 *
 * This does not charge a payment method or advance a real subscription.
 */
function createRenewalScenario(overrides = {}) {
  assertPlainObject(overrides, 'Renewal scenario overrides');
  const subscriptionOverrides = overrides.subscription === undefined
    ? {}
    : overrides.subscription;
  assertPlainObject(
    subscriptionOverrides,
    'Renewal subscription overrides'
  );
  const subscription = createSubscription({
    ...clone(subscriptionOverrides),
    status: SUBSCRIPTION_STATUSES.ACTIVE,
  });
  const expectedAmountMinor = overrides.expectedAmountMinor === undefined
    ? subscription.amountMinor
    : overrides.expectedAmountMinor;
  const expectedCurrency = overrides.expectedCurrency === undefined
    ? subscription.currency
    : overrides.expectedCurrency;
  assertNonNegativeInteger(
    expectedAmountMinor,
    'Expected renewal amountMinor'
  );
  assertCurrency(expectedCurrency, 'Expected renewal currency');
  return {
    subscription,
    idempotencyKey:
      overrides.idempotencyKey || 'idem_test_renewal_0001',
    renewalNumber: 2,
    expectedAmountMinor,
    expectedCurrency,
    expectedSingleCharge: true,
  };
}
/**
 * Create a synthetic subscription entitlement scenario.
 *
 * expectedAccess is a test assertion, not an authorization grant.
 */
function createEntitlementScenario(overrides = {}) {
  assertPlainObject(overrides, 'Entitlement scenario overrides');
  const subscriptionOverrides = overrides.subscription === undefined
    ? {}
    : overrides.subscription;
  assertPlainObject(
    subscriptionOverrides,
    'Entitlement subscription overrides'
  );
  const {
    userId = 'user_test_0001',
    feature = 'priority_support',
    expectedAccess = true,
  } = overrides;
  assertNonEmptyString(userId, 'Entitlement user ID');
  assertNonEmptyString(feature, 'Entitlement feature');
  if (typeof expectedAccess !== 'boolean') {
    throw new TypeError('expectedAccess must be a boolean');
  }
  return {
    userId,
    subscription: createSubscription(subscriptionOverrides),
    feature,
    expectedAccess,
  };
}
/**
 * Create a subscription idempotency scenario.
 */
function createIdempotencyScenario(overrides = {}) {
  assertPlainObject(overrides, 'Idempotency scenario overrides');
  const payloadOverrides = overrides.payload === undefined
    ? {}
    : overrides.payload;
  assertPlainObject(
    payloadOverrides,
    'Idempotency payload overrides'
  );
  const idempotencyKey = overrides.idempotencyKey ||
    'idem_test_subscription_repeat_0001';
  const payload = createSubscriptionPayload({
    ...clone(payloadOverrides),
    idempotencyKey,
  });
  return {
    idempotencyKey,
    firstRequest: clone(payload),
    repeatedRequest: clone(payload),
    expectedSingleLogicalSubscription: true,
  };
}
module.exports = {
  SUBSCRIPTION_STATUSES,
  BILLING_INTERVALS,
  SUBSCRIPTION_PLAN_STATUSES,
  SUBSCRIPTION_STATUSES_VALUES,
  BILLING_INTERVAL_VALUES,
  SUBSCRIPTION_PLAN_STATUS_VALUES,
  DEFAULT_SUBSCRIPTION_PLAN,
  DEFAULT_SUBSCRIPTION,
  createSubscriptionPlan,
  createSubscription,
  createSubscriptionPayload,
  createSubscriptionSet,
  createForeignSubscription,
  createSubscriptionWithStatus,
  createExpiredSubscription,
  createCancelledSubscription,
  createCancellationScheduledSubscription,
  createTrialSubscription,
  createPastDueSubscription,
  createMassAssignmentPayload,
  createRenewalScenario,
  createEntitlementScenario,
  createIdempotencyScenario,
};