'use strict';

const {
  asyncHandler,
  sendSuccess,
  httpError,
} = require('../utils/http');

const { requireUser } = require('./controller.helpers');
const repository = require('../repositories/application.repository');
const validator = require('../validators/application.validator');

const controller = Object.create(null);

const APPLICATION_DEFAULT_STATUS = 'draft';
const ADMIN_ROLE = 'admin';
const READ_ANY_PERMISSION = 'applications:read:any';

function parseId(value) {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    throw httpError(
      400,
      'INVALID_ID',
      'A valid positive integer ID is required.'
    );
  }

  if (
    typeof value === 'string' &&
    !/^[1-9]\d*$/.test(value)
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

function authenticatedUserId(req) {
  const user = requireUser(req);
  const id = Number(user.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    throw httpError(
      401,
      'INVALID_AUTHENTICATED_USER',
      'The authenticated user is invalid.'
    );
  }

  return id;
}

function normalizeStrings(value) {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string');
  }

  return [];
}

function canReadAny(req) {
  const user = req.user;

  if (!user || typeof user !== 'object') {
    return false;
  }

  const roles = normalizeStrings(user.roles ?? user.role);
  const permissions = normalizeStrings(user.permissions);

  return (
    roles.includes(ADMIN_ROLE) ||
    permissions.includes(READ_ANY_PERMISSION)
  );
}

function assertOwnerOrAdmin(req, application, userId) {
  if (!application || typeof application !== 'object') {
    throw httpError(404, 'NOT_FOUND', 'Application not found.');
  }

  if (canReadAny(req)) {
    return;
  }

  const ownerId = Number(application.user_id);

  if (!Number.isSafeInteger(ownerId) || ownerId !== userId) {
    throw httpError(404, 'NOT_FOUND', 'Application not found.');
  }
}

function assertValidatorAvailable() {
  if (!validator || typeof validator.validate !== 'function') {
    throw httpError(
      503,
      'VALIDATOR_UNAVAILABLE',
      'Application validation is not configured.'
    );
  }
}

function validateBody(body) {
  assertValidatorAvailable();

  return validator.validate(body);
}

function assertRequestBodyObject(body) {
  if (
    body === null ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    throw httpError(
      400,
      'INVALID_REQUEST_BODY',
      'The request body must be a JSON object.'
    );
  }
}

function rejectProtectedFields(body, message) {
  assertRequestBodyObject(body);

  const protectedFields = ['user_id', 'status'];

  if (
    protectedFields.some((field) =>
      Object.prototype.hasOwnProperty.call(body, field)
    )
  ) {
    throw httpError(400, 'PROTECTED_FIELDS', message);
  }
}

function assertRepositoryListResponse(result) {
  if (
    !result ||
    typeof result !== 'object' ||
    !Array.isArray(result.items)
  ) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The application repository returned an invalid list response.'
    );
  }

  if (
    result.pagination !== undefined &&
    (
      result.pagination === null ||
      typeof result.pagination !== 'object' ||
      Array.isArray(result.pagination)
    )
  ) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The application repository returned invalid pagination metadata.'
    );
  }
}

function assertApplicationRecord(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The application repository returned an invalid record.'
    );
  }
}

/**
 * GET /applications
 *
 * Lists applications. Non-privileged users are always scoped to their own
 * records, regardless of any user_id supplied in query parameters.
 *
 * Important: query validation should be added once the application's
 * application-query validator contract is confirmed.
 */
controller.list = asyncHandler(async (req, res) => {
  const userId = authenticatedUserId(req);
  const canReadAll = canReadAny(req);

  const filters = {
    ...req.query,
  };

  // Never allow a client-supplied owner filter to override the authenticated
  // user's scope.
  if (!canReadAll) {
    filters.user_id = userId;
  }

  const result = await repository.list(filters);

  assertRepositoryListResponse(result);

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
 * GET /applications/:id
 *
 * Retrieves an application after checking ownership or read-any permission.
 */
controller.get = asyncHandler(async (req, res) => {
  const userId = authenticatedUserId(req);
  const id = parseId(req.params.id);
  const item = await repository.findById(id);

  if (!item) {
    throw httpError(404, 'NOT_FOUND', 'Application not found.');
  }

  assertApplicationRecord(item);
  assertOwnerOrAdmin(req, item, userId);

  return sendSuccess(res, item);
});

/**
 * POST /applications
 *
 * Creates an application owned by the authenticated user.
 * The client cannot choose the owner or initial status.
 */
controller.create = asyncHandler(async (req, res) => {
  const userId = authenticatedUserId(req);

  rejectProtectedFields(
    req.body,
    'user_id and status are assigned by the server.'
  );

  const data = validateBody(req.body);

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw httpError(
      500,
      'INVALID_VALIDATOR_RESPONSE',
      'Application validation returned an invalid result.'
    );
  }

  // Defend against validators that accidentally pass protected properties
  // through, even though the request-level check above should reject them.
  const safeData = { ...data };
  delete safeData.user_id;
  delete safeData.status;

  const item = await repository.create({
    ...safeData,
    user_id: userId,
    status: APPLICATION_DEFAULT_STATUS,
  });

  if (!item) {
    throw httpError(
      500,
      'APPLICATION_CREATE_FAILED',
      'The application could not be created.'
    );
  }

  assertApplicationRecord(item);

  return sendSuccess(res, item, 201);
});

/**
 * PUT/PATCH /applications/:id
 *
 * Updates an application after ownership checks. State transitions should be
 * handled by a dedicated service rather than this generic update endpoint.
 */
controller.update = asyncHandler(async (req, res) => {
  const userId = authenticatedUserId(req);
  const id = parseId(req.params.id);
  const existing = await repository.findById(id);

  if (!existing) {
    throw httpError(404, 'NOT_FOUND', 'Application not found.');
  }

  assertApplicationRecord(existing);
  assertOwnerOrAdmin(req, existing, userId);

  rejectProtectedFields(
    req.body,
    'user_id and status cannot be changed through this endpoint.'
  );

  const data = validateBody(req.body);

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw httpError(
      500,
      'INVALID_VALIDATOR_RESPONSE',
      'Application validation returned an invalid result.'
    );
  }

  const safeData = { ...data };
  delete safeData.user_id;
  delete safeData.status;

  const item = await repository.update(id, safeData);

  if (!item) {
    throw httpError(404, 'NOT_FOUND', 'Application not found.');
  }

  assertApplicationRecord(item);

  return sendSuccess(res, item);
});

/**
 * DELETE /applications/:id
 *
 * Allows deletion of draft applications by their owners. A privileged user
 * with applications:read:any can bypass the draft-only restriction.
 *
 * If administrators should also be restricted to drafts, remove that bypass.
 */
controller.remove = asyncHandler(async (req, res) => {
  const userId = authenticatedUserId(req);
  const id = parseId(req.params.id);
  const existing = await repository.findById(id);

  if (!existing) {
    throw httpError(404, 'NOT_FOUND', 'Application not found.');
  }

  assertApplicationRecord(existing);
  assertOwnerOrAdmin(req, existing, userId);

  if (!canReadAny(req) && existing.status !== APPLICATION_DEFAULT_STATUS) {
    throw httpError(
      409,
      'INVALID_STATE',
      'Only draft applications can be deleted.'
    );
  }

  const removed = await repository.remove(id);

  if (!removed) {
    throw httpError(404, 'NOT_FOUND', 'Application not found.');
  }

  return sendSuccess(res, {
    id,
    deleted: true,
  });
});

controller.listMine = controller.list;
controller.getById = controller.get;

module.exports = controller;