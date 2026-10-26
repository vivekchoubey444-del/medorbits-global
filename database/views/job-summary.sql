-- ============================================================
-- MedOrbits Job Summary View
-- File: database/views/job-summary.sql
-- Database: PostgreSQL 14+
--
-- Purpose:
--   Provide a summary of job listings for career dashboards,
--   job discovery, and administrative reporting.
--
-- DEPENDENCY:
--   Requires medorbits.jobs.
--
-- IMPORTANT:
--   The current core schema does not define jobs or
--   job_applications. Confirm their actual column names before
--   enabling this view.
-- ============================================================
BEGIN;
DO $$
BEGIN
    IF to_regclass('medorbits.jobs') IS NULL THEN
        RAISE EXCEPTION
            'Required table medorbits.jobs does not exist. Create or migrate the jobs table before installing job-summary.sql.';
    END IF;
END;
$$;
-- ============================================================
-- SCHEMA-DEPENDENT IMPLEMENTATION
-- ============================================================
-- This file intentionally does not create a speculative view.
-- A correct view must match the real jobs table columns and
-- the actual job-application relationship in your database.
--
-- After confirming the schema, define:
--
-- CREATE OR REPLACE VIEW medorbits.job_summary AS
-- SELECT ...
-- FROM medorbits.jobs AS j
-- LEFT JOIN ...;
--
-- Suggested summary fields, if present:
--   job ID and public ID
--   title, employer, location, employment type
--   category, salary range, and experience level
--   publication status, published_at, expires_at
--   total applications, if a job-application table exists
--
-- Avoid exposing employer contact details or private applicant
-- information in a public job-discovery view.
ROLLBACK;