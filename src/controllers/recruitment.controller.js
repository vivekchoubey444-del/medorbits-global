
'use strict';

const {
  crudController,
  normalizeFilters,
} = require('./controller.helpers');

const { httpError } = require('../utils/http');

const repository = require('../repositories/recruitment.repository');
const validator = require('../validators/recruitment.validator');

const WRITABLE_FIELDS = Object.freeze([
  'title',
  'slug',
  'description',
  'recruitmentType',
  'department',
  'industry',
  'employerId',
  'companyName',
  'location',
  'country',
  'state',
  'city',
  'employmentType',
  'experienceRequired',
  'minimumExperience',
  'maximumExperience',
  'minimumSalary',
  'maximumSalary',
  'salaryCurrency',
  'qualifications',
  'skills',
  'responsibilities',
  'vacancies',
  'applicationStartDate',
  'applicationDeadline',
  'applicationInstructions',
  'applicationUrl',
  'contactEmail',
]);

const FILTER_FIELDS = Object.freeze([
  'search',
  'title',
  'recruitmentType',
  'department',
  'industry',
  'employerId',
  'country',
  'state',
  'city',
  'employmentType',
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
  'recruitmentId',
  'title',
  'slug',
  'description',
  'recruitmentType',
  'department',
  'industry',
  'employerId',
  'companyName',
  'location',
  'country',
  'state',
  'city',
  'employmentType',
  'experienceRequired',
  'minimumExperience',
  'maximumExperience',
  'minimumSalary',
  'maximumSalary',
  'salaryCurrency',
  'qualifications',
  'skills',
  'responsibilities',
  'vacancies',
  'applicationStartDate',
  'applicationDeadline',
  'applicationInstructions',
  'applicationUrl',
  'contactEmail',
  'status',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
]);

const SORT_FIELDS = Object.freeze([
  'title',
  'applicationStartDate',
  'applicationDeadline',
  'createdAt',
  'updatedAt',
]);

function normalizeRecruitmentFilters(query) {
  const filters = normalizeFilters(query, FILTER_FIELDS);

  for (const key of ['page', 'limit', 'employerId']) {
    if (filters[key] === undefined) continue;

    if (!/^[1-9]\d{0,14}$/.test(filters[key])) {
      throw httpError(400, 'INVALID_FILTER', `Invalid ${key} filter.`);
    }

    filters[key] = Number(filters[key]);
  }

  if (filters.page !== undefined && filters.page > 100000) {
    throw httpError(400, 'INVALID_PAGE', 'Page number is too large.');
  }

  if (filters.limit !== undefined) {
    filters.limit = Math.min(filters.limit, 100);
  }

  for (const key of ['from', 'to']) {
    if (filters[key] === undefined) continue;

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
    !SORT_FIELDS.includes(filters.sortBy)
  ) {
    throw httpError(
      400,
      'INVALID_SORT_FIELD',
      'Unsupported recruitment sort field.'
    );
  }

  return filters;
}

function sanitizeRecruitment(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The recruitment repository returned an invalid record.'
    );
  }

  const safe = Object.create(null);

  for (const field of SAFE_RESPONSE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(record, field)) {
      safe[field] = record[field];
    }
  }

  return safe;
}

const controller = crudController(repository, validator, {
  writable: true,
  removeAllowed: false,
  allowFields: WRITABLE_FIELDS,
  normalizeFilters: normalizeRecruitmentFilters,
  sanitize: sanitizeRecruitment,
});

module.exports = Object.freeze({
  list: controller.list,
  create: controller.create,
  get: controller.get,
  update: controller.update,
});
