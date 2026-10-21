
'use strict';

const {
  ServiceError,
  requireDependency,
  requiredString,
  safePage,
} = require('./service-utils');

const DEFAULT_SEARCH_TYPES = Object.freeze([
  'courses',
  'colleges',
  'jobs',
  'internships',
]);

const MAX_SEARCH_TYPES = DEFAULT_SEARCH_TYPES.length;
const MAX_RESULTS_PER_SOURCE = 100;

function createSearchService({
  searchRepository,
  courseRepository,
  collegeRepository,
  jobRepository,
  internshipRepository,
}) {
  const sources = Object.freeze({
    courses: courseRepository,
    colleges: collegeRepository,
    jobs: jobRepository,
    internships: internshipRepository,
  });

  const allowedTypes = new Set([
    ...DEFAULT_SEARCH_TYPES,
    'all',
  ]);

  function validateInput(input) {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input)
    ) {
      throw new ServiceError(
        'Search input must be an object.',
        {
          code: 'VALIDATION_ERROR',
          status: 422,
        },
      );
    }

    return input;
  }

  function normalizeTypes(inputTypes) {
    if (inputTypes === undefined || inputTypes === null) {
      return [...DEFAULT_SEARCH_TYPES];
    }

    if (
      !Array.isArray(inputTypes) ||
      inputTypes.length === 0 ||
      inputTypes.length > MAX_SEARCH_TYPES ||
      !inputTypes.every(
        (type) =>
          typeof type === 'string' &&
          type.length > 0 &&
          type === type.trim(),
      )
    ) {
      throw new ServiceError(
        'types must be a non-empty array of supported search types.',
        {
          code: 'VALIDATION_ERROR',
          status: 422,
          details: {
            allowed: [...allowedTypes],
          },
        },
      );
    }

    const types = [...new Set(inputTypes)];

    const unknown = types.filter(
      (type) => !allowedTypes.has(type),
    );

    if (unknown.length > 0) {
      throw new ServiceError(
        'Unsupported search type.',
        {
          code: 'VALIDATION_ERROR',
          status: 422,
          details: {
            allowed: [...allowedTypes],
          },
        },
      );
    }

    if (types.includes('all')) {
      return [...DEFAULT_SEARCH_TYPES];
    }

    return types;
  }

  function normalizeItems(items, type) {
    if (!Array.isArray(items)) {
      throw new ServiceError(
        `The ${type} search repository returned an invalid result.`,
        {
          code: 'SEARCH_REPOSITORY_ERROR',
          status: 502,
        },
      );
    }

    return items;
  }

  async function searchSource(
    type,
    repository,
    query,
    limit,
    offset,
  ) {
    if (!repository) {
      return {
        type,
        items: [],
        unavailable: true,
      };
    }

    if (typeof repository.search !== 'function') {
      throw new ServiceError(
        `The ${type} search source is not configured correctly.`,
        {
          code: 'SEARCH_REPOSITORY_MISCONFIGURED',
          status: 500,
        },
      );
    }

    const items = await repository.search({
      q: query,
      limit,
      offset,
    });

    return {
      type,
      items: normalizeItems(items, type),
    };
  }

  return {
    async search(input = {}) {
      validateInput(input);

      const query = requiredString(input.q, 'q', {
        min: 2,
        max: 200,
      });

      const pagination = safePage(input);

      const page = pagination.page;
      const limit = pagination.limit;
      const offset = pagination.offset;

      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > MAX_RESULTS_PER_SOURCE ||
        !Number.isSafeInteger(offset) ||
        offset < 0
      ) {
        throw new ServiceError(
          'Invalid search pagination.',
          {
            code: 'VALIDATION_ERROR',
            status: 422,
          },
        );
      }

      const types = normalizeTypes(input.types);

      /*
       * Use the central index when available. It must enforce:
       * - parameterized database queries;
       * - allowlisted filters and sort fields;
       * - bounded pagination;
       * - publication/status visibility rules;
       * - field-level output sanitization.
       */
      if (searchRepository != null) {
        requireDependency(searchRepository, 'searchRepository');

        if (typeof searchRepository.search === 'function') {
          const result = await searchRepository.search({
            q: query,
            types,
            page,
            limit,
            offset,
          });

          if (
            !result ||
            typeof result !== 'object' ||
            Array.isArray(result)
          ) {
            throw new ServiceError(
              'The search repository returned an invalid result.',
              {
                code: 'SEARCH_REPOSITORY_ERROR',
                status: 502,
              },
            );
          }

          return result;
        }
      }

      const results = await Promise.all(
        types.map((type) =>
          searchSource(
            type,
            sources[type],
            query,
            limit,
            offset,
          ),
        ),
      );

      return {
        query,
        page,
        limit,
        results,
      };
    },
  };
}

module.exports = {
  createSearchService,
  DEFAULT_SEARCH_TYPES,
  MAX_RESULTS_PER_SOURCE,
};
