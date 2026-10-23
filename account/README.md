MedOrbits — Account Module

Brand: MedOrbits — Education · Admissions · Careers · Recruitment
Website: https://www.medorbits.in/
Module: User Accounts, Authentication, Profiles and Applicant Dashboard
File: account/README.md

Purpose

This directory organizes the proposed user account pages and frontend resources for the MedOrbits static website. It covers account registration, sign-in, identity verification, profile management, application tracking, saved resources, notifications, payment history, privacy settings and account security.

Important: This README is a planning and implementation guide, not proof that the listed pages, API endpoints or authentication workflows already exist. Integrate selectively with the existing repository. Preserve existing routes, database schemas and migration history. Do not overwrite working production files with starter templates.

1. Repository conventions

* Keep the public website entry point at /index.html.
* Store account-related HTML pages in /account/.
* Use lowercase filenames with hyphens between words.
* Use .html paths unless compatible clean-URL routing is explicitly configured.
* Reuse shared styles and scripts from /assets/css/ and /assets/js/.
* Keep authentication, authorization and session validation on the server.
* Treat all browser-submitted data as untrusted.
* Never store passwords, API secrets, session tokens or private applicant documents in public static files.
* Do not commit .env files, production credentials, private keys or real applicant records.
* Keep account functionality separate from the /admin/ module.
* Preserve existing API contracts and database migration history.

2. Account module directory

Proposed account pages:

account/
├── README.md
├── index.html
├── login.html
├── register.html
├── verify-email.html
├── verify-phone.html
├── forgot-password.html
├── reset-password.html
├── change-password.html
├── dashboard.html
├── profile.html
├── edit-profile.html
├── my-applications.html
├── application-details.html
├── saved-colleges.html
├── saved-jobs.html
├── saved-courses.html
├── my-documents.html
├── notifications.html
├── messages.html
├── payment-history.html
├── receipts.html
├── privacy-settings.html
├── security-settings.html
├── sessions.html
├── delete-account.html
└── logout.html

This is a proposed inventory. Implement only pages supported by the actual product and backend.

3. Account landing and dashboard

account/index.html

Purpose:

* Provide an account landing page.
* Display sign-in and registration options to unauthenticated visitors.
* Direct authenticated users to their dashboard.
* Explain the account features available through MedOrbits.

account/dashboard.html

Purpose:

* Show an overview of the authenticated user’s account.
* Display application progress when supported by the backend.
* Provide links to saved courses, colleges, jobs and profile settings.
* Display relevant notifications and account-security reminders.

Requirements:

* Load account information from an authenticated API.
* Display loading, empty, success and error states.
* Do not assume that a user is authenticated because a browser variable or local-storage value exists.
* Do not expose information belonging to another user.

4. Registration and authentication pages

account/register.html

Purpose:

* Collect the minimum information required to create an account.
* Explain applicable privacy terms and consent requirements.
* Provide an appropriate verification workflow.

Recommended fields, subject to actual requirements:

* Full name
* Email address and/or phone number
* Password
* Password confirmation, if used
* Required terms acknowledgement
* Optional communications consent, separately presented

Security requirements:

* Validate input on both client and server.
* Enforce server-side password policies.
* Hash passwords using an established password-hashing algorithm.
* Prevent duplicate-account and account-enumeration risks.
* Rate-limit registration and verification requests.
* Never log passwords or verification codes.

account/login.html

Purpose:

* Authenticate registered users.
* Provide access to password recovery.
* Display clear validation and authentication errors.

Requirements:

* Authenticate through the real backend.
* Use secure session cookies or an appropriately designed token-based architecture.
* Apply rate limits and abuse protections.
* Use generic error messages where detailed errors could reveal whether an account exists.
* Rotate session identifiers after authentication where applicable.

account/verify-email.html

Purpose:

* Complete email verification through a server-validated, time-limited verification flow.

Requirements:

* Use single-purpose, expiring verification tokens.
* Store token hashes server-side where applicable.
* Make verification tokens single-use.
* Avoid exposing tokens in analytics, logs or third-party referrer data.

account/verify-phone.html

Purpose:

* Complete phone verification using a supported verification provider or backend service.

Requirements:

* Apply expiry limits and attempt limits to verification codes.
* Rate-limit code requests and verification attempts.
* Never publish provider credentials in frontend JavaScript.

account/forgot-password.html

Purpose:

* Request a password-reset email or other supported recovery method.

Requirements:

* Return an appropriate generic response.
* Apply rate limits.
* Do not disclose whether an email address or phone number is registered.

account/reset-password.html

Purpose:

* Allow a user to set a new password using a valid reset request.

Requirements:

* Validate the reset token on the server.
* Enforce token expiry and single-use behavior.
* Invalidate relevant existing sessions after a successful reset according to the security policy.
* Do not place passwords or reusable secrets in URLs.

account/change-password.html

Purpose:

* Allow authenticated users to change their passwords.

Requirements:

* Verify the current password where appropriate.
* Apply server-side password policy.
* Protect the request against CSRF when cookie-based sessions are used.
* Notify the user about successful changes.

account/logout.html

Purpose:

* End the authenticated session.

Requirements:

* Revoke or invalidate the server-side session or applicable refresh token.
* Use the correct HTTP method for state-changing logout operations.
* Clear session cookies using appropriate cookie attributes.
* Do not rely on redirecting to a static page as proof that the session has been invalidated.

5. Profile management

account/profile.html

Purpose:

* Display the authenticated user’s profile.

account/edit-profile.html

Purpose:

* Allow permitted profile fields to be updated.

Recommended fields, depending on product requirements:

* Full name
* Email and phone verification status
* City and state
* Educational background
* Professional information
* Preferred education or career categories

Requirements:

* Collect only information necessary for the stated service.
* Apply server-side validation and field-level authorization.
* Do not allow users to modify administrative roles, verification flags or other privileged fields.
* Require a separate verification process when changing a verified email address or phone number.
* Avoid collecting sensitive identity documents unless genuinely required.

6. Applications and application tracking

account/my-applications.html

Purpose:

* List applications associated with the authenticated user.
* Display available reference numbers, submission dates and current statuses.

account/application-details.html

Purpose:

* Display authorized details for a selected application.
* Show relevant progress updates, required actions and support information.

Requirements:

* Enforce ownership checks on every API request.
* Verify authorization server-side for each application identifier.
* Prevent insecure direct object reference (IDOR) vulnerabilities.
* Do not expose internal reviewer notes or administrative-only data.
* Distinguish between a saved draft, submitted application and confirmed submission.
* Never claim that an application has been officially accepted or approved without a verified status from the responsible system.

7. Saved resources

account/saved-colleges.html

Purpose:

* List colleges saved by the authenticated user.

account/saved-jobs.html

Purpose:

* List saved job opportunities.

account/saved-courses.html

Purpose:

* List saved courses and educational resources.

Requirements:

* Store saved-resource associations through the actual backend when persistence is required.
* Validate referenced resources before saving.
* Provide empty states when no resources have been saved.
* Do not present expired or withdrawn opportunities as active.
* Use verified source information for institutional and course details.

8. Document management

account/my-documents.html

Purpose:

* Display document metadata and permitted document actions for the authenticated user.

Security requirements:

* Store private documents outside the public static website directory.
* Use private object storage or another appropriately secured storage system.
* Require server-side authorization before upload, download, preview, replacement or deletion.
* Validate file type, size and file signature on the server.
* Use generated storage identifiers instead of trusting user-supplied filenames.
* Apply malware scanning where appropriate.
* Prevent executable content from being served as trusted application content.
* Use short-lived authorized download links when appropriate.
* Define document retention and deletion policies.
* Never expose private document URLs through public JSON files or unrestricted directory listings.

A frontend upload form alone does not provide secure document storage.

9. Notifications and messages

account/notifications.html

Purpose:

* Display account notifications and application-related updates.

account/messages.html

Purpose:

* Display authorized communications supported by the service.

Requirements:

* Retrieve notifications and messages through authenticated endpoints.
* Enforce user ownership for message and notification records.
* Sanitize untrusted message content before rendering.
* Avoid exposing private content in browser console logs or analytics.
* Provide controls for read status and notification preferences where supported.
* Do not fabricate messages, delivery confirmations or application updates.

10. Payment history and receipts

account/payment-history.html

Purpose:

* Display authorized payment records associated with the user’s account.

account/receipts.html

Purpose:

* Display or provide access to receipts generated by the actual payment or invoicing system.

Requirements:

* Retrieve payment status from a trusted backend.
* Verify payment notifications through the payment provider’s supported server-side verification mechanism.
* Do not trust browser redirects or client-submitted payment status.
* Never store card security codes or other prohibited payment credentials.
* Restrict access to receipts and payment records to authorized users.
* Clearly distinguish service fees, taxes, refunds and pending transactions where applicable.
* Do not imply that paying a service fee guarantees admission, a college allotment, employment, visa approval or another outcome.
* Publish refund terms consistent with the actual service and applicable law.

