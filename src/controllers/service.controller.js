
'use strict';

const {
  crudController,
  normalizeFilters,
} = require('./controller.helpers');

const { httpError } = require('../utils/http');

const repository = require('../repositories/service.repository');
const validator = require('../validators/service.validator');

const WRITABLE_FIELDS = Object.freeze([
  'name',
  'slug',
  'title',
  'description',
  'shortDescription',
  'category',
  'serviceType',
  'icon',
  'imageUrl',
  'bannerUrl',
  'features',
  'benefits',
  'eligibility',
  'requirements',
  'process',
  'requiredDocuments',
  'duration',
  'durationUnit',
  'price',
  'currency',
  'pricingType',
  'displayOrder',
  'isFeatured',
  'status',
]);

const FILTER_FIELDS = Object.freeze([
  'search',
  'name',
  'category',
  'serviceType',
  'pricingType',
  'isFeatured',
  'status',
  'page',
  'limit',
  'sortBy',
  'sortOrder',
]);

const SAFE_RESPONSE_FIELDS = Object.freeze([
  'id',
  'serviceId',
  'name',
  'slug',
  'title',
  'description',
  'shortDescription',
  'category',
  'serviceType',
  'icon',
  'imageUrl',
  'bannerUrl',
  'features',
  'benefits',
  'eligibility',
  'requirements',
  'process',
  'requiredDocuments',
  'duration',
  'durationUnit',
  'price',
  'currency',
  'pricingType',
  'displayOrder',
  'isFeatured',
  'status',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
]);

const SORT_FIELDS = Object.freeze([
  'name',
  'category',
  'price',
  'displayOrder',
  'createdAt',
  'updatedAt',
]);

function normalizeServiceFilters(query) {
  const filters = normalizeFilters(query, FILTER_FIELDS);

  for (const key of ['page', 'limit', 'displayOrder']) {
    if (filters[key] === undefined) continue;

    if (!/^(0|[1-9]\d{0,8})$/.test(filters[key])) {
      throw httpError(400, 'INVALID_FILTER', `Invalid ${key} filter.`);
    }

    filters[key] = Number(filters[key]);
  }

  if (filters.page !== undefined && filters.page < 1) {
    throw httpError(400, 'INVALID_PAGE', 'Page must be a positive integer.');
  }

  if (filters.page !== undefined && filters.page > 100000) {
    throw httpError(400, 'INVALID_PAGE', 'Page number is too large.');
  }

  if (filters.limit !== undefined) {
    if (filters.limit < 1) {
      throw httpError(400, 'INVALID_LIMIT', 'Limit must be positive.');
    }

    filters.limit = Math.min(filters.limit, 100);
  }

  if (filters.isFeatured !== undefined) {
    if (!['true', 'false', '1', '0'].includes(filters.isFeatured)) {
      throw httpError(
        400,
        'INVALID_FEATURED_FILTER',
        'isFeatured must be true or false.'
      );
    }

    filters.isFeatured = ['true', '1'].includes(filters.isFeatured);
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
      'Unsupported service sort field.'
    );
  }

  return filters;
}

function sanitizeService(service) {
  if (!service || typeof service !== 'object' || Array.isArray(service)) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The service repository returned an invalid record.'
    );
  }

  const safe = Object.create(null);

  for (const field of SAFE_RESPONSE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(service, field)) {
      safe[field] = service[field];
    }
  }

  return safe;
}

const controller = crudController(repository, validator, {
  writable: true,
  removeAllowed: false,
  allowFields: WRITABLE_FIELDS,
  normalizeFilters: normalizeServiceFilters,
  sanitize: sanitizeService,
});

module.exports = Object.freeze({
  list: controller.list,
  get: controller.get,
  create: controller.create,
  update: controller.update,
});
