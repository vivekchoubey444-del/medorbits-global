"use strict";

/**

* MedOrbits -- User API Routes
* File: /api/routes/users.js
* Runtime: Node.js 20+
* Framework: Express
* Mount:
* app.use("/api/users", require("./api/routes/users"));
* Dependencies:
* ../services/user-service
* ../middlerware/authorization
* ../middlerware/validation
* Security:
* ●	Never trust client-supplied roles, permissions, ownership, or status.
* ●	Never expose passwords, hashes, tokens, or internal security fields.
* ●	Administrative operations require explicit permissions.
* ●	Account deletion must follow the service’s retention policy.
* ●	The service must enforce database-level authorization and auditing.
        */

const express = require("express");

const userService = require("../services/user-service");

const {
authenticate,
authorize
} = require("../middlerware/authorization");

const {
validateBody,
validateParams,
validateQuery
} = require("../middlerware/validation");

const router = express.Router();

const DIALECT = "https://json-schema.org/draft/2020-12/schema";

const USER_ID_PATTERN = "^[A-Za-z0-9_-]{1,128}$";

const USER_ROLES = [
"student",
"applicant",
"counsellor",
"recruiter",
"employer",
"support",
"admin"
];

const USER_STATUSES = [
"active",
"inactive",
"suspended",
"pending_verification"
];

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_PAGE = 100000;
const MAX_LIMIT = 100;

/* ––––––––––––––––––––––––––––––––––––– /
/ Response helpers                                                           /
/ ––––––––––––––––––––––––––––––––––––– */

function sendSuccess(res, data, message, statusCode = 200) {
res.set("Cache-Control", "no-store");

return res.status(statusCode).json({
success: true,
message,
data
});
}

function sendFailure(res, statusCode, code, message) {
res.set("Cache-Control", "no-store");

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

/* ––––––––––––––––––––––––––––––––––––– /
/ Service helpers                                                            /
/ ––––––––––––––––––––––––––––––––––––– */

function requireServiceMethod(methodName) {
if (
!userService ||
typeof userService[methodName] !== "function"
) {
throw httpError(
500,
"USER_SERVICE_MISCONFIGURED",
"A required user service operation is unavailable."
);
}

return userService[methodName].bind(userService);
}

async function callUserService(methodName, …args) {
return requireServiceMethod(methodName)(…args);
}

function getAuthenticatedUserId(req) {
const user = req.user;

const id = user && (user.id || user.userId || user.sub);

if (
typeof id !== "string" ||
id.length === 0 ||
id.length > 128
) {
throw httpError(
401,
"AUTHENTICATION_REQUIRED",
"A valid authenticated user is required."
);
}

return id;
}

function requireResult(result, entityName = "User") {
if (result === null || result === undefined) {
throw httpError(
404,
${entityName.toUpperCase()}_NOT_FOUND,
${entityName} not found.
);
}

return result;
}

/**

* Convert validated URL query parameters to bounded integers.
    */
    function parseInteger(value, fallback, maximum) {
    if (value === undefined) {
    return fallback;
    }

const normalized = String(value);

if (!/^[1-9]\d*$/.test(normalized)) {
throw httpError(
400,
"INVALID_QUERY_PARAMETER",
"A query parameter has an invalid value."
);
}

const number = Number(normalized);

if (!Number.isSafeInteger(number)) {
throw httpError(
400,
"INVALID_QUERY_PARAMETER",
"A query parameter has an invalid value."
);
}

return Math.min(number, maximum);
}

function getPagination(query) {
return {
page: parseInteger(query.page, DEFAULT_PAGE, MAX_PAGE),
limit: parseInteger(query.limit, DEFAULT_LIMIT, MAX_LIMIT)
};
}

/* ––––––––––––––––––––––––––––––––––––– /
/ JSON Schema definitions                                                    /
/ ––––––––––––––––––––––––––––––––––––– */

const userIdParamsSchema = {
$schema: DIALECT,
type: "object",
properties: {
userId: {
type: "string",
pattern: USER_ID_PATTERN,
maxLength: 128
}
},
required: ["userId"],
additionalProperties: false
};

/**

* Query values are strings because HTTP URL query parameters are strings.
* The validation middleware should support JSON Schema Draft 2020-12.
    */
    const listUsersQuerySchema = {
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
    search: {
    type: "string",
    minLength: 1,
    maxLength: 120
    },
    role: {
    type: "string",
    enum: USER_ROLES
    },
    status: {
    type: "string",
    enum: USER_STATUSES
    },
    sortBy: {
    type: "string",
    enum: ["createdAt", "updatedAt", "name", "email"]
    },
    sortOrder: {
    type: "string",
    enum: ["asc", "desc"]
    }
    },
    additionalProperties: false
    };

const profileAddressSchema = {
type: "object",
properties: {
line1: {
type: "string",
maxLength: 200
},
line2: {
type: "string",
maxLength: 200
},
city: {
type: "string",
maxLength: 100
},
state: {
type: "string",
maxLength: 100
},
postalCode: {
type: "string",
maxLength: 20
},
country: {
type: "string",
maxLength: 100
}
},
additionalProperties: false
};

const updateOwnProfileSchema = {
$schema: DIALECT,
type: "object",
minProperties: 1,
properties: {
firstName: {
type: "string",
minLength: 1,
maxLength: 80,
pattern: ".\S."
},
lastName: {
type: "string",
minLength: 1,
maxLength: 80,
pattern: ".\S."
},
phone: {
type: "string",
minLength: 7,
maxLength: 25,
pattern: "^[+0-9() .-]+$"
},
dateOfBirth: {
type: "string",
format: "date"
},
profileImageUrl: {
type: "string",
format: "uri",
maxLength: 2048
},
preferredLanguage: {
type: "string",
minLength: 2,
maxLength: 12,
pattern: "^[A-Za-z-]+$"
},
timezone: {
type: "string",
minLength: 1,
maxLength: 100
},
address: profileAddressSchema
},
additionalProperties: false
};

