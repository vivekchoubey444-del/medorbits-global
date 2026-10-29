MedOrbits — GitHub Actions Workflows

Automated CI/CD, quality assurance, application security, dependency management, document validation, release management, and deployment automation for the MedOrbits project.

1. Overview

The .github/workflows/ directory contains GitHub Actions workflows that automate repository validation and development operations.

The objectives are to:

* Detect code, configuration, and data errors before merging changes.
* Run automated tests and report failures.
* Identify security vulnerabilities and accidentally committed credentials.
* Maintain dependency and lockfile consistency.
* Validate document manifests and resource catalogues.
* Synchronize official release information.
* Support controlled application deployment and release publishing.

Operational principle: A workflow’s filename or intended purpose does not establish that it is correctly configured, successfully executed, or safe for production. Verify its implementation and run history before relying on it.

2. Workflow Directory

Workflow	Intended responsibility
ci.yml	Continuous integration and general quality checks
tests.yml	Unit and integration tests, coverage, and test artifacts
codeql.yml	Static application security analysis
dependency-review.yml	Dependency changes introduced by pull requests
secret-scan.yml	Detect potentially exposed credentials and secrets
security.yml	Consolidated security and dependency checks
deploy.yml	Deployment eligibility checks and provider-specific deployment
release.yml	Release tag validation and GitHub Release publishing
lockfile.yml	Lockfile generation or consistency checks, depending on implementation
update-lockfile.yml	Manually initiated lockfile generation and validation
sync-official-releases.yml	Synchronize verified official release information
validate-config.yml	Validate project configuration and structured data
validate-documents.yml	Validate document manifests and resource catalogues

Confirm that each file exists under .github/workflows/ and that its actual steps match the responsibilities above. Remove obsolete entries and update this table when workflows are renamed, combined, or deleted.

3. Continuous Integration and Testing

ci.yml

Provides the primary continuous integration checks for proposed and committed changes.

Recommended responsibilities:

* Install dependencies reproducibly with npm ci.
* Validate JavaScript syntax.
* Check JSON files and application datasets.
* Run configured lint, formatting, and test commands.
* Execute production builds when the project defines a build process.
* Fail the workflow when a required quality check fails.

tests.yml

Focuses on unit and integration tests and the collection of test reports.

Recommended responsibilities:

* Run the project’s CI test command.
* Set an appropriate test environment.
* Generate coverage and machine-readable test reports where supported.
* Upload diagnostic artifacts even when tests fail.
* Retain artifacts for a limited, documented period.

Avoid duplicated work: If both workflows run the same checks, decide which workflow owns each check. Keep a dedicated test workflow if its reports and test lifecycle provide sufficient value; otherwise, consolidate overlapping jobs.

Configure required status checks in branch protection only after confirming the exact job names reported by GitHub Actions.

4. Application and Dependency Security

codeql.yml

Runs static application security analysis to identify potential vulnerabilities in supported source code.

Recommended controls:

* Analyze the languages and code paths used by the application.
* Run on relevant pull requests, pushes, and scheduled intervals.
* Grant security-event write access only to jobs that need to publish analysis results.
* Review findings and address them according to severity, exploitability, and application context.

secret-scan.yml

Scans repository history or changes for potential secrets, depending on its implementation.

Recommended controls:

* Scan the intended commit history.
* Avoid exposing credentials in logs and artifacts.
* Use appropriate handling for pull requests from forks.
* Rotate or revoke any exposed credential immediately.
* Review false positives without suppressing genuine secrets.

Removing a secret from the latest commit does not necessarily remove it from repository history or invalidate the credential.

dependency-review.yml

Reviews dependency changes introduced through pull requests.

Recommended controls:

* Restrict the workflow to relevant dependency changes where practical.
* Apply documented severity thresholds.
* Review newly introduced licenses according to the project’s licensing policy.
* Account for the workflow’s behavior when dependency metadata is missing or unavailable.

