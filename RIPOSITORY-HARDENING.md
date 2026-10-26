Repository Hardening Guide

Project: MedOrbits
Document type: Repository security and integrity standard
Status: Implementation checklist
Priority: High
Scope: Git integrity, source code, dependencies, CI/CD, secrets, configuration, and deployment security

⸻

1. Purpose

This document defines a practical hardening process for improving repository security, protecting existing files, preventing accidental data loss, and maintaining reliable builds and deployments.

Hardening must preserve existing functionality and newly created files. All potentially destructive operations must be reviewed before execution.

2. Core Security Principles

1. Preserve first: Create and verify a backup before destructive changes.
2. Least privilege: Give workflows, tokens, and deployment credentials only the permissions they require.
3. No exposed secrets: Never commit passwords, private keys, access tokens, API keys, or production credentials.
4. Review before modifying: Inspect diffs and conflict markers before merging or restoring files.
5. Automate validation: Run appropriate checks before merging changes.
6. Fail safely: Stop deployment when mandatory validation fails.
7. Document exceptions: Record accepted risks and explain why they are necessary.
8. Verify recovery: Periodically test backup restoration.

3. Repository Integrity

3.1 Before making changes

* [ ]	Confirm the repository root and current branch.
* [ ]	Review git status —short —branch.
* [ ]	Inspect staged and unstaged changes.
* [ ]	Identify untracked files that must be preserved.
* [ ]	Check for unresolved merge conflicts.
* [ ]	Create an external backup when changes are risky.
* [ ]	Verify that the backup archive can be listed and extracted.
* [ ]	Record the current commit hash.

Example read-only checks:

git rev-parse —show-toplevel
git branch —show-current
git rev-parse HEAD
git status —short —branch
git diff —stat
git diff —cached —stat
git diff —name-only —diff-filter=U
git ls-files —others —exclude-standard

Do not run git reset —hard, git clean -fd, or broad deletion commands as routine cleanup.

3.2 Conflict resolution

For every conflicted file:

1. Identify the base, incoming, and current changes.
2. Compare both sides before editing.
3. Preserve valid additions from each side.
4. Check whether new files are untracked or ignored.
5. Remove conflict markers only after reconciling the content.
6. Review the complete file after editing.
7. Stage only files that have been reviewed.
8. Run relevant tests and inspect the final diff.

Conflict markers include:

<<<<<<<
=======
>>>>>>>

These strings can legitimately occur in documentation, fixtures, and tests. Investigate each match rather than deleting every occurrence automatically.

3.3 Safe restoration

Before restoring tracked files:

* [ ]	Review the proposed changes.
* [ ]	Verify the backup exists outside the repository.
* [ ]	Confirm that new or untracked files are preserved.
* [ ]	Identify the exact commit that will be used as the restoration source.
* [ ]	Obtain explicit confirmation before proceeding.

Restoring from HEAD discards staged and unstaged changes to targeted tracked files. It is not the same as restoring a previous commit or recovering already-lost files.

4. Secret Management

4.1 Prohibited repository contents

Do not commit:

* Production credentials or database passwords.
* Private keys, certificates containing private keys, or signing secrets.
* Session secrets and authentication tokens.
* Cloud-provider credentials.
* Payment gateway secrets.
* Private webhook URLs or deployment hooks.
* User identity documents or confidential application records.
* Database dumps containing personal information.

4.2 Configuration practices

* Store local secrets in an ignored .env file.
* Commit a sanitized .env.example containing placeholders only.
* Read secrets from environment variables or an approved secret manager.
* Validate required environment variables at application startup.
* Never print secret values in application logs or CI output.
* Rotate credentials immediately if exposure is suspected.
* Remove exposed credentials from active use; deleting a file alone does not invalidate a leaked secret.

Example .gitignore entries:

.env
.env.*
!.env.example
*.pem
*.key
*.p12
*.pfx
secrets/
private/
credentials/
node_modules/
.venv/
__pycache__/
*.py[cod]
coverage/
dist/
build/
*.log
.DS_Store

