MedOrbits Fee Guides

Package: MedOrbits Fee Guides
Directory: assets/documents/fee-guides/
Authoritative manifest: assets/documents/fee-guides/MANIFEST.json
Manifest schema: assets/schemas/fee-guides.schema.json
Application catalogue: assets/data/fee-guides.json
Maintained by: MedOrbits
Brand: Royal Burgundy and Champagne Gold
Documentation version: 2.0.0

1. Purpose

The MedOrbits Fee Guides package provides general educational and financial-planning resources for students, applicants, graduates, and families. Topics include tuition, institutional charges, accommodation, scholarships, financial aid, education loans, counselling charges, and refund or cancellation terms.

These resources are planning aids. They are not official fee notifications and do not guarantee admission, specific fee amounts, scholarships, loan approval, or refunds.

2. Source of truth and file structure

MANIFEST.json is the authoritative registry for this package. The application catalogue at assets/data/fee-guides.json must be generated from the manifest using a deterministic build or validation script. Do not maintain the two files as independent sources of truth.

The JSON Schema is stored at assets/schemas/fee-guides.schema.json. From the package manifest, its relative reference is:

../../schemas/fee-guides.schema.json

The package contains these principal resources:

* MANIFEST.json — authoritative resource metadata and publication status.
* README.md — package documentation and publication procedures.
* Category directories — organized PDF resources.
* assets/data/fee-guides.json — generated application-facing catalogue.

The build process should validate the manifest before generating the catalogue. It should also check resource paths, document identifiers, category references, related-document references, publication status, and the existence and integrity of files marked for publication.

3. Resource inventory

The package registers 18 planned fee-guide resources.

Resource	Expected filename
Education Fee Guide	education-fee-guide.pdf
College Fee Guide	college-fee-guide.pdf
University Fee Guide	university-fee-guide.pdf
MBBS Fee Guide	mbbs-fee-guide.pdf
BDS Fee Guide	bds-fee-guide.pdf
AYUSH Fee Guide	ayush-fee-guide.pdf
Nursing Fee Guide	nursing-fee-guide.pdf
Pharmacy Fee Guide	pharmacy-fee-guide.pdf
Paramedical Fee Guide	paramedical-fee-guide.pdf
Engineering Fee Guide	engineering-fee-guide.pdf
Management Fee Guide	management-fee-guide.pdf
Law Fee Guide	law-fee-guide.pdf
Postgraduate Fee Guide	postgraduate-fee-guide.pdf
Hostel and Accommodation Fee Guide	hostel-and-accommodation-fee-guide.pdf
Scholarship and Financial Aid Guide	scholarship-and-financial-aid-guide.pdf
Education Loan Guide	education-loan-guide.pdf
Admission and Counselling Fees Guide	admission-and-counselling-fees-guide.pdf
Refund and Cancellation Fee Guide	refund-and-cancellation-fee-guide.pdf

Important: An entry in the manifest does not establish that its PDF exists. Resources marked planned must not be represented as available downloads.

4. Publication lifecycle

The package supports these publication statuses:

* planned — intended resource; the file may not exist.
* draft — content is being prepared.
* in_review — awaiting editorial or subject-matter review.
* verified — required verification checks have been recorded; publication approval is still required.
* published — approved for public download, subject to deployment and file checks.
* under_review — requires reassessment and must not be promoted as current guidance while review is pending.
* outdated — information may have been superseded and must not be promoted as current.
* archived — retained for historical or internal reference and not publicly promoted.
* withdrawn — removed from distribution.

Only resources with status: “published” may receive active public download links. Publication also requires the configured file-existence, integrity, review, and deployment checks to pass.

The featured flag controls presentation only. It never overrides publication status or makes an unpublished resource downloadable.

A status change to published must follow the package’s approval process. Automated checks must not independently approve content merely because its manifest is valid.

5. Fee accuracy and verification

Education fees and related costs may vary by institution, campus, programme, academic year, intake, admission category, residency status, quota, and applicable regulations.

Before approving a guide for publication:

1. Consult the latest relevant official fee schedule, prospectus, or written notification.
2. Check the relevant regulator or counselling authority where applicable.
3. Separate tuition, admission charges, deposits, accommodation, and other expenses.
4. Identify the academic year, currency, payment period, and applicable student category.
5. Record the source URLs and the dates on which the sources were reviewed.
6. Distinguish official charges from estimates, projections, and historical figures.
7. Check refundability and conditions against the applicable written policy.
8. Do not invent fee amounts, deadlines, refund terms, source URLs, or verification dates.
9. Recheck time-sensitive claims before publication and when the next review is due.

A source URL alone is not proof of verification. A guide may be marked verified only when the relevant source has actually been reviewed and the required evidence has been recorded.

Use verification labels precisely. Checking an official source does not mean the entire guide is officially issued, endorsed, or approved by that authority.

6. Financial safety

All guides should encourage users to:

* Confirm payment instructions using independently obtained official contact details.
* Use payment channels confirmed by the relevant institution or provider.
* Obtain official receipts and retain transaction records securely.
* Review written refund and cancellation terms before paying.
* Verify an education agent’s authorization directly with the institution.
* Avoid sending money to personal accounts solely at an agent’s request.
* Never disclose passwords, one-time passwords, card security codes, or banking credentials.
* Verify loan interest rates, processing fees, repayment schedules, collateral requirements, and co-borrower obligations directly with the lender.

MedOrbits must not claim that an institution, agent, lender, scholarship, or payment channel has been verified unless the relevant checks have actually been completed and documented.

7. Recommended cost breakdown

