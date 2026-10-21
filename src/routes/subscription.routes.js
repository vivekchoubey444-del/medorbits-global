
'use strict';

/**
 * MedOrbits -- Subscription Routes
 *
 * File: src/routes/subscription.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/subscriptions
 *
 * Responsibilities:
 * - List available subscription plans.
 * - Create a subscription for the authenticated user.
 * - Retrieve the current user's subscription.
 * - Cancel an existing subscription.
 *
 * Security:
 * - Keep plan listing public only if intended by application policy.
 * - Require authentication for subscription creation, retrieval, and cancellation.
 * - Derive the subscriber identity from the authenticated session, not request data.
 * - Verify subscription ownership before cancellation.
 * - Validate plan IDs and prevent unauthorized price or status changes.
 * - Verify payment-provider webhooks separately from client requests.
 * - Make creation and cancellation operations idempotent where appropriate.
 * - Never expose payment secrets or sensitive provider payloads.
 *
 * Note:
 * Authentication, authorization, validation, rate limiting, and payment checks
 * must be attached through the application's established middleware and services.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('subscription.controller.js');

function registerSubscriptionRoute(
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

// Mounted at /api/v1/subscriptions

registerSubscriptionRoute(
  'get',
  '/plans',
  'plans',
  'List subscription plans',
);

registerSubscriptionRoute(
  'post',
  '/',
  'create',
  'Create subscription',
);

registerSubscriptionRoute(
  'get',
  '/mine',
  'mine',
  'Get my subscription',
);

registerSubscriptionRoute(
  'post',
  '/:id/cancel',
  'cancel',
  'Cancel subscription',
);

module.exports = router;
