
'use strict';

/**
 * MedOrbits -- Public Release Routes
 *
 * File: src/routes/public-release.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/public-releases
 *
 * Endpoint:
 * - GET /  List published public releases
 *
 * Security:
 * - Expose only approved, published release metadata.
 * - Exclude drafts, internal notes, secrets, and private file paths.
 * - Validate and bound pagination and filtering in the controller.
 * - Apply rate limiting through application middleware.
 * - Use stable response formats and centralized error handling.
 */

const express = require('express');
const { asyncHandler } = require('./route-utils');
const controller = require('../controllers/public-release.controller');

const router = express.Router();

if (!controller || typeof controller.list !== 'function') {
  throw new TypeError(
    'public-release.controller.js must export a list function.',
  );
}

router.get(
  '/',
  asyncHandler(controller.list),
);

module.exports = router;
