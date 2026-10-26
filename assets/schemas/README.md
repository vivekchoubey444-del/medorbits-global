
# MedOrbits JSON Schemas

**Directory:** `assets/schemas/`  
**Purpose:** Centralized JSON Schema definitions for validating MedOrbits application data, document manifests, resource catalogues, and structured configuration files.  
**Brand identity:** Royal Burgundy and Champagne Gold  
**Schema standard:** JSON Schema Draft 2020-12, unless explicitly documented otherwise  
**Maintained by:** MedOrbits

—

## 1. Overview

The `assets/schemas/` directory contains reusable JSON Schema definitions that establish structural and data-quality requirements for the MedOrbits platform.

Schemas help ensure that structured data follows documented formats, required fields are present, values use appropriate data types, and supported constraints are enforced consistently.

This directory may contain schemas for:

- Document-library manifests.
- Admission guides and educational resources.
- Checklists and printable resource catalogues.
- Fee guides and financial-planning resources.
- Study-abroad resources.
- Courses, colleges, universities, and career options.
- Scholarships, hostels, fees, examinations, and related datasets.
- Application configuration and other structured frontend data.

A schema validates data structure and supported constraints. It does not independently establish factual accuracy, official approval, file existence, security, or publication readiness.

## 2. Directory Structure

The following is a reference structure. Keep it synchronized with the schemas actually implemented in the repository.

```text
assets/
└── schemas/
    ├── README.md
    ├── documents-manifest.schema.json
    ├── fee-guides.schema.json
    ├── fee-guides-catalogue.schema.json
    └── additional-implemented-schemas/
```

Schemas may also exist alongside individual document packages when package-specific validation is appropriate.

Example:

```text
assets/
└── documents/
    ├── manifest.schema.json
    ├── admission-guides/
    │   └── manifest.schema.json
    ├── checklists/
    │   └── manifest.schema.json
    └── study-abroad/
        └── manifest.schema.json
```

These examples illustrate possible locations. Do not create duplicate schemas merely to reproduce this layout. Prefer one authoritative schema for each contract, with package-specific schemas only where additional constraints are needed.

## 3. Schema Responsibilities

| Schema type | Responsibility |
|—|—|
| Shared document-manifest schema | Defines common structures and constraints for supported document-library manifests. |
| Package-specific manifest schema | Enforces additional requirements for a specialized document package. |
| Resource-catalogue schema | Validates structured resource data intended for application discovery or display. |
| Education-data schema | Validates datasets such as courses, colleges, universities, scholarships, and fees. |
| Configuration schema | Validates supported application configuration objects where applicable. |

Each schema should have one clearly defined responsibility. Avoid combining unrelated data contracts into one excessively permissive schema.

## 4. Naming Conventions

Use lowercase, descriptive, hyphen-separated filenames.

Preferred examples:

```text
documents-manifest.schema.json
fee-guides.schema.json
fee-guides-catalogue.schema.json
courses.schema.json
colleges.schema.json
universities.schema.json
scholarships.schema.json
```

Use the `.schema.json` suffix for schema files.

Keep filenames consistent with the related dataset or package. Avoid ambiguous names such as `schema2.json`, `final-schema.json`, or `new-schema-final.json`.

When renaming a schema, update every reference in manifests, datasets, validation scripts, tests, documentation, and CI workflows.

## 5. JSON Schema Standard

Unless a schema explicitly documents another supported version, use JSON Schema Draft 2020-12.

A typical schema begins with:

```json
{
  “$schema”: “https://json-schema.org/draft/2020-12/schema”,
  “$id”: “https://medorbits.in/schemas/example.schema.json”,
  “title”: “MedOrbits Example Schema”,
  “description”: “Validates an example structured data contract.”,
  “type”: “object”
}
```

Replace the example `$id`, title, description, and constraints with values appropriate to the actual schema.

### 5.1 Schema identifiers

- Use the correct `$schema` URI for the selected JSON Schema version.
- Assign each independently addressable schema a stable, unique `$id`.
- Keep `$id` values consistent with the repository’s documented identifier convention.
- Do not assume an HTTPS `$id` means the schema is hosted or downloadable at that URL.
- Use valid relative references or stable absolute identifiers for `$ref`.
- Ensure referenced schemas are accessible to the configured validator.

The schema identifier and repository file path are related but are not automatically interchangeable.

## 6. Schema Design Principles

Schemas should be strict enough to catch meaningful errors without unnecessarily breaking valid existing data.

### Required fields

Use `required` for fields essential to the data contract. Do not require optional metadata when a legitimate record may omit it.

### Data types and constraints

Use appropriate JSON Schema keywords, including:

- `type`
- `enum`
- `const`
- `required`
- `properties`
- `items`
- `pattern`
- `minLength`
- `maxLength`
- `minimum`
- `maximum`
- `format`
- `uniqueItems`
- `additionalProperties`
- `$ref`
- `allOf`, `anyOf`, and `oneOf` where appropriate

Apply constraints according to actual business requirements rather than adding restrictions without an operational purpose.

### Reusable definitions

