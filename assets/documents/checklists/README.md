MedOrbits Checklists Library

Directory: assets/documents/checklists/
Brand Identity: Royal Burgundy and Champagne Gold
Content Type: Public, downloadable PDF resources
Classification: Public frontend assets
Maintained by: MedOrbits

⸻

1. Purpose

The MedOrbits Checklists Library provides practical, printable resources for students, applicants, graduates, job seekers, and individuals planning education, admissions, examinations, careers, and international study.

The resources help users:

* Break complex processes into manageable tasks.
* Prepare and review supporting documents.
* Track deadlines, submissions, payments, and follow-ups.
* Compare education and career options.
* Identify requirements that require official confirmation.
* Organize completed and outstanding tasks.

These checklists are general planning aids. They do not replace official instructions, professional advice, or requirements established by institutions, regulators, examination authorities, employers, financial providers, or government agencies.

2. Directory Structure

The following structure reflects the category folders shown in the current repository screenshot. The presence of a file in the screenshot does not establish that its contents have been reviewed or approved for publication.

assets/documents/checklists/
├── README.md
├── MANIFEST.json
├── manifest.schema.json
├── admissions/
│   └── README.md
├── applications/
│   └── README.md
├── career/
│   └── README.md
├── education/
│   └── README.md
├── examinations/
│   └── README.md
├── general/
│   └── README.md
└── study-abroad/
    └── README.md

Each category may contain its own PDF files and supporting documentation. Add files to the tree and catalogue only when they have actually been created.

File responsibilities

File	Responsibility
README.md	Documents the library, policies, and maintenance process.
MANIFEST.json	Central inventory of checklist resources and their metadata.
manifest.schema.json	Defines the library-specific JSON structure and validation constraints.
Category README.md	Describes the resources, intended use, and guidance for an individual category.
PDF files	Contain printable checklist resources approved for distribution.

The shared document schema is located at assets/documents/manifest.schema.json. The checklist-specific manifest.schema.json may extend or specialize the shared rules.

The root checklist manifest references its local schema using:

{
  “$schema”: “./manifest.schema.json”
}

Use this reference only if the checklist manifest is designed to validate against that local schema. Ensure the schema supports the manifest’s actual structure before enabling validation in CI.

3. Resource Categories

Category	Scope
admissions/	Admission documents, fees, eligibility, counselling, and enrolment.
applications/	Application preparation, document review, submission, tracking, and follow-up.
career/	Career readiness, resumes, cover letters, job searches, interviews, and job offers.
education/	Course selection, college comparisons, budgeting, study planning, and university verification.
examinations/	Registration, examination documents, admit cards, preparation, exam-day readiness, and results.
general/	Personal document organization, deadlines, document reviews, payment safety, and task completion.
study-abroad/	Destination research, international applications, budgeting, accommodation, visa-document preparation, and pre-departure planning.

Consult each category’s README for its resource inventory, intended use, and category-specific guidance.

4. Manifest and Metadata

MANIFEST.json is the central registry for the checklist library. Each resource intended for publication must have a corresponding record.

The shared MedOrbits schema supports two manifest styles:

* Standard format: Uses schemaVersion, manifestVersion, metadata, and resources.
* Specialised package format: Uses fields such as package, directory, purpose, brand, access, and documents.

For the checklist library, select one structure and use it consistently. Keep the manifest, local schema, validation scripts, and website integration aligned with that structure.

Recommended resource fields

Field	Purpose
id	Unique, stable resource identifier.
title	Human-readable title.
category	Approved category identifier.
path	Repository-relative path to the resource, according to the selected schema.
format	File format, normally application/pdf.
description	Concise explanation of the resource.
intendedUse	Situation or stage in which it is useful.
status	Publication or workflow status.
verificationStatus	Current verification state.
version	Resource version, where supported.
language	Resource language, where supported.
lastReviewedAt	Date of the most recent content review, where supported.
reviewDueAt	Planned review date, where supported.
officialSources	Authoritative source references, where relevant.
sizeBytes	Actual file size, where supported.
checksum	Actual file checksum, where supported.

Do not add unsupported field names merely because they appear in this README. Follow the schema selected for the actual manifest.

Manifest integrity requirements

* Resource IDs must be unique.
* Category identifiers must match the approved category list.
* Resource paths must resolve to the intended files.
* Paths must not contain traversal segments or point outside the library.
* Renamed, retired, or replaced resources must be reflected in the manifest, category README, and website references.
* Verification claims must be supported by documented review.
* The manifest and schema must be valid JSON and conform to each other.
* A resource must not be marked published until its required publication checks have passed.

A resource’s presence in the manifest does not establish that it has been approved for public release.

5. Publication and Verification Statuses

Use only the statuses permitted by the applicable manifest schema and publication policy.

