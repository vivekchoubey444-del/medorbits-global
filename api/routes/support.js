"use strict";

/**

* MedOrbits -- Support API Routes
* File: /api/routes/support.js
* Runtime: Node.js 20+
* Framework: Express
* Mount:
* app.use("/api/support", require("./api/routes/support"));
* Dependencies:
* ../services/support-service
* ../middlerware/authorization
* ../middlerware/validation
* Security requirements:
* ●	Service methods enforce ticket ownership and agent permissions.
* ●	Public users cannot assign internal status or priority.
* ●	Internal notes must never appear in public ticket responses.
* ●	Attachment IDs must be authorized and verified by the service.
* ●	Unexpected errors are forwarded to centralized error middleware.
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

/* ––––––––––––––––––––––––––––––––––––– /
/ Configuration                                                              /
/ ––––––––––––––––––––––––––––––––––––– */

const DIALECT = "https://json-schema.org/draft/2020-12/schema";
const ID_PATTERN = "^[A-Za-z0-9_-]{1,100}$";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_PAGE = 100000;
const MAX_LIMIT = 100;

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

/* ––––––––––––––––––––––––––––––––––––– /
/ Response helpers                                                           /
/ ––––––––––––––––––––––––––––––––––––– */

function setResponseHeaders(res) {
res.set({
"Cache-Control": "no-store, no-cache, must-revalidate, private",
Pragma: "no-cache",
Expires: "0",
"X-Content-Type-Options": "nosniff"
});
}

function success(res, data, message, statusCode = 200) {
setResponseHeaders(res);

return res.status(statusCode).json({
success: true,
message,
data
});
}

function failure(res, statusCode, code, message) {
setResponseHeaders(res);

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
Promise.resolve()
.then(() => handler(req, res, next))
.catch(next);
};
}

function httpError(status, code, message) {
const error = new Error(message);
error.status = status;
error.statusCode = status;
error.code = code;
error.expose = status < 500;
return error;
}

