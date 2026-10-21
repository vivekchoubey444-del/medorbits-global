'use strict';

/**
 * MedOrbits -- Session Model
 *
 * File: src/models/session.model.js
 * Runtime: Node.js >= 20
 * Database: MySQL
 *
 * Defines trusted table and column identifiers for session.repository.js.
 *
 * Security:
 * - Store only cryptographic hashes of session tokens.
 * - Never expose token_hash through API responses or logs.
 * - Restrict session creation, revocation, and deletion to authentication services.
 * - Enforce session ownership and expiration during authentication.
 * - Treat IP addresses and user-agent strings as potentially sensitive data.
 */

const TABLE = 'sessions';

const COLUMNS = Object.freeze([
  'id',
  'user_id',
  'token_hash',
  'expires_at',
  'revoked_at',
  'ip_address',
  'user_agent',
  'created_at',
  'updated_at',
]);

const SEARCHABLE = Object.freeze([
  'user_id',
]);

const DEFAULT_ORDER = 'id';

const IMMUTABLE_FIELDS = Object.freeze([
  'id',
  'user_id',
  'token_hash',
  'created_at',
]);

const SENSITIVE_FIELDS = Object.freeze([
  'token_hash',
  'ip_address',
  'user_agent',
]);

const AUTH_MANAGED_FIELDS = Object.freeze([
  'token_hash',
  'expires_at',
  'revoked_at',
]);

const VALIDATION_LIMITS = Object.freeze({
  TOKEN_HASH_MAX_LENGTH: 255,
  IP_ADDRESS_MAX_LENGTH: 45,
  USER_AGENT_MAX_LENGTH: 1024,
});

module.exports = Object.freeze({
  TABLE,
  COLUMNS,
  SEARCHABLE,
  DEFAULT_ORDER,
  IMMUTABLE_FIELDS,
  SENSITIVE_FIELDS,
  AUTH_MANAGED_FIELDS,
  VALIDATION_LIMITS,
});