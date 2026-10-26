
'use strict';

/**
 * MedOrbits -- Pagination Utilities
 *
 * File: src/utils/pagination.js
 * Runtime: Node.js >= 20
 *
 * Provides:
 * - Safe page and limit parsing.
 * - Configurable default and maximum page sizes.
 * - Safe SQL offset calculation.
 * - Standard pagination metadata.
 *
 * Notes:
 * - Invalid query values fall back to defaults.
 * - Page size is capped to prevent excessively large queries.
 * - Always use parameterized SQL queries when applying LIMIT and OFFSET.
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_PAGE = Number.MAX_SAFE_INTEGER;

function assertOptionsObject(value, name) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new TypeError(`${name} must be an object.`);
  }
}

function assertPositiveSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(
      `${name} must be a positive safe integer.`,
    );
  }
}

/**
 * Parse a positive integer.
 *
 * Accepts integer numbers and digit-only strings.
 * Returns the fallback for absent, malformed, or out-of-range values.
 */
function toPositiveInteger(value, fallback, maximum = MAX_PAGE) {
  assertPositiveSafeInteger(fallback, 'fallback');
  assertPositiveSafeInteger(maximum, 'maximum');

  if (fallback > maximum) {
    throw new RangeError(
      'fallback must not exceed maximum.',
    );
  }

  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return fallback;
  }

  let parsed;

  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string') {
    const normalized = value.trim();

    if (!/^\d+$/.test(normalized)) {
      return fallback;
    }

    parsed = Number(normalized);
  } else {
    return fallback;
  }

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > maximum
  ) {
    return fallback;
  }

  return parsed;
}

/**
 * Build pagination parameters from a query object.
 *
 * Options:
 * - defaultLimit: default page size.
 * - maxLimit: maximum allowed page size.
 * - maxPage: maximum accepted page number.
 */
function getPagination(query = {}, options = {}) {
  assertOptionsObject(query, 'Pagination query');
  assertOptionsObject(options, 'Pagination options');

  const maxLimit = toPositiveInteger(
    options.maxLimit,
    MAX_LIMIT,
    MAX_LIMIT,
  );

  const defaultLimit = toPositiveInteger(
    options.defaultLimit,
    Math.min(DEFAULT_LIMIT, maxLimit),
    maxLimit,
  );

  const maxPage = toPositiveInteger(
    options.maxPage,
    MAX_PAGE,
    MAX_PAGE,
  );

  const page = toPositiveInteger(
    query.page,
    DEFAULT_PAGE,
    maxPage,
  );

  const requestedLimit = toPositiveInteger(
    query.limit,
    defaultLimit,
    Number.MAX_SAFE_INTEGER,
  );

  const limit = Math.min(requestedLimit, maxLimit);
  const offset = (page - 1) * limit;

  if (!Number.isSafeInteger(offset)) {
    throw new RangeError(
      'Pagination offset exceeds the safe integer range.',
    );
  }

  return Object.freeze({
    page,
    limit,
    offset,
  });
}

/**
 * Create pagination metadata.
 *
 * `totalItems` must represent the total number of matching records
 * before LIMIT and OFFSET are applied.
 */
function getPaginationMeta(totalItems, pagination = {}) {
  const total = Number(totalItems);

  if (
    !Number.isSafeInteger(total) ||
    total < 0
  ) {
    throw new TypeError(
      'totalItems must be a non-negative safe integer.',
    );
  }

  assertOptionsObject(
    pagination,
    'Pagination metadata input',
  );

  const page = toPositiveInteger(
    pagination.page,
    DEFAULT_PAGE,
    MAX_PAGE,
  );

  const limit = toPositiveInteger(
    pagination.limit,
    DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  const totalPages = Math.ceil(total / limit);
  const hasPreviousPage = page > 1;
  const hasNextPage = page < totalPages;

  return Object.freeze({
    page,
    limit,
    totalItems: total,
    totalPages,
    hasPreviousPage,
    hasNextPage,
    previousPage: hasPreviousPage ? page - 1 : null,
    nextPage: hasNextPage ? page + 1 : null,
  });
}

module.exports = Object.freeze({
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  getPagination,
  getPaginationMeta,
});
