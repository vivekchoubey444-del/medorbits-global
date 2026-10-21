'use strict';

const DEFAULT_MAX_STRING_LENGTH = 10000;
const DEFAULT_MAX_ARRAY_LENGTH = 100;
const DEFAULT_MAX_OBJECT_DEPTH = 10;
const DEFAULT_MAX_OBJECT_BYTES = 65536;

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

function requireObject(value, options = {}) {
  const {
    field = 'body',
    allowNullPrototype = true,
  } = options;

  const valid =
    isPlainObject(value) &&
    (allowNullPrototype || Object.getPrototypeOf(value) === Object.prototype);

  if (!valid) {
    throw createValidationError(
      `${field} must be a plain JSON object.`,
      'INVALID_TYPE',
      field
    );
  }

  return value;
}

function requireArray(value, options = {}) {
  const {
    field = 'value',
    minItems = 0,
    maxItems = DEFAULT_MAX_ARRAY_LENGTH,
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
    maxItems < minItems
  ) {
    throw new TypeError('Invalid array length constraints.');
  }

  if (value.length < minItems || value.length > maxItems) {
    throw createValidationError(
      `${field} must contain between ${minItems} and ${maxItems} items.`,
      'OUT_OF_RANGE',
      field
    );
  }

  return value;
}

function requireString(value, options = {}) {
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

  const result = trim ? value.trim() : value;

  if (!allowEmpty && result.length === 0) {
    throw createValidationError(
      `${field} is required.`,
      'REQUIRED_FIELD',
      field
    );
  }

  if (result.length < minLength || result.length > maxLength) {
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

    // Avoid stateful results from global or sticky regular expressions.
    pattern.lastIndex = 0;
    const matches = pattern.test(result);
    pattern.lastIndex = 0;

    if (!matches) {
      throw createValidationError(
        patternMessage || `${field} has an invalid format.`,
        'INVALID_FORMAT',
        field
      );
    }
  }

  return result;
}

function optionalString(value, options = {}) {
  const {
    allowNull = false,
  } = options;

  if (value === undefined) {
    return undefined;
  }

  if (value === null && allowNull) {
    return null;
  }

  return requireString(value, options);
}

function requireBoolean(value, options = {}) {
  const { field = 'value' } = options;

  if (typeof value !== 'boolean') {
    throw createValidationError(
      `${field} must be a boolean.`,
      'INVALID_TYPE',
      field
    );
  }

  return value;
}

function requireNumber(value, options = {}) {
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

  let number = value;

  if (allowNumericString && typeof number === 'string') {
    const trimmed = number.trim();

    if (trimmed.length === 0 || !Number.isFinite(Number(trimmed))) {
      throw createValidationError(
        `${field} must be a valid number.`,
        'INVALID_TYPE',
        field
      );
    }

    number = Number(trimmed);
  }

  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw createValidationError(
      `${field} must be a finite number.`,
      'INVALID_TYPE',
      field
    );
  }

  if (integer && !Number.isSafeInteger(number)) {
    throw createValidationError(
      `${field} must be a safe integer.`,
      'INVALID_TYPE',
      field
    );
  }

  if (number < min || number > max) {
    throw createValidationError(
      `${field} must be between ${min} and ${max}.`,
      'OUT_OF_RANGE',
      field
    );
  }

  return number;
}

function requirePositiveId(value, options = {}) {
  const {
    field = 'id',
    allowNumericString = true,
  } = options;

  return requireNumber(value, {
    field,
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
    integer: true,
    allowNumericString,
  });
}

function requireEnum(value, options = {}) {
  const {
    field = 'value',
    allowedValues,
    caseInsensitive = false,
    trim = true,
  } = options;

  if (
    !Array.isArray(allowedValues) ||
    allowedValues.length === 0
  ) {
    throw new TypeError('allowedValues must be a non-empty array.');
  }

  const input = requireString(value, {
    field,
    minLength: 1,
    maxLength: DEFAULT_MAX_STRING_LENGTH,
    trim,
  });

  const match = caseInsensitive
    ? allowedValues.find(
        (item) =>
          typeof item === 'string' &&
          item.toLowerCase() === input.toLowerCase()
      )
    : allowedValues.find((item) => item === input);

  if (match === undefined) {
    throw createValidationError(
      `${field} must be one of the supported values.`,
      'INVALID_ENUM',
      field
    );
  }

  return match;
}

function rejectUnknownFields(input, allowedFields, options = {}) {
  const {
    field = 'body',
    allow = [],
  } = options;

  requireObject(input, { field });

  if (!Array.isArray(allowedFields) || !Array.isArray(allow)) {
    throw new TypeError('allowedFields and allow must be arrays.');
  }

  const accepted = new Set([...allowedFields, ...allow]);

  const unknown = Object.keys(input).filter(
    (key) => !accepted.has(key)
  );

  if (unknown.length > 0) {
    throw createValidationError(
      `Unsupported field(s): ${unknown.join(', ')}.`,
      'UNKNOWN_FIELD',
      field
    );
  }

  return input;
}

