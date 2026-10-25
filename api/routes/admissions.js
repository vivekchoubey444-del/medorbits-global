
"use strict";

/**
 * MedOrbits -- Admissions Routes
 * File: /api/routes/admissions.js
 *
 * Runtime: Node.js 20+
 * Framework: Express
 *
 * Responsibilities:
 * - Register admission-related API endpoints.
 * - Apply authentication and authorization.
 * - Validate incoming request payloads.
 * - Delegate business logic to the admissions service.
 * - Forward unexpected errors to centralized error middleware.
 *
 * Expected integration:
 * - ../middlerware/validation.js
 * - ../services/admissions-service.js
 *
 * Adapt middleware imports and service methods to match the
 * actual exports in your repository.
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

const RESOURCE_NAME = "admission";
const RESOURCE_ID_PATTERN = "^[A-Za-z0-9_-]{1,100}$";

/**
 * Validate an identifier using the route parameter schema.
 *
 * This schema is local to this module, so it does not require
 * an additional schema file.
 */
const admissionIdSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  properties: {
    admissionId: {
      type: "string",
      pattern: RESOURCE_ID_PATTERN
    }
  },
  required: ["admissionId"]
};

/**
 * Pagination query schema.
 */
const paginationSchema = {
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
    status: {
      type: "string",
      enum: [
        "draft",
        "submitted",
        "under-review",
        "documents-required",
        "approved",
        "rejected",
        "waitlisted",
        "withdrawn",
        "closed"
      ]
    },
    course: {
      type: "string",
      minLength: 1,
      maxLength: 150
    },
    academicYear: {
      type: "string",
      pattern: "^[0-9]{4}(-[0-9]{4})?$"
    },
    search: {
      type: "string",
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
  }
};

/**
 * Application creation schema.
 *
 * Replace or extend this definition to match the actual
 * application.schema.json contract.
 *
 * Server-managed fields, including applicant ownership,
 * internal review decisions, and privileged status changes,
 * must not be accepted from untrusted clients.
 */
const createAdmissionSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  properties: {
    courseId: {
      type: "string",
      minLength: 1,
      maxLength: 100
    },
    institutionId: {
      type: "string",
      minLength: 1,
      maxLength: 100
    },
    academicYear: {
      type: "string",
      pattern: "^[0-9]{4}-[0-9]{4}$"
    },
    applicantDetails: {
      type: "object",
      additionalProperties: false,
      properties: {
        firstName: {
          type: "string",
          minLength: 1,
          maxLength: 100
        },
        lastName: {
          type: "string",
          minLength: 1,
          maxLength: 100
        },
        email: {
          type: "string",
          format: "email",
          maxLength: 254
        },
        phone: {
          type: "string",
          pattern: "^\\+[1-9][0-9]{7,14}$"
        }
      },
      required: [
        "firstName",
        "lastName",
        "email",
        "phone"
      ]
    },
    preferences: {
      type: "object",
      additionalProperties: false,
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
      }
    },
    documents: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          documentId: {
            type: "string",
            minLength: 1,
            maxLength: 100
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
        ]
      }
    }
  },
  required: [
    "courseId",
    "institutionId",
    "academicYear",
    "applicantDetails"
  ]
};

/**
 * Update schema intentionally excludes fields such as:
 * applicantId, status, reviewerId, approvedAt, and createdAt.
 *
 * Only fields approved for applicant editing should be added.
 */
const updateAdmissionSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    applicantDetails: {
      type: "object",
      additionalProperties: false,
      minProperties: 1,
      properties: {
        firstName: {
          type: "string",
          minLength: 1,
          maxLength: 100
        },
        lastName: {
          type: "string",
          minLength: 1,
          maxLength: 100
        },
        email: {
          type: "string",
          format: "email",
          maxLength: 254
        },
        phone: {
          type: "string",
          pattern: "^\\+[1-9][0-9]{7,14}$"
        }
      }
    },
    preferences: {
      type: "object",
      additionalProperties: false,
      minProperties: 1,
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
      }
    }
  }
};

/**
 * Ensure the configured service method exists.
 * Missing methods are integration errors, not client errors.
 */
function requireServiceMethod(methodName) {
  if (
    !admissionsService ||
    typeof admissionsService[methodName] !== "function"
  ) {
    const error = new Error(
      `Admissions service method "${methodName}" is not configured.`
    );

    error.status = 500;
    error.code = "SERVICE_CONFIGURATION_ERROR";

    throw error;
  }

  return admissionsService[methodName].bind(admissionsService);
}

/**
 * Route-level async error forwarding.
 */
function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/**
 * Standard success response.
 */
