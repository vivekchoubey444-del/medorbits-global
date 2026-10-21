'use strict';

/**
 * MedOrbits -- User Authorization Policies
 *
 * File: src/policies/user.policy.js
 * Runtime: Node.js >= 20
 *
 * Authorization helpers for user profiles, account status, roles,
 * permissions, deletion, exports, activity, and session management.
 *
 * IMPORTANT:
 * - `actor` must come from trusted authentication middleware.
 * - These helpers do not replace service-level validation or database checks.
 * - Never authorize using client-supplied role or permission fields.
 */

const {
  isAdmin,
  hasPermission,
  sameId,
  actorId,
  safeStatus,
} = require('./policy-utils');

const DISABLED_STATUSES = new Set([
  'suspended',
  'disabled',
  'locked',
  'deleted',
  'banned',
]);

const PROTECTED_FIELDS = new Set([
  'id',
  '_id',
  'userId',
  'role',
  'roles',
  'permissions',
  'status',
  'isAdmin',
  'isVerified',
  'isSuspended',
  'isDisabled',
  'isLocked',
  'emailVerified',
  'emailVerifiedAt',
  'verifiedAt',
  'password',
  'passwordHash',
  'password_hash',
  'passwordResetToken',
  'passwordResetExpiresAt',
  'verificationToken',
  'verificationTokenHash',
  'refreshToken',
  'refreshTokenHash',
  'mfaSecret',
  'recoveryCodes',
  'createdAt',
  'updatedAt',
  'deletedAt',
]);

const PRIVATE_PROFILE_FIELDS = new Set([
  'email',
  'phone',
  'dateOfBirth',
  'date_of_birth',
  'address',
  'documents',
  'identityDocuments',
  'identity_documents',
]);

const PUBLIC_REGISTRATION_FORBIDDEN_FIELDS = new Set([
  ...PROTECTED_FIELDS,
  'email_verified_at',
  'verified_at',
  'deleted_at',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function userId(user) {
  if (!user || typeof user !== 'object') {
    return null;
  }

  return user.id ?? user._id ?? user.userId ?? user.user_id ?? null;
}

function isUserOwner(actor, user) {
  if (!actor || !user || typeof user !== 'object') {
    return false;
  }

  const targetId = userId(user);
  const currentActorId = actorId(actor);

  return (
    targetId !== null &&
    targetId !== undefined &&
    currentActorId !== null &&
    currentActorId !== undefined &&
    sameId(currentActorId, targetId)
  );
}

function isDeletedUser(user) {
  return (
    safeStatus(user?.status) === 'deleted' ||
    user?.deletedAt != null ||
    user?.deleted_at != null
  );
}

function canViewUser(actor, user) {
  if (!actor || !user || typeof user !== 'object' || isDeletedUser(user)) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'users:read:any') ||
    isUserOwner(actor, user)
  );
}

function canViewUserPrivateFields(actor, user) {
  if (!actor || !user || typeof user !== 'object' || isDeletedUser(user)) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    isUserOwner(actor, user) ||
    hasPermission(actor, 'users:read:private')
  );
}

function canCreateUser(actor, input = {}) {
  if (!actor || !isPlainObject(input)) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'users:create:any')
  );
}

/**
 * Checks whether a public registration payload avoids server-managed fields.
 * The registration service must still validate fields and assign the
 * initial role, account status, and verification state itself.
 */
function canRegisterUser(input = {}) {
  if (!isPlainObject(input)) {
    return false;
  }

  return !Object.keys(input).some((key) =>
    PUBLIC_REGISTRATION_FORBIDDEN_FIELDS.has(key)
  );
}

function canUpdateUser(actor, user, changes = {}) {
  if (
    !actor ||
    !user ||
    !isPlainObject(changes) ||
    isDeletedUser(user)
  ) {
    return false;
  }

  const privileged = Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'users:update:any')
  );

  if (privileged) {
    return true;
  }

  if (!isUserOwner(actor, user)) {
    return false;
  }

  if (DISABLED_STATUSES.has(safeStatus(user.status))) {
    return false;
  }

  return !Object.keys(changes).some((key) =>
    PROTECTED_FIELDS.has(key) ||
    PROTECTED_FIELDS.has(key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()))
  );
}

function canChangeUserStatus(actor, user, nextStatus) {
  if (
    !actor ||
    !user ||
    isDeletedUser(user) ||
    typeof nextStatus !== 'string' ||
    !nextStatus.trim()
  ) {
    return false;
  }

  // Prevent self-service status escalation or self-lockout workflows
  // from being authorized by this administrative policy.
  if (isUserOwner(actor, user)) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'users:status:update')
  );
}

function canManageUserRoles(actor, user) {
  if (!actor || !user || isDeletedUser(user) || isUserOwner(actor, user)) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'users:roles:manage')
  );
}

function canManageUserPermissions(actor, user) {
  if (!actor || !user || isDeletedUser(user) || isUserOwner(actor, user)) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'users:permissions:manage')
  );
}

function canDeleteUser(actor, user) {
  if (!actor || !user || isDeletedUser(user)) {
    return false;
  }

  if (isUserOwner(actor, user)) {
    return Boolean(hasPermission(actor, 'users:delete:self'));
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'users:delete:any')
  );
}

function canExportUsers(actor) {
  return Boolean(
    actor &&
    (
      isAdmin(actor) ||
      hasPermission(actor, 'users:export')
    )
  );
}

function canViewUserActivity(actor, user) {
  if (!actor || !user || isDeletedUser(user)) {
    return false;
  }

  return Boolean(
    isUserOwner(actor, user) ||
    isAdmin(actor) ||
    hasPermission(actor, 'users:activity:read:any')
  );
}

function canManageUserSessions(actor, targetUserId) {
  if (
    !actor ||
    targetUserId === null ||
    targetUserId === undefined ||
    targetUserId === ''
  ) {
    return false;
  }

  if (sameId(actorId(actor), targetUserId)) {
    return true;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'auth:sessions:manage:any')
  );
}

module.exports = Object.freeze({
  userId,
  isUserOwner,
  canViewUser,
  canViewUserPrivateFields,
  canCreateUser,
  canRegisterUser,
  canUpdateUser,
  canChangeUserStatus,
  canManageUserRoles,
  canManageUserPermissions,
  canDeleteUser,
  canExportUsers,
  canViewUserActivity,
  canManageUserSessions,
  PRIVATE_PROFILE_FIELDS,
  PROTECTED_FIELDS,
  DISABLED_STATUSES,
});