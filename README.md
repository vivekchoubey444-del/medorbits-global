MedOrbits Enterprise Server Starter & Website Directory

Brand: MedOrbits — Education · Admissions · Careers · Recruitment
Website: https://www.medorbits.in/
Document: README.md
Status: Architecture and implementation planning
Runtime: Node.js 20+
Backend: Express.js with ES modules
Database: PostgreSQL
Primary objectives: Maintainability, security, accessibility, data integrity, and reliable deployment

⸻

1. Project Overview

MedOrbits is an education, admissions-information, application-preparation, career-guidance, and recruitment platform designed to provide structured access to academic resources, medical-college information, official notices, career opportunities, and related support services.

The repository combines a modular website architecture with an enterprise-oriented backend foundation.

The project is intended to support:

* Education, course, examination, and college discovery.
* Medical admissions and counselling information.
* Official documents, notifications, and authoritative resources.
* Study-abroad information and country comparisons.
* Career discovery, job listings, and recruitment services.
* Applicant preparation and document-submission workflows.
* Secure user accounts and administrative operations.
* Structured datasets with documented sources and verification dates.
* Responsive, accessible, and consistent website interfaces.
* Automated testing, database migrations, and controlled deployments.

Implementation principle: A documented page or proposed feature is not evidence that the corresponding file, backend integration, security control, or production deployment exists. All implementation and release statuses must be verified against the actual repository and deployment environment.

2. Technology Stack

Component	Standard
Runtime	Node.js 20 or later
Backend	Express.js
Module system	ECMAScript modules
Database	PostgreSQL
Configuration	Environment variables
Database evolution	Versioned SQL migrations
Frontend	HTML, CSS, JavaScript
Structured content	Versioned JSON datasets
Testing	Node.js checks, pytest, and applicable integration tests
Python quality	Ruff
CI/CD	GitHub Actions, where configured
Hosting	Deployment-specific configuration
Security	Server-side validation, authentication, authorization, and audit controls

The actual installed versions, scripts, dependencies, and hosting configuration must be confirmed from package.json, package-lock.json, environment configuration, and deployment files.

3. Installation and Local Development

Prerequisites

Install Node.js 20 or later, npm, Python, and PostgreSQL if a local database is required.

Install dependencies

npm install
python -m pip install -r requirements-dev.txt

Create a local environment file:

cp .env.example .env

On Windows PowerShell, use:

Copy-Item .env.example .env

Configure the required environment variables locally. Never commit .env, database passwords, access tokens, private keys, production exports, or applicant documents.

Start the server

npm start

Use the scripts actually defined in package.json. Do not assume a development or migration command exists unless it has been implemented.

4. Server Architecture

The enterprise server starter uses an ES-module Express application with independently mounted route modules.

Recommended logical architecture:

Client / Browser
       |
       v
Express Application
       |
       +— Security Middleware
       +— Request Validation
       +— Authentication
       +— Authorization
       +— Route Modules
       |     +— Authentication
       |     +— Users
       |     +— Properties / Search, if applicable
       |     +— Visits / Offers, if applicable
       |     +— Applications
       |     +— Documents
       |
       v
Service and Data-Access Layers
       |
       v
PostgreSQL

The actual application may expose only a subset of these modules. Optional route names do not imply that every module is required or that its business functionality is complete.

Health endpoints

Endpoint	Purpose
GET /health	Process liveness
GET /ready	Database readiness when configured
GET /api	API information

The readiness endpoint must return an appropriate unsuccessful status when the required database is unavailable. The liveness endpoint should report process health without exposing secrets, connection strings, internal stack traces, or sensitive infrastructure details.

Optional route modules

The server may load these files from routes/ when they are present:

routes/
├── auth.routes.js
├── user.routes.js
├── property.routes.js
├── search.routes.js
├── visit.routes.js
├── offer.routes.js
├── application.routes.js
└── document.routes.js

Each present module must default-export an Express Router.

Example:

import { Router } from “express”;
const router = Router();
router.get(“/“, (_req, res) => {
  res.json({
    success: true
  });
});
export default router;

