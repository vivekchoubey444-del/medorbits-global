
'use strict';

/**
 * MedOrbits Authorization Middleware
 * File: /api/middleware/authorization.js
 *
 * Compatible with Express 4 and Express 5.
 *
 * Exports:
 *   authorizeRoles
 *   authorizePermissions
 *   authorizeAnyPermission
 *   requireOwnership
 *   requireAuthenticated
 *
 * Security:
 *   - Authentication must run before authorization.
 *   - Never trust role or permission values from req.body,
 *     req.query, or user-controlled headers.
 *   - For sensitive actions, load current authorization data
 *     from a trusted database or authorization service.
 *   - Ownership must be resolved from the actual stored resource.
 */

const AUTHORIZATION_ERRORS = Object.freeze({
  UNAUTHENTICATED: 'Authentication is required.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  RESOURCE_NOT_FOUND: 'Resource not found.',
  INTERNAL: 'Unable to verify resource access.',
});

const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,99}$/;

/**
 * Send a consistent authorization error.
 *
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string} code
 * @param {string} message
 */
function sendError(res, status, code, message) {
  return res.status(status).json({
    success: false,
    error: {
      status,
      code,
      message,
    },
  });
}

/**
 * Normalize and validate role/permission identifiers.
 *
 * Supports identifiers such as:
 *   admin
 *   applications:read
 *   documents:manage
 *
 * Wildcards and malformed identifiers are rejected.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeIdentifier(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim().toLowerCase();

  if (
    !normalized ||
    !IDENTIFIER_PATTERN.test(normalized)
  ) {
    return '';
  }

  return normalized;
}

/**
 * Validate a list of authorization identifiers at startup.
 *
 * Invalid configuration throws immediately instead of accidentally
 * creating a route with no effective restrictions.
 *
 * @param {string} functionName
 * @param {unknown[]} values
 * @returns {string[]}
 */
function normalizeRequiredIdentifiers(functionName, values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError(
      `${functionName} requires at least one identifier.`
    );
  }

  const normalized = values.map(normalizeIdentifier);

  if (normalized.some((value) => !value)) {
    throw new TypeError(
      `${functionName} received an invalid role or permission identifier.`
    );
  }

  return [...new Set(normalized)];
}

/**
 * Validate authenticated identity.
 *
 * Expected:
 *   req.user = {
 *     id: 'user-id',
 *     role: 'admin',
 *     permissions: ['applications:read']
 *   }
 *
 * req.user must be populated by trusted authentication middleware.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {boolean}
 */
function hasAuthenticatedUser(req, res) {
  const user = req.user;

  const validId =
    user &&
    (
      (typeof user.id === 'string' && user.id.trim().length > 0) ||
      (typeof user.id === 'number' &&
        Number.isSafeInteger(user.id) &&
        user.id > 0)
    );

  if (!validId) {
    sendError(
      res,
      401,
      'UNAUTHENTICATED',
      AUTHORIZATION_ERRORS.UNAUTHENTICATED
    );

    return false;
  }

  return true;
}

/**
 * Normalize a trusted user ID for exact comparisons.
 *
 * Numeric and string IDs remain distinct to avoid accidental
 * type coercion.
 *
 * @param {string|number} value
 * @returns {string|null}
 */
function normalizeUserId(value) {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized ? `string:${normalized}` : null;
  }

  if (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return `number:${value}`;
  }

  return null;
}

/**
 * Extract normalized permissions from a trusted req.user.
 *
 * Malformed permission data grants no access.
 *
 * @param {object} user
 * @returns {Set<string>}
 */
function getGrantedPermissions(user) {
  if (!Array.isArray(user.permissions)) {
    return new Set();
  }

  const granted = new Set();

  for (const permission of user.permissions) {
    const normalized = normalizeIdentifier(permission);

    if (normalized) {
      granted.add(normalized);
    }
  }

  return granted;
}

