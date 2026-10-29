MedOrbits API Schemas

File: /api/schemas/README.md
Project: MedOrbits
Runtime: Node.js 20+
Schema standard: JSON Schema Draft 2020-12
Validation library: Ajv with Draft 2020-12 support
Purpose: Define, validate, and maintain consistent API data contracts.

⸻

1. Overview

The /api/schemas/ directory contains JSON Schema definitions used to validate data accepted and processed by the MedOrbits API.

Schemas establish a contract between frontend forms, API routes, middleware, controllers, services, background workers, and database operations.

They define:

* Required fields and permitted properties.
* Data types, formats, and value constraints.
* Accepted enumerations and nested object structures.
* Reusable definitions through $defs and $ref.
* Request and response data structures.
* Structural restrictions on untrusted input.

Important: JSON Schema validation does not replace authentication, authorization, business-rule validation, database constraints, file-security checks, or privacy controls.

2. Directory structure

The following structure reflects the files identified during MedOrbits development. Verify the actual repository before importing or referencing schemas.

api/
└── schemas/
    ├── README.md
    ├── career.schema.json
    ├── colleges.schema.json
    ├── common.schema.json
    ├── document.schema.json
    ├── jobs.schema.json
    ├── live-notifications.schema.json
    ├── notification.schema.json
    ├── pagination.schema.json
    ├── application.schema.json
    ├── job.schema.json
    └── user.schema.json

The listed filenames do not guarantee that each file has valid content or compiles successfully.

Other schemas, such as application.schema.json, may exist or be added later. Check the repository before creating duplicate contracts.

Schema responsibilities

File	Intended responsibility
application.schema.json	Application submissions and education/admission application data
application.schema.json	Alternative application schema filename, if retained
job.schema.json	Job-posting data using the singular naming convention
jobs.schema.json	Job listings, employment information, and recruitment opportunities
user.schema.json	Core user and account data
common.schema.json	Shared identifiers, pagination metadata, errors, and common definitions
document.schema.json	Document metadata, verification, and storage references
notification.schema.json	Notifications, delivery metadata, and recipient-facing messages
live-notifications.schema.json	Live notification event payloads, if implemented
pagination.schema.json	Pagination, sorting, searching, and filtering parameters
career.schema.json	Career resources and career-related data, if implemented
colleges.schema.json	College and institution data, if implemented

These descriptions document intended responsibilities, not verified implementation status.

3. Filename and reference conventions

The repository currently uses both .schema.json and .schema.json naming conventions.

The conventional spelling is .schema.json. However, renaming existing files without updating imports and references can break the application.

Until the repository is standardized:

1. Preserve existing filenames when modifying their contents.
2. Ensure every $id identifies the intended schema.
3. Check every local $ref and filesystem import.
4. Update tests and middleware when filenames change.
5. Avoid duplicate schemas that define conflicting versions of the same contract.

Example reference:

{
  “$ref”: “./common.schema.json#/$defs/identifier”
}

The referenced file must exist at the resolved location and contain the requested definition.

Plan a controlled migration to .schema.json once imports, $id values, tests, and API references have been identified.

4. Schema design standards

Where appropriate, each schema should define:

* $schema: JSON Schema dialect.
* $id: Stable, unique schema identifier.
* title: Human-readable schema name.
* description: Purpose and intended usage.
* type: Expected data type.
* properties: Supported object properties.
* required: Mandatory fields.
* additionalProperties: Whether unspecified properties are permitted.
* $defs: Reusable definitions.
* $ref: References to existing definitions.
* Constraints: lengths, numeric bounds, formats, patterns, enumerations, and array limits.

Example:

{
  “$schema”: “https://json-schema.org/draft/2020-12/schema”,
  “$id”: “https://medorbits.in/api/schemas/example.schema.json”,
  “title”: “Example Schema”,
  “description”: “Example request contract.”,
  “type”: “object”,
  “additionalProperties”: false,
  “required”: [“id”],
  “properties”: {
    “id”: {
      “type”: “string”,
      “minLength”: 1,
      “maxLength”: 128
    }
  }
}

