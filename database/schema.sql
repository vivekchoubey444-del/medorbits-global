
-- =============================================================================
-- MedOrbits Database Schema
-- File: database/schema.sql
-- Version: 3.3.0
-- Runtime: PostgreSQL 14+
--
-- Purpose:
-- Users, applications, application status history, application files,
-- access requests, audit logs, notifications, and background worker jobs.
--
-- IMPORTANT:
-- - Review existing migrations before applying.
-- - CREATE TABLE IF NOT EXISTS does not migrate existing tables.
-- - Back up production databases before applying.
-- - Application authorization and file storage security are enforced outside
--   this schema.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS medorbits;

SET LOCAL search_path TO medorbits, public;

-- =============================================================================
-- 1. USERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    email VARCHAR(320),
    phone VARCHAR(32),
    password_hash TEXT,
    full_name VARCHAR(200),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    account_status VARCHAR(30) NOT NULL DEFAULT 'active',
    email_verified_at TIMESTAMPTZ,
    phone_verified_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_role_nonempty
        CHECK (length(trim(role)) > 0),

    CONSTRAINT users_account_status_check
        CHECK (
            account_status IN (
                'pending',
                'active',
                'suspended',
                'disabled',
                'deleted'
            )
        ),

    CONSTRAINT users_metadata_object
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_lower_idx
    ON users (lower(email))
    WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx
    ON users (phone)
    WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_role_status_idx
    ON users (role, account_status);

