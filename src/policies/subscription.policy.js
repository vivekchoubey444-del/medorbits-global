
'use strict';

/**
 * MedOrbits -- Subscription Authorization Policy
 *
 * File: src/policies/subscription.policy.js
 * Runtime: Node.js >= 20
 *
 * Controls subscription creation, access, updates, cancellation,
 * plan changes, entitlement grants, and entitlement checks.
 *
 * Payment-provider verification, webhook signature validation,
 * billing reconciliation, and transactional state changes belong
 * in the service layer.
 */

const {
  isAdmin,
  hasRole,
  hasPermission,
  isOwner,
  sameId,
  safeStatus,
} = require('./policy-utils');

const SUBSCRIPTION_OWNER_FIELDS = Object.freeze([
  'userId',
  'user_id',
  'ownerId',
  'owner_id',
  'customerUserId',
  'customer_user_id',
]);

const EMPLOYER_FIELDS = Object.freeze([
  'employerId',
  'employer_id',
]);

const CREATABLE_ROLES = Object.freeze([
  'user',
  'student',
  'candidate',
  'employer',
]);

const CANCELLABLE_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'incomplete',
]);

const PLAN_CHANGE_STATUSES = new Set([
  'active',
  'trialing',
]);

const UPDATE_PROTECTED_FIELDS = new Set([
  'id',
  '_id',
  'subscriptionId',
  'subscription_id',
  'userId',
  'user_id',
  'ownerId',
  'owner_id',
  'customerUserId',
  'customer_user_id',
  'employerId',
  'employer_id',
  'status',
  'paymentStatus',
  'payment_status',
  'planId',
  'plan_id',
  'price',
  'amount',
  'currency',
  'billingInterval',
  'billing_interval',
  'providerSubscriptionId',
  'provider_subscription_id',
  'providerCustomerId',
  'provider_customer_id',
  'currentPeriodStart',
  'current_period_start',
  'currentPeriodEnd',
  'current_period_end',
  'cancelAtPeriodEnd',
  'cancel_at_period_end',
  'cancelledAt',
  'cancelled_at',
  'canceledAt',
  'canceled_at',
  'entitlements',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function isActiveActor(actor) {
  if (!actor || typeof actor !== 'object') {
    return false;
  }

  if (
    actor.isActive === false ||
    actor.is_active === false ||
    actor.isSuspended === true ||
    actor.is_suspended === true
  ) {
    return false;
  }

  return ![
    'disabled',
    'suspended',
    'inactive',
    'deleted',
    'blocked',
  ].includes(safeStatus(actor.status));
}

function subscriptionOwnerId(subscription) {
  if (!isPlainObject(subscription)) {
    return null;
  }

  for (const field of SUBSCRIPTION_OWNER_FIELDS) {
    const value = subscription[field];

    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }

  return null;
}

function subscriptionEmployerId(subscription) {
  if (!isPlainObject(subscription)) {
    return null;
  }

  for (const field of EMPLOYER_FIELDS) {
    if (
      subscription[field] !== null &&
      subscription[field] !== undefined &&
      subscription[field] !== ''
    ) {
      return subscription[field];
    }
  }

  return null;
}

function actorEmployerId(actor) {
  return actor?.employerId ?? actor?.employer_id ?? null;
}

function isSubscriptionOwner(actor, subscription) {
  if (!isActiveActor(actor) || !isPlainObject(subscription)) {
    return false;
  }

  const ownerId = subscriptionOwnerId(subscription);

  return ownerId != null && isOwner(actor, ownerId);
}

function canCreateSubscription(actor, input = {}) {
  if (!isActiveActor(actor) || !isPlainObject(input)) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'subscriptions:create:any')
  ) {
    return true;
  }

  if (!hasRole(actor, ...CREATABLE_ROLES)) {
    return false;
  }

  const requestedOwner =
    input.userId ??
    input.user_id ??
    input.ownerId ??
    input.owner_id ??
    input.customerUserId ??
    input.customer_user_id;

  // Self-service creation must not allow another user's subscription.
  if (
    requestedOwner != null &&
    requestedOwner !== '' &&
    !isOwner(actor, requestedOwner)
  ) {
    return false;
  }

  // Employer subscriptions must be bound to the authenticated
  // employer account by the service, not by untrusted input.
  if (hasRole(actor, 'employer')) {
    const requestedEmployer =
      input.employerId ?? input.employer_id;

    const authenticatedEmployer = actorEmployerId(actor);

    if (
      requestedEmployer != null &&
      (
        authenticatedEmployer == null ||
        !sameId(requestedEmployer, authenticatedEmployer)
      )
    ) {
      return false;
    }
  }

  // Plan, price, currency, discounts, billing interval, status,
  // and provider identifiers must be resolved server-side.
  return true;
}

