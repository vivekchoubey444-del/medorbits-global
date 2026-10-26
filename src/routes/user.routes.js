
'use strict';

/**
 * MedOrbits -- User Routes
 *
 * File: src/routes/user.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/users
 *
 * Responsibilities:
 * - List users for authorized administrators.
 * - Retrieve and update the authenticated user's profile.
 * - Retrieve, update, or delete a user when explicitly authorized.
 * - Delegate business logic to user.controller.js.
 *
 * Security:
 * - Require authentication for protected endpoints.
 * - Restrict user listing and administrative operations to authorized roles.
 * - Enforce ownership and resource-level authorization in the service layer.
 * - Prevent users from modifying protected roles, permissions, or account status.
 * - Validate identifiers, query parameters, and request bodies.
 * - Prevent self-service operations from bypassing administrative controls.
 * - Exclude password hashes, tokens, and other sensitive fields from responses.
 * - Audit sensitive administrative changes and account deletion.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('user.controller.js');

function registerUserRoute(
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

// Mounted at /api/v1/users
//
// Ensure authentication and role-based authorization are applied through
// the application's established middleware or protected router mounting.

registerUserRoute(
  'get',
  '/',
  'list',
  'List users',
);

// Register /me routes before /:id routes.
registerUserRoute(
  'get',
  '/me',
  'me',
  'Get current user',
);

registerUserRoute(
  'patch',
  '/me',
  'updateMe',
  'Update current user',
);

registerUserRoute(
  'get',
  '/:id',
  'getById',
  'Get user',
);

registerUserRoute(
  'patch',
  '/:id',
  'update',
  'Update user',
);

registerUserRoute(
  'delete',
  '/:id',
  'remove',
  'Delete user',
);

module.exports = router;
