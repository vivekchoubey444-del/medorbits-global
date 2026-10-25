
# MedOrbits — JSON Schema Registry

**Directory:** `/schemas/`  
**Purpose:** Define, document, and validate the structure of MedOrbits data records and API payloads.  
**Schema standard:** JSON Schema Draft 2020-12  
**Encoding:** UTF-8  
**Content type:** `application/json`  
**Maintainer:** MedOrbits Engineering  
**Registry status:** Version-controlled and validated in CI

—

## 1. Overview

The `/schemas/` directory contains canonical JSON Schema definitions for structured data managed by MedOrbits, including educational institutions, courses, examinations, job listings, and applications.

Schemas provide a consistent contract between:

- Frontend forms and user interfaces.
- Backend API routes, controllers, and services.
- Database persistence and data-transfer layers.
- Background workers and scheduled jobs.
- Automated tests and data-import processes.
- External integrations and administrative tools.

A schema defines data structure and constraints. It does not replace authorization, domain validation, database constraints, file validation, or other security controls.

## 2. Directory Structure

The canonical registry currently includes:

```text
schemas/
├── README.md
├── application.schema.json
├── college.schema.json
├── course.schema.json
├── exam.schema.json
├── job.schema.json
└── user-fixture.schema.json
```

`user-fixture.schema.json` is an optional test-support schema. Keep it only if the file exists in the repository. Fixture schemas must remain separate from production record schemas.

The directory should contain canonical, reusable schema definitions and their documentation. Keep test data in the fixture directory, not in the schema registry.

### Canonical source of truth

If the backend also maintains schemas under `/api/schemas/`, designate one directory as authoritative. Avoid maintaining two independent copies.

Recommended approach:

1. Keep `/schemas/` as the canonical registry.
2. Reference or package these schemas from the backend.
3. If `/api/schemas/` must contain copies, generate them from the canonical files.
4. Add CI checks that detect missing files, duplicate `$id` values, and unexpected differences.
5. Document any schemas that intentionally differ because they validate distinct API contracts.

Do not assume two schemas are interchangeable merely because they describe the same resource. A create-request schema, a database record schema, and a public response schema can legitimately have different fields and constraints.

## 3. Schema Registry

| Schema | Intended record |
|—|—|
| `application.schema.json` | Applications, applicant details, application status, and document references |
| `college.schema.json` | Colleges, universities, locations, courses offered, recognition, fees, and admission information |
| `course.schema.json` | Course catalogue records, eligibility, duration, fees, and career information |
| `exam.schema.json` | Entrance examinations, eligibility, registration, schedules, results, and official resources |
| `job.schema.json` | Job listings, employment conditions, employer information, salary, and application instructions |
| `user-fixture.schema.json` | Synthetic user fixtures for local development and automated testing only, if maintained |

Refer to each schema for its exact required properties, enums, nested definitions, and validation constraints.

## 4. Standard Schema Header

Every canonical schema should use JSON Schema Draft 2020-12 and include a unique, stable `$id`.

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

This is an illustrative template, not a replacement for an existing MedOrbits schema.

### Header conventions

- `$schema` identifies the JSON Schema specification version.
- `$id` provides a stable schema identifier.
- `title` provides a human-readable name.
- `description` explains the schema’s purpose.
- `type` defines the expected JSON data type.
- `required` identifies mandatory properties.
- `properties` defines field-level constraints.
- `$defs` stores reusable nested definitions.
- `additionalProperties` controls whether unlisted properties are allowed.

Do not change an established `$id` casually. Treat changes to validation behavior as compatibility-sensitive changes.

## 5. Validation Rules

### 5.1 Required properties

Use `required` for fields that must be present in a particular data contract.

A required field is not automatically non-empty or non-null. Apply constraints such as `minLength`, `minItems`, `minimum`, or an explicit non-null type where appropriate.

An omitted field and a field containing `null` are different states. Permit `null` only when the contract explicitly allows it.

### 5.2 Data types

Use explicit types wherever practical:

- `string` for names, identifiers, labels, and text.
- `integer` for whole-number counts.
- `number` for decimal quantities.
- `boolean` for true/false flags.
- `array` for ordered collections.
- `object` for structured records.
- `null` only where the contract explicitly permits it.

Avoid accepting multiple types solely for convenience. Document nullable and optional fields consistently across the schema, API, and database.

### 5.3 Enumerations

Use `enum` for controlled values such as application statuses, employment types, course categories, examination statuses, and publication states.

Keep enum values consistent across schemas, API responses, services, frontend controls, and database representations.

Before adding or removing an enum value, review all consumers. Do not silently change the meaning of an existing value.

### 5.4 String formats

Use appropriate constraints for email addresses, dates, timestamps, absolute URLs, currency codes, identifiers, and slugs.

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

Format validation may be annotation-only or assertion-enabled, depending on the validator and configuration. Configure the validator to assert supported formats when the application depends on them.

A syntactically valid URI does not establish that a destination is trustworthy, official, or safe to open. If a field requires an HTTP(S) URL, enforce the allowed protocols in addition to checking the URI format.

