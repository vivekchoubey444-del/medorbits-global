'use strict';

/**
 * MedOrbits -- Internship Model
 *
 * File: src/models/internship.model.js
 * Runtime: Node.js >= 20
 * Database: MySQL
 *
 * Defines trusted table and column identifiers for internship.repository.js.
 */

const TABLE = 'internships';

const COLUMNS = Object.freeze([
  'id',
  'employer_id',
  'title',
  'slug',
  'location',
  'description',
  'duration',
  'stipend',
  'status',
  'created_at',
  'updated_at',
]);

const SEARCHABLE = Object.freeze([
  'title',
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

const IMMUTABLE_FIELDS = Object.freeze([
  'id',
  'employer_id',
  'created_at',
]);

const SERVER_MANAGED_FIELDS = Object.freeze([
  'status',
]);

const VALIDATION_LIMITS = Object.freeze({
  TITLE_MAX_LENGTH: 200,
  SLUG_MAX_LENGTH: 220,
  LOCATION_MAX_LENGTH: 200,
  DESCRIPTION_MAX_LENGTH: 50000,
  DURATION_MAX_LENGTH: 100,
  STIPEND_MIN: 0,
  STIPEND_MAX: 1000000000,
});

module.exports = Object.freeze({
  TABLE,
  COLUMNS,
  SEARCHABLE,
  DEFAULT_ORDER,
  STATUSES,
  IMMUTABLE_FIELDS,
  SERVER_MANAGED_FIELDS,
  VALIDATION_LIMITS,
});