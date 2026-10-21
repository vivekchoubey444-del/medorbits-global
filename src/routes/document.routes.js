
'use strict';

/**
 * MedOrbits -- Document Routes
 *
 * File: src/routes/document.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/documents
 *
 * Responsibilities:
 * - Create document records.
 * - List the authenticated user's documents.
 * - Retrieve authorized document records.
 * - Delete documents when permitted.
 * - Initiate document verification.
 * - Delegate business logic to document.controller.js.
 *
 * Security:
 * - Require authentication for document operations.
 * - Enforce document ownership and resource-level authorization.
 * - Keep private files outside publicly served directories.
 * - Validate document identifiers, metadata, and upload constraints.
 * - Verify access permissions before retrieving or deleting documents.
 * - Restrict verification operations to authorized workflows.
 * - Record security-relevant document operations in audit logs.
 * - Never expose private storage paths or document contents in logs.
 *
 * Note:
 * Document metadata access and file download authorization are separate
 * concerns. Any file-serving endpoint must independently enforce access
 * control and use the configured storage integration.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('document.controller.js');

function registerDocumentRoute(
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

// Mounted at /api/v1/documents

registerDocumentRoute(
  'post',
  '/',
  'create',
  'Create document record',
);

registerDocumentRoute(
  'get',
  '/mine',
  'listMine',
  'List my documents',
);

registerDocumentRoute(
  'get',
  '/:id',
  'getById',
  'Get document',
);

registerDocumentRoute(
  'delete',
  '/:id',
  'remove',
  'Delete document',
);

registerDocumentRoute(
  'post',
  '/:id/verify',
  'verify',
  'Verify document',
);

module.exports = router;
