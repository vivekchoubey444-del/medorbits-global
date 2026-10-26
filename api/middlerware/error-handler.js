
'use strict';

/**
 * MedOrbits Central Error Handler
 * File: /api/middleware/error-handler.js
 *
 * Compatible with Express 4 and Express 5.
 *
 * Exports:
 *   AppError
 *   asyncHandler
 *   notFoundHandler
 *   errorHandler
 *
 * Middleware order:
 *   app.use(routes);
 *   app.use(notFoundHandler);
 *   app.use(errorHandler);
 *
 * Express 4 async routes must forward rejected promises to next(error)
 * or use asyncHandler().
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

const SAFE_ERROR_CODE_PATTERN = /^[A-Z0-9_]{1,80}$/;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;

const SENSITIVE_KEY_PATTERN =
  /password|passwd|secret|token|authorization|cookie|credential|api[-_]?key|private[-_]?key/i;

/**
 * Application error class.
 *
 * Example:
 *   throw new AppError(
 *     'Application not found.',
 *     404,
 *     'APPLICATION_NOT_FOUND'
 *   );
 *
 * Only use public messages that are safe to return to clients.
 */
class AppError extends Error {
  constructor(
    message,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    options = {}
  ) {
    super(
      typeof message === 'string' && message.trim()
        ? message
        : DEFAULT_MESSAGES.INTERNAL
    );

    this.name = 'AppError';
    this.statusCode = normalizeStatusCode(statusCode);
    this.code =
      typeof code === 'string' &&
      SAFE_ERROR_CODE_PATTERN.test(code)
        ? code
        : 'INTERNAL_ERROR';

    this.isOperational = options.isOperational !== false;

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Return a valid HTTP error status code.
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
 * Generate or validate a request correlation ID.
 *
 * An incoming request ID is a correlation value, not an
 * authentication credential. Configure trusted proxy handling
 * separately in Express.
 */
function getRequestId(req) {
  const incoming = req.headers?.['x-request-id'];

  if (
    typeof incoming === 'string' &&
    SAFE_REQUEST_ID_PATTERN.test(incoming)
  ) {
    return incoming;
  }

  return crypto.randomUUID();
}

/**
 * Safely obtain the request path without query parameters.
 */
function getSafeRequestPath(req) {
  const path = req.path;

  if (typeof path !== 'string') {
    return '/';
  }

  return path.slice(0, 2048);
}

/**
 * Build a normalized public error.
 */
function publicError(statusCode, code, message) {
  return {
    statusCode: normalizeStatusCode(statusCode),
    code:
      typeof code === 'string' &&
      SAFE_ERROR_CODE_PATTERN.test(code)
        ? code
        : 'INTERNAL_ERROR',
    message:
      typeof message === 'string' && message.trim()
        ? message
        : DEFAULT_MESSAGES.INTERNAL,
  };
}

/**
 * Normalize common known errors.
 *
 * Never expose raw database messages, SQL text, driver details,
 * JWT internals, or arbitrary exception messages.
 */
function normalizeKnownError(error) {
  if (!error || typeof error !== 'object') {
    return null;
  }

  // Malformed JSON parsed by express.json() / body-parser.
  if (
    error.type === 'entity.parse.failed' ||
    (
      error instanceof SyntaxError &&
      error.status === 400 &&
      Object.prototype.hasOwnProperty.call(error, 'body')
    )
  ) {
    return publicError(
      400,
      'INVALID_JSON',
      'The request body contains invalid JSON.'
    );
  }

  // Request body exceeds the configured parser limit.
  if (error.type === 'entity.too.large') {
    return publicError(
      413,
      'PAYLOAD_TOO_LARGE',
      'The request payload is too large.'
    );
  }

  // Unsupported or invalid content encoding.
  if (error.type === 'encoding.unsupported') {
    return publicError(
      415,
      'UNSUPPORTED_ENCODING',
      'The request content encoding is not supported.'
    );
  }

  // Invalid content type or unsupported charset.
  if (
    error.type === 'charset.unsupported' ||
    error.type === 'encoding.unsupported'
  ) {
    return publicError(
      415,
      'UNSUPPORTED_MEDIA_ENCODING',
      'The request media encoding is not supported.'
    );
  }

  // Body-parser request stream errors.
  if (
    error.type === 'request.size.invalid' ||
    error.type === 'request.aborted'
  ) {
    return publicError(
      400,
      'INVALID_REQUEST_BODY',
      'The request body could not be read.'
    );
  }

  // Rate limiting.
  if (
    error.status === 429 ||
    error.statusCode === 429 ||
    error.code === 'RATE_LIMITED'
  ) {
    return publicError(
      429,
      'RATE_LIMITED',
      DEFAULT_MESSAGES.RATE_LIMITED
    );
  }

  // PostgreSQL SQLSTATE codes.
  if (error.code === '23505') {
    return publicError(
      409,
      'DUPLICATE_RESOURCE',
      DEFAULT_MESSAGES.CONFLICT
    );
  }

  if (error.code === '23503') {
    return publicError(
      400,
      'INVALID_REFERENCE',
      'The request references a resource that is unavailable.'
    );
  }

  if (error.code === '23502') {
    return publicError(
      400,
      'REQUIRED_FIELD',
      'A required field is missing.'
    );
  }

  if (error.code === '23514') {
    return publicError(
      400,
      'CONSTRAINT_VIOLATION',
      DEFAULT_MESSAGES.VALIDATION
    );
  }

  if (error.code === '22P02') {
    return publicError(
      400,
      'INVALID_DATA_FORMAT',
      'One or more supplied values have an invalid format.'
    );
  }

  // MongoDB duplicate key.
  if (error.code === 11000) {
    return publicError(
      409,
      'DUPLICATE_RESOURCE',
      DEFAULT_MESSAGES.CONFLICT
    );
  }

  // Mongoose validation error.
  if (error.name === 'ValidationError') {
    return publicError(
      400,
      'VALIDATION_ERROR',
      DEFAULT_MESSAGES.VALIDATION
    );
  }

  // Mongoose cast / identifier error.
  if (error.name === 'CastError') {
    return publicError(
      400,
      'INVALID_IDENTIFIER',
      'A supplied resource identifier is invalid.'
    );
  }

  // JWT errors. Authentication middleware should normally handle
  // these itself, but this is a safe fallback.
  if (
    error.name === 'JsonWebTokenError' ||
    error.name === 'TokenExpiredError' ||
    error.name === 'NotBeforeError'
  ) {
    return publicError(
      401,
      'INVALID_TOKEN',
      'Authentication token is invalid or expired.'
    );
  }

  // Common filesystem errors. Do not expose file paths.
  if (error.code === 'ENOENT') {
    return publicError(
      404,
      'RESOURCE_NOT_FOUND',
      DEFAULT_MESSAGES.NOT_FOUND
    );
  }

  if (error.code === 'EACCES' || error.code === 'EPERM') {
    return publicError(
      403,
      'ACCESS_DENIED',
      DEFAULT_MESSAGES.FORBIDDEN
    );
  }

  return null;
}

/**
 * Resolve a safe client-facing error response.
 */
function resolvePublicError(error) {
  const known = normalizeKnownError(error);

  if (known) {
    return known;
  }

  if (error instanceof AppError && error.isOperational) {
    const statusCode = normalizeStatusCode(error.statusCode);

    // Do not return unexpected server-side errors as public details.
    if (statusCode >= 500) {
      return publicError(
        500,
        'INTERNAL_ERROR',
        DEFAULT_MESSAGES.INTERNAL
      );
    }

    return publicError(
      statusCode,
      error.code,
      error.message
    );
  }

  // Support trusted HTTP-style errors with a client-error status,
  // but never expose their arbitrary message.
  const candidateStatus = normalizeStatusCode(
    error?.statusCode ?? error?.status
  );

  if (candidateStatus >= 400 && candidateStatus < 500) {
    const code =
      candidateStatus === 401
        ? 'UNAUTHORIZED'
        : candidateStatus === 403
          ? 'FORBIDDEN'
          : candidateStatus === 404
            ? 'NOT_FOUND'
            : candidateStatus === 409
              ? 'CONFLICT'
              : candidateStatus === 429
                ? 'RATE_LIMITED'
                : candidateStatus === 413
                  ? 'PAYLOAD_TOO_LARGE'
                  : 'REQUEST_ERROR';

    const message =
      candidateStatus === 401
        ? DEFAULT_MESSAGES.UNAUTHORIZED
        : candidateStatus === 403
          ? DEFAULT_MESSAGES.FORBIDDEN
          : candidateStatus === 404
            ? DEFAULT_MESSAGES.NOT_FOUND
            : candidateStatus === 409
              ? DEFAULT_MESSAGES.CONFLICT
              : candidateStatus === 429
                ? DEFAULT_MESSAGES.RATE_LIMITED
                : candidateStatus === 413
                  ? 'The request payload is too large.'
                  : DEFAULT_MESSAGES.BAD_REQUEST;

    return publicError(candidateStatus, code, message);
  }

  return publicError(
    500,
    'INTERNAL_ERROR',
    DEFAULT_MESSAGES.INTERNAL
  );
}

/**
 * Redact sensitive values from structured log metadata.
 *
 * This is a defense-in-depth helper. Do not pass request bodies,
 * headers, SQL parameters, or credentials into logs in the first place.
 */
function redactMetadata(value, depth = 0) {
  if (depth > 4) {
    return '[TRUNCATED]';
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) => redactMetadata(item, depth + 1));
  }

