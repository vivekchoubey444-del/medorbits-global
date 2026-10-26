
'use strict';

/**
 * MedOrbits Authentication Middleware
 * Path: api/middleware/authentication.js
 *
 * Runtime dependency:
 *   npm install jsonwebtoken
 *
 * Required environment:
 *   JWT_SECRET=<strong-random-secret-at-least-32-bytes>
 *
 * Recommended environment:
 *   JWT_ISSUER=medorbits
 *   JWT_AUDIENCE=medorbits-api
 *
 * Optional:
 *   JWT_CLOCK_TOLERANCE_SECONDS=5
 *
 * Optional database integration:
 *   app.locals.getUserById = async (userId) => databaseUser;
 *
 * Security:
 *   - Uses an explicit HS256 algorithm allowlist.
 *   - Requires exp and a valid sub claim.
 *   - Validates issuer and audience when configured.
 *   - Supports current-user database validation.
 *   - Provides role and authentication middleware.
 *   - Never trusts request-body identity or role data.
 *   - Never logs access tokens or raw verification errors.
 *   - Preserves legacy middleware exports.
 *
 * IMPORTANT:
 * JWT_SECRET must be identical between the token issuer and verifier.
 * Never commit real secrets to source control.
 */

const jwt = require('jsonwebtoken');

const DEFAULT_ALGORITHMS = Object.freeze(['HS256']);
const DEFAULT_CLOCK_TOLERANCE_SECONDS = 5;
const MAX_CLOCK_TOLERANCE_SECONDS = 60;

const AUTH_ERRORS = Object.freeze({
  MISSING_TOKEN: 'Authentication token is required.',
  MALFORMED_HEADER: 'Authorization header is malformed.',
  INVALID_TOKEN: 'Authentication token is invalid or expired.',
  INVALID_CONFIG: 'Authentication service is not configured.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  USER_UNAVAILABLE: 'User account is unavailable.',
});

const JWT_SECRET_MIN_BYTES = 32;

function sendAuthError(res, status, code, message) {
  res.set('Cache-Control', 'no-store');

  return res.status(status).json({
    success: false,
    error: {
      code,
      status,
      message,
    },
  });
}

function unauthorized(res, message = AUTH_ERRORS.INVALID_TOKEN) {
  return sendAuthError(res, 401, 'UNAUTHORIZED', message);
}

function forbidden(res) {
  return sendAuthError(
    res,
    403,
    'FORBIDDEN',
    AUTH_ERRORS.FORBIDDEN
  );
}

/**
 * Return the configured JWT secret, or null if invalid.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (typeof secret !== 'string' || !secret.trim()) {
    return null;
  }

  if (Buffer.byteLength(secret, 'utf8') < JWT_SECRET_MIN_BYTES) {
    return null;
  }

  return secret;
}

/**
 * Validate authentication configuration without exposing secrets.
 */
function validateAuthenticationConfig() {
  const secret = getJwtSecret();

  if (!secret) {
    return {
      valid: false,
      reason: 'JWT_SECRET is missing or too short.',
    };
  }

  const rawTolerance = process.env.JWT_CLOCK_TOLERANCE_SECONDS;

  if (
    rawTolerance !== undefined &&
    !/^\d+$/.test(rawTolerance)
  ) {
    return {
      valid: false,
      reason: 'JWT_CLOCK_TOLERANCE_SECONDS must be an integer.',
    };
  }

  const tolerance = rawTolerance === undefined
    ? DEFAULT_CLOCK_TOLERANCE_SECONDS
    : Number(rawTolerance);

  if (
    !Number.isInteger(tolerance) ||
    tolerance < 0 ||
    tolerance > MAX_CLOCK_TOLERANCE_SECONDS
  ) {
    return {
      valid: false,
      reason: 'JWT clock tolerance is outside the permitted range.',
    };
  }

  return {
    valid: true,
    clockToleranceSeconds: tolerance,
  };
}

/**
 * Extract a Bearer token.
 *
 * Missing header: null.
 * Present but malformed header: throws a typed error.
 */
