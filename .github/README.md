
# MedOrbits — GitHub Actions Workflows

**Purpose:** Continuous integration and deployment (CI/CD), quality assurance, application security, dependency management, document validation, release management, and deployment automation.

**Directory:** `.github/workflows/`

**Project:** MedOrbits

—

## 1. Overview

The `.github/workflows/` directory contains GitHub Actions workflows for automating repository validation and development operations.

The objectives are to:

- Detect code, configuration, and data errors before merging changes.
- Run automated tests and report failures.
- Identify security vulnerabilities and accidentally committed credentials.
- Maintain dependency and lockfile consistency.
- Validate document manifests and resource catalogues.
- Synchronize verified official release information.
- Support controlled application deployment and release publishing.

**Operational principle:** A workflow’s filename or intended purpose does not establish that it is correctly configured, has executed successfully, or is safe for production. Verify its source, configuration, permissions, and run history before relying on it.

## 2. Workflow Inventory

The following table describes intended responsibilities. Confirm that each file exists and that its implementation matches the description before treating it as operational.

| Workflow | Intended responsibility |
|—|—|
| `ci.yml` | Continuous integration and general quality checks |
| `tests.yml` | Unit and integration tests, coverage, and test artifacts |
| `codeql.yml` | Static application security analysis |
| `dependency-review.yml` | Dependency changes introduced through pull requests |
| `secret-scan.yml` | Detect potentially exposed credentials and secrets |
| `security.yml` | Consolidated security and dependency checks |
| `deploy.yml` | Deployment eligibility checks and provider-specific deployment |
| `release.yml` | Release tag validation and GitHub Release publishing |
| `lockfile.yml` | Lockfile consistency or dependency management, depending on implementation |
| `update-lockfile.yml` | Manually initiated lockfile generation, validation, and optional commit |
| `sync-official-releases.yml` | Synchronize verified official release information |
| `validate-config.yml` | Project configuration and structured-data validation |
| `validate-project.yml` | Package metadata, JSON, workflow YAML, lockfile, and JavaScript validation |
| `validate-documents.yml` | Document manifest and catalogue validation |

Remove obsolete entries and update this inventory when workflows are renamed, combined, or deleted. Do not assume that similarly named workflows exist or perform equivalent checks.

## 3. Continuous Integration and Testing

### `ci.yml`

Provides general continuous integration checks for proposed and committed changes.

Recommended responsibilities:

- Install dependencies reproducibly with `npm ci`.
- Validate JavaScript syntax.
- Check JSON files and application datasets.
- Run configured lint, formatting, and test commands.
- Execute production builds when the project defines a build process.
- Fail when a required quality check fails.

### `tests.yml`

Focuses on unit and integration tests and the collection of test reports.

Recommended responsibilities:

- Run the project’s CI test command.
- Set an appropriate test environment.
- Generate coverage and machine-readable test reports where supported.
- Upload diagnostic artifacts even when tests fail.
- Retain artifacts for a limited, documented period.

**Avoid duplicated work.** If both workflows execute the same checks, decide which workflow owns each responsibility. Keep a dedicated test workflow when its reports and test lifecycle justify the additional runtime; otherwise, consolidate overlapping jobs.

Configure required status checks only after confirming the exact job and check names reported by GitHub Actions.

## 4. Application and Dependency Security

### `codeql.yml`

Runs static application security analysis for supported source languages.

Recommended controls:

- Analyze the languages and code paths used by the application.
- Run on relevant pull requests, pushes, and scheduled intervals.
- Grant security-event write access only to jobs that need to publish findings.
- Review findings according to severity, exploitability, and application context.

A successful analysis does not prove that the application is free of vulnerabilities.

### `secret-scan.yml`

Scans repository history or changes for potential secrets, depending on its implementation.

Recommended controls:

- Scan the intended commit history.
- Avoid exposing credentials in logs and artifacts.
- Handle pull requests from forks appropriately.
- Revoke or rotate exposed credentials immediately.
- Review false positives without suppressing genuine secrets.

Removing a secret from the latest commit does not necessarily remove it from repository history or invalidate the credential.

### `dependency-review.yml`

Reviews dependency changes introduced through pull requests.

Recommended controls:

- Restrict execution to relevant pull requests where practical.
- Apply documented severity thresholds.
- Review newly introduced licenses according to project policy.
- Account for missing or unavailable dependency metadata.
- Document how the workflow treats unknown licenses and dependency scopes.

### `security.yml`