function successResponse(res, data, message, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

/**
 * GET /api/admissions
 *
 * List admissions visible to the authenticated user.
 * The service must enforce applicant ownership or administrative
 * access and must apply pagination at the database level.
 */
router.get(
  "/",
  authenticate,
  authorize("admissions:read"),
  validateQuery(paginationSchema),
  asyncHandler(async (req, res) => {
    const result = await requireServiceMethod("listAdmissions")({
      user: req.user,
      query: {
        page: Number(req.query.page || 1),
        limit: Math.min(Number(req.query.limit || 20), 100),
        status: req.query.status,
        course: req.query.course,
        academicYear: req.query.academicYear,
        search: req.query.search,
        sortBy: req.query.sortBy || "createdAt",
        sortOrder: req.query.sortOrder || "desc"
      }
    });

    return successResponse(
      res,
      result,
      "Admissions retrieved successfully."
    );
  })
);

/**
 * POST /api/admissions
 *
 * Create an admission application for the authenticated user.
 * Applicant ownership must be derived from req.user on the server.
 */
router.post(
  "/",
  authenticate,
  authorize("admissions:create"),
  validateBody(createAdmissionSchema),
  asyncHandler(async (req, res) => {
    const result = await requireServiceMethod("createAdmission")({
      user: req.user,
      payload: req.body
    });

    return successResponse(
      res,
      result,
      "Admission application created successfully.",
      201
    );
  })
);

/**
 * GET /api/admissions/:admissionId
 *
 * Retrieve one admission application after authorization.
 */
router.get(
  "/:admissionId",
  authenticate,
  authorize("admissions:read"),
  validateParams(admissionIdSchema),
  asyncHandler(async (req, res) => {
    const result = await requireServiceMethod("getAdmissionById")({
      user: req.user,
      admissionId: req.params.admissionId
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: {
          code: "ADMISSION_NOT_FOUND",
          message: "The requested admission was not found."
        }
      });
    }

    return successResponse(
      res,
      result,
      "Admission retrieved successfully."
    );
  })
);

/**
 * PATCH /api/admissions/:admissionId
 *
 * Update applicant-editable fields only.
 * The service must verify ownership and enforce workflow rules.
 */
router.patch(
  "/:admissionId",
  authenticate,
  authorize("admissions:update"),
  validateParams(admissionIdSchema),
  validateBody(updateAdmissionSchema),
  asyncHandler(async (req, res) => {
    const result = await requireServiceMethod("updateAdmission")({
      user: req.user,
      admissionId: req.params.admissionId,
      payload: req.body
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: {
          code: "ADMISSION_NOT_FOUND",
          message: "The requested admission was not found."
        }
      });
    }

    return successResponse(
      res,
      result,
      "Admission updated successfully."
    );
  })
);

/**
 * POST /api/admissions/:admissionId/submit
 *
 * Submit a previously created draft.
 * Submission eligibility, document completeness, deadlines,
 * and status transitions must be enforced by the service.
 */
router.post(
  "/:admissionId/submit",
  authenticate,
  authorize("admissions:submit"),
  validateParams(admissionIdSchema),
  asyncHandler(async (req, res) => {
    const result = await requireServiceMethod("submitAdmission")({
      user: req.user,
      admissionId: req.params.admissionId
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: {
          code: "ADMISSION_NOT_FOUND",
          message: "The requested admission was not found."
        }
      });
    }

    return successResponse(
      res,
      result,
      "Admission submitted successfully."
    );
  })
);

/**
 * POST /api/admissions/:admissionId/withdraw
 *
 * Withdraw an application if the current workflow permits it.
 */
router.post(
  "/:admissionId/withdraw",
  authenticate,
  authorize("admissions:withdraw"),
  validateParams(admissionIdSchema),
  asyncHandler(async (req, res) => {
    const result = await requireServiceMethod("withdrawAdmission")({
      user: req.user,
      admissionId: req.params.admissionId
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: {
          code: "ADMISSION_NOT_FOUND",
          message: "The requested admission was not found."
        }
      });
    }

    return successResponse(
      res,
      result,
      "Admission withdrawal processed successfully."
    );
  })
);

/**
 * GET /api/admissions/:admissionId/status
 *
 * Return the current application status without exposing
 * internal moderation notes or restricted reviewer data.
 */
router.get(
  "/:admissionId/status",
  authenticate,
  authorize("admissions:read"),
  validateParams(admissionIdSchema),
  asyncHandler(async (req, res) => {
    const result = await requireServiceMethod("getAdmissionStatus")({
      user: req.user,
      admissionId: req.params.admissionId
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: {
          code: "ADMISSION_NOT_FOUND",
          message: "The requested admission was not found."
        }
      });
    }

    return successResponse(
      res,
      result,
      "Admission status retrieved successfully."
    );
  })
);

/**
 * POST /api/admissions/:admissionId/review
 *
 * Administrative review endpoint.
 *
 * The admissions:review permission must only be granted to
 * authorized reviewers. The service must validate permitted
 * state transitions and record an audit event.
 */
router.post(
  "/:admissionId/review",
  authenticate,
  authorize("admissions:review"),
  validateParams(admissionIdSchema),
  asyncHandler(async (req, res) => {
    const reviewSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      properties: {
        decision: {
          type: "string",
          enum: [
            "approved",
            "rejected",
            "documents-required",
            "waitlisted"
          ]
        },
        note: {
          type: "string",
          maxLength: 3000
        }
      },
      required: ["decision"]
    };

    const validateReview = validateBody(reviewSchema);

    // Run the project's standard validation middleware before
    // processing the review decision.
    return validateReview(req, res, (validationError) => {
      if (validationError) {
        return res.status(500).json({
          success: false,
          error: {
            code: "VALIDATION_PIPELINE_ERROR",
            message: "The review request could not be validated."
          }
        });
      }

      return asyncHandler(async () => {
        const result = await requireServiceMethod("reviewAdmission")({
          user: req.user,
          admissionId: req.params.admissionId,
          decision: req.body.decision,
          note: req.body.note
        });

        return successResponse(
          res,
          result,
          "Admission review processed successfully."
        );
      })(req, res, next);
    });
  })
);

module.exports = router;
