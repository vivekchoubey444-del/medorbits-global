
'use strict';

/**
 * MedOrbits -- Notification Routes
 *
 * File: src/routes/notification.routes.js
 * Runtime: Node.js >= 20
 * Mount: /api/v1/notifications
 *
 * Endpoints:
 * - GET    /              List notifications
 * - GET    /unread-count   Get unread notification count
 * - PATCH  /:id/read      Mark a notification as read
 * - POST   /read-all      Mark all notifications as read
 * - DELETE /:id           Delete a notification
 *
 * Security:
 * - Require authentication for all notification endpoints.
 * - Derive the recipient identity from the authenticated principal.
 * - Enforce notification ownership on read, update, and delete operations.
 * - Never allow users to access another user's notifications.
 * - Validate identifiers and bound pagination parameters.
 * - Make bulk read operations atomic where supported.
 * - Avoid exposing internal delivery metadata, tokens, or provider payloads.
 * - Apply rate limiting and audit relevant security-sensitive actions.
 *
 * Note:
 * Attach authentication, authorization, validation, and rate limiting
 * through the application's established middleware configuration.
 */

const express = require('express');

const {
  loadController,
  handler,
  asyncHandler,
} = require('./route-utils');

const router = express.Router();

const controller = loadController('notification.controller.js');

function registerNotificationRoute(
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

// Mounted at /api/v1/notifications

// Register specific paths before the generic /:id route.
registerNotificationRoute(
  'get',
  '/unread-count',
  'unreadCount',
  'Count unread notifications',
);

registerNotificationRoute(
  'post',
  '/read-all',
  'markAllRead',
  'Mark all notifications as read',
);

registerNotificationRoute(
  'get',
  '/',
  'list',
  'List notifications',
);

registerNotificationRoute(
  'patch',
  '/:id/read',
  'markRead',
  'Mark notification as read',
);

registerNotificationRoute(
  'delete',
  '/:id',
  'remove',
  'Delete notification',
);

module.exports = router;