-- =============================================================================
-- 2. APPLICATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS applications (
    id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    applicant_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,
    application_number VARCHAR(80) UNIQUE,
    application_type VARCHAR(80) NOT NULL,
    program_code VARCHAR(100),
    institution_id BIGINT,
    academic_year VARCHAR(20),
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    title VARCHAR(250),
    applicant_notes TEXT,
    staff_notes TEXT,
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT applications_type_nonempty
        CHECK (length(trim(application_type)) > 0),

    CONSTRAINT applications_status_check
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
        ),

    CONSTRAINT applications_version_positive
        CHECK (version > 0),

    CONSTRAINT applications_metadata_object
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS applications_applicant_created_idx
    ON applications (applicant_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS applications_status_created_idx
    ON applications (status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS applications_type_year_idx
    ON applications (application_type, academic_year);

CREATE INDEX IF NOT EXISTS applications_program_idx
    ON applications (program_code)
    WHERE program_code IS NOT NULL;

-- =============================================================================
-- 3. APPLICATION STATUS HISTORY
-- =============================================================================

CREATE TABLE IF NOT EXISTS application_status_history (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL
        REFERENCES applications(id) ON DELETE RESTRICT,
    previous_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_by BIGINT
        REFERENCES users(id) ON DELETE SET NULL,
    change_reason TEXT,
    request_id VARCHAR(128),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT application_history_new_status_check
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
        ),

    CONSTRAINT application_history_previous_status_check
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
        ),

    CONSTRAINT application_history_metadata_object
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS application_history_resource_idx
    ON application_status_history (
        application_id,
        created_at DESC,
        id DESC
    );

CREATE INDEX IF NOT EXISTS application_history_actor_idx
    ON application_status_history (changed_by, created_at DESC);

-- =============================================================================
-- 4. APPLICATION FILES
-- =============================================================================

CREATE TABLE IF NOT EXISTS application_files (
    id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    application_id BIGINT NOT NULL
        REFERENCES applications(id) ON DELETE RESTRICT,
    original_filename VARCHAR(255) NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    mime_type VARCHAR(150),
    file_size_bytes BIGINT NOT NULL,
    checksum_sha256 CHAR(64),
    scan_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    uploaded_by BIGINT
        REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT application_files_size_positive
        CHECK (file_size_bytes > 0),

    CONSTRAINT application_files_filename_nonempty
        CHECK (length(trim(original_filename)) > 0),

    CONSTRAINT application_files_storage_key_nonempty
        CHECK (length(trim(storage_key)) > 0),

    CONSTRAINT application_files_scan_status_check
        CHECK (
            scan_status IN ('pending', 'clean', 'infected', 'failed')
        ),

    CONSTRAINT application_files_checksum_format
        CHECK (
            checksum_sha256 IS NULL
            OR checksum_sha256 ~ '^[0-9a-fA-F]{64}$'
        )
);

CREATE INDEX IF NOT EXISTS application_files_application_idx
    ON application_files (application_id);

CREATE INDEX IF NOT EXISTS application_files_scan_status_idx
    ON application_files (scan_status);

-- =============================================================================
-- 5. ACCESS REQUESTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS access_requests (
    id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(320) NOT NULL,
    resource VARCHAR(255),
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT access_requests_email_nonempty
        CHECK (length(trim(email)) > 0),

    CONSTRAINT access_requests_status_check
        CHECK (
            status IN ('pending', 'approved', 'rejected', 'cancelled')
        ),

    CONSTRAINT access_requests_resource_nonempty
        CHECK (resource IS NULL OR length(trim(resource)) > 0)
);

CREATE INDEX IF NOT EXISTS access_requests_email_idx
    ON access_requests (lower(email));

CREATE INDEX IF NOT EXISTS access_requests_status_idx
    ON access_requests (status);

CREATE UNIQUE INDEX IF NOT EXISTS access_requests_pending_resource_uq
    ON access_requests (lower(email), resource)
    WHERE status = 'pending' AND resource IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS access_requests_pending_general_uq
    ON access_requests (lower(email))
    WHERE status = 'pending' AND resource IS NULL;

-- =============================================================================
-- 6. AUDIT LOGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    actor_id TEXT,
    action VARCHAR(150) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(128),
    outcome VARCHAR(20) NOT NULL DEFAULT 'success',
    request_id VARCHAR(128),
    ip_address INET,
    user_agent VARCHAR(512),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT audit_logs_action_nonempty
        CHECK (length(trim(action)) > 0),

    CONSTRAINT audit_logs_outcome_check
        CHECK (outcome IN ('success', 'failure', 'denied', 'error')),

    CONSTRAINT audit_logs_metadata_object
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS audit_logs_created_idx
    ON audit_logs (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx
    ON audit_logs (actor_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx
    ON audit_logs (action, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS audit_logs_resource_idx
    ON audit_logs (resource_type, resource_id);

CREATE INDEX IF NOT EXISTS audit_logs_request_idx
    ON audit_logs (request_id)
    WHERE request_id IS NOT NULL;

-- =============================================================================
-- 7. NOTIFICATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    recipient_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,
    type VARCHAR(40) NOT NULL DEFAULT 'general',
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    title VARCHAR(250) NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT notifications_type_check
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
        ),

    CONSTRAINT notifications_priority_check
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

    CONSTRAINT notifications_title_nonempty
        CHECK (length(trim(title)) > 0),

    CONSTRAINT notifications_message_nonempty
        CHECK (length(trim(message)) > 0),

    CONSTRAINT notifications_metadata_object
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
    ON notifications (recipient_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS notifications_unread_idx
    ON notifications (recipient_id, created_at DESC, id DESC)
    WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_expiration_idx
    ON notifications (expires_at)
    WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_type_created_idx
    ON notifications (recipient_id, type, created_at DESC);

-- =============================================================================
-- 8. BACKGROUND WORKER JOBS
-- =============================================================================

CREATE TABLE IF NOT EXISTS worker_jobs (
    id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    job_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key VARCHAR(200),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(150),
    last_error TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT worker_jobs_type_nonempty
        CHECK (length(trim(job_type)) > 0),

    CONSTRAINT worker_jobs_status_check
        CHECK (
            status IN (
                'pending',
                'processing',
                'completed',
                'failed',
                'cancelled'
            )
        ),

    CONSTRAINT worker_jobs_attempts_check
        CHECK (attempts >= 0 AND max_attempts > 0),

    CONSTRAINT worker_jobs_payload_object
        CHECK (jsonb_typeof(payload) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS worker_jobs_idempotency_uq
    ON worker_jobs (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS worker_jobs_pending_idx
    ON worker_jobs (available_at, id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS worker_jobs_processing_idx
    ON worker_jobs (locked_at)
    WHERE status = 'processing';

-- =============================================================================
-- 9. UPDATED_AT TRIGGER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
    NEW.updated_at := statement_timestamp();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS applications_set_updated_at ON applications;

CREATE TRIGGER applications_set_updated_at
BEFORE UPDATE ON applications
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS access_requests_set_updated_at ON access_requests;

CREATE TRIGGER access_requests_set_updated_at
BEFORE UPDATE ON access_requests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS notifications_set_updated_at ON notifications;

CREATE TRIGGER notifications_set_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS worker_jobs_set_updated_at ON worker_jobs;

CREATE TRIGGER worker_jobs_set_updated_at
BEFORE UPDATE ON worker_jobs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 10. APPLICATION STATUS HISTORY AUTOMATION
--
-- Records status transitions in the same transaction as the application update.
--
-- Optional transaction-local context:
--   SET LOCAL app.user_id = '123';
--   SET LOCAL app.request_id = 'request-identifier';
--
-- Only set app.user_id from trusted server-side authentication context.
-- A custom PostgreSQL setting is not independently proof of identity.
-- =============================================================================

CREATE OR REPLACE FUNCTION record_application_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, medorbits
AS $$
DECLARE
    v_actor_text TEXT;
    v_actor_id BIGINT;
    v_request_id TEXT;
BEGIN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    v_actor_text :=
        NULLIF(current_setting('app.user_id', true), '');

    IF v_actor_text IS NOT NULL THEN
        IF v_actor_text !~ '^[0-9]+$' THEN
            RAISE EXCEPTION 'Invalid app.user_id transaction setting';
        END IF;

        v_actor_id := v_actor_text::BIGINT;
    END IF;

    v_request_id :=
        NULLIF(current_setting('app.request_id', true), '');

    INSERT INTO medorbits.application_status_history (
        application_id,
        previous_status,
        new_status,
        changed_by,
        request_id,
        metadata
    )
    VALUES (
        NEW.id,
        OLD.status,
        NEW.status,
        v_actor_id,
        v_request_id,
        jsonb_build_object('source', 'database_trigger')
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applications_status_history_trigger
    ON applications;

CREATE TRIGGER applications_status_history_trigger
AFTER UPDATE OF status ON applications
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION record_application_status_change();

-- =============================================================================
-- 11. AUDIT LOG IMMUTABILITY
--
-- Protects ordinary UPDATE, DELETE and TRUNCATE operations.
-- This is not tamper-proof against database owners or superusers.
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION
        'audit_logs is append-only; mutation is prohibited';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;

CREATE TRIGGER audit_logs_no_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON audit_logs;

CREATE TRIGGER audit_logs_no_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_logs_no_truncate ON audit_logs;

CREATE TRIGGER audit_logs_no_truncate
BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_audit_log_mutation();

-- =============================================================================
-- 12. APPLICATION HISTORY IMMUTABILITY
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_application_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION
        'application_status_history is append-only';
END;
$$;

DROP TRIGGER IF EXISTS application_history_no_update
    ON application_status_history;

CREATE TRIGGER application_history_no_update
BEFORE UPDATE ON application_status_history
FOR EACH ROW
EXECUTE FUNCTION prevent_application_history_mutation();

DROP TRIGGER IF EXISTS application_history_no_delete
    ON application_status_history;

CREATE TRIGGER application_history_no_delete
BEFORE DELETE ON application_status_history
FOR EACH ROW
EXECUTE FUNCTION prevent_application_history_mutation();

DROP TRIGGER IF EXISTS application_history_no_truncate
    ON application_status_history;

CREATE TRIGGER application_history_no_truncate
BEFORE TRUNCATE ON application_status_history
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_application_history_mutation();

-- =============================================================================
-- 13. BASIC SCHEMA VERIFICATION
-- =============================================================================

DO $$
DECLARE
    required_table TEXT;
BEGIN
    FOREACH required_table IN ARRAY ARRAY[
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
        IF to_regclass('medorbits.' || required_table) IS NULL THEN
            RAISE EXCEPTION
                'Required table missing: medorbits.%', required_table;
        END IF;
    END LOOP;
END;
$$;

COMMIT;

-- =============================================================================
-- END OF MEDORBITS CORE DATABASE SCHEMA
-- =============================================================================
