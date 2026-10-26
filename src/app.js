
'use strict';

/**
 * MedOrbits -- Express Application
 *
 * File: src/app.js
 * Runtime: Node.js >= 20
 *
 * Responsibilities:
 * - Configure security middleware and CORS.
 * - Parse and validate HTTP request bodies.
 * - Log request lifecycle events without query strings or body contents.
 * - Expose liveness and configurable readiness endpoints.
 * - Mount application routes.
 * - Normalize 404 and error responses.
 *
 * This module does not listen on a network port or start workers.
 */

const express = require('express');

const { env } = require('./config/env');
const logger = require('./config/logger');
const { corsMiddleware } = require('./config/cors');
const { securityHeadersMiddleware } = require('./config/security');

const app = express();

const SERVICE_NAME = 'medorbits';
const API_PREFIX = normalizeApiPrefix(env.API_PREFIX || '/api');

app.disable('x-powered-by');

function normalizeApiPrefix(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return '/api';
  }

  const trimmed = value.trim();

  if (
    !trimmed.startsWith('/') ||
    trimmed.includes('//') ||
    trimmed.includes('?') ||
    trimmed.includes('#') ||
    trimmed.includes('\\') ||
    /[\u0000-\u001f\u007f%]/.test(trimmed)
  ) {
    throw new TypeError('API_PREFIX must be a valid URL path prefix.');
  }

  const segments = trimmed.split('/').filter(Boolean);

  if (
    segments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new TypeError('API_PREFIX must not contain traversal segments.');
  }

  return segments.length ? `/${segments.join('/')}` : '/api';
}

function configureTrustProxy() {
  const value = env.TRUST_PROXY;

  if (
    value === undefined ||
    value === null ||
    value === false ||
    value === 0 ||
    value === '0'
  ) {
    app.set('trust proxy', false);
    return;
  }

  if (value === true || value === 1) {
    app.set('trust proxy', 1);
    return;
  }

  if (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 1
  ) {
    app.set('trust proxy', value);
    return;
  }

  if (typeof value === 'string' && value.trim()) {
    app.set('trust proxy', value.trim());
    return;
  }

  throw new TypeError('Invalid TRUST_PROXY configuration.');
}

function log(level, fields, message) {
  if (logger && typeof logger[level] === 'function') {
    logger[level](fields, message);
  }
}

function getRequestPath(req) {
  // Never include query parameters, which may contain sensitive values.
  return typeof req.path === 'string'
    ? req.path
    : String(req.originalUrl || '/').split('?')[0];
}

function getRequestId(req) {
  if (req.id !== undefined && req.id !== null) {
    return String(req.id).slice(0, 128);
  }

  const suppliedId = req.headers['x-request-id'];

  // Do not accept arbitrary-length or control-character log values.
  if (
    typeof suppliedId === 'string' &&
    suppliedId.length <= 128 &&
    /^[a-zA-Z0-9._:-]+$/.test(suppliedId)
  ) {
    return suppliedId;
  }

  return undefined;
}

function isApiPath(pathname) {
  return API_PREFIX === '/'
    ? pathname.startsWith('/')
    : pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

function sendHealthResponse(res) {
  return res.status(200).json({
    status: 'ok',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
  });
}

function createHttpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

configureTrustProxy();

app.disable('etag');

// Security and cross-origin policy.
app.use(securityHeadersMiddleware);
app.use(corsMiddleware);

// Request lifecycle logging runs before body parsers so parser errors
// and unsupported-media-type responses are logged too.
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  const requestId = getRequestId(req);
  let logged = false;

  if (requestId) {
    res.setHeader('X-Request-ID', requestId);
  }

  function writeCompletionLog() {
    if (logged) return;
    logged = true;

    const durationMs =
      Number(process.hrtime.bigint() - startedAt) / 1e6;

    log('info', {
      event: 'http_request_completed',
      method: req.method,
      path: getRequestPath(req),
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      requestId,
    }, 'HTTP request completed');
  }

  res.once('finish', writeCompletionLog);

  res.once('close', () => {
    if (res.writableFinished) return;

    log('warn', {
      event: 'http_request_aborted',
      method: req.method,
      path: getRequestPath(req),
      requestId,
    }, 'HTTP request connection closed before completion');
  });

  next();
});

