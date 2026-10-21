
'use strict';

const {
  crudController,
  normalizeFilters,
} = require('./controller.helpers');

const { httpError } = require('../utils/http');

const repository = require('../repositories/course.repository');
const validator = require('../validators/course.validator');

const WRITABLE_FIELDS = Object.freeze([
  'name',
  'slug',
  'code',
  'shortName',
  'description',
  'category',
  'level',
  'degree',
  'duration',
  'durationUnit',
  'studyMode',
  'eligibility',
  'entranceExams',
  'specializations',
  'careerOptions',
  'averageFees',
  'minimumFees',
  'maximumFees',
  'currency',
  'applicationStartDate',
  'applicationEndDate',
  'academicYear',
  'recognition',
  'accreditation',
  'status',
  'isFeatured',
]);

const FILTER_FIELDS = Object.freeze([
  'search',
  'name',
  'code',
  'category',
  'level',
  'degree',
  'duration',
  'studyMode',
  'academicYear',
  'recognition',
  'status',
  'page',
  'limit',
  'sortBy',
  'sortOrder',
]);

const SAFE_RESPONSE_FIELDS = Object.freeze([
  'id',
  'courseId',
  'name',
  'slug',
  'code',
  'shortName',
  'description',
  'category',
  'level',
  'degree',
  'duration',
  'durationUnit',
  'studyMode',
  'eligibility',
  'entranceExams',
  'specializations',
  'careerOptions',
  'averageFees',
  'minimumFees',
  'maximumFees',
  'currency',
  'applicationStartDate',
  'applicationEndDate',
  'academicYear',
  'recognition',
  'accreditation',
  'status',
  'isFeatured',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
]);

function normalizeCourseFilters(query) {
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
      'code',
      'category',
      'level',
      'duration',
      'averageFees',
      'createdAt',
      'updatedAt',
    ].includes(filters.sortBy)
  ) {
    throw httpError(
      400,
      'INVALID_SORT_FIELD',
      'Unsupported course sort field.'
    );
  }

  return filters;
}

function sanitizeCourse(course) {
  if (!course || typeof course !== 'object' || Array.isArray(course)) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The course repository returned an invalid record.'
    );
  }

  const safe = Object.create(null);

  for (const field of SAFE_RESPONSE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(course, field)) {
      safe[field] = course[field];
    }
  }

  return safe;
}

const controller = crudController(repository, validator, {
  writable: true,
  removeAllowed: false,
  allowFields: WRITABLE_FIELDS,
  normalizeFilters: normalizeCourseFilters,
  sanitize: sanitizeCourse,
});

module.exports = controller;