security.yml

May provide a consolidated security gate for dependency auditing, static analysis, secret scanning, and configuration validation.

Before maintaining it alongside the dedicated security workflows, check for duplicated scans, excessive runtime, conflicting permissions, and inconsistent failure policies.

A successful security scan does not guarantee that the application is free of vulnerabilities.

5. Dependency and Lockfile Management

lockfile.yml

Inspect its implementation to determine whether it verifies lockfile consistency, generates a lockfile, or performs another dependency operation.

update-lockfile.yml

Supports manually initiated lockfile generation and validation.

Recommended practices:

* Keep package.json and package-lock.json synchronized.
* Use npm ci for reproducible CI dependency installation.
* Validate lockfile metadata and dependency installation before accepting changes.
* Review generated lockfile changes before merging.
* Avoid force-pushing generated changes.
* Do not automatically bypass protected branch rules.

Grant contents: write only to a dedicated job that actually needs to commit changes. Prefer a pull request for automated dependency changes when direct pushes are prohibited by repository policy.

Lockfile synchronization does not establish that every dependency is secure, compatible, or free from supply-chain risks.

6. Deployment and Release Management

deploy.yml

Handles deployment-related checks and, if implemented, the actual deployment to the configured provider.

Before enabling production deployment:

1. Verify the deployment target and provider API.
2. Configure the required secrets and environment variables.
3. Create a protected production environment where appropriate.
4. Confirm that the intended commit is the one being deployed.
5. Require successful quality and security gates.
6. Prevent overlapping deployments from interfering with each other.
7. Implement health checks and a tested recovery or rollback procedure.

Preflight validation is not deployment. Confirm that the workflow includes the provider-specific deployment request and handles failures, timeouts, and deployment status correctly.

release.yml

Supports release validation and GitHub Release publishing.

Recommended controls:

* Validate release tags against the project’s versioning policy.
* Confirm that the tag points to the intended commit.
* Verify package metadata and required release checks.
* Grant contents: write only to the publishing job.
* Handle existing releases without accidentally publishing duplicate or incorrect artifacts.
* Use protected environments or approvals for sensitive release operations.

If the project also publishes packages to a registry, document that separately and configure registry-specific credentials and permissions.

7. Configuration and Document Validation

validate-config.yml

Validates project configuration and structured data, including JSON and YAML where implemented.

Recommended checks:

* Parse JSON files and reject invalid syntax.
* Parse workflow YAML using a dedicated YAML parser.
* Validate required package metadata.
* Verify package-lock synchronization without silently modifying tracked files.
* Check JavaScript syntax where applicable.
* Fail on missing required files and scripts.

YAML syntax validation alone does not guarantee that a GitHub Actions workflow uses valid event names, action inputs, permissions, or expressions.

validate-documents.yml

Validates MedOrbits document manifests and document catalogue data.

Recommended checks:

* Verify that required manifest and catalogue scripts exist.
* Run strict manifest validation.
* Confirm that referenced local resources exist.
* Detect duplicate document identifiers and malformed resource paths.
* Run the catalogue generator in its documented dry-run mode.
* Report validation results through the GitHub Actions job summary.

Keep the workflow aligned with the actual command-line options supported by:

* scripts/validate-document-manifests.mjs
* scripts/build-document-catalogue.mjs

Do not assume that a —strict or —dry-run option exists until it has been implemented and tested.

8. Official Release Synchronization

sync-official-releases.yml

Synchronizes official release information into the repository’s designated data file.

Before enabling scheduled or write-enabled execution:

* Identify the authoritative source for release information.
* Verify the source response and expected data structure.
* Validate entries before updating repository data.
* Handle duplicates, malformed entries, pagination, and source outages.
* Limit changes to the intended data file.
* Avoid overwriting concurrent changes.
* Prefer pull requests when branch protection requires review.

If a scheduled run fails, it should report the failure clearly rather than silently publishing stale or unverified information.

