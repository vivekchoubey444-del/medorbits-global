
-- ============================================================
-- MedOrbits Database Constraints
-- File: database/constraints.sql
-- Database: PostgreSQL
--
-- Purpose:
--   Enforce data integrity across core MedOrbits tables.
--
-- IMPORTANT:
--   - Apply after the corresponding tables exist.
--   - Review existing data before adding constraints.
--   - Existing constraints may use different names.
--   - This script does not replace versioned migrations.
--   - Do not run against production without a backup and review.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. USERS
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND conname = 'users_role_nonempty'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_role_nonempty
            CHECK (length(trim(role)) > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND conname = 'users_account_status_check'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_account_status_check
            CHECK (
                account_status IN (
                    'pending',
                    'active',
                    'suspended',
                    'disabled',
                    'deleted'
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass
          AND conname = 'users_metadata_object'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_metadata_object
            CHECK (jsonb_typeof(metadata) = 'object');
    END IF;
END;
$$;

-- ============================================================
-- 2. APPLICATIONS
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'applications'::regclass
          AND conname = 'applications_type_nonempty'
    ) THEN
        ALTER TABLE applications
            ADD CONSTRAINT applications_type_nonempty
            CHECK (length(trim(application_type)) > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'applications'::regclass
          AND conname = 'applications_status_check'
    ) THEN
        ALTER TABLE applications
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
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'applications'::regclass
          AND conname = 'applications_version_positive'
    ) THEN
        ALTER TABLE applications
            ADD CONSTRAINT applications_version_positive
            CHECK (version > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'applications'::regclass
          AND conname = 'applications_metadata_object'
    ) THEN
        ALTER TABLE applications
            ADD CONSTRAINT applications_metadata_object
            CHECK (jsonb_typeof(metadata) = 'object');
    END IF;
END;
$$;

-- ============================================================
-- 3. APPLICATION STATUS HISTORY
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'application_status_history'::regclass
          AND conname = 'application_history_new_status_check'
    ) THEN
        ALTER TABLE application_status_history
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
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'application_status_history'::regclass
          AND conname = 'application_history_previous_status_check'
    ) THEN
        ALTER TABLE application_status_history
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
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'application_status_history'::regclass
          AND conname = 'application_history_metadata_object'
    ) THEN
        ALTER TABLE application_status_history
            ADD CONSTRAINT application_history_metadata_object
            CHECK (jsonb_typeof(metadata) = 'object');
    END IF;
END;
$$;

-- ============================================================
-- 4. AUDIT LOGS
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'audit_logs'::regclass
          AND conname = 'audit_logs_action_nonempty'
    ) THEN
        ALTER TABLE audit_logs
            ADD CONSTRAINT audit_logs_action_nonempty
            CHECK (length(trim(action)) > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'audit_logs'::regclass
          AND conname = 'audit_logs_outcome_check'
    ) THEN
        ALTER TABLE audit_logs
            ADD CONSTRAINT audit_logs_outcome_check
            CHECK (
                outcome IN (
                    'success',
                    'failure',
                    'denied',
                    'error'
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'audit_logs'::regclass
          AND conname = 'audit_logs_metadata_object'
    ) THEN
        ALTER TABLE audit_logs
            ADD CONSTRAINT audit_logs_metadata_object
            CHECK (jsonb_typeof(metadata) = 'object');
    END IF;
END;
$$;

-- ============================================================
-- 5. NOTIFICATIONS
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'notifications'::regclass
          AND conname = 'notifications_type_check'
    ) THEN
        ALTER TABLE notifications
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
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'notifications'::regclass
          AND conname = 'notifications_priority_check'
    ) THEN
        ALTER TABLE notifications
            ADD CONSTRAINT notifications_priority_check
            CHECK (
                priority IN (
                    'low',
                    'normal',
                    'high',
                    'urgent'
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'notifications'::regclass
          AND conname = 'notifications_title_nonempty'
    ) THEN
        ALTER TABLE notifications
            ADD CONSTRAINT notifications_title_nonempty
            CHECK (length(trim(title)) > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'notifications'::regclass
          AND conname = 'notifications_message_nonempty'
    ) THEN
        ALTER TABLE notifications
            ADD CONSTRAINT notifications_message_nonempty
            CHECK (length(trim(message)) > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'notifications'::regclass
          AND conname = 'notifications_metadata_object'
    ) THEN
        ALTER TABLE notifications
            ADD CONSTRAINT notifications_metadata_object
            CHECK (jsonb_typeof(metadata) = 'object');
    END IF;
END;
$$;

-- ============================================================
-- 6. WORKER JOBS
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'worker_jobs'::regclass
          AND conname = 'worker_jobs_type_nonempty'
    ) THEN
        ALTER TABLE worker_jobs
            ADD CONSTRAINT worker_jobs_type_nonempty
            CHECK (length(trim(job_type)) > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'worker_jobs'::regclass
          AND conname = 'worker_jobs_status_check'
    ) THEN
        ALTER TABLE worker_jobs
            ADD CONSTRAINT worker_jobs_status_check
            CHECK (
                status IN (
                    'pending',
                    'processing',
                    'completed',
                    'failed',
                    'cancelled'
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'worker_jobs'::regclass
          AND conname = 'worker_jobs_attempts_check'
    ) THEN
        ALTER TABLE worker_jobs
            ADD CONSTRAINT worker_jobs_attempts_check
            CHECK (attempts >= 0 AND max_attempts > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'worker_jobs'::regclass
          AND conname = 'worker_jobs_payload_object'
    ) THEN
        ALTER TABLE worker_jobs
            ADD CONSTRAINT worker_jobs_payload_object
            CHECK (jsonb_typeof(payload) = 'object');
    END IF;
END;
$$;

COMMIT;

-- ============================================================
-- END OF CONSTRAINT DEFINITIONS
-- ============================================================
