'use strict';

const ALLOWED_CREATE_FIELDS = Object.freeze([
  'name',
  'slug',
  'code',
  'university_type',
  'country_code',
  'state',
  'city',
  'address',
  'pincode',
  'website',
  'email',
  'phone',
  'established_year',
  'recognition',
  'accreditation',
  'description',
  'logo_url',
  'official_url',
  'status',
]);

const ALLOWED_UPDATE_FIELDS = Object.freeze([
  ...ALLOWED_CREATE_FIELDS,
]);

const ALLOWED_QUERY_FIELDS = Object.freeze([
  'page',
  'limit',
  'search',
  'country_code',
  'state',
  'city',
  'university_type',
  'status',
  'established_year',
]);

const UNIVERSITY_TYPES = Object.freeze([
  'public',
  'private',
  'deemed',
  'central',
  'state',
  'open',
  'international',
  'autonomous',
  'other',
]);

const UNIVERSITY_STATUSES = Object.freeze([
  'draft',
  'published',
  'inactive',
  'archived',
]);

const MAX_NAME_LENGTH = 200;
const MAX_SLUG_LENGTH = 200;
const MAX_CODE_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 10000;
const MAX_ADDRESS_LENGTH = 1000;
const MAX_URL_LENGTH = 2048;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 30;
const MAX_LIST_ITEMS = 50;
const MAX_LIST_TEXT_LENGTH = 200;
const MAX_SEARCH_LENGTH = 200;
const MAX_PAGE = 1000000;
const MAX_PAGE_SIZE = 100;

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;
const CODE_REGEX = /^[A-Z0-9][A-Z0-9._-]*$/;
const PINCODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9\s-]*$/;
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

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

function requireObject(input, label = 'Request body') {
  if (!isPlainObject(input)) {
    throw validationError(
      `${label} must be a plain JSON object.`,
      label === 'Query parameters' ? 'query' : 'body',
      'INVALID_OBJECT'
    );
  }

  return input;
}

function rejectUnknownFields(input, allowedFields) {
  const unknownFields = Object.keys(input).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unknownFields.length > 0) {
    throw validationError(
      `Unsupported field(s): ${unknownFields.join(', ')}.`,
      undefined,
      'UNKNOWN_FIELDS'
    );
  }
}

function requireString(value, field, options = {}) {
  const {
    minLength = 1,
    maxLength = 255,
    trim = true,
    rejectControlCharacters = true,
  } = options;

  if (typeof value !== 'string') {
    throw validationError(
      `${field} must be a string.`,
      field,
      'INVALID_TYPE'
    );
  }

  const result = trim ? value.trim() : value;

  if (
    rejectControlCharacters &&
    CONTROL_CHARACTERS_REGEX.test(result)
  ) {
    throw validationError(
      `${field} must not contain control characters.`,
      field,
      'INVALID_FORMAT'
    );
  }

  if (
    result.length < minLength ||
    result.length > maxLength
  ) {
    throw validationError(
      `${field} must contain between ${minLength} and ${maxLength} characters.`,
      field,
      'OUT_OF_RANGE'
    );
  }

  return result;
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

function validateCountryCode(value) {
  const code = requireString(value, 'country_code', {
    minLength: 2,
    maxLength: 2,
  }).toUpperCase();

  if (!COUNTRY_CODE_REGEX.test(code)) {
    throw validationError(
      'country_code must be a two-letter country code.',
      'country_code',
      'INVALID_COUNTRY_CODE'
    );
  }

  return code;
}

function validateSlug(value) {
  const slug = requireString(value, 'slug', {
    minLength: 1,
    maxLength: MAX_SLUG_LENGTH,
  }).toLowerCase();

  if (!SLUG_REGEX.test(slug)) {
    throw validationError(
      'slug may contain lowercase letters, numbers, and single hyphens between words.',
      'slug',
      'INVALID_SLUG'
    );
  }

  return slug;
}

function validateCode(value) {
  const code = requireString(value, 'code', {
    minLength: 1,
    maxLength: MAX_CODE_LENGTH,
  }).toUpperCase();

  if (!CODE_REGEX.test(code)) {
    throw validationError(
      'code contains unsupported characters.',
      'code',
      'INVALID_CODE'
    );
  }

  return code;
}

function validateEmail(value) {
  const email = requireString(value, 'email', {
    minLength: 3,
    maxLength: MAX_EMAIL_LENGTH,
  }).toLowerCase();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw validationError(
      'email must be valid.',
      'email',
      'INVALID_EMAIL'
    );
  }

  return email;
}

