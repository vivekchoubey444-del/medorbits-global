
'use strict';

/**
 * MedOrbits -- Authentication Routes
 *
 * File: src/routes/auth.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/auth
 *
 * Responsibilities:
 * - Register accounts.
 * - Authenticate users.
 * - Terminate sessions.
 * - Refresh authentication sessions.
 * - Retrieve the authenticated account.
 *
 * Security:
 * - Apply authentication and authorization middleware where required.
 * - Rate-limit registration, login, and refresh endpoints.
 * - Validate and normalize request inputs.
 * - Use secure, expiring session or refresh-token mechanisms.
 * - Protect cookie-based authentication against CSRF where applicable.
 * - Never log passwords, tokens, session cookies, or authentication secrets.
 * - Ensure logout invalidates the relevant session or refresh token.
 *
 * Note:
 * Controller methods must enforce their own authentication and
 * validation requirements. Route registration alone does not secure
 * an endpoint.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('auth.controller.js');

function registerAuthRoute(
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

// Mounted at /api/v1/auth

registerAuthRoute(
  'post',
  '/register',
  'register',
  'Register account',
);

registerAuthRoute(
  'post',
  '/login',
  'login',
  'Log in',
);

registerAuthRoute(
  'post',
  '/logout',
  'logout',
  'Log out',
);

registerAuthRoute(
  'post',
  '/refresh',
  'refresh',
  'Refresh session',
);

registerAuthRoute(
  'get',
  '/me',
  'me',
  'Get current account',
);

module.exports = router;
