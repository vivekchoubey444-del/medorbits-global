'use strict';

/**
 * MedOrbits -- College Model
 *
 * File: src/models/college.model.js
 * Runtime: Node.js >= 20
 * Database: MySQL
 *
 * Defines trusted table and column identifiers for college.repository.js.
 */

const TABLE = 'colleges';

const COLUMNS = Object.freeze([
  'id',
  'name',
  'slug',
  'city',
  'state',
  'country',
  'type',
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

const TYPES = Object.freeze([
  'public',
  'private',
  'deemed',
  'government',
  'government_aided',
  'autonomous',
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
  TYPES,
  IMMUTABLE_FIELDS,
  ADMIN_MANAGED_FIELDS,
});