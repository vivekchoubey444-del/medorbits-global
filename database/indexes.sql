
-- ============================================================
-- MedOrbits Database Indexes
-- File: database/indexes.sql
-- Database: PostgreSQL
--
-- Purpose:
--   Improve application, audit, notification, user, and worker
--   query performance.
--
-- IMPORTANT:
--   1. Confirm these indexes do not already exist.
--   2. Review EXPLAIN (ANALYZE, BUFFERS) for important queries.
--   3. Run ordinary CREATE INDEX statements through migrations.
--   4. For large production tables, consider CREATE INDEX
--      CONCURRENTLY in a separate migration. PostgreSQL does not
--      allow CREATE INDEX CONCURRENTLY inside a transaction block.
-- ============================================================

-- ============================================================
-- 1. USERS
-- ============================================================

-- Case-insensitive email lookup and uniqueness.
-- Matches the partial unique index in schema.sql.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_lower_idx
    ON users (lower(email))
    WHERE email IS NOT NULL;

-- Phone lookup and uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx
    ON users (phone)
    WHERE phone IS NOT NULL;

-- Administrative user filtering.
CREATE INDEX IF NOT EXISTS users_role_status_idx
    ON users (role, account_status);

-- Recent user registrations and administrative lists.
CREATE INDEX IF NOT EXISTS users_created_at_idx
    ON users (created_at DESC, id DESC);

-- ============================================================
-- 2. APPLICATIONS
-- ============================================================

-- Applicant dashboard: newest applications first.
CREATE INDEX IF NOT EXISTS applications_applicant_created_idx
    ON applications (applicant_id, created_at DESC, id DESC);

-- Staff queues filtered by status.
CREATE INDEX IF NOT EXISTS applications_status_created_idx
    ON applications (status, created_at DESC, id DESC);

-- Filter by application type and academic year.
CREATE INDEX IF NOT EXISTS applications_type_year_idx
    ON applications (application_type, academic_year);

-- Filter by program when a program code is supplied.
CREATE INDEX IF NOT EXISTS applications_program_idx
    ON applications (program_code)
    WHERE program_code IS NOT NULL;

-- Search by application number.
-- The UNIQUE constraint already creates an index on application_number.
-- Do not create a duplicate index here.

-- Search applications by public UUID.
-- The UNIQUE constraint already creates an index on public_id.

-- ============================================================
-- 3. APPLICATION STATUS HISTORY
-- ============================================================

-- Application timeline, newest status changes first.
CREATE INDEX IF NOT EXISTS application_history_resource_idx
    ON application_status_history
       (application_id, created_at DESC, id DESC);

-- Audit workflow changes made by a specific actor.
CREATE INDEX IF NOT EXISTS application_history_actor_idx
    ON application_status_history
       (changed_by, created_at DESC)
    WHERE changed_by IS NOT NULL;

-- Request correlation, where supported by operational queries.
CREATE INDEX IF NOT EXISTS application_history_request_id_idx
    ON application_status_history (request_id)
    WHERE request_id IS NOT NULL;

-- ============================================================
-- 4. AUDIT LOGS
-- ============================================================

-- Default audit-history ordering.
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
    ON audit_logs (created_at DESC, id DESC);

-- Audit history for a particular actor.
CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx
    ON audit_logs (actor_id, created_at DESC, id DESC)
    WHERE actor_id IS NOT NULL;

-- Filter by event action and order by event time.
CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx
    ON audit_logs (action, created_at DESC, id DESC);

-- Resource activity timeline.
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx
    ON audit_logs (resource_type, resource_id)
    WHERE resource_type IS NOT NULL
      AND resource_id IS NOT NULL;

-- Trace events associated with a request.
CREATE INDEX IF NOT EXISTS audit_logs_request_id_idx
    ON audit_logs (request_id)
    WHERE request_id IS NOT NULL;

-- Event ID is UNIQUE in schema.sql, so its index already exists.

-- ============================================================
-- 5. NOTIFICATIONS
-- ============================================================

-- Recipient inbox ordered by creation time.
CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
    ON notifications (recipient_id, created_at DESC, id DESC);

-- Unread notifications for a recipient.
CREATE INDEX IF NOT EXISTS notifications_unread_idx
    ON notifications (recipient_id, created_at DESC, id DESC)
    WHERE read_at IS NULL;

-- Notification categories for a recipient.
CREATE INDEX IF NOT EXISTS notifications_type_created_idx
    ON notifications (recipient_id, type, created_at DESC);

-- Expiration processing.
CREATE INDEX IF NOT EXISTS notifications_expiration_idx
    ON notifications (expires_at)
    WHERE expires_at IS NOT NULL;

-- Notification public UUID is UNIQUE in schema.sql, so its index
-- already exists.

-- ============================================================
-- 6. BACKGROUND WORKER JOBS
-- ============================================================

-- Efficiently locate jobs ready for processing.
CREATE INDEX IF NOT EXISTS worker_jobs_pending_idx
    ON worker_jobs (available_at, id)
    WHERE status = 'pending';

-- Locate stale processing jobs for recovery.
CREATE INDEX IF NOT EXISTS worker_jobs_processing_idx
    ON worker_jobs (locked_at)
    WHERE status = 'processing';

-- Idempotency keys must be unique when supplied.
CREATE UNIQUE INDEX IF NOT EXISTS worker_jobs_idempotency_unique_idx
    ON worker_jobs (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Worker job public UUID is UNIQUE in schema.sql, so its index
-- already exists.

-- ============================================================
-- 7. OPTIONAL INDEXES
-- Enable these only if the corresponding queries exist.
-- ============================================================

-- Application lists filtered by institution and status:
--
-- CREATE INDEX IF NOT EXISTS applications_institution_status_idx
--     ON applications (institution_id, status, created_at DESC)
--     WHERE institution_id IS NOT NULL;

-- Application lists filtered by submission time:
--
-- CREATE INDEX IF NOT EXISTS applications_submitted_at_idx
--     ON applications (submitted_at DESC)
--     WHERE submitted_at IS NOT NULL;

-- Recent completed jobs:
--
-- CREATE INDEX IF NOT EXISTS worker_jobs_completed_idx
--     ON worker_jobs (completed_at DESC)
--     WHERE status = 'completed';

-- ============================================================
-- 8. POST-DEPLOYMENT MAINTENANCE
-- ============================================================

-- Run these separately as appropriate for your environment.
-- ANALYZE updates planner statistics.
--
-- ANALYZE users;
-- ANALYZE applications;
-- ANALYZE application_status_history;
-- ANALYZE audit_logs;
-- ANALYZE notifications;
-- ANALYZE worker_jobs;

-- Example query-plan inspection:
--
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT id, status, created_at
-- FROM applications
-- WHERE applicant_id = 123
-- ORDER BY created_at DESC, id DESC
-- LIMIT 25;

-- ============================================================
-- END OF INDEX DEFINITIONS
-- ============================================================
