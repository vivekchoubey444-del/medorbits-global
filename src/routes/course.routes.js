
'use strict';

/**
 * MedOrbits -- Course Routes
 *
 * File: src/routes/course.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/courses
 *
 * Responsibilities:
 * - List and retrieve course records.
 * - Create, update, and delete course records.
 * - Delegate business logic to course.controller.js.
 * - Forward asynchronous errors to centralized error handling.
 *
 * Security:
 * - Configure public read access explicitly.
 * - Restrict course creation, updates, and deletion to authorized roles.
 * - Validate identifiers, query parameters, and request bodies.
 * - Enforce authorization and business rules in the service layer.
 * - Apply pagination and bounded result limits to listing endpoints.
 * - Validate course data before publication.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('course.controller.js');

function registerCourseRoute(
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

// Mounted at /api/v1/courses

registerCourseRoute(
  'get',
  '/',
  'list',
  'List courses',
);

registerCourseRoute(
  'get',
  '/:id',
  'getById',
  'Get course',
);

registerCourseRoute(
  'post',
  '/',
  'create',
  'Create course',
);

registerCourseRoute(
  'patch',
  '/:id',
  'update',
  'Update course',
);

registerCourseRoute(
  'delete',
  '/:id',
  'remove',
  'Delete course',
);

module.exports = router;
