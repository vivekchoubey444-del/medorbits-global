-- =============================================================================
-- MedOrbits: Seed Minimal Synthetic Demonstration Data
-- File: database/seeds/seed-demo-data.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
--
-- REQUIRED MIGRATIONS
--   001_create_users.sql
--   003_create_courses.sql
--   004_create_colleges_universities.sql
--   005_create_applications.sql
--
-- REQUIRED SEEDS
--   database/seeds/seed-courses.sql
--   database/seeds/seed-colleges.sql
--
-- REQUIRED FIXTURE
--   User: demo-applicant@example.invalid
--
-- SAFETY
--   Development/test databases only.
--   Requires explicit session opt-in.
--   Does not create login accounts or payment records.
--   Never updates an existing application.
--
-- IMPORTANT:
--   Confirm all referenced columns and status values match your migrations.
--   This file is MySQL-specific and is not compatible with PostgreSQL.
--
-- EXECUTION
--   SET @medorbits_allow_development_seed = 1;
--   SOURCE database/seeds/seed-demo-data.sql;
-- =============================================================================
DROP PROCEDURE IF EXISTS seed_medorbits_demo_data;
DELIMITER $$
CREATE PROCEDURE seed_medorbits_demo_data()
BEGIN
    DECLARE v_database_name VARCHAR(255);
    DECLARE v_user_id BIGINT UNSIGNED DEFAULT NULL;
    DECLARE v_course_id BIGINT UNSIGNED DEFAULT NULL;
    DECLARE v_college_id BIGINT UNSIGNED DEFAULT NULL;
    DECLARE v_application_id BIGINT UNSIGNED DEFAULT NULL;
    DECLARE v_count INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    -- -------------------------------------------------------------------------
    -- 1. Safety gate
    -- -------------------------------------------------------------------------
    SET v_database_name = DATABASE();
    IF v_database_name IS NULL OR v_database_name = '' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Demo seed blocked: no database is selected';
    END IF;
    IF COALESCE(@medorbits_allow_development_seed, 0) <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Demo seed blocked: explicit session opt-in is required';
    END IF;
    IF LOWER(v_database_name)
       NOT REGEXP '(^|[_-])(dev|development|test|testing)([_-]|$)' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Demo seed blocked: database name must identify development or testing';
    END IF;
    START TRANSACTION;
    -- -------------------------------------------------------------------------
    -- 2. Resolve prerequisite records
    -- -------------------------------------------------------------------------
    SELECT MAX(id)
      INTO v_user_id
      FROM users
     WHERE email = 'demo-applicant@example.invalid'
       AND deleted_at IS NULL;
    SELECT MAX(id)
      INTO v_course_id
      FROM courses
     WHERE slug = 'mbbs'
       AND is_active = TRUE;
    -- The illustrative college may be inactive by design.
    SELECT MAX(id)
      INTO v_college_id
      FROM colleges
     WHERE slug = 'medorbits-demo-medical-college'
       AND deleted_at IS NULL;
    IF v_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Demo seed failed: applicant fixture is missing or deleted';
    END IF;
    IF v_course_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Demo seed failed: active MBBS course is missing';
    END IF;
    IF v_college_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Demo seed failed: illustrative college is missing or deleted';
    END IF;
    -- -------------------------------------------------------------------------
    -- 3. Insert the synthetic draft application
    --
    -- ON DUPLICATE KEY UPDATE is intentionally a no-op.
    -- Section 4 validates the existing record before allowing COMMIT.
    -- -------------------------------------------------------------------------
    INSERT INTO applications (
        public_id,
        application_number,
        applicant_id,
        course_id,
        college_id,
        applicant_name,
        applicant_email,
        applicant_phone,
        status,
        notes,
        submitted_at
    )
    VALUES (
        'a7400000-0000-4000-8000-000000000001',
        'DEMO-APPLICATION-0001',
        v_user_id,
        v_course_id,
        v_college_id,
        'Demo Applicant',
        'demo-applicant@example.invalid',
        NULL,
        'draft',
        'SYNTHETIC DEVELOPMENT FIXTURE. Not a real admission application.',
        NULL
    )
    ON DUPLICATE KEY UPDATE
        id = id;
    -- -------------------------------------------------------------------------
    -- 4. Resolve by the unique application number and validate the record
    -- -------------------------------------------------------------------------
    SELECT MAX(id)
      INTO v_application_id
      FROM applications
     WHERE application_number = 'DEMO-APPLICATION-0001';
    IF v_application_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Demo seed failed: application fixture was not found';
    END IF;
    SELECT COUNT(*)
      INTO v_count
      FROM applications AS a
     WHERE a.id = v_application_id
       AND a.public_id =
           'a7400000-0000-4000-8000-000000000001'
       AND a.application_number = 'DEMO-APPLICATION-0001'
       AND a.applicant_id = v_user_id
       AND a.course_id = v_course_id
       AND a.college_id = v_college_id
       AND a.applicant_name = 'Demo Applicant'
       AND a.applicant_email = 'demo-applicant@example.invalid'
       AND a.status = 'draft'
       AND a.submitted_at IS NULL
       AND a.notes =
           'SYNTHETIC DEVELOPMENT FIXTURE. Not a real admission application.';
    IF v_count <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Demo seed conflict: existing application differs from the expected fixture';
    END IF;
    -- -------------------------------------------------------------------------
    -- 5. Verify linked records
    -- -------------------------------------------------------------------------
    SELECT COUNT(*)
      INTO v_count
      FROM applications AS a
      INNER JOIN users AS u
        ON u.id = a.applicant_id
      INNER JOIN courses AS c
        ON c.id = a.course_id
      INNER JOIN colleges AS cl
        ON cl.id = a.college_id
     WHERE a.id = v_application_id
       AND u.email = 'demo-applicant@example.invalid'
       AND u.deleted_at IS NULL
       AND c.slug = 'mbbs'
       AND cl.slug = 'medorbits-demo-medical-college'
       AND a.status = 'draft'
       AND a.submitted_at IS NULL;
    IF v_count <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Demo seed failed: prerequisite relationships or application state are invalid';
    END IF;
    COMMIT;
    -- -------------------------------------------------------------------------
    -- 6. Display verification results
    -- -------------------------------------------------------------------------
    SELECT
        a.id,
        a.public_id,
        a.application_number,
        a.applicant_name,
        a.applicant_email,
        a.status,
        c.name AS course_name,
        cl.name AS college_name,
        a.submitted_at,
        'SYNTHETIC DEVELOPMENT DATA' AS record_classification
    FROM applications AS a
    INNER JOIN courses AS c
        ON c.id = a.course_id
    INNER JOIN colleges AS cl
        ON cl.id = a.college_id
    WHERE a.id = v_application_id;
END$$
DELIMITER ;
CALL seed_medorbits_demo_data();
DROP PROCEDURE IF EXISTS seed_medorbits_demo_data;
-- =============================================================================
-- END OF SEED
-- =============================================================================