Review these entries against actual project requirements before applying them. Do not ignore required source files, lockfiles, or deployment configuration.

5. GitHub Actions Security

5.1 Workflow permissions

* [ ]	Set workflow permissions to the minimum required.
* [ ]	Prefer contents: read for validation workflows.
* [ ]	Grant write permissions only to jobs that need them.
* [ ]	Pin third-party actions to verified full commit SHAs where practical.
* [ ]	Avoid executing untrusted pull-request code with privileged secrets.
* [ ]	Do not expose deployment credentials to forked pull requests.
* [ ]	Use protected environments for production deployments.
* [ ]	Require review for sensitive workflow changes.
* [ ]	Set appropriate timeouts for jobs.
* [ ]	Upload only necessary artifacts and avoid including secrets.

Example:

permissions:
  contents: read
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

Add these settings only where they are compatible with the workflow. Workflows that publish releases, create pull requests, or deploy may require carefully scoped additional permissions.

5.2 CI validation

A suitable validation pipeline should include applicable checks for:

* JSON syntax.
* YAML syntax.
* JavaScript and Node.js tests.
* Python linting and tests.
* HTML and CSS quality.
* Dependency and vulnerability review.
* Secret detection.
* Conflict-marker detection.
* Broken internal links and asset references.
* API schema validation.
* Build and deployment readiness.

Do not treat a successful syntax check as proof of functional correctness or security.

6. Dependency Security

* [ ]	Commit the appropriate package-manager lockfile.
* [ ]	Use reproducible installation commands in CI.
* [ ]	Review dependency changes in pull requests.
* [ ]	Enable Dependabot or another supported update mechanism.
* [ ]	Run vulnerability audits.
* [ ]	Investigate critical and high-severity findings.
* [ ]	Remove unused packages after verifying they are unnecessary.
* [ ]	Test upgrades before deployment.
* [ ]	Avoid blindly applying force upgrades.

For Node.js projects:

node —version
npm —version
npm ci
npm audit
npm test

Run commands only when compatible with the project’s package manager and available scripts. npm audit can return a nonzero exit code when vulnerabilities are found; review the findings rather than suppressing the failure.

7. Application Security

For the MedOrbits backend and web application, review the following controls.

7.1 HTTP security

* [ ]	Enable appropriate security headers.
* [ ]	Configure Content Security Policy for the actual application.
* [ ]	Use HTTPS in production.
* [ ]	Set secure cookie attributes where cookies are used.
* [ ]	Configure CORS with explicit trusted origins.
* [ ]	Apply rate limits to authentication and other sensitive endpoints.
* [ ]	Limit request body sizes.
* [ ]	Validate and normalize user input.
* [ ]	Use parameterized database queries.
* [ ]	Avoid exposing stack traces or internal configuration in production responses.

Headers should be configured according to deployment architecture. For example, Strict-Transport-Security should be sent only when the domain is served over HTTPS and the deployment is configured appropriately.

7.2 Authentication and authorization

* [ ]	Hash passwords using a suitable password-hashing algorithm.
* [ ]	Enforce authorization on every protected server-side operation.
* [ ]	Do not trust client-supplied roles, user IDs, or ownership claims.
* [ ]	Rotate session identifiers after authentication.
* [ ]	Apply expiration and revocation policies to sessions and tokens.
* [ ]	Protect sensitive actions against CSRF when applicable.
* [ ]	Use secure password reset and account recovery flows.
* [ ]	Log security-relevant events without recording credentials.

7.3 File uploads and documents

* [ ]	Allow only required file types.
* [ ]	Validate file signatures where applicable, not only extensions.
* [ ]	Enforce file-size limits.
* [ ]	Generate server-side filenames.
* [ ]	Store uploads outside publicly executable directories.
* [ ]	Require authorization for private document downloads.
* [ ]	Scan uploads when appropriate.
* [ ]	Prevent path traversal and unsafe archive extraction.
* [ ]	Apply retention and deletion policies to sensitive records.

8. Database and Personal Data

