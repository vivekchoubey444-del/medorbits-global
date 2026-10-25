
# MedOrbits — Infrastructure Security Policy

**Project:** MedOrbits — Education · Medical Admissions · Official Resources · Careers  
**File:** `infrastructure/.github/SECURITY.md`  
**Scope:** Repository infrastructure, CI/CD, application deployment, credentials, dependencies, and operational security  
**Runtime:** Node.js 20+  
**Backend:** Express.js with ES modules  
**Database:** PostgreSQL  
**Status:** Security policy template — confirm reporting channels and controls before publication

—

## 1. Purpose

This document defines security expectations for MedOrbits infrastructure and repository automation.

Its objectives are to:

- Protect application source code and deployment infrastructure.
- Prevent exposure of credentials and confidential configuration.
- Reduce supply-chain and dependency risks.
- Secure GitHub Actions workflows and release pipelines.
- Establish a responsible vulnerability-reporting process.
- Support timely investigation, containment, remediation, and recovery.
- Protect user accounts, applications, uploaded documents, and personal information.

This document describes the intended policy. Actual enforcement depends on the repository settings, implemented workflows, hosting configuration, and approved operational procedures.

## 2. Security Principles

MedOrbits infrastructure should follow these principles:

1. **Least privilege:** Grant only the access and permissions required.
2. **Defense in depth:** Use multiple complementary security controls.
3. **Secure by default:** Restrict access unless permission is explicitly granted.
4. **Separation of environments:** Keep development, testing, staging, and production credentials and data isolated.
5. **Fail safely:** Prevent security failures from exposing secrets or granting unauthorized access.
6. **Traceability:** Record appropriate security and administrative events.
7. **Data minimization:** Collect and retain only the information needed.
8. **Verified releases:** Deploy reviewed revisions that pass required checks.
9. **Responsible disclosure:** Handle vulnerability reports privately and professionally.
10. **Continuous improvement:** Review controls after incidents and significant changes.

—

## 3. Scope

This policy covers:

- GitHub repositories and repository settings.
- GitHub Actions workflows.
- Branch protection and release approvals.
- Third-party GitHub Actions and dependencies.
- Environment variables, API keys, and deployment credentials.
- Node.js application configuration.
- PostgreSQL access and migration procedures.
- Hosting platforms and deployment integrations.
- File storage and private document access.
- CI logs, build artifacts, and operational logs.
- Security incidents involving MedOrbits infrastructure.

Application-specific security controls should also be documented in the main `SECURITY.md`, application architecture documentation, and relevant API implementation guides.

—

## 4. Reporting a Security Vulnerability

Report suspected security vulnerabilities through an approved private channel.

### Preferred reporting methods

1. Use the repository’s **Private vulnerability reporting** feature, if enabled.
2. Use a verified security contact formally published by the MedOrbits maintainers.
3. If neither option is available, contact an authorized repository maintainer through a verified private channel.

Do not invent or assume an email address, response-time commitment, or active reporting channel.

### Do not disclose vulnerabilities publicly before coordination

Avoid posting exploitable details in:

- Public GitHub issues.
- Public pull requests.
- Public discussion threads.
- Unrestricted logs or support tickets.
- Social media posts that reveal exploitable implementation details.

If a vulnerability has already been disclosed publicly, avoid amplifying sensitive exploit details and coordinate remediation through an appropriate channel.

### Information to include

Provide only the information needed to reproduce and assess the issue:

- Affected component or repository path.
- Relevant version, commit, or deployment where known.
- Description of the suspected vulnerability.
- Potential security impact.
- Minimal reproduction steps.
- Supporting evidence with secrets and personal data redacted.
- Suggested mitigation, if known.

Do not include real passwords, session cookies, private keys, live access tokens, or unnecessary identity documents.

### Testing restrictions

Security researchers and contributors must:

- Test only systems they own or have explicit authorization to assess.
- Avoid accessing or modifying other users’ data.
- Avoid destructive testing, denial-of-service activity, and persistence.
- Avoid downloading or retaining private data beyond what is strictly necessary to demonstrate the issue.
- Stop testing if sensitive data is exposed unexpectedly.
- Report the issue privately and allow the maintainers to coordinate remediation.

—

## 5. Vulnerability Classification

Use severity and practical impact to prioritize investigation.

