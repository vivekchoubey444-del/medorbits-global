'use strict';

/**
 * MedOrbits -- Role Model
 *
 * File: src/models/role.model.js
 * Runtime: Node.js >= 20
 * Database: MySQL
 *
 * Defines trusted table and column identifiers for role.repository.js.
 *
 * Security:
 * - Role permissions must be validated by trusted authorization services.
 * - Never allow public users to modify roles or permissions.
 * - Prevent unauthorized privilege escalation.
 * - Parse permissions_json using strict schema validation.
 */

const TABLE = 'roles';

const COLUMNS = Object.freeze([
  'id',
  'name',
  'slug',
  'permissions_json',
  'created_at',
  'updated_at',
]);

const SEARCHABLE = Object.freeze([
  'name',
  'slug',
]);

const DEFAULT_ORDER = 'id';

const SYSTEM_ROLES = Object.freeze([
  'super_admin',
  'admin',
  'admissions_manager',
  'counsellor',
  'recruiter',
  'employer',
  'candidate',
  'student',
  'user',
]);

const IMMUTABLE_FIELDS = Object.freeze([
  'id',
  'created_at',
]);

const SENSITIVE_FIELDS = Object.freeze([
  'permissions_json',
]);

const ADMIN_MANAGED_FIELDS = Object.freeze([
  'name',
  'slug',
  'permissions_json',
]);

const VALIDATION_LIMITS = Object.freeze({
  NAME_MAX_LENGTH: 100,
  SLUG_MAX_LENGTH: 100,
  MAX_PERMISSIONS: 200,
  PERMISSION_MAX_LENGTH: 150,
});

module.exports = Object.freeze({
  TABLE,
  COLUMNS,
  SEARCHABLE,
  DEFAULT_ORDER,
  SYSTEM_ROLES,
  IMMUTABLE_FIELDS,
  SENSITIVE_FIELDS,
  ADMIN_MANAGED_FIELDS,
  VALIDATION_LIMITS,
});