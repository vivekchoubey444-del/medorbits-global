Security Policy — MedOrbits

MedOrbits Security Policy

Document: SECURITY.md
Version: 2.0.0
Status: Public security policy — publication pending operational verification
Applies to: MedOrbits websites, APIs, administrative interfaces, data systems, and associated services

⸻

1. Security Commitment

MedOrbits is committed to protecting the confidentiality, integrity, and availability of its websites, applications, infrastructure, and information entrusted to its services.

Security is an ongoing responsibility involving secure software development, access control, data protection, vulnerability management, dependency maintenance, monitoring, and incident response.

This policy describes the intended security practices for MedOrbits and provides guidance for reporting potential vulnerabilities.

Important: The presence of a control or process in this document does not, by itself, establish that it has been implemented, independently verified, or enabled in production. Operational claims must be confirmed before publication.

2. Scope

This policy applies to MedOrbits-controlled systems, where applicable and authorized, including:

* Public websites and informational pages.
* Authentication, registration, and account-management functionality.
* Application and admission-guidance workflows.
* Administrative dashboards and privileged interfaces.
* APIs, middleware, controllers, services, and validation layers.
* Databases, database migrations, and data-access components.
* File uploads, document storage, and document-access workflows.
* Notifications and communication services.
* Payment integrations and transaction-related workflows.
* Deployment pipelines, configuration, and infrastructure managed by MedOrbits.
* First-party source code, dependencies, and supporting services.

2.1 Out-of-scope systems

Unless explicit written authorization states otherwise, this policy does not authorize testing against:

* Third-party websites, APIs, or infrastructure.
* Government admission, examination, identity, or document portals.
* Payment-provider systems or banking infrastructure.
* Hosting providers’ shared infrastructure.
* Other users’ accounts, private documents, or personal information.
* Systems unrelated to MedOrbits or outside the authorized testing scope.

A vulnerability involving a third-party service should be reported to the responsible provider. MedOrbits may investigate its own integration where authorized.

3. Reporting a Security Vulnerability

MedOrbits encourages responsible reports of potential security vulnerabilities that could affect its users, systems, or data.

3.1 Reporting channel

Before publishing this policy, MedOrbits must designate and verify an appropriate security-reporting channel.

Preferred options include:

* A dedicated security email address on an approved MedOrbits domain.
* A private vulnerability-reporting feature in the official source-code repository.
* An approved private security-reporting form.

Do not publish an unverified email address or reporting URL. Configure the actual reporting channel in the project and make it accessible to the personnel responsible for receiving and handling reports.

3.2 Information to include

A useful report should include, where available:

1. A concise vulnerability summary.
2. The affected URL, endpoint, component, or version.
3. The potential security impact.
4. Reproduction steps using a controlled test environment.
5. A minimal proof of concept that avoids accessing real user data.
6. Relevant request and response examples with credentials and personal information removed.
7. Suggested remediation, if known.
8. The reporter’s preferred method of contact, if they wish to provide it.

Please do not include passwords, session cookies, API keys, access tokens, identity documents, or other sensitive information in a report unless a secure, explicitly approved process requires it.

3.3 What not to do

Security testing must not involve:

* Accessing, downloading, or disclosing other users’ private information.
* Modifying or deleting production data.
* Disrupting services or conducting denial-of-service attacks.
* Performing destructive tests against production systems.
* Using phishing, social engineering, or physical intrusion.
* Installing persistence mechanisms, malware, or unauthorized backdoors.
* Escalating access beyond what is necessary to demonstrate the reported issue.
* Publicly disclosing exploitable details before responsible coordination.

If sensitive information is exposed accidentally, stop testing, preserve only the minimum evidence necessary, and report the issue promptly.

4. Responsible Disclosure

MedOrbits aims to assess valid security reports, determine their impact, and coordinate remediation responsibly.

The intended process is:

