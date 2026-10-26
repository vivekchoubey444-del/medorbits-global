"use strict";
/**
 * MedOrbits -- Documents API Routes
 * File: /api/routes/documents.js
 * Runtime: Node.js 20+
 * Framework: Express
 *
 * Responsibilities:
 * - List and retrieve authorized document metadata.
 * - Initiate secure document uploads.
 * - Confirm completed uploads.
 * - Generate temporary download access.
 * - Submit documents for verification.
 * - Allow authorized reviewers to verify or reject documents.
 * - Request document deletion.
 *
 * Security requirements:
 * - Private documents must never be served directly by this router.
 * - Ownership and tenant scope must be enforced by the service.
 * - Signed URLs and upload tokens must never be logged.
 * - File size, MIME type, file signature, malware status, and storage
 *   ownership must be independently verified by the service.
 * - All state changes must be audited by the service.
 *
 * Integration template: confirm service and middleware contracts
 * before deploying.
 */
const express = require("express");
const documentsService = require("../services/documents-service");
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
const DOCUMENT_ID_PATTERN = "^[A-Za-z0-9_-]{1,100}$";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
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
/**
 * Prevent sensitive document responses from being cached.
 */
router.use((req, res, next) => {
  res.set({
    "Cache-Control": "no-store, private, max-age=0",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff"
  });
  next();
});
/**
 * Consistent success response.
 */
function sendSuccess(
  res,
  data,
  message,
  statusCode = 200
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}
/**
 * Consistent public error response.
 * Do not expose stack traces, storage keys, or internal errors.
 */
function sendError(
  res,
  statusCode,
  code,
  message
) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message
    }
  });
}
/**
 * Forward asynchronous errors to centralized Express error handling.
 */
function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next);
  };
}
/**
 * Resolve required service methods without silently skipping missing
 * functionality.
 */
function requireServiceMethod(methodName) {
  if (
    !documentsService ||
    typeof documentsService[methodName] !== "function"
  ) {
    const error = new Error(
      `Required documents service method "${methodName}" is not configured.`
    );
    error.status = 500;
    error.code = "SERVICE_CONFIGURATION_ERROR";
    throw error;
  }
  return documentsService[methodName].bind(documentsService);
}
/**
 * Parse a validated positive integer query parameter.
 */
function parsePositiveInteger(value, fallback, maximum) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > maximum
  ) {
    const error = new Error("Invalid pagination parameter.");
    error.status = 400;
    error.code = "INVALID_PAGINATION";
    throw error;
  }
  return parsed;
}
/**
 * Handle a missing service result.
 *
 * Services should return null/undefined only when the requested
 * resource is not available to the caller. They should throw typed
 * errors for invalid state transitions and other failures.
 */
function requireResult(result, res) {
  if (result === null || result === undefined) {
    sendError(
      res,
      404,
      "DOCUMENT_NOT_FOUND",
      "The requested document was not found."
    );
    return false;
  }
  return true;
}
/**
 * Route parameter schema.
 */
const documentIdSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  properties: {
    documentId: {
      type: "string",
      pattern: DOCUMENT_ID_PATTERN
    }
  },
  required: ["documentId"]
};
/**
 * List documents.
 * Query parameters arrive as strings under normal Express parsing.
 */
const listDocumentsSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
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
    }
  }
};
/**
 * Initiate an upload.
 *
 * Never accept arbitrary filesystem paths, storage keys, or client-
 * supplied upload URLs. The service generates the storage key and
 * short-lived upload URL.
 */
const initiateUploadSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  properties: {
    fileName: {
      type: "string",
      minLength: 1,
      maxLength: 255,
      pattern: "^[^/\\\\\\u0000-\\u001F\\u007F]+$"
    },
    contentType: {
      type: "string",
      minLength: 1,
      maxLength: 150
    },
    sizeBytes: {
      type: "integer",
      minimum: 1,
      maximum: MAX_UPLOAD_BYTES
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
  ]
};
/**
 * Confirm an upload.
 *
 * The upload token must be bound to the authenticated user, document,
 * expected object key, and expiration by the service.
 */
const completeUploadSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  properties: {
    uploadToken: {
      type: "string",
      minLength: 20,
      maxLength: 2048
    }
  },
  required: ["uploadToken"]
};
/**
 * Applicant-editable metadata only.
 */
const updateMetadataSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
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
  }
};
/**
 * Reviewer decision.
 *
 * The service must enforce legal state transitions, reviewer scope,
 * and audit logging. A rejected document should have a meaningful
 * reason according to the service's business rules.
 */
const reviewDocumentSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
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
  required: ["decision"]
};
/**
 * GET /api/documents
 *
 * List documents accessible to the current user.
 */
router.get(
  "/",
  authenticate,
  authorize("documents:read"),
  validateQuery(listDocumentsSchema),
  asyncHandler(async (req, res) => {
    const page = parsePositiveInteger(
      req.query.page,
      DEFAULT_PAGE,
      100000
    );
    const limit = parsePositiveInteger(
      req.query.limit,
      DEFAULT_LIMIT,
      MAX_LIMIT
    );
    const result = await requireServiceMethod("listDocuments")({
      user: req.user,
      filters: {
        page,
        limit,
        category: req.query.category,
        status: req.query.status,
        applicationId: req.query.applicationId,
        search: req.query.search
      }
    });
    return sendSuccess(
      res,
      result,
      "Documents retrieved successfully."
    );
  })
);
/**
 * POST /api/documents/upload-url
 *
 * Initialize a private document upload.
 */
