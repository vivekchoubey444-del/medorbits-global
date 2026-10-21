
# MedOrbits — Repository Hardening Guide

**Project:** MedOrbits  
**Repository:** https://github.com/vivekchoubey444-del/MedOrbits  
**Scope:** GitHub access, source code, credentials, CI/CD, application security, dependencies, and production infrastructure  
**Purpose:** Reduce unauthorized access, prevent credential exposure, strengthen software supply-chain security, and improve deployment reliability.

> **Security status:** This guide defines recommended controls and verification procedures. It does not certify that MedOrbits is secure. Mark a control complete only after inspecting the actual setting, workflow, code, or deployment configuration and recording appropriate evidence.

—

## 1. Repository Access and Account Security

### Required controls

- [ ] Confirm that repository visibility matches the organization’s security requirements.
- [ ] Enable two-factor authentication (2FA) or a passkey on the GitHub account.
- [ ] Review repository collaborators and remove unnecessary access.
- [ ] Review organization membership, team permissions, and inherited access, where applicable.
- [ ] Audit GitHub Apps, OAuth authorizations, personal access tokens, deploy keys, and SSH keys.
- [ ] Revoke unused or unnecessarily privileged credentials.
- [ ] Use a dedicated deployment identity or GitHub App for automation where practical.
- [ ] Apply least-privilege permissions to human and automated identities.
- [ ] Never share passwords, private SSH keys, recovery codes, or access tokens.
- [ ] Maintain secure account recovery methods.

### Verification

Open the repository’s **Settings** and review visibility, access management, installed applications, and security-related account settings.

Repository: https://github.com/vivekchoubey444-del/MedOrbits

**Important:** A private repository limits access to authorized users, but authorized users may still clone, download, or copy its contents. Repository privacy is not copy prevention. If the repository must remain private, verify its actual visibility rather than assuming it is private.

—

## 2. Main Branch Protection

Configure a branch ruleset targeting `main`:

https://github.com/vivekchoubey444-del/MedOrbits/settings/rules

### Recommended rules

- [ ] Require pull requests before merging.
- [ ] Require at least one approval when an appropriate reviewer is available.
- [ ] Dismiss stale approvals when new commits materially change reviewed code.
- [ ] Require conversation resolution before merging.
- [ ] Require applicable CI and security status checks.
- [ ] Block force pushes.
- [ ] Prevent branch deletion.
- [ ] Restrict bypass permissions to explicitly trusted administrators.
- [ ] Protect `develop` similarly if it is an active development branch.
- [ ] Review ruleset bypasses and exceptions periodically.

### Status-check policy

Do not make a check mandatory until it has run successfully and its exact check name has been verified.

Start with checks that the repository actually provides, such as tests, linting, dependency review, or secret scanning. Avoid requiring nonexistent or duplicated checks.

### Verification evidence

Record:

- Ruleset name and target branches.
- Required approvals and status checks.
- Force-push and branch-deletion restrictions.
- Bypass permissions and exceptions.
- Date of verification.

—

## 3. Secrets and Environment Variables

### Required controls

- [ ] Keep production credentials outside the Git repository.
- [ ] Add `.env` files, environment-specific files, private keys, and local credential files to `.gitignore` as appropriate.
- [ ] Commit only sanitized templates such as `.env.example`.
- [ ] Never commit API keys, database passwords, session-signing secrets, payment-provider secrets, or private keys.
- [ ] Store production credentials in the deployment platform’s secret manager.
- [ ] Use GitHub Actions secrets or environment secrets only for workflows that need them.
- [ ] Apply least privilege and restrict access to production environments.
- [ ] Rotate credentials immediately after confirmed exposure.
- [ ] Review Git history when investigating previously committed secrets.
- [ ] Never print secrets in CI logs, application responses, or diagnostic output.

### Important distinction

Removing a credential from the latest version of a file does not invalidate it or remove historical copies. Revoke or rotate the credential first, then assess whether repository-history remediation is necessary.

### Verification evidence

Review:

- Ignore rules and tracked files.
- Environment configuration and sanitized examples.
- Workflow references to secrets.
- Deployment secret settings.
- Relevant repository history when investigating possible exposure.

Do not paste secret values into reports, issues, or logs.

