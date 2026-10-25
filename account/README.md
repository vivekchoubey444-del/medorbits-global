MedOrbits Account Portal

Directory: /account/
Main page: /account/index.html
Documentation: /account/README.md
Website: https://medorbits.in
Brand: MedOrbits — Study · Career · Consultancy

⸻

1. Purpose

The MedOrbits Account Portal is the central workspace for users to manage their profiles, applications, documents, education shortlists, job interests, messages, payments, verification and account security.

The main index.html page provides navigation to account features and displays account summary statistics when the authenticated backend service returns valid data.

The portal follows the existing MedOrbits sapphire-blue design system, responsive navigation, reusable account layout and shared footer.

2. Account Directory Structure

account/
├── README.md
├── index.html
├── dashboard.html
├── profile.html
├── edit-profile.html
├── my-applications.html
├── application-details.html
├── my-documents.html
├── messages.html
├── notifications.html
├── payment-history.html
├── receipts.html
├── saved-colleges.html
├── saved-courses.html
├── saved-jobs.html
├── sessions.html
├── security-settings.html
├── privacy-settings.html
├── change-password.html
├── reset-password.html
├── verify-email.html
├── verify-phone.html
├── delete-account.html
└── data-export.html

Implementation status: This is the intended directory structure. A listed page should be considered implemented only after its HTML file, required functionality and any necessary backend integration have been created and tested.

3. Main Account Page — index.html

The main account page includes the following sections.

Account overview

Displays six account summary values:

Statistic	Element ID
Applications	applicationCount
Saved courses	courseCount
Saved colleges	collegeCount
Saved jobs	jobCount
Documents	documentCount
Notifications	notificationCount

Additional elements:

* accountStatus — account API status message.
* accountEmail — authenticated account email when returned by the API.
* refreshSummary — reloads the account summary.
* currentYear — dynamically displays the current year.

Unknown counts display as —. The interface must not invent account statistics.

Workspace cards

The workspace provides quick access to:

* My profile
* Edit profile
* My applications
* My documents
* Messages
* Notifications
* Saved colleges
* Saved courses
* Saved jobs
* Payment history
* Receipts
* Account security

Account activity

The activity section links to application details, email verification, phone verification, password management, active sessions and privacy controls.

Education and career discovery

Users can navigate to courses, colleges, universities, entrance examinations, fees, scholarships, jobs, recruitment services and support.

4. Account Page Reference

File	Intended function
index.html	Account home and summary
dashboard.html	Detailed account dashboard
profile.html	View account profile
edit-profile.html	Update profile information
my-applications.html	List personal applications
application-details.html	Review an individual application
my-documents.html	Access authorized document records
messages.html	Account messages and conversations
notifications.html	Account alerts and notifications
payment-history.html	Payment and transaction history
receipts.html	Available payment receipts
saved-colleges.html	Saved college shortlist
saved-courses.html	Saved course shortlist
saved-jobs.html	Saved job shortlist
sessions.html	Active session management
security-settings.html	Security preferences and controls
privacy-settings.html	Privacy and communication preferences
change-password.html	Authenticated password change
reset-password.html	Password recovery
verify-email.html	Email verification
verify-phone.html	Phone verification
delete-account.html	Account deletion workflow
data-export.html	Personal data export requests

These are intended page responsibilities. The presence of a link in index.html does not establish that its target file or backend functionality already exists.

5. Design System

All account pages should remain visually consistent with the supplied index.html.

Color palette

CSS variable	Value	Purpose
—bg	#071629	Main background
—bg-soft	#0b203b	Secondary background
—surface	#102947	Main content surface
—surface-2	#153657	Elevated surface
—accent	#8bbcff	Accent color
—accent-bright	#d9e9ff	Highlights and headings
—text	#f2f7ff	Primary text
—text-soft	#c7d8ee	Secondary text
—muted	#9db2cc	Supporting text
—success	#a8f0d0	Success state
—warning	#ffdfa2	Warning state
—danger	#ffc1ca	Error and sensitive-action state

Typography

* Primary font: DM Sans
* Display font: Playfair Display
* Fallback fonts: sans-serif and Georgia, serif

Shared styles

The account interface uses:

* Dark sapphire gradient backgrounds.
* Subtle blue borders and shadows.
* Rounded content panels.
* Sticky navigation.
* Responsive account sidebar.
* Reusable button styles.
* Accessible status messages.
* Responsive cards and grids.
* A five-column desktop footer that adapts to smaller screens.
* Reduced-motion support.

Shared stylesheet: /assets/css/style.css

Page-specific styles are currently included within the HTML document. Common styles can be moved into shared CSS after confirming that all account pages continue to render correctly.

6. Navigation and URL Conventions

Use absolute, root-relative URLs for internal pages.

Examples:

<a href=“/account/index.html”>Account home</a>
<a href=“/account/my-applications.html”>My applications</a>
<a href=“/account/my-documents.html”>My documents</a>
<a href=“/account/security-settings.html”>Security settings</a>
<a href=“/account/privacy-settings.html”>Privacy settings</a>
<a href=“/account/delete-account.html”>Delete account</a>

The primary header, account sidebar, breadcrumbs and footer should use consistent paths.

Check that every linked destination exists before deployment. Avoid leaving links to nonexistent pages in a production interface.

7. Account Summary API

The supplied index.html expects the following endpoint:

GET /api/account/summary

Example response

{
  “summary”: {
    “applications”: 0,
    “savedCourses”: 0,
    “savedColleges”: 0,
    “savedJobs”: 0,
    “documents”: 0,
    “notifications”: 0
  },
  “user”: {
    “email”: “user@example.com”
  }
}

This is an example API response schema, not real account information.

Endpoint configuration

The frontend reads an optional endpoint override from:

