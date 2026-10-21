
'use strict';

/**
 * MedOrbits -- Centralized Express Error Handler
 *
 * File: src/middleware/error-handler.js
 * Runtime: Node.js >= 20
 *
 * Mount after API routes and 404 middleware.
 *
 * Security:
 * - Never exposes internal 5xx messages or stack traces to clients.
 * - Does not trust arbitrary error objects to define public responses.
 * - Handles common Express/body-parser and database errors.
 * - Logs sanitized error metadata and request IDs.
 * - Avoids double responses when headers have already been sent.
 */

const path = require('node:path');

const SRC_DIR = path.resolve(__dirname, '..');
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

let AppError = null;
let apiResponse = null;

try {
  AppError = require(path.join(SRC_DIR, 'utils', 'app-error'));
} catch (error) {
  if (
    error.code !== 'MODULE_NOT_FOUND' ||
    error.message !==
      `Cannot find module '${path.join(SRC_DIR, 'utils', 'app-error')}'`
  ) {
    throw error;
  }
}

try {
  apiResponse = require(path.join(SRC_DIR, 'utils', 'api-response'));
} catch (error) {
  if (
    error.code !== 'MODULE_NOT_FOUND' ||
    error.message !==
      `Cannot find module '${path.join(SRC_DIR, 'utils', 'api-response')}'`
  ) {
    throw error;
  }
}

const DATABASE_ERROR_MAP = Object.freeze({
  // PostgreSQL
  '23505': {
    statusCode: 409,
    code: 'RESOURCE_CONFLICT',
    message: 'A record with the supplied unique value already exists.',
  },
  '23503': {
    statusCode: 409,
    code: 'RELATED_RESOURCE_CONFLICT',
    message: 'The operation conflicts with a related record.',
  },
  '23502': {
    statusCode: 400,
    code: 'INVALID_DATA',
    message: 'A required value is missing.',
  },
  '22P02': {
    statusCode: 400,
    code: 'INVALID_DATA',
    message: 'One or more supplied values are invalid.',
  },

  // MySQL / MariaDB
  ER_DUP_ENTRY: {
    statusCode: 409,
    code: 'RESOURCE_CONFLICT',
    message: 'A record with the supplied unique value already exists.',
  },
  ER_NO_REFERENCED_ROW_2: {
    statusCode: 409,
    code: 'RELATED_RESOURCE_CONFLICT',
    message: 'The operation conflicts with a related record.',
  },
  ER_ROW_IS_REFERENCED_2: {
    statusCode: 409,
    code: 'RELATED_RESOURCE_CONFLICT',
    message: 'The operation conflicts with a related record.',
  },
  ER_BAD_NULL_ERROR: {
    statusCode: 400,
    code: 'INVALID_DATA',
    message: 'A required value is missing.',
  },
  ER_TRUNCATED_WRONG_VALUE: {
    statusCode: 400,
    code: 'INVALID_DATA',
    message: 'One or more supplied values are invalid.',
  },
});

const HTTP_ERROR_MAP = Object.freeze({
  400: ['BAD_REQUEST', 'The request is invalid.'],
  401: ['AUTHENTICATION_REQUIRED', 'Authentication is required.'],
  403: ['FORBIDDEN', 'You do not have permission to perform this action.'],
  404: ['NOT_FOUND', 'The requested resource was not found.'],
  405: ['METHOD_NOT_ALLOWED', 'This method is not allowed.'],
  408: ['REQUEST_TIMEOUT', 'The request timed out.'],
  409: ['RESOURCE_CONFLICT', 'The request conflicts with the current resource state.'],
  413: ['PAYLOAD_TOO_LARGE', 'Request body exceeds the allowed size.'],
  415: ['UNSUPPORTED_MEDIA_TYPE', 'The request media type is not supported.'],
  422: ['VALIDATION_ERROR', 'One or more supplied values are invalid.'],
  429: ['RATE_LIMITED', 'Too many requests. Please try again later.'],
});

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function safeString(value, maxLength = 128) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  if (!normalized || normalized.length > maxLength) {
    return null;
  }

  return normalized;
}

function getStatusCode(error) {
  const candidate = error.statusCode ?? error.status;

  if (
    typeof candidate !== 'number' ||
    !Number.isInteger(candidate) ||
    candidate < 400 ||
    candidate > 599
  ) {
    return 500;
  }

  return candidate;
}

function isKnownAppError(error) {
  return (
    typeof AppError === 'function' &&
    error instanceof AppError
  );
}

