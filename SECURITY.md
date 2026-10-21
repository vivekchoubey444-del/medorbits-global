Security Policy — MedOrbits

Project: MedOrbits
Scope: Application Security, Repository Security, Dependencies, Integrations, and Deployed Services
Purpose: Provide a responsible, private, and coordinated process for reporting security vulnerabilities.

MedOrbits takes security reports seriously. We encourage responsible disclosure of suspected vulnerabilities affecting the platform, its source code, APIs, integrations, and supporting infrastructure.

This policy describes how to report a concern, what information to include, and how maintainers should coordinate investigation and remediation.

⸻

1. Supported Versions

Security fixes are prioritized for the current maintained version of MedOrbits.

Support for earlier versions depends on their maintenance status, release history, compatibility requirements, and available resources.

Before reporting a version-specific issue, consult the repository’s release notes and CHANGELOG.md, or contact the maintainers through an established private channel.

Important: Do not assume that a version is supported merely because it remains available in the repository or in a deployment.

⸻

2. Reporting a Vulnerability

Do not disclose suspected vulnerabilities through public GitHub issues, discussions, pull requests, or other public channels.

Preferred Reporting Method

If GitHub private vulnerability reporting is enabled for the repository, submit a report through:

Report a vulnerability — MedOrbits

The availability of this feature and its access requirements must be confirmed in the repository settings.

If private vulnerability reporting is unavailable, contact a repository maintainer through an established private communication channel. Confirm that the channel is private before sharing technical details.

Do not send credentials, confidential records, or sensitive exploit details through an unverified channel.

Information to Include

Where possible, provide the following information:

* Summary: A concise description of the suspected vulnerability.
* Impact: The security property affected and the potential consequences.
* Affected components: Relevant files, modules, endpoints, versions, or integrations.
* Reproduction steps: Clear, minimal steps to reproduce the issue safely.
* Evidence: Sanitized logs, screenshots, request and response examples, or a minimal proof of concept.
* Conditions: Required permissions, account roles, configuration, or deployment assumptions.
* Mitigation: A suggested fix or workaround, if known.
* Contact details: A private means of communication for clarification and follow-up.

A complete exploit is not required to report a credible security concern. Do not perform additional testing that could harm users or production systems merely to strengthen a report.

Protect Sensitive Information

Never include:

* Real user data or identity documents.
* Passwords, access tokens, session cookies, or recovery codes.
* Active API keys, private keys, or production database credentials.
* Payment-card data or unnecessary financial information.
* Unredacted logs containing personal information.
* Data obtained by accessing another person’s account or records without authorization.

Sanitize all evidence before submitting it.

⸻

3. Scope

Reports concerning the following areas are welcome when they affect MedOrbits or systems maintained by its operators:

* Authentication, registration, account recovery, and verification.
* Authorization failures, privilege escalation, and insecure direct object references.
* Exposure of personal information, applications, documents, or account records.
* SQL injection, cross-site scripting, and other injection vulnerabilities.
* Cross-site request forgery and session-management weaknesses.
* File-upload, file-download, and document-access vulnerabilities.
* Administrative access-control failures.
* Payment processing, subscription logic, and webhook verification.
* API security, rate limiting, and abuse controls.
* Insecure configuration, exposed credentials, and secrets in source code.
* Vulnerable dependencies and software supply-chain risks.
* Server-side request forgery, path traversal, and unsafe file handling.
* Security weaknesses in deployment configuration and supporting services.

A report should identify the affected MedOrbits component and explain how the issue could affect confidentiality, integrity, or availability.

Out-of-Scope Considerations

Unless they demonstrate a concrete security impact, the following are generally lower priority:

* Findings limited to missing security headers without a demonstrated attack path.
* Generic scanner output without validation or supporting evidence.
* Theoretical vulnerabilities without a plausible impact.
* Issues in unrelated third-party services that MedOrbits does not control.
* Requests for features or ordinary bugs without a security consequence.
* Social engineering, physical attacks, or denial-of-service testing without explicit authorization.

An apparently out-of-scope finding may still be relevant if it demonstrates a meaningful risk to MedOrbits or its users.

⸻

4. Safe Testing and Research Boundaries

Security research must not unnecessarily expose users, data, or production services to risk.

Researchers must:

* Test only systems and accounts they own or are explicitly authorized to assess.
* Prefer local development environments, staging deployments, and synthetic data.
* Avoid accessing, modifying, downloading, or disclosing another user’s private information.
* Avoid destructive testing, sustained denial-of-service testing, or actions that disrupt production.
* Never install persistent access mechanisms, deploy malware, or establish unauthorized access.
* Avoid stolen credentials and stop testing after encountering data outside their authorization.
* Avoid changes to production data or payment transactions without explicit authorization.
* Stop testing when sufficient evidence has been collected to demonstrate the issue safely.

If testing unexpectedly exposes private information or affects a live service, stop, preserve only the minimum necessary evidence, and report the incident privately.

Researcher Conduct

MedOrbits asks researchers to act in good faith, minimize harm, protect confidential information, and cooperate with reasonable requests needed to verify and remediate a report.

This policy does not grant permission to access systems, accounts, or data beyond the researcher’s existing authorization. Any legal safe-harbor commitment must be explicitly approved by the organization or person authorized to make it.

⸻

5. Maintainer Response Process

Upon receiving a report, maintainers should follow a coordinated process.