const adminUpdateUserSchema = {
$schema: DIALECT,
type: "object",
minProperties: 1,
properties: {
firstName: {
type: "string",
minLength: 1,
maxLength: 80,
pattern: ".\S."
},
lastName: {
type: "string",
minLength: 1,
maxLength: 80,
pattern: ".\S."
},
phone: {
type: "string",
minLength: 7,
maxLength: 25,
pattern: "^[+0-9() .-]+$"
},
role: {
type: "string",
enum: USER_ROLES
},
status: {
type: "string",
enum: USER_STATUSES
}
},
additionalProperties: false
};

const deactivateAccountSchema = {
$schema: DIALECT,
type: "object",
required: ["confirmation"],
properties: {
confirmation: {
type: "string",
const: "DEACTIVATE"
},
reason: {
type: "string",
maxLength: 500
}
},
additionalProperties: false
};

const updateStatusSchema = {
$schema: DIALECT,
type: "object",
required: ["status"],
properties: {
status: {
type: "string",
enum: USER_STATUSES
},
reason: {
type: "string",
maxLength: 500
}
},
additionalProperties: false
};

/* ––––––––––––––––––––––––––––––––––––– /
/ Authenticated user routes                                                  /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* GET /api/users/me
    */
    router.get(
    "/me",
    authenticate,
    asyncHandler(async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const user = requireResult(
    await callUserService("getUserById", userId)
    );
    return sendSuccess(
    res,
    { user },
    "Profile retrieved successfully."
    );
    })
    );

/**

* PATCH /api/users/me
    */
    router.patch(
    "/me",
    authenticate,
    validateBody(updateOwnProfileSchema),
    asyncHandler(async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const user = requireResult(
    await callUserService(
    "updateUserProfile",
    userId,
    req.body
    )
    );
    return sendSuccess(
    res,
    { user },
    "Profile updated successfully."
    );
    })
    );

/**

* POST /api/users/me/deactivate
* The service should invalidate sessions and refresh tokens where
* applicable, apply retention policy, and record the account event.
    */
    router.post(
    "/me/deactivate",
    authenticate,
    validateBody(deactivateAccountSchema),
    asyncHandler(async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const result = requireResult(
    await callUserService(
    "deactivateOwnAccount",
    userId,
    {
    reason: req.body.reason || null
    }
    )
    );
    return sendSuccess(
    res,
    result,
    "Account deactivation processed successfully."
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Administrator routes                                                       /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* GET /api/users
    */
    router.get(
    "/",
    authenticate,
    authorize("users:read"),
    validateQuery(listUsersQuerySchema),
    asyncHandler(async (req, res) => {
    const pagination = getPagination(req.query);
    const result = await callUserService("listUsers", {
    …pagination,
    search: req.query.search,
    role: req.query.role,
    status: req.query.status,
    sortBy: req.query.sortBy || "createdAt",
    sortOrder: req.query.sortOrder || "desc"
    });
    return sendSuccess(
    res,
    result,
    "Users retrieved successfully."
    );
    })
    );

/**

* GET /api/users/:userId
    */
    router.get(
    "/:userId",
    authenticate,
    authorize("users:read"),
    validateParams(userIdParamsSchema),
    asyncHandler(async (req, res) => {
    const user = requireResult(
    await callUserService("getUserById", req.params.userId)
    );
    return sendSuccess(
    res,
    { user },
    "User retrieved successfully."
    );
    })
    );

/**

* PATCH /api/users/:userId
* Administrative changes must be audited by the service.
    */
    router.patch(
    "/:userId",
    authenticate,
    authorize("users:update"),
    validateParams(userIdParamsSchema),
    validateBody(adminUpdateUserSchema),
    asyncHandler(async (req, res) => {
    const actorId = getAuthenticatedUserId(req);
    const user = requireResult(
    await callUserService(
    "adminUpdateUser",
    req.params.userId,
    req.body,
    { actorId }
    )
    );
    return sendSuccess(
    res,
    { user },
    "User updated successfully."
    );
    })
    );

/**

* PATCH /api/users/:userId/status
    */
    router.patch(
    "/:userId/status",
    authenticate,
    authorize("users:manage-status"),
    validateParams(userIdParamsSchema),
    validateBody(updateStatusSchema),
    asyncHandler(async (req, res) => {
    const actorId = getAuthenticatedUserId(req);
    const user = requireResult(
    await callUserService(
    "updateUserStatus",
    req.params.userId,
    {
    status: req.body.status,
    reason: req.body.reason || null
    },
    { actorId }
    )
    );
    return sendSuccess(
    res,
    { user },
    "User status updated successfully."
    );
    })
    );

/**

* DELETE /api/users/:userId
* Prefer a service-level soft-delete or deactivation policy to preserve
* referential integrity, audit records, and application history.
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
    "Use the account deactivation endpoint for your own account."
    );
    }
    const result = requireResult(
    await callUserService(
    "deleteUser",
    targetUserId,
    { actorId }
    )
    );
    return sendSuccess(
    res,
    result,
    "User deletion request processed successfully."
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Export                                                                     /
/ ––––––––––––––––––––––––––––––––––––– */

module.exports = router;