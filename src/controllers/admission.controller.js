
'use strict';

/**
 * MedOrbits -- Admission Controller
 *
 * File: src/controllers/admission.controller.js
 *
 * Handles admission-related application operations.
 *
 * IMPORTANT:
 * This controller uses the existing application repository and admission
 * validator referenced in the MedOrbits controller structure. Confirm that
 * their schemas and method contracts match your actual implementation.
 */

const {
  asyncHandler,
  sendSuccess,
  httpError,
} = require('../utils/http');

const { requireUser } = require('./controller.helpers');

const repository = require('../repositories/application.repository');
const validator = require('../validators/admission.validator');

const controller = Object.create(null);

const INITIAL_STATUS = 'draft';

const PROTECTED_FIELDS = Object.freeze([
  'id',
  'user_id',
  'status',
]);

function fail(status, code, message) {
  throw httpError(status, code, message);
}

function parseId(value, field = 'id') {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    fail(400, 'INVALID_ID', `A valid positive integer ${field} is required.`);
  }

  if (
    typeof value === 'string' &&
    !/^[1-9]\d*$/.test(value)
  ) {
    fail(400, 'INVALID_ID', `A valid positive integer ${field} is required.`);
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id < 1) {
    fail(400, 'INVALID_ID', `A valid positive integer ${field} is required.`);
  }

  return id;
}

function authenticatedUserId(req) {
  const user = requireUser(req);
  const userId = Number(user.id);

  if (!Number.isSafeInteger(userId) || userId < 1) {
    fail(
      401,
      'INVALID_AUTHENTICATED_USER',
      'The authenticated user is invalid.'
    );
  }

  return userId;
}

function hasPermission(req, permission) {
  const user = req.user;

  if (!user || typeof user !== 'object') {
    return false;
  }

  const roles = [
    ...(Array.isArray(user.roles) ? user.roles : []),
    ...(typeof user.role === 'string' ? [user.role] : []),
  ];

  const permissions = Array.isArray(user.permissions)
    ? user.permissions
    : [];

  return (
    roles.includes('admin') ||
    roles.includes('super_admin') ||
    permissions.includes(permission)
  );
}

function canReadAny(req) {
  return hasPermission(req, 'applications:read:any');
}

function canManageAny(req) {
  return hasPermission(req, 'applications:manage:any');
}

function assertPlainObject(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    fail(
      400,
      'INVALID_REQUEST_BODY',
      'The request body must be a JSON object.'
    );
  }
}

function rejectProtectedFields(body, message) {
  assertPlainObject(body);

  if (
    PROTECTED_FIELDS.some((field) =>
      Object.prototype.hasOwnProperty.call(body, field)
    )
  ) {
    fail(400, 'PROTECTED_FIELDS', message);
  }
}

function validateBody(body) {
  assertPlainObject(body);

  if (!validator || typeof validator.validate !== 'function') {
    fail(
      503,
      'VALIDATOR_UNAVAILABLE',
      'Admission validation is not configured.'
    );
  }

  const result = validator.validate(body);

  if (
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result)
  ) {
    fail(
      500,
      'INVALID_VALIDATOR_RESPONSE',
      'Admission validation returned an invalid result.'
    );
  }

  return result;
}

function stripProtectedFields(data) {
  const safeData = { ...data };

  for (const field of PROTECTED_FIELDS) {
    delete safeData[field];
  }

  return safeData;
}

function assertRecord(item) {
  if (
    !item ||
    typeof item !== 'object' ||
    Array.isArray(item)
  ) {
    fail(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The admission repository returned an invalid record.'
    );
  }
}

function assertOwnerOrAdmin(req, item, userId) {
  assertRecord(item);

  if (canReadAny(req) || canManageAny(req)) {
    return;
  }

  const ownerId = Number(item.user_id);

  if (!Number.isSafeInteger(ownerId) || ownerId !== userId) {
    fail(404, 'NOT_FOUND', 'Admission application not found.');
  }
}

