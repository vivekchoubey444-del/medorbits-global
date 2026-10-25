BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS medorbits;

CREATE TABLE IF NOT EXISTS medorbits.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_number VARCHAR(40) NOT NULL UNIQUE,
    applicant_name VARCHAR(200) NOT NULL,
    applicant_email VARCHAR(254) NOT NULL,
    applicant_phone VARCHAR(30),
    application_type VARCHAR(80) NOT NULL,
    course_name VARCHAR(200),
    status VARCHAR(30) NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('draft','submitted','under_review','documents_required','approved','rejected','withdrawn')),
    assigned_to UUID,
    applicant_data JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(applicant_data) = 'object'),
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_status
    ON medorbits.applications (status);
CREATE INDEX IF NOT EXISTS idx_applications_email
    ON medorbits.applications (lower(applicant_email));
CREATE INDEX IF NOT EXISTS idx_applications_created_at
    ON medorbits.applications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_assigned_to
    ON medorbits.applications (assigned_to)
    WHERE assigned_to IS NOT NULL;

CREATE TABLE IF NOT EXISTS medorbits.application_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL
        REFERENCES medorbits.applications(id) ON DELETE RESTRICT,
    original_filename VARCHAR(255) NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    mime_type VARCHAR(150) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    sha256_hex CHAR(64),
    document_type VARCHAR(80) NOT NULL,
    uploaded_by UUID,
    scan_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (scan_status IN ('pending','clean','infected','failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (sha256_hex IS NULL OR sha256_hex ~ '^[a-fA-F0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS idx_application_files_application
    ON medorbits.application_files (application_id);
CREATE INDEX IF NOT EXISTS idx_application_files_scan_status
    ON medorbits.application_files (scan_status);

CREATE TABLE IF NOT EXISTS medorbits.access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_email VARCHAR(254) NOT NULL,
    requester_name VARCHAR(200),
    resource_type VARCHAR(80) NOT NULL,
    resource_id UUID,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','rejected','revoked','expired')),
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_access_requests_status
    ON medorbits.access_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_requests_email
    ON medorbits.access_requests (lower(requester_email));

CREATE TABLE IF NOT EXISTS medorbits.audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    actor_id UUID,
    actor_type VARCHAR(30) NOT NULL DEFAULT 'system',
    action VARCHAR(120) NOT NULL,
    resource_type VARCHAR(100),
    resource_id TEXT,
    request_id UUID,
    ip_address INET,
    outcome VARCHAR(20) NOT NULL DEFAULT 'success'
        CHECK (outcome IN ('success','failure','denied')),
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

CREATE OR REPLACE FUNCTION medorbits.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applications_set_updated_at
    ON medorbits.applications;
CREATE TRIGGER applications_set_updated_at
BEFORE UPDATE ON medorbits.applications
FOR EACH ROW EXECUTE FUNCTION medorbits.set_updated_at();

DROP TRIGGER IF EXISTS access_requests_set_updated_at
    ON medorbits.access_requests;
CREATE TRIGGER access_requests_set_updated_at
BEFORE UPDATE ON medorbits.access_requests
FOR EACH ROW EXECUTE FUNCTION medorbits.set_updated_at();

COMMIT;
