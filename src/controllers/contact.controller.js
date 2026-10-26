
'use strict';

const {
  asyncHandler,
  sendSuccess,
  httpError,
} = require('../utils/http');

const validator = require('../validators/contact.validator');
const repository = require('../repositories/contact.repository');

const controller = Object.create(null);

const ALLOWED_FIELDS = Object.freeze([
  'name',
  'firstName',
  'lastName',
  'email',
  'phone',
  'subject',
  'message',
  'service',
  'course',
  'preferredContactMethod',
  'consent',
]);

const MAX_BODY_FIELDS = 20;

/**
 * POST /contact
 *
 * Validates and stores a public contact enquiry.
 *
 * Security:
 * - Accepts only allowlisted fields.
 * - Never trusts client-supplied ownership, status, or assignment fields.
 * - Relies on route-level rate limiting and server-side validation.
 *
 * Validator contract:
 *   validator.validate(body)
 *
 * Repository contract:
 *   repository.create(validatedData)
 */
controller.create = asyncHandler(async (req, res) => {
  if (!req.is('application/json')) {
    throw httpError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Submit the contact form using application/json.'
    );
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw httpError(
      400,
      'INVALID_CONTACT_REQUEST',
      'Please provide valid contact information.'
    );
  }

  if (Object.keys(req.body).length > MAX_BODY_FIELDS) {
    throw httpError(
      400,
      'TOO_MANY_FIELDS',
      'The contact form contains too many fields.'
    );
  }

  if (!validator || typeof validator.validate !== 'function') {
    throw httpError(
      503,
      'VALIDATOR_UNAVAILABLE',
      'Contact form validation is not configured.'
    );
  }

  if (!repository || typeof repository.create !== 'function') {
    throw httpError(
      503,
      'CONTACT_SERVICE_UNAVAILABLE',
      'The contact service is not configured.'
    );
  }

  const unsupportedFields = Object.keys(req.body).filter(
    (field) => !ALLOWED_FIELDS.includes(field)
  );

  if (unsupportedFields.length > 0) {
    throw httpError(
      400,
      'UNSUPPORTED_CONTACT_FIELDS',
      `Unsupported contact fields: ${unsupportedFields.join(', ')}.`
    );
  }

  const data = validator.validate(req.body);

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    Object.keys(data).length === 0
  ) {
    throw httpError(
      400,
      'INVALID_CONTACT_REQUEST',
      'Please provide valid contact information.'
    );
  }

  const validatedFields = Object.keys(data);

  if (validatedFields.some((field) => !ALLOWED_FIELDS.includes(field))) {
    throw httpError(
      400,
      'INVALID_VALIDATOR_OUTPUT',
      'Contact validation returned unsupported fields.'
    );
  }

  const result = await repository.create(data);

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw httpError(
      500,
      'CONTACT_CREATE_FAILED',
      'Your message could not be submitted. Please try again later.'
    );
  }

  const response = {
    message: 'Your enquiry has been submitted successfully.',
  };

  if (
    result.id !== undefined &&
    result.id !== null &&
    (typeof result.id === 'string' || Number.isSafeInteger(result.id))
  ) {
    response.id = result.id;
  }

  return sendSuccess(res, response, 201);
});

module.exports = controller;
