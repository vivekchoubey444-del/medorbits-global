MedOrbits Account Module

Directory: account/
Page directory: account/main/
Purpose: User account management, authentication, security, education applications, career services, payments, and support.

1. Overview

The MedOrbits Account Module provides the frontend pages through which users access their accounts, manage authentication and security, track applications, manage documents, review payments, and access supported education and career services.

This README documents the intended responsibilities of the pages and their integration requirements. The existence of an HTML file does not establish that its API, authentication, payment processing, email delivery, or security controls are implemented.

Verify each feature against the actual frontend code and deployed backend before production use.

2. Directory Structure

account/
├── README.md
└── main/
    ├── README.md
    ├── activity.html
    ├── applications.html
    ├── change-password.html
    ├── counselling.html
    ├── dashboard-2.html
    ├── dashboard.html
    ├── delete-account.html
    ├── documents.html
    ├── forgot-password.html
    ├── internships.html
    ├── login.html
    ├── logout.html
    ├── payments.html
    ├── README.md
    ├── resend-verification.html
    ├── reset-password.html
    ├── saved-jobs.html
    ├── security.html
    ├── settings.html
    ├── support.html
    ├── two-factor.html
    └── verify-email.html

Directory note: This structure is based on the files visible in the supplied screenshots. Confirm whether register.html, profile.html, notifications.html, and subscriptions.html exist elsewhere or need to be added. The screenshots do not establish their presence.

The two dashboard files should be reviewed to determine whether they serve distinct user journeys or represent duplicate implementations. Document their intended differences before removing or merging either page.

3. Page Responsibilities

File	Intended responsibility
activity.html	Display recorded account activity, such as sign-ins and account changes, when supported by the backend.
applications.html	View and track education, admission, or service applications belonging to the signed-in user.
change-password.html	Change the current password after the required authentication or re-authentication checks.
counselling.html	Review counselling requests, appointments, status, and related guidance.
dashboard.html	Provide an overview of account status, applications, documents, payments, and relevant notifications.
dashboard-2.html	Provide an alternate dashboard experience if intentionally supported; document its distinction from dashboard.html.
delete-account.html	Initiate a secure account-deletion request and explain its consequences.
documents.html	Manage permitted document uploads, listings, reviews, and downloads.
forgot-password.html	Request a password-reset link without disclosing whether an email address is registered.
internships.html	Browse or review internship opportunities and related user activity supported by the platform.
login.html	Authenticate users using the configured sign-in mechanism.
logout.html	Initiate logout and invalidate the applicable server-side session or authentication state.
payments.html	Display payment records, receipts, and transaction status provided by the backend.
resend-verification.html	Request another account-verification message with suitable rate limiting.
reset-password.html	Set a new password using a valid, single-use, expiring reset token.
saved-jobs.html	Display jobs saved by the authenticated user.
security.html	Present supported security controls, authentication methods, and session-management options.
settings.html	Manage supported account preferences and communication settings.
support.html	Submit support requests and review the signed-in user’s support cases.
two-factor.html	Enrol, verify, use, or manage multi-factor authentication when implemented.
verify-email.html	Verify an email address using the application’s supported verification flow.

4. Recommended User Journeys

Account access

1. The user registers through the registration page provided by the application, if available.
2. The backend creates the account and initiates email verification when required.
3. The user verifies the email address through the supported verification flow.
4. The user signs in through login.html.
5. The application redirects the user to an authorized destination, such as dashboard.html.

Password recovery

1. The user submits an email address through forgot-password.html.
2. The backend responds without revealing whether the address belongs to an account.
3. When appropriate, the backend sends a reset link.
4. The user opens reset-password.html and submits a new password with a valid token.
5. The backend invalidates the token and applies its configured session-revocation policy.

Account security

1. The user changes their password through change-password.html.
2. The user manages supported security options through security.html and two-factor.html.
3. The user reviews recorded events through activity.html.
4. The user initiates account deletion through delete-account.html, subject to the backend’s confirmation and retention rules.

Education and career services

The dashboard may link to applications.html, counselling.html, documents.html, internships.html, and saved-jobs.html.

The user may also access payments.html and support.html for the corresponding services.

Every private record must be retrieved and modified through authorized backend operations.

5. Frontend Integration Standards

Design and usability

* Follow the existing MedOrbits design system and responsive layout conventions.
* Maintain the account area’s royal midnight-blue and platinum visual direction where that theme is already implemented.
* Reuse shared stylesheets, scripts, images, and components where appropriate.
* Use consistent navigation and page titles.
* Provide visible loading, empty, success, and error states.
* Support keyboard navigation, accessible form labels, visible focus indicators, and reduced-motion preferences.
* Avoid exposing passwords, authentication tokens, payment secrets, or private document contents in browser logs or unnecessary URL parameters.

