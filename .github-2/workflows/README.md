
# MedOrbits — GitHub Actions Workflows

Automated CI/CD, security scanning, dependency management, testing, configuration validation, and release management for the MedOrbits project.

## Overview

The workflows in this directory automate repository quality checks and support secure, reliable development and deployment.

## Workflow Directory

| Workflow | Purpose |
|—|—|
| `ci.yml` | Continuous integration and automated quality checks |
| `codeql.yml` | Static application security analysis |
| `dependency-review.yml` | Review dependency changes introduced by pull requests |
| `deploy.yml` | Deployment eligibility checks and deployment automation |
| `lockfile.yml` | Lockfile generation or consistency checks |
| `release.yml` | Release validation and GitHub Release publishing |
| `secret-scan.yml` | Detect accidentally committed secrets |
| `security.yml` | Repository security and dependency checks |
| `sync-official-releases.yml` | Synchronize official release information |
| `tests.yml` | Run automated tests and collect test artifacts |
| `update-lockfile.yml` | Update and validate dependency lockfiles |
| `validate-config.yml` | Validate repository configuration and JSON/YAML files |
| `validate-documents.yml` | Validate document manifests and resource catalogues |

> **Important:** Workflow filenames and responsibilities may change. Confirm that every listed file exists in `.github/workflows/` and that its implementation matches the description before relying on it.

## Workflow Responsibilities

### 1. Continuous Integration

`ci.yml` and `tests.yml` are intended to validate application code, execute automated tests, and report failures before changes are merged.

Recommended checks include:

- JavaScript syntax and code-quality checks
- JSON and application-data validation
- Unit and integration tests
- Formatting and lint checks
- Test coverage and build verification, where configured

Keep the checks aligned with the scripts actually defined in `package.json`.

### 2. Security

`codeql.yml`, `secret-scan.yml`, `security.yml`, and `dependency-review.yml` support static code analysis, credential detection, dependency review, and vulnerability checks.

Security requirements:

- Review findings according to severity and exploitability.
- Revoke and rotate exposed credentials immediately.
- Never commit API keys, database passwords, private keys, session secrets, or production credentials.
- Use the minimum permissions required by each workflow.
- Review third-party actions before upgrading their versions.
- Do not assume that a successful scan guarantees the repository is free of vulnerabilities.

### 3. Dependency Management

`lockfile.yml` and `update-lockfile.yml` are intended to maintain dependency-lockfile consistency.

Recommended practices:

- Keep `package.json` and `package-lock.json` synchronized.
- Use `npm ci` in CI environments when a valid lockfile is available.
- Review lockfile changes before merging.
- Investigate dependency updates that introduce high- or critical-severity vulnerabilities.
- Avoid automatically pushing dependency changes to protected branches without an approved repository policy.

Lockfile generation does not guarantee that every dependency is safe or compatible.

### 4. Deployment and Releases

`deploy.yml` handles deployment-related automation, while `release.yml` supports release validation and GitHub Release publishing.

Before enabling production deployment:

1. Configure the deployment provider and required credentials.
2. Set up a protected GitHub environment for production.
3. Require approval where appropriate.
4. Verify the exact commit being deployed.
5. Run the required tests and pre-deployment checks.
6. Define health checks, rollback procedures, and deployment failure handling.

Keep secrets out of workflow logs, generated artifacts, and committed configuration files.

**A workflow that performs preflight checks is not necessarily a workflow that deploys the application.** Confirm that provider-specific deployment steps are implemented.

### 5. Configuration and Documents

`validate-config.yml` and `validate-documents.yml` are intended to validate project configuration, document manifests, and resource data.

Maintain consistency between:

- JSON schemas and their corresponding data files
- Document manifests and referenced resources
- Validation scripts and their supported command-line options
- `package.json` scripts and the workflow commands that invoke them

Ensure that referenced validation scripts exist and that their exit codes correctly indicate validation failures.

### 6. Official Release Synchronization

`sync-official-releases.yml` is intended to synchronize official release information.

Before enabling scheduled or write-enabled execution:

- Confirm the source is authoritative.
- Validate fetched data before writing it to the repository.
- Prevent duplicate or malformed entries.
- Review the workflow’s permissions and update policy.
- Prefer pull requests for automated changes to protected branches.
- Ensure failures do not silently publish unverified release information.

## Recommended Repository Settings

- Protect `main` and any other primary development branches.
- Require pull-request reviews and applicable status checks.
- Use least-privilege GitHub Actions permissions.
- Pin third-party actions to reviewed versions or immutable commit SHAs according to repository policy.
- Store credentials in GitHub Actions secrets or environment secrets.
- Use protected environments for production deployments and releases.
- Prevent concurrent deployments from overwriting each other.
- Review security alerts and dependency updates regularly.
- Avoid exposing credentials or personal information in workflow logs.
- Review scheduled workflows and their permissions periodically.

## Required Configuration

The exact configuration depends on each workflow’s implementation.

Review the workflow files for required:

- Repository or environment secrets
- Repository variables and deployment settings
- Node.js versions and package-manager requirements
- Test, validation, and build scripts
- Deployment providers and targets
- Branch restrictions and environment approvals
- Permissions required for publishing or pushing commits

Do not create placeholder production credentials or commit `.env` files containing real secrets.

## Database Safety

Database migrations and seed operations must be handled separately from ordinary application deployment unless a deployment workflow explicitly implements a reviewed migration process.

Before applying production migrations:

1. Validate the migration files.
2. Back up the database and verify that recovery is possible.
3. Review schema changes and application compatibility.
4. Apply migrations through the project’s migration runner.
5. Run database health checks and application tests.
6. Follow a tested recovery procedure if a migration fails.

Do not assume that MySQL DDL operations can always be rolled back.

## Maintenance Checklist

When adding or modifying a workflow:

1. Use a clear workflow name and purpose.
2. Validate YAML syntax and GitHub Actions expressions.
3. Review permissions, secrets, and untrusted pull-request handling.
4. Confirm that referenced files, scripts, and action inputs exist.
5. Test the workflow on a branch before using it for production operations.
6. Review generated commits and artifacts.
7. Update this README when workflow responsibilities change.

## Limitations and Verification

This README documents the intended responsibilities of the listed workflows. It does not independently verify that each workflow exists, runs successfully, or implements the described behavior.

Before relying on a security, testing, synchronization, release, or deployment guarantee, inspect the actual workflow YAML and confirm that its steps, permissions, scripts, and external integrations are configured correctly.

—

**Project:** MedOrbits  
**Directory:** `.github/workflows/`  
**Documentation:** GitHub Actions workflow overview