function serviceMethod(name) {
if (
!supportService ||
typeof supportService[name] !== "function"
) {
throw httpError(
500,
"SUPPORT_SERVICE_MISCONFIGURED",
"A required support service operation is unavailable."
);
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

function requireResult(result, res) {
if (result === null || result === undefined) {
ticketNotFound(res);
return false;
}

return true;
}

/* ––––––––––––––––––––––––––––––––––––– /
/ Pagination                                                                 /
/ ––––––––––––––––––––––––––––––––––––– */

function parsePositiveInteger(value, fallback, maximum) {
if (value === undefined) {
return fallback;
}

const normalized = String(value);

if (!/^[1-9]\d*$/.test(normalized)) {
throw httpError(
400,
"INVALID_PAGINATION",
"Pagination parameters must be positive integers."
);
}

const parsed = Number(normalized);

if (!Number.isSafeInteger(parsed)) {
throw httpError(
400,
"INVALID_PAGINATION",
"Pagination parameters are outside the supported range."
);
}

return Math.min(parsed, maximum);
}

function getPagination(query) {
return {
page: parsePositiveInteger(
query.page,
DEFAULT_PAGE,
MAX_PAGE
),
limit: parsePositiveInteger(
query.limit,
DEFAULT_LIMIT,
MAX_LIMIT
)
};
}

function getTicketFilters(query) {
return {
…getPagination(query),
category: query.category,
status: query.status,
search: query.search,
sortOrder: query.sortOrder || "desc"
};
}

/* ––––––––––––––––––––––––––––––––––––– /
/ Validation schemas                                                        /
/ ––––––––––––––––––––––––––––––––––––– */

const ticketIdSchema = {
$schema: DIALECT,
type: "object",
properties: {
ticketId: {
type: "string",
pattern: ID_PATTERN
}
},
required: ["ticketId"],
additionalProperties: false
};

const listTicketsSchema = {
$schema: DIALECT,
type: "object",
properties: {
page: {
type: "string",
pattern: "^[1-9]{0,5}$"
},
limit: {
type: "string",
pattern: "^[1-9]{0,2}$"
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
},
additionalProperties: false
};

const createTicketSchema = {
$schema: DIALECT,
type: "object",
properties: {
subject: {
type: "string",
minLength: 5,
maxLength: 200,
pattern: ".\S."
},
category: {
type: "string",
enum: TICKET_CATEGORIES
},
description: {
type: "string",
minLength: 10,
maxLength: 10000,
pattern: ".\S."
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
],
additionalProperties: false
};

const replySchema = {
$schema: DIALECT,
type: "object",
properties: {
message: {
type: "string",
minLength: 1,
maxLength: 10000,
pattern: ".\S."
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
required: ["message"],
additionalProperties: false
};

const internalNoteSchema = {
$schema: DIALECT,
type: "object",
properties: {
message: {
type: "string",
minLength: 1,
maxLength: 5000,
pattern: ".\S."
}
},
required: ["message"],
additionalProperties: false
};

const statusUpdateSchema = {
$schema: DIALECT,
type: "object",
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
required: ["status"],
additionalProperties: false
};

const assignmentSchema = {
$schema: DIALECT,
type: "object",
properties: {
assigneeId: {
type: "string",
pattern: ID_PATTERN
}
},
required: ["assigneeId"],
additionalProperties: false
};

const prioritySchema = {
$schema: DIALECT,
type: "object",
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
required: ["priority"],
additionalProperties: false
};

/* ––––––––––––––––––––––––––––––––––––– /
/ Public authenticated ticket routes                                         /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* GET /api/support/mine
* Register before /:ticketId to avoid treating "mine" as an ID.
* The service must scope the result to the authenticated user.
    */
    router.get(
    "/mine",
    authenticate,
    authorize("support:read-own"),
    validateQuery(listTicketsSchema),
    asyncHandler(async (req, res) => {
    const result = await serviceMethod("listMyTickets")({
    user: req.user,
    filters: getTicketFilters(req.query)
    });
    return success(
    res,
    result,
    "Your support tickets retrieved successfully."
    );
    })
    );

/**

* GET /api/support
* The service decides which tickets the authenticated caller may see.
    */
    router.get(
    "/",
    authenticate,
    authorize("support:read"),
    validateQuery(listTicketsSchema),
    asyncHandler(async (req, res) => {
    const result = await serviceMethod("listTickets")({
    user: req.user,
    filters: getTicketFilters(req.query)
    });
    return success(
    res,
    result,
    "Support tickets retrieved successfully."
    );
    })
    );

/**

* POST /api/support
    */
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
    return success(
    res,
    result,
    "Support ticket created successfully.",
    201
    );
    })
    );

/**

* GET /api/support/:ticketId
* Return only the public ticket representation and public replies.
* The service must not include private internal notes.
    */
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
    if (!requireResult(result, res)) {
    return;
    }
    return success(
    res,
    result,
    "Support ticket retrieved successfully."
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Ticket replies                                                             /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* POST /api/support/:ticketId/replies
    */
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
    if (!requireResult(result, res)) {
    return;
    }
    return success(
    res,
    result,
    "Reply added successfully.",
    201
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Ticket owner actions                                                       /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* POST /api/support/:ticketId/close
    */
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
    if (!requireResult(result, res)) {
    return;
    }
    return success(
    res,
    result,
    "Support ticket closure processed successfully."
    );
    })
    );

/**

* POST /api/support/:ticketId/reopen
    */
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
    if (!requireResult(result, res)) {
    return;
    }
    return success(
    res,
    result,
    "Support ticket reopening processed successfully."
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Support-agent operations                                                   /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* POST /api/support/:ticketId/notes
* Internal notes are privileged content. The service must verify agent
* access and ensure notes are excluded from all public ticket responses.
    */
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
    if (!requireResult(result, res)) {
    return;
    }
    return success(
    res,
    result,
    "Internal note added successfully.",
    201
    );
    })
    );

/**

* PATCH /api/support/:ticketId/status
    */
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
    if (!requireResult(result, res)) {
    return;
    }
    return success(
    res,
    result,
    "Support ticket status updated successfully."
    );
    })
    );

/**

* PATCH /api/support/:ticketId/assignment
    */
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
    if (!requireResult(result, res)) {
    return;
    }
    return success(
    res,
    result,
    "Support ticket assignment updated successfully."
    );
    })
    );

/**

* PATCH /api/support/:ticketId/priority
    */
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
    if (!requireResult(result, res)) {
    return;
    }
    return success(
    res,
    result,
    "Support ticket priority updated successfully."
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Export                                                                     /
/ ––––––––––––––––––––––––––––––––––––– */

module.exports = router;