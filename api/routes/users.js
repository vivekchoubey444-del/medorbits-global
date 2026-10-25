
"use strict";

/**
 * MedOrbits -- User Routes
 * File: /api/routes/users.js
 *
 * Expected service:
 *   ../services/user-service.js
 *
 * Expected middleware exports:
 *   ../middlerware/authorization.js
 *     - authenticate
 *     - authorize
 *
 *   ../middlerware/validation.js
 *     - validateBody
 *     - validateParams
 *     - validateQuery
 *
 * Recommended mount:
 *   app.use("/api/users", usersRouter);
 *
 * Security:
 *   - Users can access and update their own profile.
 *   - Administrative operations require explicit permissions.
 *   - Public requests cannot set roles, permissions, or account status.
 *   - Passwords, password hashes, and internal security fields must
 *     never be returned by the service.
 */

const express = require("express");

const userService = require("../services/user-service");

const {
  authenticate,
  authorize,
} = require("../middlerware/authorization");

const {
  validateBody,
  validateParams,
  validateQuery,
} = require("../middlerware/validation");

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const USER_ID_PATTERN = "^[A-Za-z0-9_-]{1,128}$";

const USER_ROLES = [
  "student",
  "applicant",
  "counsellor",
  "recruiter",
  "employer",
  "support",
  "admin",
];

const USER_STATUSES = [
  "active",
  "inactive",
  "suspended",
  "pending_verification",
];

/* -------------------------------------------------------------------------- */
/* JSON Schema definitions -- Draft 2020-12                                    */
/* -------------------------------------------------------------------------- */

const userIdParamsSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: ["userId"],
  properties: {
    userId: {
      type: "string",
      pattern: USER_ID_PATTERN,
      maxLength: 128,
    },
  },
  additionalProperties: false,
};

const listUsersQuerySchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    page: {
      type: "integer",
      minimum: 1,
      maximum: 100000,
      default: 1,
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 100,
      default: 20,
    },
    search: {
      type: "string",
      minLength: 1,
      maxLength: 120,
    },
    role: {
      type: "string",
      enum: USER_ROLES,
    },
    status: {
      type: "string",
      enum: USER_STATUSES,
    },
    sortBy: {
      type: "string",
      enum: ["createdAt", "updatedAt", "name", "email"],
      default: "createdAt",
    },
    sortOrder: {
      type: "string",
      enum: ["asc", "desc"],
      default: "desc",
    },
  },
  additionalProperties: false,
};

const updateOwnProfileSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  minProperties: 1,
  properties: {
    firstName: {
      type: "string",
      minLength: 1,
      maxLength: 80,
      pattern: ".*\\S.*",
    },
    lastName: {
      type: "string",
      minLength: 1,
      maxLength: 80,
      pattern: ".*\\S.*",
    },
    phone: {
      type: "string",
      minLength: 7,
      maxLength: 25,
      pattern: "^[+0-9() .-]+$",
    },
    dateOfBirth: {
      type: "string",
      format: "date",
    },
    profileImageUrl: {
      type: "string",
      format: "uri",
      maxLength: 2048,
    },
    preferredLanguage: {
      type: "string",
      minLength: 2,
      maxLength: 12,
      pattern: "^[A-Za-z-]+$",
    },
    timezone: {
      type: "string",
      minLength: 1,
      maxLength: 100,
    },
    address: {
      type: "object",
      properties: {
        line1: { type: "string", maxLength: 200 },
        line2: { type: "string", maxLength: 200 },
        city: { type: "string", maxLength: 100 },
        state: { type: "string", maxLength: 100 },
        postalCode: { type: "string", maxLength: 20 },
        country: { type: "string", maxLength: 100 },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const adminUpdateUserSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  minProperties: 1,
  properties: {
    firstName: {
      type: "string",
      minLength: 1,
      maxLength: 80,
      pattern: ".*\\S.*",
    },
    lastName: {
      type: "string",
      minLength: 1,
      maxLength: 80,
      pattern: ".*\\S.*",
    },
    phone: {
      type: "string",
      minLength: 7,
      maxLength: 25,
      pattern: "^[+0-9() .-]+$",
    },
    role: {
      type: "string",
      enum: USER_ROLES,
    },
    status: {
      type: "string",
      enum: USER_STATUSES,
    },
  },
  additionalProperties: false,
};

const deactivateAccountSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: ["confirmation"],
  properties: {
    confirmation: {
      type: "string",
      const: "DEACTIVATE",
    },
    reason: {
      type: "string",
      maxLength: 500,
    },
  },
  additionalProperties: false,
};

const updateStatusSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: ["status"],
  properties: {
    status: {
      type: "string",
      enum: USER_STATUSES,
    },
    reason: {
      type: "string",
      maxLength: 500,
    },
  },
  additionalProperties: false,
};

/* -------------------------------------------------------------------------- */
/* Async handler and service helpers                                          */
/* -------------------------------------------------------------------------- */

function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  error.code = code;
  return error;
}

function getAuthenticatedUserId(req) {
  const user = req.user;

  const id = user && (user.id || user.userId || user.sub);

  if (!id || typeof id !== "string") {
    throw httpError(
      401,
      "AUTHENTICATION_REQUIRED",
      "A valid authenticated user is required."
    );
  }

  return id;
}

function requireServiceMethod(methodName) {
  const method = userService[methodName];

  if (typeof method !== "function") {
    throw httpError(
      500,
      "USER_SERVICE_MISCONFIGURED",
      `The user service method "${methodName}" is not configured.`
    );
  }

  return method;
}

