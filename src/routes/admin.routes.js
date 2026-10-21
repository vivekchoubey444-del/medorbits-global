
'use strict';

/**
 * MedOrbits -- Admin Routes
 *
 * File: src/routes/admin.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/admin
 *
 * Responsibilities:
 * - Expose administrative overview and management endpoints.
 * - Delegate requests to admin.controller.js.
 * - Forward asynchronous errors to centralized error handling.
 *
 * Security:
 * - Mount behind authentication and administrator authorization middleware.
 * - Enforce resource-level authorization in services for sensitive mutations.
 * - Validate identifiers, query parameters, and request bodies.
 * - Never rely on frontend role checks for access control.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('admin.controller.js');

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

// Mounted at /api/v1/admin
//
// Apply authentication and administrator authorization when mounting
// this router in the application, or attach the project's established
// middleware here before registering protected routes.

registerControllerRoute(
  'get',
  '/overview',
  'overview',
  'Get admin overview',
);

registerControllerRoute(
  'get',
  '/users',
  'users',
  'List admin users',
);

registerControllerRoute(
  'get',
  '/applications',
  'applications',
  'List admin applications',
);

registerControllerRoute(
  'get',
  '/payments',
  'payments',
  'List admin payments',
);

registerControllerRoute(
  'get',
  '/audit-logs',
  'auditLogs',
  'List audit logs',
);

registerControllerRoute(
  'patch',
  '/users/:id/role',
  'updateUserRole',
  'Update user role',
);

registerControllerRoute(
  'patch',
  '/applications/:id/status',
  'updateApplicationStatus',
  'Update application status',
);

module.exports = router;
