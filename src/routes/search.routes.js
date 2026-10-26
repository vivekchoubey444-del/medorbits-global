
'use strict';

/**
 * MedOrbits -- Search Routes
 *
 * File: src/routes/search.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/search
 *
 * Endpoints:
 * - GET /             Unified MedOrbits search
 * - GET /courses      Search courses
 * - GET /colleges     Search colleges
 * - GET /jobs         Search jobs
 *
 * Security:
 * - Validate query parameters and enforce bounded pagination.
 * - Apply rate limiting through the application middleware.
 * - Return only public, published search results.
 * - Avoid exposing internal records, private fields, or filesystem paths.
 * - Keep external API access and provider credentials in the service layer.
 * - Escape search-result text in the frontend before rendering.
 *
 * Note:
 * This router delegates search logic to search.controller.js.
 * Authentication and rate limiting must be configured by the application.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('search.controller.js');

function registerSearchRoute(
  routePath,
  controllerMethod,
  description,
) {
  router.get(
    routePath,
    asyncHandler(
      handler(controller, controllerMethod, description),
    ),
  );
}

// Mounted at /api/v1/search

// Register specific endpoints before the general search endpoint.
registerSearchRoute(
  '/courses',
  'courses',
  'Search courses',
);

registerSearchRoute(
  '/colleges',
  'colleges',
  'Search colleges',
);

registerSearchRoute(
  '/jobs',
  'jobs',
  'Search jobs',
);

registerSearchRoute(
  '/',
  'search',
  'Search MedOrbits',
);

module.exports = router;
