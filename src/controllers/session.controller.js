
'use strict';

const {
  crudController,
  normalizeFilters,
  requireUser,
} = require('./controller.helpers');

const { httpError } = require('../utils/http');

const repository = require('../repositories/session.repository');
const validator = require('../validators/session.validator');

const WRITABLE_FIELDS = Object.freeze([
  'title',
  'description',
  'sessionType',
  'courseId',
  'counsellorId',
  'scheduledAt',
  'startAt',
  'endAt',
  'timezone',
  'durationMinutes',
  'meetingUrl',
  'location',
  'agenda',
  'status',
]);

const FILTER_FIELDS = Object.freeze([
  'search',
  'sessionType',
  'courseId',
  'counsellorId',
  'status',
  'from',
  'to',
  'page',
  'limit',
  'sortBy',
  'sortOrder',
]);

const SAFE_RESPONSE_FIELDS = Object.freeze([
  'id',
  'sessionId',
  'title',
  'description',
  'sessionType',
  'courseId',
  'counsellorId',
  'scheduledAt',
  'startAt',
  'endAt',
  'timezone',
  'durationMinutes',
  'meetingUrl',
  'location',
  'agenda',
  'status',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
]);

function normalizeSessionFilters(query) {
  const filters = normalizeFilters(query, FILTER_FIELDS);

  for (const key of ['page', 'limit', 'courseId', 'counsellorId']) {
    if (filters[key] === undefined) continue;

    if (!/^[1-9]\d{0,14}$/.test(filters[key])) {
      throw httpError(400, 'INVALID_FILTER', `Invalid ${key} filter.`);
    }

    filters[key] = Number(filters[key]);
  }

  if (filters.limit !== undefined) {
    filters.limit = Math.min(filters.limit, 100);
  }

  if (filters.page !== undefined && filters.page > 100000) {
    throw httpError(400, 'INVALID_PAGE', 'Page number is too large.');
  }

  for (const key of ['from', 'to']) {
    if (filters[key] !== undefined) {
      const date = new Date(filters[key]);

      if (
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== filters[key]
      ) {
        throw httpError(
          400,
          'INVALID_DATE_FILTER',
          `${key} must be a valid YYYY-MM-DD date.`
        );
      }
    }
  }

  if (
    filters.from &&
    filters.to &&
    filters.from > filters.to
  ) {
    throw httpError(
      400,
      'INVALID_DATE_RANGE',
      'The from date must not be after the to date.'
    );
  }

  if (
    filters.sortOrder !== undefined &&
    !['asc', 'desc'].includes(filters.sortOrder.toLowerCase())
  ) {
    throw httpError(
      400,
      'INVALID_SORT_ORDER',
      'Sort order must be asc or desc.'
    );
  }

  if (filters.sortOrder !== undefined) {
    filters.sortOrder = filters.sortOrder.toLowerCase();
  }

  if (
    filters.sortBy !== undefined &&
    !['scheduledAt', 'startAt', 'endAt', 'createdAt', 'updatedAt'].includes(
      filters.sortBy
    )
  ) {
    throw httpError(
      400,
      'INVALID_SORT_FIELD',
      'Unsupported session sort field.'
    );
  }

  return filters;
}

function sanitizeSession(session) {
  if (
    !session ||
    typeof session !== 'object' ||
    Array.isArray(session)
  ) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The session repository returned an invalid record.'
    );
  }

  const safe = Object.create(null);

  for (const field of SAFE_RESPONSE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(session, field)) {
      safe[field] = session[field];
    }
  }

  return safe;
}

function requireAuthenticatedUser(req) {
  const user = requireUser(req);

  if (!user) {
    throw httpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  }

  return user;
}

function requireUserScopedRepositoryMethod(methodName) {
  if (typeof repository[methodName] !== 'function') {
    throw httpError(
      501,
      'SESSION_USER_SCOPING_NOT_CONFIGURED',
      'User-scoped session access is not configured.'
    );
  }

  return repository[methodName];
}

async function list(req, res, next) {
  try {
    const user = requireAuthenticatedUser(req);
    const filters = normalizeSessionFilters(req.query || {});
    const listForUser = requireUserScopedRepositoryMethod('listForUser');

    const result = await listForUser(user.id, filters);

    const items = Array.isArray(result)
      ? result
      : result && Array.isArray(result.items)
        ? result.items
        : null;

    if (!items) {
      throw httpError(
        500,
        'INVALID_REPOSITORY_RESPONSE',
        'The session repository returned an invalid list.'
      );
    }

    const safeItems = items.map(sanitizeSession);

    const pagination =
      !Array.isArray(result) &&
      result.pagination &&
      typeof result.pagination === 'object'
        ? result.pagination
        : undefined;

    const { sendSuccess } = require('../utils/http');

    return sendSuccess(
      res,
      { items: safeItems, ...(pagination ? { pagination } : {}) },
      'Sessions retrieved successfully.'
    );
  } catch (error) {
    return next(error);
  }
}

async function get(req, res, next) {
  try {
    const user = requireAuthenticatedUser(req);
    const id = req.params && req.params.id;

    if (!id || !/^[1-9]\d{0,14}$/.test(String(id))) {
      throw httpError(400, 'INVALID_SESSION_ID', 'Invalid session ID.');
    }

    const findForUser = requireUserScopedRepositoryMethod('findByIdForUser');
    const session = await findForUser(Number(id), user.id);

    if (!session) {
      throw httpError(404, 'SESSION_NOT_FOUND', 'Session not found.');
    }

    const { sendSuccess } = require('../utils/http');

    return sendSuccess(
      res,
      sanitizeSession(session),
      'Session retrieved successfully.'
    );
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const user = requireAuthenticatedUser(req);
    const createForUser = requireUserScopedRepositoryMethod('createForUser');

    const { validateBody, allowFields } = require('./controller.helpers');
    const data = validateBody(validator, req.body, { partial: false });
    const safeData = allowFields(data, WRITABLE_FIELDS);

    // Ownership is assigned server-side, never from the request body.
    const session = await createForUser(user.id, safeData);

    const { sendSuccess } = require('../utils/http');

    return sendSuccess(
      res,
      sanitizeSession(session),
      'Session created successfully.',
      201
    );
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const user = requireAuthenticatedUser(req);
    const id = req.params && req.params.id;

    if (!id || !/^[1-9]\d{0,14}$/.test(String(id))) {
      throw httpError(400, 'INVALID_SESSION_ID', 'Invalid session ID.');
    }

    const findForUser = requireUserScopedRepositoryMethod('findByIdForUser');
    const existing = await findForUser(Number(id), user.id);

    if (!existing) {
      throw httpError(404, 'SESSION_NOT_FOUND', 'Session not found.');
    }

    const { validateBody, allowFields } = require('./controller.helpers');
    const data = validateBody(validator, req.body, { partial: true });
    const safeData = allowFields(data, WRITABLE_FIELDS);

    if (!Object.keys(safeData).length) {
      throw httpError(400, 'EMPTY_UPDATE', 'No editable fields were provided.');
    }

    const updateForUser = requireUserScopedRepositoryMethod('updateForUser');
    const updated = await updateForUser(Number(id), user.id, safeData);

    if (!updated) {
      throw httpError(404, 'SESSION_NOT_FOUND', 'Session not found.');
    }

    const { sendSuccess } = require('../utils/http');

    return sendSuccess(
      res,
      sanitizeSession(updated),
      'Session updated successfully.'
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = Object.freeze({
  list,
  get,
  create,
  update,
});
