MedOrbits — Enterprise Server Starter & Website Directory

Brand: MedOrbits
Tagline: Education · Admissions · Careers · Recruitment
Official website: https://www.medorbits.in/
Document: README.md
Status: Architecture and implementation planning
Runtime: Node.js 20+
Backend: Express.js with ECMAScript modules
Database: PostgreSQL
Frontend: HTML, CSS, JavaScript
Primary priorities: Maintainability, security, accessibility, data integrity, and reliable deployment

⸻

Table of Contents

1. Project Overview
2. Technology Stack
3. Prerequisites and Installation
4. Server Architecture
5. Database and Migrations
6. Environment Configuration
7. Canonical Website Directory
8. Shared Frontend Resources
9. Structured Data and Schemas
10. Quality Assurance
11. Page Registry and Implementation Status
12. Documentation and Engineering Resources
13. Deployment Standards
14. Security and Privacy
15. Content Integrity and Publication
16. Implementation Roadmap
17. Maintenance and Change Management
18. Release Readiness
19. Repository Status and Limitations

⸻

1. Project Overview

MedOrbits is an education, admissions-information, application-preparation, career-guidance, and recruitment platform designed to provide structured access to academic resources, medical-college information, official notices, career opportunities, and related support services.

The repository is intended to combine a modular public-facing website with an enterprise-oriented backend foundation.

1.1 Core objectives

* Provide structured discovery of courses, examinations, colleges, and universities.
* Publish medical admissions and counselling information with traceable sources.
* Organize official documents, notifications, and authoritative resources.
* Support study-abroad research and country comparisons.
* Provide career discovery, job listings, and recruitment resources.
* Enable applicant-preparation workflows and secure document submissions.
* Support user accounts and role-restricted administrative operations.
* Maintain structured datasets with documented sources and verification dates.
* Deliver responsive, accessible, and consistent interfaces.
* Support automated testing, controlled database migrations, and reproducible deployments.

1.2 Engineering principles

1. Evidence-based status: Documentation of a feature does not prove that it is implemented.
2. Security by design: Protected operations must be enforced by the backend.
3. Data integrity: Validate data at application boundaries and enforce critical database constraints.
4. Accessibility by default: Use semantic HTML, keyboard-accessible interactions, readable contrast, and responsive layouts.
5. Maintainable architecture: Prefer reusable modules, explicit contracts, and documented responsibilities.
6. Reproducible releases: Keep dependencies, configuration, migration history, and deployment instructions synchronized.
7. Verified content: Trace consequential educational and admissions claims to authoritative sources.
8. Privacy by default: Collect only necessary personal information and restrict access to sensitive records.

A page may be planned, scaffolded, integrated, tested, or verified. These states must not be treated as interchangeable.

⸻

2. Technology Stack

Component	Standard
Runtime	Node.js 20 or later
Package manager	npm
Backend	Express.js
Module system	ECMAScript modules
Database	PostgreSQL
Configuration	Environment variables
Database evolution	Versioned SQL migrations
Frontend	HTML, CSS, JavaScript
Structured content	Versioned JSON datasets
JavaScript validation	Node.js syntax and project-specific checks
Python testing	pytest, where configured
Python quality	Ruff, where configured
Type checking	mypy, where configured
CI/CD	GitHub Actions, where configured
Hosting	Deployment-specific configuration
Security	Validation, authentication, authorization, audit controls, and dependency review

The versions actually installed must be verified against package.json, package-lock.json, Python dependency manifests, and the deployment environment.

Version policy: Declare supported runtime versions explicitly. Pin and review dependency changes through the appropriate manifests and lockfiles. Test runtime upgrades before deploying them to production.

⸻

3. Prerequisites and Installation

3.1 Prerequisites

Install the tools required by the parts of the project you intend to run:

* Node.js 20 or later.
* npm compatible with the selected Node.js release.
* Python 3.12 or the version declared by the project’s Python configuration.
* PostgreSQL for database-backed functionality.
* Git.
* A supported development environment and terminal.

Confirm installed versions:

node —version
npm —version
python —version
git —version

Check the installed PostgreSQL client if applicable:

psql —version

3.2 Obtain the repository

If the repository is not already available locally:

git clone <REPOSITORY_URL>
cd <REPOSITORY_DIRECTORY>

Replace the placeholders with the actual repository URL and directory. Do not assume a repository URL from this document.

3.3 Install JavaScript dependencies

For initial development setup:

npm install

Commit the updated package-lock.json when dependency changes are intentional and reviewed.

For clean CI or production builds where a complete, synchronized npm lockfile exists:

npm ci

Do not use npm ci with an incomplete or inconsistent lockfile.

3.4 Install Python development dependencies

If the repository provides requirements-dev.txt:

python -m pip install -r requirements-dev.txt

If the project uses another Python dependency manager or manifest, follow that configuration instead.

Do not create a dependency-installation command until the corresponding manifest exists and is maintained.

3.5 Configure local environment variables

Create a local .env file only after confirming that the project provides an appropriate .env.example:

cp .env.example .env

PowerShell:

Copy-Item .env.example .env

Edit .env locally. Supply only the values required by the implemented application.

Never commit real secrets, database passwords, access tokens, private keys, production exports, or applicant documents.

3.6 Start the server

If package.json defines the start script as expected:

npm start

For development, use only a development script that actually exists in package.json.

Successful command execution must be confirmed from the terminal output and application health checks.

⸻

4. Server Architecture

The backend should use an ES-module Express application with explicit middleware, route contracts, service boundaries, and PostgreSQL access.

4.1 Logical architecture

Browser / Client
       |
       v
Express Application
       |
       +— Security Headers
       +— Request and Body Limits
       +— CORS Policy
       +— Rate Limiting
       +— Request Validation
       +— Authentication
       +— Authorization
       +— Route Modules
       |      +— Authentication
       |      +— Users
       |      +— Search
       |      +— Applications
       |      +— Documents
       |      +— Careers / Recruitment
       |      +— Administrative Operations
       |
       v
Service Layer
       |
       v
Data-Access Layer
       |
       v
PostgreSQL

This diagram describes the intended logical design, not a verified representation of the current source tree. Implement only the modules required by the actual product.

4.2 Suggested backend boundaries

Layer	Responsibility
Application bootstrap	Configure Express and middleware in a predictable order
Routes	Declare HTTP methods, paths, and handlers
Controllers	Translate HTTP requests into application operations
Validation	Validate request parameters, bodies, and query strings
Services	Implement business rules and multi-step operations
Data access	Execute parameterized database queries
Authentication	Establish and verify user identity
Authorization	Enforce permissions and resource ownership
Audit services	Record relevant security-sensitive operations
Error handling	Produce safe, consistent error responses
Configuration	Validate required environment settings

Avoid putting business logic, SQL, and authorization decisions entirely inside route handlers.

4.3 Health endpoints

Endpoint	Intended purpose
GET /health	Process liveness
GET /ready	Readiness of required dependencies
GET /api	API identification or documented API information

These endpoints are recommended contracts. Confirm that they exist and behave as described before publishing them as supported endpoints.

Liveness requirements

* Confirm that the application process can respond.
* Avoid exposing stack traces, secrets, connection strings, or internal infrastructure details.
* Do not report database credentials or configuration values.

Readiness requirements

* Check the dependencies necessary to serve traffic.
* Return an appropriate unsuccessful HTTP status when a required database or service is unavailable.
* Apply bounded timeouts to dependency checks.
* Avoid allowing health checks to exhaust database connections.

4.4 Route-module contract

An optional route directory may contain modules such as:

routes/
├── auth.routes.js
├── user.routes.js
├── search.routes.js
├── application.routes.js
└── document.routes.js

Additional modules may be added when supported by the actual product, such as recruitment, employer, or administrative routes.

Each module intended for mounting must default-export a valid Express Router.

Example:

import { Router } from ‘express’;
const router = Router();
router.get(‘/‘, (_req, res) => {
  res.json({
    success: true,
  });
});
export default router;