Route-loading contract

* Validate that the imported default export is an Express Router.
* Fail startup with a clear diagnostic if a present module has an invalid export.
* Distinguish optional modules that are absent from modules that exist but cannot be loaded.
* Do not silently suppress syntax errors, missing dependencies, invalid exports, or configuration failures.
* Keep route mounting and API prefixes consistent with the actual application.
* Add authentication and authorization to protected routes rather than relying on frontend visibility.

5. Database and Migration Management

The application uses PostgreSQL and a dedicated medorbits schema.

For example:

SELECT *
FROM medorbits.applications;

Review schema.sql and apply schema changes through the project’s controlled database migration process.

The server must not automatically apply production schema changes during ordinary application startup.

Recommended layout:

database/
├── schema.sql
├── queries/
└── seeds/
migrations/
└── main/
    ├── 001_initial_schema.sql
    └── subsequent_migrations.sql

The example migration filename is illustrative. Check existing migration history before adding new migrations, and never renumber previously applied migrations.

Database requirements

* Use parameterized queries.
* Apply least-privilege database permissions.
* Configure connection pooling and connection timeouts.
* Use transactions for multi-step operations requiring atomicity.
* Apply constraints and indexes appropriate to the actual data model.
* Keep production credentials outside source control.
* Use backups and test restoration procedures.
* Avoid exposing database errors directly to clients.
* Document migration execution and rollback limitations.
* Verify schema ownership and permissions during deployment.

The presence of schema.sql does not establish that the production database has been migrated successfully.

6. Environment Configuration

Maintain .env.example as a documented list of required configuration variables without real secrets.

Typical configuration may include:

NODE_ENV=development
PORT=3000
DATABASE_URL=
SESSION_SECRET=

Add other variables only when the implemented application requires them.

For production:

* Supply secrets through the hosting platform’s protected environment configuration.
* Use a strong, unique session secret.
* Require encrypted database connections when appropriate to the hosting environment.
* Validate mandatory configuration at startup.
* Avoid logging environment-variable values.
* Rotate compromised credentials promptly.
* Ensure .env and local secret files are excluded by .gitignore.

7. Canonical Website Directory

The following sections define the intended information architecture. Reconcile every path with the actual repository before creating files or declaring completion.

7.1 Main website

index.html
pages/
├── about.html
├── our-team.html
├── leadership.html
├── our-mission.html
├── our-vision.html
├── services.html
├── consultancy.html
├── contact.html
├── faq.html
├── how-it-works.html
├── partners.html
├── institutional-partners.html
├── corporate-services.html
├── career-at-medorbits.html
├── news.html
├── announcements.html
├── blog.html
├── blog-article.html
├── sitemap.html
├── search.html
├── 404.html
└── 500.html

These pages establish the primary brand, service, navigation, and support experience.

7.2 Education and academic resources

education/
├── index.html
├── courses.html
├── course-details.html
├── streams.html
├── subjects.html
├── academic-calendar.html
├── education-news.html
├── education-guides.html
├── study-planner.html
├── eligibility-checker.html
├── college-predictor.html
├── cutoff-predictor.html
├── seat-matrix.html
├── fee-comparison.html
├── scholarships.html
├── education-loans.html
├── entrance-exams.html
├── exam-calendar.html
├── results.html
├── admit-cards.html
├── answer-keys.html
├── counselling.html
├── admission-process.html
├── documents.html
└── glossary.html

7.3 Study in India

education/study-india/
├── index.html
├── mbbs.html
├── bds.html
├── ayush.html
├── bams.html
├── bhms.html
├── bums.html
├── bnys.html
├── bsms.html
├── nursing.html
├── pharmacy.html
├── paramedical.html
├── allied-health-sciences.html
├── physiotherapy.html
├── engineering.html
├── management.html
├── law.html
├── arts-humanities.html
├── science.html
├── commerce.html
├── diploma-courses.html
├── online-courses.html
├── distance-education.html
├── private-colleges.html
└── government-colleges.html

