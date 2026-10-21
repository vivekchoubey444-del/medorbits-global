
'use strict';

/**
 * MedOrbits -- Request ID Middleware
 *
 * File: src/middleware/request-id.js
 * Runtime: Node.js >= 20
 *
 * Generates a unique request ID or accepts a validated upstream ID.
 * Mount early, before logging, rate limiting, and error handling.
 */

const crypto = require('node:crypto');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const DEFAULT_HEADER_NAME = 'x-request-id';

function validateHeaderName(value) {
  if (
    typeof value !== 'string' ||
    !/^[!#$%&'*+\-.^_`|~0-9a-zA-Z]+$/.test(value)
  ) {
    throw new TypeError('Invalid request ID header name.');
  }

  return value.toLowerCase();
}

function requestId(options = {}) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('Request ID options must be an object.');
  }

  const headerName = validateHeaderName(
    options.headerName || DEFAULT_HEADER_NAME
  );

  if (
    options.trustIncoming != null &&
    typeof options.trustIncoming !== 'boolean'
  ) {
    throw new TypeError('trustIncoming must be a boolean.');
  }

  // Only enable trustIncoming when a trusted proxy or gateway overwrites
  // this header and strips untrusted client-supplied values.
  const trustIncoming = options.trustIncoming === true;

  return function requestIdMiddleware(req, res, next) {
    try {
      let id = null;

      if (trustIncoming && typeof req.get === 'function') {
        const supplied = req.get(headerName);

        if (
          typeof supplied === 'string' &&
          REQUEST_ID_PATTERN.test(supplied)
        ) {
          id = supplied;
        }
      }

      if (!id) {
        id = crypto.randomUUID();
      }

      req.id = id;

      // Overwrite any incoming response header; never reflect arbitrary
      // client input into response headers.
      res.setHeader('X-Request-ID', id);

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = requestId;
module.exports.requestId = requestId;
module.exports.REQUEST_ID_PATTERN = REQUEST_ID_PATTERN;
