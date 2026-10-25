'use strict';
/**
 * MedOrbits Central Error Handler
 * File: api/middleware/error-handler.js
 *
 * Compatible with Express 4 and Express 5.
 *
 * Responsibilities:
 * - Normalize application and HTTP errors.
 * - Handle malformed JSON and validation failures.
 * - Handle common database constraint errors.
 * - Prevent stack traces and internal details leaking in production.
 * - Return consistent JSON responses.
 * - Support request correlation IDs.
 *
 * Middleware order:
 *   app.use(routes);
 *   app.use(notFoundHandler);
 *   app.use(errorHandler);
 *
 * Express 4 async routes must forward rejected promises to next(error),
 * or use an async wrapper. Express 5 forwards rejected route-handler
 * promises automatically.
 */
const crypto = require('node:crypto');
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const DEFAULT_MESSAGES = Object.freeze({
  BAD_REQUEST: 'The request could not be processed.',
  UNAUTHORIZED: 'Authentication is required.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'The request conflicts with existing data.',
  VALIDATION: 'One or more request fields are invalid.',
  RATE_LIMITED: 'Too many requests. Please try again later.',
  INTERNAL: 'An unexpected server error occurred.',
});
/**
 * Application error class.
 *
 * Use for expected operational errors:
 *   throw new AppError('Application not found.', 404, 'NOT_FOUND');
 *
 * Avoid including secrets, credentials, tokens, or private data
 * in error messages.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', options = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = options.isOperational !== false;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}
/**
 * Generate or validate a request correlation ID.
 *
 * By default, an incoming X-Request-ID is not trusted as a security
 * credential. Only a strictly bounded, safe identifier is accepted.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function getRequestId(req) {
  const incoming = req.headers['x-request-id'];
  if (
    typeof incoming === 'string' &&
    /^[A-Za-z0-9._:-]{1,100}$/.test(incoming)
  ) {
    return incoming;
  }
  return crypto.randomUUID();
}
/**
 * Normalize a status code to a valid HTTP error status.
 *
 * @param {unknown} statusCode
 * @returns {number}
 */
function normalizeStatusCode(statusCode) {
  const value = Number(statusCode);
  if (
    Number.isInteger(value) &&
    value >= 400 &&
    value <= 599
  ) {
    return value;
  }
  return 500;
}
/**
 * Map common known errors to safe HTTP responses.
 *
 * @param {Error & Record<string, any>} error
 * @returns {{ statusCode: number, code: string, message: string } | null}
 */
function normalizeKnownError(error) {
  // Malformed JSON from Express body-parser / express.json().
  if (
    error.type === 'entity.parse.failed' ||
    error instanceof SyntaxError &&
      error.status === 400 &&
      Object.prototype.hasOwnProperty.call(error, 'body')
  ) {
    return {
      statusCode: 400,
      code: 'INVALID_JSON',
      message: 'The request body contains invalid JSON.',
    };
  }
  // Request body exceeded configured parser limits.
  if (error.type === 'entity.too.large') {
    return {
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'The request payload is too large.',
    };
  }
  // Common rate-limiter status and error code.
  if (
    error.status === 429 ||
    error.statusCode === 429 ||
    error.code === 'RATE_LIMITED'
  ) {
    return {
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: DEFAULT_MESSAGES.RATE_LIMITED,
    };
  }
  // PostgreSQL unique violation.
  if (error.code === '23505') {
    return {
      statusCode: 409,
      code: 'DUPLICATE_RESOURCE',
      message: DEFAULT_MESSAGES.CONFLICT,
    };
  }
  // PostgreSQL foreign-key violation.
  if (error.code === '23503') {
    return {
      statusCode: 400,
      code: 'INVALID_REFERENCE',
      message: 'The request references a resource that is unavailable.',
    };
  }
  // PostgreSQL not-null violation.
  if (error.code === '23502') {
    return {
      statusCode: 400,
      code: 'REQUIRED_FIELD',
      message: 'A required field is missing.',
    };
  }
  // Common MongoDB duplicate-key error.
  if (error.code === 11000) {
    return {
      statusCode: 409,
      code: 'DUPLICATE_RESOURCE',
      message: DEFAULT_MESSAGES.CONFLICT,
    };
  }
  // Common Mongoose validation error.
  if (error.name === 'ValidationError') {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: DEFAULT_MESSAGES.VALIDATION,
    };
  }
  // Common Mongoose invalid object identifier.
  if (error.name === 'CastError') {
    return {
      statusCode: 400,
      code: 'INVALID_IDENTIFIER',
      message: 'A supplied resource identifier is invalid.',
    };
  }
  // Common JWT verification errors.
  if (
    error.name === 'JsonWebTokenError' ||
    error.name === 'TokenExpiredError' ||
    error.name === 'NotBeforeError'
  ) {
    return {
      statusCode: 401,
      code: 'INVALID_TOKEN',
      message: 'Authentication token is invalid or expired.',
    };
  }
  return null;
}
/**
 * Resolve the public error response.
 *
 * Only known operational errors expose their safe message.
 * Unexpected errors become generic 500 responses.
 *
 * @param {Error & Record<string, any>} error
 * @returns {{ statusCode: number, code: string, message: string }}
 */
