
'use strict';

/**
 * MedOrbits -- Application Routes
 *
 * File: src/routes/application.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/applications
 *
 * Responsibilities:
 * - List applications according to caller permissions.
 * - Retrieve the authenticated user's applications.
 * - Create, retrieve, update, and delete application records.
 * - Delegate business logic to application.controller.js.
 * - Forward asynchronous errors to centralized error handling.
 *
 * Security:
 * - Require authentication for applicant-specific operations.
 * - Restrict list and administrative operations to authorized roles.
 * - Enforce ownership and resource-level authorization in services.
 * - Validate identifiers, query parameters, and request bodies.
 * - Prevent users from changing protected fields or another user's records.
 * - Apply appropriate audit logging and state-transition rules.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('application.controller.js');

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

// Mounted at /api/v1/applications
//
// Ensure authentication and authorization middleware is applied
// according to the access policy configured by the application.

registerControllerRoute(
  'get',
  '/',
  'list',
  'List applications',
);

registerControllerRoute(
  'get',
  '/mine',
  'listMine',
  'List my applications',
);

registerControllerRoute(
  'post',
  '/',
  'create',
  'Create application',
);

registerControllerRoute(
  'get',
  '/:id',
  'getById',
  'Get application',
);

registerControllerRoute(
  'patch',
  '/:id',
  'update',
  'Update application',
);

registerControllerRoute(
  'delete',
  '/:id',
  'remove',
  'Delete application',
);

module.exports = router;
