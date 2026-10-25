
-- =============================================================================
-- MedOrbits: Jobs and Recruitment Queries
-- File: database/queries/jobs.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
--
-- PURPOSE
--   Reusable queries for job discovery, employer management, and recruitment.
--
-- EXPECTED TABLES
--   jobs
--   job_applications
--   users
--
-- OPTIONAL TABLES
--   employers
--
-- SCHEMA ASSUMPTIONS
--   jobs:
--     id, public_id, employer_id, title, slug, description, requirements,
--     responsibilities, job_type, employment_type, work_mode, category,
--     experience_min_years, experience_max_years, location, state, city,
--     salary_min, salary_max, salary_currency, status, published_at,
--     application_deadline, created_at, updated_at
--
--   job_applications:
--     id, public_id, job_id, applicant_id, cover_letter, resume_file_id,
--     status, applied_at, updated_at
--
-- SECURITY
--   Use prepared statements and bound parameters.
--   Enforce authentication, authorization, ownership, and rate limits in the
--   application layer.
--   Public queries must not expose applicant contact details or private files.
-- =============================================================================


-- =============================================================================
-- 1. PUBLIC JOB LISTINGS
--
-- Parameters:
--   1. page size
--   2. offset
--
-- Only published, non-expired jobs are returned.
-- =============================================================================

SELECT
    j.public_id,
    j.title,
    j.slug,
    j.description,
    j.requirements,
    j.responsibilities,
    j.job_type,
    j.employment_type,
    j.work_mode,
    j.category,
    j.experience_min_years,
    j.experience_max_years,
    j.location,
    j.state,
    j.city,
    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.published_at,
    j.application_deadline,
    j.created_at
FROM jobs AS j
WHERE j.status = 'published'
  AND (
      j.application_deadline IS NULL
      OR j.application_deadline >= CURRENT_DATE
  )
ORDER BY j.published_at DESC, j.id DESC
LIMIT ? OFFSET ?;


-- =============================================================================
-- 2. GET A PUBLIC JOB BY SLUG
--
-- Parameters:
--   1. job slug
-- =============================================================================

SELECT
    j.public_id,
    j.title,
    j.slug,
    j.description,
    j.requirements,
    j.responsibilities,
    j.job_type,
    j.employment_type,
    j.work_mode,
    j.category,
    j.experience_min_years,
    j.experience_max_years,
    j.location,
    j.state,
    j.city,
    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.published_at,
    j.application_deadline
FROM jobs AS j
WHERE j.slug = ?
  AND j.status = 'published'
  AND (
      j.application_deadline IS NULL
      OR j.application_deadline >= CURRENT_DATE
  )
LIMIT 1;


-- =============================================================================
-- 3. SEARCH AND FILTER PUBLIC JOBS
--
-- Parameters:
--   1. search term, or NULL
--   2. search term again
--   3. category, or NULL
--   4. employment type, or NULL
--   5. work mode, or NULL
--   6. state, or NULL
--   7. city, or NULL
--   8. minimum experience, or NULL
--   9. maximum experience, or NULL
--  10. minimum salary, or NULL
--  11. page size
--  12. offset
--
-- Validate the page size and offset in the application layer.
-- Use a separate full-text index/search service for large catalogues.
-- =============================================================================

SELECT
    j.public_id,
    j.title,
    j.slug,
    j.description,
    j.job_type,
    j.employment_type,
    j.work_mode,
    j.category,
    j.experience_min_years,
    j.experience_max_years,
    j.location,
    j.state,
    j.city,
    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.published_at,
    j.application_deadline
FROM jobs AS j
WHERE j.status = 'published'
  AND (
      j.application_deadline IS NULL
      OR j.application_deadline >= CURRENT_DATE
  )
  AND (
      ? IS NULL
      OR j.title LIKE CONCAT('%', ?, '%')
      OR j.description LIKE CONCAT('%', ?, '%')
  )
  AND (? IS NULL OR j.category = ?)
  AND (? IS NULL OR j.employment_type = ?)
  AND (? IS NULL OR j.work_mode = ?)
  AND (? IS NULL OR j.state = ?)
  AND (? IS NULL OR j.city = ?)
  AND (
      ? IS NULL
      OR j.experience_max_years IS NULL
      OR j.experience_max_years >= ?
  )
  AND (
      ? IS NULL
      OR j.experience_min_years IS NULL
      OR j.experience_min_years <= ?
  )
  AND (? IS NULL OR j.salary_max >= ?)
