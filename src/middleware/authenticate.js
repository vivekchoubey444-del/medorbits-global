
'use strict';

/**
 * MedOrbits -- JWT Authentication Middleware
 *
 * File: src/middleware/authenticate.js
 * Runtime: Node.js >= 20
 *
 * Requires: jsonwebtoken
 *
 * Security:
 * - Enforces an explicit JWT algorithm allowlist.
 * - Validates issuer, audience, expiry and not-before claims through JWT verification.
 * - Supports database-backed user lookup and current account permissions.
 * - Does not trust client-controlled identity, role or permission fields
 *   outside a cryptographically verified token.
 * - Exposes a sanitized authentication context to downstream middleware.
 */

const DEFAULT_ALGORITHMS = Object.freeze(['HS256']);
const DEFAULT_CLOCK_TOLERANCE_SECONDS = 5;
const MAX_CLOCK_TOLERANCE_SECONDS = 60;

function createHttpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function validateOptions(options) {
  if (!isPlainObject(options)) {
    throw new TypeError('Authentication options must be a plain object.');
  }

  const secret = options.secret ?? process.env.JWT_SECRET;
  const algorithms = options.algorithms ?? DEFAULT_ALGORITHMS;
  const clockTolerance =
    options.clockTolerance ?? DEFAULT_CLOCK_TOLERANCE_SECONDS;

  if (
    typeof secret !== 'string' ||
    secret.length < 32
  ) {
    throw new Error(
      'JWT_SECRET must be configured as a string with at least 32 characters.'
    );
  }

  if (
    !Array.isArray(algorithms) ||
    algorithms.length === 0 ||
    algorithms.some((algorithm) =>
      typeof algorithm !== 'string' || !algorithm.trim()
    )
  ) {
    throw new TypeError('JWT algorithms must be a non-empty string array.');
  }

  // This middleware is configured for symmetric HMAC JWTs.
  // Use a separate, explicitly designed verifier for asymmetric keys.
  const normalizedAlgorithms = [...new Set(algorithms)];

  if (
    normalizedAlgorithms.some((algorithm) =>
      !['HS256', 'HS384', 'HS512'].includes(algorithm)
    )
  ) {
    throw new Error(
      'Only explicitly supported HMAC algorithms HS256, HS384 and HS512 are allowed.'
    );
  }

  if (
    !Number.isInteger(clockTolerance) ||
    clockTolerance < 0 ||
    clockTolerance > MAX_CLOCK_TOLERANCE_SECONDS
  ) {
    throw new TypeError(
      `clockTolerance must be an integer between 0 and ${MAX_CLOCK_TOLERANCE_SECONDS}.`
    );
  }

  for (const key of ['issuer', 'audience']) {
    if (
      options[key] != null &&
      !(
        (typeof options[key] === 'string' && options[key].trim()) ||
        (Array.isArray(options[key]) &&
          options[key].length > 0 &&
          options[key].every(
            (value) => typeof value === 'string' && value.trim()
          ))
      )
    ) {
      throw new TypeError(`${key} must be a non-empty string or string array.`);
    }
  }

  if (
    options.getUser != null &&
    typeof options.getUser !== 'function'
  ) {
    throw new TypeError('getUser must be a function when provided.');
  }

  if (
    options.requireDatabaseUser !== false &&
    typeof options.getUser !== 'function'
  ) {
    throw new Error(
      'A database-backed getUser function is required unless requireDatabaseUser is explicitly disabled.'
    );
  }

  return {
    secret,
    algorithms: normalizedAlgorithms,
    clockTolerance,
  };
}

function validateAuthenticatedUser(user) {
  if (!isPlainObject(user)) {
    return false;
  }

  if (
    user.disabled === true ||
    user.isActive === false ||
    user.is_active === false ||
    user.isSuspended === true ||
    user.is_suspended === true
  ) {
    return false;
  }

  const status = typeof user.status === 'string'
    ? user.status.trim().toLowerCase()
    : '';

  if (
    [
      'disabled',
      'suspended',
      'inactive',
      'deleted',
      'blocked',
    ].includes(status)
  ) {
    return false;
  }

  const id = user.id ?? user.userId ?? user.user_id ?? user._id;

  if (
    id === null ||
    id === undefined ||
    !['string', 'number', 'bigint'].includes(typeof id) ||
    String(id).trim() === ''
  ) {
    return false;
  }

  return true;
}