1. Receipt: The designated reporting channel receives the report.
2. Triage: The report is assessed for validity, scope, severity, and potential impact.
3. Investigation: The affected component and plausible attack path are examined.
4. Remediation: Appropriate corrective actions are developed and tested.
5. Verification: The original vulnerability and relevant regression risks are retested.
6. Closure: The outcome is documented, subject to privacy and security requirements.

Acknowledgment and remediation timelines must be established by the responsible team and published only when operationally supported. This policy does not promise a specific response time.

Coordinated disclosure should consider user safety, the severity of the issue, remediation status, and applicable legal obligations.

5. Vulnerability Severity and Prioritization

MedOrbits should classify reported vulnerabilities using a consistent risk-assessment process. CVSS may be used as a supporting framework, alongside business impact and the sensitivity of affected information.

Severity	Typical examples	Recommended priority
Critical	Unrestricted compromise of production systems, widespread exposure of highly sensitive records, or severe authentication bypass	Emergency assessment and containment
High	Privilege escalation, unauthorized access to private applicant documents, or significant account compromise	Expedited remediation
Medium	Limited unauthorized access, meaningful security-control bypass, or exploitable information exposure	Planned remediation with risk tracking
Low	Limited-impact weaknesses with constrained exploitability	Remediation through normal maintenance
Informational	Hardening opportunities without a demonstrated vulnerability	Review and address where appropriate

These classifications are guidance, not a substitute for technical investigation. Actual severity depends on exploitability, privileges required, affected users, exposure, and business impact.

6. Authentication and Session Security

Authentication components should follow secure implementation practices.

Expected controls include:

* Hashing passwords using an established password-hashing algorithm with appropriate parameters.
* Never storing plaintext passwords or logging passwords.
* Enforcing appropriate password and account-recovery controls.
* Using secure session management or appropriately implemented token-based authentication.
* Setting session cookies with HttpOnly, Secure in HTTPS deployments, and an appropriate SameSite policy.
* Applying session expiration, revocation, and rotation where required.
* Protecting authentication endpoints against automated abuse.
* Avoiding user enumeration through unnecessarily revealing authentication responses.
* Requiring additional verification for sensitive account or administrative operations where appropriate.
* Using multi-factor authentication for privileged accounts where supported and required by the risk assessment.

Authentication failures must not disclose credentials, password hashes, private account data, or internal implementation details.

7. Authorization and Access Control

Access must be granted according to the principle of least privilege.

Security-sensitive operations should enforce authorization on the server, independently of what the frontend displays.

Expected practices include:

* Checking permissions for every protected API operation.
* Enforcing ownership or tenant boundaries when users access their own records.
* Separating public, authenticated, staff, and administrative capabilities.
* Validating role assignments on the server.
* Preventing users from granting themselves elevated privileges.
* Denying access by default when permissions cannot be established.
* Protecting administrative endpoints from unauthorized access.
* Rechecking authorization when retrieving, downloading, modifying, or deleting sensitive documents.
* Avoiding reliance on client-supplied role names, user IDs, or ownership claims.

A hidden button, disabled form field, unlisted URL, or frontend route guard is not a sufficient security boundary.

8. API Security

MedOrbits APIs should be designed and maintained with explicit security boundaries.

8.1 Request validation

* Validate request bodies, query parameters, path parameters, headers, and uploaded files.
* Use defined schemas for expected request structures.
* Reject malformed input and unexpected fields where appropriate.
* Enforce length, range, format, and collection-size limits.
* Normalize input consistently before validation where necessary.
* Use parameterized database queries rather than concatenating untrusted values into SQL.
* Avoid unsafe dynamic code execution and untrusted deserialization.

8.2 Rate limiting and resource protection

Apply suitable request limits to sensitive or resource-intensive endpoints, including:

* Login and registration.
* Password-reset and account-recovery operations.
* Search and data-export operations.
* File uploads and downloads.
* Administrative operations.
* Expensive database-backed requests.
* Public forms that could be abused for spam.

Limits should be appropriate to the endpoint, deployment architecture, and expected legitimate traffic.

8.3 HTTP security

Where applicable, configure:

* HTTPS throughout production traffic.
* Appropriate security headers.
* A restrictive Content Security Policy compatible with the application.
* Explicit Cross-Origin Resource Sharing (CORS) allowlists.
* Request-size and upload-size limits.
* Secure redirect and origin-validation behavior.
* Correct proxy and forwarded-header handling.

CORS is a browser access-control mechanism, not a replacement for authentication or authorization.

8.4 Error handling

Production errors should not expose:

* Stack traces.
* Filesystem paths.
* Database connection details.
* SQL statements.
* Environment variables.
* Secret values.
* Internal service topology.
* Sensitive user or application records.

Return consistent, appropriately scoped error responses and retain necessary diagnostic information in protected server-side logs.

9. Database Security

Database access should be restricted to authorized application components and administrators.

Expected practices include:

* Using parameterized queries and safe database access patterns.
* Applying least-privilege database roles.
* Separating application, migration, and administrative privileges where practical.
* Restricting database network access.
* Keeping database credentials outside source control.
* Encrypting database connections when required by the deployment architecture.
* Applying schema changes through reviewed migrations.
* Maintaining appropriate backups and testing restoration procedures.
* Limiting the exposure of sensitive data in query results and logs.
* Reviewing database permissions and unused accounts periodically.

Where audit records are required, protect their integrity and access. Database triggers or application-level append-only logic alone should not be represented as tamper-proof against database owners or sufficiently privileged administrators.

10. Applicant Documents and Personal Information

MedOrbits may process application details and supporting documents, depending on the features enabled in a particular deployment. Such information must be handled according to its sensitivity and the applicable privacy and legal requirements.

10.1 File upload controls

Where document uploads are supported:

* Allow only necessary file types.
* Validate file extensions, declared content types, and file signatures as appropriate.
* Apply upload-size and file-count limits.
* Generate server-controlled storage identifiers.
* Avoid trusting user-supplied filenames or paths.
* Store sensitive files outside publicly accessible web directories.
* Use malware scanning or other file inspection controls where appropriate to the risk.
* Prevent path traversal and unauthorized file replacement.
* Avoid executing uploaded content.
* Apply safe download headers and content-disposition handling.

File extensions and browser-supplied MIME types alone are not reliable proof that a file is safe.

10.2 Private document access

* Require server-side authorization for document retrieval.
* Verify the requesting user’s access rights to the specific document.
* Avoid predictable public file URLs.
* Use short-lived, appropriately scoped download links if signed URLs are used.
* Avoid exposing documents through public caches, search indexing, or unrestricted static directories.
* Audit sensitive document-access operations where justified.
* Remove or redact sensitive data from diagnostic logs.

10.3 Data minimization and retention

Collect only information necessary for the stated purpose. Define retention periods, deletion procedures, access permissions, and backup handling in accordance with applicable obligations and documented business requirements.

Do not claim that all information is encrypted, deleted on demand, or retained for a particular period unless the relevant implementation and operational procedures have been verified.

11. Secrets and Configuration Management

Credentials and secrets must be handled securely across development, testing, and production.

Never commit the following to a public repository:

* Database passwords or connection strings containing credentials.
* API keys and bearer tokens.
* Session-signing secrets.
* Private keys and certificates.
* Cloud-provider credentials.
* Payment-provider secrets.
* Administrative tokens.
* Production environment files containing sensitive values.

Use approved environment-variable or secrets-management mechanisms. Provide safe example files containing placeholders rather than real secrets.

11.1 Secret exposure response

If a secret is exposed:

1. Determine its scope and privileges.
2. Revoke or rotate the affected credential.
3. Check relevant access logs for suspicious activity.
4. Update dependent services and deployments.
5. Remove the secret from active code and configuration.
6. Assess whether repository history or external copies require additional remediation.
7. Document the incident and preventive actions.

Deleting a secret from the latest commit does not invalidate it and does not necessarily remove it from repository history, caches, or existing clones.

12. Infrastructure and Deployment Security

Production infrastructure should be configured and maintained to minimize attack surface.

Expected practices include:

* Keeping supported runtime versions and dependencies updated.
* Restricting production administrative access.
* Using HTTPS and correctly configured TLS certificates.
* Separating development, test, and production environments.
* Restricting access to deployment credentials.
* Reviewing deployment and infrastructure configuration changes.
* Avoiding production secrets in build logs.
* Disabling debug modes and development-only endpoints in production.
* Restricting database and internal-service exposure.
* Maintaining documented backup and recovery procedures.
* Reviewing deployment-provider permissions and access controls.

Health and readiness endpoints should reveal only information necessary for their operational purpose. They should not disclose credentials, internal configuration, sensitive database details, or excessive infrastructure information.

13. Payment and Financial Workflows

If payment processing is enabled, MedOrbits should use appropriately vetted payment providers and follow their integration requirements.

Expected safeguards include:

* Using provider-hosted or appropriately secured payment collection flows where practical.
* Verifying payment callbacks or webhook signatures.
* Rejecting replayed or invalid events where supported.
* Using idempotency controls for operations that could otherwise create duplicate transactions.
* Confirming transaction status on the server.
* Never trusting a client-side success screen as proof of payment.
* Avoiding unnecessary storage of payment-card data.
* Protecting transaction references and financial records.
* Restricting refunds, settlement adjustments, and administrative overrides to authorized personnel.
* Maintaining appropriate transaction audit records.

Payment functionality must not be described as compliant with a particular standard unless its scope and compliance status have been verified.

14. Logging, Monitoring, and Auditability

Logging should support security investigation while minimizing the collection of sensitive information.

Potentially useful events include:

* Authentication successes and failures.
* Authorization failures.
* Privilege and role changes.
* Sensitive document access.
* Administrative actions.
* Significant account changes.
* Rate-limit and abuse detections.
* Unexpected application failures.
* Security configuration changes.
* Payment-related events, where applicable.

Logs should be protected against unauthorized access and alteration. Access to logs should be restricted, and retention should be defined according to operational needs and applicable obligations.

Do not log passwords, session tokens, authorization headers, private keys, or full sensitive documents. Redact personal and application information where possible.

Monitoring and alerting capabilities must be tested before they are represented as active operational controls.

15. Security Testing and Quality Assurance

Security should be incorporated into development and release workflows.

Recommended checks include:

* Unit and integration tests for authentication and authorization.
* Tests for role separation and record ownership.
* Request-schema and input-validation tests.
* File-upload and document-access tests.
* Rate-limiting and abuse-resistance tests.
* Dependency vulnerability scanning.
* Secret scanning.
* Static analysis and code review.
* Regression tests for previously identified vulnerabilities.
* Deployment configuration checks.
* Backup-restoration and recovery exercises.
* Targeted security assessments for high-risk changes.

Tests should run against controlled environments and dedicated test data. They should not cause destructive changes to production systems or expose real applicant information.

Passing automated tests does not establish that an application is free from vulnerabilities. Testing scope, coverage, and known limitations should be documented accurately.

16. Dependency and Third-Party Risk Management

Third-party packages and services may introduce security, availability, and supply-chain risks.

MedOrbits should:

* Maintain dependency manifests and lockfiles.
* Review security advisories for important dependencies.
* Apply supported security updates promptly according to risk.
* Review significant dependency changes before deployment.
* Remove unused packages and unnecessary permissions.
* Assess the provenance and maintenance status of critical dependencies.
* Review automated update proposals before merging.
* Avoid applying disruptive major-version upgrades without compatibility testing.
* Document material third-party dependencies and relevant operational risks.

Dependency audit output should be reviewed and triaged. Automatically applying forceful dependency upgrades without reviewing breaking changes can introduce production failures.

17. Administrative and Privileged Access

Administrative access can expose a large portion of the application’s functionality and data. It should receive additional protection.

Expected practices include:

* Granting privileges only to authorized personnel.
* Enforcing server-side role checks on every privileged operation.
* Requiring stronger authentication where supported.
* Reviewing privileged accounts periodically.
* Revoking access when it is no longer needed.
* Recording security-relevant administrative actions.
* Protecting role-management and credential-reset functions.
* Restricting access to bulk exports and sensitive records.
* Avoiding shared administrative credentials.
* Separating routine user operations from privileged operations.