  if (
    value === null ||
    typeof value !== 'object'
  ) {
    if (typeof value === 'string') {
      return value.slice(0, 500);
    }

    if (
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }

    return undefined;
  }

  const result = Object.create(null);

  for (const [key, item] of Object.entries(value).slice(0, 50)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = '[REDACTED]';
      continue;
    }

    result[key] = redactMetadata(item, depth + 1);
  }

  return result;
}

/**
 * Log an error without logging request bodies, cookies, tokens,
 * authorization headers, raw SQL parameters, or user-submitted data.
 */
function logError(error, req, requestId, resolved) {
  const metadata = {
    requestId,
    method: req.method,
    path: getSafeRequestPath(req),
    statusCode: resolved.statusCode,
    code: resolved.code,
    errorName:
      typeof error?.name === 'string'
        ? error.name.slice(0, 100)
        : 'Error',
    errorCode:
      typeof error?.code === 'string' ||
      typeof error?.code === 'number'
        ? error.code
        : undefined,
  };

  if (resolved.statusCode >= 500) {
    if (!IS_PRODUCTION && typeof error?.stack === 'string') {
      metadata.stack = error.stack.slice(0, 12_000);
    }

    console.error(
      '[MedOrbits API Error]',
      redactMetadata(metadata)
    );

    return;
  }

  if (!IS_PRODUCTION) {
    console.warn(
      '[MedOrbits API Client Error]',
      redactMetadata(metadata)
    );
  }
}

/**
 * Express not-found middleware.
 *
 * Mount after application routes.
 */
function notFoundHandler(req, res, next) {
  const error = new AppError(
    DEFAULT_MESSAGES.NOT_FOUND,
    404,
    'NOT_FOUND'
  );

  error.path = getSafeRequestPath(req);

  return next(error);
}

/**
 * Central Express error middleware.
 *
 * Must have exactly four parameters for Express to recognize it.
 */
function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const requestId = getRequestId(req);
  const resolved = resolvePublicError(error);

  logError(error, req, requestId, resolved);

  res.setHeader('X-Request-ID', requestId);

  return res.status(resolved.statusCode).json({
    success: false,
    error: {
      code: resolved.code,
      message: resolved.message,
      requestId,
      ...(IS_PRODUCTION
        ? {}
        : {
            path: getSafeRequestPath(req),
            method: req.method,
          }),
    },
  });
}

/**
 * Wrap async Express route handlers.
 *
 * Works with Express 4 and Express 5.
 *
 * Example:
 *   router.get('/items', asyncHandler(async (req, res) => {
 *     const items = await service.getItems();
 *     res.json({ success: true, data: items });
 *   }));
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
