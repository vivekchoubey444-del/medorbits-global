
-- =============================================================================
-- MedOrbits: Application Management Queries
-- File: database/queries/applications.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
--
-- PURPOSE
--   Reusable SQL queries for education/admission applications.
--
-- EXPECTED TABLES
--   applications
--   users
--   courses
--   colleges
--   application_files (optional)
--   application_status_history (optional)
--
-- ASSUMED APPLICATION COLUMNS
--   id, public_id, application_number, applicant_id, course_id, college_id,
--   applicant_name, applicant_email, applicant_phone, status, notes,
--   submitted_at, created_at, updated_at, deleted_at
--
-- IMPORTANT
--   1. Use prepared statements for all user-supplied values.
--   2. Derive applicant_id and authorization scope from authenticated context.
--   3. Validate status transitions in the service layer.
--   4. Use transactions for multi-table operations.
--   5. Adjust optional columns and tables to match actual migrations.
-- =============================================================================


-- =============================================================================
-- 1. GET APPLICATION BY PUBLIC ID
--
-- Parameters:
--   1. application public UUID
--
-- This query is suitable for internal service use only. Public-facing routes
-- must additionally enforce applicant ownership or staff authorization.
-- =============================================================================

SELECT
    a.public_id,
    a.application_number,
    a.applicant_id,
    a.course_id,
    a.college_id,
    a.applicant_name,
    a.applicant_email,
    a.applicant_phone,
    a.status,
    a.notes,
    a.submitted_at,
    a.created_at,
    a.updated_at
FROM applications AS a
WHERE a.public_id = ?
  AND a.deleted_at IS NULL
LIMIT 1;


-- =============================================================================
-- 2. GET APPLICATION FOR ITS OWNER
--
-- Parameters:
--   1. application public UUID
--   2. authenticated applicant user ID
-- =============================================================================

SELECT
    a.public_id,
    a.application_number,
    a.applicant_name,
    a.applicant_email,
    a.applicant_phone,
    a.status,
    a.notes,
    a.submitted_at,
    a.created_at,
    a.updated_at,
    c.public_id AS course_public_id,
    c.name AS course_name,
    c.slug AS course_slug,
    cl.public_id AS college_public_id,
    cl.name AS college_name,
    cl.city AS college_city,
    cl.state AS college_state
FROM applications AS a
LEFT JOIN courses AS c
    ON c.id = a.course_id
LEFT JOIN colleges AS cl
    ON cl.id = a.college_id
WHERE a.public_id = ?
  AND a.applicant_id = ?
  AND a.deleted_at IS NULL
LIMIT 1;


-- =============================================================================
-- 3. APPLICANT DASHBOARD
--
-- Parameters:
--   1. authenticated applicant user ID
--   2. page size
--   3. offset
-- =============================================================================

SELECT
    a.public_id,
    a.application_number,
    a.applicant_name,
    a.status,
    a.submitted_at,
    a.created_at,
    a.updated_at,
    c.name AS course_name,
    c.slug AS course_slug,
    cl.name AS college_name,
    cl.city AS college_city,
    cl.state AS college_state
FROM applications AS a
LEFT JOIN courses AS c
    ON c.id = a.course_id
LEFT JOIN colleges AS cl
    ON cl.id = a.college_id
WHERE a.applicant_id = ?
  AND a.deleted_at IS NULL
ORDER BY a.created_at DESC, a.id DESC
LIMIT ? OFFSET ?;


-- =============================================================================
-- 4. COUNT APPLICANT APPLICATIONS
--
-- Parameters:
--   1. authenticated applicant user ID
-- =============================================================================

SELECT
    COUNT(*) AS total_applications,
    SUM(a.status = 'draft') AS draft_count,
    SUM(a.status = 'submitted') AS submitted_count,
    SUM(a.status = 'under_review') AS under_review_count,
    SUM(a.status = 'approved') AS approved_count,
    SUM(a.status = 'rejected') AS rejected_count
FROM applications AS a
WHERE a.applicant_id = ?
  AND a.deleted_at IS NULL;


-- =============================================================================
-- 5. ADMIN APPLICATION QUEUE
--
-- Parameters:
--   1. optional status filter
--   2. optional status filter again
--   3. optional course internal ID
--   4. optional course internal ID again
--   5. optional college internal ID
--   6. optional college internal ID again
--   7. start timestamp, or NULL
--   8. start timestamp again
--   9. end timestamp, or NULL
--  10. end timestamp again
--  11. page size
--  12. offset
--
-- Restrict this query to authorized staff/admin routes.
-- =============================================================================

SELECT
    a.public_id,
    a.application_number,
    a.applicant_name,
    a.applicant_email,
    a.applicant_phone,
    a.status,
    a.submitted_at,
    a.created_at,
    a.updated_at,
    c.name AS course_name,
    cl.name AS college_name,
    cl.city AS college_city,
    cl.state AS college_state
FROM applications AS a
LEFT JOIN courses AS c
    ON c.id = a.course_id
LEFT JOIN colleges AS cl
    ON cl.id = a.college_id
