
'use strict';

/**
 * MedOrbits API -- Rate Limiting Middleware
 * File: /api/middleware/rate-limit.js
 *
 * Dependency:
 *   npm install express-rate-limit
 *
 * Exports:
 *   apiLimiter
 *   authLimiter
 *   sensitiveLimiter
 *   createLimiter
 *   rateLimitConfig
 *
 * Environment:
 *   API_RATE_LIMIT_WINDOW_MS
 *   API_RATE_LIMIT_MAX
 *   AUTH_RATE_LIMIT_WINDOW_MS
 *   AUTH_RATE_LIMIT_MAX
 *   SENSITIVE_RATE_LIMIT_WINDOW_MS
 *   SENSITIVE_RATE_LIMIT_MAX
 *
 * Security:
 *   - Uses express-rate-limit's default IP key generator.
 *   - Relies on Express trust-proxy configuration for client IP handling.
 *   - Does not trust client-supplied forwarding headers directly.
 *   - Returns standard RateLimit headers.
 *   - Fails closed on store errors by default.
 *   - Uses generic 429 JSON responses.
 *
 * Production note:
 *   The default memory store is per process. Use a shared store
 *   (such as Redis) for multi-instance deployments.
 */

const { rateLimit } = require('express-rate-limit');

const DEFAULTS = Object.freeze({
  API_WINDOW_MS: 15 * 60 * 1000,
  API_MAX: 300,

  AUTH_WINDOW_MS: 15 * 60 * 1000,
  AUTH_MAX: 10,

  SENSITIVE_WINDOW_MS: 60 * 1000,
  SENSITIVE_MAX: 20,
});

const RATE_LIMIT_MESSAGES = Object.freeze({
  API: 'Too many requests. Please try again later.',
  AUTH: 'Too many authentication attempts. Please try again later.',
  SENSITIVE:
    'Too many requests for this operation. Please try again later.',
});

const MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_LIMIT = 1_000_000;

/**
 * Read and validate a positive integer from the environment.
 *
 * @param {string} name
 * @param {number} fallback
 * @param {{ max?: number }} [options]
 * @returns {number}
 */
function readPositiveInteger(name, fallback, options = {}) {
  const raw = process.env[name];

  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const normalized = raw.trim();

  // Prevent values such as "10abc", "1e3" and "Infinity".
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `[MedOrbits Rate Limit] ${name} must be a positive integer.`
    );
  }

  const value = Number(normalized);
  const maximum = options.max ?? MAX_LIMIT;

  if (
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > maximum
  ) {
    throw new Error(
      `[MedOrbits Rate Limit] ${name} must be between 1 and ${maximum}.`
    );
  }

  return value;
}

const config = Object.freeze({
  apiWindowMs: readPositiveInteger(
    'API_RATE_LIMIT_WINDOW_MS',
    DEFAULTS.API_WINDOW_MS,
    { max: MAX_WINDOW_MS }
  ),

  apiMax: readPositiveInteger(
    'API_RATE_LIMIT_MAX',
    DEFAULTS.API_MAX
  ),

  authWindowMs: readPositiveInteger(
    'AUTH_RATE_LIMIT_WINDOW_MS',
    DEFAULTS.AUTH_WINDOW_MS,
    { max: MAX_WINDOW_MS }
  ),

  authMax: readPositiveInteger(
    'AUTH_RATE_LIMIT_MAX',
    DEFAULTS.AUTH_MAX
  ),

  sensitiveWindowMs: readPositiveInteger(
    'SENSITIVE_RATE_LIMIT_WINDOW_MS',
    DEFAULTS.SENSITIVE_WINDOW_MS,
    { max: MAX_WINDOW_MS }
  ),

  sensitiveMax: readPositiveInteger(
    'SENSITIVE_RATE_LIMIT_MAX',
    DEFAULTS.SENSITIVE_MAX
  ),
});

/**
 * Safely set Retry-After from the limiter's reset time when available.
 *
 * express-rate-limit versions and stores may expose resetTime in
 * different shapes, so invalid or missing values are ignored.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function setRetryAfter(req, res) {
  const resetTime = req.rateLimit?.resetTime;

  if (!(resetTime instanceof Date)) {
    return;
  }

  const resetTimestamp = resetTime.getTime();

  if (!Number.isFinite(resetTimestamp)) {
    return;
  }

  const seconds = Math.max(
    1,
    Math.ceil((resetTimestamp - Date.now()) / 1000)
  );

  res.setHeader('Retry-After', String(seconds));
}

/**
 * Build a consistent 429 response handler.
 *
 * @param {string} code
 * @param {string} message
 * @returns {import('express-rate-limit').Options['handler']}
 */
