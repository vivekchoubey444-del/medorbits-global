'use strict';

/**
 * MedOrbits -- Notification Model
 *
 * File: src/models/notification.model.js
 * Runtime: Node.js >= 20
 * Database: MySQL
 *
 * Defines trusted table and column identifiers for notification.repository.js.
 */

const TABLE = 'notifications';

const COLUMNS = Object.freeze([
  'id',
  'user_id',
  'type',
  'title',
  'message',
  'read_at',
  'metadata_json',
  'created_at',
  'updated_at',
]);

const SEARCHABLE = Object.freeze([
  'title',
  'message',
  'type',
]);

const DEFAULT_ORDER = 'id';

const TYPES = Object.freeze([
  'general',
  'application_update',
  'document_update',
  'admission_update',
  'job_update',
  'internship_update',
  'payment_update',
  'subscription_update',
  'security_alert',
  'account_update',
]);

const IMMUTABLE_FIELDS = Object.freeze([
  'id',
  'user_id',
  'created_at',
]);

const SERVER_MANAGED_FIELDS = Object.freeze([
  'read_at',
]);

const SENSITIVE_FIELDS = Object.freeze([
  'metadata_json',
]);

const VALIDATION_LIMITS = Object.freeze({
  TYPE_MAX_LENGTH: 64,
  TITLE_MAX_LENGTH: 200,
  MESSAGE_MAX_LENGTH: 5000,
  METADATA_MAX_BYTES: 16384,
});

module.exports = Object.freeze({
  TABLE,
  COLUMNS,
  SEARCHABLE,
  DEFAULT_ORDER,
  TYPES,
  IMMUTABLE_FIELDS,
  SERVER_MANAGED_FIELDS,
  SENSITIVE_FIELDS,
  VALIDATION_LIMITS,
});