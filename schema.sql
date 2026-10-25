-- =============================================================================
-- MedOrbits Database Schema
-- File: database/schema.sql
-- Database: PostgreSQL 14+
-- Schema: medorbits
--
-- Compatible with:
--   - Node.js 20+
--   - Express API server.js
--   - PostgreSQL connection pool through pg
--   - DATABASE_URL environment variable
--
-- Core tables:
--   1. applications
--   2. application_files
--   3. access_requests
--   4. audit_logs
--
-- Supporting objects:
--   - Timestamp maintenance triggers
--   - Application status validation
--   - Append-only audit protection
--   - Query and workflow indexes
--
-- IMPORTANT:
--   1. Back up production data before applying schema changes.
--   2. Run with a migration-capable PostgreSQL role.
--   3. CREATE TABLE IF NOT EXISTS does not migrate existing columns,
--      constraints, or indexes to a new definition.
--   4. This script includes a compatibility migration for audit_logs.request_id.
--   5. Database roles and application permissions must be configured separately.
-- =============================================================================
BEGIN;
SET LOCAL search_path = medorbits, public;
-- =============================================================================
-- 1. EXTENSIONS AND SCHEMA
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS medorbits;
COMMENT ON SCHEMA medorbits IS
    'MedOrbits application data, document workflows, access control requests and audit records.';
-- =============================================================================
-- 2. APPLICATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS medorbits.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_number VARCHAR(40) NOT NULL UNIQUE
        CHECK (
            application_number = trim(application_number)
            AND length(application_number) > 0
        ),
    applicant_name VARCHAR(200) NOT NULL
        CHECK (
            applicant_name = trim(applicant_name)
            AND length(applicant_name) > 0
        ),
    applicant_email VARCHAR(254) NOT NULL
        CHECK (
            applicant_email = trim(applicant_email)
            AND applicant_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        ),
    applicant_phone VARCHAR(30)
        CHECK (
            applicant_phone IS NULL
            OR (
                applicant_phone = trim(applicant_phone)
                AND length(applicant_phone) BETWEEN 1 AND 30
            )
        ),
    application_type VARCHAR(80) NOT NULL
        CHECK (
            application_type = trim(application_type)
            AND length(application_type) > 0
        ),
    course_name VARCHAR(200)
        CHECK (
            course_name IS NULL
            OR (
                course_name = trim(course_name)
                AND length(course_name) > 0
            )
        ),
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
    -- Intentionally not linked to a users table because the current
    -- server.js route structure does not define a canonical users schema.
    assigned_to UUID,
    applicant_data JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(applicant_data) = 'object'),
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT applications_submission_timestamp_check
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
    CONSTRAINT applications_review_timestamp_check
        CHECK (
            status NOT IN ('approved', 'rejected')
            OR reviewed_at IS NOT NULL
        ),
    CONSTRAINT applications_review_order_check
        CHECK (
            reviewed_at IS NULL
            OR submitted_at IS NULL
            OR reviewed_at >= submitted_at
        )
);
COMMENT ON TABLE medorbits.applications IS
    'Stores application submissions and their current processing status.';
COMMENT ON COLUMN medorbits.applications.applicant_data IS
    'Validated application-specific JSON object. Avoid storing secrets or unnecessary sensitive data.';
COMMENT ON COLUMN medorbits.applications.assigned_to IS
    'Optional assigned user UUID. Add a foreign key through a migration after the canonical users table is established.';
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
CREATE INDEX IF NOT EXISTS idx_applications_reviewed_at
    ON medorbits.applications (reviewed_at DESC)
    WHERE reviewed_at IS NOT NULL;
-- Optional JSONB containment searches.
CREATE INDEX IF NOT EXISTS idx_applications_applicant_data_gin
    ON medorbits.applications USING GIN (applicant_data);
