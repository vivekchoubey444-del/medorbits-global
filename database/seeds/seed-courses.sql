-- =============================================================================
-- MedOrbits: Seed Illustrative Education Courses
-- File: /database/seeds/seed-courses.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
--
-- Requires:
--   003_create_courses.sql
--
-- SAFETY:
--   Fictional/illustrative catalogue records for development and testing.
--   Not official admission guidance or confirmation of regulatory approval.
--
-- IDEMPOTENCY:
--   Requires UNIQUE constraints on courses.slug.
--   Existing records are never overwritten by this seed.
-- =============================================================================
DROP PROCEDURE IF EXISTS seed_medorbits_courses;
DELIMITER $$
CREATE PROCEDURE seed_medorbits_courses()
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_conflicts INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    START TRANSACTION;
    -- -------------------------------------------------------------------------
    -- 1. Confirm the courses table exists and uses InnoDB
    -- -------------------------------------------------------------------------
    SELECT COUNT(*)
      INTO v_count
      FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = 'courses'
       AND engine = 'InnoDB'
       AND table_type = 'BASE TABLE';
    IF v_count <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Course seed failed: courses table must exist and use InnoDB';
    END IF;
    -- -------------------------------------------------------------------------
    -- 2. Insert illustrative courses without overwriting existing records
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
        'Illustrative medical course catalogue entry.',
        66,
        'Verify current eligibility and applicable regulations with official authorities.',
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
        'Illustrative dental course catalogue entry.',
        60,
        'Verify current eligibility and applicable regulations with official authorities.',
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
        'Illustrative Ayurveda course catalogue entry.',
        66,
        'Verify current eligibility and applicable regulations with official authorities.',
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
        'Illustrative pharmacy course catalogue entry.',
        48,
        'Verify eligibility with the relevant institution and regulator.',
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
        'Illustrative nursing course catalogue entry.',
        48,
        'Verify eligibility and admission requirements with the relevant institution.',
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
        'Illustrative engineering course catalogue entry.',
        48,
        'Verify eligibility and entrance requirements with the relevant institution.',
        NULL,
        TRUE
    )
    ON DUPLICATE KEY UPDATE
        id = id;
    -- -------------------------------------------------------------------------
    -- 3. Verify that each expected slug exists exactly once
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
        'btech-computer-science'
     );
    IF v_count <> 6 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Course seed failed: expected six distinct course slugs';
    END IF;
    -- -------------------------------------------------------------------------
    -- 4. Reject mismatched public IDs or course codes
    -- -------------------------------------------------------------------------
    SELECT COUNT(*)
      INTO v_conflicts
      FROM (
          SELECT
              'mbbs' AS expected_slug,
              'a7300000-0000-4000-8000-000000000001' AS expected_public_id,
              'MBBS' AS expected_code
          UNION ALL
          SELECT
              'bds',
              'a7300000-0000-4000-8000-000000000002',
              'BDS'
          UNION ALL
          SELECT
              'bams',
              'a7300000-0000-4000-8000-000000000003',
              'BAMS'
          UNION ALL
          SELECT
              'b-pharm',
              'a7300000-0000-4000-8000-000000000004',
              'BPHARM'
          UNION ALL
          SELECT
              'bsc-nursing',
              'a7300000-0000-4000-8000-000000000005',
              'BSCN'
          UNION ALL
          SELECT
              'btech-computer-science',
              'a7300000-0000-4000-8000-000000000006',
              'BTECH-CSE'
      ) AS expected
      LEFT JOIN courses AS actual
        ON actual.slug = expected.expected_slug
     WHERE actual.id IS NULL
        OR actual.public_id <> expected.expected_public_id
        OR actual.code <> expected.expected_code;
    IF v_conflicts <> 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Course seed failed: existing slug has a mismatched public ID or code';
    END IF;
    COMMIT;
    -- -------------------------------------------------------------------------
    -- 5. Display verification results
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
        is_active
    FROM courses
    WHERE slug IN (
        'mbbs',
        'bds',
        'bams',
        'b-pharm',
        'bsc-nursing',
        'btech-computer-science'
    )
    ORDER BY FIELD(
        slug,
        'mbbs',
        'bds',
        'bams',
        'b-pharm',
        'bsc-nursing',
        'btech-computer-science'
    );
END$$
DELIMITER ;
CALL seed_medorbits_courses();
DROP PROCEDURE IF EXISTS seed_medorbits_courses;
-- =============================================================================
-- END OF SEED
-- =============================================================================