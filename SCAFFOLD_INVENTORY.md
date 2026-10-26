MedOrbits Scaffold Inventory

Project: MedOrbits
Release target: 2.0.0
Platform: Education · Admissions · Careers · Recruitment
Document type: Repository scaffold inventory
Status: Draft — verify against the actual repository

⸻

1. Purpose

This document records the intended purpose and verification status of scaffold, development, testing, security, and release-support files in the MedOrbits repository.

It helps maintainers:

* Identify development and validation utilities.
* Document Git hooks and editor configuration.
* Track documentation and workflow requirements.
* Identify duplicate or overlapping checks.
* Distinguish files that have been drafted from files verified in Git.
* Prepare a controlled release process for MedOrbits 2.0.0.

Important: A file appearing in this inventory does not prove that it exists, is committed, works correctly, or has passed testing. Verify its presence and content before marking it complete.

2. Root-Level Scaffold Files

Path	Intended purpose	Verification
/VERSION	Declares the intended release version, 2.0.0.	Confirm file content and consistency with package metadata.
/RESTORE.sh	Inspects repository state and creates a recovery backup.	Review backup behavior and test without destructive operations.
/VERIFY.sh	Performs basic repository, JSON, and JavaScript checks.	Execute and review warnings and failures.
/TEST.sh	Runs available project validation and test scripts.	Confirm package scripts and test behavior.
/SECURITY.sh	Performs heuristic security checks.	Review findings and run dedicated security tools.
/SCHEMA-CHECK.sh	Performs JSON and basic schema-structure checks.	Validate schemas with a compatible JSON Schema validator.
/SUPPORT.md	Documents support categories, privacy guidance, and escalation principles.	Verify official contact details and policy links.
/SECURITY.md	Documents vulnerability reporting and security handling.	Configure and verify private reporting.
/SCAFFOLD_INVENTORY.md	Tracks scaffold files and their readiness.	Update after repository inspection.
/vitest.config.js	Configures Vitest test discovery and coverage options.	Confirm module format, dependencies, and project paths.

Root-file considerations

* Shell scripts must have compatible line endings and executable permissions where required.
* Scripts must not silently bypass essential checks.
* Recovery utilities must preserve user changes.
* Security checks must not expose detected secret values.
* Schema validation should use a version-compatible JSON Schema validator where full validation is required.
* Documentation must not claim operational capabilities that have not been verified.

3. VS Code Workspace

Intended directory:

.vscode/
├── README.md
├── extensions.json
├── launch.json
└── settings.json

Path	Intended purpose	Verification
.vscode/README.md	Explains workspace setup and maintenance.	Confirm descriptions match actual settings.
.vscode/extensions.json	Recommends development extensions.	Verify extension identifiers and standard filename.
.vscode/launch.json	Provides debugging profiles.	Confirm the application entry point and commands.
.vscode/settings.json	Defines editor, formatting, and Git preferences.	Check extension dependencies and supported settings.

Compatibility note: VS Code recognizes .vscode/extensions.json for workspace extension recommendations. A singular extension.json filename is not the standard recommendation file.

Workspace settings are intended for VS Code desktop; they do not automatically configure the iPhone Working Copy app.

4. Husky Git Hooks

Intended directory:

.husky/
├── README.md
├── commit-msg
├── pre-commit
└── pre-push

Path	Intended purpose	Verification
.husky/README.md	Documents setup, usage, and limitations.	Compare with the actual hooks.
.husky/commit-msg	Validates Conventional Commits messages.	Test valid and invalid examples.
.husky/pre-commit	Checks staged files and configured quality scripts.	Verify failure handling and side effects.
.husky/pre-push	Runs repository checks before pushing.	Confirm required tools and test behavior.

Hook requirements

* Confirm the installed Husky version.
* Verify the root package.json has the appropriate prepare script.
* Preserve existing package scripts.
* Confirm executable permissions where supported.
* Test hook failures in a temporary branch.
* Ensure hooks do not stage, commit, push, or deploy automatically.
* Keep critical validation in CI because local hooks can be bypassed.

5. Testing and Validation

Utility	Validation area	Limitations
VERIFY.sh	Git state, JSON, JavaScript syntax, and basic package metadata.	Does not replace a complete build or runtime test.
TEST.sh	Available npm tests, checks, lint, and build scripts.	Only runs checks defined by the project.
SCHEMA-CHECK.sh	JSON syntax and common schema-structure issues.	Does not guarantee full JSON Schema compliance.
vitest.config.js	Unit and integration test configuration.	Requires compatible Vitest packages and appropriate test files.
.husky/pre-commit	Early checks before committing.	May omit tests or files depending on its implementation.
.husky/pre-push	Checks before pushing.	Does not guarantee that remote CI or production deployment will succeed.

Validation principles

1. Prefer read-only checks before recovery or release operations.
2. Do not automatically rename schema files without checking their references.
3. Do not install or upgrade dependencies during verification unless explicitly intended.
4. Distinguish skipped checks from passed checks.
5. Review test failures before committing.
6. Validate the actual application runtime and deployment configuration separately.

6. Package and Dependency Requirements