| Severity | Examples | Recommended handling |
|—|—|—|
| Critical | Active credential compromise, remote code execution affecting production, broad unauthorized access to sensitive data | Immediate containment and urgent remediation |
| High | Authentication bypass, privilege escalation, serious private-document exposure | Urgent investigation and remediation |
| Medium | Significant access-control weakness with limited conditions or impact | Prioritized remediation |
| Low | Limited-impact security weakness with constrained exploitability | Remediate through the normal security workflow |
| Informational | Hardening recommendation or non-exploitable configuration concern | Review and address when appropriate |

Severity must be assessed using the actual exploitability, affected systems, data exposure, privileges required, and potential business impact.

These categories are triage guidance, not a promise of a specific response time.

—

## 6. GitHub Repository Security

Repository maintainers should review and configure the following controls.

### Access management

- Grant access only to authorized contributors.
- Prefer role-based repository permissions.
- Require multifactor authentication where supported by organizational policy.
- Review collaborator and team membership periodically.
- Remove access when it is no longer required.
- Restrict administrative and bypass permissions.
- Protect production environments separately from general repository access.

### Branch protection

Protect the production branch, commonly `main`, using GitHub branch protection or repository rulesets.

Recommended controls:

- Require pull requests before merging.
- Require relevant CI checks to pass.
- Apply appropriate review requirements.
- Restrict force pushes and branch deletion.
- Limit ruleset bypass permissions.
- Require production deployment approval where appropriate.

A policy document does not activate these settings automatically. Configure and verify them in the repository.

### Sensitive changes

Changes to the following areas should receive appropriate review:

- `.github/workflows/`
- Authentication and authorization middleware.
- Secret-management configuration.
- Database migrations.
- Upload and download handling.
- Deployment scripts.
- Infrastructure permissions.
- Security policy and incident-response documents.

—

## 7. GitHub Actions Security

GitHub Actions workflows must use least-privilege permissions and isolate untrusted code from privileged operations.

### Workflow permissions

For ordinary read-only CI, the following may be sufficient:

```yaml
permissions:
  contents: read
```

Grant additional permissions only when the workflow requires them.

Avoid `write-all` and unnecessarily broad repository or organization permissions.

### Pull request safety

- Do not expose production secrets to untrusted pull-request code.
- Review workflows triggered by `pull_request_target` with particular care.
- Never use a privileged workflow to check out and execute untrusted pull-request code without an appropriate security design.
- Separate CI from production deployment workflows.
- Restrict deployment permissions to approved environments.
- Use concurrency controls where they reduce conflicting releases safely.
- Set reasonable job timeouts.

### Third-party actions

- Prefer trusted, maintained actions.
- Review action source code and permissions before adoption.
- Pin third-party actions to reviewed full commit SHAs where stronger supply-chain controls are required.
- Review updates before changing pinned versions.
- Avoid passing secrets to actions that do not need them.
- Do not assume that a popular action is automatically safe.

### Workflow files

Review workflow changes for:

- Excessive permissions.
- Unsafe shell interpolation.
- Untrusted input passed to scripts.
- Exposed credentials.
- Unverified downloaded executables.
- Insecure artifact handling.
- Unauthorized deployment triggers.

Treat branch names, pull-request titles, issue content, commit messages, and other event-provided values as untrusted input.

—

## 8. Secrets and Environment Configuration

Secrets must be managed through approved secret-management systems.

Examples include:

- `DATABASE_URL`
- `SESSION_SECRET`
- `ADMIN_TOKEN`
- `AI_API_KEY`
- Hosting-provider deployment credentials
- Private keys and integration tokens

These names are examples. Use only variables supported by the actual application.

### Required controls

- Never commit real credentials.
- Never include server secrets in public HTML, JavaScript, or JSON assets.
- Keep `.env` files out of version control.
- Use separate credentials for development, testing, staging, and production.
- Restrict secret access to authorized workflows and maintainers.
- Rotate credentials when exposure is suspected.
- Prefer short-lived credentials and workload identity when supported.
- Avoid printing environment variables or authorization headers in logs.
- Review secret access after staff or collaborator changes.

### If a secret is exposed

1. Revoke or rotate the exposed credential immediately.
2. Assess affected systems and access logs.
3. Disable or restrict the compromised integration where necessary.
4. Remove the secret from active configuration.
5. Review repository history, artifacts, logs, and other possible exposure locations.
6. Remediate the underlying cause.
7. Verify that the replacement credential works securely.
8. Document the incident and preventive actions.