7.4 Medical education and MBBS admissions

education/medical/
├── index.html
├── mbbs-admission.html
├── mbbs-eligibility.html
├── neet-ug.html
├── neet-pg.html
├── neet-cutoff.html
├── mbbs-fees.html
├── mbbs-seat-matrix.html
├── mbbs-college-predictor.html
├── mbbs-counselling.html
├── mbbs-state-quota.html
├── mbbs-all-india-quota.html
├── mbbs-private-colleges.html
├── mbbs-government-colleges.html
├── mbbs-nri-quota.html
├── mbbs-management-quota.html
├── mbbs-document-checklist.html
├── mbbs-admission-timeline.html
├── mbbs-bond-policy.html
├── medical-college-recognition.html
├── medical-college-comparison.html
├── medical-college-directory.html
├── bds-admission.html
├── ayush-admission.html
├── medical-pg-admission.html
├── md-ms-courses.html
└── dnb-courses.html

7.5 Medical colleges by state and territory

education/medical/colleges/
├── index.html
├── andhra-pradesh.html
├── arunachal-pradesh.html
├── assam.html
├── bihar.html
├── chhattisgarh.html
├── goa.html
├── gujarat.html
├── haryana.html
├── himachal-pradesh.html
├── jharkhand.html
├── karnataka.html
├── kerala.html
├── madhya-pradesh.html
├── maharashtra.html
├── manipur.html
├── meghalaya.html
├── mizoram.html
├── nagaland.html
├── odisha.html
├── punjab.html
├── rajasthan.html
├── sikkim.html
├── tamil-nadu.html
├── telangana.html
├── tripura.html
├── uttar-pradesh.html
├── uttarakhand.html
├── west-bengal.html
├── delhi.html
├── jammu-and-kashmir.html
├── ladakh.html
├── chandigarh.html
└── puducherry.html

7.6 West Bengal medical education

education/medical/
├── west-bengal-medical-colleges.html
├── west-bengal-mbbs-admission.html
├── west-bengal-neet-counselling.html
├── west-bengal-seat-matrix.html
├── west-bengal-mbbs-fees.html
├── west-bengal-document-checklist.html
└── west-bengal-college-comparison.html

Scope exclusion: Do not create a standalone kolkata-medical-colleges.html page. Individual medical-college pages and the West Bengal resources above remain within scope.

7.7 Individual medical colleges

education/medical/colleges/
├── cnmc.html
├── sskm-ipgmer.html
├── nrs.html
├── rg-kar.html
├── medical-college-kolkata.html
├── calcutta-national-medical-college.html
├── college-of-medicine-and-sagore-dutta-hospital.html
├── diamond-harbour-government-medical-college.html
├── barasat-government-medical-college.html
├── burdwan-medical-college.html
├── north-bengal-medical-college.html
├── bankura-sammilani-medical-college.html
├── midnapore-medical-college.html
├── murshidabad-medical-college.html
├── malda-medical-college.html
├── jalpaiguri-government-medical-college.html
├── raiganj-government-medical-college.html
├── purulia-government-medical-college.html
├── rampurhat-government-medical-college.html
├── cooch-behar-government-medical-college.html
├── aiims-kalyani.html
├── jnm-medical-college.html
├── kpc-medical-college.html
├── iq-city-medical-college.html
├── jis-school-of-medical-science.html
└── santiniketan-medical-college.html

Verify official institution names, recognition, approved courses, intake, fees, and admission routes. Reconcile legacy names and potentially overlapping profiles before publishing.

7.8 Official documents and admission resources

official-document.html
official-documents/
├── index.html
├── neet-ug-information-bulletin.html
├── neet-pg-information-bulletin.html
├── nmc-guidelines.html
├── nmc-recognized-colleges.html
├── nmc-college-permissions.html
├── mcc-counselling.html
├── wbmcc-counselling.html
├── wbmcc-information-bulletin.html
├── wbmcc-seat-matrix.html
├── wbmcc-fee-notifications.html
├── wbmcc-document-verification.html
├── state-counselling-authorities.html
├── admission-notices.html
├── official-fee-notifications.html
├── scholarship-notifications.html
├── important-dates.html
└── verification-checklist.html

