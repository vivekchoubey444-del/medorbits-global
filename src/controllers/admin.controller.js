
'use strict';

/**
 * MedOrbits -- Admin Controller
 *
 * File: src/controllers/admin.controller.js
 *
 * Purpose:
 * - Provide administrative dashboard statistics.
 * - List and inspect users.
 * - Update user account status through an administrative workflow.
 * - Expose health and operational summaries where supported.
 *
 * Security:
 * - Requires an authenticated administrator with explicit permissions.
 * - Never trusts client-supplied roles or ownership identifiers.
 * - Uses allowlisted query parameters and update fields.
 * - Delegates business rules and persistence to repositories/services.
 *
 * IMPORTANT:
 * Repository and service method names must match the actual MedOrbits
 * implementation. Unsupported operations fail closed with HTTP 503.
 */

const {
  asyncHandler,
  sendSuccess,
  httpError,
} = require('../utils/http');

const { requireUser } = require('./controller.helpers');

const controller = Object.create(null);

const ADMIN_ROLE = 'admin';
const SUPER_ADMIN_ROLE = 'super_admin';

const PERMISSIONS = Object.freeze({
  DASHBOARD_READ: 'admin:dashboard:read',
  USERS_READ: 'admin:users:read',
  USERS_UPDATE: 'admin:users:update',
});

const USER_STATUSES = Object.freeze([
  'pending',
  'active',
  'inactive',
  'suspended',
]);

const LIST_QUERY_FIELDS = Object.freeze([
  'page',
  'limit',
  'search',
  'status',
  'role',
]);

const USER_UPDATE_FIELDS = Object.freeze([
  'status',
]);

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 120;

function fail(status, code, message) {
  throw httpError(status, code, message);
}

function authenticatedUser(req) {
  const user = requireUser(req);

  if (!user || typeof user !== 'object') {
    fail(401, 'UNAUTHENTICATED', 'Authentication is required.');
  }

  return user;
}

function asStringArray(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string');
  }

  if (typeof value === 'string') {
    return [value];
  }

  return [];
}

function hasAdminRole(user) {
  const roles = [
    ...asStringArray(user.roles),
    ...asStringArray(user.role),
  ];

  return (
    roles.includes(ADMIN_ROLE) ||
    roles.includes(SUPER_ADMIN_ROLE)
  );
}

function hasPermission(user, permission) {
  if (hasAdminRole(user)) {
    return true;
  }

  return asStringArray(user.permissions).includes(permission);
}

function requirePermission(req, permission) {
  const user = authenticatedUser(req);

  if (!hasPermission(user, permission)) {
    fail(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
  }

  return user;
}

function parsePositiveId(value, fieldName = 'id') {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    fail(400, 'INVALID_ID', `A valid ${fieldName} is required.`);
  }

  if (
    typeof value === 'string' &&
    !/^[1-9]\d*$/.test(value)
  ) {
    fail(400, 'INVALID_ID', `A valid ${fieldName} is required.`);
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id < 1) {
    fail(400, 'INVALID_ID', `A valid ${fieldName} is required.`);
  }

  return id;
}

function parseInteger(value, fieldName, min, max, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const stringValue = String(value);

  if (!/^\d+$/.test(stringValue)) {
    fail(400, 'INVALID_QUERY_PARAMETER', `${fieldName} must be an integer.`);
  }

  const number = Number(stringValue);

  if (
    !Number.isSafeInteger(number) ||
    number < min ||
    number > max
  ) {
    fail(
      400,
      'INVALID_QUERY_PARAMETER',
      `${fieldName} must be between ${min} and ${max}.`
    );
  }

  return number;
}

function assertPlainObject(value, message = 'The request body must be a JSON object.') {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    fail(400, 'INVALID_REQUEST_BODY', message);
  }
}

function rejectUnknownFields(input, allowedFields) {
  const unknownFields = Object.keys(input).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unknownFields.length > 0) {
    fail(
      400,
      'UNKNOWN_FIELDS',
      'The request contains unsupported fields.'
    );
  }
}

function parseListQuery(query) {
  assertPlainObject(query, 'Query parameters are invalid.');

  rejectUnknownFields(query, LIST_QUERY_FIELDS);

  const page = parseInteger(
    query.page,
    'page',
    1,
    Number.MAX_SAFE_INTEGER,
    DEFAULT_PAGE
  );

  const limit = parseInteger(
    query.limit,
    'limit',
    1,
    MAX_LIMIT,
    DEFAULT_LIMIT
  );

  const filters = { page, limit };

  if (query.search !== undefined) {
    if (typeof query.search !== 'string') {
      fail(
        400,
        'INVALID_QUERY_PARAMETER',
        'search must be a string.'
      );
    }

    const search = query.search.trim();

    if (search.length > MAX_SEARCH_LENGTH) {
      fail(
        400,
        'INVALID_QUERY_PARAMETER',
        `search must not exceed ${MAX_SEARCH_LENGTH} characters.`
      );
    }

    if (/[\u0000-\u001F\u007F]/.test(search)) {
      fail(
        400,
        'INVALID_QUERY_PARAMETER',
        'search contains unsupported characters.'
      );
    }

    if (search) {
      filters.search = search;
    }
  }

  if (query.status !== undefined) {
    if (
      typeof query.status !== 'string' ||
      !USER_STATUSES.includes(query.status)
    ) {
      fail(
        400,
        'INVALID_QUERY_PARAMETER',
        'status is not supported.'
      );
    }

    filters.status = query.status;
  }

  if (query.role !== undefined) {
    if (
      typeof query.role !== 'string' ||
      !/^[a-z][a-z0-9_]{1,39}$/.test(query.role)
    ) {
      fail(
        400,
        'INVALID_QUERY_PARAMETER',
        'role is invalid.'
      );
    }

    filters.role = query.role;
  }

  const offset = (page - 1) * limit;

  if (!Number.isSafeInteger(offset)) {
    fail(
      400,
      'INVALID_QUERY_PARAMETER',
      'The requested pagination offset is too large.'
    );
  }

  return {
    ...filters,
    offset,
  };
}

