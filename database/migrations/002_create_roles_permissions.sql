
-- =============================================================================
-- Migration: 002_create_roles_permissions.sql
-- Project: MedOrbits
-- Purpose: Create normalized roles, permissions, and role assignments.
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
-- Character set: utf8mb4
-- Collation: utf8mb4_0900_ai_ci
--
-- DEPENDENCIES:
--   001_create_users.sql
--
-- SECURITY:
-- - Enforce authorization in backend middleware and services.
-- - Never rely on frontend role checks alone.
-- - Never allow public registration to assign privileged roles.
-- - Audit role assignments and permission changes.
-- - Use least-privilege permission mappings.
-- - Enforce applicant assignment and record-ownership checks in services.
--
-- MIGRATION SAFETY:
-- - Intended for a fresh installation.
-- - CREATE TABLE IF NOT EXISTS does not alter existing table definitions.
-- - MySQL DDL may implicitly commit.
-- - Seed operations do not overwrite existing role or permission definitions.
-- =============================================================================

-- =============================================================================
-- 1. ROLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_name (name),
    KEY idx_roles_active (is_active),
    KEY idx_roles_system (is_system),

    CONSTRAINT chk_roles_name_format
        CHECK (REGEXP_LIKE(name, '^[a-z][a-z0-9_]*$', 'c')),

    CONSTRAINT chk_roles_display_name
        CHECK (CHAR_LENGTH(TRIM(display_name)) > 0)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 2. PERMISSIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS permissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    resource VARCHAR(60) NOT NULL,
    action VARCHAR(60) NOT NULL,
    description TEXT NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),
    UNIQUE KEY uq_permissions_name (name),
    KEY idx_permissions_resource_action (resource, action),
    KEY idx_permissions_system (is_system),

    CONSTRAINT chk_permissions_name_format
        CHECK (REGEXP_LIKE(name, '^[a-z][a-z0-9_.:-]*$', 'c')),

    CONSTRAINT chk_permissions_resource
        CHECK (CHAR_LENGTH(TRIM(resource)) > 0),

    CONSTRAINT chk_permissions_action
        CHECK (CHAR_LENGTH(TRIM(action)) > 0)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 3. ROLE-PERMISSION MAPPING
