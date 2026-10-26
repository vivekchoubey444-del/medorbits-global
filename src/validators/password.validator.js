'use strict';

const ALLOWED_CHANGE_FIELDS = Object.freeze([
  'currentPassword',
  'newPassword',
  'confirmPassword',
]);

const ALLOWED_RESET_REQUEST_FIELDS = Object.freeze([
  'email',
]);

const ALLOWED_RESET_FIELDS = Object.freeze([
  'token',
  'newPassword',
  'confirmPassword',
]);

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;
const MAX_TOKEN_LENGTH = 2048;
const MAX_EMAIL_LENGTH = 254;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARACTERS_REGEX = /[\u0000-\u001F\u007F]/;

function validationError(
  message,
  field,
  code = 'VALIDATION_ERROR'
) {
  const error = new Error(message);

  error.name = 'ValidationError';
  error.status = 400;
  error.statusCode = 400;
  error.code = code;
  error.publicMessage = message;

  if (field) {
    error.field = field;
  }

  return error;
}

function isPlainObject(input) {
  if (input === null || typeof input !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(input);

  return prototype === Object.prototype || prototype === null;
}

function requireObject(input, label = 'Request body') {
  if (!isPlainObject(input)) {
    throw validationError(
      `${label} must be a plain JSON object.`,
      'body',
      'INVALID_TYPE'
    );
  }

  return input;
}

function rejectUnknownFields(input, allowedFields) {
  requireObject(input);

  if (!Array.isArray(allowedFields)) {
    throw new TypeError('allowedFields must be an array.');
  }

  const allowed = new Set(allowedFields);
  const unknownFields = Object.keys(input).filter(
    (field) => !allowed.has(field)
  );

  if (unknownFields.length > 0) {
    throw validationError(
      `Unsupported field(s): ${unknownFields.join(', ')}.`,
      undefined,
      'UNKNOWN_FIELD'
    );
  }

  return input;
}

function requireString(value, field, options = {}) {
  const {
    minLength = 1,
    maxLength = 255,
    trim = false,
    label = field,
  } = options;

  if (typeof value !== 'string') {
    throw validationError(
      `${label} must be a string.`,
      field,
      'INVALID_TYPE'
    );
  }

  if (
    !Number.isSafeInteger(minLength) ||
    !Number.isSafeInteger(maxLength) ||
    minLength < 0 ||
    maxLength < minLength
  ) {
    throw new TypeError('Invalid string length constraints.');
  }

  const normalized = trim ? value.trim() : value;

  if (normalized.length < minLength) {
    throw validationError(
      `${label} must be at least ${minLength} character(s).`,
      field,
      'OUT_OF_RANGE'
    );
  }

  if (normalized.length > maxLength) {
    throw validationError(
      `${label} must not exceed ${maxLength} characters.`,
      field,
      'OUT_OF_RANGE'
    );
  }

  return normalized;
}

function validatePassword(value, field = 'newPassword') {
  // Passwords are never trimmed, lowercased, or silently normalized.
  const password = requireString(value, field, {
    minLength: MIN_PASSWORD_LENGTH,
    maxLength: MAX_PASSWORD_LENGTH,
    trim: false,
    label: 'Password',
  });

  if (CONTROL_CHARACTERS_REGEX.test(password)) {
    throw validationError(
      'Password must not contain control characters.',
      field,
      'INVALID_FORMAT'
    );
  }

  return password;
}

function validateEmail(value) {
  const email = requireString(value, 'email', {
    minLength: 3,
    maxLength: MAX_EMAIL_LENGTH,
    trim: true,
    label: 'Email',
  }).toLowerCase();

  if (!EMAIL_REGEX.test(email)) {
    throw validationError(
      'Enter a valid email address.',
      'email',
      'INVALID_FORMAT'
    );
  }

  return email;
}

function validateConfirmation(value, expectedPassword) {
  const confirmation = requireString(value, 'confirmPassword', {
    minLength: MIN_PASSWORD_LENGTH,
    maxLength: MAX_PASSWORD_LENGTH,
    trim: false,
    label: 'Password confirmation',
  });

  if (confirmation !== expectedPassword) {
    throw validationError(
      'New password and confirmation do not match.',
      'confirmPassword',
      'PASSWORD_MISMATCH'
    );
  }

  return confirmation;
}

function validateChange(input) {
  const body = requireObject(input);
  rejectUnknownFields(body, ALLOWED_CHANGE_FIELDS);

  const currentPassword = requireString(
    body.currentPassword,
    'currentPassword',
    {
      minLength: 1,
      maxLength: MAX_PASSWORD_LENGTH,
      trim: false,
      label: 'Current password',
    }
  );

  if (CONTROL_CHARACTERS_REGEX.test(currentPassword)) {
    throw validationError(
      'Current password contains unsupported control characters.',
      'currentPassword',
      'INVALID_FORMAT'
    );
  }

  const newPassword = validatePassword(body.newPassword);
  validateConfirmation(body.confirmPassword, newPassword);

  if (currentPassword === newPassword) {
    throw validationError(
      'New password must be different from the current password.',
      'newPassword',
      'PASSWORD_UNCHANGED'
    );
  }

  return {
    currentPassword,
    newPassword,
  };
}

function validateResetRequest(input) {
  const body = requireObject(input);
  rejectUnknownFields(body, ALLOWED_RESET_REQUEST_FIELDS);

  return {
    email: validateEmail(body.email),
  };
}

function validateReset(input) {
  const body = requireObject(input);
  rejectUnknownFields(body, ALLOWED_RESET_FIELDS);

  const token = requireString(body.token, 'token', {
    minLength: 16,
    maxLength: MAX_TOKEN_LENGTH,
    trim: true,
    label: 'Password reset token',
  });

  if (CONTROL_CHARACTERS_REGEX.test(token)) {
    throw validationError(
      'Password reset token contains unsupported characters.',
      'token',
      'INVALID_FORMAT'
    );
  }

  const newPassword = validatePassword(body.newPassword);
  validateConfirmation(body.confirmPassword, newPassword);

  return {
    token,
    newPassword,
  };
}

function validate(input, mode = 'change') {
  switch (mode) {
    case 'change':
      return validateChange(input);

    case 'reset-request':
      return validateResetRequest(input);

    case 'reset':
      return validateReset(input);

    default:
      throw validationError(
        `Unsupported password validation mode: ${mode}.`,
        'mode',
        'INVALID_VALIDATION_MODE'
      );
  }
}

module.exports = {
  validate,
  validateChange,
  validateResetRequest,
  validateReset,
  validatePassword,
  validateEmail,
  ALLOWED_CHANGE_FIELDS,
  ALLOWED_RESET_REQUEST_FIELDS,
  ALLOWED_RESET_FIELDS,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
};