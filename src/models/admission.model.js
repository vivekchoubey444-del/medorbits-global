'use strict';

/**
 * MedOrbits -- Admission Model
 *
 * File: src/models/admission.model.js
 * Runtime: Node.js >= 20
 * Database: MySQL
 *
 * Defines the trusted table and column allowlists used by
 * admission.repository.js.
 */

const TABLE = 'admissions';

const COLUMNS = Object.freeze([
  'id',
  'user_id',
  'course_id',
  'college_id',
  'status',
  'intake_year',
  'notes',
  'created_at',
  'updated_at',
]);

const SEARCHABLE = Object.freeze([
  'status',
  'notes',
]);

const DEFAULT_ORDER = 'id';

/**
 * Valid admission workflow statuses.
 *
 * Keep these values aligned with the database schema,
 * service-layer transition rules, and API validation.
 */
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
  'created_at',
]);

module.exports = Object.freeze({
  TABLE,
  COLUMNS,
  SEARCHABLE,
  DEFAULT_ORDER,
  STATUSES,
  IMMUTABLE_FIELDS,
});