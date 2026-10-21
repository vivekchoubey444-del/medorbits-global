
-- =============================================================================
-- MedOrbits Migration 006: Documents
-- File: /database/migrations/006_create_documents.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
-- Character set: utf8mb4
-- Collation: utf8mb4_0900_ai_ci
--
-- Dependencies:
--   001_create_users.sql
--   005_create_applications.sql
--
-- Purpose:
--   Store secure metadata for user and application documents.
--
-- Security:
--   Store files in private storage.
--   Validate file content, size, ownership and permissions server-side.
--   Scan files for malware before approval.
--   Never trust client-supplied filenames, MIME types or checksums.
-- =============================================================================

CREATE TABLE IF NOT EXISTS documents (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    -- Generate using crypto.randomUUID() in trusted backend code.
    public_id CHAR(36) NOT NULL,

    user_id BIGINT UNSIGNED NOT NULL,
    application_id BIGINT UNSIGNED NULL,

    document_type VARCHAR(100) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,

    -- Opaque private-storage identifier, not a public URL.
    storage_key VARCHAR(1024) NOT NULL,

    mime_type VARCHAR(150) NOT NULL,
    file_size_bytes BIGINT UNSIGNED NOT NULL,

    -- SHA-256 hex digest verified by the server.
    checksum_sha256 CHAR(64) NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'uploaded',

    uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    reviewed_at DATETIME(3) NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    rejection_reason TEXT NULL,

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

    CONSTRAINT chk_documents_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_documents_size
        CHECK (file_size_bytes > 0),

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

    CONSTRAINT chk_documents_filename
        CHECK (CHAR_LENGTH(TRIM(original_filename)) > 0),

    CONSTRAINT chk_documents_type
        CHECK (CHAR_LENGTH(TRIM(document_type)) > 0),

    CONSTRAINT chk_documents_storage_key
        CHECK (CHAR_LENGTH(TRIM(storage_key)) > 0),

    CONSTRAINT chk_documents_mime_type
        CHECK (CHAR_LENGTH(TRIM(mime_type)) > 0),

    CONSTRAINT chk_documents_checksum
        CHECK (
            checksum_sha256 IS NULL
            OR checksum_sha256 REGEXP '^[0-9a-fA-F]{64}$'
        ),

    -- Reviewer and review timestamp must be recorded together.
    CONSTRAINT chk_documents_review_fields
        CHECK (
            (reviewed_by IS NULL AND reviewed_at IS NULL)
            OR
            (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
        ),

    -- Verified documents require review metadata.
    CONSTRAINT chk_documents_verified
        CHECK (
            status <> 'verified'
            OR reviewed_at IS NOT NULL
        ),

    -- Rejected documents require review metadata and a reason.
    CONSTRAINT chk_documents_rejected
        CHECK (
            status <> 'rejected'
            OR (
                reviewed_at IS NOT NULL
                AND rejection_reason IS NOT NULL
                AND CHAR_LENGTH(TRIM(rejection_reason)) > 0
            )
        ),

    -- Deletion state and timestamp must agree.
    CONSTRAINT chk_documents_deletion_consistency
        CHECK (
            (status = 'deleted' AND deleted_at IS NOT NULL)
            OR
            (status <> 'deleted' AND deleted_at IS NULL)
        ),

    CONSTRAINT fk_documents_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_documents_application
        FOREIGN KEY (application_id)
        REFERENCES applications (id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT,

    CONSTRAINT fk_documents_reviewer
        FOREIGN KEY (reviewed_by)
        REFERENCES users (id)
        ON DELETE SET NULL
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

SELECT
    status,
    COUNT(*) AS document_count
FROM documents
GROUP BY status
ORDER BY status;

-- =============================================================================
-- END OF MIGRATION 006
-- =============================================================================