Use the installed Express version’s supported APIs and verify the module under the configured Node.js runtime.

4.5 Route-loading requirements

* Validate that each imported module exports the expected router.
* Distinguish a genuinely absent optional module from an existing module that fails to load.
* Fail startup with a clear diagnostic for invalid exports or required-module failures.
* Do not suppress syntax errors, missing dependencies, permission failures, or configuration errors as though the module were optional.
* Mount routes under consistent, documented API prefixes.
* Keep protected endpoints protected regardless of frontend visibility.
* Avoid exposing stack traces in production responses.
* Test route registration and application startup in automated tests.

A successful server startup alone does not establish that every route is secure or functionally complete.

⸻

5. Database and Migrations

MedOrbits uses PostgreSQL as its intended relational database.

5.1 Database organization

A proposed layout is:

database/
├── schema.sql
├── queries/
└── seeds/
migrations/
└── main/
    ├── 001_initial_schema.sql
    └── subsequent_migrations.sql

This is an illustrative layout. Preserve the repository’s existing database structure and migration tool if one is already in use.

5.2 Schema access

Where the medorbits schema and the applications table have been created and permissions granted, a query may look like:

SELECT *
FROM medorbits.applications;

Do not run this query against an environment where the schema or table has not been verified.

For production code, select only the columns required for the operation rather than returning unrestricted application records.

5.3 Database requirements

* Use parameterized SQL queries.
* Use a connection pool with appropriate connection limits and timeouts.
* Enforce least-privilege database roles.
* Apply primary keys, foreign keys, uniqueness constraints, and check constraints where appropriate.
* Add indexes based on actual query patterns and measured performance.
* Use transactions for multi-step operations requiring atomicity.
* Define clear transaction boundaries and rollback behavior.
* Avoid returning raw database errors to clients.
* Keep credentials outside source control.
* Document schema ownership and deployment permissions.
* Maintain backups and periodically test restoration.
* Define retention and deletion policies for personal and applicant data.
* Review database migrations before production execution.

5.4 Migration safety

The application must not automatically apply unreviewed production schema changes during ordinary startup.

A controlled migration process should:

1. Identify pending migrations.
2. Confirm the target database and deployment environment.
3. Apply migrations in their established order.
4. Record migration execution using the chosen migration mechanism.
5. Verify the resulting schema.
6. Report failures and preserve diagnostic information securely.
7. Document recovery or forward-fix procedures.

Never renumber or rewrite previously applied migrations without a controlled, documented recovery plan.

The presence of schema.sql does not prove that the production database has been migrated successfully.

⸻

6. Environment Configuration

Maintain a .env.example file containing documented variable names and safe example values, never real credentials.

Typical variables may include:

NODE_ENV=development
PORT=3000
DATABASE_URL=
SESSION_SECRET=

Add variables only when required by implemented functionality.

6.1 Configuration rules

* Validate mandatory configuration during startup.
* Reject missing or invalid production configuration when the application cannot operate safely without it.
* Never log environment-variable values or secret-bearing connection strings.
* Keep .env and local secret files excluded through .gitignore.
* Use separate credentials and secrets for development, testing, and production.
* Use a cryptographically secure, unique session secret where session-based authentication is implemented.
* Configure secure cookies and HTTPS according to the authentication architecture.
* Use encrypted database connections where required by the hosting environment.
* Rotate compromised credentials and revoke affected sessions or tokens when appropriate.
* Document secret provisioning and rotation without publishing the secret values.

6.2 Environment separation

Environment	Purpose
Local development	Developer implementation and debugging
Automated testing	Isolated, reproducible tests
Staging	Production-like verification
Production	Live user-facing services

Never run destructive integration tests against a production database.

⸻

7. Canonical Website Directory

The following directory structure defines the intended information architecture. Reconcile all paths against the actual repository before creating files or declaring implementation complete.

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

These pages establish the primary brand, services, navigation, and support experience.

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

Scope exclusion: Do not create a standalone kolkata-medical-colleges.html page. Individual medical-college pages and the West Bengal resources listed above remain within scope.

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

