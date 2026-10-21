
'use strict';

const ALLOWED_FIELDS = Object.freeze([
  'user_id',
  'organization_name',
  'slug',
  'organization_type',
  'registration_number',
  'industry',
  'website',
  'email',
  'phone',
  'description',
  'logo_document_id',
  'address',
  'city',
  'state',
  'country_code',
  'pincode',
  'employee_count',
  'status',
]);

const ALLOWED_ORGANIZATION_TYPES = Object.freeze([
  'company',
  'recruitment_agency',
  'educational_institution',
  'hospital',
  'clinic',
  'nonprofit',
  'government',
  'other',
]);

const ALLOWED_STATUSES = Object.freeze([
  'pending',
  'active',
  'inactive',
  'suspended',
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;
const PHONE_REGEX = /^[+()\d\s.-]+$/;
const CONTROL_CHARACTERS_REGEX = /[\u0000-\u001F\u007F]/;

const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_NAME_LENGTH = 200;
const MAX_SLUG_LENGTH = 200;
const MAX_EMAIL_LENGTH = 254;
const MAX_URL_LENGTH = 2048;
const MAX_PHONE_LENGTH = 25;
const MAX_EMPLOYEE_COUNT = 100000000;

const PROTECTED_FIELDS = Object.freeze([
  'user_id',
  'status',
]);

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

function normalizeString(
  data,
  field,
  maxLength,
  minLength = 0
) {
  if (data[field] === undefined) {
    return;
  }

  if (typeof data[field] !== 'string') {
    throw validationError(
      `${field} must be a string.`,
      'INVALID_TYPE',
      field
    );
  }

  const value = data[field].trim();

  if (CONTROL_CHARACTERS_REGEX.test(value)) {
    throw validationError(
      `${field} must not contain control characters.`,
      'INVALID_FORMAT',
      field
    );
  }

  if (
    value.length < minLength ||
    value.length > maxLength
  ) {
    throw validationError(
      `${field} must contain between ${minLength} and ${maxLength} characters.`,
      'OUT_OF_RANGE',
      field
    );
  }

  data[field] = value;
}

function validatePositiveId(value, field) {
  let id = value;

  if (typeof value === 'string') {
    const normalized = value.trim();

    if (!/^[1-9]\d*$/.test(normalized)) {
      throw validationError(
        `${field} must be a positive integer.`,
        'INVALID_ID',
        field
      );
    }

    id = Number(normalized);
  }

  if (!Number.isSafeInteger(id) || id < 1) {
    throw validationError(
      `${field} must be a positive integer.`,
      'INVALID_ID',
      field
    );
  }

  return id;
}

function validateEnum(value, field, allowedValues) {
  if (typeof value !== 'string') {
    throw validationError(
      `${field} must be a string.`,
      'INVALID_TYPE',
      field
    );
  }

  const normalized = value.trim().toLowerCase();

  if (!allowedValues.includes(normalized)) {
    throw validationError(
      `${field} must be one of: ${allowedValues.join(', ')}.`,
      'INVALID_ENUM',
      field
    );
  }

  return normalized;
}

function validateEmail(value) {
  const email = value.toLowerCase();

  if (
    email.length > MAX_EMAIL_LENGTH ||
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

function validateUrl(value, field) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw validationError(
      `${field} must be a valid absolute URL.`,
      'INVALID_URL',
      field
    );
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw validationError(
      `${field} must use HTTP or HTTPS.`,
      'INVALID_URL_PROTOCOL',
      field
    );
  }

  if (!url.hostname || url.username || url.password) {
    throw validationError(
      `${field} must contain a hostname and must not contain embedded credentials.`,
      'INVALID_URL',
      field
    );
  }

  return url.toString();
}

function validatePhone(value) {
  if (!PHONE_REGEX.test(value)) {
    throw validationError(
      'A valid phone number is required.',
      'INVALID_PHONE',
      'phone'
    );
  }

  const digits = value.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) {
    throw validationError(
      'Phone number must contain between 7 and 15 digits.',
      'INVALID_PHONE',
      'phone'
    );
  }

  return value;
}

function validateCountryCode(value) {
  const code = value.toUpperCase();

  if (!COUNTRY_CODE_REGEX.test(code)) {
    throw validationError(
      'country_code must be a two-letter country code.',
      'INVALID_COUNTRY_CODE',
      'country_code'
    );
  }

  return code;
}

function validate(input = {}, options = {}) {
  const {
    partial = false,
    mode = 'client',
  } = options;

  const data = pickAllowed(input);

  if (Object.keys(data).length === 0) {
    throw validationError(
      'At least one supported field must be provided.',
      'EMPTY_INPUT'
    );
  }

  if (mode !== 'client' && mode !== 'system') {
    throw validationError(
      'Unsupported validation mode.',
      'INVALID_VALIDATION_MODE',
      'mode'
    );
  }

  // Identity and lifecycle status are controlled by trusted workflows.
  if (mode === 'client') {
    for (const field of PROTECTED_FIELDS) {
      if (data[field] !== undefined) {
        throw validationError(
          `${field} is server-managed and cannot be supplied by clients.`,
          'PROTECTED_FIELD',
          field
        );
      }
    }
  }

  for (const [field, maxLength, minLength] of [
    ['organization_name', MAX_NAME_LENGTH, 2],
    ['slug', MAX_SLUG_LENGTH, 2],
    ['registration_number', 100, 1],
    ['industry', 100, 1],
    ['phone', MAX_PHONE_LENGTH, 0],
    ['address', 500, 1],
    ['city', 100, 1],
    ['state', 100, 1],
    ['pincode', 20, 1],
    ['description', MAX_DESCRIPTION_LENGTH, 0],
    ['website', MAX_URL_LENGTH, 1],
    ['email', MAX_EMAIL_LENGTH, 1],
  ]) {
    normalizeString(data, field, maxLength, minLength);
  }

  if (data.user_id !== undefined) {
    data.user_id = validatePositiveId(
      data.user_id,
      'user_id'
    );
  }

  if (data.logo_document_id !== undefined) {
    data.logo_document_id = validatePositiveId(
      data.logo_document_id,
      'logo_document_id'
    );
  }

  if (data.slug !== undefined) {
    data.slug = data.slug.toLowerCase();

    if (!SLUG_REGEX.test(data.slug)) {
      throw validationError(
        'slug must contain lowercase letters, numbers, and single hyphens.',
        'INVALID_SLUG',
        'slug'
      );
    }
  }

  if (data.organization_type !== undefined) {
    data.organization_type = validateEnum(
      data.organization_type,
      'organization_type',
      ALLOWED_ORGANIZATION_TYPES
    );
  }

  if (data.website !== undefined && data.website !== '') {
    data.website = validateUrl(data.website, 'website');
  }

  if (data.email !== undefined) {
    data.email = validateEmail(data.email);
  }

  if (data.phone !== undefined && data.phone !== '') {
    data.phone = validatePhone(data.phone);
  }

  if (data.country_code !== undefined) {
    data.country_code = validateCountryCode(
      data.country_code
    );
  }

  if (data.pincode !== undefined) {
    if (!/^[A-Za-z0-9][A-Za-z0-9\s-]*$/.test(data.pincode)) {
      throw validationError(
        'pincode contains unsupported characters.',
        'INVALID_PINCODE',
        'pincode'
      );
    }
  }

  if (data.employee_count !== undefined) {
    if (
      !Number.isSafeInteger(data.employee_count) ||
      data.employee_count < 0 ||
      data.employee_count > MAX_EMPLOYEE_COUNT
    ) {
      throw validationError(
        `employee_count must be an integer between 0 and ${MAX_EMPLOYEE_COUNT}.`,
        'INVALID_EMPLOYEE_COUNT',
        'employee_count'
      );
    }
  }

  if (data.status !== undefined) {
    data.status = validateEnum(
      data.status,
      'status',
      ALLOWED_STATUSES
    );

    if (
      mode === 'client' &&
      ['active', 'suspended'].includes(data.status)
    ) {
      throw validationError(
        `status "${data.status}" can only be changed through an authorized administrative workflow.`,
        'PROTECTED_FIELD',
        'status'
      );
    }
  }

  if (!partial) {
    for (const field of [
      'organization_name',
      'organization_type',
      'email',
      'country_code',
    ]) {
      if (data[field] === undefined || data[field] === '') {
        throw validationError(
          `${field} is required.`,
          'REQUIRED_FIELD',
          field
        );
      }
    }
  }

  return data;
}

function validateCreate(input) {
  return validate(input, {
    partial: false,
    mode: 'client',
  });
}

function validateUpdate(input) {
  return validate(input, {
    partial: true,
    mode: 'client',
  });
}

function validateSystemCreate(input) {
  return validate(input, {
    partial: false,
    mode: 'system',
  });
}

function validateSystemUpdate(input) {
  return validate(input, {
    partial: true,
    mode: 'system',
  });
}

module.exports = {
  ALLOWED_FIELDS,
  ALLOWED_ORGANIZATION_TYPES,
  ALLOWED_STATUSES,
  PROTECTED_FIELDS,
  pickAllowed,
  validate,
  validateCreate,
  validateUpdate,
  validateSystemCreate,
  validateSystemUpdate,
  validateEmail,
  validatePhone,
  validateUrl,
  validateCountryCode,
  validatePositiveId,
};
