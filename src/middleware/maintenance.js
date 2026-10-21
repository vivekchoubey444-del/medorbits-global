
'use strict';

/**
 * MedOrbits -- Maintenance Mode Middleware
 *
 * File: src/middleware/maintenance.js
 * Runtime: Node.js >= 20
 *
 * Features:
 * - Environment/config-driven maintenance mode.
 * - Exact path exemptions and optional prefix exemptions.
 * - Separate API and HTML responses.
 * - Retry-After support.
 * - Request ID propagation.
 * - Fail-fast configuration validation.
 *
 * Mount after request-ID middleware and before application routes.
 */

const DEFAULT_EXEMPT_PATHS = Object.freeze([
  '/health',
  '/api/health',
  '/ready',
  '/health/live',
  '/health/ready',
  '/api/health/live',
  '/api/health/ready',
]);

const DEFAULT_MESSAGE =
  'The service is temporarily unavailable for maintenance.';

function normalizePath(value, name) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('?') ||
    value.includes('#') ||
    value.includes('\\')
  ) {
    throw new TypeError(`${name} must be an absolute URL path.`);
  }

  if (value.length > 2048) {
    throw new TypeError(`${name} is too long.`);
  }

  return value.length > 1
    ? value.replace(/\/+$/, '')
    : '/';
}

function validateString(value, name, maxLength = 500) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > maxLength
  ) {
    throw new TypeError(
      `${name} must be a non-empty string of at most ${maxLength} characters.`
    );
  }

  return value.trim();
}

function normalizePathList(value, name) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array of paths.`);
  }

  return value.map((path) => normalizePath(path, name));
}

function isPathWithinPrefix(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function maintenance(options = {}) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('Maintenance options must be an object.');
  }

  const envEnabled = process.env.MAINTENANCE_MODE === 'true';

  if (
    options.enabled != null &&
    typeof options.enabled !== 'boolean'
  ) {
    throw new TypeError('Maintenance enabled must be a boolean.');
  }

  const enabled = options.enabled ?? envEnabled;

  const exemptPaths = new Set(
    normalizePathList(
      options.exemptPaths ?? DEFAULT_EXEMPT_PATHS,
      'exemptPaths'
    )
  );

  const exemptPrefixes = normalizePathList(
    options.exemptPrefixes ?? [],
    'exemptPrefixes'
  );

  const apiPrefix = normalizePath(
    options.apiPrefix ?? '/api/v1',
    'apiPrefix'
  );

  const retryAfterSeconds =
    options.retryAfterSeconds ?? 300;

  if (
    !Number.isSafeInteger(retryAfterSeconds) ||
    retryAfterSeconds < 1 ||
    retryAfterSeconds > 86400
  ) {
    throw new TypeError(
      'retryAfterSeconds must be an integer between 1 and 86400.'
    );
  }

  const message = validateString(
    options.message ?? DEFAULT_MESSAGE,
    'message'
  );

  if (
    options.htmlHandler != null &&
    typeof options.htmlHandler !== 'function'
  ) {
    throw new TypeError('htmlHandler must be a function.');
  }

  if (
    options.shouldExempt != null &&
    typeof options.shouldExempt !== 'function'
  ) {
    throw new TypeError('shouldExempt must be a function.');
  }

  return function maintenanceMiddleware(req, res, next) {
    if (!enabled) {
      return next();
    }

    const requestPath = req.path;

    if (typeof requestPath !== 'string') {
      return next(new Error('Invalid request path.'));
    }

    const normalizedRequestPath =
      requestPath.length > 1
        ? requestPath.replace(/\/+$/, '')
        : '/';

    // Only exact paths and explicit prefixes are exempt.
    if (
      exemptPaths.has(normalizedRequestPath) ||
      exemptPrefixes.some((prefix) =>
        isPathWithinPrefix(normalizedRequestPath, prefix)
      )
    ) {
      return next();
    }

    if (options.shouldExempt) {
      let exempt;

      try {
        exempt = options.shouldExempt(req);
      } catch (error) {
        return next(error);
      }

      // Fail closed if the exemption callback does not return true.
      if (exempt === true) {
        return next();
      }
    }

    res.setHeader(
      'Retry-After',
      String(retryAfterSeconds)
    );

    res.setHeader('Cache-Control', 'no-store');

    const requestId =
      typeof req.id === 'string' &&
      /^[A-Za-z0-9._:-]{1,128}$/.test(req.id)
        ? req.id
        : null;

    if (isPathWithinPrefix(normalizedRequestPath, apiPrefix)) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'MAINTENANCE_MODE',
          message,
        },
        ...(requestId ? { requestId } : {}),
      });
    }

    if (typeof options.htmlHandler === 'function') {
      return options.htmlHandler(req, res, next);
    }

    return res
      .status(503)
      .type('text/plain')
      .send(message);
  };
}

module.exports = maintenance;
