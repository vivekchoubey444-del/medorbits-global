
# Local Development

**Project:** MedOrbits  
**Purpose:** Establish a consistent, secure, and reproducible workflow for configuring, running, testing, and troubleshooting MedOrbits in a local development environment.

> **Implementation note:** This document describes the recommended workflow. Confirm commands, scripts, environment variables, database requirements, and directory paths against the current repository before using them. Examples are conditional and do not establish that a particular feature is implemented.

## 1. Prerequisites

Before starting, ensure the following requirements are satisfied:

- **Node.js:** Use the version specified in `.nvmrc`, if present, or the runtime requirement documented in `package.json`.
- **Package manager:** Use the package manager and lockfile committed to the repository.
- **Git:** Required to clone the repository and manage changes.
- **Database:** MySQL is required only if the current implementation uses it. Confirm the configured database driver and connection settings.
- **Environment configuration:** Use `.env.example`, if present, as the reference for local environment variables.
- **Development tools:** Install any additional tools required by the repository’s scripts, tests, database migrations, or asset-processing workflows.

Check `package.json`, the lockfile, and the project’s setup documentation before assuming a particular command is available.

## 2. Initial Setup

### Step 1 — Clone the Repository

Clone the MedOrbits repository and enter its root directory:

```bash
git clone <repository-url>
cd <repository-directory>
```

Replace the placeholders with the actual repository URL and directory name.

### Step 2 — Select the Supported Node.js Version

Check `.nvmrc`, if present, and the runtime requirements in `package.json`.

If the project uses Node Version Manager (NVM) and provides a compatible `.nvmrc`:

```bash
nvm install
nvm use
node —version
npm —version
```

If `.nvmrc` is absent, use the Node.js version specified by the project documentation and `package.json`.

Do not upgrade the runtime solely to resolve an installation error without first checking compatibility.

### Step 3 — Install Dependencies

For an npm project with a committed `package-lock.json`:

```bash
npm ci
```

This installs dependencies using the committed npm lockfile. If the repository uses another package manager, follow the equivalent lockfile-based installation workflow.

If installation fails, inspect the error and verify the runtime and lockfile before modifying dependency versions.

### Step 4 — Configure Environment Variables

If `.env.example` exists, create a local environment file from it.

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Configure the values required by the actual implementation, which may include:

- Application environment and port.
- Database connection settings.
- Session configuration and signing secrets.
- Authentication and email-service settings.
- File-storage locations.
- Payment-provider sandbox credentials.
- External API configuration.

Use generated local secrets and sandbox credentials where applicable. Never copy production secrets into the local environment.

Keep `.env` and other secret-bearing files out of version control. Verify `.gitignore` and check whether any sensitive files are already tracked; adding a path to `.gitignore` does not untrack an existing file.

Do not invent environment-variable names. Use those referenced by the application configuration and `.env.example`.

### Step 5 — Prepare the Development Database

Perform this step only if the current application requires a database.

1. Start a local database instance or provision an isolated development database.
2. Create a dedicated database and user with only the privileges required for development.
3. Configure the connection using the variables expected by the application.
4. Review the schema and migration documentation.
5. Identify the migration tool and supported migration command.
6. Apply migrations using the repository’s documented workflow.
7. Verify the resulting schema and migration state.

Do not assume that a command such as `npm run migrate` exists. Inspect `package.json`, migration scripts, and database documentation first.

Use synthetic development data rather than private production records.

### Step 6 — Validate the Environment

Run the repository’s configuration-validation or environment-check commands, if available.

Confirm that:

- Required environment variables are present.
- The application can connect to its database, if required.
- The database schema is compatible with the application.
- External services use sandbox or development configuration.
- Required upload and temporary-storage directories exist and have appropriate permissions.
- Writable paths do not expose private files through unrestricted public directories.
- Required local services are available.

Never print passwords, session secrets, API keys, tokens, or other sensitive configuration values to the terminal or logs.

### Step 7 — Start the Application

Inspect the available scripts in `package.json`:

```bash
npm run
```

Use the documented development command if one exists. For example, if `dev` is defined:

```bash
npm run dev
```

If the project instead documents a production-style start command for local use and defines `start`:

```bash
npm start
```

These commands are examples, not confirmation that either script exists.

Review the startup output for configuration errors, missing modules, database failures, and port conflicts. Confirm the actual local URL and port from the application configuration or startup logs.

### Step 8 — Run Automated Tests

Inspect the available test scripts:

```bash
npm run
```

If the repository defines a test script:

```bash
npm test
```

Run additional checks when supported, such as:

- Unit tests.
- Integration tests.
- Security tests.
- API contract validation.
- Linting and formatting.
- Database migration checks.
- Production build validation.

Use the test commands documented by the repository. Tests must not depend on production databases, live payment accounts, or uncontrolled external services.

Record known failures accurately; do not report a test suite as passing unless it has actually completed successfully.

## 3. Daily Development Workflow

For routine changes:

1. Check the current branch and working-tree status.
2. Update the branch from the appropriate upstream branch according to the team’s workflow.
3. Install dependencies if the package configuration or lockfile has changed.
4. Review the affected modules, interfaces, and dependencies.
5. Make the smallest coherent change that addresses the requirement.
6. Add or update tests for changed behavior.
7. Run relevant tests, validation scripts, and build checks.
8. Inspect logs for errors, unexpected behavior, and sensitive-data exposure.
9. Update documentation when configuration, API behavior, architecture, or operational procedures change.
10. Review the final diff before committing.

Useful Git checks include:

```bash
git status —short
git diff —check
git diff
```

Commit lockfile changes when they result from an intentional dependency update. Do not regenerate or replace a lockfile merely to suppress an installation warning.

## 4. Database and Migration Safety

Database changes must follow the repository’s migration process.

- Use an isolated development database.
- Review SQL and migration scripts before execution.
- Test migrations against a fresh database.
- Test upgrades from a representative previous schema when applicable.
- Verify data preservation and constraints after migration.
- Use synthetic data for development and testing.
- Avoid manual schema changes that bypass migration history.
- Do not run production migrations from an unreviewed local environment.
- Review destructive operations and recovery procedures before execution.
- Confirm whether the migration tool supports transactional execution and rollback for the specific operation.

Do not assume all MySQL DDL operations can be rolled back transactionally. Behavior depends on the operation, server version, and migration strategy.

For detailed procedures, consult `docs/database/migrations.md`, if present.

## 5. External Services and Integrations

Use sandbox credentials and test endpoints for payment providers, email services, authentication providers, and other external integrations whenever available.

Before testing an integration, confirm:

- Required configuration variables are present.
- Sandbox and production endpoints are clearly distinguished.
- Authentication and webhook signature verification follow the provider’s documented protocol.
- Timeout, retry, and failure behavior are understood.
- Duplicate webhook delivery and repeated requests are handled safely where applicable.
- The test cannot unintentionally create real charges, send real messages, or modify production records.

Use mocked or locally simulated integrations for unit tests whenever practical.

Do not run tests against production services unless the operation has been explicitly approved, is necessary, and has appropriate safeguards.

## 6. Security Requirements

- Never commit `.env`, credentials, API keys, private keys, or session secrets.
- Never copy production secrets into local configuration.
- Do not use private production user records for ordinary development.
- Restrict database privileges to the minimum required.
- Keep private uploads outside unrestricted public directories.
- Do not expose a local development server publicly without appropriate access controls.
- Use synthetic accounts and test credentials.
- Avoid logging authentication tokens, passwords, payment data, or sensitive personal information.
- Do not disable authentication, authorization, CSRF protections, input validation, or security middleware merely to make local development easier.
- Remove temporary files and test data when no longer needed.
- Rotate any secret that has been accidentally exposed and follow the project’s incident-response procedure.

Local development settings must not silently become production defaults.

## 7. Troubleshooting

### Dependency Installation Fails

