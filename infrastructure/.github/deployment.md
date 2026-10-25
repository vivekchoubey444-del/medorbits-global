
# MedOrbits — GitHub Deployment Guide

**Project:** MedOrbits — Education · Medical Admissions · Official Resources · Careers  
**File:** `infrastructure/github/deployment.md`  
**Runtime:** Node.js 20+  
**Backend:** Express.js with ES modules  
**Database:** PostgreSQL  
**Automation:** GitHub Actions  
**Status:** Deployment standard and implementation guide

—

## 1. Purpose

This document defines the recommended deployment workflow for MedOrbits using GitHub and GitHub Actions.

It establishes procedures for:

- Continuous integration and release validation.
- Secure handling of environment variables and secrets.
- Dependency installation and application checks.
- Database migration management.
- Deployment to an approved hosting platform.
- Post-deployment verification and rollback.
- Deployment permissions and auditability.

This guide describes the intended deployment process. Confirm the repository structure, package scripts, hosting provider, database setup, and deployment configuration before adopting any example as a production workflow.

## 2. Deployment Architecture

Recommended workflow:

```text
Developer
    |
    v
Feature Branch
    |
    v
Pull Request
    |
    v
GitHub Actions
    |
    +—> Install Dependencies
    |
    +—> Lint and Format Checks
    |
    +—> JSON / Schema Validation
    |
    +—> Unit and Integration Tests
    |
    +—> Build Verification
    |
    v
Required Checks Pass
    |
    v
Protected Main Branch
    |
    v
Approved Deployment Workflow
    |
    +—> Configure Environment
    |
    +—> Apply Reviewed Migrations
    |
    +—> Deploy Application
    |
    v
Health and Smoke Tests
    |
    +—> Success: Release Verified
    |
    +—> Failure: Alert and Rollback
```

The diagram is a recommended workflow, not evidence that these stages are already configured.

## 3. Repository Structure

The following is a suggested organization:

```text
repository-root/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── deploy.yml
│   ├── scripts/
│   └── ISSUE_TEMPLATE/
├── .husky/
├── api/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── middleware/
│   └── schemas/
├── assets/
│   └── data/
├── docs/
├── infrastructure/
│   └── github/
│       └── deployment.md
├── tests/
├── package.json
├── package-lock.json
└── server.js
```

Adjust this structure to match the actual repository. Do not create duplicate workflow files or middleware directories when an established implementation already exists.

## 4. Prerequisites

Before configuring deployment, verify:

- [ ] The application starts using the documented command.
- [ ] Node.js 20 or a supported newer version is specified.
- [ ] `package.json` contains the required scripts.
- [ ] The lockfile is committed.
- [ ] The PostgreSQL connection configuration is documented.
- [ ] Database migrations are version-controlled.
- [ ] Required environment variables are identified.
- [ ] A production health endpoint is available.
- [ ] Automated tests can run without production credentials.
- [ ] The hosting provider supports the required runtime.
- [ ] A rollback procedure has been documented.

Run this command locally to inspect the available npm scripts:

```bash
npm run
```

Do not configure GitHub Actions to call scripts that are absent from `package.json`.

## 5. GitHub Repository Configuration

### Branch protection

Configure a ruleset or branch protection for the production branch, commonly `main`.

Recommended controls:

- Require pull requests before merging.
- Require the appropriate CI checks to pass.
- Require review according to the project’s governance policy.
- Block force pushes to the protected branch.
- Restrict branch deletion.
- Require conversation resolution where appropriate.
- Limit bypass permissions.
- Require deployment approval for production when supported by the team workflow.

The precise rules depend on repository ownership, plan capabilities, and release requirements.

### GitHub Actions permissions

Use the minimum permissions needed by each workflow.

For ordinary CI workflows that only check out and test code:

```yaml
permissions:
  contents: read
```

Add further permissions only when a workflow genuinely needs them. For example, a workflow that publishes a release or writes a deployment status may require additional permissions.

Avoid granting `write-all` to workflows that only need to test the repository.

## 6. GitHub Secrets and Environments

Store deployment credentials in GitHub Actions secrets or the relevant hosting provider’s secret-management system.

### Recommended environment configuration

| Variable or secret | Purpose | Classification |
|—|—|—|
| `DATABASE_URL` | PostgreSQL connection string | Secret |
| `SESSION_SECRET` | Session signing or encryption configuration, according to implementation | Secret |
| `ADMIN_TOKEN` | Administrative integration credential, if implemented | Secret |
| `AI_API_KEY` | Optional server-side AI integration credential | Secret |
| `AI_API_URL` | AI provider endpoint, if configurable | Verify whether sensitive |
| `AI_MODEL` | Configured model identifier | Usually non-secret |
| `APP_BASE_URL` | Canonical application URL | Usually non-secret |
| `ALLOWED_ORIGINS` | Approved browser origins | Usually non-secret |
| `NODE_ENV` | Runtime mode | Non-secret |

Use only variables actually supported by the application.

### Secret-handling rules