May provide a consolidated security gate for dependency auditing, static analysis, secret scanning, and configuration validation.

Before maintaining it alongside dedicated security workflows, review:

- Duplicate scans and excessive runtime.
- Permission differences between jobs.
- Conflicting severity thresholds.
- Failure and cancellation behavior.
- Whether branch protection requires the consolidated result or individual checks.

## 5. Dependency and Lockfile Management

### `lockfile.yml`

Inspect its implementation to determine whether it verifies lockfile consistency, generates a lockfile, or performs another dependency operation.

### `update-lockfile.yml`

Supports manually initiated lockfile generation and validation, with an optional commit-and-push stage if implemented.

Recommended practices:

- Keep `package.json` and `package-lock.json` synchronized.
- Use `npm ci` to validate reproducible dependency installation.
- Validate lockfile metadata and dependency installation before accepting changes.
- Review generated lockfile changes before merging.
- Avoid force-pushing generated changes.
- Do not automatically bypass protected branch rules.
- Ensure a write-enabled job commits only the intended lockfile.
- Verify that the target branch has not advanced since validation.

Grant `contents: write` only to a dedicated job that needs to commit changes. Prefer a pull request for automated dependency changes when repository policy prohibits direct pushes.

Lockfile synchronization does not establish that every dependency is secure, compatible, or free from supply-chain risks.

## 6. Deployment and Release Management

### `deploy.yml`

Handles deployment-related checks and, if implemented, the actual deployment to the configured provider.

Before enabling production deployment:

1. Verify the deployment target and provider API.
2. Configure required secrets and environment variables.
3. Create a protected production environment where appropriate.
4. Confirm that the intended commit is the one being deployed.
5. Require successful quality and security gates.
6. Prevent overlapping deployments from interfering with each other.
7. Implement health checks and a tested recovery or rollback procedure.
8. Verify how timeouts and unsuccessful provider responses are handled.

Preflight validation is not deployment. Confirm that the workflow makes the provider-specific deployment request and correctly handles failures, timeouts, and deployment status.

### `release.yml`

Supports release validation and GitHub Release publishing.

Recommended controls:

- Validate release tags against the project’s versioning policy.
- Confirm that the tag points to the intended commit.
- Verify package metadata and required release checks.
- Grant `contents: write` only to the publishing job.
- Handle existing releases without silently publishing incorrect or duplicate artifacts.
- Use protected environments or approvals for sensitive release operations.
- Document whether releases contain source code only or include built artifacts.

Creating a GitHub Release does not automatically publish a package to npm or deploy the website. Configure registry publishing and production deployment separately, with their own credentials and permissions.

## 7. Configuration and Document Validation

### `validate-config.yml`

Validates project configuration and structured data, depending on implementation.

Recommended checks:

- Parse JSON files and reject invalid syntax.
- Parse workflow YAML using a dedicated YAML parser.
- Validate required package metadata.
- Verify package-lock synchronization without silently modifying tracked files.
- Check JavaScript syntax where applicable.
- Fail on missing required files and scripts.

YAML syntax validation alone does not guarantee that a GitHub Actions workflow uses valid event names, action inputs, permissions, or expressions.

### `validate-project.yml`

Validates project configuration and common repository assets.

Expected checks, subject to implementation:

- Verify required package files and metadata.
- Parse repository JSON files.
- Run application-data validation scripts where configured.
- Verify lockfile synchronization.
- Parse GitHub Actions workflow YAML.
- Check JavaScript syntax.
- Detect unexpected modifications caused by validation.

Keep the workflow aligned with the actual scripts and dependencies declared in `package.json`. Clearly distinguish required checks from optional checks that are skipped when scripts are absent.

### `validate-documents.yml`

Validates MedOrbits document manifests and document catalogue data.

Recommended checks:

- Verify that required manifest and catalogue scripts exist.
- Run strict manifest validation.
- Confirm that referenced local resources exist.
- Detect duplicate document identifiers and malformed resource paths.
- Run the catalogue generator in its documented dry-run mode.
- Report validation results through the GitHub Actions job summary.

Keep this workflow aligned with the actual command-line options supported by:

- `scripts/validate-document-manifests.mjs`
- `scripts/build-document-catalogue.mjs`

Do not assume that `—strict` or `—dry-run` exists until it has been implemented and tested.

## 8. Official Release Synchronization

### `sync-official-releases.yml`

Synchronizes official release information into the repository’s designated data file.

Before enabling scheduled or write-enabled execution:

