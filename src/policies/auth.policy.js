
'use strict';

/**
 * MedOrbits -- Authentication Authorization Policies
 *
 * File: src/policies/auth.policy.js
 * Runtime: Node.js >= 20
 *
 * Controls authentication eligibility, authenticated access, account
 * management, session management, password operations, and privileged
 * authentication configuration.
 *
 * Security requirements:
 * - Actor identity, roles, and permissions must come from trusted
 *   authentication middleware or a verified server-side session.
 * - These policies do not validate credentials, tokens, sessions,
 *   password-reset tokens, or database state.
 * - Services must enforce atomic database updates and audit sensitive
 *   administrative actions.
 */

const {
  isAdmin,
  hasRole,
  hasPermission,
  sameId,
  actorId,
} = require('./policy-utils');

const DISABLED_STATUSES = new Set([
  'disabled',
  'suspended',
  'locked',
  'deleted',
  'banned',
  'deactivated',
]);

const SESSION_OWNER_FIELDS = Object.freeze([
  'userId',
  'user_id',
  'ownerId',
  'owner_id',
  'accountId',
  'account_id',
]);

const PASSWORD_RESET_EMAIL_MAX_LENGTH = 254;

function normalizeStatus(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase()
    : '';
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isDeleted(account) {
  return (
    account.deletedAt != null ||
    account.deleted_at != null
  );
}

function isAccountDisabled(account) {
  if (!account || typeof account !== 'object') {
    return true;
  }

  if (
    account.isDisabled === true ||
    account.isSuspended === true ||
    account.isLocked === true ||
    account.isDeleted === true ||
    account.is_deleted === true ||
    isDeleted(account)
  ) {
    return true;
  }

  return DISABLED_STATUSES.has(normalizeStatus(account.status));
}

/**
 * Determines whether a stored account may authenticate.
 *
 * Verification rules must match the actual registration workflow.
 * This implementation blocks explicitly unverified/pending accounts
 * but does not require a verification field when it is absent.
 */
function canAuthenticate(account) {
  if (
    !account ||
    typeof account !== 'object' ||
    Array.isArray(account) ||
    isAccountDisabled(account)
  ) {
    return false;
  }

  const status = normalizeStatus(account.status);

  if (
    status === 'pending_verification' ||
    status === 'unverified' ||
    status === 'pending'
  ) {
    return false;
  }

  if (
    account.emailVerified === false ||
    account.email_verified === false
  ) {
    return false;
  }

  return true;
}

/**
 * Determines whether an authenticated actor may access protected
 * routes. Token and session verification must already have succeeded.
 */
function canAccessAuthenticatedResources(actor) {
  return Boolean(
    actor &&
    typeof actor === 'object' &&
    !Array.isArray(actor) &&
    !isAccountDisabled(actor) &&
    !['pending_verification', 'unverified', 'pending'].includes(
      normalizeStatus(actor.status)
    ) &&
    actor.emailVerified !== false &&
    actor.email_verified !== false
  );
}

function validTargetUserId(targetUserId) {
  return (
    targetUserId !== null &&
    targetUserId !== undefined &&
    targetUserId !== ''
  );
}

/**
 * Controls account-management access.
 */
function canManageAccount(actor, targetUserId) {
  if (
    !canAccessAuthenticatedResources(actor) ||
    !validTargetUserId(targetUserId)
  ) {
    return false;
  }

  if (sameId(actorId(actor), targetUserId)) {
    return true;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'users:manage:any')
  );
}

/**
 * Controls viewing authentication-related account information.
 * Callers must still redact password hashes, tokens, MFA secrets,
 * recovery codes, and other authentication secrets.
 */
function canViewAuthAccount(actor, targetUserId) {
  if (
    !canAccessAuthenticatedResources(actor) ||
    !validTargetUserId(targetUserId)
  ) {
    return false;
  }

  if (sameId(actorId(actor), targetUserId)) {
    return true;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'auth:accounts:read:any')
  );
}

/**
 * Controls administrative changes to another account's status.
 * The service must validate the target status and allowed transition.
 */
function canChangeAccountStatus(actor, targetUserId) {
  if (
    !canAccessAuthenticatedResources(actor) ||
    !validTargetUserId(targetUserId) ||
    sameId(actorId(actor), targetUserId)
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'auth:accounts:status:update')
  );
}

/**
 * Resolves a session owner from trusted stored session data.
 */
function sessionOwnerId(session) {
  if (!session || typeof session !== 'object') {
    return null;
  }

  for (const field of SESSION_OWNER_FIELDS) {
    if (
      session[field] !== undefined &&
      session[field] !== null &&
      session[field] !== ''
    ) {
      return session[field];
    }
  }

  return null;
}

