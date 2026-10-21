
'use strict';

const {
  asyncHandler,
  sendSuccess,
  httpError,
} = require('../utils/http');

const validator = require('../validators/verification.validator');
const { unavailable } = require('./controller.helpers');

const verificationService = require('../services/verification.service');

const controller = Object.create(null);

function requireServiceMethod(name) {
  if (
    !verificationService ||
    typeof verificationService[name] !== 'function'
  ) {
    unavailable(`Verification service operation "${name}"`);
  }

  return verificationService[name].bind(verificationService);
}

function requireAuthenticatedUser(req) {
  if (!req.user) {
    throw httpError(
      401,
      'UNAUTHENTICATED',
      'Authentication is required.'
    );
  }

  const userId = req.user.id ?? req.user.userId;

  if (
    (typeof userId !== 'string' && typeof userId !== 'number') ||
    String(userId).trim() === ''
  ) {
    throw httpError(
      401,
      'UNAUTHENTICATED',
      'Authentication is required.'
    );
  }

  return userId;
}

async function validateRequest(methodName, body, errorCode, label) {
  if (!validator || typeof validator[methodName] !== 'function') {
    unavailable(`${label} validation`);
  }

  const result = await validator[methodName](body);

  if (!result || result.error) {
    throw httpError(
      400,
      errorCode,
      result?.error?.message || `The ${label} is invalid.`
    );
  }

  // Support validators that return { value } while retaining compatibility
  // with validators that return the validated data directly.
  return result.value !== undefined ? result.value : result;
}

/**
 * POST /verification/request
 *
 * Expected service contract:
 *   verificationService.request(validatedData, { userId, request })
 *
 * The service must generate a cryptographically secure code, store only
 * a protected representation, deliver it through the configured provider,
 * expire it, rate-limit requests, and prevent account enumeration.
 */
controller.request = asyncHandler(async (req, res) => {
  const userId = requireAuthenticatedUser(req);

  const data = await validateRequest(
    'validateRequest',
    req.body,
    'INVALID_VERIFICATION_REQUEST',
    'verification request'
  );

  const requestVerification = requireServiceMethod('request');

  await requestVerification(data, {
    userId,
    request: req,
  });

  return sendSuccess(
    res,
    {
      message: 'If the details are eligible, verification instructions will be sent.',
    },
    202
  );
});

/**
 * POST /verification/confirm
 *
 * Expected service contract:
 *   verificationService.confirm(validatedData, { userId, request })
 *
 * The service must enforce expiry, attempt limits, ownership, one-time use,
 * and atomic state transitions before marking a target as verified.
 */
controller.confirm = asyncHandler(async (req, res) => {
  const userId = requireAuthenticatedUser(req);

  const data = await validateRequest(
    'validateConfirm',
    req.body,
    'INVALID_VERIFICATION_CONFIRMATION',
    'verification confirmation'
  );

  const confirmVerification = requireServiceMethod('confirm');

  const result = await confirmVerification(data, {
    userId,
    request: req,
  });

  if (!result || result.verified !== true) {
    throw httpError(
      400,
      'VERIFICATION_FAILED',
      'The verification code is invalid or expired.'
    );
  }

  return sendSuccess(
    res,
    {
      verified: true,
      message: 'Verification confirmed successfully.',
    },
    200
  );
});

module.exports = controller;
