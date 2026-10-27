
# 🛡️ MedOrbits — GitHub Repository Configuration

**Project:** MedOrbits  
**Release target:** `2.0.0`  
**Directory:** `.github/`

## 1. Overview

The `.github/` directory contains configuration and automation resources used to maintain the MedOrbits repository. These resources support issue management, contribution standards, automated validation, dependency updates, security checks, and code review.

The presence of a configuration file does not guarantee that its workflow, policy, or GitHub setting is active. Verify the actual repository configuration and execution results before relying on any control.

## 2. Directory Structure

The following is a reference structure. Verify each file against the actual repository before relying on it.

```text
.github/
├── README.md
├── CODEOWNERS
├── dependabot.yml
├── pull_request_template.md
├── ISSUE_TEMPLATE/
│   ├── README.md
│   ├── config.yml
│   ├── bug_report.yml
│   ├── feature-request.yml
│   └── security-report.yml
├── scripts/
│   ├── README.md
│   ├── validate-commit-message.sh
│   └── test-validate-commit-message.sh
└── workflows/
    └── security_audit.yml
```

Additional workflows, validators, and repository policies may be added as needed. Keep this reference structure synchronized with the actual repository.

## 3. Issue Templates

**Directory:** `.github/ISSUE_TEMPLATE/`

Issue forms standardize incoming reports and help maintainers gather useful information.

### 3.1 Bug Reports

**File:** `ISSUE_TEMPLATE/bug_report.yml`

Use this form to report reproducible defects, including broken pages, API errors, form failures, incorrect behavior, performance problems, and compatibility issues.

Reports should include:

- Steps to reproduce the issue.
- Expected and actual behavior.
- Affected environment and version.
- Relevant sanitized logs or screenshots.
- Workarounds, if available.

Remove passwords, access tokens, personal information, and other confidential details from submitted evidence.

### 3.2 Feature Requests

**File:** `ISSUE_TEMPLATE/feature-request.yml`

Use this form to propose new features or improvements.

Requests should describe the problem, intended users, proposed solution, relevant use cases, and measurable acceptance criteria.

### 3.3 Security Reports

**File:** `ISSUE_TEMPLATE/security-report.yml`

Security reports require responsible disclosure. Public GitHub issues are not confidential.

- Do not publish credentials, access tokens, private user records, or sensitive exploit details.
- Follow the verified private reporting process documented in `SECURITY.md`.
- Do not request sensitive reproduction details in public comments.
- Do not promise response times unless the published security policy defines them.
- Verify that the private reporting method is configured and operational before directing researchers to it.

A security issue form does not make a report private.

### 3.4 Issue Configuration

**File:** `ISSUE_TEMPLATE/config.yml`

This file controls whether blank issues are enabled and defines links to project resources.

Verify that every linked form and document exists. Filenames and URLs must match exactly, including underscores, hyphens, and letter casing where applicable.

## 4. CODEOWNERS

**File:** `.github/CODEOWNERS`

The intended default reviewer is `@vivekchoubey444-del`.

Specific ownership rules may cover sensitive areas, including authentication, APIs, database migrations, deployment configuration, security policies, and GitHub Actions workflows.

Important considerations:

- CODEOWNERS assigns review responsibility; it does not grant repository permissions.
- The designated account must have appropriate repository access.
- Code-owner approval must be enabled through branch protection or repository rulesets if required before merging.
- The matching code owner must be eligible to review the relevant pull request.
- Rules are evaluated according to GitHub’s CODEOWNERS matching behavior; later matching patterns can override earlier ones.

Verify that the CODEOWNERS file is committed to a GitHub-recognized location on the applicable base branch.

## 5. GitHub Actions

**Directory:** `.github/workflows/`

Workflows can automate tasks such as:

- Running tests and source validation.
- Validating YAML, JSON, and configuration files.
- Auditing dependencies.
- Scanning for accidentally committed secrets.
- Running static security analysis.
- Publishing CI summaries.
- Enforcing commit-message conventions.
- Checking deployment readiness.

### 5.1 Workflow Security

Apply the principle of least privilege:

1. Grant only the permissions required by each job.
2. Avoid exposing secrets to untrusted pull-request code.
3. Review third-party actions and pin them to verified versions or immutable commit SHAs where appropriate.
4. Keep dependency manifests and lockfiles consistent.
5. Review failed workflow logs before merging.
6. Never print credentials or sensitive environment values.
7. Use reasonable job timeouts and explicit workflow triggers.
8. Protect privileged workflows from untrusted input.
9. Use concurrency controls where appropriate to avoid redundant or conflicting runs.
10. Review permission changes before merging modifications to workflow files.

A workflow file alone does not prove that checks are passing. Verify execution results in the repository’s Actions tab.

## 6. Commit Message Validation

**Scripts:**

- `.github/scripts/validate-commit-message.sh`
- `.github/scripts/test-validate-commit-message.sh`

The validator enforces the commit-message format configured by the project. Supported types, optional scopes, breaking-change markers, and subject-length limits must match the actual script.

Examples, subject to the validator’s supported types:

```text
feat(admissions): improve course search
fix(api): handle missing application ID
docs: update deployment guide
fix(auth): validate authorization headers
```