function validateUrl(value, field, options = {}) {
  const urlText = requireString(value, field, {
    minLength: 1,
    maxLength: MAX_URL_LENGTH,
  });

  let parsed;

  try {
    parsed = new URL(urlText);
  } catch {
    throw validationError(
      `${field} must be a valid absolute URL.`,
      field,
      'INVALID_URL'
    );
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw validationError(
      `${field} must use HTTP or HTTPS.`,
      field,
      'INVALID_URL_PROTOCOL'
    );
  }

  if (!parsed.hostname || parsed.hostname.includes(' ')) {
    throw validationError(
      `${field} must contain a valid hostname.`,
      field,
      'INVALID_URL'
    );
  }

  if (parsed.username || parsed.password) {
    throw validationError(
      `${field} must not contain embedded credentials.`,
      field,
      'INVALID_URL_CREDENTIALS'
    );
  }

  if (options.httpsOnly && parsed.protocol !== 'https:') {
    throw validationError(
      `${field} must use HTTPS.`,
      field,
      'HTTPS_REQUIRED'
    );
  }

  return parsed.toString();
}

function validatePhone(value) {
  const phone = requireString(value, 'phone', {
    minLength: 5,
    maxLength: MAX_PHONE_LENGTH,
  });

  if (!/^[+0-9().\-\s]+$/.test(phone)) {
    throw validationError(
      'phone contains unsupported characters.',
      'phone',
      'INVALID_PHONE'
    );
  }

  const digits = phone.replace(/\D/g, '');

  if (digits.length < 5 || digits.length > 15) {
    throw validationError(
      'phone must contain between 5 and 15 digits.',
      'phone',
      'INVALID_PHONE'
    );
  }

  return phone;
}

function validateYear(value, field = 'established_year') {
  if (
    !Number.isSafeInteger(value) ||
    value < 1000 ||
    value > 2100
  ) {
    throw validationError(
      `${field} must be a whole year between 1000 and 2100.`,
      field,
      'INVALID_YEAR'
    );
  }

  return value;
}

function validatePincode(value) {
  const pincode = requireString(value, 'pincode', {
    minLength: 2,
    maxLength: 20,
  });

  if (!PINCODE_REGEX.test(pincode)) {
    throw validationError(
      'pincode contains unsupported characters.',
      'pincode',
      'INVALID_PINCODE'
    );
  }

  return pincode;
}

function validateTextArray(value, field, options = {}) {
  const {
    maxItems = MAX_LIST_ITEMS,
    maxItemLength = MAX_LIST_TEXT_LENGTH,
  } = options;

  if (!Array.isArray(value)) {
    throw validationError(
      `${field} must be an array of strings.`,
      field,
      'INVALID_TYPE'
    );
  }

  if (value.length > maxItems) {
    throw validationError(
      `${field} must not contain more than ${maxItems} items.`,
      field,
      'OUT_OF_RANGE'
    );
  }

  const normalized = value.map((item, index) => {
    if (typeof item !== 'string') {
      throw validationError(
        `${field}[${index}] must be a string.`,
        `${field}[${index}]`,
        'INVALID_TYPE'
      );
    }

    return requireString(item, `${field}[${index}]`, {
      minLength: 1,
      maxLength: maxItemLength,
    });
  });

  const seen = new Set();

  for (const item of normalized) {
    const key = item.toLowerCase();

    if (seen.has(key)) {
      throw validationError(
        `${field} must not contain duplicate items.`,
        field,
        'DUPLICATE_VALUE'
      );
    }

    seen.add(key);
  }

  return normalized;
}

function validateOptionalFields(body) {
  const result = Object.create(null);

  if (body.code !== undefined) {
    result.code = validateCode(body.code);
  }

  if (body.state !== undefined) {
    result.state = requireString(body.state, 'state', {
      minLength: 1,
      maxLength: 150,
    });
  }

  if (body.address !== undefined) {
    result.address = requireString(body.address, 'address', {
      minLength: 1,
      maxLength: MAX_ADDRESS_LENGTH,
    });
  }

  if (body.pincode !== undefined) {
    result.pincode = validatePincode(body.pincode);
  }

  if (body.website !== undefined) {
    result.website = validateUrl(body.website, 'website');
  }

  if (body.official_url !== undefined) {
    result.official_url = validateUrl(
      body.official_url,
      'official_url'
    );
  }

  if (body.email !== undefined) {
    result.email = validateEmail(body.email);
  }

  if (body.phone !== undefined) {
    result.phone = validatePhone(body.phone);
  }

  if (body.established_year !== undefined) {
    result.established_year = validateYear(
      body.established_year
    );
  }

  if (body.recognition !== undefined) {
    result.recognition = validateTextArray(
      body.recognition,
      'recognition'
    );
  }

  if (body.accreditation !== undefined) {
    result.accreditation = validateTextArray(
      body.accreditation,
      'accreditation'
    );
  }

  if (body.description !== undefined) {
    result.description = requireString(
      body.description,
      'description',
      {
        minLength: 1,
        maxLength: MAX_DESCRIPTION_LENGTH,
      }
    );
  }

  if (body.logo_url !== undefined) {
    result.logo_url = validateUrl(
      body.logo_url,
      'logo_url',
      { httpsOnly: true }
    );
  }

  if (body.status !== undefined) {
    result.status = validateEnum(
      body.status,
      'status',
      UNIVERSITY_STATUSES
    );
  }

  return result;
}

