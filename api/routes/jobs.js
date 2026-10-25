
"use strict";

/**
 * MedOrbits -- Jobs API Routes
 * File: /api/routes/jobs.js
 * Runtime: Node.js 20+
 * Framework: Express
 *
 * Mount:
 *   app.use("/api/jobs", require("./routes/jobs"));
 *
 * Required integrations:
 *   ../middlerware/authorization
 *   ../middlerware/validation
 *   ../services/jobs-service
 *
 * The service must enforce ownership, business rules, and
 * database constraints. Client-supplied roles and publication
 * decisions are never trusted.
 */

const express = require("express");

const router = express.Router();

const jobsService = require("../services/jobs-service");

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

const CATEGORIES = [
  "healthcare",
  "medical",
  "nursing",
  "pharmacy",
  "allied-health",
  "education",
  "research",
  "administration",
  "information-technology",
  "engineering",
  "management",
  "sales-marketing",
  "customer-support",
  "finance",
  "human-resources",
  "operations",
  "government",
  "other"
];

const EMPLOYMENT_TYPES = [
  "full-time",
  "part-time",
  "contract",
  "temporary",
  "internship",
  "apprenticeship",
  "freelance",
  "volunteer"
];

const WORKPLACES = ["on-site", "remote", "hybrid"];

const EXPERIENCE_LEVELS = [
  "entry-level",
  "junior",
  "mid-level",
  "senior",
  "lead",
  "manager",
  "director",
  "executive",
  "any"
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
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
    !jobsService ||
    typeof jobsService[name] !== "function"
  ) {
    const error = new Error(
      `Jobs service method "${name}" is not configured.`
    );

    error.status = 500;
    error.code = "SERVICE_CONFIGURATION_ERROR";

    throw error;
  }

  return jobsService[name].bind(jobsService);
}

function notFound(res) {
  return failure(
    res,
    404,
    "JOB_NOT_FOUND",
    "The requested job was not found."
  );
}

/* -------------------------------------------------------------------------- */
/* Request schemas                                                            */
/* -------------------------------------------------------------------------- */

const jobIdSchema = {
  $schema: DIALECT,
  type: "object",
  additionalProperties: false,
  properties: {
    jobId: {
      type: "string",
      pattern: ID_PATTERN
    }
  },
  required: ["jobId"]
};

const jobSlugSchema = {
  $schema: DIALECT,
  type: "object",
  additionalProperties: false,
  properties: {
    slug: {
      type: "string",
      minLength: 1,
      maxLength: 180,
      pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$"
    }
  },
  required: ["slug"]
};

const listJobsSchema = {
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
    search: {
      type: "string",
      minLength: 1,
      maxLength: 150
    },
    category: {
      type: "string",
      enum: CATEGORIES
    },
    employmentType: {
      type: "string",
      enum: EMPLOYMENT_TYPES
    },
    workplace: {
      type: "string",
      enum: WORKPLACES
    },
    experienceLevel: {
      type: "string",
      enum: EXPERIENCE_LEVELS
    },
    country: {
      type: "string",
      maxLength: 100
    },
    state: {
      type: "string",
      maxLength: 100
    },
    city: {
      type: "string",
      maxLength: 100
    },
    organizationId: {
      type: "string",
      pattern: ID_PATTERN
    },
    sortBy: {
      type: "string",
      enum: ["createdAt", "updatedAt", "title"]
    },
    sortOrder: {
      type: "string",
      enum: ["asc", "desc"]
    }
  }
};

const organizationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: {
      type: "string",
      minLength: 2,
      maxLength: 200
    },
    type: {
      type: "string",
      enum: [
        "hospital",
        "clinic",
        "medical-college",
        "university",
        "pharmaceutical-company",
        "diagnostic-center",
        "research-institute",
        "government-agency",
        "private-company",
        "non-profit",
        "recruitment-agency",
        "other"
      ]
    },
    website: {
      type: "string",
      format: "uri",
      maxLength: 2048
    },
    description: {
      type: "string",
      maxLength: 2000
    }
  },
  required: ["name"]
};

