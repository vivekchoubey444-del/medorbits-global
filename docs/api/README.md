
# MedOrbits API Documentation

**Directory:** `docs/api/`  
**Primary specification:** `docs/api/openapi.yaml`  
**Specification standard:** OpenAPI 3.1.0

## 1. Purpose

This directory contains the authoritative documentation for the implemented MedOrbits HTTP API.

The documentation describes available endpoints, HTTP methods, authentication and authorization requirements, request validation, response schemas, status codes, pagination, error handling, and relevant security controls.

An endpoint is not considered available merely because it appears in the OpenAPI specification. The documented contract must be supported by the backend implementation and its mounted routes.

## 2. Directory Structure

```text
docs/
└── api/
    ├── README.md
    └── openapi.yaml
```

Add supplementary documents, reusable schema files, or generated API references only when they provide a clear maintenance or development benefit.

## 3. Documentation Standards

### 3.1 Endpoint accuracy

For each documented operation:

- Confirm the route is registered and mounted by the application.
- Match the HTTP method and full path, including router prefixes.
- Inspect the controller, service, repository, and relevant middleware.
- Verify authentication, authorization, validation, and response behavior.
- Document only supported query parameters, filters, sorting, and pagination.
- Assign a unique, descriptive `operationId`.
- Use `x-implementation-status: verify` only as a temporary review marker, not as proof of availability.

Unverified operations must either be omitted from the available API contract or clearly separated from it as proposed functionality.

### 3.2 Request and response contracts

Every operation should document, where applicable:

- Required and optional path, query, and header parameters.
- Accepted content types and request-body schemas.
- Field types, lengths, formats, permitted values, and nullability.
- Successful response bodies and actual HTTP status codes.
- Validation, authentication, authorization, conflict, and server errors.
- Pagination and filtering behavior.
- Reusable response schemas and error definitions.

Document the actual response envelope used by MedOrbits. Do not introduce a new `data`, `error`, or `pagination` structure unless the backend returns it or the implementation is deliberately changed to support it.

Use explicit `additionalProperties` policies where appropriate. Keep schemas strict for sensitive request objects and avoid documenting fields that clients must not control, such as account ownership, administrative roles, payment status, or calculated charges.

### 3.3 Authentication and authorization

Document the authentication mechanism actually implemented by the application.

For cookie-based sessions:

- Specify the real cookie name and session behavior.
- Document CSRF protection for state-changing requests where applicable.
- Explain session expiration and logout behavior.
- Distinguish authentication failures from authorization failures.

For token-based authentication, document the implemented token scheme and relevant expiration and renewal behavior.

Public endpoints must explicitly declare public access when a global security requirement exists. Protected operations must reflect the backend’s actual middleware and access policy.

Authentication documentation must never imply that a schema or OpenAPI security declaration independently enforces access control.

### 3.4 Examples and sensitive data

- Use synthetic example data.
- Never include passwords, access tokens, session cookies, API keys, payment credentials, or real private user information.
- Avoid exposing stack traces, database errors, filesystem paths, or infrastructure secrets.
- Document sanitized error messages and stable error codes where implemented.

## 4. OpenAPI Specification

The primary specification is:

`docs/api/openapi.yaml`

Use OpenAPI 3.1.0 consistently unless the project deliberately adopts another version.

Include the following sections as appropriate:

| Section | Responsibility |
|—|—|
| `openapi` | OpenAPI specification version |
| `info` | API title, version, description, and contact |
| `servers` | Verified API base URLs or clearly identified placeholders |
| `tags` | Logical endpoint groupings |
| `paths` | Implemented HTTP operations |
| `components.schemas` | Reusable request and response schemas |
| `components.parameters` | Reusable path, query, and header parameters |
| `components.responses` | Common response definitions |
| `components.securitySchemes` | Actual authentication mechanisms |
| Operation-level `security` | Public access or operation-specific security requirements |

### 4.1 Versioning

Maintain the OpenAPI document version independently from the API’s release version when appropriate.

Update the specification version when the documented contract changes. Record breaking API changes in release notes and evaluate their impact on existing clients before deployment.

### 4.2 Placeholders

Mark unresolved server URLs, cookie names, provider-specific headers, and other implementation-dependent values clearly.

Placeholders must be resolved before production publication. A placeholder must never be presented as a verified production endpoint or authentication mechanism.

## 5. Backend Verification Workflow

Before adding or modifying an operation:

1. Locate its route definition.
2. Confirm the route is mounted by the application.
3. Inspect the controller and associated service logic.
4. Verify authentication, authorization, and ownership checks.
5. Inspect request validators and accepted input formats.
6. Confirm actual response bodies and HTTP status codes.
7. Verify error handling and business rules.
8. Update `openapi.yaml` to match the implementation.
9. Add or update relevant automated tests.
10. Validate the specification and review the changes before merging.

