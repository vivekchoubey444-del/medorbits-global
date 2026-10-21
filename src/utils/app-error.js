
'use strict';

/**
 * MedOrbits -- Application Error
 *
 * File: src/utils/app-error.js
 * Runtime: Node.js >= 20
 *
 * Purpose:
 * - Represent expected application errors consistently.
 * - Provide validated HTTP status codes and machine-readable error codes.
 * - Support safe, optional error details and error causes.
 * - Integrate with centralized Express error middleware.
 *
 * Security:
 * - Never expose stack traces, secrets, or internal exception messages
 *   directly to clients.
 * - Only expose details explicitly approved by the centralized error handler.
 * - Do not mark unexpected server errors as operational by default.
 */

const DEFAULT_ERROR_CODE = 'INTERNAL_SERVER_ERROR';
const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred.';

const MIN_STATUS_CODE = 400;
const MAX_STATUS_CODE = 599;

const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,99}$/;

function normalizeMessage(message) {
  if (typeof message !== 'string' || !message.trim()) {
    return DEFAULT_ERROR_MESSAGE;
  }

  return message.trim().slice(0, 1000);
}

function normalizeStatusCode(statusCode) {
  if (
    !Number.isInteger(statusCode) ||
    statusCode < MIN_STATUS_CODE ||
    statusCode > MAX_STATUS_CODE
  ) {
    return 500;
  }

  return statusCode;
}

function normalizeCode(code, fallback = DEFAULT_ERROR_CODE) {
  if (typeof code !== 'string') return fallback;

  const normalized = code.trim();

  return ERROR_CODE_PATTERN.test(normalized)
    ? normalized
    : fallback;
}

class AppError extends Error {
  constructor(message, statusCode = 500, options = {}) {
    const safeMessage = normalizeMessage(message);

    super(
      safeMessage,
      options.cause === undefined
        ? undefined
        : { cause: options.cause },
    );

    this.name = 'AppError';
    this.statusCode = normalizeStatusCode(statusCode);
    this.code = normalizeCode(options.code);

    this.isOperational =
      typeof options.isOperational === 'boolean'
        ? options.isOperational
        : this.statusCode < 500;

    if (options.details !== undefined) {
      this.details = options.details;
    }

    Error.captureStackTrace?.(this, new.target);
  }

  static badRequest(message = 'Bad request.', options = {}) {
    return new AppError(message, 400, {
      ...options,
      code: options.code || 'BAD_REQUEST',
    });
  }

  static unauthorized(
    message = 'Authentication required.',
    options = {},
  ) {
    return new AppError(message, 401, {
      ...options,
      code: options.code || 'UNAUTHORIZED',
    });
  }

  static forbidden(message = 'Access denied.', options = {}) {
    return new AppError(message, 403, {
      ...options,
      code: options.code || 'FORBIDDEN',
    });
  }

  static notFound(
    message = 'Resource not found.',
    options = {},
  ) {
    return new AppError(message, 404, {
      ...options,
      code: options.code || 'NOT_FOUND',
    });
  }

  static conflict(
    message = 'Resource conflict.',
    options = {},
  ) {
    return new AppError(message, 409, {
      ...options,
      code: options.code || 'CONFLICT',
    });
  }

  static validation(
    message = 'Validation failed.',
    options = {},
  ) {
    return new AppError(message, 422, {
      ...options,
      code: options.code || 'VALIDATION_ERROR',
    });
  }

  static tooManyRequests(
    message = 'Too many requests.',
    options = {},
  ) {
    return new AppError(message, 429, {
      ...options,
      code: options.code || 'RATE_LIMIT_EXCEEDED',
    });
  }

  static notImplemented(
    message = 'This operation is not implemented.',
    options = {},
  ) {
    return new AppError(message, 501, {
      ...options,
      code: options.code || 'NOT_IMPLEMENTED',
    });
  }

  static serviceUnavailable(
    message = 'Service temporarily unavailable.',
    options = {},
  ) {
    return new AppError(message, 503, {
      ...options,
      code: options.code || 'SERVICE_UNAVAILABLE',
    });
  }

  static internal(
    message = DEFAULT_ERROR_MESSAGE,
    options = {},
  ) {
    return new AppError(message, 500, {
      ...options,
      code: options.code || DEFAULT_ERROR_CODE,
      isOperational: options.isOperational ?? false,
    });
  }
}

module.exports = AppError;
