
'use strict';

const ALLOWED_FIELDS = Object.freeze([
  'name',
  'slug',
  'code',
  'category',
  'level',
  'duration',
  'description',
  'country_codes',
  'eligibility',
  'entrance_exams',
  'degree_awarded',
  'field_of_study',
  'career_options',
  'official_url',
  'status',
]);

const ALLOWED_CATEGORIES = Object.freeze([
  'medical',
  'dental',
  'ayush',
  'nursing',
  'pharmacy',
  'allied_health',
  'paramedical',
  'engineering',
  'management',
  'science',
  'arts',
  'commerce',
  'law',
  'education',
  'other',
]);

const ALLOWED_LEVELS = Object.freeze([
  'certificate',
  'diploma',
  'undergraduate',
  'postgraduate',
  'doctoral',
  'postdoctoral',
  'professional',
  'other',
]);

const ALLOWED_STATUSES = Object.freeze([
  'draft',
  'published',
  'inactive',
  'archived',
]);

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;
const CODE_REGEX = /^[A-Z0-9][A-Z0-9._-]*$/;
const CONTROL_CHARACTERS_REGEX = /[\u0000-\u001F\u007F]/;

const MAX_NAME_LENGTH = 200;
const MAX_SLUG_LENGTH = 200;
const MAX_CODE_LENGTH = 50;
const MAX_DURATION_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 15000;
const MAX_DEGREE_LENGTH = 200;
const MAX_FIELD_OF_STUDY_LENGTH = 200;
const MAX_COUNTRY_CODES = 100;
const MAX_LIST_ITEMS = 100;
const MAX_LIST_ITEM_LENGTH = 500;
const MAX_URL_LENGTH = 2048;

const LIST_FIELDS = Object.freeze([
  'eligibility',
  'entrance_exams',
  'career_options',
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

function validateEnum(value, field, allowedValues) {
  if (typeof value !== 'string') {
    throw validationError(
      `${field} must be a string.`,
      'INVALID_TYPE',
      field
    );
  }

  const normalized = value.trim().toLowerCase();

  if (CONTROL_CHARACTERS_REGEX.test(normalized)) {
    throw validationError(
      `${field} must not contain control characters.`,
      'INVALID_FORMAT',
      field
    );
  }

  if (!allowedValues.includes(normalized)) {
    throw validationError(
      `${field} must be one of: ${allowedValues.join(', ')}.`,
      'INVALID_ENUM',
      field
    );
  }

  return normalized;
}

function validateSlug(value) {
  const slug = value.toLowerCase();

  if (!SLUG_REGEX.test(slug)) {
    throw validationError(
      'slug must contain lowercase letters, numbers, and single hyphens between words.',
      'INVALID_SLUG',
      'slug'
    );
  }

  return slug;
}

function validateCode(value) {
  const code = value.toUpperCase();

  if (!CODE_REGEX.test(code)) {
    throw validationError(
      'code must start with a letter or number and contain only letters, numbers, dots, underscores, or hyphens.',
      'INVALID_CODE',
      'code'
    );
  }

  return code;
}

function validateCountryCode(value) {
  if (typeof value !== 'string') {
    throw validationError(
      'Each country code must be a two-letter country code.',
      'INVALID_TYPE',
      'country_codes'
    );
  }

  const normalized = value.trim().toUpperCase();

  if (!COUNTRY_CODE_REGEX.test(normalized)) {
    throw validationError(
      'Each country code must use the two-letter ISO country-code format.',
      'INVALID_COUNTRY_CODE',
      'country_codes'
    );
  }

  return normalized;
}

function validateCountryCodes(value) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_COUNTRY_CODES
  ) {
    throw validationError(
      `country_codes must be a non-empty array containing at most ${MAX_COUNTRY_CODES} entries.`,
      'INVALID_COUNTRY_CODES',
      'country_codes'
    );
  }

  const normalized = value.map(validateCountryCode);
  const unique = new Set(normalized);

  if (unique.size !== normalized.length) {
    throw validationError(
      'country_codes must not contain duplicates.',
      'DUPLICATE_VALUE',
      'country_codes'
    );
  }

  return normalized;
}

