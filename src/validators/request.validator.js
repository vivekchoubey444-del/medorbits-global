'use strict';

const DEFAULT_BODY_FIELDS = Object.freeze([]);
const DEFAULT_QUERY_FIELDS = Object.freeze([]);
const DEFAULT_PARAM_FIELDS = Object.freeze([]);

const DEFAULT_MAX_PAGE = 1000000;
const DEFAULT_MAX_LIMIT = 100;
const DEFAULT_MAX_STRING_LENGTH = 10000;
const DEFAULT_MAX_ARRAY_LENGTH = 100;

function createValidationError(
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

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function requireObject(input, field = 'request') {
  if (!isPlainObject(input)) {
    throw createValidationError(
      `${field} must be a plain JSON object.`,
      'INVALID_TYPE',
      field
    );
  }

  return input;
}

function validateFieldList(fields, name) {
  if (
    !Array.isArray(fields) ||
    fields.some((field) => typeof field !== 'string' || field.length === 0)
  ) {
    throw new TypeError(`${name} must be an array of non-empty strings.`);
  }

  if (new Set(fields).size !== fields.length) {
    throw new TypeError(`${name} must not contain duplicate fields.`);
  }

  return fields;
}

function rejectUnknownFields(input, allowedFields, options = {}) {
  const field = options.field || 'request';

  requireObject(input, field);
  validateFieldList(allowedFields, 'allowedFields');

  const allowed = new Set(allowedFields);
  const unknownFields = Object.keys(input).filter(
    (key) => !allowed.has(key)
  );

  if (unknownFields.length > 0) {
    throw createValidationError(
      `Unsupported field(s): ${unknownFields.join(', ')}.`,
      'UNKNOWN_FIELD',
      field
    );
  }

  return input;
}

function pickAllowed(input, allowedFields, options = {}) {
  const field = options.field || 'request';

  requireObject(input, field);
  validateFieldList(allowedFields, 'allowedFields');

  if (options.rejectUnknown === true) {
    rejectUnknownFields(input, allowedFields, { field });
  }

  // Avoid special-key assignment hazards when copying untrusted fields.
  const result = Object.create(null);

  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      result[key] = input[key];
    }
  }

  return result;
}

function validateRequestObject(input, options = {}) {
  const {
    field = 'request',
    allowedFields,
    rejectUnknown = true,
  } = options;

  requireObject(input, field);

  if (allowedFields === undefined) {
    return input;
  }

  validateFieldList(allowedFields, 'allowedFields');

  if (rejectUnknown) {
    rejectUnknownFields(input, allowedFields, { field });
  }

  return pickAllowed(input, allowedFields, {
    field,
    rejectUnknown: false,
  });
}

function validateBody(input, options = {}) {
  return validateRequestObject(input, {
    field: 'body',
    allowedFields: options.allowedFields,
    rejectUnknown: options.rejectUnknown !== false,
  });
}

function validateQuery(input, options = {}) {
  return validateRequestObject(input, {
    field: 'query',
    allowedFields: options.allowedFields,
    rejectUnknown: options.rejectUnknown !== false,
  });
}

function validateParams(input, options = {}) {
  return validateRequestObject(input, {
    field: 'params',
    allowedFields: options.allowedFields,
    rejectUnknown: options.rejectUnknown !== false,
  });
}

function validateRequiredFields(input, requiredFields, options = {}) {
  const field = options.field || 'request';

  requireObject(input, field);
  validateFieldList(requiredFields, 'requiredFields');

  const missing = requiredFields.filter((key) => {
    if (!Object.prototype.hasOwnProperty.call(input, key)) {
      return true;
    }

    const value = input[key];

    return (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    );
  });

  if (missing.length > 0) {
    throw createValidationError(
      `Missing required field(s): ${missing.join(', ')}.`,
      'REQUIRED_FIELD',
      field
    );
  }

  return input;
}

function validateAllowedValues(input, field, allowedValues, options = {}) {
  requireObject(input, options.objectField || 'request');

  if (
    !Array.isArray(allowedValues) ||
    allowedValues.length === 0
  ) {
    throw new TypeError('allowedValues must be a non-empty array.');
  }

  if (!allowedValues.every((value) => typeof value === 'string')) {
    throw new TypeError('allowedValues must contain only strings.');
  }

  if (typeof field !== 'string' || field.length === 0) {
    throw new TypeError('field must be a non-empty string.');
  }

  if (!Object.prototype.hasOwnProperty.call(input, field)) {
    if (options.required === false) {
      return undefined;
    }

    throw createValidationError(
      `${field} is required.`,
      'REQUIRED_FIELD',
      field
    );
  }

  const value = input[field];

  if (typeof value !== 'string') {
    throw createValidationError(
      `${field} must be a string.`,
      'INVALID_TYPE',
      field
    );
  }

  const normalized = options.trim === false ? value : value.trim();

  const matchedValue = options.caseInsensitive === true
    ? allowedValues.find(
        (item) => item.toLowerCase() === normalized.toLowerCase()
      )
    : allowedValues.find((item) => item === normalized);

  if (matchedValue === undefined) {
    throw createValidationError(
      `${field} must be one of the supported values.`,
      'INVALID_ENUM',
      field
    );
  }

  return matchedValue;
}

