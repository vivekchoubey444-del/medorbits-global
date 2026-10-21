
'use strict';

const crypto = require('node:crypto');

const {
  ServiceError,
  requireDependency,
  requiredId,
  requiredString,
  assertFound,
  audit,
} = require('./service-utils');

const TERMINAL_STATUSES = new Set([
  'cancelled',
  'expired',
]);

const ACTIVE_STATUSES = new Set([
  'pending',
  'trialing',
  'active',
  'past_due',
]);

const ALLOWED_PROVIDER_STATUSES = new Set([
  ...ACTIVE_STATUSES,
  ...TERMINAL_STATUSES,
]);

function createSubscriptionService({
  subscriptionRepository,
  planRepository,
  billingProvider,
  auditService,
  clock = () => new Date(),
}) {
  requireDependency(subscriptionRepository, 'subscriptionRepository');
  requireDependency(planRepository, 'planRepository');
  requireDependency(billingProvider, 'billingProvider');

  if (
    typeof subscriptionRepository.findById !== 'function' ||
    typeof subscriptionRepository.create !== 'function' ||
    typeof subscriptionRepository.updateById !== 'function'
  ) {
    throw new ServiceError(
      'Subscription repository is missing required methods.',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  if (
    typeof planRepository.findById !== 'function' ||
    typeof billingProvider.createSubscription !== 'function' ||
    typeof billingProvider.cancelSubscription !== 'function'
  ) {
    throw new ServiceError(
      'Plan repository or billing provider is missing required methods.',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  function getNow() {
    const value = clock();
    const date = value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new ServiceError('Invalid service clock value.', {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      });
    }

    return date;
  }

  function assertActor(actor) {
    if (
      !actor ||
      typeof actor !== 'object' ||
      Array.isArray(actor)
    ) {
      throw new ServiceError('Invalid actor.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    if (actor.id !== undefined && actor.id !== null) {
      requiredId(actor.id, 'actor.id');
    }

    return actor;
  }

  function assertOwnerOrAdmin(record, actor = {}) {
    assertActor(actor);

    const isAdmin = actor.isAdmin === true;
    const isOwner =
      actor.id != null &&
      record.userId != null &&
      String(record.userId) === String(actor.id);

    if (!isAdmin && !isOwner) {
      throw new ServiceError('Subscription not found.', {
        code: 'NOT_FOUND',
        status: 404,
      });
    }
  }

  function normalizeProviderStatus(status) {
    if (
      typeof status !== 'string' ||
      !ALLOWED_PROVIDER_STATUSES.has(status)
    ) {
      throw new ServiceError(
        'The billing provider returned an unsupported subscription status.',
        {
          code: 'BILLING_PROVIDER_ERROR',
          status: 502,
        },
      );
    }

    return status;
  }

  function normalizePaymentMethodId(value) {
    const id = requiredString(value, 'paymentMethodId', {
      max: 255,
    });

    if (/[\u0000-\u001f\u007f]/.test(id)) {
      throw new ServiceError('Invalid payment method.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    return id;
  }

  function sanitizeSubscription(record) {
    // Never return provider payloads, credentials, or payment details.
    const allowedFields = [
      'id',
      'userId',
      'planId',
      'status',
      'currentPeriodEnd',
      'cancelledAt',
      'createdAt',
      'updatedAt',
    ];

    const result = {};

    for (const field of allowedFields) {
      if (
        Object.prototype.hasOwnProperty.call(record, field) &&
        record[field] !== undefined
      ) {
        result[field] = record[field];
      }
    }

    return result;
  }

  async function findSubscriptionById(id) {
    return assertFound(
      await subscriptionRepository.findById(id),
      'Subscription',
    );
  }

  return {
    async subscribe({
      userId,
      planId,
      paymentMethodId,
      requestId,
    } = {}) {
      requiredId(userId, 'userId');
      requiredId(planId, 'planId');

      const paymentMethod = normalizePaymentMethodId(paymentMethodId);

      /*
       * Stable requestId should be created and persisted by the caller
       * or checkout workflow before this method is invoked.
       * A fresh random key on every retry does not provide idempotency.
       */
      const idempotencyKey = requestId == null
        ? crypto.randomUUID()
        : requiredString(requestId, 'requestId', { max: 200 });

      if (
        typeof subscriptionRepository.findActiveByUserId !== 'function'
      ) {
        throw new ServiceError(
          'Subscription eligibility checking is not configured.',
          {
            code: 'SUBSCRIPTION_REPOSITORY_MISCONFIGURED',
            status: 500,
          },
        );
      }

      if (
        typeof subscriptionRepository.createPendingRequest !== 'function' ||
        typeof subscriptionRepository.markRequestFailed !== 'function'
      ) {
        throw new ServiceError(
          'Subscription request idempotency is not configured.',
          {
            code: 'SUBSCRIPTION_REPOSITORY_MISCONFIGURED',
            status: 500,
          },
        );
      }

      const plan = assertFound(
        await planRepository.findById(planId),
        'Subscription plan',
      );

      if (
        plan.active !== true ||
        plan.archived === true
      ) {
        throw new ServiceError('This plan is unavailable.', {
          code: 'PLAN_UNAVAILABLE',
          status: 409,
        });
      }

      if (
        plan.price == null ||
        !Number.isFinite(Number(plan.price)) ||
        Number(plan.price) < 0 ||
        !plan.currency
      ) {
        throw new ServiceError(
          'The subscription plan has invalid billing configuration.',
          {
            code: 'PLAN_CONFIGURATION_ERROR',
            status: 500,
          },
        );
      }

      const existing =
        await subscriptionRepository.findActiveByUserId(userId);

      if (existing) {
        throw new ServiceError(
          'An active subscription already exists.',
          {
            code: 'SUBSCRIPTION_EXISTS',
            status: 409,
          },
        );
      }

      /*
       * The repository must enforce uniqueness on (userId, requestId)
       * and prevent concurrent pending/active subscription requests.
       * It should return the same request record when retried.
       */
      const request = await subscriptionRepository.createPendingRequest({
        userId,
        planId,
        requestId: idempotencyKey,
        status: 'pending',
        createdAt: getNow(),
      });

      assertFound(request, 'Subscription request');

      if (request.providerSubscriptionId) {
        const existingSubscription =
          await subscriptionRepository.findById(request.subscriptionId);

        return sanitizeSubscription(
          assertFound(existingSubscription, 'Subscription'),
        );
      }

      let remote;

      try {
        remote = await billingProvider.createSubscription({
          userId,
          plan,
          paymentMethodId: paymentMethod,
          idempotencyKey,
        });
      } catch {
        // Do not assume a provider timeout means billing did not occur.
        // Leave the request reconcilable using the same idempotency key.
        throw new ServiceError(
          'Subscription processing is pending confirmation.',
          {
            code: 'SUBSCRIPTION_PROCESSING',
            status: 503,
          },
        );
      }

      if (
        !remote ||
        typeof remote.id !== 'string' ||
        remote.id.trim().length === 0
      ) {
        throw new ServiceError(
          'The billing provider returned an invalid subscription.',
          {
            code: 'BILLING_PROVIDER_ERROR',
            status: 502,
          },
        );
      }

      const status = normalizeProviderStatus(remote.status);

      const currentPeriodEnd = remote.currentPeriodEnd == null
        ? null
        : new Date(remote.currentPeriodEnd);

      if (
        currentPeriodEnd &&
        Number.isNaN(currentPeriodEnd.getTime())
      ) {
        throw new ServiceError(
          'The billing provider returned an invalid billing period.',
          {
            code: 'BILLING_PROVIDER_ERROR',
            status: 502,
          },
        );
      }

      let record;

      try {
        record = assertFound(
          await subscriptionRepository.create({
            userId,
            planId,
            status,
            providerSubscriptionId: remote.id,
            currentPeriodEnd,
            requestId: idempotencyKey,
          }),
          'Subscription',
        );

        if (
          typeof subscriptionRepository.completePendingRequest !== 'function'
        ) {
          throw new Error('completePendingRequest() is not configured.');
        }

        await subscriptionRepository.completePendingRequest(
          request.id,
          {
            subscriptionId: record.id,
            providerSubscriptionId: remote.id,
            completedAt: getNow(),
          },
        );
      } catch {
        // The provider may already have created the subscription.
        // Keep the request reconcilable instead of blindly charging again.
        throw new ServiceError(
          'Subscription was submitted but requires reconciliation.',
          {
            code: 'SUBSCRIPTION_RECONCILIATION_REQUIRED',
            status: 503,
          },
        );
      }

      await audit(auditService, {
        action: 'subscription.created',
        entity: 'Subscription',
        entityId: record.id,
        actorId: userId,
        metadata: {
          planId,
          status,
          requestId: idempotencyKey,
        },
      });

      return sanitizeSubscription(record);
    },

    async cancel(id, actor = {}) {
      requiredId(id, 'id');
      assertActor(actor);

      const record = await findSubscriptionById(id);

      assertOwnerOrAdmin(record, actor);

      if (TERMINAL_STATUSES.has(record.status)) {
        return sanitizeSubscription(record);
      }

      if (
        !record.providerSubscriptionId ||
        typeof record.providerSubscriptionId !== 'string'
      ) {
        throw new ServiceError(
          'The subscription has no billing-provider reference.',
          {
            code: 'BILLING_REFERENCE_MISSING',
            status: 409,
          },
        );
      }

      /*
       * Prefer cancel-at-period-end if that is the product's policy.
       * This implementation requests provider cancellation immediately.
       * Provider idempotency and reconciliation must be implemented by
       * the adapter because a timeout may occur after remote success.
       */
      try {
        await billingProvider.cancelSubscription(
          record.providerSubscriptionId,
          {
            idempotencyKey: `cancel-${String(record.id)}`,
          },
        );
      } catch {
        throw new ServiceError(
          'Cancellation could not be confirmed. Please retry or check subscription status.',
          {
            code: 'SUBSCRIPTION_CANCELLATION_PENDING',
            status: 503,
          },
        );
      }

      const cancelledAt = getNow();

      let updated;

      if (
        typeof subscriptionRepository.cancelIfNotTerminal === 'function'
      ) {
        updated = await subscriptionRepository.cancelIfNotTerminal(
          id,
          {
            status: 'cancelled',
            cancelledAt,
          },
        );
      } else {
        updated = await subscriptionRepository.updateById(id, {
          status: 'cancelled',
          cancelledAt,
        });
      }

      assertFound(updated, 'Subscription');

      await audit(auditService, {
        action: 'subscription.cancelled',
        entity: 'Subscription',
        entityId: id,
        actorId: actor.id,
      });

      return sanitizeSubscription(updated);
    },

    async getById(id, actor = {}) {
      requiredId(id, 'id');
      assertActor(actor);

      const record = await findSubscriptionById(id);

      assertOwnerOrAdmin(record, actor);

      return sanitizeSubscription(record);
    },
  };
}

module.exports = {
  createSubscriptionService,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
};
