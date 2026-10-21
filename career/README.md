MedOrbits Career Module

Module: Career, Recruitment & Employer Services
Directory: career/
Brand: MedOrbits
Design system: Royal Purple / Aubergine and Antique Gold
Runtime: Browser-based frontend with backend API integration required for production features
Status: Frontend module documentation

⸻

1. Overview

The MedOrbits Career Module provides a unified interface for candidates, job seekers, interns, employers, and recruitment-service users.

It brings together career discovery, employment listings, internship opportunities, career guidance, resume preparation, interview preparation, employer services, recruitment, and applicant management.

The module is designed to reuse the existing MedOrbits website structure and visual identity instead of creating a separate, inconsistent interface.

Core objectives:

* Provide a central career hub.
* Help users discover jobs, internships, and career resources.
* Support candidate registration and career-related forms.
* Provide employer registration and login interfaces.
* Support job submission and management workflows.
* Provide applicant-management interfaces for authorized employers.
* Organize career information by sector and location.
* Integrate with approved, verified backend data.
* Protect candidate information and employer operations through server-side authorization.

Important: A frontend page or form does not establish that its corresponding backend feature is operational. APIs, authentication, authorization, data validation, and persistence must be implemented and tested separately.

2. Directory structure

career/
├── README.md
├── index.html
├── jobs.html
├── job-details.html
├── job-categories.html
├── internships.html
├── internship-details.html
├── register.html
├── employer-services.html
├── employer-login.html
├── employer-register.html
├── employer-dashboard.html
├── post-job.html
├── manage-jobs.html
├── applicants.html
├── recruitment.html
├── guidance.html
├── resume-support.html
├── resume-builder.html
├── interview-preparation.html
│
├── locations/
│   ├── README.md
│   ├── index.html
│   ├── bengaluru.html
│   ├── chennai.html
│   ├── delhi.html
│   ├── guwahati.html
│   ├── hyderabad.html
│   ├── kolkata.html
│   ├── mumbai.html
│   ├── pune.html
│   ├── uttar-pradesh.html
│   └── others.html
│
├── resources/
│   ├── README.md
│   ├── index.html
│   ├── faqs.html
│   ├── guides.html
│   ├── interview-questions.html
│   ├── job-fraud-awareness.html
│   ├── resume-templates.html
│   └── salary-guide.html
│
└── sectors/
    ├── README.md
    ├── index.html
    ├── aviation.html
    ├── finance.html
    ├── healthcare.html
    ├── hospitality.html
    ├── it.html
    ├── logistics.html
    ├── manufacturing.html
    └── others.html

This is the documented structure based on the supplied screenshots and file list. Verify the exact filenames and capitalization against the repository before treating the tree as exhaustive.

3. Main pages and responsibilities

File	Responsibility
index.html	Career landing page and module navigation.
jobs.html	Job directory, search, and filtering interface.
job-details.html	Job details template.
job-categories.html	Job category directory.
internships.html	Internship discovery and listing interface.
internship-details.html	Internship details template.
register.html	Candidate registration interface.
employer-services.html	Employer recruitment and hiring services.
employer-login.html	Employer authentication interface.
employer-register.html	Employer account registration interface.
employer-dashboard.html	Employer dashboard template.
post-job.html	Job submission form.
manage-jobs.html	Employer job management interface.
applicants.html	Applicant-management interface for authorized employers.
recruitment.html	Recruitment services and associated information.
guidance.html	Career guidance and planning resources.
resume-support.html	Resume preparation guidance.
resume-builder.html	Resume information and creation interface.
interview-preparation.html	Interview preparation resources.

4. Locations directory

Path: career/locations/

The locations section organizes career information by geographic area.

File	Responsibility
index.html	Location directory.
bengaluru.html	Bengaluru career information.
chennai.html	Chennai career information.
delhi.html	Delhi career information.
guwahati.html	Guwahati career information.
hyderabad.html	Hyderabad career information.
kolkata.html	Kolkata career information.
mumbai.html	Mumbai career information.
pune.html	Pune career information.
uttar-pradesh.html	Uttar Pradesh career information.
others.html	Other supported locations.

Location pages should use consistent layouts and data contracts while displaying location-specific information.

Do not invent local vacancies, employers, salary ranges, or hiring demand. Location-specific claims must be supported by suitable sources or approved records.

5. Resources directory

Path: career/resources/

The resources section provides educational and informational content for job seekers and candidates.

File	Responsibility
index.html	Career resources directory.
faqs.html	Frequently asked career questions.
guides.html	Career and job-search guides.
interview-questions.html	Interview preparation questions.
job-fraud-awareness.html	Job scam awareness and safety guidance.
resume-templates.html	Resume template information.
salary-guide.html	Salary research and compensation guidance.

Resources should be reviewed for accuracy and updated when recommendations, recruitment practices, or relevant regulations change.

Salary information must identify the relevant location, role, experience level, period, and source where applicable. Do not present estimates as guaranteed compensation.

Job-fraud awareness content should encourage users to verify employers and application channels independently.

6. Sectors directory

Path: career/sectors/

The sectors section organizes career pathways by industry.

