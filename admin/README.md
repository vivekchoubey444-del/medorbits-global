MedOrbits Administration Portal

Directory: /admin/
Project: MedOrbits
Purpose: Centralised administration of education, admissions, student services, documents, employers, recruitment, platform security and reporting.

⸻

1. Overview

The MedOrbits administration portal provides authorised administrators with a central workspace for managing platform operations.

The interface follows the MedOrbits premium dark design system, using midnight navy, sapphire blue, champagne gold, subtle gradients, responsive layouts and image-led content sections.

The administration portal must integrate with authenticated backend APIs. All operational data, dashboard statistics, records and status information must reflect actual server responses rather than fabricated demonstration data.

Core principles

* Authentication and role-based access control.
* Responsive layouts for desktop, tablet and mobile.
* Consistent styling and navigation across administration pages.
* Server-side validation and authorisation for protected operations.
* Safe handling of student, employer, applicant and employee information.
* Auditable administrative actions.
* Accessible forms, tables, dialogs and navigation.
* No exposure of passwords, API secrets, private file paths or access tokens.
* Clear error, loading, empty and success states.

⸻

2. Directory structure

The following is the intended administration page structure. Create individual pages as the corresponding modules are implemented.

admin/
├── README.md
├── index.html
├── login.html
├── profile.html
├── settings.html
│
├── users.html
├── roles.html
├── access-control.html
│
├── applications.html
├── admissions.html
├── counselling.html
│
├── documents.html
├── document-review.html
├── official-resources.html
│
├── courses.html
├── colleges.html
├── universities.html
│
├── employers.html
├── jobs.html
├── recruitment.html
├── candidates.html
├── interviews.html
│
├── payments.html
├── transactions.html
│
├── reports.html
├── analytics.html
├── audit-log.html
│
├── security.html
├── backup-status.html
├── notifications.html
├── support-tickets.html
└── system-health.html

Implementation note: This tree describes the intended module layout, not a guarantee that every file already exists. Keep navigation links aligned with the actual deployed routes.

⸻

3. Module responsibilities

Module	Responsibility
index.html	Administrative overview, operational summaries and authorised shortcuts.
users.html	User records, account status and permitted account administration.
roles.html	Role definitions and permission assignments, where supported.
access-control.html	Access policies and administrative permissions.
applications.html	Application records, status tracking and application references.
admissions.html	Admission workflows and related administrative records.
counselling.html	Counselling records and associated workflow information.
documents.html	Document centre and submission metadata.
document-review.html	Document review queue, verification metadata and follow-up status.
official-resources.html	Official resource links, references and resource metadata.
courses.html	Course catalogue administration.
colleges.html	College records and institutional metadata.
universities.html	University records and institutional metadata.
employers.html	Employer profiles, organisation records and employer verification status.
jobs.html	Job listings, vacancy records and job publication status.
recruitment.html	Recruitment workflows and employer–candidate coordination.
candidates.html	Candidate profiles and recruitment-related records.
interviews.html	Interview schedules and interview workflow records.
payments.html	Payment status and payment-related administrative metadata.
transactions.html	Transaction references and reconciliation information.
reports.html	Operational and administrative reports.
analytics.html	Aggregated metrics returned by authorised reporting services.
audit-log.html	Recorded administrative and security events.
security.html	Security monitoring and relevant configuration status.
backup-status.html	Backup status reported by the configured backup service.
notifications.html	Notification records and delivery status.
support-tickets.html	Support requests, ownership and resolution status.
system-health.html	API, service and infrastructure health information.
profile.html	Current administrator profile, limited to permitted fields.
settings.html	Supported administrative preferences and system settings.

⸻

4. Employer and recruitment administration

The employer module supports authorised management of organisations using MedOrbits for recruitment and career opportunities.

employers.html

The employer administration page should support:

* Employer directory and search.
* Organisation name and unique employer reference.
* Industry or organisation category.
* Employer contact information, subject to role permissions.
* Verification status and verification timestamps.
* Account status, such as active, inactive, pending or suspended.
* Employer-created job listing counts when returned by the API.
* Registration and last-updated timestamps.
* Employer record inspection.
* Pagination, sorting and filtering.
* Export of approved metadata, if permitted by organisational policy.
* Links to related jobs and recruitment workflows.

Do not display confidential verification documents, private contact details or internal risk assessments to users who do not have explicit permission to access them.

jobs.html

The job administration page should support the authorised review of:

* Job title and job reference.
* Employer reference.
* Employment type and work arrangement.
* Location and eligibility requirements.
* Description and application instructions.
* Publication status.
* Application deadline.
* Creation and modification timestamps.
* Job approval or publication workflow, when implemented by the backend.

