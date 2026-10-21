
-- =============================================================================
-- MEDORBITS CONSOLIDATED DATABASE SCHEMA
-- File: /database/schema.sql
-- Database: MySQL 8.0.16+
-- Engine: InnoDB
-- Character set: utf8mb4
-- Collation: utf8mb4_0900_ai_ci
--
-- PURPOSE
--   Fresh-install schema for MedOrbits education, admissions, careers,
--   recruitment, subscriptions, payments, notifications, and administration.
--
-- IMPORTANT
--   1. Fresh development/test database only.
--   2. Do not run alongside migrations 001-010 on the same database.
--   3. CREATE TABLE IF NOT EXISTS does not update existing table structures.
--   4. Use versioned migrations for deployed databases.
--   5. Store password hashes only; never store plaintext passwords.
--   6. Never store raw card numbers or CVVs.
--   7. Never assign admin privileges without authorization.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS medorbits
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE medorbits;

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- =============================================================================
-- 1. MIGRATION HISTORY
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    migration_name VARCHAR(255) NOT NULL,
    checksum CHAR(64) NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_schema_migrations_name (migration_name)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 2. USERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    phone VARCHAR(30) NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified_at DATETIME(3) NULL,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified_at DATETIME(3) NULL,

    last_login_at DATETIME(3) NULL,
    password_changed_at DATETIME(3) NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_users_public_id (public_id),
    UNIQUE KEY uq_users_email (email),

    KEY idx_users_status_created (status, created_at),
    KEY idx_users_phone (phone),
    KEY idx_users_last_login (last_login_at),
    KEY idx_users_deleted_at (deleted_at),

    CONSTRAINT chk_users_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_users_name
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_users_email
        CHECK (
            CHAR_LENGTH(TRIM(email)) > 3
            AND email REGEXP '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
        ),

    CONSTRAINT chk_users_password_hash
        CHECK (CHAR_LENGTH(TRIM(password_hash)) > 0),

    CONSTRAINT chk_users_status
        CHECK (
            status IN ('pending', 'active', 'suspended', 'disabled', 'deleted')
        ),

    CONSTRAINT chk_users_email_verification
        CHECK (
            (email_verified = FALSE AND email_verified_at IS NULL)
            OR
            (email_verified = TRUE AND email_verified_at IS NOT NULL)
        ),

    CONSTRAINT chk_users_phone_verification
        CHECK (
            (phone_verified = FALSE AND phone_verified_at IS NULL)
            OR
            (phone_verified = TRUE AND phone_verified_at IS NOT NULL)
        ),

    CONSTRAINT chk_users_deleted_status
        CHECK (
            deleted_at IS NULL OR status = 'deleted'
        )

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 3. ROLES AND PERMISSIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(80) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    description VARCHAR(500) NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_name (name),
    KEY idx_roles_active (is_active),

    CONSTRAINT chk_roles_name
        CHECK (name REGEXP '^[a-z][a-z0-9_]*$'),

    CONSTRAINT chk_roles_display_name
        CHECK (CHAR_LENGTH(TRIM(display_name)) > 0)

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS permissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),
    UNIQUE KEY uq_permissions_name (name),
    KEY idx_permissions_resource_action (resource, action),

    CONSTRAINT chk_permissions_name
        CHECK (name REGEXP '^[a-z][a-z0-9_.:-]*$'),

    CONSTRAINT chk_permissions_resource
        CHECK (CHAR_LENGTH(TRIM(resource)) > 0),

    CONSTRAINT chk_permissions_action
        CHECK (CHAR_LENGTH(TRIM(action)) > 0)

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    assigned_by BIGINT UNSIGNED NULL,
    assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (user_id, role_id),

    KEY idx_user_roles_role (role_id),
    KEY idx_user_roles_assigned_by (assigned_by),

    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE RESTRICT,

    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (role_id) REFERENCES roles(id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,

    CONSTRAINT fk_user_roles_assigned_by
        FOREIGN KEY (assigned_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id BIGINT UNSIGNED NOT NULL,
    permission_id BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (role_id, permission_id),
    KEY idx_role_permissions_permission (permission_id),

    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id) REFERENCES roles(id)
        ON DELETE CASCADE ON UPDATE RESTRICT,

    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id) REFERENCES permissions(id)
        ON DELETE CASCADE ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 4. COURSES
