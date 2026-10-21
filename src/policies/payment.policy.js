
'use strict';

/**
 * MedOrbits -- Payment Authorization Policy
 *
 * File: src/policies/payment.policy.js
 * Runtime: Node.js >= 20
 *
 * Controls payment creation, access, cancellation, refunds,
 * status changes, and verified webhook processing.
 *
 * This policy does not replace payment-provider verification,
 * database transactions, idempotency, or refund reconciliation.
 */

const {
  isAdmin,
  hasRole,
  hasPermission,
  isOwner,
  sameId,
  safeStatus,
} = require('./policy-utils');

const CREATABLE_ROLES = Object.freeze([
  'user',
  'student',
  'candidate',
  'employer',
]);

const CANCELLABLE_STATUSES = new Set([
  'created',
  'pending',
  'requires_action',
]);

const REFUNDABLE_STATUSES = new Set([
  'succeeded',
]);

const BLOCKED_ACTOR_STATUSES = new Set([
  'disabled',
  'suspended',
  'inactive',
  'deleted',
  'blocked',
]);

const OWNER_FIELDS = Object.freeze([
  'userId',
  'user_id',
  'payerId',
  'payer_id',
  'customerUserId',
  'customer_user_id',
  'ownerId',
  'owner_id',
]);

const EMPLOYER_FIELDS = Object.freeze([
  'employerId',
  'employer_id',
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

  return !BLOCKED_ACTOR_STATUSES.has(safeStatus(actor.status));
}

function paymentPayerId(payment) {
  if (!isPlainObject(payment)) {
    return null;
  }

  for (const field of OWNER_FIELDS) {
    const value = payment[field];

    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }

  return null;
}

function paymentEmployerId(payment) {
  if (!isPlainObject(payment)) {
    return null;
  }

  for (const field of EMPLOYER_FIELDS) {
    if (payment[field] != null && payment[field] !== '') {
      return payment[field];
    }
  }

  return null;
}

function actorEmployerId(actor) {
  return actor?.employerId ?? actor?.employer_id ?? null;
}

function canCreatePayment(actor, input = {}) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(input)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'payments:create:any')
  ) {
    return true;
  }

  if (!hasRole(actor, ...CREATABLE_ROLES)) {
    return false;
  }

  const requestedPayer =
    input.userId ??
    input.user_id ??
    input.payerId ??
    input.payer_id ??
    input.customerUserId ??
    input.customer_user_id;

  if (
    requestedPayer != null &&
    requestedPayer !== '' &&
    !isOwner(actor, requestedPayer)
  ) {
    return false;
  }

  const requestedEmployer =
    input.employerId ?? input.employer_id;

  if (requestedEmployer != null) {
    const authenticatedEmployer = actorEmployerId(actor);

    if (
      !hasRole(actor, 'employer') ||
      authenticatedEmployer == null ||
      !sameId(requestedEmployer, authenticatedEmployer)
    ) {
      return false;
    }
  }

  // Amount, currency, tax, plan, discount, and provider metadata
  // must be calculated or retrieved by the trusted service.
  return true;
}

function canViewPayment(actor, payment) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(payment)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'payments:read:any')
  ) {
    return true;
  }

  const payerId = paymentPayerId(payment);

  if (payerId != null && isOwner(actor, payerId)) {
    return true;
  }

  const employerId = paymentEmployerId(payment);
  const currentEmployerId = actorEmployerId(actor);

  return Boolean(
    employerId != null &&
    currentEmployerId != null &&
    sameId(currentEmployerId, employerId) &&
    hasRole(actor, 'employer') &&
    hasPermission(actor, 'payments:read:employer')
  );
}

function canRefundPayment(actor, payment) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(payment)
  ) {
    return false;
  }

  if (
    !isAdmin(actor) &&
    !hasPermission(actor, 'payments:refund')
  ) {
    return false;
  }

  const status = safeStatus(payment.status);

  if (!REFUNDABLE_STATUSES.has(status)) {
    return false;
  }

  if (
    payment.refundedAt != null ||
    payment.refunded_at != null ||
    payment.disputed === true ||
    payment.isDisputed === true ||
    payment.is_disputed === true ||
    payment.refundPending === true ||
    payment.refund_pending === true
  ) {
    return false;
  }

  // The service must additionally verify the remaining refundable
  // balance and prevent concurrent or duplicate refund operations.
  return true;
}

function canCancelPayment(actor, payment) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(payment) ||
    !CANCELLABLE_STATUSES.has(safeStatus(payment.status))
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'payments:cancel:any')
  ) {
    return true;
  }

  return Boolean(
    paymentPayerId(payment) != null &&
    isOwner(actor, paymentPayerId(payment)) &&
    hasPermission(actor, 'payments:cancel:self')
  );
}

function canUpdatePaymentStatus(actor) {
  return Boolean(
    isActiveActor(actor) &&
    (
      isAdmin(actor) ||
      hasPermission(actor, 'payments:status:update')
    )
  );
}

function canProcessPaymentWebhook(context = {}) {
  if (!isPlainObject(context)) {
    return false;
  }

  return (
    context.source === 'verified-payment-provider' &&
    context.signatureVerified === true &&
    typeof Buffer !== 'undefined' &&
    Buffer.isBuffer(context.rawBody) &&
    context.rawBody.length > 0
  );
}

function canViewPaymentDetails(actor, payment) {
  return canViewPayment(actor, payment);
}

module.exports = Object.freeze({
  paymentPayerId,
  canCreatePayment,
  canViewPayment,
  canRefundPayment,
  canCancelPayment,
  canUpdatePaymentStatus,
  canProcessPaymentWebhook,
  canViewPaymentDetails,
});
