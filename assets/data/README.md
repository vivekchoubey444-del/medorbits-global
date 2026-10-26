MedOrbits — Data Directory & Governance Guide

File: assets/data/README.md
Project: MedOrbits
Website: https://www.medorbits.in/
Documentation version: 1.2.0
Data baseline: 2026-10-24
Directory: assets/data/
Encoding: UTF-8
Data format: JSON

⸻

1. Purpose and scope

The assets/data/ directory contains structured public reference data used by MedOrbits education, admissions, institution discovery, scholarship, examination, and career services.

Its purpose is to provide maintainable, source-linked information about real institutions, recognised authorities, official programmes, published schemes, examinations, and public resources.

The directory supports:

* College and university discovery.
* Course and programme catalogues.
* Admissions and counselling guidance.
* Entrance examination references.
* Scholarship discovery.
* College fee and medical seat-matrix workflows.
* Employment, recruitment, and career information.
* Location-based filtering and international study discovery.
* Static website deployment and future API integration.

Core objectives

1. Maintain factual accuracy and traceable sources.
2. Separate verified claims from unverified references.
3. Preserve unknown values instead of inventing them.
4. Identify the applicable academic year, quota, category, or counselling round.
5. Prevent stale information from appearing current.
6. Maintain stable identifiers and compatible schemas.
7. Validate datasets automatically before publication.
8. Keep public reference data separate from private applicant information.
9. Document coverage limitations and data-maintenance responsibilities.

Scope exclusions

This directory is for public, non-sensitive reference information. It must not be used to store:

* Applicant submissions or personal application records.
* Identity documents, passport scans, or signatures.
* Medical records or private financial documents.
* Passwords, access tokens, API secrets, or session credentials.
* Confidential administrative information.
* Private payment details or authentication data.

Publication rule: Assume that every file under assets/data/ can be downloaded and inspected by any website visitor.

⸻

2. Dataset inventory

The following is the expected dataset inventory. It is a documentation reference, not confirmation that every file currently exists in the repository.

File	Responsibility
admission-processes.json	Admission, counselling, and application-process references
college-fees.json	Institution-specific fees with applicable academic years and sources
colleges.json	General higher-education institution directory
countries.json	Country information and official education or immigration resources
courses.json	Degree, diploma, and professional programme categories
documents.json	Public document checklists and issuing-authority references
entrance-exams.json	Entrance examinations and official examination portals
job-categories.json	Job families, career fields, and occupation categories
jobs.json	Recruitment portals and individually verified vacancy records
locations.json	Indian cities, states, and geographic filtering data
medical-colleges.json	Medical institution references and relevant regulator or counselling links
official-resources.json	Official education, examination, regulatory, counselling, and employment resources
scholarships.json	Scholarship schemes and official application resources
seat-matrix.json	Seat-matrix references and verified seat records
universities.json	Indian and international university directory references

Inventory maintenance rules

* Confirm the actual directory contents before describing the inventory as complete.
* Do not create duplicate datasets for the same information without documenting the reason.
* Assign each dataset a distinct purpose.
* Use stable identifiers and explicit references when records overlap.
* Do not claim national or global completeness without a defined coverage methodology.
* Update this inventory whenever a dataset is added, removed, renamed, or repurposed.
* Document schema changes and update affected consumers.

⸻

3. Non-negotiable data principles

3.1 Real entities and evidence-backed claims

A real institution name is not sufficient evidence for every claim associated with that institution.

Examples:

* An official website can establish an institution’s identity and provide its published contact information.
* A current regulatory record may be required to establish recognition or approval.
* A current counselling matrix may be required to establish seat availability.
* An official fee order may be required to establish a payable amount.
* A current recruitment notification is required to support an advertised vacancy and deadline.
* Official scholarship guidelines are required to support scheme-specific eligibility and award information.

Every important claim must be supported by a source appropriate to that claim.

3.2 Unknown values must remain unknown

Use JSON null for unknown or unconfirmed values when the schema permits it.

Examples include:

* Current tuition and hostel fees.
* Refundable deposits and other charges.
* Current sanctioned intake or counselling seat counts.
* Application deadlines.
* Scholarship award amounts.
* Salary ranges.
* Current vacancy status.
* Regulatory approval status.
* Unconfirmed contact details.
* Unverified eligibility requirements.

Do not substitute 0, an empty string, an estimate, or an outdated value for unknown information.

