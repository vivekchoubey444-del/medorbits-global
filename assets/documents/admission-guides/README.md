MedOrbits Admission Guides

Directory: assets/documents/admission-guides/
Purpose: Public educational resources for course selection, admission planning, eligibility, application procedures, counselling preparation, and enrolment.
Brand Identity: Royal Burgundy and Champagne Gold
Maintained by: MedOrbits

⸻

1. Overview

The assets/documents/admission-guides/ directory contains educational resources designed to help students and families understand education pathways and prepare for admission processes.

Guides may cover:

* MBBS and medical admissions.
* BDS and dental admissions.
* AYUSH programmes.
* Nursing and paramedical courses.
* Pharmacy programmes.
* Engineering and technology.
* Management and business education.
* Law and other professional courses.
* Postgraduate education.
* General admission and counselling preparation.

All guides must distinguish general educational guidance from official admission requirements. MedOrbits resources must not be represented as official notifications, regulatory instructions, or approved notices issued by an institution, examination authority, regulator, or counselling authority unless that status has been independently established.

The presence of a PDF or manifest entry does not establish that a resource has been verified, approved, or published.

2. Directory Structure

The following structure represents the intended organization. Only list a PDF as an available resource after confirming that the file exists and has passed the applicable publication checks.

admission-guides/
├── README.md
├── MANIFEST.json
├── manifest.schema.json
├── general-admission-guide.pdf
├── mbbs-admission-guide.pdf
├── bds-admission-guide.pdf
├── ayush-admission-guide.pdf
├── nursing-admission-guide.pdf
├── pharmacy-admission-guide.pdf
├── paramedical-admission-guide.pdf
├── engineering-admission-guide.pdf
├── management-admission-guide.pdf
├── law-admission-guide.pdf
└── postgraduate-admission-guide.pdf

This is a reference structure, not a claim that every listed PDF currently exists.

File responsibilities

File	Responsibility
README.md	Documents content standards, verification, publication, and maintenance requirements.
MANIFEST.json	Catalogues the admission guides and their metadata.
manifest.schema.json	Optional package-specific schema for admission-guide validation.
PDF files	Contain the actual admission guidance intended for distribution.

The shared schema is maintained at assets/documents/manifest.schema.json. Use a package-specific schema only when admission guides require validation rules beyond those provided by the shared schema.

Keep the manifest synchronized with the actual PDF files, filenames, resource identifiers, academic years, publication statuses, verification metadata, and official source references.

3. Guide Content Standards

Include the following sections when relevant to the course and admission pathway.

1. Introduction: Course overview, intended audience, and scope.
2. Eligibility: Academic qualifications and other applicable requirements.
3. Entrance examinations: Relevant examinations and authoritative information sources.
4. Admission process: Application, counselling, selection, seat allocation, and enrolment steps.
5. Important dates: Verified application, examination, and counselling deadlines.
6. Required documents: A checklist of required documents and applicable formats.
7. Fees and expenses: Verified fees, currency, academic year, payment period, and applicable fee category.
8. Official resources: Links to relevant institutions, regulators, examination bodies, and counselling authorities.
9. Verification information: The date on which time-sensitive information was checked and the sources consulted.
10. Disclaimer: A statement explaining that official notifications and applicable regulations take precedence.

Do not include irrelevant sections merely to make every guide appear identical. Clearly identify requirements that vary by institution, programme, jurisdiction, admission category, or counselling authority.

Avoid presenting illustrative examples, historical information, estimates, or general recommendations as current mandatory requirements.

4. Accuracy and Verification

All admission information must be reviewed before publication.

* Verify eligibility and admission requirements using relevant official sources.
* Check deadlines against current official notifications.
* Identify the academic year and admission cycle covered by each guide.
* Include source URLs and verification dates for time-sensitive claims.
* Do not invent institutions, fees, eligibility rules, seat availability, examination dates, or application deadlines.
* Distinguish historical information from current requirements.
* Identify illustrative examples and estimates clearly.
* Update, withdraw, or mark outdated guides when official requirements change.
* Avoid guarantees of admission, seat allocation, scholarships, employment, or examination success.
* Check that external links resolve to relevant and authoritative sources.
* Preserve evidence of completed reviews according to the project’s maintenance workflow.

Prefer primary sources such as official institutions, examination authorities, counselling bodies, regulators, and government departments.

Official notifications and applicable regulations take precedence over general guidance published by MedOrbits.

