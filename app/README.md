
# MedOrbits — Application Directory

**Project:** MedOrbits — Education · Admissions · Careers · Recruitment  
**Website:** https://www.medorbits.in/  
**Directory:** `/app/`  
**Current structure:** `api/`, `README.md`

—

## 1. Overview

The `/app/` directory is the application-level root for MedOrbits API functionality and related application resources.

It currently contains the `api/` directory, which is responsible for API-related functionality, and this README, which documents the directory structure and development conventions.

This document describes the current directory without assuming that uncreated modules or files already exist.

## 2. Directory Structure

```text
app/
├── api/
│   └── README.md
└── README.md
```

The `api/README.md` file should document the actual API implementation, including its routes, middleware, services, schemas, configuration, and tests as those components are added.

The tree above is a simplified representation. Update it whenever the repository structure changes.

## 3. Directory Responsibilities

### `api/`

Contains API-related application components.

Depending on the implemented backend architecture, these may include:

- Route registration and endpoint handlers
- Request validation and authorization
- Application services and business workflows
- Database and repository integration
- Request and response schemas
- Authentication and security controls
- Error handling and logging
- API documentation and automated tests

Use the existing API architecture as the source of truth. Avoid creating duplicate middleware, services, schemas, or configuration when an authoritative implementation already exists elsewhere in the repository.

### `README.md`

Documents:

- The purpose of `/app/`
- The current directory structure
- The responsibilities of child directories
- Development and security conventions
- Testing and deployment expectations

Keep this document aligned with the implementation.

## 4. Application Architecture

The application should separate request handling, business logic, infrastructure, and security.

```text
Client / Frontend
       |
       v
API Routes
       |
       v
Authentication and Authorization
       |
       v
Request Validation
       |
       v
Application Services
       |
       +——> Database / Repositories
       |
       +——> External Integrations
       |
       v
Standardized API Response
```

The exact request flow depends on the API implementation. Apply authentication and authorization before executing protected operations, and validate untrusted input before processing it.

Keep route handlers focused on HTTP concerns. Place reusable business workflows in the established service layer.

## 5. Technology and Runtime

Follow the versions and module conventions declared in the repository.

Expected project conventions include:

- Node.js 20+ for the JavaScript backend, where applicable
- Express.js where configured by the backend
- PostgreSQL where configured as the application database
- Environment-based configuration
- Automated unit and integration testing

Do not assume that a particular framework, database, or package is installed merely because it is recommended here. Check the actual `package.json`, configuration files, and backend implementation.

## 6. API Development Standards

Every new API feature should:

1. Have a clearly defined purpose and request contract.
2. Validate request parameters, body fields, and uploaded files.
3. Enforce authentication and resource-level authorization where required.
4. Use the established application service and database layers.
5. Return consistent response and error formats.
6. Handle expected failures without exposing internal implementation details.
7. Include appropriate automated tests.
8. Update API documentation when its public behavior changes.

Avoid duplicate route registration, undefined controller callbacks, circular dependencies, and inconsistent export conventions.

## 7. Security Requirements

All application API functionality must follow these principles:

- Validate all untrusted input on the server.
- Use parameterized database queries.
- Enforce least-privilege access.
- Protect administrative and sensitive endpoints.
- Check resource ownership before returning private records.
- Store secrets in environment variables or an approved secret manager.
- Never commit production credentials.
- Apply rate limiting to sensitive or abuse-prone endpoints.
- Configure CORS explicitly when cross-origin access is needed.
- Set request, upload, and external-service timeouts.
- Prevent path traversal and unsafe file handling.
- Avoid exposing stack traces or internal paths in production responses.
- Redact credentials, session tokens, and sensitive personal information from logs.

Education applications, identity documents, and recruitment records must be accessible only to authorized users.

## 8. Error Handling and Logging

Use the backend’s centralized error-handling implementation.

API errors should provide a stable error code and a safe, understandable message. Diagnostic details should remain in protected server logs.

Where supported, use structured logs with:

- Timestamp
- Severity
- Request or correlation ID
- Route or operation
- HTTP status
- Execution duration
- Sanitized error information

Do not log passwords, API keys, session cookies, or document contents.

## 9. Database and Integrations

Use the configured database access layer instead of opening ad hoc database connections from route handlers.

Database operations should:

- Preserve data integrity.
- Use transactions where atomicity is required.
- Enforce appropriate uniqueness and relationship constraints.
- Handle concurrency and constraint failures.
- Avoid unrestricted mass assignment.
- Use version-controlled migrations where supported.

External integrations should use shared clients with explicit timeouts, validated responses, bounded retries, and safe handling of provider failures.

Use idempotency controls for retryable operations that could otherwise create duplicate applications, payments, or notifications.

## 10. Testing and Quality Checks

Before merging application changes, run the checks configured by the project.

Typical commands, when defined in `package.json`, include:

```bash
npm test
npm run lint
npm run build
```

Also verify:

- Authentication and authorization behavior
- Request validation
- Error responses
- Database integrity
- Integration failure handling
- Sensitive-data protection
- Route registration and controller exports

Use an isolated test database and test credentials for integration testing. Never run destructive tests against production data.

## 11. Configuration and Deployment

Use the project’s authoritative configuration module.

Before deployment:

- Validate required environment variables.
- Confirm database connectivity and migrations.
- Verify route registration.
- Confirm authentication and authorization controls.
- Check health and readiness endpoints, where implemented.
- Run automated tests and available security checks.
- Confirm secrets are not included in repository files.
- Verify graceful shutdown and error logging.
- Review dependency vulnerabilities.

Do not introduce deployment-specific assumptions that conflict with the repository’s actual hosting and runtime configuration.

## 12. Adding New Modules

Before adding a new directory or file:

1. Inspect the existing `/app/api/` structure.
2. Identify whether the required functionality already exists elsewhere.
3. Reuse the authoritative implementation where possible.
4. Follow the established naming and module conventions.
5. Add tests and documentation with the implementation.
6. Update this directory tree when the structure changes.

Avoid creating empty placeholder directories or duplicating functionality solely to match a proposed architecture.

## 13. Definition of Done

- [ ] The change follows the existing application architecture.
- [ ] Input validation is implemented.
- [ ] Required authentication and authorization are enforced.
- [ ] Errors are handled consistently.
- [ ] Sensitive data is protected.
- [ ] Database operations preserve integrity.
- [ ] Relevant tests pass.
- [ ] Configuration changes are documented.
- [ ] API documentation reflects public behavior changes.
- [ ] Directory documentation matches the actual repository.

—

## 14. Maintenance Principle

Keep `/app/README.md` concise enough to maintain and accurate enough to serve as the entry point for developers.

**The repository implementation is authoritative. Documentation should describe what exists, explain how it works, and identify requirements for future changes without presenting planned files as already implemented.**
