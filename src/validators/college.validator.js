'use strict';

const ALLOWED_FIELDS = Object.freeze([
  'name',
  'slug',
  'code',
  'college_type',
  'country_code',
  'state',
  'city',
  'address',
  'pincode',
  'website',
  'email',
  'phone',
  'university_id',
  'courses',
  'accreditation',
  'established_year',
  'description',
  'status',
]);

const ALLOWED_TYPES = Object.freeze([
  'government',
  'private',
  'deemed',
  'autonomous',
  'public',
  'other',
]);

const ALLOWED_STATUSES = Object.freeze([
  'draft',
  'published',
  'inactive',
  'archived',
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;
const PHONE_REGEX = /^[+()\d\s.-]+$/;

const MAX_NAME_LENGTH = 200;
const MAX_SLUG_LENGTH = 200;
const MAX_CODE_LENGTH = 50;
const MAX_LOCATION_LENGTH = 200;
const MIN_PINCODE_LENGTH = 3;
const MAX_PINCODE_LENGTH = 12;
const MAX_WEBSITE_LENGTH = 2048;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 25;
const MAX_COURSES = 500;
const MAX_ACCREDITATION_ENTRIES = 50;
const MAX_ACCREDITATION_LENGTH = 200;
const MIN_ESTABLISHED_YEAR = 1500;
const MAX_DESCRIPTION_LENGTH = 10000;

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

function validationError(message, code = 'VALIDATION_ERROR') {
  const error = new Error(message);

  error.status = 400;
  error.code = code;
  error.publicMessage = message;

  return error;
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function pickAllowed(input = {}) {
  if (!isPlainObject(input)) {
    throw validationError(
      'Request body must be a JSON object.',
      'INVALID_BODY'
    );
  }

  const unknownFields = Object.keys(input).filter(
    (key) => !ALLOWED_FIELDS.includes(key)
  );

  if (unknownFields.length > 0) {
    throw validationError(
      `Unsupported field(s): ${unknownFields.join(', ')}.`,
      'UNKNOWN_FIELDS'
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

function normalizeString(data, field, options = {}) {
  const {
    maxLength,
    minLength = 0,
    lowercase = false,
    uppercase = false,
    allowEmpty = true,
  } = options;

  if (data[field] === undefined) {
    return;
  }

  if (typeof data[field] !== 'string') {
    throw validationError(`${field} must be a string.`);
  }

  let value = data[field].trim();

  if (lowercase) {
    value = value.toLowerCase();
  }

  if (uppercase) {
    value = value.toUpperCase();
  }

  if (!allowEmpty && value.length === 0) {
    throw validationError(`${field} must not be empty.`);
  }

  if (value.length < minLength || value.length > maxLength) {
    throw validationError(
      `${field} must contain between ${minLength} and ${maxLength} characters.`
    );
  }

  data[field] = value;
}

function validateWebsite(value) {
  if (value === '') {
    return value;
  }

  if (value.length > MAX_WEBSITE_LENGTH) {
    throw validationError(
      `website must not exceed ${MAX_WEBSITE_LENGTH} characters.`
    );
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    throw validationError('website must be a valid URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw validationError('website must use HTTP or HTTPS.');
  }

  if (!url.hostname || url.username || url.password) {
    throw validationError(
      'website must contain a valid hostname and must not include credentials.'
    );
  }

  return url.toString();
}

function validateAccreditation(value) {
  if (!Array.isArray(value) || value.length > MAX_ACCREDITATION_ENTRIES) {
    throw validationError(
      `accreditation must be an array containing at most ${MAX_ACCREDITATION_ENTRIES} entries.`
    );
  }

  const entries = value.map((item) => {
    if (typeof item !== 'string') {
      throw validationError(
        'Each accreditation entry must be a string.'
      );
    }

    const normalized = item.trim();

    if (
      normalized.length < 1 ||
      normalized.length > MAX_ACCREDITATION_LENGTH
    ) {
      throw validationError(
        `Each accreditation entry must contain between 1 and ${MAX_ACCREDITATION_LENGTH} characters.`
      );
    }

    return normalized;
  });

  const normalizedEntries = entries.map((item) =>
    item.toLocaleLowerCase('en')
  );

  if (new Set(normalizedEntries).size !== entries.length) {
    throw validationError(
      'accreditation must not contain duplicate entries.'
    );
  }

  return entries;
}

function validate(input = {}, options = {}) {
  const { partial = false } = options;
  const data = pickAllowed(input);

  if (Object.keys(data).length === 0) {
    throw validationError(
      'At least one supported field must be provided.'
    );
  }

  normalizeString(data, 'name', {
    minLength: 2,
    maxLength: MAX_NAME_LENGTH,
    allowEmpty: false,
  });

  normalizeString(data, 'slug', {
    minLength: 2,
    maxLength: MAX_SLUG_LENGTH,
    lowercase: true,
    allowEmpty: false,
  });

  if (data.slug !== undefined && !SLUG_REGEX.test(data.slug)) {
    throw validationError(
      'slug must contain lowercase letters, numbers, and single hyphens.'
    );
  }

  normalizeString(data, 'code', {
    minLength: 1,
    maxLength: MAX_CODE_LENGTH,
    allowEmpty: false,
  });

  normalizeString(data, 'state', {
    maxLength: MAX_LOCATION_LENGTH,
  });

  normalizeString(data, 'city', {
    minLength: 1,
    maxLength: MAX_LOCATION_LENGTH,
    allowEmpty: false,
  });

  normalizeString(data, 'address', {
    maxLength: 1000,
  });

  normalizeString(data, 'pincode', {
    minLength: MIN_PINCODE_LENGTH,
    maxLength: MAX_PINCODE_LENGTH,
  });

  if (data.pincode !== undefined && data.pincode !== '') {
    if (!/^[A-Za-z0-9\s-]+$/.test(data.pincode)) {
      throw validationError(
        'pincode may contain only letters, numbers, spaces, and hyphens.'
      );
    }
  }

  normalizeString(data, 'website', {
    maxLength: MAX_WEBSITE_LENGTH,
  });

  if (data.website !== undefined) {
    data.website = validateWebsite(data.website);
  }

  normalizeString(data, 'email', {
    maxLength: MAX_EMAIL_LENGTH,
    lowercase: true,
  });

  if (data.email !== undefined && data.email !== '') {
    if (!EMAIL_REGEX.test(data.email)) {
      throw validationError(
        'email must be a valid email address.'
      );
    }
  }

  normalizeString(data, 'phone', {
    maxLength: MAX_PHONE_LENGTH,
  });

  if (data.phone !== undefined && data.phone !== '') {
    if (
      data.phone.length < 7 ||
      !PHONE_REGEX.test(data.phone)
    ) {
      throw validationError(
        'phone must be a valid phone number.'
      );
    }
  }

  if (data.college_type !== undefined) {
    if (typeof data.college_type !== 'string') {
      throw validationError('college_type must be a string.');
    }

    data.college_type = data.college_type.trim().toLowerCase();

    if (!ALLOWED_TYPES.includes(data.college_type)) {
      throw validationError(
        `college_type must be one of: ${ALLOWED_TYPES.join(', ')}.`
      );
    }
  }

  if (data.country_code !== undefined) {
    if (typeof data.country_code !== 'string') {
      throw validationError('country_code must be a string.');
    }

    data.country_code = data.country_code.trim().toUpperCase();

    if (!COUNTRY_CODE_REGEX.test(data.country_code)) {
      throw validationError(
        'country_code must be a two-letter ISO 3166-1 alpha-2 country code.'
      );
    }
  }

  if (data.university_id !== undefined) {
    if (
      !Number.isSafeInteger(data.university_id) ||
      data.university_id < 1
    ) {
      throw validationError(
        'university_id must be a positive integer.'
      );
    }
  }

  if (data.courses !== undefined) {
    if (
      !Array.isArray(data.courses) ||
      data.courses.length > MAX_COURSES
    ) {
      throw validationError(
        `courses must be an array containing at most ${MAX_COURSES} entries.`
      );
    }

    for (const courseId of data.courses) {
      if (!Number.isSafeInteger(courseId) || courseId < 1) {
        throw validationError(
          'Each courses entry must be a positive integer ID.'
        );
      }
    }

    if (new Set(data.courses).size !== data.courses.length) {
      throw validationError(
        'courses must not contain duplicate IDs.'
      );
    }
  }

  if (data.accreditation !== undefined) {
    data.accreditation = validateAccreditation(data.accreditation);
  }

  if (data.established_year !== undefined) {
    const currentYear = new Date().getFullYear();

    if (
      !Number.isSafeInteger(data.established_year) ||
      data.established_year < MIN_ESTABLISHED_YEAR ||
      data.established_year > currentYear
    ) {
      throw validationError(
        `established_year must be an integer between ${MIN_ESTABLISHED_YEAR} and ${currentYear}.`
      );
    }
  }

  normalizeString(data, 'description', {
    maxLength: MAX_DESCRIPTION_LENGTH,
  });

  if (data.status !== undefined) {
    if (typeof data.status !== 'string') {
      throw validationError('status must be a string.');
    }

    data.status = data.status.trim().toLowerCase();

    if (!ALLOWED_STATUSES.includes(data.status)) {
      throw validationError(
        `status must be one of: ${ALLOWED_STATUSES.join(', ')}.`
      );
    }
  }

  if (!partial) {
    for (const field of [
      'name',
      'slug',
      'country_code',
      'city',
      'college_type',
    ]) {
      if (
        data[field] === undefined ||
        data[field] === ''
      ) {
        throw validationError(`${field} is required.`);
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
  ALLOWED_TYPES,
  ALLOWED_STATUSES,
  pickAllowed,
  validate,
  validateCreate,
  validateUpdate,
};