const createJobSchema = {
  $schema: DIALECT,
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      minLength: 3,
      maxLength: 200
    },
    slug: {
      type: "string",
      minLength: 1,
      maxLength: 180,
      pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$"
    },
    description: {
      type: "string",
      minLength: 20,
      maxLength: 20000
    },
    summary: {
      type: "string",
      maxLength: 500
    },
    category: {
      type: "string",
      enum: CATEGORIES
    },
    department: {
      type: "string",
      maxLength: 150
    },
    employmentType: {
      type: "string",
      enum: EMPLOYMENT_TYPES
    },
    workplace: {
      type: "string",
      enum: WORKPLACES
    },
    experienceLevel: {
      type: "string",
      enum: EXPERIENCE_LEVELS
    },
    organization: organizationSchema,
    location: {
      type: "object",
      additionalProperties: false,
      properties: {
        country: {
          type: "string",
          maxLength: 100
        },
        countryCode: {
          type: "string",
          pattern: "^[A-Z]{2}$"
        },
        state: {
          type: "string",
          maxLength: 100
        },
        city: {
          type: "string",
          maxLength: 100
        },
        district: {
          type: "string",
          maxLength: 100
        },
        postalCode: {
          type: "string",
          maxLength: 20
        }
      }
    },
    salary: {
      type: "object",
      additionalProperties: false,
      properties: {
        minimum: {
          type: "number",
          minimum: 0
        },
        maximum: {
          type: "number",
          minimum: 0
        },
        currency: {
          type: "string",
          pattern: "^[A-Z]{3}$"
        },
        period: {
          type: "string",
          enum: ["hour", "day", "week", "month", "year", "project"]
        },
        negotiable: {
          type: "boolean"
        },
        disclosed: {
          type: "boolean"
        }
      }
    },
    requirements: {
      type: "array",
      maxItems: 100,
      items: {
        type: "string",
        minLength: 2,
        maxLength: 1000
      }
    },
    responsibilities: {
      type: "array",
      maxItems: 100,
      items: {
        type: "string",
        minLength: 2,
        maxLength: 1000
      }
    },
    qualifications: {
      type: "array",
      maxItems: 100,
      items: {
        type: "string",
        minLength: 2,
        maxLength: 1000
      }
    },
    skills: {
      type: "array",
      uniqueItems: true,
      maxItems: 100,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 100
      }
    },
    benefits: {
      type: "array",
      maxItems: 50,
      items: {
        type: "string",
        maxLength: 300
      }
    },
    openings: {
      type: "integer",
      minimum: 1,
      maximum: 100000
    },
    applicationMethod: {
      type: "string",
      enum: ["internal", "external", "email", "walk-in"]
    },
    applicationUrl: {
      type: "string",
      format: "uri",
      maxLength: 2048
    },
    applicationEmail: {
      type: "string",
      format: "email",
      maxLength: 254
    },
    applicationInstructions: {
      type: "string",
      maxLength: 5000
    },
    applicationDeadline: {
      type: "string",
      format: "date-time"
    },
    tags: {
      type: "array",
      uniqueItems: true,
      maxItems: 30,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 50
      }
    }
  },
  required: [
    "title",
    "description",
    "category",
    "employmentType",
    "workplace",
    "organization"
  ],
  allOf: [
    {
      if: {
        properties: {
          applicationMethod: {
            const: "external"
          }
        },
        required: ["applicationMethod"]
      },
      then: {
        required: ["applicationUrl"]
      }
    },
    {
      if: {
        properties: {
          applicationMethod: {
            const: "email"
          }
        },
        required: ["applicationMethod"]
      },
      then: {
        required: ["applicationEmail"]
      }
    }
  ]
};

/**
 * Employer-editable fields only.
 * Status, featured, recruiter identity, moderation data, and audit
 * timestamps are deliberately excluded.
 */
const updateJobSchema = {
  $schema: DIALECT,
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: {
      type: "string",
      minLength: 3,
      maxLength: 200
    },
    description: {
      type: "string",
      minLength: 20,
      maxLength: 20000
    },
    summary: {
      type: "string",
      maxLength: 500
    },
    category: {
      type: "string",
      enum: CATEGORIES
    },
    department: {
      type: "string",
      maxLength: 150
    },
    employmentType: {
      type: "string",
      enum: EMPLOYMENT_TYPES
    },
    workplace: {
      type: "string",
      enum: WORKPLACES
    },
    experienceLevel: {
      type: "string",
      enum: EXPERIENCE_LEVELS
    },
    organization: organizationSchema,
    location: createJobSchema.properties.location,
    salary: createJobSchema.properties.salary,
    requirements: createJobSchema.properties.requirements,
    responsibilities: createJobSchema.properties.responsibilities,
    qualifications: createJobSchema.properties.qualifications,
    skills: createJobSchema.properties.skills,
    benefits: createJobSchema.properties.benefits,
    openings: createJobSchema.properties.openings,
    applicationMethod: createJobSchema.properties.applicationMethod,
    applicationUrl: createJobSchema.properties.applicationUrl,
    applicationEmail: createJobSchema.properties.applicationEmail,
    applicationInstructions: createJobSchema.properties.applicationInstructions,
    applicationDeadline: createJobSchema.properties.applicationDeadline,
    tags: createJobSchema.properties.tags
  }
};

/* -------------------------------------------------------------------------- */
/* Public job discovery                                                       */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/jobs
 * Search published jobs.
 */
router.get(
  "/",
  validateQuery(listJobsSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("listPublishedJobs")({
      filters: {
        page: Number(req.query.page || 1),
        limit: Math.min(Number(req.query.limit || 20), 100),
        search: req.query.search,
        category: req.query.category,
        employmentType: req.query.employmentType,
        workplace: req.query.workplace,
        experienceLevel: req.query.experienceLevel,
        country: req.query.country,
        state: req.query.state,
        city: req.query.city,
        organizationId: req.query.organizationId,
        sortBy: req.query.sortBy || "createdAt",
        sortOrder: req.query.sortOrder || "desc"
      }
    });

    return success(res, result, "Jobs retrieved successfully.");
  })
);

