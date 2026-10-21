'use strict';

const ALLOWED_CREATE_FIELDS = Object.freeze([
  'name',
  'first_name',
  'last_name',
  'email',
  'password',
  'phone',
  'role',
  'status',
  'preferred_language',
  'country_code',
]);

const ALLOWED_UPDATE_FIELDS = Object.freeze([
  'name',
  'first_name',
  'last_name',
  'email',
  'phone',
  'preferred_language',
  'country_code',
  'profile_image_url',
]);

const ALLOWED_QUERY_FIELDS = Object.freeze([
  'page',
  'limit',
  'search',
  'role',
  'status',
  'country_code',
]);

const USER_ROLES = Object.freeze([
  'student',
  'candidate',
  'employer',
  'counsellor',
  'consultant',
  'recruiter',
  'admin',
  'super_admin',
]);

const USER_STATUSES = Object.freeze([
  'pending',
  'active',
  'inactive',
  'suspended',
]);

const SUPPORTED_LANGUAGES = Object.freeze([
  'en', 'hi', 'bn', 'as', 'ne', 'mr', 'gu', 'pa', 'ur', 'or',
  'ps', 'fa', 'fr', 'de', 'es', 'zh', 'ar', 'ru', 'ka', 'kk',
  'uz', 'ky',
]);

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 128;
const MAX_PHONE_LENGTH = 30;
const MAX_SEARCH_LENGTH = 200;
const MAX_PROFILE_IMAGE_URL_LENGTH = 2048;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+0-9().\-\s]+$/;
const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;
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
      label === 'Query parameters' ? 'query' : 'body',
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
}

