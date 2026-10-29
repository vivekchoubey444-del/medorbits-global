"use strict";

/**

* MedOrbits -- Documents API Routes
* File: app.use("/api/documents", require("./api/routes/documents"));
* Runtime: Node.js 20+
* Framework: Express
* Mount:
* app.use("/api/documents", require("./api/routes/documents"));
* Dependencies:
* ../middleware/authorization
* ../middleware/validation
* ../services/documents-service
* Security:
* ●	Ownership and resource authorization are enforced by the service.
* ●	Storage keys, file URLs, owner IDs, and review decisions are server-managed.
* ●	Upload tokens are opaque, short-lived, single-use credentials.
* ●	Download URLs are short-lived and generated only after authorization.
* ●	File content is never served directly by this router.
* ●	The storage layer must verify file size, actual file type, and file content.
        */

const express = require("express");

const router = express.Router();

const documentsService = require("../services/documents-service");

const {
authenticate,
authorize
} = require("../middleware/authorization");

const {
validateBody,
validateParams,
validateQuery
} = require("../middleware/validation");

/* ––––––––––––––––––––––––––––––––––––– /
/ Configuration                                                              /
/ ––––––––––––––––––––––––––––––––––––– */

const DIALECT = "https://json-schema.org/draft/2020-12/schema";
const DOCUMENT_ID_PATTERN = "^[A-Za-z0-9_-]{1,100}$";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_PAGE = 100000;
const MAX_LIMIT = 100;

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_FILENAME_LENGTH = 255;

const DOCUMENT_CATEGORIES = [
"identity",
"education",
"admission",
"employment",
"professional",
"financial",
"other"
];

const DOCUMENT_STATUSES = [
"pending-upload",
"uploaded",
"pending-review",
"verified",
"rejected",
"expired",
"deleted"
];

/* ––––––––––––––––––––––––––––––––––––– /
/ Response helpers                                                           /
/ ––––––––––––––––––––––––––––––––––––– */

function setPrivateHeaders(res) {
res.set({
"Cache-Control": "no-store, no-cache, must-revalidate, private",
Pragma: "no-cache",
Expires: "0",
"X-Content-Type-Options": "nosniff"
});
}

function success(res, data, message, statusCode = 200) {
setPrivateHeaders(res);

return res.status(statusCode).json({
success: true,
message,
data
});
}

function failure(res, statusCode, code, message) {
setPrivateHeaders(res);

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
!documentsService ||
typeof documentsService[name] !== "function"
) {
throw httpError(
500,
"DOCUMENTS_SERVICE_MISCONFIGURED",
"A required document service operation is unavailable."
);
}

return documentsService[name].bind(documentsService);
}

function missingDocument(res) {
return failure(
res,
404,
"DOCUMENT_NOT_FOUND",
"The requested document was not found."
);
}

function requireResult(result, res) {
if (result === null || result === undefined) {
missingDocument(res);
return false;
}

return true;
}

/* ––––––––––––––––––––––––––––––––––––– /
/ Query helpers                                                              /
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

function getListFilters(query) {
return {
...getPagination(query),
category: query.category,
status: query.status,
applicationId: query.applicationId,
search: query.search,
sortBy: query.sortBy || "createdAt",
sortOrder: query.sortOrder || "desc"
};
}

/* ––––––––––––––––––––––––––––––––––––– /
/ Validation schemas                                                         /
/ ––––––––––––––––––––––––––––––––––––– */

const documentIdSchema = {
$schema: DIALECT,
type: "object",
properties: {
documentId: {
type: "string",
pattern: DOCUMENT_ID_PATTERN
}
},
required: ["documentId"],
additionalProperties: false
};

const listDocumentsSchema = {
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
enum: DOCUMENT_CATEGORIES
},
status: {
type: "string",
enum: DOCUMENT_STATUSES
},
applicationId: {
type: "string",
pattern: DOCUMENT_ID_PATTERN
},
search: {
type: "string",
minLength: 1,
maxLength: 100
},
sortBy: {
type: "string",
enum: ["createdAt", "updatedAt", "fileName", "category"]
},
sortOrder: {
type: "string",
enum: ["asc", "desc"]
}
},
additionalProperties: false
};

const initiateUploadSchema = {
$schema: DIALECT,
type: "object",
properties: {
fileName: {
type: "string",
minLength: 1,
maxLength: MAX_FILENAME_LENGTH,
pattern: "^[^/\\\u0000-\u001F\u007F]+$"
},
contentType: {
type: "string",
minLength: 1,
maxLength: 150,
pattern: "^[a-zA-Z0-9!#$&^.+-]+/[a-zA-Z0-9!#$&^.+-]+$"
},
sizeBytes: {
type: "integer",
minimum: 1,
maximum: MAX_FILE_SIZE_BYTES
},
category: {
type: "string",
enum: DOCUMENT_CATEGORIES
},
applicationId: {
type: "string",
pattern: DOCUMENT_ID_PATTERN
},
description: {
type: "string",
maxLength: 1000
}
},
required: [
"fileName",
"contentType",
"sizeBytes",
"category"
],
additionalProperties: false
};

const completeUploadSchema = {
$schema: DIALECT,
type: "object",
properties: {
uploadToken: {
type: "string",
minLength: 20,
maxLength: 2048
}
},
required: ["uploadToken"],
additionalProperties: false
};

const updateMetadataSchema = {
$schema: DIALECT,
type: "object",
minProperties: 1,
properties: {
description: {
type: "string",
maxLength: 1000
},
category: {
type: "string",
enum: DOCUMENT_CATEGORIES
}
},
additionalProperties: false
};

