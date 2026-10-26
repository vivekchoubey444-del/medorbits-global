
'use strict';

/**
 * MedOrbits -- Service Routes
 *
 * File: src/routes/service.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/services
 *
 * Responsibilities:
 * - List available consultancy and support services.
 * - Retrieve service details.
 * - Create service requests.
 * - List requests belonging to the authenticated user.
 *
 * Security:
 * - Validate and paginate public service listings.
 * - Require authentication for service-request operations.
 * - Derive the requester identity from the authenticated principal.
 * - Enforce ownership checks when listing service requests.
 * - Validate request fields and reject unexpected properties.
 * - Apply rate limits and prevent duplicate request submissions.
 * - Avoid exposing internal notes or other users' personal information.
 *
 * Note:
 * Attach authentication, authorization, validation, and rate-limiting
 * middleware using the application's established middleware configuration.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('service.controller.js');

function registerServiceRoute(
  method,
  routePath,
  controllerMethod,
  description,
) {
  router[method](
    routePath,
    asyncHandler(
      handler(controller, controllerMethod, description),
    ),
  );
}

// Mounted at /api/v1/services

// Register specific paths before the generic /:id route.
registerServiceRoute(
  'post',
  '/requests',
  'createRequest',
  'Create service request',
);

registerServiceRoute(
  'get',
  '/requests/mine',
  'listMyRequests',
  'List authenticated user service requests',
);

registerServiceRoute(
  'get',
  '/',
  'list',
  'List services',
);

registerServiceRoute(
  'get',
  '/:id',
  'getById',
  'Get service',
);

module.exports = router;
