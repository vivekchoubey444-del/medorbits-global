
'use strict';

/**
 * MedOrbits -- Verification Routes
 *
 * File: src/routes/verification.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/verification
 *
 * Responsibilities:
 * - Request email verification.
 * - Confirm email verification.
 * - Request phone verification.
 * - Confirm phone verification.
 * - Retrieve the authenticated user's verification status.
 *
 * Security:
 * - Apply rate limits to verification requests and confirmation attempts.
 * - Enforce OTP expiration, single-use validation, and attempt limits in services.
 * - Prevent account enumeration through generic responses where appropriate.
 * - Bind verification challenges to the intended account and destination.
 * - Never log OTPs, verification tokens, or complete contact details.
 * - Require authentication where appropriate and enforce account ownership.
 * - Invalidate consumed challenges and prevent replay.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('verification.controller.js');

function registerVerificationRoute(
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

// Mounted at /api/v1/verification

registerVerificationRoute(
  'post',
  '/email/send',
  'sendEmail',
  'Send email verification',
);

registerVerificationRoute(
  'post',
  '/email/confirm',
  'confirmEmail',
  'Confirm email verification',
);

registerVerificationRoute(
  'post',
  '/phone/send',
  'sendPhone',
  'Send phone verification',
);

registerVerificationRoute(
  'post',
  '/phone/confirm',
  'confirmPhone',
  'Confirm phone verification',
);

registerVerificationRoute(
  'get',
  '/status',
  'status',
  'Get verification status',
);

module.exports = router;