* [ ]	Use a dedicated database account with restricted permissions.
* [ ]	Keep database credentials out of source control.
* [ ]	Use migrations or version-controlled schema changes.
* [ ]	Back up production data according to an approved schedule.
* [ ]	Encrypt connections to remote database services.
* [ ]	Restrict database network access.
* [ ]	Avoid storing unnecessary personal information.
* [ ]	Define retention, access, and deletion rules.
* [ ]	Test restoration in an isolated environment.
* [ ]	Never use real sensitive production data in public test fixtures.

Database backups must be protected separately from source-code backups. A repository archive does not back up the database.

9. Deployment Hardening

Before production deployment:

* [ ]	Confirm the intended branch and commit.
* [ ]	Verify required environment variables are configured.
* [ ]	Confirm database connectivity and migration readiness.
* [ ]	Run required tests and build steps.
* [ ]	Check the deployment configuration for unintended debug settings.
* [ ]	Verify HTTPS and security headers.
* [ ]	Check health endpoints and application logs.
* [ ]	Confirm rollback instructions and backup availability.
* [ ]	Avoid exposing administrative endpoints publicly without authorization.
* [ ]	Verify the deployed application after release.

A successful deployment-hook request does not necessarily prove that the application is healthy. Check deployment status and application health separately.

10. Repository Reports

Use the reports under tools/repository-reports/ to document audit results.

Recommended reports include:

Report	Purpose
summary.json	Overall audit status
api-routes.json	API route inventory
broken-references.json	Broken paths and references
broken-references.csv	Spreadsheet-friendly reference findings
conflict-markers.json	Potential merge conflict markers
parse-warnings.json	Parser and syntax warnings
references.json	Discovered references
dependency-edges.csv	Dependency relationships
duplicate-audit.json	Potential duplicate files

Templates with empty findings are not evidence that the repository passed an audit. Mark reports as verified only after running the corresponding checks and reviewing their results.

11. Recommended Audit Sequence

Run checks in this order to reduce the risk of accidental data loss:

1. Inspect repository status and current commit.
2. Create and verify an external backup.
3. Inventory tracked, untracked, and ignored files.
4. Check unresolved merge conflicts.
5. Validate JSON and YAML syntax.
6. Scan for potential conflict markers.
7. Inspect internal references and dependencies.
8. Run secret and dependency checks.
9. Execute tests and build validation.
10. Review the complete Git diff.
11. Commit the reviewed changes.
12. Verify deployment health after release.

Record the command, date, commit hash, result, and any accepted limitations for each audit.

12. Incident Response

If a secret, sensitive document, or destructive change is discovered:

1. Stop the affected operation when safe to do so.
2. Preserve logs and the current repository state.
3. Revoke or rotate exposed credentials.
4. Determine the affected commits, files, systems, and users.
5. Restore files from a verified backup where necessary.
6. Validate the repaired repository before deployment.
7. Review logs for unauthorized activity.
8. Document the cause and preventive actions.

Do not publish sensitive incident details in public issues or pull requests.

13. Completion Criteria

Repository hardening is complete only when the applicable controls have been implemented and verified.

* [ ]	A recovery backup exists and has been validated.
* [ ]	No unresolved merge conflicts remain in the intended changeset.
* [ ]	Required source and configuration files are preserved.
* [ ]	Secret scanning has been completed and findings reviewed.
* [ ]	Dependency vulnerabilities have been assessed.
* [ ]	Required syntax checks, tests, and builds pass.
* [ ]	Authorization and sensitive-file access have been reviewed.
* [ ]	Deployment and rollback procedures are documented.
* [ ]	Audit reports reflect actual checks and their limitations.
* [ ]	Outstanding risks have owners and remediation plans.

14. Audit Record

Complete this section after an actual repository audit.

Field	Value
Audit date	Not yet recorded
Audited commit	Not yet recorded
Auditor	Not yet recorded
Backup verified	Not yet verified
Validation results	Not yet recorded
Open findings	Not yet recorded
Accepted risks	Not yet recorded
Follow-up owner	Not yet assigned

⸻

Important: This document defines a hardening procedure; it does not certify that the MedOrbits repository has been scanned, secured, or tested. Record only verified results as completed.