WHERE a.deleted_at IS NULL
  AND (? IS NULL OR a.status = ?)
  AND (? IS NULL OR a.course_id = ?)
  AND (? IS NULL OR a.college_id = ?)
  AND (? IS NULL OR a.created_at >= ?)
  AND (? IS NULL OR a.created_at < ?)
ORDER BY a.created_at DESC, a.id DESC
LIMIT ? OFFSET ?;


-- =============================================================================
-- 6. COUNT APPLICATIONS FOR ADMIN FILTERS
--
-- Parameters:
--   1. optional status
--   2. status again
--   3. optional course ID
--   4. course ID again
--   5. optional college ID
--   6. college ID again
-- =============================================================================

SELECT COUNT(*) AS total_applications
FROM applications AS a
WHERE a.deleted_at IS NULL
  AND (? IS NULL OR a.status = ?)
  AND (? IS NULL OR a.course_id = ?)
  AND (? IS NULL OR a.college_id = ?);


-- =============================================================================
-- 7. CREATE A DRAFT APPLICATION
--
-- Parameters:
--   1. public UUID
--   2. application number
--   3. authenticated applicant user ID
--   4. course internal ID
--   5. college internal ID, or NULL
--   6. applicant name
--   7. applicant email
--   8. applicant phone
--   9. notes, or NULL
--
-- Validate course/college eligibility and ownership in the service layer.
-- =============================================================================

INSERT INTO applications (
    public_id,
    application_number,
    applicant_id,
    course_id,
    college_id,
    applicant_name,
    applicant_email,
    applicant_phone,
    status,
    notes,
    submitted_at,
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
    'draft',
    ?,
    NULL,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
);


-- =============================================================================
-- 8. UPDATE AN APPLICANT-OWNED DRAFT
--
-- Parameters:
--   1. applicant name
--   2. applicant email
--   3. applicant phone
--   4. course internal ID
--   5. college internal ID, or NULL
--   6. notes, or NULL
--   7. application public UUID
--   8. authenticated applicant user ID
-- =============================================================================

UPDATE applications
SET
    applicant_name = ?,
    applicant_email = ?,
    applicant_phone = ?,
    course_id = ?,
    college_id = ?,
    notes = ?,
    updated_at = CURRENT_TIMESTAMP(3)
WHERE public_id = ?
  AND applicant_id = ?
  AND status = 'draft'
  AND deleted_at IS NULL;


-- =============================================================================
-- 9. SUBMIT AN APPLICANT-OWNED DRAFT
--
-- Parameters:
--   1. application public UUID
--   2. authenticated applicant user ID
--
-- Perform required-field and document validation before running this query.
-- =============================================================================

UPDATE applications
SET
    status = 'submitted',
    submitted_at = CURRENT_TIMESTAMP(3),
    updated_at = CURRENT_TIMESTAMP(3)
WHERE public_id = ?
  AND applicant_id = ?
  AND status = 'draft'
  AND deleted_at IS NULL
  AND applicant_name IS NOT NULL
  AND CHAR_LENGTH(TRIM(applicant_name)) > 0
  AND applicant_email IS NOT NULL
  AND CHAR_LENGTH(TRIM(applicant_email)) > 0
  AND applicant_phone IS NOT NULL
  AND CHAR_LENGTH(TRIM(applicant_phone)) > 0
  AND course_id IS NOT NULL;


-- =============================================================================
-- 10. UPDATE APPLICATION STATUS
--
-- Parameters:
--   1. new status
--   2. application public UUID
--   3. authenticated staff user ID is verified by the service layer
--
-- SECURITY:
--   Do not expose this query directly to applicants.
--   Validate the actor's role and the permitted transition before execution.
--   Record the transition in application_status_history within the same
--   transaction, if that table exists.
-- =============================================================================

UPDATE applications
SET
    status = ?,
    updated_at = CURRENT_TIMESTAMP(3)
WHERE public_id = ?
  AND deleted_at IS NULL
  AND status IN ('submitted', 'under_review');


-- =============================================================================
-- 11. GET APPLICATION STATUS HISTORY
--
-- Optional table:
--   application_status_history
--
-- Assumed columns:
--   application_id, old_status, new_status, changed_by, note, created_at
--
-- Parameters:
--   1. application public UUID
--   2. authenticated applicant ID, when serving an applicant
--
-- Use an authorized service query to resolve ownership before returning history.
-- =============================================================================

SELECT
    h.old_status,
    h.new_status,
    h.note,
    h.created_at
FROM application_status_history AS h
INNER JOIN applications AS a
    ON a.id = h.application_id
WHERE a.public_id = ?
  AND a.applicant_id = ?
  AND a.deleted_at IS NULL
ORDER BY h.created_at ASC, h.application_id ASC;


-- =============================================================================
-- 12. GET APPLICATION FILE METADATA
--
-- Optional table:
--   application_files
--
-- Assumed columns:
--   application_id, public_id, file_name, mime_type, file_size, status,
--   uploaded_at
--
-- Do not return filesystem paths, storage credentials, or signed URLs from
-- this query. Generate temporary download links through an authorized service.
-- =============================================================================