9. Permissions, Secrets, and Supply-Chain Security

Use least-privilege permissions at workflow and job level.

Recommended controls:

* Set explicit permissions for each workflow.
* Use contents: read by default.
* Grant contents: write only to jobs that must commit or publish.
* Grant security-event permissions only to jobs that upload security findings.
* Set persist-credentials: false when checkout credentials are not required.
* Store secrets in GitHub Actions secrets or protected environment secrets.
* Never commit real .env files, API tokens, database passwords, private keys, or session secrets.
* Review third-party actions before upgrading them.
* Pin actions to reviewed immutable commit SHAs when required by repository policy.
* Avoid passing untrusted pull-request content into privileged jobs.

When a credential is exposed, revoke or rotate it first. Repository history cleanup is a separate remediation step.

10. Branch Protection and Environments

For primary branches such as main, configure repository rules appropriate to the team’s workflow.

Consider requiring:

* Pull requests before merging.
* At least one independent review.
* Required CI and test status checks.
* Resolution of review conversations.
* Restrictions on force pushes and branch deletion.
* Protected deployment environments for production.
* Approval before sensitive release or deployment operations.

Check that required status-check names correspond to the actual workflow job names and that all expected checks run for the relevant pull-request types.

11. Database and Migration Safety

Database migration workflows should be reviewed separately from general application CI.

Before a production migration:

1. Validate migration files and migration order.
2. Back up the database and verify recovery procedures.
3. Review schema changes and application compatibility.
4. Apply changes through the project’s migration runner.
5. Check database connectivity and application health.
6. Confirm the recovery strategy if migration or deployment fails.

Do not assume MySQL DDL operations are always transactionally reversible. Design recovery around the actual database engine, migration operations, and application deployment sequence.

12. Required Configuration

The exact configuration depends on the implementation of each workflow.

Review for:

* Required GitHub Actions secrets and variables.
* Node.js and npm versions.
* Required files, directories, and validation scripts.
* Test, lint, formatting, and build commands.
* Deployment provider configuration.
* Registry credentials, if package publishing is enabled.
* Branch restrictions and environment approvals.
* Artifact paths and retention periods.
* External API availability and error-handling behavior.

Never create placeholder production credentials or commit actual secrets to satisfy a workflow check.

13. Maintenance Checklist

When adding or modifying a workflow:

* [ ]	Confirm the workflow filename and purpose.
* [ ]	Validate YAML syntax and GitHub Actions configuration.
* [ ]	Review triggers, path filters, and branch conditions.
* [ ]	Apply least-privilege permissions.
* [ ]	Check all referenced files, scripts, action versions, and inputs.
* [ ]	Test the workflow on a non-production branch.
* [ ]	Verify its behavior on failure and cancellation.
* [ ]	Review generated commits, release artifacts, and uploaded reports.
* [ ]	Confirm that secrets are not exposed in logs.
* [ ]	Update this README when responsibilities change.
* [ ]	Review overlap with existing workflows.
* [ ]	Confirm branch protection and required status checks.

14. Verification and Limitations

This document describes intended workflow responsibilities; it does not establish that the workflows exist, are valid, or run successfully.

Before relying on any security, test, release, synchronization, or deployment guarantee, verify:

1. The corresponding YAML file exists.
2. Its syntax and GitHub Actions configuration are valid.
3. Referenced scripts and package commands are implemented.
4. Required permissions, secrets, and environments are configured.
5. The workflow succeeds under its intended trigger conditions.
6. Failure paths and concurrent execution are handled correctly.
7. Its behavior matches the repository’s branch and release policies.

Treat the GitHub Actions run history, workflow source, repository settings, and deployment-provider logs as the evidence of actual behavior.

⸻

Project: MedOrbits
Directory: .github/workflows/
Purpose: CI/CD, quality assurance, security, configuration validation, and release automation
Maintenance: Update this document whenever workflow responsibilities or operational requirements change.