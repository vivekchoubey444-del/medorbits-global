-- ============================================================
-- MedOrbits Database Constraints
-- File: database/constraints.sql
-- Database: PostgreSQL 14+
--
-- Purpose:
--   Validate data integrity for users, applications, status
--   history, application files, access requests, audit logs,
--   notifications, and background worker jobs.
--
-- IMPORTANT:
--   Run database/schema.sql first.
--   Review existing data before adding constraints.
--   This script does not replace versioned migrations.
--   Back up production data before applying changes.
-- ============================================================
BEGIN;
CREATE SCHEMA IF NOT EXISTS medorbits;
SET LOCAL search_path TO medorbits, public;
-- ============================================================
-- 0. VERIFY REQUIRED TABLES
-- ============================================================
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'users',
        'applications',
        'application_status_history',
        'application_files',
        'access_requests',
        'audit_logs',
        'notifications',
        'worker_jobs'
    ]
    LOOP
        IF to_regclass('medorbits.' || table_name) IS NULL THEN
            RAISE EXCEPTION
                'Required table medorbits.% does not exist. Run database/schema.sql first.',
                table_name;
        END IF;
    END LOOP;
END;
$$;
-- ============================================================
-- 1. USERS
-- ============================================================
ALTER TABLE medorbits.users
    ADD CONSTRAINT users_role_nonempty
    CHECK (length(trim(role)) > 0)
    NOT VALID;
ALTER TABLE medorbits.users
    ADD CONSTRAINT users_account_status_check
    CHECK (
        account_status IN (
            'pending',
            'active',
            'suspended',
            'disabled',
            'deleted'
        )
    )
    NOT VALID;
ALTER TABLE medorbits.users
    ADD CONSTRAINT users_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
    NOT VALID;
-- ============================================================
-- 2. APPLICATIONS
-- ============================================================
ALTER TABLE medorbits.applications
    ADD CONSTRAINT applications_type_nonempty
    CHECK (length(trim(application_type)) > 0)
    NOT VALID;
ALTER TABLE medorbits.applications
    ADD CONSTRAINT applications_status_check
    CHECK (
        status IN (
            'draft',
            'submitted',
            'under_review',
            'documents_required',
            'approved',
            'rejected',
            'withdrawn'
        )
    )
    NOT VALID;
ALTER TABLE medorbits.applications
    ADD CONSTRAINT applications_version_positive
    CHECK (version > 0)
    NOT VALID;
ALTER TABLE medorbits.applications
    ADD CONSTRAINT applications_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
    NOT VALID;
-- ============================================================
-- 3. APPLICATION STATUS HISTORY
-- ============================================================
ALTER TABLE medorbits.application_status_history
    ADD CONSTRAINT application_history_new_status_check
    CHECK (
        new_status IN (
            'draft',
            'submitted',
            'under_review',
            'documents_required',
            'approved',
            'rejected',
            'withdrawn'
        )
    )
    NOT VALID;
ALTER TABLE medorbits.application_status_history
    ADD CONSTRAINT application_history_previous_status_check
    CHECK (
        previous_status IS NULL
        OR previous_status IN (
            'draft',
            'submitted',
            'under_review',
            'documents_required',
            'approved',
            'rejected',
            'withdrawn'
        )
    )
    NOT VALID;
ALTER TABLE medorbits.application_status_history
    ADD CONSTRAINT application_history_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
    NOT VALID;
-- ============================================================
-- 4. APPLICATION FILES
-- ============================================================
ALTER TABLE medorbits.application_files
    ADD CONSTRAINT application_files_size_positive
    CHECK (file_size_bytes > 0)
    NOT VALID;
ALTER TABLE medorbits.application_files
    ADD CONSTRAINT application_files_filename_nonempty
    CHECK (length(trim(original_filename)) > 0)
    NOT VALID;
ALTER TABLE medorbits.application_files
    ADD CONSTRAINT application_files_storage_key_nonempty
    CHECK (length(trim(storage_key)) > 0)
    NOT VALID;
ALTER TABLE medorbits.application_files
    ADD CONSTRAINT application_files_scan_status_check
    CHECK (
        scan_status IN (
            'pending',
            'clean',
            'infected',
            'failed'
        )
    )
    NOT VALID;
ALTER TABLE medorbits.application_files
    ADD CONSTRAINT application_files_checksum_format
    CHECK (
        checksum_sha256 IS NULL
        OR checksum_sha256 ~ '^[0-9a-fA-F]{64}$'
    )
    NOT VALID;
-- ============================================================
-- 5. ACCESS REQUESTS
-- ============================================================
ALTER TABLE medorbits.access_requests
    ADD CONSTRAINT access_requests_email_nonempty
    CHECK (length(trim(email)) > 0)
    NOT VALID;
ALTER TABLE medorbits.access_requests
    ADD CONSTRAINT access_requests_status_check
    CHECK (
        status IN (
            'pending',
            'approved',
            'rejected',
            'cancelled'
        )
    )
    NOT VALID;
ALTER TABLE medorbits.access_requests
    ADD CONSTRAINT access_requests_resource_nonempty
    CHECK (
        resource IS NULL
        OR length(trim(resource)) > 0
    )
    NOT VALID;
-- ============================================================
-- 6. AUDIT LOGS
-- ============================================================
ALTER TABLE medorbits.audit_logs
    ADD CONSTRAINT audit_logs_action_nonempty
    CHECK (length(trim(action)) > 0)
    NOT VALID;
ALTER TABLE medorbits.audit_logs
    ADD CONSTRAINT audit_logs_outcome_check
    CHECK (
        outcome IN (
            'success',
            'failure',
            'denied',
            'error'
        )
    )
    NOT VALID;
ALTER TABLE medorbits.audit_logs
    ADD CONSTRAINT audit_logs_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
    NOT VALID;
