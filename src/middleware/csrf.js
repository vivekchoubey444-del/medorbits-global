
'use strict';

/**
 * MedOrbits -- CSRF Protection
 *
 * File: src/middleware/csrf.js
 * Runtime: Node.js >= 20
 *
 * Requires cookie-parser before CSRF verification.
 *
 * Recommended order:
 *   cookieParser()
 *   csrfProtection.issue
 *   csrfProtection.verify
 *
 * For session-authenticated applications, issue and verify CSRF tokens
 * consistently across the session lifecycle.
 */

const crypto = require('node:crypto');

const DEFAULT_SAFE_METHODS = Object.freeze([
  'GET',
  'HEAD',
  'OPTIONS',
]);

const TOKEN_BYTES = 32;
const DEFAULT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

function safeEqual(a, b) {
  if (
    typeof a !== 'string' ||
    typeof b !== 'string'
  ) {
    return false;
  }

  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function csrfError(
  message = 'CSRF token is missing or invalid.'
) {
  const error = new Error(message);
  error.status = 403;
  error.code = 'CSRF_VALIDATION_FAILED';
  error.publicMessage = message;
  return error;
}

function validateCookieName(name) {
  if (
    typeof name !== 'string' ||
    !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)
  ) {
    throw new TypeError('Invalid CSRF cookie name.');
  }
}

function validateHeaderName(name) {
  if (
    typeof name !== 'string' ||
    !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)
  ) {
    throw new TypeError('Invalid CSRF header name.');
  }
}

function csrf(options = {}) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('CSRF options must be an object.');
  }

  const secret =
    options.secret ||
    process.env.CSRF_SECRET ||
    process.env.SESSION_SECRET;

  if (
    typeof secret !== 'string' ||
    Buffer.byteLength(secret, 'utf8') < 32
  ) {
    throw new Error(
      'CSRF_SECRET or SESSION_SECRET must be configured with at least 32 bytes.'
    );
  }

  const cookieName = options.cookieName || '__Host-csrf';
  const headerName = (
    options.headerName || 'x-csrf-token'
  ).toLowerCase();

  validateCookieName(cookieName);
  validateHeaderName(headerName);

  if (
    options.shouldProtect != null &&
    typeof options.shouldProtect !== 'function'
  ) {
    throw new TypeError('shouldProtect must be a function.');
  }

  if (
    options.secure != null &&
    typeof options.secure !== 'boolean'
  ) {
    throw new TypeError('secure must be a boolean.');
  }

  if (
    options.domain != null &&
    (
      typeof options.domain !== 'string' ||
      !options.domain.trim()
    )
  ) {
    throw new TypeError('domain must be a non-empty string.');
  }

  const sameSite = String(options.sameSite || 'lax').toLowerCase();

  if (!['strict', 'lax', 'none'].includes(sameSite)) {
    throw new TypeError(
      'sameSite must be strict, lax, or none.'
    );
  }

  const secure =
    options.secure ??
    process.env.NODE_ENV === 'production';

  if (sameSite === 'none' && !secure) {
    throw new Error(
      'CSRF cookies using SameSite=None must use Secure.'
    );
  }

  // __Host- cookies must be Secure, use Path=/, and omit Domain.
  if (
    cookieName.startsWith('__Host-') &&
    (!secure || options.domain)
  ) {
    throw new Error(
      'Cookies using the __Host- prefix require Secure and must not specify Domain.'
    );
  }

  const maxAge =
    options.maxAge == null
      ? DEFAULT_MAX_AGE_MS
      : options.maxAge;

  if (
    !Number.isSafeInteger(maxAge) ||
    maxAge <= 0
  ) {
    throw new TypeError('maxAge must be a positive safe integer.');
  }

  const configuredMethods =
    options.safeMethods == null
      ? DEFAULT_SAFE_METHODS
      : options.safeMethods;

  if (
    !Array.isArray(configuredMethods) ||
    configuredMethods.some(
      (method) =>
        typeof method !== 'string' ||
        !/^[A-Za-z]+$/.test(method)
    )
  ) {
    throw new TypeError(
      'safeMethods must be an array of HTTP method names.'
    );
  }

  const safeMethods = new Set(
    configuredMethods.map((method) => method.toUpperCase())
  );

  function signature(token) {
    return crypto
      .createHmac('sha256', secret)
      .update(token, 'utf8')
      .digest('hex');
  }

  function createToken() {
    const token = crypto
      .randomBytes(TOKEN_BYTES)
      .toString('base64url');

    return `${token}.${signature(token)}`;
  }

  function parseAndVerifyToken(value) {
    if (
      typeof value !== 'string' ||
      value.length > 256
    ) {
      return false;
    }

    const separator = value.lastIndexOf('.');

    if (separator <= 0) {
      return false;
    }

    const token = value.slice(0, separator);
    const suppliedSignature = value.slice(separator + 1);

    // Enforce the exact token and signature formats.
    if (
      !/^[A-Za-z0-9_-]{43}$/.test(token) ||
      !/^[a-f0-9]{64}$/.test(suppliedSignature)
    ) {
      return false;
    }

    return safeEqual(signature(token), suppliedSignature);
  }

  function issue(req, res, next) {
    try {
      if (
        !res ||
        typeof res.cookie !== 'function' ||
        !res.locals
      ) {
        return next(
          new Error(
            'CSRF issuance requires Express response cookie support.'
          )
        );
      }

      const signedToken = createToken();

      res.cookie(cookieName, signedToken, {
        httpOnly: false,
        secure,
        sameSite,
        path: '/',
        ...(options.domain ? { domain: options.domain } : {}),
        maxAge,
      });

      // Render this value into a trusted page or expose it through a
      // same-origin endpoint for the frontend to send in the header.
      res.locals.csrfToken = signedToken;

      return next();
    } catch (error) {
      return next(error);
    }
  }

  function verify(req, res, next) {
    if (!req || typeof req.method !== 'string') {
      return next(new Error('Invalid request passed to CSRF middleware.'));
    }

    if (safeMethods.has(req.method.toUpperCase())) {
      return next();
    }

    if (options.shouldProtect) {
      let shouldProtect;

      try {
        shouldProtect = options.shouldProtect(req);
      } catch (error) {
        return next(error);
      }

      if (shouldProtect !== true) {
        return next();
      }
    }

    const cookies = req.cookies;

    if (
      !cookies ||
      typeof cookies !== 'object' ||
      Array.isArray(cookies)
    ) {
      return next(
        csrfError('CSRF cookie is missing or invalid.')
      );
    }

    const cookieToken = cookies[cookieName];

    let headerToken;

    if (typeof req.get === 'function') {
      headerToken = req.get(headerName);
    } else {
      headerToken = req.headers?.[headerName];
    }

    if (
      typeof cookieToken !== 'string' ||
      typeof headerToken !== 'string' ||
      !safeEqual(cookieToken, headerToken)
    ) {
      return next(csrfError());
    }

    if (!parseAndVerifyToken(cookieToken)) {
      return next(csrfError());
    }

    return next();
  }

  return Object.freeze({
    issue,
    verify,
    cookieName,
    cookieParserRequired: true,
  });
}

module.exports = csrf;
module.exports.safeEqual = safeEqual;