The following files should be checked if MedOrbits uses npm:

Path	Requirement
package.json	Must contain valid JSON and accurate scripts and dependency declarations.
package-lock.json	Must match the package manifest and support reproducible installation.
node_modules/	Local generated dependencies; normally excluded from Git.
.gitignore	Should exclude generated files, local secrets, and other non-source artifacts.
.env.example	Optional template containing placeholders only, if environment variables are used.

Before release:

* Confirm the Node.js version matches package.json and CI.
* Confirm that the lockfile is committed when required.
* Review dependency vulnerabilities and compatibility.
* Avoid automatic dependency upgrades during release verification.
* Never commit production credentials or private keys.

7. GitHub Actions and CI

The repository may contain workflow files under .github/workflows/.

Previously discussed workflow filenames include:

* ci.yml
* codeql.yml
* dependency-review.yml
* deploy.yml
* generate-lockfile.yml
* release.yml
* secret-scan.yml
* stale_issue.yml
* deploy_staging.yml
* test-test.yml
* lint.yml

These names represent workflow files discussed during development, not a verified inventory of the current repository.

Workflow review checklist

* [ ]	Confirm each workflow exists and has valid YAML.
* [ ]	Identify duplicate or overlapping validation jobs.
* [ ]	Verify least-privilege workflow permissions.
* [ ]	Review third-party action versions and pinning policies.
* [ ]	Ensure pull requests cannot access production secrets improperly.
* [ ]	Confirm deployment workflows do not deploy unintentionally.
* [ ]	Confirm lockfile generation does not commit or push automatically unless explicitly authorized.
* [ ]	Verify secret scanning and dependency review are configured correctly.
* [ ]	Confirm release tags match package metadata.
* [ ]	Review scheduled workflows and any automated issue-closing behavior.

8. Security and Support Documentation

Document	Intended responsibility
SECURITY.md	Private vulnerability reporting and remediation guidance.
SUPPORT.md	User support categories, privacy precautions, and escalation guidance.
.husky/README.md	Local Git hook setup and behavior.
.vscode/README.md	Workspace development setup.
README.md	Project overview, official links, setup instructions, and supported workflows.

Before publication, verify all links and ensure the documents do not invent contact addresses, response targets, or security commitments.

The vulnerability reporting process must be private and operational before the security policy is presented as active.

9. Known Risks and Follow-Up Items

The following items require explicit verification:

* [ ]	Check for misspelled filenames such as *.shema.json.
* [ ]	Search for references before renaming any files.
* [ ]	Confirm all scripts match the actual project directory structure.
* [ ]	Review the interaction between VERIFY.sh, TEST.sh, and Husky hooks.
* [ ]	Check whether vitest.config.js matches the repository’s ES module configuration.
* [ ]	Ensure the test suite does not require production credentials.
* [ ]	Verify that generated reports and backups are excluded from source validation where appropriate.
* [ ]	Confirm GitHub Actions workflow names and actual behavior.
* [ ]	Check for duplicate release or deployment workflows.
* [ ]	Confirm VERSION, package.json, package-lock.json, and release tags agree.
* [ ]	Review all tracked and untracked files before any Git recovery operation.

10. Release Readiness Checklist

Use this checklist before publishing MedOrbits 2.0.0.

Repository integrity

* [ ]	Review git status.
* [ ]	Resolve merge conflicts manually.
* [ ]	Preserve all required new and modified files.
* [ ]	Create a backup outside the repository before risky changes.
* [ ]	Review the staged diff.

Validation

* [ ]	Run bash VERIFY.sh.
* [ ]	Run bash TEST.sh.
* [ ]	Run bash SCHEMA-CHECK.sh.
* [ ]	Run the configured unit tests.
* [ ]	Review dependency audit results.
* [ ]	Review secret-scanning results.
* [ ]	Verify the application starts and core routes work.

Release configuration

* [ ]	Confirm version metadata is consistent.
* [ ]	Verify CI workflows pass.
* [ ]	Confirm staging and production deployment controls.
* [ ]	Verify the security reporting channel.
* [ ]	Confirm official support and policy links.
* [ ]	Review release notes and known limitations.

Publication

* [ ]	Obtain the required maintainer approval.
* [ ]	Commit only reviewed changes.
* [ ]	Create the release tag only after validation.
* [ ]	Verify the published release and deployed version.

A completed checklist is evidence of performed checks only when results have been recorded. It is not a guarantee that the application is free from defects or security vulnerabilities.

11. Inventory Maintenance

Update this document whenever scaffold files are added, removed, renamed, or materially changed.

For each inventory update:

1. Inspect the actual repository tree.
2. Confirm the file exists and is tracked where expected.
3. Review the file’s contents.
4. Verify dependencies and cross-references.
5. Record test results and unresolved issues.
6. Update this inventory without claiming unperformed checks have passed.

Inventory status

* Release target: 2.0.0
* Repository inspection: Pending
* File existence verification: Pending
* Automated validation: Pending
* Security review: Pending
* Release approval: Pending

⸻

MedOrbits — Education · Admissions · Careers · Recruitment

Study · Work · Grow