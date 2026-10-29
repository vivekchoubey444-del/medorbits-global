"use strict";

/**

* MedOrbits -- Jobs API Routes
* File: app.use("/api/jobs", require("./api/routes/jobs"));
* Runtime: Node.js 20+
* Framework: Express
* Mount:
* app.use("/api/jobs", require("./api/routes/jobs"));
* Required integrations:
* ../middleware/authorization
* ../middleware/validation
* ../services/jobs-service
* Required authorization middleware:
* authenticate
* authorize(permission)
* Required validation middleware:
* validateBody(schema)
* validateParams(schema)
* validateQuery(schema)
* Required jobs-service methods:
* listPublishedJobs
* listFeaturedJobs
* getPublishedJobById
* getPublishedJobBySlug
* listMyJobs
* createJob
* updateJob
* requestJobPublication
* closeJob
* deleteJob
* reviewJob
* Security:
* ●	The service must enforce ownership and business rules.
* ●	Never trust client-supplied user IDs, roles, or approval decisions.
* ●	Public endpoints must return published, approved jobs only.
* ●	Employer mutations must be ownership-scoped by the service.
* ●	Moderation must be permission-restricted and audited.
* ●	Never return raw database errors, stack traces, or credentials.
        */

const express = require("express");

const router = express.Router();

const jobsService = require("../services/jobs-service");

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
/ Constants                                                                  /
/ ––––––––––––––––––––––––––––––––––––– */

const DIALECT = "https://json-schema.org/draft/2020-12/schema";

const ID_PATTERN = "^[A-Za-z0-9_-]{1,100}$";
const SLUG_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_PAGE = 100000;

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

const WORKPLACES = [
"on-site",
"remote",
"hybrid"
];

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

const JOB_STATUSES = [
"draft",
"pending-review",
"published",
"rejected",
"closed",
"archived"
];

const ORGANIZATION_TYPES = [
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
];

const APPLICATION_METHODS = [
"internal",
"external",
"email",
"walk-in"
];

const SALARY_PERIODS = [
"hour",
"day",
"week",
"month",
"year",
"project"
];

/* ––––––––––––––––––––––––––––––––––––– /
/ Response helpers                                                           /
/ ––––––––––––––––––––––––––––––––––––– */

function success(res, data, message, statusCode = 200) {
res.set("Cache-Control", "no-store");

return res.status(statusCode).json({
success: true,
message,
data
});
}