- Identify the authoritative source for release information.
- Verify source responses and the expected data structure.
- Validate entries before updating repository data.
- Handle duplicates, malformed entries, pagination, and source outages.
- Limit changes to the intended data file.
- Avoid overwriting concurrent changes.
- Prefer pull requests when branch protection requires review.

If a scheduled run fails, it should report the failure clearly rather than silently publishing stale or unverified information.

## 9. Permissions, Secrets, and Supply-Chain Security

Use least-privilege permissions at workflow and job level.

Recommended controls:

- Set explicit workflow permissions.
- Use `contents: read` by default.
- Grant `contents: write` only to jobs that must commit or publish.
- Grant security-event permissions only to jobs that upload security findings.
- Set `persist-credentials: false` when checkout credentials are not required.
- Store secrets in GitHub Actions secrets or protected environment secrets.
- Never commit real `.env` files, API tokens, database passwords, private keys, or session secrets.
- Review third-party actions before upgrading them.
- Pin actions to reviewed immutable commit SHAs when required by repository policy.
- Avoid passing untrusted pull-request content into privileged jobs.
- Review artifact contents before transferring them into write-enabled jobs.

When a credential is exposed, revoke or rotate it first. Repository history cleanup is a separate remediation step.

## 10. Branch Protection and Environments

For primary branches such as `main`, configure repository rules appropriate to the team’s workflow.

Consider requiring:

- Pull requests before merging.
- Independent review where appropriate.
- Required CI and test status checks.
- Resolution of review conversations.
- Restrictions on force pushes and branch deletion.
- Protected deployment environments for production.
- Approval before sensitive release or deployment operations.

Check that required status-check names correspond to actual workflow job names and that expected checks run for the relevant pull-request event types.

A workflow that refuses to run on protected branches may be intentional. Verify its conditions before assuming that behavior is a defect.

## 11. Database and Migration Safety

Database migration workflows should be reviewed separately from general application CI.

Before a production migration:

1. Validate migration files and migration order.
2. Back up the database and verify recovery procedures.
3. Review schema changes and application compatibility.
4. Apply changes through the project’s migration runner.
5. Check database connectivity and application health.
6. Confirm the recovery strategy if migration or deployment fails.

Do not assume MySQL DDL operations are always transactionally reversible. Design recovery around the actual database engine, migration operations, and application deployment sequence.

## 12. Required Configuration

The exact configuration depends on each workflow’s implementation.

Review for:

- Required GitHub Actions secrets and variables.
- Node.js and npm versions.
- Required files, directories, and validation scripts.
- Test, lint, formatting, and build commands.
- Deployment provider configuration.
- Registry credentials, if package publishing is enabled.
- Branch restrictions and environment approvals.
- Artifact paths and retention periods.
- External API availability and error-handling behavior.

Never create placeholder production credentials or commit actual secrets to satisfy a workflow check.

## 13. Maintenance Checklist

When adding or modifying a workflow:

- [ ] Confirm the workflow filename and purpose.
- [ ] Validate YAML syntax and GitHub Actions configuration.
- [ ] Review triggers, path filters, and branch conditions.
- [ ] Apply least-privilege permissions.
- [ ] Check referenced files, scripts, action versions, and inputs.
- [ ] Test the workflow on a non-production branch.
- [ ] Verify behavior on failure and cancellation.
- [ ] Review generated commits, release artifacts, and uploaded reports.
- [ ] Confirm that secrets are not exposed in logs.
- [ ] Update this README when responsibilities change.
- [ ] Review overlap with existing workflows.
- [ ] Confirm branch protection and required status checks.

## 14. Verification and Limitations

This document describes intended workflow responsibilities. It does not establish that the workflows exist, are valid, or run successfully.

Before relying on any security, test, release, synchronization, or deployment guarantee, verify:

1. The corresponding YAML file exists.
2. Its syntax and GitHub Actions configuration are valid.
3. Referenced scripts and package commands are implemented.
4. Required permissions, secrets, and environments are configured.
5. The workflow succeeds under its intended trigger conditions.
6. Failure paths and concurrent execution are handled correctly.
7. Its behavior matches repository branch and release policies.
8. The resulting artifacts, commits, and provider operations are correct.

Treat workflow source, repository settings, GitHub Actions run history, and deployment-provider logs as evidence of actual behavior.

—

**Project:** MedOrbits  
**Directory:** `.github/workflows/`  
**Purpose:** CI/CD, quality assurance, security, configuration validation, and release automation  
**Maintenance:** Update this document whenever workflow responsibilities or operational requirements change.
