
'use strict';

const {
  ServiceError,
  requireDependency,
  requiredId,
  assertFound,
  audit,
} = require('./service-utils');

const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_USER_AGENT_LENGTH = 1024;
const MAX_IP_ADDRESS_LENGTH = 64;

function createSessionService({
  sessionRepository,
  auditService,
  ttlSeconds = 86400,
  clock = () => new Date(),
}) {
  requireDependency(sessionRepository, 'sessionRepository');

  if (
    typeof sessionRepository.create !== 'function' ||
    typeof sessionRepository.findById !== 'function' ||
    typeof sessionRepository.updateById !== 'function'
  ) {
    throw new ServiceError(
      'Session repository is missing required methods.',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  if (
    !Number.isSafeInteger(ttlSeconds) ||
    ttlSeconds < MIN_TTL_SECONDS ||
    ttlSeconds > MAX_TTL_SECONDS
  ) {
    throw new TypeError(
      `ttlSeconds must be an integer between ${MIN_TTL_SECONDS} and ${MAX_TTL_SECONDS}.`,
    );
  }

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  function getNow() {
    const value = clock();
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new ServiceError('Invalid service clock value.', {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      });
    }

    return date;
  }

  function isExpired(session, now = getNow()) {
    if (!session || session.expiresAt == null) {
      return true;
    }

    const expiry = new Date(session.expiresAt);

    return (
      Number.isNaN(expiry.getTime()) ||
      expiry.getTime() <= now.getTime()
    );
  }

  function invalidSessionError() {
    return new ServiceError('Session is invalid or expired.', {
      code: 'SESSION_INVALID',
      status: 401,
    });
  }

  function normalizeContext(context) {
    if (
      context === null ||
      typeof context !== 'object' ||
      Array.isArray(context)
    ) {
      throw new ServiceError('Invalid session context.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    const ip =
      typeof context.ip === 'string' &&
      context.ip.length <= MAX_IP_ADDRESS_LENGTH &&
      !/[\r\n\u0000-\u001f\u007f]/.test(context.ip)
        ? context.ip
        : null;

    const userAgent =
      typeof context.userAgent === 'string'
        ? context.userAgent
            .replace(/[\r\n\u0000-\u001f\u007f]/g, ' ')
            .slice(0, MAX_USER_AGENT_LENGTH)
        : null;

    return { ip, userAgent };
  }

  return {
    async create(userId, context = {}) {
      requiredId(userId, 'userId');

      const now = getNow();
      const { ip, userAgent } = normalizeContext(context);
      const expiresAt = new Date(
        now.getTime() + ttlSeconds * 1000,
      );

      const session = await sessionRepository.create({
        userId,
        expiresAt,
        ipAddress: ip,
        userAgent,
        revokedAt: null,
        createdAt: now,
      });

      assertFound(session, 'Session');

      // This object is for trusted internal callers only.
      // Public responses must use an explicit safe-field allowlist.
      return session;
    },

    async getActive(sessionId, userId) {
      requiredId(sessionId, 'sessionId');
      requiredId(userId, 'userId');

      const session = await sessionRepository.findById(sessionId);

      if (
        !session ||
        String(session.userId) !== String(userId) ||
        session.revokedAt != null ||
        isExpired(session, getNow())
      ) {
        throw invalidSessionError();
      }

      return session;
    },

    async revoke(sessionId, userId) {
      requiredId(sessionId, 'sessionId');

      if (userId !== undefined && userId !== null) {
        requiredId(userId, 'userId');
      }

      const session = await sessionRepository.findById(sessionId);

      // Return the same result for missing sessions.
      if (!session) {
        return { revoked: true };
      }

      if (
        userId !== undefined &&
        userId !== null &&
        String(session.userId) !== String(userId)
      ) {
        throw new ServiceError('Session not found.', {
          code: 'NOT_FOUND',
          status: 404,
        });
      }

      if (session.revokedAt != null) {
        return { revoked: true };
      }

      const revokedAt = getNow();

      // Prefer a repository-level conditional update to prevent
      // concurrent requests from overwriting revocation state.
      if (
        typeof sessionRepository.revokeIfActive === 'function'
      ) {
        await sessionRepository.revokeIfActive(
          sessionId,
          revokedAt,
        );
      } else {
        assertFound(
          await sessionRepository.updateById(sessionId, {
            revokedAt,
          }),
          'Session',
        );
      }

      await audit(auditService, {
        action: 'session.revoked',
        entity: 'Session',
        entityId: sessionId,
        actorId: userId ?? session.userId,
      });

      return { revoked: true };
    },

    async revokeAllForUser(userId) {
      requiredId(userId, 'userId');

      if (
        typeof sessionRepository.revokeAllForUser !== 'function'
      ) {
        throw new ServiceError(
          'Bulk session revocation is not configured.',
          {
            code: 'SESSION_REPOSITORY_MISCONFIGURED',
            status: 501,
          },
        );
      }

      const revokedAt = getNow();

      const result = await sessionRepository.revokeAllForUser(
        userId,
        revokedAt,
      );

      await audit(auditService, {
        action: 'session.all_revoked',
        entity: 'User',
        entityId: userId,
        actorId: userId,
      });

      return result;
    },
  };
}

module.exports = {
  createSessionService,
  MIN_TTL_SECONDS,
  MAX_TTL_SECONDS,
};