Administrative interfaces must not rely on obscure URLs or frontend-only restrictions for protection.

18. Incident Response

A suspected security incident should be handled through a documented process appropriate to its severity.

18.1 Response stages

1. Identify: Confirm the alert or report and establish the likely scope.
2. Contain: Limit ongoing unauthorized access or damage.
3. Investigate: Determine the affected systems, accounts, records, and time period.
4. Remediate: Correct the vulnerability, revoke compromised credentials, and restore secure operation.
5. Recover: Restore affected services and verify critical security controls.
6. Communicate: Notify appropriate stakeholders and affected individuals when required.
7. Review: Record findings, contributing factors, and preventive actions.

18.2 Evidence preservation

Preserve relevant logs and technical evidence where lawful and appropriate. Restrict access to incident records and avoid unnecessary copying of personal information.

18.3 Notification obligations

Notifications to users, authorities, providers, or other stakeholders must follow applicable legal requirements, contractual obligations, and verified incident-response procedures.

This policy does not establish a particular notification deadline or guarantee that every incident will be publicly disclosed.

19. Legal and Safe-Harbor Considerations

MedOrbits welcomes good-faith security research conducted within an explicitly authorized scope.

This policy is not blanket authorization to test any system, access any information, or violate applicable laws or third-party terms.

Before conducting testing, researchers should ensure that they have appropriate authorization for the affected systems. If an activity may cause harm or exceed the authorized scope, stop and seek clarification through the designated reporting channel.

Any formal safe-harbor commitment must be reviewed and approved by the appropriate legal and operational stakeholders before publication. This document does not independently grant legal immunity or override third-party policies.

20. Policy Maintenance and Governance

The security policy should be reviewed periodically and after material changes to MedOrbits’ architecture, services, threat environment, or legal obligations.

The responsible maintainers should:

* Keep the policy aligned with actual implemented controls.
* Maintain a verified security-reporting channel.
* Assign responsibility for vulnerability triage.
* Review unresolved security findings.
* Record significant security decisions.
* Update affected documentation when operational processes change.
* Remove obsolete statements and unsupported claims.
* Ensure that public policy changes receive appropriate review.

The repository owner should assign maintainers for this document and establish a review process appropriate to the project’s release cycle.

21. Publication Readiness Checklist

Complete the following checks before treating this policy as fully operational.

* [ ]	Configure and test the official vulnerability-reporting channel.
* [ ]	Assign personnel responsible for receiving and triaging reports.
* [ ]	Define internal severity assessment and remediation procedures.
* [ ]	Verify production authentication and session controls.
* [ ]	Review server-side authorization across protected routes.
* [ ]	Verify database privileges, connection security, and backup procedures.
* [ ]	Test private document storage and access controls.
* [ ]	Review secret-handling and credential-rotation procedures.
* [ ]	Confirm production error handling and logging behavior.
* [ ]	Verify rate limits, request validation, and CORS configuration.
* [ ]	Review payment security controls if payment functionality is enabled.
* [ ]	Confirm dependency scanning and security testing workflows.
* [ ]	Document incident-response ownership and escalation procedures.
* [ ]	Obtain any required legal review of disclosure and safe-harbor language.
* [ ]	Ensure that all public claims match the deployed system and approved operational procedures.

22. Policy Disclaimer

This document describes MedOrbits’ security objectives, recommended practices, and intended vulnerability-reporting process. It is not an independent security audit, certification, warranty, or guarantee that vulnerabilities do not exist.

Actual protections depend on the implementation, configuration, deployment environment, operational procedures, and maintenance of the relevant systems.

Nothing in this document overrides applicable law, contractual obligations, or the security requirements of third-party services.

⸻

End of SECURITY.mderability reporting is unavailable, contact a repository maintainer through an established private communication channel. Confirm that the channel is private before sharing technical details.

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