### 5.5 Numeric, date, and cross-field constraints

Use `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `minItems`, `maxItems`, `minLength`, and `maxLength` as appropriate.

JSON Schema does not generally compare the values of two separate properties. Enforce cross-field and domain rules in the relevant application service.

Examples include:

- Salary minimum must not exceed salary maximum.
- A start date must precede an end date when required.
- A college reference must identify an existing catalogue record.
- Seat totals must agree with their constituent categories.
- An active course must satisfy the application’s duration rules.
- An approved application must satisfy the required review workflow.

Do not claim a schema enforces these relationships unless the chosen validation design actually does so.

## 6. Recommended Validator

Use a validator that supports JSON Schema Draft 2020-12. Ajv is a suitable option.

Install the dependencies if they are not already present:

```bash
npm install ajv ajv-formats
```

Example ES module utility:

**Suggested file:** `src/js/utils/schema-validator.js`

```javascript
import Ajv2020 from “ajv/dist/2020.js”;
import addFormats from “ajv-formats”;

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: true
});

addFormats(ajv);

/**
 * Compile a trusted, locally loaded JSON Schema.
 *
 * In a long-running process, Ajv caches compiled schemas.
 * Prefer compiling each schema during application startup.
 */
export function compileSchema(schema) {
  if (
    schema === null ||
    typeof schema !== “object” ||
    Array.isArray(schema)
  ) {
    throw new TypeError(“A JSON Schema object is required.”);
  }

  return ajv.compile(schema);
}

/**
 * Validate data against a schema object.
 *
 * The caller should load schemas from trusted project files,
 * not from arbitrary user-supplied paths or remote URLs.
 */
