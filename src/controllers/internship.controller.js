
'use strict';

const {
  crudController,
  normalizeFilters,
} = require('./controller.helpers');

const { httpError } = require('../utils/http');

const repository = require('../repositories/internship.repository');
const validator = require('../validators/internship.validator');

const WRITABLE_FIELDS = Object.freeze([
  'title',
  'slug',
  'description',
  'companyName',
  'employerId',
  'industry',
  'internshipType',
  'workMode',
  'location',
  'country',
  'state',
  'city',
  'stipend',
  'currency',
  'duration',
  'durationUnit',
  'startDate',
  'applicationDeadline',
  'requirements',
  'responsibilities',
  'skills',
  'eligibility',
  'benefits',
  'applicationUrl',
  'contactEmail',
  'status',
]);

const FILTER_FIELDS = Object.freeze([
  'search',
  'title',
  'companyName',
  'employerId',
  'industry',
  'internshipType',
  'workMode',
  'country',
  'state',
  'city',
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
  'internshipId',
  'title',
  'slug',
  'description',
  'companyName',
  'employerId',
  'industry',
  'internshipType',
  'workMode',
  'location',
  'country',
  'state',
  'city',
  'stipend',
  'currency',
  'duration',
  'durationUnit',
  'startDate',
  'applicationDeadline',
  'requirements',
  'responsibilities',
  'skills',
  'eligibility',
  'benefits',
  'applicationUrl',
  'contactEmail',
  'status',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
]);

function normalizeInternshipFilters(query) {
  const filters = normalizeFilters(query, FILTER_FIELDS);

  for (const key of ['page', 'limit', 'employerId']) {
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

  if (filters.from && filters.to && filters.from > filters.to) {
    throw httpError(
      400,
      'INVALID_DATE_RANGE',
      'The from date must not be after the to date.'
    );
  }

  if (filters.sortOrder !== undefined) {
    filters.sortOrder = filters.sortOrder.toLowerCase();

    if (!['asc', 'desc'].includes(filters.sortOrder)) {
      throw httpError(
        400,
        'INVALID_SORT_ORDER',
        'Sort order must be asc or desc.'
      );
    }
  }

  if (
    filters.sortBy !== undefined &&
    ![
      'title',
      'companyName',
      'stipend',
      'startDate',
      'applicationDeadline',
      'createdAt',
      'updatedAt',
    ].includes(filters.sortBy)
  ) {
    throw httpError(
      400,
      'INVALID_SORT_FIELD',
      'Unsupported internship sort field.'
    );
  }

  return filters;
}

function sanitizeInternship(internship) {
  if (
    !internship ||
    typeof internship !== 'object' ||
    Array.isArray(internship)
  ) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The internship repository returned an invalid record.'
    );
  }

  const safe = Object.create(null);

  for (const field of SAFE_RESPONSE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(internship, field)) {
      safe[field] = internship[field];
    }
  }

  return safe;
}

const controller = crudController(repository, validator, {
  writable: true,
  removeAllowed: false,
  allowFields: WRITABLE_FIELDS,
  normalizeFilters: normalizeInternshipFilters,
  sanitize: sanitizeInternship,
});

module.exports = Object.freeze({
  list: controller.list,
  get: controller.get,
  create: controller.create,
  update: controller.update,
});
