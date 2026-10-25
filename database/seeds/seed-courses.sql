
-- =============================================================================
-- MedOrbits: Expanded Illustrative Education Course Seed
-- File: database/seeds/seed-courses.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
--
-- PURPOSE
--   Seed a broader course catalogue for development and automated testing.
--
-- SAFETY
--   Development/test databases only.
--   Explicit session opt-in is mandatory.
--   Does not create users, applications, payments, or role assignments.
--   Course records are illustrative and do not establish regulatory approval.
--
-- IDEMPOTENCY
--   Requires UNIQUE constraints on courses.slug and courses.public_id.
--   Existing rows are not overwritten.
--   Conflicting existing seed records cause rollback.
--
-- SCHEMA ASSUMPTIONS
--   courses columns:
--     id, public_id, name, slug, code, category, qualification_level,
--     description, duration_months, eligibility, entrance_exam, is_active
--
-- EXECUTION (MySQL command-line client)
--   SET @medorbits_allow_development_seed = 1;
--   SOURCE database/seeds/seed-courses.sql;
-- =============================================================================

DROP PROCEDURE IF EXISTS seed_medorbits_courses;

DELIMITER $$

CREATE PROCEDURE seed_medorbits_courses()
BEGIN
    DECLARE v_database_name VARCHAR(255);
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_conflict_count INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- -------------------------------------------------------------------------
    -- 1. Development/test database guard
    -- -------------------------------------------------------------------------

    SET v_database_name = DATABASE();

    IF v_database_name IS NULL OR v_database_name = '' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Course seed blocked: no database is selected';
    END IF;

    IF COALESCE(@medorbits_allow_development_seed, 0) <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Course seed blocked: explicit development seed opt-in is required';
    END IF;

    IF LOWER(v_database_name)
       NOT REGEXP '(^|[_-])(dev|development|test|testing)([_-]|$)' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Course seed blocked: database name must identify a development or test database';
    END IF;

    START TRANSACTION;

    -- -------------------------------------------------------------------------
    -- 2. Insert illustrative course records.
    --
    -- Duration and entrance-exam fields are sample catalogue metadata.
    -- NULL entrance_exam means "not specified in this sample", not "no exam".
    -- -------------------------------------------------------------------------

    INSERT INTO courses (
        public_id,
        name,
        slug,
        code,
        category,
        qualification_level,
        description,
        duration_months,
        eligibility,
        entrance_exam,
        is_active
    )
    VALUES
    (
        'a7300000-0000-4000-8000-000000000001',
        'Bachelor of Medicine and Bachelor of Surgery',
        'mbbs',
        'MBBS',
        'Medical',
        'Undergraduate',
        'Illustrative medical course catalogue entry for development testing.',
        66,
        'Verify current eligibility, course duration, internship requirements, and admission rules with official authorities.',
        'NEET-UG',
        TRUE
    ),
    (
        'a7300000-0000-4000-8000-000000000002',
        'Bachelor of Dental Surgery',
        'bds',
        'BDS',
        'Dental',
        'Undergraduate',
        'Illustrative dental course catalogue entry for development testing.',
        60,
        'Verify current eligibility, course duration, internship requirements, and admission rules with official authorities.',
        'NEET-UG',
        TRUE
    ),
    (
        'a7300000-0000-4000-8000-000000000003',
        'Bachelor of Ayurvedic Medicine and Surgery',
        'bams',
        'BAMS',
        'AYUSH',
        'Undergraduate',
        'Illustrative Ayurveda course catalogue entry for development testing.',
        66,
        'Verify current eligibility, course duration, internship requirements, and admission rules with official authorities.',
        'NEET-UG',
        TRUE
    ),
    (
        'a7300000-0000-4000-8000-000000000004',
        'Bachelor of Pharmacy',
        'b-pharm',
        'BPHARM',
        'Pharmacy',
        'Undergraduate',
        'Illustrative pharmacy course catalogue entry for development testing.',
        48,
        'Verify eligibility, course duration, and admission requirements with the relevant institution and regulator.',
        NULL,
        TRUE
    ),
    (
        'a7300000-0000-4000-8000-000000000005',
        'Bachelor of Science in Nursing',
        'bsc-nursing',
        'BSCN',
        'Nursing',
        'Undergraduate',
        'Illustrative nursing course catalogue entry for development testing.',
        48,
        'Verify eligibility, clinical training requirements, and admission rules with the relevant institution and regulator.',
        NULL,
        TRUE
    ),
    (
        'a7300000-0000-4000-8000-000000000006',
        'Bachelor of Technology in Computer Science',
        'btech-computer-science',
        'BTECH-CSE',
        'Engineering',
        'Undergraduate',
        'Illustrative computer science engineering course catalogue entry for development testing.',
        48,
        'Verify academic eligibility and entrance requirements with the relevant institution.',
        NULL,
        TRUE
    ),
    (
        'a7300000-0000-4000-8000-000000000007',
        'Bachelor of Science in Medical Laboratory Technology',
        'bsc-medical-lab-technology',
        'BSC-MLT',
        'Allied Health Sciences',
        'Undergraduate',
        'Illustrative medical laboratory technology course catalogue entry for development testing.',
        36,
        'Verify the course title, eligibility, clinical training, and duration with the relevant institution.',
        NULL,
        TRUE
    ),
    (
        'a7300000-0000-4000-8000-000000000008',
        'Bachelor of Physiotherapy',
        'bachelor-physiotherapy',
        'BPT',
        'Allied Health Sciences',
        'Undergraduate',
        'Illustrative physiotherapy course catalogue entry for development testing.',
        54,
        'Verify current course duration, internship requirements, eligibility, and admission rules with official authorities.',
        NULL,
        TRUE
    ),
    (
        'a7300000-0000-4000-8000-000000000009',
        'Bachelor of Science in Radiology and Imaging Technology',
        'bsc-radiology-imaging',
        'BSC-RIT',
        'Allied Health Sciences',
        'Undergraduate',
        'Illustrative radiology and imaging technology course catalogue entry for development testing.',
        36,
        'Verify course nomenclature, eligibility, clinical training, and duration with the relevant institution.',
        NULL,
        TRUE
    ),
    (
        'a7300000-0000-4000-8000-000000000010',
        'Master of Business Administration',
        'mba',
        'MBA',
        'Management',
        'Postgraduate',
        'Illustrative management course catalogue entry for development testing.',
        24,
        'Verify graduation requirements, selection criteria, and accepted entrance tests with the relevant institution.',
        NULL,
        TRUE
    ),
    (
        'a7300000-0000-4000-8000-000000000011',
        'Master of Science in Data Science',
        'msc-data-science',
        'MSC-DS',
        'Data Science',
        'Postgraduate',
        'Illustrative data science course catalogue entry for development testing.',
        24,
        'Verify eligible undergraduate qualifications and admission requirements with the relevant institution.',
        NULL,
        TRUE
    ),
    (
        'a7300000-0000-4000-8000-000000000012',
        'Bachelor of Business Administration',
        'bba',
        'BBA',
        'Management',
        'Undergraduate',
        'Illustrative business administration course catalogue entry for development testing.',
        36,
        'Verify the eligible school-leaving qualification and admission criteria with the relevant institution.',
        NULL,
        TRUE
    )
    ON DUPLICATE KEY UPDATE
        id = id;

    -- -------------------------------------------------------------------------
    -- 3. Ensure all 12 expected slugs exist.
    -- -------------------------------------------------------------------------

    SELECT COUNT(DISTINCT slug)
      INTO v_count
      FROM courses
     WHERE slug IN (
        'mbbs',
        'bds',
        'bams',
        'b-pharm',
        'bsc-nursing',
        'btech-computer-science',
        'bsc-medical-lab-technology',
        'bachelor-physiotherapy',
        'bsc-radiology-imaging',
        'mba',
        'msc-data-science',
        'bba'
     );

    IF v_count <> 12 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Course seed failed: one or more expected course slugs are missing';
    END IF;

    -- -------------------------------------------------------------------------
    -- 4. Validate identifiers and key attributes.
    --
    -- A conflicting slug, public UUID, code, name, category, level, duration,
    -- or entrance-exam value causes rollback. Existing rows are not repaired.
    -- -------------------------------------------------------------------------

    SELECT COUNT(*)
      INTO v_conflict_count
      FROM (
        SELECT
            'a7300000-0000-4000-8000-000000000001' AS expected_public_id,
            'mbbs' AS expected_slug,
            'Bachelor of Medicine and Bachelor of Surgery' AS expected_name,
            'MBBS' AS expected_code,
            'Medical' AS expected_category,
            'Undergraduate' AS expected_level,
            66 AS expected_duration,
            'NEET-UG' AS expected_exam

        UNION ALL SELECT
            'a7300000-0000-4000-8000-000000000002',
            'bds',
            'Bachelor of Dental Surgery',
            'BDS',
            'Dental',
            'Undergraduate',
            60,
            'NEET-UG'

        UNION ALL SELECT
            'a7300000-0000-4000-8000-000000000003',
            'bams',
            'Bachelor of Ayurvedic Medicine and Surgery',
            'BAMS',
            'AYUSH',
            'Undergraduate',
            66,
            'NEET-UG'

        UNION ALL SELECT
            'a7300000-0000-4000-8000-000000000004',
            'b-pharm',
            'Bachelor of Pharmacy',
            'BPHARM',
            'Pharmacy',
            'Undergraduate',
            48,
            NULL

        UNION ALL SELECT
            'a7300000-0000-4000-8000-000000000005',
            'bsc-nursing',
            'Bachelor of Science in Nursing',
            'BSCN',
            'Nursing',
            'Undergraduate',
            48,
            NULL

        UNION ALL SELECT
            'a7300000-0000-4000-8000-000000000006',
            'btech-computer-science',
            'Bachelor of Technology in Computer Science',
            'BTECH-CSE',
            'Engineering',
            'Undergraduate',
            48,
            NULL

        UNION ALL SELECT
            'a7300000-0000-4000-8000-000000000007',
            'bsc-medical-lab-technology',
            'Bachelor of Science in Medical Laboratory Technology',
            'BSC-MLT',
            'Allied Health Sciences',
            'Undergraduate',
            36,
            NULL

        UNION ALL SELECT
            'a7300000-0000-4000-8000-000000000008',
            'bachelor-physiotherapy',
            'Bachelor of Physiotherapy',
            'BPT',
            'Allied Health Sciences',
            'Undergraduate',
            54,
            NULL

        UNION ALL SELECT
            'a7300000-0000-4000-8000-000000000009',
            'bsc-radiology-imaging',
            'Bachelor of Science in Radiology and Imaging Technology',
            'BSC-RIT',
            'Allied Health Sciences',
            'Undergraduate',
            36,
            NULL

        UNION ALL SELECT
            'a7300000-0000-4000-8000-000000000010',
            'mba',
            'Master of Business Administration',
            'MBA',
            'Management',
            'Postgraduate',
            24,
            NULL

        UNION ALL SELECT
            'a7300000-0000-4000-8000-000000000011',
            'msc-data-science',
            'Master of Science in Data Science',
            'MSC-DS',
            'Data Science',
            'Postgraduate',
            24,
            NULL

        UNION ALL SELECT
            'a7300000-0000-4000-8000-000000000012',
            'bba',
            'Bachelor of Business Administration',
            'BBA',
            'Management',
            'Undergraduate',
            36,
            NULL
      ) AS expected
      LEFT JOIN courses AS c
        ON c.slug = expected.expected_slug
     WHERE c.id IS NULL
        OR NOT (c.public_id <=> expected.expected_public_id)
        OR NOT (c.name <=> expected.expected_name)
        OR NOT (c.code <=> expected.expected_code)
        OR NOT (c.category <=> expected.expected_category)
        OR NOT (c.qualification_level <=> expected.expected_level)
        OR NOT (c.duration_months <=> expected.expected_duration)
        OR NOT (c.entrance_exam <=> expected.expected_exam);

    IF v_conflict_count <> 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Course seed conflict: an existing course does not match the expected seed definition';
    END IF;

    -- -------------------------------------------------------------------------
    -- 5. Verify UUIDs are not attached to different course slugs.
    -- -------------------------------------------------------------------------

    SELECT COUNT(*)
      INTO v_conflict_count
      FROM courses AS c
     WHERE c.public_id IN (
        'a7300000-0000-4000-8000-000000000001',
        'a7300000-0000-4000-8000-000000000002',
        'a7300000-0000-4000-8000-000000000003',
        'a7300000-0000-4000-8000-000000000004',
        'a7300000-0000-4000-8000-000000000005',
        'a7300000-0000-4000-8000-000000000006',
        'a7300000-0000-4000-8000-000000000007',
        'a7300000-0000-4000-8000-000000000008',
        'a7300000-0000-4000-8000-000000000009',
        'a7300000-0000-4000-8000-000000000010',
        'a7300000-0000-4000-8000-000000000011',
        'a7300000-0000-4000-8000-000000000012'
     )
       AND c.slug NOT IN (
        'mbbs',
        'bds',
        'bams',
        'b-pharm',
        'bsc-nursing',
        'btech-computer-science',
        'bsc-medical-lab-technology',
        'bachelor-physiotherapy',
        'bsc-radiology-imaging',
        'mba',
        'msc-data-science',
        'bba'
     );

    IF v_conflict_count <> 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Course seed conflict: a seed public UUID is already attached to a different course slug';
    END IF;

    COMMIT;

    -- -------------------------------------------------------------------------
    -- 6. Display verified course catalogue.
    -- -------------------------------------------------------------------------

    SELECT
        id,
        public_id,
        name,
        slug,
        code,
        category,
        qualification_level,
        duration_months,
        entrance_exam,
        is_active,
        'ILLUSTRATIVE DEVELOPMENT DATA' AS record_classification
    FROM courses
    WHERE slug IN (
        'mbbs',
        'bds',
        'bams',
        'b-pharm',
        'bsc-nursing',
        'btech-computer-science',
        'bsc-medical-lab-technology',
        'bachelor-physiotherapy',
        'bsc-radiology-imaging',
        'mba',
        'msc-data-science',
        'bba'
    )
    ORDER BY FIELD(
        slug,
        'mbbs',
        'bds',
        'bams',
        'b-pharm',
        'bsc-nursing',
        'btech-computer-science',
        'bsc-medical-lab-technology',
        'bachelor-physiotherapy',
        'bsc-radiology-imaging',
        'mba',
        'msc-data-science',
        'bba'
    );
END$$

DELIMITER ;

CALL seed_medorbits_courses();

DROP PROCEDURE IF EXISTS seed_medorbits_courses;

-- =============================================================================
-- END OF SEED
-- =============================================================================