Use additionalProperties: false for strict request objects when appropriate. Do not apply it indiscriminately to extensible metadata.

Separate request schemas, administrative schemas, database models, and public response schemas when their permitted properties differ.

5. Application schema

Primary file: /api/schemas/application.schema.json

The application schema should validate education, admissions, counselling, study-abroad, career-guidance, and consultancy application payloads.

Depending on the application type, supported information may include:

* Applicant name and contact information.
* Education history and qualifications.
* Course and admission preferences.
* Admission year and entrance examination details.
* Application-specific budget and notes.
* References to securely uploaded documents.
* Contact preferences and consent information.

Required fields and enumerations must match the implemented application workflow.

Keep server-managed fields, such as internal ownership, approval decisions, audit metadata, privileged roles, and workflow status, separate from applicant-editable properties.

The service layer must validate cross-field business rules, including budget ranges, eligibility requirements, and workflow-specific conditions.

6. Job schemas

Files:

* /api/schemas/job.schema.json
* /api/schemas/jobs.schema.json

The singular and plural filenames must not be assumed to be interchangeable.

Document which file represents the canonical job record and which, if any, represents a collection or alternative contract.

Job data may include:

* Job title and description.
* Employment type and workplace arrangement.
* Employer and location.
* Compensation and benefits.
* Required qualifications and experience.
* Application instructions and deadlines.
* Publication and moderation status.

The API must independently authorize job creation, editing, approval, featuring, publication, and closure.

Validate salary ranges, date chronology, and other cross-field conditions in the service layer.

7. User schema

File: /api/schemas/user.schema.json

The user schema should describe the intended user data contract.

Possible properties include:

* Basic profile information.
* Email and contact details.
* Preferences and consent metadata.
* Account lifecycle information.
* Verification metadata, where appropriate.

Use dedicated registration, profile-update, administrative-update, and response schemas instead of exposing one unrestricted account schema to all endpoints.

Never allow an ordinary user to modify privileged account fields through a request.

Sensitive fields, including password hashes, authentication secrets, private verification data, and internal security metadata, must not appear in ordinary API responses.

8. Common schema

File: /api/schemas/common.schema.json

The common schema provides reusable definitions for shared API structures.

Potential reusable definitions include:

* Identifiers and timestamps.
* Email addresses and URLs.
* Pagination metadata.
* API error responses.
* Validation errors.
* Common status values.
* Audit metadata.
* Sort directions.
* Extensible metadata.

Use $defs for reusable definitions and reference them consistently.

A definitions library does not automatically validate all API responses. Define separate response schemas or reference the appropriate $defs entries.

When using a local $ref, confirm that the validator can resolve the referenced file and definition.

9. Document schema

File: /api/schemas/document.schema.json

The document schema describes metadata associated with securely uploaded files.

It may cover:

* Document identifiers and ownership.
* Associated application references.
* Document type.
* Original filename and private storage key.
* MIME type, file size, and checksum.
* Upload and verification status.
* Malware-scan status.
* Access policies and retention metadata.

Schema validation does not establish that a file is safe.

The upload service must independently:

1. Enforce request and file-size limits.
2. Validate actual file content rather than trusting the extension.
3. Allow only explicitly supported file types.
4. Scan uploaded files using the configured security process.
5. Store documents outside publicly accessible directories or in private object storage.
6. Generate storage keys and checksums on the server.
7. Verify document ownership and authorization for every access.
8. Apply retention and deletion policies.

Do not expose private storage keys as public download URLs.

10. Notification schemas

Files:

* /api/schemas/notification.schema.json
* /api/schemas/live-notifications.schema.json

The standard notification schema may define notification content, priority, status, actions, delivery metadata, and related resource references.

The live-notifications schema should describe real-time event payloads if the application implements WebSockets, server-sent events, or another event-delivery mechanism.

Keep persistent notification records separate from transport-specific event messages where appropriate.

For multi-recipient notifications, maintain recipient-specific read status and delivery status. A single shared read field must not represent the read state of multiple users.

