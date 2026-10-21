
'use strict';

/**
 * MedOrbits -- Candidate Routes
 *
 * File: src/routes/candidate.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/candidates
 *
 * Responsibilities:
 * - Retrieve the authenticated candidate's profile.
 * - Update the authenticated candidate's profile.
 * - List candidates for authorized users.
 * - Retrieve an individual candidate profile when permitted.
 *
 * Security:
 * - Require authentication for profile operations.
 * - Restrict candidate listing to authorized roles.
 * - Enforce profile ownership and resource-level permissions.
 * - Prevent unauthorized access to private candidate information.
 * - Validate identifiers, query parameters, and update payloads.
 * - Exclude sensitive fields from public responses.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('candidate.controller.js');

function registerCandidateRoute(
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

// Mounted at /api/v1/candidates
//
// Apply authentication and role-based authorization through the
// application's established middleware or protected router mounting.

registerCandidateRoute(
  'get',
  '/me',
  'me',
  'Get candidate profile',
);

registerCandidateRoute(
  'patch',
  '/me',
  'updateMe',
  'Update candidate profile',
);

registerCandidateRoute(
  'get',
  '/',
  'list',
  'List candidates',
);

registerCandidateRoute(
  'get',
  '/:id',
  'getById',
  'Get candidate',
);

module.exports = router;
