
'use strict';

/**
 * MedOrbits -- FAQ Routes
 *
 * File: src/routes/faq.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/faqs
 *
 * Responsibilities:
 * - Answer FAQ questions.
 * - List and retrieve FAQ records.
 * - Create, update, and delete FAQ records.
 * - Delegate business logic to faq.controller.js.
 * - Forward asynchronous errors to centralized error handling.
 *
 * Security:
 * - Configure public FAQ read access explicitly.
 * - Restrict FAQ management operations to authorized administrators.
 * - Validate question input, identifiers, query parameters, and request bodies.
 * - Apply rate limits to question-answering requests.
 * - If answers use AI, treat retrieved content as untrusted input.
 * - Do not expose internal prompts, credentials, private records, or stack traces.
 * - Apply output validation and safe error handling to generated answers.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('faq.controller.js');

function registerFaqRoute(
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

// Mounted at /api/v1/faqs

// Register the specific path before the parameterized /:id route.
registerFaqRoute(
  'post',
  '/answer',
  'answer',
  'Answer FAQ question',
);

registerFaqRoute(
  'get',
  '/',
  'list',
  'List FAQs',
);

registerFaqRoute(
  'get',
  '/:id',
  'getById',
  'Get FAQ',
);

registerFaqRoute(
  'post',
  '/',
  'create',
  'Create FAQ',
);

registerFaqRoute(
  'patch',
  '/:id',
  'update',
  'Update FAQ',
);

registerFaqRoute(
  'delete',
  '/:id',
  'remove',
  'Delete FAQ',
);

module.exports = router;
