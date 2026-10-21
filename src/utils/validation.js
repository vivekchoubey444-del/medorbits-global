
'use strict';

/**
 * MedOrbits -- Validation Utilities
 *
 * File: src/utils/validation.js
 * Runtime: Node.js >= 20
 *
 * Provides reusable validation for:
 * - JSON object request bodies.
 * - Required and optional strings.
 * - Email addresses.
 * - Positive integer resource IDs.
 *
 * Validation failures are forwarded to centralized Express error middleware.
 *
 * Security:
 * - Validation does not replace authorization or business-rule checks.
 * - Never trust client-supplied ownership or role fields.
 * - Use parameterized database queries.
 */

const { httpError } = require('./http');

const DEFAULT_STRING_MAX_LENGTH = 255;
const DEFAULT_OPTIONAL_STRING_MAX_LENGTH = 5000;
const MAX_EMAIL_LENGTH = 254;
const MAX_ID_LENGTH = 16;

const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function validateFieldName(field) {
  if (
    typeof field !== 'string' ||
    field.trim().length === 0
  ) {
    throw new TypeError('A valid field name is required.');
  }

  return field.trim();
}

function validateMaximum(max, allowZero = false) {
  if (
    !Number.isSafeInteger(max) ||
    max < (allowZero ? 0 : 1)
  ) {
    throw new TypeError(
      `Maximum string length must be a ${
        allowZero ? 'non-negative' : 'positive'
      } safe integer.`,
    );
  }

  return max;
}

/**
 * Ensure a request body is a non-null JSON-style object.
 *
 * Express JSON middleware should be configured before the routes.
 * This function checks the resulting value, not the request's content type.
 */
function objectBody(body) {
  if (
    body === null ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    throw httpError(
      400,
      'INVALID_BODY',
      'Request body must be a JSON object.',
    );
  }

  return body;
}

/**
 * Validate and normalize a required string.
 */
function requiredString(
  value,
  field,
  max = DEFAULT_STRING_MAX_LENGTH,
) {
  const name = validateFieldName(field);
  validateMaximum(max);

  if (typeof value !== 'string') {
    throw httpError(
      400,
      'VALIDATION_ERROR',
      `${name} must be a string.`,
    );
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    throw httpError(
      400,
      'VALIDATION_ERROR',
      `${name} is required.`,
    );
  }

  if (normalized.length > max) {
    throw httpError(
      400,
      'VALIDATION_ERROR',
      `${name} must not exceed ${max} characters.`,
    );
  }

  return normalized;
}

/**
 * Validate an optional string.
 *
 * Missing or null values return null.
 * Empty strings are allowed and normalized to an empty string.
 */
function optionalString(
  value,
  field,
  max = DEFAULT_OPTIONAL_STRING_MAX_LENGTH,
) {
  const name = validateFieldName(field);
  validateMaximum(max, true);

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw httpError(
      400,
      'VALIDATION_ERROR',
      `${name} must be a string.`,
    );
  }

  const normalized = value.trim();

  if (normalized.length > max) {
    throw httpError(
      400,
      'VALIDATION_ERROR',
      `${name} must not exceed ${max} characters.`,
    );
  }

  return normalized;
}

/**
 * Validate and normalize an email address.
 *
 * This performs format validation only. It does not establish that
 * the mailbox exists or belongs to the user.
 */
function email(value) {
  const normalized = requiredString(
    value,
    'email',
    MAX_EMAIL_LENGTH,
  ).toLowerCase();

  if (!EMAIL_PATTERN.test(normalized)) {
    throw httpError(
      400,
      'VALIDATION_ERROR',
      'Enter a valid email address.',
    );
  }

  return normalized;
}

/**
 * Validate a positive safe-integer resource ID.
 *
 * Accepts integer numbers or digit-only strings.
 * Rejects decimals, signs, zero, negative values, and unsafe integers.
 */
function positiveId(value, field = 'id') {
  const name = validateFieldName(field);

  let id;

  if (typeof value === 'number') {
    id = value;
  } else if (typeof value === 'string') {
    const normalized = value.trim();

    if (
      normalized.length === 0 ||
      normalized.length > MAX_ID_LENGTH ||
      !/^\d+$/.test(normalized)
    ) {
      throw httpError(
        400,
        'INVALID_ID',
        `${name} must be a positive integer.`,
      );
    }

    id = Number(normalized);
  } else {
    throw httpError(
      400,
      'INVALID_ID',
      `${name} must be a positive integer.`,
    );
  }

  if (!Number.isSafeInteger(id) || id < 1) {
    throw httpError(
      400,
      'INVALID_ID',
      `${name} must be a positive integer.`,
    );
  }

  return id;
}

module.exports = Object.freeze({
  objectBody,
  requiredString,
  optionalString,
  email,
  positiveId,
});