File	Responsibility
index.html	Sector directory.
aviation.html	Aviation career information.
finance.html	Finance career information.
healthcare.html	Healthcare career information.
hospitality.html	Hospitality career information.
it.html	Information technology career information.
logistics.html	Logistics career information.
manufacturing.html	Manufacturing career information.
others.html	Other supported industries.

Sector pages may include:

* Career pathways.
* Common role categories.
* Relevant qualifications and skills.
* Training and professional development.
* Related job and internship listings.
* Related career resources.

Industry-specific eligibility, licensing, recognition, and qualification requirements must be verified before publication.

7. Design system and shared layout

The Career Module follows the existing MedOrbits visual identity.

7.1 Brand direction

* Primary palette: Royal Purple and Aubergine.
* Accent palette: Antique Gold.
* Typography: Reuse the established website typography.
* Backgrounds: Maintain the parent website’s premium, visibly tinted or softly animated background treatment.
* Components: Reuse shared navigation, buttons, forms, cards, notices, and footer components where available.

Do not introduce a competing design system within the Career Module.

7.2 Shared website elements

Pages should reuse the existing MedOrbits implementation of:

* Opening animation.
* Announcement strip.
* Brand logo.
* Primary navigation.
* Shared header and footer.
* Common typography and spacing.
* Responsive layout rules.
* Shared JavaScript utilities.
* Accessible interactive components.

Avoid duplicating shared functionality unnecessarily. Where the existing site provides reusable components, use those components rather than copying and independently modifying their implementations.

7.3 Page-specific styling

Add page-specific styles only when required by the content or interaction.

Page-specific styles must:

* Respect the global design tokens.
* Avoid breaking other pages.
* Remain responsive on mobile, tablet, and desktop.
* Preserve readable text contrast.
* Avoid horizontal overflow.
* Support keyboard navigation and visible focus states.
* Avoid conflicting with shared scripts and global styles.

8. Shared asset paths

The module uses shared MedOrbits assets.

Asset	Path
Brand logo	/assets/images/logo/medorbits-logo.png
Homepage hero image	/assets/images/hero/hero-home.jpg
Global education background	/assets/images/backgrounds/education-global.jpg
Image placeholder	/assets/images/placeholders/image-placeholder.svg
Global stylesheet	/assets/css/style.css
Constants	/assets/js/constants.js
Configuration	/assets/js/config.js
Utilities	/assets/js/utils.js
Navigation	/assets/js/navigation.js
Search	/assets/js/search.js
Animations	/assets/js/animations.js
Main application logic	/assets/js/app.js

These paths are root-relative URLs, not filesystem paths.

They assume the website is deployed with / as the public application root. If the site is deployed under a subdirectory, configure a consistent base path and update asset resolution accordingly.

Verify every referenced asset exists before deployment. Use the approved placeholder or fallback behavior when an optional image is unavailable.

9. Routing and internal links

The intended deployment directory is:

/career/

Examples of expected public URLs:

/career/
/career/jobs.html
/career/job-details.html
/career/internships.html
/career/locations/
/career/resources/
/career/sectors/

Internal links should resolve to the correct public URL regardless of the current page’s directory.

For links from nested pages, use an intentional and consistent URL strategy. Root-relative links are suitable when the domain-root deployment is guaranteed.

Do not assume that copying files into career/ automatically configures server routing, access controls, or backend endpoints.

10. Frontend and backend integration

The Career Module contains interfaces that require server-side implementation.

Illustrative endpoint contracts include:

Endpoint	Intended responsibility
/api/career/register	Candidate registration.
/api/employer/login	Employer authentication.
/api/employer/register	Employer registration.
/api/employer/jobs	Employer job management, subject to authenticated method-specific routes.
/api/career/resume	Resume-related operations, subject to the approved privacy and storage design.

These are proposed integration references, not confirmation that the endpoints exist or that their HTTP methods and request schemas are finalized.

Before connecting forms, define the endpoint methods, request and response schemas, authentication requirements, error responses, rate limits, and data-retention rules.

10.1 Candidate registration

The registration workflow should include:

* Server-side validation.
* Appropriate consent and privacy notices.
* Secure handling of personal information.
* Duplicate-account handling.
* Abuse prevention.
* Clear success and failure states.

Collect only information needed for the stated purpose.

10.2 Employer authentication and registration

Employer workflows should include:

* Secure password hashing using an approved password-hashing algorithm.
* Authentication and session security.
* Employer verification or approval where required.
* Rate limiting and abuse prevention.
* Account recovery controls.
* Audit logging for relevant security-sensitive actions.

Never store plaintext passwords or expose session identifiers in public datasets or client-side code.

10.3 Job submission and management

The backend must validate employer permissions before accepting or modifying listings.

A production workflow should define:

* Listing creation and editing.
* Required fields and allowed values.
* Employer ownership checks.
* Review and publication status.
* Expiry and withdrawal handling.
* Audit history.
* Safe treatment of external application links.

A submitted job must not automatically become an approved public listing unless the authorized publication policy explicitly permits it.

10.4 Applicant management

Applicant data must be accessible only to authorized users with the required permissions.