function validateStringArray(value, field) {
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) {
    throw validationError(
      `${field} must be an array containing at most ${MAX_LIST_ITEMS} entries.`,
      'INVALID_ARRAY',
      field
    );
  }

  const normalized = value.map((item, index) => {
    if (typeof item !== 'string') {
      throw validationError(
        `Each ${field} entry must be a string.`,
        'INVALID_TYPE',
        `${field}[${index}]`
      );
    }

    const text = item.trim();

    if (CONTROL_CHARACTERS_REGEX.test(text)) {
      throw validationError(
        `Each ${field} entry must not contain control characters.`,
        'INVALID_FORMAT',
        `${field}[${index}]`
      );
    }

    if (
      text.length < 1 ||
      text.length > MAX_LIST_ITEM_LENGTH
    ) {
      throw validationError(
        `Each ${field} entry must contain between 1 and ${MAX_LIST_ITEM_LENGTH} characters.`,
        'OUT_OF_RANGE',
        `${field}[${index}]`
      );
    }

    return text;
  });

  const seen = new Set();

  for (const item of normalized) {
    const key = item.toLowerCase();

    if (seen.has(key)) {
      throw validationError(
        `${field} must not contain duplicate entries.`,
        'DUPLICATE_VALUE',
        field
      );
    }

    seen.add(key);
  }

  return normalized;
}

function validateUrl(value, field) {
  if (typeof value !== 'string') {
    throw validationError(
      `${field} must be a URL string.`,
      'INVALID_TYPE',
      field
    );
  }

  const text = value.trim();

  if (
    text.length < 1 ||
    text.length > MAX_URL_LENGTH ||
    CONTROL_CHARACTERS_REGEX.test(text)
  ) {
    throw validationError(
      `${field} must be a valid URL no longer than ${MAX_URL_LENGTH} characters.`,
      'INVALID_URL',
      field
    );
  }

  let url;

  try {
    url = new URL(text);
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
      `${field} must have a hostname and must not contain embedded credentials.`,
      'INVALID_URL',
      field
    );
  }

  return url.toString();
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

  normalizeString(data, 'name', MAX_NAME_LENGTH, 2);
  normalizeString(data, 'slug', MAX_SLUG_LENGTH, 2);
  normalizeString(data, 'code', MAX_CODE_LENGTH, 1);
  normalizeString(data, 'duration', MAX_DURATION_LENGTH, 1);
  normalizeString(
    data,
    'description',
    MAX_DESCRIPTION_LENGTH
  );
  normalizeString(
    data,
    'degree_awarded',
    MAX_DEGREE_LENGTH
  );
  normalizeString(
    data,
    'field_of_study',
    MAX_FIELD_OF_STUDY_LENGTH
  );

  if (data.slug !== undefined) {
    data.slug = validateSlug(data.slug);
  }

  if (data.code !== undefined) {
    data.code = validateCode(data.code);
  }

  if (data.category !== undefined) {
    data.category = validateEnum(
      data.category,
      'category',
      ALLOWED_CATEGORIES
    );
  }

  if (data.level !== undefined) {
    data.level = validateEnum(
      data.level,
      'level',
      ALLOWED_LEVELS
    );
  }

  if (data.status !== undefined) {
    data.status = validateEnum(
      data.status,
      'status',
      ALLOWED_STATUSES
    );
  }

  if (data.country_codes !== undefined) {
    data.country_codes = validateCountryCodes(
      data.country_codes
    );
  }

  for (const field of LIST_FIELDS) {
    if (data[field] !== undefined) {
      data[field] = validateStringArray(data[field], field);
    }
  }

  if (data.official_url !== undefined) {
    if (data.official_url === null) {
      // Explicit null clears the URL.
      data.official_url = null;
    } else if (typeof data.official_url === 'string') {
      const urlText = data.official_url.trim();

      data.official_url = urlText === ''
        ? null
        : validateUrl(urlText, 'official_url');
    } else {
      throw validationError(
        'official_url must be a URL string or null.',
        'INVALID_TYPE',
        'official_url'
      );
    }
  }

  if (!partial) {
    for (const field of [
      'name',
      'slug',
      'category',
      'level',
      'duration',
      'country_codes',
    ]) {
      if (
        data[field] === undefined ||
        data[field] === '' ||
        (field === 'country_codes' &&
          (!Array.isArray(data[field]) || data[field].length === 0))
      ) {
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
  return validate(input);
}

function validateUpdate(input) {
  return validate(input, { partial: true });
}

module.exports = {
  ALLOWED_FIELDS,
  ALLOWED_CATEGORIES,
  ALLOWED_LEVELS,
  ALLOWED_STATUSES,
  pickAllowed,
  validate,
  validateCreate,
  validateUpdate,
  validateSlug,
  validateCode,
  validateCountryCode,
  validateCountryCodes,
  validateStringArray,
  validateUrl,
};