-- =============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id BIGINT UNSIGNED NOT NULL,
    permission_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (role_id, permission_id),
    KEY idx_role_permissions_permission_id (permission_id),

    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id)
        REFERENCES roles (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id)
        REFERENCES permissions (id)
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 4. USER-ROLE MAPPING
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    assigned_by BIGINT UNSIGNED NULL,

    PRIMARY KEY (user_id, role_id),
    KEY idx_user_roles_role_id (role_id),
    KEY idx_user_roles_assigned_by (assigned_by),

    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (role_id)
        REFERENCES roles (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_user_roles_assigned_by
        FOREIGN KEY (assigned_by)
        REFERENCES users (id)
        ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 5. SEED BASELINE SYSTEM ROLES
-- =============================================================================

INSERT INTO roles (
    name,
    display_name,
    description,
    is_system,
    is_active
)
VALUES
    (
        'user',
        'User',
        'Standard registered account.',
        TRUE,
        TRUE
    ),
    (
        'admin',
        'Administrator',
        'Administrative access subject to explicit permissions.',
        TRUE,
        TRUE
    ),
    (
        'counsellor',
        'Counsellor',
        'Education guidance and application support.',
        TRUE,
        TRUE
    ),
    (
        'employer',
        'Employer',
        'Employer and recruitment-related access.',
        TRUE,
        TRUE
    )
ON DUPLICATE KEY UPDATE
    id = id;

-- =============================================================================
-- 6. SEED BASELINE SYSTEM PERMISSIONS
-- =============================================================================

INSERT INTO permissions (
    name,
    resource,
    action,
    description,
    is_system
)
VALUES
    ('profile.read_own', 'profile', 'read_own', 'Read own profile.', TRUE),
    ('profile.update_own', 'profile', 'update_own', 'Update own profile.', TRUE),

    ('applications.create', 'applications', 'create', 'Create an application.', TRUE),
    ('applications.read_own', 'applications', 'read_own', 'Read own applications.', TRUE),
    ('applications.update_own', 'applications', 'update_own', 'Update own eligible applications.', TRUE),
    ('applications.read_all', 'applications', 'read_all', 'Read applications across users when authorized.', TRUE),
    ('applications.read_assigned', 'applications', 'read_assigned', 'Read assigned applications only.', TRUE),
    ('applications.review', 'applications', 'review', 'Review applications within authorized scope.', TRUE),
    ('applications.manage', 'applications', 'manage', 'Manage application workflows when authorized.', TRUE),

    ('colleges.read', 'colleges', 'read', 'View college information.', TRUE),
    ('colleges.manage', 'colleges', 'manage', 'Create and manage college records.', TRUE),

    ('courses.read', 'courses', 'read', 'View course information.', TRUE),
    ('courses.manage', 'courses', 'manage', 'Create and manage course records.', TRUE),

    ('jobs.read', 'jobs', 'read', 'View job listings.', TRUE),
    ('jobs.manage', 'jobs', 'manage', 'Manage job listings when authorized.', TRUE),
    ('jobs.manage_own', 'jobs', 'manage_own', 'Manage own job listings.', TRUE),
    ('employers.manage_own', 'employers', 'manage_own', 'Manage own employer profile and listings.', TRUE),

    ('users.read', 'users', 'read', 'Read user account information.', TRUE),
    ('users.manage', 'users', 'manage', 'Manage user accounts.', TRUE),

    ('roles.read', 'roles', 'read', 'View roles and permissions.', TRUE),
    ('roles.manage', 'roles', 'manage', 'Manage roles and permission assignments.', TRUE),

    ('payments.read_own', 'payments', 'read_own', 'Read own payment records.', TRUE),
    ('payments.read_all', 'payments', 'read_all', 'Read payment records across users when authorized.', TRUE),
    ('payments.refund', 'payments', 'refund', 'Initiate authorized refunds.', TRUE),

    ('subscriptions.read_own', 'subscriptions', 'read_own', 'Read own subscription metadata.', TRUE),
    ('subscriptions.manage', 'subscriptions', 'manage', 'Manage subscriptions through authorized workflows.', TRUE),

    ('documents.read_own', 'documents', 'read_own', 'Read own documents.', TRUE),
    ('documents.manage_own', 'documents', 'manage_own', 'Manage own eligible documents.', TRUE),
    ('documents.read_assigned', 'documents', 'read_assigned', 'Read documents for assigned applicants.', TRUE),
    ('documents.review', 'documents', 'review', 'Review submitted documents within authorized scope.', TRUE),

    ('support.create', 'support', 'create', 'Create a support request.', TRUE),
    ('support.manage', 'support', 'manage', 'Manage support requests.', TRUE),

    ('reports.read', 'reports', 'read', 'Read authorized platform reports.', TRUE),
    ('audit_logs.read', 'audit_logs', 'read', 'Read authorized audit logs.', TRUE)
ON DUPLICATE KEY UPDATE
    id = id;

-- =============================================================================
-- 7. ASSIGN BASE PERMISSIONS TO THE USER ROLE
-- =============================================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.name IN (
        'profile.read_own',
        'profile.update_own',
        'applications.create',
        'applications.read_own',
        'applications.update_own',
        'colleges.read',
        'courses.read',
        'jobs.read',
        'payments.read_own',
        'subscriptions.read_own',
        'documents.read_own',
        'documents.manage_own',
        'support.create'
    )
WHERE r.name = 'user'
  AND r.is_active = TRUE
ON DUPLICATE KEY UPDATE
    role_id = role_id;

-- =============================================================================
-- 8. ASSIGN COUNSELLOR PERMISSIONS
-- =============================================================================

-- Counsellors receive assignment-scoped permissions.
-- The backend must enforce assignment checks on every relevant operation.

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.name IN (
        'profile.read_own',
        'profile.update_own',
        'applications.read_assigned',
        'applications.review',
        'colleges.read',
        'courses.read',
        'documents.read_assigned',
        'documents.review',
        'support.manage'
    )
WHERE r.name = 'counsellor'
  AND r.is_active = TRUE
ON DUPLICATE KEY UPDATE
    role_id = role_id;

-- =============================================================================
-- 9. ASSIGN EMPLOYER PERMISSIONS
-- =============================================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.name IN (
        'profile.read_own',
        'profile.update_own',
        'jobs.read',
        'jobs.manage_own',
        'employers.manage_own',
        'support.create'
    )
WHERE r.name = 'employer'
  AND r.is_active = TRUE
ON DUPLICATE KEY UPDATE
    role_id = role_id;

-- =============================================================================
-- 10. ASSIGN EXPLICIT ADMIN PERMISSIONS
-- =============================================================================

-- This seed does not assign the admin role to any user.
-- Administrative permissions must still be enforced by backend middleware.

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.name IN (
        'profile.read_own',
        'profile.update_own',
        'applications.create',
        'applications.read_own',
        'applications.update_own',
        'applications.read_all',
        'applications.read_assigned',
        'applications.review',
        'applications.manage',
        'colleges.read',
        'colleges.manage',
        'courses.read',
        'courses.manage',
        'jobs.read',
        'jobs.manage',
        'jobs.manage_own',
        'employers.manage_own',
        'users.read',
        'users.manage',
        'roles.read',
        'roles.manage',
        'payments.read_own',
        'payments.read_all',
        'payments.refund',
        'subscriptions.read_own',
        'subscriptions.manage',
        'documents.read_own',
        'documents.manage_own',
        'documents.read_assigned',
        'documents.review',
        'support.create',
        'support.manage',
        'reports.read',
        'audit_logs.read'
    )
WHERE r.name = 'admin'
  AND r.is_active = TRUE
ON DUPLICATE KEY UPDATE
    role_id = role_id;

-- =============================================================================
-- 11. VERIFICATION QUERIES
-- =============================================================================

SELECT
    id,
    name,
    display_name,
    is_system,
    is_active
FROM roles
ORDER BY name;

SELECT
    id,
    name,
    resource,
    action,
    is_system
FROM permissions
ORDER BY resource, action;

SELECT
    r.name AS role_name,
    p.name AS permission_name
FROM role_permissions AS rp
INNER JOIN roles AS r
    ON r.id = rp.role_id
INNER JOIN permissions AS p
    ON p.id = rp.permission_id
ORDER BY r.name, p.name;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