function authenticate(options = {}) {
  let jwt;

  try {
    jwt = require('jsonwebtoken');
  } catch {
    throw new Error(
      'Authentication middleware requires `jsonwebtoken`. Install it before starting the application.'
    );
  }

  const {
    secret,
    algorithms,
    clockTolerance,
  } = validateOptions(options);

  return async function authenticateMiddleware(req, res, next) {
    if (!req || typeof req.get !== 'function') {
      return next(
        createHttpError(
          500,
          'AUTHENTICATION_CONTEXT_INVALID',
          'Authentication could not be completed.'
        )
      );
    }

    const authorization = req.get('authorization') || '';

    // Reject ambiguous or malformed Authorization headers.
    const match = /^Bearer ([^\s,]+)$/i.exec(authorization);

    if (!match) {
      return next(
        createHttpError(
          401,
          'AUTHENTICATION_REQUIRED',
          'Authentication is required.'
        )
      );
    }

    try {
      const verifyOptions = {
        algorithms,
        clockTolerance,
        ...(options.issuer != null
          ? { issuer: options.issuer }
          : {}),
        ...(options.audience != null
          ? { audience: options.audience }
          : {}),
      };

      const decoded = jwt.verify(
        match[1],
        secret,
        verifyOptions
      );

      if (
        !isPlainObject(decoded) ||
        typeof decoded.sub !== 'string' ||
        !decoded.sub.trim()
      ) {
        throw createHttpError(
          401,
          'INVALID_TOKEN',
          'The access token is invalid.'
        );
      }

      // JWT exp and nbf are validated by jwt.verify when present.
      // Require exp by default so tokens cannot remain valid indefinitely.
      if (
        options.requireExpiration !== false &&
        !Number.isFinite(decoded.exp)
      ) {
        throw createHttpError(
          401,
          'INVALID_TOKEN',
          'The access token is invalid.'
        );
      }

      if (
        decoded.jti != null &&
        (
          typeof decoded.jti !== 'string' ||
          !decoded.jti.trim()
        )
      ) {
        throw createHttpError(
          401,
          'INVALID_TOKEN',
          'The access token is invalid.'
        );
      }

      let user;

      if (typeof options.getUser === 'function') {
        user = await options.getUser(decoded, req);
      } else if (options.requireDatabaseUser === false) {
        // Explicitly opt-in stateless mode. Only signed claims are used.
        // This mode cannot independently detect revocation or fresh
        // permission changes. Do not use it when immediate revocation
        // or current database-backed authorization is required.
        user = {
          id: decoded.sub,
          roles: Array.isArray(decoded.roles) ? decoded.roles : [],
          permissions: Array.isArray(decoded.permissions)
            ? decoded.permissions
            : [],
          status: 'active',
        };
      }

      if (!validateAuthenticatedUser(user)) {
        throw createHttpError(
          401,
          'ACCOUNT_UNAVAILABLE',
          'This account is unavailable.'
        );
      }

      // Do not merge token roles or permissions into a database-backed
      // user. getUser is responsible for returning current trusted data.
      req.user = user;

      // Do not expose the raw JWT or all claims unnecessarily.
      req.auth = Object.freeze({
        tokenId: typeof decoded.jti === 'string'
          ? decoded.jti
          : null,
        subject: decoded.sub,
        issuer: decoded.iss ?? null,
        audience: decoded.aud ?? null,
        expiresAt: decoded.exp ?? null,
      });

      return next();
    } catch (error) {
      if (
        error &&
        Number.isInteger(error.status) &&
        error.status >= 400 &&
        error.status < 500
      ) {
        return next(error);
      }

      // Database lookup failures must remain server errors, not be
      // mislabeled as invalid credentials. The central error handler
      // should avoid disclosing internal details to clients.
      if (
        error &&
        (
          error.name === 'JsonWebTokenError' ||
          error.name === 'TokenExpiredError' ||
          error.name === 'NotBeforeError'
        )
      ) {
        return next(
          createHttpError(
            401,
            'INVALID_OR_EXPIRED_TOKEN',
            'The access token is invalid or expired.'
          )
        );
      }

      return next(error);
    }
  };
}

module.exports = authenticate;
