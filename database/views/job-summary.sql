
-- ============================================================
-- MedOrbits Job Summary View
-- File: database/views/job-summary.sql
-- Database: PostgreSQL
--
-- Purpose:
--   Consolidate job listing details and application statistics
--   for career pages, employer dashboards, and administration.
--
-- Expected tables:
--   jobs
--   applications
--
-- IMPORTANT:
--   Adapt column names to the actual jobs schema.
--   Do not expose internal employer or applicant data publicly.
-- ============================================================

CREATE OR REPLACE VIEW job_summary AS
SELECT
    j.id AS job_id,
    j.public_id AS job_public_id,

    j.title AS job_title,
    j.slug AS job_slug,
    j.description AS job_description,

    j.employer_id,
    j.company_name,

    j.job_type,
    j.employment_type,
    j.work_mode,

    j.category,
    j.experience_level,
    j.minimum_experience_years,
    j.maximum_experience_years,

    j.location,
    j.city,
    j.state,
    j.country,
    j.is_remote,

    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.salary_period,

    j.openings,
    j.status AS job_status,

    j.published_at,
    j.application_deadline,
    j.created_at AS job_created_at,
    j.updated_at AS job_updated_at,

    COALESCE(application_stats.total_applications, 0)
        AS total_applications,

    COALESCE(application_stats.submitted_applications, 0)
        AS submitted_applications,

    COALESCE(application_stats.under_review_applications, 0)
        AS under_review_applications,

    COALESCE(application_stats.approved_applications, 0)
        AS approved_applications,

    COALESCE(application_stats.rejected_applications, 0)
        AS rejected_applications,

    CASE
        WHEN j.status <> 'published'
            THEN 'not_published'
        WHEN j.application_deadline IS NOT NULL
             AND j.application_deadline < CURRENT_DATE
            THEN 'expired'
        ELSE 'open'
    END AS listing_availability

FROM jobs AS j

LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS total_applications,

        COUNT(*) FILTER (
            WHERE a.status = 'submitted'
        ) AS submitted_applications,

        COUNT(*) FILTER (
            WHERE a.status = 'under_review'
        ) AS under_review_applications,

        COUNT(*) FILTER (
            WHERE a.status = 'approved'
        ) AS approved_applications,

        COUNT(*) FILTER (
            WHERE a.status = 'rejected'
        ) AS rejected_applications

    FROM applications AS a
    WHERE a.job_id = j.id
) AS application_stats ON TRUE;

COMMENT ON VIEW job_summary IS
    'Job listing summary with aggregated application counts. '
    'Restrict access to employer-specific statistics and '
    'administrative reporting as appropriate.';

-- ============================================================
-- Example queries
-- ============================================================

-- 1. Public career listings
--
-- SELECT
--     job_public_id,
--     job_title,
--     company_name,
--     employment_type,
--     work_mode,
--     city,
--     state,
--     salary_min,
--     salary_max,
--     salary_currency,
--     published_at,
--     application_deadline
-- FROM job_summary
-- WHERE listing_availability = 'open'
-- ORDER BY published_at DESC NULLS LAST, job_id DESC
-- LIMIT 25;

-- 2. Job application statistics
--
-- SELECT
--     job_id,
--     job_title,
--     total_applications,
--     submitted_applications,
--     under_review_applications,
--     approved_applications,
--     rejected_applications
-- FROM job_summary
-- ORDER BY total_applications DESC, job_id DESC;

-- 3. Jobs with upcoming deadlines
--
-- SELECT
--     job_id,
--     job_title,
--     company_name,
--     application_deadline
-- FROM job_summary
-- WHERE job_status = 'published'
--   AND application_deadline >= CURRENT_DATE
-- ORDER BY application_deadline ASC
-- LIMIT 50;

-- 4. Jobs requiring administrative attention
--
-- SELECT
--     job_id,
--     job_title,
--     job_status,
--     total_applications,
--     job_updated_at
-- FROM job_summary
-- WHERE job_status IN ('draft', 'pending_review', 'suspended')
-- ORDER BY job_updated_at DESC;

-- ============================================================
-- END OF JOB SUMMARY VIEW
-- ============================================================
