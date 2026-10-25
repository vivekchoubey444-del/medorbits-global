
-- =============================================================================
-- MedOrbits: Seed Minimal Synthetic Demonstration Data
-- File: /database/seeds/seed-demo-data.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
--
-- Requires:
--   001_create_users.sql
--   003_create_courses.sql
--   004_create_colleges_universities.sql
--   005_create_applications.sql
--   database/seeds/seed-courses.sql
--   database/seeds/seed-colleges.sql
--
-- Prerequisite:
--   A synthetic user with email demo-applicant@example.invalid
--
-- SAFETY:
--   Development/test databases only.
--   Does not create login accounts or payment records.
--   All applicant details are fictional.
--   Never execute against production.
--
-- IDEMPOTENCY:
--   Requires UNIQUE constraints on applications.application_number.
--   Existing demo applications are not overwritten.
-- =============================================================================

DROP PROCEDURE IF EXISTS seed_medorbits_demo_data;

DELIMITER $$

CREATE PROCEDURE seed_medorbits_demo_data()
BEGIN
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

    START TRANSACTION;

    -- -------------------------------------------------------------------------
    -- 1. Validate prerequisites
    -- -------------------------------------------------------------------------

    SELECT id
      INTO v_user_id
      FROM users
     WHERE email = 'demo-applicant@example.invalid'
       AND deleted_at IS NULL
     LIMIT 1;

    SELECT id
      INTO v_course_id
      FROM courses
     WHERE slug = 'mbbs'
       AND is_active = TRUE
     LIMIT 1;

    SELECT id
      INTO v_college_id
      FROM colleges
     WHERE slug = 'medorbits-demo-medical-college'
       AND is_active = TRUE
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Demo seed failed: prerequisite synthetic user is missing';
    END IF;

    IF v_course_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Demo seed failed: active MBBS course is missing';
    END IF;

    IF v_college_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Demo seed failed: active demo college is missing';
    END IF;

    -- -------------------------------------------------------------------------
    -- 2. Insert demo application without overwriting existing records
    -- -------------------------------------------------------------------------

    INSERT INTO applications (
        public_id,
        application_number,
        user_id,
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
        'submitted',
        'Synthetic demonstration record. Not a real admission application.',
        CURRENT_TIMESTAMP(3)
    )
    ON DUPLICATE KEY UPDATE
        id = id;

    -- -------------------------------------------------------------------------
    -- 3. Verify the existing or inserted application
    -- -------------------------------------------------------------------------

    SELECT id
      INTO v_application_id
      FROM applications
     WHERE application_number = 'DEMO-APPLICATION-0001'
     LIMIT 1;

    IF v_application_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Demo seed failed: application record was not created';
    END IF;

    SELECT COUNT(*)
      INTO v_count
      FROM applications
     WHERE id = v_application_id
       AND user_id = v_user_id
       AND course_id = v_course_id
       AND college_id = v_college_id
       AND applicant_email = 'demo-applicant@example.invalid';

    IF v_count <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Demo seed failed: existing application does not match expected relationships';
    END IF;

    COMMIT;

    -- -------------------------------------------------------------------------
    -- 4. Display the verified demo application
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
        a.submitted_at
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