-- =============================================================================
-- 3. APPLICATION FILES
-- =============================================================================
CREATE TABLE IF NOT EXISTS medorbits.application_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL
        REFERENCES medorbits.applications(id)
        ON DELETE RESTRICT,
    original_filename VARCHAR(255) NOT NULL
        CHECK (
            original_filename = trim(original_filename)
            AND length(original_filename) > 0
            AND original_filename !~ '[/\\]'
        ),
    -- Store an opaque storage key, never a publicly accessible filesystem path.
    storage_key TEXT NOT NULL UNIQUE
        CHECK (
            storage_key = trim(storage_key)
            AND length(storage_key) > 0
        ),
    mime_type VARCHAR(150) NOT NULL
        CHECK (
            mime_type = trim(mime_type)
            AND length(mime_type) > 0
        ),
    file_size_bytes BIGINT NOT NULL
        CHECK (file_size_bytes > 0),
    sha256_hex CHAR(64)
        CHECK (
            sha256_hex IS NULL
            OR sha256_hex ~ '^[a-fA-F0-9]{64}$'
        ),
    document_type VARCHAR(80) NOT NULL
        CHECK (
            document_type = trim(document_type)
            AND length(document_type) > 0
        ),
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
    scan_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT application_files_scan_timestamp_check
        CHECK (
            scan_status IN ('pending', 'failed')
            OR scan_completed_at IS NOT NULL
        )
);
COMMENT ON TABLE medorbits.application_files IS
    'Stores metadata for files associated with applications. File contents are stored separately.';
COMMENT ON COLUMN medorbits.application_files.storage_key IS
    'Opaque storage identifier. Access must be authorized by the application before a file is retrieved.';
COMMENT ON COLUMN medorbits.application_files.scan_status IS
    'Malware scanning state. A file should not be made available for download until its scan is clean.';
