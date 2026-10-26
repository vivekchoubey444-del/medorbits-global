
# MedOrbits Repository Folder Structure

**Document:** `docs/architecture/repository-structure.md`  
**Scope:** Top-level directories, module ownership, security boundaries, and repository maintenance  
**Status:** Architecture reference — verify against the current repository before treating paths as implemented  
**Runtime baseline:** Node.js 20 or later, subject to the actual project configuration

## 1. Purpose

This document defines the intended organization and responsibilities of the MedOrbits repository.

It establishes conventions for frontend pages, backend modules, database resources, runtime storage, tests, scripts, infrastructure, and documentation.

The directory structure is a design reference, not an inventory of verified files. A directory, module, route, integration, or deployment capability must not be described as implemented unless it has been confirmed in the repository.

## 2. Top-Level Directory Overview

| Path | Responsibility | Exposure |
|—|—|—|
| `pages/` | Public informational pages, landing pages, and error or offline pages | Public |
| `account/` | Authentication, account access, dashboards, security, and account workflows | Mixed |
| `education/` | Courses, colleges, universities, admissions, and study-abroad content | Mixed |
| `career/` | Jobs, internships, employer services, and career-support features | Mixed |
| `admin/` | Administrative interfaces and resource-management workflows | Restricted |
| `legal/` | Legal notices, policies, consent preferences, and compliance-related pages | Generally public |
| `assets/` | CSS, browser-side JavaScript, public data, images, icons, fonts, and public downloads | Public |
| `public/` | Public web metadata and well-known files, including applicable verification and crawler directives | Public |
| `src/` | Backend routes, controllers, services, middleware, integrations, jobs, and workers | Server-side |
| `database/` | Schema definitions, migrations, seeds, and database test fixtures | Development/deployment |
| `storage/` | Runtime storage conventions and private or generated files where applicable | Must be access-controlled |
| `scripts/` | Development, maintenance, migration, build, and validation utilities | Execution-dependent |
| `tests/` | Unit, integration, API, database, security, end-to-end, and accessibility tests | Development/CI |
| `infrastructure/` | Deployment, backups, monitoring, database operations, queues, and infrastructure configuration | Restricted |
| `docs/` | Architecture, API contracts, setup instructions, operational procedures, and developer documentation | Generally public within the repository |

**Exposure is logical, not automatic.** Actual accessibility depends on the web server, static-file configuration, route middleware, deployment rules, and filesystem permissions.

## 3. Intended Repository Layout

The following is a conceptual layout. It must not be interpreted as a verified inventory of the current checkout.

```text
MedOrbits/
├── pages/
├── account/
├── education/
├── career/
├── admin/
├── legal/
├── assets/
│   ├── css/
│   ├── js/
│   ├── data/
│   ├── images/
│   ├── icons/
│   ├── fonts/
│   └── documents/
├── public/
├── src/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── middleware/
│   ├── validators/
│   ├── models/
│   ├── integrations/
│   ├── jobs/
│   ├── workers/
│   ├── events/
│   ├── config/
│   └── utils/
├── database/
│   ├── migrations/
│   ├── schema/
│   ├── seeds/
│   └── fixtures/
├── storage/
├── scripts/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── api/
│   ├── security/
│   ├── e2e/
│   └── fixtures/
├── infrastructure/
├── docs/
│   ├── api/
│   │   ├── README.md
│   │   └── openapi.yaml
│   └── architecture/
│       ├── repository-structure.md
│       └── application-data-flow.md
├── .gitignore
├── package.json
├── package-lock.json
└── server.js
```

Only retain or add directories that have a defined purpose and fit the actual application architecture. Do not create empty modules solely to make the repository resemble this reference.

## 4. Directory Ownership and Boundaries

### 4.1 Frontend modules

The `pages/`, `account/`, `education/`, `career/`, `admin/`, and `legal/` directories organize frontend experiences by audience or business responsibility.

Requirements:

- Keep page-specific content within its owning module.
- Reuse shared components and assets where appropriate.
- Keep navigation and asset references consistent with the deployment base path.
- Separate public pages from authenticated account workflows.
- Treat administrative interfaces as restricted, regardless of whether their HTML files are publicly reachable.
- Enforce all permissions through backend controls; hiding a button or page is not authorization.
- Do not assume a frontend feature is functional merely because its page exists.

### 4.2 Shared assets

The `assets/` directory contains resources intended for frontend delivery.

Requirements:

- Organize stylesheets, browser-side JavaScript, images, icons, fonts, and public data by responsibility.
- Do not place secrets, session data, private configuration, or private uploads in publicly served asset paths.
- Review downloadable documents before publication.
- Keep asset references and caching behavior consistent with the deployment configuration.
- Treat browser-side code and data as public, even if their URLs are difficult to guess.

