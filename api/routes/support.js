
"use strict";

/**
 * MedOrbits -- Support API Routes
 * File: /api/routes/support.js
 * Runtime: Node.js 20+
 * Framework: Express
 *
 * Mount:
 *   app.use("/api/support", require("./routes/support"));
 *
 * Expected integrations:
 *   ../middlerware/authorization.js
 *   ../middlerware/validation.js
 *   ../services/support-service.js
 *
 * Security:
 * - Ticket ownership is enforced by the service.
 * - Users cannot set internal ticket status or priority.
 * - Internal notes are restricted to authorized support agents.
 * - Attachment IDs are references, not trusted file URLs.
 * - Unexpected errors are forwarded to centralized middleware.
 */

const express = require("express");

const router = express.Router();

const supportService = require("../services/support-service");

const {
  authenticate,
  authorize
} = require("../middlerware/authorization");

const {
  validateBody,
  validateParams,
  validateQuery
} = require("../middlerware/validation");

const DIALECT =
  "https://json-schema.org/draft/2020-12/schema";

const ID_PATTERN = "^[A-Za-z0-9_-]{1,100}$";

const TICKET_CATEGORIES = [
  "admissions",
  "applications",
  "documents",
  "jobs",
  "account",
  "payments",
  "refunds",
  "technical",
  "privacy",
  "complaint",
  "other"
];

const TICKET_STATUSES = [
  "open",
  "in-progress",
  "waiting-for-user",
  "waiting-for-support",
  "resolved",
  "closed"
];

const TICKET_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent"
];

/* -------------------------------------------------------------------------- */
/* Response helpers                                                           */
/* -------------------------------------------------------------------------- */

function success(res, data, message, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

function failure(res, statusCode, code, message) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message
    }
  });
}

function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function serviceMethod(name) {
  if (
    !supportService ||
    typeof supportService[name] !== "function"
  ) {
    const error = new Error(
      `Support service method "${name}" is not configured.`
    );

    error.status = 500;
    error.code = "SERVICE_CONFIGURATION_ERROR";

    throw error;
  }

  return supportService[name].bind(supportService);
}

function ticketNotFound(res) {
  return failure(
    res,
    404,
    "TICKET_NOT_FOUND",
    "The requested support ticket was not found."
  );
}

/* -------------------------------------------------------------------------- */
/* Validation schemas                                                        */
/* -------------------------------------------------------------------------- */

const ticketIdSchema = {
  $schema: DIALECT,
  type: "object",
  additionalProperties: false,
  properties: {
    ticketId: {
      type: "string",
      pattern: ID_PATTERN
    }
  },
  required: ["ticketId"]
};

const listTicketsSchema = {
  $schema: DIALECT,
  type: "object",
  additionalProperties: false,
  properties: {
    page: {
      type: "string",
      pattern: "^[1-9][0-9]{0,5}$"
    },
    limit: {
      type: "string",
      pattern: "^[1-9][0-9]{0,2}$"
    },
    category: {
      type: "string",
      enum: TICKET_CATEGORIES
    },
    status: {
      type: "string",
      enum: TICKET_STATUSES
    },
    search: {
      type: "string",
      minLength: 1,
      maxLength: 100
    },
    sortOrder: {
      type: "string",
      enum: ["asc", "desc"]
    }
  }
};

const createTicketSchema = {
  $schema: DIALECT,
  type: "object",
  additionalProperties: false,
  properties: {
    subject: {
      type: "string",
      minLength: 5,
      maxLength: 200
    },
    category: {
      type: "string",
      enum: TICKET_CATEGORIES
    },
    description: {
      type: "string",
      minLength: 10,
      maxLength: 10000
    },
    relatedApplicationId: {
      type: "string",
      pattern: ID_PATTERN
    },
    relatedDocumentId: {
      type: "string",
      pattern: ID_PATTERN
    },
    relatedJobId: {
      type: "string",
      pattern: ID_PATTERN
    },
    attachmentIds: {
      type: "array",
      uniqueItems: true,
      maxItems: 10,
      items: {
        type: "string",
        pattern: ID_PATTERN
      }
    }
  },
  required: [
    "subject",
    "category",
    "description"
  ]
};