A zero is meaningful only when an authoritative source explicitly establishes zero.

3.3 No false completeness

A dataset containing a limited number of institutions is a partial directory unless complete coverage has been established.

Avoid unsupported descriptions such as:

* All Indian colleges.
* Complete national seat matrix.
* All active jobs.
* Every available scholarship.
* All recognised international universities.

Describe coverage honestly, including geographic, institutional, academic-year, and source limitations where relevant.

3.4 No false authority

MedOrbits must not imply that it is a government authority, regulator, counselling body, university, scholarship administrator, immigration authority, or employer unless the relevant authorisation exists and is accurately described.

Official authorities remain the final source for admissions decisions, regulatory status, fees, eligibility, vacancies, and deadlines.

⸻

4. Source hierarchy and provenance

Use the strongest available source for the specific claim being recorded.

Tier 1 — Primary official sources

Prefer:

* Government departments and official government portals.
* Statutory regulators.
* Official counselling authorities.
* Official examination authorities.
* Official university and institutional websites.
* Official prospectuses, notifications, fee orders, and seat matrices.
* Official scholarship scheme guidelines.
* Official employer recruitment notifications.
* Official immigration and education authorities.

Tier 2 — Authoritative supporting sources

Use when primary information is unavailable or an independent cross-check is needed:

* Government-maintained directories.
* Officially published institutional documents.
* Other authoritative public records with traceable provenance.

Tier 3 — Secondary sources

News articles, commercial directories, aggregators, blogs, and social media may help identify a potential record.

They must not independently establish high-impact, time-sensitive claims when an appropriate authoritative source is required.

If an authoritative source cannot be located, leave the affected claim unverified and document the limitation.

Official starting points

Authority or resource	Official URL
National Medical Commission	https://www.nmc.org.in/
Medical Counselling Committee	https://mcc.nic.in/
West Bengal Medical Counselling Committee	https://wbmcc.nic.in/
Uttar Pradesh NEET counselling	https://upneet.gov.in/
National Testing Agency	https://nta.ac.in/
University Grants Commission	https://www.ugc.gov.in/
National Scholarship Portal	https://scholarships.gov.in/
National Career Service	https://www.ncs.gov.in/
Study in India	https://www.studyinindia.gov.in/
International Association of Universities / WHED	https://iau.global/World-Higher-Education-Database-WHED

These links are starting points, not evidence that a specific claim is current. Locate and review the relevant official page, document, academic year, and conditions before publication.

Source provenance requirements

For each important claim, retain the applicable information supported by the dataset schema:

* Source URL.
* Source type.
* Verification status.
* Last verification date.
* Academic year or validity period.
* Publication date, when available.
* Relevant quota, category, programme, or counselling round.
* Notes explaining limitations or conflicting evidence.

Do not add these fields indiscriminately to every dataset. Define them in the relevant schema and update all consumers consistently.

⸻

5. Verification model

5.1 Distinguish source type from claim status

An official source and a verified claim are not the same thing.

For example, an institution record may link to its official website while its current regulatory approval remains unverified.

Use separate fields when the schema supports them:

* sourceType: type of source used.
* verificationStatus: verification state of the relevant claim.
* lastVerifiedAt: date on which the claim was checked.
* sourceUrl: supporting source.
* academicYear: applicable academic period, where relevant.

5.2 Recommended verification statuses

Status	Meaning
verified	The specific claim has been checked against an appropriate source
official-source	An official source is linked; not every associated claim is necessarily verified
official-website-reference	The institution’s official website has been identified
official-process-reference	An official process source is linked; current-cycle details may need rechecking
needs-current-fee-order	The fee requires confirmation against the applicable official fee order
needs-current-matrix	Seat information requires confirmation against the applicable official matrix
check-official-portal	Current status must be checked on the relevant official portal
unverified	The claim has not been sufficiently verified
expired	A time-limited record has expired and must not be presented as active

These values are proposed conventions. A status label does not prove that verification occurred.

If the application already uses different values, document and migrate the schema consistently instead of silently changing production data.

5.3 Verification dates

* Use ISO 8601 calendar dates in YYYY-MM-DD format.
* Record when the specific claim was checked.
* Do not treat generatedOn as the verification date of every record.
* Do not automatically mark records as verified when regenerating a dataset.
* Recheck time-sensitive claims before presenting them as current.
* If verification cannot be completed, use an appropriate unverified or recheck status.

⸻

