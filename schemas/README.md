
# MedOrbits — JSON Schema Registry

**Directory:** `/schemas/`  
**Purpose:** Define, document, and validate the structure of MedOrbits data records and API payloads.  
**Schema standard:** JSON Schema Draft 2020-12  
**Recommended encoding:** UTF-8  
**Content type:** `application/json`

—

## 1. Overview

The `/schemas/` directory contains reusable JSON Schema definitions for the structured data managed by MedOrbits, including educational institutions, courses, examinations, job listings, and applications.

Schemas provide a consistent contract between:

- Frontend forms and user interfaces.
- Backend API routes and services.
- Database persistence and data-transfer layers.
- Background workers and scheduled jobs.
- Automated tests and data-import processes.
- External integrations and administrative tools.

A schema describes the structure and constraints of data. It does not replace authorization, business rules, database constraints, or security controls.

## 2. Directory Structure

```text
schemas/
├── README.md
├── application.schema.json
├── college.schema.json
├── course.schema.json
├── exam.schema.json
└── job.schema.json
```

Keep this directory limited to canonical, reusable schema definitions and their documentation.

If the backend maintains a separate schema registry under `/api/schemas/`, establish one canonical source of truth or explicitly document how schemas are synchronized. Avoid independently maintained duplicate schemas that can drift out of agreement.

## 3. Schema Registry

| Schema | Intended record |
|—|—|
| `application.schema.json` | Applications, applicant details, application status, and document references |
| `college.schema.json` | Colleges, universities, locations, courses offered, recognition, fees, and admission information |
| `course.schema.json` | Course catalogue records, eligibility, duration, fees, and career information |
| `exam.schema.json` | Entrance examinations, eligibility, registration, schedules, results, and official resources |
| `job.schema.json` | Job listings, employment conditions, employer information, salary, and application instructions |

Refer to the individual schema files for their exact required properties, enums, nested definitions, and validation constraints.

## 4. Standard Schema Header

New schemas should use JSON Schema Draft 2020-12 and include a unique, stable `$id`.

Example:

```json
{
  “$schema”: “https://json-schema.org/draft/2020-12/schema”,
  “$id”: “https://medorbits.in/schemas/example.schema.json”,
  “title”: “Example Record”,
  “description”: “Validation contract for an example record.”,
  “type”: “object”,
  “additionalProperties”: false,
  “required”: [
    “id”,
    “name”
  ],
  “properties”: {
    “id”: {
      “type”: “string”,
      “minLength”: 1,
      “maxLength”: 100
    },
    “name”: {
      “type”: “string”,
      “minLength”: 1,
      “maxLength”: 200
    }
  }
}
```

This is an illustrative template, not a replacement for any existing MedOrbits schema.

### Header conventions

- `$schema` identifies the JSON Schema specification version.
- `$id` identifies the schema using a stable URI.
- `title` provides a human-readable name.
- `description` explains the schema’s purpose.
- `type` defines the expected JSON data type.
- `required` identifies mandatory properties.
- `properties` defines field-level constraints.
- `$defs` stores reusable nested definitions.
- `additionalProperties` controls whether unlisted properties are permitted.

Do not change an established `$id` casually. Treat changes to the validation contract as compatibility-sensitive changes.

## 5. Validation Rules

### 5.1 Required properties

Use `required` for fields that must be present in the specific data contract.

A field being required does not necessarily mean that its value must be non-empty. Use `minLength`, `minItems`, `minimum`, or other appropriate constraints where necessary.

### 5.2 Data types

Use explicit types whenever practical:

- `string` for names, identifiers, labels, and text.
- `integer` for whole-number counts.
- `number` for decimal quantities.
- `boolean` for true/false flags.
- `array` for ordered collections.
- `object` for structured records.
- `null` only where the contract explicitly permits it.

Do not treat an omitted field and a field containing `null` as equivalent unless the application contract explicitly defines that behavior.

### 5.3 Enumerations

Use `enum` for controlled values such as:

- Application statuses.
- Employment types.
- Course categories.
- Examination statuses.
- Publication and moderation states.

Keep enum values consistent across schemas, API responses, services, frontend controls, and database representations.

When an enum changes, review all consumers before deploying the update.

### 5.4 String formats

Use appropriate constraints for:

- Email addresses.
- Dates and timestamps.
- Absolute URLs.
- Currency codes.
- Identifiers and slugs.

For example:

```json
{
  “createdAt”: {
    “type”: “string”,
    “format”: “date-time”
  },
  “website”: {
    “type”: “string”,
    “format”: “uri”
  }
}
```