function resolvePublicError(error) {
  const known = normalizeKnownError(error);
  if (known) {
    return known;
  }
  if (error instanceof AppError && error.isOperational) {
    const statusCode = normalizeStatusCode(error.statusCode);
    return {
      statusCode,
      code:
        typeof error.code === 'string' &&
        /^[A-Z0-9_]{1,80}$/.test(error.code)
          ? error.code
          : 'REQUEST_ERROR',
      message:
        typeof error.message === 'string' && error.message.trim()
          ? error.message
          : DEFAULT_MESSAGES.INTERNAL,
    };
  }
  // Support errors from trusted HTTP libraries, but never expose
  // arbitrary messages for unexpected server-side failures.
  const statusCode = normalizeStatusCode(
    error.statusCode || error.status
  );
  if (statusCode >= 400 && statusCode < 500) {
    return {
      statusCode,
      code: 'REQUEST_ERROR',
      message: DEFAULT_MESSAGES.BAD_REQUEST,
    };
  }
  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: DEFAULT_MESSAGES.INTERNAL,
  };
}
/**
 * Handle requests for which no route matched.
 *
 * Mount after all application routes.
 *
 * @type {import('express').RequestHandler}
 */
function notFoundHandler(req, res, next) {
  const error = new AppError(
    DEFAULT_MESSAGES.NOT_FOUND,
    404,
    'NOT_FOUND'
  );
  error.path = req.path;
  next(error);
}
/**
 * Central Express error middleware.
 *
 * Express identifies error middleware by its four parameters.
 *
 * @param {Error & Record<string, any>} error
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }
  const requestId = getRequestId(req);
  const publicError = resolvePublicError(error);
  // Avoid logging request bodies, cookies, authorization headers,
  // tokens, database credentials, or raw SQL parameters.
  if (publicError.statusCode >= 500) {
    console.error('[MedOrbits API Error]', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: publicError.statusCode,
      errorName: error.name || 'Error',
      errorCode:
        typeof error.code === 'string'
          ? error.code
          : undefined,
      ...(IS_PRODUCTION
        ? {}
        : { stack: error.stack }),
    });
  } else if (!IS_PRODUCTION) {
    console.warn('[MedOrbits API Client Error]', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: publicError.statusCode,
      code: publicError.code,
    });
  }
  res.setHeader('X-Request-ID', requestId);
  return res.status(publicError.statusCode).json({
    success: false,
    error: {
      code: publicError.code,
      message: publicError.message,
      requestId,
      ...(IS_PRODUCTION
        ? {}
        : {
            path: req.path,
            method: req.method,
          }),
    },
  });
}
/**
 * Create a safe async wrapper for Express 4 route handlers.
 *
 * Express 5 already forwards rejected promises from async handlers.
 * This wrapper is useful for Express 4 and is also usable in Express 5.
 *
 * Example:
 *   router.get('/items', asyncHandler(async (req, res) => {
 *     const items = await service.getItems();
 *     res.json({ success: true, data: items });
 *   }));
 *
 * @param {Function} handler
 * @returns {import('express').RequestHandler}
 */
function asyncHandler(handler) {
  if (typeof handler !== 'function') {
    throw new TypeError('asyncHandler requires a function.');
  }
  return function wrappedAsyncHandler(req, res, next) {
    return Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next);
  };
}
module.exports = {
  AppError,
  asyncHandler,
  notFoundHandler,
  errorHandler,
};