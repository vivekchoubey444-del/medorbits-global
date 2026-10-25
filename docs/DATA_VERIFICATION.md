MedOrbits — Data Verification Policy

File: docs/DATA_VERIFICATION.md
Project: MedOrbits
Version: 1.0.0
Status: Verification policy
Applies to: Public datasets, official documents, admissions, examinations, institutions, fees, scholarships, careers, jobs, notifications, and consultancy content.

⸻

1. Purpose

This document defines how MedOrbits collects, validates, verifies, publishes, updates, and retires information displayed across its website and services.

MedOrbits covers education, medical admissions, examination resources, colleges, universities, scholarships, careers, study-abroad opportunities, official documents, and consultancy services. Some of these areas contain time-sensitive information that can materially affect a student’s decisions.

The purpose of this policy is to ensure that published information is:

* Traceable to an identifiable source.
* Accurate to the extent reasonably established through verification.
* Clearly distinguished from estimates, opinions, and general guidance.
* Updated according to its risk and rate of change.
* Corrected promptly when an error is identified.
* Presented without implying government affiliation or official endorsement where none exists.

Core rule: MedOrbits must not present unverified information as confirmed, current, official, or guaranteed.

2. Scope

This policy applies to information published in:

* HTML pages and landing pages.
* JSON datasets and static assets.
* API responses and database records.
* Official-document resource catalogues.
* Admission and counselling guides.
* College and university profiles.
* Course eligibility, fee, and seat information.
* Examination dates, results, and notifications.
* Scholarships, recruitment, and job listings.
* Consultancy service descriptions.
* FAQs, articles, and educational content.
* Automated, AI-assisted, or externally imported content.

It also applies to content supplied by staff, contractors, contributors, data providers, and third-party integrations.

3. Verification principles

3.1 Authority first

Prefer the primary authority responsible for the information.

Examples include:

Information	Preferred source
Medical education regulations	National Medical Commission (NMC)
NEET UG examination information	National Testing Agency (NTA)
Medical counselling schedules and allotments	Relevant official counselling authority, including MCC or the applicable state authority
State counselling information	Relevant state counselling authority
University recognition and institutional notices	Relevant regulator or university
Government scholarships	Official government scholarship portal or administering department
Government recruitment	Official recruiting authority
Passport and identity-document requirements	Responsible government department
Visa and immigration rules	Official immigration authority or embassy/consulate
Tax, banking, or payment rules	Relevant official regulator or service provider

These examples identify source categories. The exact source must be appropriate to the specific claim, jurisdiction, course, and admission cycle.

3.2 Independent verification

A claim should be checked against the source responsible for it. A search-engine snippet, social media post, coaching website, or third-party news article is not sufficient evidence for a high-impact regulatory or admission claim when the primary source is available.

Secondary sources may help discover a notice or explain context, but they should not replace the responsible authority for consequential information.

3.3 Traceability

Each material claim should have a recorded source, verification date, and responsible reviewer or process.

3.4 No fabricated certainty

If a claim cannot be verified, do not fill the gap with a guess. Omit it, label it appropriately, or publish a clearly qualified explanation.

3.5 Transparency

Where practical, show the source, applicable academic year or cycle, last verification date, and relevant limitations to users.

4. Source classification

Classify sources according to their origin and reliability.

Classification	Description	Publication guidance
A — Primary official	Responsible government authority, regulator, institution, or service provider	Preferred for official and consequential claims
B — Authoritative supporting	Recognised institutional publication or directly relevant official explanatory material	Acceptable when suitable for the claim
C — Reputable secondary	Established publication or specialist source that cites evidence	Use for context; verify important claims independently
D — Unverified	Social media posts, anonymous submissions, unsupported claims, or untraceable copies	Do not publish as established fact

A source’s classification does not guarantee that every statement on it is correct. Check the source’s relevance, publication date, jurisdiction, and whether the material has been superseded.

5. Data categories and risk levels

Assign each dataset or claim a risk level based on the potential consequences of incorrect information.

Critical risk

Examples:

