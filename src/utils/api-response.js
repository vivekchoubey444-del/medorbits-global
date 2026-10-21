
'use strict';

/**
 * MedOrbits -- Request Controller
 *
 * File: src/controllers/request.controller.js
 * Runtime: Node.js >= 20
 *
 * Responsibilities:
 * - Validate request payloads, query parameters, and route identifiers.
 * - Use the standardized API response contract.
 * - Delegate persistence and business rules to request services.
 * - Forward errors to centralized error middleware.
 * - Fail closed when required services are unavailable.
 *
 * Security:
 * - Never report successful persistence when no service has executed.
 * - Reject unknown input fields.
 * - Require authorization for request listing, retrieval, modification,
 *   assignment, and deletion.
 * - Keep internal notes restricted to authorized staff.
 * - Avoid exposing personal information or internal exception details.
 */

const asyncHandler = require('../utils/async-handler');
const apiResponse = require('../utils/api-response');
const requestValidator = require('../validators/request.validator');

const SERVICE_UNAVAILABLE_CODE = 'REQUEST_SERVICE_NOT_CONFIGURED';

const SERVICE_UNAVAILABLE_MESSAGE =
  'Request processing is temporarily unavailable. Please try again later.';

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

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function sendUnavailable(res, req) {
  return apiResponse.error(
    res,
    {
      statusCode: 503,
      code: SERVICE_UNAVAILABLE_CODE,
      message: SERVICE_UNAVAILABLE_MESSAGE,
    },
    req,
  );
}

function validateObject(validator, value, allowedFields, label) {
  if (typeof validator !== 'function') {
    const error = new Error(
      `Request controller configuration error: ${label} validator is unavailable.`,
    );

    error.statusCode = 500;
    error.code = 'REQUEST_VALIDATOR_NOT_CONFIGURED';

    throw error;
  }

  return validator(value, {
    allowedFields,
    rejectUnknown: true,
  });
}

function validateRequiredString(value, field, minLength, maxLength) {
  requestValidator.validateString(value, {
    field,
    minLength,
    maxLength,
  });
}

function validateCreateBody(body) {
  const validated = validateObject(
    requestValidator.validateBody,
    body,
    CREATE_FIELDS,
    'body',
  );

  requestValidator.validateRequiredFields(validated, [
    'name',
    'email',
    'message',
  ]);

  validateRequiredString(validated.name, 'name', 1, 120);
  validateRequiredString(validated.email, 'email', 3, 254);
  validateRequiredString(validated.message, 'message', 1, 10000);

  if (validated.phone !== undefined) {
    validateRequiredString(validated.phone, 'phone', 7, 30);
  }

  if (validated.subject !== undefined) {
    validateRequiredString(validated.subject, 'subject', 1, 200);
  }

  if (validated.category !== undefined) {
    validateRequiredString(validated.category, 'category', 1, 100);
  }

  if (validated.source !== undefined) {
    validateRequiredString(validated.source, 'source', 1, 100);
  }

  return validated;
}

function validateListQuery(query) {
  const validated = validateObject(
    requestValidator.validateQuery,
    query,
    QUERY_FIELDS,
    'query',
  );

  requestValidator.validatePagination(validated);

  if (validated.status !== undefined) {
    validateRequiredString(validated.status, 'status', 1, 50);
  }

  if (validated.category !== undefined) {
    validateRequiredString(validated.category, 'category', 1, 100);
  }

  return validated;
}

function validateRequestId(params) {
  requestValidator.validateParams(params, {
    allowedFields: ['id'],
    rejectUnknown: true,
  });

  requestValidator.validateRouteId(params.id);

  return params.id;
}

function validateUpdateBody(body) {
  const validated = validateObject(
    requestValidator.validateBody,
    body,
    UPDATE_FIELDS,
    'body',
  );

  if (Object.keys(validated).length === 0) {
    const error = new Error('At least one supported update field is required.');
    error.statusCode = 400;
    error.code = 'REQUEST_UPDATE_EMPTY';
    throw error;
  }

  if (validated.status !== undefined) {
    validateRequiredString(validated.status, 'status', 1, 50);
  }

  if (validated.assigned_to !== undefined) {
    requestValidator.validateRouteId(validated.assigned_to);
  }

  if (validated.internal_notes !== undefined) {
    validateRequiredString(
      validated.internal_notes,
      'internal_notes',
      0,
      10000,
    );
  }

  return validated;
}

/**
 * POST /requests
 *
 * Validates a submission but does not claim that it was persisted.
 */
const createRequest = asyncHandler(async (req, res) => {
  validateCreateBody(req.body);
  return sendUnavailable(res, req);
});

/**
 * GET /requests
 *
 * Requires authentication and appropriate staff authorization at the
 * route or application layer before exposing request records.
 */
const listRequests = asyncHandler(async (req, res) => {
  validateListQuery(req.query);
  return sendUnavailable(res, req);
});

/**
 * GET /requests/:id
 */
const getRequestById = asyncHandler(async (req, res) => {
  validateRequestId(req.params);
  return sendUnavailable(res, req);
});

/**
 * PATCH /requests/:id
 *
 * Authorization and allowed state transitions must be enforced by the
 * request service before persistence is enabled.
 */
const updateRequest = asyncHandler(async (req, res) => {
  validateRequestId(req.params);
  validateUpdateBody(req.body);
  return sendUnavailable(res, req);
});

/**
 * DELETE /requests/:id
 *
 * Deletion policy and resource-level authorization are not configured.
 */
const deleteRequest = asyncHandler(async (req, res) => {
  validateRequestId(req.params);
  return sendUnavailable(res, req);
});

module.exports = Object.freeze({
  createRequest,
  listRequests,
  getRequestById,
  updateRequest,
  deleteRequest,
});