- Never commit real credentials to Git.
- Never place server secrets in frontend JavaScript or public JSON files.
- Use different credentials for development, testing, staging, and production.
- Rotate credentials when exposure is suspected.
- Avoid printing environment variables in workflow logs.
- Restrict access to production environments.
- Prefer short-lived credentials and workload identity where supported.
- Keep `.env` files out of version control.

Do not use example values or placeholder credentials as production secrets.

## 7. Continuous Integration

Create or maintain a CI workflow under:

`.github/workflows/ci.yml`

The following example provides a starting point. It assumes the project has an npm lockfile and a test script. Replace the illustrative validation commands with scripts that actually exist in `package.json`.

```yaml
name: MedOrbits CI

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    name: Validate and test
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: “20”
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Inspect available scripts
        run: npm run

      - name: Run formatting check
        run: npm run format:check —if-present

      - name: Run lint
        run: npm run lint —if-present

      - name: Validate JSON
        run: npm run validate:json —if-present

      - name: Run tests
        run: npm test —if-present
```

### CI workflow limitations

This workflow is a baseline, not a complete production security pipeline.

- `—if-present` skips a missing npm script. It does not prove that the corresponding check ran.
- `npm test —if-present` can succeed without executing tests if no test script exists.
- JSON Schema validation requires an implemented validator and configured schemas.
- Integration tests may need a dedicated PostgreSQL service and isolated test credentials.
- Pin third-party GitHub Actions to reviewed commit SHAs when stronger supply-chain controls are required.
- Keep the Node.js version consistent with the project’s declared runtime policy.

Before making checks mandatory, replace optional commands with required commands once the scripts are implemented.

## 8. Database Migrations

Database migrations must be version-controlled and reviewed.

### Required practices

1. Keep migration files in the repository.
2. Test migrations against a dedicated test database.
3. Back up production data according to the recovery policy.
4. Apply migrations as a controlled deployment step.
5. Avoid destructive schema changes without a reviewed recovery plan.
6. Confirm that the application version is compatible with the migrated schema.
7. Monitor migration failures.
8. Do not automatically reset or recreate production databases during deployment.

### Expand-and-contract strategy

For changes requiring compatibility between old and new application versions:

1. Add the new schema in a backward-compatible migration.
2. Deploy code that supports both the old and new schema where necessary.
3. Backfill data using a controlled process.
4. Verify the new implementation.
5. Remove obsolete schema elements in a later release.

Do not assume that rolling back application code automatically reverses database changes.

## 9. Deployment Workflow

The actual deployment mechanism depends on the selected hosting provider.

Common approaches include:

- A hosting platform connected to GitHub.
- A GitHub Actions workflow that deploys through an approved provider integration.
- A container-based deployment.
- A self-hosted deployment runner operating in a controlled environment.

Select one authoritative deployment mechanism to avoid duplicate deployments from both GitHub Actions and automatic provider integration.

### Deployment controls

A production deployment should:

1. Use the intended production branch or an approved release tag.
2. Require all mandatory CI checks to pass.
3. Use protected production environment secrets.
4. Apply migrations through a controlled step.
5. Deploy the approved revision.
6. Wait for the platform’s deployment result.
7. Run health and smoke tests.
8. Record the deployed revision and deployment outcome.
9. Alert maintainers when deployment or verification fails.

Do not deploy unreviewed pull-request code to production.

## 10. Optional Production Deployment Workflow

The following is a **provider-neutral template**. It deliberately does not contain a deploy command because the correct command and credentials depend on the selected hosting platform.

Save as `.github/workflows/deploy.yml` only after adapting it to the real deployment mechanism.

```yaml
name: MedOrbits Production Deployment

on:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: medorbits-production
  cancel-in-progress: false

jobs:
  deploy:
    name: Deploy approved revision
    runs-on: ubuntu-latest
    timeout-minutes: 30

    environment:
      name: production

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Verify deployment branch
        if: github.ref != ‘refs/heads/main’
        run: |
          echo “Production deployment must use the main branch.”
          exit 1

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: “20”
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run required tests
        run: npm test

      - name: Deployment integration point
        run: |
          echo “Configure the approved hosting-provider deployment here.”
          echo “No application deployment has been performed by this template.”
```

**Do not treat this template as a working deployment workflow.** The final step intentionally does not deploy anything. Replace it with the approved provider’s deployment procedure, required credentials, and failure handling before enabling production use.

For production, ensure required CI checks cannot be bypassed merely by manually starting this workflow.

## 11. Health Checks and Smoke Tests

A deployment is not complete merely because the hosting platform reports that a build succeeded.

Verify:

- The application process starts successfully.
- The configured health endpoint responds as expected.
- Readiness checks reflect required dependencies.
- PostgreSQL connectivity works.
- Static assets load.
- Critical API routes respond correctly.
- Authentication and authorization behave as expected.
- Public JSON resources are available.
- Application logs contain no startup or migration errors.

Use the real configured health endpoint. Do not invent a path such as `/health` if the application exposes a different route.

### Example HTTP check

After replacing the URL with a real endpoint:

```bash
curl —fail —show-error —silent \
  —output /dev/null \
  “https://YOUR-VERIFIED-HEALTH-ENDPOINT”
```

