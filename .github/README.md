MedOrbits — GitHub Repository Configuration

File: .github/README.md
Project: MedOrbits
Release target: 2.0.0

1. Overview

The .github/ directory contains configuration and automation resources used to maintain the MedOrbits repository. These resources support issue management, contribution standards, automated validation, security checks, and code review.

This README describes the intended structure and maintenance practices. The presence of a file does not guarantee that its workflow, policy, or GitHub setting is active.

2. Directory Structure

The following is a reference structure. Verify each file against the actual repository before relying on it.

.github/
├── README.md
├── CODEOWNERS
├── ISSUE_TEMPLATE/
│   ├── README.md
│   ├── config.yml
│   ├── bug_report.yml
│   ├── feature-request.yml
│   └── security-report.yml
├── scripts/
│   ├── validate-commit-message.sh
│   └── test-validate-commit-message.sh
└── workflows/
    └── security_audit.yml

Other files, such as pull request templates, Dependabot configuration, and additional CI workflows, may be added when required.

3. Issue Templates

Directory: .github/ISSUE_TEMPLATE/

Issue forms standardize incoming reports and help maintainers gather useful information.

Bug reports

File: ISSUE_TEMPLATE/bug_report.yml

Use this form to report reproducible defects, including broken pages, API errors, form failures, incorrect behavior, performance problems, and compatibility issues.

Reports should include reproduction steps, expected and actual behavior, the affected environment, and sanitized evidence.

Feature requests

File: ISSUE_TEMPLATE/feature-request.yml

Use this form to propose new features or improvements. Requests should describe the problem, intended users, proposed solution, use cases, and acceptance criteria.

Security reports

File: ISSUE_TEMPLATE/security-report.yml

Security reports require responsible disclosure. Public GitHub issues are not confidential.

* Do not publish credentials, access tokens, private user records, or exploit details.
* Follow the verified private reporting process documented in SECURITY.md.
* Do not request sensitive reproduction details in public comments.
* Avoid promising response times unless the security policy defines them.

The security issue form itself does not make a report private.

Issue configuration

File: ISSUE_TEMPLATE/config.yml

This file controls whether blank issues are enabled and defines links to project resources.

Ensure all linked forms and documents exist. Filenames must match their URLs exactly, including underscores and hyphens.

4. CODEOWNERS

Recommended file: .github/CODEOWNERS

The repository’s ownership rules designate @vivekchoubey444-del as the default reviewer for repository files.

Specific ownership rules can be added for sensitive areas, including authentication, APIs, database migrations, deployment configuration, security policies, and GitHub Actions workflows.

Remember:

* CODEOWNERS assigns review responsibility; it does not grant repository permissions.
* The designated account must have appropriate repository access.
* Code-owner approval must be enabled through branch protection or repository rulesets if it is required before merging.

5. GitHub Actions

Directory: .github/workflows/

Workflows can automate tasks such as:

* Running tests and source validation.
* Validating configuration and JSON files.
* Auditing dependencies.
* Scanning for accidentally committed secrets.
* Running static security analysis.
* Publishing CI summaries.

Workflow security

Apply the principle of least privilege:

1. Grant only the permissions required by each job.
2. Avoid exposing secrets to untrusted pull request code.
3. Review third-party actions and their versions.
4. Keep dependencies and lockfiles consistent.
5. Review failed workflow logs before merging.
6. Avoid printing credentials or sensitive environment values.

A workflow file alone does not prove that checks are passing. Verify execution results in the repository’s Actions tab.

6. Commit Message Validation

Recommended scripts:

* .github/scripts/validate-commit-message.sh
* .github/scripts/test-validate-commit-message.sh

The validator may enforce Conventional Commit formatting. Its test suite should verify accepted messages, rejected messages, argument handling, subject-length rules, and verbose output where supported.

Example:

feat(admissions): improve course search
fix(api): handle missing application ID
docs: update deployment guide

Keep the tests aligned with the validator’s actual behavior. Do not assume a test passes until it has been executed against the current script.

7. Security and Privacy

All repository contributions should follow these principles:

* Never commit real credentials or production secrets.
* Store sensitive configuration in approved environment variables or a secrets manager.
* Review authentication, authorization, file uploads, and data-access changes carefully.
* Keep dependency manifests and lockfiles synchronized.
* Restrict CI permissions and review third-party dependencies.
* Remove sensitive data from logs, screenshots, and test fixtures.
* Use private disclosure channels for confidential vulnerabilities.

Security scanners provide additional safeguards but cannot guarantee that software is secure.

8. Contribution Standards

Contributors should review the repository’s CONTRIBUTING.md and CODE_OF_CONDUCT.md before submitting changes.

Expected practices include:

1. Search for existing issues before opening a new one.
2. Use the appropriate issue form.
3. Keep pull requests focused and explain their purpose.
4. Add or update tests for relevant behavior.
5. Run applicable validation scripts.
6. Avoid unrelated file changes and generated artifacts.
7. Document breaking changes and migration requirements.
8. Wait for required reviews and CI checks before merging.

Never include passwords, tokens, private documents, or sensitive user records in public issues or pull requests.

9. Validation Checklist

Before merging changes to .github/, verify the following:

* [ ]	YAML files parse successfully.
* [ ]	Issue forms use supported GitHub field types.
* [ ]	Referenced templates and documents exist.
* [ ]	Contact links use the correct repository and branch.
* [ ]	CODEOWNERS is in a GitHub-recognized location.
* [ ]	The designated code owner has appropriate access.
* [ ]	Required code-owner reviews are configured if needed.
* [ ]	Workflow permissions follow least privilege.
* [ ]	Commit-message tests match the validator implementation.
* [ ]	Security policy identifies a working private reporting method.
* [ ]	No secrets or confidential data have been committed.
* [ ]	CI checks have been executed and reviewed.

10. Maintenance

Review the .github/ directory whenever the repository structure, default branch, release process, security policy, or contribution workflow changes.

Update stale links, remove obsolete configuration only after checking its dependencies, and verify that documentation accurately describes active controls.

Do not claim a workflow, policy, or security control is operational until its configuration and behavior have been verified.

11. Official References

* GitHub issue forms
* GitHub CODEOWNERS
* GitHub Actions
* GitHub security advisories

⸻

Maintenance note: This document describes intended configuration and recommended practices. Verify the repository’s actual files, settings, permissions, and workflow results before treating any control as enabled.