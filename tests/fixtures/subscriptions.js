
'use strict';

/**
 * MedOrbits -- Subscription Test Fixtures
 *
 * File: tests/fixtures/subscriptions.js
 *
 * Purpose:
 *   Synthetic fixtures for subscription plans, billing, authorization,
 *   entitlements, idempotency, cancellation, renewal, and security tests.
 *
 * Security:
 *   - Never initiates payments, renewals, or access grants.
 *   - Provider identifiers are synthetic.
 *   - Client-supplied prices, ownership, statuses, and provider references
 *     must be validated or assigned by trusted server-side logic.
 *   - Fixture expectations are not authorization decisions.
 *   - Cloning rejects unsafe object shapes and accessor properties.
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

const SUBSCRIPTION_SERVER_MANAGED_FIELDS = Object.freeze([
  'id',
  'subscriptionNumber',
  'userId',
  'status',
  'amountMinor',
  'currency',
  'provider',
  'providerCustomerId',
  'providerSubscriptionId',
  'currentPeriodStart',
  'currentPeriodEnd',
  'trialStart',
  'trialEnd',
  'cancelAtPeriodEnd',
  'cancelAt',
  'cancelledAt',
  'endedAt',
  'latestPaymentId',
  'createdAt',
  'updatedAt',
]);

const FORBIDDEN_OBJECT_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

const MAX_CLONE_DEPTH = 50;
const MAX_FIXTURE_COUNT = 1000;

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
 *
 * @param {*} value
 * @param {string} label
 * @returns {void}
 */
function assertNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      `${label} must be a non-negative safe integer`
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
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(
      `${label} must be a positive safe integer`
    );
  }
}

/**
 * Validate a currency code's format.
 * This does not establish provider support for that currency.
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
 * Validate an enum value.
 *
 * @param {*} value
 * @param {Array} values
 * @param {string} label
 * @returns {void}
 */
function assertEnumValue(value, values, label) {
  if (!values.includes(value)) {
    throw new RangeError(`Unsupported ${label}: ${String(value)}`);
  }
}

/**
 * Validate a timestamp represented as an ISO UTC string.
 *
 * Null and undefined are allowed for optional timestamps.
 *
 * @param {*} value
 * @param {string} label
 * @param {object} [options={}]
 * @returns {void}
 */