Verify official institution names, recognition, approved courses, intake, fees, and admission routes. Reconcile legacy names and overlapping profiles before publishing.

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

Identify the issuing authority, original publication date, applicable admission cycle, source URL, and last verification date for every consequential resource.

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

Tie counselling sequences, deadlines, round names, and eligibility requirements to the relevant authority and admission year.

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

These routes describe a proposed workflow. Secure submission, private document storage, consent recording, payment verification, and application-status tracking require implemented and tested backend services.

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

Account pages must use authenticated backend services. Hiding links or checking roles in browser-side JavaScript is not an authorization mechanism.

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

Administrative operations require server-side authorization, least-privilege permissions, appropriate audit trails, and safeguards for document access, exports, and payment-related operations.

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

⸻

8. Shared Frontend Resources

8.1 CSS architecture

assets/css/
├── styles.css
├── responsive.css
├── forms.css
├── print.css
├── accessibility.css
├── theme.css
└── font.css

Maintain consistent design tokens, typography, navigation, form controls, responsive layouts, and accessibility states.

* Reuse shared components rather than duplicating page styles.
* Keep interactive elements visibly focusable.
* Test keyboard navigation and mobile layouts.
* Avoid horizontal overflow and clipped text.
* Respect reduced-motion preferences.
* Ensure readable contrast across themes and backgrounds.
* Optimize fonts and assets for loading performance.
* Use print styles where pages need to support printing.

8.2 JavaScript architecture

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

Browser scripts should handle presentation and non-sensitive interactions.

Authentication, authorization, eligibility enforcement, payment verification, sensitive document processing, and protected data access must remain enforced server-side.

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

Add assets only when needed. Provide suitable alternative text, optimize file sizes, and verify licensing and permissions for third-party images, fonts, and logos.

Never store confidential applicant documents or private user uploads inside a publicly served static directory.

⸻

9. Structured Data and Schemas

9.1 Recommended datasets

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

Use reusable schemas to validate dataset structures. Preserve existing authoritative datasets when they already satisfy the requirement rather than creating duplicate sources of truth.

9.2 Record conventions

* Define and version each dataset schema.
* Mark unverified records explicitly.
* Represent unknown values as null, not fabricated estimates.
* Store authoritative source URLs and lastVerified dates for consequential, changing information.
* Use ISO-formatted dates: YYYY-MM-DD.
* Use INR for Indian-currency fields where applicable.
* Distinguish official-source data from MedOrbits explanations.
* Document record provenance and the method used to verify it.
* Avoid embedding secrets or personal applicant information in public JSON datasets.

Example metadata:

{
  “schemaVersion”: “1.0.0”,
  “dataset”: “official-resources”,
  “generatedOn”: “2026-10-25”,
  “verificationPolicy”: “Verify consequential information against the responsible official authority.”
}

Metadata alone does not establish that individual records have been verified. Each record should have its own verification state and source details where appropriate.

9.3 Suggested verification fields

For consequential records, consider fields such as:

{
  “verificationStatus”: “unverified”,
  “sourceUrl”: null,
  “publishedOn”: null,
  “lastVerified”: null
}

Adapt this example to the existing schema. Do not add redundant or incompatible fields without updating the schema and consumers.

⸻

10. Quality Assurance

Run only checks supported by the current repository configuration.

10.1 JavaScript syntax

node —check server.js

Run syntax checks for additional files through existing scripts or the project’s configured validation process.

10.2 JSON validation

If the project defines the relevant scripts:

npm run check:json

The script may depend on scripts/check-json.mjs and supported command-line options. Confirm the script exists and that its behavior matches the documented command.

10.3 Python tests and quality checks

Where configured and dependencies are installed:

python -m pytest
python -m ruff check .

If Ruff formatting is part of the project:

python -m ruff format —check .

Use the actual configuration and test locations declared by the repository.

10.4 Additional recommended checks

