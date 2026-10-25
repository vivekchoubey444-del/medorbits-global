
-- =============================================================================
-- MedOrbits: Admissions Queries
-- File: database/queries/admissions.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
--
-- PURPOSE
--   Reusable queries for admissions application workflows.
--
-- EXPECTED TABLES
--   applications
--   users
--   courses
--   colleges
--   application_status_history
--
-- SECURITY
--   Use parameterized queries in the application layer.
--   Authenticate users and authorize access before executing queries.
--   Applicants must only access their own applications.
--   Counsellors must be restricted to assigned applications.
--   Administrative access requires explicit permissions.
--
-- IMPORTANT
--   These are query templates, not a complete authorization system.
--   Replace each ? with a bound parameter using your MySQL driver.
--   Never concatenate user input into SQL.
-- =============================================================================


-- =============================================================================
-- 1. PUBLIC ADMISSIONS CATALOGUE
-- List active courses and active colleges for catalogue display.
--
-- Parameters:
--   None
--
-- Note:
--   This query assumes colleges and courses each have is_active.
--   Add approved/verified publication flags if your schema supports them.
-- =============================================================================

SELECT
    c.id AS course_id,
    c.public_id AS course_public_id,
    c.name AS course_name,
    c.slug AS course_slug,
    c.category AS course_category,
    c.qualification_level,
    c.duration_months,
    cl.id AS college_id,
    cl.public_id AS college_public_id,
    cl.name AS college_name,
    cl.slug AS college_slug,
    cl.state,
    cl.city,
    u.name AS university_name
FROM courses AS c
CROSS JOIN colleges AS cl
LEFT JOIN universities AS u
    ON u.id = cl.university_id
WHERE c.is_active = TRUE
  AND cl.is_active = TRUE
  AND (cl.deleted_at IS NULL)
ORDER BY
    c.category,
    c.name,
    cl.state,
    cl.city,
    cl.name;


-- =============================================================================
-- 2. GET AN APPLICANT'S APPLICATIONS
--
-- Parameters:
--   1. applicant_id
--
-- Authorization:
--   Bind the authenticated user's internal ID.
--   Do not trust an applicant_id supplied directly by an untrusted client.
-- =============================================================================

SELECT
    a.id,
    a.public_id,
    a.application_number,
    a.status,
    a.applicant_name,
    a.applicant_email,
    a.applicant_phone,
    a.notes,
    a.submitted_at,
    a.reviewed_at,
    a.decided_at,
    a.withdrawn_at,
    a.created_at,
    a.updated_at,
    c.name AS course_name,
    c.slug AS course_slug,
    cl.name AS college_name,
    cl.slug AS college_slug,
    cl.state AS college_state,
    cl.city AS college_city
FROM applications AS a
INNER JOIN courses AS c
    ON c.id = a.course_id
INNER JOIN colleges AS cl
    ON cl.id = a.college_id
WHERE a.applicant_id = ?
ORDER BY a.created_at DESC, a.id DESC;


-- =============================================================================
-- 3. GET ONE APPLICATION BY PUBLIC ID FOR ITS APPLICANT
--
-- Parameters:
--   1. application public_id
--   2. authenticated applicant_id
--
-- Authorization:
--   Ownership is enforced in the SQL predicate.
-- =============================================================================

SELECT
    a.id,
    a.public_id,
    a.application_number,
    a.status,
    a.applicant_name,
    a.applicant_email,
    a.applicant_phone,
    a.notes,
    a.submitted_at,
    a.reviewed_at,
    a.decided_at,
    a.withdrawn_at,
    a.created_at,
    a.updated_at,
    c.name AS course_name,
    c.slug AS course_slug,
    cl.name AS college_name,
    cl.slug AS college_slug,
    cl.state AS college_state,
    cl.city AS college_city
FROM applications AS a
INNER JOIN courses AS c
    ON c.id = a.course_id
INNER JOIN colleges AS cl
    ON cl.id = a.college_id
WHERE a.public_id = ?
  AND a.applicant_id = ?
LIMIT 1;


-- =============================================================================
-- 4. GET APPLICATION STATUS HISTORY
--
-- Parameters:
--   1. application internal ID
--   2. authenticated applicant_id
--
-- Authorization:
--   Verify application ownership in the query.
--   This query assumes changed_by references users.id.
-- =============================================================================

SELECT
    h.id,
    h.previous_status,
    h.new_status,
    h.reason,
    h.request_id,
    h.created_at,
    u.full_name AS changed_by_name
FROM application_status_history AS h
INNER JOIN applications AS a
    ON a.id = h.application_id
LEFT JOIN users AS u
    ON u.id = h.changed_by
WHERE h.application_id = ?
  AND a.applicant_id = ?
ORDER BY h.created_at ASC, h.id ASC;