Do not mark a guide as officially verified merely because it links to an official website. The verification status must accurately reflect the work performed and evidence retained.

5. Manifest Structure and Publication Status

Use MANIFEST.json as the catalogue for admission-guide resources.

The shared MedOrbits manifest schema supports two manifest styles:

* Standard manifest: Uses schemaVersion, manifestVersion, metadata, and resources.
* Specialised package manifest: Uses fields such as package, directory, purpose, brand, access, and documents.

For this directory, choose one format and use it consistently. If the current admission-guides manifest uses the specialised documents structure, retain that structure and validate it against the appropriate package schema.

5.1 Recommended document metadata

Include the following fields where supported by the selected schema:

Field	Purpose
id	Stable, unique identifier for the guide.
title	Human-readable document title.
filename	Exact PDF filename.
path	Safe, repository-relative path where supported.
category	Consistent category identifier.
description	Short summary of the guide.
status	Current publication state.
verificationStatus	Actual verification state, where supported.
academicYear	Applicable academic year, or null if not established.
lastReviewedAt	Date of the last content review, where supported.
lastVerified	Use only if supported by the selected package schema; otherwise map this concept to the appropriate verification-date field.
officialSources	Relevant authoritative source URLs and check dates, where supported.
version	Resource version, where supported.
sizeBytes	Actual file size, where supported.
checksum	Actual checksum, where supported.

Do not invent file sizes, checksums, publication dates, academic years, or verification dates.

Use ISO dates (YYYY-MM-DD) for date-only fields and null when a nullable date has not been established. For timestamps that require a time and timezone, use the format required by the applicable schema.

5.2 Publication status definitions

Use the statuses permitted by the applicable schema and publication policy.

Status	Meaning
planned	The guide is planned but may not yet exist as a file.
draft	The guide is being prepared and is not ready for public distribution.
in_review	The guide is undergoing review.
approved	Required approval has been recorded; deployment checks may remain.
published	The guide has passed the required checks and is approved for public distribution.
under_review	A previously prepared guide is being reviewed again.
outdated	The guide may contain information that is no longer current.
archived	The guide is retained for historical reference and is not actively promoted.
withdrawn	The guide has been withdrawn from distribution.

The shared schema includes additional statuses beyond the four core states of draft, published, outdated, and archived. Do not use unsupported status values in a package that defines a narrower status set.

5.3 Verification status definitions

Where the schema supports verificationStatus, use the appropriate value:

* not_verified
* content_reviewed
* official_sources_checked
* officially_verified

Verification and publication are separate controls. A guide can be content-reviewed without being approved for publication.

Public-download rule: Only resources with an approved published status that also pass file-existence, content, privacy, verification, and deployment checks may appear as active public downloads.

The website must enforce this rule in its resource-listing logic. Manifest metadata alone does not secure a file or guarantee publication readiness.

6. File Naming Conventions

Use lowercase, descriptive, hyphen-separated filenames.

Preferred examples:

general-admission-guide.pdf
mbbs-admission-guide.pdf
bds-admission-guide.pdf
ayush-admission-guide.pdf
nursing-admission-guide.pdf
pharmacy-admission-guide.pdf
paramedical-admission-guide.pdf
engineering-admission-guide.pdf
management-admission-guide.pdf
law-admission-guide.pdf
postgraduate-admission-guide.pdf

Avoid spaces, ambiguous abbreviations, duplicate filenames, and unnecessary version numbers.

When multiple editions must be retained, use a consistent academic-year convention, such as:

mbbs-admission-guide-2027-28.pdf

Clearly identify the applicable academic year inside the document and in its catalogue entry. Do not overwrite a published edition without reviewing affected links and preserving historical versions where appropriate.

7. Document Format and Accessibility

Use PDF for finalized, downloadable admission guides.

Every published PDF should:

* Have a meaningful document title and clear heading hierarchy.
* Use readable typography and consistent spacing.
* Include page numbers where appropriate.
* Prefer selectable text over image-only pages.
* Provide accessible links with descriptive link text.
* Keep tables, lists, and long URLs readable.
* Remain usable on mobile devices and when printed.
* Maintain suitable text and background contrast.
* Avoid relying on colour alone to communicate important information.
* Be checked for broken links, missing content, clipping, and layout errors.
* Use accessible PDF structure and a logical reading order where supported.
* Be inspected for unintended embedded files and metadata.

Apply the MedOrbits Royal Burgundy and Champagne Gold design direction consistently without compromising accessibility, contrast, or readability.

8. Public Access and Privacy