function validateCreate(input) {
  const body = requireObject(input);
  rejectUnknownFields(body, ALLOWED_CREATE_FIELDS);

  const requiredFields = [
    'name',
    'slug',
    'university_type',
    'country_code',
    'city',
  ];

  for (const field of requiredFields) {
    if (body[field] === undefined) {
      throw validationError(
        `${field} is required.`,
        field,
        'REQUIRED_FIELD'
      );
    }
  }

  const result = Object.create(null);

  result.name = requireString(body.name, 'name', {
    minLength: 2,
    maxLength: MAX_NAME_LENGTH,
  });

  result.slug = validateSlug(body.slug);

  result.university_type = validateEnum(
    body.university_type,
    'university_type',
    UNIVERSITY_TYPES
  );

  result.country_code = validateCountryCode(
    body.country_code
  );

  result.city = requireString(body.city, 'city', {
    minLength: 1,
    maxLength: 150,
  });

  Object.assign(result, validateOptionalFields(body));

  if (result.status === undefined) {
    result.status = 'draft';
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

  const result = Object.create(null);

  if (body.name !== undefined) {
    result.name = requireString(body.name, 'name', {
      minLength: 2,
      maxLength: MAX_NAME_LENGTH,
    });
  }

  if (body.slug !== undefined) {
    result.slug = validateSlug(body.slug);
  }

  if (body.code !== undefined) {
    result.code = validateCode(body.code);
  }

  if (body.university_type !== undefined) {
    result.university_type = validateEnum(
      body.university_type,
      'university_type',
      UNIVERSITY_TYPES
    );
  }

  if (body.country_code !== undefined) {
    result.country_code = validateCountryCode(
      body.country_code
    );
  }

  if (body.city !== undefined) {
    result.city = requireString(body.city, 'city', {
      minLength: 1,
      maxLength: 150,
    });
  }

  Object.assign(result, validateOptionalFields(body));

  return result;
}

function parseBoundedInteger(value, field, min, max) {
  let number;

  if (typeof value === 'number') {
    number = value;
  } else if (typeof value === 'string') {
    const text = value.trim();

    if (!/^\d+$/.test(text)) {
      throw validationError(
        `${field} must be an integer.`,
        field,
        'INVALID_INTEGER'
      );
    }

    number = Number(text);
  } else {
    throw validationError(
      `${field} must be an integer.`,
      field,
      'INVALID_TYPE'
    );
  }

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

  const result = Object.create(null);

  if (query.page !== undefined) {
    result.page = parseBoundedInteger(
      query.page,
      'page',
      1,
      MAX_PAGE
    );
  }

  if (query.limit !== undefined) {
    result.limit = parseBoundedInteger(
      query.limit,
      'limit',
      1,
      MAX_PAGE_SIZE
    );
  }

  if (query.search !== undefined) {
    result.search = requireString(query.search, 'search', {
      minLength: 1,
      maxLength: MAX_SEARCH_LENGTH,
    });
  }

  if (query.country_code !== undefined) {
    result.country_code = validateCountryCode(
      query.country_code
    );
  }

  for (const field of ['state', 'city']) {
    if (query[field] !== undefined) {
      result[field] = requireString(query[field], field, {
        minLength: 1,
        maxLength: 150,
      });
    }
  }

  if (query.university_type !== undefined) {
    result.university_type = validateEnum(
      query.university_type,
      'university_type',
      UNIVERSITY_TYPES
    );
  }

  if (query.status !== undefined) {
    result.status = validateEnum(
      query.status,
      'status',
      UNIVERSITY_STATUSES
    );
  }

  if (query.established_year !== undefined) {
    result.established_year = parseBoundedInteger(
      query.established_year,
      'established_year',
      1000,
      2100
    );
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
        `Unsupported university validation mode: ${mode}.`,
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
  validateCountryCode,
  validateSlug,
  validateCode,
  validateUrl,
  validateEmail,
  validatePhone,
  validateYear,
  validateTextArray,
  UNIVERSITY_TYPES,
  UNIVERSITY_STATUSES,
  ALLOWED_CREATE_FIELDS,
  ALLOWED_UPDATE_FIELDS,
  ALLOWED_QUERY_FIELDS,
};