Never embed server-side credentials or privileged API keys in frontend JavaScript.

### 4.3 Public directory

The `public/` directory may contain files intended to be served directly by the web server, such as verification files, crawler directives, or other public metadata.

Requirements:

- Confirm which directory the deployment actually exposes.
- Avoid placing application source, private files, backups, logs, or environment configuration in publicly served paths.
- Ensure static hosting does not accidentally expose `storage/`, `database/`, `src/`, or other sensitive directories.
- Avoid duplicating the same public file across `public/` and `assets/` without a defined reason.

The presence of `public/` does not establish that the server serves it.

### 4.4 Backend source

The `src/` directory contains server-side application logic.

| Module | Responsibility |
|—|—|
| `routes/` | HTTP route declarations and middleware composition |
| `controllers/` | HTTP request coordination and response handling |
| `services/` | Business rules and application workflows |
| `repositories/` | Database access and persistence abstractions |
| `models/` | Data models and persistence-related definitions, where used |
| `validators/` | Request and domain-input validation |
| `middleware/` | Authentication, authorization, rate limiting, and request processing |
| `integrations/` | External APIs and provider-specific adapters |
| `jobs/` | Job definitions and scheduling logic, where applicable |
| `workers/` | Asynchronous job execution, where applicable |
| `events/` | Application event definitions and handlers, where applicable |
| `config/` | Validated application configuration |
| `utils/` | Small, reusable utilities with clearly defined behavior |

Requirements:

- Keep business rules on the server.
- Validate all untrusted input.
- Enforce authentication, authorization, and resource ownership.
- Keep controllers thin and business logic in appropriate services.
- Use parameterized database operations.
- Avoid circular dependencies and unnecessary coupling.
- Use the project’s established module system and export conventions.
- Document meaningful interfaces and failure behavior.
- Avoid duplicate implementations of the same business operation.

The table describes intended responsibilities. It does not require introducing every module into a codebase that uses a different established structure.

### 4.5 Database resources

The `database/` directory owns database-related resources where this convention is used.

Requirements:

- Keep schema definitions and migration history synchronized.
- Use reviewed migrations to evolve deployed databases.
- Keep seed data distinct from production records.
- Use synthetic fixtures for tests.
- Never commit production database dumps, credentials, or private user records.
- Document migration prerequisites, rollback limitations, and data-loss risks.
- Test migrations against the database engine and version actually used by MedOrbits.

Do not assume PostgreSQL, MySQL, or another database is configured based only on the directory structure. Confirm the driver, connection configuration, schema, and deployment settings.

### 4.6 Runtime storage

The `storage/` directory describes runtime storage conventions where applicable.

Requirements:

- Keep private uploads outside publicly served directories.
- Authorize every private-file retrieval and mutation.
- Generate storage identifiers independently of user-supplied filenames.
- Define retention, deletion, and orphan-file cleanup procedures.
- Avoid storing credentials or unnecessary sensitive information in file metadata.
- Exclude private runtime files from version control.
- Prefer the configured object-storage or filesystem abstraction rather than scattering direct filesystem operations throughout controllers.

A `storage/` directory does not establish that uploads, local persistence, or a particular storage provider are configured.

### 4.7 Tests and scripts

The `tests/` directory supports quality assurance. The `scripts/` directory contains development and maintenance utilities.

Requirements:

- Organize tests by purpose and execution scope.
- Use synthetic data and isolated test resources.
- Mock external dependencies in unit tests.
- Keep integration tests isolated from production databases and payment accounts.
- Document destructive script behavior.
- Require explicit safeguards for operations that may alter production data.
- Integrate required validation, security, and test commands into CI where configured.
- Avoid scripts that silently skip failures or report success when operations fail.

### 4.8 Infrastructure

The `infrastructure/` directory may contain deployment and operational resources.

Requirements:

- Define ownership for deployment, backup, monitoring, database, and queue configuration.
- Keep credentials outside source control.
- Restrict access to backups and operational configuration.
- Document recovery procedures and operational dependencies.
- Avoid maintaining conflicting copies of the same configuration.
- Validate changes in an appropriate non-production environment where practical.

Confirm the actual deployment platform, hosting configuration, and infrastructure tools before documenting them as active.

### 4.9 Documentation

The `docs/` directory contains technical, architectural, API, and operational documentation.

Recommended organization:

```text
docs/
├── api/
│   ├── README.md
│   └── openapi.yaml
└── architecture/
    ├── repository-structure.md
    └── application-data-flow.md
```

Requirements:

- Maintain one canonical source for each documented contract.
- Link to canonical documents instead of duplicating specifications.
- Identify proposed functionality and unresolved placeholders.
- Verify referenced paths, scripts, environment variables, and commands.
- Update documentation when implementation behavior changes.
- Avoid including secrets, personal records, or sensitive operational details.

## 5. Naming and Organization Conventions

- Use descriptive, consistent names.
- Follow existing conventions within each module.
- Keep each module focused on a clear responsibility.
- Use documented interfaces for shared modules.
- Avoid duplicate sources of truth.
- Keep nested `README.md` files synchronized with their actual directories.
- Keep configuration, manifests, schemas, and examples aligned with installed dependencies.
- Prefer explicit resource ownership over undocumented cross-module dependencies.
- Remove unused code only after verifying imports, runtime references, build scripts, and deployment dependencies.
- Avoid changing directory names or module boundaries without reviewing affected import paths and deployment configuration.

## 6. Security and Version-Control Rules

Do not commit the following unless an explicit, reviewed exception is justified:

- Environment files containing real secrets.
- Passwords, private keys, session tokens, or API credentials.
- Private user documents or runtime uploads.
- Production logs containing sensitive information.
- Production database dumps or private database exports.
- Payment-provider secrets or private webhook configuration.
- Generated files containing private or environment-specific data.
- Backups containing production records.

Use `.gitignore` to exclude appropriate files, but remember that `.gitignore` does not remove files already tracked by Git.

Before committing:

1. Inspect the staged file list.
2. Review diffs for secrets and private data.
3. Check for accidental database exports, logs, and generated files.
4. Confirm that public assets are safe for public repository access.
5. Run the relevant validation and tests.

If a secret has already been committed, revoke or rotate it. Deleting it from the latest commit alone may not remove it from repository history.

## 7. Repository Verification Workflow

Before treating a directory or path as implemented:

1. Confirm that the path exists in the current checkout.
2. Inspect its contents and relevant imports.
3. Identify its responsibility from the code and configuration.
4. Verify referenced routes, scripts, dependencies, and integrations.
5. Confirm whether it is included in the build or deployment.
6. Review whether it contains public or private resources.
7. Update the canonical documentation.
8. Run relevant checks after structural changes.

If a module is planned but absent, label it as planned. Do not describe it as operational.

## 8. Recommended Automated Checks

Integrate checks that match the existing toolchain:

| Check | Purpose |
|—|—|
| Dependency installation from lockfile | Reproducible dependency resolution |
| Syntax and static checks | Detect malformed code and selected defects |
| Unit tests | Verify isolated business logic |
| Integration tests | Verify service and persistence interactions |
| API contract validation | Check OpenAPI syntax and structure |
| Security tests | Check authorization and sensitive-data boundaries |
| Build or deployment checks | Detect missing files and configuration |
| Secret scanning | Detect accidentally committed credentials |

Use the scripts and test commands actually defined in `package.json` and CI. Do not document a check as active until the configuration confirms it.

## 9. Change Management

When adding, removing, or reorganizing a top-level module:

1. Define the module’s responsibility and owner.
2. Identify dependencies on existing modules.
3. Review authentication, authorization, and data-access implications.
4. Update imports, routes, build scripts, and deployment configuration as needed.
5. Update the repository structure documentation.
6. Update tests and CI checks.
7. Review version-control exclusions and static-serving rules.
8. Run relevant tests and validation.
9. Inspect the final diff before merging.

Avoid moving runtime data, user uploads, or database resources without a documented migration and recovery plan.

## 10. Maintenance Checklist

- [ ] Top-level directories have clear responsibilities.
- [ ] Documented paths exist or are explicitly identified as planned.
- [ ] Nested README files reflect actual contents.
- [ ] File paths and documentation links resolve correctly.
- [ ] Public assets contain no secrets or private uploads.
- [ ] Static hosting does not expose private directories.
- [ ] Database migrations, schema documentation, and seed data are consistent.
- [ ] Scripts and tests use isolated resources and synthetic data where appropriate.
- [ ] Environment-specific configuration contains no committed credentials.
- [ ] API and architecture documentation reflect implemented behavior.
- [ ] CI validates the required checks configured by the project.
- [ ] Structural changes have been tested and reviewed.

## 11. Definition of Done

A repository-structure change is complete when:

1. Directory ownership and module boundaries are documented.
2. Imports, routes, build configuration, and deployment configuration are consistent.
3. Security and data-access implications have been reviewed.
4. Relevant tests and validation pass.
5. Documentation matches the resulting repository.
6. No accidental secrets, private files, or production data are introduced.

**Maintenance principle:** Keep the MedOrbits repository modular, secure, documented, and consistent with the actual implementation. Avoid duplicate sources of truth and never describe planned components as completed functionality.