/**
 * GET /api/jobs/featured
 * Featured jobs must be published and approved.
 */
router.get(
  "/featured",
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("listFeaturedJobs")({
      limit: 12
    });

    return success(
      res,
      result,
      "Featured jobs retrieved successfully."
    );
  })
);

/**
 * GET /api/jobs/:jobId
 * Retrieve one published job by identifier.
 */
router.get(
  "/:jobId",
  validateParams(jobIdSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("getPublishedJobById")({
      jobId: req.params.jobId
    });

    if (!result) {
      return notFound(res);
    }

    return success(res, result, "Job retrieved successfully.");
  })
);

/**
 * GET /api/jobs/slug/:slug
 * Retrieve one published job by SEO-friendly slug.
 */
router.get(
  "/slug/:slug",
  validateParams(jobSlugSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("getPublishedJobBySlug")({
      slug: req.params.slug
    });

    if (!result) {
      return notFound(res);
    }

    return success(res, result, "Job retrieved successfully.");
  })
);

/* -------------------------------------------------------------------------- */
/* Employer job management                                                    */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/jobs/manage/mine
 * List jobs owned by the authenticated employer.
 */
router.get(
  "/manage/mine",
  authenticate,
  authorize("jobs:read-own"),
  validateQuery(listJobsSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("listMyJobs")({
      user: req.user,
      filters: {
        page: Number(req.query.page || 1),
        limit: Math.min(Number(req.query.limit || 20), 100),
        status: req.query.status,
        search: req.query.search
      }
    });

    return success(res, result, "Your jobs retrieved successfully.");
  })
);

/**
 * POST /api/jobs
 * Create a draft job.
 *
 * The server assigns recruiter identity, ownership, and status.
 */
router.post(
  "/",
  authenticate,
  authorize("jobs:create"),
  validateBody(createJobSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("createJob")({
      user: req.user,
      payload: req.body,
      initialStatus: "draft"
    });

    return success(res, result, "Job created successfully.", 201);
  })
);

/**
 * PATCH /api/jobs/:jobId
 * Update an employer-owned job.
 */
router.patch(
  "/:jobId",
  authenticate,
  authorize("jobs:update-own"),
  validateParams(jobIdSchema),
  validateBody(updateJobSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("updateJob")({
      user: req.user,
      jobId: req.params.jobId,
      payload: req.body
    });

    if (!result) {
      return notFound(res);
    }

    return success(res, result, "Job updated successfully.");
  })
);

/**
 * POST /api/jobs/:jobId/publish
 * Request publication through the authorized workflow.
 *
 * The service must check employer ownership, moderation policy,
 * required fields, and any applicable subscription requirements.
 */
router.post(
  "/:jobId/publish",
  authenticate,
  authorize("jobs:publish-own"),
  validateParams(jobIdSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("requestJobPublication")({
      user: req.user,
      jobId: req.params.jobId
    });

    if (!result) {
      return notFound(res);
    }

    return success(
      res,
      result,
      "Job publication request processed successfully."
    );
  })
);

/**
 * POST /api/jobs/:jobId/close
 * Close an employer-owned job.
 */
router.post(
  "/:jobId/close",
  authenticate,
  authorize("jobs:update-own"),
  validateParams(jobIdSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("closeJob")({
      user: req.user,
      jobId: req.params.jobId
    });

    if (!result) {
      return notFound(res);
    }

    return success(res, result, "Job closed successfully.");
  })
);

/**
 * DELETE /api/jobs/:jobId
 * Request deletion or archival of an employer-owned job.
 */
router.delete(
  "/:jobId",
  authenticate,
  authorize("jobs:delete-own"),
  validateParams(jobIdSchema),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("deleteJob")({
      user: req.user,
      jobId: req.params.jobId
    });

    if (!result) {
      return notFound(res);
    }

    return success(
      res,
      {
        jobId: req.params.jobId,
        deleted: true
      },
      "Job deletion processed successfully."
    );
  })
);

/* -------------------------------------------------------------------------- */
/* Administrative moderation                                                  */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/jobs/:jobId/review
 *
 * Approve or reject a job listing.
 * Restricted to authorized moderators.
 */
router.post(
  "/:jobId/review",
  authenticate,
  authorize("jobs:moderate"),
  validateParams(jobIdSchema),
  validateBody({
    $schema: DIALECT,
    type: "object",
    additionalProperties: false,
    properties: {
      decision: {
        type: "string",
        enum: ["approve", "reject"]
      },
      reason: {
        type: "string",
        maxLength: 3000
      }
    },
    required: ["decision"]
  }),
  asyncHandler(async (req, res) => {
    const result = await serviceMethod("reviewJob")({
      user: req.user,
      jobId: req.params.jobId,
      decision: req.body.decision,
      reason: req.body.reason
    });

    if (!result) {
      return notFound(res);
    }

    return success(
      res,
      result,
      "Job moderation completed successfully."
    );
  })
);

module.exports = router;
