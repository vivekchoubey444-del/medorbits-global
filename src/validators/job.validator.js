'use strict';

const ALLOWED_FIELDS = Object.freeze([
  'employer_id',
  'title',
  'slug',
  'description',
  'responsibilities',
  'requirements',
  'employment_type',
  'work_mode',
  'experience_min',
  'experience_max',
  'education_level',
  'skills',
  'location',
  'city',
  'state',
  'country_code',
  'salary_min',
  'salary_max',
  'salary_currency',
  'vacancies',
  'application_deadline',
  'status',
]);

const ALLOWED_EMPLOYMENT_TYPES = Object.freeze([
  'full_time',
  'part_time',
  'contract',
  'temporary',
  'internship',
  'freelance',
  'apprenticeship',
]);

const ALLOWED_WORK_MODES = Object.freeze([
  'onsite',
  'remote',
  'hybrid',
]);

const ALLOWED_EDUCATION_LEVELS = Object.freeze([
  'high_school',
  'certificate',
  'diploma',
  'undergraduate',
  'postgraduate',
  'doctoral',
  'professional',
  'other',
]);

const ALLOWED_STATUSES = Object.freeze([
  'draft',
  'published',
  'paused',
  'closed',
  'archived',
]);

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CONTROL_CHARACTERS_REGEX = /[\u0000-\u001F\u007F]/;

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 15000;
const MAX_LIST_ITEMS = 100;
const MAX_LIST_ITEM_LENGTH = 500;
const MAX_SLUG_LENGTH = 200;
const MAX_LOCATION_LENGTH = 200;
const MAX_CITY_STATE_LENGTH = 100;
const MAX_EXPERIENCE_YEARS = 70;
const MAX_SALARY = 1000000000000;
const MAX_VACANCIES = 100000;

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

  return prototype === Object.prototype || prototype === null;
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

  // Null-prototype object prevents special-key assignment hazards.
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
  minLength = 0,
  options = {}
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

  data[field] = options.lowercase
    ? value.toLowerCase()
    : options.uppercase
      ? value.toUpperCase()
      : value;
}

function validateEnum(data, field, allowedValues) {
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

  const value = data[field].trim().toLowerCase();

  if (!allowedValues.includes(value)) {
    throw validationError(
      `${field} must be one of: ${allowedValues.join(', ')}.`,
      'INVALID_ENUM',
      field
    );
  }

  data[field] = value;
}

function validateDate(value, field) {
  if (
    typeof value !== 'string' ||
    !DATE_ONLY_REGEX.test(value)
  ) {
    throw validationError(
      `${field} must use YYYY-MM-DD format.`,
      'INVALID_DATE',
      field
    );
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw validationError(
      `${field} must be a valid calendar date.`,
      'INVALID_DATE',
      field
    );
  }

  return value;
}

function validateStringArray(data, field) {
  if (data[field] === undefined) {
    return;
  }

  if (
    !Array.isArray(data[field]) ||
    data[field].length > MAX_LIST_ITEMS
  ) {
    throw validationError(
      `${field} must be an array containing at most ${MAX_LIST_ITEMS} entries.`,
      'INVALID_TYPE',
      field
    );
  }

  const values = data[field].map((item, index) => {
    if (typeof item !== 'string') {
      throw validationError(
        `Each ${field} entry must be a string.`,
        'INVALID_TYPE',
        `${field}[${index}]`
      );
    }

    const value = item.trim();

    if (
      value.length < 1 ||
      value.length > MAX_LIST_ITEM_LENGTH
    ) {
      throw validationError(
        `Each ${field} entry must contain between 1 and ${MAX_LIST_ITEM_LENGTH} characters.`,
        'OUT_OF_RANGE',
        `${field}[${index}]`
      );
    }

    if (CONTROL_CHARACTERS_REGEX.test(value)) {
      throw validationError(
        `Each ${field} entry must not contain control characters.`,
        'INVALID_FORMAT',
        `${field}[${index}]`
      );
    }

    return value;
  });

  const normalized = values.map((item) => item.toLowerCase());

  if (new Set(normalized).size !== normalized.length) {
    throw validationError(
      `${field} must not contain duplicate entries.`,
      'DUPLICATE_VALUE',
      field
    );
  }

  data[field] = values;
}

function validatePositiveId(value, field) {
  let id = value;

  if (typeof value === 'string') {
    const normalized = value.trim();

    if (!/^[1-9]\d*$/.test(normalized)) {
      throw validationError(
        `${field} must be a positive integer.`,
        'INVALID_FORMAT',
        field
      );
    }

    id = Number(normalized);
  }

  if (!Number.isSafeInteger(id) || id < 1) {
    throw validationError(
      `${field} must be a positive integer.`,
      'OUT_OF_RANGE',
      field
    );
  }

  return id;
}

