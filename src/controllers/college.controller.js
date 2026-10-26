
'use strict';

const {
  asyncHandler,
  sendSuccess,
  httpError,
} = require('../utils/http');

const repository = require('../repositories/college.repository');
const validator = require('../validators/college.validator');

const controller = Object.create(null);

const ALLOWED_FIELDS = Object.freeze([
  'name',
  'slug',
  'code',
  'collegeType',
  'institutionType',
  'university',
  'universityId',
  'courseIds',
  'courses',
  'state',
  'city',
  'district',
  'address',
  'pincode',
  'country',
  'website',
  'email',
  'phone',
  'recognition',
  'accreditation',
  'approvalAuthority',
  'establishedYear',
  'description',
  'facilities',
  'admissionProcess',
  'entranceExams',
  'fees',
  'ranking',
  'seatMatrix',
  'hostelAvailable',
  'status',
  'isFeatured',
]);

const FILTER_FIELDS = Object.freeze([
  'search',
  'state',
  'city',
  'district',
  'collegeType',
  'institutionType',
  'universityId',
  'courseId',
  'entranceExam',
  'recognition',
  'status',
  'page',
  'limit',
  'sortBy',
  'sortOrder',
]);

const SAFE_RESPONSE_FIELDS = Object.freeze([
  'id',
  'collegeId',
  'name',
  'slug',
  'code',
  'collegeType',
  'institutionType',
  'university',
  'universityId',
  'courseIds',
  'courses',
  'state',
  'city',
  'district',
  'address',
  'pincode',
  'country',
  'website',
  'email',
  'phone',
  'recognition',
  'accreditation',
  'approvalAuthority',
  'establishedYear',
  'description',
  'facilities',
  'admissionProcess',
  'entranceExams',
  'fees',
  'ranking',
  'seatMatrix',
  'hostelAvailable',
  'status',
  'isFeatured',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
]);

const MAX_ID_LENGTH = 15;
const MAX_FILTER_LENGTH = 200;
const MAX_PAGE_SIZE = 100;

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
      `College repository operation "${name}" is unavailable.`
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
      'College validation is not configured.'
    );
  }

  const result = validator.validate(body, {
    partial: options.partial === true,
  });

  if (!isPlainObject(result) || Object.keys(result).length === 0) {
    throw httpError(
      400,
      'INVALID_COLLEGE_DATA',
      'College data is invalid or empty.'
    );
  }

  return result;
}

function enforceAllowedFields(data) {
  const unsupported = Object.keys(data).filter(
    (field) => !ALLOWED_FIELDS.includes(field)
  );

  if (unsupported.length > 0) {
    throw httpError(
      400,
      'UNSUPPORTED_COLLEGE_FIELDS',
      `Unsupported college fields: ${unsupported.join(', ')}.`
    );
  }

  return data;
}

function normalizeFilters(query) {
  if (!isPlainObject(query)) {
    throw httpError(
      400,
      'INVALID_FILTERS',
      'College filters must be a valid object.'
    );
  }

  const filters = Object.create(null);

  for (const [key, value] of Object.entries(query)) {
    if (!FILTER_FIELDS.includes(key)) {
      throw httpError(
        400,
        'INVALID_FILTER',
        `Unsupported college filter: ${key}.`
      );
    }

    if (typeof value !== 'string' || value.length > MAX_FILTER_LENGTH) {
      throw httpError(
        400,
        'INVALID_FILTER_VALUE',
        `Invalid value for college filter: ${key}.`
      );
    }

    const normalized = value.trim();

    if (!normalized) {
      continue;
    }

    filters[key] = normalized;
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

    filters.limit = Math.min(Number(filters.limit), MAX_PAGE_SIZE);
  }

  if (filters.universityId !== undefined) {
    if (!/^[1-9]\d{0,14}$/.test(filters.universityId)) {
      throw httpError(
        400,
        'INVALID_UNIVERSITY_ID',
        'A valid university ID is required.'
      );
    }

    filters.universityId = Number(filters.universityId);
  }

  if (filters.courseId !== undefined) {
    if (!/^[1-9]\d{0,14}$/.test(filters.courseId)) {
      throw httpError(
        400,
        'INVALID_COURSE_ID',
        'A valid course ID is required.'
      );
    }

    filters.courseId = Number(filters.courseId);
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
      'name',
      'city',
      'state',
      'establishedYear',
      'createdAt',
      'updatedAt',
      'ranking',
    ].includes(filters.sortBy)
  ) {
    throw httpError(
      400,
      'INVALID_SORT_FIELD',
      'Unsupported college sort field.'
    );
  }

  return filters;
}

function toSafeCollege(college) {
  if (!isPlainObject(college)) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The college repository returned an invalid record.'
    );
  }

  const safe = Object.create(null);

  for (const field of SAFE_RESPONSE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(college, field)) {
      safe[field] = college[field];
    }
  }

  return safe;
}

/**
 * GET /colleges
 */
controller.list = asyncHandler(async (req, res) => {
  const list = requireRepositoryMethod('list');
  const result = await list(normalizeFilters(req.query));

  if (!result || !Array.isArray(result.items)) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The college repository returned an invalid list response.'
    );
  }

  const data = result.items.map(toSafeCollege);

  const metadata = isPlainObject(result.pagination)
    ? { pagination: result.pagination }
    : {};

  return sendSuccess(res, data, 200, metadata);
});

/**
 * GET /colleges/:id
 */
controller.get = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const findById = requireRepositoryMethod('findById');
  const college = await findById(id);

  if (!college) {
    throw httpError(404, 'NOT_FOUND', 'College not found.');
  }

  return sendSuccess(res, toSafeCollege(college), 200);
});

/**
 * POST /colleges
 */
controller.create = asyncHandler(async (req, res) => {
  const data = enforceAllowedFields(validateBody(req.body));
  const create = requireRepositoryMethod('create');
  const college = await create(data);

  if (!college) {
    throw httpError(
      500,
      'COLLEGE_CREATE_FAILED',
      'The college could not be created.'
    );
  }

  return sendSuccess(res, toSafeCollege(college), 201);
});

/**
 * PUT/PATCH /colleges/:id
 */
controller.update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const data = enforceAllowedFields(
    validateBody(req.body, {
      partial: req.method === 'PATCH',
    })
  );

  const update = requireRepositoryMethod('update');
  const college = await update(id, data);

  if (!college) {
    throw httpError(404, 'NOT_FOUND', 'College not found.');
  }

  return sendSuccess(res, toSafeCollege(college), 200);
});

/**
 * DELETE /colleges/:id
 */
controller.remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const remove = requireRepositoryMethod('remove');
  const removed = await remove(id);

  if (!removed) {
    throw httpError(404, 'NOT_FOUND', 'College not found.');
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
