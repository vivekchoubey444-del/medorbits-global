
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

const DEFAULT_TOKEN_TTL_MS = 30 * 60 * 1000;
const MIN_TOKEN_TTL_MS = 60 * 1000;
const MAX_TOKEN_TTL_MS = 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 200;
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function createPasswordService({
  userRepository,
  passwordResetRepository,
  passwordHasher,
  emailService,
  sessionService,
  auditService,
  clock = () => new Date(),
  tokenTtlMs = DEFAULT_TOKEN_TTL_MS,
}) {
  requireDependency(userRepository, 'userRepository');
  requireDependency(passwordResetRepository, 'passwordResetRepository');
  requireDependency(passwordHasher, 'passwordHasher');

  if (
    typeof userRepository.findByEmail !== 'function' ||
    typeof userRepository.findById !== 'function' ||
    typeof userRepository.updateById !== 'function'
  ) {
    throw new ServiceError(
      'User repository is missing required methods.',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  if (
    typeof passwordResetRepository.create !== 'function' ||
    typeof passwordResetRepository.findValidByHash !== 'function' ||
    typeof passwordResetRepository.updateById !== 'function'
  ) {
    throw new ServiceError(
      'Password reset repository is missing required methods.',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  if (
    typeof passwordHasher.hash !== 'function' ||
    typeof passwordHasher.verify !== 'function'
  ) {
    throw new ServiceError(
      'Password hasher is missing required methods.',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  if (
    !Number.isSafeInteger(tokenTtlMs) ||
    tokenTtlMs < MIN_TOKEN_TTL_MS ||
    tokenTtlMs > MAX_TOKEN_TTL_MS
  ) {
    throw new TypeError(
      `tokenTtlMs must be between ${MIN_TOKEN_TTL_MS} and ${MAX_TOKEN_TTL_MS}.`,
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

  function hashToken(token) {
    return crypto
      .createHash('sha256')
      .update(token, 'utf8')
      .digest('hex');
  }

  function invalidTokenError() {
    return new ServiceError(
      'Password reset token is invalid, expired, or already used.',
      {
        code: 'TOKEN_INVALID',
        status: 400,
      },
    );
  }

  function validatePassword(value, field = 'password') {
    const password = requiredString(value, field, {
      min: MIN_PASSWORD_LENGTH,
      max: MAX_PASSWORD_LENGTH,
    });

    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(password)) {
      throw new ServiceError(`${field} contains invalid characters.`, {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    return password;
  }

  function normalizeEmail(value) {
    const email = requiredString(value, 'email', {
      max: 254,
    }).toLowerCase();

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      /[\r\n\u0000-\u001f\u007f]/.test(email)
    ) {
      throw new ServiceError('Invalid email address.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    return email;
  }

  async function revokeSessions(userId) {
    if (typeof sessionService?.revokeAllForUser !== 'function') {
      throw new ServiceError(
        'Session revocation is not configured.',
        {
          code: 'SESSION_REVOCATION_UNAVAILABLE',
          status: 503,
        },
      );
    }

    await sessionService.revokeAllForUser(userId);
  }

  async function invalidateOutstandingTokens(userId) {
    if (
      typeof passwordResetRepository.invalidateOutstandingForUser ===
      'function'
    ) {
      await passwordResetRepository.invalidateOutstandingForUser(
        userId,
        getNow(),
      );
    }
  }

  return {
    async requestReset(email) {
      const normalizedEmail = normalizeEmail(email);

      // The public endpoint should return the same response for known
      // and unknown accounts, and apply rate limits before this call.
      const user = await userRepository.findByEmail(normalizedEmail);

      if (!user || !user.id || !user.email) {
        return { accepted: true };
      }

      if (
        user.status &&
        !['active', 'pending_verification'].includes(user.status)
      ) {
        return { accepted: true };
      }

      if (typeof emailService?.sendPasswordResetEmail !== 'function') {
        throw new ServiceError(
          'Password reset delivery is temporarily unavailable.',
          {
            code: 'EMAIL_NOT_CONFIGURED',
            status: 503,
          },
        );
      }

      const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
      const tokenHash = hashToken(token);
      const now = getNow();
      const expiresAt = new Date(now.getTime() + tokenTtlMs);

      await invalidateOutstandingTokens(user.id);

      await passwordResetRepository.create({
        userId: user.id,
        tokenHash,
        expiresAt,
        consumedAt: null,
        createdAt: now,
      });

      try {
        await emailService.sendPasswordResetEmail({
          to: user.email,
          name: typeof user.name === 'string' ? user.name : '',
          token,
          expiresAt,
          expiryMinutes: Math.ceil(tokenTtlMs / 60000),
        });
      } catch {
        // Invalidate the undelivered token where the repository supports it.
        if (
          typeof passwordResetRepository.invalidateByTokenHash ===
          'function'
        ) {
          try {
            await passwordResetRepository.invalidateByTokenHash(
              tokenHash,
              getNow(),
            );
          } catch {
            // Expiry remains the fallback limit for the token.
          }
        }

        throw new ServiceError(
          'Password reset delivery is temporarily unavailable.',
          {
            code: 'EMAIL_DELIVERY_FAILED',
            status: 503,
          },
        );
      }

      return { accepted: true };
    },

    async reset(input = {}) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new ServiceError('Reset input must be an object.', {
          code: 'VALIDATION_ERROR',
          status: 422,
        });
      }

      const token = requiredString(input.token, 'token', {
        min: 64,
        max: 64,
      });

      if (!TOKEN_PATTERN.test(token)) {
        throw invalidTokenError();
      }

      const password = validatePassword(input.password);
      const tokenHash = hashToken(token);
      const now = getNow();

      const reset = await passwordResetRepository.findValidByHash(
        tokenHash,
      );

      if (
        !reset ||
        reset.consumedAt != null ||
        !reset.expiresAt ||
        Number.isNaN(new Date(reset.expiresAt).getTime()) ||
        new Date(reset.expiresAt).getTime() <= now.getTime()
      ) {
        throw invalidTokenError();
      }

      const passwordHash = await passwordHasher.hash(password);

      /*
       * REQUIRED: consume the reset token and update the password
       * atomically. The repository method must conditionally consume
       * the token only if it remains unused and unexpired, then update
       * the user in the same transaction.
       */
      if (
        typeof passwordResetRepository.consumeAndUpdatePassword !==
        'function'
      ) {
        throw new ServiceError(
          'Atomic password reset is not configured.',
          {
            code: 'PASSWORD_RESET_MISCONFIGURED',
            status: 503,
          },
        );
      }

      const updatedUser =
        await passwordResetRepository.consumeAndUpdatePassword({
          tokenHash,
          now,
          passwordHash,
          passwordChangedAt: now,
        });

      if (!updatedUser) {
        throw invalidTokenError();
      }

      assertFound(updatedUser, 'User');

      // Password change is committed; do not report success if sessions
      // remain active. Operational monitoring should alert on failures.
      await revokeSessions(updatedUser.id);

      await audit(auditService, {
        action: 'password.reset',
        entity: 'User',
        entityId: updatedUser.id,
        actorId: updatedUser.id,
      });

      return { passwordReset: true };
    },

    async change(userId, input = {}) {
      requiredId(userId, 'userId');

      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new ServiceError('Password input must be an object.', {
          code: 'VALIDATION_ERROR',
          status: 422,
        });
      }

      const currentPassword = requiredString(
        input.currentPassword,
        'currentPassword',
        { max: MAX_PASSWORD_LENGTH },
      );

      const newPassword = validatePassword(
        input.newPassword,
        'newPassword',
      );

      if (currentPassword === newPassword) {
        throw new ServiceError(
          'New password must differ from the current password.',
          {
            code: 'VALIDATION_ERROR',
            status: 422,
          },
        );
      }

      const user = assertFound(
        await userRepository.findById(userId),
        'User',
      );

      if (
        typeof user.passwordHash !== 'string' ||
        user.passwordHash.length === 0
      ) {
        throw new ServiceError(
          'Password authentication is unavailable for this account.',
          {
            code: 'PASSWORD_NOT_CONFIGURED',
            status: 409,
          },
        );
      }

      const valid = await passwordHasher.verify(
        currentPassword,
        user.passwordHash,
      );

      if (valid !== true) {
        throw new ServiceError('Current password is incorrect.', {
          code: 'INVALID_CREDENTIALS',
          status: 401,
        });
      }

      const passwordHash = await passwordHasher.hash(newPassword);
      const now = getNow();

      if (
        typeof userRepository.changePasswordIfHashMatches !== 'function'
      ) {
        throw new ServiceError(
          'Atomic password updates are not configured.',
          {
            code: 'PASSWORD_CHANGE_MISCONFIGURED',
            status: 503,
          },
        );
      }

      const updatedUser =
        await userRepository.changePasswordIfHashMatches({
          userId,
          expectedPasswordHash: user.passwordHash,
          passwordHash,
          passwordChangedAt: now,
        });

      if (!updatedUser) {
        throw new ServiceError(
          'Password changed by another request. Please sign in again.',
          {
            code: 'PASSWORD_STATE_CONFLICT',
            status: 409,
          },
        );
      }

      await revokeSessions(userId);

      await audit(auditService, {
        action: 'password.changed',
        entity: 'User',
        entityId: userId,
        actorId: userId,
      });

      return { passwordChanged: true };
    },
  };
}

module.exports = {
  createPasswordService,
  DEFAULT_TOKEN_TTL_MS,
  MIN_TOKEN_TTL_MS,
  MAX_TOKEN_TTL_MS,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
};
