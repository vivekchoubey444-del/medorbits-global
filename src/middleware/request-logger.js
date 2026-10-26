
'use strict';

/**
 * MedOrbits -- Structured HTTP Request Logger
 *
 * File: src/middleware/request-logger.js
 * Runtime: Node.js >= 20
 *
 * Logs request metadata without query strings, request bodies,
 * credentials, cookies, or arbitrary headers.
 *
 * Mount after request-id middleware.
 */

const DEFAULT_SLOW_REQUEST_MS = 1000;

function validateOptions(options) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('Request logger options must be an object.');
  }

  if (
    options.logger != null &&
    (
      typeof options.logger !== 'object' ||
      options.logger === null
    )
  ) {
    throw new TypeError('logger must be an object.');
  }

  if (
    options.shouldLog != null &&
    typeof options.shouldLog !== 'function'
  ) {
    throw new TypeError('shouldLog must be a function.');
  }

  if (
    options.slowRequestMs != null &&
    (
      !Number.isFinite(options.slowRequestMs) ||
      options.slowRequestMs < 0
    )
  ) {
    throw new TypeError(
      'slowRequestMs must be a non-negative finite number.'
    );
  }
}

function safeRequestId(value) {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9._:-]{1,128}$/.test(value)
  )
    ? value
    : null;
}

function safeUserId(user) {
  if (!user || typeof user !== 'object') {
    return null;
  }

  const value = user.id ?? user.userId ?? user.user_id ?? user._id;

  if (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9._:-]+$/.test(value)
  ) {
    return value;
  }

  if (
    typeof value === 'number' &&
    Number.isSafeInteger(value)
  ) {
    return String(value);
  }

  return null;
}

function getSafePath(req) {
  const pathname = req?.path;

  if (
    typeof pathname === 'string' &&
    pathname.length <= 2048 &&
    pathname.startsWith('/')
  ) {
    return pathname;
  }

  return null;
}

function requestLogger(options = {}) {
  validateOptions(options);

  const logger = options.logger || console;
  const shouldLog = options.shouldLog || (() => true);
  const slowRequestMs =
    options.slowRequestMs ?? DEFAULT_SLOW_REQUEST_MS;

  function writeLog(level, entry) {
    const method =
      level === 'error'
        ? 'error'
        : level === 'warn'
          ? 'warn'
          : 'log';

    const writer = logger[method];

    if (typeof writer === 'function') {
      writer.call(logger, JSON.stringify({
        level,
        timestamp: new Date().toISOString(),
        ...entry,
      }));
    }
  }

  return function requestLoggerMiddleware(req, res, next) {
    const start = process.hrtime.bigint();
    let logged = false;

    function logRequest(eventType) {
      if (logged) {
        return;
      }

      logged = true;

      let shouldWrite;

      try {
        shouldWrite = shouldLog(req, res);
      } catch {
        // Logging failures must not break request handling.
        writeLog('error', {
          code: 'REQUEST_LOG_FILTER_FAILED',
          requestId: safeRequestId(req.id),
          method: req.method,
          path: getSafePath(req),
        });
        return;
      }

      if (shouldWrite !== true) {
        return;
      }

      const durationMs =
        Number(process.hrtime.bigint() - start) / 1e6;

      const status = Number.isInteger(res.statusCode)
        ? res.statusCode
        : 500;

      const level =
        status >= 500
          ? 'error'
          : durationMs >= slowRequestMs
            ? 'warn'
            : 'info';

      const entry = {
        event: 'http_request',
        eventType,
        requestId: safeRequestId(req.id),
        method:
          typeof req.method === 'string'
            ? req.method.slice(0, 16)
            : null,
        path: getSafePath(req),
        status,
        durationMs: Math.round(durationMs * 100) / 100,
        ...(safeUserId(req.user)
          ? { userId: safeUserId(req.user) }
          : {}),
      };

      writeLog(level, entry);
    }

    res.once('finish', () => logRequest('response_finished'));

    // Capture client disconnects where no normal response finish occurs.
    res.once('close', () => {
      if (!res.writableFinished) {
        logRequest('connection_closed');
      }
    });

    return next();
  };
}

module.exports = requestLogger;
module.exports.requestLogger = requestLogger;