recruitment.html

The recruitment module should coordinate relevant recruitment operations, including:

* Employer and vacancy references.
* Recruitment stage and assignment.
* Candidate application references.
* Interview and follow-up status.
* Communication history, where authorised.
* Workflow ownership and audit events.

Suggested employer status model

Use the backend’s established status values. A possible model is:

* pending_verification
* verified
* rejected
* active
* inactive
* suspended

These are suggested values only. Do not impose a new status vocabulary on an existing database or API without updating the backend contract and migration plan.

⸻

5. Shared design system

Administration pages should use the existing global stylesheet:

<link rel=“stylesheet” href=“/assets/css/style.css”>

Use page-specific CSS only for layouts or components that cannot be provided by the shared stylesheet.

Visual conventions

* Midnight navy and deep blue surfaces.
* Sapphire-blue interactive elements.
* Champagne-gold accents for premium emphasis.
* Soft gradients and subtle ambient backgrounds.
* DM Sans for interface text.
* Playfair Display for editorial headings.
* Rounded cards and restrained borders.
* High-contrast labels and readable muted text.
* Responsive tables with horizontal scrolling when required.
* Reduced-motion support.
* Visible keyboard-focus indicators.

Avoid

* Unstyled default browser forms.
* Inconsistent spacing between administration modules.
* Low-contrast text.
* Fixed-width layouts that overflow on mobile.
* Unnecessary animations or excessive decorative effects.
* Exposing private information in dashboard cards or tables.
* Treating visual status badges as proof of backend verification.

Recommended shared resources

assets/
├── css/
│   └── style.css
├── js/
│   ├── config.js
│   ├── utils.js
│   ├── security.js
│   ├── app.js
│   └── main.js
└── images/
    └── logo/
        └── medorbits-logo.png

Use existing project resources where available. Do not create duplicate shared assets solely to satisfy this example structure.

⸻

6. Standard page structure

Administration pages should use a consistent document outline:

1. Document metadata and shared styles.
2. Skip link for keyboard navigation.
3. Administration announcement or workspace banner.
4. Sticky header and responsive main navigation.
5. Breadcrumb navigation.
6. Page heading and primary actions.
7. Administration sidebar.
8. Main content panels.
9. API connection and record status.
10. Search, filters and data table where applicable.
11. Supporting guidance and security notice.
12. Shared footer.
13. Page-specific JavaScript.
14. Shared JavaScript modules.

Navigation conventions

Use absolute root-relative URLs for internal pages:

<a href=“/admin/index.html”>Dashboard</a>
<a href=“/admin/employers.html”>Employers</a>
<a href=“/admin/jobs.html”>Jobs</a>
<a href=“/admin/recruitment.html”>Recruitment</a>
<a href=“/admin/audit-log.html”>Audit log</a>

Mark the current page using aria-current=“page” and an appropriate active navigation class.

Before deployment, verify that each linked route exists and that its backend permissions are correctly configured.

⸻

7. API integration

The frontend should consume the project’s actual API contracts rather than assume a particular route or response structure.

An employer endpoint might be configured as:

window.MEDORBITS_CONFIG = {
  adminEmployersEndpoint: “/api/admin/employers”
};

This is an example configuration. Use the real endpoint defined by the backend.

Example request

const response = await fetch(
  window.MEDORBITS_CONFIG?.adminEmployersEndpoint ||
    “/api/admin/employers”,
  {
    method: “GET”,
    credentials: “same-origin”,
    cache: “no-store”,
    headers: {
      Accept: “application/json”
    }
  }
);
if (response.status === 401) {
  throw new Error(“Authentication required.”);
}
if (response.status === 403) {
  throw new Error(“You do not have permission to view employer records.”);
}
if (!response.ok) {
  throw new Error(“Unable to retrieve employer records.”);
}
const payload = await response.json();

Adapt the error handling, request headers, pagination parameters and response parsing to the actual server implementation. If the backend requires CSRF protection, use the project’s established CSRF mechanism for state-changing requests.

Response conventions

Where practical, standardise list responses using a documented contract such as:

{
  “employers”: [],
  “meta”: {
    “total”: 0,
    “page”: 1,
    “pageSize”: 20,
    “totalPages”: 0
  }
}

The empty arrays and zero values above illustrate the response shape; they are not live employer statistics.

If the existing API uses items, records, results, a nested data property or another structure, preserve that contract or introduce a versioned migration.

Integration requirements

