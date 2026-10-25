'use strict';
/**
 * MedOrbits Authorization Middleware
 * File: api/middleware/authorization.js
 *
 * Responsibilities:
 * - Enforce role-based access control (RBAC).
 * - Enforce permission-based access control.
 * - Support resource ownership checks.
 * - Provide consistent 401 and 403 responses.
 * - Prevent privilege escalation through request data.
 *
 * Expected integration:
 *   const { authenticate } = require('./authentication');
 *   const {
 *     authorizeRoles,
 *     authorizePermissions,
 *     requireOwnership,
 *   } = require('./authorization');
 *
 *   router.get('/admin', authenticate, authorizeRoles('admin'), handler);
 *
 * Important:
 *   Authentication must run before authorization.
 *   For sensitive operations, load current roles and permissions
 *   from a trusted database or authorization service.
 */
const AUTHORIZATION_ERRORS = Object.freeze({
  UNAUTHENTICATED: 'Authentication is required.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  INVALID_CONFIGURATION: 'Authorization configuration is invalid.',
  RESOURCE_NOT_FOUND: 'Resource not found.',
});
/**
 * Send a consistent authorization error.
 *
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string} message
 */
function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    error: {
      status,
      message,
    },
  });
}
/**
 * Normalize a role or permission identifier.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeIdentifier(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase()
    : '';
}
/**
 * Confirm that authentication middleware has attached a user.
 *
 * Expected shape:
 *   req.user = {
 *     id: 'user-id',
 *     role: 'admin',
 *     permissions: ['users:read']
 *   }
 *
 * The identity and authorization data must originate from
 * verified claims or, preferably for sensitive operations,
 * trusted server-side database lookups.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {boolean}
 */
function hasAuthenticatedUser(req, res) {
  if (
    !req.user ||
    typeof req.user.id !== 'string' ||
    !req.user.id.trim()
  ) {
    sendError(
      res,
      401,
      AUTHORIZATION_ERRORS.UNAUTHENTICATED
    );
    return false;
  }
  return true;
}
/**
 * Require one or more roles.
 *
 * Example:
 *   authorizeRoles('admin')
 *   authorizeRoles('admin', 'manager')
 *
 * Roles are matched exactly after normalization.
 * No wildcard role is supported.
 *
 * @param {...string} allowedRoles
 * @returns {import('express').RequestHandler}
 */
function authorizeRoles(...allowedRoles) {
  const roles = allowedRoles
    .map(normalizeIdentifier)
    .filter(Boolean);
  if (roles.length === 0) {
    throw new TypeError(
      'authorizeRoles requires at least one valid role.'
    );
  }
  return function roleAuthorization(req, res, next) {
    if (!hasAuthenticatedUser(req, res)) {
      return;
    }
    const userRole = normalizeIdentifier(req.user.role);
    if (!userRole || !roles.includes(userRole)) {
      return sendError(
        res,
        403,
        AUTHORIZATION_ERRORS.FORBIDDEN
      );
    }
    return next();
  };
}
/**
 * Require all listed permissions.
 *
 * Example:
 *   authorizePermissions('applications:read')
 *   authorizePermissions('applications:read', 'documents:read')
 *
 * By default, permissions must be present in req.user.permissions.
 * An absent or malformed permission list grants no access.
 *
 * @param {...string} requiredPermissions
 * @returns {import('express').RequestHandler}
 */
function authorizePermissions(...requiredPermissions) {
  const required = requiredPermissions
    .map(normalizeIdentifier)
    .filter(Boolean);
  if (required.length === 0) {
    throw new TypeError(
      'authorizePermissions requires at least one valid permission.'
    );
  }
  return function permissionAuthorization(req, res, next) {
    if (!hasAuthenticatedUser(req, res)) {
      return;
    }
    const granted = Array.isArray(req.user.permissions)
      ? req.user.permissions
          .map(normalizeIdentifier)
          .filter(Boolean)
      : [];
    const hasAllPermissions = required.every((permission) =>
      granted.includes(permission)
    );
    if (!hasAllPermissions) {
      return sendError(
        res,
        403,
        AUTHORIZATION_ERRORS.FORBIDDEN
      );
    }
    return next();
  };
}
/**
 * Require at least one listed permission.
 *
 * Example:
 *   authorizeAnyPermission(
 *     'applications:read',
 *     'applications:manage'
 *   )
 *
 * @param {...string} allowedPermissions
 * @returns {import('express').RequestHandler}
 */
function authorizeAnyPermission(...allowedPermissions) {
  const allowed = allowedPermissions
    .map(normalizeIdentifier)
    .filter(Boolean);
  if (allowed.length === 0) {
    throw new TypeError(
      'authorizeAnyPermission requires at least one valid permission.'
    );
  }
  return function anyPermissionAuthorization(req, res, next) {
    if (!hasAuthenticatedUser(req, res)) {
      return;
    }
    const granted = Array.isArray(req.user.permissions)
      ? req.user.permissions
          .map(normalizeIdentifier)
          .filter(Boolean)
      : [];
    if (!allowed.some((permission) => granted.includes(permission))) {
      return sendError(
        res,
        403,
        AUTHORIZATION_ERRORS.FORBIDDEN
      );
    }
    return next();
  };
}
/**
 * Require the authenticated user to own a resource.
 *
 * The ownership identifier is supplied by a trusted server-side
 * resolver, not directly compared with an arbitrary request field.
 *
 * Example:
 *   requireOwnership(async (req) => {
 *     const record = await Application.findById(req.params.id);
 *     if (!record) return null;
 *     return record.userId;
 *   })
 *
 * Resolver contract:
 *   - Return the owner's user ID when the resource exists.
 *   - Return null when the resource does not exist.
 *   - Throw on unexpected database or service errors.
 *
 * @param {(req: import('express').Request) => Promise<string|null>|string|null} resolveOwner
 * @returns {import('express').RequestHandler}
 */
function requireOwnership(resolveOwner) {
  if (typeof resolveOwner !== 'function') {
    throw new TypeError(
      'requireOwnership requires a resource-owner resolver.'
    );
  }
  return async function ownershipAuthorization(req, res, next) {
    if (!hasAuthenticatedUser(req, res)) {
      return;
    }
    try {
      const ownerId = await resolveOwner(req);
      if (ownerId === null || ownerId === undefined) {
        return sendError(
          res,
          404,
          AUTHORIZATION_ERRORS.RESOURCE_NOT_FOUND
        );
      }
      if (
        typeof ownerId !== 'string' ||
        ownerId !== req.user.id
      ) {
        return sendError(
          res,
          403,
          AUTHORIZATION_ERRORS.FORBIDDEN
        );
      }
      return next();
    } catch (error) {
      // Do not expose database errors or sensitive resource details.
      console.error(
        '[MedOrbits Authorization] Ownership verification failed.'
      );
      return res.status(500).json({
        success: false,
        error: {
          status: 500,
          message: 'Unable to verify resource access.',
        },
      });
    }
  };
}
/**
 * Require authentication without adding role restrictions.
 *
 * Useful as a defensive guard on routes that expect req.user.
 *
 * @type {import('express').RequestHandler}
 */
function requireAuthenticated(req, res, next) {
  if (!hasAuthenticatedUser(req, res)) {
    return;
  }
  return next();
}
module.exports = {
  authorizeRoles,
  authorizePermissions,
  authorizeAnyPermission,
  requireOwnership,
  requireAuthenticated,
};