
'use strict';

/**
 * MedOrbits -- Admissions Routes
 *
 * File: src/routes/admission.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/admissions
 *
 * Responsibilities:
 * - List and retrieve admission information.
 * - Create, update, and delete admission records.
 * - Delegate business logic to admission.controller.js.
 * - Forward asynchronous errors to centralized error handling.
 *
 * Security:
 * - Public read access, if permitted, must be configured explicitly.
 * - Protect write operations with authentication and appropriate permissions.
 * - Validate route parameters, query parameters, and request bodies.
 * - Enforce resource-level authorization in the service layer.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('admission.controller.js');

function registerControllerRoute(
  method,
  path,
  controllerMethod,
  description,
) {
  router[method](
    path,
    asyncHandler(
      handler(controller, controllerMethod, description),
    ),
  );
}

// Mounted at /api/v1/admissions

registerControllerRoute(
  'get',
  '/',
  'list',
  'List admission information',
);

registerControllerRoute(
  'get',
  '/:id',
  'getById',
  'Get admission information',
);

registerControllerRoute(
  'post',
  '/',
  'create',
  'Create admission information',
);

registerControllerRoute(
  'patch',
  '/:id',
  'update',
  'Update admission information',
);

registerControllerRoute(
  'delete',
  '/:id',
  'remove',
  'Delete admission information',
);

module.exports = router;