export function validateAgainstSchema(schema, data) {
  const validate = compileSchema(schema);
  const valid = validate(data);

  return {
    valid,
    errors: valid
      ? []
      : (validate.errors ?? []).map((error) => ({
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

1. Load schemas from trusted, version-controlled files.
2. Compile schemas once where practical, preferably during startup.
3. Reuse compiled validators in long-running processes.
4. Handle malformed JSON separately from schema-validation failures.
5. Return safe, structured validation errors to clients.
6. Log diagnostic details internally without unnecessarily recording personal information.
7. Add tests for valid records, invalid payloads, and edge cases.
8. Configure reference resolution deliberately if schemas use external `$ref` values.
9. Pin compatible dependency versions through the project’s lockfile.

If the backend uses CommonJS rather than ES modules, adapt the imports and exports to its module system.

## 7. API Integration

Validate untrusted request bodies at the backend boundary before passing them to business services.

Recommended processing sequence:

1. Parse the incoming request with appropriate body-size limits.
2. Authenticate the caller where required.
3. Authorize access to the operation and resource.
4. Validate the request against the correct input schema.
5. Apply domain-specific and cross-field validation.
6. Execute the business operation.
7. Persist validated data using database constraints and transactions where appropriate.
8. Record required audit events.
9. Return a documented response.

Use separate schemas for create, update, and response operations when their permissions or field requirements differ.

For example, a public application-submission request must not be allowed to set its own review status, approval decision, internal counsellor notes, or audit metadata.

Do not accept a field merely because it appears in a general-purpose record schema. Define an explicit contract for each operation and enforce authorization independently.

## 8. Security Requirements

### 8.1 Input validation

- Reject malformed or structurally invalid payloads.
- Enforce reasonable request-size and field-length limits.
- Validate nested objects and array entries.
- Reject unexpected properties where the contract requires strict objects.
- Normalize data only according to documented application rules.
- Never rely on frontend validation alone.
- Avoid automatically coercing input types unless coercion is explicitly part of the API contract.

### 8.2 Authorization and protected fields

JSON Schema validates data shape; it does not determine who may read or modify a record.

Apply explicit authorization rules to:

- Applicant information.
- Uploaded document references.
- Employer and job-management records.
- College and course publication controls.
- Application status transitions.
- Moderation decisions.
- Internal notes and audit information.

Keep server-managed fields under server control, including permission assignments, verification decisions, audit timestamps, and moderation outcomes.

### 8.3 Personal information

Application records may contain personal and educational information.

- Collect only information required for the stated purpose.
- Restrict access by role and record ownership.
- Avoid exposing private fields in public catalogue responses.
- Do not log complete request bodies containing sensitive personal data.
- Apply appropriate retention and deletion policies.
- Store uploaded files outside publicly accessible locations and validate their contents independently.

### 8.4 URLs and external resources

A `uri` or `uri-reference` constraint does not protect against malicious destinations.

Where external URLs are accepted:

- Permit only the protocols required by the application, typically `https:`.
- Reject unsafe schemes such as `javascript:`.
- Apply SSRF protections to backend services that fetch user-supplied URLs.
- Validate redirects and destination hosts when server-side fetching is permitted.
- Avoid unrestricted access to loopback, private, link-local, and cloud-metadata addresses.
- Do not treat a URL as an official source without verification.

### 8.5 Fixture isolation

Synthetic fixture records must remain separate from production user data.

- Never seed test fixtures into production accounts.
- Never include production passwords, API keys, tokens, or session cookies in fixtures.
- Use reserved test domains such as `example.invalid` for synthetic email addresses.
- Mark fixture datasets explicitly as synthetic and not production-eligible.
- Ensure test seeding is disabled or blocked in production environments.
- Do not interpret fixture metadata as proof of a real user’s identity or verification status.

Fixture schemas validate test data structure. They do not authorize fixture loading into any environment.

## 9. Schema Versioning and Compatibility

Treat schema updates as API contract changes.

### Potentially compatible changes

Depending on the consumers and validation strategy:

- Adding an optional property.
- Adding a reusable definition that is not yet required.
- Improving descriptions without changing validation behavior.
- Relaxing a constraint when all consumers support the expanded data.

### Potentially breaking changes

- Adding a newly required property.
- Removing or renaming a property.
- Narrowing an enum.
- Changing a property’s type.
- Tightening a constraint that rejects previously valid data.
- Changing nullability or the interpretation of an existing field.
- Changing the behavior of a referenced schema.

Before a breaking change:

1. Identify API, frontend, worker, and database consumers.
2. Review existing persisted records.
3. Decide whether migration or backfilling is necessary.
4. Update validation tests and API documentation.
5. Deploy compatible consumers and producers in a controlled sequence.
6. Document the change and migration requirements.

For substantial contract changes, introduce a versioned schema or API contract instead of silently changing behavior.

Do not change the `$id` solely to indicate every edit. Keep it stable while the schema represents the same canonical contract; use a deliberate versioning strategy for incompatible contracts.

## 10. Testing Checklist

For each schema, test:

- A valid minimal record.
- A valid complete record.
- Missing required properties.
- Incorrect data types.
- Invalid enum values.
- Empty strings and boundary-length strings.
- Invalid dates, timestamps, email addresses, and URLs.
- Numeric minimum and maximum boundaries.
- Invalid nested objects and array entries.
- Unexpected properties.
- Explicit `null` values where relevant.
- Invalid cross-field combinations.
- Business rules implemented outside JSON Schema.
- Compatibility with representative existing records.
- Valid and invalid `$ref` resolution where references are used.

Example test outline, assuming Vitest and JSON imports are configured:

```javascript
import { describe, expect, it } from “vitest”;
import {
  validateAgainstSchema
} from “../src/js/utils/schema-validator.js”;
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

  it(“rejects an unexpected property”, () => {
    const result = validateAgainstSchema(exampleSchema, {
      id: “example-001”,
      name: “Example Record”,
      unexpectedField: true
    });

    expect(result.valid).toBe(false);
  });
});
```

Adapt the test paths and imports to the repository’s actual structure. Do not use this example as a substitute for tests against the real schemas.

## 11. Continuous Integration

Run schema validation and automated tests as part of CI.

Recommended checks:

- Parse every schema as valid JSON.
- Confirm each schema declares the expected JSON Schema draft.
- Compile every schema using strict validator settings.
- Detect duplicate or missing `$id` values.
- Resolve and validate all schema references.
- Validate representative fixtures against their intended schemas.
- Test domain rules separately.
- Check that documented schema paths resolve to actual files.
- Detect unintended duplicate schema copies.
- Verify API documentation against implemented request and response contracts.
- Fail the build when a canonical schema cannot compile or a required contract test fails.

Use a maintained registry validation script rather than relying on manual inspection alone.

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
10. Update API documentation and dependent consumers.
11. Keep the canonical schema synchronized with the deployed API contract.
12. Document breaking changes and migration requirements.
13. Verify the schema compiles under the project’s configured validator.
14. Keep test fixtures separate from production records.

## 13. Operational Notes

- Schema validation does not sanitize HTML or prevent XSS by itself.
- Schema validation does not replace SQL parameterization or database constraints.
- Schema validation does not authorize access to a resource.
- Schema validation does not prove that an institution, employer, examination, or document is legitimate.
- External information must be verified against authoritative sources before publication.
- Catalogue records should include provenance and verification metadata where supported.
- Server-generated identifiers, timestamps, moderation decisions, and counters must not be trusted when supplied by clients.
- Schema validation must be paired with sensible request limits, error handling, and application-level monitoring.

## 14. Maintenance

Review the registry whenever:

- An API endpoint changes its request or response contract.
- A database model changes.
- A course category, examination status, application state, or employment type is introduced.
- A privacy or security requirement changes.
- A schema validation defect is discovered.
- A new external integration is introduced.
- A fixture structure changes.
- A canonical schema is moved or renamed.

Keep this README aligned with the schema files actually present in `/schemas/` and with the deployed API contract. Remove entries for files that do not exist and document additional schemas that become part of the canonical registry.

—

**Maintainer:** MedOrbits Engineering  
**Schema standard:** JSON Schema Draft 2020-12  
**Source of truth:** Canonical schema files used by the deployed backend  
**Required controls:** Version control, automated validation, contract tests, and CI enforcement
