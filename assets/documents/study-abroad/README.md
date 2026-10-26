MedOrbits Study Abroad Guides

Package: MedOrbits Study Abroad Guides
Directory: assets/documents/study-abroad/
Manifest: MANIFEST.json
Schema: manifest.schema.json
Brand Identity: Royal Burgundy and Champagne Gold
Access: Public resources only
Classification: Public frontend assets
Maintained by: MedOrbits

⸻

1. Purpose

This directory contains educational planning guides for students researching international education opportunities.

Resources cover destination research, university selection, admissions, applications, documentation, student visas, passports, language examinations, education costs, scholarships, loans, accommodation, insurance, student employment, post-study opportunities, pre-departure preparation, and student safety.

These guides support informed planning. They do not replace official government instructions, institutional policies, applicable regulations, or qualified professional advice.

Publication rule: A manifest entry does not prove that a PDF exists, has been verified, or is approved for public distribution. Only existing resources that pass the required content, privacy, verification, and publication checks may be exposed as active downloads.

2. Directory Structure

The following structure represents the intended package layout. It does not assert that all listed PDF files currently exist.

assets/
└── documents/
    ├── README.md
    ├── manifest.schema.json
    └── study-abroad/
        ├── README.md
        ├── MANIFEST.json
        ├── manifest.schema.json
        ├── study-abroad-guide.pdf
        ├── country-selection-guide.pdf
        ├── university-selection-guide.pdf
        ├── international-admission-guide.pdf
        ├── application-process-guide.pdf
        ├── study-abroad-document-guide.pdf
        ├── student-visa-guide.pdf
        ├── passport-application-guide.pdf
        ├── english-language-test-guide.pdf
        ├── entrance-examination-guide.pdf
        ├── tuition-and-living-cost-guide.pdf
        ├── scholarship-and-financial-aid-guide.pdf
        ├── education-loan-guide.pdf
        ├── accommodation-guide.pdf
        ├── health-insurance-guide.pdf
        ├── part-time-work-guide.pdf
        ├── post-study-work-guide.pdf
        ├── pre-departure-guide.pdf
        └── international-student-safety-guide.pdf

The tree is a reference layout. Planned resources may be registered before their final PDF files are created.

File responsibilities

File	Responsibility
README.md	Documents package scope, policies, and maintenance requirements.
MANIFEST.json	Catalogues resources and their metadata.
manifest.schema.json	Defines package-specific manifest validation rules.
*.pdf	Contains the actual educational guides approved for distribution.

The shared schema is maintained at assets/documents/manifest.schema.json. The package schema may impose additional requirements for study-abroad resources.

Use one consistent manifest structure throughout this package. Ensure the manifest’s $schema value points to the schema actually used for validation.

3. Resource Inventory

The intended inventory contains 19 resources.

#	Resource	Filename
1	Study Abroad Guide	study-abroad-guide.pdf
2	Country Selection Guide	country-selection-guide.pdf
3	University Selection Guide	university-selection-guide.pdf
4	International Admission Guide	international-admission-guide.pdf
5	Study Abroad Application Process Guide	application-process-guide.pdf
6	Study Abroad Document Guide	study-abroad-document-guide.pdf
7	Student Visa Guide	student-visa-guide.pdf
8	Passport Application Guide	passport-application-guide.pdf
9	English Language Test Guide	english-language-test-guide.pdf
10	International Entrance Examination Guide	entrance-examination-guide.pdf
11	Tuition and Living Cost Guide	tuition-and-living-cost-guide.pdf
12	International Scholarship and Financial Aid Guide	scholarship-and-financial-aid-guide.pdf
13	International Education Loan Guide	education-loan-guide.pdf
14	International Student Accommodation Guide	accommodation-guide.pdf
15	International Student Health Insurance Guide	health-insurance-guide.pdf
16	International Student Part-Time Work Guide	part-time-work-guide.pdf
17	Post-Study Work Guide	post-study-work-guide.pdf
18	Study Abroad Pre-Departure Guide	pre-departure-guide.pdf
19	International Student Safety Guide	international-student-safety-guide.pdf

