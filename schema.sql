
-- =============================================================================
-- MedOrbits Database Schema
-- File: database/schema.sql
-- Database: PostgreSQL 14+
-- Schema: medorbits
--
-- Core tables:
--   1. applications
--   2. application_files
--   3. access_requests
--   4. audit_logs
--
-- Notes:
--   - Run with a migration-capable database role.
--   - Back up existing data before applying schema changes.
--   - This script is safe to rerun for objects defined here, but CREATE TABLE
--     IF NOT EXISTS does not migrate an existing table's columns or constraints.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Extensions and schema
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS medorbits;

-- ---------------------------------------------------------------------------
-- 2. Applications
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS medorbits.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    application_number VARCHAR(40) NOT NULL UNIQUE
        CHECK (length(trim(application_number)) > 0),

    applicant_name VARCHAR(200) NOT NULL
        CHECK (length(trim(applicant_name)) > 0),

    applicant_email VARCHAR(254) NOT NULL
        CHECK (
            applicant_email = trim(applicant_email)
            AND applicant_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        ),

    applicant_phone VARCHAR(30),

    application_type VARCHAR(80) NOT NULL
        CHECK (length(trim(application_type)) > 0),

    course_name VARCHAR(200),

    status VARCHAR(30) NOT NULL DEFAULT 'submitted'
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

    assigned_to UUID,

    applicant_data JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(applicant_data) = 'object'),

    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        status NOT IN (
            'submitted',
            'under_review',
            'documents_required',
            'approved',
            'rejected'
        )
        OR submitted_at IS NOT NULL
    ),

    CHECK (
        status NOT IN ('approved', 'rejected')
        OR reviewed_at IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_applications_status_created
    ON medorbits.applications (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_applications_email
    ON medorbits.applications (lower(applicant_email));

CREATE INDEX IF NOT EXISTS idx_applications_created_at
    ON medorbits.applications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_applications_assigned_to
    ON medorbits.applications (assigned_to, status, created_at DESC)
    WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_applications_submitted_at
    ON medorbits.applications (submitted_at DESC)
    WHERE submitted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Application files
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS medorbits.application_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    application_id UUID NOT NULL
        REFERENCES medorbits.applications(id)
        ON DELETE RESTRICT,

    original_filename VARCHAR(255) NOT NULL
        CHECK (
            length(trim(original_filename)) > 0
            AND original_filename !~ '[/\\]'
        ),

    storage_key TEXT NOT NULL UNIQUE
        CHECK (length(trim(storage_key)) > 0),

    mime_type VARCHAR(150) NOT NULL
        CHECK (length(trim(mime_type)) > 0),

    file_size_bytes BIGINT NOT NULL
        CHECK (file_size_bytes > 0),

    sha256_hex CHAR(64)
        CHECK (
            sha256_hex IS NULL
            OR sha256_hex ~ '^[a-fA-F0-9]{64}$'
        ),

    document_type VARCHAR(80) NOT NULL
        CHECK (length(trim(document_type)) > 0),

    uploaded_by UUID,

    scan_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            scan_status IN (
                'pending',
                'clean',
                'infected',
                'failed'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_files_application
    ON medorbits.application_files (application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_application_files_scan_status
    ON medorbits.application_files (scan_status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_application_files_uploaded_by
    ON medorbits.application_files (uploaded_by, created_at DESC)
    WHERE uploaded_by IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Access requests
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS medorbits.access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    requester_email VARCHAR(254) NOT NULL
        CHECK (
            requester_email = trim(requester_email)
            AND requester_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        ),

    requester_name VARCHAR(200),

    resource_type VARCHAR(80) NOT NULL
        CHECK (length(trim(resource_type)) > 0),

    resource_id UUID,

    reason TEXT
        CHECK (reason IS NULL OR length(reason) <= 5000),

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'approved',
                'rejected',
                'revoked',
                'expired'
            )
        ),

    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        status NOT IN ('approved', 'rejected', 'revoked')
        OR reviewed_at IS NOT NULL
    ),

    CHECK (
        expires_at IS NULL
        OR expires_at > created_at
    )
);

CREATE INDEX IF NOT EXISTS idx_access_requests_status_created
    ON medorbits.access_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_requests_email
    ON medorbits.access_requests (lower(requester_email));

CREATE INDEX IF NOT EXISTS idx_access_requests_resource
    ON medorbits.access_requests (resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_access_requests_reviewer
    ON medorbits.access_requests (reviewed_by, reviewed_at DESC)
    WHERE reviewed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_access_requests_expiration
    ON medorbits.access_requests (expires_at)
    WHERE status = 'approved'
      AND expires_at IS NOT NULL;

-- Prevent multiple pending requests for the same email and resource.
-- NULL resource IDs are treated as a general resource request.
CREATE UNIQUE INDEX IF NOT EXISTS uq_access_requests_pending_resource
    ON medorbits.access_requests (
        lower(requester_email),
        resource_type,
        COALESCE(resource_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- 5. Audit logs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS medorbits.audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    event_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    actor_id UUID,

    actor_type VARCHAR(30) NOT NULL DEFAULT 'system'
        CHECK (
            actor_type IN (
                'system',
                'user',
                'admin',
                'service',
                'anonymous'
            )
        ),

    action VARCHAR(120) NOT NULL
        CHECK (length(trim(action)) > 0),

    resource_type VARCHAR(100),
    resource_id TEXT,

    -- Request IDs generated by this application are UUIDs.
    request_id UUID,

    ip_address INET,

    outcome VARCHAR(20) NOT NULL DEFAULT 'success'
        CHECK (
            outcome IN (
                'success',
                'failure',
                'denied'
            )
        ),

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(metadata) = 'object'),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON medorbits.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
    ON medorbits.audit_logs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
    ON medorbits.audit_logs (resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON medorbits.audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_request
    ON medorbits.audit_logs (request_id)
    WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_failures
    ON medorbits.audit_logs (created_at DESC, outcome)
    WHERE outcome IN ('failure', 'denied');

-- ---------------------------------------------------------------------------
-- 6. Automatic updated_at maintenance
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION medorbits.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS applications_set_updated_at
    ON medorbits.applications;

CREATE TRIGGER applications_set_updated_at
BEFORE UPDATE ON medorbits.applications
FOR EACH ROW
EXECUTE FUNCTION medorbits.set_updated_at();

DROP TRIGGER IF EXISTS access_requests_set_updated_at
    ON medorbits.access_requests;

CREATE TRIGGER access_requests_set_updated_at
BEFORE UPDATE ON medorbits.access_requests
FOR EACH ROW
EXECUTE FUNCTION medorbits.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Restrict accidental audit-log modification
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION medorbits.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
    RAISE EXCEPTION 'Audit log records are append-only.'
        USING ERRCODE = '55000';
END;
$function$;

DROP TRIGGER IF EXISTS audit_logs_no_update
    ON medorbits.audit_logs;

CREATE TRIGGER audit_logs_no_update
BEFORE UPDATE OR DELETE ON medorbits.audit_logs
FOR EACH ROW
EXECUTE FUNCTION medorbits.prevent_audit_log_mutation();

COMMIT;

-- =============================================================================
-- End of MedOrbits core schema
-- =============================================================================