* Express application startup and route registration.
* Router export validation.
* PostgreSQL connection and readiness behavior.
* Migration consistency and migration testing.
* JSON schema validation.
* HTML syntax and internal-link checking.
* Unit, integration, and end-to-end tests.
* Authentication and authorization tests.
* Document-upload and file-access security tests.
* Accessibility and responsive-layout testing.
* Dependency vulnerability scanning.
* Secret scanning.
* Backup restoration testing.
* Production build and deployment smoke tests.

10.5 Test reporting

For each release, record:

* Command or test suite executed.
* Environment in which it ran.
* Pass/fail result.
* Skipped tests and reasons.
* Known failures.
* Security or data-integrity findings.
* Remaining release blockers.

Never report a check as passing unless it has been executed successfully. A missing test suite is not a passing test suite.

⸻

11. Page Registry and Implementation Status

Maintain one authoritative registry of canonical pages, preferably generated from or validated against the actual repository.

Suggested fields:

Field	Purpose
path	Canonical repository-relative path
section	Website section
status	Implementation state
owner	Responsible maintainer or team
sourcePolicy	Required content-verification policy
lastReviewed	Date of the latest relevant review

11.1 Status definitions

Status	Meaning
Planned	Documented but not confirmed as implemented
Scaffolded	File exists but functionality may be incomplete
Integrated	Connected to the applicable shared resources or backend
Tested	Relevant tests have passed
Verified	Defined implementation, content, and release checks have passed

Deployment status should be tracked separately when appropriate. A tested local page is not automatically deployed or publicly accessible.

Do not mark a page as integrated merely because its JavaScript file exists. Verify the actual connections, request paths, error handling, and authorization behavior.

⸻

12. Documentation and Engineering Resources

Recommended engineering directories:

docs/
scripts/
schemas/
tests/
.github/workflows/
database/
migrations/main/
infrastructure/

Directory	Responsibility
docs/	Architecture, APIs, security, privacy, deployment, and data verification
scripts/	Build, validation, and maintenance utilities
schemas/	Reusable data contracts
tests/	Unit, integration, end-to-end, accessibility, and security tests
.github/workflows/	Continuous integration and approved deployment workflows
database/	Schema definitions, queries, and database utilities
migrations/main/	Ordered database changes
infrastructure/	Hosting and infrastructure configuration

Keep the following synchronized:

* package.json and package-lock.json.
* Python dependency manifests and Python quality configuration.
* Automated test commands and CI workflows.
* Environment examples and actual configuration requirements.
* API documentation and implemented routes.
* Database documentation and applied migration history.
* Security documentation and implemented controls.
* Page registry and actual canonical paths.

Do not document a deployment platform as configured until the corresponding deployment files or platform settings have been verified.

⸻

13. Deployment Standards

13.1 Static-page URL mapping

For a root-deployed static website, the path:

education/medical/mbbs-admission.html

may map to:

https://www.medorbits.in/education/medical/mbbs-admission.html

This mapping depends on the configured document root, routing rules, redirects, and hosting environment.

Clean URLs require compatible server configuration or redirects. Avoid assuming that a URL is available merely because a similarly named file exists in the repository.

13.2 Deployment checklist

* [ ]	Confirm the repository branch and release commit.
* [ ]	Confirm the frontend document root.
* [ ]	Confirm backend and frontend deployment targets.
* [ ]	Validate production environment variables and secrets.
* [ ]	Confirm the Node.js runtime meets the supported version.
* [ ]	Install dependencies using the appropriate lockfile-based process.
* [ ]	Apply approved database migrations through the controlled migration process.
* [ ]	Verify route-module loading and startup behavior.
* [ ]	Check internal links, assets, and case-sensitive paths.
* [ ]	Validate JSON files and applicable schemas.
* [ ]	Run required automated tests.
* [ ]	Verify authentication and authorization controls.
* [ ]	Confirm document uploads and private-file access controls.
* [ ]	Verify error-page routing and redirect behavior.
* [ ]	Check sitemap, robots.txt, and canonical URLs.
* [ ]	Confirm secrets and private applicant files are excluded from public output.
* [ ]	Verify HTTPS and security-header configuration.
* [ ]	Run production health and readiness checks.
* [ ]	Confirm backups and recovery procedures.
* [ ]	Document deployment results and unresolved issues.

