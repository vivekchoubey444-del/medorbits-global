
'use strict';

/**
 * MedOrbits -- Request Controller
 *
 * File: src/controllers/request.controller.js
 *
 * Handles request submission and management.
 * Persistence remains disabled until a request service is configured.
 */

const asyncHandler = require('../utils/async-handler');
const apiResponse = require('../utils/api-response');
const requestValidator = require('../validators/request.validator');

const SERVICE_UNAVAILABLE_CODE = 'REQUEST_SERVICE_NOT_CONFIGURED';

const SERVICE_UNAVAILABLE_MESSAGE =
  'Request processing is not available yet. Please try again later.';

const CREATE_FIELDS = Object.freeze([
  'name',
  'email',
  'phone',
  'subject',
  'message',
  'category',
  'source',
]);

const QUERY_FIELDS = Object.freeze([
  'page',
  'limit',
  'status',
  'category',
]);

const UPDATE_FIELDS = Object.freeze([
  'status',
  'assigned_to',
  'internal_notes',
]);

function sendUnavailable(res) {
  return apiResponse.sendError(
    res,
    503,
    SERVICE_UNAVAILABLE_CODE,
    SERVICE_UNAVAILABLE_MESSAGE
  );
}

function validateId(value) {
  return requestValidator.validateRouteId(value, {
    field: 'id',
  });
}

function validateObjectBody(body, allowedFields) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    throw new TypeError('Request body must be a JSON object.');
  }

  requestValidator.validateBody(body, {
    allowedFields,
    rejectUnknown: true,
  });

  const keys = Object.keys(body);

  if (keys.length === 0) {
    throw new TypeError('Request body must not be empty.');
  }

  requestValidator.validateRequiredFields(body, keys, {
    field: 'body',
  });
}

/**
 * POST /requests
 * Validate a prospective guidance or consultancy request.
 */
const createRequest = asyncHandler(async (req, res) => {
  validateObjectBody(req.body, CREATE_FIELDS);

  requestValidator.validateRequiredFields(
    req.body,
    ['name', 'email', 'message'],
    { field: 'body' }
  );

  return sendUnavailable(res);
});

/**
 * GET /requests
 * Validate list filters. Retrieval is not yet configured.
 */
const listRequests = asyncHandler(async (req, res) => {
  requestValidator.validateQuery(req.query || {}, {
    allowedFields: QUERY_FIELDS,
    rejectUnknown: true,
  });

  requestValidator.validatePagination(req.query || {}, {
    defaultPage: 1,
    defaultLimit: 20,
    maxLimit: 100,
  });

  return sendUnavailable(res);
});

/**
 * GET /requests/:id
 * Validate the identifier. Resource access is not yet configured.
 */
const getRequestById = asyncHandler(async (req, res) => {
  validateId(req.params?.id);

  return sendUnavailable(res);
});

/**
 * PATCH /requests/:id
 * Validate the identifier and update payload.
 */
const updateRequest = asyncHandler(async (req, res) => {
  validateId(req.params?.id);
  validateObjectBody(req.body, UPDATE_FIELDS);

  return sendUnavailable(res);
});

/**
 * DELETE /requests/:id
 * Deletion is disabled until the request service is implemented.
 */
const deleteRequest = asyncHandler(async (req, res) => {
  validateId(req.params?.id);

  return sendUnavailable(res);
});

module.exports = Object.freeze({
  createRequest,
  listRequests,
  getRequestById,
  updateRequest,
  deleteRequest,
});