const replySchema = {
  $schema: DIALECT,
  type: "object",
  additionalProperties: false,
  properties: {
    message: {
      type: "string",
      minLength: 1,
      maxLength: 10000
    },
    attachmentIds: {
      type: "array",
      uniqueItems: true,
      maxItems: 10,
      items: {
        type: "string",
        pattern: ID_PATTERN
      }
    }
  },
  required: ["message"]
};

const internalNoteSchema = {
  $schema: DIALECT,
  type: "object",
  additionalProperties: false,
  properties: {
    message: {
      type: "string",
      minLength: 1,
      maxLength: 5000
    }
  },
  required: ["message"]
};

const statusUpdateSchema = {
  $schema: DIALECT,
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: TICKET_STATUSES
    },
    reason: {
      type: "string",
      maxLength: 2000
    }
  },
  required: ["status"]
};

const assignmentSchema = {
  $schema: DIALECT,
  type: "object",
  additionalProperties: false,
  properties: {
    assigneeId: {
      type: "string",
      pattern: ID_PATTERN
    }
  },
  required: ["assigneeId"]
};

const prioritySchema = {
  $schema: DIALECT,
  type: "object",
  additionalProperties: false,
  properties: {
    priority: {
      type: "string",
      enum: TICKET_PRIORITIES
    },
    reason: {
      type: "string",
      maxLength: 2000
    }
  },
  required: ["priority"]
};

/* -------------------------------------------------------------------------- */
/* GET /api/support                                                           */
/* List tickets visible to the authenticated user.                           */
/* -------------------------------------------------------------------------- */

router.get(
  "/",
  authenticate,
  authorize("support:read"),
  validateQuery(listTicketsSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("listTickets")({
      user: req.user,
      filters: {
        page: Number(req.query.page || 1),
        limit: Math.min(Number(req.query.limit || 20), 100),
        category: req.query.category,
        status: req.query.status,
        search: req.query.search,
        sortOrder: req.query.sortOrder || "desc"
      }
    });

    return success(
      res,
      result,
      "Support tickets retrieved successfully."
    );
  })
);

/* -------------------------------------------------------------------------- */
/* POST /api/support                                                          */
/* Create a support ticket for the authenticated user.                       */
/* -------------------------------------------------------------------------- */

router.post(
  "/",
  authenticate,
  authorize("support:create"),
  validateBody(createTicketSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("createTicket")({
      user: req.user,
      payload: req.body
    });

    res.set("Cache-Control", "no-store");

    return success(
      res,
      result,
      "Support ticket created successfully.",
      201
    );
  })
);

/* -------------------------------------------------------------------------- */
/* GET /api/support/mine                                                      */
/* List the current user's own tickets.                                      */
/* -------------------------------------------------------------------------- */

router.get(
  "/mine",
  authenticate,
  authorize("support:read-own"),
  validateQuery(listTicketsSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("listMyTickets")({
      user: req.user,
      filters: {
        page: Number(req.query.page || 1),
        limit: Math.min(Number(req.query.limit || 20), 100),
        category: req.query.category,
        status: req.query.status,
        search: req.query.search,
        sortOrder: req.query.sortOrder || "desc"
      }
    });

    return success(
      res,
      result,
      "Your support tickets retrieved successfully."
    );
  })
);

/* -------------------------------------------------------------------------- */
/* GET /api/support/:ticketId                                                 */
/* Retrieve an authorized ticket and its public conversation.                */
/* -------------------------------------------------------------------------- */

router.get(
  "/:ticketId",
  authenticate,
  authorize("support:read"),
  validateParams(ticketIdSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("getTicketById")({
      user: req.user,
      ticketId: req.params.ticketId
    });

    if (!result) {
      return ticketNotFound(res);
    }

    res.set("Cache-Control", "no-store");

    return success(
      res,
      result,
      "Support ticket retrieved successfully."
    );
  })
);

/* -------------------------------------------------------------------------- */
/* POST /api/support/:ticketId/replies                                        */
/* Add a public reply to a ticket.                                            */
/* -------------------------------------------------------------------------- */

