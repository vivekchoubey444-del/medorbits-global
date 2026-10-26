
'use strict';

const {
  crudController,
  normalizeFilters,
} = require('./controller.helpers');

const { httpError } = require('../utils/http');

const repository = require('../repositories/university.repository');
const validator = require('../validators/university.validator');

const WRITABLE_FIELDS = Object.freeze([
  'name',
  'slug',
  'code',
  'category',
  'universityType',
  'state',
  'city',
  'district',
  'country',
  'address',
  'pincode',
  'website',
  'email',
  'phone',
  'establishedYear',
  'recognition',
  'accreditation',
  'approvalAuthority',
  'description',
  'faculties',
  'courses',
  'collegeIds',
  'ranking',
  'status',
  'isFeatured',
]);

const FILTER_FIELDS = Object.freeze([
  'search',
  'name',
  'category',
  'universityType',
  'state',
  'city',
  'district',
  'country',
  'recognition',
  'accreditation',
  'status',
  'page',
  'limit',
  'sortBy',
  'sortOrder',
]);

const SAFE_RESPONSE_FIELDS = Object.freeze([
  'id',
  'universityId',
  'name',
  'slug',
  'code',
  'category',
  'universityType',
  'state',
  'city',
  'district',
  'country',
  'address',
  'pincode',
  'website',
  'email',
  'phone',
  'establishedYear',
  'recognition',
  'accreditation',
  'approvalAuthority',
  'description',
  'faculties',
  'courses',
  'collegeIds',
  'ranking',
  'status',
  'isFeatured',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
]);

function normalizeUniversityFilters(query) {
  const filters = normalizeFilters(query, FILTER_FIELDS);

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
      'name',
      'category',
      'universityType',
      'state',
      'city',
      'establishedYear',
      'createdAt',
      'updatedAt',
    ].includes(filters.sortBy)
  ) {
    throw httpError(
      400,
      'INVALID_SORT_FIELD',
      'Unsupported university sort field.'
    );
  }

  return filters;
}

function sanitizeUniversity(university) {
  if (
    !university ||
    typeof university !== 'object' ||
    Array.isArray(university)
  ) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The university repository returned an invalid record.'
    );
  }

  const safe = Object.create(null);

  for (const field of SAFE_RESPONSE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(university, field)) {
      safe[field] = university[field];
    }
  }

  return safe;
}

const controller = crudController(repository, validator, {
  writable: true,
  removeAllowed: false,
  allowFields: WRITABLE_FIELDS,
  normalizeFilters: normalizeUniversityFilters,
  sanitize: sanitizeUniversity,
});

module.exports = Object.freeze({
  list: controller.list,
  get: controller.get,
  create: controller.create,
  update: controller.update,
});
