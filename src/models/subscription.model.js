'use strict';

/**
 * MedOrbits -- Subscription Model
 *
 * File: src/models/subscription.model.js
 * Runtime: Node.js >= 20
 * Database: MySQL
 *
 * Defines trusted table and column identifiers for
 * subscription.repository.js.
 *
 * Security:
 * - Subscription ownership must be verified against the authenticated user.
 * - Status and billing periods must be managed by trusted subscription workflows.
 * - Provider references must be verified server-side.
 * - Subscription activation must not rely solely on client-supplied payment data.
 */

const TABLE = 'subscriptions';

const COLUMNS = Object.freeze([
  'id',
  'user_id',
  'plan_code',
  'status',
  'starts_at',
  'ends_at',
  'provider_reference',
  'created_at',
  'updated_at',
]);

const SEARCHABLE = Object.freeze([
  'plan_code',
  'status',
]);

const DEFAULT_ORDER = 'id';

const STATUSES = Object.freeze([
  'pending',
  'trialing',
  'active',
  'past_due',
  'paused',
  'cancelled',
  'expired',
]);

const IMMUTABLE_FIELDS = Object.freeze([
  'id',
  'user_id',
  'plan_code',
  'created_at',
]);

const SERVER_MANAGED_FIELDS = Object.freeze([
  'status',
  'starts_at',
  'ends_at',
  'provider_reference',
]);

const VALIDATION_LIMITS = Object.freeze({
  PLAN_CODE_MAX_LENGTH: 64,
  PROVIDER_REFERENCE_MAX_LENGTH: 255,
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