Clearly identify the issuing authority, original publication date, applicable admission cycle, source URL, and last verification date.

7.9 Study abroad

education/study-abroad/
├── index.html
├── mbbs-abroad.html
├── admission-process.html
├── eligibility.html
├── fees.html
├── scholarships.html
├── visa-guidance.html
├── document-checklist.html
├── recognition-and-licensing.html
├── foreign-medical-graduate-exam.html
├── russia.html
├── georgia.html
├── kazakhstan.html
├── kyrgyzstan.html
├── uzbekistan.html
├── united-arab-emirates.html
├── philippines.html
├── nepal.html
├── bangladesh.html
├── uk.html
├── usa.html
├── canada.html
├── australia.html
├── germany.html
├── ireland.html
└── country-comparison.html

Country-specific information must reflect applicable admission rules, tuition and living costs, recognition, licensing, visa conditions, and official requirements.

7.10 Admissions and counselling

education/admissions/
├── index.html
├── how-to-apply.html
├── application-process.html
├── eligibility.html
├── registration.html
├── document-verification.html
├── choice-filling.html
├── seat-allotment.html
├── round-1.html
├── round-2.html
├── mop-up-round.html
├── stray-vacancy-round.html
├── reporting-and-enrolment.html
├── fee-payment-guidance.html
├── admission-status.html
├── application-tracker.html
├── application-help.html
├── college-preferences.html
├── admission-appeals.html
└── refund-and-withdrawal.html

Counselling sequences, deadlines, round names, and eligibility requirements must be tied to the relevant authority and admission year.

7.11 Careers, jobs, and recruitment

career/
├── index.html
├── jobs.html
├── job-details.html
├── job-categories.html
├── job-search.html
├── jobs-by-location.html
├── jobs-by-industry.html
├── jobs-by-qualification.html
├── jobs-by-experience.html
├── government-jobs.html
├── private-jobs.html
├── healthcare-jobs.html
├── medical-jobs.html
├── nursing-jobs.html
├── pharmacy-jobs.html
├── engineering-jobs.html
├── it-jobs.html
├── management-jobs.html
├── teaching-jobs.html
├── international-jobs.html
├── jobs-in-india.html
├── jobs-in-dubai.html
├── jobs-in-uae.html
├── jobs-in-saudi-arabia.html
├── jobs-in-qatar.html
├── jobs-in-oman.html
├── jobs-in-kuwait.html
├── jobs-in-bahrain.html
├── jobs-in-singapore.html
├── jobs-in-germany.html
├── jobs-in-canada.html
├── jobs-in-uk.html
├── jobs-in-australia.html
├── internships.html
├── apprenticeships.html
├── fresher-jobs.html
├── experienced-jobs.html
├── remote-jobs.html
├── work-from-home.html
├── walk-in-interviews.html
├── job-fairs.html
├── recruitment-services.html
├── employers.html
├── post-a-job.html
├── employer-registration.html
├── candidate-registration.html
├── application-form.html
├── resume-builder.html
├── cover-letter-builder.html
├── interview-preparation.html
├── career-guidance.html
├── salary-guide.html
└── job-application-status.html

Listings must distinguish verified vacancies from general career guidance. Where applicable, display employer identity, location, publication date, deadline, and source. Never invent vacancies, salary figures, or employer relationships.

7.12 Application-preparation portal

career/application-preparation/
├── index.html
├── instructions.html
├── eligibility.html
├── personal-details.html
├── education-details.html
├── work-experience.html
├── document-upload.html
├── consent.html
├── review.html
├── fee-and-refund.html
├── payment-instructions.html
├── receipt.html
├── submission-confirmation.html
├── application-status.html
├── privacy-notice.html
└── support.html

These routes represent a proposed workflow. Secure submission, document storage, consent recording, payment verification, and status tracking require implemented and tested backend services.