router.post(
  "/upload-url",
  authenticate,
  authorize("documents:create"),
  validateBody(initiateUploadSchema),
  asyncHandler(async (req, res) => {
    const result = await requireServiceMethod("initiateUpload")({
      user: req.user,
      payload: req.body
    });
    if (!result) {
      return sendError(
        res,
        500,
        "UPLOAD_INITIALIZATION_FAILED",
        "The upload could not be initialized."
      );
    }
    return sendSuccess(
      res,
      result,
      "Secure upload initialized successfully.",
      201
    );
  })
);
/**
 * POST /api/documents/:documentId/complete-upload
 */
router.post(
  "/:documentId/complete-upload",
  authenticate,
  authorize("documents:create"),
  validateParams(documentIdSchema),
  validateBody(completeUploadSchema),
  asyncHandler(async (req, res) => {
    const result = await requireServiceMethod("completeUpload")({
      user: req.user,
      documentId: req.params.documentId,
      uploadToken: req.body.uploadToken
    });
    if (!requireResult(result, res)) {
      return;
    }
    return sendSuccess(
      res,
      result,
      "Upload completion processed successfully."
    );
  })
);
/**
 * POST /api/documents/:documentId/download-url
 *
 * Generate temporary access only after authorization and ownership
 * checks in the service.
 */
router.post(
  "/:documentId/download-url",
  authenticate,
  authorize("documents:download"),
  validateParams(documentIdSchema),
  asyncHandler(async (req, res) => {
    const result = await requireServiceMethod("createDownloadUrl")({
      user: req.user,
      documentId: req.params.documentId
    });
    if (!requireResult(result, res)) {
      return;
    }
    return sendSuccess(
      res,
      result,
      "Temporary download access generated successfully."
    );
  })
);
/**
 * POST /api/documents/:documentId/submit-for-review
 */
router.post(
  "/:documentId/submit-for-review",
  authenticate,
  authorize("documents:submit"),
  validateParams(documentIdSchema),
  asyncHandler(async (req, res) => {
    const result = await requireServiceMethod("submitForReview")({
      user: req.user,
      documentId: req.params.documentId
    });
    if (!requireResult(result, res)) {
      return;
    }
    return sendSuccess(
      res,
      result,
      "Document submitted for review successfully."
    );
  })
);
/**
 * POST /api/documents/:documentId/review
 *
 * Reviewer-only endpoint.
 */
router.post(
  "/:documentId/review",
  authenticate,
  authorize("documents:review"),
  validateParams(documentIdSchema),
  validateBody(reviewDocumentSchema),
  asyncHandler(async (req, res) => {
    const result = await requireServiceMethod("reviewDocument")({
      user: req.user,
      documentId: req.params.documentId,
      decision: req.body.decision,
      reason: req.body.reason
    });
    if (!requireResult(result, res)) {
      return;
    }
    return sendSuccess(
      res,
      result,
      "Document review processed successfully."
    );
  })
);
/**
 * GET /api/documents/:documentId
 *
 * Return safe metadata only, never the raw private file.
 */
router.get(
  "/:documentId",
  authenticate,
  authorize("documents:read"),
  validateParams(documentIdSchema),
  asyncHandler(async (req, res) => {
    const result = await requireServiceMethod("getDocumentById")({
      user: req.user,
      documentId: req.params.documentId
    });
    if (!requireResult(result, res)) {
      return;
    }
    return sendSuccess(
      res,
      result,
      "Document retrieved successfully."
    );
  })
);
/**
 * PATCH /api/documents/:documentId
 *
 * Update allowed metadata only.
 */
router.patch(
  "/:documentId",
  authenticate,
  authorize("documents:update"),
  validateParams(documentIdSchema),
  validateBody(updateMetadataSchema),
  asyncHandler(async (req, res) => {
    const result = await requireServiceMethod(
      "updateDocumentMetadata"
    )({
      user: req.user,
      documentId: req.params.documentId,
      payload: req.body
    });
    if (!requireResult(result, res)) {
      return;
    }
    return sendSuccess(
      res,
      result,
      "Document metadata updated successfully."
    );
  })
);
/**
 * DELETE /api/documents/:documentId
 *
 * Request deletion. The service decides whether deletion is immediate,
 * queued, or blocked by legal retention requirements.
 */
router.delete(
  "/:documentId",
  authenticate,
  authorize("documents:delete"),
  validateParams(documentIdSchema),
  asyncHandler(async (req, res) => {
    const result = await requireServiceMethod("deleteDocument")({
      user: req.user,
      documentId: req.params.documentId
    });
    if (!requireResult(result, res)) {
      return;
    }
    return sendSuccess(
      res,
      {
        documentId: req.params.documentId,
        deletion: result
      },
      "Document deletion request processed successfully."
    );
  })
);
module.exports = router;