6. Metadata and record conventions

Each dataset must have a documented structure compatible with its purpose.

Where appropriate, use a top-level metadata object and a records array.

Illustrative structure

This example documents the structure only. It is not a substitute for actual dataset records.

{
  “metadata”: {
    “schemaVersion”: “1.0.0”,
    “dataset”: “courses”,
    “description”: “Public education programme reference data.”,
    “defaultCountryCode”: “IN”,
    “currency”: “INR”,
    “dateFormat”: “YYYY-MM-DD”,
    “generatedOn”: “2026-10-24”,
    “verificationPolicy”: “Source-backed claims; unknown values remain null.”,
    “notes”: []
  },
  “records”: []
}

Metadata fields

Field	Purpose
schemaVersion	Version of the dataset schema
dataset	Stable dataset identifier
description	Concise explanation of the dataset
defaultCountryCode	Default country context, where appropriate
currency	Currency used for monetary values, where applicable
dateFormat	Documented calendar-date representation
generatedOn	Dataset generation or maintenance date
verificationPolicy	Summary of source and verification rules
notes	Coverage limitations and maintenance notes

Optional metadata may be omitted when it does not apply.

Record conventions

Depending on the dataset, a record may need:

* A stable identifier.
* Entity name and type.
* Country, state, and city.
* Official website.
* Supporting source URL.
* Source publication date.
* Verification date and status.
* Academic year.
* Applicable course, quota, category, or round.
* Validity period or record status.

Use only fields appropriate to the dataset. Define required fields, types, allowed values, and nullability in the relevant schema.

⸻

7. Identifiers and cross-dataset relationships

Stable identifiers allow records to be connected safely across the application.

Rules:

1. Use a unique, predictable identifier within each dataset.
2. Document whether identifiers are unique per file or across the entire application.
3. Preserve identifiers when correcting spelling, URLs, or other attributes.
4. Avoid deriving identifiers solely from mutable display names.
5. Use explicit references for relationships between records.
6. Do not match institutions solely by similar names.
7. Distinguish a university from its campuses, affiliated colleges, and teaching locations.
8. Maintain a documented duplicate-resolution process.

For example, a college identifier should not automatically change when its official name or website changes. Update the record while preserving identity where appropriate.

Before introducing new identifier conventions, check compatibility with existing frontend lookups and cross-file references.

⸻

8. Dates, academic years, currencies, and amounts

* Store calendar dates as YYYY-MM-DD.
* Store timestamps in a documented ISO 8601 format with a defined timezone policy.
* Represent academic years separately from calendar dates.
* Use IN for India when a country code is required.
* Use INR for Indian rupee amounts.
* Use JSON numbers for numeric monetary values when calculations are required.
* Keep unknown values as null when permitted.
* Store display formatting in the presentation layer.
* Identify whether a fee is annual, semester-based, monthly, one-time, or per course.
* Distinguish tuition, hostel charges, deposits, examination fees, and other charges.

Do not compare amounts from different academic years or fee categories without making the differences explicit.

Do not use a numeric value without documenting its unit or payment period.

⸻

9. College fees

college-fees.json requires strict verification because fees may vary by academic year, programme, quota, category, institution, and student type.

Before publishing a fee:

1. Locate the applicable official fee order, prospectus, or institution-issued notice.
2. Confirm the institution and programme.
3. Confirm the academic year.
4. Identify the relevant quota, category, and student type.
5. Separate tuition from hostel charges, deposits, examination fees, and other costs where the source permits.
6. Record the source URL and verification date.
7. Document the payment period and whether the amount is recurring or one-time.
8. Leave unconfirmed amounts as null.

Additional rules:

* Do not present historical fees as current.
* Do not describe a partial fee as the total cost of attendance.
* Do not invent a fee breakdown when the source provides only a combined amount.
* Do not infer a refund policy from the existence of a deposit.
* Do not assume fees are identical across quotas or categories.

⸻

10. Medical colleges and seat matrices

medical-colleges.json and seat-matrix.json must distinguish institution identity from regulatory status and actual seat availability.

Seat verification procedure

1. Locate the relevant official seat matrix.
2. Confirm the counselling authority.
3. Confirm the academic year.
4. Identify the applicable round, where relevant.
5. Match the institution and programme exactly.
6. Identify quota, category, and other applicable dimensions.
7. Verify the count against the official document.
8. Record the source URL and verification date.
9. Recheck the record when a revised matrix is published.

