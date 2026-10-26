'use strict';

const ALLOWED_CREATE_FIELDS = Object.freeze([
  'subscription_id',
  'application_id',
  'order_id',
  'amount',
  'currency',
  'payment_method',
  'description',
  'return_url',
]);

const ALLOWED_QUERY_FIELDS = Object.freeze([
  'page',
  'limit',
  'status',
  'currency',
  'from',
  'to',
]);

const ALLOWED_WEBHOOK_FIELDS = Object.freeze([
  'event',
  'type',
  'id',
  'data',
]);

const PAYMENT_METHODS = Object.freeze([
  'card',
  'upi',
  'net_banking',
  'wallet',
  'bank_transfer',
  'emi',
  'provider_checkout',
]);

const PAYMENT_STATUSES = Object.freeze([
  'created',
  'pending',
  'processing',
  'authorized',
  'paid',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded',
]);

const SUPPORTED_CURRENCIES = Object.freeze([
  'INR',
  'USD',
  'EUR',
  'GBP',
  'AED',
]);

const MAX_AMOUNT_MINOR_UNITS = 100000000000;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_ORDER_ID_LENGTH = 128;
const MAX_RETURN_URL_LENGTH = 2048;
const MAX_WEBHOOK_EVENT_LENGTH = 200;
const MAX_WEBHOOK_ID_LENGTH = 255;
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
      'body',
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

function validateAmount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw validationError(
      'amount must be a positive number.',
      'amount',
      'INVALID_AMOUNT'
    );
  }

  // Use a tolerance for ordinary floating-point representation errors.
  const minorUnits = Math.round(value * 100);

  if (
    !Number.isSafeInteger(minorUnits) ||
    Math.abs(value * 100 - minorUnits) > 1e-7
  ) {
    throw validationError(
      'amount must have no more than two decimal places.',
      'amount',
      'INVALID_AMOUNT'
    );
  }

  if (minorUnits > MAX_AMOUNT_MINOR_UNITS) {
    throw validationError(
      'amount exceeds the allowed limit.',
      'amount',
      'OUT_OF_RANGE'
    );
  }

  return minorUnits / 100;
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

function validateReturnUrl(value) {
  const raw = requireString(value, 'return_url', {
    minLength: 1,
    maxLength: MAX_RETURN_URL_LENGTH,
  });

  let url;

  try {
    url = new URL(raw);
  } catch {
    throw validationError(
      'return_url must be a valid URL.',
      'return_url',
      'INVALID_URL'
    );
  }

  if (!['https:', 'http:'].includes(url.protocol)) {
    throw validationError(
      'return_url must use HTTP or HTTPS.',
      'return_url',
      'INVALID_URL'
    );
  }

  if (!url.hostname || url.username || url.password) {
    throw validationError(
      'return_url must have a hostname and must not contain embedded credentials.',
      'return_url',
      'INVALID_URL'
    );
  }

  // Production systems should use an explicit allowlist of trusted return URLs.
  return url.toString();
}

function validatePaymentMethod(value) {
  const method = requireString(value, 'payment_method', {
    minLength: 1,
    maxLength: 40,
  }).toLowerCase();

  if (!PAYMENT_METHODS.includes(method)) {
    throw validationError(
      `payment_method must be one of: ${PAYMENT_METHODS.join(', ')}.`,
      'payment_method',
      'INVALID_ENUM'
    );
  }

  return method;
}