function isSessionRevoked(session) {
  return Boolean(
    session.revoked === true ||
    session.revokedAt != null ||
    session.revoked_at != null
  );
}

function isSessionExpired(session, now = Date.now()) {
  const rawExpiry = session.expiresAt ?? session.expires_at;

  if (rawExpiry == null) {
    // Missing expiry is not proof that the session is valid.
    return true;
  }

  const expiry =
    rawExpiry instanceof Date
      ? rawExpiry.getTime()
      : typeof rawExpiry === 'number'
        ? rawExpiry
        : Date.parse(rawExpiry);

  return !Number.isFinite(expiry) || expiry <= now;
}

/**
 * Controls viewing or managing a live session.
 * The service must additionally load the authoritative session record.
 */
function canManageSession(actor, session) {
  if (
    !canAccessAuthenticatedResources(actor) ||
    !session ||
    typeof session !== 'object' ||
    Array.isArray(session) ||
    isSessionRevoked(session) ||
    isSessionExpired(session)
  ) {
    return false;
  }

  const ownerId = sessionOwnerId(session);

  if (!validTargetUserId(ownerId)) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'auth:sessions:manage:any')
  ) {
    return true;
  }

  return sameId(actorId(actor), ownerId);
}

/**
 * Controls revocation of a session, including idempotent service
 * handling for already-revoked sessions.
 */
function canRevokeSession(actor, session) {
  if (
    !canAccessAuthenticatedResources(actor) ||
    !session ||
    typeof session !== 'object' ||
    Array.isArray(session)
  ) {
    return false;
  }

  const ownerId = sessionOwnerId(session);

  if (!validTargetUserId(ownerId)) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'auth:sessions:revoke:any')
  ) {
    return true;
  }

  return sameId(actorId(actor), ownerId);
}

/**
 * Controls revoking all sessions belonging to a target account.
 */
function canRevokeAllSessions(actor, targetUserId) {
  if (
    !canAccessAuthenticatedResources(actor) ||
    !validTargetUserId(targetUserId)
  ) {
    return false;
  }

  if (sameId(actorId(actor), targetUserId)) {
    return true;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'auth:sessions:revoke:any')
  );
}

/**
 * Controls changing the authenticated user's own password.
 * The service must verify the current password or a valid reset token.
 */
function canChangeOwnPassword(actor, targetUserId) {
  return Boolean(
    canAccessAuthenticatedResources(actor) &&
    validTargetUserId(targetUserId) &&
    sameId(actorId(actor), targetUserId)
  );
}

/**
 * Validates the shape of a public password-reset request.
 *
 * Always return a generic response from the endpoint so callers
 * cannot determine whether an email address has an account.
 */
function canRequestPasswordReset(input) {
  if (!isPlainObject(input) || typeof input.email !== 'string') {
    return false;
  }

  const email = input.email.trim();

  return (
    email.length > 0 &&
    email.length <= PASSWORD_RESET_EMAIL_MAX_LENGTH &&
    !/[\r\n]/.test(email) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

/**
 * Controls administrative password resets for another user.
 * Password-reset tokens, notification delivery, rate limiting,
 * and audit logging remain service responsibilities.
 */
function canResetAnotherUserPassword(actor, targetUserId) {
  if (
    !canAccessAuthenticatedResources(actor) ||
    !validTargetUserId(targetUserId) ||
    sameId(actorId(actor), targetUserId)
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'auth:password:reset:any')
  );
}

/**
 * Controls access to privileged authentication configuration.
 */
function canManageAuthConfiguration(actor) {
  return Boolean(
    canAccessAuthenticatedResources(actor) &&
    (
      isAdmin(actor) ||
      hasPermission(actor, 'auth:configuration:manage')
    )
  );
}

/**
 * Controls access to privileged authentication operations.
 *
 * Permission and role claims must be server-verified. Do not trust
 * arbitrary permissions supplied by a request or unverified JWT.
 */
function canUsePrivilegedAuthOperations(actor) {
  if (!canAccessAuthenticatedResources(actor)) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasRole(actor, 'support', 'counsellor') ||
    hasPermission(actor, 'auth:operations:use')
  );
}

module.exports = Object.freeze({
  DISABLED_STATUSES,
  SESSION_OWNER_FIELDS,
  normalizeStatus,
  isAccountDisabled,
  canAuthenticate,
  canAccessAuthenticatedResources,
  canManageAccount,
  canViewAuthAccount,
  canChangeAccountStatus,
  sessionOwnerId,
  isSessionRevoked,
  isSessionExpired,
  canManageSession,
  canRevokeSession,
  canRevokeAllSessions,
  canChangeOwnPassword,
  canRequestPasswordReset,
  canResetAnotherUserPassword,
  canManageAuthConfiguration,
  canUsePrivilegedAuthOperations,
});
