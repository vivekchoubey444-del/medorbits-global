MedOrbits Admin Panel

Directory: admin/
Page directory: admin/main/
Module: Administrative management for the MedOrbits education, careers, applications, payments, and support platform.

1. Overview

The MedOrbits Admin Panel provides an administrative interface for authorized personnel to manage platform users, roles, applications, educational institutions, courses, job listings, documents, payments, subscriptions, support requests, audit logs, and settings.

All administrative operations must be backed by authenticated APIs with server-side authorization. Hiding an action in the frontend is not an authorization control.

This README documents intended page responsibilities and integration requirements. The presence of an HTML file does not confirm that its API, database operations, payment integration, or security controls have been implemented.

2. Directory Structure

The screenshots show the administrative HTML files inside admin/main/.

admin/
├── README.md
└── main/
    ├── README.md
    ├── applications.html
    ├── audit-logs.html
    ├── colleges.html
    ├── courses.html
    ├── dashboard.html
    ├── documents.html
    ├── index.html
    ├── jobs.html
    ├── login.html
    ├── payments.html
    ├── roles.html
    ├── settings.html
    ├── subscription.html
    ├── support.html
    └── users.html

Filename note: The screenshot shows subscription.html in the singular. Keep that filename consistent in links and documentation unless you intentionally rename the file to subscriptions.html.

3. Page Responsibilities

File	Intended responsibility
index.html	Administrative entry point that directs authorized users to the dashboard or unauthenticated users to login.
login.html	Administrator sign-in, input validation, and session initiation through the configured authentication service.
dashboard.html	Display operational metrics, pending actions, and recent administrative activity.
users.html	Search, inspect, and manage user accounts according to assigned permissions.
roles.html	Manage roles and permission assignments, subject to strict authorization rules.
applications.html	Review education and service applications, update permitted statuses, and manage follow-up actions.
courses.html	Manage course records, descriptions, eligibility information, and publication status.
colleges.html	Manage college and institution records, details, and publication status.
jobs.html	Manage job listings, employer information where supported, and listing visibility.
documents.html	Review document metadata and verification workflows while protecting uploaded files.
payments.html	Review payment records, transaction status, receipts, and reconciliation information.
subscription.html	Manage supported subscription plans, user subscriptions, renewal status, and cancellation workflows.
support.html	Review support requests, assign ownership, and manage ticket status and responses.
audit-logs.html	Search and review security-relevant administrative actions and recorded changes.
settings.html	Manage platform settings and administrative configuration permitted to the current user.

4. Recommended Navigation

Use a consistent sidebar or responsive navigation menu across authenticated administrative pages.

1. Dashboard
2. Users and Roles
3. Applications
4. Education — Courses and Colleges
5. Careers — Jobs
6. Documents
7. Payments and Subscriptions
8. Support
9. Audit Logs
10. Settings

Keep login.html outside the authenticated navigation. Use index.html as an entry point rather than duplicating dashboard logic.

Navigation items and actions must reflect the signed-in administrator’s actual permissions.

5. Shared UI and Design Standards

* Follow the established MedOrbits design system and shared frontend conventions.
* Reuse shared CSS, JavaScript, components, and utilities where appropriate.
* Use a consistent page shell, sidebar, top navigation, breadcrumbs, headings, data tables, filters, pagination, and status indicators.
* Provide confirmation dialogs for destructive or sensitive operations.
* Support desktop, tablet, and mobile layouts.
* Include loading, success, empty, and error states for data-driven components.
* Use semantic HTML, accessible labels, keyboard-operable controls, and visible focus indicators.
* Avoid exposing secrets, private configuration, access tokens, or sensitive user data in browser source or logs.

6. Authentication and Authorization

Before production release, verify that:

* All protected administrative pages require an authenticated administrator session.
* Every administrative API endpoint independently enforces authorization.
* Permissions follow the principle of least privilege.
* Sensitive capabilities are separated where appropriate, including role management, document verification, payments, settings changes, and audit-log access.
* Authorization is checked on every read and write request.
* Session expiration and logout are handled correctly.
* Cookie-based sessions use appropriate Secure, HttpOnly, and SameSite settings.
* CSRF protection is applied where relevant.
* Login attempts and sensitive operations are appropriately rate-limited.
* Error messages do not expose secrets, internal stack traces, or unnecessary personal information.

Never trust role names, user IDs, payment statuses, or document-verification claims supplied by the browser.

7. Data Management and Privacy

