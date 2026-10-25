
-- =============================================================================
-- MedOrbits: Development Seed Orchestrator
-- File: database/seeds/seed-development.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
--
-- PURPOSE
--   Run the baseline development seed scripts in a controlled sequence.
--
-- REQUIRED SEED FILES
--   database/seeds/seed-roles.sql
--   database/seeds/seed-colleges.sql
--
-- EXECUTION
--   Run from the repository root using the MySQL command-line client.
--
--   First, connect to a development/test database, then execute:
--
--     SET @medorbits_allow_development_seed = 1;
--     SOURCE database/seeds/seed-development.sql;
--
-- SAFETY
--   1. Requires explicit session opt-in.
--   2. Requires a database name containing dev, test, or development.
--   3. Does not create users or assign administrator roles to users.
--   4. The individual seed scripts retain their own validation.
--
-- IMPORTANT
--   SOURCE is a MySQL command-line client directive, not server-side SQL.
--   Do not execute this file through an application database driver.
-- =============================================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS assert_medorbits_development_seed_allowed$$

CREATE PROCEDURE assert_medorbits_development_seed_allowed()
BEGIN
    DECLARE v_database_name VARCHAR(255);
    DECLARE v_allowed TINYINT DEFAULT 0;

    SET v_database_name = DATABASE();

    IF v_database_name IS NULL OR v_database_name = '' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Development seed blocked: no database is selected';
    END IF;

    IF COALESCE(@medorbits_allow_development_seed, 0) <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Development seed blocked: explicitly set @medorbits_allow_development_seed = 1 in this session';
    END IF;

    IF LOWER(v_database_name) REGEXP '(^|[_-])(dev|development|test|testing)([_-]|$)' THEN
        SET v_allowed = 1;
    END IF;

    IF v_allowed <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Development seed blocked: database name must clearly identify a development or test database';
    END IF;
END$$

DELIMITER ;

CALL assert_medorbits_development_seed_allowed();

DROP PROCEDURE IF EXISTS assert_medorbits_development_seed_allowed;

-- ---------------------------------------------------------------------------
-- Seed baseline roles and permissions.
-- ---------------------------------------------------------------------------

SOURCE database/seeds/seed-roles.sql

-- ---------------------------------------------------------------------------
-- Seed fictional universities and colleges.
-- ---------------------------------------------------------------------------

SOURCE database/seeds/seed-colleges.sql

-- ---------------------------------------------------------------------------
-- Final verification.
-- ---------------------------------------------------------------------------

SELECT
    DATABASE() AS database_name,
    'development_seed_completed' AS seed_status,
    CURRENT_TIMESTAMP AS completed_at;

SELECT
    name AS role_name,
    display_name,
    is_system,
    is_active
FROM roles
WHERE name IN ('user', 'admin', 'counsellor', 'employer')
ORDER BY name;

SELECT
    slug,
    name,
    university_type,
    is_active
FROM universities
WHERE slug IN (
    'medorbits-demo-university',
    'medorbits-sample-health-sciences-university'
)
ORDER BY slug;

SELECT
    c.slug AS college_slug,
    c.name AS college_name,
    u.slug AS university_slug,
    u.name AS university_name,
    c.is_active
FROM colleges AS c
INNER JOIN universities AS u
    ON u.id = c.university_id
WHERE c.slug IN (
    'medorbits-demo-medical-college',
    'medorbits-sample-dental-college'
)
ORDER BY c.slug;

-- =============================================================================
-- END OF DEVELOPMENT SEED ORCHESTRATOR
-- =============================================================================
