MedOrbits — Security Policy and Implementation Guide

File: docs/SECURITY.md
Version: 1.0.0
Status: Security engineering reference
Application: MedOrbits
Backend: Node.js and Express, where applicable

⸻

1. Purpose

This document defines the security requirements and recommended engineering practices for MedOrbits, including its website, APIs, authentication system, database, uploaded documents, administrative tools, external integrations, and deployment infrastructure.

The objectives are to:

* Protect user accounts and personal information.
* Prevent unauthorised access to applications and documents.
* Reduce common web application and API vulnerabilities.
* Protect administrative and payment workflows.
* Keep credentials and secrets out of source control and client-side code.
* Detect, investigate, and respond to security incidents.
* Establish repeatable security checks for development and deployment.

This is a security implementation guide, not a statement that every control is already implemented. Verify the actual source code and deployed configuration before describing a control as active.

2. Security principles

MedOrbits should follow these principles:

1. Least privilege: Grant users, services, and database accounts only the permissions they require.
2. Defence in depth: Use multiple independent security controls rather than relying on a single mechanism.
3. Secure defaults: Deny access unless a request is explicitly permitted.
4. Server-side enforcement: Never trust frontend validation, hidden form fields, or client-supplied roles.
5. Data minimisation: Collect and retain only information necessary for the service.
6. Fail securely: Errors must not expose protected data or leave resources unintentionally accessible.
7. Traceability: Record security-relevant events without logging secrets.
8. Dependency hygiene: Keep runtimes and libraries supported, patched, and reviewed.
9. Privacy by design: Apply appropriate protections before introducing new processing features.
10. Verified claims: Do not advertise security controls, certifications, or compliance that have not been established.

3. Scope

This policy applies to:

* Public HTML pages and static assets.
* Browser-side JavaScript and JSON datasets.
* Node.js and Express services.
* API routes, middleware, controllers, and services.
* Authentication, sessions, and account recovery.
* User profiles and application records.
* Uploaded academic and identity documents.
* Database connections and migrations.
* Payment and refund workflows, if enabled.
* AI, email, analytics, and other third-party integrations.
* Administrator dashboards and privileged operations.
* Hosting, DNS, HTTPS, backups, and deployment pipelines.
* Application logs, monitoring, and incident response.

4. Threat model

The security design should account for at least the following threats.

Threat	Potential impact	Primary controls
Credential theft	Account takeover	Strong password hashing, secure sessions, rate limiting, MFA for privileged users
Broken access control	Exposure of another user’s records	Server-side authorization and ownership checks
SQL injection	Data exposure or modification	Parameterised queries and safe ORM usage
Cross-site scripting (XSS)	Session compromise or malicious actions	Output encoding, safe DOM APIs, content security policy
Cross-site request forgery (CSRF)	Unauthorised actions using a victim’s session	CSRF protection and appropriate cookie settings
Malicious uploads	Malware execution or data exposure	File validation, private storage, scanning where available
Secret leakage	Unauthorised infrastructure or API access	Secret management and log redaction
Webhook forgery or replay	Fraudulent payment state changes	Signature verification, event deduplication, idempotency
Denial of service	Service disruption	Rate limits, timeouts, request-size limits, monitoring
Dependency compromise	Remote code execution or data theft	Dependency review, lockfiles, vulnerability remediation
Misconfigured deployment	Public exposure or service compromise	Configuration validation and deployment reviews
Insider misuse	Unauthorised access or data changes	Least privilege, audit logging, access reviews

This threat model is a starting point. Review it whenever the platform adds new services, data categories, or privileged workflows.

5. Secrets and environment configuration

5.1 Prohibited practices

Never:

* Commit production credentials to Git.
* Embed private API keys in HTML, CSS, frontend JavaScript, or public JSON.
* expose database passwords in error messages.
* Print complete environment variables in logs.
* Store raw session tokens where a safer design is practical.
* Reuse production secrets in development or automated tests.
* Include secrets in screenshots, bug reports, or public issue trackers.

Any value included in browser-delivered code must be treated as public.

5.2 Environment variables

Potential server-side configuration names include:

NODE_ENV=production
PORT=3000
DATABASE_URL=
SESSION_SECRET=
ADMIN_TOKEN=
AI_API_KEY=
AI_API_URL=
AI_MODEL=