ORDER BY j.published_at DESC, j.id DESC
LIMIT ? OFFSET ?;


-- =============================================================================
-- 4. COUNT PUBLIC JOBS
--
-- Parameters:
--   1. optional category
--   2. optional employment type
--   3. optional work mode
--   4. optional state
-- =============================================================================

SELECT COUNT(*) AS total_jobs
FROM jobs AS j
WHERE j.status = 'published'
  AND (
      j.application_deadline IS NULL
      OR j.application_deadline >= CURRENT_DATE
  )
  AND (? IS NULL OR j.category = ?)
  AND (? IS NULL OR j.employment_type = ?)
  AND (? IS NULL OR j.work_mode = ?)
  AND (? IS NULL OR j.state = ?);


-- =============================================================================
-- 5. EMPLOYER DASHBOARD JOB LIST
--
-- Parameters:
--   1. authenticated employer user ID
--   2. page size
--   3. offset
--
-- Assumption:
--   jobs.employer_id references users.id.
--   If employers have their own table, use the correct ownership relationship.
-- =============================================================================

SELECT
    j.id,
    j.public_id,
    j.title,
    j.slug,
    j.status,
    j.job_type,
    j.employment_type,
    j.work_mode,
    j.published_at,
    j.application_deadline,
    j.created_at,
    j.updated_at,
    COUNT(ja.id) AS application_count
FROM jobs AS j
LEFT JOIN job_applications AS ja
    ON ja.job_id = j.id
WHERE j.employer_id = ?
GROUP BY
    j.id,
    j.public_id,
    j.title,
    j.slug,
    j.status,
    j.job_type,
    j.employment_type,
    j.work_mode,
    j.published_at,
    j.application_deadline,
    j.created_at,
    j.updated_at
ORDER BY j.created_at DESC, j.id DESC
LIMIT ? OFFSET ?;


-- =============================================================================
-- 6. GET A SINGLE EMPLOYER-OWNED JOB
--
-- Parameters:
--   1. job public UUID
--   2. authenticated employer user ID
--
-- Ownership is enforced in the query.
-- =============================================================================

SELECT
    j.*
FROM jobs AS j
WHERE j.public_id = ?
  AND j.employer_id = ?
LIMIT 1;


-- =============================================================================
-- 7. CREATE A DRAFT JOB
--
-- Parameters:
--   1. public UUID
--   2. employer user ID from authenticated server-side context
--   3. title
--   4. slug
--   5. description
--   6. requirements
--   7. responsibilities
--   8. job type
--   9. employment type
--  10. work mode
--  11. category
--  12. minimum experience
--  13. maximum experience
--  14. location
--  15. state
--  16. city
--  17. minimum salary
--  18. maximum salary
--  19. currency
--  20. application deadline
--
-- A draft must be reviewed and validated before publication.
-- =============================================================================

INSERT INTO jobs (
    public_id,
    employer_id,
    title,
    slug,
    description,
    requirements,
    responsibilities,
    job_type,
    employment_type,
    work_mode,
    category,
    experience_min_years,
    experience_max_years,
    location,
    state,
    city,
    salary_min,
    salary_max,
    salary_currency,
    status,
    application_deadline,
    created_at,
    updated_at
)
VALUES (
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    'draft',
    ?,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
);


-- =============================================================================
-- 8. UPDATE AN EMPLOYER-OWNED DRAFT
--
-- Parameters:
--   1. title
--   2. description
--   3. requirements
--   4. responsibilities
--   5. job type
--   6. employment type
--   7. work mode
--   8. category
--   9. minimum experience
--  10. maximum experience
--  11. location
--  12. state
--  13. city
--  14. minimum salary
--  15. maximum salary
--  16. currency
--  17. application deadline
--  18. job public UUID
--  19. authenticated employer user ID
--
-- Check affected-row count. Zero rows means the job is missing, not owned
-- by the employer, or no longer a draft.
-- =============================================================================

