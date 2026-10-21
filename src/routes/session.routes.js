
'use strict';

/**
 * MedOrbits -- Session Routes
 *
 * File: src/routes/session.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/session
 *
 * Responsibilities:
 * - List sessions belonging to the authenticated user.
 * - Revoke a specific session.
 * - Revoke all other or all active sessions according to controller policy.
 *
 * Security:
 * - Require authentication on every endpoint.
 * - Derive user identity from the authenticated principal, never request input.
 * - Verify session ownership before revocation.
 * - Protect session listing against unauthorized access and data leakage.
 * - Apply rate limits to revocation operations.
 * - Invalidate server-side session or refresh-token state immediately.
 * - Prevent revoked refresh tokens from being reused.
 * - Never return session secrets, raw tokens, or credential material.
 *
 * Note:
 * Authentication and authorization middleware must be attached through the
 * application's existing middleware configuration.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('session.controller.js');

function registerSessionRoute(
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

// Mounted at /api/v1/session

registerSessionRoute(
  'get',
  '/',
  'list',
  'List authenticated user sessions',
);

registerSessionRoute(
  'delete',
  '/:id',
  'revoke',
  'Revoke a specific session',
);

registerSessionRoute(
  'delete',
  '/',
  'revokeAll',
  'Revoke all authenticated user sessions',
);

module.exports = router;
