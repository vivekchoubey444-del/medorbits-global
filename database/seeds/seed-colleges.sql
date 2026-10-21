
-- =============================================================================
-- MedOrbits: Seed Illustrative Institution Records
-- File: /database/seeds/seed-colleges.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
--
-- Requires:
--   004_create_colleges_universities.sql
--
-- SAFETY:
--   Development/test databases only.
--   All records below are fictional and must not be presented as recognized,
--   accredited, or officially approved educational institutions.
--
-- IDEMPOTENCY:
--   Requires UNIQUE constraints on universities.slug and colleges.slug.
--   Existing records are not overwritten.
--
-- IMPORTANT:
--   Run only against a development/test database.
-- =============================================================================

DROP PROCEDURE IF EXISTS seed_medorbits_colleges;

DELIMITER $$

CREATE PROCEDURE seed_medorbits_colleges()
BEGIN
    DECLARE v_demo_university_id BIGINT UNSIGNED DEFAULT NULL;
    DECLARE v_health_university_id BIGINT UNSIGNED DEFAULT NULL;
    DECLARE v_demo_college_id BIGINT UNSIGNED DEFAULT NULL;
    DECLARE v_dental_college_id BIGINT UNSIGNED DEFAULT NULL;
    DECLARE v_count INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- -------------------------------------------------------------------------
    -- 1. UNIVERSITIES
    -- Stable UUIDs make repeated seed runs deterministic.
    -- -------------------------------------------------------------------------

    INSERT INTO universities (
        public_id,
        name,
        slug,
        university_type,
        country,
        state,
        city,
        website,
        description,
        is_active
    )
    VALUES
    (
        'a7100000-0000-4000-8000-000000000001',
        'MedOrbits Demonstration University',
        'medorbits-demo-university',
        'Demonstration',
        'India',
        'Uttar Pradesh',
        'Noida',
        NULL,
        'Fictional university record for local development and testing.',
        TRUE
    ),
    (
        'a7100000-0000-4000-8000-000000000002',
        'MedOrbits Sample Health Sciences University',
        'medorbits-sample-health-sciences-university',
        'Demonstration',
        'India',
        'Assam',
        'Guwahati',
        NULL,
        'Fictional health sciences university record for development testing.',
        TRUE
    )
    ON DUPLICATE KEY UPDATE
        id = id;

    -- Resolve the universities by unique slug.
    SELECT id
      INTO v_demo_university_id
      FROM universities
     WHERE slug = 'medorbits-demo-university'
     LIMIT 1;

    SELECT id
      INTO v_health_university_id
      FROM universities
     WHERE slug = 'medorbits-sample-health-sciences-university'
     LIMIT 1;

    IF v_demo_university_id IS NULL
       OR v_health_university_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Required MedOrbits seed universities are missing';
    END IF;

    -- -------------------------------------------------------------------------
    -- 2. COLLEGES
    -- -------------------------------------------------------------------------

    INSERT INTO colleges (
        public_id,
        university_id,
        name,
        slug,
        college_type,
        country,
        state,
        city,
        address,
        pincode,
        website,
        description,
        is_active
    )
    VALUES
    (
        'a7200000-0000-4000-8000-000000000001',
        v_demo_university_id,
        'MedOrbits Demonstration Medical College',
        'medorbits-demo-medical-college',
        'Demonstration Medical College',
        'India',
        'Uttar Pradesh',
        'Noida',
        NULL,
        NULL,
        NULL,
        'Fictional college record for application and catalogue testing.',
        TRUE
    ),
    (
        'a7200000-0000-4000-8000-000000000002',
        v_health_university_id,
        'MedOrbits Sample Dental College',
        'medorbits-sample-dental-college',
        'Demonstration Dental College',
        'India',
        'Assam',
        'Guwahati',
        NULL,
        NULL,
        NULL,
        'Fictional college record for development and automated tests.',
        TRUE
    )
    ON DUPLICATE KEY UPDATE
        id = id;

    -- -------------------------------------------------------------------------
    -- 3. VERIFY RECORDS AND RELATIONSHIPS
    -- -------------------------------------------------------------------------

    SELECT id
      INTO v_demo_college_id
      FROM colleges
     WHERE slug = 'medorbits-demo-medical-college'
     LIMIT 1;

    SELECT id
      INTO v_dental_college_id
      FROM colleges
     WHERE slug = 'medorbits-sample-dental-college'
     LIMIT 1;

    IF v_demo_college_id IS NULL OR v_dental_college_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Required MedOrbits seed colleges are missing';
    END IF;

    SELECT COUNT(*)
      INTO v_count
      FROM colleges
     WHERE (
            slug = 'medorbits-demo-medical-college'
            AND university_id = v_demo_university_id
           )
        OR (
            slug = 'medorbits-sample-dental-college'
            AND university_id = v_health_university_id
           );

    IF v_count <> 2 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Seed college-to-university relationships do not match';
    END IF;

    COMMIT;

    -- -------------------------------------------------------------------------
    -- 4. OUTPUT VERIFICATION RESULTS
    -- -------------------------------------------------------------------------

    SELECT
        id,
        public_id,
        name,
        slug,
        university_type,
        country,
        state,
        city,
        is_active
    FROM universities
    WHERE slug IN (
        'medorbits-demo-university',
        'medorbits-sample-health-sciences-university'
    )
    ORDER BY slug;

    SELECT
        c.id,
        c.public_id,
        c.name AS college_name,
        c.slug AS college_slug,
        c.college_type,
        u.name AS university_name,
        u.slug AS university_slug,
        c.country,
        c.state,
        c.city,
        c.is_active
    FROM colleges AS c
    INNER JOIN universities AS u
        ON u.id = c.university_id
    WHERE c.slug IN (
        'medorbits-demo-medical-college',
        'medorbits-sample-dental-college'
    )
    ORDER BY c.slug;
END$$

DELIMITER ;

CALL seed_medorbits_colleges();

DROP PROCEDURE IF EXISTS seed_medorbits_colleges;

-- =============================================================================
-- END OF SEED
-- =============================================================================
