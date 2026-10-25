
-- ============================================================
-- MedOrbits Database Schema
-- File: database/schema.sql
-- Runtime: PostgreSQL 14+
-- Purpose: Core schema for education, admissions, careers,
--          application workflows, auditing, and notifications.
--
-- IMPORTANT:
-- Review this schema against existing migrations before applying.
-- Do not run over a production database without a backup and
-- a reviewed migration plan.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. USERS
-- ============================================================

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

-- ============================================================
-- 2. APPLICATIONS
-- ============================================================

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

-- ============================================================
-- 3. APPLICATION STATUS HISTORY
-- ============================================================

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
    ON application_status_history
       (application_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS application_history_actor_idx
    ON application_status_history
       (changed_by, created_at DESC);

-- ============================================================
-- 4. AUDIT LOGS
-- Append-only at the application API level.
-- Enforce immutability using database permissions and/or triggers.
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,

    event_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

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
        CHECK (
            outcome IN (
                'success',
                'failure',
                'denied',
                'error'
            )
        ),

    CONSTRAINT audit_logs_metadata_object
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
    ON audit_logs (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx
    ON audit_logs (actor_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx
    ON audit_logs (action, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS audit_logs_resource_idx
    ON audit_logs (resource_type, resource_id);

CREATE INDEX IF NOT EXISTS audit_logs_request_id_idx
    ON audit_logs (request_id)
    WHERE request_id IS NOT NULL;

-- ============================================================
-- 5. NOTIFICATIONS
-- One row represents one recipient's in-app notification.
-- ============================================================

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
        CHECK (
            priority IN (
                'low',
                'normal',
                'high',
                'urgent'
            )
        ),

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

-- ============================================================
-- 6. BACKGROUND WORKER JOBS
-- Supports an outbox-style workflow for asynchronous processing.
-- ============================================================

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

CREATE UNIQUE INDEX IF NOT EXISTS worker_jobs_idempotency_unique_idx
    ON worker_jobs (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS worker_jobs_pending_idx
    ON worker_jobs (available_at, id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS worker_jobs_processing_idx
    ON worker_jobs (locked_at)
    WHERE status = 'processing';

-- ============================================================
-- 7. UPDATED_AT TRIGGER
-- Maintains updated_at on supported tables.
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
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

COMMIT;

-- ============================================================
-- END OF CORE SCHEMA
-- ============================================================