Use the hosting provider’s documented URL and health-check path. Avoid exposing sensitive response bodies in CI logs.

## 12. Rollback and Recovery

Rollback must restore service safely without damaging persistent data.

### Initial response

1. Identify the affected release and user impact.
2. Check deployment logs, application errors, and database health.
3. Stop further releases if the issue is ongoing.
4. Use the approved rollback mechanism.
5. Verify health checks and critical user workflows.
6. Preserve relevant sanitized logs.
7. Record the incident and follow-up actions.

### Application rollback

Where supported, redeploy the last known-good application revision or use the hosting platform’s rollback feature.

Confirm that the previous application version remains compatible with the current database schema.

### Database recovery

Database recovery may require a separate procedure.

- Do not assume an application rollback reverses migrations.
- Avoid restoring a database backup without assessing data loss and consistency implications.
- Preserve necessary evidence before destructive recovery operations.
- Obtain the required authorization for production database restoration.
- Verify data integrity after recovery.

Document backup frequency, retention, recovery objectives, and restoration testing in the relevant operations guide.

## 13. Deployment Security

### Supply-chain controls

- Commit and review the package lockfile.
- Use `npm ci` for reproducible CI installation.
- Review dependency vulnerabilities.
- Use least-privilege workflow permissions.
- Review third-party GitHub Actions.
- Avoid running untrusted code with production credentials.
- Separate CI workflows from privileged deployment workflows.
- Restrict who can approve production deployments.

### Pull request safety

Workflows triggered by pull requests from forks must not receive production secrets.

Avoid privileged workflows that check out and execute untrusted pull-request code with write permissions or secrets.

### Runtime security

- Use HTTPS for production traffic.
- Validate input on the server.
- Enforce authorization on protected endpoints.
- Keep private documents outside the public web root.
- Restrict database access to the application and approved operational identities.
- Avoid logging credentials, session tokens, and personal documents.
- Configure security headers and rate limits.
- Maintain a tested incident-response process.

## 14. Deployment Troubleshooting

### Dependency installation fails

- Verify the Node.js version.
- Confirm `package.json` and the lockfile are synchronized.
- Inspect the npm error output.
- Review registry connectivity and package availability.
- Do not replace `npm ci` with an uncontrolled dependency update as the first response.

### Application fails to start

- Check the configured start command.
- Verify required environment variables.
- Inspect sanitized startup logs.
- Check module format and import paths.
- Verify that the listening port follows the hosting provider’s requirements.

### Database connection fails

- Confirm the database is reachable from the deployed service.
- Check credentials, network access, connection limits, and TLS settings.
- Verify migration status.
- Do not expose the full connection string in logs.

### Deployment succeeds but the site fails

- Verify the deployed revision.
- Check health and readiness endpoints.
- Inspect reverse-proxy routing and environment configuration.
- Check static asset paths and API base URLs.
- Test critical routes.
- Roll back if the release causes a critical regression and rollback is safe.

### GitHub Actions deployment is blocked

- Verify the workflow’s branch conditions.
- Check required status checks.
- Review GitHub Environment protection rules.
- Confirm secret names and access permissions.
- Verify the workflow has only the permissions it needs.
- Confirm the hosting provider’s deployment integration is configured.

## 15. Release Checklist

### Before deployment

- [ ] The intended revision has been reviewed.
- [ ] Required CI checks pass.
- [ ] Dependencies and lockfile are consistent.
- [ ] Environment secrets are configured securely.
- [ ] Database migrations are reviewed and tested.
- [ ] Backup and rollback procedures are available.
- [ ] The production deployment target is correct.

### During deployment

- [ ] The approved deployment mechanism is used.
- [ ] Required migrations complete successfully.
- [ ] Deployment logs are reviewed.
- [ ] The application starts successfully.
- [ ] No credentials are exposed in logs.

### After deployment

- [ ] Health checks pass.
- [ ] Critical API routes respond correctly.
- [ ] Database connectivity is confirmed.
- [ ] Authentication and authorization are verified.
- [ ] Static assets and public resources load.
- [ ] No critical errors appear in logs.
- [ ] The release revision and outcome are recorded.

## 16. Ownership and Maintenance

Review this document whenever:

- The hosting provider changes.
- GitHub Actions workflows change.
- Runtime or package-manager requirements change.
- Database migration procedures change.
- Secrets or deployment permissions change.
- Health-check endpoints change.
- Backup, recovery, or rollback procedures change.

Keep this document aligned with:

- `.github/workflows/`
- `package.json`
- `package-lock.json`
- `server.js`
- `api/openapi.yaml`, if maintained
- Database migration files
- `docs/INTEGRATION.md`
- `docs/VALIDATION.md`
- `docs/RUNNING_PYTHON.md`
- The hosting provider’s deployment configuration

—

## 17. Final Deployment Standard

A MedOrbits release is ready for production only when the approved revision has passed required checks, configuration and permissions are correct, database changes are controlled, deployment verification succeeds, and recovery procedures are available.

**Deployment principle:** Reproducible builds, least-privilege automation, verified releases, protected data, and recoverable operations.