CREATE INDEX IF NOT EXISTS idx_application_files_application
    ON medorbits.application_files (application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_application_files_scan_status
    ON medorbits.application_files (scan_status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_application_files_uploaded_by
    ON medorbits.application_files (uploaded_by, created_at DESC)
    WHERE uploaded_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_application_files_document_type
    ON medorbits.application_files (application_id, document_type);
CREATE INDEX IF NOT EXISTS idx_application_files_hash
    ON medorbits.application_files (sha256_hex)
    WHERE sha256_hex IS NOT NULL;
-- =============================================================================
-- 4. ACCESS REQUESTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS medorbits.access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_email VARCHAR(254) NOT NULL
        CHECK (
            requester_email = trim(requester_email)
            AND requester_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        ),
    requester_name VARCHAR(200)
        CHECK (
            requester_name IS NULL
            OR (
                requester_name = trim(requester_name)
                AND length(requester_name) > 0
            )
        ),
    resource_type VARCHAR(80) NOT NULL
        CHECK (
            resource_type = trim(resource_type)
            AND length(resource_type) > 0
        ),
    resource_id UUID,
    reason TEXT
        CHECK (
            reason IS NULL
            OR length(reason) <= 5000
        ),
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
    CONSTRAINT access_requests_review_timestamp_check
        CHECK (
            status NOT IN ('approved', 'rejected', 'revoked')
            OR reviewed_at IS NOT NULL
        ),
    CONSTRAINT access_requests_expiration_check
        CHECK (
            expires_at IS NULL
            OR expires_at > created_at
        )
);
COMMENT ON TABLE medorbits.access_requests IS
    'Tracks requests for access to protected MedOrbits resources.';
COMMENT ON COLUMN medorbits.access_requests.resource_id IS
    'Optional UUID of the resource. Resource ownership and existence are validated by the relevant application service.';
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
-- Enforce one pending request per email and resource when resource_id is set.
CREATE UNIQUE INDEX IF NOT EXISTS uq_access_requests_pending_resource
    ON medorbits.access_requests (
        lower(requester_email),
        resource_type,
        resource_id
    )
    WHERE status = 'pending'
      AND resource_id IS NOT NULL;
-- Enforce one pending general-resource request per email and resource type.
-- This avoids the sentinel UUID collision possible with COALESCE(resource_id, ...).
CREATE UNIQUE INDEX IF NOT EXISTS uq_access_requests_pending_general
    ON medorbits.access_requests (
        lower(requester_email),
        resource_type
    )
    WHERE status = 'pending'
      AND resource_id IS NULL;
-- =============================================================================
-- 5. AUDIT LOGS
-- =============================================================================
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
        CHECK (
            action = trim(action)
            AND length(action) > 0
        ),
    resource_type VARCHAR(100),
    resource_id TEXT,
    -- server.js accepts safe request IDs that are not necessarily UUIDs.
    -- TEXT is therefore the compatible storage type.
    request_id TEXT
        CHECK (
            request_id IS NULL
            OR length(request_id) BETWEEN 1 AND 100
        ),
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
COMMENT ON TABLE medorbits.audit_logs IS
    'Append-only application audit events for security and operational review.';
COMMENT ON COLUMN medorbits.audit_logs.request_id IS
    'Request identifier from server.js; stored as text because accepted upstream IDs need not be UUIDs.';
COMMENT ON COLUMN medorbits.audit_logs.metadata IS
    'Structured event metadata. Do not store passwords, access tokens, session secrets, or unnecessary personal information.';
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
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_gin
    ON medorbits.audit_logs USING GIN (metadata);
-- =============================================================================
-- 6. AUDIT REQUEST ID COMPATIBILITY MIGRATION
-- =============================================================================
-- Older versions may have defined request_id as UUID.
-- Convert it to TEXT so it matches server.js request ID validation.
-- Existing UUID values remain unchanged as text.
DO $migration$
DECLARE
    column_type TEXT;
BEGIN
    SELECT data_type
      INTO column_type
      FROM information_schema.columns
     WHERE table_schema = 'medorbits'
       AND table_name = 'audit_logs'
       AND column_name = 'request_id';
    IF column_type = 'uuid' THEN
        ALTER TABLE medorbits.audit_logs
            ALTER COLUMN request_id TYPE TEXT
            USING request_id::TEXT;
    END IF;
END;
$migration$;
-- =============================================================================
-- 7. AUTOMATIC updated_at MAINTENANCE
-- =============================================================================
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
-- =============================================================================
-- 8. AUDIT LOG IMMUTABILITY
-- =============================================================================
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
-- Row-level triggers do not protect against TRUNCATE.
-- Add a statement-level trigger to block accidental table truncation.
CREATE OR REPLACE FUNCTION medorbits.prevent_audit_log_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
    RAISE EXCEPTION 'Audit log records cannot be truncated.'
        USING ERRCODE = '55000';
END;
$function$;
DROP TRIGGER IF EXISTS audit_logs_no_truncate
    ON medorbits.audit_logs;
CREATE TRIGGER audit_logs_no_truncate
BEFORE TRUNCATE ON medorbits.audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION medorbits.prevent_audit_log_truncate();
-- =============================================================================
-- 9. PRIVILEGE CONFIGURATION GUIDANCE
-- =============================================================================
-- Create database roles separately using your deployment's database
-- administration process. Do not embed credentials in this schema file.
--
-- Recommended separation:
--
--   Migration role:
--     Owns the schema and performs controlled DDL migrations.
--
--   Application role:
--     Receives only the SELECT, INSERT, UPDATE and DELETE permissions
--     required by the API. It should not own the schema or create objects.
--
-- Audit logs:
--     The application role should receive INSERT and SELECT only.
--     Do not grant UPDATE, DELETE, TRUNCATE, or ownership of audit_logs.
--
-- Example grants (replace medorbits_app with your actual application role):
--
--   GRANT USAGE ON SCHEMA medorbits TO medorbits_app;
--
--   GRANT SELECT, INSERT, UPDATE, DELETE
--     ON medorbits.applications TO medorbits_app;
--
--   GRANT SELECT, INSERT, UPDATE, DELETE
--     ON medorbits.application_files TO medorbits_app;
--
--   GRANT SELECT, INSERT, UPDATE, DELETE
--     ON medorbits.access_requests TO medorbits_app;
--
--   GRANT SELECT, INSERT
--     ON medorbits.audit_logs TO medorbits_app;
--
--   GRANT USAGE, SELECT
--     ON SEQUENCE medorbits.audit_logs_id_seq TO medorbits_app;
--
-- These grants are examples, not executed by this schema. Verify the
-- sequence name in your database before applying sequence permissions.
--
-- Note:
-- PostgreSQL table owners and superusers can bypass ordinary privilege
-- boundaries. For stronger audit guarantees, use a separate owner role,
-- restrict administrative access, and export audit records to protected
-- external storage.
COMMIT;
-- =============================================================================
-- 10. POST-DEPLOYMENT VERIFICATION
-- =============================================================================
-- Run these queries after applying the schema.
--
-- Confirm tables:
--
-- SELECT table_schema, table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'medorbits'
--   AND table_type = 'BASE TABLE'
-- ORDER BY table_name;
--
-- Confirm audit request ID type:
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'medorbits'
--   AND table_name = 'audit_logs'
--   AND column_name = 'request_id';
--
-- Confirm indexes:
--
-- SELECT schemaname, tablename, indexname
-- FROM pg_indexes
-- WHERE schemaname = 'medorbits'
-- ORDER BY tablename, indexname;
--
-- Confirm triggers:
--
-- SELECT event_object_table, trigger_name, event_manipulation
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'medorbits'
-- ORDER BY event_object_table, trigger_name;
--
-- =============================================================================
-- End of MedOrbits database/schema.sql
-- =============================================================================