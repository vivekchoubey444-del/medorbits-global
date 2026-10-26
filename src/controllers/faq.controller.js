
'use strict';

const {
  crudController,
  normalizeFilters,
} = require('./controller.helpers');

const {
  asyncHandler,
  sendSuccess,
  httpError,
} = require('../utils/http');

const { findAnswer } = require('../services/faq-answer.service');
const repository = require('../repositories/faq.repository');

const FAQ_FILTER_FIELDS = Object.freeze([
  'search',
  'category',
  'status',
  'page',
  'limit',
  'sortBy',
  'sortOrder',
]);

const FAQ_RESPONSE_FIELDS = Object.freeze([
  'id',
  'faqId',
  'question',
  'answer',
  'category',
  'tags',
  'status',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
]);

function normalizeFaqFilters(query) {
  const filters = normalizeFilters(query, FAQ_FILTER_FIELDS);

  for (const key of ['page', 'limit']) {
    if (filters[key] === undefined) continue;

    if (!/^[1-9]\d{0,5}$/.test(filters[key])) {
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
    !['question', 'category', 'createdAt', 'updatedAt'].includes(
      filters.sortBy
    )
  ) {
    throw httpError(
      400,
      'INVALID_SORT_FIELD',
      'Unsupported FAQ sort field.'
    );
  }

  return filters;
}

function sanitizeFaq(faq) {
  if (!faq || typeof faq !== 'object' || Array.isArray(faq)) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The FAQ repository returned an invalid record.'
    );
  }

  const safe = Object.create(null);

  for (const field of FAQ_RESPONSE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(faq, field)) {
      safe[field] = faq[field];
    }
  }

  return safe;
}

const controller = crudController(repository, null, {
  writable: false,
  removeAllowed: false,
  validate: false,
  normalizeFilters: normalizeFaqFilters,
  sanitize: sanitizeFaq,
});

controller.answer = asyncHandler(async (req, res) => {
  if (!req.is('application/json')) {
    throw httpError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Content-Type must be application/json.'
    );
  }

  const question = req.body?.question;

  if (
    typeof question !== 'string' ||
    !question.trim() ||
    question.trim().length > 500
  ) {
    throw httpError(
      400,
      'INVALID_QUESTION',
      'Enter a question of up to 500 characters.'
    );
  }

  const match = await Promise.resolve(findAnswer(question.trim()));

  const answer =
    match && typeof match.answer === 'string' && match.answer.trim()
      ? match.answer
      : 'I could not find a direct answer in the published FAQs. Please contact MedOrbits for help.';

  return sendSuccess(res, {
    matched: Boolean(match),
    answer,
    faq:
      match &&
      (typeof match.id === 'string' || Number.isSafeInteger(match.id))
        ? {
            id: match.id,
            question:
              typeof match.question === 'string' ? match.question : '',
            category:
              typeof match.category === 'string' ? match.category : null,
          }
        : null,
    contact: {
      email: 'support@medorbits.in',
      phone: ['+91 62058 89064', '+91 76449 87052'],
    },
  });
});

module.exports = Object.freeze({
  list: controller.list,
  get: controller.get,
  answer: controller.answer,
});