UPDATE jobs
SET
    title = ?,
    description = ?,
    requirements = ?,
    responsibilities = ?,
    job_type = ?,
    employment_type = ?,
    work_mode = ?,
    category = ?,
    experience_min_years = ?,
    experience_max_years = ?,
    location = ?,
    state = ?,
    city = ?,
    salary_min = ?,
    salary_max = ?,
    salary_currency = ?,
    application_deadline = ?,
    updated_at = CURRENT_TIMESTAMP(3)
WHERE public_id = ?
  AND employer_id = ?
  AND status = 'draft';


-- =============================================================================
-- 9. PUBLISH AN EMPLOYER-OWNED JOB
--
-- Parameters:
--   1. job public UUID
--   2. authenticated employer user ID
--
-- Before execution, validate required fields and employer eligibility.
-- If moderation is required, transition to pending_review instead.
-- =============================================================================

UPDATE jobs
SET
    status = 'published',
    published_at = CURRENT_TIMESTAMP(3),
    updated_at = CURRENT_TIMESTAMP(3)
WHERE public_id = ?
  AND employer_id = ?
  AND status = 'draft'
  AND CHAR_LENGTH(TRIM(title)) > 0
  AND CHAR_LENGTH(TRIM(description)) > 0;


-- =============================================================================
-- 10. CLOSE AN EMPLOYER-OWNED JOB
--
-- Parameters:
--   1. job public UUID
--   2. authenticated employer user ID
--
-- Assumes the jobs status enum/check permits 'closed'.
-- =============================================================================

UPDATE jobs
SET
    status = 'closed',
    updated_at = CURRENT_TIMESTAMP(3)
WHERE public_id = ?
  AND employer_id = ?
  AND status = 'published';


-- =============================================================================
-- 11. APPLY FOR A JOB
--
-- Parameters:
--   1. application public UUID
--   2. job internal ID
--   3. authenticated applicant user ID
--   4. cover letter
--   5. authorized resume file identifier, or NULL
--
-- Requirements:
--   - Validate that the applicant is eligible.
--   - Validate resume ownership and file status in the application layer.
--   - Add a UNIQUE(job_id, applicant_id) constraint if only one application
--     per applicant per job is allowed.
--   - Verify that exactly one row was inserted.
-- =============================================================================

INSERT INTO job_applications (
    public_id,
    job_id,
    applicant_id,
    cover_letter,
    resume_file_id,
    status,
    applied_at,
    updated_at
)
SELECT
    ?,
    j.id,
    u.id,
    ?,
    ?,
    'submitted',
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM jobs AS j
INNER JOIN users AS u
    ON u.id = ?
WHERE j.id = ?
  AND j.status = 'published'
  AND (
      j.application_deadline IS NULL
      OR j.application_deadline >= CURRENT_DATE
  )
  AND u.account_status = 'active';


-- =============================================================================
-- 12. LIST AN APPLICANT'S JOB APPLICATIONS
--
-- Parameters:
--   1. authenticated applicant user ID
--   2. page size
--   3. offset
--
-- Does not expose private employer or applicant information.
-- =============================================================================

SELECT
    ja.public_id AS application_public_id,
    ja.status AS application_status,
    ja.applied_at,
    ja.updated_at,
    j.public_id AS job_public_id,
    j.title AS job_title,
    j.slug AS job_slug,
    j.category,
    j.employment_type,
    j.work_mode,
    j.location,
    j.state,
    j.city,
    j.status AS job_status
FROM job_applications AS ja
INNER JOIN jobs AS j
    ON j.id = ja.job_id
WHERE ja.applicant_id = ?
ORDER BY ja.applied_at DESC, ja.id DESC
LIMIT ? OFFSET ?;


-- =============================================================================
-- 13. GET JOB APPLICATIONS FOR AN EMPLOYER-OWNED JOB
--
-- Parameters:
--   1. job public UUID
--   2. authenticated employer user ID
--   3. page size
--   4. offset
--
-- Applicant contact information is intentionally omitted.
-- Retrieve it only through an authorized, audited recruitment workflow.
-- =============================================================================

SELECT
    ja.public_id AS application_public_id,
    ja.status AS application_status,
    ja.cover_letter,
    ja.applied_at,
    j.public_id AS job_public_id,
    j.title AS job_title
FROM job_applications AS ja
INNER JOIN jobs AS j
    ON j.id = ja.job_id
WHERE j.public_id = ?
  AND j.employer_id = ?