7.13 Applicant accounts

account/
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

Account pages must connect to authenticated backend services. Protected information must never be considered secure merely because a link is hidden or a page checks a role in browser-side JavaScript.

7.14 Administration

admin/
├── index.html
├── login.html
├── dashboard.html
├── users.html
├── user-details.html
├── roles.html
├── permissions.html
├── applications.html
├── application-details.html
├── application-review.html
├── application-status.html
├── documents.html
├── document-review.html
├── colleges.html
├── college-details.html
├── courses.html
├── admissions.html
├── counselling.html
├── jobs.html
├── job-details.html
├── employers.html
├── candidates.html
├── recruitment.html
├── payments.html
├── refunds.html
├── receipts.html
├── content-management.html
├── blog-management.html
├── announcements.html
├── official-resources.html
├── data-import.html
├── data-export.html
├── audit-log.html
├── security-events.html
├── access-control.html
├── api-settings.html
├── system-settings.html
├── form-control.html
├── maintenance.html
├── backup-status.html
└── error-reports.html

Administrative operations require server-side authorization, least-privilege permissions, appropriate audit trails, and explicit safeguards for document access, exports, and payment-related operations.

7.15 Legal, privacy, and support

Legal resources:

legal/
├── index.html
├── privacy-policy.html
├── terms.html
├── refund-policy.html
├── cancellation-policy.html
├── disclaimer.html
├── cookie-policy.html
├── data-protection.html
├── data-retention.html
├── acceptable-use.html
├── anti-fraud-policy.html
├── payment-policy.html
├── fee-disclosure.html
├── third-party-links.html
├── intellectual-property.html
├── accessibility.html
├── grievance-redressal.html
├── contact-details.html
├── education-services-disclaimer.html
├── recruitment-services-disclaimer.html
├── medical-admissions-disclaimer.html
└── independent-application-preparation.html

Support resources:

support/
├── index.html
├── contact.html
├── help-centre.html
├── faq.html
├── submit-ticket.html
├── ticket-status.html
├── complaints.html
├── payment-support.html
├── refund-request.html
├── document-upload-help.html
└── account-recovery.html

Publish only verified contact details, reporting channels, policy terms, refund commitments, and data-retention statements.

8. Shared Frontend Resources

8.1 CSS

assets/css/
├── styles.css
├── responsive.css
├── forms.css
├── print.css
├── accessibility.css
├── theme.css
└── font.css

Maintain consistent design tokens, typography, navigation, form controls, responsive layouts, and accessibility states. Reuse existing components rather than duplicating styles across pages.

8.2 JavaScript

assets/js/
├── main.js
├── navigation.js
├── search.js
├── forms.js
├── validation.js
├── admissions.js
├── college-directory.js
├── job-search.js
├── account.js
└── accessibility.js

Browser scripts should handle presentation and non-sensitive interactions. Authentication, authorization, eligibility enforcement, payment verification, and access to protected data must remain server-side.

8.3 Brand assets

assets/
├── images/
│   ├── logo/
│   │   ├── medorbits-logo.svg
│   │   └── medorbits-monogram.svg
│   ├── hero/
│   ├── colleges/
│   ├── courses/
│   ├── careers/
│   └── icons/
├── fonts/
└── documents/

Add assets only where needed. Use accessible alternative text, optimize file sizes, and verify permissions for third-party images, fonts, and logos. Do not store confidential applicant documents in publicly served directories.

9. Structured Data and Schemas

Recommended datasets:

assets/data/
├── courses.json
├── entrance-exams.json
├── colleges.json
├── universities.json
├── medical-colleges.json
├── college-fees.json
├── seat-matrix.json
├── admission-processes.json
├── documents.json
├── scholarships.json
├── countries.json
├── jobs.json
├── job-categories.json
├── locations.json
└── official-resources.json

Use schemas/ for reusable validation contracts.

Record conventions

