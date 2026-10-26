MedOrbits — GitHub Actions Workflows

Automated CI/CD, security scanning, dependency management, testing, configuration validation, and release management for the MedOrbits project.

Overview

The .github/workflows/ directory contains GitHub Actions workflows that support repository validation, security monitoring, dependency review, release management, and deployment preparation.

Each workflow should have a clearly defined purpose, least-privilege permissions, explicit failure behavior, and documented prerequisites. A workflow’s presence does not guarantee that it runs successfully or that an external service is configured correctly.

Workflow Directory

Workflow file	Responsibility
ci.yml	Continuous integration and repository quality checks
codeql.yml	CodeQL static security analysis
dependency-review.yml	Review dependencies introduced by pull requests
deploy.yml	Production deployment eligibility and preflight checks
deploy_staging.yml	Staging validation and deployment preflight
generate-lockfile.yml	Generate and validate a package lockfile for review
release.yml	Validate version tags and create GitHub Releases
secret-scan.yml	Scan repository history for exposed secrets
stale_issue.yml	Manage inactive issues and pull requests
test-test.yml	Additional repository validation and application tests

Other workflow files may exist, including security.yml, lockfile.yml, update-lockfile.yml, sync-official-releases.yml, tests.yml, and validate-config.yml. Verify their presence and implementation before treating them as active workflows. Avoid maintaining multiple workflows that perform the same task without a clear reason.

1. Continuous Integration

ci.yml

The main CI workflow validates the repository and runs configured quality checks on supported branches and pull requests.

Expected responsibilities:

* Validate package.json and package-lock.json.
* Check JSON files for malformed content.
* Install dependencies using the committed lockfile.
* Run configured tests, linting, project checks, and builds.
* Report failures so they can be investigated before merging.

Commands such as npm test —if-present may succeed without executing tests when the script is absent. Required checks should be mandatory once the relevant scripts have been confirmed in package.json.

test-test.yml

This additional workflow provides a separate repository-validation and application-test pipeline.

Keep it only if it provides value beyond ci.yml. Duplicate workflows can consume CI minutes and produce confusing status checks. If both are required, document why their coverage or trigger conditions differ.

2. Security Scanning

codeql.yml

Runs CodeQL analysis for JavaScript and TypeScript, including the configured security-extended query suite.

Security responsibilities:

* Identify potential vulnerabilities through static analysis.
* Validate repository JSON and package metadata.
* Run configured tests and checks.
* Upload analysis results using the permissions required by CodeQL.

A successful CodeQL run does not establish that an application is vulnerability-free. Review findings according to severity, exploitability, and application context.

secret-scan.yml

Uses Gitleaks to detect potential credentials and secrets committed to repository history.

If a real credential is exposed:

1. Revoke or rotate it immediately.
2. Inspect the affected commits and logs.
3. Remove the exposed value from active configuration.
4. Review whether history cleanup is necessary and coordinate it carefully.
5. Store replacement credentials in GitHub Actions secrets, environment secrets, or an appropriate secret manager.

Removing a credential from the latest commit does not invalidate a credential that was already exposed.

dependency-review.yml

Reviews dependency changes introduced by pull requests and can block changes based on configured vulnerability-severity and license policies.

Before relying on this workflow:

* Confirm GitHub Dependency Review is available for the repository.
* Verify that dependency changes are evaluated for the intended package ecosystems.
* Review the GPL and AGPL restrictions against the project’s licensing policy.
* Confirm that pull-request permissions and fork handling follow the repository’s security requirements.

A dependency-review result covers the data and ecosystems that the action can evaluate; it is not a complete software supply-chain audit.

3. Dependency and Lockfile Management

generate-lockfile.yml

Generates a package-lock.json through a manually triggered workflow and validates the result.

The recommended process is to generate the file in an isolated runner, validate it, and provide it as an artifact for review. Changes should be reviewed before being committed to a protected branch.

Lockfile consistency

Use npm ci in CI environments when a valid package-lock.json is committed. It installs from the lockfile and fails if the lockfile is inconsistent with the package manifest.

Do not automatically regenerate or push lockfile changes to main unless a reviewed repository policy explicitly permits that behavior.

Lockfile validation does not prove that dependencies are secure, compatible, or free from malicious code.

4. Deployment Workflows

deploy.yml

Handles production deployment eligibility and preflight checks.

The preflight implementation validates the selected commit and project configuration. Preflight is not the same as deployment. A provider-specific deployment step must be implemented before this workflow can release an application to production.

Before enabling production deployment:

1. Configure the actual hosting provider and deployment credentials.
2. Protect the GitHub production environment.
3. Require approval where appropriate.
4. Verify the exact commit to be deployed.
5. Run mandatory tests and build checks.
6. Implement health checks and failure handling.
7. Document and test the rollback procedure.

deploy_staging.yml

Provides staging eligibility checks and application validation for the configured staging branches.