function createRateLimitHandler(code, message) {
  if (typeof code !== 'string' || code.trim() === '') {
    throw new TypeError('Rate-limit error code must be a non-empty string.');
  }

  if (typeof message !== 'string' || message.trim() === '') {
    throw new TypeError('Rate-limit message must be a non-empty string.');
  }

  return function rateLimitHandler(req, res) {
    setRetryAfter(req, res);

    return res.status(429).json({
      success: false,
      error: {
        status: 429,
        code,
        message,
      },
    });
  };
}

/**
 * Create a reusable rate limiter.
 *
 * Options:
 *   windowMs: positive integer
 *   limit: positive integer
 *   code: error code
 *   message: generic response message
 *   keyGenerator: optional custom key generator
 *   store: optional express-rate-limit-compatible store
 *   skip: optional request skip function
 *
 * Avoid custom key generators unless you fully understand IP
 * normalization and IPv6 handling. The default generator is preferred.
 *
 * @param {object} options
 * @returns {import('express').RequestHandler}
 */
function createLimiter(options = {}) {
  const {
    windowMs,
    limit,
    code,
    message,
    keyGenerator,
    store,
    skip,
  } = options;

  if (
    !Number.isSafeInteger(windowMs) ||
    windowMs <= 0 ||
    windowMs > MAX_WINDOW_MS
  ) {
    throw new TypeError(
      'Rate-limit windowMs must be a positive integer within 30 days.'
    );
  }

  if (
    !Number.isSafeInteger(limit) ||
    limit <= 0 ||
    limit > MAX_LIMIT
  ) {
    throw new TypeError(
      `Rate-limit limit must be between 1 and ${MAX_LIMIT}.`
    );
  }

  if (typeof code !== 'string' || code.trim() === '') {
    throw new TypeError('Rate-limit code is required.');
  }

  if (typeof message !== 'string' || message.trim() === '') {
    throw new TypeError('Rate-limit message is required.');
  }

  if (
    keyGenerator !== undefined &&
    typeof keyGenerator !== 'function'
  ) {
    throw new TypeError('keyGenerator must be a function.');
  }

  if (
    skip !== undefined &&
    typeof skip !== 'function'
  ) {
    throw new TypeError('skip must be a function.');
  }

  if (
    store !== undefined &&
    (store === null || typeof store !== 'object')
  ) {
    throw new TypeError('store must be a valid rate-limit store object.');
  }

  const limiterOptions = {
    windowMs,
    limit,

    standardHeaders: 'draft-8',
    legacyHeaders: false,

    handler: createRateLimitHandler(code, message),

    // Do not silently allow traffic if the configured store fails.
    passOnStoreError: false,

    // Count both successful and failed requests by default.
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  };

  if (keyGenerator) {
    limiterOptions.keyGenerator = keyGenerator;
  }

  if (store) {
    limiterOptions.store = store;
  }

  if (skip) {
    limiterOptions.skip = skip;
  }

  return rateLimit(limiterOptions);
}

/**
 * General API limiter.
 *
 * Default: 300 requests per IP per 15 minutes.
 *
 * Apply to the API router or appropriate API routes.
 */
const apiLimiter = createLimiter({
  windowMs: config.apiWindowMs,
  limit: config.apiMax,
  code: 'API_RATE_LIMIT_EXCEEDED',
  message: RATE_LIMIT_MESSAGES.API,
});

/**
 * Authentication limiter.
 *
 * Default: 10 requests per IP per 15 minutes.
 *
 * Apply to login, registration, password-reset and verification routes.
 * Consider additional account-based throttling for login and reset flows.
 */
const authLimiter = createLimiter({
  windowMs: config.authWindowMs,
  limit: config.authMax,
  code: 'AUTH_RATE_LIMIT_EXCEEDED',
  message: RATE_LIMIT_MESSAGES.AUTH,
});

/**
 * Sensitive-operation limiter.
 *
 * Default: 20 requests per IP per minute.
 *
 * Apply to expensive searches, document processing, upload initiation,
 * verification-code delivery and other abuse-sensitive operations.
 */
const sensitiveLimiter = createLimiter({
  windowMs: config.sensitiveWindowMs,
  limit: config.sensitiveMax,
  code: 'SENSITIVE_RATE_LIMIT_EXCEEDED',
  message: RATE_LIMIT_MESSAGES.SENSITIVE,
});

/**
 * Expose a read-only snapshot of the effective configuration.
 * Does not expose secrets.
 */
const rateLimitConfig = Object.freeze({ ...config });

module.exports = {
  apiLimiter,
  authLimiter,
  sensitiveLimiter,
  createLimiter,
  rateLimitConfig,
};