/**
 * Call a user-service method with a consistent request contract.
 * Adjust the service method signatures if your implementation differs.
 */
async function callUserService(methodName, ...args) {
  const method = requireServiceMethod(methodName);
  return method(...args);
}

/* -------------------------------------------------------------------------- */
/* Health-independent user endpoints                                          */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/users/me
 * Return the authenticated user's safe profile.
 */
router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = getAuthenticatedUserId(req);

    const user = await callUserService("getUserById", userId);

    if (!user) {
      throw httpError(404, "USER_NOT_FOUND", "User profile not found.");
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  })
);

/**
 * PATCH /api/users/me
 * Update permitted profile fields only.
 */
router.patch(
  "/me",
  authenticate,
  validateBody(updateOwnProfileSchema),
  asyncHandler(async (req, res) => {
    const userId = getAuthenticatedUserId(req);

    const user = await callUserService(
      "updateUserProfile",
      userId,
      req.body
    );

    if (!user) {
      throw httpError(404, "USER_NOT_FOUND", "User profile not found.");
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: { user },
    });
  })
);

/**
 * POST /api/users/me/deactivate
 * Request account deactivation.
 *
 * The service should revoke sessions and tokens as appropriate.
 * Keep the account recoverable if your retention policy requires it.
 */
router.post(
  "/me/deactivate",
  authenticate,
  validateBody(deactivateAccountSchema),
  asyncHandler(async (req, res) => {
    const userId = getAuthenticatedUserId(req);

    const result = await callUserService(
      "deactivateOwnAccount",
      userId,
      {
        reason: req.body.reason || null,
      }
    );

    res.status(200).json({
      success: true,
      message: "Account deactivation request processed.",
      data: result || null,
    });
  })
);

/* -------------------------------------------------------------------------- */
/* Administrator endpoints                                                    */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/users
 * List users. Requires users:read permission.
 */
router.get(
  "/",
  authenticate,
  authorize("users:read"),
  validateQuery(listUsersQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await callUserService("listUsers", {
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 20),
      search: req.query.search || undefined,
      role: req.query.role || undefined,
      status: req.query.status || undefined,
      sortBy: req.query.sortBy || "createdAt",
      sortOrder: req.query.sortOrder || "desc",
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * GET /api/users/:userId
 * Read a user record. Requires users:read permission.
 */
router.get(
  "/:userId",
  authenticate,
  authorize("users:read"),
  validateParams(userIdParamsSchema),
  asyncHandler(async (req, res) => {
    const user = await callUserService("getUserById", req.params.userId);

    if (!user) {
      throw httpError(404, "USER_NOT_FOUND", "User not found.");
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  })
);

/**
 * PATCH /api/users/:userId
 * Administrative update of a user's profile, role, or status.
 *
 * Restrict this permission to trusted administrators.
 * The service should prevent unsafe privilege escalation and audit changes.
 */
router.patch(
  "/:userId",
  authenticate,
  authorize("users:update"),
  validateParams(userIdParamsSchema),
  validateBody(adminUpdateUserSchema),
  asyncHandler(async (req, res) => {
    const actorId = getAuthenticatedUserId(req);
    const targetUserId = req.params.userId;

    const user = await callUserService(
      "adminUpdateUser",
      targetUserId,
      req.body,
      {
        actorId,
      }
    );

    if (!user) {
      throw httpError(404, "USER_NOT_FOUND", "User not found.");
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully.",
      data: { user },
    });
  })
);

/**
 * PATCH /api/users/:userId/status
 * Change account status. Requires users:manage-status permission.
 */
router.patch(
  "/:userId/status",
  authenticate,
  authorize("users:manage-status"),
  validateParams(userIdParamsSchema),
  validateBody(updateStatusSchema),
  asyncHandler(async (req, res) => {
    const actorId = getAuthenticatedUserId(req);
    const targetUserId = req.params.userId;

    const user = await callUserService(
      "updateUserStatus",
      targetUserId,
      {
        status: req.body.status,
        reason: req.body.reason || null,
      },
      {
        actorId,
      }
    );

    if (!user) {
      throw httpError(404, "USER_NOT_FOUND", "User not found.");
    }

    res.status(200).json({
      success: true,
      message: "User status updated successfully.",
      data: { user },
    });
  })
);

/**
 * DELETE /api/users/:userId
 * Soft-delete or deactivate a user. Requires users:delete permission.
 *
 * Prefer soft deletion unless permanent deletion is explicitly required
 * by your data-retention and privacy policies.
 */
router.delete(
  "/:userId",
  authenticate,
  authorize("users:delete"),
  validateParams(userIdParamsSchema),
  asyncHandler(async (req, res) => {
    const actorId = getAuthenticatedUserId(req);
    const targetUserId = req.params.userId;

    if (actorId === targetUserId) {
      throw httpError(
        400,
        "SELF_DELETION_NOT_ALLOWED",
        "Use the account deactivation process to deactivate your own account."
      );
    }

    const result = await callUserService(
      "deleteUser",
      targetUserId,
      { actorId }
    );

    if (!result) {
      throw httpError(404, "USER_NOT_FOUND", "User not found.");
    }

    res.status(200).json({
      success: true,
      message: "User deactivated or deleted successfully.",
      data: result,
    });
  })
);

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

module.exports = router;