Deleting a secret from the latest commit does not guarantee that it has been removed from Git history, forks, cached artifacts, or logs.

—

## 9. Dependency and Software Supply-Chain Security

MedOrbits should monitor direct and transitive dependencies.

### Node.js dependencies

- Commit the appropriate lockfile.
- Use `npm ci` for reproducible CI installation.
- Review dependency updates before merging.
- Monitor known vulnerabilities.
- Prefer maintained packages with clear ownership and release practices.
- Remove unused dependencies where practical.
- Avoid automatic forced upgrades without review.
- Investigate unexpected package lifecycle scripts.

Run a dependency audit when appropriate:

```bash
npm audit
```

Review the output in context. A reported vulnerability requires assessment of severity, exploitability, reachability, and available remediation.

Do not automatically execute `npm audit fix —force` in production or as an unconditional CI step.

### Optional Python dependencies

If Python utilities are used:

- Declare dependencies in a reviewed requirements or project configuration file.
- Pin or constrain versions according to the project’s dependency policy.
- Review package sources and licenses.
- Avoid installing unreviewed packages in production.
- Keep Python dependencies isolated from the Node.js runtime.

### Build artifacts

- Do not include secrets in build output.
- Limit access to artifacts containing internal information.
- Define artifact retention.
- Avoid deploying unverified or unreviewed build artifacts.

—

## 10. Application and API Security

Infrastructure controls must support secure application behavior.

### Authentication and authorization

- Enforce authorization server-side.
- Verify ownership for private applications and documents.
- Protect administrative endpoints.
- Use secure session configuration.
- Apply rate limits to authentication and sensitive operations.
- Invalidate sessions or tokens when required.

### Input validation

- Validate request bodies, route parameters, and query parameters.
- Use explicit schemas for structured input.
- Use parameterized database queries.
- Avoid constructing shell commands from untrusted input.
- Apply output encoding appropriate to the rendering context.
- Validate external API responses before use.

### File uploads

- Enforce size and file-type restrictions.
- Validate file signatures where feasible.
- Generate storage names on the server.
- Keep private documents outside the public web root.
- Restrict downloads through server-side authorization.
- Use malware scanning where available and appropriate.
- Apply retention and deletion rules.

### PostgreSQL

- Use least-privilege database roles.
- Restrict network access.
- Use TLS where appropriate for deployed connections.
- Apply reviewed migrations.
- Protect backups.
- Avoid logging credentials or sensitive query parameters.

—

## 11. Personal Data and Privacy

MedOrbits may process applicant information, educational records, contact details, uploaded documents, and employment applications.

Protect this information throughout collection, storage, access, transmission, logging, and deletion.

Requirements include:

- Collect only information needed for a defined purpose.
- Restrict access based on role and legitimate need.
- Use HTTPS for production traffic.
- Protect private files from public access.
- Avoid logging passwords, session tokens, document contents, and unnecessary personal information.
- Define data retention and deletion procedures.
- Limit the information included in support tickets and test fixtures.
- Use synthetic or appropriately anonymized data in development and testing.
- Review third-party data sharing and external AI integrations before enabling them.

Apply applicable privacy requirements and the organization’s approved policies.

—

## 12. Logging, Monitoring, and Auditability

Security-relevant operations should generate appropriate, privacy-conscious audit records.

Potential events include:

- Authentication failures and suspicious access attempts.
- Permission changes.
- Administrative actions.
- Deployment and configuration changes.
- Secret rotation.
- Document access events.
- Security control failures.
- Unexpected database access patterns.

### Logging standards

- Include timestamps and request or correlation identifiers where appropriate.
- Record useful operational context.
- Redact credentials and sensitive values.
- Restrict log access.
- Configure retention.
- Protect logs against unauthorized modification where feasible.
- Avoid exposing stack traces in public API responses.

Monitoring should support detection and investigation without collecting unnecessary personal data.

—

## 13. Security Incident Response

Use an established incident-response process.

### Phase 1: Identify

- Confirm the suspected incident.
- Determine affected services, accounts, credentials, and data.
- Assess severity and potential ongoing exposure.

### Phase 2: Contain

