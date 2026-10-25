
# MedOrbits — Development Environment

**Project:** MedOrbits — Education · Medical Admissions · Official Resources · Careers  
**File:** `infrastructure/enviroments/development.md`  
**Environment:** Local development  
**Runtime:** Node.js 20+  
**Backend:** Express.js with ES modules  
**Database:** PostgreSQL  
**Optional tooling:** Python 3, Git, GitHub Actions

—

## 1. Purpose

This document defines the recommended setup and operating practices for a local MedOrbits development environment.

The development environment enables contributors to:

- Run the application locally.
- Develop and debug API routes and frontend pages.
- Connect to a dedicated PostgreSQL database.
- Validate JSON resources and API contracts.
- Execute unit and integration tests.
- Run optional Python data-processing utilities.
- Test changes before opening a pull request.
- Keep development credentials and personal data separate from production.

**Important:** This guide describes the intended setup. Verify commands, package scripts, directory names, and environment variables against the actual repository before using them.

## 2. Development Architecture

Recommended local architecture:

```text
Developer Workstation
        |
        +—> Frontend Pages and Assets
        |
        +—> Node.js / Express Server
        |         |
        |         +—> API Routes
        |         +—> Middleware
        |         +—> Controllers
        |         +—> Services
        |         +—> Validation Schemas
        |
        +—> PostgreSQL Development Database
        |
        +—> Optional Python Utilities
        |
        +—> Automated Tests
```

Development must remain isolated from production infrastructure.

Never use production credentials or production data for ordinary local testing.

—

## 3. Prerequisites

Install the tools required by the parts of the project you intend to work on.

| Tool | Purpose |
|—|—|
| Git | Source control and branch management |
| Node.js 20+ | Application runtime |
| npm | Dependency installation and scripts |
| PostgreSQL | Local application database |
| Code editor | Editing and debugging |
| Python 3 | Optional data utilities and scripts |
| Browser | Frontend testing and debugging |

Check installed versions:

```bash
git —version
node —version
npm —version
psql —version
python —version
```

If your system exposes Python as `python3`, use:

```bash
python3 —version
```

Only install PostgreSQL or Python if the relevant development workflow requires it. The application may use a managed database or other tooling in some environments, but those dependencies must be documented explicitly.

—

## 4. Obtain the Repository

Clone the approved MedOrbits repository:

```bash
git clone YOUR_APPROVED_REPOSITORY_URL
cd YOUR_REPOSITORY_DIRECTORY
```

Replace the placeholders with the actual repository URL and directory name.

Inspect the repository before changing files:

```bash
git status
git branch —show-current
```

Check the available npm scripts:

```bash
npm run
```

Review the root `README.md`, `package.json`, and relevant documentation before starting the server.

Do not assume a command is supported simply because it appears in an example.

—

## 5. Install Node.js Dependencies

From the repository root, install dependencies using the committed lockfile:

```bash
npm ci
```

If `npm ci` fails, verify that `package.json` and `package-lock.json` are synchronized.

### Dependency rules

- Commit the appropriate lockfile.
- Use the repository’s declared Node.js version.
- Avoid unnecessary global package installations.
- Review dependency updates before merging.
- Do not run forced dependency upgrades merely to make installation succeed.
- Do not install packages directly into production from a developer workstation.

—

## 6. Configure the Development Environment

Create a local `.env` file based on the project’s example configuration, if one exists.

For example:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

If `.env.example` does not exist, consult the project’s configuration documentation before creating a new configuration file.

### Example development configuration

```dotenv
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://medorbits_dev:REPLACE_WITH_LOCAL_PASSWORD@localhost:5432/medorbits_dev

APP_BASE_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000

SESSION_SECRET=REPLACE_WITH_A_RANDOM_DEVELOPMENT_SECRET

AI_API_KEY=
AI_API_URL=
AI_MODEL=

LOG_LEVEL=debug
```

This is an illustrative template. Use only variables supported by the application.

### Configuration rules

- Generate a unique local secret.
- Never use production secrets locally.
- Keep `.env` out of version control.
- Do not commit passwords, tokens, private keys, or database connection strings.
- Validate required variables during application startup.
- Use separate configuration for tests.
- Do not expose server-side secrets in HTML, frontend JavaScript, or public JSON files.

If `ALLOWED_ORIGINS` supports a different format in the actual implementation, follow that implementation rather than assuming a comma-separated format.

—

## 7. PostgreSQL Development Database

Use a dedicated local database and a dedicated development role.

Example database setup, executed by an authorized PostgreSQL administrator:

```sql
CREATE ROLE medorbits_dev
    LOGIN
    PASSWORD ‘REPLACE_WITH_A_STRONG_LOCAL_PASSWORD’;

CREATE DATABASE medorbits_dev
    OWNER medorbits_dev;
```

