
'use strict';

const crypto = require('node:crypto');

const {
  ServiceError,
  requireDependency,
  requiredId,
  requiredString,
  plainObject,
  assertFound,
  audit,
} = require('./service-utils');

const PAYMENT_STATUS_BY_EVENT = Object.freeze({
  'payment.succeeded': 'captured',
  'payment.failed': 'failed',
  'payment.cancelled': 'cancelled',
  'payment.refunded': 'refunded',
});

const ALLOWED_CURRENCIES = new Set([
  'INR',
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'SGD',
  'AED',
]);

const MAX_AMOUNT_MINOR_UNITS = Number.MAX_SAFE_INTEGER;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_METADATA_BYTES = 16 * 1024;

const ALLOWED_STATUS_TRANSITIONS = Object.freeze({
  pending: new Set(['pending', 'captured', 'failed', 'cancelled']),
  captured: new Set(['captured', 'refunded']),
  failed: new Set(['failed']),
  cancelled: new Set(['cancelled']),
  refunded: new Set(['refunded']),
});

function createPaymentService({
  paymentRepository,
  paymentProvider,
  auditService,
  webhookSecret,
  verifyWebhookSignature,
  clock = () => new Date(),
}) {
  requireDependency(paymentRepository, 'paymentRepository');
  requireDependency(paymentProvider, 'paymentProvider');

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

  function validateActor(actor) {
    if (!actor || typeof actor !== 'object' || Array.isArray(actor)) {
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

  function normalizeMetadata(metadata) {
    const value = plainObject(metadata, 'metadata');

    let serialized;

    try {
      serialized = JSON.stringify(value);
    } catch {
      throw new ServiceError('Invalid payment metadata.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    if (
      typeof serialized !== 'string' ||
      Buffer.byteLength(serialized, 'utf8') > MAX_METADATA_BYTES
    ) {
      throw new ServiceError('Payment metadata is too large.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    const forbiddenKey =
      /password|secret|token|authorization|cookie|card|cvv|cvc|pan|accountnumber/i;

    function checkKeys(object, depth = 0) {
      if (depth > 5) {
        throw new ServiceError(
          'Payment metadata nesting is too deep.',
          {
            code: 'VALIDATION_ERROR',
            status: 422,
          },
        );
      }

      for (const [key, child] of Object.entries(object)) {
        if (forbiddenKey.test(key)) {
          throw new ServiceError(
            'Payment metadata contains a prohibited field.',
            {
              code: 'VALIDATION_ERROR',
              status: 422,
            },
          );
        }

        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            for (const item of child) {
              if (item && typeof item === 'object') {
                checkKeys(item, depth + 1);
              }
            }
          } else {
            checkKeys(child, depth + 1);
          }
        }
      }
    }

    checkKeys(value);

    return value;
  }

  function normalizeDescription(description) {
    if (description === undefined || description === null) {
      return undefined;
    }

    if (typeof description !== 'string') {
      throw new ServiceError('description must be a string.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    const normalized = description.trim();

    if (
      normalized.length > MAX_DESCRIPTION_LENGTH ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)
    ) {
      throw new ServiceError('Invalid payment description.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    return normalized || undefined;
  }

  function sanitizePayment(payment) {
    const allowedFields = [
      'id',
      'userId',
      'amount',
      'currency',
      'status',
      'description',
      'createdAt',
      'updatedAt',
      'capturedAt',
      'cancelledAt',
      'refundedAt',
    ];

    const result = {};

    for (const field of allowedFields) {
      if (
        Object.prototype.hasOwnProperty.call(payment, field) &&
        payment[field] !== undefined
      ) {
        result[field] = payment[field];
      }
    }

    return result;
  }

  function invalidPaymentError() {
    return new ServiceError('Payment not found.', {
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  async function findOwnedOrAdminPayment(id, actor) {
    validateActor(actor);

    const payment = assertFound(
      await paymentRepository.findById(id),
      'Payment',
    );

    const isOwner =
      actor.id != null &&
      payment.userId != null &&
      String(payment.userId) === String(actor.id);

    if (actor.isAdmin !== true && !isOwner) {
      throw invalidPaymentError();
    }

    return payment;
  }

  return {
    async createIntent({
      userId,
      amount,
      currency = 'INR',
      description,
      metadata = {},
      idempotencyKey,
    } = {}) {
      requiredId(userId, 'userId');

      if (
        !Number.isSafeInteger(amount) ||
        amount < 1 ||
        amount > MAX_AMOUNT_MINOR_UNITS
      ) {
        throw new ServiceError(
          'amount must be a positive safe integer in minor currency units.',
          {
            code: 'VALIDATION_ERROR',
            status: 422,
          },
        );
      }

      const currencyCode = requiredString(currency, 'currency', {
        min: 3,
        max: 3,
      }).toUpperCase();

      if (
        !/^[A-Z]{3}$/.test(currencyCode) ||
        !ALLOWED_CURRENCIES.has(currencyCode)
      ) {
        throw new ServiceError('Unsupported currency code.', {
          code: 'VALIDATION_ERROR',
          status: 422,
        });
      }

      const safeDescription = normalizeDescription(description);
      const safeMetadata = normalizeMetadata(metadata);

      const requestKey = idempotencyKey == null
        ? crypto.randomUUID()
        : requiredString(idempotencyKey, 'idempotencyKey', {
            max: 200,
          });

      if (
        typeof paymentRepository.create !== 'function' ||
        typeof paymentRepository.updateById !== 'function'
      ) {
        throw new ServiceError(
          'Payment persistence is not configured.',
          {
            code: 'PAYMENT_REPOSITORY_MISCONFIGURED',
            status: 503,
          },
        );
      }

      if (typeof paymentProvider.createIntent !== 'function') {
        throw new ServiceError(
          'Payment intent creation is not configured.',
          {
            code: 'PAYMENT_PROVIDER_MISCONFIGURED',
            status: 503,
          },
        );
      }

      /*
       * Reuse the same idempotency key for retries of the same checkout.
       * Persist a unique (userId, idempotencyKey) constraint in the
       * repository; a new random key on every retry is not idempotent.
       */
      const payment = assertFound(
        await paymentRepository.create({
          userId,
          amount,
          currency: currencyCode,
          status: 'pending',
          description: safeDescription,
          metadata: safeMetadata,
          idempotencyKey: requestKey,
          createdAt: getNow(),
        }),
        'Payment',
      );

      let intent;

      try {
        intent = await paymentProvider.createIntent({
          amount,
          currency: currencyCode,
          reference: String(payment.id),
          description: safeDescription,
          metadata: {
            paymentId: String(payment.id),
          },
          idempotencyKey: requestKey,
        });
      } catch {
        throw new ServiceError(
          'Payment initialization is pending confirmation.',
          {
            code: 'PAYMENT_INITIALIZATION_PENDING',
            status: 503,
          },
        );
      }

      if (
        !intent ||
        typeof intent.id !== 'string' ||
        intent.id.trim().length === 0
      ) {
        throw new ServiceError(
          'The payment provider returned an invalid intent.',
          {
            code: 'PAYMENT_PROVIDER_ERROR',
            status: 502,
          },
        );
      }

      const updatedPayment = assertFound(
        await paymentRepository.updateById(payment.id, {
          providerIntentId: intent.id,
        }),
        'Payment',
      );

      await audit(auditService, {
        action: 'payment.intent_created',
        entity: 'Payment',
        entityId: payment.id,
        actorId: userId,
        metadata: {
          currency: currencyCode,
          amount,
        },
      });

      return {
        paymentId: updatedPayment.id,
        status: updatedPayment.status || 'pending',
        clientSecret:
          typeof intent.clientSecret === 'string'
            ? intent.clientSecret
            : null,
        providerIntentId: intent.id,
      };
    },

    async getById(id, actor = {}) {
      requiredId(id, 'id');

      const payment = await findOwnedOrAdminPayment(id, actor);

      return sanitizePayment(payment);
    },

    async handleWebhook({
      rawBody,
      signature,
      headers,
    } = {}) {
      if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
        throw new ServiceError('Raw webhook body is required.', {
          code: 'INVALID_WEBHOOK',
          status: 400,
        });
      }

      if (
        typeof verifyWebhookSignature !== 'function' ||
        typeof webhookSecret !== 'string' ||
        webhookSecret.length === 0
      ) {
        throw new ServiceError(
          'Webhook signature verification is not configured.',
          {
            code: 'WEBHOOK_NOT_CONFIGURED',
            status: 503,
          },
        );
      }

      let valid;

      try {
        valid = await verifyWebhookSignature({
          rawBody,
          signature,
          headers,
          secret: webhookSecret,
        });
      } catch {
        throw new ServiceError(
          'Webhook signature verification failed.',
          {
            code: 'INVALID_SIGNATURE',
            status: 400,
          },
        );
      }

      if (valid !== true) {
        throw new ServiceError('Invalid webhook signature.', {
          code: 'INVALID_SIGNATURE',
          status: 400,
        });
      }

      if (typeof paymentProvider.parseWebhook !== 'function') {
        throw new ServiceError(
          'Webhook parsing is not configured.',
          {
            code: 'WEBHOOK_NOT_CONFIGURED',
            status: 503,
          },
        );
      }

      let event;

      try {
        event = await paymentProvider.parseWebhook({
          rawBody,
          headers,
        });
      } catch {
        throw new ServiceError('Malformed payment event.', {
          code: 'INVALID_WEBHOOK',
          status: 400,
        });
      }

      if (
        !event ||
        typeof event.id !== 'string' ||
        event.id.trim().length === 0 ||
        typeof event.type !== 'string' ||
        event.type.trim().length === 0
      ) {
        throw new ServiceError('Malformed payment event.', {
          code: 'INVALID_WEBHOOK',
          status: 400,
        });
      }

      if (
        typeof paymentRepository.processWebhookEvent !== 'function'
      ) {
        throw new ServiceError(
          'Atomic webhook processing is not configured.',
          {
            code: 'PAYMENT_REPOSITORY_MISCONFIGURED',
            status: 503,
          },
        );
      }

      const status = PAYMENT_STATUS_BY_EVENT[event.type] || null;
      const now = getNow();

      /*
       * This repository method must perform event deduplication,
       * payment lookup, valid state transition, payment update, and
       * event recording atomically in one database transaction.
       * It must use a unique constraint on provider event ID.
       */
      const result = await paymentRepository.processWebhookEvent({
        eventId: event.id,
        eventType: event.type,
        providerPaymentId: event.paymentId || null,
        status,
        processedAt: now,
        allowedTransitions: Object.fromEntries(
          Object.entries(ALLOWED_STATUS_TRANSITIONS).map(
            ([key, values]) => [key, [...values]],
          ),
        ),
      });

      if (!result || typeof result !== 'object') {
        throw new ServiceError(
          'Webhook processing returned an invalid result.',
          {
            code: 'PAYMENT_REPOSITORY_ERROR',
            status: 500,
          },
        );
      }

      if (result.notFound === true) {
        throw new ServiceError(
          'The payment associated with this event was not found.',
          {
            code: 'PAYMENT_NOT_FOUND',
            status: 404,
          },
        );
      }

      if (result.invalidTransition === true) {
        throw new ServiceError(
          'The payment status transition is not permitted.',
          {
            code: 'PAYMENT_STATE_CONFLICT',
            status: 409,
          },
        );
      }

      if (result.duplicate === true) {
        return {
          received: true,
          duplicate: true,
        };
      }

      await audit(auditService, {
        action: 'payment.webhook_processed',
        entity: 'Payment',
        entityId: result.paymentId || event.paymentId || undefined,
        metadata: {
          eventId: event.id,
          type: event.type,
          status,
        },
      });

      return {
        received: true,
        duplicate: false,
      };
    },
  };
}

module.exports = {
  createPaymentService,
  PAYMENT_STATUS_BY_EVENT,
  ALLOWED_STATUS_TRANSITIONS,
  ALLOWED_CURRENCIES,
};
