'use strict';

/**
 * MedOrbits -- Employer Model
 *
 * File: src/models/employer.model.js
 * Runtime: Node.js >= 20
 * Database: MySQL
 *
 * Defines trusted table and column identifiers for employer.repository.js.
 *
 * Security:
 * - Enforce employer ownership through the authenticated user.
 * - Restrict verification and account-status changes to authorized workflows.
 * - Validate website URLs and company information in the service layer.
 * - Do not treat a verified company profile as proof of employment legitimacy
 *   without an appropriate verification process.
 */

const TABLE = 'employers';

const COLUMNS = Object.freeze([
  'id',
  'user_id',
  'company_name',
  'website',
  'industry',
  'company_size',
  'description',
  'verification_status',
  'status',
  'created_at',
  'updated_at',
]);

const SEARCHABLE = Object.freeze([
  'company_name',
  'industry',
  'description',
]);

const DEFAULT_ORDER = 'id';

const VERIFICATION_STATUSES = Object.freeze([
  'pending',
  'verified',
  'rejected',
]);

const STATUSES = Object.freeze([
  'active',
  'suspended',
  'inactive',
]);

const COMPANY_SIZES = Object.freeze([
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001+',
]);

const IMMUTABLE_FIELDS = Object.freeze([
  'id',
  'user_id',
  'created_at',
]);

const SERVER_MANAGED_FIELDS = Object.freeze([
  'verification_status',
  'status',
]);

const VALIDATION_LIMITS = Object.freeze({
  COMPANY_NAME_MAX_LENGTH: 200,
  INDUSTRY_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 10000,
  WEBSITE_MAX_LENGTH: 2048,
});

module.exports = Object.freeze({
  TABLE,
  COLUMNS,
  SEARCHABLE,
  DEFAULT_ORDER,
  VERIFICATION_STATUSES,
  STATUSES,
  COMPANY_SIZES,
  IMMUTABLE_FIELDS,
  SERVER_MANAGED_FIELDS,
  VALIDATION_LIMITS,
});