* Confirm the endpoint and HTTP method with the backend.
* Handle 401, 403, 404, 409, 422, 429 and server errors appropriately.
* Use server-side pagination for large datasets.
* Perform authorisation on every protected request.
* Validate filters and sorting parameters on the server.
* Avoid logging request bodies containing sensitive information.
* Do not assume that hiding a button enforces permission.
* Do not display fake records when an API request fails.
* Distinguish zero results from a failed request.
* Show whether displayed totals represent loaded records or the full dataset.
* Avoid caching sensitive administration responses in shared caches.

⸻

8. Security requirements

The administration frontend is not a security boundary. Enforce the following controls on the backend and infrastructure.

Authentication and authorisation

* Require authentication for all protected administration routes.
* Enforce role-based access control on every sensitive API endpoint.
* Apply least-privilege permissions to document, employer, job, payment and user records.
* Revalidate permissions for sensitive actions.
* Protect sessions and implement appropriate expiration and revocation.
* Use CSRF protections for cookie-authenticated state-changing requests.

Input and output handling

* Validate and normalise all server inputs.
* Use parameterised database queries.
* Encode user-controlled output.
* Avoid inserting API data into innerHTML.
* Prefer textContent and safe DOM creation.
* Validate uploaded files, MIME types and sizes.
* Use appropriate upload scanning and secure storage.
* Prevent CSV formula injection in exports.
* Validate redirect targets and any URLs returned by the backend.

Sensitive information

* Never place credentials, API secrets or private keys in browser JavaScript.
* Do not expose password hashes, session tokens or access tokens.
* Do not reveal private document-storage URLs.
* Avoid unnecessarily exposing personal contact information.
* Restrict sensitive exports and record access.
* Use encryption in transit and appropriate encryption at rest.
* Apply approved retention and deletion policies.
* Keep audit logs protected from unauthorised modification.

Employer-specific safeguards

* Verify employer ownership and organisation permissions server-side.
* Restrict access to private employer verification records.
* Prevent unauthorised changes to employer verification status.
* Audit account activation, suspension and verification decisions.
* Validate job ownership before allowing employer-specific updates.
* Restrict candidate information to authorised recruitment personnel.

⸻

9. Data tables, filtering and pagination

Pages that manage records should provide consistent table behaviour.

Recommended table features

* Search by approved record identifiers and relevant metadata.
* Filters for documented status and category values.
* Sorting by supported fields.
* Pagination with clear current-page information.
* Empty-state messages when no records match.
* Loading indicators during requests.
* Error messages when requests fail.
* Keyboard-accessible row actions.
* Responsive horizontal scrolling on narrow screens.

Pagination

For large datasets, use server-side pagination. Client-side pagination should be limited to records already loaded and should not be presented as the complete database unless the API confirms complete coverage.

Keep the pagination metadata consistent with the response returned by the backend.

Export

Only provide export features when authorised and required.

* Export only necessary fields.
* Apply permission checks on the server when generating sensitive exports.
* Defend against spreadsheet formula injection.
* Avoid including credentials, signed file URLs or private file paths.
* Audit sensitive bulk exports.
* Use appropriate retention and access controls for generated files.

⸻

10. Administrative audit trail

Sensitive actions should generate server-side audit events.

Examples include:

* Employer verification decisions.
* Employer activation or suspension.
* Job publication or withdrawal.
* Changes to access roles and permissions.
* Document review decisions.
* Application status changes.
* Sensitive record exports.
* Changes to platform settings.

Where appropriate, an audit event should include:

* Event identifier.
* Timestamp.
* Authenticated actor identifier.
* Action and target record reference.
* Outcome.
* Reason or change summary, where applicable.
* Request correlation identifier.

Do not store passwords, session tokens, authentication headers or unnecessary personal information in audit logs.

Use the existing audit-service implementation if the project already provides one. Do not assume that opening an administrative page automatically records an audit event.

⸻

11. Shared JavaScript conventions

Use the shared JavaScript resources consistently.

File	Intended responsibility
/assets/js/config.js	Shared runtime configuration and API endpoint settings.
/assets/js/utils.js	Reusable formatting, DOM and general utility functions.
/assets/js/security.js	Shared frontend security-related helpers, where implemented.
/assets/js/app.js	Shared application behaviour and integration.
/assets/js/main.js	Common navigation and site-wide interactions.

Include only scripts that exist and are required by the page.

Example:

<script src=“/assets/js/config.js” defer></script>
<script src=“/assets/js/utils.js” defer></script>
<script src=“/assets/js/security.js” defer></script>
<script src=“/assets/js/app.js” defer></script>
<script src=“/assets/js/main.js” defer></script>

