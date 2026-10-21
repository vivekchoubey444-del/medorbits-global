'use strict';

/**
 * MedOrbits -- University Model
 *
 * File: src/models/university.model.js
 * Runtime: Node.js >= 20
 * Database: MySQL
 *
 * Defines trusted table and column identifiers for university.repository.js.
 */

const TABLE = 'universities';

const COLUMNS = Object.freeze([
  'id',
  'name',
  'slug',
  'city',
  'state',
  'country',
  'website',
  'description',
  'status',
  'created_at',
  'updated_at',
]);

const SEARCHABLE = Object.freeze([
  'name',
  'slug',
  'city',
  'state',
]);

const DEFAULT_ORDER = 'id';

const STATUSES = Object.freeze([
  'draft',
  'published',
  'archived',
]);

const IMMUTABLE_FIELDS = Object.freeze([
  'id',
  'created_at',
]);

const ADMIN_MANAGED_FIELDS = Object.freeze([
  'status',
]);

const VALIDATION_LIMITS = Object.freeze({
  NAME_MAX_LENGTH: 255,
  SLUG_MAX_LENGTH: 255,
  CITY_MAX_LENGTH: 120,
  STATE_MAX_LENGTH: 120,
  COUNTRY_MAX_LENGTH: 120,
  WEBSITE_MAX_LENGTH: 2048,
  DESCRIPTION_MAX_LENGTH: 20000,
});

module.exports = Object.freeze({
  TABLE,
  COLUMNS,
  SEARCHABLE,
  DEFAULT_ORDER,
  STATUSES,
  IMMUTABLE_FIELDS,
  ADMIN_MANAGED_FIELDS,
  VALIDATION_LIMITS,
});