This is the planned inventory. Update it as files are created, withdrawn, or retired. Do not advertise an inventory item as an available download until the corresponding file exists and has passed the publication checks.

4. Manifest Structure and Metadata

MANIFEST.json is the authoritative resource registry for this package.

The shared MedOrbits schema supports two manifest styles:

* Standard manifest: Uses schemaVersion, manifestVersion, metadata, and resources.
* Specialised package manifest: Uses fields such as package, manifestVersion, directory, purpose, brand, access, and documents.

Choose the format already implemented for this package and validate it consistently. Do not mix resources and documents structures without explicitly supporting that arrangement in the schema and application code.

4.1 Recommended resource fields

Field	Purpose
id	Stable, unique resource identifier.
title	Human-readable resource title.
filename	Exact PDF filename.
path	Safe, repository-relative path where supported by the selected schema.
category	Consistent resource category identifier.
description	Concise explanation of the guide.
status	Current publication lifecycle status.
verificationStatus	Verification state supported by the selected schema.
academicYear	Applicable academic year or intake, where relevant; otherwise null if unknown.
lastReviewedAt	Date of the latest content review, where supported.
lastVerified	Use only if supported by the package schema; otherwise map this concept to the designated verification-date field.
destinationCountries	Applicable ISO 3166-1 alpha-2 country codes, where supported.
officialSources	Authoritative source references and check dates, where supported.
version	Resource version, where supported.
sizeBytes	Actual file size, where supported.
checksum	Actual file checksum, where supported.

Do not invent file sizes, checksums, academic years, review dates, or verification dates.

Use ISO 8601 date strings (YYYY-MM-DD) for date-only fields. Use null when a nullable date is unknown. Do not substitute an invented date.

4.2 Destination country codes

Use valid ISO 3166-1 alpha-2 country codes where the package schema supports destinationCountries.

Examples include:

* CA — Canada
* DE — Germany
* GB — United Kingdom
* IN — India
* US — United States

These are examples, not a claim that every guide applies to these destinations.

An empty destinationCountries array means that no specific destination has been assigned. It does not mean the guide applies universally.

For a guide that covers multiple destinations, list only countries relevant to its actual content. Country-code validation should be implemented separately if the selected schema only validates the array’s data type.

5. Publication Status and Verification

Use the status values permitted by the applicable schema and publication policy.

Status	Meaning	Active public download
planned	Registered for future creation.	No
draft	Created or being prepared but not approved.	No
in_review	Under review.	No
approved	Required approval has been recorded; deployment checks may remain.	Not until all publication checks pass
published	Approved and released after the required checks.	Yes, if the file and deployment checks pass
under_review	Previously prepared content is undergoing another review.	Suspend if currency or safety is uncertain
outdated	May contain superseded information.	No
archived	Retained for historical reference and not actively promoted.	No
withdrawn	Withdrawn from distribution.	No

The shared MedOrbits schema also supports these verification statuses:

* not_verified
* content_reviewed
* official_sources_checked
* officially_verified

Verification status and publication status are different. A guide can be content-reviewed without being approved for publication.

Public-download rule: Only records with status: “published” that pass file-existence, content, privacy, verification, and deployment checks may appear as active downloads.

A manifest entry or frontend status flag does not secure a file. Restricted resources must be protected by appropriate server-side access controls and must not be served directly from a public asset directory.

6. Accuracy and Verification

Requirements vary by destination, institution, programme, applicant circumstances, nationality, and intake.

Guides covering immigration, work permissions, insurance, entry requirements, institutional recognition, funding, or other time-sensitive matters must be checked against relevant authoritative sources before publication.

Preferred sources include:

* Official government departments and immigration authorities.
* Education regulators and qualification-recognition authorities.
* Official university and institutional admissions pages.
* Official examination authorities.
* Government and institutional scholarship providers.
* Other authoritative public bodies relevant to the guide.

For time-sensitive claims:

1. Identify the specific requirement being described.
2. Locate the relevant official source.
3. Confirm that the source applies to the destination, applicant category, programme, and intended intake.
4. Record the source title, HTTPS URL, and check date where supported.
5. Distinguish official requirements from general advice or estimates.
6. Recheck sources before republishing materially changed content.

Do not invent fees, deadlines, eligibility rules, application procedures, visa conditions, work limits, or immigration requirements.

Do not claim that a source has been checked unless the check actually occurred.

7. Accuracy, Safety, and Professional Boundaries

MedOrbits does not guarantee:

* Admission or enrolment.
* Scholarships, grants, or education-loan approval.
* Student visa approval or any other immigration outcome.
* Permission to work during or after study.
* Employment, salary, permanent residence, or other post-study outcomes.

These resources provide general educational information, not legal, immigration, tax, or financial advice.

Readers should confirm requirements with the relevant official authority and seek qualified professional advice when appropriate.

Never recommend submitting false documents, misrepresenting financial circumstances, or relying on unverified promises of guaranteed admission, scholarships, visas, employment, or immigration outcomes.

Where a guide describes an immigration or legal process, clearly identify the relevant jurisdiction and the date on which the applicable official information was checked.

8. Financial Information

Where a guide includes tuition, accommodation, living expenses, insurance premiums, application fees, or other costs:

* Identify the currency and destination.
* State the applicable period and academic year where relevant.
* Distinguish official fees from estimates.
* Identify the source and verification date.
* Explain that costs can change.
* Avoid presenting illustrative budgets as guaranteed expenses.
* Avoid promising loan approval or financial-aid eligibility.

Loan guidance should explain relevant repayment obligations, interest, fees, collateral or guarantor requirements, and the importance of reviewing the lender’s official terms.

Clearly distinguish tuition charged by an institution from third-party costs such as accommodation, insurance, travel, and application services.

9. Privacy and Security

This directory is for approved public resources only.

Never publish or store the following in this directory:

* Completed applications.
* Passport copies or personal identity documents.
* Bank statements or confidential financial records.
* Visa applications or private immigration records.
* Private student contact information.
* Passwords, API keys, access tokens, or other credentials.

Confidential applicant records must be stored separately in appropriately secured backend storage with authentication, authorization, access controls, and retention rules.

Public PDF directories must not be used to store confidential student documents.

Before publishing a PDF, inspect its metadata, comments, hidden content, embedded files, and any unintended personal information.

10. PDF Quality Assurance

Before changing a resource to published, verify the following:

* [ ]	The final PDF exists at the documented path.
* [ ]	The PDF opens successfully and is not corrupted.
* [ ]	Content accuracy, completeness, and relevance have been reviewed.
* [ ]	Destination, programme, and intake details are clear.
* [ ]	Official source links and verification dates are recorded where required.
* [ ]	The PDF title, filename, and manifest record are consistent.
* [ ]	Typography, headings, page numbering, tables, and print layout are readable.
* [ ]	Text and links are accessible where reasonably practicable.
* [ ]	PDF metadata and embedded files have been inspected.
* [ ]	No private, financial, identity, or immigration records are present.
* [ ]	The manifest has the correct publication and verification statuses.
* [ ]	The deployed public download path has been tested.
* [ ]	Superseded editions are withdrawn from active listings.

Successful JSON validation does not replace content review or PDF quality assurance.

11. Recommended Automated Checks

Integrate validation into the repository’s existing scripts or CI workflow.

Recommended checks include:

* JSON syntax validation.
* JSON Schema validation against the package’s manifest.schema.json.
* Unique document IDs.
* Unique filenames and public paths.
* Valid category and publication status values.
* Valid ISO date formats.
* HTTPS URLs for official sources.
* Valid destination country codes where applicable.
* Existence of every PDF marked published.
* Prevention of public downloads for non-published resources.
* Required verification metadata for published resources.
* Detection of obsolete or overdue verification dates.
* Synchronization between the manifest and actual directory contents.
* Verification that recorded file sizes and checksums match the actual files when supplied.