These are examples based on the project’s possible configuration. Keep only variables used by the actual implementation.

Requirements:

* Store production secrets in the hosting platform’s secret settings or a secret manager.
* Validate mandatory configuration during startup.
* Use strong, cryptographically generated secrets.
* Restrict who can view or modify production environment settings.
* Rotate credentials when exposure is suspected or confirmed.
* Remove obsolete credentials after migration.
* Keep .env files containing secrets out of version control.

Maintain a safe .env.example containing names and empty or clearly fake placeholder values only.

6. Authentication and account security

6.1 Passwords

If password authentication is supported:

* Hash passwords using a suitable modern password-hashing algorithm, such as Argon2id, with appropriately configured parameters.
* Use a reviewed password-hashing library.
* Never store plaintext passwords or reversible password encryption.
* Apply sensible password length and input handling rules.
* Prevent common password-reset and login abuse.
* Require reauthentication for particularly sensitive account changes where appropriate.

Do not create a custom password-hashing algorithm.

6.2 Sessions and tokens

Use a documented session or token strategy.

For cookie-based sessions:

* Set Secure in HTTPS production environments.
* Set HttpOnly for session cookies.
* Choose an appropriate SameSite policy.
* Use session rotation after authentication and privilege changes.
* Expire and revoke sessions according to policy.
* Apply CSRF protection to relevant state-changing requests.

For bearer-token authentication:

* Keep access tokens short-lived where practical.
* Protect refresh tokens and support revocation.
* Validate token signature, issuer, audience, and expiry as applicable.
* Do not place reusable credentials in URLs.
* Do not trust a role or user identifier supplied separately by the client.

Choose the controls that match the actual authentication design rather than combining incompatible mechanisms without a defined architecture.

6.3 Login and account recovery

* Apply rate limiting and abuse detection.
* Return generic responses where necessary to prevent account enumeration.
* Use short-lived, single-use password-reset tokens.
* Store reset-token hashes where practical.
* Invalidate reset tokens after use or expiry.
* Notify users of important account-security changes when appropriate.
* Avoid logging passwords, verification codes, or reset links.

6.4 Privileged accounts

Administrator and other privileged accounts should use multi-factor authentication where feasible, restricted access, and additional monitoring.

Privilege changes must be authorised server-side and audited. Never grant administrator access based on a role supplied by a browser request.

7. Authorization and resource ownership

Authentication establishes identity; authorization determines what that identity may do.

Every protected operation must verify:

1. The requester is authenticated when required.
2. The requester has the necessary role or permission.
3. The requester may access the specific resource.
4. The requested state transition is allowed.
5. The operation does not bypass a higher-level security rule.

For example, a user must not be able to retrieve another user’s application or document by changing an ID in the request URL.

Required checks

* Check ownership or explicit delegated access on every protected resource.
* Restrict administrative routes independently of frontend navigation.
* Apply authorization to file downloads, exports, search results, and background jobs.
* Prevent mass assignment of protected fields such as role, owner_user_id, and approval status.
* Recheck permissions when a background task performs a sensitive action.
* Use deny-by-default policies for unrecognised roles and actions.

A UUID or difficult-to-guess identifier is not an authorization mechanism.

8. Input validation and injection prevention

Treat all external input as untrusted, including:

* URL path parameters.
* Query parameters.
* JSON request bodies.
* Multipart form fields.
* Uploaded filenames and file contents.
* Webhook payloads.
* External API responses.
* User-generated content.

Validation requirements

* Validate data types and required fields.
* Enforce length, size, and range limits.
* Use allowlists for enums and sort fields.
* Normalize input consistently.
* Reject malformed identifiers and unexpected structures.
* Apply domain-specific validation to dates, fees, and workflow statuses.
* Validate third-party responses before using them in sensitive operations.

Database protection

Use parameterised queries or safe ORM methods. Never construct SQL by concatenating user-controlled strings.

HTML and DOM protection

* Encode untrusted content for the output context.
* Prefer safe DOM APIs such as textContent over inserting untrusted strings as HTML.
* Sanitize HTML when rich text is genuinely required.
* Avoid unsafe dynamic code execution.
* Do not treat client-side validation as a substitute for backend validation.

9. Cross-site scripting and browser security

Content Security Policy