SELECT
    af.public_id,
    af.file_name,
    af.mime_type,
    af.file_size,
    af.status,
    af.uploaded_at
FROM application_files AS af
INNER JOIN applications AS a
    ON a.id = af.application_id
WHERE a.public_id = ?
  AND a.applicant_id = ?
  AND a.deleted_at IS NULL
ORDER BY af.uploaded_at DESC;


-- =============================================================================
-- 13. APPLICATION STATUS SUMMARY
--
-- Parameters:
--   1. optional start timestamp
--   2. start timestamp again
--   3. optional exclusive end timestamp
--   4. end timestamp again
--
-- Restricted to authorized staff.
-- =============================================================================

SELECT
    a.status,
    COUNT(*) AS application_count
FROM applications AS a
WHERE a.deleted_at IS NULL
  AND (? IS NULL OR a.created_at >= ?)
  AND (? IS NULL OR a.created_at < ?)
GROUP BY a.status
ORDER BY application_count DESC, a.status ASC;


-- =============================================================================
-- 14. APPLICATION COUNTS BY COURSE
--
-- Parameters:
--   1. optional start timestamp
--   2. start timestamp again
--   3. optional exclusive end timestamp
--   4. end timestamp again
--
-- Restricted to authorized staff.
-- =============================================================================

SELECT
    c.public_id AS course_public_id,
    c.name AS course_name,
    COUNT(a.id) AS total_applications,
    SUM(a.status = 'submitted') AS submitted_count,
    SUM(a.status = 'under_review') AS under_review_count,
    SUM(a.status = 'approved') AS approved_count,
    SUM(a.status = 'rejected') AS rejected_count
FROM applications AS a
INNER JOIN courses AS c
    ON c.id = a.course_id
WHERE a.deleted_at IS NULL
  AND (? IS NULL OR a.created_at >= ?)
  AND (? IS NULL OR a.created_at < ?)
GROUP BY c.id, c.public_id, c.name
ORDER BY total_applications DESC, c.name ASC;


-- =============================================================================
-- 15. POSSIBLE DUPLICATE APPLICATION CHECK
--
-- Parameters:
--   1. authenticated applicant user ID
--   2. course internal ID
--   3. college internal ID, or NULL
--
-- This is a pre-check only. If business rules prohibit duplicates, enforce
-- the rule transactionally with an appropriate database constraint or locking
-- strategy that matches the actual schema.
-- =============================================================================

SELECT
    a.public_id,
    a.application_number,
    a.status,
    a.created_at
FROM applications AS a
WHERE a.applicant_id = ?
  AND a.course_id = ?
  AND (
      a.college_id = ?
      OR (a.college_id IS NULL AND ? IS NULL)
  )
  AND a.deleted_at IS NULL
  AND a.status <> 'withdrawn'
ORDER BY a.created_at DESC, a.id DESC;


-- =============================================================================
-- 16. SOFT-DELETE AN APPLICANT-OWNED DRAFT
--
-- Parameters:
--   1. application public UUID
--   2. authenticated applicant user ID
--
-- Only drafts are eligible. Preserve submitted applications for audit/history.
-- =============================================================================

UPDATE applications
SET
    deleted_at = CURRENT_TIMESTAMP(3),
    updated_at = CURRENT_TIMESTAMP(3)
WHERE public_id = ?
  AND applicant_id = ?
  AND status = 'draft'
  AND deleted_at IS NULL;


-- =============================================================================
-- 17. FIND APPLICATIONS REQUIRING REVIEW
--
-- Parameters:
--   1. page size
--   2. offset
--
-- Restricted to authorized counsellors/staff.
-- =============================================================================

SELECT
    a.public_id,
    a.application_number,
    a.applicant_name,
    a.status,
    a.submitted_at,
    c.name AS course_name,
    cl.name AS college_name
FROM applications AS a
LEFT JOIN courses AS c
    ON c.id = a.course_id
LEFT JOIN colleges AS cl
    ON cl.id = a.college_id
WHERE a.status IN ('submitted', 'under_review')
  AND a.deleted_at IS NULL
ORDER BY
    CASE WHEN a.status = 'submitted' THEN 0 ELSE 1 END,
    a.submitted_at ASC,
    a.id ASC
LIMIT ? OFFSET ?;


-- =============================================================================
-- 18. RECOMMENDED INDEXES
--
-- Review the actual schema and existing indexes before creating these.
-- Public identifiers and application numbers should be unique if required by
-- the application contract.
-- =============================================================================

-- CREATE UNIQUE INDEX uq_applications_public_id
--     ON applications (public_id);
--
-- CREATE UNIQUE INDEX uq_applications_application_number
--     ON applications (application_number);
--
-- CREATE INDEX idx_applications_applicant_created
--     ON applications (applicant_id, created_at);
--
-- CREATE INDEX idx_applications_status_submitted
--     ON applications (status, submitted_at);
--
-- CREATE INDEX idx_applications_course_created
--     ON applications (course_id, created_at);
--
-- CREATE INDEX idx_applications_college_created
--     ON applications (college_id, created_at);


-- =============================================================================
-- END OF APPLICATION QUERIES
-- =============================================================================
