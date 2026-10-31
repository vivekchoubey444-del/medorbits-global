
-- ============================================================================
-- MedOrbits Database Migration
-- File: 014_create_application_checklists.sql
-- Database: MySQL 8.0.16+
-- Storage: InnoDB
-- Character set: utf8mb4
-- Collation: utf8mb4_0900_ai_ci
--
-- Purpose:
--   Store application-specific admission checklist items.
--
-- Dependencies:
--   applications
--   users
--
-- Before execution:
--   1. Confirm this migration number is unused.
--   2. Confirm the referenced tables and identifier types.
--   3. Check migration history and the current database schema.
--   4. Test against a disposable database before deployment.
--
-- Important:
--   CREATE TABLE IF NOT EXISTS does not reconcile an existing table.
--   MySQL DDL may cause implicit commits.
--
-- Security:
--   Application ownership, staff authorization, status transitions, and
--   document verification must be enforced by trusted backend services.
-- ============================================================================

-- ============================================================================
-- PREFLIGHT
-- ============================================================================
-- Run these queries and inspect the results before applying the migration.
-- The applications.id and users.id columns must match the foreign-key types.

SELECT VERSION() AS mysql_version;

SELECT DATABASE() AS selected_database;

SHOW CREATE TABLE applications;

SHOW CREATE TABLE users;

-- Confirm whether the target table already exists.
SELECT
    TABLE_SCHEMA,
    TABLE_NAME,
    ENGINE,
    TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'application_checklists';