Authorize notification creation and broadcasts. Validate action URLs and reject unsafe URL schemes.

11. Pagination schema

File: /api/schemas/pagination.schema.json

The pagination schema defines accepted parameters for listing endpoints.

Supported parameters may include:

* page: One-based page number.
* limit: Number of records per page.
* sortBy: Requested sort field.
* sortOrder: Ascending or descending.
* search: Search term.
* filters: Endpoint-specific filter values.
* fields: Requested response fields, where supported.
* includeTotal: Whether to return total record counts.

The documented maximum page size is 100 records. Enforce the same maximum in the API.

Query-string conversion

Query parameters normally arrive as strings. Convert and validate them before executing queries.

Example:

GET /api/jobs?page=2&limit=20&sortOrder=desc

The middleware should parse page and limit as integers, apply configured defaults, and reject invalid or out-of-range values.

JSON Schema’s default keyword documents an intended default; it does not automatically populate missing values.

SQL safety

Never interpolate user-supplied sortBy, fields, or filter names directly into SQL.

Use endpoint-specific allowlists for:

* Sortable fields.
* Selectable fields.
* Filter keys.
* Filter operators.
* Accepted filter values.

Use parameterized queries for values.

12. Request-validation lifecycle

Recommended processing flow:

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
Response Serialization
        |
        v
API Response

The actual middleware order must match the application’s route architecture and security requirements.

Public endpoints may have different authentication requirements. Authorization and ownership checks must remain independent of schema validation.

Reject invalid requests before relevant persistence operations. Unexpected schema-loading or compilation failures must not cause validation to be silently skipped.

13. Ajv integration

Ajv supports JSON Schema Draft 2020-12 through its dedicated implementation.

Official documentation: Ajv

Install dependencies if they are not already present:

npm install ajv ajv-formats

The following is an illustrative CommonJS validator. Adapt the path and exported middleware to the existing MedOrbits architecture.

