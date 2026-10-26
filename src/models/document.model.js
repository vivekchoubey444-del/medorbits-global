'use strict';

/**
 * MedOrbits -- Document Model
 *
 * File: src/models/document.model.js
 * Runtime: Node.js >= 20
 * Database: MySQL
 *
 * Defines trusted table and column identifiers for document.repository.js.
 *
 * Security:
 * - Never expose storage_key in public API responses.
 * - Verify document ownership and application access in the service layer.
 * - Allow downloads only after authorization and document-status checks.
 * - Validate MIME type, file size, and file contents during upload.
 */

const TABLE = 'documents';

const COLUMNS = Object.freeze([
  'id',
  'user_id',
  'application_id',
  'original_name',
  'storage_key',
  'mime_type',
  'size_bytes',
  'status',
  'created_at',
  'updated_at',
]);

const SEARCHABLE = Object.freeze([
  'original_name',
  'status',
]);

const DEFAULT_ORDER = 'id';

const STATUSES = Object.freeze([
  'pending',
  'under_review',
  'approved',
  'rejected',
  'deleted',
]);

const IMMUTABLE_FIELDS = Object.freeze([
  'id',
  'user_id',
  'application_id',
  'storage_key',
  'created_at',
]);

const SENSITIVE_FIELDS = Object.freeze([
  'storage_key',
]);

const ADMIN_MANAGED_FIELDS = Object.freeze([
  'status',
]);

const ALLOWED_MIME_TYPES = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB

module.exports = Object.freeze({
  TABLE,
  COLUMNS,
  SEARCHABLE,
  DEFAULT_ORDER,
  STATUSES,
  IMMUTABLE_FIELDS,
  SENSITIVE_FIELDS,
  ADMIN_MANAGED_FIELDS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
});