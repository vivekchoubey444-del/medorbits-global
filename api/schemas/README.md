MedOrbits API Schemas

File: /api/schemas/README.md
Project: MedOrbits
Runtime: Node.js 20+
Schema standard: JSON Schema Draft 2020-12
Purpose: Define, validate, version, and maintain consistent API data contracts.

⸻

1. Overview

The api/schemas/ directory contains JSON Schema definitions used to describe and validate the structure of data accepted or processed by the MedOrbits API.

Schemas establish a common contract between frontend forms, API routes, middleware, controllers, services, background workers, and database operations.

They help ensure that incoming payloads conform to expected data types, required fields, permitted values, and structural constraints before business logic processes them.

Important: Schema validation does not replace authentication, authorization, business-rule validation, database constraints, file-security checks, or privacy controls.

2. Directory structure

The following structure represents the intended organization of the schema directory. Verify actual files in the repository before importing them.

api/
└── schemas/
    ├── README.md
    ├── application.schema.json
    ├── job.schema.json
    ├── user.schema.json
    ├── user.schema-2.json
    ├── common.schema.json
    ├── document.schema.json
    ├── notification.schema.json
    └── pagination.schema.json

Responsibilities:

File	Responsibility
application.schema.json	Application submission and application data
job.schema.json	Job postings and employment information
user.schema.json	Core account and user-profile data
user.schema-2.json	Extended professional, student, and career profiles
common.schema.json	Reusable definitions shared across schemas
document.schema.json	Document metadata and related references
notification.schema.json	Notification payloads
pagination.schema.json	Pagination parameters and response metadata

Only files confirmed to exist in the repository should be treated as implemented. Additional schemas must be created and tested before they are imported or referenced.

Naming convention

Use lowercase filenames ending in .schema.json. Use hyphens for descriptive multiword names.

Prefer a clear distinction between core account data and extended profile data. The suffix -2 should not become a permanent versioning convention for public API contracts; use explicit schema versions or API versioning when compatibility requires separate contracts.

3. Schema design requirements

Every schema should define, where appropriate:

* $schema — identifies the JSON Schema dialect.
* $id — provides a stable, unique schema identifier.
* title and description — explain the schema’s purpose.
* type — defines the expected data type.
* properties — specifies supported object fields.
* required — specifies mandatory fields.
* Constraints — enforce appropriate structural and value restrictions.
* $defs and $ref — reuse definitions when supported by the validator configuration.

Use additionalProperties: false for request objects where strict field allowlisting is appropriate. Avoid blindly applying it to extensible metadata or objects that legitimately support additional fields.

Keep request schemas separate from database models and response schemas when their permitted fields differ.

4. Application schema

Primary file: /api/schemas/application.schema.json

The application schema should define the accepted structure of application submissions, including relevant categories such as:

* Applicant information.
* Contact information.
* Course and admission preferences.
* Application references.
* Supporting document metadata.
* Submission-related information.

These are recommended categories, not confirmation of the current implementation’s exact fields.

Keep server-managed fields, such as internal ownership, privileged status, audit metadata, review decisions, and workflow state, separate from user-editable fields.

Never permit clients to set privileged values merely because those fields exist in a database model.

5. Job schema

File: /api/schemas/job.schema.json

The job schema defines job-posting data, which may include:

* Job title and description.
* Employment type and workplace arrangement.
* Organization and location.
* Compensation and benefits.
* Qualifications, skills, and experience.
* Application instructions and deadlines.
* Publication and moderation metadata.

Publishing, featuring, approving, or closing a job must be controlled by authorized server-side workflows.

Validate compensation ranges, deadline chronology, and other cross-field business rules in the service layer.

6. User schemas

6.1 Core user schema

File: /api/schemas/user.schema.json

The core schema describes account-level information, such as:

* Email and contact details.
* Account role and status.
* Basic profile information.
* Preferences and consent metadata.
* Verification state.
* Account lifecycle timestamps.

