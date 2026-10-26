MedOrbits OpenAPI Documentation

1. Purpose

The openai/ directory contains the OpenAPI specification and related documentation for the MedOrbits platform API.

Its purpose is to provide a consistent, machine-readable description of API endpoints, request parameters, request bodies, response schemas, authentication requirements, and error responses.

The specification can support:

* API documentation and discovery.
* Frontend and backend integration.
* Contract testing.
* Client SDK generation.
* Request and response validation.
* API review and maintenance.
* Integration planning for education, admissions, careers, and recruitment services.

Important: An OpenAPI specification describes an API contract. It does not implement endpoints or prove that the corresponding backend functionality exists.

2. Directory Structure

openai/
├── README.md
└── openapi.yaml

File responsibilities

File	Purpose
README.md	Documents the specification, validation, security, and maintenance process.
openapi.yaml	Defines the OpenAPI document and proposed API contracts.

Add additional specifications only when there is a clear requirement for versioning, separate services, or independently maintained API contracts.

3. Specification Format

The API specification uses OpenAPI 3.1.1 and YAML.

The specification should define:

* API title and version.
* API server URLs.
* Resource tags.
* Paths and HTTP methods.
* Operation identifiers.
* Parameters and request bodies.
* Response status codes.
* Reusable schemas.
* Authentication schemes.
* Error response formats.

Use reusable component definitions to avoid duplicating common schemas, parameters, and response structures.

Keep descriptions accurate and concise.

4. Intended API Domains

The initial specification may describe the following domains, subject to verification against the actual backend:

System

* Application health.
* Service availability.
* Dependency status, where implemented.

Authentication

* Login.
* Logout.
* Session or token handling.

Users

* Current-user profile.
* Authorized profile information.

Colleges

* College discovery.
* Search and filtering.
* College details.

Courses

* Course discovery.
* Course categories.
* Education information.

Jobs

* Job listings.
* Location and employment-type filters.
* Career opportunities.

Applications

* Application submission.
* Application listing.
* Application status.

Notifications

* Notification listing.
* Read and unread status.

These domains are proposed API groupings. Only endpoints supported by the actual server should be described as implemented.

5. Backend Compatibility

The OpenAPI contract must remain consistent with the existing MedOrbits Express application.

Before adding or changing an operation:

1. Inspect the actual route declarations.
2. Verify the route’s HTTP method and URL.
3. Inspect its controller and middleware.
4. Confirm authentication and authorization requirements.
5. Verify request validation.
6. Confirm the actual response structure and status codes.
7. Check whether pagination, filtering, and error handling are implemented.
8. Update the specification to match verified behavior.

Do not modify backend routes merely to make them match a speculative API contract.

If an endpoint is planned but not implemented, clearly label it as proposed in the relevant documentation or tracking system.

6. API Design Conventions

Use consistent API conventions across resources.

HTTP methods

* GET — retrieve resources.
* POST — create a resource or perform an explicitly defined operation.
* PUT — replace a resource when supported.
* PATCH — partially update a resource when supported.
* DELETE — remove a resource only where deletion is explicitly supported and authorized.

Do not document methods that the backend does not implement.

Responses

Use appropriate HTTP status codes.

Common examples include:

* 200 — successful request.
* 201 — resource created.
* 204 — successful request with no response body.
* 400 — invalid request.
* 401 — authentication required or invalid.
* 403 — access forbidden.
* 404 — resource not found or unavailable to the requester.
* 409 — conflicting operation.
* 422 — semantic validation failure, if adopted by the backend.
* 429 — rate limit exceeded.
* 500 — unexpected server failure.
* 503 — service unavailable.

The actual status codes must match the implementation.

Naming

* Use descriptive, stable operation IDs.
* Use consistent resource naming.
* Prefer reusable schemas.
* Apply consistent pagination conventions.
* Document optional and required fields accurately.
* Set reasonable maximum lengths and numeric limits.
* Avoid exposing internal database structures unnecessarily.

7. Authentication and Authorization

Document the authentication mechanism actually implemented by the application.

If bearer-token authentication is used, specify the relevant security scheme and apply it to protected operations.

If cookie-based sessions are used, document the appropriate cookie security scheme instead.

Requirements:

* Public endpoints must be explicitly identified.
* Protected operations must declare their authentication requirements.
* Authorization must be enforced by backend middleware and controllers.
* User-owned resources must be checked against the authenticated user’s permissions.
* Administrative operations must require appropriate privileges.
* Authentication tokens and credentials must never be included in examples.
* Do not treat the OpenAPI document as an authorization mechanism.

