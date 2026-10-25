
-- =============================================================================
-- Migration: 003_backfill_user_roles.sql
-- Project: MedOrbits
-- Database: MySQL 8.0.16+
-- Purpose: Backfill normalized user-role assignments.
--
-- Dependencies:
--   001_create_users.sql
--   002_create_roles_permissions.sql
--
-- Safety:
-- - Does not grant roles beyond those represented in users.role.
-- - Does not overwrite existing user-role assignments.
-- - Does not assign admin privileges to ordinary users.
-- - Review legacy role values before execution.
-- =============================================================================

INSERT INTO user_roles (
    user_id,
    role_id,
    assigned_at,
    assigned_by
)
SELECT
    u.id,
    r.id,
    CURRENT_TIMESTAMP(3),
    NULL
FROM users AS u
INNER JOIN roles AS r
    ON r.name = LOWER(TRIM(u.role))
   AND r.is_active = TRUE
WHERE u.status <> 'deleted'
  AND u.deleted_at IS NULL
  AND LOWER(TRIM(u.role)) IN (
      'user',
      'admin',
      'counsellor',
      'employer'
  )
ON DUPLICATE KEY UPDATE
    user_id = user_id;

-- Verify users whose legacy role has no matching normalized assignment.
SELECT
    u.id,
    u.email,
    u.role
FROM users AS u
LEFT JOIN roles AS r
    ON r.name = LOWER(TRIM(u.role))
WHERE u.status <> 'deleted'
  AND u.deleted_at IS NULL
  AND r.id IS NULL;

-- Verify role assignments.
SELECT
    r.name AS role_name,
    COUNT(*) AS assigned_users
FROM user_roles AS ur
INNER JOIN roles AS r
    ON r.id = ur.role_id
GROUP BY r.name
ORDER BY r.name;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