Adopt a Content Security Policy appropriate to the actual site and its integrations. Begin with report-only evaluation where necessary, then enforce a policy that avoids unsafe exceptions wherever practical.

A policy should explicitly consider:

* default-src
* script-src
* style-src
* img-src
* connect-src
* font-src
* object-src
* base-uri
* form-action
* frame-ancestors

Do not copy a restrictive policy blindly if it breaks legitimate functionality. Avoid broad unsafe-inline and unsafe-eval allowances unless a documented compatibility requirement justifies them.

Other security headers

Configure suitable values for:

* X-Content-Type-Options
* Referrer-Policy
* Strict-Transport-Security for HTTPS production domains, once correctly configured
* Permissions-Policy
* frame-ancestors through CSP or an appropriate framing control

Headers should be tested against the deployed application, not just local development.

10. CORS and CSRF

CORS

For cross-origin APIs:

* Allow only trusted frontend origins.
* Restrict allowed methods and headers.
* Avoid wildcard origins when credentialed requests are enabled.
* Handle preflight requests correctly.
* Do not treat CORS as authentication or authorization.

CSRF

For cookie-authenticated state-changing requests:

* Use an appropriate CSRF defence.
* Configure cookies with suitable SameSite settings.
* Validate request origin or other defence signals where appropriate.
* Protect state-changing methods, including administrative actions.

Bearer-token APIs that do not automatically attach credentials require a different threat assessment. Document the selected design.

11. API security

All API endpoints must follow the application’s authentication and authorization requirements.

Recommended controls:

* Apply a consistent validation and error-handling layer.
* Enforce request-body and upload-size limits.
* Rate-limit sensitive endpoints.
* Restrict expensive operations.
* Use explicit CORS configuration.
* Avoid exposing stack traces and internal paths.
* Prevent unsafe redirects and untrusted URL fetching.
* Apply timeouts to outbound requests.
* Validate external service responses.
* Use idempotency for retry-sensitive operations.
* Document privileged API scopes.

Return stable, non-sensitive error codes. Do not reveal whether a private record exists when doing so would enable unauthorised discovery.

12. File upload and document security

Uploaded academic records, identity documents, and application attachments require stronger controls than public static assets.

Required controls

1. Require authentication and permission where applicable.
2. Enforce maximum file sizes and upload counts.
3. Allow only documented file types.
4. Validate content signatures instead of relying solely on file extensions.
5. Generate server-controlled storage names.
6. Reject path traversal attempts and dangerous filenames.
7. Scan files for malware where suitable scanning is available.
8. Store sensitive files outside the public web root.
9. Authorize every download request.
10. Use short-lived download URLs when appropriate.
11. Define retention, deletion, and backup policies.
12. Avoid logging file contents or unnecessary personal metadata.

Do not execute uploaded content or serve potentially active files from the same origin without appropriate controls.

A successful file upload does not mean the document is authentic or verified. Content verification must follow the separate document-review process.

13. Database security

* Use a supported database version.
* Enforce TLS for database connections where supported and required by the deployment.
* Use separate credentials for development, testing, and production.
* Grant the application account only the privileges it requires.
* Use a separate migration account when practical.
* Restrict database network access.
* Apply schema migrations through a controlled process.
* Encrypt backups and restrict access to them.
* Monitor database errors and unusual access.
* Avoid returning raw database errors to clients.

Never run destructive schema resets automatically in production startup code.

Data integrity

Use appropriate foreign keys, unique constraints, state constraints, and transactions.

Critical operations such as application status changes and payment reconciliation should not leave partially updated records when a database operation fails.

14. Payment and webhook security

If MedOrbits accepts payments:

* Use an established payment provider.
* Keep provider secret keys on the backend.
* Verify webhook signatures using the provider’s documented procedure.
* Deduplicate provider event identifiers.
* Make event handling idempotent.
* Verify the expected order, amount, currency, and payment state.
* Prevent replayed or out-of-order events from corrupting records.
* Reconcile payment state with provider records where necessary.
* Do not trust a browser redirect as proof of payment.
* Never store raw card numbers or card security codes.

Refunds and payment reversals must follow explicit server-side business rules and leave an auditable record.

15. AI and external integrations

If AI or other third-party services are enabled:

* Store credentials server-side.
* Apply timeouts and rate limits.
* Validate request and response schemas.
* Restrict data sent to providers.
* Avoid transmitting sensitive documents unless necessary and authorised.
* Review provider retention, access, and training terms.
* Apply cost controls.
* Handle provider failures safely.
* Treat returned text, URLs, and structured content as untrusted.
* Prevent external content from overriding internal security rules.

Do not let AI-generated output independently approve applications, confirm official eligibility, or verify payments.

16. Dependency and supply-chain security

Use a lockfile and install dependencies reproducibly.

Recommended checks:

npm ci
npm audit

Review the audit output and assess whether reported vulnerabilities affect the deployed code and runtime.

Do not automatically apply force upgrades to production dependencies. Review major-version changes, update deliberately, and run regression tests.

Additional safeguards:

* Remove unused dependencies.
* Pin or constrain versions appropriately.
* Review package provenance where practical.
* Keep Node.js on a supported release line.
* Restrict access to repository write permissions.
* Protect production deployment branches.
* Review changes to build scripts and installation hooks.
* Rotate secrets if repository or build-system exposure is suspected.

17. Deployment and infrastructure security

Before production deployment:

* Enforce HTTPS.
* Validate all required environment variables.
* Restrict access to deployment dashboards.
* Use strong multi-factor authentication for hosting and source-control accounts where available.
* Configure least-privilege deployment credentials.
* Limit inbound network access where practical.
* Ensure private file storage is durable and not publicly accessible.
* Verify DNS and TLS settings.
* Configure suitable health checks.
* Protect backups and logs.
* Document rollback and recovery procedures.

Do not assume a managed hosting provider automatically configures every application-level security control.

18. Logging, monitoring, and auditability

Record enough information to investigate failures and security events without collecting unnecessary personal data.

Potential events include:

* Repeated authentication failures.
* Privilege changes.
* Denied access to protected resources.
* Sensitive document access.
* Application approval or rejection.
* Payment reconciliation failures.
* Webhook verification failures.
* Configuration and deployment errors.
* Changes to official-resource verification records.

Log hygiene

Never log:

* Passwords or password-reset tokens.
* Session cookies or bearer tokens.
* Database credentials.
* Payment card security data.
* Full identity documents.
* Unnecessary academic or personal records.

Use request identifiers and structured fields where practical. Restrict log access and define retention periods.

Audit logs should be protected from unauthorised alteration. Do not rely solely on application logs for legally required audit records without confirming that they meet the applicable requirements.

19. Rate limiting and abuse prevention

Apply limits based on endpoint risk and expected usage.

High-priority endpoints include:

* Login and account registration.
* Password-reset requests.
* Verification-code delivery.
* Document uploads.
* Search endpoints with expensive queries.
* Support ticket creation.
* AI requests.
* Payment order creation.
* Public forms that could be abused for spam.

Also consider request-size limits, outbound request timeouts, concurrency controls, and per-account or per-IP quotas.

Return an appropriate 429 Too Many Requests response when limits are exceeded. Ensure rate limiting does not unintentionally block legitimate users behind shared networks.

20. Privacy and data protection

Security and privacy controls should operate together.

* Collect only necessary information.
* Restrict access to academic and identity documents.
* Define retention and deletion policies.
* Provide appropriate access and correction mechanisms.
* Avoid publishing private records in static JSON.
* Review third-party data processing.
* Evaluate child-specific requirements where applicable.
* Define breach-response and notification procedures.
* Document cross-border data handling when relevant.

See docs/PRIVACY.md for the privacy and data-protection requirements.

21. Security incident response

Maintain a documented response process for suspected credential exposure, unauthorised access, malware, data leakage, or other security incidents.

Response stages

1. Identify: Record the suspected event and available evidence.
2. Contain: Revoke compromised credentials, isolate affected systems, or disable the affected feature as appropriate.
3. Investigate: Determine the scope, affected records, timeline, and likely cause.
4. Eradicate: Remove the vulnerability or unauthorised access path.
5. Recover: Restore trusted operation and verify system integrity.
6. Notify: Meet applicable legal, contractual, and provider notification obligations.
7. Review: Record corrective actions and update controls.

Preserve evidence securely. Do not publish sensitive incident details while the incident is being contained.

Security incidents involving personal information must be assessed against the applicable notification obligations and deadlines.

22. Vulnerability reporting

Provide a monitored security-reporting channel before publishing a vulnerability disclosure policy.