Keep module-specific filtering, table rendering and dialog behaviour in the relevant page module or a dedicated reusable module.

Avoid duplicate event handlers, conflicting global variables and assumptions that configuration scripts execute before their dependencies.

⸻

12. Accessibility and responsive behaviour

All administration modules should support:

* Semantic headings and landmarks.
* A skip-to-content link.
* Keyboard navigation.
* Visible focus indicators.
* Descriptive form labels.
* Accessible button names.
* aria-current on active navigation links.
* aria-live for appropriate asynchronous status updates.
* Proper table header associations.
* Dialog labelling and keyboard dismissal.
* Sufficient text contrast.
* Reduced-motion preferences.
* Usable layouts on small screens.

Test navigation and essential workflows without a mouse. Do not communicate status using colour alone.

⸻

13. Error handling and operational states

Each API-connected page should distinguish the following states:

State	Expected behaviour
Initial	Explain that records have not yet been loaded.
Loading	Indicate that the API request is in progress.
Success	Render the records and metadata returned by the API.
Empty	Explain that the API returned no matching records.
Unauthenticated	Direct the administrator to the approved sign-in flow.
Forbidden	Explain that the account lacks permission.
Not found	Identify a missing or incorrectly configured API route.
Rate limited	Explain that the request must be retried later.
Server failure	Display a safe error without leaking internal details.
Invalid response	Report an incompatible response structure.
Offline or network failure	Explain that records could not be retrieved.

Preserve clear distinctions between an empty dataset, a permission failure and an unavailable service.

⸻

14. Testing checklist

Before deploying an administration page, verify the following.

Interface

* [ ]	Page title and metadata are correct.
* [ ]	Shared styles and logo load successfully.
* [ ]	Navigation points to valid routes.
* [ ]	Active navigation reflects the current page.
* [ ]	Layout works on desktop, tablet and mobile.
* [ ]	Tables remain usable on small screens.
* [ ]	Buttons, filters and dialogs work with a keyboard.
* [ ]	Reduced-motion preferences are respected.

API

* [ ]	Endpoint matches the backend route.
* [ ]	Authentication is enforced.
* [ ]	Authorisation is enforced server-side.
* [ ]	Success responses match the documented contract.
* [ ]	Empty datasets render correctly.
* [ ]	Loading and error states work.
* [ ]	Filters and pagination behave correctly.
* [ ]	Statistics reflect the actual response.
* [ ]	Invalid records do not break the page.
* [ ]	State-changing actions use the approved workflow.

Security

* [ ]	User-controlled data is rendered safely.
* [ ]	No secrets are included in frontend files.
* [ ]	Sensitive data is not unnecessarily displayed or exported.
* [ ]	File access uses authorised backend mechanisms.
* [ ]	Employer and candidate permissions are checked.
* [ ]	CSV exports are protected against formula injection.
* [ ]	Sensitive actions produce the intended audit events.
* [ ]	Error messages do not expose stack traces or database details.

Release

* [ ]	All required files exist in the deployed repository.
* [ ]	Browser console errors are resolved.
* [ ]	Network requests use the intended endpoints.
* [ ]	Production authentication and session behaviour are verified.
* [ ]	Database migrations are applied where required.
* [ ]	API permissions are tested with authorised and unauthorised accounts.
* [ ]	The production build and deployment health checks pass.

⸻

15. Development conventions

Follow these conventions when adding or modifying administration modules:

1. Inspect existing route definitions, controllers, services, schemas and database models before creating new API contracts.
2. Reuse the shared MedOrbits design system.
3. Preserve existing API response formats unless a migration is explicitly planned.
4. Keep HTML, CSS, JavaScript and backend responsibilities clearly separated where the project architecture supports it.
5. Use consistent naming for route paths, record identifiers and status fields.
6. Do not invent live statistics, employer records or verification outcomes.
7. Do not implement destructive actions as frontend-only interactions.
8. Require server-side authorisation for every privileged operation.
9. Add appropriate automated tests for new endpoints and critical workflows.
10. Update this README whenever administration routes or module responsibilities change.

⸻

16. Important implementation note

This README describes the administration portal’s intended architecture and operational standards. It does not create missing HTML pages, API routes, database tables, permission policies or backend services.

Before integrating a module, verify the actual repository structure and backend implementation. In particular, confirm the employer API, job API, authentication middleware, role permissions, audit service and database schema before enabling employer verification or recruitment management actions.

MedOrbits Administration — Study · Work · Grow