—

## 4. GitHub Actions Security

### Required controls

- [ ] Set workflow permissions to read-only by default where possible.
- [ ] Grant write permissions only to jobs that need them.
- [ ] Avoid executing untrusted pull-request code with privileged secrets.
- [ ] Review third-party actions and their maintenance and security history.
- [ ] Pin third-party actions to full commit SHAs where practical.
- [ ] Set `persist-credentials: false` on checkout steps that do not require authenticated Git operations.
- [ ] Use a supported Node.js runtime compatible with the project and deployment platform.
- [ ] Set job timeouts and avoid unnecessary workflow privileges.
- [ ] Review changes to workflow files before merging.
- [ ] Remove duplicate checks and unnecessary privileged jobs.
- [ ] Restrict deployment jobs to trusted branches and approved environments.
- [ ] Prevent untrusted workflows from obtaining production deployment credentials.
- [ ] Review artifact contents before publishing or deploying them.

### Example: read-only workflow permissions

```yaml
permissions:
  contents: read
```

Place this at the workflow level when read-only access is sufficient. A job that needs additional permissions should declare only the specific permissions it requires.

This example is not a complete workflow. Validate the permissions required by each action and job before adopting it.

### Verification evidence

Inspect every workflow under `.github/workflows/`, including:

- Event triggers and pull-request behavior.
- Workflow-level and job-level permissions.
- Secret references and environment protection.
- Checkout settings and third-party actions.
- Deployment conditions and artifact handling.
- Permissions inherited by reusable workflows.

—

## 5. Dependency Security

Review repository security settings:

https://github.com/vivekchoubey444-del/MedOrbits/settings/security_analysis

Enable the available features supported by the repository and its GitHub plan:

- [ ] Dependency graph.
- [ ] Dependabot alerts.
- [ ] Dependabot security updates.
- [ ] Secret scanning and push protection, where available.
- [ ] Code scanning and CodeQL, where available.
- [ ] Dependency Review, where supported and appropriate.

### Dependency management

- [ ] Commit the correct lockfile for the package manager in use.
- [ ] Use `npm ci` in CI when maintaining `package-lock.json`.
- [ ] Review dependency audit findings and assess actual exposure and impact.
- [ ] Review major-version updates separately.
- [ ] Remove unused dependencies.
- [ ] Test dependency changes before deployment.
- [ ] Avoid automatic merging without appropriate testing and review.
- [ ] Maintain an appropriate runtime and dependency update policy.

For npm projects, review available information with:

```bash
npm ci
npm audit
npm outdated
```

Run these commands in an appropriate development or CI environment. `npm ci` installs dependencies from the lockfile and may remove an existing `node_modules` directory.

`npm audit` reports known dependency advisories. It does not prove that the application is exploitable or that the repository is otherwise secure. Investigate the affected package, dependency path, applicable code, and available remediation.

Do not automatically run `npm audit fix —force` in production branches without reviewing the resulting version changes and compatibility impact.

—

## 6. Secret Scanning

### Required controls

- [ ] Run Gitleaks or an equivalent secret scanner in CI.
- [ ] Scan repository history when investigating possible historical exposure.
- [ ] Review findings manually to distinguish real credentials from false positives.
- [ ] Revoke or rotate confirmed exposed credentials immediately.
- [ ] Remove exposed material from repository history when necessary.
- [ ] Coordinate history rewriting with collaborators and deployment systems.
- [ ] Avoid relying solely on regular expressions or custom security scripts.
- [ ] Document approved scanner exceptions and periodically review them.

### Example local scan

If Gitleaks is installed and the installed version supports these commands:

```bash
gitleaks git .
gitleaks dir .
```

Check the installed version and current CLI documentation before incorporating scanner commands into CI. Scanner options and defaults can vary between versions.

Secret scanning detects potential exposure; it does not prevent authorized copying or guarantee detection of every secret.

—

## 7. Application Security

### Required controls