* Define and version each dataset schema.
* Use verificationStatus: “unverified” for unverified records.
* Represent unknown values as null rather than fabricated estimates.
* Record authoritative source URLs and lastVerified dates for consequential, changing information.
* Use ISO-formatted YYYY-MM-DD dates.
* Use INR for Indian-currency fields where applicable.
* Distinguish official-source data from MedOrbits explanations.
* Avoid creating overlapping datasets when an existing authoritative structure already meets the requirement.

Example metadata:

{
  “schemaVersion”: “1.0.0”,
  “dataset”: “official-resources”,
  “generatedOn”: “2026-10-25”,
  “verificationPolicy”: “Verify consequential information against the responsible official authority.”
}

Metadata alone does not establish the accuracy or verification of individual records.

10. Quality Assurance and Validation

Run the checks supported by the current project configuration:

node —check server.js
npm run check:json
python -m pytest
python -m ruff check .

The check:json script depends on scripts/check-json.mjs and its registration in package.json. Add or repair the script if it is missing; do not assume the command succeeds merely because it is documented.

For local development, use:

npm install

For a controlled production or CI installation, prefer the appropriate lockfile-based installation process, such as:

npm ci

Run Python checks only after installing the dependencies declared by the project.

Additional recommended checks

* Express route registration and startup validation.
* PostgreSQL connection and readiness tests.
* Database migration verification.
* HTML validation and internal-link checking.
* JSON schema validation.
* Unit and integration tests.
* Authentication and authorization tests.
* Document-upload and file-access security tests.
* Accessibility and responsive-layout testing.
* Dependency and secret scanning.
* Production build and deployment smoke tests.

Report actual results, failures, skipped tests, and outstanding issues. Never report a check as passing unless it has been executed successfully.

11. Page Registry

Maintain one authoritative registry of canonical pages, preferably derived from the actual repository.

Field	Purpose
path	Canonical repository-relative path
section	Website section
status	Planned, scaffolded, integrated, tested, or verified
owner	Responsible maintainer or team
sourcePolicy	Required content-verification policy
lastReviewed	Date of the most recent relevant review

Suggested status meanings:

* Planned: Documented but not confirmed as implemented.
* Scaffolded: A page file exists but may contain incomplete functionality.
* Integrated: Connected to the applicable shared resources or backend.
* Tested: The relevant tests have passed.
* Verified: The page has passed its defined implementation, content, and release checks.

Deployment status should be tracked separately where appropriate. A tested local page is not automatically deployed or publicly accessible.

12. Documentation and Engineering Resources

docs/
scripts/
schemas/
tests/
.github/workflows/
database/
migrations/main/
infrastructure/

Responsibilities:

Directory	Responsibility
docs/	Architecture, APIs, security, privacy, deployment, and data verification
scripts/	Build, validation, and maintenance utilities
schemas/	Reusable data contracts
tests/	Unit, integration, end-to-end, accessibility, and security tests
.github/workflows/	Continuous integration and approved deployment workflows
database/	Schema definitions, queries, and database utilities
migrations/main/	Ordered database changes
infrastructure/	Hosting and infrastructure configuration

Keep package.json and package-lock.json synchronized. Align Python development dependencies, local commands, and CI configuration. Ensure deployment settings match the actual hosting architecture.

13. Deployment Standards

For a root-deployed static website, the path:

education/medical/mbbs-admission.html

normally maps to:

https://www.medorbits.in/education/medical/mbbs-admission.html

This mapping depends on the configured static document root, routing, and hosting rules. Clean URLs require compatible server configuration or redirects.

Pre-deployment checklist

* [ ]	Confirm the static website’s document root.
* [ ]	Confirm backend and frontend deployment targets.
* [ ]	Validate environment variables and production secrets.
* [ ]	Apply approved database migrations.
* [ ]	Verify route-module loading and startup behavior.
* [ ]	Check internal links, assets, and case-sensitive paths.
* [ ]	Validate JSON files and applicable schemas.
* [ ]	Run required automated tests.
* [ ]	Verify authentication and authorization controls.
* [ ]	Confirm error-page routing and redirect behavior.
* [ ]	Check sitemap, robots.txt, and canonical URLs.
* [ ]	Confirm that secrets and private applicant files are excluded from public output.
* [ ]	Run production health and readiness checks.
* [ ]	Document deployment results and unresolved issues.

