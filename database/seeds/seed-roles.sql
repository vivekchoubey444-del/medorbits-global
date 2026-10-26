-- =============================================================================
-- MedOrbits: Seed Baseline Roles and Permissions
-- File: database/seeds/seed-roles.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
--
-- Requires:
--   001_create_users.sql
--   002_create_roles_permissions.sql
--
-- Expected tables:
--   roles(id, name, display_name, description, is_system, is_active)
--   permissions(id, name, resource, action, description, is_system)
--   role_permissions(role_id, permission_id)
--   user_roles(user_id, role_id)
--
-- SAFETY:
--   - Does not assign any role to a user.
--   - Does not overwrite existing role or permission definitions.
--   - Aborts on conflicting existing definitions.
--   - Adds only the baseline role-permission mappings.
--   - Requires all four tables to use InnoDB.
--
-- IDEMPOTENCY:
--   Requires UNIQUE(roles.name), UNIQUE(permissions.name), and
--   UNIQUE(role_permissions.role_id, role_permissions.permission_id).
-- =============================================================================
DROP PROCEDURE IF EXISTS seed_medorbits_roles;
DELIMITER $$
CREATE PROCEDURE seed_medorbits_roles()
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_expected_permissions INT DEFAULT 34;
    DECLARE v_missing_mappings INT DEFAULT 0;
    DECLARE v_conflicts INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    START TRANSACTION;
    -- -------------------------------------------------------------------------
    -- 1. Verify that required tables exist and use InnoDB.
    -- -------------------------------------------------------------------------
    SELECT COUNT(*)
      INTO v_count
      FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_type = 'BASE TABLE'
       AND table_name IN (
           'roles',
           'permissions',
           'role_permissions',
           'user_roles'
       )
       AND engine = 'InnoDB';
    IF v_count <> 4 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Required roles tables are missing or are not all InnoDB tables';
    END IF;
    -- -------------------------------------------------------------------------
    -- 2. Insert baseline roles without modifying existing definitions.
    -- -------------------------------------------------------------------------
    INSERT INTO roles (
        name,
        display_name,
        description,
        is_system
    )
    VALUES
        (
            'user',
            'User',
            'Standard registered account.',
            TRUE
        ),
        (
            'admin',
            'Administrator',
            'Administrative account with explicitly assigned baseline permissions.',
            TRUE
        ),
        (
            'counsellor',
            'Counsellor',
            'Education guidance and assigned application support.',
            TRUE
        ),
        (
            'employer',
            'Employer',
            'Recruitment and employer account.',
            TRUE
        )
    ON DUPLICATE KEY UPDATE
        id = id;
    -- Check each role's canonical definition.
    SELECT COUNT(*)
      INTO v_conflicts
      FROM roles AS r
     WHERE r.name IN ('user', 'admin', 'counsellor', 'employer')
       AND (
           (r.name = 'user' AND NOT (
               r.display_name <=> 'User'
               AND r.description <=> 'Standard registered account.'
               AND r.is_system <=> TRUE
           ))
           OR
           (r.name = 'admin' AND NOT (
               r.display_name <=> 'Administrator'
               AND r.description <=> 'Administrative account with explicitly assigned baseline permissions.'
               AND r.is_system <=> TRUE
           ))
           OR
           (r.name = 'counsellor' AND NOT (
               r.display_name <=> 'Counsellor'
               AND r.description <=> 'Education guidance and assigned application support.'
               AND r.is_system <=> TRUE
           ))
           OR
           (r.name = 'employer' AND NOT (
               r.display_name <=> 'Employer'
               AND r.description <=> 'Recruitment and employer account.'
               AND r.is_system <=> TRUE
           ))
       );
    IF v_conflicts <> 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Role seed conflict: an existing baseline role has a different definition';
    END IF;
    SELECT COUNT(*)
      INTO v_count
      FROM roles
     WHERE name IN ('user', 'admin', 'counsellor', 'employer');
    IF v_count <> 4 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Role seed failed: expected four baseline roles';
    END IF;
    -- -------------------------------------------------------------------------
    -- 3. Insert all 34 baseline permissions.
    -- Existing permission definitions are never overwritten.
    -- -------------------------------------------------------------------------
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
        ('applications.create', 'applications', 'create', 'Create applications.', TRUE),
        ('applications.read_own', 'applications', 'read_own', 'Read own applications.', TRUE),
        ('applications.update_own', 'applications', 'update_own', 'Update eligible own applications.', TRUE),
        ('applications.read_all', 'applications', 'read_all', 'Read applications across users.', TRUE),
        ('applications.read_assigned', 'applications', 'read_assigned', 'Read assigned applications.', TRUE),
        ('applications.review', 'applications', 'review', 'Review applications.', TRUE),
        ('applications.manage', 'applications', 'manage', 'Manage application workflows.', TRUE),
        ('colleges.read', 'colleges', 'read', 'View colleges.', TRUE),
        ('colleges.manage', 'colleges', 'manage', 'Manage college records.', TRUE),
        ('courses.read', 'courses', 'read', 'View courses.', TRUE),
        ('courses.manage', 'courses', 'manage', 'Manage course records.', TRUE),
        ('jobs.read', 'jobs', 'read', 'View jobs.', TRUE),
        ('jobs.manage', 'jobs', 'manage', 'Manage job listings.', TRUE),
        ('jobs.manage_own', 'jobs', 'manage_own', 'Manage own eligible job listings.', TRUE),
        ('employers.manage_own', 'employers', 'manage_own', 'Manage own employer profile.', TRUE),
        ('users.read', 'users', 'read', 'Read user records.', TRUE),
        ('users.manage', 'users', 'manage', 'Manage user accounts.', TRUE),
        ('roles.read', 'roles', 'read', 'Read roles and permissions.', TRUE),
        ('roles.manage', 'roles', 'manage', 'Manage role assignments.', TRUE),
        ('payments.read_own', 'payments', 'read_own', 'Read own payments.', TRUE),
        ('payments.read_all', 'payments', 'read_all', 'Read all payments.', TRUE),
        ('payments.refund', 'payments', 'refund', 'Initiate authorized refunds.', TRUE),
        ('subscriptions.read_own', 'subscriptions', 'read_own', 'Read own subscriptions.', TRUE),
        ('subscriptions.manage', 'subscriptions', 'manage', 'Manage subscriptions.', TRUE),
        ('documents.read_own', 'documents', 'read_own', 'Read own documents.', TRUE),
        ('documents.manage_own', 'documents', 'manage_own', 'Manage own eligible documents.', TRUE),
        ('documents.read_assigned', 'documents', 'read_assigned', 'Read documents for assigned applications.', TRUE),
        ('documents.review', 'documents', 'review', 'Review submitted documents.', TRUE),
        ('support.create', 'support', 'create', 'Create support requests.', TRUE),
        ('support.manage', 'support', 'manage', 'Manage support requests.', TRUE),
        ('reports.read', 'reports', 'read', 'Read authorized reports.', TRUE),
        ('audit_logs.read', 'audit_logs', 'read', 'Read audit logs.', TRUE)
    ON DUPLICATE KEY UPDATE
        id = id;
    -- Verify that all 34 named permissions exist.
    SELECT COUNT(*)
      INTO v_count
      FROM permissions
     WHERE name IN (
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
     );
    IF v_count <> v_expected_permissions THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Permission seed failed: expected 34 baseline permissions';
    END IF;
    -- Validate resource, action, and system flag for every baseline permission.
    SELECT COUNT(*)
      INTO v_conflicts
      FROM permissions AS p
     WHERE p.name IN (
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
       AND (
           p.is_system IS NULL
           OR p.is_system <> TRUE
           OR p.name <> CONCAT(p.resource, '.', p.action)
       );
    IF v_conflicts <> 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Permission seed conflict: an existing permission has incorrect resource, action, or system flag';
    END IF;
    -- -------------------------------------------------------------------------
    -- 4. Assign baseline permissions to standard users.
    -- -------------------------------------------------------------------------
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
      FROM roles AS r
      JOIN permissions AS p
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
    ON DUPLICATE KEY UPDATE
        role_id = role_id;
    -- -------------------------------------------------------------------------
    -- 5. Assign baseline permissions to counsellors.
    -- -------------------------------------------------------------------------
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
      FROM roles AS r
      JOIN permissions AS p
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
    ON DUPLICATE KEY UPDATE
        role_id = role_id;
    -- -------------------------------------------------------------------------
    -- 6. Assign baseline permissions to employers.
    -- -------------------------------------------------------------------------
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
      FROM roles AS r
      JOIN permissions AS p
        ON p.name IN (
            'profile.read_own',
            'profile.update_own',
            'jobs.read',
            'jobs.manage_own',
            'employers.manage_own',
            'support.create'
        )
     WHERE r.name = 'employer'
    ON DUPLICATE KEY UPDATE
        role_id = role_id;
    -- -------------------------------------------------------------------------
    -- 7. Assign explicit baseline permissions to administrators.
    -- This does not assign the admin role to any user.
    -- -------------------------------------------------------------------------
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
      FROM roles AS r
      JOIN permissions AS p
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
    ON DUPLICATE KEY UPDATE
        role_id = role_id;
    -- -------------------------------------------------------------------------
    -- 8. Verify every expected role-permission mapping.
    -- -------------------------------------------------------------------------
    SELECT COUNT(*)
      INTO v_missing_mappings
      FROM (
        SELECT 'user' AS role_name, 'profile.read_own' AS permission_name
        UNION ALL SELECT 'user', 'profile.update_own'
        UNION ALL SELECT 'user', 'applications.create'
        UNION ALL SELECT 'user', 'applications.read_own'
        UNION ALL SELECT 'user', 'applications.update_own'
        UNION ALL SELECT 'user', 'colleges.read'
        UNION ALL SELECT 'user', 'courses.read'
        UNION ALL SELECT 'user', 'jobs.read'
        UNION ALL SELECT 'user', 'payments.read_own'
        UNION ALL SELECT 'user', 'subscriptions.read_own'
        UNION ALL SELECT 'user', 'documents.read_own'
        UNION ALL SELECT 'user', 'documents.manage_own'
        UNION ALL SELECT 'user', 'support.create'
        UNION ALL SELECT 'counsellor', 'profile.read_own'
        UNION ALL SELECT 'counsellor', 'profile.update_own'
        UNION ALL SELECT 'counsellor', 'applications.read_assigned'
        UNION ALL SELECT 'counsellor', 'applications.review'
        UNION ALL SELECT 'counsellor', 'colleges.read'
        UNION ALL SELECT 'counsellor', 'courses.read'
        UNION ALL SELECT 'counsellor', 'documents.read_assigned'
        UNION ALL SELECT 'counsellor', 'documents.review'
        UNION ALL SELECT 'counsellor', 'support.manage'
        UNION ALL SELECT 'employer', 'profile.read_own'
        UNION ALL SELECT 'employer', 'profile.update_own'
        UNION ALL SELECT 'employer', 'jobs.read'
        UNION ALL SELECT 'employer', 'jobs.manage_own'
        UNION ALL SELECT 'employer', 'employers.manage_own'
        UNION ALL SELECT 'employer', 'support.create'
        UNION ALL SELECT 'admin', 'profile.read_own'
        UNION ALL SELECT 'admin', 'profile.update_own'
        UNION ALL SELECT 'admin', 'applications.create'
        UNION ALL SELECT 'admin', 'applications.read_own'
        UNION ALL SELECT 'admin', 'applications.update_own'
        UNION ALL SELECT 'admin', 'applications.read_all'
        UNION ALL SELECT 'admin', 'applications.read_assigned'
        UNION ALL SELECT 'admin', 'applications.review'
        UNION ALL SELECT 'admin', 'applications.manage'
        UNION ALL SELECT 'admin', 'colleges.read'
        UNION ALL SELECT 'admin', 'colleges.manage'
        UNION ALL SELECT 'admin', 'courses.read'
        UNION ALL SELECT 'admin', 'courses.manage'
        UNION ALL SELECT 'admin', 'jobs.read'
        UNION ALL SELECT 'admin', 'jobs.manage'
        UNION ALL SELECT 'admin', 'jobs.manage_own'
        UNION ALL SELECT 'admin', 'employers.manage_own'
        UNION ALL SELECT 'admin', 'users.read'
        UNION ALL SELECT 'admin', 'users.manage'
        UNION ALL SELECT 'admin', 'roles.read'
        UNION ALL SELECT 'admin', 'roles.manage'
        UNION ALL SELECT 'admin', 'payments.read_own'
        UNION ALL SELECT 'admin', 'payments.read_all'
        UNION ALL SELECT 'admin', 'payments.refund'
        UNION ALL SELECT 'admin', 'subscriptions.read_own'
        UNION ALL SELECT 'admin', 'subscriptions.manage'
        UNION ALL SELECT 'admin', 'documents.read_own'
        UNION ALL SELECT 'admin', 'documents.manage_own'
        UNION ALL SELECT 'admin', 'documents.read_assigned'
        UNION ALL SELECT 'admin', 'documents.review'
        UNION ALL SELECT 'admin', 'support.create'
        UNION ALL SELECT 'admin', 'support.manage'
        UNION ALL SELECT 'admin', 'reports.read'
        UNION ALL SELECT 'admin', 'audit_logs.read'
      ) AS expected
      LEFT JOIN roles AS r
        ON r.name = expected.role_name
      LEFT JOIN permissions AS p
        ON p.name = expected.permission_name
      LEFT JOIN role_permissions AS rp
        ON rp.role_id = r.id
       AND rp.permission_id = p.id
     WHERE rp.role_id IS NULL;
    IF v_missing_mappings <> 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Role seed verification failed: required role-permission mappings are missing';
    END IF;
    COMMIT;
END$$
DELIMITER ;
CALL seed_medorbits_roles();
DROP PROCEDURE IF EXISTS seed_medorbits_roles;
-- =============================================================================
-- Verification queries
-- =============================================================================
SELECT
    r.name AS role_name,
    r.display_name,
    r.is_system,
    r.is_active,
    COUNT(rp.permission_id) AS assigned_permission_count
FROM roles AS r
LEFT JOIN role_permissions AS rp
    ON rp.role_id = r.id
WHERE r.name IN ('user', 'admin', 'counsellor', 'employer')
GROUP BY r.id, r.name, r.display_name, r.is_system, r.is_active
ORDER BY r.name;
SELECT
    r.name AS role_name,
    p.name AS permission_name,
    p.resource,
    p.action
FROM role_permissions AS rp
INNER JOIN roles AS r
    ON r.id = rp.role_id
INNER JOIN permissions AS p
    ON p.id = rp.permission_id
WHERE r.name IN ('user', 'admin', 'counsellor', 'employer')
ORDER BY r.name, p.name;
-- =============================================================================
-- END OF SEED
-- =============================================================================