// Enforce supported media types for API requests that contain a body.
// Multipart is permitted for routes that implement file-upload validation.
app.use((req, res, next) => {
  if (!isApiPath(req.path)) {
    return next();
  }

  const bodyAllowedMethods = new Set([
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
  ]);

  if (!bodyAllowedMethods.has(req.method)) {
    return next();
  }

  const contentLength = req.headers['content-length'];
  const transferEncoding = req.headers['transfer-encoding'];

  const hasDeclaredBody =
    (contentLength !== undefined &&
      Number(contentLength) > 0) ||
    transferEncoding !== undefined;

  if (!hasDeclaredBody) {
    return next();
  }

  const supportedTypes = [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
  ];

  if (!req.is(supportedTypes)) {
    return next(createHttpError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'The request content type is not supported.',
    ));
  }

  next();
});

// Parse JSON and URL-encoded request bodies.
app.use(express.json({
  limit: '1mb',
  strict: true,
  type: 'application/json',
}));

app.use(express.urlencoded({
  extended: false,
  limit: '1mb',
  parameterLimit: 100,
}));

// Liveness: confirms that the application process can respond.
const healthPaths = [
  ...new Set(['/health', `${API_PREFIX}/health`]),
];

app.get(healthPaths, (req, res) => {
  return sendHealthResponse(res);
});

// Readiness checks can be registered by the application bootstrap:
//
// app.locals.readinessChecks = [
//   async () => database.checkConnection(),
//   async () => redis.ping(),
// ];
//
// Each check must throw or return false when its dependency is unhealthy.
app.get('/ready', async (req, res) => {
  const checks = Array.isArray(app.locals.readinessChecks)
    ? app.locals.readinessChecks
    : [];

  const results = await Promise.allSettled(
    checks.map(async (check) => {
      if (typeof check !== 'function') {
        throw new TypeError('Readiness checks must be functions.');
      }

      const result = await check();

      if (result === false) {
        throw new Error('Readiness check failed.');
      }

      return true;
    }),
  );

  const ready = results.every(
    (result) => result.status === 'fulfilled',
  );

  if (!ready) {
    log('error', {
      event: 'readiness_check_failed',
      service: SERVICE_NAME,
      failedChecks: results.filter(
        (result) => result.status === 'rejected',
      ).length,
    }, 'Application readiness check failed');
  }

  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
  });
});

// Mount implemented routes below this point.
// Example:
// const authRoutes = require('./routes/auth.routes');
// app.use(`${API_PREFIX}/auth`, authRoutes);
//
// Register multipart upload middleware on the specific routes that
// accept files. Validate content signatures and enforce storage policy.

// JSON 404 response.
app.use((req, res) => {
  return res.status(404).json({
    error: 'NOT_FOUND',
    message: 'The requested resource was not found.',
  });
});

// Centralized error handler. Keep this after every route.
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode =
    error.type === 'entity.too.large'
      ? 413
      : error.type === 'entity.parse.failed'
        ? 400
        : Number.isInteger(error.status) &&
            error.status >= 400 &&
            error.status < 600
          ? error.status
          : Number.isInteger(error.statusCode) &&
              error.statusCode >= 400 &&
              error.statusCode < 600
            ? error.statusCode
            : 500;

  const errorCode =
    statusCode === 413
      ? 'PAYLOAD_TOO_LARGE'
      : statusCode === 400
        ? 'INVALID_REQUEST'
        : statusCode === 401
          ? 'UNAUTHORIZED'
          : statusCode === 403
            ? 'FORBIDDEN'
            : statusCode === 404
              ? 'NOT_FOUND'
              : statusCode === 415
                ? 'UNSUPPORTED_MEDIA_TYPE'
                : statusCode === 429
                  ? 'RATE_LIMITED'
                  : statusCode >= 500
                    ? 'INTERNAL_SERVER_ERROR'
                    : error.code || 'REQUEST_ERROR';

  log(statusCode >= 500 ? 'error' : 'warn', {
    event: 'http_request_error',
    method: req.method,
    path: getRequestPath(req),
    statusCode,
    errorCode,
    errorType: error.type,
    errorName: error.name,
    requestId: getRequestId(req),
  }, 'HTTP request failed');

  const publicMessages = {
    400: 'The request body is invalid.',
    401: 'Authentication is required.',
    403: 'The request is not permitted.',
    404: 'The requested resource was not found.',
    413: 'The request payload exceeds the allowed size.',
    415: 'The request content type is not supported.',
    429: 'Too many requests. Please try again later.',
  };

  return res.status(statusCode).json({
    error: errorCode,
    message: statusCode >= 500
      ? 'An unexpected error occurred.'
      : publicMessages[statusCode] ||
        'The request could not be processed.',
  });
});

module.exports = app;