* Admission eligibility and counselling deadlines.
* Official examination dates, results, and allotments.
* Medical college recognition or approval status.
* Seat availability and official seat matrices.
* Fees and payment instructions that affect a student’s financial decisions.
* Identity-document, visa, and immigration requirements.
* Legal or regulatory obligations.

Required controls:

* Verify against the responsible primary source.
* Record the applicable year, cycle, jurisdiction, and source.
* Require a second review for high-impact publication or changes where operationally feasible.
* Clearly distinguish official statements from MedOrbits explanations.
* Correct or withdraw materially incorrect information immediately after confirmation.

High risk

Examples:

* College tuition and other charges.
* Scholarship eligibility and application windows.
* Recruitment deadlines and eligibility requirements.
* Institutional accreditation and recognition claims.
* Loan eligibility and financial-service terms.

Required controls:

* Prefer primary sources.
* Record verification evidence and date.
* Recheck before publication and at an appropriate recurring interval.
* Avoid presenting estimates as official amounts.

Moderate risk

Examples:

* General course descriptions.
* Career pathways.
* Study-abroad planning guidance.
* Institutional contact information.
* General document checklists.

Required controls:

* Use reliable sources.
* Review when changes are reported and on a defined schedule.
* Label recommendations and general guidance appropriately.

Low risk

Examples:

* General educational explanations.
* Stable descriptive content.
* Non-consequential presentation text.

Required controls:

* Check for factual errors and misleading claims.
* Review when relevant content or circumstances change.

A dataset may contain claims at different risk levels. Apply the strictest relevant control to each consequential claim rather than assigning one low-risk rating to the entire dataset.

6. Verification workflow

All material factual content should pass through a documented workflow.

<CodeBlock language=“mermaid” editable>
flowchart TD
    A[Identify Claim or Dataset]
    B[Classify Risk]
    C[Locate Responsible Source]
    D[Verify Source and Applicable Date]
    E[Record Evidence and Provenance]
    F[Validate Schema and Values]
    G{Verification Passed?}
    H[Review and Approve]
    I[Publish With Appropriate Metadata]
    J[Schedule Reverification]
    K[Hold, Qualify, Correct, or Reject]
    L[Monitor Changes and Reports]
A —> B —> C —> D —> E —> F —> G
G —>|Yes| H —> I —> J —> L
G —>|No| K
L —>|Change or error detected| A
</CodeBlock>

Step 1 — Identify the claim

Determine precisely what is being asserted.

For example, distinguish between:

* An institution appearing in a directory.
* An institution being recognised for a particular programme.
* A programme being approved for a specific academic year.
* A seat being available during a particular counselling round.

These are different claims and may require different evidence.

Step 2 — Establish applicability

Confirm the relevant:

* Academic year or admission cycle.
* Course and programme.
* Institution and campus.
* State, country, or jurisdiction.
* Counselling round or recruitment stage.
* Publication or effective date.

Do not apply a previous year’s notice automatically to a new cycle.

Step 3 — Inspect the source

Confirm that the source is authentic and relevant. Check the actual notice, circular, PDF, official webpage, or dataset rather than relying only on a search snippet.

Step 4 — Record evidence

Capture enough information to allow another reviewer to reproduce the verification.

Step 5 — Validate the data

Check required fields, data types, identifier uniqueness, date formats, URL validity, duplicate records, and internal consistency.

Step 6 — Review and approve

Apply the appropriate review level for the risk category. Record approval for critical claims and material changes where required by the workflow.

Step 7 — Publish

Publish only after the applicable verification and review requirements have passed. Display limitations and verification metadata where relevant.

Step 8 — Reverify

Schedule future checks according to the information’s rate of change and risk.

7. Verification metadata standard

Every important dataset should have metadata that identifies its origin, freshness, and verification status.

Recommended dataset metadata:

{
  “metadata”: {
    “schemaVersion”: “1.0.0”,
    “dataset”: “official-document-resources”,
    “generatedOn”: “2026-10-25”,
    “defaultCountryCode”: “IN”,
    “verificationPolicy”: “Verify consequential claims with the responsible primary authority.”,
    “lastReviewedAt”: null,
    “nextReviewAt”: null,
    “reviewStatus”: “pending”
  },
  “items”: []
}

This is a schema example, not a claim that any dataset has been reviewed. Set review dates and statuses only from actual verification records.

Recommended record-level fields

For datasets that contain independently verifiable claims, use appropriate fields such as:

Field	Purpose
id	Stable record identifier
title	Human-readable record title
sourceName	Name of the source organisation
sourceUrl	Direct source URL where available
sourcePublishedAt	Source publication date, if known
effectiveFrom	Start of applicability, if relevant
effectiveTo	End of applicability, if relevant
academicYear	Relevant academic year, if applicable
lastVerifiedAt	Last completed verification timestamp
nextReviewAt	Planned review timestamp
verificationStatus	Current verification state
reviewedBy	Reviewer identifier or responsible team
evidenceReference	Internal evidence or source-record reference

Do not populate unknown dates with invented values. Use null where the schema permits it, and explain the absence when it materially affects the claim.

Avoid exposing internal reviewer identities or private audit metadata publicly unless there is a clear operational reason.

8. Verification status vocabulary

Use a controlled vocabulary consistently across datasets and APIs.

Status	Meaning	Publication treatment
pending	Verification has not been completed	Do not present as verified
verified	Evidence supports the stated claim for the recorded scope and date	Publish with appropriate source and freshness metadata
needs_review	New information or an unresolved issue requires review	Qualify, restrict, or temporarily unpublish as appropriate
stale	The scheduled review date has passed or freshness is no longer established	Reverify before presenting as current
disputed	Credible sources conflict or a material challenge is unresolved	Clearly qualify or withhold the affected claim
rejected	The claim failed verification or is not suitable for publication	Do not publish as fact
archived	The record is retained for historical reference	Clearly label historical scope

A verified status is time- and scope-dependent. It does not establish that the information will remain current indefinitely.

Do not label information verified merely because its URL loads or its fields are syntactically valid.

9. Review frequency

Use risk-based review intervals as operational targets, not as proof that a record remains current until its next review.

Data category	Suggested review target
Active admission and counselling deadlines	Check frequently during the active cycle and before consequential updates
Examination notices, results, and schedules	Check on publication, before relevant user actions, and during active periods
Recognition, approvals, and seat matrices	Verify for the relevant programme and academic year
Fees and financial terms	Verify for the applicable academic year and before describing them as current
Scholarships and job vacancies	Check frequently while accepting applications
Official document links	Check periodically and when users report failures
Institutional contact details	Review periodically and when changes are reported
General education content	Review on a defined maintenance schedule
Stable explanatory content	Review periodically and when authoritative guidance changes

The content owner should set actual intervals according to risk, available resources, and observed change frequency. A high-impact claim may require verification immediately before publication even if a routine review was recently completed.

10. Special rules for admissions and medical education

Medical admissions information requires particular care because eligibility, counselling schedules, seat availability, and recognition status can vary by programme, academic year, institution, category, jurisdiction, and counselling round.

Required practices

* Identify the applicable admission cycle.
* Check the relevant official examination and counselling authorities.
* Verify whether the claim applies to MBBS, BDS, postgraduate medical education, AYUSH, or another programme.
* Distinguish national counselling from state counselling.
* Check the date and scope of official seat matrices and allotment notices.
* Separate published tuition fees from hostel charges, deposits, other mandatory charges, and estimates.
* Avoid guaranteeing admission, a seat, a rank, a scholarship, or an outcome.
* Clearly label historical cutoffs and past-year fee figures.
* Correct outdated deadlines and notices promptly.

Donor, management, and other quota claims

Any claim about a donor quota, management quota, special admission route, or eligibility exception must be checked against the applicable law, official counselling rules, institutional policy, and current admission-cycle documents.

Do not advertise an admission route as legitimate or guaranteed based solely on an intermediary’s statement or an informal document.