Use dedicated registration, update, administrative, and response schemas rather than exposing the full account schema directly to every endpoint.

6.2 Extended user schema

File: /api/schemas/user.schema-2.json

The extended schema supports additional profile information, such as:

* Education history.
* Professional qualifications.
* Student and institution information.
* Career preferences.
* Skills and certifications.
* Accessibility and notification preferences.
* Profile visibility settings.
* Document-verification metadata.

Treat professional registration numbers, student identifiers, education records, and verification information as potentially sensitive data.

Restrict their access according to authorization policies and business requirements.

6.3 User-data security

Never expose password hashes, authentication secrets, private verification details, or internal security metadata in ordinary API responses.

Fields such as role, roles, accountStatus, passwordHash, verification, and security must be controlled by trusted server-side operations.

A schema containing a field does not authorize the caller to modify it.

7. Request-validation lifecycle

Recommended request-processing flow:

Incoming API Request
        |
        v
Request Parsing and Size Limits
        |
        v
Authentication, Where Required
        |
        v
Authorization and Ownership Checks
        |
        v
JSON Schema Validation
        |
        v
Business-Rule Validation
        |
        v
Application Service
        |
        v
Database Transaction
        |
        v
Response Validation and Serialization
        |
        v
API Response

The precise middleware order must follow the existing route architecture and security requirements. Public endpoints may use a different authentication policy.

Apply schema validation before the relevant service persists untrusted data.

Authorization and ownership checks must remain independent of schema validation. Avoid relying on validation order alone to protect privileged resources.

8. Validation middleware integration

The validation middleware should load trusted local schemas and validate the relevant request component.

Illustrative Express integration:

router.post(
  “/applications”,
  authenticate,
  validateApplication,
  applicationController.create
);

The middleware and controller names above are examples. Use the actual exports and route definitions in the repository.

The implementation should:

1. Load schemas from trusted application files.
2. Use a validator that supports Draft 2020-12.
3. Compile schemas during initialization or through a controlled caching mechanism.
4. Validate request bodies, parameters, and query strings where required.
5. Return controlled client errors for invalid input.
6. Avoid exposing submitted values, stack traces, or sensitive diagnostic information.
7. Forward unexpected operational and programming errors to the centralized error handler.
8. Fail safely if a required schema cannot be loaded or compiled.

Do not silently bypass validation when a schema is unavailable.

9. Recommended validator: Ajv

Ajv supports JSON Schema Draft 2020-12 through its dedicated 2020-12 implementation.

Official documentation: https://ajv.js.org/

Install the dependencies if they are not already present:

npm install ajv ajv-formats

Example CommonJS implementation:

const fs = require(“node:fs”);
const path = require(“node:path”);
const Ajv2020 = require(“ajv/dist/2020”).default;
const addFormats = require(“ajv-formats”);
const ajv = new Ajv2020({
  allErrors: true,
  strict: true
});
addFormats(ajv);
const schemaPath = path.join(
  __dirname,
  “application.schema.json”
);
const applicationSchema = JSON.parse(
  fs.readFileSync(schemaPath, “utf8”)
);
const validateApplication = ajv.compile(
  applicationSchema
);
function validateApplicationPayload(req, res, next) {
  const valid = validateApplication(req.body);
  if (!valid) {
    const errors = (
      validateApplication.errors || []
    ).map((error) => ({
      path: error.instancePath,
      keyword: error.keyword,
      message: error.message
    }));
    return res.status(400).json({
      success: false,
      error: {
        code: “VALIDATION_ERROR”,
        message: “The submitted data is invalid.”
      }
    });
  }
  return next();
}
module.exports = validateApplicationPayload;

Implementation notes:

