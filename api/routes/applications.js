
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
 * - Request temporary download access.
 * - Submit documents for verification.
 * - Allow authorized reviewers to verify or reject documents.
 * - Maintain service-level ownership checks and audit logging.
 *
 * IMPORTANT:
 * This module is an integration template. Confirm service exports,
 * middleware exports, storage-provider integration, and permissions
 * against the actual MedOrbits repository before deployment.
 */

const express = require("express");

const router = express.Router();

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

const DOCUMENT_ID_PATTERN = "^[A-Za-z0-9_-]{1,100}$";

/**
 * Shared response helpers.
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
 * Forward rejected promises to Express error middleware.
 */
function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/**
 * Resolve a service method without silently bypassing missing
 * functionality. Missing methods are configuration errors.
 */
function requireServiceMethod(methodName) {
  if (
    !documentsService ||
    typeof documentsService[methodName] !== "function"
  ) {
    const error = new Error(
      `Documents service method "${methodName}" is not configured.`
    );

    error.status = 500;
    error.code = "SERVICE_CONFIGURATION_ERROR";

    throw error;
  }

  return documentsService[methodName].bind(documentsService);
}

/**
 * Route parameter validation.
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
 * List filters.
 * Express query parameters normally arrive as strings.
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
      enum: [
        "identity",
        "education",
        "admission",
        "employment",
        "professional",
        "financial",
        "other"
      ]
    },
    status: {
      type: "string",
      enum: [
        "pending-upload",
        "uploaded",
        "pending-review",
        "verified",
        "rejected",
        "expired",
        "deleted"
      ]
    },
    applicationId: {
      type: "string",
      pattern: DOCUMENT_ID_PATTERN
    },
    search: {
      type: "string",
      maxLength: 100
    }
  }
};

/**
 * Start an upload.
 *
 * The API accepts document metadata only. It does not accept an
 * arbitrary filesystem path, storage key, or client-provided URL.
 *
 * The service should generate a unique storage key and a short-lived
 * signed upload URL for the configured private storage provider.
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
      pattern: "^[^/\\\\]+$"
    },
    contentType: {
      type: "string",
      minLength: 1,
      maxLength: 150
    },
    sizeBytes: {
      type: "integer",
      minimum: 1,
      maximum: 26214400
    },
    category: {
      type: "string",
      enum: [
        "identity",
        "education",
        "admission",
        "employment",
        "professional",
        "financial",
        "other"
      ]
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
 * Complete an upload after the storage provider confirms the file
 * was uploaded. The service must verify the actual stored object.
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
 * Applicant-editable metadata.
 * Ownership, storage location, verification state, and reviewer
 * information cannot be changed through this endpoint.
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
      enum: [
        "identity",
        "education",
        "admission",
        "employment",
        "professional",
        "financial",
        "other"
      ]
    }
  }
};

/**
 * Reviewer decision schema.
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
 *
 * The service must enforce ownership and administrative scope.
 */
router.get(
  "/",
  authenticate,
  authorize("documents:read"),
  validateQuery(listDocumentsSchema),
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 20), 100);

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
 * Initiate a private document upload.
 *
 * Expected service response:
 * {
 *   documentId: "...",
 *   uploadUrl: "https://...",
 *   uploadToken: "...",
 *   expiresAt: "..."
 * }
 *
 * Never log or persist the signed URL in ordinary application logs.
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
 *
 * Finalize a previously initiated upload.
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

    if (!result) {
      return sendError(
        res,
        404,
        "DOCUMENT_NOT_FOUND",
        "The requested document was not found."
      );
    }

    return sendSuccess(
      res,
      result,
      "Upload completion processed successfully."
    );
  })
);

/**
 * GET /api/documents/:documentId
 *
 * Retrieve document metadata, never the raw private file.
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

    if (!result) {
      return sendError(
        res,
        404,
        "DOCUMENT_NOT_FOUND",
        "The requested document was not found."
      );
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
 * Update permitted metadata.
 */
router.patch(
  "/:documentId",
  authenticate,
  authorize("documents:update"),
  validateParams(documentIdSchema),
  validateBody(updateMetadataSchema),
  asyncHandler(async (req, res) => {
    const result = await requireServiceMethod("updateDocumentMetadata")({
      user: req.user,
      documentId: req.params.documentId,
      payload: req.body
    });

    if (!result) {
      return sendError(
        res,
        404,
        "DOCUMENT_NOT_FOUND",
        "The requested document was not found."
      );
    }

    return sendSuccess(
      res,
      result,
      "Document metadata updated successfully."
    );
  })
);

/**
 * POST /api/documents/:documentId/download-url
 *
 * Generate short-lived download access after authorization.
 *
 * The service must verify document ownership or reviewer access
 * before returning a temporary URL.
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

    if (!result) {
      return sendError(
        res,
        404,
        "DOCUMENT_NOT_FOUND",
        "The requested document was not found."
      );
    }

    res.set("Cache-Control", "no-store");

    return sendSuccess(
      res,
      result,
      "Temporary download access generated successfully."
    );
  })
);

/**
 * POST /api/documents/:documentId/submit-for-review
 *
 * Submit an uploaded document for review.
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

    if (!result) {
      return sendError(
        res,
        404,
        "DOCUMENT_NOT_FOUND",
        "The requested document was not found."
      );
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
 * Restricted verification endpoint.
 *
 * Only authorized reviewers may approve or reject documents.
 * The service must validate state transitions and write audit logs.
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

    if (!result) {
      return sendError(
        res,
        404,
        "DOCUMENT_NOT_FOUND",
        "The requested document was not found."
      );
    }

    return sendSuccess(
      res,
      result,
      "Document review processed successfully."
    );
  })
);

/**
 * DELETE /api/documents/:documentId
 *
 * Request document deletion.
 *
 * The service must enforce ownership, legal retention requirements,
 * audit policies, and safe deletion from private storage.
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

    if (!result) {
      return sendError(
        res,
        404,
        "DOCUMENT_NOT_FOUND",
        "The requested document was not found."
      );
    }

    return sendSuccess(
      res,
      {
        documentId: req.params.documentId,
        deleted: true
      },
      "Document deletion processed successfully."
    );
  })
);

module.exports = router;
