-- =============================================================================
-- MedOrbits: Development Seed Orchestrator
-- File: database/seeds/seed-development.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
--
-- PURPOSE
--   Run baseline development seeds in a controlled sequence.
--
-- REQUIRED SEED FILES
--   database/seeds/seed-roles.sql
--   database/seeds/seed-colleges.sql
--
-- EXECUTION
--   From the repository root, connect to a development/test database and run:
--
--     SET @medorbits_allow_development_seed = 1;
--     SOURCE database/seeds/seed-development.sql;
--
-- SAFETY
--   Requires explicit session opt-in and a development/test database name.
--   Does not create user accounts or assign roles to users.
--   Individual seed scripts must retain their own validation.
--
-- IMPORTANT
--   SOURCE is a MySQL client command, not SQL understood by database drivers.
--   Use the MySQL CLI with --abort-source-on-error.
-- =============================================================================
-- ---------------------------------------------------------------------------
-- 1. Validate the execution environment before running any seed.
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS assert_medorbits_development_seed_allowed;
DELIMITER $$
CREATE PROCEDURE assert_medorbits_development_seed_allowed()
BEGIN
    DECLARE v_database_name VARCHAR(255);
    SET v_database_name = DATABASE();
    IF v_database_name IS NULL OR v_database_name = '' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Development seed blocked: no database is selected';
    END IF;
    IF COALESCE(@medorbits_allow_development_seed, 0) <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Development seed blocked: explicit session opt-in is required';
    END IF;
    IF LOWER(v_database_name)
       NOT REGEXP '(^|[_-])(dev|development|test|testing)([_-]|$)' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Development seed blocked: database name must identify development or testing';
    END IF;
END$$
DELIMITER ;
CALL assert_medorbits_development_seed_allowed();
DROP PROCEDURE IF EXISTS assert_medorbits_development_seed_allowed;
-- ---------------------------------------------------------------------------
-- 2. Seed baseline roles and permissions.
-- ---------------------------------------------------------------------------
SOURCE database/seeds/seed-roles.sql
-- ---------------------------------------------------------------------------
-- 3. Seed fictional universities and colleges.
-- ---------------------------------------------------------------------------
SOURCE database/seeds/seed-colleges.sql
-- ---------------------------------------------------------------------------
-- 4. Verify seeded roles.
-- ---------------------------------------------------------------------------
SELECT
    name AS role_name,
    display_name,
    is_system,
    is_active
FROM roles
WHERE name IN ('user', 'admin', 'counsellor', 'employer')
ORDER BY name;
-- ---------------------------------------------------------------------------
-- 5. Verify fictional universities.
-- ---------------------------------------------------------------------------
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
-- ---------------------------------------------------------------------------
-- 6. Verify fictional colleges and their university relationships.
-- ---------------------------------------------------------------------------
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
-- ---------------------------------------------------------------------------
-- 7. Report completion only after all preceding commands have succeeded.
-- ---------------------------------------------------------------------------
SELECT
    DATABASE() AS database_name,
    'development_seed_completed' AS seed_status,
    CURRENT_TIMESTAMP AS completed_at;
-- =============================================================================
-- END OF DEVELOPMENT SEED ORCHESTRATOR
-- =============================================================================