window.MEDORBITS_CONFIG.accountSummaryEndpoint

If no override is supplied, it uses:

/api/account/summary

Backend requirements

The server must:

1. Authenticate the request.
2. Determine the current user from the authenticated session or token.
3. Retrieve counts belonging only to that user.
4. Return valid JSON.
5. Validate and serialize the returned values.
6. Return appropriate HTTP status codes.
7. Avoid exposing private account data in error messages.

The server must never trust a client-supplied user ID as proof of authorization.

Expected frontend behavior

* 200 OK: validate and display the returned summary.
* 401 Unauthorized: explain that sign-in is required.
* 403 Forbidden: display an authorization error.
* 404 Not Found: explain that the API is not configured.
* 429 Too Many Requests: ask the user to retry later.
* Other failures: display an appropriate error without fabricating values.

Private account requests use same-origin credentials and disable browser caching in the supplied implementation.

8. Shared JavaScript

The supplied page loads the following scripts:

<script src=“/assets/js/config.js” defer></script>
<script src=“/assets/js/utils.js” defer></script>
<script src=“/assets/js/security.js” defer></script>
<script src=“/assets/js/account.js” defer></script>
<script src=“/assets/js/app.js” defer></script>
<script src=“/assets/js/main.js” defer></script>

Script	Intended responsibility
config.js	Shared application configuration
utils.js	Reusable utility functions
security.js	Shared security-related frontend utilities
account.js	Account page interactions and API helpers
app.js	Application-wide behavior
main.js	Global interface and navigation behavior

These are organizational conventions. Review the existing JavaScript before moving or duplicating any functionality.

9. Security Requirements

All private account features must be protected by backend authentication and authorization.

Required controls include:

* Secure authentication and session management.
* Server-side authorization on every protected endpoint.
* Input validation and output encoding.
* CSRF protection where applicable.
* Rate limiting for login, recovery and verification endpoints.
* Secure password hashing.
* Safe session invalidation and expiration.
* Appropriate logging of sensitive security events.
* Protection of private documents and payment records.
* No credentials or sensitive account data in application logs.
* No reliance on frontend visibility or browser-side checks for authorization.

A page being accessible does not mean its data endpoints should be publicly accessible.

10. Privacy Requirements

The account portal may process profile information, education preferences, applications, documents, messages, payment records and communication preferences.

The implementation should:

* Collect only necessary information.
* Explain relevant data processing in the privacy policy.
* Provide appropriate data access, correction, export and deletion workflows.
* Respect applicable consent and communication requirements.
* Keep optional promotional messages separate from essential service communications.
* Apply appropriate retention and deletion procedures.
* Restrict personal records to authorized users.
* Avoid storing passwords or sensitive account records in browser storage.
* Verify and authorize account deletion and data export requests on the server.

Relevant pages:

/account/privacy-settings.html
/account/data-export.html
/account/delete-account.html
/account/security-settings.html
/legal/privacy-policy.html
/legal/terms.html

11. Accessibility and Responsive Design

Account pages should provide:

* Semantic HTML landmarks and heading hierarchy.
* A skip-to-content link.
* Visible keyboard focus.
* Accessible form labels and button names.
* Correct aria-expanded and aria-controls attributes.
* aria-current=“page” for active navigation.
* Live announcements for asynchronous status updates.
* Keyboard-operable navigation.
* Reduced-motion support.
* Responsive layouts for phones, tablets and desktops.
* Text wrapping and flexible grids to prevent horizontal overflow.

Test navigation and controls with keyboard input and assistive technologies.

12. Testing Checklist

Page and navigation

* [ ]	The main account page loads correctly.
* [ ]	The shared logo and stylesheet load successfully.
* [ ]	Header dropdowns work on desktop and mobile.
* [ ]	The account sidebar links point to valid routes.
* [ ]	Breadcrumbs and footer links are correct.
* [ ]	The current page is indicated accessibly.
* [ ]	No horizontal overflow occurs on small screens.

Account API

* [ ]	Successful summary responses display correct counts.
* [ ]	Missing or invalid values are not displayed as real statistics.
* [ ]	Unauthenticated requests are handled correctly.
* [ ]	Unauthorized users cannot retrieve private records.
* [ ]	API failures do not generate fake data.
* [ ]	Refreshing the summary does not cause unintended changes.

Security and privacy

* [ ]	All private endpoints enforce server-side authentication.
* [ ]	Users cannot access another user’s records.
* [ ]	Sensitive actions require appropriate verification.
* [ ]	State-changing requests have applicable CSRF protection.
* [ ]	Passwords and tokens are not stored in unsafe locations.
* [ ]	Data-export and deletion workflows are authorized.
* [ ]	Privacy settings reflect server-confirmed values.

13. Deployment Procedure

Before production deployment:

1. Verify the account directory and all linked files.
2. Confirm that the shared CSS and JavaScript assets are available.
3. Implement the account summary endpoint.
4. Connect the API to the authenticated account data source.
5. Verify authorization and response validation.
6. Test unauthenticated and authenticated behavior.
7. Test responsive layout and keyboard accessibility.
8. Confirm HTTPS and appropriate caching policies.
9. Review privacy and security workflows.
10. Update this README whenever the page inventory or API contract changes.

14. Maintenance Rules

* Preserve the established MedOrbits sapphire-blue design.
* Use consistent root-relative paths.
* Keep account data server-authoritative.
* Do not claim a feature is operational until it has been tested.
* Document new endpoints and their response schemas.
* Avoid duplicate shared scripts and conflicting styles.
* Keep privacy, security and account-management behavior consistent across pages.

⸻

Maintainer: MedOrbits
Primary entry point: /account/index.html
Documentation file: /account/README.md
Design reference: Supplied MedOrbits account home page
Production domain: https://medorbits.in