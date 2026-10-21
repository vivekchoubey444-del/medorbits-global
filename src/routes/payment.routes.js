
'use strict';

/**
 * MedOrbits -- Payment Routes
 *
 * File: src/routes/payment.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/payments
 *
 * Endpoints:
 * - POST /checkout  Create a payment checkout
 * - GET  /mine      List payments belonging to the authenticated user
 * - POST /webhook   Process a payment-provider webhook
 * - GET  /:id       Retrieve an authorized payment record
 *
 * Security:
 * - Require authentication for checkout creation and payment retrieval.
 * - Derive the payer identity from the authenticated principal.
 * - Verify payment ownership before returning payment records.
 * - Verify webhook signatures against the raw request body using the
 *   provider-specific webhook verifier.
 * - Configure raw-body parsing for the webhook before JSON body parsing
 *   where required by the payment provider.
 * - Handle duplicate webhook events idempotently.
 * - Never trust client-submitted payment amounts or payment statuses.
 * - Never expose provider secrets, signatures, or sensitive payment data.
 * - Apply rate limits to client-facing payment endpoints.
 *
 * Note:
 * Webhook verification, authentication, authorization, and idempotency
 * must be implemented in the controller/service and application middleware.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('payment.controller.js');

function registerPaymentRoute(
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

// Mounted at /api/v1/payments

// Register fixed paths before the dynamic /:id route.
registerPaymentRoute(
  'post',
  '/webhook',
  'webhook',
  'Process payment webhook',
);

registerPaymentRoute(
  'post',
  '/checkout',
  'createCheckout',
  'Create payment checkout',
);

registerPaymentRoute(
  'get',
  '/mine',
  'listMine',
  'List authenticated user payments',
);

registerPaymentRoute(
  'get',
  '/:id',
  'getById',
  'Get payment',
);

module.exports = router;
