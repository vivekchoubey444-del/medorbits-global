
'use strict';

/**
 * MedOrbits -- Upload Routes
 *
 * File: src/routes/upload.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/uploads
 *
 * Responsibilities:
 * - Accept file uploads through upload.controller.js.
 * - Retrieve authorized upload metadata.
 * - Delete uploads when permitted.
 *
 * Security:
 * - Require authentication and enforce resource-level authorization.
 * - Validate file size, MIME type, file signature, and upload metadata.
 * - Generate storage keys server-side; never trust client-supplied paths.
 * - Store private files outside publicly served directories.
 * - Apply request-size limits and upload rate limits.
 * - Verify ownership before retrieving metadata or deleting files.
 * - Use the configured storage integration for file operations.
 * - Record security-relevant actions without logging file contents or secrets.
 *
 * Note:
 * Configure multipart parsing and upload limits in the application or
 * upload middleware before this router. Do not assume req.body contains
 * uploaded file bytes unless the configured parser provides them.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('upload.controller.js');

function registerUploadRoute(
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

// Mounted at /api/v1/uploads
//
// Apply authentication, upload parsing, size limits, and authorization
// through the application's established middleware configuration.

registerUploadRoute(
  'post',
  '/',
  'create',
  'Upload file',
);

registerUploadRoute(
  'get',
  '/:id',
  'getById',
  'Get upload metadata',
);

registerUploadRoute(
  'delete',
  '/:id',
  'remove',
  'Delete upload',
);

module.exports = router;