/**
 * Require one of the specified roles.
 *
 * Examples:
 *   authorizeRoles('admin')
 *   authorizeRoles('admin', 'manager')
 *
 * Authentication must be mounted first.
 *
 * @param {...string} allowedRoles
 * @returns {import('express').RequestHandler}
 */
function authorizeRoles(...allowedRoles) {
  const roles = normalizeRequiredIdentifiers(
    'authorizeRoles',
    allowedRoles
  );

  return function roleAuthorization(req, res, next) {
    if (!hasAuthenticatedUser(req, res)) {
      return;
    }

    const userRole = normalizeIdentifier(req.user.role);

    if (!userRole || !roles.includes(userRole)) {
      return sendError(
        res,
        403,
        'FORBIDDEN',
        AUTHORIZATION_ERRORS.FORBIDDEN
      );
    }

    return next();
  };
}

/**
 * Require ALL specified permissions.
 *
 * Example:
 *   authorizePermissions(
 *     'applications:read',
 *     'documents:read'
 *   )
 *
 * @param {...string} requiredPermissions
 * @returns {import('express').RequestHandler}
 */
function authorizePermissions(...requiredPermissions) {
  const required = normalizeRequiredIdentifiers(
    'authorizePermissions',
    requiredPermissions
  );

  return function permissionAuthorization(req, res, next) {
    if (!hasAuthenticatedUser(req, res)) {
      return;
    }

    const granted = getGrantedPermissions(req.user);

    const hasAllPermissions = required.every(
      (permission) => granted.has(permission)
    );

    if (!hasAllPermissions) {
      return sendError(
        res,
        403,
        'FORBIDDEN',
        AUTHORIZATION_ERRORS.FORBIDDEN
      );
    }

    return next();
  };
}

/**
 * Require AT LEAST ONE specified permission.
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
  const allowed = normalizeRequiredIdentifiers(
    'authorizeAnyPermission',
    allowedPermissions
  );

  return function anyPermissionAuthorization(req, res, next) {
    if (!hasAuthenticatedUser(req, res)) {
      return;
    }

    const granted = getGrantedPermissions(req.user);

    const hasPermission = allowed.some(
      (permission) => granted.has(permission)
    );

    if (!hasPermission) {
      return sendError(
        res,
        403,
        'FORBIDDEN',
        AUTHORIZATION_ERRORS.FORBIDDEN
      );
    }

    return next();
  };
}

/**
 * Require the authenticated user to own a resource.
 *
 * The resolver must retrieve the resource from a trusted
 * database/service and return its actual owner's ID.
 *
 * Resolver contract:
 *   - Return the owner's ID if the resource exists.
 *   - Return null if the resource does not exist.
 *   - Throw if a database/service operation fails.
 *
 * Example:
 *   requireOwnership(async (req) => {
 *     const application = await applicationService.findById(
 *       req.params.id
 *     );
 *
 *     if (!application) return null;
 *     return application.userId;
 *   })
 *
 * @param {(req: import('express').Request) =>
 *   Promise<string|number|null|undefined>|string|number|null|undefined}
 *   resolveOwner
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
          'RESOURCE_NOT_FOUND',
          AUTHORIZATION_ERRORS.RESOURCE_NOT_FOUND
        );
      }

      const normalizedOwnerId = normalizeUserId(ownerId);
      const normalizedRequesterId = normalizeUserId(req.user.id);

      if (
        normalizedOwnerId === null ||
        normalizedRequesterId === null
      ) {
        return sendError(
          res,
          403,
          'FORBIDDEN',
          AUTHORIZATION_ERRORS.FORBIDDEN
        );
      }

      if (normalizedOwnerId !== normalizedRequesterId) {
        return sendError(
          res,
          403,
          'FORBIDDEN',
          AUTHORIZATION_ERRORS.FORBIDDEN
        );
      }

      return next();
    } catch (error) {
      // Forward to the central error handler. Do not expose database
      // errors or private resource information in the response.
      return next(error);
    }
  };
}

/**
 * Require authentication without applying role restrictions.
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