function validateString(value, options = {}) {
  const {
    field = 'value',
    minLength = 1,
    maxLength = DEFAULT_MAX_STRING_LENGTH,
    trim = true,
    allowEmpty = false,
    pattern,
    patternMessage,
  } = options;

  if (typeof value !== 'string') {
    throw createValidationError(
      `${field} must be a string.`,
      'INVALID_TYPE',
      field
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

  if (!allowEmpty && normalized.length === 0) {
    throw createValidationError(
      `${field} is required.`,
      'REQUIRED_FIELD',
      field
    );
  }

  if (
    normalized.length < minLength ||
    normalized.length > maxLength
  ) {
    throw createValidationError(
      `${field} must contain between ${minLength} and ${maxLength} characters.`,
      'OUT_OF_RANGE',
      field
    );
  }

  if (pattern !== undefined) {
    if (!(pattern instanceof RegExp)) {
      throw new TypeError('pattern must be a RegExp.');
    }

    // Reset state for global/sticky patterns before and after testing.
    pattern.lastIndex = 0;
    const matches = pattern.test(normalized);
    pattern.lastIndex = 0;

    if (!matches) {
      throw createValidationError(
        patternMessage || `${field} has an invalid format.`,
        'INVALID_FORMAT',
        field
      );
    }
  }

  return normalized;
}

function validateBoolean(value, field = 'value') {
  if (typeof value !== 'boolean') {
    throw createValidationError(
      `${field} must be a boolean.`,
      'INVALID_TYPE',
      field
    );
  }

  return value;
}

function validateNumber(value, options = {}) {
  const {
    field = 'value',
    min = -Infinity,
    max = Infinity,
    integer = false,
    allowNumericString = false,
  } = options;

  if (
    typeof min !== 'number' ||
    typeof max !== 'number' ||
    Number.isNaN(min) ||
    Number.isNaN(max) ||
    min > max
  ) {
    throw new TypeError('Invalid numeric range constraints.');
  }

  let normalized = value;

  if (allowNumericString && typeof value === 'string') {
    const text = value.trim();

    if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
      throw createValidationError(
        `${field} must be a valid number.`,
        'INVALID_TYPE',
        field
      );
    }

    normalized = Number(text);
  }

  if (
    typeof normalized !== 'number' ||
    !Number.isFinite(normalized)
  ) {
    throw createValidationError(
      `${field} must be a finite number.`,
      'INVALID_TYPE',
      field
    );
  }

  if (integer && !Number.isSafeInteger(normalized)) {
    throw createValidationError(
      `${field} must be a safe integer.`,
      'INVALID_TYPE',
      field
    );
  }

  if (normalized < min || normalized > max) {
    throw createValidationError(
      `${field} must be between ${min} and ${max}.`,
      'OUT_OF_RANGE',
      field
    );
  }

  return normalized;
}

function validateRouteId(value, options = {}) {
  const {
    field = 'id',
    allowNumericString = true,
  } = options;

  return validateNumber(value, {
    field,
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
    integer: true,
    allowNumericString,
  });
}

function validatePagination(input = {}, options = {}) {
  requireObject(input, 'query');

  const {
    defaultPage = 1,
    defaultLimit = 20,
    maxPage = DEFAULT_MAX_PAGE,
    maxLimit = DEFAULT_MAX_LIMIT,
  } = options;

  // Validate configuration as well as request values.
  validateNumber(defaultPage, {
    field: 'defaultPage',
    min: 1,
    max: maxPage,
    integer: true,
  });

  validateNumber(defaultLimit, {
    field: 'defaultLimit',
    min: 1,
    max: maxLimit,
    integer: true,
  });

  if (
    !Number.isSafeInteger(maxPage) ||
    maxPage < 1 ||
    !Number.isSafeInteger(maxLimit) ||
    maxLimit < 1
  ) {
    throw new TypeError('Pagination maximums must be positive safe integers.');
  }

  const page = input.page === undefined
    ? defaultPage
    : validateNumber(input.page, {
        field: 'page',
        min: 1,
        max: maxPage,
        integer: true,
        allowNumericString: true,
      });

  const limit = input.limit === undefined
    ? defaultLimit
    : validateNumber(input.limit, {
        field: 'limit',
        min: 1,
        max: maxLimit,
        integer: true,
        allowNumericString: true,
      });

  return { page, limit };
}

function validateDateOnly(value, options = {}) {
  const {
    field = 'date',
    min,
    max,
  } = options;

  const date = validateString(value, {
    field,
    minLength: 10,
    maxLength: 10,
  });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createValidationError(
      `${field} must use YYYY-MM-DD format.`,
      'INVALID_DATE',
      field
    );
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw createValidationError(
      `${field} must be a valid calendar date.`,
      'INVALID_DATE',
      field
    );
  }

  if (min !== undefined && date < min) {
    throw createValidationError(
      `${field} must be on or after ${min}.`,
      'OUT_OF_RANGE',
      field
    );
  }

  if (max !== undefined && date > max) {
    throw createValidationError(
      `${field} must be on or before ${max}.`,
      'OUT_OF_RANGE',
      field
    );
  }

  return date;
}