-- =============================================================================
-- 5. ADMINISTRATIVE ADMISSIONS LIST
--
-- Parameters:
--   1. optional status filter; NULL means all statuses
--   2. optional course ID; NULL means all courses
--   3. optional college ID; NULL means all colleges
--   4. page size
--   5. offset
--
-- Authorization:
--   Requires an admissions-list permission, such as applications.read_all.
--   Do not expose applicant contact information to unauthorized roles.
--
-- Validation:
--   Validate page size and offset in application code before executing.
-- =============================================================================

SELECT
    a.id,
    a.public_id,
    a.application_number,
    a.status,
    a.applicant_name,
    a.applicant_email,
    a.submitted_at,
    a.reviewed_at,
    a.created_at,
    c.name AS course_name,
    cl.name AS college_name,
    cl.state AS college_state,
    cl.city AS college_city,
    u.full_name AS applicant_account_name
FROM applications AS a
INNER JOIN users AS u
    ON u.id = a.applicant_id
INNER JOIN courses AS c
    ON c.id = a.course_id
INNER JOIN colleges AS cl
    ON cl.id = a.college_id
WHERE (? IS NULL OR a.status = ?)
  AND (? IS NULL OR a.course_id = ?)
  AND (? IS NULL OR a.college_id = ?)
ORDER BY a.created_at DESC, a.id DESC
LIMIT ? OFFSET ?;


-- =============================================================================
-- 6. COUNT APPLICATIONS BY STATUS
--
-- Parameters:
--   1. optional course ID; NULL means all courses
--   2. optional college ID; NULL means all colleges
--
-- Authorization:
--   Requires permission to view admissions reports.
-- =============================================================================

SELECT
    a.status,
    COUNT(*) AS application_count
FROM applications AS a
WHERE (? IS NULL OR a.course_id = ?)
  AND (? IS NULL OR a.college_id = ?)
GROUP BY a.status
ORDER BY a.status;


-- =============================================================================
-- 7. COUNSELLOR REVIEW QUEUE
--
-- Parameters:
--   1. counsellor user ID
--   2. page size
--   3. offset
--
-- IMPORTANT:
--   This query assumes an application_assignments table containing
--   application_id and counsellor_id. Create that table through a migration
--   before using this query.
-- =============================================================================

SELECT
    a.id,
    a.public_id,
    a.application_number,
    a.status,
    a.applicant_name,
    a.submitted_at,
    c.name AS course_name,
    cl.name AS college_name,
    cl.state AS college_state
FROM application_assignments AS aa
INNER JOIN applications AS a
    ON a.id = aa.application_id
INNER JOIN courses AS c
    ON c.id = a.course_id
INNER JOIN colleges AS cl
    ON cl.id = a.college_id
WHERE aa.counsellor_id = ?
  AND a.status IN ('submitted', 'under_review', 'documents_required')
ORDER BY a.submitted_at ASC, a.id ASC
LIMIT ? OFFSET ?;


-- =============================================================================
-- 8. COUNT UNREVIEWED APPLICATIONS
--
-- Parameters:
--   1. optional college ID; NULL means all colleges
--
-- Authorization:
--   Administrative reporting permission required.
-- =============================================================================

SELECT
    COUNT(*) AS pending_review_count
FROM applications AS a
WHERE a.status = 'submitted'
  AND (? IS NULL OR a.college_id = ?);


-- =============================================================================
-- 9. CREATE A DRAFT APPLICATION
--
-- Parameters:
--   1. application public UUID
--   2. application number
--   3. authenticated applicant ID
--   4. course ID
--   5. college ID
--   6. applicant name
--   7. applicant email
--   8. applicant phone
--   9. notes
--
-- Security:
--   Obtain applicant ID from the authenticated server-side session.
--   Verify course and college eligibility before insertion.
--   This query does not independently verify that the selected course and
--   college are eligible for the same admissions cycle.
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
    notes
)
SELECT
    ?,
    ?,
    u.id,
    c.id,
    cl.id,
    ?,
    ?,
    ?,
    'draft',
    ?
FROM users AS u
INNER JOIN courses AS c
    ON c.id = ?
INNER JOIN colleges AS cl
    ON cl.id = ?
WHERE u.id = ?
  AND c.is_active = TRUE
  AND cl.is_active = TRUE
  AND u.deleted_at IS NULL;


-- =============================================================================
-- 10. SUBMIT A DRAFT APPLICATION
--
-- Parameters:
--   1. authenticated applicant ID
--   2. application public ID
--
-- Transaction requirement:
--   Execute inside a transaction. Insert the status-history row in the same
--   transaction and verify exactly one application row was updated.
-- =============================================================================

UPDATE applications
SET
    status = 'submitted',
    submitted_at = CURRENT_TIMESTAMP(3),
    updated_at = CURRENT_TIMESTAMP(3),
    version = version + 1
WHERE applicant_id = ?
  AND public_id = ?
  AND status = 'draft';


