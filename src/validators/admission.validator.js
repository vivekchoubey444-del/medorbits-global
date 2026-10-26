'use strict';

/**
 * MedOrbits -- Application Validator
 *
 * File: src/validators/application.validator.js
 *
 * Runtime: Node.js >= 20
 *
 * Validates and normalizes application create/update payloads.
 * Unknown fields are rejected to prevent mass assignment.
 */

const ALLOWED_FIELDS = Object.freeze([
  'user_id',
  'course_id',
  'college_id',
  'university_id',
  'application_id',
  'academic_year',
  'intake_year',
  'status',
  'admission_type',
  'notes',
]);

const ALLOWED_STATUSES = Object.freeze([
  'draft',
  'pending',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'cancelled',
]);

const ALLOWED_ADMISSION_TYPES = Object.freeze([
  'merit',
  'management',
  'international',
  'transfer',
  'other',
]);

const MAX_NOTES_LENGTH = 5000;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

const ID_FIELDS = Object.freeze([
  'user_id',
  'course_id',
  'college_id',
  'university_id',
  'application_id',
]);

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

function validationError(message, code = 'VALIDATION_ERROR') {
  const error = new Error(message);
  error.name = 'ValidationError';
  error.status = 400;
  error.statusCode = 400;
  error.code = code;
  error.publicMessage = message;
  return error;
}

function pickAllowed(input = {}) {
  if (
    input === null ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw validationError(
      'Request body must be a JSON object.',
      'INVALID_BODY',
    );
  }

  const unknownFields = Object.keys(input).filter(
    (key) => !ALLOWED_FIELDS.includes(key),
  );

  if (unknownFields.length > 0) {
    throw validationError(
      `Unsupported field(s): ${unknownFields.join(', ')}.`,
      'UNKNOWN_FIELDS',
    );
  }

  const output = {};

  for (const key of ALLOWED_FIELDS) {
    if (hasOwn(input, key)) {
      output[key] = input[key];
    }
  }

  return output;
}

function validateId(data, field) {
  if (data[field] === undefined) return;

  if (
    !Number.isSafeInteger(data[field]) ||
    data[field] < 1
  ) {
    throw validationError(
      `${field} must be a positive integer.`,
      'INVALID_ID',
    );
  }
}

function validateAcademicYear(data) {
  if (data.academic_year === undefined) return;

  if (
    typeof data.academic_year !== 'string' ||
    !/^\d{4}-\d{4}$/.test(data.academic_year.trim())
  ) {
    throw validationError(
      'academic_year must use the YYYY-YYYY format.',
      'INVALID_ACADEMIC_YEAR',
    );
  }

  const [start, end] = data.academic_year
    .trim()
    .split('-')
    .map(Number);

  if (
    start < MIN_YEAR ||
    end > MAX_YEAR ||
    end !== start + 1
  ) {
    throw validationError(
      `academic_year must contain consecutive years between ${MIN_YEAR} and ${MAX_YEAR}.`,
      'INVALID_ACADEMIC_YEAR',
    );
  }

  data.academic_year = `${start}-${end}`;
}

function validateIntakeYear(data) {
  if (data.intake_year === undefined) return;

  if (
    !Number.isSafeInteger(data.intake_year) ||
    data.intake_year < MIN_YEAR ||
    data.intake_year > MAX_YEAR
  ) {
    throw validationError(
      `intake_year must be an integer between ${MIN_YEAR} and ${MAX_YEAR}.`,
      'INVALID_INTAKE_YEAR',
    );
  }
}

function normalizeEnum(data, field, allowedValues) {
  if (data[field] === undefined) return;

  if (typeof data[field] !== 'string') {
    throw validationError(
      `${field} must be a string.`,
      'INVALID_ENUM',
    );
  }

  const value = data[field].trim().toLowerCase();

  if (!allowedValues.includes(value)) {
    throw validationError(
      `${field} must be one of: ${allowedValues.join(', ')}.`,
      'INVALID_ENUM',
    );
  }

  data[field] = value;
}

function validateNotes(data) {
  if (data.notes === undefined) return;

  if (typeof data.notes !== 'string') {
    throw validationError(
      'notes must be a string.',
      'INVALID_NOTES',
    );
  }

  const notes = data.notes.trim();

  if (notes.length > MAX_NOTES_LENGTH) {
    throw validationError(
      `notes must not exceed ${MAX_NOTES_LENGTH} characters.`,
      'NOTES_TOO_LONG',
    );
  }

  data.notes = notes;
}

function validateRelationships(data, { partial }) {
  if (partial) return;

  const hasAcademicYear =
    data.academic_year !== undefined ||
    data.intake_year !== undefined;

  if (!hasAcademicYear) {
    throw validationError(
      'academic_year or intake_year is required.',
      'MISSING_ACADEMIC_YEAR',
    );
  }

  if (data.application_id === undefined) {
    if (data.course_id === undefined) {
      throw validationError(
        'course_id is required when application_id is not provided.',
        'MISSING_COURSE_ID',
      );
    }

    if (
      data.college_id === undefined &&
      data.university_id === undefined
    ) {
      throw validationError(
        'Provide a college_id or university_id when application_id is not provided.',
        'MISSING_INSTITUTION_ID',
      );
    }
  }

  if (
    data.college_id !== undefined &&
    data.university_id !== undefined
  ) {
    throw validationError(
      'Provide either college_id or university_id, not both.',
      'CONFLICTING_INSTITUTION_IDS',
    );
  }
}

function validate(input = {}, options = {}) {
  if (
    options === null ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('Validation options must be an object.');
  }

  const partial = options.partial === true;
  const data = pickAllowed(input);

  if (Object.keys(data).length === 0) {
    throw validationError(
      'At least one supported field must be provided.',
      'EMPTY_PAYLOAD',
    );
  }

  for (const field of ID_FIELDS) {
    validateId(data, field);
  }

  validateAcademicYear(data);
  validateIntakeYear(data);

  normalizeEnum(data, 'status', ALLOWED_STATUSES);
  normalizeEnum(data, 'admission_type', ALLOWED_ADMISSION_TYPES);

  validateNotes(data);
  validateRelationships(data, { partial });

  return data;
}

function validateCreate(input) {
  return validate(input, { partial: false });
}

function validateUpdate(input) {
  return validate(input, { partial: true });
}

module.exports = {
  ALLOWED_FIELDS,
  ALLOWED_STATUSES,
  ALLOWED_ADMISSION_TYPES,
  MAX_NOTES_LENGTH,
  pickAllowed,
  validate,
  validateCreate,
  validateUpdate,
};