Where relevant, each guide should explain the following cost categories separately:

* Tuition and recurring academic charges.
* Admission, application, registration, and enrolment charges.
* Refundable and non-refundable deposits.
* Examination, laboratory, library, and student-service charges.
* Hostel or rental costs, utilities, and food.
* Transport, books, equipment, insurance, and other living expenses.
* Scholarships, grants, sponsorships, and education loans.
* Payment deadlines and accepted official payment methods.
* Refund, cancellation, deduction, and appeal procedures.

Clearly distinguish one-time, annual, semester, monthly, optional, estimated, and officially published amounts. Do not add amounts with different payment periods without explaining the calculation and assumptions.

When estimates are used, label them clearly, state the relevant location and period where known, and explain that actual costs may differ.

8. Privacy and security

This directory is intended for approved public resources only. Never publish:

* Personal financial records or transaction receipts.
* Completed applicant forms or confidential student records.
* Identity documents or sensitive personal information.
* Passwords, API keys, access tokens, or other credentials.
* Private institutional or third-party information without authorization.

Before publication, inspect PDF metadata and embedded content, validate the actual file type, scan for malware, and verify PDF integrity. Review comments, hidden content, attachments, embedded files, and metadata for unintended disclosures.

Public asset paths are not access-controlled storage. Any confidential documents or user-specific records must be stored and served through an appropriately secured system rather than this public directory.

9. PDF quality assurance

Before changing a resource to published, complete and record the applicable checks.

File and path checks

* Confirm that the PDF exists at the manifest’s configured path and is non-empty.
* Validate the actual file signature and PDF structure; do not rely solely on its extension or declared MIME type.
* Enforce the configured maximum file size.
* Confirm that the filename, title, manifest entry, and deployed path agree.
* Ensure the resolved path remains inside the approved document directory.
* Calculate the SHA-256 checksum from the final file and compare it with the manifest value.
* Confirm that the deployed download URL works.

Content and verification checks

* Confirm that editorial and subject-matter reviews are complete.
* Check official sources where the content requires verification.
* Confirm that time-sensitive claims have valid review or verification dates.
* Check currency, academic year, fee amounts, and payment periods.
* Review refund, loan, scholarship, and cancellation terms.
* Confirm that sources support the claims made in the guide.

Document quality and security checks

* Review metadata, hyperlinks, tables, typography, and print layout.
* Check text readability and accessibility.
* Inspect embedded files, comments, hidden content, and metadata for unintended disclosures.
* Scan the file for malware using the configured security process.
* Confirm that the final deployed file is the same version that was reviewed.

Catalogue synchronization

* Validate the manifest against assets/schemas/fee-guides.schema.json.
* Check duplicate document IDs, filenames, and paths.
* Check category IDs and all relatedDocumentIds references.
* Regenerate assets/data/fee-guides.json.
* Confirm that the generated catalogue exposes active download links only for eligible published resources.

Schema validation does not prove that a PDF exists, is accurate, is accessible, or has been scanned. These are separate checks and must not be treated as interchangeable.

10. Website integration

The following example illustrates a download link. Use it only when the resource has been approved, published, and confirmed to exist at the deployed path.

<a href=“/assets/documents/fee-guides/education-fee-guide.pdf”>
  Download the Education Fee Guide (PDF)
</a>

This example assumes the website serves the assets/ directory from the root URL. Adjust the URL if production uses a different base path.

The application catalogue at assets/data/fee-guides.json must be generated from MANIFEST.json. The application should:

1. Validate the manifest during the build or publication process.
2. Include only resources whose status is published and whose required file checks have passed.
3. Generate active download URLs only for eligible resources.
4. Handle missing, unavailable, or withdrawn resources gracefully.
5. Exclude unpublished resources from public sitemaps and public download listings.
6. Avoid displaying verification or official-endorsement claims that are not supported by recorded evidence.

Frontend filtering is not a security boundary. If uploads, approvals, or publication status can change dynamically, enforce authorization and publication rules on the server as well.

11. Related-document integrity

Every value in relatedDocumentIds must reference an existing document id in the same manifest, unless the schema explicitly defines a different reference scope.

Automated validation should detect:

* Duplicate document IDs.
* Duplicate filenames or conflicting file paths.
* Undefined category IDs.
* Missing related-document references.
* Self-references, where they are not explicitly allowed.
* Invalid status values.
* Published resources without required file metadata or verification evidence.
* Paths that escape the approved document directory.
* Disagreement between the manifest and generated application catalogue.

Validation should report actionable errors and fail the publication build when required checks do not pass.

12. Maintenance and versioning

Review time-sensitive information when official notices, fee schedules, eligibility rules, or policies change. Update review dates only after the relevant review has actually occurred.

Keep the manifest, generated catalogue, README, schema, and actual PDF files synchronized. Use deterministic generation so repeated builds from the same inputs produce consistent catalogue output.

Preserve previous versions when required for auditability, but do not promote outdated versions as current guidance. Record meaningful manifest and document changes in version control, and ensure a published checksum corresponds to the final approved file.

13. Disclaimer

These guides provide general educational and financial-planning information. They are not financial, legal, tax, or investment advice. They do not guarantee admission, scholarships, loan approval, fee amounts, or refunds. Requirements and charges can change without notice. Confirm current costs, eligibility, deadlines, and conditions with the relevant institution, counselling authority, scholarship provider, lender, or government authority before making financial commitments.

⸻

Maintained by: MedOrbits
Directory: assets/documents/fee-guides/
Authoritative manifest: assets/documents/fee-guides/MANIFEST.json
Application catalogue: assets/data/fee-guides.json