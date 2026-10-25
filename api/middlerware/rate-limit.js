'use strict';
/**
 * MedOrbits API Rate Limiting
 * File: api/middleware/rate-limit.js
 *
 * Dependency:
 *   npm install express-rate-limit
 *
 * Exports:
 *   apiLimiter       - General API traffic
 *   authLimiter      - Login, registration, password-reset endpoints
 *   sensitiveLimiter - Sensitive or expensive operations
 *
 * Configuration:
 *   API_RATE_LIMIT_WINDOW_MS
 *   API_RATE_LIMIT_MAX
 *   AUTH_RATE_LIMIT_WINDOW_MS
 *   AUTH_RATE_LIMIT_MAX
 *   SENSITIVE_RATE_LIMIT_WINDOW_MS
 *   SENSITIVE_RATE_LIMIT_MAX
 *
 * Security notes:
 *   - Uses the client's IP as the default rate-limit key.
 *   - Does not trust arbitrary client-supplied forwarding headers.
 *   - Returns standard RateLimit headers.
 *   - Uses generic error responses.
 *   - Uses an in-memory store by default; production multi-instance
 *     deployments should configure a shared store such as Redis.
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
function readPositiveInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(
      `[MedOrbits Rate Limit] ${name} must be a positive integer.`
    );
  }
  return value;
}
const config = Object.freeze({
  apiWindowMs: readPositiveInteger(
    'API_RATE_LIMIT_WINDOW_MS',
    DEFAULTS.API_WINDOW_MS
  ),
  apiMax: readPositiveInteger(
    'API_RATE_LIMIT_MAX',
    DEFAULTS.API_MAX
  ),
  authWindowMs: readPositiveInteger(
    'AUTH_RATE_LIMIT_WINDOW_MS',
    DEFAULTS.AUTH_WINDOW_MS
  ),
  authMax: readPositiveInteger(
    'AUTH_RATE_LIMIT_MAX',
    DEFAULTS.AUTH_MAX
  ),
  sensitiveWindowMs: readPositiveInteger(
    'SENSITIVE_RATE_LIMIT_WINDOW_MS',
    DEFAULTS.SENSITIVE_WINDOW_MS
  ),
  sensitiveMax: readPositiveInteger(
    'SENSITIVE_RATE_LIMIT_MAX',
    DEFAULTS.SENSITIVE_MAX
  ),
});
const RATE_LIMIT_MESSAGES = Object.freeze({
  API: 'Too many requests. Please try again later.',
  AUTH: 'Too many authentication attempts. Please try again later.',
  SENSITIVE: 'Too many requests for this operation. Please try again later.',
});
/**
 * Build a consistent JSON response when a limit is exceeded.
 *
 * @param {string} code
 * @param {string} message
 * @returns {import('express-rate-limit').Options['handler']}
 */
function createRateLimitHandler(code, message) {
  return function rateLimitHandler(req, res) {
    const resetTime = req.rateLimit?.resetTime;
    if (resetTime instanceof Date) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((resetTime.getTime() - Date.now()) / 1000)
      );
      res.setHeader('Retry-After', String(retryAfterSeconds));
    }
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
 * Uses the package's default IP key generator. This avoids common
 * IPv6 normalization mistakes caused by custom key generators.
 *
 * @param {object} options
 * @returns {import('express').RequestHandler}
 */
function createLimiter({
  windowMs,
  limit,
  code,
  message,
}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    // Do not silently allow requests if the limiter's store fails.
    passOnStoreError: false,
    handler: createRateLimitHandler(code, message),
    // Keep authentication failures and successful requests counted.
    // Do not enable skipSuccessfulRequests on login routes by default.
  });
}
/**
 * General API limiter.
 *
 * Default: 300 requests per IP per 15 minutes.
 *
 * Apply to the API router or to selected high-traffic routes.
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
 * Apply to login, registration, password-reset and verification
 * endpoints. Consider separate policies for different operations.
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
 * Set endpoint-specific limits where appropriate.
 */
const sensitiveLimiter = createLimiter({
  windowMs: config.sensitiveWindowMs,
  limit: config.sensitiveMax,
  code: 'SENSITIVE_RATE_LIMIT_EXCEEDED',
  message: RATE_LIMIT_MESSAGES.SENSITIVE,
});
module.exports = {
  apiLimiter,
  authLimiter,
  sensitiveLimiter,
  createLimiter,
};