function canViewSubscription(actor, subscription) {
  if (!isActiveActor(actor) || !isPlainObject(subscription)) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'subscriptions:read:any')
  ) {
    return true;
  }

  if (isSubscriptionOwner(actor, subscription)) {
    return true;
  }

  const employerId = subscriptionEmployerId(subscription);
  const currentEmployerId = actorEmployerId(actor);

  return Boolean(
    employerId != null &&
    currentEmployerId != null &&
    sameId(currentEmployerId, employerId) &&
    hasRole(actor, 'employer') &&
    hasPermission(actor, 'subscriptions:read:employer')
  );
}

function canUpdateSubscription(actor, subscription, changes = {}) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(subscription) ||
    !isPlainObject(changes) ||
    Object.keys(changes).length === 0
  ) {
    return false;
  }

  // Privileged users must use dedicated billing/status operations
  // for protected fields; this function never authorizes those writes.
  if (
    Object.keys(changes).some((key) =>
      UPDATE_PROTECTED_FIELDS.has(key)
    )
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'subscriptions:update:any')
  ) {
    return true;
  }

  return Boolean(
    isSubscriptionOwner(actor, subscription) &&
    hasPermission(actor, 'subscriptions:update:self')
  );
}

function canCancelSubscription(actor, subscription) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(subscription)
  ) {
    return false;
  }

  const status = safeStatus(subscription.status);

  if (
    !CANCELLABLE_STATUSES.has(status) ||
    subscription.cancelAtPeriodEnd === true ||
    subscription.cancel_at_period_end === true ||
    subscription.cancelledAt != null ||
    subscription.cancelled_at != null ||
    subscription.canceledAt != null ||
    subscription.canceled_at != null
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'subscriptions:cancel:any')
  ) {
    return true;
  }

  return Boolean(
    isSubscriptionOwner(actor, subscription) &&
    hasPermission(actor, 'subscriptions:cancel:self')
  );
}

function canChangeSubscriptionPlan(actor, subscription) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(subscription) ||
    !PLAN_CHANGE_STATUSES.has(safeStatus(subscription.status))
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'subscriptions:plan:change:any')
  ) {
    return true;
  }

  return Boolean(
    isSubscriptionOwner(actor, subscription) &&
    hasPermission(actor, 'subscriptions:plan:change:self')
  );
}

function canGrantSubscriptionEntitlement(actor) {
  return Boolean(
    isActiveActor(actor) &&
    (
      isAdmin(actor) ||
      hasPermission(actor, 'subscriptions:entitlements:grant')
    )
  );
}

function hasActiveEntitlement(
  subscription,
  entitlement,
  now = Date.now()
) {
  if (
    !isPlainObject(subscription) ||
    typeof entitlement !== 'string' ||
    !entitlement.trim()
  ) {
    return false;
  }

  if (
    !['active', 'trialing'].includes(
      safeStatus(subscription.status)
    )
  ) {
    return false;
  }

  const currentTime = now instanceof Date
    ? now.getTime()
    : Number(now);

  if (!Number.isFinite(currentTime)) {
    return false;
  }

  const periodEndValue =
    subscription.currentPeriodEnd ??
    subscription.current_period_end;

  // Fail closed when a period end is supplied but invalid or expired.
  if (periodEndValue != null) {
    const periodEnd = typeof periodEndValue === 'number'
      ? periodEndValue
      : new Date(periodEndValue).getTime();

    if (
      !Number.isFinite(periodEnd) ||
      periodEnd <= currentTime
    ) {
      return false;
    }
  }

  const periodStartValue =
    subscription.currentPeriodStart ??
    subscription.current_period_start;

  if (periodStartValue != null) {
    const periodStart = typeof periodStartValue === 'number'
      ? periodStartValue
      : new Date(periodStartValue).getTime();

    if (
      !Number.isFinite(periodStart) ||
      periodStart > currentTime
    ) {
      return false;
    }
  }

  const entitlements = Array.isArray(subscription.entitlements)
    ? subscription.entitlements
    : [];

  return entitlements.includes(entitlement.trim());
}

module.exports = Object.freeze({
  subscriptionOwnerId,
  canCreateSubscription,
  canViewSubscription,
  canUpdateSubscription,
  canCancelSubscription,
  canChangeSubscriptionPlan,
  canGrantSubscriptionEntitlement,
  hasActiveEntitlement,
});
