
'use strict';

const {
  asyncHandler,
  sendSuccess,
  httpError,
} = require('../utils/http');

const repository = require('../repositories/candidate.repository');
const validator = require('../validators/candidate.validator');

const controller = Object.create(null);

const MAX_ID_LENGTH = 15;

const WRITABLE_FIELDS = Object.freeze([
  'firstName',
  'lastName',
  'name',
  'email',
  'phone',
  'dateOfBirth',
  'gender',
  'qualification',
  'specialization',
  'experience',
  'skills',
  'location',
  'resumeUrl',
  'linkedinUrl',
  'portfolioUrl',
  'summary',
  'availability',
]);

const FILTER_FIELDS = Object.freeze([
  'search',
  'status',
  'qualification',
  'specialization',
  'location',
  'page',
  'limit',
  'sortBy',
  'sortOrder',
]);

const SAFE_RESPONSE_FIELDS = Object.freeze([
  'id',
  'candidateId',
  'firstName',
  'lastName',
  'name',
  'email',
  'phone',
  'dateOfBirth',
  'gender',
  'qualification',
  'specialization',
  'experience',
  'skills',
  'location',
  'resumeUrl',
  'linkedinUrl',
  'portfolioUrl',
  'summary',
  'availability',
  'status',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function parseId(value) {
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

function requireRepositoryMethod(name) {
  if (!repository || typeof repository[name] !== 'function') {
    throw httpError(
      503,
      'REPOSITORY_UNAVAILABLE',
      `Candidate repository operation "${name}" is unavailable.`
    );
  }

  return repository[name].bind(repository);
}

function validateBody(body, options = {}) {
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
      'Candidate validation is not configured.'
    );
  }

  const result = validator.validate(body, {
    partial: options.partial === true,
  });

  if (
    !isPlainObject(result) ||
    Object.keys(result).length === 0
  ) {
    throw httpError(
      400,
      'INVALID_CANDIDATE_DATA',
      'Candidate data is invalid or empty.'
    );
  }

  return result;
}

function allowFields(data, allowedFields, code) {
  const unsupported = Object.keys(data).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unsupported.length > 0) {
    throw httpError(
      400,
      code,
      `Unsupported fields: ${unsupported.join(', ')}.`
    );
  }

  return data;
}

function normalizeFilters(query) {
  if (!isPlainObject(query)) {
    throw httpError(
      400,
      'INVALID_FILTERS',
      'Candidate filters must be a valid object.'
    );
  }

  const filters = Object.create(null);

  for (const [key, value] of Object.entries(query)) {
    if (!FILTER_FIELDS.includes(key)) {
      throw httpError(
        400,
        'INVALID_FILTER',
        `Unsupported candidate filter: ${key}.`
      );
    }

    if (typeof value !== 'string' || value.length > 200) {
      throw httpError(
        400,
        'INVALID_FILTER_VALUE',
        `Invalid value for candidate filter: ${key}.`
      );
    }

    filters[key] = value.trim();
  }

  if (filters.page !== undefined) {
    if (!/^[1-9]\d{0,5}$/.test(filters.page)) {
      throw httpError(400, 'INVALID_PAGE', 'Invalid page number.');
    }

    filters.page = Number(filters.page);
  }

  if (filters.limit !== undefined) {
    if (!/^[1-9]\d{0,2}$/.test(filters.limit)) {
      throw httpError(400, 'INVALID_LIMIT', 'Invalid page size.');
    }

    filters.limit = Math.min(Number(filters.limit), 100);
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
    ![
      'id',
      'firstName',
      'lastName',
      'name',
      'createdAt',
      'updatedAt',
      'experience',
    ].includes(filters.sortBy)
  ) {
    throw httpError(
      400,
      'INVALID_SORT_FIELD',
      'Unsupported candidate sort field.'
    );
  }

  return filters;
}

function toSafeCandidate(candidate) {
  if (!isPlainObject(candidate)) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The candidate repository returned an invalid record.'
    );
  }

  const safe = Object.create(null);

  for (const field of SAFE_RESPONSE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(candidate, field)) {
      safe[field] = candidate[field];
    }
  }

  return safe;
}

function toSafeCandidates(candidates) {
  return candidates.map(toSafeCandidate);
}

/**
 * GET /candidates
 * Lists candidates using allowlisted filters and pagination.
 *
 * Apply authentication and role/permission middleware at the router.
 */
controller.list = asyncHandler(async (req, res) => {
  const filters = normalizeFilters(req.query);
  const list = requireRepositoryMethod('list');
  const result = await list(filters);

  if (!result || !Array.isArray(result.items)) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The candidate repository returned an invalid list response.'
    );
  }

  const data = toSafeCandidates(result.items);

  const metadata = isPlainObject(result.pagination)
    ? { pagination: result.pagination }
    : {};

  return sendSuccess(res, data, 200, metadata);
});

/**
 * GET /candidates/:id
 * Retrieves one candidate.
 */
controller.get = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const findById = requireRepositoryMethod('findById');
  const candidate = await findById(id);

  if (!candidate) {
    throw httpError(404, 'NOT_FOUND', 'Candidate not found.');
  }

  return sendSuccess(res, toSafeCandidate(candidate), 200);
});

/**
 * POST /candidates
 * Creates a candidate record.
 */
controller.create = asyncHandler(async (req, res) => {
  const data = validateBody(req.body);

  allowFields(data, WRITABLE_FIELDS, 'UNSUPPORTED_CANDIDATE_FIELDS');

  const create = requireRepositoryMethod('create');
  const candidate = await create(data);

  if (!candidate) {
    throw httpError(
      500,
      'CANDIDATE_CREATE_FAILED',
      'The candidate could not be created.'
    );
  }

  return sendSuccess(res, toSafeCandidate(candidate), 201);
});

/**
 * PUT/PATCH /candidates/:id
 * Updates a candidate record.
 *
 * The validator must support partial validation for PATCH requests.
 * Configure the route to pass req.method or use separate handlers if
 * PUT requires all mandatory fields.
 */
controller.update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const data = validateBody(req.body, {
    partial: req.method === 'PATCH',
  });

  allowFields(data, WRITABLE_FIELDS, 'UNSUPPORTED_CANDIDATE_FIELDS');

  const update = requireRepositoryMethod('update');
  const candidate = await update(id, data);

  if (!candidate) {
    throw httpError(404, 'NOT_FOUND', 'Candidate not found.');
  }

  return sendSuccess(res, toSafeCandidate(candidate), 200);
});

/**
 * DELETE /candidates/:id
 * Removes a candidate record.
 */
controller.remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const remove = requireRepositoryMethod('remove');
  const removed = await remove(id);

  if (!removed) {
    throw httpError(404, 'NOT_FOUND', 'Candidate not found.');
  }

  return sendSuccess(
    res,
    {
      id,
      deleted: true,
    },
    200
  );
});

module.exports = controller;
