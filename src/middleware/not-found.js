
'use strict';

/**
 * MedOrbits -- 404 Not Found Middleware
 *
 * File: src/middleware/not-found.js
 * Runtime: Node.js >= 20
 *
 * Mount after all routes and before the centralized error handler.
 */

const DEFAULT_MESSAGE = 'The requested resource was not found.';
const DEFAULT_HTML_MESSAGE = 'The requested page was not found.';

function createNotFoundError() {
  const error = new Error(DEFAULT_HTML_MESSAGE);
  error.status = 404;
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  error.publicMessage = DEFAULT_HTML_MESSAGE;
  return error;
}

function validateOptions(options) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('Not-found options must be an object.');
  }

  if (
    options.apiOnly != null &&
    typeof options.apiOnly !== 'boolean'
  ) {
    throw new TypeError('apiOnly must be a boolean.');
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
    : null;
}

function notFound(options = {}) {
  validateOptions(options);

  const apiOnly = options.apiOnly !== false;
  const code = options.code?.trim() || 'NOT_FOUND';
  const message = options.message?.trim() || DEFAULT_MESSAGE;

  return function notFoundMiddleware(req, res, next) {
    if (res.headersSent) {
      return next();
    }

    // Optionally delegate HTML requests to the centralized error handler.
    if (
      !apiOnly &&
      typeof req.accepts === 'function' &&
      req.accepts('html')
    ) {
      return next(createNotFoundError());
    }

    const requestId = getRequestId(req);

    res.setHeader('Cache-Control', 'no-store');

    return res.status(404).json({
      success: false,
      error: {
        code,
        message,
      },
      ...(requestId ? { requestId } : {}),
    });
  };
}

module.exports = notFound;