Status	Meaning
planned	The resource is planned; its final file may not exist.
draft	The resource is being prepared and is not ready for public distribution.
in_review	The resource is undergoing review.
approved	Required approval has been recorded; deployment checks may remain.
published	The resource has passed required checks and is available through its approved public distribution route.
under_review	A previously prepared resource is undergoing a new review.
outdated	The content may no longer be current.
archived	The resource is retained for historical reference and is not actively promoted.
withdrawn	The resource has been withdrawn from distribution.

The shared MedOrbits schema supports these status values. A package-specific schema may restrict the permitted set further.

Verification statuses supported by the shared schema are:

* not_verified
* content_reviewed
* official_sources_checked
* officially_verified

Verification status and publication status are separate controls. A resource may be reviewed without being approved for publication.

Public-download rule: Only resources with status: “published” that also pass the applicable file-existence, content, privacy, verification, and deployment checks may appear as active downloads.

The website must enforce this rule in its resource-listing logic. A frontend status flag or manifest entry does not secure a file or prove publication readiness.

6. Naming and Organization

Use lowercase, descriptive, hyphen-separated filenames.

Examples:

admissions-checklist.pdf
application-document-checklist.pdf
exam-preparation-checklist.pdf
study-abroad-budget-checklist.pdf
pre-departure-checklist.pdf

Keep one canonical copy of each resource wherever practical. Where the same filename appears in different categories, treat each path as a separate record and verify that the duplication is intentional.

Avoid ambiguous filenames such as final.pdf, new-checklist.pdf, or document-v2-final.pdf.

Never include personal names, application numbers, passport numbers, or sensitive details in filenames.

When multiple editions must be retained, use a consistent version or academic-year convention. Update affected references when a resource is renamed, moved, replaced, or retired.

7. Design and Accessibility

All resources should follow the MedOrbits Royal Burgundy and Champagne Gold design system.

Visual standards

* Use readable typography and a logical heading hierarchy.
* Maintain sufficient contrast and consistent spacing.
* Provide clear checkboxes and actionable instructions.
* Include page numbers and adequate margins where appropriate.
* Leave space for handwritten notes where useful.
* Ensure documents remain understandable when printed in grayscale.
* Use branding without compromising readability.

Accessibility standards

* Use meaningful headings and a logical reading order.
* Keep instructions concise and understandable.
* Use descriptive link labels.
* Do not communicate essential information through colour alone.
* Use selectable text and accessible PDF structure where supported.
* Test documents on common mobile and desktop PDF readers.
* Check that tables, symbols, checkboxes, and page breaks render correctly.

Website CSS does not automatically style PDF files. Apply the design system during PDF authoring or generation.

8. Accuracy and Verification

These resources provide general planning guidance, not official notices.

Before publishing or materially revising a resource:

1. Review the content for accuracy, clarity, completeness, and consistency.
2. Verify changing requirements using relevant official sources.
3. Record source URLs and review dates for time-sensitive information.
4. Distinguish general recommendations from mandatory requirements.
5. Identify requirements that depend on an institution, programme, location, nationality, or individual circumstances.
6. Remove obsolete, misleading, contradictory, or unsupported instructions.
7. Ensure the disclaimer is appropriate to the resource.
8. Update verification metadata only when the documented review supports the change.

For study-abroad resources, users should verify requirements directly with the relevant institution and government immigration authority. Admission and examination requirements should be checked against the applicable institution, regulator, counselling body, or examination authority.

Do not mark a resource as officially verified solely because it contains a link to an official website.

9. PDF Quality Assurance

Before publishing a new or updated PDF, verify that:

* [ ]	The file exists at the documented path.
* [ ]	The file opens without errors.
* [ ]	Text, symbols, checkboxes, margins, and page breaks render correctly.
* [ ]	The document prints clearly at the intended page size.
* [ ]	Links and QR codes lead to the intended destinations.
* [ ]	Headings, contrast, reading order, and accessibility have been reviewed.
* [ ]	PDF metadata, comments, hidden content, and embedded files have been inspected.
* [ ]	No confidential or unintended personal information is present.
* [ ]	The title and filename match the manifest record.
* [ ]	The manifest and category README are synchronized.
* [ ]	The deployed public download URL has been tested.
* [ ]	Version and review dates have been updated where applicable.

PDF integrity checks alone do not establish content accuracy or accessibility. These require separate review.

10. Website Integration

Use stable public paths for approved downloadable resources.

Example:

<a
  href=“/assets/documents/checklists/admissions/admissions-checklist.pdf”
  target=“_blank”
  rel=“noopener noreferrer”
>
  Download the Admissions Checklist (PDF)
</a>

This example assumes that the application’s assets/ directory is served from the website root. Adjust URLs if production uses a different static asset base path.

