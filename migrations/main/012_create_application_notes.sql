
-- Migration: 012_create_application_notes.sql
-- Project: MedOrbits
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
-- Character set: utf8mb4
-- Collation: utf8mb4_0900_ai_ci
--
-- Purpose:
-- Store internal application case notes separately from status history.
--
-- Dependencies:
--   applications
--   users
--
-- IMPORTANT:
-- Verify the actual column types of applications.id and users.id
-- before applying this migration.
--
-- Access control must be enforced by the backend and database privileges.
-- Do not expose internal notes through public applicant APIs by default.

CREATE TABLE IF NOT EXISTS application_notes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    public_id CHAR(36)
        CHARACTER SET ascii
        COLLATE ascii_bin
        NOT NULL,

    application_id BIGINT UNSIGNED NOT NULL,

    author_user_id BIGINT UNSIGNED NULL,

    note_type VARCHAR(32) NOT NULL DEFAULT 'internal',

    visibility VARCHAR(24) NOT NULL DEFAULT 'staff_only',

    note_text TEXT NOT NULL,

    metadata JSON NOT NULL DEFAULT (JSON_OBJECT()),

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    deleted_at DATETIME(3) NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_application_notes_public_id (public_id),

    KEY idx_application_notes_application_created (
        application_id,
        created_at,
        id
    ),

    KEY idx_application_notes_author_created (
        author_user_id,
        created_at
    ),

    KEY idx_application_notes_visibility_created (
        visibility,
        created_at
    ),

    KEY idx_application_notes_deleted_created (
        deleted_at,
        created_at
    ),

    CONSTRAINT chk_application_notes_public_id
        CHECK (
            REGEXP_LIKE(
                public_id,
                '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
                'c'
            )
        ),

    CONSTRAINT chk_application_notes_type
        CHECK (
            note_type IN (
                'internal',
                'review',
                'follow_up',
                'document',
                'system'
            )
        ),

    CONSTRAINT chk_application_notes_visibility
        CHECK (
            visibility IN (
                'staff_only',
                'applicant_visible',
                'restricted'
            )
        ),

    CONSTRAINT chk_application_notes_text
        CHECK (
            CHAR_LENGTH(TRIM(note_text)) > 0
        ),

    CONSTRAINT chk_application_notes_metadata
        CHECK (
            JSON_TYPE(metadata) = 'OBJECT'
        ),

    CONSTRAINT chk_application_notes_deleted_at
        CHECK (
            deleted_at IS NULL
            OR deleted_at >= created_at
        ),

    CONSTRAINT fk_application_notes_application
        FOREIGN KEY (application_id)
        REFERENCES applications (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_application_notes_author
        FOREIGN KEY (author_user_id)
        REFERENCES users (id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- Verification: inspect the table definition.
SHOW CREATE TABLE application_notes;

-- Verification: confirm the table exists and inspect its indexes.
SHOW INDEX FROM application_notes;
