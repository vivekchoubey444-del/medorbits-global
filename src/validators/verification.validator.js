
'use strict';

const ALLOWED_FIELDS = Object.freeze([
  'email',
  'phone',
  'code',
  'purpose',
]);

const ALLOWED_PURPOSES = Object.freeze([
  'registration',
  'login',
  'password_reset',
  'email_verification',
  'phone_verification',
]);

const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 30;
const MIN_PHONE_DIGITS = 5;
const MAX_PHONE_DIGITS = 15;
const MIN_CODE_LENGTH = 4;
const MAX_CODE_LENGTH = 8;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+0-9().\-\s]+$/;
const CODE_REGEX = /^\d{4,8}$/;
const CONTROL_CHARACTERS_REGEX = /[\u0000-\u001F\u007F]/;

function validationError(
  message,
  code = 'VALIDATION_ERROR',
  field
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

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

function pickAllowed(input = {}) {
  if (!isPlainObject(input)) {
    throw validationError(
      'Request body must be a plain JSON object.',
      'INVALID_BODY',
      'body'
    );
  }

  const unknownFields = Object.keys(input).filter(
    (field) => !ALLOWED_FIELDS.includes(field)
  );

  if (unknownFields.length > 0) {
    throw validationError(
      `Unsupported field(s): ${unknownFields.join(', ')}.`,
      'UNKNOWN_FIELDS'
    );
  }

  const output = Object.create(null);

  for (const field of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      output[field] = input[field];
    }
  }

  return output;
}

function validateEmail(value) {
  if (typeof value !== 'string') {
    throw validationError(
      'A valid email address is required.',
      'INVALID_EMAIL',
      'email'
    );
  }

  const email = value.trim().toLowerCase();

  if (
    email.length === 0 ||
    email.length > MAX_EMAIL_LENGTH ||
    CONTROL_CHARACTERS_REGEX.test(email) ||
    !EMAIL_REGEX.test(email)
  ) {
    throw validationError(
      'A valid email address is required.',
      'INVALID_EMAIL',
      'email'
    );
  }

  return email;
}

function validatePhone(value) {
  if (typeof value !== 'string') {
    throw validationError(
      'A valid phone number is required.',
      'INVALID_PHONE',
      'phone'
    );
  }

  const phone = value.trim();

  if (
    phone.length < 5 ||
    phone.length > MAX_PHONE_LENGTH ||
    CONTROL_CHARACTERS_REGEX.test(phone) ||
    !PHONE_REGEX.test(phone)
  ) {
    throw validationError(
      'A valid phone number is required.',
      'INVALID_PHONE',
      'phone'
    );
  }

  const digits = phone.replace(/\D/g, '');

  if (
    digits.length < MIN_PHONE_DIGITS ||
    digits.length > MAX_PHONE_DIGITS
  ) {
    throw validationError(
      `Phone number must contain between ${MIN_PHONE_DIGITS} and ${MAX_PHONE_DIGITS} digits.`,
      'INVALID_PHONE',
      'phone'
    );
  }

  return phone;
}

function validateCode(value) {
  if (typeof value !== 'string') {
    throw validationError(
      'Verification code must be a string.',
      'INVALID_CODE',
      'code'
    );
  }

  // Do not coerce numeric input or remove internal characters.
  // Preserve leading zeroes in verification codes.
  const code = value.trim();

  if (
    code.length < MIN_CODE_LENGTH ||
    code.length > MAX_CODE_LENGTH ||
    !CODE_REGEX.test(code)
  ) {
    throw validationError(
      `Verification code must contain ${MIN_CODE_LENGTH} to ${MAX_CODE_LENGTH} digits.`,
      'INVALID_CODE',
      'code'
    );
  }

  return code;
}

function validatePurpose(value) {
  if (typeof value !== 'string') {
    throw validationError(
      'A valid verification purpose is required.',
      'INVALID_PURPOSE',
      'purpose'
    );
  }

  const purpose = value.trim().toLowerCase();

  if (!ALLOWED_PURPOSES.includes(purpose)) {
    throw validationError(
      `purpose must be one of: ${ALLOWED_PURPOSES.join(', ')}.`,
      'INVALID_PURPOSE',
      'purpose'
    );
  }

  return purpose;
}

function validate(input = {}, options = {}) {
  const {
    requireCode = false,
    requirePurpose = false,
  } = options;

  const data = pickAllowed(input);

  if (data.email !== undefined) {
    data.email = validateEmail(data.email);
  }

  if (data.phone !== undefined) {
    data.phone = validatePhone(data.phone);
  }

  if (data.code !== undefined) {
    data.code = validateCode(data.code);
  }

  if (data.purpose !== undefined) {
    data.purpose = validatePurpose(data.purpose);
  }

  if (data.email === undefined && data.phone === undefined) {
    throw validationError(
      'Provide an email address or phone number.',
      'IDENTIFIER_REQUIRED'
    );
  }

  if (data.email !== undefined && data.phone !== undefined) {
    throw validationError(
      'Provide either email or phone, not both.',
      'IDENTIFIER_CONFLICT'
    );
  }

  if (requireCode && data.code === undefined) {
    throw validationError(
      'Verification code is required.',
      'CODE_REQUIRED',
      'code'
    );
  }

  if (requirePurpose && data.purpose === undefined) {
    throw validationError(
      'Verification purpose is required.',
      'PURPOSE_REQUIRED',
      'purpose'
    );
  }

  return data;
}

function validateSendCode(input = {}) {
  const data = validate(input, {
    requirePurpose: true,
  });

  if (data.code !== undefined) {
    throw validationError(
      'Do not include a verification code when requesting a code.',
      'UNEXPECTED_CODE',
      'code'
    );
  }

  return data;
}

function validateVerifyCode(input = {}) {
  return validate(input, {
    requireCode: true,
    requirePurpose: true,
  });
}

module.exports = {
  ALLOWED_FIELDS,
  ALLOWED_PURPOSES,
  pickAllowed,
  validate,
  validateEmail,
  validatePhone,
  validateCode,
  validatePurpose,
  validateSendCode,
  validateVerifyCode,
};
