
-- ============================================================
-- MedOrbits Application Summary View
-- File: database/views/application-summary.sql
-- Database: PostgreSQL
--
-- Purpose:
--   Provide a reusable summary of applications and their
--   associated applicant and workflow information.
--
-- Dependencies:
--   - users
--   - applications
--   - application_status_history
--
-- Security:
--   - This view includes applicant contact information.
--   - Restrict access using database privileges and API
--     authorization. Do not expose it directly to public clients.
-- ============================================================

CREATE OR REPLACE VIEW application_summary AS
SELECT
    a.id AS application_id,
    a.public_id AS application_public_id,
    a.application_number,

    a.applicant_id,
    u.public_id AS applicant_public_id,
    u.full_name AS applicant_name,
    u.email AS applicant_email,
    u.phone AS applicant_phone,
    u.account_status AS applicant_account_status,

    a.application_type,
    a.program_code,
    a.institution_id,
    a.academic_year,

    a.title,
    a.status AS application_status,

    a.submitted_at,
    a.reviewed_at,
    a.decided_at,
    a.withdrawn_at,

    a.created_at AS application_created_at,
    a.updated_at AS application_updated_at,
    a.version AS application_version,

    COALESCE(history.status_change_count, 0)
        AS status_change_count,

    history.first_status_change_at,
    history.last_status_change_at,

    history.last_recorded_status,

    CASE
        WHEN a.status = 'draft'
            THEN 'in_progress'
        WHEN a.status = 'submitted'
            THEN 'awaiting_review'
        WHEN a.status = 'under_review'
            THEN 'in_review'
        WHEN a.status = 'documents_required'
            THEN 'action_required'
        WHEN a.status = 'approved'
            THEN 'completed_approved'
        WHEN a.status = 'rejected'
            THEN 'completed_rejected'
        WHEN a.status = 'withdrawn'
            THEN 'closed_withdrawn'
        ELSE 'unknown'
    END AS workflow_stage

FROM applications AS a

INNER JOIN users AS u
    ON u.id = a.applicant_id

LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS status_change_count,
        MIN(h.created_at) AS first_status_change_at,
        MAX(h.created_at) AS last_status_change_at,

        (
            ARRAY_AGG(
                h.new_status
                ORDER BY h.created_at DESC, h.id DESC
            )
        )[1] AS last_recorded_status

    FROM application_status_history AS h
    WHERE h.application_id = a.id
) AS history ON TRUE;

COMMENT ON VIEW application_summary IS
    'Application summary with applicant details, workflow status, '
    'and aggregated status-history information. Restrict access '
    'because applicant contact information is included.';

-- ============================================================
-- Example queries
-- ============================================================

-- 1. Recent applications
--
-- SELECT
--     application_id,
--     application_number,
--     applicant_name,
--     application_type,
--     application_status,
--     application_created_at
-- FROM application_summary
-- ORDER BY application_created_at DESC, application_id DESC
-- LIMIT 25;

-- 2. Applications belonging to one applicant
--
-- SELECT
--     application_id,
--     application_public_id,
--     application_type,
--     program_code,
--     application_status,
--     workflow_stage
-- FROM application_summary
-- WHERE applicant_id = $1
-- ORDER BY application_created_at DESC, application_id DESC;

-- 3. Applications awaiting review
--
-- SELECT
--     application_id,
--     application_number,
--     applicant_name,
--     application_type,
--     academic_year,
--     submitted_at
-- FROM application_summary
-- WHERE application_status IN ('submitted', 'under_review')
-- ORDER BY submitted_at ASC NULLS LAST, application_id ASC;

-- 4. Application status distribution
--
-- SELECT
--     application_status,
--     COUNT(*) AS application_count
-- FROM application_summary
-- GROUP BY application_status
-- ORDER BY application_count DESC;

-- 5. Applications requiring applicant action
--
-- SELECT
--     application_id,
--     application_number,
--     applicant_id,
--     applicant_name,
--     application_type,
--     application_status,
--     application_updated_at
-- FROM application_summary
-- WHERE workflow_stage = 'action_required'
-- ORDER BY application_updated_at DESC;

-- ============================================================
-- END OF APPLICATION SUMMARY VIEW
-- ============================================================
