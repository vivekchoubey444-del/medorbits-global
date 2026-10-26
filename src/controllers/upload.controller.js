
'use strict';

const {
  crudController,
  normalizeFilters,
} = require('./controller.helpers');

const { httpError } = require('../utils/http');

const repository = require('../repositories/document.repository');
const validator = require('../validators/document.validator');

const WRITABLE_FIELDS = Object.freeze([
  'title',
  'slug',
  'description',
  'category',
  'subcategory',
  'documentType',
  'courseId',
  'collegeId',
  'universityId',
  'country',
  'academicYear',
  'language',
  'fileUrl',
  'downloadUrl',
  'mimeType',
  'fileSize',
  'version',
  'publishedAt',
  'expiresAt',
  'isPublic',
  'status',
  'tags',
]);

const FILTER_FIELDS = Object.freeze([
  'search',
  'title',
  'category',
  'subcategory',
  'documentType',
  'courseId',
  'collegeId',
  'universityId',
  'country',
  'academicYear',
  'language',
  'isPublic',
  'status',
  'page',
  'limit',
  'sortBy',
  'sortOrder',
]);

const SAFE_RESPONSE_FIELDS = Object.freeze([
  'id',
  'documentId',
  'title',
  'slug',
  'description',
  'category',
  'subcategory',
  'documentType',
  'courseId',
  'collegeId',
  'universityId',
  'country',
  'academicYear',
  'language',
  'fileUrl',
  'downloadUrl',
  'mimeType',
  'fileSize',
  'version',
  'publishedAt',
  'expiresAt',
  'isPublic',
  'status',
  'tags',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
]);

function normalizeDocumentFilters(query) {
  const filters = normalizeFilters(query, FILTER_FIELDS);

  for (const field of ['page', 'limit']) {
    if (filters[field] !== undefined) {
      if (!/^[1-9]\d{0,5}$/.test(filters[field])) {
        throw httpError(
          400,
          field === 'page' ? 'INVALID_PAGE' : 'INVALID_LIMIT',
          `Invalid ${field}.`
        );
      }

      filters[field] = Number(filters[field]);
    }
  }

  if (filters.limit !== undefined) {
    filters.limit = Math.min(filters.limit, 100);
  }

  for (const field of ['courseId', 'collegeId', 'universityId']) {
    if (filters[field] !== undefined) {
      if (!/^[1-9]\d{0,14}$/.test(filters[field])) {
        throw httpError(
          400,
          'INVALID_FILTER_ID',
          `Invalid ${field}.`
        );
      }

      filters[field] = Number(filters[field]);
    }
  }

  if (filters.isPublic !== undefined) {
    if (!['true', 'false', '1', '0'].includes(filters.isPublic)) {
      throw httpError(
        400,
        'INVALID_PUBLIC_FILTER',
        'isPublic must be true or false.'
      );
    }

    filters.isPublic = ['true', '1'].includes(filters.isPublic);
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
      'category',
      'documentType',
      'academicYear',
      'publishedAt',
      'createdAt',
      'updatedAt',
    ].includes(filters.sortBy)
  ) {
    throw httpError(
      400,
      'INVALID_SORT_FIELD',
      'Unsupported document sort field.'
    );
  }

  return filters;
}

function sanitizeDocument(document) {
  if (
    !document ||
    typeof document !== 'object' ||
    Array.isArray(document)
  ) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The document repository returned an invalid record.'
    );
  }

  const safe = Object.create(null);

  for (const field of SAFE_RESPONSE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(document, field)) {
      safe[field] = document[field];
    }
  }

  return safe;
}

const controller = crudController(repository, validator, {
  writable: true,
  removeAllowed: false,
  allowFields: WRITABLE_FIELDS,
  normalizeFilters: normalizeDocumentFilters,
  sanitize: sanitizeDocument,
});

module.exports = Object.freeze({
  list: controller.list,
  get: controller.get,
  create: controller.create,
  update: controller.update,
});