const reviewDocumentSchema = {
$schema: DIALECT,
type: "object",
properties: {
decision: {
type: "string",
enum: ["verified", "rejected"]
},
reason: {
type: "string",
maxLength: 3000
}
},
required: ["decision"],
additionalProperties: false
};

/* ––––––––––––––––––––––––––––––––––––– /
/ Document collection                                                        /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* GET /api/documents
* The service must scope results to the authenticated user’s permitted
* records and apply pagination in the database.
    */
    router.get(
    "/",
    authenticate,
    authorize("documents:read"),
    validateQuery(listDocumentsSchema),
    asyncHandler(async (req, res) => {
    const result = await serviceMethod("listDocuments")({
    user: req.user,
    filters: getListFilters(req.query)
    });
    return success(
    res,
    result,
    "Documents retrieved successfully."
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Upload session                                                             /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* POST /api/documents/upload-url
* Initiate a private upload session. The service must validate the
* requested MIME type against an explicit allowlist and apply quotas.
* Client-supplied contentType and sizeBytes are untrusted claims.
    */
    router.post(
    "/upload-url",
    authenticate,
    authorize("documents:create"),
    validateBody(initiateUploadSchema),
    asyncHandler(async (req, res) => {
    const result = await serviceMethod("initiateUpload")({
    user: req.user,
    payload: req.body
    });
    return success(
    res,
    result,
    "Upload session created successfully.",
    201
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Upload completion                                                          /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* POST /api/documents/:documentId/complete-upload
* Verify that the uploaded object matches the expected session, size,
* and content policy. Upload tokens must be bound to the user and
* document, expire quickly, and be single-use.
    */
    router.post(
    "/:documentId/complete-upload",
    authenticate,
    authorize("documents:create"),
    validateParams(documentIdSchema),
    validateBody(completeUploadSchema),
    asyncHandler(async (req, res) => {
    const result = await serviceMethod("completeUpload")({
    user: req.user,
    documentId: req.params.documentId,
    uploadToken: req.body.uploadToken
    });
    if (!requireResult(result, res)) {
    return;
    }
    return success(
    res,
    result,
    "Upload completion processed successfully."
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Download URL                                                               /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* POST /api/documents/:documentId/download-url
* This route must not proxy or expose storage contents.
    */
    router.post(
    "/:documentId/download-url",
    authenticate,
    authorize("documents:download"),
    validateParams(documentIdSchema),
    asyncHandler(async (req, res) => {
    const result = await serviceMethod("createDownloadUrl")({
    user: req.user,
    documentId: req.params.documentId
    });
    if (!requireResult(result, res)) {
    return;
    }
    return success(
    res,
    result,
    "Temporary download access generated successfully."
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Submit for review                                                          /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* POST /api/documents/:documentId/submit-for-review
    */
    router.post(
    "/:documentId/submit-for-review",
    authenticate,
    authorize("documents:submit"),
    validateParams(documentIdSchema),
    asyncHandler(async (req, res) => {
    const result = await serviceMethod("submitForReview")({
    user: req.user,
    documentId: req.params.documentId
    });
    if (!requireResult(result, res)) {
    return;
    }
    return success(
    res,
    result,
    "Document submitted for review successfully."
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Review                                                                     /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* POST /api/documents/:documentId/review
* Review permission must be limited to authorized reviewers.
* The service must record reviewer identity and audit information.
    */
    router.post(
    "/:documentId/review",
    authenticate,
    authorize("documents:review"),
    validateParams(documentIdSchema),
    validateBody(reviewDocumentSchema),
    asyncHandler(async (req, res) => {
    const result = await serviceMethod("reviewDocument")({
    user: req.user,
    documentId: req.params.documentId,
    decision: req.body.decision,
    reason: req.body.reason
    });
    if (!requireResult(result, res)) {
    return;
    }
    return success(
    res,
    result,
    "Document review processed successfully."
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Document metadata                                                          /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* GET /api/documents/:documentId
* Return safe metadata only. Do not return storage keys, signed URLs,
* internal review notes, or raw file contents.
    */
    router.get(
    "/:documentId",
    authenticate,
    authorize("documents:read"),
    validateParams(documentIdSchema),
    asyncHandler(async (req, res) => {
    const result = await serviceMethod("getDocumentById")({
    user: req.user,
    documentId: req.params.documentId
    });
    if (!requireResult(result, res)) {
    return;
    }
    return success(
    res,
    result,
    "Document retrieved successfully."
    );
    })
    );

/**

* PATCH /api/documents/:documentId
    */
    router.patch(
    "/:documentId",
    authenticate,
    authorize("documents:update"),
    validateParams(documentIdSchema),
    validateBody(updateMetadataSchema),
    asyncHandler(async (req, res) => {
    const result = await serviceMethod("updateDocumentMetadata")({
    user: req.user,
    documentId: req.params.documentId,
    payload: req.body
    });
    if (!requireResult(result, res)) {
    return;
    }
    return success(
    res,
    result,
    "Document metadata updated successfully."
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Delete                                                                     /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* DELETE /api/documents/:documentId
* Prefer a service-level soft delete when retention or audit rules require it.
    */
    router.delete(
    "/:documentId",
    authenticate,
    authorize("documents:delete"),
    validateParams(documentIdSchema),
    asyncHandler(async (req, res) => {
    const result = await serviceMethod("deleteDocument")({
    user: req.user,
    documentId: req.params.documentId
    });
    if (!requireResult(result, res)) {
    return;
    }
    return success(
    res,
    {
    documentId: req.params.documentId,
    deletion: result
    },
    "Document deletion processed successfully."
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Export                                                                     /
/ ––––––––––––––––––––––––––––––––––––– */

module.exports = router;