A schema may validate the structure of an official-source URL without establishing that the URL is authoritative, current, or reachable. Implement those checks separately where required.

Do not require a planned resource to have an existing PDF. Apply file-existence requirements according to the resource’s publication status.

Document a validation command only after it has been defined in package.json and tested in the repository.

12. Maintenance Policy

Review resources whenever relevant official requirements change. Review time-sensitive guides periodically according to their risk and the rate at which the underlying requirements change.

When updating a resource:

1. Review the existing content.
2. Verify affected claims against official sources.
3. Update the PDF and its metadata.
4. Update the review and verification dates where supported.
5. Update MANIFEST.json.
6. Run the configured validation checks.
7. Confirm that the deployed file matches the reviewed version.
8. Publish the revised edition only after approval.

If a guide becomes unreliable, stop promoting it as current guidance. Mark it outdated or archived as appropriate, and remove it from active download listings.

Preserve historical editions only where there is a clear retention or informational purpose. Label historical content clearly to prevent users from confusing it with current requirements.

13. Brand and Presentation

Use the MedOrbits Royal Burgundy and Champagne Gold design direction consistently across approved PDFs.

Maintain:

* Readable typography.
* Strong text contrast.
* Clear heading hierarchy.
* Restrained decorative elements.
* Accessible links and tables.
* Professional, education-focused presentation.
* Clear source citations, review dates, and disclaimers.

Brand styling must not obscure important disclaimers, source citations, tables, or document content.

Apply the design system during PDF authoring or generation. Website CSS does not automatically style PDF files.

14. Website Integration

Use stable public paths for approved downloadable resources.

Example:

<a
  href=“/assets/documents/study-abroad/study-abroad-guide.pdf”
  target=“_blank”
  rel=“noopener noreferrer”
>
  Download the Study Abroad Guide (PDF)
</a>

This example assumes that the application’s assets/ directory is served from the website root. Adjust the URL if the production deployment uses a different static asset base path.

Before exposing a download, confirm that:

* The resource is published.
* The PDF exists and matches the approved version.
* Required publication and verification checks have passed.
* The path resolves to the intended resource.
* The resource is appropriate for public distribution.

The website must not expose planned, draft, outdated, archived, or withdrawn resources as active downloads.

Handle missing or unavailable files gracefully. Do not represent downloading a guide as an application submission, official verification, financial approval, or immigration decision.

15. Directory Maintenance Checklist

Before completing a release, confirm:

* [ ]	README.md matches the implemented directory structure.
* [ ]	MANIFEST.json matches the selected schema.
* [ ]	All resource IDs are unique.
* [ ]	All listed filenames and paths have been checked.
* [ ]	Planned resources are distinguishable from existing PDFs.
* [ ]	Published resources pass required verification and publication checks.
* [ ]	Official-source metadata accurately reflects completed checks.
* [ ]	Country codes are valid where applicable.
* [ ]	Obsolete guides are excluded from active listings.
* [ ]	The configured JSON and data validation commands pass.
* [ ]	Public download URLs resolve to the intended PDFs.
* [ ]	The deployed documents match the approved versions.

⸻

16. Disclaimer

MedOrbits Study Abroad Guides provide general educational and planning information. They do not replace official government instructions, institutional policies, applicable regulations, or qualified legal, immigration, tax, or financial advice.

They do not guarantee admission, scholarships, loan approval, visa approval, employment, permission to work, permanent residence, or any other educational or immigration outcome.

Readers must independently confirm current requirements, eligibility, fees, deadlines, documentation, recognition, and procedures with the relevant institution, regulator, examination authority, government department, financial provider, or other competent authority.

MedOrbits must not represent a resource as an official government document, institutional notice, or approved authority publication unless that status has been specifically established.

⸻

Maintained by: MedOrbits
Package: Study Abroad Guides
Directory: assets/documents/study-abroad/
Design System: Royal Burgundy and Champagne Gold
Access Classification: Public resources only