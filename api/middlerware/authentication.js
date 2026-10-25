'use strict';
/**
 * MedOrbits Authentication Middleware
 * Path: api/middleware/authentication.js
 *
 * Requires:
 *   npm install jsonwebtoken
 *
 * Environment:
 *   JWT_SECRET=<strong-random-secret>
 *
 * Optional:
 *   JWT_ISSUER=medorbits
 *   JWT_AUDIENCE=medorbits-api
 *
 * Expected token payload:
 *   {
 *     "sub": "user-id",
 *     "role": "user",
 *     "iss": "medorbits",
 *     "aud": "medorbits-api"
 *   }
 *
 * Security:
 *   - Verifies signed JWTs using an explicit algorithm allowlist.
 *   - Never trusts identity or role data from request bodies.
 *   - Rejects expired, malformed, or invalid tokens.
 *   - Does not expose internal verification errors to clients.
 */
const jwt = require('jsonwebtoken');
const DEFAULT_ALGORITHMS = ['HS256'];
const DEFAULT_ISSUER = process.env.JWT_ISSUER || undefined;
const DEFAULT_AUDIENCE = process.env.JWT_AUDIENCE || undefined;
const AUTH_ERRORS = Object.freeze({
  MISSING_TOKEN: 'Authentication token is required.',
  INVALID_TOKEN: 'Authentication token is invalid or expired.',
  INVALID_CONFIG: 'Authentication service is not configured.',
  FORBIDDEN: 'You do not have permission to access this resource.',
});
/**
 * Send a consistent JSON error response.
 *
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string} message
 */
function sendAuthError(res, status, message) {
  return res.status(status).json({
    success: false,
    error: {
      status,
      message,
    },
  });
}
/**
 * Read the bearer token from the Authorization header.
 *
 * Rejects malformed authorization headers rather than attempting
 * to interpret arbitrary credentials.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (typeof header !== 'string') {
    return null;
  }
  const match = /^Bearer ([^\s]+)$/i.exec(header.trim());
  return match ? match[1] : null;
}
/**
 * Build the JWT verification options.
 *
 * @returns {object}
 */
function getVerificationOptions() {
  const options = {
    algorithms: DEFAULT_ALGORITHMS,
  };
  if (DEFAULT_ISSUER) {
    options.issuer = DEFAULT_ISSUER;
  }
  if (DEFAULT_AUDIENCE) {
    options.audience = DEFAULT_AUDIENCE;
  }
  return options;
}
/**
 * Verify a JWT using the configured server-side secret.
 *
 * @param {string} token
 * @returns {Promise<object>}
 */
function verifyAccessToken(token) {
  return new Promise((resolve, reject) => {
    const secret = process.env.JWT_SECRET;
    if (!secret || !secret.trim()) {
      const error = new Error('JWT_SECRET is not configured.');
      error.code = 'AUTH_CONFIG_ERROR';
      reject(error);
      return;
    }
    jwt.verify(
      token,
      secret,
      getVerificationOptions(),
      (error, decoded) => {
        if (error) {
          reject(error);
          return;
        }
        if (
          !decoded ||
          typeof decoded !== 'object' ||
          Array.isArray(decoded) ||
          typeof decoded.sub !== 'string' ||
          !decoded.sub.trim()
        ) {
          const invalidPayload = new Error(
            'JWT payload does not contain a valid subject.'
          );
          invalidPayload.code = 'INVALID_TOKEN_PAYLOAD';
          reject(invalidPayload);
          return;
        }
        resolve(decoded);
      }
    );
  });
}
/**
 * Authenticate requests using a signed JWT.
 *
 * On success:
 *   req.user = {
 *     id: decoded.sub,
 *     role: decoded.role,
 *     claims: decoded
 *   }
 *
 * Important:
 *   req.user contains token claims. For sensitive authorization
 *   decisions, load the current user and role from the database.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function authenticate(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return sendAuthError(
      res,
      401,
      AUTH_ERRORS.MISSING_TOKEN
    );
  }
  if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
    // Configuration problems should be diagnosed server-side.
    console.error(
      '[MedOrbits Auth] JWT_SECRET is not configured.'
    );
    return sendAuthError(
      res,
      500,
      AUTH_ERRORS.INVALID_CONFIG
    );
  }
  try {
    const decoded = await verifyAccessToken(token);
    req.user = Object.freeze({
      id: decoded.sub,
      role:
        typeof decoded.role === 'string'
          ? decoded.role
          : undefined,
      claims: decoded,
    });
    return next();
  } catch (error) {
    if (error && error.code === 'AUTH_CONFIG_ERROR') {
      console.error(
        '[MedOrbits Auth] Authentication configuration error.'
      );
      return sendAuthError(
        res,
        500,
        AUTH_ERRORS.INVALID_CONFIG
      );
    }
    // Do not log the token, claims, or raw verification error.
    return sendAuthError(
      res,
      401,
      AUTH_ERRORS.INVALID_TOKEN
    );
  }
}
/**
 * Authorize users whose token role matches an allowed role.
 *
 * Example:
 *   router.get('/admin', authenticate, authorizeRoles('admin'), handler);
 *
 * Important:
 *   Token roles can become stale. For privileged actions, verify the
 *   user's current role and account status against the database.
 *
 * @param {...string} allowedRoles
 * @returns {import('express').RequestHandler}
 */
function authorizeRoles(...allowedRoles) {
  const normalizedRoles = allowedRoles
    .filter((role) => typeof role === 'string')
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
  if (normalizedRoles.length === 0) {
    throw new TypeError(
      'authorizeRoles requires at least one valid role.'
    );
  }
  return function roleAuthorization(req, res, next) {
    if (!req.user || typeof req.user.id !== 'string') {
      return sendAuthError(
        res,
        401,
        AUTH_ERRORS.MISSING_TOKEN
      );
    }
    const userRole =
      typeof req.user.role === 'string'
        ? req.user.role.trim().toLowerCase()
        : '';
    if (!normalizedRoles.includes(userRole)) {
      return sendAuthError(
        res,
        403,
        AUTH_ERRORS.FORBIDDEN
      );
    }
    return next();
  };
}
/**
 * Require an authenticated user without additional role restrictions.
 */
function requireAuthenticated(req, res, next) {
  if (!req.user || typeof req.user.id !== 'string') {
    return sendAuthError(
      res,
      401,
      AUTH_ERRORS.MISSING_TOKEN
    );
  }
  return next();
}
module.exports = {
  authenticate,
  authentication: authenticate,
  authenticateToken: authenticate,
  authorizeRoles,
  requireAuthenticated,
  extractBearerToken,
};