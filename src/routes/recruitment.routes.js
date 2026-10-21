
'use strict';

/**
 * MedOrbits -- Recruitment Routes
 *
 * File: src/routes/recruitment.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/recruitment
 *
 * Endpoints:
 * - POST  /requests       Create a recruitment request
 * - GET   /requests       List recruitment requests
 * - GET   /requests/:id   Retrieve a recruitment request
 * - PATCH /requests/:id   Update a recruitment request
 *
 * Security:
 * - Require authentication for request creation and updates.
 * - Restrict recruitment listings to authorized recruiters or administrators
 *   unless public access is explicitly intended.
 * - Derive the requester's identity from the authenticated principal.
 * - Enforce ownership and role-based access for individual records.
 * - Validate request bodies, identifiers, pagination, and status transitions.
 * - Prevent unauthorized access to candidate contact details and CVs.
 * - Apply rate limiting and audit sensitive recruitment operations.
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

const controller = loadController('recruitment.controller.js');

function registerRecruitmentRoute(
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

// Mounted at /api/v1/recruitment

registerRecruitmentRoute(
  'post',
  '/requests',
  'create',
  'Create recruitment request',
);

registerRecruitmentRoute(
  'get',
  '/requests',
  'list',
  'List recruitment requests',
);

registerRecruitmentRoute(
  'get',
  '/requests/:id',
  'getById',
  'Get recruitment request',
);

registerRecruitmentRoute(
  'patch',
  '/requests/:id',
  'update',
  'Update recruitment request',
);

module.exports = router;