Run syntax checks and the test suite from the repository root:

```bash
bash -n .github/scripts/validate-commit-message.sh
bash -n .github/scripts/test-validate-commit-message.sh
bash .github/scripts/test-validate-commit-message.sh
```

For detailed test output, use the following only if the test script implements the `—verbose` option:

```bash
bash .github/scripts/test-validate-commit-message.sh —verbose
```

Keep tests aligned with the validator’s actual behavior. Do not claim that tests pass until they have been executed successfully.

The scripts do not enforce themselves. Automatic enforcement requires an appropriate Git hook or GitHub Actions integration. GitHub rulesets and branch protection may also be needed for broader merge requirements.

## 7. Dependabot Configuration

**File:** `.github/dependabot.yml`

Dependabot may be configured to open scheduled dependency-update pull requests for supported ecosystems, including GitHub Actions and npm.

The intended policy is:

- Weekly scheduled updates.
- A reasonable limit on open update pull requests.
- Separate minor and patch update groups where supported.
- Consistent dependency-related labels.
- Human review before merging.
- No automatic merge or deployment configured solely by this file.

Validate the configuration against the dependency ecosystems and manifest files actually present in the repository.

Dependabot configuration alone does not disable auto-merge configured elsewhere, require approvals, or prevent direct pushes. Enforce those requirements through repository settings, rulesets, and workflow permissions.

## 8. Pull Request Template

**File:** `.github/pull_request_template.md`

The pull request template should ask contributors to document:

- Summary and related issues.
- Change type and affected areas.
- Implementation details.
- Testing and validation results.
- Security and privacy considerations.
- Database and data-integrity impacts.
- Configuration and dependency changes.
- Accessibility and user-interface impacts.
- Deployment and compatibility requirements.
- Documentation changes.
- Reviewer guidance and final checks.

Contributors must report test results accurately and identify skipped or failing checks. The template documents expectations but does not enforce them.

## 9. Security and Privacy

All repository contributions should follow these principles:

- Never commit real credentials or production secrets.
- Store sensitive configuration in approved environment variables or a secrets manager.
- Review authentication, authorization, file uploads, and data-access changes carefully.
- Keep dependency manifests and lockfiles synchronized.
- Restrict CI permissions and review third-party dependencies.
- Remove sensitive data from logs, screenshots, and test fixtures.
- Use private disclosure channels for confidential vulnerabilities.
- Review changes to security workflows and repository configuration carefully.
- Rotate credentials immediately if they are accidentally exposed.
- Avoid including production data in test fixtures or examples.

Security scanners provide additional safeguards but cannot guarantee that software is secure.

## 10. Contribution Standards

Contributors should review the repository’s `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` before submitting changes.

Expected practices include:

1. Search for existing issues before opening a new one.
2. Use the appropriate issue form.
3. Keep pull requests focused and explain their purpose.
4. Add or update tests for relevant behavior.
5. Run applicable validation scripts.
6. Avoid unrelated file changes and generated artifacts.
7. Document breaking changes and migration requirements.
8. Wait for required reviews and CI checks before merging.
9. Resolve merge conflicts carefully and preserve unrelated changes.
10. Review the final diff before committing.

Never include passwords, tokens, private documents, or sensitive user records in public issues or pull requests.

## 11. Validation Checklist

Before merging changes to `.github/`, verify the following:

- [ ] YAML files parse successfully.
- [ ] Issue forms use supported GitHub field types.
- [ ] Referenced templates and documents exist.
- [ ] Contact links use the correct repository and branch.
- [ ] CODEOWNERS is in a GitHub-recognized location.
- [ ] The designated code owner has appropriate access.
- [ ] Required code-owner reviews are configured if needed.
- [ ] Workflow permissions follow least privilege.
- [ ] Third-party actions have been reviewed.
- [ ] Dependabot entries match actual dependency manifests.
- [ ] Commit-message tests match the validator implementation.
- [ ] The security policy identifies a working private reporting method.
- [ ] No secrets or confidential data have been committed.
- [ ] CI checks have been executed and reviewed.
- [ ] Branch protection or rulesets enforce the intended merge policy.
- [ ] Documentation accurately describes active controls.

## 12. Maintenance

Review the `.github/` directory whenever the repository structure, default branch, release process, security policy, or contribution workflow changes.

Update stale links, remove obsolete configuration only after checking its dependencies, and verify that documentation accurately describes active controls.

Before deleting or replacing files, inspect the current Git status and diff. Preserve unrelated changes and newly created files.

Do not claim a workflow, policy, or security control is operational until its configuration and behavior have been verified.

## 13. Official References

- [GitHub issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
- [GitHub CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [GitHub Actions](https://docs.github.com/en/actions)
- [GitHub Actions security hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [GitHub Dependabot configuration](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file)
- [GitHub security advisories](https://docs.github.com/en/code-security/security-advisories)

—

## Maintenance Note

This document describes the intended configuration and recommended practices for MedOrbits `2.0.0`.

It does **not** confirm that every listed file exists, that permissions are correct, that workflows pass, or that repository protections are enabled. Verify the actual files, GitHub settings, permissions, and workflow results before treating any control as operational.
