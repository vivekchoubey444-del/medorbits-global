
'use strict';

/**
 * MedOrbits -- User Controller
 *
 * File: src/controllers/user.controller.js
 * Runtime: Node.js >= 20
 *
 * Security:
 * - Validates route identifiers and request bodies.
 * - Uses explicit field allowlists for updates.
 * - Requires authorization to be enforced by route middleware
 *   and resource policies.
 * - Prevents accidental exposure of sensitive user fields.
 */

const {
  asyncHandler,
  sendSuccess,
  httpError,
} = require('../utils/http');

const repository = require('../repositories/user.repository');
const validator = require('../validators/auth.validator');

const controller = Object.create(null);

const USER_WRITABLE_FIELDS = Object.freeze([
  'firstName',
  'lastName',
  'email',
  'phone',
]);

const USER_LIST_FILTERS = Object.freeze([
  'search',
  'role',
  'status',
  'page',
  'limit',
  'sortBy',
  'sortOrder',
]);

const USER_RESPONSE_FIELDS = Object.freeze([
  'id',
  'firstName',
  'first_name',
  'lastName',
  'last_name',
  'email',
  'phone',
  'role',
  'status',
  'isActive',
  'is_active',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
]);

function parseId(value) {
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d{0,14}$/.test(value)
  ) {
    throw httpError(
      400,
      'INVALID_ID',
      'A valid positive integer ID is required.'
    );
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id < 1) {
    throw httpError(
      400,
      'INVALID_ID',
      'A valid positive integer ID is required.'
    );
  }

  return id;
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function validateBody(body, { partial = false } = {}) {
  if (!validator || typeof validator.validate !== 'function') {
    throw httpError(
      503,
      'VALIDATOR_UNAVAILABLE',
      'Request validation is not configured.'
    );
  }

  if (!isPlainObject(body)) {
    throw httpError(
      400,
      'INVALID_REQUEST_BODY',
      'The request body must be a JSON object.'
    );
  }

  let data;

  try {
    // This controller expects the validator to return validated data.
    data = validator.validate(body, { partial });
  } catch (error) {
    if (error?.status && error.status >= 400 && error.status < 500) {
      throw error;
    }

    throw error;
  }

  if (!isPlainObject(data)) {
    throw httpError(
      400,
      'INVALID_REQUEST_BODY',
      'The validated request body is invalid.'
    );
  }

  return data;
}

function allowFields(data, allowedFields) {
  const allowed = new Set(allowedFields);
  const result = Object.create(null);

  for (const [key, value] of Object.entries(data)) {
    if (!allowed.has(key)) {
      throw httpError(
        400,
        'UNSUPPORTED_FIELD',
        `The field "${key}" cannot be changed through this endpoint.`
      );
    }

    result[key] = value;
  }

  if (Object.keys(result).length === 0) {
    throw httpError(
      400,
      'EMPTY_UPDATE',
      'At least one supported field must be supplied.'
    );
  }

  return result;
}

function normalizeListFilters(query) {
  if (!isPlainObject(query)) {
    throw httpError(
      400,
      'INVALID_QUERY',
      'Query parameters are invalid.'
    );
  }

  const filters = Object.create(null);
  const allowed = new Set(USER_LIST_FILTERS);

  for (const [key, value] of Object.entries(query)) {
    if (!allowed.has(key)) {
      throw httpError(
        400,
        'UNSUPPORTED_QUERY_PARAMETER',
        `The query parameter "${key}" is not supported.`
      );
    }

    if (typeof value !== 'string' || value.length > 200) {
      throw httpError(
        400,
        'INVALID_QUERY_PARAMETER',
        `The query parameter "${key}" is invalid.`
      );
    }

    filters[key] = value.trim();
  }

  return filters;
}

function toSafeUser(item) {
  if (!isPlainObject(item)) {
    throw httpError(
      500,
      'INVALID_USER_RECORD',
      'The user repository returned an invalid user record.'
    );
  }

  const result = Object.create(null);

  for (const key of USER_RESPONSE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(item, key)) {
      result[key] = item[key];
    }
  }

  return result;
}

/**
 * GET /users
 *
 * Authorization should restrict this endpoint to users permitted
 * to list accounts. Repository filters must also be allowlisted.
 */
controller.list = asyncHandler(async (req, res) => {
  const filters = normalizeListFilters(req.query || {});
  const result = await repository.list(filters);

  if (
    !isPlainObject(result) ||
    !Array.isArray(result.items)
  ) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The user repository returned an invalid list response.'
    );
  }

  const items = result.items.map(toSafeUser);

  return sendSuccess(
    res,
    items,
    200,
    result.pagination
      ? { pagination: result.pagination }
      : {}
  );
});

/**
 * GET /users/:id
 *
 * Private user data must be protected by route middleware and
 * resource-level authorization.
 */
controller.get = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const item = await repository.findById(id);

  if (!item) {
    throw httpError(404, 'NOT_FOUND', 'User not found.');
  }

  return sendSuccess(res, toSafeUser(item));
});

/**
 * POST /users
 *
 * Account creation should normally be handled by the registration
 * workflow. This endpoint must not accept roles, permissions,
 * verification flags, password hashes, or account status overrides.
 */
controller.create = asyncHandler(async (req, res) => {
  const validated = validateBody(req.body);
  const data = allowFields(validated, USER_WRITABLE_FIELDS);

  const item = await repository.create(data);

  if (!item) {
    throw httpError(
      500,
      'USER_CREATE_FAILED',
      'The user could not be created.'
    );
  }

  return sendSuccess(res, toSafeUser(item), 201);
});

/**
 * PUT/PATCH /users/:id
 *
 * This endpoint only allows basic profile fields.
 * Use a dedicated service for password, role, permission, verification,
 * account status, or other privileged changes.
 */
controller.update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const validated = validateBody(req.body, { partial: true });
  const data = allowFields(validated, USER_WRITABLE_FIELDS);

  const item = await repository.update(id, data);

  if (!item) {
    throw httpError(404, 'NOT_FOUND', 'User not found.');
  }

  return sendSuccess(res, toSafeUser(item));
});

/**
 * DELETE /users/:id
 *
 * Must be protected by privileged authorization and applicable
 * user/account lifecycle policies.
 */
controller.remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const removed = await repository.remove(id);

  if (!removed) {
    throw httpError(404, 'NOT_FOUND', 'User not found.');
  }

  return sendSuccess(res, {
    id,
    deleted: true,
  });
});

module.exports = controller;
