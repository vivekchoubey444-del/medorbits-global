
'use strict';

/**
 * MedOrbits -- Async Handler
 *
 * File: src/utils/async-handler.js
 * Runtime: Node.js >= 20
 *
 * Purpose:
 * - Wrap Express route handlers and middleware.
 * - Forward synchronous exceptions to next(error).
 * - Forward rejected promises to centralized error middleware.
 * - Preserve the handler's `this` context and Express arguments.
 * - Support Express 4 and Express 5.
 *
 * Notes:
 * - Do not call next(error) manually and also throw the same error.
 * - Avoid wrapping handlers that already manage their own errors
 *   unless consistent forwarding is intended.
 */

function asyncHandler(handler) {
  if (typeof handler !== 'function') {
    throw new TypeError('asyncHandler requires a function.');
  }

  return function wrappedHandler(req, res, next) {
    if (typeof next !== 'function') {
      throw new TypeError(
        'asyncHandler requires an Express-compatible next function.',
      );
    }

    let result;

    try {
      result = handler.call(this, req, res, next);
    } catch (error) {
      return next(error);
    }

    return Promise.resolve(result).catch((error) => {
      return next(error);
    });
  };
}

module.exports = asyncHandler;