function extractBearerToken(req) {
  const header = req.headers.authorization;

  if (header === undefined) {
    return null;
  }

  if (typeof header !== 'string') {
    const error = new Error('Malformed authorization header.');
    error.code = 'MALFORMED_AUTHORIZATION_HEADER';
    throw error;
  }

  const match = /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/i.exec(
    header.trim()
  );

  if (!match || !match[1]) {
    const error = new Error('Malformed authorization header.');
    error.code = 'MALFORMED_AUTHORIZATION_HEADER';
    throw error;
  }

  return match[1];
}

/**
 * Build explicit JWT verification options.
 */
function getVerificationOptions() {
  const options = {
    algorithms: [...DEFAULT_ALGORITHMS],
    clockTolerance: DEFAULT_CLOCK_TOLERANCE_SECONDS,
    ignoreExpiration: false,
    ignoreNotBefore: false,
  };

  if (process.env.JWT_ISSUER) {
    options.issuer = process.env.JWT_ISSUER;
  }

  if (process.env.JWT_AUDIENCE) {
    options.audience = process.env.JWT_AUDIENCE;
  }

  const configuredTolerance = process.env.JWT_CLOCK_TOLERANCE_SECONDS;

  if (
    configuredTolerance !== undefined &&
    /^\d+$/.test(configuredTolerance)
  ) {
    options.clockTolerance = Number(configuredTolerance);
  }

  return options;
}

/**
 * Cryptographically verify a JWT.
 *
 * Requires a valid expiration claim and non-empty subject.
 *
 * @param {string} token
 * @returns {Promise<object>}
 */
