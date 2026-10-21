'use strict';

const ALLOWED_CREATE_FIELDS = Object.freeze([
  'plan_id',
  'user_id',
  'employer_id',
  'billing_cycle',
  'currency',
  'start_date',
  'end_date',
  'trial_days',
  'metadata',
]);

const ALLOWED_UPDATE_FIELDS = Object.freeze([
  'billing_cycle',
  'auto_renew',
  'cancel_at_period_end',
  'metadata',
]);

const ALLOWED_QUERY_FIELDS = Object.freeze([
  'page',
  'limit',
  'status',
  'billing_cycle',
  'currency',
  'user_id',
  'employer_id',
]);

const BILLING_CYCLES = Object.freeze([
  'monthly',
  'quarterly',
  'semi_annual',
  'annual',
]);

const SUBSCRIPTION_STATUSES = Object.freeze([
  'pending',
  'trialing',
  'active',
  'past_due',
  'paused',
  'cancelled',
  'expired',
  'incomplete',
  'unpaid',
]);

const SUPPORTED_CURRENCIES = Object.freeze([
  'INR',
  'USD',
  'EUR',
  'GBP',
  'AED',
]);

const MAX_TRIAL_DAYS = 90;
const MAX_METADATA_BYTES = 8192;
const MAX_METADATA_DEPTH = 8;
const MAX_METADATA_ARRAY_LENGTH = 100;
const MAX_METADATA_STRING_LENGTH = 4096;
const MAX_QUERY_PAGE = 1000000;
const MAX_QUERY_LIMIT = 100;

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

  return input;
}

function requireString(value, field, options = {}) {
  const {
    minLength = 1,
    maxLength = 255,
    trim = true,
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

  if (result.length < minLength || result.length > maxLength) {
    throw validationError(
      `${field} must contain between ${minLength} and ${maxLength} characters.`,
      field,
      'OUT_OF_RANGE'
    );
  }

  return result;
}

function positiveId(value, field) {
  let id = value;

  if (typeof value === 'string') {
    const text = value.trim();

    if (!/^[1-9]\d*$/.test(text)) {
      throw validationError(
        `${field} must be a positive integer.`,
        field,
        'INVALID_FORMAT'
      );
    }

    id = Number(text);
  }

  if (!Number.isSafeInteger(id) || id < 1) {
    throw validationError(
      `${field} must be a positive integer.`,
      field,
      'OUT_OF_RANGE'
    );
  }

  return id;
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

function validateCurrency(value) {
  const currency = requireString(value, 'currency', {
    minLength: 3,
    maxLength: 3,
  }).toUpperCase();

  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw validationError(
      `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}.`,
      'currency',
      'INVALID_CURRENCY'
    );
  }

  return currency;
}

function validateDate(value, field) {
  const date = requireString(value, field, {
    minLength: 10,
    maxLength: 10,
  });

  if (!DATE_ONLY_REGEX.test(date)) {
    throw validationError(
      `${field} must use YYYY-MM-DD format.`,
      field,
      'INVALID_DATE'
    );
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw validationError(
      `${field} must be a valid calendar date.`,
      field,
      'INVALID_DATE'
    );
  }

  return date;
}

function validateBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw validationError(
      `${field} must be a boolean.`,
      field,
      'INVALID_TYPE'
    );
  }

  return value;
}

function validateMetadata(value) {
  if (!isPlainObject(value)) {
    throw validationError(
      'metadata must be a plain JSON object.',
      'metadata',
      'INVALID_TYPE'
    );
  }

  const visited = new WeakSet();

  function inspect(current, depth, path) {
    if (depth > MAX_METADATA_DEPTH) {
      throw validationError(
        'metadata exceeds the maximum nesting depth.',
        path,
        'OUT_OF_RANGE'
      );
    }

    if (
      current === null ||
      typeof current === 'boolean'
    ) {
      return;
    }

    if (typeof current === 'string') {
      if (current.length > MAX_METADATA_STRING_LENGTH) {
        throw validationError(
          'metadata contains a string that is too long.',
          path,
          'OUT_OF_RANGE'
        );
      }

      return;
    }

    if (typeof current === 'number') {
      if (!Number.isFinite(current)) {
        throw validationError(
          'metadata must not contain non-finite numbers.',
          path,
          'INVALID_TYPE'
        );
      }

      return;
    }

    if (typeof current !== 'object') {
      throw validationError(
        'metadata contains an unsupported value.',
        path,
        'INVALID_TYPE'
      );
    }

    if (visited.has(current)) {
      throw validationError(
        'metadata must not contain circular references.',
        path,
        'INVALID_FORMAT'
      );
    }

    if (Array.isArray(current)) {
      if (current.length > MAX_METADATA_ARRAY_LENGTH) {
        throw validationError(
          `metadata arrays must not exceed ${MAX_METADATA_ARRAY_LENGTH} items.`,
          path,
          'OUT_OF_RANGE'
        );
      }
    } else if (!isPlainObject(current)) {
      throw validationError(
        'metadata must contain only plain JSON objects.',
        path,
        'INVALID_TYPE'
      );
    }

    visited.add(current);

    if (Array.isArray(current)) {
      for (let index = 0; index < current.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(current, index)) {
          throw validationError(
            'metadata must not contain sparse arrays.',
            `${path}[${index}]`,
            'INVALID_FORMAT'
          );
        }

        inspect(current[index], depth + 1, `${path}[${index}]`);
      }
    } else {
      for (const [key, child] of Object.entries(current)) {
        inspect(child, depth + 1, `${path}.${key}`);
      }
    }

    visited.delete(current);
  }

  inspect(value, 0, 'metadata');

  let serialized;

  try {
    serialized = JSON.stringify(value);
  } catch {
    throw validationError(
      'metadata must be JSON-serializable.',
      'metadata',
      'INVALID_FORMAT'
    );
  }

  if (Buffer.byteLength(serialized, 'utf8') > MAX_METADATA_BYTES) {
    throw validationError(
      `metadata must not exceed ${MAX_METADATA_BYTES} bytes.`,
      'metadata',
      'OUT_OF_RANGE'
    );
  }

  return value;
}