Suggested placeholders:

* Security contact: [Insert verified security contact email]
* Public disclosure policy: [Insert verified disclosure-policy URL, if available]

Do not publish these placeholders as working contact details.

A reporting process should:

* Accept enough technical detail to reproduce the issue.
* Acknowledge reports within a defined operational target.
* Prioritise issues according to severity and exploitability.
* Avoid collecting unnecessary personal information from reporters.
* Coordinate remediation and disclosure responsibly.
* Track fixes and verify them before closure.

Do not promise bug bounties, response deadlines, or legal safe-harbour protections unless an approved programme actually provides them.

23. Security testing strategy

Security testing should cover:

Automated testing

* Input validation.
* Authentication and authorization.
* Ownership checks.
* API error handling.
* File upload restrictions.
* Security headers.
* Dependency vulnerabilities.
* Configuration validation.

Integration testing

* Cross-user resource access denial.
* Privilege escalation attempts.
* Session expiry and logout.
* Password-reset expiry and reuse.
* Database constraint enforcement.
* Webhook signature validation and duplicate events.
* Access to private documents.
* Rate-limit behaviour.

Release review

Before a significant release, assess:

* New endpoints and permissions.
* New data collection or storage.
* Dependency updates.
* New external integrations.
* Database schema changes.
* Deployment configuration.
* Known unresolved vulnerabilities.

Conduct penetration testing or an independent security review when justified by the sensitivity and scale of the service.

24. Security severity and remediation

Prioritise vulnerabilities using both technical severity and business impact.

Priority	Example	Response
Critical	Active unauthorised access, exposed production secrets, major data breach	Immediate containment and urgent remediation
High	Privilege escalation or exposure of sensitive user documents	Prioritised remediation and risk assessment
Medium	Exploitable issue with limited scope or meaningful prerequisites	Schedule and verify a timely fix
Low	Limited-impact weakness with no practical exploit path identified	Address through normal maintenance

These categories are operational guidance, not a substitute for a formal severity-scoring method. Reassess priority when exploitability or impact changes.

25. Developer security checklist

Before merging

* [ ]	No secrets or credentials are committed.
* [ ]	Input validation exists on the server.
* [ ]	Database operations are safe from injection.
* [ ]	Authorization checks cover every protected resource.
* [ ]	Error messages do not expose internal details.
* [ ]	Logs redact credentials and sensitive information.
* [ ]	New dependencies have been reviewed.
* [ ]	Relevant automated tests pass.

Before deployment

* [ ]	Production secrets are configured securely.
* [ ]	Authentication and session settings are reviewed.
* [ ]	CORS and CSRF controls match the architecture.
* [ ]	HTTPS and security headers are configured.
* [ ]	Database permissions and migrations are reviewed.
* [ ]	File storage and access controls are verified.
* [ ]	Rate limits and request-size limits are active.
* [ ]	Monitoring and incident contacts are configured.
* [ ]	Backups and recovery procedures are available.
* [ ]	Critical workflows have passed security tests.

26. Security ownership and maintenance

The project owner or designated maintainer should ensure that:

* Security-sensitive changes receive appropriate review.
* Production access is periodically reviewed.
* Dependencies and runtime versions remain supported.
* Vulnerabilities are triaged and tracked.
* Incident-response procedures remain usable.
* Privacy and data-verification policies remain aligned with implementation.
* Documentation is updated when security architecture changes.

Document exceptions to this policy, including the affected system, reason, risk, compensating controls, responsible approver, and review date.

27. Related documentation

* docs/ARCHITECTURE.md — application components and data flows.
* docs/API_REFERENCE.md — API contracts and access conventions.
* docs/DATABASE_SCHEMA.md — proposed database entities and constraints.
* docs/DEPLOYMENT.md — deployment and operational requirements.
* docs/PRIVACY.md — personal-data processing and privacy requirements.
* docs/DATA_VERIFICATION.md — source integrity and verification controls.
* README.md — setup and development instructions.

Verify referenced paths against the actual repository.

⸻

Security policy statement

MedOrbits should protect accounts, applications, documents, infrastructure, and personal information through layered security controls, least-privilege access, validated data handling, secure deployment, and a documented incident-response process.

This document defines intended requirements. Security controls must be tested in the actual implementation before being described as active, certified, or compliant.

End of document.