13.3 Rollback and recovery

Before deployment, define the recovery procedure appropriate to the changes being released.

Consider:

* Application rollback or redeployment.
* Database migration compatibility.
* Backward compatibility during rolling deployments.
* Backup restoration and recovery-point objectives.
* Secret rotation if credentials are exposed.
* Cache invalidation and static-asset versioning.
* Communication and incident logging.

A database migration may not be safely reversible. Document forward-fix procedures where rollback would risk data loss or schema inconsistency.

⸻

14. Security and Privacy

Security controls must match the actual implementation and threat model.

14.1 Minimum engineering requirements

* Server-side authentication and authorization.
* Request validation and context-appropriate output encoding.
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
* Resource-ownership checks to prevent unauthorized access to other users’ records.
* Access controls and auditability for administrative exports.

14.2 Applicant documents

Applicant documents may contain sensitive personal information.

* Store private uploads outside public web roots.
* Authorize every upload, preview, download, and deletion operation on the server.
* Generate storage names independently of untrusted original filenames.
* Enforce file-size and allowed-content policies.
* Do not trust filename extensions or browser-provided MIME types alone.
* Consider malware scanning appropriate to the threat model.
* Use short-lived authorized download links only where the storage architecture supports them.
* Avoid logging document contents, authentication tokens, or unnecessary personal data.
* Define retention and deletion requirements before collecting documents.

14.3 Authentication and administrative access

* Use appropriate password hashing if passwords are stored locally.
* Protect account recovery and verification workflows against abuse.
* Rate-limit authentication and recovery endpoints.
* Enforce permissions on every protected API operation.
* Prevent privilege escalation and insecure direct-object references.
* Require stronger protections for high-impact administrative actions.
* Audit permission changes and sensitive data access where appropriate.
* Revoke sessions or tokens when required by account-security events.

14.4 Security documentation

Document actual security controls and known gaps in SECURITY.md. Publish a vulnerability-reporting channel only after confirming that it is active, monitored, and assigned to a responsible recipient.

Security documentation must not claim compliance, penetration-test completion, or production readiness without supporting evidence.

⸻

15. Content Integrity and Publication

MedOrbits provides education, admissions-information, application-preparation, career, and recruitment resources. Admissions and recruitment decisions may be controlled by independent educational authorities, institutions, employers, or other service providers.

15.1 Verify consequential information

Before publishing, verify:

* Admission eligibility and deadlines.
* College recognition and approved courses.
* Intake, seat matrices, fees, and refund rules.
* Counselling procedures and quota conditions.
* Examination notifications and official documents.
* Scholarships and funding eligibility.
* Recruitment listings and employer information.
* Country-specific licensing, visa, and education requirements.

15.2 Source attribution

For relevant records, maintain:

* Issuing authority or original publisher.
* Source URL.
* Publication or notification date, where available.
* Applicable admission cycle or validity period.
* Last verification date.
* Verification status.
* Reviewer or review process, where appropriate.

15.3 Publication safeguards

* Prefer official sources for rules, eligibility, fees, deadlines, and recognition.
* Clearly distinguish official statements from MedOrbits explanations.
* Flag unverified or outdated content.
* Remove or correct information that is materially misleading.
* Do not invent vacancies, salaries, seat availability, fees, or institutional relationships.
* Do not claim affiliation, endorsement, accreditation, or authorization without verifiable evidence.
* Do not guarantee admission, seat allotment, employment, scholarships, or visa approval.
* Review consequential information when the relevant authority publishes an update.

A disclaimer does not replace accurate content, appropriate verification, or required legal review.

⸻

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
* Appropriate moderation and publication controls.

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
* Backup and recovery verification.
* Deployment smoke tests and release documentation.

Prioritize working, tested functionality over creating large numbers of empty pages. Complete the security and data-protection foundations before enabling sensitive workflows.

⸻

