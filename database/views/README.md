MedOrbits Database Views

Directory: database/views/
Project: MedOrbits — Education, Admissions, Careers & Recruitment
Database: PostgreSQL 14+
Purpose: Reusable, read-oriented SQL views for application reporting, job listings, operational dashboards, and administrative analytics.

1. Directory Structure

database/
└── views/
    ├── README.md
    ├── application-summary.sql
    └── job-summary.sql

Keep this documentation synchronized with the SQL definitions and actual database migrations.

2. Available Views

File	View	Purpose
application-summary.sql	medorbits.application_summary	Summarizes applications, applicant details, file counts, and status-history statistics.
job-summary.sql	medorbits.job_summary	Intended to summarize job listings, publication status, and application statistics after the actual job schema is verified.

Important: The application summary view previously provided uses the medorbits schema and expects the applications, users, application_files, and application_status_history tables. The job summary view is not yet implemented because the actual jobs table and job-application relationship have not been provided.

3. Application Summary View

File: database/views/application-summary.sql
View: medorbits.application_summary

Purpose

The application summary view consolidates application information with applicant details and reporting metrics.

Depending on the deployed definition, it includes:

* Application identifiers and application number.
* Applicant identifiers, name, email, phone, and account status.
* Application type, program, institution, and academic year.
* Workflow status and timestamps.
* Application version.
* Attached-file counts by scan status.
* Status-history counts and the most recent history timestamp.
* A derived workflow-stage label.

Dependencies

* medorbits.applications
* medorbits.users
* medorbits.application_files
* medorbits.application_status_history

The actual table and column definitions must match the deployed schema and migrations.

Example query

SELECT
    application_id,
    application_number,
    application_type,
    status,
    status_label,
    created_at
FROM medorbits.application_summary
ORDER BY created_at DESC, application_id DESC
LIMIT 25;

Applicant-scoped query

SELECT
    application_id,
    application_public_id,
    applicant_id,
    application_type,
    status,
    status_label
FROM medorbits.application_summary
WHERE applicant_id = $1
ORDER BY created_at DESC, application_id DESC
LIMIT 25;

Obtain the applicant ID from trusted server-side authentication context. Do not treat an arbitrary applicant ID supplied by a request as proof of ownership.

Privacy: This view includes applicant contact information. Grant access only to appropriately authorized database roles, and avoid returning unnecessary personal information through public APIs.

4. Job Summary View

File: database/views/job-summary.sql
Intended view: medorbits.job_summary

Purpose

The job summary view is intended to support career listings, employer dashboards, and recruitment reporting.

Depending on the actual schema, it may include:

* Job identifiers, title, slug, and description.
* Employer or company details.
* Employment type, work mode, and category.
* Experience requirements.
* Location and remote-work information.
* Salary range and currency.
* Vacancy count and publication dates.
* Application statistics.
* A derived listing-availability label.

Dependencies

The implementation requires confirmation of:

* medorbits.jobs
* The actual job-application relationship, such as a job_id foreign key.
* The status and timestamp fields used to count applications and classify listings.

The current core schema does not define a complete jobs table. Do not deploy a job summary view until its columns and relationships are verified.

Example query — after the view is implemented

SELECT
    job_public_id,
    job_title,
    company_name,
    employment_type,
    work_mode,
    city,
    state,
    salary_min,
    salary_max,
    salary_currency,
    application_deadline
FROM medorbits.job_summary
WHERE listing_availability = ‘open’
ORDER BY published_at DESC NULLS LAST, job_id DESC
LIMIT 25;

The column names above are proposed interface names, not confirmed columns. Update the query to match the actual view definition.

Employer reporting

Application counts and recruitment statistics may be confidential. Verify that the authenticated user is authorized to view statistics for the relevant employer or job before returning them.

5. Installation and Deployment

Apply views only after their dependency tables and columns exist.

Recommended sequence:

1. Back up the development or staging database.
2. Apply reviewed schema migrations.
3. Apply required constraints and indexes.
4. Verify table names, columns, foreign keys, and status values.
5. Apply the application summary view.
6. Apply the job summary view only after its implementation matches the actual jobs schema.
7. Test both views with representative data.
8. Verify database grants and API authorization.
9. Run integration tests before production deployment.

