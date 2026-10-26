
'use strict';

const {
  asyncHandler,
  sendSuccess,
  httpError,
} = require('../utils/http');

const {
  idFrom,
  requireUser,
  unavailable,
  normalizeFilters,
} = require('./controller.helpers');

const repository = require('../repositories/payment.repository');
const validator = require('../validators/payment.validator');
const paymentService = require('../services/payment.service');

const PAYMENT_FILTER_FIELDS = Object.freeze([
  'status',
  'currency',
  'paymentMethod',
  'purpose',
  'from',
  'to',
  'page',
  'limit',
  'sortBy',
  'sortOrder',
]);

const SAFE_PAYMENT_FIELDS = Object.freeze([
  'id',
  'paymentId',
  'orderId',
  'subscriptionId',
  'purpose',
  'description',
  'amount',
  'currency',
  'status',
  'paymentMethod',
  'provider',
  'receiptUrl',
  'paidAt',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at',
]);

const SORT_FIELDS = Object.freeze([
  'createdAt',
  'updatedAt',
  'paidAt',
  'amount',
]);

function normalizePaymentFilters(query) {
  const filters = normalizeFilters(query, PAYMENT_FILTER_FIELDS);

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
      'Unsupported payment sort field.'
    );
  }

  return filters;
}

function sanitizePayment(payment) {
  if (!payment || typeof payment !== 'object' || Array.isArray(payment)) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The payment service returned an invalid record.'
    );
  }

  const safe = Object.create(null);

  for (const field of SAFE_PAYMENT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payment, field)) {
      safe[field] = payment[field];
    }
  }

  return safe;
}

function requireRepositoryMethod(methodName) {
  if (!repository || typeof repository[methodName] !== 'function') {
    unavailable(`Payment repository operation: ${methodName}`);
  }

  return repository[methodName].bind(repository);
}

function requirePaymentService(methodName) {
  if (!paymentService || typeof paymentService[methodName] !== 'function') {
    unavailable(`Payment service operation: ${methodName}`);
  }

  return paymentService[methodName].bind(paymentService);
}

/**
 * GET /payments
 * List payments visible to the authenticated user.
 */
const list = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const filters = normalizePaymentFilters(req.query || {});
  const listForUser = requireRepositoryMethod('listForUser');

  const result = await listForUser(user.id, filters);

  if (
    !result ||
    !Array.isArray(result.items) ||
    !result.pagination ||
    typeof result.pagination !== 'object'
  ) {
    throw httpError(
      500,
      'INVALID_REPOSITORY_RESPONSE',
      'The payment repository returned an invalid list response.'
    );
  }

  return sendSuccess(
    res,
    result.items.map(sanitizePayment),
    200,
    { pagination: result.pagination }
  );
});

/**
 * GET /payments/:id
 * Retrieve a payment belonging to the authenticated user.
 */
const get = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const id = idFrom(req);
  const findForUser = requireRepositoryMethod('findForUser');

  const payment = await findForUser(id, user.id);

  if (!payment) {
    throw httpError(404, 'PAYMENT_NOT_FOUND', 'Payment not found.');
  }

  return sendSuccess(res, sanitizePayment(payment));
});

/**
 * POST /payments
 * Create a payment through the configured payment service.
 */
const create = asyncHandler(async (req, res) => {
  const user = requireUser(req);

  if (!validator || typeof validator.validateCreate !== 'function') {
    unavailable('Payment creation validation');
  }

  const createPayment = requirePaymentService('createPayment');
  const data = validator.validateCreate(req.body);

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw httpError(
      400,
      'INVALID_PAYMENT_DATA',
      'Payment details are invalid.'
    );
  }

  // The service must calculate amounts using trusted server-side records.
  // Do not accept client-supplied status, paid amount, or provider references.
  const payment = await createPayment({
    userId: user.id,
    data,
  });

  return sendSuccess(res, sanitizePayment(payment), 201);
});

/**
 * PATCH /payments/:id
 * Payment state cannot be changed directly by clients.
 */
const update = asyncHandler(async (req, _res) => {
  requireUser(req);
  idFrom(req);
  unavailable('Direct payment updates');
});

/**
 * DELETE /payments/:id
 * Financial records cannot be deleted through a generic endpoint.
 */
const remove = asyncHandler(async (req, _res) => {
  requireUser(req);
  idFrom(req);
  unavailable('Payment deletion');
});

/**
 * POST /payments/webhook
 * Process provider events only after signature verification.
 *
 * Configure the webhook route with raw-body capture before JSON parsing.
 * The payment service must verify signatures, validate provider/account
 * identity, and process event IDs idempotently.
 */
const webhook = asyncHandler(async (req, res) => {
  if (!Buffer.isBuffer(req.rawBody)) {
    throw httpError(
      400,
      'RAW_BODY_REQUIRED',
      'The raw request body is required for webhook verification.'
    );
  }

  const processWebhook = requirePaymentService('processWebhook');

  const result = await processWebhook({
    rawBody: req.rawBody,
    headers: req.headers,
  });

  return sendSuccess(
    res,
    result && typeof result === 'object'
      ? result
      : { received: true }
  );
});

module.exports = Object.freeze({
  list,
  get,
  create,
  update,
  remove,
  webhook,
});