11. Privacy and security settings

account/privacy-settings.html

Purpose:

* Provide available privacy and communication preferences.

Possible controls:

* Optional communications preferences
* Consent history where supported
* Account-data request instructions
* Privacy notice links
* Account deletion request

account/security-settings.html

Purpose:

* Provide account-security controls supported by the backend.

Possible controls:

* Password change
* Email or phone verification status
* Multi-factor authentication, if implemented
* Recent security events, where appropriate
* Session management
* Security notifications

account/sessions.html

Purpose:

* Display active sessions or authorized devices where supported.
* Allow users to revoke sessions.

Requirements:

* Validate session ownership server-side.
* Revoke sessions on the backend.
* Avoid exposing raw session identifiers or reusable authentication tokens.
* Require reauthentication for sensitive security actions when appropriate.

account/delete-account.html

Purpose:

* Let users request account deletion under the applicable retention and legal requirements.

Requirements:

* Clearly explain the consequences before confirmation.
* Reauthenticate the user when appropriate.
* Process deletion or deactivation through the backend.
* Revoke sessions and applicable credentials.
* Apply documented retention requirements to records that must legally or operationally be retained.
* Explain any applicable retention exceptions.
* Do not claim that all data has been permanently erased until the actual deletion workflow confirms it.

12. Shared frontend resources

Reuse the shared repository assets where practical.

assets/
├── css/
│   ├── styles.css
│   ├── responsive.css
│   ├── forms.css
│   ├── accessibility.css
│   └── theme.css
├── js/
│   ├── main.js
│   ├── navigation.js
│   ├── forms.js
│   ├── validation.js
│   └── account.js
└── data/

The paths above refer to repository-root assets, not copies that must be created inside /account/.

Use relative asset paths carefully. For example, a page at /account/login.html can reference a root asset with:

<link rel=“stylesheet” href=“/assets/css/styles.css”>
<script src=“/assets/js/account.js” defer></script>

Root-relative paths work when the website is deployed at the domain root. Confirm routing and hosting configuration before using them in other deployment environments.

Do not put passwords, authentication tokens, private account records or secrets in public JSON files.

13. Proposed API integration

The following endpoint patterns are illustrative only. They must not be treated as existing or functional routes until confirmed in the repository and backend.

Method	Example route	Purpose
POST	/api/v1/auth/register	Create an account
POST	/api/v1/auth/login	Authenticate a user
POST	/api/v1/auth/logout	End a session
POST	/api/v1/auth/verify-email	Verify an email address
POST	/api/v1/auth/verify-phone	Verify a phone number
POST	/api/v1/auth/forgot-password	Request account recovery
POST	/api/v1/auth/reset-password	Complete password recovery
GET	/api/v1/account/profile	Retrieve the current user’s profile
PATCH	/api/v1/account/profile	Update permitted profile fields
GET	/api/v1/account/applications	List the current user’s applications
GET	/api/v1/account/applications/:id	Retrieve an authorized application
GET	/api/v1/account/documents	List authorized document metadata
GET	/api/v1/account/notifications	Retrieve notifications
GET	/api/v1/account/payments	Retrieve authorized payment history
POST	/api/v1/account/delete-request	Submit an account deletion request

Before implementing any example route:

1. Inspect the existing API structure and route conventions.
2. Reuse existing authentication and authorization middleware.
3. Preserve established response formats and API versioning.
4. Validate request schemas and reject unexpected privileged fields.
5. Apply appropriate rate limits and audit controls.
6. Add tests for authentication, authorization, ownership and error handling.
7. Document any new route and its request/response contract.

Do not create duplicate routes or database tables when an equivalent implementation already exists.

14. Database and data ownership

Account data should use the existing database architecture and migrations where available.

Potential data entities include:

* Users
* Verified contact methods
* Sessions or refresh-token records
* Password-reset and verification-token records
* User profile information
* Saved resources
* Application ownership associations
* Notification records
* Document metadata
* Payment references
* Consent records
* Security and audit events

These are conceptual entities, not a requirement to create new tables. Inspect the existing schema before proposing changes.

Database requirements:

* Use primary keys and appropriate foreign-key constraints.
* Enforce unique constraints for identifiers that must be unique.
* Use transactions for multi-step operations that must remain consistent.
* Apply least-privilege database permissions.
* Avoid storing plaintext passwords, reset tokens or verification codes.
* Do not log passwords, secrets or unnecessary personal information.
* Keep schema changes in new, sequentially numbered migrations.
* Preserve the repository’s existing migration history; never restart or renumber migrations to fit this guide.

15. Authentication and application security

The account module must not rely on frontend-only security.

Minimum controls:

* Server-side authentication and authorization
* Secure password hashing
* Session expiry and revocation
* HTTPS in production
* Secure cookie attributes where cookie sessions are used
* CSRF protection for applicable cookie-authenticated state-changing requests
* Appropriate CORS policy
* Rate limiting for login, registration and recovery endpoints
* Input validation and output encoding
* Protection against SQL injection and cross-site scripting
* Ownership checks for user-specific records
* Secure file-upload and download handling
* Secret management outside the public repository
* Security event logging with appropriate data minimization
* Dependency updates and security testing

Use established, maintained libraries rather than implementing cryptographic or authentication protocols from scratch.

16. Accessibility and responsive design

Account pages should:

* Work on phones, tablets and desktop screens.
* Use semantic HTML and correctly associated form labels.
* Support keyboard navigation.
* Provide visible focus indicators.
* Present validation errors in a clear, accessible way.
* Use sufficient text and interface contrast.
* Avoid relying on color alone to communicate status.
* Include appropriate accessible names for controls.
* Preserve entered form data when safe and practical after recoverable errors.
* Avoid exposing sensitive values in browser storage or error messages.

17. Testing checklist

Before production deployment, test the following:

Functional tests

* Registration and login
* Contact verification
* Password recovery and reset
* Profile viewing and editing
* Application list and details
* Saved resources
* Document access
* Notifications
* Payment history and receipts
* Session revocation
* Account deletion requests

Security tests

* Unauthenticated access to protected endpoints
* Cross-user access to applications and documents
* IDOR and privilege escalation
* Mass assignment of privileged fields
* Session fixation and session invalidation
* Brute-force and recovery abuse
* CSRF and XSS risks where applicable
* File upload validation
* Unauthorized receipt and payment access
* Sensitive information in logs and API responses

Operational tests

* Mobile and desktop layouts
* Broken internal links
* Missing assets
* API failures and timeouts
* Empty states and loading states
* Production HTTPS and cookie configuration
* Backup and recovery procedures
* Monitoring without unnecessary personal-data collection

Use the repository’s existing test framework and directory structure, including tests/unit/, tests/integration/ and tests/security/ where applicable.

18. Suggested implementation order

1. Inspect the existing repository and document current account routes.
2. Confirm the authentication architecture and API contracts.
3. Implement registration, login, logout and recovery through the backend.
4. Implement the account dashboard and profile.
5. Add application tracking with server-side ownership checks.
6. Add saved resources and notifications.
7. Implement private document storage only when secure backend support is available.
8. Add payment history and receipts only after trusted payment verification is implemented.
9. Add session management, privacy controls and account deletion workflows.
10. Run functional, integration, accessibility and security tests.
11. Verify production configuration and deployment behavior.

19. Deployment and URL notes

When deployed at the website root, a file at:

/account/login.html

normally maps to:

https://www.medorbits.in/account/login.html

A clean URL such as /account/login requires compatible hosting configuration, routing or redirect rules.

Before deployment:

* Confirm filenames and capitalization match internal links.
* Ensure private account pages do not expose sensitive information through static content.
* Configure protected APIs and server-side access controls.
* Keep secrets out of frontend bundles and public environment variables.
* Verify error handling and production logging.
* Do not assume that placing a page in /account/ automatically protects it from public access.

Static HTML pages can provide the interface, but protected account data and account-changing operations require a properly secured backend.

20. Privacy and service disclaimer

MedOrbits account features should collect and process personal information only for documented, legitimate purposes and in accordance with the applicable privacy notice and legal requirements.

Users should receive clear information about what data is collected, why it is required, how it is used, how long it is retained and how they can exercise applicable rights.

Account access, application tracking, document storage and payment records must be implemented with appropriate confidentiality and access controls.

MedOrbits must not claim affiliation with or endorsement by a government authority, regulator, college, university, employer or payment provider without verifiable authorization.

An account, application submission, document upload or service payment must not be represented as a guarantee of admission, seat allotment, employment, visa approval or any other outcome.

⸻

Maintenance note: Update this README when account routes, API contracts, authentication controls or supported features change. Verify every listed feature against the actual implementation before describing it as available in production.