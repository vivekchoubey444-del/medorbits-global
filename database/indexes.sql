-- ============================================================
-- MedOrbits Database Indexes
-- File: database/indexes.sql
-- Database: PostgreSQL 14+
--
-- Purpose:
--   Optimize queries for users, applications, application
--   history, files, access requests, audit logs, notifications,
--   and background worker jobs.
--
-- IMPORTANT:
--   - Run after database/schema.sql.
--   - Review existing migrations before applying.
--   - CREATE INDEX IF NOT EXISTS checks the index name, not
--     whether an existing index has the correct definition.
--   - For large production tables, use CREATE INDEX CONCURRENTLY
--     in a separate, non-transactional migration.
-- ============================================================
BEGIN;
CREATE SCHEMA IF NOT EXISTS medorbits;
SET LOCAL search_path TO medorbits, public;
-- ============================================================
-- 1. USERS
-- ============================================================
-- Email and phone uniqueness indexes are already created
-- by database/schema.sql. Do not recreate them here.
CREATE INDEX IF NOT EXISTS users_role_status_idx
    ON users (role, account_status);
CREATE INDEX IF NOT EXISTS users_created_at_idx
    ON users (created_at DESC, id DESC);
-- ============================================================
-- 2. APPLICATIONS
-- ============================================================
CREATE INDEX IF NOT EXISTS applications_applicant_created_idx
    ON applications (applicant_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS applications_status_created_idx
    ON applications (status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS applications_type_year_idx
    ON applications (application_type, academic_year);
CREATE INDEX IF NOT EXISTS applications_program_idx
    ON applications (program_code)
    WHERE program_code IS NOT NULL;
-- application_number and public_id already have unique indexes.
-- ============================================================
-- 3. APPLICATION STATUS HISTORY
-- ============================================================
CREATE INDEX IF NOT EXISTS application_history_resource_idx
    ON application_status_history
       (application_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS application_history_actor_idx
    ON application_status_history
       (changed_by, created_at DESC)
    WHERE changed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS application_history_request_id_idx
    ON application_status_history (request_id)
    WHERE request_id IS NOT NULL;
-- ============================================================
-- 4. APPLICATION FILES
-- ============================================================
CREATE INDEX IF NOT EXISTS application_files_application_idx
    ON application_files (application_id);
CREATE INDEX IF NOT EXISTS application_files_scan_status_idx
    ON application_files (scan_status);
-- storage_key and public_id already have unique indexes.
-- ============================================================
-- 5. ACCESS REQUESTS
-- ============================================================
CREATE INDEX IF NOT EXISTS access_requests_email_idx
    ON access_requests (lower(email));
CREATE INDEX IF NOT EXISTS access_requests_status_idx
    ON access_requests (status);
-- Pending-request uniqueness indexes are created by schema.sql.
-- ============================================================
-- 6. AUDIT LOGS
-- ============================================================
CREATE INDEX IF NOT EXISTS audit_logs_created_idx
    ON audit_logs (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx
    ON audit_logs (actor_id, created_at DESC, id DESC)
    WHERE actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx
    ON audit_logs (action, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx
    ON audit_logs (resource_type, resource_id)
    WHERE resource_type IS NOT NULL
      AND resource_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_logs_request_idx
    ON audit_logs (request_id)
    WHERE request_id IS NOT NULL;
-- event_id already has a unique index.
-- ============================================================
-- 7. NOTIFICATIONS
-- ============================================================
CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
    ON notifications (recipient_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx
    ON notifications (recipient_id, created_at DESC, id DESC)
    WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_type_created_idx
    ON notifications (recipient_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_expiration_idx
    ON notifications (expires_at)
    WHERE expires_at IS NOT NULL;
-- public_id already has a unique index.
-- ============================================================
-- 8. BACKGROUND WORKER JOBS
-- ============================================================
CREATE INDEX IF NOT EXISTS worker_jobs_pending_idx
    ON worker_jobs (available_at, id)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS worker_jobs_processing_idx
    ON worker_jobs (locked_at)
    WHERE status = 'processing';
-- idempotency_key uniqueness is already defined in schema.sql.
-- public_id already has a unique index.
-- ============================================================
-- 9. OPTIONAL INDEXES
-- Add only when application queries need them.
-- ============================================================
-- Applications filtered by institution and status:
--
-- CREATE INDEX IF NOT EXISTS applications_institution_status_idx
--     ON applications (institution_id, status, created_at DESC)
--     WHERE institution_id IS NOT NULL;
-- Applications ordered by submission date:
--
-- CREATE INDEX IF NOT EXISTS applications_submitted_at_idx
--     ON applications (submitted_at DESC)
--     WHERE submitted_at IS NOT NULL;
-- Completed worker jobs:
--
-- CREATE INDEX IF NOT EXISTS worker_jobs_completed_idx
--     ON worker_jobs (completed_at DESC)
--     WHERE status = 'completed';
-- ============================================================
-- 10. POST-DEPLOYMENT MAINTENANCE
-- Run ANALYZE separately after deployment when appropriate.
-- ============================================================
COMMIT;
-- Run separately as needed:
--
-- ANALYZE medorbits.users;
-- ANALYZE medorbits.applications;
-- ANALYZE medorbits.application_status_history;
-- ANALYZE medorbits.application_files;
-- ANALYZE medorbits.access_requests;
-- ANALYZE medorbits.audit_logs;
-- ANALYZE medorbits.notifications;
-- ANALYZE medorbits.worker_jobs;
-- Example query-plan inspection:
--
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT id, status, created_at
-- FROM medorbits.applications
-- WHERE applicant_id = 123
-- ORDER BY created_at DESC, id DESC
-- LIMIT 25;
-- ============================================================
-- END OF INDEX DEFINITIONS
-- ============================================================