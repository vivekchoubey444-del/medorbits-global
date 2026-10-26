
'use strict';

const {
  crudController,
  normalizeFilters,
} = require('./controller.helpers');

const { httpError } = require('../utils/http');

const repository = require('../repositories/subscription.repository');
const validator = require('../validators/subscription.validator');

const WRITABLE_FIELDS = Object.freeze([
  'name',
  'slug',
  'description',
  'planType',
  'billingInterval',
  'currency',
  'price',
  'discountPrice',
  'trialDays',
  'features',
  'limits',
  'isFeatured',
  'status',
]);

const FILTER_FIELDS = Object.freeze([
  'search',
  'name',
  'planType',
  'billingInterval',
  'currency',
  'status',
  'isFeatured',
  'page',
  'limit',
  'sortBy',
  'sortOrder',
]);

const SAFE_RESPONSE_FIELDS = Object.freeze([
  'id',
  'subscriptionId',
  'name',
  'slug',
  'description',
  'planType',
  'billingInterval',
  'currency',
  'price',
  'discountPrice',
  'trialDays',
  'features',
  'limits',
  'isFeatured',
  'status',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
]);

function normalizeSubscriptionFilters(query) {
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
      'price',
      'discountPrice',
      'planType',
      'createdAt',
      'updatedAt',
    ].includes(filters.sortBy)
  ) {
    throw httpError(
      400,
      'INVALID_SORT_FIELD',
      'Unsupported subscription sort field.'
    );
  }

  return filters;
}

function sanitizeSubscription(subscription) {
  if (
    !subscription ||
    typeof subscription !== 'object' ||
    Array.isArray(subscription)
  ) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The subscription repository returned an invalid record.'
    );
  }

  const safe = Object.create(null);

  for (const field of SAFE_RESPONSE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(subscription, field)) {
      safe[field] = subscription[field];
    }
  }

  return safe;
}

const controller = crudController(repository, validator, {
  writable: true,
  removeAllowed: false,
  allowFields: WRITABLE_FIELDS,
  normalizeFilters: normalizeSubscriptionFilters,
  sanitize: sanitizeSubscription,
});

module.exports = Object.freeze({
  list: controller.list,
  get: controller.get,
  create: controller.create,
  update: controller.update,
});