If the behavior cannot be verified, do not claim the operation is implemented.

## 6. Specification Validation

Use the validator selected by the project and pin its version in the development dependencies and lockfile.

For example, if MedOrbits adopts Redocly CLI:

```bash
npm install —save-dev —save-exact @redocly/cli
```

Add a validation script to `package.json`:

```json
{
  “scripts”: {
    “api:lint”: “redocly lint docs/api/openapi.yaml”
  }
}
```

Run validation using the installed, lockfile-backed dependency:

```bash
npm ci
npm run api:lint
```

Merge the script into the existing `scripts` object rather than replacing existing project scripts.

Validation should check:

- YAML syntax and OpenAPI 3.1.0 compliance.
- Valid and resolvable `$ref` references.
- Unique operation IDs.
- Request and response schema consistency.
- Authentication declarations and security overrides.
- Documented status codes and response content.
- Unresolved placeholders and accidental secrets.
- Project-specific linting rules and naming conventions.

A passing lint result confirms specification-level validity only. It does not prove that routes exist, authorization is correct, or responses match the documented schemas.

## 7. Continuous Integration

Run API documentation validation in CI whenever changes affect:

- `docs/api/openapi.yaml`
- Backend routes or router mounting
- Controllers, services, or request validators
- Request and response schemas
- Authentication or authorization behavior

Example GitHub Actions step, assuming the project installs the pinned Redocly CLI dependency first:

```yaml
- name: Install locked dependencies
  run: npm ci

- name: Validate OpenAPI specification
  run: npm run api:lint
```

Integrate these steps into the existing workflow rather than creating a competing dependency-installation process.

Where practical, add contract tests that exercise the running application and compare actual responses with the documented schemas. Include tests for public access, authentication failures, authorization boundaries, invalid input, pagination, and error responses.

Do not make production credentials or production payment operations prerequisites for ordinary documentation linting.

## 8. Change Management

For every API change:

1. Update the backend implementation.
2. Update input validation and authorization controls.
3. Update response handling and error mapping.
4. Update `docs/api/openapi.yaml`.
5. Update relevant unit, integration, and contract tests.
6. Run OpenAPI validation.
7. Verify compatibility with existing frontend clients.
8. Review security implications.
9. Document breaking changes and migration requirements.
10. Merge only after the applicable checks pass.

Treat changes to required fields, response envelopes, authentication, status codes, pagination, and permitted values as potential compatibility changes.

## 9. Security Requirements

- Never commit secrets to API documentation.
- Keep provider credentials and production configuration in secure environment settings.
- Do not expose internal administrative routes as public operations.
- Enforce role and ownership checks on the server.
- Validate input and reject unauthorized mass assignment.
- Rate-limit authentication, recovery, search, and public submission endpoints where appropriate.
- Verify payment webhooks using the payment provider’s documented signature-verification procedure and the exact raw request body.
- Apply idempotency and concurrency controls to financial operations where supported.
- Calculate payable amounts and subscription entitlements server-side.
- Prevent cross-user access to applications, documents, notifications, and other private records.
- Document CSRF protections for cookie-authenticated state-changing operations.
- Return sanitized errors without exposing internal implementation details.

OpenAPI security declarations describe the intended contract. Actual security depends on backend enforcement.

## 10. Maintenance Checklist

- [ ] Every documented endpoint exists and is mounted.
- [ ] HTTP methods and paths match the backend.
- [ ] Request schemas match the actual validators.
- [ ] Response schemas match actual controller and service output.
- [ ] Authentication and authorization requirements are correct.
- [ ] Resource ownership is enforced server-side.
- [ ] Status codes and error envelopes are accurate.
- [ ] Pagination and filtering match implemented behavior.
- [ ] Examples contain synthetic data only.
- [ ] No secrets or private personal data are exposed.
- [ ] Placeholders are resolved or clearly marked.
- [ ] OpenAPI linting passes locally and in CI.
- [ ] Relevant automated tests pass.
- [ ] Breaking changes are reviewed and documented.

## 11. Definition of Done

An API documentation change is complete when:

1. The specification accurately represents the implemented route and its behavior.
2. Request validation, response schemas, and security requirements are verified.
3. The OpenAPI validator passes.
4. Relevant automated tests pass.
5. Compatibility and security implications have been reviewed.
6. Any unresolved implementation dependency is explicitly documented.

**Maintenance principle:** MedOrbits API documentation must remain accurate, secure, testable, version-controlled, and synchronized with the deployed implementation.