Users and roles

* Display only personal information required for the administrative task.
* Prevent unauthorized privilege escalation.
* Record privileged role and permission changes.
* Require appropriate authorization for suspensions, account changes, and other sensitive operations.

Applications, courses, and colleges

* Validate application status transitions on the server.
* Preserve application history where required.
* Validate course and institution records before publishing them.
* Prevent unauthorized changes to application ownership or review decisions.

Jobs

* Validate listing content and permitted publication states.
* Restrict employer and job management actions according to the administrator’s permissions.
* Avoid exposing private employer or applicant information unnecessarily.

Documents

* Validate file type, size, content, and ownership.
* Keep private documents outside publicly browsable directories.
* Authorize every preview and download.
* Record document review decisions where required.
* Avoid placing sensitive document contents in audit logs.

Payments and subscriptions

* Treat backend and payment-provider verification as authoritative.
* Do not rely on browser-submitted success states.
* Keep provider credentials on the server.
* Protect payment references and transaction metadata.
* Maintain an auditable history of supported payment and subscription state changes.

Audit logs

* Generate audit events on the server.
* Record relevant actors, actions, targets, timestamps, and outcomes.
* Restrict audit-log access.
* Prevent ordinary administrative users from modifying or deleting security-relevant history.
* Define retention and access policies.

8. Backend and API Integration

Connect the frontend through the project’s established API client and configuration. Confirm actual route names, request formats, response schemas, authentication requirements, and permission rules before integrating each page.

Expected API resource groups may include:

* Authentication and sessions
* Users and roles
* Applications
* Courses and colleges
* Jobs and employers
* Documents
* Payments
* Subscription plans and subscriptions
* Support tickets
* Audit logs
* Platform settings

These are logical resource groups, not confirmation that corresponding backend routes exist.

For each integration, document:

1. The implemented endpoint and HTTP method.
2. The required authentication and permission.
3. The request and response schema.
4. Input validation and permitted state transitions.
5. Error handling and retry behavior.
6. Audit requirements for sensitive operations.

9. Suggested Implementation Order

1. login.html and protected-page access handling.
2. index.html and dashboard.html.
3. Shared navigation, tables, filters, pagination, and status components.
4. users.html and roles.html.
5. applications.html, courses.html, colleges.html, and jobs.html.
6. documents.html, payments.html, and subscription.html.
7. support.html, audit-logs.html, and settings.html.

Prioritize authorization and backend correctness before expanding administrative functionality.

10. Testing Checklist

* [ ]	Unauthenticated users cannot access protected administrative data or actions.
* [ ]	Administrators cannot perform operations beyond their assigned permissions.
* [ ]	Users cannot escalate their own privileges.
* [ ]	Search, filtering, pagination, and empty states behave correctly.
* [ ]	Forms validate input and show actionable errors.
* [ ]	Destructive operations require confirmation where appropriate.
* [ ]	Sensitive operations create the required audit events.
* [ ]	Document access is authorized and private files are not publicly exposed.
* [ ]	Payment and subscription statuses are verified by trusted backend logic.
* [ ]	Application and document status transitions follow business rules.
* [ ]	API failures do not expose secrets or internal implementation details.
* [ ]	Keyboard navigation, focus visibility, and responsive layouts are verified.
* [ ]	The actual deployment paths resolve all page links, stylesheets, scripts, and API requests.

11. Maintenance

When adding or changing an administrative page:

1. Update the directory structure and page responsibility table.
2. Document the implemented API routes and permission requirements.
3. Update navigation and route references.
4. Review access control and personal-data exposure.
5. Add or update automated tests.
6. Verify audit coverage for privileged actions.
7. Test the page in the actual deployment environment.
8. Update this README to reflect the implemented behavior.

Important Notes

* The actual HTML, backend routes, database schema, and deployment configuration determine implemented functionality.
* Do not treat documented expectations as proof that an API or security control exists.
* Keep subscription.html consistent across the filesystem, navigation, and documentation.
* Enforce critical administrative policies on the server and in CI, not only in the browser.

Ownership: MedOrbits
Scope: Administrative frontend pages and backend integration expectations
Production readiness: Verify actual APIs, permissions, database operations, and deployment paths before launch.

Pages added

* search.html: admin search across applications, users, payments, courses, colleges, jobs and audit logs (?q= and ?area=). It is the target of the quick-search form on index.html, is marked noindex, and relies on authenticated admin APIs. Server-side authorization remains required.