function getRepository() {
  try {
    return require('../repositories/user.repository');
  } catch {
    fail(
      503,
      'ADMIN_SERVICE_UNAVAILABLE',
      'The administrative user service is not configured.'
    );
  }
}

function getDashboardService() {
  try {
    return require('../services/admin.service');
  } catch {
    fail(
      503,
      'ADMIN_SERVICE_UNAVAILABLE',
      'The administrative dashboard service is not configured.'
    );
  }
}

function assertRecord(record, message = 'The requested record was not found.') {
  if (
    !record ||
    typeof record !== 'object' ||
    Array.isArray(record)
  ) {
    fail(404, 'NOT_FOUND', message);
  }
}

function validateUserStatusUpdate(body) {
  assertPlainObject(body);
  rejectUnknownFields(body, USER_UPDATE_FIELDS);

  if (!Object.prototype.hasOwnProperty.call(body, 'status')) {
    fail(400, 'VALIDATION_ERROR', 'status is required.');
  }

  if (
    typeof body.status !== 'string' ||
    !USER_STATUSES.includes(body.status)
  ) {
    fail(400, 'VALIDATION_ERROR', 'status is not supported.');
  }

  return { status: body.status };
}

/**
 * GET /admin/dashboard
 *
 * Expected service contract:
 * adminService.getDashboardSummary()
 */
controller.dashboard = asyncHandler(async (req, res) => {
  requirePermission(req, PERMISSIONS.DASHBOARD_READ);

  const service = getDashboardService();

  if (typeof service.getDashboardSummary !== 'function') {
    fail(
      503,
      'ADMIN_OPERATION_UNAVAILABLE',
      'Dashboard statistics are not configured.'
    );
  }

  const summary = await service.getDashboardSummary();

  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    fail(
      500,
      'INVALID_SERVICE_RESPONSE',
      'The dashboard service returned an invalid response.'
    );
  }

  return sendSuccess(res, summary);
});

/**
 * GET /admin/users
 *
 * Expected repository contract:
 * userRepository.listAdmin(filters)
 *
 * listAdmin must return { items: [], pagination?: {} } and must use
 * parameterized queries with allowlisted sorting in the repository layer.
 */
controller.listUsers = asyncHandler(async (req, res) => {
  requirePermission(req, PERMISSIONS.USERS_READ);

  const filters = parseListQuery(req.query);
  const repository = getRepository();

  if (typeof repository.listAdmin !== 'function') {
    fail(
      503,
      'ADMIN_OPERATION_UNAVAILABLE',
      'Administrative user listing is not configured.'
    );
  }

  const result = await repository.listAdmin(filters);

  if (
    !result ||
    typeof result !== 'object' ||
    !Array.isArray(result.items)
  ) {
    fail(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The user repository returned an invalid list response.'
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
 * GET /admin/users/:id
 *
 * Expected repository contract:
 * userRepository.findAdminById(id)
 *
 * This method should return only fields suitable for administrative display.
 * Never return password hashes, reset tokens, OTP values, or session secrets.
 */
controller.getUser = asyncHandler(async (req, res) => {
  requirePermission(req, PERMISSIONS.USERS_READ);

  const id = parsePositiveId(req.params.id, 'user ID');
  const repository = getRepository();

  if (typeof repository.findAdminById !== 'function') {
    fail(
      503,
      'ADMIN_OPERATION_UNAVAILABLE',
      'Administrative user lookup is not configured.'
    );
  }

  const user = await repository.findAdminById(id);

  assertRecord(user, 'User not found.');

  return sendSuccess(res, user);
});

/**
 * PATCH /admin/users/:id/status
 *
 * Expected service contract:
 * adminService.updateUserStatus({ userId, status, actorId })
 *
 * Status transitions, self-suspension rules, role hierarchy, audit logging,
 * and transactional persistence must be enforced by the service.
 */
controller.updateUserStatus = asyncHandler(async (req, res) => {
  const actor = requirePermission(req, PERMISSIONS.USERS_UPDATE);
  const userId = parsePositiveId(req.params.id, 'user ID');
  const { status } = validateUserStatusUpdate(req.body);
  const actorId = parsePositiveId(actor.id, 'authenticated user ID');

  const service = getDashboardService();

  if (typeof service.updateUserStatus !== 'function') {
    fail(
      503,
      'ADMIN_OPERATION_UNAVAILABLE',
      'Administrative user status updates are not configured.'
    );
  }

  const updatedUser = await service.updateUserStatus({
    userId,
    status,
    actorId,
  });

  assertRecord(updatedUser, 'User not found.');

  return sendSuccess(res, updatedUser);
});

/**
 * GET /admin/health
 *
 * Returns a minimal controller-level readiness response. This is not a
 * substitute for an infrastructure health endpoint or dependency check.
 *
 * Protect this endpoint if your deployment does not intend it to be public.
 */
controller.health = asyncHandler(async (req, res) => {
  requirePermission(req, PERMISSIONS.DASHBOARD_READ);

  return sendSuccess(res, {
    status: 'ok',
    component: 'admin-controller',
  });
});

// Compatibility aliases for routes using alternate naming conventions.
controller.getDashboard = controller.dashboard;
controller.getUsers = controller.listUsers;
controller.getUserById = controller.getUser;

module.exports = controller;
