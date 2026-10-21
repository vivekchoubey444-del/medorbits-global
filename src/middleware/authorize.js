
'use strict';

/**
 * MedOrbits -- Authorization Middleware
 *
 * File: src/middleware/authorize.js
 * Runtime: Node.js >= 20
 *
 * Supports role checks, permission checks, and custom ownership checks.
 *
 * Authentication middleware must run before this middleware.
 * Resource-level authorization should also be enforced in services.
 */

const {
  normalizeRole,
  hasRole,
  hasPermission,
} = require('../policies/policy-utils');

function createHttpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}

function forbidden(
  message = 'You do not have permission to perform this action.'
) {
  return createHttpError(403, 'FORBIDDEN', message);
}

function unauthorized() {
  return createHttpError(
    401,
    'AUTHENTICATION_REQUIRED',
    'Authentication is required.'
  );
}

function normalizeList(value, label) {
  if (value == null) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];

  if (
    values.some((item) =>
      typeof item !== 'string' || !item.trim()
    )
  ) {
    throw new TypeError(
      `Authorization option "${label}" must contain non-empty strings.`
    );
  }

  return [...new Set(values.map((item) => item.trim()))];
}

function authorize(options = {}) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('Authorization options must be an object.');
  }

  const requiredRoles = normalizeList(options.roles, 'roles');
  const requiredPermissions = normalizeList(
    options.permissions,
    'permissions'
  );

  if (
    options.ownership != null &&
    typeof options.ownership !== 'function'
  ) {
    throw new TypeError('Authorization ownership must be a function.');
  }

  if (
    options.requireAllPermissions != null &&
    typeof options.requireAllPermissions !== 'boolean'
  ) {
    throw new TypeError('requireAllPermissions must be a boolean.');
  }

  const requireAllPermissions = options.requireAllPermissions === true;

  // Normalize configured roles once. Invalid role configuration
  // fails during application startup rather than granting access.
  const normalizedRequiredRoles = requiredRoles.map((role) => {
    const normalized = normalizeRole(role);

    if (!normalized) {
      throw new TypeError(`Invalid required role: ${role}`);
    }

    return normalized;
  });

  return async function authorizeMiddleware(req, res, next) {
    if (
      !req ||
      !req.user ||
      typeof req.user !== 'object' ||
      Array.isArray(req.user)
    ) {
      return next(unauthorized());
    }

    const user = req.user;

    // Authentication should already have validated account status.
    // Recheck common disabled/suspended indicators defensively.
    if (
      user.disabled === true ||
      user.isActive === false ||
      user.is_active === false ||
      user.isSuspended === true ||
      user.is_suspended === true ||
      ['disabled', 'suspended', 'inactive', 'deleted', 'blocked']
        .includes(
          typeof user.status === 'string'
            ? user.status.trim().toLowerCase()
            : ''
        )
    ) {
      return next(unauthorized());
    }

    const roleAllowed =
      normalizedRequiredRoles.length === 0 ||
      normalizedRequiredRoles.some((role) => hasRole(user, role));

    const permissionChecks = requiredPermissions.map(
      (permission) => hasPermission(user, permission)
    );

    const permissionAllowed =
      permissionChecks.length === 0 ||
      (
        requireAllPermissions
          ? permissionChecks.every(Boolean)
          : permissionChecks.some(Boolean)
      );

    if (!roleAllowed || !permissionAllowed) {
      return next(forbidden());
    }

    if (typeof options.ownership === 'function') {
      let ownershipAllowed;

      try {
        ownershipAllowed = await options.ownership(req, user);
      } catch (error) {
        // Do not convert repository/database failures into authorization
        // denials. Let the centralized error handler handle the failure.
        return next(error);
      }

      if (ownershipAllowed !== true) {
        return next(forbidden());
      }
    }

    return next();
  };
}

authorize.requireRole = (...roles) => authorize({ roles });

authorize.requirePermission = (...permissions) =>
  authorize({ permissions });

authorize.requireAllPermissions = (...permissions) =>
  authorize({
    permissions,
    requireAllPermissions: true,
  });

authorize.requireOwnership = (ownership) =>
  authorize({ ownership });

authorize.forbidden = forbidden;
authorize.unauthorized = unauthorized;

module.exports = authorize;