Replace the placeholder password before execution. Do not reuse a production credential.

### Database preparation

1. Confirm PostgreSQL is running.
2. Verify that the development role can connect.
3. Configure the application’s database connection.
4. Apply the project’s supported migrations.
5. Verify the expected tables and constraints.
6. Run tests against the intended database.

Example connection test:

```bash
psql -h localhost -U medorbits_dev -d medorbits_dev
```

The command prompts for a password unless authentication is configured otherwise.

### Migration policy

Use the repository’s actual migration system.

Before running a migration command, verify that it exists in `package.json` or the project’s database tooling.

Never reset, drop, or recreate a production database as part of local setup.

—

## 8. Start the Application

Inspect the scripts defined in `package.json`:

```bash
npm run
```

If the repository defines a `dev` script, start the application with:

```bash
npm run dev
```

If the repository defines only a `start` script, use its documented command instead.

Do not assume `npm run dev` exists.

### Startup verification

Confirm that:

- The process starts without an exception.
- Required environment variables are accepted.
- Database connectivity succeeds where required.
- The configured port is available.
- The frontend loads.
- API routes respond as documented.
- No secret values appear in logs.

Use the actual health endpoint documented by the application. Do not assume a `/health` route exists.

—

## 9. Frontend Development

When changing frontend pages or assets:

- Follow the established design system.
- Use the existing shared JavaScript utilities where appropriate.
- Keep server-side secrets out of frontend assets.
- Use accessible labels and clear validation messages.
- Render untrusted values safely.
- Handle loading, empty, success, and failure states.
- Verify responsive behavior on mobile and desktop.
- Check browser console errors and failed network requests.

For API requests, use the project’s shared API client if one exists.

Avoid duplicating API base URLs, authentication behavior, and error-handling logic across individual pages.

—

## 10. API Development

Before changing an API endpoint:

1. Inspect the existing route.
2. Review its controller and service.
3. Check the request schema and authorization middleware.
4. Confirm the response contract.
5. Update tests.
6. Update API documentation where necessary.

### Backend requirements

- Validate request bodies, route parameters, and query parameters.
- Enforce authorization server-side.
- Use parameterized database queries.
- Apply transactions to related database operations.
- Return consistent error responses.
- Avoid exposing stack traces or internal database details.
- Rate-limit sensitive or expensive operations where appropriate.

Refer to `docs/INTEGRATION.md` and `docs/VALIDATION.md` if those documents exist in the repository.

—

## 11. JSON Data and Official Resources

MedOrbits may use JSON datasets for courses, colleges, universities, scholarships, fees, jobs, and official resources.

Before changing a dataset:

- Confirm its schema.
- Preserve stable identifiers.
- Validate JSON syntax.
- Check cross-file references.
- Record source and verification information for time-sensitive facts.
- Avoid publishing private user or applicant data.
- Verify admission dates, fees, eligibility, and other official information against authoritative sources.

Example syntax validation:

```bash
node -e “JSON.parse(require(‘node:fs’).readFileSync(‘assets/data/courses.json’, ‘utf8’)); console.log(‘Valid JSON’);”
```

Replace the file path with a real dataset in the repository.

This command validates JSON syntax only. It does not validate the schema or accuracy of the information.

Use the project’s schema-validation command when one is implemented.

—

## 12. Optional Python Utilities

Python may be used for approved data validation, reporting, or offline processing tasks.

If Python is required, follow `docs/RUNNING_PYTHON.md` when available.

A typical setup is:

```bash
python -m venv .venv
```

Activate on Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Activate on macOS or Linux:

```bash
source .venv/bin/activate
```

Install dependencies only when a requirements file exists:

```bash
python -m pip install -r scripts/python/requirements.txt
```

Do not install unnecessary Python dependencies into the Node.js application environment.

Keep `.venv/` out of version control.

—

## 13. Testing

Run the tests supported by the project.

Inspect the available scripts:

```bash
npm run
```

If the corresponding scripts exist, typical commands may include:

```bash
npm test
npm run lint
npm run format:check
npm run validate:json
```

These are examples; verify every script before using it.

### Test categories

| Category | Purpose |
|—|—|
| Unit tests | Verify individual functions and services |
| Integration tests | Verify API routes, middleware, and database interactions |
| Schema tests | Validate JSON and request contracts |
| Security tests | Check authentication and authorization boundaries |
| Regression tests | Prevent previously fixed defects from returning |
| UI tests | Verify important user workflows and responsive behavior |

Use a separate test database and test credentials.

Never execute destructive tests against production resources.

—

## 14. Git Workflow

Use feature branches for changes.

Example:

```bash
git switch -c feature/short-description
```

After implementing changes:

```bash
git status
git diff
```

Run the applicable tests and checks before committing.

Stage only intended files:

```bash
git add path/to/changed-file
git diff —cached
```

Commit using the repository’s documented commit-message convention.

Example:

```bash
git commit -m “docs: improve development setup”
```

Push the branch:

```bash
git push -u origin feature/short-description
```

Open a pull request and wait for the required CI checks and reviews.

Do not bypass repository security checks merely to make a change merge.

—

## 15. Local Security Standards

Development environments must remain safe even when they contain no production data.

### Required practices

- Use unique development credentials.
- Keep `.env` files out of Git.
- Never commit API keys or session secrets.
- Use synthetic or appropriately anonymized test data.
- Keep private application documents out of public directories.
- Validate uploads and external inputs.
- Avoid running unknown scripts without reviewing them.
- Keep dependencies updated through reviewed changes.
- Restrict database roles to the privileges needed for development.
- Do not disable TLS verification as a workaround for connection failures.

### Data handling

Do not copy real applicant identity documents, credentials, or other sensitive personal data into local test fixtures unless an explicitly approved process permits it and appropriate safeguards are applied.

—

## 16. Troubleshooting

### `npm ci` fails

- Check the Node.js and npm versions.
- Verify the lockfile is present.
- Check whether the lockfile matches `package.json`.
- Review the npm error output.
- Avoid forced dependency updates as the first troubleshooting step.

### Application fails to start

- Confirm the command exists in `package.json`.
- Check required environment variables.
- Verify the port is available.
- Inspect sanitized startup logs.
- Check import paths and ES module configuration.

### PostgreSQL connection fails

- Confirm PostgreSQL is running.
- Verify the hostname, port, database, and role.
- Check the local password and authentication settings.
- Confirm the database exists.
- Verify network and TLS settings where applicable.

### API returns an error

- Check the route and HTTP method.
- Verify the request payload.
- Review authentication and authorization.
- Check server logs for a sanitized error.
- Confirm the frontend and backend contracts match.

### JSON validation fails

- Inspect the file for malformed syntax.
- Check required fields and expected data types.
- Verify references to related datasets.
- Confirm that the validation command uses the intended schema.

### Git hooks reject a commit

- Read the hook’s failure output.
- Run the reported check locally.
- Fix the underlying issue.
- Retry the commit after the checks pass.

Do not remove a security or validation hook merely to bypass a legitimate failure.

—

## 17. Development Readiness Checklist

### Environment

- [ ] Required runtimes are installed.
- [ ] Dependencies install reproducibly.
- [ ] Local environment variables are configured.
- [ ] Development credentials are separate from production.
- [ ] PostgreSQL connectivity works where required.

### Application

- [ ] The documented startup command works.
- [ ] Required routes are mounted.
- [ ] Frontend assets load.
- [ ] API responses match the documented contract.
- [ ] Logs do not expose secrets.

### Quality

- [ ] Applicable unit tests pass.
- [ ] Integration tests pass where implemented.
- [ ] JSON and schema validation pass where configured.
- [ ] Formatting and lint checks pass where configured.
- [ ] Changes have been reviewed with `git diff`.

### Security

- [ ] `.env` is excluded from version control.
- [ ] No secrets are committed.
- [ ] Test data contains no unauthorized sensitive information.
- [ ] Database permissions are appropriately restricted.
- [ ] Private documents are not publicly exposed.

—

## 18. Definition of Done

A development environment is ready when:

1. Required tools and versions are documented.
2. Dependencies install successfully.
3. Configuration is complete and secrets remain private.
4. The application starts using a verified command.
5. Required database connections work.
6. Relevant tests can run safely.
7. Validation checks behave as expected.
8. Contributors can create branches and submit pull requests.
9. Local development does not depend on production credentials.
10. The setup instructions match the actual repository.

—

## 19. Related Documentation

Review these documents when available:

- `README.md`
- `docs/INTEGRATION.md`
- `docs/VALIDATION.md`
- `docs/RUNNING_PYTHON.md`
- `docs/TESTING.md`
- `docs/CONTRIBUTING.md`
- `infrastructure/github/README.md`
- `infrastructure/github/ci.md`
- `infrastructure/github/deployment.md`

Verify the paths against the actual repository structure.

—

## 20. Maintenance

Update this document when:

- Node.js or Python requirements change.
- Dependencies or package scripts change.
- Database setup or migrations change.
- Environment variables are added or removed.
- The development workflow changes.
- Testing or validation requirements change.
- Repository security controls change.

**Development principle:** Reproducible setup, isolated resources, safe test data, validated changes, and no dependency on production secrets.

**Document owner:** MedOrbits maintainers  
**Review cadence:** After significant development workflow changes and periodically