Medical institution claims

Where applicable, distinguish:

* Institution identity.
* Official institution website.
* Course availability.
* Regulatory recognition or approval.
* Approved annual intake.
* Counselling participation.
* Seat availability for a specific round.

These are separate claims and may require different sources.

A college appearing in a directory does not prove that every course is currently approved or available for admission.

Null-seat rule: seatCount: null means unknown, not zero. It must not be displayed as a confirmed vacancy or used in a calculation of available seats.

Approved annual intake and counselling-round vacancies must not be treated as interchangeable.

⸻

11. Entrance examinations and admission processes

For each examination or admission process, identify the official authority and the source applicable to the relevant cycle.

Where applicable, verify:

* Examination name and administering body.
* Official information bulletin.
* Eligibility conditions.
* Application portal.
* Examination or counselling year.
* Application opening and closing dates.
* Fee information.
* Required documents.
* Counselling stages.
* Official notices and revisions.

Admission workflows may change each cycle.

Distinguish general educational guidance from current-cycle instructions. Never invent deadlines, eligibility conditions, application steps, or required documents to make a workflow appear complete.

⸻

12. Scholarships

Scholarship records must be checked against the current official scheme guidelines and application portal.

Where applicable, verify:

* Scheme name and administering authority.
* Eligible student groups.
* Eligible courses and institutions.
* Income and merit requirements.
* Award amount and covered expenses.
* Application opening and closing dates.
* Renewal conditions.
* Required documents.
* Official application portal.
* Applicable academic year.

The existence of a scholarship does not establish that applications are open or that a particular student qualifies.

Do not promise eligibility, approval, or an award outcome. These decisions belong to the responsible scheme authority.

⸻

13. Jobs and recruitment

jobs.json may contain official recruitment portals, employer career pages, or individual vacancy announcements.

A recruitment portal is not a vacancy. An individual record must not be presented as active unless its status is supported by current evidence.

For an individual vacancy, record supported information such as:

* Employer and job title.
* Official vacancy notice.
* Official application URL.
* Publication date, when available.
* Application deadline.
* Location and employment type.
* Salary, only when stated by the source.
* Eligibility and required qualifications.
* Verification status.
* Last-checked date.

Expiry and closure

* Recheck vacancies before displaying them as open.
* Mark expired records as expired or remove them under the documented retention policy.
* Never extend a deadline without an official revised notice.
* Do not infer that a vacancy is open because an application URL still loads.
* Do not manufacture salaries, employers, experience requirements, or application dates.

When the current status cannot be confirmed, link to the official recruitment portal and explain that vacancy status must be checked.

⸻

14. Countries, universities, and locations

Country and location datasets support discovery and filtering. They do not establish that every destination, institution, or programme is suitable for every student.

Where applicable:

* Use consistent country codes.
* Distinguish countries from cities, states, provinces, and other regions.
* Link to official education, immigration, and government resources.
* Use institution-issued names and official URLs where available.
* Do not invent postal addresses or contact information.
* Distinguish universities from campuses, affiliated colleges, and teaching locations.
* Document partial geographic coverage.

For international study guidance, an official university website or immigration portal does not independently establish professional licensing eligibility or recognition in another country. Verify those claims with the relevant authority.

For Indian universities and colleges, check the applicable UGC category and any relevant professional regulator. For international institutions, use the relevant national education authority and qualification-recognition requirements.

⸻

15. Documents and privacy

documents.json describes public document categories, checklists, and issuing authorities. It must not contain actual applicant documents.

Never store the following in public static datasets:

* Identity documents or passport scans.
* Personal signatures.
* Medical records.
* Private financial documents.
* Applicant-specific application forms.
* Passwords, API secrets, or access tokens.
* Confidential administrative records.

Private uploads must use approved private storage and appropriate backend access controls.

Public checklists may describe which document is required, but must never contain the document itself.

Do not publish personal information merely because it appeared in an uploaded file or application form.

⸻

16. URL and source integrity

For each source URL:

1. Prefer the relevant official page or document over a generic homepage.
2. Use HTTPS when the source supports it.
3. Verify that the domain belongs to the intended authority or institution.
4. Confirm that the source supports the associated claim.
5. Do not invent document paths, query parameters, or application links.
6. Record the source publication date when available.
7. Recheck links that redirect, fail, or point to outdated material.

A syntactically valid URL is not necessarily an official source. An official domain does not automatically support every claim associated with a record.

