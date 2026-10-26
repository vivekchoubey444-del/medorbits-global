'use strict';

/**
 * MedOrbits -- Course Model
 *
 * File: src/models/course.model.js
 * Runtime: Node.js >= 20
 * Database: MySQL
 *
 * Defines trusted table and column identifiers for course.repository.js.
 */

const TABLE = 'courses';

const COLUMNS = Object.freeze([
  'id',
  'title',
  'slug',
  'category',
  'level',
  'description',
  'fees',
  'duration',
  'status',
  'created_at',
  'updated_at',
]);

const SEARCHABLE = Object.freeze([
  'title',
  'slug',
  'category',
  'description',
]);

const DEFAULT_ORDER = 'id';

const STATUSES = Object.freeze([
  'draft',
  'published',
  'archived',
]);

const LEVELS = Object.freeze([
  'certificate',
  'diploma',
  'undergraduate',
  'postgraduate',
  'doctoral',
  'professional',
  'other',
]);

const IMMUTABLE_FIELDS = Object.freeze([
  'id',
  'created_at',
]);

const ADMIN_MANAGED_FIELDS = Object.freeze([
  'status',
]);

module.exports = Object.freeze({
  TABLE,
  COLUMNS,
  SEARCHABLE,
  DEFAULT_ORDER,
  STATUSES,
  LEVELS,
  IMMUTABLE_FIELDS,
  ADMIN_MANAGED_FIELDS,
});