- Revoke compromised credentials.
- Restrict affected access.
- Disable vulnerable integrations where necessary.
- Stop unsafe deployments or automated jobs.
- Preserve appropriate evidence.

### Phase 3: Investigate

- Review sanitized logs and relevant audit events.
- Identify the likely entry point and scope.
- Determine whether private information was accessed or exposed.
- Avoid destructive investigation steps that erase necessary evidence.

### Phase 4: Remediate

- Fix the underlying vulnerability.
- Rotate affected secrets.
- Deploy a reviewed correction.
- Restore secure permissions and configuration.
- Add regression tests where appropriate.

### Phase 5: Recover

- Verify service health.
- Confirm that affected controls work correctly.
- Monitor for recurrence.
- Restore normal operations when authorized.

### Phase 6: Review

- Record a factual incident timeline.
- Document root cause and impact.
- Identify preventive improvements.
- Assign follow-up actions through the established process.

Follow applicable legal, contractual, and organizational notification requirements. Do not promise a notification deadline that has not been formally established.

—

## 14. Vulnerability Remediation and Disclosure

Maintain a controlled workflow for security findings.

Recommended sequence:

1. Receive and acknowledge the report through an approved channel.
2. Reproduce the issue safely.
3. Assess severity and scope.
4. Assign an authorized maintainer.
5. Develop and review a fix.
6. Add regression tests.
7. Deploy the correction through the approved release process.
8. Verify the fix.
9. Coordinate disclosure with the reporter when appropriate.
10. Document preventive actions.

Avoid publishing exploit details before an appropriate mitigation or coordinated disclosure decision.

Security reports must not be treated as ordinary feature requests if they reveal an exploitable vulnerability.

—

## 15. Security Verification Checklist

### Repository and access

- [ ] Repository access is limited to authorized contributors.
- [ ] Protected branch rules are configured.
- [ ] Required CI checks are enforced.
- [ ] Sensitive workflow changes receive appropriate review.
- [ ] Production deployment permissions are restricted.

### GitHub Actions

- [ ] Workflows use least-privilege permissions.
- [ ] Untrusted pull requests do not receive production secrets.
- [ ] Third-party actions have been reviewed.
- [ ] Workflow inputs are treated as untrusted.
- [ ] Logs and artifacts do not expose credentials.

### Secrets and dependencies

- [ ] Secrets are stored in approved secret-management systems.
- [ ] No active credentials are committed to source control.
- [ ] Lockfiles are committed.
- [ ] Dependency risks are reviewed.
- [ ] Credential rotation procedures are available.

### Application and data

- [ ] Authentication and authorization are enforced server-side.
- [ ] Private documents require authorization.
- [ ] Database access follows least privilege.
- [ ] Input validation is implemented.
- [ ] Logs avoid unnecessary personal information.
- [ ] Backup and recovery procedures are documented.

### Incident readiness

- [ ] A private reporting channel is verified.
- [ ] Authorized incident responders are identified.
- [ ] Credential rotation can be performed.
- [ ] Recovery procedures are documented.
- [ ] Security fixes can be tested and released safely.

—

## 16. Related Documentation

Review the following documents when available:

- `infrastructure/github/README.md`
- `infrastructure/github/ci.md`
- `infrastructure/github/deployment.md`
- `docs/INTEGRATION.md`
- `docs/VALIDATION.md`
- `docs/TESTING.md`
- `docs/RUNNING_PYTHON.md`
- Repository-root `SECURITY.md`
- `PRIVACY.md`
- `.github/workflows/`

Verify all paths against the actual repository structure.

—

## 17. Policy Maintenance

Review this document:

- After a security incident.
- When authentication or authorization changes.
- When deployment architecture changes.
- When new secrets or integrations are introduced.
- When GitHub Actions permissions change.
- When dependency-management practices change.
- When applicable legal or organizational requirements change.

Policy changes should receive appropriate review and should not introduce unverified reporting contacts or response-time commitments.

—

## 18. Final Security Standard

MedOrbits infrastructure must protect source code, credentials, production environments, user data, and deployment processes through enforceable controls and documented response procedures.

**Security principle:** Least privilege, protected secrets, reviewed dependencies, verified releases, responsible disclosure, and continuous improvement.

**Document owner:** MedOrbits maintainers  
**Review cadence:** Periodically and after significant security or infrastructure changes  
**Status:** Infrastructure security policy