Integration requirements:

* Use descriptive, accessible download labels.
* Confirm that public URLs return the intended PDF.
* Serve PDF files with the application/pdf content type.
* Ensure deployed files match manifest paths.
* Avoid links to development-only, private, or temporary files.
* Update website references when resources are renamed or retired.
* Handle missing or unavailable resources gracefully.
* Do not represent downloading a checklist as an application submission, official verification, payment confirmation, or approval.

The website should use validated catalogue data and must not construct public download URLs from arbitrary user input.

11. Privacy and Security

This directory contains approved public frontend resources.

Permitted content includes blank checklists, worksheets, general education guidance, career resources, and publicly distributable planning templates.

Do not publish:

* Completed checklists containing identifiable applicant information.
* Passports, identity documents, private academic records, or financial statements.
* Passwords, API keys, access tokens, credentials, or confidential internal files.
* Private correspondence or internal case records.
* Unreviewed PDFs containing sensitive metadata or embedded information.

Public frontend assets must never be treated as secure storage. Completed checklists and personal records must remain in an appropriately secure location.

If a document requires authentication or restricted access, do not serve it directly from this public directory.

12. Publication Workflow

For every new or revised resource:

1. Draft: Create the checklist using the approved design system.
2. Review: Check content, source references, disclaimers, and intended audience.
3. Validate: Check the PDF, metadata, links, and accessibility.
4. Register: Add or update its record in MANIFEST.json.
5. Document: Update the category README and relevant resource index.
6. Test: Run JSON, schema, file-existence, reference, and link checks.
7. Approve: Record completion of the required reviews and approvals.
8. Publish: Deploy only after the required checks pass.
9. Confirm: Test the live download URL and inspect the deployed document.
10. Maintain: Reassess resources when relevant requirements change.

Where automated validation is available, block publication when required checks fail.

13. Validation Commands

Run the repository’s configured validation commands:

npm run check:json
npm run check:data

Run these commands only if they are defined in the project’s package.json.

These commands validate JSON syntax and the application-data rules implemented by the repository. They do not automatically verify PDF content accuracy, source authority, accessibility, or publication approval.

Where supported, automate the following checks:

* Manifest schema validation.
* Duplicate resource IDs and filenames.
* Category identifier validation.
* File existence for resources requiring an actual published file.
* Related-resource reference validation.
* Publication and verification policy compliance.
* Actual file sizes and checksums when recorded.
* Broken local paths and deployed URLs.
* Prevention of draft, outdated, archived, and withdrawn resources from appearing as active downloads.

Do not require a planned resource to have an existing PDF. Apply file-existence checks according to the resource’s status.

14. Maintenance and Versioning

* Keep the root README, category READMEs, manifest, schema, and website links synchronized.
* Preserve stable resource IDs unless the resource’s identity genuinely changes.
* Record versions and review dates where supported.
* Revalidate paths and URLs after deployment changes.
* Remove obsolete public copies when no longer appropriate.
* Review time-sensitive guidance when relevant official requirements change.
* Never change review dates merely to make an unreviewed resource appear current.
* Do not mark a resource as published or verified without supporting checks and evidence.
* Revalidate the manifest after changes to the schema or metadata conventions.
* Update CI checks when publication requirements change.

15. Disclaimer

MedOrbits checklists are informational planning resources. They do not replace official instructions, legal or financial advice, or qualified professional guidance.

They do not guarantee admission, employment, examination success, scholarship eligibility, loan approval, professional recognition, or visa approval.

Users must independently verify applicable requirements, fees, deadlines, eligibility conditions, documentation, recognition, and procedures with the relevant institution, regulator, examination authority, employer, financial provider, or government authority.

A checklist must not be presented as an official form or approved government document unless that status has been specifically established.

16. Contribution Checklist

Before submitting a new or revised resource, confirm:

* [ ]	The resource is in the correct category.
* [ ]	The filename is descriptive and consistent.
* [ ]	The content and external links have been reviewed.
* [ ]	Time-sensitive claims have been checked against authoritative sources.
* [ ]	Accessibility, readability, and print layout have been checked.
* [ ]	Sensitive information and unintended metadata have been removed.
* [ ]	Publication and verification statuses reflect completed work.
* [ ]	The manifest validates against the intended schema.
* [ ]	Duplicate IDs, paths, and filenames have been checked.
* [ ]	Required file-existence and reference checks have passed.
* [ ]	Related README files, catalogues, and website links have been updated.
* [ ]	The deployed public URL has been tested where applicable.

⸻

Maintained by: MedOrbits
Directory: assets/documents/checklists/
Classification: Public frontend assets
Brand Identity: Royal Burgundy and Champagne Gold
Review Policy: Review before publication and whenever relevant requirements change.