function validateNumber(
  value,
  field,
  {
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    integer = false,
  } = {}
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw validationError(
      `${field} must be a finite number.`,
      'INVALID_TYPE',
      field
    );
  }

  if (integer && !Number.isSafeInteger(value)) {
    throw validationError(
      `${field} must be an integer.`,
      'INVALID_TYPE',
      field
    );
  }

  if (value < min || value > max) {
    throw validationError(
      `${field} must be between ${min} and ${max}.`,
      'OUT_OF_RANGE',
      field
    );
  }

  return value;
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

  normalizeString(data, 'title', MAX_TITLE_LENGTH, 3);
  normalizeString(data, 'slug', MAX_SLUG_LENGTH, 2, {
    lowercase: true,
  });
  normalizeString(
    data,
    'description',
    MAX_DESCRIPTION_LENGTH,
    20
  );
  normalizeString(
    data,
    'location',
    MAX_LOCATION_LENGTH,
    1
  );
  normalizeString(
    data,
    'city',
    MAX_CITY_STATE_LENGTH,
    1
  );
  normalizeString(
    data,
    'state',
    MAX_CITY_STATE_LENGTH,
    1
  );

  if (data.employer_id !== undefined) {
    data.employer_id = validatePositiveId(
      data.employer_id,
      'employer_id'
    );
  }

  if (data.slug !== undefined && !SLUG_REGEX.test(data.slug)) {
    throw validationError(
      'slug must contain lowercase letters, numbers, and single hyphens.',
      'INVALID_SLUG',
      'slug'
    );
  }

  validateEnum(
    data,
    'employment_type',
    ALLOWED_EMPLOYMENT_TYPES
  );
  validateEnum(data, 'work_mode', ALLOWED_WORK_MODES);
  validateEnum(
    data,
    'education_level',
    ALLOWED_EDUCATION_LEVELS
  );
  validateEnum(data, 'status', ALLOWED_STATUSES);

  if (data.country_code !== undefined) {
    if (typeof data.country_code !== 'string') {
      throw validationError(
        'country_code must be a string.',
        'INVALID_TYPE',
        'country_code'
      );
    }

    data.country_code = data.country_code.trim().toUpperCase();

    if (!COUNTRY_CODE_REGEX.test(data.country_code)) {
      throw validationError(
        'country_code must be a two-letter country code.',
        'INVALID_FORMAT',
        'country_code'
      );
    }
  }

  if (data.salary_currency !== undefined) {
    if (typeof data.salary_currency !== 'string') {
      throw validationError(
        'salary_currency must be a string.',
        'INVALID_TYPE',
        'salary_currency'
      );
    }

    data.salary_currency = data.salary_currency.trim().toUpperCase();

    if (!CURRENCY_REGEX.test(data.salary_currency)) {
      throw validationError(
        'salary_currency must be a three-letter currency code.',
        'INVALID_FORMAT',
        'salary_currency'
      );
    }
  }

  for (const field of ['experience_min', 'experience_max']) {
    if (data[field] !== undefined) {
      data[field] = validateNumber(data[field], field, {
        min: 0,
        max: MAX_EXPERIENCE_YEARS,
      });
    }
  }

  if (
    data.experience_min !== undefined &&
    data.experience_max !== undefined &&
    data.experience_min > data.experience_max
  ) {
    throw validationError(
      'experience_min cannot exceed experience_max.',
      'INVALID_RANGE',
      'experience_min'
    );
  }

  for (const field of ['salary_min', 'salary_max']) {
    if (data[field] !== undefined) {
      data[field] = validateNumber(data[field], field, {
        min: 0,
        max: MAX_SALARY,
      });
    }
  }

  if (
    data.salary_min !== undefined &&
    data.salary_max !== undefined &&
    data.salary_min > data.salary_max
  ) {
    throw validationError(
      'salary_min cannot exceed salary_max.',
      'INVALID_RANGE',
      'salary_min'
    );
  }

  if (
    (data.salary_min !== undefined || data.salary_max !== undefined) &&
    data.salary_currency === undefined
  ) {
    throw validationError(
      'salary_currency is required when a salary range is provided.',
      'REQUIRED_FIELD',
      'salary_currency'
    );
  }

  if (data.vacancies !== undefined) {
    data.vacancies = validateNumber(data.vacancies, 'vacancies', {
      min: 1,
      max: MAX_VACANCIES,
      integer: true,
    });
  }

  validateStringArray(data, 'responsibilities');
  validateStringArray(data, 'requirements');
  validateStringArray(data, 'skills');

  if (
    data.application_deadline !== undefined &&
    data.application_deadline !== null
  ) {
    data.application_deadline = validateDate(
      data.application_deadline,
      'application_deadline'
    );
  }

  if (!partial) {
    for (const field of [
      'title',
      'description',
      'employment_type',
      'work_mode',
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
  return validate(input);
}

function validateUpdate(input) {
  return validate(input, { partial: true });
}

module.exports = {
  ALLOWED_FIELDS,
  ALLOWED_EMPLOYMENT_TYPES,
  ALLOWED_WORK_MODES,
  ALLOWED_EDUCATION_LEVELS,
  ALLOWED_STATUSES,
  pickAllowed,
  validate,
  validateCreate,
  validateUpdate,
  validateDate,
  validatePositiveId,
};