
'use strict';

/**
 * MedOrbits -- Rate Limiting Middleware
 *
 * File: src/middleware/rate-limit.js
 * Runtime: Node.js >= 20
 *
 * Requires:
 *   npm install express-rate-limit
 *
 * Production:
 * - Use a shared store when deploying multiple instances.
 * - Configure Express trust proxy only for trusted proxies.
 * - Do not use untrusted client-supplied identity headers as keys.
 */

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LIMIT = 100;
const MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const DEFAULT_MESSAGE =
  'Too many requests. Please try again later.';

function loadRateLimit() {
  try {
    const mod = require('express-rate-limit');
    const rateLimit = mod.rateLimit || mod.default || mod;

    if (typeof rateLimit !== 'function') {
      throw new TypeError('Invalid express-rate-limit export.');
    }

    return rateLimit;
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        'Rate limiting requires `express-rate-limit`. Install it with `npm install express-rate-limit`.',
        { cause: error }
      );
    }

    throw error;
  }
}

function validateOptions(options) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('Rate-limit options must be an object.');
  }

  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const limit = options.limit ?? DEFAULT_LIMIT;

  if (
    !Number.isSafeInteger(windowMs) ||
    windowMs < 1000 ||
    windowMs > MAX_WINDOW_MS
  ) {
    throw new TypeError(
      'windowMs must be an integer between 1000 and 2592000000.'
    );
  }

  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new TypeError('limit must be a positive safe integer.');
  }

  for (const key of ['skipSuccessfulRequests', 'skipFailedRequests']) {
    if (options[key] != null && typeof options[key] !== 'boolean') {
      throw new TypeError(`${key} must be a boolean.`);
    }
  }

  for (const key of ['skip', 'keyGenerator']) {
    if (options[key] != null && typeof options[key] !== 'function') {
      throw new TypeError(`${key} must be a function.`);
    }
  }

  if (
    options.store != null &&
    typeof options.store !== 'object'
  ) {
    throw new TypeError('store must be a compatible rate-limit store.');
  }

  for (const key of ['code', 'message']) {
    if (
      options[key] != null &&
      (
        typeof options[key] !== 'string' ||
        !options[key].trim() ||
        options[key].length > 300
      )
    ) {
      throw new TypeError(
        `${key} must be a non-empty string of at most 300 characters.`
      );
    }
  }
}

function getRequestId(req) {
  return (
    typeof req.id === 'string' &&
    /^[A-Za-z0-9._:-]{1,128}$/.test(req.id)
  )
    ? req.id
    : undefined;
}

function createLimiter(options = {}) {
  validateOptions(options);

  const rateLimit = loadRateLimit();
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const code = options.code?.trim() || 'RATE_LIMIT_EXCEEDED';
  const message = options.message?.trim() || DEFAULT_MESSAGE;

  const configuration = {
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    skipFailedRequests: options.skipFailedRequests ?? false,

    // Optional custom hooks/store. The default key generator uses the
    // client IP supplied by Express and requires correct proxy settings.
    ...(options.skip ? { skip: options.skip } : {}),
    ...(options.keyGenerator ? { keyGenerator: options.keyGenerator } : {}),
    ...(options.store ? { store: options.store } : {}),

    handler(req, res, next, config) {
      if (res.headersSent) {
        return next();
      }

      const retryAfter = Math.max(
        1,
        Math.ceil((config?.windowMs ?? windowMs) / 1000)
      );

      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('Cache-Control', 'no-store');

      return res.status(429).json({
        success: false,
        error: {
          code,
          message,
        },
        ...(getRequestId(req)
          ? { requestId: getRequestId(req) }
          : {}),
      });
    },
  };

  if (options.requestWasSuccessful != null) {
    if (typeof options.requestWasSuccessful !== 'function') {
      throw new TypeError(
        'requestWasSuccessful must be a function.'
      );
    }

    configuration.requestWasSuccessful =
      options.requestWasSuccessful;
  }

  return rateLimit(configuration);
}

function authLimiter(options = {}) {
  return createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts. Try again later.',
    ...options,
  });
}

function uploadLimiter(options = {}) {
  return createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
    message: 'Too many upload requests. Try again later.',
    ...options,
  });
}

function passwordResetLimiter(options = {}) {
  return createLimiter({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
    message: 'Too many password reset attempts. Try again later.',
    ...options,
  });
}

function apiLimiter(options = {}) {
  return createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    code: 'API_RATE_LIMIT_EXCEEDED',
    message: DEFAULT_MESSAGE,
    ...options,
  });
}

module.exports = createLimiter;
module.exports.createLimiter = createLimiter;
module.exports.authLimiter = authLimiter;
module.exports.uploadLimiter = uploadLimiter;
module.exports.passwordResetLimiter = passwordResetLimiter;
module.exports.apiLimiter = apiLimiter;
