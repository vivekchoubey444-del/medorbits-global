
'use strict';

/**
 * MedOrbits -- Employer Routes
 *
 * File: src/routes/employer.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/employers
 *
 * Responsibilities:
 * - Register and authenticate employers.
 * - Retrieve and update the authenticated employer profile.
 * - List employers for authorized users.
 * - Retrieve employer records when access is permitted.
 * - Delegate business logic to employer.controller.js.
 *
 * Security:
 * - Rate-limit registration and login endpoints.
 * - Require authentication for profile and protected listing operations.
 * - Enforce employer ownership and role-based authorization.
 * - Validate registration data, credentials, identifiers, and profile updates.
 * - Prevent users from modifying protected verification or account-status fields.
 * - Exclude credentials, tokens, and private employer data from responses.
 * - Use generic authentication errors where appropriate to reduce account enumeration.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('employer.controller.js');

function registerEmployerRoute(
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

// Mounted at /api/v1/employers
//
// Apply the application's established authentication, rate-limiting,
// and authorization middleware when mounting or configuring this router.

registerEmployerRoute(
  'post',
  '/register',
  'register',
  'Register employer',
);

registerEmployerRoute(
  'post',
  '/login',
  'login',
  'Employer login',
);

registerEmployerRoute(
  'get',
  '/me',
  'me',
  'Get employer profile',
);

registerEmployerRoute(
  'patch',
  '/me',
  'updateMe',
  'Update employer profile',
);

registerEmployerRoute(
  'get',
  '/',
  'list',
  'List employers',
);

registerEmployerRoute(
  'get',
  '/:id',
  'getById',
  'Get employer',
);

module.exports = router;
