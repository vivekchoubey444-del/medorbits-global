
'use strict';

const {
  ServiceError,
  requireDependency,
  requiredId,
  requiredString,
  plainObject,
  assertFound,
  audit,
} = require('./service-utils');

const ALLOWED_CHANNELS = new Set([
  'in_app',
  'email',
  'push',
]);

const ALLOWED_STATUSES = new Set([
  'unread',
  'read',
  'queued',
  'sent',
  'failed',
]);

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 20;
const MAX_CURSOR_LENGTH = 512;
const MAX_METADATA_BYTES = 16384;
const MAX_FAILURE_CODE_LENGTH = 80;

function createNotificationService({
  notificationRepository,
  pushProvider,
  emailService,
  auditService,
  clock = () => new Date(),
}) {
  requireDependency(notificationRepository, 'notificationRepository');

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  if (typeof notificationRepository.create !== 'function') {
    throw new ServiceError(
      'Notification repository must implement create().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  if (typeof notificationRepository.findById !== 'function') {
    throw new ServiceError(
      'Notification repository must implement findById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  if (typeof notificationRepository.updateById !== 'function') {
    throw new ServiceError(
      'Notification repository must implement updateById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
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

  function normalizeLimit(value) {
    if (value === undefined || value === null || value === '') {
      return DEFAULT_LIST_LIMIT;
    }

    const parsed = Number(value);

    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      throw new ServiceError('Invalid notification list limit.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    return Math.min(parsed, MAX_LIST_LIMIT);
  }

  function normalizeCursor(value) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (
      typeof value !== 'string' ||
      value.length > MAX_CURSOR_LENGTH ||
      /[\u0000-\u001f\u007f]/.test(value)
    ) {
      throw new ServiceError('Invalid notification cursor.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    return value;
  }

  function normalizeMetadata(value) {
    const metadata = plainObject(value, 'metadata');

    let serialized;

    try {
      serialized = JSON.stringify(metadata);
    } catch {
      throw new ServiceError('Invalid notification metadata.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    if (
      typeof serialized !== 'string' ||
      Buffer.byteLength(serialized, 'utf8') > MAX_METADATA_BYTES
    ) {
      throw new ServiceError(
        'Notification metadata exceeds the allowed size.',
        {
          code: 'VALIDATION_ERROR',
          status: 422,
        },
      );
    }

    return JSON.parse(serialized);
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

  function assertRecipient(item, userId) {
    if (
      userId == null ||
      item.recipientId == null ||
      String(item.recipientId) !== String(userId)
    ) {
      throw new ServiceError('Notification not found.', {
        code: 'NOT_FOUND',
        status: 404,
      });
    }
  }

  function normalizeFailureCode(error) {
    const code = error?.code;

    if (
      typeof code === 'string' &&
      /^[a-zA-Z0-9_-]{1,80}$/.test(code)
    ) {
      return code;
    }

    return 'DELIVERY_FAILED';
  }

  async function persistDeliveryFailure(item, error) {
    try {
      await notificationRepository.updateById(item.id, {
        status: 'failed',
        failureCode: normalizeFailureCode(error),
        updatedAt: getNow(),
      });
    } catch {
      // Send persistence failures to infrastructure monitoring.
    }
  }

  return {
    async create({
      recipientId,
      title,
      message,
      channel = 'in_app',
      metadata = {},
    } = {}) {
      requiredId(recipientId, 'recipientId');

      const safeTitle = requiredString(title, 'title', {
        max: 160,
      });

      const safeMessage = requiredString(message, 'message', {
        max: 5000,
      });

      if (!ALLOWED_CHANNELS.has(channel)) {
        throw new ServiceError(
          'Unsupported notification channel.',
          {
            code: 'VALIDATION_ERROR',
            status: 422,
            details: {
              allowed: [...ALLOWED_CHANNELS],
            },
          },
        );
      }

      const safeMetadata = normalizeMetadata(metadata);

      if (
        channel === 'email' &&
        (
          typeof safeMetadata.email !== 'string' ||
          safeMetadata.email.trim().length === 0 ||
          safeMetadata.email.length > 254 ||
          !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(
            safeMetadata.email.trim(),
          )
        )
      ) {
        throw new ServiceError(
          'A valid recipient email address is required.',
          {
            code: 'VALIDATION_ERROR',
            status: 422,
          },
        );
      }

      const now = getNow();

      const item = assertFound(
        await notificationRepository.create({
          recipientId,
          title: safeTitle,
          message: safeMessage,
          channel,
          metadata: safeMetadata,
          status: channel === 'in_app' ? 'unread' : 'queued',
          createdAt: now,
          updatedAt: now,
        }),
        'Notification',
      );

      if (channel === 'in_app') {
        await audit(auditService, {
          action: 'notification.created',
          entity: 'Notification',
          entityId: item.id,
          actorId: recipientId,
          metadata: { channel },
        });

        return item;
      }

      try {
        if (channel === 'email') {
          if (typeof emailService?.send !== 'function') {
            throw new ServiceError(
              'Email channel is not configured.',
              {
                code: 'EMAIL_NOT_CONFIGURED',
                status: 503,
              },
            );
          }

          await emailService.send({
            to: safeMetadata.email.trim(),
            subject: safeTitle,
            text: safeMessage,
          });
        } else if (channel === 'push') {
          if (typeof pushProvider?.send !== 'function') {
            throw new ServiceError(
              'Push channel is not configured.',
              {
                code: 'PUSH_NOT_CONFIGURED',
                status: 503,
              },
            );
          }

          await pushProvider.send({
            recipientId,
            title: safeTitle,
            message: safeMessage,
            metadata: safeMetadata,
          });
        }

        const updated = assertFound(
          await notificationRepository.updateById(item.id, {
            status: 'sent',
            sentAt: getNow(),
            updatedAt: getNow(),
          }),
          'Notification',
        );

        await audit(auditService, {
          action: 'notification.sent',
          entity: 'Notification',
          entityId: item.id,
          actorId: recipientId,
          metadata: { channel },
        });

        return updated;
      } catch (error) {
        await persistDeliveryFailure(item, error);

        if (error instanceof ServiceError) {
          throw error;
        }

        throw new ServiceError(
          'Notification delivery failed. Please try again later.',
          {
            code: 'DELIVERY_FAILED',
            status: 502,
          },
        );
      }
    },

    async listForUser(userId, query = {}, actor = { id: userId }) {
      requiredId(userId, 'userId');
      validateActor(actor);

      if (
        actor.id == null ||
        String(actor.id) !== String(userId)
      ) {
        if (actor.isAdmin !== true) {
          throw new ServiceError('Notification listing not found.', {
            code: 'NOT_FOUND',
            status: 404,
          });
        }
      }

      if (
        !query ||
        typeof query !== 'object' ||
        Array.isArray(query)
      ) {
        throw new ServiceError('Invalid notification query.', {
          code: 'VALIDATION_ERROR',
          status: 422,
        });
      }

      if (
        typeof notificationRepository.listForRecipient !== 'function'
      ) {
        throw new ServiceError(
          'Notification listing is not configured.',
          {
            code: 'NOTIFICATION_REPOSITORY_MISCONFIGURED',
            status: 501,
          },
        );
      }

      return notificationRepository.listForRecipient(userId, {
        limit: normalizeLimit(query.limit),
        cursor: normalizeCursor(query.cursor),
      });
    },

    async markRead(id, userId, actor = { id: userId }) {
      requiredId(id, 'notificationId');
      requiredId(userId, 'userId');
      validateActor(actor);

      if (
        actor.id == null ||
        String(actor.id) !== String(userId)
      ) {
        if (actor.isAdmin !== true) {
          throw new ServiceError('Notification not found.', {
            code: 'NOT_FOUND',
            status: 404,
          });
        }
      }

      const item = assertFound(
        await notificationRepository.findById(id),
        'Notification',
      );

      assertRecipient(item, userId);

      if (!ALLOWED_STATUSES.has(item.status)) {
        throw new ServiceError(
          'Notification has an invalid stored status.',
          {
            code: 'INVALID_STATE',
            status: 409,
          },
        );
      }

      if (item.channel !== 'in_app') {
        throw new ServiceError(
          'Only in-app notifications can be marked as read.',
          {
            code: 'INVALID_STATE',
            status: 409,
          },
        );
      }

      if (item.status === 'read') {
        return item;
      }

      if (item.status !== 'unread') {
        throw new ServiceError(
          'This notification cannot be marked as read.',
          {
            code: 'INVALID_STATE',
            status: 409,
          },
        );
      }

      let updated;

      if (
        typeof notificationRepository.markReadIfUnread === 'function'
      ) {
        updated = await notificationRepository.markReadIfUnread(
          id,
          userId,
          {
            status: 'read',
            readAt: getNow(),
            updatedAt: getNow(),
          },
        );
      } else {
        updated = await notificationRepository.updateById(id, {
          status: 'read',
          readAt: getNow(),
          updatedAt: getNow(),
        });
      }

      if (!updated) {
        throw new ServiceError(
          'Notification changed concurrently. Reload and try again.',
          {
            code: 'STATE_CONFLICT',
            status: 409,
          },
        );
      }

      await audit(auditService, {
        action: 'notification.read',
        entity: 'Notification',
        entityId: id,
        actorId: actor.id,
      });

      return updated;
    },
  };
}

module.exports = {
  createNotificationService,
  ALLOWED_CHANNELS,
  ALLOWED_STATUSES,
  MAX_LIST_LIMIT,
  DEFAULT_LIST_LIMIT,
};
