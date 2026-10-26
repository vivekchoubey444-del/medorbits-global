'use strict';

/**
 * MedOrbits -- Enrollment Validator
 *
 * File: src/validators/enrollment.validator.js
 * Runtime: Node.js >= 20
 *
 * Validates and normalizes enrollment create/update payloads.
 * Rejects unknown fields to prevent mass assignment.
 */

const ALLOWED_FIELDS = Object.freeze([
  'user_id',
  'course_id',
  'college_id',
  'status',
  'intake_year',
  'notes',
]);

const ALLOWED_STATUSES = Object.freeze([
  'draft',
  'pending',
  'submitted',
  'under_review',
  'accepted',
  'rejected',
  'withdrawn',
]);

const MAX_NOTES_LENGTH = 5000;
const MIN_INTAKE_YEAR = 2000;
const MAX_INTAKE_YEAR = 2100;

const ID_FIELDS = Object.freeze([
  'user_id',
  'course_id',
  'college_id',
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

function validateIntakeYear(data) {
  if (data.intake_year === undefined) return;

  if (
    !Number.isSafeInteger(data.intake_year) ||
    data.intake_year < MIN_INTAKE_YEAR ||
    data.intake_year > MAX_INTAKE_YEAR
  ) {
    throw validationError(
      `intake_year must be an integer between ${MIN_INTAKE_YEAR} and ${MAX_INTAKE_YEAR}.`,
      'INVALID_INTAKE_YEAR',
    );
  }
}

function validateStatus(data) {
  if (data.status === undefined) return;

  if (typeof data.status !== 'string') {
    throw validationError(
      'status must be a string.',
      'INVALID_STATUS',
    );
  }

  const status = data.status.trim().toLowerCase();

  if (!ALLOWED_STATUSES.includes(status)) {
    throw validationError(
      `status must be one of: ${ALLOWED_STATUSES.join(', ')}.`,
      'INVALID_STATUS',
    );
  }

  data.status = status;
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

  validateIntakeYear(data);
  validateStatus(data);
  validateNotes(data);

  if (!partial) {
    if (data.course_id === undefined) {
      throw validationError(
        'course_id is required.',
        'MISSING_COURSE_ID',
      );
    }

    if (data.college_id === undefined) {
      throw validationError(
        'college_id is required.',
        'MISSING_COLLEGE_ID',
      );
    }

    if (data.intake_year === undefined) {
      throw validationError(
        'intake_year is required.',
        'MISSING_INTAKE_YEAR',
      );
    }
  }

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
  MAX_NOTES_LENGTH,
  MIN_INTAKE_YEAR,
  MAX_INTAKE_YEAR,
  pickAllowed,
  validate,
  validateCreate,
  validateUpdate,
};