Use `$defs` for reusable definitions such as:

- Stable identifiers.
- Safe relative paths.
- Publication statuses.
- Verification statuses.
- Official source records.
- Document records.
- Category records.
- Common metadata structures.

Reference reusable definitions through `$ref` to reduce duplication and improve consistency.

### Additional properties

Choose `additionalProperties` deliberately.

- Use `false` when an object must follow a closed contract.
- Use `true` when backward-compatible extension fields are intentionally supported.
- Consider `unevaluatedProperties` when composition with `allOf` or other schema combinations requires more precise control.

Do not place `additionalProperties` inside `properties` unless it intentionally defines a property named `additionalProperties`. For normal object validation, it belongs alongside `properties`, `required`, and other object-level keywords.

## 7. Shared and Package-Specific Schemas

MedOrbits uses shared schemas where practical, supplemented by package-specific schemas when necessary.

### Shared schemas

Use shared schemas for common structures and constraints that genuinely apply across multiple libraries.

For example, a document-manifest schema may define reusable rules for resource IDs, relative paths, publication statuses, verification metadata, and source references.

### Package-specific schemas

Use a specialized schema when a package has unique fields, stricter requirements, or a different manifest structure.

Examples include:

- Fee-guide manifests and catalogues.
- Admission-guide manifests.
- Checklist manifests.
- Study-abroad manifests.

A package-specific schema should document which fields it adds, restricts, or maps to shared concepts.

Do not assume that all packages use the same field names. For example, `lastReviewed`, `lastReviewedAt`, and `lastVerified` are different properties unless a schema or application layer explicitly defines their relationship.

When a schema changes field names or structure, update the affected manifest, validation logic, documentation, and tests together.

## 8. Document Publication and Verification

Schemas used for document libraries may validate publication and verification metadata.

Possible publication statuses include:

- `planned`
- `draft`
- `in_review`
- `approved`
- `published`
- `under_review`
- `outdated`
- `archived`
- `withdrawn`

Possible verification statuses include:

- `not_verified`
- `content_reviewed`
- `official_sources_checked`
- `officially_verified`

Include only values supported by the applicable schema and package policy.

For public downloads, the application must enforce the publication policy independently of schema validation.

A record with `status: “published”` is not sufficient by itself. The application must also confirm applicable file-existence, content-review, privacy, approval, and deployment requirements.

Schemas cannot independently confirm that:

- A PDF exists at the specified path.
- A source URL is authoritative or current.
- A review was actually completed.
- A checksum matches the actual file.
- A document contains no confidential information.
- A resource is safe for public distribution.

Implement these checks in repository validation scripts, tests, or the publishing workflow.

## 9. Validation Workflow

Validate schemas and the data that references them.

Recommended workflow:

1. Parse the schema as valid JSON.
2. Confirm that the schema uses the intended JSON Schema version.
3. Resolve `$ref` references.
4. Validate the schema against the selected meta-schema where supported.
5. Validate representative valid and invalid fixtures.
6. Validate the target manifest or dataset against its schema.
7. Run application-specific integrity checks.
8. Test affected application components.
9. Include validation in CI where supported.

### 9.1 Required validation layers

MedOrbits validation should be divided into four independently reported layers.

| Layer | Responsibility | Expected result |
|—|—|—|
| JSON syntax | Parse JSON files and reject malformed JSON or duplicate object keys where the parser supports detection. | Syntax errors are reported. |
| Schema conformance | Validate schemas against the Draft 2020-12 meta-schema and resolve references. | Schema definitions are valid and references resolve. |
| Data conformance | Validate manifests, catalogues, and datasets against their assigned schemas. | Records satisfy the applicable data contract. |
| Application integrity | Check cross-file references, duplicate IDs, file existence, checksums, publication eligibility, and runtime rules. | Business and publishing rules pass. |

Passing one layer does not imply that the other layers have passed.

### 9.2 Additional validation checks

- Required fields and data types.
- Allowed enum values.
- Correct date formats.
- Valid identifiers and relative paths.
- Duplicate IDs and filenames.
- Related-resource and category references.
- Referenced schema availability.
- File existence for resources that require existing files.
- Publication-policy compliance.
- Accurate file sizes and checksums where supplied.
- Consistency between schemas, data, documentation, and application code.

A successful schema validation does not replace business-rule validation or content review.

### 9.3 CI acceptance criteria

Accept a schema or data change only when:

- JSON syntax validation passes.
- Applicable schemas conform to the declared JSON Schema draft.
- Required schema references resolve.
- Valid and invalid regression fixtures produce the expected results.
- Affected manifests and datasets conform to their assigned schemas.
- Cross-dataset references and duplicate identifiers are checked.
- Required files exist and remain inside their permitted directories.
- Checksums match the actual files when checksum verification is required.
- Publication policies are enforced by the publishing workflow.
- Documentation and application consumers remain compatible.

### 9.4 Schema inventory

Maintain a single inventory of implemented schemas. Each entry should record:

- Repository-relative schema path.
- Schema title and stable `$id`.
- JSON Schema draft.
- Data contract or manifest type validated.
- Datasets or packages that reference the schema.
- Validation command or test suite.
- Compatibility notes for breaking changes.

Do not list planned schemas as implemented. Clearly label proposals and examples until the corresponding files and validation tests exist.

## 10. Project Commands

Use validation scripts configured in the repository’s `package.json`.

Example commands:

```bash
npm run check:json
npm run check:data
```

Run these only if the corresponding scripts exist and are correctly configured.

| Command | Expected responsibility |
|—|—|
| `check:json` | Checks JSON syntax and any schema validation explicitly included in its implementation. |
| `check:data` | Checks application-specific data integrity rules implemented by the repository. |

Do not assume either command performs schema validation, file-existence checks, PDF inspection, or link verification unless its implementation explicitly does so.

When adding a command, update `package.json`, the relevant validation scripts, documentation, and CI configuration together.

## 11. Testing Requirements

Each important schema should have representative test fixtures or equivalent automated tests.

### Valid fixtures

Test records that satisfy the documented contract, including legitimate optional-field omissions and nullable metadata where supported.

### Invalid fixtures

Test records with problems such as:

- Missing required fields.
- Incorrect data types.
- Invalid enum values.
- Malformed identifiers.
- Unsafe relative paths.
- Invalid dates.
- Invalid checksums.
- Unsupported publication statuses.
- Incorrect references to other schemas.

### Regression testing

When modifying a schema:

1. Validate existing datasets against the proposed schema.
2. Identify previously valid records that would become invalid.
3. Confirm whether those changes are intentional.
4. Update affected data and documentation.
5. Add tests for new constraints.
6. Run relevant project validation commands.
7. Review application components that consume the affected data.

Avoid breaking schema changes without updating the corresponding consumers.

## 12. Versioning and Compatibility

Use semantic versioning for schemas and structured data where the relevant package supports it.

Typical format:

`MAJOR.MINOR.PATCH`

- **MAJOR:** Introduces an incompatible contract change.
- **MINOR:** Adds backward-compatible capabilities.
- **PATCH:** Makes a backward-compatible correction or clarification.

The impact depends on the actual schema and its consumers. An apparently additive change can still be breaking if an application relies on stricter assumptions.

When introducing an incompatible change:

- Update the schema version or documented contract version as applicable.
- Update affected datasets and manifests.
- Update validation scripts and consumers.
- Provide migration guidance where needed.
- Test existing resource records and frontend integration.

Do not change a schema’s version merely because a file has been reformatted.

## 13. Security Considerations

Schemas are a data-validation layer, not an authorization mechanism.

- Never store secrets in public JSON files.
- Do not treat a schema-valid record as proof that a resource is safe to publish.
- Reject unsafe paths in the application and file-processing workflow.
- Do not trust client-supplied metadata for authorization decisions.
- Validate external URLs before using them in sensitive workflows.
- Keep private records outside public frontend assets.
- Apply server-side authorization for restricted documents and data.
- Avoid exposing internal paths, credentials, or confidential implementation details in validation errors.

Public assets must be treated as accessible to anyone who can reach the deployed website.

## 14. Maintenance Policy

Review schemas whenever the data model, publication workflow, package structure, or application integration changes.

When updating a schema:

1. Identify affected datasets and manifests.
2. Confirm whether the change is compatible.
3. Update the schema and its documentation.
4. Update related records where necessary.
5. Add or revise test fixtures.
6. Run JSON and schema validation.
7. Run application-specific data checks.
8. Update references and CI configuration.
9. Review deployment behaviour.
10. Record the change through the repository’s version-control process.

Keep the directory README, schemas, package documentation, validation scripts, and CI workflows synchronized.

## 15. Contribution Checklist

Before submitting a new or revised schema, confirm:

- [ ] The schema has a clear purpose and title.
- [ ] The correct JSON Schema draft is declared.
- [ ] The `$id` is unique and follows the project convention.
- [ ] Required and optional fields are documented appropriately.
- [ ] Data types, patterns, enums, and formats match the actual contract.
- [ ] Reusable definitions are used where appropriate.
- [ ] `$ref` references resolve correctly.
- [ ] `additionalProperties` is configured intentionally.
- [ ] Representative valid and invalid records have been tested.
- [ ] Existing manifests and datasets have been checked for compatibility.
- [ ] Relevant project validation commands pass.
- [ ] Related documentation and application consumers are synchronized.
- [ ] Publication and security rules are enforced outside the schema where necessary.

## 16. Disclaimer

MedOrbits schemas define structural validation rules for application data and document metadata. They do not guarantee the factual accuracy, completeness, legality, security, accessibility, or publication readiness of the data being validated.

Content owners remain responsible for reviewing educational information, authoritative sources, privacy requirements, and publication approvals.

—

**Maintained by:** MedOrbits  
**Directory:** `assets/schemas/`  
**Purpose:** Shared and specialized JSON Schema definitions  
**Standard:** JSON Schema Draft 2020-12, unless otherwise documented  
**Brand identity:** Royal Burgundy and Champagne Gold