-- ============================================================================
-- TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS application_checklists (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    public_id CHAR(36)
        CHARACTER SET ascii
        COLLATE ascii_bin
        NOT NULL,

    application_id BIGINT UNSIGNED NOT NULL,

    checklist_key VARCHAR(100)
        CHARACTER SET utf8mb4
        COLLATE utf8mb4_0900_ai_ci
        NOT NULL,

    title VARCHAR(255) NOT NULL,

    description TEXT NULL,

    category VARCHAR(40) NOT NULL DEFAULT 'general',

    requirement_type VARCHAR(24) NOT NULL DEFAULT 'required',

    checklist_status VARCHAR(24) NOT NULL DEFAULT 'pending',

    display_order INT UNSIGNED NOT NULL DEFAULT 0,

    assigned_to_user_id BIGINT UNSIGNED NULL,

    completed_by_user_id BIGINT UNSIGNED NULL,

    completed_at DATETIME(3) NULL,

    due_at DATETIME(3) NULL,

    completion_note VARCHAR(1000) NULL,

    metadata JSON NOT NULL DEFAULT (JSON_OBJECT()),

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    deleted_at DATETIME(3) NULL,

    -- Active checklist items must have a unique key per application.
    -- A deleted item receives NULL in this generated column, allowing a
    -- replacement item to reuse the same checklist_key.
    active_checklist_key VARCHAR(100)
        GENERATED ALWAYS AS (
            CASE
                WHEN deleted_at IS NULL THEN checklist_key
                ELSE NULL
            END
        ) STORED,

    PRIMARY KEY (id),

    UNIQUE KEY uq_application_checklists_public_id (
        public_id
    ),

    UNIQUE KEY uq_application_checklists_active_key (
        application_id,
        active_checklist_key
    ),

    KEY idx_application_checklists_application_status (
        application_id,
        deleted_at,
        checklist_status,
        display_order
    ),

    KEY idx_application_checklists_assignee_status (
        assigned_to_user_id,
        deleted_at,
        checklist_status,
        due_at
    ),

    KEY idx_application_checklists_completed_by (
        completed_by_user_id,
        completed_at
    ),

    KEY idx_application_checklists_due_status (
        deleted_at,
        checklist_status,
        due_at
    ),

    KEY idx_application_checklists_deleted_created (
        deleted_at,
        created_at
    ),

    CONSTRAINT chk_application_checklists_public_id
        CHECK (
            REGEXP_LIKE(
                public_id,
                '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
                'c'
            )
        ),

    CONSTRAINT chk_application_checklists_key
        CHECK (
            CHAR_LENGTH(TRIM(checklist_key)) > 0
        ),

    CONSTRAINT chk_application_checklists_title
        CHECK (
            CHAR_LENGTH(TRIM(title)) > 0
        ),

    CONSTRAINT chk_application_checklists_category
        CHECK (
            category IN (
                'general',
                'eligibility',
                'documents',
                'academic',
                'payment',
                'counselling',
                'verification',
                'other'
            )
        ),

    CONSTRAINT chk_application_checklists_requirement_type
        CHECK (
            requirement_type IN (
                'required',
                'optional',
                'conditional'
            )
        ),

    CONSTRAINT chk_application_checklists_status
        CHECK (
            checklist_status IN (
                'pending',
                'in_progress',
                'completed',
                'blocked',
                'not_applicable'
            )
        ),

    CONSTRAINT chk_application_checklists_completion
        CHECK (
            (
                checklist_status = 'completed'
                AND completed_at IS NOT NULL
                AND completed_by_user_id IS NOT NULL
            )
            OR
            (
                checklist_status <> 'completed'
                AND completed_at IS NULL
                AND completed_by_user_id IS NULL
            )
        ),

    CONSTRAINT chk_application_checklists_completion_note
        CHECK (
            completion_note IS NULL
            OR CHAR_LENGTH(TRIM(completion_note)) > 0
        ),

    CONSTRAINT chk_application_checklists_metadata
        CHECK (
            JSON_TYPE(metadata) = 'OBJECT'
        ),

    CONSTRAINT chk_application_checklists_deleted_at
        CHECK (
            deleted_at IS NULL
            OR deleted_at >= created_at
        ),

    CONSTRAINT fk_application_checklists_application
        FOREIGN KEY (application_id)
        REFERENCES applications (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_application_checklists_assignee
        FOREIGN KEY (assigned_to_user_id)
        REFERENCES users (id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL,

    CONSTRAINT fk_application_checklists_completed_by
        FOREIGN KEY (completed_by_user_id)
        REFERENCES users (id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================

-- 1. Inspect the complete table definition.
SHOW CREATE TABLE application_checklists;

-- 2. Inspect all indexes.
SHOW INDEX FROM application_checklists;

-- 3. Inspect declared constraints.
SELECT
    tc.CONSTRAINT_NAME,
    tc.CONSTRAINT_TYPE,
    tc.ENFORCED
FROM information_schema.TABLE_CONSTRAINTS AS tc
WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
  AND tc.TABLE_NAME = 'application_checklists'
ORDER BY tc.CONSTRAINT_TYPE, tc.CONSTRAINT_NAME;

-- 4. Summarize active checklist items by status.
SELECT
    checklist_status,
    COUNT(*) AS item_count
FROM application_checklists
WHERE deleted_at IS NULL
GROUP BY checklist_status
ORDER BY checklist_status;

-- 5. Check for lifecycle inconsistencies.
-- Expected result: zero rows.
SELECT
    id,
    public_id,
    application_id,
    checklist_status,
    completed_by_user_id,
    completed_at
FROM application_checklists
WHERE
    (
        checklist_status = 'completed'
        AND (
            completed_at IS NULL
            OR completed_by_user_id IS NULL
        )
    )
    OR
    (
        checklist_status <> 'completed'
        AND (
            completed_at IS NOT NULL
            OR completed_by_user_id IS NOT NULL
        )
    );

-- 6. Check for duplicate active checklist keys.
-- Expected result: zero rows.
SELECT
    application_id,
    checklist_key,
    COUNT(*) AS duplicate_count
FROM application_checklists
WHERE deleted_at IS NULL
GROUP BY application_id, checklist_key
HAVING COUNT(*) > 1;

-- 7. Check foreign-key references.
-- Expected result: zero rows.
SELECT
    ac.id,
    ac.application_id
FROM application_checklists AS ac
LEFT JOIN applications AS a
    ON a.id = ac.application_id
WHERE a.id IS NULL;

SELECT
    ac.id,
    ac.assigned_to_user_id
FROM application_checklists AS ac
LEFT JOIN users AS u
    ON u.id = ac.assigned_to_user_id
WHERE ac.assigned_to_user_id IS NOT NULL
  AND u.id IS NULL;

SELECT
    ac.id,
    ac.completed_by_user_id
FROM application_checklists AS ac
LEFT JOIN users AS u
    ON u.id = ac.completed_by_user_id
WHERE ac.completed_by_user_id IS NOT NULL
  AND u.id IS NULL;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