-- ============================================================
-- 7. NOTIFICATIONS
-- ============================================================
ALTER TABLE medorbits.notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (
        type IN (
            'general',
            'account',
            'application',
            'admission',
            'document',
            'payment',
            'security',
            'system',
            'support',
            'career'
        )
    )
    NOT VALID;
ALTER TABLE medorbits.notifications
    ADD CONSTRAINT notifications_priority_check
    CHECK (
        priority IN (
            'low',
            'normal',
            'high',
            'urgent'
        )
    )
    NOT VALID;
ALTER TABLE medorbits.notifications
    ADD CONSTRAINT notifications_title_nonempty
    CHECK (length(trim(title)) > 0)
    NOT VALID;
ALTER TABLE medorbits.notifications
    ADD CONSTRAINT notifications_message_nonempty
    CHECK (length(trim(message)) > 0)
    NOT VALID;
ALTER TABLE medorbits.notifications
    ADD CONSTRAINT notifications_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
    NOT VALID;
-- ============================================================
-- 8. BACKGROUND WORKER JOBS
-- ============================================================
ALTER TABLE medorbits.worker_jobs
    ADD CONSTRAINT worker_jobs_type_nonempty
    CHECK (length(trim(job_type)) > 0)
    NOT VALID;
ALTER TABLE medorbits.worker_jobs
    ADD CONSTRAINT worker_jobs_status_check
    CHECK (
        status IN (
            'pending',
            'processing',
            'completed',
            'failed',
            'cancelled'
        )
    )
    NOT VALID;
ALTER TABLE medorbits.worker_jobs
    ADD CONSTRAINT worker_jobs_attempts_check
    CHECK (attempts >= 0 AND max_attempts > 0)
    NOT VALID;
ALTER TABLE medorbits.worker_jobs
    ADD CONSTRAINT worker_jobs_payload_object
    CHECK (jsonb_typeof(payload) = 'object')
    NOT VALID;
-- ============================================================
-- 9. VALIDATE ALL CONSTRAINTS
-- ============================================================
-- NOT VALID lets PostgreSQL add a CHECK constraint without
-- immediately scanning every existing row. New or updated rows
-- are still checked. Validation below checks existing data.
--
-- If existing data violates a constraint, this transaction
-- fails and rolls back. Correct the data before retrying.
ALTER TABLE medorbits.users
    VALIDATE CONSTRAINT users_role_nonempty;
ALTER TABLE medorbits.users
    VALIDATE CONSTRAINT users_account_status_check;
ALTER TABLE medorbits.users
    VALIDATE CONSTRAINT users_metadata_object;
ALTER TABLE medorbits.applications
    VALIDATE CONSTRAINT applications_type_nonempty;
ALTER TABLE medorbits.applications
    VALIDATE CONSTRAINT applications_status_check;
ALTER TABLE medorbits.applications
    VALIDATE CONSTRAINT applications_version_positive;
ALTER TABLE medorbits.applications
    VALIDATE CONSTRAINT applications_metadata_object;
ALTER TABLE medorbits.application_status_history
    VALIDATE CONSTRAINT application_history_new_status_check;
ALTER TABLE medorbits.application_status_history
    VALIDATE CONSTRAINT application_history_previous_status_check;
ALTER TABLE medorbits.application_status_history
    VALIDATE CONSTRAINT application_history_metadata_object;
ALTER TABLE medorbits.application_files
    VALIDATE CONSTRAINT application_files_size_positive;
ALTER TABLE medorbits.application_files
    VALIDATE CONSTRAINT application_files_filename_nonempty;
ALTER TABLE medorbits.application_files
    VALIDATE CONSTRAINT application_files_storage_key_nonempty;
ALTER TABLE medorbits.application_files
    VALIDATE CONSTRAINT application_files_scan_status_check;
ALTER TABLE medorbits.application_files
    VALIDATE CONSTRAINT application_files_checksum_format;
ALTER TABLE medorbits.access_requests
    VALIDATE CONSTRAINT access_requests_email_nonempty;
ALTER TABLE medorbits.access_requests
    VALIDATE CONSTRAINT access_requests_status_check;
ALTER TABLE medorbits.access_requests
    VALIDATE CONSTRAINT access_requests_resource_nonempty;
ALTER TABLE medorbits.audit_logs
    VALIDATE CONSTRAINT audit_logs_action_nonempty;
ALTER TABLE medorbits.audit_logs
    VALIDATE CONSTRAINT audit_logs_outcome_check;
ALTER TABLE medorbits.audit_logs
    VALIDATE CONSTRAINT audit_logs_metadata_object;
ALTER TABLE medorbits.notifications
    VALIDATE CONSTRAINT notifications_type_check;
ALTER TABLE medorbits.notifications
    VALIDATE CONSTRAINT notifications_priority_check;
ALTER TABLE medorbits.notifications
    VALIDATE CONSTRAINT notifications_title_nonempty;
ALTER TABLE medorbits.notifications
    VALIDATE CONSTRAINT notifications_message_nonempty;
ALTER TABLE medorbits.notifications
    VALIDATE CONSTRAINT notifications_metadata_object;
ALTER TABLE medorbits.worker_jobs
    VALIDATE CONSTRAINT worker_jobs_type_nonempty;
ALTER TABLE medorbits.worker_jobs
    VALIDATE CONSTRAINT worker_jobs_status_check;
ALTER TABLE medorbits.worker_jobs
    VALIDATE CONSTRAINT worker_jobs_attempts_check;
ALTER TABLE medorbits.worker_jobs
    VALIDATE CONSTRAINT worker_jobs_payload_object;
COMMIT;
-- ============================================================
-- END OF MEDORBITS DATABASE CONSTRAINTS
-- ============================================================