17. Maintenance and Change Management

* Preserve existing files and working functionality.
* Inspect repository state before replacing files.
* Avoid duplicate pages, routes, and datasets.
* Continue existing database migration numbering.
* Update the page registry when canonical paths change.
* Document meaningful changes in CHANGELOG.md.
* Keep privacy and security documentation aligned with implemented controls.
* Maintain dependency lockfiles and reproducible development instructions.
* Remove obsolete links and configurations through reviewed changes.
* Document test results and known limitations for each release.
* Review access permissions and administrative accounts periodically.
* Monitor production errors and service availability.
* Test backup restoration periodically.
* Review consequential educational content at appropriate intervals.
* Document security incidents and follow the established response procedure.

Use pull requests or an equivalent reviewed-change process for changes that affect production, sensitive data, authentication, authorization, database schemas, or payment-related functionality.

⸻

18. Release Readiness

Before describing a release as production-ready, verify the applicable requirements below.

18.1 Repository and build

* [ ]	Source files and required assets exist.
* [ ]	Dependency manifests and lockfiles are synchronized.
* [ ]	Required build and validation commands are documented.
* [ ]	Automated checks have actually passed.
* [ ]	Known failures and skipped tests are recorded.

18.2 Application and database

* [ ]	Server starts with validated production configuration.
* [ ]	Required route modules load correctly.
* [ ]	Readiness checks reflect required dependency availability.
* [ ]	Database migrations have been reviewed and applied.
* [ ]	Database permissions follow least-privilege principles.
* [ ]	Backup and recovery procedures have been tested.

18.3 Security and privacy

* [ ]	Protected operations enforce server-side authorization.
* [ ]	Private documents are not publicly accessible.
* [ ]	Authentication and recovery flows have been tested.
* [ ]	Secrets are excluded from source control and public assets.
* [ ]	Error responses avoid exposing internal details.
* [ ]	Applicable retention, deletion, and consent workflows are implemented.
* [ ]	Security reporting and incident-response procedures are operational.

18.4 Website and content

* [ ]	Canonical links and assets resolve correctly.
* [ ]	Responsive layouts and keyboard navigation have been tested.
* [ ]	Consequential content has appropriate authoritative sources.
* [ ]	Outdated and unverified information is clearly identified.
* [ ]	Legal policies and contact details reflect actual operations.
* [ ]	Sitemap, canonical URLs, and search-engine directives are correct.

18.5 Deployment

* [ ]	Production environment variables have been validated.
* [ ]	HTTPS and security headers have been checked.
* [ ]	Health and readiness endpoints behave correctly.
* [ ]	Deployment smoke tests have passed.
* [ ]	Rollback and recovery procedures are documented.
* [ ]	Remaining blockers have been resolved or formally accepted by the responsible authority.

18.6 Release decision

A release should be approved only after the required checks have been completed and the responsible maintainer has reviewed the evidence.

Use explicit release states such as:

* Not assessed: Required evidence has not been collected.
* Blocked: One or more mandatory release requirements have failed.
* Ready for review: Required checks are complete and awaiting approval.
* Approved for release: An authorized reviewer has approved the release.
* Released: Deployment has completed and the required post-deployment checks have passed.

Do not use “production-ready” as a substitute for an evidence-based release decision.

⸻

19. Repository Status and Limitations

This README defines the intended MedOrbits website architecture, server conventions, quality standards, and release-readiness requirements.

It does not independently certify that:

* All listed pages exist.
* All route modules are implemented.
* All API operations are functional.
* The production database has been migrated.
* Authentication or authorization is complete.
* Applicant documents are securely stored.
* Payment integrations are operational.
* Automated checks have passed.
* Deployment and recovery procedures have been tested.
* The live website matches the documented architecture.

Verify these conditions against the actual repository, test results, database environment, configuration, and production deployment before describing the platform as fully operational.

Official website

https://www.medorbits.in/

MedOrbits — Education · Admissions · Careers · Recruitment

Maintainable engineering. Verified information. Secure workflows. Reliable delivery.