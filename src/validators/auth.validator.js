'use strict';

/**
 * MedOrbits -- Authentication Validator
 *
 * File: src/validators/auth.validator.js
 * Runtime: Node.js >= 20
 *
 * Validates registration and login payloads.
 * Rejects unknown fields and normalizes email addresses.
 * Passwords are never trimmed or modified.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_REGISTER_FIELDS = Object.freeze([
  'name',
  'email',
  'password',
]);

const ALLOWED_LOGIN_FIELDS = Object.freeze([
  'email',
  'password',
]);

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function validationError(message, code = 'VALIDATION_ERROR') {
  const error = new Error(message);

  error.name = 'ValidationError';
  error.status = 400;
  error.statusCode = 400;
  error.code = code;
  error.publicMessage = message;

  return error;
}

function requireObject(input) {
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
}

function rejectUnknownFields(input, allowedFields) {
  const unknown = Object.keys(input).filter(
    (field) => !allowedFields.includes(field),
  );

  if (unknown.length > 0) {
    throw validationError(
      `Unsupported field(s): ${unknown.join(', ')}.`,
      'UNKNOWN_FIELDS',
    );
  }
}

function normalizeEmail(email) {
  if (typeof email !== 'string') {
    throw validationError(
      'A valid email address is required.',
      'INVALID_EMAIL',
    );
  }

  const normalized = email.trim().toLowerCase();

  if (
    normalized.length === 0 ||
    normalized.length > MAX_EMAIL_LENGTH ||
    !EMAIL_REGEX.test(normalized)
  ) {
    throw validationError(
      'A valid email address is required.',
      'INVALID_EMAIL',
    );
  }

  return normalized;
}

function validatePassword(password) {
  if (typeof password !== 'string') {
    throw validationError(
      'Password must be a string.',
      'INVALID_PASSWORD',
    );
  }

  if (
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    throw validationError(
      `Password must contain between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`,
      'INVALID_PASSWORD_LENGTH',
    );
  }

  if (password.trim().length === 0) {
    throw validationError(
      'Password cannot be empty.',
      'EMPTY_PASSWORD',
    );
  }

  // Do not trim or normalize passwords. Spaces can be intentional.
  return password;
}

function validateName(name) {
  if (typeof name !== 'string') {
    throw validationError(
      'Name is required.',
      'INVALID_NAME',
    );
  }

  const normalized = name.trim();

  if (
    normalized.length < MIN_NAME_LENGTH ||
    normalized.length > MAX_NAME_LENGTH
  ) {
    throw validationError(
      `Name must contain between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters.`,
      'INVALID_NAME_LENGTH',
    );
  }

  // Reject control characters while allowing Unicode names.
  if (/[\u0000-\u001f\u007f]/.test(normalized)) {
    throw validationError(
      'Name contains unsupported characters.',
      'INVALID_NAME',
    );
  }

  return normalized;
}

function validateRegister(input = {}) {
  requireObject(input);
  rejectUnknownFields(input, ALLOWED_REGISTER_FIELDS);

  if (input.name === undefined) {
    throw validationError('Name is required.', 'MISSING_NAME');
  }

  if (input.email === undefined) {
    throw validationError('Email is required.', 'MISSING_EMAIL');
  }

  if (input.password === undefined) {
    throw validationError('Password is required.', 'MISSING_PASSWORD');
  }

  return {
    name: validateName(input.name),
    email: normalizeEmail(input.email),
    password: validatePassword(input.password),
  };
}

function validateLogin(input = {}) {
  requireObject(input);
  rejectUnknownFields(input, ALLOWED_LOGIN_FIELDS);

  if (input.email === undefined) {
    throw validationError('Email is required.', 'MISSING_EMAIL');
  }

  if (input.password === undefined) {
    throw validationError('Password is required.', 'MISSING_PASSWORD');
  }

  return {
    email: normalizeEmail(input.email),
    password: validatePassword(input.password),
  };
}

// Backward-compatible default validator: login payload.
function validate(input = {}) {
  return validateLogin(input);
}

module.exports = {
  ALLOWED_REGISTER_FIELDS,
  ALLOWED_LOGIN_FIELDS,
  MIN_NAME_LENGTH,
  MAX_NAME_LENGTH,
  MAX_EMAIL_LENGTH,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  validate,
  validateLogin,
  validateRegister,
  normalizeEmail,
  validatePassword,
  validateName,
};