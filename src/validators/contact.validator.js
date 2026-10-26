
'use strict';

const ALLOWED_FIELDS = Object.freeze([
  'name',
  'email',
  'phone',
  'subject',
  'message',
  'category',
  'source',
]);

const ALLOWED_CATEGORIES = Object.freeze([
  'general',
  'admissions',
  'study_abroad',
  'career',
  'recruitment',
  'partnership',
  'technical_support',
  'feedback',
  'other',
]);

const ALLOWED_SOURCES = Object.freeze([
  'website',
  'email',
  'phone',
  'social_media',
  'referral',
  'other',
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+()\d\s.-]+$/;
const CONTROL_CHARACTERS_REGEX = /[\u0000-\u001F\u007F]/;

const LIMITS = Object.freeze({
  name: 100,
  email: 254,
  phone: 25,
  subject: 200,
  message: 10000,
  category: 40,
  source: 50,
  minNameLength: 2,
  minSubjectLength: 3,
  minMessageLength: 10,
  minPhoneDigits: 7,
  maxPhoneDigits: 15,
});

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

function normalizeString(value, field, maxLength) {
  if (typeof value !== 'string') {
    throw validationError(
      `${field} must be a string.`,
      'INVALID_TYPE',
      field
    );
  }

  const normalized = value.trim();

  if (CONTROL_CHARACTERS_REGEX.test(normalized)) {
    throw validationError(
      `${field} must not contain control characters.`,
      'INVALID_FORMAT',
      field
    );
  }

  if (normalized.length > maxLength) {
    throw validationError(
      `${field} must not exceed ${maxLength} characters.`,
      'OUT_OF_RANGE',
      field
    );
  }

  return normalized;
}

function validateEmail(value) {
  const email = normalizeString(
    value,
    'email',
    LIMITS.email
  ).toLowerCase();

  if (!email || !EMAIL_REGEX.test(email)) {
    throw validationError(
      'A valid email address is required.',
      'INVALID_EMAIL',
      'email'
    );
  }

  return email;
}

function validatePhone(value) {
  const phone = normalizeString(
    value,
    'phone',
    LIMITS.phone
  );

  if (!phone || !PHONE_REGEX.test(phone)) {
    throw validationError(
      'A valid phone number is required.',
      'INVALID_PHONE',
      'phone'
    );
  }

  const digits = phone.replace(/\D/g, '');

  if (
    digits.length < LIMITS.minPhoneDigits ||
    digits.length > LIMITS.maxPhoneDigits
  ) {
    throw validationError(
      `Phone number must contain between ${LIMITS.minPhoneDigits} and ${LIMITS.maxPhoneDigits} digits.`,
      'INVALID_PHONE',
      'phone'
    );
  }

  return phone;
}

function validateEnum(value, field, allowedValues, maxLength) {
  const normalized = normalizeString(
    value,
    field,
    maxLength
  ).toLowerCase();

  if (!allowedValues.includes(normalized)) {
    throw validationError(
      `${field} must be one of: ${allowedValues.join(', ')}.`,
      'INVALID_ENUM',
      field
    );
  }

  return normalized;
}

function validate(input = {}, options = {}) {
  const { partial = false } = options;
  const data = pickAllowed(input);

  if (Object.keys(data).length === 0) {
    throw validationError(
      'At least one supported field must be provided.',
      'EMPTY_INPUT'
    );
  }

  for (const field of [
    'name',
    'email',
    'phone',
    'subject',
    'message',
    'category',
    'source',
  ]) {
    if (data[field] === undefined) {
      continue;
    }

    data[field] = normalizeString(
      data[field],
      field,
      LIMITS[field]
    );
  }

  // Blank contact values are treated as omitted.
  if (data.email === '') {
    delete data.email;
  }

  if (data.phone === '') {
    delete data.phone;
  }

  if (data.name !== undefined) {
    if (
      data.name.length < LIMITS.minNameLength ||
      data.name.length > LIMITS.name
    ) {
      throw validationError(
        `name must contain between ${LIMITS.minNameLength} and ${LIMITS.name} characters.`,
        'INVALID_NAME',
        'name'
      );
    }
  }

  if (data.email !== undefined) {
    data.email = validateEmail(data.email);
  }

  if (data.phone !== undefined) {
    data.phone = validatePhone(data.phone);
  }

  if (data.subject !== undefined) {
    if (
      data.subject.length < LIMITS.minSubjectLength ||
      data.subject.length > LIMITS.subject
    ) {
      throw validationError(
        `subject must contain between ${LIMITS.minSubjectLength} and ${LIMITS.subject} characters.`,
        'INVALID_SUBJECT',
        'subject'
      );
    }
  }

  if (data.message !== undefined) {
    if (
      data.message.length < LIMITS.minMessageLength ||
      data.message.length > LIMITS.message
    ) {
      throw validationError(
        `message must contain between ${LIMITS.minMessageLength} and ${LIMITS.message} characters.`,
        'INVALID_MESSAGE',
        'message'
      );
    }
  }

  if (data.category !== undefined) {
    data.category = validateEnum(
      data.category,
      'category',
      ALLOWED_CATEGORIES,
      LIMITS.category
    );
  }

  if (data.source !== undefined) {
    data.source = validateEnum(
      data.source,
      'source',
      ALLOWED_SOURCES,
      LIMITS.source
    );
  }

  if (!partial) {
    for (const field of ['name', 'message']) {
      if (data[field] === undefined || data[field] === '') {
        throw validationError(
          `${field} is required.`,
          'REQUIRED_FIELD',
          field
        );
      }
    }

    if (data.email === undefined && data.phone === undefined) {
      throw validationError(
        'Either email or phone is required.',
        'CONTACT_REQUIRED'
      );
    }
  }

  return data;
}

function validateCreate(input) {
  return validate(input);
}

function validateUpdate(input) {
  return validate(input, { partial: true });
}

module.exports = {
  ALLOWED_FIELDS,
  ALLOWED_CATEGORIES,
  ALLOWED_SOURCES,
  LIMITS,
  pickAllowed,
  validate,
  validateCreate,
  validateUpdate,
  validateEmail,
  validatePhone,
};
