
-- =============================================================================
-- Migration: 005_create_applications.sql
-- Project: MedOrbits
-- Purpose: Create student applications and admission review workflows.
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
-- Character set: utf8mb4
-- Collation: utf8mb4_0900_ai_ci
--
-- DEPENDENCIES:
--   001_create_users.sql
--   003_create_courses.sql
--   004_create_colleges_universities.sql
--
-- IMPORTANT:
-- - Generate public_id using crypto.randomUUID() in trusted backend code.
-- - Generate a unique application_number in trusted backend code.
-- - Store timestamps according to the application's UTC convention.
-- - Enforce ownership and reviewer authorization in backend services.
-- - Never trust applicant IDs, status changes, or review fields from clients.
-- - Intended for a fresh installation.
-- - CREATE TABLE IF NOT EXISTS does not modify existing table definitions.
-- - MySQL DDL may implicitly commit.
-- =============================================================================

CREATE TABLE IF NOT EXISTS applications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    -- Public and human-readable identifiers.
    public_id CHAR(36) NOT NULL,
    application_number VARCHAR(60) NOT NULL,

    -- Ownership and education preferences.
    user_id BIGINT UNSIGNED NOT NULL,
    course_id BIGINT UNSIGNED NULL,
    college_id BIGINT UNSIGNED NULL,

    -- Applicant details captured at application time.
    applicant_name VARCHAR(200) NOT NULL,
    applicant_email VARCHAR(254) NOT NULL,
    applicant_phone VARCHAR(30) NULL,

    -- Application lifecycle.
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    notes TEXT NULL,

    -- Submission and review metadata.
    submitted_at DATETIME(3) NULL,
    reviewed_at DATETIME(3) NULL,
    reviewed_by BIGINT UNSIGNED NULL,

    -- Lifecycle timestamps.
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_applications_public_id (public_id),
    UNIQUE KEY uq_applications_number (application_number),

    KEY idx_applications_user_status_created
        (user_id, status, created_at),
    KEY idx_applications_course_id (course_id),
    KEY idx_applications_college_id (college_id),
    KEY idx_applications_status_created (status, created_at),
    KEY idx_applications_reviewer_status (reviewed_by, status),
    KEY idx_applications_submitted_at (submitted_at),

    -- Supported application lifecycle.
    CONSTRAINT chk_applications_status
        CHECK (
            status IN (
                'draft',
                'submitted',
                'under_review',
                'documents_required',
                'approved',
                'rejected',
                'withdrawn',
                'closed'
            )
        ),

    -- Required identifiers and applicant details cannot be blank.
    CONSTRAINT chk_applications_public_id_not_blank
        CHECK (CHAR_LENGTH(TRIM(public_id)) > 0),

    CONSTRAINT chk_applications_application_number
        CHECK (CHAR_LENGTH(TRIM(application_number)) > 0),

    CONSTRAINT chk_applications_applicant_name
        CHECK (CHAR_LENGTH(TRIM(applicant_name)) > 0),

    CONSTRAINT chk_applications_applicant_email
        CHECK (CHAR_LENGTH(TRIM(applicant_email)) > 0),

    CONSTRAINT chk_applications_applicant_phone_not_blank
        CHECK (
            applicant_phone IS NULL
            OR CHAR_LENGTH(TRIM(applicant_phone)) > 0
        ),

    -- Review timestamp and reviewer must be supplied together.
    CONSTRAINT chk_applications_review_consistency
        CHECK (
            (reviewed_at IS NULL AND reviewed_by IS NULL)
            OR
            (reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
        ),

    -- Submitted and later workflow states require a submission timestamp.
    CONSTRAINT chk_applications_submission_consistency
        CHECK (
            status NOT IN (
                'submitted',
                'under_review',
                'documents_required',
                'approved',
                'rejected',
                'closed'
            )
            OR submitted_at IS NOT NULL
        ),

    -- Review metadata is required for final review decisions.
    CONSTRAINT chk_applications_final_review_consistency
        CHECK (
            status NOT IN ('approved', 'rejected')
            OR (
                reviewed_at IS NOT NULL
                AND reviewed_by IS NOT NULL
            )
        ),

    -- Preserve ownership and referenced records.
    CONSTRAINT fk_applications_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_applications_course
        FOREIGN KEY (course_id)
        REFERENCES courses (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_applications_college
        FOREIGN KEY (college_id)
        REFERENCES colleges (id)
        ON DELETE SET NULL,

    -- Reviewer deletion is restricted while referenced by an application.
    -- Deactivate reviewer accounts instead of deleting them.
    CONSTRAINT fk_applications_reviewer
        FOREIGN KEY (reviewed_by)
        REFERENCES users (id)
        ON DELETE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Confirm the table exists and inspect its definition.
SHOW CREATE TABLE applications;

-- Review application counts by workflow status.
SELECT
    status,
    COUNT(*) AS application_count
FROM applications
GROUP BY status
ORDER BY status;

-- Check for invalid lifecycle combinations.
-- Expected result: zero rows.
SELECT
    id,
    application_number,
    status,
    submitted_at,
    reviewed_at,
    reviewed_by
FROM applications
WHERE
    (
        status IN (
            'submitted',
            'under_review',
            'documents_required',
            'approved',
            'rejected',
            'closed'
        )
        AND submitted_at IS NULL
    )
    OR (
        status IN ('approved', 'rejected')
        AND (reviewed_at IS NULL OR reviewed_by IS NULL)
    )
    OR (
        (reviewed_at IS NULL AND reviewed_by IS NOT NULL)
        OR
        (reviewed_at IS NOT NULL AND reviewed_by IS NULL)
    );

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