ORDER BY ja.applied_at DESC, ja.id DESC
LIMIT ? OFFSET ?;


-- =============================================================================
-- 14. UPDATE APPLICATION STATUS
--
-- Parameters:
--   1. new application status
--   2. application public UUID
--   3. job owner user ID
--
-- IMPORTANT:
--   Validate allowed status transitions in a service transaction.
--   Record the status transition in a job-application history table if present.
--   This query intentionally does not accept arbitrary applicant IDs.
-- =============================================================================

UPDATE job_applications AS ja
INNER JOIN jobs AS j
    ON j.id = ja.job_id
SET
    ja.status = ?,
    ja.updated_at = CURRENT_TIMESTAMP(3)
WHERE ja.public_id = ?
  AND j.employer_id = ?
  AND ja.status IN ('submitted', 'under_review');


-- =============================================================================
-- 15. WITHDRAW AN APPLICANT'S JOB APPLICATION
--
-- Parameters:
--   1. authenticated applicant user ID
--   2. application public UUID
--
-- Assumes 'withdrawn' is a permitted job-application status.
-- =============================================================================

UPDATE job_applications
SET
    status = 'withdrawn',
    updated_at = CURRENT_TIMESTAMP(3)
WHERE applicant_id = ?
  AND public_id = ?
  AND status IN ('submitted', 'under_review');


-- =============================================================================
-- 16. JOB APPLICATION COUNTS BY STATUS
--
-- Parameters:
--   1. authenticated employer user ID
--
-- Requires permission to view recruitment reports.
-- =============================================================================

SELECT
    j.public_id AS job_public_id,
    j.title AS job_title,
    ja.status AS application_status,
    COUNT(*) AS application_count
FROM jobs AS j
INNER JOIN job_applications AS ja
    ON ja.job_id = j.id
WHERE j.employer_id = ?
GROUP BY j.id, j.public_id, j.title, ja.status
ORDER BY j.title, ja.status;


-- =============================================================================
-- 17. RECRUITMENT SUMMARY
--
-- Parameters:
--   1. start timestamp
--   2. exclusive end timestamp
--
-- Restricted to authorized reporting roles.
-- =============================================================================

SELECT
    DATE(j.published_at) AS publication_date,
    COUNT(DISTINCT j.id) AS published_job_count,
    COUNT(ja.id) AS application_count
FROM jobs AS j
LEFT JOIN job_applications AS ja
    ON ja.job_id = j.id
   AND ja.applied_at >= ?
   AND ja.applied_at < ?
WHERE j.published_at >= ?
  AND j.published_at < ?
GROUP BY DATE(j.published_at)
ORDER BY publication_date DESC;


-- =============================================================================
-- 18. POSSIBLE DUPLICATE JOB APPLICATIONS
--
-- Parameters:
--   1. authenticated applicant user ID
--   2. job internal ID
--
-- Check before inserting if the schema does not enforce a unique pair.
-- A UNIQUE constraint is still required to prevent concurrent duplicates.
-- =============================================================================

SELECT
    public_id,
    status,
    applied_at
FROM job_applications
WHERE applicant_id = ?
  AND job_id = ?
ORDER BY applied_at DESC, id DESC;


-- =============================================================================
-- 19. RECOMMENDED INDEXES
--
-- Review existing indexes and migrations before creating these.
-- =============================================================================

-- CREATE UNIQUE INDEX uq_jobs_public_id
--     ON jobs (public_id);
--
-- CREATE UNIQUE INDEX uq_jobs_slug
--     ON jobs (slug);
--
-- CREATE INDEX idx_jobs_status_deadline_published
--     ON jobs (status, application_deadline, published_at);
--
-- CREATE INDEX idx_jobs_employer_created
--     ON jobs (employer_id, created_at);
--
-- CREATE UNIQUE INDEX uq_job_applications_public_id
--     ON job_applications (public_id);
--
-- CREATE UNIQUE INDEX uq_job_applications_job_applicant
--     ON job_applications (job_id, applicant_id);
--
-- CREATE INDEX idx_job_applications_applicant_applied
--     ON job_applications (applicant_id, applied_at);
--
-- CREATE INDEX idx_job_applications_job_status
--     ON job_applications (job_id, status);


-- =============================================================================
-- END OF JOBS QUERIES
-- =============================================================================
