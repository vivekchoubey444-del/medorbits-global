
-- =============================================================================
-- MedOrbits Migration 006: Documents
-- File: /migrations/main/006_create_documents.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
-- Character set: utf8mb4
-- Collation: utf8mb4_0900_ai_ci
--
-- DEPENDENCIES:
--   001_create_users.sql
--   005_create_applications.sql
--
-- PURPOSE:
--   Store secure metadata for user and application documents.
--
-- SECURITY:
-- - Store document contents in private object or file storage.
-- - Store only an opaque storage identifier in storage_key.
-- - Validate content, size, ownership and authorization server-side.
-- - Scan uploads for malware before review or download approval.
-- - Never trust client-supplied filenames, MIME types or checksums.
-- - Use authorized backend services for status transitions.
-- - Do not expose storage_key or internal database IDs publicly.
-- - CREATE TABLE IF NOT EXISTS does not update existing definitions.
-- - MySQL DDL may implicitly commit.
-- =============================================================================

CREATE TABLE IF NOT EXISTS documents (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    -- Generate using crypto.randomUUID() in trusted backend code.
    public_id CHAR(36) NOT NULL,

    user_id BIGINT UNSIGNED NOT NULL,
    application_id BIGINT UNSIGNED NULL,

    -- Classification and display metadata.
    document_type VARCHAR(100) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,

    -- Opaque private-storage identifier, never a public URL.
    storage_key VARCHAR(1024) NOT NULL,

    -- Server-verified content metadata.
    mime_type VARCHAR(150) NOT NULL,
    file_size_bytes BIGINT UNSIGNED NOT NULL,
    checksum_sha256 CHAR(64) NULL,

    -- Document lifecycle.
    status VARCHAR(30) NOT NULL DEFAULT 'uploaded',

    uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    reviewed_at DATETIME(3) NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    rejection_reason TEXT NULL,

    -- Soft deletion: retain metadata for audit and retention policies.
    deleted_at DATETIME(3) NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    updated_by BIGINT UNSIGNED NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_documents_public_id (public_id),
    UNIQUE KEY uq_documents_storage_key (storage_key),

    KEY idx_documents_user_id (user_id),
    KEY idx_documents_application_id (application_id),
    KEY idx_documents_status (status),
    KEY idx_documents_type (document_type),
    KEY idx_documents_uploaded_at (uploaded_at),
    KEY idx_documents_reviewed_by (reviewed_by),
    KEY idx_documents_deleted_at (deleted_at),

    KEY idx_documents_user_status_created (
        user_id, status, created_at
    ),

    KEY idx_documents_application_status (
        application_id, status
    ),

    KEY idx_documents_review_queue (
        status, uploaded_at
    ),

    -- UUID format validation.
    CONSTRAINT chk_documents_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    -- Required values must not be blank.
    CONSTRAINT chk_documents_filename
        CHECK (CHAR_LENGTH(TRIM(original_filename)) > 0),

    CONSTRAINT chk_documents_type
        CHECK (CHAR_LENGTH(TRIM(document_type)) > 0),

    CONSTRAINT chk_documents_storage_key
        CHECK (CHAR_LENGTH(TRIM(storage_key)) > 0),

    CONSTRAINT chk_documents_mime_type
        CHECK (CHAR_LENGTH(TRIM(mime_type)) > 0),

    -- A document must contain at least one byte.
    CONSTRAINT chk_documents_size
        CHECK (file_size_bytes > 0),

    -- SHA-256 must be 64 hexadecimal characters when provided.
    CONSTRAINT chk_documents_checksum
        CHECK (
            checksum_sha256 IS NULL
            OR checksum_sha256 REGEXP '^[0-9a-fA-F]{64}$'
        ),

    -- Supported lifecycle states.
    CONSTRAINT chk_documents_status
        CHECK (
            status IN (
                'uploaded',
                'pending_review',
                'verified',
                'rejected',
                'deleted'
            )
        ),

    -- Reviewer and review timestamp must be supplied together.
    CONSTRAINT chk_documents_review_fields
        CHECK (
            (reviewed_by IS NULL AND reviewed_at IS NULL)
            OR
            (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
        ),

    -- Verified documents require complete review metadata.
    CONSTRAINT chk_documents_verified
        CHECK (
            status <> 'verified'
            OR (
                reviewed_at IS NOT NULL
                AND reviewed_by IS NOT NULL
            )
        ),

    -- Rejected documents require complete review metadata and a reason.
    CONSTRAINT chk_documents_rejected
        CHECK (
            status <> 'rejected'
            OR (
                reviewed_at IS NOT NULL
                AND reviewed_by IS NOT NULL
                AND rejection_reason IS NOT NULL
                AND CHAR_LENGTH(TRIM(rejection_reason)) > 0
            )
        ),

    -- Deleted status and timestamp must agree.
    CONSTRAINT chk_documents_deletion_consistency
        CHECK (
            (status = 'deleted' AND deleted_at IS NOT NULL)
            OR
            (status <> 'deleted' AND deleted_at IS NULL)
        ),

    -- Preserve document ownership records.
    CONSTRAINT fk_documents_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    -- Preserve documents if an application is deleted.
    -- Application deletion sets the association to NULL.
    CONSTRAINT fk_documents_application
        FOREIGN KEY (application_id)
        REFERENCES applications (id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT,

    -- Retain reviewer accounts for audit integrity.
    CONSTRAINT fk_documents_reviewer
        FOREIGN KEY (reviewed_by)
        REFERENCES users (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_documents_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES users (id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

SHOW CREATE TABLE documents;

SELECT
    status,
    COUNT(*) AS document_count
FROM documents
GROUP BY status
ORDER BY status;

-- Expected result: zero rows.
SELECT
    id,
    public_id,
    status,
    reviewed_at,
    reviewed_by,
    rejection_reason,
    deleted_at
FROM documents
WHERE
    (
        status = 'verified'
        AND (reviewed_at IS NULL OR reviewed_by IS NULL)
    )
    OR (
        status = 'rejected'
        AND (
            reviewed_at IS NULL
            OR reviewed_by IS NULL
            OR rejection_reason IS NULL
            OR CHAR_LENGTH(TRIM(rejection_reason)) = 0
        )
    )
    OR (
        (reviewed_at IS NULL AND reviewed_by IS NOT NULL)
        OR
        (reviewed_at IS NOT NULL AND reviewed_by IS NULL)
    )
    OR (
        (status = 'deleted' AND deleted_at IS NULL)
        OR
        (status <> 'deleted' AND deleted_at IS NOT NULL)
    );

-- =============================================================================
-- END OF MIGRATION 006
-- =============================================================================
