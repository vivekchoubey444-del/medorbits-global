-- ============================================================
-- MedOrbits Application Summary View
-- File: database/views/application-summary.sql
-- Database: PostgreSQL 14+
--
-- Purpose:
--   Provide a consolidated application summary for dashboards,
--   administrative lists, and reporting.
--
-- Dependencies:
--   medorbits.users
--   medorbits.applications
--   medorbits.application_files
--   medorbits.application_status_history
--
-- Security:
--   This view intentionally excludes password hashes,
--   applicant notes, and staff notes.
--   Restrict access to the view using database permissions.
-- ============================================================
BEGIN;
CREATE SCHEMA IF NOT EXISTS medorbits;
SET LOCAL search_path TO medorbits, public;
CREATE OR REPLACE VIEW medorbits.application_summary AS
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
    a.status,
    a.submitted_at,
    a.reviewed_at,
    a.decided_at,
    a.withdrawn_at,
    a.created_at,
    a.updated_at,
    a.version,
    COALESCE(files.file_count, 0)::BIGINT AS file_count,
    COALESCE(files.pending_scan_count, 0)::BIGINT
        AS pending_scan_count,
    COALESCE(files.clean_file_count, 0)::BIGINT
        AS clean_file_count,
    COALESCE(files.infected_file_count, 0)::BIGINT
        AS infected_file_count,
    COALESCE(history.status_change_count, 0)::BIGINT
        AS status_change_count,
    history.last_status_change_at,
    CASE
        WHEN a.status = 'draft' THEN 'Draft'
        WHEN a.status = 'submitted' THEN 'Submitted'
        WHEN a.status = 'under_review' THEN 'Under review'
        WHEN a.status = 'documents_required' THEN 'Documents required'
        WHEN a.status = 'approved' THEN 'Approved'
        WHEN a.status = 'rejected' THEN 'Rejected'
        WHEN a.status = 'withdrawn' THEN 'Withdrawn'
        ELSE 'Unknown'
    END AS status_label
FROM medorbits.applications AS a
INNER JOIN medorbits.users AS u
    ON u.id = a.applicant_id
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS file_count,
        COUNT(*) FILTER (
            WHERE f.scan_status = 'pending'
        ) AS pending_scan_count,
        COUNT(*) FILTER (
            WHERE f.scan_status = 'clean'
        ) AS clean_file_count,
        COUNT(*) FILTER (
            WHERE f.scan_status = 'infected'
        ) AS infected_file_count
    FROM medorbits.application_files AS f
    WHERE f.application_id = a.id
) AS files ON TRUE
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS status_change_count,
        MAX(h.created_at) AS last_status_change_at
    FROM medorbits.application_status_history AS h
    WHERE h.application_id = a.id
) AS history ON TRUE;
COMMENT ON VIEW medorbits.application_summary IS
    'Application dashboard summary with applicant details, file counts, and status-history metrics.';
COMMIT;
-- ============================================================
-- EXAMPLE QUERIES
-- ============================================================
-- Recent applications:
--
-- SELECT *
-- FROM medorbits.application_summary
-- ORDER BY created_at DESC, application_id DESC
-- LIMIT 25;
-- Applications awaiting review:
--
-- SELECT
--     application_number,
--     applicant_name,
--     applicant_email,
--     application_type,
--     program_code,
--     created_at
-- FROM medorbits.application_summary
-- WHERE status = 'submitted'
-- ORDER BY created_at ASC;
-- Application status counts:
--
-- SELECT status, COUNT(*) AS total
-- FROM medorbits.application_summary
-- GROUP BY status
-- ORDER BY total DESC;
-- Applications requiring document or file review:
--
-- SELECT
--     application_number,
--     applicant_name,
--     file_count,
--     pending_scan_count,
--     infected_file_count
-- FROM medorbits.application_summary
-- WHERE pending_scan_count > 0
--    OR infected_file_count > 0
-- ORDER BY created_at DESC;
-- ============================================================
-- END OF APPLICATION SUMMARY VIEW
-- ============================================================