URL and navigation conventions

Use paths that match the actual deployment structure. If the account pages are hosted under /account/main/, ensure links, redirects, stylesheets, scripts, and API configuration resolve correctly.

Do not assume that every page is deployed at /account/ or at the domain root. Test navigation from the actual hosting environment.

6. Backend and API Integration

The frontend must use documented backend endpoints. Verify route names, authentication requirements, request formats, and response schemas against the implemented server.

Expected capabilities may include:

* Authentication: registration, login, logout, and current-session lookup.
* Email verification: issue and redeem verification tokens.
* Password recovery: request and redeem password-reset tokens.
* Account security: change passwords, manage multi-factor authentication, and revoke sessions.
* Profile and preferences: retrieve and update authorized user fields.
* Applications and counselling: retrieve user-owned records and supported status updates.
* Documents: upload, validate, list, and securely retrieve permitted files.
* Payments: retrieve transaction status and payment history.
* Career services: retrieve saved jobs and internship-related records.
* Support: submit and retrieve user-owned support cases.
* Activity: retrieve recorded account events.
* Account deletion: submit, confirm, and track deletion requests.

These are integration expectations, not confirmation that the corresponding routes exist.

7. Security Requirements

Before production release, verify that:

* Every private backend endpoint enforces authentication and authorization.
* Users cannot access another user’s applications, documents, payments, support cases, or activity records by changing an identifier.
* Passwords are stored using an appropriate password-hashing algorithm, never as plaintext.
* HTTPS and secure session or token handling are configured.
* Cookie-based sessions use appropriate Secure, HttpOnly, and SameSite settings.
* CSRF protection is applied where relevant.
* Login, verification, and password-recovery endpoints use suitable rate limits.
* Verification and password-reset tokens are random, short-lived, single-use, and stored safely.
* File uploads are validated for type, size, content, and ownership, and private documents are not publicly accessible.
* Payment status is confirmed server-side; client-side success messages are not treated as proof of payment.
* Sensitive changes and account deletion require suitable confirmation or re-authentication.
* Logs exclude passwords, complete authentication tokens, and unnecessary sensitive information.
* Account deletion and retention policies account for applicable legal and operational requirements.

8. Accessibility Checklist

* [ ]	Every page has a meaningful document title and primary heading.
* [ ]	Every form field has an accessible label.
* [ ]	Keyboard users can reach all interactive controls.
* [ ]	Focus indicators remain visible.
* [ ]	Validation messages explain how to correct errors.
* [ ]	Loading and empty states do not rely on color alone.
* [ ]	Sensitive actions explain their consequences.
* [ ]	Pages work on mobile screens and at increased text sizes.
* [ ]	Motion respects prefers-reduced-motion.
* [ ]	Authentication errors do not reveal whether another user’s account exists.

9. Testing Checklist

* [ ]	Test login, logout, session expiry, and unauthorized access.
* [ ]	Test invalid, expired, and reused verification tokens.
* [ ]	Test password-reset expiration and token reuse.
* [ ]	Test password-change validation and session revocation.
* [ ]	Test multi-factor authentication if implemented.
* [ ]	Confirm users cannot read or modify other users’ records.
* [ ]	Test document upload, download authorization, and invalid files.
* [ ]	Test pending, successful, failed, and refunded payment states where applicable.
* [ ]	Test duplicate payment-provider callbacks where applicable.
* [ ]	Test saved jobs, internship pages, support cases, and application lists.
* [ ]	Test pagination, empty results, API failures, and retry behavior.
* [ ]	Test mobile layouts, keyboard interaction, and reduced-motion behavior.
* [ ]	Verify all navigation links and asset paths in the deployed environment.

10. Maintenance

When adding or changing an account page:

1. Update the directory structure and page guide.
2. Document the actual backend endpoints and required authorization.
3. Add appropriate loading, empty, success, and error states.
4. Review data ownership and sensitive-data handling.
5. Test desktop and mobile layouts.
6. Update automated tests and related documentation.
7. Verify all links and assets against the deployment path.

Important Notes

* The actual HTML, JavaScript, server routes, and deployment configuration determine implemented behavior.
* Pages listed as intended responsibilities may require additional implementation or integration.
* dashboard.html and dashboard-2.html should have documented, distinct purposes if both are retained.
* Confirm the actual location of registration, profile, notification, and subscription pages before documenting them as part of this directory.
* Keep frontend navigation, backend authorization, and API behavior consistent.

Ownership: MedOrbits
Scope: Account frontend pages and backend integration expectations
Production readiness: Verify actual routes, security controls, page behavior, and deployment paths before launch.

Pages added

* application-details.html: shows one application (opened from applications.html with ?id=). It reads GET /api/applications/:id, handles sign-in required, not found and service errors, and links to documents, counselling, payments, support and contact.