* This is an illustrative module, not a replacement for an existing validator or route integration.
* The example assumes CommonJS and that the schema file resides alongside the module. Adjust paths to match the actual project.
* The errors array is prepared for server-side diagnostics but is deliberately not returned to the client.
* Add sanitized diagnostics to the application’s approved logging mechanism if required.
* Compile and cache each schema instead of recompiling it for every request.
* Test the configuration against the project’s actual schemas before enabling it in production.

10. JSON Schema design standards

Required fields

A field listed under properties is not automatically mandatory. Use required to enforce field presence.

Data types

Supported JSON types include:

* string
* number
* integer
* boolean
* object
* array
* null, when explicitly permitted

JSON Schema does not automatically guarantee that incoming strings are converted into numbers or that values are normalized.

String constraints

Use appropriate combinations of:

* minLength
* maxLength
* pattern
* format
* enum

Configure and test format validation explicitly. A format may act as an annotation unless the validator is configured to assert it.

Numeric constraints

Use:

* minimum
* maximum
* exclusiveMinimum
* exclusiveMaximum
* multipleOf, when appropriate

Define reasonable bounds for numeric fields.

Array constraints

Use:

* items
* minItems
* maxItems
* uniqueItems, where uniqueness is required

Object constraints

Use:

* properties
* required
* additionalProperties
* patternProperties, when necessary
* dependentRequired, when dependencies between fields are necessary

Select constraints based on the actual API contract.

Cross-field validation

JSON Schema can express many conditional requirements, but ordinary field constraints do not automatically compare arbitrary values across fields.

Examples of business rules that may need additional validation include:

* Minimum compensation must not exceed maximum compensation.
* An education end year must not precede its start year.
* An application deadline must satisfy the relevant workflow’s date requirements.
* A user must own a record before modifying it.
* A job must be approved before publication.

Enforce these rules in the appropriate service or domain layer.

11. Security requirements

Schemas provide one layer of API input protection.

The following requirements also apply:

* Validate all untrusted input on the server.
* Never rely exclusively on frontend validation.
* Allowlist writable fields for each operation.
* Enforce authentication and authorization independently.
* Verify ownership before reading or modifying private records.
* Apply request-size and upload-size limits.
* Validate uploaded files using dedicated file-security controls.
* Avoid logging passwords, authentication tokens, private documents, or unnecessary personal information.
* Use database constraints and transactions for persistent data integrity.
* Load schemas only from trusted application locations.
* Avoid dynamically resolving user-controlled filesystem paths or schema identifiers.
* Configure validator options deliberately; avoid mutation of request payloads unless explicitly required and tested.

For document uploads, check actual file contents, permitted types, size, storage location, and access controls. A JSON schema cannot establish that an uploaded file is safe.

12. Error-response conventions

Use a consistent response structure for schema-validation failures.

Example:

{
  “success”: false,
  “error”: {
    “code”: “VALIDATION_ERROR”,
    “message”: “The submitted data is invalid.”
  }
}

Recommended HTTP status codes:

Status	Usage
400	Invalid request structure or payload
401	Missing or invalid authentication
403	Insufficient permissions
404	Resource not found
409	Conflicting application state
413	Request or upload too large
415	Unsupported content type
422	Semantically invalid data, if adopted consistently
500	Unexpected internal error

Choose one consistent policy for schema-validation failures, such as 400 or 422, and apply it across the API.

Never expose internal stack traces or sensitive submitted values in production error responses.

13. Schema versioning and compatibility

Treat schemas as API contracts.

Before modifying a schema:

1. Identify all endpoints, middleware, services, and workers that use it.
2. Check compatibility with existing frontend payloads.
3. Review existing database records and migrations.
4. Update relevant tests and API documentation.
5. Assess whether changing optional fields to mandatory fields would break clients.
6. Coordinate breaking changes with API versioning.
7. Preserve old contracts when supported clients depend on them.

Keep $id values stable and unique. Refactoring an implementation does not automatically require changing the schema identity.

Use user.schema-2.json as a distinct file only when its purpose is documented and its relationship to user.schema.json is explicit.

