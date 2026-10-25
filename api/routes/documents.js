
"use strict";

/**
 * MedOrbits -- Documents API
 * File: /api/routes/documents.js
 * Runtime: Node.js 20+
 *
 * Mount:
 *   app.use("/api/documents", require("./routes/documents"));
 *
 * Dependencies:
 *   express
 *   ../middlerware/authorization
 *   ../middlerware/validation
 *   ../services/documents-service
 *
 * Security:
 * - Authentication and authorization are independent checks.
 * - Ownership is enforced by the service on every document operation.
 * - Storage keys, owners, and review decisions are server-managed.
 * - Private file contents are never served directly by this router.
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

const SCHEMA_DIALECT =
  "https://json-schema.org/draft/2020-12/schema";

const DOCUMENT_ID_PATTERN = "^[A-Za-z0-9_-]{1,100}$";

const DOCUMENT_CATEGORIES = [
  "identity",
  "education",
  "admission",
  "employment",
  "professional",
  "financial",
  "other"
];

/* -------------------------------------------------------------------------- */
/* Response and service helpers                                               */
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
  return function routeHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function serviceMethod(name) {
  if (
    !documentsService ||
    typeof documentsService[name] !== "function"
  ) {
    const error = new Error(
      `Required documents service method "${name}" is unavailable.`
    );

    error.status = 500;
    error.code = "SERVICE_CONFIGURATION_ERROR";

    throw error;
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

/* -------------------------------------------------------------------------- */
/* Request schemas                                                            */
/* -------------------------------------------------------------------------- */

const documentIdSchema = {
  $schema: SCHEMA_DIALECT,
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

const listDocumentsSchema = {
  $schema: SCHEMA_DIALECT,
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
      minLength: 1,
      maxLength: 100
    }
  }
};

const initiateUploadSchema = {
  $schema: SCHEMA_DIALECT,
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

const completeUploadSchema = {
  $schema: SCHEMA_DIALECT,
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

const updateMetadataSchema = {
  $schema: SCHEMA_DIALECT,
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

const reviewDocumentSchema = {
  $schema: SCHEMA_DIALECT,
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

/* -------------------------------------------------------------------------- */
/* GET /api/documents                                                         */
/* List documents available to the authenticated user.                       */
/* -------------------------------------------------------------------------- */

router.get(
  "/",
  authenticate,
  authorize("documents:read"),
  validateQuery(listDocumentsSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("listDocuments")({
      user: req.user,
      filters: {
        page: Number(req.query.page || 1),
        limit: Math.min(Number(req.query.limit || 20), 100),
        category: req.query.category,
        status: req.query.status,
        applicationId: req.query.applicationId,
        search: req.query.search
      }
    });

    return success(
      res,
      result,
      "Documents retrieved successfully."
    );
  })
);

/* -------------------------------------------------------------------------- */
/* POST /api/documents/upload-url                                             */
/* Create a private, short-lived upload session.                              */
/* -------------------------------------------------------------------------- */

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

    res.set("Cache-Control", "no-store");

    return success(
      res,
      result,
      "Upload session created successfully.",
      201
    );
  })
);

/* -------------------------------------------------------------------------- */
/* POST /api/documents/:documentId/complete-upload                            */
/* Verify storage upload and finalize metadata.                               */
/* -------------------------------------------------------------------------- */

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

    if (!result) {
      return missingDocument(res);
    }

    return success(
      res,
      result,
      "Upload completion processed successfully."
    );
  })
);

/* -------------------------------------------------------------------------- */
/* GET /api/documents/:documentId                                             */
/* Return authorized metadata, never raw file contents.                      */
/* -------------------------------------------------------------------------- */

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

    if (!result) {
      return missingDocument(res);
    }

    return success(
      res,
      result,
      "Document retrieved successfully."
    );
  })
);

/* -------------------------------------------------------------------------- */
/* PATCH /api/documents/:documentId                                           */
/* Update applicant-editable metadata only.                                  */
/* -------------------------------------------------------------------------- */

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

    if (!result) {
      return missingDocument(res);
    }

    return success(
      res,
      result,
      "Document metadata updated successfully."
    );
  })
);

/* -------------------------------------------------------------------------- */
/* POST /api/documents/:documentId/download-url                               */
/* Generate authorized, short-lived download access.                         */
/* -------------------------------------------------------------------------- */

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

    if (!result) {
      return missingDocument(res);
    }

    res.set("Cache-Control", "no-store");
    res.set("Pragma", "no-cache");

    return success(
      res,
      result,
      "Temporary download access generated successfully."
    );
  })
);

/* -------------------------------------------------------------------------- */
/* POST /api/documents/:documentId/submit-for-review                          */
/* Submit a completed document for verification.                             */
/* -------------------------------------------------------------------------- */

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

    if (!result) {
      return missingDocument(res);
    }

    return success(
      res,
      result,
      "Document submitted for review successfully."
    );
  })
);

/* -------------------------------------------------------------------------- */
/* POST /api/documents/:documentId/review                                     */
/* Review a document. Requires reviewer permissions.                          */
/* -------------------------------------------------------------------------- */

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

    if (!result) {
      return missingDocument(res);
    }

    return success(
      res,
      result,
      "Document review processed successfully."
    );
  })
);

/* -------------------------------------------------------------------------- */
/* DELETE /api/documents/:documentId                                          */
/* Request authorized document deletion.                                     */
/* -------------------------------------------------------------------------- */

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

    if (!result) {
      return missingDocument(res);
    }

    return success(
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
