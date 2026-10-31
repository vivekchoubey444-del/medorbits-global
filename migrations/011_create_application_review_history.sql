
-- Migration: 011_create_application_review_history.sql
-- Project: MedOrbits
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
-- Character set: utf8mb4
-- Collation: utf8mb4_0900_ai_ci
--
-- Purpose:
-- Preserve application status transitions and review decisions.
--
-- Dependencies:
--   applications
--   users
--
-- Important:
--   Verify the actual column types and names of applications.id
--   and users.id before applying this migration.
--
-- This migration does not independently enforce append-only access.
-- Configure database privileges and backend authorization accordingly.

CREATE TABLE IF NOT EXISTS application_review_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    public_id CHAR(36)
        CHARACTER SET ascii
        COLLATE ascii_bin
        NOT NULL,

    application_id BIGINT UNSIGNED NOT NULL,

    previous_status VARCHAR(32) NULL,
    new_status VARCHAR(32) NOT NULL,

    action_type VARCHAR(40) NOT NULL,

    reviewer_user_id BIGINT UNSIGNED NULL,

    review_notes TEXT NULL,

    reason_code VARCHAR(80) NULL,

    request_id VARCHAR(128) NULL,
    correlation_id VARCHAR(128) NULL,

    metadata JSON NOT NULL DEFAULT (JSON_OBJECT()),

    occurred_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_application_review_history_public_id (public_id),

    KEY idx_application_review_history_application_time (
        application_id,
        occurred_at,
        id
    ),

    KEY idx_application_review_history_reviewer_time (
        reviewer_user_id,
        occurred_at
    ),

    KEY idx_application_review_history_action_time (
        action_type,
        occurred_at
    ),

    KEY idx_application_review_history_status_time (
        new_status,
        occurred_at
    ),

    CONSTRAINT chk_application_review_history_public_id
        CHECK (
            REGEXP_LIKE(
                public_id,
                '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
                'c'
            )
        ),

    CONSTRAINT chk_application_review_history_status
        CHECK (
            new_status IN (
                'draft',
                'submitted',
                'under_review',
                'documents_required',
                'approved',
                'rejected',
                'withdrawn',
                'closed'
            )
        ),

    CONSTRAINT chk_application_review_history_previous_status
        CHECK (
            previous_status IS NULL
            OR previous_status IN (
                'draft',
                'submitted',
                'under_review',
                'documents_required',
                'approved',
                'rejected',
                'withdrawn',
                'closed'
            )
        ),

    CONSTRAINT chk_application_review_history_action
        CHECK (
            action_type IN (
                'created',
                'submitted',
                'review_started',
                'documents_requested',
                'documents_received',
                'approved',
                'rejected',
                'withdrawn',
                'reopened',
                'closed',
                'status_changed',
                'note_added'
            )
        ),

    CONSTRAINT chk_application_review_history_status_change
        CHECK (
            previous_status IS NULL
            OR previous_status <> new_status
            OR action_type IN ('created', 'note_added')
        ),

    CONSTRAINT fk_application_review_history_application
        FOREIGN KEY (application_id)
        REFERENCES applications (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_application_review_history_reviewer
        FOREIGN KEY (reviewer_user_id)
        REFERENCES users (id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- Verification: inspect the created table.
SHOW CREATE TABLE application_review_history;

-- Verification: inspect recent history entries.
SELECT
    public_id,
    application_id,
    previous_status,
    new_status,
    action_type,
    reviewer_user_id,
    occurred_at
FROM application_review_history
ORDER BY occurred_at DESC, id DESC
LIMIT 20;