1. Confirm the supported Node.js and package-manager versions.
2. Verify that the correct lockfile is present.
3. Review the complete installation error.
4. Check network access and registry configuration.
5. Inspect dependency compatibility before changing versions.
6. Avoid deleting or regenerating the lockfile as the first troubleshooting step.

### Application Startup Fails

1. Review the startup output and stack trace.
2. Confirm that required environment variables are configured.
3. Verify that the configured port is available.
4. Check module paths, exports, and installed dependencies.
5. Confirm that required databases and external services are reachable.
6. Check for missing configuration files and initialization failures.

### Database Connection Fails

1. Verify that the configured database service is running.
2. Check the host, port, database name, username, and password without exposing the password.
3. Confirm that the development database exists.
4. Verify that the database user has the required privileges.
5. Check whether the expected migrations have been applied.
6. Review database logs for connection, authentication, and schema errors.
7. Confirm that the application is using the intended local environment configuration.

### Tests Fail

1. Reproduce the failure using the documented test command.
2. Identify the failing test and inspect the complete error.
3. Check test-specific environment variables and database setup.
4. Ensure tests use isolated fixtures and do not modify production resources.
5. Check for order-dependent tests, shared state, timing assumptions, and external-service dependencies.
6. Determine whether the failure is caused by the change, configuration, or an existing issue.
7. Re-run the relevant tests after the fix.

Do not suppress a failing test or weaken an assertion merely to obtain a passing result without establishing why the original failure occurred.

### Port Already in Use

1. Check the port configured for the application.
2. Identify the process using that port with the appropriate operating-system tool.
3. Stop the conflicting process only if it is safe to do so, or select a supported alternative port.
4. Confirm that the application and any local clients use the same configured port.

Avoid terminating unrelated processes.

## 8. Before Submitting Changes

- [ ] The supported runtime and package manager are being used.
- [ ] Dependencies were installed using the committed lockfile.
- [ ] Local configuration is complete and secrets remain uncommitted.
- [ ] Required database migrations were reviewed and applied locally.
- [ ] Relevant tests and validation checks were run.
- [ ] Tests do not use production data or uncontrolled live services.
- [ ] No production credentials or sensitive records were introduced.
- [ ] Security-sensitive behavior was reviewed where applicable.
- [ ] Documentation was updated where necessary.
- [ ] `git diff —check` completed successfully.
- [ ] The final diff contains only intended changes.
- [ ] Test failures and unresolved issues are documented accurately.

## 9. Related Documentation

Check which files exist in the current repository before relying on these references.

- `.nvmrc` — Node.js version selection, if present.
- `package.json` — Runtime requirements and available scripts.
- `package-lock.json` — npm dependency lockfile, if used.
- `.env.example` — Environment-variable reference, if present.
- `docs/database/README.md` — Database documentation entry point, if present.
- `docs/database/schema.md` — Database schema overview, if present.
- `docs/database/migrations.md` — Database migration procedures, if present.
- `docs/database-migrations.md` — Alternative or legacy migration guide, if present.
- `docs/architecture/system-architecture.md` — System architecture, if present.
- `docs/architecture/application-data-flow.md` — Request and data-processing flows, if present.
- `docs/api/README.md` — API documentation standards, if present.
- `docs/api/openapi.yaml` — OpenAPI specification, if present.

If multiple documents cover the same procedure, identify a canonical source and update cross-references to avoid conflicting instructions.

## 10. Definition of Done

Local development setup is considered complete when:

1. The supported runtime and package manager are configured.
2. Dependencies install reproducibly from the committed lockfile.
3. Required environment variables are configured without exposing secrets.
4. Required local services and the development database are available.
5. Database migrations complete successfully where applicable.
6. The application starts using a documented command.
7. Relevant automated tests and validation checks have been run.
8. The developer can identify the local application URL and diagnose common startup failures.
9. No production data, live credentials, or unintended external side effects are introduced.

**Accuracy rule:** The current repository, its configuration, migration history, and actual runtime behavior are authoritative. This document describes the intended workflow and must be updated whenever verified project procedures change.
