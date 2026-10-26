
'use strict';

/**
 * MedOrbits -- Password Routes
 *
 * File: src/routes/password.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/password
 *
 * Endpoints:
 * - POST /forgot  Request a password reset
 * - POST /reset   Reset password using a valid reset token
 * - POST /change  Change password for the authenticated user
 *
 * Security:
 * - Return generic responses for password-reset requests to prevent
 *   account enumeration.
 * - Rate-limit reset requests and token verification attempts.
 * - Generate cryptographically secure, short-lived, single-use reset tokens.
 * - Store only hashed reset tokens and invalidate them after use.
 * - Require authentication and current-password verification for password changes.
 * - Invalidate or rotate relevant sessions and refresh tokens after a reset.
 * - Never log passwords, reset tokens, or credential-bearing request bodies.
 * - Enforce password policy and validate request payloads.
 *
 * Note:
 * Authentication, rate limiting, CSRF protection where applicable, and
 * request validation must be configured through the application's existing
 * middleware and password service.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('password.controller.js');

function registerPasswordRoute(
  routePath,
  controllerMethod,
  description,
) {
  router.post(
    routePath,
    asyncHandler(
      handler(controller, controllerMethod, description),
    ),
  );
}

// Mounted at /api/v1/password

registerPasswordRoute(
  '/forgot',
  'forgot',
  'Request password reset',
);

registerPasswordRoute(
  '/reset',
  'reset',
  'Reset password',
);

registerPasswordRoute(
  '/change',
  'change',
  'Change authenticated user password',
);

module.exports = router;