function failure(res, statusCode, code, message) {
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

/**

* Resolve service methods without exposing implementation details.
    */
    function serviceMethod(name) {
    if (
    !jobsService ||
    typeof jobsService[name] !== "function"
    ) {
    const error = new Error(
    `Required jobs service method is unavailable: ${name}`
    );
    error.status = 500;
    error.code = "SERVICE_CONFIGURATION_ERROR";
    error.expose = false;
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

/**

* Normalize validated pagination values.
* Validation middleware should reject invalid values before this runs.
    */
    function getPagination(query) {
    const page = Number(query.page || DEFAULT_PAGE);
    const requestedLimit = Number(query.limit || DEFAULT_LIMIT);

return {
page: Number.isSafeInteger(page)
? Math.min(Math.max(page, 1), MAX_PAGE)
: DEFAULT_PAGE,

limit: Number.isSafeInteger(requestedLimit)
  ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT)
  : DEFAULT_LIMIT

};
}

/**

* Build only the filters supported by the public discovery API.
    */
    function getPublicFilters(query) {
    const pagination = getPagination(query);

return {
...pagination,
search: query.search,
category: query.category,
employmentType: query.employmentType,
workplace: query.workplace,
experienceLevel: query.experienceLevel,
country: query.country,
state: query.state,
city: query.city,
organizationId: query.organizationId,
sortBy: query.sortBy || "createdAt",
sortOrder: query.sortOrder || "desc"
};
}

/**

* A service may return null when a record is missing or not accessible.
* Treat both cases identically to avoid disclosing record existence.
    */
    function handleMissingResult(res, result) {
    if (result === null || result === undefined) {
    notFound(res);
    return true;
    }

return false;
}

/* ––––––––––––––––––––––––––––––––––––– /
/ Shared JSON Schema fragments                                               /
/ ––––––––––––––––––––––––––––––––––––– */

const schema = (definition) => ({
$schema: DIALECT,
...definition
});

const stringField = (minLength, maxLength) => ({
type: "string",
minLength,
maxLength
});

const arrayOfStrings = ({
maxItems = 100,
maxLength = 1000,
minLength = 2,
uniqueItems = false
} = {}) => ({
type: "array",
maxItems,
uniqueItems,
items: {
type: "string",
minLength,
maxLength
}
});

const locationSchema = {
type: "object",
additionalProperties: false,
properties: {
country: stringField(1, 100),
countryCode: {
type: "string",
pattern: "^[A-Z]{2}$"
},
state: stringField(1, 100),
city: stringField(1, 100),
district: stringField(1, 100),
postalCode: stringField(1, 20)
}
};

const salarySchema = {
type: "object",
additionalProperties: false,
properties: {
minimum: {
type: "number",
minimum: 0,
maximum: 1000000000000
},
maximum: {
type: "number",
minimum: 0,
maximum: 1000000000000
},
currency: {
type: "string",
pattern: "^[A-Z]{3}$"
},
period: {
type: "string",
enum: SALARY_PERIODS
},
negotiable: {
type: "boolean"
},
disclosed: {
type: "boolean"
}
}
};

const organizationSchema = {
type: "object",
additionalProperties: false,
properties: {
name: stringField(2, 200),
type: {
type: "string",
enum: ORGANIZATION_TYPES
},
website: {
type: "string",
format: "uri",
maxLength: 2048
},
description: stringField(0, 2000)
},
required: ["name"]
};

const applicationFields = {
applicationMethod: {
type: "string",
enum: APPLICATION_METHODS
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
applicationInstructions: stringField(0, 5000),
applicationDeadline: {
type: "string",
format: "date-time"
}
};

/* ––––––––––––––––––––––––––––––––––––– /
/ Route parameter schemas                                                    /
/ ––––––––––––––––––––––––––––––––––––– */

const jobIdSchema = schema({
type: "object",
additionalProperties: false,
properties: {
jobId: {
type: "string",
pattern: ID_PATTERN
}
},
required: ["jobId"]
});

const jobSlugSchema = schema({
type: "object",
additionalProperties: false,
properties: {
slug: {
type: "string",
minLength: 1,
maxLength: 180,
pattern: SLUG_PATTERN
}
},
required: ["slug"]
});

/* ––––––––––––––––––––––––––––––––––––– /
/ Query schemas                                                              /
/ ––––––––––––––––––––––––––––––––––––– */

const listJobsSchema = schema({
type: "object",
additionalProperties: false,
properties: {
page: {
type: "string",
pattern: "^[1-9]{0,5}$"
},
limit: {
type: "string",
pattern: "^[1-9]{0,2}$"
},
search: stringField(1, 150),
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
country: stringField(1, 100),
state: stringField(1, 100),
city: stringField(1, 100),
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
});

const myJobsQuerySchema = schema({
type: "object",
additionalProperties: false,
properties: {
page: {
type: "string",
pattern: "^[1-9]{0,5}$"
},
limit: {
type: "string",
pattern: "^[1-9]{0,2}$"
},
search: stringField(1, 150),
status: {
type: "string",
enum: JOB_STATUSES
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
});

/* ––––––––––––––––––––––––––––––––––––– /
/ Create and update schemas                                                  /
/ ––––––––––––––––––––––––––––––––––––– */

const jobContentProperties = {
title: stringField(3, 200),
description: stringField(20, 20000),
summary: stringField(0, 500),

category: {
type: "string",
enum: CATEGORIES
},

department: stringField(0, 150),

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
location: locationSchema,
salary: salarySchema,

requirements: arrayOfStrings({
maxItems: 100,
maxLength: 1000
}),

responsibilities: arrayOfStrings({
maxItems: 100,
maxLength: 1000
}),

qualifications: arrayOfStrings({
maxItems: 100,
maxLength: 1000
}),

skills: arrayOfStrings({
maxItems: 100,
maxLength: 100,
minLength: 1,
uniqueItems: true
}),

benefits: arrayOfStrings({
maxItems: 50,
maxLength: 300,
minLength: 0
}),

openings: {
type: "integer",
minimum: 1,
maximum: 100000
},

...applicationFields,

tags: arrayOfStrings({
maxItems: 30,
maxLength: 50,
minLength: 1,
uniqueItems: true
})
};

const applicationMethodRules = [
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
];

const createJobSchema = schema({
type: "object",
additionalProperties: false,
properties: {
...jobContentProperties,

slug: {
  type: "string",
  minLength: 1,
  maxLength: 180,
  pattern: SLUG_PATTERN
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
allOf: applicationMethodRules
});

const updateJobSchema = schema({
type: "object",
additionalProperties: false,
minProperties: 1,
properties: jobContentProperties,
allOf: applicationMethodRules
});

/**

* Deliberately excludes status, owner/recruiter IDs, approval fields,
* featured flags, moderation notes, and audit timestamps.
    */
    const reviewJobSchema = schema({
    type: "object",
    additionalProperties: false,
    properties: {
    decision: {
    type: "string",
    enum: ["approve", "reject"]
    },
    reason: stringField(0, 3000)
    },
    required: ["decision"]
    });

/* ––––––––––––––––––––––––––––––––––––– /
/ Public discovery routes                                                    /
/ Keep static paths above /:jobId.                                          /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* GET /api/jobs/featured
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

* GET /api/jobs/slug/:slug
    */
    router.get(
    "/slug/:slug",
    validateParams(jobSlugSchema),
    asyncHandler(async (req, res) => {
    const result = await serviceMethod("getPublishedJobBySlug")({
    slug: req.params.slug
    });
    if (handleMissingResult(res, result)) {
    return;
    }
    return success(
    res,
    result,
    "Job retrieved successfully."
    );
    })
    );

/**

* GET /api/jobs
    */
    router.get(
    "/",
    validateQuery(listJobsSchema),
    asyncHandler(async (req, res) => {
    const result = await serviceMethod("listPublishedJobs")({
    filters: getPublicFilters(req.query)
    });
    return success(
    res,
    result,
    "Jobs retrieved successfully."
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Employer management routes                                                /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* GET /api/jobs/manage/mine
* The service must derive ownership from req.user and must not rely
* on an owner ID supplied in the query string.
    */
    router.get(
    "/manage/mine",
    authenticate,
    authorize("jobs:read-own"),
    validateQuery(myJobsQuerySchema),
    asyncHandler(async (req, res) => {
    const result = await serviceMethod("listMyJobs")({
    user: req.user,
    filters: {
    ...getPagination(req.query),
    search: req.query.search,
    status: req.query.status,
    sortBy: req.query.sortBy || "createdAt",
    sortOrder: req.query.sortOrder || "desc"
    }
    });
    return success(
    res,
    result,
    "Your jobs retrieved successfully."
    );
    })
    );

/**

* POST /api/jobs
* New listings are created as drafts. Ownership and status must be
* assigned by the service, never from client-controlled fields.
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
    return success(
    res,
    result,
    "Job created successfully.",
    201
    );
    })
    );

/**

* PATCH /api/jobs/:jobId
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
    if (handleMissingResult(res, result)) {
    return;
    }
    return success(
    res,
    result,
    "Job updated successfully."
    );
    })
    );

/**

* POST /api/jobs/:jobId/publish
* This requests publication. It does not grant approval.
* The service decides whether immediate publication or moderation
* is required by the application’s policy.
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
    if (handleMissingResult(res, result)) {
    return;
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
    if (handleMissingResult(res, result)) {
    return;
    }
    return success(
    res,
    result,
    "Job closed successfully."
    );
    })
    );

/**

* DELETE /api/jobs/:jobId
* The service should implement a soft-delete/archive policy where
* required for auditability and job-application record integrity.
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
    if (handleMissingResult(res, result)) {
    return;
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

/* ––––––––––––––––––––––––––––––––––––– /
/ Administrative moderation                                                  /
/ ––––––––––––––––––––––––––––––––––––– */

/**

* POST /api/jobs/:jobId/review
* Moderation must be authorized, ownership-independent, and audited.
* The service must validate allowed status transitions and ensure that
* the moderator cannot approve an invalid or ineligible listing.
    */
    router.post(
    "/:jobId/review",
    authenticate,
    authorize("jobs:moderate"),
    validateParams(jobIdSchema),
    validateBody(reviewJobSchema),
    asyncHandler(async (req, res) => {
    const result = await serviceMethod("reviewJob")({
    user: req.user,
    jobId: req.params.jobId,
    decision: req.body.decision,
    reason: req.body.reason
    });
    if (handleMissingResult(res, result)) {
    return;
    }
    return success(
    res,
    result,
    "Job moderation completed successfully."
    );
    })
    );

/* ––––––––––––––––––––––––––––––––––––– /
/ Export                                                                     /
/ ––––––––––––––––––––––––––––––––––––– */

module.exports = router;