MedOrbits must not fabricate official letters, approvals, seat allocations, or authority-issued documents.

11. Official-document verification

Official-document pages should preserve the distinction between an original authority-issued resource and MedOrbits explanatory material.

For each resource, verify where applicable:

1. Issuing authority.
2. Official publication location.
3. Document title and identifier.
4. Publication date and effective date.
5. Relevant programme, jurisdiction, or academic year.
6. Whether the document has been superseded, withdrawn, or amended.
7. Whether a newer version is available.
8. Whether the destination URL points to the expected authority or resource.

Prefer direct links to the responsible authority’s website.

If a document is unavailable, do not reconstruct it and present the reconstruction as an original. A summary may be provided if it is clearly identified as a summary and accurately reflects the source.

12. Fees, scholarships, jobs, and financial claims

Fees

Record the source, currency, applicable year, programme, fee category, and any known exclusions. Distinguish official fees from estimates and consultancy charges.

Scholarships

Verify eligibility, application dates, award conditions, required documents, and the administering authority. Do not imply that a user qualifies without checking the applicable rules.

Jobs and recruitment

Check the recruiting organisation, official vacancy notice, application deadline, eligibility criteria, and application destination. Remove expired listings from active results or label them as historical.

Loans and financial services

Use the responsible lender or official regulator as the primary source for terms and eligibility. Do not promise approval, a credit score outcome, or a specific financial benefit.

13. Technical data validation

Source verification and technical validation are separate controls. A valid JSON file may contain false information, while a verified notice may be stored incorrectly.

Schema validation

Validate:

* Required fields.
* Field types.
* Allowed enum values.
* Unique identifiers.
* URL format.
* Date and timestamp formats.
* Relationships between records.
* Permitted null values.
* Dataset version compatibility.

Consistency checks

Where applicable, check:

* Duplicate institutions or notices.
* Invalid or contradictory dates.
* Conflicting statuses.
* Missing source references.
* Incorrect academic-year associations.
* Currency and fee-unit mismatches.
* Broken links.
* Inconsistent naming across datasets.
* Records that have passed their review date.

Safe publication

Reject malformed datasets before deployment. Keep private and internal data out of public assets. Avoid publishing secrets, internal notes, or sensitive personal information in JSON files.

14. Automated verification

Automation may assist with checking data quality, URL reachability, and scheduled reviews.

Useful automated checks include:

* JSON parsing and schema validation.
* Duplicate identifier detection.
* Required metadata checks.
* Broken-link checks.
* Stale-record detection.
* Date-range validation.
* Change detection for source pages or documents.
* Detection of missing provenance fields.
* Alerts when a critical record requires re-verification.

Automation has limitations. A successful HTTP response does not prove the page’s content is correct, and an automated text difference does not necessarily mean an official rule has changed.

Do not automatically mark critical claims as verified solely because a scheduled script completed successfully.

15. AI-assisted content

AI may assist with summarising official documents, organising datasets, drafting explanations, identifying inconsistencies, or proposing updates.

AI output must not be treated as evidence by itself.

For AI-assisted factual content:

1. Identify the underlying authoritative source.
2. Check claims against that source.
3. Preserve relevant dates, qualifications, and exceptions.
4. Review high-impact claims before publication.
5. Avoid invented citations, document identifiers, fees, deadlines, or eligibility rules.
6. Keep confidential data out of prompts unless its use is authorised and necessary.
7. Label generated estimates and interpretations appropriately.

AI must not fabricate official notices, government endorsements, regulatory approvals, admission confirmations, or verification records.

16. Correction and incident handling

When an error or material discrepancy is identified:

1. Record the affected claim or dataset.
2. Assess the potential impact on users.
3. Temporarily qualify, restrict, or remove the affected information when warranted.
4. Verify the correct information using an appropriate source.
5. Update the record and its verification metadata.
6. Record the correction and reason internally.
7. Notify affected users when appropriate and feasible.
8. Review the cause and improve the process to prevent recurrence.

For critical errors involving deadlines, eligibility, payments, safety, or legal obligations, prioritise immediate containment and correction.