function pickAllowed(input, allowedFields, options = {}) {
  const {
    rejectUnknown = false,
    field = 'body',
  } = options;

  requireObject(input, { field });

  if (!Array.isArray(allowedFields)) {
    throw new TypeError('allowedFields must be an array.');
  }

  if (rejectUnknown) {
    rejectUnknownFields(input, allowedFields, { field });
  }

  const result = Object.create(null);

  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      result[key] = input[key];
    }
  }

  return result;
}

function requireDateOnly(value, options = {}) {
  const {
    field = 'date',
    min,
    max,
  } = options;

  const date = requireString(value, {
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

function requireTimestamp(value, options = {}) {
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
    // Require an explicit timezone to avoid local-time ambiguity.
    const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);

    if (!hasTimezone) {
      throw createValidationError(
        `${field} must include a timezone.`,
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

function requireTextArray(value, options = {}) {
  const {
    field = 'value',
    minItems = 0,
    maxItems = DEFAULT_MAX_ARRAY_LENGTH,
    maxItemLength = 255,
    unique = false,
    caseInsensitiveUnique = true,
  } = options;

  const items = requireArray(value, {
    field,
    minItems,
    maxItems,
  });

  const result = items.map((item, index) =>
    requireString(item, {
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

function validateJsonObject(value, options = {}) {
  const {
    field = 'value',
    maxDepth = DEFAULT_MAX_OBJECT_DEPTH,
    maxBytes = DEFAULT_MAX_OBJECT_BYTES,
  } = options;

  requireObject(value, { field });

  if (
    !Number.isSafeInteger(maxDepth) ||
    maxDepth < 0 ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 0
  ) {
    throw new TypeError('Invalid JSON object validation limits.');
  }

  const visited = new WeakSet();

  function inspect(current, depth, path) {
    if (depth > maxDepth) {
      throw createValidationError(
        `${field} exceeds the maximum nesting depth.`,
        'OUT_OF_RANGE',
        path
      );
    }

    if (
      current === null ||
      typeof current === 'string' ||
      typeof current === 'boolean'
    ) {
      return;
    }

    if (typeof current === 'number') {
      if (!Number.isFinite(current)) {
        throw createValidationError(
          `${path} contains a non-finite number.`,
          'INVALID_TYPE',
          path
        );
      }

      return;
    }

    if (typeof current !== 'object') {
      throw createValidationError(
        `${path} contains an unsupported JSON value.`,
        'INVALID_TYPE',
        path
      );
    }

    if (visited.has(current)) {
      throw createValidationError(
        `${path} must not contain circular references.`,
        'INVALID_FORMAT',
        path
      );
    }

    visited.add(current);

    if (Array.isArray(current)) {
      if (current.length > DEFAULT_MAX_ARRAY_LENGTH) {
        throw createValidationError(
          `${path} contains too many array items.`,
          'OUT_OF_RANGE',
          path
        );
      }

      for (let index = 0; index < current.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(current, index)) {
          throw createValidationError(
            `${path} must not contain sparse arrays.`,
            'INVALID_FORMAT',
            path
          );
        }

        inspect(current[index], depth + 1, `${path}[${index}]`);
      }
    } else {
      if (!isPlainObject(current)) {
        throw createValidationError(
          `${path} must contain only plain JSON objects.`,
          'INVALID_TYPE',
          path
        );
      }

      for (const [key, child] of Object.entries(current)) {
        inspect(child, depth + 1, `${path}.${key}`);
      }
    }

    visited.delete(current);
  }

  inspect(value, 0, field);

  let serialized;

  try {
    serialized = JSON.stringify(value);
  } catch {
    throw createValidationError(
      `${field} must be JSON-serializable.`,
      'INVALID_FORMAT',
      field
    );
  }

  if (Buffer.byteLength(serialized, 'utf8') > maxBytes) {
    throw createValidationError(
      `${field} exceeds the maximum permitted size.`,
      'OUT_OF_RANGE',
      field
    );
  }

  return value;
}

function validateOptional(value, validator) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof validator !== 'function') {
    throw new TypeError('validator must be a function.');
  }

  return validator(value);
}

module.exports = {
  createValidationError,
  isPlainObject,
  requireObject,
  requireArray,
  requireString,
  optionalString,
  requireBoolean,
  requireNumber,
  requirePositiveId,
  requireEnum,
  rejectUnknownFields,
  pickAllowed,
  requireDateOnly,
  requireTimestamp,
  requireTextArray,
  validateJsonObject,
  validateOptional,
  DEFAULT_MAX_STRING_LENGTH,
  DEFAULT_MAX_ARRAY_LENGTH,
  DEFAULT_MAX_OBJECT_DEPTH,
  DEFAULT_MAX_OBJECT_BYTES,
};