This directory is intended exclusively for approved public educational resources.

Never place the following materials in this directory:

* Private student application records.
* Identity proofs and passports.
* Financial records.
* Private personal contact details.
* Confidential counselling files.
* Credentials, access tokens, or other secrets.

Private records must be stored through secure backend infrastructure with appropriate authentication, authorization, and access controls.

Treat files under public web asset directories as accessible to anyone who can reach the deployed website. A filename, hidden link, manifest field, or frontend status flag does not make a public file private.

If an admission resource contains restricted information, it must not be served directly from a public asset directory.

9. Website Integration

When linking admission guides from MedOrbits pages:

* Use the correct deployed asset path.
* Confirm that the target file exists.
* Confirm that the document is approved for publication.
* Provide a descriptive link or download label.
* Identify the course and applicable academic year.
* Handle missing files and unavailable resources gracefully.
* Update links when documents are replaced, renamed, or withdrawn.
* Do not expose draft, outdated, archived, or withdrawn resources as active downloads.
* Do not claim a PDF is verified solely because its manifest entry exists.

Example public asset path:

/assets/documents/admission-guides/mbbs-admission-guide.pdf

Use this path only when the file exists at that location and has been approved for public distribution. If the application is deployed under a subpath, use the configured asset base path.

Example HTML link:

<a
  href=“/assets/documents/admission-guides/mbbs-admission-guide.pdf”
  target=“_blank”
  rel=“noopener”
>
  Download the MBBS Admission Guide (PDF)
</a>

The example is illustrative. Confirm the file and deployment path before using it.

10. Publishing Checklist

Complete the following checks before changing a guide’s status to published.

* [ ]	The PDF exists and opens successfully.
* [ ]	Content has been reviewed for accuracy and completeness.
* [ ]	The academic year and applicability are clear.
* [ ]	Eligibility requirements have been verified.
* [ ]	Entrance examinations and admission procedures have been verified.
* [ ]	Deadlines have been checked against official notifications.
* [ ]	Relevant authoritative source links are included.
* [ ]	Fees and currencies are identified where applicable.
* [ ]	Verification and review dates reflect completed work.
* [ ]	PDF text, links, tables, and page layout have been checked.
* [ ]	Accessibility and mobile readability have been reviewed.
* [ ]	No private or confidential information is included.
* [ ]	The manifest matches the actual filename and metadata.
* [ ]	IDs, paths, and related-resource references have been validated.
* [ ]	The deployed website link resolves correctly.
* [ ]	Outdated editions are excluded from active listings.
* [ ]	Required publication approval has been recorded.

11. Validation and Maintenance

Run the repository’s configured validation commands:

npm run check:json
npm run check:data

These commands should be used only if they are defined in the project’s package.json.

JSON syntax checks and application-data checks do not automatically verify the accuracy of PDF content, the authority of source links, file accessibility, or publication approval.

Where supported, add or maintain automated checks for:

* Manifest schema validation.
* Duplicate document IDs and filenames.
* File existence for resources that require an actual published file.
* Category and related-resource references.
* Publication-status and verification-policy compliance.
* Actual file sizes and checksums when recorded.
* Broken local paths and deployed links.
* Unintended exposure of draft or retired resources.

Review guides whenever relevant authorities publish new admission notifications, eligibility rules, fee schedules, examination requirements, or regulations.

When adding, removing, or updating resources:

1. Update MANIFEST.json.
2. Confirm filenames and paths match the actual files.
3. Validate the manifest against the selected schema.
4. Review source information and publication status.
5. Update affected website links and indexes.
6. Update this README if directory conventions or publishing requirements change.
7. Test affected pages and downloads before deployment.

Keep this README synchronized with the actual directory. Distinguish implemented resources from planned resources, and do not claim that validation or review has occurred unless it has been completed.

12. Disclaimer

MedOrbits admission guides provide general educational and planning guidance. They do not replace official admission notifications, applicable regulations, institutional instructions, or qualified professional advice.

They do not guarantee admission, seat allocation, scholarship eligibility, examination success, employment, or visa approval.

Students and families must independently confirm eligibility, fees, deadlines, documentation, recognition, counselling procedures, and admission decisions with the relevant institution, regulator, examination authority, counselling authority, or government department.

MedOrbits must not represent its guides as official documents or endorsements unless that status has been specifically established.

⸻

MedOrbits principle: Provide clear admission guidance, verify factual claims, protect private information, and direct students to authoritative sources for final decisions.