
'use strict';

/**
 * MedOrbits -- University Routes
 *
 * File: src/routes/university.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/universities
 *
 * Responsibilities:
 * - List and retrieve university records.
 * - Create, update, and delete university records.
 * - Delegate business logic to university.controller.js.
 * - Forward asynchronous errors to centralized error handling.
 *
 * Security:
 * - Configure public read access explicitly.
 * - Restrict create, update, and delete operations to authorized roles.
 * - Validate identifiers, query parameters, and request bodies.
 * - Enforce resource-level authorization in the service layer.
 * - Apply pagination and bounded result limits to listing endpoints.
 * - Validate imported university data before publishing it.
 * - Preserve data provenance for official and externally sourced records.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('university.controller.js');

function registerUniversityRoute(
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

// Mounted at /api/v1/universities

registerUniversityRoute(
  'get',
  '/',
  'list',
  'List universities',
);

registerUniversityRoute(
  'get',
  '/:id',
  'getById',
  'Get university',
);

registerUniversityRoute(
  'post',
  '/',
  'create',
  'Create university',
);

registerUniversityRoute(
  'patch',
  '/:id',
  'update',
  'Update university',
);

registerUniversityRoute(
  'delete',
  '/:id',
  'remove',
  'Delete university',
);

module.exports = router;
