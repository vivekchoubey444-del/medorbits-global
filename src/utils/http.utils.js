
'use strict';

/**
 * MedOrbits -- HTTP Utilities
 *
 * File: src/utils/http.js
 * Runtime: Node.js >= 20
 *
 * Provides:
 * - Async Express handler wrapping.
 * - Consistent successful JSON responses.
 * - Standard application errors.
 * - Bounded pagination parsing.
 *
 * Security:
 * - Never expose internal exceptions or sensitive data in responses.
 * - Validate pagination before passing values to database queries.
 * - Avoid allowing metadata to overwrite reserved response fields.
 */

const asyncHandler = require('./async-handler');
const AppError = require('./app-error');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_PAGE = 1_000_000;
const MAX_LIMIT = 100;

const RESERVED_RESPONSE_KEYS = new Set([
  'success',
  'data',
]);

/**
 * Wrap an Express handler and forward synchronous exceptions
 * and rejected promises to centralized error middleware.
 */
function wrapAsyncHandler(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('asyncHandler requires a function.');
  }

  return asyncHandler(fn);
}

/**
 * Send a consistent successful JSON response.
 *
 * `extra` may contain metadata such as pagination.
 * Reserved response keys cannot be overridden.
 */
function sendSuccess(res, data, status = 200, extra = {}) {
  if (
    !Number.isInteger(status) ||
    status < 200 ||
    status >= 300 ||
    status === 204
  ) {
    throw new TypeError(
      'Success status must be a valid JSON-compatible 2xx HTTP status.',
    );
  }

  if (
    extra === null ||
    typeof extra !== 'object' ||
    Array.isArray(extra)
  ) {
    throw new TypeError('Response extra must be an object.');
  }

  const metadata = { ...extra };

  for (const key of RESERVED_RESPONSE_KEYS) {
    if (Object.hasOwn(metadata, key)) {
      throw new TypeError(
        `Response metadata cannot override the "${key}" field.`,
      );
    }
  }

  return res.status(status).json({
    ...metadata,
    success: true,
    data,
  });
}

/**
 * Create an AppError-compatible HTTP error.
 *
 * Preserves the legacy signature:
 * httpError(status, code, message)
 */
function httpError(status, code, message) {
  if (
    !Number.isInteger(status) ||
    status < 400 ||
    status > 599
  ) {
    throw new TypeError(
      'HTTP error status must be between 400 and 599.',
    );
  }

  if (typeof code !== 'string' || !code.trim()) {
    throw new TypeError(
      'HTTP error code must be a non-empty string.',
    );
  }

  if (typeof message !== 'string' || !message.trim()) {
    throw new TypeError(
      'HTTP error message must be a non-empty string.',
    );
  }

  return new AppError(message, status, {
    code: code.trim(),
    isOperational: status < 500,
  });
}

/**
 * Parse a bounded integer.
 *
 * Accepts positive integer numbers and digit-only numeric strings.
 * Invalid or out-of-range values use the fallback.
 */
function parseBoundedInteger(value, fallback, min, max) {
  if (
    !Number.isSafeInteger(fallback) ||
    !Number.isSafeInteger(min) ||
    !Number.isSafeInteger(max) ||
    min > max ||
    fallback < min ||
    fallback > max
  ) {
    throw new TypeError('Invalid bounded integer configuration.');
  }

  let parsed;

  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string') {
    const normalized = value.trim();

    if (!/^\d+$/.test(normalized)) {
      return fallback;
    }

    parsed = Number(normalized);
  } else {
    return fallback;
  }

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < min ||
    parsed > max
  ) {
    return fallback;
  }

  return parsed;
}

/**
 * Calculate pagination values from an Express query object.
 */
function getPagination(query = {}) {
  if (
    query === null ||
    typeof query !== 'object' ||
    Array.isArray(query)
  ) {
    throw new TypeError('Pagination query must be an object.');
  }

  const page = parseBoundedInteger(
    query.page,
    DEFAULT_PAGE,
    1,
    MAX_PAGE,
  );

  const limit = parseBoundedInteger(
    query.limit,
    DEFAULT_LIMIT,
    1,
    MAX_LIMIT,
  );

  return Object.freeze({
    page,
    limit,
    offset: (page - 1) * limit,
  });
}

module.exports = Object.freeze({
  asyncHandler: wrapAsyncHandler,
  sendSuccess,
  httpError,
  getPagination,
});
