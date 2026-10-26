'use strict';

const {
  ServiceError,
  createCrudService,
  requiredId,
  requiredString,
  plainObject,
  assertFound,
  audit,
} = require('./service-utils');

const ALLOWED_STATUSES = new Set([
  'active',
  'suspended',
  'disabled',
  'pending_verification',
]);

// Explicit public fields are safer than removing known secrets
// from an otherwise unrestricted user object.
const PUBLIC_USER_FIELDS = new Set([
  'id',
  'name',
  'email',
  'status',
  'roles',
  'role',
  'emailVerifiedAt',
  'createdAt',
  'updatedAt',
  'profile',
  'avatarUrl',
  'phone',
  'location',
  'bio',
]);

const BLOCKED_PROFILE_FIELDS = new Set([
  'id',
  '_id',
  'userId',
  'role',
  'roles',
  'status',
  'password',
  'passwordHash',
  'password_hash',
  'resetToken',
  'resetTokenHash',
  'reset_token',
  'reset_token_hash',
  'verificationToken',
  'verificationTokenHash',
  'verification_token',
  'verification_token_hash',
  'emailVerifiedAt',
  'isAdmin',
  'permissions',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'refreshToken',
  'accessToken',
  'sessionToken',
  'mfaSecret',
  'twoFactorSecret',
]);

const PROFILE_FIELDS = new Set([
  'name',
  'phone',
  'location',
  'bio',
  'avatarUrl',
]);

function sanitizeUser(user) {
  if (
    !user ||
    typeof user !== 'object' ||
    Array.isArray(user)
  ) {
    return null;
  }

  const safe = {};

  for (const field of PUBLIC_USER_FIELDS) {
    if (
      Object.prototype.hasOwnProperty.call(user, field) &&
      user[field] !== undefined
    ) {
      safe[field] = user[field];
    }
  }

  return safe;
}

function createUserService({
  userRepository,
  auditService,
}) {
  if (
    !userRepository ||
    typeof userRepository !== 'object'
  ) {
    throw new TypeError('userRepository is required.');
  }

  if (typeof userRepository.findById !== 'function') {
    throw new TypeError(
      'userRepository must implement findById().',
    );
  }

  if (typeof userRepository.updateById !== 'function') {
    throw new TypeError(
      'userRepository must implement updateById().',
    );
  }

  const crud = createCrudService({
    repository: userRepository,
    entity: 'User',
    auditService,
    allowedSort: ['createdAt', 'updatedAt', 'name'],
  });

  async function getUserById(id) {
    requiredId(id);

    return assertFound(
      await userRepository.findById(id),
      'User',
    );
  }

  function validateProfileInput(input) {
    const data = plainObject(input, 'profile');

    for (const field of Object.keys(data)) {
      if (BLOCKED_PROFILE_FIELDS.has(field)) {
        throw new ServiceError(
          `The ${field} field cannot be changed through profile updates.`,
          {
            code: 'PROFILE_FIELD_NOT_ALLOWED',
            status: 422,
          },
        );
      }

      if (!PROFILE_FIELDS.has(field)) {
        throw new ServiceError(
          `Unsupported profile field: ${field}.`,
          {
            code: 'PROFILE_FIELD_NOT_ALLOWED',
            status: 422,
          },
        );
      }
    }

    if (Object.keys(data).length === 0) {
      throw new ServiceError(
        'At least one profile field must be provided.',
        {
          code: 'EMPTY_PROFILE_UPDATE',
          status: 422,
        },
      );
    }

    if (data.name !== undefined) {
      data.name = requiredString(data.name, 'name', {
        min: 1,
        max: 120,
      });
    }

    if (data.phone !== undefined) {
      data.phone = requiredString(data.phone, 'phone', {
        min: 7,
        max: 30,
      });
    }

    if (data.location !== undefined) {
      data.location = requiredString(
        data.location,
        'location',
        { max: 200 },
      );
    }

    if (data.bio !== undefined) {
      data.bio = requiredString(data.bio, 'bio', {
        min: 0,
        max: 2000,
      });
    }

    if (data.avatarUrl !== undefined) {
      data.avatarUrl = requiredString(
        data.avatarUrl,
        'avatarUrl',
        { max: 2048 },
      );

      let parsedUrl;

      try {
        parsedUrl = new URL(data.avatarUrl);
      } catch {
        throw new ServiceError(
          'avatarUrl must be a valid HTTPS URL.',
          {
            code: 'VALIDATION_ERROR',
            status: 422,
          },
        );
      }

      if (
        parsedUrl.protocol !== 'https:' ||
        parsedUrl.username ||
        parsedUrl.password
      ) {
        throw new ServiceError(
          'avatarUrl must be a valid HTTPS URL without embedded credentials.',
          {
            code: 'VALIDATION_ERROR',
            status: 422,
          },
        );
      }
    }

    return data;
  }

  return {
    ...crud,

    async getProfile(id, actor = {}) {
      requiredId(id);
      const actorData = plainObject(actor, 'actor');

      // Authorization must be enforced here or by the calling
      // controller/policy. A user must not access another user's
      // profile merely by supplying their ID.
      if (
        actorData.id !== id &&
        !actorData.permissions?.includes?.('users:read')
      ) {
        throw new ServiceError(
          'You are not authorized to access this profile.',
          {
            code: 'FORBIDDEN',
            status: 403,
          },
        );
      }

      return sanitizeUser(await getUserById(id));
    },

    async updateProfile(id, input, actor = {}) {
      requiredId(id);
      const actorData = plainObject(actor, 'actor');

      if (
        actorData.id !== id &&
        !actorData.permissions?.includes?.('users:update')
      ) {
        throw new ServiceError(
          'You are not authorized to update this profile.',
          {
            code: 'FORBIDDEN',
            status: 403,
          },
        );
      }

      const data = validateProfileInput(input);

      const result = assertFound(
        await userRepository.updateById(id, data),
        'User',
      );

      await audit(auditService, {
        action: 'user.profile_updated',
        entity: 'User',
        entityId: id,
        actorId: actorData.id,
        metadata: {
          changedFields: Object.keys(data),
        },
      });

      return sanitizeUser(result);
    },

    async setStatus(id, status, actor = {}) {
      requiredId(id);
      const actorData = plainObject(actor, 'actor');

      if (!actorData.permissions?.includes?.('users:manage')) {
        throw new ServiceError(
          'You are not authorized to change user status.',
          {
            code: 'FORBIDDEN',
            status: 403,
          },
        );
      }

      if (!ALLOWED_STATUSES.has(status)) {
        throw new ServiceError(
          'Unsupported user status.',
          {
            code: 'VALIDATION_ERROR',
            status: 422,
          },
        );
      }

      const result = assertFound(
        await userRepository.updateById(id, { status }),
        'User',
      );

      await audit(auditService, {
        action: 'user.status_changed',
        entity: 'User',
        entityId: id,
        actorId: actorData.id,
        metadata: { status },
      });

      return sanitizeUser(result);
    },
  };
}

module.exports = {
  createUserService,
  sanitizeUser,
  ALLOWED_STATUSES,
  BLOCKED_PROFILE_FIELDS,
};