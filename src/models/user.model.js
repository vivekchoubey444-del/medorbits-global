'use strict';

/**
 * MedOrbits -- User Model
 *
 * File: src/models/user.model.js
 * Runtime: Node.js >= 20
 * Database: MySQL
 *
 * Defines trusted table and column identifiers for user.repository.js.
 *
 * Security:
 * - Never expose password_hash through public API responses.
 * - Password hashes must only be written by trusted authentication services.
 * - Email and phone changes require appropriate validation.
 * - Account status and email verification must be managed by trusted services.
 */

const TABLE = 'users';

const COLUMNS = Object.freeze([
  'id',
  'name',
  'email',
  'password_hash',
  'phone',
  'status',
  'email_verified_at',
  'created_at',
  'updated_at',
]);

const SEARCHABLE = Object.freeze([
  'name',
  'email',
  'phone',
]);

const DEFAULT_ORDER = 'id';

const STATUSES = Object.freeze([
  'pending',
  'active',
  'suspended',
  'deactivated',
]);

const IMMUTABLE_FIELDS = Object.freeze([
  'id',
  'created_at',
]);

const SENSITIVE_FIELDS = Object.freeze([
  'password_hash',
]);

const AUTH_MANAGED_FIELDS = Object.freeze([
  'password_hash',
  'email_verified_at',
  'status',
]);

module.exports = Object.freeze({
  TABLE,
  COLUMNS,
  SEARCHABLE,
  DEFAULT_ORDER,
  STATUSES,
  IMMUTABLE_FIELDS,
  SENSITIVE_FIELDS,
  AUTH_MANAGED_FIELDS,
});