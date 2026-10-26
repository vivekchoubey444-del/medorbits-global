-- =============================================================================
-- MedOrbits: Safe Illustrative College and University Seed
-- File: database/seeds/seed-colleges.sql
-- Database: MySQL 8.0.16+
-- Storage engine: InnoDB
--
-- PURPOSE
--   Seed two fictional universities and two fictional colleges for
--   development and automated testing only.
--
-- PREREQUISITES
--   Migration: 004_create_colleges_universities.sql
--   Tables: universities, colleges
--   Expected unique keys: universities.slug, universities.public_id,
--                         colleges.slug, colleges.public_id
--
-- SAFETY
--   All records are inactive and fictional.
--   Existing records are never overwritten.
--   Conflicting records cause rollback.
--   This script never creates real accreditation or admission claims.
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
    DECLARE v_conflicts INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    START TRANSACTION;
    -- -------------------------------------------------------------------------
    -- 1. Verify required tables and storage engines.
    -- -------------------------------------------------------------------------
    SELECT COUNT(*)
      INTO v_count
      FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_type = 'BASE TABLE'
       AND engine = 'InnoDB'
       AND table_name IN ('universities', 'colleges');
    IF v_count <> 2 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Seed failed: universities and colleges must exist and use InnoDB';
    END IF;
    -- -------------------------------------------------------------------------
    -- 2. Insert fictional universities without overwriting existing records.
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
            SET MESSAGE_TEXT =
                'Seed failed: expected university records were not found';
    END IF;
    -- Validate complete canonical university definitions.
    SELECT COUNT(*)
      INTO v_conflicts
      FROM universities
     WHERE
        (
            slug = 'medorbits-demo-university'
            AND NOT (
                public_id <=> 'a7100000-0000-4000-8000-000000000001'
                AND name <=> 'MedOrbits Demonstration University'
                AND university_type <=> 'Demonstration'
                AND country <=> 'India'
                AND state <=> 'Uttar Pradesh'
                AND city <=> 'Noida'
                AND website IS NULL
                AND description <=> 'Fictional institution for local development and testing only.'
                AND is_active <=> FALSE
            )
        )
        OR
        (
            slug = 'medorbits-sample-health-sciences-university'
            AND NOT (
                public_id <=> 'a7100000-0000-4000-8000-000000000002'
                AND name <=> 'MedOrbits Sample Health Sciences University'
                AND university_type <=> 'Demonstration'
                AND country <=> 'India'
                AND state <=> 'Assam'
                AND city <=> 'Guwahati'
                AND website IS NULL
                AND description <=> 'Fictional institution for development and automated testing only.'
                AND is_active <=> FALSE
            )
        );
    IF v_conflicts <> 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Seed conflict: an existing university differs from the canonical fictional record';
    END IF;
    -- A stable public ID must not be used by a different slug.
    SELECT COUNT(*)
      INTO v_conflicts
      FROM universities
     WHERE public_id IN (
         'a7100000-0000-4000-8000-000000000001',
         'a7100000-0000-4000-8000-000000000002'
     )
       AND slug NOT IN (
         'medorbits-demo-university',
         'medorbits-sample-health-sciences-university'
     );
    IF v_conflicts <> 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Seed conflict: a university public ID is already assigned to another slug';
    END IF;
    -- -------------------------------------------------------------------------
    -- 3. Insert fictional colleges without overwriting existing records.
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
    IF v_demo_college_id IS NULL
       OR v_dental_college_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Seed failed: expected college records were not found';
    END IF;
    -- Validate complete canonical college definitions and relationships.
    SELECT COUNT(*)
      INTO v_conflicts
      FROM colleges AS c
     WHERE
        (
            c.slug = 'medorbits-demo-medical-college'
            AND NOT (
                c.public_id <=> 'a7200000-0000-4000-8000-000000000001'
                AND c.university_id <=> v_demo_university_id
                AND c.name <=> 'MedOrbits Demonstration Medical College'
                AND c.college_type <=> 'Demonstration Medical College'
                AND c.country <=> 'India'
                AND c.state <=> 'Uttar Pradesh'
                AND c.city <=> 'Noida'
                AND c.address IS NULL
                AND c.pincode IS NULL
                AND c.website IS NULL
                AND c.description <=> 'Fictional college for application and catalogue testing only.'
                AND c.is_active <=> FALSE
            )
        )
        OR
        (
            c.slug = 'medorbits-sample-dental-college'
            AND NOT (
                c.public_id <=> 'a7200000-0000-4000-8000-000000000002'
                AND c.university_id <=> v_health_university_id
                AND c.name <=> 'MedOrbits Sample Dental College'
                AND c.college_type <=> 'Demonstration Dental College'
                AND c.country <=> 'India'
                AND c.state <=> 'Assam'
                AND c.city <=> 'Guwahati'
                AND c.address IS NULL
                AND c.pincode IS NULL
                AND c.website IS NULL
                AND c.description <=> 'Fictional college for development and automated testing only.'
                AND c.is_active <=> FALSE
            )
        );
    IF v_conflicts <> 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Seed conflict: an existing college differs from the canonical fictional record';
    END IF;
    -- A college public ID must not be assigned to another slug.
    SELECT COUNT(*)
      INTO v_conflicts
      FROM colleges
     WHERE public_id IN (
         'a7200000-0000-4000-8000-000000000001',
         'a7200000-0000-4000-8000-000000000002'
     )
       AND slug NOT IN (
         'medorbits-demo-medical-college',
         'medorbits-sample-dental-college'
     );
    IF v_conflicts <> 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Seed conflict: a college public ID is already assigned to another slug';
    END IF;
    -- -------------------------------------------------------------------------
    -- 4. Verify both college-to-university relationships.
    -- -------------------------------------------------------------------------
    SELECT COUNT(*)
      INTO v_count
      FROM colleges AS c
      INNER JOIN universities AS u
        ON u.id = c.university_id
     WHERE
        (
            c.slug = 'medorbits-demo-medical-college'
            AND u.slug = 'medorbits-demo-university'
        )
        OR
        (
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
    -- 5. Return verification results.
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