- [ ] Validate untrusted input on the server.
- [ ] Enforce authentication and authorization on every protected API operation.
- [ ] Check resource ownership and permissions for individual records.
- [ ] Use secure password hashing and appropriate authentication practices.
- [ ] Configure sessions and cookies securely for the deployment environment.
- [ ] Apply rate limits to authentication, verification, password-reset, and other abuse-prone endpoints.
- [ ] Use parameterized queries and safe output handling to prevent injection vulnerabilities.
- [ ] Configure appropriate security headers and a restrictive Content Security Policy where practical.
- [ ] Avoid exposing stack traces, internal paths, credentials, or sensitive records to clients.
- [ ] Restrict administrative actions to authorized roles.
- [ ] Test both permitted and denied access paths.
- [ ] Review CSRF protections for state-changing requests where applicable.
- [ ] Keep production debug mode disabled.
- [ ] Log security-relevant events without recording sensitive values.

### MedOrbits-specific security considerations

For education applications, recruitment workflows, and account-based services, verify that users cannot access another user’s applications, uploaded documents, account information, or transaction records by changing a record identifier.

Test resource-level authorization on individual records, bulk operations, nested routes, downloads, exports, and background jobs where applicable.

Hiding a frontend link is not access control. Every protected backend operation must enforce the appropriate permissions.

—

## 8. File Uploads and Documents

### Required controls

- [ ] Authenticate users before protected uploads and downloads.
- [ ] Authorize each document operation independently.
- [ ] Validate file size, file type, and file content.
- [ ] Do not trust client-supplied filenames or MIME types.
- [ ] Generate safe server-side storage names.
- [ ] Store private documents outside publicly served directories.
- [ ] Prevent path traversal and unsafe file execution.
- [ ] Consider malware scanning and quarantine for uploaded files.
- [ ] Apply retention and deletion rules to sensitive documents.
- [ ] Avoid storing real user documents in source control, public assets, or test fixtures.
- [ ] Restrict document access to authorized users and purposes.
- [ ] Review temporary-file cleanup and storage permissions.

### Verification evidence

Test:

- Unauthorized downloads.
- Cross-user document access.
- Oversized files.
- Misleading extensions and MIME types.
- Malformed uploads.
- Unsafe filenames and path traversal.
- Access after document deletion or permission revocation, where applicable.

—

## 9. Payments and Financial Data

### Required controls

- [ ] Verify payment-provider webhook signatures using the provider’s documented verification method.
- [ ] Implement idempotency to prevent duplicate payment processing.
- [ ] Validate transaction amounts, currency, account association, and state on the server.
- [ ] Do not trust payment success messages supplied by the browser.
- [ ] Keep payment-provider secrets on the server.
- [ ] Avoid storing card security codes or unnecessary payment information.
- [ ] Record transaction references and status changes without exposing sensitive payment data.
- [ ] Test webhook retries, duplicate events, and failure recovery.
- [ ] Reconcile payment records against the payment provider where appropriate.
- [ ] Restrict access to refunds, payment adjustments, and subscription administration.

### Verification evidence

Use the provider’s test environment to confirm:

- Signature verification.
- Duplicate-event handling and idempotency.
- Failed payments and retries.
- Out-of-order webhook events.
- Amount and currency mismatches.
- Transaction-state transitions.
- Database failures and reconciliation behavior.

Never test with real charges unless explicitly authorized and necessary. Do not assume that an HTTP success response means a financial operation was completed correctly.

—

## 10. Database and Production Deployment

### Required controls

- [ ] Store database credentials in deployment secrets.
- [ ] Use a restricted database account for routine application operations.
- [ ] Separate development, testing, staging, and production environments.
- [ ] Review migrations before deployment.
- [ ] Plan recovery or rollback procedures for schema changes.
- [ ] Back up critical data and test restoration.
- [ ] Restrict database network access.
- [ ] Disable production debug mode.
- [ ] Enforce HTTPS and secure cookie settings in production.
- [ ] Monitor application errors and security-relevant events without logging sensitive data.
- [ ] Verify health checks and deployment readiness checks.
- [ ] Document incident contacts and escalation procedures.

### Production deployment gate

Before releasing a change, confirm:

1. The approved code revision is the one being deployed.
2. Required CI checks have passed.
3. Production secrets are configured in the appropriate secret manager.
4. Database migrations have been reviewed.
5. Backups and recovery procedures are available.
6. Private documents and administrative endpoints are protected.
7. A rollback or recovery plan exists.
8. Post-deployment checks can verify the release.

