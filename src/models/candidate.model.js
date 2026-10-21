'use strict';

/**
 * MedOrbits -- Candidate Model
 *
 * File: src/models/candidate.model.js
 * Runtime: Node.js >= 20
 * Database: MySQL
 *
 * Defines trusted table and column identifiers for candidate.repository.js.
 *
 * Security:
 * - Enforce candidate ownership in the service layer.
 * - Treat skills_json as untrusted structured data and validate its schema.
 * - Verify resume-document ownership before linking or downloading a resume.
 * - Restrict changes to status and resume_document_id to authorized workflows.
 */

const TABLE = 'candidates';

const COLUMNS = Object.freeze([
  'id',
  'user_id',
  'headline',
  'skills_json',
  'resume_document_id',
  'experience_years',
  'location',
  'status',
  'created_at',
  'updated_at',
]);

const SEARCHABLE = Object.freeze([
  'headline',
  'location',
  'status',
]);

const DEFAULT_ORDER = 'id';

const STATUSES = Object.freeze([
  'active',
  'inactive',
  'seeking',
  'hired',
]);

const IMMUTABLE_FIELDS = Object.freeze([
  'id',
  'user_id',
  'created_at',
]);

const SENSITIVE_FIELDS = Object.freeze([
  'skills_json',
  'resume_document_id',
]);

const SERVER_MANAGED_FIELDS = Object.freeze([
  'status',
  'resume_document_id',
]);

const VALIDATION_LIMITS = Object.freeze({
  HEADLINE_MAX_LENGTH: 200,
  LOCATION_MAX_LENGTH: 200,
  EXPERIENCE_YEARS_MIN: 0,
  EXPERIENCE_YEARS_MAX: 60,
  MAX_SKILLS: 100,
  SKILL_MAX_LENGTH: 100,
});

module.exports = Object.freeze({
  TABLE,
  COLUMNS,
  SEARCHABLE,
  DEFAULT_ORDER,
  STATUSES,
  IMMUTABLE_FIELDS,
  SENSITIVE_FIELDS,
  SERVER_MANAGED_FIELDS,
  VALIDATION_LIMITS,
});