-- =============================================================================

CREATE TABLE IF NOT EXISTS courses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(180) NOT NULL,
    code VARCHAR(60) NULL,
    category VARCHAR(100) NOT NULL,
    qualification_level VARCHAR(80) NULL,
    description TEXT NULL,
    duration_months SMALLINT UNSIGNED NULL,
    eligibility TEXT NULL,
    entrance_exam VARCHAR(120) NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,

    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_courses_public_id (public_id),
    UNIQUE KEY uq_courses_slug (slug),
    UNIQUE KEY uq_courses_code (code),

    KEY idx_courses_category_active (category, is_active),
    KEY idx_courses_name (name),
    KEY idx_courses_created_by (created_by),

    CONSTRAINT chk_courses_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_courses_name
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_courses_slug
        CHECK (slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'),

    CONSTRAINT chk_courses_category
        CHECK (CHAR_LENGTH(TRIM(category)) > 0),

    CONSTRAINT chk_courses_duration
        CHECK (duration_months IS NULL OR duration_months > 0),

    CONSTRAINT fk_courses_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 5. UNIVERSITIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS universities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    university_type VARCHAR(100) NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    state VARCHAR(100) NULL,
    city VARCHAR(120) NULL,
    website VARCHAR(500) NULL,
    recognition_details TEXT NULL,
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_universities_public_id (public_id),
    UNIQUE KEY uq_universities_slug (slug),

    KEY idx_universities_location (country, state, city),
    KEY idx_universities_active (is_active),

    CONSTRAINT chk_universities_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_universities_name
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_universities_slug
        CHECK (slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'),

    CONSTRAINT chk_universities_country
        CHECK (CHAR_LENGTH(TRIM(country)) > 0)

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 6. COLLEGES AND COURSE RELATIONSHIPS
-- =============================================================================

CREATE TABLE IF NOT EXISTS colleges (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    university_id BIGINT UNSIGNED NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    college_type VARCHAR(100) NULL,
    institution_type VARCHAR(80) NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    state VARCHAR(100) NULL,
    city VARCHAR(120) NULL,
    address VARCHAR(500) NULL,
    pincode VARCHAR(20) NULL,
    website VARCHAR(500) NULL,
    affiliation_details TEXT NULL,
    description TEXT NULL,
    ownership VARCHAR(40) NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_colleges_public_id (public_id),
    UNIQUE KEY uq_colleges_slug (slug),

    KEY idx_colleges_university (university_id),
    KEY idx_colleges_location (country, state, city),
    KEY idx_colleges_active_type (is_active, college_type),

    CONSTRAINT chk_colleges_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_colleges_name
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_colleges_slug
        CHECK (slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'),

    CONSTRAINT chk_colleges_country
        CHECK (CHAR_LENGTH(TRIM(country)) > 0),

    CONSTRAINT fk_colleges_university
        FOREIGN KEY (university_id) REFERENCES universities(id)
        ON DELETE SET NULL ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS course_colleges (
    course_id BIGINT UNSIGNED NOT NULL,
    college_id BIGINT UNSIGNED NOT NULL,
    duration_months SMALLINT UNSIGNED NULL,
    tuition_fee DECIMAL(12,2) NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    admission_notes TEXT NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (course_id, college_id),
    KEY idx_course_colleges_college (college_id),

    CONSTRAINT chk_course_colleges_duration
        CHECK (duration_months IS NULL OR duration_months > 0),

    CONSTRAINT chk_course_colleges_fee
        CHECK (tuition_fee IS NULL OR tuition_fee >= 0),

    CONSTRAINT chk_course_colleges_currency
        CHECK (currency REGEXP '^[A-Z]{3}$'),

    CONSTRAINT fk_course_colleges_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE ON UPDATE RESTRICT,

    CONSTRAINT fk_course_colleges_college
        FOREIGN KEY (college_id) REFERENCES colleges(id)
        ON DELETE CASCADE ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 7. ADMISSION APPLICATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS applications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    application_number VARCHAR(60) NOT NULL,

    user_id BIGINT UNSIGNED NOT NULL,
    course_id BIGINT UNSIGNED NULL,
    college_id BIGINT UNSIGNED NULL,

    applicant_name VARCHAR(160) NOT NULL,
    applicant_email VARCHAR(254) NOT NULL,
    applicant_phone VARCHAR(30) NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    applicant_data JSON NULL,
    notes TEXT NULL,

    submitted_at DATETIME(3) NULL,
    reviewed_at DATETIME(3) NULL,
    reviewed_by BIGINT UNSIGNED NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_applications_public_id (public_id),
    UNIQUE KEY uq_applications_number (application_number),

    KEY idx_applications_user_status (user_id, status, created_at),
    KEY idx_applications_course_college (course_id, college_id),
    KEY idx_applications_reviewer (reviewed_by, reviewed_at),

    CONSTRAINT chk_applications_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_applications_status
        CHECK (
            status IN (
                'draft', 'submitted', 'under_review',
                'documents_required', 'approved', 'rejected',
                'withdrawn', 'closed'
            )
        ),

    CONSTRAINT chk_applications_name
        CHECK (CHAR_LENGTH(TRIM(applicant_name)) > 0),

    CONSTRAINT chk_applications_email
        CHECK (CHAR_LENGTH(TRIM(applicant_email)) > 3),

    CONSTRAINT fk_applications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,

    CONSTRAINT fk_applications_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE SET NULL ON UPDATE RESTRICT,

    CONSTRAINT fk_applications_college
        FOREIGN KEY (college_id) REFERENCES colleges(id)
        ON DELETE SET NULL ON UPDATE RESTRICT,

    CONSTRAINT fk_applications_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 8. DOCUMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS documents (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,

    user_id BIGINT UNSIGNED NOT NULL,
    application_id BIGINT UNSIGNED NULL,

    document_type VARCHAR(100) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    file_size_bytes BIGINT UNSIGNED NOT NULL,
    checksum_sha256 CHAR(64) NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'uploaded',
    uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    reviewed_at DATETIME(3) NULL,
    reviewed_by BIGINT UNSIGNED NULL,
    rejection_reason TEXT NULL,

    deleted_at DATETIME(3) NULL,
    updated_by BIGINT UNSIGNED NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_documents_public_id (public_id),

    KEY idx_documents_user_type (user_id, document_type, status),
    KEY idx_documents_application (application_id),
    KEY idx_documents_reviewer (reviewed_by),

    CONSTRAINT chk_documents_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_documents_status
        CHECK (
            status IN (
                'uploaded', 'pending_review', 'under_review',
                'verified', 'approved', 'rejected', 'expired', 'deleted'
            )
        ),

    CONSTRAINT chk_documents_size
        CHECK (file_size_bytes > 0),

    CONSTRAINT chk_documents_checksum
        CHECK (
            checksum_sha256 IS NULL
            OR checksum_sha256 REGEXP '^[0-9a-fA-F]{64}$'
        ),

    CONSTRAINT chk_documents_deleted
        CHECK (
            status <> 'deleted' OR deleted_at IS NOT NULL
        ),

    CONSTRAINT fk_documents_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,

    CONSTRAINT fk_documents_application
        FOREIGN KEY (application_id) REFERENCES applications(id)
        ON DELETE SET NULL ON UPDATE RESTRICT,

    CONSTRAINT fk_documents_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE RESTRICT,

    CONSTRAINT fk_documents_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 9. EMPLOYERS AND JOBS
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
    KEY idx_employers_active_verification (is_active, verification_status),
    KEY idx_employers_verified_by (verified_by),

    CONSTRAINT chk_employers_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_employers_name
        CHECK (CHAR_LENGTH(TRIM(company_name)) > 0),

    CONSTRAINT chk_employers_slug
        CHECK (slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'),

    CONSTRAINT chk_employers_verification
        CHECK (
            verification_status IN ('pending', 'verified', 'rejected', 'suspended')
        ),

    CONSTRAINT chk_employers_verified_fields
        CHECK (
            (verified_at IS NULL AND verified_by IS NULL)
            OR
            (verified_at IS NOT NULL AND verified_by IS NOT NULL)
        ),

    CONSTRAINT chk_employers_verified_status
        CHECK (
            verification_status <> 'verified' OR verified_at IS NOT NULL
        ),

    CONSTRAINT chk_employers_deleted
        CHECK (deleted_at IS NULL OR is_active = FALSE),

    CONSTRAINT fk_employers_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,

    CONSTRAINT fk_employers_verified_by
        FOREIGN KEY (verified_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

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
    KEY idx_jobs_public_listing (status, published_at, application_deadline),
    KEY idx_jobs_location (location_country, location_state, location_city),
    KEY idx_jobs_deadline_status (application_deadline, status),

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
        CHECK (status IN ('draft', 'published', 'closed', 'archived')),

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

    CONSTRAINT chk_jobs_experience_range
        CHECK (
            (experience_min_years IS NULL OR experience_min_years >= 0)
            AND
            (experience_max_years IS NULL OR experience_max_years >= 0)
            AND
            (
                experience_min_years IS NULL
                OR experience_max_years IS NULL
                OR experience_max_years >= experience_min_years
            )
        ),

    CONSTRAINT chk_jobs_vacancies
        CHECK (vacancies > 0),

    CONSTRAINT chk_jobs_published
        CHECK (status <> 'published' OR published_at IS NOT NULL),

    CONSTRAINT chk_jobs_closed
        CHECK (status <> 'closed' OR closed_at IS NOT NULL),

    CONSTRAINT chk_jobs_deleted
        CHECK (deleted_at IS NULL OR status = 'archived'),

    CONSTRAINT chk_jobs_currency
        CHECK (currency REGEXP '^[A-Z]{3}$'),

    CONSTRAINT chk_jobs_salary_period
        CHECK (salary_period IN ('hourly', 'daily', 'monthly', 'yearly')),

    CONSTRAINT fk_jobs_employer
        FOREIGN KEY (employer_id) REFERENCES employers(id)
        ON DELETE RESTRICT ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS job_applications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    job_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    resume_document_id BIGINT UNSIGNED NULL,
    cover_letter TEXT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'submitted',
    applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_job_applications_public_id (public_id),
    UNIQUE KEY uq_job_application_user (job_id, user_id),

    KEY idx_job_applications_user (user_id, applied_at),
    KEY idx_job_applications_resume (resume_document_id),

    CONSTRAINT chk_job_applications_status
        CHECK (
            status IN (
                'submitted', 'viewed', 'shortlisted',
                'rejected', 'withdrawn', 'hired'
            )
        ),

    CONSTRAINT fk_job_applications_job
        FOREIGN KEY (job_id) REFERENCES jobs(id)
        ON DELETE CASCADE ON UPDATE RESTRICT,

    CONSTRAINT fk_job_applications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,

    CONSTRAINT fk_job_applications_resume
        FOREIGN KEY (resume_document_id) REFERENCES documents(id)
        ON DELETE SET NULL ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 10. SUBSCRIPTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,

    plan_key VARCHAR(100) NOT NULL,
    provider VARCHAR(80) NULL,
    provider_customer_ref VARCHAR(255) NULL,
    provider_subscription_ref VARCHAR(255) NULL,

    amount_minor BIGINT UNSIGNED NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',

    status VARCHAR(30) NOT NULL DEFAULT 'active',
    starts_at DATETIME(3) NOT NULL,
    ends_at DATETIME(3) NULL,
    trial_ends_at DATETIME(3) NULL,
    next_billing_at DATETIME(3) NULL,
    cancelled_at DATETIME(3) NULL,
    ended_at DATETIME(3) NULL,

    provider_metadata JSON NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_subscriptions_public_id (public_id),
    UNIQUE KEY uq_subscriptions_provider_ref
        (provider, provider_subscription_ref),

    KEY idx_subscriptions_user_status (user_id, status),
    KEY idx_subscriptions_next_billing (status, next_billing_at),

    CONSTRAINT chk_subscriptions_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_subscriptions_status
        CHECK (
            status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')
        ),

    CONSTRAINT chk_subscriptions_interval
        CHECK (
            billing_interval IN ('monthly', 'quarterly', 'yearly', 'one_time')
        ),

    CONSTRAINT chk_subscriptions_currency
        CHECK (currency REGEXP '^[A-Z]{3}$'),

    CONSTRAINT chk_subscriptions_dates
        CHECK (ends_at IS NULL OR ends_at >= starts_at),

    CONSTRAINT fk_subscriptions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 11. PAYMENTS, REFUNDS AND PROVIDER EVENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    subscription_id BIGINT UNSIGNED NULL,
    application_id BIGINT UNSIGNED NULL,

    payment_reference VARCHAR(100) NOT NULL,
    provider VARCHAR(80) NOT NULL,
    provider_order_ref VARCHAR(255) NULL,
    provider_payment_ref VARCHAR(255) NULL,

    amount_minor BIGINT UNSIGNED NOT NULL,
    refunded_amount_minor BIGINT UNSIGNED NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'INR',

    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    idempotency_key VARCHAR(150) NULL,
    payment_method VARCHAR(80) NULL,

    paid_at DATETIME(3) NULL,
    failed_at DATETIME(3) NULL,
    failure_code VARCHAR(120) NULL,
    failure_message TEXT NULL,

    provider_metadata JSON NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_payments_public_id (public_id),
    UNIQUE KEY uq_payments_reference (payment_reference),
    UNIQUE KEY uq_payments_idempotency (idempotency_key),
    UNIQUE KEY uq_payments_provider_ref (provider, provider_payment_ref),

    KEY idx_payments_user_status (user_id, status, created_at),
    KEY idx_payments_subscription (subscription_id),
    KEY idx_payments_application (application_id),

    CONSTRAINT chk_payments_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_payments_status
        CHECK (
            status IN (
                'created', 'pending', 'processing', 'successful',
                'failed', 'cancelled', 'partially_refunded', 'refunded'
            )
        ),

    CONSTRAINT chk_payments_currency
        CHECK (currency REGEXP '^[A-Z]{3}$'),

    CONSTRAINT chk_payments_refund_amount
        CHECK (refunded_amount_minor <= amount_minor),

    CONSTRAINT fk_payments_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,

    CONSTRAINT fk_payments_subscription
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
        ON DELETE SET NULL ON UPDATE RESTRICT,

    CONSTRAINT fk_payments_application
        FOREIGN KEY (application_id) REFERENCES applications(id)
        ON DELETE SET NULL ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS payment_refunds (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    payment_id BIGINT UNSIGNED NOT NULL,
    refund_reference VARCHAR(100) NOT NULL,
    provider_refund_ref VARCHAR(255) NULL,

    amount_minor BIGINT UNSIGNED NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'pending',

    reason VARCHAR(500) NULL,
    requested_by BIGINT UNSIGNED NULL,

    requested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    processed_at DATETIME(3) NULL,
    provider_metadata JSON NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_refunds_public_id (public_id),
    UNIQUE KEY uq_refunds_reference (refund_reference),
    UNIQUE KEY uq_refunds_provider_ref (provider_refund_ref),

    KEY idx_refunds_payment_status (payment_id, status),

    CONSTRAINT chk_refunds_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_refunds_amount
        CHECK (amount_minor > 0),

    CONSTRAINT chk_refunds_status
        CHECK (
            status IN ('pending', 'processing', 'successful', 'failed', 'cancelled')
        ),

    CONSTRAINT chk_refunds_currency
        CHECK (currency REGEXP '^[A-Z]{3}$'),

    CONSTRAINT fk_refunds_payment
        FOREIGN KEY (payment_id) REFERENCES payments(id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,

    CONSTRAINT fk_refunds_requester
        FOREIGN KEY (requested_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS payment_provider_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    provider VARCHAR(80) NOT NULL,
    provider_event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(160) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'received',
    payment_id BIGINT UNSIGNED NULL,

    received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    processed_at DATETIME(3) NULL,
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    payload JSON NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_payment_provider_event (provider, provider_event_id),
    KEY idx_payment_events_status_received (status, received_at),

    CONSTRAINT chk_payment_events_status
        CHECK (
            status IN ('received', 'processing', 'processed', 'failed', 'ignored')
        ),

    CONSTRAINT fk_payment_events_payment
        FOREIGN KEY (payment_id) REFERENCES payments(id)
        ON DELETE SET NULL ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 12. NOTIFICATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_templates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    template_key VARCHAR(120) NOT NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    channel VARCHAR(20) NOT NULL,
    locale VARCHAR(20) NOT NULL DEFAULT 'en',
    subject VARCHAR(255) NULL,
    title VARCHAR(200) NULL,
    body TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_notification_templates_public_id (public_id),
    UNIQUE KEY uq_notification_template_version
        (template_key, version, channel, locale),

    CONSTRAINT chk_notification_template_channel
        CHECK (channel IN ('in_app', 'email', 'sms')),

    CONSTRAINT chk_notification_template_version
        CHECK (version > 0),

    CONSTRAINT fk_notification_templates_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        )

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id BIGINT UNSIGNED NOT NULL,
    category VARCHAR(100) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (user_id, category, channel),

    CONSTRAINT chk_notification_preferences_channel
        CHECK (channel IN ('in_app', 'email', 'sms')),

    CONSTRAINT fk_notification_preferences_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,

    notification_type VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    action_url VARCHAR(1000) NULL,

    entity_type VARCHAR(100) NULL,
    entity_id VARCHAR(100) NULL,

    template_id BIGINT UNSIGNED NULL,
    payload JSON NULL,

    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    status VARCHAR(30) NOT NULL DEFAULT 'queued',

    read_at DATETIME(3) NULL,
    scheduled_at DATETIME(3) NULL,
    sent_at DATETIME(3) NULL,
    expires_at DATETIME(3) NULL,
    deleted_at DATETIME(3) NULL,
    deduplication_key VARCHAR(190) NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_notifications_public_id (public_id),
    UNIQUE KEY uq_notifications_deduplication (deduplication_key),

    KEY idx_notifications_user_status (user_id, status, created_at),
    KEY idx_notifications_schedule (status, scheduled_at),

    CONSTRAINT chk_notifications_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_notifications_priority
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

    CONSTRAINT chk_notifications_status
        CHECK (
            status IN (
                'queued', 'processing', 'sent', 'delivered',
                'failed', 'read', 'cancelled'
            )
        ),

    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,

    CONSTRAINT fk_notifications_template
        FOREIGN KEY (template_id) REFERENCES notification_templates(id)
        ON DELETE SET NULL ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS notification_deliveries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    notification_id BIGINT UNSIGNED NOT NULL,

    channel VARCHAR(20) NOT NULL,
    provider VARCHAR(80) NULL,
    provider_message_id VARCHAR(255) NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'queued',
    scheduled_at DATETIME(3) NULL,
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts INT UNSIGNED NOT NULL DEFAULT 5,

    lease_token CHAR(36) NULL,
    lease_expires_at DATETIME(3) NULL,

    sent_at DATETIME(3) NULL,
    delivered_at DATETIME(3) NULL,
    failed_at DATETIME(3) NULL,
    last_error TEXT NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_notification_deliveries_public_id (public_id),
    KEY idx_notification_deliveries_queue (status, scheduled_at),

    CONSTRAINT chk_notification_deliveries_channel
        CHECK (channel IN ('in_app', 'email', 'sms')),

    CONSTRAINT chk_notification_deliveries_status
        CHECK (
            status IN (
                'queued', 'processing', 'sent',
                'delivered', 'failed', 'cancelled'
            )
        ),

    CONSTRAINT chk_notification_deliveries_attempts
        CHECK (max_attempts > 0 AND attempt_count <= max_attempts),

    CONSTRAINT chk_notification_deliveries_lease
        CHECK (
            (lease_token IS NULL AND lease_expires_at IS NULL)
            OR
            (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
        ),

    CONSTRAINT fk_notification_deliveries_notification
        FOREIGN KEY (notification_id) REFERENCES notifications(id)
        ON DELETE RESTRICT ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS notification_delivery_attempts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    delivery_id BIGINT UNSIGNED NOT NULL,
    attempt_number INT UNSIGNED NOT NULL,

    provider VARCHAR(80) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'processing',
    started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    completed_at DATETIME(3) NULL,

    provider_response_code VARCHAR(100) NULL,
    error_code VARCHAR(120) NULL,
    error_message TEXT NULL,
    provider_response JSON NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_notification_delivery_attempt
        (delivery_id, attempt_number),

    CONSTRAINT chk_notification_attempt_number
        CHECK (attempt_number > 0),

    CONSTRAINT chk_notification_attempt_status
        CHECK (
            status IN ('processing', 'succeeded', 'failed', 'retryable')
        ),

    CONSTRAINT fk_notification_attempts_delivery
        FOREIGN KEY (delivery_id) REFERENCES notification_deliveries(id)
        ON DELETE RESTRICT ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS notification_provider_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    provider VARCHAR(80) NOT NULL,
    provider_event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(160) NOT NULL,

    delivery_id BIGINT UNSIGNED NULL,
    attempt_id BIGINT UNSIGNED NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'received',
    received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    processed_at DATETIME(3) NULL,
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    payload JSON NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_notification_provider_event
        (provider, provider_event_id),

    KEY idx_notification_provider_events_status (status, received_at),

    CONSTRAINT chk_notification_provider_event_status
        CHECK (
            status IN ('received', 'processing', 'processed', 'failed', 'ignored')
        ),

    CONSTRAINT fk_notification_provider_event_delivery
        FOREIGN KEY (delivery_id) REFERENCES notification_deliveries(id)
        ON DELETE SET NULL ON UPDATE RESTRICT,

    CONSTRAINT fk_notification_provider_event_attempt
        FOREIGN KEY (attempt_id) REFERENCES notification_delivery_attempts(id)
        ON DELETE SET NULL ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 13. AUDIT LOGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,

    actor_user_id BIGINT UNSIGNED NULL,
    actor_type VARCHAR(30) NOT NULL DEFAULT 'user',
    actor_identifier VARCHAR(255) NULL,

    action VARCHAR(150) NOT NULL,
    resource_type VARCHAR(120) NOT NULL,
    resource_id VARCHAR(120) NULL,
    resource_public_id VARCHAR(120) NULL,

    outcome VARCHAR(30) NOT NULL DEFAULT 'success',
    request_id VARCHAR(120) NULL,
    correlation_id VARCHAR(120) NULL,

    http_method VARCHAR(12) NULL,
    route_template VARCHAR(500) NULL,
    http_status SMALLINT UNSIGNED NULL,

    ip_address VARBINARY(16) NULL,
    user_agent VARCHAR(500) NULL,

    metadata JSON NULL,
    before_data JSON NULL,
    after_data JSON NULL,
    error_code VARCHAR(120) NULL,

    occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_audit_logs_public_id (public_id),

    KEY idx_audit_actor_created (actor_user_id, created_at),
    KEY idx_audit_resource (resource_type, resource_id, created_at),
    KEY idx_audit_action_created (action, created_at),
    KEY idx_audit_request (request_id),

    CONSTRAINT chk_audit_logs_public_id
        CHECK (
            public_id REGEXP
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
        ),

    CONSTRAINT chk_audit_logs_actor_type
        CHECK (
            actor_type IN ('user', 'admin', 'system', 'service', 'anonymous')
        ),

    CONSTRAINT chk_audit_logs_outcome
        CHECK (outcome IN ('success', 'failure', 'denied', 'error')),

    CONSTRAINT fk_audit_logs_actor
        FOREIGN KEY (actor_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE RESTRICT

) ENGINE=InnoDB
  DEFAULT CHARACTER SET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- 14. BASELINE ROLES
-- =============================================================================
-- Idempotent inserts. This section does not assign roles to users.
-- Use seed-roles.sql to create the intended permission mappings.

INSERT INTO roles (
    name,
    display_name,
    description,
    is_system,
    is_active
)
VALUES
    ('user', 'User', 'Standard registered account.', TRUE, TRUE),
    ('admin', 'Administrator', 'Privileged platform administrator.', TRUE, TRUE),
    ('counsellor', 'Counsellor', 'Education guidance and application support.', TRUE, TRUE),
    ('employer', 'Employer', 'Recruitment and employer account.', TRUE, TRUE)
ON DUPLICATE KEY UPDATE
    id = id;

-- =============================================================================
-- 15. BASELINE PERMISSIONS
-- =============================================================================
-- These records do not grant permissions to any role by themselves.
-- Role mappings are managed by seed-roles.sql.

INSERT INTO permissions (
    name,
    resource,
    action,
    description,
    is_system
)
VALUES
    ('profile.read_own', 'profile', 'read_own', 'Read own profile.', TRUE),
    ('profile.update_own', 'profile', 'update_own', 'Update own profile.', TRUE),

    ('applications.create', 'applications', 'create', 'Create applications.', TRUE),
    ('applications.read_own', 'applications', 'read_own', 'Read own applications.', TRUE),
    ('applications.update_own', 'applications', 'update_own', 'Update eligible own applications.', TRUE),
    ('applications.read_all', 'applications', 'read_all', 'Read applications across users.', TRUE),
    ('applications.read_assigned', 'applications', 'read_assigned', 'Read assigned applications.', TRUE),
    ('applications.review', 'applications', 'review', 'Review applications.', TRUE),
    ('applications.manage', 'applications', 'manage', 'Manage application workflows.', TRUE),

    ('colleges.read', 'colleges', 'read', 'View colleges.', TRUE),
    ('colleges.manage', 'colleges', 'manage', 'Manage college records.', TRUE),
    ('courses.read', 'courses', 'read', 'View courses.', TRUE),
    ('courses.manage', 'courses', 'manage', 'Manage course records.', TRUE),

    ('jobs.read', 'jobs', 'read', 'View jobs.', TRUE),
    ('jobs.manage', 'jobs', 'manage', 'Manage job listings.', TRUE),
    ('jobs.manage_own', 'jobs', 'manage_own', 'Manage own eligible job listings.', TRUE),
    ('employers.manage_own', 'employers', 'manage_own', 'Manage own employer profile.', TRUE),

    ('users.read', 'users', 'read', 'Read user records.', TRUE),
    ('users.manage', 'users', 'manage', 'Manage user accounts.', TRUE),
    ('roles.read', 'roles', 'read', 'Read roles and permissions.', TRUE),
    ('roles.manage', 'roles', 'manage', 'Manage role assignments.', TRUE),

    ('payments.read_own', 'payments', 'read_own', 'Read own payments.', TRUE),
    ('payments.read_all', 'payments', 'read_all', 'Read all payments.', TRUE),
    ('payments.refund', 'payments', 'refund', 'Initiate authorized refunds.', TRUE),
    ('subscriptions.read_own', 'subscriptions', 'read_own', 'Read own subscriptions.', TRUE),
    ('subscriptions.manage', 'subscriptions', 'manage', 'Manage subscriptions.', TRUE),

    ('documents.read_own', 'documents', 'read_own', 'Read own documents.', TRUE),
    ('documents.manage_own', 'documents', 'manage_own', 'Manage own eligible documents.', TRUE),
    ('documents.read_assigned', 'documents', 'read_assigned', 'Read documents for assigned applications.', TRUE),
    ('documents.review', 'documents', 'review', 'Review submitted documents.', TRUE),

    ('support.create', 'support', 'create', 'Create support requests.', TRUE),
    ('support.manage', 'support', 'manage', 'Manage support requests.', TRUE),

    ('reports.read', 'reports', 'read', 'Read authorized reports.', TRUE),
    ('audit_logs.read', 'audit_logs', 'read', 'Read audit logs.', TRUE)

ON DUPLICATE KEY UPDATE
    id = id;

-- =============================================================================
-- 16. VERIFICATION
-- =============================================================================

SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users
UNION ALL
SELECT 'roles', COUNT(*) FROM roles
UNION ALL
SELECT 'permissions', COUNT(*) FROM permissions
UNION ALL
SELECT 'courses', COUNT(*) FROM courses
UNION ALL
SELECT 'universities', COUNT(*) FROM universities
UNION ALL
SELECT 'colleges', COUNT(*) FROM colleges
UNION ALL
SELECT 'applications', COUNT(*) FROM applications
UNION ALL
SELECT 'documents', COUNT(*) FROM documents
UNION ALL
SELECT 'employers', COUNT(*) FROM employers
UNION ALL
SELECT 'jobs', COUNT(*) FROM jobs
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs;

-- =============================================================================
-- END OF CONSOLIDATED SCHEMA
-- =============================================================================
