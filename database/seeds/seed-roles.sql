
-- =============================================================================
-- MedOrbits: Seed Baseline Roles and Permissions
-- File: /database/seeds/seed-roles.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
--
-- Requires:
--   001_create_users.sql
--   002_create_roles_permissions.sql
--
-- SECURITY:
--   Does not assign the admin role to any user.
--   User-role assignment must be handled by trusted administrative workflows.
--
-- IDEMPOTENCY:
--   Requires unique role names, permission names, and role-permission pairs.
--   Existing records are not overwritten.
-- =============================================================================

DROP PROCEDURE IF EXISTS seed_medorbits_roles;

DELIMITER $$

CREATE PROCEDURE seed_medorbits_roles()
BEGIN
    DECLARE v_count INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- -------------------------------------------------------------------------
    -- 1. Baseline roles
    -- -------------------------------------------------------------------------

    INSERT INTO roles (
        name,
        display_name,
        description,
        is_system
    )
    VALUES
        ('user', 'User', 'Standard registered account.', TRUE),
        ('admin', 'Administrator', 'Administrative account.', TRUE),
        ('counsellor', 'Counsellor', 'Education guidance and application support.', TRUE),
        ('employer', 'Employer', 'Recruitment and employer account.', TRUE)
    ON DUPLICATE KEY UPDATE
        id = id;

    -- -------------------------------------------------------------------------
    -- 2. Baseline permissions
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

    -- -------------------------------------------------------------------------
    -- 3. Standard user permissions
    -- -------------------------------------------------------------------------

    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles AS r
    CROSS JOIN permissions AS p
    WHERE r.name = 'user'
      AND p.name IN (
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
    ON DUPLICATE KEY UPDATE
        role_id = role_id;

    -- -------------------------------------------------------------------------
    -- 4. Counsellor permissions
    -- -------------------------------------------------------------------------

    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles AS r
    CROSS JOIN permissions AS p
    WHERE r.name = 'counsellor'
      AND p.name IN (
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
    ON DUPLICATE KEY UPDATE
        role_id = role_id;

    -- -------------------------------------------------------------------------
    -- 5. Employer permissions
    -- -------------------------------------------------------------------------

    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles AS r
    CROSS JOIN permissions AS p
    WHERE r.name = 'employer'
      AND p.name IN (
          'profile.read_own',
          'profile.update_own',
          'jobs.read',
          'jobs.manage_own',
          'employers.manage_own',
          'support.create'
      )
    ON DUPLICATE KEY UPDATE
        role_id = role_id;

    -- -------------------------------------------------------------------------
    -- 6. Administrator permissions
    -- -------------------------------------------------------------------------

    -- This grants permissions to the admin role only.
    -- It does not assign that role to any user.
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles AS r
    CROSS JOIN permissions AS p
    WHERE r.name = 'admin'
      AND p.is_system = TRUE
    ON DUPLICATE KEY UPDATE
        role_id = role_id;

    -- -------------------------------------------------------------------------
    -- 7. Verify required baseline records
    -- -------------------------------------------------------------------------

    SELECT COUNT(*)
      INTO v_count
      FROM roles
     WHERE name IN ('user', 'admin', 'counsellor', 'employer');

    IF v_count <> 4 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Role seed verification failed';
    END IF;

    SELECT COUNT(*)
      INTO v_count
      FROM permissions
     WHERE name IN (
          'profile.read_own',
          'applications.create',
          'applications.read_assigned',
          'applications.review',
          'jobs.manage_own',
          'documents.read_assigned',
          'documents.review',
          'roles.manage',
          'payments.refund',
          'audit_logs.read'
     );

    IF v_count <> 10 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Permission seed verification failed';
    END IF;

    -- Ensure the administrator role has every system permission.
    SELECT COUNT(*)
      INTO v_count
      FROM permissions AS p
     WHERE p.is_system = TRUE
       AND NOT EXISTS (
           SELECT 1
           FROM role_permissions AS rp
           INNER JOIN roles AS r
               ON r.id = rp.role_id
           WHERE r.name = 'admin'
             AND rp.permission_id = p.id
       );

    IF v_count <> 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Administrator permission assignment verification failed';
    END IF;

    COMMIT;

    -- -------------------------------------------------------------------------
    -- 8. Display roles
    -- -------------------------------------------------------------------------

    SELECT
        id,
        name,
        display_name,
        is_system,
        is_active
    FROM roles
    WHERE name IN ('user', 'admin', 'counsellor', 'employer')
    ORDER BY name;

    -- -------------------------------------------------------------------------
    -- 9. Display permission assignments
    -- -------------------------------------------------------------------------

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

    -- -------------------------------------------------------------------------
    -- 10. Confirm no administrator user assignment was created by this seed
    -- -------------------------------------------------------------------------

    SELECT
        r.name AS role_name,
        COUNT(ur.user_id) AS assigned_user_count
    FROM roles AS r
    LEFT JOIN user_roles AS ur
        ON ur.role_id = r.id
    WHERE r.name = 'admin'
    GROUP BY r.name;
END$$

DELIMITER ;

CALL seed_medorbits_roles();

DROP PROCEDURE IF EXISTS seed_medorbits_roles;

-- =============================================================================
-- END OF SEED
-- =============================================================================