1. Receipt and acknowledgement: Confirm receipt when reasonably possible and establish a private communication channel.
2. Initial assessment: Determine whether the report concerns MedOrbits, whether the issue is reproducible, and what systems or data may be affected.
3. Severity assessment: Evaluate exploitability, required privileges, attack conditions, and potential impact on confidentiality, integrity, and availability.
4. Containment: Consider immediate mitigations when active exploitation or significant exposure is suspected.
5. Remediation: Develop, review, and test an appropriate fix or mitigation.
6. Coordination: Communicate relevant status updates to the reporter where possible.
7. Release and verification: Deploy or publish the fix through the appropriate release process and validate the remediation.
8. Closure: Document the outcome, any remaining risk, and relevant follow-up actions.

Response Expectations

Response times depend on severity, reproducibility, staffing, and available resources. Maintainers should acknowledge and triage reports as promptly as reasonably possible, prioritizing credible reports involving active exploitation, exposed credentials, unauthorized access, or sensitive-data disclosure.

This policy does not promise a fixed acknowledgement, remediation, or release deadline.

If a report is not immediately actionable, maintainers may request additional sanitized evidence. Researchers should avoid resending sensitive material or publishing the vulnerability simply because an immediate response has not arrived.

⸻

6. Severity and Prioritization

Severity should reflect the actual risk to MedOrbits and its users, not merely the presence of a scanner finding.

Priority	General Description	Typical Response
Critical	Credible risk of widespread compromise, major unauthorized access, or severe sensitive-data exposure	Immediate assessment and containment where necessary
High	Significant privilege escalation, sensitive-data exposure, or compromise of an important application function	Prioritized investigation and remediation
Medium	Meaningful security weakness requiring particular conditions or limited privileges	Planned remediation with risk-based prioritization
Low	Limited-impact weakness with restricted exploitability	Address as resources and release planning permit
Informational	Hardening recommendation or finding without a demonstrated vulnerability	Review and consider as appropriate

These categories are guidance, not a guarantee of a particular outcome or deadline. Final prioritization depends on verified impact, exploitability, affected environments, and compensating controls.

⸻

7. Coordinated Disclosure

Please allow maintainers a reasonable opportunity to investigate and address a vulnerability before publicly disclosing technical details.

Researchers and maintainers should coordinate, where practical, on:

* Verification of the issue.
* Mitigation and remediation.
* Release timing.
* Public advisories and technical descriptions.
* Attribution, if the researcher requests it and disclosure is appropriate.

Do not publish exploit details, sensitive user information, credentials, or operational instructions that could enable attacks while remediation is pending.

If coordinated disclosure becomes difficult, communicate privately to seek an appropriate resolution. Any disclosure timeline should account for severity, active exploitation, user risk, and the practical availability of a fix.

⸻

8. Secret and Credential Handling

Never commit the following to source control:

* API keys or access tokens.
* Passwords and authentication secrets.
* Private SSH keys or TLS private keys.
* Production database credentials.
* Payment-provider secrets and webhook signing secrets.
* Real .env files or sensitive environment-specific configuration.
* Recovery codes or confidential deployment credentials.

Use environment variables and approved secret-management services. Keep .env.example sanitized and free of real credentials.

If a Credential Is Exposed

1. Revoke or rotate it immediately.
2. Identify the systems and permissions associated with it.
3. Review relevant access logs and activity.
4. Update deployment secrets and affected services.
5. Remove the exposed material from the repository and, where appropriate, Git history.
6. Verify that the replacement credential is working and the compromised credential is no longer valid.

Removing a secret from the latest commit, deleting a file, or making the repository private does not invalidate an exposed credential or guarantee removal from historical copies.

Do not use production credentials or real personal, identity, application, or payment data in development and automated tests.

⸻

9. Security Controls and Limitations

MedOrbits may use automated dependency audits, secret scanning, static analysis, code review, access controls, and CI/CD checks, depending on repository configuration and deployment.

The presence of a workflow, configuration file, scanner, or security-related dependency does not establish that the corresponding control is enabled, correctly configured, or effective.

Automated tools can produce false positives and false negatives. They do not guarantee that all vulnerabilities will be detected.

Researchers and contributors should report credible security weaknesses even when automated checks pass.

⸻

10. Disclosure of Security Findings

Public disclosure should avoid unnecessary exposure of users, credentials, or exploit-enabling details.

Before publication, coordinate with maintainers where reasonably possible and consider:

* Whether a fix or effective mitigation is available.
* Whether active exploitation is occurring.
* Whether disclosure would expose sensitive information.
* Whether the affected deployment remains vulnerable.
* Whether a public advisory can explain the risk without enabling avoidable harm.

A security advisory should describe the impact, affected versions or components where known, mitigation, and remediation guidance without publishing secrets or private user data.

⸻

11. Policy Maintenance

Maintainers should review this policy when significant changes affect:

* Repository ownership or reporting channels.
* Supported versions and release practices.
* Application architecture or externally exposed services.
* CI/CD and dependency-security controls.
* Production infrastructure or incident-response procedures.

Ensure the private reporting URL remains correct and that the selected reporting method is actually available.

⸻

Security Statement

This policy establishes a reporting and coordination process. It does not guarantee that MedOrbits is free from vulnerabilities, that all reports will result in a fix, or that a specific response time can be met.

Project: MedOrbits
Scope: Application security, repository security, dependencies, integrations, and deployed services
Reporting: Private vulnerability reporting, where enabled

MedOrbits — Education · Admissions · Careers · Recruitment