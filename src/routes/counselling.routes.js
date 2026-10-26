
'use strict';

/**
 * MedOrbits -- Counselling Routes
 *
 * File: src/routes/counselling.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/counselling
 *
 * Responsibilities:
 * - Create counselling requests.
 * - List the authenticated user's counselling requests.
 * - Retrieve and update counselling requests.
 * - Book counselling appointments.
 * - Delegate business logic to counselling.controller.js.
 *
 * Security:
 * - Require authentication for private requests and appointments.
 * - Enforce request ownership and staff permissions.
 * - Validate identifiers, request bodies, and appointment details.
 * - Prevent unauthorized access to student and applicant information.
 * - Validate appointment availability in the service layer.
 * - Prevent duplicate bookings and invalid state transitions.
 * - Apply rate limits to request creation and appointment booking.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('counselling.controller.js');

function registerCounsellingRoute(
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

// Mounted at /api/v1/counselling

registerCounsellingRoute(
  'post',
  '/requests',
  'createRequest',
  'Create counselling request',
);

registerCounsellingRoute(
  'get',
  '/requests/mine',
  'listMine',
  'List my counselling requests',
);

registerCounsellingRoute(
  'get',
  '/requests/:id',
  'getById',
  'Get counselling request',
);

registerCounsellingRoute(
  'patch',
  '/requests/:id',
  'update',
  'Update counselling request',
);

registerCounsellingRoute(
  'post',
  '/appointments',
  'bookAppointment',
  'Book counselling appointment',
);

module.exports = router;