-- =============================================================================
-- 11. MOVE AN APPLICATION INTO REVIEW
--
-- Parameters:
--   1. reviewer user ID
--   2. application public ID
--
-- Authorization:
--   Check applications.review permission and assigned-application scope
--   in the service/controller before executing.
--
-- Transaction requirement:
--   Lock the application, capture its previous status, update it, and insert
--   the status-history row in the same transaction.
-- =============================================================================

UPDATE applications
SET
    status = 'under_review',
    reviewed_at = COALESCE(reviewed_at, CURRENT_TIMESTAMP(3)),
    updated_at = CURRENT_TIMESTAMP(3),
    version = version + 1
WHERE public_id = ?
  AND status IN ('submitted', 'documents_required');


-- =============================================================================
-- 12. REQUEST ADDITIONAL DOCUMENTS
--
-- Parameters:
--   1. application public ID
--
-- Authorization:
--   Reviewer permission and application assignment must be verified first.
--
-- Transaction requirement:
--   Record the status change in application_status_history in the same
--   transaction. Store the actual document request in a dedicated table or
--   structured workflow record; do not rely on free-text notes alone.
-- =============================================================================

UPDATE applications
SET
    status = 'documents_required',
    updated_at = CURRENT_TIMESTAMP(3),
    version = version + 1
WHERE public_id = ?
  AND status IN ('submitted', 'under_review');


-- =============================================================================
-- 13. APPROVE AN APPLICATION
--
-- Parameters:
--   1. application public ID
--
-- Authorization:
--   Require the appropriate decision-making permission.
--   Enforce any required second-person approval policy in the service layer.
--
-- Transaction requirement:
--   Capture previous status and insert the status-history row atomically.
-- =============================================================================

UPDATE applications
SET
    status = 'approved',
    decided_at = CURRENT_TIMESTAMP(3),
    updated_at = CURRENT_TIMESTAMP(3),
    version = version + 1
WHERE public_id = ?
  AND status IN ('submitted', 'under_review', 'documents_required');


-- =============================================================================
-- 14. REJECT AN APPLICATION
--
-- Parameters:
--   1. application public ID
--
-- IMPORTANT:
--   Require a documented decision reason in the application service and
--   status-history record. Do not rely on this UPDATE alone.
-- =============================================================================

UPDATE applications
SET
    status = 'rejected',
    decided_at = CURRENT_TIMESTAMP(3),
    updated_at = CURRENT_TIMESTAMP(3),
    version = version + 1
WHERE public_id = ?
  AND status IN ('submitted', 'under_review', 'documents_required');


-- =============================================================================
-- 15. WITHDRAW AN APPLICATION BY ITS APPLICANT
--
-- Parameters:
--   1. authenticated applicant ID
--   2. application public ID
--
-- Transaction requirement:
--   Insert the status-history record in the same transaction.
-- =============================================================================

UPDATE applications
SET
    status = 'withdrawn',
    withdrawn_at = CURRENT_TIMESTAMP(3),
    updated_at = CURRENT_TIMESTAMP(3),
    version = version + 1
WHERE applicant_id = ?
  AND public_id = ?
  AND status IN ('draft', 'submitted', 'under_review', 'documents_required');


-- =============================================================================
-- 16. APPLICATION SUMMARY FOR DASHBOARDS
--
-- Parameters:
--   1. optional start timestamp
--   2. optional end timestamp
--
-- Authorization:
--   Restricted to users with authorized reporting access.
-- =============================================================================

SELECT
    DATE(a.created_at) AS application_date,
    a.status,
    COUNT(*) AS total_applications
FROM applications AS a
WHERE (? IS NULL OR a.created_at >= ?)
  AND (? IS NULL OR a.created_at < ?)
GROUP BY DATE(a.created_at), a.status
ORDER BY application_date DESC, a.status;


-- =============================================================================
-- 17. FIND POSSIBLE DUPLICATE APPLICATIONS
--
-- Parameters:
--   1. applicant ID
--   2. course ID
--   3. college ID
--
-- This query helps detect existing applications before insertion.
-- It is not a substitute for a database uniqueness rule where one is required.
-- =============================================================================

SELECT
    id,
    public_id,
    application_number,
    status,
    created_at
FROM applications
WHERE applicant_id = ?
  AND course_id = ?
  AND college_id = ?
  AND status <> 'withdrawn'
ORDER BY created_at DESC, id DESC;


-- =============================================================================
-- 18. REQUIRED INDEX RECOMMENDATIONS
--
-- Review existing indexes before adding these. Avoid creating duplicates.
-- =============================================================================

-- CREATE INDEX idx_applications_applicant_created
--     ON applications (applicant_id, created_at, id);
--
-- CREATE INDEX idx_applications_status_created
--     ON applications (status, created_at, id);
--
-- CREATE INDEX idx_applications_course_college_status
--     ON applications (course_id, college_id, status);
--
-- CREATE INDEX idx_application_history_app_created
--     ON application_status_history (application_id, created_at, id);
--
-- =============================================================================
-- END OF ADMISSIONS QUERIES
-- =============================================================================
