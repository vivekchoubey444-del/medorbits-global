'use strict';

/**
 * MedOrbits -- Application Model
 *
 * File: src/models/application.model.js
 * Runtime: Node.js >= 20
 * Database: MySQL
 *
 * Defines trusted table and column identifiers for
 * application.repository.js.
 */

const TABLE = 'applications';

const COLUMNS = Object.freeze([
  'id',
  'user_id',
  'course_id',
  'college_id',
  'application_number',
  'status',
  'form_data_json',
  'submitted_at',
  'created_at',
  'updated_at',
]);

const SEARCHABLE = Object.freeze([
  'application_number',
  'status',
]);

const DEFAULT_ORDER = 'id';

const STATUSES = Object.freeze([
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'withdrawn',
]);

const IMMUTABLE_FIELDS = Object.freeze([
  'id',
  'application_number',
  'user_id',
  'submitted_at',
  'created_at',
]);

const SENSITIVE_FIELDS = Object.freeze([
  'form_data_json',
]);

module.exports = Object.freeze({
  TABLE,
  COLUMNS,
  SEARCHABLE,
  DEFAULT_ORDER,
  STATUSES,
  IMMUTABLE_FIELDS,
  SENSITIVE_FIELDS,
});