function validateCreate(input) {
  const body = requireObject(input);
  rejectUnknownFields(body, ALLOWED_CREATE_FIELDS);

  if (body.plan_id === undefined) {
    throw validationError(
      'plan_id is required.',
      'plan_id',
      'REQUIRED_FIELD'
    );
  }

  const result = {
    plan_id: positiveId(body.plan_id, 'plan_id'),
  };

  // Derive user identity from the authenticated session whenever possible.
  // Never trust client-supplied IDs without authorization checks.
  if (body.user_id !== undefined) {
    result.user_id = positiveId(body.user_id, 'user_id');
  }

  if (body.employer_id !== undefined) {
    result.employer_id = positiveId(body.employer_id, 'employer_id');
  }

  if (body.user_id !== undefined && body.employer_id !== undefined) {
    throw validationError(
      'Provide user_id or employer_id, not both.',
      'user_id',
      'INVALID_SUBSCRIBER'
    );
  }

  if (body.billing_cycle !== undefined) {
    result.billing_cycle = validateEnum(
      body.billing_cycle,
      'billing_cycle',
      BILLING_CYCLES
    );
  }

  if (body.currency !== undefined) {
    result.currency = validateCurrency(body.currency);
  }

  if (body.start_date !== undefined) {
    result.start_date = validateDate(body.start_date, 'start_date');
  }

  if (body.end_date !== undefined) {
    result.end_date = validateDate(body.end_date, 'end_date');
  }

  if (
    result.start_date !== undefined &&
    result.end_date !== undefined &&
    result.end_date < result.start_date
  ) {
    throw validationError(
      'end_date must be on or after start_date.',
      'end_date',
      'INVALID_DATE_RANGE'
    );
  }

  if (body.trial_days !== undefined) {
    if (
      !Number.isSafeInteger(body.trial_days) ||
      body.trial_days < 0 ||
      body.trial_days > MAX_TRIAL_DAYS
    ) {
      throw validationError(
        `trial_days must be an integer between 0 and ${MAX_TRIAL_DAYS}.`,
        'trial_days',
        'OUT_OF_RANGE'
      );
    }

    result.trial_days = body.trial_days;
  }

  if (body.metadata !== undefined) {
    result.metadata = validateMetadata(body.metadata);
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

  if (body.billing_cycle !== undefined) {
    result.billing_cycle = validateEnum(
      body.billing_cycle,
      'billing_cycle',
      BILLING_CYCLES
    );
  }

  if (body.auto_renew !== undefined) {
    result.auto_renew = validateBoolean(
      body.auto_renew,
      'auto_renew'
    );
  }

  if (body.cancel_at_period_end !== undefined) {
    result.cancel_at_period_end = validateBoolean(
      body.cancel_at_period_end,
      'cancel_at_period_end'
    );
  }

  if (body.metadata !== undefined) {
    result.metadata = validateMetadata(body.metadata);
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
      MAX_QUERY_PAGE
    );
  }

  if (query.limit !== undefined) {
    result.limit = parseBoundedInteger(
      query.limit,
      'limit',
      1,
      MAX_QUERY_LIMIT
    );
  }

  if (query.status !== undefined) {
    result.status = validateEnum(
      query.status,
      'status',
      SUBSCRIPTION_STATUSES
    );
  }

  if (query.billing_cycle !== undefined) {
    result.billing_cycle = validateEnum(
      query.billing_cycle,
      'billing_cycle',
      BILLING_CYCLES
    );
  }

  if (query.currency !== undefined) {
    result.currency = validateCurrency(query.currency);
  }

  if (query.user_id !== undefined) {
    result.user_id = positiveId(query.user_id, 'user_id');
  }

  if (query.employer_id !== undefined) {
    result.employer_id = positiveId(
      query.employer_id,
      'employer_id'
    );
  }

  if (result.user_id !== undefined && result.employer_id !== undefined) {
    throw validationError(
      'Filter by user_id or employer_id, not both.',
      'user_id',
      'INVALID_QUERY'
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
        `Unsupported subscription validation mode: ${mode}.`,
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
  validateDate,
  validateCurrency,
  validateMetadata,
  positiveId,
  BILLING_CYCLES,
  SUBSCRIPTION_STATUSES,
  SUPPORTED_CURRENCIES,
  ALLOWED_CREATE_FIELDS,
  ALLOWED_UPDATE_FIELDS,
  ALLOWED_QUERY_FIELDS,
  MAX_TRIAL_DAYS,
  MAX_METADATA_BYTES,
};