When an official source moves or a document is replaced, update the source reference and preserve an audit trail where supported by the project.

⸻

17. JSON syntax and validation

Every .json file must parse as valid JSON and conform to its documented schema.

17.1 Validate a single file

python -m json.tool assets/data/courses.json

This checks JSON syntax and prints formatted JSON. It does not verify factual accuracy or enforce a project-specific schema.

17.2 Validate all JSON files in the directory

If the repository does not already have an equivalent validator, save the following as scripts/validate-assets-data.py.

#!/usr/bin/env python3
“””
MedOrbits JSON Validator
Validates JSON syntax in assets/data/.
Does not modify project data or verify factual claims.
Compatible with Python 3.10+.
Uses only the Python standard library.
“””
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / “assets” / “data”
def main() -> int:
    if not DATA_DIR.is_dir():
        print(f”ERROR: Data directory not found: {DATA_DIR}”)
        return 2
    files = sorted(DATA_DIR.glob(“*.json”))
    if not files:
        print(f”ERROR: No JSON files found in {DATA_DIR}”)
        return 1
    errors = []
    for path in files:
        try:
            with path.open(“r”, encoding=“utf-8”) as handle:
                json.load(handle)
            print(f”OK: {path.relative_to(ROOT)}”)
        except (
            OSError,
            UnicodeError,
            json.JSONDecodeError,
        ) as exc:
            errors.append(
                f”{path.relative_to(ROOT)}: {exc}”
            )
    print(f”\nChecked {len(files)} JSON file(s).”)
    if errors:
        print(“\nValidation errors:”)
        for error in errors:
            print(f”- {error}”)
        return 1
    print(“All JSON files are syntactically valid.”)
    return 0
if __name__ == “__main__”:
    sys.exit(main())

Run from the repository root:

python scripts/validate-assets-data.py

This validator checks JSON syntax only. It does not verify source authenticity, schema conformity, record uniqueness, cross-file references, or factual accuracy.

If the project already has a validator, inspect and extend the existing implementation rather than introducing a duplicate script.

17.3 Recommended automated integrity checks

Where supported by the dataset schema, validate:

* Required fields and permitted data types.
* Unique record identifiers.
* Supported verification statuses.
* Date and timestamp formats.
* URL syntax.
* Country and currency codes.
* Academic-year consistency.
* Cross-file references.
* Duplicate or conflicting institution records.
* Missing sources for claims requiring evidence.
* Missing verification dates for time-sensitive claims.
* Fee records without an applicable academic year.
* Seat counts without a supporting source and year.
* Expired vacancy records.
* Unsupported fields and accidental disclosure of sensitive data.

Structural validation establishes consistency, not factual correctness. High-impact claims still require source review.

⸻

18. Data lifecycle and freshness

Apply review intervals and triggers appropriate to each dataset. Do not assume every type of information changes at the same rate.

Data type	Review trigger
Institution identity and official website	Reported change, broken link, or scheduled review
Regulatory recognition and course approval	New regulatory notice or relevant admission cycle
Fees	New fee order, prospectus, or academic year
Seat matrices	New or revised official matrix or counselling round
Entrance examinations	New information bulletin or examination cycle
Admission processes	New official instructions or counselling cycle
Scholarships	Revised guidelines or application cycle
Individual vacancies	Deadline, closure notice, or status recheck
Recruitment portals	Broken link or portal change
Country and visa resources	Official policy change or scheduled review

These are review triggers, not guarantees that a record remains accurate until a particular date.

Stale-record workflow

When a record becomes stale:

1. Recheck the authoritative source.
2. Update only the affected fields supported by the source.
3. Record the verification date.
4. Change the verification status if necessary.
5. Remove or clearly mark information that is no longer valid.
6. Check the website pages and scripts consuming the record.

Never silently carry a time-sensitive value into a new academic year.

⸻

19. Public-data security

Because the files may be served as static website assets:

* Never store secrets in JSON files.
* Never commit .env contents, credentials, private API keys, or session tokens.
* Exclude private applicant data and internal administrative notes.
* Do not use a public static file as an access-control mechanism.
* Avoid exposing protected internal endpoints or storage paths.
* Review changes for accidentally committed sensitive information.
* Keep administrative and applicant-specific data in the appropriate protected backend.

A field is not private merely because it is not displayed on the homepage. If it is shipped to a visitor’s browser, it may be accessible to that visitor.