function validateCreate(input) {
  const body = requireObject(input);
  rejectUnknownFields(body, ALLOWED_CREATE_FIELDS);

  const hasSubscription = body.subscription_id !== undefined;
  const hasApplication = body.application_id !== undefined;

  if (hasSubscription === hasApplication) {
    throw validationError(
      'Provide exactly one of subscription_id or application_id.',
      'subscription_id',
      'INVALID_BILLABLE_REFERENCE'
    );
  }

  if (body.amount === undefined) {
    throw validationError(
      'amount is required.',
      'amount',
      'REQUIRED_FIELD'
    );
  }

  if (body.currency === undefined) {
    throw validationError(
      'currency is required.',
      'currency',
      'REQUIRED_FIELD'
    );
  }

  const result = {
    amount: validateAmount(body.amount),
    currency: validateCurrency(body.currency),
  };

  if (hasSubscription) {
    result.subscription_id = positiveId(
      body.subscription_id,
      'subscription_id'
    );
  }

  if (hasApplication) {
    result.application_id = positiveId(
      body.application_id,
      'application_id'
    );
  }

  if (body.order_id !== undefined) {
    result.order_id = requireString(body.order_id, 'order_id', {
      minLength: 1,
      maxLength: MAX_ORDER_ID_LENGTH,
    });
  }

  if (body.payment_method !== undefined) {
    result.payment_method = validatePaymentMethod(body.payment_method);
  }

  if (body.description !== undefined) {
    result.description = requireString(body.description, 'description', {
      minLength: 1,
      maxLength: MAX_DESCRIPTION_LENGTH,
    });
  }

  if (body.return_url !== undefined) {
    result.return_url = validateReturnUrl(body.return_url);
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
    const status = requireString(query.status, 'status', {
      minLength: 1,
      maxLength: 32,
    }).toLowerCase();

    if (!PAYMENT_STATUSES.includes(status)) {
      throw validationError(
        `status must be one of: ${PAYMENT_STATUSES.join(', ')}.`,
        'status',
        'INVALID_ENUM'
      );
    }

    result.status = status;
  }

  if (query.currency !== undefined) {
    result.currency = validateCurrency(query.currency);
  }

  if (query.from !== undefined) {
    result.from = validateDate(query.from, 'from');
  }

  if (query.to !== undefined) {
    result.to = validateDate(query.to, 'to');
  }

  if (
    result.from !== undefined &&
    result.to !== undefined &&
    result.from > result.to
  ) {
    throw validationError(
      'from must be on or before to.',
      'from',
      'INVALID_DATE_RANGE'
    );
  }

  return result;
}

/**
 * Structural validation only.
 *
 * Verify the provider signature against the ORIGINAL RAW request body
 * before trusting or processing webhook data. Do not use this function
 * as a substitute for signature verification or event idempotency.
 */
function validateWebhookPayload(input) {
  const body = requireObject(input, 'Webhook payload');
  rejectUnknownFields(body, ALLOWED_WEBHOOK_FIELDS);

  if (
    body.event !== undefined &&
    body.type !== undefined &&
    body.event !== body.type
  ) {
    throw validationError(
      'Webhook event and type fields must match when both are provided.',
      'event',
      'INVALID_WEBHOOK_EVENT'
    );
  }

  const event = body.event !== undefined ? body.event : body.type;

  if (event === undefined) {
    throw validationError(
      'Webhook event or type is required.',
      'event',
      'REQUIRED_FIELD'
    );
  }

  const normalizedEvent = requireString(event, 'event', {
    minLength: 1,
    maxLength: MAX_WEBHOOK_EVENT_LENGTH,
  });

  const result = {
    event: normalizedEvent,
  };

  if (body.id !== undefined) {
    result.id = requireString(body.id, 'id', {
      minLength: 1,
      maxLength: MAX_WEBHOOK_ID_LENGTH,
    });
  }

  if (body.data !== undefined) {
    result.data = requireObject(body.data, 'Webhook data');
  }

  return result;
}

function validate(input, mode = 'create') {
  switch (mode) {
    case 'create':
      return validateCreate(input);

    case 'query':
      return validateQuery(input);

    case 'webhook':
      return validateWebhookPayload(input);

    default:
      throw validationError(
        `Unsupported payment validation mode: ${mode}.`,
        'mode',
        'INVALID_VALIDATION_MODE'
      );
  }
}

module.exports = {
  validate,
  validateCreate,
  validateQuery,
  validateWebhookPayload,
  validateAmount,
  validateCurrency,
  validateReturnUrl,
  validatePaymentMethod,
  validateDate,
  positiveId,
  ALLOWED_CREATE_FIELDS,
  ALLOWED_QUERY_FIELDS,
  ALLOWED_WEBHOOK_FIELDS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  SUPPORTED_CURRENCIES,
  MAX_AMOUNT_MINOR_UNITS,
};