router.post(
  "/:ticketId/replies",
  authenticate,
  authorize("support:reply"),
  validateParams(ticketIdSchema),
  validateBody(replySchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("addReply")({
      user: req.user,
      ticketId: req.params.ticketId,
      payload: req.body
    });

    if (!result) {
      return ticketNotFound(res);
    }

    return success(
      res,
      result,
      "Reply added successfully.",
      201
    );
  })
);

/* -------------------------------------------------------------------------- */
/* POST /api/support/:ticketId/close                                          */
/* Allow the authorized ticket owner to request closure.                      */
/* -------------------------------------------------------------------------- */

router.post(
  "/:ticketId/close",
  authenticate,
  authorize("support:close-own"),
  validateParams(ticketIdSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("closeTicket")({
      user: req.user,
      ticketId: req.params.ticketId
    });

    if (!result) {
      return ticketNotFound(res);
    }

    return success(
      res,
      result,
      "Support ticket closure processed successfully."
    );
  })
);

/* -------------------------------------------------------------------------- */
/* POST /api/support/:ticketId/reopen                                         */
/* Reopen an eligible ticket subject to workflow rules.                      */
/* -------------------------------------------------------------------------- */

router.post(
  "/:ticketId/reopen",
  authenticate,
  authorize("support:reopen"),
  validateParams(ticketIdSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("reopenTicket")({
      user: req.user,
      ticketId: req.params.ticketId
    });

    if (!result) {
      return ticketNotFound(res);
    }

    return success(
      res,
      result,
      "Support ticket reopening processed successfully."
    );
  })
);

/* -------------------------------------------------------------------------- */
/* POST /api/support/:ticketId/notes                                          */
/* Create a private internal note.                                            */
/* -------------------------------------------------------------------------- */

router.post(
  "/:ticketId/notes",
  authenticate,
  authorize("support:notes:create"),
  validateParams(ticketIdSchema),
  validateBody(internalNoteSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("addInternalNote")({
      user: req.user,
      ticketId: req.params.ticketId,
      message: req.body.message
    });

    if (!result) {
      return ticketNotFound(res);
    }

    return success(
      res,
      result,
      "Internal note added successfully.",
      201
    );
  })
);

/* -------------------------------------------------------------------------- */
/* PATCH /api/support/:ticketId/status                                        */
/* Support-agent status management.                                           */
/* -------------------------------------------------------------------------- */

router.patch(
  "/:ticketId/status",
  authenticate,
  authorize("support:manage"),
  validateParams(ticketIdSchema),
  validateBody(statusUpdateSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("updateTicketStatus")({
      user: req.user,
      ticketId: req.params.ticketId,
      status: req.body.status,
      reason: req.body.reason
    });

    if (!result) {
      return ticketNotFound(res);
    }

    return success(
      res,
      result,
      "Support ticket status updated successfully."
    );
  })
);

/* -------------------------------------------------------------------------- */
/* PATCH /api/support/:ticketId/assignment                                    */
/* Assign a ticket to an authorized support agent.                            */
/* -------------------------------------------------------------------------- */

router.patch(
  "/:ticketId/assignment",
  authenticate,
  authorize("support:assign"),
  validateParams(ticketIdSchema),
  validateBody(assignmentSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("assignTicket")({
      user: req.user,
      ticketId: req.params.ticketId,
      assigneeId: req.body.assigneeId
    });

    if (!result) {
      return ticketNotFound(res);
    }

    return success(
      res,
      result,
      "Support ticket assignment updated successfully."
    );
  })
);

/* -------------------------------------------------------------------------- */
/* PATCH /api/support/:ticketId/priority                                      */
/* Change ticket priority through an authorized workflow.                     */
/* -------------------------------------------------------------------------- */

router.patch(
  "/:ticketId/priority",
  authenticate,
  authorize("support:manage"),
  validateParams(ticketIdSchema),
  validateBody(prioritySchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("updateTicketPriority")({
      user: req.user,
      ticketId: req.params.ticketId,
      priority: req.body.priority,
      reason: req.body.reason
    });

    if (!result) {
      return ticketNotFound(res);
    }

    return success(
      res,
      result,
      "Support ticket priority updated successfully."
    );
  })
);

module.exports = router;