⸻

20. Frontend integration requirements

Pages consuming these datasets must handle incomplete information safely.

* Treat null as unknown.
* Do not render missing numeric values as zero.
* Do not show unverified information as confirmed.
* Display the applicable academic year beside time-sensitive information.
* Distinguish official links from MedOrbits guidance.
* Handle missing optional fields and empty search results.
* Avoid breaking an entire page because one record is incomplete.
* Escape untrusted text before inserting it into HTML.
* Do not construct executable JavaScript from dataset content.
* Use stable identifiers rather than array positions for relationships.
* Do not infer course availability or eligibility from an institution’s presence in a directory.

When changing a schema, update the relevant frontend code, validation rules, tests, and documentation together.

⸻

21. Change management

For every data change:

1. Identify the exact claim being changed.
2. Locate the appropriate authoritative source.
3. Verify the institution, programme, year, category, or scheme.
4. Update only the fields supported by that source.
5. Preserve unknown values as null.
6. Record provenance and verification metadata.
7. Run JSON syntax and schema validation.
8. Check cross-file references and duplicate records.
9. Review for privacy and security issues.
10. Test the affected website pages.
11. Update the documentation if the directory or data conventions change.
12. Review the final diff before committing or publishing.

Do not overwrite a verified value with an unverified value simply because a newer secondary source reports something different. Investigate the discrepancy and document the resolution.

⸻

22. Versioning and compatibility

Use a documented versioning convention for dataset schemas.

* Major version: Incompatible schema or consumer-facing change.
* Minor version: Backward-compatible addition or enhancement.
* Patch version: Backward-compatible schema documentation or validation correction.

Data corrections should preserve relevant source and verification metadata.

Before changing a field name, data type, identifier, or relationship:

1. Search for all consumers of the field.
2. Update the schema and validation logic.
3. Update affected frontend components and tests.
4. Preserve compatibility where practical.
5. Document any required migration.
6. Test existing records against the new schema.

Changing the documentation alone does not make a schema migration safe.

⸻

23. Maintenance responsibilities

The person or role maintaining a dataset is responsible for ensuring that:

* Important claims have appropriate sources.
* Verification labels accurately describe the evidence.
* Unknown information remains unknown.
* Time-sensitive information is rechecked.
* Schema changes are documented.
* Validation passes before publication.
* Private information is excluded.
* Source URLs remain useful.
* Outdated records are handled consistently.
* The documentation reflects the actual repository.

Do not invent a named owner or team where responsibility has not been formally assigned. Document the responsible role when established.

⸻

24. Limitations and disclaimer

MedOrbits provides education, admissions, scholarship, institution, and career information.

Unless expressly authorised and accurately identified, MedOrbits is not the regulator, counselling authority, university, scholarship administrator, immigration authority, or employer responsible for the information.

Information published in these datasets is not a guarantee of:

* Admission or eligibility.
* Regulatory recognition.
* Scholarship approval or payment.
* Employment or vacancy availability.
* Fees or total cost of attendance.
* Seat availability or counselling outcomes.

Users should confirm decisions, eligibility, payments, and deadlines with the responsible official authority and the applicable current notification.

A link to an official source does not guarantee that every associated MedOrbits field has been verified. A verification label must never replace evidence.

⸻

25. Release checklist

Before publishing changes to assets/data/, confirm:

* [ ]	All JSON files parse successfully.
* [ ]	Every record represents a real entity or a clearly documented reference.
* [ ]	Important claims have appropriate supporting sources.
* [ ]	Unknown values have not been fabricated.
* [ ]	Verification statuses are used consistently.
* [ ]	Fees and seat counts identify the applicable year and source.
* [ ]	Vacancy records are not falsely described as active.
* [ ]	Cross-file references are valid.
* [ ]	Record identifiers are unique within their documented scope.
* [ ]	Public files contain no secrets or applicant documents.
* [ ]	Affected pages handle missing data correctly.
* [ ]	Schema and consumer changes are compatible.
* [ ]	The documentation matches the actual repository.
* [ ]	The final changes have been reviewed before publication.

⸻

26. Official project reference

MedOrbits — Education · Admissions · Careers · Recruitment

* Website: https://www.medorbits.in/
* Data directory: assets/data/
* Governance guide: assets/data/README.md

Maintenance principle: Publish only what the evidence supports. Preserve what is unknown. Recheck what can change.