The current preflight design does not contact a hosting provider or deploy the application. A real staging release requires an explicit provider-specific deployment step, staging-specific configuration, and an appropriate staging environment.

Staging and production credentials must remain separate.

5. Release Management

release.yml

Validates a version tag, checks that the tag matches package.json, runs the configured release checks, and creates a GitHub Release after successful validation.

Expected release safeguards:

* Require semantic version tags in vMAJOR.MINOR.PATCH format.
* Validate the exact tagged commit.
* Check package and lockfile metadata.
* Run tests and configured quality checks.
* Grant write permission only to the job that creates the release.
* Refuse to overwrite an existing GitHub Release.

This workflow creates a GitHub Release. It does not automatically publish a package to npm or deploy the application.

For npm publication, maintain a separate workflow with an explicit registry, publishing permissions, and trusted-publishing or token configuration.

6. Inactive Issue Management

stale_issue.yml

Identifies inactive issues and pull requests, applies a stale label, and may close items after the configured grace period.

Before enabling automatic closure:

* Verify that the configured labels exist.
* Exempt security reports, high-priority work, and other issues that must remain open.
* Choose inactivity periods that give maintainers and contributors sufficient time to respond.
* Review the workflow’s permissions and closure behavior.

Automatic stale management should not close active security incidents or critical maintenance work.

7. Additional Workflow Files

The following names may be used for additional capabilities, but their behavior must be confirmed from the actual YAML before being treated as implemented:

Workflow file	Intended purpose
security.yml	Additional security and dependency checks
lockfile.yml	Lockfile validation or maintenance
update-lockfile.yml	Dependency-lockfile updates
sync-official-releases.yml	Synchronization of authoritative release information
tests.yml	Test execution and test artifacts
validate-config.yml	Configuration and JSON/YAML validation
validate-documents.yml	Document manifests and resource catalogues

Avoid creating redundant workflows with overlapping triggers and responsibilities. Prefer a clear workflow structure with one authoritative CI pipeline and narrowly scoped security, release, and deployment workflows.

8. Permissions and Repository Security

Recommended repository settings:

* Protect main and other important branches.
* Require pull-request reviews and required CI checks.
* Use the minimum GITHUB_TOKEN permissions needed for each job.
* Review third-party actions before upgrading them; pin actions to immutable commit SHAs when required by repository policy.
* Store secrets in GitHub Actions or environment secrets, never in committed .env files.
* Protect production and release environments with approval rules where appropriate.
* Avoid executing untrusted pull-request code in privileged workflows.
* Prevent concurrent deployments from overwriting each other.
* Review dependency alerts and secret-scan findings regularly.

A workflow should not receive write permissions merely because another workflow needs them.

9. Required Configuration

Requirements depend on the actual implementation of each workflow. Review the YAML and project configuration for:

* Required repository and environment secrets.
* Repository variables and provider-specific deployment settings.
* Node.js and package-manager versions.
* Required scripts in package.json.
* Test, lint, build, and validation commands.
* Branch restrictions and workflow triggers.
* GitHub environment approvals.
* External services, API credentials, and registry configuration.

Do not invent production credentials or commit placeholder secrets that could be mistaken for working configuration.

10. Database and Migration Safety

Database migrations must be treated as a separate, controlled deployment operation unless an explicitly reviewed workflow implements them.

Before applying production migrations:

1. Validate the migration files.
2. Back up the database and verify that recovery is possible.
3. Review schema changes and application compatibility.
4. Use the project’s actual migration runner.
5. Run database and application health checks.
6. Follow a tested recovery procedure if a migration fails.

MySQL DDL operations cannot always be rolled back transactionally. Do not assume that reversing an application deployment automatically reverses database changes.

11. Maintenance Checklist

When creating or updating a workflow:

1. Confirm the exact filename and intended responsibility.
2. Validate YAML syntax and GitHub Actions expressions.
3. Review permissions, secrets, and untrusted pull-request handling.
4. Confirm every referenced file, script, action input, and environment exists.
5. Test the workflow on a non-production branch.
6. Review generated artifacts and proposed changes before merging.
7. Update this README when workflow behavior changes.
8. Remove redundant workflows only after confirming that no required functionality or branch protection depends on them.

12. Verification and Limitations

This README describes the intended responsibilities of the listed workflows. It does not independently prove that each workflow exists, passes, or implements every described feature.

Before relying on a security, testing, release, synchronization, or deployment guarantee, inspect the actual YAML and verify its triggers, steps, permissions, scripts, and external integrations.

In particular:

* A passing preflight does not prove that deployment succeeds.
* A passing test command does not prove tests ran if the command uses —if-present.
* A lockfile’s valid JSON does not prove dependency integrity.
* A successful security scan does not guarantee the absence of vulnerabilities.
* A workflow that creates a GitHub Release does not necessarily publish a package or deploy an application.

⸻

Project: MedOrbits

Directory: .github/workflows/

Document: Workflow directory overview and operational safety guide