function classifyError(error, initialStatus) {
  const type = safeString(error.type, 100);
  const code = safeString(error.code, 100);

  if (type === 'entity.too.large') {
    return {
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body exceeds the allowed size.',
    };
  }

  if (type === 'entity.parse.failed') {
    return {
      statusCode: 400,
      code: 'INVALID_JSON',
      message: 'Request body contains invalid JSON.',
    };
  }

  if (
    type === 'encoding.unsupported' ||
    type === 'charset.unsupported'
  ) {
    return {
      statusCode: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'The request encoding or media type is not supported.',
    };
  }

  if (type === 'request.aborted') {
    return {
      statusCode: 400,
      code: 'REQUEST_ABORTED',
      message: 'The request was interrupted before completion.',
    };
  }

  if (code === 'CORS_ORIGIN_DENIED') {
    return {
      statusCode: 403,
      code: 'CORS_ORIGIN_DENIED',
      message: 'This origin is not permitted to access the API.',
    };
  }

  if (code && DATABASE_ERROR_MAP[code]) {
    return DATABASE_ERROR_MAP[code];
  }

  const knownAppError = isKnownAppError(error);

  // Only trusted application errors may supply public messages/details.
  // Arbitrary error.message or error.publicMessage is not trusted.
  if (knownAppError && initialStatus < 500) {
    const publicMessage =
      safeString(error.publicMessage, 500) ||
      safeString(error.message, 500) ||
      HTTP_ERROR_MAP[initialStatus]?.[1] ||
      'The request could not be completed.';

    return {
      statusCode: initialStatus,
      code:
        safeString(error.code, 100) ||
        HTTP_ERROR_MAP[initialStatus]?.[0] ||
        'REQUEST_ERROR',
      message: publicMessage,
      details: error.details,
    };
  }

  // Generic middleware errors can use an explicitly recognized HTTP
  // status, but their message is not automatically exposed.
  if (initialStatus < 500) {
    const known = HTTP_ERROR_MAP[initialStatus];

    return {
      statusCode: initialStatus,
      code: known?.[0] || 'REQUEST_ERROR',
      message: known?.[1] || 'The request could not be completed.',
    };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected server error occurred.',
  };
}

function getRequestId(req) {
  const id = req?.id;

  if (
    typeof id === 'string' &&
    id.length > 0 &&
    id.length <= 128 &&
    /^[A-Za-z0-9._:-]+$/.test(id)
  ) {
    return id;
  }

  return null;
}

function getSafeRequestPath(req) {
  // Avoid logging query strings, which may contain tokens or personal data.
  const pathValue = req?.path;

  if (
    typeof pathValue === 'string' &&
    pathValue.length <= 2048
  ) {
    return pathValue;
  }

  return null;
}

function logServerError(error, req, requestId, classified) {
  const logEntry = {
    level: 'error',
    timestamp: new Date().toISOString(),
    requestId,
    method: safeString(req?.method, 16),
    path: getSafeRequestPath(req),
    statusCode: classified.statusCode,
    code: classified.code,
    errorName: safeString(error?.name, 100) || 'Error',
  };

  if (!IS_PRODUCTION) {
    logEntry.message = safeString(error?.message, 2000);
    logEntry.stack =
      typeof error?.stack === 'string'
        ? error.stack.slice(0, 12000)
        : undefined;
  }

  // Do not log request bodies, cookies, authorization headers,
  // payment data, or arbitrary error properties.
  console.error(JSON.stringify(logEntry));
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const initialStatus = getStatusCode(error);
  const classified = classifyError(error, initialStatus);
  const statusCode = classified.statusCode;
  const requestId = getRequestId(req);

  if (statusCode >= 500) {
    logServerError(error, req, requestId, classified);
  }

  const payload = {
    statusCode,
    code: classified.code,
    message: classified.message,
    ...(classified.details !== undefined
      ? { details: classified.details }
      : {}),
  };

  if (
    apiResponse &&
    typeof apiResponse.error === 'function'
  ) {
    try {
      // Expected interface: apiResponse.error(res, payload, req).
      // Avoid delegating production response formatting if the helper
      // is known to expose stack traces or raw error objects.
      return apiResponse.error(res, payload, req);
    } catch (responseError) {
      console.error(JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        requestId,
        code: 'ERROR_RESPONSE_HELPER_FAILED',
      }));

      if (res.headersSent) {
        return next(responseError);
      }
    }
  }

  const response = {
    success: false,
    error: {
      code: classified.code,
      message: classified.message,
    },
    requestId,
  };

  // Detailed validation information is only emitted for trusted AppError
  // instances in non-production environments.
  if (
    !IS_PRODUCTION &&
    isKnownAppError(error) &&
    statusCode < 500 &&
    classified.details !== undefined
  ) {
    response.error.details = classified.details;
  }

  return res.status(statusCode).json(response);
}

module.exports = errorHandler;
module.exports.errorHandler = errorHandler;
module.exports.classifyError = classifyError;
module.exports.getStatusCode = getStatusCode;
module.exports.isPlainObject = isPlainObject;