A documented security scheme does not implement authentication.

8. Validation and Error Handling

Define request and response schemas that match the server’s actual behavior.

Where appropriate, validate:

* Required fields.
* Data types.
* String lengths.
* Numeric bounds.
* Enumerated values.
* Date and time formats.
* Pagination parameters.
* Identifiers and path parameters.
* Unexpected additional properties.

Error responses should use a consistent structure where the backend supports it.

Do not expose:

* Stack traces.
* Secret values.
* Database credentials.
* Internal filesystem paths.
* Sensitive request bodies.
* Private user documents.

Document only fields that the API actually returns.

9. Security and Privacy

* Do not place real API keys or credentials in this directory.
* Do not include production tokens in examples.
* Do not publish sensitive server addresses or internal infrastructure details unnecessarily.
* Avoid exposing private user information through response schemas.
* Restrict access to protected resources.
* Apply rate limiting and request validation where appropriate.
* Keep authentication and authorization enforcement on the server.
* Review upload and document endpoints carefully before documenting them.
* Use HTTPS for deployed production APIs.
* Avoid including sensitive values in URLs, examples, or error messages.

OpenAPI documents can be public, so treat their contents as potentially visible outside the development team.

10. Validation Workflow

Validate openapi.yaml with a compatible OpenAPI 3.1 validator before merging changes.

A possible workflow using a locally installed Redocly CLI is:

npx —no-install @redocly/cli lint openai/openapi.yaml

This command requires the CLI to already be available in the project’s local dependencies. It may fail if the package is not installed or configured.

Do not automatically install packages or execute remote package code merely to validate the specification.

Validation should check:

* YAML syntax.
* OpenAPI document structure.
* Reference resolution.
* Schema consistency.
* Operation identifiers.
* Parameter definitions.
* Response definitions.
* Security declarations.
* Duplicate or inconsistent definitions.

A syntactically valid document may still describe endpoints that do not exist.

11. Testing Strategy

Where the necessary implementation and tooling exist, use separate validation layers.

Specification validation

Confirm that the YAML parses and conforms to the declared OpenAPI version.

Contract testing

Compare documented requests and responses with the actual backend.

Integration testing

Test relevant endpoints against a controlled test environment.

Security testing

Verify authentication, authorization, input validation, rate limiting, and sensitive-data handling.

Compatibility testing

Check that changes do not unexpectedly break existing clients or integrations.

Record skipped checks and environmental limitations. Do not describe an unexecuted validation as passing.

12. Versioning and Change Management

Maintain the specification alongside the implementation.

When the API changes:

1. Identify the affected operations.
2. Inspect the existing server behavior.
3. Update the specification.
4. Validate the YAML and references.
5. Run relevant contract or integration tests.
6. Review authentication and privacy implications.
7. Document breaking changes.
8. Update the API version according to the project’s versioning policy.

Do not increment versions automatically for every documentation edit. Follow a defined policy for additive, corrective, and breaking changes.

Avoid removing documented operations until their compatibility impact has been reviewed.

13. Continuous Integration

A future CI workflow may validate the specification on pull requests.

It should:

* Run a local or pinned validator.
* Fail on invalid YAML or unresolved references.
* Report validation errors clearly.
* Avoid installing unreviewed dependencies during validation.
* Avoid exposing secrets in logs.
* Avoid modifying the specification during the validation step.

Do not advertise a CI validation workflow until the workflow exists and has been tested.

14. Known Limitations

This directory describes the intended API contract and its maintenance process.

Potential limitations include:

* Proposed endpoints may not exist in the current backend.
* Response schemas may require adjustment after inspecting controllers.
* Authentication schemes may differ from the current implementation.
* Static validation does not prove runtime behavior.
* Contract validation requires a compatible validator.
* API compatibility depends on coordinated frontend and backend changes.

Keep these limitations visible until the relevant functionality is verified.

15. Maintenance Checklist

Before considering an API specification update complete:

* [ ]	Confirm the actual route and controller.
* [ ]	Verify request and response schemas.
* [ ]	Check authentication and authorization.
* [ ]	Validate YAML syntax.
* [ ]	Validate OpenAPI structure and references.
* [ ]	Run relevant tests when available.
* [ ]	Check for accidental secret exposure.
* [ ]	Review compatibility implications.
* [ ]	Update this README if the workflow changes.
* [ ]	Report which checks actually passed.

16. Core Principle

Document the API that exists, clearly label the API that is planned, and verify every contract change against the real implementation.