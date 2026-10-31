
-- Migration: 013_create_application_assignments.sql
-- Project: MedOrbits
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
-- Character set: utf8mb4
-- Collation: utf8mb4_0900_ai_ci
--
-- Purpose:
-- Track application assignments to staff members.
--
-- Dependencies:
--   applications
--   users
--
-- IMPORTANT:
-- Verify that applications.id and users.id use BIGINT UNSIGNED.
-- Change the foreign-key column types if the existing schema differs.
--
-- Backend requirements:
--   * Authorize assignment and reassignment operations.
--   * Validate that assigned users have an appropriate staff role.
--   * Record reassignment and completion events in audit history.
--   * Prevent unauthorized users from viewing assigned applications.
--   * Use transactions when changing assignments and recording audit events.

CREATE TABLE IF NOT EXISTS application_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    public_id CHAR(36)
        CHARACTER SET ascii
        COLLATE ascii_bin
        NOT NULL,

    application_id BIGINT UNSIGNED NOT NULL,

    assignee_user_id BIGINT UNSIGNED NOT NULL,

    assigned_by_user_id BIGINT UNSIGNED NULL,

    assignment_status VARCHAR(24) NOT NULL DEFAULT 'active',

    assignment_note VARCHAR(1000) NULL,

    assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    accepted_at DATETIME(3) NULL,

    completed_at DATETIME(3) NULL,

    cancelled_at DATETIME(3) NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_application_assignments_public_id (public_id),

    KEY idx_application_assignments_application_status (
        application_id,
        assignment_status,
        assigned_at
    ),

    KEY idx_application_assignments_assignee_status (
        assignee_user_id,
        assignment_status,
        assigned_at
    ),

    KEY idx_application_assignments_assigned_by (
        assigned_by_user_id,
        assigned_at
    ),

    KEY idx_application_assignments_status_updated (
        assignment_status,
        updated_at
    ),

    CONSTRAINT chk_application_assignments_public_id
        CHECK (
            REGEXP_LIKE(
                public_id,
                '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
                'c'
            )
        ),

    CONSTRAINT chk_application_assignments_status
        CHECK (
            assignment_status IN (
                'active',
                'accepted',
                'completed',
                'cancelled'
            )
        ),

    CONSTRAINT chk_application_assignments_note
        CHECK (
            assignment_note IS NULL
            OR CHAR_LENGTH(TRIM(assignment_note)) > 0
        ),

    CONSTRAINT chk_application_assignments_accepted_at
        CHECK (
            accepted_at IS NULL
            OR accepted_at >= assigned_at
        ),

    CONSTRAINT chk_application_assignments_completed_at
        CHECK (
            completed_at IS NULL
            OR completed_at >= assigned_at
        ),

    CONSTRAINT chk_application_assignments_cancelled_at
        CHECK (
            cancelled_at IS NULL
            OR cancelled_at >= assigned_at
        ),

    CONSTRAINT chk_application_assignments_terminal_state
        CHECK (
            (
                assignment_status = 'completed'
                AND completed_at IS NOT NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                assignment_status = 'cancelled'
                AND cancelled_at IS NOT NULL
                AND completed_at IS NULL
            )
            OR
            (
                assignment_status IN ('active', 'accepted')
                AND completed_at IS NULL
                AND cancelled_at IS NULL
            )
        ),

    CONSTRAINT fk_application_assignments_application
        FOREIGN KEY (application_id)
        REFERENCES applications (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_application_assignments_assignee
        FOREIGN KEY (assignee_user_id)
        REFERENCES users (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_application_assignments_assigned_by
        FOREIGN KEY (assigned_by_user_id)
        REFERENCES users (id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- Verification: inspect the resulting table definition.
SHOW CREATE TABLE application_assignments;

-- Verification: inspect indexes used for assignments and workloads.
SHOW INDEX FROM application_assignments;

-- Verification: inspect current assignment counts by status.
SELECT
    assignment_status,
    COUNT(*) AS assignment_count
FROM application_assignments
GROUP BY assignment_status
ORDER BY assignment_status;
