
'use strict';

/**
 * MedOrbits -- Internship Routes
 *
 * File: src/routes/internship.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/internships
 *
 * Endpoints:
 * - GET    /       List internships
 * - GET    /:id    Get internship details
 * - POST   /       Create internship
 * - PATCH  /:id    Update internship
 * - DELETE /:id    Delete internship
 *
 * Security:
 * - Allow public listing only for published internships.
 * - Require authorized employer or administrator access for write operations.
 * - Verify employer ownership before modifying or deleting a listing.
 * - Validate identifiers, request bodies, pagination, and listing status.
 * - Prevent exposure of applicant records and private employer information.
 * - Apply rate limits and audit sensitive listing changes.
 *
 * Note:
 * Configure authentication, authorization, validation, and rate limiting
 * through the application's established middleware.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('internship.controller.js');

function registerInternshipRoute(
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

// Mounted at /api/v1/internships

registerInternshipRoute(
  'get',
  '/',
  'list',
  'List internships',
);

registerInternshipRoute(
  'post',
  '/',
  'create',
  'Create internship',
);

registerInternshipRoute(
  'get',
  '/:id',
  'getById',
  'Get internship',
);

registerInternshipRoute(
  'patch',
  '/:id',
  'update',
  'Update internship',
);

registerInternshipRoute(
  'delete',
  '/:id',
  'remove',
  'Delete internship',
);

module.exports = router;
