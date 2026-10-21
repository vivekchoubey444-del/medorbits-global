
-- =============================================================================
-- Migration: 004_create_colleges_universities.sql
-- Project: MedOrbits
-- Purpose: Create university and college catalogue tables.
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
-- Character set: utf8mb4
-- Collation: utf8mb4_0900_ai_ci
--
-- DEPENDENCIES:
--   001_create_users.sql
--   003_create_courses.sql (execution order only)
--
-- IMPORTANT:
-- - Generate public_id in the application using crypto.randomUUID().
-- - Execute through the project's migration runner in numeric order.
-- - Intended for a fresh installation.
-- - CREATE TABLE IF NOT EXISTS does not modify existing table structures.
-- - Use a new migration for changes to an already-applied schema.
-- - Verify recognition, affiliation, and admission information before publication.
-- - MySQL DDL may implicitly commit.
-- =============================================================================

-- =============================================================================
-- 1. UNIVERSITIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS universities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,

    -- University identity.
    name VARCHAR(250) NOT NULL,
    slug VARCHAR(270) NOT NULL,
    university_type VARCHAR(100) NULL,

    -- Geographic information.
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    state VARCHAR(120) NULL,
    city VARCHAR(120) NULL,

    -- Institutional information.
    website VARCHAR(500) NULL,
    recognition_details TEXT NULL,
    description TEXT NULL,

    -- Catalogue visibility.
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_universities_public_id (public_id),
    UNIQUE KEY uq_universities_slug (slug),

    KEY idx_universities_location (country, state, city),
    KEY idx_universities_active (is_active),
    KEY idx_universities_type_active (university_type, is_active),

    CONSTRAINT chk_universities_name_not_blank
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_universities_slug_format
        CHECK (
            REGEXP_LIKE(slug, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')
        ),

    CONSTRAINT chk_universities_country_not_blank
        CHECK (CHAR_LENGTH(TRIM(country)) > 0),

    CONSTRAINT chk_universities_type_not_blank
        CHECK (
            university_type IS NULL
            OR CHAR_LENGTH(TRIM(university_type)) > 0
        ),

    CONSTRAINT chk_universities_website_not_blank
        CHECK (
            website IS NULL
            OR CHAR_LENGTH(TRIM(website)) > 0
        )

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 2. COLLEGES
-- =============================================================================

CREATE TABLE IF NOT EXISTS colleges (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,

    -- Optional parent university.
    university_id BIGINT UNSIGNED NULL,

    -- College identity.
    name VARCHAR(250) NOT NULL,
    slug VARCHAR(270) NOT NULL,
    college_type VARCHAR(100) NULL,

    -- Geographic information.
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    state VARCHAR(120) NULL,
    city VARCHAR(120) NULL,
    address TEXT NULL,
    pincode VARCHAR(12) NULL,

    -- Institutional information.
    website VARCHAR(500) NULL,
    affiliation_details TEXT NULL,
    description TEXT NULL,

    -- Catalogue visibility.
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_colleges_public_id (public_id),
    UNIQUE KEY uq_colleges_slug (slug),

    KEY idx_colleges_university_id (university_id),
    KEY idx_colleges_location (country, state, city),
    KEY idx_colleges_active (is_active),
    KEY idx_colleges_type_active (college_type, is_active),

    CONSTRAINT chk_colleges_name_not_blank
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_colleges_slug_format
        CHECK (
            REGEXP_LIKE(slug, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')
        ),

    CONSTRAINT chk_colleges_country_not_blank
        CHECK (CHAR_LENGTH(TRIM(country)) > 0),

    CONSTRAINT chk_colleges_type_not_blank
        CHECK (
            college_type IS NULL
            OR CHAR_LENGTH(TRIM(college_type)) > 0
        ),

    CONSTRAINT chk_colleges_website_not_blank
        CHECK (
            website IS NULL
            OR CHAR_LENGTH(TRIM(website)) > 0
        ),

    CONSTRAINT chk_colleges_pincode_not_blank
        CHECK (
            pincode IS NULL
            OR CHAR_LENGTH(TRIM(pincode)) > 0
        ),

    -- Preserve the college if its university is deleted.
    CONSTRAINT fk_colleges_university
        FOREIGN KEY (university_id)
        REFERENCES universities (id)
        ON DELETE SET NULL

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 3. VERIFICATION QUERIES
-- =============================================================================

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
ORDER BY name;

SELECT
    c.id,
    c.public_id,
    c.name AS college_name,
    c.slug AS college_slug,
    c.college_type,
    u.name AS university_name,
    c.country,
    c.state,
    c.city,
    c.is_active
FROM colleges AS c
LEFT JOIN universities AS u
    ON u.id = c.university_id
ORDER BY c.name;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
