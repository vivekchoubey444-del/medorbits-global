
'use strict';

/**
 * MedOrbits -- Contact Routes
 *
 * File: src/routes/contact.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/contact
 *
 * Responsibilities:
 * - Accept contact form submissions.
 * - List contact messages for authorized staff.
 * - Retrieve individual contact messages.
 * - Update contact message status.
 * - Delegate business logic to contact.controller.js.
 *
 * Security:
 * - Apply request validation and rate limiting to public submissions.
 * - Restrict message listing, retrieval, and status updates to authorized staff.
 * - Validate identifiers and allowed status transitions.
 * - Prevent unauthorized access to contact messages and personal information.
 * - Avoid logging message bodies or sensitive contact details.
 * - Apply spam protection and request-size limits where appropriate.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('contact.controller.js');

function registerContactRoute(
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

// Mounted at /api/v1/contact

registerContactRoute(
  'post',
  '/',
  'create',
  'Submit contact message',
);

registerContactRoute(
  'get',
  '/',
  'list',
  'List contact messages',
);

registerContactRoute(
  'get',
  '/:id',
  'getById',
  'Get contact message',
);

registerContactRoute(
  'patch',
  '/:id/status',
  'updateStatus',
  'Update contact message status',
);

module.exports = router;
