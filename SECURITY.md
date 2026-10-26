MedOrbits Security Policy

Project: MedOrbits
Release: 2.0.0
Scope: Education · Admissions · Careers · Recruitment
Policy status: Draft — maintainer verification required

1. Purpose

MedOrbits takes the security of its website, application services, user accounts, uploaded documents, and associated data seriously.

This document explains which versions receive security updates, how to report a suspected vulnerability, what information to include, and how maintainers should handle security reports.

This policy must be reviewed and approved by the project maintainers before being presented as an active security commitment.

2. Supported Versions

Security support must be confirmed by the maintainers before publication.

Version	Security support
2.x	Intended release line; support status requires confirmation
1.x	Support status requires confirmation
Earlier versions	Support status requires confirmation

A version being listed here does not, by itself, guarantee that security patches are available. Maintainers should update this table when a release line enters or leaves security support.

3. Reporting a Vulnerability

Please do not disclose suspected security vulnerabilities in public GitHub issues, pull requests, discussions, or social media posts.

Use a private reporting channel approved by the MedOrbits maintainers.

Preferred reporting procedure

1. Open the repository’s Security tab on GitHub.
2. Look for Report a vulnerability or the repository’s configured private vulnerability reporting option.
3. Submit the report privately if that option is available.
4. Include enough technical information to reproduce and assess the issue safely.
5. Retain any private report reference provided by the platform.

If private vulnerability reporting is unavailable, contact a repository maintainer through a verified channel and ask for an approved private reporting method. Do not send exploit details, credentials, or personal data through an unverified address or public channel.

Maintainer action required: Enable and test GitHub private vulnerability reporting, or publish a verified alternative contact method before declaring this reporting process operational.

4. What to Include

A useful vulnerability report should include, where applicable:

* Summary: A concise description of the suspected vulnerability.
* Affected component: The page, endpoint, service, workflow, dependency, or configuration involved.
* Affected version: The release, branch, or commit where the issue was observed.
* Impact: The potential effect on confidentiality, integrity, availability, or user privacy.
* Reproduction steps: Minimal, non-destructive steps that demonstrate the issue.
* Evidence: Sanitized logs, screenshots, request examples, or proof-of-concept code.
* Environment: Relevant browser, operating system, runtime, or deployment details.
* Suggested mitigation: An optional fix or mitigation if one is known.

Do not include real user records, passwords, session cookies, API keys, private keys, access tokens, or other secrets in a report unless a verified secure process specifically requires a safely handled artifact.

Redact personal information and unrelated data before submitting evidence.

5. Scope

Potentially relevant security issues may include:

* Authentication and authorization bypasses.
* Insecure access to another user’s account or records.
* Exposure of application forms, identity documents, academic records, or other private data.
* Injection vulnerabilities, including SQL injection and command injection.
* Cross-site scripting and cross-site request forgery where applicable.
* Server-side request forgery.
* Insecure file uploads, downloads, storage, or document permissions.
* Exposure of credentials, tokens, or sensitive configuration.
* Vulnerable dependencies that create a demonstrable risk to the project.
* Security misconfiguration affecting production services.
* Payment or subscription workflow vulnerabilities.
* Privilege escalation or unauthorized administrative access.

Reports should explain the actual or reasonably demonstrable security impact. A scanner alert alone may not establish an exploitable vulnerability.

Generally out of scope

Unless a report demonstrates a meaningful security impact, the following are generally not sufficient by themselves:

* Missing security headers without a demonstrated consequence.
* Generic automated scanner output without reproducible evidence.
* Self-inflicted issues requiring the reporter to compromise their own account without affecting other users.
* Vulnerabilities in third-party services that are unrelated to MedOrbits.
* Unsupported software versions or configurations that are not used by the project.
* Social engineering, phishing, or physical attacks against people or facilities.
* Denial-of-service testing that risks disrupting users or production services.

Maintainers may reassess an out-of-scope report when credible evidence establishes a material impact.

6. Responsible Research

Security researchers are expected to:

* Act in good faith and avoid harming users or services.
* Test only systems they own or are explicitly authorized to assess.
* Avoid accessing, modifying, downloading, or disclosing other users’ data.
* Avoid destructive testing, persistence, service disruption, and unnecessary data collection.
* Stop testing when sensitive information or access outside the authorized scope is encountered.
* Report findings privately and allow maintainers a reasonable opportunity to investigate.
* Follow applicable laws and the terms governing the systems tested.

Do not attempt to prove impact by extracting private documents, exploiting real users, or disrupting production.

This policy does not authorize testing against systems outside the researcher’s existing permission.

