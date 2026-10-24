MedOrbits — Website Page Directory

Brand: MedOrbits — Education · Admissions · Careers · Recruitment
Website: https://www.medorbits.in/
Document: README.md
Purpose: Repository directory, page registry, shared-resource reference, and implementation roadmap.

Status: Planning inventory. This document describes proposed paths and conventions; it does not prove that every file exists, is functional, or has been deployed.

1. Project objectives

MedOrbits brings together education discovery, admissions information, college resources, application preparation, career guidance, jobs, and recruitment resources.

The website directory should support:

* Clear and predictable navigation.
* Reusable HTML, CSS, JavaScript, and JSON resources.
* Traceable, authoritative educational information.
* Accessible and responsive page templates.
* Secure handling of applicant information.
* Reliable validation, testing, and deployment.
* Maintainable URLs and a documented source of truth for page paths.

Create and integrate pages according to actual product requirements. Avoid generating duplicate pages merely to increase the repository’s file count.

2. Repository conventions

Entry point and URLs

* Keep the main website entry point at /index.html.
* Store supporting pages in the directories defined below.
* Use .html paths unless the deployment explicitly configures clean URLs.
* Use consistent lowercase filenames and hyphen-separated words.
* Resolve internal links relative to the correct page or use a verified site-root path.
* Keep navigation, page metadata, shared assets, and redirects consistent with the actual deployment.
* Do not assume a public/ directory is automatically the static document root.

Security and privacy

* Never commit credentials, private keys, production database exports, or applicant documents.
* Do not place confidential documents in publicly served asset directories.
* Enforce authentication and authorization on the server for protected operations.
* Do not treat hidden navigation links or browser-side role checks as access controls.
* Keep security reporting private through a verified process documented in SECURITY.md.
* Publish only contact channels, policies, and service commitments that have been verified.

Content integrity

* Verify admission rules, college recognition, approved courses, intake, fees, seat matrices, deadlines, and eligibility against current authoritative sources.
* Record source URLs and verification dates for time-sensitive data.
* Distinguish official facts from MedOrbits explanations and recommendations.
* Do not imply official affiliation, endorsement, or authorization without verifiable evidence.
* Do not promise admission, seat allotment, employment, scholarships, or visa approval.

Scope exclusion

This directory intentionally excludes the standalone page kolkata-medical-colleges.html. Do not create or add that path as a separate page. The individual college pages and other medical-college resources listed below remain within scope.

3. Canonical page directory

The paths below define the proposed information architecture. They should be reconciled with the actual repository before implementation.

3.1 Main website and company pages

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

3.2 Education homepage and academic resources

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

3.3 Study in India

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

3.4 Medical education and MBBS admissions

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

3.5 Medical colleges by state and territory

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

3.6 West Bengal medical education

education/medical/
├── west-bengal-medical-colleges.html
├── west-bengal-mbbs-admission.html
├── west-bengal-neet-counselling.html
├── west-bengal-seat-matrix.html
├── west-bengal-mbbs-fees.html
├── west-bengal-document-checklist.html
└── west-bengal-college-comparison.html

3.7 Individual medical college pages

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

Verify each institution’s official name, current recognition, approved courses, intake, fees, and admission route before publication. Similar or legacy names must be reconciled against authoritative institution records to avoid duplicate profiles.

3.8 Official documents and admission resources

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

Link to the applicable official source wherever possible. Record publication dates and distinguish the original issuing authority from MedOrbits summaries or copies.

3.9 Study abroad

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

Country pages must explain relevant admission conditions, costs, recognition, licensing, visa requirements, and limitations using current authoritative sources.

3.10 Admissions, applications, and counselling

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

Round names, counselling sequences, and deadlines must reflect the relevant authority and admission cycle. Do not present a generic workflow as universal.

3.11 Careers, jobs, and recruitment

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

Job listings should distinguish verified vacancies from general career information. Include employer identity, location, publication date, application deadline, and source information where applicable. Never invent live vacancies, salaries, or recruitment relationships.

3.12 Application-preparation portal

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

These paths describe a proposed workflow, not a functioning application service. Submission, document storage, consent recording, payment verification, and status updates require verified backend implementations.

3.13 Applicant account pages

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

Every account feature must be connected to the relevant authenticated service. A page must not imply that account details, sessions, or documents are securely stored when no such implementation exists.

3.14 Administrative pages

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

Admin routes must enforce server-side authentication and authorization. Data export, document access, user management, and payment operations require explicit permission checks and appropriate audit controls.

3.15 Legal, privacy, and support

Legal pages:

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

Support pages:

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

Verify all published contact details, reporting channels, policy links, retention statements, refund terms, and service commitments before publication.

4. Shared assets and data

4.1 Shared stylesheets

assets/css/
├── styles.css
├── responsive.css
├── forms.css
├── print.css
├── accessibility.css
├── theme.css
└── font.css

