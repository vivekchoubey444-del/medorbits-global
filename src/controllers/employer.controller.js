
'use strict';

const {
  crudController,
  normalizeFilters,
} = require('./controller.helpers');

const { httpError } = require('../utils/http');

const repository = require('../repositories/employer.repository');
const validator = require('../validators/employer.validator');

const WRITABLE_FIELDS = Object.freeze([
  'companyName',
  'slug',
  'industry',
  'companySize',
  'description',
  'website',
  'logoUrl',
  'headquarters',
  'country',
  'state',
  'city',
  'businessEmail',
  'businessPhone',
  'linkedinUrl',
  'verificationStatus',
  'status',
]);

const FILTER_FIELDS = Object.freeze([
  'search',
  'companyName',
  'industry',
  'companySize',
  'country',
  'state',
  'city',
  'verificationStatus',
  'status',
  'page',
  'limit',
  'sortBy',
  'sortOrder',
]);

const SAFE_RESPONSE_FIELDS = Object.freeze([
  'id',
  'employerId',
  'companyName',
  'slug',
  'industry',
  'companySize',
  'description',
  'website',
  'logoUrl',
  'headquarters',
  'country',
  'state',
  'city',
  'businessEmail',
  'businessPhone',
  'linkedinUrl',
  'verificationStatus',
  'status',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
]);

function normalizeEmployerFilters(query) {
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
      'companyName',
      'industry',
      'companySize',
      'city',
      'state',
      'createdAt',
      'updatedAt',
    ].includes(filters.sortBy)
  ) {
    throw httpError(
      400,
      'INVALID_SORT_FIELD',
      'Unsupported employer sort field.'
    );
  }

  return filters;
}

function sanitizeEmployer(employer) {
  if (
    !employer ||
    typeof employer !== 'object' ||
    Array.isArray(employer)
  ) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The employer repository returned an invalid record.'
    );
  }

  const safe = Object.create(null);

  for (const field of SAFE_RESPONSE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(employer, field)) {
      safe[field] = employer[field];
    }
  }

  return safe;
}

const controller = crudController(repository, validator, {
  writable: true,
  removeAllowed: false,
  allowFields: WRITABLE_FIELDS,
  normalizeFilters: normalizeEmployerFilters,
  sanitize: sanitizeEmployer,
});

module.exports = controller;