14. Security and Privacy

Security controls must match the actual implementation and threat model.

Minimum engineering requirements include:

* Server-side authentication and authorization.
* Input validation and output encoding appropriate to each context.
* Parameterized SQL queries.
* Secure session and cookie configuration where sessions are used.
* Rate limiting for sensitive or abuse-prone endpoints.
* Restricted document storage and controlled download access.
* File-type, size, and content validation for uploads.
* CSRF protection where applicable to the authentication architecture.
* Appropriate security headers and CORS configuration.
* Audit logging for sensitive administrative actions.
* Secret management and dependency vulnerability review.
* Backup, recovery, retention, and deletion procedures.
* Generic client-facing errors without exposed internal details.

Document actual security controls and gaps in SECURITY.md. Provide a security reporting channel only after verifying that the channel is active and monitored.

15. Content Integrity and Publication Policy

MedOrbits provides education, admissions-information, application-preparation, career, and recruitment resources. Decisions may be controlled by independent educational authorities, institutions, employers, or other service providers.

Before publishing consequential information, verify:

* Admission eligibility and deadlines.
* College recognition and approved courses.
* Intake, seat matrices, fees, and refund rules.
* Counselling procedures and quota conditions.
* Examination notifications and official documents.
* Scholarships and funding eligibility.
* Recruitment listings and employer information.
* Country-specific licensing, visa, and education requirements.

Use authoritative sources wherever possible. Record source URLs, publication dates, applicable cycles, and verification dates.

Do not claim institutional affiliation, endorsement, accreditation, or authorization without verifiable evidence. Do not guarantee admission, seat allotment, employment, scholarships, or visa approval.

16. Implementation Roadmap

Phase 1 — Core website

* Homepage and shared navigation.
* Company, service, contact, and support pages.
* Shared design system and accessible responsive layouts.
* Internal links and error-page routing.

Phase 2 — Education and official resources

* Education landing pages and course resources.
* Admissions guidance and document checklists.
* Medical-college directory and individual profiles.
* Source verification for fees, seats, recognition, and deadlines.

Phase 3 — Careers and recruitment

* Job search and job-detail pages.
* Candidate and employer workflows.
* Verified vacancy information and recruitment disclaimers.

Phase 4 — Application preparation

* Applicant-facing form workflows.
* Server-side validation and authorization.
* Private document storage and consent management.
* Payment verification and reliable application-status tracking.

Phase 5 — Accounts and administration

* Authentication and account recovery.
* Role-based authorization.
* Administrative operations and audit controls.
* Protected data exports and account-security features.

Phase 6 — Release verification

* Automated testing and security review.
* Accessibility and mobile testing.
* Production configuration verification.
* Policy and content review.
* Deployment smoke tests and release documentation.

Prioritize working, tested functionality over creating large numbers of empty pages.

17. Maintenance and Change Management

* Preserve existing files and working functionality.
* Review repository state before replacing files.
* Avoid duplicate pages, routes, and datasets.
* Continue existing database migration numbering.
* Update the page registry when canonical paths change.
* Document meaningful changes in CHANGELOG.md.
* Keep privacy and security documentation aligned with implemented controls.
* Maintain dependency lockfiles and reproducible development instructions.
* Remove obsolete links and configurations through reviewed changes.
* Document test results and known limitations for each release.

18. Final Repository Status

This README defines the intended MedOrbits website architecture and the baseline conventions for the enterprise server starter.

It does not certify that all listed pages exist, all route modules are functional, the database has been migrated, security controls are complete, automated checks have passed, or the production website has been deployed.

Verify these conditions independently against the repository, test results, database environment, and production deployment before describing the platform as production-ready.

MedOrbits — Education · Admissions · Careers · Recruitment

Official website: https://www.medorbits.in/