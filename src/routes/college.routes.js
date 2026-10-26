
'use strict';

/**
 * MedOrbits -- College Routes
 *
 * File: src/routes/college.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/colleges
 *
 * Responsibilities:
 * - List and retrieve college records.
 * - Create, update, and delete college records.
 * - Delegate business logic to college.controller.js.
 * - Forward asynchronous errors to centralized error handling.
 *
 * Security:
 * - Configure public read access explicitly.
 * - Restrict create, update, and delete operations to authorized roles.
 * - Validate identifiers, query parameters, and request bodies.
 * - Enforce authorization in the service layer.
 * - Use pagination and bounded result limits for list operations.
 * - Validate imported college data before publishing it.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('college.controller.js');

function registerCollegeRoute(
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

// Mounted at /api/v1/colleges

registerCollegeRoute(
  'get',
  '/',
  'list',
  'List colleges',
);

registerCollegeRoute(
  'get',
  '/:id',
  'getById',
  'Get college',
);

registerCollegeRoute(
  'post',
  '/',
  'create',
  'Create college',
);

registerCollegeRoute(
  'patch',
  '/:id',
  'update',
  'Update college',
);

registerCollegeRoute(
  'delete',
  '/:id',
  'remove',
  'Delete college',
);

module.exports = router;
