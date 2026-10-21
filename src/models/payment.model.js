'use strict';

/**
 * MedOrbits -- Payment Model
 *
 * File: src/models/payment.model.js
 * Runtime: Node.js >= 20
 * Database: MySQL
 *
 * Defines trusted table and column identifiers for payment.repository.js.
 *
 * Security:
 * - Payment status must be updated only by trusted payment workflows.
 * - Verify payment-provider signatures and transaction references server-side.
 * - Never accept client-supplied payment verification results.
 * - Store monetary amounts as integer minor units.
 * - Never store card numbers, CVVs, or other raw payment credentials.
 */

const TABLE = 'payments';

const COLUMNS = Object.freeze([
  'id',
  'user_id',
  'subscription_id',
  'provider',
  'provider_reference',
  'amount_minor',
  'currency',
  'status',
  'verified_at',
  'created_at',
  'updated_at',
]);

const SEARCHABLE = Object.freeze([
  'provider_reference',
  'status',
]);

const DEFAULT_ORDER = 'id';

const PROVIDERS = Object.freeze([
  'razorpay',
  'stripe',
  'other',
]);

const STATUSES = Object.freeze([
  'pending',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded',
]);

const IMMUTABLE_FIELDS = Object.freeze([
  'id',
  'user_id',
  'subscription_id',
  'provider',
  'provider_reference',
  'amount_minor',
  'currency',
  'created_at',
]);

const SERVER_MANAGED_FIELDS = Object.freeze([
  'status',
  'verified_at',
]);

const VALIDATION_LIMITS = Object.freeze({
  AMOUNT_MINOR_MIN: 1,
  AMOUNT_MINOR_MAX: Number.MAX_SAFE_INTEGER,
  CURRENCY_LENGTH: 3,
  PROVIDER_MAX_LENGTH: 32,
  PROVIDER_REFERENCE_MAX_LENGTH: 255,
});

module.exports = Object.freeze({
  TABLE,
  COLUMNS,
  SEARCHABLE,
  DEFAULT_ORDER,
  PROVIDERS,
  STATUSES,
  IMMUTABLE_FIELDS,
  SERVER_MANAGED_FIELDS,
  VALIDATION_LIMITS,
});