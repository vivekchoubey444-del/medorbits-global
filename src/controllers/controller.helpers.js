
'use strict';

const {
  asyncHandler,
  sendSuccess,
  httpError,
} = require('../utils/http');

const MAX_ID_LENGTH = 15;

const SAFE_HTTP_METHODS = new Set([
  'GET',
  'HEAD',
  'OPTIONS',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

/**
 * Parse a positive integer route ID.
 */
function idFrom(req, paramName = 'id') {
  if (
    !req ||
    !req.params ||
    typeof paramName !== 'string' ||
    !/^[A-Za-z][A-Za-z0-9_]*$/.test(paramName)
  ) {
    throw httpError(400, 'INVALID_ID', 'A valid record ID is required.');
  }

  const value = req.params[paramName];

  if (
    typeof value !== 'string' ||
    value.length > MAX_ID_LENGTH ||
    !/^[1-9]\d*$/.test(value)
  ) {
    throw httpError(
      400,
      'INVALID_ID',
      'A valid positive integer ID is required.'
    );
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id)) {
    throw httpError(
      400,
      'INVALID_ID',
      'A valid positive integer ID is required.'
    );
  }

  return id;
}

/**
 * Require an authenticated, active user.
 *
 * Authentication middleware must populate req.user from a trusted source.
 */
function requireUser(req) {
  const user = req && req.user;
  const userId = user && (user.id ?? user.userId);

  if (
    !user ||
    (typeof userId !== 'string' && typeof userId !== 'number') ||
    String(userId).trim() === '' ||
    (typeof userId === 'number' && !Number.isSafeInteger(userId)) ||
    (typeof userId === 'string' && userId.length > 128)
  ) {
    throw httpError(
      401,
      'UNAUTHENTICATED',
      'Authentication is required.'
    );
  }

  const status = String(user.status || '').toLowerCase();

  if (
    user.isActive === false ||
    user.active === false ||
    user.disabled === true ||
    user.suspended === true ||
    user.deletedAt != null ||
    ['disabled', 'suspended', 'deleted', 'blocked'].includes(status)
  ) {
    throw httpError(
      403,
      'ACCOUNT_UNAVAILABLE',
      'This account is not permitted to perform this operation.'
    );
  }

  return user;
}

/**
 * Require an available function.
 */
function requireFunction(target, methodName, featureName = methodName) {
  if (
    !target ||
    typeof target[methodName] !== 'function'
  ) {
    unavailable(featureName);
  }

  return target[methodName].bind(target);
}

/**
 * Throw a consistent feature-not-configured error.
 */
function unavailable(feature) {
  const name =
    typeof feature === 'string' && feature.trim()
      ? feature.trim()
      : 'This feature';

  throw httpError(
    501,
    'FEATURE_NOT_CONFIGURED',
    `${name} is not configured yet.`
  );
}

/**
 * Validate request data.
 *
 * Supported validator contract:
 *   validator.validate(body, { partial })
 *
 * The validator must return a validated plain object.
 */
function validateBody(validator, body, options = {}) {
  if (!isPlainObject(body)) {
    throw httpError(
      400,
      'INVALID_BODY',
      'A valid JSON object is required.'
    );
  }

  if (!validator || typeof validator.validate !== 'function') {
    throw httpError(
      503,
      'VALIDATOR_UNAVAILABLE',
      'Request validation is not configured.'
    );
  }

  if (!isPlainObject(options)) {
    throw new TypeError('Validation options must be a plain object.');
  }

  const result = validator.validate(body, {
    partial: options.partial === true,
  });

  if (!isPlainObject(result) || Object.keys(result).length === 0) {
    throw httpError(
      400,
      'INVALID_REQUEST_DATA',
      'Request data is invalid or empty.'
    );
  }

  return result;
}

/**
 * Reject properties not explicitly allowed.
 */
function allowFields(data, allowedFields) {
  if (!isPlainObject(data)) {
    throw httpError(
      400,
      'INVALID_REQUEST_DATA',
      'Request data must be a valid object.'
    );
  }

  if (
    !Array.isArray(allowedFields) ||
    !allowedFields.every(
      (field) => typeof field === 'string' && field.length > 0
    )
  ) {
    throw new TypeError('allowedFields must be an array of field names.');
  }

  const allowed = new Set(allowedFields);
  const unsupported = Object.keys(data).filter(
    (field) => !allowed.has(field)
  );

  if (unsupported.length > 0) {
    throw httpError(
      400,
      'UNSUPPORTED_FIELDS',
      `Unsupported fields: ${unsupported.join(', ')}.`
    );
  }

  return data;
}

/**
 * Normalize an allowlisted query object.
 */
function normalizeFilters(query, allowedFields, options = {}) {
  if (!isPlainObject(query)) {
    throw httpError(
      400,
      'INVALID_FILTERS',
      'Filters must be a valid object.'
    );
  }

  if (!Array.isArray(allowedFields)) {
    throw new TypeError('allowedFields must be an array.');
  }

  const allowed = new Set(allowedFields);
  const maxValueLength = Number.isSafeInteger(options.maxValueLength)
    ? Math.max(1, options.maxValueLength)
    : 200;

  const filters = Object.create(null);

  for (const [key, value] of Object.entries(query)) {
    if (!allowed.has(key)) {
      throw httpError(
        400,
        'INVALID_FILTER',
        `Unsupported filter: ${key}.`
      );
    }

    if (
      typeof value !== 'string' ||
      value.length > maxValueLength
    ) {
      throw httpError(
        400,
        'INVALID_FILTER_VALUE',
        `Invalid value for filter: ${key}.`
      );
    }

    const normalized = value.trim();

    if (normalized !== '') {
      filters[key] = normalized;
    }
  }

  return filters;
}

/**
 * Apply a response sanitizer when provided.
 * Sensitive resources should always use an explicit sanitizer.
 */
function safeResponse(value, sanitizer) {
  if (typeof sanitizer !== 'function') {
    return value;
  }

  const result = sanitizer(value);

  if (!isPlainObject(result)) {
    throw httpError(
      500,
      'INVALID_SANITIZER_RESPONSE',
      'The response sanitizer returned an invalid record.'
    );
  }

  return result;
}

/**
 * Check record ownership using a caller-supplied policy.
 * Only a strict true result grants access.
 */
async function requireOwnership(req, record, ownershipCheck) {
  if (typeof ownershipCheck !== 'function') {
    throw httpError(
      403,
      'OWNERSHIP_POLICY_REQUIRED',
      'An ownership policy is required for this operation.'
    );
  }

  const allowed = await ownershipCheck(req, record);

  if (allowed !== true) {
    throw httpError(
      403,
      'FORBIDDEN',
      'You are not permitted to access this record.'
    );
  }

  return record;
}

/**
 * Create reusable CRUD handlers.
 *
 * Repository contract:
 *   list(filters)
 *   findById(id)
 *   create(data)
 *   update(id, data)
 *   remove(id)
 *
 * Options:
 *   writable: false
 *   removeAllowed: false
 *   validate: false
 *   allowFields: []
 *   normalizeFilters(query)
 *   sanitize(record)
 *   authorizeOwner(req, record)
 *
 * Authentication and role-based authorization must also be configured
 * on the Express router.
 */
function crudController(repository, validator, options = {}) {
  if (!isPlainObject(repository)) {
    throw new TypeError('crudController requires a repository object.');
  }

  if (typeof repository.list !== 'function') {
    throw new TypeError('Repository must implement list(filters).');
  }

  if (typeof repository.findById !== 'function') {
    throw new TypeError('Repository must implement findById(id).');
  }

  if (!isPlainObject(options)) {
    throw new TypeError('CRUD options must be a plain object.');
  }

  if (
    options.allowFields !== undefined &&
    (!Array.isArray(options.allowFields) ||
      !options.allowFields.every(
        (field) => typeof field === 'string' && field.length > 0
      ))
  ) {
    throw new TypeError('allowFields must be an array of field names.');
  }

  for (const name of ['sanitize', 'normalizeFilters', 'authorizeOwner']) {
    if (options[name] !== undefined && typeof options[name] !== 'function') {
      throw new TypeError(`${name} must be a function.`);
    }
  }

  const writable = options.writable !== false;
  const removeAllowed = options.removeAllowed !== false;
  const validationEnabled = options.validate !== false;

  function getData(body, method) {
    const data = validationEnabled
      ? validateBody(validator, body, { partial: method === 'PATCH' })
      : body;

    if (!isPlainObject(data) || Object.keys(data).length === 0) {
      throw httpError(
        400,
        'INVALID_REQUEST_DATA',
        'Request data must be a non-empty object.'
      );
    }

    if (options.allowFields) {
      allowFields(data, options.allowFields);
    }

    return data;
  }

  function sanitize(record) {
    return safeResponse(record, options.sanitize);
  }

  async function checkOwnership(req, record) {
    if (typeof options.authorizeOwner === 'function') {
      await requireOwnership(req, record, options.authorizeOwner);
    }
  }

  return Object.freeze({
    list: asyncHandler(async (req, res) => {
      const filters =
        typeof options.normalizeFilters === 'function'
          ? options.normalizeFilters(req.query)
          : req.query;

      if (!isPlainObject(filters)) {
        throw httpError(
          400,
          'INVALID_FILTERS',
          'Filters must be a valid object.'
        );
      }

      const result = await repository.list(filters);

      if (!result || !Array.isArray(result.items)) {
        throw httpError(
          500,
          'INVALID_REPOSITORY_RESPONSE',
          'The repository returned an invalid list response.'
        );
      }

      const items = result.items.map(sanitize);
      const metadata = isPlainObject(result.pagination)
        ? { pagination: result.pagination }
        : {};

      return sendSuccess(res, items, 200, metadata);
    }),

    get: asyncHandler(async (req, res) => {
      const id = idFrom(req);
      const record = await repository.findById(id);

      if (!record) {
        throw httpError(404, 'NOT_FOUND', 'Record not found.');
      }

      await checkOwnership(req, record);

      return sendSuccess(res, sanitize(record), 200);
    }),

    create: asyncHandler(async (req, res) => {
      if (!writable) {
        unavailable('Create');
      }

      const create = requireFunction(repository, 'create', 'Create');
      const data = getData(req.body, req.method);
      const record = await create(data);

      if (!record) {
        throw httpError(
          500,
          'CREATE_FAILED',
          'The record could not be created.'
        );
      }

      return sendSuccess(res, sanitize(record), 201);
    }),

    update: asyncHandler(async (req, res) => {
      if (!writable) {
        unavailable('Update');
      }

      const id = idFrom(req);
      const existing = await repository.findById(id);

      if (!existing) {
        throw httpError(404, 'NOT_FOUND', 'Record not found.');
      }

      await checkOwnership(req, existing);

      const update = requireFunction(repository, 'update', 'Update');
      const data = getData(req.body, req.method);
      const record = await update(id, data);

      if (!record) {
        throw httpError(404, 'NOT_FOUND', 'Record not found.');
      }

      return sendSuccess(res, sanitize(record), 200);
    }),

    remove: asyncHandler(async (req, res) => {
      if (!removeAllowed) {
        unavailable('Delete');
      }

      const id = idFrom(req);
      const existing = await repository.findById(id);

      if (!existing) {
        throw httpError(404, 'NOT_FOUND', 'Record not found.');
      }

      await checkOwnership(req, existing);

      const remove = requireFunction(repository, 'remove', 'Delete');
      const removed = await remove(id);

      if (!removed) {
        throw httpError(404, 'NOT_FOUND', 'Record not found.');
      }

      return sendSuccess(res, { id, deleted: true }, 200);
    }),
  });
}

module.exports = {
  idFrom,
  requireUser,
  requireFunction,
  unavailable,
  validateBody,
  allowFields,
  normalizeFilters,
  safeResponse,
  requireOwnership,
  crudController,
  SAFE_HTTP_METHODS,
};
