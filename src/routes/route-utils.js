
'use strict';

/**
 * MedOrbits -- Route Utilities
 *
 * File: src/routes/route-utils.js
 * Runtime: Node.js >= 20
 *
 * Responsibilities:
 * - Safely load route controllers.
 * - Resolve controller handlers with consistent fallback responses.
 * - Forward synchronous and asynchronous errors to Express error middleware.
 * - Register standard CRUD routes.
 *
 * Security:
 * - Missing controllers must not silently turn production endpoints into 501s.
 * - Do not expose stack traces, filesystem paths, or internal error details.
 * - Preserve controller method context when invoking class-based controllers.
 * - Validate route options and controller filenames.
 * - Keep authentication, authorization, validation, and rate limiting
 *   in the application's established middleware configuration.
 */

const path = require('node:path');

const CONTROLLERS_DIR = path.resolve(__dirname, '..', 'controllers');

const CONTROLLER_FILENAME_PATTERN =
  /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.controller\.js$/;

function notImplemented(feature) {
  const safeFeature =
    typeof feature === 'string' && feature.trim()
      ? feature.trim().slice(0, 120)
      : 'This feature';

  return function notImplementedHandler(req, res) {
    return res.status(501).json({
      success: false,
      error: {
        code: 'FEATURE_NOT_IMPLEMENTED',
        message: `${safeFeature} is not implemented yet.`,
      },
      requestId:
        typeof req.id === 'string' || typeof req.id === 'number'
          ? req.id
          : null,
    });
  };
}

/**
 * Load a controller from the fixed controllers directory.
 *
 * Only a genuinely missing target controller is converted to an empty
 * controller. Missing dependencies inside an existing controller are
 * rethrown so startup failures are not hidden.
 */
function loadController(controllerFilename) {
  if (
    typeof controllerFilename !== 'string' ||
    !CONTROLLER_FILENAME_PATTERN.test(controllerFilename) ||
    path.basename(controllerFilename) !== controllerFilename
  ) {
    throw new TypeError('Invalid controller filename.');
  }

  const controllerPath = path.join(
    CONTROLLERS_DIR,
    controllerFilename,
  );

  let resolvedPath;

  try {
    resolvedPath = require.resolve(controllerPath);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      // Verify the missing module is the controller itself, not one
      // of its dependencies.
      const targetMissing = !require('node:fs').existsSync(controllerPath);

      if (targetMissing) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(
            `Required controller is missing: ${controllerFilename}`,
          );
        }

        return {};
      }
    }

    throw error;
  }

  const controller = require(resolvedPath);

  if (
    !controller ||
    typeof controller !== 'object' ||
    Array.isArray(controller)
  ) {
    throw new TypeError(
      `Controller must export an object: ${controllerFilename}`,
    );
  }

  return controller;
}

/**
 * Resolve a controller method while preserving `this`.
 *
 * Returning a wrapper rather than the method directly allows controller
 * methods that depend on their instance context to work correctly.
 */
function handler(controller, method, feature) {
  if (
    controller &&
    typeof controller[method] === 'function'
  ) {
    return function controllerHandler(req, res, next) {
      return controller[method](req, res, next);
    };
  }

  return notImplemented(feature || method);
}

/**
 * Forward synchronous exceptions and rejected promises to next(error).
 * Compatible with Express 4 and Express 5.
 */
function asyncHandler(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('asyncHandler requires a function.');
  }

  return function wrappedAsyncHandler(req, res, next) {
    try {
      return Promise.resolve(fn(req, res, next)).catch(next);
    } catch (error) {
      return next(error);
    }
  };
}

function validateRouter(router) {
  if (
    !router ||
    typeof router.get !== 'function' ||
    typeof router.post !== 'function' ||
    typeof router.patch !== 'function' ||
    typeof router.delete !== 'function'
  ) {
    throw new TypeError('A valid Express router is required.');
  }
}

function normalizeBase(base) {
  if (typeof base !== 'string' || !base.startsWith('/')) {
    throw new TypeError('CRUD route base must start with "/".');
  }

  if (
    base.includes('?') ||
    base.includes('#') ||
    base.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(base)
  ) {
    throw new TypeError('Invalid CRUD route base.');
  }

  if (base === '/') return '';

  return base.replace(/\/+$/, '');
}

function normalizeIdParam(idParam) {
  if (
    typeof idParam !== 'string' ||
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(idParam)
  ) {
    throw new TypeError('Invalid CRUD route ID parameter.');
  }

  return `:${idParam}`;
}

/**
 * Register conventional CRUD endpoints.
 *
 * Supported options:
 *   base: '/'
 *   idParam: 'id'
 *   list: false
 *   getById: false
 *   create: false
 *   update: false
 *   remove: false
 *
 * Use dedicated routes when an endpoint requires custom middleware,
 * authorization, validation, or nonstandard controller methods.
 */
function registerCrudRoutes(
  router,
  controller,
  resourceName,
  options = {},
) {
  validateRouter(router);

  if (
    !resourceName ||
    typeof resourceName !== 'string' ||
    resourceName.trim().length > 100
  ) {
    throw new TypeError('A valid resource name is required.');
  }

  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('CRUD options must be an object.');
  }

  const base = normalizeBase(options.base || '/');
  const idParam = normalizeIdParam(options.idParam || 'id');
  const itemPath = `${base}/${idParam}`;

  const flags = [
    'list',
    'getById',
    'create',
    'update',
    'remove',
  ];

  for (const flag of flags) {
    if (
      options[flag] !== undefined &&
      typeof options[flag] !== 'boolean'
    ) {
      throw new TypeError(
        `CRUD option "${flag}" must be a boolean.`,
      );
    }
  }

  if (options.list !== false) {
    router.get(
      base || '/',
      asyncHandler(
        handler(controller, 'list', `List ${resourceName}`),
      ),
    );
  }

  if (options.getById !== false) {
    router.get(
      itemPath,
      asyncHandler(
        handler(controller, 'getById', `Get ${resourceName}`),
      ),
    );
  }

  if (options.create !== false) {
    router.post(
      base || '/',
      asyncHandler(
        handler(controller, 'create', `Create ${resourceName}`),
      ),
    );
  }

  if (options.update !== false) {
    router.patch(
      itemPath,
      asyncHandler(
        handler(controller, 'update', `Update ${resourceName}`),
      ),
    );
  }

  if (options.remove !== false) {
    router.delete(
      itemPath,
      asyncHandler(
        handler(controller, 'remove', `Delete ${resourceName}`),
      ),
    );
  }

  return router;
}

module.exports = {
  notImplemented,
  loadController,
  handler,
  asyncHandler,
  registerCrudRoutes,
};