function requireString(value, field, options = {}) {
  const {
    minLength = 1,
    maxLength = 255,
    trim = true,
    allowEmpty = false,
  } = options;

  if (typeof value !== 'string') {
    throw validationError(
      `${field} must be a string.`,
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

  const result = trim ? value.trim() : value;

  if (!allowEmpty && result.length === 0) {
    throw validationError(
      `${field} is required.`,
      field,
      'REQUIRED_FIELD'
    );
  }

  if (result.length < minLength || result.length > maxLength) {
    throw validationError(
      `${field} must contain between ${minLength} and ${maxLength} characters.`,
      field,
      'OUT_OF_RANGE'
    );
  }

  return result;
}

function validateName(value, field = 'name') {
  const name = requireString(value, field, {
    minLength: 2,
    maxLength: MAX_NAME_LENGTH,
  });

  if (CONTROL_CHARACTERS_REGEX.test(name)) {
    throw validationError(
      `${field} contains unsupported control characters.`,
      field,
      'INVALID_FORMAT'
    );
  }

  return name;
}

function validateEmail(value) {
  const email = requireString(value, 'email', {
    minLength: 3,
    maxLength: MAX_EMAIL_LENGTH,
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

function validatePassword(value) {
  // Do not trim, lowercase, or otherwise normalize passwords.
  const password = requireString(value, 'password', {
    minLength: 12,
    maxLength: MAX_PASSWORD_LENGTH,
    trim: false,
  });

  if (CONTROL_CHARACTERS_REGEX.test(password)) {
    throw validationError(
      'Password must not contain control characters.',
      'password',
      'INVALID_FORMAT'
    );
  }

  return password;
}

function validatePhone(value) {
  const phone = requireString(value, 'phone', {
    minLength: 5,
    maxLength: MAX_PHONE_LENGTH,
  });

  if (!PHONE_REGEX.test(phone)) {
    throw validationError(
      'phone contains unsupported characters.',
      'phone',
      'INVALID_FORMAT'
    );
  }

  const digits = phone.replace(/\D/g, '');

  if (digits.length < 5 || digits.length > 15) {
    throw validationError(
      'phone must contain between 5 and 15 digits.',
      'phone',
      'OUT_OF_RANGE'
    );
  }

  return phone;
}

function validateCountryCode(value) {
  const code = requireString(value, 'country_code', {
    minLength: 2,
    maxLength: 2,
  }).toUpperCase();

  if (!COUNTRY_CODE_REGEX.test(code)) {
    throw validationError(
      'country_code must be a two-letter ISO country code.',
      'country_code',
      'INVALID_FORMAT'
    );
  }

  return code;
}

function validateLanguage(value) {
  const language = requireString(value, 'preferred_language', {
    minLength: 2,
    maxLength: 5,
  }).toLowerCase();

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw validationError(
      `preferred_language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}.`,
      'preferred_language',
      'INVALID_ENUM'
    );
  }

  return language;
}

function validateEnum(value, field, allowedValues) {
  const normalized = requireString(value, field, {
    minLength: 1,
    maxLength: 40,
  }).toLowerCase();

  if (!allowedValues.includes(normalized)) {
    throw validationError(
      `${field} must be one of: ${allowedValues.join(', ')}.`,
      field,
      'INVALID_ENUM'
    );
  }

  return normalized;
}

function validateProfileImageUrl(value) {
  const raw = requireString(value, 'profile_image_url', {
    minLength: 1,
    maxLength: MAX_PROFILE_IMAGE_URL_LENGTH,
  });

  let url;

  try {
    url = new URL(raw);
  } catch {
    throw validationError(
      'profile_image_url must be a valid URL.',
      'profile_image_url',
      'INVALID_FORMAT'
    );
  }

  if (url.protocol !== 'https:') {
    throw validationError(
      'profile_image_url must use HTTPS.',
      'profile_image_url',
      'INVALID_FORMAT'
    );
  }

  if (!url.hostname || url.username || url.password) {
    throw validationError(
      'profile_image_url must have a hostname and must not contain embedded credentials.',
      'profile_image_url',
      'INVALID_FORMAT'
    );
  }

  return url.toString();
}

function validateCreate(input) {
  const body = requireObject(input);
  rejectUnknownFields(body, ALLOWED_CREATE_FIELDS);

  if (body.email === undefined) {
    throw validationError(
      'email is required.',
      'email',
      'REQUIRED_FIELD'
    );
  }

  if (body.password === undefined) {
    throw validationError(
      'password is required.',
      'password',
      'REQUIRED_FIELD'
    );
  }

  const result = {
    email: validateEmail(body.email),
    password: validatePassword(body.password),
  };

  if (body.name !== undefined) {
    result.name = validateName(body.name);
  }

  if (body.first_name !== undefined) {
    result.first_name = validateName(body.first_name, 'first_name');
  }

  if (body.last_name !== undefined) {
    result.last_name = validateName(body.last_name, 'last_name');
  }

  if (result.name === undefined) {
    if (!result.first_name || !result.last_name) {
      throw validationError(
        'Provide name or both first_name and last_name.',
        'name',
        'REQUIRED_FIELD'
      );
    }
  }

  if (body.phone !== undefined) {
    result.phone = validatePhone(body.phone);
  }

  // Roles and statuses are assigned by trusted server-side logic.
  // Do not let public registration assign privileges or account state.
  if (body.role !== undefined) {
    throw validationError(
      'role cannot be assigned through public user creation.',
      'role',
      'FIELD_NOT_ALLOWED'
    );
  }

  if (body.status !== undefined) {
    throw validationError(
      'status is managed by the server.',
      'status',
      'FIELD_NOT_ALLOWED'
    );
  }

  if (body.preferred_language !== undefined) {
    result.preferred_language = validateLanguage(
      body.preferred_language
    );
  }

  if (body.country_code !== undefined) {
    result.country_code = validateCountryCode(body.country_code);
  }

  return result;
}

function validateUpdate(input) {
  const body = requireObject(input);
  rejectUnknownFields(body, ALLOWED_UPDATE_FIELDS);

  if (Object.keys(body).length === 0) {
    throw validationError(
      'Provide at least one supported field to update.',
      undefined,
      'EMPTY_UPDATE'
    );
  }

  const result = {};

  if (body.name !== undefined) {
    result.name = validateName(body.name);
  }

  if (body.first_name !== undefined) {
    result.first_name = validateName(body.first_name, 'first_name');
  }

  if (body.last_name !== undefined) {
    result.last_name = validateName(body.last_name, 'last_name');
  }

  if (body.email !== undefined) {
    result.email = validateEmail(body.email);
  }

  if (body.phone !== undefined) {
    result.phone = validatePhone(body.phone);
  }

  if (body.preferred_language !== undefined) {
    result.preferred_language = validateLanguage(
      body.preferred_language
    );
  }

  if (body.country_code !== undefined) {
    result.country_code = validateCountryCode(body.country_code);
  }

  if (body.profile_image_url !== undefined) {
    result.profile_image_url = validateProfileImageUrl(
      body.profile_image_url
    );
  }

  return result;
}

function parseBoundedInteger(value, field, min, max) {
  let text;

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw validationError(
        `${field} must be a safe integer.`,
        field,
        'INVALID_TYPE'
      );
    }

    text = String(value);
  } else if (typeof value === 'string') {
    text = value;
  } else {
    throw validationError(
      `${field} must be an integer.`,
      field,
      'INVALID_TYPE'
    );
  }

  // Reject whitespace, signs, decimals, exponents and empty values.
  if (!/^\d+$/.test(text)) {
    throw validationError(
      `${field} must be an integer.`,
      field,
      'INVALID_FORMAT'
    );
  }

  const number = Number(text);

  if (
    !Number.isSafeInteger(number) ||
    number < min ||
    number > max
  ) {
    throw validationError(
      `${field} must be between ${min} and ${max}.`,
      field,
      'OUT_OF_RANGE'
    );
  }

  return number;
}

function validateQuery(input) {
  const query = requireObject(input, 'Query parameters');
  rejectUnknownFields(query, ALLOWED_QUERY_FIELDS);

  const result = {};

  if (query.page !== undefined) {
    result.page = parseBoundedInteger(
      query.page,
      'page',
      1,
      1000000
    );
  }

  if (query.limit !== undefined) {
    result.limit = parseBoundedInteger(
      query.limit,
      'limit',
      1,
      100
    );
  }

  if (query.search !== undefined) {
    result.search = requireString(query.search, 'search', {
      minLength: 1,
      maxLength: MAX_SEARCH_LENGTH,
    });
  }

  if (query.role !== undefined) {
    result.role = validateEnum(query.role, 'role', USER_ROLES);
  }

  if (query.status !== undefined) {
    result.status = validateEnum(
      query.status,
      'status',
      USER_STATUSES
    );
  }

  if (query.country_code !== undefined) {
    result.country_code = validateCountryCode(query.country_code);
  }

  return result;
}

function validate(input, mode = 'create') {
  switch (mode) {
    case 'create':
      return validateCreate(input);

    case 'update':
      return validateUpdate(input);

    case 'query':
      return validateQuery(input);

    default:
      throw validationError(
        `Unsupported user validation mode: ${mode}.`,
        'mode',
        'INVALID_VALIDATION_MODE'
      );
  }
}

module.exports = {
  validate,
  validateCreate,
  validateUpdate,
  validateQuery,
  validateName,
  validateEmail,
  validatePassword,
  validatePhone,
  validateCountryCode,
  validateLanguage,
  validateProfileImageUrl,
  USER_ROLES,
  USER_STATUSES,
  SUPPORTED_LANGUAGES,
  ALLOWED_CREATE_FIELDS,
  ALLOWED_UPDATE_FIELDS,
  ALLOWED_QUERY_FIELDS,
};