“use strict”;
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
const validateApplication = ajv.compile(applicationSchema);
function validateApplicationPayload(req, res, next) {
  if (!validateApplication(req.body)) {
    const errors = (validateApplication.errors || []).map(
      (error) => ({
        path: error.instancePath,
        keyword: error.keyword,
        message: error.message
      })
    );
    // Send a generic message to the client.
    // Route diagnostics through the approved server logger.
    req.validationDiagnostics = errors;
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

Integration notes

* This example assumes CommonJS and that the schema file is in the same directory as the validator module.
* If middleware resides in /api/middleware/, resolve schema paths relative to the actual directory structure.
* Use the exact filename present in the repository.
* Compile schemas once during initialization or through a controlled cache.
* Use a dedicated validator instance for Draft 2020-12.
* Enable and test format validation.
* Ensure invalid requests stop before the controller or service executes.
* Route unexpected errors through centralized error handling.
* Do not return submitted values, stack traces, or sensitive diagnostic data to clients.

Do not copy this example into production without verifying the existing middleware exports, route definitions, module system, and error-handling conventions. Local $ref resolution also requires a deliberate schema-loading strategy; parsing a single file does not automatically make every external reference resolvable.

14. Validation standards

Required fields

A property is not mandatory simply because it appears under properties. Use required when field presence is necessary.

Types and formats

Supported JSON types include:

* string
* number
* integer
* boolean
* object
* array
* null, when explicitly permitted

Use appropriate constraints such as minLength, maxLength, pattern, format, enum, minimum, maximum, minItems, and maxItems.

Formats such as date, date-time, email, uri, and uuid must be tested against the validator configuration. Format declarations may otherwise act as annotations rather than enforced assertions.

Cross-field validation

Some business rules require conditional schema keywords or service-layer checks.

Examples include:

* Minimum compensation must not exceed maximum compensation.
* An end year must not precede a start year.
* A deadline must comply with the relevant workflow.
* A document must belong to the applicant or application.
* A job must be approved before publication.

Enforce such rules in the appropriate domain or service layer, even if a schema also expresses part of the constraint.

15. Error-response conventions

Use a consistent API error format.

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

Never expose internal stack traces, database errors, tokens, or sensitive submitted values in production responses.

16. Security requirements

Schema validation is one layer of input protection.

The API must also:

* Validate untrusted input on the server.
* Enforce authentication and authorization independently.
* Allowlist writable fields for each operation.
* Verify ownership before accessing private resources.
* Apply request-size and upload-size limits.
* Validate uploaded file contents.
* Avoid logging credentials, tokens, or unnecessary personal information.
* Use database constraints and transactions for data integrity.
* Load schemas only from trusted application locations.
* Avoid resolving filesystem paths from untrusted values.
* Avoid treating schema validity as permission to perform an operation.

Never allow a client to set privileged fields merely because those fields exist in a database model or another schema.

17. Schema testing requirements

Every schema should have positive and negative tests.

* [ ]	Valid payloads pass.
* [ ]	Missing required fields fail.
* [ ]	Invalid data types fail.
* [ ]	Out-of-range values fail.
* [ ]	Invalid enum values fail.
* [ ]	Unsupported properties fail where strict validation is enabled.
* [ ]	Nested objects and arrays are validated.
* [ ]	Optional fields behave as documented.
* [ ]	Conditional constraints behave as intended.
* [ ]	Invalid requests do not trigger database writes.
* [ ]	Required schema references resolve.
* [ ]	All schemas compile with the configured validator.
* [ ]	Validation errors use the documented response format.
* [ ]	Authorization tests prevent unauthorized field changes.
* [ ]	Sensitive information is not exposed in errors or logs.

Automated checks

The schema test suite should:

1. Enumerate the intended schema files.
2. Parse every schema as JSON.
3. Verify Draft 2020-12 compatibility.
4. Compile each schema.
5. Resolve local references.
6. Test representative valid and invalid payloads.
7. Run API integration tests against the actual routes.
8. Fail the build if a required schema is missing or invalid.

Successful JSON parsing alone does not prove that a schema compiles or matches the API implementation.

18. Versioning and compatibility

Treat schemas as API contracts.

Before modifying a schema:

1. Identify every route, middleware, controller, service, and worker that uses it.
2. Review frontend payload compatibility.
3. Check database constraints and migrations.
4. Update tests and API documentation.
5. Assess the effect of changing optional fields to required fields.
6. Introduce API versioning or a migration plan for breaking changes.
7. Keep $id values stable and unique.

Do not create duplicate schemas without documenting which contract is canonical and why the other version is retained.

19. Related project files

File	Responsibility
/api/middleware/validation.js	Request-validation integration
/api/middleware/error-handler.js	Centralized error handling
/api/routes/	API route definitions
/api/services/application-service.js	Application business logic
/api/services/audit-service.js	Audit operations
/api/openapi.yaml	API documentation
/api/worker.js	Background processing

The directory spelling middleware is retained to match the supplied project structure. Verify the repository before renaming it or changing imports.

20. Official references

* JSON Schema documentation
* JSON Schema specification
* JSON Schema learning resources
* Ajv documentation

21. Production-readiness checklist

* [ ]	Required schema files exist.
* [ ]	JSON files parse successfully.
* [ ]	Schemas use the intended dialect.
* [ ]	Schemas compile with the configured validator.
* [ ]	Local references resolve correctly.
* [ ]	Routes use the intended schemas.
* [ ]	Invalid requests are rejected before persistence.
* [ ]	Authorization and business rules are independently enforced.
* [ ]	Privileged fields cannot be changed through unauthorized endpoints.
* [ ]	Error responses follow the API contract.
* [ ]	Automated tests pass.
* [ ]	Schema changes are reviewed for compatibility.
* [ ]	Sensitive data and secrets are excluded from committed examples.
* [ ]	Documentation matches implemented routes and contracts.

⸻

Maintenance note: This README documents the intended schema architecture. Verify actual schema contents, validator settings, middleware exports, filenames, and route integrations before treating any recommendation as verified implementation behavior.