JSON Schema format validation may be annotation-only or assertion-enabled depending on the validator configuration. Configure the validator to assert formats when the application relies on them.

A valid URL format does not establish that a destination is trustworthy or safe to open.

### 5.5 Numeric and date constraints

Use `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `minItems`, and `maxItems` where appropriate.

Use `minLength` and `maxLength` for text fields that have defined size limits.

JSON Schema does not automatically enforce every relationship between two properties. For example, the following conditions may require application-level validation:

- Salary minimum must not exceed salary maximum.
- An application deadline must not conflict with relevant publication rules.
- A start date must follow an end date where required.
- A college reference must identify an existing catalogue record.
- Seat totals must agree with their constituent categories.

Implement these rules in the appropriate service or domain-validation layer.

## 6. Recommended Validator

Use a validator that supports JSON Schema Draft 2020-12. Ajv is one suitable option.

Install the dependencies if they are not already included in the project:

```bash
npm install ajv ajv-formats
```

Example validator utility:

```javascript
// src/js/utils/schema-validator.js
// Adapt this example to the project’s module system and schema-loading strategy.

import Ajv2020 from “ajv/dist/2020.js”;
import addFormats from “ajv-formats”;

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: true
});

addFormats(ajv);

export function compileSchema(schema) {
  if (!schema || typeof schema !== “object”) {
    throw new TypeError(“A valid JSON Schema object is required.”);
  }

  return ajv.compile(schema);
}

export function validateAgainstSchema(schema, data) {
  const validate = compileSchema(schema);
  const valid = validate(data);

  return {
    valid,
    errors: valid
      ? []
      : (validate.errors || []).map((error) => ({
          instancePath: error.instancePath,
          schemaPath: error.schemaPath,
          keyword: error.keyword,
          message: error.message,
          params: error.params
        }))
  };
}
```

### Validator integration notes

1. Load schemas from trusted, version-controlled project files.
2. Compile schemas once where practical rather than repeatedly for every request.
3. Cache compiled validators in long-running processes.
4. Handle invalid JSON separately from schema-validation failures.
5. Return safe, structured validation errors to clients.
6. Log diagnostic details internally without logging unnecessary personal information.
7. Add tests for both valid records and invalid edge cases.

If the project uses CommonJS rather than ES modules, adapt the imports and exports accordingly.

## 7. API Integration

Validate untrusted request bodies at the backend boundary before passing data to business services.

Recommended processing sequence:

1. Parse the incoming request.
2. Authenticate the caller where required.
3. Authorize access to the requested operation and resource.
4. Validate the request against the correct input schema.
5. Apply domain-specific and cross-field validation.
6. Execute the business operation.
7. Persist the validated data using database constraints and transactions where appropriate.
8. Record required audit events.
9. Return a documented response.

Use separate schemas for create, update, and response operations when their permissions or field requirements differ.

For example, a public application-submission request should not be able to set its own review status, approval decision, internal counsellor notes, or audit metadata.

Do not assume that a field is safe to accept simply because it exists in a general-purpose record schema.

## 8. Security Requirements

### Input validation

- Reject malformed or structurally invalid payloads.
- Enforce reasonable request-size and field-length limits.
- Validate nested objects and arrays.
- Reject unexpected properties where the contract requires a strict object shape.
- Normalize data only according to documented application rules.
- Never rely on frontend validation alone.

### Authorization and protected fields

JSON Schema validates data shape; it does not determine who may read or modify a record.

Apply explicit authorization rules to:

- Applicant information.
- Uploaded document references.
- Employer and job-management records.
- College and course publication controls.
- Application status transitions.
- Moderation decisions.
- Internal notes and audit information.

Keep server-managed fields under server control.

### Personal information

Application records may contain personal and educational information.

- Collect only information required for the stated purpose.
- Restrict access by role and ownership.
- Avoid exposing private fields in public catalogue responses.
- Do not log complete request bodies containing sensitive personal data.
- Apply appropriate retention and deletion policies.
- Store uploaded files outside publicly accessible locations and validate them independently.

### URLs and external resources

A `uri` or `uri-reference` constraint does not protect against malicious destinations.

Where external URLs are accepted:

- Permit only the protocols required by the application, typically `https:`.
- Reject unsafe schemes such as `javascript:`.
- Apply SSRF protections to any backend service that fetches user-supplied URLs.
- Validate redirects and destination hosts when server-side fetching is permitted.
- Do not treat a URL as an official source without verification.

## 9. Schema Versioning and Compatibility

Treat schema updates as API contract changes.

### Generally compatible changes

Subject to the application’s actual consumers:

- Adding an optional property.
- Adding a new reusable definition that is not yet required.
- Improving descriptions without changing validation behavior.
- Relaxing a constraint when all consumers support the expanded data.

### Potentially breaking changes

- Adding a newly required property.
- Removing or renaming a property.
- Narrowing an enum.
- Changing a property’s type.
- Tightening a constraint that rejects previously valid data.
- Changing nullability or the interpretation of an existing field.
- Changing a referenced schema’s behavior.

Before a breaking change:

1. Identify all API, frontend, worker, and database consumers.
2. Review existing persisted records.
3. Decide whether migration or backfilling is necessary.
4. Update validation tests and API documentation.
5. Deploy compatible consumers and producers in a controlled sequence.
6. Document the change and any migration requirements.

For substantial contract changes, introduce a versioned schema or API contract instead of silently changing behavior.

## 10. Testing Checklist

For each schema, test:

- A valid minimal record.
- A valid complete record.
- Missing required properties.
- Incorrect data types.
- Invalid enum values.
- Empty strings and boundary-length strings.
- Invalid dates, timestamps, email addresses, or URLs.
- Numeric minimum and maximum boundaries.
- Invalid nested objects and array entries.
- Unexpected properties.
- Explicit `null` values where relevant.
- Cross-field and domain rules implemented outside JSON Schema.
- Compatibility with representative existing records.

Example test outline:

```javascript
import { describe, expect, it } from “vitest”;
import { validateAgainstSchema } from “../src/js/utils/schema-validator.js”;
import exampleSchema from “../schemas/example.schema.json”;