Do not silently alter historical records where retaining a correction history is necessary for auditability.

17. Provenance and audit records

Maintain an internal record of material verification actions.

Recommended fields include:

* Record or dataset identifier.
* Claim reviewed.
* Source URL and source organisation.
* Source publication date, where known.
* Verification timestamp.
* Reviewer or automated process identifier.
* Verification outcome.
* Evidence reference.
* Previous and new values for material corrections.
* Reason for the change.
* Approval record, where required.

Audit records should be protected from unauthorised modification and retained according to a documented policy.

Do not store unnecessary personal data in verification logs.

18. User-facing disclosures

Where appropriate, pages should explain:

* Whether information is official or explanatory.
* Which authority is responsible for the original rule or notice.
* The relevant academic year or admission cycle.
* When the information was last checked.
* Whether amounts or dates are estimates.
* That users should confirm consequential decisions with the responsible authority.

MedOrbits is an independent information and consultancy platform unless a specific, documented legal relationship establishes otherwise. Do not imply that the platform is a government department, regulator, examination authority, university, or official counselling body.

19. Roles and responsibilities

Assign responsibilities according to the organisation’s actual staffing and workflows.

Role	Responsibility
Content contributor	Propose content and provide source references
Data reviewer	Verify claims, dates, scope, and evidence
Technical maintainer	Validate schemas, identifiers, and data integrity
Content approver	Approve high-impact publication or changes
Administrator	Manage access, publication controls, and incidents
System operator	Maintain automation, monitoring, backups, and deployment

A single person may perform more than one role in a small team. High-impact changes should receive independent review where operationally feasible.

20. Publication checklist

Before publishing a dataset, page, notice, or material update, confirm:

* [ ]	The claim is clearly defined.
* [ ]	The appropriate primary source has been identified.
* [ ]	The source is authentic and relevant to the claim.
* [ ]	The applicable year, jurisdiction, programme, and date have been checked.
* [ ]	The source and verification timestamp are recorded.
* [ ]	The dataset passes schema and consistency validation.
* [ ]	The content is not contradicted by a newer authoritative publication.
* [ ]	Estimates, historical values, and interpretation are clearly labelled.
* [ ]	High-impact content has received the required review.
* [ ]	No private information or credentials are exposed.
* [ ]	Publication metadata accurately represents the verification state.
* [ ]	A future review is scheduled where required.

21. Implementation roadmap

Recommended implementation order:

Phase 1 — Establish the baseline

* Inventory all JSON datasets and official-document pages.
* Identify the current source for each material claim.
* Add a standard metadata schema.
* Identify missing or outdated verification dates.
* Remove or qualify unsupported claims.

Phase 2 — Add technical controls

* Introduce schema validation.
* Add duplicate and stale-record checks.
* Add link validation and reporting.
* Establish controlled verification statuses.
* Add automated tests to the development and deployment workflow.

Phase 3 — Establish operational controls

* Assign content owners and reviewers.
* Define risk-based review intervals.
* Establish correction and escalation procedures.
* Maintain a verification log.
* Introduce alerts for critical or overdue records.

Phase 4 — Improve traceability

* Add structured source references to material claims.
* Preserve change history where appropriate.
* Track review outcomes.
* Evaluate automated change detection for high-impact official sources.

22. Definition of done

A dataset or consequential factual claim is ready for publication only when:

1. Its source is identifiable and appropriate.
2. Its scope and applicable date are established.
3. The evidence supports the claim.
4. Required technical validation passes.
5. Required review and approval are complete.
6. The verification status accurately reflects the evidence.
7. The next review or expiry handling is defined where applicable.

A missing requirement must be resolved, explicitly accepted as a documented exception, or reflected in a qualified or unpublished status.

⸻

Policy statement

MedOrbits prioritises traceability, source integrity, factual accuracy, and timely correction. Information that cannot be substantiated must not be presented as confirmed fact. Verification status must reflect the evidence actually reviewed, not an assumed level of confidence.

End of document.