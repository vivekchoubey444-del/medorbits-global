'use strict';

/**
 * MedOrbits -- Job Model
 *
 * File: src/models/job.model.js
 * Runtime: Node.js >= 20
 * Database: MySQL
 *
 * Defines trusted table and column identifiers for job.repository.js.
 *
 * Security:
 * - Verify employer ownership before creating or modifying job listings.
 * - Restrict publication and closure to authorized workflows.
 * - Validate salary ranges and employment types in the service layer.
 * - Do not expose unpublished listings to public search results.
 */

const TABLE = 'jobs';

const COLUMNS = Object.freeze([
  'id',
  'employer_id',
  'title',
  'slug',
  'category',
  'location',
  'employment_type',
  'description',
  'salary_min',
  'salary_max',
  'status',
  'published_at',
  'created_at',
  'updated_at',
]);

const SEARCHABLE = Object.freeze([
  'title',
  'category',
  'location',
  'description',
]);

const DEFAULT_ORDER = 'id';

const STATUSES = Object.freeze([
  'draft',
  'published',
  'paused',
  'closed',
  'filled',
]);

const EMPLOYMENT_TYPES = Object.freeze([
  'full_time',
  'part_time',
  'contract',
  'temporary',
  'internship',
  'apprenticeship',
  'freelance',
]);

const IMMUTABLE_FIELDS = Object.freeze([
  'id',
  'employer_id',
  'created_at',
]);

const SERVER_MANAGED_FIELDS = Object.freeze([
  'status',
  'published_at',
]);

const VALIDATION_LIMITS = Object.freeze({
  TITLE_MAX_LENGTH: 200,
  SLUG_MAX_LENGTH: 220,
  CATEGORY_MAX_LENGTH: 100,
  LOCATION_MAX_LENGTH: 200,
  DESCRIPTION_MAX_LENGTH: 50000,
  SALARY_MIN: 0,
  SALARY_MAX: 1000000000,
});

module.exports = Object.freeze({
  TABLE,
  COLUMNS,
  SEARCHABLE,
  DEFAULT_ORDER,
  STATUSES,
  EMPLOYMENT_TYPES,
  IMMUTABLE_FIELDS,
  SERVER_MANAGED_FIELDS,
  VALIDATION_LIMITS,
});