14. Testing requirements

Every schema should have positive and negative test cases.

Schema tests

* [ ]	Valid payloads pass validation.
* [ ]	Missing required fields fail.
* [ ]	Invalid field types fail.
* [ ]	Values outside defined bounds fail.
* [ ]	Invalid enumerated values fail.
* [ ]	Unsupported fields are rejected where strict validation is enabled.
* [ ]	Nested objects and arrays are validated.
* [ ]	Optional fields work as documented.
* [ ]	Conditional constraints behave as expected.
* [ ]	Invalid payloads do not trigger database writes.
* [ ]	Validation failures do not expose sensitive information.

Integration tests

* [ ]	Required schemas load successfully.
* [ ]	Schema compilation succeeds during initialization.
* [ ]	Intended routes invoke the correct validators.
* [ ]	Valid requests reach the controller or service.
* [ ]	Invalid requests return the documented error format.
* [ ]	Unexpected validator failures reach the centralized error handler.
* [ ]	Authorization checks prevent unauthorized field changes.
* [ ]	Existing API contracts remain compatible.

Automated validation

A schema-validation test suite should compile every required schema and run representative valid and invalid payloads.

Do not treat successful JSON parsing as proof that a schema is valid or compatible with the configured dialect.

15. Troubleshooting

Schema fails to load

Check the filename, JSON syntax, filesystem path, permissions, and module-loading conventions. Prefer paths resolved relative to the module or a defined application root rather than relying on the process’s current working directory.

Schema compilation fails

Verify that the $schema declaration matches the validator implementation and that all referenced definitions are available.

A valid payload is rejected

Inspect server-side validation diagnostics, compare the payload against the schema, and check required fields, enumerations, format settings, and strict property restrictions.

An invalid payload is accepted

Confirm that the intended route invokes the correct validator, that validation failures stop execution, and that the relevant constraints are enabled.

Schema changes break existing clients

Review field requirements, accepted values, nested object structures, and the compatibility of existing request formats. Introduce a migration or versioning strategy for breaking changes.

16. Related project files

File	Responsibility
api/schemas/application.schema.json	Application schema
api/schemas/job.schema.json	Job-posting schema
api/schemas/user.schema.json	Core user schema
api/schemas/user.schema-2.json	Extended user-profile schema
api/middlerware/validation.js	Request validation integration
api/middlerware/error-handler.js	Centralized error handling
api/routes/	API route definitions
api/services/application-service.js	Application business logic
api/services/audit-service.js	Audit operations
api/openapi.yaml	API endpoint documentation
api/worker.js	Background processing

The directory name middlerware is retained here to match the supplied project paths. Verify the actual repository structure before adding imports or changing directory names.

17. Official references

* JSON Schema documentation: https://json-schema.org/docs
* JSON Schema specification: https://json-schema.org/specification
* JSON Schema learning resources: https://json-schema.org/learn
* Ajv documentation: https://ajv.js.org/

18. Production-readiness checklist

* [ ]	All required schema files exist.
* [ ]	JSON files parse successfully.
* [ ]	All schemas use the intended JSON Schema dialect.
* [ ]	All schemas compile with the configured validator.
* [ ]	Routes use the correct schema definitions.
* [ ]	Invalid payloads are rejected before database writes.
* [ ]	Authorization and business rules are independently enforced.
* [ ]	Privileged fields cannot be changed through unauthorized endpoints.
* [ ]	Error responses follow the API contract.
* [ ]	Automated tests pass.
* [ ]	Schema changes are reviewed for compatibility.
* [ ]	Sensitive sample data and secrets are not committed.
* [ ]	API documentation matches the implemented routes and contracts.

⸻

Maintenance note: This document defines the intended schema architecture. Verify the actual contents of the schema files, validator configuration, middleware exports, and route implementations before treating any recommendation as verified implementation behavior.

End of documentation.