function validateListQuery(query) {
  assertPlainObject(query);

  const allowedFields = [
    'page',
    'limit',
    'status',
    'course_id',
    'university_id',
    'intake',
    'search',
  ];

  const unknownFields = Object.keys(query).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unknownFields.length > 0) {
    fail(
      400,
      'UNKNOWN_QUERY_FIELDS',
      'The query contains unsupported fields.'
    );
  }

  const filters = {};

  if (query.page !== undefined) {
    filters.page = parseId(query.page, 'page');
  } else {
    filters.page = 1;
  }

  if (query.limit !== undefined) {
    filters.limit = parseId(query.limit, 'limit');

    if (filters.limit > 100) {
      fail(
        400,
        'INVALID_LIMIT',
        'The page limit must not exceed 100.'
      );
    }
  } else {
    filters.limit = 20;
  }

  if (query.status !== undefined) {
    if (
      typeof query.status !== 'string' ||
      !/^[a-z][a-z0-9_]{0,39}$/.test(query.status)
    ) {
      fail(400, 'INVALID_STATUS', 'The status filter is invalid.');
    }

    filters.status = query.status;
  }

  for (const field of ['course_id', 'university_id']) {
    if (query[field] !== undefined) {
      filters[field] = parseId(query[field], field);
    }
  }

  if (query.intake !== undefined) {
    if (
      typeof query.intake !== 'string' ||
      query.intake.trim().length === 0 ||
      query.intake.trim().length > 100
    ) {
      fail(400, 'INVALID_INTAKE', 'The intake filter is invalid.');
    }

    filters.intake = query.intake.trim();
  }

  if (query.search !== undefined) {
    if (
      typeof query.search !== 'string' ||
      query.search.trim().length > 120 ||
      /[\u0000-\u001F\u007F]/.test(query.search)
    ) {
      fail(400, 'INVALID_SEARCH', 'The search filter is invalid.');
    }

    if (query.search.trim()) {
      filters.search = query.search.trim();
    }
  }

  const offset = (filters.page - 1) * filters.limit;

  if (!Number.isSafeInteger(offset)) {
    fail(400, 'INVALID_PAGINATION', 'The requested page is too large.');
  }

  return {
    ...filters,
    offset,
  };
}

/**
 * GET /admissions
 *
 * Lists admission applications. Users are scoped to their own records unless
 * they hold a server-assigned permission to read across users.
 */
controller.list = asyncHandler(async (req, res) => {
  const userId = authenticatedUserId(req);
  const filters = validateListQuery(req.query);

  if (!canReadAny(req) && !canManageAny(req)) {
    filters.user_id = userId;
  }

  const result = await repository.list(filters);

  if (
    !result ||
    typeof result !== 'object' ||
    !Array.isArray(result.items)
  ) {
    fail(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The admission repository returned an invalid list response.'
    );
  }

  return sendSuccess(
    res,
    result.items,
    200,
    result.pagination
      ? { pagination: result.pagination }
      : {}
  );
});

/**
 * GET /admissions/:id
 *
 * Retrieves an admission application after ownership checks.
 */
controller.get = asyncHandler(async (req, res) => {
  const userId = authenticatedUserId(req);
  const id = parseId(req.params.id);
  const item = await repository.findById(id);

  if (!item) {
    fail(404, 'NOT_FOUND', 'Admission application not found.');
  }

  assertOwnerOrAdmin(req, item, userId);

  return sendSuccess(res, item);
});

/**
 * POST /admissions
 *
 * Creates a draft admission application owned by the authenticated user.
 */
controller.create = asyncHandler(async (req, res) => {
  const userId = authenticatedUserId(req);

  rejectProtectedFields(
    req.body,
    'id, user_id, and status are assigned by the server.'
  );

  const data = stripProtectedFields(validateBody(req.body));

  const item = await repository.create({
    ...data,
    user_id: userId,
    status: INITIAL_STATUS,
  });

  if (!item) {
    fail(
      500,
      'ADMISSION_CREATE_FAILED',
      'The admission application could not be created.'
    );
  }

  assertRecord(item);

  return sendSuccess(res, item, 201);
});

/**
 * PATCH/PUT /admissions/:id
 *
 * Updates an existing admission application without allowing direct ownership
 * or status changes. Business-specific transitions belong in a service.
 */
controller.update = asyncHandler(async (req, res) => {
  const userId = authenticatedUserId(req);
  const id = parseId(req.params.id);
  const existing = await repository.findById(id);

  if (!existing) {
    fail(404, 'NOT_FOUND', 'Admission application not found.');
  }

  assertOwnerOrAdmin(req, existing, userId);

  rejectProtectedFields(
    req.body,
    'id, user_id, and status cannot be changed through this endpoint.'
  );

  const data = stripProtectedFields(validateBody(req.body));
  const item = await repository.update(id, data);

  if (!item) {
    fail(404, 'NOT_FOUND', 'Admission application not found.');
  }

  // Recheck ownership in case the repository returns an unexpected record.
  assertOwnerOrAdmin(req, item, userId);

  return sendSuccess(res, item);
});

/**
 * DELETE /admissions/:id
 *
 * Owners may delete draft applications. Privileged deletion requires the
 * explicit applications:manage:any permission.
 */
controller.remove = asyncHandler(async (req, res) => {
  const userId = authenticatedUserId(req);
  const id = parseId(req.params.id);
  const existing = await repository.findById(id);

  if (!existing) {
    fail(404, 'NOT_FOUND', 'Admission application not found.');
  }

  assertOwnerOrAdmin(req, existing, userId);

  if (
    !canManageAny(req) &&
    existing.status !== INITIAL_STATUS
  ) {
    fail(
      409,
      'INVALID_STATE',
      'Only draft admission applications can be deleted.'
    );
  }

  const removed = await repository.remove(id);

  if (!removed) {
    fail(404, 'NOT_FOUND', 'Admission application not found.');
  }

  return sendSuccess(res, {
    id,
    deleted: true,
  });
});

controller.listMine = controller.list;
controller.getById = controller.get;

module.exports = controller;
