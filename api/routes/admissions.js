"use strict";

/**

* MedOrbits -- Admissions API Routes
* File: /api/routes/admissions.js
* Runtime: Node.js 20+
* Framework: Express
* Mount:
* app.use("/api/admissions", require("./api/routes/admissions"));
* Dependencies:
* ../services/admissions-service
* ../middlerware/authorization
* ../middlerware/validation
* Security:
* ●	Applicant ownership is derived from req.user by the service.
* ●	Client input cannot set applicantId, reviewerId, status, or audit fields.
* ●	Review actions require explicit admissions:review permission.
* ●	The service enforces workflow transitions, deadlines, and eligibility.
* ●	Document IDs must be authorized references, not trusted file paths.
* ●	Unexpected errors are forwarded to centralized error middleware.
        */

const express = require("express");

const router = express.Router();

const admissionsService = require("../services/admissions-service");

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

const ADMISSION_STATUSES = [
"draft",
"submitted",
"under-review",
"documents-required",
"approved",
"rejected",
"waitlisted",
"withdrawn",
"closed"
];

const REVIEW_DECISIONS = [
"approved",
"rejected",
"documents-required",
"waitlisted"
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

function successResponse(
res,
data,
message,
statusCode = 200
) {
setResponseHeaders(res);

return res.status(statusCode).json({
success: true,
message,
data
});
}

function failureResponse(res, statusCode, code, message) {
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

/* ––––––––––––––––––––––––––––––––––––– /
/ Service helpers                                                            /
/ ––––––––––––––––––––––––––––––––––––– */

function requireServiceMethod(methodName) {
if (
!admissionsService ||
typeof admissionsService[methodName] !== "function"
) {
throw httpError(
500,
"ADMISSIONS_SERVICE_MISCONFIGURED",
"A required admissions service operation is unavailable."
);
}

return admissionsService[methodName].bind(admissionsService);
}

async function callAdmissionsService(methodName, ...args) {
return requireServiceMethod(methodName)(...args);
}

function requireResult(result, res) {
if (result === null || result === undefined) {
failureResponse(
res,
404,
"ADMISSION_NOT_FOUND",
"The requested admission was not found."
);

return false;

}

return true;
}

/**

* URL query values are strings.
* Keep pagination bounded even if validation middleware is misconfigured.
    */
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

function getListFilters(query) {
return {
...getPagination(query),
status: query.status,
course: query.course,
academicYear: query.academicYear,
search: query.search,
sortBy: query.sortBy || "createdAt",
sortOrder: query.sortOrder || "desc"
};
}

/* ––––––––––––––––––––––––––––––––––––– /
/ Validation schemas                                                         /
/ ––––––––––––––––––––––––––––––––––––– */

const admissionIdSchema = {
$schema: DIALECT,
type: "object",
properties: {
admissionId: {
type: "string",
pattern: ID_PATTERN
}
},
required: ["admissionId"],
additionalProperties: false
};

const paginationSchema = {
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
status: {
type: "string",
enum: ADMISSION_STATUSES
},
course: {
type: "string",
minLength: 1,
maxLength: 150
},
academicYear: {
type: "string",
pattern: "^[0-9]{4}(?:-[0-9]{4})?$"
},
search: {
type: "string",
minLength: 1,
maxLength: 150
},
sortBy: {
type: "string",
enum: [
"createdAt",
"updatedAt",
"applicationNumber",
"status"
]
},
sortOrder: {
type: "string",
enum: ["asc", "desc"]
}
},
additionalProperties: false
};

const applicantDetailsSchema = {
type: "object",
properties: {
firstName: {
type: "string",
minLength: 1,
maxLength: 100,
pattern: ".\S."
},
lastName: {
type: "string",
minLength: 1,
maxLength: 100,
pattern: ".\S."
},
email: {
type: "string",
format: "email",
maxLength: 254
},
phone: {
type: "string",
pattern: "^\+[1-9][0-9]{7,14}$"
}
},
required: [
"firstName",
"lastName",
"email",
"phone"
],
additionalProperties: false
};

const preferencesSchema = {
type: "object",
properties: {
preferredLocation: {
type: "string",
maxLength: 150
},
preferredCourse: {
type: "string",
maxLength: 150
},
notes: {
type: "string",
maxLength: 3000
}
},
additionalProperties: false
};

const documentsSchema = {
type: "array",
maxItems: 50,
items: {
type: "object",
properties: {
documentId: {
type: "string",
pattern: ID_PATTERN
},
documentType: {
type: "string",
minLength: 1,
maxLength: 100
}
},
required: [
"documentId",
"documentType"
],
additionalProperties: false
}
};

const createAdmissionSchema = {
$schema: DIALECT,
type: "object",
properties: {
courseId: {
type: "string",
pattern: ID_PATTERN
},
institutionId: {
type: "string",
pattern: ID_PATTERN
},
academicYear: {
type: "string",
pattern: "^[0-9]{4}-[0-9]{4}$"
},
applicantDetails: applicantDetailsSchema,
preferences: preferencesSchema,
documents: documentsSchema
},
required: [
"courseId",
"institutionId",
"academicYear",
"applicantDetails"
],
additionalProperties: false
};

const updateAdmissionSchema = {
$schema: DIALECT,
type: "object",
minProperties: 1,
properties: {
applicantDetails: {
...applicantDetailsSchema,
required: undefined,
minProperties: 1
},
preferences: {
...preferencesSchema,
minProperties: 1
},
documents: documentsSchema
},
additionalProperties: false
};

const reviewAdmissionSchema = {
$schema: DIALECT,
type: "object",
properties: {
decision: {
type: "string",
enum: REVIEW_DECISIONS
},
note: {
type: "string",
maxLength: 3000
}
},
required: ["decision"],
additionalProperties: false
};

const withdrawAdmissionSchema = {
$schema: DIALECT,
type: "object",
properties: {
reason: {
type: "string",
maxLength: 2000
}
},
additionalProperties: false
};

/* ––––––––––––––––––––––––––––––––––––– /
/ Applicant routes                                                           /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* GET /api/admissions
* The service must return only records the caller is permitted to view.
* Administrative visibility must be enforced by server-side permissions.
    */
    router.get(
    "/",
    authenticate,
    authorize("admissions:read"),
    validateQuery(paginationSchema),
    asyncHandler(async (req, res) => {
    const result = await callAdmissionsService(
    "listAdmissions",
    {
    user: req.user,
    query: getListFilters(req.query)
    }
    );
    return successResponse(
    res,
    result,
    "Admissions retrieved successfully."
    );
    })
    );

/**

* POST /api/admissions
* The service derives applicant ownership from req.user.
* Client-supplied ownership and status fields are rejected by schema.
    */
    router.post(
    "/",
    authenticate,
    authorize("admissions:create"),
    validateBody(createAdmissionSchema),
    asyncHandler(async (req, res) => {
    const result = await callAdmissionsService(
    "createAdmission",
    {
    user: req.user,
    payload: req.body
    }
    );
    return successResponse(
    res,
    result,
    "Admission application created successfully.",
    201
    );
    })
    );

/**

* GET /api/admissions/:admissionId/status
* Registered before the generic ID route for explicit route ordering.
* Return only applicant-visible status information.
    */
    router.get(
    "/:admissionId/status",
    authenticate,
    authorize("admissions:read"),
    validateParams(admissionIdSchema),
    asyncHandler(async (req, res) => {
    const result = await callAdmissionsService(
    "getAdmissionStatus",
    {
    user: req.user,
    admissionId: req.params.admissionId
    }
    );
    if (!requireResult(result, res)) {
    return;
    }
    return successResponse(
    res,
    result,
    "Admission status retrieved successfully."
    );
    })
    );

/**

* POST /api/admissions/:admissionId/submit
    */
    router.post(
    "/:admissionId/submit",
    authenticate,
    authorize("admissions:submit"),
    validateParams(admissionIdSchema),
    asyncHandler(async (req, res) => {
    const result = await callAdmissionsService(
    "submitAdmission",
    {
    user: req.user,
    admissionId: req.params.admissionId
    }
    );
    if (!requireResult(result, res)) {
    return;
    }
    return successResponse(
    res,
    result,
    "Admission submission processed successfully."
    );
    })
    );

/**

* POST /api/admissions/:admissionId/withdraw
    */
    router.post(
    "/:admissionId/withdraw",
    authenticate,
    authorize("admissions:withdraw"),
    validateParams(admissionIdSchema),
    validateBody(withdrawAdmissionSchema),
    asyncHandler(async (req, res) => {
    const result = await callAdmissionsService(
    "withdrawAdmission",
    {
    user: req.user,
    admissionId: req.params.admissionId,
    reason: req.body.reason
    }
    );
    if (!requireResult(result, res)) {
    return;
    }
    return successResponse(
    res,
    result,
    "Admission withdrawal processed successfully."
    );
    })
    );

/**

* PATCH /api/admissions/:admissionId
* Applicants may update only fields allowed by the workflow.
* The service must enforce ownership and editability of the application.
    */
    router.patch(
    "/:admissionId",
    authenticate,
    authorize("admissions:update"),
    validateParams(admissionIdSchema),
    validateBody(updateAdmissionSchema),
    asyncHandler(async (req, res) => {
    const result = await callAdmissionsService(
    "updateAdmission",
    {
    user: req.user,
    admissionId: req.params.admissionId,
    payload: req.body
    }
    );
    if (!requireResult(result, res)) {
    return;
    }
    return successResponse(
    res,
    result,
    "Admission updated successfully."
    );
    })
    );

/**

* GET /api/admissions/:admissionId
    */
    router.get(
    "/:admissionId",
    authenticate,
    authorize("admissions:read"),
    validateParams(admissionIdSchema),
    asyncHandler(async (req, res) => {
    const result = await callAdmissionsService(
    "getAdmissionById",
    {
    user: req.user,
    admissionId: req.params.admissionId
    }
    );
    if (!requireResult(result, res)) {
    return;
    }
    return successResponse(
    res,
    result,
    "Admission retrieved successfully."
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Reviewer routes                                                            /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* POST /api/admissions/:admissionId/review
* Review permission must be granted only to authorized reviewers.
* The service must validate state transitions and write an audit record.
    */
    router.post(
    "/:admissionId/review",
    authenticate,
    authorize("admissions:review"),
    validateParams(admissionIdSchema),
    validateBody(reviewAdmissionSchema),
    asyncHandler(async (req, res) => {
    const result = await callAdmissionsService(
    "reviewAdmission",
    {
    user: req.user,
    admissionId: req.params.admissionId,
    decision: req.body.decision,
    note: req.body.note
    }
    );
    if (!requireResult(result, res)) {
    return;
    }
    return successResponse(
    res,
    result,
    "Admission review processed successfully."
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Export                                                                     /
/ ––––––––––––––––––––––––––––––––––––– */

module.exports = router;