Keep shared design tokens, typography, navigation, forms, and responsive behavior consistent. Avoid duplicated CSS when an existing shared component can be reused.

4.2 Shared JavaScript

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

Browser JavaScript should manage presentation and safe client-side interactions. Sensitive business rules, access controls, payment verification, and data authorization must remain server-side.

4.3 Brand assets

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

Add image assets only when they are required. Use accessible alternative text and confirm licensing and permission for third-party images and logos.

4.4 Structured data

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

Reusable schemas belong in schemas/. Before adding a new data file, check whether an existing schema and data source already cover the requirement.

Recommended record conventions:

* Use a defined schema and versioned structure.
* Mark unverified records with “verificationStatus”: “unverified”.
* Represent unknown values as null, not invented estimates.
* Record the authoritative source URL and lastVerified date for consequential, changing information.
* Use YYYY-MM-DD dates and INR for Indian currency where applicable.
* Preserve the distinction between an official source and a MedOrbits summary.

5. Technical and quality resources

docs/
scripts/
schemas/
tests/
.github/workflows/
database/
migrations/main/
infrastructure/

Expected responsibilities:

* docs/: architecture, API, data verification, deployment, privacy, security, and testing documentation.
* scripts/: build and validation tools.
* schemas/: reusable data contracts.
* tests/: unit, integration, end-to-end, accessibility, and security checks.
* .github/workflows/: continuous integration and approved deployment workflows.
* database/: database definitions and queries.
* migrations/main/: ordered, versioned database changes.
* infrastructure/: hosting configuration and environment documentation.

Ensure package.json and package-lock.json agree, Python configuration is consistent across local development and CI, and deployment files match the selected hosting architecture.

6. Page registry and validation

Maintain one authoritative page registry to track:

Field	Purpose
path	Canonical repository-relative path
section	Website section
status	Planned, scaffolded, integrated, tested, or verified
owner	Responsible maintainer or team
sourcePolicy	Required source-verification approach
lastReviewed	Date of the last relevant review

The registry should be derived from the actual repository where possible. Do not mark a page as deployed or verified merely because it appears in this README.

Before a release:

1. Compare registered paths with the actual repository.
2. Detect missing, unexpected, duplicate, and case-mismatched paths.
3. Check internal links and local assets.
4. Validate JSON syntax and schemas.
5. Run the applicable HTML, JavaScript, Python, SQL, and security checks.
6. Verify consequential facts and external links.
7. Confirm deployment output and error-page routing.

Record real test results and outstanding issues.

7. Implementation roadmap

Phase 1 — Core website

* Root homepage and shared navigation.
* Company, service, contact, and support pages.
* Shared CSS and accessible responsive layouts.
* Working internal links and error-page configuration.

Phase 2 — Education and official resources

* Education landing page and course resources.
* Admission guidance and document checklists.
* Medical-college directory and profiles.
* Source verification for facts, fees, seats, and deadlines.

Phase 3 — Career and recruitment

* Job search and job-detail pages.
* Candidate and employer workflows.
* Verified vacancy information and clear recruitment disclaimers.

Phase 4 — Application workflows

* Applicant-facing form pages.
* Server-side validation and authorization.
* Private document storage, consent handling, and accurate status tracking.

Phase 5 — Accounts and administration

* Authentication and account recovery.
* Role-based authorization.
* Administrative operations, audit controls, and protected data exports.

Phase 6 — Release verification

* Automated validation and security testing.
* Accessibility and mobile testing.
* Verified production configuration.
* Final policy and content review.

8. Deployment conventions

For a root-deployed static website, a file such as:

education/medical/mbbs-admission.html

normally maps to:

https://www.medorbits.in/education/medical/mbbs-admission.html

Clean URLs require compatible hosting configuration, routing, or redirects.

Before deployment, verify:

* The actual static document root.
* Asset paths and page-relative links.
* The hosting platform’s error-page conventions.
* Redirect behavior and canonical URLs.
* Sitemap and robots.txt locations.
* That private application data and credentials are excluded from public output.

9. Publication and affiliation policy

MedOrbits provides education, admissions-information, application-preparation, career, and recruitment resources. Requirements and outcomes may be controlled by external authorities, institutions, employers, or service providers.

Verify current eligibility, fees, recognition, counselling rules, seat availability, and deadlines through the responsible official source.

Do not claim affiliation, endorsement, accreditation, or authorization without verifiable evidence. Do not present application-preparation assistance as a guarantee of admission, employment, seat allotment, scholarship, or visa approval.

10. Maintenance policy

* Preserve existing repository files and working functionality.
* Review changes before overwriting existing files.
* Avoid duplicate pages and redundant data structures.
* Continue existing database migration numbering.
* Update the page registry when paths change.
* Document meaningful changes in CHANGELOG.md.
* Keep security and privacy documentation aligned with actual implementation.
* Update this README when the directory structure changes.

Final status: This document defines the intended website structure. Repository existence, feature completeness, factual accuracy, test success, and deployment status must be verified independently.