Do not treat a successful container build or HTTP health check as proof that all security controls work.

An application rollback does not automatically reverse database migrations, external side effects, or completed financial transactions. Recovery procedures must address those separately.

—

## 11. Frontend Source-Code Limitations

### Required controls

- [ ] Never embed private credentials or API secrets in browser-delivered JavaScript.
- [ ] Move confidential business logic to server-side services.
- [ ] Enforce backend authorization instead of relying on hidden UI elements.
- [ ] Review frontend bundles and public assets for exposed configuration or private data.
- [ ] Review source maps before publishing them publicly.
- [ ] Publish source maps only when their exposure is intentional and appropriate.
- [ ] Avoid including internal endpoints, test credentials, or private data in public JSON files.

HTML, CSS, JavaScript, images, and other assets delivered to a browser can be inspected or copied. Minification and obfuscation may increase copying effort but do not prevent it.

Keeping the GitHub repository private does not make deployed frontend code private.

—

## 12. Incident Response

If a credential or sensitive file is exposed:

1. **Contain the exposure.** Revoke or rotate the affected credential immediately. Disable compromised access where appropriate.
2. **Assess impact.** Identify affected systems, accounts, data, and the exposure time window.
3. **Review evidence.** Inspect relevant access logs, audit events, and deployment activity.
4. **Remediate the source.** Remove exposed material from the working tree and, when appropriate, repository history.
5. **Update dependent systems.** Replace deployment secrets and verify that affected services use the new credentials.
6. **Notify appropriately.** Inform affected parties when legally, contractually, or operationally required.
7. **Recover safely.** Verify affected systems and data before restoring normal operation.
8. **Prevent recurrence.** Document the cause, remediation, and follow-up actions.

Do not assume that deleting a file, rewriting Git history, or making the repository private invalidates a leaked credential.

Preserve relevant evidence and coordinate history rewriting with collaborators before proceeding. Follow applicable incident-response and legal requirements.

—

## 13. Ongoing Maintenance

- [ ] Review repository collaborators and access permissions regularly.
- [ ] Review Dependabot alerts and dependency-update pull requests.
- [ ] Investigate failed CI and security workflows.
- [ ] Update supported runtimes and dependencies.
- [ ] Review security policy and supported-version policy.
- [ ] Test backup restoration and incident-response procedures.
- [ ] Review GitHub Apps, tokens, deploy keys, and automated identities.
- [ ] Reassess deployment permissions and secret access.
- [ ] Review scanner findings and approved exceptions.
- [ ] Reassess this checklist after significant architecture or infrastructure changes.

Assign an owner and review interval to critical controls. Record exceptions, remediation actions, and target dates rather than leaving unresolved findings undocumented.

—

## 14. Verification and Completion Record

Record evidence for each control. Use **Verified**, **Not applicable**, or **Pending verification** as appropriate. A control should not be marked verified solely because a related file exists.

| Control area | Status | Evidence or reference |
|—|—|—|
| Repository privacy and access | Pending verification | |
| Main branch protection | Pending verification | |
| Secret management | Pending verification | |
| CI/CD permissions | Pending verification | |
| Dependency security | Pending verification | |
| Secret scanning | Pending verification | |
| Application security | Pending verification | |
| File uploads and documents | Pending verification | |
| Payments and financial data | Pending verification | |
| Database and production deployment | Pending verification | |
| Frontend exposure review | Pending verification | |
| Incident response | Pending verification | |
| Ongoing maintenance | Pending verification | |

### Review record

- **Review date:** Pending
- **Reviewed by:** Pending
- **Repository revision or commit:** Pending
- **Outstanding high-risk findings:** Pending
- **Remediation owners and target dates:** Pending

Update this record after performing the relevant verification. Do not substitute assumptions or planned work for evidence.

—

## Security Statement

This guide provides repository-hardening recommendations and verification procedures. It is not a security certification, penetration-test report, or guarantee that MedOrbits is secure or that its source code cannot be copied.

Verify each control against the actual GitHub settings, source code, CI/CD workflows, dependencies, and production deployment before marking it complete.

**MedOrbits — Education · Admissions · Careers · Recruitment**