The backend must enforce:

* Employer ownership and job-level access restrictions.
* Applicant privacy and permitted data use.
* Authorization for viewing, updating, exporting, or deleting records.
* Audit trails for sensitive operations.
* Secure document storage where documents are supported.

Hiding an applicant table in the frontend is not an access-control mechanism.

10.5 Resume builder and resume support

The resume builder should distinguish between:

* Public guidance and templates.
* User-entered personal information.
* Generated resume documents.
* Saved resumes and backend records, if supported.

Do not persist or transmit personal information without an appropriate purpose, disclosure, and security controls. If file generation or uploads are implemented, validate file types, size limits, storage permissions, and download authorization.

11. Listings and data sources

Job, internship, employer, and applicant data must come from the approved backend or explicitly approved public datasets.

Do not publish illustrative records as real vacancies or employers.

For production listings, define the relevant data fields, which may include:

* Stable record ID.
* Job or internship title.
* Employer or recruiting organization.
* Location.
* Employment or opportunity type.
* Publication and expiry dates.
* Application instructions or URL.
* Review and publication status.
* Source and verification metadata.

Only display records that meet the applicable publication requirements.

For datasets under assets/data/, follow the canonical data rules documented in assets/data/README.md.

Do not expose applicant records, private employer information, or confidential recruitment data through public JSON files.

12. Accessibility and responsive behavior

All pages should provide a consistent experience across mobile, tablet, and desktop.

Required considerations include:

* Semantic HTML landmarks.
* Correct heading hierarchy.
* Accessible form labels and instructions.
* Keyboard-operable navigation and controls.
* Visible focus indicators.
* Appropriate contrast.
* Accessible validation and error messages.
* Responsive tables or alternative mobile layouts.
* Meaningful image alternatives.
* Reduced-motion support for animations.

Test long job titles, organization names, form errors, empty states, and large datasets to prevent clipping and horizontal overflow.

13. Security and privacy requirements

Before production deployment:

1. Use HTTPS.
2. Validate inputs on the server.
3. Apply authorization to every protected operation.
4. Use CSRF protections where applicable to the authentication architecture.
5. Configure secure session cookies and session lifecycle controls.
6. Apply rate limiting to authentication and public submission endpoints.
7. Store secrets in approved server-side configuration.
8. Protect applicant records and uploaded documents.
9. Escape untrusted content during rendering.
10. Validate redirects and external application URLs.
11. Apply appropriate logging and audit policies.
12. Establish data retention and deletion procedures.
13. Provide applicable privacy notices and consent mechanisms.
14. Test authentication, authorization, and data isolation independently of frontend visibility.

The security requirements must be implemented and tested in the backend; frontend validation alone is insufficient.

14. Testing and release checklist

Structure and assets

* [ ]	All documented HTML files exist.
* [ ]	Nested locations/, resources/, and sectors/ directories are present.
* [ ]	Shared stylesheets and scripts load correctly.
* [ ]	Logo, backgrounds, and placeholder assets resolve.
* [ ]	Internal links use the correct deployment paths.

User interface

* [ ]	Shared header, navigation, and footer are consistent.
* [ ]	Royal Purple/Aubergine and Antique Gold styling is maintained.
* [ ]	Layouts are responsive.
* [ ]	Forms provide accessible validation feedback.
* [ ]	Loading, empty, success, and failure states are handled.
* [ ]	Animations respect reduced-motion preferences.

Backend

* [ ]	Every production form has a defined and tested API contract.
* [ ]	Authentication and authorization are enforced server-side.
* [ ]	Job publication and employer permissions are verified.
* [ ]	Applicant data is protected.
* [ ]	Rate limiting, validation, and audit requirements are implemented.
* [ ]	Sensitive information is not exposed in logs or public datasets.

Release

* [ ]	No placeholder vacancies are presented as verified listings.
* [ ]	Data sources and publication rules are reviewed.
* [ ]	Security and accessibility checks pass.
* [ ]	Relevant integration tests pass.
* [ ]	Deployment paths are tested in the actual hosting environment.
* [ ]	Documentation reflects the deployed implementation.

15. Maintenance

When adding or modifying a page:

1. Update this README and the relevant subdirectory README.
2. Reuse existing shared components and design tokens.
3. Confirm all assets and internal links resolve.
4. Document new API contracts and data dependencies.
5. Add or update relevant tests.
6. Review accessibility, security, and privacy implications.
7. Verify responsive layouts.
8. Keep public content and verification metadata accurate.
9. Update deployment documentation when routing or configuration changes.

16. Implementation status and disclaimer

This README describes the Career Module’s intended structure and integration requirements. It does not certify that every page, endpoint, dashboard, or workflow is operational.

Backend integration, persistence, access control, and verification must be confirmed against the current source code before production release.

MedOrbits career information is provided for informational purposes. Listings do not guarantee employment, interviews, salary levels, or recruitment outcomes.

⸻

Ownership: MedOrbits project maintainers
Module root: career/
Public route: /career/
Design direction: Royal Purple / Aubergine and Antique Gold
Maintenance requirement: Keep documentation, routes, assets, APIs, and actual implementation synchronized.