7. Maintainer Handling Procedure

Maintainers should follow a controlled process for security reports.

1. Receive: Confirm receipt through the reporting channel, where practical.
2. Triage: Determine whether the report is in scope and whether the issue is reproducible.
3. Assess: Evaluate severity, affected versions, exploitability, and potential impact.
4. Contain: Apply proportionate mitigations where needed, especially for active exploitation or exposed credentials.
5. Remediate: Develop, test, and review an appropriate fix.
6. Coordinate: Work with the reporter on disclosure timing where practical.
7. Release: Publish a fix or mitigation through the applicable release process.
8. Disclose: Share a security advisory when appropriate, avoiding unnecessary disclosure of exploitable details or personal information.

Limit access to vulnerability reports and evidence to people who need it for investigation and remediation.

Do not copy sensitive report content into public issues, logs, build artifacts, or commit messages.

8. Response Times and Disclosure

No acknowledgement deadline, remediation deadline, or service-level agreement is established by this document.

Maintainers should publish response targets only after confirming that the project has the resources and process to meet them.

Coordinated disclosure should consider:

* The severity and exploitability of the issue.
* Whether the vulnerability is actively exploited.
* The availability of a safe mitigation or fix.
* The time needed to deploy and verify the fix.
* The risk of exposing users to further harm through premature disclosure.

Researchers and maintainers should avoid publishing details that unnecessarily enable exploitation while affected users remain at risk.

9. Secrets and Exposed Credentials

If a credential or secret is exposed:

1. Restrict further exposure where possible.
2. Revoke or rotate the affected credential.
3. Identify affected services and access permissions.
4. Review available audit logs for suspicious activity.
5. Remove the secret from active files and configurations.
6. Assess whether repository history, build logs, artifacts, or backups also contain it.
7. Document the incident and required follow-up.

Deleting a secret from the latest commit does not remove it from Git history or external copies. History rewriting should be coordinated carefully and must not replace credential revocation.

Never publish live secrets in a security advisory, issue, or remediation commit.

10. Dependencies and Automated Security Checks

MedOrbits maintainers should review relevant dependency and security findings before releases.

Recommended checks include:

* Dependency vulnerability auditing.
* Secret scanning.
* Static analysis where supported.
* Review of GitHub Actions permissions and third-party actions.
* Authentication and authorization testing.
* Input validation and file-upload testing.
* Review of production environment variables and access controls.
* Verification that sensitive files are not tracked in Git.
* Appropriate logging, rate limiting, and error handling.

Automated checks provide evidence for review; a passing scan does not prove that the application is secure.

Security tooling must not automatically apply breaking dependency upgrades, rewrite Git history, or deploy changes to production without an authorized review process.

11. Privacy and Sensitive Data

MedOrbits may handle education, admissions, career, recruitment, account, application, payment, or document-related information, depending on the services actually deployed.

Security reports should minimize personal data and avoid unnecessary copies of sensitive records.

Access to private information should be limited to authorized users and systems. Retention, disclosure, correction, and deletion must follow applicable law and the published privacy policy.

If a report indicates a possible personal-data breach, maintainers should follow the relevant incident-response and legal notification requirements.

12. Security Updates

When a security fix is released, maintainers should communicate the information appropriate to the risk and disclosure stage.

A security advisory may describe:

* The affected component and versions.
* The security impact.
* The fixed version or mitigation.
* Upgrade or configuration instructions.
* Relevant workarounds.
* Acknowledgement of the reporter, where appropriate and authorized.

Do not disclose personal information or operational details that would unnecessarily increase risk.

13. Contact and Publication Checklist

Before marking this policy active, maintainers must:

* [ ]	Enable and test private vulnerability reporting in GitHub, or verify an alternative private channel.
* [ ]	Confirm the repository and organization ownership of the reporting channel.
* [ ]	Confirm which releases receive security fixes.
* [ ]	Establish who is responsible for triage and remediation.
* [ ]	Define internal severity assessment and incident-escalation procedures.
* [ ]	Verify the privacy policy and relevant legal requirements.
* [ ]	Decide whether response targets can be published and reliably met.
* [ ]	Confirm the process for security advisories and coordinated disclosure.
* [ ]	Review this policy after significant changes to the application or its hosting environment.

Publication record

* Policy owner: Pending confirmation
* Last reviewed: Pending verification
* Private reporting channel: Pending verification
* Supported release lines: Pending confirmation
* Response targets: Not established
* Publication approval: Pending maintainer review

Do not represent pending details as confirmed capabilities or service commitments.

⸻

MedOrbits — Education · Admissions · Careers · Recruitment

Study · Work · Grow