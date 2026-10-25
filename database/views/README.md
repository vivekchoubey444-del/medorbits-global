
# MedOrbits Database Views

**Directory:** `database/views/`  
**Project:** MedOrbits — Education, Admissions, Careers & Recruitment  
**Database:** PostgreSQL  
**Purpose:** Reusable, read-oriented SQL views for application reporting, job listings, operational dashboards, and administrative analytics.

## 1. Directory Structure

```text
database/
└── views/
    ├── README.md
    ├── application-summary.sql
    └── job-summary.sql
```

Keep this documentation synchronized with the SQL files and actual database migrations in the repository.

## 2. Available Views

| File | View | Purpose |
|—|—|—|
| `application-summary.sql` | `application_summary` | Consolidates application details, applicant information, workflow status, and status-history statistics. |
| `job-summary.sql` | `job_summary` | Consolidates job listing details, publication status, and aggregated application statistics. |

These views are intended to simplify read queries. They do not replace service-layer authorization, business rules, or transactional workflows.

## 3. Application Summary View

**File:** `database/views/application-summary.sql`  
**View:** `application_summary`

### Purpose

The application summary view provides a consolidated representation of an application and its associated applicant.

Depending on the deployed definition, it may include:

- Application identifiers and application number.
- Applicant identifiers and contact information.
- Application type, program, institution, and academic year.
- Current workflow status and timestamps.
- Application version.
- Status-history counts and timestamps.
- A derived workflow-stage label.

### Dependencies

The current proposed definition expects:

- `applications`
- `users`
- `application_status_history`

The actual table and column definitions must match the project’s migrations.

### Example query

```sql
SELECT
    application_id,
    application_number,
    application_type,
    application_status,
    workflow_stage,
    application_created_at
FROM application_summary
ORDER BY application_created_at DESC, application_id DESC
LIMIT 25;
```

### Applicant-scoped query

```sql
SELECT
    application_id,
    application_public_id,
    application_type,
    application_status,
    workflow_stage
FROM application_summary
WHERE applicant_id = $1
ORDER BY application_created_at DESC, application_id DESC
LIMIT 25;
```

The authenticated applicant ID must be obtained from trusted server-side authentication context. Do not accept an arbitrary applicant ID from the request body as authorization.

## 4. Job Summary View

**File:** `database/views/job-summary.sql`  
**View:** `job_summary`

### Purpose

The job summary view is intended to support career listings, employer dashboards, and recruitment reporting.

Depending on the deployed definition, it may include:

- Job identifiers, title, slug, and description.
- Employer or company details.
- Employment type, work mode, and category.
- Experience requirements.
- Location and remote-work information.
- Salary range and currency.
- Vacancy count and publication dates.
- Application statistics.
- A derived listing-availability label.

### Dependencies

The current proposed definition expects:

- `jobs`
- `applications`, with a job foreign key such as `job_id`

The core schema previously documented does not define the complete `jobs` table. Verify all job fields and application relationships against the actual schema before deploying the view.

### Example query

```sql
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
FROM job_summary
WHERE listing_availability = ‘open’
ORDER BY published_at DESC NULLS LAST, job_id DESC
LIMIT 25;
```

### Employer reporting

Application counts and recruitment statistics may be confidential. Verify that the requesting user is authorized to view statistics for the relevant employer or job before returning these fields.

## 5. Installation and Deployment

Apply views only after their dependency tables and columns exist.

Recommended deployment sequence:

1. Apply the reviewed database schema migrations.
2. Apply required constraints and indexes.
3. Verify table names, column names, and foreign-key relationships.
4. Apply the view SQL files.
5. Test each view with representative data.
6. Verify database grants and API authorization.
7. Run integration tests before deploying to production.

Example commands, executed from the repository root:

```bash
psql “$DATABASE_URL” -v ON_ERROR_STOP=1 \
  -f database/views/application-summary.sql

psql “$DATABASE_URL” -v ON_ERROR_STOP=1 \
  -f database/views/job-summary.sql
```

Use a dedicated development or staging database first. Confirm the configured database target before running any SQL command.

## 6. View Design Principles

### Read-oriented design

Views should simplify reporting and repeated joins. Business operations such as submitting applications, changing status, approving candidates, and publishing jobs belong in the service layer.

### Authorization

A view does not automatically enforce the application’s user-level authorization rules.

- Scope applicant queries to the authenticated applicant.
- Restrict employer statistics to authorized employer accounts.
- Limit administrative reporting to appropriately privileged users.
- Apply least-privilege database grants.
- Avoid exposing internal identifiers or sensitive contact fields through public endpoints.

### Data privacy

Do not expose unnecessary personal information in public views.

The application summary view may include applicant email addresses and phone numbers. Prefer a restricted staff-facing view or an API projection that omits those fields when they are not required.

The job summary view may include recruitment statistics. Public career pages should expose only fields intended for public consumption.

### Performance

- Index the underlying columns used for joins and frequent filters.
- Review execution plans for expensive queries.
- Avoid repeatedly aggregating large history or application tables without measuring the cost.
- Consider materialized views only when stale data is acceptable and refresh behavior is documented.
- Remember that ordinary PostgreSQL views do not store their query results.

## 7. Schema Compatibility

The SQL files are dependent on the actual database schema.

Before production deployment, verify the following:

| Component | Required verification |
|—|—|
| Application view | `applications.applicant_id` references `users.id`. |
| Application history | History rows reference the correct application key and status columns. |
| Job view | The `jobs` table and referenced job fields exist. |
| Job applications | The application-to-job relationship is defined correctly. |
| Status values | View logic matches the application’s workflow states. |
| Timestamps | Timestamp types and deadline semantics are consistent. |
| Indexes | Supporting indexes exist where query plans justify them. |
| Permissions | API database roles have only the required access. |

A successful `CREATE OR REPLACE VIEW` statement does not prove that the view returns semantically correct business data.

## 8. Testing Checklist

Before deployment, verify:

- [ ] All dependency tables and columns exist.
- [ ] Both view definitions execute successfully.
- [ ] Empty tables return valid results.
- [ ] Applications without history rows are handled correctly.
- [ ] Application summary counts match source-table records.
- [ ] Job application totals match the actual relationship.
- [ ] Derived status labels agree with workflow rules.
- [ ] Expired and unpublished jobs are classified correctly.
- [ ] Applicant ownership is enforced by the API.
- [ ] Employer reporting is access-controlled.
- [ ] Sensitive contact information is not exposed publicly.
- [ ] Query plans use appropriate indexes for common workloads.
- [ ] Database grants follow least-privilege principles.
- [ ] Integration tests run against the intended schema version.

## 9. Maintenance

When a source table changes:

1. Identify dependent views.
2. Update the view SQL and relevant migrations.
3. Test compatibility with existing API queries.
4. Review privacy and authorization implications.
5. Update this README.
6. Run database and integration tests.
7. Deploy schema changes and dependent views in a compatible order.

Keep view definitions in version control. Prefer versioned migrations for production changes rather than manually editing database objects.

## 10. Production Readiness

These views are reporting and query abstractions, not authorization boundaries by themselves.

Production readiness requires confirming the actual SQL definitions, database migrations, permissions, source-table relationships, query performance, and API access controls. The proposed `job_summary` view especially requires verification against the actual `jobs` schema before deployment.
