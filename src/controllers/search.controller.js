
'use strict';

const {
  asyncHandler,
  sendSuccess,
  httpError,
} = require('../utils/http');

const { unavailable } = require('./controller.helpers');
const searchService = require('../services/search.service');

const ALLOWED_CATEGORIES = Object.freeze([
  'all',
  'medical',
  'education',
  'college',
  'university',
  'course',
  'career',
  'job',
  'internship',
  'scholarship',
  'study-abroad',
  'document',
  'news',
]);

const MAX_QUERY_LENGTH = 200;
const MAX_PAGE_SIZE = 50;

function parsePositiveInteger(value, field, defaultValue, maxValue) {
  if (value === undefined) {
    return defaultValue;
  }

  if (
    typeof value !== 'string' ||
    !/^[1-9]\d{0,8}$/.test(value)
  ) {
    throw httpError(
      400,
      `INVALID_${field.toUpperCase()}`,
      `${field} must be a positive integer.`
    );
  }

  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    (maxValue !== undefined && number > maxValue)
  ) {
    throw httpError(
      400,
      `INVALID_${field.toUpperCase()}`,
      `${field} is outside the permitted range.`
    );
  }

  return number;
}

function optionalString(value, field, maxLength = 100) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw httpError(
      400,
      `INVALID_${field.toUpperCase()}`,
      `${field} must be a string.`
    );
  }

  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.length > maxLength) {
    throw httpError(
      400,
      `${field.toUpperCase()}_TOO_LONG`,
      `${field} must not exceed ${maxLength} characters.`
    );
  }

  return normalized;
}

/**
 * GET /api/search?q=mbbs&category=medical&page=1&limit=10
 */
const search = asyncHandler(async (req, res) => {
  const rawQuery = req.query?.q;

  if (typeof rawQuery !== 'string' || !rawQuery.trim()) {
    throw httpError(
      400,
      'SEARCH_QUERY_REQUIRED',
      'Provide a search query using the q parameter.'
    );
  }

  const query = rawQuery.trim();

  if (query.length > MAX_QUERY_LENGTH) {
    throw httpError(
      400,
      'SEARCH_QUERY_TOO_LONG',
      `Search queries must not exceed ${MAX_QUERY_LENGTH} characters.`
    );
  }

  if (!searchService || typeof searchService.search !== 'function') {
    unavailable('Search service');
  }

  const page = parsePositiveInteger(
    req.query.page,
    'page',
    1,
    100000
  );

  const limit = parsePositiveInteger(
    req.query.limit,
    'limit',
    10,
    MAX_PAGE_SIZE
  );

  const category = optionalString(req.query.category, 'category');
  const country = optionalString(req.query.country, 'country');

  if (
    category !== undefined &&
    !ALLOWED_CATEGORIES.includes(category.toLowerCase())
  ) {
    throw httpError(
      400,
      'INVALID_CATEGORY',
      'The requested search category is not supported.'
    );
  }

  const filters = {
    category: category?.toLowerCase(),
    country,
    page,
    limit,
  };

  const result = await searchService.search(query, filters);

  if (
    !result ||
    !Array.isArray(result.items) ||
    !result.pagination ||
    typeof result.pagination !== 'object'
  ) {
    throw httpError(
      500,
      'INVALID_SEARCH_RESPONSE',
      'The search service returned an invalid response.'
    );
  }

  return sendSuccess(res, result.items, 200, {
    pagination: result.pagination,
    query,
    filters: {
      category: filters.category || null,
      country: filters.country || null,
    },
  });
});

module.exports = Object.freeze({ search });
