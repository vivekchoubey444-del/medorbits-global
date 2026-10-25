
-- =============================================================================
-- MedOrbits: Safe Illustrative College and University Seed
-- File: database/seeds/seed-colleges.sql
-- Database: MySQL 8.0.16+
-- Storage engine: InnoDB
--
-- PURPOSE
--   Seed two fictional universities and two fictional colleges for development
--   and automated testing only.
--
-- SAFETY
--   Never use these records as evidence of accreditation, recognition,
--   admission eligibility, available seats, or official institutional status.
--
-- IDEMPOTENCY
--   Re-running this script does not overwrite existing records.
--   Existing seed slugs are validated against their expected identifiers,
--   names, and relationships. Conflicting records cause a rollback.
--
-- PREREQUISITES
--   Migration: 004_create_colleges_universities.sql
--   Tables: universities, colleges
--   Engine: InnoDB
--   public_id: CHAR(36) or compatible UUID text representation
--   id: BIGINT UNSIGNED (or a compatible integer type)
--   Unique indexes: universities.slug, colleges.slug
--   Recommended: unique indexes on both public_id columns
--
-- Run only against a development/test database.
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
    -- 1. Insert fictional universities without overwriting existing records.
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
        'Fictional institution for local development and testing only.',
        FALSE
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
        'Fictional institution for development and automated testing only.',
        FALSE
    )
    ON DUPLICATE KEY UPDATE
        id = id;

    -- Aggregate queries return a row even when no matching record exists.
    SELECT MAX(id)
      INTO v_demo_university_id
      FROM universities
     WHERE slug = 'medorbits-demo-university';

    SELECT MAX(id)
      INTO v_health_university_id
      FROM universities
     WHERE slug = 'medorbits-sample-health-sciences-university';

    IF v_demo_university_id IS NULL
       OR v_health_university_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Seed failed: one or more expected universities are missing';
    END IF;

    -- Validate that the slugs resolve to the expected fictional records.
    SELECT COUNT(*)
      INTO v_count
      FROM universities
     WHERE (
            id = v_demo_university_id
            AND public_id = 'a7100000-0000-4000-8000-000000000001'
            AND name = 'MedOrbits Demonstration University'
           )
        OR (
            id = v_health_university_id
            AND public_id = 'a7100000-0000-4000-8000-000000000002'
            AND name = 'MedOrbits Sample Health Sciences University'
           );

    IF v_count <> 2 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Seed conflict: an existing university does not match the expected seed record';
    END IF;

    -- -------------------------------------------------------------------------
    -- 2. Insert fictional colleges without overwriting existing records.
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
        'Fictional college for application and catalogue testing only.',
        FALSE
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
        'Fictional college for development and automated testing only.',
        FALSE
    )
    ON DUPLICATE KEY UPDATE
        id = id;

    SELECT MAX(id)
      INTO v_demo_college_id
      FROM colleges
     WHERE slug = 'medorbits-demo-medical-college';

    SELECT MAX(id)
      INTO v_dental_college_id
      FROM colleges
     WHERE slug = 'medorbits-sample-dental-college';

    IF v_demo_college_id IS NULL
       OR v_dental_college_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Seed failed: one or more expected colleges are missing';
    END IF;

    -- Validate IDs, names, stable public IDs, and parent relationships.
    SELECT COUNT(*)
      INTO v_count
      FROM colleges
     WHERE (
            id = v_demo_college_id
            AND public_id = 'a7200000-0000-4000-8000-000000000001'
            AND name = 'MedOrbits Demonstration Medical College'
            AND university_id = v_demo_university_id
           )
        OR (
            id = v_dental_college_id
            AND public_id = 'a7200000-0000-4000-8000-000000000002'
            AND name = 'MedOrbits Sample Dental College'
            AND university_id = v_health_university_id
           );

    IF v_count <> 2 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Seed conflict: a college has an unexpected identifier, name, or university relationship';
    END IF;

    -- Ensure both colleges are linked to the intended universities.
    SELECT COUNT(*)
      INTO v_count
      FROM colleges AS c
      INNER JOIN universities AS u
        ON u.id = c.university_id
     WHERE (
            c.slug = 'medorbits-demo-medical-college'
            AND u.slug = 'medorbits-demo-university'
           )
        OR (
            c.slug = 'medorbits-sample-dental-college'
            AND u.slug = 'medorbits-sample-health-sciences-university'
           );

    IF v_count <> 2 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Seed failed: college-to-university relationships are invalid';
    END IF;

    COMMIT;

    -- -------------------------------------------------------------------------
    -- 3. Return verification results after a successful commit.
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