function assertOptionalUtcTimestamp(value, label, options = {}) {
  if (value === null || value === undefined) {
    if (options.required) {
      throw new TypeError(`${label} is required`);
    }

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
 * Recursively clone arrays and plain objects.
 *
 * Rejects cycles, accessors, dangerous property names, unsupported values,
 * sparse arrays, and objects exceeding the maximum nesting depth.
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
        return key !== 'length' &&
          !(typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) &&
            Number(key) < value.length);
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
 * Merge a nested plain object with defaults.
 *
 * @param {object} base
 * @param {*} overrides
 * @param {string} label
 * @returns {object}
 */
function mergeObject(base, overrides, label) {
  if (overrides === undefined) {
    return clone(base);
  }

  assertPlainObject(overrides, label);

  return {
    ...clone(base),
    ...clone(overrides),
  };
}

/**
 * Validate optional nullable string values.
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
 * Validate feature names.
 *
 * @param {*} features
 * @returns {string[]}
 */
function validateFeatures(features) {
  if (!Array.isArray(features)) {
    throw new TypeError('Plan features must be an array');
  }

  const result = clone(features);

  for (const feature of result) {
    assertNonEmptyString(feature, 'Plan feature');
  }

  if (new Set(result).size !== result.length) {
    throw new TypeError('Plan features must not contain duplicates');
  }

  return result;
}

/**
 * Validate plan limits.
 *
 * A null limit means unlimited. Other limits must be non-negative
 * safe integers.
 *
 * @param {*} limits
 * @returns {object}
 */
function validateLimits(limits) {
  assertPlainObject(limits, 'Plan limits');

  const result = clone(limits);

  for (const [name, value] of Object.entries(result)) {
    assertNonEmptyString(name, 'Plan limit name');

    if (value !== null) {
      assertNonNegativeInteger(value, `Plan limit "${name}"`);
    }
  }

  return result;
}

/**
 * Create a synthetic subscription plan.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createSubscriptionPlan(overrides = {}) {
  assertPlainObject(overrides, 'Subscription plan overrides');

  const input = clone(overrides);

  const plan = {
    ...clone(DEFAULT_SUBSCRIPTION_PLAN),
    ...input,
  };

  plan.limits = mergeObject(
    DEFAULT_SUBSCRIPTION_PLAN.limits,
    input.limits,
    'Plan limits overrides'
  );

  plan.features = input.features === undefined
    ? clone(DEFAULT_SUBSCRIPTION_PLAN.features)
    : validateFeatures(input.features);

  plan.limits = validateLimits(plan.limits);

  assertNonEmptyString(plan.id, 'Plan ID');
  assertNonEmptyString(plan.code, 'Plan code');
  assertNonEmptyString(plan.slug, 'Plan slug');
  assertNonEmptyString(plan.name, 'Plan name');
  assertOptionalString(plan.description, 'Plan description');
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

  assertBoolean(plan.isPublic, 'Plan isPublic');
  assertOptionalUtcTimestamp(plan.createdAt, 'Plan createdAt');
  assertOptionalUtcTimestamp(plan.updatedAt, 'Plan updatedAt');

  return plan;
}

/**
 * Create a synthetic subscription record.
 *
 * This validates fixture field formats, not business rules or workflow
 * transitions.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createSubscription(overrides = {}) {
  assertPlainObject(overrides, 'Subscription overrides');

  const input = clone(overrides);

  const subscription = {
    ...clone(DEFAULT_SUBSCRIPTION),
    ...input,
  };

  subscription.metadata = mergeObject(
    DEFAULT_SUBSCRIPTION.metadata,
    input.metadata,
    'Subscription metadata'
  );

  assertNonEmptyString(subscription.id, 'Subscription ID');
  assertNonEmptyString(
    subscription.subscriptionNumber,
    'Subscription number'
  );
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

  assertOptionalString(subscription.provider, 'Subscription provider');
  assertOptionalString(
    subscription.providerCustomerId,
    'Subscription providerCustomerId'
  );
  assertOptionalString(
    subscription.providerSubscriptionId,
    'Subscription providerSubscriptionId'
  );
  assertOptionalString(
    subscription.idempotencyKey,
    'Subscription idempotencyKey'
  );
  assertOptionalString(
    subscription.latestPaymentId,
    'Subscription latestPaymentId'
  );

  assertBoolean(
    subscription.cancelAtPeriodEnd,
    'Subscription cancelAtPeriodEnd'
  );

  for (const field of [
    'trialStart',
    'trialEnd',
    'currentPeriodStart',
    'currentPeriodEnd',
    'cancelAt',
    'cancelledAt',
    'endedAt',
    'createdAt',
    'updatedAt',
  ]) {
    assertOptionalUtcTimestamp(
      subscription[field],
      `Subscription ${field}`
    );
  }

  assertPlainObject(subscription.metadata, 'Subscription metadata');

  return subscription;
}

/**
 * Create a client-submittable subscription request.
 *
 * Overrides may deliberately add forbidden fields for negative security
 * tests. Production handlers must enforce an explicit request allowlist.
 *
 * @param {object} [overrides={}]
 * @returns {object}
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
 *
 * Common overrides apply to each record, except identity-related fields,
 * which are generated uniquely for each item.
 *
 * @param {number} [count=3]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createSubscriptionSet(count = 3, overrides = {}) {
  if (
    !Number.isInteger(count) ||
    count < 0 ||
    count > MAX_FIXTURE_COUNT
  ) {
    throw new RangeError(
      `Subscription count must be an integer from 0 to ${MAX_FIXTURE_COUNT}`
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
      ...clone(commonOverrides),
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
 *
 * Ownership is set after overrides so the caller cannot accidentally
 * replace the requested foreign owner.
 *
 * @param {string} [userId='user_test_foreign']
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createForeignSubscription(
  userId = 'user_test_foreign',
  overrides = {}
) {
  assertNonEmptyString(userId, 'Foreign subscription user ID');
  assertPlainObject(overrides, 'Foreign subscription overrides');

  const input = clone(overrides);

  return createSubscription({
    ...input,
    id: input.id || 'subscription_test_foreign_0001',
    subscriptionNumber:
      input.subscriptionNumber || 'MO-SUB-TEST-FOREIGN-0001',
    providerCustomerId:
      input.providerCustomerId || 'provider_customer_test_foreign_0001',
    providerSubscriptionId:
      input.providerSubscriptionId ||
      'provider_subscription_test_foreign_0001',
    idempotencyKey:
      input.idempotencyKey || 'idem_test_subscription_foreign_0001',
    userId,
  });
}

/**
 * Create a subscription with a selected status.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
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
 *
 * @param {object} [overrides={}]
 * @returns {object}
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
 *
 * @param {object} [overrides={}]
 * @returns {object}
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
 * Create a synthetic subscription scheduled to cancel at period end.
 *
 * @param {object} [overrides={}]
 * @returns {object}
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
 *
 * @param {object} [overrides={}]
 * @returns {object}
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
 *
 * @param {object} [overrides={}]
 * @returns {object}
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
 *
 * @param {object} [overrides={}]
 * @returns {object}
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
 * Create a synthetic renewal scenario.
 *
 * This does not charge a payment method or advance a real subscription.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createRenewalScenario(overrides = {}) {
  assertPlainObject(overrides, 'Renewal scenario overrides');

  const input = clone(overrides);
  const subscriptionOverrides = input.subscription === undefined
    ? {}
    : input.subscription;

  assertPlainObject(
    subscriptionOverrides,
    'Renewal subscription overrides'
  );

  const subscription = createSubscription({
    ...clone(subscriptionOverrides),
    status: SUBSCRIPTION_STATUSES.ACTIVE,
  });

  const expectedAmountMinor = input.expectedAmountMinor === undefined
    ? subscription.amountMinor
    : input.expectedAmountMinor;

  const expectedCurrency = input.expectedCurrency === undefined
    ? subscription.currency
    : input.expectedCurrency;

  assertNonNegativeInteger(
    expectedAmountMinor,
    'Expected renewal amountMinor'
  );

  assertCurrency(expectedCurrency, 'Expected renewal currency');

  const idempotencyKey = input.idempotencyKey === undefined
    ? 'idem_test_renewal_0001'
    : input.idempotencyKey;

  assertNonEmptyString(idempotencyKey, 'Renewal idempotency key');

  const renewalNumber = input.renewalNumber === undefined
    ? 2
    : input.renewalNumber;

  assertPositiveInteger(renewalNumber, 'Renewal number');

  const expectedSingleCharge = input.expectedSingleCharge === undefined
    ? true
    : input.expectedSingleCharge;

  assertBoolean(expectedSingleCharge, 'Expected single charge');

  return {
    subscription,
    idempotencyKey,
    renewalNumber,
    expectedAmountMinor,
    expectedCurrency,
    expectedSingleCharge,
  };
}

/**
 * Create a synthetic subscription entitlement scenario.
 *
 * expectedAccess is a test expectation, not an authorization grant.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createEntitlementScenario(overrides = {}) {
  assertPlainObject(overrides, 'Entitlement scenario overrides');

  const input = clone(overrides);
  const subscriptionOverrides = input.subscription === undefined
    ? {}
    : input.subscription;

  assertPlainObject(
    subscriptionOverrides,
    'Entitlement subscription overrides'
  );

  const userId = input.userId === undefined
    ? DEFAULT_SUBSCRIPTION.userId
    : input.userId;

  const feature = input.feature === undefined
    ? 'priority_support'
    : input.feature;

  const expectedAccess = input.expectedAccess === undefined
    ? true
    : input.expectedAccess;

  assertNonEmptyString(userId, 'Entitlement user ID');
  assertNonEmptyString(feature, 'Entitlement feature');
  assertBoolean(expectedAccess, 'expectedAccess');

  return {
    userId,
    subscription: createSubscription(subscriptionOverrides),
    feature,
    expectedAccess,
  };
}

/**
 * Create a subscription idempotency scenario.
 *
 * Both requests use the same key and payload by default.
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

  assertPlainObject(
    payloadOverrides,
    'Idempotency payload overrides'
  );

  const idempotencyKey = input.idempotencyKey === undefined
    ? 'idem_test_subscription_repeat_0001'
    : input.idempotencyKey;

  assertNonEmptyString(idempotencyKey, 'Idempotency key');

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

/**
 * Create a synthetic subscription access-control scenario.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createSubscriptionAccessScenario(overrides = {}) {
  assertPlainObject(overrides, 'Subscription access overrides');

  const input = clone(overrides);

  const userId = input.userId === undefined
    ? DEFAULT_SUBSCRIPTION.userId
    : input.userId;

  const expectedAccess = input.expectedAccess === undefined
    ? true
    : input.expectedAccess;

  assertNonEmptyString(userId, 'Access scenario user ID');
  assertBoolean(expectedAccess, 'expectedAccess');

  const subscription = input.subscription === undefined
    ? createSubscription()
    : createSubscription(input.subscription);

  return {
    userId,
    subscription,
    expectedAccess,
  };
}

/**
 * Create a cross-user subscription access scenario expected to be denied.
 *
 * The subscription owner is always distinct from the requester.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createUnauthorizedSubscriptionAccessScenario(overrides = {}) {
  assertPlainObject(
    overrides,
    'Unauthorized subscription access overrides'
  );

  const input = clone(overrides);

  const userId = input.userId === undefined
    ? 'user_test_requester'
    : input.userId;

  assertNonEmptyString(userId, 'Unauthorized requester ID');

  const subscriptionOverrides = input.subscription === undefined
    ? {}
    : input.subscription;

  assertPlainObject(
    subscriptionOverrides,
    'Unauthorized subscription overrides'
  );

  const ownerId = subscriptionOverrides.userId === undefined
    ? 'user_test_foreign'
    : subscriptionOverrides.userId;

  assertNonEmptyString(ownerId, 'Unauthorized subscription owner ID');

  if (ownerId === userId) {
    throw new TypeError(
      'Unauthorized access scenario requires a different subscription owner'
    );
  }

  const foreignSubscription = createForeignSubscription(
    ownerId,
    subscriptionOverrides
  );

  return {
    userId,
    subscription: foreignSubscription,
    expectedAccess: false,
  };
}

/**
 * Create a subscription request containing server-managed fields.
 *
 * Useful for allowlist and mass-assignment rejection tests.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createServerManagedFieldsPayload(overrides = {}) {
  assertPlainObject(overrides, 'Server-managed payload overrides');

  const payload = {
    ...createSubscriptionPayload(),
  };

  for (const field of SUBSCRIPTION_SERVER_MANAGED_FIELDS) {
    payload[field] = `attacker_controlled_${field}`;
  }

  return {
    ...payload,
    ...clone(overrides),
  };
}

/**
 * Create a subscription cancellation scenario.
 *
 * The scenario describes expected behavior only; it does not perform
 * cancellation or mutate a real subscription.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCancellationScenario(overrides = {}) {
  assertPlainObject(overrides, 'Cancellation scenario overrides');

  const input = clone(overrides);

  const subscription = input.subscription === undefined
    ? createSubscription()
    : createSubscription(input.subscription);

  const cancelAtPeriodEnd = input.cancelAtPeriodEnd === undefined
    ? false
    : input.cancelAtPeriodEnd;

  assertBoolean(cancelAtPeriodEnd, 'cancelAtPeriodEnd');

  const expectedStatus = input.expectedStatus === undefined
    ? subscription.status
    : input.expectedStatus;

  assertEnumValue(
    expectedStatus,
    SUBSCRIPTION_STATUSES_VALUES,
    'expected cancellation status'
  );

  return {
    subscription,
    cancelAtPeriodEnd,
    expectedStatus,
    expectedNoImmediateRefund: input.expectedNoImmediateRefund === undefined
      ? true
      : assertBooleanAndReturn(
          input.expectedNoImmediateRefund,
          'expectedNoImmediateRefund'
        ),
  };
}

/**
 * Validate a boolean and return it.
 *
 * @param {*} value
 * @param {string} label
 * @returns {boolean}
 */
function assertBooleanAndReturn(value, label) {
  assertBoolean(value, label);
  return value;
}

/**
 * Create a synthetic unpaid subscription.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createUnpaidSubscription(overrides = {}) {
  return createSubscriptionWithStatus(
    SUBSCRIPTION_STATUSES.UNPAID,
    {
      id: 'subscription_test_unpaid_0001',
      subscriptionNumber: 'MO-SUB-TEST-UNPAID-0001',
      ...clone(overrides),
    }
  );
}

/**
 * Create a synthetic paused subscription.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createPausedSubscription(overrides = {}) {
  return createSubscriptionWithStatus(
    SUBSCRIPTION_STATUSES.PAUSED,
    {
      id: 'subscription_test_paused_0001',
      subscriptionNumber: 'MO-SUB-TEST-PAUSED-0001',
      ...clone(overrides),
    }
  );
}

/**
 * Create a synthetic incomplete subscription.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createIncompleteSubscription(overrides = {}) {
  return createSubscriptionWithStatus(
    SUBSCRIPTION_STATUSES.INCOMPLETE,
    {
      id: 'subscription_test_incomplete_0001',
      subscriptionNumber: 'MO-SUB-TEST-INCOMPLETE-0001',
      ...clone(overrides),
    }
  );
}

/**
 * Create a synthetic one-time plan.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createOneTimePlan(overrides = {}) {
  return createSubscriptionPlan({
    id: 'plan_test_one_time_0001',
    code: 'MO-PLAN-TEST-ONE-TIME-0001',
    slug: 'test-one-time-plan',
    name: 'Test One-Time Plan',
    billingInterval: BILLING_INTERVALS.ONE_TIME,
    intervalCount: 1,
    ...clone(overrides),
  });
}

/**
 * Create a synthetic yearly plan.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createYearlyPlan(overrides = {}) {
  return createSubscriptionPlan({
    id: 'plan_test_yearly_0001',
    code: 'MO-PLAN-TEST-YEARLY-0001',
    slug: 'test-yearly-plan',
    name: 'Test Yearly Plan',
    billingInterval: BILLING_INTERVALS.YEARLY,
    intervalCount: 1,
    ...clone(overrides),
  });
}

/**
 * Create a synthetic inactive plan.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createInactivePlan(overrides = {}) {
  return createSubscriptionPlan({
    id: 'plan_test_inactive_0001',
    code: 'MO-PLAN-TEST-INACTIVE-0001',
    slug: 'test-inactive-plan',
    name: 'Test Inactive Plan',
    status: SUBSCRIPTION_PLAN_STATUSES.INACTIVE,
    isPublic: false,
    ...clone(overrides),
  });
}

/**
 * Create a synthetic archived plan.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createArchivedPlan(overrides = {}) {
  return createSubscriptionPlan({
    id: 'plan_test_archived_0001',
    code: 'MO-PLAN-TEST-ARCHIVED-0001',
    slug: 'test-archived-plan',
    name: 'Test Archived Plan',
    status: SUBSCRIPTION_PLAN_STATUSES.ARCHIVED,
    isPublic: false,
    ...clone(overrides),
  });
}

module.exports = {
  SUBSCRIPTION_STATUSES,
  BILLING_INTERVALS,
  SUBSCRIPTION_PLAN_STATUSES,
  SUBSCRIPTION_STATUSES_VALUES,
  BILLING_INTERVAL_VALUES,
  SUBSCRIPTION_PLAN_STATUS_VALUES,
  SUBSCRIPTION_SERVER_MANAGED_FIELDS,
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
  createSubscriptionAccessScenario,
  createUnauthorizedSubscriptionAccessScenario,
  createServerManagedFieldsPayload,
  createCancellationScenario,
  createUnpaidSubscription,
  createPausedSubscription,
  createIncompleteSubscription,
  createOneTimePlan,
  createYearlyPlan,
  createInactivePlan,
  createArchivedPlan,
};
