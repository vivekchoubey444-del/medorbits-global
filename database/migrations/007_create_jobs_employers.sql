
-- =============================================================================
-- MedOrbits Migration 007: Employers and Jobs
-- File: /database/migrations/007_create_employers_jobs.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
-- Character set: utf8mb4
-- Collation: utf8mb4_0900_ai_ci
--
-- Dependencies:
--   001_create_users.sql
--
-- Tables:
--   employers
--   jobs
--
-- Security:
--   Only verified, active, non-deleted employers may publish jobs.
--   Enforce authorization and publication rules in trusted backend services.
-- =============================================================================

-- =============================================================================
-- TABLE: employers
-- =============================================================================

CREATE TABLE IF NOT EXISTS employers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    company_name VARCHAR(250) NOT NULL,
    slug VARCHAR(270) NOT NULL,
    company_description TEXT NULL,
    industry VARCHAR(150) NULL,
    website VARCHAR(500) NULL,
    contact_email VARCHAR(254) NULL,
    contact_phone VARCHAR(30) NULL,
    verification_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    verification_notes TEXT NULL,
    verified_at DATETIME(3) NULL,
    verified_by BIGINT UNSIGNED NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_employers_public_id (public_id),
    UNIQUE KEY uq_employers_user_id (user_id),
    UNIQUE KEY uq_employers_slug (slug),

    KEY idx_employers_verification (verification_status),
    KEY idx_employers_active_verification (
        is_active, verification_status
    ),
    KEY idx_employers_verified_by (verified_by),
    KEY idx_employers_deleted_at (deleted_at),
    KEY idx_employers_directory (
        is_active, verification_status, company_name
    ),

    CONSTRAINT chk_employers_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_employers_company_name
        CHECK (CHAR_LENGTH(TRIM(company_name)) > 0),

    CONSTRAINT chk_employers_slug
        CHECK (
            slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
        ),

    CONSTRAINT chk_employers_verification
        CHECK (
            verification_status IN (
                'pending', 'verified', 'rejected', 'suspended'
            )
        ),

    CONSTRAINT chk_employers_verified_fields
        CHECK (
            (
                verified_at IS NULL
                AND verified_by IS NULL
            )
            OR
            (
                verified_at IS NOT NULL
                AND verified_by IS NOT NULL
            )
        ),

    CONSTRAINT chk_employers_verified_status
        CHECK (
            verification_status <> 'verified'
            OR verified_at IS NOT NULL
        ),

    CONSTRAINT chk_employers_deleted_inactive
        CHECK (
            deleted_at IS NULL OR is_active = FALSE
        ),

    CONSTRAINT chk_employers_website
        CHECK (
            website IS NULL
            OR CHAR_LENGTH(TRIM(website)) > 0
        ),

    CONSTRAINT chk_employers_contact_email
        CHECK (
            contact_email IS NULL
            OR CHAR_LENGTH(TRIM(contact_email)) > 0
        ),

    CONSTRAINT chk_employers_contact_phone
        CHECK (
            contact_phone IS NULL
            OR CHAR_LENGTH(TRIM(contact_phone)) > 0
        ),

    CONSTRAINT fk_employers_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_employers_verified_by
        FOREIGN KEY (verified_by)
        REFERENCES users (id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- =============================================================================
-- TABLE: jobs
-- =============================================================================

CREATE TABLE IF NOT EXISTS jobs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    employer_id BIGINT UNSIGNED NOT NULL,

    title VARCHAR(250) NOT NULL,
    slug VARCHAR(280) NOT NULL,
    description TEXT NOT NULL,
    summary VARCHAR(500) NULL,

    employment_type VARCHAR(40) NOT NULL,
    workplace_type VARCHAR(30) NOT NULL DEFAULT 'onsite',

    location_city VARCHAR(120) NULL,
    location_state VARCHAR(120) NULL,
    location_country VARCHAR(100) NOT NULL DEFAULT 'India',

    salary_min DECIMAL(12,2) NULL,
    salary_max DECIMAL(12,2) NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    salary_period VARCHAR(20) NOT NULL DEFAULT 'yearly',
    salary_is_disclosed BOOLEAN NOT NULL DEFAULT FALSE,

    experience_min_years DECIMAL(4,1) NULL,
    experience_max_years DECIMAL(4,1) NULL,

    vacancies INT UNSIGNED NOT NULL DEFAULT 1,

    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    application_deadline DATE NULL,
    published_at DATETIME(3) NULL,
    closed_at DATETIME(3) NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_jobs_public_id (public_id),
    UNIQUE KEY uq_jobs_slug (slug),

    KEY idx_jobs_employer_id (employer_id),
    KEY idx_jobs_status (status),
    KEY idx_jobs_public_listing (
        status, published_at, application_deadline
    ),
    KEY idx_jobs_location (
        location_country, location_state, location_city
    ),
    KEY idx_jobs_employment_workplace (
        employment_type, workplace_type, status
    ),
    KEY idx_jobs_deadline_status (
        application_deadline, status
    ),
    KEY idx_jobs_employer_status_created (
        employer_id, status, created_at
    ),
    KEY idx_jobs_deleted_at (deleted_at),

    CONSTRAINT chk_jobs_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_jobs_employment_type
        CHECK (
            employment_type IN (
                'full_time', 'part_time', 'contract',
                'internship', 'temporary'
            )
        ),

    CONSTRAINT chk_jobs_workplace_type
        CHECK (workplace_type IN ('onsite', 'remote', 'hybrid')),

    CONSTRAINT chk_jobs_status
        CHECK (
            status IN ('draft', 'published', 'closed', 'archived')
        ),

    CONSTRAINT chk_jobs_salary_min
        CHECK (salary_min IS NULL OR salary_min >= 0),

    CONSTRAINT chk_jobs_salary_max
        CHECK (salary_max IS NULL OR salary_max >= 0),

    CONSTRAINT chk_jobs_salary_range
        CHECK (
            salary_min IS NULL
            OR salary_max IS NULL
            OR salary_max >= salary_min
        ),

    CONSTRAINT chk_jobs_experience_min
        CHECK (
            experience_min_years IS NULL
            OR experience_min_years >= 0
        ),

    CONSTRAINT chk_jobs_experience_max
        CHECK (
            experience_max_years IS NULL
            OR experience_max_years >= 0
        ),

    CONSTRAINT chk_jobs_experience_range
        CHECK (
            experience_min_years IS NULL
            OR experience_max_years IS NULL
            OR experience_max_years >= experience_min_years
        ),

    CONSTRAINT chk_jobs_vacancies
        CHECK (vacancies > 0),

    CONSTRAINT chk_jobs_title
        CHECK (CHAR_LENGTH(TRIM(title)) > 0),

    CONSTRAINT chk_jobs_slug
        CHECK (
            slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
        ),

    CONSTRAINT chk_jobs_description
        CHECK (CHAR_LENGTH(TRIM(description)) > 0),

    CONSTRAINT chk_jobs_summary
        CHECK (
            summary IS NULL
            OR CHAR_LENGTH(TRIM(summary)) > 0
        ),

    CONSTRAINT chk_jobs_location_country
        CHECK (CHAR_LENGTH(TRIM(location_country)) > 0),

    CONSTRAINT chk_jobs_currency
        CHECK (currency REGEXP '^[A-Z]{3}$'),

    CONSTRAINT chk_jobs_salary_period
        CHECK (
            salary_period IN ('hourly', 'daily', 'monthly', 'yearly')
        ),

    CONSTRAINT chk_jobs_published_timestamp
        CHECK (
            status <> 'published' OR published_at IS NOT NULL
        ),

    CONSTRAINT chk_jobs_closed_timestamp
        CHECK (
            status <> 'closed' OR closed_at IS NOT NULL
        ),

    CONSTRAINT chk_jobs_deleted_status
        CHECK (
            deleted_at IS NULL OR status = 'archived'
        ),

    CONSTRAINT fk_jobs_employer
        FOREIGN KEY (employer_id)
        REFERENCES employers (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT
    'employers' AS table_name,
    COUNT(*) AS row_count
FROM employers

UNION ALL

SELECT
    'jobs',
    COUNT(*)
FROM jobs;

-- =============================================================================
-- END OF MIGRATION 007
-- =============================================================================