From the repository root, use a development or staging database:

psql “$DATABASE_URL” \
  -v ON_ERROR_STOP=1 \
  -f database/views/application-summary.sql

Run the job view only after its SQL has been completed and reviewed:

psql “$DATABASE_URL” \
  -v ON_ERROR_STOP=1 \
  -f database/views/job-summary.sql

Confirm that DATABASE_URL points to the intended database before executing either command. Avoid printing database credentials in logs or sharing them in source control.

6. View Design Principles

Read-oriented design

Views simplify reporting and repeated joins. Business operations such as submitting applications, changing status, approving candidates, and publishing jobs belong in the service layer and transactional workflows.

Authorization

A view does not automatically enforce user-level authorization.

* Scope applicant queries to the authenticated applicant.
* Restrict employer statistics to authorized employer accounts.
* Limit administrative reporting to appropriately privileged users.
* Apply least-privilege database grants.
* Consider row-level security where appropriate, with policies and connection handling tested carefully.
* Do not expose private applicant data through public career endpoints.

Data privacy

The application summary view may expose applicant email addresses and phone numbers. Use a restricted staff-facing view or an API projection that omits contact fields when they are unnecessary.

Public job listings should expose only information intended for public consumption. Keep internal recruitment notes, confidential employer information, and private applicant data out of public views.

Performance

* Index underlying join and filter columns where query plans justify it.
* Use EXPLAIN (ANALYZE, BUFFERS) on representative queries in a non-production environment.
* Measure the cost of aggregating application history and files.
* Consider materialized views only when stale data is acceptable and refresh behavior is documented.
* Remember that ordinary PostgreSQL views do not store query results; their underlying queries run when accessed.

7. Schema Compatibility

Before deployment, verify the following:

Component	Required verification
Application view	applications.applicant_id references users.id.
Application identifiers	View joins use the deployed application key type.
Application history	History rows reference the correct application key and status columns.
Application files	File rows reference the correct application key and scan-status values.
Job view	The jobs table and referenced fields exist.
Job applications	The application-to-job relationship is defined correctly.
Status values	Derived labels match the actual workflow states.
Timestamps	Timestamp types and deadline semantics are consistent.
Indexes	Supporting indexes exist where query plans justify them.
Permissions	Database roles have only the access they need.

A successful CREATE OR REPLACE VIEW statement does not prove that the view returns semantically correct business data.

8. Testing Checklist

* [ ]	All dependency tables and columns exist.
* [ ]	Both view definitions execute successfully.
* [ ]	Empty tables return valid results.
* [ ]	Applications without history rows are handled correctly.
* [ ]	File counts match the source records.
* [ ]	Application history counts match the source records.
* [ ]	Job application totals match the actual relationship.
* [ ]	Derived status labels agree with workflow rules.
* [ ]	Expired and unpublished jobs are classified correctly.
* [ ]	Applicant ownership is enforced by the API.
* [ ]	Employer reporting is access-controlled.
* [ ]	Sensitive contact information is not exposed publicly.
* [ ]	Query plans use appropriate indexes for common workloads.
* [ ]	Database grants follow least-privilege principles.
* [ ]	Integration tests run against the intended schema version.

9. Maintenance

When a source table changes:

1. Identify dependent views.
2. Update the view SQL and relevant migrations.
3. Test compatibility with existing API queries.
4. Review privacy and authorization implications.
5. Update this README.
6. Run database and integration tests.
7. Deploy schema changes and dependent views in a compatible order.

Keep view definitions in version control. Prefer versioned migrations for production changes rather than manually editing database objects.

10. Production Readiness

These views are reporting and query abstractions, not authorization boundaries by themselves.

Production readiness requires confirming the actual SQL definitions, migrations, permissions, source-table relationships, query performance, and API access controls.

The application_summary view can be tested against the provided core schema. The job_summary view remains pending implementation until the actual jobs schema and job-application relationship are confirmed.