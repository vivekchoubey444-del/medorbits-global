
'use strict';

const { crudController } = require('./controller.helpers');

const repository = require('../repositories/counselling.repository');
const validator = require('../validators/counselling.validator');

const WRITABLE_FIELDS = Object.freeze([
  'name',
  'slug',
  'description',
  'category',
  'course',
  'courseId',
  'counsellingType',
  'state',
  'academicYear',
  'applicationStartDate',
  'applicationEndDate',
  'registrationStartDate',
  'registrationEndDate',
  'choiceFillingStartDate',
  'choiceFillingEndDate',
  'allotmentDate',
  'documentVerificationDate',
  'reportingDate',
  'officialWebsite',
  'officialNotificationUrl',
  'eligibility',
  'requiredDocuments',
  'participatingInstitutions',
  'fees',
  'seatMatrix',
  'rounds',
  'status',
]);

const FILTER_FIELDS = Object.freeze([
  'search',
  'name',
  'category',
  'course',
  'courseId',
  'counsellingType',
  'state',
  'academicYear',
  'status',
  'page',
  'limit',
  'sortBy',
  'sortOrder',
]);

function normalizeFilters(query) {
  const filters = require('./controller.helpers').normalizeFilters(
    query,
    FILTER_FIELDS
  );

  if (filters.courseId !== undefined) {
    if (!/^[1-9]\d{0,14}$/.test(filters.courseId)) {
      const { httpError } = require('../utils/http');

      throw httpError(
        400,
        'INVALID_COURSE_ID',
        'A valid course ID is required.'
      );
    }

    filters.courseId = Number(filters.courseId);
  }

  if (filters.page !== undefined) {
    if (!/^[1-9]\d{0,5}$/.test(filters.page)) {
      const { httpError } = require('../utils/http');

      throw httpError(400, 'INVALID_PAGE', 'Invalid page number.');
    }

    filters.page = Number(filters.page);
  }

  if (filters.limit !== undefined) {
    if (!/^[1-9]\d{0,2}$/.test(filters.limit)) {
      const { httpError } = require('../utils/http');

      throw httpError(400, 'INVALID_LIMIT', 'Invalid page size.');
    }

    filters.limit = Math.min(Number(filters.limit), 100);
  }

  if (
    filters.sortOrder !== undefined &&
    !['asc', 'desc'].includes(filters.sortOrder.toLowerCase())
  ) {
    const { httpError } = require('../utils/http');

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
      'state',
      'academicYear',
      'applicationStartDate',
      'applicationEndDate',
      'createdAt',
      'updatedAt',
    ].includes(filters.sortBy)
  ) {
    const { httpError } = require('../utils/http');

    throw httpError(
      400,
      'INVALID_SORT_FIELD',
      'Unsupported counselling sort field.'
    );
  }

  return filters;
}

const controller = crudController(repository, validator, {
  writable: true,
  removeAllowed: false,
  allowFields: WRITABLE_FIELDS,
  normalizeFilters,

  sanitize(record) {
    const safe = Object.create(null);

    const fields = [
      'id',
      'name',
      'slug',
      'description',
      'category',
      'course',
      'courseId',
      'counsellingType',
      'state',
      'academicYear',
      'applicationStartDate',
      'applicationEndDate',
      'registrationStartDate',
      'registrationEndDate',
      'choiceFillingStartDate',
      'choiceFillingEndDate',
      'allotmentDate',
      'documentVerificationDate',
      'reportingDate',
      'officialWebsite',
      'officialNotificationUrl',
      'eligibility',
      'requiredDocuments',
      'participatingInstitutions',
      'fees',
      'seatMatrix',
      'rounds',
      'status',
      'createdAt',
      'updatedAt',
      'created_at',
      'updated_at',
    ];

    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(record, field)) {
        safe[field] = record[field];
      }
    }

    return safe;
  },
});

module.exports = controller;