function validateTimestamp(value, options = {}) {
  const {
    field = 'timestamp',
    allowDateString = false,
  } = options;

  let timestamp;

  if (value instanceof Date) {
    timestamp = value.getTime();
  } else if (typeof value === 'number') {
    timestamp = value;
  } else if (allowDateString && typeof value === 'string') {
    if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
      throw createValidationError(
        `${field} must include an explicit timezone.`,
        'INVALID_DATE',
        field
      );
    }

    timestamp = Date.parse(value);
  } else {
    throw createValidationError(
      `${field} must be a valid timestamp.`,
      'INVALID_TYPE',
      field
    );
  }

  if (
    !Number.isFinite(timestamp) ||
    Number.isNaN(new Date(timestamp).getTime())
  ) {
    throw createValidationError(
      `${field} must be a valid timestamp.`,
      'INVALID_DATE',
      field
    );
  }

  return new Date(timestamp);
}

function validateTextArray(value, options = {}) {
  const {
    field = 'value',
    minItems = 0,
    maxItems = DEFAULT_MAX_ARRAY_LENGTH,
    maxItemLength = 255,
    unique = false,
    caseInsensitiveUnique = true,
  } = options;

  if (!Array.isArray(value)) {
    throw createValidationError(
      `${field} must be an array.`,
      'INVALID_TYPE',
      field
    );
  }

  if (
    !Number.isSafeInteger(minItems) ||
    !Number.isSafeInteger(maxItems) ||
    minItems < 0 ||
    maxItems < minItems ||
    value.length < minItems ||
    value.length > maxItems
  ) {
    throw createValidationError(
      `${field} must contain between ${minItems} and ${maxItems} items.`,
      'OUT_OF_RANGE',
      field
    );
  }

  const result = value.map((item, index) =>
    validateString(item, {
      field: `${field}[${index}]`,
      minLength: 1,
      maxLength: maxItemLength,
    })
  );

  if (unique) {
    const seen = new Set();

    for (const item of result) {
      const key = caseInsensitiveUnique
        ? item.toLowerCase()
        : item;

      if (seen.has(key)) {
        throw createValidationError(
          `${field} must not contain duplicate items.`,
          'INVALID_FORMAT',
          field
        );
      }

      seen.add(key);
    }
  }

  return result;
}

function validateCompleteRequest(req, options = {}) {
  if (
    req === null ||
    typeof req !== 'object' ||
    Array.isArray(req)
  ) {
    throw createValidationError(
      'Request must be an object.',
      'INVALID_TYPE',
      'request'
    );
  }

  const body = validateBody(req.body ?? {}, {
    allowedFields: options.bodyFields,
    rejectUnknown: options.rejectUnknownBody !== false,
  });

  const query = validateQuery(req.query ?? {}, {
    allowedFields: options.queryFields,
    rejectUnknown: options.rejectUnknownQuery !== false,
  });

  const params = validateParams(req.params ?? {}, {
    allowedFields: options.paramFields,
    rejectUnknown: options.rejectUnknownParams !== false,
  });

  return { body, query, params };
}

function validate(input, options = {}) {
  return validateRequestObject(input, options);
}

module.exports = {
  createValidationError,
  isPlainObject,
  requireObject,
  rejectUnknownFields,
  pickAllowed,
  validateRequestObject,
  validateBody,
  validateQuery,
  validateParams,
  validateRequiredFields,
  validateAllowedValues,
  validateString,
  validateBoolean,
  validateNumber,
  validateRouteId,
  validatePagination,
  validateDateOnly,
  validateTimestamp,
  validateTextArray,
  validateCompleteRequest,
  validate,
  DEFAULT_BODY_FIELDS,
  DEFAULT_QUERY_FIELDS,
  DEFAULT_PARAM_FIELDS,
  DEFAULT_MAX_PAGE,
  DEFAULT_MAX_LIMIT,
  DEFAULT_MAX_STRING_LENGTH,
  DEFAULT_MAX_ARRAY_LENGTH,
};