function verifyAccessToken(token) {
  return new Promise((resolve, reject) => {
    const config = validateAuthenticationConfig();

    if (!config.valid) {
      const error = new Error('Invalid authentication configuration.');
      error.code = 'AUTH_CONFIG_ERROR';
      reject(error);
      return;
    }

    const secret = getJwtSecret();

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
          !decoded.sub.trim() ||
          typeof decoded.exp !== 'number' ||
          !Number.isFinite(decoded.exp)
        ) {
          const invalidPayload = new Error('Invalid JWT claims.');
          invalidPayload.code = 'INVALID_TOKEN_PAYLOAD';
          reject(invalidPayload);
          return;
        }

        if (
          decoded.nbf !== undefined &&
          (
            typeof decoded.nbf !== 'number' ||
            !Number.isFinite(decoded.nbf)
          )
        ) {
          const invalidPayload = new Error('Invalid JWT not-before claim.');
          invalidPayload.code = 'INVALID_TOKEN_PAYLOAD';
          reject(invalidPayload);
          return;
        }

        if (
          decoded.role !== undefined &&
          typeof decoded.role !== 'string'
        ) {
          const invalidPayload = new Error('Invalid JWT role claim.');
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
 * Resolve the current user from the application's database integration.
 *
 * Configure in your Express application:
 *
 *   app.locals.getUserById = async (userId) => {
 *     return usersRepository.findById(userId);
 *   };
 *
 * Return null when the user does not exist.
 */
async function resolveCurrentUser(req, decoded) {
  const getUserById = req.app &&
    req.app.locals &&
    req.app.locals.getUserById;

  if (typeof getUserById !== 'function') {
    // Compatibility mode for existing applications.
    // Token roles may be stale; do not use this mode for sensitive
    // authorization decisions.
    return {
      id: decoded.sub,
      role: typeof decoded.role === 'string'
        ? decoded.role
        : undefined,
      roles: undefined,
      claims: decoded,
      authenticationSource: 'verified-token',
    };
  }

  const user = await getUserById(decoded.sub);

  if (!user || typeof user !== 'object') {
    return null;
  }

  if (
    user.disabled === true ||
    user.isActive === false ||
    user.status === 'disabled' ||
    user.status === 'suspended' ||
    user.status === 'deleted'
  ) {
    return null;
  }

  const userId = user.id ?? user._id;

  if (userId === undefined || userId === null) {
    return null;
  }

  // Prefer the trusted database record over role claims in the token.
  return {
    ...user,
    id: String(userId),
    claims: decoded,
    authenticationSource: 'database',
  };
}

/**
 * Authenticate a request using a signed access token.
 *
 * On success:
 *   req.user = verified user context
 *   req.auth = verified token claims
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function authenticate(req, res, next) {
  let token;

  try {
    token = extractBearerToken(req);
  } catch (error) {
    return unauthorized(res, AUTH_ERRORS.MALFORMED_HEADER);
  }

  if (!token) {
    return unauthorized(res, AUTH_ERRORS.MISSING_TOKEN);
  }

  const config = validateAuthenticationConfig();

  if (!config.valid) {
    // Log only a static diagnostic; never log credentials or tokens.
    console.error(
      '[MedOrbits Auth] Authentication configuration is invalid.'
    );

    return sendAuthError(
      res,
      500,
      'AUTH_CONFIGURATION_ERROR',
      AUTH_ERRORS.INVALID_CONFIG
    );
  }

  try {
    const decoded = await verifyAccessToken(token);
    const user = await resolveCurrentUser(req, decoded);

    if (!user) {
      return unauthorized(res, AUTH_ERRORS.USER_UNAVAILABLE);
    }

    req.user = Object.freeze(user);

    req.auth = Object.freeze({
      subject: decoded.sub,
      issuer: decoded.iss,
      audience: decoded.aud,
      expiresAt: decoded.exp,
      issuedAt: decoded.iat,
    });

    return next();
  } catch (error) {
    if (error && error.code === 'AUTH_CONFIG_ERROR') {
      console.error(
        '[MedOrbits Auth] Authentication configuration is invalid.'
      );

      return sendAuthError(
        res,
        500,
        'AUTH_CONFIGURATION_ERROR',
        AUTH_ERRORS.INVALID_CONFIG
      );
    }

    // A database lookup failure is not the same as an invalid token.
    // Fail closed and let centralized monitoring capture the incident.
    if (
      error &&
      (
        error.name === 'MongoNetworkError' ||
        error.name === 'SequelizeConnectionError' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT'
      )
    ) {
      return sendAuthError(
        res,
        503,
        'AUTH_SERVICE_UNAVAILABLE',
        'Authentication service is temporarily unavailable.'
      );
    }

    // Do not disclose internal verification or database errors.
    return unauthorized(res);
  }
}

/**
 * Require an already authenticated request.
 */
function requireAuthenticated(req, res, next) {
  if (
    !req.user ||
    typeof req.user.id !== 'string' ||
    !req.auth ||
    typeof req.auth.subject !== 'string'
  ) {
    return unauthorized(res, AUTH_ERRORS.MISSING_TOKEN);
  }

  return next();
}

/**
 * Require one of the specified roles.
 *
 * Example:
 *   router.get(
 *     '/admin',
 *     authenticate,
 *     authorizeRoles('admin'),
 *     handler
 *   );
 *
 * Roles are normalized to lowercase for comparison.
 */
function authorizeRoles(...allowedRoles) {
  const normalizedRoles = [
    ...new Set(
      allowedRoles
        .filter(role => typeof role === 'string')
        .map(role => role.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  if (normalizedRoles.length === 0) {
    throw new TypeError(
      'authorizeRoles requires at least one valid role.'
    );
  }

  return function roleAuthorization(req, res, next) {
    if (
      !req.user ||
      typeof req.user.id !== 'string' ||
      !req.auth
    ) {
      return unauthorized(res, AUTH_ERRORS.MISSING_TOKEN);
    }

    const userRoles = Array.isArray(req.user.roles)
      ? req.user.roles
      : [req.user.role];

    const normalizedUserRoles = userRoles
      .filter(role => typeof role === 'string')
      .map(role => role.trim().toLowerCase());

    if (
      !normalizedUserRoles.some(role =>
        normalizedRoles.includes(role)
      )
    ) {
      return forbidden(res);
    }

    return next();
  };
}

/**
 * Require a current database-backed user for privileged operations.
 *
 * Use after authenticate on administrative or sensitive routes.
 * This prevents accidental reliance on token-only compatibility mode.
 */
function requireDatabaseUser(req, res, next) {
  if (
    !req.user ||
    req.user.authenticationSource !== 'database'
  ) {
    return sendAuthError(
      res,
      503,
      'DATABASE_USER_VALIDATION_REQUIRED',
      'Current user validation is required for this operation.'
    );
  }

  return next();
}

module.exports = {
  authenticate,
  authentication: authenticate,
  authenticateToken: authenticate,
  verifyAccessToken,
  extractBearerToken,
  getVerificationOptions,
  validateAuthenticationConfig,
  authorizeRoles,
  requireAuthenticated,
  requireDatabaseUser,
};