describe(“Example schema”, () => {
  it(“accepts a valid record”, () => {
    const result = validateAgainstSchema(exampleSchema, {
      id: “example-001”,
      name: “Example Record”
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it(“rejects a record missing a required property”, () => {
    const result = validateAgainstSchema(exampleSchema, {
      id: “example-001”
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

This example assumes the project uses Vitest and supports JSON imports. Adjust it to the repository’s actual test runner and module configuration.

## 11. Continuous Integration

Run schema validation and automated tests as part of the CI pipeline.

Recommended checks:

- Parse every schema as valid JSON.
- Confirm the declared JSON Schema draft is supported.
- Compile each schema with strict validator settings.
- Validate representative fixtures.
- Test domain rules separately.
- Detect duplicate or conflicting schema identifiers.
- Check that documented schema paths resolve to actual files.
- Verify API documentation against the implemented request and response contracts.

A CI failure should block deployment when a schema is invalid or a required contract test fails.

## 12. Contribution Guidelines

When adding or modifying a schema:

1. Use the established naming convention: `<resource>.schema.json`.
2. Use Draft 2020-12 unless the project has an explicit compatibility requirement.
3. Provide a unique, stable `$id`.
4. Document the purpose and meaning of non-obvious fields.
5. Reuse `$defs` for repeated structures where appropriate.
6. Define enums and constraints explicitly.
7. Avoid embedding business logic that cannot be expressed reliably in JSON Schema.
8. Add or update positive and negative tests.
9. Review privacy and authorization implications.
10. Update API documentation and all dependent consumers.
11. Keep the canonical schema synchronized with the actual deployed API.
12. Document any breaking changes and migration requirements.

## 13. Operational Notes

- Schema validation does not sanitize HTML or prevent XSS by itself.
- Schema validation does not replace SQL parameterization or database constraints.
- Schema validation does not authorize access to a resource.
- Schema validation does not prove that an institution, employer, examination, or document is legitimate.
- External information should be verified against authoritative sources before publication.
- Catalogue records should include provenance and verification metadata where supported.
- Server-generated identifiers, timestamps, moderation decisions, and counters should not be trusted when supplied by clients.

## 14. Maintenance

Review the schema registry whenever:

- An API endpoint changes its request or response contract.
- A database model changes.
- A new course category, examination status, application state, or employment type is introduced.
- A privacy or security requirement changes.
- A schema validation defect is discovered.
- A new external integration is introduced.

Keep this README aligned with the files actually present in `/schemas/` and with the deployed API contract.

—

**Maintainer:** MedOrbits Engineering  
**Schema standard:** JSON Schema Draft 2020-12  
**Registry status:** Maintain in version control and validate in CI  
**Source of truth:** The canonical schema files used by the deployed backend
