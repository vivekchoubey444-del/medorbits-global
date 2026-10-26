
'use strict';

/**
 * MedOrbits -- Job Routes
 *
 * File: src/routes/job.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/jobs
 *
 * Endpoints:
 * - GET    /           List published jobs
 * - GET    /categories  List job categories
 * - GET    /:id         Get job details
 * - POST   /           Create a job listing
 * - PATCH  /:id         Update a job listing
 * - DELETE /:id         Delete a job listing
 *
 * Security:
 * - Restrict job creation and modification to authorized employers/admins.
 * - Verify listing ownership before updating or deleting a job.
 * - Validate job IDs, pagination, salary ranges, and listing status.
 * - Prevent unauthorized exposure of recruiter and applicant information.
 * - Apply rate limiting and audit sensitive job-listing operations.
 * - Return only published listings from public endpoints.
 *
 * Note:
 * Authentication, authorization, validation, and rate limiting must be
 * configured through the application's established middleware.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('job.controller.js');

function registerJobRoute(
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

// Mounted at /api/v1/jobs

// Register the specific path before /:id.
registerJobRoute(
  'get',
  '/categories',
  'categories',
  'List job categories',
);

registerJobRoute(
  'get',
  '/',
  'list',
  'List jobs',
);

registerJobRoute(
  'post',
  '/',
  'create',
  'Create job',
);

registerJobRoute(
  'get',
  '/:id',
  'getById',
  'Get job',
);

registerJobRoute(
  'patch',
  '/:id',
  'update',
  'Update job',
);

registerJobRoute(
  'delete',
  '/:id',
  'remove',
  'Delete job',
);

module.exports = router;
